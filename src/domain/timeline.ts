import { replaceEvent, voidEvent, type CommandContext } from "./commands.ts";
import { assertNever, type EventOf, type GameEvent } from "./events.ts";
import { diffLineups, type LineupDiff } from "./lineup-edit.ts";
import { emptyLineup } from "./positions.ts";
import { periodEnds } from "./status.ts";
import { compareGameTime, type GameTime } from "./time.ts";

/** One row of the editable game timeline. */
export type TimelineEntry =
  | {
      kind: "lineup";
      event: EventOf<"lineup_set">;
      at: GameTime;
      diff: LineupDiff;
      kickoff: boolean;
    }
  | { kind: "availability"; event: EventOf<"availability_set">; at: GameTime }
  | { kind: "arrival"; event: EventOf<"presence_set">; at: GameTime }
  | { kind: "periodEnd"; event: EventOf<"period_ended">; at: GameTime };

type Timed = Exclude<TimelineEntry, { kind: "lineup" }>["event"] | EventOf<"lineup_set">;

/** Effective events that have a game time, in game order, with each lineup diffed against the previous. */
export function timeline(effective: readonly GameEvent[]): TimelineEntry[] {
  const timed = effective
    .filter(
      (e): e is Timed =>
        e.type === "lineup_set" ||
        e.type === "availability_set" ||
        e.type === "period_ended" ||
        (e.type === "presence_set" && e.at !== null),
    )
    .toSorted(
      (a, b) =>
        compareGameTime(timeOf(a), timeOf(b)) ||
        // At the same moment: lineup/availability before a period end.
        Number(a.type === "period_ended") - Number(b.type === "period_ended") ||
        a.createdAt - b.createdAt,
    );

  let previous = emptyLineup();
  return timed.map((event): TimelineEntry => {
    const at = timeOf(event);
    switch (event.type) {
      case "lineup_set": {
        const entry: TimelineEntry = {
          kind: "lineup",
          event,
          at,
          diff: diffLineups(previous, event.lineup),
          kickoff: at.ms === 0,
        };
        previous = event.lineup;
        return entry;
      }
      case "availability_set":
        return { kind: "availability", event, at };
      case "presence_set":
        return { kind: "arrival", event, at };
      case "period_ended":
        return { kind: "periodEnd", event, at };
      default:
        return assertNever(event);
    }
  });
}

function timeOf(e: Timed): GameTime {
  // presence_set with at === null is filtered out above.
  return e.at ?? { period: 0, ms: 0 };
}

/** Kickoff lineups and period ends can be re-timed but not deleted. */
export const canDelete = (entry: TimelineEntry): boolean =>
  !(entry.kind === "periodEnd" || (entry.kind === "lineup" && entry.kickoff));

/** Re-time an entry (void + replacement), clamped to its period. */
export function retime(
  ctx: CommandContext,
  effective: readonly GameEvent[],
  entry: TimelineEntry,
  ms: number,
): GameEvent[] {
  const end = entry.kind === "periodEnd" ? undefined : periodEnds(effective).get(entry.at.period);
  const clamped = Math.max(0, Math.min(Math.round(ms), end ?? Number.MAX_SAFE_INTEGER));
  const at = { period: entry.at.period, ms: clamped };
  return replaceEvent(ctx, entry.event, { at });
}

export const removeEntry = (ctx: CommandContext, entry: TimelineEntry): GameEvent[] => [
  voidEvent(ctx, entry.event.id),
];
