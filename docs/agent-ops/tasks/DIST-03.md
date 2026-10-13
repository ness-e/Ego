# DIST-03 — Instaladores multiplataforma (+ iconos + code-splitting)

| Campo | Valor |
|---|---|
| Estado | ✅ Verificada 2026-10-13 (continuación `ego-desktop`; commit/tag/push/firma pendientes del lead) |
| Ruta | ego-desktop (solo esta task; NO commit, NO tag, NO push, NO firma) |
| Contrato | targets NSIS/DMG/AppImage configurados y verificables + iconos dedicados + chunk 1.48MB dividido, con `pnpm build` verde. Compuerta HERM-16 (packaging, `docs/review/backlog-hermes.md:51`) |
| SDP | `ci-cd-and-automation`, `shipping-and-launch` (solo checklist). Resto base-only — tarea solo-config/assets sin código `src/` |
| Plan | `docs/agent-ops/plans/2026-10-13-plan-deuda-residual.md` §Task 8 |

## DISCOVERY (zero-code planning)

### Archivos leídos (completos)
- `apps/desktop/electron-builder.config.cjs` — targets YA presentes: win NSIS+zip x64 (l.28-34), mac DMG+zip x64+arm64 (l.41-50), linux AppImage+tar.gz x64 (l.51-58). Faltante: declaración `icon` (usa defaults).
- `apps/desktop/assets/README.md` — solo README; deuda explícita: `icon.ico`/`icon.icns`/`icon.png` "generados desde `images/`", con nota "No añadir binarios en esta task" (F5T11/M27 — superada por DIST-03, que exige iconos).
- `apps/desktop/renderer/vite.config.ts` — sin `manualChunks`; chunk único `index-*.js` **1 483 537 bytes** (verificado en disco `renderer/dist/assets/`).
- `apps/desktop/renderer/package.json` — vendors pesados: `@assistant-ui/react`, `recharts`, `@phosphor-icons/react`, `@tanstack/react-table`, `geist`.
- `apps/desktop/scripts/verify-dist.cjs` — 9 checks (DIST-01/DIST-02); NO verifica targets ni iconos ni chunks.
- `docs/operations/despliegue.md:15` — Instalador P0: NSIS/dmg/AppImage + firma + auto-update (firma = DIST-04, fuera de alcance).
- `docs/agent-ops/tasks/DIST-02.md` — patrón: verificación mecánica + Backlog a ✅ con evidencia, sin commit propio.
- `docs/review/backlog-hermes.md:51` — HERM-16 ✅ (asarUnpack + hardening). Nota: el plan cita "compuerta HERM-14" pero HERM-14 es timeline/rewind (ya ✅ y ajena a packaging); la compuerta material de DIST-03 es **HERM-16** (packaging). Discrepancia anotada, sin conflicto de fondo.
- `.agents/references/definition-of-done.md`, `.agents/agents/ego-lead.md` §1-2, `pipeline-full.md` (leídos).

### Impacto mapeado (Regla 0)
- Archivos leídos completos: los de arriba + `package.json` (root `build` = renderer + desktop), `apps/desktop/package.json` (`dist`/`pack` → config).
- Referencias hacia dentro: `verify-dist.cjs` → `require('../electron-builder.config.cjs')`; `build` → `tsc && verify-dist`; `dist`/`pack` → electron-builder con la config.
- Referencias entrantes: `DIST-04` (firmado), `DIST-06` (clean VM), `DIST-07` (docs usuario) dependen de DIST-03.
- Veredicto: ediciones acotadas a config builder (`icon` + targets ya ok), `assets/` (iconos placeholder + README), `vite.config.ts` (`manualChunks`), `verify-dist.cjs` (checks DIST-03). CERO cambios en `src/` funcional, CERO firmados, CERO `.agents/**`.

### Gate D (Zero Silent Assumptions)
Decisiones no declaradas detectadas; sin canal interactivo al owner, se aplica la recomendada y se registra:
1. **Splitting sin router** (app monolítica, sin lazy routes): `manualChunks` por vendor (Recomendado ✅ aplicado) vs `vite-plugin-chunk-split` (dep nueva, prohibida sin red) vs lazy `React.lazy` (refactor `src/`, fuera de alcance).
2. **Iconos finales requieren diseño**: placeholders vectoriales generados por script reproducible (Recomendado ✅ aplicado) + **BLOQUEO al owner por diseño final** (registrado en §BLOQUEO y README).
3. **Empaquetado real**: intentar `electron-builder --dir` offline solo-win; si requiere red/cert → BLOQUEO parcial documentado, no binarios inventados.
4. **Verificabilidad**: extender `verify-dist.cjs` con checks DIST-03 (Recomendado ✅ aplicado) vs script separado (duplicación, descartado).

## Steps
1. ✅ Iconos placeholder reproducibles (`assets/generate-placeholder-icons.cjs` → `icon.svg`/`.png`/`.ico`/`.icns`) + README actualizado.
   - Verificado: PNG magic `89504e47`, ICO header `0000010001` con 4 entradas (16/32/48/256: 104/148/187/1048 bytes), ICNS magic `icns` con longitud declarada = real (4186 bytes).
   - Mejora del continuador: ICO pasó de 1 entrada 256px a multi-tamaño (taskbar/explorer sin reescalado); comentario icns honestizado (payloads PNG, render pendiente de validación en macOS).
   - README: retirada la nota "No añadir binarios en esta task" (superada por DIST-03); documentado BLOQUEO diseño.
