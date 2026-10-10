import { useState, useEffect, useCallback, useRef } from "react";
import { ego, type PendingApprovalInfo } from "../../lib/ego.js";

export interface ActivityState {
  status: "idle" | "working" | "approval";
  activeSubEgo?: string;
  currentAction?: string;
  pendingApprovals: PendingApprovalInfo[];
  vantaDbOk: boolean;
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
    const unsubEvents = ego().onEvent?.((event: any) => {
      if (!event || !event.type) return;

      if (event.type === "task.started" || event.type === "tool.invoked") {
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);

        const subEgo = event.payload?.subEgoId || event.payload?.agentId || "Ego";
        const action = event.payload?.toolName || event.payload?.task || "Procesando...";

        setState((prev) => ({
          ...prev,
          status: prev.pendingApprovals.length > 0 ? "approval" : "working",
          activeSubEgo: subEgo,
          currentAction: action,
        }));
      } else if (
        event.type === "task.completed" ||
        event.type === "task.failed" ||
        event.type === "tool.completed"
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
