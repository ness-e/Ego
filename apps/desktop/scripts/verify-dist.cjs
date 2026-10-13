// apps/desktop/scripts/verify-dist.cjs
// DIST-01 — Verificación mecánica de artefactos de empaquetado (HERM-16).
// Contrato: dist/src/main.js + dist/src/preload.js + renderer/dist/index.html
// existen y no están vacíos; electron-builder.config.cjs carga y declara
// asar + asarUnpack '**/*.node' (binarios napi-rs fuera del ASAR).
// Alcance: SOLO verificación. Sin firmados (DIST-04), sin installers (DIST-03).
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const REQUIRED_FILES = [
  'dist/src/main.js',
  'dist/src/preload.js',
  'renderer/dist/index.html',
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
  for (const need of ['dist/**', 'renderer/dist/**']) {
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
}

if (failures > 0) {
  console.error(`[verify-dist] ${failures} chequeo(s) fallido(s)`);
  process.exit(1);
}
console.log('[verify-dist] TODOS LOS CHEQUEOS EN VERDE');
