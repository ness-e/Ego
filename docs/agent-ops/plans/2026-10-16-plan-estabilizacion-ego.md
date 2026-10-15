# Plan de Ejecución: Estabilización Ego + brechas auditadas subagentes

> **Inicio:** 2026-10-16
> **Estado:** ⏳ EN PROGRESO
> **Fuente:** docs/roadmap/Backlog.md + auditorías subagentes 2026-10-15/16 (stack, testing, docs/dist, agentes/contexto, motion/UX, repos-referencia) + conversación puntos 1-6
> **Autonomous:** false
> **Campaign ID:** STAB-2026-10-16

## Resumen

| Resultado | Count |
|-----------|-------|
| ✅ DO | 17 |
| 🟡 DEFER | 0 |
| ❌ SKIP | 0 |
| 🔴 BLOQUEADO | 0 (3 owner-gated dentro de STAB-16) |

Status: ⬆️ uphill = 5 (firma certs, Electron 44 ABI VantaDB, DB real CI prebuilt, site docs, staged rollout) · ⬇️ downhill = 17 tasks pendientes (ver § Waves)

Waves paralelas (FAIL_MODE=parallel, MAX_CONCURRENT=3 Windows):
- Wave 0: STAB-00, STAB-01 (review + drift, sin código prod, archivos distintos)
- Wave 1 P0: STAB-02, STAB-03, STAB-04 (archivos distintos: security / main+PromptAssembly / DelegationRouter+loop)
- Wave 2 P0: STAB-05, STAB-06, STAB-07 (memory lifecycle / tasks+worktree / CI+tests)
- Wave 3 P1: STAB-08, STAB-09, STAB-10 (RTL / main-split+lazy / Tailwind+motion-tokens)
- Wave 4 P1: STAB-11, STAB-12, STAB-13 (CI matrix+visual / MCP+hooks+CAS+curator / UX modal+composer+targets)
- Wave 5: STAB-14 (referencia adaptaciones), STAB-15 (docs enforcement+Diátaxis), STAB-16 (DIST owner-gated, docs-only sin certs)

Regla DAG: Wave N+1 arranca si Wave N ✅ o con FAILED aislado no bloqueante. STAB-16 nunca bloquea waves.

## Tasks

### Task 1: STAB-00 — Revisión global consistencia + funciona
- **Estado:** ✅ COMPLETED (commit `4f294d9`; review ego-audit approve 2026-10-16 con 2 file:line corregidos; fallo 44 tests `VantaError connect` preexistente → STAB-07)
- **Appetite:** max 1d
- **Esfuerzo:** 🟡 1d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `docs/roadmap/Backlog.md`, `AGENTS.md`, `apps/desktop/AGENTS.md`, `docs/engineering/stack-tecnico.md`, `docs/adr/0001-electron-vite.md`, `apps/desktop/package.json`, `apps/desktop/electron.vite.config.ts`, `apps/desktop/src/main.ts`, `apps/desktop/src/ipc/schema.ts`, `packages/memory/EgoMemoryAdapter.ts`, `.github/workflows/ci.yml`
- **Verificación real:** ✅ CÓDIGO-REAL — Backlog 148/151 con DIST-04/06/09 pendientes; `electron-vite ^5.0.0` en package + config real vs `AGENTS.md:9` que lo niega; `ipc.ts` 61+7 1:1; `SharedMemory leases Map` volátil; `handleLlmStream` sin `PromptAssembly`; `tests/gui` mayoría skip honesto; `ci.yml` stub VantaDB + single ubuntu.
- **Gate Justificación:** Sin foto global no se puede fijar DoD ni waves; es precondición de todo el plan.
- **Gate Result:** ✅ DO
- **Contrato:** `pnpm typecheck` 0 errores + `pnpm --filter @ego/desktop test` verde + matriz existe/falta con file:line por área + `docs/index.md` gaps listados
- **Task file:** `docs/agent-ops/tasks/STAB-00.md`
- **Estado:** ⬜ PENDING
- **Branch:**
- **Commit:**
  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta | Trigger / Due |
  |--------------|--------|-------------|---------------|
  | 🟡×🔴 | Revisión superficial que declara OK sin evidencia | Exigir file:line por afirmación + `check_index_coverage` | 1 iteración sin verdes |
  | 🟢×🟡 | Plan file >200 líneas | Este plan es el único vivo; archivar planes viejos | Al cerrar |
  - **Cynefin:** 🟨 complicado — requiere expertos multi-área para decidir alcance
  - **Top 3 riesgos:** 1. evidencia sin mecánica 2. duplicar Backlog 3. drift no registrado
  - **Pre-mortem:** 1. Se audita texto no código 2. Se omite DIST owner-gate 3. Se mezcla % con certidumbre
  - **Stop conditions:** Appetite >1d → DEFER resto; premisa invalidada (Backlog cambia) → re-triage
  - **Uphill/Downhill:** ⬆️ 2 (alcance real por área, certs) / ⬇️ matriz + waves
  - **DoD multi-nivel:** task: matriz + verifies; commit: `docs:` atómico; release: N/A docs-only

