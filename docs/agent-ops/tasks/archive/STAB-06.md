# STAB-06: CAS + projector + curator + reasoning_effort

## Metadata
- **Plan file:** `docs/agent-ops/plans/2026-10-16-plan-estabilizacion-ego.md` (Task 7)
- **Fuente:** plan Task 7 + auditoría agentes/contexto (sin CAS/projector/curator; ModelConfig sin reasoningEffort/temperature)
- **Esfuerzo:** 🟡 1d
- **Prioridad:** 🟠 P1 (Wave 2 con STAB-05/07, archivos disjuntos)
- **Tipo:** feature-add (símbolos públicos nuevos: `SharedMemoryVersionConflictError`, `expectedVersion`, projector, curator job, `reasoningEffort`) → Spec SDD obligatoria + Gate D
- **Turns estimados:** 10-14
- **Creado:** 2026-10-16
- **last-synced:** 2026-10-16
- **Estado:** 🟡 REVIEW-PENDIENTE (Steps 1-7 ✅ + subegos 212/212 + memory 135/135 + models 80/80 + runtime 69/69 + desktop contrato 30/30 + typecheck 0 err + commit local; falta veredicto review P2-01 por agente distinto)
- **Commit:** (al cierre Step 7)
- **Incógnitas (uphill):** 0 (todas resueltas por evidencia/contrato en Gate D)
- **Pendientes (downhill):** 6 (tests RED → CAS+projector → curator → reasoning → verify → commit)
- **Prohibidos:** compresión/cleanup (STAB-05: `handlePreCompaction`, thresholds, `cleanExpiredLeases` job, worktree TTL), CI (STAB-07), main prompt (STAB-03: `assembleHermesPrompt`, system ad-hoc)
- **Next:** STAB-08
- **SDP:** api-and-interface-design + test-driven-development (cargadas; base auto-vía-MCP)

## Blast Radius
| Dirección | Módulos |
|-----------|---------|
| Callers | `SubEgoRuntime`/`DelegationRouter` → `SharedMemory.publish/read/query`; `handleLlmStream` (main) → `ToolExecutionLoop.run` → `ModelRouter.generateText/streamText` → providers; `EgoMemoryLifecycle.assemblePreTurn/syncTurn` |
| Callees | `EgoMemoryAdapter.put/get/list/recordAudit` + `listQuarantineAware/getQuarantineAware`; zod `ModelConfigSchema`; AI SDK v7 `generateText/streamText` (`reasoning` portable); VantaDB `session/turns`, `kb/facts` |
| Riesgo | Medio (CAS rompe writes cooperativos si fuese obligatorio → mitigado: `expectedVersion?` opcional + fallback lease; todos los campos nuevos opcionales/back-compat) |
| Archivos afectados | ~17 pero todos aditivos opcionales (justificado abajo — el contrato "hilado PreferredModel→toolLoop→provider" exige la cadena completa; dividir rompería el hilo verificable) |

**Justificación blast >10 (Gate D):** cada eslabón del hilo es un diff de 2-8 líneas aditivo (`reasoningEffort?`/`temperature?` opcionales; CAS opt-in por llamada; curator solo añade `kb/facts`). Sin alternativa real divisible: un STAB-06 parcial (p.ej. schema sin provider) dejaría el contrato "hilado a provider" sin verificar. NO dispara pregunta GO/dividir adicional: cubierto por Gate P GO plan + contrato explícito.

