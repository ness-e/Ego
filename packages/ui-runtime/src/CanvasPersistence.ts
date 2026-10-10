import {
  CanvasWorkspaceStateSchema,
  type CanvasWorkspaceState,
} from "./schemas/components.js";

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
}
