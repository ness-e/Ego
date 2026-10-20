import { describe, it, expect } from "vitest";
import { DecisionRouter } from "../src/DecisionRouter.js";
import type { DecisionScorerProvider } from "../src/providers/DecisionScorerProvider.js";

function makeScorer(
  result: { chosenOption: string; confidence: number; latencyMs?: number } | null
): DecisionScorerProvider {
  return {
    name: "fake-scorer",
    isAvailable: () => true,
    evaluate: async () => result as never,
  };
}

describe("DecisionRouter — cascada de 3 niveles (T7 / EGO-FIND-36)", () => {
  it("(1) sin scorer ni LLM degrada al nivel 1 (reglas deterministas)", async () => {
    const router = new DecisionRouter();
    const verdict = await router.decide({
      prompt: "Analiza el archivo src/main.ts",
      projectId: "p1",
      workspacePath: "C:/app",
    });
    expect(verdict.decidedBy).toBe("deterministic_rule");
  });

  it("(2) con scorer disponible usa el nivel 2 (scorer especializado)", async () => {
    const router = new DecisionRouter({
      scorerProvider: makeScorer({ chosenOption: "product", confidence: 0.9, latencyMs: 12 }),
    });
    const verdict = await router.decide({
      prompt: "Analiza el roadmap del producto",
      projectId: "p1",
      workspacePath: "C:/app",
    });
    expect(verdict.decidedBy).toBe("specialized_scorer");
    expect(verdict.domain).toBe("product");
    expect(verdict.metadata?.["tier"]).toBe("tier-2-scorer");
  });

  it("(3) con LLM fallback disponible usa el nivel 3 (LLM estructurado)", async () => {
    const router = new DecisionRouter({
      llmFallbackFn: async () => ({
        domain: "analytics" as const,
        subEgoId: "ego.analytics",
        tools: [],
        confidence: 0.82,
      }),
    });
    const verdict = await router.decide({
      prompt: "Analiza las métricas del sistema",
      projectId: "p1",
      workspacePath: "C:/app",
    });
    expect(verdict.decidedBy).toBe("structured_llm");
    expect(verdict.domain).toBe("analytics");
    expect(verdict.metadata?.["tier"]).toBe("tier-3-structured-llm");
  });

  it("(4) un scorer que falla degrada al fallback de núcleo seguro", async () => {
    const failing: DecisionScorerProvider = {
      name: "failing-scorer",
      isAvailable: () => true,
      evaluate: async () => {
        throw new Error("scorer no disponible");
      },
    };
    const router = new DecisionRouter({ scorerProvider: failing });
    const verdict = await router.decide({
      prompt: "Analiza el archivo src/main.ts",
      projectId: "p1",
      workspacePath: "C:/app",
    });
    expect(verdict.decidedBy).toBe("fallback_nucleus");
    expect(verdict.domain).toBe("engineering");
  });
});
