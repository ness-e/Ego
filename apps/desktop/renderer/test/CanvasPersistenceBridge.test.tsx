import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  useCanvasBridge,
  resetSharedCanvasBridge,
} from "../hooks/useCanvasBridge";
import { CanvasPersistenceManager } from "@ego/ui-runtime";
import type { CanvasComponentManifest } from "@ego/ui-runtime";

const SEEDED_CARD: CanvasComponentManifest = {
  id: "comp-seeded-1",
  type: "card",
  metadata: {
    timestamp: 1728518400000,
    generatedBy: "ego.nucleus",
    why: { vantaSources: ["projects/persist-proj/init"], directCause: "Restore de prueba" },
  },
  props: { id: "c-seed", title: "Tarjeta Restaurada", description: "Desde VantaDB", actions: [] },
};

const INJECTED_CARD: CanvasComponentManifest = {
  id: "comp-injected-1",
  type: "card",
  metadata: {
    timestamp: 1728518400000,
    generatedBy: "ego.developer",
    why: { vantaSources: ["projects/persist-proj/new"], directCause: "Inyección de prueba" },
  },
  props: { id: "c-new", title: "Tarjeta Inyectada", description: "Inyectada en test", actions: [] },
};

function PersistenceTester({ onReady }: { onReady: (api: { inject: () => void }) => void }) {
  const { components, injectComponent } = useCanvasBridge({
    projectId: "persist-proj",
    persistence: { debounceMs: 0 },
  });
  React.useEffect(() => {
    onReady({ inject: () => injectComponent(INJECTED_CARD) });
  }, [onReady, injectComponent]);
  return (
    <div>
      {components.map((c) => (
        <div key={c.id} data-testid={`comp-${c.id}`}>{(c.props as { title?: string }).title}</div>
      ))}
    </div>
  );
}

describe("T04: useCanvasBridge persiste a VantaDB vía ego().memory()", () => {
  let container: HTMLDivElement;
  let root: Root;
  let memoryMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetSharedCanvasBridge();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    memoryMock = vi.fn(async () => ({ ok: true, mock: true }));
    (window as unknown as { ego: unknown }).ego = { memory: memoryMock };
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    resetSharedCanvasBridge();
    delete (window as unknown as { ego?: unknown }).ego;
    vi.restoreAllMocks();
  });

  it("persiste el canvas al mutar (inyectar → put a la clave canónica)", async () => {
    let api: { inject: () => void } | null = null;
    await act(async () => {
      root.render(<PersistenceTester onReady={(a) => { api = a; }} />);
    });
    memoryMock.mockClear();

    await act(async () => {
      api!.inject();
      await new Promise((r) => setTimeout(r, 10));
    });

    const puts = memoryMock.mock.calls.filter((c) => c[0] === "put");
    expect(puts.length).toBeGreaterThan(0);
    const item = puts[0][1][0] as { namespace: string; key: string; payload: { data: string } };
    expect(item.namespace).toBe("projects/persist-proj");
    expect(item.key).toBe(CanvasPersistenceManager.getVantaKey("persist-proj"));
    expect(item.payload.data).toContain("comp-injected-1");
    expect(container.textContent).toContain("Tarjeta Inyectada");
  });

  it("restaura el canvas al montar (reload bridge → sobrevive)", async () => {
    const state = CanvasPersistenceManager.workspaceStateFrom([SEEDED_CARD], "persist-proj");
    const serialized = CanvasPersistenceManager.serialize(state);
    memoryMock.mockImplementation(async (op: string) => {
      if (op === "get") {
        return {
          key: CanvasPersistenceManager.getVantaKey("persist-proj"),
          payload: { data: serialized },
          metadata: { type: "canvas_state", version: 1 },
        };
      }
      return { ok: true, mock: true };
    });

    await act(async () => {
      root.render(<PersistenceTester onReady={() => {}} />);
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(memoryMock.mock.calls.some((c) => c[0] === "get")).toBe(true);
    expect(container.textContent).toContain("Tarjeta Restaurada");
  });

  it("sin projectId no toca memory (ruta legacy intacta)", async () => {
    function LegacyTester() {
      const { components } = useCanvasBridge();
      return <div data-testid="count">{components.length}</div>;
    }
    await act(async () => {
      root.render(<LegacyTester />);
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(memoryMock).not.toHaveBeenCalled();
  });
});
