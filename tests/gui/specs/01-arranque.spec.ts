// T10-Step-3 ítem 1: "arranque sin consola roja"
// (docs/agent-ops/tasks/T10.md:79). Ejecutable contra `pnpm dev` pelado:
// el renderer degrada sin bridge `window.ego` (defaults locales).
import { test, expect, collectPageErrors } from "../fixtures/base.js";

test("arranque: título, #root y header sin consola roja", async ({ page }) => {
  const errors = await collectPageErrors(page);
  await page.goto("/");
  await expect(page).toHaveTitle("Ego — Sistema Operativo Cognitivo");
  await expect(page.locator("#root")).toBeVisible();
  await expect(page.getByText("Ego", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/SOC|Cognitive OS/).first()).toBeVisible();
  expect(errors, `consola roja al arrancar: ${errors.join("\n")}`).toEqual([]);
});
