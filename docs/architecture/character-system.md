# Arquitectura Canónica: Sistema de Personajes Procedural (`CharacterSystem`)
### Renderizado en Canvas 2D, Proyección 3D Simulada, Física de Accesorios y Enlace con `CharacterDNA`

| Campo | Valor |
| --- | --- |
| Estado | Canónico — Decisión de Arquitectura |
| Nivel Jerárquico | Nivel 4 (System Architecture) / Nivel 5 (Experience Design) |
| Owner | ness-e / Principal Systems Engineer |
| Fecha | 2026-10-07 |
| Referencia Fuente | Procedural Engine de Coucou (`BotEngine.swift`, `MochiOutfitDrawing.swift`, `MochiWardrobe.swift`, `windows/src/mochi/`) |
| Implementación | TypeScript estricto + Canvas 2D / Path2D en React 19 (`apps/desktop/renderer/`) |

---

## 1. Visión y Desacoplamiento del Sistema

El `CharacterSystem` de Ego es un motor gráfico procedural, ligero y determinista que reside en la capa de presentación (Renderer) y traduce eventos cognitivos en estados visuales animados.

```text
                               EGO
                                │
                    ┌───────────┴───────────┐
                    │  Cognitive OS (Main)  │
                    └───────────┬───────────┘
                                │ Emite EgoEvent (thinking, working, approval...)
                       Typed IPC Bridge
                                │
                    ┌───────────┴───────────┐
                    │ CharacterRuntime (UI) │
                    └───────────┬───────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ↓                       ↓                       ↓
CharacterDNA            CharacterStateMap       AnimationEngine
(Configuración de       (Mapeo de eventos       (Física de resortes,
 Forma, Paleta y Ojos)   a expresiones)          proyección 3D y tweens)
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                ↓
                      Render Pipeline (60 fps)
                                ↓
                    HTML5 Canvas 2D / Path2D
```

> **Aislamiento Innegociable:** El Character System **no tiene dependencias de Node.js, VantaDB ni de la lógica interna de los Sub-Egos**. Opera exclusivamente con `CharacterDNA` inyectado y eventos normalizados.

---

## 2. Anatomía y Geometría Procedural del Cuerpo

A diferencia de modelos estáticos o sprites, el cuerpo se dibuja matemáticamente mediante una **superelipse paramétrica (squircle deformable)**:

### Ecuación de la Superelipse Deformable
$$| \frac{x}{a} |^n + | \frac{y}{b} |^n = 1$$

El generador procedural modula los parámetros en cada fotograma:
* $a, b$: Semiejes escalados por `width` y `height`.
* $n$: Grado de redondez (típicamente $n \approx 3.5$ a $4.2$).
* `morph`: Factor que transforma el squircle hacia un prisma rectangular para animaciones mecánicas.
* `tilt`, `roll`: Inclinación angular basada en el movimiento y aceleración.
* `squish`, `stretch`: Factor de volumen constante ($sx \times sy = 1$) que produce rebotes con sensación de masa y peso orgánico.

```ts
export interface BodyGeometry {
  width: number;
  height: number;
  curvature: number;      // Exponente n de la superelipse
  morph: number;          // Interpolación hacia caja (0 = squircle, 1 = prisma)
  scaleX: number;
  scaleY: number;
  tilt: number;           // Inclinación lateral
  verticalOffset: number; // Rebote y respiración
}
```

---

## 3. Proyección 3D Simulada de Rostro y Ojos

Una de las innovaciones más destacadas extraídas de Coucou es el cálculo de la mirada: **los ojos no se dibujan en coordenadas fijas del lienzo 2D**, sino que se proyectan sobre una **esfera virtual tridimensional**:

```text
                Simulated 3D Sphere
                     ╭───────╮
                    │   ▲     │
      yaw (← →) ───►│ (o) (o) │◄─── pitch (↑ ↓)
                    │   ▼     │
                     ╰───────╯
                         │
                 Proyección Ortográfica
                         ↓
               Canvas 2D Coordinates
```

### Cálculo de Posición y Perspectiva
1. **Entrada de Foco:** Se calcula el ángulo entre el centro del personaje y el cursor del ratón o el punto focal de atención:
   $$\text{targetYaw} = \arctan2(\Delta x, \text{depth}), \quad \text{targetPitch} = \arctan2(\Delta y, \text{depth})$$
2. **Inercia y Suavizado:** `yaw` y `pitch` se interpolan con un resorte amortiguado (damping ratio $\zeta \approx 0.75$).
3. **Deformación por Perspectiva:** Cuando la cabeza gira hacia la derecha (`yaw > 0`), el ojo izquierdo se comprime horizontalmente y se acerca al borde, mientras el ojo derecho se desplaza hacia el centro, simulando volumen esférico real.

---

## 4. Pipeline de Renderizado Multi-Capa

Cada fotograma se compone en el orden estricto de capas para evitar colisiones visuales:

