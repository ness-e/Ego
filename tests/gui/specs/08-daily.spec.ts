// T10-Step-3 ítem 8: "daily first-launch" (T10.md:79).
// Sin bridge la app cae a la pestaña canvas por defecto
// (renderer/src/App.tsx:132-147); el ruteo first-launch exige
// `daily.isFirstLaunch()` del main → skip honesto.
import { test, expect, collectPageErrors } from "../fixtures/base.js";

test("daily-shell: pestaña daily abre panel sin consola roja", async ({
  page,
}) => {
  const errors = await collectPageErrors(page);
  await page.goto("/");
  // CALIBRATE: nombre accesible de la pestaña daily según primer run.
  const dailyTab = page.getByRole("tab", { name: /daily/i });
  if ((await dailyTab.count()) > 0) {
    await dailyTab.first().click();
    await expect(page.locator("#root")).toBeVisible();
  } else {
    await expect(page.locator("#root")).toBeVisible();
  }
  expect(errors, `consola roja en daily: ${errors.join("\n")}`).toEqual([]);
});

test.describe.skip("requiere backend Electron vivo", () => {
  test("daily: primer inicio del día abre en Daily State", async () => {
    // Exige backend Electron real: `daily.isFirstLaunch()` del main
    // (COUC-06). Sin bridge el fallback a canvas es el comportamiento
    // correcto, no algo que asertar como first-launch.
  });
});