### Task 2: STAB-01 — Drift electron-vite AGENTS/ADR/stack
- **Estado:** ✅ COMPLETED (commit `c0a30f2`, build:verify verde; review ego-audit approve 2026-10-16, append-only verificado)
- **Appetite:** max 1h
- **Esfuerzo:** 🟢 1h
- **Prioridad:** 🔴 P0
- **Archivos clave:** `AGENTS.md:9`, `docs/adr/0001-electron-vite.md:17-24`, `docs/engineering/stack-tecnico.md:17`, `apps/desktop/package.json:45`, `apps/desktop/electron.vite.config.ts:1-68`, `README.md:51`
- **Verificación real:** ✅ CÓDIGO-REAL — `electron-vite ^5.0.0` instalado + config `main/preload/renderer out/` real; `AGENTS.md:9` dice NO migrado; ADR-0001 dice descartada. Contradicción a 4 bandas.
- **Gate Justificación:** Ningún agente sabe cuál pipeline es verdad; bloquea todos los builds mentales.
- **Gate Result:** ✅ DO
- **Contrato:** `grep -n electron-vite AGENTS.md docs/adr/0001-electron-vite.md` muestra canónico T11 + `pnpm --filter @ego/desktop build:verify` verde
- **Task file:** `docs/agent-ops/tasks/STAB-01.md`
- **Estado:** 🟡 REVIEW-PENDIENTE (3/3 steps ✅ + build:verify verde + commit `c0a30f2` local; falta veredicto ego-audit P2-01)
- **Branch:**
- **Commit:**
  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta | Trigger / Due |
  |--------------|--------|-------------|---------------|
  | 🟢×🔴 | Editar AGENTS raíz sin autoridad owner | Solo texto T11 + traza package:45, sin cambiar guardrails | review ego-audit |
  - **Cynefin:** 🟦 obvio — causa-efecto claro
  - **Top 3 riesgos:** 1. ADR append-only violado (editar vs supersede) 2. README olvido 3. build:verify rojo
  - **Pre-mortem:** 1. Se reescribe ADR en vez de supersede 2. Se toca pipeline real 3. Se rompe formato
  - **Stop conditions:** Si `build:verify` falla → STOP Gate V
  - **Uphill/Downhill:** ⬆️ 0 / ⬇️ 3 edits + verify
  - **DoD multi-nivel:** task: greps + verify; commit: `docs:`; release: N/A

### Task 3: STAB-02 — Permissions deny-gana + terminal hardening
- **Estado:** ✅ COMPLETO (commit `dbd63a5` feat + `4addebf` plan; security 89/89, ipc-zod-coverage 10/10, permissions-policy 13/13; review P2-01 pendiente; pregunta Gate D batcheada: canales `ipc.settings.get/savePermissions` implementados, renombro a `ipc.permissions.*` en follow-up si lo pides)
- **Review:** ✅ approve ego-audit 2026-10-16 (B correcto, tríada 1:1, cero R5; pendiente menor: `path_outside_workspace` explícito bajo allow → follow-up)
- **Appetite:** max 1d
- **Esfuerzo:** 🟡 1d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `packages/security/src/ToolPermissions.ts:23,262-338`, `apps/desktop/src/main.ts:228-264,2448-2458,1898`, `apps/desktop/src/ipc/schema.ts:182-186`
- **Verificación real:** ✅ CÓDIGO-REAL — `evaluateToolCall allow|deny|requireApproval` existe pero sin `defaultMode/additionalDirectories/timeout/cron_mode`; terminal allowlist estrecha + denylist bypasseable por diseño; `ApprovalEngine mode:standard`.
- **Gate Justificación:** Sin deny-gana no hay least-privilege configurable; terminal es el mayor blast radius.
- **Gate Result:** ✅ DO
- **Contrato:** `pnpm --filter @ego/security test` + `pnpm --filter @ego/desktop test -- ipc-zod-coverage` verdes + `evaluateToolCall` orden deny→approval→allow probado + `gov/settings/permissions` persiste
- **Task file:** `docs/agent-ops/tasks/STAB-02.md`
- **Estado:** ✅ COMPLETO (6/6 steps, commit `dbd63a5` local; contrato verde; review P2-01 por agente distinto pendiente → orquestador)
- **Branch:**
- **Commit:**
  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta | Trigger / Due |
  |--------------|--------|-------------|---------------|
  | 🟡×🔴 | Romper `TASK_SAFE_KINDS` y pausar background legítimo | Tests `paused vs directo` por kind | 1 verify rojo |
  | 🟡×🟡 | allowlist MCP decorativa sigue decorativa | Cablear `allowedMcpServers` a evaluate | review audit |
  - **Cynefin:** 🟨 complicado — tradeoffs seguridad vs UX
  - **Top 3 riesgos:** 1. regresión HITL 2. bypass cwd 3. spec incompleta (feature-add → Gate D)
  - **Pre-mortem:** 1. deny rompe flujos 2. timeout sin fallback 3. blast radius >10 archivos
  - **Stop conditions:** Blast >10 → pregunta GO/dividir; 2 verifies mismo error → Gate V
  - **Uphill/Downhill:** ⬆️ 1 (defaultMode valor) / ⬇️ schema+evaluate+tests
  - **DoD multi-nivel:** task/commit/release (API docs si cambia schema)

