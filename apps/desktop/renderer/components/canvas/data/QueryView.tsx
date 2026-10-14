import React, { useState, useMemo } from "react";
import type { QueryViewProps, QueryResultItem } from "@ego/ui-runtime";
import { MagnifyingGlass, SlidersHorizontal, ChatCircleDots } from "@phosphor-icons/react";
import { useSelectionContext } from "../../../hooks/useSelectionContext.js";

interface QueryViewComponentProps {
  props: QueryViewProps;
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void;
}

export const QueryView: React.FC<QueryViewComponentProps> = ({ props }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [minScore, setMinScore] = useState(props.minScoreFilter ?? 0.7);
  const [selectedNamespace, setSelectedNamespace] = useState(props.namespace || "all");
  const { sendSelectionToChat } = useSelectionContext();

  // Filtrado y clasificación reactiva
  const filteredResults = useMemo(() => {
    return props.results.filter((item) => {
      // Filtro por umbral coseno / score
      if (item.score < minScore) return false;

      // Filtro por namespace
      if (selectedNamespace !== "all" && item.namespace !== selectedNamespace) {
        return false;
      }

      // Filtro por término local de búsqueda si se escribe en la barra
      if (searchTerm.trim().length > 0) {
        const queryLower = searchTerm.toLowerCase();
        const matchesKey = item.key.toLowerCase().includes(queryLower);
        const matchesSnippet = item.snippet.toLowerCase().includes(queryLower);
        if (!matchesKey && !matchesSnippet) return false;
      }

      return true;
    });
  }, [props.results, minScore, selectedNamespace, searchTerm]);

  const handleAskAboutResult = (item: QueryResultItem) => {
    const text = `Analiza este resultado de memoria [${item.key}] (${item.namespace}, score: ${item.score.toFixed(2)}):\n${item.snippet}`;
    sendSelectionToChat(text);
  };

  return (
    <div className="rounded-xl border border-hairline bg-panel p-4 shadow-xs select-text">
      {/* Header y controles de consulta */}
      <div className="border-b border-hairline pb-3 mb-3">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-ink">{props.title}</h3>
              <span className="rounded-full bg-cyan-500/15 text-cyan-400 px-2 py-0.5 text-[10px] font-mono border border-cyan-500/30">
                {filteredResults.length} resultados
              </span>
            </div>
            {props.query && (
              <p className="text-xs text-dim mt-0.5 font-mono">Consulta: "{props.query}"</p>
            )}
          </div>
        </div>

        {/* Barra de búsqueda interactiva */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <MagnifyingGlass
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar por texto o identificador de clave..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-raised border border-hairline text-xs text-ink placeholder:text-dim focus:outline-hidden focus:border-cyan-500/50"
            />
          </div>

          <select
            value={selectedNamespace}
            onChange={(e) => setSelectedNamespace(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-raised border border-hairline text-xs text-ink focus:outline-hidden"
          >
            <option value="all">Todos los Namespaces</option>
            <option value="kb/docs">kb/docs (Documentos)</option>
            <option value="kb/facts">kb/facts (Hechos)</option>
            <option value="gov/audit">gov/audit (Decisiones)</option>
          </select>
        </div>

        {/* Control deslizante de corte dinámico de similitud coseno (KHOJ-03) */}
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-raised/50 border border-hairline text-xs">
          <div className="flex items-center gap-1.5 text-dim">
            <SlidersHorizontal size={13} className="text-cyan-400" />
            <span className="text-[11px]">Umbral de Similitud Coseno (KHOJ-03):</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0.50"
              max="0.95"
              step="0.05"
              value={minScore}
              onChange={(e) => setMinScore(parseFloat(e.target.value))}
              className="w-28 accent-cyan-400 cursor-pointer"
            />
            <span className="font-mono text-cyan-400 font-semibold text-[11px] min-w-[32px]">
              ≥ {minScore.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Lista interactiva de resultados */}
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {filteredResults.length === 0 ? (
          <div className="text-center py-6 text-xs text-dim">
            No hay registros que superen el umbral de similitud ({minScore.toFixed(2)}) en este espacio.
          </div>
        ) : (
          filteredResults.map((item) => (
            <div
              key={item.key}
              className="p-3 rounded-lg bg-raised/40 hover:bg-raised/70 border border-hairline transition-colors flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="px-1.5 py-0.5 rounded bg-raised text-ink border border-hairline text-[10px]">
                    {item.namespace}
                  </span>
                  <span className="font-semibold text-ink truncate max-w-[200px]">{item.key}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-cyan-400 font-medium">
                    Score: {item.score.toFixed(3)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAskAboutResult(item)}
                    title="Preguntar a Sub-Ego sobre este resultado"
                    className="p-1 rounded hover:bg-raised text-faint hover:text-cyan-300 transition-colors"
                  >
                    <ChatCircleDots size={13} weight="bold" />
                  </button>
                </div>
              </div>

              {item.headingPath && item.headingPath.length > 0 && (
                <div className="text-[10px] text-dim font-mono">
                  Jerarquía: {item.headingPath.join(" > ")}
                </div>
              )}

              <p className="text-xs text-ink/80 leading-relaxed font-sans line-clamp-3">
                {item.snippet}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
