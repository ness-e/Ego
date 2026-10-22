#!/usr/bin/env node
// scripts/check-attribution.mjs — puerta de atribución del plano 1 (CÓDIGO).
//
// Modelo (docs/extractions/README.md §4.3, dos planos):
//
//   - Plano 1 · CÓDIGO (`packages/**`): un fichero REALMENTE DERIVADO (un port
//     literal de un repo de referencia) lleva cabecera de fichero
//     `Adapted from <upstream> (<LICENCIA>), <ruta de origen>` y aviso de
//     licencia en el `LICENSE.md` de su paquete.
//   - Plano 2 · FICHA (`docs/extractions/*.md`): documento de análisis escrito
//     por Ego. Lleva fila de procedencia. NUNCA `Adapted from`.
//
// Y el otro plano de la regla, que no se puede violar: un fichero NATIVO
// (código propio de Ego, o asimilación de patrón) NO lleva esa cabecera.
// Inventarla sería una atribución falsa — el precedente EGO-FIND-83 (el owner
// retiró el crédito a khoj porque el código atribuido era propio).
//
// EL DENOMINADOR ES `provenance.manifest.json` (en el propio paquete): declara
// qué ficheros son derivados, de qué upstream, con qué licencia y de qué ruta
// de origen. La puerta NO depende de una edición manual: si el manifiesto no
// clasifica un fichero, la puerta falla.
//
// Qué comprueba:
//   1. Que existen LICENSE, LICENSE.md y NOTICE en la raíz del paquete.
//   2. Que el manifiesto existe, parsea y es coherente.
//   3. Cobertura: todo fichero de código en disco está clasificado, y toda
//      entrada del manifiesto existe en disco.
//   4. Que cada fichero DERIVADO lleva la cabecera canónica, con upstream,
//      licencia y ruta EXACTAMENTE los del manifiesto.
//   5. Que ningún fichero NATIVO lleva cabecera canónica.
//   6. Que el origen declarado resuelve (corpus dentro del paquete; ruta de
//      referencia dentro del clon de referencia si está presente).
//   7. Que el LICENSE.md recoge el aviso de cada upstream usado.
//   8. Que toda ruta `vendor/...` citada en LICENSE.md y en las cabeceras
//      existe (la cadena MIT es resoluble dentro del repositorio).
//   9. Que el corpus no se importa desde `src/`.
//  10. Que la copia vendorizada lleva su corpus y coincide por SHA-256.
//  11. Que la copia vendorizada lleva las MISMAS cabeceras canónicas.
//
// Uso:
//   node scripts/check-attribution.mjs [--root <dir>] [--json] [--fix]
//
//   --root <dir>  raíz del paquete a comprobar (por defecto, el propio). Es lo
//                 que permite ejercitar la puerta con fixtures.
//   --json        informe machine por stdout.
//   --fix         NO muta el repositorio: escribe una PROPUESTA
//                 (`provenance.proposed.json`) con la cabecera canonica que
//                 cada fichero derivado deberia llevar. Escribirla no cambia
//                 el estado que la puerta verifica, asi que **la puerta no
//                 puede aprobarse a si misma** (el principio del repo: "una
//                 puerta que puede aprobarse a si misma no es una puerta").
//   --fix --apply  aplica la propuesta al arbol (doble opt-in explicito:
//                 hace falta decir las dos palabras).
//
// Salida: 0 = conforme; 1 = hay problemas; 2 = error de uso.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const REPO = resolve(PKG, '..', '..');
const VENDORED = join(REPO, 'apps', 'desktop', 'renderer', 'floating', 'vendor', 'avatar');
const REFERENCE_CLONE = join(REPO, 'repos-referencia', 'avatar');

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const fix = args.includes('--fix');
/** Aplicar de verdad exige las DOS palabras: `--fix --apply`. */
const apply = fix && args.includes('--apply');
const rootIdx = args.indexOf('--root');
if (rootIdx >= 0 && !args[rootIdx + 1]) {
  console.error('--root necesita un directorio');
  process.exit(2);
}
const ROOT = rootIdx >= 0 ? resolve(args[rootIdx + 1]) : PKG;
/** Sólo la puerta real conoce la copia vendorizada y el clon de referencia. */
const IS_REAL = ROOT === PKG;

