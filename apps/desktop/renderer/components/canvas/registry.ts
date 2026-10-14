import React from "react";
import { z } from "zod";
import type { CanvasComponentType } from "@ego/ui-runtime";
import { TableView } from "./TableView.js";
import { CardView } from "./CardView.js";
import { FormView } from "./FormView.js";
import { ChartView } from "./ChartView.js";
import { BoardView } from "./BoardView.js";
import { EditorView } from "./EditorView.js";
import { DiffView } from "./DiffView.js";
import { TerminalView } from "./TerminalView.js";
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

export type ComponentRendererProps = {
  props: CanvasProps;
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void;
  onSubmit?: (formId: string, actionId: string, values: Record<string, unknown>) => void;
};

export type ComponentRendererFn = React.FC<ComponentRendererProps>;

// Justificación any→0: cada vista declara `props: <TipoEspecífico>` y el
// registry expone `props: CanvasProps` (record validado por Zod). El cast
// intermedio es de frontera y está acotado a estas 11 líneas; el payload
// real se valida con `CanvasPropsSchema` antes de renderizar.
export const ComponentRegistry: Record<CanvasComponentType, ComponentRendererFn> = {
  table: TableView as unknown as ComponentRendererFn,
  card: CardView as unknown as ComponentRendererFn,
  form: FormView as unknown as ComponentRendererFn,
  chart: ChartView as unknown as ComponentRendererFn,
  board: BoardView as unknown as ComponentRendererFn,
  editor: EditorView as unknown as ComponentRendererFn,
  diff: DiffView as unknown as ComponentRendererFn,
  terminal: TerminalView as unknown as ComponentRendererFn,
  record_view: RecordView as unknown as ComponentRendererFn,
  query_view: QueryView as unknown as ComponentRendererFn,
  relation_view: RelationView as unknown as ComponentRendererFn,
};

export function getComponentRenderer(type: CanvasComponentType): ComponentRendererFn | null {
  return ComponentRegistry[type] || null;
}
