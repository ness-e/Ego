# Task F2T5 — Graph/lifecycle + export/checksum + git/sidecar

- **Plan:** `docs/agent-ops/plans/2026-10-12-plan-maestro-hallazgos.md` (ÉPICA F2)
- **Ruta:** ego-worker · **Estado:** ⬜ PENDING
- **Contrato:** suites `knowledge,domains` en verde

## Spec

| # | Decisión | Opción | Justificación |
|---|----------|--------|---------------|
| 1 | Graph | Paginar `explainArtifact` + `putMulti+flush` (M10) | Ventana 10 + N+1 |
| 2 | Lifecycle | Desenvolver antes de reinsertar + auditoría (M11) | Doble etiquetado + ventana no atómica |
| 3 | Export | Checksum canónico + streaming (M14) | Orden-dependiente + OOM |
| 4 | Git | Sanitizar paths/branch + approval HITL (M16) | Traversal + mutación sin gate |
| 5 | Sidecar | import.meta + timeout/kill + límite chunks (L08) | Cuelgue + OOM |

## Impacto (Regla 0 — DISCOVERY)

`ProjectMemoryGraph.ts`, `FactLifecycle.ts`, `KnowledgeExport.ts`, `WorktreeManager.ts`, `EngineeringDomain.ts`, `PythonSidecarBridge.ts`.

## Steps

1-5. Un fix + test por ítem (no mezclar concerns en un commit lógico; el worker entrega todo y el lead commitea por slice).
6. Verify + RESULTADO.

## Verify

Suites + typecheck. Sin commit.

## Review (P2-01)

Revisor distinto (`ego-audit` para M16).
