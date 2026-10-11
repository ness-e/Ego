export interface CharacterMotionGuardOptions {
  prefersReducedMotion?: boolean;
  userAnimationKillSwitch?: boolean;
  isWindowFocused?: boolean;
  targetFpsFocused?: number;
  targetFpsBackground?: number;
  rafProvider?: (cb: (time: number) => void) => number;
  cancelRafProvider?: (handle: number) => void;
}

export class CharacterMotionGuard {
  private prefersReducedMotion: boolean;
  private userAnimationKillSwitch: boolean;
  private isWindowFocused: boolean;
  private targetFpsFocused: number;
  private targetFpsBackground: number;

  private raf: (cb: (time: number) => void) => number;
  private cancelRaf: (handle: number) => void;

  private activeHandle: number | null = null;
  private isRunning = false;

  constructor(options?: CharacterMotionGuardOptions) {
    this.prefersReducedMotion = options?.prefersReducedMotion ?? false;
    this.userAnimationKillSwitch = options?.userAnimationKillSwitch ?? false;
    this.isWindowFocused = options?.isWindowFocused ?? true;
    this.targetFpsFocused = options?.targetFpsFocused ?? 60;
    this.targetFpsBackground = options?.targetFpsBackground ?? 15;

    this.raf = options?.rafProvider ?? (typeof requestAnimationFrame !== "undefined"
      ? requestAnimationFrame
      : (cb) => setTimeout(() => cb(Date.now()), 16) as unknown as number);

    this.cancelRaf = options?.cancelRafProvider ?? (typeof cancelAnimationFrame !== "undefined"
      ? cancelAnimationFrame
      : (h) => clearTimeout(h as unknown as NodeJS.Timeout));
  }

  /**
   * Determina si la animación está permitida según accesibilidad y kill-switch.
   * Regla incondicional: Si prefersReducedMotion o kill-switch está activo, retorna false.
   */
  public shouldAnimate(): boolean {
    if (this.prefersReducedMotion) return false;
    if (this.userAnimationKillSwitch) return false;
    return true;
  }

  /**
   * Obtiene la tasa de refresco objetivo adaptativa (60 fps en foco -> 15 fps en fondo).
   */
  public getTargetFps(): number {
    if (!this.shouldAnimate()) return 0;
    return this.isWindowFocused ? this.targetFpsFocused : this.targetFpsBackground;
  }

  public setReducedMotion(enabled: boolean): void {
    this.prefersReducedMotion = enabled;
  }

  public setKillSwitch(enabled: boolean): void {
    this.userAnimationKillSwitch = enabled;
  }

  public setWindowFocused(focused: boolean): void {
    this.isWindowFocused = focused;
  }

  /**
   * Inicia el bucle de animación gobernado con rAF adaptativo.
   * Retorna una función de limpieza (dispose) para cancelar rAF al desmontar.
   */
  public startLoop(callback: (deltaMs: number) => void): () => void {
    if (!this.shouldAnimate()) {
      // Si la animación está desactivada, pintar frame estático de inmediato y no encolar rAF
      callback(0);
      return () => {};
    }

    this.isRunning = true;
    let lastTime = Date.now();

    const loop = (currentTime: number) => {
      if (!this.isRunning) return;

      if (!this.shouldAnimate()) {
        callback(0);
        this.stopLoop();
        return;
      }

      const now = typeof currentTime === "number" ? currentTime : Date.now();
      const deltaMs = now - lastTime;
      const targetFps = this.getTargetFps();
      const frameIntervalMs = 1000 / targetFps;

      if (deltaMs >= frameIntervalMs) {
        lastTime = now - (deltaMs % frameIntervalMs);
        callback(deltaMs);
      }

      this.activeHandle = this.raf(loop);
    };

    this.activeHandle = this.raf(loop);

    return () => {
      this.stopLoop();
    };
  }

  /**
   * Detiene rigurosamente el bucle y cancela el handle de animación activo.
   */
  public stopLoop(): void {
    this.isRunning = false;
    if (this.activeHandle !== null) {
      this.cancelRaf(this.activeHandle);
      this.activeHandle = null;
    }
  }

  public getActiveHandle(): number | null {
    return this.activeHandle;
  }
}
