import type { GameEvent } from "./events.ts";
import type { PlayerId } from "./ids.ts";
import { POSITIONS, type Position } from "./positions.ts";
import { intervals } from "./sweep.ts";
import type { GameTime } from "./time.ts";

/**
 * Inconsistencies the log allows but the UI should flag (mostly arising from
 * after-the-fact edits). Projections stay lenient; they never throw on these.
 */
export type Issue =
  | { kind: "duplicate_in_lineup"; at: GameTime; playerId: PlayerId; positions: Position[] }
  | { kind: "unavailable_on_field"; at: GameTime; playerId: PlayerId }
  | { kind: "absent_on_field"; at: GameTime; playerId: PlayerId };

export function findIssues(effective: readonly GameEvent[], until?: GameTime): Issue[] {
  const issues: Issue[] = [];
  const seen = new Set<string>();
  const add = (issue: Issue) => {
    // Report each problem once per period, at its first occurrence.
    const key = `${issue.kind}:${issue.playerId}:${issue.at.period}`;
    if (!seen.has(key)) {
      seen.add(key);
      issues.push(issue);
    }
  };

  for (const iv of intervals(effective, until)) {
    const at = { period: iv.period, ms: iv.startMs };
    const byPlayer = new Map<PlayerId, Position[]>();
    for (const p of POSITIONS) {
      const id = iv.state.lineup[p];
      if (id !== null) byPlayer.set(id, [...(byPlayer.get(id) ?? []), p]);
    }
    for (const [playerId, positions] of byPlayer) {
      if (positions.length > 1) add({ kind: "duplicate_in_lineup", at, playerId, positions });
      if (iv.state.unavailable.has(playerId)) add({ kind: "unavailable_on_field", at, playerId });
      if (!iv.state.present.has(playerId)) add({ kind: "absent_on_field", at, playerId });
    }
  }
  return issues;
}
