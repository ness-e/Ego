---
id: SUB-05
title: "Shared Memory y protocolo de intercambio de contexto"
status: completed
phase: "Fase 03: Sub-Egos"
priority: P0
component: "@ego/subegos"
assignee: "Ego Engineering & Sub-Ego Core"
dependencies: ["SUB-04"]
origin: "Q2 + Q11 + Namespaces Specification"
tags: [subegos, shared-memory, context-exchange, leases, ttl, phase-03]
---

# Task: SUB-05 — Shared Memory y protocolo de intercambio de contexto
- **Estado:** ✅ COMPLETED
- **Plan:** docs/agent-ops/plans/2026-10-09-plan-20-tareas-mvp.md
- **Archivos clave:** packages/subegos/src/SharedMemory.ts, packages/subegos/test/SharedMemory.test.ts

## 1. Contexto y Justificación
Conforme al Principio Innegociable §2 (Project Memory) y §4 (Sub-Egos):
1. **Canal de Contexto Compartido:** Los Sub-Egos que cooperan en un proyecto deben compartir hechos, planes y resultados sin pasar megabytes de texto por el prompt.
2. **Aislamiento por Proyecto:** Las memorias compartidas residen bajo el namespace canónico `projects/<projectId>/shared/*`.
3. **Leases Temporales:** Soporte para bloqueo/reserva temporal (`acquireLease`, `releaseLease`, `renewLease`) con TTL para evitar condiciones de carrera entre Sub-Egos concurrentes.
4. **Publicación y Notificación:** Métodos `publish(key, value, options)` y `subscribe(keyPattern, callback)` integrados con `EventBus`.

## 2. Blast Radius e Impacto
- **Archivos a crear/modificar:**
  - `packages/subegos/src/SharedMemory.ts` (Implementación de SharedMemory)
  - `packages/subegos/test/SharedMemory.test.ts` (Suite de pruebas con TTL, leases y broadcast)
  - `packages/subegos/src/index.ts` (Exportación pública consolidada)
- **Callers futuros:**
  - `DelegationRouter` (`SUB-06`)
  - `SubEgoRuntime` (`SUB-03`)

## Contrato
- Verificación: `pnpm --filter @ego/subegos test`
- Evidencia: `packages/subegos/test/SharedMemory.test.ts` (16 tests pasando al 100%)
- Invariantes: Claves estrictamente confinadas a `projects/<proj_id>/shared/*`; leases expiran determinísticamente al vencer su TTL.

## Steps de ejecución
- [x] Step 1: Diseñar e implementar clase `SharedMemory` con gestión de namespaces `projects/<projectId>/shared/*` y tipos de lease.
- [x] Step 2: Implementar soporte de leases temporales atómicos (`acquireLease`, `renewLease`, `releaseLease`) con expiración por TTL.
- [x] Step 3: Implementar métodos `publish`, `read`, `query` y `delete` con verificación de pertenencia a proyecto.
- [x] Step 4: Crear suite exhaustiva `packages/subegos/test/SharedMemory.test.ts` cubriendo concurrencia, expiración de lease y acceso no autorizado.
- [x] Step 5: Validar suite con `pnpm --filter @ego/subegos test`.

## Definition of Done
- [x] Tests de `SharedMemory.test.ts` pasan con exit code 0.
- [x] Claves compartidas quedan confinadas al proyecto activo.
- [x] Manejo limpio de errores tipados ante colisión de leases.
