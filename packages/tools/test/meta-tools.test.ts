import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  ToolRegistry,
  registerMetaTools,
  META_TOOL_NAMES,
  rankSkills,
  MetaToolError,
  type SkillCatalogEntry,
  type SkillCatalogLike,
} from "../src/index.js";

/**
 * E13 (Ola 4b / A3 / T2) — Metatools con divulgación progresiva.
 *
 * Antes de esta ola el repo tenía **0 coincidencias** de `lookup_skills`,
 * `search_tools` o `expand_tools`: el catálogo de tools era fijo por
 * rol/perfil y el modelo no podía pedir "más herramientas" ni buscar una
 * skill concreta. La divulgación progresiva sustituye "volcar el catálogo
 * entero en el prompt" por "el modelo pide lo que necesita".
 *
 * Los tres son metatools del `ToolRegistry`:
 * - `lookup_skills` → busca skills en el catálogo inyectado.
 * - `search_tools`  → busca tools en el registro (resúmenes, sin schema).
 * - `expand_tools`  → expone el schema completo de un subconjunto.
 */

const SKILLS: SkillCatalogEntry[] = [
  {
    id: "git-helper",
    name: "Git Helper",
    description: "Flujo de trabajo con Git: ramas, commits y resolución de conflictos.",
    tags: ["git", "vcs"],
    path: "/skills/git-helper/SKILL.md",
    body: "Reglas detalladas de Git Helper."
  },
  {
    id: "pdf-export",
    name: "PDF Export",
    description: "Exporta documentos a PDF, DOCX, XLSX y PPTX sin dependencias externas.",
    tags: ["export", "documentos"],
    path: "/skills/pdf-export/SKILL.md",
    body: "Reglas detalladas de PDF Export."
  },
  {
    id: "unrelated",
    name: "Cocina Molecular",
    description: "Técnicas de cocina molecular y química de alimentos.",
    tags: ["cocina"]
  }
];

const CATALOG: SkillCatalogLike = {
  list: () => SKILLS
};

function registryWithTools(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register({
    name: "fs_read_file",
    description: "Lee un fichero del workspace y devuelve su contenido.",
    category: "filesystem",
    riskLevel: "safe",
    origin: "native",
    inputSchema: z.object({ path: z.string() }),
    execute: async () => "contenido"
  });
  registry.register({
    name: "fs_glob",
    description: "Lista ficheros que casan con un patrón glob.",
    category: "filesystem",
    riskLevel: "safe",
    origin: "native",
    inputSchema: z.object({ pattern: z.string() }),
    execute: async () => []
  });
  registry.register({
    name: "terminal_exec",
    description: "Ejecuta un comando en la terminal del workspace.",
    category: "terminal",
    riskLevel: "destructive",
    origin: "native",
    inputSchema: z.object({ command: z.string() }),
    execute: async () => "ok"
  });
  return registry;
}

describe("E13 — ranking de skills (motor de búsqueda)", () => {
  it("ordena por relevancia: el nombre exacto gana", () => {
    const ranked = rankSkills(SKILLS, "pdf export");

    expect(ranked[0]?.skill.id).toBe("pdf-export");
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
  });

  it("excluye las skills que no guardan relación con la consulta", () => {
    const ranked = rankSkills(SKILLS, "git");

    expect(ranked.map((r) => r.skill.id)).toEqual(["git-helper"]);
  });

  it("es determinista: mismos datos ⇒ mismo orden", () => {
    const a = rankSkills(SKILLS, "exporto documento a pdf").map((r) => r.skill.id);
    const b = rankSkills(SKILLS, "exporto documento a pdf").map((r) => r.skill.id);

    expect(a).toEqual(b);
  });
});

describe("E13 — `lookup_skills`", () => {
  it("devuelve sólo las skills relevantes, no el catálogo entero", async () => {
    const registry = new ToolRegistry();
    registerMetaTools(registry, { skills: CATALOG });

    const tool = registry.get("lookup_skills");
    if (!tool) throw new Error("lookup_skills no registrada");
    const res = (await tool.execute(
      { query: "exportar a PDF" },
      { callId: "c1", sessionId: "s1" }
    )) as { matches: Array<{ id: string }>; total: number };

    expect(res.matches.map((m) => m.id)).toEqual(["pdf-export"]);
    // El catálogo tenía 3 skills; sólo seOrtiene 1 ⇒ divulgación progresiva.
    expect(res.total).toBe(3);
  });

  it("no vuelca el cuerpo de la skill por defecto (divulgación en dos pasos)", async () => {
    const registry = new ToolRegistry();
    registerMetaTools(registry, { skills: CATALOG });
    const tool = registry.get("lookup_skills")!;

    const sinCuerpo = (await tool.execute(
      { query: "pdf" },
      { callId: "c1", sessionId: "s1" }
    )) as { matches: Array<{ body?: string }> };
    expect(sinCuerpo.matches[0]?.body).toBeUndefined();

    const conCuerpo = (await tool.execute(
      { query: "pdf", includeBody: true },
      { callId: "c2", sessionId: "s1" }
    )) as { matches: Array<{ body?: string }> };
    expect(conCuerpo.matches[0]?.body).toContain("PDF Export");
  });

  it("respeta el límite de resultados", async () => {
    const registry = new ToolRegistry();
    registerMetaTools(registry, { skills: CATALOG });
    const tool = registry.get("lookup_skills")!;

    const res = (await tool.execute(
      { query: "pdf", limit: 1 },
      { callId: "c1", sessionId: "s1" }
    )) as { matches: unknown[]; truncated: boolean };

    expect(res.matches.length).toBeLessThanOrEqual(1);
  });

  it("sin catálogo de skills configurado, falla con error TIPADO (fail-closed)", async () => {
    const registry = new ToolRegistry();
    registerMetaTools(registry, {});

    const tool = registry.get("lookup_skills")!;
    await expect(
      tool.execute({ query: "pdf" }, { callId: "c1", sessionId: "s1" })
    ).rejects.toThrow(MetaToolError);
  });
});

