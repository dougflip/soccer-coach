import { useId, type ComponentProps, type ReactNode } from "react";
import styles from "./ui.module.css";

type Variant = "primary" | "ghost" | "danger";

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  const variantClass = variant === "primary" ? "" : styles[variant];
  return (
    <button
      type="button"
      {...props}
      className={[styles.button, variantClass, className].filter(Boolean).join(" ")}
    />
  );
}

export function TextField({
  label,
  hint,
  ...props
}: ComponentProps<"input"> & { label: string; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input id={id} className={styles.input} {...props} />
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  left,
  right,
}: {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      {left}
      <h1 className={styles.title}>
        {title}
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </h1>
      {right}
    </header>
  );
}

export { styles as ui };
