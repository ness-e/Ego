# DIST-10 — Smoke headless asar en CI

| Campo | Valor |
|---|---|
| Estado | ✅ COMPLETED (esta invocación; sin commit por contrato ego-lead de task) |
| Ruta | ego-lead (solo esta task; NO commit, NO tag, NO push) |
| Contrato | test Windows x64 que carga el `.node` empaquetado + `connect()` sobre disco; falla ante ABI drift. Compuerta HERM-15 |
| SDP | `ci-cd-and-automation` (cargada; resto base-only — tarea CI+verificación sin código funcional nuevo) |
| Plan | `docs/agent-ops/plans/2026-10-13-plan-deuda-residual.md` §Task 15 |

## DISCOVERY (zero-code planning)

### Archivos leídos (completos)
- `.github/workflows/ci.yml` — fast gate en `ubuntu-latest` con stub JS de `NativeVantaDB` (l.30-65): el gate rápido NUNCA carga el `.node` real → el smoke nativo exige job separado en Windows.
- `apps/desktop/electron-builder.config.cjs` — `asar: true` (l.22) + `asarUnpack: ['**/*.node', ...]` (l.23-27). Contrato de desempaquetado ya presente (DIST-02 ✅).
- `apps/desktop/package.json` — `vantadb-node: file:../../../VantaDB/vantadb-node` (l.34); scripts `build`/`pretest`; se agrega `smoke:native`.
- `apps/desktop/scripts/verify-dist.cjs` — patrón de verificación a imitar (colección fail/ok + exit 1, sin deps nuevas).
- `packages/memory/EgoMemoryAdapter.ts:278-283` — vía productiva: `import("vantadb/native")` + `NativeVantaDB.connect(storagePath, {read_only:false})`. El smoke replica esta vía exacta.
- `packages/memory/node_modules/vantadb/dist/native.js:121-159` — `NativeVantaDB.connect(path, opts)` → `import("vantadb-node")` → `VantaDb.connect(path, opts)`. Firma `connect(path = ":memory:", options)`.
- `packages/memory/node_modules/vantadb-node/package.json` — napi-rs, `binaryName: vantadb_native`, targets incl. `x86_64-pc-windows-msvc`; `exports` SOLO `"."` (./package.json NO es subpath → `require.resolve` debe usar el entry).
- `packages/memory/test/smoke-deps.test.ts` — pin existente de la dep canónica (no se duplica; el smoke DIST-10 cubre carga ABI + connect, no imports).

### Hechos mecánicos del entorno (2026-10-13, Windows x64 real)
- Node sistema: `v26.8.1`, `NODE_MODULE_VERSION=147`.
- Electron empaquetado: `33.4.11` (Node `20.18.3`, `NODE_MODULE_VERSION=130`) — `ELECTRON_RUN_AS_NODE=1` funciona headless, sin GUI.
- Brecha ABI real 147≠130 → el gate bajo runtime Electron es significativo (no tautológico).
- Binario real: `vantadb_native.win32-x64-msvc.node` (5 769 728 bytes) vía pnpm `file:`.
- VantaDB local en rama `develop` (`6777ab13`) — pin por defecto del workflow CI.

### Impacto mapeado (Regla 0)
- Archivos leídos completos: los 7 de arriba + `apps/desktop/scripts/verify-dist.cjs`.
- Referencias hacia dentro: smoke → `require('../electron-builder.config.cjs')`; → `require.resolve('vantadb-node'/'vantadb')`; → `import('vantadb/dist/native.js')` (su `import("vantadb-node")` interno resuelve por vecindad en `packages/memory/node_modules/`).
- Referencias entrantes: `.github/workflows/smoke-native.yml` invoca el smoke; `package.json#smoke:native` lo expone local. Nada en `src/` importa el smoke.
- Veredicto: cambio neto = 2 archivos nuevos (script + workflow) + 1 línea en `package.json` + este taskfile. CERO código `src/` funcional, CERO firmados, CERO `.agents/**`. Rev tier: Fast.

