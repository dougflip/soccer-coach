import type { PlayerId } from "./ids.ts";
import { POSITIONS, type Lineup, type Position } from "./positions.ts";
import type { Segment } from "./segments.ts";
import type { GameTime } from "./time.ts";

/**
 * How long a player has been on the field continuously (any position) as of
 * `at`, within the current period. `null` if not on the field at `at`.
 * Position moves don't reset a stint; going to the bench or halftime does.
 */
export function stintMs(
  segments: readonly Segment[],
  playerId: PlayerId,
  at: GameTime,
): number | null {
  const mine = segments
    .filter((s) => s.playerId === playerId && s.period === at.period && s.startMs <= at.ms)
    .toSorted((a, b) => b.startMs - a.startMs);

  const current = mine[0];
  if (!current || current.bucket.kind !== "field" || current.endMs < at.ms) return null;

  let start = current.startMs;
  for (const s of mine.slice(1)) {
    if (s.bucket.kind !== "field" || s.endMs !== start) break;
    start = s.startMs;
  }
  return at.ms - start;
}

/**
 * Players to highlight as "been out there longest": the top `count` stints
 * (ties included) among positions not excluded (GK by default).
 */
export function longestStints(
  segments: readonly Segment[],
  lineup: Lineup,
  at: GameTime,
  { count = 2, exclude = ["GK"] }: { count?: number; exclude?: readonly Position[] } = {},
): Set<PlayerId> {
  const stints = POSITIONS.filter((p) => !exclude.includes(p)).flatMap((p) => {
    const id = lineup[p];
    const ms = id === null ? null : stintMs(segments, id, at);
    return id === null || ms === null ? [] : [{ id, ms }];
  });
  const threshold = stints.map((s) => s.ms).toSorted((a, b) => b - a)[count - 1];
  if (threshold === undefined || threshold <= 0) return new Set();
  return new Set(stints.filter((s) => s.ms >= threshold).map((s) => s.id));
}
