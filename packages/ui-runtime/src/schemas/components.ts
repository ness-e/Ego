import { z } from "zod";

/**
 * Metadata canónica de explicabilidad y autoría para componentes de Canvas (P11 & Mascota)
 */
export const ComponentMetadataSchema = z.object({
  generatedBy: z.string().optional(),
  timestamp: z.number().default(() => Date.now()),
  why: z
    .object({
      directCause: z.string().optional(),
      vantaSources: z.array(z.string()).default([]),
      auditTrace: z.string().optional(),
    })
    .optional(),
});

export type ComponentMetadata = z.infer<typeof ComponentMetadataSchema>;

/**
 * Tabla interactiva declarativa (TableSchema)
 */
export const TableColumnSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "number", "boolean", "badge", "date"]).default("text"),
  sortable: z.boolean().default(false),
  width: z.string().optional(),
});

export const TableActionSchema = z.object({
  actionId: z.string().min(1),
  label: z.string().min(1),
  variant: z.enum(["default", "primary", "danger", "outline"]).default("default"),
});

export const TablePropsSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  columns: z.array(TableColumnSchema).min(1),
  rows: z.array(z.record(z.unknown())),
  pagination: z
    .object({
      pageSize: z.number().int().positive().default(10),
      currentPage: z.number().int().positive().default(1),
      totalCount: z.number().int().nonnegative().optional(),
    })
    .optional(),
  actions: z.array(TableActionSchema).default([]),
});

export type TableProps = z.infer<typeof TablePropsSchema>;

/**
 * Tarjeta de información / artefacto (CardSchema)
 */
export const CardActionSchema = z.object({
  actionId: z.string().min(1),
  label: z.string().min(1),
  variant: z.enum(["default", "primary", "danger", "outline"]).default("default"),
  payload: z.record(z.unknown()).optional(),
});

export const CardPropsSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  badge: z.string().optional(),
  content: z
    .object({
      markdown: z.string().optional(),
      fields: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    })
    .optional(),
  actions: z.array(CardActionSchema).default([]),
});

export type CardProps = z.infer<typeof CardPropsSchema>;

/**
 * Formulario declarativo seguro (FormSchema)
 */
export const FormFieldOptionSchema = z.object({
  label: z.string().min(1),
  value: z.string(),
});

export const FormFieldSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "number", "select", "switch", "textarea"]),
  required: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
  options: z.array(FormFieldOptionSchema).optional(),
  placeholder: z.string().optional(),
});

export const FormPropsSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  fields: z.array(FormFieldSchema).min(1),
  submitLabel: z.string().default("Enviar"),
  actionId: z.string().default("submit_form"),
});

export type FormProps = z.infer<typeof FormPropsSchema>;

/**
 * Gráfico estructurado seguro (ChartSchema)
 */
export const ChartPropsSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  chartType: z.enum(["line", "bar", "pie", "area"]),
  data: z.array(z.record(z.unknown())).min(1),
  xKey: z.string().min(1),
  yKeys: z.array(z.string().min(1)).min(1),
  legend: z.boolean().default(true),
});

export type ChartProps = z.infer<typeof ChartPropsSchema>;

/**
 * Tablero Kanban / Cards (BoardSchema)
 */
export const BoardCardSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  tag: z.string().optional(),
  status: z.string().optional(),
});

export const BoardColumnSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  cards: z.array(BoardCardSchema).default([]),
});

export const BoardPropsSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  columns: z.array(BoardColumnSchema).min(1),
});

export type BoardProps = z.infer<typeof BoardPropsSchema>;

/**
 * Editor de código seguro / visor (EditorSchema)
 */
export const EditorPropsSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  filePath: z.string().optional(),
  language: z.string().default("typescript"),
  code: z.string(),
  readOnly: z.boolean().default(true),
  lineNumbers: z.boolean().default(true),
});

export type EditorProps = z.infer<typeof EditorPropsSchema>;

/**
 * Visualizador de diferencias de código (DiffSchema)
 */
export const DiffPropsSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  filePath: z.string().min(1),
  originalContent: z.string(),
  modifiedContent: z.string(),
  viewMode: z.enum(["split", "unified"]).default("split"),
  additionsCount: z.number().int().nonnegative().optional(),
  deletionsCount: z.number().int().nonnegative().optional(),
});

export type DiffProps = z.infer<typeof DiffPropsSchema>;

/**
 * Visor de salida de terminal (TerminalSchema)
 */
export const TerminalLineSchema = z.union([
  z.string(),
  z.object({
    text: z.string(),
    type: z.enum(["stdout", "stderr", "info", "error"]).default("stdout"),
    timestamp: z.number().optional(),
  }),
]);

export const TerminalPropsSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  cwd: z.string().optional(),
  lines: z.array(TerminalLineSchema).default([]),
  isRunning: z.boolean().default(false),
  exitCode: z.number().nullable().optional(),
});

export type TerminalProps = z.infer<typeof TerminalPropsSchema>;

/**
 * Unión discriminada canónica: CanvasComponentManifest
 */
export const CanvasComponentManifestSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("table"),
    props: TablePropsSchema,
    metadata: ComponentMetadataSchema.optional(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("card"),
    props: CardPropsSchema,
    metadata: ComponentMetadataSchema.optional(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("form"),
    props: FormPropsSchema,
    metadata: ComponentMetadataSchema.optional(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("chart"),
    props: ChartPropsSchema,
    metadata: ComponentMetadataSchema.optional(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("board"),
    props: BoardPropsSchema,
    metadata: ComponentMetadataSchema.optional(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("editor"),
    props: EditorPropsSchema,
    metadata: ComponentMetadataSchema.optional(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("diff"),
    props: DiffPropsSchema,
    metadata: ComponentMetadataSchema.optional(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("terminal"),
    props: TerminalPropsSchema,
    metadata: ComponentMetadataSchema.optional(),
  }),
]);

export type CanvasComponentManifest = z.infer<typeof CanvasComponentManifestSchema>;
export type CanvasComponentType = CanvasComponentManifest["type"];

/**
 * Estado completo del Workspace Canvas para persistencia (CANV-06)
 */
export const CanvasWorkspaceStateSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  activeView: z.string().default("default"),
  components: z.array(CanvasComponentManifestSchema).default([]),
  selectedComponentId: z.string().nullable().optional(),
  updatedAt: z.number().default(() => Date.now()),
});

export type CanvasWorkspaceState = z.infer<typeof CanvasWorkspaceStateSchema>;
