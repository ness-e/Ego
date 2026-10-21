import React from "react";
import type { CanvasComponentManifest } from "@ego/ui-runtime";
import { CanvasComponentManifestSchema } from "@ego/ui-runtime";
import { getComponentRenderer } from "./registry.js";
import { CharacterPresence } from "./CharacterPresence.js";
import { WarningCircle } from "@phosphor-icons/react";

interface ComponentRendererProps {
  manifest: CanvasComponentManifest;
  isSelected?: boolean;
  onSelect?: (componentId: string) => void;
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void;
  onSubmit?: (formId: string, actionId: string, values: Record<string, unknown>) => void;
}

export const ComponentRenderer: React.FC<ComponentRendererProps> = ({
  manifest,
  isSelected = false,
  onSelect,
  onAction,
  onSubmit,
}) => {
  // Validación de seguridad Zod (Principio Innegociable §8 / Decisión P11)
  const validation = CanvasComponentManifestSchema.safeParse(manifest);

  if (!validation.success) {
    return (
      <div className="rounded-[var(--radius-card)] border border-error/30 bg-error/10 p-4 text-xs text-error">
        <div className="mb-1.5 flex items-center gap-2 font-semibold text-error">
          <WarningCircle size={16} />
          <span>Contrato de Componente Inválido</span>
        </div>
        <p className="font-mono text-xs text-error">
          {validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" | ")}
        </p>
      </div>
    );
  }

  const validManifest = validation.data;
  const Renderer = getComponentRenderer(validManifest.type);

  if (!Renderer) {
    return (
      <div className="rounded-[var(--radius-card)] border border-hairline bg-panel p-4 font-mono text-xs text-dim shadow-[var(--ego-elevation-l1)]">
        Tipo de componente desconocido: {validManifest.type}
      </div>
    );
  }

  return (
    <div
      data-component-id={validManifest.id}
      onClick={() => onSelect?.(validManifest.id)}
      className={`group relative rounded-[var(--radius-card)] transition-colors transition-shadow ${
        isSelected ? "ring-2 ring-brand shadow-[var(--ego-elevation-l2)]" : "hover:border-strong"
      }`}
    >
      {/* Presencia contextual del Sub-Ego con avatar y botón ¿Por qué? (CANV-07 / CANV-08) */}
      <CharacterPresence metadata={validManifest.metadata} />

      {/* Renderizado del componente declarativo */}
      <Renderer
        props={validManifest.props}
        onAction={onAction}
        onSubmit={onSubmit}
      />
    </div>
  );
};
