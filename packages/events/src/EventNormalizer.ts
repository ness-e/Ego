import { EgoEventType } from "./types.js";

/**
 * Mapeo de nombres heterogéneos de eventos externos hacia los nombres canónicos de Ego.
 * Patrón Coucou COUC-01 (Event normalization at the edge).
 */
const EXTERNAL_EVENT_MAPPINGS: Record<string, EgoEventType> = {
  // Claude Code / Copilot / OpenCode
  "SessionStart": "task.started",
  "SessionEnd": "task.completed",
  "PreToolUse": "tool.started",
  "PostToolUse": "tool.executed",
  "PostToolUseFailure": "tool.failed",
  "PermissionRequest": "approval.required",
  "Notification": "system.alert",
  "SubagentStart": "subego.invoked",
  "SubagentStop": "subego.completed",

  // Hermes Agent hooks
  "tool_call_start": "tool.started",
  "tool_call_result": "tool.executed",
  "tool_call_error": "tool.failed",
  "agent_start": "subego.invoked",
  "agent_finish": "subego.completed",

  // MCP Standard Notifications
  "notifications/tools/list_changed": "system.alert",
  "notifications/resources/updated": "artifact.modified",
};

/**
 * Normalizador en el borde de eventos externos.
 * El núcleo de Ego nunca procesa eventos crudos de terceros; todo pasa por este adaptador.
 */
export class EventNormalizer {
  /**
   * Determina si un evento crudo externo tiene un mapeo canónico directo.
   */
  public static canNormalize(rawEventName: string): boolean {
    return Boolean(EXTERNAL_EVENT_MAPPINGS[rawEventName]);
  }

  /**
   * Normaliza el nombre del evento crudo hacia el `EgoEventType` canónico.
   * Si no se conoce, clasifica de forma segura como `system.alert`.
   */
  public static normalizeType(rawEventName: string): EgoEventType {
    return EXTERNAL_EVENT_MAPPINGS[rawEventName] ?? "system.alert";
  }

  /**
   * Transforma una carga útil externa arbitraria a un payload estructurado compatible con Ego.
   * L10: `unknown` en el borde — el núcleo nunca toca el crudo sin narrowing.
   */
  public static normalizePayload(rawEventName: string, rawPayload: unknown): Record<string, unknown> {
    if (!rawPayload || typeof rawPayload !== "object") {
      return { raw: rawPayload };
    }
    const payload = rawPayload as Record<string, unknown>;

    switch (rawEventName) {
      case "PreToolUse":
      case "tool_call_start":
        return {
          callId: payload.callId || payload.id || `call_${Date.now()}`,
          toolName: payload.tool || payload.name || "unknown_tool",
          input: payload.input || payload.arguments || {},
          riskLevel: payload.riskLevel || "sensitive",
        };

      case "PostToolUse":
      case "tool_call_result":
        return {
          callId: payload.callId || payload.id || `call_${Date.now()}`,
          toolName: payload.tool || payload.name || "unknown_tool",
          durationMs: payload.durationMs || 0,
          result: payload.result ?? payload.output,
        };

      case "PostToolUseFailure":
      case "tool_call_error":
        return {
          callId: payload.callId || payload.id || `call_${Date.now()}`,
          toolName: payload.tool || payload.name || "unknown_tool",
          durationMs: payload.durationMs || 0,
          error: String(payload.error || payload.message || "Unknown error"),
        };

      case "PermissionRequest":
        return {
          approvalId: payload.requestId || `appr_${Date.now()}`,
          action: payload.action || payload.tool || "sensitive_action",
          riskLevel: payload.riskLevel || "destructive",
          details: payload.details || payload.parameters || {},
        };

      default:
        return { ...payload };
    }
  }
}
