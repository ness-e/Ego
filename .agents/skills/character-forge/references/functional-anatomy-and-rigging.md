# Functional Anatomy, Multi-Morphology Rigging & Inverse Kinematics

Este documento detalla la construcción de esqueletos funcionales, jerarquías de articulaciones con rangos de movimiento (ROM), cinemática inversa multi-articular (FABRIK) y prevención de deslizamiento en el suelo (*foot-sliding*).

---

## 1. Jerarquías Esqueléticas según Morfología

No todos los personajes comparten la anatomía bípeda humana. Se definen 4 arquetipos morfológicos canónicos:

```
A. BÍPEDO ESTILIZADO              B. ROBOT MODULAR FLOTANTE         C. TENTÁCULO / APÉNDICE CONTINUO
      [ Cabeza / Visor ]                  [ Baliza / Sensor ]                   (Base Anclada)
             │                                   │                                    │
       [ Cuello Pivote ]                  [ Cabeza Squircle ]                        [Bone 1]
             │                                   │                                    │
         [ Pecho ]                        [ Cuello Magnético ]                       [Bone 2]
        /    │    \                              │                                    │
    [Hombro][Cadera][Hombro]                 [ Torso Reactor ]                       [Bone 3]
       │     │  │     │                     /        │        \                           │
     [Codo] [Rodilla][Codo]          [Hombro Mag] [Propulsor] [Hombro Mag]          [Bone 4 (Punta)]
       │     │  │     │                     │                  │
     [Mano] [Pie][Pie] [Mano]           [Efector]          [Efector]
```

---

## 2. Rangos de Movimiento Anatómico (Range of Motion - ROM)

Para evitar dislocaciones articulares (*bone snapping*), cada articulación define límites angulares rígidos en sus ejes locales:

```typescript
export interface JointLimitLimits {
  minPitch: number; maxPitch: number; // Eje X (Flexión / Extensión)
  minYaw: number;   maxYaw: number;   // Eje Y (Rotación axial)
  minRoll: number;  maxRoll: number;  // Eje Z (Inclinación lateral)
}

export const ANATOMICAL_LIMITS: Record<string, JointLimitLimits> = {
  neck: {
    minPitch: (-25 * Math.PI) / 180, maxPitch: (35 * Math.PI) / 180,
    minYaw: (-45 * Math.PI) / 180,   maxYaw: (45 * Math.PI) / 180,
    minRoll: (-15 * Math.PI) / 180,  maxRoll: (15 * Math.PI) / 180,
  },
  shoulder: {
    minPitch: (-60 * Math.PI) / 180, maxPitch: (140 * Math.PI) / 180,
    minYaw: (-30 * Math.PI) / 180,   maxYaw: (90 * Math.PI) / 180,
    minRoll: (-90 * Math.PI) / 180,  maxRoll: (45 * Math.PI) / 180,
  },
  elbow: {
    minPitch: 0,                     maxPitch: (145 * Math.PI) / 180, // Solo flexiona en un sentido
    minYaw: 0,                       maxYaw: 0,
    minRoll: 0,                      maxRoll: 0,
  },
};
```

---

## 3. Algoritmo FABRIK para Cadenas Multi-Articulares (Tentáculos y Brazos Robóticos)

Cuando una extremidad cuenta con más de dos articulaciones (ej. un tentáculo o brazo telescópico de 4 a 8 eslabones), la ley del coseno simple es insuficiente. El algoritmo **FABRIK (Forward And Backward Reaching Inverse Kinematics)** resuelve la posición de todos los nodos en tiempo real con convergencia de 2 a 4 iteraciones:

```
1. Fase Forward: Fuerza al efector final a coincidir con el Target y proyecta los huesos hacia atrás.
2. Fase Backward: Fija la base a su raíz fija y proyecta los huesos hacia adelante restaurando distancias.
```

