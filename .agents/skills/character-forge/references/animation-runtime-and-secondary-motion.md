# Runtime de Animación, Reloj Desacoplado y Movimiento Secundario

Este módulo define la arquitectura de tiempo, integración física y composición de capas de animación para garantizar que las mascotas y personajes mantengan cadencias consistentes independientemente de la tasa de refresco del monitor (60 Hz, 120 Hz, 144 Hz).

---

## 1. El Reloj de Animación Desacoplado (Animation Clock)

### 1.1. Prohibición de Asunción de 60 FPS
Queda estrictamente prohibido codificar incrementos por fotograma fijo (ej. `x += 0.05`). Toda actualización cinemática debe calcularse respecto al tiempo delta real transcurrido medido en segundos:

$$\Delta t = \min\left(\frac{t_{\text{actual}} - t_{\text{previo}}}{1000}, \Delta t_{\text{max}}\right)$$

Donde $\Delta t_{\text{max}} = 0.1\text{ s}$ actúa como límite de seguridad (*clamp*) para evitar saltos numéricos tras suspensiones de ventana, cambios de pestaña o caídas de rendimiento.

---

## 2. Sistema de Resortes Amortiguados Reutilizables (Spring Engine)

El resorte de masa blanda se modela mediante el oscilador armónico amortiguado estándar:

$$\ddot{x} + 2\zeta\omega_0 \dot{x} + \omega_0^2 (x - x_{\text{target}}) = 0$$

```typescript
export class DampedSpring {
  public value: number;
  public velocity: number = 0;
  public target: number;

  constructor(
    public omega: number = 14.0, // Frecuencia angular natural (rad/s)
    public zeta: number = 0.70,  // Coeficiente de amortiguamiento crítico
    initial: number = 0
  ) {
    this.value = initial;
    this.target = initial;
  }

  public update(dt: number): number {
    const displacement = this.value - this.target;
    const accel = -this.omega * this.omega * displacement - 2 * this.zeta * this.omega * this.velocity;
    this.velocity += accel * dt;
    this.value += this.velocity * dt;
    return this.value;
  }
}
```

---

## 3. Composición de Animaciones en 5 Capas Concurrentes

Para evitar que diferentes subsistemas compitan sobreescribiendo las mismas transformaciones sin control, el motor aplica una composición por capas con pesos y prioridades:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5 CAPAS DE ANIMACIÓN CONCURRENTES                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ Capa 1: Pose Base e Idle (Respiración asimétrica en Y, balanceo sutil)      │
│ Capa 2: Mirada y Seguimiento (Look-At angular en Yaw/Pitch con Clamps)      │
│ Capa 3: Expresión Facial (Deformación de ojos, cejas y rubor)               │
│ Capa 4: Acción Dramática Principal (Salto, saludo, anticipación, absorción) │
│ Capa 5: Física Secundaria e Inercia (Resortes en pompones, orejas y lazos)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Protocolo de Interrupción Limpia

Cuando ocurre un evento crítico (ej. solicitud de aprobación HITL o error fatal del sistema):
1. La acción secundaria en curso (ej. estiramiento cosmético) se aborta de inmediato.
2. Los valores actuales de posición y velocidad se transfieren intactos al resorte de la nueva pose para evitar cortes o saltos visuales (*snapping*).
3. La nueva pose asume el control sin discontinuidades de primer orden en la velocidad.
