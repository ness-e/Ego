// tests/no-verbatim.test.js — la puerta de residuo verbatim (decision D4).
//
// Es la puerta que impide que la sustitucion de los puertos verbatim se
// revierta en silencio. Casos:
//
//   · un fichero con residuo REAL fuera de presupuesto  -> 1 (muerde)
//   · un fichero dentro de presupuesto                   -> 0
//   · un presupuesto con tolerancia                     -> admite hasta N shingles
//   · un fichero con presupuesto que NO existe          -> 1
//   · SIN presupuestos en el manifiesto                 -> 1 (una puerta que no
//     mide nada no es una puerta: EGO-FIND-105)
//   · la puerta real del paquete                         -> 0

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

/** Ejecuta la puerta contra un paquete raiz y devuelve { code, report }. */
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

/** El texto "de origen" que el upstream tendria (una racha larga). */
const UPSTREAM_TEXT = [
  'export function drawSomething(ctx, S, rx, ry, turnShiftX = 0, sinYaw = 0) {',
  '  ctx.save();',
  '  ctx.translate(S.headLookX * 9 + turnShiftX * 0.45, -ry * 0.9 + S.accessoryOffsetY);',
  '  ctx.fillStyle = "#123456";',
  '  ctx.beginPath();',
  '  ctx.rect(-14, -4, 28, 10);',
  '  ctx.fill();',
  '  ctx.restore();',
  '}',
].join('\n');

/**
 * Paquete minimo: un corpus `vendor/` que hace de upstream y un fichero
 * `src/copiado.js` cuyo texto se puede copiar o no.
 */
function makePackage({ copiar = false, presupuestos = true, maxShingles = 0, ficheroFantasma = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ego-verbatim-'));
  mkdirSync(join(root, 'src'), { recursive: true });
  mkdirSync(join(root, 'vendor', 'upstream'), { recursive: true });
  mkdirSync(join(root, 'tests'), { recursive: true });

  writeFileSync(join(root, 'vendor', 'upstream', 'thing.js'), UPSTREAM_TEXT + '\n');
  writeFileSync(
    join(root, 'src', 'copiado.js'),
    copiar
      ? UPSTREAM_TEXT + '\n'
      : [
          'export function ownThing(alpha, beta) {',
          '  const scale = alpha ** 0.5;',
          '  const offset = beta % 7;',
          '  return { scale, offset, tag: "ego" };',
          '}',
        ].join('\n') + '\n',
  );
  writeFileSync(join(root, 'tests', 'nota.test.js'), '// nota del paquete.\n');

  const manifest = {
    version: 1,
    package: 'fixture',
    upstreams: { upstream: { license: 'MIT', copyright: '(c) Fixture', corpus: 'vendor/upstream/' } },
    derived: [],
    native: [{ path: 'src/copiado.js', reason: 'fixture' }],
  };
  if (presupuestos) {
    manifest.native[0].verbatim = { maxShingles, note: 'presupuesto del fixture' };
    manifest.native.push({ path: 'tests/nota.test.js', reason: 'fixture', verbatim: { maxShingles: 0 } });
  }
  if (ficheroFantasma) {
    manifest.native.push({ path: 'src/fantasma.js', reason: 'no existe', verbatim: { maxShingles: 0 } });
  }
  writeFileSync(join(root, 'provenance.manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return root;
}

test('un fichero SIN residuo dentro de presupuesto pasa (exit 0)', () => {
  const root = makePackage({ copiar: false });
  try {
    const { code, report } = runGate(root);
    assert.equal(code, 0, `problemas: ${JSON.stringify(report?.problems)}`);
    assert.ok(report.medidos >= 2, `medidos: ${report.medidos}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un fichero CON residuo real FUERA de presupuesto falla (exit 1): la puerta muerde', () => {
  const root = makePackage({ copiar: true, maxShingles: 0 });
  try {
    const { code, report } = runGate(root);
    assert.equal(code, 1, 'con codigo del upstream y presupuesto 0, la puerta tiene que fallar');
    assert.ok(
      report.problems.some((p) => p.includes('copiado.js') && /residuo/i.test(p)),
      `problemas: ${JSON.stringify(report.problems)}`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un presupuesto con tolerancia admite el residuo que declara (exit 0)', () => {
  const root = makePackage({ copiar: true, maxShingles: 1000 });
  try {
    const { code } = runGate(root);
    assert.equal(code, 0, 'un presupuesto alto admite el residuo');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un fichero con presupuesto que NO existe falla (exit 1)', () => {
  const root = makePackage({ copiar: false, ficheroFantasma: true });
  try {
    const { code, report } = runGate(root);
    assert.equal(code, 1);
    assert.ok(
      report.problems.some((p) => p.includes('fantasma.js')),
      `problemas: ${JSON.stringify(report.problems)}`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('SIN presupuestos en el manifiesto la puerta FALLA (exit 1): una puerta que no mide nada no es una puerta', () => {
  // Regresion de EGO-FIND-105: con el manifiesto sin presupuestos, la puerta
  // no media nada. Antes eso pasaba (exit 0) y la puerta era vacia.
  const root = makePackage({ copiar: true, presupuestos: false });
  try {
    const { code, report } = runGate(root);
    assert.equal(code, 1, 'sin presupuestos, la puerta tiene que fallar');
    assert.ok(
      report.problems.some((p) => /presupuesto/i.test(p)),
      `problemas: ${JSON.stringify(report.problems)}`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un fichero en disco SIN clasificar falla (exit 1)', () => {
  const root = makePackage({ copiar: false });
  try {
    writeFileSync(join(root, 'src', 'nuevo.js'), '// nuevo, sin clasificar.\nexport const x = 1;\n');
    const { code, report } = runGate(root);
    assert.equal(code, 1);
    assert.ok(
      report.problems.some((p) => p.includes('nuevo.js')),
      `problemas: ${JSON.stringify(report.problems)}`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('la puerta real del paquete pasa (exit 0) y mide ficheros de verdad', () => {
  const { code, report } = runGate(PKG);
  assert.equal(code, 0, `problemas: ${JSON.stringify(report?.problems)}`);
  assert.ok(report.medidos >= 80, `medidos: ${report.medidos}`);
  assert.ok(report.budgets >= 80, `presupuestos: ${report.budgets}`);
});

test('el manifiesto real declara presupuesto para TODO fichero nativo (0) y para los derivados', () => {
  const manifest = JSON.parse(readFileSync(join(PKG, 'provenance.manifest.json'), 'utf8'));
  for (const n of manifest.native) {
    assert.ok(
      n.verbatim && Number.isFinite(n.verbatim.maxShingles),
      `el nativo ${n.path} debe declarar verbatim.maxShingles`,
    );
    assert.equal(n.verbatim.maxShingles, 0, `el nativo ${n.path} tiene presupuesto 0`);
  }
  for (const d of manifest.derived) {
    assert.ok(
      d.verbatim && Number.isFinite(d.verbatim.maxShingles),
      `el derivado ${d.path} debe declarar verbatim.maxShingles`,
    );
  }
});
