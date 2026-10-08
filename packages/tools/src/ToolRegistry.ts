import { z } from "zod";
import {
  ToolDefinition,
  ToolExecutionContext,
  ToolFilter,
  ToolJsonSchema,
  AiSdkToolAdapter
} from "./types.js";
import { zodToJsonSchema } from "./schema-converter.js";

/**
 * Registro declarativo central de herramientas desacoplado del Cognitive Runtime (ACT-01).
 *
 * Responsabilidades:
 * 1. Catálogo inmutable y validación estricta de definiciones de herramientas.
 * 2. Clasificación taxonómica por categoría y nivel de riesgo operacional.
 * 3. Validación de entradas mediante esquemas Zod en tiempo de ejecución.
 * 4. Determinación de requisitos de aprobación humana (HITL).
 * 5. Exportación a JSON Schema estándar y adaptador compatible con AI SDK v7.
 * 6. Soporte de aislamiento para Sub-Egos mediante clonación filtrada.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  constructor(initialTools?: ToolDefinition[]) {
    if (initialTools) {
      this.registerMany(initialTools);
    }
  }

  /**
   * Registra una herramienta en el catálogo.
   * Lanza excepción si el nombre es inválido o ya se encuentra registrado (salvo que allowOverride sea true).
   */
  public register(
    tool: ToolDefinition,
    options: { allowOverride?: boolean } = {}
  ): void {
    this.validateToolDefinition(tool);

    const existing = this.tools.get(tool.name);
    if (existing && !options.allowOverride) {
      throw new Error(
        `[ToolRegistry] Herramienta duplicada: ya existe una herramienta registrada con el nombre "${tool.name}". Usa allowOverride: true para sobrescribir.`
      );
    }

    this.tools.set(tool.name, Object.freeze({ ...tool }));
  }

  /**
   * Registra un lote de herramientas.
   */
  public registerMany(
    tools: ToolDefinition[],
    options: { allowOverride?: boolean } = {}
  ): void {
    for (const tool of tools) {
      this.register(tool, options);
    }
  }

  /**
   * Elimina una herramienta del catálogo por su nombre.
   * Retorna true si fue eliminada, false si no existía.
   */
  public unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Obtiene la definición de una herramienta por nombre exacto.
   */
  public get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Verifica si existe una herramienta registrada con el nombre dado.
   */
  public has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Retorna la cantidad total de herramientas registradas.
   */
  public count(): number {
    return this.tools.size;
  }

  /**
   * Limpia todo el catálogo de herramientas.
   */
  public clear(): void {
    this.tools.clear();
  }

  /**
   * Lista herramientas registradas aplicando filtros opcionales.
   */
  public list(filter?: ToolFilter): ToolDefinition[] {
    let result = Array.from(this.tools.values());

    if (!filter) {
      return result;
    }

    if (filter.category) {
      const categories = Array.isArray(filter.category)
        ? new Set(filter.category)
        : new Set([filter.category]);
      result = result.filter((t) => categories.has(t.category));
    }

    if (filter.riskLevel) {
      const risks = Array.isArray(filter.riskLevel)
        ? new Set(filter.riskLevel)
        : new Set([filter.riskLevel]);
      result = result.filter((t) => risks.has(t.riskLevel));
    }

    if (filter.origin) {
      const origins = Array.isArray(filter.origin)
        ? new Set(filter.origin)
        : new Set([filter.origin]);
      result = result.filter((t) => origins.has(t.origin));
    }

    if (filter.mcpServerId) {
      result = result.filter((t) => t.mcpServerId === filter.mcpServerId);
    }

    if (filter.tag) {
      result = result.filter((t) => t.tags?.includes(filter.tag!));
    }

    if (filter.search) {
      const query = filter.search.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query)
      );
    }

    return result;
  }

  /**
   * Valida parámetros crudos de entrada contra el esquema Zod de la herramienta.
   */
  public validateInput<T = any>(
    name: string,
    rawInput: unknown
  ): { success: true; data: T } | { success: false; error: z.ZodError } {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`[ToolRegistry] Herramienta "${name}" no encontrada en el registro.`);
    }

    const parseResult = tool.inputSchema.safeParse(rawInput);
    if (parseResult.success) {
      return { success: true, data: parseResult.data as T };
    } else {
      return { success: false, error: parseResult.error };
    }
  }

  /**
   * Resuelve si una herramienta requiere aprobación humana (HITL) obligatoria.
   * Regla canónica:
   * 1. Si requiresApproval está explícitamente fijado en la definición, prevalece.
   * 2. Si es "destructive", siempre requiere aprobación (true).
   * 3. Si es "sensitive", requiere aprobación por defecto (true).
   * 4. Si es "safe", no requiere aprobación (false).
   */
  public resolveApprovalRequirement(toolOrName: string | ToolDefinition): boolean {
    const tool =
      typeof toolOrName === "string" ? this.tools.get(toolOrName) : toolOrName;

    if (!tool) {
      throw new Error(`[ToolRegistry] Herramienta no encontrada para evaluar política de aprobación.`);
    }

    if (typeof tool.requiresApproval === "boolean") {
      return tool.requiresApproval;
    }

    switch (tool.riskLevel) {
      case "destructive":
        return true;
      case "sensitive":
        return true;
      case "safe":
      default:
        return false;
    }
  }

  /**
   * Exporta las especificaciones a JSON Schema estándar para consumo por modelos o MCP.
   */
  public exportJsonSchemas(filter?: ToolFilter): ToolJsonSchema[] {
    const tools = this.list(filter);
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.inputSchema),
      category: tool.category,
      riskLevel: tool.riskLevel,
      requiresApproval: this.resolveApprovalRequirement(tool),
      origin: tool.origin,
      mcpServerId: tool.mcpServerId,
      tags: tool.tags ? Array.from(tool.tags) : []
    }));
  }

  /**
   * Convierte las herramientas registradas en un mapa compatible con AI SDK v7 (`CoreTool`).
   */
  public toAiSdkTools(
    contextFactory?: (toolName: string) => ToolExecutionContext
  ): Record<string, AiSdkToolAdapter> {
    const result: Record<string, AiSdkToolAdapter> = {};

    for (const [name, tool] of this.tools.entries()) {
      result[name] = {
        description: tool.description,
        parameters: tool.inputSchema,
        execute: async (args: any) => {
          const context = contextFactory
            ? contextFactory(name)
            : {
                callId: `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                sessionId: "default_session"
              };
          return tool.execute(args, context);
        }
      };
    }

    return result;
  }

  /**
   * Crea una instancia clonada e independiente con un subconjunto filtrado de herramientas.
   * Utilizado para instanciar sub-registros confinados para Sub-Egos específicos.
   */
  public clone(filter?: ToolFilter): ToolRegistry {
    const filteredTools = this.list(filter);
    return new ToolRegistry(filteredTools);
  }

  /**
   * Validación interna de coherencia de una definición de herramienta.
   */
  private validateToolDefinition(tool: ToolDefinition): void {
    if (!tool) {
      throw new Error("[ToolRegistry] La definición de herramienta no puede ser nula.");
    }
    if (!tool.name || typeof tool.name !== "string" || tool.name.trim().length === 0) {
      throw new Error("[ToolRegistry] La herramienta debe tener un nombre no vacío.");
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(tool.name)) {
      throw new Error(
        `[ToolRegistry] El nombre de la herramienta "${tool.name}" contiene caracteres inválidos. Solo se permiten letras, números, guiones y guiones bajos.`
      );
    }
    if (!tool.description || typeof tool.description !== "string" || tool.description.trim().length === 0) {
      throw new Error(`[ToolRegistry] La herramienta "${tool.name}" debe tener una descripción válida.`);
    }
    if (
      !tool.inputSchema ||
      typeof tool.inputSchema !== "object" ||
      !("safeParse" in tool.inputSchema) ||
      typeof (tool.inputSchema as any).safeParse !== "function"
    ) {
      throw new Error(`[ToolRegistry] La herramienta "${tool.name}" debe tener un inputSchema válido (ZodType o compatible con safeParse).`);
    }
    if (typeof tool.execute !== "function") {
      throw new Error(`[ToolRegistry] La herramienta "${tool.name}" debe proporcionar un handler ejecutable.`);
    }
  }
}
