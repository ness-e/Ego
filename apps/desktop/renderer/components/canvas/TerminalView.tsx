import React, { useRef, useEffect, useState } from "react";
import type { TerminalProps } from "@ego/ui-runtime";
import { Terminal, Circle } from "@phosphor-icons/react";
import { ego } from "../../lib/ego";

interface TerminalViewProps {
  props: TerminalProps;
  /**
   * T14: sesión PTY viva (`ipc.terminal.*`, puente T13). Sin `sessionId` la
   * vista es solo-lectura (render legacy intacto, p. ej. manifiestos canvas).
   */
  sessionId?: string;
}

export const TerminalView: React.FC<TerminalViewProps> = ({ props, sessionId }) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [stdin, setStdin] = useState("");
  const [stdinError, setStdinError] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [props.lines.length]);

  const handleSendStdin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || stdin.length === 0) return;
    setStdinError(null);
    void ego()
      .terminal?.stdin?.({ sessionId, data: stdin.endsWith("\n") ? stdin : `${stdin}\n` })
      .then((res) => {
        if (res && typeof res === "object" && (res as { ok?: unknown }).ok) {
          setStdin("");
        } else {
          const err = (res as { error?: unknown })?.error;
          setStdinError(
            typeof err === "string" && err.length > 0
              ? err
              : "No se pudo enviar la entrada a la terminal."
          );
        }
      })
      .catch(() => {
        setStdinError("Canal terminal no disponible en el bridge.");
      });
  };

  return (
    <div className="rounded-xl border border-hairline bg-panel shadow-xs overflow-hidden select-text">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-raised/80 border-b border-hairline text-xs font-mono">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-emerald-400" />
          <span className="text-ink font-semibold">{props.title || "Terminal"}</span>
          {props.cwd && <span className="text-dim text-[11px] truncate max-w-[200px]">({props.cwd})</span>}
        </div>

        <div className="flex items-center gap-2">
          {props.isRunning ? (
            <div className="flex items-center gap-1.5 text-cyan-400 text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span>Ejecutando</span>
            </div>
          ) : props.exitCode !== undefined && props.exitCode !== null ? (
            <span
              className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                props.exitCode === 0
                  ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                  : "bg-rose-950 text-rose-300 border border-rose-500/30"
              }`}
            >
              Exit: {props.exitCode}
            </span>
          ) : null}
        </div>
      </div>

      {/* Output Console */}
      <div
        ref={scrollRef}
        className="p-3 bg-black/90 font-mono text-[11px] leading-relaxed max-h-[360px] overflow-y-auto space-y-1"
      >
        {props.lines.length === 0 ? (
          <div className="text-dim italic select-none">Sin salida de terminal</div>
        ) : (
          props.lines.map((line, idx) => {
            if (typeof line === "string") {
              return (
                <div key={idx} className="text-ink whitespace-pre-wrap break-all">
                  {line}
                </div>
              );
            }

            const isErr = line.type === "stderr" || line.type === "error";
            const isInfo = line.type === "info";

            return (
              <div
                key={idx}
                className={`flex items-start gap-2 whitespace-pre-wrap break-all ${
                  isErr ? "text-rose-400" : isInfo ? "text-cyan-400" : "text-ink"
                }`}
              >
                <Circle size={6} weight="fill" className="mt-1.5 shrink-0 opacity-60" />
                <span>{line.text}</span>
              </div>
            );
          })
        )}
      </div>

      {/* T14: entrada stdin a la sesión PTY viva. Sin sessionId no se renderiza. */}
      {sessionId && (
        <form
          onSubmit={handleSendStdin}
          className="flex items-center gap-2 border-t border-hairline bg-raised/80 px-3 py-2"
        >
          <span aria-hidden className="font-mono text-[11px] text-emerald-400">
            $
          </span>
          <input
            type="text"
            aria-label="Entrada de terminal"
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder="Escribir a la terminal viva… (Enter para enviar)"
            className="flex-1 bg-transparent font-mono text-[11px] text-ink placeholder:text-dim focus:outline-none"
          />
          <button
            type="submit"
            disabled={stdin.length === 0}
            className="rounded border border-hairline bg-panel px-2 py-0.5 font-mono text-[10px] text-dim transition-colors hover:text-ink disabled:opacity-40"
          >
            Enviar
          </button>
        </form>
      )}
      {stdinError && (
        <div role="alert" className="border-t border-rose-500/30 bg-rose-950/30 px-3 py-1.5 font-mono text-[10px] text-rose-300">
          {stdinError}
        </div>
      )}
    </div>
  );
};
