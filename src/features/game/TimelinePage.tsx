import { Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Fragment, useState } from "react";
import { useTeamId } from "../../app/team.tsx";
import { repos } from "../../data/repos/index.ts";
import type { Game } from "../../data/schemas.ts";
import { assertNever } from "../../domain/events.ts";
import type { GameId } from "../../domain/ids.ts";
import { effectiveEvents } from "../../domain/log.ts";
import { formatClock } from "../../domain/time.ts";
import {
  canDelete,
  removeEntry,
  retime,
  timeline,
  type TimelineEntry,
} from "../../domain/timeline.ts";
import { Button, PageHeader, ui } from "../../ui/primitives.tsx";
import { Sheet } from "../../ui/Sheet.tsx";
import { periodLabel } from "./ClockBar.tsx";
import styles from "./game.module.css";
import { diffSummary, useCommandContext, usePlayers, type Players } from "./hooks.ts";

export function TimelinePage({ gameId }: { gameId: GameId }) {
  const teamId = useTeamId();
  const game = useLiveQuery(async () => (await repos.games.get(gameId)) ?? null, [gameId]);
  const events = useLiveQuery(() => repos.events.forGame(gameId), [gameId]);
  const players = usePlayers(teamId);
  if (game === undefined || events === undefined || !players.loaded) return null;
  if (game === null) return <p className={ui.empty}>Game not found.</p>;
  return <Timeline game={game} events={events} players={players} />;
}

function describe(entry: TimelineEntry, players: Players): { title: string; detail: string[] } {
  switch (entry.kind) {
    case "lineup":
      if (entry.kickoff) {
        return entry.at.period === 1
          ? { title: "Starting lineup", detail: [] }
          : {
              title: `${periodLabel(entry.at.period)} lineup`,
              detail: diffSummary(entry.diff, players.name, entry.event.lineup),
            };
      }
      return { title: "Sub", detail: diffSummary(entry.diff, players.name, entry.event.lineup) };
    case "availability":
      return {
        title: `${players.name(entry.event.playerId)} ${entry.event.available ? "available" : "unavailable"}`,
        detail: [],
      };
    case "arrival":
      return { title: `${players.name(entry.event.playerId)} arrived`, detail: [] };
    case "periodEnd":
      return { title: `End of ${periodLabel(entry.at.period)}`, detail: [] };
    default:
      return assertNever(entry);
  }
}

function Timeline({
  game,
  events,
  players,
}: {
  game: Game;
  events: Awaited<ReturnType<typeof repos.events.forGame>>;
  players: Players;
}) {
  const ctx = useCommandContext(game.id);
  const effective = effectiveEvents(events);
  const entries = timeline(effective);
  const [editing, setEditing] = useState<TimelineEntry | null>(null);
  const periods = [...new Set(entries.map((e) => e.at.period))];

  return (
    <>
      <PageHeader
        title="Timeline"
        subtitle={`vs ${game.opponent}`}
        left={
          <Link
            to="/games/$gameId"
            params={{ gameId: game.id }}
            className={ui.iconButton}
            aria-label="Back to game"
          >
            ‹
          </Link>
        }
      />
      <div className={ui.page}>
        {entries.length === 0 && <p className={ui.empty}>Nothing recorded yet.</p>}
        {periods.map((period) => (
          <section key={period}>
            <h2 className={ui.section}>{periodLabel(period)}</h2>
            <ul className={ui.list}>
              {entries
                .filter((e) => e.at.period === period)
                .map((entry) => {
                  const { title, detail } = describe(entry, players);
                  return (
                    <li key={entry.event.id} className={ui.row}>
                      <span className={styles.time}>{formatClock(entry.at.ms)}</span>
                      <span className={ui.rowMain}>
                        <span className={ui.rowTitle}>{title}</span>
                        {detail.map((line) => (
                          <span key={line} className={styles.detailLine}>
                            {line}
                          </span>
                        ))}
                      </span>
                      <button
                        type="button"
                        className={styles.edit}
                        onClick={() => setEditing(entry)}
                      >
                        Edit
                      </button>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
        <p className={ui.hint}>
          Change when something happened or remove it. To change who played where, delete the sub
          and re-record it.
        </p>
      </div>
      {editing && (
        <EditSheet
          key={editing.event.id}
          entry={editing}
          title={describe(editing, players).title}
          onClose={() => setEditing(null)}
          onSave={async (ms) => {
            await repos.events.append(...retime(ctx, effective, editing, ms));
            setEditing(null);
          }}
          onDelete={async () => {
            await repos.events.append(...removeEntry(ctx, editing));
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

const STEPS = [
  { label: "−1m", delta: -60_000 },
  { label: "−10s", delta: -10_000 },
  { label: "+10s", delta: 10_000 },
  { label: "+1m", delta: 60_000 },
];

function EditSheet({
  entry,
  title,
  onClose,
  onSave,
  onDelete,
}: {
  entry: TimelineEntry;
  title: string;
  onClose: () => void;
  onSave: (ms: number) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [ms, setMs] = useState(entry.at.ms);
  return (
    <Sheet label={`Edit ${title}`} onClose={onClose}>
      <h3 className={styles.sheetTitle}>{title}</h3>
      <p className={styles.sheetSub}>{periodLabel(entry.at.period)}</p>
      <div className={styles.stepper}>
        {STEPS.map(({ label, delta }, idx) => (
          <Fragment key={label}>
            {idx === 2 && <output className={styles.stepValue}>{formatClock(ms)}</output>}
            <button
              type="button"
              className={styles.choice}
              onClick={() => setMs((x) => Math.max(0, x + delta))}
            >
              {label}
            </button>
          </Fragment>
        ))}
      </div>
      <Button disabled={ms === entry.at.ms} onClick={() => void onSave(ms)}>
        Save time
      </Button>
      {canDelete(entry) && (
        <Button variant="danger" onClick={() => void onDelete()}>
          Delete
        </Button>
      )}
    </Sheet>
  );
}