### Task 4: STAB-03 — Cablear PromptAssembly al turno real
- **Estado:** 🟡 INCOMPLETO (código propio commiteado `98f4947` + hunks main absorbidos por `c087862` ajeno; subegos 177/177, PromptAssembly 22/22, typecheck 0; rojos literales ajenos: DelegationTools WIP STAB-04, FloatingWindow, ipc-contract, golden timeout; review P2-01 pendiente)
- **Review:** ✅ aprobado con observación trazabilidad ego-audit 2026-10-16 (wiring en `c087862` ajeno declarado; no bloqueante)
- **Appetite:** max 1d
- **Esfuerzo:** 🟡 1d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `apps/desktop/src/main.ts:1591-1781,1704-1715`, `packages/subegos/src/SubEgoSoul.ts:435-469`, `packages/subegos/src/PromptAssembly.ts:25-77,235-356`
- **Verificación real:** ✅ CÓDIGO-REAL — `assembleHermesPrompt` existe pero `handleLlmStream` construye system ad-hoc `"Eres Ego..."+contextText`; tiers/EPHEMERAL/OUT_OF_BAND no se ejercen en prod.
- **Gate Justificación:** Sin esto el diseño de caché e inyección es decorativo; riesgo prompt-injection real.
- **Gate Result:** ✅ DO
- **Contrato:** `pnpm --filter @ego/subegos test` + `pnpm --filter @ego/desktop test` verdes + turno usa `assembleHermesPrompt` + `drainSteer→formatOutOfBand` + `assertSystemPromptStable` salvo compression
- **Task file:** `docs/agent-ops/tasks/STAB-03.md`
- **Estado:** ⬜ PENDING
- **Branch:**
- **Commit:**
  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta | Trigger / Due |
  |--------------|--------|-------------|---------------|
  | 🟡×🔴 | Romper caché/prefijo y subir coste | Tests byte-stable + fingerprint | verify rojo |
  - **Cynefin:** 🟨 complicado
  - **Top 3 riesgos:** 1. regresión streaming 2. steer duplicado 3. system mutado mid-turn
  - **Pre-mortem:** 1. EPHEMERAL contamina caché 2. OUT_OF_BAND lookalike obedecido 3. recall duplicado
  - **Stop conditions:** Mismo-error ×2 → Gate V
  - **Uphill/Downhill:** ⬆️ 1 (fingerprint exacto) / ⬇️ wiring+tests
  - **DoD multi-nivel:** task/commit/release (ADR si cambia prompt)

### Task 5: STAB-04 — delegate_task fin-a-fin en ToolExecutionLoop
- **Estado:** ✅ COMPLETO (commit `c8c7b45`; subegos 17f/192t, runtime 11f/60t, typecheck 0; registro en composición main queda futura; review P2-01 pendiente)
- **Review:** ✅ approve ego-audit 2026-10-16 (goal/context, BLOCKED, sin recursión, suites verdes)
- **Appetite:** max 1d
- **Esfuerzo:** 🟡 1d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `packages/subegos/src/DelegationRouter.ts:681-850,911-996`, `packages/runtime/*ToolExecutionLoop*`, `packages/subegos/src/types.ts:53-58,100-101`
- **Verificación real:** ✅ CÓDIGO-REAL — `validateDelegateTaskInput + assertChildToolAllowed + normalizeStructuredOutput + steer/stop/listActive` existen como API, no expuestos como tool del loop.
- **Gate Justificación:** Sin tool no hay delegación real en prod, solo tests.
- **Gate Result:** ✅ DO
- **Contrato:** `pnpm --filter @ego/subegos test` + `pnpm --filter @ego/runtime test` verdes + `delegateTask/delegateMany/steer/stop` invocables con `goal/context` obligatorios y `BLOCKED_CHILD_TOOLS` enforced
- **Task file:** `docs/agent-ops/tasks/STAB-04.md`
- **Estado:** 🟡 REVIEW-PENDIENTE (5/5 steps ✅ + subegos 192t + runtime 60t + typecheck 0 err + commit `c8c7b45` local; falta veredicto review P2-01 por agente distinto)
- **Branch:**
- **Commit:**
  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta | Trigger / Due |
  |--------------|--------|-------------|---------------|
  | 🟡×🔴 | Ciclo recursivo / profundidad infinita | `maxSpawnDepth 0` + `DelegationCycleError` tests | verify rojo |
  - **Cynefin:** 🟨 complicado
  - **Top 3 riesgos:** 1. permisos `delegate:<id>` bypass 2. output no estructurado 3. loop colgado
  - **Pre-mortem:** 1. leaf subdelega 2. steer perdido 3. contrato vago
  - **Stop conditions:** Blast hot path → pregunta
  - **Uphill/Downhill:** ⬆️ 1 (spec tool I/O) / ⬇️ expose+tests
  - **DoD multi-nivel:** task/commit/release (spec SDD obligatoria → Gate D)

