import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import {
  ToolRegistry,
  ToolDefinition,
  ToolExecutionContext,
  zodToJsonSchema
} from "../src/index.js";

describe("@ego/tools — ToolRegistry (ACT-01)", () => {
  let registry: ToolRegistry;

  const mockContext: ToolExecutionContext = {
    callId: "call_test_123",
    sessionId: "sess_alpha_001",
    workspacePath: "/test/workspace"
  };

  const sampleReadFileTool: ToolDefinition<{ path: string }, { content: string }> = {
    name: "fs_read_file",
    description: "Lee el contenido de un archivo dentro del workspace.",
    category: "filesystem",
    riskLevel: "safe",
    origin: "native",
    tags: ["fs", "io", "read"],
    inputSchema: z.object({
      path: z.string().describe("Ruta relativa del archivo a leer.")
    }),
    outputSchema: z.object({
      content: z.string()
    }),
    execute: async ({ path }, ctx) => {
      return { content: `Contenido simulado de ${path} en ${ctx.sessionId}` };
    }
  };

  const sampleWriteFileTool: ToolDefinition<{ path: string; data: string }, { bytesWritten: number }> = {
    name: "fs_write_file",
    description: "Escribe datos en un archivo del workspace.",
    category: "filesystem",
    riskLevel: "sensitive",
    origin: "native",
    tags: ["fs", "io", "write"],
    inputSchema: z.object({
      path: z.string().describe("Ruta de destino"),
      data: z.string().describe("Contenido en texto")
    }),
    execute: async ({ data }) => {
      return { bytesWritten: data.length };
    }
  };

  const sampleExecTool: ToolDefinition<{ command: string; timeoutMs?: number }, { exitCode: number }> = {
    name: "terminal_exec",
    description: "Ejecuta un comando en la shell del sistema.",
    category: "terminal",
    riskLevel: "destructive",
    origin: "native",
    tags: ["cli", "exec", "os"],
    inputSchema: z.object({
      command: z.string().describe("Comando a ejecutar"),
      timeoutMs: z.number().optional().default(5000)
    }),
    execute: async () => {
      return { exitCode: 0 };
    }
  };

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it("1. Registra y recupera herramientas verificando inmutabilidad", () => {
    registry.register(sampleReadFileTool);

    expect(registry.has("fs_read_file")).toBe(true);
    expect(registry.count()).toBe(1);

    const retrieved = registry.get("fs_read_file");
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe("fs_read_file");
    expect(retrieved?.category).toBe("filesystem");
    expect(retrieved?.riskLevel).toBe("safe");
  });

  it("2. Rechaza nombres inválidos o duplicados salvo allowOverride", () => {
    registry.register(sampleReadFileTool);

    // Duplicado sin override
    expect(() => registry.register(sampleReadFileTool)).toThrowError(
      /Herramienta duplicada/
    );

    // Duplicado con override permitido
    expect(() =>
      registry.register(
        { ...sampleReadFileTool, description: "Descripción modificada" },
        { allowOverride: true }
      )
    ).not.toThrow();

    expect(registry.get("fs_read_file")?.description).toBe("Descripción modificada");

    // Nombre con caracteres inválidos
    expect(() =>
      registry.register({
        ...sampleReadFileTool,
        name: "invalid name with spaces!"
      })
    ).toThrowError(/caracteres inválidos/);
  });

  it("3. Valida entradas mediante esquemas Zod en tiempo de ejecución", () => {
    registry.register(sampleReadFileTool);

    // Entrada válida
    const validResult = registry.validateInput("fs_read_file", { path: "src/index.ts" });
    expect(validResult.success).toBe(true);
    if (validResult.success) {
      expect(validResult.data).toEqual({ path: "src/index.ts" });
    }

    // Entrada inválida (falta path requerido)
    const invalidResult = registry.validateInput("fs_read_file", {});
    expect(invalidResult.success).toBe(false);
    if (!invalidResult.success) {
      expect(invalidResult.error.issues.length).toBeGreaterThan(0);
    }
  });

  it("4. Filtra herramientas por categoría, riesgo, origen, tags y texto", () => {
    registry.registerMany([sampleReadFileTool, sampleWriteFileTool, sampleExecTool]);
    expect(registry.count()).toBe(3);

    // Filtrar por categoría
    const fsTools = registry.list({ category: "filesystem" });
    expect(fsTools.length).toBe(2);

    const terminalTools = registry.list({ category: "terminal" });
    expect(terminalTools.length).toBe(1);
    expect(terminalTools[0].name).toBe("terminal_exec");

    // Filtrar por riesgo
    const safeTools = registry.list({ riskLevel: "safe" });
    expect(safeTools.length).toBe(1);

    const destructiveTools = registry.list({ riskLevel: "destructive" });
    expect(destructiveTools.length).toBe(1);

    // Filtrar por tags
    const ioTools = registry.list({ tag: "io" });
    expect(ioTools.length).toBe(2);

    // Búsqueda por texto libre
    const searchMatch = registry.list({ search: "shell" });
    expect(searchMatch.length).toBe(1);
    expect(searchMatch[0].name).toBe("terminal_exec");
  });

  it("5. Evalúa política canónica de aprobación humana (HITL)", () => {
    registry.registerMany([sampleReadFileTool, sampleWriteFileTool, sampleExecTool]);

    // safe -> false
    expect(registry.resolveApprovalRequirement("fs_read_file")).toBe(false);

    // sensitive -> true por defecto
    expect(registry.resolveApprovalRequirement("fs_write_file")).toBe(true);

    // destructive -> true obligatorio
    expect(registry.resolveApprovalRequirement("terminal_exec")).toBe(true);

    // Sobrescritura explícita
    registry.register(
      {
        ...sampleReadFileTool,
        name: "fs_read_sensitive",
        requiresApproval: true
      },
      { allowOverride: true }
    );
    expect(registry.resolveApprovalRequirement("fs_read_sensitive")).toBe(true);
  });

  it("6. Exporta especificaciones JSON Schema compatibles con function calling", () => {
    registry.registerMany([sampleReadFileTool, sampleExecTool]);

    const schemas = registry.exportJsonSchemas();
    expect(schemas.length).toBe(2);

    const readSchema = schemas.find((s) => s.name === "fs_read_file");
    expect(readSchema).toBeDefined();
    expect(readSchema?.parameters.type).toBe("object");
    expect((readSchema?.parameters as any).properties.path.type).toBe("string");
    expect((readSchema?.parameters as any).required).toContain("path");

    const execSchema = schemas.find((s) => s.name === "terminal_exec");
    expect(execSchema).toBeDefined();
    expect((execSchema?.parameters as any).properties.command.type).toBe("string");
    expect((execSchema?.parameters as any).properties.timeoutMs.default).toBe(5000);
  });

  it("7. Genera adaptadores compatibles con AI SDK v7 y despacha handlers", async () => {
    registry.register(sampleReadFileTool);

    const aiSdkTools = registry.toAiSdkTools(() => mockContext);
    expect(aiSdkTools["fs_read_file"]).toBeDefined();
    expect(aiSdkTools["fs_read_file"].description).toContain("Lee el contenido");

    const result = await aiSdkTools["fs_read_file"].execute({ path: "README.md" });
    expect(result).toEqual({
      content: "Contenido simulado de README.md en sess_alpha_001"
    });
  });

  it("8. Clona sub-registros confinados para aislamiento de Sub-Egos", () => {
    registry.registerMany([sampleReadFileTool, sampleWriteFileTool, sampleExecTool]);

    // Sub-Ego con acceso confinado a solo lectura
    const readOnlyRegistry = registry.clone({ riskLevel: "safe" });
    expect(readOnlyRegistry.count()).toBe(1);
    expect(readOnlyRegistry.has("fs_read_file")).toBe(true);
    expect(readOnlyRegistry.has("terminal_exec")).toBe(false);

    // Modificar el registro clonado no afecta al registro global original
    readOnlyRegistry.unregister("fs_read_file");
    expect(readOnlyRegistry.count()).toBe(0);
    expect(registry.count()).toBe(3);
  });

  it("9. Desregistra herramientas y limpia el catálogo completamente", () => {
    registry.register(sampleReadFileTool);
    expect(registry.has("fs_read_file")).toBe(true);

    const unregistered = registry.unregister("fs_read_file");
    expect(unregistered).toBe(true);
    expect(registry.has("fs_read_file")).toBe(false);
    expect(registry.count()).toBe(0);

    registry.registerMany([sampleReadFileTool, sampleWriteFileTool]);
    expect(registry.count()).toBe(2);

    registry.clear();
    expect(registry.count()).toBe(0);
  });
});
