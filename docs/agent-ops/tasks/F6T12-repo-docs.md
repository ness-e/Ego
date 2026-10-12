# Task F6T12 — Repo y docs coherentes

- **Plan:** `docs/agent-ops/plans/2026-10-12-plan-maestro-hallazgos.md` (ÉPICA F6)
- **Ruta:** ego-docs · **Estado:** ⬜ PENDING
- **Contrato:** CI verde + 0 links rotos en planes + Backlog verificado

## Spec

| # | Decisión | Opción | Justificación |
|---|----------|--------|---------------|
| 1 | Tests raíz | `tests/**` al workspace o mover a paquete + step CI (C09) | Suites que nunca corren |
| 2 | Links | `../../extractions/` + extender `fix_links.py` (C10) | ~40 rotos |
| 3 | Q faltantes | Restaurar Q6/Q8/Q17 o corregir conteo (H27) | Trazabilidad |
| 4 | Gates | Cerrar o 🚫 con OWNER (H28) | Opción B; BLOQUEO sin owner |
| 5 | CI | frozen + oxlint pin + e2e (H29) | Paridad |
| 6 | DIST | Rewrite DIST-11/12 + rutas + IDs + scripts + test:e2e + fichas (H30/M32) | Stale general |

## Impacto (Regla 0 — DISCOVERY)

`pnpm-workspace.yaml`, `package.json`, `ci.yml`, `docs/agent-ops/plans/*`, `Preguntas y respuestas.txt`, `Backlog.md` (SOLO correcciones verificables; H28 con owner).

## Steps

1-6. Un ítem por slice (H28 último, con BLOQUEO si no hay owner).
7. Verify + RESULTADO.

## Verify

CI + `check-agents-refs.ps1` + grep links. Sin commit. Sin tocar Estados sin owner.

## Review (P2-01)

Revisor distinto.