### Task 6: STAB-05 — Compresión con thresholds + cleanupPeriod
- **Appetite:** max 1d
- **Esfuerzo:** 🟡 1d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `packages/memory/EgoMemoryLifecycle.ts:98-154,223-332`, `packages/subegos/src/PromptAssembly.ts:413-425`, `packages/tasks/src/BackgroundEngine.ts:54-60`, `packages/subegos/src/SubEgoWorktree.ts:18,96-216`
- **Verificación real:** ✅ CÓDIGO-REAL — `handlePreCompaction→kb/history_archive` existe pero nadie lo llama; sin `threshold/target_ratio/auto_compact`; sin TTL para worktrees/`session/turns`/checkpoints; `cleanExpiredLeases()` manual.
- **Gate Justificación:** Sin esto la memoria crece cuadrático en tokens y disco sin cota.
- **Gate Result:** ✅ DO
- **Contrato:** `pnpm --filter @ego/memory test` + `pnpm --filter @ego/tasks test` verdes + `gov/settings/compression` trigger pre-`toolLoop.run` + job cleanup worktrees/sesiones/leases probado
- **Task file:** `docs/agent-ops/tasks/STAB-05.md`
- **Estado:** ✅ COMPLETED (commit `ce78fb5`; memory 135/135, tasks 59/59; review ego-audit approve 2026-10-16, nits no bloqueantes)
- **Branch:**
- **Commit:**
  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta | Trigger / Due |
  |--------------|--------|-------------|---------------|
  | 🟡×🔴 | Compactar y perder hechos vigentes | `excludeSuperseded` + quarantine-aware + tests close/reopen | verify rojo |
  - **Cynefin:** 🟧 complejo — emerge al experimentar
  - **Top 3 riesgos:** 1. threshold mal calibrado 2. borrado agresivo 3. dream colgado
  - **Pre-mortem:** 1. archive nunca leído 2. TTL mata sesión activa 3. coste no baja
  - **Stop conditions:** Appetite >1d → DEFER curator a STAB-12
  - **Uphill/Downhill:** ⬆️ 2 (thresholds, retención días) / ⬇️ trigger+job+tests
  - **DoD multi-nivel:** task/commit/release

### Task 7: STAB-06 — CAS + projector + curator + reasoning_effort
- **Appetite:** max 1d
- **Esfuerzo:** 🟡 1d
- **Prioridad:** 🟠 P1
- **Archivos clave:** `packages/subegos/src/SharedMemory.ts:485-566,636-683`, `apps/desktop/src/ipc/schema.ts:238-250`, `packages/memory/EgoMemoryLifecycle.ts:306-322`
- **Verificación real:** ✅ CÓDIGO-REAL — `publish version+1` sin CAS; sin projector `retrieve-no-broadcast`; curator solo Hebbiano sin job; `ModelConfig` sin `reasoningEffort/temperature`.
- **Gate Justificación:** Cierra ventanas de conflicto enormes (read-modify-write de minutos) y coste tokens.
- **Gate Result:** ✅ DO
- **Contrato:** tests `VersionConflict` + vista proyectada `{key,version,leaseHolder}` + job curator a `kb/facts` con quarantine + `reasoningEffort low|medium|high` hilado a provider
- **Task file:** `docs/agent-ops/tasks/STAB-06.md`
- **Estado:** ✅ COMPLETED (commit `7a516de`; subegos 212, memory 135, models 80, runtime 69; review ego-audit approve Tier Fast 2026-10-16)
- **Branch:**
- **Commit:**
  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta | Trigger / Due |
  |--------------|--------|-------------|---------------|
  | 🟡×🟡 | CAS rompe writes cooperativos | `expectedVersion?` opcional + fallback lease | review |
  - **Cynefin:** 🟨 complicado
  - **Top 3 riesgos:** 1. projector filtra de más 2. curator promueve basura 3. provider ignora effort
  - **Pre-mortem:** 1. version drift 2. stale read 3. spec pública sin Gate D
  - **Stop conditions:** Símbolos públicos nuevos → spec + pregunta
  - **Uphill/Downhill:** ⬆️ 1 / ⬇️ CAS+projector+curator+schema
  - **DoD multi-nivel:** task/commit/release

### Task 8: STAB-07 — CI DB real + colecta + RTL obligatorio inicio
- **Appetite:** max 1d
- **Esfuerzo:** 🟡 1d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `.github/workflows/ci.yml:29-83`, `apps/desktop/test/ipc.integration.test.ts:53`, `tests/e2e/golden-path-alpha.test.ts:36-45`, `apps/desktop/renderer/test/Omnibar.rtl.test.tsx:20`, `apps/desktop/renderer/test/ApprovalCard.rtl.test.tsx:43`, `docs/engineering/testing-e2e.md:73-78`
- **Verificación real:** ✅ CÓDIGO-REAL — stub `get→null` invalida memoria en `verify`; `EGO_REAL_DB` gated sin job; `tests/gui/specs` colectados por `test:e2e` por error; 2 RTL tras `skipIf(!hasRtl)` verde-falso.
- **Gate Justificación:** Sin DB real el verde CI es falso para memoria; sin RTL el UI se testea por implementación.
- **Gate Result:** ✅ DO
- **Contrato:** job `integration-real-db` con `EGO_REAL_DB=1` + napi prebuilt verde + `pnpm test:e2e` excluye `tests/gui/specs` + RTL sin gate (import estático, falla si falta dep)
- **Task file:** `docs/agent-ops/tasks/STAB-07.md`
- **Estado:** ✅ COMPLETED (commit `3853af9`; RTL 2/2, ipc.integration 5/5, golden 3/3; review ego-audit approve Fast 2026-10-16; CharacterMorph → EGO-FIND-17)
- **Branch:**
- **Commit:**
  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta | Trigger / Due |
  |--------------|--------|-------------|---------------|
  | 🟡×🔴 | Nativo no compila en CI y bloquea todo | Job separado fail-soft inicial, luego hard | 2 fallos → Gate V |
  - **Cynefin:** 🟨 complicado
  - **Top 3 riesgos:** 1. prebuilt ABI 2. RTL instala rompe tsc 3. colecta rompe `test:e2e`
  - **Pre-mortem:** 1. `hasRtl` eliminado sin dep 2. DB real lenta 3. Windows paths
  - **Stop conditions:** Nativo imposible → DEFER a nightly, no bloquear verify
  - **Uphill/Downhill:** ⬆️ 1 (prebuilt) / ⬇️ CI+colecta+RTL
  - **DoD multi-nivel:** task/commit/release (CI)

