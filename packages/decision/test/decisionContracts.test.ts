import { describe, it, expect } from "vitest";
import { ToolRegistry } from "@ego/tools";
import { registerNativeTools } from "@ego/tools";
import {
  createAdmittedRunContext,
  type AdmittedRunContext as ExecutionAdmittedRunContext,
} from "@ego/execution";
import { IntentClassifier } from "../src/IntentClassifier.js";
import { DeterministicRules } from "../src/rules/DeterministicRules.js";
import { DecisionRouter } from "../src/DecisionRouter.js";
import { DecisionCascade } from "../src/DecisionCascade.js";
import { DOMAIN_SUB_EGO_MAP, resolveSubEgoId } from "../src/routing/domainSubEgoMap.js";
import { NATIVE_TOOL_NAMES } from "../src/canonicalTools.js";

const PROMPTS = [
  "git commit -m \"fix bug\"",
  "Revisa el archivo src/main.ts y haz git commit con los cambios",
  "pnpm build && pnpm test",
  "Buscar en la memoria los documentos sobre arquitectura de red",
  "Crear tarea del backlog para el siguiente trimestre",
  "graficar kpis de latencia del turno",
  "Analizar el archivo tests/unit.test.ts",
];

function buildNativeRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registerNativeTools(registry, { workspacePath: "C:/repos/test" });
  return registry;
}

describe("Contratos de decisión unificados (F3T6)", () => {
  it("H02: toda tool sugerida existe en el registry nativo", () => {
    const registry = buildNativeRegistry();
    const registered = new Set(registry.list().map((t) => t.name));
    expect(registered.size).toBeGreaterThan(0);

    const classifier = new IntentClassifier();
    const rules = new DeterministicRules();

    for (const prompt of PROMPTS) {
      const classified = classifier.classify({
        prompt,
        projectId: "proj-f3t6",
        workspacePath: "C:/repos/test",
      });
      for (const tool of classified.suggestedTools) {
        expect(
          registered.has(tool),
          `prompt ${JSON.stringify(prompt)} sugiere tool desconocida ${JSON.stringify(tool)}`
        ).toBe(true);
      }

      const match = rules.match(prompt);
      if (match) {
        for (const tool of match.tools) {
          expect(
            registered.has(tool),
            `regla determinista sugiere tool desconocida ${JSON.stringify(tool)}`
          ).toBe(true);
        }
      }
    }
  });

  it("H02: el mapa de nombres canónicos cubre el registry nativo", () => {
    const registry = buildNativeRegistry();
    const registered = new Set(registry.list().map((t) => t.name));
    for (const name of NATIVE_TOOL_NAMES) {
      expect(registered.has(name)).toBe(true);
    }
  });

  it("M03: Router y Cascade resuelven el mismo subEgo por dominio", async () => {
    const router = new DecisionRouter();
    const cascade = new DecisionCascade();

    const engineeringRouter = await router.decide({
      prompt: "git commit -m \"fix bug\"",
      projectId: "proj-f3t6",
      workspacePath: "C:/repos/test",
    });
    const engineeringCascade = await cascade.evaluate({
      prompt: "git commit -m \"fix bug\"",
      projectId: "proj-f3t6",
      workspacePath: "C:/repos/test",
    });
    expect(engineeringRouter.subEgoId).toBe(resolveSubEgoId("engineering"));
    expect(engineeringCascade.subEgoId).toBe(resolveSubEgoId("engineering"));
    expect(engineeringCascade.subEgoId).toBe(engineeringRouter.subEgoId);

    const knowledgeRouter = await router.decide({
      prompt: "Buscar en la memoria los documentos sobre arquitectura de red",
      projectId: "proj-f3t6",
    });
    const knowledgeCascade = await cascade.evaluate({
      prompt: "Buscar en la memoria los documentos sobre arquitectura de red",
      projectId: "proj-f3t6",
    });
    expect(knowledgeRouter.subEgoId).toBe(resolveSubEgoId("knowledge"));
    expect(knowledgeCascade.subEgoId).toBe(resolveSubEgoId("knowledge"));
    expect(knowledgeCascade.subEgoId).toBe(knowledgeRouter.subEgoId);
  });

  it("M03: la tabla única cubre los seis dominios canónicos", () => {
    expect(Object.keys(DOMAIN_SUB_EGO_MAP).sort()).toEqual(
      ["analytics", "crm", "engineering", "general", "knowledge", "product"]
    );
    expect(resolveSubEgoId("engineering")).toBe("ego.dev");
    expect(resolveSubEgoId("knowledge")).toBe("ego.research");
    expect(resolveSubEgoId("product")).toBe("ego.pm");
    expect(resolveSubEgoId("analytics")).toBe("ego.analyst");
    expect(resolveSubEgoId("crm")).toBe("ego.crm");
    expect(resolveSubEgoId("general")).toBe("ego.nucleus");
  });

  it("H01: Router y Cascade aceptan AdmittedRunContext de ejecución vía adaptador explícito", async () => {
    const execCtx: ExecutionAdmittedRunContext = createAdmittedRunContext({
      runId: "550e8400-e29b-41d4-a716-446655440000",
      admissionSource: "sub-ego",
      parentRunId: "660e8400-e29b-41d4-a716-446655440001",
    });

    const router = new DecisionRouter();
    const cascade = new DecisionCascade();

    const routerVerdict = await router.decide({
      prompt: "git commit -m \"fix bug\"",
      projectId: "proj-f3t6",
      workspacePath: "C:/repos/test",
      runContext: execCtx,
    });
    expect(routerVerdict.admittedRunContext.runId).toBe(
      "550e8400-e29b-41d4-a716-446655440000"
    );
    expect(routerVerdict.admittedRunContext.origin).toBe("subego_delegation");
    expect(routerVerdict.admittedRunContext.parentRunId).toBe(
      "660e8400-e29b-41d4-a716-446655440001"
    );

    const cascadeVerdict = await cascade.evaluate({
      prompt: "git commit -m \"fix bug\"",
      projectId: "proj-f3t6",
      workspacePath: "C:/repos/test",
      runContext: execCtx,
    });
    expect(cascadeVerdict.admittedRunContext.runId).toBe(
      "550e8400-e29b-41d4-a716-446655440000"
    );
    expect(cascadeVerdict.admittedRunContext.origin).toBe("subego_delegation");
  });
});
