# STAB-07 — CI DB real + colecta + RTL obligatorio inicio

> **Estado:** ⏳ IN PROGRESS (DISCOVERY completo, ACT en curso)
> **Plan:** `docs/agent-ops/plans/2026-10-16-plan-estabilizacion-ego.md` Task 8
> **Contrato:** job `integration-real-db` con `EGO_REAL_DB=1` + napi prebuilt verde + `pnpm test:e2e` excluye `tests/gui/specs` + RTL sin gate (import estático, falla si falta dep)
> **SDP:** `test-driven-development` + base (bug verde-falso + config CI; keywords: `integration-real-db`, `vitest exclude`, `RTL static import`)
> **Skills cargadas:** `test-driven-development` (skill tool) + base auto (campaign-executor, progreso, ponytail vía MCP)

## Spec (por-evidencia — sin símbolos públicos nuevos)

Sin símbolos/contratos públicos nuevos: solo config CI, config vitest, imports de test y docs. Cada decisión con evidencia:

| # | Decisión | Alternativas | Evidencia (un solo camino viable) |
|---|----------|--------------|-----------------------------------|
| 1 | Job CI obtiene binding vía checkout+build napi en runner | (a) checkout `ness-e/Vantadb` + `npm run build` napi; (b) vendorizar `.node` prebuilt en git | ✅ (a) — (b) mete binario plataforma-específico en git (mala práctica, 7 targets napi en `vantadb-node/package.json`); (a) da ABI exacta Node 22 del runner. Ref: `C:/Users/Eros/VantaDB Proyect/VantaDB/vantadb-node/package.json` targets ×7. Gate D registrado, fallback fail-soft pre-autorizado por task (DETALLE §6) |
| 2 | Job fail-soft inicial (`continue-on-error: true`) | hard desde día 1 vs fail-soft | ✅ fail-soft — Risk Register plan: "Nativo no compila en CI y bloquea todo → Job separado fail-soft inicial, luego hard" (`plan:226`). STAB-11 lo endurece |
| 3 | `tests/vitest.config.ts` con `include` espejando `tests/tsconfig.json` + `exclude gui/**` | solo `exclude` vs include+exclude | ✅ include+exclude — `tests/tsconfig.json` ya fija `include: e2e/security/chaos`; vitest default include `**/*.{test,spec}` es la causa raíz. Espejar tsconfig evita divergencia futura |
| 4 | RTL: import estático + `cleanup()` en afterEach | mantener `innerHTML=""` vs `cleanup()` | ✅ `cleanup()` — `Omnibar.rtl` falla en teardown: `removeChild` happy-dom vs contenedor React 19 (`react-dom-client.development.js:19075`). `innerHTML=""` arranca el nodo que RTL auto-cleanup intenta desmontar. Evidencia: run 2026-10-15 `1 failed | 1 passed` |
| 5 | No tocar `setup.ts` (jest-dom dinámico) ni `verify` (stub) | volver todo estático | ✅ mínimo — setup dinámico funciona y no rompe; stub `get→null` queda solo en `verify` rápido por contrato ("mantener stub get→null solo en verify rápido") |

## Impacto mapeado (Regla 0)

**Archivos leídos completos:** `.github/workflows/ci.yml` (165L), `apps/desktop/test/ipc.integration.test.ts` (278L), `apps/desktop/renderer/test/Omnibar.rtl.test.tsx` (38L), `ApprovalCard.rtl.test.tsx` (62L), `tests/e2e/golden-path-alpha.test.ts` (158L), `tests/package.json`, `tests/tsconfig.json`, `apps/desktop/renderer/package.json` (RTL deps 37-39), `apps/desktop/renderer/vite.config.ts` (test globals happy-dom + setupFiles), `apps/desktop/renderer/test/setup.ts` (315L), `docs/engineering/testing-e2e.md` (111L), `packages/memory/EgoMemoryAdapter.ts:276-281` (`NativeVantaDB.connect`), `vantadb@0.8.0/dist/native.js:152-160` (`import("vantadb-node")` + `VantaDb.connect` + catch `connect (is the native binding built?...)`), `packages/memory/package.json` (deps `vantadb 0.8.0` + `vantadb-node file:../../../VantaDB/vantadb-node`).

**Referencias hacia dentro (el cambio depende de):** `NativeVantaDB.connect` ← `vantadb-node.VantaDb.connect` (verificado local: exporta `['VantaDB','VantaDb']`); `EGO_REAL_DB` gate en `ipc.integration.test.ts:53` (`describe.skipIf`); `tests/tsconfig.json` include (fuente de verdad de alcance e2e); RTL 16.3.3 + user-event 14.5.2 + jest-dom 6.6.3 instalados en `apps/desktop/renderer/node_modules/@testing-library` (import estático seguro).

