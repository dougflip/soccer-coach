import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { repos } from "../../data/repos/index.ts";
import type { Game } from "../../data/schemas.ts";
import { setLineup, setPresence, startPeriod } from "../../domain/commands.ts";
import { attendance, type GameView } from "../../domain/game-view.ts";
import type { PlayerId } from "../../domain/ids.ts";
import { playersIn, POSITIONS } from "../../domain/positions.ts";
import { Button, PageHeader, ui } from "../../ui/primitives.tsx";
import { formatGameDate } from "../games/dates.ts";
import styles from "./game.module.css";
import {
  mins,
  useCommandContext,
  useLineupDraft,
  useSeasonFieldMs,
  type Players,
} from "./hooks.ts";
import { LineupEditor } from "./LineupEditor.tsx";

/** Step 1: who's here. Step 2: starting lineup, then kickoff. */
export function PregameView({
  game,
  view,
  players,
}: {
  game: Game;
  view: GameView;
  players: Players;
}) {
  const [step, setStep] = useState<"attendance" | "lineup">("attendance");
  const ctx = useCommandContext(game.id);
  const rosterIds = players.roster.map((p) => p.id);
  const present = attendance(view.effective, rosterIds);
  const presentIds = rosterIds.filter((id) => present.get(id) === true);
  const season = useSeasonFieldMs(game.teamId, game.id);
  const lineupDraft = useLineupDraft(`draft:start:${game.id}`, view.snapshot.lineup);
  // Absent players can't start.
  const draft = lineupDraft.draft;
  const startersAbsent = playersIn(draft).some((id) => present.get(id) !== true);

  const toggle = (id: PlayerId) =>
    void repos.events.append(setPresence(ctx, id, present.get(id) !== true));

  async function kickoff() {
    // Record presence explicitly (attendance defaults to present) so the log is self-contained.
    await repos.events.append(
      ...presentIds.map((id) => setPresence(ctx, id, true)),
      setLineup(ctx, { period: 1, ms: 0 }, draft),
      startPeriod(ctx, 1),
    );
    lineupDraft.reset();
  }

  const back = (
    <Link to="/games" className={ui.iconButton} aria-label="Back">
      ‹
    </Link>
  );
  const edit = (
    <Link
      to="/games/$gameId/edit"
      params={{ gameId: game.id }}
      className={ui.iconButton}
      aria-label="Edit game"
    >
      ✎
    </Link>
  );

  if (step === "attendance") {
    return (
      <>
        <PageHeader
          title={`vs ${game.opponent}`}
          subtitle={`${formatGameDate(game.startsAt)} · Who's here?`}
          left={back}
          right={edit}
        />
        <div className={ui.page}>
          <h2 className={ui.section}>
            <span>Present</span>
            <span>
              {presentIds.length} of {rosterIds.length}
            </span>
          </h2>
          {rosterIds.length === 0 && (
            <p className={ui.empty}>Add players on the Roster tab first.</p>
          )}
          <ul className={ui.list}>
            {players.roster.map((p) => (
              <li key={p.id}>
                <label className={ui.row}>
                  <span className={`${ui.rowMain} ${ui.rowTitle}`}>{players.name(p.id)}</span>
                  <input
                    type="checkbox"
                    checked={present.get(p.id) === true}
                    onChange={() => toggle(p.id)}
                  />
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.footer}>
          <Button onClick={() => setStep("lineup")} disabled={presentIds.length === 0}>
            Next: starting lineup
          </Button>
        </div>
      </>
    );
  }

  const filled = POSITIONS.filter((p) => draft[p] !== null).length;
  return (
    <>
      <PageHeader
        title={`vs ${game.opponent}`}
        subtitle="Starting lineup"
        left={
          <button
            type="button"
            className={ui.iconButton}
            aria-label="Back to attendance"
            onClick={() => setStep("attendance")}
          >
            ‹
          </button>
        }
      />
      <div className={ui.page}>
        <LineupEditor
          lineup={draft}
          onChange={lineupDraft.set}
          benchIds={presentIds}
          unavailable={new Set()}
          name={players.name}
          chipDetail={(id) => `${mins(season.get(id) ?? 0)} szn`}
        />
        {startersAbsent && <p className={ui.error}>Someone in the lineup isn't marked present.</p>}
      </div>
      <div className={styles.footer}>
        <Button
          className={styles.go}
          disabled={startersAbsent || filled === 0}
          onClick={() => void kickoff()}
        >
          Start 1st half ▶{filled < POSITIONS.length ? ` (${filled}/7)` : ""}
        </Button>
      </div>
    </>
  );
}
