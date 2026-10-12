# Task F2T3 — Bitemporal completo + HybridSearch real

- **Plan:** `docs/agent-ops/plans/2026-10-12-plan-maestro-hallazgos.md` (ÉPICA F2)
- **Ruta:** ego-worker · **Estado:** ⬜ PENDING
- **Contrato:** `pnpm --filter @ego/knowledge test` PASS con `asOf` sobre 250+ registros + `historical` preservado

## Spec

| # | Decisión | Opción | Justificación |
|---|----------|--------|---------------|
| 1 | `asOf` | Cursor hasta agotar + leer `state/is_latest` | Historia parcial hoy (M12) |
| 2 | `HybridSearch` | Sin fallback silencioso (o flag+log) + RRF multi-lista o rename | Guarda KHOJ-03 (H09) |
| 3 | Threshold | `ScoreThresholdFilter` calibrado o normalizado | BM25 ≠ coseno (H10) |

## Impacto (Regla 0 — DISCOVERY)

`BitemporalQueries.ts`, `HybridSearch.ts`, `filters/CosineThresholdFilter.ts` + tests. Actualizar KHOJ-03 donde cite 0.70.

## Steps

1. Bitemporal + test 250+ registros.
2. HybridSearch + test anti-fallback.
3. Threshold + test calibración.
4. Verify + RESULTADO.

## Verify

Suite + typecheck. Sin commit.

## Review (P2-01)

Revisor distinto.
