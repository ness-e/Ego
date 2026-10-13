# DIST-01 — Pipeline electron-builder

| Campo | Valor |
|---|---|
| ID | DIST-01 |
| Plan | `docs/agent-ops/plans/2026-10-12-plan-backlog-10.md` Task 10 (última) |
| Estado | COMPLETED |
| Worker | ego-lead (solo packaging; sin commit, sin push, sin tags) |
| Fecha | 2026-10-13 |
| Dependencias | `CORE-01` ✅ |
| Compuerta citada | `HERM-14` (plan) → veredicto abajo (§Compuerta) |

## Spec (contrato)

`pnpm build` empaqueta + artefactos verificados (main, preload, renderer).
Alcance: SOLO scripts/config de empaquetado + verificación de artefactos.
Explícitamente fuera: firmados (DIST-04), installers multi (DIST-03), código `src/`, `.agents/**`, tags/versiones manuales.

## Compuerta — veredicto (antes de tocar config)

- **HERM-16 (configuración de empaquetado y actualización Electron): ✅ Completada — REUTILIZADA.** La extracción ya está implementada: `apps/desktop/electron-builder.config.cjs` existe con `asar:true`, `asarUnpack: ['**/*.node', '**/node_modules/vantadb/**', '**/node_modules/vantadb-node/**']`, `files: ['dist/**', 'renderer/dist/**', 'package.json']` y `directories.buildResources: 'assets'` (F5T11: `assets/` creado en disco). Carga verificada vía `node -e require(...)`. DIST-01 no reimplementa el patrón — lo formaliza en pipeline + verificación mecánica.
- **HERM-14 (semántica de timeline inmutable y rewind de sesión): 🚫 Descartada con justificación (mapeo stale del plan).** HERM-14 gobierna rewind inmutable sobre namespaces `session/*` (`SessionTimelineRewind.ts`) — no tiene superficie en un pipeline de empaquetado (sin estado de sesión, sin namespaces, sin ramas). Ninguna decisión de packaging depende de ella. Per DoD §Protocolo de Veredicto de Descarte, el descarte justificado satisface formalmente la compuerta citada sin código ni tests vacíos. La compuerta material de esta task es HERM-16 (arriba).
- Ninguna compuerta exige decisión de release → sin BLOQUEO (el empaquetado real con installers/firma pertenece a DIST-03/DIST-04 con owner).

## Hallazgos (cambios)

1. **NUEVO `apps/desktop/scripts/verify-dist.cjs`** (~70 líneas, solo `node:fs`/`node:path`, cero deps): valida `dist/src/main.js` + `dist/src/preload.js` + `renderer/dist/index.html` (existen y no vacíos), carga `electron-builder.config.cjs` y exige `asar===true`, `asarUnpack` con `**/*.node`, `files` con `dist/**` + `renderer/dist/**`, y `buildResources 'assets/'` existente en disco. Exit 1 ante cualquier fallo.
2. **EDIT `apps/desktop/package.json` (solo `scripts`):** `build` ahora encadena `tsc -p tsconfig.json && node scripts/verify-dist.cjs` (todo `pnpm build` del workspace verifica artefactos automáticamente); nuevo `build:verify` (verificación aislada); nuevos `dist` (`electron-builder --config …`, empaquetado real — NO ejecutado en esta task: pertenece a DIST-03/DIST-04) y `pack` (`--dir`, smoke sin installer).
3. **EDIT `package.json` raíz (solo `scripts`):** pasarelas `build:verify` y `dist` hacia `@ego/desktop`.
4. **NO tocados:** `src/`, `renderer/src/`, `electron-builder.config.cjs` (targets win/mac/linux intactos — DIST-03), firma/hardenedRuntime (DIST-04), `.agents/**`, versiones/tags.

## FIX_PROPUESTO (regla del owner — NO aplicados)

- `{id: "FIX_PROPUESTO-DIST-01-01", archivo: "apps/desktop/assets/", problema: "sin icon.ico/icon.icns/icon.png dedicados (deuda documentada en assets/README.md desde F5T11); electron-builder usa defaults", fix: "generar iconos desde images/ del repo en DIST-03", riesgo: "bajo — cosmético, pero bloquea firma/notarización (DIST-04)"}`
- `{id: "FIX_PROPUESTO-DIST-01-02", problema: "renderer bundle 1.48 MB en un chunk (warning vite >500 kB); infla el instalador", fix: "code-splitting manualChunks en DIST-03 al medir tamaño de instalador", riesgo: "bajo — solo build config"}`

## Verify (§6 del paquete)

- `pnpm build` → exit 0 (renderer vite 43.75s + desktop tsc + verify-dist 9/9 en verde).
- `pnpm build:verify` → exit 0 (standalone, mismo resultado).
- `pnpm --filter @ego/desktop typecheck` → exit 0.
- Evidencia de artefactos: `dist/src/main.js` 105347 bytes, `dist/src/preload.js` 7020 bytes, `renderer/dist/index.html` 1099 bytes (2026-10-13).
- `electron-builder` real (`dist`/`pack`) NO ejecutado: requiere descarga de binarios Electron/distribución (fuera de INV-INTERNET "solo registry pnpm") y pertenece a DIST-03/DIST-04 → BLOQUEO consciente, no omisión.

## Cierre

Sin commit. Sin push. Sin tags. Rollback: `git checkout -- package.json apps/desktop/package.json` + borrar `apps/desktop/scripts/verify-dist.cjs` y `docs/agent-ops/tasks/DIST-01.md`.