## Impacto mapeado (Regla 0)
- **Archivos leídos (completos):** `packages/subegos/src/SharedMemory.ts` (1-851), `packages/subegos/test/SharedMemory.test.ts` (1-265), `packages/memory/EgoMemoryLifecycle.ts` (1-333), `packages/memory/QuarantineAwareReads.ts` (1-216), `packages/memory/EgoMemoryAdapter.ts` (`list:580-599`, `listPaged`, `delete`), `packages/models/src/types.ts` (1-110), `packages/models/src/ModelRouter.ts` (1-624), `packages/models/src/providers/OpenAICompatibleProvider.ts` (1-100), `AiSdkOpenAIProvider.ts` (55-110), `MockProvider.ts` (1-113), `packages/runtime/src/types.ts` (1-211), `packages/runtime/src/ToolExecutionLoop.ts` (144-203), `apps/desktop/src/ipc/schema.ts` (EffortLevel 304-363), `apps/desktop/src/main.ts` (`applyModelConfig:1422-1468`, `preferredModel:2086-2112`, `currentModelConfig:1320-1325`, settings get/save `3530-3803`, restore `2617-2623`, lifecycle init `2544-2553`), `apps/desktop/src/preload.ts` (147-161), `docs/user/configuration.md` (1-75), `.agents/references/clean-code-clean-architecture.md` (§1-§4 + TS §3.3), `spec-template.md`, `question-gates.md`, `STAB-04.md` (formato)
- **Referencias hacia dentro:** CAS: `publish()` lectura `previousVersion:486-508` → check opt-in; projector: `read()` (sin notify) + `getLease()`; curator: `listQuarantineAware` + `adapter.put/recordAudit`; tuning: `PreferredModel` → `LoopRunOptions` → `router.applyPreferredTuning` → `ModelGenerateOptions` → providers
- **Referencias entrantes (quién usará lo nuevo):** Sub-Egos concurrentes (CAS), prompt assembly/turno (projector `contextText`), job idle (curator), picker Ajustes→main (tuning)
- **Veredicto impacto:** medio — 4 símbolos públicos nuevos + campos opcionales; cero cambios de firma existente; tests existentes intactos (lease-first preserva errores observados)

## Contrato
`pnpm --filter @ego/subegos test` + `pnpm --filter @ego/memory test` verdes con tests `VersionConflict` + vista proyectada `{key,version,leaseHolder}` + job curator a `kb/facts` con quarantine + `reasoningEffort low|medium|high` hilado a provider; `pnpm --filter @ego/models test` + `--filter @ego/runtime test` + `--filter @ego/desktop test` verdes; `docs/user/configuration.md` documenta effort+temperature

## Spec SDD (spec-template.md §5 — Diseño Propuesto + Decisiones)
- **Tipo:** feature-add
- **Origen:** backlog (plan estabilización STAB-06)
- **Fecha:** 2026-10-16
- **Veredicto Preliminar:** 🟢 Factible para Ego
- **Estado de la spec:** ✅ confirmada por contrato+evidencia (Gate D por-evidencia, ver tabla; subagente sin canal `question` interactivo — orquestador puede revertir cualquier fila)

### 1. Problema
`publish` hace read-modify-write (`version+1`) sin CAS: dos Sub-Egos con ventanas de minutos se pisan sin error. Sin projector, cada turno paga tokens de payloads crudos + broadcast. Sin curator job, `session/turns` crece sin consolidación a `kb/facts`. `ModelConfig` no expone `reasoningEffort/temperature` y el router ignora los settings CFG-04 en prod (`configureFromSettings` sin callers en main — solo tests).

### 2. Viabilidad vs Principios
- ¿Respeta arquitectura Desktop?: Sí (main hila tuning; renderer solo tipos preload opcionales + docs).
- ¿Memoria por EgoMemoryAdapter/NativeVantaDB?: Sí (curator usa `list/put/recordAudit` + `listQuarantineAware`; sin acceso directo VantaDB).
- ¿Evita dependencias prohibidas?: Sí (0 deps nuevas; AI SDK `reasoning` es API del SDK ya instalado `ai@7.0.137`). ✅ NO descarta.

