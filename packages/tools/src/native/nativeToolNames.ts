/**
 * Nombres canónicos de las tools nativas (Nivel A) de Ego.
 *
 * EGO-FIND-45 (Ola 1 / A3 / T5). Este catálogo es la **única fuente de verdad**
 * de qué tools existen. Los manifiestos de Sub-Ego, los dominios y las
 * plantillas declaraban 20+ nombres que ninguna tool registraba
 * (`filesystem_read`, `memory_recall`, `worktree_manage`, `knowledge_search`,
 * `product_backlog_manage`, `crm_contact_manage`, …).
 *
 * La lista se valida contra el registro real en
 * `packages/tools/test/native-tool-names.test.ts`, de modo que no puede
 * desviarse sin romper la suite.
 */
export const NATIVE_TOOL_NAMES: readonly string[] = Object.freeze([
  "fs_read_file",
  "fs_write_file",
  "fs_edit_patch",
  "fs_glob",
  "fs_grep",
  "git_status",
  "git_diff",
  "git_session_diff",
  "terminal_exec",
  "canvas_render",
  "export_artifact",
  "eval_expression",
]);
