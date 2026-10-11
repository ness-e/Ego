/**
 * @file audioFeedback.ts
 * @description Síntesis de sonido procedural con Web Audio API y limitación de repetición.
 */

export class AudioFeedbackSystem {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;
  private lastSoundTime: Map<string, number> = new Map();

  private initContext(): void {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  private canPlay(soundId: string, minIntervalMs: number = 160): boolean {
    if (!this.enabled) return false;
    const now = performance.now();
    const prev = this.lastSoundTime.get(soundId) || 0;
    if (now - prev >= minIntervalMs) {
      this.lastSoundTime.set(soundId, now);
      return true;
    }
    return false;
  }

  public playPop(freq: number = 540): void {
    if (!this.canPlay("pop")) return;
    this.initContext();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.6, now + 0.05);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playAlertBuzz(): void {
    if (!this.canPlay("alert", 300)) return;
    this.initContext();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.linearRampToValueAtTime(120, now + 0.15);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  }
}
