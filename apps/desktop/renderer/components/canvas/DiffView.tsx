import React, { useState, useMemo } from "react";
import type { DiffProps } from "@ego/ui-runtime";
import { GitDiff, Columns, Rows, Check, X, Copy, CheckCircle } from "@phosphor-icons/react";
import { Button } from "../ui-kit/Button.js";

interface DiffViewProps {
  props: DiffProps;
}

interface HunkBlock {
  id: number;
  startIdx: number;
  endIdx: number;
}

/**
 * Clases del botón de decisión de hunk. `decision` refleja el estado ya
 * guardado: el color NO sustituye al estado, sólo lo refuerza (el texto
 * "Aceptar"/"Rechazar" y el `aria-pressed` siguen siendo la señal primaria).
 */
function decisionClass(decision: "accepted" | "rejected" | undefined): string {
  if (decision === "accepted") return "border-success text-success";
  if (decision === "rejected") return "border-error text-error";
  return "text-dim hover:text-ink";
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
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-panel shadow-[var(--ego-elevation-l1)] select-text">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline bg-raised px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <GitDiff size={14} className="text-warning" />
          <span className="font-mono font-semibold text-ink">{props.filePath}</span>
          <div className="flex items-center gap-1 font-mono text-xs">
            <span className="text-success">
              +{props.additionsCount ?? modLines.length}
            </span>
            <span className="text-error">
              -{props.deletionsCount ?? origLines.length}
            </span>
          </div>
          {hunks.length > 0 && (
            <span className="ml-2 rounded-md border border-hairline bg-panel px-1.5 py-0.5 font-mono text-xs text-faint">
              {hunks.length} {hunks.length === 1 ? "hunk" : "hunks"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Botón Copiar resultado */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyResult}
            title="Copiar resultado combinado al portapapeles"
          >
            {copied ? (
              <>
                <CheckCircle size={12} className="text-success" />
                <span className="text-success">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>Copiar resultado</span>
              </>
            )}
          </Button>

          {/* Switch split / unified */}
          <div className="flex items-center gap-1 rounded-[var(--radius-card)] border border-hairline bg-panel p-0.5">
            <Button
              variant="ghost"
              size="icon"
              aria-pressed={viewMode === "split"}
              aria-label="Vista dividida"
              onClick={() => setViewMode("split")}
              className={viewMode === "split" ? "bg-raised text-ink" : "text-dim hover:text-ink"}
              title="Vista Dividida"
            >
              <Columns size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-pressed={viewMode === "unified"}
              aria-label="Vista unificada"
              onClick={() => setViewMode("unified")}
              className={viewMode === "unified" ? "bg-raised text-ink" : "text-dim hover:text-ink"}
              title="Vista Unificada"
            >
              <Rows size={14} />
            </Button>
          </div>
        </div>
      </div>

      {/* Diff content */}
      <div className="max-h-[420px] overflow-x-auto bg-paper p-2 font-mono text-xs leading-relaxed">
        {viewMode === "split" ? (
          <div className="grid grid-cols-2 divide-x divide-hairline">
            {/* Lado Original */}
            <div className="overflow-x-auto pr-2">
              <div className="mb-1 border-b border-hairline pb-1 text-xs font-bold uppercase text-dim">
                Original
              </div>
              {origLines.map((line, idx) => {
                const hunk = lineToHunkId.get(idx);
                const isHunkStart = hunk && hunk.startIdx === idx;
                const decision = hunk ? hunkDecisions[hunk.id] : undefined;

                return (
                  <React.Fragment key={idx}>
                    {isHunkStart && (
                      <div className="my-1 flex select-none items-center justify-between rounded-[var(--radius-card)] border border-hairline bg-raised px-2 py-0.5 text-xs">
                        <span className="font-semibold text-faint">
                          Hunk #{hunk.id + 1} (L{hunk.startIdx + 1}–L{hunk.endIdx + 1})
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            aria-pressed={decision === "accepted"}
                            onClick={() => handleAcceptHunk(hunk.id)}
                            className={decisionClass(decision)}
                            title="Aceptar este cambio"
                          >
                            <Check size={12} /> Aceptar
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            aria-pressed={decision === "rejected"}
                            onClick={() => handleRejectHunk(hunk.id)}
                            className={decisionClass(decision)}
                            title="Rechazar este cambio y conservar original"
                          >
                            <X size={12} /> Rechazar
                          </Button>
                        </div>
                      </div>
                    )}
                    <div
                      className={`flex items-start gap-2 ${
                        idx < modLines.length && line !== modLines[idx]
                          ? decision === "rejected"
                            ? "bg-raised text-dim line-through"
                            : "bg-error/10 text-error"
                          : "text-faint"
                      }`}
                    >
                      <span className="w-6 select-none text-right text-xs text-dim">
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
              <div className="mb-1 border-b border-hairline pb-1 text-xs font-bold uppercase text-dim">
                Modificado
              </div>
              {modLines.map((line, idx) => {
                const hunk = lineToHunkId.get(idx);
                const isHunkStart = hunk && hunk.startIdx === idx;
                const decision = hunk ? hunkDecisions[hunk.id] : undefined;

                return (
                  <React.Fragment key={idx}>
                    {isHunkStart && (
                      <div className="my-1 flex select-none items-center justify-between rounded-[var(--radius-card)] border border-hairline bg-raised px-2 py-0.5 text-xs">
                        <span className="font-semibold text-faint">
                          Estado: {decision === "accepted" ? "Aceptado" : decision === "rejected" ? "Rechazado" : "Pendiente"}
                        </span>
                      </div>
                    )}
                    <div
                      className={`flex items-start gap-2 ${
                        idx < origLines.length && line !== origLines[idx]
                          ? decision === "accepted"
                            ? "bg-success/10 font-semibold text-success"
                            : decision === "rejected"
                              ? "bg-raised text-dim line-through"
                              : "bg-success/10 text-success"
                          : "text-ink"
                      }`}
                    >
                      <span className="w-6 select-none text-right text-xs text-dim">
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
                      <div className="my-1 flex select-none items-center justify-between rounded-[var(--radius-card)] border border-hairline bg-raised px-2 py-0.5 text-xs">
                        <span className="font-semibold text-faint">
                          Hunk #{hunk.id + 1} (L{hunk.startIdx + 1}–L{hunk.endIdx + 1})
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            aria-pressed={decision === "accepted"}
                            onClick={() => handleAcceptHunk(hunk.id)}
                            className={decisionClass(decision)}
                          >
                            <Check size={12} /> Aceptar
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            aria-pressed={decision === "rejected"}
                            onClick={() => handleRejectHunk(hunk.id)}
                            className={decisionClass(decision)}
                          >
                            <X size={12} /> Rechazar
                          </Button>
                        </div>
                      </div>
                    )}
                    {orig !== undefined && (
                      <div className={`flex items-start gap-2 px-1 ${
                        decision === "rejected" ? "bg-raised text-dim" : "bg-error/10 text-error"
                      }`}>
                        <span className="w-4 select-none text-center font-bold text-error">-</span>
                        <span className="w-6 select-none text-right text-xs text-dim">
                          {idx + 1}
                        </span>
                        <span className="whitespace-pre">{orig || " "}</span>
                      </div>
                    )}
                    {mod !== undefined && (
                      <div className={`flex items-start gap-2 px-1 ${
                        decision === "accepted" ? "bg-success/10 text-success" : "bg-success/10 text-success"
                      }`}>
                        <span className="w-4 select-none text-center font-bold text-success">+</span>
                        <span className="w-6 select-none text-right text-xs text-dim">
                          {idx + 1}
                        </span>
                        <span className="whitespace-pre">{mod || " "}</span>
                      </div>
                    )}
                  </React.Fragment>
                );
              }

              return (
                <div key={idx} className="flex items-start gap-2 px-1 text-faint">
                  <span className="w-4 select-none text-center text-dim"> </span>
                  <span className="w-6 select-none text-right text-xs text-dim">
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
