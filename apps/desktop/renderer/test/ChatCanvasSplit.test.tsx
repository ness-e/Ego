// T15 (EGO-FIND-62): el split Chat ↔ Canvas es redimensionable por el usuario.
//
// RED: hoy el panel de Chat tiene ancho FIJO (`w-[46%] min-w-[420px]
// max-w-[680px]`) cuando el workspace está abierto. El usuario no puede
// darle más espacio al chat ni al canvas: el reparto es del sistema, no
// suyo. Con un divisor `role="separator"` (WCAG 2.2 AA: operable por
// teclado, con valor expuesto) el reparto pasa a ser del usuario.
//
// Se REUTILIZA el primitive del proyecto `SplitPane` (persistencia en
// localStorage, límites elásticos, teclado) en vez de añadir una
// dependencia nueva: principio D3 del owner.
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";

describe("T15: split Chat ↔ Canvas redimensionable", () => {
  // El App completo se monta (y en el último test, dos veces): son renders
  // pesados. El timeout por defecto de vitest (5 s) es demasiado justo en
  // CI con carga, así que se sube explícitamente.
  const TIMEOUT_MS = 20_000;
  /** happy-dom no expone `localStorage` en este entorno: stub en memoria. */
  let mem: Map<string, string>;
  let prevLS: unknown;

  beforeEach(() => {
    mem = new Map();
    const stub = {
      getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
      setItem: (k: string, v: string) => {
        mem.set(k, String(v));
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
      clear: () => mem.clear(),
    };
    prevLS = (globalThis as unknown as { localStorage?: unknown }).localStorage;
    (globalThis as unknown as { localStorage?: unknown }).localStorage = stub;
  });

  afterEach(() => {
    cleanup();
    (globalThis as unknown as { localStorage?: unknown }).localStorage = prevLS;
  });

  /** Abre el workspace (el split solo existe con el canvas visible). */
  async function openWorkspace(user: ReturnType<typeof userEvent.setup>) {
    const toggle = screen.getByRole("button", { name: "Alternar panel de Workspace" });
    await user.click(toggle);
  }

  it("el panel de Chat expone un separador operable con valor", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Dynamic Workspace");
    await openWorkspace(user);

    const separators = screen.getAllByRole("separator");
    // Sidebar + Chat: el de la derecha es el divisor Chat ↔ Canvas.
    const chatSeparator = separators.find((s) =>
      (s.getAttribute("aria-label") ?? "").includes("app-chat")
    );
    expect(chatSeparator, "debe existir el separador del panel de chat").toBeTruthy();
    expect(chatSeparator?.getAttribute("aria-valuenow")).toBeTruthy();
    expect(chatSeparator?.getAttribute("aria-valuemin")).toBeTruthy();
    expect(chatSeparator?.getAttribute("aria-valuemax")).toBeTruthy();
    expect(chatSeparator?.getAttribute("tabindex")).toBe("0");
  }, TIMEOUT_MS);

  it("las flechas del teclado redimensionan el chat (WCAG 2.2 AA)", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Dynamic Workspace");
    await openWorkspace(user);

    const separators = screen.getAllByRole("separator");
    const chatSeparator = separators.find((s) =>
      (s.getAttribute("aria-label") ?? "").includes("app-chat")
    ) as HTMLElement;
    expect(chatSeparator).toBeTruthy();

    const before = Number(chatSeparator.getAttribute("aria-valuenow"));
    chatSeparator.focus();
    await user.keyboard("{ArrowRight}");
    const after = Number(chatSeparator.getAttribute("aria-valuenow"));
    expect(after, "ArrowRight debe ampliar el chat").toBeGreaterThan(before);
  }, TIMEOUT_MS);

  it("el ancho redimensionado persiste entre montajes", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Dynamic Workspace");
    await openWorkspace(user);

    let separators = screen.getAllByRole("separator");
    let chatSeparator = separators.find((s) =>
      (s.getAttribute("aria-label") ?? "").includes("app-chat")
    ) as HTMLElement;
    chatSeparator.focus();
    await user.keyboard("{ArrowRight}");
    const resized = Number(chatSeparator.getAttribute("aria-valuenow"));

    cleanup();
    render(<App />);
    await screen.findByText("Dynamic Workspace");
    await openWorkspace(user);
    separators = screen.getAllByRole("separator");
    chatSeparator = separators.find((s) =>
      (s.getAttribute("aria-label") ?? "").includes("app-chat")
    ) as HTMLElement;
    expect(Number(chatSeparator.getAttribute("aria-valuenow"))).toBe(resized);
  }, TIMEOUT_MS);
});
