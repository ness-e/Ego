// apps/desktop/scripts/smoke-native-packaged.cjs
// DIST-10 — Smoke headless del binario nativo VantaDB desempaquetado (HERM-15).
// Contrato: carga el `.node` tal como queda tras `asarUnpack: ['**/*.node']`
// (fuera del ASAR, cargable por el dynamic linker), hace `connect()` sobre
// disco + roundtrip put/get, y FALLA ante ABI drift (require del .node bajo
// el runtime de Electron lanza si NODE_MODULE_VERSION no coincide).
//
// Uso real (gate ABI — runtime Electron, headless, sin GUI ni empaquetado):
//   $env:ELECTRON_RUN_AS_NODE='1'; pnpm --filter @ego/desktop exec electron scripts/smoke-native-packaged.cjs --require-electron
// Chequeo rápido bajo Node del sistema (NO valida ABI de Electron):
//   node scripts/smoke-native-packaged.cjs
// Alcance: SOLO verificación. Sin firmados (DIST-04), sin empaquetado real,
// sin red. Flags: --require-electron, --unpacked-root <dir>, --keep-tmp.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(ROOT, '..', '..');
// packages/memory declara 'vantadb' + 'vantadb-node' (apps/desktop solo
// depende de @ego/memory + 'vantadb-node'): resolver el wrapper ESM desde
// ahí evita fugas a node_modules fuera del repo con pnpm estricto.
const MEMORY_PKG = path.join(REPO_ROOT, 'packages', 'memory');
const args = process.argv.slice(2);
const REQUIRE_ELECTRON = args.includes('--require-electron');
const KEEP_TMP = args.includes('--keep-tmp');
const unpackedRootArg = (() => {
  const i = args.indexOf('--unpacked-root');
  return i >= 0 && args[i + 1] ? path.resolve(args[i + 1]) : null;
})();

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`[smoke-native] FAIL: ${msg}`);
};
const ok = (msg) => console.log(`[smoke-native] ok: ${msg}`);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs, out);
    else if (e.isFile() && e.name.endsWith('.node')) out.push(abs);
  }
  return out;
}

