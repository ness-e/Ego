# Experimentación, Variantes y Mejora Continua (Design Experimentation & Iteration)

Este módulo establece el protocolo de experimentación controlada para explorar variantes visuales y cinemáticas, registrar hipótesis y fundamentar decisiones de diseño sin alterar múltiples variables simultáneamente.

---

## 1. Contrato de Registro de Experimentos (`DesignExperimentRecord`)

Toda iteración visual o de animación debe quedar asentada con la siguiente estructura:

```typescript
export interface DesignExperimentRecord {
  experimentId: string;
  designQuestion: string;          // Ej. "¿Cómo mejorar la percepción de masa blanda al aterrizar?"
  hypothesis: string;              // Ej. "Aumentar el amortiguamiento de 0.65 a 0.82 reducirá el temblor excesivo."
  variablesChanged: Record<string, any>;   // Parámetros alterados
  variablesHeldConstant: string[]; // Parámetros congelados (semilla, luz, resolución)
  seed: number;
  renderer: "canvas2d" | "pseudo3d" | "threejs";
  metricsResult: {
    overshootPct: number;
    settlingTimeSec: number;
    maePixelDiff: number;
  };
  humanObservations: string;
  decision: "accepted" | "rejected" | "branch";
  rationale: string;
}
```

---

## 2. Regla de Oro del Control de Variables

> [!CRITICAL]
> **Prohibición de Mutaciones Múltiples**: Si se modifica simultáneamente la silueta, la iluminación, la textura y la curva de resorte, es imposible atribuir la mejora o defecto a una causa concreta.
> * **En pruebas A/B de Material**: La geometría y la luz permanecen estrictamente idénticas.
> * **En pruebas A/B de Cinemática**: La silueta y la paleta permanecen estrictamente idénticas.

---

## 3. Rúbrica de Evaluación Multidimensional (Escala 0–100)

1. **Legibilidad de Silueta (Peso 25%)**: ¿Se distingue la intención y orientación en blanco y negro a 48 px?
2. **Coherencia Material (Peso 20%)**: ¿Los brillos, sombras y texturas respetan las propiedades físicas de la receta?
3. **Naturalidad Cinemática (Peso 20%)**: ¿El sobreimpulso (8–22%) y tiempo de asentamiento ($< 0.5\text{ s}$) transmiten peso creíble?
4. **Respeto a Prioridades HITL (Peso 20%)**: ¿Las alertas de seguridad se comunican sin interferencia cosmética?
5. **Rendimiento y Cero GC (Peso 15%)**: ¿El tiempo de CPU por fotograma se mantiene por debajo de $2.5\text{ ms}$?
