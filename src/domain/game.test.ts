import { describe, expect, it } from "vitest";
import {
  endPeriod,
  replaceEvent,
  setAvailability,
  setLineup,
  setPresence,
  startPeriod,
  subOffUnavailable,
  voidEvent,
} from "./commands.ts";
import { GameEventSchema } from "./events.ts";
import { findIssues } from "./issues.ts";
import { effectiveEvents } from "./log.ts";
import { buildSegments } from "./segments.ts";
import { availableShare, combineGames, statsByPlayer, totalFieldMs } from "./stats.ts";
import { currentGameTime, deriveStatus } from "./status.ts";
import { longestStints, stintMs } from "./stints.ts";
import { snapshotAt } from "./sweep.ts";
import { lineupOf, nameOf, pid, testGame, type TestPlayer } from "./test-utils.ts";
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
const PRESENT: TestPlayer[] = [
  "ava",
  "chloe",
  "emma",
  "harper",
  "lily",
  "maya",
  "ruby",
  "sofia",
  "zoe",
];

/** Pre-game + kickoff, the shape every test starts from. */
function kickedOff() {
  const g = testGame();
  for (const name of PRESENT) g.push(setPresence(g.ctx, pid(name), true));
  g.push(setLineup(g.ctx, gameTime(1, 0), STARTERS));
  g.push(startPeriod(g.ctx, 1));
  return g;
}

const statsFor = (
  g: ReturnType<typeof testGame>,
  name: TestPlayer,
  until?: ReturnType<typeof gameTime>,
) => {
  const s = statsByPlayer(buildSegments(effectiveEvents(g.events), until)).get(pid(name));
  if (!s) throw new Error(`no stats for ${name}`);
  return s;
};

describe("status", () => {
  it("walks pregame -> live -> break -> live -> final", () => {
    const g = testGame();
    const status = () => deriveStatus(effectiveEvents(g.events));
    expect(status()).toEqual({ kind: "pregame" });
    g.push(startPeriod(g.ctx, 1));
    expect(status()).toEqual({ kind: "live", period: 1 });
    g.push(endPeriod(g.ctx, gameTime(1, minutes(30))));
    expect(status()).toEqual({ kind: "break", afterPeriod: 1 });
    g.push(startPeriod(g.ctx, 2));
    expect(status()).toEqual({ kind: "live", period: 2 });
    g.push(endPeriod(g.ctx, gameTime(2, minutes(29))));
    expect(status()).toEqual({ kind: "final" });
    expect(currentGameTime(effectiveEvents(g.events), g.wallNow())).toEqual(
      gameTime(2, minutes(29)),
    );
  });
});

describe("segments & stats", () => {
  it("splits time at a sub and buckets bench time by availability", () => {
    const g = kickedOff();
    g.push(setAvailability(g.ctx, pid("zoe"), false, gameTime(1, 0)));
    g.push(setLineup(g.ctx, gameTime(1, minutes(10)), { ...STARTERS, RB: pid("harper") }));
    const until = gameTime(1, minutes(18));

    expect(statsFor(g, "sofia", until)).toMatchObject({
      fieldMs: { RB: minutes(10) },
      benchAvailableMs: minutes(8),
    });
    expect(statsFor(g, "harper", until)).toMatchObject({
      fieldMs: { RB: minutes(8) },
      benchAvailableMs: minutes(10),
    });
    expect(statsFor(g, "zoe", until)).toMatchObject({ benchUnavailableMs: minutes(18) });
    // Absent players have no time at all.
    expect(statsByPlayer(buildSegments(effectiveEvents(g.events), until)).has(pid("nora"))).toBe(
      false,
    );
  });

  it("carries the lineup into the 2nd half unless changed", () => {
    const g = kickedOff();
    g.push(endPeriod(g.ctx, gameTime(1, minutes(30))));
    g.push(startPeriod(g.ctx, 2));
    g.push(endPeriod(g.ctx, gameTime(2, minutes(30))));
    expect(totalFieldMs(statsFor(g, "maya"))).toBe(minutes(60));
    // Halftime counts as nothing.
    expect(statsFor(g, "harper").benchAvailableMs).toBe(minutes(60));
  });

  it("counts a late arrival from when they arrived", () => {
    const g = kickedOff();
    g.push(setPresence(g.ctx, pid("nora"), true, gameTime(1, minutes(12))));
    expect(statsFor(g, "nora", gameTime(1, minutes(20))).benchAvailableMs).toBe(minutes(8));
  });

  it("availableShare ignores unavailable time", () => {
    const g = kickedOff();
    g.push(
      ...subOffUnavailable(g.ctx, {
        at: gameTime(1, minutes(20)),
        lineup: STARTERS,
        playerId: pid("sofia"),
        replacement: pid("harper"),
      }),
    );
    g.push(endPeriod(g.ctx, gameTime(1, minutes(30))));
    const sofia = statsFor(g, "sofia");
    expect(sofia.benchUnavailableMs).toBe(minutes(10));
    expect(availableShare(sofia)).toBe(1);
    expect(availableShare(statsFor(g, "harper"))).toBeCloseTo(10 / 30);
  });

  it("combines games into season totals", () => {
    const a = kickedOff();
    a.push(endPeriod(a.ctx, gameTime(1, minutes(30))));
    const b = kickedOff();
    b.push(endPeriod(b.ctx, gameTime(1, minutes(25))));
    const season = combineGames(
      [a, b].map((g) => statsByPlayer(buildSegments(effectiveEvents(g.events)))),
    );
    expect(season.get(pid("maya"))?.fieldMs.GK).toBe(minutes(55));
  });
});

