/**
 * @file Soft3DCompanionEngine.ts
 * @description Motor cinemático, facial y de materiales para la mascota 3D suave "Lumi".
 * Coordina 8 expresiones, 10 actuaciones en 10 fases dramáticas, conservación de volumen
 * elástica y física secundaria de orejas sin dependencias de runtime fijas.
 */

import {
  LumiExpression,
  LumiAction,
  MaterialPresetId,
  MaterialProperties,
  FacialState,
  KinematicState,
  PersonalityProfile
} from "./types.js";

export class Soft3DCompanionEngine {
  // Estado facial
  public facial: FacialState = {
    expression: "neutral",
    eyeBlinkL: 0.0,
    eyeBlinkR: 0.0,
    eyeSquint: 0.0,
    gazeYaw: 0.0,
    gazePitch: 0.0,
    pupilScale: 1.0,
    mouthCurve: 0.1,
    mouthOpen: 0.0,
    earsDroop: 0.1,
    badge: "none"
  };

  // Estado cinemático 3D
  public kinematics: KinematicState = {
    posX: 0,
    posY: 0,
    posZ: 0,
    yaw: 0,
    pitch: 0,
    roll: 0,
    squashY: 1.0,
    stretchXZ: 1.0,
    earLRotX: 0,
    earRRotX: 0,
    shadowScale: 1.0,
    shadowOpacity: 0.35
  };

  // Material activo
  public activeMaterial: MaterialProperties;

  // Personalidad activa
  public personality: PersonalityProfile;

  // Temporizadores
  private blinkTimerSec: number = 0;
  private nextBlinkIntervalSec: number = 3.5;
  private activeAction: {
    name: LumiAction;
    elapsedMs: number;
    totalDurationMs: number;
    phases: {
      name: string;
      durationMs: number;
      squashY: number;
      posY: number;
      yaw: number;
      pitch: number;
      roll: number;
      expr: LumiExpression;
    }[];
  } | null = null;

  // Física de orejas (oscilador)
  private earLVel: number = 0;
  private earRVel: number = 0;

  // Interruptor para simulación y validación de defecto DEF-ANI-BLOB
  public injectVolumeDefect: boolean = false;

  // Catálogo de Materiales
  public static readonly MATERIALS: Record<MaterialPresetId, MaterialProperties> = {
    short_plush: {
      id: "short_plush",
      name: "Peluche Corto de Algodón",
      roughness: 0.88,
      metalness: 0.0,
      sheen: 1.0,
      sheenColor: "#ffffff",
      transmission: 0.04,
      thickness: 0.6,
      clearcoat: 0.0,
      primaryColor: "#fef3c7", // Amarillo crema suave
      bellyPatchColor: "#fffbeb"
    },
    velvet_fuzz: {
      id: "velvet_fuzz",
      name: "Terciopelo Púrpura Profundo",
      roughness: 0.95,
      metalness: 0.0,
      sheen: 1.0,
      sheenColor: "#f472b6",
      transmission: 0.0,
      thickness: 0.0,
      clearcoat: 0.0,
      primaryColor: "#4c1d95", // Púrpura real
      bellyPatchColor: "#7c3aed"
    },
    soft_rubber: {
      id: "soft_rubber",
      name: "Vinilo Mate Art-Toy",
      roughness: 0.42,
      metalness: 0.0,
      sheen: 0.15,
      sheenColor: "#ffffff",
      transmission: 0.0,
      thickness: 0.0,
      clearcoat: 0.12,
      primaryColor: "#0ea5e9", // Cian cielo
      bellyPatchColor: "#e0f2fe"
    },
    translucent_gummy: {
      id: "translucent_gummy",
      name: "Gominola Translúcida Dulce",
      roughness: 0.18,
      metalness: 0.0,
      sheen: 0.3,
      sheenColor: "#f43f5e",
      transmission: 0.88,
      thickness: 1.2,
      clearcoat: 0.6,
      primaryColor: "#fb7185", // Rosa traslúcido
      bellyPatchColor: "#ffe4e6"
    },
    matte_ceramic: {
      id: "matte_ceramic",
      name: "Porcelana Biscuit Nórdica",
      roughness: 0.35,
      metalness: 0.0,
      sheen: 0.0,
      sheenColor: "#ffffff",
      transmission: 0.0,
      thickness: 0.0,
      clearcoat: 0.05,
      primaryColor: "#f8fafc", // Porcelana marfil
      bellyPatchColor: "#e2e8f0"
    }
  };

