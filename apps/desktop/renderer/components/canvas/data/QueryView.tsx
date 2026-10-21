import React, { useState, useMemo } from "react";
import type { QueryViewProps, QueryResultItem } from "@ego/ui-runtime";
import { MagnifyingGlass, SlidersHorizontal, ChatCircleDots } from "@phosphor-icons/react";
import { useSelectionContext } from "../../../hooks/useSelectionContext.js";
import { Select } from "../../ui-kit/Select.js";
import { Badge } from "../../ui-kit/Badge.js";
import { Button } from "../../ui-kit/Button.js";

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
    <div className="rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)] select-text">
      {/* Header y controles de consulta */}
      <div className="mb-3 border-b border-hairline pb-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-ink">{props.title}</h3>
              <Badge tone="info">{filteredResults.length} resultados</Badge>
            </div>
            {props.query && (
              <p className="mt-0.5 font-mono text-xs text-faint">Consulta: "{props.query}"</p>
            )}
          </div>
        </div>

        {/* Barra de búsqueda interactiva */}
        <div className="mb-3 flex items-center gap-2">
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
              className="w-full rounded-[var(--radius-card)] border border-strong bg-raised py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-faint hover:border-dim focus:border-brand focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            />
          </div>

          <Select
            ariaLabel="Filtrar por namespace"
            value={selectedNamespace}
            onValueChange={setSelectedNamespace}
            options={[
              { value: "all", label: "Todos los Namespaces" },
              { value: "kb/docs", label: "kb/docs (Documentos)" },
              { value: "kb/facts", label: "kb/facts (Hechos)" },
              { value: "gov/audit", label: "gov/audit (Decisiones)" },
            ]}
          />
        </div>

        {/* Control deslizante de corte dinámico de similitud coseno (KHOJ-03) */}
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-hairline bg-raised px-3 py-2 text-xs">
          <div className="flex items-center gap-1.5 text-dim">
            <SlidersHorizontal size={13} className="text-brand" />
            <span className="text-xs">Umbral de Similitud Coseno (KHOJ-03):</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0.50"
              max="0.95"
              step="0.05"
              value={minScore}
              onChange={(e) => setMinScore(parseFloat(e.target.value))}
              className="w-28 cursor-pointer accent-brand"
            />
            <span className="min-w-[32px] font-mono text-xs font-semibold text-brand">
              ≥ {minScore.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Lista interactiva de resultados */}
      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {filteredResults.length === 0 ? (
          <div className="py-6 text-center text-xs text-dim">
            No hay registros que superen el umbral de similitud ({minScore.toFixed(2)}) en este espacio.
          </div>
        ) : (
          filteredResults.map((item) => (
            <div
              key={item.key}
              className="flex flex-col gap-1.5 rounded-[var(--radius-card)] border border-hairline bg-raised p-3 transition-colors hover:border-strong"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-mono">
                  <Badge tone="dim">{item.namespace}</Badge>
                  <span className="max-w-[200px] truncate font-semibold text-ink">{item.key}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-medium text-brand">
                    Score: {item.score.toFixed(3)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleAskAboutResult(item)}
                    title="Preguntar a Sub-Ego sobre este resultado"
                    aria-label={`Preguntar a Sub-Ego sobre el resultado ${item.key}`}
                    className="text-faint hover:text-brand"
                  >
                    <ChatCircleDots size={13} weight="bold" />
                  </Button>
                </div>
              </div>

              {item.headingPath && item.headingPath.length > 0 && (
                <div className="font-mono text-xs text-dim">
                  Jerarquía: {item.headingPath.join(" > ")}
                </div>
              )}

              <p className="line-clamp-3 font-sans text-xs leading-relaxed text-ink">
                {item.snippet}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
