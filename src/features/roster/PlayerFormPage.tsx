import { Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState, type FormEvent } from "react";
import { useTeamId } from "../../app/team.tsx";
import { newPlayerId } from "../../data/new-ids.ts";
import { repos } from "../../data/repos/index.ts";
import type { Player } from "../../data/schemas.ts";
import type { PlayerId } from "../../domain/ids.ts";
import { formText } from "../../ui/form.ts";
import { Button, PageHeader, TextField, ui } from "../../ui/primitives.tsx";

/** Add (no playerId) or edit a player. */
export function PlayerFormPage({ playerId }: { playerId?: PlayerId }) {
  const teamId = useTeamId();
  const navigate = useNavigate();
  const [freshId] = useState(newPlayerId);
  const existing = useLiveQuery(
    () => (playerId ? repos.players.get(playerId) : Promise.resolve(null)),
    [playerId],
  );
  if (playerId && existing === undefined) return null; // loading

  const base: Player = existing ?? {
    id: freshId,
    teamId,
    firstName: "",
    lastInitials: "",
    archivedAt: null,
    deleted: false,
    updatedAt: null,
  };

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await repos.players.save({
      ...base,
      firstName: formText(form, "firstName"),
      lastInitials: formText(form, "lastInitials"),
    });
    await navigate({ to: "/roster" });
  }

  async function remove() {
    // Archive keeps past stats; Phase 1 has no hard delete from the UI.
    await repos.players.save({ ...base, archivedAt: new Date().toISOString() });
    await navigate({ to: "/roster" });
  }

  return (
    <>
      <PageHeader
        title={existing ? "Edit player" : "Add player"}
        left={
          <Link to="/roster" className={ui.iconButton} aria-label="Back">
            ‹
          </Link>
        }
      />
      <form className={ui.page} onSubmit={(e) => void save(e)}>
        <TextField
          label="First name"
          name="firstName"
          defaultValue={base.firstName}
          required
          maxLength={40}
          autoComplete="off"
        />
        <TextField
          label="Last initial(s)"
          name="lastInitials"
          defaultValue={base.lastInitials}
          maxLength={10}
          autoComplete="off"
          hint="Use more letters if two players clash, e.g. “Do” and “Du”."
        />
        <Button type="submit">Save</Button>
        {existing && (
          <Button variant="danger" onClick={() => void remove()}>
            Remove from roster (keeps past stats)
          </Button>
        )}
      </form>
    </>
  );
}
