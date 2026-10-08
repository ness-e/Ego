import { z } from "zod";

/**
 * Categorías funcionales canónicas de herramientas en Ego (Decisión P23, docs/engineering/integraciones.md).
 */
export type ToolCategory =
  | "filesystem"
  | "git"
  | "terminal"
  | "web"
  | "system"
  | "mcp";

/**
 * Nivel de riesgo operacional para gobernanza HITL (Human-in-the-Loop).
 * - safe: Solo lectura o inspección; sin efectos secundarios (ej. fs.readFile, git.status).
 * - sensitive: Mutaciones locales confinadas al workspace (ej. fs.writeFile, git.commit).
 * - destructive: Acciones de alto impacto, borrado o ejecución de comandos externos (ej. terminal.exec, rm -rf, network calls).
 */
export type ToolRiskLevel = "safe" | "sensitive" | "destructive";

/**
 * Procedencia del conector o herramienta.
 */
export type ToolOrigin = "native" | "mcp" | "custom" | "skill";

/**
 * Contexto de ejecución inyectado en cada invocación de herramienta.
 */
export interface ToolExecutionContext {
  callId: string;
  sessionId: string;
  subEgoId?: string;
  workspacePath?: string;
  abortSignal?: AbortSignal;
  extra?: Record<string, unknown>;
}

/**
 * Contrato declarativo inmutable de una herramienta registrada en Ego.
 */
export interface ToolDefinition<TInput = any, TOutput = any> {
  readonly name: string;
  readonly description: string;
  readonly category: ToolCategory;
  readonly riskLevel: ToolRiskLevel;
  readonly inputSchema: z.ZodType<TInput>;
  readonly outputSchema?: z.ZodType<TOutput>;
  readonly requiresApproval?: boolean;
  readonly origin: ToolOrigin;
  readonly mcpServerId?: string;
  readonly tags?: readonly string[];
  readonly execute: (input: TInput, context: ToolExecutionContext) => Promise<TOutput>;
}

/**
 * Criterios de filtrado para consulta de herramientas.
 */
export interface ToolFilter {
  category?: ToolCategory | ToolCategory[];
  riskLevel?: ToolRiskLevel | ToolRiskLevel[];
  origin?: ToolOrigin | ToolOrigin[];
  mcpServerId?: string;
  tag?: string;
  search?: string;
}

/**
 * Representación serializable JSON Schema compatible con modelos y protocolos estándar.
 */
export interface ToolJsonSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  category: ToolCategory;
  riskLevel: ToolRiskLevel;
  requiresApproval: boolean;
  origin: ToolOrigin;
  mcpServerId?: string;
  tags: string[];
}

/**
 * Adaptador de compatibilidad para AI SDK v7 (`CoreTool`).
 */
export interface AiSdkToolAdapter<TInput = any, TOutput = any> {
  description: string;
  parameters: z.ZodType<TInput>;
  execute: (args: TInput) => Promise<TOutput>;
}
