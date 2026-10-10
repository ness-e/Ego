import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  useCanvasBridge,
  resetSharedCanvasBridge,
} from "../hooks/useCanvasBridge";
import type { CanvasComponentManifest } from "@ego/ui-runtime";

const SAMPLE_COMPONENTS: CanvasComponentManifest[] = [
  {
    id: "comp-task-1",
    type: "card",
    metadata: {
      timestamp: 1728518400000,
      generatedBy: "ego.nucleus",
      why: { vantaSources: ["projects/test/1"], directCause: "Card de prueba" },
    },
    props: {
      id: "c1",
      title: "Tarea Inicial",
      description: "Hacer sync bidireccional",
    },
  },
];

function CanvasSyncTester({ onActionReceived }: { onActionReceived: (actionId: string) => void }) {
  const { components, focusedContext, focusComponent, dispatchAction, applyChangeSet, onAction } =
    useCanvasBridge({ initialComponents: SAMPLE_COMPONENTS });

  React.useEffect(() => {
    const unsub = onAction((act) => {
      onActionReceived(act.actionId);
    });
    return unsub;
  }, [onAction, onActionReceived]);

  return (
    <div>
      <div data-testid="component-title">{components[0]?.props.title}</div>
      {focusedContext && <div data-testid="focused-info">{focusedContext.componentId}</div>}
      <button data-testid="btn-focus" onClick={() => focusComponent("comp-task-1", "texto enfocado")}>
        Enfocar
      </button>
      <button data-testid="btn-action" onClick={() => dispatchAction("comp-task-1", "approve-task")}>
        Accionar
      </button>
      <button
        data-testid="btn-mutate"
        onClick={() =>
          applyChangeSet({
            id: "cs-1",
            componentId: "comp-task-1",
            timestamp: Date.now(),
            op: "update",
            path: "title",
            newValue: "Tarea Modificada en Vivo",
            origin: "user",
          })
        }
      >
        Mutar
      </button>
    </div>
  );
}

describe("CANV-03: Sincronización Bidireccional Chat <-> Canvas", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    resetSharedCanvasBridge(SAMPLE_COMPONENTS);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("debe notificar enfoque contextual de Canvas hacia el Chat", async () => {
    const onActionReceived = vi.fn();

    await act(async () => {
      root.render(<CanvasSyncTester onActionReceived={onActionReceived} />);
    });

    expect(container.querySelector('[data-testid="focused-info"]')).toBeNull();

    const btnFocus = container.querySelector('[data-testid="btn-focus"]') as HTMLButtonElement;
    await act(async () => {
      btnFocus.click();
    });

    const focusedInfo = container.querySelector('[data-testid="focused-info"]');
    expect(focusedInfo?.textContent).toBe("comp-task-1");
  });

  it("debe transmitir acciones del Canvas al Chat vía CanvasBridge", async () => {
    const onActionReceived = vi.fn();

    await act(async () => {
      root.render(<CanvasSyncTester onActionReceived={onActionReceived} />);
    });

    const btnAction = container.querySelector('[data-testid="btn-action"]') as HTMLButtonElement;
    await act(async () => {
      btnAction.click();
    });

    expect(onActionReceived).toHaveBeenCalledWith("approve-task");
  });

  it("debe aplicar ChangeSets y actualizar la vista reactivamente", async () => {
    const onActionReceived = vi.fn();

    await act(async () => {
      root.render(<CanvasSyncTester onActionReceived={onActionReceived} />);
    });

    const titleEl = container.querySelector('[data-testid="component-title"]');
    expect(titleEl?.textContent).toBe("Tarea Inicial");

    const btnMutate = container.querySelector('[data-testid="btn-mutate"]') as HTMLButtonElement;
    await act(async () => {
      btnMutate.click();
    });

    expect(titleEl?.textContent).toBe("Tarea Modificada en Vivo");
  });
});
