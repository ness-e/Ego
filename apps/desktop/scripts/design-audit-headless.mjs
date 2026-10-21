/**
 * Auditoría de diseño — CAMINO DE RESCATE (Chromium headless).
 *
 * ## Por qué existe (Ola 4 · T3 · ítems 5.1 / 5.2 / G2)
 * La auditoría de diseño dependía del **compositor de `ego lite`**. Ese
 * compositor **puede dejar de producir frames**: la última corrida dio
 * 0/6 capturas por el compositor (no por los selectores), y no se había
 * reconfirmado en verde desde los últimos arreglos.
 *
 * "Reiniciar la app si deja de producir frames" **no es un plan**: es una
 * hopesa de que el siguiente arranque funcione. Este runner es el plan:
 *
 *   - no depende del compositor (Chromium headless vía Playwright),
 *   - comparte **el mismo spec, los mismos selectores y la misma
 *     medición** que el camino de referencia (`design-audit-spec.mjs`),
 *   - escribe el **mismo `report.json`**, con `runner: "headless"` para que
 *     nadie confunda una corrida de rescate con la de referencia,
 *   - y un fallo de arranque es un **exit 2 con el motivo**, nunca un
 *     "0/6" silencioso.
 *
 * ## Ejecución
 * ```
 * node apps/desktop/scripts/design-audit-headless.mjs
 * ```
 * Configuración por el MISMO JSON que usa el camino de ego lite
 * (`%TEMP%\ego-audit-config.json`): `url`, `dir`, `width`, `height`,
 * `timeoutMs`, `stepsFile`.
 *
 * Códigos de salida: 0 = sin infracciones · 1 = infracciones · 2 = fallo.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import {
  CONTRACT,
  MEASURE,
  DEFAULT_STEPS,
  resolveLocator,
  sampleScreenshotColors,
  colorsMatch,
  readDesignTokens,
  findTokenCollisions,
} from "./design-audit-spec.mjs";

const require = createRequire(import.meta.url);
const { readdirSync, existsSync: exists } = require("node:fs");
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * Resuelve Playwright.
 *
 * `playwright` vive en el STORE de pnpm, no está enlazado en
 * `apps/desktop/node_modules` → `require("playwright")` falla desde aquí.
 * Se buscan, por orden: el paquete enlazado, `playwright-core` (más ligero
 * y suficiente: nosotros pasan el `executablePath` del navegador) y, por
 * último, el directorio del store. Sin `pnpm install` (A7 es su dueño).
 */
function loadPlaywright() {
  const attempts = [];
  try {
    attempts.push(require("playwright"));
  } catch {
    /* no enlazado */
  }
  try {
    attempts.push(require("playwright-core"));
  } catch {
    /* no enlazado */
  }
  if (attempts.length > 0) return attempts[0];

  // Store de pnpm: `node_modules/.pnpm/playwright*@<ver>/node_modules/<pkg>`.
  const repoRoot = resolve(SCRIPT_DIR, "..", "..", "..");
  const store = join(repoRoot, "node_modules", ".pnpm");
  if (exists(store)) {
    for (const dir of readdirSync(store)) {
      if (!/^playwright(-core)?@/.test(dir)) continue;
      for (const pkg of ["playwright", "playwright-core"]) {
        const p = join(store, dir, "node_modules", pkg);
        if (!exists(p)) continue;
        try {
          attempts.push(require(p));
        } catch {
          /* siguiente candidato */
        }
      }
      if (attempts.length > 0) return attempts[0];
    }
  }
  throw new Error(
    "Playwright no está disponible (ni enlazado ni en el store de pnpm). " +
      "La auditoría necesita Chromium para el camino headless."
  );
}

const CONFIG_PATH = join(tmpdir(), "ego-audit-config.json");
const CFG = (() => {
  const base = {
    url: "http://127.0.0.1:5173/",
    dir: join(tmpdir(), "ego-audit"),
    stepsFile: null,
    width: 1512,
    height: 950,
    timeoutMs: 30000,
  };
  if (!existsSync(CONFIG_PATH)) return base;
  try {
    return { ...base, ...JSON.parse(readFileSync(CONFIG_PATH, "utf8")) };
  } catch {
    return base;
  }
})();

const OUT = resolve(CFG.dir);
const SHOTS = join(OUT, "shots");
mkdirSync(SHOTS, { recursive: true });

