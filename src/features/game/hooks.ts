import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { z } from "zod";
import { newEventId } from "../../data/new-ids.ts";
import { repos } from "../../data/repos/index.ts";
import { displayName, type Player } from "../../data/schemas.ts";
import type { CommandContext } from "../../domain/commands.ts";
import { LineupSchema } from "../../domain/events.ts";
import type { GameId, PlayerId, TeamId } from "../../domain/ids.ts";
import { effectiveEvents } from "../../domain/log.ts";
import { lineupsEqual, type LineupDiff } from "../../domain/lineup-edit.ts";
import { POSITIONS, type Lineup } from "../../domain/positions.ts";
import { buildSegments } from "../../domain/segments.ts";
import { statsByPlayer, totalFieldMs } from "../../domain/stats.ts";

export function useCommandContext(gameId: GameId): CommandContext {
  const [ctx] = useState<CommandContext>(() => ({ gameId, newId: newEventId, now: Date.now }));
  return ctx;
}

export type Players = ReturnType<typeof playersView>;

/** All players incl. archived (history needs their names). */
export function usePlayers(teamId: TeamId) {
  return playersView(useLiveQuery(() => repos.players.all(teamId), [teamId]));
}

/** Lookup helpers over the player list (`undefined` = still loading). */
export function playersView(players: Player[] | undefined) {
  const byId = new Map<PlayerId, Player>((players ?? []).map((p) => [p.id, p]));
  const name = (id: PlayerId) => {
    const p = byId.get(id);
    return p ? displayName(p) : "?";
  };
  const roster = (players ?? []).filter((p) => p.archivedAt === null);
  return { loaded: players !== undefined, byId, name, roster };
}

/** Season field minutes (ms) per player across the team's other (non-deleted) games. */
export function useSeasonFieldMs(
  teamId: TeamId,
  excludeGameId: GameId,
): ReadonlyMap<PlayerId, number> {
  const totals = useLiveQuery(async () => {
    const gameIds = new Set((await repos.games.list(teamId)).map((g) => g.id));
    const out = new Map<PlayerId, number>();
    for (const [gameId, events] of await repos.events.byGame()) {
      if (gameId === excludeGameId || !gameIds.has(gameId)) continue;
      for (const [id, s] of statsByPlayer(buildSegments(effectiveEvents(events)))) {
        out.set(id, (out.get(id) ?? 0) + totalFieldMs(s));
      }
    }
    return out;
  }, [teamId, excludeGameId]);
  return totals ?? new Map();
}

// --- Next Up / pre-game lineup drafts: per-coach, on this device only (never synced) ---

const DraftSchema = z.object({ basedOn: z.string(), lineup: LineupSchema });
type Draft = z.infer<typeof DraftSchema>;

function readDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : DraftSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeDraft(key: string, draft: Draft | null): void {
  try {
    if (draft) localStorage.setItem(key, JSON.stringify(draft));
    else localStorage.removeItem(key);
  } catch {
    // Storage unavailable (private mode): the draft just won't survive a reload.
  }
}

/**
 * A lineup being edited on top of `base`. Survives reloads; discarded automatically
 * once `base` changes (e.g. the sub was made, or the other coach changed the lineup).
 */
export function useLineupDraft(key: string, base: Lineup) {
  const basedOn = JSON.stringify(base);
  const [stored, setStored] = useState(() => readDraft(key));
  const draft = stored && stored.basedOn === basedOn ? stored.lineup : base;

  const set = (lineup: Lineup) => {
    const next = lineupsEqual(lineup, base) ? null : { basedOn, lineup };
    setStored(next);
    writeDraft(key, next);
  };
  const reset = () => set(base);
  return { draft, set, reset, dirty: !lineupsEqual(draft, base) };
}

export function diffSummary(
  diff: LineupDiff,
  name: (id: PlayerId) => string,
  next?: Lineup,
): string[] {
  const lines: string[] = [];
  if (diff.in.length)
    lines.push(`In: ${diff.in.map((x) => `${name(x.playerId)} → ${x.position}`).join(", ")}`);
  if (diff.out.length) lines.push(`Out: ${diff.out.map((x) => name(x.playerId)).join(", ")}`);
  if (diff.moves.length) {
    lines.push(
      `Move: ${diff.moves.map((x) => `${name(x.playerId)} ${x.from}→${x.to}`).join(", ")}`,
    );
  }
  if (next) {
    const empty = POSITIONS.filter((p) => next[p] === null);
    if (empty.length) lines.push(`Empty: ${empty.join(", ")}`);
  }
  return lines;
}

/** Whole minutes; a short but real stint shows as "<1" rather than "0". */
export function minutesLabel(ms: number): string {
  if (ms <= 0) return "0";
  const m = Math.round(ms / 60_000);
  return m === 0 ? "<1" : String(m);
}

export const mins = (ms: number) => `${Math.floor(ms / 60_000)}m`;
