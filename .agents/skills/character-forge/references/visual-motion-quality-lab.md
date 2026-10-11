# Laboratorio de Calidad Visual y Movimiento (Visual & Motion Quality Lab)

Este módulo formaliza los procedimientos de prueba deterministas, captura de escenas estandarizadas, métricas físicas cuantitativas de animación y comparación de versiones para erradicar regresiones visuales.

---

## 1. El Principio del Reloj Determinista en Pruebas

Para que dos ejecuciones de prueba produzcan resultados matemáticamente idénticos e imágenes comparables bit a bit:
* **Se prohibe el uso de `performance.now()` o `Date.now()` no controlado** en el modo de prueba.
* Se utiliza un **reloj simulado por pasos discretos** ($\Delta t = 1/60\text{ s}$ o $t_{\text{fijo}}$), junto con una semilla pseudoaleatoria fija (`seed = 1337`).

```typescript
export class DeterministicTestClock {
  public currentTimeSec: number = 0;

  constructor(public stepSizeSec: number = 1 / 60) {}

  public advance(steps: number = 1): number {
    this.currentTimeSec += this.stepSizeSec * steps;
    return this.currentTimeSec;
  }

  public seek(targetSec: number): void {
    this.currentTimeSec = targetSec;
  }
}
```

---

## 2. Catálogo de Escenas de Prueba Estandarizadas (Test Matrix)

Toda mascota o personaje producido debe evaluarse contra 8 escenas estandarizadas:

| ID de Escena | Parámetros Fijos de Escena | Objetivo de la Validación |
|---|---|---|
| `SCENE_SILHOUETTE_FRONT` | $t = 0\text{ s}$, vista frontal, silueta monocromática. | Reconocimiento de masa y proporciones anatómicas. |
| `SCENE_YAW_EXTREMES` | $\psi = \pm 35^\circ$, mirada a extremos laterales. | Proyección esférica de ojos y oclusión lateral de mejillas. |
| `SCENE_PITCH_EXTREMES` | $\theta = \pm 22^\circ$, cabeza arriba y abajo. | Compresión vertical de rasgos y perspectiva de accesorios. |
| `SCENE_SQUASH_APEX` | $t = 0.15\text{ s}$ tras salto, $S_y = 0.78, S_x = 1.13$. | Preservación de volumen constante y contacto con el suelo. |
| `SCENE_OUTFIT_OCCLUSION` | Accesorio equipado, $\psi = 45^\circ, \theta = 15^\circ$. | Verificación de que el segmento trasero pasa por detrás del cuerpo. |
| `SCENE_COMPACT_ICON_48` | Renderizado forzado a $48 \times 48\text{ px}$. | Supresión de ruido visual y legibilidad en miniatura. |
| `SCENE_HITL_ALERT` | Estado `waitingForApproval` activo con badge `bang`. | Prevalencia visual inmediata y contraste accesible. |
| `SCENE_DARK_LIGHT_CONTRAST`| Mismo render sobre fondo `#0d1117` y `#ffffff`. | Integridad del borde y ausencia de halos negros sucios. |

---

## 3. Métricas Cuantitativas de Movimiento Físico

El laboratorio evalúa automáticamente las trayectorias de los resortes y articulaciones extrayendo:

### 3.1. Sobreimpulso Máximo (Overshoot)
Mide el porcentaje que excede el objetivo antes de retornar:
$$\text{Overshoot}(\%) = \frac{|x_{\text{max}} - x_{\text{target}}|}{|x_{\text{target}} - x_0|} \times 100$$
* **Criterio de Calidad**: Para movimientos orgánicos (Coucou/Mochi), el sobreimpulso debe situarse entre $8\%$ y $22\%$. Menos de $5\%$ resulta rígido; más de $35\%$ genera descontrol gomoso.

### 3.2. Tiempo de Asentamiento (Settling Time, $T_s$)
Tiempo requerido para que las oscilaciones permanezcan dentro de una banda de tolerancia del $\pm 2\%$ del valor objetivo:
$$|x(t) - x_{\text{target}}| \le 0.02 \cdot |x_{\text{target}} - x_0|, \quad \forall t \ge T_s$$
* **Criterio de Calidad**: Para micro-reacciones, $T_s \le 0.45\text{ s}$. Para celebraciones amplias, $T_s \le 1.20\text{ s}$.

---

## 4. Comparación Visual Automatizada (MAE & Bounding Box)

1. **Error Absoluto Medio de Píxeles (MAE)**:
   $$\text{MAE} = \frac{1}{W \times H} \sum_{x, y} |I_{\text{actual}}(x, y) - I_{\text{referencia}}(x, y)|$$
2. **Deriva de Caja Envolvente (Bounding Box Drift)**:
   Comprueba que el centroide y las dimensiones mínimas/máximas de la silueta no varíen más de $\pm 2\text{ px}$ en poses idénticas.
