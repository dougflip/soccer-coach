import { Link } from "@tanstack/react-router";
import type { Game } from "../../data/schemas.ts";
import type { GameView } from "../../domain/game-view.ts";
import { POSITIONS } from "../../domain/positions.ts";
import { totalFieldMs } from "../../domain/stats.ts";
import { PageHeader, ui } from "../../ui/primitives.tsx";
import { formatGameDate } from "../games/dates.ts";
import styles from "./game.module.css";
import { minutesLabel, type Players } from "./hooks.ts";

const m = (ms: number) => (ms === 0 ? "" : minutesLabel(ms));

/** Minutes by position for this game. (Fuller review + editing comes in M3.) */
export function FinalView({
  game,
  view,
  players,
}: {
  game: Game;
  view: GameView;
  players: Players;
}) {
  const ids = [...new Set(view.segments.map((s) => s.playerId))].toSorted(
    (a, b) => view.fieldMs(b) - view.fieldMs(a),
  );
  return (
    <>
      <PageHeader
        title={`vs ${game.opponent}`}
        subtitle={`Final · ${formatGameDate(game.startsAt)}`}
        left={
          <Link to="/games" className={ui.iconButton} aria-label="Back">
            ‹
          </Link>
        }
      />
      <div className={ui.page}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Player</th>
              {POSITIONS.map((p) => (
                <th key={p} scope="col">
                  {p}
                </th>
              ))}
              <th scope="col">Bench</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {ids.map((id) => {
              const s = view.statsFor(id);
              return (
                <tr key={id}>
                  <td>{players.name(id)}</td>
                  {POSITIONS.map((p) => (
                    <td key={p}>{m(s.fieldMs[p])}</td>
                  ))}
                  <td>{m(s.benchAvailableMs + s.benchUnavailableMs)}</td>
                  <td>
                    <b>{minutesLabel(totalFieldMs(s))}</b>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className={ui.hint}>Minutes, rounded. Bench includes unavailable time.</p>
      </div>
    </>
  );
}
