import { Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useTeamId } from "../../app/team.tsx";
import { repos } from "../../data/repos/index.ts";
import { displayName } from "../../data/schemas.ts";
import { PageHeader, ui } from "../../ui/primitives.tsx";

export function RosterPage() {
  const teamId = useTeamId();
  const roster = useLiveQuery(() => repos.players.roster(teamId), [teamId]);

  return (
    <>
      <PageHeader
        title="Roster"
        subtitle={roster ? `${roster.length} players` : undefined}
        right={
          <Link to="/roster/new" className={ui.iconButton} aria-label="Add player">
            +
          </Link>
        }
      />
      <div className={ui.page}>
        {roster?.length === 0 && <p className={ui.empty}>No players yet. Tap + to add one.</p>}
        <ul className={ui.list}>
          {roster?.map((p) => (
            <li key={p.id}>
              <Link to="/roster/$playerId" params={{ playerId: p.id }} className={ui.row}>
                <span className={`${ui.rowMain} ${ui.rowTitle}`}>{displayName(p)}</span>
                <span aria-hidden>›</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
