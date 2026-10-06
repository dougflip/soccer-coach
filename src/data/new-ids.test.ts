import { describe, expect, it } from "vitest";
import { PlayerIdSchema } from "../domain/ids.ts";
import { uuidv4 } from "./new-ids.ts";

describe("uuidv4", () => {
  it("falls back to getRandomValues when randomUUID is unavailable (insecure context)", () => {
    // Shadow the prototype method with an own property, as in non-secure contexts.
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      const ids = Array.from({ length: 50 }, uuidv4);
      for (const id of ids) expect(PlayerIdSchema.safeParse(id).success).toBe(true);
      expect(new Set(ids).size).toBe(50);
    } finally {
      Reflect.deleteProperty(crypto, "randomUUID");
    }
    expect(typeof crypto.randomUUID).toBe("function");
  });
});
