import { useState, useEffect } from "react";
import { Sparkle, Warning, Check, X, ShieldCheck } from "@phosphor-icons/react";
import { useActivityState } from "./useActivityState.js";

export function ActivityWidget() {
  const { status, activeSubEgo, currentAction, pendingApprovals, resolveApproval } =
    useActivityState();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const currentApproval = pendingApprovals[0];

  // Atajos de teclado en el modal de aprobación rápida (Enter: aprobar, Escape: cerrar)
  useEffect(() => {
    if (!isModalOpen || !currentApproval) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        resolveApproval(currentApproval.approvalId, true);
        if (pendingApprovals.length <= 1) setIsModalOpen(false);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, currentApproval, pendingApprovals.length, resolveApproval]);

  return (
    <div className="flex items-center gap-2 app-region-no-drag relative">
      {/* 1. Estado Idle */}
      {status === "idle" && (
        <div
          data-testid="activity-idle"
          className="flex items-center gap-1.5 rounded-full border border-hairline bg-raised px-2.5 py-0.5 text-[11px] text-faint"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>VantaDB Core OK</span>
        </div>
      )}

      {/* 2. Estado Working */}
      {status === "working" && (
        <div
          data-testid="activity-working"
          className="flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/20 px-3 py-0.5 text-[11px] text-cyan-300"
        >
          <Sparkle className="animate-spin text-cyan-400" size={13} />
          <span className="truncate max-w-[200px]">
            {activeSubEgo ? `${activeSubEgo}: ` : ""}
            {currentAction || "Ejecutando..."}
          </span>
        </div>
      )}

      {/* 3. Estado Approval (HITL) */}
      {status === "approval" && (
        <div
          data-testid="activity-approval"
          className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-950/30 px-3 py-0.5 text-[11px] text-amber-200 shadow-sm animate-pulse"
        >
          <Warning size={14} className="text-amber-400" />
          <span>
            HITL Requerido{pendingApprovals.length > 1 ? ` (${pendingApprovals.length})` : ""}
          </span>
          <button
            onClick={() => setIsModalOpen(true)}
            className="rounded bg-amber-500 px-1.5 py-0.2 text-[10px] font-semibold text-black hover:bg-amber-400 transition-colors"
          >
            Revisar
          </button>
        </div>
      )}

      {/* Modal de Aprobación Rápida HITL */}
      {isModalOpen && currentApproval && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-hairline bg-raised p-5 shadow-2xl text-ink">
            <div className="flex items-center justify-between border-b border-hairline pb-3 mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-amber-400" />
                <h3 className="font-semibold text-sm">Autorización Rápida de Operación</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-dim hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-faint">Herramienta: </span>
                <span className="font-mono font-bold text-amber-300">{currentApproval.toolName}</span>
              </div>
              <div>
                <span className="text-faint">Sub-Ego: </span>
                <span className="font-medium text-ink">{currentApproval.action.subEgoId}</span>
              </div>
              <div>
                <span className="text-faint">Nivel de Riesgo: </span>
                <span
                  className={`font-semibold uppercase text-[10px] px-1.5 py-0.5 rounded ${
                    currentApproval.riskLevel === "destructive"
                      ? "bg-rose-950 text-rose-300 border border-rose-500/30"
                      : "bg-amber-950 text-amber-300 border border-amber-500/30"
                  }`}
                >
                  {currentApproval.riskLevel}
                </span>
              </div>

              <div>
                <span className="text-faint">Parámetros:</span>
                <pre className="mt-1 max-h-36 overflow-auto rounded bg-paper p-2 font-mono text-[11px] text-ink border border-hairline">
                  {JSON.stringify(currentApproval.arguments, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-hairline pt-3">
              <span className="text-[10px] text-dim">
                Atajos: <kbd className="px-1 py-0.5 bg-raised rounded font-mono">Enter</kbd> Aprobar,{" "}
                <kbd className="px-1 py-0.5 bg-raised rounded font-mono">Esc</kbd> Cancelar
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    resolveApproval(currentApproval.approvalId, false, "Rechazado desde widget");
                    if (pendingApprovals.length <= 1) setIsModalOpen(false);
                  }}
                  className="flex items-center gap-1 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 px-3 py-1.5 text-xs font-semibold text-rose-300 transition-colors"
                >
                  <X size={14} />
                  <span>Rechazar</span>
                </button>
                <button
                  onClick={() => {
                    resolveApproval(currentApproval.approvalId, true);
                    if (pendingApprovals.length <= 1) setIsModalOpen(false);
                  }}
                  className="flex items-center gap-1 rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                >
                  <Check size={14} weight="bold" />
                  <span>Aprobar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
