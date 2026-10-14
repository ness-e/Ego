// T10-Step-3 ítem 13: "tray colores" + extras del mismo ítem T10 —
// "mermaid lazy + virtua" y "build+test verdes tras Task 11" (T10.md:79).
// El tray es shell nativo de Electron (cero DOM) → skip honesto.
// Mermaid/virtua son renderer-side (lazy chunks + listas virtualizadas):
// ejecutable = navegar pestañas sin pageerrors. Build+test es contexto
// del checklist manual, no GUI: paso owner documentado, no spec falso.
import { test, expect, collectPageErrors } from "../fixtures/base.js";

test("tray-extras: navegar workspace no rompe lazy chunks (mermaid/virtua)", async ({
  page,
}) => {
  const errors = await collectPageErrors(page);
  const pageerrors: string[] = [];
  page.on("pageerror", (e) => pageerrors.push(String(e)));
  await page.goto("/");
  await expect(page.locator("#root")).toBeVisible();
  // Recorre las pestañas del workspace si existen como tabs.
  // CALIBRATE: nombres accesibles según primer run.
  for (const name of [/canvas/i, /daily/i, /dominios|domains/i]) {
    const tab = page.getByRole("tab", { name });
    if ((await tab.count()) > 0) {
      await tab.first().click();
      await expect(page.locator("#root")).toBeVisible();
    }
  }
  expect(pageerrors, `pageerror navegando: ${pageerrors.join("\n")}`).toEqual([]);
  expect(errors, `consola roja en extras: ${errors.join("\n")}`).toEqual([]);
});

test.describe.skip("requiere backend Electron vivo o shell nativo", () => {
  test("tray: icono refleja estado (colores) y menú responde", async () => {
    // Exige backend Electron real: el tray es shell NATIVO (fuera del
    // DOM, sin ventana). Playwright contra el renderer no puede verlo.
  });

  test("build+test verdes tras Task 11 (contexto del checklist, no GUI)", async () => {
    // Paso owner documentado, no automatizable como spec: `pnpm build` +
    // `pnpm test` ya verificados en T10 Steps 1-2 (T10.md:41-76). Se deja
    // aquí como skip trazable para que el checklist de 13 quede completo.
  });
});
