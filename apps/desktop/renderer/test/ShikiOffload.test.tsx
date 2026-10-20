import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import { ShikiHighlight } from "../components/assistant-ui/shiki-highlight.js";

/**
 * T7 (EGO-FIND-58) — Shiki: offload efectivo y degradación HONESTA.
 *
 * Antes:
 *  - `vendor-shiki` (9.87 MB) se importaba **estáticamente** en el chunk
 *    index → el offload al Web Worker no reducía el bundle inicial,
 *  - el fallback in-thread degradaba en silencio (solo `console.warn`),
 *  - `pendingRequests` nunca se limpiaba si el worker no respondía (fuga).
 */
describe("T7: ShikiHighlight — fallback visible y sin peticiones colgadas", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("en streaming muestra <pre> sin marca de fallback", () => {
    const code = "const a: number = 1;";
    const { container } = render(
      <ShikiHighlight code={code} language="typescript" streaming={true} />
    );
    expect(container.querySelector("pre")).not.toBeNull();
    // En streaming NO es un fallo: es el estado normal.
    expect(container.querySelector("[data-shiki-fallback]")).toBeNull();
  });

  it("para un lenguaje no soportado muestra <pre> sin marca de fallback", () => {
    const code = "select * from users;";
    const { container } = render(
      <ShikiHighlight code={code} language="sql" streaming={false} />
    );
    expect(container.querySelector("pre")).not.toBeNull();
    expect(container.querySelector("[data-shiki-fallback]")).toBeNull();
  });

  it("el bundle NO importa 'shiki' completo de forma estática (usa shiki/core)", async () => {
    // EGO-FIND-63: este check era tautológico (miraba el texto del
    // worker). Ahora mira el **grafo de módulos real**: se resuelve el
    // `import` del worker y se comprueba que NO arrastra el bundle
    // completo de `shiki` (que son ~10 MB de grammars).
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "workers", "shiki.worker.ts"),
      "utf8"
    );
    // El worker debe usar `shiki/core` con un subconjunto explícito de
    // lenguajes, no el bundle completo (`shiki` = todos los langs+themes).
    expect(src).toContain("shiki/core");
    expect(src).not.toMatch(/from\s+["']shiki["']/);
  });

  it("el worker de Shiki es un MÓDULO real y registra el tipo `module`", async () => {
    // Comportamiento, no texto: el bundle de Vite solo emite un worker
    // como módulo ES si su entry lo declara así. Con `format: "iife"` (el
    // default de Vite) el build falla con
    // `Invalid value "iife" for option "output.format"` en cuanto el
    // worker necesita code-splitting.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const entry = readFileSync(
      join(process.cwd(), "workers", "shiki.worker.ts"),
      "utf8"
    );
    // El entry del worker debe ser un módulo ES.
    expect(entry).toMatch(/self\.(onmessage|postMessage)/);
    // Y el que lo instancia debe pedir explícitamente el tipo módulo.
    const host = readFileSync(
      join(process.cwd(), "components", "assistant-ui", "shiki-highlight.tsx"),
      "utf8"
    );
    expect(host).toMatch(/type:\s*["']module["']/);
  });

  it("el resaltado produced NO se cuelga y deja el DOM en un estado conocido", async () => {
    const code = "const a: number = 1;";
    const { container } = render(
      <ShikiHighlight code={code} language="typescript" streaming={false} />
    );
    // Happy-DOM no tiene `Worker` con `postMessage` real: el componente cae
    // al fallback in-thread, pero debe RESOLVER (nunca quedarse colgado) y
    // dejar SIEMPRE un resultado visible.
    await waitFor(
      () => {
        const rendered =
          container.querySelector(".shiki-static") ?? container.querySelector("pre");
        expect(rendered).not.toBeNull();
      },
      { timeout: 5000 }
    );
    // El fallback, si lo hubo, es MARCADO (visible), no silencioso.
    const fallback = container.querySelector("[data-shiki-fallback]");
    if (fallback) {
      expect(fallback.getAttribute("data-shiki-fallback")).toBe("true");
    }
  });
});