let spec = DEFAULT_STEPS;
if (CFG.stepsFile) {
  const p = resolve(CFG.stepsFile);
  if (existsSync(p)) spec = JSON.parse(readFileSync(p, "utf8"));
}

/** Timeout duro por operación (el mismo contrato que el camino de ego lite). */
function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timeout ${ms}ms en ${label}`)), ms);
    }),
  ]);
}

/** Localizadores de Chromium en esta máquina (sin descargar nada). */
function browserCandidates() {
  const out = [];
  const env = process.env.LOCALAPPDATA;
  const roots = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ];
  for (const r of roots) if (existsSync(r)) out.push({ name: r.split("/").slice(-2, -1)[0], path: r });
  if (env) {
    const pw = join(env, "ms-playwright");
    if (existsSync(pw)) {
      for (const d of ["chromium_headless_shell", "chromium"]) {
        const dir = join(pw, d);
        if (!existsSync(dir)) continue;
        const versions = readdirSafe(dir);
        for (const v of versions) {
          const exe = join(dir, v, "chrome-win", "headless_shell.exe");
          const exe2 = join(dir, v, "chrome-win", "chrome.exe");
          if (existsSync(exe)) out.push({ name: `${d}-${v}`, path: exe });
          else if (existsSync(exe2)) out.push({ name: `${d}-${v}`, path: exe2 });
        }
      }
    }
  }
  return out;
}

function readdirSafe(p) {
  try {
    return readdirSyncSafe(p);
  } catch {
    return [];
  }
}
function readdirSyncSafe(p) {
  // eslint-disable-next-line no-undef
  return require("node:fs").readdirSync(p);
}

const report = {
  runner: "headless",
  compositor: "n/a — Chromium headless (no depende de ego lite)",
  startedAt: new Date().toISOString(),
  url: CFG.url,
  out: OUT,
  shots: SHOTS,
  steps: [],
  measurements: [],
  errors: [],
  window: { maximized: false, reason: "headless: no hay ventana de sistema" },
  viewportForced: false,
};

let browser = null;

/**
 * Los tokens esperados (fuente única: el `DesignSystemProvider`).
 *
 * La auditoría compara el color REALMENTE pintado con el token esperado, y
 * comprueba que dos tokens que deben ser distinguibles (p. ej. `brand` y
 * `warning`) no tienen el MISMO color: esa colisión es el hueco que dejó
 * pasar la auditoría anterior (el icono de dominio salía idéntico).
 */
const expectedTokens = (() => {
  try {
    const provider = join(
      SCRIPT_DIR,
      "..",
      "renderer",
      "components",
      "canvas",
      "DesignSystemProvider.tsx"
    );
    return readDesignTokens(readFileSync(provider, "utf8"), "default-dark");
  } catch {
    return {};
  }
})();

try {
  const { chromium } = loadPlaywright();
  const candidates = browserCandidates();
  let launchError = null;
  for (const c of candidates) {
    try {
      browser = await chromium.launch({
        headless: true,
        executablePath: c.path,
        args: ["--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1"],
      });
      report.browser = c.name;
      break;
    } catch (err) {
      launchError = err;
    }
  }
  if (!browser && !launchError) {
    // Sin ejecutable propio: deja que Playwright use su Chromium descargado.
    browser = await chromium.launch({ headless: true });
    report.browser = "playwright-chromium";
  }
  if (!browser) throw launchError ?? new Error("no hay Chromium disponible");

  const context = await browser.newContext({
    viewport: { width: CFG.width, height: CFG.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  report.viewportForced = true;

  await withTimeout(
    page.goto(CFG.url, { waitUntil: "domcontentloaded", timeout: CFG.timeoutMs }),
    CFG.timeoutMs,
    "goto"
  );
  // El canal HMR de Vite impide el evento `load`: se espera al DOM.
  await withTimeout(page.waitForTimeout(1200), CFG.timeoutMs, "settle");

  for (const step of spec.steps || []) {
    const rec = { id: step.id, ok: true, note: step.note || null, errors: [] };
    try {
      if (step.click) {
        const loc = resolveLocator(page, step.click);
        if (loc) {
          await withTimeout(loc.first().click({ timeout: CFG.timeoutMs }), CFG.timeoutMs, `click ${step.click}`);
        } else {
          await withTimeout(page.click(step.click, { timeout: CFG.timeoutMs }), CFG.timeoutMs, `click ${step.click}`);
        }
      }
      if (step.key) {
        await withTimeout(page.keyboard.press(step.key), CFG.timeoutMs, `key ${step.key}`);
      }
      if (step.wait) {
        await withTimeout(page.waitForTimeout(step.wait), CFG.timeoutMs, `wait ${step.wait}`);
      }
      if (step.shot !== false) {
        const path = join(SHOTS, `${step.id}.png`).replace(/\\/g, "/");
        const buffer = await page.screenshot({ path });
        rec.screenshot = path;

        // Ola 5 · T4: MEDICIÓN DE COLOR. Se leen los píxeles REALES de la
        // captura (no los estilos calculados) y se comparan con el token
        // esperado: la app debe PINTAR el token, no parecerse a él.
        try {
          const sampled = await sampleScreenshotColors(page, buffer);
          rec.color = {
            dominant: sampled.dominant,
            corner: sampled.corner,
            palette: (sampled.palette ?? []).slice(0, 5),
          };
          if (expectedTokens.paper) {
            const matches = colorsMatch(sampled.corner, expectedTokens.paper);
            rec.color.matchesPaper = matches;
            if (!matches) {
              rec.ok = false;
              const msg =
                `El fondo renderizado (${sampled.corner}) NO es el token 'paper' ` +
                `(${expectedTokens.paper}): la app no pinta el token.`;
              rec.errors.push(msg);
              report.errors.push(`${step.id}: ${msg}`);
            }
          }
        } catch (err) {
          rec.color = { error: String(err && err.message) };
        }
      }
      if (step.measure !== false) {
        const m = await withTimeout(page.evaluate(MEASURE, CONTRACT), CFG.timeoutMs, `measure ${step.id}`);
        rec.measurement = m.counts;
        report.measurements.push({ id: step.id, ...m });
      }
    } catch (err) {
      // Un paso fallido se REGISTRA y se CONTINÚA (mismo contrato que el
      // camino de ego lite): la auditoría parcial vale más que un aborto.
      rec.ok = false;
      rec.errors.push(String(err && err.message));
      report.errors.push(`${step.id}: ${err && err.message}`);
    }
    report.steps.push(rec);
  }

  const totalViolations = report.measurements.reduce((n, m) => n + (m.counts?.violations || 0), 0);
  const byRule = {};
  for (const m of report.measurements) {
    for (const [rule, list] of Object.entries(m.byRule || {})) {
      byRule[rule] = (byRule[rule] || 0) + list.length;
    }
  }

  // Ola 5 · T4: colisiones de color entre tokens que deben ser
  // distinguibles (`brand` ≡ `warning` era el caso real).
  const collisions = findTokenCollisions(expectedTokens);
  report.tokenCollisions = collisions;
  if (collisions.length > 0) {
    for (const c of collisions) {
      report.errors.push(
        `Colisión de color: '${c.a}' y '${c.b}' tienen el MISMO RGB (${c.rgb.join(",")}). ` +
          `Un icono de '${c.a}' es indistinguible de uno de '${c.b}'.`
      );
    }
    byRule["COLOR_COLISION"] = collisions.length;
  }

  report.summary = {
    totalViolations: totalViolations + collisions.length,
    byRule,
    stepsOk: report.steps.filter((s) => s.ok).length,
    stepsTotal: report.steps.length,
  };
  report.exitCode = report.summary.totalViolations > 0 ? 1 : 0;

  writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2), "utf8");

  console.log(`[audit] runner: headless (${report.browser})`);
  console.log(`[audit] ${report.summary.stepsOk}/${report.summary.stepsTotal} pasos ok`);
  console.log(`[audit] infracciones: ${totalViolations} ${JSON.stringify(byRule)}`);
  console.log(`[audit] informe: ${join(OUT, "report.json")}`);
  console.log(`[audit] capturas: ${SHOTS}`);
  process.exitCode = report.exitCode;
} catch (err) {
  console.error("[audit] fallo del arnés headless:", err && err.stack ? err.stack : err);
  report.errors.push(String(err && err.message));
  report.exitCode = 2;
  try {
    writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2), "utf8");
  } catch {
    /* best-effort */
  }
  process.exitCode = 2;
} finally {
  try {
    if (browser) await browser.close();
  } catch {
    /* best-effort */
  }
}