/** Ficheros legales obligatorios en la raíz del paquete. */
const REQUIRED = ['LICENSE', 'LICENSE.md', 'NOTICE'];

/** Regex de una ruta de corpus: `vendor/<subtree>/<file>` con extensión típica. */
const VENDOR_PATH = /vendor\/[A-Za-z0-9_\-./]+?\.(?:js|ts|swift|html|css)/g;

/**
 * Las rutas de `LICENSE.md` no son ficheros sueltos sino familias:
 * `vendor/agent-robot-avatar/*.js`, `vendor/coucou/core/{anim,bridge}.ts`...
 * Este patrón captura el token completo (con `*` y `{}`) para poder expandirlo.
 */
const VENDOR_FAMILY = /vendor\/[A-Za-z0-9_\-./{},*]+/g;

/** Extensiones que cuentan como "código" para la cobertura del manifiesto. */
const CODE_EXT = /\.(js|mjs|cjs|ts|tsx|html|css)$/;

/** Cabecera canónica: se busca en las primeras líneas del fichero. */
const HEADER_WINDOW = 15;

function walk(dir, filter) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full, filter));
    else if (!filter || filter(full)) out.push(full);
  }
  return out;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** Extrae las rutas de corpus citadas en un texto. */
function extract(text) {
  const found = new Set();
  for (const m of text.matchAll(VENDOR_PATH)) found.add(m[0]);
  return [...found];
}

/**
 * Expande una familia con llaves: `{a,b}` -> `a`, `b` (recursivo).
 */
function expandBraces(pattern) {
  const m = pattern.match(/\{([^{}]*)\}/);
  if (!m) return [pattern];
  const [full, inner] = m;
  const out = [];
  for (const alt of inner.split(',')) {
    for (const p of expandBraces(pattern.replace(full, alt))) out.push(p);
  }
  return out;
}

/**
 * Resuelve una familia de rutas a ficheros reales.
 * `vendor/agent-robot-avatar/*.js` -> los 16 ficheros que existen.
 * @returns {{pattern: string, files: string[], missing: string[]}}
 */
