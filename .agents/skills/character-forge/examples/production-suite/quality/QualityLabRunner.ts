/**
 * @file QualityLabRunner.ts
 * @description Evaluador determinista de métricas visuales y dinámicas de movimiento para CharacterForge.
 * Mide overshoot, tiempo de asentamiento (settling time), jitter y error medio absoluto (MAE).
 */

export interface MotionSample {
  timeMs: number;
  value: number;
  target: number;
  velocity: number;
}

export interface MotionQualityMetrics {
  overshootPercent: number;
  settlingTimeSec: number;
  oscillationsCount: number;
  jitterRms: number;
  mae: number;
  isCompliant: boolean;
  violations: string[];
}

export interface MetricThresholds {
  minOvershootPercent: number; // Típicamente 8%
  maxOvershootPercent: number; // Típicamente 22%
  maxSettlingTimeSec: number;  // Típicamente 0.50 s (tolerancia +/- 2%)
  settlingTolerancePercent: number; // Típicamente 2%
  maxJitterRms: number;
}

export const DEFAULT_MOTION_THRESHOLDS: MetricThresholds = {
  minOvershootPercent: 8.0,
  maxOvershootPercent: 22.0,
  maxSettlingTimeSec: 0.50,
  settlingTolerancePercent: 2.0,
  maxJitterRms: 0.15
};

export class QualityLabRunner {
  private thresholds: MetricThresholds;

  constructor(thresholds: MetricThresholds = DEFAULT_MOTION_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  /**
   * Evalúa una trayectoria de movimiento temporal muestreada a paso fijo.
   */
  public evaluateMotionTrajectory(
    samples: MotionSample[],
    initialValue: number,
    targetValue: number
  ): MotionQualityMetrics {
    if (samples.length === 0) {
      throw new Error("No hay muestras para evaluar en QualityLabRunner.");
    }

    const stepAmplitude = Math.abs(targetValue - initialValue);
    if (stepAmplitude < 0.0001) {
      return {
        overshootPercent: 0,
        settlingTimeSec: 0,
        oscillationsCount: 0,
        jitterRms: 0,
        mae: 0,
        isCompliant: true,
        violations: []
      };
    }

    const isPositiveStep = targetValue >= initialValue;
    let peakValue = initialValue;
    let peakTimeMs = 0;
    let sumAbsoluteError = 0;
    let jitterSumSq = 0;
    let lastVelocity = 0;
    let oscillationsCount = 0;

    // Banda de tolerancia para settling time (2%)
    const toleranceDelta = stepAmplitude * (this.thresholds.settlingTolerancePercent / 100);
    const lowerBand = targetValue - toleranceDelta;
    const upperBand = targetValue + toleranceDelta;

    let lastOutOfBandIndex = 0;

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const error = Math.abs(s.value - targetValue);
      sumAbsoluteError += error;

      // Seguimiento del pico
      if (isPositiveStep) {
        if (s.value > peakValue) {
          peakValue = s.value;
          peakTimeMs = s.timeMs;
        }
      } else {
        if (s.value < peakValue) {
          peakValue = s.value;
          peakTimeMs = s.timeMs;
        }
      }

      // Verificación de banda de tolerancia
      if (s.value < lowerBand || s.value > upperBand) {
        lastOutOfBandIndex = i;
      }

      // Detección de cruce de velocidad por cero (oscilaciones)
      if (i > 0) {
        if ((s.velocity > 0 && lastVelocity < 0) || (s.velocity < 0 && lastVelocity > 0)) {
          oscillationsCount++;
        }
      }
      lastVelocity = s.velocity;
    }

    // Jitter espurio: medido a través de la discontinuidad de jerk de alta frecuencia (segunda diferencia de velocidad)
    let spuriousJerkSq = 0;
    for (let i = 2; i < samples.length; i++) {
      const dv1 = samples[i].velocity - samples[i - 1].velocity;
      const dv0 = samples[i - 1].velocity - samples[i - 2].velocity;
      const jerkDiscontinuity = (dv1 - dv0) / stepAmplitude;
      spuriousJerkSq += jerkDiscontinuity * jerkDiscontinuity;
    }
    const jitterRms = Math.sqrt(spuriousJerkSq / Math.max(1, samples.length - 2));

    // Cálculo de overshoot porcentual
    const overshootDelta = isPositiveStep ? (peakValue - targetValue) : (targetValue - peakValue);
    const overshootPercent = Math.max(0, (overshootDelta / stepAmplitude) * 100);

    // Settling time: tiempo de la última muestra fuera de la banda
    const settlingTimeMs = lastOutOfBandIndex < samples.length - 1
      ? samples[lastOutOfBandIndex + 1].timeMs
      : samples[samples.length - 1].timeMs;
    const settlingTimeSec = settlingTimeMs / 1000.0;

    const mae = sumAbsoluteError / samples.length;

    // Verificación de violaciones normativas
    const violations: string[] = [];

    if (overshootPercent > this.thresholds.maxOvershootPercent) {
      violations.push(
        `Overshoot excesivo: ${overshootPercent.toFixed(2)}% supera el límite máximo de ${this.thresholds.maxOvershootPercent}% (Defecto de subamortiguamiento / oscilación grotesca).`
      );
    } else if (overshootPercent < this.thresholds.minOvershootPercent) {
      violations.push(
        `Overshoot insuficiente: ${overshootPercent.toFixed(2)}% por debajo del mínimo de ${this.thresholds.minOvershootPercent}% (Defecto de sobreamortiguamiento / movimiento gomoso sin peso vivo).`
      );
    }

    if (settlingTimeSec > this.thresholds.maxSettlingTimeSec) {
      violations.push(
        `Settling time prolongado: ${settlingTimeSec.toFixed(3)}s excede la ventana de rendimiento de ${this.thresholds.maxSettlingTimeSec}s.`
      );
    }

    if (jitterRms > this.thresholds.maxJitterRms) {
      violations.push(
        `Jitter RMS elevado: ${jitterRms.toFixed(4)} supera el umbral estético de ${this.thresholds.maxJitterRms}.`
      );
    }

    return {
      overshootPercent,
      settlingTimeSec,
      oscillationsCount,
      jitterRms,
      mae,
      isCompliant: violations.length === 0,
      violations
    };
  }

  /**
   * Simula un resorte de segundo orden (Harmonic Oscillator) con paso temporal determinista.
   */
  public simulateSpringStep(
    omega0: number,
    zeta: number,
    initialVal: number,
    targetVal: number,
    durationMs: number = 1000,
    dtMs: number = 8 // ~120 Hz muestreo
  ): MotionSample[] {
    const samples: MotionSample[] = [];
    let pos = initialVal;
    let vel = 0;
    const dt = dtMs / 1000.0;
    const steps = Math.floor(durationMs / dtMs);

    for (let step = 0; step <= steps; step++) {
      const timeMs = step * dtMs;
      samples.push({
        timeMs,
        value: pos,
        target: targetVal,
        velocity: vel
      });

      // Ecuación diferencial: a = -2*zeta*omega0*vel - omega0^2*(pos - target)
      const displacement = pos - targetVal;
      const accel = -2 * zeta * omega0 * vel - omega0 * omega0 * displacement;
      
      // Integración Semi-implícita de Euler (simpléctica y conservativa)
      vel += accel * dt;
      pos += vel * dt;
    }

    return samples;
  }
}
