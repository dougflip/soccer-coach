import { z } from "zod";
import { GameIdSchema, PlayerIdSchema, TeamIdSchema } from "../domain/ids.ts";

/**
 * Local (Dexie) record shapes. Reads always go through these schemas so stored
 * data regains its branded types and schema drift fails loudly.
 *
 * `updatedAt` is server time from the last pull; `null` = never synced.
 */
export const PlayerSchema = z.object({
  id: PlayerIdSchema,
  teamId: TeamIdSchema,
  firstName: z.string().trim().min(1).max(40),
  lastInitials: z.string().trim().max(10),
  archivedAt: z.iso.datetime({ offset: true }).nullable(),
  deleted: z.boolean(),
  updatedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type Player = z.infer<typeof PlayerSchema>;

export const GameSchema = z.object({
  id: GameIdSchema,
  teamId: TeamIdSchema,
  opponent: z.string().trim().min(1).max(80),
  startsAt: z.iso.datetime({ offset: true }),
  location: z.string().trim().max(120).nullable(),
  deleted: z.boolean(),
  updatedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type Game = z.infer<typeof GameSchema>;

export const SYNC_TABLES = ["players", "games", "game_events"] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

export type OutboxEntry = {
  seq?: number;
  table: SyncTable;
  rowId: string;
};

export const displayName = (p: Pick<Player, "firstName" | "lastInitials">): string =>
  p.lastInitials ? `${p.firstName} ${p.lastInitials}.` : p.firstName;
