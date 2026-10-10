# Facial Expressions, Emotional Architecture & Advanced Gaze Dynamics

Este documento define la arquitectura analítica para la parametrización de rasgos faciales, el catálogo formal de 28 emociones diferenciadas, el algoritmo de mezcla ponderada y la dinámica biológica de la mirada.

---

## 1. Espacio Paramétrico Facial Normalizado

El rostro se modela mediante un vector de parámetros normalizados en el rango $[-1.0, +1.0]$ o $[0.0, 1.0]$. Esta abstracción funciona de manera idéntica sobre primitivas SVG, blend shapes 3D, huesos faciales o visores matriciales LED:

```typescript
export interface FacialFeatureVector {
  // Cejas (Eyebrows)
  browHeight: number;        // -1.0 (ceño bajo fruncido) a +1.0 (sorpresa levantada)
  browSlant: number;         // -1.0 (tristeza/preocupación / \) a +1.0 (ira/determinación \ /)
  browArch: number;          // 0.0 (recta/rígida) a +1.0 (arco redondeado orgánico)
  browAsymmetry: number;     // -1.0 (ceja izq levantada) a +1.0 (ceja der levantada)

  // Ojos & Párpados (Eyes & Eyelids)
  eyeOpenness: number;       // 0.0 (cerrado total) a 1.0 (neutro) a 1.4 (apertura en shock)
  eyeSquint: number;         // 0.0 (relajado) a 1.0 (ojos achinados al sonreír)
  eyeShape: 'round' | 'pill' | 'happy_arch' | 'angry_slant' | 'flat_top';

  // Dinámica Pupilar & Mirada (Pupils & Gaze)
  pupilTargetX: number;      // -1.0 (mirada extrema izq) a +1.0 (extrema der)
  pupilTargetY: number;      // -1.0 (mirada abajo) a +1.0 (mirada arriba)
  pupilDilation: number;     // 0.7 (pupila contraída en shock/alerta) a 1.3 (dilatada en empatía)
  convergence: number;       // 0.0 (mirada al infinito paralela) a 1.0 (bizco mirando objeto muy cercano)

  // Boca & Mandíbula (Mouth & Jaw)
  mouthCurvature: number;    // -1.0 (comisuras hacia abajo) a 0.0 (recta) a +1.0 (sonrisa amplia)
  mouthOpenness: number;     // 0.0 (cerrada hermética) a 1.0 (abierta hablando/gritando)
  mouthWidth: number;        // 0.6 (boca estrecha/sorpresa) a 1.4 (boca muy ancha)
  jawShiftX: number;         // -1.0 a +1.0 (mandíbula desplazada lateralmente en duda o mueca)

  // Tensión Global (Global Stress & Squash)
  cheekPuff: number;         // 0.0 a 1.0 (mejillas infladas o elevadas por la risa)
  facialTension: number;     // 0.0 (relajación plena) a 1.0 (tensión muscular extrema)
  faceSquashStretch: number; // 0.85 (compresión horizontal) a 1.15 (estiramiento vertical)
}
```

---

## 2. Catálogo de 28 Emociones y Perfiles de Calibración

Las emociones no son emojis genéricos. Cada perfil describe la configuración exacta de parámetros faciales, postura y actitud:

