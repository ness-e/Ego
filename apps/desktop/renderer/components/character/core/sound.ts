// sound.ts — Sintetizador de Audio Web Audio API para Ego (COUC-20)
// Reemplazo procedural nativo sin dependencias de archivos de sonido rasterizados o con copyright.

export type SoundEffect =
  | "blip"
  | "hover"
  | "greet"
  | "slap"
  | "approval"
  | "finish"
  | "error"
  | "annoyed"
  | "question";

export class WebAudioSynth {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Inicialización lazy para cumplir con la política de autoplay de navegadores / Electron
  }

  public init(): void {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public play(name: SoundEffect): void {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      switch (name) {
        case "blip":
        case "hover":
          osc.type = "sine";
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.linearRampToValueAtTime(0, now + 0.05);
          osc.start(now);
          osc.stop(now + 0.05);
          break;

        case "greet":
          osc.type = "sine";
          osc.frequency.setValueAtTime(520, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.linearRampToValueAtTime(0, now + 0.25);
          osc.start(now);
          osc.stop(now + 0.25);
          break;

        case "slap":
          osc.type = "triangle";
          osc.frequency.setValueAtTime(180, now);
          osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.linearRampToValueAtTime(0, now + 0.1);
          osc.start(now);
          osc.stop(now + 0.1);
          break;

        case "approval":
          osc.type = "sine";
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.setValueAtTime(660, now + 0.08);
          gain.gain.setValueAtTime(0.14, now);
          gain.gain.linearRampToValueAtTime(0, now + 0.3);
          osc.start(now);
          osc.stop(now + 0.3);
          break;

        case "finish":
          osc.type = "sine";
          osc.frequency.setValueAtTime(587.33, now);
          osc.frequency.setValueAtTime(880, now + 0.1);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.linearRampToValueAtTime(0, now + 0.4);
          osc.start(now);
          osc.stop(now + 0.4);
          break;

        case "error":
        case "annoyed":
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(180, now);
          osc.frequency.linearRampToValueAtTime(120, now + 0.18);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.linearRampToValueAtTime(0, now + 0.18);
          osc.start(now);
          osc.stop(now + 0.18);
          break;

        case "question":
          osc.type = "sine";
          osc.frequency.setValueAtTime(420, now);
          osc.frequency.exponentialRampToValueAtTime(650, now + 0.12);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.linearRampToValueAtTime(0, now + 0.14);
          osc.start(now);
          osc.stop(now + 0.14);
          break;

        default:
          osc.type = "sine";
          osc.frequency.setValueAtTime(600, now);
          gain.gain.setValueAtTime(0.06, now);
          gain.gain.linearRampToValueAtTime(0, now + 0.08);
          osc.start(now);
          osc.stop(now + 0.08);
      }
    } catch {
      // Degradar silenciosamente si el contexto de audio falla o está bloqueado por el SO
    }
  }
}

export const Sound = new WebAudioSynth();