2. ✅ Config builder: declarado `icon` por OS (`win`→`assets/icon.ico`, `mac`→`assets/icon.icns`, `linux`→`assets/icon.png`; targets ya verificados) + `vite.config.ts` `manualChunks` por vendor (forma función; orden específicos-primero porque `@assistant-ui` contiene `/react/`).
   - Incidencia: forma objeto dejó `vendor-react` vacío (1 byte, react caído en chunk app); forma función lo corrige (react 186 011 bytes).
3. ✅ `verify-dist.cjs`: checks DIST-03 (targets NSIS/DMG/AppImage, iconos presentes+declarados, budget chunks 1 000 000 bytes, >1 chunk JS).
4. ✅ Verify mecánico: `pnpm build` exit 0 + verify-dist TODOS EN VERDE + `pnpm --filter @ego/desktop typecheck` exit 0. Intento `pack --dir` win: corre (red disponible, electron 115MB descargado) pero FALLA en asar — ver FIX_PROPUESTO. `release/` parcial limpiado.
5. ✅ Backlog `DIST-03` → ✅ con evidencia + RESULTADO §7 (plan file lo sincroniza el lead; esta ruta NO lo toca).

## EJECUCIÓN
- Step 1: iconos verificados por magic bytes (node); ICO mejorado a 4 entradas y regenerado; README reescrito. ✅
- Step 2: `electron-builder.config.cjs` (+3 líneas `icon`); `vite.config.ts` (+`chunkSizeWarningLimit: 600` + `manualChunks` función con 5 vendors). ✅
- Step 3: `verify-dist.cjs` cabecera + §3 targets + §4 iconos + §5 budget chunks. ✅
- Step 4: antes/después — `index-CAT_1Xq5.js` 1 483 537 bytes → 6 chunks: app 312 850 + assistant 332 771 + charts 393 629 + icons 202 586 + react 186 011 + table 51 601 (mayor = 393 629, −73% vs baseline). Warnings preexistentes de sourcemap en componentes (no relacionados al splitting; no se tocan). ✅
- Step 5: Backlog actualizado; RESULTADO abajo. ✅

## FIX_PROPUESTO (fuera de alcance — NO implementado, requiere decisión lead/owner)
**Pack real `--dir` win bloqueado por junctions pnpm + asar.** Error: `packages/dailystate/dist/DailyStateEngine.d.ts.map must be under apps/desktop/` (`app-builder-lib/out/util/filter.js:24-33` `getRelativePath`: lanza si el fichero no está bajo appDir y su ruta no contiene `node_modules`). Causa: `node_modules/@ego/*` son junctions pnpm → `packages/*` (fuera de appDir; verificado `LinkType: Junction` ×16); al resolverlas, electron-builder incluye rutas reales externas y el filtro asarUnpack revienta en la primera. Evidencia: stack `AsarPackager.unpackPattern → createPackageFromFiles → WinPackager.doPack`.
Candidatas (ordenadas): (A) staging aislado para packaging (`pnpm deploy apps/desktop` o `files`+`extraResources` que eviten junctions) — Recomendada; (B) `asar:false` temporal — NO recomendada (pierde hardening HERM-16/DIST-02); (C) pin/patch electron-builder symlink handling (upstream). Nuevo scope: config builder + posible script de staging — excede "targets+iconos+splitting" y roza DIST-06/DIST-10; lo registra el lead como follow-up o fila FIND.

## Review
- Tier: Fast (config/assets/docs; sin `src/` funcional, sin firmados, sin `.agents/**`).
- Verify mecánico: `pnpm build` exit 0 (verify-dist TODOS EN VERDE incl. 6 chunks ≤ budget) + `pnpm --filter @ego/desktop typecheck` exit 0. Veredicto: PASS con deuda documentada (FIX_PROPUESTO pack real + BLOQUEO diseño iconos).

## Evidencia
- Baseline chunk: `apps/desktop/renderer/dist/assets/index-CAT_1Xq5.js` = 1 483 537 bytes (~1.41 MiB), CSS 67 251 bytes.
- Post-split (2026-10-13): app `index-Br-7Fy-9.js` 312 850 + `vendor-assistant` 332 771 + `vendor-charts` 393 629 + `vendor-icons` 202 586 + `vendor-react` 186 011 + `vendor-table` 51 601; CSS 67 251. Mayor chunk 393 629 (−73% vs baseline).
- Iconos: `icon.ico` 1557 (4 entradas), `icon.icns` 4186, `icon.png` 2663, `icon.svg` 533; magics verificados por script node.
- Pack `--dir` win: descarga electron 115MB ok → falla asar por junctions pnpm (FIX_PROPUESTO §arriba).

## BLOQUEO (al owner)
- **Diseño final de iconos**: los shipped son placeholders geométricos (marca "E" abstracta); se requiere diseño profesional `.ico`/`.icns`/`.png` antes de DIST-04/08.
- **Firmado/notarización** (DIST-04) y **clean-machine VM** (DIST-06): certificados/VM del owner, fuera de alcance.
- **Pack real bloqueado (parcial, con FIX_PROPUESTO)**: `electron-builder --dir` win falla en asar por junctions pnpm fuera de appDir — ver §FIX_PROPUESTO. Decisión del lead: follow-up o fila FIND (roza DIST-06/DIST-10).
