import { useState, useEffect, useCallback, useRef } from "react";
import { ego, type PendingApprovalInfo } from "../../lib/ego.js";

export interface ActivityState {
  status: "idle" | "working" | "approval";
  activeSubEgo?: string;
  currentAction?: string;
  pendingApprovals: PendingApprovalInfo[];
  vantaDbOk: boolean;
}

/**
 * T06: evento del bus de runtime (antes `(event: any)`). Solo se leen los
 * campos usados; el resto del payload se ignora por diseño.
 */
interface EgoRuntimeEvent {
  type: string;
  payload?: {
    subEgoId?: string;
    agentId?: string;
    toolName?: string;
    task?: string;
  };
}

function asRuntimeEvent(event: unknown): EgoRuntimeEvent | null {
  if (typeof event !== "object" || event === null) return null;
  const e = event as { type?: unknown; payload?: unknown };
  if (typeof e.type !== "string") return null;
  const p = (e.payload ?? {}) as NonNullable<EgoRuntimeEvent["payload"]>;
  return {
    type: e.type,
    payload: {
      subEgoId: typeof p.subEgoId === "string" ? p.subEgoId : undefined,
      agentId: typeof p.agentId === "string" ? p.agentId : undefined,
      toolName: typeof p.toolName === "string" ? p.toolName : undefined,
      task: typeof p.task === "string" ? p.task : undefined,
    },
  };
}

export function useActivityState() {
  const [state, setState] = useState<ActivityState>({
    status: "idle",
    activeSubEgo: undefined,
    currentAction: undefined,
    pendingApprovals: [],
    vantaDbOk: true,
  });

  const approvalsMap = useRef<Map<string, PendingApprovalInfo>>(new Map());
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Escuchar stream de eventos reales
  useEffect(() => {
    const unsubEvents = ego().onEvent?.((event: unknown) => {
      const e = asRuntimeEvent(event);
      if (!e) return;

      if (e.type === "task.started" || e.type === "tool.invoked") {
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);

        const subEgo = e.payload?.subEgoId || e.payload?.agentId || "Ego";
        const action = e.payload?.toolName || e.payload?.task || "Procesando...";

        setState((prev) => ({
          ...prev,
          status: prev.pendingApprovals.length > 0 ? "approval" : "working",
          activeSubEgo: subEgo,
          currentAction: action,
        }));
      } else if (
        e.type === "task.completed" ||
        e.type === "task.failed" ||
        e.type === "tool.completed"
      ) {
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(() => {
          setState((prev) => ({
            ...prev,
            status: prev.pendingApprovals.length > 0 ? "approval" : "idle",
            currentAction: undefined,
          }));
        }, 800);
      }
    });

    // Escuchar solicitudes de aprobación HITL
    const unsubApprovals = ego().onApprovalRequest?.((req: PendingApprovalInfo) => {
      if (!req || !req.approvalId) return;
      approvalsMap.current.set(req.approvalId, req);

      setState((prev) => ({
        ...prev,
        status: "approval",
        pendingApprovals: Array.from(approvalsMap.current.values()),
      }));
    });

    return () => {
      unsubEvents?.();
      unsubApprovals?.();
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const resolveApproval = useCallback(
    async (approvalId: string, approved: boolean, reason?: string) => {
      try {
        await ego().resolveApproval({
          approvalId,
          approved,
          reason,
        });
      } catch (err) {
        console.error("[useActivityState] Error al resolver aprobación:", err);
      } finally {
        approvalsMap.current.delete(approvalId);
        setState((prev) => {
          const remaining = Array.from(approvalsMap.current.values());
          return {
            ...prev,
            status: remaining.length > 0 ? "approval" : prev.currentAction ? "working" : "idle",
            pendingApprovals: remaining,
          };
        });
      }
    },
    []
  );

  return {
    ...state,
    resolveApproval,
  };
}
