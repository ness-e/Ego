/**
 * T4 (VERDICT R3) — Registro de las vistas de dominio en el registry
 * dinámico de componentes.
 *
 * Las vistas de dominio se registran en el MISMO registry que el Canvas
 * (`getCanvasComponentRegistry()`, singleton de `@ego/ui-runtime`, migrado
 * por A3). Así `componentKind` deja de ser metadato muerto: es la clave con
 * la que se resuelve el componente, y un dominio nuevo (o un hot-swap en
 * runtime) se registra sin tocar `DomainCanvasView`.
 */
import type React from "react";
import { getCanvasComponentRegistry } from "@ego/ui-runtime";
import {
  AnalyticsTelemetryView,
  CrmPipelineView,
  EngineeringStatusView,
  KnowledgeFactsView,
  ProductBacklogView,
} from "./views.js";

/** Renderer de una vista de dominio: sin props (cada vista es autosuficiente). */
export type DomainViewComponent = React.FC;

/**
 * Las vistas se registran con el mismo tipo de renderer que usa el Canvas
 * (`ComponentRendererFn`). El cast es de frontera: el registry es agnóstico
 * de React y su genérico no expresa "componente sin props".
 */
const registry = getCanvasComponentRegistry<
  React.FC<{ props?: Record<string, unknown> }>
>();

registry.registerMany([
  {
    type: "engineering_status",
    renderer: EngineeringStatusView as unknown as React.FC<{
      props?: Record<string, unknown>;
    }>,
    options: { builtin: true, description: "Estado del workspace de ingeniería" },
  },
  {
    type: "product_backlog",
    renderer: ProductBacklogView as unknown as React.FC<{
      props?: Record<string, unknown>;
    }>,
    options: { builtin: true, description: "Backlog de producto" },
  },
  {
    type: "knowledge_facts",
    renderer: KnowledgeFactsView as unknown as React.FC<{
      props?: Record<string, unknown>;
    }>,
    options: { builtin: true, description: "Hechos y grafo de conocimiento" },
  },
  {
    type: "analytics_telemetry",
    renderer: AnalyticsTelemetryView as unknown as React.FC<{
      props?: Record<string, unknown>;
    }>,
    options: { builtin: true, description: "Telemetría y distribución de modelos" },
  },
  {
    type: "crm_pipeline",
    renderer: CrmPipelineView as unknown as React.FC<{
      props?: Record<string, unknown>;
    }>,
    options: { builtin: true, description: "Pipeline de CRM" },
  },
]);

/** Resuelve el renderer de una vista de dominio por su `componentKind`. */
export function resolveDomainView(componentKind: string): DomainViewComponent | null {
  const found = registry.resolve(componentKind);
  return (found as unknown as DomainViewComponent | undefined) ?? null;
}
