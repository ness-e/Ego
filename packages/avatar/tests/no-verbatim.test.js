// tests/no-verbatim.test.js — la puerta de "no hay codigo verbatim del upstream".
//
// Es la puerta que impide que la decision D4 (geometria propia) se revierta en
// silencio: si alguien devuelve un fichero al clon, o pega un trozo del
// original, el residuo verbatim sube y la puerta falla.
//
// Casos:
//   - un fichero SIN residuo dentro de presupuesto -> 0
//   - un fichero CON residuo fuera de presupuesto -> 1
//   - un fichero que no existe -> 1
//   - el paquete real -> 0

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const GATE = join(PKG, 'scripts', 'check-no-verbatim.mjs');

/** Ejecuta la puerta y devuelve { code, report }. */
function runGate(root) {
  let out = '';
  let code = 0;
  try {
    out = execFileSync(process.execPath, [GATE, '--root', root, '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    code = e.status ?? 1;
    out = e.stdout ?? '';
  }
  let report = null;
  try {
    report = JSON.parse(out);
  } catch {
    /* la puerta pudo fallar antes de emitir el informe */
  }
  return { code, report, out };
}

/**
 * Paquete minimo: un corpus `vendor/` que hace de upstream y dos ficheros en
 * `src/`: uno con el mismo texto (residuo) y otro distinto (sin residuo).
 */
function makePackage({ copyIsResidual = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ego-verbatim-'));
  mkdirSync(join(root, 'src'), { recursive: true });
  mkdirSync(join(root, 'vendor', 'upstream'), { recursive: true });

  const upstream = [
    'export function upstreamThing(alpha, beta) {',
    '  const total = alpha * 2 + beta * 3;',
    '  return { total, ratio: total / (alpha + beta + 1) };',
    '}',
  ].join('\n');
  writeFileSync(join(root, 'vendor', 'upstream', 'thing.js'), upstream + '\n');

  writeFileSync(
    join(root, 'src', 'copiado.js'),
    copyIsResidual
      ? upstream + '\n'
      : [
          'export function ownThing(alpha, beta) {',
          '  const scale = alpha ** 0.5;',
          '  const offset = beta % 7;',
          '  return { scale, offset, tag: "ego" };',
          '}',
        ].join('\n') + '\n',
  );

  writeFileSync(
    join(root, 'provenance.manifest.json'),
    JSON.stringify(
      {
        version: 1,
        package: 'fixture',
        upstreams: {},
        derived: [],
        native: [{ path: 'src/copiado.js', reason: 'fixture' }],
        verbatim: { 'src/copiado.js': { maxResidue: 0, note: 'presupuesto 0 en el fixture' } },
      },
      null,
      2,
    ) + '\n',
  );
  return root;
}

test('un fichero SIN residuo dentro de presupuesto pasa (exit 0)', () => {
  const root = makePackage({ copyIsResidual: false });
  try {
    const { code, report } = runGate(root);
    assert.equal(code, 0, `problemas: ${JSON.stringify(report?.problems)}`);
    assert.equal(report.ok, true);
    assert.equal(report.budgets, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un fichero CON residuo fuera de presupuesto falla (exit 1)', () => {
  const root = makePackage({ copyIsResidual: true });
  try {
    const { code, report } = runGate(root);
    assert.equal(code, 1);
    assert.ok(
      report.problems.some((p) => p.includes('copiado.js') && /residuo/i.test(p)),
      `problemas: ${JSON.stringify(report.problems)}`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un fichero con presupuesto que NO existe falla (exit 1)', () => {
  const root = makePackage({ copyIsResidual: false });
  try {
    const manifestPath = join(root, 'provenance.manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.verbatim['src/inexistente.js'] = { maxResidue: 0, note: 'no existe' };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    const { code, report } = runGate(root);
    assert.equal(code, 1);
    assert.ok(
      report.problems.some((p) => p.includes('inexistente.js')),
      `problemas: ${JSON.stringify(report.problems)}`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un presupuesto con tolerancia permite un residuo pequeno (exit 0)', () => {
  const root = makePackage({ copyIsResidual: true });
  try {
    const manifestPath = join(root, 'provenance.manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.verbatim['src/copiado.js'].maxResidue = 1;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    const { code } = runGate(root);
    assert.equal(code, 0, 'un presupuesto de 1 (100%) admite cualquier residuo');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('la puerta real del paquete pasa (exit 0)', () => {
  const { code, report } = runGate(PKG);
  assert.equal(code, 0, `problemas: ${JSON.stringify(report?.problems)}`);
  assert.ok(report.budgets >= 6, `ficheros con presupuesto: ${report.budgets}`);
});
