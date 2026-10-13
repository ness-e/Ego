# DIST-08 — Golden Path Beta multi-día (sello release P0-Beta)

| Campo | Valor |
|---|---|
| Estado | ✅ Verificada 2026-10-13 (continuación `ego-chaos`; commit/tag/push pendientes del lead) |
| Ruta | ego-chaos (solo esta task) |
| Contrato | Suite multi-día en verde, 0 regresiones. Sello release. Roadmap §Golden Path P0-Beta + Backlog `DIST-08` (`docs/roadmap/Backlog.md:483`) |
| SDP | `test-driven-development`, `systematic-debugging` (fijadas por task). Sin SDP extra (sin pinned) |
| Plan | `docs/agent-ops/plans/2026-10-13-plan-deuda-residual.md` §Task 13 |

## DISCOVERY (zero-code planning)

### Archivos leídos (completos)

- `docs/agent-ops/plans/2026-10-13-plan-deuda-residual.md` §Task 13 (contrato) + recitations (estado IN PROGRESS).
- `.agents/task-system/prompts/pipeline-full.md` (flujo DISCOVERY → EJECUCIÓN → CIERRE + RESULTADO §7).
- `tests/e2e/golden-path-alpha-full.test.ts` (20 pasos, promote supervisado, Canvas, auditoría — patrón a extender).
- `tests/e2e/mvp-software-loop.test.ts` (HITL vía `ToolExecutionLoop` `SIMULATE_TOOL`, cold reboot — patrón a extender).
- `tests/e2e/golden-path-alpha.test.ts`, `subegos-delegation.test.ts`, `canvas-interaction.test.ts` (DelegationRouter canónico, SharedMemory, budget, lessons, ChangeSet).
- `docs/roadmap/roadmap.md` §Golden Path P0-Beta (alcance: proyecto real varios días, multi-dominio, Sub-Egos colaboran, Tools + Background Tasks, Daily State, HITL).
- `docs/agent-ops/tasks/DIST-07.md` (patrón taskfile).
- `.agents/references/testing-patterns.md`, `.agents/references/definition-of-done.md` (leídas).
- `packages/dailystate/src/DailyStatePersistence.ts` + `types.ts` + `index.ts` (API snapshots quarantine-aware HIG-04).
- `packages/tasks/src/BackgroundEngine.ts` + `types.ts` (`submit`/`getTask`, `TaskDefinition.execute`).
- Firmas `EgoMemoryAdapter` (`put`/`get`/`promote`/`searchMulti`/`close`) y `package.json` de `@ego/tasks`/`@ego/memory` (resolución `dist/`).
- `§Protocolo C01/C02 (10 pasos)`: no existe en el repo (grep `C01|C02|Protocolo` en `docs/agent-ops` sin match canónico); se ejecuta el flujo canónico `pipeline-full.md` como protocolo vigente y se registra aquí.

### Impacto mapeado (Regla 0)

- Archivos leídos completos: los de arriba. Ningún `src/` modificado.
- Referencias hacia dentro: la suite nueva importa solo `dist/` construido + `@ego/decision`/`@ego/ui-runtime` (patrones ya typecheckeados en HIG-01); no crea dependencias nuevas.
- Referencias entrantes: ninguna (archivo nuevo; Backlog `DIST-08` apunta a su ruta, se satisface al existir).
- Veredicto: creación acotada a `tests/e2e/golden-path-beta.test.ts` + este taskfile; edición de 1 celda en Backlog (`DIST-08` → ✅, autorizada solo con gate en verde). CERO `src/`, CERO `.agents/**`, CERO deps, CERO features inventadas.

### Gate D (Zero Silent Assumptions)

Sin canal interactivo al owner; se aplica la recomendada y se registra:

1. **Fixtures solo temporales `os.tmpdir()`** (Recomendado ✅ aplicado) vs seeds en repo (descartado — contamina árbol).
2. **Días simulados con fechas fijas 2026-10-11/12/13 + `Date.now()` real** (Recomendado ✅ aplicado) vs reloj mockeado (descartado — `testing-patterns.md` desaconseja mockear tiempo salvo necesidad).
3. **Escrituras sensibles con `promote` + lecturas quarantine-aware** (Recomendado ✅ aplicado) vs leer live sin promote (descartado — violaría SEC-09/HIG-04).
4. **Un `it` principal multi-día + un `it` de gobernanza, con `beforeEach`/`afterEach` frescos** (Recomendado ✅ aplicado) vs N its con estado compartido (descartado — anti-pattern shared mutable state).
5. **Bug real en `src/` → BLOQUEO con evidencia, no fix** (regla owner, no disparada: no se encontró bug).

