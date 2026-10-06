// <input type="date"/"time"> work in local time; storage is ISO (UTC).

const pad = (n: number) => String(n).padStart(2, "0");

export function toLocalInputs(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export const fromLocalInputs = (date: string, time: string): string =>
  new Date(`${date}T${time || "00:00"}`).toISOString();

const fmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export const formatGameDate = (iso: string): string => fmt.format(new Date(iso));