describe("E13 — `search_tools`", () => {
  it("encuentra tools del registro y devuelve RESÚMENES (sin schema)", async () => {
    const registry = registryWithTools();
    registerMetaTools(registry, { skills: CATALOG });
    const tool = registry.get("search_tools")!;

    const res = (await tool.execute(
      { query: "glob" },
      { callId: "c1", sessionId: "s1" }
    )) as { matches: Array<{ name: string; parameters?: unknown }> };

    expect(res.matches.map((m) => m.name)).toContain("fs_glob");
    // El schema completo es trabajo de `expand_tools`.
    expect(res.matches[0]?.parameters).toBeUndefined();
  });

  it("filtra por categoría y riesgo", async () => {
    const registry = registryWithTools();
    registerMetaTools(registry, { skills: CATALOG });
    const tool = registry.get("search_tools")!;

    const res = (await tool.execute(
      { query: "", category: "terminal" },
      { callId: "c1", sessionId: "s1" }
    )) as { matches: Array<{ name: string }> };

    expect(res.matches.map((m) => m.name)).toEqual(["terminal_exec"]);
  });
});

describe("E13 — `expand_tools`", () => {
  it("expone el schema completo de las tools solicitadas", async () => {
    const registry = registryWithTools();
    registerMetaTools(registry, { skills: CATALOG });
    const tool = registry.get("expand_tools")!;

    const res = (await tool.execute(
      { tools: ["fs_glob"] },
      { callId: "c1", sessionId: "s1" }
    )) as { tools: Array<{ name: string; parameters: Record<string, unknown> }> };

    expect(res.tools).toHaveLength(1);
    expect(res.tools[0]?.name).toBe("fs_glob");
    expect(res.tools[0]?.parameters).toBeTruthy();
  });

  it("expone por consulta de texto", async () => {
    const registry = registryWithTools();
    registerMetaTools(registry, { skills: CATALOG });
    const tool = registry.get("expand_tools")!;

    const res = (await tool.execute(
      { query: "fichero" },
      { callId: "c1", sessionId: "s1" }
    )) as { tools: Array<{ name: string }> };

    expect(res.tools.map((t) => t.name)).toContain("fs_read_file");
  });

  it("una tool inexistente se RECHAZA (fail-closed, contrato de herramientas)", async () => {
    const registry = registryWithTools();
    registerMetaTools(registry, { skills: CATALOG });
    const tool = registry.get("expand_tools")!;

    await expect(
      tool.execute({ tools: ["fs_read_file", "tool_fantasma"] }, { callId: "c1", sessionId: "s1" })
    ).rejects.toThrow(/tool_fantasma/);
  });

  it("GOBERNANZA: no expande tools fuera del registro confinado (Sub-Ego)", async () => {
    const global = registryWithTools();
    // El Sub-Ego recibe un clon confinado: sólo `fs_glob`.
    const scoped = new ToolRegistry([global.get("fs_glob")!]);
    registerMetaTools(scoped, { skills: CATALOG });

    const tool = scoped.get("expand_tools")!;
    await expect(
      tool.execute({ tools: ["terminal_exec"] }, { callId: "c1", sessionId: "s1" })
    ).rejects.toThrow(/terminal_exec/);

    const ok = (await tool.execute(
      { tools: ["fs_glob"] },
      { callId: "c2", sessionId: "s1" }
    )) as { tools: Array<{ name: string }> };
    expect(ok.tools.map((t) => t.name)).toEqual(["fs_glob"]);
  });
});

describe("E13 — `META_TOOL_NAMES` (catálogo canónico)", () => {
  it("coincide exactamente con las tools registradas por `registerMetaTools`", () => {
    const registry = new ToolRegistry();
    registerMetaTools(registry, { skills: CATALOG });

    const registered = registry.list().map((t) => t.name).sort();
    expect([...META_TOOL_NAMES].sort()).toEqual(registered);
  });

  it("registrar dos veces no duplica ni lanza", () => {
    const registry = new ToolRegistry();
    registerMetaTools(registry, { skills: CATALOG });
    registerMetaTools(registry, { skills: CATALOG });

    expect(registry.count()).toBe(META_TOOL_NAMES.length);
  });
});