describe("corrections", () => {
  it("voiding a sub removes it; voiding the void restores it", () => {
    const g = kickedOff();
    const sub = setLineup(g.ctx, gameTime(1, minutes(10)), { ...STARTERS, RB: pid("harper") });
    g.push(sub);
    g.push(endPeriod(g.ctx, gameTime(1, minutes(30))));
    const undo = voidEvent(g.ctx, sub.id);
    g.push(undo);
    expect(statsFor(g, "sofia").fieldMs.RB).toBe(minutes(30));
    g.push(voidEvent(g.ctx, undo.id));
    expect(statsFor(g, "sofia").fieldMs.RB).toBe(minutes(10));
  });

  it("editing a sub's time moves the split", () => {
    const g = kickedOff();
    const sub = setLineup(g.ctx, gameTime(1, minutes(10)), { ...STARTERS, RB: pid("harper") });
    g.push(sub);
    g.push(endPeriod(g.ctx, gameTime(1, minutes(30))));
    g.push(...replaceEvent(g.ctx, sub, { at: gameTime(1, minutes(8)) }));
    expect(statsFor(g, "sofia").fieldMs.RB).toBe(minutes(8));
    expect(statsFor(g, "harper").fieldMs.RB).toBe(minutes(22));
  });

  it("at the same game time, the later recording wins", () => {
    const g = kickedOff();
    g.push(setLineup(g.ctx, gameTime(1, minutes(10)), { ...STARTERS, RB: pid("harper") }));
    g.push(setLineup(g.ctx, gameTime(1, minutes(10)), { ...STARTERS, RB: pid("zoe") }));
    const snap = snapshotAt(effectiveEvents(g.events), gameTime(1, minutes(11)));
    expect(nameOf(snap.lineup.RB ?? pid("nora"))).toBe("zoe");
  });
});

describe("stints", () => {
  it("survive position moves, reset on the bench and at halftime", () => {
    const g = kickedOff();
    // 10:00 Harper in for Sofia. 15:00 Ruby moves CB -> LF, Emma LF -> CB.
    g.push(setLineup(g.ctx, gameTime(1, minutes(10)), { ...STARTERS, RB: pid("harper") }));
    g.push(
      setLineup(g.ctx, gameTime(1, minutes(15)), {
        ...STARTERS,
        RB: pid("harper"),
        CB: pid("emma"),
        LF: pid("ruby"),
      }),
    );
    const at = gameTime(1, minutes(20));
    const segs = buildSegments(effectiveEvents(g.events), at);
    expect(stintMs(segs, pid("ruby"), at)).toBe(minutes(20));
    expect(stintMs(segs, pid("harper"), at)).toBe(minutes(10));
    expect(stintMs(segs, pid("sofia"), at)).toBeNull();

    g.push(endPeriod(g.ctx, gameTime(1, minutes(30))));
    g.push(startPeriod(g.ctx, 2));
    const at2 = gameTime(2, minutes(3));
    expect(stintMs(buildSegments(effectiveEvents(g.events), at2), pid("ruby"), at2)).toBe(
      minutes(3),
    );
  });

  it("highlights the 2 longest outfield stints, ties included, GK excluded", () => {
    const g = kickedOff();
    const lineup = { ...STARTERS, RB: pid("harper"), RF: pid("zoe") };
    g.push(setLineup(g.ctx, gameTime(1, minutes(10)), lineup));
    const at = gameTime(1, minutes(18));
    const top = longestStints(buildSegments(effectiveEvents(g.events), at), lineup, at);
    expect([...top].map((id) => nameOf(id) ?? "?").toSorted((a, b) => a.localeCompare(b))).toEqual([
      "ava",
      "emma",
      "lily",
      "ruby",
    ]);
  });
});

describe("issues", () => {
  it("flags an unavailable or absent player left on the field", () => {
    const g = kickedOff();
    g.push(setAvailability(g.ctx, pid("lily"), false, gameTime(1, minutes(5))));
    g.push(setLineup(g.ctx, gameTime(1, minutes(8)), { ...STARTERS, RB: pid("nora") }));
    const issues = findIssues(effectiveEvents(g.events), gameTime(1, minutes(10)));
    expect(issues).toEqual([
      { kind: "unavailable_on_field", at: gameTime(1, minutes(5)), playerId: pid("lily") },
      { kind: "absent_on_field", at: gameTime(1, minutes(8)), playerId: pid("nora") },
    ]);
  });
});

describe("schema", () => {
  it("round-trips events and rejects bad data at the boundary", () => {
    const g = kickedOff();
    for (const e of g.events)
      expect(GameEventSchema.parse(JSON.parse(JSON.stringify(e)))).toEqual(e);
    expect(() => GameEventSchema.parse({ ...g.events[0], playerId: "not-a-uuid" })).toThrow(
      /uuid/i,
    );
  });
});
