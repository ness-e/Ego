import { randomUUID } from "node:crypto";
import type {
  SubEgoManifest,
  SubEgoInstance,
  DelegationRequest,
  DelegationResult,
  DelegationStatus
} from "./types.js";
import type { SubEgoRuntime } from "./SubEgoRuntime.js";
import type { SubEgoRegistry } from "./SubEgoRegistry.js";
import type { SharedMemory } from "./SharedMemory.js";

/**
 * Error base para fallos del enrutador de delegación.
 */
export class DelegationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DelegationError";
  }
}

/**
 * Error cuando el Sub-Ego destino no existe en el catálogo ni en memoria.
 */
export class DelegationNotFoundError extends DelegationError {
  constructor(public readonly targetEgoId: string) {
    super(`Sub-Ego destino '${targetEgoId}' no encontrado para delegación.`);
    this.name = "DelegationNotFoundError";
  }
}

/**
 * Error cuando el Sub-Ego emisor carece de permisos para delegar en el destino.
 */
export class DelegationPermissionError extends DelegationError {
  constructor(public readonly callerEgoId: string, public readonly targetEgoId: string) {
    super(
      `Sub-Ego emisor '${callerEgoId}' no tiene permiso para delegar en '${targetEgoId}'. Requiere 'delegate:${targetEgoId}' o 'delegate:*'.`
    );
    this.name = "DelegationPermissionError";
  }
}

/**
 * Error cuando la profundidad de delegación supera el límite configurado.
 */
export class DelegationMaxDepthError extends DelegationError {
  constructor(public readonly depth: number, public readonly maxDepth: number, public readonly chain: string[]) {
    super(
      `Profundidad máxima de delegación superada (${depth} > ${maxDepth}). Cadena de llamadas: ${chain.join(" -> ")}`
    );
    this.name = "DelegationMaxDepthError";
  }
}

/**
 * Error cuando se detecta un ciclo recursivo en la cadena de delegación.
 */
export class DelegationCycleError extends DelegationError {
  constructor(public readonly targetEgoId: string, public readonly chain: string[]) {
    super(
      `Ciclo de delegación recursivo detectado hacia '${targetEgoId}'. Cadena de llamadas activa: ${chain.join(" -> ")} -> ${targetEgoId}`
    );
    this.name = "DelegationCycleError";
  }
}

/**
 * Error cuando la validación endurecida de `delegate_task` falla
 * (goal/context vacíos, rol inválido, profundidad no permitida).
 */
export class DelegationValidationError extends DelegationError {
  constructor(message: string) {
    super(message);
    this.name = "DelegationValidationError";
  }
}

/**
 * Error cuando un hijo intenta usar una tool bloqueada para su rol.
 */
export class DelegationBlockedToolError extends DelegationError {
  constructor(public readonly toolName: string, public readonly role: SubEgoChildRole) {
    super(
      `Tool '${toolName}' bloqueada para hijos con rol '${role}'.` +
        (toolName === "delegate_task"
          ? " Solo un hijo 'orchestrator' con max_spawn_depth>=1 puede subdividir."
          : " Herramientas hijas bloqueadas: clarify, memory-write, send_message, cronjob.")
    );
    this.name = "DelegationBlockedToolError";
  }
}

/**
 * Error cuando una delegación es detenida en vivo vía `stop()`.
 * Porta el output parcial disponible al boundary para no perder trabajo.
 */
export class DelegationStoppedError extends DelegationError {
  constructor(public readonly delegationId: string, public readonly partial?: unknown) {
    super(`La delegación '${delegationId}' fue detenida por el operador; se retorna output parcial al boundary.`);
    this.name = "DelegationStoppedError";
  }
}

/**
 * Concurrencia máxima por defecto para fan-out (tarea 2).
 */
export const DEFAULT_FANOUT_CONCURRENCY = 3;

/**
 * Profundidad máxima de subdivisión por defecto: plana depth 0 -> 1 (tarea 3).
 * Un hijo `orchestrator` solo se permite si max_spawn_depth >= 1.
 */
export const DEFAULT_MAX_SPAWN_DEPTH = 0;

/**
 * Modelo barato por defecto para hijos (tarea 7). Configurable por router y por rama.
 */
export const DEFAULT_CHILD_MODEL = "gpt-4o-mini";

/**
 * Tope de iteraciones por defecto para `delegate_task` (tarea 1).
 */
export const DEFAULT_MAX_ITERATIONS = 10;

/**
 * Fan-out de referencia para la advertencia de coste exponencial (tarea 3): coste ~= breadth^depth.
 */
export const SPAWN_COST_BREADTH = 3;

/**
 * Tools bloqueadas en hijos (tarea 4). `delegate_task` se bloquea salvo rol orchestrator.
 */
export const BLOCKED_CHILD_TOOLS: readonly string[] = Object.freeze([
  "delegate_task",
  "clarify",
  "memory-write",
  "memory_write",
  "send_message",
  "send-message",
  "cronjob",
  "cron"
]);
/**
 * Error cuando la sub-tarea excede el tiempo límite de ejecución.
 */
export class DelegationTimeoutError extends DelegationError {
  constructor(public readonly delegationId: string, public readonly timeoutMs: number) {
    super(`La delegación '${delegationId}' excedió el tiempo límite de ${timeoutMs}ms.`);
    this.name = "DelegationTimeoutError";
  }
}

