// T10-Step-3 ítem 12: "omnibar Ctrl+K + @/" (T10.md:79).
// El Omnibar es un Modal renderer-side (`title="Búsqueda federada
// (Ctrl+K)"`, combobox `aria-label="Buscar en memoria federada"` —
// renderer/components/omnibar.tsx:177-188) que sin bridge devuelve
// `hits=[]` honesto. Abrir + enfocar es ejecutable; resultados reales
// exigen `memory.searchMulti` del main → skip honesto.
import { test, expect, collectPageErrors } from "../fixtures/base.js";

test("omnibar: Ctrl+K abre búsqueda federada y enfoca el combobox", async ({
  page,
}) => {
  const errors = await collectPageErrors(page);
  await page.goto("/");
  await page.keyboard.press("Control+k");
  const modal = page.getByTitle("Búsqueda federada (Ctrl+K)");
  await expect(modal).toBeVisible({ timeout: 5000 });
  const box = page.getByRole("combobox", { name: "Buscar en memoria federada" });
  await expect(box).toBeFocused();
  // "@" no rompe: sin bridge, cero resultados honesto, cero errores.
  await box.fill("@test");
  await page.waitForTimeout(600);
  expect(errors, `consola roja en omnibar: ${errors.join("\n")}`).toEqual([]);
});

test.describe.skip("requiere backend Electron vivo", () => {
  test("omnibar: buscar devuelve hits VantaDB y @/ menciona entidades", async () => {
    // Exige backend Electron real: `memory.searchMulti` del main vía
    // `window.ego`. Sin bridge el omnibar devuelve `[]` por diseño.
  });
});
