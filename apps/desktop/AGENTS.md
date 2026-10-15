# apps/desktop — Agent Context

> Package: `@ego/desktop` (Electron 33 app: main + preload + renderer). Root rules in [`../../AGENTS.md`](../../AGENTS.md) win on conflict.

## Commands (run from repo root)

```powershell
pnpm --filter @ego/desktop dev          # electron-vite dev loop
pnpm --filter @ego/desktop build        # tsc --noEmit + electron-vite build + verify-dist
pnpm --filter @ego/desktop build:verify # dist layout check (out/main + out/preload + out/renderer)
pnpm --filter @ego/desktop typecheck    # tsc -p tsconfig.json --noEmit
pnpm --filter @ego/desktop test        # vitest run
pnpm --filter @ego/desktop dist        # electron-builder installer
```

Build pipeline (T11-migrated): unified loop under `electron-vite` 5.x — config `electron.vite.config.ts`, output layout `out/`. See `docs/engineering/stack-tecnico.md:17`.

## Guardrails (binding for this package)

- **No VantaDB in renderer** — `NativeVantaDB` lives in main process only; renderer access is forbidden.
- **No business logic in renderer** — renderer is presentation only (`renderer/`).
- **Typed IPC only** — all main↔renderer traffic goes through the strongly-typed `preload` script (`src/preload.ts`); renderer is untrusted, validate everything.
- **Security flags are non-negotiable**: `contextIsolation=true`, `sandbox=true`, `nodeIntegration=false`.
- **No `Client` from `"vantadb"`** (WASM) — `NativeVantaDB` from `"vantadb/native"` only, via `EgoMemoryAdapter` (`packages/memory`).
- **Packaging**: native `.node` modules require `asarUnpack: ["**/*.node"]` (see `electron-builder.config.cjs`).
- Entry points: main `src/main.ts`, preload `src/preload.ts`, renderer root `renderer/` → `out/renderer`.

## Local references

- Build config: `electron.vite.config.ts`, `electron-builder.config.cjs`
- Sources: `src/`, `renderer/`, `scripts/` (verify-dist, smoke-native)
- Memory gateway (do not duplicate): `../../packages/memory`
