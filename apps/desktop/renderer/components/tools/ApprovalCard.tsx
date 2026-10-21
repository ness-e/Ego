"use client";
import { useState, useMemo, useCallback } from "react";
import {
  ShieldWarning,
  Check,
  X,
  PencilSimple,
  Terminal,
  FileText,
  Clock,
  ArrowCounterClockwise
} from "@phosphor-icons/react";
import type { PendingApprovalInfo } from "../../lib/ego.js";
import { DiffView } from "../canvas/DiffView.js";
import { Button } from "../ui-kit/Button.js";
import { Input } from "../ui-kit/Input.js";
import { Textarea } from "../ui-kit/Textarea.js";
import { Badge } from "../ui-kit/Badge.js";

export interface ApprovalCardProps {
  request: PendingApprovalInfo;
  onResolve: (decision: {
    approved: boolean;
    reason?: string;
    modifiedArguments?: Record<string, unknown>;
  }) => Promise<void> | void;
}

/**
 * ApprovalCard — Tarjeta interactiva de aprobación HITL en Chat UI (ACT-07).
 *
 * Implementa la compuerta HERM-03 (ask-directive visual) y OCLW-08 (diff preview).
 * Permite al usuario aprobar, rechazar o editar parámetros antes de autorizar.
 *
 * FASE 1 (design system): los controles pasan por el kit `ui-kit` (Button /
 * Input / Textarea / Badge) y toda la superficie usa los tokens canónicos
 * (radio del sistema, elevación L1, escala tipográfica de 3 tamaños). El
 * bloque de código usa la superficie `bg-paper` (token) en vez de negro
 * translúcido.
 */
