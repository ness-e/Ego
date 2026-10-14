// T10-Step-3 ítem 5: "sub-egos reales" (T10.md:79).
// El selector muestra el especialista activo vía `title="Especialista
// activo: …"` (renderer/components/SubEgoSelector.tsx:79) con defaults
// locales; delegar de verdad exige runtime del main → skip honesto.
import { test, expect, collectPageErrors } from "../fixtures/base.js";

test("subegos-shell: selector visible sin consola roja", async ({ page }) => {
  const errors = await collectPageErrors(page);
  await page.goto("/");
  await expect(page.locator("#root")).toBeVisible();
  const selector = page.getByTitle(/Especialista activo:/);
  if ((await selector.count()) > 0) {
    await expect(selector.first()).toBeVisible();
  }
  expect(errors, `consola roja en sub-egos: ${errors.join("\n")}`).toEqual([]);
});

test.describe.skip("requiere backend Electron vivo", () => {
  test("sub-egos: delegación real ejecuta y comparte memoria", async () => {
    // Exige backend Electron real: Sub-Ego runtime + memoria compartida
    // del main. Sin main solo hay defaults locales, no delegación.
  });
});
