import { z } from "zod";

/**
 * Tipos de componente de Canvas que una vista de dominio puede declarar.
 *
 * EGO-FIND-48 (Ola 1 / A3 / T8): antes `componentKind` era un `string` libre
 * y las 15 vistas declaraban nombres INVENTADOS (`CodeTreeView`,
 * `KanbanBoard`, `GraphRagCanvas`…) que no existían en ningún registry:
 * metadato muerto (0 matches en el renderer).
 *
 * Ahora `componentKind` es un tipo de componente REAL del Canvas, y el
 * renderer puede resolverlo contra el `CanvasComponentRegistry` de
 * `@ego/ui-runtime`.
 */
export const CANVAS_COMPONENT_KINDS = [
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
] as const;

export type CanvasComponentKind = (typeof CANVAS_COMPONENT_KINDS)[number];

/**
 * Esquema de vista asociada a un dominio funcional.
 */
export const DomainViewSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  componentKind: z.enum(CANVAS_COMPONENT_KINDS),
  description: z.string().optional(),
  default: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type DomainView = z.infer<typeof DomainViewSchema>;

/**
 * Esquema canónico de definición de dominio funcional (COUC-10 / ADR-050).
 */
export const DomainDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  icon: z.string().min(1),
  namespaces: z.array(z.string()),
  defaultSubEgoId: z.string().min(1),
  subEgoTemplates: z.array(z.string()),
  views: z.array(DomainViewSchema).min(1),
  tools: z.array(z.string()).default([]),
  isBuiltin: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
});

export type DomainDefinition = z.infer<typeof DomainDefinitionSchema>;

/**
 * Identificadores canónicos de dominios integrados en Ego.
 */
export type CanonicalDomainId =
  | "engineering"
  | "product"
  | "knowledge"
  | "analytics"
  | "crm";

/**
 * Estado activo de un dominio en el workspace.
 */
export interface DomainActiveState {
  domainId: string;
  activeViewId: string;
  activeSubEgoId: string;
  timestamp: string;
}
