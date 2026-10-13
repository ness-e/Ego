# Task DIST-09 — Pin de VantaDB develop y política de actualización

- **Plan:** `docs/agent-ops/plans/2026-10-13-plan-deuda-residual.md` (Task 14)
- **Ruta:** ego-lead · **Estado:** ⬜ PENDING (vigilancia: bloqueado por upstream)
- **Contrato:** `file:` sustituido por pin versionado cuando upstream publique; tabla workaround→FIND al día.

## Verificación 2026-10-13

- `pnpm view vantadb-node version` → 404 (sin cambio desde 2026-10-12).
- `pnpm view vantadb version` → 0.8.0.
- Tabla workaround→FIND vigente (`EGO-01..07` en Backlog DIST-09 + `VDB-REQ-09` registrado).

## Decisión

Sin publicación upstream no hay ejecución posible. Se mantiene `file:` con justificación + vigilancia en cada campaña (UP-01). No requiere subagente.
