import { z } from "zod";
import type { ToolDefinition, ToolExecutionContext } from "@ego/tools";
import type { BackgroundEngine } from "./BackgroundEngine.js";
import type { TaskRecord } from "./types.js";

/**
 * BackgroundTaskTools — tool `manage_background_task` (EGO-FIND-50, Ola 1 / A3 / T6).
 *
 * PROBLEMA
 * ---------
 * `BackgroundEngine.submit/cancel/pause/resume/listTasks` era una API
 * **in-process** sin tool ni IPC: el agente no podía lanzar ni governar
 * tareas en background. El motor existía (con cola de prioridad, concurrencia,
 * timeout, retries, checkpoints y pause/resume) pero era inalcanzable desde
 * el turno del LLM.
 *
 * DISEÑO
 * ------
 * Una sola tool con un discriminante `action` (`create`, `list`, `get`,
 * `cancel`, `pause`, `resume`) para no inflar el catálogo de tools.
 *
 * - `create` requiere un **executor inyectado** (lo compone main: normalmente
 *   un turno de Sub-Ego). Sin executor, la acción falla con un error claro
 *   (fail-closed): la tool nunca "inventa" trabajo.
 * - `cancel`/`pause` son mutaciones del ciclo de vida → `riskLevel: sensitive`
 *   y `requiresApproval: true`.
 * - `list`/`get` son de solo lectura → `riskLevel: safe`.
 *
 * NOTA DE DEPENDENCIAS
 * --------------------
 * Ola 1b T5: `@ego/tasks` **ya depende** de `@ego/tools` y usa sus tipos
 * REALES (`ToolDefinition`, `ToolExecutionContext`) en vez de los espejos
 * estructurales que la Ola 1 declaraba (la taxonomía de categorías/riesgos
 * estaba duplicada en dos sitios: cada cambio de la taxonomía obligaba a
 * cambiarla dos veces y las dos podían divergir).
 */

/** Contexto que recibe el executor de la tarea en background. */
export interface BackgroundTaskRequest {
  readonly taskId: string;
  readonly title: string;
  readonly description: string;
  readonly subEgoId?: string;
  readonly projectId?: string;
  readonly input?: unknown;
}

/**
 * Ejecutor de la tarea en background. Lo inyecta la composición (main):
 * normalmente ejecuta un turno de Sub-Ego con el modelo.
 */
export type BackgroundTaskExecutor = (
  request: BackgroundTaskRequest,
  context: ToolExecutionContext
) => Promise<unknown>;

/** Opciones de la tool. */
export interface BackgroundTaskToolOptions {
  /** Ejecutor para la acción `create`. Sin él, `create` falla (fail-closed). */
  executor?: BackgroundTaskExecutor;
  /** Sub-Ego por defecto al que se asignan las tareas creadas. */
  defaultSubEgoId?: string;
  /** Timeout por defecto de las tareas creadas (ms). */
  defaultTimeoutMs?: number;
  /** Máximo de tareas devueltas por `list`. */
  maxListLimit?: number;
}

/** Superficie mínima de registro de tools (compatible con `ToolRegistry`). */
export interface BackgroundTaskToolSink {
  register(tool: ToolDefinition, options?: { allowOverride?: boolean }): void;
  has?(name: string): boolean;
}

const ActionSchema = z.enum(["create", "list", "get", "cancel", "pause", "resume"]);

const ManageBackgroundTaskInputSchema = z.object({
  action: ActionSchema.describe(
    "Operación a realizar: create (lanzar), list (enumerar), get (consultar), cancel, pause, resume."
  ),
  taskId: z
    .string()
    .min(1)
    .optional()
    .describe("Identificador de la tarea (obligatorio en get/cancel/pause/resume)."),
  title: z.string().min(1).optional().describe("Título de la tarea (obligatorio en create)."),
  description: z
    .string()
    .max(4000)
    .optional()
    .describe("Descripción/instrucción de la tarea (create)."),
  subEgoId: z.string().min(1).optional().describe("Sub-Ego ejecutor de la tarea (create)."),
  projectId: z.string().min(1).optional().describe("Proyecto de la tarea (create)."),
  priority: z
    .enum(["low", "normal", "high", "critical"])
    .default("normal")
    .describe("Prioridad de la tarea (create)."),
  timeoutMs: z.number().int().min(1000).max(3_600_000).optional().describe("Timeout (create)."),
  status: z
    .array(z.enum(["submitted", "queued", "running", "paused", "completed", "failed", "cancelled"]))
    .optional()
    .describe("Filtro de estados para `list`."),
  limit: z.number().int().min(1).max(200).optional().describe("Máximo de tareas a listar."),
});

export type ManageBackgroundTaskInput = z.infer<typeof ManageBackgroundTaskInputSchema>;

