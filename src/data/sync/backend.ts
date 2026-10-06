import type { SupabaseClient } from "@supabase/supabase-js";
import type { TeamId } from "../../domain/ids.ts";
import type { Database, InsertRow, Row } from "../database.types.ts";

/**
 * The only server operations sync needs. Kept as an interface so the engine is
 * tested against an in-memory fake.
 */
export type SyncBackend = {
  upsertPlayers: (rows: InsertRow<"players">[]) => Promise<void>;
  upsertGames: (rows: InsertRow<"games">[]) => Promise<void>;
  /** Idempotent: rows whose id already exists are ignored (events are immutable). */
  insertEvents: (rows: InsertRow<"game_events">[]) => Promise<void>;
  /** Rows with cursor column >= `since` (all if null), ascending, at most `limit`. */
  pullPlayers: (teamId: TeamId, since: string | null, limit: number) => Promise<Row<"players">[]>;
  pullGames: (teamId: TeamId, since: string | null, limit: number) => Promise<Row<"games">[]>;
  pullEvents: (
    teamId: TeamId,
    since: string | null,
    limit: number,
  ) => Promise<Row<"game_events">[]>;
};

type Result<T> = { data: T | null; error: { message: string } | null };

function unwrap<T>({ data, error }: Result<T>): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("No data returned");
  return data;
}

function check({ error }: { error: { message: string } | null }): void {
  if (error) throw new Error(error.message);
}

export function supabaseBackend(client: SupabaseClient<Database>): SyncBackend {
  return {
    async upsertPlayers(rows) {
      check(await client.from("players").upsert(rows));
    },
    async upsertGames(rows) {
      check(await client.from("games").upsert(rows));
    },
    async insertEvents(rows) {
      check(
        await client.from("game_events").upsert(rows, { onConflict: "id", ignoreDuplicates: true }),
      );
    },
    async pullPlayers(teamId, since, limit) {
      let q = client.from("players").select("*").eq("team_id", teamId);
      if (since) q = q.gte("updated_at", since);
      return unwrap(await q.order("updated_at").limit(limit));
    },
    async pullGames(teamId, since, limit) {
      let q = client.from("games").select("*").eq("team_id", teamId);
      if (since) q = q.gte("updated_at", since);
      return unwrap(await q.order("updated_at").limit(limit));
    },
    async pullEvents(teamId, since, limit) {
      let q = client.from("game_events").select("*").eq("team_id", teamId);
      if (since) q = q.gte("inserted_at", since);
      return unwrap(await q.order("inserted_at").limit(limit));
    },
  };
}
