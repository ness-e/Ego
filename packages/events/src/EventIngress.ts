import { EventBus } from "./EventBus.js";
import { EventNormalizer } from "./EventNormalizer.js";
import { EgoEvent, EgoEventType, EventSeverity } from "./types.js";

export interface IngressOptions {
  source?: string;
  sessionId?: string;
  traceId?: string;
  timeoutMs?: number;
  fallbackDecision?: "ask" | "deny" | "timeout";
}

export interface IngressResult {
  status: "accepted" | "resolved" | "timed_out" | "rejected";
  eventId: string;
  isInteractive: boolean;
  decision?: unknown;
  durationMs: number;
}

export interface InteractiveDecision {
  approvalId: string;
  approved: boolean;
  decision: "allow" | "deny" | "ask";
  resolvedBy: string;
  reason?: string;
}

interface PendingInteractiveAdmission {
  approvalId: string;
  resolve: (result: IngressResult) => void;
  timer: NodeJS.Timeout;
  startedAt: number;
  fallbackDecision: "ask" | "deny" | "timeout";
  eventId: string;
}

/**
 * Event Ingress No Bloqueante por Defecto (Patrón Coucou COUC-02).
 *
 * Despacha eventos informativos ordinarios de manera fire-and-forget al EventBus
 * sin bloquear el cliente/hook externo. Solo retiene de forma síncrona
 * aquellas solicitudes interactivas (HITL / approval.required) esperando decisión humana.
 */
export class EventIngress {
  private readonly eventBus: EventBus;
  private readonly pendingInteractions = new Map<string, PendingInteractiveAdmission>();
  private readonly defaultTimeoutMs: number;

  constructor(eventBus?: EventBus, defaultTimeoutMs: number = 120_000) {
    this.eventBus = eventBus ?? new EventBus();
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  /**
   * Determina si un tipo de evento requiere retención interactiva síncrona.
   */
  public static isInteractiveEvent(type: EgoEventType): boolean {
    return type === "approval.required";
  }

  /**
   * Ingreso de eventos externos crudos (CLI, OpenCode, Claude Code, MCP hooks).
   * L10: el crudo entra como `unknown`; el narrowing vive en `EventNormalizer`
   * y en el `Record` local — nunca se propaga `any` al núcleo.
   */
  public async ingressRaw(
    rawEventName: string,
    rawPayload: unknown,
    options: IngressOptions = {}
  ): Promise<IngressResult> {
    const startedAt = Date.now();
    const canonicalType = EventNormalizer.normalizeType(rawEventName);
    const normalizedPayload = EventNormalizer.normalizePayload(rawEventName, rawPayload);
    const raw = (rawPayload ?? {}) as Record<string, unknown>;

    const event: EgoEvent = {
      id: (raw.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`) as string,
      type: canonicalType,
      timestamp: startedAt,
      source: options.source ?? (raw.source as string) ?? "edge-ingress",
      sessionId: options.sessionId ?? (raw.sessionId as string),
      traceId: options.traceId ?? (raw.traceId as string),
      severity: this.inferSeverity(canonicalType, normalizedPayload),
      payload: normalizedPayload,
    };

    return this.ingressCanonical(event, options);
  }

  /**
   * Ingreso de eventos canónicos EgoEvent.
   * Si es informativo, despacha fire-and-forget y retorna inmediatamente status: "accepted".
   * Si es interactivo, suspende hasta resolución HITL o timeout.
   */
  public async ingressCanonical(
    event: EgoEvent,
    options: IngressOptions = {}
  ): Promise<IngressResult> {
    const startedAt = Date.now();
    const isInteractive = EventIngress.isInteractiveEvent(event.type);

    if (!isInteractive) {
      // Fire-and-forget: emite en microtarea / background sin esperar listeners
      queueMicrotask(() => {
        void this.eventBus.emit(event);
      });

      return {
        status: "accepted",
        eventId: event.id,
        isInteractive: false,
        durationMs: Date.now() - startedAt,
      };
    }

    // Solicitud interactiva (ej. approval.required)
    const payload = event.payload as Record<string, unknown> | undefined;
    const approvalId = (payload?.approvalId as string) || event.id;
    const timeoutMs = options.timeoutMs ?? (payload?.timeoutMs as number) ?? this.defaultTimeoutMs;
    const fallbackDecision = options.fallbackDecision ?? "ask";

    return new Promise<IngressResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingInteractions.delete(approvalId);
        resolve({
          status: "timed_out",
          eventId: event.id,
          isInteractive: true,
          decision: { approvalId, approved: false, decision: fallbackDecision, reason: "Ingress timeout exceeded" },
          durationMs: Date.now() - startedAt,
        });
      }, timeoutMs);

      this.pendingInteractions.set(approvalId, {
        approvalId,
        resolve,
        timer,
        startedAt,
        fallbackDecision,
        eventId: event.id,
      });

      // Emitir al bus para notificar a la UI / Human-in-the-loop Bridge
      void this.eventBus.emit(event);
    });
  }

  /**
   * Resuelve una solicitud interactiva pendiente retenida en el Ingress.
   */
  public resolveInteractive(decision: InteractiveDecision): boolean {
    const pending = this.pendingInteractions.get(decision.approvalId);
    if (!pending) {
      return false;
    }

    clearTimeout(pending.timer);
    this.pendingInteractions.delete(decision.approvalId);

    // Emitir el evento de resolución en el bus
    const resolutionEvent: EgoEvent = {
      id: `evt_res_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: "approval.resolved",
      timestamp: Date.now(),
      source: "ingress-resolution",
      payload: {
        approvalId: decision.approvalId,
        approved: decision.approved,
        resolvedBy: decision.resolvedBy,
        reason: decision.reason,
      },
      severity: "info",
    };
    void this.eventBus.emit(resolutionEvent);

    pending.resolve({
      status: "resolved",
      eventId: pending.eventId,
      isInteractive: true,
      decision,
      durationMs: Date.now() - pending.startedAt,
    });

    return true;
  }

  public getPendingInteractiveCount(): number {
    return this.pendingInteractions.size;
  }

  public clearPending(): void {
    for (const [id, pending] of this.pendingInteractions.entries()) {
      clearTimeout(pending.timer);
      pending.resolve({
        status: "rejected",
        eventId: pending.eventId,
        isInteractive: true,
        decision: { approvalId: id, approved: false, decision: "deny", reason: "Ingress cleared" },
        durationMs: Date.now() - pending.startedAt,
      });
    }
    this.pendingInteractions.clear();
  }

  private inferSeverity(type: EgoEventType, payload: unknown): EventSeverity {
    const p = (payload ?? {}) as Record<string, unknown>;
    if (type === "approval.required" || type === "system.alert" || type === "task.failed") {
      return (p.riskLevel === "destructive" || p.severity === "critical") ? "critical" : "warn";
    }
    if (type === "tool.failed") {
      return "warn";
    }
    return "info";
  }
}
