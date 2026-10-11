/**
 * @file agentEventBridge.ts
 * @description Puente tipado de eventos de agente de IA con deduplicación y watchdog de timeout.
 */

import type { AgentOpState } from "../behavior/stateArbiter";

export interface AgentInputEvent {
  eventId: string;
  type: "thinking" | "tool_call" | "approval_request" | "input_request" | "success" | "error";
  timestamp: number;
  requestId?: string;
  payload?: Record<string, unknown>;
}

export class AgentEventBridge {
  private processedIds: Set<string> = new Set();
  private currentState: AgentOpState = "idle";
  private activeRequestId: string | null = null;
  private lastEventTime: number = performance.now();
  private readonly TIMEOUT_MS = 25000;

  /**
   * Procesa un evento entrante del runtime de IA.
   */
  public ingest(event: AgentInputEvent): AgentOpState {
    if (this.processedIds.has(event.eventId)) {
      return this.currentState;
    }
    this.processedIds.add(event.eventId);
    if (this.processedIds.size > 200) {
      const first = this.processedIds.values().next().value;
      if (first) this.processedIds.delete(first);
    }

    this.lastEventTime = performance.now();

    switch (event.type) {
      case "thinking":
        this.currentState = "thinking";
        break;
      case "tool_call":
        this.currentState = "runningTool";
        break;
      case "approval_request":
        this.currentState = "waitingForApproval";
        this.activeRequestId = event.requestId || null;
        break;
      case "input_request":
        this.currentState = "needsInput";
        break;
      case "success":
        this.currentState = "success";
        this.activeRequestId = null;
        break;
      case "error":
        this.currentState = "error";
        this.activeRequestId = null;
        break;
    }

    return this.currentState;
  }

  /**
   * Resuelve una aprobación pendiente (HITL).
   */
  public resolveApproval(decision: "allow" | "deny"): { requestId: string | null; decision: string } {
    const req = this.activeRequestId;
    this.activeRequestId = null;
    this.currentState = decision === "allow" ? "runningTool" : "idle";
    return { requestId: req, decision };
  }

  /**
   * Watchdog: comprueba si el runtime dejó de responder durante thinking o tools.
   */
  public checkWatchdog(nowMs: number = performance.now()): AgentOpState {
    if (
      (this.currentState === "thinking" || this.currentState === "runningTool") &&
      nowMs - this.lastEventTime > this.TIMEOUT_MS
    ) {
      this.currentState = "idle"; // Recuperación por timeout
    }
    return this.currentState;
  }

  public getState(): AgentOpState {
    return this.currentState;
  }
}
