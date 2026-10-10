# Multimodal Coordination & The Synchronized Acting Timeline

Este documento formaliza la orquestación síncrona de los canales de expresión facial, mirada, gestos corporales, manipulación de accesorios, habla (visemas) y efectos de sonido procedurales a lo largo de una única línea temporal de actuación (*Acting Timeline*).

---

## 1. La Arquitectura de los 6 Canales Sincronizados

Para que un personaje actúe de manera orgánica, **ningún canal expresivo debe dispararse de forma aislada**. La actuación se compone de 6 pistas temporales sincronizadas:

```
Tiempo (ms):     0ms         120ms         280ms         450ms         650ms         900ms
─────────────────────────────────────────────────────────────────────────────────────────────
1. Postura       [ Reposo ] ──> [ Anticipación (baja 4°) ] ──> [ Salto / Extensión ] ──> [ Aterrizaje ]
2. Rostro        [ Neutro ] ────────> [ Tensión sube ] ──────> [ Alegría plena ] ──────> [ Sonrisa suave ]
3. Ojos          [ Fijo ] ──────────> [ Cierra ojos ] ───────> [ Abre en arco ^^ ] ────> [ Mirada usuario ]
4. Extremidades  [ Abajo ] ─────────> [ Hombros tensan ] ────> [ Brazos en V ] ────────> [ Reposo cintura ]
5. Visemas/Boca  [ Línea ] ─────────> [ O pequeña ] ─────────> [ Boca abierta A ] ────> [ Línea sonriente ]
6. Audio SFX     [ Silencio ] ──────> [ Swoosh subida ] ─────> [ Chime C5-E5-G5-C6 ] ──> [ Blip final ]
```

---

## 2. Definición de la Línea Temporal de Actuación (`ActingTimeline`)

```typescript
export interface TimelineKeyframe {
  timestampMs: number;
  facialPreset?: string;
  eyeLook?: [number, number];
  headRotation?: [number, number, number];
  bodyOffset?: [number, number, number];
  armPose?: string;
  mouthViseme?: 'silence' | 'A' | 'O' | 'E' | 'M';
  audioCue?: () => void;
}

export class ActingTimelineTrack {
  private keyframes: TimelineKeyframe[] = [];
  private currentTimeMs: number = 0;
  private isPlaying: boolean = false;
  private durationMs: number = 0;

  constructor(keyframes: TimelineKeyframe[]) {
    this.keyframes = [...keyframes].sort((a, b) => a.timestampMs - b.timestampMs);
    this.durationMs = this.keyframes[this.keyframes.length - 1]?.timestampMs || 0;
  }

  public play(): void {
    this.currentTimeMs = 0;
    this.isPlaying = true;
  }

  public update(dtMs: number, onFrameSample: (sample: TimelineKeyframe) => void): boolean {
    if (!this.isPlaying) return false;

    const prevTime = this.currentTimeMs;
    this.currentTimeMs += dtMs;

    // Disparar eventos de audio que caigan en este intervalo temporal
    for (const kf of this.keyframes) {
      if (kf.audioCue && kf.timestampMs >= prevTime && kf.timestampMs < this.currentTimeMs) {
        kf.audioCue();
      }
    }

    // Interpolar los dos keyframes adyacentes
    const currentSample = this.interpolateCurrentState(this.currentTimeMs);
    onFrameSample(currentSample);

    if (this.currentTimeMs >= this.durationMs) {
      this.isPlaying = false;
      return true; // Finalizado
    }
    return false;
  }

  private interpolateCurrentState(time: number): TimelineKeyframe {
    // Encuentra el tramo de interpolación correspondiente
    let kfBefore = this.keyframes[0];
    let kfAfter = this.keyframes[this.keyframes.length - 1];

    for (let i = 0; i < this.keyframes.length - 1; i++) {
      if (time >= this.keyframes[i].timestampMs && time <= this.keyframes[i + 1].timestampMs) {
        kfBefore = this.keyframes[i];
        kfAfter = this.keyframes[i + 1];
        break;
      }
    }

    const span = kfAfter.timestampMs - kfBefore.timestampMs || 1;
    const progress = Math.max(0, Math.min(1, (time - kfBefore.timestampMs) / span));

    return {
      timestampMs: time,
      facialPreset: progress > 0.5 ? kfAfter.facialPreset : kfBefore.facialPreset,
      mouthViseme: progress > 0.5 ? kfAfter.mouthViseme : kfBefore.mouthViseme,
    };
  }
}
```

---

## 3. Prevención de Contradicciones Expresivas (Coherence Guard)

Para evitar que el personaje produzca señales no verbales contradictorias (ej. celebrar un éxito con ceño fruncido o expresar un error crítico con sonrisa abierta):

```typescript
export function assertExpressiveCoherence(
  emotion: string,
  armPose: string,
  audioIntensity: number
): boolean {
  const isNegativeEmotion = ['error', 'frustration', 'sadness', 'fear'].includes(emotion);
  const isTriumphantPose = ['cheer', 'arms_v', 'celebrate'].includes(armPose);

  // Regla: No celebrar con emociones de tristeza o fracaso
  if (isNegativeEmotion && isTriumphantPose) {
    console.warn(`[CoherenceGuard] Conflicto expresivo detectado: emoción '${emotion}' incompatible con pose '${armPose}'`);
    return false;
  }

  return true;
}
```
Este rigor multimodal eleva al personaje a estándares de producción de estudios cinematográficos y videojuegos AAA.
