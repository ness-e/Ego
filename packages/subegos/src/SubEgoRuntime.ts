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
 * Error cuando un turno es cancelado cooperativamente al boundary vía `requestStop`
 * (tarea 6). Porta el parcial disponible para no perder trabajo.
 */
export class SubEgoStoppedError extends SubEgoRuntimeError {
  constructor(public readonly subEgoId: string, public readonly partial?: unknown) {
    super(`Sub-Ego '${subEgoId}' detenido por el operador; se retorna parcial al boundary.`);
    this.name = "SubEgoStoppedError";
  }
}

/**
 * Modelo barato por defecto para ramas hijas (tarea 7). Configurable por runtime y por rama.
 */
export const DEFAULT_CHEAP_CHILD_MODEL = "gpt-4o-mini";

/**
 * Opciones endurecidas adicionales del runtime (aditivas, sin tocar `SubEgoRuntimeOptions`).
 */
export interface SubEgoRuntimeHardenedOptions {
  /** Modelo barato por defecto para hijos (default: gpt-4o-mini). */
  defaultChildModel?: string;
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
  private readonly steerQueues: Map<string, string[]> = new Map();
  private readonly stopRequests: Map<string, { requestedAtMs: number; partial?: unknown }> = new Map();
  private readonly branchModels: Map<string, string> = new Map();

  private readonly idleTtlMs: number;
  private readonly maxConcurrentActive: number;
  private readonly onStateTransition?: SubEgoRuntimeOptions["onStateTransition"];
  private readonly defaultChildModel: string;

  constructor(options: SubEgoRuntimeOptions & SubEgoRuntimeHardenedOptions = {}) {
    this.idleTtlMs = options.idleTtlMs ?? 60_000;
    this.maxConcurrentActive = options.maxConcurrentActive ?? 10;
    this.onStateTransition = options.onStateTransition;
    const dm = (options.defaultChildModel ?? DEFAULT_CHEAP_CHILD_MODEL).trim();
    this.defaultChildModel = dm.length > 0 ? dm : DEFAULT_CHEAP_CHILD_MODEL;
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

    // Stop solicitado antes de arrancar: cancela al boundary con parcial (tarea 6).
    const preStop = this.stopRequests.get(subEgoId);
    if (preStop) {
      throw new SubEgoStoppedError(subEgoId, preStop.partial);
    }

    // Exponer steer out-of-band pendiente vía scratchpad para el boundary (tarea 6).
    const pendingSteer = this.steerQueues.get(subEgoId);
    if (pendingSteer && pendingSteer.length > 0) {
      instance.scratchpad.set("__steer_pending", [...pendingSteer]);
    }

    try {
      const result = await turnFn(instance);
      const durationMs = Date.now() - startTime;
      const tokens = result.tokensUsed ?? 0;
      const cost = result.costUsd ?? 0;

      // Stop solicitado durante el turno: se hace efectivo al boundary con parcial.
      const midStop = this.stopRequests.get(subEgoId);
      if (midStop) {
        const partial = (result.output ?? midStop.partial) as unknown;
        throw new SubEgoStoppedError(subEgoId, partial);
      }

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

  // --- CONTROL VIVO + MODELO/COSTE POR RAMA (tareas 6-7, aditivo) ---

  /**
   * Modelo barato por defecto del runtime para ramas hijas (tarea 7).
   */
  getDefaultChildModel(): string {
    return this.defaultChildModel;
  }

  /**
   * Fija el modelo de una rama concreta (tarea 7). Retorna el modelo efectivo.
   */
  setBranchModel(subEgoId: string, model?: string): string {
    const m = (model ?? this.defaultChildModel).trim() || this.defaultChildModel;
    this.branchModels.set(subEgoId, m);
    return m;
  }

  /**
   * Modelo efectivo de una rama (override o default barato).
   */
  getBranchModel(subEgoId: string): string {
    return this.branchModels.get(subEgoId) ?? this.defaultChildModel;
  }

  /**
   * Lista instancias en ejecución (para control vivo `list`, tarea 6).
   */
  listRunning(): SubEgoInstance[] {
    return Array.from(this.instances.values()).filter((i) => i.state === "executing");
  }

  /**
   * Ids en ejecución.
   */
  listRunningIds(): string[] {
    return this.listRunning().map((i) => i.manifest.id);
  }

  /**
   * Encola una instrucción out-of-band sin interrumpir el turno (tarea 6: steer).
   * El executor la consume en el boundary vía `drainSteer`.
   */
  steer(subEgoId: string, instruction: string): void {
    const text = (instruction ?? "").trim();
    if (text.length === 0) return;
    const q = this.steerQueues.get(subEgoId) ?? [];
    q.push(text);
    this.steerQueues.set(subEgoId, q);
    const inst = this.instances.get(subEgoId);
    if (inst) {
      inst.scratchpad.set("__steer_pending", [...q]);
    }
  }

  /**
   * Mira la cola out-of-band sin consumirla.
   */
  peekSteer(subEgoId: string): string[] {
    return [...(this.steerQueues.get(subEgoId) ?? [])];
  }

  /**
   * Consume y limpia la cola out-of-band (llamar en el boundary, tarea 6).
   */
  drainSteer(subEgoId: string): string[] {
    const q = this.steerQueues.get(subEgoId);
    if (!q || q.length === 0) return [];
    this.steerQueues.delete(subEgoId);
    const inst = this.instances.get(subEgoId);
    if (inst) inst.scratchpad.delete("__steer_pending");
    return [...q];
  }

  /**
   * Solicita cancelación cooperativa al boundary con parcial opcional (tarea 6: stop).
   */
  requestStop(subEgoId: string, partial?: unknown): boolean {
    this.stopRequests.set(subEgoId, { requestedAtMs: Date.now(), partial });
    return true;
  }

  /**
   * Indica si hay un stop pendiente (para chequear en el boundary).
   */
  isStopRequested(subEgoId: string): boolean {
    return this.stopRequests.has(subEgoId);
  }

  /**
   * Limpia un stop pendiente (tras handled en el boundary).
   */
  clearStop(subEgoId: string): void {
    this.stopRequests.delete(subEgoId);
  }

  /**
   * Rollup de coste/tokens por rama (tarea 7): suma contadores de las instancias indicadas
   * (o de todas si se omite) sin alterar comportamiento existente.
   */
  getCostRollup(subEgoIds?: string[]): { branches: number; totalTokens: number; totalCostUsd: number } {
    const targets = subEgoIds ?? Array.from(this.instances.keys());
    let tokens = 0;
    let cost = 0;
    let branches = 0;
    for (const id of targets) {
      const inst = this.instances.get(id);
      if (!inst) continue;
      branches += 1;
      tokens += inst.totalTokensUsed;
      cost += inst.totalCostUsd;
    }
    return { branches, totalTokens: tokens, totalCostUsd: Number(cost.toFixed(6)) };
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
