# E2E-ELECTRON-PROBE — Sonda display + spec Electron minimize→flotante (cierre E4 T-isla-11-e2e)

Estado: ✅ VERIFICADO (pendiente commit del orquestador — NO commit, NUNCA push)
Plan: docs/agent-ops/plans/2026-10-15-isla-flotante-ego-completa.md (Task 11, E4)
SDP: campaign-executor/progreso (base 0.5) + test-driven-development (spec RED skip documentado 1.0) + systematic-debugging (sonda display con evidencia 1.0)
Skills cargadas: test-driven-development, systematic-debugging.

## Contrato
(a) Determinar con evidencia si hay display para Electron headed. SÍ → crear `tests/gui/electron/floating-minimize.electron.ts`
siguiendo el patrón `shell.electron.ts` (launch + firstWindow + skip sin bundle/binario) que ejerza
minimize nativo → flotante visible → click restaura → HITL, e INTENTAR correrlo.
(b) NO → crear igualmente el spec con `test.skip` documentado + evidencia de la sonda.
Reglas: NUNCA flags inseguros (`--no-sandbox` PROHIBIDO); timeout corto en sondas; procesos matados al cierre.
NO commit (orquestador), NUNCA push.

## Spec (Gate D — justificación por evidencia, sin asunciones silenciosas)
| # | Decisión | Evidencia / valor |
|---|----------|-------------------|
| E1 | Spec en `tests/gui/electron/*.electron.ts` con config `electron.playwright.config.ts` | Convención E2E-Electron: `shell.electron.ts:11-14` (vitest no lo recolecta) + `electron.playwright.config.ts:13-14` (testDir electron, testMatch `*.electron.ts`) |
| E2 | Guards `test.skip` sin bundle/binario idénticos a shell | `shell.electron.ts:53-62`; bundle `out/main/main.js` + `electron.exe` existen (sonda §sonda-display) → los guards NO saltan aquí |
| E3 | Leg negativo (minimize sin trabajo → sin flotante) EJECUTABLE headed | D2 `main.ts:3355-3388` (sin trabajo = minimize normal); `floatingSnapshot()` lee `backgroundEngine` — sin semilla externa `active=hitl=0`; drivable vía `BrowserWindow.getAllWindows()[0].minimize()` desde main-evaluate (Playwright pasa el módulo electron como arg, patrón `shell.electron.ts:98-110`) |
| E4 | Leg positivo (flotante visible → click restaura → HITL) = SKIP con precondición documentada, NO fail forzado | Sin hook de siembra: preload `tasks` expone solo `list/cancel` (`preload.ts:220-223`, sin submit); `terminal.spawn` crea sesión PTY, no task de `backgroundEngine` (fuentes distintas: `main.ts:3082-3200` vs `floatingSnapshot`); restore real = click de tray OS-level (`main.ts:624`, no sintetizable por Playwright); flotante sin handler click-to-restore propio (`FloatingWindowView.ts`/`FloatingWindow.ts` — solo `show/hide`). Precedente honest-skip: `03-hitl.spec.ts` (citado T-isla-11-e2e E2). Cadena cubierta por vitest `tests/e2e/floating-minimize.test.ts` 10/10 PASS |
| E5 | Sin diálogos nativos: mock preventivo en main-evaluate | Patrón `shell.electron.ts:96-103` |
| E6 | Aislamiento: userDataDir + workspace temporales, `electronApp.close()` + rm en `finally` | Patrón `shell.electron.ts:64-67,129-132` |

## Impacto mapeado (Regla 0)
- Archivos leídos completos: `tests/gui/electron/shell.electron.ts` (133L, patrón), `tests/gui/electron.playwright.config.ts` (31L),
  `tests/gui/package.json` (runner `test:e2e:electron`), `apps/desktop/src/windows/FloatingWindow.ts` (164L:
  `shouldAutoShow/syncFromAttention/FloatingWindowManager.show/hide`),
  `apps/desktop/src/windows/FloatingWindowView.ts` (154L: `createWindow/loadContent/click-through`),
  `apps/desktop/src/main.ts` §§ `floatingSnapshot` (505-524), tray `restore` (590-634: `tray.on("click", restore)`),
  minimize/autoshow (3340-3406), preload tasks/floating bridge (218-247, 426-477 — solo lectura),
  `docs/agent-ops/tasks/T-isla-11-e2e.md` E4 (INCOMPLETO reanudable).
