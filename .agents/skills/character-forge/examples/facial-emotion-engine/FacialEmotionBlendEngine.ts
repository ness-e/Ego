import { FacialFeatureVector } from '../../references/facial-expression-and-emotions';

/**
 * FacialEmotionBlendEngine — Motor de 28 emociones y sacadas oculares en TypeScript
 * Gestiona la interpolación continua, el parpadeo aleatorio y la dinámica de mirada biológica.
 */
export class FacialEmotionBlendEngine {
  private currentFeatures: FacialFeatureVector;
  private targetFeatures: FacialFeatureVector;
  private transitionProgress: number = 1.0;
  private transitionDurationMs: number = 300;
  private timerMs: number = 0;

  // Sacadas y parpadeo
  private pupilLook: [number, number] = [0, 0];
  private saccadeTimer: number = 0;
  private nextSaccadeInterval: number = 0.8;
  private blinkTimer: number = 0;
  private isBlinking: boolean = false;

  constructor() {
    this.currentFeatures = this.getNeutralPreset();
    this.targetFeatures = this.getNeutralPreset();
  }

  public getNeutralPreset(): FacialFeatureVector {
    return {
      browHeight: 0.0,
      browSlant: 0.0,
      browArch: 0.0,
      browAsymmetry: 0.0,
      eyeOpenness: 1.0,
      eyeSquint: 0.0,
      eyeShape: 'round',
      pupilTargetX: 0.0,
      pupilTargetY: 0.0,
      pupilDilation: 1.0,
      convergence: 0.0,
      mouthCurvature: 0.1,
      mouthOpenness: 0.0,
      mouthWidth: 1.0,
      jawShiftX: 0.0,
      cheekPuff: 0.0,
      facialTension: 0.05,
      faceSquashStretch: 1.0,
    };
  }

  /**
   * Dispara una transición suave hacia un nuevo perfil emocional
   */
  public transitionTo(target: Partial<FacialFeatureVector>, durationMs: number = 300): void {
    this.targetFeatures = { ...this.currentFeatures, ...target };
    this.transitionProgress = 0.0;
    this.transitionDurationMs = Math.max(50, durationMs);
    this.timerMs = 0;
  }

  /**
   * Actualiza los parámetros en cada frame (60-120 FPS)
   */
  public update(dtSeconds: number, targetLookAt: [number, number]): FacialFeatureVector {
    const dtMs = dtSeconds * 1000;

    // 1. Interpolación de rasgos faciales
    if (this.transitionProgress < 1.0) {
      this.timerMs += dtMs;
      this.transitionProgress = Math.min(1.0, this.timerMs / this.transitionDurationMs);
      const k = this.easeInOutHermite(this.transitionProgress);

      for (const key of Object.keys(this.targetFeatures) as Array<keyof FacialFeatureVector>) {
        if (typeof this.targetFeatures[key] === 'number') {
          const startVal = this.currentFeatures[key] as number;
          const endVal = this.targetFeatures[key] as number;
          (this.currentFeatures[key] as number) = startVal + (endVal - startVal) * k;
        } else if (k > 0.5) {
          (this.currentFeatures[key] as any) = this.targetFeatures[key];
        }
      }
    }

    // 2. Micro-sacadas de mirada hacia el target
    this.saccadeTimer += dtSeconds;
    if (this.saccadeTimer >= this.nextSaccadeInterval) {
      this.saccadeTimer = 0;
      this.nextSaccadeInterval = 0.5 + Math.random() * 1.2;
      const jitterX = (Math.random() - 0.5) * 0.06;
      const jitterY = (Math.random() - 0.5) * 0.04;
      this.pupilLook = [
        Math.max(-1, Math.min(1, targetLookAt[0] + jitterX)),
        Math.max(-1, Math.min(1, targetLookAt[1] + jitterY)),
      ];
    }
    this.currentFeatures.pupilTargetX += (this.pupilLook[0] - this.currentFeatures.pupilTargetX) * Math.min(1, 18 * dtSeconds);
    this.currentFeatures.pupilTargetY += (this.pupilLook[1] - this.currentFeatures.pupilTargetY) * Math.min(1, 18 * dtSeconds);

    // 3. Parpadeo aperiódico biológico
    if (!this.isBlinking) {
      this.blinkTimer += dtSeconds;
      if (this.blinkTimer >= 3.2) {
        this.isBlinking = true;
        this.blinkTimer = 0;
      }
    } else {
      this.blinkTimer += dtSeconds / 0.16; // 160ms duración
      if (this.blinkTimer >= 1.0) {
        this.isBlinking = false;
        this.blinkTimer = 0;
      } else {
        const blinkFactor = Math.abs(Math.sin(this.blinkTimer * Math.PI - Math.PI / 2));
        this.currentFeatures.eyeOpenness *= blinkFactor;
      }
    }

    return this.currentFeatures;
  }

  private easeInOutHermite(t: number): number {
    return t * t * (3 - 2 * t);
  }
}
