# CFG-01 — pnpm install + verde total post-instalación
- **Estado:** ✅ COMPLETED
- **Plan:** docs/agent-ops/plans/2026-10-16-plan-configs-revision-total.md
- **Campaign ID:** plan-2026-10-16-configs-revision
- **Fecha:** 2026-10-16
- **Wave:** Wave 0 paralela con CFG-10 y CFG-11 (archivos disjuntos verificados; solo orden lógico CFG-01→CFG-02)
- **Previa:** REV-03 (verde 125/125 2026-10-16) · **Next:** CFG-02 (E2E real, requiere este install+build)
- **Archivos clave:** `apps/desktop/renderer/package.json:36-47` (devDeps RTL/MSW/coverage) · `apps/desktop/package.json:46` (devDep msw) · `apps/desktop/renderer/test/setup.ts:59-76` (mock matchMedia reduced-motion) · `packages/subegos/test/DelegationRouter.test.ts` (solo lectura si ambiental) · `apps/desktop/renderer/test/ApprovalCard.rtl.test.tsx` + `Omnibar.rtl.test.tsx` · `apps/desktop/test/fetch-proxy.test.ts` + `test/msw/handlers.ts`
- **SDP:** systematic-debugging + test-driven-development + code-review-and-quality + doubt-driven-development (descubrimiento manual desde prompt; `campaign_discover_skills_v2` no disponible en este runner — sin MCP campaign-*; documentado como degradado)

## Tarea
Activar dependencias ya declaradas (RTL, MSW, coverage-v8) vía `pnpm install` y dejar suites en verde: typechecks renderer+desktop+subegos 0 errores, RTL 2 tests corren (no skipean), MSW 4 tests corren, CharacterMorph verde, DelegationRouter verde o documentado ambiental por vantadb-node. 0 regresiones.

## Contrato
"pnpm install OK + typecheck renderer+desktop+subegos 0 errores + RTL 2 tests corren (no skipean) + MSW 4 tests corren + CharacterMorph verde + DelegationRouter: verde o documentado ambiental + 0 regresiones"

## Acceptance criteria del plan
- (a) `pnpm install` exit 0
- (b) renderer typecheck 0 errores
- (c) desktop typecheck 0 errores
- (d) subegos typecheck 0 errores
- (e) `ApprovalCard.rtl` + `Omnibar.rtl` corren (no skip)
- (f) `fetch-proxy.test.ts` 4/4 corren
- (g) CharacterMorph verde
- (h) DelegationRouter: verde o documentado ambiental

## Blast Radius
Callers: `setup.ts` ← todos los tests renderer (mock global matchMedia); `DelegationRouter.test` ← `DelegationRouter.ts` + `SubEgoRuntime.ts` + vantadb-node (nativo). Callees: RTL tests → `@testing-library/react`/user-event; MSW tests → `msw/node` setupServer. `pnpm install` no cambia comportamiento; conciliación mock solo afecta rama animada CharacterMorph; sin migración de datos. **Riesgo: bajo.**

## Impacto mapeado (Regla 0)
- Leídos completos: `apps/desktop/renderer/package.json` (devDeps RTL/MSW/coverage declaradas :36-47) · `apps/desktop/package.json` (msw devDep :46) · `apps/desktop/renderer/test/setup.ts` (mock reduced-motion :65-82) · `apps/desktop/renderer/test/CharacterMorph.test.ts` (ya trae mocks scoped EGO-FIND-17 :60-75, :153-165) · `ApprovalCard.rtl.test.tsx` + `Omnibar.rtl.test.tsx` (imports estáticos STAB-07, sin gate hasRtl) · `apps/desktop/test/fetch-proxy.test.ts` (4 tests, setupServer estático) · `packages/subegos/test/DelegationRouter.test.ts:1-80` (usa `EgoMemoryAdapter` real → depende de nativo).
- Referencias hacia dentro: RTL tests → `ApprovalCard.js`, `omnibar.js`; fetch-proxy → `../src/main.js` (`egoFetchProxied`) + `./msw/handlers.js`; DelegationRouter.test → `@ego/memory` + `../src/index.js`.
- Referencias entrantes: setup.ts ← toda suite renderer; handlers.ts ← fetch-proxy.test (+ `Chat.rtl.msw.test.tsx` probable, fuera de contrato — no tocar).
- Veredicto: install mecánico + verificación; único código tocable si falla algo: mocks scoped en tests (nunca setup.ts global salvo evidencia). **PROHIBIDO TOCAR:** `packages/models/src/ModelRouter.ts`, `apps/desktop/renderer/components/ego-chat.tsx`, `apps/desktop/src/main.ts`, `apps/desktop/src/ipc/schema.ts`, `packages/memory/*`, `packages/runtime/*`, `packages/tasks/*`, `packages/tools/*`, `packages/events/*`, `docs/.vitepress/*`, `docs/public/*`, `docs/deployment/*`, `scripts/generate-checksums.cjs`, `apps/desktop/renderer/floating/*`, `packages/runtime/src/AttentionStateMachine.ts`, `packages/ui-runtime/*`, `apps/desktop/electron.vite.config.ts`, `Arreglar-OpenCode.ps1`, `Untitled-1.py`, `robot-chat-follow.png`.

