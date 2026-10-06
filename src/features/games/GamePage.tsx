import { Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { repos } from "../../data/repos/index.ts";
import type { GameId } from "../../domain/ids.ts";
import { PageHeader, ui } from "../../ui/primitives.tsx";
import { formatGameDate } from "./dates.ts";

/** Placeholder until M2 (pre-game / live / review views by game status). */
export function GamePage({ gameId }: { gameId: GameId }) {
  // undefined = loading, null = not found
  const game = useLiveQuery(async () => (await repos.games.get(gameId)) ?? null, [gameId]);
  if (game === undefined) return null;
  if (game === null) return <p className={ui.empty}>Game not found.</p>;

  return (
    <>
      <PageHeader
        title={`vs ${game.opponent}`}
        subtitle={formatGameDate(game.startsAt)}
        left={
          <Link to="/games" className={ui.iconButton} aria-label="Back">
            ‹
          </Link>
        }
        right={
          <Link
            to="/games/$gameId/edit"
            params={{ gameId }}
            className={ui.iconButton}
            aria-label="Edit game"
          >
            ✎
          </Link>
        }
      />
      <div className={ui.page}>
        <p className={ui.empty}>Pre-game and live tracking arrive in M2.</p>
      </div>
    </>
  );
}
