import { useEffect, type ReactNode } from "react";
import styles from "./overlays.module.css";

/** Bottom sheet. Closes on scrim tap or Escape. */
export function Sheet({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.layer}>
      <button type="button" className={styles.scrim} aria-label="Close" onClick={onClose} />
      <dialog open aria-modal="true" aria-label={label} className={styles.sheet}>
        <div className={styles.grab} aria-hidden />
        {children}
      </dialog>
    </div>
  );
}
