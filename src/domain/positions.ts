import { z } from "zod";
import type { PlayerId } from "./ids.ts";

// 7v7: GK, 3 defenders, 3 forwards. Kept as data so the formation can change later.
export const POSITIONS = ["GK", "LB", "CB", "RB", "LF", "CF", "RF"] as const;

export const PositionSchema = z.enum(POSITIONS);
export type Position = z.infer<typeof PositionSchema>;

/** Who is in each slot. `null` = slot left empty (e.g. short-handed). */
export type Lineup = Readonly<Record<Position, PlayerId | null>>;

/** Build a per-position record. Spelled out (not fromEntries) so it type-checks without a cast. */
export function mapPositions<V>(fn: (p: Position) => V): Record<Position, V> {
  return {
    GK: fn("GK"),
    LB: fn("LB"),
    CB: fn("CB"),
    RB: fn("RB"),
    LF: fn("LF"),
    CF: fn("CF"),
    RF: fn("RF"),
  };
}

export const emptyLineup = (): Lineup => mapPositions(() => null);

export function positionOf(lineup: Lineup, playerId: PlayerId): Position | undefined {
  return POSITIONS.find((p) => lineup[p] === playerId);
}

export function playersIn(lineup: Lineup): PlayerId[] {
  return POSITIONS.flatMap((p) => {
    const id = lineup[p];
    return id === null ? [] : [id];
  });
}
