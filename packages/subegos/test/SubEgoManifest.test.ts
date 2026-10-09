import { describe, it, expect } from "vitest";
import {
  createSubEgoId,
  validateSubEgoManifest,
  parseSubEgoManifest,
  validateNamespaceAccess,
  createSubEgoManifest,
  SubEgoManifestSchema
} from "../src/index.js";
import type { SubEgoManifest } from "../src/index.js";

describe("@ego/subegos — SubEgoManifest Contract Suite (SUB-01)", () => {
  it("1. Genera identificadores opacos deterministas normalizados con prefijo ego. (DSEK-03)", () => {
    expect(createSubEgoId("Auditor Técnico")).toBe("ego.auditor-tecnico");
    expect(createSubEgoId("Copywriter B2B (SaaS)")).toBe("ego.copywriter-b2b-saas");
    expect(createSubEgoId("Investigador & Analista de Datos")).toBe("ego.investigador-analista-de-datos");
    expect(createSubEgoId("   DevOps Specialist   ")).toBe("ego.devops-specialist");
  });

  it("2. Valida exitosamente un SubEgoManifest completo y canónico", () => {
    const rawManifest = {
      id: "ego.code-reviewer",
      name: "Code Reviewer",
      role: "Auditor de Arquitectura y Calidad",
      description: "Inspecciona pull requests y verifica estándares de arquitectura.",
      systemPrompt: "Eres un auditor técnico riguroso. Inspecciona cambios y verifica guardrails.",
      responsibilities: ["Revisar PRs", "Detectar vulnerabilidades", "Verificar cumplimiento de ADRs"],
      capabilities: ["ast_analysis", "git_inspection", "static_analysis"],
      tools: ["git_diff", "git_status", "read_file"],
      permissions: ["filesystem:read", "git:read"],
      namespaces: {
        read: ["kb/docs", "projects/ego/*", "egos/ego.code-reviewer/*"],
        write: ["egos/ego.code-reviewer/*", "quarantine/pending"]
      },
      behavior: {
        tone: "analytical",
        proactivity: "moderate",
        verbosity: "balanced"
      },
      autonomy: "supervised",
      budget: {
        maxTokensPerCall: 4000,
        maxDailyCostUsd: 1.5,
        requiresApprovalAboveUsd: 0.5
      },
      trigger: "manual",
      soul: {
        identitySummary: "Defensor del rigor arquitectónico y tolerancia cero a deuda técnica.",
        coreValues: ["Rigor", "Determinismo", "Seguridad"]
      },
      state: "active",
      creator: "user",
      createdAtMs: Date.now(),
      updatedAtMs: Date.now()
    };

    const validation = validateSubEgoManifest(rawManifest);
    expect(validation.success).toBe(true);

    if (validation.success) {
      const parsed = validation.data;
      expect(parsed.id).toBe("ego.code-reviewer");
      expect(parsed.behavior.tone).toBe("analytical");
      expect(parsed.autonomy).toBe("supervised");
      expect(parsed.budget.maxDailyCostUsd).toBe(1.5);
    }
  });

  it("3. Rechaza identificadores que violen el formato de IDs opacos de DSEK-03", () => {
    const invalidIdManifest = {
      id: "sin_prefijo_invalido",
      name: "Ego Inválido",
      role: "Especialista",
      description: "Descripción de prueba válida",
      systemPrompt: "Instrucciones de sistema suficientemente largas para validar",
      namespaces: { read: [], write: [] }
    };

    const result = validateSubEgoManifest(invalidIdManifest);
    expect(result.success).toBe(false);
    if (!result.success) {
      const idIssue = result.error.issues.find((issue) => issue.path.includes("id"));
      expect(idIssue).toBeDefined();
    }
  });

  it("4. Rechaza manifiestos con nombres o instrucciones excesivamente cortos", () => {
    const shortNameResult = SubEgoManifestSchema.safeParse({
      id: "ego.test",
      name: "A", // < 2 caracteres
      role: "Rol",
      description: "Descripción",
      systemPrompt: "Corto", // < 10 caracteres
      namespaces: { read: [], write: [] }
    });

    expect(shortNameResult.success).toBe(false);
  });

  it("5. Verifica acceso de lectura y escritura por namespace exacto y wildcard", () => {
    const manifest: SubEgoManifest = {
      id: "ego.analytics",
      name: "Analytics Ego",
      role: "Analista de Métricas",
      description: "Analiza métricas de producto",
      systemPrompt: "Eres un analista de métricas orientado a datos.",
      responsibilities: [],
      capabilities: [],
      tools: [],
      permissions: [],
      namespaces: {
        read: ["kb/docs", "projects/metrics/*"],
        write: ["egos/ego.analytics/*", "quarantine/pending"]
      },
      behavior: {
        tone: "analytical",
        proactivity: "reactive",
        verbosity: "concise"
      },
      autonomy: "supervised",
      budget: {
        maxTokensPerCall: 4000,
        maxDailyCostUsd: 2.0,
        requiresApprovalAboveUsd: 0.5
      },
      trigger: "manual",
      state: "active",
      creator: "user",
      createdAtMs: Date.now(),
      updatedAtMs: Date.now()
    };

    // Coincidencia exacta
    expect(validateNamespaceAccess(manifest, "kb/docs", "read")).toBe(true);
    expect(validateNamespaceAccess(manifest, "quarantine/pending", "write")).toBe(true);

    // Coincidencia con wildcard
    expect(validateNamespaceAccess(manifest, "projects/metrics/q3", "read")).toBe(true);
    expect(validateNamespaceAccess(manifest, "egos/ego.analytics/scratchpad", "write")).toBe(true);

    // Accesos no autorizados
    expect(validateNamespaceAccess(manifest, "gov/secrets", "read")).toBe(false);
    expect(validateNamespaceAccess(manifest, "kb/docs", "write")).toBe(false);
    expect(validateNamespaceAccess(manifest, "projects/other/secret", "read")).toBe(false);
  });

  it("6. createSubEgoManifest genera un manifiesto válido aplicando defaults sensatos", () => {
    const manifest = createSubEgoManifest({
      name: "Copywriter B2B",
      role: "Redactor Comercial",
      instructions: "Genera propuestas B2B persuasivas y análisis de competidores.",
      capabilities: ["copywriting", "competitor_analysis"]
    });

    expect(manifest.id).toBe("ego.copywriter-b2b");
    expect(manifest.name).toBe("Copywriter B2B");
    expect(manifest.role).toBe("Redactor Comercial");
    expect(manifest.state).toBe("active");
    expect(manifest.autonomy).toBe("supervised");
    expect(manifest.budget.maxDailyCostUsd).toBe(2.0);
    expect(manifest.budget.requiresApprovalAboveUsd).toBe(0.5);

    // Verifica que incluye el scratchpad privado en los namespaces
    expect(manifest.namespaces.read).toContain("egos/ego.copywriter-b2b/*");
    expect(manifest.namespaces.write).toContain("egos/ego.copywriter-b2b/*");
    expect(manifest.namespaces.write).toContain("quarantine/pending");
  });
});
