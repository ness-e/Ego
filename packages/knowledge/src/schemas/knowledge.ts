import { z } from "zod";

/**
 * Esquema tipado de fragmento de documento (DocumentChunk).
 * Implementa KHOJ-01 (hash SHA-256 de deduplicación) y KHOJ-02 (heading_path jerárquico).
 */
export const DocumentChunkSchema = z.object({
  id: z.string().describe("Identificador canónico del fragmento (ej. doc_hash:chunk_0)"),
  content: z.string().min(1).describe("Texto normalizado del fragmento"),
  tokenCount: z.number().int().nonnegative().describe("Recuento estimado o exacto de tokens"),
  headingPath: z.array(z.string()).describe("Jerarquía de encabezados (KHOJ-02: ['Guía', 'Instalación'])"),
  contentHash: z.string().length(64).describe("Digest SHA-256 para deduplicación idempotente (KHOJ-01)"),
  sourcePath: z.string().describe("Ruta relativa o absoluta del archivo fuente"),
  mimeType: z.string().describe("Tipo MIME del documento (text/markdown, text/plain, etc.)"),
  index: z.number().int().nonnegative().describe("Índice ordinal del fragmento en el documento"),
  metadata: z.record(z.unknown()).optional().describe("Metadatos extensibles adicionales"),
});

export type DocumentChunk = z.infer<typeof DocumentChunkSchema>;

/**
 * Esquema de documento procesado e indexado completo.
 */
export const ParsedDocumentSchema = z.object({
  id: z.string().describe("Identificador único del documento"),
  sourcePath: z.string().describe("Ruta del archivo en el sistema"),
  title: z.string().describe("Título deducido o nombre del archivo"),
  mimeType: z.string().describe("MIME type del documento"),
  rawLength: z.number().int().nonnegative().describe("Longitud en caracteres"),
  chunks: z.array(DocumentChunkSchema).describe("Lista secuencial de fragmentos adaptativos"),
  documentHash: z.string().length(64).describe("SHA-256 de todo el contenido del archivo"),
  metadata: z.record(z.unknown()).optional(),
});

export type ParsedDocument = z.infer<typeof ParsedDocumentSchema>;

/**
 * Esquema de aserción / hecho estructurado (Fact).
 * Utilizado en kb/facts y quarantine/pending (KHOJ-04, ADR-046, ADR-028).
 */
export const FactSchema = z.object({
  id: z.string().describe("Identificador canónico del hecho (fact_<uuid>)"),
  subject: z.string().min(1).describe("Sujeto de la aserción (ej. 'Ego', 'Usuario', 'Config')"),
  predicate: z.string().min(1).describe("Relación o predicado (ej. 'uses_editor', 'requires_approval')"),
  object: z.string().min(1).describe("Valor u objeto del hecho (ej. 'VSCode', 'true')"),
  confidence: z.number().min(0).max(1).describe("Índice de certeza [0.0 - 1.0]"),
  temporalScope: z.enum(["ephemeral", "persistent", "historical"]).default("persistent"),
  source: z.string().describe("Origen del hecho (documento, diálogo, tool output)"),
  sourceChunkId: z.string().optional().describe("ID del chunk si fue extraído de un documento"),
  validAt: z.number().describe("Timestamp epoch en ms en que el hecho es válido en la realidad"),
  invalidAt: z.number().nullable().default(null).describe("Timestamp en que el hecho expiró o fue refutado"),
  supersededBy: z.string().nullable().default(null).describe("ID del hecho sucesor si fue sustituido"),
  state: z.enum(["active", "superseded", "quarantined", "rejected"]).default("active"),
  metadata: z.record(z.unknown()).optional(),
});

export type Fact = z.infer<typeof FactSchema>;

/**
 * Opciones para búsqueda híbrida multi-canal (BM25 + Vector + RRF).
 */
export const KnowledgeSearchOptionsSchema = z.object({
  topK: z.number().int().positive().default(10),
  minConfidence: z.number().min(0).max(1).default(0.70).describe("Corte de umbral coseno (KHOJ-03)"),
  namespaces: z.array(z.string()).default(["kb/docs", "kb/facts"]),
  excludeSuperseded: z.boolean().default(true),
  useMmr: z.boolean().default(true).describe("Diversificación Maximal Marginal Relevance"),
  mmrLambda: z.number().min(0).max(1).default(0.7),
});

export type KnowledgeSearchOptions = z.infer<typeof KnowledgeSearchOptionsSchema>;
