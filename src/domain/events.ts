import { z } from "zod";
import { EventIdSchema, GameIdSchema, PlayerIdSchema } from "./ids.ts";
import { PositionSchema } from "./positions.ts";
import { GameTimeSchema } from "./time.ts";

/**
 * A game is an append-only log of these events. All state (lineups, clock,
 * stats) is derived from the log. Corrections never mutate an event: they void
 * it (`event_voided`) and usually append a replacement.
 *
 * Two kinds of time:
 * - `at` (GameTime): where on the game clock something happened. Drives stats.
 * - `wallTime` (epoch ms): only for clock control events, so the live clock can
 *   be computed from "started at wall time X".
 */

const base = {
  id: EventIdSchema,
  gameId: GameIdSchema,
  /** Epoch ms when the event was recorded. Tie-breaker only; never used for stats. */
  createdAt: z.int(),
};

export const LineupSchema = z.record(PositionSchema, PlayerIdSchema.nullable());

export const GameEventSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("presence_set"),
    playerId: PlayerIdSchema,
    present: z.boolean(),
    /** `null` = pre-game attendance (applies from kickoff). Otherwise e.g. a late arrival. */
    at: GameTimeSchema.nullable(),
  }),
  z.object({
    ...base,
    type: z.literal("lineup_set"),
    /** Full lineup from this moment on (kickoff, sub, halftime). */
    at: GameTimeSchema,
    lineup: LineupSchema,
  }),
  z.object({
    ...base,
    type: z.literal("availability_set"),
    playerId: PlayerIdSchema,
    available: z.boolean(),
    at: GameTimeSchema,
  }),
  z.object({
    ...base,
    type: z.literal("period_started"),
    period: z.int().min(1),
    wallTime: z.int(),
  }),
  z.object({
    ...base,
    type: z.literal("clock_paused"),
    period: z.int().min(1),
    wallTime: z.int(),
  }),
  z.object({
    ...base,
    type: z.literal("clock_resumed"),
    period: z.int().min(1),
    wallTime: z.int(),
  }),
  z.object({
    ...base,
    type: z.literal("clock_adjusted"),
    period: z.int().min(1),
    wallTime: z.int(),
    /** The game clock should read this at `wallTime`. */
    ms: z.int().min(0),
  }),
  z.object({
    ...base,
    type: z.literal("period_ended"),
    at: GameTimeSchema,
    wallTime: z.int(),
  }),
  z.object({
    ...base,
    type: z.literal("event_voided"),
    targetId: EventIdSchema,
  }),
]);

export type GameEvent = z.infer<typeof GameEventSchema>;
export type GameEventType = GameEvent["type"];
export type EventOf<T extends GameEventType> = Extract<GameEvent, { type: T }>;

export function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`);
}
