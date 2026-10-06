import { describe, expect, it } from "vitest";
import { endPeriod, setAvailability, setLineup, setPresence, startPeriod } from "./commands.ts";
import { effectiveEvents } from "./log.ts";
import { buildSegments } from "./segments.ts";
import { statsByPlayer } from "./stats.ts";
import { lineupOf, nameOf, pid, testGame } from "./test-utils.ts";
import { gameTime, minutes } from "./time.ts";
import { canDelete, removeEntry, retime, timeline } from "./timeline.ts";

const S = lineupOf({
  GK: "maya",
  LB: "lily",
  CB: "ruby",
  RB: "sofia",
  LF: "emma",
  CF: "ava",
  RF: "chloe",
});

function game() {
  const g = testGame();
  for (const n of ["maya", "lily", "ruby", "sofia", "emma", "ava", "chloe", "harper"] as const) {
    g.push(setPresence(g.ctx, pid(n), true));
  }
  g.push(setLineup(g.ctx, gameTime(1, 0), S));
  g.push(startPeriod(g.ctx, 1));
  g.push(setLineup(g.ctx, gameTime(1, minutes(10)), { ...S, RB: pid("harper") }));
  g.push(setAvailability(g.ctx, pid("sofia"), false, gameTime(1, minutes(12))));
  g.push(setPresence(g.ctx, pid("nora"), true, gameTime(1, minutes(15))));
  g.push(endPeriod(g.ctx, gameTime(1, minutes(30))));
  return g;
}

describe("timeline", () => {
  it("lists timed events in order with lineup diffs", () => {
    const g = game();
    const t = timeline(effectiveEvents(g.events));
    expect(t.map((e) => e.kind)).toEqual([
      "lineup",
      "lineup",
      "availability",
      "arrival",
      "periodEnd",
    ]);
    const sub = t[1];
    if (sub?.kind !== "lineup") throw new Error("expected sub");
    expect(sub.kickoff).toBe(false);
    expect(sub.diff.in.map((x) => nameOf(x.playerId))).toEqual(["harper"]);
    expect(t.map(canDelete)).toEqual([false, true, true, true, false]);
  });

  it("retime moves a sub and stats follow; clamps to the period", () => {
    const g = game();
    const sub = timeline(effectiveEvents(g.events))[1]!;
    g.push(...retime(g.ctx, effectiveEvents(g.events), sub, minutes(8)));
    const harper = statsByPlayer(buildSegments(effectiveEvents(g.events))).get(pid("harper"));
    expect(harper?.fieldMs.RB).toBe(minutes(22));

    const moved = timeline(effectiveEvents(g.events))[1]!;
    const [, replacement] = retime(g.ctx, effectiveEvents(g.events), moved, minutes(99));
    expect(replacement && "at" in replacement ? replacement.at : null).toEqual(
      gameTime(1, minutes(30)),
    );
  });

  it("removeEntry voids the event", () => {
    const g = game();
    const sub = timeline(effectiveEvents(g.events))[1]!;
    g.push(...removeEntry(g.ctx, sub));
    expect(timeline(effectiveEvents(g.events)).filter((e) => e.kind === "lineup")).toHaveLength(1);
  });
});
