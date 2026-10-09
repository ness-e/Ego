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
import type { PendingApprovalInfo } from "../../lib/ego";

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
 */
export function ApprovalCard({ request, onResolve }: ApprovalCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedArgsText, setEditedArgsText] = useState(() =>
    JSON.stringify(request.arguments, null, 2)
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
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

  const handleApprove = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setJsonError(null);

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
    return (
      <div
        className={`my-3 rounded-lg border p-3 text-xs flex items-center justify-between ${
          wasApproved
            ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-200"
            : "border-zinc-800 bg-zinc-900/40 text-zinc-400"
        }`}
      >
        <div className="flex items-center gap-2">
          {wasApproved ? (
            <Check size={16} className="text-emerald-400 shrink-0" weight="bold" />
          ) : (
            <X size={16} className="text-rose-400 shrink-0" weight="bold" />
          )}
          <span>
            {wasApproved ? "Acción autorizada por el usuario:" : "Acción denegada por el usuario:"}{" "}
            <strong className="font-mono text-zinc-100">{request.toolName}</strong>
          </span>
        </div>
        <span className="font-mono text-[10px] text-zinc-500">ID: {request.approvalId.slice(0, 14)}…</span>
      </div>
    );
  }

  return (
    <div
      className={`my-3 rounded-xl border p-4 shadow-lg transition-all ${
        isDestructive
          ? "border-rose-500/40 bg-[#161214] text-rose-50 shadow-rose-950/20"
          : "border-amber-500/40 bg-[#171410] text-amber-50 shadow-amber-950/20"
      }`}
    >
      {/* Header con badge y metadatos */}
      <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2.5 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldWarning
            size={18}
            weight="fill"
            className={isDestructive ? "text-rose-400 shrink-0" : "text-amber-400 shrink-0"}
          />
          <div className="truncate">
            <span className="font-semibold text-xs text-white">Autorización Requerida (HITL)</span>
            <span className="mx-1.5 text-zinc-500">•</span>
            <span className="font-mono text-[11px] text-zinc-300">{request.toolName}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${
              isDestructive
                ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                : "bg-amber-500/20 text-amber-300 border-amber-500/30"
            }`}
          >
            {request.riskLevel}
          </span>
        </div>
      </div>

      {/* Previsualización de Acción (Comandos o Diffs) */}
      <div className="space-y-2 mb-3.5">
        {terminalCommand && (
          <div className="rounded-lg bg-black/60 border border-white/10 p-2.5 font-mono text-xs text-emerald-400">
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mb-1">
              <Terminal size={12} />
              <span>Comando a ejecutar en host:</span>
            </div>
            <div className="overflow-x-auto whitespace-pre selection:bg-emerald-900">
              <span className="text-zinc-600 select-none mr-2">$</span>
              <span>{terminalCommand}</span>
            </div>
          </div>
        )}

        {filePath && (
          <div className="rounded-lg bg-black/60 border border-white/10 p-2.5 font-mono text-xs">
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mb-1">
              <FileText size={12} />
              <span>Archivo de destino:</span>
              <span className="text-zinc-300 truncate">{filePath}</span>
            </div>
            {fileContent !== null && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded bg-zinc-950/80 p-2 text-[11px] text-zinc-300 border border-white/5 whitespace-pre-wrap font-mono">
                {fileContent}
              </div>
            )}
          </div>
        )}

        {!terminalCommand && !filePath && (
          <div className="rounded-lg bg-black/60 border border-white/10 p-2.5 font-mono text-xs">
            <div className="text-[10px] text-zinc-500 mb-1">Parámetros solicitados:</div>
            <pre className="max-h-40 overflow-y-auto text-[11px] text-zinc-300 whitespace-pre-wrap">
              {JSON.stringify(request.arguments, null, 2)}
            </pre>
          </div>
        )}

        {/* Editor de Parámetros Inline */}
        {isEditing && (
          <div className="mt-2 space-y-1">
            <label className="block text-[11px] text-zinc-400 font-medium">
              Editar parámetros JSON antes de autorizar:
            </label>
            <textarea
              value={editedArgsText}
              onChange={(e) => setEditedArgsText(e.target.value)}
              rows={4}
              className="w-full rounded-md bg-zinc-950 border border-white/20 p-2 font-mono text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            {jsonError && <p className="text-[11px] text-rose-400 font-mono">{jsonError}</p>}
          </div>
        )}

        {/* Input de motivo de rechazo opcional */}
        {showRejectInput && (
          <div className="mt-2">
            <input
              type="text"
              placeholder="Motivo del rechazo (opcional)…"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full rounded-md bg-zinc-950 border border-white/20 px-2.5 py-1 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Footer con controles y ActionIdentity */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 truncate">
          <Clock size={11} className="shrink-0" />
          <span className="truncate" title={request.action.inputDigest}>
            Digest: {request.action.inputDigest.slice(0, 10)}…
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-1 rounded bg-white/5 hover:bg-white/10 px-2 py-1 text-[11px] font-medium text-zinc-300 transition-colors"
          >
            <PencilSimple size={12} />
            <span>{isEditing ? "Cancelar edición" : "Editar"}</span>
          </button>

          {!showRejectInput ? (
            <button
              type="button"
              onClick={() => setShowRejectInput(true)}
              className="flex items-center gap-1 rounded bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/20 px-2.5 py-1 text-[11px] font-semibold text-rose-300 transition-colors"
            >
              <X size={12} weight="bold" />
              <span>Rechazar</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleReject}
              className="flex items-center gap-1 rounded bg-rose-600 hover:bg-rose-500 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors disabled:opacity-50"
            >
              <X size={12} weight="bold" />
              <span>Confirmar Rechazo</span>
            </button>
          )}

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleApprove}
            className="flex items-center gap-1.5 rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-white shadow transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <ArrowCounterClockwise size={12} className="animate-spin" />
            ) : (
              <Check size={12} weight="bold" />
            )}
            <span>Aprobar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
