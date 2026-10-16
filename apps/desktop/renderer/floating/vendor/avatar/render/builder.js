// builder.js — helper mínimo para construir SVG como string (sin DOM).
// Permite testear el render con node --test y exportar con toSVGString().

/** Escapa valor de atributo SVG. */
export function esc(v) {
  return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Crea un elemento SVG.
 * @param {string} tag  ej. "path"
 * @param {object} attrs  atributos (null/undefined se omiten)
 * @param {string|Array<string>} [children]
 */
export function el(tag, attrs = {}, children = '') {
  const parts = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    parts.push(`${k}="${esc(v)}"`);
  }
  const open = parts.length ? `<${tag} ${parts.join(' ')}>` : `<${tag}>`;
  const inner = Array.isArray(children) ? children.join('') : children;
  if (!inner) return `${open}</${tag}>`;
  return `${open}${inner}</${tag}>`;
}

/** <g> con atributos; children en array. */
export function group(attrs, children = []) {
  return el('g', attrs, children);
}

/** Agrupa nodos con transform/clase. */
export function g(cls, children = [], attrs = {}) {
  return group({ class: cls, ...attrs }, children);
}
