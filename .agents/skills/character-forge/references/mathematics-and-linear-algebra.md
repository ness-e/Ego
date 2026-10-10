# Mathematics, Linear Algebra & Kinematic Calculus

Este documento establece las bases analíticas del álgebra lineal y el cálculo diferencial aplicados a la cinemática, orientación tridimensional y transformaciones de personajes interactivos.

---

## 1. Espacios de Coordenadas y Matrices Homogéneas 4×4

Todo vértice de un personaje transita por una cadena canónica de espacios de coordenadas:

$$\vec{v}_{\text{clip}} = \mathbf{M}_{\text{proj}} \cdot \mathbf{M}_{\text{view}} \cdot \mathbf{M}_{\text{world}} \cdot \mathbf{M}_{\text{local}} \cdot \vec{v}_{\text{local}}$$

```
[ Local / Objeto ] ──(M_local)──> [ Jerarquía / Padre ] ──(M_world)──> [ Mundo ]
                                                                           │
[ Pantalla / Pixel ] <──(Viewport)── [ NDC / Clip ] <──(M_proj)── [ Cámara / Vista ]
```

### 1.1. Matriz de Transformación Homogénea Compuesta
Una transformación que combina traslación $\vec{t}$, rotación representada por una matriz ortogonal $\mathbf{R}_{3\times 3}$ y escala no uniforme $\vec{s}$:

$$\mathbf{M} = \begin{bmatrix} 
s_x R_{00} & s_y R_{01} & s_z R_{02} & t_x \\
s_x R_{10} & s_y R_{11} & s_z R_{12} & t_y \\
s_x R_{20} & s_y R_{21} & s_z R_{22} & t_z \\
0 & 0 & 0 & 1 
\end{bmatrix}$$

---

## 2. Vectores, Bases Ortonormales y Ortogonalización

### 2.1. Producto Escalar (Proyección y Ángulo)
$$\vec{a} \cdot \vec{b} = \|\vec{a}\| \|\vec{b}\| \cos\theta \implies \cos\theta = \frac{\vec{a} \cdot \vec{b}}{\|\vec{a}\| \|\vec{b}\|}$$
- Utilizado para verificar si el cursor se encuentra frente al personaje ($\vec{d}_{\text{target}} \cdot \vec{f}_{\text{forward}} > 0$) o a su espalda.

### 2.2. Producto Vectorial (Generación de Normales y Ejes de Giro)
$$\vec{u} = \vec{a} \times \vec{b} = \begin{pmatrix} a_y b_z - a_z b_y \\ a_z b_x - a_x b_z \\ a_x b_y - a_y b_x \end{pmatrix}$$
- Genera el vector perpendicular al plano de visión, indispensable para calcular el eje de rotación de la cabeza hacia el cursor.

### 2.3. Base Ortonormal Robusta (Gram-Schmidt)
Para orientar una extremidad o cámara hacia un vector $\vec{f}$ (*Forward*) con un vector de referencia vertical $\vec{u}_{\text{ref}}$ (*Up*):
```typescript
export function buildOrthonormalBasis(
  forward: [number, number, number],
  upRef: [number, number, number] = [0, 1, 0]
): { forward: [number, number, number]; right: [number, number, number]; up: [number, number, number] } {
  // 1. Normalizar Forward
  const fLen = Math.hypot(forward[0], forward[1], forward[2]);
  const f: [number, number, number] = [forward[0] / fLen, forward[1] / fLen, forward[2] / fLen];

  // 2. Right = Forward x UpRef
  let rx = f[1] * upRef[2] - f[2] * upRef[1];
  let ry = f[2] * upRef[0] - f[0] * upRef[2];
  let rz = f[0] * upRef[1] - f[1] * upRef[0];
  let rLen = Math.hypot(rx, ry, rz);

  // Manejo de singularidad si Forward es colineal con UpRef
  if (rLen < 0.0001) {
    rx = 1; ry = 0; rz = 0; rLen = 1;
  }
  const r: [number, number, number] = [rx / rLen, ry / rLen, rz / rLen];

  // 3. Up real = Right x Forward
  const ux = r[1] * f[2] - r[2] * f[1];
  const uy = r[2] * f[0] - r[0] * f[2];
  const uz = r[0] * f[1] - r[1] * f[0];

  return { forward: f, right: r, up: [ux, uy, uz] };
}
```

