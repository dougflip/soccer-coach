import type { EventOf, GameEvent } from "./events.ts";
import type { EventId, GameId, PlayerId } from "./ids.ts";
import { mapPositions, type Lineup } from "./positions.ts";
import type { GameTime } from "./time.ts";

/**
 * Pure event factories: UI actions -> events to append. Side effects (IDs,
 * wall clock) are injected so these stay deterministic in tests.
 */
export type CommandContext = {
  gameId: GameId;
  newId: () => EventId;
  now: () => number;
};

type Payload<T extends GameEvent["type"]> = Omit<
  EventOf<T>,
  "id" | "gameId" | "createdAt" | "type"
>;

function make<T extends GameEvent["type"]>(
  ctx: CommandContext,
  type: T,
  payload: Payload<T>,
): EventOf<T> {
  const event = { id: ctx.newId(), gameId: ctx.gameId, createdAt: ctx.now(), type, ...payload };
  // TS can't prove `{ type: T, ...Payload<T> }` is exactly EventOf<T>; it is by construction.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return event as EventOf<T>;
}

export const setPresence = (
  ctx: CommandContext,
  playerId: PlayerId,
  present: boolean,
  at: GameTime | null = null,
) => make(ctx, "presence_set", { playerId, present, at });

export const setLineup = (ctx: CommandContext, at: GameTime, lineup: Lineup) =>
  make(ctx, "lineup_set", { at, lineup });

export const setAvailability = (
  ctx: CommandContext,
  playerId: PlayerId,
  available: boolean,
  at: GameTime,
) => make(ctx, "availability_set", { playerId, available, at });

export const startPeriod = (ctx: CommandContext, period: number) =>
  make(ctx, "period_started", { period, wallTime: ctx.now() });

export const pauseClock = (ctx: CommandContext, period: number) =>
  make(ctx, "clock_paused", { period, wallTime: ctx.now() });

export const resumeClock = (ctx: CommandContext, period: number) =>
  make(ctx, "clock_resumed", { period, wallTime: ctx.now() });

export const adjustClock = (ctx: CommandContext, period: number, ms: number) =>
  make(ctx, "clock_adjusted", { period, ms, wallTime: ctx.now() });

export const endPeriod = (ctx: CommandContext, at: GameTime) =>
  make(ctx, "period_ended", { at, wallTime: ctx.now() });

export const voidEvent = (ctx: CommandContext, targetId: EventId) =>
  make(ctx, "event_voided", { targetId });

/** After-the-fact edit: void the original and append a corrected copy. */
export function replaceEvent<E extends Exclude<GameEvent, EventOf<"event_voided">>>(
  ctx: CommandContext,
  original: E,
  changes: Partial<Payload<E["type"]>>,
): [EventOf<"event_voided">, E] {
  const replacement = { ...original, ...changes, id: ctx.newId(), createdAt: ctx.now() } as E;
  return [voidEvent(ctx, original.id), replacement];
}

/**
 * Player sheet "Sub off now · unavailable": mark unavailable and put the
 * replacement (or nobody) in their slot, at the same moment.
 */
export function subOffUnavailable(
  ctx: CommandContext,
  {
    at,
    lineup,
    playerId,
    replacement,
  }: {
    at: GameTime;
    lineup: Lineup;
    playerId: PlayerId;
    replacement: PlayerId | null;
  },
): GameEvent[] {
  const next = mapPositions((p) => (lineup[p] === playerId ? replacement : lineup[p]));
  return [setAvailability(ctx, playerId, false, at), setLineup(ctx, at, next)];
}