## Spec
N/A — sin símbolos públicos nuevos. Justificado por evidencia: la tarea es `pnpm install` (mecánico, sin código) + verificación de suites + conciliación de mocks ya presente en `CharacterMorph.test.ts` (EGO-FIND-17). Sin decisiones de API, datos, UX ni contratos nuevos.

## Fase 1 — Evidencia de Debugging (Iron Law)
- **Repro CharacterMorph:** `setup.ts:65-82` fuerza `prefers-reduced-motion:true` global → `CharacterMorphController.start()` toma rama corte instantáneo (`isActive false`) mientras los tests de animación esperan rama animada. **Hipótesis (pre-fix, por evidencia en código):** el mock global es la causa; el fix es mock scoped `matches:false` en los tests de animación. **Estado al abrir la tarea:** el fix YA existe en el archivo (`CharacterMorph.test.ts:60-75` animación completa, `:153-165` cancel, con comentario EGO-FIND-17) — verificar en verde, no re-implementar. 1 variable controlada: ninguna (solo verificación).
- **DelegationRouter:** `VantaError connect` por `vantadb-node` no construido = ambiental preexistente. Verificado en este runner: `require.resolve('vantadb-node')` OK desde `apps/desktop` → el nativo SÍ está disponible aquí; correr la suite y documentar resultado (verde esperado; si falla → causa raíz nueva, no asumir ambiental).
- **RTL/MSW skips:** causa era falta de install + `describe.skipIf(hasRtl)` + import dinámico en variable. Estado actual: imports estáticos (STAB-07) y deps presentes en `node_modules` — verificar que corren.

## Invariantes
- WIP ajeno intacto: `Arreglar-OpenCode.ps1`, `Untitled-1.py`, `robot-chat-follow.png`, `docs/agent-ops/plans/2026-10-15-isla-flotante-ego-completa.md`, `__pycache__/`, `docs/agent-ops/reports/verify-audit.jsonl` (modificado pre-tarea) — NO añadir al commit.
- Sin `git push` (commit LOCAL). Formato 10 columnas del plan intacto. Sin símbolos públicos nuevos.

## DoD aplicable
Correctness (contrato a–h + 0 regresiones) · Quality (sin cambios fuera de blast radius; mocks scoped, nunca global) · Integration (`pnpm build` NO requerido aquí — lo hace CFG-02; sí typechecks + suites scoped) · Docs (task file + fila plan) · Ship (commit LOCAL `feat: CFG-01 …`, review P2-01 registrado).

## Herramientas
`pnpm install` (raíz) · `pnpm --filter @ego/renderer typecheck` · `pnpm --filter @ego/desktop typecheck` · `pnpm --filter @ego/subegos typecheck` · `pnpm --filter @ego/renderer exec vitest run test/ApprovalCard.rtl.test.tsx test/Omnibar.rtl.test.tsx test/CharacterMorph.test.ts` · `pnpm --filter @ego/desktop exec vitest run test/fetch-proxy.test.ts` · `EGO_REAL_DB=1 pnpm --filter @ego/desktop exec vitest run test/ipc.integration.test.ts` (documenta si ambiental) · `pwsh .agents/dev-tools/ocr-review.ps1 -Format json` sobre paths tocados. MCP campaign-* NO disponible en este runner → verify mecánico directo por shell + estado en archivos.

