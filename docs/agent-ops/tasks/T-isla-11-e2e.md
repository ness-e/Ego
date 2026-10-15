# T-isla-11-e2e — Tests + validación + verificación isla (E2E minimize/HITL, caos, a11y, perf, packaging)

Estado: ✅ VERIFICADO (Wave 7; pendiente commit del orquestador — NO commit, NUNCA push)
Plan: docs/agent-ops/plans/2026-10-15-isla-flotante-ego-completa.md (Task 11)
SDP: test-driven-development (E2E RED→GREEN) + systematic-debugging (diagnóstico mock x6 + caos resume) + code-review-and-quality (revisión suite) + campaign-executor/progreso (base).
Skills cargadas: test-driven-development, systematic-debugging, code-review-and-quality.

## Contrato
(a) Crear `tests/e2e/floating-minimize.test.ts` (vitest: 1.task background real → 2.minimize decision `shouldAutoShow` → 3.flotante visible `show()` sin robar foco → 4.click restaura `hide()`+restore → 5.HITL approval en flotante resuelve con ActionIdentity exacta).
(b) Crear `tests/gui/specs/floating-island.spec.ts` (Playwright GUI contra dev-server `/floating/floating.html`: mount points + a11y DOM; corre en suite GUI, no en este runner).
(c) Checklist: `pnpm --filter @ego/desktop typecheck` 0; vitest flotante (autoshow, views, sound, upload, persist, hitl) verdes; `pnpm build` + `smoke:native` + verify-dist con `floating.html` emitido; caos kill-mid-task→resume checkpoint (TASK-10 existente); a11y reduced-motion + foco visible + Esc/Enter; perf RAF detenido en hidden; packaging DIST con floating.html + avatar vendor + límite Wayland documentado.
(d) Deuda: `FloatingWindow.test.ts` x6 rojo por mock sin `webContents.on` (colateral SEC-01) → FIND con evidencia, NO fix ajeno.
Acceptance: E2E nuevo PASS (o INCOMPLETO con evidencia si requiere display real) + suites unitarias verdes + build verde.

## Spec (Gate D — decisiones con justificación por evidencia, sin asunciones silenciosas)
| # | Decisión | Evidencia / valor |
|---|----------|-------------------|
| E1 | `tests/e2e/floating-minimize.test.ts` en **vitest**, NO `@playwright/test` | 7/7 archivos `tests/e2e/*.test.ts` usan `vitest` (`describe/it`); `tests/package.json:8` runner = `vitest run`; convención E2E-Electron = `tests/gui/electron/*.electron.ts` (`shell.electron.ts:11-14` explica que vitest solo entiende `*.test.ts/*.spec.ts`). El snippet del plan con `import from "@playwright/test"` en `tests/e2e/` rompería la colección vitest → se adapta (formato, no fondo: los 5 pasos se ejercen igual) |
| E2 | Cadena behavioral a nivel integración con `electron` mockeado + asserts de source-read para wiring/a11y/perf/packaging | Patrón probado ×3 (`floating-autoshow.test.ts:9-44`, `floating-persist.test.ts:16-55` mocks; `floating-persist.test.ts:58,211-223` source-read de `main.ts`). Sin display en runner → Electron real imposible |
| E3 | `tests/gui/specs/floating-island.spec.ts` = spec Playwright real contra dev-server (`/floating/floating.html`), mount points + a11y DOM | Convención GUI: `playwright.config.ts:8-16` baseURL `127.0.0.1:5173`, owner levanta `pnpm dev`; `floating.html:28-34` mount points estables `#floating-root/#ticker/#approval-card/#countdown`. No se corre aquí (sin dev-server) → documentado |
| E4 | E2E Electron real con display (minimize nativo → flotante visible → click restaura) queda **INCOMPLETO reanudable**, next = `tests/gui/electron/floating-minimize.electron.ts` | Patrón `shell.electron.ts` (launch Electron + `firstWindow` + `test.skip` sin bundle/binario); runner sin display/Xvfb → no forzar (brief §8). Evidencia de cadena cubierta por E2E vitest |
| E5 | Timeouts = defaults vitest + `vi.waitFor`; seeds sintéticos (sin VantaDB real) | `task-kill-chaos.test.ts:42-55` mockAdapter en memoria; BackgroundEngine real `@ego/tasks` |
| E6 | `FloatingWindow.test.ts` x6 rojo → FIND, NO tocar mock ajeno | Colateral SEC-01 pre-existente verificado en T-isla-10 (stash check árbol prístino); mock `FloatingWindow.test.ts:15-17` sin `webContents.on`/`setWindowOpenHandler` vs `FloatingWindowView.ts:63,75` que los llama en `createWindow()` |

