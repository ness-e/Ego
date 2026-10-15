import { z } from "zod";
import type { ToolDefinition, ToolExecutionContext } from "@ego/tools";
import {
  DelegationRouter,
  DelegationValidationError,
  DEFAULT_FANOUT_CONCURRENCY,
  type DelegationCallContext,
  type StructuredChildOutput,
  type SubEgoChildRole,
} from "./DelegationRouter.js";
import type { DelegationResult } from "./types.js";

/**
 * Nombres canónicos de las tools de delegación (STAB-04).
 * `delegate_task` coincide con `BLOCKED_CHILD_TOOLS` para que el
 * enforcement por rol aplique sin alias adicionales.
 */
export const DELEGATION_TOOL_NAMES = [
  "delegate_task",
  "delegate_many",
  "delegation_steer",
  "delegation_stop",
  "delegation_list_active",
  "delegation_drain_steer",
] as const;

export type DelegationToolName = (typeof DELEGATION_TOOL_NAMES)[number];

/** Opciones de la factoría de tools de delegación. */
export interface DelegationToolOptions {
  /** Concurrencia por defecto de `delegate_many` (default: 3). */
  maxConcurrency?: number;
}

/** Superficie mínima de registro (estructural: evita importar la clase). */
export interface DelegationToolRegistry {
  register(tool: ToolDefinition): void;
}

const nonBlank = (field: string) =>
  z
    .string()
    .min(1, `${field} no puede estar vacío.`)
    .refine((s) => s.trim().length > 0, `${field} no puede estar en blanco.`);

const DelegateTaskToolSchema = z.object({
  goal: nonBlank("goal").describe("Objetivo en una frase accionable (obligatorio)."),
  context: nonBlank("context").describe("Contexto fresco y autocontenido (obligatorio)."),
  targetEgoId: nonBlank("targetEgoId").describe("Sub-Ego especialista destinatario."),
  projectId: z.string().optional().describe("Proyecto activo (default: ctx.projectId)."),
  callerEgoId: z.string().optional().describe("Emisor (default: ctx.subEgoId o 'user')."),
  role: z.enum(["leaf", "orchestrator"]).default("leaf"),
  maxIterations: z.number().int().min(1).default(10),
  model: z.string().optional(),
  timeoutMs: z.number().positive().optional(),
  treeId: z.string().optional(),
  projectAgentsMd: z.string().optional(),
  maxSpawnDepth: z.number().int().min(0).optional(),
});

type DelegateTaskToolInput = z.infer<typeof DelegateTaskToolSchema>;

const StructuredOutputSchema = z.object({
  summary: z.string(),
  findings: z.array(z.string()),
  files: z.array(z.string()),
  issues: z.array(z.string()),
});

const DelegationResultSchema = z.object({
  delegationId: z.string(),
  projectId: z.string(),
  callerEgoId: z.string(),
  targetEgoId: z.string(),
  status: z.string(),
  output: StructuredOutputSchema.optional(),
  error: z.string().optional(),
  depth: z.number(),
  durationMs: z.number(),
  callChain: z.array(z.string()),
});

function resolveCallerEgoId(input: { callerEgoId?: string }, ctx: ToolExecutionContext): string {
  const fromInput = (input.callerEgoId ?? "").trim();
  if (fromInput.length > 0) return fromInput;
  const fromCtx = (ctx.subEgoId ?? "").trim();
  if (fromCtx.length > 0) return fromCtx;
  const fromExtra = String(ctx.extra?.["callerEgoId"] ?? "").trim();
  if (fromExtra.length > 0) return fromExtra;
  return "user";
}

function resolveProjectId(input: { projectId?: string }, ctx: ToolExecutionContext): string {
  const fromInput = (input.projectId ?? "").trim();
  if (fromInput.length > 0) return fromInput;
  const fromCtx = (ctx.projectId ?? "").trim();
  if (fromCtx.length > 0) return fromCtx;
  const fromExtra = String(ctx.extra?.["projectId"] ?? "").trim();
  if (fromExtra.length > 0) return fromExtra;
  throw new DelegationValidationError(
    "delegate_task requiere 'projectId' (input o ctx.projectId); sin proyecto no hay delegación (fail-closed)."
  );
}

function callerChildRole(ctx: ToolExecutionContext): SubEgoChildRole | undefined {
  const role = ctx.extra?.["childRole"];
  return role === "leaf" || role === "orchestrator" ? role : undefined;
}

