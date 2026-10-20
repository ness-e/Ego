import { describe, it, expect } from "vitest";
import { ToolRegistry, registerNativeTools, NATIVE_TOOL_NAMES } from "../src/index.js";

/**
 * EGO-FIND-45 (Ola 1 / A3 / T5).
 *
 * `NATIVE_TOOL_NAMES` es la fuente canónica del catálogo (la consumen
 * `@ego/subegos` y `@ego/domains` para validar que no se declaren tools
 * fantasma). Este test garantiza que la lista NO se desvía de lo que
 * `registerNativeTools` registra realmente.
 */
describe("NATIVE_TOOL_NAMES — catálogo canónico de tools (EGO-FIND-45)", () => {
  it("coincide exactamente con las tools registradas por `registerNativeTools`", () => {
    const registry = new ToolRegistry();
    registerNativeTools(registry, {
      workspacePath: process.cwd(),
      enableCanvas: true,
    });

    const registered = registry.list().map((t) => t.name).sort();
    expect([...NATIVE_TOOL_NAMES].sort()).toEqual(registered);
  });

  it("sin canvas, el catálogo declarado sigue siendo un superconjunto coherente", () => {
    const registry = new ToolRegistry();
    registerNativeTools(registry, { workspacePath: process.cwd(), enableCanvas: false });

    const registered = registry.list().map((t) => t.name).sort();
    // `canvas_render` es la única tool condicional.
    expect(registered).toEqual(
      [...NATIVE_TOOL_NAMES].filter((n) => n !== "canvas_render").sort()
    );
  });
});
