import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { EgoMemoryAdapter, EgoMemoryLifecycle } from "@ego/memory";
import { ModelRouter, EgoModelInterface, ModelGenerateOptions, ModelGenerateResult } from "@ego/models";
import { ToolRegistry, registerNativeTools } from "@ego/tools";
import { EventBus } from "@ego/events";
import { ApprovalEngine, ExecutionManager } from "@ego/execution";
import { ToolExecutionLoop } from "@ego/runtime";
import { setupModelProviders, handleLlmStream, applyModelConfig, resolveEnvModelKeys, resolvePersistedModelKeys, mergeModelKeys, encryptCredential, maskApiKey } from "../src/main.js";
import { ModelConfigSchema, type ModelConfig } from "../src/ipc/schema.js";

const PROVIDER_ENV_VARS = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY", "DEEPSEEK_API_KEY", "OPENAI_BASE_URL", "DEEPSEEK_BASE_URL", "OLLAMA_BASE_URL"] as const;

function snapshotEnv(): Record<string, string | undefined> {
  const snap: Record<string, string | undefined> = {};
  for (const v of PROVIDER_ENV_VARS) snap[v] = process.env[v];
  return snap;
}

function clearProviderEnv(): void {
  for (const v of PROVIDER_ENV_VARS) delete process.env[v];
}

function restoreEnv(snap: Record<string, string | undefined>): void {
  for (const v of PROVIDER_ENV_VARS) {
    if (snap[v] === undefined) delete process.env[v];
    else process.env[v] = snap[v];
  }
}

function registeredProviderIds(router: ModelRouter): string[] {
  const inner = router as unknown as { providers: Map<string, { isAvailable(): Promise<boolean> }> };
  return [...inner.providers.keys()];
}

