# Soft Character Animation Runtime & Layered Blending

Este módulo define el motor de ejecución temporal que mezcla animaciones por capas, gestiona prioridades y resuelve interrupciones sin saltos visuales (*teleporting*).

---

## 1. Arquitectura de Capas de Animación (Layer Stack)

El runtime procesa las animaciones en tres capas aditivas independientes:

```
┌─────────────────────────────────────────────────────────────────┐
│ Capa 3: Microgestos y Expresión (Párpados, Pupil Tracking)      │ -> Peso 1.0 (Overrides)
├─────────────────────────────────────────────────────────────────┤
│ Capa 2: Acciones e Interacciones (Saltos, Reacciones, Sacudidas)│ -> Peso variable (Cross-fade)
├─────────────────────────────────────────────────────────────────┤
│ Capa 1: Base / Locomoción / Reposo (Respiración, Balanceo)       │ -> Peso residual (1.0 - Capa 2)
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Reglas de Interrupción y Mezcla (Cross-fading)

* **Transición Suave (Cross-fade):**
  - Dos animaciones incompatibles jamás se alternan instantáneamente; se aplica una interpolación esférica (Slerp) en rotaciones y LERP en deformaciones con ventana de mezcla de $120\text{ a }180\text{ ms}$:
    $$Q(t) = \text{Slerp}\left(Q_A, Q_B, \text{smoothstep}(0, 1, \tau)\right)$$
* **Prioridades de Interrupción:**
  1. **Nivel 100 (HITL / Alerta de Sistema):** Interrumpe de inmediato cualquier animación de reposo o celebración, forzando congelación y transición rápida a alerta.
  2. **Nivel 50 (Interacción de Usuario / Clic / Drag):** Interrumpe animaciones de reposo.
  3. **Nivel 10 (Animaciones de Reposo / Idle):** Se ejecutan solo si no hay una acción prioritaria encolada.
