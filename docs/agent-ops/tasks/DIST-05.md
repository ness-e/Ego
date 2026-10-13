# DIST-05 — Auto-Updater (detección + aviso discreto, esqueleto sin firma)

| Campo | Valor |
|---|---|
| Estado | ✅ Verificada 2026-10-13 (continuación `ego-desktop`; commit/tag/push pendientes del lead) |
| Ruta | ego-desktop (solo esta task) |
| Contrato | detección + descarga diferencial + aviso discreto, con tests, `pnpm build` verde. Roadmap Fase 12 §(línea 164-173: "Actualización en segundo plano", "Auto-updater funciona correctamente"). Backlog `DIST-05` (`docs/roadmap/Backlog.md:480`) |
| SDP | `ci-cd-and-automation`, `shipping-and-launch` (solo checklist). Resto base-only — módulo `src/` puro sin deps nuevas |
| Plan | `docs/agent-ops/plans/2026-10-13-plan-deuda-residual.md` §Task 10 |

## DISCOVERY (zero-code planning)

### Archivos leídos (completos)
- `apps/desktop/src/main.ts` — arranque `createWindow()` + `app.whenReady` (l.2700), `eventBus.onAny → win.webContents.send("ipc.event")` (l.1452), import style con sufijo `.js`. NO existe `updater.ts` (verificado por glob `src/*.ts`: solo `main|preload|ipc|mascot|windows`).
- `apps/desktop/src/ipc.ts` — contrato 50 invoke + 7 push; `ipc.event` ya es push canónico. Decisión: aviso vía `system.alert` → `ipc.event` existente, CERO canales nuevos (no rompe `ipc-contract.test.ts`).
- `apps/desktop/package.json` — `electron-updater` NO es dependencia. Añadirla = lockfile + red + superficie sin firma verificable → se aplica la vía esqueleto del contrato de la task.
- `apps/desktop/electron-builder.config.cjs` — sin bloque `publish`; targets NSIS/DMG/AppImage ya ✅ (DIST-03).
- `packages/events/src/types.ts` — `system.alert` es tipo canónico existente (usado por cuarentena SEC-09); se reutiliza para el aviso discreto.
- `docs/operations/despliegue.md:15` — "electron-builder por OS (NSIS/dmg/AppImage) + firma/notarización + auto-update" (cita verificada).
- `docs/roadmap/roadmap.md:164-173` — Fase 12: "Actualización en segundo plano y binarios nativos", "Auto-updater funciona correctamente" (el plan cita "§145" — numeración no literal; el contenido material es este).
- `docs/agent-ops/tasks/DIST-03.md` — patrón: task file con Regla 0 + Gate D + verify mecánico, sin commit propio.
- `git remote -v` → `https://github.com/ness-e/Ego.git` (owner `ness-e`, repo `Ego` — verificado, usable en comentarios de config).
- `.agents/references/definition-of-done.md`, `.agents/agents/ego-lead.md` §1-2, `pipeline-full.md` (leídos).

### Impacto mapeado (Regla 0)
- Archivos leídos completos: los de arriba + `apps/desktop/tsconfig.json` (`src/**/*`, estricto) + `apps/desktop/test/ipc-contract.test.ts` (patrón de test por lectura de fuente).
- Referencias hacia dentro: `main.ts` → `./updater.js` (nuevo import, una llamada en `createWindow`); `updater.ts` → CERO imports de `electron`/`@ego/*` (puro e inyectable, testeable en vitest sin mocks de Electron).
- Referencias entrantes: ninguna (módulo nuevo; `test/updater.test.ts` lo importa; `verify-dist.cjs` NO se toca).
- Veredicto: ediciones acotadas a 1 archivo nuevo (`src/updater.ts`), 1 wiring acotado (`main.ts`, ~12 líneas, solo-packaged + try/catch), 1 test nuevo, 1 bloque comentado en `electron-builder.config.cjs`, Backlog `DIST-05` → ✅. CERO firmados/certificados, CERO canales IPC nuevos, CERO `.agents/**`, CERO deps nuevas.

### Gate D (Zero Silent Assumptions)
Sin canal interactivo al owner; se aplica la recomendada y se registra:
1. **Sin `electron-updater` como dep** (esqueleto check+aviso; descarga/install real delegada a electron-updater + firma DIST-04) (Recomendado ✅ aplicado) vs añadir dep ahora (red + lockfile + sin firma verificable → aviso no instalable, descartado).
2. **"Descarga diferencial"** = documentada como provista por electron-updater/NSIS-blockmap al configurar `publish` (automática en ese stack), con stub `downloadUpdate()` que retorna `deferred` explícito (Recomendado ✅ aplicado) vs descarga HTTP propia (reinventa blockmap, riesgo seguridad, descartado).
3. **Sin feed URL configurada → idle degradado** (log + sin red) (Recomendado ✅ aplicado) vs default hardcodeado a un JSON inexistente (request 404 en prod, descartado). Feed real = decisión owner (canal releases) + firma DIST-04 → BLOQUEO parcial.
4. **Aviso vía `system.alert` → `ipc.event`** (canal existente, UI ya lo renderiza) (Recomendado ✅ aplicado) vs canal IPC nuevo (rompe contrato + preload + tests, descartado).