  // Catálogo de Expresiones
  public static readonly EXPRESSION_PRESETS: Record<LumiExpression, Partial<FacialState>> = {
    neutral: {
      expression: "neutral",
      eyeSquint: 0.0,
      pupilScale: 1.0,
      mouthCurve: 0.15,
      mouthOpen: 0.0,
      earsDroop: 0.15,
      badge: "none"
    },
    happy: {
      expression: "happy",
      eyeSquint: 0.75,
      pupilScale: 1.15,
      mouthCurve: 0.85,
      mouthOpen: 0.25,
      earsDroop: 0.0,
      badge: "none"
    },
    curious: {
      expression: "curious",
      eyeSquint: 0.2,
      pupilScale: 1.3,
      mouthCurve: 0.2,
      mouthOpen: 0.15,
      earsDroop: 0.25,
      badge: "question"
    },
    surprised: {
      expression: "surprised",
      eyeSquint: 0.0,
      pupilScale: 1.45,
      mouthCurve: 0.0,
      mouthOpen: 0.75,
      earsDroop: 0.0,
      badge: "none"
    },
    sleepy: {
      expression: "sleepy",
      eyeSquint: 0.4,
      pupilScale: 0.85,
      mouthCurve: 0.05,
      mouthOpen: 0.1,
      earsDroop: 0.8,
      badge: "zzz"
    },
    thinking: {
      expression: "thinking",
      eyeSquint: 0.35,
      pupilScale: 0.95,
      mouthCurve: 0.1,
      mouthOpen: 0.05,
      earsDroop: 0.3,
      badge: "none"
    },
    alert: {
      expression: "alert",
      eyeSquint: 0.1,
      pupilScale: 1.25,
      mouthCurve: -0.65,
      mouthOpen: 0.2,
      earsDroop: 0.05,
      badge: "alert_bang"
    },
    proud: {
      expression: "proud",
      eyeSquint: 0.6,
      pupilScale: 1.05,
      mouthCurve: 0.6,
      mouthOpen: 0.0,
      earsDroop: 0.0,
      badge: "stars"
    }
  };

  constructor(materialPreset: MaterialPresetId = "short_plush") {
    this.activeMaterial = { ...Soft3DCompanionEngine.MATERIALS[materialPreset] };
    this.personality = {
      name: "playful_companion",
      energy: 0.75,
      curiosity: 0.85,
      shyness: 0.25,
      whimsy: 0.8,
      omega0: 16.0,
      zeta: 0.58
    };
  }

  public setExpression(expr: LumiExpression): void {
    const preset = Soft3DCompanionEngine.EXPRESSION_PRESETS[expr];
    if (preset) {
      Object.assign(this.facial, preset);
    }
  }

  public setMaterial(presetId: MaterialPresetId): void {
    const mat = Soft3DCompanionEngine.MATERIALS[presetId];
    if (mat) {
      this.activeMaterial = { ...mat };
    }
  }

  /**
   * Dispara una de las 10 actuaciones contextuales en 10 fases dramáticas.
   */
  public triggerAction(name: LumiAction): void {
    this.activeAction = this.buildActionTimeline(name);
  }

  public manualSquashOverride: number | null = null;

  public setSquash(sy: number): void {
    this.manualSquashOverride = sy;
  }

  public clearSquashOverride(): void {
    this.manualSquashOverride = null;
  }

