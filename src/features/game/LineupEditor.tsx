import { useState, type ReactNode } from "react";
import type { PlayerId } from "../../domain/ids.ts";
import { clearSlot, sameSpot, tap, type Spot } from "../../domain/lineup-edit.ts";
import { mapPositions, positionOf, type Lineup, type Position } from "../../domain/positions.ts";
import { Button } from "../../ui/primitives.tsx";
import { BenchView, FieldView, type ChipView, type SlotView } from "./FieldView.tsx";
import styles from "./game.module.css";

/**
 * Tap-then-tap lineup builder (pre-game, Next Up, halftime). With `base`, changed
 * slots are highlighted against it.
 */
export function LineupEditor({
  lineup,
  onChange,
  base,
  benchIds,
  unavailable,
  name,
  slotDetail,
  chipDetail,
}: {
  lineup: Lineup;
  onChange: (lineup: Lineup) => void;
  base?: Lineup;
  /** Present players who could come on (anyone not in `lineup` is shown on the bench). */
  benchIds: readonly PlayerId[];
  unavailable: ReadonlySet<PlayerId>;
  name: (id: PlayerId) => string;
  slotDetail?: (id: PlayerId) => ReactNode;
  chipDetail?: (id: PlayerId) => ReactNode;
}) {
  const [selected, setSelected] = useState<Spot | null>(null);

  const onTap = (target: Spot) => {
    const next = tap({ lineup, selected }, target);
    setSelected(next.selected);
    if (next.lineup !== lineup) onChange(next.lineup);
  };

  const slots = mapPositions((position): SlotView => {
    const playerId = lineup[position];
    const isSelected = selected !== null && sameSpot(selected, { kind: "slot", position });
    const changed = base !== undefined && base[position] !== playerId;
    let note: string | undefined;
    if (changed && playerId !== null && base) {
      const from = positionOf(base, playerId);
      note = from === undefined ? "IN" : `from ${from}`;
    }
    return {
      playerId,
      detail: playerId === null ? undefined : slotDetail?.(playerId),
      note,
      tone: isSelected
        ? "selected"
        : playerId !== null && unavailable.has(playerId)
          ? "hurt"
          : changed
            ? "changed"
            : undefined,
    };
  });

  const chips = benchIds
    .filter((id) => positionOf(lineup, id) === undefined)
    .map((playerId): ChipView => {
      const isSelected = selected !== null && sameSpot(selected, { kind: "bench", playerId });
      const goingOff = base !== undefined && positionOf(base, playerId) !== undefined;
      return {
        playerId,
        detail: goingOff ? "OUT" : chipDetail?.(playerId),
        tone: isSelected
          ? "selected"
          : unavailable.has(playerId)
            ? "unav"
            : goingOff
              ? "out"
              : undefined,
      };
    });

  // A field player is selected: offer to bench them (frees the slot for a later tap).
  const benchable =
    selected?.kind === "slot"
      ? { position: selected.position, playerId: lineup[selected.position] }
      : null;
  const sendToBench = (position: Position) => {
    onChange(clearSlot(lineup, position));
    setSelected(null);
  };

  return (
    <>
      <FieldView
        slots={slots}
        name={name}
        onTap={(position) => onTap({ kind: "slot", position })}
      />
      {benchable && benchable.playerId !== null && (
        <Button variant="ghost" onClick={() => sendToBench(benchable.position)}>
          Send {name(benchable.playerId)} to bench
        </Button>
      )}
      <BenchView
        chips={chips}
        name={name}
        onTap={(playerId) => onTap({ kind: "bench", playerId })}
        emptyText="No one on the bench."
      />
      <p className={styles.hint}>
        {selected
          ? "Tap where they go (or tap again to cancel)"
          : "Tap a player, then where they go (or send them to the bench)"}
      </p>
    </>
  );
}