/** Resultado serializable de la tool. */
export interface ManageBackgroundTaskOutput {
  readonly ok: boolean;
  readonly action: string;
  readonly task?: TaskRecord;
  readonly tasks?: TaskRecord[];
  readonly message?: string;
}

/**
 * Crea la definición de la tool `manage_background_task`.
 */
export function createBackgroundTaskTool(
  engine: BackgroundEngine,
  options: BackgroundTaskToolOptions = {}
): ToolDefinition {
  const maxListLimit = options.maxListLimit ?? 50;

  return {
    name: "manage_background_task",
    description:
      "Gestiona tareas en background: create (lanzar una tarea), list (enumerar), get (consultar una), cancel, pause y resume.",
    category: "system",
    riskLevel: "sensitive",
    origin: "custom",
    requiresApproval: true,
    tags: ["tasks", "background", "orchestration"],
    inputSchema: ManageBackgroundTaskInputSchema,
    execute: async (
      input: ManageBackgroundTaskInput,
      context: ToolExecutionContext
    ): Promise<ManageBackgroundTaskOutput> => {
      switch (input.action) {
        case "create": {
          if (!options.executor) {
            throw new Error(
              "manage_background_task: la acción 'create' no está disponible porque no hay ejecutor de tareas configurado en esta composición."
            );
          }
          if (!input.title) {
            throw new Error("manage_background_task: la acción 'create' exige 'title'.");
          }
          const taskId = `bg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const description = input.description ?? input.title;
          const subEgoId = input.subEgoId ?? options.defaultSubEgoId ?? context.subEgoId;

          const record = engine.submit({
            id: taskId,
            title: input.title,
            description,
            subEgoId,
            priority: input.priority,
            timeoutMs: input.timeoutMs ?? options.defaultTimeoutMs,
            metadata: {
              projectId: input.projectId ?? context.projectId,
              origin: "manage_background_task",
            },
            execute: async (taskContext) => {
              return options.executor!(
                {
                  taskId,
                  title: input.title!,
                  description,
                  subEgoId,
                  projectId: input.projectId ?? context.projectId,
                },
                {
                  ...context,
                  abortSignal: taskContext.signal,
                }
              );
            },
          });

          return { ok: true, action: "create", task: record };
        }

        case "list": {
          const limit = Math.min(input.limit ?? maxListLimit, maxListLimit);
          const tasks = engine.listTasks({
            status: input.status,
            subEgoId: input.subEgoId,
            limit,
          });
          return { ok: true, action: "list", tasks };
        }

        case "get": {
          if (!input.taskId) {
            throw new Error("manage_background_task: la acción 'get' exige 'taskId'.");
          }
          const task = engine.getTask(input.taskId);
          if (!task) {
            return {
              ok: false,
              action: "get",
              message: `Tarea '${input.taskId}' no encontrada.`,
            };
          }
          return { ok: true, action: "get", task };
        }

        case "cancel": {
          if (!input.taskId) {
            throw new Error("manage_background_task: la acción 'cancel' exige 'taskId'.");
          }
          const cancelled = engine.cancel(input.taskId, "Cancelada por el agente vía manage_background_task");
          const task = engine.getTask(input.taskId);
          return {
            ok: cancelled,
            action: "cancel",
            task,
            message: cancelled
              ? `Tarea '${input.taskId}' cancelada.`
              : `La tarea '${input.taskId}' no estaba en un estado cancelable.`,
          };
        }

        case "pause": {
          if (!input.taskId) {
            throw new Error("manage_background_task: la acción 'pause' exige 'taskId'.");
          }
          const paused = engine.pause(input.taskId);
          const task = engine.getTask(input.taskId);
          return {
            ok: paused,
            action: "pause",
            task,
            message: paused
              ? `Tarea '${input.taskId}' pausada.`
              : `La tarea '${input.taskId}' no estaba en un estado pausable.`,
          };
        }

        case "resume": {
          if (!input.taskId) {
            throw new Error("manage_background_task: la acción 'resume' exige 'taskId'.");
          }
          const resumed = engine.resume(input.taskId);
          const task = engine.getTask(input.taskId);
          return {
            ok: resumed,
            action: "resume",
            task,
            message: resumed
              ? `Tarea '${input.taskId}' reanudada.`
              : `La tarea '${input.taskId}' no estaba pausada.`,
          };
        }

        default:
          throw new Error(`manage_background_task: acción no soportada '${String(input.action)}'.`);
      }
    },
  };
}

/**
 * Registra la tool `manage_background_task` en un registro de tools.
 */
export function registerBackgroundTaskTools(
  registry: BackgroundTaskToolSink,
  engine: BackgroundEngine,
  options: BackgroundTaskToolOptions = {}
): ToolDefinition[] {
  const tool = createBackgroundTaskTool(engine, options);
  if (typeof registry.has === "function" && registry.has(tool.name)) {
    return [tool];
  }
  registry.register(tool);
  return [tool];
}
