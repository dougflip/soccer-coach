import { Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useTeamId } from "../../app/team.tsx";
import { repos } from "../../data/repos/index.ts";
import type { Game } from "../../data/schemas.ts";
import { PageHeader, ui } from "../../ui/primitives.tsx";
import { useNow } from "../../ui/useNow.ts";
import { formatGameDate } from "./dates.ts";

// A game counts as "upcoming" until 3h after its start.
const UPCOMING_GRACE_MS = 3 * 60 * 60 * 1000;

export function GamesPage() {
  const teamId = useTeamId();
  const games = useLiveQuery(() => repos.games.list(teamId), [teamId]);
  const cutoff = useNow(60_000) - UPCOMING_GRACE_MS;
  const upcoming = games?.filter((g) => Date.parse(g.startsAt) >= cutoff).toReversed() ?? [];
  const past = games?.filter((g) => Date.parse(g.startsAt) < cutoff) ?? [];

  return (
    <>
      <PageHeader
        title="Games"
        right={
          <Link to="/games/new" className={ui.iconButton} aria-label="New game">
            +
          </Link>
        }
      />
      <div className={ui.page}>
        {games?.length === 0 && <p className={ui.empty}>No games yet. Tap + to add one.</p>}
        <GameSection title="Upcoming" games={upcoming} />
        <GameSection title="Past" games={past} />
      </div>
    </>
  );
}

function GameSection({ title, games }: { title: string; games: Game[] }) {
  if (games.length === 0) return null;
  return (
    <section>
      <h2 className={ui.section}>{title}</h2>
      <ul className={ui.list}>
        {games.map((g) => (
          <li key={g.id}>
            <Link to="/games/$gameId" params={{ gameId: g.id }} className={ui.row}>
              <span className={ui.rowMain}>
                <span className={ui.rowTitle}>vs {g.opponent}</span>
                <span className={ui.rowSub}>
                  {" · "}
                  {formatGameDate(g.startsAt)}
                  {g.location ? ` · ${g.location}` : ""}
                </span>
              </span>
              <span aria-hidden>›</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
