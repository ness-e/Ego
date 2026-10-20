/**
 * Contrato del pipeline GraphRAG nativo de VantaDB (DIST-15).
 *
 * El binding napi-rs 0.8.0 expone `graphragSearch(namespace, query, queryVector?)`
 * con la forma canónica `{ nodes, edges, context_text, stats }` compartida por
 * los bindings Py/TS/Node/WASM. Los identificadores de nodo son `u128`
 * serializados como cadenas decimales (API-01).
 *
 * Este módulo existe para que `packages/knowledge` (que depende de
 * `@ego/memory`) pueda consumir el grafo nativo **sin** que `packages/memory`
 * dependa de `packages/knowledge` (DIP).
 *
 * Workaround upstream: `VDB-REQ-11` — el binding napi-rs 0.8.0 no expone el
 * motor IQL (`query`), de modo que el descubrimiento de aristas del GraphRAG
 * se hace vía `graphragSearch` (esta vía) y no con consultas IQL.
 * Workaround: `VDB-REQ-12` — siembra del sustrato de grafo: sin
 * `insertNode`/`addEdge` la fase nativa devolvía `edges: []`; hoy Ego puebla
 * aristas reales (ver `EgoMemoryAdapter.linkGraphNodes`).
 */

export interface NativeGraphRagNode {
  /** Id de nodo del grafo (cadena decimal u128). */
  id: string;
  content: string;
  /** Relevancia combinada: 0.6·seed + 0.3·hop_boost + 0.1·degree_factor. */
  score: number;
  /** Distancia BFS desde la semilla más cercana (0 = la semilla). */
  hop_distance: number;
}

export interface NativeGraphRagEdge {
  source: string;
  target: string;
  label: string;
}

export interface NativeGraphRagStats {
  seeds_found: number;
  nodes_expanded: number;
  total_candidates: number;
  expansion_hops_used: number;
}

export interface NativeGraphRagResult {
  nodes: NativeGraphRagNode[];
  edges: NativeGraphRagEdge[];
  context_text: string;
  stats: NativeGraphRagStats;
}

/**
 * Forma mínima del binding expuesta por `NativeVantaDB` para GraphRAG.
 * (Verificada contra `vantadb-node` 0.8.0: `graphragSearch(namespace, query?, queryVector?)`.)
 */
export interface GraphRagBinding {
  graphragSearch(
    namespace: string,
    query?: string | null,
    queryVector?: number[] | null
  ): Promise<unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

/**
 * Normaliza la respuesta cruda del binding al contrato `NativeGraphRagResult`.
 * Devuelve `null` si la forma no es utilizable (binding antiguo o respuesta
 * inesperada), de modo que el llamante degrade en lugar de romper.
 */
export function normalizeNativeGraphRag(raw: unknown): NativeGraphRagResult | null {
  const obj = asRecord(raw);
  if (!obj) return null;

  const nodes: NativeGraphRagNode[] = Array.isArray(obj["nodes"])
    ? obj["nodes"]
        .map((n) => asRecord(n))
        .filter((n): n is Record<string, unknown> => n !== null)
        .map((n) => ({
          id: asString(n["id"], ""),
          content: asString(n["content"], ""),
          score: asNumber(n["score"], 0),
          hop_distance: asNumber(n["hop_distance"], 0),
        }))
        .filter((n) => n.id.length > 0)
    : [];

  const edges: NativeGraphRagEdge[] = Array.isArray(obj["edges"])
    ? obj["edges"]
        .map((e) => asRecord(e))
        .filter((e): e is Record<string, unknown> => e !== null)
        .map((e) => ({
          source: asString(e["source"], ""),
          target: asString(e["target"], ""),
          label: asString(e["label"], "related"),
        }))
        .filter((e) => e.source.length > 0 && e.target.length > 0)
    : [];

  const statsObj = asRecord(obj["stats"]);
  const stats: NativeGraphRagStats = {
    seeds_found: asNumber(statsObj?.["seeds_found"], nodes.length),
    nodes_expanded: asNumber(statsObj?.["nodes_expanded"], 0),
    total_candidates: asNumber(statsObj?.["total_candidates"], nodes.length),
    expansion_hops_used: asNumber(statsObj?.["expansion_hops_used"], 0),
  };

  return {
    nodes,
    edges,
    context_text: asString(obj["context_text"], ""),
    stats,
  };
}