describe("@ego/desktop — Fast-Path ToolExecutionLoop & Real Providers Integration (INT-01, INT-02)", () => {
  let tmpDir: string;
  let adapter: EgoMemoryAdapter;
  let lifecycle: EgoMemoryLifecycle;
  let modelRouter: ModelRouter;
  let toolRegistry: ToolRegistry;
  let approvalEngine: ApprovalEngine;
  let executionManager: ExecutionManager;
  let eventBus: EventBus;
  let toolLoop: ToolExecutionLoop;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `ego-desktop-ipc-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(tmpDir, { recursive: true });

    adapter = new EgoMemoryAdapter(tmpDir);
    await adapter.init();

    lifecycle = new EgoMemoryLifecycle(adapter);
    await lifecycle.startSession("sess_test_1", "default");

    modelRouter = new ModelRouter();
    setupModelProviders(modelRouter);

    toolRegistry = new ToolRegistry();
    registerNativeTools(toolRegistry, { workspacePath: tmpDir });

    approvalEngine = new ApprovalEngine({ mode: "standard" });
    executionManager = new ExecutionManager({ defaultTimeoutMs: 10_000, maxConcurrentExecutions: 5 });
    eventBus = new EventBus({ maxHistorySize: 50 });

    toolLoop = new ToolExecutionLoop(modelRouter, toolRegistry, {
      executionManager,
      approvalEngine,
      eventBus,
      maxSteps: 5,
      defaultRole: "general-chat",
    });
  });

  afterEach(async () => {
    await adapter.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("1. INT-02: Configuración de Proveedores y BYOK Fallback", () => {
    it("debe registrar proveedores por defecto y resolver fallback seguro a mock si no hay API keys", async () => {
      const resolved = await modelRouter.resolveModel("general-chat");
      expect(resolved).toBeDefined();
      // Sin claves en entorno, debe caer en mock-core o local disponible
      expect(["mock-core", "llama3.2:3b"]).toContain(resolved.id);
    });

    it("debe registrar OpenAIProvider cuando OPENAI_API_KEY está configurada", async () => {
      const customRouter = new ModelRouter();
      const prevKey = process.env.OPENAI_API_KEY;
      try {
        process.env.OPENAI_API_KEY = "sk-test-live-key-1234567890";
        setupModelProviders(customRouter);

        const model = await customRouter.resolveModel("general-chat");
        // Con OPENAI_API_KEY, gpt-4o pasa a estar disponible
        expect(model.id).toBe("gpt-4o");
        expect(model.provider).toBe("openai");
      } finally {
        if (prevKey) {
          process.env.OPENAI_API_KEY = prevKey;
        } else {
          delete process.env.OPENAI_API_KEY;
        }
      }
    });
  });

  describe("2. INT-01: ToolExecutionLoop en Desktop Fast-Path", () => {
    it("debe registrar herramientas nativas de Nivel A en toolRegistry (fs, git, terminal)", () => {
      const tools = toolRegistry.list().map((t) => t.name);
      expect(tools).toContain("fs_read_file");
      expect(tools).toContain("fs_write_file");
      expect(tools).toContain("git_status");
      expect(tools).toContain("git_diff");
      expect(tools).toContain("terminal_exec");
    });

    it("debe ejecutar el ciclo de chat básico multi-turno con persistencia en VantaDB", async () => {
      const result = await toolLoop.run({
        messages: [
          { role: "system", content: "Eres Ego Core." },
          { role: "user", content: "Hola, preséntate brevemente." }
        ],
        context: {
          callId: "call_1",
          sessionId: "sess_test_1",
          projectId: "proj_alpha",
          subEgoId: "ego.nucleus",
        },
        role: "general-chat",
        traceId: "trace_1"
      });

      expect(result.status).toBe("completed");
      expect(result.finalText).toBeDefined();
      expect(result.steps).toBeGreaterThanOrEqual(1);

      // Sincronizar con el ciclo de vida
      await lifecycle.syncTurn("sess_test_1", "turn_1", "Hola", result.finalText!, []);

      // Verificar que se persistió en VantaDB bajo session/turns
      const storedTurn = (await adapter.get("session/turns", "sess_test_1:turn_1")) as any;
      expect(storedTurn).toBeDefined();
      expect(storedTurn.userPrompt).toBe("Hola");
      expect(storedTurn.assistantReply).toBe(result.finalText);
    });

    it("debe ejecutar herramientas solicitadas por el modelo y alimentar la respuesta con el output", async () => {
      // Creamos un archivo real en el workspace temporal
      const sampleFile = path.join(tmpDir, "notas.txt");
      await fs.writeFile(sampleFile, "Contenido secreto del proyecto Ego 2026", "utf-8");

      // Inyectamos un proveedor que simula una llamada a herramienta y luego la respuesta final
      let callCount = 0;
      const toolCallingProvider: EgoModelInterface = {
        providerId: "mock",
        isAvailable: async () => true,
        generate: async (_modelId: string, options: ModelGenerateOptions): Promise<ModelGenerateResult> => {
          callCount++;
          if (callCount === 1) {
            // Primer turno: el modelo solicita leer notas.txt
            return {
              text: "Voy a leer el archivo de notas para responderte.",
              toolCalls: [
                {
                  id: "tc_fs_1",
                  name: "fs_read_file",
                  arguments: { path: "notas.txt" }
                }
              ],
              usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70, estimatedCostUsd: 0 },
              finishReason: "tool_calls"
            };
          } else {
            // Segundo turno: el modelo recibe el contenido de la herramienta y sintetiza respuesta
            const toolMsg = options.messages.find((m) => m.role === "tool");
            return {
              text: `He leído el archivo: ${toolMsg?.content}`,
              usage: { promptTokens: 100, completionTokens: 30, totalTokens: 130, estimatedCostUsd: 0 },
              finishReason: "stop"
            };
          }
        },
        stream: async () => {
          throw new Error("Stream no implementado en mock para este test");
        }
      };

      const customRouter = new ModelRouter();
      customRouter.registerProvider(toolCallingProvider);

      const loopWithTools = new ToolExecutionLoop(customRouter, toolRegistry, {
        executionManager,
        approvalEngine,
        eventBus,
        maxSteps: 5,
        defaultRole: "general-chat"
      });

      const eventsTracked: string[] = [];
      eventBus.on("tool.started", () => eventsTracked.push("tool.started"));
      eventBus.on("tool.executed", () => eventsTracked.push("tool.executed"));

      const loopResult = await loopWithTools.run({
        messages: [{ role: "user", content: "¿Qué hay en notas.txt?" }],
        context: {
          callId: "call_tool_test",
          sessionId: "sess_test_1",
          projectId: "proj_alpha",
          subEgoId: "ego.nucleus",
          workspacePath: tmpDir
        },
        role: "general-chat",
        traceId: "trace_tool_test"
      });

      expect(loopResult.status).toBe("completed");
      expect(loopResult.steps).toBe(2);
      expect(loopResult.finalText).toContain("Contenido secreto del proyecto Ego 2026");
      expect(eventsTracked).toContain("tool.started");
      expect(eventsTracked).toContain("tool.executed");
    });
  });

  describe("3. Task 9: AI SDK wiring main-only (BYOK cifrado, sin keys reales)", () => {
    let envSnap: Record<string, string | undefined>;

    beforeEach(() => {
      envSnap = snapshotEnv();
      clearProviderEnv();
    });

    afterEach(() => {
      restoreEnv(envSnap);
    });

    it("registra anthropic con key fake y resuelve claude para reasoning-heavy", async () => {
      const router = new ModelRouter();
      setupModelProviders(router, { anthropic: "sk-ant-test-1234567890" });
      expect(registeredProviderIds(router)).toContain("anthropic");
      const desc = await router.resolveModel("reasoning-heavy");
      expect(desc.provider).toBe("anthropic");
      expect(desc.id).toBe("claude-3-5-sonnet-20241022");
    });

    it("registra google con key fake sin ninguna llamada de red", async () => {
      const router = new ModelRouter();
      setupModelProviders(router, { google: "AIza-test-1234567890" });
      const inner = router as unknown as { providers: Map<string, { isAvailable(): Promise<boolean> }> };
      expect(inner.providers.has("google")).toBe(true);
      await expect(inner.providers.get("google")!.isAvailable()).resolves.toBe(true);
    });

    it("sin keys → no registra cloud y resuelve fallback mock/ollama sin lanzar", async () => {
      const router = new ModelRouter();
      setupModelProviders(router);
      const ids = registeredProviderIds(router);
      expect(ids).not.toContain("openai");
      expect(ids).not.toContain("anthropic");
      expect(ids).not.toContain("google");
      expect(ids).not.toContain("deepseek");
      expect(ids).toContain("mock");
      const resolved = await router.resolveModel("general-chat");
      expect(["mock-core", "llama3.2:3b"]).toContain(resolved.id);
    });

    it("resolvePersistedModelKeys descifra por proveedor y tolera el legado de clave única", () => {
      const persisted = resolvePersistedModelKeys({
        anthropicKeyEncrypted: encryptCredential("sk-ant-test-1234567890"),
        googleKeyEncrypted: encryptCredential("AIza-test-1234567890"),
      });
      expect(persisted.anthropic).toBe("sk-ant-test-1234567890");
      expect(persisted.google).toBe("AIza-test-1234567890");

      const legacy = resolvePersistedModelKeys({
        activeProvider: "openai",
        apiKeyEncrypted: encryptCredential("sk-test-1234567890"),
      });
      expect(legacy.openai).toBe("sk-test-1234567890");
      expect(resolvePersistedModelKeys(null)).toEqual({});
      expect(resolvePersistedModelKeys("basura")).toEqual({});
    });

    it("mergeModelKeys: lo persistido por UI gana sobre el bootstrap env", () => {
      process.env.ANTHROPIC_API_KEY = "sk-env-1234567890";
      const merged = mergeModelKeys(resolveEnvModelKeys(), { anthropic: "sk-ui-1234567890" });
      expect(merged.anthropic).toBe("sk-ui-1234567890");
      const kept = mergeModelKeys(resolveEnvModelKeys(), { anthropic: "" });
      expect(kept.anthropic).toBe("sk-env-1234567890");
    });

    it("applyModelConfig valida con zod y exige key no vacía (sin key → fallback intacto)", async () => {
      const router = new ModelRouter();
      setupModelProviders(router);
      const cfg: ModelConfig = { activeProvider: "openai", apiKey: "" };
      expect(() => applyModelConfig(router, cfg)).not.toThrow();
      const fallback = await router.resolveModel("general-chat");
      expect(["mock-core", "llama3.2:3b"]).toContain(fallback.id);

      applyModelConfig(router, { activeProvider: "openai", apiKey: "sk-test-1234567890" });
      const resolved = await router.resolveModel("general-chat");
      expect(resolved.id).toBe("gpt-4o");

      expect(() => applyModelConfig(router, { activeProvider: "nope" } as unknown as ModelConfig)).toThrow(/inválida/);
    });

    it("custom baseUrl openai usa el legacy OpenAICompatibleProvider; si no, AiSdk", () => {
      const custom = new ModelRouter();
      applyModelConfig(custom, { activeProvider: "openai", apiKey: "sk-test-1234567890", baseUrl: "http://localhost:1234/v1" });
      const innerCustom = custom as unknown as { providers: Map<string, { constructor: { name: string } }> };
      expect(innerCustom.providers.get("openai")?.constructor.name).toBe("OpenAICompatibleProvider");

      const standard = new ModelRouter();
      applyModelConfig(standard, { activeProvider: "openai", apiKey: "sk-test-1234567890" });
      const innerStd = standard as unknown as { providers: Map<string, { constructor: { name: string } }> };
      expect(innerStd.providers.get("openai")?.constructor.name).toBe("AiSdkOpenAIProvider");
    });

    it("Task 10: ModelConfigSchema rechaza anthropicKey/googleKey vacías o de tipo inválido", () => {
      // Key vacía → rechazada (contrato: payload sin schema válido es rechazado).
      expect(ModelConfigSchema.safeParse({ activeProvider: "anthropic", anthropicKey: "" }).success).toBe(false);
      expect(ModelConfigSchema.safeParse({ activeProvider: "google", googleKey: "" }).success).toBe(false);
      // Tipo inválido → rechazado.
      expect(
        ModelConfigSchema.safeParse({ activeProvider: "anthropic", anthropicKey: 123 }).success
      ).toBe(false);
      expect(
        ModelConfigSchema.safeParse({ activeProvider: "google", googleKey: { k: 1 } }).success
      ).toBe(false);
      // Payload sin schema (sin activeProvider / proveedor desconocido) → rechazado.
      expect(ModelConfigSchema.safeParse({ anthropicKey: "sk-ant-test-1234567890" }).success).toBe(false);
      expect(
        ModelConfigSchema.safeParse({ activeProvider: "nope", anthropicKey: "sk-ant-test-1" }).success
      ).toBe(false);
      // Keys válidas no vacías → aceptadas.
      expect(
        ModelConfigSchema.safeParse({ activeProvider: "anthropic", anthropicKey: "sk-ant-test-1234567890" }).success
      ).toBe(true);
      expect(
        ModelConfigSchema.safeParse({ activeProvider: "google", googleKey: "AIza-test-1234567890" }).success
      ).toBe(true);
      // Ausentes (undefined) → aceptadas (el main conserva el secreto guardado).
      expect(ModelConfigSchema.safeParse({ activeProvider: "anthropic" }).success).toBe(true);
    });

    it("Task 10: el getter nunca retorna la key completa (respuesta enmascarada)", () => {
      const anthropicFull = "sk-ant-SECRETO-XYZ-1234567890";
      const googleFull = "AIza-SECRETO-XYZ-1234567890";
      // Mismo enmascarado que `toMaskedModelConfigResponse` en main (maskKey).
      const maskedResponse = {
        activeProvider: "anthropic",
        apiKey: maskApiKey(""),
        openaiKey: maskApiKey(""),
        anthropicKey: maskApiKey(anthropicFull),
        googleKey: maskApiKey(googleFull),
        deepseekKey: maskApiKey(""),
      };
      for (const value of Object.values(maskedResponse)) {
        expect(value).not.toContain(anthropicFull);
        expect(value).not.toContain(googleFull);
        expect(value).not.toContain("SECRETO-XYZ");
      }
      expect(maskedResponse.anthropicKey).not.toBe(anthropicFull);
      expect(maskedResponse.googleKey).not.toBe(googleFull);
      expect(maskedResponse.anthropicKey).toContain("...");
      expect(maskedResponse.googleKey).toContain("...");
    });

    it("ninguna key en claro sale del main: sin logs con secreto y respuestas enmascaradas", () => {
      const secret = "sk-ant-SECRETO-XYZ-1234567890";
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        setupModelProviders(new ModelRouter(), { anthropic: secret });
        applyModelConfig(new ModelRouter(), { activeProvider: "deepseek", apiKey: secret });
        const leaked = [...logSpy.mock.calls, ...warnSpy.mock.calls].flat().join(" ");
        expect(leaked).not.toContain(secret);
        expect(leaked).not.toContain("SECRETO-XYZ");
      } finally {
        logSpy.mockRestore();
        warnSpy.mockRestore();
      }
      const masked = maskApiKey(secret);
      expect(masked).not.toContain(secret);
      expect(masked).toContain("...");
    });
  });
});
