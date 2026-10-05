import type { PlayerId } from "./ids.ts";
import type { GameEvent } from "./events.ts";
import { assertNever } from "./events.ts";
import { sortedStateEvents, stateEventTime, type StateEvent } from "./log.ts";
import { emptyLineup, type Lineup } from "./positions.ts";
import { periodEnds } from "./status.ts";
import { compareGameTime, type GameTime } from "./time.ts";

/** Who is where at a given moment. */
export type Snapshot = {
  lineup: Lineup;
  present: ReadonlySet<PlayerId>;
  unavailable: ReadonlySet<PlayerId>;
};

type MutableSnapshot = {
  lineup: Lineup;
  present: Set<PlayerId>;
  unavailable: Set<PlayerId>;
};

function apply(s: MutableSnapshot, e: StateEvent): void {
  switch (e.type) {
    case "presence_set":
      if (e.present) s.present.add(e.playerId);
      else s.present.delete(e.playerId);
      break;
    case "lineup_set":
      s.lineup = e.lineup;
      break;
    case "availability_set":
      if (e.available) s.unavailable.delete(e.playerId);
      else s.unavailable.add(e.playerId);
      break;
    default:
      assertNever(e);
  }
}

const freeze = (s: MutableSnapshot): Snapshot => ({
  lineup: s.lineup,
  present: new Set(s.present),
  unavailable: new Set(s.unavailable),
});

/** State after applying every event at or before `t`. Lineups carry across periods. */
export function snapshotAt(effective: readonly GameEvent[], t: GameTime): Snapshot {
  const s: MutableSnapshot = { lineup: emptyLineup(), present: new Set(), unavailable: new Set() };
  for (const e of sortedStateEvents(effective)) {
    if (compareGameTime(stateEventTime(e), t) > 0) break;
    apply(s, e);
  }
  return freeze(s);
}

export type Interval = {
  period: number;
  startMs: number;
  endMs: number;
  state: Snapshot;
};

/**
 * Split each period into intervals where nothing changes. Periods end at their
 * `period_ended` time; an open (live) period ends at `until` if given,
 * otherwise it's skipped.
 */
export function intervals(effective: readonly GameEvent[], until?: GameTime): Interval[] {
  const ends = periodEnds(effective);
  if (until && !ends.has(until.period)) ends.set(until.period, until.ms);

  const events = sortedStateEvents(effective);
  const s: MutableSnapshot = { lineup: emptyLineup(), present: new Set(), unavailable: new Set() };
  const out: Interval[] = [];
  let i = 0;
  const applyThrough = (t: GameTime) => {
    while (i < events.length) {
      const e = events[i];
      if (!e || compareGameTime(stateEventTime(e), t) > 0) break;
      apply(s, e);
      i++;
    }
  };

  for (const period of [...ends.keys()].toSorted((a, b) => a - b)) {
    const end = ends.get(period) ?? 0;
    const cuts = new Set([0]);
    for (const e of events) {
      const t = stateEventTime(e);
      if (t.period === period && t.ms < end) cuts.add(t.ms);
    }
    const sorted = [...cuts].toSorted((a, b) => a - b);
    sorted.forEach((startMs, idx) => {
      applyThrough({ period, ms: startMs });
      const endMs = sorted[idx + 1] ?? end;
      if (endMs > startMs) out.push({ period, startMs, endMs, state: freeze(s) });
    });
    // Events recorded after the period's end still carry into the next period.
    applyThrough({ period, ms: Number.MAX_SAFE_INTEGER });
  }
  return out;
}
