import type { PlayerId, TeamId } from "../../domain/ids.ts";
import type { SoccerDb } from "../db.ts";
import { displayName, PlayerSchema, type Player } from "../schemas.ts";

const byName = (a: Player, b: Player) => displayName(a).localeCompare(displayName(b));

export function playersRepo(db: SoccerDb) {
  return {
    /** Active roster (not archived/deleted), alphabetical. */
    async roster(teamId: TeamId): Promise<Player[]> {
      const rows = await db.players.where("teamId").equals(teamId).toArray();
      return rows
        .map((r) => PlayerSchema.parse(r))
        .filter((p) => !p.deleted && p.archivedAt === null)
        .toSorted(byName);
    },

    /** Everyone incl. archived (for stats). */
    async all(teamId: TeamId): Promise<Player[]> {
      const rows = await db.players.where("teamId").equals(teamId).toArray();
      return rows.map((r) => PlayerSchema.parse(r)).filter((p) => !p.deleted);
    },

    async get(id: PlayerId): Promise<Player | undefined> {
      const row = await db.players.get(id);
      return row ? PlayerSchema.parse(row) : undefined;
    },

    /** Create or update. Validates, then writes the row + outbox entry atomically. */
    async save(player: Player): Promise<void> {
      const valid = PlayerSchema.parse(player);
      await db.transaction("rw", db.players, db.outbox, async () => {
        await db.players.put(valid);
        await db.outbox.add({ table: "players", rowId: valid.id });
      });
    },
  };
}
