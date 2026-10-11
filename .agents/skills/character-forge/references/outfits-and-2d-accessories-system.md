# Sistema de Accesorios y Vestuario 2.5D: Anclajes Semánticos, Anillos de Corte y Oclusión

Este módulo formaliza la ingeniería de prendas, accesorios y objetos equipables en Canvas 2D adaptados a la geometría del personaje, resolviendo la oclusión por profundidad y la física secundaria de balanceo (*jiggle physics*).

---

## 1. Sistema de Anclajes Semánticos (Attachment Sockets)

Para evitar posiciones estáticas codificadas en píxeles absolutos, cada personaje declara un mapa de anclajes relativos expresados en coordenadas normalizadas de superficie $(y, \lambda)$ o en espacio local normalizado:

| Socket ID | Coordenadas Nominales $(y, \lambda)$ | Uso Funcional |
|---|---|---|
| `head_crown` | $y = 0.85, \lambda = 0$ | Gorros, sombreros, coronas, halos |
| `head_forehead` | $y = 0.35, \lambda = 0$ | Cintas, vinchas, sensores frontales |
| `eyes_bridge` | $y = -0.05, \lambda = 0$ | Gafas, visores, antifaces |
| `cheeks_left` / `_right` | $y = -0.15, \lambda = \mp 0.52$ | Parches, rubor, bigotes |
| `neck_collar` | $y = -0.65, \lambda \in [0, 2\pi)$ | Bufandas, collares, pajaritas |
| `ears_left` / `_right` | $y = 0.20, \lambda = \mp \pi/2$ | Auriculares, orejeras, pendientes |
| `back_spine` | $y = 0.0, \lambda = \pi$ | Mochilas, alas, capas |

---

## 2. Anillos de Sección Transversal (Cross-Sectional Cutting Rings)

Prendas como el dobladillo de un gorro de lana (*beanie*) o una bufanda se adaptan a la silueta del personaje ciñendo un anillo a una altura relativa de corte $y_{\text{corte}}$.

### 2.1. Ecuación Paramétrica del Anillo
Muestreando la superficie del superelipsoide a una latitud constante $y_{\text{corte}} \in [-1, 1]$ con $N$ muestras discretas ($\lambda_i = \frac{2\pi i}{N}$):

$$C_i = P(y_{\text{corte}}, \lambda_i) = \begin{bmatrix} a \cdot r(y_{\text{corte}}) \cdot \sin(\lambda_i) \\ b \cdot y_{\text{corte}} \\ c \cdot r(y_{\text{corte}}) \cdot \cos(\lambda_i) \end{bmatrix}$$

Aplicando la rotación por `yaw` y `pitch` ($P'_i = R_y(\psi) R_x(\theta) C_i$), obtenemos un anillo tridimensional orientado en el espacio de la cámara.

### 2.2. Proyección y División por Profundidad (Oclusión Z)
Para cada muestra rotada $P'_i$, el signo de $P'_{i, z}$ determina la visibilidad:
* **Segmento Frontal ($Z \ge 0$)**: Puntos orientados hacia el observador. Se dibujan en la **Capa Posterior al Cuerpo**.
* **Segmento Trasero ($Z < 0$)**: Puntos ocluidos por la masa del personaje. Se dibujan en la **Capa Previa al Cuerpo**.

```
          [Cámara] ───────> (Observador en +Z)
                               │
            ┌──────────────────┼──────────────────┐
            │                  ▼                  │
            │           Segmento Frontal          │  (Z >= 0: Capa 6)
            │      ╭───────────────────────╮      │
            │     │    CUERPO CENTRAL      │      │  (Capa 3)
            │      ╰───────────────────────╯      │
            │           Segmento Trasero          │  (Z < 0:  Capa 2)
            └─────────────────────────────────────┘
```

---

## 3. Física Secundaria de Elementos Flexibles (Oscilador Armónico Amortiguado)

Pompones, borlas, colas de lazo y adornos colgantes no giran de forma rígida con el cuerpo; exhiben inercia y amortiguación elástica.

### 3.1. Ecuación Diferencial del Resorte
Modelamos el desplazamiento relativo $(\Delta x, \Delta y)$ respecto al punto de anclaje mediante:

$$m \ddot{x} + c \dot{x} + k (x - x_0) = 0$$

Dividiendo por la masa $m$, definimos la frecuencia angular natural $\omega_0 = \sqrt{k/m}$ y el coeficiente de amortiguamiento $\zeta = \frac{c}{2\sqrt{km}}$:

$$\ddot{x} + 2\zeta\omega_0 \dot{x} + \omega_0^2 (x - x_0) = 0$$

### 3.2. Integración Numérica Estable (Euler Semi-Implícito)
En el bucle de animación con paso de tiempo medido $\Delta t$:

$$\text{aceleración}_x = -\omega_0^2 (x - x_0) - 2\zeta\omega_0 v_x$$
$$v_x(t + \Delta t) = v_x(t) + \text{aceleración}_x \cdot \Delta t$$
$$x(t + \Delta t) = x(t) + v_x(t + \Delta t) \cdot \Delta t$$

### 3.3. Presets Físicos Interpretables
* **Pom-pom de lana (Blando)**: $\omega_0 = 12.0\text{ rad/s}, \zeta = 0.65$ (rebote suave y asentamiento rápido).
* **Cascabel metálico (Rígido)**: $\omega_0 = 28.0\text{ rad/s}, \zeta = 0.40$ (vibración de alta frecuencia).
* **Borla de seda (Pesado)**: $\omega_0 = 8.5\text{ rad/s}, \zeta = 0.85$ (latencia inercial notable).

---

## 4. Recetas de Material y Lentes en Canvas 2D

### 4.1. Lentes Reflectantes con Reflejo Especular Dinámico
Para gafas de sol o cristales reflectantes, el reflejo no es un gradiente diagonal estático; depende del ángulo de la normal respecto al vector de luz incidente:

```typescript
function drawGlassesLens(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, rx: number, ry: number,
  lightAngle: number, opacity: number
) {
  ctx.save();
  // Base tintada oscura
  ctx.fillStyle = "rgba(18, 22, 30, 0.88)";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Franja especular orientada según la luz incidente
  const grad = ctx.createLinearGradient(
    cx + Math.cos(lightAngle) * rx, cy + Math.sin(lightAngle) * ry,
    cx - Math.cos(lightAngle) * rx, cy - Math.sin(lightAngle) * ry
  );
  grad.addColorStop(0, "rgba(255, 255, 255, 0.55)");
  grad.addColorStop(0.25, "rgba(255, 255, 255, 0.15)");
  grad.addColorStop(0.5, "rgba(255, 255, 255, 0.0)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0.0)");

  ctx.clip();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
}
```

---

## 5. Catálogo Canónico de Accesorios 2.5D

```typescript
export interface AccessoryDefinition {
  id: string;
  name: string;
  socket: string;
  renderBack?(ctx: CanvasRenderingContext2D, anchor: { x: number; y: number; z: number }): void;
  renderFront(ctx: CanvasRenderingContext2D, anchor: { x: number; y: number; z: number }): void;
  updatePhysics?(dt: number, headTilt: number): void;
}
```

La suite incluye implementaciones de referencia para:
1. `beanie`: Gorro de lana con dobladillo en anillo superelíptico y pompón elástico.
2. `sunglasses`: Gafas oscuras apoyadas en `eyes_bridge` con reflexión dinámica.
3. `scarf`: Bufanda ceñida a `neck_collar` con caída frontal.
4. `crown`: Tiara con puntas y gemas orientadas según la curvatura de la cabeza.