| Emoción | Rasgos Cejas | Ojos / Párpados | Pupilas / Mirada | Boca y Mandíbula | Tensión |
|---|---|---|---|---|---|
| **1. Alegría** | Altura: +0.2, Slant: 0.0 | Squint: 0.7, Open: 0.85 | Dilatación: 1.15, Frontal | Curvatura: +0.85, Open: 0.35, Width: 1.15 | 0.2 |
| **2. Entusiasmo** | Altura: +0.5, Slant: +0.1 | Squint: 0.4, Open: 1.25 | Dilatación: 1.25, Frontal | Curvatura: +1.0, Open: 0.7, Width: 1.3 | 0.4 |
| **3. Satisfacción** | Altura: +0.1, Slant: 0.0 | Squint: 0.8, Open: 0.4 | Dilatación: 1.0, Centrada | Curvatura: +0.6, Open: 0.05, Width: 1.0 | 0.1 |
| **4. Orgullo** | Altura: +0.3, Slant: +0.2 | Squint: 0.3, Open: 0.9 | Mirada ligeramente alta (+0.2) | Curvatura: +0.45, Mandíbula erguida | 0.3 |
| **5. Curiosidad** | Altura: +0.4, Asimetría: +0.6 | Squint: 0.0, Open: 1.15 | Desviada al target, Dilatada: 1.2 | Curvatura: +0.2, Open: 0.1, Width: 0.85 | 0.2 |
| **6. Interés** | Altura: +0.2, Slant: +0.1 | Squint: 0.1, Open: 1.05 | Fijación directa sin sacadas | Curvatura: +0.1, Open: 0.0 | 0.2 |
| **7. Concentración** | Altura: -0.4, Slant: +0.4 | Squint: 0.3, Open: 0.85 | Fijación intensa, Dilatación: 0.85 | Curvatura: 0.0, Open: 0.0, Width: 0.9 | 0.7 |
| **8. Duda** | Altura: 0.0, Asimetría: -0.7 | Squint: 0.2, Open: 0.9 | Mirada lateral alta (+0.4, +0.3) | Curvatura: -0.2, JawShift: +0.4 | 0.5 |
| **9. Confusión** | Altura: -0.2, Asimetría: +0.8 | Squint: 0.4, Open: 0.8 | Parpadeo rápido, sacadas erráticas | Curvatura: -0.3, Width: 0.8 | 0.6 |
| **10. Sorpresa** | Altura: +0.9, Arch: 1.0 | Squint: 0.0, Open: 1.35 | Dilatación: 1.2, Fijación frontal | Curvatura: 0.0, Open: 0.8, Width: 0.75 | 0.4 |
| **11. Asombro** | Altura: +1.0, Arch: 0.8 | Squint: 0.0, Open: 1.4 | Dilatación: 1.35, Mirada alta | Curvatura: +0.3, Open: 0.9, Width: 0.9 | 0.3 |
| **12. Preocupación** | Altura: +0.3, Slant: -0.8 | Squint: 0.1, Open: 0.95 | Dilatación: 0.9, Mirada oscilante | Curvatura: -0.6, Width: 0.85 | 0.6 |
| **13. Tristeza** | Altura: -0.2, Slant: -0.9 | Squint: 0.2, Open: 0.7 | Mirada baja (-0.5), Párpados caídos | Curvatura: -0.85, Open: 0.15, Width: 0.9 | 0.4 |
| **14. Decepción** | Altura: -0.3, Slant: -0.6 | Squint: 0.0, Open: 0.65 | Mirada desciende lentamente (-0.7) | Curvatura: -0.5, Cabeza inclinada abajo | 0.3 |
| **15. Frustración** | Altura: -0.6, Slant: +0.7 | Squint: 0.5, Open: 0.8 | Dilatación: 0.8, Mirada fija cerrada | Curvatura: -0.7, Dientes apretados | 0.9 |
| **16. Enfado** | Altura: -0.8, Slant: +1.0 | Squint: 0.3, Open: 1.05 | Dilatación: 0.75 (contraída), Fija | Curvatura: -0.9, Open: 0.4, Width: 1.2 | 1.0 |
| **17. Miedo** | Altura: +0.7, Slant: -0.7 | Squint: 0.0, Open: 1.4 | Dilatación: 0.7, Sacadas en pánico | Curvatura: -0.4, Open: 0.6, Width: 1.1 | 0.95 |
| **18. Vergüenza** | Altura: +0.1, Slant: -0.4 | Squint: 0.4, Open: 0.6 | Mirada evadida abajo-lateral | Curvatura: +0.2, Open: 0.05, CheekPuff: 0.8| 0.5 |
| **19. Timidez** | Altura: +0.2, Slant: -0.3 | Squint: 0.3, Open: 0.75 | Mirada lateral con micro-vistazos | Curvatura: +0.3, Open: 0.0, Width: 0.8 | 0.3 |
| **20. Alivio** | Altura: 0.0, Slant: -0.2 | Squint: 0.6, Open: 0.5 | Ojos semicerrados, exhalación | Curvatura: +0.4, Open: 0.2 (suspiro) | 0.0 |
| **21. Empatía** | Altura: +0.3, Slant: -0.5 | Squint: 0.3, Open: 0.95 | Dilatación: 1.25, Contacto suave | Curvatura: +0.3, Open: 0.1, Width: 0.95 | 0.2 |
| **22. Serenidad** | Altura: 0.0, Slant: 0.0 | Squint: 0.2, Open: 0.85 | Dilatación: 1.0, Fijación calmada | Curvatura: +0.15, Open: 0.0, Width: 1.0 | 0.05 |
| **23. Cansancio** | Altura: -0.3, Slant: -0.3 | Squint: 0.1, Open: 0.35 | Párpados pesados, parpadeo lento | Curvatura: -0.2, Open: 0.2 (bostezo) | 0.1 |
| **24. Aburrimiento**| Altura: -0.1, Slant: 0.0 | Squint: 0.1, Open: 0.55 | Mirada desenfocada errática | Curvatura: -0.1, JawShift: -0.3 | 0.0 |
| **25. Escepticismo**| Altura: 0.0, Asimetría: +1.0 | Squint: 0.6, Open: 0.85 | Mirada entrecerrada de reojo | Curvatura: -0.2, Width: 0.9 | 0.6 |
| **26. Picardía** | Altura: +0.2, Asimetría: -0.5 | Squint: 0.5, Open: 0.9 | Guiño asimétrico / Mirada lateral | Curvatura: +0.7, Width: 1.1 | 0.3 |
| **27. Determinación**| Altura: -0.5, Slant: +0.8 | Squint: 0.2, Open: 1.0 | Dilatación: 0.9, Foco inquebrantable | Curvatura: +0.1, Open: 0.0, Mandíbula firme| 0.8 |
| **28. Expectativa** | Altura: +0.4, Slant: +0.2 | Squint: 0.1, Open: 1.15 | Dilatación: 1.1, Ojos fijos brillantes| Curvatura: +0.5, Open: 0.15, Width: 1.0 | 0.4 |

