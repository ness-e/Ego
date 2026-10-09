# Task: SUB-10 — Validación E2E del Golden Path Alpha (Pasos 10 al 14)

> **Fase:** 03 — Multi-Sub-Ego Runtime & Governance  
> **Estado:** ✅ completed  
> **Fecha:** 2026-10-09  
> **Responsable:** coder / Antigravity  
> **Plan:** `docs/agent-ops/plans/2026-10-09-plan-20-tareas-mvp.md`

---

## 1. Contexto & Propósito

Criterio de Finalización Canónico (Roadmap Fase 03): Múltiples Sub-Egos cooperan para resolver una tarea sin que el usuario intervenga en la orquestación.

`SUB-10` implementa la suite E2E automatizada que valida la secuencia completa de la arquitectura multi-Sub-Ego (Pasos 10 al 14 del Golden Path Alpha):
- **Paso 10:** Solicitud del usuario recibida por el orquestador (`ego.nucleus`).
- **Paso 11:** Consulta de contexto y publicación de especificación en `SharedMemory` (`projects/<id>/shared/*`).
- **Paso 12:** Configuración y activación de `DelegationRouter` con prevención de ciclos y límites de profundidad.
- **Paso 13:** Delegación jerárquica a especialista (`ego.researcher`), ejecución con control de cuotas (`SubEgoBudgetTracker`) y auto-reflexión (`SelfImprovementLoop` SUB-12).
- **Paso 14:** Retorno, síntesis del orquestador, persistencia en VantaDB, cierre de base de datos y **reinicio en frío (Cold Reload)** para validar la restauración intacta de manifiestos, memoria compartida, cuotas y lecciones.

---

## 2. Criterios de Aceptación (DoD)

- [x] Suite de prueba E2E en `packages/subegos/test/subegos-delegation.test.ts` y réplica en `tests/e2e/subegos-delegation.test.ts`.
- [x] Flujo cerrado de 5 pasos verificado con éxito: Ego Core -> SharedMemory -> Delegación Especialista -> Lección aprendida -> Persistencia.
- [x] Validación de prevención de auto-delegación y ciclos recursivos (`DelegationCycleError`).
- [x] Validación de control estricto de profundidad máxima (`DelegationMaxDepthError`).
- [x] Simulación de reinicio en frío validando la persistencia y durabilidad en `NativeVantaDB` (Fjall LSM).
- [x] 100% de tests passing en `@ego/subegos` (142 tests passing).
- [x] Cero regresiones en el monorepo y typecheck limpio (`pnpm typecheck` exit 0).
