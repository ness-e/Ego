# Task F6T13 — Barrido lows + `any` justificados

- **Plan:** `docs/agent-ops/plans/2026-10-12-plan-maestro-hallazgos.md` (ÉPICA F6)
- **Ruta:** ego-worker · **Estado:** ⬜ PENDING
- **Contrato:** `pnpm typecheck` + suites tocadas en verde + 0 `any` sin justificación nueva

## Spec

L03 callId unicidad · L04 ZodLiteral/Date · L05 contextFactory · L06/L07 layout+tsconfig memory · L09 excepción contrato documentada · L10 `unknown`+narrowing+`getErrorParts` · L11 dep knowledge/models · L12 heartbeat atómico · L13 tsconfigs · L14 links `file:///`+SEC-06 gates+dots legacy+`obf:` aviso+dev script. (L08 en F2T5; si quedó fuera, entra aquí.)

## Impacto (Regla 0 — DISCOVERY)

Grep `any` por paquete + archivos L01-L14 del reporte.

## Steps

Un ítem por slice + test donde aplique.
Verify + RESULTADO.

## Verify

Typecheck + suites. Sin commit.

## Review (P2-01)

Revisor distinto.

**Protocolo aplicable:** Plan Maestro §Protocolo C01/C02 (10 pasos obligatorios: cuestionar, verificar, HITL, blast-radius, TDD, packet, verify, SARL, deuda, cierre).
