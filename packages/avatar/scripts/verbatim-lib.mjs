// scripts/verbatim-lib.mjs — la medicion del residuo verbatim, compartida por
// la puerta (`check-no-verbatim.mjs`), el declarador (`measure-verbatim.mjs`)
// y la lupa (`inspect-verbatim.mjs`).
//
// EL METRICO, Y POR QUE NO ES "UN PORCENTAJE DE SHINGLES":
//
// Un shingle es una ventana de 48 caracteres del texto normalizado (sin
// comentarios, espacios colapsados). Contar cuantos shingles de un fichero
// coinciden con los del upstream suena exacto, pero **produce falsos
// positivos**: los idiomas universales ("const SVG_NS = 'http://www.w3.org/2000/svg'",
// "for (let i = this.x.length - 1; i >= 0; i--)") son identicos en cualquier
// parte y no son codigo copiado.
//
// Por eso se cuentan solo los shingles que forman parte de una **RACHA
// CONTIGUA** de coincidencias de al menos `MIN_RUN` shingles (4 -> 192
// caracteres identicos seguidos). Un idioma universal son 1-2 shingles
// sueltos: no cuenta. Una copia de verdad son decenas seguidos: cuenta.
//
// El resultado es un **numero de shingles** (un entero), no un porcentaje: el
// presupuesto se expresa en shingles porque "1 shingle de 48 caracteres" es
// una coincidencia real y "1 %" seria una fraccion arbitraria.

/** Longitud del shingle (48 caracteres): el metodo de la Ola 8. */
export const N = 48;

/**
 * Minimo de shingles contiguos para que una coincidencia cuente.
 *
 * Calibrado (2026-10-21, Ola 10) sobre el paquete real: con 4 (51 caracteres)
 * los idiomas universales ("this._raf = requestAnimationFrame(this._loop)") ya
 * contaban y los falsos positivos eran 409 shingles en un fichero nativo. Con
 * 60 (107 caracteres identicos seguidos) los nativos quedan limpios y los
 * ports literales (un path SVG de 2411 caracteres, una tabla de timings) siguen
 * detectandose.
 */
export const MIN_RUN = 60;

/** Normaliza: quita comentarios y colapsa espacios (el codigo, no la prosa). */
export function stripComments(text) {
  let out = '';
  let inBlock = false;
  let inStr = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (inBlock) {
      if (c === '*' && n === '/') { inBlock = false; i++; out += ' '; continue; }
      continue;
    }
    if (inStr) {
      out += c;
      if (c === '\\') { out += n ?? ''; i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; out += c; continue; }
    if (c === '/' && n === '*') { inBlock = true; i++; out += ' '; continue; }
    if (c === '/' && n === '/') {
      const prev = out[out.length - 1];
      if (prev !== ':') { while (i < text.length && text[i] !== '\n') i++; out += '\n'; continue; }
    }
    out += c;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Los shingles de un texto normalizado, en orden. */
export function shingleList(normalized) {
  const out = [];
  for (let i = 0; i + N <= normalized.length; i++) out.push(normalized.slice(i, i + N));
  return out;
}

/** El conjunto de shingles de un texto normalizado. */
export function shingleSet(normalized) {
  return new Set(shingleList(normalized));
}

/**
 * Los shingles de `mine` que coinciden con `ref` Y forman parte de una racha
 * contigua de al menos `minRun` coincidencias.
 * @returns {{count: number, runs: Array<{from: number, to: number, text: string}>}}
 */
export function matchingRuns(mine, ref, minRun = MIN_RUN) {
  const hits = mine.map((s) => ref.has(s));
  const runs = [];
  let i = 0;
  while (i < hits.length) {
    if (!hits[i]) { i++; continue; }
    let j = i;
    while (j < hits.length && hits[j]) j++;
    if (j - i >= minRun) {
      runs.push({ from: i, to: j, text: mine.slice(i, j).join('') });
    }
    i = j;
  }
  return { count: runs.reduce((acc, r) => acc + (r.to - r.from), 0), runs };
}

/**
 * El residuo verbatim de un texto normalizado contra un conjunto de
 * referencias: el MAXIMO por referencia (un shingle no cuenta dos veces).
 * @param {string} normalized
 * @param {Array<{label: string, set: Set<string>}>} references
 */
export function residueOf(normalized, references, minRun = MIN_RUN) {
  const mine = shingleList(normalized);
  let best = { count: 0, source: null, runs: [] };
  const allSources = new Set();
  for (const r of references) {
    const m = matchingRuns(mine, r.set, minRun);
    if (m.count > 0) allSources.add(r.label);
    if (m.count > best.count) best = { count: m.count, source: r.label, runs: m.runs };
  }
  if (best.count === 0 && allSources.size) best.source = [...allSources].join(', ');
  return best;
}
