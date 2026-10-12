# Task F1T2 — Cableado @ego/security + endurecimiento MCP

- **Plan:** `docs/agent-ops/plans/2026-10-12-plan-maestro-hallazgos.md` (ÉPICA F1)
- **Ruta:** ego-arch · **Estado:** ⬜ PENDING
- **Contrato:** suites `security,integrations` PASS + `floor-guard.ps1` sin secretos

## Spec

| # | Decisión | Opción | Justificación |
|---|----------|--------|---------------|
| 1 | `src/index.ts` | Exporta CredentialManager + backends (cierra C04) | Paquete importable |
| 2 | main.ts | Delega cifrado al paquete; restore `gov/settings` intacto | Sin duplicar lógica |
| 3 | MCP spawn | Allowlist + prohibir `shell:true` + approval no-firmados | Cierra RCE por config (H31) |
| 4 | PAT | Vía Credential Manager, nunca `process.env` en prod | Guardrail Keychain |
| 5 | Vault HMAC | Versión + HMAC en export/import (M17) | Integridad |

## Impacto (Regla 0 — DISCOVERY)

`packages/security/src/index.ts`, `apps/desktop/src/main.ts` (bloque settings), `packages/integrations/src/mcp/McpClient.ts`, `McpManager.ts`.

## Steps

1. index.ts + delegación main (1:1, sin refactor colateral).
2. MCP: allowlist, `Result` explícito, `overrideExisting` auditado.
3. Vault HMAC + tests. Secret-scan del diff.
4. Verify + RESULTADO.

## Verify

Suites + typecheck + `floor-guard.ps1`. Sin commit.

## Review (P2-01)

Revisor distinto (ideal `ego-audit` sobre el diff).

**Protocolo aplicable:** Plan Maestro §Protocolo C01/C02 (10 pasos obligatorios: cuestionar, verificar, HITL, blast-radius, TDD, packet, verify, SARL, deuda, cierre).
