// T10-Step-3 ítem 4: "proyectos + selectFolder + persistencia reinicio"
// (T10.md:79). Restore del proyecto activo tolera falta de bridge
// (renderer/src/App.tsx:95-113: defaults locales); selectFolder abre
// diálogo NATIVO y persistir exige main+VantaDB → skip honesto.
import { test, expect, collectPageErrors } from "../fixtures/base.js";

test("proyectos-shell: sidebar monta sin consola roja", async ({ page }) => {
  const errors = await collectPageErrors(page);
  await page.goto("/");
  await expect(page.locator("#root")).toBeVisible();
  expect(errors, `consola roja en proyectos: ${errors.join("\n")}`).toEqual([]);
});

test.describe.skip("requiere backend Electron vivo — Clase B (taxonomía docs/dev/e2e-skip-inventory.md)", () => {
  test("proyectos: selectFolder abre diálogo nativo y persiste tras reinicio", async () => {
    // Exige backend Electron real: `selectFolder` es diálogo nativo del
    // shell (no DOM) y la persistencia vive en main+VantaDB (`T14`:
    // `projects.select` + restore). Sin main ni relaunch real no hay
    // nada honesto que asertar.
  });
});
