import { describe, it, expect } from "vitest";
import { NATIVE_TOOL_NAMES, DOMAIN_TEMPLATES, type ToolCatalogLike } from "@ego/subegos";
import {
  BUILTIN_DOMAINS,
  DomainRegistry,
  OFFICIAL_SUBEGO_TEMPLATES,
} from "../src/index.js";

/**
 * EGO-FIND-45 (Ola 1 / A3 / T5) — Catálogo fantasma.
 *
 * Los manifiestos de los 5 dominios y las plantillas de Sub-Ego declaraban
 * 20+ nombres de tool que NO existen en el `ToolRegistry` (solo hay 6 reales).
 * Este test recorre TODAS las declaraciones y falla si alguna tool declarada
 * no está registrada.
 *
 * `NATIVE_TOOL_NAMES` es la fuente canónica (vive en `@ego/tools` y se
 * reexporta por `@ego/subegos` porque `@ego/domains` no depende de
 * `@ego/tools`). La suite de `@ego/tools` verifica que esa lista coincide
 * exactamente con lo que `registerNativeTools` registra: no puede desviarse.
 */

function realCatalog(): ToolCatalogLike {
  return { has: (name: string) => NATIVE_TOOL_NAMES.includes(name) };
}

describe("T5 — Contrato de catálogo de tools (EGO-FIND-45)", () => {
  it("la lista canónica NATIVE_TOOL_NAMES tiene las 12 tools reales de Nivel A", () => {
    expect([...NATIVE_TOOL_NAMES].sort()).toEqual([
      "canvas_render",
      "eval_expression",
      "export_artifact",
      "fs_edit_patch",
      "fs_glob",
      "fs_grep",
      "fs_read_file",
      "fs_write_file",
      "git_diff",
      "git_session_diff",
      "git_status",
      "terminal_exec",
    ]);
  });

  it("los 5 dominios canónicos solo declaran tools que existen", () => {
    const registry = realCatalog();
    const offenders: string[] = [];

    for (const domain of Object.values(BUILTIN_DOMAINS)) {
      for (const tool of domain.tools) {
        if (!registry.has(tool)) offenders.push(`dominio '${domain.id}' → '${tool}'`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("las plantillas oficiales de Sub-Ego solo declaran tools que existen", () => {
    const registry = realCatalog();
    const offenders: string[] = [];

    for (const template of Object.values(OFFICIAL_SUBEGO_TEMPLATES)) {
      for (const tool of template.recommendedTools) {
        if (!registry.has(tool)) offenders.push(`template '${template.templateId}' → '${tool}'`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("las plantillas de dominio de @ego/subegos solo declaran tools que existen", () => {
    const registry = realCatalog();
    const offenders: string[] = [];

    for (const template of Object.values(DOMAIN_TEMPLATES)) {
      for (const tool of template.recommendedTools) {
        if (!registry.has(tool)) offenders.push(`template '${template.templateId}' → '${tool}'`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("`DomainRegistry.registerDomain` RECHAZA un dominio con tools inexistentes", () => {
    const registry = realCatalog();
    const domains = new DomainRegistry([], { toolCatalog: registry });

    expect(() =>
      domains.registerDomain({
        id: "custom",
        name: "Custom",
        description: "Dominio de prueba",
        icon: "star",
        namespaces: ["custom/*"],
        defaultSubEgoId: "ego.custom",
        subEgoTemplates: [],
        views: [{ id: "v", name: "V", componentKind: "table" }],
        tools: ["fs_read_file", "tool_que_no_existe"],
      })
    ).toThrow(/no existen en el catálogo/i);
  });

  it("`DomainRegistry.registerDomain` ACEPTA un dominio con tools reales", () => {
    const registry = realCatalog();
    const domains = new DomainRegistry([], { toolCatalog: registry });

    const ok = domains.registerDomain({
      id: "custom",
      name: "Custom",
      description: "Dominio de prueba",
      icon: "star",
      namespaces: ["custom/*"],
      defaultSubEgoId: "ego.custom",
      subEgoTemplates: [],
      views: [{ id: "v", name: "V", componentKind: "table" }],
      tools: ["fs_read_file", "fs_write_file"],
    });

    expect(ok.id).toBe("custom");
  });
});