### 3. DoD Mecánico
1. `pnpm --filter @ego/subegos test` verde (incluye `SharedMemory.cas-projector.test.ts` ≥12 casos: CAS ok/conflicto/omitido+lease, vista, retrieve-sin-broadcast, contextText).
2. `pnpm --filter @ego/memory test` verde (incluye `curator-consolidation.test.ts` ≥6 casos: stale→facts, quarantine-skip, idempotencia, cap sin borrar).
3. `pnpm --filter @ego/models test` + `--filter @ego/runtime test` verdes (incluye `reasoning-effort.test.ts` + loop-tuning: precedencia explícito>preferido>effort>default, forward a provider).
4. `pnpm --filter @ego/desktop test` verde (schema acepta/rechaza + `applyModelConfig` cablea effort + persist/restore/máscara).
5. `docs/user/configuration.md` documenta `reasoningEffort` + `temperature`.

### 4. Alcance
- **Incluye:** CAS opt-in en `SharedMemory.publish`; projector (`getProjectedView`, `retrieve`, `projectRecords/projectKeys`); curator (`runCuratorConsolidation`, `startCuratorJob/stopCuratorJob`, wiring en main junto a `startSession`); tuning (`ReasoningEffortSchema`, `ModelConfig.reasoningEffort/temperature`, `PreferredModel`+`LoopRunOptions`+`ModelGenerateOptions`, `RouterModelSettings`, `applyPreferredTuning`, 5 providers, `applyModelConfig` wiring, persist/restore/máscara/preload, docs).
- **NO incluye:** compresión/thresholds/cleanup/TTL deletes (STAB-05); CI/RTL (STAB-07); prompt assembly (STAB-03); UI renderer de ajustes (follow-up); `normalizeStructuredOutput` saneado (deuda declarada, futura); cablear CFG-04 `aliases/review/fallback` en main (gap preexistente, se deja + se anota deuda).

### 5. Diseño Propuesto (≤10 líneas)
`SharedMemory.ts`: `SharedMemoryVersionConflictError` + `PublishOptions.expectedVersion?` (check tras gate lease, contra `previousVersion`); `getProjectedView()` → `{key,version,leaseHolder}`; `retrieve()` alias no-broadcast; `projectRecords()` pura → `{contextText,tokenEstimate,truncated}` con topes. `EgoMemoryLifecycle.ts`: `runCuratorConsolidation({staleAfterDays:30,maxSnapshots:50})` lista `session/turns` vía `listQuarantineAware`, agrupa por sesión, upsert `kb/facts/curator_<session>` idempotente, cap fail-closed sin borrar + `recordAudit`; `startCuratorJob({intervalMs})` con `unref`. Tuning: `reasoningEffort: low|medium|high` + `temperature: 0-2`; main hila `currentModelConfig` → `preferredModel` → `loop.run` → router (explícito>preferido>effort>0.7) → providers (`reasoning` AI SDK portable, `reasoning_effort` fetch nativo).

