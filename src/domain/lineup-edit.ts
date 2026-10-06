import type { PlayerId } from "./ids.ts";
import { POSITIONS, mapPositions, positionOf, type Lineup, type Position } from "./positions.ts";

/** Something a coach can tap while building a lineup. */
export type Spot = { kind: "slot"; position: Position } | { kind: "bench"; playerId: PlayerId };

export const sameSpot = (a: Spot, b: Spot): boolean =>
  a.kind === "slot"
    ? b.kind === "slot" && a.position === b.position
    : b.kind === "bench" && a.playerId === b.playerId;

/**
 * Swap two spots:
 * - slot <-> slot: occupants trade places (either may be empty)
 * - slot <-> bench: bench player takes the slot; the slot's occupant goes to the bench
 * - bench <-> bench: nothing changes
 */
export function swapSpots(lineup: Lineup, a: Spot, b: Spot): Lineup {
  if (a.kind === "bench" && b.kind === "bench") return lineup;
  if (a.kind === "slot" && b.kind === "slot") {
    const pa = lineup[a.position];
    const pb = lineup[b.position];
    return mapPositions((p) => (p === a.position ? pb : p === b.position ? pa : lineup[p]));
  }
  const slot = a.kind === "slot" ? a : b;
  const bench = a.kind === "bench" ? a : b;
  if (slot.kind !== "slot" || bench.kind !== "bench") return lineup;
  return mapPositions((p) => (p === slot.position ? bench.playerId : lineup[p]));
}

export type TapState = { lineup: Lineup; selected: Spot | null };

/**
 * Tap-then-tap editing: first tap selects, second tap on another spot swaps,
 * tapping the selection again cancels. Two bench taps just move the selection.
 */
export function tap({ lineup, selected }: TapState, target: Spot): TapState {
  if (!selected) return { lineup, selected: target };
  if (sameSpot(selected, target)) return { lineup, selected: null };
  if (selected.kind === "bench" && target.kind === "bench") return { lineup, selected: target };
  return { lineup: swapSpots(lineup, selected, target), selected: null };
}

export type LineupDiff = {
  /** Coming on from the bench. */
  in: { playerId: PlayerId; position: Position }[];
  /** Going to the bench. */
  out: { playerId: PlayerId; position: Position }[];
  /** Staying on, changing position. */
  moves: { playerId: PlayerId; from: Position; to: Position }[];
  changedPositions: Position[];
};

export function diffLineups(from: Lineup, to: Lineup): LineupDiff {
  const diff: LineupDiff = { in: [], out: [], moves: [], changedPositions: [] };
  for (const position of POSITIONS) {
    if (from[position] !== to[position]) diff.changedPositions.push(position);
    const incoming = to[position];
    if (incoming !== null) {
      const before = positionOf(from, incoming);
      if (before === undefined) diff.in.push({ playerId: incoming, position });
      else if (before !== position)
        diff.moves.push({ playerId: incoming, from: before, to: position });
    }
    const outgoing = from[position];
    if (outgoing !== null && positionOf(to, outgoing) === undefined) {
      diff.out.push({ playerId: outgoing, position });
    }
  }
  return diff;
}

export const lineupsEqual = (a: Lineup, b: Lineup): boolean =>
  POSITIONS.every((p) => a[p] === b[p]);
