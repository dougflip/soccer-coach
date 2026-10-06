import { PageHeader, ui } from "../../ui/primitives.tsx";

export function StatsPage() {
  return (
    <>
      <PageHeader title="Stats" />
      <div className={ui.page}>
        <p className={ui.empty}>Minutes by position arrive in M3.</p>
      </div>
    </>
  );
}
