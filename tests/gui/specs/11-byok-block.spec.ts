// T10-Step-3 ítem 11: "BYOK sin keys" (T10.md:79).
// Las keys viven en el Credential Manager del main (keychain del SO;
// NUNCA en VantaDB/renderer/código — AGENTS.md §Seguridad) y el
// ModelRouter real lee el pool en el main (T21). Sin main no hay
// bloqueo BYOK que asertar → skip honesto, cero test falso.
import { test } from "../fixtures/base.js";

test.describe.skip("requiere backend Electron vivo — Clase B (taxonomía docs/dev/e2e-skip-inventory.md)", () => {
  test("BYOK: sin keys el modelo remoto se bloquea con mensaje honesto", async () => {
    // Exige backend Electron real: Credential Manager + pool por
    // proveedor (T21) + ModelRouter del main. En browser pelado no hay
    // proveedor ni keychain que evaluar.
  });
});
