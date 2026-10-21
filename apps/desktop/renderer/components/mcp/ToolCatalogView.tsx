import { useState, useMemo } from "react";
import {
  MagnifyingGlass,
  ShieldCheck,
  Warning,
  Flame,
  Wrench,
} from "@phosphor-icons/react";
import type { ToolSummaryInfo } from "../../lib/ego.js";
import { Button } from "../ui-kit/Button.js";
import { Input } from "../ui-kit/Input.js";
import { Badge } from "../ui-kit/Badge.js";

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
            <h3 className="text-sm font-semibold text-ink">Marketplace & Catálogo de Herramientas</h3>
            <p className="text-xs text-faint">
              Herramientas registradas en el Tool Registry de Ego disponibles para el Model Router y Sub-Egos.
            </p>
          </div>
          <span className="font-mono text-xs text-dim bg-raised px-2 py-0.5 rounded-md border border-hairline">
            {tools.length} disponibles
          </span>
        </div>

        {/* Barra de Búsqueda y Botones de Filtro */}
        <div className="flex items-center gap-2 pt-1">
          <div className="relative flex-1">
            <MagnifyingGlass
              size={14}
              className="pointer-events-none absolute left-2.5 top-2.5 text-dim"
              aria-hidden
            />
            <Input
              type="text"
              placeholder="Buscar por nombre, descripción o servidor MCP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="flex items-center gap-0.5 rounded-[var(--radius-card)] border border-hairline bg-panel p-0.5">
            <Button
              size="md"
              variant={riskFilter === "all" ? "secondary" : "ghost"}
              onClick={() => setRiskFilter("all")}
              aria-pressed={riskFilter === "all"}
              className="whitespace-nowrap"
            >
              Todas
            </Button>
            <Button
              size="md"
              variant={riskFilter === "safe" ? "secondary" : "ghost"}
              icon={<ShieldCheck size={13} className="text-success" />}
              onClick={() => setRiskFilter("safe")}
              aria-pressed={riskFilter === "safe"}
              className="whitespace-nowrap"
            >
              Seguras
            </Button>
            <Button
              size="md"
              variant={riskFilter === "sensitive" ? "secondary" : "ghost"}
              icon={<Warning size={13} className="text-brand" />}
              onClick={() => setRiskFilter("sensitive")}
              aria-pressed={riskFilter === "sensitive"}
              className="whitespace-nowrap"
            >
              Sensibles
            </Button>
            <Button
              size="md"
              variant={riskFilter === "destructive" ? "secondary" : "ghost"}
              icon={<Flame size={13} className="text-error" />}
              onClick={() => setRiskFilter("destructive")}
              aria-pressed={riskFilter === "destructive"}
              className="whitespace-nowrap"
            >
              Destructivas
            </Button>
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
          <div className="flex flex-col items-center justify-center h-48 border border-dashed border-hairline rounded-[var(--radius-card)] p-6 text-center space-y-2">
            <Wrench size={26} className="text-dim" />
            <span className="text-xs font-medium text-ink">No se encontraron herramientas</span>
            <p className="text-xs text-faint max-w-sm">
              Ninguna herramienta coincide con el término "{search}" y el filtro de riesgo seleccionado.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {filteredTools.map((tool) => (
              <div
                key={tool.name}
                className="flex flex-col justify-between rounded-[var(--radius-card)] border border-hairline bg-raised p-3 hover:border-strong transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold text-ink">{tool.name}</span>
                    </div>
                    {/* Badge de Riesgo (kit) */}
                    <Badge
                      tone={
                        tool.riskLevel === "safe"
                          ? "ok"
                          : tool.riskLevel === "sensitive"
                            ? "warn"
                            : "risk"
                      }
                    >
                      {tool.riskLevel === "safe" && <ShieldCheck size={11} />}
                      {tool.riskLevel === "sensitive" && <Warning size={11} />}
                      {tool.riskLevel === "destructive" && <Flame size={11} />}
                      <span>{tool.riskLevel.toUpperCase()}</span>
                    </Badge>
                  </div>

                  <p className="text-xs text-faint mt-1.5 line-clamp-2 leading-relaxed">
                    {tool.description}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-hairline flex items-center justify-between text-xs text-dim font-mono">
                  <div className="flex items-center gap-2">
                    <span className="bg-panel px-1.5 py-0.5 rounded-md">{tool.category}</span>
                    {tool.mcpServerId && (
                      <span className="text-success">mcp: {tool.mcpServerId}</span>
                    )}
                  </div>
                  {tool.requiresApproval && (
                    <span className="text-brand font-semibold flex items-center gap-1">
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
