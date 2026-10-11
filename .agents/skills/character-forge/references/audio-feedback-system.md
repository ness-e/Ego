# Sistema de Audio y Retroalimentación Sonora Semántica (Audio Feedback System)

Este módulo formaliza la síntesis procedural y gestión de sonido para personajes y compañeros de escritorio mediante la Web Audio API nativa y archivos de audio precargados, con limitación de frecuencia de repetición y controles de accesibilidad.

---

## 1. Principio Fundamental: Sonido Semántico, Cero Ruido por Fotograma

> [!IMPORTANT]
> **Prohibición de Disparo por Frame**: Queda estrictamente prohibido disparar efectos de audio dentro de los bucles de renderizado continuo (`requestAnimationFrame` o `TimelineView`). El sonido debe asociarse **exclusivamente a transiciones de estado semánticas discretas** (ej. entrada a fase `action`, clic de usuario o alerta de error).

---

## 2. Catálogo Canónico de Efectos Sonoros Procedurales

| Evento Semántico | Tipo de Onda / Síntesis | Envolvente ADSR | Frecuencia Base |
|---|---|---|---|
| `pop` (Clic / Parpadeo) | Senoidal pura | A: 2ms, D: 30ms, R: 40ms | $540\text{ Hz} \to 820\text{ Hz}$ |
| `bounce` (Rebote elástico) | Triangular | A: 1ms, D: 60ms, R: 90ms | $180\text{ Hz} \to 90\text{ Hz}$ |
| `chirp` (Curiosidad / Saludo) | Senoidal bifásica | A: 10ms, D: 50ms, R: 80ms | $800\text{ Hz} \to 1200\text{ Hz} \to 950\text{ Hz}$ |
| `snore` (Respiración en sueño) | Diente de sierra con filtro pasa-bajo | A: 100ms, D: 200ms, R: 150ms | $110\text{ Hz} \to 95\text{ Hz}$ ($f_c = 260\text{ Hz}$) |
| `buzz` (Alerta / Error) | Cuadrada pulsante | A: 5ms, D: 80ms, R: 120ms | $150\text{ Hz} + 155\text{ Hz}$ (Batimiento) |
| `chime` (Aprobación / Éxito) | Tres osciladores aditivos (tríada mayor) | A: 8ms, D: 150ms, R: 400ms | $523\text{ Hz}, 659\text{ Hz}, 784\text{ Hz}$ |

---

## 3. Limitación de Repetición (Debounce & Throttling)

Para evitar saturación acústica cuando ocurren eventos repetitivos rápidos (ej. ráfaga de logs o clics continuos):
```typescript
export class AudioThrottleManager {
  private lastPlayed: Map<string, number> = new Map();

  public canPlay(soundId: string, minIntervalMs: number = 180): boolean {
    const now = performance.now();
    const prev = this.lastPlayed.get(soundId) || 0;
    if (now - prev >= minIntervalMs) {
      this.lastPlayed.set(soundId, now);
      return true;
    }
    return false;
  }
}
```

---

## 4. Accesibilidad y Silenciamiento

* El sistema soporta un flag global `isMuted` persistido en configuración local.
* Cuando `isMuted === true`, el contexto de audio se suspende o los nodos ganancia se ajustan a `0.0`, garantizando $0\%$ de uso de DSP de audio.
