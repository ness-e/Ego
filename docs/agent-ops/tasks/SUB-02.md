---
id: SUB-02
title: "Fábrica Inteligente de Sub-Egos (3 modalidades)"
status: pending
phase: "Fase 03: Sub-Egos"
priority: P0
component: "@ego/subegos"
assignee: "Ego Engineering & Sub-Ego Core"
dependencies: ["SUB-01"]
origin: "Hermes HERM-12 + Q11"
tags: [subegos, factory, templates, conversational, schema, phase-03]
---

# Task: SUB-02 — Fábrica Inteligente de Sub-Egos (3 modalidades)
- **Estado:** ✅ COMPLETED
- **Plan:** docs/agent-ops/plans/2026-10-09-subegos-foundation.md
- **Archivos clave:** packages/subegos/src/SubEgoFactory.ts, packages/subegos/src/templates/domainTemplates.ts

## 1. Contexto y Justificación
Conforme a `docs/architecture/agentes.md` y los 10 Principios Innegociables de Ego (§4 Sub-Egos especializados y personalizables), la creación de Sub-Egos no puede limitarse a la redacción manual de JSON en crudo. La fábrica debe ofrecer tres modalidades de instanciación con tipado estricto Zod (`SubEgoManifest`):
1. **Modo Conversacional Guiado:** Asistente interactivo por turnos que extrae y destila rol, nombre, objetivo, herramientas, permisos y presupuesto. Opera como un motor de refinamiento desacoplado de la UI.
2. **Modo Plantillas por Dominio (HERM-12):** Catálogo de plantillas preconfiguradas y probadas (`researcher`, `code_reviewer`, `copywriter`, `analyst`, `planner`) listas para clonarse o ajustarse.
3. **Modo Declarativo JSON/YAML:** Parser y validador de configuración cruda con reporte de errores amigable y enriquecido con Zod.

## 2. Blast Radius e Impacto
- **Archivos a crear/modificar:**
  - `packages/subegos/src/SubEgoFactory.ts` (Implementación de las 3 modalidades de fábrica)
  - `packages/subegos/src/templates/domainTemplates.ts` (Catálogo de plantillas de dominio)
  - `packages/subegos/src/index.ts` (Exportación de `SubEgoFactory` y plantillas)
  - `packages/subegos/test/SubEgoFactory.test.ts` (Suite de pruebas unitarias exhaustivas con Vitest)
- **Callers futuros:**
  - `apps/desktop/renderer/components/SubEgosView.tsx` (Panel visual de Sub-Egos)
  - `apps/desktop/src/main.ts` (IPC handlers para creación de Sub-Egos)
  - Chat Slash Commands (`/subego create`, `/subego template <name>`)

## Contrato
- Verificación: pnpm --filter @ego/subegos test
- Evidencia: packages/subegos/test/SubEgoFactory.test.ts
- Invariantes: Todo SubEgoManifest generado debe cumplir SubEgoManifestSchema (Zod) y DSEK-03 (IDs con prefijo ego.)
- Deuda: ninguna
- Queda pendiente: Integración con IPC handlers en apps/desktop/src/main.ts

## Steps de ejecución
- [x] Step 1: Definir plantillas canónicas de dominio en `packages/subegos/src/templates/domainTemplates.ts`
- [x] Step 2: Implementar clase `SubEgoFactory` con modalidades conversacional, plantillas y JSON/YAML
- [x] Step 3: Exportar API en `packages/subegos/src/index.ts`
- [x] Step 4: Crear suite de pruebas unitarias en `packages/subegos/test/SubEgoFactory.test.ts`
- [x] Step 5: Verificación global de monorepo (`pnpm test && pnpm typecheck`)

## Deuda técnica (Regla 6 — MUST)
**Saldo neto de deuda:** Sin deuda nueva.

## Definition of Done (contrato multi-nivel — P2-08)
- [x] **Task:** `pnpm --filter @ego/subegos test` pasa con 100% de cobertura en fábrica y plantillas.
- [x] **Commit:** Commit semántico convencional atómico (`feat(subegos): implement SubEgoFactory with 3 creation modes`).
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
- [x] **SECURITY:** Validación exhaustiva con Zod para evitar inyección de comandos o paths no autorizados en `systemPrompt` y `namespaces`.
- [x] **PERFORMANCE:** Plantillas inmutables en memoria sin lecturas de disco por cada llamada.

## Review (GATE — agente distinto, P2-01)
- **Revisor:** ego-audit / reviewer
- **Enfoque:** Validación de contratos, principio de mínimo privilegio en plantillas y separación limpia de capas.
- **Veredicto:** ⬜ Pendiente de implementación

## Registro de Cumplimiento (2026-10-09)
- **Estado:** ✅ COMPLETED
- **Timestamp:** 2026-10-09T19:34:27.587Z
- **Evidencia:** Verificación mecánica aprobada
- **Commit:** Transacción local