import { GameEventSchema, type GameEvent } from "../../domain/events.ts";
import type { TeamId } from "../../domain/ids.ts";
import type { InsertRow, Json, Row } from "../database.types.ts";
import { GameSchema, PlayerSchema, type Game, type Player } from "../schemas.ts";

// Local camelCase records <-> Postgres snake_case rows. `updated_at` /
// `inserted_at` are never sent: the server owns them.

export const playerToRow = (p: Player): InsertRow<"players"> => ({
  id: p.id,
  team_id: p.teamId,
  first_name: p.firstName,
  last_initials: p.lastInitials,
  archived_at: p.archivedAt,
  deleted: p.deleted,
});

export const rowToPlayer = (r: Row<"players">): Player =>
  PlayerSchema.parse({
    id: r.id,
    teamId: r.team_id,
    firstName: r.first_name,
    lastInitials: r.last_initials,
    archivedAt: r.archived_at,
    deleted: r.deleted,
    updatedAt: r.updated_at,
  });

export const gameToRow = (g: Game): InsertRow<"games"> => ({
  id: g.id,
  team_id: g.teamId,
  opponent: g.opponent,
  starts_at: g.startsAt,
  location: g.location,
  deleted: g.deleted,
});

export const rowToGame = (r: Row<"games">): Game =>
  GameSchema.parse({
    id: r.id,
    teamId: r.team_id,
    opponent: r.opponent,
    startsAt: r.starts_at,
    location: r.location,
    deleted: r.deleted,
    updatedAt: r.updated_at,
  });

/** Envelope fields become columns; everything else is the jsonb payload. */
export function eventToRow(e: GameEvent, teamId: TeamId): InsertRow<"game_events"> {
  const { id, gameId, createdAt, type, ...payload } = e;
  return {
    id,
    team_id: teamId,
    game_id: gameId,
    type,
    created_at: createdAt,
    payload: toJson(payload),
  };
}

export function rowToEvent(r: Row<"game_events">): GameEvent {
  const payload = isJsonObject(r.payload) ? r.payload : {};
  return GameEventSchema.parse({
    ...payload,
    id: r.id,
    gameId: r.game_id,
    createdAt: r.created_at,
    type: r.type,
  });
}

const isJsonObject = (v: Json): v is { [key: string]: Json | undefined } =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Event payloads are plain JSON data by construction (zod schemas of strings/numbers/booleans/null). */
const toJson = (v: object): Json => JSON.parse(JSON.stringify(v)) as Json; // oxlint-disable-line typescript/no-unsafe-type-assertion
