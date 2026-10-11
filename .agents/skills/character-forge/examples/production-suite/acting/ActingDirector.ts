/**
 * @file ActingDirector.ts
 * @description Motor de actuación y dirección dramática en 10 fases cinemáticas secuenciales.
 * Convierte intenciones del personaje en secuencias de actuación coordinadas con soporte
 * para precondiciones, prioridades, interrupción limpia e integración con el estado corporal.
 */

export type PerformancePhase =
  | "stimulus"
  | "interpretation"
  | "preparation"
  | "anticipation"
  | "action"
  | "accent"
  | "secondary_reaction"
  | "settling"
  | "recovery"
  | "context_memory";

export interface ActingIntention {
  id: string;
  verb: "idle" | "listen" | "inspect" | "alert" | "celebrate" | "sleep";
  urgency: number; // 0..100
  requiredAccessory?: string;
  minEnergyRequired?: number;
  phaseDurationsMs?: Partial<Record<PerformancePhase, number>>;
  onComplete?: () => void;
}

export interface CharacterActingState {
  currentPhase: PerformancePhase;
  currentVerb: string;
  bodyTranslation: { x: number; y: number; z: number };
  bodySquashStretch: { squash: number; stretch: number };
  gazeDirection: { x: number; y: number };
  activeOutfitId: string;
  heldAccessoryId: string | null;
  energyLevel: number;
  arousal: number;
}

export class ActingDirector {
  private state: CharacterActingState;
  private activeIntention: ActingIntention | null = null;
  private currentPhaseIndex: number = 0;
  private phaseElapsedMs: number = 0;

  private readonly phaseSequence: PerformancePhase[] = [
    "stimulus",
    "interpretation",
    "preparation",
    "anticipation",
    "action",
    "accent",
    "secondary_reaction",
    "settling",
    "recovery",
    "context_memory"
  ];

  private readonly defaultDurationsMs: Record<PerformancePhase, number> = {
    stimulus: 50,
    interpretation: 100,
    preparation: 120,
    anticipation: 180,
    action: 250,
    accent: 80,
    secondary_reaction: 200,
    settling: 220,
    recovery: 250,
    context_memory: 50
  };

  constructor(initialState?: Partial<CharacterActingState>) {
    this.state = {
      currentPhase: "recovery",
      currentVerb: "idle",
      bodyTranslation: { x: 0, y: 0, z: 0 },
      bodySquashStretch: { squash: 1.0, stretch: 1.0 },
      gazeDirection: { x: 0, y: 0 },
      activeOutfitId: "none",
      heldAccessoryId: null,
      energyLevel: 1.0,
      arousal: 0.2,
      ...initialState
    };
  }

  public getState(): CharacterActingState {
    return {
      ...this.state,
      bodyTranslation: { ...this.state.bodyTranslation },
      bodySquashStretch: { ...this.state.bodySquashStretch },
      gazeDirection: { ...this.state.gazeDirection }
    };
  }

  public enqueueIntention(intention: ActingIntention): boolean {
    // 1. Verificación de nivel de energía
    if (intention.minEnergyRequired && this.state.energyLevel < intention.minEnergyRequired) {
      return false;
    }

    // 2. Verificación de accesorios requeridos
    if (intention.requiredAccessory && this.state.heldAccessoryId !== intention.requiredAccessory) {
      return false;
    }

    // 3. Verificación de prioridad / interrupción
    if (!this.activeIntention || intention.urgency >= this.activeIntention.urgency) {
      this.activeIntention = intention;
      this.currentPhaseIndex = 0;
      this.phaseElapsedMs = 0;
      this.state.currentVerb = intention.verb;
      this.state.currentPhase = this.phaseSequence[0];
      return true;
    }

    return false;
  }

  public tick(dtMs: number): void {
    if (!this.activeIntention) {
      this.state.currentPhase = "recovery";
      this.state.bodySquashStretch = { squash: 1.0, stretch: 1.0 };
      return;
    }

    let remainingDt = dtMs;

    while (remainingDt > 0 && this.activeIntention) {
      const currentPhase = this.phaseSequence[this.currentPhaseIndex];
      const targetDurationMs =
        this.activeIntention.phaseDurationsMs?.[currentPhase] ?? this.defaultDurationsMs[currentPhase];
      const neededForPhase = targetDurationMs - this.phaseElapsedMs;

      // Actualizar deformación corporal según la fase activa
      if (currentPhase === "anticipation") {
        this.state.bodySquashStretch = { squash: 0.88, stretch: 1.12 }; // Compresión preparatoria
      } else if (currentPhase === "action" || currentPhase === "accent") {
        this.state.bodySquashStretch = { squash: 1.15, stretch: 0.90 }; // Elongación dinámica
      } else if (currentPhase === "settling" || currentPhase === "recovery") {
        this.state.bodySquashStretch = { squash: 1.0, stretch: 1.0 };
      }

      if (remainingDt >= neededForPhase) {
        remainingDt -= neededForPhase;
        this.phaseElapsedMs = 0;
        this.currentPhaseIndex++;

        if (this.currentPhaseIndex >= this.phaseSequence.length) {
          if (this.activeIntention.onComplete) {
            this.activeIntention.onComplete();
          }
          this.activeIntention = null;
          this.currentPhaseIndex = 0;
          this.state.currentPhase = "recovery";
          this.state.currentVerb = "idle";
          this.state.bodySquashStretch = { squash: 1.0, stretch: 1.0 };
          break;
        } else {
          this.state.currentPhase = this.phaseSequence[this.currentPhaseIndex];
        }
      } else {
        this.phaseElapsedMs += remainingDt;
        remainingDt = 0;
      }
    }
  }

  // Compatibilidad hacia atrás
  public request(req: { id: string; intention: any; priority: number }): boolean {
    return this.enqueueIntention({
      id: req.id,
      verb: req.intention === "attention_listen" ? "listen" : "inspect",
      urgency: req.priority
    });
  }

  public update(dtSec: number) {
    this.tick(dtSec * 1000);
    return {
      currentPhase: this.state.currentPhase,
      phaseProgress: 1.0,
      yaw: 0,
      pitch: 0,
      bodySquashY: this.state.bodySquashStretch.stretch,
      badge: null,
      isComplete: this.activeIntention === null
    };
  }
}
