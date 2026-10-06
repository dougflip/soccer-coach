import { useLiveQuery } from "dexie-react-hooks";
import { useTeamId } from "../../app/team.tsx";
import { repos } from "../../data/repos/index.ts";
import type { Game } from "../../data/schemas.ts";
import { deriveGameView } from "../../domain/game-view.ts";
import type { GameId } from "../../domain/ids.ts";
import { assertNever } from "../../domain/events.ts";
import { ui } from "../../ui/primitives.tsx";
import { useNow } from "../../ui/useNow.ts";
import { FinalView } from "./FinalView.tsx";
import { HalftimeView } from "./HalftimeView.tsx";
import { usePlayers, type Players } from "./hooks.ts";
import { LiveView } from "./LiveView.tsx";
import { PregameView } from "./PregameView.tsx";

/** One game; the view follows its status (pre-game → live → halftime → live → final). */
export function GamePage({ gameId }: { gameId: GameId }) {
  const teamId = useTeamId();
  // undefined = loading, null = not found
  const game = useLiveQuery(async () => (await repos.games.get(gameId)) ?? null, [gameId]);
  const players = usePlayers(teamId);

  if (game === undefined || !players.loaded) return null;
  if (game === null) return <p className={ui.empty}>Game not found.</p>;
  return <GameScreen game={game} players={players} />;
}

export function GameScreen({ game, players }: { game: Game; players: Players }) {
  const events = useLiveQuery(() => repos.events.forGame(game.id), [game.id]);
  const now = useNow(1000);
  if (events === undefined) return null;

  const view = deriveGameView(events, now);
  switch (view.status.kind) {
    case "pregame":
      return <PregameView game={game} view={view} players={players} />;
    case "live":
      return <LiveView game={game} view={view} players={players} period={view.status.period} />;
    case "break":
      return (
        <HalftimeView
          game={game}
          view={view}
          players={players}
          afterPeriod={view.status.afterPeriod}
        />
      );
    case "final":
      return <FinalView game={game} view={view} players={players} />;
    default:
      return assertNever(view.status);
  }
}
