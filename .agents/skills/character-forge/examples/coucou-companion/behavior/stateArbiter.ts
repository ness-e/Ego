/**
 * @file stateArbiter.ts
 * @description Árbitro de prioridades que compone FSM Espacial, FSM Emocional y FSM Operativa del Agente.
 */

import type { SpatialStateName } from "./spatialPresence";

export type AgentOpState =
  | "idle"
  | "thinking"
  | "runningTool"
  | "waitingForApproval"
  | "needsInput"
  | "error"
  | "success";

export type EmotionalState =
  | "neutral"
  | "happy"
  | "curious"
  | "astonished"
  | "skeptical"
  | "proud"
  | "worried";

export interface ResolvedVisualPose {
  eyeShape: "pill" | "wide" | "flat" | "happy" | "closed" | "spiral";
  badge: "dots" | "bang" | "question" | "dot" | null;
  badgeColor: string;
  tintIntensity: number;
  bodySquashY: number;
  isSleeping: boolean;
  priorityLevel: number;
}

export class StateArbiter {
  /**
   * Resuelve la pose final dando máxima precedencia a alertas críticas (HITL / Errores).
   */
  public static resolve(
    spatial: SpatialStateName,
    emotional: EmotionalState,
    agent: AgentOpState
  ): ResolvedVisualPose {
    // NIVEL 1 (MÁXIMA PRIORIDAD): Aprobación humana pendiente o error crítico del agente
    if (agent === "waitingForApproval") {
      return {
        eyeShape: "wide",
        badge: "bang",
        badgeColor: "#f59e0b",
        tintIntensity: 0.85,
        bodySquashY: 1.0,
        isSleeping: false,
        priorityLevel: 100,
      };
    }

    if (agent === "error") {
      return {
        eyeShape: "flat",
        badge: "dot",
        badgeColor: "#ef4444",
        tintIntensity: 0.80,
        bodySquashY: 0.92,
        isSleeping: false,
        priorityLevel: 90,
      };
    }

    if (agent === "needsInput") {
      return {
        eyeShape: "pill",
        badge: "question",
        badgeColor: "#06b6d4",
        tintIntensity: 0.75,
        bodySquashY: 1.0,
        isSleeping: false,
        priorityLevel: 85,
      };
    }

    // NIVEL 2: Procesamiento del agente (thinking o runningTool)
    if (agent === "thinking") {
      return {
        eyeShape: "pill",
        badge: "dots",
        badgeColor: "#8b5cf6",
        tintIntensity: 0.72,
        bodySquashY: 1.0,
        isSleeping: false,
        priorityLevel: 70,
      };
    }

    if (agent === "runningTool") {
      return {
        eyeShape: "wide",
        badge: "dots",
        badgeColor: "#38bdf8",
        tintIntensity: 0.75,
        bodySquashY: 1.04,
        isSleeping: false,
        priorityLevel: 65,
      };
    }

    // NIVEL 3: Estado espacial dominante (sueño o arrastre)
    if (spatial === "sleeping") {
      return {
        eyeShape: "closed",
        badge: null,
        badgeColor: "#64748b",
        tintIntensity: 0.1,
        bodySquashY: 0.94,
        isSleeping: true,
        priorityLevel: 50,
      };
    }

    if (spatial === "dragging") {
      return {
        eyeShape: "wide",
        badge: null,
        badgeColor: "#ffffff",
        tintIntensity: 0.2,
        bodySquashY: 1.15,
        isSleeping: false,
        priorityLevel: 55,
      };
    }

    // NIVEL 4: Expresión emocional voluntaria
    let eye: "pill" | "wide" | "flat" | "happy" | "closed" | "spiral" = "pill";
    if (emotional === "happy" || agent === "success") eye = "happy";
    else if (emotional === "astonished") eye = "wide";
    else if (emotional === "skeptical") eye = "flat";

    return {
      eyeShape: eye,
      badge: null,
      badgeColor: "#ffffff",
      tintIntensity: 0.0,
      bodySquashY: 1.0,
      isSleeping: false,
      priorityLevel: 10,
    };
  }
}
