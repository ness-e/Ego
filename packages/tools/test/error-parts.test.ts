import { describe, it, expect } from "vitest";
import { getErrorParts } from "../src/error-parts.js";

/**
 * F6T13/L10 — `unknown` + narrowing centralizado para extracción segura
 * de partes de error (message/code/stack/name) sin `any`.
 */
describe("@ego/tools — getErrorParts (F6T13/L10)", () => {
  it("extrae message de una instancia Error", () => {
    const parts = getErrorParts(new Error("fallo base"));
    expect(parts.message).toBe("fallo base");
    expect(parts.name).toBe("Error");
    expect(typeof parts.stack === "string" || parts.stack === undefined).toBe(true);
  });

  it("no lanza ante valores no-Error (string, null, undefined, objeto plano)", () => {
    expect(getErrorParts("texto plano").message).toBe("texto plano");
    expect(getErrorParts(null).message).toBe("null");
    expect(getErrorParts(undefined).message).toBe("undefined");
    expect(getErrorParts(42).message).toBe("42");
    expect(() => getErrorParts(null)).not.toThrow();
    expect(() => getErrorParts(undefined)).not.toThrow();
  });

  it("extrae code de errores tipo NodeJS (ENOENT) sin acceder con `any`", () => {
    const err = Object.assign(new Error("no existe"), { code: "ENOENT" });
    const parts = getErrorParts(err);
    expect(parts.code).toBe("ENOENT");
    expect(parts.message).toBe("no existe");
  });

  it("serializa objetos planos sin message a JSON legible", () => {
    const parts = getErrorParts({ reason: "x" });
    expect(parts.message).toContain("reason");
  });
});
