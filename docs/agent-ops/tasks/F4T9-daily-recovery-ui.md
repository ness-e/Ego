# Task F4T9 — Daily/recovery/ui-runtime

- **Plan:** `docs/agent-ops/plans/2026-10-12-plan-maestro-hallazgos.md` (ÉPICA F4)
- **Ruta:** ego-worker · **Estado:** ⬜ PENDING
- **Contrato:** suites `dailystate,recovery,ui-runtime` en verde

## Spec

| # | Decisión | Opción | Justificación |
|---|----------|--------|---------------|
| 1 | Checksum | fail-closed + `system.alert` (H15) | Integridad decorativa |
| 2 | Evento | `daily.decision.recorded` (H21) | Colisión de hechos |
| 3 | ActorId | Helper `parseActorId` común (M24) | Duplicación + rama `.String` |
| 4 | Recovery | Tipar adapter + paginar export + OpGate guard (H20/M22) | `any` + OOM + drain |
| 5 | Canvas | insert/delete o `false`+warn (H16) | Miente aplicado |
| 6 | Mocks | Modo strict + zod + sin apiKey (H17/H18/H19) | Precedente inseguro |
| 7 | Mermaid | `replaceAll` + escape tokens (M18/M19) | XSS/inyección |

## Impacto (Regla 0 — DISCOVERY)

`DailyStatePersistence.ts`, `DecisionsFeed.ts`, `DailyStateEngine.ts`, `recovery/*`, `CanvasBridge.ts`, `MockIPCBridge.ts`, `MermaidRenderer.ts`.

## Steps

1-7. Un fix + test por ítem.
8. Verify + RESULTADO.

## Verify

Suites + typecheck. Sin commit.

## Review (P2-01)

Revisor distinto (`ego-audit` para H15/H20).

**Protocolo aplicable:** Plan Maestro §Protocolo C01/C02 (10 pasos obligatorios: cuestionar, verificar, HITL, blast-radius, TDD, packet, verify, SARL, deuda, cierre).
