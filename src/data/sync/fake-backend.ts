import type { TeamId } from "../../domain/ids.ts";
import type { InsertRow, Row } from "../database.types.ts";
import type { SyncBackend } from "./backend.ts";

const page = <R extends { team_id: string }>(
  rows: Iterable<R>,
  col: (r: R) => string,
  teamId: TeamId,
  since: string | null,
  limit: number,
) =>
  [...rows]
    .filter(
      (r) => r.team_id === teamId && (since === null || Date.parse(col(r)) >= Date.parse(since)),
    )
    .toSorted((a, b) => Date.parse(col(a)) - Date.parse(col(b)))
    .slice(0, limit);

/** In-memory server with Supabase-like semantics: server-set timestamps, gte cursors, limits. */
export function fakeBackend() {
  let clock = Date.parse("2026-10-10T13:00:00Z");
  const stamp = () => new Date((clock += 1000)).toISOString();
  const players = new Map<string, Row<"players">>();
  const games = new Map<string, Row<"games">>();
  const events = new Map<string, Row<"game_events">>();
  const calls = { upsertPlayers: 0, upsertGames: 0, insertEvents: 0 };

  const backend: SyncBackend = {
    async upsertPlayers(rows: InsertRow<"players">[]) {
      calls.upsertPlayers++;
      for (const r of rows) {
        players.set(r.id, {
          archived_at: null,
          deleted: false,
          last_initials: "",
          ...r,
          updated_at: stamp(),
        });
      }
    },
    async upsertGames(rows) {
      calls.upsertGames++;
      for (const r of rows) {
        games.set(r.id, { location: null, deleted: false, ...r, updated_at: stamp() });
      }
    },
    async insertEvents(rows) {
      calls.insertEvents++;
      for (const r of rows) {
        if (!events.has(r.id)) {
          events.set(r.id, { created_by: "user", ...r, inserted_at: stamp() });
        }
      }
    },
    async pullPlayers(teamId, since, limit) {
      return page(players.values(), (r) => r.updated_at, teamId, since, limit);
    },
    async pullGames(teamId, since, limit) {
      return page(games.values(), (r) => r.updated_at, teamId, since, limit);
    },
    async pullEvents(teamId, since, limit) {
      return page(events.values(), (r) => r.inserted_at, teamId, since, limit);
    },
  };

  return {
    backend,
    calls,
    players,
    games,
    events,
    /** Simulate another writer whose transaction commits late with an older timestamp. */
    backdate: (ms: number) => new Date(clock - ms).toISOString(),
  };
}