```text
┌─────────────────────────────────────────────────────────────┐
│                 RENDER PIPELINE POR CAPAS                   │
├─────────────────────────────────────────────────────────────┤
│  1. Capa Trasera (Back Accessories)                         │
│     Sombreros por detrás, mochilas, capas, halos.           │
├─────────────────────────────────────────────────────────────┤
│  2. Sombra Dinámica (Drop Shadow)                           │
│     Elipse difusa proyectada en la base del personaje.      │
├─────────────────────────────────────────────────────────────┤
│  3. Cuerpo (Body Squircle)                                  │
│     Path2D con superelipse, gradiente de volumen y brillo.   │
├─────────────────────────────────────────────────────────────┤
│  4. Vestimenta Base (Torso / Outfit)                        │
│     Prendas (hoodie, corbata, traje) recortadas por el body.│
├─────────────────────────────────────────────────────────────┤
│  5. Rostro (Eyes, Pupils, Mouth)                            │
│     Ojos proyectados en 3D, parpadeos, rubor y gestos.      │
├─────────────────────────────────────────────────────────────┤
│  6. Capa Frontal (Front Accessories)                        │
│     Gafas, visores, auriculares, insignias flotantes.       │
├─────────────────────────────────────────────────────────────┤
│  7. Partículas & Efectos Reactivos (Overlays)               │
│     Glow de pensamiento, chispas de éxito, gotas de sudor.  │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Máquina de Comportamiento y Expresiones (`CharacterStateMap`)

El runtime cognitivo mapea estados de ejecución hacia configuraciones reactivas de comportamiento (`CharacterStateCfg`):

```ts
export type CharacterState =
  | "idle"        // En espera tranquila
  | "thinking"    // Modelo razonando (pensamiento activo)
  | "working"     // Ejecutando herramientas locales o workers
  | "approval"    // Requiere intervención humana HITL
  | "success"     // Tarea completada con éxito
  | "error"       // Fallo o excepción en el proceso
  | "sleeping"    // Modo ahorro de recursos / fuera de foco
  | "attention";  // Solicitud de atención activa

export interface CharacterStateCfg {
  eyeStyle: "open" | "squint" | "focused" | "glow" | "closed" | "dizzy";
  breathingSpeed: number;    // Frecuencia sinusoidal (Hz)
  bounceAmplitude: number;   // Amplitud de oscilación vertical
  glowIntensity: number;     // Resplandor de acento perimetral
  lookBehavior: "follow-mouse" | "scan-horizontal" | "fixed-center" | "wander";
  particleEffect?: "sparks" | "sweat" | "question-mark" | "orbit-rings";
}
```

---

## 6. Motor de Animación y Física de Accesorios

Para evitar que los accesorios (gafas, gorros, lazos) se vean como estampas rígidas, el sistema incorpora **física de arrastre e inercia**:

```ts
export class AccessoryPhysics {
  x = 0; y = 0;
  vx = 0; vy = 0;
  private readonly stiffness = 120; // Rigidez del resorte
  private readonly damping = 14;    // Amortiguación

  update(targetX: number, targetY: number, dt: number) {
    const ax = (targetX - this.x) * this.stiffness - this.vx * this.damping;
    const ay = (targetY - this.y) * this.stiffness - this.vy * this.damping;
    this.vx += ax * dt;
    this.vy += ay * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
}
```

Cuando el personaje gira la cabeza bruscamente hacia la izquierda, un gorro o unas gafas se desplazan con un retraso físico natural, amortiguando la parada con un rebote elástico.

---

## 7. Enlace Orgánico entre `SubEgoSoul` y `CharacterDNA`

El alma del especialista ([`SubEgoSoul`](subego-soul.md)) gobierna directamente los parámetros de personalidad del `CharacterDNA`:

```text
SubEgoSoul (Arquitectura Cognitiva)
  ├── tone: "analytical-critical" ────► CharacterDNA.personality.seriousness = 0.9
  ├── temperament.skepticism = "high" ─► CharacterDNA.face.eyeStyle = "focused"
  ├── temperament.proactivity = "high" ─► CharacterDNA.personality.energy = 0.8
  └── identityName: "Architect-Prime" ──► CharacterPreset: "Preset-Technical"
```

El especialista mantiene coherencia total: su postura visual refleja su rigor conceptual.

---

## 8. Presupuesto de Rendimiento y Garantías Técnicas

* **Consumo de CPU:** $\le 1.5\%$ en reposo (idle); $\le 3\%$ en animación activa a 60 fps.
* **Frecuencia Adaptativa:** Si la ventana de Ego pierde el foco del sistema operativo o el usuario no interactúa en 60 segundos, la tasa de refresco conmuta automáticamente a **15 fps** o se congela en modo estático determinista (`MochiStill`).
* **Cero Dependencias Externas:** 100% Canvas 2D nativo sin WebGL innecesario ni librerías de 500 KB (sin Rive, sin Lottie, sin three.js en P0).
* **Tolerancia a Fallos:** Si el renderizador de Canvas produce una excepción no controlada, un `ErrorBoundary` aísla el lienzo sin alterar el hilo de mensajes ni la ejecución de tareas.
