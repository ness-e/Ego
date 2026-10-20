// Character System - Exportaciones unificadas para Ego Desktop
//
// T4/R14 (VERDICT): se retiran las dos superficies de UI legacy del
// personaje (canvas 2.5D y mini-badge) — estaban **definidas y nunca
// renderizadas** (0 usos JSX en todo el repo, 0 usos en tests). Eran dos
// superficies duplicadas que nadie mantenía.
export * from "./core/anim.js";
export * from "./core/CharacterEngine.js";
export * from "./wardrobe/CharacterWardrobe.js";
export * from "./state/index.js";
export * from "./traits/index.js";
export * from "./CharacterBadge.js";
export * from "./wardrobe/WardrobeSelector.js";
