/**
 * Path cognitivo nativo de VantaDB (E2 / ADR-0023).
 *
 * `VDB-REQ-16`: el **wrapper** `vantadb@0.9.0` no re-expone las **APIs
 * cognitivas** del **binding** `vantadb-node@0.9.0`.
 *
 * ## El problema (medido, 2026-10-21, sobre el árbol instalado)
 *
 * Hay TRES capas y el método se perdía en la segunda:
 *
 * | capa | qué expone | ¿ APIs cognitivas? |
 * |---|---|---|
 * | binding `vantadb-node@0.9.0` | `VantaDb` nativo (napi-rs) | **SÍ** — `memoryRecall`, `contextAssemble`, `memoryConsolidate`, `memoryReinforce` (`index.d.ts:614,622,629,636`) |
 * | fachada `vantadb@0.9.0` (`vantadb/native`) | `NativeVantaDB` | **NO** — declara una lista **fija** de métodos, sin passthrough dinámico (`dist/native.d.ts:103`) |
 * | `vantadb-mcp` (subproceso cognitivo) | L0-L3 por MCP | SÍ, pero es otro proceso y otro canal |
 *
 * El producto importa la **fachada** (`vantadb/native`), luego que el binding
 * tenga el método no basta: hace falta un **puente de alcance**.
 *
 * ## Las tres vías (evaluadas con evidencia, ver ADR-0023)
 *
 * 1. **(i) Upstream** — que la fachada re-exponga los 4 métodos. Es la vía
 *    correcta, pero **no depende de Ego**: bloquea E2 hasta que VantaDB
 *    publique una versión nueva. Registrada como `VDB-REQ-16`.
 * 2. **(ii) Binding directo** — importar `vantadb-node` y abrir un **segundo**
 *    handle. **Medido: imposible en el mismo proceso** — el motor responde
 *    `VANTADB_BUSY: Database busy: database at <path> is already open in this
 *    process (writer)`. Reimplementar la fachada (normalización de
 *    metadatos, mapeo de registros, envoltura de errores) duplicaría ~800
 *    líneas del SDK.
 * 3. **(iii) HybridRuntime** — la fachada **conserva** el handle nativo que
 *    él mismo abrió (`NativeVantaDB.inner`, un campo público en el JS
 *    compilado, `private` sólo en el `.d.ts`). Medido: `db.inner` es el
 *    `VantaDb` nativo y **sí** trae los 4 métodos.
 *
 * ## Decisión: (iii), con (i) como destino
 *
 * Este módulo implementa (iii) de forma **estrecha y reversible**:
 * - Se prefiere SIEMPRE la API pública de la fachada; si upstream la
 *   re-expone (vía (i)), este módulo deja de tocar `inner` **solo**.
 * - La alcance se resuelve por **capability probe** (igual que
 *   `graphRagSearch`): si el método no está, la llamada degrada a `null`
 *   (fail-soft) en lugar de romper el turno.
 * - `inner` es un detalle de implementación del SDK: está encapsulado aquí,
 *   en un solo fichero, para que la migración a (i) sea un cambio de una
 *   función.
 */

/** Superficie cognitiva que el binding `vantadb-node` expone. */
export interface CognitiveBinding {
  /** Recall de memoria con re-rank compuesto por confianza (S8/FIND-320). */
  memoryRecall(options: unknown): Promise<unknown>;
  /** Compactación nativa de un historial bajo un presupuesto de tokens. */
  contextAssemble(options: unknown): Promise<unknown>;
  /** Consolidación LLM-free de una sesión (primitivas de "sueño"). */
  memoryConsolidate(options: unknown): Promise<unknown>;
  /** Refuerza un recuerdo recuperado con un desenlace (`used`/`corrected`/`unused`). */
  memoryReinforce(hit: unknown, outcome: string): Promise<unknown>;
}

/**
 * Resuelve el handle cognitivo con el **puente de alcance** (vía iii).
 *
 * Orden de preferencia:
 * 1. La API **pública** de la fachada (si upstream la re-expone → vía (i)).
 * 2. El handle nativo que la fachada ya tiene abierto (`inner` → vía (iii)).
 *
 * Devuelve `null` si ninguna está disponible: el llamante degrada.
 */
export function resolveCognitiveBinding(handle: unknown): CognitiveBinding | null {
  if (!handle || typeof handle !== "object") return null;

  const facade = handle as Partial<CognitiveBinding>;
  if (typeof facade.memoryRecall === "function") {
    return facade as CognitiveBinding;
  }

  // Vía (iii): `NativeVantaDB.inner` es el `VantaDb` nativo que la fachada
  // abrió (`dist/native.js:153-158`). Es `private` en el `.d.ts` y público en
  // el JS compilado: por eso el acceso va por un cast estructural y una
  // comprobación de capacidad, nunca por una suposición.
  const inner = (handle as { inner?: Partial<CognitiveBinding> }).inner;
  if (inner && typeof inner.memoryRecall === "function") {
    return inner as CognitiveBinding;
  }
  return null;
}

