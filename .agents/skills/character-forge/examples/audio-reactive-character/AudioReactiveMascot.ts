/**
 * AudioReactiveMascot — Controlador de reactividad acústica y síntesis SFX
 * Sintetiza efectos de sonido sin archivos de audio y analiza amplitudes para lip-sync y movimiento.
 */

export class AudioReactiveMascot {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private freqData: Uint8Array | null = null;

  private initAudio(): AudioContext {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Conecta una fuente de audio (micrófono o música) al analizador
   */
  public connectMediaStream(stream: MediaStream): void {
    const ctx = this.initAudio();
    const source = ctx.createMediaStreamSource(stream);
    if (this.analyser) {
      source.connect(this.analyser);
    }
  }

  /**
   * Retorna la apertura de boca calculada por energía RMS [0.0 = cerrada, 1.0 = abierta]
   */
  public getMouthAperture(): number {
    if (!this.analyser || !this.freqData) return 0;
    this.analyser.getByteFrequencyData(this.freqData);

    let sum = 0;
    for (let i = 0; i < this.freqData.length; i++) {
      sum += this.freqData[i];
    }
    const avg = sum / (this.freqData.length * 255);
    // Aplicar curva de sensibilidad con umbral de ruido
    if (avg < 0.05) return 0;
    return Math.min(1.0, (avg - 0.05) * 2.8);
  }

  /**
   * Reproduce el tono sonoro característico de la mascota al interactuar
   */
  public playGreetingChirp(): void {
    const ctx = this.initAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }
}
