import { useState, useEffect, useCallback } from "react";
import { useCanvasBridge } from "./useCanvasBridge.js";

export interface SelectionState {
  text: string;
  rect: DOMRect | null;
  componentId?: string;
}

export function useSelectionContext() {
  const { focusComponent, bridge } = useCanvasBridge();
  const [selection, setSelection] = useState<SelectionState | null>(null);

  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setSelection(null);
      return;
    }

    const text = sel.toString().trim();
    if (text.length < 2) {
      setSelection(null);
      return;
    }

    // Verificar si la selección está dentro de un componente del Canvas
    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container instanceof Element ? container : container.parentElement;

    const componentElement = element?.closest("[data-component-id]");
    const componentId = componentElement?.getAttribute("data-component-id") || "canvas.unknown";

    const rect = range.getBoundingClientRect();

    setSelection({
      text,
      rect,
      componentId,
    });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [handleSelectionChange]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const sendSelectionToChat = useCallback(
    (customPrompt?: string) => {
      if (!selection) return;

      // Enfocar en el bridge contextual para que el river de Chat lo integre
      focusComponent(selection.componentId || "canvas.general", selection.text);

      // Despachar acción al chat
      bridge.dispatchAction(
        selection.componentId || "canvas.general",
        "chat.query_selection",
        {
          selection: selection.text,
          prompt: customPrompt,
        }
      );

      clearSelection();
    },
    [selection, focusComponent, bridge, clearSelection]
  );

  return {
    selection,
    sendSelectionToChat,
    clearSelection,
  };
}