function resolveFamily(family) {
  const patterns = expandBraces(family);
  const files = [];
  const missing = [];
  for (const pat of patterns) {
    // Una familia puede venir con punto final ("...core.js."): no es parte de
    // la ruta. Y puede ser un DIRECTORIO ("vendor/coucou/").
    const clean = pat.replace(/\.+$/, '');
    const abs = join(ROOT, clean);
    if (clean.endsWith('/') || (existsSync(abs) && statSync(abs).isDirectory())) {
      const found = walk(abs);
      if (found.length === 0) missing.push(pat);
      else files.push(...found);
    } else if (pat.includes('*')) {
      const dir = dirname(abs);
      const base = relative(dir, abs);
      const rx = new RegExp('^' + base.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
      const found = walk(dir).filter((f) => rx.test(relative(dir, f).split('\\').join('/')));
      if (found.length === 0) missing.push(pat);
      else files.push(...found);
    } else if (existsSync(abs) && statSync(abs).isFile()) {
      files.push(abs);
    } else {
      missing.push(pat);
    }
  }
  return { pattern: family, files, missing };
}

/* ── estilo de cabecera por extensión ─────────────────────────────────────── */

/**
 * El manifiesto declara, por extension, como se escribe la cabecera canonica.
 * El patron de busqueda se DERIVA del estilo, para que la forma de la linea y
 * su matcher no puedan divergir.
 */
const DEFAULT_STYLE = { prefix: '// ', suffix: '' };
const EXT_STYLE = { html: { prefix: '<!-- ', suffix: ' -->' }, css: { prefix: '/* ', suffix: ' */' } };

function styleFor(ext) {
  return EXT_STYLE[ext] ?? DEFAULT_STYLE;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Construye la linea canonica de un derivado. */
function canonicalLine(style, upstream, license, origin) {
  return `${style.prefix}Adapted from ${upstream} (${license}), ${origin}${style.suffix}`;
}

/** Construye el matcher de la cabecera canonica de un estilo. */
function canonicalMatcher(style) {
  const pre = escapeRe(style.prefix.trim());
  const suf = style.suffix.trim() ? escapeRe(style.suffix.trim()) : '';
  return new RegExp(
    `^\\s*${pre}\\s*Adapted from\\s+([A-Za-z0-9_.-]+)\\s+\\(([^)]*)\\),\\s*(\\S.*?)\\s*${suf}$`,
  );
}

function extOf(path) {
  const i = path.lastIndexOf('.');
  return i < 0 ? '' : path.slice(i + 1);
}

/* ── cabecera: busqueda e insercion ───────────────────────────────────────── */

/**
 * Lineas de atribucion PREVIAS (formas no canonicas) que `--fix` sustituye
 * por la cabecera canonica.
 *
 *  - `LEGACY_CANONICAL`: la forma vieja de la cabecera canonica
 *    (`Adapted from <algo> (<LIC>)`). Es una declaracion de atribucion en si
 *    misma: se SUSTITUYE (ademas puede afirmar una licencia que no cuadra).
 *  - `LEGACY_STATEMENT`: una declaracion de atribucion en prosa que es
 *    AUTOCONTENIDA (una sola linea terminada en punto). Tambien se sustituye.
 *    Si la frase continua en la linea siguiente, NO se toca: se inserta la
 *    cabecera canonica aparte, para no perder el detalle.
 */
const LEGACY_CANONICAL = /^\s*(?:\/\/|<!--|\/\*)\s*Adapted from\s+.*\s+\([^)]*\)/;
const LEGACY_STATEMENT =
  /^\s*(?:\/\/|<!--|\/\*)\s*(?:ADAPTADO de|PORTADO de|COPIA LITERAL|MISMO PAT[ÓO]N que|verbatim de|plantilla verbatim|Puerto verbatim|puerto verbatim|port verbatim|Tabla base verbatim)\b/i;

/** Devuelve { line, index } de la cabecera canonica en las primeras lineas. */
function findCanonical(text, style) {
  const rx = canonicalMatcher(style);
  const lines = text.split('\n');
  const limit = Math.min(HEADER_WINDOW, lines.length);
  for (let i = 0; i < limit; i++) {
    const m = rx.exec(lines[i]);
    if (m) return { line: lines[i], index: i, upstream: m[1], license: m[2], origin: m[3] };
  }
  return null;
}

/**
 * Indice de insercion: al final del PRIMER parrafo de comentario (la primera
 * racha de lineas de comentario, terminada por una linea de comentario vacia
 * o por una linea que no es comentario), de modo que la cabecera canonica no
 * parta una frase a la mitad y quede siempre dentro de la ventana de
 * busqueda. Si el parrafo es mas largo que la ventana, se inserta tras la
 * primera linea. En HTML, tras el doctype.
 */
function insertionIndex(lines, style) {
  const marker = style.prefix.trim();
  if (!lines[0] || !lines[0].trim().startsWith(marker)) {
    if (marker === '<!--') {
      for (let i = 0; i < Math.min(5, lines.length); i++) {
        if (/^\s*<!doctype/i.test(lines[i])) return i + 1;
      }
    }
    return 0;
  }
  let last = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === marker) break; // separador de parrafo
    if (t.startsWith(marker) || (marker === '/*' && /^\*(\s|$)/.test(t))) last = i;
    else break;
  }
  const idx = last + 1;
  return idx > HEADER_WINDOW ? 1 : idx;
}

