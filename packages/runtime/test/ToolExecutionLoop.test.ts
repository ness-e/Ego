import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { ModelRouter } from "@ego/models";
import { ToolRegistry, ToolDefinition, ToolExecutionContext } from "@ego/tools";
import { ToolExecutionLoop } from "../src/index.js";

describe("@ego/runtime — ToolExecutionLoop (ACT-02)", () => {
  let router: ModelRouter;
  let registry: ToolRegistry;
  let loop: ToolExecutionLoop;

  const mockContext: ToolExecutionContext = {
    callId: "call_runtime_test",
    sessionId: "sess_ego_001",
    workspacePath: "/workspace/ego"
  };

  const sampleReadFileTool: ToolDefinition<{ path: string }, { content: string }> = {
    name: "fs_read_file",
    description: "Lee un archivo del workspace.",
    category: "filesystem",
    riskLevel: "safe",
    origin: "native",
    inputSchema: z.object({
      path: z.string().min(1)
    }),
    execute: async ({ path }) => {
      return { content: `CONTENIDO_REAL_DE_${path}` };
    }
  };

  const sampleFailingTool: ToolDefinition<{ target: string }, { ok: boolean }> = {
    name: "failing_tool",
    description: "Herramienta que lanza una excepción para probar contexto causal.",
    category: "system",
    riskLevel: "safe",
    origin: "native",
    inputSchema: z.object({
      target: z.string()
    }),
    execute: async ({ target }) => {
      throw new Error(`Permiso denegado al acceder a ${target}`);
    }
  };

  const sampleExecTool: ToolDefinition<{ command: string }, { exitCode: number }> = {
    name: "terminal_exec",
    description: "Ejecuta un comando sensible en terminal.",
    category: "terminal",
    riskLevel: "destructive",
    origin: "native",
    requiresApproval: true,
    inputSchema: z.object({
      command: z.string()
    }),
    execute: async () => {
      return { exitCode: 0 };
    }
  };

  beforeEach(() => {
    router = new ModelRouter();
    registry = new ToolRegistry();
    registry.registerMany([sampleReadFileTool, sampleFailingTool, sampleExecTool]);
    loop = new ToolExecutionLoop(router, registry);
  });

  it("1. Ejecuta ciclo simple sin tools cuando el modelo responde de inmediato", async () => {
    const result = await loop.run({
      messages: [{ role: "user", content: "Hola Ego, ¿cómo estás?" }],
      context: mockContext
    });

    expect(result.status).toBe("completed");
    expect(result.steps).toBe(1);
    expect(result.finalText).toContain("[MockResponse:");
    expect(result.messages.length).toBe(2);
    expect(result.messages[1].role).toBe("assistant");
  });

  it("2. Orquesta ciclo multi-turno exitoso con Tool Calling e inyección causal", async () => {
    const events: string[] = [];
    const customLoop = new ToolExecutionLoop(router, registry, {
      onStep: (e) => events.push(e.action)
    });

    // Usamos el trigger SIMULATE_TOOL que MockProvider entiende
    const result = await customLoop.run({
      messages: [
        {
          role: "user",
          content: 'SIMULATE_TOOL:fs_read_file:{"path":"src/main.ts"}'
        }
      ],
      context: mockContext
    });

    expect(result.status).toBe("completed");
    expect(result.steps).toBe(2); // Turno 1: llama tool -> Turno 2: procesa tool y finaliza
    expect(result.finalText).toContain("He procesado el resultado");

    // Verificar estructura de mensajes acumulada
    expect(result.messages.length).toBe(4);
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[1].role).toBe("assistant");
    expect(result.messages[1].toolCalls?.[0].name).toBe("fs_read_file");
    expect(result.messages[2].role).toBe("tool");
    expect(result.messages[2].name).toBe("fs_read_file");
    expect(result.messages[2].content).toContain("CONTENIDO_REAL_DE_src/main.ts");
    expect(result.messages[3].role).toBe("assistant");

    // Verificar secuencia de eventos emitidos
    expect(events).toContain("model_called");
    expect(events).toContain("tools_requested");
    expect(events).toContain("tool_executing");
    expect(events).toContain("tool_executed");
    expect(events).toContain("completed");
  });

  it("3. Maneja validación errónea de Zod inyectando el error para corrección", async () => {
    // Invocamos fs_read_file con objeto vacío {} (falta el campo obligatorio "path")
    const result = await loop.run({
      messages: [
        {
          role: "user",
          content: 'SIMULATE_TOOL:fs_read_file:{}'
        }
      ],
      context: mockContext
    });

    expect(result.status).toBe("completed");
    const toolMsg = result.messages.find((m) => m.role === "tool");
    expect(toolMsg).toBeDefined();
    expect(toolMsg?.content).toContain("Argumentos inválidos");
  });

  it("4. Despacha aprobación HITL en caliente cuando la herramienta es destructiva", async () => {
    let handlerCalled = false;

    const result = await loop.run({
      messages: [
        {
          role: "user",
          content: 'SIMULATE_TOOL:terminal_exec:{"command":"npm test"}'
        }
      ],
      context: mockContext,
      approvalHandler: async (req) => {
        handlerCalled = true;
        expect(req.toolName).toBe("terminal_exec");
        expect(req.riskLevel).toBe("destructive");
        return { approved: true };
      }
    });

    expect(handlerCalled).toBe(true);
    expect(result.status).toBe("completed");
    const toolMsg = result.messages.find((m) => m.role === "tool");
    expect(toolMsg?.content).toContain('"exitCode":0');
  });

  it("5. Inyecta rechazo de usuario en el flujo cuando HITL deniega la acción", async () => {
    const result = await loop.run({
      messages: [
        {
          role: "user",
          content: 'SIMULATE_TOOL:terminal_exec:{"command":"rm -rf /"}'
        }
      ],
      context: mockContext,
      approvalHandler: async () => {
        return { approved: false, reason: "Comando destructivo prohibido por política de seguridad." };
      }
    });

    expect(result.status).toBe("completed");
    const toolMsg = result.messages.find((m) => m.role === "tool");
    expect(toolMsg?.content).toContain("Comando destructivo prohibido");
  });

  it("6. Suspende ejecución en approval_required si no hay handler y permite reanudar", async () => {
    // Sin approvalHandler inmediato
    const suspendResult = await loop.run({
      messages: [
        {
          role: "user",
          content: 'SIMULATE_TOOL:terminal_exec:{"command":"git push"}'
        }
      ],
      context: mockContext
    });

    expect(suspendResult.status).toBe("approval_required");
    expect(suspendResult.pendingApproval).toBeDefined();
    expect(suspendResult.pendingApproval?.toolName).toBe("terminal_exec");

    // Reanudación con aprobación explícita
    const resumeResult = await loop.resume(
      suspendResult.pendingApproval!,
      { approved: true },
      {
        messages: suspendResult.messages,
        context: mockContext
      }
    );

    expect(resumeResult.status).toBe("completed");
    expect(resumeResult.messages.some((m) => m.role === "tool")).toBe(true);
  });

  it("7. Captura excepciones de herramientas y provee contexto causal de error", async () => {
    const result = await loop.run({
      messages: [
        {
          role: "user",
          content: 'SIMULATE_TOOL:failing_tool:{"target":"/etc/shadow"}'
        }
      ],
      context: mockContext
    });

    expect(result.status).toBe("completed");
    const toolMsg = result.messages.find((m) => m.role === "tool");
    expect(toolMsg?.content).toContain("Permiso denegado al acceder a /etc/shadow");
  });

  it("8. Protege contra bucles infinitos cortando en maxSteps", async () => {
    const shortLoop = new ToolExecutionLoop(router, registry, { maxSteps: 1 });

    const result = await shortLoop.run({
      messages: [
        {
          role: "user",
          content: 'SIMULATE_TOOL:fs_read_file:{"path":"file.txt"}'
        }
      ],
      context: mockContext
    });

    expect(result.status).toBe("max_steps_exceeded");
    expect(result.error).toContain("Se excedió el número máximo de pasos");
  });

  it("9. Detiene la ejecución cooperativamente si se dispara AbortSignal", async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await loop.run({
      messages: [{ role: "user", content: "Procesa esto" }],
      context: mockContext,
      abortSignal: controller.signal
    });

    expect(result.status).toBe("aborted");
    expect(result.error).toContain("AbortSignal");
  });
});
