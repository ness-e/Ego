import React from "react";
import type { CanvasComponentType } from "@ego/ui-runtime";
import { TableView } from "./TableView.js";
import { CardView } from "./CardView.js";
import { FormView } from "./FormView.js";
import { ChartView } from "./ChartView.js";
import { BoardView } from "./BoardView.js";
import { EditorView } from "./EditorView.js";
import { DiffView } from "./DiffView.js";
import { TerminalView } from "./TerminalView.js";

export type ComponentRendererProps = {
  props: any;
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void;
  onSubmit?: (formId: string, actionId: string, values: Record<string, unknown>) => void;
};

export type ComponentRendererFn = React.FC<ComponentRendererProps>;

export const ComponentRegistry: Record<CanvasComponentType, ComponentRendererFn> = {
  table: TableView as ComponentRendererFn,
  card: CardView as ComponentRendererFn,
  form: FormView as ComponentRendererFn,
  chart: ChartView as ComponentRendererFn,
  board: BoardView as ComponentRendererFn,
  editor: EditorView as ComponentRendererFn,
  diff: DiffView as ComponentRendererFn,
  terminal: TerminalView as ComponentRendererFn,
};

export function getComponentRenderer(type: CanvasComponentType): ComponentRendererFn | null {
  return ComponentRegistry[type] || null;
}
