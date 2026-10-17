import React, { useState } from "react";
import { Wrench, CheckCircle, XCircle, SpinnerGap, CaretRight } from "@phosphor-icons/react";

export interface ToolExecutionEvent {
  kind?: "tool_start" | "tool_end" | "tool_error" | "tool_call" | "tool_result";
  toolName: string;
  callId?: string;
  detail?: string;
  arguments?: unknown;
  output?: unknown;
  error?: unknown;
  success?: boolean;
  durationMs?: number;
  seq?: number;
}

export interface ToolExecutionCardProps {
  event: ToolExecutionEvent;
}

/**
 * ToolExecutionCard — Tarjeta compacta interactiva para eventos de ejecución de herramientas.
 * Muestra el estado (Ejecutando..., Completada, Error), nombre de la herramienta, duración
 * y un acordeón para inspeccionar parámetros y salida JSON.
 */
export const ToolExecutionCard: React.FC<ToolExecutionCardProps> = ({ event }) => {
  const [isOpen, setIsOpen] = useState(false);

  const isRunning = event.kind === "tool_call" || event.kind === "tool_start";
  const isError =
    event.kind === "tool_error" ||
    event.success === false ||
    Boolean(event.error) ||
    (event.kind === "tool_result" && event.detail !== "ok" && !event.success && Boolean(event.detail));

  const statusLabel = isRunning ? "Ejecutando..." : isError ? "Error" : "Completada";

  const hasDetails =
    event.arguments !== undefined ||
    event.output !== undefined ||
    event.error !== undefined ||
    (event.detail && event.detail !== "ok" && event.detail !== "falló");

  return (
    <div className="my-1.5 rounded-lg border border-hairline bg-panel/80 text-xs overflow-hidden transition-colors hover:border-dim/60 shadow-sm">
      <div
        onClick={() => hasDetails && setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between px-3 py-2 select-none ${
          hasDetails ? "cursor-pointer hover:bg-raised/50" : ""
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-raised border border-hairline text-faint">
            <Wrench size={13} className="text-brand" />
          </div>

          <div className="flex items-center gap-2 min-w-0 font-mono">
            <span className="font-semibold text-ink text-[12px] truncate">{event.toolName}</span>
            {event.durationMs !== undefined && (
              <span className="text-[10px] text-faint">({event.durationMs}ms)</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium font-mono ${
              isRunning
                ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                : isError
                ? "bg-rose-500/15 text-rose-500 border border-rose-500/30"
                : "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
            }`}
          >
            {isRunning ? (
              <SpinnerGap size={11} className="animate-spin" />
            ) : isError ? (
              <XCircle size={11} />
            ) : (
              <CheckCircle size={11} />
            )}
            <span>{statusLabel}</span>
          </span>

          {hasDetails && (
            <CaretRight
              size={12}
              className={`text-faint transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
            />
          )}
        </div>
      </div>

      {isOpen && hasDetails && (
        <div className="border-t border-hairline bg-raised/30 p-2.5 space-y-2 text-[11px] font-mono">
          {event.arguments !== undefined && (
            <div>
              <div className="text-[10px] uppercase font-semibold text-faint mb-1">Argumentos</div>
              <pre className="max-h-36 overflow-auto rounded bg-panel p-2 text-ink border border-hairline leading-relaxed">
                {typeof event.arguments === "string"
                  ? event.arguments
                  : JSON.stringify(event.arguments, null, 2)}
              </pre>
            </div>
          )}

          {event.output !== undefined && (
            <div>
              <div className="text-[10px] uppercase font-semibold text-faint mb-1">Resultado</div>
              <pre className="max-h-36 overflow-auto rounded bg-panel p-2 text-ink border border-hairline leading-relaxed">
                {typeof event.output === "string"
                  ? event.output
                  : JSON.stringify(event.output, null, 2)}
              </pre>
            </div>
          )}

          {event.error !== undefined && (
            <div>
              <div className="text-[10px] uppercase font-semibold text-rose-400 mb-1">Error</div>
              <pre className="max-h-36 overflow-auto rounded bg-rose-950/20 p-2 text-rose-300 border border-rose-900/30 leading-relaxed">
                {typeof event.error === "string"
                  ? event.error
                  : JSON.stringify(event.error, null, 2)}
              </pre>
            </div>
          )}

          {event.detail && !event.arguments && !event.output && (
            <div>
              <div className="text-[10px] uppercase font-semibold text-faint mb-1">Detalle</div>
              <div className="rounded bg-panel p-2 text-dim border border-hairline">
                {event.detail}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
