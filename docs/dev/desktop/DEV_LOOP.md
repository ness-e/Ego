# Dev loop desktop+renderer (DIST-12)

Un comando levanta todo: Vite (HMR) + Electron contra el dev-server.

```bash
pnpm dev            # desde la raíz (delega a @ego/desktop)
```

## Qué hace `pnpm dev`

1. `predev` → `pnpm build:main` (`tsc -p tsconfig.json`): compila el main a
   `dist/src/main.js`, que es lo que ejecuta `electron .`. Sin build previo el
   loop usaría un main stale.
2. `concurrently -k -n renderer,electron` arranca en paralelo:
   - `dev:renderer` → `pnpm --filter @ego/renderer dev` (Vite en
     `http://127.0.0.1:5173`, `strictPort: true` — si el puerto está ocupado
     Vite falla en vez de moverse, para no romper el cableado).
   - `dev:electron` → `wait-on tcp:127.0.0.1:5173 && node scripts/dev-electron.cjs`:
     espera al puerto y spawnea `electron .` con `VITE_DEV_SERVER_URL` fijada.
3. El main (`apps/desktop/src/main.ts`) detecta `VITE_DEV_SERVER_URL` en dev y
   hace `win.loadURL(...)` en vez de `loadFile(renderer/dist/index.html)`.
   En dev además abre DevTools detached.

El flag `-k` (`--kill-others`) hace que Ctrl+C mate ambos procesos: no quedan
Vite ni Electron colgados.

## Prerrequisitos

- `pnpm install` (instala `concurrently` + `wait-on`, devDeps de `@ego/desktop`).
- Puerto 5173 libre.

## Comandos individuales

| Comando | Efecto |
|---|---|
| `pnpm --filter @ego/desktop dev:renderer` | Solo Vite (útil para visual-review sin Electron) |
| `pnpm --filter @ego/desktop dev:electron` | Solo Electron (requiere Vite ya corriendo en 5173) |
| `pnpm --filter @ego/desktop build:main` | Recompila el main sin verify-dist |

## Notas

- Cambios en el **renderer** recargan por HMR sin reiniciar Electron.
- Cambios en el **main** (`apps/desktop/src/`) requieren `build:main` +
  reinicio de Electron (no hay `tsc --watch` en el loop por diseño mínimo;
  follow-up si el equipo lo pide).
- Producción/empaquetado no usa este loop: `electron-builder` sirve
  `renderer/dist/index.html` compilado (`win.loadFile`).

## Smoke test del bundle (EGO-FIND-122)

`pnpm build` deja el bundle real en `apps/desktop/out/{main,preload}`. El
smoke test lo comprueba sin necesidad de la VM limpia del owner:

```bash
pnpm run verify:bundle      # smoke test (fail-soft si no hay bundle)
pnpm run verify:bundle:test # 6 casos con fixtures
```

Qué comprueba:

1. **No resuelve Node/Rust/Python**: el bundle es de Electron; si invoca un
   toolchain del sistema (`node`, `python3`, `cargo`, `rustc`, `npm`…), la app
   funciona en la máquina del developer y se rompe en la del usuario.
2. **Los `.node` de VantaDB se cargan desde `asarUnpack`**: dentro del `.asar`
   el linker no puede cargarlos. Se verifican los 3 patrones de
   `apps/desktop/electron-builder.config.cjs` y, si hay app desempaquetada, que
   el binario está fuera del `.asar`.
3. **No hay DLLs ausentes** en el paquete (en Windows: `vcruntime140.dll`,
   `vcruntime140_1.dll`, `msvcp140.dll`).

**Fail-soft**: sin bundle (`apps/desktop/out/main/main.js`) no hay nada que
comprobar y el script sale 0 diciendo qué se ha omitido. Para las dos
comprobaciones que necesitan la app desempaquetada:

```bash
pnpm --filter @ego/desktop dist   # genera apps/desktop/release/**
```

**Lo que esto NO cubre**: la prueba en la VM limpia del owner (`DIST-06`) sigue
siendo necesaria para la instalación real en Windows (registro, firma, arranque
en frío). El smoke test deja de ser la única línea de defensa, no la
sustituye.
