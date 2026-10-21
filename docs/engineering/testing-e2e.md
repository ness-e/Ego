# E2E en Ego

Dos superficies E2E, separadas a propósito (no se pisan entre sí ni con CI):

| Suite | Dónde | Qué cubre | Runner |
|---|---|---|---|
| GUI dev-server | `tests/gui/specs/` + `tests/gui/playwright.config.ts` | 13 ítems del checklist T10-Step-3 contra `pnpm dev` (ver `tests/gui/README.md`) | `playwright test` (config por defecto) |
| Electron mínimo | `tests/gui/electron/` + `tests/gui/electron.playwright.config.ts` | smoke del shell real: `_electron.launch` sobre `out/main/main.js`, header Ego + Chat + Canvas | `playwright test --config=electron.playwright.config.ts` |
| Vitest e2e/resiliencia | `tests/e2e/`, `tests/chaos/`, `tests/security/` | golden path, caos, seguridad (sin ventana) | `pnpm test:e2e` |

## Puertas de calidad del job `verify` (no E2E)

Además de los E2E, el job `verify` de `.github/workflows/ci.yml` corre una
cadena de puertas **bloqueantes**: lint, typecheck, tests, la puerta del
design system (`node apps/desktop/scripts/design-lint.cjs`, reglas R1–R7 —
ver [`docs/design/design-system.md`](../design/design-system.md) §10),
`sync:check`/`geometry:check` del avatar, `verify-harness`,
`verify-ci-triggers`, `verify-vantadb-ids` y `verify-paths`. La puerta de
diseño se ejecuta **antes** del typecheck, los tests y el build (fail-fast).

Inventario completo y detalle de cada puerta:
[`docs/testing/estrategia.md`](../testing/estrategia.md).

## E2E Electron mínimo (`test:e2e:electron`)

### Precondiciones (las hace el owner, una vez)

```powershell
# 1. Raíz del repo: binario Electron + bundle compilado
pnpm install --frozen-lockfile
pnpm build   # genera apps/desktop/out/main/main.js + out/renderer/

# 2. Runner Playwright (paquete standalone, fuera del workspace):
cd tests/gui
pnpm install
```

No requiere `npx playwright install` (no usa Chromium empaquetado: maneja el
Electron real) ni firmas, ni empaquetado, ni VantaDB real (vale el stub de CI:
el smoke solo verifica que el shell pinta, no memoria ni modelos).

### Cómo correrlo

```powershell
# Desde la raíz del repo:
pnpm test:e2e:electron

# O directo en el paquete:
cd tests/gui
pnpm test:e2e:electron
```

### Qué hace (`tests/gui/electron/shell.electron.ts`)

1. `_electron.launch` con `executablePath` = Electron del workspace
   (`apps/desktop/node_modules/electron/dist/`, override con
   `ELECTRON_EXECUTABLE`), `args` = `out/main/main.js` (override con
   `EGO_ELECTRON_MAIN`), `cwd` = `apps/desktop` y `NODE_ENV=production`
   (carga `out/renderer/index.html` en disco, sin dev-server ni DevTools).
2. `electronApp.evaluate` en el proceso **main**: mockea
   `dialog.showOpenDialog/showSaveDialog/showMessageBox` (retornan
   "cancelado") y lee `BrowserWindow.getAllWindows().length` (≥ 1).
3. En la ventana: header (`Ego` + `Cognitive OS`), panel Chat
   (`section[aria-label="Chat"]`), pestaña Canvas → monta `CanvasRuntime`
   (marcador `Superficie Generativa`, ver
   `apps/desktop/renderer/components/canvas/CanvasRuntime.tsx:98`).
4. Cierra la app y borra los temporales (`--user-data-dir` y
   `EGO_WORKSPACE_PATH` apuntan a `os.tmpdir()`).

Si falta el bundle o el binario, el test hace `skip` honesto (no verde
falso) indicando el comando que falta.

### Aislamiento respecto a CI actual (diseño anti-rotura)

- Archivos nuevos con sufijo `*.electron.ts` + `testMatch` propio: vitest
  (`pnpm test:e2e`) solo recolecta `*.test.ts`/`*.spec.ts`, así que ni ve
  este test; `pnpm test` (`pnpm -r test`) tampoco (paquete standalone, fuera
  del workspace).
- `tests/gui/playwright.config.ts` intacto (`testDir: ./specs`); la config
  Electron es un archivo nuevo aparte.
- Scripts aditivos: `test:e2e:electron` no toca `test`, `test:e2e` ni `build`.
- Cero código producto tocado (`main.ts`, renderer intactos).
- Typecheck owner-side: `npx tsc --noEmit -p tsconfig.json` en `tests/gui`
  (tras `pnpm install` del paquete).

### Alcance de colecta (STAB-07)

`pnpm test:e2e` (vitest en `tests/`) solo recolecta `e2e/`, `security/` y
`chaos/` (`tests/vitest.config.ts`, espejo de `tests/tsconfig.json`).
`tests/gui/specs/*.spec.ts` (Playwright, paquete standalone fuera del
workspace) y `tests/gui/electron/*.electron.ts` quedan EXCLUIDOS por
configuración — ni vitest ni `pnpm test` (`pnpm -r test`, paquete
standalone) los ven. Si se añade un nuevo directorio de tests bajo
`tests/`, añadirlo al `include` de `vitest.config.ts` y `tsconfig.json`.

