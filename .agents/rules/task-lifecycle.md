# Task Lifecycle & State Machine Rule (C0)

Toda tarea técnica que involucre más de un archivo o cambio estructural debe transicionar obligatoriamente por los 4 estados de la máquina C0:

```
[TODO] ──► [PLAN] ──► [ACT] ──► [REVIEW] ──► [DONE]
              │          ▲          │
              └──────────┴──────────┘ (Revisión adversarial)
```

## 1. Estados y Obligaciones

### 1. PLAN
- **Objetivo:** Definir con precisión el alcance, los archivos a modificar (blast radius) y los criterios de aceptación.
- **Restricción:** Estado de solo lectura. Prohibido editar o crear código en este estado.

### 2. ACT
- **Objetivo:** Ejecutar la implementación del código.
- **Restricción:** Solo se pueden modificar los archivos declarados dentro del alcance (`task_validate_scope`). Cambios no declarados deben ser justificados o revertidos.

### 3. REVIEW
- **Objetivo:** Certificar la calidad técnica con un revisor adversarial o contexto fresco.
- **Restricción:** El desarrollador que implementó el cambio no puede aprobar su propio código sin verificación de tests y linters.

### 4. DONE
- **Objetivo:** Tarea completada y lista para commit.
- **Requisito:** Cumplir 100% el Definition of Done del proyecto.
