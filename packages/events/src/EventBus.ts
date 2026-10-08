import { randomUUID } from "node:crypto";
import {
  EgoEvent,
  EgoEventType,
  CanonicalEventPayloadMap,
  EventHandler,
  EventSubscription,
  EventSeverity,
} from "./types.js";

/**
 * Bus de eventos central y tipado de Ego Cognitive Operating System (ACT-05).
 * Desacopla la coordinación entre Sub-Egos, herramientas y presentación.
 */
export class EventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private anyListeners: Set<EventHandler> = new Set();
  private maxHistorySize: number;
  private recentEvents: EgoEvent[] = [];

  constructor(options: { maxHistorySize?: number } = {}) {
    this.maxHistorySize = options.maxHistorySize ?? 100;
  }

  /**
   * Emite un evento tipado hacia todos los suscriptores registrados.
   * La ejecución de los manejadores se realiza de forma asíncrona no bloqueante.
   */
  public emit<K extends keyof CanonicalEventPayloadMap>(
    type: K,
    payload: CanonicalEventPayloadMap[K],
    options: {
      source: string;
      severity?: EventSeverity;
      sessionId?: string;
      traceId?: string;
      metadata?: Record<string, unknown>;
    }
  ): EgoEvent<CanonicalEventPayloadMap[K]>;
  public emit<T = unknown>(
    type: EgoEventType,
    payload: T,
    options: {
      source: string;
      severity?: EventSeverity;
      sessionId?: string;
      traceId?: string;
      metadata?: Record<string, unknown>;
    }
  ): EgoEvent<T>;
  public emit(
    type: EgoEventType,
    payload: unknown,
    options: {
      source: string;
      severity?: EventSeverity;
      sessionId?: string;
      traceId?: string;
      metadata?: Record<string, unknown>;
    }
  ): EgoEvent {
    const event: EgoEvent = {
      id: randomUUID(),
      type,
      timestamp: Date.now(),
      source: options.source,
      payload,
      severity: options.severity ?? "info",
      sessionId: options.sessionId,
      traceId: options.traceId,
      metadata: options.metadata,
    };

    // Almacenar en historial circular
    this.recentEvents.push(event);
    if (this.recentEvents.length > this.maxHistorySize) {
      this.recentEvents.shift();
    }

    // Despacho no bloqueante via queueMicrotask
    queueMicrotask(() => {
      this.dispatch(event);
    });

    return event;
  }

  /**
   * Suscribe un manejador a un tipo de evento específico o a un patrón wildcard (ej. "tool.*").
   */
  public on<K extends keyof CanonicalEventPayloadMap>(
    type: K,
    handler: (event: EgoEvent<CanonicalEventPayloadMap[K]>) => void | Promise<void>
  ): EventSubscription;
  public on<T = unknown>(
    type: string,
    handler: EventHandler<T>
  ): EventSubscription;
  public on(type: string, handler: EventHandler): EventSubscription {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);

    return {
      unsubscribe: () => this.off(type, handler),
    };
  }

  /**
   * Suscribe un manejador que se ejecutará solo una vez para el tipo de evento indicado.
   */
  public once<K extends keyof CanonicalEventPayloadMap>(
    type: K,
    handler: (event: EgoEvent<CanonicalEventPayloadMap[K]>) => void | Promise<void>
  ): EventSubscription;
  public once<T = unknown>(
    type: string,
    handler: EventHandler<T>
  ): EventSubscription;
  public once(type: string, handler: EventHandler): EventSubscription {
    const wrapper: EventHandler = (event) => {
      this.off(type, wrapper);
      handler(event);
    };
    return this.on(type, wrapper);
  }

  /**
   * Elimina un manejador registrado.
   */
  public off(type: string, handler: EventHandler): void {
    const handlers = this.listeners.get(type);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(type);
      }
    }
  }

  /**
   * Suscribe un manejador global a todos los eventos emitidos en el bus.
   */
  public onAny(handler: EventHandler): EventSubscription {
    this.anyListeners.add(handler);
    return {
      unsubscribe: () => {
        this.anyListeners.delete(handler);
      },
    };
  }

  /**
   * Espera de forma asíncrona a que ocurra un evento específico que cumpla con un predicado opcional.
   */
  public waitFor<K extends keyof CanonicalEventPayloadMap>(
    type: K,
    filter?: (event: EgoEvent<CanonicalEventPayloadMap[K]>) => boolean,
    timeoutMs: number = 10000
  ): Promise<EgoEvent<CanonicalEventPayloadMap[K]>> {
    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout | null = null;

      const subscription = this.on(type, (event: EgoEvent<any>) => {
        if (!filter || filter(event)) {
          if (timer) clearTimeout(timer);
          subscription.unsubscribe();
          resolve(event);
        }
      });

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          subscription.unsubscribe();
          reject(new Error(`Timeout (${timeoutMs}ms) esperando evento: ${String(type)}`));
        }, timeoutMs);
      }
    });
  }

  /**
   * Retorna una copia de los eventos recientes para diagnósticos o reconstrucción de estado.
   */
  public getRecentEvents(limit?: number): EgoEvent[] {
    const list = [...this.recentEvents];
    return typeof limit === "number" ? list.slice(-limit) : list;
  }

  /**
   * Limpia todos los listeners y el historial.
   */
  public clear(): void {
    this.listeners.clear();
    this.anyListeners.clear();
    this.recentEvents = [];
  }

  /**
   * Despacho interno evaluando coincidencia exacta y patrones wildcard.
   */
  private dispatch(event: EgoEvent): void {
    // 1. Listeners exactos
    const exactHandlers = this.listeners.get(event.type);
    if (exactHandlers) {
      for (const handler of exactHandlers) {
        this.safeInvoke(handler, event);
      }
    }

    // 2. Listeners wildcard (ej. "tool.*")
    const parts = event.type.split(".");
    if (parts.length > 1) {
      const wildcardType = `${parts[0]}.*`;
      const wildcardHandlers = this.listeners.get(wildcardType);
      if (wildcardHandlers) {
        for (const handler of wildcardHandlers) {
          this.safeInvoke(handler, event);
        }
      }
    }

    // 3. Listeners globales onAny
    for (const handler of this.anyListeners) {
      this.safeInvoke(handler, event);
    }
  }

  private safeInvoke(handler: EventHandler, event: EgoEvent): void {
    try {
      const result = handler(event);
      if (result instanceof Promise) {
        result.catch((err) => {
          console.error(`[EventBus] Error asíncrono en manejador para ${event.type}:`, err);
        });
      }
    } catch (err) {
      console.error(`[EventBus] Error síncrono en manejador para ${event.type}:`, err);
    }
  }
}
