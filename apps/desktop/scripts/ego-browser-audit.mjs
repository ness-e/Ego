#!/usr/bin/env node
/**
 * ego-browser-audit.mjs — Auditoría visual/diseño reproducible del renderer de Ego.
 *
 * ## POR QUÉ existe
 * Una auditoría hecha "a mano" con un navegador se degrada: la ventana
 * minimizada hace que `Page.captureScreenshot` expire, un paso que no
 * encuentra su objetivo se reintenta en bucle, y las pestañas abiertas se
 * acumulan hasta ensuciar el navegador del usuario. Este script sustituye al
 * bucle del agente por un **spec declarativo de pasos** con:
 *
 *   - ventana de ego lite **des-minimizada y maximizada** + viewport forzado
 *     (medidas estables, comparables entre corridas),
 *   - **timeout duro** en CADA operación (nunca se queda colgado),
 *   - un paso que falla se registra y se CONTINÚA (no aborta la auditoría),
 *   - **cierre del TaskSpace** al terminar (`task.finish({ keep: [] })`): no
 *     deja pestañas fantasma ni toca las del usuario,
 *   - salida determinista: `report.json` + capturas PNG en un directorio,
 *   - código de salida real en `report.json` (`exitCode`), leído por el wrapper.
 *
 * ## Cómo se ejecuta
 * NO con `node` plano: `taskSpace`/`help` son globales del runtime de
 * ego-browser, y ese runtime **no hereda `process.env`** del proceso padre
 * (la configuración viaja por un fichero JSON en `os.tmpdir()`).
 *
 * ```powershell
 * pnpm --filter @ego/desktop dev                       # el renderer debe servir
 * pwsh -File apps/desktop/scripts/run-design-audit.ps1 -Out C:\temp\ego-audit
 * ```
 *
 * ## LAS TRAMAS DE EGO-BROWSER (aprendidas a la fuerza)
 * 1. `page.screenshot()` expira con "CDP request timed out: Page.captureScreenshot"
 *    si la ventana está MINIMIZADA. Secuencia que sí funciona, en este orden:
 *      a) `await task.tabs()` → la pestaña cuyo `url` contiene el host
 *         ( **`page.targetId` es `undefined`**: hay que leerlo de la tab),
 *      b) `Browser.setWindowBounds` con `{ windowState: "normal" }`
 *         (des-minimizar; poner bounds explícitos NO basta),
 *      c) `Browser.setWindowBounds` con `{ windowState: "maximized" }`,
 *      d) `page.cdp("Emulation.setDeviceMetricsOverride", {...})` (viewport),
 *      e) AHORA sí, `page.screenshot({ path })`.
 *    Las rutas en Windows van con **barras normales**, no invertidas.
 * 2. `task.page(label)` NO crea páginas: sólo devuelve las existentes. Una
 *    corrida anterior que cerró `p1` deja el ledger con una página muerta
 *    ("page p1 was closed") → hay que usar `await task.newPage()`.
 * 3. `page.goto()` puede expirar esperando el evento `load`: el dev-server de
 *    Vite mantiene abierto el canal HMR. La navegación **sí** se confirma;
 *    hay que tolerar el timeout y comprobar `document.readyState`.
 * 4. `task.finish({ keep: [] })` cierra el espacio entero (y solo lo que el
 *    agente abrió). Es la ÚNICA forma de no dejar basura en el navegador.
 *
 * ## Spec de pasos (JSON)
 * ```json
 * { "steps": [
 *   { "id": "work", "click": "loc=role:button[name='Work']", "wait": 900 },
 *   { "id": "settings", "click": "loc=css:button[aria-label='Configuracion']", "wait": 600 }
 * ] }
 * ```
 * Campos: `id` (obligatorio, nombre de la captura) · `click` (selector) ·
 * `key` (tecla, p. ej. `ControlOrMeta+K`) · `wait` (ms) · `shot` (captura,
 * por defecto true) · `measure` (medir, por defecto true) · `note`.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { CONTRACT, MEASURE, DEFAULT_STEPS } from "./design-audit-spec.mjs";


/* ------------------------------------------------------------------ *
 * Configuración: el runtime embebido NO hereda process.env, así que el
 * wrapper escribe este JSON en os.tmpdir() y ambos lados calculan la misma
 * ruta con tmpdir() (mismo usuario ⇒ mismo valor).
 * ------------------------------------------------------------------ */
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

/**
 * Timeout duro. Sin esto, una operación que no resuelve (un overlay que no
 * aparece, un selector que no existe) deja el script colgado para siempre:
 * es exactamente el "ciclo sin avance" que motivó este arnés.
 */
