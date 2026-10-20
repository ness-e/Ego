/**
 * T4/R15 (VERDICT) — Vocabulario de estado del personaje (14 estados).
 *
 * Este módulo es el que sobrevive de la antigua `CharacterStateMachine`:
 * el **vocabulario** `CharacterState`, que es el contrato entre el chat
 * (`ego-chat.tsx`) y el badge (`CharacterBadge.tsx`).
 *
 * ## Por qué se RETIRA la clase `CharacterStateMachine` (R15)
 * - **Nunca se instanciaba**: 0 `new CharacterStateMachine()` en todo el
 *   repo. Solo se importaba su *tipo*. Era código muerto (~250 líneas).
 * - **Sería una segunda fuente de verdad de la física**: el motor canónico
 *   es `@ego/avatar` (ADR-0018), y la interpolación (canales `gazeX`,
 *   `open`, `pulse`, `aura`, `tilt`, `energy`, `squash*`) vive YA ahí, con su
 *   propio `smoothingFactor`. Una FSM de interpolación en el renderer
 *   duplicaría ese smoothing con otros parámetros.
 * - **El estado que la UI necesita es el estado OBJETIVO**, no el
 *   interpolado: lo computa el `useMemo` de `ego-chat.tsx` a partir del
 *   contexto del chat (streaming, tool call, error, aprobación). Pasarlo
 *   por una FSM con smoothing haría que el avatar *retrasase* respecto al
 *   chat (el estado real llegaría después del hecho) y lo haría
 *   determinismo-dependiente del test.
 * - **No hay tests de la clase**: retirarla no deja cobertura huérfana.
 *
 * Lo que se conserva es el **contrato**: los 14 estados y su mapeo al
 * vocabulario de `<ego-avatar>` (`mapCharacterStateToAvatarState` en
 * `CharacterBadge.tsx`).
 */

/**
 * Estado del personaje tal y como lo ve el CHAT (14 estados operativos
 * canónicos, `character-system.md` §3). No es el estado interno del motor:
 * es el objetivo que se le pide al avatar.
 */
export type CharacterState =
  | "idle"              // Reposo/vigilancia relajada; respiración orgánica base
  | "listening"         // Entrada activa de texto o audio; inclinación de atención
  | "thinking"          // Ensamblado de contexto y razonamiento en Cognitive Runtime
  | "generating"        // Emisión continua de tokens de respuesta (streaming)
  | "searching"         // Búsqueda en VantaDB, GraphRAG o web; ojos orbitando
  | "using_tool"        // Ejecución activa de una herramienta puntual (fs, git, terminal)
  | "waiting"           // Espera de respuesta externa asíncrona
  | "approval_required" // Bloqueado en barrera HITL; exige decisión humana interactiva
  | "question"          // Clarificación o pregunta interactiva al usuario
  | "success"           // Tarea culminada satisfactoriamente con rebote y destello
  | "warning"           // Advertencia o degradación tolerable
  | "error"             // Fallo, excepción o rechazo de política
  | "sleeping"          // Reposo prolongado o ventana sin foco
  | "attention";        // Proactividad espontánea o alerta perimetral

/** Estados canónicos, en orden de presentación (para documentación y tests). */
export const CANONICAL_CHARACTER_STATES: readonly CharacterState[] = [
  "idle",
  "listening",
  "thinking",
  "generating",
  "searching",
  "using_tool",
  "waiting",
  "approval_required",
  "question",
  "success",
  "warning",
  "error",
  "sleeping",
  "attention",
];
