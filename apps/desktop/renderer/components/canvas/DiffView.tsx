import React, { useState, useMemo } from "react";
import type { DiffProps } from "@ego/ui-runtime";
import { GitDiff, Columns, Rows } from "@phosphor-icons/react";

interface DiffViewProps {
  props: DiffProps;
}

export const DiffView: React.FC<DiffViewProps> = ({ props }) => {
  const [viewMode, setViewMode] = useState<"split" | "unified">(props.viewMode || "split");

  const origLines = useMemo(() => props.originalContent.split("\n"), [props.originalContent]);
  const modLines = useMemo(() => props.modifiedContent.split("\n"), [props.modifiedContent]);

  // Cálculo básico de cambios por línea
  const maxLineCount = Math.max(origLines.length, modLines.length);

  return (
    <div className="rounded-xl border border-hairline bg-panel shadow-xs overflow-hidden select-text">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-raised/80 border-b border-hairline text-xs">
        <div className="flex items-center gap-2">
          <GitDiff size={14} className="text-amber-400" />
          <span className="font-mono text-ink font-semibold">{props.filePath}</span>
          <div className="flex items-center gap-1 font-mono text-[10px]">
            <span className="text-emerald-400">
              +{props.additionsCount ?? modLines.length}
            </span>
            <span className="text-rose-400">
              -{props.deletionsCount ?? origLines.length}
            </span>
          </div>
        </div>

        {/* Switch split / unified */}
        <div className="flex items-center gap-1 bg-panel border border-hairline rounded p-0.5">
          <button
            onClick={() => setViewMode("split")}
            className={`p-1 rounded text-xs ${
              viewMode === "split" ? "bg-raised text-ink" : "text-dim hover:text-ink"
            }`}
            title="Vista Dividida"
          >
            <Columns size={12} />
          </button>
          <button
            onClick={() => setViewMode("unified")}
            className={`p-1 rounded text-xs ${
              viewMode === "unified" ? "bg-raised text-ink" : "text-dim hover:text-ink"
            }`}
            title="Vista Unificada"
          >
            <Rows size={12} />
          </button>
        </div>
      </div>

      {/* Diff content */}
      <div className="p-2 bg-zinc-950 overflow-x-auto max-h-[420px] font-mono text-[11px] leading-relaxed">
        {viewMode === "split" ? (
          <div className="grid grid-cols-2 divide-x divide-zinc-800">
            {/* Lado Original */}
            <div className="overflow-x-auto pr-2">
              <div className="text-[10px] text-zinc-500 font-bold uppercase pb-1 mb-1 border-b border-zinc-900">
                Original
              </div>
              {origLines.map((line, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 ${
                    idx < modLines.length && line !== modLines[idx]
                      ? "bg-rose-950/40 text-rose-300"
                      : "text-zinc-400"
                  }`}
                >
                  <span className="w-6 text-right text-zinc-600 select-none text-[10px]">
                    {idx + 1}
                  </span>
                  <span className="whitespace-pre">{line || " "}</span>
                </div>
              ))}
            </div>

            {/* Lado Modificado */}
            <div className="overflow-x-auto pl-2">
              <div className="text-[10px] text-zinc-500 font-bold uppercase pb-1 mb-1 border-b border-zinc-900">
                Modificado
              </div>
              {modLines.map((line, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 ${
                    idx < origLines.length && line !== origLines[idx]
                      ? "bg-emerald-950/40 text-emerald-300"
                      : "text-zinc-300"
                  }`}
                >
                  <span className="w-6 text-right text-zinc-600 select-none text-[10px]">
                    {idx + 1}
                  </span>
                  <span className="whitespace-pre">{line || " "}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {Array.from({ length: maxLineCount }).map((_, idx) => {
              const orig = origLines[idx];
              const mod = modLines[idx];
              const isDifferent = orig !== mod;

              if (isDifferent) {
                return (
                  <React.Fragment key={idx}>
                    {orig !== undefined && (
                      <div className="flex items-start gap-2 bg-rose-950/40 text-rose-300 px-1">
                        <span className="w-4 text-center select-none text-rose-500 font-bold">-</span>
                        <span className="w-6 text-right text-zinc-600 select-none text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="whitespace-pre">{orig || " "}</span>
                      </div>
                    )}
                    {mod !== undefined && (
                      <div className="flex items-start gap-2 bg-emerald-950/40 text-emerald-300 px-1">
                        <span className="w-4 text-center select-none text-emerald-500 font-bold">+</span>
                        <span className="w-6 text-right text-zinc-600 select-none text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="whitespace-pre">{mod || " "}</span>
                      </div>
                    )}
                  </React.Fragment>
                );
              }

              return (
                <div key={idx} className="flex items-start gap-2 text-zinc-400 px-1">
                  <span className="w-4 text-center select-none text-zinc-700"> </span>
                  <span className="w-6 text-right text-zinc-600 select-none text-[10px]">
                    {idx + 1}
                  </span>
                  <span className="whitespace-pre">{orig || " "}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
