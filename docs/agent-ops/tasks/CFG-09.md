# CFG-09 — Hooks ciclo de vida + statusLine + env
- **Estado:** ✅ COMPLETED
- **Plan:** docs/agent-ops/plans/2026-10-16-plan-configs-revision-total.md
- **Fecha:** 2026-10-16
- **Archivos clave:** `packages/events/src/EventBus.ts` · `packages/events/src/types.ts` · `packages/events/test/HooksCfg09.test.ts` · `apps/desktop/src/preload.ts` · `docs/architecture/agentes.md`

## Blast Radius
Callers: `EventBus.evaluatePreToolUse/recordPostToolUse/getHooksStatus` (nuevos, sin callers previos) · `ego.hooks` en preload (nuevo namespace, sin callers renderer). Callees: ninguno nuevo (stdlib + regex). Sin impacto en schemas, ModelRouter, memoria, renderer, guards CSP/fetch/folders.

## Contrato
"Hook bloquea tool prohibida en test + typecheck events y desktop en verde."

## Steps de ejecución
- [x] Step 1: tipos hook en `packages/events/src/types.ts` (`HookKind`, `HookCommandConfig`, `HooksConfig` con `disableAllHooks` + `statusCommand`, `HookDecision`, `HooksStatus`)
- [x] Step 2: gate fail-closed en `EventBus.ts` (validadores `isValidHookCommand/isValidToolPattern/matchToolPattern`, `configureHooks`, `setSessionEnv/getSessionEnv/getHookEnv`, `evaluatePreToolUse`, `recordPostToolUse`, `getHooksStatus`; el bus nunca ejecuta comandos)
- [x] Step 3: bridge `ego.hooks` en `apps/desktop/src/preload.ts` (`getStatus/evaluatePreToolUse/recordPostToolUse` → `ipc.hooks.*`; sin tocar guards CSP, fetch ni folders)
- [x] Step 4: test `packages/events/test/HooksCfg09.test.ts` (6 tests: bloqueo, kill switch, fail-closed, env, status, validadores)
- [x] Step 5: sección CFG-09 al final de `docs/architecture/agentes.md` (sin reescribir)
- [x] Step 6: verificación mecánica + sincronización plan/task

## Registro de Cumplimiento / Veredicto
- **Estado:** ✅ COMPLETED
- **Evidencia:** `npx vitest run` en `packages/events`: 5 files / 22 tests passed (6 nuevos CFG-09) · `npx tsc -p tsconfig.json --noEmit` en `packages/events`: 0 errores · `npx tsc -p tsconfig.json --noEmit` en `apps/desktop`: 0 errores (3 errores transitorios `main.ts` effortLevel observados mid-run provinieron de edición concurrente CFG-04 en el mismo árbol; re-corridos en verde con mis cambios presentes)
- **Deuda:** handlers `ipc.hooks.*` en main aún no existen (el bridge los invoca; validación Zod + ejecución de comandos en main = trabajo futuro, fuera de alcance: no tocar schemas). `statusCommand` se almacena validado pero lo ejecuta main.
- **last-synced:** 2026-10-16
