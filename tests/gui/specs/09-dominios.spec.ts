// T10-Step-3 ítem 9: "dominios sin vacíos silenciosos" (T10.md:79).
// El switch sincroniza con el backend con defaults locales ante falta de
// bridge (renderer/src/App.tsx:95-113); poblar dominios reales exige main.
import { test, expect, collectPageErrors } from "../fixtures/base.js";

test("dominios-shell: selector monta sin consola roja", async ({ page }) => {
  const errors = await collectPageErrors(page);
  await page.goto("/");
  await expect(page.locator("#root")).toBeVisible();
  expect(errors, `consola roja en dominios: ${errors.join("\n")}`).toEqual([]);
});

test.describe.skip("requiere backend Electron vivo", () => {
  test("dominios: cada dominio muestra contenido real, nunca vacío silencioso", async () => {
    // Exige backend Electron real: el contenido por dominio lo sirve el
    // main (`domains.switch`). Sin main solo hay defaults locales.
  });
});
