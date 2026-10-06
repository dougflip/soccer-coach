import { db, type SoccerDb } from "../db.ts";
import { eventsRepo } from "./events.ts";
import { gamesRepo } from "./games.ts";
import { playersRepo } from "./players.ts";

export function createRepos(database: SoccerDb) {
  return {
    players: playersRepo(database),
    games: gamesRepo(database),
    events: eventsRepo(database),
  };
}

export type Repos = ReturnType<typeof createRepos>;

export const repos = createRepos(db);
