import { useEffect, type ReactNode } from "react";
import styles from "./overlays.module.css";

export function Toast({
  children,
  actions,
  onDismiss,
  timeoutMs = 10_000,
}: {
  children: ReactNode;
  actions?: ReactNode;
  onDismiss: () => void;
  timeoutMs?: number;
}) {
  useEffect(() => {
    const id = setTimeout(onDismiss, timeoutMs);
    return () => clearTimeout(id);
  }, [onDismiss, timeoutMs]);

  return (
    <output className={styles.toast}>
      <span className={styles.toastText}>{children}</span>
      {actions}
    </output>
  );
}

export function ToastAction(props: { onClick: () => void; children: ReactNode }) {
  return <button type="button" className={styles.toastAction} {...props} />;
}
