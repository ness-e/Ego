# Animation Principles, Procedural Rigging & Kinematics

Este documento codifica los 12 principios clásicos de la animación en algoritmos ejecutables y define la arquitectura de rigging procedural para personajes articulados.

---

## 1. Los 12 Principios Clásicos Traducidos a Funciones Matemáticas

```
Principio Clásico                Operación Matemática / Algoritmo en Código
────────────────────────────────────────────────────────────────────────────────────────
1. Squash & Stretch             Deformación no homogénea con volumen constante: Sx = Sz = 1/sqrt(Sy)
2. Anticipation                 Pre-movimiento en dirección opuesta con duración de 80-150 ms
3. Staging                      Alineación de silueta y rotación de torso para máxima legibilidad
4. Pose-to-Pose                 Interpolación entre estados discretos de la FSM mediante Slerp
5. Follow Through & Overlap     Desfase de fase armónica en extremidades: φ_secundaria = φ_padre - π/3
6. Slow In & Slow Out           Curvas Bézier cúbicas con derivadas cero en t=0 y t=1
7. Arcs                         Trayectorias paraboloides o elípticas en lugar de traslaciones lineales
8. Secondary Action             Superposición de oscilaciones independientes en antenas y ropa
9. Timing & Spacing             Distribución no lineal de muestras temporales basada en aceleración
10. Exaggeration                Factor de ganancia k > 1.0 en picos de velocidad de rotación
11. Solid Drawing               Transformaciones ortonormales sin distorsión de corte (shear)
12. Appeal                      Asimetría deliberada en reposo (tilt de cabeza de 3° a 6°)
```

---

## 2. Implementación de Curvas de Easing Avanzadas

En lugar de depender de librerías externas pesadas, las curvas de transición de grado de producción se resuelven mediante funciones analíticas puras:

```typescript
export namespace Easings {
  // Cubic In-Out estándar
  export function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // Resorte elástico con rebote (Overshoot controlado)
  export function easeOutBack(t: number, overshoot: number = 1.70158): number {
    const c1 = overshoot;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  // Easing Elástico con decaimiento senoidal
  export function easeOutElastic(t: number): number {
    if (t === 0) return 0;
    if (t === 1) return 1;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }
}
```

---

## 3. Two-Bone Inverse Kinematics (IK) con Vector de Polo

Cuando los pies deben fijarse al suelo durante un salto o una mano debe tocar un botón de la pantalla, la cinemática inversa calcula los ángulos de la cadera/hombro y rodilla/codo con **un vector de polo** (*Pole Vector*) que impide que la articulación se doble hacia el lado incorrecto:

```
           Base (Hombro / Cadera)
                 o
                / \
               /   \   L1
              /     \
             /       o  Codo / Rodilla  <── [ Pole Vector ] (Dirección de flexión)
            /       /
           /       /   L2
          /       /
         v       v
         o Efector Final (Mano / Pie) ──> Alcanzar Target T
```

```typescript
export interface IKChain2Bones {
  joint1Angle: number; // Rotación en articulación proximal
  joint2Angle: number; // Rotación en articulación intermedia
  isReachable: boolean;
}

export function solveAnalyticalIK(
  rootPos: [number, number],
  targetPos: [number, number],
  bone1Length: number,
  bone2Length: number,
  poleDirection: 1 | -1 = 1 // 1: flexión hacia adelante, -1: flexión hacia atrás
): IKChain2Bones {
  const dx = targetPos[0] - rootPos[0];
  const dy = targetPos[1] - rootPos[1];
  const dist = Math.hypot(dx, dy);

  const l1 = bone1Length;
  const l2 = bone2Length;
  const maxReach = l1 + l2 - 0.0001;
  const minReach = Math.abs(l1 - l2) + 0.0001;

  // Clamping de distancia para evitar fallo de arccos
  const d = Math.max(minReach, Math.min(maxReach, dist));

  // Ley del coseno para articulación intermedia (Codo / Rodilla)
  const cosAngle2 = (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2);
  const angle2 = (Math.PI - Math.acos(cosAngle2)) * poleDirection;

  // Ley del coseno para ángulo base relativo a la línea directa
  const cosAngle1Rel = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const angle1Rel = Math.acos(cosAngle1Rel) * poleDirection;
  const baseAngleToTarget = Math.atan2(dy, dx);

  const angle1 = baseAngleToTarget - angle1Rel;

  return {
    joint1Angle: angle1,
    joint2Angle: angle2,
    isReachable: dist <= maxReach && dist >= minReach,
  };
}
```

---

## 4. Ciclos de Animación Generativos Continuos

Para evitar que las animaciones en bucle (*loops*) parezcan grabaciones mecánicas repetitivas:

### 4.1. Respiración con Desfase de Inhalación/Exhalación
La relación temporal natural entre inhalación y exhalación es aproximadamente $1:1.5$:

```typescript
export function getOrganicBreathingPhase(time: number, period: number = 3.6): {
  volumeScaleY: number;
  tiltAngle: number;
} {
  const t = (time % period) / period;
  // Fase asimétrica: sube rápido hasta 0.4 del periodo, desciende lento hasta 1.0
  let progress: number;
  if (t < 0.4) {
    progress = Math.sin((t / 0.4) * (Math.PI / 2)); // Inhalación activa
  } else {
    progress = Math.cos(((t - 0.4) / 0.6) * (Math.PI / 2)); // Exhalación pasiva relajada
  }

  const sy = 1.0 + progress * 0.035;
  const tilt = (progress - 0.5) * 0.02; // Micro-inclinación del torso
  return { volumeScaleY: sy, tiltAngle: tilt };
}
```
Con este módulo, los movimientos procedurales alcanzan la calidad estética y calidez de un estudio de animación profesional.