/* ── arranque ─────────────────────────────────────────────────────────────── */

const problems = [];
const checked = [];
const notes = [];

/** Guarda un problema (dedup por texto). */
function problem(msg) {
  if (!problems.includes(msg)) problems.push(msg);
}

// 1) Ficheros legales obligatorios en la raíz del paquete.
for (const f of REQUIRED) {
  const p = join(ROOT, f);
  if (!existsSync(p)) problem(`falta ${f} en la raiz del paquete`);
  else checked.push(f);
}

// 2) El manifiesto: sin él, la puerta no tiene denominador.
const manifestPath = join(ROOT, 'provenance.manifest.json');
let manifest = null;
if (!existsSync(manifestPath)) {
  // Error ACCIONABLE, no un TypeError de una propiedad undefined: la puerta
  // dice QUE falta y COMO arreglarlo (EGO-FIND-116). El manifiesto es el
  // DENOMINADOR: sin el, la puerta no puede classificar nada.
  problem(
    'falta el manifiesto de procedencia: ' + relative(ROOT, manifestPath) +
      ' — es el DENOMINADOR de la puerta (declara que ficheros son derivados y ' +
      'cuales nativos). Genera sus presupuestos con: node scripts/measure-verbatim.mjs',
  );
} else {
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    problem(`provenance.manifest.json no parsea: ${e.message}`);
  }
}

