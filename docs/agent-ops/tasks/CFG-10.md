# CFG-10 — Abort mid-token perfecto en router
- **Estado:** ✅ COMPLETED
- **Plan:** docs/agent-ops/plans/2026-10-16-plan-configs-revision-total.md
- **Fecha:** 2026-10-16
- **Commit:** 5eab44f (LOCAL, nunca push)
- **Archivos clave:** `packages/models/src/ModelRouter.ts:273-292` (generateText/streamText + runFallbackChain + resolveReviewModel) · `packages/models/test/cfg04-aliases-fallback.test.ts` (extiende con caso abort) · `packages/models/test/ModelRouter.test.ts` (regresión)
- **SDP:** campaign-executor, progreso, ponytail full, systematic-debugging, test-driven-development, code-review-and-quality, doubt-driven-development
- **Wave:** 0 paralela con CFG-01 y CFG-11 (archivos disjuntos). Previa: CFG-04 ✅. Next: ninguna (perf cierra con CFG-11).

## Objetivo
`ModelRouter.generateText/streamText` re-lanza `AbortError` sin entrar a la cadena fallback→mock ante abort; checkpoint post-generate del `ToolExecutionLoop` intacto (ese archivo NO se toca).

## Blast Radius
- **Callers:** `ToolExecutionLoop.run/resume` → `router.generateText/streamText` → providers/mock. Loop ya clasifica abort (`abortSignal?.aborted || isAbortError(err)` → resultado `aborted` limpio, `ToolExecutionLoop.ts:22-30,232-254,340-346,348-351`).
- **Callees:** providers (`openai/anthropic/ollama/mock` + `configureFromSettings`) + `attemptWithRotation` (solo rota ante 429; abort no es 429 → propaga al catch del entrypoint).
- **Implicaciones:** re-throw solo ante `signal.aborted`/`AbortError`; errores no-abort siguen cadena `availableModels→fallbackModel→mock` (CFG-04 intacto).
- **Code Intelligence:** codegraph no indexado en Ego (sin `.codegraph/`) → fallback grep/read directo (fuente ground truth: `ModelRouter.ts` leído completo 660 líneas + `ToolExecutionLoop.ts:195-354` + `types.ts` + `MockProvider.ts`). Sin grep-loop más allá del blast radius.

## Impacto mapeado (Regla 0)
- **Archivos leídos completos:** `packages/models/src/ModelRouter.ts` (660L) · `packages/models/src/types.ts` (123L) · `packages/models/test/cfg04-aliases-fallback.test.ts` (243L) · `packages/models/test/ModelRouter.test.ts` (332L) · `packages/models/src/providers/MockProvider.ts` (113L) · `packages/runtime/src/ToolExecutionLoop.ts` parcial (líneas 1-80, 195-354, grep abort/checkpoint).
- **Referencias hacia dentro (lo que toca el cambio):** `generateText:529-549` (catch-all → `runFallbackChain`) · `streamText:554-574` (idem) · `runFallbackChain:487-524` (loop eslabones + mock final) · `attemptWithRotation:417-448` (no-abort, intacto) · helper nuevo `isAbortError` local a models.
- **Referencias entrantes (quién llama):** `ToolExecutionLoop.run:331-346` (`router.generateText` con `abortSignal`, catch → `abortResultForError`) · `ToolExecutionLoop` líneas 521/671/847 (otros `abortSignal` fuera de alcance) · tests `cfg04-*` (14 tests) + `ModelRouter.test.ts` (17 tests).
- **Veredicto de impacto:** BAJO-MEDIO acotado a `packages/models/src/ModelRouter.ts` + 1 archivo de test extendido. Riesgo medio (hot path inferencia): el fix toca solo la ruta abort (1 variable controlada); fallback no-abort (500/timeout) debe seguir a cadena (pre-mortem). PROHIBIDO TOCAR: `ToolExecutionLoop.ts` (solo lectura), `types.ts` (solo lectura), y lista del prompt (renderer/main/ipc-schema/memory/tasks/tools/events/subegos/docs-vitepress/docs-public/docs-deployment/floating/AttentionStateMachine/ui-runtime/electron.vite.config/Arreglar-OpenCode/Untitled-1/robot-chat).

## Contrato
"Abort mid-token inmediato sin mock fantasma + test abort verde + typecheck models 0 errores + sin regresión ModelRouter 17/17 + cfg04 14/14."
- Acceptance: (a) abort durante generate → `AbortError` propaga inmediato, (b) 0 llamadas mock tras abort, (c) cfg04-aliases-fallback 14/14, (d) ModelRouter.test 17/17, (e) `tsc` models 0 errores.

## Spec (decisión cerrada por evidencia)
| # | Decisión | Opción A (default) | Opción B | Tradeoff | Gate P/D |
|---|---|---|---|---|---|
| 1 | Dónde re-throw ante abort | Re-throw en entrypoints `generateText/streamText` antes de `runFallbackChain` + guard en cadena (mid-chain y pre-mock) | Re-throw solo dentro de `runFallbackChain` | A: abort nunca toca ni 1 eslabón/mock; cadena intacta para no-abort; B: el entrypoint ya hizo warn + 1 salto antes de detectar | Decidido-por-evidencia: sesión abort-loop documentó 1 llamada mock desperdiciada por catch-all del entrypoint → A sin pregunta salvo que código lo contradiga (no contradice: `ModelRouter.ts:544-548,570-573` captura todo `err` incluido AbortError) |

