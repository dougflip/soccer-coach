import { GameEventSchema, type GameEvent } from "../../domain/events.ts";
import type { GameId } from "../../domain/ids.ts";
import type { SoccerDb } from "../db.ts";

export function eventsRepo(db: SoccerDb) {
  return {
    async forGame(gameId: GameId): Promise<GameEvent[]> {
      const rows = await db.gameEvents.where("gameId").equals(gameId).toArray();
      return rows.map((r) => GameEventSchema.parse(r));
    },

    /** Every event, grouped by game (season stats). */
    async byGame(): Promise<Map<GameId, GameEvent[]>> {
      const out = new Map<GameId, GameEvent[]>();
      for (const row of await db.gameEvents.toArray()) {
        const e = GameEventSchema.parse(row);
        out.set(e.gameId, [...(out.get(e.gameId) ?? []), e]);
      }
      return out;
    },

    /** Append events (immutable). Multiple events from one action land atomically. */
    async append(...events: GameEvent[]): Promise<void> {
      const valid = events.map((e) => GameEventSchema.parse(e));
      await db.transaction("rw", db.gameEvents, db.outbox, async () => {
        await db.gameEvents.bulkAdd(valid);
        await db.outbox.bulkAdd(valid.map((e) => ({ table: "game_events" as const, rowId: e.id })));
      });
    },
  };
}