### 6. Decisiones (Gate D — 1 ronda; Recomendado primero, resueltas por evidencia/contrato)
| # | Decisión | Opciones (+tradeoff) | Default recomendado | Resuelto |
|---|----------|----------------------|---------------------|----------|
| 1 | Tipo error CAS | **(a) `SharedMemoryVersionConflictError extends SharedMemoryError` con `expected/actual` (Recomendado: consistente con LeaseConflict/Expired/Invalid)** / (b) reutilizar `LeaseConflictError` (confunde CAS≠lease; rompe catch existentes) | (a) | ✅ evidencia `SharedMemory.ts:24-75` taxonomía |
| 2 | `expectedVersion` | **(a) opcional, omitido=legacy `version+1` (Recomendado: contrato "opcional + fallback lease"; 0 regresión)** / (b) obligatorio (rompe writers + tests `SharedMemory.test.ts:144-176`) | (a) | ✅ contrato plan + riesgo plan |
| 3 | Orden checks publish | **(a) lease primero, CAS después (Recomendado: preserva errores observados en tests existentes)** / (b) CAS primero (cambia error visible con lease+stale) | (a) | ✅ evidencia tests `158-176` |
| 4 | Dónde vive projector | **(a) métodos en `SharedMemory` (Recomendado: acceso a leases/track sin romper encapsulación; 0 archivos)** / (b) clase separada (exige getters internos o duplica lógica) | (a) | ✅ evidencia encapsulación `leases/projectKeys` privados |
| 5 | `retrieve` | **(a) alias explícito + test no-broadcast (Recomendado: contrato pide el símbolo; `read` ya no notifica pero no lo garantiza)** / (b) solo documentar `read` (sin símbolo verificable) | (a) | ✅ contrato "retrieve-no-broadcast" |
| 6 | Dónde vive curator | **(a) `EgoMemoryLifecycle` (Recomendado: dueña session/turns+dream job; `listQuarantineAware` ya importable)** / (b) `packages/tasks` (no conoce memoria; nueva dep) | (a) | ✅ evidencia `EgoMemoryLifecycle.ts:56-65` + `QuarantineAwareReads.ts:126-173` |
| 7 | Cap `maxSnapshots` | **(a) fail-closed skip-new + report `capped` sin borrar (Recomendado: borrar=cleanup STAB-05 prohibido)** / (b) rotación con delete (viola prohibidos) | (a) | ✅ prohibidos STAB-06 |
| 8 | Idempotencia curator | **(a) upsert `curator_<sessionId>` + skip si mismo `turnCount` (Recomendado: cota natural, re-runnable)** / (b) key por timestamp (crece sin cota por corrida) | (a) | ✅ contrato "consolida" sin cota explosiva |
| 9 | Valores effort | **(a) `low\|medium\|high` (Recomendado: contrato; 1:1 con AI SDK `reasoning` v7)** / (b) reutilizar `EffortLevel` 5 niveles (minimal/xhigh sin mapeo provider; rompe contrato) | (a) | ✅ contrato + evidencia `ai` docs `26-reasoning.mdx:22-33`, `dist/index.d.ts:744` |
| 10 | effortLevel vs reasoningEffort | **(a) `effortLevel` explícito gana; `reasoningEffort` mapea solo si aquel ausente (Recomendado: back-compat CFG-04)** / (b) reasoningEffort pisa siempre (sorpresa configs existentes) | (a) | ✅ evidencia `schema.ts:356` + `ModelRouter.applyEffort:202-213` |
| 11 | Threading tuning | **(a) `PreferredModel` → `LoopRunOptions` override → `applyPreferredTuning` → provider; precedencia explícito>preferido>effort>default (Recomendado: per-call posible, global por defecto)** / (b) solo global router (el loop no puede variar por turno) | (a) | ✅ contrato "hilado PreferredModel→toolLoop→provider" |
| 12 | Providers AI SDK | **(a) top-level `reasoning` portable v7 (Recomendado: un shape; provid. sin soporte lo ignoran con warning)** / (b) `providerOptions` por vendor (4 shapes; frágil) | (a) | ✅ evidencia docs `26-reasoning.mdx:79-89` |
| 13 | Scheduler curator | **(a) `start/stopCuratorJob` en lifecycle (`unref`) + arranque en main junto a `startSession` (Recomendado: "job" verificable; defaults 1h/30d/50)** / (b) solo método manual (sin job real) | (a) | ✅ contrato "job curator" |

GATES_EVALUADOS (parcial): P:no (heredado GO plan) D:disparado→spec por-evidencia 13/13 sin N/A V:no C:no | subagente sin question interactivo, contrato+evidencia resuelven

