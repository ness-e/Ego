import { describe, it, expect } from "vitest";
import { z } from "zod";
import { zodToJsonSchema } from "../src/schema-converter.js";

/**
 * F6T13/L04 — ramas honestas ZodLiteral / ZodDate / ZodTuple.
 * Antes caían al fallback `{type:'object'}` y el modelo recibía schemas mentirosos.
 */
describe("@ego/tools — zodToJsonSchema L04", () => {
  it("convierte ZodLiteral a const con su tipo", () => {
    expect(zodToJsonSchema(z.literal("exacto"))).toEqual({
      type: "string",
      const: "exacto"
    });
    expect(zodToJsonSchema(z.literal(7))).toEqual({ type: "number", const: 7 });
    expect(zodToJsonSchema(z.literal(true))).toEqual({ type: "boolean", const: true });
  });

  it("convierte ZodDate a string date-time", () => {
    expect(zodToJsonSchema(z.date())).toEqual({ type: "string", format: "date-time" });
  });

  it("convierte ZodTuple a array con prefixItems y aridad exacta", () => {
    expect(zodToJsonSchema(z.tuple([z.string(), z.number()]))).toEqual({
      type: "array",
      prefixItems: [{ type: "string" }, { type: "number" }],
      minItems: 2,
      maxItems: 2
    });
  });

  it("propaga literal/date/tuple dentro de objetos (round-trip de herramienta)", () => {
    const out = zodToJsonSchema(
      z.object({
        modo: z.literal("rapido"),
        cuando: z.date().optional(),
        par: z.tuple([z.string(), z.boolean()])
      })
    ) as { properties: Record<string, Record<string, unknown>>; required: string[] };
    expect(out.properties.modo).toEqual({ type: "string", const: "rapido" });
    expect(out.properties.cuando).toEqual({ type: "string", format: "date-time" });
    expect(out.properties.par.type).toBe("array");
    expect(out.required).toEqual(["modo", "par"]);
  });
});
