import type { CanvasComponentManifest } from "./schemas/components.js";

export interface CanvasChangeSet<T = unknown> {
  id: string;
  componentId: string;
  timestamp: number;
  op: "insert" | "update" | "delete" | "replace";
  path?: string;
  previousValue?: T;
  newValue: T;
  origin: "user" | "subego" | "system";
}

export interface CanvasActionEvent {
  type: "canvas.action";
  componentId: string;
  actionId: string;
  payload?: Record<string, unknown>;
  timestamp: number;
}

export interface CanvasMutationEvent {
  type: "canvas.mutation";
  changeSet: CanvasChangeSet;
  timestamp: number;
}

export interface CanvasFocusEvent {
  type: "canvas.focus";
  componentId: string;
  contextExcerpt?: string;
  timestamp: number;
}

export interface CanvasInjectEvent {
  type: "canvas.inject";
  manifest: CanvasComponentManifest;
  timestamp: number;
}

export interface CanvasRemoveEvent {
  type: "canvas.remove";
  componentId: string;
  timestamp: number;
}

export type CanvasEvent =
  | CanvasActionEvent
  | CanvasMutationEvent
  | CanvasFocusEvent
  | CanvasInjectEvent
  | CanvasRemoveEvent;

export type CanvasEventListener<T = CanvasEvent> = (event: T) => void;

/**
 * CanvasBridge — Protocolo bidireccional Chat <-> Canvas con ChangeSets atómicos (COUC-07 / OCLW-11)
 *
 * Honestidad (H16): `applyChangeSet` retorna `true` SOLO si mutó el componente
 * y emitió `canvas.mutation`. Ops no soportadas o paths inexistentes retornan
 * `false` + `warn` — jamás `true` sin mutar.
 */
export class CanvasBridge {
  private components: Map<string, CanvasComponentManifest> = new Map();
  private listeners: Map<string, Set<(event: CanvasEvent) => void>> = new Map();
  private focusedContext: { componentId: string; excerpt?: string } | null = null;

  constructor(initialComponents: CanvasComponentManifest[] = []) {
    for (const comp of initialComponents) {
      this.components.set(comp.id, comp);
    }
  }

  public getComponents(): CanvasComponentManifest[] {
    return Array.from(this.components.values());
  }

  public getComponent(id: string): CanvasComponentManifest | undefined {
    return this.components.get(id);
  }

  public on<T extends CanvasEvent = CanvasEvent>(
    eventType: T["type"] | "*",
    listener: CanvasEventListener<T>
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener as (event: CanvasEvent) => void);

