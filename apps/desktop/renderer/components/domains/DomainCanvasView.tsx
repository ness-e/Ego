import React from "react";
import { DOMAIN_COMPONENT_KINDS } from "./views.js";
import { resolveDomainView } from "./domain-registry.js";

/**
 * T4 (VERDICT R3) — Contenedor del Canvas de dominio.
 *
 * ANTES: este componente tenía **10 ramas condicionales por dominio** (5
 * para cargar datos del backend y 5 para renderizar la vista). Añadir un
 * dominio exigía tocar el componente en 10 sitios y `componentKind` era
 * metadato muerto.
 *
 * AHORA: el componente solo resuelve. El `domainId` se traduce a su
 * `componentKind` (tabla única `DOMAIN_COMPONENT_KINDS`) y el renderer se
 * busca en el **registry dinámico** (`resolveDomainView`), que además
 * permite registrar un dominio nuevo en runtime (hot-swap) sin tocar este
 * fichero.
 */
export interface DomainCanvasViewProps {
  domainId: string;
}

export const DomainCanvasView: React.FC<DomainCanvasViewProps> = ({ domainId }) => {
  const componentKind = DOMAIN_COMPONENT_KINDS[domainId] ?? null;
  const View = componentKind ? resolveDomainView(componentKind) : null;

  if (!View) {
    return (
      <div
        role="alert"
        className="flex-1 flex flex-col h-full bg-paper text-ink p-4"
      >
        <div className="text-[11px] font-mono text-rose-300 border border-rose-500/30 bg-rose-950/30 rounded-lg px-3 py-2">
          {`Dominio «${domainId}» sin vista registrada${
            componentKind ? ` (componentKind «${componentKind}»)` : ""
          }.`}{" "}
          — sin datos inventados como sustituto.
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-paper text-ink overflow-y-auto p-4">
      <View />
    </div>
  );
};
