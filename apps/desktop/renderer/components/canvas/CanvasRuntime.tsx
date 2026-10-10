import React, { useState } from "react";
import type { CanvasComponentManifest } from "@ego/ui-runtime";
import { ComponentRenderer } from "./ComponentRenderer";
import { SelectionToolbar } from "./SelectionToolbar";
import { SquaresFour, Sparkle } from "@phosphor-icons/react";

export interface CanvasRuntimeProps {
  projectId?: string;
  initialComponents?: CanvasComponentManifest[];
  selectedComponentId?: string | null;
  onSelectComponent?: (id: string) => void;
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void;
}

/**
 * Manifiestos canónicos iniciales del Dynamic Workspace (eliminando lib/mock.ts)
 */
const DEFAULT_WORKSPACE_COMPONENTS: CanvasComponentManifest[] = [
  {
    id: "comp-board-sprint",
    type: "board",
    metadata: {
      timestamp: 1728518400000,
      generatedBy: "ego.nucleus",
      why: {
        vantaSources: ["projects/default/sprint-alpha"],
        directCause: "Sprint Alpha en ejecución",
      },
    },
    props: {
      id: "board-sprint",
      title: "Tablero de Trabajo Activo — Sprint Alpha",
      columns: [
        {
          id: "col-todo",
          title: "Por Hacer",
          cards: [
            { id: "c1", title: "CANV-03: Sincronización Bidireccional", tag: "UI", status: "pendiente" },
            { id: "c2", title: "CHAR-10: Guardarropa Persistente", tag: "Character", status: "pendiente" },
          ],
        },
        {
          id: "col-doing",
          title: "En Curso",
          cards: [
            { id: "c3", title: "CANV-02: Canvas Generative Runtime", tag: "Core", status: "en progreso" },
          ],
        },
        {
          id: "col-done",
          title: "Completado",
          cards: [
            { id: "c4", title: "CANV-01: Esquemas Zod Declarativos", tag: "Schemas", status: "verificado" },
            { id: "c5", title: "CANV-11: Ego Activity Widget", tag: "HITL", status: "verificado" },
            { id: "c6", title: "CHAR-09: Morphing de Identidad", tag: "Visual", status: "verificado" },
          ],
        },
      ],
    },
  },
  {
    id: "comp-diff-review",
    type: "diff",
    metadata: {
      timestamp: 1728518400000,
      generatedBy: "ego.developer",
      why: {
        vantaSources: ["apps/desktop/renderer/src/App.tsx"],
        directCause: "Revisión de cambios antes de commit",
      },
    },
    props: {
      id: "diff-main",
      title: "Revisión de Código: apps/desktop/renderer/src/App.tsx",
      filePath: "apps/desktop/renderer/src/App.tsx",
      originalContent: `// Versión anterior con variables estáticas desconectadas\nconst [activeWidgetState] = useState("idle");\nconst [approvalPending, setApprovalPending] = useState(false);`,
      modifiedContent: `// Versión viva con Ego Activity Widget reactivo\nimport { ActivityWidget } from "../components/activity-widget/ActivityWidget";\n<ActivityWidget />`,
      viewMode: "split",
      additionsCount: 2,
      deletionsCount: 2,
    },
  },
  {
    id: "comp-chart-tokens",
    type: "chart",
    metadata: {
      timestamp: 1728518400000,
      generatedBy: "ego.nucleus",
      why: {
        vantaSources: ["projects/default/subegos/telemetry"],
        directCause: "Auditoría de cuotas de consumo por especialista",
      },
    },
    props: {
      id: "chart-tokens",
      title: "Telemetría de Consumo de Tokens (SUB-09)",
      chartType: "bar",
      xKey: "subEgo",
      yKeys: ["tokens", "limite"],
      data: [
        { subEgo: "nucleus", tokens: 1850, limite: 8000 },
        { subEgo: "dev", tokens: 3200, limite: 4000 },
        { subEgo: "copywriter", tokens: 650, limite: 4000 },
      ],
      legend: true,
    },
  },
];

