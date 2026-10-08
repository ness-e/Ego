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

    // Si el último mensaje es de rol tool, sintetizamos la respuesta final
    if (lastMsg?.role === "tool") {
      return {
        text: `[MockResponse:${modelId}] He procesado el resultado de la herramienta: "${userQuery.slice(0, 60)}"`,
        finishReason: "stop",
        usage: {
          promptTokens: 35,
          completionTokens: 25,
          totalTokens: 60,
          estimatedCostUsd: 0.0,
        },
      };
    }

    // Si se especifican herramientas y la consulta contiene la directiva SIMULATE_TOOL:<name>:<json>
    if (options.tools && options.tools.length > 0 && userQuery.includes("SIMULATE_TOOL:")) {
      const match = userQuery.match(/SIMULATE_TOOL:([a-zA-Z0-9_-]+)(?::(\{.*\}))?/);
      if (match) {
        const toolName = match[1];
        let args: Record<string, unknown> = {};
        if (match[2]) {
          try {
            args = JSON.parse(match[2]);
          } catch {
            args = { raw: match[2] };
          }
        }

        return {
          text: `Invocando herramienta ${toolName}...`,
          finishReason: "tool_calls",
          toolCalls: [
            {
              id: `call_${Date.now()}_mock`,
              name: toolName,
              arguments: args,
            },
          ],
          usage: {
            promptTokens: 30,
            completionTokens: 15,
            totalTokens: 45,
            estimatedCostUsd: 0.0,
          },
        };
      }
    }

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
