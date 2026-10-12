# Task F2T4 — Dominios: schema + rehidratación + timeline

- **Plan:** `docs/agent-ops/plans/2026-10-12-plan-maestro-hallazgos.md` (ÉPICA F2)
- **Ruta:** ego-worker · **Estado:** ⬜ PENDING
- **Contrato:** suites `knowledge,domains,memory` verdes + cold-reboot por dominio

## Spec

| # | Decisión | Opción | Justificación |
|---|----------|--------|---------------|
| 1 | KnowledgeDomain | Migrar a `Fact` canónico + `indexFact` | Schema incompatible (H06) |
| 2 | Dominios | `load/hydrate` desde `adapter.list()` al arrancar | Pérdida en reboot (H07) |
| 3 | Timeline | `save/loadTimeline` o documentar efímera | Persistencia (H08) |

## Impacto (Regla 0 — DISCOVERY)

`domains/src/knowledge/KnowledgeDomain.ts`, `CrmDomain.ts`, `ProductDomain.ts`, `memory/SessionTimelineRewind.ts`.

## Steps

1. Schema + hydrate + tests cold-reboot.
2. Timeline persist o doc.
3. Verify + RESULTADO.

## Verify

Suites + typecheck. Sin commit.

## Review (P2-01)

Revisor distinto.