## Steps de ejecución
- [x] Step 1: `pnpm install` + evidencia exit 0 (`Done in 4.7s`, `EXIT:0`; lockfile up to date, +6 paquetes)
- [x] Step 2: conciliar CharacterMorph mock → verificar verde (fix EGO-FIND-17 ya presente en `CharacterMorph.test.ts:60-75,:153-165`; suite 5/5 ✅, sin tocar `setup.ts`)
- [x] Step 3: verificar RTL (ApprovalCard 1/1 + Omnibar 1/1 corren, no skip) + MSW (`fetch-proxy.test.ts` 4/4 ✅)
- [x] Step 4: typechecks renderer ✅ + desktop ✅ + subegos ✅ (18 errores TS preexistentes `noUncheckedIndexedAccess` en 4 src → 4 guards de 1 línea, behavior-preserving) + IPC-DB con `EGO_REAL_DB=1` (5/5 ✅, nativo disponible — NO ambiental)
- [x] Step 5: verify full scoped sin regresiones (subegos 19 files/212 tests ✅; renderer 42 files/297 tests ✅ al re-run — 1 fail flaky no reproducible en run 1, sin relación: renderer nunca importa `@ego/subegos`) + OCR (Rule Group 1, sin Critical/High en paths tocados) + review P2-01 degradado + commit LOCAL + sync plan
- [ ] Gate D: decisiones cerradas por evidencia (install mecánico; mock scoped ya decidido por EGO-FIND-17; sin pregunta al usuario) — evaluado, no disparado
- [ ] Gate V: 2 fallas mismo-error → question; sin respuesta → STOP
- [ ] Gate C: si `git status` muestra fuera de blast radius → confirma alcance, no commitear ajeno

## Review (P2-01 — degradado, mismo contexto; sin agente distinto disponible en este runner)
- Enfoque: adversarial sobre el diff (4 guards de 1 línea) contra contrato "0 errores typecheck + sin cambio de comportamiento". Alternativa `!` descartada (sin uso en `packages/subegos/src`; guards explícitos = fail-closed). Ramas guardadas inalcanzables en runtime (bounds-check previo / claves literales) — cambio de comportamiento solo en rama imposible (return temprano worker / throw invariante), documentado inline.
- Cómo se probó: `pnpm --filter @ego/subegos typecheck` 0 errores + suite subegos 19/212 ✅ + renderer 42/297 ✅ + desktop MSW 4/4 ✅ + IPC-DB 5/5 ✅. OCR Rule Group 1 sin Critical/High.
- Veredicto: approve (degradado — self-review, escalar al owner si exige fresh-context).
- Cross-model: skipped (contexto no interactivo).

## Registro de Cumplimiento / Veredicto
- **Estado:** ✅ COMPLETED
- **Evidencia:** install `EXIT:0` · renderer `tsc --noEmit` 0 err · desktop `tsc` 0 err · subegos `tsc` 0 err (18 preexistentes → 0) · RTL 7/7 (CharacterMorph 5 + ApprovalCard 1 + Omnibar 1, 0 skips) · MSW 4/4 · DelegationRouter 13/13 (nativo OK, no ambiental) · IPC-DB 5/5 · subegos full 212/212 · renderer full 297/297 (re-run; 1 flaky no reproducible en run 1)
- **Deuda:** ninguna nueva. Flaky renderer run 1 sin identificar (no reproduce, fuera de blast radius) — si reaparece, abrir FIND-*.
- **Addendum alcance (Gate C):** `packages/subegos/src/{DelegationTools,DelegationRouter,SubEgoBudget,CharacterProfile}.ts` — fuera del blast radius inicial pero exigido por aceptación (d); NO están en lista PROHIBIDO. WIP ajeno intacto y excluido del commit.
- **last-synced:** 2026-10-16

## Notas
- `node_modules` raíz + workspaces ya presentes pre-tarea (RTL/user-event/coverage-v8/msw verificados con `Test-Path`); install = reconciliación, no instalación desde cero.
- Pre-mortem plan: EPERM por `vantadb_native.node` en uso → reintenta o documenta; `EGO_REAL_DB` sin nativo → ambiental, no regresión. Nativo resuelve OK en este runner.
- INVESTIGACIÓN INTERNET: no requerida (sin APIs externas ambiguas; MSW v2 setupServer + RTL v16 user-event = conocimiento interno). Sin URLs citadas → Gate TSYS-13 N/A.
- last-synced: 2026-10-16
