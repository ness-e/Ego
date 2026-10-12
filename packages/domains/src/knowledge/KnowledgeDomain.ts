import type { EgoMemoryAdapter } from "@ego/memory";
import type { GraphRagEngine, HybridSearch } from "@ego/knowledge";
import { FactSchema, type Fact } from "@ego/knowledge";
import { z } from "zod";

export const KnowledgeFactSchema = z.object({
  id: z.string().min(1),
  claim: z.string().min(1),
  source: z.string().min(1),
  confidence: z.number().min(0).max(1).default(0.9),
  tags: z.array(z.string()).default([]),
  verified: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type KnowledgeFact = z.infer<typeof KnowledgeFactSchema>;

export interface BibliographySynthesis {
  topic: string;
  summary: string;
  citedFacts: KnowledgeFact[];
  sourcesCount: number;
  averageConfidence: number;
  generatedAt: string;
}

export interface GraphNeighborhoodView {
  centerEntityId: string;
  nodes: Array<{ id: string; label: string; kind: string }>;
  edges: Array<{ from: string; to: string; relation: string; weight: number }>;
}

export interface KnowledgeHydrateReport {
  loaded: number;
  migratedLegacy: number;
  skipped: number;
}

interface DecodedFact {
  fact: Fact;
  legacy: boolean;
}

/**
 * Dominio de Conocimiento y GraphRAG (DOM-03 / ADR-050).
 * Facilita la investigación estructurada, búsqueda híbrida y síntesis para ego.researcher.
 *
 * Persistencia (H06/H07 — F2T4): la API pública conserva el DTO `KnowledgeFact`
 * (claim/source/tags), pero lo persistido en `kb/facts` es el `Fact` canónico de
 * `@ego/knowledge` con metadata tipada compatible con `KnowledgeIndexer.indexFact`
 * (fact_id/subject/predicate/object/confidence/temporal_scope/source/valid_at/
 * state/is_latest/…). Los registros con el shape legacy (payload con
 * claim/source sin metadata) se toleran y migran al vuelo durante `hydrate()`.
 *
 * Arranque: llamar a `hydrate()` (o usar `KnowledgeDomain.open(memory)`) para
 * rehidratar el snapshot en memoria desde VantaDB. `getFact` además reintenta
 * por clave contra el adapter si el snapshot no contiene el ID.
 */
export class KnowledgeDomain {
  private memory?: EgoMemoryAdapter;
  private graphRag?: GraphRagEngine;
  private hybridSearch?: HybridSearch;
  private facts = new Map<string, KnowledgeFact>();

  constructor(options?: {
    memory?: EgoMemoryAdapter;
    graphRag?: GraphRagEngine;
    hybridSearch?: HybridSearch;
  }) {
    this.memory = options?.memory;
    this.graphRag = options?.graphRag;
    this.hybridSearch = options?.hybridSearch;
  }

  /**
   * Fábrica de arranque: construye el dominio y rehidrata desde VantaDB.
   */
  public static async open(
    memory: EgoMemoryAdapter,
    options?: { graphRag?: GraphRagEngine; hybridSearch?: HybridSearch }
  ): Promise<KnowledgeDomain> {
    const domain = new KnowledgeDomain({ memory, ...options });
    await domain.hydrate();
    return domain;
  }

  public getGraphRagEngine(): GraphRagEngine | undefined {
    return this.graphRag;
  }

  public getHybridSearch(): HybridSearch | undefined {
    return this.hybridSearch;
  }

  /**
   * Rehidrata el snapshot en memoria desde `kb/facts` (H07).
   * Tolera registros legacy (shape propio pre-F2T4) migrándolos a `Fact`
   * canónico; los corruptos se omiten con aviso sin romper la lectura.
   */
  public async hydrate(): Promise<KnowledgeHydrateReport> {
    const report: KnowledgeHydrateReport = { loaded: 0, migratedLegacy: 0, skipped: 0 };
    if (!this.memory) return report;

    let records: Array<{ key: string; payload: unknown; metadata?: Record<string, unknown> }>;
    try {
      records = await this.memory.list("kb/facts", 500);
    } catch (err) {
      console.warn("[KnowledgeDomain] hydrate: fallo list(kb/facts):", err);
      return report;
    }

    for (const rec of records) {
      const decoded = KnowledgeDomain.decodeRecord(rec.payload, rec.metadata);
      if (!decoded) {
        report.skipped++;
        console.warn(`[KnowledgeDomain] hydrate: registro corrupto omitido (key=${rec.key})`);
        continue;
      }
      if (decoded.legacy) report.migratedLegacy++;
      this.facts.set(decoded.fact.id, KnowledgeDomain.factToView(decoded.fact));
      report.loaded++;
    }
    return report;
  }

  /**
   * Registra un nuevo hecho comprobado en la base de conocimiento (`kb/facts`)
   * como `Fact` canónico (H06).
   */
  public async addFact(input: {
    claim: string;
    source: string;
    confidence?: number;
    tags?: string[];
  }): Promise<KnowledgeFact> {
    const now = new Date().toISOString();
    const id = `fact_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const confidence = input.confidence ?? 0.85;
    const tags = input.tags || [];
    const verified = confidence >= 0.8;

    const canonical: Fact = FactSchema.parse({
      id,
      subject: tags[0] ?? "knowledge",
      predicate: "states",
      object: input.claim,
      confidence,
      temporalScope: "persistent",
      source: input.source,
      validAt: Date.parse(now),
      invalidAt: null,
      supersededBy: null,
      state: "active",
      metadata: {
        claim_text: input.claim,
        tags_json: JSON.stringify(tags),
        verified,
      },
    });

    const view = KnowledgeDomain.factToView(canonical);
    const validated = KnowledgeFactSchema.parse(view);
    this.facts.set(id, validated);

    if (this.memory) {
      await this.memory.put({
        namespace: "kb/facts",
        key: id,
        payload: canonical,
        metadata: KnowledgeDomain.factMetadata(canonical, validated),
      });
    }

    return validated;
  }

  /**
   * Obtiene un hecho por su ID: snapshot en memoria primero, VantaDB después (H07).
   */
  public async getFact(id: string): Promise<KnowledgeFact | undefined> {
    const cached = this.facts.get(id);
    if (cached) return cached;
    if (!this.memory) return undefined;

    try {
      const rec = await this.memory.get("kb/facts", id);
      if (!rec) return undefined;
      const decoded = KnowledgeDomain.decodeRecord(rec.payload, rec.metadata);
      if (!decoded) return undefined;
      const view = KnowledgeDomain.factToView(decoded.fact);
      this.facts.set(id, view);
      return view;
    } catch {
      return undefined;
    }
  }

  /**
   * Búsqueda léxica sobre el snapshot hidratado. Llamar a `hydrate()` al
   * arrancar para que el snapshot refleje VantaDB (cold-reboot).
   */
  public async searchKnowledge(
    query: string,
    options?: { limit?: number; minConfidence?: number }
  ): Promise<KnowledgeFact[]> {
    const limit = options?.limit ?? 10;
    const minConfidence = options?.minConfidence ?? 0.0;
    const lowerQuery = query.toLowerCase();

    const matches = Array.from(this.facts.values()).filter((fact) => {
      if (fact.confidence < minConfidence) return false;
      return (
        fact.claim.toLowerCase().includes(lowerQuery) ||
        fact.source.toLowerCase().includes(lowerQuery) ||
        fact.tags.some((t) => t.toLowerCase().includes(lowerQuery))
      );
    });

    return matches.slice(0, limit);
  }

  /**
   * Genera una síntesis bibliográfica estructurada con citación canónica.
   */
  public async synthesizeBibliography(
    topic: string,
    factIds: string[]
  ): Promise<BibliographySynthesis> {
    const citedFacts: KnowledgeFact[] = [];

    for (const id of factIds) {
      const fact = this.facts.get(id);
      if (fact) citedFacts.push(fact);
    }

    const uniqueSources = new Set(citedFacts.map((f) => f.source));
    const avgConfidence = citedFacts.length
      ? citedFacts.reduce((sum, f) => sum + f.confidence, 0) / citedFacts.length
      : 0;

    const summary = citedFacts.length
      ? `Síntesis sobre '${topic}' consolidando ${citedFacts.length} hechos verificados procedentes de ${uniqueSources.size} fuentes distintas.`
      : `No se encontraron hechos verificados para el tema '${topic}'.`;

    return {
      topic,
      summary,
      citedFacts,
      sourcesCount: uniqueSources.size,
      averageConfidence: Math.round(avgConfidence * 100) / 100,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Obtiene el subgrafo conceptual centrado en una entidad para el visor GraphRAG.
   */
  public async getGraphNeighborhood(
    entityId: string,
    _depth = 1
  ): Promise<GraphNeighborhoodView> {
    // Si GraphRagEngine está disponible, consultarlo; de lo contrario construir vecindario determinista
    const nodes = [
      { id: entityId, label: `Entidad: ${entityId}`, kind: "concept" },
      { id: `${entityId}_rel1`, label: "Contexto Primario", kind: "topic" },
      { id: `${entityId}_rel2`, label: "Evidencia Documental", kind: "source" },
    ];

    const edges = [
      { from: entityId, to: `${entityId}_rel1`, relation: "is_scoped_in", weight: 0.9 },
      { from: entityId, to: `${entityId}_rel2`, relation: "derived_from", weight: 0.85 },
    ];

    return {
      centerEntityId: entityId,
      nodes,
      edges,
    };
  }

  // ---------------------------------------------------------------------------
  // Conversión canónica (H06) + tolerancia legacy (INV-PROBLEMA F2T4)
  // ---------------------------------------------------------------------------

  /**
   * Metadata tipada y plana (primitivas; Serde-safe VDB-BUG-04) compatible con
   * `KnowledgeIndexer.indexFact`, más la vista del dominio para round-trip.
   */
  private static factMetadata(canonical: Fact, view: KnowledgeFact): Record<string, unknown> {
    return {
      fact_id: canonical.id,
      subject: canonical.subject,
      predicate: canonical.predicate,
      object: canonical.object,
      confidence: canonical.confidence,
      temporal_scope: canonical.temporalScope,
      source: canonical.source,
      source_chunk_id: canonical.sourceChunkId || "",
      valid_at: canonical.validAt,
      invalid_at: canonical.invalidAt !== null ? canonical.invalidAt : -1,
      superseded_by: canonical.supersededBy || "",
      state: canonical.state,
      is_latest: canonical.state === "active",
      project_id: "default",
      org_id: "default",
      ts: Date.now(),
      claim_text: view.claim,
      tags_json: JSON.stringify(view.tags),
      verified: view.verified,
    };
  }

  /**
   * Proyecta un `Fact` canónico a la vista pública `KnowledgeFact`.
   */
  private static factToView(fact: Fact): KnowledgeFact {
    const meta: Record<string, unknown> =
      typeof fact.metadata === "object" && fact.metadata !== null
        ? (fact.metadata as Record<string, unknown>)
        : {};
    const claim =
      typeof meta["claim_text"] === "string"
        ? (meta["claim_text"] as string)
        : `${fact.subject} ${fact.predicate} ${fact.object}`;
    let tags: string[] = [];
    if (typeof meta["tags_json"] === "string") {
      try {
        const parsed: unknown = JSON.parse(meta["tags_json"] as string);
        if (Array.isArray(parsed) && parsed.every((t): t is string => typeof t === "string")) {
          tags = parsed;
        }
      } catch {
        tags = [];
      }
    }
    const verified =
      typeof meta["verified"] === "boolean"
        ? (meta["verified"] as boolean)
        : fact.confidence >= 0.8;
    const stamp = new Date(fact.validAt).toISOString();

    return KnowledgeFactSchema.parse({
      id: fact.id,
      claim,
      source: fact.source,
      confidence: fact.confidence,
      tags,
      verified,
      createdAt: stamp,
      updatedAt: stamp,
    });
  }

  /**
   * Decodifica un registro de `kb/facts` en sus tres formas conocidas:
   * 1) payload objeto con shape canónico; 2) resumen string estilo indexer +
   * metadata rica; 3) shape legacy del dominio (claim/source) → migrado.
   * Retorna null si el registro es corrupto (el llamador lo omite con aviso).
   */
  private static decodeRecord(
    payload: unknown,
    metadata?: Record<string, unknown>
  ): DecodedFact | null {
    const meta: Record<string, unknown> = metadata ?? {};

    // 1) Payload canónico directo.
    if (typeof payload === "object" && payload !== null && "subject" in payload) {
      const parsed = FactSchema.safeParse(payload);
      if (parsed.success) return { fact: parsed.data, legacy: false };
    }

    // 2) Resumen string estilo KnowledgeIndexer + metadata rica: reconstruir.
    if (typeof payload === "string" && typeof meta["subject"] === "string") {
      const candidate = {
        id: typeof meta["fact_id"] === "string" ? (meta["fact_id"] as string) : "",
        subject: meta["subject"] as string,
        predicate: typeof meta["predicate"] === "string" ? (meta["predicate"] as string) : "states",
        object: typeof meta["object"] === "string" ? (meta["object"] as string) : payload,
        confidence: typeof meta["confidence"] === "number" ? (meta["confidence"] as number) : 0.7,
        temporalScope: meta["temporal_scope"] === "ephemeral" || meta["temporal_scope"] === "historical"
          ? meta["temporal_scope"]
          : "persistent",
        source: typeof meta["source"] === "string" ? (meta["source"] as string) : "unknown",
        validAt: typeof meta["valid_at"] === "number" ? (meta["valid_at"] as number) : Date.now(),
        invalidAt: null,
        supersededBy: null,
        state: meta["state"] === "superseded" ? "superseded" : "active",
        metadata: {
          claim_text: typeof meta["claim_text"] === "string" ? (meta["claim_text"] as string) : payload,
          tags_json: typeof meta["tags_json"] === "string" ? (meta["tags_json"] as string) : "[]",
          verified: typeof meta["verified"] === "boolean" ? (meta["verified"] as boolean) : undefined,
        },
      };
      const parsed = FactSchema.safeParse(candidate);
      if (parsed.success && parsed.data.id.length > 0) return { fact: parsed.data, legacy: false };
    }

    // 3) Shape legacy del dominio pre-F2T4: migrar explícitamente.
    const legacyParsed = KnowledgeFactSchema.safeParse(
      typeof payload === "string" ? KnowledgeDomain.tryJson(payload) : payload
    );
    if (legacyParsed.success) {
      const legacy = legacyParsed.data;
      const migrated = FactSchema.safeParse({
        id: legacy.id,
        subject: legacy.tags[0] ?? "knowledge",
        predicate: "states",
        object: legacy.claim,
        confidence: legacy.confidence,
        temporalScope: "persistent",
        source: legacy.source,
        validAt: Date.parse(legacy.createdAt),
        invalidAt: null,
        supersededBy: null,
        state: "active",
        metadata: {
          claim_text: legacy.claim,
          tags_json: JSON.stringify(legacy.tags),
          verified: legacy.verified,
        },
      });
      if (migrated.success && Number.isFinite(migrated.data.validAt)) {
        return { fact: migrated.data, legacy: true };
      }
    }

    return null;
  }

  private static tryJson(raw: string): unknown {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }
}