/**
 * Contexto interno de seguimiento de la cadena jerárquica de delegación.
 */
export interface DelegationCallContext {
  depth: number;
  callChain: string[];
  /** Identificador del árbol de delegación raíz (para control vivo scoped). */
  treeId?: string;
  /** Rol del hijo en este nivel (leaf por defecto, orchestrator solo si max_spawn_depth>=1). */
  childRole?: SubEgoChildRole;
  /** Modelo barato asignado a la rama. */
  childModel?: string;
  /** Límite de iteraciones del hijo. */
  maxIterations?: number;
}

/**
 * Rol de un hijo delegado: hoja de trabajo o mini-orquestador.
 * - `leaf`: ejecuta la tarea, NO puede llamar a `delegate_task`.
 * - `orchestrator`: puede subdividir, solo si `max_spawn_depth >= 1`.
 */
export type SubEgoChildRole = "leaf" | "orchestrator";

/**
 * Contrato de salida estructurado exigido a todo hijo delegado.
 * - `summary`: qué hizo.
 * - `findings`: hallazgos.
 * - `files`: archivos tocados/leídos.
 * - `issues`: problemas / trabajo pendiente.
 */
export interface StructuredChildOutput {
  summary: string;
  findings: string[];
  files: string[];
  issues: string[];
}

/**
 * Entrada endurecida del tool `delegate_task`.
 */
export interface DelegateTaskInput {
  /** Objetivo en una frase accionable (obligatorio, no vacío). */
  goal: string;
  /** Contexto fresco y autocontenido (obligatorio, no vacío). */
  context: string;
  /** Rol del hijo (default: `leaf`). */
  role?: SubEgoChildRole;
  /** Tope de iteraciones del hijo (default: 10, mínimo 1). */
  maxIterations?: number;
  /** Proyecto activo. */
  projectId: string;
  /** Emisor (o "system" / "user"). */
  callerEgoId: string;
  /** Destinatario especialista. */
  targetEgoId: string;
  /** Timeout en ms (opcional). */
  timeoutMs?: number;
  /** Árbol de delegación al que pertenece (default: se genera raíz nueva). */
  treeId?: string;
  /** Modelo barato de la rama (default: childModel del router). */
  model?: string;
  /** Contenido de AGENTS.md del proyecto para herencia mínima (opcional). */
  projectAgentsMd?: string;
  /** Contexto de llamada jerárquica previa (uso interno recursivo). */
  parentContext?: DelegationCallContext;
  /** Límite de profundidad de subdivisión permitido para esta llamada (override puntual). */
  maxSpawnDepth?: number;
}

/**
 * Opciones de fan-out concurrente.
 */
export interface DelegationFanoutOptions {
  /** Concurrencia máxima (default: 3). */
  maxConcurrency?: number;
  /** Si se preserva el orden por índice de entrada (default: true). */
  preserveOrder?: boolean;
}

/**
 * Registro vivo de una delegación en curso (scoped al árbol).
 */
export interface ActiveDelegationRecord {
  delegationId: string;
  treeId: string;
  callerEgoId: string;
  targetEgoId: string;
  depth: number;
  startedAtMs: number;
  status: "running" | "completed" | "failed" | "stopped";
  /** Cola out-of-band de instrucciones de steer pendientes de consumir en el boundary. */
  steerQueue: string[];
  stopRequested: boolean;
  partialOutput?: unknown;
  model: string;
}

/**
 * Rollup de coste/tokens agregado por rama/árbol.
 */
export interface DelegationTreeRollup {
  treeId: string;
  branches: number;
  delegationIds: string[];
  totalTokens: number;
  totalCostUsd: number;
  model: string;
}

/**
 * Tipo de función ejecutora de tareas en una instancia de Sub-Ego.
 */
export type DelegationTaskExecutor = (
  instance: SubEgoInstance,
  request: DelegationRequest,
  context: DelegationCallContext
) => Promise<unknown>;

/**
 * Opciones para instanciar DelegationRouter.
 */
export interface DelegationRouterOptions {
  /** Runtime de Sub-Egos en memoria (obligatorio) */
  runtime: SubEgoRuntime;
  /** Registro persistente en VantaDB para resolución de manifiestos (opcional) */
  registry?: SubEgoRegistry;
  /** Gestor de memoria compartida para intercambio de payloads por referencia (opcional) */
  sharedMemory?: SharedMemory;
  /** Límite máximo de recursión / anidamiento de llamadas (default: 3) */
  maxDepth?: number;
  /** Timeout por defecto para sub-tareas en milisegundos (default: 30_000) */
  defaultTimeoutMs?: number;
  /** Si debe validar estrictamente los permisos del emisor (default: true) */
  enforcePermissions?: boolean;
  /** Ejecutor personalizado de tareas en el Sub-Ego activado */
  executor?: DelegationTaskExecutor;
  /** Hook opcional al iniciar una delegación */
  onDelegationStart?: (request: DelegationRequest, depth: number, callChain: string[]) => void;
  /** Hook opcional al completar una delegación */
  onDelegationComplete?: (result: DelegationResult) => void;
  /** Concurrencia máxima para fan-out delegateMany (default: 3, tarea 2). */
  maxConcurrency?: number;
  /** Profundidad máxima de subdivisión de hijos orchestrator (default: 0 = plano depth0->1, tarea 3). */
  maxSpawnDepth?: number;
  /** Modelo barato por defecto para hijos (default: gpt-4o-mini, tarea 7). */
  childModel?: string;
  /** Contenido de AGENTS.md del proyecto para herencia mínima en contexto hijo (tarea 1). */
  projectAgentsMd?: string;
}

const SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{8,}/g,
  /ghp_[A-Za-z0-9]{10,}/g,
  /AIza[0-9A-Za-z_-]{20,}/g,
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /(?:api[_-]?key|token|secret|password)\s*[:=]\s*["']?[A-Za-z0-9._-]{8,}["']?/gi
];

export function redactSecrets(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

/**
 * DelegationRouter (SUB-06 / Principios §4 y §7).
 * Protocolo de delegación jerárquica inter-Sub-Ego con prevención de ciclos infinitos,
 * límites estrictos de profundidad, validación de permisos y bus de contexto sobre SharedMemory.
 */
export class DelegationRouter {
  private readonly runtime: SubEgoRuntime;
  private readonly registry?: SubEgoRegistry;
  private readonly sharedMemory?: SharedMemory;
  private readonly maxDepth: number;
  private readonly defaultTimeoutMs: number;
  private readonly enforcePermissions: boolean;
  private readonly executor?: DelegationTaskExecutor;
  private readonly onDelegationStart?: (request: DelegationRequest, depth: number, callChain: string[]) => void;
  private readonly onDelegationComplete?: (result: DelegationResult) => void;
  private readonly maxConcurrency: number;
  private readonly maxSpawnDepth: number;
  private readonly childModel: string;
  private readonly projectAgentsMd?: string;
  private readonly activeDelegations: Map<string, ActiveDelegationRecord> = new Map();
  private readonly branchUsage: Map<string, { tokens: number; costUsd: number; model: string }> = new Map();

  constructor(options: DelegationRouterOptions) {
    this.runtime = options.runtime;
    this.registry = options.registry;
    this.sharedMemory = options.sharedMemory;
    this.maxDepth = options.maxDepth ?? 3;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 30_000;
    this.enforcePermissions = options.enforcePermissions ?? true;
    this.executor = options.executor;
    this.onDelegationStart = options.onDelegationStart;
    this.onDelegationComplete = options.onDelegationComplete;
    const mc = options.maxConcurrency ?? DEFAULT_FANOUT_CONCURRENCY;
    this.maxConcurrency = Number.isFinite(mc) && mc >= 1 ? Math.floor(mc) : DEFAULT_FANOUT_CONCURRENCY;
    const msd = options.maxSpawnDepth ?? DEFAULT_MAX_SPAWN_DEPTH;
    this.maxSpawnDepth = Number.isFinite(msd) && msd >= 0 ? Math.floor(msd) : DEFAULT_MAX_SPAWN_DEPTH;
    const cm = (options.childModel ?? DEFAULT_CHILD_MODEL).trim();
    this.childModel = cm.length > 0 ? cm : DEFAULT_CHILD_MODEL;
    this.projectAgentsMd = options.projectAgentsMd;
  }

  /**
   * Ejecuta una delegación jerárquica de un Sub-Ego emisor hacia un Sub-Ego especialista.
   *
   * @param request Datos de la solicitud de delegación.
   * @param parentContext Contexto de llamada jerárquica previa (utilizado internamente en delegaciones recursivas).
   */
  async delegate<TInput = unknown, TOutput = unknown>(
    request: DelegationRequest<TInput>,
    parentContext?: DelegationCallContext
  ): Promise<DelegationResult<TOutput>> {
    const startMs = Date.now();
    const delegationId = request.delegationId ?? `del_${randomUUID()}`;
    const callerId = request.callerEgoId;
    const targetId = request.targetEgoId;
    const timeoutMs = request.timeoutMs ?? this.defaultTimeoutMs;

    // 1. Cadena de llamadas y cálculo de profundidad
    const parentChain = parentContext?.callChain ?? (callerId ? [callerId] : []);
    const depth = (parentContext?.depth ?? 0) + 1;
    const fullChain = [...parentChain];
    if (!fullChain.includes(callerId)) {
      fullChain.push(callerId);
    }

    // 2. Detección y bloqueo de ciclos recursivos (A -> B -> A o auto-delegación A -> A)
    if (callerId === targetId || parentChain.includes(targetId)) {
      throw new DelegationCycleError(targetId, fullChain);
    }

    // 3. Control de profundidad máxima
    if (depth > this.maxDepth) {
      throw new DelegationMaxDepthError(depth, this.maxDepth, fullChain);
    }

    // 3a. Hijo leaf no puede subdividir (tarea 4): bloquea delegación anidada bajo rol leaf.
    if (parentContext?.childRole === "leaf") {
      throw new DelegationBlockedToolError("delegate_task", "leaf");
    }

    // 3b. Árbol y modelo de la rama (control vivo + rollup por rama, tarea 6-7).
    const meta = (request.metadata ?? {}) as Record<string, unknown>;
    const treeId =
      parentContext?.treeId ??
      (typeof meta["treeId"] === "string" && (meta["treeId"] as string).length > 0
        ? (meta["treeId"] as string)
        : delegationId);
    const branchModel =
      parentContext?.childModel ??
      (typeof meta["model"] === "string" && (meta["model"] as string).trim().length > 0
        ? ((meta["model"] as string).trim())
        : this.childModel);

    // 4. Resolución del manifiesto destino
    const targetManifest = await this.resolveManifest(targetId);
    if (!targetManifest) {
      throw new DelegationNotFoundError(targetId);
    }

    // 5. Validación de permisos del emisor (si no es origen raíz del sistema o usuario)
    if (this.enforcePermissions && callerId !== "system" && callerId !== "user") {
      const callerManifest = await this.resolveManifest(callerId);
      if (!callerManifest) {
        throw new DelegationPermissionError(callerId, targetId);
      }
      const hasPermission = this.checkDelegationPermission(callerManifest, targetId);
      if (!hasPermission) {
        throw new DelegationPermissionError(callerId, targetId);
      }
    }

    // 6. Preparación de contexto compartido sobre SharedMemory si está disponible
    let sharedContextKey = request.contextKey;
    if (this.sharedMemory && !sharedContextKey && request.input !== undefined) {
      sharedContextKey = `delegations/${delegationId}/input`;
      await this.sharedMemory.publish(
        request.projectId,
        sharedContextKey,
        request.input,
        {
          publishedBy: callerId,
          ttlMs: timeoutMs * 2
        }
      );
    }

    const currentContext: DelegationCallContext = {
      depth,
      callChain: [...fullChain, targetId],
      treeId,
      childRole:
        typeof meta["role"] === "string" && (meta["role"] === "leaf" || meta["role"] === "orchestrator")
          ? (meta["role"] as SubEgoChildRole)
          : parentContext?.childRole,
      childModel: branchModel,
      maxIterations:
        typeof meta["maxIterations"] === "number" && Number.isFinite(meta["maxIterations"])
          ? Math.max(1, Math.floor(meta["maxIterations"] as number))
          : parentContext?.maxIterations
    };

    // 6b. Registro vivo scoped al árbol (tarea 6). No altera el flujo si nadie usa list/steer/stop.
    const live: ActiveDelegationRecord = {
      delegationId,
      treeId,
      callerEgoId: callerId,
      targetEgoId: targetId,
      depth,
      startedAtMs: startMs,
      status: "running",
      steerQueue: [],
      stopRequested: this.activeDelegations.get(delegationId)?.stopRequested ?? false,
      partialOutput: this.activeDelegations.get(delegationId)?.partialOutput,
      model: branchModel
    };
    // Preservar steer encolado pre-ejecución (steer antes de que arranque el executor).
    const preExisting = this.activeDelegations.get(delegationId);
    if (preExisting && preExisting.steerQueue.length > 0) {
      live.steerQueue = [...preExisting.steerQueue];
    }
    this.activeDelegations.set(delegationId, live);

    // Cancelación al boundary previa a ejecutar (stop antes del executor).
    if (live.stopRequested) {
      live.status = "stopped";
      throw new DelegationStoppedError(delegationId, live.partialOutput);
    }

    // Emitir hook de inicio
    this.onDelegationStart?.(request, depth, fullChain);

    // 7. Activación de la instancia en memoria
    const targetInstance = this.runtime.getOrActivate(targetManifest);

    // 8. Ejecución con control de tiempo límite (Timeout)
    let output: TOutput | undefined;
    let error: string | undefined;
    let status: DelegationStatus = "completed";

    try {
      const execPromise = this.executeTask(targetInstance, request, currentContext);
      output = (await this.withTimeout(execPromise, timeoutMs, delegationId)) as TOutput;

      // Stop solicitado durante la ejecución: cancela al boundary con parcial (tarea 6).
      const liveAfter = this.activeDelegations.get(delegationId);
      if (liveAfter?.stopRequested) {
        liveAfter.status = "stopped";
        liveAfter.partialOutput = (output ?? liveAfter.partialOutput) as unknown;
        throw new DelegationStoppedError(delegationId, liveAfter.partialOutput);
      }

      // Si hay SharedMemory, almacenar también el resultado para desacoplar payloads pesados
      if (this.sharedMemory && output !== undefined) {
        const outputKey = `delegations/${delegationId}/output`;
        await this.sharedMemory.publish(
          request.projectId,
          outputKey,
          output,
          {
            publishedBy: targetId,
            ttlMs: timeoutMs * 2
          }
        );
      }
      this.recordBranchUsage(delegationId, output, branchModel);
    } catch (err: unknown) {
      if (err instanceof DelegationTimeoutError) {
        status = "timed_out";
        error = err.message;
      } else if (err instanceof DelegationStoppedError) {
        // Stop cooperativo: se propaga sin reclasificar a failed.
        const rec = this.activeDelegations.get(delegationId);
        if (rec) {
          rec.status = "stopped";
          rec.partialOutput = (err.partial ?? output ?? rec.partialOutput) as unknown;
        }
        throw err;
      } else {
        status = "failed";
        error = err instanceof Error ? err.message : String(err);
      }
      const rec = this.activeDelegations.get(delegationId);
      if (rec && !(err instanceof DelegationStoppedError)) {
        rec.status = "failed";
      }
      throw err;
    } finally {
      const durationMs = Date.now() - startMs;
      const result: DelegationResult<TOutput> = {
        delegationId,
        projectId: request.projectId,
        callerEgoId: callerId,
        targetEgoId: targetId,
        status,
        output,
        error,
        sharedContextKey,
        depth,
        durationMs,
        callChain: currentContext.callChain
      };

      this.onDelegationComplete?.(result);
      const rec = this.activeDelegations.get(delegationId);
      if (rec && rec.status === "running") {
        rec.status = status === "completed" ? "completed" : rec.status;
      }
    }

    const durationMs = Date.now() - startMs;
    return {
      delegationId,
      projectId: request.projectId,
      callerEgoId: callerId,
      targetEgoId: targetId,
      status,
      output,
      error,
      sharedContextKey,
      depth,
      durationMs,
      callChain: currentContext.callChain
    };
  }

  /**
   * Resuelve el manifiesto de un Sub-Ego buscando primero en el runtime y luego en el registro persistente.
   */
  private async resolveManifest(id: string): Promise<SubEgoManifest | undefined> {
    const fromRuntime = this.runtime.getManifest(id);
    if (fromRuntime) {
      return fromRuntime;
    }
    if (this.registry) {
      const fromRegistry = await this.registry.get(id);
      if (fromRegistry) {
        // Asegurar que el runtime conozca el manifiesto
        this.runtime.registerManifest(fromRegistry);
        return fromRegistry;
      }
    }
    return undefined;
  }

  /**
   * Comprueba si el manifiesto del Sub-Ego emisor contiene permisos de delegación hacia el destino.
   */
  private checkDelegationPermission(caller: SubEgoManifest, targetId: string): boolean {
    const permissions = caller.permissions ?? [];
    if (permissions.includes("delegate:*") || permissions.includes("all") || permissions.includes("*")) {
      return true;
    }
    if (permissions.includes(`delegate:${targetId}`)) {
      return true;
    }
    return false;
  }

  /**
   * Ejecuta la tarea en la instancia del Sub-Ego destino utilizando el ejecutor configurado
   * o una estrategia determinista por defecto.
   */
  private async executeTask(
    instance: SubEgoInstance,
    request: DelegationRequest,
    context: DelegationCallContext
  ): Promise<unknown> {
    if (this.executor) {
      return this.executor(instance, request, context);
    }

    // Ejecutor determinista por defecto: actualiza métricas de la instancia y
    // devuelve un resultado ESTRUCTURADO válido.
    //
    // EGO-FIND-22 (T1): antes devolvía `{handledBy, task, input, timestamp}`,
    // que NO satisface el contrato `StructuredChildOutput` ({summary, findings,
    // files, issues}). Consecuencia: sin `executor` explícito, la tool
    // `delegate_task` fallaba SIEMPRE en la normalización de la salida. Ahora
    // el ejecutor por defecto cumple el contrato y la delegación degrada de
    // forma útil en vez de romperse.
    instance.totalTurnsExecuted += 1;
    instance.lastActiveMs = Date.now();

    const task = typeof request.task === "string" ? request.task : "";

    return {
      summary: `Delegación ejecutada por '${instance.manifest.id}'${
        task.length > 0 ? `: ${task}` : ""
      }`,
      findings: [],
      files: [],
      issues: [],
    };
  }

  /**
   * Envuelve una promesa con un timeout determinista que lanza DelegationTimeoutError si expira.
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, delegationId: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new DelegationTimeoutError(delegationId, timeoutMs));
      }, timeoutMs);

      promise
        .then((res) => {
          clearTimeout(timer);
          resolve(res);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  // ---------------------------------------------------------------------------
  // Endurecimiento de delegación (tareas 1-7). Todo lo anterior queda intacto;
  // lo que sigue es API aditiva sin cambios de comportamiento por defecto.
  // ---------------------------------------------------------------------------

  /**
   * Estima el coste combinatorio de subdivisión: breadth^depth (tarea 3).
   * Con breadth=3 por defecto: depth0->1, depth1->3, depth2->9, depth3->27.
   */
  static estimateFanoutCost(depth: number, breadth: number = SPAWN_COST_BREADTH): number {
    const d = Math.max(0, Math.floor(depth));
    const b = Math.max(1, Math.floor(breadth));
    return Math.pow(b, d);
  }

  /**
   * Mensaje de advertencia de coste exponencial 3^depth (tarea 3).
   * Retorna undefined si depth < 2 (plano, sin advertencia).
   */
  static spawnCostWarning(depth: number, breadth: number = SPAWN_COST_BREADTH): string | undefined {
    if (depth < 2) return undefined;
    const cost = DelegationRouter.estimateFanoutCost(depth, breadth);
    return (
      `Advertencia de coste: subdivisión depth=${depth} con fan-out ~${breadth} ` +
      `implica hasta ~${cost} ramas (3^depth). Mantén profundidad plana depth0->1 salvo necesidad real.`
    );
  }

  /**
   * Construye el contexto fresco del hijo (tarea 1): valida goal+context no vacíos
   * y hereda SOLO el AGENTS.md del proyecto (sin historial, sin memoria ajena).
   */
  buildChildContext(goal: string, context: string, projectAgentsMd?: string): string {
    const g = (goal ?? "").trim();
    const c = (context ?? "").trim();
    if (g.length === 0) {
      throw new DelegationValidationError("delegate_task requiere 'goal' no vacío.");
    }
    if (c.length === 0) {
      throw new DelegationValidationError("delegate_task requiere 'context' fresco no vacío.");
    }
    const agents = (projectAgentsMd ?? this.projectAgentsMd ?? "").trim();
    const header = "# Contexto hijo (fresco, sin historial)";
    const agentsBlock = agents.length > 0 ? `\n\n## AGENTS.md del proyecto (herencia mínima)\n${agents}` : "";
    return `${header}\n\n## Objetivo\n${g}\n\n## Contexto fresco\n${c}${agentsBlock}`;
  }

  /**
   * Valida y normaliza la entrada de `delegate_task` (tarea 1).
   */
  validateDelegateTaskInput(input: DelegateTaskInput): Required<Pick<DelegateTaskInput, "goal" | "context" | "role" | "maxIterations">> & DelegateTaskInput {
    const goal = (input.goal ?? "").trim();
    const context = (input.context ?? "").trim();
    if (goal.length === 0) {
      throw new DelegationValidationError("delegate_task requiere 'goal' no vacío.");
    }
    if (context.length === 0) {
      throw new DelegationValidationError("delegate_task requiere 'context' fresco no vacío.");
    }
    const role: SubEgoChildRole = input.role ?? "leaf";
    if (role !== "leaf" && role !== "orchestrator") {
      throw new DelegationValidationError(`Rol de hijo inválido '${input.role}': usa 'leaf' | 'orchestrator'.`);
    }
    const rawMax = input.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    const maxIterations = Number.isFinite(rawMax) ? Math.max(1, Math.floor(rawMax)) : DEFAULT_MAX_ITERATIONS;
    if (!input.projectId || input.projectId.trim().length === 0) {
      throw new DelegationValidationError("delegate_task requiere 'projectId' no vacío.");
    }
    if (!input.callerEgoId || !input.targetEgoId) {
      throw new DelegationValidationError("delegate_task requiere 'callerEgoId' y 'targetEgoId'.");
    }
    return { ...input, goal, context, role, maxIterations };
  }

  /**
   * Herramientas permitidas para un rol hijo (tarea 4).
   * Bloquea en hijos: clarify, memory-write, send_message, cronjob y
   * delegate_task (salvo orchestrator con max_spawn_depth>=1).
   */
  getAllowedToolsForRole(role: SubEgoChildRole, requestedTools: string[]): string[] {
    const effectiveSpawn = this.maxSpawnDepth;
    return requestedTools.filter((t) => {
      const name = t.trim();
      const low = name.toLowerCase();
      if (low === "delegate_task" || low === "delegate-task" || low === "delegate") {
        return role === "orchestrator" && effectiveSpawn >= 1;
      }
      if (low === "clarify") return false;
      if (low === "memory-write" || low === "memory_write" || low === "memorywrite") return false;
      if (low === "send_message" || low === "send-message" || low === "sendmessage") return false;
      if (low === "cronjob" || low === "cron_job" || low === "cron") return false;
      return true;
    });
  }

  /**
   * Lanza DelegationBlockedToolError si la tool no está permitida para el rol (tarea 4).
   */
  assertChildToolAllowed(role: SubEgoChildRole, toolName: string, maxSpawnDepthOverride?: number): void {
    const name = (toolName ?? "").trim();
    const low = name.toLowerCase();
    const isDelegate = low === "delegate_task" || low === "delegate-task" || low === "delegate";
    const blocked =
      isDelegate ||
      low === "clarify" ||
      low === "memory-write" || low === "memory_write" || low === "memorywrite" ||
      low === "send_message" || low === "send-message" || low === "sendmessage" ||
      low === "cronjob" || low === "cron_job" || low === "cron";
    if (!blocked) return;
    if (isDelegate) {
      const effective = maxSpawnDepthOverride ?? this.maxSpawnDepth;
      if (role === "orchestrator" && effective >= 1) return;
      throw new DelegationBlockedToolError(name, role);
    }
    throw new DelegationBlockedToolError(name, role);
  }

  /**
   * Normaliza y valida el contrato de salida estructurado del hijo (tarea 5):
   * { summary: qué hizo, findings: hallazgos, files: archivos, issues: problemas }.
   */
  normalizeStructuredOutput(output: unknown): StructuredChildOutput {
    if (typeof output !== "object" || output === null) {
      throw new DelegationValidationError(
        "Salida del hijo inválida: se requiere objeto { summary, findings, files, issues }."
      );
    }
    const o = output as Record<string, unknown>;
    const rawSummary = typeof o["summary"] === "string" ? (o["summary"] as string).trim() : "";
    if (rawSummary.length === 0) {
      throw new DelegationValidationError("Salida del hijo inválida: 'summary' (qué hizo) no puede estar vacío.");
    }
    const asStringArray = (v: unknown): string[] => {
      if (!Array.isArray(v)) return [];
      return v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter((s) => s.length > 0);
    };
    return {
      summary: redactSecrets(rawSummary),
      findings: asStringArray(o["findings"]).map(redactSecrets),
      files: asStringArray(o["files"]),
      issues: asStringArray(o["issues"]).map(redactSecrets)
    };
  }

  /**
   * Tool endurecida `delegate_task(goal, context, role, max_iterations)` (tarea 1).
   * - Contexto fresco obligatorio + herencia mínima (solo AGENTS.md proyecto).
   * - Profundidad plana por defecto; orchestrator solo si max_spawn_depth>=1 (tarea 3).
   * - Salida normalizada al contrato estructurado (tarea 5).
   * - Modelo barato configurable + registro para rollup por rama (tarea 7).
   */
  async delegateTask(input: DelegateTaskInput): Promise<DelegationResult<StructuredChildOutput>> {
    const norm = this.validateDelegateTaskInput(input);
    const effectiveSpawn = input.maxSpawnDepth ?? this.maxSpawnDepth;
    if (norm.role === "orchestrator" && effectiveSpawn < 1) {
      throw new DelegationValidationError(
        "Rol 'orchestrator' requiere max_spawn_depth>=1. Usa rol 'leaf' (plano depth0->1) o eleva el límite."
      );
    }
    const parentDepth = norm.parentContext?.depth ?? 0;
    const nextDepth = parentDepth + 1;
    const warning = DelegationRouter.spawnCostWarning(nextDepth);
    if (warning) {
      console.warn(`[DelegationRouter] ${warning}`);
    }
    // Endurece (tarea 4): un hijo leaf nunca puede subdividir: cualquier delegación
    // anidada bajo un contexto leaf se bloquea como `delegate_task` no permitido.
    if (norm.parentContext?.childRole === "leaf") {
      throw new DelegationBlockedToolError("delegate_task", "leaf");
    }

    const freshContext = this.buildChildContext(norm.goal, norm.context, norm.projectAgentsMd);
    const model = (norm.model ?? this.childModel).trim() || this.childModel;
    const treeId = norm.treeId ?? norm.parentContext?.treeId ?? `tree_${randomUUID()}`;
    const taskLine = `[delegate_task role=${norm.role} max_iterations=${norm.maxIterations} model=${model}] ${norm.goal}`;

    const result = await this.delegate<unknown, unknown>(
      {
        projectId: norm.projectId,
        callerEgoId: norm.callerEgoId,
        targetEgoId: norm.targetEgoId,
        task: taskLine,
        input: {
          goal: norm.goal,
          context: freshContext,
          role: norm.role,
          max_iterations: norm.maxIterations,
          model
        },
        timeoutMs: norm.timeoutMs,
        metadata: { treeId, model, role: norm.role, maxIterations: norm.maxIterations }
      },
      // El rol del NUEVO hijo viaja en metadata.role; el parentContext conserva
      // el rol del EMISOR para que delegate() bloquee subdividir bajo leaf.
      norm.parentContext
        ? { ...norm.parentContext, treeId }
        : { depth: 0, callChain: [], treeId }
    );

    const structured = this.normalizeStructuredOutput(result.output);
    return { ...result, output: structured };
  }

  /**
   * Fan-out concurrente con límite configurable y resultados ordenados por índice (tarea 2).
   * Default max 3. `preserveOrder=true` retorna en el orden de entrada aunque terminen desordenados.
   */
  async delegateMany<TInput = unknown, TOutput = unknown>(
    requests: Array<DelegationRequest<TInput> & { parentContext?: DelegationCallContext }>,
    options: DelegationFanoutOptions = {}
  ): Promise<Array<DelegationResult<TOutput>>> {
    if (!Array.isArray(requests) || requests.length === 0) return [];
    const rawConc = options.maxConcurrency ?? this.maxConcurrency;
    const maxConcurrency = Number.isFinite(rawConc) && (rawConc as number) >= 1
      ? Math.floor(rawConc as number)
      : DEFAULT_FANOUT_CONCURRENCY;
    const preserveOrder = options.preserveOrder ?? true;

    const results: Array<DelegationResult<TOutput> | undefined> = new Array(requests.length);
    let nextIndex = 0;

    const worker = async (): Promise<void> => {
      while (true) {
        const idx = nextIndex;
        nextIndex += 1;
        if (idx >= requests.length) return;
        const item = requests[idx];
        if (item === undefined) return; // Inalcanzable: idx < requests.length (narrowing TS noUncheckedIndexedAccess)
        const { parentContext, ...req } = item;
        results[idx] = await this.delegate<TInput, TOutput>(req, parentContext);
      }
    };

    const workerCount = Math.min(maxConcurrency, requests.length);
    const workers: Array<Promise<void>> = [];
    for (let w = 0; w < workerCount; w += 1) {
      workers.push(worker());
    }
    await Promise.all(workers);

    const filled = results as Array<DelegationResult<TOutput>>;
    if (preserveOrder) return filled;
    return [...filled];
  }

  // --- Control vivo scoped al árbol (tarea 6) ---

  /**
   * Lista delegaciones vivas, opcionalmente filtradas por árbol (treeId).
   */
  listActive(treeId?: string): ActiveDelegationRecord[] {
    const all = Array.from(this.activeDelegations.values());
    if (!treeId) return all.map((r) => ({ ...r, steerQueue: [...r.steerQueue] }));
    return all
      .filter((r) => r.treeId === treeId)
      .map((r) => ({ ...r, steerQueue: [...r.steerQueue] }));
  }

  /**
   * Encola una instrucción out-of-band para consumir en el boundary del hijo (tarea 6).
   * No interrumpe a mitad de token: el executor la recoge vía `drainSteer(id)`.
   * También la reenvía al runtime si expone steer (best-effort, sin romper).
   */
  steer(delegationId: string, instruction: string): boolean {
    const text = (instruction ?? "").trim();
    if (text.length === 0) return false;
    let rec = this.activeDelegations.get(delegationId);
    if (!rec) {
      rec = {
        delegationId,
        treeId: delegationId,
        callerEgoId: "",
        targetEgoId: "",
        depth: 0,
        startedAtMs: Date.now(),
        status: "running",
        steerQueue: [],
        stopRequested: false,
        model: this.childModel
      };
      this.activeDelegations.set(delegationId, rec);
    }
    rec.steerQueue.push(text);
    if (rec.status !== "running") rec.status = "running";
    // Best-effort hacia el runtime (si implementa steer por subEgo).
    try {
      const rt = this.runtime as unknown as { steer?: (id: string, msg: string) => void };
      if (typeof rt.steer === "function") {
        rt.steer(rec.targetEgoId || delegationId, text);
      }
    } catch {
      // Steer del router ya quedó encolado; el reenvío es opcional.
    }
    return true;
  }

  /**
   * Consume y limpia la cola out-of-band de una delegación (llamar en el boundary).
   */
  drainSteer(delegationId: string): string[] {
    const rec = this.activeDelegations.get(delegationId);
    if (!rec || rec.steerQueue.length === 0) return [];
    const out = [...rec.steerQueue];
    rec.steerQueue = [];
    return out;
  }

  /**
   * Solicita cancelación cooperativa: se hace efectiva al boundary con parcial (tarea 6).
   * Retorna false si la delegación es desconocida (igual la registra como stopped para carreras).
   */
  stop(delegationId: string, partial?: unknown): boolean {
    const rec = this.activeDelegations.get(delegationId);
    if (!rec) {
      this.activeDelegations.set(delegationId, {
        delegationId,
        treeId: delegationId,
        callerEgoId: "",
        targetEgoId: "",
        depth: 0,
        startedAtMs: Date.now(),
        status: "running",
        steerQueue: [],
        stopRequested: true,
        partialOutput: partial,
        model: this.childModel
      });
      return false;
    }
    rec.stopRequested = true;
    if (partial !== undefined) rec.partialOutput = partial;
    // Best-effort hacia el runtime (si implementa requestStop por subEgo).
    try {
      const rt = this.runtime as unknown as { requestStop?: (id: string, p?: unknown) => boolean };
      if (typeof rt.requestStop === "function" && rec.targetEgoId) {
        rt.requestStop(rec.targetEgoId, partial);
      }
    } catch {
      // El flag del router basta para cancelar al boundary.
    }
    return true;
  }

  /**
   * Indica si hay un stop pendiente para la delegación (para chequear en el boundary).
   */
  isStopRequested(delegationId: string): boolean {
    return this.activeDelegations.get(delegationId)?.stopRequested ?? false;
  }

  // --- Coste/tokens por rama (tarea 7) ---

  /**
   * Rollup agregado de coste/tokens para un árbol completo (tarea 7).
   * Combina el registro por rama del router con los contadores del runtime (best-effort).
   */
  getTreeRollup(treeId: string): DelegationTreeRollup {
    const ids: string[] = [];
    let tokens = 0;
    let cost = 0;
    let model = this.childModel;
    for (const [id, usage] of this.branchUsage) {
      const rec = this.activeDelegations.get(id);
      if (rec && rec.treeId === treeId) {
        ids.push(id);
        tokens += usage.tokens;
        cost += usage.costUsd;
        model = usage.model || model;
      }
    }
    // Best-effort: sumar contadores del runtime para ramas del árbol si expone getCostRollup.
    try {
      const rt = this.runtime as unknown as { getCostRollup?: (ids?: string[]) => { totalTokens: number; totalCostUsd: number } };
      if (typeof rt.getCostRollup === "function") {
        const targets = this.listActive(treeId)
          .map((r) => r.targetEgoId)
          .filter((s) => s.length > 0);
        if (targets.length > 0) {
          const extra = rt.getCostRollup(targets);
          tokens += Math.max(0, extra.totalTokens);
          cost += Math.max(0, extra.totalCostUsd);
        }
      }
    } catch {
      // Rollup del router ya es suficiente.
    }
    return {
      treeId,
      branches: ids.length,
      delegationIds: ids,
      totalTokens: tokens,
      totalCostUsd: Number(cost.toFixed(6)),
      model
    };
  }

  /**
   * Extrae tokens/coste del output del executor (si los porta) y lo registra por rama.
   */
  private recordBranchUsage(delegationId: string, output: unknown, model: string): void {
    let tokens = 0;
    let costUsd = 0;
    if (typeof output === "object" && output !== null) {
      const o = output as Record<string, unknown>;
      const t = o["tokensUsed"] ?? o["tokens"] ?? o["totalTokens"];
      const c = o["costUsd"] ?? o["cost"] ?? o["totalCostUsd"];
      if (typeof t === "number" && Number.isFinite(t) && t >= 0) tokens = Math.floor(t);
      if (typeof c === "number" && Number.isFinite(c) && c >= 0) costUsd = c;
    }
    this.branchUsage.set(delegationId, { tokens, costUsd, model });
  }
}
