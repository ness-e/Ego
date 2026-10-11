/**
 * Tipos y Contratos Canónicos para Pip: Original Soft Companion
 * Basado en los estándares de .agents/skills/character-forge
 */

export type PipExpressionName =
  | 'neutral_attentive'
  | 'joyful'
  | 'curious'
  | 'surprised'
  | 'confused'
  | 'sad'
  | 'frustrated'
  | 'enthusiastic'
  | 'tired'
  | 'sleeping'
  | 'focused'
  | 'playful';

export type PipActingActionName =
  | 'idle_breathe'
  | 'look_at_user'
  | 'tilt_curious'
  | 'jump_bounce'
  | 'celebrate_success'
  | 'startle_alert'
  | 'cower_retract'
  | 'stretch_wake'
  | 'fall_asleep'
  | 'react_click';

export type PipMaterialMode = 'plush' | 'velvet' | 'minimal_silk';

export interface FacialRigParameters {
  eyeOpenLeft: number;        // [0, 1]
  eyeOpenRight: number;       // [0, 1]
  pupilDilation: number;      // [0.5, 1.5]
  gazeX: number;              // [-1, 1]
  gazeY: number;              // [-1, 1]
  browInnerRaise: number;     // [-1, 1]
  browOuterRaise: number;     // [-1, 1]
  mouthCurve: number;         // [-1, 1] (-1 triste/enfado, +1 sonrisa)
  mouthOpen: number;          // [0, 1]
  earSwayLeft: number;        // Inclinación oreja izquierda
  earSwayRight: number;       // Inclinación oreja derecha
  antennaPulse: number;       // [0, 1] Brillo/vibración de la antena estelar
  blushIntensity: number;     // [0, 1]
}

export interface PipPersonalityProfile {
  energy: number;             // [0, 1] (0 tranquilo/flemático, 1 hiperactivo)
  curiosity: number;          // [0, 1] (amplitud de seguimiento y ladeos)
  expressiveness: number;     // [0, 1] (exageración de gestos y squash)
  reactionSpeed: number;      // [0.5, 2.0]
  idleMicrogesturesFreq: number; // [0, 1]
  gazeEngagement: number;     // [0, 1]
  movementAmplitude: number;  // [0.5, 1.5]
  restThresholdSeconds: number; // Segundos hasta cabecear de sueño
}

export interface PipCustomizationDNA {
  primaryColor: string;       // Hex (#38bdf8 por defecto)
  bellyColor: string;         // Hex (#f0f9ff por defecto)
  antennaColor: string;       // Hex (#f59e0b por defecto)
  materialMode: PipMaterialMode;
  fuzzStrength: number;       // [0, 1]
  surfaceRoughness: number;   // [0.1, 1.0]
  eyeSizeScale: number;       // [0.7, 1.3]
  eyeSeparation: number;      // [0.8, 1.4]
  bodyFatness: number;        // [0.8, 1.3] (ancho basal de la gota)
  earFluffScale: number;      // [0.7, 1.4]
}

export interface KinematicState {
  elevationY: number;
  squashY: number;
  stretchXZ: number;
  tiltZ: number;
  turnY: number;
  pitchX: number;
  shadowScale: number;
  shadowOpacity: number;
}