### Gate D (Zero Silent Assumptions — sin tool interactivo en este contexto; decisiones del lead)
1. **¿Job en `ci.yml` o workflow separado?** → Separado (`smoke-native.yml`). Requiere `windows-latest` (el .node win32 no carga en ubuntu) y ~15-20 min (Rust+napi); el fast gate (<5 min) no debe absorberlo.
2. **¿Empaquetado completo (`electron-builder --dir`) en CI?** → NO (excede CI; el brief lo autoriza). Mínimo viable: `electron --version` + carga `.node` desde layout desempaquetado simulado (`--unpacked-root` acepta un `app.asar.unpacked` real cuando exista).
3. **¿Bloqueante de PR desde el día 1?** → NO (Recomendado). No-bloqueante hasta el primer verde en GitHub (el provisioning compila Rust desde checkout hermano); promover a required solo con OK del owner. Un gate rojo-permanente es peor que uno documentado.
4. **¿De dónde sale el binario real en GitHub?** → Checkout `ness-e/Vantadb@develop` (repo canónico según `vantadb@0.8.0/package.json#repository`; rama verificada en local) + `npm run build` en `vantadb-node`. Si upstream publica `vantadb-node` al registry, DIST-09 lo sustituye (FIX_PROPUESTO-DIST-10-01).
5. **¿Vitest o script CJS?** → Script CJS (Recomendado). Debe correr bajo `ELECTRON_RUN_AS_NODE` (loader nativo del runtime Electron); vitest corre bajo Node del sistema y NO validaría la ABI de Electron.

## Steps
1. ✅ Smoke `apps/desktop/scripts/smoke-native-packaged.cjs` (asar+asarUnpack, stage desempaquetado, carga ABI, `connect()` disco + put/get + close; flags `--require-electron/--unpacked-root/--keep-tmp`).
2. ✅ Workflow `.github/workflows/smoke-native.yml` (windows-latest, triggers por paths + dispatch con `vantadb_ref`, Rust+napi build, `electron --version`, smoke con gate ABI).
3. ✅ `smoke:native` en `apps/desktop/package.json` (chequeo rápido local bajo Node; el gate real exige Electron — documentado en el header).
4. ✅ Verify mecánico + negativos fail-closed + RESULTADO §7 (este cierre).

## EJECUCIÓN
- Step 1: creado → 2 bugs reales hallados corriéndolo (1. `require.resolve('*/package.json')` viola `exports`maps — fix por entry; 2. `require.resolve('vantadb')` desde `apps/desktop` fugaba a `C:\Users\Eros\node_modules` por pnpm estricto — fix vía `packages/memory`; 3. orden de limpieza del staged antes del `require` — fix con limpieza al final tolerante a lock DLL). Verde bajo Node (147) y bajo Electron 33.4.11 (130).
- Step 2: creado → actionlint halló YAML inválido (`name:` sin comillas con `file:`) — fix + verde. Corrección de path: `pnpm --filter exec` fija CWD en el paquete (ruta `scripts/...`, verificado por fallo real `apps/desktop/apps/desktop/...`).
- Step 3: 1 línea; `typecheck` desktop exit 0; oxlint script exit 0 sin warnings.
- Fuera de alcance tocado: nada. `git status` muestra ediciones ajenas (orquestador/otros workers) que NO se tocan y NO se commitean.

## Review
- Tier: Fast (solo script de verificación + workflow + 1 línea de `package.json` + taskfile; sin `src/`, sin firmados, sin `.agents/**`).
- Verify mecánico: `node --check` ✅ · actionlint (2 workflows) ✅ · YAML parse ✅ · oxlint clean ✅ · `typecheck` @ego/desktop ✅ · smoke Electron `--require-electron` exit 0 ✅ · 2 negativos exit 1 ✅. Veredicto: approve.

## Evidencia
- Smoke gate real: `electron=33.4.11 node=20.18.3 modules=130` → `carga ABI: vantadb_native.win32-x64-msvc.node exporta VantaDb` → `connect() sobre disco` → `roundtrip put/get idéntico` → `listNamespaces` contiene `smoke/dist-10` → `close() ordenado` → `TODOS LOS CHEQUEOS EN VERDE`.
- Negativos: `--require-electron` bajo Node sistema → exit 1; `.node` corrupto (`is not a valid Win32 application`, misma clase de fallo que un drift `NODE_MODULE_VERSION`) → exit 1.
- Deuda consciente: primer verde en GitHub pendiente (requiere runner + acceso a `ness-e/Vantadb`); workflow no-bloqueante hasta entonces. Ver FIX_PROPUESTO-DIST-10-01.
- `FIX_PROPUESTO-DIST-10-01` (fuera de alcance): cuando upstream publique `vantadb-node` versionado al registry (vigilancia DIST-09), sustituir elprovisioning por `npm i vantadb-node@<pin>` y eliminar el build Rust del workflow (~10 min menos).

## Rollback
`git checkout -- apps/desktop/package.json` + `rm apps/desktop/scripts/smoke-native-packaged.cjs .github/workflows/smoke-native.yml docs/agent-ops/tasks/DIST-10.md`. Sin migraciones, sin estado.
