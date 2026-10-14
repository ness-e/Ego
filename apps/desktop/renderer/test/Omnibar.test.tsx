import { describe, it, expect, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Omnibar, toOmnibarHits, OMNIBAR_CONFIDENCE_CUTOFF } from "../components/omnibar.js";
import { parseSlashCommand, extractMentions, LOCAL_SLASH_COMMANDS } from "../components/composer-slash.js";

describe("T08 UI-05: Omnibar federado + slash/menciones", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalMemory: unknown;

  const setup = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    originalMemory = (window as unknown as { ego: { memory: unknown } }).ego.memory;
    await act(async () => {
      root.render(<Omnibar />);
    });
  };

  afterEach(async () => {
    (window as unknown as { ego: { memory: unknown } }).ego.memory = originalMemory as never;
    await act(async () => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
  });

  it("arranca cerrado y Ctrl+K lo abre con roles menu/option", async () => {
    await setup();
    expect(document.body.textContent).not.toContain("Búsqueda federada");
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
    });
    expect(document.body.textContent).toContain("Búsqueda federada");
    expect(document.body.querySelector('[role="search"]')).toBeTruthy();
    expect(document.body.querySelector('[role="listbox"]')).toBeTruthy();
  });

  it("debouncea 250ms y llama a memory searchMulti con corte de confianza", async () => {
    await setup();
    const memory = vi.fn().mockResolvedValue([
      { score: 0.94, record: { namespace: "kb/docs", key: "tarifa", payload: JSON.stringify({ titulo: "Tarifas 2026", contenido: "límite 150 USD/hora" }) } },
      { score: 0.1, record: { namespace: "kb/ruido", key: "spam", payload: "basura" } },
    ]);
    (window as unknown as { ego: { memory: unknown } }).ego.memory = memory;
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
    });
    const input = document.body.querySelector('input[aria-label="Buscar en memoria federada"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "tarifa");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 400));
    });
    expect(memory).toHaveBeenCalledWith("searchMulti", ["tarifa"]);
    expect(document.body.textContent).toContain("Tarifas 2026");
    // Bajo el corte 0.3 no se muestra.
    expect(document.body.textContent).not.toContain("basura");
    expect(OMNIBAR_CONFIDENCE_CUTOFF).toBe(0.3);
  });

  it("Escape cierra el omnibar", async () => {
    await setup();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
    });
    expect(document.body.textContent).toContain("Búsqueda federada");
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.body.textContent).not.toContain("Búsqueda federada");
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
