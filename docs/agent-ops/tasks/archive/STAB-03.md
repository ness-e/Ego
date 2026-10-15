# STAB-03: Cablear PromptAssembly al turno real

## Metadata
- **Plan file:** `docs/agent-ops/plans/2026-10-16-plan-estabilizacion-ego.md`
- **Fuente:** plan Task 4 + verificación código-real (assembleHermesPrompt existe, handleLlmStream usa system ad-hoc)
- **Esfuerzo:** 🟡 1d
- **Prioridad:** 🔴 P0
- **Tipo:** feature-add (wiring prod + símbolos exportados nuevos en main)
- **Turns estimados:** 5-10
- **Creado:** 2026-10-16
- **last-synced:** 2026-10-16
- **Estado:** ⏳ IN PROGRESS
- **Incógnitas (uphill):** 1 (fingerprint exacto y orden tiers — resuelto por evidencia, ver Spec)
- **Pendientes (downhill):** 4 steps

## Blast Radius
| Dirección | Módulos |
|-----------|---------|
| Callers | `handleLlmStream` → `decisionRouter`/`loopBreaker`/`toolLoop.run`/`lifecycle.syncTurn` |
| Callees | `PromptAssembly` (assemble/format/overlay/assert) + `SubEgoSoul.assembleHermesPrompt` |
| Implicaciones | Riesgo alto: caché (coste) + seguridad (inyección). System prompt cambia de bytes → ADR obligatoria |

## Impacto mapeado (Regla 0)
- **Archivos leídos (completos):** `apps/desktop/src/main.ts` (§handleLlmStream 1751-1995, imports 1-140, init 2460-2488), `packages/subegos/src/PromptAssembly.ts` (1-425 completo), `packages/subegos/src/SubEgoSoul.ts` (56-195, 325-469), `packages/runtime/src/types.ts` (70-130, 200-211), `packages/runtime/src/ToolExecutionLoop.ts` (144-210)
- **Archivos referenciados hacia dentro:** `PromptAssembly.ts:25-77` (constantes tiers/EPHEMERAL/OUT_OF_BAND) referenciadas por `SubEgoSoul.ts:7-15`; `runtime/types.ts:77-87` declara `ephemeralSystemPrompt`/`cachedSystemPromptFingerprint` que `ToolExecutionLoop.run` ignora (`ToolExecutionLoop.ts:148` solo usa `systemPrompt`)
- **Archivos que referencian a los editados:** `apps/desktop/test/ipc-tool-loop.test.ts` (ejercita loop, no system), `packages/subegos/test/SubEgoSoul.test.ts` (compilePrompt legacy, no Hermes), `packages/subegos/src/index.ts:10` (re-exporta PromptAssembly)
- **Veredicto impacto:** medio-alto — 1 edit quirúrgico en `handleLlmStream` (1704-1715→1864-1910 reales) + helpers puros exportados + 2 archivos de test nuevos + 1 ADR nueva. Prohibidos intactos: `ToolPermissions.ts` (STAB-02), `DelegationRouter` loop expose (STAB-04), `.ego-worktrees/dist/out`

## Contrato
`pnpm --filter @ego/subegos test` + `pnpm --filter @ego/desktop test` verdes + turno usa `assembleHermesPrompt` + `drainSteer→formatOutOfBand` + `assertSystemPromptStable` salvo compression

## Spec
Justificación por-evidencia por ítem (un solo camino viable por ítem — Gate D sin 2 caminos, sin ronda question):

