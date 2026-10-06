import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { formatClock } from "../../domain/time.ts";
import styles from "./game.module.css";

export function ClockBar({
  label,
  opponent,
  ms,
  paused = false,
  stopped = false,
  action,
}: {
  label: string;
  opponent: string;
  ms: number;
  /** Clock stopped mid-period (shows "paused"). */
  paused?: boolean;
  /** Clock stopped between periods (gray bar, no "paused" label). */
  stopped?: boolean;
  action?: ReactNode;
}) {
  return (
    <header className={styles.clockBar} data-paused={paused || stopped}>
      <Link to="/games" className={styles.back} aria-label="Back to games">
        ‹
      </Link>
      <div>
        <div className={styles.period}>
          {label}
          {paused ? " · paused" : ""}
        </div>
        <div className={styles.opponent}>vs {opponent}</div>
      </div>
      <time className={styles.clock} aria-label="Game clock">
        {formatClock(ms)}
      </time>
      {action}
    </header>
  );
}

export const periodLabel = (period: number) =>
  period === 1 ? "1st half" : period === 2 ? "2nd half" : `Period ${period}`;
