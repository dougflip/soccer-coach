import { Link, Outlet } from "@tanstack/react-router";
import styles from "./AppShell.module.css";
import { useSync } from "./sync.tsx";

const TABS = [
  { to: "/games", label: "Games", icon: "⚽" },
  { to: "/roster", label: "Roster", icon: "👥" },
  { to: "/stats", label: "Stats", icon: "📊" },
] as const;

export function AppShell() {
  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <Outlet />
      </main>
      <SyncBadge />
      <nav className={styles.tabs} aria-label="Main">
        {TABS.map((t) => (
          <Link key={t.to} to={t.to} className={styles.tab}>
            <span className={styles.tabIcon} aria-hidden>
              {t.icon}
            </span>
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** Only shown when something needs attention; tap to retry. */
function SyncBadge() {
  const { status, syncNow } = useSync();
  const label =
    status.state === "offline"
      ? `Offline · ${status.pending} unsynced`
      : status.state === "error"
        ? "Sync error · retry"
        : status.pending > 0
          ? `${status.pending} unsynced`
          : null;
  if (!label) return null;
  const warn = status.state === "error" || status.state === "offline";
  return (
    <button
      type="button"
      className={`${styles.sync} ${warn ? styles.syncWarn : ""}`}
      title={status.error ?? undefined}
      onClick={() => void syncNow()}
    >
      {label}
    </button>
  );
}
