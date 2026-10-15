import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { RootErrorBoundary } from "../src/RootErrorBoundary.js";

function Thrower(): never {
  throw new Error("crash de prueba");
}

// STAB-08: migrado de createRoot+act+textContent+setTimeout a RTL por
// comportamiento. Queries en prioridad getByRole; espera async vía findBy.
describe("T08 UI-05: App shell + boundary global", () => {
  afterEach(() => {
    // Sin vi.restoreAllMocks(): el MockEgoBridge global de setup.ts usa
    // vi.fn().mockResolvedValue; restoreAllMocks les quitaría la
    // implementación y el 2º render de App reventaría en `.then`
    // (Sidebar:187, ego-chat:413, ActivityTray:122, App:122).
    // setup.ts ya hace vi.clearAllMocks() en beforeEach.
    cleanup();
  });

  it("renderiza chrome, chat, workspace y tabs", async () => {
    render(<App />);

    expect(await screen.findByText("Dynamic Workspace")).toBeTruthy();
    expect(screen.getByText("Ego")).toBeTruthy();
    const workspace = screen.getByRole("region", { name: /área de trabajo/i });
    for (const tab of ["Daily State", "Dominio", "Canvas", "Sub-Egos Fábrica"]) {
      expect(
        within(workspace).getByRole("button", { name: tab }),
      ).toBeTruthy();
    }
    expect(screen.getByRole("region", { name: "Chat" })).toBeTruthy();
  });

  it("omnibar montado global: Ctrl+K lo abre desde App", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.keyboard("{Control>}k{/Control}");

    const dialog = await screen.findByRole("dialog", { name: /búsqueda federada/i });
    expect(within(dialog).getByRole("search")).toBeTruthy();
    expect(
      within(dialog).getByRole("heading", { name: /búsqueda federada/i }),
    ).toBeTruthy();
  });

  it("Daily honesto: sin aprobaciones falsas appr-pending-init", async () => {
    render(<App />);

    await screen.findByText("Dynamic Workspace");
    expect(screen.queryByText("appr-pending-init")).toBeNull();
    expect(screen.queryByText(/Ejecución de mutación en filesystem/)).toBeNull();
  });

  it("RootErrorBoundary: captura crash y ofrece reintento", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(
        <RootErrorBoundary>
          <Thrower />
        </RootErrorBoundary>,
      );
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(/Reintentar/);
      expect(alert).toHaveTextContent(/crash de prueba/);
    } finally {
      errSpy.mockRestore();
    }
  });
});
