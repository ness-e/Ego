// tests/public-surface.test.js — la superficie pública declarada == la exportada.
//
// Este test MUERDE cuando alguien añade una exportación al barrel
// (`src/index.js`) sin actualizar `index.d.ts`, o cuando el `.d.ts` declara
// algo que el barrel ya no exporta.
//
// Se usa el COMPILADOR de TypeScript para leer el `.d.ts` (no expresiones
// regulares): un `.d.ts` puede declarar de varias formas (`export const`,
// `export declare const`, `export { a, b }`, `export interface`…) y las
// expresiones regulares se inventan una forma que no existe.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');

const barrel = await import('../src/index.js');
const states = await import('../src/runtime/states.js');
const realExports = Object.keys(barrel).filter((k) => k !== 'default').sort();

/** Lo declarado en el .d.ts, separado en valores y tipos. */
function readDeclaration() {
  const file = join(PKG, 'index.d.ts');
  const text = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const values = new Set();
  const types = new Set();
  for (const st of sf.statements) {
    let names = [];
    let isType = false;
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) names.push(d.name.text);
    } else if (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isEnumDeclaration(st)) {
      if (st.name && ts.isIdentifier(st.name)) names.push(st.name.text);
    } else if (ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st)) {
      if (st.name && ts.isIdentifier(st.name)) { names.push(st.name.text); isType = true; }
    } else if (ts.isExportDeclaration(st) && st.exportClause && ts.isNamedExports(st.exportClause)) {
      for (const el of st.exportClause.elements) names.push(el.name.text);
    }
    for (const n of names) (isType ? types : values).add(n);
  }
  return { values, types, text, sf };
}

test('index.d.ts declara TODAS las exportaciones del barrel (y ninguna de mas)', () => {
  const { values } = readDeclaration();
  const real = new Set(realExports);
  const faltan = realExports.filter((k) => !values.has(k));
  const sobran = [...values].filter((k) => !real.has(k));
  assert.deepEqual(faltan, [], `exportaciones del barrel SIN declarar en index.d.ts: ${faltan.join(', ')}`);
  assert.deepEqual(sobran, [], `declaraciones de index.d.ts que el barrel NO exporta: ${sobran.join(', ')}`);
});

test('el tipo StateName declara exactamente los estados del motor', () => {
  const { sf } = readDeclaration();
  const reales = Object.keys(states.STATES).sort();
  let declarados = [];
  for (const st of sf.statements) {
    if (ts.isTypeAliasDeclaration(st) && st.name.text === 'StateName' && st.type && ts.isUnionTypeNode(st.type)) {
      for (const t of st.type.types) {
        if (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) declarados.push(t.literal.text);
      }
    }
  }
  assert.deepEqual([...declarados].sort(), reales, 'StateName debe coincidir con STATES');
});

test('markingDetail esta tipado (no `unknown` sucio)', () => {
  const { sf } = readDeclaration();
  let detalle = null;
  for (const st of sf.statements) {
    if (ts.isInterfaceDeclaration(st) && st.name.text === 'Genome') {
      for (const m of st.members) {
        if (ts.isPropertySignature(m) && m.name && ts.isIdentifier(m.name) && m.name.text === 'markingDetail') {
          detalle = m.type;
        }
      }
    }
  }
  assert.ok(detalle, 'Genome.declaringDetail debe existir');
  const texto = detalle.getText();
  assert.ok(!/^unknown$/.test(texto.trim()), `markingDetail no puede ser 'unknown' (es ${texto})`);
});

test('la generacion de tipos es idempotente (scripts/build-types.mjs --check)', () => {
  // Si el .d.ts esta al dia, el generador no tiene nada que anadir.
  const { execFileSync } = require('node:child_process');
  const out = execFileSync(
    process.execPath,
    [join(PKG, 'scripts', 'build-types.mjs'), '--check'],
    { cwd: PKG, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  assert.match(out, /superficie completa/, out);
});