### Spec (decisiones por evidencia)

| # | Decisión | Evidencia / fundamento |
|---|---|---|
| S1 | Imports vía `../../packages/*/dist/index.js` + `@ego/decision`/`@ego/ui-runtime` bare | Patrones `mvp-software-loop` y `golden-path-alpha-full`, ambos en verde tras HIG-01 |
| S2 | HITL vía `ToolExecutionLoop` `SIMULATE_TOOL:fs_write_file` + `ApprovalEngine.resolveApproval` | Patrón `mvp-software-loop` pasos 4 (poll 50ms × 50, `status: "completed"`) |
| S3 | Delegación vía `DelegationRouter` canónico `{task, input}` + executor (spec→budget→lesson→findings) | Patrón `subegos-delegation` (incluye `delegate:*` en el emisor — hallazgo verify, ver §Evidencia) |
| S4 | Canvas vía `CanvasBridge` + `ChangeSet origin:"user"` + `CanvasPersistenceManager.serialize` en `workspace` | Patrón `golden-path-alpha-full` pasos 15-17 |
| S5 | Daily snapshots vía `DailyStatePersistence.saveSnapshot/getSnapshot/listSnapshots/isFirstLaunchOfDay` | HIG-04 quarantine-aware; checksum SHA-256 fail-closed |
| S6 | Background vía `BackgroundEngine.submit({execute})` + poll `getTask` → `completed` | API verificada `packages/tasks/src/BackgroundEngine.ts:70-96,335` |

## Steps

1. ✅ Crear `tests/e2e/golden-path-beta.test.ts` (día 1: proyecto + 3 Sub-Egos + HITL + background + snapshot; día 2: reboot + delegación + 2º HITL + Canvas + snapshot; día 3: sello acumulado; + `it` gobernanza ciclo).
2. ✅ Typecheck `pnpm --filter @ego/e2e-tests typecheck` exit 0 (4 errores iniciales → fix mínimo, ver §Evidencia).
3. ✅ Suite nueva 2/2 + `pnpm test:e2e` 47/47 (45 + 2), 0 regresiones.
4. ✅ Crear este taskfile + Backlog `DIST-08` → ✅ con evidencia + RESULTADO §7 (commit/tag/push del lead).

## EJECUCIÓN

- Step 1: suite creada (~730 líneas, solo fixtures temporales). ✅
- Step 2: typecheck inicial 4 errores (3× `noUnusedLocals` día 1 + `budget possibly undefined` + cast unión `props`); fix mínimo sin tocar `src/`. Re-run exit 0. ✅
- Step 3: primer run 1 failed con causa raíz identificada (`DelegationPermissionError`: emisor `ego.beta-product` sin `delegate:*` — invariante real del `DelegationRouter`, no bug: el orquestador de referencia sí lo tiene). Fix mínimo: `permissions: ["delegate:*", ...]` en el manifiesto emisor. Re-run 2/2; full 47/47. ✅

## FIX_PROPUESTO

Ninguno (test-only; el único fallo fue invariante de permisos documentada, resuelta en el fixture).

## Review

- Tier: Fast (solo `tests/e2e/golden-path-beta.test.ts` + taskfile + 1 celda Backlog; sin `src/`, sin IPC, sin `.agents/**`, sin deps).
- Verify mecánico: typecheck exit 0 + `pnpm test:e2e` 47/47 + 0 archivos fuera del blast radius. Veredicto: PASS.

## Evidencia

- `pnpm --filter @ego/e2e-tests typecheck` → exit 0 (tras fix §EJECUCIÓN).
- `pnpm test:e2e` → `Test Files 9 passed (9)` / `Tests 47 passed (47)` (45 preexistentes + 2 nuevos DIST-08).
- Fallo intermedio documentado: `DelegationPermissionError: Sub-Ego emisor 'ego.beta-product' no tiene permiso para delegar` → fix fixture `delegate:*` (línea manifiesto product).
- `git status --short` (a verificar por el lead al commitear): solo `tests/e2e/golden-path-beta.test.ts` + este taskfile + 1 celda `Backlog.md`; CERO `src/`, CERO `.agents/**`.

## BLOQUEO

Ninguno (gate en verde; no se encontró bug real en `src/`).

## Rollback

`git revert` del commit del lead (archivos nuevos aislados + 1 celda Backlog). Sin migraciones ni datos.