function parentContextOf(ctx: ToolExecutionContext): DelegationCallContext | undefined {
  const parent = ctx.extra?.["delegationParentContext"];
  return typeof parent === "object" && parent !== null
    ? (parent as DelegationCallContext)
    : undefined;
}

/** Capa 1 anti-recursión: un hijo leaf nunca invoca delegación (el router re-bloquea). */
function assertCallerMayDelegate(router: DelegationRouter, ctx: ToolExecutionContext): void {
  if (callerChildRole(ctx) === "leaf") {
    router.assertChildToolAllowed("leaf", "delegate_task");
  }
}

function normalizeConcurrency(raw: unknown, fallback: number): number {
  const base = Number.isFinite(raw) && (raw as number) >= 1 ? Math.floor(raw as number) : fallback;
  return Number.isFinite(base) && base >= 1 ? base : DEFAULT_FANOUT_CONCURRENCY;
}

function delegateTaskInputOf(
  item: DelegateTaskToolInput,
  ctx: ToolExecutionContext
): DelegateTaskToolInput & { projectId: string; callerEgoId: string } {
  return {
    ...item,
    projectId: resolveProjectId(item, ctx),
    callerEgoId: resolveCallerEgoId(item, ctx),
  };
}

/**
 * Crea las tools de delegación sobre un `DelegationRouter` (STAB-04).
 * Cobertura: validate + assertChildToolAllowed + normalizeStructuredOutput
 * (vía `router.delegateTask`) + control vivo (steer/stop/list/drain).
 * Sin reintentos automáticos: los errores `Delegation*Error` se propagan
 * y el ExecutionManager los convierte en resultado `failed`.
 */
