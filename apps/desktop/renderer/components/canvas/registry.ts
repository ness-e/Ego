import React from "react";
import { z } from "zod";
import {
  getCanvasComponentRegistry,
  MERMAID_COMPONENT_KIND,
  MermaidComponentPropsSchema,
  prepareMermaidComponent,
} from "@ego/ui-runtime";
import { TableView } from "./TableView.js";
import { CardView } from "./CardView.js";
import { FormView } from "./FormView.js";
import { ChartView } from "./ChartView.js";
import { BoardView } from "./BoardView.js";
import { EditorView } from "./EditorView.js";
import { DiffView } from "./DiffView.js";
import { TerminalView } from "./TerminalView.js";
import { MermaidView } from "./MermaidView.js";
import { RecordView, QueryView, RelationView } from "./data/index.js";

/**
 * T06 UI-03 — props canvas inferidos desde Zod (cierra `props: any`).
 * Los records arbitrarios del Canvas se validan en la frontera del registry;
 * cada vista mantiene su tipo específico (`TableProps`, …).
 */
export const CanvasPropsSchema = z
  .record(z.string(), z.unknown())
  .refine((v) => !Array.isArray(v), {
    message: "canvas props debe ser un objeto, no un array",
  });

export type CanvasProps = z.infer<typeof CanvasPropsSchema>;

/**
 * T16 (EGO-FIND-13): modo de presentación del canvas como contrato Zod.
 * `fullscreen` (chat a pantalla completa con canvas inline) es FUTURO en P0:
 * ningún Sub-Ego ni vista lo consume todavía — ver `ux-ui.md` §Chat+Canvas.
 * Existe como contrato para que la ampliación sea tipada cuando llegue.
 */
export const CanvasViewModeSchema = z.enum(["panel", "fullscreen"]);

export type CanvasViewMode = z.infer<typeof CanvasViewModeSchema>;

export type ComponentRendererProps = {
  props: CanvasProps;
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void;
  onSubmit?: (formId: string, actionId: string, values: Record<string, unknown>) => void;
};

export type ComponentRendererFn = React.FC<ComponentRendererProps>;

/**
 * A3-T8 / EGO-FIND-47: registry de componentes del Canvas **dinámico**.
 *
 * Antes era un `Record` estático y cerrado de 11 tipos: ninguna vista
 * podía registrarse en runtime (hot-swap imposible). Ahora se usa el
 * `CanvasComponentRegistry` de `@ego/ui-runtime` (A3), que además es
 * singleton: el main y el renderer comparten el mismo registro.
 *
 * Justificación any→0: cada vista declara `props: <TipoEspecífico>` y el
 * registry expone `props: CanvasProps` (record validado por Zod). El cast
 * intermedio es de frontera y está acotado a estas líneas; el payload real
 * se valida con `CanvasPropsSchema` antes de renderizar.
 */
const registry = getCanvasComponentRegistry<ComponentRendererFn>();

// Registro de los 11 tipos built-in (una vez, al cargar el módulo).
registry.registerMany([
  { type: "table", renderer: TableView as unknown as ComponentRendererFn, options: { builtin: true } },
  { type: "card", renderer: CardView as unknown as ComponentRendererFn, options: { builtin: true } },
  { type: "form", renderer: FormView as unknown as ComponentRendererFn, options: { builtin: true } },
  { type: "chart", renderer: ChartView as unknown as ComponentRendererFn, options: { builtin: true } },
  { type: "board", renderer: BoardView as unknown as ComponentRendererFn, options: { builtin: true } },
  { type: "editor", renderer: EditorView as unknown as ComponentRendererFn, options: { builtin: true } },
  { type: "diff", renderer: DiffView as unknown as ComponentRendererFn, options: { builtin: true } },
  { type: "terminal", renderer: TerminalView as unknown as ComponentRendererFn, options: { builtin: true } },
  { type: "record_view", renderer: RecordView as unknown as ComponentRendererFn, options: { builtin: true } },
  { type: "query_view", renderer: QueryView as unknown as ComponentRendererFn, options: { builtin: true } },
  { type: "relation_view", renderer: RelationView as unknown as ComponentRendererFn, options: { builtin: true } },
  // OCLW-11 (A3): tipo de componente `mermaid`. El paquete registra la
  // PREPARACIÓN (validación + saneado anti-XSS + re-validación); el host
  // aporta la vista React bajo el mismo `componentKind`.
  {
    type: MERMAID_COMPONENT_KIND,
    renderer: MermaidView as unknown as ComponentRendererFn,
    options: {
      builtin: true,
      description: "Diagrama Mermaid (fuente saneado)",
      propsSchema: MermaidComponentPropsSchema as unknown as z.ZodType<unknown>,
      prepare: prepareMermaidComponent,
    },
  },
]);

/** API equivalente a la anterior (`ComponentRenderer.tsx` la usa). */
export function getComponentRenderer(type: string): ComponentRendererFn | null {
  return registry.resolve(type) ?? null;
}

/**
 * Vista de solo-lectura del registry dinámico, para los consumidores que
 * necesitan enumerar los tipos registrados (`typed-registry.test.ts`,
 * `data-views.test.ts`, `workbench-cfg13.test.tsx`).
 */
export const ComponentRegistry: Readonly<Record<string, ComponentRendererFn>> =
  Object.freeze(
    Object.fromEntries(
      [
        "table",
        "card",
        "form",
        "chart",
        "board",
        "editor",
        "diff",
        "terminal",
        "record_view",
        "query_view",
        "relation_view",
      ].map((type) => {
        const renderer = registry.resolve(type);
        return renderer ? [type, renderer] : [type, null];
      })
    ) as Record<string, ComponentRendererFn>
  );

/**
 * Hot-swap: un componente de terceros puede registrarse en runtime.
 * A3-T8 / EGO-FIND-47 — antes imposible con el `Record` estático.
 */
export function registerCanvasComponent(
  type: string,
  renderer: ComponentRendererFn,
  options?: { description?: string }
): void {
  registry.register(type, renderer, options);
}