- **Causa raíz (Iron Law):** `generateText/streamText` capturan TODO error incluido `AbortError` y caen a `runFallbackChain` → aunque el loop detiene después (checkpoint post-generate), se desperdicia 1 llamada mock (+ eslabones disponibles). Evidencia sesión abort-loop + código `ModelRouter.ts:540-548,566-573`.
- **Hipótesis (1 variable):** `if (signal?.aborted || err.name==='AbortError') throw` antes de fallback, en ambos entrypoints + guards cadena; resto idéntico.
- **Invariantes:** errores no-abort (503/timeout/500) siguen cadena `availableModels→fallbackModel→mock`; `attemptWithRotation` intacto; `ToolExecutionLoop.ts` NO se edita; `AbortError` no es secreto (sin trust boundary nuevo).

## DoD (3 niveles)
- **Task:** contrato ✅ (31/31 tests + typecheck models 0 errores) + §Review con veredicto + task file sincronizado.
- **Commit:** LOCAL `feat: CFG-10 abort mid-token (nunca push)` solo archivos de alcance; pre-commit `code-review-and-quality` + OCR sobre `ModelRouter.ts`.
- **Release:** N/A (cambio interno sin distribución).

## Steps de ejecución
- [x] Step 1: DISCOVERY + Spec (este archivo: Metadata/Blast/Regla 0/Contrato/Spec/Invariantes/DoD/Steps/Review/Notas)
- [x] Step 2: test RED abort (2 tests nuevos en `cfg04-aliases-fallback.test.ts`: generate + stream con `AbortController.abort()`; FALLARON pre-fix resolviendo `[Stub:CHEAP:mini-model]` en vez de rechazar — causa raíz confirmada)
- [x] Step 3: fix re-throw mínimo en `ModelRouter.ts` (helper `isAbortError` + guards en `generateText`/`streamText`/`runFallbackChain` entrada/mid/pre-mock; ponytail full, `ToolExecutionLoop.ts` intacto)
- [x] Step 4: verify + OCR + review P2-01 + commit LOCAL + progreso

## Review (P2-01, veredicto registrado)
- **Modo:** fast mecánico (paths del diff: `packages/models/**` + test + task — ningún glob adversarial; `docs/agent-ops/**` = fast por tabla) + spot-check adversarial del reviewer sobre el diff final.
- **Enfoque:** ¿re-throw en entrypoint correcto? SÍ — guards en `generateText:570`/`streamText:598` antes de `runFallbackChain`, más guards cadena (entrada/mid-chain/pre-mock) para abort que aterriza mid-chain. ¿Cadena intacta para no-abort? SÍ — tests 503/timeout→cadena→mock siguen verdes (`ModelRouter.test.ts` fallback 2/2 + cfg04 cadena 5/5).
- **Cómo se probó:** `npx vitest run` en `packages/models`: 9 files / 82 passed (cfg04 16/16 = 14 legacy + 2 abort nuevos; ModelRouter 17/17 sin regresión). `pnpm --filter @ego/models typecheck`: 0 errores. Tests abort: `AbortController.abort()` + provider que lanza `DOMException AbortError` + `vi.spyOn(MockProvider.prototype, ...)` con `not.toHaveBeenCalled()` (0 llamadas mock).
- **Trade-off documentado (doubt-driven):** `isAbortError` por mensaje (`includes("aborted")`) puede falsos-positivos ante un error no-cancelación con esa palabra; se acepta por paridad con el clasificador del loop (`ToolExecutionLoop.ts:22-30`) y porque `signal?.aborted` es autoritativo cuando hay señal. Sin cross-model (contexto no-interactivo de subagente — skip anunciado).
- **OCR:** `ocr-review.ps1` preview: mis 3 archivos (`ModelRouter.ts` +29, providers 1+1) sin hallazgos Critical/High; resto del preview = trabajo de workers paralelos Wave 0 (no mío, no commiteado).
- **Colateral Gate C (fuera de clave, fix rápido inline):** typecheck baseline tenía 4 errores preexistentes strict-null en `MockProvider.ts:44` (`match[1] ?? ""`) y `OpenAICompatibleProvider.ts:264` (`if (!entry) continue` dead-path); 2 líneas, 0 cambio de conducta, exigidos por acceptance (e). Diff confirma alcance: solo models+test+task.
- **Veredicto:** approve (fast). Reviewer-context: relectura fresca del diff final vs contrato; author-context: implementación TDD RED→GREEN.
- **last-synced:** 2026-10-16

## Registro de Cumplimiento / Veredicto
- **Estado:** ✅ COMPLETED
- **Evidencia:** `npx vitest run` (`packages/models`) 9 files / 82 passed · `pnpm --filter @ego/models typecheck` 0 errores · RED pre-fix documentado (2 failed resolviendo stub CHEAP) → GREEN post-fix
- **Deuda:** ninguna en CFG-10. Pre-mortem cubierto: fallback no-abort intacto (tests 500/timeout→cadena verdes).
- **Rollback:** `git revert <commit CFG-10>` (aislado en models + 1 test + task).
- **last-synced:** 2026-10-16

## Notas
- Clean-code Ap. V leído (V.1 mapa capas: `packages/models` = adaptador interfaz/gateway; V.2 TS strict sin `any`; V.4 severidades). Testing-patterns AAA + 1 assert/test + RED-antes-GREEN. Security-checklist: sin trust boundary nuevo.
- ADRs: 0002-vantadb-primero (no aplica), 0003-renderer-tonto (no aplica).
- Internet: no requerida (AbortController/AbortError estándar). Sin citas.
- Rollback: `git revert <commit CFG-10>` (cambio aislado en models + 1 test).
- Referencias: RULES.md, definition-of-done.md, backlog-format.md, testing-patterns.md, clean-code Ap. V, security-checklist.
- **last-synced:** 2026-10-16
