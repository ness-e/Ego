import type {
  SubEgoManifest,
  SubEgoInstance,
  SubEgoLifecycleState,
  SubEgoRuntimeOptions,
  SubEgoTurnResult
} from "./types.js";

/**
 * Error base para excepciones del runtime de Sub-Egos.
 */
export class SubEgoRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubEgoRuntimeError";
  }
}

/**
 * Error cuando se intenta acceder a un Sub-Ego no registrado.
 */
export class SubEgoNotFoundError extends SubEgoRuntimeError {
  constructor(public readonly subEgoId: string) {
    super(`Sub-Ego con identificador '${subEgoId}' no encontrado en el registro del runtime.`);
    this.name = "SubEgoNotFoundError";
  }
}

/**
 * Error cuando se intenta realizar una operación inválida en el estado actual.
 */
export class SubEgoBusyError extends SubEgoRuntimeError {
  constructor(public readonly subEgoId: string, public readonly action: string) {
    super(`No se puede ejecutar '${action}' en el Sub-Ego '${subEgoId}' porque se encuentra en estado 'executing'.`);
    this.name = "SubEgoBusyError";
  }
}

/**
 * Sub-Ego Runtime (SUB-03 / Principios §4 y §10).
 * Gestiona el ciclo de vida, activación perezosa (Lazy Activation), límites de concurrencia
 * y descarga automática por inactividad (TTL) para especialistas cognitivos.
 */
export class SubEgoRuntime {
  private readonly manifests: Map<string, SubEgoManifest> = new Map();
  private readonly instances: Map<string, SubEgoInstance> = new Map();
  private readonly idleTimers: Map<string, NodeJS.Timeout> = new Map();

  private readonly idleTtlMs: number;
  private readonly maxConcurrentActive: number;
  private readonly onStateTransition?: SubEgoRuntimeOptions["onStateTransition"];

  constructor(options: SubEgoRuntimeOptions = {}) {
    this.idleTtlMs = options.idleTtlMs ?? 60_000;
    this.maxConcurrentActive = options.maxConcurrentActive ?? 10;
    this.onStateTransition = options.onStateTransition;
  }

  /**
   * Registra un manifiesto en el catálogo del runtime sin instanciarlo en RAM.
   */
  registerManifest(manifest: SubEgoManifest): void {
    this.manifests.set(manifest.id, manifest);
  }

  /**
   * Registra múltiples manifiestos a la vez.
   */
  registerManifests(manifests: SubEgoManifest[]): void {
    for (const m of manifests) {
      this.registerManifest(m);
    }
  }

  /**
   * Obtiene un manifiesto registrado por ID.
   */
  getManifest(id: string): SubEgoManifest | undefined {
    return this.manifests.get(id);
  }

  /**
   * Indica si un manifiesto está registrado en el catálogo.
   */
  hasManifest(id: string): boolean {
    return this.manifests.has(id);
  }

  /**
   * Indica si un Sub-Ego se encuentra actualmente cargado en memoria RAM.
   */
  isLoaded(id: string): boolean {
    return this.instances.has(id);
  }

  /**
   * Obtiene la instancia activa de un Sub-Ego si reside en RAM.
   */
  getInstance(id: string): SubEgoInstance | undefined {
    return this.instances.get(id);
  }

  /**
   * Lista todas las instancias activas o suspendidas en RAM.
   */
  getAllInstances(): SubEgoInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Retorna la cantidad de instancias presentes en RAM.
   */
  getActiveCount(): number {
    return this.instances.size;
  }

  /**
   * Lazy Activation: Obtiene una instancia cargada en memoria o la activa bajo demanda.
   *
   * @param target Identificador registrado o manifiesto completo.
   */
  getOrActivate(target: string | SubEgoManifest): SubEgoInstance {
    let manifest: SubEgoManifest;

    if (typeof target === "string") {
      const found = this.manifests.get(target);
      if (!found) {
        throw new SubEgoNotFoundError(target);
      }
      manifest = found;
    } else {
      manifest = target;
      if (!this.manifests.has(manifest.id)) {
        this.manifests.set(manifest.id, manifest);
      }
    }

    const subEgoId = manifest.id;

    // Si ya reside en memoria
    const existing = this.instances.get(subEgoId);
    if (existing) {
      this.clearIdleTimer(subEgoId);

      if (existing.state === "suspended") {
        this.transitionState(existing, "idle");
      }
      existing.lastActiveMs = Date.now();
      this.scheduleIdleTimer(subEgoId);
      return existing;
    }

    // Gestionar límite de concurrencia en RAM expulsando la instancia ociosa más antigua
    if (this.instances.size >= this.maxConcurrentActive) {
      this.evictOldestIdleInstance();
    }

    // Crear nueva instancia (Lazy Activation)
    const now = Date.now();
    const instance: SubEgoInstance = {
      manifest,
      state: "activating",
      activatedAtMs: now,
      lastActiveMs: now,
      totalTurnsExecuted: 0,
      totalTokensUsed: 0,
      totalCostUsd: 0,
      scratchpad: new Map()
    };

    this.instances.set(subEgoId, instance);
    this.transitionState(instance, "idle");
    this.scheduleIdleTimer(subEgoId);

    return instance;
  }

