import { useState } from "react";
import { ShieldCheck, Check, X, ShieldWarning } from "@phosphor-icons/react";

export interface PendingApprovalItem {
  approvalId: string;
  action: string;
  riskLevel: "normal" | "sensitive" | "critical";
  details?: Record<string, unknown>;
  toolName?: string;
  timestamp?: number;
}

export interface PendingApprovalsProps {
  approvals: PendingApprovalItem[];
  onResolveOne: (approvalId: string, approved: boolean) => Promise<void>;
  onResolveBatch: (items: Array<{ approvalId: string; approved: boolean }>) => Promise<void>;
}

export function PendingApprovals({
  approvals,
  onResolveOne,
  onResolveBatch,
}: PendingApprovalsProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isBatchBusy, setIsBatchBusy] = useState(false);

  const handleResolve = async (approvalId: string, approved: boolean) => {
    setBusyId(approvalId);
    try {
      await onResolveOne(approvalId, approved);
    } finally {
      setBusyId(null);
    }
  };

  const handleApproveAllSafe = async () => {
    setIsBatchBusy(true);
    try {
      const safeItems = approvals
        .filter((a) => a.riskLevel !== "critical")
        .map((a) => ({ approvalId: a.approvalId, approved: true }));
      await onResolveBatch(safeItems);
    } finally {
      setIsBatchBusy(false);
    }
  };

  const handleRejectAll = async () => {
    setIsBatchBusy(true);
    try {
      const items = approvals.map((a) => ({ approvalId: a.approvalId, approved: false }));
      await onResolveBatch(items);
    } finally {
      setIsBatchBusy(false);
    }
  };

  if (approvals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-hairline bg-raised/20 p-6 text-center">
        <ShieldCheck size={28} className="text-emerald-500 mb-1.5" />
        <span className="text-xs font-medium text-ink">Bandeja de Aprobaciones Despejada</span>
        <span className="text-[11px] text-faint">
          No hay solicitudes de gobernanza humana (HITL) pendientes de autorización.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-raised/30 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldWarning size={16} className="text-amber-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink">
            Aprobaciones Pendientes ({approvals.length})
          </h3>
        </div>

        {/* Acciones en lote */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleApproveAllSafe}
            disabled={isBatchBusy}
            className="flex items-center gap-1 rounded bg-raised px-2 py-0.5 text-[10px] font-medium text-ink border border-hairline hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors disabled:opacity-50"
          >
            <Check size={11} />
            Aprobar no críticas
          </button>
          <button
            onClick={handleRejectAll}
            disabled={isBatchBusy}
            className="flex items-center gap-1 rounded bg-raised px-2 py-0.5 text-[10px] font-medium text-ink border border-hairline hover:bg-rose-500/10 hover:text-rose-400 transition-colors disabled:opacity-50"
          >
            <X size={11} />
            Rechazar todas
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {approvals.map((appr) => {
          const isCritical = appr.riskLevel === "critical";
          const isSensitive = appr.riskLevel === "sensitive";
          const isProcessing = busyId === appr.approvalId;

          return (
            <div
              key={appr.approvalId}
              className="flex items-center justify-between gap-3 rounded border border-hairline bg-panel p-2.5 transition-all"
            >
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.2 text-[9px] font-semibold uppercase ${
                      isCritical
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        : isSensitive
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    }`}
                  >
                    {appr.riskLevel}
                  </span>
                  <span className="font-mono text-xs font-medium text-ink truncate">
                    {appr.toolName || appr.action}
                  </span>
                </div>
                {appr.details && (
                  <span className="mt-1 font-mono text-[10px] text-faint truncate">
                    {JSON.stringify(appr.details)}
                  </span>
                )}
              </div>

              {/* Botones individuales */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleResolve(appr.approvalId, true)}
                  disabled={isProcessing || isBatchBusy}
                  className="flex items-center justify-center h-6 w-6 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                  title="Aprobar ejecución"
                >
                  <Check size={12} weight="bold" />
                </button>
                <button
                  onClick={() => handleResolve(appr.approvalId, false)}
                  disabled={isProcessing || isBatchBusy}
                  className="flex items-center justify-center h-6 w-6 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                  title="Rechazar ejecución"
                >
                  <X size={12} weight="bold" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
