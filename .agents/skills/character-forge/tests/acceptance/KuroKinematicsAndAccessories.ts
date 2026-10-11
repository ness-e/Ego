/**
 * @file KuroKinematicsAndAccessories.ts
 * @description Cinemática, expresiones faciales, actuaciones en 10 fases dramáticas
 * y renderizado de accesorios con profundidad Z y movimiento secundario para "Kuro".
 */

import { KURO_IDENTITY_INVARIANTS } from "./KuroCharacterDefinition.js";

export type KuroExpressionName =
  | "neutral_focus"
  | "curious_inquiry"
  | "critical_alert"
  | "compile_fatigue"
  | "triumph_celebrate";

export type KuroActionName =
  | "act_inspect_file"
  | "act_alert_timeout"
  | "act_celebrate_success"
  | "act_nod_approval"
  | "act_drowse_idle";

export interface KuroExpressionConfig {
  name: KuroExpressionName;
  leftEyeScale: { x: number; y: number };
  rightEyeScale: { x: number; y: number };
  pupilOffset: { x: number; y: number }; // [-1, 1]
  browAngleDeg: number;
  mouthCurve: number; // [-1 sonrisa, 0 recta, 1 curva hacia abajo]
  badgeType: "none" | "alert_bang" | "question_mark" | "stars_sparkle" | "zzz_sleep";
}

export interface KuroActionTimeline {
  name: KuroActionName;
  description: string;
  totalDurationMs: number;
  phases: {
    phase: string;
    durationMs: number;
    squashY: number;
    stretchX: number;
    pitchRad: number;
    yawRad: number;
    bodyOffsetY: number;
    expression: KuroExpressionName;
  }[];
}

export interface PendulumState {
  angleRad: number;
  angularVel: number;
  lengthPx: number;
  omega0: number; // Frecuencia natural
  zeta: number;   // Amortiguamiento
}

export interface RenderLayerInstruction {
  layerId: string;
  zDepth: number; // Mayor zDepth = más cercano a la cámara
  orderIndex: number;
  visible: boolean;
  occluded: boolean;
  draw(ctx: any, bounds: any, transform: any): void;
}

export class KuroKinematicEngine {
  // Estado espacial y cinemático
  public posX: number = 0;
  public posY: number = 0;
  public velX: number = 0;
  public velY: number = 0;
  public accelX: number = 0;
  public accelY: number = 0;

  // Ángulos de orientación en radianes (Yaw en Y, Pitch en X)
  public yaw: number = 0;
  public pitch: number = 0;

  // Deformación elástica Squash & Stretch
  public scaleX: number = 1.0;
  public scaleY: number = 1.0;

  // Expresión actual
  public currentExpression: KuroExpressionName = "neutral_focus";

  // Estado del péndulo de la cadena del monóculo (movimiento secundario)
  public pendulum: PendulumState = {
    angleRad: 0.0,
    angularVel: 0.0,
    lengthPx: 45.0,
    omega0: 9.5, // rad/s
    zeta: 0.28   // Amortiguamiento ligero para inercia visible
  };

  // Temporizador de actuación activa
  private activeAction: KuroActionTimeline | null = null;
  private actionElapsedMs: number = 0;

