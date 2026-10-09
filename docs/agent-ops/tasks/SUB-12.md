# Task: SUB-12 — Superación Personal & Closed Learning Loop (Auto-Reflexión)

> **Fase:** 03 — Multi-Sub-Ego Runtime & Governance  
> **Estado:** ✅ completed  
> **Fecha:** 2026-10-09  
> **Responsable:** coder / Antigravity  
> **Plan:** `docs/agent-ops/plans/2026-10-09-plan-20-tareas-mvp.md`

---

## 1. Contexto & Propósito

Basado en los Principios Innegociables §1 (Memoria Local Persistente) y §4 (Sub-Egos Especializados) y la compuerta canónica KHOJ-05 (`extract_facts` y auto-reflexión continua inter-sesión).

Permite a los Sub-Egos aprender de errores corregidos, fallos de herramientas recuperados y directrices del usuario, reforzando estrategias exitosas y deduplicando sabiduría operativa para inyectarla en el system prompt de futuras sesiones.

`SUB-12` implementa `SelfImprovementLoop` en `packages/subegos/src/SelfImprovementLoop.ts`, proporcionando:
1. Esquema canónico `LessonLearnedSchema` con Zod (id, trigger, context, insight, actionableRule, confidence, reinforcementCount, tags).
2. Filtro de elegibilidad `isEligibleForReflection` que descarta fallos de red transitorios o infraestructura externa (ECONNREFUSED, 429, 503).
3. Deduplicación determinista por hash (`generateLessonHash`) e incremento de confianza ante reglas repetidas exitosas.
4. Persistencia en VantaDB bajo `egos/<subEgoId>/lessons` y recuperación por búsqueda híbrida o listado nativo.
5. Inyector de prompt `formatLessonsPrompt` para contextualizar al especialista con sabiduría previa.

---

## 2. Criterios de Aceptación (DoD)

- [x] Clase `SelfImprovementLoop` en `packages/subegos/src/SelfImprovementLoop.ts` y exportación en `index.ts`.
- [x] Esquema `LessonLearnedSchema` con validación estricta Zod.
- [x] Deduplicación y refuerzo de confianza (+0.1 hasta 1.0) en usos repetidos.
- [x] Método `recallLessons` con soporte para listado directo y búsqueda multi-namespace con `searchMulti`.
- [x] Formateador de directrices `formatLessonsPrompt` para el System Prompt.
- [x] Suite de pruebas completa en `packages/subegos/test/SelfImprovementLoop.test.ts` (5 tests passing).
- [x] Compilación y typecheck limpios (`pnpm typecheck` exit 0).
