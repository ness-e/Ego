import { EgoMemoryAdapter } from "@ego/memory";
import { HybridSearch } from "./HybridSearch.js";

export interface GraphNode {
  id: string;
  label: string;
  type: "document" | "fact" | "decision" | "entity";
  content: string;
  weight: number;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: "mentions" | "depends_on" | "derived_from" | "supersedes" | "authored_by";
  weight: number;
}

export interface GraphRagContext {
  query: string;
  seedNodes: GraphNode[];
  expandedNodes: GraphNode[];
  edges: GraphEdge[];
  contextSummary: string;
}

export interface GraphRagOptions {
  maxDepth?: number;
  maxDegreePerNode?: number; // VDB-REQ-07: Poda de grado para evitar explosión
  maxTotalNodes?: number;
  minSimilarity?: number;
}

/**
 * Motor de razonamiento GraphRAG nativo acoplado a VantaDB (KB-06).
 * Ejecuta búsqueda híbrida semilla, expansión relacional en grafo con poda por grado (VDB-REQ-07),
 * ponderación causal y síntesis estructurada para el System Prompt de los Sub-Egos.
 */
export class GraphRagEngine {
  private adapter: EgoMemoryAdapter;
  private readonly hybridSearch: HybridSearch;

  constructor(adapter: EgoMemoryAdapter) {
    this.adapter = adapter;
    this.hybridSearch = new HybridSearch(adapter);
  }

  public getAdapter(): EgoMemoryAdapter {
    return this.adapter;
  }

  public setAdapter(adapter: EgoMemoryAdapter): void {
    this.adapter = adapter;
    this.hybridSearch.setAdapter(adapter);
  }

  /**
   * Ejecuta el pipeline completo de GraphRAG de 4 fases.
   */
  public async search(
    query: string,
    options: GraphRagOptions = {}
  ): Promise<GraphRagContext> {
    const maxDepth = options.maxDepth ?? 2;
    const maxDegree = options.maxDegreePerNode ?? 10;
    const maxTotalNodes = options.maxTotalNodes ?? 20;
    const minSimilarity = options.minSimilarity ?? 0.70;

    // Fase 1: Búsqueda Semilla Híbrida (BM25 + Vectorial)
    const seedHits = await this.hybridSearch.search(query, {
      topK: 5,
      minConfidence: minSimilarity,
      namespaces: ["kb/docs", "kb/facts", "gov/audit"],
    });

    const seedNodes: GraphNode[] = seedHits.map((h, idx) => ({
      id: h.record ? `${h.record.namespace}:${h.record.key}` : `seed_${idx}`,
      label: h.record?.key || `Seed ${idx + 1}`,
      type: h.record?.namespace?.startsWith("kb/facts")
        ? "fact"
        : h.record?.namespace?.startsWith("gov/audit")
          ? "decision"
          : "document",
      content: String(h.record?.payload || ""),
      weight: h.score ?? 1.0,
      metadata: h.record?.metadata as Record<string, unknown> | undefined,
    }));

    // Si no hay semillas, retornar contexto vacío
    if (seedNodes.length === 0) {
      return {
        query,
        seedNodes: [],
        expandedNodes: [],
        edges: [],
        contextSummary: "No se encontró conocimiento previo relevante para la consulta.",
      };
    }

    // Fase 2 & 3: Expansión Relacional con Poda de Centralidad (VDB-REQ-07)
    const visitedIds = new Set<string>(seedNodes.map((n) => n.id));
    const expandedNodes: GraphNode[] = [...seedNodes];
    const edges: GraphEdge[] = [];

    let currentLayer = [...seedNodes];
    let depth = 0;

    while (depth < maxDepth && expandedNodes.length < maxTotalNodes && currentLayer.length > 0) {
      depth++;
      const nextLayer: GraphNode[] = [];

      for (const node of currentLayer) {
        if (expandedNodes.length >= maxTotalNodes) break;

        // Recuperar relaciones referenciadas en metadatos o grafo de VantaDB
        const relatedReferences = this.extractNodeReferences(node, maxDegree);

        for (const rel of relatedReferences) {
          if (expandedNodes.length >= maxTotalNodes) break;

          edges.push({
            from: node.id,
            to: rel.targetId,
            relation: rel.relation,
            weight: rel.weight,
          });

          if (!visitedIds.has(rel.targetId)) {
            visitedIds.add(rel.targetId);

            // Intentar recuperar el nodo vecino desde VantaDB si está presente
            const neighborNode: GraphNode = {
              id: rel.targetId,
              label: rel.targetId.split(":").pop() || rel.targetId,
              type: rel.targetId.includes("fact") ? "fact" : "entity",
              content: rel.summary || `Entidad relacionada: ${rel.targetId}`,
              weight: Math.max(0.1, node.weight * 0.8), // Decaimiento por salto de distancia
            };

            expandedNodes.push(neighborNode);
            nextLayer.push(neighborNode);
          }
        }
      }

      currentLayer = nextLayer;
    }

    // Fase 4: Ensamblado y Síntesis Estructurada para el System Prompt
    const contextSummary = this.buildContextSummary(query, seedNodes, expandedNodes, edges);

    return {
      query,
      seedNodes,
      expandedNodes,
      edges,
      contextSummary,
    };
  }