let derivedList = [];
let nativeList = [];
if (manifest) {
  derivedList = manifest.derived ?? [];
  nativeList = manifest.native ?? [];
  const upstreams = manifest.upstreams ?? {};

  // 2a) Cobertura: todo fichero de codigo en disco esta clasificado.
  const onDisk = [];
  for (const sub of ['src', 'tests', 'demo']) {
    for (const f of walk(join(ROOT, sub))) {
      const rel = `${sub}/${relative(join(ROOT, sub), f).split('\\').join('/')}`;
      if (CODE_EXT.test(rel)) onDisk.push(rel);
    }
  }
  const classified = new Map();
  for (const d of derivedList) classified.set(d.path, 'derived');
  for (const n of nativeList) classified.set(n.path, 'native');
  for (const f of onDisk) {
    if (!classified.has(f)) {
      problem(`fichero en disco SIN clasificar en el manifiesto: ${f}`);
    }
  }
  for (const p of classified.keys()) {
    if (!onDisk.includes(p) && !p.endsWith('.json')) {
      problem(`el manifiesto clasifica ${p}, pero ese fichero no existe`);
    }
  }

  // 2b) Cabeceras canonicas.
  const usedUpstreams = new Set();
  for (const d of derivedList) {
    const abs = join(ROOT, d.path);
    if (!existsSync(abs)) continue;
    const style = styleFor(extOf(d.path));
    const text = readFileSync(abs, 'utf8');
    const found = findCanonical(text, style);
    if (!found) {
      problem(`derivado SIN cabecera canonica: ${d.path} (se espera: ${canonicalLine(style, d.upstream, upstreams[d.upstream]?.license ?? '?', d.origin)})`);
      continue;
    }
    const up = upstreams[d.upstream];
    if (!up) {
      problem(`cabecera de ${d.path}: upstream desconocido "${d.upstream}" (no esta en el manifiesto)`);
      continue;
    }
    usedUpstreams.add(d.upstream);
    if (found.upstream !== d.upstream) {
      problem(`cabecera de ${d.path}: upstream "${found.upstream}" no cuadra con el manifiesto ("${d.upstream}")`);
    }
    if (found.license !== up.license) {
      problem(`cabecera de ${d.path}: licencia "${found.license}" no cuadra con el manifiesto ("${up.license}")`);
    }
    if (found.origin !== d.origin) {
      problem(`cabecera de ${d.path}: ruta de origen "${found.origin}" no cuadra con el manifiesto ("${d.origin}")`);
    }
    checked.push(d.path);
  }

  // 2c) Un NATIVO con cabecera canonica seria una atribucion falsa.
  //     Se busca CUALQUIER forma de cabecera canonica (incluida la vieja, con
  //     una ruta con "/" en el upstream), no solo la que casa con el
  //     manifiesto: cualquier "Adapted from" en un nativo es suspecto.
  const ANY_CANONICAL = /^\s*(?:\/\/|<!--|\/\*)\s*Adapted from\b/;
  for (const n of nativeList) {
    const abs = join(ROOT, n.path);
    if (!existsSync(abs)) continue;
    const style = styleFor(extOf(n.path));
    const text = readFileSync(abs, 'utf8');
    const found = findCanonical(text, style);
    if (found) {
      problem(`nativo CON cabecera canonica (atribucion falsa): ${n.path}`);
      continue;
    }
    const lines = text.split('\n');
    const limit = Math.min(HEADER_WINDOW, lines.length);
    for (let i = 0; i < limit; i++) {
      if (ANY_CANONICAL.test(lines[i])) {
        problem(`nativo CON una cabecera "Adapted from" (atribucion falsa): ${n.path}:${i + 1}`);
        break;
      }
    }
  }

  // 2d) El origen declarado debe resolver.
  for (const d of derivedList) {
    const origin = d.origin;
    if (origin.startsWith('vendor/')) {
      if (!existsSync(join(ROOT, origin))) {
        problem(`origen NO resoluble dentro del paquete: ${origin} (citado por ${d.path})`);
      }
    } else if (origin.startsWith('repos-referencia/')) {
      const abs = join(REPO, origin);
      if (existsSync(abs)) {
        if (!existsSync(abs)) problem(`origen NO resoluble: ${origin} (citado por ${d.path})`);
      } else if (existsSync(REFERENCE_CLONE)) {
        // El clon esta presente: la ruta debe existir dentro de el.
        const inClone = join(REFERENCE_CLONE, origin.replace(/^repos-referencia\/avatar\/?/, ''));
        if (!existsSync(inClone)) {
          problem(`origen NO resoluble en el clon de referencia: ${origin} (citado por ${d.path})`);
        }
      } else {
        notes.push(`origen en la ruta de referencia no comprobable (clon ausente): ${origin}`);
      }
    } else {
      problem(`origen con forma desconocida: ${origin} (citado por ${d.path})`);
    }
  }

  // 2e) El LICENSE.md debe recoger el aviso de cada upstream usado.
  const licensePath = join(ROOT, 'LICENSE.md');
  if (existsSync(licensePath)) {
    const text = readFileSync(licensePath, 'utf8');
    for (const up of usedUpstreams) {
      const meta = upstreams[up];
      if (!meta) continue;
      if (!text.includes(up)) {
        problem(`LICENSE.md no recoge el aviso del upstream "${up}" (usado por codigo derivado)`);
      } else if (meta.license && !text.includes(meta.license)) {
        problem(`LICENSE.md no menciona la licencia "${meta.license}" del upstream "${up}"`);
      }
    }
  }
}

// 3) Familias de rutas citadas en LICENSE.md -> deben expandir a ficheros reales.
const licensePath = join(ROOT, 'LICENSE.md');
let licenseFamilies = [];
let licenseFiles = 0;
if (!existsSync(licensePath)) {
  problem('no existe LICENSE.md');
} else {
  const text = readFileSync(licensePath, 'utf8');
  const families = new Set();
  for (const m of text.matchAll(VENDOR_FAMILY)) families.add(m[0]);
  licenseFamilies = [...families];
  for (const fam of licenseFamilies) {
    const r = resolveFamily(fam);
    licenseFiles += r.files.length;
    if (r.missing.length) {
      problem(`LICENSE.md cita ${fam} y no expande a ficheros reales: ${r.missing.join(', ')}`);
    }
    for (const f of r.files) checked.push(relative(ROOT, f));
  }
}

