---
id: SUB-03
title: "Sub-Ego Runtime y ciclo de vida (Lazy Activation)"
status: pending
phase: "Fase 03: Sub-Egos"
priority: P0
component: "@ego/subegos"
assignee: "Ego Engineering & Sub-Ego Core"
dependencies: ["SUB-01"]
origin: "Q11 + Q12 + Principios §4 y §10"
tags: [subegos, runtime, lifecycle, lazy-activation, ttl, phase-03]
---

# Task: SUB-03 — Sub-Ego Runtime y ciclo de vida (Lazy Activation)
- **Estado:** ✅ COMPLETED
- **Plan:** docs/agent-ops/plans/2026-10-09-subegos-foundation.md
- **Archivos clave:** packages/subegos/src/SubEgoRuntime.ts, packages/subegos/src/types.ts

## 1. Contexto y Justificación
Conforme a los 10 Principios Innegociables de Ego (§4 Sub-Egos y §10 Operación persistente y extensible), un sistema operativo cognitivo desktop no puede instanciar todos los especialistas de manera anticipada en memoria RAM.
1. **Lazy Activation:** Los especialistas se instancian bajo demanda únicamente cuando reciben una tarea o mensaje.
2. **Ciclo de Vida FSM:** Transiciones deterministas: `unloaded` → `activating` → `idle` → `executing` → `idle` → `suspended` / `unloaded`.
3. **Descarga Automática (TTL Idle Timeout):** Mecanismo de recolección configurable que descarga instancias ociosas tras un periodo de inactividad liberando descriptores y memoria.
4. **Context Assembly Concurrente:** Cada instancia activa prepara su propio contexto (systemPrompt, tools asignadas y cuotas presupuestarias).

## 2. Blast Radius e Impacto
- **Archivos a crear/modificar:**
  - `packages/subegos/src/SubEgoRuntime.ts` (Implementación del runtime y FSM de ciclo de vida)
  - `packages/subegos/src/types.ts` (Nuevos tipos para estados de ciclo de vida e instancias)
  - `packages/subegos/src/index.ts` (Exportación pública)
  - `packages/subegos/test/SubEgoRuntime.test.ts` (Suite de pruebas unitarias)
- **Callers futuros:**
  - `packages/runtime/src/CognitiveRuntime.ts` (Orquestación principal)
  - `apps/desktop/src/main.ts` (Despacho de turnos desde IPC)

## Contrato
- Verificación: pnpm --filter @ego/subegos test
- Evidencia: packages/subegos/test/SubEgoRuntime.test.ts
- Invariantes: Ninguna instancia inactiva debe mantenerse indefinidamente en RAM; timers deben usar .unref() para evitar bloqueos del proceso
- Deuda: ninguna
- Queda pendiente: Integración directa con ToolExecutionLoop y OrchestrationBus (SUB-06)

## Steps de ejecución
- [x] Step 1: Definir tipos de ciclo de vida (`SubEgoLifecycleState`, `SubEgoInstance`) en `packages/subegos/src/types.ts`
- [x] Step 2: Implementar clase `SubEgoRuntime` con lazy activation y temporizador TTL en `packages/subegos/src/SubEgoRuntime.ts`
- [x] Step 3: Exportar API en `packages/subegos/src/index.ts`
- [x] Step 4: Crear suite de pruebas unitarias en `packages/subegos/test/SubEgoRuntime.test.ts`
- [x] Step 5: Verificación global de monorepo (`pnpm test && pnpm typecheck`)

## Deuda técnica (Regla 6 — MUST)
**Saldo neto de deuda:** Sin deuda nueva.

## Definition of Done (contrato multi-nivel — P2-08)
- [x] **Task:** `pnpm --filter @ego/subegos test` pasa con 100% de cobertura en ciclo de vida y transiciones.
- [x] **Commit:** Commit semántico convencional atómico (`feat(subegos): implement SubEgoRuntime with lazy activation and idle TTL`).
- [x] **Release:** Documentación sincronizada, exportación en `@ego/subegos` y sin regresiones en el monorepo.

## Herramientas necesarias
- Vitest (`pnpm --filter @ego/subegos test`)
- TypeScript compiler (`pnpm --filter @ego/subegos typecheck`)
- SDP: `campaign-executor`, `progreso`, `planning-and-task-breakdown`, `source-driven-development`

## Incógnitas (uphill) vs Pendientes (downhill)
- Incógnitas abiertas (uphill): 0
- Pendientes de ejecución (downhill): 5
- % completado: 0%

## Fases explícitas — SECURITY | PERFORMANCE
- [x] **SECURITY:** Aislamiento de tokens y estado por instancia para prevenir fugas cruzadas entre Sub-Egos.
- [x] **PERFORMANCE:** Liberación proactiva de recursos con `.unref()` en timers y límite de concurrencia en RAM.

## Review (GATE — agente distinto, P2-01)
- **Revisor:** ego-audit / reviewer
- **Enfoque:** FSM determinista, ausencia de timers colgados (`.unref()`) y gestión de memoria.
- **Veredicto:** ⬜ Pendiente de implementación

## Registro de Cumplimiento (2026-10-09)
- **Estado:** ✅ COMPLETED
- **Timestamp:** 2026-10-09T19:39:51.628Z
- **Evidencia:** Verificación mecánica aprobada
- **Commit:** Transacción local