```typescript
export class FabrikChainSolver {
  public points: Array<[number, number, number]>;
  public lengths: number[];
  public totalLength: number;

  constructor(initialJoints: Array<[number, number, number]>) {
    this.points = initialJoints.map(p => [...p]);
    this.lengths = [];
    this.totalLength = 0;

    for (let i = 0; i < this.points.length - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];
      const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]);
      this.lengths.push(len);
      this.totalLength += len;
    }
  }

  public solve(
    target: [number, number, number],
    tolerance: number = 0.001,
    maxIterations: number = 6
  ): void {
    const origin = [...this.points[0]] as [number, number, number];
    const n = this.points.length;

    // Distancia al target
    const distToTarget = Math.hypot(target[0] - origin[0], target[1] - origin[1], target[2] - origin[2]);

    // Caso inalcanzable: estirar al máximo hacia el target
    if (distToTarget > this.totalLength) {
      for (let i = 0; i < n - 1; i++) {
        const ratio = this.lengths[i] / distToTarget;
        this.points[i + 1] = [
          this.points[i][0] + (target[0] - this.points[i][0]) * ratio,
          this.points[i][1] + (target[1] - this.points[i][1]) * ratio,
          this.points[i][2] + (target[2] - this.points[i][2]) * ratio,
        ];
      }
      return;
    }

    // Iteraciones de Forward & Backward
    for (let iter = 0; iter < maxIterations; iter++) {
      // 1. FORWARD PASS (desde efector hacia raíz)
      this.points[n - 1] = [...target];
      for (let i = n - 2; i >= 0; i--) {
        const dx = this.points[i][0] - this.points[i + 1][0];
        const dy = this.points[i][1] - this.points[i + 1][1];
        const dz = this.points[i][2] - this.points[i + 1][2];
        const dist = Math.hypot(dx, dy, dz) || 0.0001;
        const lambda = this.lengths[i] / dist;

        this.points[i] = [
          this.points[i + 1][0] + dx * lambda,
          this.points[i + 1][1] + dy * lambda,
          this.points[i + 1][2] + dz * lambda,
        ];
      }

      // 2. BACKWARD PASS (desde raíz hacia efector)
      this.points[0] = [...origin];
      for (let i = 0; i < n - 1; i++) {
        const dx = this.points[i + 1][0] - this.points[i][0];
        const dy = this.points[i + 1][1] - this.points[i][1];
        const dz = this.points[i + 1][2] - this.points[i][2];
        const dist = Math.hypot(dx, dy, dz) || 0.0001;
        const lambda = this.lengths[i] / dist;

        this.points[i + 1] = [
          this.points[i][0] + dx * lambda,
          this.points[i][1] + dy * lambda,
          this.points[i][2] + dz * lambda,
        ];
      }

      // Comprobar convergencia
      const tip = this.points[n - 1];
      const error = Math.hypot(tip[0] - target[0], tip[1] - target[1], tip[2] - target[2]);
      if (error < tolerance) break;
    }
  }
}
```

---

## 4. Estabilización de Pies y Prevención de Deslizamiento (Anti-Foot-Sliding)

Cuando el personaje realiza una animación de caminata o salto, **los pies deben fijarse al suelo durante la fase de apoyo (*Stance Phase*)**:

```typescript
export interface FootLockState {
  isPlanted: boolean;
  plantedWorldPosition: [number, number, number];
}

export function updateFootPlanting(
  footWorldPos: [number, number, number],
  state: FootLockState,
  groundY: number = 0
): [number, number, number] {
  // Si el pie entra en contacto con el suelo (Y <= groundY)
  if (footWorldPos[1] <= groundY + 0.02) {
    if (!state.isPlanted) {
      state.isPlanted = true;
      state.plantedWorldPosition = [footWorldPos[0], groundY, footWorldPos[2]];
    }
    // Bloquear posición mundial exactamente donde aterrizó
    return state.plantedWorldPosition;
  }

  // En el aire (Swing Phase)
  state.isPlanted = false;
  return footWorldPos;
}
```
Esto erradica el efecto visual de "patinaje sobre hielo" tan frecuente en animaciones 3D por código.
