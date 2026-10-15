# TASK-STAB-05: Compresión con thresholds + cleanupPeriod

> **Plan:** `docs/agent-ops/plans/2026-10-16-plan-estabilizacion-ego.md` · **Campaign:** STAB-2026-10-16 · **Wave 2** (paralela STAB-06/07, archivos distintos)
> **Tipo:** feature-add (lógica nueva + símbolos públicos) · **Estado:** ⏳ IN PROGRESS
> **SDP:** test-driven-development + performance-optimization + base (keywords: compression, retention, cleanup, compaction)
> **Gate P:** ✅ resuelto 2026-10-16 — usuario GO; valores **70% / 40% / 30d vinculantes**.
> **Gate D:** sin ronda `question` — valores ya decididos por Gate P + spec por-evidencia abajo (subagente sin tool `question`; desvíos → BLOQUEO al orquestador).

## Objetivo

Cablear lo que hoy existe pero nadie llama: `handlePreCompaction→kb/history_archive` (`packages/memory/EgoMemoryLifecycle.ts:282-300`) + `cleanExpiredLeases()` (`packages/subegos/src/SharedMemory.ts:435`) + `finalizeWorktree pruneIfClean` (`packages/subegos/src/SubEgoWorktree.ts:144-216`), con settings gobernados `gov/settings/compression` y trigger pre-`toolLoop.run` en `handleLlmStream` (`apps/desktop/src/main.ts:2099-2112`).

## Contrato

`pnpm --filter @ego/memory test` + `pnpm --filter @ego/tasks test` verdes + `gov/settings/compression` trigger pre-`toolLoop.run` + job cleanup worktrees/sesiones/leases probado.

## Blast Radius

| Dirección | Módulos |
|-----------|---------|
| Callers | `handleLlmStream` (main.ts) → lifecycle → VantaDB; `BackgroundEngine`/jobs → adapter/cleanup |
| Callees | VantaDB `gov/settings`, `kb/history_archive`, `session/turns`, `sessions/timelines`, git worktrees |
| Implicaciones | Riesgo alto (pérdida hechos): mitigación `excludeSuperseded` (ya en `assemblePreTurn:115`) + quarantine-aware + tests close/reopen; TTL nunca poda sesión activa (conservador ante timestamp ilegible, `SessionRetention.ts:107`) |

## Impacto mapeado (Regla 0)

- **Archivos leídos (completos):** `packages/memory/EgoMemoryLifecycle.ts` (333L), `packages/tasks/src/BackgroundEngine.ts` (380L), `packages/subegos/src/SubEgoWorktree.ts` (217L), `packages/runtime/src/ContextCompaction.ts` (228L), `packages/runtime/src/types.ts` (211L), `packages/runtime/src/ToolExecutionLoop.ts` (parcial 1-350), `packages/memory/SessionRetention.ts` (185L), `packages/memory/SnapshotRetention.ts` (131L), `packages/tasks/src/TaskCheckpoint.ts` (127L), `packages/tasks/src/MemoryCurator.ts` (parcial), `apps/desktop/src/main.ts` (§1792-1851, §1944-2223, §2800-2869), `packages/memory/EgoMemoryAdapter.ts` (§533-649), `packages/memory/index.ts`, `packages/tasks/src/index.ts`
- **Referenciados hacia dentro:** `vantadb/types` (SearchHit), `QuarantineAwareReads`, `EgoMemoryAdapter` (get/put/list/delete/recordAudit), `node:crypto`, `zod`, `node:child_process/fs`
- **Referencian a los editados:** `handlePreCompaction` → 0 callers (código muerto hoy); `cleanExpiredLeases` → 0 callers; `pruneStaleSessions` → tests + export; `ContextCompactionJob` → 0 callers prod; `cachedSystemPromptFingerprint` → declarado (`types.ts:87`) pero **ignorado por `ToolExecutionLoop.run`** (deuda conocida) — se cablea aquí (enforcement: rechaza mutación mid-turn salvo `isCompressionRebuild:true`)
- **Veredicto impacto:** medio-alto memoria (pérdida hechos) / bajo loop (aditivo, sin callers del fingerprint hoy) / bajo main (bloque trigger ~30L + cache espejo STAB-02)
- **Prohibidos (no tocar):** `ToolPermissions.ts`, `DelegationTools.ts`, prompt wiring STAB-03 (solo trigger compresión aditivo), CI workflows (STAB-07), CAS SharedMemory (STAB-06)

## Spec (SDD — por-evidencia; Gate P vinculante)