- Referencias hacia dentro (lo que toco usa): `_electron.launch`, `firstWindow`, `BrowserWindow.getAllWindows`,
  `floating.html` mount points (`#floating-root/#ticker/#approval-card/#countdown` — solo en cuerpo skippeado).
  Ningún símbolo nuevo de producción.
- Referencias entrantes (quién usa lo que toco): nadie — archivo `*.electron.ts` nuevo, recogido solo por
  `electron.playwright.config.ts` (`testMatch`); vitest y suite GUI no lo ven.
- Veredicto: impacto NULO en producción (1 spec nuevo + este task file). PROHIBIDOS respetados:
  sin tocar `apps/*`, `packages/*`, `specs/*`, `docs/roadmap`, review, verify-audit.jsonl.

## Steps
- [x] S1 DISCOVERY: lecturas + Regla 0 + Spec + sonda display (ver §sonda-display)
- [x] S2 ACT: creado `tests/gui/electron/floating-minimize.electron.ts` (leg negativo ejecutable + leg positivo skip con precondición)
- [x] S3 VERIFY: spec corrido headed (display SÍ): 1 passed + 1 skipped; `git status` sin junk propio (solo 2 archivos nuevos + colaterales pre-existentes no tocados)
- [x] S4 CIERRE: RESULTADO §7 + GATES + SKILLS (NO commit — orquestador; NUNCA push)

## Verify log
- Sonda display: `electron.launch` real sin flags inseguros + `firstWindow({timeout:20_000})` → `{"probe":"OK","ms":1835,"windowCount":1}`.
  Veredicto: display SÍ (Windows `SESSIONNAME=Console`; DISPLAY/XDG vacíos = normal en win32).
- Spec headed: `npx playwright test --config=electron.playwright.config.ts electron/floating-minimize.electron.ts`
  (tests/gui) → `1 passed (3.2s, leg negativo D2: minimize nativo sin trabajo → count:1 + minimized:true, sin flotante, restore sano) + 1 skipped (leg positivo: sin trabajo semilla, skip documentado)`, total 7.4s.
- `git status --porcelain`: solo 2 archivos propios nuevos (`docs/agent-ops/tasks/E2E-ELECTRON-PROBE.md`,
  `tests/gui/electron/floating-minimize.electron.ts`); `M docs/agent-ops/reports/verify-audit.jsonl` +
  `Arreglar-OpenCode.ps1, Untitled-1.py, __pycache__/, E2E-GUI-RUN.md, robot-chat-follow.png` = colaterales
  pre-existentes/paralelos (wave GUI-RUN), NO tocados.
- Review Fast (spot-check): spec sigue `shell.electron.ts` línea por línea (guards skip, launch por directorio,
  mock diálogos, fixture aislado con cleanup en `finally`); 0 ediciones `src/`; tipos manuales mínimos;
  `await using` soportado por el runner (PASS real); sin `--no-sandbox` ni flags inseguros → approve.

## Sonda display (§sonda-display — systematic-debugging, evidencia no suposición)
- Sesión: `SESSIONNAME=Console`, `DISPLAY=null`, `WAYLAND_DISPLAY=null`, `XDG_SESSION_TYPE=null`, `platform=win32`
  (Windows: DISPLAY/XDG vacíos es lo normal; `SESSIONNAME=Console` = sesión interactiva con escritorio).
- Precondiciones patrón: bundle `apps/desktop/out/main/main.js` EXISTE (204744 bytes), binario
  `apps/desktop/node_modules/electron/dist/electron.exe` EXISTE.
- Intento real: `electron.launch({executablePath, args:[DESKTOP_DIR, --user-data-dir=tmp], cwd:DESKTOP_DIR,
  env:{NODE_ENV:production, EGO_WORKSPACE_PATH:tmp}})` SIN flags inseguros + `firstWindow({timeout:20_000})`
  → `{"probe":"OK","ms":1835,"windowCount":1}`. Temp dirs eliminados + `taskkill /F /IM electron.exe` al cierre.
- **Veredicto: display SÍ** (launch headed real en 1835ms, 1 ventana, `domcontentloaded` OK).
- Sonda temporal vivió en `%TEMP%` (+ copia junto a `tests/gui` por resolución de módulos) y fue ELIMINADA tras correr;
  repo sin junk (verificable con `git status`).