// 4) Rutas citadas en las cabeceras de src/.
const srcRoutes = new Map();
for (const file of walk(join(ROOT, 'src'), (f) => f.endsWith('.js'))) {
  for (const r of extract(readFileSync(file, 'utf8'))) {
    const p = join(ROOT, r);
    srcRoutes.set(r, existsSync(p));
    if (!existsSync(p)) problem(`cabecera cita ${r} (${relative(ROOT, file)}) y NO existe`);
    else checked.push(r);
  }
}

// 5) El corpus no se importa desde src/.
const imports = [];
for (const file of walk(join(ROOT, 'src'), (f) => f.endsWith('.js'))) {
  const text = readFileSync(file, 'utf8');
  const m = text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g);
  for (const x of m) {
    if (x[1].includes('vendor/')) imports.push(`${relative(ROOT, file)} -> ${x[1]}`);
  }
}
if (imports.length) {
  for (const i of imports) problem(`src/ importa el corpus de atribucion: ${i}`);
}

// 6) La copia vendorizada lleva su corpus y coincide.
let corpusFiles = 0;
let corpusMismatch = 0;
const corpusDir = join(ROOT, 'vendor');
if (!existsSync(corpusDir)) {
  problem('no existe el corpus vendor/');
} else {
  const files = walk(corpusDir);
  corpusFiles = files.length;
  if (IS_REAL) {
    for (const f of files) {
      const rel = relative(corpusDir, f);
      const vendoredFile = join(VENDORED, 'vendor', rel);
      if (!existsSync(vendoredFile)) {
        problem(`la copia vendorizada no lleva vendor/${rel}`);
        corpusMismatch++;
        continue;
      }
      if (sha256(f) !== sha256(vendoredFile)) {
        problem(`vendor/${rel} difiere entre el paquete y la copia vendorizada`);
        corpusMismatch++;
      }
    }
    for (const f of REQUIRED) {
      if (!existsSync(join(VENDORED, f))) problem(`la copia vendorizada no lleva ${f}`);
    }
  }
}

// 7) La copia vendorizada lleva las MISMAS cabeceras canonicas.
//    Su layout NO tiene el prefijo `src/`: el contenido de `src/` cuelga de la
//    raiz de la copia (`vendor/avatar/core/anim.js`), y el corpus va en
//    `vendor/avatar/vendor/`.
let vendoredChecked = 0;
if (IS_REAL && manifest) {
  for (const d of derivedList) {
    if (!d.path.startsWith('src/')) continue; // la copia solo lleva `src/`
    const vendoredFile = join(VENDORED, d.path.slice('src/'.length));
    if (!existsSync(vendoredFile)) continue;
    const style = styleFor(extOf(d.path));
    const found = findCanonical(readFileSync(vendoredFile, 'utf8'), style);
    if (!found) {
      problem(`la copia vendorizada no lleva la cabecera canonica: ${d.path}`);
    } else if (found.upstream !== d.upstream || found.license !== manifest.upstreams[d.upstream]?.license || found.origin !== d.origin) {
      problem(`la cabecera canonica de la copia vendorizada no cuadra con el manifiesto: ${d.path}`);
    } else {
      vendoredChecked++;
    }
  }
}

/* ── --fix: PROPUESTA (no muta el repositorio) ─────────────────────────── */

/**
 * Calcula el cambio de cabecera de un fichero (sin escribirlo).
 * @returns {{path: string, action: 'replace'|'insert', line: string, index: number}|null}
 */
