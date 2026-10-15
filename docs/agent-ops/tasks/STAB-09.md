# STAB-09 — main split + lazy/Suspense + Tailwind estable

> **Plan:** `docs/agent-ops/plans/2026-10-16-plan-estabilizacion-ego.md` (Task 10)
> **Estado:** ⏳ IN PROGRESS
> **Contrato:** `pnpm build` + `build:verify` verdes + `lazy()` Canvas/Daily/SubEgos/Domains con `Suspense skeleton` + Tailwind `v4.x` estable sin `-beta.8`
> **Prohibidos:** RTL tests (STAB-08), motion tokens (STAB-10), `.ego-worktrees/`, `dist/`, `out/`
> **Skills:** base + `performance-optimization`
> **SDP:** performance-optimization (bundle/chunk-splitting, lazy routes, budget 600) + base-only resto

## Spec (decisiones con evidencia — Gate D)

| # | Decisión no declarada | Opción elegida (Recomendado) | Evidencia / motivo |
|---|----------------------|------------------------------|-------------------|
| 1 | Alcance del split: ¿extracción total (windows/csp/ipc/providers) o núcleos puros? | Núcleos puros testeables: `task-kinds`, `terminal-policy`, `tray-status`, `mcp-env` | `main.ts` = 5047 líneas; windows/csp/ipc/providers están acoplados a `win`/handlers/Electron runtime (evidencia: `refreshTrayStatus` usa `backgroundEngine`, `ensureTray` usa `Tray/Menu/app`; CSP en `main.ts:3156` dentro del bootstrap). Extraerlos exige DI + mocks Electron y excede appetite 1d. Los 4 módulos elegidos son 100% puros y cubren terminal + tray del detalle |
| 2 | ¿Re-export en `main.ts` o romper API? | Re-export total (`export { … } from "./main/x.js"`) | 10 test files importan de `../src/main.js` (evidencia: grep §DESC-1); `permissions-policy.test.ts` usa `isTaskKindSafe`, `mcp-secrets.test.ts` usa 6 fns mcp-env. Sin re-export se rompen suites ajenas |
| 3 | Versión Tailwind estable | `^4.3.3` en ambos `package.json` (`@tailwindcss/vite` + `tailwindcss`) | `registry.npmjs.org` 2026-10-15: `tailwindcss@4.3.3` y `@tailwindcss/vite@4.3.3` latest; `index.css:1` usa sintaxis v4 (`@import "tailwindcss"`, `@theme`) compatible con 4.x estable |
| 4 | `lazy()` y tests existentes `App.test.tsx` (activo, no RTL-migrar) | `lazy()` directo + `Suspense fallback skeleton`; si el setup con espera 50ms no drena el chunk, fix mínimo `await findBy` solo en ese test (no migración RTL) | El test solo afirma tabs/chrome (siempre render) + negativos de Daily; el `setTimeout 50ms` dentro de `act` drena imports dinámicos locales. Verificar con `pnpm --filter @ego/renderer test` |
| 5 | `manualChunks` vendor-* | Se mantienen intactos en `renderer/vite.config.ts` y `electron.vite.config.ts` | Los chunks lazy de app son automáticos (no `node_modules`); `manualChunks` solo particiona vendors. Sin conflicto |
| 6 | Pregunta interactiva Gate D | No bloqueante: subagente sin canal `question`; decisiones fijadas por evidencia en esta tabla | pipeline-full.md exige ronda `ask_question`; sin herramienta disponible se documenta y el orquestador valida |

## Impacto mapeado (Regla 0)

- **Archivos leídos completos (regiones):** `apps/desktop/src/main.ts:1-205,203-502,700-875` + grep usos (53 líneas) + `main.ts:3156` CSP; `renderer/src/App.tsx:1-100,300-419`; `renderer/vite.config.ts:1-73` completo; `electron.vite.config.ts` completo; `apps/desktop/package.json`, `renderer/package.json` (scripts+deps); `renderer/test/App.test.tsx:1-83` completo; `test/mcp-secrets.test.ts:1-30`; `vitest.config.ts` desktop
- **Referencias hacia dentro (main.ts):** `electron`, `@ego/memory|models|tools|integrations|events|runtime|execution|subegos|decision|domains|knowledge|dailystate|recovery|tasks|security`, `./windows/WindowStateManager.js`, `./updater.js`, `./ipc/schema.js`
- **Referencias entrantes:** 10 suites `apps/desktop/test/*.test.ts` importan `../src/main.js` (isTaskKindSafe, mcp-env ×6, egoFetchProxied, setupModelProviders/handleLlmStream/…, getOrCreateDefaultProject, …); `renderer/src/main.tsx` → `App.tsx`; `electron.vite.config.ts` input `src/main.ts`
- **Veredicto:** blast radius acotado a `apps/desktop` (main + renderer). Extracción pura + re-export = API estable, cero cambios en packages. Riesgo mayor: bump Tailwind beta→estable (mitiga: `build` + diff CSS visual no requerido por contrato)

