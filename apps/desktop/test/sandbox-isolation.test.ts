import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildCsp } from "../src/main.js";

/**
 * SEC-01 — Guard de regresión de Sandboxing y Context Isolation.
 * Auditoría mecánica: ambas BrowserWindows endurecidas, preload mínimo y
 * renderer sin APIs Node/VantaDB + CSP estricta. Si alguno falla, el
 * aislamiento se rompió y el veredicto SEC-01 pasa a FAIL.
 */
const ROOT = process.cwd();
const read = (rel: string): string =>
  readFileSync(join(ROOT, rel), "utf-8");

describe("@ego/desktop — SEC-01 sandboxing y context isolation", () => {
  it("main BrowserWindow exige sandbox + contextIsolation + sin nodeIntegration", () => {
    const main = read("src/main.ts");
    expect(main).toMatch(/sandbox:\s*true/);
    expect(main).toMatch(/contextIsolation:\s*true/);
    expect(main).toMatch(/nodeIntegration:\s*false/);
  });

  it("ventana flotante replica el endurecimiento (sandbox:true + preload)", () => {
    const floating = read("src/windows/FloatingWindowView.ts");
    expect(floating).toMatch(/nodeIntegration:\s*false/);
    expect(floating).toMatch(/contextIsolation:\s*true/);
    expect(floating).toMatch(/sandbox:\s*true/);
    expect(floating).toMatch(/preload:/);
  });

  it("preload solo expone window.ego vía contextBridge (sin require/node directo)", () => {
    const preload = read("src/preload.ts");
    expect(preload).toMatch(/contextBridge\.exposeInMainWorld\("ego"/);
    expect(preload).not.toMatch(/require\s*\(/);
    expect(preload).not.toMatch(/from\s+["']node:/);
    expect(preload).not.toMatch(/from\s+["'][^"']*vantadb/i);
    expect(preload).not.toMatch(/require\s*\([^)]*vantadb/i);
  });

  it("renderer sirve CSP estricta (script-src 'self', object-src 'none')", () => {
    const html = read("renderer/index.html");
    expect(html).toMatch(/http-equiv="Content-Security-Policy"/);
    expect(html).toMatch(/script-src 'self'/);
    expect(html).toMatch(/object-src 'none'/);
    expect(html).toMatch(/frame-ancestors 'none'/);
  });

  it("main aplica CSP estricta vía onHeadersReceived (R13/SEC-01)", () => {
    const main = read("src/main.ts");
    expect(main).toMatch(/onHeadersReceived/);
    expect(main).toMatch(/Content-Security-Policy/);
  });

  it("la CSP generada es estricta en modo empaquetado (R13/SEC-01)", () => {
    // T11: las directivas viven en `buildCsp()` (módulo de seguridad), no
    // inline en `main.ts`. Se verifica el COMPORTAMIENTO, no el texto.
    const csp = buildCsp(true);
    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).toMatch(/script-src 'self'/);
    expect(csp).toMatch(/object-src 'none'/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
    // T13: sin `img-src`/`frame-src` las imágenes remotas y los iframes
    // de terceros son vectores de exfiltración.
    expect(csp).toMatch(/img-src 'self' data: blob:/);
    expect(csp).toMatch(/frame-src 'self'/);
    // En dev se permite el dev-server local, pero nunca `object-src`.
    expect(buildCsp(false)).toMatch(/http:\/\/127\.0\.0\.1:5173/);
    expect(buildCsp(false)).toMatch(/object-src 'none'/);
  });

  it("renderer no importa APIs Node/VantaDB/Electron directas", () => {
    const bridge = read("renderer/lib/ego.ts");
    expect(bridge).not.toMatch(/require\s*\(/);
    expect(bridge).not.toMatch(/from\s+["']node:/);
    expect(bridge).not.toMatch(/from\s+["']electron["']/);
    expect(bridge).not.toMatch(/@ego\/memory/);
  });
});