  /**
   * Ejecuta un turno cognitivo para un Sub-Ego, gestionando su transición a 'executing',
   * la actualización de contadores de consumo y la reactivación del timer TTL al finalizar.
   *
   * @param subEgoId Identificador del Sub-Ego.
   * @param turnFn Función que realiza el trabajo cognitivo (ej. llamar al ToolExecutionLoop).
   */
  async executeTurn<T>(
    subEgoId: string,
    turnFn: (instance: SubEgoInstance) => Promise<{
      output: T;
      tokensUsed?: number;
      costUsd?: number;
    }>
  ): Promise<SubEgoTurnResult<T>> {
    const instance = this.getOrActivate(subEgoId);

    if (instance.state === "executing") {
      throw new SubEgoBusyError(subEgoId, "executeTurn");
    }

    this.clearIdleTimer(subEgoId);
    this.transitionState(instance, "executing");
    instance.lastActiveMs = Date.now();

    const startTime = Date.now();

    try {
      const result = await turnFn(instance);
      const durationMs = Date.now() - startTime;
      const tokens = result.tokensUsed ?? 0;
      const cost = result.costUsd ?? 0;

      instance.totalTurnsExecuted += 1;
      instance.totalTokensUsed += tokens;
      instance.totalCostUsd += cost;
      instance.lastActiveMs = Date.now();

      return {
        subEgoId,
        output: result.output,
        tokensUsed: tokens,
        costUsd: cost,
        durationMs
      };
    } finally {
      if (this.instances.has(subEgoId)) {
        this.transitionState(instance, "idle");
        this.scheduleIdleTimer(subEgoId);
      }
    }
  }

  /**
   * Suspende manualmente un Sub-Ego ocioso liberando descriptores activos.
   */
  suspend(subEgoId: string): boolean {
    const instance = this.instances.get(subEgoId);
    if (!instance) return false;

    if (instance.state === "executing") {
      throw new SubEgoBusyError(subEgoId, "suspend");
    }

    this.clearIdleTimer(subEgoId);
    this.transitionState(instance, "suspended");
    return true;
  }

  /**
   * Descarga y elimina completamente un Sub-Ego de la memoria RAM.
   */
  unload(subEgoId: string): boolean {
    const instance = this.instances.get(subEgoId);
    if (!instance) return false;

    if (instance.state === "executing") {
      throw new SubEgoBusyError(subEgoId, "unload");
    }

    this.clearIdleTimer(subEgoId);
    this.transitionState(instance, "unloaded");
    this.instances.delete(subEgoId);
    return true;
  }

  /**
   * Descarga la totalidad de las instancias activas y cancela todos los temporizadores.
   */
  unloadAll(): void {
    for (const [id] of this.instances) {
      this.clearIdleTimer(id);
      const inst = this.instances.get(id);
      if (inst && inst.state !== "executing") {
        this.transitionState(inst, "unloaded");
      }
    }
    this.idleTimers.clear();
    this.instances.clear();
  }

  // --- MÉTODOS INTERNOS DE GESTIÓN Y FSM ---

  private transitionState(instance: SubEgoInstance, toState: SubEgoLifecycleState): void {
    const fromState = instance.state;
    if (fromState === toState) return;

    instance.state = toState;
    if (this.onStateTransition) {
      try {
        this.onStateTransition(instance, fromState, toState);
      } catch (err) {
        console.warn("[SubEgoRuntime] Error en onStateTransition listener:", err);
      }
    }
  }

  private scheduleIdleTimer(subEgoId: string): void {
    if (this.idleTtlMs <= 0) return;

    this.clearIdleTimer(subEgoId);

    const timer = setTimeout(() => {
      this.handleIdleTimeout(subEgoId);
    }, this.idleTtlMs);

    // CRÍTICO: .unref() asegura que el timer no impida la salida del proceso Node/Electron
    if (typeof timer.unref === "function") {
      timer.unref();
    }

    this.idleTimers.set(subEgoId, timer);
  }

  private clearIdleTimer(subEgoId: string): void {
    const timer = this.idleTimers.get(subEgoId);
    if (timer) {
      clearTimeout(timer);
      this.idleTimers.delete(subEgoId);
    }
  }

  private handleIdleTimeout(subEgoId: string): void {
    const instance = this.instances.get(subEgoId);
    if (!instance) return;

    if (instance.state === "idle") {
      // Descarga automática por inactividad
      this.unload(subEgoId);
    }
  }

  private evictOldestIdleInstance(): void {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, inst] of this.instances) {
      if (inst.state === "idle" || inst.state === "suspended") {
        if (inst.lastActiveMs < oldestTime) {
          oldestTime = inst.lastActiveMs;
          oldestId = id;
        }
      }
    }

    if (oldestId) {
      this.unload(oldestId);
    }
  }
}