function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timeout ${ms}ms en ${label}`)), ms);
    }),
  ]);
}

/* ------------------------------------------------------------------ *
 * Contrato de diseño (docs/design/design-system.md §1)
 * ------------------------------------------------------------------ */


/**
 * Medición dentro de la página. El callback NO puede cerrar variables del
 * script: todo lo que necesita entra por el argumento.
 */


/* ------------------------------------------------------------------ *
 * Spec por defecto: la app de Ego
 * ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ *
 * Programa
 * ------------------------------------------------------------------ */
let spec = DEFAULT_STEPS;
if (CFG.stepsFile) {
  const p = resolve(CFG.stepsFile);
  if (existsSync(p)) spec = JSON.parse(readFileSync(p, "utf8"));
  else {
    console.error(`[audit] no existe el spec de pasos: ${p}`);
    process.exitCode = 2;
  }
}

const report = {
  startedAt: new Date().toISOString(),
  url: CFG.url,
  viewport: { width: CFG.width, height: CFG.height },
  contract: CONTRACT,
  steps: [],
  measurements: [],
  errors: [],
  exitCode: 2,
};

const T = (p, label) => withTimeout(p, CFG.timeoutMs, label);
let task = null;

try {
  // --- 1) espacio de trabajo (NOMBRE ÚNICO por corrida) ---
  // `taskSpace(nombre)` reanuda el espacio con ese nombre, pero un espacio
  // ya finalizado pasa a "del usuario" y entonces la runtime se niega a
  // tomarlo sin permiso. Para un script de una sola pasada, un nombre
  // único por corrida evita el conflicto; `finish({keep:[]})` lo deja vacío.
  const spaceName = `ego design audit ${Date.now()}`;
  task = await T(taskSpace(spaceName), "taskSpace");
  report.spaceName = spaceName;

  // --- 2) página viva o nueva (`task.page()` no crea; `newPage()` sí) ---
  const managed = await T(task.pages(), "task.pages");
  const page = managed.length > 0 ? managed[0] : await T(task.newPage(), "newPage");
  report.pageLabel = page.label;

  // --- 3) navegación tolerante (el canal HMR de Vite impide el evento `load`) ---
  // Va ANTES de maximizar: hasta que la pestaña no existe, `task.tabs()` no
  // la encuentra y no hay targetId sobre el que maximizar la ventana.
  try {
    await T(page.goto(CFG.url), "goto");
  } catch (err) {
    report.errors.push(`goto (la navegación se confirmó; el 'load' no llegó por HMR): ${err && err.message}`);
  }
  try {
    await T(
      page.waitForFunction(() => document.readyState !== "loading", undefined, { timeout: 15000 }),
      "readyState",
    );
  } catch {
    report.errors.push("readyState: la página no llegó a 'interactive'");
  }
  await T(page.waitForTimeout(1500), "settle");

  // --- 4) des-minimizar + maximizar + viewport forzado ---
  // Orden CRÍTICO (ver la cabecera): sin `windowState:"normal"` la captura
  // expira. El `targetId` sale de `task.tabs()`, no de `page.targetId`.
  try {
    const host = new URL(CFG.url).host;
    const tabs = await T(task.tabs(), "task.tabs");
    report.tabsOpen = tabs.length;
    const mine = tabs.find((t) => t.url && t.url.includes(host) && t.openedBy !== "unknown");
    if (mine) {
      const win = await T(
        task.cdp("Browser.getWindowForTarget", { targetId: mine.targetId }),
        "getWindowForTarget",
      );
      const windowId = win?.windowId;
      await T(
        task.cdp("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } }),
        "setWindowBounds(normal)",
      );
      await T(
        task.cdp("Browser.setWindowBounds", { windowId, bounds: { windowState: "maximized" } }),
        "setWindowBounds(maximized)",
      );
      report.window = { maximized: true, windowId };
    } else {
      report.window = { maximized: false, reason: "ninguna pestaña con ese host" };
    }
  } catch (err) {
    report.window = { maximized: false, reason: String(err && err.message) };
  }

  try {
    await T(
      page.cdp("Emulation.setDeviceMetricsOverride", {
        width: CFG.width,
        height: CFG.height,
        deviceScaleFactor: 1,
        mobile: false,
      }),
      "setDeviceMetricsOverride",
    );
    report.viewportForced = true;
  } catch (err) {
    report.viewportForced = false;
    report.errors.push(`viewport: ${err && err.message}`);
  }

  await T(page.waitForTimeout(1200), "settle-2");

  // --- 5) los pasos ---
  for (const step of spec.steps || []) {
    const rec = { id: step.id, ok: true, note: step.note || null, errors: [] };
    try {
      if (step.click) await T(page.click(step.click), `click ${step.click}`);
      if (step.key) await T(page.keyboard.press(step.key), `key ${step.key}`);
      if (step.wait) await T(page.waitForTimeout(step.wait), `wait ${step.wait}`);
      if (step.shot !== false) {
        const path = join(SHOTS, `${step.id}.png`).replace(/\\/g, "/");
        // `page.screenshot()` es inestable cuando la ventana acaba de
        // maximizarse (expira el CDP request). La vía directa
        // `Page.captureScreenshot` es estable: se usa de reserva.
        let shot = null;
        try {
          shot = await T(page.screenshot({ path }), `shot ${step.id}`);
        } catch (err) {
          try {
            const raw = await T(
              page.cdp("Page.captureScreenshot", { format: "png" }),
              `cdp-shot ${step.id}`,
            );
            const b64 = raw && raw.data ? raw.data : null;
            if (b64) {
              writeFileSync(path, Buffer.from(b64, "base64"));
              shot = path;
            } else {
              throw err;
            }
          } catch (err2) {
            throw err2;
          }
        }
        rec.screenshot = typeof shot === "string" ? shot : shot?.path || path;
      }
      if (step.measure !== false) {
        const m = await T(page.evaluate(MEASURE, CONTRACT), `measure ${step.id}`);
        rec.measurement = m.counts;
        report.measurements.push({ id: step.id, ...m });
      }
    } catch (err) {
      // Un paso fallido se REGISTRA y se continúa: la auditoría parcial es
      // más útil que un aborto, y desde luego que un bucle infinito.
      rec.ok = false;
      rec.errors.push(String(err && err.message));
      report.errors.push(`${step.id}: ${err && err.message}`);
    }
    report.steps.push(rec);
  }

  // --- 6) informe ---
  const totalViolations = report.measurements.reduce((n, m) => n + (m.counts?.violations || 0), 0);
  const byRule = {};
  for (const m of report.measurements) {
    for (const [rule, list] of Object.entries(m.byRule || {})) {
      byRule[rule] = (byRule[rule] || 0) + list.length;
    }
  }
  report.summary = {
    totalViolations,
    byRule,
    stepsOk: report.steps.filter((s) => s.ok).length,
    stepsTotal: report.steps.length,
  };
  report.exitCode = totalViolations > 0 ? 1 : 0;

  // T3 (Ola 4): NINGUNA corrida sin mediciones es válida. Si el compositor
  // de ego lite no produjo frames (`Page.captureScreenshot` expira en los
  // 6 pasos), el informe decía "0 infracciones" y salía con 0 → un VERDE
  // FALSO que tapaba una app sin auditar. Ahora es un fallo explícito (2) y
  // el wrapper cae al camino de rescate (Chromium headless).
  if (report.summary.stepsOk === 0) {
    report.exitCode = 2;
    report.compositorDead = true;
    report.errors.push(
      "compositor sin frames: 0 pasos con capturas (Page.captureScreenshot agotó el tiempo). " +
        "La corrida NO es válida: usa el camino de rescate (Chromium headless)."
    );
    console.error(
      "[audit] el compositor no produjo ningún frame: la corrida no es válida (usa -Headless)."
    );
  }

  writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2), "utf8");

  console.log(`[audit] ${report.summary.stepsOk}/${report.summary.stepsTotal} pasos ok`);
  console.log(`[audit] infracciones: ${totalViolations} ${JSON.stringify(byRule)}`);
  console.log(`[audit] maximizada: ${report.window?.maximized} · viewport forzado: ${report.viewportForced} · pestañas abiertas: ${report.tabsOpen}`);
  console.log(`[audit] informe: ${join(OUT, "report.json")}`);
  console.log(`[audit] capturas: ${SHOTS}`);
  process.exitCode = report.exitCode;
} catch (err) {
  console.error("[audit] fallo del arnés:", err && err.stack ? err.stack : err);
  report.errors.push(String(err && err.message));
  try {
    writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2), "utf8");
  } catch {}
  process.exitCode = 2;
} finally {
  // Cierre: `task.finish({ keep: [] })` cierra el espacio y SOLO lo que el
  // agente abrió. Es la única forma de no dejar pestañas fantasma.
  try {
    if (task) await task.finish({ keep: [] });
  } catch {}
}
