# Geometría Analítica 2.5D: Superelipsoides de Superficie y Proyección en Canvas 2D

Este módulo define la base matemática para generar mallas analíticas continuas y proyectarlas en un entorno bidimensional (Canvas 2D / SVG) sin requerir el sobrecoste de WebGL, calculando curvatura, normales de superficie e iluminación difusa y especular.

---

## 1. Fundamentación Matemática del Superelipsoide de Revolución

### 1.1. Ecuación de Radio Horizontal
Para modelar cuerpos orgánicos estilizados (arquetipo *Mochi* o gota suave), definimos una superficie de revolución parametrizada en coordenadas locales normalizadas $y \in [-1, 1]$. El radio transversal $r(y)$ a una altura relativa $y$ con exponente superelíptico $p > 0$ se define analíticamente como:

$$r(y) = \left(1 - |y|^p\right)^{1/p}, \quad y \in [-1, 1]$$

* **Preset Clásico Mochi (Coucou / Curva de Lamé)**: $p = 2.7$. Produce la forma superelíptica distintiva con curvatura cúbica suave, ni esferoide perfecto ($p = 2.0$) ni squircle casi cuadrado ($p \ge 4.0$).
* **Distinción Epistémica**: Esta superficie es una **superficie de revolución superelíptica**. Un superelipsoide tridimensional generalizado de Barr (1981) admite dos exponentes independientes ($p_1$ para sección vertical y $p_2$ para la transversal). La superficie de revolución simplifica el cálculo analítico manteniendo simetría radial en el plano horizontal.

### 1.2. Parametrización de Coordenadas de Superficie
Dado un semieje horizontal $a$, un semieje vertical $b$ y un semieje de profundidad $c$, cualquier punto sobre la superficie se calcula en función de la latitud vertical $y \in [-1, 1]$ y la longitud radial $\lambda \in [0, 2\pi)$:

$$P(y, \lambda) = \begin{bmatrix} a \cdot r(y) \cdot \sin(\lambda) \\ b \cdot y \\ c \cdot r(y) \cdot \cos(\lambda) \end{bmatrix}$$

---

## 2. Sistema de Transformación y Rotación 3D

Para orientar la cabeza y el cuerpo en el espacio local antes de la proyección, se aplica una convención de rotación fija.

### 2.1. Convención Angular y Matrices
Adoptamos un sistema cartesiano con mano derecha donde:
* $+X$: Hacia la derecha de la pantalla.
* $+Y$: Hacia arriba.
* $+Z$: Hacia el observador (profundidad frontal).

Rotación de cabeceo (Pitch, ángulo $\theta$ alrededor del eje $X$):
$$R_x(\theta) = \begin{bmatrix} 1 & 0 & 0 \\ 0 & \cos\theta & -\sin\theta \\ 0 & \sin\theta & \cos\theta \end{bmatrix}$$

Rotación de guiñada (Yaw, ángulo $\psi$ alrededor del eje $Y$):
$$R_y(\psi) = \begin{bmatrix} \cos\psi & 0 & \sin\psi \\ 0 & 1 & 0 \\ -\sin\psi & 0 & \cos\psi \end{bmatrix}$$

El punto rotado en el espacio de la cabeza $P'$ se obtiene mediante la composición estricta:
$$P' = R_y(\psi) \cdot R_x(\theta) \cdot P$$

> [!IMPORTANT]
> **Consistencia de Convención**: El orden $R_y(\psi) \cdot R_x(\theta)$ debe respetarse uniformemente en el cálculo de ojos, accesorios y normales. Invertir el orden altera la posición de los puntos para ángulos no nulos.

---

## 3. Proyección a Coordenadas de Pantalla (Canvas 2D)

### 3.1. Proyección Ortográfica Escalada
Dado que los compañeros de escritorio ocupan áreas visuales acotadas (64 px a 256 px), la proyección ortográfica con escala de píxeles $S$ y centro de pantalla $(C_x, C_y)$ ofrece máxima estabilidad numérica:

$$x_{\text{screen}} = C_x + P'_x \cdot S$$
$$y_{\text{screen}} = C_y - P'_y \cdot S \quad (\text{invirtiendo el eje } Y \text{ de Canvas})$$
$$z_{\text{depth}} = P'_z \cdot S$$

### 3.2. Perspectiva Débil Opcional (Weak Perspective)
Para enfatizar la curvatura tridimensional en poses cercanas sin distorsión extrema:
$$x_{\text{screen}} = C_x + \frac{P'_x \cdot S}{1 - \frac{P'_z}{d_c}}, \quad y_{\text{screen}} = C_y - \frac{P'_y \cdot S}{1 - \frac{P'_z}{d_c}}$$
donde $d_c$ es la distancia focal virtual (típicamente $d_c \approx 4.0 \cdot \max(a, b)$).

---

## 4. Normales de Superficie e Iluminación en Canvas 2D

Canvas 2D no dispone de cálculo de normales por fragmento en GPU. Para simular sombreado volumétrico analítico, calculamos la normal $N(y, \lambda)$ mediante las derivadas parciales de la parametrización de superficie.

### 4.1. Derivadas Parciales de la Superficie
Para un punto $P(y, \lambda)$:
$$\frac{\partial P}{\partial \lambda} = \begin{bmatrix} a \cdot r(y) \cdot \cos\lambda \\ 0 \\ -c \cdot r(y) \cdot \sin\lambda \end{bmatrix}$$

