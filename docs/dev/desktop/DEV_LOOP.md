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
