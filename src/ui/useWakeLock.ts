import { useEffect } from "react";

/** Keep the screen on while `active`. Browsers drop the lock when hidden, so re-acquire on return. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return () => {};
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const l = await navigator.wakeLock.request("screen");
        if (cancelled) void l.release();
        else lock = l;
      } catch {
        // Denied (e.g. low battery mode); the app still works.
      }
    };
    const onVisible = () => void acquire();
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [active]);
}
