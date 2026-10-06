import { repos } from "../../data/repos/index.ts";
import type { Game } from "../../data/schemas.ts";
import { setAvailability, setLineup, setPresence, startPeriod } from "../../domain/commands.ts";
import type { GameView } from "../../domain/game-view.ts";
import type { PlayerId } from "../../domain/ids.ts";
import { playersIn } from "../../domain/positions.ts";
import { Button, ui } from "../../ui/primitives.tsx";
import { ClockBar } from "./ClockBar.tsx";
import { BenchView, type ChipView } from "./FieldView.tsx";
import styles from "./game.module.css";
import { mins, useCommandContext, useLineupDraft, type Players } from "./hooks.ts";
import { LineupEditor } from "./LineupEditor.tsx";

/** Clock stopped. Set the 2nd-half lineup, fix availability, then kick off. */
export function HalftimeView({
  game,
  view,
  players,
  afterPeriod,
}: {
  game: Game;
  view: GameView;
  players: Players;
  afterPeriod: number;
}) {
  const ctx = useCommandContext(game.id);
  const { lineup, present, unavailable } = view.snapshot;
  const at = view.at ?? { period: afterPeriod, ms: 0 };
  const next = useLineupDraft(`draft:next:${game.id}`, lineup);
  const draftBlocked = playersIn(next.draft).some((id) => unavailable.has(id) || !present.has(id));
  const presentIds = [...present].toSorted((a, b) => view.fieldMs(a) - view.fieldMs(b));
  const notHere = players.roster.map((p) => p.id).filter((id) => !present.has(id));
  const gameMin = (id: PlayerId) => mins(view.fieldMs(id));

  async function startNext() {
    const period = afterPeriod + 1;
    await repos.events.append(
      ...(next.dirty ? [setLineup(ctx, { period, ms: 0 }, next.draft)] : []),
      startPeriod(ctx, period),
    );
    next.reset();
  }

  const availabilityChips = presentIds.map((playerId): ChipView => ({
    playerId,
    tone: unavailable.has(playerId) ? "unav" : undefined,
    detail: unavailable.has(playerId) ? "✕ unavailable" : "available",
  }));

  return (
    <>
      <ClockBar label="Halftime" opponent={game.opponent} ms={at.ms} stopped />
      <div className={ui.page}>
        <h2 className={ui.section}>
          <span>Next half lineup</span>
          <span>minutes so far</span>
        </h2>
        <LineupEditor
          lineup={next.draft}
          onChange={next.set}
          base={lineup}
          benchIds={presentIds}
          unavailable={unavailable}
          name={players.name}
          slotDetail={gameMin}
          chipDetail={gameMin}
        />
        {draftBlocked && (
          <p className={ui.error}>Someone in the lineup is unavailable or not here.</p>
        )}

        <h2 className={ui.section}>
          <span>Availability</span>
          <span>tap to toggle</span>
        </h2>
        <BenchView
          chips={availabilityChips}
          name={players.name}
          onTap={(id) =>
            void repos.events.append(setAvailability(ctx, id, unavailable.has(id), at))
          }
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
              onTap={(id) => void repos.events.append(setPresence(ctx, id, true, at))}
            />
          </>
        )}
      </div>
      <div className={styles.footer}>
        <Button className={styles.go} disabled={draftBlocked} onClick={() => void startNext()}>
          Start 2nd half ▶
        </Button>
      </div>
    </>
  );
}
