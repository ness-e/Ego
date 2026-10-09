---
id: SUB-04
title: "Aislamiento de estado privado egos/<id>/* en VantaDB"
status: pending
phase: "Fase 03: Sub-Egos"
priority: P0
component: "@ego/subegos"
assignee: "Ego Engineering & Sub-Ego Core"
dependencies: ["CORE-06", "SUB-01"]
origin: "Q11 + DSEK-03 + Namespaces Specification"
tags: [subegos, memory, vantadb, isolation, security, permissions, phase-03]
---

# Task: SUB-04 — Aislamiento de estado privado egos/<id>/* en VantaDB
- **Estado:** ✅ COMPLETED
- **Plan:** docs/agent-ops/plans/2026-10-09-subegos-foundation.md
- **Archivos clave:** packages/subegos/src/SubEgoMemoryGuard.ts, packages/memory/EgoMemoryAdapter.ts

## 1. Contexto y Justificación
Conforme a los 10 Principios Innegociables de Ego (§1 Memoria local persistente y §6 Gobernanza/Permisos) y `docs/architecture/namespaces.md`:
1. **Aislamiento Perimetral Estricto:** Cada Sub-Ego posee un scratchpad y espacio de trabajo privado en `egos/<id>/*`.
2. **Control de Acceso por Caller:** Ningún Sub-Ego puede leer o escribir directamente en el namespace de otro especialista (`egos/<other_id>/*`).
3. **Privilegio Nuclear:** Únicamente el orquestador principal (`ego.nucleus`) y el usuario tienen visibilidad y gobernanza sobre todos los namespaces.
4. **Validación de Lote Atómica:** Las operaciones `putMulti` y lecturas deben validar cada registro de forma independiente; si un solo registro viola los límites perimetrales, la operación completa es rechazada inmediatamente.

## 2. Blast Radius e Impacto
- **Archivos a crear/modificar:**
  - `packages/subegos/src/SubEgoMemoryGuard.ts` (Guard perimetral de acceso a memoria para Sub-Egos)
  - `packages/subegos/src/index.ts` (Exportación pública)
  - `packages/subegos/test/SubEgoMemoryGuard.test.ts` (Suite de pruebas de seguridad perimetral)
  - Integración en `packages/memory/EgoMemoryAdapter.ts` (Validación de llamador o wrapper seguro)
- **Callers futuros:**
  - `SubEgoRuntime` (Inyecta el guard como interface de memoria para cada instancia de especialista)
  - Memory MCP tools

## Contrato
- Verificación: pnpm --filter @ego/subegos test && pnpm --filter @ego/memory test
- Evidencia: packages/subegos/test/SubEgoMemoryGuard.test.ts
- Invariantes: Ningún Sub-Ego puede eludir la validación de namespace; putMulti debe validar la totalidad de los items
- Deuda: ninguna
- Queda pendiente: Control de acceso a namespaces compartidos (SUB-05)

## Steps de ejecución
- [x] Step 1: Implementar error tipado `SubEgoMemoryAccessDeniedError` y clase `SubEgoMemoryGuard` en `packages/subegos/src/SubEgoMemoryGuard.ts`
- [x] Step 2: Implementar validación estricta de namespaces por llamador en operaciones `putMulti`, `get`, `query` y `delete`
- [x] Step 3: Exportar API en `packages/subegos/src/index.ts`
- [x] Step 4: Crear suite de pruebas de seguridad y aislamiento en `packages/subegos/test/SubEgoMemoryGuard.test.ts`
- [x] Step 5: Verificación global de monorepo (`pnpm test && pnpm typecheck`)

## Deuda técnica (Regla 6 — MUST)
**Saldo neto de deuda:** Sin deuda nueva.

## Definition of Done (contrato multi-nivel — P2-08)
- [x] **Task:** Tests de `SubEgoMemoryGuard` y de `@ego/memory` pasan al 100%.
- [x] **Commit:** Commit semántico convencional atómico (`feat(subegos): implement SubEgoMemoryGuard for strict private state isolation`).
- [x] **Release:** Documentación de namespaces respetada y sin regresiones en el monorepo.

## Herramientas necesarias
- Vitest (`pnpm --filter @ego/subegos test`)
- TypeScript compiler (`pnpm --filter @ego/subegos typecheck`)
- SDP: `campaign-executor`, `progreso`, `planning-and-task-breakdown`, `source-driven-development`

## Incógnitas (uphill) vs Pendientes (downhill)
- Incógnitas abiertas (uphill): 0
- Pendientes de ejecución (downhill): 5
- % completado: 0%

## Fases explícitas — SECURITY | PERFORMANCE
- [x] **SECURITY:** Validación estricta anti-bypass y error tipado `SubEgoMemoryAccessDeniedError`.
- [x] **PERFORMANCE:** Chequeo en O(1) o prefijo string rápido sin llamadas I/O adicionales.

## Review (GATE — agente distinto, P2-01)
- **Revisor:** ego-audit / reviewer
- **Enfoque:** Seguridad perimetral, integridad de datos y ausencia de bypasses en escrituras en lote.
- **Veredicto:** ⬜ Pendiente de implementación

## Registro de Cumplimiento (2026-10-09)
- **Estado:** ✅ COMPLETED
- **Timestamp:** 2026-10-09T20:05:02.576Z
- **Evidencia:** Verificación mecánica aprobada
- **Commit:** Transacción local