  // Configuración de las 5 Expresiones Faciales
  public static readonly EXPRESSIONS: Record<KuroExpressionName, KuroExpressionConfig> = {
    neutral_focus: {
      name: "neutral_focus",
      leftEyeScale: { x: 1.0, y: 1.0 },
      rightEyeScale: { x: 1.0, y: 1.0 },
      pupilOffset: { x: 0.0, y: 0.0 },
      browAngleDeg: 0,
      mouthCurve: 0.0,
      badgeType: "none"
    },
    curious_inquiry: {
      name: "curious_inquiry",
      leftEyeScale: { x: 1.25, y: 1.25 }, // Ojo izquierdo dilatado por sorpresa inquisitiva
      rightEyeScale: { x: 0.85, y: 0.85 }, // Ojo del monóculo entrecerrado analítico
      pupilOffset: { x: 0.45, y: -0.2 },
      browAngleDeg: 14,
      mouthCurve: 0.2,
      badgeType: "question_mark"
    },
    critical_alert: {
      name: "critical_alert",
      leftEyeScale: { x: 1.35, y: 1.4 },
      rightEyeScale: { x: 1.35, y: 1.4 },
      pupilOffset: { x: 0.0, y: -0.4 },
      browAngleDeg: -22, // Ceño fruncido tenso
      mouthCurve: 0.8,   // Labio tenso hacia abajo
      badgeType: "alert_bang"
    },
    compile_fatigue: {
      name: "compile_fatigue",
      leftEyeScale: { x: 0.9, y: 0.35 }, // Párpados caídos
      rightEyeScale: { x: 0.9, y: 0.35 },
      pupilOffset: { x: 0.0, y: 0.3 },
      browAngleDeg: 8,
      mouthCurve: 0.1,
      badgeType: "none"
    },
    triumph_celebrate: {
      name: "triumph_celebrate",
      leftEyeScale: { x: 1.15, y: 0.85 }, // Ojos sonrientes en arco biconvexo
      rightEyeScale: { x: 1.15, y: 0.85 },
      pupilOffset: { x: 0.0, y: -0.1 },
      browAngleDeg: 12,
      mouthCurve: -0.9, // Sonrisa amplia
      badgeType: "stars_sparkle"
    }
  };