export function ApprovalCard({ request, onResolve }: ApprovalCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedArgsText, setEditedArgsText] = useState(() =>
    JSON.stringify(request.arguments, null, 2)
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [digestError, setDigestError] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolvedStatus, setResolvedStatus] = useState<"approved" | "rejected" | null>(
    request.status === "approved"
      ? "approved"
      : request.status === "rejected" || request.status === "timed_out" || request.status === "aborted"
      ? "rejected"
      : null
  );

  const isDestructive = request.riskLevel === "destructive";
  const isTerminal = request.toolName === "terminal_exec";
  const isFilesystem = request.toolCategory === "filesystem" || request.toolName.startsWith("fs_");

  const terminalCommand = useMemo(() => {
    if (isTerminal && typeof request.arguments.command === "string") {
      return request.arguments.command;
    }
    return null;
  }, [isTerminal, request.arguments]);

  const filePath = useMemo(() => {
    if (isFilesystem && typeof request.arguments.path === "string") {
      return request.arguments.path;
    }
    return null;
  }, [isFilesystem, request.arguments]);

  const fileContent = useMemo(() => {
    if (isFilesystem && typeof request.arguments.content === "string") {
      return request.arguments.content;
    }
    return null;
  }, [isFilesystem, request.arguments]);

  // A3: diff unificado cuando la solicitud trae el original. `originalContent`
  // llega en `arguments` (fs_write con lectura previa); sin él se conserva el
  // bloque de contenido plano (vacío honesto, sin inventar diff).
  const originalContent = useMemo(() => {
    const v: unknown = request.arguments.originalContent;
    return typeof v === "string" ? v : null;
  }, [request.arguments]);

  const handleApprove = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setJsonError(null);
    setDigestError(null);

    // R10b: verificar identidad antes de aprobar — sin digest no hay aprobación.
    if (!request.action?.inputDigest) {
      setDigestError(
        "Falta el digest de identidad (R10b): aprobación bloqueada por seguridad."
      );
      setIsSubmitting(false);
      return;
    }

    let finalModifiedArgs: Record<string, unknown> | undefined = undefined;

    if (isEditing) {
      try {
        finalModifiedArgs = JSON.parse(editedArgsText);
      } catch (err) {
        setJsonError(`JSON inválido: ${err instanceof Error ? err.message : String(err)}`);
        setIsSubmitting(false);
        return;
      }
    }

    try {
      await onResolve({
        approved: true,
        modifiedArguments: finalModifiedArgs
      });
      setResolvedStatus("approved");
    } finally {
      setIsSubmitting(false);
    }
  }, [isEditing, editedArgsText, isSubmitting, onResolve]);

  const handleReject = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onResolve({
        approved: false,
        reason: rejectionReason.trim() || "Acción rechazada por el operador humano"
      });
      setResolvedStatus("rejected");
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, onResolve, rejectionReason]);

  // Si ya fue resuelta, renderizar estado resuelto compacto
  if (resolvedStatus) {
    const wasApproved = resolvedStatus === "approved";
    const surfaceClass = wasApproved
      ? "border-success/30 bg-success/10 text-success"
      : "border-hairline bg-raised text-faint";
    return (
      <div
        className={`my-3 rounded-[var(--radius-card)] border p-3 text-xs flex items-center justify-between ${surfaceClass}`}
      >
        <div className="flex items-center gap-2">
          {wasApproved ? (
            <Check size={16} className="text-success shrink-0" weight="bold" />
          ) : (
            <X size={16} className="text-error shrink-0" weight="bold" />
          )}
          <span>
            {wasApproved ? "Acción autorizada por el usuario:" : "Acción denegada por el usuario:"}{" "}
            <strong className="font-mono text-ink">{request.toolName}</strong>
          </span>
        </div>
        <span className="font-mono text-xs text-dim">ID: {request.approvalId.slice(0, 14)}…</span>
      </div>
    );
  }

  const cardClass = isDestructive
    ? "border-error/40 bg-error/10 text-ink"
    : "border-warning/40 bg-warning/10 text-ink";

  return (
    <div
      className={`my-3 rounded-[var(--radius-card)] border p-4 shadow-[var(--ego-elevation-l1)] transition-colors ${cardClass}`}
    >
      {/* Header con badge y metadatos */}
      <div className="flex items-center justify-between gap-2 border-b border-hairline pb-2.5 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldWarning
            size={18}
            weight="fill"
            className={isDestructive ? "text-error shrink-0" : "text-brand shrink-0"}
          />
          <div className="truncate">
            <span className="font-semibold text-xs text-ink">Autorización Requerida (HITL)</span>
            <span className="mx-1.5 text-dim">•</span>
            <span className="font-mono text-xs text-ink">{request.toolName}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Badge tone={isDestructive ? "risk" : "warn"}>{request.riskLevel}</Badge>
        </div>
      </div>

      {/* Previsualización de Acción (Comandos o Diffs) */}
      <div className="space-y-2 mb-3.5">
        {terminalCommand && (
          <div className="rounded-[var(--radius-card)] bg-paper border border-hairline p-2.5 font-mono text-xs text-success">
            <div className="flex items-center gap-1.5 text-xs text-dim mb-1">
              <Terminal size={12} />
              <span>Comando a ejecutar en host:</span>
            </div>
            <div className="overflow-x-auto whitespace-pre selection:bg-success/20">
              <span className="text-dim select-none mr-2">$</span>
              <span>{terminalCommand}</span>
            </div>
          </div>
        )}

        {filePath && (
          <div className="rounded-[var(--radius-card)] bg-paper border border-hairline p-2.5 font-mono text-xs">
            <div className="flex items-center gap-1.5 text-xs text-dim mb-1">
              <FileText size={12} />
              <span>Archivo de destino:</span>
              <span className="text-ink truncate">{filePath}</span>
            </div>
            {fileContent !== null &&
              (originalContent !== null ? (
                <div className="mt-2">
                  <DiffView
                    props={{
                      id: request.approvalId,
                      filePath,
                      originalContent,
                      modifiedContent: fileContent,
                      viewMode: "unified",
                    }}
                  />
                </div>
              ) : (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-[var(--radius-card)] bg-raised p-2 text-xs text-ink border border-hairline whitespace-pre-wrap font-mono">
                  {fileContent}
                </div>
              ))}
          </div>
        )}

        {!terminalCommand && !filePath && (
          <div className="rounded-[var(--radius-card)] bg-paper border border-hairline p-2.5 font-mono text-xs">
            <div className="text-xs text-dim mb-1">Parámetros solicitados:</div>
            <pre className="max-h-40 overflow-y-auto text-xs text-ink whitespace-pre-wrap">
              {JSON.stringify(request.arguments, null, 2)}
            </pre>
          </div>
        )}

        {/* Editor de Parámetros Inline */}
        {isEditing && (
          <div className="mt-2 space-y-1">
            <label htmlFor="approval-args-editor" className="block text-xs text-faint font-medium">
              Editar parámetros JSON antes de autorizar:
            </label>
            <Textarea
              id="approval-args-editor"
              value={editedArgsText}
              onChange={(e) => setEditedArgsText(e.target.value)}
              rows={4}
              className="font-mono"
            />
            {jsonError && <p className="text-xs text-error font-mono">{jsonError}</p>}
          </div>
        )}

        {/* Input de motivo de rechazo opcional */}
        {showRejectInput && (
          <div className="mt-2">
            <label htmlFor="approval-reject-reason" className="sr-only">
              Motivo del rechazo (opcional)
            </label>
            <Input
              id="approval-reject-reason"
              type="text"
              placeholder="Motivo del rechazo (opcional)…"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          </div>
        )}

        {/* Error de identidad R10b (visible siempre, no solo en edición) */}
        {digestError && (
          <p className="mt-2 text-xs text-error font-mono">{digestError}</p>
        )}
      </div>

      {/* Footer con controles y ActionIdentity */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-hairline">
        <div className="flex items-center gap-1.5 text-xs font-mono text-dim truncate">
          <Clock size={11} className="shrink-0" />
          <span className="truncate" title={request.action.inputDigest}>
            Digest: {request.action.inputDigest.slice(0, 10)}…
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Los tres controles HITL declaran explícitamente el target táctil
              de 44 px (`min-h-[44px]`): es el contrato que verifica la puerta
              STAB-13 (`test/Stab13UxMotion.test.tsx`). El icono va por la prop
              `icon` del kit (hermano del `<span>` de contenido), así el
              `gap-1.5` del base separa icono y etiqueta sin selectores
              arbitrarios sobre el DOM interno del kit. */}
          <Button
            size="md"
            variant="secondary"
            icon={<PencilSimple size={12} />}
            onClick={() => setIsEditing(!isEditing)}
            className="min-h-[44px] whitespace-nowrap"
          >
            {isEditing ? "Cancelar edición" : "Editar"}
          </Button>

          {!showRejectInput ? (
            <Button
              size="md"
              variant="danger"
              icon={<X size={12} weight="bold" />}
              onClick={() => setShowRejectInput(true)}
              className="min-h-[44px] whitespace-nowrap"
            >
              Rechazar
            </Button>
          ) : (
            <Button
              size="md"
              variant="danger"
              icon={<X size={12} weight="bold" />}
              disabled={isSubmitting}
              onClick={handleReject}
              className="min-h-[44px] whitespace-nowrap"
            >
              Confirmar Rechazo
            </Button>
          )}

          <Button
            size="md"
            variant="accent"
            icon={
              isSubmitting ? (
                <ArrowCounterClockwise size={12} className="animate-spin" />
              ) : (
                <Check size={12} weight="bold" />
              )
            }
            disabled={isSubmitting}
            onClick={handleApprove}
            className="min-h-[44px] whitespace-nowrap"
          >
            Aprobar
          </Button>
        </div>
      </div>
    </div>
  );
}