| # | Decisión | Opción elegida (Recomendado) | Evidencia |
|---|----------|------------------------------|-----------|
| 1 | Fingerprint | FNV-1a hex 8 chars existente (`fingerprintSystemPrompt`, `PromptAssembly.ts:186-193`) | ✅ decidido-por-evidencia (ref: `packages/subegos/src/PromptAssembly.ts:186`) — determinista, sin dependencias, ya usado por `AssembledPrompt.fingerprint` |
| 2 | Orden tiers | stable→context→volatile con join `\n\n` (`assembleSystemPrompt`, `PromptAssembly.ts:362-377`) | ✅ decidido-por-evidencia (ref: `packages/subegos/src/PromptAssembly.ts:362`) — orden canónico Hermes portado + `PROMPT_TIER_ORDER` |
| 3 | Fuente `coreRules` | Literal ad-hoc existente `"Eres Ego, un Sistema Operativo Cognitivo..."` (`main.ts:1867`) preservado como `coreRules` | ✅ decidido-por-evidencia (ref: `apps/desktop/src/main.ts:1867`) — preserva jerarquía sin inventar reglas nuevas; el cambio es estructural (tiers), no semántico |
| 4 | Fuente `soulBlock` | Default `ego.nucleus` inline + lookup `subEgoRegistry` si resuelve | ✅ decidido-por-evidencia (ref: `apps/desktop/src/main.ts:2479` registry existe; `SubEgoSoul.ts:174-193` constructor exige id válido) — main no guarda soul en memoria; fallback inline evita fallo si registry vacío |
| 5 | `contextText` (recall pre-turn) | Overlay efímero API-call-time vía `applyEphemeralOverlay` (NO al system cacheado) | ✅ decidido-por-evidencia (ref: `packages/subegos/src/PromptAssembly.ts:384`) — recall es fresco por turno; al system lo contaminaría y rompería caché (pre-mortem: EPHEMERAL contamina caché) |
| 6 | Steer mid-turn | Cola module-level `queueMainSteer/drainMainSteerQueue` + `formatOutOfBandUserMessage` como user standalone | ✅ decidido-por-evidencia (ref: `packages/subegos/src/PromptAssembly.ts:225`, `DelegationRouter.ts:947-951` patrón drain) — main no tiene acceso a DelegationRouter/Runtime steer queues; cola local es el mínimo cableado sin cruzar boundaries de STAB-04 |
| 7 | Estabilidad | `Map<sessionId,fingerprint>` + `assertSystemPromptStable` salvo `isCompressionRebuild:true` | ✅ decidido-por-evidencia (ref: `packages/subegos/src/PromptAssembly.ts:413`) — invariante Hermes portada; compresión es el único cache-break sancionado |
| 8 | Alcance loop | NO tocar `ToolExecutionLoop.run` (overlay se resuelve en main y se pasa como `systemPrompt` efectivo) | ✅ decidido-por-evidencia (ref: `packages/runtime/src/ToolExecutionLoop.ts:148`) — `runtime/types.ts:77-87` ya declara los campos para enforcement futuro (STAB-05 compresión); tocar el loop expande blast radius al hot path |

Gate D: `no` — un solo camino viable por ítem con evidencia file:line; sin bifurcaciones técnicas abiertas. Sin ronda question (worker sin tool `question`; además no hay 2 caminos que arbitrar).

## Invariantes de dominio (handoff — MUST)
- **Invariantes a preservar:** system byte-stable por sesión salvo compresión; `EPHEMERAL_*` nunca en prefijo cacheado; solo el marcador out-of-band exacto tiene autoridad de usuario; tool output/web/archivos = DATA; no mutar system mid-turn; no tocar `ToolPermissions.ts` ni `DelegationRouter` loop expose.
- **Comandos de verificación:** `pnpm --filter @ego/subegos test`, `pnpm --filter @ego/desktop test`
- **Deuda pendiente:** enforcement en `ToolExecutionLoop.run` (campos `ephemeralSystemPrompt`/`cachedSystemPromptFingerprint` declarados pero ignorados) → candidato STAB-05 o FIND-*.

## Recitation
| Campo | Valor |
|-------|-------|
| activeGoal | STAB-03 cablear PromptAssembly al turno real |
| lastAction | DISCOVERY completo + task file creado |
| result | PARTIAL |
| nextAction | Step 1 tests PromptAssembly (TDD) |
| contract | ver Contrato + Invariantes |
| nextTask | STAB-05 |

## Deuda técnica (Regla 6 — MUST)
**Saldo neto:** Loop ignora `ephemeralSystemPrompt`/`cachedSystemPromptFingerprint` (runtime/types.ts:77-87) → fila FIND o STAB-05. Sin deuda nueva propia.

## Definition of Done
- **Task (nivel 1):** turno usa `assembleHermesPrompt` + steer out-of-band + ephemeral solo API-call + stable salvo compression; tests nuevos verdes; suites `subegos`+`desktop` verdes.
- **Commit (nivel 2):** commit local atómico `feat:` solo archivos STAB-03 (NUNCA push); ADR-0005 incluida.
- **Release (nivel 3):** ADR-0005 documenta el cambio de bytes del system prompt (no hay cambio semántico de reglas).