    return () => {
      this.off(eventType, listener);
    };
  }

  public off<T extends CanvasEvent = CanvasEvent>(
    eventType: T["type"] | "*",
    listener: CanvasEventListener<T>
  ): void {
    const set = this.listeners.get(eventType);
    if (set) {
      set.delete(listener as (event: CanvasEvent) => void);
      if (set.size === 0) {
        this.listeners.delete(eventType);
      }
    }
  }

  public emit(event: CanvasEvent): void {
    // Listeners del evento específico
    const specific = this.listeners.get(event.type);
    if (specific) {
      for (const listener of specific) {
        try {
          listener(event);
        } catch (err) {
          console.error(`[CanvasBridge] Error en listener para ${event.type}:`, err);
        }
      }
    }

    // Wildcard listeners
    const wildcard = this.listeners.get("*");
    if (wildcard) {
      for (const listener of wildcard) {
        try {
          listener(event);
        } catch (err) {
          console.error("[CanvasBridge] Error en wildcard listener:", err);
        }
      }
    }
  }

  /**
   * Despacha una acción originada en un componente del Canvas hacia el Chat / Sub-Ego
   */
  public dispatchAction(
    componentId: string,
    actionId: string,
    payload?: Record<string, unknown>
  ): void {
    const event: CanvasActionEvent = {
      type: "canvas.action",
      componentId,
      actionId,
      // T04: evento siempre estructurado — payload nunca `undefined`
      payload: payload ?? {},
      timestamp: Date.now(),
    };
    this.emit(event);
  }

  /**
   * Aplica un ChangeSet atómico a un componente del Canvas (COUC-07).
   * Retorna `true` solo si el componente mutó y se emitió `canvas.mutation`.
   */
  public applyChangeSet(changeSet: CanvasChangeSet): boolean {
    const comp = this.components.get(changeSet.componentId);
    if (!comp) {
      console.warn(`[CanvasBridge] Componente ${changeSet.componentId} no encontrado para ChangeSet`);
      return false;
    }

    try {
      const clonedProps = JSON.parse(JSON.stringify(comp.props)) as Record<string, unknown>;

      if (changeSet.op === "replace") {
        if (typeof changeSet.newValue !== "object" || changeSet.newValue === null) {
          console.warn(`[CanvasBridge] ChangeSet ${changeSet.id}: replace requiere newValue objeto.`);
          return false;
        }
        comp.props = changeSet.newValue as typeof comp.props;
      } else if (changeSet.op === "update") {
        if (changeSet.path) {
          if (!setPathValue(clonedProps, changeSet.path, changeSet.newValue, true)) {
            console.warn(`[CanvasBridge] ChangeSet ${changeSet.id}: path '${changeSet.path}' no atravesable, nada aplicado.`);
            return false;
          }
          comp.props = clonedProps as typeof comp.props;
        } else if (typeof changeSet.newValue === "object" && changeSet.newValue !== null) {
          comp.props = { ...clonedProps, ...changeSet.newValue } as typeof comp.props;
        } else {
          console.warn(`[CanvasBridge] ChangeSet ${changeSet.id}: update sin path requiere newValue objeto.`);
          return false;
        }
      } else if (changeSet.op === "insert") {
        if (changeSet.path) {
          if (!setPathValue(clonedProps, changeSet.path, changeSet.newValue, true)) {
            return false;
          }
          comp.props = clonedProps as typeof comp.props;
        } else if (typeof changeSet.newValue === "object" && changeSet.newValue !== null) {
          comp.props = { ...clonedProps, ...changeSet.newValue } as typeof comp.props;
        } else {
          console.warn(`[CanvasBridge] ChangeSet ${changeSet.id}: insert sin path requiere newValue objeto.`);
          return false;
        }
      } else if (changeSet.op === "delete") {
        if (!changeSet.path) {
          console.warn(
            `[CanvasBridge] ChangeSet ${changeSet.id}: delete sin path no elimina componentes; usar removeComponent().`
          );
          return false;
        }
        if (!deletePathValue(clonedProps, changeSet.path)) {
          console.warn(`[CanvasBridge] ChangeSet ${changeSet.id}: path '${changeSet.path}' inexistente, nada que eliminar.`);
          return false;
        }
        comp.props = clonedProps as typeof comp.props;
      }

      this.components.set(comp.id, comp);

      const event: CanvasMutationEvent = {
        type: "canvas.mutation",
        changeSet,
        timestamp: Date.now(),
      };
      this.emit(event);
      return true;
    } catch (err) {
      console.error(`[CanvasBridge] Fallo al aplicar ChangeSet ${changeSet.id}:`, err);
      return false;
    }
  }

  /**
   * Inyecta o actualiza un manifiesto emitido desde el Chat o un Sub-Ego
   */
  public injectComponent(manifest: CanvasComponentManifest): void {
    this.components.set(manifest.id, manifest);
    const event: CanvasInjectEvent = {
      type: "canvas.inject",
      manifest,
      timestamp: Date.now(),
    };
    this.emit(event);
  }

  /**
   * Elimina un componente de la superficie de trabajo
   */
  public removeComponent(componentId: string): void {
    if (this.components.has(componentId)) {
      this.components.delete(componentId);
      const event: CanvasRemoveEvent = {
        type: "canvas.remove",
        componentId,
        timestamp: Date.now(),
      };
      this.emit(event);
    }
  }

  /**
   * Notifica enfoque contextual (celda, texto, fila) para alimentar el River de Chat
   */
  public focusComponent(componentId: string, contextExcerpt?: string): void {
    this.focusedContext = { componentId, excerpt: contextExcerpt };
    const event: CanvasFocusEvent = {
      type: "canvas.focus",
      componentId,
      contextExcerpt,
      timestamp: Date.now(),
    };
    this.emit(event);
  }

  public getFocusedContext(): { componentId: string; excerpt?: string } | null {
    return this.focusedContext;
  }
}

/**
 * Asigna `value` en `root` siguiendo un path punteado.
 * Con `create=true` genera intermedios ausentes (semántica legacy de update).
 * Retorna `false` si un intermedio existe pero no es objeto (nada se mutó).
 */
function setPathValue(
  root: Record<string, unknown>,
  path: string,
  value: unknown,
  create: boolean
): boolean {
  const parts = path.split(".");
  let current: Record<string, unknown> = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const next = current[key];
    if (next === undefined) {
      if (!create) return false;
      const fresh: Record<string, unknown> = {};
      current[key] = fresh;
      current = fresh;
    } else if (typeof next === "object" && next !== null) {
      current = next as Record<string, unknown>;
    } else {
      return false;
    }
  }
  current[parts[parts.length - 1]] = value;
  return true;
}

/**
 * Elimina la hoja de un path punteado. Retorna `false` si el path no existe
 * (nada se mutó) — el llamador debe reportar `false` + `warn`.
 */
function deletePathValue(root: Record<string, unknown>, path: string): boolean {
  const parts = path.split(".");
  let current: Record<string, unknown> = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = current[parts[i]];
    if (typeof next !== "object" || next === null) return false;
    current = next as Record<string, unknown>;
  }
  const leaf = parts[parts.length - 1];
  if (!(leaf in current)) return false;
  delete current[leaf];
  return true;
}
