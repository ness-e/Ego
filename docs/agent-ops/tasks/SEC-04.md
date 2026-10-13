# SEC-04 — Barrera Zero Secrets in Storage

| Campo | Valor |
|---|---|
| ID | SEC-04 |
| Plan | `docs/agent-ops/plans/2026-10-12-plan-backlog-10.md` Task 4 |
| Estado | COMPLETED (interceptor + tests canario + barrel; wiring a `putMulti` reservado a SEC-09) |
| Worker | ego-worker (solo esta task; sin commit, sin push) |
| Fecha | 2026-10-13 |
| Divergencia de ruta | Plan cita `packages/security/SecretsFilter.ts`; el real es `packages/security/src/SecretsFilter.ts` (scope validator, igual que SEC-03). Se usa el real. |

## Spec (contrato)

Interceptor bloquea API key/token hacia VantaDB/logs/prompts + tests de fuga con canarios (`sk-test-*`).

## Impacto Regla 0

Filtro puro y sin dependencias en `@ego/security` (main process). Cero cambios en `renderer/**`, `.agents/**` y motor VantaDB. No se toca `EgoMemoryAdapter`: el wiring al borde `put/putMulti` pertenece al contrato de SEC-09 (cuarentena + routing); aquí queda el hook testeable + spec de wiring (§Hallazgos). Sin lógica de negocio nueva fuera del paquete de seguridad.

## Threat model (5 min, security-and-hardening)

- **Fronteras:** (1) `put/putMulti` → VantaDB; (2) `console.error`/logs del adapter; (3) ensamblado de prompts (contexto del Cognitive Runtime).
- **Activos:** API keys del usuario (PAT-MCP vaultizadas por SEC-03, BYOK en `gov/settings`), tokens de sesión.
- **STRIDE:** Divulgación (fuga a storage/logs/prompts) = riesgo principal; Manipulación (un secreto redactado no debe romper el record — se redacta copia, nunca se muta la entrada); DoS (regex + entradas gigantes — mitigado con `maxInputChars` y cotas base64).
- **Abuso:** "pego mi key en el chat y pido guardarla en memoria" → el filtro la detecta antes del put (vía SEC-09); "la envuelvo en base64" → re-escaneo a un nivel la captura.

## Steps

- [x] DISCOVERY: `CredentialManager.ts` (SEC-03: PAT-MCP vaultizado, BYOK cifrado — el filtro cubre el resto), `EgoMemoryAdapter.put/putMulti` (choke point, `EgoMemoryAdapter.ts:140-209`), `UntrustedContentSanitizer.ts` (patrón CARP-04 existente), compuertas CARP-04/DSEK-05
- [x] Compuertas CARP-04 + DSEK-05 (Opción B): veredictos abajo
- [x] TDD RED: `test/SecretsFilter.test.ts` (11 tests) falla sin el módulo → GREEN con `src/SecretsFilter.ts`
- [x] Barrel `src/index.ts` + cobertura de exportación en `test/package-index.test.ts`
- [x] Verify §6: `pnpm --filter @ego/security test` PASS (3 files, 33/33) + `pnpm --filter @ego/security typecheck` exit 0
- [x] Revisión adversarial (doubt-driven, modo degradado anunciado): 3 fugas + trade-offs abajo

## Compuertas — veredictos

- **CARP-04 (cuarentena y validación de contenido no confiable, `docs/review/backlog-career-ops.md:37`): ✅ Completada — ADAPTADA.** El pipeline (desinfectar → enrutar amenaza a `quarantine/pending`) ya vive en `packages/memory/UntrustedContentSanitizer.ts`. SEC-04 aporta la pieza que faltaba para secretos: `SecretsFilter.scanEgoPut` devuelve el veredicto (`hasSecrets` + findings con ruta de campo + copias redactadas) con la forma exacta que el routing de SEC-09 necesita; el `quarantine()` del adapter (`EgoMemoryAdapter.ts:414`) ya existe como destino. Sin copiar código del origen (guardrail VantaDB).
- **DSEK-05 (fail-closed, adaptada en SEC-03): ✅ Completada — REUTILIZADA.** El filtro es fail-closed por construcción: `assertNoSecrets` lanza ante cualquier hallazgo; entradas no-string devuelven resultado vacío-tipado sin lanzar falsos verdes (el caller decide); oversize trunca + marca `truncated:true` (visible, nunca silencioso). Ninguna degradación a ofuscación.
- Ninguna compuerta exige decisión de producto → sin BLOQUEO.

## Hallazgos (cambios)

