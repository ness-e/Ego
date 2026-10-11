/**
 * @file run-tests.ts
 * @description Ejecutor de pruebas automatizadas del motor CoucouCompanionEngine.
 */

import { runGeometryTests } from "./geometry.test";
import { runStateTransitionTests } from "./stateTransitions.test";

function main() {
  console.log("=================================================================");
  console.log("COUCOU COMPANION ENGINE — TEST SUITE EJECUTABLE");
  console.log("=================================================================\n");

  const geoRes = runGeometryTests();
  console.log(`[GEOMETRÍA SUPERELIPSOIDAL]: ${geoRes.passed} superadas, ${geoRes.failed} fallidas`);
  if (geoRes.errors.length > 0) {
    geoRes.errors.forEach((e) => console.error(`  - ERROR: ${e}`));
  }

  const stateRes = runStateTransitionTests();
  console.log(`[TRANSICIONES & ÁRBITRO HITL]: ${stateRes.passed} superadas, ${stateRes.failed} fallidas`);
  if (stateRes.errors.length > 0) {
    stateRes.errors.forEach((e) => console.error(`  - ERROR: ${e}`));
  }

  const totalPassed = geoRes.passed + stateRes.passed;
  const totalFailed = geoRes.failed + stateRes.failed;

  console.log("\n-----------------------------------------------------------------");
  console.log(`RESULTADO TOTAL: ${totalPassed} PASSED / ${totalFailed} FAILED`);
  console.log("-----------------------------------------------------------------");

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    console.log("TODAS LAS PRUEBAS MATEMÁTICAS Y DE COMPORTAMIENTO PASARON CON ÉXITO.");
  }
}

main();
