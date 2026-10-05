import type { PlayerId } from "./ids.ts";
import { mapPositions, POSITIONS, type Position } from "./positions.ts";
import type { Segment } from "./segments.ts";

export type PlayerStats = {
  fieldMs: Record<Position, number>;
  benchAvailableMs: number;
  benchUnavailableMs: number;
};

export const emptyStats = (): PlayerStats => ({
  fieldMs: mapPositions(() => 0),
  benchAvailableMs: 0,
  benchUnavailableMs: 0,
});

export const totalFieldMs = (s: PlayerStats): number =>
  POSITIONS.reduce((sum, p) => sum + s.fieldMs[p], 0);

/**
 * Default fairness metric: share of the time a player *could* play that they
 * did play. Absences, late arrivals and unavailable time don't count against
 * them. `null` if they had no available time.
 */
export function availableShare(s: PlayerStats): number | null {
  const field = totalFieldMs(s);
  const available = field + s.benchAvailableMs;
  return available === 0 ? null : field / available;
}

/** Per-player stats for one game. */
export function statsByPlayer(segments: readonly Segment[]): Map<PlayerId, PlayerStats> {
  const out = new Map<PlayerId, PlayerStats>();
  for (const seg of segments) {
    const s = out.get(seg.playerId) ?? emptyStats();
    const ms = seg.endMs - seg.startMs;
    if (seg.bucket.kind === "field") s.fieldMs[seg.bucket.position] += ms;
    else if (seg.bucket.available) s.benchAvailableMs += ms;
    else s.benchUnavailableMs += ms;
    out.set(seg.playerId, s);
  }
  return out;
}

export function addStats(a: PlayerStats, b: PlayerStats): PlayerStats {
  const out = emptyStats();
  for (const p of POSITIONS) out.fieldMs[p] = a.fieldMs[p] + b.fieldMs[p];
  out.benchAvailableMs = a.benchAvailableMs + b.benchAvailableMs;
  out.benchUnavailableMs = a.benchUnavailableMs + b.benchUnavailableMs;
  return out;
}

/** Season (or any multi-game) totals from per-game stats. */
export function combineGames(
  games: readonly ReadonlyMap<PlayerId, PlayerStats>[],
): Map<PlayerId, PlayerStats> {
  const out = new Map<PlayerId, PlayerStats>();
  for (const game of games) {
    for (const [id, s] of game) out.set(id, addStats(out.get(id) ?? emptyStats(), s));
  }
  return out;
}
