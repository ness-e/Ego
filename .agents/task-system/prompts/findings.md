> **CANONICAL SPEC — Routing de Hallazgos (fuente única)**
> Referenciado por: pipeline-full.md (Gate C + regla rápido/lento) · question-gates.md
> (Gate C). Los prompts REFERENCIAN este archivo; nunca lo redefinen.

# Hallazgos — bugs/errores/fallas descubiertos durante ejecución

Un **hallazgo** es cualquier bug, error o falla descubierto mientras se ejecuta
una tarea/plan que NO es el objetivo de esa tarea (el bug de la propia tarea se
arregla vía `bug-workflow.md` + `systematic-debugging`, no es un hallazgo).

## Regla única

**Todo hallazgo que no se arregle inline nace como fila en `docs/roadmap/Backlog.md`
EN EL MOMENTO del discovery — no al cierre.** El plan/task file solo lo
referencia. Prohibido dejar hallazgos anotados solo en notas de plan,
recitations o commits (hoy se pierden cuando el plan se archiva).

### Inline vs ticket — criterio libre del agente

El agente decide caso por caso si arregla ya o genera ticket. Única restricción:
si arregla inline, aplica `bug-workflow.md` completo (root cause obligatorio,
sin refactor "while I'm here") y queda en el commit `fix:`. Si duda → ticket
(el ticket es barato; el hallazgo perdido no).

### Formato de ticket derivado

> **Esquema canónico (fuente única): `.agents/references/backlog-format.md`** — 10 columnas:
> `| ID | Severidad | Hallazgo | Archivo:línea | Esfuerzo | Prioridad | Estado | Descripción | Relaciones | Dependencias |`

```
| `FIND-<n>` | 🟡 Media | **<título corto>** | `ruta:línea` | 🟡 1d | 🟢 Nice-to-have | 🆕 Pendiente | <descripción: qué se encontró + acción propuesta> | Origen: <plan-id>#<task-id> · commit <hash> | — |
```

- **ID:** prefijo `FIND-` con numerador incremental (continuar del mayor
  existente en Backlog: `rg -o "FIND-\d+" docs/roadmap/Backlog.md | sort -V | tail -1`)
  — **ESQUEMA ÚNICO (consolidación 2026-08-25):** los hallazgos derivados de
  CUALQUIER auditoría/review (`/audit`, unified-review, investigaciones) también
  nacen como `FIND-*`. Prohibido crear prefijos nuevos por campaña o herramienta
  (AUD-/REVIEW-/ERR-/DAUD-/AGT- se cierran a nuevos ingresos; las filas históricas
  no se renombran). Trazabilidad = `Origen:` en la columna **Relaciones**, no el prefijo.
- **Origen obligatorio:** `Origen:` (columna Relaciones) apuntando al plan/tarea/commit donde se descubrió
- **Contrato:** igual que toda fila del backlog (condición verificable)
- Prioridad 🟢 Nice-to-have por default; el triage del próximo `/pipeline plan` la ajusta
