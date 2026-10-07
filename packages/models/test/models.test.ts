import { describe, it, expect } from "vitest";
import { MockProvider } from "../src/providers/MockProvider.js";
import { ModelRouter } from "../src/ModelRouter.js";

describe("@ego/models — Unit Test Suite", () => {
  it("MockProvider genera respuestas deterministas", async () => {
    const mock = new MockProvider();
    expect(await mock.isAvailable()).toBe(true);

    const result = await mock.generate("mock-fast", {
      messages: [{ role: "user", content: "Hola Ego" }],
    });

    expect(result.text).toContain("[MockResponse:mock-fast]");
    expect(result.finishReason).toBe("stop");
    expect(result.usage.totalTokens).toBeGreaterThan(0);
  });

  it("ModelRouter enruta al proveedor mock y selecciona modelo", async () => {
    const router = new ModelRouter();

    const model = await router.resolveModel("speed");
    expect(model.provider).toBe("mock");

    const result = await router.generateText("speed", {
      messages: [{ role: "user", content: "¿Cuál es tu rol?" }],
    });

    expect(result.text).toBeDefined();
    expect(result.text).toContain("MockResponse");
  });
});
