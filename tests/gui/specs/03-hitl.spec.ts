// T10-Step-3 ítem 3: "HITL ApprovalCard" (T10.md:79).
// El flujo de aprobación nace en el main (ExecutionManager → ActivityWidget)
// y resuelve vía `ApprovalCard` (renderer/components/tools/ApprovalCard).
// Sin main no hay request que aprobar → skip honesto, cero test falso.
import { test } from "../fixtures/base.js";

test.describe.skip("requiere backend Electron vivo — Clase B (taxonomía docs/dev/e2e-skip-inventory.md)", () => {
  test("HITL: acción sensible muestra ApprovalCard y bloquea hasta resolver", async () => {
    // Exige backend Electron real: pipeline de aprobaciones del main
    // (`daily.listApprovals` + HITL con ACK). Sin main no se puede
    // disparar ni resolver un approval de verdad.
  });

  test("HITL: rechazar revierte sin efectos colaterales", async () => {
    // Exige backend Electron real: mismo motivo que arriba.
  });
});
