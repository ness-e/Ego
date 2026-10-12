# Task F2T6 — Gateway memoria: getDb, deps, errores, workarounds

- **Plan:** `docs/agent-ops/plans/2026-10-12-plan-maestro-hallazgos.md` (ÉPICA F2)
- **Ruta:** ego-worker · **Estado:** ⬜ PENDING
- **Contrato:** suite `memory` en verde + install limpio + 0 workarounds sin cita

## Spec

| # | Decisión | Opción | Justificación |
|---|----------|--------|---------------|
| 1 | getDb | Eliminar o read-only + auditar (H04) | Salta gateway único |
| 2 | Deps | Una canónica, fuera `file:`, bloquear wasm (H05/M05) | Instalación irreproducible |
| 3 | Errores | `Result` o log estructurado + test inyectado (M07) | Vacío indistinguible de fallo |
| 4 | Fail-open | `proceed:false` coherente (M08) | Política contradictoria |
| 5 | Citas | `// Workaround: VDB-XXX` + registro verificado (M09) | DoD gobernanza |
| 6 | Docs | BM25 puro en 3 textos (M06) | Contradice VDB-INC-01 |

## Impacto (Regla 0 — DISCOVERY)

`EgoMemoryAdapter.ts` (getDb, list/delete/searchMulti, fallbacks, comentarios), `EgoMemoryLifecycle.ts:172`, `SessionCheckpointPolicy.ts:40`, `package.json` memory, `readiness-plan.md §2`.

## Steps

1-6. Un ítem por slice + test (inyectado para M07).
7. Verify + RESULTADO.

## Verify

Suite + typecheck + `pnpm install --frozen-lockfile` en clon limpio (o `--filter @ego/memory`). Sin commit. Sin secretos.

## Review (P2-01)

Revisor distinto (`ego-audit` para H04/M07).
