# Physics, Simulation & Numerical Integration for Interactive Characters

Este documento formaliza la simulación física en tiempo real para personajes de marca, cubriendo integradores numéricos estables, osciladores elásticos y el desacoplamiento entre renderizado y física.

---

## 1. El Oscilador Armónico Amortiguado (Damped Spring-Mass System)

El comportamiento de antenas, ojos flotantes, colas y seguimiento elástico se rige por la ecuación diferencial de segundo orden:

$$m \ddot{x} + c \dot{x} + k (x - x_{\text{target}}) = 0$$

Dividiendo entre la masa $m$, introducimos la frecuencia natural $\omega_0 = \sqrt{k/m}$ y el ratio de amortiguamiento $\zeta = \frac{c}{2\sqrt{km}}$:

$$\ddot{x} + 2\zeta\omega_0 \dot{x} + \omega_0^2 (x - x_{\text{target}}) = 0$$

```
    Ratio de Amortiguamiento (ζ)                Comportamiento Visual
    ───────────────────────────────────────────────────────────────────────────
    ζ < 1.0  (Subamortiguado / Underdamped)    Oscilación con rebote elástico agradable
    ζ = 1.0  (Críticamente amortiguado)        Retorno más rápido posible sin ningún rebote
    ζ > 1.0  (Sobreamortiguado / Overdamped)   Retorno lento y viscoso (tipo miel)
```

---

## 2. Comparación de Integradores Numéricos

En interactividad web a 60-120 FPS, el integrador elegido define la estabilidad del personaje ante tirones de framerate (*frame spikes*):

| Integrador | Algoritmo | Estabilidad en Resortes | Conservación de Energía |
|---|---|---|---|
| **Euler Explícito** | $x_{t+1} = x_t + v_t \Delta t$<br>$v_{t+1} = v_t + a_t \Delta t$ | **Pésima**. La energía crece exponencialmente y el sistema explota. | No |
| **Euler Semi-Implícito (Simpléctico)** | $v_{t+1} = v_t + a_t \Delta t$<br>$x_{t+1} = x_t + v_{t+1} \Delta t$ | **Excelente**. Incondicionalmente estable para pasos de tiempo razonables. | Sí (Simpléctico) |
| **Integración Verlet** | $x_{t+1} = 2x_t - x_{t-1} + a_t \Delta t^2$ | **Sobresaliente** para cadenas de partículas, cuerdas y telas con restricciones de distancia. | Sí |

### 2.1. Implementación del Oscilador Simpléctico en TypeScript:
```typescript
export class SymplecticSpring {
  public position: number;
  public velocity: number = 0;
  public target: number;
  public stiffness: number; // k
  public damping: number;   // c
  public mass: number;      // m

  constructor(initial: number = 0, stiffness: number = 180, damping: number = 12, mass: number = 1) {
    this.position = initial;
    this.target = initial;
    this.stiffness = stiffness;
    this.damping = damping;
    this.mass = mass;
  }

  public step(dt: number): void {
    const displacement = this.position - this.target;
    const springForce = -this.stiffness * displacement;
    const dampingForce = -this.damping * this.velocity;
    const acceleration = (springForce + dampingForce) / this.mass;

    // Actualizar velocidad primero (Euler semi-implícito)
    this.velocity += acceleration * dt;

    // Clamping de velocidad para prevenir divergencia ante picos de delta
    if (Math.abs(this.velocity) > 250) {
      this.velocity = Math.sign(this.velocity) * 250;
    }

    // Actualizar posición con la nueva velocidad
    this.position += this.velocity * dt;
  }
}
```

---

## 3. Desacoplamiento de Render y Física (Fix Your Timestep)

**Regla de Oro**: Jamás pasar el `deltaTime` variable del monitor directamente a la ecuación física. Si el monitor cae a 15 FPS, $\Delta t$ sube a $0.066\text{ s}$ y los resortes pueden estallar numéricamente.

Se aplica un **bucle con acumulador de tiempo constante e interpolación visual ($\alpha$)**:

```
Frame variable (rAF) ──> [ Acumulador += delta ]
                             │
                             ├──── mientras (Acumulador >= dtFijo) ──> stepFisica(dtFijo)
                             │
                             └──── alpha = Acumulador / dtFijo
                                   render(lerp(estadoAnterior, estadoActual, alpha))
```

```typescript
export class FixedPhysicsRunner {
  private accumulator: number = 0;
  private readonly fixedDt: number = 1 / 60; // 16.66 ms fijos
  private readonly maxFrameTime: number = 0.25; // Previene "spiral of death"

  public update(variableDeltaTime: number, stepPhysics: (dt: number) => void): number {
    // Acotar el tiempo del frame por si la pestaña estuvo en segundo plano
    const frameTime = Math.min(variableDeltaTime, this.maxFrameTime);
    this.accumulator += frameTime;

    while (this.accumulator >= this.fixedDt) {
      stepPhysics(this.fixedDt);
      this.accumulator -= this.fixedDt;
    }

    // Retorna factor alpha [0, 1] para interpolar suavemente el render
    return this.accumulator / this.fixedDt;
  }
}
```

---

## 4. Verlet Integration para Cadenas Elásticas (Antenas y Colas)

Para modelar una antena o cola compuesta por múltiples segmentos conectados por restricciones de distancia fija ($L_0$):

```typescript
export interface Particle {
  curr: [number, number];
  prev: [number, number];
}

export function stepVerletChain(
  particles: Particle[],
  segmentLength: number,
  dt: number,
  gravity: [number, number] = [0, -9.8]
): void {
  // 1. Integración de posición libre
  for (let i = 1; i < particles.length; i++) {
    const p = particles[i];
    const vx = p.curr[0] - p.prev[0];
    const vy = p.curr[1] - p.prev[1];

    p.prev[0] = p.curr[0];
    p.prev[1] = p.curr[1];

    // Factor 0.98 representa amortiguamiento del aire
    p.curr[0] += vx * 0.98 + gravity[0] * dt * dt;
    p.curr[1] += vy * 0.98 + gravity[1] * dt * dt;
  }

  // 2. Relajación de restricciones de distancia (Position Based Dynamics)
  const iterations = 4;
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < particles.length - 1; i++) {
      const p1 = particles[i];
      const p2 = particles[i + 1];

      const dx = p2.curr[0] - p1.curr[0];
      const dy = p2.curr[1] - p1.curr[1];
      const dist = Math.hypot(dx, dy) || 0.0001;
      const diff = (dist - segmentLength) / dist;

      if (i === 0) {
        // La partícula 0 es la base anclada a la cabeza del personaje
        p2.curr[0] -= dx * diff;
        p2.curr[1] -= dy * diff;
      } else {
        // Ambas partículas se desplazan la mitad
        p1.curr[0] += dx * 0.5 * diff;
        p1.curr[1] += dy * 0.5 * diff;
        p2.curr[0] -= dx * 0.5 * diff;
        p2.curr[1] -= dy * 0.5 * diff;
      }
    }
  }
}
```
Con este algoritmo, la antena reacciona con física fluida de cuerda flexible ante cualquier giro brusco del personaje.
