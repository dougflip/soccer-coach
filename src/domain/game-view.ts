import { periodClock, type ClockReading } from "./clock.ts";
import type { GameEvent } from "./events.ts";
import type { PlayerId } from "./ids.ts";
import { effectiveEvents } from "./log.ts";
import { buildSegments, type Segment } from "./segments.ts";
import { emptyStats, statsByPlayer, totalFieldMs, type PlayerStats } from "./stats.ts";
import {
  currentGameTime,
  deriveStatus,
  DEFAULT_FORMAT,
  type GameFormat,
  type GameStatus,
} from "./status.ts";
import { longestStints, stintMs } from "./stints.ts";
import { snapshotAt, type Snapshot } from "./sweep.ts";
import type { GameTime } from "./time.ts";

/** Everything a game screen needs, derived from the event log at one moment. */
export type GameView = {
  effective: GameEvent[];
  status: GameStatus;
  /** Current game time (null before kickoff). New events are stamped with this. */
  at: GameTime | null;
  /** Live period's clock (null unless live). */
  clock: ClockReading | null;
  /** Who is where right now (pre-game: the planned kickoff state). */
  snapshot: Snapshot;
  segments: Segment[];
  statsFor: (id: PlayerId) => PlayerStats;
  /** Field minutes (ms) this game. */
  fieldMs: (id: PlayerId) => number;
  /** Current stint (ms) for players on the field, else null. */
  stint: (id: PlayerId) => number | null;
  /** Players to highlight as "on the field longest". */
  longest: ReadonlySet<PlayerId>;
};

const KICKOFF: GameTime = { period: 1, ms: 0 };

export function deriveGameView(
  events: readonly GameEvent[],
  wallNow: number,
  format: GameFormat = DEFAULT_FORMAT,
): GameView {
  const effective = effectiveEvents(events);
  const status = deriveStatus(effective, format);
  const at = currentGameTime(effective, wallNow, format);
  const clock = status.kind === "live" ? periodClock(effective, status.period, wallNow) : null;

  const snapshot =
    status.kind === "pregame"
      ? snapshotAt(effective, KICKOFF)
      : // During a break, include anything recorded after the period's end (e.g. availability).
        snapshotAt(
          effective,
          at && status.kind === "break"
            ? { period: at.period, ms: Number.MAX_SAFE_INTEGER }
            : (at ?? KICKOFF),
        );

  const segments = at ? buildSegments(effective, at) : [];
  const stats = statsByPlayer(segments);
  const statsFor = (id: PlayerId) => stats.get(id) ?? emptyStats();
  const live = status.kind === "live" && at !== null;

  return {
    effective,
    status,
    at,
    clock,
    snapshot,
    segments,
    statsFor,
    fieldMs: (id) => totalFieldMs(statsFor(id)),
    stint: (id) => (live ? stintMs(segments, id, at) : null),
    longest: live ? longestStints(segments, snapshot.lineup, at) : new Set(),
  };
}

/**
 * Pre-game attendance: everyone on the roster defaults to present until a coach
 * switches them off.
 */
export function attendance(
  effective: readonly GameEvent[],
  rosterIds: readonly PlayerId[],
): Map<PlayerId, boolean> {
  const explicit = new Map<PlayerId, boolean>();
  for (const e of effective) {
    if (e.type === "presence_set" && e.at === null) explicit.set(e.playerId, e.present);
  }
  return new Map(rosterIds.map((id) => [id, explicit.get(id) ?? true]));
}
