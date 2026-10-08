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
   */
  public static normalizePayload(rawEventName: string, rawPayload: any): Record<string, unknown> {
    if (!rawPayload || typeof rawPayload !== "object") {
      return { raw: rawPayload };
    }

    switch (rawEventName) {
      case "PreToolUse":
      case "tool_call_start":
        return {
          callId: rawPayload.callId || rawPayload.id || `call_${Date.now()}`,
          toolName: rawPayload.tool || rawPayload.name || "unknown_tool",
          input: rawPayload.input || rawPayload.arguments || {},
          riskLevel: rawPayload.riskLevel || "sensitive",
        };

      case "PostToolUse":
      case "tool_call_result":
        return {
          callId: rawPayload.callId || rawPayload.id || `call_${Date.now()}`,
          toolName: rawPayload.tool || rawPayload.name || "unknown_tool",
          durationMs: rawPayload.durationMs || 0,
          result: rawPayload.result ?? rawPayload.output,
        };

      case "PostToolUseFailure":
      case "tool_call_error":
        return {
          callId: rawPayload.callId || rawPayload.id || `call_${Date.now()}`,
          toolName: rawPayload.tool || rawPayload.name || "unknown_tool",
          durationMs: rawPayload.durationMs || 0,
          error: String(rawPayload.error || rawPayload.message || "Unknown error"),
        };

      case "PermissionRequest":
        return {
          approvalId: rawPayload.requestId || `appr_${Date.now()}`,
          action: rawPayload.action || rawPayload.tool || "sensitive_action",
          riskLevel: rawPayload.riskLevel || "destructive",
          details: rawPayload.details || rawPayload.parameters || {},
        };

      default:
        return { ...rawPayload };
    }
  }
}
