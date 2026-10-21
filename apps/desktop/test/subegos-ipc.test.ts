import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CreateSubEgoSchema, ToggleSubEgoStateSchema } from "../src/ipc/schema.js";
import { EgoMemoryAdapter } from "@ego/memory";
import { SubEgoRegistry, SubEgoFactory, SubEgoSystemImmutableError } from "@ego/subegos";
import { createScratchDir, removeScratchDir } from "./helpers/test-scratch.js";

describe("@ego/desktop — Sub-Egos UI Integration & Multi-Modal Factory (INT-04, SUB-08)", () => {
  let tmpDir: string;
  let adapter: EgoMemoryAdapter;
  let registry: SubEgoRegistry;

  beforeEach(async () => {
    tmpDir = createScratchDir("ego-subegos-test");
    adapter = new EgoMemoryAdapter(tmpDir);
    await adapter.init();
    registry = new SubEgoRegistry(adapter);
  });

  afterEach(async () => {
    try {
      await adapter.close();
      removeScratchDir(tmpDir);
    } catch {
      // ignore
    }
  });

  describe("1. Validación de Esquemas Zod (INT-04)", () => {
    it("Valida creación en modo 'custom' con presupuesto", () => {
      const valid = CreateSubEgoSchema.safeParse({
        mode: "custom",
        name: "Sub-Ego Auditor",
        role: "Auditoría de Procesos",
        instructions: "Audita cumplimiento de políticas de seguridad.",
        tools: ["memory_recall"],
        budget: {
          maxTokensPerCall: 4000,
          maxDailyCostUsd: 1.5,
        },
      });
      expect(valid.success).toBe(true);
    });

    it("Valida creación en modo 'template' con templateId", () => {
      const valid = CreateSubEgoSchema.safeParse({
        mode: "template",
        templateId: "developer",
        name: "Mi Dev Personal",
      });
      expect(valid.success).toBe(true);
    });

    it("Valida creación en modo 'declaration' (JSON o YAML)", () => {
      const validJson = CreateSubEgoSchema.safeParse({
        mode: "declaration",
        format: "json",
        rawText: '{"name": "Sub-Ego Test", "role": "Test Role", "instructions": "Test instructions longer than 10 chars"}',
      });
      expect(validJson.success).toBe(true);

      const validYaml = CreateSubEgoSchema.safeParse({
        mode: "declaration",
        format: "yaml",
        rawText: "name: Sub-Ego Test\nrole: Test Role\ninstructions: Instructions longer than 10 chars",
      });
      expect(validYaml.success).toBe(true);
    });

    it("Valida ToggleSubEgoStateSchema para conmutar estado", () => {
      const valid = ToggleSubEgoStateSchema.safeParse({
        subEgoId: "ego.dev",
        state: "paused",
      });
      expect(valid.success).toBe(true);

      const invalidState = ToggleSubEgoStateSchema.safeParse({
        subEgoId: "ego.dev",
        state: "dormant",
      });
      expect(invalidState.success).toBe(false);
    });
  });

  describe("2. SubEgoFactory — Modalidades Canónicas (SUB-02 / INT-04)", () => {
    it("Obtiene la lista de plantillas de dominio oficiales", () => {
      const templates = SubEgoFactory.listTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(4);
      const codeReviewerTpl = templates.find((t) => t.templateId === "code_reviewer");
      expect(codeReviewerTpl).toBeDefined();
      expect(codeReviewerTpl?.name).toBe("Revisor de Código");
    });

    it("Instancia un Sub-Ego formal a partir de una plantilla", () => {
      const manifest = SubEgoFactory.fromTemplate("code_reviewer", {
        name: "Dev Senior Reviewer",
      });
      expect(manifest.id).toBeDefined();
      expect(manifest.name).toBe("Dev Senior Reviewer");
      // A3 / EGO-FIND-45: la plantilla declara SOLO tools reales del
      // catálogo (`NATIVE_TOOL_NAMES`). Antes afirmaba `ast_linter`, que
      // nunca existió como tool registrada (catálogo fantasma).
      expect(manifest.tools).toContain("git_status");
      expect(manifest.tools).not.toContain("ast_linter");
      expect(manifest.creator).toBe("template");
    });

    it("Parsea e importa un Sub-Ego desde declaración JSON válida", () => {
      const rawJson = JSON.stringify({
        name: "Ego Data Analyst",
        role: "Análisis de Datos",
        instructions: "Procesa y analiza métricas operativas con rigor.",
        tools: ["memory_recall"],
      });

      const manifest = SubEgoFactory.fromRawDeclaration(rawJson, "json");
      expect(manifest.name).toBe("Ego Data Analyst");
      expect(manifest.role).toBe("Análisis de Datos");
    });
  });

  describe("3. SubEgoRegistry — Persistencia y Ciclo de Vida (SUB-07 / SUB-08)", () => {
    it("Registra y recupera Sub-Ego en gov/sub_egos", async () => {
      const manifest = SubEgoFactory.fromTemplate("researcher", {
        name: "Ego Researcher Custom",
      });

      await registry.register(manifest);

      const retrieved = await registry.get(manifest.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("Ego Researcher Custom");

      const list = await registry.list();
      expect(list.some((s) => s.id === manifest.id)).toBe(true);
    });

    it("Permite alternar estado activo/pausado de un Sub-Ego de usuario", async () => {
      const manifest = SubEgoFactory.fromTemplate("planner", {
        name: "Ego Planner Custom",
      });

      await registry.register(manifest);

      const paused = await registry.disable(manifest.id);
      expect(paused.state).toBe("paused");

      const reEnabled = await registry.enable(manifest.id);
      expect(reEnabled.state).toBe("active");
    });

    it("Protege la inmutabilidad de 'ego.nucleus' impidiendo su mutación", async () => {
      const fakeNucleus = SubEgoFactory.fromTemplate("researcher", {
        name: "Núcleo Impostor",
      });
      // Forzar id de sistema y creador 'user'
      fakeNucleus.id = "ego.nucleus";
      fakeNucleus.creator = "user";

      await expect(registry.register(fakeNucleus)).rejects.toThrow(SubEgoSystemImmutableError);
    });
  });
});
