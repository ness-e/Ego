# SEC-06 — Auditoría inmutable gov/audit (continuar, no reiniciar)

> Contrato: cada comando/archivo/aprobación con SHA-256 + Sub-Ego ID, verificable por test.
> Estado previo (punto de partida verificado 2026-10-13, NO rehacer):
> - ✅ `ToolExecutionLoop` emite `tool.started/failed` + `approval.required/resolved` al EventBus.
> - ✅ `DecisionAuditor` persiste veredictos en `gov/audit` (con `sub_ego` en metadata, SIN digest SHA-256).
> - ✅ `RunRecorder` persiste snapshots en `projects/<id>/runs` (SIN espejo en `gov/audit`, SIN digest).
> - ✅ `SessionCheckpointPolicy.beforeToolDispatch` registra `tool_dispatch:<callId>` pending en `gov/audit` (SIN digest, SIN subEgoId).
> - ✅ `EgoMemoryAdapter.recordAudit/promote/supersede` + `EgoMemoryLifecycle` + `SubEgoRegistry` escriben en `gov/audit` (SIN digest, SIN subEgoId).
> - ✅ `ApprovalEngine.computeActionIdentity` calcula `inputDigest` SHA-256 + subEgo, pero NUNCA persiste a `gov/audit` (hueco total).
> - ✅ F2T5 audita ciclo de vida en `kb/audit` (fuera de alcance gov/audit, no tocar).

## Huecos a cerrar (solo esto + tests; prohibido motores, renderer, .agents)

- [x] H1 `recordAudit`: incluir `sha256` (canónico) + `subEgoId`, retornar key, `verifyAuditPayload`
- [x] H2 `promote`/`supersede`: enrutar auditoría por `recordAudit` (heredan digest+subEgo)
- [x] H3 `beforeToolDispatch`: `options {subEgoId, args}` + `sha256`/`sub_ego` en payload y metadata
- [x] H4 `DecisionAuditor.recordVerdict`: `verdictDigest` SHA-256 en payload + metadata
- [x] H5 `ApprovalEngine`: `auditSink` (requested/resolved/timed_out/aborted) con `inputDigest`+`subEgoId`, best-effort
- [x] H6 `RunRecorder.finishRun`: espejo best-effort en `gov/audit` con digest del snapshot + `subEgoId`

## Verify (§6 plan)

- Suites de paquetes tocados → PASS (`memory`, `execution`, `tasks`, `decision`)
- Typechecks → exit 0
- Sin commit (ego-worker)

## Rollback

Cambios aditivos/compatibles; revert por archivo. `recordAudit` mantiene firma posicional con params opcionales.

## Verify (2026-10-13, sin commit)

- memory: 15 files / 79 tests PASS + typecheck exit 0 (incl. nuevo `test/audit-immutable.test.ts`, 5 tests)
- execution: 8 files / 41 tests PASS + typecheck exit 0 (incl. nuevo `test/ApprovalAuditSink.test.ts`, 3 tests)
- tasks: 13 files / 51 tests PASS + typecheck exit 0 (H6 en `RunRecorder.test.ts`)
- decision: 9 files / 37 tests PASS + typecheck exit 0 (H4 en `DecisionAuditor.test.ts`)
- subegos (consumidor de `recordAudit`): 13 files / 146 tests PASS + typecheck exit 0
- Fixes propuestos: ninguno (sin hallazgos fuera de alcance).