  /**
   * Actualiza el reloj físico temporal con paso dtSec.
   */
  public update(dtSec: number): void {
    const dtMs = dtSec * 1000;

    // 1. Ciclo de Parpadeo de Poisson
    this.blinkTimerSec += dtSec;
    if (this.blinkTimerSec >= this.nextBlinkIntervalSec) {
      this.facial.eyeBlinkL = 1.0;
      this.facial.eyeBlinkR = 1.0;
      this.blinkTimerSec = 0;
      this.nextBlinkIntervalSec = 2.5 + Math.random() * 3.0; // Intervalo de Poisson
    } else if (this.facial.eyeBlinkL > 0) {
      this.facial.eyeBlinkL = Math.max(0, this.facial.eyeBlinkL - dtSec * 7.5);
      this.facial.eyeBlinkR = this.facial.eyeBlinkL;
    }

    // 2. Progresión de actuación activa
    if (this.activeAction) {
      this.activeAction.elapsedMs += dtMs;
      let accum = 0;
      let currentPhase = this.activeAction.phases[0];

      for (const ph of this.activeAction.phases) {
        if (this.activeAction.elapsedMs <= accum + ph.durationMs) {
          currentPhase = ph;
          break;
        }
        accum += ph.durationMs;
      }

      this.kinematics.squashY = currentPhase.squashY;
      this.kinematics.posY = currentPhase.posY;
      this.kinematics.yaw = currentPhase.yaw;
      this.kinematics.pitch = currentPhase.pitch;
      this.kinematics.roll = currentPhase.roll;
      this.setExpression(currentPhase.expr);

      if (this.activeAction.elapsedMs >= this.activeAction.totalDurationMs) {
        this.activeAction = null;
      }
    } else if (this.manualSquashOverride !== null) {
      this.kinematics.squashY = this.manualSquashOverride;
    } else {
      // Reposo continuo (Respiración sinusoidal sutil)
      const breatheT = performance.now() * 0.002;
      this.kinematics.squashY = 1.0 + Math.sin(breatheT) * 0.02;
      this.kinematics.posY = Math.sin(breatheT) * 1.5;
    }

    // 3. Conservación de Volumen en Squash & Stretch
    if (this.injectVolumeDefect) {
      // INYECCIÓN DE DEFECTO: El estiramiento se mantiene rígido en 1.0
      this.kinematics.stretchXZ = 1.0;
    } else {
      // REGLA MATEMÁTICA: Sx = Sz = 1 / sqrt(Sy)
      this.kinematics.stretchXZ = 1.0 / Math.sqrt(Math.max(0.4, this.kinematics.squashY));
    }

    // 4. Sombra de Contacto Acoplada a la Altura
    const jumpHeightRatio = Math.max(0, Math.min(1, this.kinematics.posY / 60.0));
    this.kinematics.shadowScale = (1.0 + jumpHeightRatio * 0.35) * this.kinematics.stretchXZ;
    this.kinematics.shadowOpacity = Math.max(0.08, 0.35 - jumpHeightRatio * 0.25);

    // 5. Física Secundaria de Orejas (Resorte Amortiguado)
    const earDriver = -(this.kinematics.yaw * 2.5 + this.kinematics.roll * 1.8);
    const restoringL = -(this.personality.omega0 * this.personality.omega0) * this.kinematics.earLRotX;
    const dampingL = -2.0 * this.personality.zeta * this.personality.omega0 * this.earLVel;
    const accelL = restoringL + dampingL + earDriver;
    this.earLVel += accelL * dtSec;
    this.kinematics.earLRotX += this.earLVel * dtSec;

    // Oreja derecha con asimetría sutil
    const restoringR = -(this.personality.omega0 * this.personality.omega0) * this.kinematics.earRRotX;
    const dampingR = -2.0 * this.personality.zeta * this.personality.omega0 * this.earRVel;
    const accelR = restoringR + dampingR - earDriver * 0.9;
    this.earRVel += accelR * dtSec;
    this.kinematics.earRRotX += this.earRVel * dtSec;
  }

