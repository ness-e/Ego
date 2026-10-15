# FIND-11-01 — Mock FloatingWindow.test.ts desactualizado tras guards SEC-01

Estado: ✅ COMPLETO (Wave FIND paralelo con FIND-11-02; FAIL_MODE=parallel; NO commit — orquestador selectivo; NUNCA push)
Plan: docs/agent-ops/plans/2026-10-15-isla-flotante-ego-completa.md (Task 11 deuda, T-isla-11-e2e.md:49)
SDP: test-driven-development 1.0 (RED dado → GREEN) + systematic-debugging 1.0 (repro 6 fails, causa raíz mock-vs-guards, fix mínimo) + campaign-executor/progreso (base 0.5)
Skills cargadas: test-driven-development, systematic-debugging

## Contrato
(a) Único editable: `apps/desktop/test/FloatingWindow.test.ts` (mock ~líneas 15-17 + `loadURL`/`loadFile` si se necesita).
(b) `pnpm --filter @ego/desktop test FloatingWindow -v` → 6/6 PASS (o todos los tests del archivo en verde).
(c) `pnpm --filter @ego/desktop typecheck` → 0 errores.
(d) Cero cambios en producción (`apps/desktop/src/*` prohibido), cero cambios en `renderer/*` (FIND-11-02 paralelo), `packages/*`, otros tests, `docs/roadmap`+review, `verify-audit.jsonl`, scripts ajenos.
Autorización owner: el usuario ordenó "continua con todo lo que falta", lo que levanta la prohibición de tocar mock ajeno SOLO para este archivo.

## Spec (Gate D — fix 🟢 con evidencia → justificación por evidencia por ítem, sin asunciones silenciosas)
| # | Decisión | Evidencia / valor |
|---|----------|-------------------|
| E1 | Mock `webContents` debe exponer `on` + `setWindowOpenHandler` (+ `send` existente) | `FloatingWindowView.ts:63` llama `webContents.on("will-navigate",…)` y `:75` llama `setWindowOpenHandler`; sin ellos → `TypeError: this.window.webContents.on is not a function` (repro 6/6 FAIL 2026-10-15) |
| E2 | Mock `BrowserWindow` debe exponer `loadURL` + `loadFile` (async no-op) | `FloatingWindowView.ts:97-107` `loadContent()` llama `loadURL` (dev) o `loadFile` (prod) en fire-and-forget `void`; sin ellos el `catch` traga el error pero el mock deja de espejar la API real y futuros asserts de carga fallarían |
| E3 | Seguir estilo de los mocks que SÍ pasan | `floating-autoshow.test.ts:9-44` y `floating-persist.test.ts:16-55`: `webContents {send, on, setWindowOpenHandler}` + `loadURL/loadFile vi.fn(async…)` — copiar ese bloque mínimo, sin inventar API |
| E4 | No tocar producción aunque el test falle | Contrato y guardrail: fix 🟢 acotado a test; si un assert exigiera conducta nueva de producción → Gate D BLOQUEO + STOP, no asumir |
| E5 | `vi.clearAllMocks` en `beforeEach` ya existe y se mantiene | `FloatingWindow.test.ts:36-38`; compartido con mocks de función → estado limpio entre los 6 tests |

