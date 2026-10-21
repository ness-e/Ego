// ara-head.js — silueta base de la cabeza del avatar de Ego.
//
// IMPLEMENTACIÓN PROPIA DE EGO — patrón asimilado de `agent-robot-avatar`
// (MIT), sin traducción de código. La idea asimilada es "una cabeza es un
// contorno cerrado de puntos que se puede aplanar y mezclar"; los puntos, el
// perfil y la normalización son de Ego.
//
// LA FORMA: una cúpula de expoente propio (3.4 → cuadrado redondeado) con dos
// correcciones deliberadas:
//   · la CORONA se aplana (la frente es ancha, no una esfera);
//   · el MENTÓN se estrecha (la cara tiene mandibula, no es una bola).
// Después se NORMALIZA a la caja canónica 20…220, de modo que las medidas del
// rig (ojos, accesorios, marcas) sigan referidas a las mismas coordenadas.
//
// El nombre `ARA_HEAD_*` se conserva por compatibilidad de API pública (lo
// exportan `src/index.js` y lo consume `render/body.js`); la geometría que
// nombra ya no es la de ARA.
//
// Caja y centros canónicos de la silueta.
const BOX = Object.freeze({ min: 20, max: 220, cx: 120, cy: 120 });

/** Parámetros del perfil: propios de Ego. */
const PROFILE = Object.freeze({
  points: 160,     // resolución del contorno
  exponent: 3.4,   // superelipse: 2 = elipse, 4+ = cuadrado redondeado
  crown: 0.14,     // cuánto se aplana la frente
  chin: 0.18,      // cuánto se estrecha la mandibula
  cheek: 0.06,     // realce de los pomulos (ensancha la mejilla)
});

/**
 * Punto de la superelipse: |x/a|^n + |y/b|^n = 1, muestreada por ángulo.
 * @returns {[number, number]}
 */
function domePoint(angle) {
  const k = 2 / PROFILE.exponent;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const rx = (BOX.max - BOX.min) / 2;
  const ry = rx;
  return [
    BOX.cx + rx * Math.sign(c) * Math.abs(c) ** k,
    BOX.cy + ry * Math.sign(s) * Math.abs(s) ** k,
  ];
}

/**
 * Perfil vertical: corona plana, mejillas marcadas y mentón estrecho.
 * Trabaja sobre la coordenada normalizada `ny` (-1 arriba, +1 abajo).
 */
/** @param {[number, number]} p @returns {[number, number]} */
function applyProfile([x, y]) {
  const rx = (BOX.max - BOX.min) / 2;
  const ny = (y - BOX.cy) / rx;              // -1 arriba, +1 abajo
  const up = Math.max(0, -ny);
  const down = Math.max(0, ny);
  const mid = 1 - Math.abs(ny);
  // mandibula: se estrecha al bajar
  const width = 1 - PROFILE.chin * down ** 1.6;
  // pómulos: un ensanche suave en la zona media
  const cheek = 1 + PROFILE.cheek * mid ** 2;
  // frente: se aplana (menos alto arriba)
  const flat = 1 - PROFILE.crown * up ** 2;
  return [BOX.cx + (x - BOX.cx) * width * cheek, BOX.cy + (y - BOX.cy) * flat];
}

/**
 * Escala el contorno para que ocupe exactamente la caja canónica.
 * @param {Array<[number, number]>} points
 * @returns {Array<[number, number]>}
 */
function normalize(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = BOX.max - BOX.min;
  const sx = span / (maxX - minX);
  const sy = span / (maxY - minY);
  return points.map(([x, y]) => [BOX.min + (x - minX) * sx, BOX.min + (y - minY) * sy]);
}

/** Genera el contorno de la cúpula de Ego. */
function buildHeadPoints() {
  /** @type {Array<[number, number]>} */
  const raw = [];
  const step = (Math.PI * 2) / PROFILE.points;
  // arranca arriba y avanza en sentido horario (igual que el resto del rig).
  for (let i = 0; i < PROFILE.points; i++) {
    raw.push(applyProfile(domePoint(-Math.PI / 2 + i * step)));
  }
  return normalize(raw);
}

/** Path base de la cabeza (silueta propia de Ego). */
export const ARA_HEAD_D = Object.freeze(
  (() => {
    const pts = buildHeadPoints();
    const body = pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ');
    return `M ${body} Z`;
  })(),
);

/** Caja y centros canónicos de la plantilla. */
export const ARA_HEAD = Object.freeze({ ...BOX });
