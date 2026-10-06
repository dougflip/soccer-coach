import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { db, getMeta, setMeta } from "../data/db.ts";
import { supabase } from "../data/supabase.ts";
import { TeamIdSchema, type TeamId } from "../domain/ids.ts";
import { Message } from "./Message.tsx";

type TeamState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "error"; message: string }
  | { status: "ready"; teamId: TeamId };

const TeamContext = createContext<TeamId | null>(null);

/** Cached locally so the app starts offline; refreshed from Supabase when possible. */
async function resolveTeam(userId: string): Promise<TeamState> {
  const cacheKey = `team:${userId}`;
  const cached = await getMeta(db, cacheKey);
  const { data, error } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId)
    .limit(1);
  if (error || !data) {
    return cached
      ? { status: "ready", teamId: TeamIdSchema.parse(cached) }
      : { status: "error", message: error?.message ?? "Couldn't load team" };
  }
  const row = data[0];
  if (!row) return { status: "none" };
  await setMeta(db, cacheKey, row.team_id);
  return { status: "ready", teamId: TeamIdSchema.parse(row.team_id) };
}

export function TeamGate({
  userId,
  email,
  children,
}: {
  userId: string;
  email: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<TeamState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void resolveTeam(userId).then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  switch (state.status) {
    case "loading":
      return null;
    case "none":
      return (
        <Message
          title="Not on a team yet"
          body={`Signed in as ${email}. Ask the team admin to add you.`}
        />
      );
    case "error":
      return <Message title="Couldn't load your team" body={state.message} />;
    case "ready":
      break;
  }
  return <TeamContext value={state.teamId}>{children}</TeamContext>;
}

/** Provide a known team directly (tests, harness). The app uses <TeamGate>. */
export function TeamIdProvider({ teamId, children }: { teamId: TeamId; children: ReactNode }) {
  return <TeamContext value={teamId}>{children}</TeamContext>;
}

export function useTeamId(): TeamId {
  const teamId = use(TeamContext);
  if (!teamId) throw new Error("useTeamId must be used inside <TeamGate>");
  return teamId;
}
