import React, { useState, useMemo } from "react";
import type { DiffProps } from "@ego/ui-runtime";
import { GitDiff, Columns, Rows, Check, X, Copy, CheckCircle } from "@phosphor-icons/react";

interface DiffViewProps {
  props: DiffProps;
}

interface HunkBlock {
  id: number;
  startIdx: number;
  endIdx: number;
}

export const DiffView: React.FC<DiffViewProps> = ({ props }) => {
  const [viewMode, setViewMode] = useState<"split" | "unified">(props.viewMode || "split");
  const [hunkDecisions, setHunkDecisions] = useState<Record<number, "accepted" | "rejected">>({});
  const [copied, setCopied] = useState(false);

  const origLines = useMemo(() => props.originalContent.split("\n"), [props.originalContent]);
  const modLines = useMemo(() => props.modifiedContent.split("\n"), [props.modifiedContent]);

  const maxLineCount = Math.max(origLines.length, modLines.length);

  // Detección de bloques continuos de diferencias (Hunks)
  const hunks = useMemo<HunkBlock[]>(() => {
    const list: HunkBlock[] = [];
    let inHunk = false;
    let currentStart = 0;

    for (let i = 0; i < maxLineCount; i++) {
      const isDiff = origLines[i] !== modLines[i];
      if (isDiff) {
        if (!inHunk) {
          inHunk = true;
          currentStart = i;
        }
      } else {
        if (inHunk) {
          list.push({ id: list.length, startIdx: currentStart, endIdx: i - 1 });
          inHunk = false;
        }
      }
    }
    if (inHunk) {
      list.push({ id: list.length, startIdx: currentStart, endIdx: maxLineCount - 1 });
    }
    return list;
  }, [origLines, modLines, maxLineCount]);

  // Mapa de línea a ID de Hunk para renderizado contextual
  const lineToHunkId = useMemo(() => {
    const map = new Map<number, HunkBlock>();
    for (const h of hunks) {
      for (let i = h.startIdx; i <= h.endIdx; i++) {
        map.set(i, h);
      }
    }
    return map;
  }, [hunks]);

  const handleAcceptHunk = (hunkId: number) => {
    setHunkDecisions((prev) => ({ ...prev, [hunkId]: "accepted" }));
  };

  const handleRejectHunk = (hunkId: number) => {
    setHunkDecisions((prev) => ({ ...prev, [hunkId]: "rejected" }));
  };

  const handleCopyResult = async () => {
    const finalLines: string[] = [];
    for (let i = 0; i < maxLineCount; i++) {
      const hunk = lineToHunkId.get(i);
      if (hunk && hunkDecisions[hunk.id] === "rejected") {
        const o = origLines[i];
        if (typeof o === "string") finalLines.push(o);
      } else {
        const m = modLines[i];
        if (typeof m === "string") finalLines.push(m);
      }
    }
    const resultText = finalLines.join("\n");
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(resultText);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="rounded-xl border border-hairline bg-panel shadow-xs overflow-hidden select-text">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-raised/80 border-b border-hairline text-xs">
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
          {hunks.length > 0 && (
            <span className="ml-2 font-mono text-[10px] text-faint bg-raised border border-hairline rounded px-1.5 py-0.2">
              {hunks.length} {hunks.length === 1 ? "hunk" : "hunks"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Botón Copiar resultado */}
          <button
            type="button"
            onClick={handleCopyResult}
            className="flex items-center gap-1 rounded border border-hairline bg-raised px-2 py-0.5 text-[11px] text-dim hover:text-ink transition-colors cursor-pointer"
            title="Copiar resultado combinado al portapapeles"
          >
            {copied ? (
              <>
                <CheckCircle size={12} className="text-emerald-400" />
                <span className="text-emerald-400">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>Copiar resultado</span>
              </>
            )}
          </button>

          {/* Switch split / unified */}
          <div className="flex items-center gap-1 bg-panel border border-hairline rounded p-0.5">
            <button
              onClick={() => setViewMode("split")}
              className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                viewMode === "split" ? "bg-raised text-ink" : "text-dim hover:text-ink"
              }`}
              title="Vista Dividida"
            >
              <Columns size={12} />
            </button>
            <button
              onClick={() => setViewMode("unified")}
              className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                viewMode === "unified" ? "bg-raised text-ink" : "text-dim hover:text-ink"
              }`}
              title="Vista Unificada"
            >
              <Rows size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Diff content */}
      <div className="p-2 bg-paper overflow-x-auto max-h-[420px] font-mono text-[11px] leading-relaxed">
        {viewMode === "split" ? (
          <div className="grid grid-cols-2 divide-x divide-hairline">
            {/* Lado Original */}
            <div className="overflow-x-auto pr-2">
              <div className="text-[10px] text-dim font-bold uppercase pb-1 mb-1 border-b border-hairline">
                Original
              </div>
              {origLines.map((line, idx) => {
                const hunk = lineToHunkId.get(idx);
                const isHunkStart = hunk && hunk.startIdx === idx;
                const decision = hunk ? hunkDecisions[hunk.id] : undefined;

                return (
                  <React.Fragment key={idx}>
                    {isHunkStart && (
                      <div className="flex items-center justify-between bg-raised/70 border border-hairline rounded px-2 py-0.5 my-1 text-[10px] select-none">
                        <span className="text-faint font-semibold">
                          Hunk #{hunk.id + 1} (L{hunk.startIdx + 1}–L{hunk.endIdx + 1})
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleAcceptHunk(hunk.id)}
                            className={`px-1.5 py-0.2 rounded border transition-colors cursor-pointer ${
                              decision === "accepted"
                                ? "bg-emerald-950 border-emerald-500 text-emerald-300 font-bold"
                                : "border-hairline bg-panel text-dim hover:text-emerald-300"
                            }`}
                            title="Aceptar este cambio"
                          >
                            <Check size={10} className="inline mr-0.5" /> Aceptar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectHunk(hunk.id)}
                            className={`px-1.5 py-0.2 rounded border transition-colors cursor-pointer ${
                              decision === "rejected"
                                ? "bg-rose-950 border-rose-500 text-rose-300 font-bold"
                                : "border-hairline bg-panel text-dim hover:text-rose-300"
                            }`}
                            title="Rechazar este cambio y conservar original"
                          >
                            <X size={10} className="inline mr-0.5" /> Rechazar
                          </button>
                        </div>
                      </div>
                    )}
                    <div
                      className={`flex items-start gap-2 ${
                        idx < modLines.length && line !== modLines[idx]
                          ? decision === "rejected"
                            ? "bg-slate-800/40 text-slate-300 line-through opacity-70"
                            : "bg-rose-950/40 text-rose-300"
                          : "text-faint"
                      }`}
                    >
                      <span className="w-6 text-right text-dim select-none text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="whitespace-pre">{line || " "}</span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Lado Modificado */}
            <div className="overflow-x-auto pl-2">
              <div className="text-[10px] text-dim font-bold uppercase pb-1 mb-1 border-b border-hairline">
                Modificado
              </div>
              {modLines.map((line, idx) => {
                const hunk = lineToHunkId.get(idx);
                const isHunkStart = hunk && hunk.startIdx === idx;
                const decision = hunk ? hunkDecisions[hunk.id] : undefined;

                return (
                  <React.Fragment key={idx}>
                    {isHunkStart && (
                      <div className="flex items-center justify-between bg-raised/70 border border-hairline rounded px-2 py-0.5 my-1 text-[10px] select-none">
                        <span className="text-faint font-semibold">
                          Estado: {decision === "accepted" ? "Aceptado" : decision === "rejected" ? "Rechazado" : "Pendiente"}
                        </span>
                      </div>
                    )}
                    <div
                      className={`flex items-start gap-2 ${
                        idx < origLines.length && line !== origLines[idx]
                          ? decision === "accepted"
                            ? "bg-emerald-950/70 text-emerald-200 font-semibold"
                            : decision === "rejected"
                              ? "bg-slate-900/40 text-slate-400 line-through opacity-50"
                              : "bg-emerald-950/40 text-emerald-300"
                          : "text-ink"
                      }`}
                    >
                      <span className="w-6 text-right text-dim select-none text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="whitespace-pre">{line || " "}</span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {Array.from({ length: maxLineCount }).map((_, idx) => {
              const orig = origLines[idx];
              const mod = modLines[idx];
              const isDifferent = orig !== mod;
              const hunk = lineToHunkId.get(idx);
              const isHunkStart = hunk && hunk.startIdx === idx;
              const decision = hunk ? hunkDecisions[hunk.id] : undefined;

              if (isDifferent) {
                return (
                  <React.Fragment key={idx}>
                    {isHunkStart && (
                      <div className="flex items-center justify-between bg-raised/80 border border-hairline rounded px-2 py-0.5 my-1 text-[10px] select-none">
                        <span className="text-faint font-semibold">
                          Hunk #{hunk.id + 1} (L{hunk.startIdx + 1}–L{hunk.endIdx + 1})
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleAcceptHunk(hunk.id)}
                            className={`px-1.5 py-0.2 rounded border transition-colors cursor-pointer ${
                              decision === "accepted"
                                ? "bg-emerald-950 border-emerald-500 text-emerald-300 font-bold"
                                : "border-hairline bg-panel text-dim hover:text-emerald-300"
                            }`}
                          >
                            <Check size={10} className="inline mr-0.5" /> Aceptar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectHunk(hunk.id)}
                            className={`px-1.5 py-0.2 rounded border transition-colors cursor-pointer ${
                              decision === "rejected"
                                ? "bg-rose-950 border-rose-500 text-rose-300 font-bold"
                                : "border-hairline bg-panel text-dim hover:text-rose-300"
                            }`}
                          >
                            <X size={10} className="inline mr-0.5" /> Rechazar
                          </button>
                        </div>
                      </div>
                    )}
                    {orig !== undefined && (
                      <div className={`flex items-start gap-2 px-1 ${
                        decision === "rejected" ? "bg-slate-800/40 text-slate-300" : "bg-rose-950/40 text-rose-300"
                      }`}>
                        <span className="w-4 text-center select-none text-rose-500 font-bold">-</span>
                        <span className="w-6 text-right text-dim select-none text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="whitespace-pre">{orig || " "}</span>
                      </div>
                    )}
                    {mod !== undefined && (
                      <div className={`flex items-start gap-2 px-1 ${
                        decision === "accepted" ? "bg-emerald-950/70 text-emerald-200" : "bg-emerald-950/40 text-emerald-300"
                      }`}>
                        <span className="w-4 text-center select-none text-emerald-500 font-bold">+</span>
                        <span className="w-6 text-right text-dim select-none text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="whitespace-pre">{mod || " "}</span>
                      </div>
                    )}
                  </React.Fragment>
                );
              }

              return (
                <div key={idx} className="flex items-start gap-2 text-faint px-1">
                  <span className="w-4 text-center select-none text-dim"> </span>
                  <span className="w-6 text-right text-dim select-none text-[10px]">
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
