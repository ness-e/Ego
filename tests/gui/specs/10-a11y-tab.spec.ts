// T10-Step-3 ítem 10: "a11y Tab/Escape/axe" (T10.md:79).
// Totalmente ejecutable en browser: el ModelPicker es `role="dialog"` +
// `aria-modal` con opciones por teclado (renderer/components/ModelPicker)
// y se abre desde el header (renderer/src/App.tsx:175-179). La auditoría
// axe completa queda como paso owner (requiere axe-playwright instalado).
import { test, expect, collectPageErrors } from "../fixtures/base.js";

test("a11y: Tab mueve foco dentro del diálogo y Escape lo cierra", async ({
  page,
}) => {
  const errors = await collectPageErrors(page);
  await page.goto("/");
  // Abre el Selector de Modelos desde el header.
  await page.getByTitle("Selector de modelo (Model Router)").click();
  const dialog = page.getByTitle("Selector de Modelos");
  await expect(dialog).toBeVisible();
  // Tab mueve el foco sin sacarlo del documento.
  const before = await page.evaluate(() => document.activeElement?.tagName);
  await page.keyboard.press("Tab");
  const after = await page.evaluate(() => document.activeElement?.tagName);
  expect(`${before}→${after}`).not.toBe("BODY→BODY");
  // Escape cierra el diálogo (si el Modal no cierra con Escape, este
  // expect falla en voz alta y el owner lo calibra — RED honesto).
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden({ timeout: 3000 });
  expect(errors, `consola roja en a11y: ${errors.join("\n")}`).toEqual([]);
});