function planHeaderChange(d, up, text, style) {
  const found = findCanonical(text, style);
  const line = canonicalLine(style, d.upstream, up.license, d.origin);
  if (found) {
    if (found.line.trim() === line.trim()) return null;
    return { path: d.path, action: 'replace', line, index: found.index };
  }
  // Sustituye una atribucion previa si la hay (forma no canonica); si no,
  // inserta al final del primer parrafo de comentario.
  const lines = text.split('\n');
  let legacy = -1;
  const limit = Math.min(HEADER_WINDOW, lines.length);
  for (let i = 0; i < limit; i++) {
    const t = lines[i].trim();
    if (LEGACY_CANONICAL.test(lines[i]) || (LEGACY_STATEMENT.test(lines[i]) && t.endsWith('.'))) {
      legacy = i;
      break;
    }
  }
  if (legacy >= 0) return { path: d.path, action: 'replace', line, index: legacy };
  return { path: d.path, action: 'insert', line, index: insertionIndex(lines, style) };
}

let fixed = 0;
if (fix && manifest) {
  const cambios = [];
  for (const d of derivedList) {
    const abs = join(ROOT, d.path);
    if (!existsSync(abs)) continue;
    const up = manifest.upstreams[d.upstream];
    if (!up) continue;
    const style = styleFor(extOf(d.path));
    const change = planHeaderChange(d, up, readFileSync(abs, 'utf8'), style);
    if (change) cambios.push(change);
  }

  if (!apply) {
    // SOLO PROPUESTA: no se toca ningun fichero del paquete.
    const propuesta = {
      nota:
        'Propuesta de cabeceras canonicas. NO se ha modificado ningun fichero. ' +
        'Para aplicarla: node scripts/check-attribution.mjs --fix --apply',
      cambios,
    };
    const destino = join(ROOT, 'provenance.proposed.json');
    writeFileSync(destino, JSON.stringify(propuesta, null, 2) + '\n', 'utf8');
    console.error(
      `--fix: ${cambios.length} cabecera(s) propuesta(s) en ${relative(ROOT, destino)}. ` +
        'NO se ha modificado el repositorio (para aplicar: --fix --apply).',
    );
  } else {
    for (const c of cambios) {
      const abs = join(ROOT, c.path);
      const lines = readFileSync(abs, 'utf8').split('\n');
      if (c.action === 'replace') lines[c.index] = c.line;
      else lines.splice(c.index, 0, c.line);
      writeFileSync(abs, lines.join('\n'), 'utf8');
      fixed++;
    }
    console.error(`--fix --apply: ${fixed} cabecera(s) canonica(s) escrita(s).`);
  }
}

/* ── informe ──────────────────────────────────────────────────────────────── */

const result = {
  ok: problems.length === 0,
  root: ROOT,
  requiredFiles: REQUIRED.length,
  manifest: manifest ? { derived: derivedList.length, native: nativeList.length, upstreams: Object.keys(manifest.upstreams ?? {}).length } : null,
  derived: derivedList.map((d) => d.path),
  native: nativeList.map((n) => n.path),
  licenseFamilies: licenseFamilies.length,
  licenseFiles,
  sourceRoutes: srcRoutes.size,
  corpusFiles,
  corpusMismatch,
  vendoredChecked,
  fixed,
  notes,
  problems,
};

if (asJson) {
  console.info(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

console.info(
  `atribucion: ${result.requiredFiles} ficheros legales, ` +
    `${result.manifest ? `${result.manifest.derived} derivados + ${result.manifest.native} nativos` : 'SIN MANIFIESTO'}, ` +
    `${result.licenseFamilies} familias en LICENSE.md -> ${licenseFiles} ficheros, ` +
    `${result.sourceRoutes} rutas en cabeceras, ${corpusFiles} ficheros de corpus`,
);
for (const n of notes) console.info(`  nota: ${n}`);
if (result.ok) {
  console.info('  CADENA MIT RESOLUBLE: toda ruta citada existe en el repositorio.');
  console.info('  CLASIFICACION CONFORME: cada derivado lleva su cabecera canonica y ningun nativo la lleva.');
  process.exit(0);
}
console.error(`  ${problems.length} PROBLEMA(S):`);
for (const p of problems) console.error(`    ${p}`);
process.exit(1);
