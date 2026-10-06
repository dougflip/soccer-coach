import { liveQuery } from "dexie";
import type { TeamId } from "../../domain/ids.ts";
import { getMeta, setMeta, type SoccerDb } from "../db.ts";
import { GameEventSchema } from "../../domain/events.ts";
import { GameSchema, PlayerSchema, type SyncTable } from "../schemas.ts";
import type { SyncBackend } from "./backend.ts";
import {
  eventToRow,
  gameToRow,
  playerToRow,
  rowToEvent,
  rowToGame,
  rowToPlayer,
} from "./mappers.ts";

export type SyncStatus = {
  state: "idle" | "syncing" | "offline" | "error";
  /** Local changes not yet confirmed by the server. */
  pending: number;
  lastSyncedAt: number | null;
  error: string | null;
};

type Options = {
  /** Re-read this much before the cursor so late-committing rows aren't missed. */
  overlapMs: number;
  pageSize: number;
  pollMs: number;
  debounceMs: number;
};

const present = <T>(rows: (T | undefined)[]): T[] => rows.filter((r) => r !== undefined);

const DEFAULTS: Options = { overlapMs: 30_000, pageSize: 500, pollMs: 60_000, debounceMs: 500 };

/**
 * Basic sync (Phase 1): push the outbox, then pull changes since a per-table
 * cursor. Conflicts: events are immutable (union by id); rows are
 * last-write-wins, except a row with unpushed local changes isn't overwritten.
 */
export class SyncEngine {
  private status: SyncStatus = { state: "idle", pending: 0, lastSyncedAt: null, error: null };
  private listeners = new Set<() => void>();
  private running: Promise<void> | null = null;
  private rerun = false;
  private readonly opts: Options;

  constructor(
    private readonly db: SoccerDb,
    private readonly backend: SyncBackend,
    private readonly teamId: TeamId,
    opts: Partial<Options> = {},
  ) {
    this.opts = { ...DEFAULTS, ...opts };
  }

  // --- status store (for useSyncExternalStore) ---

  getStatus = (): SyncStatus => this.status;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setStatus(patch: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...patch };
    for (const l of this.listeners) l();
  }

  // --- sync ---

  /** Push then pull. Concurrent calls coalesce into one follow-up run. */
  syncNow = async (): Promise<void> => {
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.running = this.run();
    try {
      await this.running;
    } finally {
      this.running = null;
    }
    if (this.rerun) {
      this.rerun = false;
      await this.syncNow();
    }
  };

  private async run(): Promise<void> {
    this.setStatus({ state: "syncing" });
    try {
      await this.push();
      await this.pull();
      this.setStatus({ state: "idle", lastSyncedAt: Date.now(), error: null });
    } catch (e) {
      const offline =
        typeof navigator !== "undefined" && "onLine" in navigator && !navigator.onLine;
      this.setStatus({
        state: offline ? "offline" : "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async push(): Promise<void> {
    const entries = await this.db.outbox.orderBy("seq").toArray();
    if (entries.length === 0) return;
    const idsFor = (table: SyncTable) => [
      ...new Set(entries.filter((e) => e.table === table).map((e) => e.rowId)),
    ];

    // Order matters: events reference games.
    const players = present(await this.db.players.bulkGet(idsFor("players")));
    if (players.length) {
      await this.backend.upsertPlayers(players.map((p) => playerToRow(PlayerSchema.parse(p))));
    }
    const games = present(await this.db.games.bulkGet(idsFor("games")));
    if (games.length) {
      await this.backend.upsertGames(games.map((g) => gameToRow(GameSchema.parse(g))));
    }
    const events = present(await this.db.gameEvents.bulkGet(idsFor("game_events")));
    if (events.length) {
      await this.backend.insertEvents(
        events.map((e) => eventToRow(GameEventSchema.parse(e), this.teamId)),
      );
    }

    // Only remove what we pushed; writes made during the push keep their entries.
    await this.db.outbox.bulkDelete(present(entries.map((e) => e.seq)));
  }

  async pull(): Promise<void> {
    await this.pullTable(
      "players",
      (since, limit) => this.backend.pullPlayers(this.teamId, since, limit),
      async (rows, pending) => {
        const incoming = rows.map(rowToPlayer).filter((p) => !pending.has(p.id));
        await this.db.players.bulkPut(incoming);
        return rows.map((r) => r.updated_at);
      },
    );
    await this.pullTable(
      "games",
      (since, limit) => this.backend.pullGames(this.teamId, since, limit),
      async (rows, pending) => {
        const incoming = rows.map(rowToGame).filter((g) => !pending.has(g.id));
        await this.db.games.bulkPut(incoming);
        return rows.map((r) => r.updated_at);
      },
    );
    await this.pullTable(
      "game_events",
      (since, limit) => this.backend.pullEvents(this.teamId, since, limit),
      async (rows) => {
        await this.db.gameEvents.bulkPut(rows.map(rowToEvent));
        return rows.map((r) => r.inserted_at);
      },
    );
  }

  private async pullTable<R>(
    table: SyncTable,
    fetch: (since: string | null, limit: number) => Promise<R[]>,
    apply: (rows: R[], pendingIds: Set<string>) => Promise<string[]>,
  ): Promise<void> {
    const key = `cursor:${table}`;
    const saved = await getMeta(this.db, key);
    let since = saved ? new Date(Date.parse(saved) - this.opts.overlapMs).toISOString() : null;
    let cursor = saved ?? null;

    // Pages depend on the previous page's cursor, so awaiting in the loop is intended.
    /* oxlint-disable no-await-in-loop */
    for (;;) {
      const rows = await fetch(since, this.opts.pageSize);
      if (rows.length === 0) break;
      const pending = new Set(
        (await this.db.outbox.where("table").equals(table).toArray()).map((e) => e.rowId),
      );
      const stamps = await this.db.transaction(
        "rw",
        [this.db.players, this.db.games, this.db.gameEvents],
        () => apply(rows, pending),
      );
      const last = stamps.at(-1) ?? null;
      if (last && (!cursor || Date.parse(last) > Date.parse(cursor))) cursor = last;
      // Page boundary uses >= so equal timestamps aren't skipped; stop if not advancing.
      if (
        rows.length < this.opts.pageSize ||
        last === null ||
        (since !== null && Date.parse(last) <= Date.parse(since))
      )
        break;
      since = last;
    }
    /* oxlint-enable no-await-in-loop */
    if (cursor) await setMeta(this.db, key, cursor);
  }

  // --- scheduling ---

  /** Start background syncing. Returns a stop function. */
  start(): () => void {
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void this.syncNow(), this.opts.debounceMs);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void this.syncNow();
    };
    const onOnline = () => void this.syncNow();

    const outbox = liveQuery(() => this.db.outbox.count()).subscribe({
      next: (pending) => {
        const grew = pending > this.status.pending;
        this.setStatus({ pending });
        if (grew) schedule();
      },
    });
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void this.syncNow();
    }, this.opts.pollMs);
    void this.syncNow();

    return () => {
      clearTimeout(debounce);
      clearInterval(poll);
      outbox.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }
}
