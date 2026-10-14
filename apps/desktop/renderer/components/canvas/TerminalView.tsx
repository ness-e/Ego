import React, { useRef, useEffect } from "react";
import type { TerminalProps } from "@ego/ui-runtime";
import { Terminal, Circle } from "@phosphor-icons/react";

interface TerminalViewProps {
  props: TerminalProps;
}

export const TerminalView: React.FC<TerminalViewProps> = ({ props }) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [props.lines.length]);

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
    </div>
  );
};