### Task 9: STAB-08 — Migración RTL sistemática + MSW renderer
- **Appetite:** max 3d
- **Esfuerzo:** 🔴 2-3d
- **Prioridad:** 🟠 P1
- **Archivos clave:** `apps/desktop/renderer/test/App.test.tsx:1-34`, `ApprovalCard.test.tsx`, `ChatAssistantUI.test.tsx`, `CanvasRuntime.test.tsx`, `a11y.test.tsx`, `apps/desktop/test/msw/handlers.ts:1-46`, `apps/desktop/test/fetch-proxy.test.ts:14-72`
- **Verificación real:** ✅ CÓDIGO-REAL — ~25 ficheros `createRoot+act+textContent+setTimeout` anti-RTL; MSW solo main fetch-proxy 200/500/timeout/401, sin renderer/browser, sin 404/DNS/429.
- **Gate Justificación:** Tests por implementación se rompen al refactorizar sin cambio de comportamiento.
- **Gate Result:** ✅ DO
- **Contrato:** `pnpm --filter @ego/renderer test` verde con `render/screen/user-event/getByRole` en App/ApprovalCard/Omnibar/Chat/Canvas + `test/msw/ego-handlers.ts` browser + `Chat.rtl.msw.test` streaming 🧠 ok/error/latencia
- **Task file:** `docs/agent-ops/tasks/STAB-08.md`
- **Estado:** ✅ COMPLETED (commit `0efcc81`; 40f/273t; review ego-audit approve 2026-10-16, notas no bloqueantes)
- **Branch:**
- **Commit:**
  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta | Trigger / Due |
  |--------------|--------|-------------|---------------|
  | 🟡×🟡 | Migración masiva rompe 33 suites | Por archivo, ~100 líneas/commit, `cleanup()` | stall → dividir |
  - **Cynefin:** 🟨 complicado
  - **Top 3 riesgos:** 1. `findBy` flaky 2. WAAPI happy-dom 3. alcance 3d
  - **Pre-mortem:** 1. se migra todo de golpe 2. se pierde MockEgoBridge 3. appetite excedido
  - **Stop conditions:** Appetite 3d → partir en STAB-08a/b
  - **Uphill/Downhill:** ⬆️ 0 / ⬇️ N archivos
  - **DoD multi-nivel:** task/commit/release

### Task 10: STAB-09 — main split + lazy/Suspense + Tailwind estable
- **Appetite:** max 1d
- **Esfuerzo:** 🟡 1d
- **Prioridad:** 🟠 P1
- **Archivos clave:** `apps/desktop/src/main.ts` (4000+L), `apps/desktop/renderer/src/App.tsx:363-370`, `apps/desktop/renderer/vite.config.ts:24-39`, `apps/desktop/renderer/package.json:40,47`
- **Verificación real:** ✅ CÓDIGO-REAL — god-file tray/crypto/providers/hardening/BrowserWindow/61 handlers; 0 `React.lazy` en `renderer/src`; Tailwind beta en ambos package.
- **Gate Justificación:** Mantenibilidad + perf arranque + riesgo build CSS.
- **Gate Result:** ✅ DO
- **Contrato:** `pnpm build` + `build:verify` verdes + `lazy()` Canvas/Daily/SubEgos/Domains con `Suspense skeleton` + Tailwind `v4.x` estable sin `-beta.8`
- **Task file:** `docs/agent-ops/tasks/STAB-09.md`
- **Estado:** ✅ COMPLETED (commit `47780a5`; build+verify verdes, entry 969KB; review ego-audit approve 2026-10-16, re-export selectivo documentado)
- **Branch:**
- **Commit:**
  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta | Trigger / Due |
  |--------------|--------|-------------|---------------|
  | 🟡×🔴 | Split rompe imports circulares | Extraer `windows/csp/ipc/terminal/providers/tray` por módulo con tests | verify rojo → revert por módulo |
  - **Cynefin:** 🟨 complicado
  - **Top 3 riesgos:** 1. lazy rompe tests happy-dom 2. chunk budget 600 3. beta→estable CSS diff
  - **Pre-mortem:** 1. Suspense sin fallback 2. split gigante 3. `manualChunks` desalineado
  - **Stop conditions:** Build rojo ×2 → Gate V
  - **Uphill/Downhill:** ⬆️ 0 / ⬇️ split+lazy+pin
  - **DoD multi-nivel:** task/commit/release

