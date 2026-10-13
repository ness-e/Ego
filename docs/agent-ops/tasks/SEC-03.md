# SEC-03 — Credential Manager con Keychain

| Campo | Valor |
|---|---|
| ID | SEC-03 |
| Plan | `docs/agent-ops/plans/2026-10-12-plan-backlog-10.md` Task 3 |
| Estado | COMPLETED (decisión safeStorage-sobre-keytar + round-trip guardar/leer/borrar + degradación documentada) |
| Worker | ego-worker (solo esta task; sin commit, sin push) |
| Fecha | 2026-10-13 |
| Divergencia de ruta | Backlog/plan citan `packages/security/CredentialManager.ts`; el real es `packages/security/src/CredentialManager.ts` (scope validator). Se usa el real. |

## Spec (contrato)

Round-trip guardar/leer/borrar + tests, degradación documentada donde no haya keychain (compuerta DSEK-05).

## Impacto Regla 0

Renderer untrusted: secretos solo en main process vía `Electron.safeStorage`; renderer jamás toca `CredentialManager` ni ve secretos en claro (solo máscaras `sk-...XXXX`). Sin lógica de negocio. Sin cambios en `renderer/**` ni `.agents/**`.

## Steps

- [x] DISCOVERY: leer `packages/security/src/CredentialManager.ts` (SafeStorageBackend F1T1 + SyncSafeStorageBackend F1T2 + InMemory@testOnly), `src/index.ts`, `apps/desktop/src/main.ts` (uso PAT-MCP + models BYOK vía `SyncSafeStorageBackend`)
- [x] Compuerta DSEK-05 (Opción B): veredicto abajo
- [x] Decisión keytar vs safeStorage desde fuente (no memoria): ver Evidencia
- [x] TDD: test round-trip guardar/leer/borrar en `CredentialManager.test.ts` (gap: `deleteSecret`/`hasSecret` sin cobertura a nivel manager)
- [x] Verify §6: `pnpm --filter @ego/security test` PASS (21/21) + `pnpm --filter @ego/security typecheck` exit 0

## Compuerta DSEK-05 — veredicto

- **DSEK-05 (`Session Checkpoint Policy & Barrera Fail-Closed`, `docs/review/backlog-deepseek-harness.md:38`): ✅ Completada — ADAPTADA.** El patrón relevante para SEC-03 es el fail-closed: `SafeStorageBackend`/`SyncSafeStorageBackend` fallan cerrados sin store (`isAvailable()=false`, `encrypt`/`decrypt` lanzan, nunca degradan a ofuscación silenciosa); `InMemoryCryptoBackend` es explícitamente `@testOnly` con `console.warn`. Sin acción de código adicional.
- **Bloque C credenciales (`docs/extractions/deepseek-harness.md:63-70`, `packages/credentials/` → `SEC-03`/`SEC-04`): ADAPTADO.** El aislamiento (keys nunca en logs/dumps, vault en memoria + blobs `enc:`) ya vive en `CredentialManager` + `main.ts` (PAT-MCP vaultizado, `gov/mcp_servers` solo guarda `envRef`). Sin copiar código SQLite del origen (descartado por guardrail VantaDB).
- Ninguna compuerta exige decisión de producto → sin BLOQUEO.

## Decisión keytar vs safeStorage (source-driven, con fuentes)

**Decisión: safeStorage nativo de Electron. keytar DESCARTADO (con justificación).**

Evidencia (fuentes primarias, no memoria):

1. `safeStorage` cubre los 3 SO vía Electron (fuente: https://www.electronjs.org/docs/latest/api/safe-storage): macOS Keychain, Windows DPAPI, Linux Secret Service / kwallet (`gnome_libsecret`, `kwallet*`; fallback `basic_text` documentado). `isEncryptionAvailable()` es el gate honesto que `SafeStorageBackend` ya usa.
2. keytar está archivado y read-only desde 2022-12-15 (fuente: https://github.com/atom/node-keytar — banner "This repository was archived by the owner on Dec 15, 2022. It is now read-only"). Añadirlo sería dependencia nativa (`binding.gyp`, `libsecret-1-dev` en Linux) muerta aguas arriba: viola higiene supply-chain (menos deps nativas) y duplica el keychain que Electron ya expone sin `postinstall`.
3. `keytar` NO es dependencia hoy (`packages/security/package.json`: solo `zod` + dev `vitest`/`typescript`); `apps/desktop/src/main.ts:274-282` ya adapta el `safeStorage` real a `SyncSafeStorageBackend`. No hay hueco funcional que keytar cubra.

## Hallazgos (cambios mínimos)

1. **FIND-SEC03-01 (gap de cobertura, FIXED): `deleteSecret`/`hasSecret` sin test a nivel manager.** Nuevo test `round-trip guardar/leer/borrar` en `packages/security/test/CredentialManager.test.ts` (has=false → store → has=true → get=valor → delete=true → has=false → get=null → delete=false). Sin cambios en `src/` (comportamiento ya correcto).
2. **Sin cambios en `src/CredentialManager.ts`.** F1T1/F1T2 ya cumplen el contrato: prefijos `enc:` (real) / `obf:` legacy solo-lectura, vault firmado HMAC M17, flags hardware honestos.

## Degradación documentada (donde no hay keychain)

| Contexto | Comportamiento | Flag |
|---|---|---|
| Fuera del main process (tests, renderer) o `isEncryptionAvailable()=false` | `SafeStorageBackend.isAvailable()=false`; `encrypt`/`decrypt` lanzan `safeStorage no disponible` (fail-closed, nunca ofuscación silenciosa) | `isHardwareProtected()=false` |
| Linux sin secret store (`basic_text`) | Electron cifra con password hardcodeada (fuente: docs safeStorage §Linux); `getSelectedStorageBackend()` lo delata. Ego lo trata como disponible pero degradado — documentado, no silencioso | `isAvailable()=true`, protección real = la del backend |
| `main.ts` settings/BYOK (compat legacy) | `encryptCredential` cae a `obf:` con `warn` solo para restore de settings preexistentes; MCP vault (`getMcpCredentialManager`) usa el backend canónico sin fallback | warn explícito |
| Tests | `InMemoryCryptoBackend` (`obf:` reversible) solo con `console.warn` test-only; fixtures `sk-test-*` (sin secretos reales) | `isHardwareProtected()=false` |

## Verify

- `pnpm --filter @ego/security test` → PASS (2 files, 21/21 tests: 20 CredentialManager + 1 index).
- `pnpm --filter @ego/security typecheck` → exit 0.
- Sin secretos en tests (`grep sk-test` = solo fixtures `sk-test-*`; ningún PAT/token real).
- Sin commit, sin push (worker).

## Referencias

- `AGENTS.md` §Seguridad (credenciales en keychain del SO, nunca en VantaDB/renderer/código); `.agents/rules/gobernanza-desktop.md`; `.agents/references/definition-of-done.md`; `.agents/references/security-checklist.md` (sin secretos en código, sin log de secretos).
- `docs/engineering/integraciones.md:103-113` (Credential Manager: keychain SO, nunca VantaDB ni planos, IPC tipado en main).
- Fuentes decisión: https://www.electronjs.org/docs/latest/api/safe-storage · https://github.com/atom/node-keytar
