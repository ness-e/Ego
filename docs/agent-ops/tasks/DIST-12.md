# DIST-12 — Dev concurrente desktop+renderer

| Campo | Valor |
|---|---|
| Estado | ✅ COMPLETED (esta invocación; sin commit por contrato ego-desktop de task) |
| Ruta | ego-desktop (solo esta task; NO commit, NO tag, NO push) |
| Contrato | `pnpm dev` levanta Vite + Electron con `VITE_DEV_SERVER_URL` cableado; documentado |
| SDP | `ci-cd-and-automation` (cargada; tarea de tooling de dev-loop sin código funcional nuevo) |
| Plan | `docs/agent-ops/plans/2026-10-13-plan-deuda-residual.md` §Task 17 |
| Backlog | `docs/roadmap/Backlog.md` fila `DIST-12` (l.487) |

## DISCOVERY (zero-code planning)

### Archivos leídos (completos)
- `package.json` — `dev`: `pnpm --filter @ego/desktop dev` (l.12); raíz solo delega, sin diff necesario.
- `apps/desktop/package.json` — `dev`: `electron .` (l.12); sin dev-server, sin `VITE_DEV_SERVER_URL`, sin `concurrently`/`wait-on`.
- `apps/desktop/src/main.ts` — l.2674-2687: **ya cableado** (`isDev && process.env.VITE_DEV_SERVER_URL` → `win.loadURL(...)`, else `loadFile(renderer/dist/index.html)`). Sin edición necesaria.
- `apps/desktop/renderer/vite.config.ts` — `server.port: 5173, strictPort: true` (l.43-46): puerto determinista, apto para `wait-on`.
- `apps/desktop/renderer/package.json` — `dev`: `vite` (l.7).
- `docs/agent-ops/tasks/DIST-11.md` — patrón de taskfile (DISCOVERY → Steps → EJECUCIÓN → Review → Evidencia → Rollback).
- `.agents/task-system/prompts/pipeline-full.md`, `.agents/references/definition-of-done.md`, `.agents/references/dev-tools.md` — lectura obligatoria completada.
- `docs/agent-ops/plans/archive/2026-10-12-plan-maestro-hallazgos.md` §Protocolo C01/C02 (10 pasos) — lectura completada.

### Hallazgo central (C01-paso 1: cuestionar la recomendación)
El Backlog (`Backlog.md:487`) afirma que `dev` sigue siendo "`electron .` sin dev-server ni `VITE_DEV_SERVER_URL`" (verificado 2026-10-12). **Stale parcial**: el cableado `VITE_DEV_SERVER_URL` en `main.ts:2676-2678` YA existe (posterior al 10-12). Lo que falta es real: (a) deps `concurrently`+`wait-on`, (b) scripts del loop, (c) docs del loop. Alcance = solo eso; `main.ts` NO se toca.

### Baseline del árbol
- `pnpm dev` → `electron .` contra `dist/src/main.js` (existe, verificado `Test-Path` = True) sin `VITE_DEV_SERVER_URL` → carga `renderer/dist/index.html` compilado, no HMR.
- Registry accesible: `concurrently` 10.0.6, `wait-on` 9.5.1 (`pnpm view`, evidencia §Evidencia).
- Sin `concurrently`/`wait-on`/`cross-env` en el repo (grep: 0 hits en `package.json`s).

### Impacto mapeado (Regla 0)
- Archivos leídos completos: los 9 de arriba.
- Referencias hacia dentro: `apps/desktop/package.json#dev*` → consumido por raíz `package.json#dev` (sin cambio); `scripts/dev-electron.cjs` (nuevo) → invocado solo por `dev:electron`; `docs/dev/desktop/DEV_LOOP.md` (nuevo) → doc sin consumidores de código.
- Referencias entrantes: ninguna (ningún `src/` importa scripts de dev; CI no corre `dev`).
- Veredicto: cambio neto = 1 `package.json` (scripts + 2 devDeps) + 1 script `.cjs` + 1 doc + este taskfile. CERO `src/` funcional, CERO firmados, CERO `.agents/**`. Rev tier: Fast.

