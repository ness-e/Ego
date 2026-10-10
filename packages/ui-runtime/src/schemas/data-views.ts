import { z } from "zod";
import { ComponentMetadataSchema } from "./metadata.js";

/**
 * Esquema de datos para RecordView (Inspección individual de documento o hecho en VantaDB)
 */
export const RecordChunkSchema = z.object({
  id: z.string().min(1),
  index: z.number().int().nonnegative(),
  content: z.string(),
  headingPath: z.array(z.string()).default([]),
  tokenCount: z.number().int().nonnegative().optional(),
});

export type RecordChunk = z.infer<typeof RecordChunkSchema>;

export const RecordLineageItemSchema = z.object({
  relation: z.string(),
  targetKey: z.string(),
  timestamp: z.number().optional(),
});

export type RecordLineageItem = z.infer<typeof RecordLineageItemSchema>;

export const RecordViewPropsSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  recordKey: z.string().min(1),
  namespace: z.string().min(1),
  payload: z.string(),
  confidence: z.number().min(0).max(1).optional(),
  state: z.enum(["active", "quarantined", "superseded"]).default("active"),
  temporalScope: z.enum(["persistent", "ephemeral"]).optional(),
  metadata: z.record(z.unknown()).optional(),
  chunks: z.array(RecordChunkSchema).default([]),
  lineage: z.array(RecordLineageItemSchema).default([]),
});

export type RecordViewProps = z.infer<typeof RecordViewPropsSchema>;

/**
 * Esquema de datos para QueryView (Buscador y explorador interactivo de conocimiento)
 */
export const QueryResultItemSchema = z.object({
  key: z.string().min(1),
  namespace: z.string().min(1),
  snippet: z.string(),
  score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1).optional(),
  date: z.string().optional(),
  headingPath: z.array(z.string()).optional(),
});

export type QueryResultItem = z.infer<typeof QueryResultItemSchema>;

export const QueryViewPropsSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  query: z.string().default(""),
  namespace: z.string().default("all"),
  results: z.array(QueryResultItemSchema).default([]),
  minScoreFilter: z.number().min(0).max(1).default(0.7),
  totalCount: z.number().int().nonnegative().optional(),
});

export type QueryViewProps = z.infer<typeof QueryViewPropsSchema>;

/**
 * Esquema de datos para RelationView (Visualización topológica y causal de nodos de grafo)
 */
export const RelationNodeSchema = z.object({
  id: z.string().min(1), // id obligatorio como string según contrato KB-05
  label: z.string().min(1),
  type: z.enum(["document", "fact", "decision", "entity"]).default("entity"),
  content: z.string().optional(),
  weight: z.number().default(1.0),
  metadata: z.record(z.unknown()).optional(),
});

export type RelationNode = z.infer<typeof RelationNodeSchema>;

export const RelationEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  relation: z.string().min(1),
  weight: z.number().default(1.0),
});

export type RelationEdge = z.infer<typeof RelationEdgeSchema>;

export const RelationViewPropsSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  rootNodeId: z.string().min(1),
  nodes: z.array(RelationNodeSchema).min(1),
  edges: z.array(RelationEdgeSchema).default([]),
  layout: z.enum(["dag", "cluster", "timeline"]).default("dag"),
});

export type RelationViewProps = z.infer<typeof RelationViewPropsSchema>;

/**
 * Manifests declarativos de Data Views para inyección en Canvas
 */
export const RecordViewManifestSchema = z.object({
  id: z.string().min(1),
  type: z.literal("record_view"),
  props: RecordViewPropsSchema,
  metadata: ComponentMetadataSchema.optional(),
});

export const QueryViewManifestSchema = z.object({
  id: z.string().min(1),
  type: z.literal("query_view"),
  props: QueryViewPropsSchema,
  metadata: ComponentMetadataSchema.optional(),
});

export const RelationViewManifestSchema = z.object({
  id: z.string().min(1),
  type: z.literal("relation_view"),
  props: RelationViewPropsSchema,
  metadata: ComponentMetadataSchema.optional(),
});

export const DataViewManifestSchema = z.discriminatedUnion("type", [
  RecordViewManifestSchema,
  QueryViewManifestSchema,
  RelationViewManifestSchema,
]);

export type DataViewManifest = z.infer<typeof DataViewManifestSchema>;
