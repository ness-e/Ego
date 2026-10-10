import { useState, useEffect, useRef, useCallback } from "react";
import {
  CanvasBridge,
  type CanvasComponentManifest,
  type CanvasChangeSet,
  type CanvasActionEvent,
  type CanvasFocusEvent,
} from "@ego/ui-runtime";

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
}

export function useCanvasBridge(options: UseCanvasBridgeOptions = {}) {
  const bridgeRef = useRef<CanvasBridge>(getSharedCanvasBridge(options.initialComponents));
  const bridge = bridgeRef.current;

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
    });

    return () => {
      unsubWildcard();
    };
  }, [bridge]);

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