export function createDelegationTools(
  router: DelegationRouter,
  options: DelegationToolOptions = {}
): ToolDefinition[] {
  const defaultConcurrency = normalizeConcurrency(
    options.maxConcurrency,
    DEFAULT_FANOUT_CONCURRENCY
  );

  const delegateTask: ToolDefinition = {
    name: "delegate_task",
    description:
      "Delega una sub-tarea a un Sub-Ego especialista. Requiere goal y context frescos no vacíos. Retorna salida estructurada {summary, findings, files, issues}.",
    category: "system",
    riskLevel: "sensitive",
    origin: "custom",
    requiresApproval: false,
    tags: ["delegation", "subego", "orchestration"],
    inputSchema: DelegateTaskToolSchema,
    outputSchema: DelegationResultSchema,
    execute: async (
      input: DelegateTaskToolInput,
      ctx: ToolExecutionContext
    ): Promise<DelegationResult<StructuredChildOutput>> => {
      assertCallerMayDelegate(router, ctx);
      const resolved = delegateTaskInputOf(input, ctx);
      return router.delegateTask({
        goal: resolved.goal,
        context: resolved.context,
        role: resolved.role,
        maxIterations: resolved.maxIterations,
        projectId: resolved.projectId,
        callerEgoId: resolved.callerEgoId,
        targetEgoId: resolved.targetEgoId,
        timeoutMs: resolved.timeoutMs,
        treeId: resolved.treeId,
        model: resolved.model,
        projectAgentsMd: resolved.projectAgentsMd,
        parentContext: parentContextOf(ctx),
        maxSpawnDepth: resolved.maxSpawnDepth,
      });
    },
  };

  const delegateMany: ToolDefinition = {
    name: "delegate_many",
    description:
      "Fan-out de N delegaciones con concurrencia acotada (default 3) y orden preservado. Cada ítem se valida y normaliza como delegate_task.",
    category: "system",
    riskLevel: "sensitive",
    origin: "custom",
    requiresApproval: false,
    tags: ["delegation", "subego", "fanout"],
    inputSchema: z.object({
      items: z.array(DelegateTaskToolSchema).min(1).describe("Delegaciones a ejecutar."),
      maxConcurrency: z.number().int().min(1).optional(),
      preserveOrder: z.boolean().default(true),
    }),
    execute: async (
      input: { items: DelegateTaskToolInput[]; maxConcurrency?: number; preserveOrder?: boolean },
      ctx: ToolExecutionContext
    ): Promise<Array<DelegationResult<StructuredChildOutput>>> => {
      assertCallerMayDelegate(router, ctx);
      const parent = parentContextOf(ctx);
      const resolved = input.items.map((item) => ({
        ...delegateTaskInputOf(item, ctx),
        parent,
      }));
      for (const item of resolved) {
        router.validateDelegateTaskInput({
          goal: item.goal,
          context: item.context,
          role: item.role,
          maxIterations: item.maxIterations,
          projectId: item.projectId,
          callerEgoId: item.callerEgoId,
          targetEgoId: item.targetEgoId,
        });
      }
      const maxConcurrency = normalizeConcurrency(input.maxConcurrency, defaultConcurrency);
      const results: Array<DelegationResult<StructuredChildOutput> | undefined> = new Array(
        resolved.length
      );
      let nextIndex = 0;
      const worker = async (): Promise<void> => {
        while (true) {
          const idx = nextIndex;
          nextIndex += 1;
          if (idx >= resolved.length) return;
          const item = resolved[idx];
          if (item === undefined) return; // Inalcanzable: idx < resolved.length (narrowing TS noUncheckedIndexedAccess)
          results[idx] = await router.delegateTask({
            goal: item.goal,
            context: item.context,
            role: item.role,
            maxIterations: item.maxIterations,
            projectId: item.projectId,
            callerEgoId: item.callerEgoId,
            targetEgoId: item.targetEgoId,
            timeoutMs: item.timeoutMs,
            treeId: item.treeId,
            model: item.model,
            projectAgentsMd: item.projectAgentsMd,
            parentContext: item.parent,
            maxSpawnDepth: item.maxSpawnDepth,
          });
        }
      };
      const workerCount = Math.min(maxConcurrency, resolved.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));
      const filled = results as Array<DelegationResult<StructuredChildOutput>>;
      return input.preserveOrder ?? true ? filled : [...filled];
    },
  };

  const steer: ToolDefinition = {
    name: "delegation_steer",
    description:
      "Encola una instrucción out-of-band para una delegación viva; el hijo la consume en el boundary (no interrumpe a mitad de token).",
    category: "system",
    riskLevel: "sensitive",
    origin: "custom",
    requiresApproval: false,
    tags: ["delegation", "steer"],
    inputSchema: z.object({
      delegationId: nonBlank("delegationId"),
      instruction: nonBlank("instruction"),
    }),
    execute: async (input: { delegationId: string; instruction: string }): Promise<boolean> =>
      router.steer(input.delegationId, input.instruction),
  };

  const stop: ToolDefinition = {
    name: "delegation_stop",
    description:
      "Solicita cancelación cooperativa de una delegación viva; se hace efectiva al boundary con output parcial.",
    category: "system",
    riskLevel: "sensitive",
    origin: "custom",
    requiresApproval: false,
    tags: ["delegation", "stop"],
    inputSchema: z.object({
      delegationId: nonBlank("delegationId"),
      partial: z.unknown().optional().describe("Output parcial a preservar."),
    }),
    execute: async (input: { delegationId: string; partial?: unknown }): Promise<boolean> =>
      router.stop(input.delegationId, input.partial),
  };

  const listActive: ToolDefinition = {
    name: "delegation_list_active",
    description: "Lista delegaciones vivas, opcionalmente filtradas por árbol (treeId).",
    category: "system",
    riskLevel: "safe",
    origin: "custom",
    requiresApproval: false,
    tags: ["delegation", "observe"],
    inputSchema: z.object({ treeId: z.string().optional() }),
    execute: async (input: { treeId?: string }): Promise<unknown> =>
      router.listActive(input.treeId),
  };

  const drainSteer: ToolDefinition = {
    name: "delegation_drain_steer",
    description:
      "Consume y limpia la cola out-of-band de una delegación (llamar en el boundary del hijo).",
    category: "system",
    riskLevel: "safe",
    origin: "custom",
    requiresApproval: false,
    tags: ["delegation", "steer"],
    inputSchema: z.object({ delegationId: nonBlank("delegationId") }),
    execute: async (input: { delegationId: string }): Promise<string[]> =>
      router.drainSteer(input.delegationId),
  };

  return [delegateTask, delegateMany, steer, stop, listActive, drainSteer];
}

/**
 * Registra las tools de delegación en un `ToolRegistry` (o superficie
 * compatible). La composición (p. ej. desktop main) decide cuándo llamar.
 */
export function registerDelegationTools(
  registry: DelegationToolRegistry,
  router: DelegationRouter,
  options: DelegationToolOptions = {}
): ToolDefinition[] {
  const tools = createDelegationTools(router, options);
  for (const tool of tools) {
    registry.register(tool);
  }
  return tools;
}
