import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { setLineup, startPeriod } from "../../domain/commands.ts";
import { GameIdSchema, TeamIdSchema } from "../../domain/ids.ts";
import { emptyLineup } from "../../domain/positions.ts";
import { pid, testGame } from "../../domain/test-utils.ts";
import { gameTime } from "../../domain/time.ts";
import { SoccerDb } from "../db.ts";
import { createRepos } from "../repos/index.ts";
import type { Game, Player } from "../schemas.ts";
import { SyncEngine } from "./engine.ts";
import { fakeBackend } from "./fake-backend.ts";

const TEAM = TeamIdSchema.parse("00000000-0000-4000-8000-0000000000aa");
const GAME = GameIdSchema.parse("00000000-0000-4000-8000-000000000001");

let n = 0;
const dbs: SoccerDb[] = [];
function device(server: ReturnType<typeof fakeBackend>, opts = {}) {
  const db = new SoccerDb(`test-${++n}`);
  dbs.push(db);
  return { db, repos: createRepos(db), sync: new SyncEngine(db, server.backend, TEAM, opts) };
}

afterEach(async () => {
  await Promise.all(dbs.splice(0).map((d) => d.delete()));
});

const maya = (overrides: Partial<Player> = {}): Player => ({
  id: pid("maya"),
  teamId: TEAM,
  firstName: "Maya",
  lastInitials: "R",
  archivedAt: null,
  deleted: false,
  updatedAt: null,
  ...overrides,
});

const game: Game = {
  id: GAME,
  teamId: TEAM,
  opponent: "Tigers",
  startsAt: "2026-10-10T13:00:00.000Z",
  location: null,
  deleted: false,
  updatedAt: null,
};

describe("SyncEngine", () => {
  it("pushes local writes and another device pulls them", async () => {
    const server = fakeBackend();
    const a = device(server);
    const b = device(server);

    await a.repos.players.save(maya());
    expect(await a.db.outbox.count()).toBe(1);
    await a.sync.syncNow();
    expect(await a.db.outbox.count()).toBe(0);

    await b.sync.syncNow();
    const roster = await b.repos.players.roster(TEAM);
    expect(roster.map((p) => p.firstName)).toEqual(["Maya"]);
    expect(roster[0]?.updatedAt).not.toBeNull();
  });

  it("last write wins between devices", async () => {
    const server = fakeBackend();
    const a = device(server);
    const b = device(server);
    await a.repos.players.save(maya());
    await a.sync.syncNow();
    await b.sync.syncNow();

    await b.repos.players.save(maya({ lastInitials: "Ro" }));
    await b.sync.syncNow();
    await a.sync.syncNow();
    expect((await a.repos.players.get(pid("maya")))?.lastInitials).toBe("Ro");
  });

  it("doesn't overwrite a row that has unpushed local changes", async () => {
    const server = fakeBackend();
    const a = device(server);
    await a.repos.players.save(maya());
    await a.sync.syncNow();

    // Server changes underneath; local edit is pending (e.g. push failed).
    await server.backend.upsertPlayers([{ id: pid("maya"), team_id: TEAM, first_name: "Server" }]);
    await a.repos.players.save(maya({ firstName: "Local" }));
    await a.sync.pull();
    expect((await a.repos.players.get(pid("maya")))?.firstName).toBe("Local");

    await a.sync.syncNow(); // push wins, then pull confirms
    expect(server.players.get(pid("maya"))?.first_name).toBe("Local");
  });

  it("syncs game events (games first, idempotent re-push)", async () => {
    const server = fakeBackend();
    const a = device(server);
    const b = device(server);
    const g = testGame();
    const ctx = { ...g.ctx, gameId: GAME };

    await a.repos.games.save(game);
    await a.repos.events.append(setLineup(ctx, gameTime(1, 0), emptyLineup()), startPeriod(ctx, 1));
    await a.sync.syncNow();
    expect(server.events.size).toBe(2);

    // Re-pushing the same events (e.g. retry after a lost response) changes nothing.
    const evs = await a.repos.events.forGame(GAME);
    await a.db.outbox.bulkAdd(evs.map((e) => ({ table: "game_events" as const, rowId: e.id })));
    await a.sync.syncNow();
    expect(server.events.size).toBe(2);

    await b.sync.syncNow();
    const synced = await b.repos.events.forGame(GAME);
    expect(synced.map((e) => e.type).toSorted()).toEqual(["lineup_set", "period_started"]);
    expect(synced).toEqual(expect.arrayContaining(evs));
  });

  it("pages through large pulls", async () => {
    const server = fakeBackend();
    const a = device(server);
    const b = device(server, { pageSize: 3 });
    const names = ["ava", "chloe", "ella", "emma", "harper", "lily", "maya"] as const;
    await Promise.all(
      names.map((name) => a.repos.players.save(maya({ id: pid(name), firstName: name }))),
    );
    await a.sync.syncNow();
    await b.sync.syncNow();
    expect(await b.repos.players.roster(TEAM)).toHaveLength(7);
  });

  it("picks up rows that commit late with an earlier timestamp (cursor overlap)", async () => {
    const server = fakeBackend();
    const a = device(server);
    await a.repos.players.save(maya());
    await a.sync.syncNow();

    // Another writer's row lands with a timestamp just before our cursor.
    server.players.set(pid("zoe"), {
      id: pid("zoe"),
      team_id: TEAM,
      first_name: "Zoe",
      last_initials: "M",
      archived_at: null,
      deleted: false,
      updated_at: server.backdate(5_000),
    });
    await a.sync.syncNow();
    expect((await a.repos.players.roster(TEAM)).map((p) => p.firstName)).toEqual(["Maya", "Zoe"]);
  });

  it("keeps outbox entries for writes made during a push", async () => {
    const server = fakeBackend();
    const a = device(server);
    const original = server.backend.upsertPlayers;
    server.backend.upsertPlayers = async (rows) => {
      await original(rows);
      await a.repos.players.save(maya({ firstName: "Edited mid-push" }));
    };
    await a.repos.players.save(maya());
    await a.sync.push();
    expect(await a.db.outbox.count()).toBe(1);
  });

  it("reports errors and keeps the outbox when the server fails", async () => {
    const server = fakeBackend();
    const a = device(server);
    server.backend.upsertPlayers = () => Promise.reject(new Error("boom"));
    await a.repos.players.save(maya());
    await a.sync.syncNow();
    expect(a.sync.getStatus()).toMatchObject({ state: "error", error: "boom" });
    expect(await a.db.outbox.count()).toBe(1);
  });
});
