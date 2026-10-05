import { z } from "zod";

/**
 * A moment in a game expressed on the game clock: which period and how far
 * into it. Subs, availability changes, etc. are stored this way (not as wall
 * clock time) so stats don't depend on pauses and after-the-fact edits are
 * just "change 10:15 to 10:05".
 */
export const GameTimeSchema = z.object({
  period: z.int().min(1),
  ms: z.int().min(0),
});
export type GameTime = z.infer<typeof GameTimeSchema>;

export const gameTime = (period: number, ms: number): GameTime => ({ period, ms });

export function compareGameTime(a: GameTime, b: GameTime): number {
  return a.period - b.period || a.ms - b.ms;
}

export const minutes = (m: number): number => m * 60_000;

/** `mm:ss` for display / tests. */
export function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
