// T10-Step-3 ítem 2: "chat streaming + badge 🧠" (T10.md:79).
// Shell ejecutable sin backend; el streaming vivo exige `llmStream` del
// main (T18/T19) → skip honesto.
import { test, expect, collectPageErrors } from "../fixtures/base.js";

test("streaming-shell: superficie de chat monta sin consola roja", async ({
  page,
}) => {
  const errors = await collectPageErrors(page);
  await page.goto("/");
  await expect(page.locator("#root")).toBeVisible();
  // Sin bridge el chat muestra estado vacío honesto; lo exigible aquí es
  // que la superficie monte y no rompa.
  expect(errors, `consola roja en chat: ${errors.join("\n")}`).toEqual([]);
});

test.describe.skip("requiere backend Electron vivo", () => {
  test("streaming: un turno hace stream y el badge 🧠 muestra usage", async () => {
    // Exige backend Electron real: turno vía `llmStream` del main +
    // `usage.{promptTokens,completionTokens,estimatedCostUsd}` cableado a
    // MetricsConsole (T19). Sin main no hay stream que asertar.
  });
});
