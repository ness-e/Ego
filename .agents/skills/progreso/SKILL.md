---
name: progreso
description: >
  Usa esta skill al completar una tarea o al inicio de sesión en Ego. Registra
  tareas completadas de docs/roadmap/Backlog.md, actualiza el estado de planes y
  tareas en docs/agent-ops/, concilia memoria del agente (lecciones/decisiones)
  y mantiene la consistencia canónica del repositorio Ego.
compatibility: opencode
---

# Progreso Skill — Ego (Sistema Operativo Cognitivo)

Esta skill gestiona la actualización de avance y sincronización del estado de tareas y planes en Ego.

## Roles de Archivos Canónicos

| Archivo / Directorio | Rol en Ego |
|---|---|
| `docs/roadmap/Backlog.md` | **Backlog Maestro de Fases y Tareas.** Formato canónico de 10 columnas (`.agents/references/backlog-format.md`). Al completar una tarea se transiciona su estado a `[COMPLETED]` o `[DISCARDED]`. |
| `docs/roadmap/roadmap.md` | Hoja de ruta estratégica de las 12 fases canónicas (01 Core a 12 Distribution). |
| `docs/agent-ops/plans/*.md` | Planes de trabajo activos y estructurados de agentes. |
| `docs/agent-ops/tasks/*.md` | Tareas atómicas con contratos de verificación (`task_verify_cmd`). |
| `docs/agent-ops/reports/` | Informes de auditoría y reportes de progreso. |
| `docs/architecture/adr/*.md` | Decisiones de arquitectura canónicas (ADRs). |
| `.agents/task-system/memory/` | Memoria persistente del agente (`decisions.md`, `lessons.md`). |

---

## Trigger 1: Completar una tarea

Se activa cuando una tarea alcanza el estado ✅ `[COMPLETED]` o `[DISCARDED]` en la sesión actual.

### A. Análisis de impacto en documentación y contratos

Verificar que la documentación y contratos tipados se hayan actualizado de acuerdo al código modificado:

| Archivo / Módulo modificado | Documentación / Contrato a verificar |
|---|---|
| `packages/memory/` | `docs/architecture/vision-general.md`, contratos de `EgoMemoryAdapter` |
| `packages/models/` | Contratos de `ModelRouter` y adaptadores de inferencia |
| `packages/runtime/` | Contratos de `CognitiveRuntime` y Tool Execution Loop |
| `packages/execution/` | Contratos de `ExecutionManager` y timeouts/abort |
| `packages/tools/` | Contratos de `ToolRegistry` y conectores nativos |
| `packages/events/` | Contratos de `EventBus` y eventos canónicos `EgoEvent` |
| `apps/desktop/src/main/` | Protocolos IPC, preload scripts y seguridad Electron |
| `apps/desktop/src/renderer/` | Componentes UI (`@assistant-ui/react`), UX guidelines |

### B. Extracción de datos de la tarea

Identificador canónico (ej. `CORE-14`, `ACT-12`), nombre, fecha, objetivo, archivos modificados y resultado de verificación.

### C. Actualización de estado en fuentes

1. **Backlog Maestro (`docs/roadmap/Backlog.md`):**
   - Transicionar estado en la tabla canónica: `[PENDING]` / `[IN_PROGRESS]` → `[COMPLETED]` (o `[DISCARDED]` con justificación técnica).
   - Registrar la evidencia de verificación y fecha de cierre.
2. **Planes de agente (`docs/agent-ops/plans/`):**
   - Marcar el checkbox correspondiente en el plan activo.
3. **Task files (`docs/agent-ops/tasks/<ID>.md`):**
   - Actualizar el frontmatter o estado a `COMPLETED` tras pasar `task_verify_cmd`.

### D. Conciliación de memoria del agente

Si la tarea introdujo una decisión técnica relevante o una lección aprendida:
- Usar la tool `memory_record_decision` para registrar la decisión en `.agents/task-system/memory/decisions.md`.
- Usar la tool `memory_record_lesson` para registrar hallazgos o prevenciones en `.agents/task-system/memory/lessons.md`.

---

## Trigger 2: Iniciar una nueva tarea

1. Consultar la próxima tarea en prioridad usando la tool MCP `task_get_next`.
2. Verificar el alcance y dependencias con `task_get_detail`.
3. Validar los límites de archivos permitidos con `task_validate_scope`.
4. Marcar la tarea en progreso mediante `task_update_state` (`state: "in_progress"`).

---

## Trigger 3: Mantenimiento y consistencia periódica

1. **Backlog:** Asegurar que las compuertas de inspección previa (`docs/extractions/`) estén evaluadas antes de codificar tareas de la fase.
2. **Consistencia de referencias:** Ejecutar `powershell -NoProfile -File .agents/dev-tools/check-agents-refs.ps1` para validar que no haya links o paths rotos.
3. **Tests del sistema:** Ejecutar `node --test .agents/task-system/mcp/*.test.mjs` para garantizar la salud del harness.

---

## Definition of Done (Criterio de Cierre)

Toda tarea debe cumplir con la Definition of Done canónica (`.agents/references/definition-of-done.md`):
- [ ] Compila sin errores: `pnpm build`
- [ ] Typecheck estricto limpio: `pnpm typecheck` (o `npx tsc --noEmit -p apps/desktop`)
- [ ] Pruebas unitarias pasan: `pnpm test`
- [ ] Documentación y contratos sincronizados
- [ ] Commits semánticos en inglés según `AGENTS.md` §5
