import { EventIdSchema, GameIdSchema, PlayerIdSchema } from "../domain/ids.ts";

/**
 * RFC 4122 v4 UUID. `crypto.randomUUID` only exists in secure contexts (HTTPS /
 * localhost), so fall back to `getRandomValues`, which works everywhere (e.g. a
 * phone hitting the dev server over LAN http).
 */
export function uuidv4(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40; // version 4
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Client-generated IDs (offline creates). Parsed so they carry their brand.
export const newPlayerId = () => PlayerIdSchema.parse(uuidv4());
export const newGameId = () => GameIdSchema.parse(uuidv4());
export const newEventId = () => EventIdSchema.parse(uuidv4());