### Task 11: STAB-10 — Motion tokens + transition-all + TS strict
- **Appetite:** max 1d
- **Esfuerzo:** 🟡 1d
- **Prioridad:** 🟠 P1
- **Archivos clave:** `apps/desktop/renderer/src/index.css:1-112`, `apps/desktop/renderer/components/ui-kit/Button.tsx:13`, `components/activity-widget/ActivityWidget.tsx:15`, `components/character/CharacterBadge.tsx:197`, `tsconfig.base.json:1-26`
- **Verificación real:** ✅ CÓDIGO-REAL — 0 `--motion-*`; duraciones `0.18/0.35/450ms` hardcodeadas; 14 `transition-all`; sin `noUncheckedIndexedAccess/exactOptionalPropertyTypes`.
- **Gate Justificación:** Sin tokens el motion diverge; `transition-all` anima props caras; TS laxo esconde bugs.
- **Gate Result:** ✅ DO
- **Contrato:** `pnpm --filter @ego/renderer test` + `typecheck` verdes + `--motion-duration-micro/ui/surface --motion-ease-out/in` + `transition-colors,transform` + `noUncheckedIndexedAccess:true` sin nuevos errores
- **Task file:** `docs/agent-ops/tasks/STAB-10.md`
- **Estado:** ✅ COMPLETED (commits `a1419c5+9be6505`; 273/273; review ego-audit approve con hallazgos 2026-10-16, FIND-1/2 proceso no bloqueantes)
- **Branch:**
- **Commit:**
  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta | Trigger / Due |
  |--------------|--------|-------------|---------------|
  | 🟢×🟡 | TS strict rompe 100+ sitios | Activar solo `noUncheckedIndexedAccess` + fixes acotados | DEFER `exactOptional` |
  - **Cynefin:** 🟦 obvio
  - **Top 3 riesgos:** 1. snapshot visual diff 2. `motion` import 3. alcance
  - **Pre-mortem:** 1. se migra `framer-motion→motion` aquí (no, es STAB-13) 2. se tocan 14 archivos de golpe 3. sin tests
  - **Stop conditions:** Si TS explota → partir
  - **Uphill/Downhill:** ⬆️ 0 / ⬇️ tokens+14 edits+flag
  - **DoD multi-nivel:** task/commit/release

### Task 12: STAB-11 — Matrix 3 SO + artefactos + nightly + visual
- **Appetite:** max 1d
- **Esfuerzo:** 🟡 1d
- **Prioridad:** 🟠 P1
- **Archivos clave:** `.github/workflows/ci.yml:10-165`, `tests/gui/playwright.config.ts:10-18`, `tests/gui/electron/electron.playwright.config.ts:12-29`, `tests/gui/electron/shell.electron.ts:69-115`, `docs/engineering/testing-e2e.md:97-111`
- **Verificación real:** ✅ CÓDIGO-REAL — solo `ubuntu-latest`, Xvfb crudo, sin `strategy.matrix`, sin `upload-artifact`, `retries 0` Electron, 0 `toHaveScreenshot`, 0 `schedule cron`.
- **Gate Justificación:** Sin matrix los bugs de plataforma escapan; sin artefactos no hay forense; sin nightly no hay lifecycle.
- **Gate Result:** ✅ DO
- **Contrato:** `ci.yml` con matrix `[ubuntu,windows,macos]` e2e-electron (fail-soft win/mac inicial) + `xvfb-run -a` + artefactos `playwright-report/test-results/lcov` + `nightly.yml cron` + 3 `toHaveScreenshot` chromium pinneado `maxDiffRatio 0.02`
- **Task file:** `docs/agent-ops/tasks/STAB-11.md`
- **Estado:** ✅ COMPLETED (commit `18fa1bc`; matrix+nightly+coverage+visual 3/3; review ego-audit approve 2026-10-16)
- **Branch:**
- **Commit:**
  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta | Trigger / Due |
  |--------------|--------|-------------|---------------|
  | 🟡×🟡 | Win/mac rojos bloquean todo | fail-soft inicial + TODO hard | Gate V |
  - **Cynefin:** 🟨 complicado
  - **Top 3 riesgos:** 1. runners costosos 2. baselines por-OS 3. flaky visual
  - **Pre-mortem:** 1. snapshots DirectWrite vs CoreText 2. timeouts SO 3. artefactos gigantes
  - **Stop conditions:** Coste/tiempo >1d → DEFER visual a P2
  - **Uphill/Downhill:** ⬆️ 1 (pin chromium) / ⬇️ CI+nightly+3 shots
  - **DoD multi-nivel:** task/commit/release (CI)

### Task 13: STAB-12 — MCP http + hooks + handoff/fork
- **Appetite:** max 1d
- **Esfuerzo:** 🟡 1d
- **Prioridad:** 🟠 P1
- **Archivos clave:** `apps/desktop/src/ipc/schema.ts:148-158`, `packages/integrations/src/mcp/*McpClient.ts:70,328-334`, `packages/security/src/ToolPermissions.ts`, `packages/memory/EgoMemoryAdapter.ts`
- **Verificación real:** ✅ CÓDIGO-REAL — `transport stdio|sse` solo, `McpClient` stdio duro; sin `allowedMcpServers` efectiva; sin hooks `pre/postToolUse`; sin `session.fork`/handoff formal; `scratchpad:Map` RAM.
- **Gate Justificación:** Sin http se pierde ecosistema MCP remoto; sin hooks no hay auditabilidad; sin fork no hay continuación.
- **Gate Result:** ✅ DO
- **Contrato:** tests `streamable-http` + `allowedMcpServers` enforced + hooks fail-closed registrados `gov/audit` + `session.fork` copia `session/turns` + handoff validado
- **Task file:** `docs/agent-ops/tasks/STAB-12.md`
- **Estado:** ✅ COMPLETED (commit `a66b7f4`; http 27/27, hooks, fork; review ego-audit approve 2026-10-16)
- **Branch:**
- **Commit:**
  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta | Trigger / Due |
  |--------------|--------|-------------|---------------|
  | 🟡×🔴 | SSRF vía http remoto | `net-policy` localhost/169.254 bloqueado + tests | audit review |
  - **Cynefin:** 🟧 complejo
  - **Top 3 riesgos:** 1. superficie pública nueva (Gate D) 2. secrets en env 3. fork copia parcial
  - **Pre-mortem:** 1. spec sin decisiones 2. hook lanza y cuelga 3. blast >10
  - **Stop conditions:** Símbolos públicos → spec + pregunta antes ACT
  - **Uphill/Downhill:** ⬆️ 2 (transport, fork semántica) / ⬇️ impl+tests
  - **DoD multi-nivel:** task/commit/release (spec SDD)