  // Configuración de las 5 Actuaciones Contextuales en 10 Fases Dramáticas
  public static readonly ACTIONS: Record<KuroActionName, KuroActionTimeline> = {
    act_inspect_file: {
      name: "act_inspect_file",
      description: "Inspección de archivo/código soltado: anticipación con retroceso, salto hacia el cursor, escaneo analítico y confirmación.",
      totalDurationMs: 1100,
      phases: [
        { phase: "stimulus", durationMs: 60, squashY: 1.0, stretchX: 1.0, pitchRad: 0, yawRad: 0, bodyOffsetY: 0, expression: "neutral_focus" },
        { phase: "interpretation", durationMs: 90, squashY: 1.02, stretchX: 0.98, pitchRad: -0.08, yawRad: 0.1, bodyOffsetY: -2, expression: "curious_inquiry" },
        { phase: "anticipation", durationMs: 140, squashY: 0.82, stretchX: 1.18, pitchRad: 0.15, yawRad: -0.1, bodyOffsetY: 12, expression: "curious_inquiry" },
        { phase: "action", durationMs: 180, squashY: 1.18, stretchX: 0.88, pitchRad: -0.22, yawRad: 0.28, bodyOffsetY: -25, expression: "curious_inquiry" },
        { phase: "accent", durationMs: 100, squashY: 1.08, stretchX: 0.94, pitchRad: -0.18, yawRad: 0.35, bodyOffsetY: -20, expression: "curious_inquiry" },
        { phase: "secondary_reaction", durationMs: 130, squashY: 0.94, stretchX: 1.06, pitchRad: 0.05, yawRad: 0.2, bodyOffsetY: 4, expression: "neutral_focus" },
        { phase: "rebound_oscillation", durationMs: 120, squashY: 1.05, stretchX: 0.96, pitchRad: -0.04, yawRad: 0.08, bodyOffsetY: -3, expression: "neutral_focus" },
        { phase: "assimilation", durationMs: 110, squashY: 1.0, stretchX: 1.0, pitchRad: 0.0, yawRad: 0.02, bodyOffsetY: 0, expression: "neutral_focus" },
        { phase: "settling", durationMs: 120, squashY: 0.98, stretchX: 1.02, pitchRad: 0.02, yawRad: 0.0, bodyOffsetY: 1, expression: "neutral_focus" },
        { phase: "context_memory", durationMs: 50, squashY: 1.0, stretchX: 1.0, pitchRad: 0.0, yawRad: 0.0, bodyOffsetY: 0, expression: "neutral_focus" }
      ]
    },

    act_alert_timeout: {
      name: "act_alert_timeout",
      description: "Alarma crítica de proceso o error: sobresalto vertical inmediato, sacudida lateral (yaw jitter) y activación de badge de alerta.",
      totalDurationMs: 1050,
      phases: [
        { phase: "stimulus", durationMs: 40, squashY: 1.0, stretchX: 1.0, pitchRad: 0, yawRad: 0, bodyOffsetY: 0, expression: "critical_alert" },
        { phase: "interpretation", durationMs: 70, squashY: 0.9, stretchX: 1.1, pitchRad: 0.1, yawRad: 0, bodyOffsetY: 4, expression: "critical_alert" },
        { phase: "anticipation", durationMs: 100, squashY: 0.78, stretchX: 1.22, pitchRad: 0.18, yawRad: -0.05, bodyOffsetY: 15, expression: "critical_alert" },
        { phase: "action", durationMs: 160, squashY: 1.25, stretchX: 0.85, pitchRad: -0.25, yawRad: 0.2, bodyOffsetY: -30, expression: "critical_alert" },
        { phase: "accent", durationMs: 80, squashY: 1.12, stretchX: 0.92, pitchRad: -0.15, yawRad: -0.2, bodyOffsetY: -22, expression: "critical_alert" },
        { phase: "secondary_reaction", durationMs: 140, squashY: 0.92, stretchX: 1.08, pitchRad: 0.1, yawRad: 0.15, bodyOffsetY: 6, expression: "critical_alert" },
        { phase: "rebound_oscillation", durationMs: 130, squashY: 1.06, stretchX: 0.95, pitchRad: -0.06, yawRad: -0.1, bodyOffsetY: -4, expression: "critical_alert" },
        { phase: "assimilation", durationMs: 120, squashY: 0.97, stretchX: 1.02, pitchRad: 0.02, yawRad: 0.05, bodyOffsetY: 2, expression: "critical_alert" },
        { phase: "settling", durationMs: 150, squashY: 1.0, stretchX: 1.0, pitchRad: 0.0, yawRad: 0.0, bodyOffsetY: 0, expression: "critical_alert" },
        { phase: "context_memory", durationMs: 60, squashY: 1.0, stretchX: 1.0, pitchRad: 0.0, yawRad: 0.0, bodyOffsetY: 0, expression: "critical_alert" }
      ]
    },

    act_celebrate_success: {
      name: "act_celebrate_success",
      description: "Éxito de compilación / CI aprobado: compresión viva, salto acrobático en espiral y caída jubilosa amortiguada.",
      totalDurationMs: 1250,
      phases: [
        { phase: "stimulus", durationMs: 50, squashY: 1.0, stretchX: 1.0, pitchRad: 0, yawRad: 0, bodyOffsetY: 0, expression: "triumph_celebrate" },
        { phase: "interpretation", durationMs: 80, squashY: 1.04, stretchX: 0.96, pitchRad: -0.05, yawRad: 0, bodyOffsetY: -3, expression: "triumph_celebrate" },
        { phase: "anticipation", durationMs: 150, squashY: 0.72, stretchX: 1.30, pitchRad: 0.18, yawRad: 0, bodyOffsetY: 20, expression: "triumph_celebrate" },
        { phase: "action", durationMs: 220, squashY: 1.28, stretchX: 0.82, pitchRad: -0.28, yawRad: 0.45, bodyOffsetY: -45, expression: "triumph_celebrate" },
        { phase: "accent", durationMs: 120, squashY: 1.10, stretchX: 0.92, pitchRad: 0.0, yawRad: 0.65, bodyOffsetY: -40, expression: "triumph_celebrate" },
        { phase: "secondary_reaction", durationMs: 160, squashY: 0.84, stretchX: 1.16, pitchRad: 0.12, yawRad: 0.25, bodyOffsetY: 10, expression: "triumph_celebrate" },
        { phase: "rebound_oscillation", durationMs: 150, squashY: 1.10, stretchX: 0.92, pitchRad: -0.08, yawRad: 0.1, bodyOffsetY: -6, expression: "triumph_celebrate" },
        { phase: "assimilation", durationMs: 130, squashY: 0.96, stretchX: 1.04, pitchRad: 0.04, yawRad: 0.02, bodyOffsetY: 2, expression: "triumph_celebrate" },
        { phase: "settling", durationMs: 140, squashY: 1.0, stretchX: 1.0, pitchRad: 0.0, yawRad: 0.0, bodyOffsetY: 0, expression: "triumph_celebrate" },
        { phase: "context_memory", durationMs: 50, squashY: 1.0, stretchX: 1.0, pitchRad: 0.0, yawRad: 0.0, bodyOffsetY: 0, expression: "triumph_celebrate" }
      ]
    },

    act_nod_approval: {
      name: "act_nod_approval",
      description: "Confirmación afirmativa del agente: doble cabeceo rítmico coordinado con mirada atenta.",
      totalDurationMs: 950,
      phases: [
        { phase: "stimulus", durationMs: 50, squashY: 1.0, stretchX: 1.0, pitchRad: 0, yawRad: 0, bodyOffsetY: 0, expression: "neutral_focus" },
        { phase: "interpretation", durationMs: 80, squashY: 1.02, stretchX: 0.98, pitchRad: -0.06, yawRad: 0, bodyOffsetY: -2, expression: "neutral_focus" },
        { phase: "anticipation", durationMs: 100, squashY: 0.92, stretchX: 1.08, pitchRad: -0.12, yawRad: 0, bodyOffsetY: -6, expression: "neutral_focus" },
        { phase: "action", durationMs: 130, squashY: 1.06, stretchX: 0.95, pitchRad: 0.22, yawRad: 0, bodyOffsetY: 10, expression: "neutral_focus" },
        { phase: "accent", durationMs: 90, squashY: 0.95, stretchX: 1.04, pitchRad: -0.08, yawRad: 0, bodyOffsetY: -4, expression: "neutral_focus" },
        { phase: "secondary_reaction", durationMs: 120, squashY: 1.04, stretchX: 0.96, pitchRad: 0.18, yawRad: 0, bodyOffsetY: 8, expression: "neutral_focus" },
        { phase: "rebound_oscillation", durationMs: 110, squashY: 0.98, stretchX: 1.02, pitchRad: -0.05, yawRad: 0, bodyOffsetY: -2, expression: "neutral_focus" },
        { phase: "assimilation", durationMs: 100, squashY: 1.01, stretchX: 0.99, pitchRad: 0.04, yawRad: 0, bodyOffsetY: 1, expression: "neutral_focus" },
        { phase: "settling", durationMs: 120, squashY: 1.0, stretchX: 1.0, pitchRad: 0.0, yawRad: 0.0, bodyOffsetY: 0, expression: "neutral_focus" },
        { phase: "context_memory", durationMs: 50, squashY: 1.0, stretchX: 1.0, pitchRad: 0.0, yawRad: 0.0, bodyOffsetY: 0, expression: "neutral_focus" }
      ]
    },

    act_drowse_idle: {
      name: "act_drowse_idle",
      description: "Entrada en reposo por inactividad: descenso gradual del centro de masa, párpados pesados y balanceo suave de péndulo.",
      totalDurationMs: 1300,
      phases: [
        { phase: "stimulus", durationMs: 60, squashY: 1.0, stretchX: 1.0, pitchRad: 0, yawRad: 0, bodyOffsetY: 0, expression: "compile_fatigue" },
        { phase: "interpretation", durationMs: 100, squashY: 0.96, stretchX: 1.03, pitchRad: 0.04, yawRad: 0.02, bodyOffsetY: 2, expression: "compile_fatigue" },
        { phase: "anticipation", durationMs: 150, squashY: 0.92, stretchX: 1.06, pitchRad: 0.08, yawRad: -0.03, bodyOffsetY: 6, expression: "compile_fatigue" },
        { phase: "action", durationMs: 200, squashY: 0.86, stretchX: 1.12, pitchRad: 0.16, yawRad: 0.05, bodyOffsetY: 12, expression: "compile_fatigue" },
        { phase: "accent", durationMs: 140, squashY: 0.84, stretchX: 1.14, pitchRad: 0.18, yawRad: 0.02, bodyOffsetY: 14, expression: "compile_fatigue" },
        { phase: "secondary_reaction", durationMs: 180, squashY: 0.88, stretchX: 1.10, pitchRad: 0.12, yawRad: -0.04, bodyOffsetY: 10, expression: "compile_fatigue" },
        { phase: "rebound_oscillation", durationMs: 160, squashY: 0.85, stretchX: 1.13, pitchRad: 0.16, yawRad: 0.02, bodyOffsetY: 13, expression: "compile_fatigue" },
        { phase: "assimilation", durationMs: 130, squashY: 0.84, stretchX: 1.14, pitchRad: 0.17, yawRad: 0.0, bodyOffsetY: 14, expression: "compile_fatigue" },
        { phase: "settling", durationMs: 130, squashY: 0.84, stretchX: 1.14, pitchRad: 0.17, yawRad: 0.0, bodyOffsetY: 14, expression: "compile_fatigue" },
        { phase: "context_memory", durationMs: 50, squashY: 0.84, stretchX: 1.14, pitchRad: 0.17, yawRad: 0.0, bodyOffsetY: 14, expression: "compile_fatigue" }
      ]
    }
  };

