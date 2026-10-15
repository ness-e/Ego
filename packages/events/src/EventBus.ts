import { randomUUID } from "node:crypto";
import {
  EgoEvent,
  EgoEventType,
  CanonicalEventPayloadMap,
  EventHandler,
  EventSubscription,
  EventSeverity,
  HookCommandConfig,
  HooksConfig,
  HooksStatus,
  HookDecision,
} from "./types.js";

// ── Validación de hooks (CFG-09, fail-closed) ────────────────────────────
// El bus NUNCA ejecuta comandos: solo valida sintaxis y decide de forma
// sincrónica. La ejecución vive en main (ExecutionManager). Todo lo
// inválido bloquea (PreToolUse) o se reporta (status).

const HOOK_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const TOOL_PATTERN_RE = /^[A-Za-z0-9_.*:-]{1,128}$/;
const ENV_KEY_RE = /^[A-Z_][A-Z0-9_]{0,63}$/;
const SHELL_META_RE = /[;|&$`\\]|<\s*\(|\)\s*\{|\$\(|<\>|>>|\n/;
const MAX_HOOK_COMMAND_LEN = 512;
const MAX_HOOK_TIMEOUT_MS = 30_000;
const MAX_SESSION_ID_LEN = 128;
const MAX_ENV_ENTRIES = 32;
const MAX_ENV_VALUE_LEN = 4096;

/** Valida el id de un hook. */
export function isValidHookId(id: unknown): id is string {
  return typeof id === "string" && HOOK_ID_RE.test(id);
}

/** Valida el matcher de herramienta de un hook. */
export function isValidToolPattern(pattern: unknown): pattern is string {
  if (typeof pattern !== "string" || !TOOL_PATTERN_RE.test(pattern)) return false;
  // `*` solo como comodín total o sufijo (`terminal*`); nunca intermedio.
  const star = pattern.indexOf("*");
  if (star === -1) return true;
  return pattern === "*" || (star === pattern.length - 1 && pattern.indexOf("*") === pattern.lastIndexOf("*"));
}

/** Valida el comando de un hook (sintaxis; la ejecución es de main). */
export function isValidHookCommand(command: unknown): command is string {
  if (typeof command !== "string") return false;
  const cmd = command.trim();
  if (cmd.length === 0 || cmd.length > MAX_HOOK_COMMAND_LEN) return false;
  return !SHELL_META_RE.test(cmd);
}

/** Valida el timeout sugerido de un hook. */
export function isValidHookTimeoutMs(timeoutMs: unknown): boolean {
  if (timeoutMs === undefined) return true;
  return (
    typeof timeoutMs === "number" &&
    Number.isFinite(timeoutMs) &&
    timeoutMs >= 0 &&
    timeoutMs <= MAX_HOOK_TIMEOUT_MS
  );
}

/**
 * Determina si un matcher cubre una herramienta (`*` global, `pre*`
 * prefijo, resto exacto). Entradas inválidas nunca matchean (fail-closed
 * hacia permitir = no interceptar sin config válida).
 */
export function matchToolPattern(pattern: string, toolName: string): boolean {
  if (!isValidToolPattern(pattern) || typeof toolName !== "string" || toolName.length === 0) {
    return false;
  }
  if (pattern === "*") return true;
  if (pattern.endsWith("*")) return toolName.startsWith(pattern.slice(0, -1));
  return toolName === pattern;
}

/**
 * Bus de eventos central y tipado de Ego Cognitive Operating System (ACT-05).
 * Desacopla la coordinación entre Sub-Egos, herramientas y presentación.
 */
export class EventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private anyListeners: Set<EventHandler> = new Set();
  private maxHistorySize: number;
  private recentEvents: EgoEvent[] = [];
  // Hooks de ciclo de vida (CFG-09): gate sincrónico fail-closed + env por sesión.
  private hooksDisabled: boolean = false;
  private hookEntries: HookCommandConfig[] = [];
  private hookStatusCommand: string | null = null;
  private sessionEnv: Map<string, Record<string, string>> = new Map();

  constructor(options: { maxHistorySize?: number } = {}) {
    this.maxHistorySize = options.maxHistorySize ?? 100;
  }

  /**
   * Emite un evento tipado hacia todos los suscriptores registrados.
   * La ejecución de los manejadores se realiza de forma asíncrona no bloqueante.
   */
  public emit<T = unknown>(event: EgoEvent<T>): EgoEvent<T>;
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
    typeOrEvent: EgoEventType | EgoEvent,
    payload?: unknown,
    options?: {
      source: string;
      severity?: EventSeverity;
      sessionId?: string;
      traceId?: string;
      metadata?: Record<string, unknown>;
    }
  ): EgoEvent {
    let event: EgoEvent;

    if (typeof typeOrEvent === "object" && typeOrEvent !== null && "type" in typeOrEvent) {
      event = typeOrEvent as EgoEvent;
    } else {
      const type = typeOrEvent as EgoEventType;
      event = {
        id: randomUUID(),
        type,
        timestamp: Date.now(),
        source: options?.source ?? "unknown",
        payload,
        severity: options?.severity ?? "info",
        sessionId: options?.sessionId,
        traceId: options?.traceId,
        metadata: options?.metadata,
      };
    }

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

      const subscription = this.on(type, (event: EgoEvent<CanonicalEventPayloadMap[K]>) => {
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

  // ── Hooks Pre/PostToolUse + env por sesión + status (CFG-09) ──────────

  /**
   * Aplica la configuración de hooks. Fail-closed: cualquier entrada o
   * `statusCommand` inválido lanza y NO cambia la config vigente.
   */
  public configureHooks(config: HooksConfig = {}): void {
    const entries = config.hooks ?? [];
    const invalid: string[] = [];
    for (const h of entries) {
      const ok =
        h !== null &&
        typeof h === "object" &&
        isValidHookId(h.id) &&
        (h.kind === "PreToolUse" || h.kind === "PostToolUse") &&
        isValidToolPattern(h.toolPattern) &&
        isValidHookCommand(h.command) &&
        isValidHookTimeoutMs(h.timeoutMs);
      if (!ok) invalid.push(typeof h?.id === "string" && h.id.length > 0 ? h.id : "<sin-id>");
    }
    if (
      config.statusCommand !== undefined &&
      config.statusCommand !== null &&
      !isValidHookCommand(config.statusCommand)
    ) {
      invalid.push("<statusCommand>");
    }
    if (invalid.length > 0) {
      throw new Error(`[EventBus] Configuración de hooks rechazada (fail-closed): ${invalid.join(", ")}`);
    }
    const seen = new Set<string>();
    for (const h of entries) {
      if (seen.has(h.id)) {
        throw new Error(`[EventBus] Hook duplicado (fail-closed): ${h.id}`);
      }
      seen.add(h.id);
    }
    this.hooksDisabled = config.disableAllHooks === true;
    this.hookEntries = entries.map((h) => ({ ...h, timeoutMs: h.timeoutMs ?? 5000 }));
    this.hookStatusCommand =
      config.statusCommand === undefined || config.statusCommand === null
        ? null
        : config.statusCommand.trim();
  }

  /**
   * Inyecta variables de entorno para una sesión (disponibles al evaluar
   * hooks). Fail-closed: claves/valores inválidos lanzan sin mutar.
   */
  public setSessionEnv(sessionId: string, env: Record<string, string>): void {
    if (typeof sessionId !== "string" || sessionId.length === 0 || sessionId.length > MAX_SESSION_ID_LEN) {
      throw new Error("[EventBus] sessionId inválido para env de sesión");
    }
    if (env === null || typeof env !== "object" || Array.isArray(env)) {
      throw new Error("[EventBus] env de sesión debe ser un objeto plano");
    }
    const keys = Object.keys(env);
    if (keys.length > MAX_ENV_ENTRIES) {
      throw new Error(`[EventBus] env de sesión excede ${MAX_ENV_ENTRIES} entradas`);
    }
    for (const k of keys) {
      const v = env[k];
      if (!ENV_KEY_RE.test(k) || typeof v !== "string" || v.length > MAX_ENV_VALUE_LEN) {
        throw new Error(`[EventBus] variable de sesión inválida (fail-closed): ${k}`);
      }
    }
    this.sessionEnv.set(sessionId, { ...env });
  }

  /** Retorna una copia del env inyectado para la sesión (o `{}`). */
  public getSessionEnv(sessionId: string): Record<string, string> {
    const env = this.sessionEnv.get(sessionId);
    return env ? { ...env } : {};
  }

  /** Env efectivo para evaluar hooks de una sesión (hoy = env de sesión). */
  public getHookEnv(sessionId?: string): Record<string, string> {
    if (typeof sessionId !== "string" || sessionId.length === 0) return {};
    return this.getSessionEnv(sessionId);
  }

  /**
   * Gate PreToolUse: con kill switch permite todo; con tool inválido
   * bloquea; con hook PreToolUse válido que matchea bloquea
   * (`blocked-by-hook:<id>`: main ejecuta el comando para decidir);
   * sin match permite.
   */
  public evaluatePreToolUse(toolName: string, sessionId?: string): HookDecision {
    void sessionId;
    if (this.hooksDisabled) return { allow: true, reason: "hooks-disabled" };
    if (typeof toolName !== "string" || toolName.length === 0) {
      return { allow: false, reason: "invalid-tool-name" };
    }
    for (const h of this.hookEntries) {
      if (h.kind !== "PreToolUse") continue;
      if (!matchToolPattern(h.toolPattern, toolName)) continue;
      if (!isValidHookCommand(h.command)) {
        return { allow: false, reason: "invalid-hook-command", matchedHookId: h.id };
      }
      return { allow: false, reason: `blocked-by-hook:${h.id}`, matchedHookId: h.id };
    }
    return { allow: true, reason: "no-matching-hook" };
  }

  /**
   * Observación PostToolUse: nunca bloquea (el efecto ya ocurrió); reporta
   * el hook que observa, si lo hay. Comando inválido se reporta en `reason`.
   */
  public recordPostToolUse(toolName: string, sessionId?: string): HookDecision {
    void sessionId;
    if (this.hooksDisabled) return { allow: true, reason: "hooks-disabled" };
    if (typeof toolName !== "string" || toolName.length === 0) {
      return { allow: true, reason: "invalid-tool-name" };
    }
    for (const h of this.hookEntries) {
      if (h.kind !== "PostToolUse") continue;
      if (!matchToolPattern(h.toolPattern, toolName)) continue;
      if (!isValidHookCommand(h.command)) {
        return { allow: true, reason: "invalid-hook-command", matchedHookId: h.id };
      }
      return { allow: true, reason: `observed-by-hook:${h.id}`, matchedHookId: h.id };
    }
    return { allow: true, reason: "no-matching-hook" };
  }

  /** Snapshot de estado de hooks para UI/diagnóstico (status command). */
  public getHooksStatus(): HooksStatus {
    const invalidCommands = this.hookEntries.filter((h) => !isValidHookCommand(h.command)).map((h) => h.id);
    return {
      disabled: this.hooksDisabled,
      preToolUse: this.hookEntries.filter((h) => h.kind === "PreToolUse").length,
      postToolUse: this.hookEntries.filter((h) => h.kind === "PostToolUse").length,
      sessionsWithEnv: this.sessionEnv.size,
      commandsValid: invalidCommands.length === 0,
      invalidCommands,
      statusCommand: this.hookStatusCommand,
    };
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