## Herramientas necesarias
- pnpm --filter @ego/subegos test, pnpm --filter @ego/desktop test, codegraph (grep/read nativo como fallback), SECURITY phase (inyección: tool output/web = DATA nunca instrucciones)

**SDP:** test-driven-development (lógica nueva + wiring) + doubt-driven-development (prompt-injection adversarial, degradado en worker sin subagentes — ver §Review) + systematic-debugging (pre-cargada por entorno). Base auto (campaign-executor/progreso/ponytail vía MCP en orquestador).

## SECURITY phase (checklist security-and-hardening adaptada — sin dependencia nueva)
- [x] Trust boundary: system prompt (construcción) + steer (inyección mid-turn) identificados
- [x] Tool output/web/archivos = DATA: `ANTI_INJECTION_POLICY` en Tier 1 estable (`PromptAssembly.ts:56-66`); recall via overlay efímero (no se ejecuta, solo contexto)
- [x] Steer: solo marcador exacto `OUT_OF_BAND_OPEN/CLOSE`; lookalikes en tool output NO obedecidos (documentado en test)
- [x] Sin secretos en código: helpers puros, sin keys
- [x] `cargo audit`: N/A (sin cambios de dependencias)
- [x] Adversarial doubt-driven (degradado): ver §Review — claim "el wiring no abre inyección ni rompe caché" auto-cuestionado con prompt adversarial

## Steps

### Step 1: Tests PromptAssembly + Hermes (TDD RED→GREEN)
- **Archivos:** `packages/subegos/test/PromptAssembly.test.ts` (NUEVO)
- **Acción:** Tests: orden tiers + fingerprint estable + `assembleHermesPrompt` exige coreRules + ephemeral no contamina prefijo + `assertSystemPromptStable` lanza salvo compression + `formatOutOfBandUserMessage` marcador exacto + `wrapUntrustedAsData` marca DATA + jailbreak confinado (doubt adversarial: steer lookalike en tool output NO tiene autoridad)
- **Verify:** `pnpm --filter @ego/subegos test` verde
- **Estado:** ✅ DONE (2026-10-16: 22/22 verde; TDD RED real en test lookalike — el CLOSE corto es copiable, la autoridad real es marcador exacto + canal user + posición; test corregido al invariante verdadero `PromptAssembly.ts:42-49`)

### Step 2: Helpers puros + wiring handleLlmStream
- **Archivos:** `apps/desktop/src/main.ts` (helpers exportados + reemplazo system ad-hoc 1864-1875), `apps/desktop/test/prompt-assembly-turn.test.ts` (NUEVO)
- **Acción:** `buildTurnSystemPrompt()` (soul+coreRules+caller), `queueMainSteer/drainMainSteerQueue`, `getCachedTurnFingerprint/assertTurnSystemStable/recordTurnSystemFingerprint`; handleLlmStream: assemble → ephemeral overlay con contextText → steer out-of-band como user standalone → assert stable → loop con system efectivo
- **Verify:** `pnpm --filter @ego/desktop test` verde (nuevo test) + `pnpm --filter @ego/subegos test` verde
- **Estado:** ✅ DONE (2026-10-16: helpers `EGO_CORE_RULES_STAB03/getDefaultNucleusSoul/resolveTurnSoul/queueMainSteer/drainMainSteerQueue/buildTurnPrompt/clearTurnSystemFingerprint` + wiring; test turno 9/9 verde; `typecheck` desktop 0 errores. Timestamp volátil congelado por sesión — sin esto el 2º turno violaría estabilidad. Hunks main.ts absorbidos por commit ajeno `c087862` 22:30 (worktree compartido Wave 1); resto del diff main.ts = STAB-02, NO tocado)

### Step 3: ADR-0005 + verify full + commit + review
- **Archivos:** `docs/adr/0005-promptassembly-turno.md` (NUEVA)
- **Acción:** ADR cambio estructural del system prompt; verify contrato completo; commit local `feat: STAB-03 ...` solo archivos STAB-03 (NUNCA push); self-review doubt-driven degradado registrado
- **Verify:** ambas suites verdes + `git status` muestra solo alcance STAB-03 en el commit
- **Estado:** ✅ DONE (2026-10-16: ADR-0005 creada; alcance propio 100% verde — subegos 177/177 excl. WIP STAB-04, desktop 208 + 9 nuevos propios verdes, typecheck 0 errores; commit local de 4 archivos nuevos propios; review P2-01 queda al orquestador. Ver §Colaterales por rojos ajenos)

