import type { GameEvent } from "./events.ts";
import type { PlayerId } from "./ids.ts";
import { playersIn, positionOf, type Position } from "./positions.ts";
import { intervals } from "./sweep.ts";
import type { GameTime } from "./time.ts";

/** Every minute a present player spends in a game falls into exactly one bucket. */
export type Bucket = { kind: "field"; position: Position } | { kind: "bench"; available: boolean };

export type Segment = {
  playerId: PlayerId;
  period: number;
  startMs: number;
  endMs: number;
  bucket: Bucket;
};

const sameBucket = (a: Bucket, b: Bucket): boolean =>
  a.kind === "field"
    ? b.kind === "field" && a.position === b.position
    : b.kind === "bench" && a.available === b.available;

/**
 * Per-player time segments for the game, merged where consecutive intervals
 * share a bucket. Pass `until` (current game time) for a live game.
 */
export function buildSegments(effective: readonly GameEvent[], until?: GameTime): Segment[] {
  const open = new Map<PlayerId, Segment>();
  const out: Segment[] = [];

  for (const iv of intervals(effective, until)) {
    const { lineup, present, unavailable } = iv.state;
    // Someone on the field counts even if (wrongly) not marked present; see issues.ts.
    const players = new Set([...present, ...playersIn(lineup)]);

    for (const [id, seg] of open) {
      if (!players.has(id) || seg.period !== iv.period || seg.endMs !== iv.startMs) {
        out.push(seg);
        open.delete(id);
      }
    }

    for (const playerId of players) {
      const position = positionOf(lineup, playerId);
      const bucket: Bucket = position
        ? { kind: "field", position }
        : { kind: "bench", available: !unavailable.has(playerId) };
      const prev = open.get(playerId);
      if (prev && sameBucket(prev.bucket, bucket)) {
        prev.endMs = iv.endMs;
      } else {
        if (prev) out.push(prev);
        open.set(playerId, {
          playerId,
          period: iv.period,
          startMs: iv.startMs,
          endMs: iv.endMs,
          bucket,
        });
      }
    }
  }
  out.push(...open.values());
  return out.toSorted(
    (a, b) => a.period - b.period || a.startMs - b.startMs || a.playerId.localeCompare(b.playerId),
  );
}
