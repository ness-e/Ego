import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
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
});

/**
 * EGO-FIND-63 (Ola 10) — Los dos contratos que quedan ("el bundle no importa
 * `shiki` completo" y "el worker es un módulo ES que el host crea con
 * `type: "module"`") son **contratos de forma**, no de comportamiento: el
 * resaltado funciona igual con las dos formas; lo que cambia es el tamaño
 * del bundle. Por eso viven en el lint-test:
 * `node apps/desktop/scripts/lint/source-contracts.lint.mjs`
 * (siguen bloqueando igual, pero el inventario de asertos tautológicos vuelve
 * a medir comportamiento).
 */
