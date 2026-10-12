# Task F1T1 — SafeStorageBackend real + flags honestos

- **Plan:** `docs/agent-ops/plans/2026-10-12-plan-maestro-hallazgos.md` (ÉPICA F1)
- **Ruta:** ego-worker · **Estado:** ⬜ PENDING
- **Contrato:** `pnpm --filter @ego/security test` PASS + `typecheck` exit 0

## Spec (decisiones)

| # | Decisión | Opción | Justificación |
|---|----------|--------|---------------|
| 1 | Dónde vive SafeStorageBackend | `@ego/security` con `import("electron")` dinámico guarded | Funciona en main; en tests/renderer `isAvailable()=false` explícito |
| 2 | InMemory | `@testOnly` + warning | Nunca en prod (C06) |
| 3 | Persistencia | Sigue en `gov/settings` cifrado (main) | Sin duplicar stores; C08 = documentar split sesión vs persistido |

## Impacto mapeado (Regla 0 — completar en DISCOVERY)

archivos: `packages/security/src/CredentialManager.ts`, `test/CredentialManager.test.ts`, `src/index.ts` (solo si exporta backend). Blast radius: `apps/desktop/src/main.ts` (consume en F1T2, no aquí).

## Steps

1. `SafeStorageBackend`: encrypt/decrypt vía `safeStorage`, `isAvailable()` real, `isHardwareProtected()` real.
2. `InMemoryCryptoBackend`: marca test-only + warnings.
3. Tests: disponible/no-disponible, round-trip, flag hardware, fixtures `sk-test-*` (cero secretos).
4. Verify + RESULTADO.

## Verify

`pnpm --filter @ego/security test` + `typecheck`. Sin commit (lead).

## Review (P2-01)

Revisor distinto al implementador antes de COMPLETED.

**Protocolo aplicable:** Plan Maestro §Protocolo C01/C02 (10 pasos obligatorios: cuestionar, verificar, HITL, blast-radius, TDD, packet, verify, SARL, deuda, cierre).
