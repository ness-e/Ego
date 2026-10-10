# Computational Geometry, Curves & Procedural Surfaces

Este documento expone las formulaciones analíticas y algoritmos geométricos para generar curvas suaves, superficies de barrido, parametrización de longitud de arco y pruebas de intersección.

---

## 1. Algoritmo de De Casteljau y Curvas Bézier Cúbicas

La evaluación directa de un polinomio de Bernstein puede sufrir imprecisiones numéricas. El **Algoritmo de De Casteljau** evalúa y subdivide curvas Bézier mediante interpolaciones lineales recursivas numéricamente estables:

```
P0 ────(t)────> Q0 ────(t)────> R0 ────(t)────> B(t)
P1 ────(t)────> Q1 ────(t)────> R1
P2 ────(t)────> Q2
P3
```

```typescript
export type Point2D = [number, number];

export function evaluateDeCasteljau(
  p0: Point2D, p1: Point2D, p2: Point2D, p3: Point2D,
  t: number
): { point: Point2D; tangent: Point2D } {
  const lerp = (a: Point2D, b: Point2D, k: number): Point2D => [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k
  ];

  // Nivel 1
  const q0 = lerp(p0, p1, t);
  const q1 = lerp(p1, p2, t);
  const q2 = lerp(p2, p3, t);

  // Nivel 2
  const r0 = lerp(q0, q1, t);
  const r1 = lerp(q1, q2, t);

  // Nivel 3 (Punto sobre la curva)
  const point = lerp(r0, r1, t);

  // Vector tangente analítico d/dt = 3 * (r1 - r0)
  const tangent: Point2D = [
    3 * (r1[0] - r0[0]),
    3 * (r1[1] - r0[1])
  ];

  return { point, tangent };
}
```

---

## 2. Splines Catmull-Rom para Extremidades y Colas

A diferencia de las curvas Bézier, las **splines Catmull-Rom pasan exactamente por todos sus puntos de control interiores**, facilitando el modelado de colas, cables o brazos flexibles a partir de articulaciones conocidas:

$$C(u) = \frac{1}{2} \begin{bmatrix} 1 & u & u^2 & u^3 \end{bmatrix} \begin{bmatrix} 
0 & 2 & 0 & 0 \\
-1 & 0 & 1 & 0 \\
2 & -5 & 4 & -1 \\
-1 & 3 & -3 & 1 
\end{bmatrix} \begin{bmatrix} P_{i-1} \\ P_i \\ P_{i+1} \\ P_{i+2} \end{bmatrix}$$

```typescript
export function evaluateCatmullRom(
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number],
  p3: [number, number, number],
  t: number
): [number, number, number] {
  const t2 = t * t;
  const t3 = t2 * t;

  const result: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    result[i] = 0.5 * (
      (2 * p1[i]) +
      (-p0[i] + p2[i]) * t +
      (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 +
      (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3
    );
  }
  return result;
}
```

---

## 3. Parametrización por Longitud de Arco (Arc-Length Parameterization)

Si un elemento del personaje recorre una curva evaluando $t \in [0, 1]$ uniformemente, se moverá a tirones porque la velocidad espacial $\|\dot{B}(t)\|$ varía a lo largo de la curva.

Para lograr **velocidad constante ($v = \text{cte}$)**, se precalcula una tabla de correspondencia entre longitud recorrida $s$ y parámetro temporal $t$:

```typescript
export class ArcLengthTable {
  private samples: Array<{ t: number; arcLength: number }> = [];
  public totalLength: number = 0;

  constructor(
    curveSampler: (t: number) => [number, number, number],
    numSamples: number = 100
  ) {
    let accumulated = 0;
    let prev = curveSampler(0);
    this.samples.push({ t: 0, arcLength: 0 });

    for (let i = 1; i <= numSamples; i++) {
      const t = i / numSamples;
      const curr = curveSampler(t);
      const dist = Math.hypot(curr[0] - prev[0], curr[1] - prev[1], curr[2] - prev[2]);
      accumulated += dist;
      this.samples.push({ t, arcLength: accumulated });
      prev = curr;
    }
    this.totalLength = accumulated;
  }

  /**
   * Mapea una distancia acumulada s a su parámetro t correspondiente usando búsqueda binaria
   */
  public getTForDistance(distance: number): number {
    const target = Math.max(0, Math.min(this.totalLength, distance));
    let low = 0;
    let high = this.samples.length - 1;

    while (low < high) {
      const mid = (low + high) >> 1;
      if (this.samples[mid].arcLength < target) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    if (low === 0) return 0;
    const prevEntry = this.samples[low - 1];
    const currEntry = this.samples[low];
    const segmentLen = currEntry.arcLength - prevEntry.arcLength;
    if (segmentLen < 0.00001) return currEntry.t;

    const localFraction = (target - prevEntry.arcLength) / segmentLen;
    return prevEntry.t + localFraction * (currEntry.t - prevEntry.t);
  }
}
```

---

## 4. Superficies de Barrido y Extrusión a lo largo de Splines

Para construir antenas tubulares, cuerdas o collares por código, se transporta un perfil 2D (círculo o polígono de $N$ vértices) a lo largo del eje tangente de la curva utilizando el **Frenet-Serret Frame** o los **Rotation Minimizing Frames (RMF)** para evitar torsión parásita (*twisting*):

```
       Perfil 2D (Círculo)
           ( • ) 
             \
              \====( Barrido a lo largo de la tangente T )====> Tubo 3D
```

---

## 5. Algoritmos de Intersección y Raycasting Analítico

### 5.1. Ray-Sphere Intersection (Para Ojos, Manos y Detección de Hover)
Dado un rayo $\vec{R}(t) = \vec{O} + t\vec{D}$ con $\|\vec{D}\| = 1$ y una esfera con centro $\vec{C}$ y radio $r$:

$$\vec{L} = \vec{C} - \vec{O}, \quad t_{ca} = \vec{L} \cdot \vec{D}$$

$$d^2 = \vec{L} \cdot \vec{L} - t_{ca}^2$$

Si $d^2 > r^2$, no hay impacto. Si $d^2 \le r^2$:
$$t = t_{ca} - \sqrt{r^2 - d^2}$$

### 5.2. Ray-AABB Intersection (Cajas Alineadas con los Ejes - Algoritmo de Slabbing)
Utilizado para verificar clicks sobre el torso o la cabeza sin evaluar triángulos individuales:

```typescript
export function intersectRayAABB(
  rayOrigin: [number, number, number],
  rayDir: [number, number, number],
  boxMin: [number, number, number],
  boxMax: [number, number, number]
): boolean {
  let tmin = -Infinity;
  let tmax = Infinity;

  for (let i = 0; i < 3; i++) {
    const invD = 1.0 / rayDir[i];
    let t0 = (boxMin[i] - rayOrigin[i]) * invD;
    let t1 = (boxMax[i] - rayOrigin[i]) * invD;
    if (invD < 0) {
      const tmp = t0; t0 = t1; t1 = tmp;
    }
    tmin = Math.max(tmin, t0);
    tmax = Math.min(tmax, t1);
    if (tmax <= tmin) return false;
  }
  return tmax > 0;
}
```
Esto garantiza una interacción responsiva a 60 FPS con costo casi nulo de CPU.
