import { EgoMemoryAdapter } from "@ego/memory";
import type { NativeGraphRagNode, NativeGraphRagResult } from "@ego/memory";
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
  /**
   * Procedencia del descubrimiento de la arista (EGO-FIND-42):
   * - `vanta-graph`: arista real del sustrato de grafo de VantaDB.
   * - `heuristic`: inferida de metadatos/menciones del contenido.
   */
  source?: "vanta-graph" | "heuristic";
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
 *
 * Fases:
 * 1. Búsqueda semilla híbrida (BM25 federada multi-namespace).
 * 2. **Expansión por aristas reales** del sustrato de grafo de VantaDB
 *    (`graphragSearch`, DIST-15) cuando el binding lo expone y el grafo tiene
 *    aristas pobladas.
 * 3. Expansión heurística de respaldo (metadatos `supersedes`/`doc_id` +
 *    menciones canónicas en el contenido) cuando no hay grafo nativo.
 * 4. Síntesis estructurada para el System Prompt de los Sub-Egos.
 *
 * Workaround upstream: `VDB-REQ-11` — el binding napi-rs 0.8.0 no expone el
 * motor IQL (`query`), de modo que el descubrimiento por arista no puede
 * consultarse con `graphQuery`; se usa `graphragSearch` (DIST-15) y, si el
 * grafo no aporta aristas, se degrada a la fase 3 (heurística metadata+regex).
 * Registrado en `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` (handoff A2 → A1).
 */
