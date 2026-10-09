---
id: SUB-07
title: "Registro y catálogo de Sub-Egos en namespace gov/sub_egos"
status: completed
phase: "Fase 03: Sub-Egos"
priority: P0
component: "@ego/subegos"
assignee: "Ego Engineering & Sub-Ego Core"
dependencies: ["SUB-01", "SUB-02"]
origin: "Q4 + Q11 + DSEK-01"
tags: [subegos, registry, catalog, governance, persistence, phase-03]
---

# Task: SUB-07 — Registro y catálogo de Sub-Egos en namespace gov/sub_egos
- **Estado:** ✅ COMPLETED
- **Plan:** docs/agent-ops/plans/2026-10-09-plan-20-tareas-mvp.md
- **Archivos clave:** packages/subegos/src/SubEgoRegistry.ts, packages/subegos/test/SubEgoRegistry.test.ts

## 1. Contexto y Justificación
Conforme al Principio Innegociable §1 (Memoria persistente) y §4 (Sub-Egos):
1. **Catálogo Unificado:** Todos los Sub-Egos (del sistema o creados por el usuario vía `SubEgoFactory`) deben registrarse y persistirse en VantaDB bajo `gov/sub_egos/<id>`.
2. **Inmutabilidad del Sistema:** Los Sub-Egos del sistema (`ego.nucleus`, etc.) están protegidos contra edición o eliminación no autorizada.
3. **Búsqueda y Filtrado:** Capacidad para listar Sub-Egos por dominio (`domain`), capacidad (`tools`), tags y estado (`enabled`/`disabled`).
4. **Deshabilitación Suave:** Soporte para habilitar/deshabilitar Sub-Egos sin borrarlos destructivamente (patrón `soft-delete` / `supersede` DSEK-01).

## 2. Blast Radius e Impacto
- **Archivos a crear/modificar:**
  - `packages/subegos/src/SubEgoRegistry.ts` (Implementación de SubEgoRegistry)
  - `packages/subegos/test/SubEgoRegistry.test.ts` (Suite de pruebas de registro, persistencia y filtros)
  - NOTA: No modificar `packages/subegos/src/index.ts` directamente para evitar colisiones con otros subagentes concurrentes.
- **Callers futuros:**
  - `SubEgoSelector` (`SUB-08`)
  - `SubEgosView` (`INT-04`)
  - Cognitive Runtime

## Contrato
- Verificación: `pnpm --filter @ego/subegos test`
- Evidencia: `packages/subegos/test/SubEgoRegistry.test.ts`
- Invariantes: Sub-Egos del sistema inmutables; persistencia en namespace `gov/sub_egos/<id>` sobre `EgoMemoryAdapter`.

## Steps de ejecución
- [x] Step 1: Implementar clase `SubEgoRegistry` con conexión a `EgoMemoryAdapter` y validación Zod de `SubEgoManifest`.
- [x] Step 2: Implementar métodos `register`, `unregister`, `get`, `list`, `enable`, `disable` con protección de IDs de sistema.
- [x] Step 3: Implementar filtrado por dominio, tags y herramientas requeridas.
- [x] Step 4: Crear suite `packages/subegos/test/SubEgoRegistry.test.ts` verificando persistencia tras reinicio y protección de sistema.
- [x] Step 5: Validar suite con `pnpm --filter @ego/subegos test`.

## Definition of Done
- [x] Tests de `SubEgoRegistry.test.ts` pasan con exit code 0.
- [x] Protección inmutable de entidades del sistema verificada.
- [x] Serialización y deserialización fiel en namespace `gov/sub_egos/*`.
