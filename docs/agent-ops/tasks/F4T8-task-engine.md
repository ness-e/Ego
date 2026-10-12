# Task F4T8 — Motor de tareas correcto

- **Plan:** `docs/agent-ops/plans/2026-10-12-plan-maestro-hallazgos.md` (ÉPICA F4)
- **Ruta:** ego-engine · **Estado:** ⬜ PENDING
- **Contrato:** suite `tasks` en verde + test pause/resume real

## Spec

| # | Decisión | Opción | Justificación |
|---|----------|--------|---------------|
| 1 | Pool | workers reales o renombrar `LocalTaskPool` (H11) | Promesa falsa de paralelismo |
| 2 | Timeout | Libera slot + ignora tardía (H12) | Fuga + doble conteo |
| 3 | Pause | `paused`≠`cancelled` + resume real (H13) | Pausa imposible |
| 4 | Recorder | `delete` tras persistir (H14) | Fuga + snapshot miente |
| 5 | Approval | Hook en triggers proactivos (H22) | Gap Fase 11 |
| 6 | Menores | Globs sin fallback, cron canónico, `void`+catch (M20/M21/M23) | Falsos + fragilidad |

## Impacto (Regla 0 — DISCOVERY)

`WorkerTaskPool.ts`, `BackgroundEngine.ts`, `RunRecorder.ts`, `ProactivityEngine.ts`.

## Steps

1-6. Un fix + test por ítem (pause/resume con test dedicado).
7. Verify + RESULTADO.

## Verify

Suite + typecheck. Sin commit.

## Review (P2-01)

Revisor distinto.

**Protocolo aplicable:** Plan Maestro §Protocolo C01/C02 (10 pasos obligatorios: cuestionar, verificar, HITL, blast-radius, TDD, packet, verify, SARL, deuda, cierre).
