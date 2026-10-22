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
    <div className="my-1.5 rounded-[var(--radius-card)] border border-hairline bg-panel text-xs overflow-hidden transition-colors hover:border-strong shadow-[var(--ego-elevation-l1)]">
      <div
        onClick={() => hasDetails && setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between px-3.5 py-2 select-none ${
          hasDetails ? "cursor-pointer hover:bg-raised" : ""
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-raised border border-hairline text-faint">
            <Wrench size={13} className="text-brand" />
          </div>

          <div className="flex items-center gap-2 min-w-0 font-mono">
            <span className="font-semibold text-ink text-sm truncate">{event.toolName}</span>
            {event.durationMs !== undefined && (
              <span className="text-xs text-faint font-normal">({event.durationMs}ms)</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium font-mono ${
              isRunning
                ? "bg-warning/10 text-warning border border-warning/30"
                : isError
                ? "bg-error/10 text-error border border-error/30"
                : "bg-success/10 text-success border border-success/30"
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
              className={`text-dim transition-transform duration-[var(--motion-duration-ui)] ${isOpen ? "rotate-90" : ""}`}
            />
          )}
        </div>
      </div>

      {isOpen && hasDetails && (
        <div className="border-t border-hairline bg-paper p-3 space-y-2.5 text-xs font-mono">
          {event.arguments !== undefined && (
            <div>
              <div className="text-xs uppercase font-semibold text-faint mb-1 tracking-wider">Argumentos</div>
              <pre className="max-h-36 overflow-auto rounded-[var(--radius-card)] bg-panel p-2.5 text-ink border border-hairline leading-relaxed">
                {typeof event.arguments === "string"
                  ? event.arguments
                  : JSON.stringify(event.arguments, null, 2)}
              </pre>
            </div>
          )}

          {event.output !== undefined && (
            <div>
              <div className="text-xs uppercase font-semibold text-faint mb-1 tracking-wider">Resultado</div>
              <pre className="max-h-36 overflow-auto rounded-[var(--radius-card)] bg-panel p-2.5 text-ink border border-hairline leading-relaxed">
                {typeof event.output === "string"
                  ? event.output
                  : JSON.stringify(event.output, null, 2)}
              </pre>
            </div>
          )}

          {event.error !== undefined && (
            <div>
              <div className="text-xs uppercase font-semibold text-error mb-1 tracking-wider">Error</div>
              <pre className="max-h-36 overflow-auto rounded-[var(--radius-card)] bg-error/10 p-2.5 text-error border border-error/30 leading-relaxed">
                {typeof event.error === "string"
                  ? event.error
                  : JSON.stringify(event.error, null, 2)}
              </pre>
            </div>
          )}

          {event.detail && !event.arguments && !event.output && (
            <div>
              <div className="text-xs uppercase font-semibold text-faint mb-1 tracking-wider">Detalle</div>
              <div className="rounded-[var(--radius-card)] bg-panel p-2 text-faint border border-hairline">
                {event.detail}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
