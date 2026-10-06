import { useState } from "react";
import { repos } from "../../data/repos/index.ts";
import type { Game } from "../../data/schemas.ts";
import {
  endPeriod,
  pauseClock,
  replaceEvent,
  resumeClock,
  setAvailability,
  setLineup,
  setPresence,
  subOffUnavailable,
  voidEvent,
} from "../../domain/commands.ts";
import type { GameView } from "../../domain/game-view.ts";
import { currentGameTime } from "../../domain/status.ts";
import type { EventId, PlayerId } from "../../domain/ids.ts";
import { diffLineups } from "../../domain/lineup-edit.ts";
import { mapPositions, playersIn, positionOf, type Position } from "../../domain/positions.ts";
import { formatClock, type GameTime } from "../../domain/time.ts";
import { Button, ui } from "../../ui/primitives.tsx";
import { Sheet } from "../../ui/Sheet.tsx";
import { Toast, ToastAction } from "../../ui/Toast.tsx";
import { useWakeLock } from "../../ui/useWakeLock.ts";
import { ClockBar, periodLabel } from "./ClockBar.tsx";
import { BenchView, FieldView, type ChipView, type SlotView } from "./FieldView.tsx";
import styles from "./game.module.css";
import {
  diffSummary,
  mins,
  useCommandContext,
  useLineupDraft,
  useSeasonFieldMs,
  type Players,
} from "./hooks.ts";
import { LineupEditor } from "./LineupEditor.tsx";

type Panel = { kind: "player"; playerId: PlayerId } | { kind: "menu" } | null;

