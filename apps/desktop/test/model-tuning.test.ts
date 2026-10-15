import { describe, it, expect } from "vitest";
import { ModelRouter } from "@ego/models";
import { ModelConfigSchema } from "../src/ipc/schema.js";
import { applyModelConfig } from "../src/main.js";

/**
 * STAB-06 — `ModelConfig.reasoningEffort|temperature`: schema + wiring
 * `applyModelConfig → router`. TDD RED.
 */
describe("ModelConfig tuning (STAB-06)", () => {
  it("schema acepta reasoningEffort low|medium|high + temperature 0-2", () => {
    const ok = ModelConfigSchema.safeParse({
      activeProvider: "mock",
      reasoningEffort: "medium",
      temperature: 1.2,
    });
    expect(ok.success).toBe(true);
  });

  it("schema rechaza effort inválido y temperature fuera de 0-2", () => {
    expect(
      ModelConfigSchema.safeParse({ activeProvider: "mock", reasoningEffort: "ultra" }).success
    ).toBe(false);
    expect(
      ModelConfigSchema.safeParse({ activeProvider: "mock", temperature: 2.5 }).success
    ).toBe(false);
    expect(
      ModelConfigSchema.safeParse({ activeProvider: "mock", temperature: -0.1 }).success
    ).toBe(false);
  });

  it("campos opcionales: config legacy sin tuning sigue válida", () => {
    expect(ModelConfigSchema.safeParse({ activeProvider: "mock" }).success).toBe(true);
  });

  it("applyModelConfig cablea reasoningEffort al effort del router", () => {
    const router = new ModelRouter();
    applyModelConfig(router, { activeProvider: "mock", reasoningEffort: "high" });
    expect(router.getEffortLevel()).toBe("high");
  });

  it("applyModelConfig respeta effortLevel explícito sobre reasoningEffort", () => {
    const router = new ModelRouter();
    applyModelConfig(router, {
      activeProvider: "mock",
      effortLevel: "minimal",
      reasoningEffort: "high",
    });
    expect(router.getEffortLevel()).toBe("minimal");
  });
});
