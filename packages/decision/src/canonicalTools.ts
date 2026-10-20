/**
 * Nombres canónicos de herramientas nativas Nivel A (F3T6/H02).
 * Fuente de verdad de los nombres: `ToolRegistry` vía `registerNativeTools`
 * (`@ego/tools`). Este módulo fija el vocabulario que la capa de decisión
 * puede sugerir; el test de coherencia `decisionContracts.test.ts` lo
 * verifica contra el registry real.
 */
export const FS_READ_FILE_TOOL = 'fs_read_file';
export const FS_WRITE_FILE_TOOL = 'fs_write_file';
export const GIT_STATUS_TOOL = 'git_status';
export const GIT_DIFF_TOOL = 'git_diff';
export const TERMINAL_EXEC_TOOL = 'terminal_exec';

export const FS_TOOLS: readonly string[] = [FS_READ_FILE_TOOL, FS_WRITE_FILE_TOOL];
export const GIT_TOOLS: readonly string[] = [GIT_STATUS_TOOL, GIT_DIFF_TOOL];
export const TERMINAL_TOOLS: readonly string[] = [TERMINAL_EXEC_TOOL];

/**
 * Herramientas con efecto de escritura/ejecución (A2-20).
 * Sugerir una de ellas implica aprobación humana por definición de riesgo,
 * no por coincidencia de regex en el prompt.
 */
export const MUTATING_TOOLS: readonly string[] = [FS_WRITE_FILE_TOOL, TERMINAL_EXEC_TOOL];

/** ¿La herramienta tiene efecto mutante? */
export function isMutatingToolName(value: string): boolean {
  return MUTATING_TOOLS.includes(value);
}

export const NATIVE_TOOL_NAMES: readonly string[] = [
  ...FS_TOOLS,
  ...GIT_TOOLS,
  ...TERMINAL_TOOLS
];

/**
 * Indica si una tool sugerida pertenece al vocabulario nativo canónico.
 */
export function isNativeToolName(value: string): boolean {
  return NATIVE_TOOL_NAMES.includes(value);
}
