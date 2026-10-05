import { describe, expect, it } from "vitest";
import { periodClockMs } from "./clock.ts";
import { adjustClock, endPeriod, pauseClock, resumeClock, startPeriod } from "./commands.ts";
import { effectiveEvents } from "./log.ts";
import { testGame } from "./test-utils.ts";
import { gameTime, minutes } from "./time.ts";

describe("periodClockMs", () => {
  it("is null before the period starts", () => {
    const g = testGame();
    expect(periodClockMs(g.events, 1, g.wallNow())).toBeNull();
  });

  it("runs from the start timestamp", () => {
    const g = testGame();
    g.push(startPeriod(g.ctx, 1));
    g.advanceWall(minutes(12));
    expect(periodClockMs(g.events, 1, g.wallNow())).toBe(minutes(12));
  });

  it("stops while paused and resumes", () => {
    const g = testGame();
    const start = g.wallNow();
    g.push(startPeriod(g.ctx, 1));
    g.advanceWall(minutes(5));
    g.push(pauseClock(g.ctx, 1));
    g.advanceWall(minutes(3));
    g.push(resumeClock(g.ctx, 1));
    g.advanceWall(minutes(2));
    const elapsed = g.wallNow() - start;
    expect(periodClockMs(g.events, 1, g.wallNow())).toBe(elapsed - minutes(3));
  });

  it("can be adjusted (app started late)", () => {
    const g = testGame();
    g.push(startPeriod(g.ctx, 1));
    g.advanceWall(minutes(1));
    g.push(adjustClock(g.ctx, 1, minutes(4)));
    g.advanceWall(minutes(1));
    expect(periodClockMs(g.events, 1, g.wallNow())).toBe(minutes(5));
  });

  it("is frozen once the period ends", () => {
    const g = testGame();
    g.push(startPeriod(g.ctx, 1));
    g.push(endPeriod(g.ctx, gameTime(1, minutes(31))));
    g.advanceWall(minutes(60));
    expect(periodClockMs(effectiveEvents(g.events), 1, g.wallNow())).toBe(minutes(31));
  });

  it("ignores a duplicate start from a second device", () => {
    const g = testGame();
    g.push(startPeriod(g.ctx, 1));
    g.advanceWall(minutes(1));
    g.push(startPeriod(g.ctx, 1));
    g.advanceWall(minutes(1));
    expect(periodClockMs(g.events, 1, g.wallNow())).toBe(minutes(2));
  });
});
