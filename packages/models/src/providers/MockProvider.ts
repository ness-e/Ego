import type {
  EgoModelInterface,
  ModelGenerateOptions,
  ModelGenerateResult,
  ModelProviderId,
  ModelStreamChunk,
} from "../types.js";

/**
 * Proveedor Mock determinista para pruebas E2E, CI/CD y funcionamiento offline sin API keys.
 */
export class MockProvider implements EgoModelInterface {
  readonly providerId: ModelProviderId = "mock";

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generate(
    modelId: string,
    options: ModelGenerateOptions
  ): Promise<ModelGenerateResult> {
    const lastMsg = options.messages[options.messages.length - 1];
    const userQuery = lastMsg?.content || "Consulta vacía";
    const replyText = `[MockResponse:${modelId}] Procesado con éxito: "${userQuery.slice(0, 50)}..."`;

    return {
      text: replyText,
      finishReason: "stop",
      usage: {
        promptTokens: 25,
        completionTokens: 30,
        totalTokens: 55,
        estimatedCostUsd: 0.0,
      },
    };
  }

  async stream(
    modelId: string,
    options: ModelGenerateOptions,
    onChunk: (chunk: ModelStreamChunk) => void
  ): Promise<ModelGenerateResult> {
    const res = await this.generate(modelId, options);
    const words = res.text.split(" ");

    for (const word of words) {
      onChunk({
        type: "text-delta",
        delta: word + " ",
      });
      // Simular latencia de streaming biológica
      await new Promise((r) => setTimeout(r, 20));
    }

    onChunk({
      type: "finish",
      finishReason: "stop",
      usage: res.usage,
    });

    return res;
  }
}
