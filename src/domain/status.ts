import { periodClockMs } from "./clock.ts";
import { assertNever, type EventOf, type GameEvent } from "./events.ts";
import type { GameTime } from "./time.ts";

export type GameStatus =
  | { kind: "pregame" }
  | { kind: "live"; period: number }
  | { kind: "break"; afterPeriod: number }
  | { kind: "final" };

export type GameFormat = {
  periodCount: number;
};

export const DEFAULT_FORMAT: GameFormat = { periodCount: 2 };

const startedPeriods = (effective: readonly GameEvent[]): number[] =>
  effective
    .filter((e): e is EventOf<"period_started"> => e.type === "period_started")
    .map((e) => e.period);

/** Period -> end ms, for periods that have ended. */
export function periodEnds(effective: readonly GameEvent[]): Map<number, number> {
  const ends = new Map<number, number>();
  for (const e of effective) {
    if (e.type === "period_ended") ends.set(e.at.period, e.at.ms);
  }
  return ends;
}

export function deriveStatus(
  effective: readonly GameEvent[],
  format: GameFormat = DEFAULT_FORMAT,
): GameStatus {
  const ends = periodEnds(effective);
  const latest = Math.max(0, ...startedPeriods(effective), ...ends.keys());
  if (latest === 0) return { kind: "pregame" };
  if (!ends.has(latest)) return { kind: "live", period: latest };
  return latest >= format.periodCount ? { kind: "final" } : { kind: "break", afterPeriod: latest };
}

/**
 * "Now" on the game clock: where new events get stamped and where live stats
 * are computed up to. During a break / after the game it's the end of the last
 * period. `null` before kickoff.
 */
export function currentGameTime(
  effective: readonly GameEvent[],
  wallNow: number,
  format: GameFormat = DEFAULT_FORMAT,
): GameTime | null {
  const status = deriveStatus(effective, format);
  switch (status.kind) {
    case "pregame":
      return null;
    case "live": {
      const ms = periodClockMs(effective, status.period, wallNow) ?? 0;
      return { period: status.period, ms };
    }
    case "break":
    case "final": {
      const ends = periodEnds(effective);
      const period = Math.max(...ends.keys());
      return { period, ms: ends.get(period) ?? 0 };
    }
    default:
      return assertNever(status);
  }
}