### Task 14: STAB-13 — UX motion/Modal/composer/targets/omnibar
- **Estado:** ✅ COMPLETED (commit `d3d0aee`; 41f/281t, Stab13 8/8 + a11y 15/15 re-verificados; review ego-audit approve 2026-10-16)
- **Appetite:** max 1d
- **Esfuerzo:** 🟡 1d
- **Prioridad:** 🟠 P1
- **Archivos clave:** `apps/desktop/renderer/components/ui-kit/Modal.tsx:39-71`, `components/ego-chat.tsx:944-959,45-48,88-104,869-884`, `components/omnibar.tsx:184-235`, `components/activity-widget/ActivityWidget.tsx:115-120`
- **Verificación real:** ✅ CÓDIGO-REAL — Modal sin `AnimatePresence` salida; swap Send/Cancel sin crossfade; burbujas sin copy-confirm; targets `24px`/`p-1`; `autoFocus` nativos; `aria-live` huérfano omnibar + Button.
- **Gate Justificación:** Diferencia premium vs barato; a11y WCAG 2.2 AA.
- **Gate Result:** ✅ DO
- **Contrato:** `pnpm --filter @ego/renderer test` + `a11y.test` verdes + Modal fade+scale con reduced-motion + `layoutId composer-action` + copy-confirm + targets 44px + omnibar `role=option+aria-selected+activedescendant+↑↓`
- **Task file:** `docs/agent-ops/tasks/STAB-13.md`
- **Estado:** ✅ COMPLETED (ver review approve; residual icon-only p-1 → FIND follow-up STAB-14/next)
- **Branch:**
- **Commit:**
  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta | Trigger / Due |
  |--------------|--------|-------------|---------------|
  | 🟢×🟡 | Snapshot a11y cambia | Actualizar invariantes a propósito, no blobs | review |
  - **Cynefin:** 🟦 obvio
  - **Top 3 riesgos:** 1. foco robado 2. animación jank 3. teclado roto
  - **Pre-mortem:** 1. `layoutId` crossfade salta 2. 44px rompe layout 3. `autoFocus` quitado rompe tests
  - **Stop conditions:** N/A
  - **Uphill/Downhill:** ⬆️ 0 / ⬇️ modal+composer+targets+omnibar
  - **DoD multi-nivel:** task/commit/release

### Task 15: STAB-14 — Adaptaciones repos-referencia aptas
- **Appetite:** max 3d
- **Esfuerzo:** 🔴 2-3d
- **Prioridad:** 🟠 P1
- **Archivos clave:** `repos-referencia/coucou/...HookServer.swift`, `repos-referencia/openclaw/src/agents/admitted-run-context.ts`, `repos-referencia/khoj/src/khoj/processor/content/text_to_entries.py`, `packages/events/src/EventNormalizer.ts`, `packages/execution/src/*`, `packages/knowledge/src/chunking/*`, `packages/security/src/net-policy.ts`, `packages/tasks/src/WorkerPolicy.ts`
- **Verificación real:** ✅ CÓDIGO-REAL — Compuertas Opción B exigen Asimilar/Adaptar/Descartar; fichas `docs/extractions/*.md` + `docs/review/backlog-*.md` con patrones sin portar: ApprovalIdentity, InteractionTransport+admit, Attention FSM, SafeConfigMutation+fingerprint, ChangeSet payloadRef, net-policy SSRF, worker pool, AdaptiveChunker 256+dedup, FileLockManager wx+PID.
- **Gate Justificación:** Es el “aplicar todo lo apto” que pide el usuario; sin esto la investigación se pierde.
- **Gate Result:** ✅ DO
- **Contrato:** por patrón: `ApprovalIdentity.ts` + test decisión cruzada rechazada; `InteractionTransport.ts` + fallback sin bloqueo; `AttentionStateMachine.ts`; `SafeConfigMutationService.ts preview/confirm/apply/rollback`; `ChangeSetService.ts`; `net-policy.ts` URLs prohibidas bloqueadas; `WorkerPolicy.ts`; `AdaptiveChunker.ts→kb/docs`; `FileLockManager.ts` con tests portados + `pnpm test` verde + ADRs por decisión
- **Task file:** `docs/agent-ops/tasks/STAB-14.md`
- **Estado:** ⬜ PENDING
- **Branch:**
- **Commit:**
  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta | Trigger / Due |
  |--------------|--------|-------------|---------------|
  | 🟡×🔴 | Importar dominio ajeno (ATS/scrapers) | Guardrail AGENTS §4: solo ingeniería, descarte justificado | audit |
  | 🔴×🔴 | Licencias referencia | Solo patrones, nunca copiar código; reimplementar TS | review legal |
  - **Cynefin:** 🟧 complejo — probe-sense-respond por patrón
  - **Top 3 riesgos:** 1. alcance 3d 2. Python/SQLite tentación 3. deuda
  - **Pre-mortem:** 1. se copia código 2. se trae FastAPI/SQLite 3. se rompe VantaDB-primero
  - **Stop conditions:** Appetite 3d → partir 14a (coucou/openclaw) /14b (khoj/career)
  - **Uphill/Downhill:** ⬆️ 3 / ⬇️ 8 servicios+tests
  - **DoD multi-nivel:** task/commit/release (ADR por patrón)

