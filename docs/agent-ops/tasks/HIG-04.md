# HIG-04 — Lectura quarantine-aware en `system/snapshots`

- **Estado:** ✅ COMPLETED (código+tests; commit pendiente del orquestador)
- **Plan:** `docs/agent-ops/plans/2026-10-13-plan-deuda-residual.md` (Task 4)
- **Archivos clave:** `packages/dailystate/src/DailyStatePersistence.ts`, `packages/memory/QuarantineAwareReads.ts`, `packages/memory/SensitiveNamespaces.ts`
- **Contrato:** lectura de snapshots vía cuarentena + test cold-reboot + suites dailystate verdes.
- **Skills:** `test-driven-development`, `systematic-debugging` (pinned) + base `campaign-executor`.
- **SDP:** pinned-fijo por el dispatch (TDD + systematic-debugging) + base campaign-executor.

## Blast Radius

- **Callers de `DailyStatePersistence`:** `isFirstLaunchOfDay` (ritual COUC-06, cold-boot), `getSnapshot`, `listSnapshots`, `saveSnapshot` (write path — NO se toca: el enforcement decide el destino).
- **Callees nuevos:** `getQuarantineAware` / `listQuarantineAware` (`packages/memory/QuarantineAwareReads.ts`, ya exportados por `@ego/memory/index.ts`) — misma vía que `SessionCheckpointPolicy.loadCheckpoint/listCheckpoints` (patrón probado SEC-09 FIX-01).
- **Efecto del retiro del diferimiento:** `EgoMemoryAdapter.put` (`EgoMemoryAdapter.ts:409`, `isEnforcementDeferred`) enrutará `system/snapshots*` a `quarantine/pending` en lugar de live+aviso. Sin esta task, `DailyStatePersistence` quedaría ciega (get solo live → null → `isFirstLaunchOfDay` siempre true, snapshots invisibles).
- **Tests colaterales:** `packages/memory/test/sensitive-quarantine.test.ts` (2 tests afirman el diferimiento — actualización obligatoria, mismo commit) y `sec09-fix-followup.test.ts` (no toca el diferimiento: usa `adapter.quarantine` directo — sin cambios).

## Contrato

```text
pnpm --filter @ego/dailystate test  → PASS (incl. cold-reboot vía cuarentena)
pnpm --filter @ego/dailystate typecheck → exit 0
```

## Spec (decisiones cerradas por evidencia, sin Gate D abierto)

| Decisión | Opción elegida | Evidencia |
|---|---|---|
| Vía de lectura | `getQuarantineAware` / `listQuarantineAware` compartidos (SEC-09 FIX-01) | `SessionCheckpointPolicy.ts:202-238` usa el mismo patrón contra el mismo namespace raíz |
| Marca de procedencia | NO se propaga `quarantined` en `DailySnapshotRecord` | El tipo Zod es contrato estable (checksum/inmutabilidad); cambiarlo rompería callers fuera del alcance. La lectura encuentra el registro valide su integridad igual en ambas procedencias |
| Write path | Sin cambios | El destino lo decide el enforcement del adapter; `saveSnapshot` sigue escribiendo al namespace lógico |
| Fail-closed checksum | Intacto, idéntico en live y cuarentena | `DailyStatePersistence.ts:79-100,126-127` — la cuarentena es procedencia, no confianza |
| Retiro del diferimiento | Vaciar `QUARANTINE_ENFORCEMENT_DEFERRALS` + historial en el comentario | Último item diferido; `SessionCheckpointPolicy` ya era quarantine-aware, esta task cierra `DailyStatePersistence` |
| `docs/agent-ops/tasks/SEC-09.md` | NO EXISTE como archivo | El diferimiento canónico vive en `SensitiveNamespaces.ts:131-160` (+ Backlog `SEC-09` ya ✅). El "retiro del taskfile" se ejecuta sobre ese comentario + tests |

## Impacto mapeado (Regla 0)

- **Archivos leídos completos:** `DailyStatePersistence.ts` (147L), `QuarantineAwareReads.ts` (216L), `SensitiveNamespaces.ts` (201L), `SessionCheckpointPolicy.ts` (lectura QA §202-238), `DailyStatePersistence.test.ts` (174L), `sec09-fix-followup.test.ts` (patrón cold), `sensitive-quarantine.test.ts` (§126-140, §219-239).
- **Referencias hacia dentro (lo que toco):** `memory.get/list` (2 calls) → `getQuarantineAware/listQuarantineAware`; `QUARANTINE_ENFORCEMENT_DEFERRALS` (1 const) → `[]`; 2 tests en `sensitive-quarantine.test.ts`.
- **Referencias entrantes:** callers de `DailyStatePersistence` fuera de `packages/dailystate` no cambian de firma — veredicto: impacto contenido, sin cambios de API.
- **Veredicto:** edición quirúrgica, 0 cambios de firma pública, 0 `any`.

## Steps de ejecución

- [x] Step 0 — DISCOVERY: task file + blast radius + spec (este archivo).
- [x] Step 1 — RED: tests cold-reboot vía cuarentena en `DailyStatePersistence.test.ts` (4/4 fallaron contra lectura live, ceguera confirmada).
- [x] Step 2 — GREEN: `getSnapshot`/`listSnapshots` vía `getQuarantineAware`/`listQuarantineAware`; dailystate 37/37 + typecheck exit 0.
- [x] Step 3 — Retiro: `QUARANTINE_ENFORCEMENT_DEFERRALS` vaciado + historial en comentario + `sensitive-quarantine.test.ts` (2 tests) y `checkpoint-policy.test.ts` (1 lector live→`loadCheckpoint`); memory 106/106 + typecheck exit 0.
- [x] Step 4 — CIERRE: verify mecánico + bloque RESULTADO (sin commit: worker).

## Registro de cumplimiento / Veredicto

- **Estado:** ✅ COMPLETED (código + tests; commit pendiente del orquestador — worker no commitea).
- **Timestamp:** 2026-10-13T12:47Z
- **Evidencia:** `pnpm --filter @ego/dailystate test` 37/37 PASS · `pnpm --filter @ego/dailystate typecheck` exit 0 · `pnpm --filter @ego/memory test` 106/106 PASS · `pnpm --filter @ego/memory typecheck` exit 0.
- **Diferimiento SEC-09:** RETIRADO — `QUARANTINE_ENFORCEMENT_DEFERRALS = []`, 0 diferimientos pendientes. Nota: `docs/agent-ops/tasks/SEC-09.md` no existe como archivo; el registro canónico del diferimiento era `SensitiveNamespaces.ts:131-160` (+ Backlog `SEC-09` ya ✅ Completada) y ahí se asentó el cierre.
- **Archivos tocados:** `packages/dailystate/src/DailyStatePersistence.ts`, `packages/dailystate/test/DailyStatePersistence.test.ts`, `packages/memory/SensitiveNamespaces.ts`, `packages/memory/test/sensitive-quarantine.test.ts`, `packages/memory/test/checkpoint-policy.test.ts` (+ este task file).
- **Deuda:** ninguna. Rama `EgoMemoryAdapter` de diferidos queda genérica e inalcanzable (sin menciones por namespace: no requiere edición).
