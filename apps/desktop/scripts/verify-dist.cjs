// apps/desktop/scripts/verify-dist.cjs
// DIST-01 — Verificación mecánica de artefactos de empaquetado (HERM-16).
// T11-S6 (electron-vite): out/main/main.js + out/preload/preload.js +
// out/renderer/index.html existen y no están vacíos;
// electron-builder.config.cjs carga y declara asar + asarUnpack '**/*.node'
// (binarios napi-rs fuera del ASAR).
// DIST-03 — además: targets NSIS/DMG/AppImage por OS + iconos dedicados
// presentes y declarados + budget de chunks (sin chunk único de 1.48MB).
// Alcance: SOLO verificación. Sin firmados (DIST-04), sin empaquetado real.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const REQUIRED_FILES = [
  'out/main/main.js',
  'out/preload/preload.js',
  'out/renderer/index.html',
];

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`[verify-dist] FAIL: ${msg}`);
};
const ok = (msg) => console.log(`[verify-dist] ok: ${msg}`);

// 1. Artefactos de build presentes y no vacíos.
for (const rel of REQUIRED_FILES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    fail(`ausente: ${rel} (ejecutar 'pnpm build' primero)`);
    continue;
  }
  const size = fs.statSync(abs).size;
  if (size === 0) {
    fail(`vacío: ${rel}`);
    continue;
  }
  ok(`${rel} (${size} bytes)`);
}

// 2. Config de electron-builder cargable y con hardening .node intacto.
let config;
try {
  // eslint-disable-next-line import/no-dynamic-require, global-require
  config = require('../electron-builder.config.cjs');
  ok('electron-builder.config.cjs carga sin errores');
} catch (err) {
  fail(`electron-builder.config.cjs no carga: ${err.message}`);
}

if (config) {
  if (config.asar !== true) fail(`asar debe ser true (actual: ${config.asar})`);
  else ok('asar: true');

  const unpack = Array.isArray(config.asarUnpack) ? config.asarUnpack : [];
  if (!unpack.includes('**/*.node')) {
    fail(`asarUnpack debe incluir '**/*.node' (actual: ${JSON.stringify(unpack)})`);
  } else {
    ok(`asarUnpack incluye '**/*.node' (+ ${unpack.length - 1} patrones extra)`);
  }

  const files = Array.isArray(config.files) ? config.files : [];
  for (const need of ['out/**']) {
    if (!files.some((f) => f === need || (typeof f === 'object' && f.filter === need))) {
      fail(`files debe incluir '${need}' (actual: ${JSON.stringify(files)})`);
    } else {
      ok(`files incluye '${need}'`);
    }
  }

  if (config.directories?.buildResources !== 'assets') {
    fail(`directories.buildResources debe ser 'assets' (F5T11)`);
  } else if (!fs.existsSync(path.join(ROOT, 'assets'))) {
    fail(`directorio 'assets/' ausente en disco (F5T11)`);
  } else {
    ok(`buildResources 'assets/' existe en disco`);
  }

  // 3. DIST-03: targets de instaladores por OS (NSIS/DMG/AppImage).
  const targetsOf = (section) =>
    (Array.isArray(section?.target) ? section.target : []).map((t) =>
      typeof t === 'string' ? t : t?.target,
    );
  const need = { win: 'nsis', mac: 'dmg', linux: 'AppImage' };
  for (const [os, want] of Object.entries(need)) {
    const got = targetsOf(config[os]);
    if (!got.includes(want)) {
      fail(`${os}.target debe incluir '${want}' (actual: ${JSON.stringify(got)})`);
    } else {
      ok(`${os}.target incluye '${want}' (${JSON.stringify(got)})`);
    }
  }

  // 4. DIST-03: iconos dedicados presentes en disco y declarados en config.
  const iconDecl = {
    win: config.win?.icon,
    mac: config.mac?.icon,
    linux: config.linux?.icon,
  };
  const iconFiles = { win: 'icon.ico', mac: 'icon.icns', linux: 'icon.png' };
  for (const [os, file] of Object.entries(iconFiles)) {
    const abs = path.join(ROOT, 'assets', file);
    if (!fs.existsSync(abs) || fs.statSync(abs).size === 0) {
      fail(`icono ausente o vacío: assets/${file} (OS: ${os})`);
      continue;
    }
    ok(`assets/${file} (${fs.statSync(abs).size} bytes)`);
    const decl = iconDecl[os];
    if (typeof decl !== 'string' || !decl.endsWith(file)) {
      fail(`${os}.icon debe apuntar a 'assets/${file}' (actual: ${JSON.stringify(decl)})`);
    } else if (!fs.existsSync(path.join(ROOT, decl))) {
      fail(`${os}.icon declara '${decl}' pero no existe en disco`);
    } else {
      ok(`${os}.icon → '${decl}'`);
    }
  }

  // 5. DIST-03: budget de chunks — ningún JS del renderer supera 1MB
  // (baseline pre-split: index-*.js de 1 483 537 bytes).
  const CHUNK_BUDGET = 1_000_000;
  const assetsDir = path.join(ROOT, 'out', 'renderer', 'assets');
  if (!fs.existsSync(assetsDir)) {
    fail(`ausente: out/renderer/assets/ (ejecutar 'pnpm build' primero)`);
  } else {
    const js = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
    if (js.length < 2) {
      fail(`code-splitting ausente: se esperaba >1 chunk JS (actual: ${js.length})`);
    } else {
      ok(`code-splitting: ${js.length} chunks JS`);
    }
    for (const f of js) {
      const size = fs.statSync(path.join(assetsDir, f)).size;
      if (size > CHUNK_BUDGET) {
        fail(`chunk sobre budget: assets/${f} (${size} > ${CHUNK_BUDGET} bytes)`);
      } else {
        ok(`assets/${f} (${size} bytes ≤ budget)`);
      }
    }
  }
}

if (failures > 0) {
  console.error(`[verify-dist] ${failures} chequeo(s) fallido(s)`);
  process.exit(1);
}
console.log('[verify-dist] TODOS LOS CHEQUEOS EN VERDE');