  /**
   * Construye una línea de tiempo cinemática de 10 fases para cada una de las 10 actuaciones.
   */
  private buildActionTimeline(name: LumiAction) {
    const p = this.personality;
    const baseEnergy = p.energy;

    switch (name) {
      case "act_bounce_happy":
        return {
          name,
          elapsedMs: 0,
          totalDurationMs: 980,
          phases: [
            { name: "stimulus", durationMs: 40, squashY: 1.0, posY: 0, yaw: 0, pitch: 0, roll: 0, expr: "happy" as LumiExpression },
            { name: "interpretation", durationMs: 60, squashY: 1.02, posY: -1, yaw: 0, pitch: -0.05, roll: 0, expr: "happy" as LumiExpression },
            { name: "anticipation", durationMs: 140, squashY: 0.72, posY: 8, yaw: 0, pitch: 0.12, roll: 0, expr: "happy" as LumiExpression },
            { name: "launch", durationMs: 160, squashY: 1.25, posY: -38 * baseEnergy, yaw: 0.1, pitch: -0.2, roll: 0, expr: "happy" as LumiExpression },
            { name: "apex", durationMs: 90, squashY: 1.08, posY: -45 * baseEnergy, yaw: 0.2, pitch: 0, roll: 0.05, expr: "happy" as LumiExpression },
            { name: "follow_through", durationMs: 130, squashY: 0.88, posY: 6, yaw: 0.05, pitch: 0.1, roll: -0.02, expr: "happy" as LumiExpression },
            { name: "rebound", durationMs: 120, squashY: 1.10, posY: -6, yaw: 0, pitch: -0.04, roll: 0, expr: "happy" as LumiExpression },
            { name: "assimilation", durationMs: 100, squashY: 0.96, posY: 2, yaw: 0, pitch: 0.02, roll: 0, expr: "happy" as LumiExpression },
            { name: "settling", durationMs: 90, squashY: 1.0, posY: 0, yaw: 0, pitch: 0, roll: 0, expr: "happy" as LumiExpression },
            { name: "context_memory", durationMs: 50, squashY: 1.0, posY: 0, yaw: 0, pitch: 0, roll: 0, expr: "happy" as LumiExpression }
          ]
        };

      case "act_fuzz_shake":
        return {
          name,
          elapsedMs: 0,
          totalDurationMs: 1100,
          phases: [
            { name: "stimulus", durationMs: 50, squashY: 1.0, posY: 0, yaw: 0, pitch: 0, roll: 0, expr: "neutral" as LumiExpression },
            { name: "interpretation", durationMs: 70, squashY: 0.96, posY: 1, yaw: -0.05, pitch: 0.04, roll: 0, expr: "neutral" as LumiExpression },
            { name: "anticipation", durationMs: 120, squashY: 0.85, posY: 4, yaw: -0.15, pitch: 0.1, roll: -0.08, expr: "neutral" as LumiExpression },
            { name: "shake_1", durationMs: 100, squashY: 1.02, posY: -2, yaw: 0.35, pitch: -0.05, roll: 0.15, expr: "happy" as LumiExpression },
            { name: "shake_2", durationMs: 100, squashY: 1.02, posY: -2, yaw: -0.35, pitch: 0.05, roll: -0.15, expr: "happy" as LumiExpression },
            { name: "shake_3", durationMs: 100, squashY: 1.02, posY: -2, yaw: 0.30, pitch: -0.05, roll: 0.12, expr: "happy" as LumiExpression },
            { name: "settling_shake", durationMs: 140, squashY: 0.92, posY: 2, yaw: -0.08, pitch: 0.04, roll: -0.04, expr: "happy" as LumiExpression },
            { name: "puff_up", durationMs: 180, squashY: 1.08, posY: -4, yaw: 0, pitch: -0.08, roll: 0, expr: "proud" as LumiExpression },
            { name: "relax", durationMs: 180, squashY: 1.0, posY: 0, yaw: 0, pitch: 0, roll: 0, expr: "proud" as LumiExpression },
            { name: "context_memory", durationMs: 60, squashY: 1.0, posY: 0, yaw: 0, pitch: 0, roll: 0, expr: "proud" as LumiExpression }
          ]
        };

      case "act_startle":
        return {
          name,
          elapsedMs: 0,
          totalDurationMs: 950,
          phases: [
            { name: "stimulus", durationMs: 30, squashY: 1.0, posY: 0, yaw: 0, pitch: 0, roll: 0, expr: "alert" as LumiExpression },
            { name: "jolt", durationMs: 50, squashY: 0.82, posY: 6, yaw: 0, pitch: 0.15, roll: 0, expr: "alert" as LumiExpression },
            { name: "jump_back", durationMs: 150, squashY: 1.28, posY: -28, yaw: -0.1, pitch: -0.22, roll: 0, expr: "alert" as LumiExpression },
            { name: "apex", durationMs: 90, squashY: 1.05, posY: -32, yaw: 0.12, pitch: -0.15, roll: 0.08, expr: "alert" as LumiExpression },
            { name: "land_heavy", durationMs: 140, squashY: 0.74, posY: 10, yaw: -0.05, pitch: 0.18, roll: -0.04, expr: "alert" as LumiExpression },
            { name: "rebound", durationMs: 130, squashY: 1.08, posY: -4, yaw: 0.04, pitch: -0.05, roll: 0, expr: "alert" as LumiExpression },
            { name: "look_threat", durationMs: 120, squashY: 0.94, posY: 2, yaw: 0.15, pitch: 0.05, roll: 0, expr: "alert" as LumiExpression },
            { name: "reassure", durationMs: 110, squashY: 1.02, posY: -1, yaw: -0.05, pitch: -0.02, roll: 0, expr: "neutral" as LumiExpression },
            { name: "settling", durationMs: 80, squashY: 1.0, posY: 0, yaw: 0, pitch: 0, roll: 0, expr: "neutral" as LumiExpression },
            { name: "context_memory", durationMs: 50, squashY: 1.0, posY: 0, yaw: 0, pitch: 0, roll: 0, expr: "neutral" as LumiExpression }
          ]
        };

      default:
        // Actuaciones generales (act_breathe_idle, act_look_around, act_yawn_sleep, act_celebrate, etc.)
        return {
          name,
          elapsedMs: 0,
          totalDurationMs: 1000,
          phases: [
            { name: "stimulus", durationMs: 50, squashY: 1.0, posY: 0, yaw: 0, pitch: 0, roll: 0, expr: "neutral" as LumiExpression },
            { name: "interpretation", durationMs: 80, squashY: 1.02, posY: -1, yaw: 0.05, pitch: -0.04, roll: 0.02, expr: "neutral" as LumiExpression },
            { name: "anticipation", durationMs: 120, squashY: 0.88, posY: 4, yaw: -0.08, pitch: 0.1, roll: -0.04, expr: "curious" as LumiExpression },
            { name: "action", durationMs: 180, squashY: 1.15, posY: -18, yaw: 0.25, pitch: -0.15, roll: 0.08, expr: "curious" as LumiExpression },
            { name: "accent", durationMs: 100, squashY: 1.05, posY: -12, yaw: 0.32, pitch: 0.0, roll: 0.10, expr: "curious" as LumiExpression },
            { name: "follow_through", durationMs: 130, squashY: 0.92, posY: 3, yaw: 0.15, pitch: 0.08, roll: 0.04, expr: "curious" as LumiExpression },
            { name: "rebound", durationMs: 120, squashY: 1.04, posY: -2, yaw: 0.06, pitch: -0.03, roll: 0.01, expr: "neutral" as LumiExpression },
            { name: "assimilation", durationMs: 100, squashY: 0.98, posY: 1, yaw: 0.02, pitch: 0.02, roll: 0, expr: "neutral" as LumiExpression },
            { name: "settling", durationMs: 80, squashY: 1.0, posY: 0, yaw: 0, pitch: 0, roll: 0, expr: "neutral" as LumiExpression },
            { name: "context_memory", durationMs: 40, squashY: 1.0, posY: 0, yaw: 0, pitch: 0, roll: 0, expr: "neutral" as LumiExpression }
          ]
        };
    }
  }
}
