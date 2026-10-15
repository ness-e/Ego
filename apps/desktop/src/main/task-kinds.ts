/**
 * Clasificación de tareas background (R5 deny-by-default).
 *
 * Extraído de `../main.ts` (STAB-09): solo estos `metadata.kind` ejecutan
 * directo; cualquier otro queda `paused` y sale vía HITL (`resume()` tras
 * aprobación en ApprovalCard/ActivityTray). STAB-02, R5.
 */

/** Kinds de tarea que corren directo sin aprobación. */
export const TASK_SAFE_KINDS: ReadonlySet<string> = new Set([
  "indexing",
  "sync",
  "maintenance",
  "notification",
]);

/**
 * `true` si el `metadata.kind` de tarea corre directo (deny-by-default);
 * cualquier otro queda `paused` y sale vía HITL.
 */
export function isTaskKindSafe(kind: unknown): boolean {
  return typeof kind === "string" && TASK_SAFE_KINDS.has(kind);
}
