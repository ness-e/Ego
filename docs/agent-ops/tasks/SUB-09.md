# Task: SUB-09 — Límites de presupuesto y cuotas de consumo por Sub-Ego

> **Fase:** 03 — Multi-Sub-Ego Runtime & Governance  
> **Estado:** ✅ completed  
> **Fecha:** 2026-10-09  
> **Responsable:** coder / Antigravity  
> **Plan:** `docs/agent-ops/plans/2026-10-09-plan-20-tareas-mvp.md`

---

## 1. Contexto & Propósito

El Principio Innegociable §5 y §7 exige la protección de costes del usuario (BYOK / AI Credits) y la prevención de ejecuciones descontroladas o bucles infinitos de herramientas. Aunque `SubEgoManifest.ts` declara `SubEgoBudgetSchema` (`maxTokensPerCall`, `maxDailyCostUsd`, `requiresApprovalAboveUsd`), no existía una máquina contable activa que rastreara el consumo acumulado por Sub-Ego, descontara tokens por llamada y frenara la ejecución de un especialista cuando excede su presupuesto.

`SUB-09` implementa `SubEgoBudgetTracker` en `packages/subegos/src/SubEgoBudget.ts`, proporcionando:
1. Contabilidad en tiempo real de tokens de entrada (`inputTokens`), salida (`outputTokens`) y costo estimado USD.
2. Validación previa a la ejecución (`checkTurnBudget`, `checkDailyBudget`).
3. Interrupción automática con `SubEgoBudgetExceededError` ante exceso de cuotas.
4. Persistencia y recuperación de métricas de consumo acumulado en VantaDB bajo `egos/<id>/metrics/usage`.

---

## 2. Criterios de Aceptación (DoD)

- [x] Clase `SubEgoBudgetTracker` en `packages/subegos/src/SubEgoBudget.ts`:
  - `recordTurnUsage(subEgoId, usage, budget)`: actualiza métricas de la sesión y acumuladas del día con cálculo de costos por modelo.
  - `checkTurnBudget(subEgoId, estimatedTokens, budget)`: valida si el Sub-Ego puede iniciar o continuar una ejecución.
  - `needsApprovalForCost(subEgoId, estimatedCostUsd, budget)`: determina si requiere aprobación HITL previa por superar el umbral configurado.
  - `getMetrics(subEgoId)`: devuelve las estadísticas actuales del especialista.
  - `resetDailyUsage(subEgoId)`: resetea contadores diarios preservando acumulados históricos.
- [x] Integración con `EgoMemoryAdapter`: persiste contadores en `egos/<id>` clave `metrics_usage` para sobrevivir a reinicios de la aplicación.
- [x] Errores tipados: `SubEgoBudgetExceededError` y `SubEgoApprovalRequiredError`.
- [x] Suite de pruebas completa en `packages/subegos/test/SubEgoBudget.test.ts` con cobertura de límites, costes, reinicios y persistencia en VantaDB (10 tests passing).
- [x] Compilación TypeScript y typecheck limpios (`pnpm typecheck` exit 0).
