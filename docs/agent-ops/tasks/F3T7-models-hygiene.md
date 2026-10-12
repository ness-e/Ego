# Task F3T7 — Higiene models/runtime

- **Plan:** `docs/agent-ops/plans/2026-10-12-plan-maestro-hallazgos.md` (ÉPICA F3)
- **Ruta:** ego-worker · **Estado:** ⬜ PENDING
- **Contrato:** suites `models,runtime,execution` en verde

## Spec

| # | Decisión | Opción | Justificación |
|---|----------|--------|---------------|
| 1 | Router | `warn` ante provider ausente (M04) | Mock silencioso enmascara config |
| 2 | errorHandler | Tipar `ErrorHandler` (M02) | `any` prohibido |
| 3 | Deps | Eliminar no usadas o a devDeps (L01) | `@ego/models` en decision, zod ocioso |
| 4 | tsconfig | Unificar o documentar NodeNext (L02) | Divergencia sin motivo |

## Impacto (Regla 0 — DISCOVERY)

`ModelRouter.ts`, `runtime/types.ts`, `package.json`s, `decision/tsconfig.json`.

## Steps

1-4. Un ítem por slice + test donde aplique (M04: test de warn).
5. Verify + RESULTADO.

## Verify

Suites + typecheck. Sin commit.

## Review (P2-01)

Revisor distinto.
