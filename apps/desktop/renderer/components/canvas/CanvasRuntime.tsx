import React, { useState, useEffect } from "react";
import type { CanvasComponentManifest, CanvasBridge } from "@ego/ui-runtime";
import { ComponentRenderer } from "./ComponentRenderer";
import { SelectionToolbar } from "./SelectionToolbar";
import { SquaresFour, Sparkle } from "@phosphor-icons/react";
import { useCanvasBridge } from "../../hooks/useCanvasBridge";
import { getSharedCanvasBridge } from "../../lib/canvasBridgeSingleton.js";
import { ego } from "../../lib/ego";
import { Button } from "../ui-kit/Button.js";

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

  const FILTERS: ReadonlyArray<{ id: typeof activeFilter; label: string }> = [
    { id: "all", label: "Todo" },
    { id: "boards", label: "Tableros" },
    { id: "code", label: "Código & Diffs" },
    { id: "metrics", label: "Métricas" },
  ];

  return (
    <div className="flex h-full w-full flex-col gap-4 select-text">
      {/* Barra de control del Canvas */}
      <div className="flex shrink-0 items-center justify-between border-b border-hairline pb-2">
        <div className="flex items-center gap-2">
          <SquaresFour size={16} className="text-ink" />
          <span className="text-xs font-semibold text-ink">Superficie Generativa</span>
          <span className="text-xs text-faint">· Proyecto: {projectId}</span>
        </div>

        {/* Filtros de vista */}
        <div className="flex items-center gap-1 rounded-[var(--radius-card)] border border-hairline bg-panel p-0.5 text-xs">
          {FILTERS.map((f) => (
            <Button
              key={f.id}
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={activeFilter === f.id}
              onClick={() => setActiveFilter(f.id)}
              className={
                activeFilter === f.id ? "bg-raised font-semibold text-ink" : "text-dim"
              }
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Grid de componentes generativos */}
      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {filteredComponents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-hairline p-8 text-center text-dim">
            <Sparkle size={24} className="mb-2 text-dim" />
            <h4 className="text-sm font-medium text-ink">Espacio de trabajo vacío</h4>
            <p className="mt-1 max-w-xs text-xs text-faint">
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