/** Mapea la etiqueta de arista nativa a la taxonomía de relaciones de Ego. */
function mapNativeRelation(label: string): GraphEdge["relation"] {
  switch (label.toLowerCase()) {
    case "depends_on":
      return "depends_on";
    case "derived_from":
      return "derived_from";
    case "supersedes":
    case "superseded_by":
      return "supersedes";
    case "authored_by":
      return "authored_by";
    default:
      return "mentions";
  }
}

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

    // Fase 2 (EGO-FIND-42): expansión por aristas REALES del sustrato de
    // grafo de VantaDB. Si el binding no lo expone o el grafo está vacío,
    // no aporta nada y la fase 3 (heurística) cubre el caso.
    await this.expandViaNativeGraph(
      query,
      seedHits,
      seedNodes,
      visitedIds,
      expandedNodes,
      edges,
      maxTotalNodes
    );

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
            source: "heuristic",
          });

          if (!visitedIds.has(rel.targetId)) {
            visitedIds.add(rel.targetId);

            // Intentar recuperar el nodo vecino real desde el adaptador (EgoMemoryAdapter)
            let neighborNode: GraphNode;
            let record: { key: string; payload: unknown; metadata?: Record<string, unknown> } | null = null;

            const colonIdx = rel.targetId.indexOf(":");
            if (colonIdx > 0 && typeof this.adapter?.get === "function") {
              const ns = rel.targetId.slice(0, colonIdx);
              const key = rel.targetId.slice(colonIdx + 1);
              try {
                record = await this.adapter.get(ns, key);
              } catch {
                record = null;
              }
            }

            if (record) {
              const ns = rel.targetId.slice(0, colonIdx);
              const payloadStr =
                typeof record.payload === "string"
                  ? record.payload
                  : record.payload !== undefined && record.payload !== null
                    ? JSON.stringify(record.payload)
                    : "";

              neighborNode = {
                id: rel.targetId,
                label: record.key || rel.targetId.split(":").pop() || rel.targetId,
                type: ns.startsWith("kb/facts")
                  ? "fact"
                  : ns.startsWith("gov/audit")
                    ? "decision"
                    : ns.startsWith("kb/docs")
                      ? "document"
                      : rel.targetId.includes("fact")
                        ? "fact"
                        : "entity",
                content: payloadStr,
                weight: Math.max(0.1, node.weight * 0.8), // Decaimiento por salto de distancia
                metadata: {
                  ...(record.metadata as Record<string, unknown> | undefined),
                  resolved: true,
                },
              };
            } else {
              // Fallback si no se puede resolver el nodo en el adaptador
              neighborNode = {
                id: rel.targetId,
                label: rel.targetId.split(":").pop() || rel.targetId,
                type: rel.targetId.includes("fact") ? "fact" : "entity",
                content: rel.summary || `Entidad relacionada: ${rel.targetId}`,
                weight: Math.max(0.1, node.weight * 0.8), // Decaimiento por salto de distancia
                metadata: { resolved: false },
              };
            }

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
   * Expansión por aristas reales del grafo nativo de VantaDB (EGO-FIND-42).
   *
   * El binding napi-rs 0.8.0 expone `graphragSearch(namespace, query)` con
   * aristas reales (`insertNode`/`addEdge`). Los ids de nodo del grafo son
   * `u128` decimales y coinciden con el `node_id` de los registros KV, de
   * modo que las semillas se mapean al grafo por ese identificador.
   *
   * Workaround upstream: `VDB-REQ-11` — el binding 0.8.0 no expone IQL
   * (`query`), así que el descubrimiento se hace vía `graphragSearch`.
   * Workaround: `VDB-REQ-12` — el sustrato de grafo no se sembraba, de modo
   * que esta fase devolvía `edges: []` y la heurística de la fase 3 era la
   * activa; hoy Ego siembra aristas reales (`EgoMemoryAdapter.linkGraphNodes`
   * + `ProjectMemoryGraph.seedGraphEdges`), por lo que la fase nativa aporta
   * relaciones cuando existen.
   */
  private async expandViaNativeGraph(
    query: string,
    seedHits: Array<{ record?: { node_id?: string | number } | null }>,
    seedNodes: GraphNode[],
    visited: Set<string>,
    expanded: GraphNode[],
    edges: GraphEdge[],
    maxTotalNodes: number
  ): Promise<void> {
    const adapter = this.adapter as unknown as {
      graphRagSearch?: (ns: string, q: string) => Promise<NativeGraphRagResult | null>;
    };
    if (typeof adapter.graphRagSearch !== "function") return;

    let native: NativeGraphRagResult | null = null;
    try {
      native = await adapter.graphRagSearch("kb/docs", query);
    } catch {
      return;
    }
    if (!native || native.edges.length === 0) return;

    // node_id (u128 decimal) → id de nodo Ego (`namespace:key`)
    const seedByNodeId = new Map<string, string>();
    seedHits.forEach((hit, idx) => {
      const rawNodeId = hit.record?.node_id;
      const nodeId = rawNodeId === undefined ? undefined : String(rawNodeId);
      const egoId = seedNodes[idx]?.id;
      if (nodeId && egoId) seedByNodeId.set(nodeId, egoId);
    });

    const nativeById = new Map<string, NativeGraphRagNode>(
      native.nodes.map((n) => [n.id, n])
    );

    for (const edge of native.edges) {
      if (expanded.length >= maxTotalNodes) break;
      const fromId = seedByNodeId.get(edge.source);
      if (!fromId) continue; // la arista no parte de una semilla resoluble

      const knownTarget = seedByNodeId.get(edge.target);
      const toId = knownTarget ?? `graph:${edge.target}`;

      edges.push({
        from: fromId,
        to: toId,
        relation: mapNativeRelation(edge.label),
        weight: 1,
        source: "vanta-graph",
      });

      if (visited.has(toId)) continue;
      visited.add(toId);

      const nativeNode = nativeById.get(edge.target);
      expanded.push({
        id: toId,
        label: knownTarget ?? (nativeNode?.content?.slice(0, 80) || edge.target),
        type: "entity",
        content: nativeNode?.content ?? "",
        weight: Math.max(0.1, nativeNode?.score ?? 0.3),
        metadata: {
          resolved: knownTarget !== undefined,
          graphSource: "vanta-graph",
          hopDistance: nativeNode?.hop_distance ?? 1,
        },
      });
    }
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
      if (refId && refId !== node.id && !refs.some((r) => r.targetId.includes(refId))) {
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
