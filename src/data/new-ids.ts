import { EventIdSchema, GameIdSchema, PlayerIdSchema } from "../domain/ids.ts";

// Client-generated IDs (offline creates). Parsed so they carry their brand.
export const newPlayerId = () => PlayerIdSchema.parse(crypto.randomUUID());
export const newGameId = () => GameIdSchema.parse(crypto.randomUUID());
export const newEventId = () => EventIdSchema.parse(crypto.randomUUID());
