import { describe, expect, it } from "vitest";
import { endPeriod, setAvailability, setLineup, setPresence, startPeriod } from "./commands.ts";
import { attendance, deriveGameView } from "./game-view.ts";
import { effectiveEvents } from "./log.ts";
import { lineupOf, pid, testGame } from "./test-utils.ts";
import { gameTime, minutes } from "./time.ts";

const STARTERS = lineupOf({
  GK: "maya",
  LB: "lily",
  CB: "ruby",
  RB: "sofia",
  LF: "emma",
  CF: "ava",
  RF: "chloe",
});

describe("deriveGameView", () => {
  it("pre-game shows the planned kickoff lineup", () => {
    const g = testGame();
    g.push(setLineup(g.ctx, gameTime(1, 0), STARTERS));
    const v = deriveGameView(g.events, g.wallNow());
    expect(v.status.kind).toBe("pregame");
    expect(v.snapshot.lineup.GK).toBe(pid("maya"));
    expect(v.at).toBeNull();
  });

  it("live: clock, minutes and stints", () => {
    const g = testGame();
    for (const n of ["maya", "lily", "ruby", "sofia", "emma", "ava", "chloe", "harper"] as const) {
      g.push(setPresence(g.ctx, pid(n), true));
    }
    g.push(setLineup(g.ctx, gameTime(1, 0), STARTERS));
    g.push(startPeriod(g.ctx, 1));
    g.advanceWall(minutes(12));
    const v = deriveGameView(g.events, g.wallNow());
    expect(v.clock).toEqual({ ms: minutes(12), running: true });
    expect(v.fieldMs(pid("maya"))).toBe(minutes(12));
    expect(v.stint(pid("lily"))).toBe(minutes(12));
    expect(v.stint(pid("harper"))).toBeNull();
    expect(v.longest.has(pid("maya"))).toBe(false); // GK excluded
  });

  it("break: snapshot includes changes recorded during halftime", () => {
    const g = testGame();
    g.push(setPresence(g.ctx, pid("sofia"), true));
    g.push(setLineup(g.ctx, gameTime(1, 0), STARTERS));
    g.push(startPeriod(g.ctx, 1));
    g.push(setAvailability(g.ctx, pid("sofia"), false, gameTime(1, minutes(20))));
    g.push(endPeriod(g.ctx, gameTime(1, minutes(30))));
    g.push(setAvailability(g.ctx, pid("sofia"), true, gameTime(1, minutes(30))));
    const v = deriveGameView(g.events, g.wallNow());
    expect(v.status.kind).toBe("break");
    expect(v.snapshot.unavailable.has(pid("sofia"))).toBe(false);
  });
});

describe("attendance", () => {
  it("defaults to present unless switched off", () => {
    const g = testGame();
    g.push(setPresence(g.ctx, pid("nora"), false));
    const a = attendance(effectiveEvents(g.events), [pid("maya"), pid("nora")]);
    expect([...a.values()]).toEqual([true, false]);
  });
});
