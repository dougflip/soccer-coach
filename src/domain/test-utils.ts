import type { CommandContext } from "./commands.ts";
import type { GameEvent } from "./events.ts";
import { EventIdSchema, GameIdSchema, PlayerIdSchema, type PlayerId } from "./ids.ts";
import { mapPositions, type Lineup, type Position } from "./positions.ts";

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

const PLAYER_NAMES = [
  "ava",
  "chloe",
  "ella",
  "emma",
  "harper",
  "lily",
  "maya",
  "nora",
  "ruby",
  "sofia",
  "zoe",
] as const;
export type TestPlayer = (typeof PLAYER_NAMES)[number];

/** Stable, readable player IDs for tests: `pid("maya")`. */
export const pid = (name: TestPlayer): PlayerId =>
  PlayerIdSchema.parse(uuid(1000 + PLAYER_NAMES.indexOf(name)));

export const nameOf = (id: PlayerId): TestPlayer | undefined =>
  PLAYER_NAMES.find((n) => pid(n) === id);

export function lineupOf(slots: Partial<Record<Position, TestPlayer>>): Lineup {
  return mapPositions((p) => {
    const name = slots[p];
    return name === undefined ? null : pid(name);
  });
}

/**
 * A command context with deterministic IDs and a controllable wall clock, plus
 * the event log the test builds up.
 */
export function testGame() {
  let seq = 0;
  let wall = 1_800_000_000_000;
  const events: GameEvent[] = [];
  const ctx: CommandContext = {
    gameId: GameIdSchema.parse(uuid(1)),
    newId: () => EventIdSchema.parse(uuid(10_000 + ++seq)),
    now: () => wall,
  };
  return {
    ctx,
    events,
    // createdAt ties are broken by event ID, and IDs here increase with each event.
    push: (...es: GameEvent[]) => {
      events.push(...es);
    },
    advanceWall: (ms: number) => {
      wall += ms;
    },
    wallNow: () => wall,
  };
}
