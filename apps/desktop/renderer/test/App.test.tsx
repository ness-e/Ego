import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App } from "../src/App.js";
import { RootErrorBoundary } from "../src/RootErrorBoundary.js";

function Thrower(): never {
  throw new Error("crash de prueba");
}

describe("T08 UI-05: App shell + boundary global", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
  });

  const setup = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
  };

  it("renderiza chrome, chat, workspace resizable y tabs", async () => {
    await setup();
    expect(container.textContent).toContain("Ego");
    expect(container.textContent).toContain("Chat");
    expect(container.textContent).toContain("Dynamic Workspace");
    // SplitPane resizable montado (App.tsx:96, T06 + T08).
    expect(container.querySelector('[data-pane-id="app-sidebar"]')).toBeTruthy();
    for (const tab of ["Daily State", "Dominio", "Canvas", "Sub-Egos Fábrica"]) {
      expect(container.textContent).toContain(tab);
    }
  });

  it("omnibar montado global: Ctrl+K lo abre desde App", async () => {
    await setup();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
    });
    expect(document.body.textContent).toContain("Búsqueda federada");
  });

  it("Daily honesto: sin aprobaciones falsas appr-pending-init", async () => {
    await setup();
    expect(document.body.textContent).not.toContain("appr-pending-init");
    expect(container.textContent).not.toContain("Ejecución de mutación en filesystem");
  });

  it("RootErrorBoundary: captura crash y ofrece reintento", async () => {
    const errSpy = console.error;
    console.error = () => {};
    try {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
      await act(async () => {
        root.render(
          <RootErrorBoundary>
            <Thrower />
          </RootErrorBoundary>
        );
      });
      const alert = document.body.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain("Reintentar");
      expect(alert?.textContent).toContain("crash de prueba");
    } finally {
      console.error = errSpy;
    }
  });
});
