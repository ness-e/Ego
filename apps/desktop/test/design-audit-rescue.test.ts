/**
 * T3 (Ola 4) — Verificación del **camino de rescate** de la auditoría de
 * diseño (Chromium headless) y de la MEDICIÓN que usa.
 *
 * ## Qué afirma
 * 1. La medición no marca como infracción un radio "full" (Tailwind v4
 *    define `rounded-full` como `calc(infinity * 1px)` → el navegador lo
 *    resuelve a 33554400 px: sin normalizar, CADA elemento redondeado del
 *    app era un falso positivo).
 * 2. La medición **sigue atrapando** un radio fuera de escala (2 px).
 * 3. La medición no marca comoatricción el texto `sr-only` (se recorta a
 *    propósito) pero **sí** marca un desbordamiento real.
 * 4. El camino de rescate arranca Chromium y produce capturas.
 *
 * ## Si no hay Chromium
 * El test se SALTA (no falla): en un entorno sin navegador no se puede
 * medir nada, y un fallo rojo por falta de navegador sería ruido. La
 * corrida del arnés (`run-design-audit.ps1`) es la que verifica el
 * caminho end-to-end.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import { CONTRACT, MEASURE } from "../scripts/design-audit-spec.mjs";
import { createScratchDir, removeScratchDir } from "./helpers/test-scratch.js";

const require = createRequire(import.meta.url);
const SCRIPT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** ¿Hay un Chromium en esta máquina? (sincrónico: decide el skip). */
function findChromium(): string | null {
  const roots = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ];
  for (const r of roots) if (existsSync(r)) return r;
  const store = join(SCRIPT_DIR, "..", "..", "..", "node_modules", ".pnpm");
  if (existsSync(store)) {
    for (const dir of readdirSync(store)) {
      if (!/^playwright/.test(dir)) continue;
      const base = join(store, dir, "node_modules");
      for (const pkg of ["playwright", "playwright-core"]) {
        const p = join(base, pkg);
        if (!existsSync(p)) continue;
        try {
          return require(p).chromium.executablePath();
        } catch {
          /* siguiente */
        }
      }
    }
  }
  return null;
}

const CHROME = findChromium();
const SKIP = CHROME ? false : true;

let browser: { close: () => Promise<void> } | null = null;
let page: {
  evaluate: (fn: unknown, arg: unknown) => Promise<unknown>;
  screenshot: (opts: { path: string }) => Promise<Buffer>;
  setContent: (html: string) => Promise<void>;
} | null = null;

// El arranque de Chromium en una máquina cargada puede tardar más de 10 s
// (el default de vitest): el hook tiene su propio presupuesto.
beforeAll(async () => {
  if (SKIP) return;
  const { chromium } = require("playwright");
  browser = await chromium.launch({ headless: true, executablePath: CHROME! });
  page = await browser.newPage();
}, 120000);

afterAll(async () => {
  if (browser) await browser.close();
}, 120000);

describe.skipIf(SKIP)("T3 — el camino de rescate y la medición de la auditoría", () => {
  it("no marca un radio `full` (calc(infinity * 1px)) como infracción", async () => {
    await page!.setContent(
      `<!doctype html><html><body>
         <div id="pill" style="border-radius: calc(infinity * 1px); width:40px; height:20px;"></div>
       </body></html>`
    );
    const m = (await page!.evaluate(MEASURE, CONTRACT)) as {
      byRule: Record<string, unknown[]>;
    };
    expect(m.byRule["RADIO"] ?? []).toEqual([]);
  });

  it("SIGUE marcando un radio fuera de escala (2 px)", async () => {
    await page!.setContent(
      `<!doctype html><html><body>
         <div id="bad" style="border-radius: 2px; width:40px; height:20px;"></div>
       </body></html>`
    );
    const m = (await page!.evaluate(MEASURE, CONTRACT)) as {
      byRule: Record<string, Array<{ value: number }>>;
    };
    const radii = m.byRule["RADIO"] ?? [];
    expect(radii.length, "un radio de 2 px debe ser infracción").toBeGreaterThan(0);
    expect(radii.some((r) => r.value === 2)).toBe(true);
  });

  it("no marca el texto `sr-only` (recorte a propósito) pero sí un desbordamiento real", async () => {
    await page!.setContent(
      `<!doctype html><html><body style="margin:0">
         <div class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden">
           <p id="largo" style="width:1px;white-space:nowrap">texto muy largo que se desborda</p>
         </div>
         <div id="real" style="width:50px;white-space:nowrap">texto que se desborda de verdad</div>
       </body></html>`
    );
    const m = (await page!.evaluate(MEASURE, CONTRACT)) as {
      byRule: Record<string, Array<{ selector: string }>>;
    };
    const overflow = m.byRule["DESBORDE"] ?? [];
    expect(
      overflow.some((v) => v.selector.includes("sr-only") || v.selector.includes("largo")),
      "el texto `sr-only` se recorta a propósito: no es una infracción"
    ).toBe(false);
    expect(
      overflow.some((v) => v.selector.includes("real")),
      "un desbordamiento real sí debe ser infracción"
    ).toBe(true);
  });

  it("marca un hijo EN FLUJO que se sale, pero no a un hijo ABSOLUTO (halo/badge)", async () => {
    // El caso real que encontró la auditoría: la cabecera de la sección de
    // proyectos del Sidebar sacaba su botón `+` 4 px fuera de la caja con
    // un margen negativo (`-mr-3`) → INFLUJO → defecto real.
    // Y el halo `animate-ping` (absoluto) se sale 4 px de su caja → es un
    // adorno que se pinta encima → NO es un defecto de layout.
    await page!.setContent(
      `<!doctype html><html><body style="margin:0">
         <div id="flujo" style="width:100px">
           <div style="width:140px">contenido en flujo que se sale</div>
         </div>
         <div id="absoluto" style="width:100px;position:relative">
           <div style="position:absolute;left:0;top:0;width:140px;height:10px">halo</div>
         </div>
       </body></html>`
    );
    const m = (await page!.evaluate(MEASURE, CONTRACT)) as {
      byRule: Record<string, Array<{ selector: string }>>;
    };
    const overflow = m.byRule["DESBORDE"] ?? [];
    expect(
      overflow.some((v) => v.selector.includes("flujo")),
      "un hijo en flujo que se sale ES un defecto real"
    ).toBe(true);
    expect(
      overflow.some((v) => v.selector.includes("absoluto")),
      "un hijo absoluto (halo/badge) se pinta encima: no es un defecto de layout"
    ).toBe(false);
  });

  it("el camino de rescate captura una imagen (el informe no puede quedar vacío)", async () => {
    // El scratch se crea con el helper compartido (T-X1): el guard de
    // `t-x1-scratch.test.ts` exige que ningún test deje directorios sueltos
    // en `%TEMP%`.
    const dir = createScratchDir("audit-rescue");
    try {
      const path = join(dir, "shot.png");
      await page!.setContent("<!doctype html><html><body style='background:#111'><h1>ok</h1></body></html>");
      const buf = await page!.screenshot({ path });
      expect(buf.length, "la captura debe tener contenido").toBeGreaterThan(100);
      expect(existsSync(path)).toBe(true);
    } finally {
      removeScratchDir(dir);
    }
  });
});
