import { useState } from "react";
import { ShieldCheck, Check, X, ShieldWarning } from "@phosphor-icons/react";
import { Button } from "../ui-kit/Button.js";
import { Badge } from "../ui-kit/Badge.js";

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
      <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-hairline bg-raised p-6 text-center">
        <ShieldCheck size={28} className="text-success mb-1.5" />
        <span className="text-xs font-medium text-ink">Bandeja de Aprobaciones Despejada</span>
        <span className="text-xs text-faint">
          No hay solicitudes de gobernanza humana (HITL) pendientes de autorización.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldWarning size={16} className="text-brand" />
          <h3 className="text-sm font-semibold text-ink">
            Aprobaciones Pendientes ({approvals.length})
          </h3>
        </div>

        {/* Acciones en lote */}
        <div className="flex items-center gap-1.5">
          <Button
            size="md"
            variant="secondary"
            icon={<Check size={12} />}
            onClick={handleApproveAllSafe}
            disabled={isBatchBusy}
            className="whitespace-nowrap hover:bg-success/10 hover:text-success"
          >
            Aprobar no críticas
          </Button>
          <Button
            size="md"
            variant="secondary"
            icon={<X size={12} />}
            onClick={handleRejectAll}
            disabled={isBatchBusy}
            className="whitespace-nowrap hover:bg-error/10 hover:text-error"
          >
            Rechazar todas
          </Button>
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
              className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-hairline bg-raised p-2.5 transition-colors"
            >
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {/* D3: el nivel de riesgo es una PÍLDORA de estado → la
                      primitive `Badge` del kit (tono semántico), no un
                      `<span>` con su propia caja y su propia paleta. */}
                  <Badge
                    tone={isCritical ? "risk" : isSensitive ? "warn" : "dim"}
                    className="shrink-0 uppercase"
                  >
                    {appr.riskLevel}
                  </Badge>
                  <span className="truncate font-mono text-xs font-medium text-ink">
                    {appr.toolName || appr.action}
                  </span>
                </div>
                {appr.details && (
                  <span className="mt-1 font-mono text-xs text-faint truncate">
                    {JSON.stringify(appr.details)}
                  </span>
                )}
              </div>

              {/* Botones individuales: son SÓLO-icono, luego el target táctil
                  obligatorio es 44×44 (`size="icon"` del kit). Además llevan
                  nombre accesible (`aria-label`) para lectores de pantalla. */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => handleResolve(appr.approvalId, true)}
                  disabled={isProcessing || isBatchBusy}
                  aria-label={`Aprobar ${appr.toolName || appr.action}`}
                  title="Aprobar ejecución"
                  className="border-success/40 bg-success/10 text-success hover:bg-success/20"
                >
                  <Check size={13} weight="bold" />
                </Button>
                <Button
                  size="icon"
                  variant="danger"
                  onClick={() => handleResolve(appr.approvalId, false)}
                  disabled={isProcessing || isBatchBusy}
                  aria-label={`Rechazar ${appr.toolName || appr.action}`}
                  title="Rechazar ejecución"
                >
                  <X size={13} weight="bold" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
