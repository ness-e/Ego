import { describe, it, expect } from "vitest";
import {
  SubEgoFactory,
  UnknownSubEgoTemplateError,
  SubEgoDeclarationSyntaxError,
  SubEgoManifestValidationError,
  validateNamespaceAccess
} from "../src/index.js";

describe("SubEgoFactory — Fábrica Inteligente de Sub-Egos (SUB-02)", () => {
  describe("Modalidad 1: Conversacional Interactiva", () => {
    it("debe avanzar por los pasos del diálogo y generar un manifiesto canónico", () => {
      const session = SubEgoFactory.startConversationalSession();

      expect(session.getStep()).toBe("role");
      expect(session.isComplete()).toBe(false);

      // Paso 1: Rol
      session.submitAnswer("Auditor de Seguridad");
      expect(session.getStep()).toBe("name");

      // Paso 2: Nombre
      session.submitAnswer("Centinela Defensivo");
      expect(session.getStep()).toBe("responsibilities");

      // Paso 3: Responsabilidades
      session.submitAnswer("Detección de vulnerabilidades, Análisis de dependencias");
      expect(session.getStep()).toBe("tools");

      // Paso 4: Herramientas
      session.submitAnswer("memory_recall, dependency_scanner");
      expect(session.getStep()).toBe("autonomy");

      // Paso 5: Autonomía
      session.submitAnswer("semi-autonomous");
      expect(session.getStep()).toBe("budget");

      // Paso 6: Presupuesto
      session.submitAnswer("5.0");
      expect(session.getStep()).toBe("ready");
      expect(session.isComplete()).toBe(true);

      const manifest = session.buildManifest();
      expect(manifest.id).toBe("ego.centinela-defensivo");
      expect(manifest.name).toBe("Centinela Defensivo");
      expect(manifest.role).toBe("Auditor de Seguridad");
      expect(manifest.responsibilities).toContain("Detección de vulnerabilidades");
      expect(manifest.tools).toContain("dependency_scanner");
      expect(manifest.tools).toContain("memory_recall");
      expect(manifest.autonomy).toBe("semi-autonomous");
      expect(manifest.budget.maxDailyCostUsd).toBe(5.0);
      expect(manifest.creator).toBe("user");
      expect(manifest.state).toBe("active");

      // Verificar aislamiento perimetral por defecto en namespaces
      expect(validateNamespaceAccess(manifest, "egos/ego.centinela-defensivo/scratchpad", "write")).toBe(true);
      expect(validateNamespaceAccess(manifest, "egos/ego.otro/scratchpad", "write")).toBe(false);
    });

    it("debe inicializar el flujo directo si se proporciona un prompt inicial", () => {
      const session = SubEgoFactory.startConversationalSession("Especialista en Finanzas");
      expect(session.getStep()).toBe("responsibilities");
      expect(session.getCollectedInput().role).toBe("Especialista en Finanzas");
    });
  });

  describe("Modalidad 2: Plantillas por Dominio (HERM-12)", () => {
    it("debe listar todas las plantillas canónicas de dominio", () => {
      const templates = SubEgoFactory.listTemplates();
      expect(templates.length).toBe(5);

      const ids = templates.map((t) => t.templateId);
      expect(ids).toContain("researcher");
      expect(ids).toContain("code_reviewer");
      expect(ids).toContain("copywriter");
      expect(ids).toContain("analyst");
      expect(ids).toContain("planner");
    });

    it("debe instanciar un Sub-Ego a partir de la plantilla 'researcher'", () => {
      const manifest = SubEgoFactory.fromTemplate("researcher");

      expect(manifest.id).toBe("ego.investigador-cognitivo");
      expect(manifest.name).toBe("Investigador Cognitivo");
      expect(manifest.role).toBe("Investigador y Analista de Fuentes");
      expect(manifest.tools).toContain("web_search");
      expect(manifest.tools).toContain("memory_recall");
      expect(manifest.creator).toBe("template");
      expect(manifest.budget.maxDailyCostUsd).toBe(3.0);
    });

    it("debe aplicar overrides sobre una plantilla existente", () => {
      const manifest = SubEgoFactory.fromTemplate("code_reviewer", {
        name: "Auditor Rust",
        budget: {
          maxDailyCostUsd: 10.0,
          maxTokensPerCall: 8000,
          requiresApprovalAboveUsd: 1.0
        }
      });

      expect(manifest.id).toBe("ego.auditor-rust");
      expect(manifest.name).toBe("Auditor Rust");
      expect(manifest.role).toBe("Auditor Técnico de Calidad y Arquitectura");
      expect(manifest.budget.maxDailyCostUsd).toBe(10.0);
      expect(manifest.budget.maxTokensPerCall).toBe(8000);
    });

    it("debe lanzar UnknownSubEgoTemplateError ante una plantilla inexistente", () => {
      expect(() => {
        SubEgoFactory.fromTemplate("plantilla_desconocida");
      }).toThrow(UnknownSubEgoTemplateError);
    });
  });

  describe("Modalidad 3: Declaración Declarativa JSON / YAML", () => {
    it("debe instanciar un Sub-Ego desde un JSON simplificado", () => {
      const jsonStr = JSON.stringify({
        name: "Optimizador de Consultas",
        role: "Database Specialist",
        instructions: "Optimiza consultas complejas en bases de datos relacionales y VantaDB.",
        tools: ["memory_recall", "query_explainer"],
        autonomy: "supervised"
      });

      const manifest = SubEgoFactory.fromRawDeclaration(jsonStr, "json");
      expect(manifest.id).toBe("ego.optimizador-de-consultas");
      expect(manifest.name).toBe("Optimizador de Consultas");
      expect(manifest.tools).toContain("query_explainer");
      expect(manifest.autonomy).toBe("supervised");
    });

    it("debe instanciar un Sub-Ego desde una declaración YAML", () => {
      const yamlStr = `
name: Centinela de Logs
role: Observability Specialist
instructions: Monitorea logs y analiza anomalías en streaming.
tools:
  - memory_recall
  - log_parser
autonomy: semi-autonomous
budget:
  maxDailyCostUsd: 4.5
  maxTokensPerCall: 5000
  requiresApprovalAboveUsd: 0.5
`;

      const manifest = SubEgoFactory.fromRawDeclaration(yamlStr, "yaml");
      expect(manifest.id).toBe("ego.centinela-de-logs");
      expect(manifest.name).toBe("Centinela de Logs");
      expect(manifest.tools).toContain("log_parser");
      expect(manifest.autonomy).toBe("semi-autonomous");
      expect(manifest.budget.maxDailyCostUsd).toBe(4.5);
    });

    it("debe lanzar SubEgoDeclarationSyntaxError si el JSON está malformado", () => {
      const badJson = "{ name: 'Invalido', no_quotes }";
      expect(() => {
        SubEgoFactory.fromRawDeclaration(badJson, "json");
      }).toThrow(SubEgoDeclarationSyntaxError);
    });

    it("debe lanzar SubEgoManifestValidationError si la estructura no cumple el esquema", () => {
      const invalidObject = {
        // Falta name y role
        description: "Sin datos requeridos"
      };

      expect(() => {
        SubEgoFactory.fromRawDeclaration(invalidObject);
      }).toThrow(SubEgoManifestValidationError);
    });
  });
});