> Nota histórica (2026-10-15, ya corregida en STAB-07): `pnpm test:e2e`
> recolectaba los 13 `*.spec.ts` de `tests/gui/specs/` y fallaba al
> resolver `@playwright/test` (deps standalone no instaladas en CI).

## Coverage (renderer, opt-in — no exigible en CI)

- Dep: `@vitest/coverage-v8` en `apps/desktop/renderer/package.json`
  (solo declarado, sin install en este cambio).
- Config: `test.coverage` en `apps/desktop/renderer/vite.config.ts` con
  thresholds 70% (lines/functions/branches/statements), proveedor `v8`.
- Un threshold global exigible rompería la línea base existente (el
  renderer no llega hoy al 70% global), así que el objetivo 70% aplica
  solo a archivos NUEVOS y se verifica manualmente con:

```powershell
pnpm --filter @ego/renderer exec vitest run --coverage
```

- `pnpm test` / job CI `verify` corren `vitest run` SIN `--coverage`, por
  lo que esta config no puede romper el verify actual.

## Matriz 3 SO + Xvfb (STAB-11 ✅ implementado)

- Job `e2e-electron` (`.github/workflows/ci.yml`) con `strategy.matrix:
  [ubuntu-latest, windows-latest, macos-latest]` (`fail-fast: false`):
  ubuntu hard, win/mac `continue-on-error` (fail-soft inicial) —
  TODO: endurecer a hard con 3 runs verdes por SO.
- En Linux el run va envuelto en `xvfb-run -a` (Electron necesita
  servidor X; `-a` elige display libre en runners compartidos). Win/mac
  tienen display nativo. `shell: bash` global en el job.
- Timeouts: job `timeout-minutes: 30`; test `timeout: 180s` + `expect:
  30s` + `firstWindow: 60s` (arranque lento en runners compartidos).
- Artefactos por run (`if: always()`): `playwright-report/` +
  `test-results/` como `playwright-electron-<os>` (retención 14d).
  La config Electron lleva reporter `html` para que el artefacto tenga
  contenido.
- `npx playwright install --with-deps` corre en el job Linux si el
  runner necesita libs del sistema para Electron (ya incluido en `ci.yml`).

## Visual baselines (STAB-11)

- Config separada `tests/gui/visual.playwright.config.ts` (NO toca
  `playwright.config.ts`: el contrato T22 sigue sin `webServer`): levanta
  su propio `webServer` (vite dev del renderer) para ser autocontenida
  en CI y solo recolecta `specs/14-visual.spec.ts`.
- 3 shots en chromium: `shell-full` (full page), `panel-chat`
  (`section[aria-label="Chat"]`), `area-trabajo`
  (`section[aria-label="Área de trabajo dinámica"]`) — verificado
  contra `App.tsx:224,283,329`.
- Tolerancia: `maxDiffPixelRatio: 0.02` (nombre canónico Playwright del
  "maxDiffRatio 0.02" del contrato) + `animations: "disabled"` +
  `caret: "hide"` para determinismo.
- `snapshotPathTemplate` con `{platform}`: baselines por-OS
  (`-win32`/`-linux`/`-darwin`, nomenclatura `process.platform`) porque el rasterizado de fuentes
  difiere (DirectWrite/CoreText/FreeType). Regenerar tras UI
  intencional: `npx playwright test --config=visual.playwright.config.ts
  --update-snapshots` + commitear el snapshot por-OS.
- Job `visual` en `ci.yml` (ubuntu chromium, fail-soft inicial hasta
  tener las 3 familias de snapshots en git) + artefacto
  `playwright-visual-ubuntu`.
- Owner local: `cd tests/gui && pnpm install && pnpm test:visual`.

## Nightly lifecycle + coverage semanal (STAB-11)

- `.github/workflows/nightly.yml` — cron `0 2 * * *` (+
  `workflow_dispatch` con `soak_minutes` para smoke cortos), job
  `nightly-lifecycle` (ubuntu, `timeout-minutes: 75`, HARD — no
  bloquea PRs así que el rojo es señal honesta):
  1. `golden-path-alpha-full.test.ts` (20 pasos, persistencia real),
  2. `chaos/task-crash-resume.test.ts` (TASK-10/OCLW-15),
  3. `chaos/soak-nightly.test.ts` (`EGO_SOAK=1`, 30min put/get/delete,
     summary JSON → artefacto `soak-summary`, retención 30d).
  Todo con binding napi-rs real (mismo provisionamiento que
  `integration-real-db`: checkout `develop` + build en runner).
- `.github/workflows/coverage.yml` — semanal domingo `0 3 * * 0`:
  renderer `vitest run --coverage`, **informativo**
  (`continue-on-error`) hasta llegar al 70% global; artefacto
  `lcov-renderer` (retención 30d).

## TODO restante (post-STAB-11)

- [ ] Endurecer e2e-electron win/mac a hard (3 runs verdes por SO).
- [ ] Commitear baselines visuales `-linux`/`-darwin` y endurecer job `visual`.
- [ ] Pin SHA checkout VantaDB (`ci.yml` + `nightly.yml` usan `develop` + TODO).
- [ ] Promover coverage a gate al llegar al 70% global.
- [ ] Segundo spec Electron (cuando exista backend de test): flujo Chat→Canvas con
      `window.ego` real en vez de solo shell.
