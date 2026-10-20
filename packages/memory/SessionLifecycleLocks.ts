import { AsyncLocalStorage } from "node:async_hooks";

interface QueuedTask<T = unknown> {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
  fn: () => Promise<T>;
}

/**
 * Gestor de locks atómicos de ciclo de vida de sesiones (OCLW-05).
 * Extraído y adaptado de OpenClaw src/sessions/session-lifecycle-locks.ts.
 *
 * Garantiza que mutaciones concurrentes sobre la misma sesión en VantaDB
 * (ej. mensajes del usuario vs tareas proactivas de background) no colisionen
 * ni produzcan intercalación corrupta de turnos de conversación.
 *
 * L10 — Justificación del `any` en `QueuedTask<any>`: cada sesión encola
 * tareas de tipo heterogéneo (`runExclusive<T>` genérico por llamada); el
 * borrado de tipo es intencional y seguro porque la resolución
 * (`task.resolve(result)`) ocurre dentro del `Promise<T>` de la llamada que
 * aportó `fn`, sin cruces entre tipos.
 */
export class SessionLifecycleLocks {
  // AGENTS.md §4 (justificación de `any`): la cola serializa tareas de tipos
  // heterogéneos por `sessionId`; el tipo real viaja en la `Promise<T>` que la
  // tarea devuelve, y el `resolve` se invoca con el valor ya tipado por el
  // llamante. `unknown` no serviría: `resolve` exige el tipo exacto.
  // L10: un `any` aquí no cruza fronteras de confianza (sólo tipa el contenedor).
  private readonly queues = new Map<string, Array<QueuedTask<any>>>();
  private readonly running = new Set<string>();
  private readonly asyncLocalStorage = new AsyncLocalStorage<Set<string>>();

  /**
   * Ejecuta una operación de forma mutuamente excluyente para la sesión dada.
   * Soporta reentrancia transparente: si el contexto asíncrono ya posee el lock
   * de la sesión, la operación se ejecuta de inmediato sin encolarse ni provocar deadlock.
   */
  public async runExclusive<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
    const heldLocks = this.asyncLocalStorage.getStore();

    // Reentrancia: si ya poseemos el lock en esta cadena asíncrona, ejecutamos directamente
    if (heldLocks && heldLocks.has(sessionId)) {
      return await fn();
    }

    return new Promise<T>((resolve, reject) => {
      let queue = this.queues.get(sessionId);
      if (!queue) {
        queue = [];
        this.queues.set(sessionId, queue);
      }

      queue.push({
        resolve,
        reject,
        fn,
      });

      this.processNext(sessionId);
    });
  }

  /**
   * Comprueba si una sesión tiene una operación en ejecución o en cola.
   */
  public isLocked(sessionId: string): boolean {
    return this.running.has(sessionId) || (this.queues.get(sessionId)?.length ?? 0) > 0;
  }

  /**
   * Retorna la cantidad de tareas esperando en cola para una sesión.
   */
  public getQueueLength(sessionId: string): number {
    return this.queues.get(sessionId)?.length ?? 0;
  }

  private processNext(sessionId: string): void {
    if (this.running.has(sessionId)) {
      return;
    }

    const queue = this.queues.get(sessionId);
    if (!queue || queue.length === 0) {
      this.queues.delete(sessionId);
      return;
    }

    const task = queue.shift()!;
    this.running.add(sessionId);

    // Preparar el conjunto de locks para la cadena asíncrona actual
    const currentLocks = new Set(this.asyncLocalStorage.getStore() ?? []);
    currentLocks.add(sessionId);

    this.asyncLocalStorage.run(currentLocks, async () => {
      try {
        const result = await task.fn();
        task.resolve(result);
      } catch (err) {
        task.reject(err);
      } finally {
        this.running.delete(sessionId);
        this.processNext(sessionId);
      }
    });
  }
}

/**
 * Instancia singleton global para el proceso Main de Ego.
 */
export const sessionLifecycleLocks = new SessionLifecycleLocks();
