import { test as base, expect, type Page } from "@playwright/test";

// Helpers compartidos de la suite GUI (T22).
// El renderer degrada sin bridge `window.ego` (defaults locales con
// `.catch(() => {})` — ver renderer/src/App.tsx), así que los specs de
// shell corren contra `pnpm dev` pelado; lo que exige main/Electron real
// va en `test.describe.skip` con motivo documentado.

export const DEV_URL = "http://127.0.0.1:5173";

// Ruido propio de Vite dev que NO cuenta como "consola roja".
// STAB-11: el `frame-ancestors` del meta CSP de `renderer/index.html:12`
// lo ignora Chromium por diseño (solo vale en header HTTP) y lo reporta
// como console.error — ruido del navegador, no error de la app.
export const IGNORABLE_CONSOLE = [
  "@vite/client",
  "@react-refresh",
  "[vite]",
  "HMR",
  "React DevTools",
  "frame-ancestors",
];

/** Recolecta pageerrors + console.error (filtrando ruido Vite) del test. */
export async function collectPageErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e)}`));
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      !IGNORABLE_CONSOLE.some((p) => m.text().includes(p))
    ) {
      errors.push(`console.error: ${m.text()}`);
    }
  });
  return errors;
}

export { expect };
export const test = base;
