// STAB-11 — 3 baselines visuales del shell (chromium, maxDiffPixelRatio 0.02).
//
// Corre contra vite dev (webServer propio de `visual.playwright.config.ts`):
// el renderer degrada sin bridge `window.ego` (defaults locales — ver
// fixtures/base.ts), así que los baselines capturan el shell degradado
// determinista, no datos del owner. Regenerar tras cambios de UI
// intencionales con `--update-snapshots` (y commitear el snapshot por-OS).
import { test, expect, collectPageErrors } from "../fixtures/base.js";

test.describe("visual: baselines del shell", () => {
  test("shell-full: página completa al arrancar", async ({ page }) => {
    const errors = await collectPageErrors(page);
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();
    await expect(page.getByText("Ego", { exact: true }).first()).toBeVisible();
    await expect(page).toHaveScreenshot("shell-full.png", { fullPage: true });
    expect(errors, `consola roja: ${errors.join("\n")}`).toEqual([]);
  });

  test("panel-chat: sección Chat", async ({ page }) => {
    await page.goto("/");
    const chat = page.locator('section[aria-label="Chat"]');
    await expect(chat).toBeVisible();
    await expect(chat).toHaveScreenshot("panel-chat.png");
  });

  test("area-trabajo: sección dinámica", async ({ page }) => {
    await page.goto("/");
    const workspace = page.locator('section[aria-label="Área de trabajo dinámica"]');
    await expect(workspace).toBeVisible();
    await expect(workspace).toHaveScreenshot("area-trabajo.png");
  });
});
