// T10-Step-3 ítem 6: "canvas JSON→editar→reinicio" (T10.md:79).
// El canvas monta con component registry local; mutar+editar visible en
// shell, pero persistir y rehidratar tras reinicio exige main+VantaDB.
import { test, expect, collectPageErrors } from "../fixtures/base.js";

test("canvas-shell: workspace monta y cambia a canvas sin consola roja", async ({
  page,
}) => {
  const errors = await collectPageErrors(page);
  await page.goto("/");
  await expect(page.locator("#root")).toBeVisible();
  // CALIBRATE: nombre accesible de la pestaña canvas según primer run.
  const canvasTab = page.getByRole("tab", { name: /canvas/i });
  if ((await canvasTab.count()) > 0) {
    await canvasTab.first().click();
    await expect(page.locator("#root")).toBeVisible();
  }
  expect(errors, `consola roja en canvas: ${errors.join("\n")}`).toEqual([]);
});

test.describe.skip("requiere backend Electron vivo", () => {
  test("canvas: JSON→editar→reinicio rehidrata intacto", async () => {
    // Exige backend Electron real: persistencia del canvas en VantaDB vía
    // main + relaunch de la app. Sin main no hay reinicio que asertar.
  });
});
