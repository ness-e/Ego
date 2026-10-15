# T-isla-10-tray — Tray completo + persistencia flotante (WIDG-05, COUC-19 cierre)

Estado: ✅ COMPLETADA (Wave 6, commit 6de7291; header sincronizado post-cierre)
Plan: docs/agent-ops/plans/2026-10-15-isla-flotante-ego-completa.md (Task 10)
SDP: frontend-ui-engineering (tray/WindowStateManager) + test-driven-development (RED→GREEN) + source-driven-development (tray.rs pattern). Sin red: fuentes locales.

## Contrato
(a) Extender `apps/desktop/src/windows/WindowStateManager.ts` de `main_window` a
`floating_window {x,y,muted,disabled,presenceMode}`: restore/track/debounce 500ms/
persist VantaDB `system/window-state` + `window-state.json` + `validateBoundsAgainstDisplays`.
(b) `main.ts` tray: menú Open/Settings/Pause/Quit + emit `tray:id`, tooltip verde idle/
azul pensando/rojo HITL (base Task4 existe → completar **Pause** que pausa
BackgroundEngine + `repositionToDisplay()` en `screen-changed`/`display-metrics-changed`).
(c) Test `apps/desktop/test/floating-persist.test.ts` (restore/track/persist roundtrip)
+ `tasks-wiring` existente verde.
Acceptance: persist roundtrip PASS, Pause pausa engine PASS, reposition llamado en
screen-changed PASS; `pnpm --filter @ego/desktop test floating-persist tasks-wiring -v`
PASS + typecheck 0.

## Spec (Gate D — GO declarado por orquestador, sin re-preguntar)
| # | Decisión | Evidencia / valor |
|---|----------|-------------------|
| D1 | Clave VantaDB `system/window-state` + key `floating_window` (misma namespace que `main_window`) | `WindowStateManager.ts:111-117` usa `namespace:"system/window-state", key:"main_window"` — extender con segunda key |
| D2 | `presenceMode: "auto" \| "always" \| "never"`, default `"auto"`; `"never"` ≡ `disabled:true` para migración | Sin uso previo en repo (`grep presenceMode` = 0 matches) — símbolo nuevo, formato fijado por este task file |
| D3 | Sin TTL: persistencia indefinida igual que `main_window` (WIDG-05 exige restore tras crash) | `loadState()` sin expiración hoy |
| D4 | Migración tolerante: registros viejos sin `muted/disabled/presenceMode` → defaults `false/false/"auto"` vía `safeParse` + merge | `loadState()` ya ignora parse fallido y cae a fallback |
| D5 | Archivo fallback: misma `window-state.json` con envelope `{main_window, floating_window}`; lectura tolera el shape viejo plano (solo main) | `fallbackFilePath` hoy `window-state.json` plano |
| D6 | Pause = pausar tareas `running`+`queued` del BackgroundEngine (`pause(taskId)` c/u); NO cierra ventanas; Resume re-encola vía `resume()` | `BackgroundEngine.ts:296-333` solo expone `pause(taskId)/resume(taskId)`, sin `pauseAll` |
| D7 | Menú tray: Abrir Ego / Pausar tareas / Reanudar / Configuración / Salir; `tray:id` emitido como `webContents.send("tray:id", …)` al renderer principal | Base `ensureTray()` `main.ts:534-572` hoy solo Mostrar/Salir |
| D8 | `repositionToDisplay()` en `screen.on("display-metrics-changed"|"display-added"|"display-removed")`; `FloatingWindow.repositionToDisplay` existe (`FloatingWindowView.ts:125`) pero nunca llamado desde main (gap) | `grep repositionToDisplay` en `main.ts` = 0 matches |
| D9 | Wayland: `screen-changed` puede no dispararse — documentado como límite, fallback valida bounds al restore | `validateBoundsAgainstDisplays` ya existe |

