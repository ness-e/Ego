---
id: ACT-12
title: "Integrar EventBus en ToolExecutionLoop y Desktop Main"
status: completed
phase: "Fase 02: Acción & Tool Calling"
priority: P0
component: "@ego/runtime, @ego/desktop"
assignee: "Ego Engineering & Runtime"
dependencies: ["ACT-05", "ACT-02"]
origin: "Coucou COUC-01 + Coucou attention FSM"
tags: [eventbus, runtime, telemetry, observability, desktop-main, couc-01]
---

# TASK ACT-12: Integrar EventBus en ToolExecutionLoop y Desktop Main

## 1. Contexto y Justificación
Conforme a `docs/architecture/vision-general.md` §Bus de eventos y la compuerta `COUC-01` (Ingress de eventos en el borde con normalización determinista), Ego requiere observabilidad estructurada y telemetría de extremo a extremo:
1. **Desacoplamiento Reactivo:** Los componentes del sistema (Decision Intelligence, Activity Widget, Auditoría y UI) no deben acoplarse con llamadas directas punto a punto; deben consumir eventos normalizados a través del `EventBus` (`@ego/events`).
2. **Cierre de Brecha de Integración:** En `ACT-05` se implementó `@ego/events` (`EventBus.ts`, `StructuredLogger.ts`), pero `ToolExecutionLoop` y `apps/desktop/src/main.ts` aún no lo tenían integrado, convirtiendo la telemetría de turnos en código no integrado.
3. **Gobernanza y Trazabilidad:** Cada invocación de herramienta, solicitud HITL, resolución, fallo y finalización de turno debe emitir eventos formales inmutables con `traceId` y `sessionId`.

---

## 2. Blast Radius e Impacto
- **Módulos y archivos involucrados:**
  - `packages/runtime/package.json` (Añadir dependencia `@ego/events`)
  - `packages/runtime/src/types.ts` (Añadir `eventBus` a `ToolExecutionLoopConfig` y `LoopRunOptions`)
  - `packages/runtime/src/ToolExecutionLoop.ts` (Emisión de `tool.started`, `tool.executed`, `tool.failed`, `approval.required`, `approval.resolved`, `task.completed`)
  - `packages/runtime/test/ToolExecutionLoop-events.test.ts` (Pruebas unitarias de emisión de eventos en el loop)
  - `apps/desktop/src/main.ts` (Inicialización de EventBus, StructuredLogger y emisión en streaming IPC)
  - `apps/desktop/src/preload.ts` (Exposición de canal `onEvent` en window.ego)
  - `apps/desktop/renderer/lib/ego.ts` (Soporte en cliente tipado del renderer)
  - `apps/desktop/test/eventbus-ipc.test.ts` (Pruebas unitarias de integración de EventBus en desktop)
  - `docs/roadmap/Backlog.md` y `docs/roadmap/roadmap.md` (Sincronización de progreso y cierre de Fase 02: 12/12)

---

## 3. Contratos Técnicos Pinned

### 3.1. Inyección de EventBus en ToolExecutionLoop
```typescript
export interface ToolExecutionLoopConfig {
  eventBus?: EventBus;
  // ...
}

export interface LoopRunOptions {
  eventBus?: EventBus;
  // ...
}
```

### 3.2. Secuencia Canónica de Eventos por Herramienta
```
[tool.started] ──► [approval.required]? ──► [approval.resolved]? ──► [tool.executed] / [tool.failed]
```

---

## 4. Pasos de Ejecución
- [x] Paso 1: Añadir `@ego/events` como dependencia en `packages/runtime/package.json`.
- [x] Paso 2: Actualizar `packages/runtime/src/types.ts` para incorporar `eventBus?: EventBus`.
- [x] Paso 3: Integrar la emisión de eventos en `packages/runtime/src/ToolExecutionLoop.ts`.
- [x] Paso 4: Crear suite de pruebas unitarias en `packages/runtime/test/ToolExecutionLoop-events.test.ts`.
- [x] Paso 5: Instanciar y conectar `EventBus` y `StructuredLogger` en `apps/desktop/src/main.ts`.
- [x] Paso 6: Exponer `onEvent` en `apps/desktop/src/preload.ts` y en `apps/desktop/renderer/lib/ego.ts`.
- [x] Paso 7: Crear pruebas de integración en `apps/desktop/test/eventbus-ipc.test.ts`.
- [x] Paso 8: Ejecutar verificación exhaustiva (`pnpm test`, `pnpm typecheck`, `pnpm build`).
- [x] Paso 9: Sincronizar Backlog y Roadmap (Fase 02 al 100% — 12/12 tareas completadas).
- [x] Paso 10: Generar commit semántico en Git y Push a master.

## Registro de Cumplimiento (2026-10-09)
- **Estado:** ✅ COMPLETED
- **Timestamp:** 2026-10-09T17:35:15.373Z
- **Evidencia:** Verificación mecánica aprobada
- **Commit:** Transacción local
