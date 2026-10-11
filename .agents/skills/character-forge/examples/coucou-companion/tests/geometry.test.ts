/**
 * @file geometry.test.ts
 * @description Suite de pruebas matemáticas para la geometría analítica superelipsoidal.
 */

import { SuperellipsoidGeometry } from "../geometry/superellipsoid";

export function runGeometryTests(): { passed: number; failed: number; errors: string[] } {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  function assert(condition: boolean, msg: string) {
    if (condition) passed++;
    else {
      failed++;
      errors.push(msg);
    }
  }

  const geom = new SuperellipsoidGeometry({ a: 100, b: 88, c: 100, p: 2.7 });

  // Test 1: Continuidad y límites en los polos
  const rEcuador = geom.radiusAt(0);
  const rPoloNorte = geom.radiusAt(1.0);
  const rPoloSur = geom.radiusAt(-1.0);

  assert(Math.abs(rEcuador - 1.0) < 1e-6, "El radio en el ecuador (y=0) debe ser 1.0");
  assert(rPoloNorte === 0, "El radio en el polo norte (y=1.0) debe ser estrictamente 0");
  assert(rPoloSur === 0, "El radio en el polo sur (y=-1.0) debe ser estrictamente 0");

  // Test 2: Ausencia de NaN en muestreo denso
  let hasNaN = false;
  for (let y = -1.0; y <= 1.0; y += 0.05) {
    for (let lam = 0; lam < Math.PI * 2; lam += 0.2) {
      const pt = geom.surfacePoint(y, lam);
      const norm = geom.surfaceNormal(y, lam);
      if (isNaN(pt.x) || isNaN(pt.y) || isNaN(pt.z) || isNaN(norm.x) || isNaN(norm.y) || isNaN(norm.z)) {
        hasNaN = true;
        break;
      }
    }
  }
  assert(!hasNaN, "No debe existir ningún valor NaN en el muestreo de superficie y normales");

  // Test 3: Normales unitarias (||N|| = 1.0)
  let normUnitError = false;
  for (let y = -0.9; y <= 0.9; y += 0.2) {
    const norm = geom.surfaceNormal(y, Math.PI / 4);
    const len = Math.hypot(norm.x, norm.y, norm.z);
    if (Math.abs(len - 1.0) > 1e-5) {
      normUnitError = true;
      break;
    }
  }
  assert(!normUnitError, "Todas las normales evaluadas deben ser unitarias (longitud 1.0 +- 1e-5)");

  // Test 4: Rotación consistente en Y (Yaw)
  const frontPt = { x: 0, y: 0, z: 100 };
  const rotatedPt = SuperellipsoidGeometry.rotatePoint(frontPt, Math.PI / 2, 0);
  assert(Math.abs(rotatedPt.x - 100) < 1e-5, "Giro de 90 grados en Yaw debe desplazar Z a +X");

  return { passed, failed, errors };
}