| # | Decisión | Evidencia / único camino viable | Resuelto |
|---|----------|--------------------------------|----------|
| 1 | threshold 70% ventana + target 40% + auto_compact | ✅ Gate P vinculante (plan Notas:452-453). Existente CFG-05 usa 50%/20% (`ContextCompaction.ts:21-26`) para loop genérico; el nuevo `gov/settings/compression` usa 70/40 sin colisionar (namespaces de settings distintos) | ✅ Gate P + code-ref |
| 2 | cleanupPeriod 30d worktrees/sesiones/leases | ✅ Gate P vinculante. Precedente: `DEFAULT_SESSION_RETENTION_SETTINGS.cleanupPeriodDays: 30` (`SessionRetention.ts:16-19`) — se reutiliza, no se duplica | ✅ Gate P + code-ref |
| 3 | Trigger en `handleLlmStream` antes de `toolLoop.run` → `handlePreCompaction` + `isCompressionRebuild:true` | ✅ único punto pre-loop (`main.ts:2099-2112`); `LoopRunOptions.isCompressionRebuild` ya existe (`types.ts:123`); `assertSystemPromptStable` ya honra el flag (`PromptAssembly.ts:413-425`) | ✅ decidido-por-evidencia |
| 4 | Schema `gov/settings/compression` en `@ego/memory` (Zod, fail-closed a defaults) | ✅ espejo patrón STAB-02 `gov/settings/permissions` (`main.ts:1810-1826`); memoria es dueño del lifecycle | ✅ decidido-por-evidencia |
| 5 | Job cleanup en `@ego/tasks` (`MemoryCleanupJob`) con gateways inyectados (adapter mínimo list/delete/recordAudit + callbacks leases/worktrees/snapshots) | ✅ patrón `CuratorGateway` (`MemoryCurator.ts:30-44`); evita dependencia tasks→subegos (ciclo) y tasks→fs | ✅ decidido-por-evidencia |
| 6 | `pruneOrphanWorktrees` en `SubEgoWorktreeManager` con `statFn/readdirFn` inyectables | ✅ `execGit`/`fileExists` ya inyectables (`SubEgoWorktree.ts:44-59`); huérfano = en disco pero fuera de `git worktree list`; conservador: joven/fallo → preservar | ✅ decidido-por-evidencia |
| 7 | Cablear enforcement `cachedSystemPromptFingerprint` en `ToolExecutionLoop.run` (sha256, error-result si mismatch sin `isCompressionRebuild`) | ✅ deuda declarada en contrato STAB-05; blast radius propio (flag que este task propaga); hoy 0 callers del fingerprint → aditivo seguro | ✅ decidido-por-evidencia |
| 8 | `session/turns` retención vía `pruneStaleSessions(ns="session/turns")` | ✅ `TurnRecord.timestamp` (`EgoMemoryLifecycle.ts:29`) es legible por `extractLastActive` (`SessionRetention.ts:88`); TTL mata-sesión-activa imposible (stale exige age>30d) | ✅ decidido-por-evidencia |

## Steps

- [x] S1 DISCOVERY — blast radius + task file + Spec (este archivo)
- [x] S2 RED — tests: `CompressionSettings` (7), `maybePreCompact` (4), `MemoryCleanupJob` (4), `pruneOrphanWorktrees` (4), fingerprint enforcement (7) — todos fallaron antes del GREEN (módulo ausente / 1 fix paths Windows)
- [x] S3 GREEN — `CompressionSettings.ts` + export + lifecycle `maybePreCompact`
- [x] S4 GREEN — `MemoryCleanupJob.ts` + export + `pruneOrphanWorktrees`
- [x] S5 GREEN — enforcement fingerprint en `ToolExecutionLoop.run` (+`stableSystemPrompt`: el overlay efímero muta por turno y nunca entra al hash)
- [x] S6 GREEN — `main.ts`: cache settings + trigger pre-loop + boot load + cleanup periódico (timer `unref`, fail-safe)
- [x] S7 VERIFY — memory 135/135 · tasks 59/59 · runtime 67 + fingerprint 7/7 (solo falla `loop-tuning` STAB-06, 0 refs a mis símbolos) · subegos 212/212 · desktop propio 36/36 (FloatingWindow/ipc-contract preexistentes) · typecheck 0 errores ×5 · SECURITY pass · PERFORMANCE +0.004ms/turno · commit local

## Invariantes de dominio (handoff — MUST)

- **Invariantes:** nunca podar sesión/turn activo o timestamp ilegible; archive pre-compact siempre antes de truncar; `excludeSuperseded:true` en recall; fingerprint solo rechaza cuando está fijado; settings inválidos → defaults (fail-closed, boot nunca tumba)
- **Comandos:** `pnpm --filter @ego/memory test` · `pnpm --filter @ego/tasks test` · `pnpm --filter @ego/runtime test` · `pnpm --filter @ego/subegos test` · `pnpm --filter @ego/desktop test` · typecheck por paquete
- **Deuda:** curator `kb/facts` es STAB-12 (fuera de scope); `max_snapshots` dumps vía callback (fs vive en desktop); review P2-01 por agente distinto → orquestador

## Recitation

- activeGoal: STAB-05 compresión thresholds + cleanupPeriod
- lastAction: S7 VERIFY completo + commit local (contrato verde en alcance propio; colaterales ajenos documentados)
- result: OK · nextAction: review P2-01 por agente distinto (orquestador) · nextTask: STAB-08
