/**
 * @file animationClock.ts
 * @description Reloj de simulación temporal desacoplado de framerate fijo.
 */

export class AnimationClock {
  private lastTimeMs: number = 0;
  private running: boolean = false;
  private maxDeltaSec: number;

  constructor(maxDeltaSec: number = 0.1) {
    this.maxDeltaSec = maxDeltaSec;
  }

  public start(): void {
    this.lastTimeMs = performance.now();
    this.running = true;
  }

  public stop(): void {
    this.running = false;
  }

  /**
   * Obtiene el delta de tiempo transcurrido en segundos acotado a maxDeltaSec.
   */
  public tick(nowMs: number = performance.now()): number {
    if (!this.running) {
      this.lastTimeMs = nowMs;
      this.running = true;
      return 0;
    }

    const elapsed = (nowMs - this.lastTimeMs) / 1000.0;
    this.lastTimeMs = nowMs;

    // Clamp para evitar saltos numéricos tras pausas de sistema
    return Math.min(Math.max(0, elapsed), this.maxDeltaSec);
  }
}
