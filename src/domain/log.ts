import type { EventId } from "./ids.ts";
import type { EventOf, GameEvent } from "./events.ts";
import { compareGameTime, type GameTime } from "./time.ts";

/**
 * Drop voided events (and the void markers themselves). A void can target
 * another void ("undo the undo"), so an event is effective unless an
 * *effective* void targets it.
 */
export function effectiveEvents(events: readonly GameEvent[]): GameEvent[] {
  const voidsByTarget = new Map<EventId, EventOf<"event_voided">[]>();
  for (const e of events) {
    if (e.type !== "event_voided") continue;
    const list = voidsByTarget.get(e.targetId) ?? [];
    list.push(e);
    voidsByTarget.set(e.targetId, list);
  }

  const memo = new Map<EventId, boolean>();
  const visiting = new Set<EventId>();
  const isEffective = (id: EventId): boolean => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return true; // malformed cycle: ignore the void
    visiting.add(id);
    const voids = voidsByTarget.get(id) ?? [];
    const result = !voids.some((v) => isEffective(v.id));
    visiting.delete(id);
    memo.set(id, result);
    return result;
  };

  return events.filter((e) => e.type !== "event_voided" && isEffective(e.id));
}

/** Events that change who is where (as opposed to clock control). */
export type StateEvent = EventOf<"presence_set" | "lineup_set" | "availability_set">;

export function isStateEvent(e: GameEvent): e is StateEvent {
  return e.type === "presence_set" || e.type === "lineup_set" || e.type === "availability_set";
}

/** Pre-game attendance sorts before everything else. */
const PREGAME: GameTime = { period: 0, ms: 0 };

export function stateEventTime(e: StateEvent): GameTime {
  return e.at ?? PREGAME;
}

/** Game-clock order; recording order breaks ties (later recording wins). */
export function compareStateEvents(a: StateEvent, b: StateEvent): number {
  return (
    compareGameTime(stateEventTime(a), stateEventTime(b)) ||
    a.createdAt - b.createdAt ||
    a.id.localeCompare(b.id)
  );
}

export function sortedStateEvents(effective: readonly GameEvent[]): StateEvent[] {
  return effective.filter(isStateEvent).toSorted(compareStateEvents);
}
