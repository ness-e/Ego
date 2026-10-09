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
      callChain: [...fullChain, targetId]
    };

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
    } catch (err: unknown) {
      if (err instanceof DelegationTimeoutError) {
        status = "timed_out";
        error = err.message;
      } else {
        status = "failed";
        error = err instanceof Error ? err.message : String(err);
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

    // Ejecutor determinista por defecto: actualiza métricas de la instancia y devuelve resultado estructurado
    instance.totalTurnsExecuted += 1;
    instance.lastActiveMs = Date.now();

    return {
      handledBy: instance.manifest.id,
      task: request.task,
      input: request.input,
      timestamp: Date.now()
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
}