### Gate D (Zero Silent Assumptions — sin tool interactivo en este contexto; decisiones del lead)
1. **¿Dónde viven `concurrently`/`wait-on`?** → `apps/desktop` devDependencies (Recomendado). Los scripts que los consumen viven ahí; la raíz solo delega. Evita que el binario quede invisible al filtro pnpm.
2. **¿`cross-env` para `VITE_DEV_SERVER_URL`?** → NO; launcher `scripts/dev-electron.cjs` (Recomendado). Tercera dep innecesaria; el `.cjs` fija la env en `process.env` antes de spawnear `electron` → portable win/linux/mac sin depender del `script-shell` de pnpm por SO.
3. **¿`predev` con `build:main`?** → SÍ (Recomendado). `electron .` corre `dist/src/main.js`; sin build previo el loop usaría un main stale. `tsc -p tsconfig.json` tarda segundos y falla en rojo si el main no compila.
4. **¿`tsc --watch` como tercer proceso?** → NO (Recomendado). Fuera del contrato mínimo; documentado como follow-up en el doc del loop.
5. **¿Tocar `main.ts`?** → NO (Recomendado). Cableado verificado l.2675-2678; el claim Backlog es stale en ese punto.
6. **¿Docs dónde?** → `docs/dev/desktop/DEV_LOOP.md` (Recomendado). Ruta convencional ya referenciada por el plan (`CLEAN_MACHINE_TEST.md` Task 11, mismo dir).
7. **¿Root `package.json`?** → Sin diff (Recomendado). Ya delega a `@ego/desktop`.

## Steps
1. ✅ `pnpm add -D concurrently wait-on --filter @ego/desktop` → `concurrently@^10.0.6` + `wait-on@^9.5.1` en devDeps + `pnpm-lock.yaml`. Sin BLOQUEO.
2. ✅ Scripts en `apps/desktop/package.json` (`predev`/`dev`/`dev:renderer`/`dev:electron`) + `scripts/dev-electron.cjs` (launcher sin shell, `require("electron")` directo, v2 sin DEP0190). Hallazgo intermedio: Vite bindeaba `localhost` (::1) y `wait-on tcp:127.0.0.1:5173` nunca resolvía → fix `host: "127.0.0.1"` en `renderer/vite.config.ts`.
3. ✅ Doc `docs/dev/desktop/DEV_LOOP.md` + este taskfile con RESULTADO §7.
4. ✅ Verify mecánico: ver §Evidencia.

## EJECUCIÓN
- Step 1: `pnpm add` OK (25.1s, +25 paquetes, 11 deprecated warnings de subdeps — ruido upstream, no bloquean).
- Step 2: `package.json` editado (4 scripts); `dev-electron.cjs` v1 con `shell:true` emitía `DEP0190` en log → v2 con path directo de `require("electron")`, warning eliminado. `vite.config.ts` +1 línea (`host`).
- Step 3: `DEV_LOOP.md` creado (uso, prerrequisitos, comandos individuales, notas HMR/main-watch).
- Step 4: loop real ×2 (45s + 55s). Run 1: Vite ready pero probe IPv4 refused → diagnóstico host. Run 2: probe `200`, 6 procs electron, log con `Conectando a Vite Dev Server: http://127.0.0.1:5173` + `[vite] connected` + `HTML y recursos cargados exitosamente`. Kill `taskkill /T /F` en ambos runs → 0 electron, puerto libre. `typecheck` desktop exit 0, renderer exit 0, `oxlint` paths tocados exit 0.
- Fuera de alcance tocado: nada. `git status` muestra ediciones ajenas (orquestador/otros workers) que NO se tocan y NO se commitean (contrato: sin commit).

## Review
- Tier: Fast (scripts de dev + 1 línea de config Vite + doc + taskfile; sin `src/` funcional — `main.ts` intacto, sin firmados, sin `.agents/**`).
- Verify mecánico: registry ✅ · `build:main` exit 0 ✅ · loop real con ventana Electron cargando dev-server (log) ✅ · kill-tree limpio ×2 ✅ · typecheck desktop+renderer exit 0 ✅ · oxlint exit 0 ✅ · `git status` solo paths propios (+ lockfile) ✅. Veredicto: approve.
- DoD: correctness (contrato literal: `pnpm dev` levanta ambos + URL cableada + docs), quality (sin scope-creep, warnings ajenos intactos), integration (raíz delega sin diff; CI no corre `dev`), docs (DEV_LOOP.md + taskfile), ship-readiness (rollback abajo; sin commit por contrato de task).

## Evidencia
- Registry: `pnpm view concurrently version` → `10.0.6`; `pnpm view wait-on version` → `9.5.1`.
- Cableado preexistente: `apps/desktop/src/main.ts:2676-2678`.
- Puerto determinista: `apps/desktop/renderer/vite.config.ts:43-46`.

## Rollback
`git checkout -- apps/desktop/package.json pnpm-lock.yaml` + `rm apps/desktop/scripts/dev-electron.cjs docs/dev/desktop/DEV_LOOP.md docs/agent-ops/tasks/DIST-12.md`. Sin migraciones, sin estado.
