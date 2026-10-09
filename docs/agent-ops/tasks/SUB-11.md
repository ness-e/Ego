---
id: SUB-11
title: "Sub-Ego Soul / Alma: Definición de Personalidad y Tono"
status: completed
phase: "Fase 03: Sub-Egos"
priority: P0
component: "@ego/subegos"
assignee: "Ego Engineering & Sub-Ego Core"
dependencies: ["SUB-01"]
origin: "Q4 + Sub-Ego Soul Architecture"
tags: [subegos, soul, personality, tone, prompt-assembly, phase-03]
---

# Task: SUB-11 — Sub-Ego Soul / Alma: Definición de Personalidad y Tono
- **Estado:** ✅ COMPLETED
- **Plan:** docs/agent-ops/plans/2026-10-09-plan-20-tareas-mvp.md
- **Archivos clave:** packages/subegos/src/SubEgoSoul.ts, packages/subegos/test/SubEgoSoul.test.ts

## 1. Contexto y Justificación
Conforme al Principio Innegociable §4 (Sub-Egos) y `docs/architecture/subego-soul.md`:
1. **Definición de Alma:** Cada Sub-Ego posee un alma (`SubEgoSoul`) que modela su identidad, tono (`tone`), estilo cognitivo (`reasoningStyle`), valores (`values`) y directrices innegociables (`inviolableRules`).
2. **Jerarquía Estricta de Ensamblado:** Precedencia inquebrantable de prompt: `System Security Guardrails > Core System Rules > Sub-Ego Soul > User Instruction`. El alma jamás puede anular directrices de seguridad.
3. **Persistencia en VantaDB:** Persistido bajo el namespace `egos/<id>/soul` para garantizar consistencia perpetua de personalidad entre sesiones.
4. **Esquema Zod:** Validación estricta con límites de longitud para prevenir inflación desmedida del contexto.

## 2. Blast Radius e Impacto
- **Archivos a crear/modificar:**
  - `packages/subegos/src/SubEgoSoul.ts` (Implementación de SubEgoSoul y `SubEgoSoulSchema`)
  - `packages/subegos/test/SubEgoSoul.test.ts` (Suite de pruebas de ensamblado de prompt, validación y persistencia)
  - NOTA: No modificar `packages/subegos/src/index.ts` directamente para evitar colisiones con otros subagentes concurrentes.
- **Callers futuros:**
  - `SubEgoRuntime` (`SUB-03`)
  - `CharacterProfile` (`CHAR-04`)

## Contrato
- Verificación: `pnpm --filter @ego/subegos test`
- Evidencia: `packages/subegos/test/SubEgoSoul.test.ts`
- Invariantes: Precedencia `System > Soul > User` garantizada; validación Zod con límites de longitud; persistencia en `egos/<id>/soul`.

## Steps de ejecución
- [x] Step 1: Definir esquema Zod `SubEgoSoulSchema` con campos tipados (`id`, `name`, `tone`, `reasoningStyle`, `values`, `inviolableRules`, `customDirectives`).
- [x] Step 2: Implementar clase `SubEgoSoul` con métodos para compilar directrices en un bloque de System Prompt ordenado.
- [x] Step 3: Implementar métodos de serialización y persistencia en `egos/<id>/soul` vía `EgoMemoryAdapter`.
- [x] Step 4: Crear suite `packages/subegos/test/SubEgoSoul.test.ts` validando precedencia, compilación de prompts y persistencia.
- [x] Step 5: Validar suite con `pnpm --filter @ego/subegos test`.

## Definition of Done
- [x] Tests de `SubEgoSoul.test.ts` pasando al 100%.
- [x] Precedencia de seguridad innegociable verificada en tests.
- [x] Persistencia y recuperación en VantaDB validadas.
