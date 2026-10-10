import { IntentId, IntentSequence, ActingPhaseConfig } from '../../references/acting-and-behavioral-design';
import { CharacterPersonalityTraits } from '../../references/personality-and-contextual-reactions';

/**
 * BehavioralActingController — Orquesta intenciones, fases de anticipación y rasgos de personalidad
 * Desacopla la decisión (Capa 1) de la cinemática articular (Capa 3).
 */
export class BehavioralActingController {
  public personality: CharacterPersonalityTraits;
  private currentSequence: IntentSequence | null = null;
  private currentPhase: 'anticipation' | 'action' | 'secondary' | 'recovery' = 'anticipation';
  private phaseTimerMs: number = 0;

  constructor(traits?: Partial<CharacterPersonalityTraits>) {
    this.personality = {
      energy: 0.6,
      reactionSpeed: 0.7,
      gestureAmplitude: 0.7,
      curiosity: 0.8,
      formality: 0.5,
      timidity: 0.2,
      ...traits,
    };
  }

  /**
   * Planifica e inicia una intención dramática configurada
   */
  public triggerIntent(intent: IntentId, targetPoint?: [number, number]): void {
    const energyMod = 0.6 + 0.8 * this.personality.energy;
    const ampMod = 0.5 + 0.9 * this.personality.gestureAmplitude;

    // Generar secuencia de 5 fases adaptada a la personalidad
    this.currentSequence = {
      intent,
      anticipation: {
        durationMs: Math.round(150 / energyMod),
        easing: (t) => t * t,
        targetHeadRotation: [-0.08 * ampMod, 0, 0], // Cabeza baja/retrocede
        targetTorsoOffset: [0, -0.03 * ampMod, 0],
        eyeLookTarget: [0, 0],
        armPose: 'rest',
        facialTension: 0.4,
      },
      action: {
        durationMs: Math.round(350 / energyMod),
        easing: (t) => 1 - Math.pow(1 - t, 3),
        targetHeadRotation: [0.12 * ampMod, targetPoint ? targetPoint[0] * 0.4 : 0, 0],
        targetTorsoOffset: [0, 0.08 * ampMod, 0],
        eyeLookTarget: targetPoint ? [targetPoint[0], targetPoint[1]] : [0, 0],
        armPose: intent === 'point' ? 'point' : intent === 'celebrate' ? 'cheer' : 'rest',
        facialTension: 0.2,
      },
      secondary: {
        durationMs: Math.round(220 / energyMod),
        easing: (t) => Math.sin(t * Math.PI),
        targetHeadRotation: [0.04 * ampMod, 0, 0],
        targetTorsoOffset: [0, 0.02, 0],
        eyeLookTarget: [0, 0.2], // Vistazo de confirmación al usuario
        armPose: intent === 'point' ? 'point' : 'rest',
        facialTension: 0.1,
      },
      recovery: {
        durationMs: Math.round(250 / energyMod),
        easing: (t) => t * (2 - t),
        targetHeadRotation: [0, 0, 0],
        targetTorsoOffset: [0, 0, 0],
        eyeLookTarget: [0, 0],
        armPose: 'rest',
        facialTension: 0.05,
      },
    };

    this.currentPhase = 'anticipation';
    this.phaseTimerMs = 0;
  }

  /**
   * Actualiza la fase de actuación y retorna la configuración de pose activa
   */
  public update(dtSeconds: number): ActingPhaseConfig | null {
    if (!this.currentSequence) return null;

    const dtMs = dtSeconds * 1000;
    this.phaseTimerMs += dtMs;
    const config = this.currentSequence[this.currentPhase];

    if (this.phaseTimerMs >= config.durationMs) {
      this.phaseTimerMs = 0;
      switch (this.currentPhase) {
        case 'anticipation':
          this.currentPhase = 'action';
          break;
        case 'action':
          this.currentPhase = 'secondary';
          break;
        case 'secondary':
          this.currentPhase = 'recovery';
          break;
        case 'recovery':
          this.currentSequence = null;
          return null;
      }
    }

    return this.currentSequence ? this.currentSequence[this.currentPhase] : null;
  }
}
