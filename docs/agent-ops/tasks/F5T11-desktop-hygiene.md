# Task F5T11 — Higiene desktop

- **Plan:** `docs/agent-ops/plans/2026-10-12-plan-maestro-hallazgos.md` (ÉPICA F5)
- **Ruta:** ego-desktop · **Estado:** ⬜ PENDING
- **Contrato:** typecheck + tests + `pnpm build` exit 0

## Spec

| # | Decisión | Opción | Justificación |
|---|----------|--------|---------------|
| 1 | Contrato | `EgoIpc` completo o derivado (M25) | 6 vs ~35 canales |
| 2 | Preload | `EgoBridge` + `Window.ego`, 0 `any` (M26) | Tipado fuerte |
| 3 | Builder | `assets/` o quitar + verificar artefactos (M27) | Empaquetado roto |
| 4 | electron-vite | Alinear docs o migrar (M28) | Docs vs realidad |
| 5 | Electron | ≥36 o ajustar engines con verificación native (M29) | Node 20 vs 22 |
| 6 | tsconfigs | `tsc --noEmit -p` o composite + base + includes (M30/M31) | Cobertura typecheck |

## Impacto (Regla 0 — DISCOVERY)

`ipc.ts`, `preload.ts`, `electron-builder.config.cjs`, `package.json`s, `tsconfig`s, `AGENTS.md` (M28/M29 si cambia).

## Steps

1-6. Un ítem por slice (M29 con prueba de módulos nativos).
7. Verify + RESULTADO.

## Verify

Typecheck + tests + build. Sin commit.

## Review (P2-01)

Revisor distinto.

**Protocolo aplicable:** Plan Maestro §Protocolo C01/C02 (10 pasos obligatorios: cuestionar, verificar, HITL, blast-radius, TDD, packet, verify, SARL, deuda, cierre).