---

## 3. Algoritmo de Mezcla y Transición Ponderada

El cambio entre emociones **no debe ser un cross-fade lineal**. Se aplica un interpolador de mezcla con pesos dinámicos (*Weighted Emotional Blend*):

```typescript
export function blendFacialExpressions(
  base: FacialFeatureVector,
  target: FacialFeatureVector,
  t: number,
  easing: (k: number) => number = (k) => k * k * (3 - 2 * k)
): FacialFeatureVector {
  const k = easing(Math.max(0, Math.min(1, t)));
  const lerp = (a: number, b: number) => a + (b - a) * k;

  return {
    browHeight: lerp(base.browHeight, target.browHeight),
    browSlant: lerp(base.browSlant, target.browSlant),
    browArch: lerp(base.browArch, target.browArch),
    browAsymmetry: lerp(base.browAsymmetry, target.browAsymmetry),
    eyeOpenness: lerp(base.eyeOpenness, target.eyeOpenness),
    eyeSquint: lerp(base.eyeSquint, target.eyeSquint),
    eyeShape: k > 0.5 ? target.eyeShape : base.eyeShape,
    pupilTargetX: lerp(base.pupilTargetX, target.pupilTargetX),
    pupilTargetY: lerp(base.pupilTargetY, target.pupilTargetY),
    pupilDilation: lerp(base.pupilDilation, target.pupilDilation),
    convergence: lerp(base.convergence, target.convergence),
    mouthCurvature: lerp(base.mouthCurvature, target.mouthCurvature),
    mouthOpenness: lerp(base.mouthOpenness, target.mouthOpenness),
    mouthWidth: lerp(base.mouthWidth, target.mouthWidth),
    jawShiftX: lerp(base.jawShiftX, target.jawShiftX),
    cheekPuff: lerp(base.cheekPuff, target.cheekPuff),
    facialTension: lerp(base.facialTension, target.facialTension),
    faceSquashStretch: lerp(base.faceSquashStretch, target.faceSquashStretch),
  };
}
```

---

## 4. Dinámica Ocular Avanzada: Sacadas y Fijación Visual

Una mirada que sigue al cursor como un puntero láser rígido parece la cámara de un dron. Los ojos biológicos se mueven mediante **Micro-Sacadas Oculares** (saltos bruscos de 30-50 ms seguidos de periodos de fijación):

```typescript
export class AdvancedGazeController {
  private currentPupil: [number, number] = [0, 0];
  private saccadeTarget: [number, number] = [0, 0];
  private fixationTimer: number = 0;
  private nextFixationDuration: number = 0.8;

  /**
   * Actualiza la mirada hacia un target continuo añadiendo sacadas biológicas
   */
  public update(targetLook: [number, number], dt: number): [number, number] {
    this.fixationTimer += dt;

    if (this.fixationTimer >= this.nextFixationDuration) {
      this.fixationTimer = 0;
      // Duración de fijación entre 400ms y 1.4s
      this.nextFixationDuration = 0.4 + Math.random() * 1.0;

      // Micro-sacada: pequeña desviación involuntaria (jitter) de atención
      const microJitterX = (Math.random() - 0.5) * 0.08;
      const microJitterY = (Math.random() - 0.5) * 0.06;
      this.saccadeTarget = [
        Math.max(-1, Math.min(1, targetLook[0] + microJitterX)),
        Math.max(-1, Math.min(1, targetLook[1] + microJitterY)),
      ];
    }

    // Salto rápido sacádico (resorte muy rígido k=400)
    const springSpeed = 24.0 * dt;
    this.currentPupil[0] += (this.saccadeTarget[0] - this.currentPupil[0]) * Math.min(1, springSpeed);
    this.currentPupil[1] += (this.saccadeTarget[1] - this.currentPupil[1]) * Math.min(1, springSpeed);

    return this.currentPupil;
  }
}
```
Este algoritmo erradica por completo la "mirada muerta" y dota al personaje de un procesamiento cognitivo visible en tiempo real.
