# Accesibilidad y Rendimiento en el Escritorio: Presupuestos Medidos y Modo Reducido

Este módulo formaliza las directrices de bajo consumo energético, presupuestos de CPU/GPU y adaptaciones de accesibilidad física y cognitiva para personajes que coexisten continuamente con las aplicaciones de trabajo del usuario en el escritorio.

---

## 1. Soporte Estricto de `prefers-reduced-motion`

Cuando el sistema operativo o el usuario activan la preferencia de movimiento reducido:

1. **Suspensión de Oscilaciones Continuas**:
   - Se desactivan las oscilaciones de respiración (*breathe*), flotación ingrávida en $Y$ y rebotes continuos.
2. **Sustitución de Trayectorias Balísticas por Disolución Cruzada**:
   - En lugar de saltar parabólicamente entre el anclaje y el escritorio, el personaje transiciona mediante un desvanecimiento suave de opacidad (*crossfade*) de $120\text{ ms}$.
3. **Poses Estáticas Claras**:
   - Los estados emocionales y operativos se representan mediante la pose geométrica estática final correspondiente, sin animaciones de resorte secundario.

---

## 2. Perfiles de Rendimiento y Consumo Energético

| Perfil | Destino de Uso | Comportamiento del Render | Presupuesto CPU por Frame |
|---|---|---|---|
| **Alto (Performance)** | Dispositivos de sobremesa conectados a corriente. | 60–120 FPS, sombreado dinámico completo, partículas y rebotes. | $< 4.0\text{ ms}$ por fotograma |
| **Equilibrado (Default)** | Uso estándar en portátiles. | 60 FPS, sombreado analítico, supresión de micro-partículas. | $< 2.5\text{ ms}$ por fotograma |
| **Bajo Consumo (Battery)** | Batería baja o ventana no enfocada. | Cadencia reducida a 24–30 FPS, cálculo de luz estático. | $< 1.2\text{ ms}$ por fotograma |
| **Inactivo (Suspended)** | Oculto o monitor en reposo. | Render loop completamente detenido (`rAF` cancelado, 0% CPU). | $0.0\text{ ms}$ |

---

## 3. Telemetría Real y Métricas Verificables

Queda estrictamente prohibido afirmar que una animación alcanza 60 FPS sin medirla en tiempo real:

```typescript
export interface FrameTelemetry {
  frameDurationMs: number;
  updateTimeMs: number;
  renderTimeMs: number;
  currentFps: number;
}

export class PerformanceMonitor {
  private lastTime = performance.now();
  private frames = 0;
  private fpsTimer = performance.now();
  public currentFps = 60;

  public sample(): FrameTelemetry {
    const now = performance.now();
    const frameDuration = now - this.lastTime;
    this.lastTime = now;

    this.frames++;
    if (now - this.fpsTimer >= 500) {
      this.currentFps = Math.round((this.frames / (now - this.fpsTimer)) * 1000);
      this.frames = 0;
      this.fpsTimer = now;
    }

    return {
      frameDurationMs: frameDuration,
      updateTimeMs: 0,
      renderTimeMs: 0,
      currentFps: this.currentFps,
    };
  }
}
```
