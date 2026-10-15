import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Omnibar, toOmnibarHits, OMNIBAR_CONFIDENCE_CUTOFF } from "../components/omnibar.js";
import { parseSlashCommand, extractMentions, LOCAL_SLASH_COMMANDS } from "../components/composer-slash.js";

// STAB-08: partes DOM migradas de createRoot+act+dispatchEvent a RTL por
// comportamiento (render/screen/user-event/getByRole). Las pruebas puras
// (toOmnibarHits/slash/menciones) no tocan el DOM y se conservan intactas.
// Sin vi.restoreAllMocks(): vaciaría el MockEgoBridge global de setup.ts.
describe("T08 UI-05: Omnibar federado + slash/menciones", () => {
  afterEach(() => {
    cleanup();
  });

  it("arranca cerrado y Ctrl+K lo abre con roles search/listbox", async () => {
    const user = userEvent.setup();
    render(<Omnibar />);

    expect(screen.queryByText(/búsqueda federada/i)).toBeNull();
    await user.keyboard("{Control>}k{/Control}");

    expect(await screen.findByRole("search")).toBeTruthy();
    expect(screen.getByRole("listbox", { name: /resultados/i })).toBeTruthy();
  });

  it("debouncea 250ms y llama a memory searchMulti con corte de confianza", async () => {
    const user = userEvent.setup();
    const bridge = window.ego as unknown as { memory: unknown };
    const originalMemory = bridge.memory;
    const memory = vi.fn().mockResolvedValue([
      { score: 0.94, record: { namespace: "kb/docs", key: "tarifa", payload: JSON.stringify({ titulo: "Tarifas 2026", contenido: "límite 150 USD/hora" }) } },
      { score: 0.1, record: { namespace: "kb/ruido", key: "spam", payload: "basura" } },
    ]);
    bridge.memory = memory;
    try {
      render(<Omnibar />);
      await user.keyboard("{Control>}k{/Control}");
      const input = await screen.findByRole("combobox", { name: /buscar en memoria/i });
      await user.type(input, "tarifa");

      await waitFor(() => expect(memory).toHaveBeenCalledWith("searchMulti", ["tarifa"]));
      expect(await screen.findByText("Tarifas 2026")).toBeTruthy();
      expect(screen.queryByText("basura")).toBeNull();
      expect(OMNIBAR_CONFIDENCE_CUTOFF).toBe(0.3);
    } finally {
      bridge.memory = originalMemory;
    }
  });

  it("Escape cierra el omnibar", async () => {
    const user = userEvent.setup();
    render(<Omnibar />);

    await user.keyboard("{Control>}k{/Control}");
    await screen.findByRole("search");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("search")).toBeNull();
  });

  it("toOmnibarHits: guarda de frontera ante payloads no-array o rotos", () => {
    expect(toOmnibarHits({ ok: true })).toEqual([]);
    expect(toOmnibarHits(null)).toEqual([]);
    expect(toOmnibarHits([{ score: 0.9, record: { namespace: "kb", key: "k", payload: "no-json {{{" } }])).toHaveLength(1);
    expect(toOmnibarHits([{ score: 0.29, record: { namespace: "kb", key: "k" } }])).toEqual([]);
  });

  it("slash: parsea /help y /clear como locales, otro texto como turno", () => {
    expect(parseSlashCommand("/help")?.name).toBe("help");
    expect(parseSlashCommand("  /CLEAR  ")?.name).toBe("clear");
    expect(LOCAL_SLASH_COMMANDS.has("help")).toBe(true);
    expect(parseSlashCommand("hola /help")).toBeNull();
    expect(parseSlashCommand("hola")).toBeNull();
  });

  it("menciones: extrae @rutas únicas en orden", () => {
    expect(extractMentions("revisá @src/app.ts y @src/app.ts más @docs/nota.md")).toEqual([
      "src/app.ts",
      "docs/nota.md",
    ]);
    expect(extractMentions('abrí @"mi archivo raro.ts" porfa')).toEqual(["mi archivo raro.ts"]);
    expect(extractMentions("sin menciones")).toEqual([]);
  });
});
