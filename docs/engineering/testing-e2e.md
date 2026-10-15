# E2E en Ego

Dos superficies E2E, separadas a propósito (no se pisan entre sí ni con CI):

| Suite | Dónde | Qué cubre | Runner |
|---|---|---|---|
| GUI dev-server | `tests/gui/specs/` + `tests/gui/playwright.config.ts` | 13 ítems del checklist T10-Step-3 contra `pnpm dev` (ver `tests/gui/README.md`) | `playwright test` (config por defecto) |
| Electron mínimo | `tests/gui/electron/` + `tests/gui/electron.playwright.config.ts` | smoke del shell real: `_electron.launch` sobre `out/main/main.js`, header Ego + Chat + Canvas | `playwright test --config=electron.playwright.config.ts` |
| Vitest e2e/resiliencia | `tests/e2e/`, `tests/chaos/`, `tests/security/` | golden path, caos, seguridad (sin ventana) | `pnpm test:e2e` |

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

> Nota de línea base (2026-10-15): `pnpm test:e2e` (vitest en `tests/`)
> ya recolecta los 13 `*.spec.ts` preexistentes de `tests/gui/specs/` y falla
> al resolver `@playwright/test` (deps standalone no instaladas en CI). Es
> anterior a este cambio y no lo empeora: el smoke Electron usa un sufijo que
> vitest ignora (verificado con `vitest list`: sin archivos nuevos
> recolectados).

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

## TODO: matriz 3 SO + Xvfb (parcial: ubuntu implementado)

- [x] Job CI dedicado (no bloqueante, fail-soft): `ubuntu-latest` corriendo
      `pnpm test:e2e:electron` tras `pnpm build:desktop` con Xvfb
      (`Xvfb :99 &` + `DISPLAY=:99`; ver `.github/workflows/ci.yml`,
      job `e2e-electron`). El job hace skip honesto con warning si no hay
      bundle. Pendiente: `windows-latest`, `macos-latest`.
- [ ] En Linux usar `xvfb-run -a` (Electron necesita servidor X; en
      headless puro falla la creación de la ventana).
- [ ] Fijar timeouts por SO (arranque más lento en runners compartidos) y
      subir `playwright-report/` + `test-results/` como artefactos.
- [ ] Evaluar `npx playwright install --with-deps` en el job Linux si el
      runner necesita libs del sistema para Electron.
- [ ] Segundo spec (cuando exista backend de test): flujo Chat→Canvas con
      `window.ego` real en vez de solo shell.