import { useCanvasBridge } from "../../hooks/useCanvasBridge";

export const CanvasRuntime: React.FC<CanvasRuntimeProps> = ({
  projectId = "default",
  initialComponents = DEFAULT_WORKSPACE_COMPONENTS,
  selectedComponentId: externalSelectedId,
  onSelectComponent,
  onAction,
}) => {
  const {
    components,
    selectedId: bridgeSelectedId,
    focusComponent,
    dispatchAction,
  } = useCanvasBridge({ initialComponents });

  const [activeFilter, setActiveFilter] = useState<"all" | "boards" | "code" | "metrics">("all");

  const selectedId = externalSelectedId !== undefined ? externalSelectedId : bridgeSelectedId;

  const handleSelect = (id: string) => {
    focusComponent(id);
    onSelectComponent?.(id);
  };

  const handleAction = (actionId: string, payload?: Record<string, unknown>) => {
    if (selectedId) {
      dispatchAction(selectedId, actionId, payload);
    }
    onAction?.(actionId, payload);
  };

  const filteredComponents = components.filter((comp) => {
    if (activeFilter === "boards") return comp.type === "board";
    if (activeFilter === "code") return comp.type === "diff" || comp.type === "editor";
    if (activeFilter === "metrics") return comp.type === "chart" || comp.type === "table";
    return true;
  });

  return (
    <div className="flex flex-col h-full w-full gap-4 select-text">
      {/* Barra de control del Canvas */}
      <div className="flex items-center justify-between pb-2 border-b border-hairline shrink-0">
        <div className="flex items-center gap-2">
          <SquaresFour size={16} className="text-ink" />
          <span className="font-semibold text-xs text-ink">Superficie Generativa</span>
          <span className="text-[11px] text-faint">· Proyecto: {projectId}</span>
        </div>

        {/* Filtros de vista */}
        <div className="flex items-center gap-1 bg-panel border border-hairline rounded-lg p-0.5 text-xs">
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
              activeFilter === "all" ? "bg-raised text-ink font-semibold" : "text-dim hover:text-ink"
            }`}
          >
            Todo
          </button>
          <button
            onClick={() => setActiveFilter("boards")}
            className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
              activeFilter === "boards" ? "bg-raised text-ink font-semibold" : "text-dim hover:text-ink"
            }`}
          >
            Tableros
          </button>
          <button
            onClick={() => setActiveFilter("code")}
            className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
              activeFilter === "code" ? "bg-raised text-ink font-semibold" : "text-dim hover:text-ink"
            }`}
          >
            Código & Diffs
          </button>
          <button
            onClick={() => setActiveFilter("metrics")}
            className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
              activeFilter === "metrics" ? "bg-raised text-ink font-semibold" : "text-dim hover:text-ink"
            }`}
          >
            Métricas
          </button>
        </div>
      </div>

      {/* Grid de componentes generativos */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {filteredComponents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-dim border border-dashed border-hairline rounded-2xl p-8">
            <Sparkle size={24} className="text-zinc-600 mb-2" />
            <h4 className="font-medium text-xs text-ink">Espacio de trabajo vacío</h4>
            <p className="text-[11px] text-faint max-w-xs mt-1">
              Los Sub-Egos proyectarán tablas, diffs y artefactos estructurados aquí a medida que
              ejecuten tareas en el Chat.
            </p>
          </div>
        ) : (
          filteredComponents.map((manifest) => (
            <ComponentRenderer
              key={manifest.id}
              manifest={manifest}
              isSelected={selectedId === manifest.id}
              onSelect={handleSelect}
              onAction={handleAction}
            />
          ))
        )}
      </div>

      {/* Barra de herramientas flotante ante selecciones de texto en Canvas (CANV-04) */}
      <SelectionToolbar />
    </div>
  );
};
