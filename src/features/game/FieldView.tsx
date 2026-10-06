import type { ReactNode } from "react";
import type { PlayerId } from "../../domain/ids.ts";
import { POSITIONS, type Position } from "../../domain/positions.ts";
import styles from "./game.module.css";

export type Tone = "selected" | "changed" | "hurt" | "longest";

export type SlotView = {
  playerId: PlayerId | null;
  detail?: ReactNode;
  note?: string;
  tone?: Tone;
};

/** The 7v7 pitch, attack up. Slots are buttons when `onTap` is given. */
export function FieldView({
  slots,
  name,
  onTap,
}: {
  slots: Record<Position, SlotView>;
  name: (id: PlayerId) => string;
  onTap?: (position: Position) => void;
}) {
  return (
    <div className={styles.field}>
      <div className={styles.box} aria-hidden />
      <span className={styles.attack} aria-hidden>
        ATTACK ↑
      </span>
      {POSITIONS.map((position) => {
        const s = slots[position];
        const id = s.playerId;
        const empty = id === null;
        const label = id === null ? `${position}: empty` : `${position}: ${name(id)}`;
        return (
          <button
            key={position}
            type="button"
            className={`${styles.slot} ${styles[position]} ${empty ? styles.slotEmpty : ""}`}
            data-tone={s.tone}
            aria-label={label}
            disabled={!onTap}
            onClick={() => onTap?.(position)}
          >
            <span className={styles.pos}>{position}</span>
            <span className={styles.slotName}>{id === null ? "tap to fill" : name(id)}</span>
            {s.note ? (
              <span className={styles.slotNote}>{s.note}</span>
            ) : (
              s.detail && <span className={styles.slotDetail}>{s.detail}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export type ChipView = {
  playerId: PlayerId;
  detail?: ReactNode;
  tone?: "unav" | "selected" | "out" | "dim";
};

export function BenchView({
  chips,
  name,
  onTap,
  emptyText,
}: {
  chips: ChipView[];
  name: (id: PlayerId) => string;
  onTap?: (id: PlayerId) => void;
  emptyText?: string;
}) {
  if (chips.length === 0) return emptyText ? <p className={styles.hint}>{emptyText}</p> : null;
  return (
    <div className={styles.bench}>
      {chips.map((c) => (
        <button
          key={c.playerId}
          type="button"
          className={styles.chip}
          data-tone={c.tone}
          disabled={!onTap}
          onClick={() => onTap?.(c.playerId)}
        >
          <span className={styles.chipName}>{name(c.playerId)}</span>
          {c.detail && <span className={styles.chipDetail}>{c.detail}</span>}
        </button>
      ))}
    </div>
  );
}