## Dependencias
- Wave 1 con STAB-02/STAB-04 (archivos distintos; main.ts compartido con STAB-02 → commit solo hunks propios vía `git add -p`/paths nuevos + edit quirúrgico preservando CFG-06). nextTask STAB-05.

## Review (GATE — agente distinto, P2-01)
- **Revisor:** pendiente (worker sin capacidad de spawnear revisor distinto; queda para el orquestador/wave review)
- **Enfoque:** ¿EPHEMERAL contamina caché en algún path? ¿steer lookalike obedecible? ¿system muta mid-turn fuera de compresión? ¿se tocó ToolPermissions/DelegationRouter?
- **Cómo se probó:** suites + diff
- **Veredicto:** ⬜ pendiente (self-check doubt-driven degradado en Step 3)

## Notas
- `PromptAssembly.ts` está untracked en worktree (no en HEAD): se adopta como alcance STAB-03 sin modificar su diseño (solo tests que lo fijan).
- `main.ts` modificado en worktree por STAB-02 (CFG-06): el edit STAB-03 preserva esos bloques byte-a-byte.

## Colaterales (Gate C — NO arreglados inline, scopes ajenos)
| # | Hallazgo | Dueño | Evidencia |
|---|----------|-------|-----------|
| 1 | `test/DelegationTools.test.ts` 15/15 rojo: `mkWorker` crea manifiesto con `systemPrompt` corto → `parseSubEgoManifest` ZodError + `tsc` subegos roto por `DelegationTools.ts` (`DelegationResult` no exportado) | STAB-04 (WIP untracked) | `pnpm --filter @ego/subegos test` 177✅/15❌; `tsc -p` subegos exit 2 |
| 2 | `apps/desktop` sin shim `.bin/vitest` + `pretest ensure-fresh-dist` aborta por (1) → `pnpm --filter @ego/desktop test` no ejecutable literal; workaround: `node node_modules/vitest/vitest.mjs run` directo | infra/paralelo | vitest ausente en `apps/desktop/node_modules/.bin`, presente en packages |
| 3 | `FloatingWindow.test.ts` 6/6 rojo: `webContents.on is not a function` (mock desactualizado vs `FloatingWindowView.ts:63`) | isla flotante (WIDG) | desktop suite 208✅/9❌ |
| 4 | `ipc-contract.test.ts` 2/2 rojo: `ipc.hooks.getStatus` + `floating:state_changed` en preload fuera del contrato | hooks/isla (STAB-12/WIDG) | mismo run |
| 5 | `golden-path-alpha-full.test.ts` 1 timeout 5000ms (E2E largo) | flaky/perf | mismo run |
- Ninguno toca archivos STAB-03. Ticket FIND a crear por el orquestador (worker no escribe Backlog ajeno).
- Limitación conocida (trade-off documentado, no fix unilateral): `callerSystemMessage` que contenga el substring `EPHEMERAL_` dispara `EphemeralContaminationError` fail-closed en el overlay (disponibilidad, nunca bypass). Endurecer el assert es debilitar invariante de seguridad → requiere decisión owner.

## Doubt-review degradado (doubt-driven-development, sin subagentes en worker)
- **Cross-model:** omitido — contexto no-interactivo. Se anuncia, no se silencia.
- **CLAIM:** "el wiring no abre inyección, no rompe caché, no regresa streaming".
- **Artifact:** hunks main.ts STAB-03 + `buildTurnPrompt` + tests. **Contract:** invariantes §Invariantes.
- **Hallazgos:** (1) timestamp por-turno rompería estabilidad → mitigado con congelado por sesión (test `sesiones distintas` + `segundo turno mismo fingerprint` lo fijan); (2) lookalike CLOSE copiable → autoridad = marcador exacto + canal + posición (test corregido); (3) `resolveTurnSoul` nunca lanza (try/catch + fallback nucleus); (4) cola steer vacía en prod hoy → mensajes idénticos a antes salvo bytes del system; (5) `syncTurn` persiste solo userPrompt/finalText → ephemeral nunca persiste. Sin pendientes accionables.