export function LiveView({
  game,
  view,
  players,
  period,
}: {
  game: Game;
  view: GameView;
  players: Players;
  period: number;
}) {
  useWakeLock(true);
  const ctx = useCommandContext(game.id);
  const [tab, setTab] = useState<"field" | "next">("field");
  const [panel, setPanel] = useState<Panel>(null);
  const [lastSub, setLastSub] = useState<EventId | null>(null);
  const season = useSeasonFieldMs(game.teamId, game.id);
  const { lineup, present, unavailable } = view.snapshot;
  const at: GameTime = view.at ?? { period, ms: 0 };
  // Stamp actions with the game time at the tap, not at the last (up to 1s old) render.
  const nowAt = (): GameTime => currentGameTime(view.effective, Date.now()) ?? at;
  const next = useLineupDraft(`draft:next:${game.id}`, lineup);
  const diff = diffLineups(lineup, next.draft);
  const changes = diff.changedPositions.length;
  const draftBlocked = playersIn(next.draft).some((id) => unavailable.has(id) || !present.has(id));

  const onField = new Set(playersIn(lineup));
  const byMinutes = (a: PlayerId, b: PlayerId) => view.fieldMs(a) - view.fieldMs(b);
  const benchIds = [...present]
    .filter((id) => !onField.has(id))
    .toSorted((a, b) => Number(unavailable.has(a)) - Number(unavailable.has(b)) || byMinutes(a, b));
  const notHere = players.roster.map((p) => p.id).filter((id) => !present.has(id));
  const gameMin = (id: PlayerId) => mins(view.fieldMs(id));
  const seasonMin = (id: PlayerId) => mins((season.get(id) ?? 0) + view.fieldMs(id));

  async function subNow() {
    const e = setLineup(ctx, nowAt(), next.draft);
    await repos.events.append(e);
    next.reset();
    setLastSub(e.id);
    setTab("field");
  }

  async function nudgeLastSub() {
    const original = view.effective.find((e) => e.id === lastSub);
    if (!original || original.type !== "lineup_set") return;
    const [voided, replacement] = replaceEvent(ctx, original, {
      at: { ...original.at, ms: Math.max(0, original.at.ms - 10_000) },
    });
    await repos.events.append(voided, replacement);
    setLastSub(replacement.id);
  }

  async function undoLastSub() {
    if (lastSub) await repos.events.append(voidEvent(ctx, lastSub));
    setLastSub(null);
  }

  const lastSubAt = view.effective.find((e) => e.id === lastSub);

  const slots = mapPositions((position): SlotView => {
    const playerId = lineup[position];
    if (playerId === null) return { playerId };
    const stint = view.stint(playerId);
    const longest = view.longest.has(playerId);
    return {
      playerId,
      tone: unavailable.has(playerId) ? "hurt" : longest ? "longest" : undefined,
      detail: (
        <>
          <span className={longest ? styles.long : styles.stint}>
            on {Math.floor((stint ?? 0) / 60_000)}
          </span>
          {` · ${gameMin(playerId)}`}
        </>
      ),
    };
  });

  const benchChips = benchIds.map((playerId): ChipView => ({
    playerId,
    tone: unavailable.has(playerId) ? "unav" : undefined,
    detail: (
      <>
        {unavailable.has(playerId) ? "✕ " : ""}
        {gameMin(playerId)}
        <br />
        {seasonMin(playerId)} szn
      </>
    ),
  }));

  return (
    <>
      <ClockBar
        label={periodLabel(period)}
        opponent={game.opponent}
        ms={view.clock?.ms ?? at.ms}
        paused={view.clock?.running === false}
        action={
          <button
            type="button"
            className={styles.clockButton}
            aria-label="Game menu"
            onClick={() => setPanel({ kind: "menu" })}
          >
            ⋯
          </button>
        }
      />
      <div className={ui.page}>
        <div className={styles.seg}>
          <button
            type="button"
            className={styles.segButton}
            aria-pressed={tab === "field"}
            onClick={() => setTab("field")}
          >
            On Field
          </button>
          <button
            type="button"
            className={styles.segButton}
            aria-pressed={tab === "next"}
            onClick={() => setTab("next")}
          >
            Next Up{changes > 0 && <span className={styles.badge}>{changes}</span>}
          </button>
        </div>

        {tab === "field" ? (
          <>
            <FieldView
              slots={slots}
              name={players.name}
              onTap={(p: Position) => {
                const id = lineup[p];
                if (id) setPanel({ kind: "player", playerId: id });
              }}
            />
            <h2 className={ui.section}>
              <span>Bench · {benchIds.length}</span>
              <span>game · season</span>
            </h2>
            <BenchView
              chips={benchChips}
              name={players.name}
              onTap={(id) => setPanel({ kind: "player", playerId: id })}
              emptyText="No one on the bench."
            />
            {notHere.length > 0 && (
              <>
                <h2 className={ui.section}>
                  <span>Not here · {notHere.length}</span>
                  <span>tap if they arrive</span>
                </h2>
                <BenchView
                  chips={notHere.map((playerId): ChipView => ({
                    playerId,
                    tone: "dim",
                    detail: "+ arrived",
                  }))}
                  name={players.name}
                  onTap={(id) => void repos.events.append(setPresence(ctx, id, true, nowAt()))}
                />
              </>
            )}
          </>
        ) : (
          <>
            <LineupEditor
              lineup={next.draft}
              onChange={next.set}
              base={lineup}
              benchIds={benchIds}
              unavailable={unavailable}
              name={players.name}
              slotDetail={gameMin}
              chipDetail={gameMin}
            />
            {changes > 0 && (
              <div className={styles.diff}>
                {diffSummary(diff, players.name).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            )}
            {draftBlocked && (
              <p className={ui.error}>Someone in Next Up is unavailable or not here.</p>
            )}
          </>
        )}
      </div>

      {tab === "next" && (
        <div className={styles.footer}>
          <Button variant="ghost" disabled={changes === 0} onClick={next.reset}>
            Reset
          </Button>
          <Button
            className={styles.next}
            disabled={changes === 0 || draftBlocked}
            onClick={() => void subNow()}
          >
            Sub now ⇄
          </Button>
        </div>
      )}

      {lastSub && lastSubAt?.type === "lineup_set" && (
        <Toast
          key={lastSub}
          onDismiss={() => setLastSub(null)}
          actions={
            <>
              <ToastAction onClick={() => void nudgeLastSub()}>−10s</ToastAction>
              <ToastAction onClick={() => void undoLastSub()}>Undo</ToastAction>
            </>
          }
        >
          Sub recorded at <b>{formatClock(lastSubAt.at.ms)}</b>
        </Toast>
      )}

      {panel?.kind === "player" && (
        <PlayerSheet
          playerId={panel.playerId}
          view={view}
          players={players}
          benchIds={benchIds}
          onClose={() => setPanel(null)}
          onAction={async (events) => {
            await repos.events.append(...events);
            setPanel(null);
          }}
          nowAt={nowAt}
          ctx={ctx}
        />
      )}

      {panel?.kind === "menu" && (
        <Sheet label="Game menu" onClose={() => setPanel(null)}>
          <h3 className={styles.sheetTitle}>{periodLabel(period)}</h3>
          <Button
            onClick={() => {
              void repos.events.append(endPeriod(ctx, nowAt()));
              setPanel(null);
            }}
          >
            {period >= 2 ? "End game" : "End half"} at {formatClock(at.ms)}
          </Button>
          {view.clock?.running === false ? (
            <Button
              variant="ghost"
              onClick={() =>
                void repos.events.append(resumeClock(ctx, period)).then(() => setPanel(null))
              }
            >
              Resume clock
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={() =>
                void repos.events.append(pauseClock(ctx, period)).then(() => setPanel(null))
              }
            >
              Pause clock
            </Button>
          )}
          <p className={styles.sheetSub}>
            The clock normally runs nonstop; pause only if you need to.
          </p>
        </Sheet>
      )}
    </>
  );
}

function PlayerSheet({
  playerId,
  view,
  players,
  benchIds,
  onClose,
  onAction,
  nowAt,
  ctx,
}: {
  playerId: PlayerId;
  view: GameView;
  players: Players;
  benchIds: PlayerId[];
  onClose: () => void;
  onAction: (events: Parameters<typeof repos.events.append>) => Promise<void>;
  nowAt: () => GameTime;
  ctx: ReturnType<typeof useCommandContext>;
}) {
  const { lineup, unavailable } = view.snapshot;
  const position = positionOf(lineup, playerId);
  const candidates = benchIds.filter((id) => !unavailable.has(id));
  const [replacement, setReplacement] = useState<PlayerId | null>(candidates[0] ?? null);
  const name = players.name(playerId);
  const isUnavailable = unavailable.has(playerId);

  const subOff = (available: boolean) => {
    if (!position) return;
    const at = nowAt();
    const events = available
      ? [
          setLineup(
            ctx,
            at,
            mapPositions((p) => (p === position ? replacement : lineup[p])),
          ),
        ]
      : subOffUnavailable(ctx, { at, lineup, playerId, replacement });
    void onAction(events);
  };

  return (
    <Sheet label={name} onClose={onClose}>
      <h3 className={styles.sheetTitle}>
        {name}
        {position && ` · ${position}`}
        {isUnavailable && " · unavailable"}
      </h3>
      <p className={styles.sheetSub}>{mins(view.fieldMs(playerId))} on field this game</p>
      {position ? (
        <>
          <h4 className={ui.section}>Replace at {position} with</h4>
          <div className={styles.choices}>
            {candidates.map((id) => (
              <button
                key={id}
                type="button"
                className={styles.choice}
                aria-pressed={replacement === id}
                onClick={() => setReplacement(id)}
              >
                {players.name(id)} · {mins(view.fieldMs(id))}
              </button>
            ))}
            <button
              type="button"
              className={styles.choice}
              aria-pressed={replacement === null}
              onClick={() => setReplacement(null)}
            >
              Leave empty
            </button>
          </div>
          <Button variant="danger" onClick={() => subOff(false)}>
            Sub off now · unavailable
          </Button>
          <Button variant="ghost" onClick={() => subOff(true)}>
            Sub off now · still available
          </Button>
        </>
      ) : isUnavailable ? (
        <Button
          className={styles.go}
          onClick={() => void onAction([setAvailability(ctx, playerId, true, nowAt())])}
        >
          Mark available ✓
        </Button>
      ) : (
        <Button
          variant="danger"
          onClick={() => void onAction([setAvailability(ctx, playerId, false, nowAt())])}
        >
          Mark unavailable
        </Button>
      )}
    </Sheet>
  );
}
