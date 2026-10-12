import { describe, it, expect } from "vitest";
import { unwrapMetadata } from "../unwrapMetadata.js";

describe("unwrapMetadata", () => {
  it("desenvuelve {Float:v} a número", () => {
    expect(unwrapMetadata({ ts: { Float: 1.5 } })).toEqual({ ts: 1.5 });
  });

  it("desenvuelve {String:v} a string", () => {
    expect(unwrapMetadata({ state: { String: "active" } })).toEqual({ state: "active" });
  });

  it("desenvuelve {Bool:v} a boolean", () => {
    expect(unwrapMetadata({ flag: { Bool: true } })).toEqual({ flag: true });
  });

  it('convierte "Null" a null', () => {
    expect(unwrapMetadata({ gone: "Null" })).toEqual({ gone: null });
  });

  it("pasa objeto anidado sin tag tal cual", () => {
    const nested = { a: 1, b: [1, 2] };
    expect(unwrapMetadata({ obj: nested })).toEqual({ obj: nested });
  });

  it("retorna {} si tagged es undefined o null", () => {
    expect(unwrapMetadata(undefined)).toEqual({});
    expect(unwrapMetadata(null)).toEqual({});
  });

  it("retorna {} si la entrada es un objeto vacío o clave ausente", () => {
    expect(unwrapMetadata({})).toEqual({});
  });

  it("pasa valor crudo legacy (número/string/bool directo) tal cual", () => {
    expect(unwrapMetadata({ n: 42, s: "crudo", b: false })).toEqual({
      n: 42,
      s: "crudo",
      b: false,
    });
  });
});
