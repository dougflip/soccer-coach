import { describe, expect, it } from "vitest";
import { diffLineups, swapSpots, tap, type Spot } from "./lineup-edit.ts";
import { periodClock } from "./clock.ts";
import { pauseClock, startPeriod } from "./commands.ts";
import { lineupOf, nameOf, pid, testGame } from "./test-utils.ts";
import { minutes } from "./time.ts";

const L = lineupOf({ GK: "maya", LB: "lily", CB: "ruby", RB: "sofia", LF: "emma", CF: "ava" });
const slot = (position: "GK" | "LB" | "CB" | "RB" | "LF" | "CF" | "RF"): Spot => ({
  kind: "slot",
  position,
});
const bench = (name: Parameters<typeof pid>[0]): Spot => ({ kind: "bench", playerId: pid(name) });

describe("swapSpots", () => {
  it("swaps two slots, including into an empty one", () => {
    expect(swapSpots(L, slot("CB"), slot("LF"))).toMatchObject({
      CB: pid("emma"),
      LF: pid("ruby"),
    });
    expect(swapSpots(L, slot("CF"), slot("RF"))).toMatchObject({ CF: null, RF: pid("ava") });
  });

  it("puts a bench player in a slot (either tap order) and benches the occupant", () => {
    expect(swapSpots(L, bench("harper"), slot("RB")).RB).toBe(pid("harper"));
    expect(swapSpots(L, slot("RB"), bench("harper")).RB).toBe(pid("harper"));
  });
});

describe("tap", () => {
  it("select, then swap; re-tap cancels; bench->bench moves selection", () => {
    let s = tap({ lineup: L, selected: null }, slot("LB"));
    expect(s.selected).toEqual(slot("LB"));
    expect(tap(s, slot("LB")).selected).toBeNull();
    s = tap(s, bench("harper"));
    expect(s).toMatchObject({ selected: null, lineup: { LB: pid("harper") } });
    s = tap(tap(s, bench("zoe")), bench("nora"));
    expect(s.selected).toEqual(bench("nora"));
  });
});

const names = (xs: { playerId: ReturnType<typeof pid> }[]) =>
  xs.map((x) => nameOf(x.playerId) ?? "?").toSorted((a, b) => a.localeCompare(b));

describe("diffLineups", () => {
  it("reports ins, outs and moves", () => {
    const next = { ...L, LB: pid("sofia"), RB: pid("harper"), CB: pid("emma"), LF: pid("ruby") };
    const d = diffLineups(L, next);
    expect(names(d.in)).toEqual(["harper"]);
    expect(names(d.out)).toEqual(["lily"]);
    expect(names(d.moves)).toEqual(["emma", "ruby", "sofia"]);
    expect(d.changedPositions).toEqual(["LB", "CB", "RB", "LF"]);
  });
});

describe("periodClock", () => {
  it("reports whether the clock is running", () => {
    const g = testGame();
    g.push(startPeriod(g.ctx, 1));
    g.advanceWall(minutes(1));
    expect(periodClock(g.events, 1, g.wallNow())).toEqual({ ms: minutes(1), running: true });
    g.push(pauseClock(g.ctx, 1));
    expect(periodClock(g.events, 1, g.wallNow() + 5000)).toEqual({
      ms: minutes(1),
      running: false,
    });
  });
});