**Referencias entrantes (dependen del cambio):** STAB-08 (migración RTL sistemática usa este gate — `nextTask`); STAB-11 (endurece matrix + nightly, hereda job fail-soft); `pnpm test:e2e` (raíz `package.json:22` → `@ego/e2e-tests test`).

**Causa 44 `VantaError connect` (STAB-00):** `native.js:154` `await import("vantadb-node")` + `VantaDb.connect`; stub CI (`ci.yml:52-65`) no exporta `VantaDb` → TypeError → `wrapNativeError(e,"connect...")` → `DbError` nombre `VantaError` (`errors.js: DbError name="VantaError"`). Sin binding, 44 tests caen. Este job los vuelve verdes compilando napi real en runner. Ref: `docs/agent-ops/tasks/STAB-00.md:45,48,94`.

**Veredicto:** blast radius 6 archivos (ci.yml, tests/vitest.config.ts nuevo, 2 RTL, testing-e2e.md, este task file). Sin código producto, sin memoria runtime (STAB-05), sin SharedMemory (STAB-06). Prohibidos intactos: `verify-audit.jsonl` ajeno, `.ego-worktrees/`, plan isla-flotante untracked (solo lectura de `git status`). Riesgo medio (prebuilt ABI, tsc tras RTL estático, Windows paths) → mitigado con fail-soft + verify local.

## Steps

- [x] **Step 1 — DISCOVERY:** cero-código, causa 44 documentada, RED reproducido (ipc 5/5 con `EGO_REAL_DB=1` local; `test:e2e` colecta gui→`@playwright/test` ausente; RTL `1 failed|1 passed` por `innerHTML` teardown)
- [x] **Step 2 — Colecta vitest:** creado `tests/vitest.config.ts` (include e2e/security/chaos + exclude gui/node_modules/dist) + `testing-e2e.md` § Alcance de colecta. Verify: `vitest list` EXIT 0 sin gui; `pnpm test:e2e` 9 files/47 tests ✅
- [x] **Step 3 — RTL estático:** 2 archivos con import estático + `cleanup()`, sin `hasRtl`/`skipIf`. Verify: `vitest run` 2/2 ✅ + renderer `tsc --noEmit` EXIT 0 ✅
- [x] **Step 4 — Job `integration-real-db`:** añadido a `ci.yml` (líneas 85-147: checkout Ego+VantaDB, Rust stable, build napi, `EGO_REAL_DB=1` ipc.integration + golden-path; `continue-on-error: true` fail-soft). Stub `verify` intacto. YAML validado por parse.
- [x] **Step 5 — Cierre:** verifies contrato + commit local (NUNCA push) + review pendiente + RESULTADO.

## Verify contrato (2026-10-16)

| Check | Resultado |
|---|---|
| `pnpm test:e2e` (colecta sin gui) | ✅ 9 files / 47 tests, EXIT 0 |
| RTL `Omnibar` + `ApprovalCard` | ✅ 2/2, EXIT 0 |
| renderer `tsc --noEmit` | ✅ EXIT 0 |
| `tests` (`@ego/e2e-tests`) `tsc` | ✅ EXIT 0 |
| desktop `tsc` | ✅ EXIT 0 |
| `ipc.integration` `EGO_REAL_DB=1` (DB real local) | ✅ 5/5, EXIT 0 |
| `golden-path-alpha` (DB real local) | ✅ 3/3, EXIT 0 |
| `ci.yml` YAML parse + job presente | ✅ jobs `verify, integration-real-db, e2e-electron` |
| Renderer suite completa | ⚠️ 263/265; 2 fallos `CharacterMorph` preexistentes (stash-verificado HEAD limpio) → `EGO-FIND-17` en Backlog, fuera de blast radius |

## Review (P2-01)

- **Tier:** Fast (paths: `.github/workflows/ci.yml`, `tests/`, `apps/desktop/renderer/test/`, docs — ningún glob adversarial).
- **Veredicto:** pendiente por agente distinto (orquestador). Spot-check sugerido: `ci.yml:85-147`, `tests/vitest.config.ts`, 2 RTL, `testing-e2e.md` § Alcance.

## GATE D (prebuilt ABI — 2 caminos)

- Camino A (implementado, recomendado): checkout + build napi en runner → ABI exacta, sin binarios en git.
- Camino B (descartado, documentado): vendorizar `.node` prebuilt → binario por plataforma en git, 7 targets.
- Fallback pre-autorizado (task DETALLE §6): si nativo imposible → fail-soft + DEFER endurecimiento a STAB-11 (nightly), registrado, no bloqueante. Como subagente sin tool `question`, elevo opciones en `BLOQUEO`/RESULTADO para que el orquestador pregunte al owner si quiere B o endurecer ya.