1. **NUEVO `packages/security/src/SecretsFilter.ts`** (~270 líneas, cero deps): 12 reglas (canary, anthropic, openai, stripe, github, slack, google, aws, jwt, pem, bearer, assigned_secret) + re-escaneo base64 a un nivel + `scanText/redactText/containsSecret/assertNoSecrets/sanitizeForLog/scanEgoPut`. Cero eco (reglas+campos, nunca valores), redacción global idempotente.
2. **EDIT `packages/security/src/index.ts`**: exporta el filtro + tipos (`SecretFinding`, `ScanOptions`, `TextScanResult`, `EgoPutLike`, `PutScanResult`).
3. **EDIT `packages/security/test/package-index.test.ts`**: test de exportación SEC-04.
4. **NUEVO `packages/security/test/SecretsFilter.test.ts`**: 11 tests, solo fixtures `sk-test-*` + sintéticos.
5. **NO tocado `packages/memory/EgoMemoryAdapter.ts`** (decisión consciente, no omisión): añadir la dependencia `@ego/memory → @ego/security` y el hook en `putMulti` es wiring con routing a cuarentena, contrato explícito de SEC-09 (que ya lista `SecretsFilter.ts` como archivo). Spec de wiring para SEC-09: en `putMulti`, antes de normalizar, `const v = scanEgoPut({namespace, key, payload, metadata})`; si `v.hasSecrets` → `quarantine(item, "secret_detected:<reglas>")` y NO persistir el original (fail-closed) o persistir `v.redactedPayload` según política que SEC-09 decida.

## Adversarial (doubt-driven, modo degradado: sin subagente anidado, auto-revisión explícita)

1. **Fuga 1/3 — secreto partido entre campos:** `{a:"prefijo sk-test-", b:"resto"}` → CAPTURADO (regla canary dispara con el prefijo solo + pasada `(whole)` sobre serialización JSON). Residual honesto: fragmento no-canario partido en mitades sin patrón propio evade → documentado como limitación; mitigación real: el vault SEC-03 sigue siendo la única vía legítima.
2. **Fuga 2/3 — canario envuelto en base64:** CAPTURADO (`base64_wrapped_secret`, se redacta el blob íntegro, pase previo a reglas directas). Residual: doble-codificado evade → documentado.
3. **Fuga 3/3 — mayúsculas/variantes (`API_KEY=`, `Sk-TeSt-`, `Authorization: Bearer`):** CAPTURADO (flags `/i`, prefijo conservado en redacción).
- **Trade-offs aceptados:** sin detector entrópico (FP en prosa técnica) ni normalización Unicode homoglypha (sobrediseño para SEC-04; candidato a SEC-08 chaos); `truncated:true` no lanza (disponibilidad ante payloads gigantes legítimos — el caller/SEC-09 decide); tope 20 decodificaciones base64 por string (DoS guard).

## FIX_PROPUESTO (regla del owner — NO aplicado)

- `{archivo: "packages/memory/EgoMemoryAdapter.ts:189-201", problema: "el catch de putMulti hace console.error con describeError(e); si el motor incluyera contenido del record en el mensaje, un secreto llegaría a logs por esta vía lateral aunque SEC-09 cablee el filtro", fix: "sanitizar el mensaje con sanitizeForLog() de @ego/security en ese console.error (requiere añadir la dep memory→security; hacerlo junto al wiring SEC-09)", riesgo: "bajo — cambio de una línea en ruta de error, pero toca paquete memory fuera del alcance SEC-04"}`

## Verify

- `pnpm --filter @ego/security test` → PASS (3 files, 33/33: 20 CredentialManager + 11 SecretsFilter + 2 index).
- `pnpm --filter @ego/security typecheck` → exit 0 (strict, sin `any`).
- Sin secretos en código/tests (`sk-test-*` solo canarios sintéticos; ningún PAT/token real).
- Sin commit, sin push (worker).

## Referencias

- `AGENTS.md` §Seguridad (credenciales en keychain, nunca en VantaDB/renderer/código); `.agents/rules/gobernanza-desktop.md` (cuarentena `quarantine/pending`); `.agents/references/definition-of-done.md`; `.agents/references/security-checklist.md` (sin secretos en código/logs, LLM02/LLM07: secretos fuera de prompts); `docs/roadmap/roadmap.md:161` (SEC-04 = siguiente hito Fase 11); plan Task 4; `docs/agent-ops/tasks/SEC-03.md` (patrón + DSEK-05).

## Registro de Cumplimiento (2026-10-13)

- **Estado:** ✅ COMPLETED
- **Evidencia:** interceptor + 11 tests canario + typecheck. Sin commit (worker).
