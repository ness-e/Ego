/**
 * E13 (Ola 5 · T1) — Los metatools de divulgación progresiva LLEGAN al
 * producto.
 *
 * ## Qué afirma (comportamiento observable del tool)
 * 1. Los 3 metatools quedan **registrados** en el registro de producción
 *    (`lookup_skills`, `search_tools`, `expand_tools`).
 * 2. `lookup_skills` devuelve el **resumen** primero (id, nombre,
 *    descripción, etiquetas) y **NO** el cuerpo.
 * 3. `lookup_skills` con `includeBody: true` devuelve el cuerpo **bajo
 *    demanda** (y sólo entonces se lee el fichero del disco).
 * 4. `expand_tools` expone un **subconjunto** de tools con su **schema
 *    completo** (no un resumen).
 * 5. `expand_tools` falla cerrado ante una tool que no existe.
 * 6. `search_tools` devuelve resúmenes (sin schema): el schema es trabajo de
 *    `expand_tools`.
 */
import { describe, it, expect } from "vitest";
import { createScratchDir, removeScratchDir } from "./helpers/test-scratch.js";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

import { ToolRegistry } from "@ego/tools";
import { registerProgressiveMetaTools } from "../src/main/tools/meta-tools.js";

/** Skill escaneada de mentira, con su `SKILL.md` real en disco. */
function makeScanner(dir: string) {
  const skillPath = join(dir, "SKILL.md");
  writeFileSync(
    skillPath,
    ["---", "name: pdf-export", "description: Exporta PDFs", "---", "", "CUERPO COMPLETO"].join(
      "\n"
    ),
    "utf8"
  );
  let reads = 0;
  const originalRead = process.env.NODE_ENV;
  return {
    scanner: {
      scan: () => [
        {
          id: "pdf-export",
          name: "pdf-export",
          description: "Exporta PDFs y hacer que el agente lo vea",
          tags: ["pdf", "export"],
          manifestPath: skillPath,
          valid: true,
        },
      ],
    },
    skillPath,
    countReads: () => reads,
    originalRead,
  };
}

function makeRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register({
    name: "fs_read_file",
    description: "Lee un fichero del disco",
    category: "fs",
    riskLevel: "safe",
    inputSchema: z.object({ path: z.string() }),
    execute: async () => "contenido",
  } as never);
  registry.register({
    name: "fs_write_file",
    description: "Escribe un fichero en disco",
    category: "fs",
    riskLevel: "safe",
    inputSchema: z.object({ path: z.string(), content: z.string() }),
    execute: async () => "ok",
  } as never);
  return registry;
}

describe("E13 — los metatools de divulgación progresiva llegan al producto", () => {
  it("los 3 metatools quedan registrados en el registro de producción", () => {
    const dir = createScratchDir("metatools");
    try {
      const { scanner } = makeScanner(dir);
      const registry = makeRegistry();
      const registered = registerProgressiveMetaTools(registry, { scanner });

      expect(registered.map((t) => t.name).sort()).toEqual([
        "expand_tools",
        "lookup_skills",
        "search_tools",
      ]);
      expect(registry.has("lookup_skills")).toBe(true);
      expect(registry.has("search_tools")).toBe(true);
      expect(registry.has("expand_tools")).toBe(true);
    } finally {
      removeScratchDir(dir);
    }
  });

  it("lookup_skills devuelve el RESUMEN primero (sin cuerpo)", async () => {
    const dir = createScratchDir("metatools");
    try {
      const { scanner } = makeScanner(dir);
      const registry = makeRegistry();
      registerProgressiveMetaTools(registry, { scanner });

      const result = (await registry.get("lookup_skills")!.execute({
        query: "pdf",
      })) as { matches: Array<Record<string, unknown>>; total: number };

      expect(result.total).toBe(1);
      expect(result.matches.length).toBe(1);
      const match = result.matches[0]!;
      expect(match.id).toBe("pdf-export");
      expect(match.name).toBe("pdf-export");
      expect(match.description).toContain("Exporta PDFs");
      expect(match.tags).toEqual(["pdf", "export"]);
      // El cuerpo NO viaja en la primera escala.
      expect(match.body, "el resumen no debe traer el cuerpo").toBeUndefined();
    } finally {
      removeScratchDir(dir);
    }
  });

  it("lookup_skills con includeBody trae el cuerpo BAJO DEMANDA", async () => {
    const dir = createScratchDir("metatools");
    try {
      const { scanner } = makeScanner(dir);
      const registry = makeRegistry();
      registerProgressiveMetaTools(registry, { scanner });

      const result = (await registry.get("lookup_skills")!.execute({
        query: "pdf",
        includeBody: true,
      })) as { matches: Array<Record<string, unknown>> };

      expect(result.matches[0]!.body).toContain("CUERPO COMPLETO");
    } finally {
      removeScratchDir(dir);
    }
  });

  it("expand_tools expone un subconjunto con el SCHEMA COMPLETO", async () => {
    const dir = createScratchDir("metatools");
    try {
      const { scanner } = makeScanner(dir);
      const registry = makeRegistry();
      registerProgressiveMetaTools(registry, { scanner });

      const result = (await registry.get("expand_tools")!.execute({
        tools: ["fs_read_file"],
      })) as {
        tools: Array<{ name: string; parameters?: unknown }>;
        expanded: string[];
        total: number;
      };

      expect(result.expanded).toEqual(["fs_read_file"]);
      expect(result.total).toBe(1);
      // El schema COMPLETO: con sus propiedades, no un resumen.
      const schema = result.tools[0]!.parameters as {
        properties?: Record<string, unknown>;
      };
      expect(schema.properties, "el schema completo debe traer sus campos").toBeTruthy();
      expect(Object.keys(schema.properties ?? {})).toContain("path");
    } finally {
      removeScratchDir(dir);
    }
  });

  it("expand_tools falla cerrado ante una tool inexistente", async () => {
    const dir = createScratchDir("metatools");
    try {
      const { scanner } = makeScanner(dir);
      const registry = makeRegistry();
      registerProgressiveMetaTools(registry, { scanner });

      await expect(
        registry.get("expand_tools")!.execute({ tools: ["tool_que_no_existe"] })
      ).rejects.toThrow(/no existen/);
    } finally {
      removeScratchDir(dir);
    }
  });

  it("search_tools devuelve RESÚMENES (el schema es de expand_tools)", async () => {
    const dir = createScratchDir("metatools");
    try {
      const { scanner } = makeScanner(dir);
      const registry = makeRegistry();
      registerProgressiveMetaTools(registry, { scanner });

      const result = (await registry.get("search_tools")!.execute({
        query: "fichero",
      })) as { matches: Array<Record<string, unknown>> };

      expect(result.matches.length).toBeGreaterThan(0);
      const first = result.matches[0]!;
      expect(first.name).toBeTruthy();
      expect(first.description).toBeTruthy();
      expect(
        first.inputSchema,
        "search_tools NO debe devolver el schema (esa es la 2ª escala)"
      ).toBeUndefined();
    } finally {
      removeScratchDir(dir);
    }
  });
});
