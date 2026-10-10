import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CanvasRuntime } from "../components/canvas/CanvasRuntime";
import { DesignSystemProvider, useDesignSystem } from "../components/canvas/DesignSystemProvider";
import type { CanvasComponentManifest } from "@ego/ui-runtime";

const TEST_MANIFESTS: CanvasComponentManifest[] = [
  {
    id: "test-card-1",
    type: "card",
    metadata: {
      timestamp: 1728518400000,
      generatedBy: "ego.nucleus",
      why: { vantaSources: ["projects/test/1"], directCause: "Prueba de tarjeta" },
    },
    props: {
      id: "card-1",
      title: "Tarjeta de Prueba",
      description: "Contenido de descripción de la tarjeta de prueba",
    },
  },
  {
    id: "test-table-1",
    type: "table",
    metadata: {
      timestamp: 1728518400000,
      generatedBy: "ego.developer",
      why: { vantaSources: ["projects/test/table"], directCause: "Auditoría" },
    },
    props: {
      id: "table-1",
      title: "Tabla de Telemetría",
      columns: [
        { key: "name", label: "Nombre", sortable: true },
        { key: "status", label: "Estado", type: "badge" },
      ],
      rows: [
        { name: "Alpha", status: "Activo" },
        { name: "Beta", status: "Inactivo" },
      ],
    },
  },
];

function ThemeTestHelper() {
  const { tokens, applyPreset } = useDesignSystem();
  return (
    <div>
      <span data-testid="current-theme-name">{tokens.name}</span>
      <button data-testid="btn-preset-cyan" onClick={() => applyPreset("midnight-cyan")}>
        Cyan
      </button>
    </div>
  );
}

describe("CANV-02: Canvas Generative Runtime & DesignSystemProvider", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  it("debe renderizar componentes declarativos desde los manifiestos", async () => {
    await act(async () => {
      root.render(
        <DesignSystemProvider>
          <CanvasRuntime projectId="test-proj" initialComponents={TEST_MANIFESTS} />
        </DesignSystemProvider>
      );
    });

    expect(container.textContent).toContain("Tarjeta de Prueba");
    expect(container.textContent).toContain("Tabla de Telemetría");
    expect(container.textContent).toContain("ego.nucleus");
    expect(container.textContent).toContain("ego.developer");
  });

  it("debe filtrar componentes según la categoría seleccionada", async () => {
    await act(async () => {
      root.render(
        <DesignSystemProvider>
          <CanvasRuntime projectId="test-proj" initialComponents={TEST_MANIFESTS} />
        </DesignSystemProvider>
      );
    });

    // Inicialmente se muestran ambos
    expect(container.textContent).toContain("Tarjeta de Prueba");
    expect(container.textContent).toContain("Tabla de Telemetría");

    // Click en filtro 'Métricas' (donde table y chart aparecen)
    const metricsBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Métricas"
    );
    expect(metricsBtn).toBeDefined();

    await act(async () => {
      metricsBtn?.click();
    });

    // La tabla sigue presente pero la card no
    expect(container.textContent).toContain("Tabla de Telemetría");
    expect(container.textContent).not.toContain("Tarjeta de Prueba");
  });

  it("debe aplicar presets de tokens e inyectar variables CSS en el elemento raíz", async () => {
    await act(async () => {
      root.render(
        <DesignSystemProvider>
          <ThemeTestHelper />
        </DesignSystemProvider>
      );
    });

    const themeName = container.querySelector('[data-testid="current-theme-name"]');
    expect(themeName?.textContent).toContain("Slate Oscuro");

    const rootElem = container.querySelector("#ego-design-system-root") as HTMLElement;
    expect(rootElem).not.toBeNull();
    expect(rootElem.style.getPropertyValue("--ego-color-bg")).toBe("#09090b");

    // Cambiar a preset Midnight Cyan
    const btnCyan = container.querySelector('[data-testid="btn-preset-cyan"]') as HTMLButtonElement;
    await act(async () => {
      btnCyan.click();
    });

    expect(themeName?.textContent).toContain("Medianoche Cyan");
    expect(rootElem.style.getPropertyValue("--ego-color-bg")).toBe("#030712");
    expect(rootElem.style.getPropertyValue("--ego-color-brand")).toBe("#06b6d4");
  });
});
