import { Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState, type FormEvent } from "react";
import { useTeamId } from "../../app/team.tsx";
import { newGameId } from "../../data/new-ids.ts";
import { repos } from "../../data/repos/index.ts";
import type { Game } from "../../data/schemas.ts";
import type { GameId } from "../../domain/ids.ts";
import { formText } from "../../ui/form.ts";
import { Button, PageHeader, TextField, ui } from "../../ui/primitives.tsx";
import { fromLocalInputs, toLocalInputs } from "./dates.ts";

/** New game (no gameId) or edit details. */
export function GameFormPage({ gameId }: { gameId?: GameId }) {
  const teamId = useTeamId();
  const navigate = useNavigate();
  const [freshId] = useState(newGameId);
  const [defaultStart] = useState(() => {
    // Default: next Saturday 9:00 local.
    const d = new Date();
    d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  });
  const existing = useLiveQuery(
    () => (gameId ? repos.games.get(gameId) : Promise.resolve(null)),
    [gameId],
  );
  if (gameId && existing === undefined) return null; // loading

  const base: Game = existing ?? {
    id: freshId,
    teamId,
    opponent: "",
    startsAt: defaultStart,
    location: null,
    deleted: false,
    updatedAt: null,
  };
  const start = toLocalInputs(base.startsAt);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const location = formText(form, "location");
    await repos.games.save({
      ...base,
      opponent: formText(form, "opponent"),
      startsAt: fromLocalInputs(formText(form, "date"), formText(form, "time")),
      location: location || null,
    });
    await navigate({ to: "/games/$gameId", params: { gameId: base.id } });
  }

  async function remove() {
    await repos.games.save({ ...base, deleted: true });
    await navigate({ to: "/games" });
  }

  return (
    <>
      <PageHeader
        title={existing ? "Edit game" : "New game"}
        left={
          <Link to="/games" className={ui.iconButton} aria-label="Back">
            ‹
          </Link>
        }
      />
      <form className={ui.page} onSubmit={(e) => void save(e)}>
        <TextField
          label="Opponent"
          name="opponent"
          defaultValue={base.opponent}
          required
          maxLength={80}
          autoComplete="off"
        />
        <TextField label="Date" name="date" type="date" defaultValue={start.date} required />
        <TextField label="Time" name="time" type="time" defaultValue={start.time} required />
        <TextField
          label="Location (optional)"
          name="location"
          defaultValue={base.location ?? ""}
          maxLength={120}
          autoComplete="off"
        />
        <Button type="submit">Save</Button>
        {existing && (
          <Button variant="danger" onClick={() => void remove()}>
            Delete game
          </Button>
        )}
      </form>
    </>
  );
}
