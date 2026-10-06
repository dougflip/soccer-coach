import type { GameId, TeamId } from "../../domain/ids.ts";
import type { SoccerDb } from "../db.ts";
import { GameSchema, type Game } from "../schemas.ts";

export function gamesRepo(db: SoccerDb) {
  return {
    /** All non-deleted games, newest first. */
    async list(teamId: TeamId): Promise<Game[]> {
      const rows = await db.games.where("teamId").equals(teamId).toArray();
      return rows
        .map((r) => GameSchema.parse(r))
        .filter((g) => !g.deleted)
        .toSorted((a, b) => b.startsAt.localeCompare(a.startsAt));
    },

    async get(id: GameId): Promise<Game | undefined> {
      const row = await db.games.get(id);
      return row ? GameSchema.parse(row) : undefined;
    },

    async save(game: Game): Promise<void> {
      const valid = GameSchema.parse(game);
      await db.transaction("rw", db.games, db.outbox, async () => {
        await db.games.put(valid);
        await db.outbox.add({ table: "games", rowId: valid.id });
      });
    },
  };
}