/** Alcance del recall: qué sesiones entran en el pool. */
export type MemoryRecallScope = "session" | "agent" | "team";

/** Opciones del recall cognitivo nativo (`memoryRecall`). */
export interface MemoryRecallOptions {
  /** Texto del turno (lo que el usuario ha dicho). */
  user_text: string;
  /** Clave de sesión (obligatoria, no vacía). */
  session_key: string;
  /** Alcance del pool (por defecto `agent`). */
  scope?: MemoryRecallScope;
  /** Máximo de recuerdos inyectados por turno (por defecto 5). */
  max_results?: number;
  /** Mínimo de términos compartidos para recordar un registro (por defecto 1). */
  min_overlap?: number;
  /** Dimensión de equipo (por defecto `default`). */
  team_id?: string;
  /** Dimensión de agente (por defecto `default`). */
  agent_id?: string;
  /**
   * ACL de inyección: prefijos de namespace permitidos. **No se envía si
   * está vacía** (el motor interpretaría una lista vacía como allow-all).
   */
  allow_prefixes?: string[];
  /**
   * Opt-in del re-rank compuesto por confianza (relevancia + recencia +
   * importancia). `false` conserva el orden legacy byte a byte.
   */
  trust_aware?: boolean;
  /** Instante en epoch ms (determinismo en tests). */
  now_ms?: number;
}

/** Un recuerdo recuperado por el motor. */
export interface RecalledMemory {
  content: string;
  score: number;
  source_key: string;
  source_namespace: string;
  type: string;
}

/** Trazabilidad de la gobernanza del recall (las denegaciones NO son silenciosas). */
export interface MemoryRecallGovernance {
  /** Namespaces de los que sí se leyó. */
  sources: string[];
  /** Namespaces denegados por la ACL de inyección. */
  denied: string[];
}

/** Resultado del recall cognitivo nativo. */
export interface MemoryRecallResult {
  /** Bloque a prependear al prompt. */
  prepend_context: string | null;
  /** Bloque a añadir al contexto de sistema. */
  append_system_context: string | null;
  /** Recuerdos recuperados (ya ordenados por el motor). */
  recalled_memories: RecalledMemory[];
  /** Persona del scope (si la hay). */
  persona: unknown;
  /** Modo efectivo del recall (`keyword`/`hybrid`/…). */
  effective_mode: string;
  /** Trazabilidad de la gobernanza. */
  governance: MemoryRecallGovernance;
}

/** Opciones de la compactación nativa de contexto. */
export interface ContextAssembleOptions {
  messages: unknown[];
  token_budget: number;
  /** Prefijo protegido (p. ej. el system prompt) que el motor no debe cortar. */
  protected_prefix?: string;
  compaction_ratio?: number;
  min_keep?: number;
}

/** Resultado de la compactación nativa de contexto. */
export interface ContextAssembleResult {
  /** El motor detectó un corte de frontera. */
  has_boundary: boolean;
  /** Historial compactado. */
  messages: unknown[];
  /** Informe del motor (opcional). */
  report: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

/**
 * Normaliza la respuesta cruda de `memoryRecall` al contrato de Ego.
 * Devuelve `null` si la forma no es utilizable (binding antiguo o respuesta
 * inesperada), de modo que el llamante degrade en lugar de romper.
 */
export function normalizeMemoryRecall(raw: unknown): MemoryRecallResult | null {
  const obj = asRecord(raw);
  if (!obj) return null;

  const governance = asRecord(obj["governance"]) ?? {};
  const recalled = Array.isArray(obj["recalled_memories"])
    ? obj["recalled_memories"]
        .map((m) => asRecord(m))
        .filter((m): m is Record<string, unknown> => m !== null)
        .map((m) => ({
          content: asString(m["content"]),
          score: typeof m["score"] === "number" ? m["score"] : 0,
          source_key: asString(m["source_key"]),
          source_namespace: asString(m["source_namespace"]),
          type: asString(m["type"]),
        }))
    : [];

  return {
    prepend_context:
      typeof obj["prepend_context"] === "string" ? obj["prepend_context"] : null,
    append_system_context:
      typeof obj["append_system_context"] === "string" ? obj["append_system_context"] : null,
    recalled_memories: recalled,
    persona: obj["persona"] ?? null,
    effective_mode: asString(obj["effective_mode"]),
    governance: {
      sources: asStringArray(governance["sources"]),
      denied: asStringArray(governance["denied"]),
    },
  };
}

/**
 * Normaliza la respuesta cruda de `contextAssemble` al contrato de Ego.
 * Devuelve `null` si la forma no es utilizable.
 */
export function normalizeContextAssemble(raw: unknown): ContextAssembleResult | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  return {
    has_boundary: obj["has_boundary"] === true,
    messages: Array.isArray(obj["messages"]) ? obj["messages"] : [],
    report: obj["report"] ?? null,
  };
}
