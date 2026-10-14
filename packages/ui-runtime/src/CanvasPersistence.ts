import {
  CanvasWorkspaceStateSchema,
  type CanvasComponentManifest,
  type CanvasWorkspaceState,
} from "./schemas/components.js";

/**
 * Store mínimo estructural para persistir Canvas (T04).
 * Compatible con `EgoMemoryAdapter` (`put(item)` / `get(ns,key)`) y con el
 * adaptador IPC del renderer (`ego().memory("put"|"get", ...)` adaptado).
 * El renderer NUNCA toca VantaDB directo (regla namespaces-jev).
 */
export interface CanvasMemoryStore {
  put(item: {
    namespace: string;
    key: string;
    payload: unknown;
    metadata?: Record<string, unknown>;
  }): Promise<unknown>;
  get(
    namespace: string,
    key: string
  ): Promise<{ key: string; payload: unknown; metadata?: Record<string, unknown> } | null | undefined | unknown>;
}

export class CanvasPersistenceManager {
  /**
   * Serializa un estado de Canvas a cadena JSON segura
   */
  public static serialize(state: CanvasWorkspaceState): string {
    const validated = CanvasWorkspaceStateSchema.parse(state);
    return JSON.stringify(validated);
  }

  /**
   * Deserializa y valida un estado de Canvas desde JSON o buffer VantaDB
   */
  public static deserialize(raw: unknown, defaultProjectId = "default"): CanvasWorkspaceState {
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const res = CanvasWorkspaceStateSchema.safeParse(parsed);
      if (res.success) {
        return res.data;
      }
      console.warn("[CanvasPersistence] Estado no conforme, aplicando fallback:", res.error);
    } catch (err) {
      console.error("[CanvasPersistence] Error al parsear JSON de Canvas:", err);
    }

    return {
      id: `canvas-${defaultProjectId}`,
      projectId: defaultProjectId,
      activeView: "default",
      components: [],
      selectedComponentId: null,
      updatedAt: Date.now(),
    };
  }

  /**
   * Construye la clave canónica de almacenamiento VantaDB para el Canvas de un proyecto
   */
  public static getVantaKey(projectId: string): string {
    return `projects/${projectId}/workspace/canvas`;
  }

  /**
   * Construye un `CanvasWorkspaceState` válido desde los componentes vivos del bridge (T04)
   */
  public static workspaceStateFrom(
    components: CanvasComponentManifest[],
    projectId: string,
    selectedComponentId?: string | null,
    activeView = "default"
  ): CanvasWorkspaceState {
    return {
      id: `canvas-${projectId}`,
      projectId,
      activeView,
      components,
      selectedComponentId: selectedComponentId ?? null,
      updatedAt: Date.now(),
    };
  }

  /**
   * Guarda el estado del Canvas en VantaDB vía el store (gateway `EgoMemoryAdapter`
   * en main / `ego().memory("put",...)` adaptado en renderer). Nunca lanza.
   */
  public static async save(
    store: CanvasMemoryStore,
    projectId: string,
    state: CanvasWorkspaceState
  ): Promise<void> {
    const serialized = CanvasPersistenceManager.serialize(state);
    await store.put({
      namespace: `projects/${projectId}`,
      key: CanvasPersistenceManager.getVantaKey(projectId),
      payload: { data: serialized },
      metadata: { type: "canvas_state", version: 1 },
    });
  }

  /**
   * Carga el estado del Canvas desde VantaDB. Retorna `null` si no hay nada
   * persistido (nunca el fallback vacío: el llamador decide si aplica).
   * Nunca lanza: corrupción → `null` (+ `warn`, sin wipe silencioso).
   */
  public static async load(
    store: CanvasMemoryStore,
    projectId: string
  ): Promise<CanvasWorkspaceState | null> {
    let record: unknown;
    try {
      record = await store.get(`projects/${projectId}`, CanvasPersistenceManager.getVantaKey(projectId));
    } catch (err) {
      console.warn("[CanvasPersistence] Fallo al leer Canvas de VantaDB:", err);
      return null;
    }
    if (!record || typeof record !== "object") return null;
    const payload = (record as { payload?: unknown }).payload;
    if (payload === undefined || payload === null) return null;
    const raw = typeof payload === "object" && payload !== null && "data" in payload
      ? (payload as { data: unknown }).data
      : payload;
    if (typeof raw !== "string" && (typeof raw !== "object" || raw === null)) return null;
    const res = CanvasWorkspaceStateSchema.safeParse(
      typeof raw === "string" ? safeJsonParse(raw) : raw
    );
    if (!res.success) {
      console.warn("[CanvasPersistence] Estado persistido no conforme, se ignora:", res.error.issues);
      return null;
    }
    return res.data;
  }
}

/**
 * `JSON.parse` que retorna `undefined` en vez de lanzar (lectura defensiva)
 */
function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
