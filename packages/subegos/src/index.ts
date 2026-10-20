export * from "./types.js";
export * from "./SubEgoManifest.js";
export * from "./templates/domainTemplates.js";
export * from "./SubEgoFactory.js";
export * from "./SubEgoRuntime.js";
export * from "./SubEgoMemoryGuard.js";
export * from "./SharedMemory.js";
export * from "./SubEgoRegistry.js";
export * from "./SubEgoSoul.js";
export * from "./PromptAssembly.js";
export * from "./DelegationRouter.js";
export * from "./DelegationTools.js";
export * from "./DelegationRuntime.js";
export * from "./CharacterProfile.js";
export * from "./SubEgoBudget.js";
export * from "./SelfImprovementLoop.js";
export * from "./SubEgoWorktree.js";

/**
 * Re-export del catálogo canónico de tools y del contrato de existencia.
 *
 * Motivo (EGO-FIND-45, Ola 1 / A3 / T5): `@ego/domains` depende de
 * `@ego/subegos` pero no de `@ego/tools` (y añadir dependencias está fuera de
 * mi zona). Reexportar desde aquí mantiene UNA sola fuente de verdad para el
 * catálogo sin crear una dependencia nueva.
 */
export {
  NATIVE_TOOL_NAMES,
  assertToolsExist,
  collectToolContractViolations,
  findMissingTools,
} from "@ego/tools";
export type { ToolCatalogLike, ToolContractViolation } from "@ego/tools";
