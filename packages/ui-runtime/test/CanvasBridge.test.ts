import { describe, it, expect, vi } from "vitest";
import { CanvasBridge, type CanvasChangeSet } from "../src/CanvasBridge.js";
import type { CanvasComponentManifest } from "../src/schemas/components.js";

const SAMPLE_CARD: CanvasComponentManifest = {
  id: "comp-card-1",
  type: "card",
  metadata: {
    timestamp: 1728518400000,
    generatedBy: "ego.nucleus",
    why: { vantaSources: ["projects/default/init"], directCause: "Init card" },
  },
  props: {
    id: "card-1",
    title: "Tarjeta Inicial",
    description: "Descripción original",
  },
};

describe("CANV-03: CanvasBridge — Protocolo Bidireccional Chat <-> Canvas", () => {
  it("debe inicializarse con componentes y permitir recuperarlos", () => {
    const bridge = new CanvasBridge([SAMPLE_CARD]);
    expect(bridge.getComponents().length).toBe(1);
    expect(bridge.getComponent("comp-card-1")?.props.title).toBe("Tarjeta Inicial");
  });

  it("debe despachar eventos canvas.action a suscriptores", () => {
    const bridge = new CanvasBridge([SAMPLE_CARD]);
    const listener = vi.fn();
    bridge.on("canvas.action", listener);

    bridge.dispatchAction("comp-card-1", "btn-refresh", { force: true });

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0];
    expect(event.type).toBe("canvas.action");
    expect(event.componentId).toBe("comp-card-1");
    expect(event.actionId).toBe("btn-refresh");
    expect(event.payload).toEqual({ force: true });
  });

  it("debe aplicar ChangeSets atómicos a las propiedades del componente (COUC-07)", () => {
    const bridge = new CanvasBridge([SAMPLE_CARD]);
    const mutationListener = vi.fn();
    bridge.on("canvas.mutation", mutationListener);

    const changeSet: CanvasChangeSet = {
      id: "cs-101",
      componentId: "comp-card-1",
      timestamp: Date.now(),
      op: "update",
      path: "title",
      previousValue: "Tarjeta Inicial",
      newValue: "Tarjeta Modificada por Sub-Ego",
      origin: "subego",
    };

    const ok = bridge.applyChangeSet(changeSet);
    expect(ok).toBe(true);

    const updated = bridge.getComponent("comp-card-1");
    expect(updated?.props.title).toBe("Tarjeta Modificada por Sub-Ego");
    expect(mutationListener).toHaveBeenCalledTimes(1);
  });

  it("debe gestionar el enfoque contextual para alimentar el Chat (canvas.focus)", () => {
    const bridge = new CanvasBridge([SAMPLE_CARD]);
    const focusListener = vi.fn();
    bridge.on("canvas.focus", focusListener);

    bridge.focusComponent("comp-card-1", "Texto seleccionado en la tarjeta");

    expect(focusListener).toHaveBeenCalledTimes(1);
    const event = focusListener.mock.calls[0][0];
    expect(event.componentId).toBe("comp-card-1");
    expect(event.contextExcerpt).toBe("Texto seleccionado en la tarjeta");

    expect(bridge.getFocusedContext()?.excerpt).toBe("Texto seleccionado en la tarjeta");
  });

  it("debe inyectar y remover componentes notificando a listeners", () => {
    const bridge = new CanvasBridge();
    const injectListener = vi.fn();
    const removeListener = vi.fn();
    bridge.on("canvas.inject", injectListener);
    bridge.on("canvas.remove", removeListener);

    bridge.injectComponent(SAMPLE_CARD);
    expect(bridge.getComponents().length).toBe(1);
    expect(injectListener).toHaveBeenCalledTimes(1);

    bridge.removeComponent("comp-card-1");
    expect(bridge.getComponents().length).toBe(0);
    expect(removeListener).toHaveBeenCalledTimes(1);
  });

  it("debe despachar a listeners comodín (*)", () => {
    const bridge = new CanvasBridge([SAMPLE_CARD]);
    const wildcardListener = vi.fn();
    bridge.on("*", wildcardListener);

    bridge.dispatchAction("comp-card-1", "action-1");
    bridge.focusComponent("comp-card-1");

    expect(wildcardListener).toHaveBeenCalledTimes(2);
  });
});