## Impacto mapeado (Regla 0)
- Archivos leídos completos: `WindowStateManager.ts` (223L), `FloatingWindow.ts` (142L),
  `FloatingWindowView.ts` (154L), `main/tray-status.ts` (57L), `test/window-state.test.ts`,
  `test/tasks-wiring.test.ts`, `test/main-tray-status.test.ts`, `test/floating-autoshow.test.ts`,
  `main.ts` §§446-572 (tray), §§2990-3319 (engines+ready), §§4690-4713 (IPC), §5368 (getter);
  `BackgroundEngine.ts` §§280-380 (pause/resume/listTasks).
- Referencias hacia dentro (lo que toco usa): `electron` (BrowserWindow/screen/Tray/Menu),
  `zod`, `node:fs/path`, `EgoMemoryAdapter.put/get` (`system/window-state`), `BackgroundEngine`
  (`pause/listTasks/getActiveCount`), `FloatingWindowManager` (`show/hide/getState`),
  `TRAY_COLORS/trayTooltipFor` (`main/tray-status.ts`).
- Referencias entrantes (quién usa lo que toco): `main.ts` → `WindowStateManager`
  (`restoreState/trackWindow`, `getWindowStateManager` export); tests → `main.ts` por
  lectura de fuente (`tasks-wiring`); `FloatingWindow.test.ts` / `floating-autoshow` →
  `FloatingWindow.js`; `main-tray-status` → `tray-status.js`. Ningún test existente toca
  `floating_window` (símbolo nuevo).
- Veredicto: impacto BAJO-MEDIO, contenido a 2 archivos fuente + 1 test nuevo.
  `WindowStateManager`: solo AÑADE (schema + métodos `*Floating*`), no cambia conducta
  `main_window` (tests `window-state.test.ts` deben seguir verdes). `main.ts`: hunks
  mínimos en `ensureTray` + 1 función `pauseAllBackgroundTasks` + suscripción `screen`;
  riesgo STAB (god-file) mitigado con hunks pequeños y sin tocar otro wiring.
  Efecto: posición/mute/presence sobreviven reinicio+crash; Pause detiene background
  sin cerrar; multi-monitor/DPI ok vía `validateBoundsAgainstDisplays`; Wayland límite doc.

## Steps
- [x] S1 DISCOVERY: plan + Regla 0 + Spec evidencia + Save Point (este file)
- [x] S2 RED: `test/floating-persist.test.ts` creado → 8 FAIL verificados (símbolos inexistentes)
- [x] S3 GREEN (a): `WindowStateManager.ts` → schema `floating_window` + restore/track/persist + envelope
- [x] S4 GREEN (b): `main.ts` → tray Abrir/Config/Pausar/Reanudar/Salir + `pauseAllBackgroundTasks` + screen-changed → `repositionToDisplay`; `tray-status.ts` helpers puros; `FloatingWindow.ts` delegates
- [x] S5 VERIFY: `pnpm test floating-persist tasks-wiring` 13/13 PASS + typecheck 0 + Review Fast
- [x] S6 CIERRE: RESULTADO §7 + GATES + SKILLS (NO commit — orquestador; NUNCA push)

## Verify log (2026-10-15)
- RED: `vitest run test/floating-persist.test.ts` → 8 failed (`is not a function` ×6 + asserts wiring ×2)
- GREEN: `pnpm --filter @ego/desktop test -- floating-persist tasks-wiring` → 2 files, 13 tests PASS (vía path canónico con pretest ensure-fresh-dist)
- `pnpm --filter @ego/desktop typecheck` → 0 errores (1 fix intermedio: tipo `FloatingWindowExtra` en fallback `{}`)
- Regresión: `window-state` 3/3, `main-tray-status` 4/4, `floating-autoshow` 8/8 PASS
- Colateral pre-existente (NO regresión): `FloatingWindow.test.ts` 6/6 FAIL idéntico en árbol prístino (stash check) — mock sin `webContents.on`/`setWindowOpenHandler` (deuda Task3 → Task11-E2E)
- Review Fast (spot-check reviewer): hunks aditivos, sin cambios de conducta `main_window`, menú preserva `new Tray(` (tasks-wiring verde) → approve
