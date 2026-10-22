#!/usr/bin/env node
// scripts/measure-verbatim.mjs - declara el presupuesto de residuo verbatim
// de cada fichero del paquete, en `provenance.manifest.json`.
//
// POR QUE EXISTE: el presupuesto de la puerta `check-no-verbatim.mjs` tiene que
// vivir en el manifiesto (el denominador), no en una lista aparte que alguien
// pueda olvidar. Y tiene que ser REPRODUCIBLE: este script lo mide y lo
// escribe.
//
// LA REGLA:
//   · un fichero **nativo** (codigo propio de Ego) tiene presupuesto **0**:
//     no puede conservar NI UN shingle del upstream. Si se ha colado codigo,
//     el presupuesto NO se sube: se avisa y la puerta falla.
//   · un fichero **derivado** (un port atribuido) tiene como presupuesto su
//     residuo declarado: es un "piso" de trazos de origen. Si le crecen, la
//     puerta lo ve.
//
// Uso:
//   node scripts/measure-verbatim.mjs [--json] [--check]
//     (por defecto escribe el manifiesto; --check solo informa)

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const asJson = process.argv.includes('--json');
const check = process.argv.includes('--check');

const manifestPath = join(PKG, 'provenance.manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

// La puerta mide; este script solo lee su informe. (exit 1 esperado si hay
// residuo: no se interrumpe por eso.)
let informe;
try {
  informe = JSON.parse(
    execFileSync(process.execPath, [join(HERE, 'check-no-verbatim.mjs'), '--json'], {
      cwd: PKG,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  );
} catch (e) {
  informe = JSON.parse(e.stdout ?? '{}');
}

const medido = new Map();
for (const r of informe.report ?? []) {
  if (r.file.startsWith('vendorizado:')) continue;
  medido.set(r.file, r.measured);
}

const nativosConResiduo = [];
let declarados = 0;

for (const n of manifest.native ?? []) {
  const m = medido.get(n.path);
  n.verbatim = { maxShingles: 0, note: 'codigo propio de Ego: no puede conservar shingles del upstream' };
  declarados++;
  if (m !== undefined && m > 0) nativosConResiduo.push(`${n.path} (${m} shingles)`);
}

for (const d of manifest.derived ?? []) {
  const m = medido.get(d.path);
  d.verbatim = {
    maxShingles: m ?? 0,
    note: 'port atribuido: el presupuesto es su residuo declarado; si le crecen los prestamos, la puerta lo ve',
  };
  declarados++;
}

const resultado = {
  ok: nativosConResiduo.length === 0,
  declarados,
  nativosConResiduo,
  escrito: false,
};

if (!check) {
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  resultado.escrito = true;
}

if (asJson) { console.info(JSON.stringify(resultado, null, 2)); process.exit(resultado.ok ? 0 : 1); }
if (resultado.ok) {
  console.info(`  presupuestos de residuo declarados: ${declarados} (nativos a 0, derivados fijados)`);
} else {
  console.error(`  ${nativosConResiduo.length} NATIVO(S) con codigo del upstream: ${nativosConResiduo.join(', ')}`);
}
process.exit(resultado.ok ? 0 : 1);
