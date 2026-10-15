import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CanvasRuntime } from "../components/canvas/CanvasRuntime";
import { DesignSystemProvider, useDesignSystem } from "../components/canvas/DesignSystemProvider";
import type { CanvasComponentManifest } from "@ego/ui-runtime";

// STAB-08: migrado de createRoot+act+querySelector a RTL por
// comportamiento. Sin vi.restoreAllMocks() (ver App.test.tsx).
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
      actions: [],
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
        { key: "name", label: "Nombre", type: "text", sortable: true },
        { key: "status", label: "Estado", type: "badge", sortable: false },
      ],
      rows: [
        { name: "Alpha", status: "Activo" },
        { name: "Beta", status: "Inactivo" },
      ],
      actions: [],
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
  afterEach(() => {
    cleanup();
  });

  it("renderiza componentes declarativos desde los manifiestos", async () => {
    render(
      <DesignSystemProvider>
        <CanvasRuntime projectId="test-proj" initialComponents={TEST_MANIFESTS} />
      </DesignSystemProvider>
    );

    expect(await screen.findByText("Tarjeta de Prueba")).toBeTruthy();
    expect(screen.getByText("Tabla de Telemetría")).toBeTruthy();
    expect(screen.getByText(/ego\.nucleus/)).toBeTruthy();
    expect(screen.getByText(/ego\.developer/)).toBeTruthy();
  });

  it("filtra componentes según la categoría seleccionada", async () => {
    const user = userEvent.setup();
    render(
      <DesignSystemProvider>
        <CanvasRuntime projectId="test-proj" initialComponents={TEST_MANIFESTS} />
      </DesignSystemProvider>
    );

    await screen.findByText("Tarjeta de Prueba");
    expect(screen.getByText("Tabla de Telemetría")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Métricas" }));

    expect(screen.getByText("Tabla de Telemetría")).toBeTruthy();
    expect(screen.queryByText("Tarjeta de Prueba")).toBeNull();
  });

  it("aplica presets de tokens e inyecta variables CSS en el elemento raíz", async () => {
    const user = userEvent.setup();
    render(
      <DesignSystemProvider>
        <ThemeTestHelper />
      </DesignSystemProvider>
    );

    expect(screen.getByTestId("current-theme-name")).toHaveTextContent(/Slate Oscuro/);

    const rootElem = document.querySelector("#ego-design-system-root") as HTMLElement;
    expect(rootElem).not.toBeNull();
    expect(rootElem.style.getPropertyValue("--ego-color-bg")).toBe("#09090b");

    await user.click(screen.getByTestId("btn-preset-cyan"));

    expect(screen.getByTestId("current-theme-name")).toHaveTextContent(/Medianoche Cyan/);
    expect(rootElem.style.getPropertyValue("--ego-color-bg")).toBe("#030712");
    expect(rootElem.style.getPropertyValue("--ego-color-brand")).toBe("#06b6d4");
  });
});
