/**
 * @file types.ts
 * @description Contratos de datos tipados para el sistema de mascotas 3D suaves (Lumi).
 */

export type LumiExpression =
  | "neutral"
  | "happy"
  | "curious"
  | "surprised"
  | "sleepy"
  | "thinking"
  | "alert"
  | "proud";

export type LumiAction =
  | "act_breathe_idle"
  | "act_look_around"
  | "act_bounce_happy"
  | "act_fuzz_shake"
  | "act_yawn_sleep"
  | "act_startle"
  | "act_celebrate"
  | "act_curious_inspect"
  | "act_nod_agree"
  | "act_poke_react";

export type MaterialPresetId =
  | "short_plush"
  | "velvet_fuzz"
  | "soft_rubber"
  | "translucent_gummy"
  | "matte_ceramic";

export interface MaterialProperties {
  id: MaterialPresetId;
  name: string;
  roughness: number;
  metalness: number;
  sheen: number;
  sheenColor: string;
  transmission: number;
  thickness: number;
  clearcoat: number;
  primaryColor: string;
  bellyPatchColor: string;
}

export interface FacialState {
  expression: LumiExpression;
  eyeBlinkL: number;    // [0, 1]
  eyeBlinkR: number;    // [0, 1]
  eyeSquint: number;    // [0, 1]
  gazeYaw: number;      // [-1, 1]
  gazePitch: number;    // [-1, 1]
  pupilScale: number;   // [0.6, 1.4]
  mouthCurve: number;   // [-1, 1] -1 triste, +1 sonrisa
  mouthOpen: number;    // [0, 1]
  earsDroop: number;    // [0, 1]
  badge: "none" | "alert_bang" | "question" | "stars" | "zzz";
}

export interface KinematicState {
  posX: number;
  posY: number;
  posZ: number;
  yaw: number;
  pitch: number;
  roll: number;
  squashY: number;      // Compresión vertical [0.7, 1.3]
  stretchXZ: number;    // Compensación de volumen 1 / sqrt(squashY)
  earLRotX: number;     // Física secundaria de oreja izquierda
  earRRotX: number;     // Física secundaria de oreja derecha
  shadowScale: number;  // Escala de sombra de contacto en suelo
  shadowOpacity: number;// Opacidad de sombra de contacto
}

export interface PersonalityProfile {
  name: string;
  energy: number;       // [0, 1] Velocidad y altura de saltos
  curiosity: number;    // [0, 1] Inclinación hacia el cursor
  shyness: number;      // [0, 1] Retracción ante movimientos rápidos
  whimsy: number;       // [0, 1] Frecuencia de sacudidas de pelusa
  omega0: number;       // Frecuencia física de resorte (rad/s)
  zeta: number;         // Amortiguamiento
}
