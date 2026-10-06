import { Dexie, type Table } from "dexie";
import type { z } from "zod";
import type { GameEventSchema } from "../domain/events.ts";
import type { GameSchema, OutboxEntry, PlayerSchema } from "./schemas.ts";

// Stored shapes are the schemas' *input* types (plain strings, no brands);
// repos parse on the way out.
type StoredPlayer = z.input<typeof PlayerSchema>;
type StoredGame = z.input<typeof GameSchema>;
type StoredEvent = z.input<typeof GameEventSchema>;

export type MetaEntry = { key: string; value: string };

export class SoccerDb extends Dexie {
  // `declare` (not `!`) so class-field semantics don't clobber the tables Dexie assigns.
  declare players: Table<StoredPlayer, string>;
  declare games: Table<StoredGame, string>;
  declare gameEvents: Table<StoredEvent, string>;
  declare outbox: Table<OutboxEntry, number>;
  declare meta: Table<MetaEntry, string>;

  constructor(name = "soccer-coach") {
    super(name);
    this.version(1).stores({
      players: "id, teamId",
      games: "id, teamId, startsAt",
      gameEvents: "id, gameId",
      outbox: "++seq, table, rowId",
      meta: "key",
    });
  }
}

export const db = new SoccerDb();

export async function getMeta(database: SoccerDb, key: string): Promise<string | undefined> {
  return (await database.meta.get(key))?.value;
}

export async function setMeta(database: SoccerDb, key: string, value: string): Promise<void> {
  await database.meta.put({ key, value });
}
