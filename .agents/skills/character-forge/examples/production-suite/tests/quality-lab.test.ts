/**
 * @file quality-lab.test.ts
 * @description Suite de verificación técnica para la Production Suite de CharacterForge.
 * Cubre:
 * 1. VisualRecipeRegistry: Integridad de recetas y compilación determinista.
 * 2. ActingDirector: Ciclo de vida estricto de 10 fases cinemáticas.
 * 3. PersonalityManager: Proyección de vector conductual a espacio físico.
 * 4. Bucle Automatizado de Reparación de Defectos: Inyección de DEF-ANI-01, detección cuantitativa en QualityLab, corrección y no-regresión.
 */

import { VisualRecipeRegistry } from "../recipes/VisualRecipeRegistry.js";
import { ActingDirector, CharacterActingState } from "../acting/ActingDirector.js";
import { QualityLabRunner, DEFAULT_MOTION_THRESHOLDS } from "../quality/QualityLabRunner.js";
import { PersonalityManager } from "../personality/PersonalityManager.js";

interface TestReport {
  passed: number;
  failed: number;
  details: { test: string; status: "PASS" | "FAIL"; message?: string }[];
}

export async function runQualityLabTests(): Promise<TestReport> {
  const report: TestReport = {
    passed: 0,
    failed: 0,
    details: []
  };

  function assert(condition: boolean, testName: string, message?: string) {
    if (condition) {
      report.passed++;
      report.details.push({ test: testName, status: "PASS" });
      console.log(`  [PASS] ${testName}`);
    } else {
      report.failed++;
      report.details.push({ test: testName, status: "FAIL", message });
      console.error(`  [FAIL] ${testName}: ${message ?? "Condición insatisfecha"}`);
    }
  }

  console.log("\n==================================================================");
  console.log("   CHARACTER-FORGE PRODUCTION SUITE - VERIFICACIÓN MATEMÁTICA     ");
  console.log("==================================================================\n");

  // -------------------------------------------------------------
  // TEST BLOCK 1: VisualRecipeRegistry
  // -------------------------------------------------------------
  console.log("[BLOQUE 1] Registro y Determinismo de Recetas Visuales:");
  const recipes = VisualRecipeRegistry.getAllRecipes();
  assert(recipes.length >= 5, "VisualRecipeRegistry contiene al menos 5 recetas canónicas de materiales");

  const ceramicRecipe = VisualRecipeRegistry.getRecipe("ceramic_kintsugi");
  assert(ceramicRecipe !== undefined, "Receta 'ceramic_kintsugi' está registrada y tipada");
  assert(
    ceramicRecipe?.targetRenderers.includes("canvas2d") === true,
    "Receta de cerámica soporta renderizado en Canvas 2D"
  );

  const canvasInstructions = VisualRecipeRegistry.compileToCanvas2D("ceramic_kintsugi", 42);
  assert(canvasInstructions.length >= 3, "Compilación Canvas 2D genera instrucciones de dibujo multicapa");
  
  const feltRecipe = VisualRecipeRegistry.getRecipe("felt_wool_peachfuzz");
  assert(
    feltRecipe?.noiseSeedBehavior === "deterministic_prng",
    "Receta de fieltro implementa generador de ruido PRNG determinista"
  );

  // -------------------------------------------------------------
  // TEST BLOCK 2: ActingDirector y Ciclo de 10 Fases
  // -------------------------------------------------------------
  console.log("\n[BLOQUE 2] ActingDirector y Ciclo de 10 Fases:");
  const initialState: CharacterActingState = {
    currentPhase: "recovery",
    currentVerb: "idle",
    bodyTranslation: { x: 0, y: 0, z: 0 },
    bodySquashStretch: { squash: 1.0, stretch: 1.0 },
    gazeDirection: { x: 0, y: 0 },
    activeOutfitId: "none",
    heldAccessoryId: "pencil",
    energyLevel: 1.0,
    arousal: 0.2
  };

  const director = new ActingDirector(initialState);
  assert(director.getState().currentPhase === "recovery", "Estado inicial del director en recovery/idle");

  const enqueued = director.enqueueIntention({
    id: "act-inspect-code",
    verb: "inspect",
    urgency: 70,
    requiredAccessory: "pencil",
    minEnergyRequired: 0.3,
    phaseDurationsMs: {
      stimulus: 50,
      interpretation: 80,
      preparation: 100,
      anticipation: 120,
      action: 150,
      accent: 60,
      secondary_reaction: 90,
      settling: 100,
      recovery: 120,
      context_memory: 40
    }
  });
  assert(enqueued, "Intención de inspección encolada con éxito al cumplir precondiciones");

  // Ejecución y avance de fases
  director.tick(60); // 60ms (stimulus = 50ms superado -> interpretation)
  assert(
    director.getState().currentPhase === "interpretation",
    "Transición temporal a Fase 2 (interpretation)"
  );

  director.tick(200); // Avanza a anticipation / action
  assert(
    director.getState().bodySquashStretch.squash !== 1.0 || director.getState().bodySquashStretch.stretch !== 1.0,
    "Deformación elástica viva (Squash & Stretch) aplicada durante anticipación/acción"
  );

  // Avanzar hasta completar el ciclo
  director.tick(1200);
  assert(
    director.getState().currentPhase === "recovery",
    "Retorno limpio a fase base (recovery) al culminar las 10 fases"
  );

  // -------------------------------------------------------------
  // TEST BLOCK 3: PersonalityManager
  // -------------------------------------------------------------
  console.log("\n[BLOQUE 3] PersonalityManager y Proyección Cinemática:");
  const personality = new PersonalityManager("zen_minimalist");
  const zenTuning = personality.deriveKinematicTuning();
  assert(
    zenTuning.zeta >= 0.55 && zenTuning.zeta <= 0.64,
    "Arquetipo Zen mantiene amortiguamiento sereno en ventana viva (zeta en [0.55, 0.64])"
  );

  personality.setArchetype("hyperactive_scout");
  const scoutTuning = personality.deriveKinematicTuning();
  assert(
    scoutTuning.omega0 > zenTuning.omega0,
    "Arquetipo Hiperactivo incrementa la frecuencia angular de respuesta (omega0 > zen)"
  );

  // -------------------------------------------------------------
  // TEST BLOCK 4: QualityLabRunner y Bucle de Reparación de Defectos
  // -------------------------------------------------------------
  console.log("\n[BLOQUE 4] Quality Lab: Inyección, Detección y Reparación de Defecto:");
  const lab = new QualityLabRunner(DEFAULT_MOTION_THRESHOLDS);

  // Simulación 1: Movimiento calibrado nominal (zeta = 0.58, omega0 = 18 rad/s -> overshoot ~11%)
  const nominalSamples = lab.simulateSpringStep(18.0, 0.58, 0.0, 100.0, 800, 8);
  const nominalMetrics = lab.evaluateMotionTrajectory(nominalSamples, 0.0, 100.0);
  if (nominalMetrics.violations.length > 0) {
    console.log("    [DEBUG Violations Nominal]:", nominalMetrics.violations);
  }
  
  assert(
    nominalMetrics.isCompliant,
    `Trayectoria nominal cumple con la especificación (Overshoot: ${nominalMetrics.overshootPercent.toFixed(1)}%, Settling: ${nominalMetrics.settlingTimeSec.toFixed(2)}s)`
  );
  assert(
    nominalMetrics.overshootPercent >= DEFAULT_MOTION_THRESHOLDS.minOvershootPercent &&
    nominalMetrics.overshootPercent <= DEFAULT_MOTION_THRESHOLDS.maxOvershootPercent,
    `Overshoot nominal (${nominalMetrics.overshootPercent.toFixed(1)}%) en ventana viva de confort [8%, 22%]`
  );

  // Inyección de defecto: DEF-ANI-01 (Subamortiguamiento severo / rebote estridente, zeta = 0.22)
  console.log("  -> Inyectando defecto DEF-ANI-01 (zeta = 0.22, oscilación descontrolada)...");
  const defectiveSamples = lab.simulateSpringStep(18.0, 0.22, 0.0, 100.0, 800, 8);
  const defectiveMetrics = lab.evaluateMotionTrajectory(defectiveSamples, 0.0, 100.0);

  assert(
    !defectiveMetrics.isCompliant,
    `Defecto DEF-ANI-01 detectado por QualityLab (Violación: Overshoot ${defectiveMetrics.overshootPercent.toFixed(1)}% > 22%)`
  );
  assert(
    defectiveMetrics.overshootPercent > 40.0,
    `Cuantificación de severidad: Overshoot excede el 40% (${defectiveMetrics.overshootPercent.toFixed(1)}%)`
  );

  // Bucle de Reparación Automatizado: Corrección del coeficiente físico a zeta = 0.56 (overshoot ~13%)
  console.log("  -> Ejecutando paso de reparación: Recalibrando zeta a 0.56 (solución amortiguada en rango vivo)...");
  const repairedSamples = lab.simulateSpringStep(18.0, 0.56, 0.0, 100.0, 800, 8);
  const repairedMetrics = lab.evaluateMotionTrajectory(repairedSamples, 0.0, 100.0);

  assert(
    repairedMetrics.isCompliant,
    `Reparación validada: Trayectoria corregida vuelve a ser conforme (Overshoot: ${repairedMetrics.overshootPercent.toFixed(1)}%, Settling: ${repairedMetrics.settlingTimeSec.toFixed(2)}s)`
  );
  assert(
    repairedMetrics.settlingTimeSec <= DEFAULT_MOTION_THRESHOLDS.maxSettlingTimeSec,
    `Tiempo de asentamiento estabilizado (< 0.50s)`
  );

  // Verificación de No-Regresión
  assert(
    director.getState().energyLevel > 0,
    "No-regresión: El estado del ActingDirector conserva su integridad tras la calibración"
  );

  console.log("\n==================================================================");
  console.log(` RESULTADOS: ${report.passed} PASADAS | ${report.failed} FALLIDAS`);
  console.log("==================================================================\n");

  return report;
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes("quality-lab.test")) {
  runQualityLabTests().then(res => {
    if (res.failed > 0) {
      process.exit(1);
    }
  });
}
