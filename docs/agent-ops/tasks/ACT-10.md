---
id: ACT-10
title: "Validación E2E del Golden Path Alpha (Pasos 8 al 12) - tools-execution.test.ts"
status: completed
phase: "Fase 02: Acción & Tool Calling"
priority: P0
component: "tests/e2e"
assignee: "Ego Core Engineering"
dependencies: ["ACT-01", "ACT-02", "ACT-03", "ACT-04", "ACT-05", "ACT-06", "ACT-07"]
origin: "Golden Path P0-Alpha (Pasos 8 al 12) de docs/roadmap/roadmap.md"
tags: [e2e, golden-path, tools-execution, hitl, vantadb, durabilidad, action-identity]
---

# TASK ACT-10: Validación E2E del Golden Path Alpha (Pasos 8 al 12)

## 1. Contexto y Objetivos
Conforme a `docs/roadmap/roadmap.md` §Golden Path P0-Alpha (20 steps) y el Backlog Maestro (`docs/roadmap/Backlog.md`), la Fase 01 completó y validó los Pasos 1 al 7 (`CORE-11`: apertura, proyecto, memoria contextual, persistencia en disco Fjall, cierre y recuperación intacta tras reinicio).

El objetivo de **`ACT-10`** es implementar y verificar la suite E2E de los **Pasos 8 al 12**:
- **Paso 8 (Pedir una tarea):** El usuario solicita una tarea operativa que requiere invocar herramientas en el sistema de archivos del proyecto.
- **Paso 9 (Ego consulta Model Router):** El Cognitive Runtime (`ToolExecutionLoop`) orquesta la interacción consultando al `ModelRouter` con los esquemas de herramientas declaradas en `ToolRegistry`.
- **Paso 10 (Ego/Modelo selecciona Tool):** El modelo emite una llamada formal a una herramienta registrada (`fs_write_file`).
- **Paso 11 (Tool pide aprobación HITL):** La herramienta sensible/destructiva activa la política de seguridad del `ApprovalEngine`. Se calcula el `ActionIdentity` SHA-256 inmutable (`COUC-03`), y la ejecución se congela asíncronamente en espera de confirmación humana con ACK (`COUC-04`).
- **Paso 12 (Usuario aprueba → Tool ejecuta → Salida persiste en VantaDB):**
  1. El usuario emite la aprobación explícita de la acción retenida.
  2. `ExecutionManager` ejecuta la herramienta de forma atómica y supervisada en el workspace (`CARP-02`, `CARP-03`, `COUC-11`).
  3. El resultado de la ejecución se reinyecta al modelo en un mensaje de rol `tool`.
  4. El modelo sintetiza la respuesta final completando el turno.
  5. El turno completo, el artefacto generado y el registro de auditoría se persisten duraderamente en VantaDB (`NativeVantaDB`) en sus namespaces canónicos.
  6. **Prueba de Resiliencia y Durabilidad:** Se cierra y destruye la instancia en memoria, se reabre `EgoMemoryAdapter` en frío sobre el mismo directorio en disco, y se valida la recuperación completa e intacta del turno, el artefacto y la auditoría.

Asimismo, se validan los casos y ramificaciones de seguridad:
- **Flujo de Rechazo Humano:** Si el operador rechaza la solicitud, la herramienta NO se ejecuta, el archivo no se crea en disco, el rechazo se inyecta causalmente en el loop cognitivo y el estado se audita en VantaDB.
- **Flujo de Modificación de Parámetros:** El operador edita los parámetros previo a aprobar, ejecutándose la tool con los argumentos seguros corregidos.
- **Validación Causal contra Man-in-the-Middle:** Detección y rechazo si el digest de aprobación no coincide con la acción original.

---

## 2. Componentes Integrados en la Suite
1. `@ego/memory`: `EgoMemoryAdapter` respaldado por `NativeVantaDB` (napi-rs in-process sobre motor Fjall LSM).
2. `@ego/tools`: `ToolRegistry` y conectores Nivel A nativos (`fs_write_file`, `fs_read_file`).
3. `@ego/execution`: `ApprovalEngine` y `ExecutionManager`.
4. `@ego/runtime`: `ToolExecutionLoop` y `ErrorHandler`.
5. `@ego/models`: `ModelRouter` con `MockProvider` determinista.
6. `@ego/events`: `EventBus` para trazabilidad de eventos del sistema.

---

## 3. Criterio de Aceptación (DoD) y Verificación
- [x] La suite E2E pasa al 100% en Vitest sin flakiness ni timeouts (4/4 tests pasando en `tests/e2e/tools-execution.test.ts` y `packages/runtime/test/tools-execution.test.ts`).
- [x] La persistencia real en disco VantaDB se valida cerrando el adaptador y reabriendo una nueva instancia independiente contra el mismo directorio físico Fjall LSM.
- [x] Los archivos creados en el workspace existen con su contenido exacto y copias de seguridad correspondientes.
- [x] El ciclo de aprobación HITL opera de forma determinista con `ActionIdentity` SHA-256 (`COUC-03`, `COUC-04`).
- [x] Los casos de rechazo y edición de argumentos se comportan de acuerdo con las especificaciones de seguridad.
- [x] Detección y rechazo de violaciones causales de identidad.
- [x] Typecheck y build pasan limpios sin errores en todos los paquetes del monorepo.
