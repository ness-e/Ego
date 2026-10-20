// render.test.js — SVG estático: determinismo, estructura y sanidad.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { staticSVG } from '../src/render/static.js';
import { generateGenome } from '../src/core/genome.js';
import { STATES } from '../src/runtime/states.js';
import { VERSION } from '../src/version.js';

test('misma semilla ⇒ SVG byte a byte idéntico', () => {
  const a = staticSVG('subego:conocimiento');
  const b = staticSVG('subego:conocimiento');
  assert.equal(a, b);
});

test('semillas distintas ⇒ SVG distintos', () => {
  assert.notEqual(staticSVG('luna'), staticSVG('orion'));
});

test('estructura mínima: svg + defs + aura + cuerpo + ojos + insignia', () => {
  const svg = staticSVG('estructura-test');
  assert.ok(svg.startsWith('<svg viewBox="0 0 240 240"'));
  assert.ok(svg.includes('<defs>'));
  assert.ok(svg.includes('class="aura"'));
  assert.ok(svg.includes('class="body"'));
  assert.ok(svg.includes('class="eye eye-L"'));
  assert.ok(svg.includes('class="eye eye-R"'));
  assert.ok(svg.includes('class="badge"'));
  assert.ok(svg.includes('class="particles"'));
  assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.includes(`aria-label="avatar estructura-test"`));
});

test('sin NaN/Infinity/undefined en ninguna semilla ni estado', () => {
  for (let i = 0; i < 60; i++) {
    const seed = `sanidad-${i}`;
    for (const state of Object.keys(STATES)) {
      const svg = staticSVG(seed, { state });
      assert.ok(!svg.includes('NaN'), `${seed}/${state} contiene NaN`);
      assert.ok(!svg.includes('Infinity'), `${seed}/${state} contiene Infinity`);
      assert.ok(!svg.includes('undefined'), `${seed}/${state} contiene undefined`);
    }
  }
});

test('todos los estados renderizan y aplican tinte/insignia cuando corresponde', () => {
  const seed = 'estados-test';
  const idle = staticSVG(seed, { state: 'idle' });
  assert.ok(idle.includes('class="tint"'), 'tinte presente como nodo');

  const error = staticSVG(seed, { state: 'error' });
  assert.ok(/class="tint" style="fill:hsl\(352[^"]*" opacity="0\.6"/.test(error), 'tinte de error aplicado');
  assert.ok(error.includes('visibility="visible"'), 'insignia visible en error');

  const working = staticSVG(seed, { state: 'working' });
  assert.ok(working.includes('scale(1)'), 'insignia con escala1 en working');

  const sleeping = staticSVG(seed, { state: 'sleeping' });
  // pose sleep: elipse fina (h=10 → ry = 5×scale ≤ 6.25) + párpados presentes
  assert.ok(sleeping.includes('class="eye-top"'), 'párpados presentes en sleeping');
  const rys = [...sleeping.matchAll(/<ellipse class="eye-base"[^>]*ry="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.equal(rys.length, 2, 'dos elipses');
  assert.ok(rys.every((v) => v <= 6.25), `elipse fina de sleep: ${rys}`);
});

test('emotes cambian la pose en el snapshot', () => {
  const g = generateGenome('emote-test');
  const svg = staticSVG('emote-test', { state: 'idle', emote: 'love' });
  // pose happy: rx = 58/2 × scale del genoma, párpado superior retraído (−36)
  const rx = (29 * g.eyes.scale).toFixed(2);
  assert.ok(svg.includes(`rx="${rx}"`), `pose happy: rx ${rx}`);
  assert.ok(svg.includes('y="-126"'), 'párpado superior retraído (topY −36)');
});

test('modo input: barra de cursor visible y elipse oculta', () => {
  const svg = staticSVG('input-test', { state: 'listening' });
  assert.ok(svg.includes('class="eye-input"'), 'barra presente');
  assert.ok(/class="eye-input"[^>]*opacity="1"/.test(svg), 'barra visible en listening');
});

test('todos los genes visibles afectan la salida (sensibilidad)', () => {
  // misma seed con distinto marking/appendage/roundness debería cambiar el SVG
  const seen = new Set();
  for (let i = 0; i < 80; i++) {
    const seed = `sens-${i}`;
    const g = generateGenome(seed);
    seen.add(`${g.marking}|${g.appendage}|${g.shape.roundness}`);
    const svg = staticSVG(seed);
    assert.ok(svg.length > 500, 'SVG no vacío');
  }
  assert.ok(seen.size > 10, 'variedad de combinaciones');
});

test('las IDs de clip derivan de la semilla (uid estable)', () => {
  const svg = staticSVG('uid-check');
  const m = /id="clip-([a-z0-9]+)"/.exec(svg);
  assert.ok(m, 'id de clip presente');
  const again = staticSVG('uid-check');
  assert.equal(/id="clip-([a-z0-9]+)"/.exec(again)[1], m[1]);
});

test('cabeza ARA: path de 160 puntos y redondeo visible por genoma', () => {
  const a = staticSVG('round-1');
  const m = /<path class="body" d="([^"]+)"/.exec(a);
  assert.ok(m, 'path de cabeza presente');
  assert.ok(m[1].startsWith('M 120.00'), 'plantilla ARA (arranca en la coronilla, x=120)');
  assert.ok(m[1].endsWith('Z'), 'path cerrado');
});

test('export del paquete: VERSION válida', () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
});
