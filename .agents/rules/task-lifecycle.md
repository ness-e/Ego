# Task Lifecycle & State Machine Rule (C0)

Toda tarea técnica que involucre más de un archivo o cambio estructural debe transicionar obligatoriamente por los estados de la máquina C0:

```
[TODO] ──► [PLAN] ──► [ACT] ──► [REVIEW] ──► [DONE]
  │           │          ▲          │
  │           └──────────┴──────────┘ (Revisión adversarial)
  │
  └────────────────────────────────────────► [DISCARDED] (Descarte Justificado)
```

## 1. Estados y Obligaciones

### 1. PLAN (`⏳ EN PROGRESO` / `PLAN`)
- **Objetivo:** Definir con precisión el alcance, los archivos a modificar (blast radius) y los criterios de aceptación.
- **Restricción:** Estado de solo lectura. Prohibido editar o crear código en este estado.

### 2. ACT (`⏳ EN PROGRESO` / `ACT`)
- **Objetivo:** Ejecutar la implementación del código.
- **Restricción:** Solo se pueden modificar los archivos declarados dentro del alcance (`task_validate_scope`). Cambios no declarados deben ser justificados o revertidos.

### 3. REVIEW (`REVIEW`)
- **Objetivo:** Certificar la calidad técnica con un revisor adversarial o contexto fresco.
- **Restricción:** El desarrollador que implementó el cambio no puede aprobar su propio código sin verificación de tests y linters.

### 4. DONE (`✅ COMPLETADA` / `COMPLETED`)
- **Objetivo:** Tarea completada y lista para commit.
- **Requisito:** Cumplir 100% el Definition of Done del proyecto (`definition-of-done.md`). Sincronización automática de Backlog, Task File, Plan y Roadmap.

### 5. DISCARDED (`🚫 Descartada (con justificación)`)
- **Objetivo:** Cierre terminal formal para patrones, compuertas o tareas que no aplican a Ego tras inspección o evaluación técnica.
- **Requisito:** Debe incluir obligatoriamente el fundamento técnico explícito (ej. `🚫 Descartada: Requiere runtime Python local prohibido en P0 según AGENTS.md §4`, `🚫 Descartada: Introduce sobreingeniería frente al estándar nativo`).
- **Restricción:** Prohibido dejar tareas permanentemente en estado pendiente o marcarlas falsamente como completadas si no se programó nada.