## Impacto mapeado (Regla 0)
- Archivos leídos completos: `FloatingWindow.ts` (164L: `shouldAutoShow/syncFromAttention/FloatingWindowManager`), `FloatingWindowView.ts` (154L: `createWindow/loadContent/click-through`), `floating-autoshow.test.ts` (108L: patrón mock), `FloatingWindow.test.ts` (130L: mock sin webContents.on), `floating-persist.test.ts` (224L: patrón source-read + wiring asserts), `task-kill-chaos.test.ts` (112L: caos+checkpoint), `floating.html` (37L: mount points + CSP), `floating.tsx` (82L: `FloatingApp`), `WidgetHitlBridge.test.ts` (contrato ACK/resolve/digest), `WidgetHitlBridge.ts` (ACK 800ms + `resolve` identidad), `main.ts:3340-3406` (minimize→autoshow→track + screen-changed), `shell.electron.ts` (133L: convención E2E), `03-hitl.spec.ts` (honest-skip), `electron.vite.config.ts:41-45` (input floating MPA), `tests/package.json` (runner vitest).
- Referencias hacia dentro (lo que toco usa): `shouldAutoShow`, `FloatingWindowManager.show/hide/updateState/getState`, `WidgetHitlBridge.presentApproval/acknowledgePresentation/resolve`, `BackgroundEngine.submit/cancel/getActiveCount`, `TaskCheckpointManager.save/loadLatestCheckpoint`, `computeActionIdentity`, `node:fs` source-reads. Ningún símbolo nuevo de producción.
- Referencias entrantes (quién usa lo que toco): nadie — archivos de test nuevos; `tests/e2e` runner los recoge por glob `e2e/**/*.test.ts` (`tests/tsconfig.json:8`); GUI suite recoge `specs/*.spec.ts`.
- Veredicto: impacto NULO en producción (solo tests nuevos + 0 ediciones `src/`); riesgo: resolución de `electron` mockeado en workspace `tests/` (mitigado: `vi.mock` factory no requiere módulo real; se verifica corriendo). PROHIBIDOS respetados: sin tocar `src/main.ts`, `renderer/floating/*`, `packages/*`, `docs/roadmap`, verify-audit.jsonl.

## Steps
- [x] S1 DISCOVERY: plan + Regla 0 + Spec evidencia + Save Point (este file)
- [x] S2 RED→GREEN: `tests/e2e/floating-minimize.test.ts` creado (5 pasos + caos + asserts estáticos) → 10/10 PASS (1 fix: mock `electron` por ruta con mismo realpath, ver Verify log)
- [x] S3 GUI SPEC: `tests/gui/specs/floating-island.spec.ts` creado + gate `check-gui-coverage.cjs` VERDE (15 specs, 0 fallos; dev-server DOWN = ejecución real pendiente owner)
- [x] S4 VERIFY: suites flotante + typecheck + build/smoke/verify-dist VERDES + Review Fast approve
- [x] S5 CIERRE: FIND mock x6 + Esc-gap + RESULTADO §7 + GATES + SKILLS (NO commit — orquestador; NUNCA push)

## Verify log
- S2 E2E nuevo: `pnpm --filter @ego/e2e-tests test floating-minimize` → 10/10 PASS. RED inicial 8/10 con `screen` undefined (mock `electron` no interceptaba: no resuelve desde workspace `tests/`); fix contenido al test (mock por ruta `../../apps/desktop/node_modules/electron`, mismo realpath pnpm store) → GREEN 10/10. Re-verificado tras fix de tipos (ToolCategory `terminal`, ToolRiskLevel `destructive`, `as any` patrón existente).
- S2b typecheck: `pnpm --filter @ego/e2e-tests typecheck` → 0 errores en `floating-minimize.test.ts` (errores restantes pre-existentes en `security/`, `ui-runtime/`, otros `e2e/*.test.ts` — archivos no tocados).
- S3 GUI: `node scripts/check-gui-coverage.cjs` (tests/gui) → GATE VERDE, 15 specs, 0 fallos (dev-server DOWN = ejecución Playwright real pendiente del owner).
- S4 suites contrato: desktop `floating-autoshow` 8/8 + `floating-persist` 8/8 + `tasks-wiring` 5/5 (21/21); renderer `floating-views` 16/16 + `floating-sound` 12/12 + `floating-upload` 11/11 (39/39); execution `WidgetHitlBridge` 9/9.
- S4 typecheck: `pnpm --filter @ego/desktop typecheck` → 0 errores.
- S4 build: `pnpm --filter @ego/desktop build` → VERDE + `verify-dist` TODOS LOS CHEQUEOS EN VERDE; `out/renderer/floating/floating.html` emitido (1538 bytes); `smoke:native` TODOS LOS CHEQUEOS EN VERDE.
- S4 deuda: `FloatingWindow.test.ts` 6/6 FAIL `webContents.on is not a function` (`FloatingWindowView.ts:63` vs mock `FloatingWindow.test.ts:15-17`) — colateral, ver FIND-11-01.
- S4 Review Fast (spot-check): solo 2 archivos test nuevos, 0 ediciones `src/`; mocks/`as any` siguen patrones existentes; asserts de source-read pineados a líneas verificadas → approve.

## Findings
- FIND-11-01 (colateral Task3/SEC-01, NO fix ajeno): `apps/desktop/test/FloatingWindow.test.ts` 6/6 rojo — mock `webContents:{send}` sin `on`/`setWindowOpenHandler`, pero `FloatingWindowView.ts:63,75` los llama en `createWindow()`. Evidencia fresca 2026-10-15 (`pnpm --filter @ego/desktop test FloatingWindow` → 6 failed, `TypeError: this.window.webContents.on is not a function`). Owner del mock: Task3. Fix de 2 líneas cuando el owner lo autorice.
- FIND-11-02 (gap checklist Task11 vs Task6, menor): sin manejo `Escape` en `renderer/floating/*` ni `apps/desktop/src` (`grep Escape` = 0 matches) — ítem "Esc colapsa" del checklist no implementado. `Enter` idempotente sí evidenciado (`views.tsx:317`). Propuesta: keydown Esc→colapsa en `floating.tsx` o ViewHost (Task6 follow-up o Task12-docs como deuda).
