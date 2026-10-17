import React, { useState, useEffect } from "react";
import type { CanvasComponentManifest, CanvasBridge } from "@ego/ui-runtime";
import { ComponentRenderer } from "./ComponentRenderer";
import { SelectionToolbar } from "./SelectionToolbar";
import { SquaresFour, Sparkle } from "@phosphor-icons/react";
import { useCanvasBridge } from "../../hooks/useCanvasBridge";
import { getSharedCanvasBridge } from "../../lib/canvasBridgeSingleton.js";
import { ego } from "../../lib/ego";

export interface CanvasRuntimeProps {
  projectId?: string;
  initialComponents?: CanvasComponentManifest[];
  selectedComponentId?: string | null;
  onSelectComponent?: (id: string) => void;
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void;
  bridge?: CanvasBridge;
}

/**
 * T04: sin mocks — el contenido inicial llega por `initialComponents` explícitos
 * o por restore desde VantaDB (`projects/<id>/workspace/canvas` vía `useCanvasBridge`).
 * Sin ambos, el canvas arranca vacío (estado honesto, ver abajo).
 */
export const CanvasRuntime: React.FC<CanvasRuntimeProps> = ({
  projectId = "default",
  initialComponents = [],
  selectedComponentId: externalSelectedId,
  onSelectComponent,
  onAction,
  bridge: propBridge,
}) => {
  const bridgeHook = useCanvasBridge({ initialComponents, projectId });
  const activeBridge = propBridge || bridgeHook.bridge || getSharedCanvasBridge(initialComponents);

  const {
    components,
    selectedId: bridgeSelectedId,
    focusComponent,
    dispatchAction,
  } = bridgeHook;

  useEffect(() => {
    const unsub = ego().onEvent?.((rawEvent: unknown) => {
      const event = rawEvent as { type?: string; payload?: unknown };
      if (event?.type === "canvas.component_injected" && event.payload) {
        activeBridge.injectComponent(event.payload as CanvasComponentManifest);
      }
    });
    return () => {
      unsub?.();
    };
  }, [activeBridge]);

  const [activeFilter, setActiveFilter] = useState<"all" | "boards" | "code" | "metrics">("all");

  const selectedId = externalSelectedId !== undefined ? externalSelectedId : bridgeSelectedId;

  const handleSelect = (id: string) => {
    focusComponent(id);
    onSelectComponent?.(id);
  };

  /**
   * T14: además del bridge local, reenvía la acción al backend vía el gateway
   * `memory` (namespace de eventos del workspace). Fire-and-forget honesto:
   * si no hay bridge, la acción local ya se aplicó y nada se pierde.
   */
  const forwardActionToBackend = (
    componentId: string,
    actionId: string,
    payload?: Record<string, unknown>
  ) => {
    void ego()
      .memory("put", [
        {
          namespace: `projects/${projectId}/workspace/canvas-events`,
          key: `${componentId}:${actionId}:${Date.now()}`,
          payload: { componentId, actionId, payload: payload ?? {} },
        },
      ])
      .catch(() => {});
  };

  const handleAction = (actionId: string, payload?: Record<string, unknown>) => {
    if (selectedId) {
      dispatchAction(selectedId, actionId, payload);
      forwardActionToBackend(selectedId, actionId, payload);
    }
    onAction?.(actionId, payload);
  };

  // T08: los forms Canvas hacen onSubmit a IPC vía `dispatchAction`
  // (antes `ComponentRenderer` no recibía `onSubmit` y el submit
  // moría en local). Viaja estructurado al bridge, no solo string plano.
  const handleFormSubmit = (formId: string, actionId: string, values: Record<string, unknown>) => {
    dispatchAction(formId, actionId, values);
    forwardActionToBackend(formId, actionId, values);
    onAction?.(actionId, { formId, ...values });
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
            <Sparkle size={24} className="text-dim mb-2" />
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
              onSubmit={handleFormSubmit}
            />
          ))
        )}
      </div>

      {/* Barra de herramientas flotante ante selecciones de texto en Canvas (CANV-04) */}
      <SelectionToolbar />
    </div>
  );
};