  /**
   * Dispara una de las 5 actuaciones contextuales.
   */
  public triggerAction(name: KuroActionName): void {
    const action = KuroKinematicEngine.ACTIONS[name];
    if (action) {
      this.activeAction = action;
      this.actionElapsedMs = 0;
    }
  }

  /**
   * Actualiza la cinemática temporal con paso dt en segundos.
   */
  public update(dtSec: number): void {
    const dtMs = dtSec * 1000;

    // 1. Progresión de la actuación dramática activa
    if (this.activeAction) {
      this.actionElapsedMs += dtMs;
      let accumMs = 0;
      let currentPhaseConfig = this.activeAction.phases[0];

      for (const phase of this.activeAction.phases) {
        if (this.actionElapsedMs <= accumMs + phase.durationMs) {
          currentPhaseConfig = phase;
          break;
        }
        accumMs += phase.durationMs;
      }

      this.scaleY = currentPhaseConfig.squashY;
      this.scaleX = currentPhaseConfig.stretchX;
      this.pitch = currentPhaseConfig.pitchRad;
      this.yaw = currentPhaseConfig.yawRad;
      this.posY = currentPhaseConfig.bodyOffsetY;
      this.currentExpression = currentPhaseConfig.expression;

      if (this.actionElapsedMs >= this.activeAction.totalDurationMs) {
        this.activeAction = null;
        this.actionElapsedMs = 0;
      }
    }

    // 2. Simulación física del péndulo de la cadena (movimiento secundario)
    // Ecuación: d^2(theta)/dt^2 + 2*zeta*omega0*d(theta)/dt + omega0^2*theta = - (accelX / length)
    const g = 980.0; // cm/s^2 escala visual
    const effectiveAccelX = this.accelX + (this.yaw * 120.0); // La rotación yaw induce aceleración aparente
    const restoringForce = -(this.pendulum.omega0 * this.pendulum.omega0) * this.pendulum.angleRad;
    const dampingForce = -2.0 * this.pendulum.zeta * this.pendulum.omega0 * this.pendulum.angularVel;
    const inertialDriver = -(effectiveAccelX / this.pendulum.lengthPx);

    const angularAccel = restoringForce + dampingForce + inertialDriver;
    this.pendulum.angularVel += angularAccel * dtSec;
    this.pendulum.angleRad += this.pendulum.angularVel * dtSec;
  }

