import type { EgoMemoryAdapter } from "@ego/memory";
import type { ToolDefinition } from "@ego/tools";
import { DelegationRouter, type DelegationRouterOptions, type DelegationTaskExecutor } from "./DelegationRouter.js";
import { createDelegationTools, type DelegationToolOptions } from "./DelegationTools.js";
import { SharedMemory } from "./SharedMemory.js";
import { SubEgoRegistry } from "./SubEgoRegistry.js";
import { SubEgoRuntime } from "./SubEgoRuntime.js";

/**
 * DelegationRuntime — punto de entrada ÚNICO de la delegación de Sub-Egos.
 *
 * EGO-FIND-22 (Ola 1 / A3 / T1). Antes, la delegación era **código muerto**:
 * `registerDelegationTools` solo se invocaba en los tests y
 * `new DelegationRouter` no aparecía en `apps/desktop/src`, de modo que el
 * Sub-Ego `planner` declaraba `capabilities: ["delegate_task"]` sin que la
 * tool existiera en el `ToolRegistry` de producción.
 *
 * Este factory resuelve el cableado en un solo lugar, dentro del paquete:
 * construye runtime + registro + memoria compartida + router y registra las
 * 6 tools de delegación en el `ToolRegistry`. La composición (desktop main)
 * solo tiene que llamarlo — ver el handoff A3 → A4.
 *
 * NO duplica lógica de negocio: solo compone las piezas existentes.
 */

/** Superficie mínima de registro de tools (compatible con `ToolRegistry`). */
export interface DelegationToolSink {
  register(tool: ToolDefinition, options?: { allowOverride?: boolean }): void;
  has?(name: string): boolean;
}

/** Dependencias de `createDelegationRuntime`. */
export interface DelegationRuntimeDeps {
  /** Almacén de memoria (registro de Sub-Egos + memoria compartida). */
  storage: EgoMemoryAdapter;
  /** Registro de tools donde se registran las tools de delegación (opcional). */
  toolRegistry?: DelegationToolSink;
  /**
   * Ejecutor de la tarea delegada. Si se omite, el router usa su ejecutor
   * determinista por defecto (actualiza métricas y devuelve un resultado
   * estructurado). En producción lo implementa el Runtime con el modelo.
   */
  executor?: DelegationTaskExecutor;
  /** Opciones del router (profundidad, timeout, permisos, modelo hijo…). */
  routerOptions?: Partial<DelegationRouterOptions>;
  /** Opciones de las tools de delegación (concurrencia del fan-out). */
  toolOptions?: DelegationToolOptions;
  /** TTL de inactividad de las instancias en RAM. */
  idleTtlMs?: number;
  /** Concurrencia máxima de instancias activas simultáneas. */
  maxConcurrentActive?: number;
  /** Caller por defecto cuando el contexto de ejecución no lo aporta. */
  defaultCallerId?: string;
}

/** Runtime de delegación listo para usar. */
export interface DelegationRuntime {
  /** Runtime en memoria de instancias de Sub-Ego. */
  readonly runtime: SubEgoRuntime;
  /** Registro persistente de manifiestos (`gov/sub_egos`). */
  readonly registry: SubEgoRegistry;
  /** Memoria compartida entre Sub-Egos (por proyecto). */
  readonly sharedMemory: SharedMemory;
  /** Router de delegación jerárquica. */
  readonly router: DelegationRouter;
  /** Definiciones de las tools de delegación (6). */
  readonly tools: ToolDefinition[];
  /**
   * Registra las tools de delegación en el `ToolRegistry` supplied.
   * Idempotente en cuanto al retorno (devuelve siempre las definiciones).
   */
  registerTools(registry?: DelegationToolSink): ToolDefinition[];
  /** Libera timers y recursos del runtime. Idempotente. */
  dispose(): Promise<void>;
}

/**
 * Construye el runtime de delegación completo.
 *
 * ```ts
 * const delegation = createDelegationRuntime({
 *   storage: adapter,
 *   toolRegistry,
 *   executor: async (instance, request) => runSubEgoTurn(instance, request),
 * });
 * ```
 */
export function createDelegationRuntime(deps: DelegationRuntimeDeps): DelegationRuntime {
  const runtime = new SubEgoRuntime({
    idleTtlMs: deps.idleTtlMs,
    maxConcurrentActive: deps.maxConcurrentActive,
  });
  const registry = new SubEgoRegistry(deps.storage);
  const sharedMemory = new SharedMemory(deps.storage);

  const router = new DelegationRouter({
    runtime,
    registry,
    sharedMemory,
    executor: deps.executor,
    ...deps.routerOptions,
  });

  const tools = createDelegationTools(router, deps.toolOptions);

  let disposed = false;

  const registerTools = (target?: DelegationToolSink): ToolDefinition[] => {
    const sink = target ?? deps.toolRegistry;
    if (!sink) return tools;
    for (const tool of tools) {
      // `allowOverride: false`: registrar dos veces no debe silenciar la
      // herramienta previa (el registro lanza; el llamante decide).
      if (typeof sink.has === "function" && sink.has(tool.name)) {
        continue;
      }
      sink.register(tool);
    }
    return tools;
  };

  if (deps.toolRegistry) {
    registerTools(deps.toolRegistry);
  }

  return {
    runtime,
    registry,
    sharedMemory,
    router,
    tools,
    registerTools,
    dispose: async (): Promise<void> => {
      if (disposed) return;
      disposed = true;
      await runtime.dispose();
    },
  };
}