## Invariantes de dominio (handoff — MUST)
- **Invariantes a preservar:** lease-first en publish (errores existentes intactos); `expectedVersion` omitido = conducta legacy exacta; `read` nunca notifica (retrieve lo garantiza por test); curator NUNCA borra (cap = skip-new); quarantine/pending siempre se respeta vía `*QuarantineAware` (skip inputs cuarentenados); tuning todo-opcional (configs viejas parsean igual; `temperature` fuera de 0-2 se rechaza por schema); NO tocar `handlePreCompaction/cleanExpiredLeases`/thresholds (STAB-05), CI (STAB-07), prompt assembly (STAB-03); `normalizeStructuredOutput` sin saneado queda como deuda (no aquí).
- **Comandos de verificación:** `pnpm --filter @ego/subegos test`, `pnpm --filter @ego/memory test`, `pnpm --filter @ego/models test`, `pnpm --filter @ego/runtime test`, `pnpm --filter @ego/desktop test`
- **Deuda pendiente:** UI renderer ajustes (effort/temperature); cablear CFG-04 `aliases/review/fallback` en main (gap preexistente `configureFromSettings` sin callers); review P2-01 por agente distinto pendiente al cierre.

## Steps
- [x] Step 1 — Discovery + Spec SDD + Regla 0 (task file)
- [x] Step 2 — Tests RED CAS + projector (`packages/subegos/test/SharedMemory.cas-projector.test.ts`, 15 casos; RED 11 fallan → GREEN)
- [x] Step 3 — Impl CAS + projector (`SharedMemory.ts`: `SharedMemoryVersionConflictError`, `expectedVersion?`, `getProjectedView`, `retrieve`, `projectRecords`, `projectSnapshot`) + subegos 212/212 (nota: método `projectKeys` renombrado a `projectSnapshot` por colisión con campo privado)
- [x] Step 4 — Tests RED curator (`curator-consolidation.test.ts`, 7 casos) + tuning (`reasoning-effort.test.ts` 6, `loop-tuning.test.ts` 2, `model-tuning.test.ts` 5)
- [x] Step 5 — Impl curator (`EgoMemoryLifecycle.ts`: `runCuratorConsolidation`, `startCuratorJob/stopCuratorJob`, `listQuarantineAware`) + memory 135/135
- [x] Step 6 — Impl tuning cadena completa (models `ReasoningEffort`/`PreferredModel`/`ModelGenerateOptions`/`applyPreferredTuning`/`configureFromSettings`/5 providers; runtime `LoopRunOptions`+loop; desktop schema+`applyModelConfig`+persist/restore/máscara/preload+`handleLlmStream`+curator boot; `docs/user/configuration.md`) + models 80/80 + runtime 69/69 + desktop 30/30; `dist/` models/memory/subegos reconstruidos (gitignored, fix stale-dist typecheck)
- [x] Step 7 — Verify full + commit local + plan sync + RESULTADO

## Verificación (evidencia)
- `pnpm --filter @ego/subegos test` → 19f/212t ✅ (incluye cas-projector 15)
- `pnpm --filter @ego/memory test` → 22f/135t ✅ (incluye curator 7) + compresión STAB-05 11/11 sin interferencia ✅
- `pnpm --filter @ego/models test` → 9f/80t ✅ (incluye reasoning-effort 6)
- `pnpm --filter @ego/runtime test` → 13f/69t ✅ (incluye loop-tuning 2)
- `pnpm --filter @ego/desktop test -- model-tuning+ipc-tool-loop+ipc-zod-coverage` → 30/30 ✅
- `pnpm typecheck` → 0 errores (todos los paquetes) ✅
- Desktop full: 8 rojos preexistentes (`FloatingWindow`, `ipc-contract`: canales `ipc.hooks.*`/`floating:*` ajenos) — baseline con stash idéntico 8/8, cero regresión ✅
- GATES_EVALUADOS: P:no (heredado GO plan) D:disparado→spec por-evidencia 13/13 V:no (sin doble-falla mismo-error) C:no (colaterales: ninguno; `git status` fuera de blast radius = otros workers, sin commit)

## Review (P2-01 — pendiente orquestador)
- Tier: **Fast** (paths: `packages/*`, `apps/desktop/src/*`, `docs/user/*`, tests — ningún glob adversarial: sin `src/storage/**`, serialización on-disk ni formatos wire).
- Sin veredicto de agente distinto: NO marcar COMPLETED en campaign; este worker deja 🟡 REVIEW-PENDIENTE + commit local.
