import { z } from "zod";
import type { ToolDefinition, ToolExecutionContext } from "../../types.js";

const CanvasComponentTypeSchema = z.enum([
  "table",
  "chart",
  "card",
  "diff",
  "board",
  "editor",
  "terminal",
  "form",
]);

export type CanvasRenderComponentType = z.infer<typeof CanvasComponentTypeSchema>;

const CanvasRenderInputSchema = z.object({
  type: CanvasComponentTypeSchema.describe("Tipo de componente declarativo de Canvas a renderizar"),
  title: z.string().describe("Título o encabezado visual del componente"),
  props: z.record(z.string(), z.unknown()).default({}).describe("Propiedades y datos específicos del tipo de componente"),
});

export type CanvasRenderInput = z.infer<typeof CanvasRenderInputSchema>;

export interface NativeCanvasOptions {
  onRender?: (manifest: Record<string, unknown>) => void;
}

/**
 * Herramienta nativa Nivel A para permitir que el Cognitive Runtime y el LLM
 * proyecten artefactos visuales dinámicos directamente sobre la superficie Canvas.
 */
export function createCanvasRenderTool(options: NativeCanvasOptions = {}): ToolDefinition {
  return {
    name: "canvas_render",
    description: "Proyecta dinámicamente un componente interactivo estructurado (tabla, gráfico, tarjeta, diff, tablero Kanban, editor de código o formulario) sobre el Canvas dinámico del usuario.",
    category: "system",
    riskLevel: "safe",
    origin: "native",
    requiresApproval: false,
    tags: ["canvas", "ui", "render", "generative", "workspace"],
    inputSchema: CanvasRenderInputSchema,
    execute: async (input: z.infer<typeof CanvasRenderInputSchema>, _context?: ToolExecutionContext) => {
      const componentId = `canvas-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const manifest = {
        id: componentId,
        type: input.type,
        title: input.title,
        version: "1.0.0",
        layout: { zone: "main" as const, width: 12 },
        props: input.props ?? {},
      };

      if (options.onRender) {
        options.onRender(manifest);
      }

      return {
        success: true,
        data: {
          rendered: true,
          componentId,
          manifest,
        },
      };
    },
  };
}
