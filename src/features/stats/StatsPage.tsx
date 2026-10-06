import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { useTeamId } from "../../app/team.tsx";
import { repos } from "../../data/repos/index.ts";
import { GameIdSchema, type GameId, type PlayerId } from "../../domain/ids.ts";
import { effectiveEvents } from "../../domain/log.ts";
import { POSITIONS } from "../../domain/positions.ts";
import { buildSegments } from "../../domain/segments.ts";
import {
  availableShare,
  combineGames,
  emptyStats,
  statsByPlayer,
  totalFieldMs,
  type PlayerStats,
} from "../../domain/stats.ts";
import { PageHeader, ui } from "../../ui/primitives.tsx";
import { minutesLabel, usePlayers } from "../game/hooks.ts";
import { formatGameDate } from "../games/dates.ts";
import styles from "./stats.module.css";

type Scope = "season" | GameId;
type Mode = "minutes" | "percent";

/** Players × positions: who's short on time, and who hasn't tried which position. */
export function StatsPage() {
  const teamId = useTeamId();
  const players = usePlayers(teamId);
  const data = useLiveQuery(async () => {
    const games = await repos.games.list(teamId);
    const byGame = await repos.events.byGame();
    const perGame = new Map(
      games.map((g) => [
        g.id,
        statsByPlayer(buildSegments(effectiveEvents(byGame.get(g.id) ?? []))),
      ]),
    );
    return { games: games.filter((g) => (perGame.get(g.id)?.size ?? 0) > 0), perGame };
  }, [teamId]);
  const [scope, setScope] = useState<Scope>("season");
  const [mode, setMode] = useState<Mode>("minutes");
  if (!data || !players.loaded) return null;

  const stats =
    scope === "season"
      ? combineGames([...data.perGame.values()])
      : (data.perGame.get(scope) ?? new Map());
  // Everyone on the roster, plus archived players who have time in scope.
  const ids = [...new Set<PlayerId>([...players.roster.map((p) => p.id), ...stats.keys()])];
  const rows = ids
    .map((id) => ({ id, s: stats.get(id) ?? emptyStats() }))
    .toSorted((a, b) => totalFieldMs(b.s) - totalFieldMs(a.s));
  const maxCell = Math.max(1, ...rows.flatMap((r) => POSITIONS.map((p) => r.s.fieldMs[p])));

  return (
    <>
      <PageHeader
        title="Stats"
        subtitle={
          scope === "season"
            ? `Season · ${data.games.length} game${data.games.length === 1 ? "" : "s"}`
            : "One game"
        }
      />
      <div className={ui.page}>
        <label className={styles.scope}>
          <span className={ui.label}>Show</span>
          <select
            className={ui.input}
            value={scope}
            onChange={(e) => setScope(parseScope(e.target.value))}
          >
            <option value="season">Whole season</option>
            {data.games.map((g) => (
              <option key={g.id} value={g.id}>
                vs {g.opponent} · {formatGameDate(g.startsAt)}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.seg}>
          <button
            type="button"
            aria-pressed={mode === "minutes"}
            onClick={() => setMode("minutes")}
          >
            Minutes
          </button>
          <button
            type="button"
            aria-pressed={mode === "percent"}
            onClick={() => setMode("percent")}
          >
            % of time
          </button>
        </div>

        <div className={styles.scroll}>
          <table className={styles.grid}>
            <thead>
              <tr>
                <th scope="col">Player</th>
                {POSITIONS.map((p) => (
                  <th key={p} scope="col">
                    {p}
                  </th>
                ))}
                <th scope="col">{mode === "minutes" ? "Field" : "Played"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ id, s }) => (
                <tr key={id}>
                  <th scope="row">{players.name(id)}</th>
                  {POSITIONS.map((p) => (
                    <Cell key={p} ms={s.fieldMs[p]} stats={s} mode={mode} max={maxCell} />
                  ))}
                  <td className={styles.total}>
                    {mode === "minutes"
                      ? minutesLabel(totalFieldMs(s))
                      : percent(availableShare(s))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={ui.hint}>
          {mode === "minutes"
            ? "Minutes at each position. Red 0 = never played there."
            : "Share of each player's field time by position. “Played” = field time ÷ time they were available."}
        </p>
      </div>
    </>
  );
}

function Cell({
  ms,
  stats,
  mode,
  max,
}: {
  ms: number;
  stats: PlayerStats;
  mode: Mode;
  max: number;
}) {
  if (ms === 0) return <td className={styles.never}>0</td>;
  const level = Math.min(4, Math.ceil((ms / max) * 4));
  const field = totalFieldMs(stats);
  return (
    <td className={styles[`h${level}`]}>
      {mode === "minutes" ? minutesLabel(ms) : percent(ms / field)}
    </td>
  );
}

/** Select value -> scope; anything that isn't a game ID means the whole season. */
function parseScope(value: string): Scope {
  const r = GameIdSchema.safeParse(value);
  return r.success ? r.data : "season";
}

const percent = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);
