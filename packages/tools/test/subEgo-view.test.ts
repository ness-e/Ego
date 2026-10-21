/**
 * Ola 9 · T4 — La **vista filtrada** del registro de tools por Sub-Ego.
 *
 * ## Qué afirma (comportamiento, no texto de código)
 * 1. **Aislamiento**: un Sub-Ego NO ve la tool privada de otro.
 * 2. **Arrival tardío**: sí ve la suya, **incluso si se registra después**
 *    de creada la vista (sin reconstruir nada): el caso normal, no la
 *    excepción.
 * 3. **La E13 sigue funcionando sobre la vista**: `search_tools` devuelve
 *    resúmenes y `expand_tools` el schema completo — de la vista, no del
 *    registro global.
 * 4. **El budget por Sub-Ego refleja lo que ese Sub-Ego ve** (y no el
 *    registro global): dos Sub-Egos con declaraciones distintas ⇒
 *    presupuestos distintos y coherentes con lo que cada uno ve.
 * 5. **La regla fail-closed es explícita**: una tool CON dueño es privada;
 *    una tool SIN dueño es global (y por qué).
 * 6. **El registro global sigue siendo consultable** (la UI, la
 *    introspección y el servidor MCP lo necesitan): la vista se AÑADE, no
 *    sustituye.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

import { ToolRegistry } from "../src/ToolRegistry.js";
import {
  subEgoToolsView,
  isVisibleToSubEgo,
  resolveSubEgoToolSurface,
} from "../src/subEgoView.js";
import { registerMetaTools } from "../src/meta/metaTools.js";

function tool(name: string, description = `tool ${name}`) {
  return {
    name,
    description,
    category: "system" as const,
    riskLevel: "safe" as const,
    inputSchema: z.object({}),
    origin: "custom" as const,
    execute: async () => ({ ok: true }),
  };
}

const ctxOf = (subEgoId?: string) =>
  ({
    callId: "c1",
    sessionId: "s1",
    ...(subEgoId !== undefined ? { subEgoId } : {}),
  }) as never;

describe("Ola 9 — la vista filtrada del registro por Sub-Ego", () => {
  it("(1) un Sub-Ego NO ve la tool privada de otro", () => {
    const registry = new ToolRegistry();
    registry.register(tool("tool_compartida"));
    registry.register(tool("tool_de_antonio"), { ownerSubEgoId: "ego.antonio" });

    const view = subEgoToolsView(registry, "ego.berta");

    expect(view.has("tool_compartida"), "la global se ve").toBe(true);
    expect(view.has("tool_de_antonio"), "la privada de otro NO se ve").toBe(false);
    expect(view.list().map((t) => t.name)).toEqual(["tool_compartida"]);
    expect(view.count()).toBe(1);
  });

  it("(2) arrival tardío: ve la suya aunque se registre DESPUÉS de la vista", () => {
    const registry = new ToolRegistry();
    registry.register(tool("tool_compartida"));
    const view = subEgoToolsView(registry, "ego.antonio");

    // La tool llega TARDE (su servidor MCP se acaba de conectar).
    registry.register(tool("tool_tardia_de_antonio"), { ownerSubEgoId: "ego.antonio" });
    registry.register(tool("tool_tardia_de_berta"), { ownerSubEgoId: "ego.berta" });

    // Sin reconstruir nada: la vista ya refleja el registro vivo.
    expect(view.has("tool_tardia_de_antonio"), "la suya, llegada tarde").toBe(true);
    expect(view.has("tool_tardia_de_berta"), "la del otro, no").toBe(false);
    expect(view.count()).toBe(2); // la global + la suya
  });

  it("(3) la E13 (search_tools / expand_tools) funciona sobre la vista", async () => {
    const registry = new ToolRegistry();
    registry.register(tool("leer_fichero", "Lee un fichero del disco"));
    registry.register(tool("escribir_fichero", "Escribe un fichero en disco"), {
      ownerSubEgoId: "ego.antonio",
    });
    registerMetaTools(registry);

    const search = registry.get("search_tools")!;
    const expand = registry.get("expand_tools")!;

    // Berta: sólo la global.
    const seen = (await search.execute({ query: "fichero" }, ctxOf("ego.berta"))) as {
      matches: Array<{ name: string }>;
    };
    expect(seen.matches.map((m) => m.name)).toEqual(["leer_fichero"]);

    // Antonio: las dos.
    const seenAntonio = (await search.execute({ query: "fichero" }, ctxOf("ego.antonio"))) as {
      matches: Array<{ name: string }>;
    };
    expect(seenAntonio.matches.map((m) => m.name).sort()).toEqual([
      "escribir_fichero",
      "leer_fichero",
    ]);

    // Y el schema completo sale de la vista, con **fail-closed**: pedir la
    // tool de otro es un error, no un resultado vacío (si devolviera un
    // schema, el aislamiento sería decorativo).
    await expect(
      expand.execute({ tools: ["escribir_fichero"] }, ctxOf("ego.berta")),
    ).rejects.toThrow(/no existen/);

    // Antonio sí la ve → y recibe su schema completo.
    const expanded = (await expand.execute(
      { tools: ["escribir_fichero"] },
      ctxOf("ego.antonio"),
    )) as { expanded: string[]; tools: Array<{ parameters?: unknown }> };
    expect(expanded.expanded).toEqual(["escribir_fichero"]);
    expect(expanded.tools[0]?.parameters).toBeTruthy();
  });

  it("(4) el budget por Sub-Ego refleja lo que ese Sub-Ego ve", () => {
    const registry = new ToolRegistry();
    registry.register(tool("memoria_search"));
    registry.register(tool("web_search"));
    registry.register(tool("fs_read_file"));
    registry.register(tool("tool_privada_de_antonio"), { ownerSubEgoId: "ego.antonio" });

    const manifestDe = (id: string, tools: string[]) =>
      ({ id, tools }) as never;

    const surfaceBerta = resolveSubEgoToolSurface({
      subEgoId: "ego.berta",
      declaredTools: ["memoria_search", "web_search", "tool_privada_de_antonio"],
      view: subEgoToolsView(registry, "ego.berta"),
    });
    // Declaró 3, pero una es de otro → su presupuesto es 2 (lo que ve y usa).
    expect(surfaceBerta.tools).toEqual(["memoria_search", "web_search"]);
    expect(surfaceBerta.missing).toEqual(["tool_privada_de_antonio"]);
    expect(surfaceBerta.budget).toBe(2);

    const surfaceAntonio = resolveSubEgoToolSurface({
      subEgoId: "ego.antonio",
      declaredTools: ["memoria_search", "tool_privada_de_antonio"],
      view: subEgoToolsView(registry, "ego.antonio"),
    });
    expect(surfaceAntonio.tools.sort()).toEqual([
      "memoria_search",
      "tool_privada_de_antonio",
    ]);
    expect(surfaceAntonio.budget).toBe(2);
    // Y NO es el registro global (que tiene 4).
    expect(surfaceBerta.budget).not.toBe(registry.count());
  });

  it("(5) la regla fail-closed es explícita: con dueño es privada, sin dueño es global", () => {
    const conDueño = { ...tool("x"), ownerSubEgoId: "ego.antonio" };
    const sinDueño = tool("y");

    expect(isVisibleToSubEgo(conDueño, "ego.antonio")).toBe(true);
    expect(isVisibleToSubEgo(conDueño, "ego.berta")).toBe(false);
    // Sin dueño → global (regla explícita; el agujero de aislamiento está
    // documentado en `subEgoView.ts`).
    expect(isVisibleToSubEgo(sinDueño, "ego.berta")).toBe(true);
    expect(isVisibleToSubEgo(sinDueño, "ego.antonio")).toBe(true);
  });

  it("(6) el registro GLOBAL sigue siendo consultable (la vista se añade, no sustituye)", () => {
    const registry = new ToolRegistry();
    registry.register(tool("tool_compartida"));
    registry.register(tool("tool_de_antonio"), { ownerSubEgoId: "ego.antonio" });

    // La introspección (la UI, el servidor MCP) ve el catálogo completo.
    expect(registry.count()).toBe(2);
    expect(registry.has("tool_de_antonio")).toBe(true);
    expect(registry.list().map((t) => t.name).sort()).toEqual([
      "tool_compartida",
      "tool_de_antonio",
    ]);
    // Y la vista es sólo una proyección de él.
    expect(subEgoToolsView(registry, "ego.berta").count()).toBe(1);
  });
});