  /**
   * Genera el desglose ordenado de capas de dibujo con partición de profundidad Z
   * resolviendo oclusión entre cráneo, ojos, monóculo y cadena.
   * 
   * Si injectDefectZOrder es true, deliberadamente invierte el orden del monóculo
   * para simular y validar el defecto DEF-GEO-ZOCL en el laboratorio.
   */
  public compileRenderLayers(
    bounds: { cx: number; cy: number; radius: number },
    injectDefectZOrder: boolean = false
  ): RenderLayerInstruction[] {
    const { cx, cy, radius } = bounds;
    const r = radius;

    // Desplazamientos proyectados por rotación Euler (Yaw en Y, Pitch en X)
    const faceOffsetX = Math.sin(this.yaw) * (r * 0.42);
    const faceOffsetY = Math.sin(this.pitch) * (r * 0.35) + this.posY;

    // Coordenadas base del monóculo (socket en ojo derecho)
    const socketRx = KURO_IDENTITY_INVARIANTS.monocleSocket.relativeX;
    const socketRy = KURO_IDENTITY_INVARIANTS.monocleSocket.relativeY;
    const monocleX = cx + faceOffsetX + (socketRx * r * Math.cos(this.yaw));
    const monocleY = cy + faceOffsetY + (socketRy * r);
    const monocleRadius = r * KURO_IDENTITY_INVARIANTS.monocleSocket.lensRadiusRatio;

    // Profundidad Z analítica del monóculo:
    // Z = cos(yaw) * z_local - sin(yaw) * x_local
    // Como el monóculo está en x > 0: al girar a la izquierda (yaw < 0), se proyecta al frente (Z > 0);
    // al girar a la derecha extrema (yaw > 1.1 rad / ~65°), el rostro lo ocluye parcialmente.
    const monocleZDepth = Math.cos(this.yaw) * 1.0 - Math.sin(this.yaw) * (socketRx * 2.0);
    const isOccludedBySkull = monocleZDepth < -0.15;

    // Orden de dibujo nominal de capas:
    // 10: Sombra proyectada en el suelo
    // 20: Cráneo de tinta base (Superelipsoide)
    // 30: Ojo izquierdo
    // 40: Ojo derecho
    // 50: Monóculo de latón (Z > 0 en ángulo frontal)
    // 60: Péndulo de la cadena del monóculo
    // 70: Highlight especular y brillo ceroso superior
    // 80: Badge contextual flotante (! o ?)
    let monocleOrder = 50;
    if (injectDefectZOrder) {
      // INYECCIÓN DE DEFECTO: El monóculo se dibuja con orderIndex 15 (detrás del cráneo)
      monocleOrder = 15;
    }

    const layers: RenderLayerInstruction[] = [
      {
        layerId: "drop_shadow",
        zDepth: -100,
        orderIndex: 10,
        visible: true,
        occluded: false,
        draw: (ctx) => {
          ctx.save();
          const shadowY = cy + r * 0.95;
          const shadowRx = r * 0.75 * this.scaleX;
          const shadowRy = r * 0.18;
          ctx.beginPath();
          ctx.ellipse(cx, shadowY, shadowRx, shadowRy, 0, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(15, 23, 42, 0.28)";
          ctx.fill();
          ctx.restore();
        }
      },
      {
        layerId: "skull_ink_body",
        zDepth: 0,
        orderIndex: 20,
        visible: true,
        occluded: false,
        draw: (ctx) => {
          ctx.save();
          ctx.translate(cx, cy + this.posY);
          ctx.scale(this.scaleX, this.scaleY);

          // Superelipsoide r(y) = (1 - |y|^p)^(1/p) simulado mediante Bezier compuesta
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          
          // Gradiente de tinta ferrogálica profunda
          const inkGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.1, 0, 0, r);
          inkGrad.addColorStop(0, "#27272a");
          inkGrad.addColorStop(0.65, "#18181b");
          inkGrad.addColorStop(1, "#09090b");
          ctx.fillStyle = inkGrad;
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = "#09090b";
          ctx.stroke();
          ctx.restore();
        }
      },
      {
        layerId: "eyes_layer",
        zDepth: 10,
        orderIndex: 30,
        visible: true,
        occluded: false,
        draw: (ctx) => {
          ctx.save();
          const expr = KuroKinematicEngine.EXPRESSIONS[this.currentExpression];
          const eyeDist = r * KURO_IDENTITY_INVARIANTS.interpupillaryDistanceRatio;
          const eyeY = cy + faceOffsetY + (r * -0.06);

          // Ojo Izquierdo
          const leftEyeX = cx + faceOffsetX - eyeDist * 0.5 * Math.cos(this.yaw);
          const leftEyeRx = r * KURO_IDENTITY_INVARIANTS.eyeSizeRatio * 0.55 * expr.leftEyeScale.x;
          const leftEyeRy = r * KURO_IDENTITY_INVARIANTS.eyeSizeRatio * 0.75 * expr.leftEyeScale.y;

          ctx.beginPath();
          ctx.ellipse(leftEyeX, eyeY, leftEyeRx, leftEyeRy, 0, 0, Math.PI * 2);
          ctx.fillStyle = KURO_IDENTITY_INVARIANTS.colorPalette.eyeInk;
          ctx.fill();

          // Pupila izquierda
          ctx.beginPath();
          const pupX = leftEyeX + (expr.pupilOffset.x * leftEyeRx * 0.4);
          const pupY = eyeY + (expr.pupilOffset.y * leftEyeRy * 0.4);
          ctx.arc(pupX, pupY, leftEyeRx * 0.45, 0, Math.PI * 2);
          ctx.fillStyle = KURO_IDENTITY_INVARIANTS.colorPalette.pupilColor;
          ctx.fill();

          // Ojo Derecho (dentro del monóculo)
          const rightEyeX = cx + faceOffsetX + eyeDist * 0.5 * Math.cos(this.yaw);
          const rightEyeRx = r * KURO_IDENTITY_INVARIANTS.eyeSizeRatio * 0.55 * expr.rightEyeScale.x;
          const rightEyeRy = r * KURO_IDENTITY_INVARIANTS.eyeSizeRatio * 0.75 * expr.rightEyeScale.y;

          ctx.beginPath();
          ctx.ellipse(rightEyeX, eyeY, rightEyeRx, rightEyeRy, 0, 0, Math.PI * 2);
          ctx.fillStyle = KURO_IDENTITY_INVARIANTS.colorPalette.eyeInk;
          ctx.fill();

          // Pupila derecha
          ctx.beginPath();
          const pupRightX = rightEyeX + (expr.pupilOffset.x * rightEyeRx * 0.4);
          const pupRightY = eyeY + (expr.pupilOffset.y * rightEyeRy * 0.4);
          ctx.arc(pupRightX, pupRightY, rightEyeRx * 0.45, 0, Math.PI * 2);
          ctx.fillStyle = KURO_IDENTITY_INVARIANTS.colorPalette.pupilColor;
          ctx.fill();

          ctx.restore();
        }
      },
      {
        layerId: "monocle_accessory",
        zDepth: monocleZDepth,
        orderIndex: monocleOrder,
        visible: !isOccludedBySkull,
        occluded: isOccludedBySkull,
        draw: (ctx) => {
          if (isOccludedBySkull) return;
          ctx.save();

          // Aro exterior de latón
          ctx.beginPath();
          ctx.arc(monocleX, monocleY, monocleRadius, 0, Math.PI * 2);
          ctx.lineWidth = 3.2;
          ctx.strokeStyle = KURO_IDENTITY_INVARIANTS.colorPalette.brassAccent;
          ctx.stroke();

          // Reflejo de cristal de reloj
          ctx.beginPath();
          ctx.arc(monocleX, monocleY, monocleRadius * 0.9, 0, Math.PI * 2);
          const glassGrad = ctx.createLinearGradient(
            monocleX - monocleRadius, monocleY - monocleRadius,
            monocleX + monocleRadius, monocleY + monocleRadius
          );
          glassGrad.addColorStop(0, "rgba(255, 255, 255, 0.45)");
          glassGrad.addColorStop(0.4, "rgba(217, 119, 6, 0.12)");
          glassGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
          ctx.fillStyle = glassGrad;
          ctx.fill();

          // Pestaña de sujeción lateral
          ctx.beginPath();
          ctx.arc(monocleX + monocleRadius * 0.95, monocleY, 3, 0, Math.PI * 2);
          ctx.fillStyle = KURO_IDENTITY_INVARIANTS.colorPalette.brassShadow;
          ctx.fill();

          ctx.restore();
        }
      },
      {
        layerId: "monocle_chain_pendulum",
        zDepth: monocleZDepth - 0.05,
        orderIndex: monocleOrder + 10,
        visible: !isOccludedBySkull,
        occluded: isOccludedBySkull,
        draw: (ctx) => {
          if (isOccludedBySkull) return;
          ctx.save();

          // Origen de la cadena en la pestaña del monóculo
          const originX = monocleX + monocleRadius * 0.95;
          const originY = monocleY;

          // Extremo oscilante del péndulo
          const bobX = originX + Math.sin(this.pendulum.angleRad) * this.pendulum.lengthPx;
          const bobY = originY + Math.cos(this.pendulum.angleRad) * this.pendulum.lengthPx;

          // Cadena catenaria oscilante
          ctx.beginPath();
          ctx.moveTo(originX, originY);
          const midX = (originX + bobX) * 0.5 + Math.sin(this.pendulum.angleRad) * 4;
          const midY = (originY + bobY) * 0.5 + 4;
          ctx.quadraticCurveTo(midX, midY, bobX, bobY);
          ctx.lineWidth = 1.6;
          ctx.strokeStyle = KURO_IDENTITY_INVARIANTS.colorPalette.brassAccent;
          ctx.stroke();

          // Pesa del péndulo (engranaje relojero)
          ctx.beginPath();
          ctx.arc(bobX, bobY, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = KURO_IDENTITY_INVARIANTS.colorPalette.brassAccent;
          ctx.fill();
          ctx.strokeStyle = KURO_IDENTITY_INVARIANTS.colorPalette.brassShadow;
          ctx.lineWidth = 1.0;
          ctx.stroke();

          ctx.restore();
        }
      },
      {
        layerId: "specular_highlight",
        zDepth: 50,
        orderIndex: 70,
        visible: true,
        occluded: false,
        draw: (ctx) => {
          ctx.save();
          // Brillo ceroso cenital a 45 grados
          const specX = cx - (r * 0.32) + (faceOffsetX * 0.25);
          const specY = cy - (r * 0.38) + this.posY;
          ctx.beginPath();
          ctx.ellipse(specX, specY, r * 0.18, r * 0.09, -Math.PI / 6, 0, Math.PI * 2);
          ctx.fillStyle = KURO_IDENTITY_INVARIANTS.colorPalette.bodySpecular;
          ctx.fill();
          ctx.restore();
        }
      },
      {
        layerId: "agent_badge",
        zDepth: 100,
        orderIndex: 80,
        visible: KuroKinematicEngine.EXPRESSIONS[this.currentExpression].badgeType !== "none",
        occluded: false,
        draw: (ctx) => {
          const badgeType = KuroKinematicEngine.EXPRESSIONS[this.currentExpression].badgeType;
          if (badgeType === "none") return;
          ctx.save();

          const badgeX = cx + (r * 0.65);
          const badgeY = cy - (r * 0.85) + this.posY;

          if (badgeType === "alert_bang") {
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, 14, 0, Math.PI * 2);
            ctx.fillStyle = KURO_IDENTITY_INVARIANTS.colorPalette.alertBadgeColor;
            ctx.fill();
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 16px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("!", badgeX, badgeY);
          } else if (badgeType === "question_mark") {
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, 13, 0, Math.PI * 2);
            ctx.fillStyle = "#3b82f6";
            ctx.fill();
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 15px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("?", badgeX, badgeY);
          } else if (badgeType === "stars_sparkle") {
            ctx.fillStyle = "#fbbf24";
            ctx.font = "18px sans-serif";
            ctx.fillText("✦", badgeX - 6, badgeY + 4);
          }
          ctx.restore();
        }
      }
    ];

    // Ordenar capas rigurosamente por su orderIndex
    return layers.sort((a, b) => a.orderIndex - b.orderIndex);
  }
}
