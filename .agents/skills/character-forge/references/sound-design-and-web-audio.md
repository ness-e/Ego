# Sound Design, Procedural Web Audio & Audio-Reactive Characters

Este documento formaliza la síntesis procedural de audio en tiempo real y la reactividad sonora para dotar al personaje de voz, efectos de sonido (SFX) y sincronización de visemas sin descargar archivos de audio externos.

---

## 1. Síntesis Procedural de Audio con Web Audio API

Descargar archivos `.mp3` o `.wav` para microinteracciones introduce latencia de red y riesgo de fallos 404. Mediante la **Web Audio API de la W3C**, los sonidos de la mascota se sintetizan analíticamente en tiempo de ejecución:

```
[ OscillatorNode ] ──(Frecuencia / Onda)──> [ BiquadFilterNode ] ──> [ GainNode (ADSR) ] ──> [ Destination ]
```

### 1.1. Envolvente ADSR (Attack, Decay, Sustain, Release)
Para modelar la dinámica física del sonido:

```typescript
export class ProceduralSoundFX {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Genera un "Blip" sutil y cálido para parpadeo o hover
   */
  public playSoftBlip(freq: number = 680): void {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.25, ctx.currentTime + 0.08);

    // Envolvente rápida
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.01); // Attack
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09); // Decay

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  /**
   * Arpegio pentatónico de éxito para el estado SUCCESS
   */
  public playSuccessChime(): void {
    const ctx = this.getContext();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    notes.forEach((freq, idx) => {
      const startTime = ctx.currentTime + idx * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.18, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.36);
    });
  }

  /**
   * Acorde disonante descendente para el estado ERROR
   */
  public playErrorBuzz(): void {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }
}
```

---

## 2. Reactividad Acústica en Tiempo Real (`AnalyserNode`)

Para que el personaje reaccione visualmente a la música de fondo o a la voz del usuario (ej. orejas que vibran con los bajos o pupila que se dilata con los agudos):

```typescript
export class AudioReactionTracker {
  private analyser: AnalyserNode;
  private dataArray: Uint8Array;

  constructor(audioContext: AudioContext, sourceNode: AudioNode) {
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 64;
    this.analyser.smoothingTimeConstant = 0.8;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    sourceNode.connect(this.analyser);
  }

  /**
   * Retorna energía normalizada [0, 1] en bandas de graves y agudos
   */
  public getEnergyBands(): { bass: number; treble: number; overallRMS: number } {
    this.analyser.getByteFrequencyData(this.dataArray);

    let bassSum = 0;
    for (let i = 0; i < 4; i++) bassSum += this.dataArray[i];
    const bass = bassSum / (4 * 255);

    let trebleSum = 0;
    for (let i = 16; i < 24; i++) trebleSum += this.dataArray[i];
    const treble = trebleSum / (8 * 255);

    let totalSum = 0;
    for (let i = 0; i < this.dataArray.length; i++) totalSum += this.dataArray[i];
    const overallRMS = totalSum / (this.dataArray.length * 255);

    return { bass, treble, overallRMS };
  }
}
```

---

## 3. Sincronización Labial Simplificada por Energía (Lip Sync)

Cuando no se cuenta con transcripción fonética precisa de visemas, la apertura de la boca se modula mediante la **energía Root Mean Square (RMS)** de la señal vocal:

$$E_{\text{RMS}} = \sqrt{\frac{1}{N} \sum_{i=1}^N x_i^2}$$

$$\text{mouthOpenness} = \text{clamp}\left(E_{\text{RMS}} \cdot 2.5, 0.0, 1.0\right)$$

Esta aproximación otorga sincronización orgánica instantánea con cero sobrecoste computacional.