  /**
   * Extrae referencias a otras entidades desde metadatos o contenido respetando maxDegree.
   */
  private extractNodeReferences(
    node: GraphNode,
    maxDegree: number
  ): Array<{ targetId: string; relation: GraphEdge["relation"]; weight: number; summary?: string }> {
    const refs: Array<{ targetId: string; relation: GraphEdge["relation"]; weight: number; summary?: string }> = [];

    // 1. Relaciones formales en metadata (ej. supersedes, source_chunk_id, doc_id)
    if (node.metadata) {
      if (typeof node.metadata["supersedes"] === "string" && node.metadata["supersedes"]) {
        refs.push({
          targetId: `kb/facts:${node.metadata["supersedes"]}`,
          relation: "supersedes",
          weight: 0.9,
          summary: `Hecho previo sustituido: ${node.metadata["supersedes"]}`,
        });
      }
      if (typeof node.metadata["doc_id"] === "string" && node.metadata["doc_id"]) {
        refs.push({
          targetId: `kb/docs:${node.metadata["doc_id"]}`,
          relation: "derived_from",
          weight: 0.85,
        });
      }
    }

    // 2. Extracción de menciones canónicas en el contenido (ej. "Ref: proj/...", "Ver: doc_...")
    const mentionMatches = node.content.matchAll(/\b(doc_[a-f0-9]{8,16}|fact_[a-f0-9]{8,16}|verdict:[a-f0-9-]+)\b/g);
    for (const match of mentionMatches) {
      if (refs.length >= maxDegree) break;
      const refId = match[1];
      if (refId !== node.id && !refs.some((r) => r.targetId.includes(refId))) {
        refs.push({
          targetId: refId.startsWith("doc_") ? `kb/docs:${refId}` : `kb/facts:${refId}`,
          relation: "mentions",
          weight: 0.75,
        });
      }
    }

    return refs.slice(0, maxDegree);
  }

  /**
   * Ensambla el subgrafo de contexto en un formato limpio para el LLM.
   */
  private buildContextSummary(
    query: string,
    seeds: GraphNode[],
    allNodes: GraphNode[],
    edges: GraphEdge[]
  ): string {
    const parts: string[] = [
      `### Contexto de Conocimiento de Proyecto (GraphRAG)\n*Consulta:* "${query}"\n`,
    ];

    parts.push("#### Hallazgos Principales (Semillas):");
    for (const seed of seeds) {
      parts.push(`- [${seed.type.toUpperCase()}] **${seed.label}**: ${seed.content.slice(0, 300)}`);
    }

    const nonSeedNodes = allNodes.filter((n) => !seeds.some((s) => s.id === n.id));
    if (nonSeedNodes.length > 0) {
      parts.push("\n#### Nodos de Soporte Relacionados:");
      for (const node of nonSeedNodes) {
        parts.push(`- [${node.type.toUpperCase()}] **${node.label}**: ${node.content.slice(0, 200)}`);
      }
    }

    if (edges.length > 0) {
      parts.push("\n#### Relaciones Causales y Linaje:");
      for (const edge of edges) {
        parts.push(`- \`${edge.from}\` --(${edge.relation})--> \`${edge.to}\``);
      }
    }

    return parts.join("\n");
  }
}
