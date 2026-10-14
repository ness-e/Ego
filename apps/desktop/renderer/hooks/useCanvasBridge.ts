import { useState, useEffect, useRef, useCallback } from "react";
import {
  CanvasBridge,
  CanvasPersistenceManager,
  type CanvasComponentManifest,
  type CanvasChangeSet,
  type CanvasActionEvent,
  type CanvasFocusEvent,
} from "@ego/ui-runtime";
import { ego } from "../lib/ego";

// Instancia compartida por sesión para mantener sincronización entre River de Chat y Canvas
let sharedCanvasBridge: CanvasBridge | null = null;

export function getSharedCanvasBridge(initial?: CanvasComponentManifest[]): CanvasBridge {
  if (!sharedCanvasBridge) {
    sharedCanvasBridge = new CanvasBridge(initial || []);
  }
  return sharedCanvasBridge;
}

export function resetSharedCanvasBridge(initial?: CanvasComponentManifest[]): CanvasBridge {
  sharedCanvasBridge = new CanvasBridge(initial || []);
  return sharedCanvasBridge;
}

export interface UseCanvasBridgeOptions {
  initialComponents?: CanvasComponentManifest[];
  /**
   * Activa persistencia + restore vía `ego().memory()` (gateway único a VantaDB).
   * Sin `projectId` el hook es puramente local (ruta legacy, cero efectos).
   */
  projectId?: string;
  persistence?: {
    enabled?: boolean;
    /** Debounce trailing del guardado (defecto 400ms; 0 en tests) */
    debounceMs?: number;
  };
}

export function useCanvasBridge(options: UseCanvasBridgeOptions = {}) {
  const bridgeRef = useRef<CanvasBridge>(getSharedCanvasBridge(options.initialComponents));
  const bridge = bridgeRef.current;
  const { projectId, persistence } = options;
  // T04: persistencia opt-in por projectId (sin projectId = comportamiento legacy idéntico)
  const persistEnabled = persistence?.enabled ?? (projectId !== undefined && projectId !== "");
  const debounceMs = persistence?.debounceMs ?? 400;
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const debounceMsRef = useRef(debounceMs);
  debounceMsRef.current = debounceMs;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistNow = useCallback(() => {
    const pid = projectIdRef.current;
    if (!pid) return;
    try {
      const state = CanvasPersistenceManager.workspaceStateFrom(
        bridge.getComponents(),
        pid,
        bridge.getFocusedContext()?.componentId ?? null
      );
      const store = {
        put: (item: { namespace: string; key: string; payload: unknown; metadata?: Record<string, unknown> }) =>
          ego().memory("put", [item]),
        get: (namespace: string, key: string) => ego().memory("get", [namespace, key]),
      };
      void CanvasPersistenceManager.save(store, pid, state).catch((err) => {
        console.warn("[useCanvasBridge] No se pudo persistir el Canvas:", err);
      });
    } catch (err) {
      console.warn("[useCanvasBridge] No se pudo serializar el Canvas:", err);
    }
  }, [bridge]);

  const schedulePersist = useCallback(() => {
    if (!persistEnabled) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      persistNow();
    }, debounceMsRef.current);
  }, [persistEnabled, persistNow]);

  const [components, setComponents] = useState<CanvasComponentManifest[]>(() =>
    bridge.getComponents()
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedContext, setFocusedContext] = useState<{
    componentId: string;
    excerpt?: string;
  } | null>(() => bridge.getFocusedContext());

  useEffect(() => {
    // Sincronizar estado React ante cualquier mutación o inyección en el bridge
    const unsubWildcard = bridge.on("*", () => {
      setComponents(bridge.getComponents());
      setFocusedContext(bridge.getFocusedContext());
      // T04: toda mutación agenda persistencia (inyectar → sobrevive al reload)
      schedulePersist();
    });

    return () => {
      unsubWildcard();
    };
  }, [bridge, schedulePersist]);

  // T04: restore al montar — rehidrata el bridge desde VantaDB si hay estado
  // guardado con componentes (vacío/corrupto/ausente = se conservan iniciales, nunca wipe)
  useEffect(() => {
    if (!persistEnabled) return;
    const pid = projectIdRef.current;
    if (!pid) return;
    let cancelled = false;
    const store = {
      put: (item: { namespace: string; key: string; payload: unknown; metadata?: Record<string, unknown> }) =>
        ego().memory("put", [item]),
      get: (namespace: string, key: string) => ego().memory("get", [namespace, key]),
    };
    void CanvasPersistenceManager.load(store, pid)
      .then((restored) => {
        if (cancelled || !restored || restored.components.length === 0) return;
        for (const manifest of restored.components) {
          bridge.injectComponent(manifest);
        }
        if (restored.selectedComponentId) {
          bridge.focusComponent(restored.selectedComponentId);
        }
      })
      .catch((err) => {
        console.warn("[useCanvasBridge] No se pudo restaurar el Canvas:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [bridge, persistEnabled]);

  // Flush de persistencia pendiente al desmontar
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        persistNow();
      }
    };
  }, [persistNow]);

  const dispatchAction = useCallback(
    (componentId: string, actionId: string, payload?: Record<string, unknown>) => {
      bridge.dispatchAction(componentId, actionId, payload);
    },
    [bridge]
  );

  const applyChangeSet = useCallback(
    (changeSet: CanvasChangeSet) => {
      return bridge.applyChangeSet(changeSet);
    },
    [bridge]
  );

  const injectComponent = useCallback(
    (manifest: CanvasComponentManifest) => {
      bridge.injectComponent(manifest);
    },
    [bridge]
  );

  const removeComponent = useCallback(
    (componentId: string) => {
      bridge.removeComponent(componentId);
    },
    [bridge]
  );

  const focusComponent = useCallback(
    (componentId: string, contextExcerpt?: string) => {
      setSelectedId(componentId);
      bridge.focusComponent(componentId, contextExcerpt);
    },
    [bridge]
  );

  const onAction = useCallback(
    (listener: (ev: CanvasActionEvent) => void) => {
      return bridge.on("canvas.action", listener);
    },
    [bridge]
  );

  const onFocus = useCallback(
    (listener: (ev: CanvasFocusEvent) => void) => {
      return bridge.on("canvas.focus", listener);
    },
    [bridge]
  );

  return {
    bridge,
    components,
    selectedId,
    focusedContext,
    setSelectedId,
    dispatchAction,
    applyChangeSet,
    injectComponent,
    removeComponent,
    focusComponent,
    onAction,
    onFocus,
  };
}
