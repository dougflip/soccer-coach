import { z } from "zod";

// Branded IDs: plain strings at runtime, distinct types at compile time so a
// GameId can't be passed where a PlayerId is expected. Brands are applied only
// by the schemas below (data entering the app) or by `newId` helpers.
export const PlayerIdSchema = z.uuid().brand<"PlayerId">();
export const GameIdSchema = z.uuid().brand<"GameId">();
export const TeamIdSchema = z.uuid().brand<"TeamId">();
export const EventIdSchema = z.uuid().brand<"EventId">();

export type PlayerId = z.infer<typeof PlayerIdSchema>;
export type GameId = z.infer<typeof GameIdSchema>;
export type TeamId = z.infer<typeof TeamIdSchema>;
export type EventId = z.infer<typeof EventIdSchema>;