---

## 3. Cuaterniones y Slerp Estable

Un cuaternión unitario $q = (w, x, y, z)$ donde $w = \cos(\theta/2)$ y $(x, y, z) = \vec{u} \sin(\theta/2)$ codifica una rotación de $\theta$ radianes sobre el eje unitario $\vec{u}$ sin sufrir *Gimbal Lock*.

### 3.1. Slerp Numéricamente Estable (Evitando Indeterminaciones)
Cuando dos cuaterniones están muy próximos ($\cos\Omega \approx 1$), $\sin\Omega \to 0$ produce división por cero. Se debe conmutar a interpolación lineal normalizada (*NLerp*):

```typescript
export function stableSlerp(
  q1: [number, number, number, number], // [w, x, y, z]
  q2: [number, number, number, number],
  t: number
): [number, number, number, number] {
  let [w1, x1, y1, z1] = q1;
  let [w2, x2, y2, z2] = q2;

  let cosOmega = w1 * w2 + x1 * x2 + y1 * y2 + z1 * z2;

  // Si el ángulo es obtuso, invertir q2 para recorrer el camino más corto en S^3
  if (cosOmega < 0) {
    w2 = -w2; x2 = -x2; y2 = -y2; z2 = -z2;
    cosOmega = -cosOmega;
  }

  let scale1: number;
  let scale2: number;

  if (cosOmega > 0.9995) {
    // Muy cercanos: fallback a NLerp para evitar inestabilidad flotante
    scale1 = 1 - t;
    scale2 = t;
  } else {
    const sinOmega = Math.sqrt(1 - cosOmega * cosOmega);
    const omega = Math.atan2(sinOmega, cosOmega);
    scale1 = Math.sin((1 - t) * omega) / sinOmega;
    scale2 = Math.sin(t * omega) / sinOmega;
  }

  const rw = scale1 * w1 + scale2 * w2;
  const rx = scale1 * x1 + scale2 * x2;
  const ry = scale1 * y1 + scale2 * y2;
  const rz = scale1 * z1 + scale2 * z2;

  // Normalizar resultado
  const len = Math.hypot(rw, rx, ry, rz);
  return [rw / len, rx / len, ry / len, rz / len];
}
```

---

## 4. Cálculo Cinemático: Velocidad, Aceleración, Jerk y Curvatura

En animación avanzada por código, discontinuidades en derivadas superiores producen movimientos percibidos como robóticos o espasmódicos:

| Magnitud Cinemática | Fórmula Matemática | Impacto en la Percepción Visual |
|---|---|---|
| **Posición $\vec{r}(t)$** | Trayectoria base | Si es discontinua ($C^0$), hay teletransporte instantáneo. |
| **Velocidad $\vec{v}(t) = \dot{\vec{r}}$** | $\frac{d\vec{r}}{dt}$ | Si es discontinua ($C^1$), hay cambios bruscos de velocidad (esquinas duras). |
| **Aceleración $\vec{a}(t) = \ddot{\vec{r}}$** | $\frac{d^2\vec{r}}{dt^2}$ | Fuerza aplicada. Si es discontinua, hay impactos mecánicos secos. |
| **Jerk $\vec{j}(t) = \dddot{\vec{r}}$** | $\frac{d^3\vec{r}}{dt^3}$ | Tasa de cambio de la fuerza. Minimizar el jerk produce **movimiento orgánico premium**. |

### 4.1. Curvatura Geométrica de una Trayectoria
La curvatura $\kappa(t)$ mide el cambio de dirección por unidad de longitud:

$$\kappa(t) = \frac{\|\dot{\vec{r}}(t) \times \ddot{\vec{r}}(t)\|}{\|\dot{\vec{r}}(t)\|^3}$$

Si $\kappa(t)$ es elevada en un vértice, la velocidad debe reducirse automáticamente proporcionalmente al radio de curvatura $R = 1/\kappa$ para simular inercia física creíble.

---

## 5. Generadores Pseudoaleatorios Deterministas (PRNG)

Para generar variaciones orgánicas reproducibles (parpadeo, inclinaciones asimétricas de orejas, semillas de texturas) **sin depender de `Math.random()`**:

```typescript
export class Mulberry32PRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  public next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}
```
Esto permite renderizar el mismo personaje con los mismos atributos paramétricos en cualquier cliente web.