### Task 16: STAB-15 — Docs enforcement + Diátaxis + empresa
- **Appetite:** max 1d
- **Esfuerzo:** 🟡 1d
- **Prioridad:** 🟡 P2
- **Archivos clave:** `package.json:11-31`, `cliff.toml:1-4`, `CONTRIBUTING.md:45-63`, `docs/index.md:1-90`, `docs/user/getting-started.md`, `.github/workflows/docs-lint.yml`
- **Verificación real:** ✅ CÓDIGO-REAL — sin husky/commitlint/lint-staged; `docs/index` omite `user/design/adr/deployment`; Diátaxis de facto sin etiquetado; 0 GIFs; sin site build; sin CODE_OF_CONDUCT.
- **Gate Justificación:** Sin enforcement release-please consume historial sucio; sin Diátaxis la doc no escala a empresa.
- **Gate Result:** ✅ DO
- **Contrato:** `git log --oneline` convencional verificado por hook + CI falla ante mensaje no-convencional + `docs/index` 4 secciones + front-matter Diátaxis + 3 GIFs + decisión site VitePress documentada
- **Task file:** `docs/agent-ops/tasks/STAB-15.md`
- **Estado:** ✅ COMPLETED (commit `9c43a6c` local; hooks+CI+index+Diátaxis+3 GIFs+site+CoC+upstream+deprecación; review P2-01 por agente distinto pendiente → orquestador)
- **Branch:**
- **Commit:**
  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta | Trigger / Due |
  |--------------|--------|-------------|---------------|
  | 🟢×🟡 | Husky rompe commits Windows | `commit-msg` mínimo + docs | revert hook |
  - **Cynefin:** 🟦 obvio
  - **Top 3 riesgos:** 1. GIFs pesados 2. site sobredimensionado 3. alcance
  - **Pre-mortem:** 1. se elige Docusaurus pesado 2. se reescribe docs 3. se olvida ADR
  - **Stop conditions:** N/A
  - **Uphill/Downhill:** ⬆️ 1 (site) / ⬇️ hooks+index+GIFs
  - **DoD multi-nivel:** task/commit/release

### Task 17: STAB-16 — DIST-04/06/09 owner-gated (docs-only)
- **Appetite:** max 1h
- **Esfuerzo:** 🟢 1h
- **Prioridad:** 🔴 P0 (bloqueado)
- **Archivos clave:** `docs/roadmap/Backlog.md:476-484`, `apps/desktop/electron-builder.config.cjs:32-52`, `apps/desktop/src/updater.ts:183-191`, `docs/deployment/distribution.md:42-76,105-126`
- **Verificación real:** ✅ CÓDIGO-REAL — `publish` comentado deliberado, `downloadUpdate→deferred`, `sign.mjs` inexistente, certs ausentes. Sin certs no hay ejecución posible.
- **Gate Justificación:** Deja el camino firmable sin fingir firma; desbloquea waves al no bloquear.
- **Gate Result:** ✅ DO (docs-only, BLOQUEADO para código)
- **Contrato:** `scripts/release/sign.mjs` spec + secretos `APPLE_ID/WIN_CERT` documentados + `publish` por canal listo para descomentar + staged `prerelease→latest` + `SHASUMS.txt` + checklist unsigned — sin tocar `publish` activo ni añadir `electron-updater`
- **Task file:** `docs/agent-ops/tasks/STAB-16.md`
- **Estado:** ✅ COMPLETED docs-only (commit pendiente; code BLOQUEADO hasta certs owner — owner-gate vigente)
- **Branch:**
- **Commit:**
  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta | Trigger / Due |
  |--------------|--------|-------------|---------------|
  | 🔴×🔴 | Fingir firma sin certs | Prohibido: docs-only, `publish` sigue comentado | owner gate |
  - **Cynefin:** ⬛ caótico si se intenta sin certs → DEFER código
  - **Top 3 riesgos:** 1. updater sin firma 2. AppImage sin auto-update 3. SmartScreen/Gatekeeper
  - **Pre-mortem:** 1. se añade electron-updater sin firma 2. se descomenta publish 3. se suben secrets
  - **Stop conditions:** Sin certs → solo docs, nunca código firma
  - **Uphill/Downhill:** ⬆️ 3 (certs, VM limpia, pin VantaDB) / ⬇️ spec+checklist
  - **DoD multi-nivel:** task (docs) / commit `docs:` / release N/A

## Notas
- plan-adjust: ninguna aún.
- Gate P 2026-10-16: usuario GO plan completo; STAB-02 defaultMode=deny fail-closed; STAB-05 threshold 70% + target 40% + cleanup 30d; STAB-14 completo con ADRs; STAB-16 docs-only sin publish/updater hasta certs owner.
- Recitation: plan creado 2026-10-16 desde auditorías subagentes; Gate P ✅ resuelto. Wave 0 en curso: STAB-00 + STAB-01 en paralelo (archivos distintos, MAX_CONCURRENT=3).
- GATES_EVALUADOS: P:disparado→GO plan + 4 decisiones spec | D:no | V:no | C:no
