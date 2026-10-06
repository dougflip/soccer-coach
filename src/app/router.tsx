import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { GameFormPage } from "../features/games/GameFormPage.tsx";
import { GamePage } from "../features/game/GamePage.tsx";
import { GamesPage } from "../features/games/GamesPage.tsx";
import { PlayerFormPage } from "../features/roster/PlayerFormPage.tsx";
import { RosterPage } from "../features/roster/RosterPage.tsx";
import { StatsPage } from "../features/stats/StatsPage.tsx";
import { GameIdSchema, PlayerIdSchema } from "../domain/ids.ts";
import { AppShell } from "./AppShell.tsx";

const rootRoute = createRootRoute({ component: AppShell });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/games" });
  },
});

// --- games ---
const gamesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/games" });
const gamesIndexRoute = createRoute({
  getParentRoute: () => gamesRoute,
  path: "/",
  component: GamesPage,
});
const newGameRoute = createRoute({
  getParentRoute: () => gamesRoute,
  path: "/new",
  component: () => <GameFormPage />,
});
const gameRoute = createRoute({
  getParentRoute: () => gamesRoute,
  path: "/$gameId",
  params: {
    // Invalid IDs don't match the route (-> not found) instead of throwing.
    parse: ({ gameId }) => {
      const r = GameIdSchema.safeParse(gameId);
      return r.success ? { gameId: r.data } : false;
    },
    stringify: ({ gameId }) => ({ gameId }),
  },
});
const gameIndexRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: "/",
  component: function GameRouteComponent() {
    const { gameId } = gameRoute.useParams();
    return <GamePage gameId={gameId} />;
  },
});
const editGameRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: "/edit",
  component: function EditGameRouteComponent() {
    const { gameId } = gameRoute.useParams();
    return <GameFormPage gameId={gameId} />;
  },
});

// --- roster ---
const rosterRoute = createRoute({ getParentRoute: () => rootRoute, path: "/roster" });
const rosterIndexRoute = createRoute({
  getParentRoute: () => rosterRoute,
  path: "/",
  component: RosterPage,
});
const newPlayerRoute = createRoute({
  getParentRoute: () => rosterRoute,
  path: "/new",
  component: () => <PlayerFormPage />,
});
const playerRoute = createRoute({
  getParentRoute: () => rosterRoute,
  path: "/$playerId",
  params: {
    parse: ({ playerId }) => {
      const r = PlayerIdSchema.safeParse(playerId);
      return r.success ? { playerId: r.data } : false;
    },
    stringify: ({ playerId }) => ({ playerId }),
  },
  component: function PlayerRouteComponent() {
    const { playerId } = playerRoute.useParams();
    return <PlayerFormPage key={playerId} playerId={playerId} />;
  },
});

// --- stats ---
const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stats",
  component: StatsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  gamesRoute.addChildren([
    gamesIndexRoute,
    newGameRoute,
    gameRoute.addChildren([gameIndexRoute, editGameRoute]),
  ]),
  rosterRoute.addChildren([rosterIndexRoute, newPlayerRoute, playerRoute]),
  statsRoute,
]);

// Hash URLs (/#/games): no GitHub Pages 404 workaround, works offline.
export const router = createRouter({ routeTree, history: createHashHistory() });

declare module "@tanstack/react-router" {
  // Module augmentation requires an interface.
  // oxlint-disable-next-line typescript/consistent-type-definitions
  interface Register {
    router: typeof router;
  }
}
