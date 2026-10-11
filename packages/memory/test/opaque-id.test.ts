import { describe, it, expect } from "vitest";
import { generateOpaqueId, parseOpaqueId, isOpaqueId } from "../OpaqueId.js";

describe("OpaqueId — Identificadores Opacos Canónicos (DSEK-03)", () => {
  it("genera un ID con prefijo por defecto 'sess' y formato válido", () => {
    const id = generateOpaqueId();
    expect(id.startsWith("sess_")).toBe(true);

    const parsed = parseOpaqueId(id);
    expect(parsed.isValid).toBe(true);
    expect(parsed.prefix).toBe("sess");
    expect(parsed.timestamp).toBeGreaterThan(0);
    expect(parsed.entropy.length).toBe(12);
  });

  it("admite prefijos canónicos definidos en el contrato", () => {
    const prefixes = ["turn", "step", "call", "art", "snap", "msg", "sub", "task"] as const;
    for (const prefix of prefixes) {
      const id = generateOpaqueId(prefix);
      expect(isOpaqueId(id, prefix)).toBe(true);
      const parsed = parseOpaqueId(id);
      expect(parsed.isValid).toBe(true);
      expect(parsed.prefix).toBe(prefix);
    }
  });

  it("mantiene orden lexicográfico cronológico para IDs generados en secuencia", async () => {
    const id1 = generateOpaqueId("sess");
    // Esperar un instante para garantizar incremento de timestamp
    await new Promise((resolve) => setTimeout(resolve, 15));
    const id2 = generateOpaqueId("sess");

    expect(id1 < id2).toBe(true);

    const parsed1 = parseOpaqueId(id1);
    const parsed2 = parseOpaqueId(id2);
    expect(parsed2.timestamp).toBeGreaterThanOrEqual(parsed1.timestamp);
  });

  it("rechaza IDs malformados o con formatos corruptos", () => {
    expect(isOpaqueId("invalid_id")).toBe(false);
    expect(isOpaqueId("")).toBe(false);
    expect(isOpaqueId("sess_123_abc")).toBe(false); // timestamp/entropía muy cortos
    expect(isOpaqueId("sess_abcdefgh_123456789012345678901")).toBe(false); // entropía demasiado larga

    const parsed = parseOpaqueId("corrupt_string");
    expect(parsed.isValid).toBe(false);
    expect(parsed.prefix).toBe("");
    expect(parsed.timestamp).toBe(0);
  });
});