Para la derivada respecto a $y$:
$$r'(y) = \frac{d}{dy}\left(1 - |y|^p\right)^{1/p} = -|y|^{p-1} \cdot \operatorname{sgn}(y) \cdot \left(1 - |y|^p\right)^{\frac{1}{p}-1}$$

$$\frac{\partial P}{\partial y} = \begin{bmatrix} a \cdot r'(y) \cdot \sin\lambda \\ b \\ c \cdot r'(y) \cdot \cos\lambda \end{bmatrix}$$

### 4.2. Vector Normal Normalizado
El vector normal local $N$ se obtiene mediante el producto cruzado:
$$N_{\text{local}} = \frac{\partial P}{\partial \lambda} \times \frac{\partial P}{\partial y} = \begin{bmatrix} b \cdot c \cdot r(y) \cdot \sin\lambda \\ -a \cdot c \cdot r(y) \cdot r'(y) \\ a \cdot b \cdot r(y) \cdot \cos\lambda \end{bmatrix}$$

Al cancelar el factor escalar común $r(y)$ (para $y \in (-1, 1)$):
$$N_{\text{simplificado}} = \begin{bmatrix} b \cdot c \cdot \sin\lambda \\ -a \cdot c \cdot r'(y) \\ a \cdot b \cdot \cos\lambda \end{bmatrix}, \quad N = \frac{N_{\text{simplificado}}}{\|N_{\text{simplificado}}\|}$$

> [!NOTE]
> **Gestión de Singularidades en los Polos ($y = \pm 1$)**: En los polos exactos, $r(y) \to 0$ y $r'(y) \to \pm \infty$. Para evitar `NaN`, se evalúa el límite:
> $$N(1, \lambda) = [0, 1, 0]^T, \quad N(-1, \lambda) = [0, -1, 0]^T$$

### 4.3. Normal Rotada en el Espacio de Vista
$$N' = R_y(\psi) \cdot R_x(\theta) \cdot N$$

---

## 5. Implementación de Referencia en TypeScript (Sin Dependencias)

```typescript
export interface SuperellipsoidParams {
  a: number; // Semieje X
  b: number; // Semieje Y
  c: number; // Semieje Z
  p: number; // Exponente (2.7 = Mochi)
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export class AnalyticalSuperellipsoid {
  constructor(public params: SuperellipsoidParams) {}

  /**
   * Calcula el radio horizontal a una altura normalizada y in [-1, 1].
   */
  public radiusAt(y: number): number {
    const absY = Math.min(1.0, Math.abs(y));
    const term = 1.0 - Math.pow(absY, this.params.p);
    return term <= 0 ? 0 : Math.pow(term, 1.0 / this.params.p);
  }

  /**
   * Obtiene la posición local de superficie en coordenadas (y, lambda).
   */
  public surfacePoint(y: number, lambda: number): Vec3 {
    const clampedY = Math.max(-1.0, Math.min(1.0, y));
    const r = this.radiusAt(clampedY);
    return {
      x: this.params.a * r * Math.sin(lambda),
      y: this.params.b * clampedY,
      z: this.params.c * r * Math.cos(lambda),
    };
  }

  /**
   * Calcula la normal de superficie analítica normalizada.
   */
  public surfaceNormal(y: number, lambda: number): Vec3 {
    if (y >= 0.999) return { x: 0, y: 1, z: 0 };
    if (y <= -0.999) return { x: 0, y: -1, z: 0 };

    const { a, b, c, p } = this.params;
    const absY = Math.abs(y);
    const signY = Math.sign(y);
    const rPrime = -Math.pow(absY, p - 1) * signY * Math.pow(1 - Math.pow(absY, p), (1 / p) - 1);

    const nx = b * c * Math.sin(lambda);
    const ny = -a * c * rPrime;
    const nz = a * b * Math.cos(lambda);

    const len = Math.hypot(nx, ny, nz) || 1.0;
    return { x: nx / len, y: ny / len, z: nz / len };
  }

  /**
   * Rota un punto con convención R_y(psi) * R_x(theta).
   */
  public static rotate(p: Vec3, yaw: number, pitch: number): Vec3 {
    // 1. Rotación en X (Pitch)
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const y1 = p.y * cosPitch - p.z * sinPitch;
    const z1 = p.y * sinPitch + p.z * cosPitch;

    // 2. Rotación en Y (Yaw)
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const x2 = p.x * cosYaw + z1 * sinYaw;
    const z2 = -p.x * sinYaw + z1 * cosYaw;

    return { x: x2, y: y1, z: z2 };
  }
}
```

---

## 6. Pruebas Matemáticas y Criterios de Aceptación

1. **Continuidad en Polos**: Para $y \to 1^-$ y $y \to -1^+$, el radio $r(y) \to 0$ sin generar números complejos ni `NaN`.
2. **Invarianza de Norma**: La normal calculada satisface $\|N\| = 1.0 \pm 10^{-6}$ en todo el dominio muestreado.
3. **Consistencia de Giro**: Un giro positivo de `yaw` desplaza los puntos frontales ($Z > 0$) hacia la derecha ($+X$).
