import type { EventOf, GameEvent } from "./events.ts";
import { assertNever } from "./events.ts";

type ClockEvent = EventOf<"period_started" | "clock_paused" | "clock_resumed" | "clock_adjusted">;

/**
 * Game clock for one period at wall time `wallNow`, derived from timestamps
 * (never a ticking counter) so it survives phone lock / reload.
 * Returns `null` if the period hasn't started.
 */
export function periodClockMs(
  effective: readonly GameEvent[],
  period: number,
  wallNow: number,
): number | null {
  const ended = effective.find(
    (e): e is EventOf<"period_ended"> => e.type === "period_ended" && e.at.period === period,
  );
  if (ended) return ended.at.ms;

  const anchors = effective
    .filter(
      (e): e is ClockEvent =>
        (e.type === "period_started" ||
          e.type === "clock_paused" ||
          e.type === "clock_resumed" ||
          e.type === "clock_adjusted") &&
        e.period === period,
    )
    .toSorted((a, b) => a.wallTime - b.wallTime || a.createdAt - b.createdAt);

  let started = false;
  let running = false;
  let ms = 0;
  let lastWall = 0;

  for (const a of anchors) {
    switch (a.type) {
      case "period_started":
        // Duplicate starts (e.g. both coaches tapped) are ignored.
        if (!started) {
          started = true;
          running = true;
          ms = 0;
          lastWall = a.wallTime;
        }
        break;
      case "clock_paused":
        if (running) ms += a.wallTime - lastWall;
        running = false;
        lastWall = a.wallTime;
        break;
      case "clock_resumed":
        running = true;
        lastWall = a.wallTime;
        break;
      case "clock_adjusted":
        ms = a.ms;
        lastWall = a.wallTime;
        break;
      default:
        assertNever(a);
    }
  }

  if (!started) return null;
  if (running) ms += Math.max(0, wallNow - lastWall);
  return ms;
}
