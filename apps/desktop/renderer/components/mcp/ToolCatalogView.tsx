import { useState, useMemo } from "react";
import {
  MagnifyingGlass,
  ShieldCheck,
  Warning,
  Flame,
  Wrench,
} from "@phosphor-icons/react";
import type { ToolSummaryInfo } from "../../lib/ego";

interface ToolCatalogViewProps {
  tools: ToolSummaryInfo[];
  isLoading: boolean;
}

export function ToolCatalogView({ tools, isLoading }: ToolCatalogViewProps) {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | "safe" | "sensitive" | "destructive">("all");

  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
      const matchQuery =
        search === "" ||
        tool.name.toLowerCase().includes(search.toLowerCase()) ||
        tool.description.toLowerCase().includes(search.toLowerCase()) ||
        (tool.mcpServerId && tool.mcpServerId.toLowerCase().includes(search.toLowerCase()));

      const matchRisk = riskFilter === "all" || tool.riskLevel === riskFilter;

      return matchQuery && matchRisk;
    });
  }, [tools, search, riskFilter]);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header y Filtros */}
      <div className="flex flex-col gap-2 pb-2 border-b border-hairline">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">Marketplace & Catálogo de Herramientas</h2>
            <p className="text-[11px] text-faint">
              Herramientas registradas en el Tool Registry de Ego disponibles para el Model Router y Sub-Egos.
            </p>
          </div>
          <span className="font-mono text-xs text-dim bg-raised px-2 py-0.5 rounded border border-hairline">
            {tools.length} disponibles
          </span>
        </div>

        {/* Barra de Búsqueda y Botones de Filtro */}
        <div className="flex items-center gap-2 pt-1">
          <div className="relative flex-1">
            <MagnifyingGlass size={14} className="absolute left-2.5 top-2.5 text-dim" />
            <input
              type="text"
              placeholder="Buscar por nombre, descripción o servidor MCP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded border border-hairline bg-paper pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-dim/60 focus:border-ink/50 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center rounded border border-hairline bg-paper p-0.5 text-xs">
            <button
              onClick={() => setRiskFilter("all")}
              className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                riskFilter === "all" ? "bg-raised text-ink font-medium" : "text-dim hover:text-ink"
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setRiskFilter("safe")}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${
                riskFilter === "safe" ? "bg-emerald-950/60 text-emerald-300 font-medium" : "text-dim hover:text-ink"
              }`}
            >
              <ShieldCheck size={13} className="text-emerald-400" />
              <span>Seguras</span>
            </button>
            <button
              onClick={() => setRiskFilter("sensitive")}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${
                riskFilter === "sensitive" ? "bg-amber-950/60 text-amber-300 font-medium" : "text-dim hover:text-ink"
              }`}
            >
              <Warning size={13} className="text-amber-400" />
              <span>Sensibles</span>
            </button>
            <button
              onClick={() => setRiskFilter("destructive")}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${
                riskFilter === "destructive" ? "bg-rose-950/60 text-rose-300 font-medium" : "text-dim hover:text-ink"
              }`}
            >
              <Flame size={13} className="text-rose-400" />
              <span>Destructivas</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Herramientas */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {isLoading && tools.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-dim">
            Cargando catálogo de herramientas...
          </div>
        ) : filteredTools.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 border border-dashed border-hairline rounded-lg p-6 text-center space-y-2">
            <Wrench size={26} className="text-dim" />
            <span className="text-xs font-medium text-ink">No se encontraron herramientas</span>
            <p className="text-[11px] text-faint max-w-sm">
              Ninguna herramienta coincide con el término "{search}" y el filtro de riesgo seleccionado.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {filteredTools.map((tool) => (
              <div
                key={tool.name}
                className="flex flex-col justify-between rounded-lg border border-hairline bg-paper/50 p-3 hover:border-ink/20 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold text-ink">{tool.name}</span>
                    </div>
                    {/* Badge de Riesgo */}
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        tool.riskLevel === "safe"
                          ? "bg-emerald-950/60 text-emerald-300 border border-emerald-900/40"
                          : tool.riskLevel === "sensitive"
                          ? "bg-amber-950/60 text-amber-300 border border-amber-900/40"
                          : "bg-rose-950/60 text-rose-300 border border-rose-900/40"
                      }`}
                    >
                      {tool.riskLevel === "safe" && <ShieldCheck size={11} />}
                      {tool.riskLevel === "sensitive" && <Warning size={11} />}
                      {tool.riskLevel === "destructive" && <Flame size={11} />}
                      <span>{tool.riskLevel.toUpperCase()}</span>
                    </span>
                  </div>

                  <p className="text-[11px] text-faint mt-1.5 line-clamp-2 leading-relaxed">
                    {tool.description}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-hairline/60 flex items-center justify-between text-[10px] text-dim font-mono">
                  <div className="flex items-center gap-2">
                    <span className="bg-raised px-1.5 py-0.2 rounded">{tool.category}</span>
                    {tool.mcpServerId && (
                      <span className="text-emerald-400">mcp: {tool.mcpServerId}</span>
                    )}
                  </div>
                  {tool.requiresApproval && (
                    <span className="text-amber-400 font-semibold flex items-center gap-1">
                      <Warning size={10} /> HITL
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
