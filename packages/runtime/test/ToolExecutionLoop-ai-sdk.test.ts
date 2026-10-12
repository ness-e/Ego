import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ModelRouter } from "@ego/models";
import type {
  EgoModelInterface,
  ModelGenerateOptions,
  ModelGenerateResult,
  ModelProviderId,
  ModelStreamChunk,
} from "@ego/models";
import { ToolRegistry } from "@ego/tools";
import type { ToolDefinition, ToolExecutionContext } from "@ego/tools";
import { ToolExecutionLoop } from "../src/index.js";

const ZERO_USAGE = {
  promptTokens: 10,
  completionTokens: 10,
  totalTokens: 20,
  estimatedCostUsd: 0,
};

/**
 * Stub que emula un adapter AI SDK real (Tasks 5-8): devuelve `toolCalls`
 * estructurales con `finishReason: "tool_calls"` en la 1ª llamada, SIN pasar
 * por `SIMULATE_TOOL` ni por reparación de texto (texto vacío en turno 1).
 * En la 2ª llamada sintetiza la respuesta final a partir del resultado tool.
 */
class RealToolCallsProvider implements EgoModelInterface {
  readonly providerId: ModelProviderId = "mock";
  public generateCalls = 0;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generate(
    _modelId: string,
    options: ModelGenerateOptions
  ): Promise<ModelGenerateResult> {
    this.generateCalls++;
    const lastMsg = options.messages[options.messages.length - 1];

    // Turno 2: el historial ya contiene el mensaje `tool` → síntesis final.
    if (lastMsg?.role === "tool") {
      return {
        text: `Síntesis final basada en herramienta: ${lastMsg.content}`,
        finishReason: "stop",
        usage: { ...ZERO_USAGE },
      };
    }

    // Turno 1: toolCalls REALES del provider, texto vacío (nada que reparar).
    return {
      text: "",
      finishReason: "tool_calls",
      toolCalls: [
        {
          id: "call_real_1",
          name: "fs_read_file",
          arguments: { path: "src/main.ts" },
        },
      ],
      usage: { ...ZERO_USAGE },
    };
  }

  async stream(
    modelId: string,
    options: ModelGenerateOptions,
    _onChunk: (chunk: ModelStreamChunk) => void
  ): Promise<ModelGenerateResult> {
    return this.generate(modelId, options);
  }
}

describe("@ego/runtime — ToolExecutionLoop con toolCalls REALES (Task 11, path AI SDK)", () => {
  it("ejecuta la tool desde res.toolCalls estructurales sin SIMULATE_TOOL ni reparación de texto", async () => {
    // Arrange
    const provider = new RealToolCallsProvider();
    const router = new ModelRouter();
    // Sobrescribe MockProvider: el loop consumirá toolCalls reales del stub.
    router.registerProvider(provider);

    const registry = new ToolRegistry();
    let executedWithPath: string | undefined;
    const readFileTool: ToolDefinition<{ path: string }, { content: string }> = {
      name: "fs_read_file",
      description: "Lee un archivo del workspace.",
      category: "filesystem",
      riskLevel: "safe",
      origin: "native",
      inputSchema: z.object({
        path: z.string().min(1),
      }),
      execute: async ({ path }: { path: string }) => {
        executedWithPath = path;
        return { content: `CONTENIDO_REAL_DE_${path}` };
      },
    };
    registry.registerMany([readFileTool]);

    const events: string[] = [];
    const loop = new ToolExecutionLoop(router, registry, {
      onStep: (e) => events.push(e.action),
    });

    const context: ToolExecutionContext = {
      callId: "call_ai_sdk_real",
      sessionId: "sess_ego_ai_sdk_011",
      workspacePath: "/workspace/ego",
    };

    // Act: petición en lenguaje natural — SIN marcador SIMULATE_TOOL.
    const result = await loop.run({
      messages: [{ role: "user", content: "Lee el archivo src/main.ts por favor" }],
      context,
    });

    // Assert 1: ciclo multi-turno real (turno 1 tool → turno 2 síntesis).
    // Si el loop ignorara `toolCalls`, steps sería 1 y este assert fallaría.
    expect(provider.generateCalls).toBe(2);
    expect(result.status).toBe("completed");
    expect(result.steps).toBe(2);

    // Assert 2: la tool se ejecutó materialmente con los argumentos del provider.
    expect(executedWithPath).toBe("src/main.ts");

    // Assert 3: mensaje `tool` enhebrado con el output real de la tool.
    expect(result.messages.length).toBe(4);
    expect(result.messages[1].role).toBe("assistant");
    expect(result.messages[1].toolCalls?.[0]).toMatchObject({
      id: "call_real_1",
      name: "fs_read_file",
    });
    expect(result.messages[1].toolCalls?.[0].arguments).toEqual({
      path: "src/main.ts",
    });
    const toolMsg = result.messages[2];
    expect(toolMsg.role).toBe("tool");
    expect(toolMsg.toolCallId).toBe("call_real_1");
    expect(toolMsg.name).toBe("fs_read_file");
    expect(toolMsg.content).toContain("CONTENIDO_REAL_DE_src/main.ts");

    // Assert 4: síntesis final contiene el output de la tool.
    expect(result.messages[3].role).toBe("assistant");
    expect(result.finalText).toContain("CONTENIDO_REAL_DE_src/main.ts");

    // Assert 5: secuencia de eventos del path real de ejecución.
    expect(events).toContain("tools_requested");
    expect(events).toContain("tool_executing");
    expect(events).toContain("tool_executed");
    expect(events).toContain("completed");
  });
});