## Impacto mapeado (Regla 0)
- Archivos leídos completos: `apps/desktop/test/FloatingWindow.test.ts` (130L: mock `vi.mock('electron')` líneas 6-33, suites WIDG-01/WIDG-02), `apps/desktop/src/windows/FloatingWindowView.ts` (154L: `createWindow()` guards SEC-01 `:63,75` + `loadContent()` `:97-111`), `apps/desktop/test/floating-autoshow.test.ts` (108L: patrón mock `:9-44`), `apps/desktop/test/floating-persist.test.ts` (224L: patrón mock `:16-55`), `docs/agent-ops/tasks/T-isla-11-e2e.md:45-49` (evidencia deuda), `docs/agent-ops/plans/2026-10-15-isla-flotante-ego-completa.md` Task 3/11 (contrato).
- Referencias hacia dentro (lo que toco usa): test → `FloatingWindow` (`FloatingWindowView.js`), `FloatingWindowManager` (`FloatingWindow.js`), `electron` mockeado (`BrowserWindow`, `screen`). Ningún símbolo nuevo de producción.
- Referencias entrantes (quién usa lo que toco): nadie importa el test (es hoja; el runner vitest lo recoge por glob). `FloatingWindowView`/`FloatingWindow` no importan el test.
- Veredicto: impacto NULO en producción (solo se añade superficie al mock del test; 0 ediciones `src/`); riesgo ~0. PROHIBIDOS respetados: `apps/desktop/src/*`, `renderer/*`, `packages/*`, otros tests, `docs/roadmap`+review.

## Steps
- [x] S1 DISCOVERY: plan + deuda + Regla 0 + Spec evidencia + RED reproducido (6/6 FAIL `webContents.on is not a function`) + Save Point (este file)
- [x] S2 GREEN: alinear mock (`on`/`setWindowOpenHandler`/`loadURL`/`loadFile`) → `test FloatingWindow -v` 6/6 PASS
- [x] S3 VERIFY: `typecheck` 0 + anti-regresión (`floating-autoshow floating-persist tasks-wiring`) 21/21 + Review Fast approve + RESULTADO §7 (NO commit — orquestador; NUNCA push)

## Verify log
- S1 RED: `pnpm --filter @ego/desktop exec vitest run test/FloatingWindow.test.ts --reporter=verbose` → 6 failed, `TypeError: this.window.webContents.on is not a function` en `FloatingWindowView.ts:63:29` vía `FloatingWindowManager.show` / `createWindow()`.
- S2 GREEN: tras alinear mock → 6/6 PASS (`FloatingWindow.test.ts`: WIDG-01 ×4 + WIDG-02 ×2).
- S3a typecheck: `tsc -p tsconfig.json --noEmit` en `apps/desktop` → 0 errores (salida vacía).
- S3b anti-regresión: `vitest run test/floating-autoshow.test.ts test/floating-persist.test.ts test/tasks-wiring.test.ts` → 3 files / 21 tests PASS.
- S3c scope: `git status` muestra solo `M apps/desktop/test/FloatingWindow.test.ts` + `?? docs/agent-ops/tasks/FIND-11-01-mock.md` como propios; resto dirty (`verify-audit.jsonl`, `Arreglar-OpenCode.ps1`, `Untitled-1.py`, `__pycache__/`, `robot-chat-follow.png`, `FIND-11-02-escape.md`) es ajeno/paralelo — NO tocado, NO commiteado.
- S3d Review Fast (P2-01, spot-check mismo agente degradado a fast mecánico — solo test, 0 ediciones `src/`): diff = +5 líneas mock (`on`/`setWindowOpenHandler`/`loadURL`/`loadFile`) espejando `floating-autoshow.test.ts:9-44`; sin lógica nueva, sin secretos, sin docs que sincronizar salvo este task file → approve.

## DoD 7
1. Implementación completa: sí (mock espeja exactamente la API que `createWindow()`/`loadContent()` invocan; sin TODO).
2. Tipado/compilación: `typecheck` 0.
3. Pruebas: 6/6 PASS + error-path cubierto (los 6 tests ejercen `createWindow()` con guards SEC-01).
4. Cero regresiones: 21/21 anti-regresión PASS.
5. Docs sincronizada: n/a salvo este task file (sin interfaz pública tocada).
6. Seguridad: sin secretos (solo `vi.fn()` mocks).
7. VantaDB upstream: n/a (sin memoria/VantaDB tocada).

## Findings
- Ninguno nuevo (causa raíz conocida: mock desactualizado tras guards SEC-01 de otro worker).
