# Task F3T6 — Contratos de decisión unificados

- **Plan:** `docs/agent-ops/plans/2026-10-12-plan-maestro-hallazgos.md` (ÉPICA F3)
- **Ruta:** ego-arch · **Estado:** ⬜ PENDING
- **Contrato:** suites `decision,execution,runtime` en verde + test de coherencia registry

## Spec

| # | Decisión | Opción | Justificación |
|---|----------|--------|---------------|
| 1 | AdmittedRunContext | Un tipo canónico + adaptador (H01) | Dos tipos incompatibles |
| 2 | ApprovalDecision | Una fuente en `@ego/execution` (M01) | Divergencia futura |
| 3 | Routing | Tabla única dominio→subEgo (M03) | Dos rutas discrepan |
| 4 | Telemetry | `metrics.turn` al mapa canónico (H03) | Fuera de contrato + `any` |
| 5 | Tools | Nombres canónicos + test vs registry (H02) | `allowedTools` vacío |

## Impacto (Regla 0 — DISCOVERY)

`execution/AdmittedRunContext.ts`, `decision/verdict.ts`, `runtime/types.ts`, `DecisionCascade.ts`, `DecisionRouter.ts`, `Telemetry.ts`, `IntentClassifier.ts`.

## Steps

1-5. Un contrato por slice con su test.
6. Verify + RESULTADO.

## Verify

Suites + typecheck. Sin commit.

## Review (P2-01)

Revisor distinto.
