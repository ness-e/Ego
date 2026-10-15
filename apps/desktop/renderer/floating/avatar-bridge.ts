// avatar-bridge.ts — puente AttentionState -> ego-avatar (Task2, D1).
//
// Fuente: repos-referencia/avatar/src/runtime/states.js (STATES, 14 estados)
//   + DESIGN.md P1 (determinismo seed), P5 (estados son datos), P10 (ESM, React 19).
// D1 owner: criatura `repos-referencia/avatar`. PROHIBIDO importar Mochi o
// BOT_STATES (LICENSE-ASSETS prohibe el clon visual; ver plan §Task 0).

/** Estados visuales del avatar (states.js STATES, 14 claves). */
export type AvatarState =
  | "idle"
  | "thinking"
  | "working"
  | "searching"
  | "listening"
  | "waiting"
  | "success"
  | "finished"
  | "error"
  | "ratelimit"
  | "approval"
  | "question"
  | "dizzy"
  | "sleeping";

/** Modos de presencia (presence.js PRESENCE_MODES). */
export type PresenceMode = "hidden" | "compact" | "home" | "greet";

/** Motion aceptado por <ego-avatar> (policy.js requestedMotion: auto|full|reduce). */
export type AvatarMotion = "auto" | "full" | "reduce";

/**
 * Mapea un estado de atención/HITL del flotante a estado visual del avatar.
 * Contrato Task2: hitl_approval->approval, hidden->idle, expanded->working,
 * compact->thinking. Claves avatar passthrough; desconocido->idle.
 */
export function avatarStateFor(attention: string): AvatarState {
  switch (attention) {
    case "hitl_approval":
    case "alert":
      return "approval";
    case "expanded":
      return "working";
    case "compact":
      return "thinking";
    case "hidden":
      return "idle";
    case "idle":
    case "thinking":
    case "working":
    case "searching":
    case "listening":
    case "waiting":
    case "success":
    case "finished":
    case "error":
    case "ratelimit":
    case "approval":
    case "question":
    case "dizzy":
    case "sleeping":
      return attention;
    default:
      return "idle";
  }
}

/**
 * Seed determinista por SubEgo (DESIGN.md §10: `seed = "subego:<id>"`).
 * Misma entrada => mismo avatar, siempre (P1).
 */
export function seedForSubEgo(subEgoId?: string | null): string {
  return `subego:${subEgoId ?? "ego"}`;
}

/**
 * Motion para <ego-avatar> según prefers-reduced-motion.
 * NOTA: el plan cita `motion="still"`, valor que NO existe en el avatar
 * (policy.js requestedMotion solo acepta auto|full|reduce; DESIGN.md §7).
 * reduced => "reduce" (fuente de verdad: src/runtime/policy.js:11-26).
 */
export function motionFor(prefersReducedMotion: boolean): AvatarMotion {
  return prefersReducedMotion ? "reduce" : "auto";
}

/**
 * Modo de presencia para el flotante (presence.js).
 * expanded/hitl_approval => home (abierto); compact => compact; resto => hidden.
 */
export function presenceFor(attention: string): PresenceMode {
  if (attention === "expanded" || attention === "hitl_approval" || attention === "alert") {
    return "home";
  }
  if (attention === "compact") return "compact";
  return "hidden";
}
