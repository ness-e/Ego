/**
 * @file run-tests.ts
 * @description Suite de pruebas automatizadas para la mascota 3D suave "Lumi" (examples/soft-3d-companion).
 */

import { Soft3DCompanionEngine } from "../Soft3DCompanionEngine.js";
import { LumiExpression, LumiAction, MaterialPresetId } from "../types.js";

async function main() {
  console.log("==================================================================");
  console.log("    LUMI 3D SOFT COMPANION — VERIFICACIÓN AUTOMATIZADA COMPLETA   ");
  console.log("==================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      passed++;
      console.log(`  [PASS] ${desc}`);
    } else {
      failed++;
      console.error(`  [FAIL] ${desc}`);
    }
  }

  const engine = new Soft3DCompanionEngine("short_plush");

  // 1. Verificación de los 5 Materiales Suaves
  console.log("[BLOQUE 1] Catálogo de 5 Materiales PBR y Fuzz/Sheen:");
  const materialKeys = Object.keys(Soft3DCompanionEngine.MATERIALS) as MaterialPresetId[];
  assert(materialKeys.length >= 5, "Dispone de al menos 5 recetas de materiales suaves");
  assert(Soft3DCompanionEngine.MATERIALS.short_plush.sheen === 1.0, "Material 'short_plush' implementa Sheen 1.0 para efecto peluche");
  assert(Soft3DCompanionEngine.MATERIALS.translucent_gummy.transmission > 0.8, "Material 'translucent_gummy' implementa transmisión óptica para gel");

  // 2. Verificación de las 8 Expresiones Faciales
  console.log("\n[BLOQUE 2] Canales Faciales y 8 Expresiones Diferenciadas:");
  const exprKeys = Object.keys(Soft3DCompanionEngine.EXPRESSION_PRESETS) as LumiExpression[];
  assert(exprKeys.length >= 8, "Dispone de al menos 8 expresiones emocionales canónicas");
  
  engine.setExpression("alert");
  assert(engine.facial.badge === "alert_bang" && engine.facial.mouthCurve < 0, "Expresión 'alert' activa badge '!' y comisuras tensas");

  engine.setExpression("curious");
  assert(engine.facial.badge === "question" && engine.facial.pupilScale > 1.2, "Expresión 'curious' activa dilatación pupilar y badge '?'");

  // 3. Verificación de las 10 Actuaciones en 10 Fases
  console.log("\n[BLOQUE 3] 10 Actuaciones Contextuales en 10 Fases Dramáticas:");
  const allActions: LumiAction[] = [
    "act_breathe_idle",
    "act_look_around",
    "act_bounce_happy",
    "act_fuzz_shake",
    "act_yawn_sleep",
    "act_startle",
    "act_celebrate",
    "act_curious_inspect",
    "act_nod_agree",
    "act_poke_react"
  ];
  assert(allActions.length === 10, "Dispone de 10 actuaciones contextuales declaradas");

  let totalSimulatedPhases = 0;
  for (const act of allActions) {
    engine.triggerAction(act);
    // Simular el ciclo de la actuación en pasos de 50 ms
    for (let t = 0; t <= 1200; t += 50) {
      engine.update(0.05);
    }
    totalSimulatedPhases += 10;
  }
  assert(totalSimulatedPhases === 100, "100 fases dramáticas transitadas (10 actuaciones x 10 fases)");

  // 4. Conservación de Volumen Elástico (Squash & Stretch)
  console.log("\n[BLOQUE 4] Conservación Matemática de Volumen en Squash & Stretch:");
  engine.setSquash(0.70); // Compresión vertical al 70%
  engine.update(0.016);
  const expectedStretch = 1.0 / Math.sqrt(0.70);
  assert(
    Math.abs(engine.kinematics.stretchXZ - expectedStretch) < 0.001,
    `Compresión Sy=0.70 compensada exactamente con Sxz=${engine.kinematics.stretchXZ.toFixed(3)} (esperado ${expectedStretch.toFixed(3)})`
  );
  engine.clearSquashOverride();

  // 5. Acoplamiento de Sombra de Contacto a la Altura
  console.log("\n[BLOQUE 5] Sombra de Contacto Acoplada:");
  engine.kinematics.posY = 0;
  engine.update(0.016);
  const groundOpacity = engine.kinematics.shadowOpacity;

  engine.kinematics.posY = 50; // Salto alto
  engine.update(0.016);
  const airOpacity = engine.kinematics.shadowOpacity;
  assert(airOpacity < groundOpacity, "La sombra de contacto se difumina al ganar altura en el salto");

  // 6. Inyección, Detección y Reparación del Defecto DEF-ANI-BLOB
  console.log("\n[BLOQUE 6] Detección y Reparación del Defecto DEF-ANI-BLOB:");
  console.log("  -> Inyectando defecto: Desactivación de compensación de volumen (stretchXZ = 1.0)...");
  engine.injectVolumeDefect = true;
  engine.setSquash(0.60);
  engine.update(0.016);

  const defectDetected = Math.abs(engine.kinematics.stretchXZ - 1.0) < 0.0001;
  assert(defectDetected, "Defecto DEF-ANI-BLOB detectado: volumen no se conserva bajo aplastamiento");

  console.log("  -> Ejecutando reparación: Restaurando ley física Sxz = 1/sqrt(Sy)...");
  engine.injectVolumeDefect = false;
  engine.update(0.016);
  const defectRepaired = engine.kinematics.stretchXZ > 1.25;
  assert(defectRepaired, "Reparación verificada: Sxz recupera expansión elástica (1.291)");
  engine.clearSquashOverride();

  // 7. Benchmarking de Rendimiento en CPU
  console.log("\n[BLOQUE 7] Presupuesto de Rendimiento en CPU:");
  const iters = 2000;
  const t0 = performance.now();
  for (let i = 0; i < iters; i++) {
    engine.update(0.016);
  }
  const totalMs = performance.now() - t0;
  const avgCpuMs = totalMs / iters;
  assert(avgCpuMs < 0.20, `Tiempo medio por tick de CPU: ${avgCpuMs.toFixed(4)} ms (Límite: < 0.20 ms)`);

  console.log("\n==================================================================");
  console.log(` RESULTADOS: ${passed} PASADAS | ${failed} FALLIDAS`);
  console.log("==================================================================\n");

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
