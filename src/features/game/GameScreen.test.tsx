// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "../../data/db.ts";
import { repos } from "../../data/repos/index.ts";
import type { Game, Player } from "../../data/schemas.ts";
import { deriveGameView } from "../../domain/game-view.ts";
import { GameIdSchema, TeamIdSchema } from "../../domain/ids.ts";
import { pid, type TestPlayer } from "../../domain/test-utils.ts";
import { GameScreen } from "./GamePage.tsx";
import { playersView } from "./hooks.ts";

const TEAM = TeamIdSchema.parse("00000000-0000-4000-8000-0000000000aa");
const GAME = GameIdSchema.parse("00000000-0000-4000-8000-000000000001");
const NAMES: TestPlayer[] = [
  "ava",
  "chloe",
  "emma",
  "harper",
  "lily",
  "maya",
  "nora",
  "ruby",
  "sofia",
];
const cap = (s: string) => s[0]?.toUpperCase() + s.slice(1);

const roster: Player[] = NAMES.map((n) => ({
  id: pid(n),
  teamId: TEAM,
  firstName: cap(n),
  lastInitials: "",
  archivedAt: null,
  deleted: false,
  updatedAt: null,
}));
const game: Game = {
  id: GAME,
  teamId: TEAM,
  opponent: "Tigers",
  startsAt: "2026-10-10T13:00:00.000Z",
  location: null,
  deleted: false,
  updatedAt: null,
};

const view = async () => deriveGameView(await repos.events.forGame(GAME), Date.now());
const slot = (pos: string) => screen.getByRole("button", { name: new RegExp(`^${pos}: `) });

/** Screens contain <Link>s, which need a router. */
function renderInRouter(ui: ReactNode) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => ui }),
    history: createMemoryHistory(),
  });
  return render(<RouterProvider router={router} />);
}

afterAll(async () => {
  cleanup();
  await db.delete();
});

describe("game screen flow", () => {
  it("attendance → lineup → kickoff → Next Up sub → undo → injury → halftime → final", async () => {
    const user = userEvent.setup();
    renderInRouter(<GameScreen game={game} players={playersView(roster)} />);

    // --- attendance: everyone defaults present; Nora is absent
    await screen.findByText("Present");
    await user.click(screen.getByRole("checkbox", { name: "Nora" }));
    await waitFor(async () => expect((await view()).effective).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: "Next: starting lineup" }));

    // --- starting lineup via tap-tap: bench player, then slot
    const place = async (name: string, pos: string) => {
      await user.click(screen.getByRole("button", { name: new RegExp(`^${name}`) }));
      await user.click(slot(pos));
    };
    expect(screen.queryByRole("button", { name: /^Nora/ })).toBeNull(); // absent: not on bench
    await place("Maya", "GK");
    await place("Lily", "LB");
    await place("Ruby", "CB");
    await place("Sofia", "RB");
    await place("Emma", "LF");
    await place("Ava", "CF");
    await place("Chloe", "RF");
    await user.click(screen.getByRole("button", { name: /Start 1st half/ }));

    // --- live
    await screen.findByRole("button", { name: "Game menu" });
    let v = await view();
    expect(v.status).toEqual({ kind: "live", period: 1 });
    expect(v.snapshot.lineup.GK).toBe(pid("maya"));
    expect(v.snapshot.present.has(pid("nora"))).toBe(false);

    // --- Next Up: send Sofia to the bench first, then put Harper at RB, then Sub now
    await user.click(screen.getByRole("button", { name: /^Next Up/ }));
    await user.click(slot("RB"));
    await user.click(screen.getByRole("button", { name: "Send Sofia to bench" }));
    expect(screen.getByText(/Empty: RB/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Sofia.*OUT/ })).toBeTruthy(); // now on the bench
    await user.click(screen.getByRole("button", { name: /^Harper/ }));
    await user.click(slot("RB"));
    expect(screen.getByText(/In: Harper → RB/)).toBeTruthy();
    expect(screen.getByText(/Out: Sofia/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Sub now/ }));
    await screen.findByText(/Sub recorded at/);
    await waitFor(async () => expect((await view()).snapshot.lineup.RB).toBe(pid("harper")));

    // --- undo puts Sofia back
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(async () => expect((await view()).snapshot.lineup.RB).toBe(pid("sofia")));

    // --- injury: tap Lily on field → sub off unavailable, Harper replaces
    await user.click(slot("LB"));
    const sheet = await screen.findByRole("dialog", { name: "Lily" });
    await user.click(within(sheet).getByRole("button", { name: /^Harper/ }));
    await user.click(within(sheet).getByRole("button", { name: "Sub off now · unavailable" }));
    await waitFor(async () => {
      v = await view();
      expect(v.snapshot.lineup.LB).toBe(pid("harper"));
      expect(v.snapshot.unavailable.has(pid("lily"))).toBe(true);
    });

    // --- late arrival
    await user.click(screen.getByRole("button", { name: /^Nora/ }));
    await waitFor(async () => expect((await view()).snapshot.present.has(pid("nora"))).toBe(true));

    // --- end half → halftime; Lily available again; start 2nd half
    await user.click(screen.getByRole("button", { name: "Game menu" }));
    await user.click(screen.getByRole("button", { name: /^End half/ }));
    await screen.findByText("Halftime");
    const availability = screen.getByText("Availability").closest("h2")?.nextElementSibling;
    if (!(availability instanceof HTMLElement)) throw new Error("availability list missing");
    await user.click(within(availability).getByRole("button", { name: /^Lily/ }));
    await waitFor(async () =>
      expect((await view()).snapshot.unavailable.has(pid("lily"))).toBe(false),
    );
    await user.click(screen.getByRole("button", { name: /Start 2nd half/ }));
    await waitFor(async () => expect((await view()).status).toEqual({ kind: "live", period: 2 }));

    // --- end game → final table
    await user.click(await screen.findByRole("button", { name: "Game menu" }));
    await user.click(screen.getByRole("button", { name: /^End game/ }));
    await screen.findByRole("table");
    expect((await view()).status.kind).toBe("final");
    expect(screen.getByRole("row", { name: /Maya/ })).toBeTruthy();

    await act(async () => {}); // flush pending live queries before teardown
  });
});
