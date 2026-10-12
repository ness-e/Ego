# Task F5T10 — Deps VantaDB + sandbox + IPC muerto

- **Plan:** `docs/agent-ops/plans/2026-10-12-plan-maestro-hallazgos.md` (ÉPICA F5)
- **Ruta:** ego-desktop · **Estado:** ⬜ PENDING
- **Contrato:** `pnpm --filter @ego/desktop typecheck` + tests IPC en verde + install reproducible

## Spec

| # | Decisión | Opción | Justificación |
|---|----------|--------|---------------|
| 1 | Deps | Quitar `vantadb` WASM si sin import; versionar `vantadb-node` (H23/H24) | Guardrail + reproducibilidad |
| 2 | Ventana | `sandbox:true` + preload (H26) | Aislamiento degradado |
| 3 | IPC | Puentear o eliminar handlers knowledge/decision (H25) | Superficie muerta |

## Impacto (Regla 0 — DISCOVERY)

`apps/desktop/package.json`, `windows/FloatingWindowPrototype.ts`, `main.ts:1359`, `preload.ts`, `renderer/lib/ego.ts`.

## Steps

1. Deps + verificación en clon limpio (`--frozen-lockfile`).
2. Sandbox + IPC (puente o delete con justificación).
3. Verify + RESULTADO.

## Verify

Typecheck + tests + install limpio. Sin commit. Sin secretos.

## Review (P2-01)

Revisor distinto (`ego-audit` superficie IPC).

**Protocolo aplicable:** Plan Maestro §Protocolo C01/C02 (10 pasos obligatorios: cuestionar, verificar, HITL, blast-radius, TDD, packet, verify, SARL, deuda, cierre).
