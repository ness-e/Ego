# Microinteractions, Motion Design & UI Feedback

Este documento define la taxonomía temporal, las distancias cinéticas y los patrones de microinteracciones sutiles para integrar personajes como elementos activos de la interfaz de usuario.

---

## 1. Taxonomía Temporal y Presupuestos de Duración

En diseño de interfaces, **las animaciones que exceden los 400 ms en acciones frecuentes se perciben como lentas y frustrantes**. Cada tipo de microinteracción tiene un rango temporal calibrado:

```
Interacción / Disparador        Duración Óptima    Curva Temporal Recomendada       Amplitud Cinética
─────────────────────────────────────────────────────────────────────────────────────────────
Hover / Foco en Botón           120 – 180 ms       easeOutCubic                     Escala 1.05x, inclinación 2°
Pulsación / Click (Press)        60 – 90 ms        easeInQuad                       Compresión squash Sy = 0.92
Liberación (Release)            160 – 220 ms       easeOutBack (overshoot leve)     Rebote elástico Sy = 1.04
Señalamiento de CTA (Guidance)  300 – 450 ms       easeInOutSine                    Giro de cabeza 20°, brazo extendido
Feedback de Éxito (Success)     650 – 900 ms       easeOutElastic                   Salto vertical + elevación de brazos
Feedback de Error (Shake)       320 – 420 ms       Damped Harmonic Sine             Oscilación lateral 3 ciclos a 18Hz
```

---

## 2. El Patrón de Señalamiento hacia la Acción Principal (CTA Pointing)

Cuando el usuario permanece inactivo más de 6 segundos en una pantalla de conversión, el personaje orienta su mirada y apunta con una mano hacia el botón de acción principal:

```typescript
export interface PointingTarget {
  elementId: string;
  worldPosition: [number, number, number];
}

export function calculatePointingPose(
  characterOrigin: [number, number],
  targetElementCenter: [number, number]
): {
  headYaw: number;
  headPitch: number;
  armAngle: number;
} {
  const dx = targetElementCenter[0] - characterOrigin[0];
  const dy = targetElementCenter[1] - characterOrigin[1];
  const angle = Math.atan2(dy, dx);

  return {
    headYaw: Math.max(-0.6, Math.min(0.6, dx * 0.002)),
    headPitch: Math.max(-0.4, Math.min(0.4, -dy * 0.002)),
    armAngle: angle,
  };
}
```

---

## 3. Feedback Táctil y Háptico Integrado

En navegadores móviles y dispositivos que soportan la Vibration API de la W3C, las animaciones del personaje se sincronizan con micro-pulsos hápticos:

```typescript
export namespace HapticFeedback {
  export function triggerSuccessTap(): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      // Patrón de dos pulsos nítidos tipo Taptic Engine
      navigator.vibrate([18, 40, 24]);
    }
  }

  export function triggerErrorBuzzer(): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      // Patrón de tres pulsos rápidos descendentes
      navigator.vibrate([35, 30, 35, 30, 60]);
    }
  }
}
```
Esto transforma al personaje en una experiencia multi-sensorial envolvente.