(async () => {
  // 1. Registro del runtime (auditoría ABI: Electron 33 = modules 130;
  // Node sistema actual = 147 → el gate bajo Electron es significativo).
  const electronVer = process.versions.electron || null;
  console.log(
    `[smoke-native] runtime: electron=${electronVer || 'none'} node=${process.versions.node} ` +
      `modules=${process.versions.modules} platform=${process.platform} arch=${process.arch}`,
  );
  if (REQUIRE_ELECTRON && !electronVer) {
    fail('flag --require-electron sin runtime Electron (exportar ELECTRON_RUN_AS_NODE=1 y correr bajo el binario electron)');
  } else if (electronVer) {
    ok(`corre bajo Electron ${electronVer} (gate ABI real)`);
  } else {
    ok('corre bajo Node del sistema (chequeo rápido; ABI de Electron NO validado)');
  }

  // 2. Config de empaquetado: asar + asarUnpack '**/*.node' intactos.
  let config;
  try {
    // eslint-disable-next-line global-require
    config = require('../electron-builder.config.cjs');
    ok('electron-builder.config.cjs carga sin errores');
  } catch (err) {
    fail(`electron-builder.config.cjs no carga: ${err.message}`);
  }
  if (config) {
    if (config.asar !== true) fail(`asar debe ser true (actual: ${config.asar})`);
    else ok('asar: true');
    const unpack = Array.isArray(config.asarUnpack) ? config.asarUnpack : [];
    if (!unpack.includes('**/*.node')) fail(`asarUnpack debe incluir '**/*.node' (actual: ${JSON.stringify(unpack)})`);
    else ok(`asarUnpack incluye '**/*.node'`);
  }

  // 3. Localizar el .node (layout desempaquetado).
  let nodeFiles = [];
  let staged = null; // app.asar.unpacked simulado; limpieza al final (paso 6).
  if (unpackedRootArg) {
    if (!fs.existsSync(unpackedRootArg)) {
      fail(`--unpacked-root ausente: ${unpackedRootArg}`);
    } else {
      nodeFiles = walk(unpackedRootArg);
      ok(`--unpacked-root: ${nodeFiles.length} .node bajo ${unpackedRootArg}`);
    }
  } else {
    let bindingDir;
    try {
      // Nota: 'vantadb-node' solo exporta "." (./package.json no es
      // subpath válido) → resolver el entry y usar su directorio.
      const entry = require.resolve('vantadb-node', { paths: [ROOT] });
      bindingDir = path.dirname(entry);
      ok(`vantadb-node resuelto: ${bindingDir}`);
    } catch (err) {
      fail(`no se pudo resolver 'vantadb-node' desde ${ROOT}: ${err.message}`);
    }
    if (bindingDir) {
      // Simula app.asar.unpacked: copia fuera del árbol empaquetable y carga desde ahí.
      staged = fs.mkdtempSync(path.join(os.tmpdir(), 'ego-smoke-unpacked-'));
      try {
        for (const abs of walk(bindingDir)) {
          const dest = path.join(staged, path.basename(abs));
          fs.copyFileSync(abs, dest);
          nodeFiles.push(dest);
        }
        ok(`asarUnpack simulado: ${nodeFiles.length} .node copiado(s) a ${staged}${KEEP_TMP ? '' : ' (temporal)'}`);
      } catch (err) {
        fail(`no se pudo simular app.asar.unpacked: ${err.message}`);
      }
    }
  }
  if (nodeFiles.length === 0) {
    fail('ningún *.node localizado (¿binding nativo sin compilar? ver FIX_PROPUESTO-DIST-10-01)');
  } else {
    const archTokens = process.arch === 'x64' ? ['x64', 'x86_64'] : [process.arch, 'aarch64'];
    const match = nodeFiles.filter(
      (f) => path.basename(f).includes(process.platform) && archTokens.some((t) => path.basename(f).includes(t)),
    );
    if (match.length === 0) {
      fail(`ningún .node coincide con ${process.platform}/${process.arch}: ${nodeFiles.map((f) => path.basename(f)).join(', ')}`);
    } else {
      ok(`binario candidato: ${match.map((f) => path.basename(f)).join(', ')}`);
    }
  }

  // 4. Carga ABI del .node (falla ante drift: NODE_MODULE_VERSION mismatch).
  let nativeExport = null;
  for (const f of nodeFiles) {
    try {
      // eslint-disable-next-line global-require
      const mod = require(f);
      if (mod && (mod.VantaDb || mod.VantaDB)) {
        nativeExport = mod;
        ok(`carga ABI: ${path.basename(f)} exporta ${Object.keys(mod).slice(0, 4).join(',')}`);
        break;
      }
      fail(`${path.basename(f)} cargó pero sin export VantaDb/VantaDB (exports: ${Object.keys(mod || {}).join(',')})`);
    } catch (err) {
      fail(`carga ABI de ${path.basename(f)}: ${err.message.split('\n')[0]}`);
    }
  }
  if (!nativeExport) fail('ningún .node cargable (ABI drift o binario ausente)');

  // 5. Cadena productiva: import('vantadb/native') + connect() sobre disco +
  // roundtrip put/get + close (misma vía que EgoMemoryAdapter.init).
  if (nativeExport) {
    let nativeJs;
    try {
      // Igual que arriba: resolver el entry "." y derivar dist/native.js.
      // Vía MEMORY_PKG (único declarante de 'vantadb' en el workspace).
      const vantadbEntry = require.resolve('vantadb', { paths: [MEMORY_PKG] });
      nativeJs = path.join(path.dirname(vantadbEntry), 'native.js');
      if (!fs.existsSync(nativeJs)) throw new Error(`ausente: ${nativeJs}`);
      ok(`wrapper productivo: ${nativeJs}`);
    } catch (err) {
      fail(`no se pudo resolver 'vantadb/native': ${err.message}`);
    }
    if (nativeJs && fs.existsSync(nativeJs)) {
      const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ego-smoke-db-'));
      try {
        const { NativeVantaDB } = await import(pathToFileURL(nativeJs).href);
        if (typeof NativeVantaDB?.connect !== 'function') {
          fail('NativeVantaDB.connect no es función (API drift del wrapper)');
        } else {
          const db = await NativeVantaDB.connect(dbDir, { read_only: false });
          ok(`connect() sobre disco: ${dbDir}`);
          const NS = 'smoke/dist-10';
          const KEY = 'abi-gate';
          const SENT = JSON.stringify({ probe: 'dist-10', modules: process.versions.modules });
          await db.put({ namespace: NS, key: KEY, payload: SENT, metadata: { smoke: 'dist-10' } });
          const rec = await db.get({ namespace: NS, key: KEY });
          const got = rec && typeof rec.payload === 'string' ? rec.payload : rec?.payload?.payload;
          if (got !== SENT) {
            fail(`roundtrip put/get difiere (recibido: ${JSON.stringify(got)?.slice(0, 120)})`);
          } else {
            ok('roundtrip put/get idéntico');
          }
          const nss = await db.listNamespaces();
          if (!Array.isArray(nss) || !nss.includes(NS)) {
            fail(`listNamespaces no contiene '${NS}' (actual: ${JSON.stringify(nss)?.slice(0, 120)})`);
          } else {
            ok(`listNamespaces contiene '${NS}'`);
          }
          await db.close();
          ok('close() ordenado');
        }
      } catch (err) {
        fail(`connect()/roundtrip: ${err.message.split('\n')[0]}`);
      } finally {
        if (KEEP_TMP) console.log(`[smoke-native] tmp conservado: ${dbDir}`);
        else fs.rmSync(dbDir, { recursive: true, force: true });
      }
    }
  }

  // 6. Limpieza del staged (explícita, no en 'exit'): el .node cargado
  // bloquea su archivo en Windows (DLL lock) → EPERM esperado y tolerado.
  if (staged && !KEEP_TMP) {
    try {
      fs.rmSync(staged, { recursive: true, force: true });
    } catch {
      console.log(`[smoke-native] info: staged ${staged} retenido (lock DLL de Windows, %TEMP% lo purga)`);
    }
  }

  if (failures > 0) {
    console.error(`[smoke-native] ${failures} chequeo(s) fallido(s)`);
    process.exit(1);
  }
  console.log('[smoke-native] TODOS LOS CHEQUEOS EN VERDE');
})().catch((err) => {
  console.error(`[smoke-native] FAIL inesperado: ${err?.stack || err}`);
  process.exit(1);
});
