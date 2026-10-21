import { z } from "zod";

/**
 * Esquema tipado de fragmento de documento (DocumentChunk).
 * Implementa los patrones `KHOJ-01` (hash SHA-256 de deduplicación) y
 * `KHOJ-02` (ruta de encabezados jerárquica) — **implementación propia de Ego**:
 * el patrón se estudió en `repos-referencia/khoj` (AGPL-3.0) como referencia de
 * diseño, sin traducción de código (khoj usa MD5 y no tiene ruta de
 * encabezados). Ver `docs/extractions/khoj.md`.
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
 * Opciones de búsqueda federada multi-namespace (BM25) con reordenamiento MMR.
 *
 * EGO-FIND-41: el fast path de VantaDB 0.9.0 es BM25 puro (sin embeddings en
 * el fast path — `VDB-REQ-10`), así que **no hay canal vectorial ni
 * RRF** todavía; el re-rank es mono-lista (score del motor + MMR).
 *
 * Workaround upstream: `VDB-REQ-10` — el binding `vantadb-node@0.8.0` no
 * expone embeddings en el fast path, por lo que la fusión RRF real no puede
 * calcularse y el MMR usa coseno léxico como aproximación.
 * TODO(EGO-FIND-41): habilitar canal denso + RRF real cuando VantaDB
 * exponga scores vectoriales por hit.
 */
export const KnowledgeSearchOptionsSchema = z.object({
  topK: z.number().int().positive().default(10),
  minConfidence: z.number().min(0).max(1).default(0.70).describe("Corte de umbral calibrado (KHOJ-03/H10: normalizado min-max por lote salvo modo absoluto)"),
  scoreMode: z.enum(["normalized", "absolute"]).default("normalized").describe("H10: normalized calibra contra la distribución BM25 del lote; absolute conserva semántica coseno [0,1]"),
  namespaces: z.array(z.string()).default(["kb/docs", "kb/facts"]),
  excludeSuperseded: z.boolean().default(true),
  useMmr: z.boolean().default(true).describe("Diversificación Maximal Marginal Relevance (EGO-FIND-41: relevancia normalizada min-max + coseno léxico)"),
  mmrLambda: z.number().min(0).max(1).default(0.7),
  allowUnfilteredFallback: z.boolean().default(false).describe("H09: si el umbral descarta todo, retornar topK sin filtrar con warn (bypass explícito de la guarda KHOJ-03)"),
});

export type KnowledgeSearchOptions = z.infer<typeof KnowledgeSearchOptionsSchema>;
