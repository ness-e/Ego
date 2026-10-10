import { z } from "zod";

/**
 * Esquema de vista asociada a un dominio funcional.
 */
export const DomainViewSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  componentKind: z.string().min(1),
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
