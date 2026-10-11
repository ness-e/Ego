/**
 * @file run-suite.ts
 * @description Ejecutor central de la Production Suite de CharacterForge.
 * Compila y ejecuta la verificación completa de recetas visuales, dirección dramática,
 * control de personalidad y laboratorio de calidad física.
 */

import { runQualityLabTests } from "./tests/quality-lab.test.js";
import { VisualRecipeRegistry } from "./recipes/VisualRecipeRegistry.js";
import { PersonalityManager } from "./personality/PersonalityManager.js";

async function main() {
  console.log("==================================================================");
  console.log("       CHARACTER-FORGE: EJECUCIÓN DE SUITE DE PRODUCCIÓN          ");
  console.log("==================================================================");

  // 1. Catálogo de recetas visuales
  console.log("\n[1] CATÁLOGO DE RECETAS VISUALES CARGADAS:");
  const recipes = VisualRecipeRegistry.getAllRecipes();
  recipes.forEach(r => {
    console.log(`  - [${r.id}] ${r.name}`);
    console.log(`    Categoría: ${r.category} | Renderers: ${r.targetRenderers.join(", ")} | Modo Ruido: ${r.noiseSeedBehavior}`);
  });

  // 2. Perfil de personalidad
  console.log("\n[2] ARQUETIPOS CONDUCTUALES Y AFINACIÓN FÍSICA:");
  const pm = new PersonalityManager("zen_minimalist");
  console.log("  Arquetipo: zen_minimalist ->", pm.deriveKinematicTuning());
  pm.setArchetype("whimsical_companion");
  console.log("  Arquetipo: whimsical_companion ->", pm.deriveKinematicTuning());

  // 3. Ejecución de pruebas del laboratorio
  console.log("\n[3] EJECUCIÓN DE PRUEBAS DE CALIDAD Y NO-REGRESIÓN:");
  const result = await runQualityLabTests();

  if (result.failed > 0) {
    console.error(`\n❌ LA SUITE FINALIZÓ CON ${result.failed} FALLOS.`);
    process.exit(1);
  } else {
    console.log(`\n✅ SUITE COMPLETADA CON ÉXITO: ${result.passed} PRUEBAS VALIDADAS.`);
  }
}

main().catch(err => {
  console.error("Error fatal durante la ejecución de la suite:", err);
  process.exit(1);
});