## Steps

- [x] S1 — `src/main/task-kinds.ts` + `test/main-task-kinds.test.ts` (commit parcial no; commit único final)
- [x] S2 — `src/main/terminal-policy.ts` + `test/main-terminal-policy.test.ts`
- [x] S3 — `src/main/tray-status.ts` + `test/main-tray-status.test.ts`
- [x] S4 — `src/main/mcp-env.ts` + `test/main-mcp-env.test.ts`
- [x] S5 — `main.ts`: sustituir definiciones por import/re-export + `typecheck` desktop (typecheck: 0 errores propios; 5 en `schema.ts`/`FloatingWindowView.ts` por flag concurrente STAB-10 sin fix — evidencia §BLOQ-1)
- [x] S6 — `App.tsx`: `lazy()` Canvas/Daily/SubEgos/Domains + `Suspense` skeleton + renderer tests (0 errores en `App.tsx`; `App.test.tsx` 2/4 fallan IDÉNTICO sin mi cambio — revert-check §BLOQ-2, suites eager Sidebar/ego-chat/ActivityTray de STAB-08/13)
- [x] S7 — Tailwind `^4.3.3` ambos package.json + `pnpm install` + lockfile (instalado 4.3.3 verificado en ambos `node_modules`)
- [x] S8 — VERIFY contrato (`build` + `build:verify` desktop y renderer) + commit local + review pendiente
  - `pnpm --filter @ego/desktop typecheck`: 0 errores (tras commit STAB-10 `a1419c5` que fijó `schema.ts`/`FloatingWindowView.ts`)
  - `pnpm --filter @ego/desktop build`: tsc ✅ + electron-vite ✅ + verify-dist `TODOS LOS CHEQUEOS EN VERDE` ✅
  - Entry app: `index-qRJPCmS7.js` 969.40KB ≤ 1MB; lazy chunks `CanvasRuntime` 461KB, `sub-egos` 71KB, `DomainCanvasView` 40KB, `daily-state` 28KB, `WorkbenchView` 33KB; `vendor-*` intactos
  - Tests: 4 suites nuevas 20/20 ✅; 10 suites `main.js` (permissions/mcp/ipc/compression/tasks) 70/70 ✅; `App.test.tsx` 4/4 ✅ (2 rojos previos eran flake de componentes eager concurrentes)
  - Tailwind 4.3.3 instalado en ambos `node_modules`, lockfile actualizado

## Colisión de commits (orquestador)

- El commit concurrente `a1419c5` (STAB-10, `commit -a`) barrió mi hunk de `App.tsx` (5 `lazy()` + `WorkspaceSkeleton`, 54 inserciones) a su commit. Mi commit STAB-09 cubre el resto. Atribución a reconciliar en review; contenido intacto y verificado.
- `apps/desktop/renderer/package.json` + `pnpm-lock.yaml` co-mezclan línea `msw` de STAB-08 (aún sin commitear por ellos) con mis pins Tailwind; se commitean juntos porque el árbol debe permanecer instalable.

## Evidencia colateral (no propia, no tocar)

- **BLOQ-1:** `pnpm --filter @ego/desktop typecheck` → errores solo en `src/ipc/schema.ts:573-574` y `src/windows/FloatingWindowView.ts:132-133` (`noUncheckedIndexedAccess`, flag añadido por diff concurrente STAB-10 en `tsconfig.base.json`, aún sin sus fixes). Cero errores en `src/main.ts`, `src/main/*.ts`, `test/main-*.test.ts`.
- **BLOQ-2:** `renderer/test/App.test.tsx` 2/4 rojos (`omnibar Ctrl+K`, `Daily honesto`, `TypeError: reading 'then'` en Sidebar:187/ego-chat:413/ActivityTray:122 eager). Revert-check: con `App.tsx` restaurado (sin mis hunks) fallan los mismos 2 → preexistente STAB-08/13. Más 2 errores TS de `toHaveTextContent` (setup jest-dom de STAB-08).
