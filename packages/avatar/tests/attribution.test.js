// tests/attribution.test.js — la puerta de atribución (plano 1: CÓDIGO).
//
// La puerta es el mecanismo que hace REPRODUCIBLE el trabajo de la cabecera
// canónica: su denominador es `provenance.manifest.json`, no una edición
// manual. Este test la ejercita con fixtures: cada caso monta un paquete
// mínimo en un directorio temporal y comprueba el exit code.
//
// Casos (los que pide el contrato de la Ola 8):
//   conforme            -> 0
//   derivado sin cabecera -> 1
//   cabecera malformada -> 1
//   licencia que no cuadra -> 1
//   nativo sin cabecera -> 0
//   + nativo CON cabecera (atribución falsa) -> 1
//   + LICENSE.md sin el aviso -> 1
//   + fichero en disco sin clasificar -> 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const GATE = join(PKG, 'scripts', 'check-attribution.mjs');

/** Ejecuta la puerta contra un paquete raiz y devuelve {code, report}. */
function runGate(root, extra = []) {
  let out = '';
  let code = 0;
  try {
    out = execFileSync(process.execPath, [GATE, '--root', root, '--json', ...extra], {
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

/** Paquete minimo conforme: un derivado con cabecera y un nativo sin ella. */
function makePackage({ derivedHeader, licenseText } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ego-attr-'));
  mkdirSync(join(root, 'src'), { recursive: true });
  mkdirSync(join(root, 'vendor', 'coucou'), { recursive: true });
  mkdirSync(join(root, 'tests'), { recursive: true });

  writeFileSync(join(root, 'LICENSE'), 'MIT License\n\nCopyright (c) 2026 Ego Project\n');
  writeFileSync(join(root, 'NOTICE'), 'NOTICE\n');
  writeFileSync(
    join(root, 'LICENSE.md'),
    licenseText ??
      '# Licencias\n\n' +
        '## coucou\n\n' +
        'MIT - Copyright (c) Louis Raillart. Ver `vendor/coucou/*.ts`.\n',
  );
  writeFileSync(join(root, 'vendor', 'coucou', 'anim.ts'), 'export const ease = 1;\n');

  writeFileSync(
    join(root, 'provenance.manifest.json'),
    JSON.stringify(
      {
        version: 1,
        package: 'fixture',
        headerForm: 'Adapted from <upstream> (<LICENCIA>), <ruta de origen>',
        headerPattern: '^\\s*//\\s*Adapted from\\s+([A-Za-z0-9_.-]+)\\s+\\(([^)]*)\\),\\s*(\\S.*?)\\s*$',
        upstreams: {
          coucou: { license: 'MIT', copyright: '(c) Louis Raillart', corpus: 'vendor/coucou/' },
        },
        derived: [
          {
            path: 'src/anim.js',
            upstream: 'coucou',
            origin: 'vendor/coucou/anim.ts',
            via: 'repos-referencia/avatar/src/core/anim.js',
            evidence: 'port del modulo de easings',
          },
        ],
        native: [{ path: 'src/prng.js', reason: 'codigo propio de Ego' }],
      },
      null,
      2,
    ) + '\n',
  );

  writeFileSync(
    join(root, 'src', 'anim.js'),
    derivedHeader ??
      '// anim.js - easings y springs.\n' +
        '// Adapted from coucou (MIT), vendor/coucou/anim.ts\n' +
        'export const ease = 1;\n',
  );
  writeFileSync(join(root, 'src', 'prng.js'), '// prng.js - propio de Ego.\nexport const rnd = 1;\n');
  return root;
}

test('un paquete conforme pasa la puerta (exit 0)', () => {
  const root = makePackage();
  try {
    const { code, report } = runGate(root);
    assert.equal(code, 0, `la puerta debio pasar; problemas: ${JSON.stringify(report?.problems)}`);
    assert.equal(report.ok, true);
    assert.equal(report.derived.length, 1);
    assert.equal(report.native.length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un derivado SIN cabecera canonica falla (exit 1)', () => {
  const root = makePackage({ derivedHeader: '// anim.js - easings y springs.\nexport const ease = 1;\n' });
  try {
    const { code, report } = runGate(root);
    assert.equal(code, 1);
    assert.ok(
      report.problems.some((p) => p.includes('anim.js') && /cabecera/i.test(p)),
      `problemas: ${JSON.stringify(report.problems)}`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('una cabecera MAL FORMADA falla (exit 1)', () => {
  // Le falta la coma y la ruta: no es `Adapted from <upstream> (<LIC>), <ruta>`.
  const root = makePackage({
    derivedHeader:
      '// anim.js - easings y springs.\n' +
      '// Adapted from coucou MIT vendor/coucou/anim.ts\n' +
      'export const ease = 1;\n',
  });
  try {
    const { code, report } = runGate(root);
    assert.equal(code, 1);
    assert.ok(
      report.problems.some((p) => p.includes('anim.js')),
      `problemas: ${JSON.stringify(report.problems)}`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('una cabecera cuya LICENCIA no cuadra con el manifiesto falla (exit 1)', () => {
  const root = makePackage({
    derivedHeader:
      '// anim.js - easings y springs.\n' +
      '// Adapted from coucou (Apache-2.0), vendor/coucou/anim.ts\n' +
      'export const ease = 1;\n',
  });
  try {
    const { code, report } = runGate(root);
    assert.equal(code, 1);
    assert.ok(
      report.problems.some((p) => /licencia/i.test(p)),
      `problemas: ${JSON.stringify(report.problems)}`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('una cabecera cuya RUTA no cuadra con el manifiesto falla (exit 1)', () => {
  const root = makePackage({
    derivedHeader:
      '// anim.js - easings y springs.\n' +
      '// Adapted from coucou (MIT), vendor/coucou/otro.ts\n' +
      'export const ease = 1;\n',
  });
  try {
    const { code, report } = runGate(root);
    assert.equal(code, 1);
    assert.ok(
      report.problems.some((p) => /ruta|origen/i.test(p)),
      `problemas: ${JSON.stringify(report.problems)}`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un NATIVO sin cabecera NO falla (exit 0)', () => {
  const root = makePackage();
  try {
    const { code, report } = runGate(root);
    assert.equal(code, 0);
    assert.ok(
      !report.problems.some((p) => p.includes('prng.js')),
      `un nativo sin cabecera no es un problema: ${JSON.stringify(report.problems)}`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un nativo CON cabecera canonica falla: seria una atribucion falsa (exit 1)', () => {
  const root = makePackage();
  try {
    writeFileSync(
      join(root, 'src', 'prng.js'),
      '// prng.js - propio de Ego.\n' +
        '// Adapted from coucou (MIT), vendor/coucou/anim.ts\n' +
        'export const rnd = 1;\n',
    );
    const { code, report } = runGate(root);
    assert.equal(code, 1);
    assert.ok(
      report.problems.some((p) => p.includes('prng.js')),
      `problemas: ${JSON.stringify(report.problems)}`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sin manifiesto, la puerta falla con un error ACCIONABLE (no un TypeError)', () => {
  // EGO-FIND-116: la puerta no puede reventar con un `TypeError` de una
  // propiedad undefined: dice qué falta y cómo arreglarlo.
  const root = makePackage();
  try {
    rmSync(join(root, 'provenance.manifest.json'), { force: true });
    const { code, report, out } = runGate(root);
    assert.equal(code, 1, 'sin manifiesto la puerta falla');
    assert.ok(report, 'debe emitir informe: ' + out.slice(0, 300));
    const problema = report.problems.find((p) => /manifiesto/i.test(p));
    assert.ok(problema, `debe señalar el manifiesto ausente: ${JSON.stringify(report.problems)}`);
    assert.match(problema, /denominador/i, 'el mensaje explica para que sirve el manifiesto');
    assert.match(problema, /measure-verbatim|genera/i, 'el mensaje dice como arreglarlo');
    assert.ok(!/TypeError|undefined/.test(out), 'no debe haber un TypeError: ' + out.slice(0, 200));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('--fix NO muta el repositorio: la puerta no puede aprobarse a si misma', () => {
  // EGO-FIND-109: antes, `--fix` reescribia el repo, asi que correr la puerta
  // dejaba el arbol en el estado que la puerta quiere: la puerta se aprobaba
  // a si misma. Ahora `--fix` escribe una PROPUESTA y no toca nada; el arbol
  // sigue sin la cabecera, asi que la puerta sigue fallando.
  const root = makePackage({ derivedHeader: '// anim.js - easings y springs.\nexport const ease = 1;\n' });
  try {
    const antes = readFileSync(join(root, 'src', 'anim.js'), 'utf8');

    // 1) la puerta, con --fix, falla igual (no se auto-aprueba)
    const fix = runGate(root, ['--fix']);
    assert.equal(fix.code, 1, 'con --fix la puerta debe seguir fallando');

    // 2) el fichero NO ha cambiado
    const despues = readFileSync(join(root, 'src', 'anim.js'), 'utf8');
    assert.equal(despues, antes, '--fix no puede reescribir el repositorio');

    // 3) lo que deja es una PROPUESTA, en un fichero aparte
    const propuesta = join(root, 'provenance.proposed.json');
    assert.ok(existsSync(propuesta), '--fix debe escribir la propuesta');
    const doc = JSON.parse(readFileSync(propuesta, 'utf8'));
    assert.ok(Array.isArray(doc.cambios) && doc.cambios.length >= 1, 'la propuesta lista los cambios');
    assert.match(doc.cambios[0].line, /Adapted from coucou \(MIT\), vendor\/coucou\/anim\.ts/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un nativo con una cabecera "Adapted from" en la forma VIEJA tambien falla', () => {
  // La forma vieja (upstream con "/" y licencia entre parentesis) no casa con
  // el matcher del manifiesto, pero en un nativo sigue siendo una atribucion
  // falsa: la puerta no puede tener ese punto ciego.
  const root = makePackage();
  try {
    writeFileSync(
      join(root, 'src', 'prng.js'),
      '// prng.js - propio de Ego.\n' +
        '// Adapted from ego-avatar/avatar_studio_cx_artlab_mochi_2_0.html (MIT),\n' +
        '// lineas 1-2: se adapta el patron.\n' +
        'export const rnd = 1;\n',
    );
    const { code, report } = runGate(root);
    assert.equal(code, 1);
    assert.ok(
      report.problems.some((p) => p.includes('prng.js')),
      `problemas: ${JSON.stringify(report.problems)}`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un paquete con codigo derivado y SIN aviso en LICENSE.md falla (exit 1)', () => {
  const root = makePackage({ licenseText: '# Licencias\n\nSin avisos.\n' });
  try {
    const { code, report } = runGate(root);
    assert.equal(code, 1);
    assert.ok(
      report.problems.some((p) => /LICENSE\.md/i.test(p)),
      `problemas: ${JSON.stringify(report.problems)}`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un fichero en disco SIN clasificar en el manifiesto falla (exit 1)', () => {
  const root = makePackage();
  try {
    writeFileSync(join(root, 'src', 'nuevo.js'), '// nuevo.js - sin clasificar.\nexport const x = 1;\n');
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

test('un fichero del manifiesto que NO existe en disco falla (exit 1)', () => {
  const root = makePackage();
  try {
    const manifestPath = join(root, 'provenance.manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.derived.push({
      path: 'src/inexistente.js',
      upstream: 'coucou',
      origin: 'vendor/coucou/anim.ts',
      via: 'x',
      evidence: 'y',
    });
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

test('la puerta real del paquete pasa (exit 0)', () => {
  const { code, report } = runGate(PKG);
  assert.equal(code, 0, `problemas: ${JSON.stringify(report?.problems)}`);
  // Baseline HONESTO tras la Ola 9 (decision D4): los seis ficheros
  // sustituidos (silueta, cuerpo, poses, timeline, sonido del studio y
  // accesorios) pasaron de derivados a nativos, asi que el reparto es 57/31.
  // Baseline HONESTO tras la Ola 10: el detector de verbatim corrigio una
  // clasificacion equivocada (`runtime/avatar-element.js` es un port real de
  // agent-robot-avatar: 342 shingles en rachas de 107 caracteres), asi que paso
  // de nativo a derivado. Reparto: 58 derivados + 31 nativos.
  // Baseline HONESTO tras la Ola 11: el perfil declarativo (EGO-FIND-116) adds
  // dos ficheros PROPIOS (el modulo de perfil y su test) => 58 derivados +
  // 33 nativos.
  assert.equal(report.derived.length, 58, `derivados declarados: ${report.derived.length}`);
  assert.equal(report.native.length, 36, `nativos declarados: ${report.native.length}`);
});