### Spec (decisiones por evidencia)
| # | Decisión | Evidencia / fundamento |
|---|---|---|
| S1 | Módulo `src/updater.ts` puro, sin `electron` | Tests corren en vitest sin Electron; DI de `fetchFeed`/`notify`/versión (patrón `resolveEnvModelKeys(env)` de `main.ts:746`) |
| S2 | `compareVersions` semver numérico, tolera prefijo `v` y sufijos `-prerelease`/`+build` | Sin dep `semver` (prohibida fricción de red); alcance = `major.minor.patch` del versionado Ego |
| S3 | `checkForUpdates()` nunca lanza; error → `{status:"error"}` | DoD "error paths handled"; updater no puede tumbar el arranque (shipping-and-launch: updater failure ≠ app failure) |
| S4 | Wiring solo si `app.isPackaged`, diferido 30s, todo en try/catch | Dev (`isDev`/VITE_DEV_SERVER_URL) jamás chequea; fallo silencioso con warn |
| S5 | `downloadUpdate()` stub → `{status:"deferred"}` con motivo | Firma DIST-04 bloqueada (owner-gate); diferencial real = NSIS blockmap vía electron-updater al haber `publish` + artefactos firmados |

## Steps
1. ✅ Crear `apps/desktop/src/updater.ts` (~130 líneas, puro + tipos exportados).
2. ✅ Wiring en `main.ts` (import + bloque solo-packaged diferido con `system.alert`).
3. ✅ Tests `apps/desktop/test/updater.test.ts` (mock local, sin red real) → PASS.
4. ✅ Bloque `publish` comentado en `electron-builder.config.cjs` (owner/repo verificados).
5. ✅ Verify: `pnpm --filter @ego/desktop typecheck` exit 0 + `pnpm build` exit 0.
6. ✅ Backlog `DIST-05` → ✅ con evidencia + RESULTADO §7 (plan file lo sincroniza el lead).

## EJECUCIÓN
- Step 1: `updater.ts` creado — `compareVersions` / `parseUpdateFeed` / `resolveUpdateFeedUrl` / `checkForUpdates` (nunca lanza) / `downloadUpdate` (stub `deferred` DIST-04) / `initAutoUpdater` (no-op si `!isPackaged`). Cero imports `electron`/`@ego/*`. ✅
- Step 2: `main.ts` +1 import (`./updater.js`) + bloque DIST-05 tras `win.show()` — `app.isPackaged`, `checkSoon(30_000)`, `fetch` global con `res.ok`, notify → `eventBus.emit("system.alert", {code: notice.code, ...})` → `ipc.event` existente. Todo en try/catch con warn. ✅
- Step 3: `updater.test.ts` 12 tests — primera corrida 11/12 (aserción mía errónea: literal `EGO_UPDATE_AVAILABLE` vive en `updater.ts`, en `main.ts` viaja como `notice.code`; corregido a `notice.code`). Segunda corrida 12/12. ✅
- Step 4: bloque `publish` (github `ness-e/Ego`) comentado con nota DIST-05/DIST-04; comentarios no afectan `verify-dist`. ✅
- Step 5: typecheck exit 0 (sin salida) + `pnpm build` exit 0 con verify-dist TODOS EN VERDE (incl. checks DIST-03 intactos). Suite desktop completa: 28 files / 150 tests PASS, 0 regresiones (incl. `ipc-contract.test.ts` — 0 canales nuevos). ✅
- Step 6: Backlog `DIST-05` → ✅ con evidencia. ✅

## FIX_PROPUESTO
Ninguno (todo lo fuera de alcance quedó como BLOQUEO parcial documentado, no como fix pendiente de diseño).

## Review
- Tier: Fast (módulo `src/` nuevo aislado + wiring acotado ~30 líneas; sin firmados, sin IPC nuevo, sin `.agents/**`, sin deps nuevas).
- Verify mecánico: tests nuevos 12/12 + suite desktop 150/150 + typecheck exit 0 + `pnpm build` exit 0 (verify-dist VERDE). Veredicto: PASS con BLOQUEO parcial documentado (descarga/install real + feed prod + firma → DIST-04/owner).

## Evidencia
- `pnpm --filter @ego/desktop test -- updater.test.ts` → `Test Files 1 passed, Tests 12 passed`.
- `pnpm --filter @ego/desktop test` → `Test Files 28 passed, Tests 150 passed`.
- `pnpm --filter @ego/desktop typecheck` → exit 0 (vacío).
- `pnpm --filter @ego/desktop build` → exit 0, `[verify-dist] TODOS LOS CHEQUEOS EN VERDE`.
- `git remote -v` → `https://github.com/ness-e/Ego.git` (owner/repo del comentario `publish`).

## Review
- Tier: Fast (módulo `src/` nuevo aislado + wiring acotado; sin firmados, sin IPC nuevo, sin `.agents/**`).
- Verify mecánico: tests nuevos PASS + typecheck exit 0 + `pnpm build` exit 0.

## Evidencia
(Comandos + salidas.)

## BLOQUEO (parcial, al owner — documentado, no detiene el esqueleto)
- **Canal de releases + firma (DIST-04)**: sin artefactos firmados ni `publish` activo no hay descarga/instalación real verificable. El esqueleto detecta + avisa; `downloadUpdate()` queda `deferred` hasta electron-updater + `publish` + certificados (lista en Backlog como deuda enlazada a DIST-04).
- **Feed URL**: `EGO_UPDATE_FEED_URL` sin valor en prod → updater idle (decisión S3/Gate D-3). El owner define el canal (GitHub Releases del repo `ness-e/Ego` es el candidato natural).

## Rollback
`git revert` del commit del lead (archivos aislados: `src/updater.ts`, `test/updater.test.ts`, bloque `main.ts` entre marcadores `DIST-05`, comentario config). Sin migraciones ni datos.
