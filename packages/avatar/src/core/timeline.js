// timeline.js — secuenciador de tracks por campo + fases desde tablas de tiempos.
//
// IMPLEMENTACIÓN PROPIA DE EGO — patrón asimilado de `coucou` (MIT), sin
// traducción de código. La idea asimilada es "un campo se anima por tramos y,
// mientras dura la animación, queda RESERVADO: nadie lo pisa por fuera"; el
// runner, sus estados y la forma de avanzar el tiempo son de Ego.
//
// Tres piezas:
//   · `createTimeline()` — el runner: programa una secuencia de claves sobre un
//     campo y avanza los tramos con el reloj inyectable (los tests usan un
//     reloj manual).
//   · `buildPhases()` — convierte una tabla de tiempos {W2: 400, W4: 600, …} en
//     fases acumuladas {w2Start, w2End, w4Start, …, duration}.
//   · `piecewise()` — interpolación por tramos con suavizado.

import { seg as segment, smooth } from './morph.js';
import { Ease } from './anim.js';

export { segment };

/** Interpolación lineal (la que se usa si una clave no trae `ease`). */
const linear = (t) => t;

/**
 * Crea un runner de tweens por campo.
 * @param {{now?: () => number}} [opts] reloj inyectable (tests: now manual)
 */
export function createTimeline({ now = () => performance.now() } = {}) {
  /**
   * Un track por campo. `step` es el índice de la clave activa, `origin` el
   * valor del que parte el tramo actual y `began` el instante en que empezó.
   * @type {Map<string, {prop: string, keys: Array<[number, number, ((t:number)=>number)?]>, step: number, origin: number, began: number, done?: () => void}>}
   */
  const tracks = new Map();

  const api = {
    /**
     * Programa una secuencia de claves sobre un campo. Cada clave es
     * [valorObjetivo, duraciónMs, ease]. El tramo parte del valor ACTUAL del
     * campo (o de `fromValue` si se conoce por fuera) y, mientras dure, el
     * campo queda reservado: `set()` no lo puede pisar.
     * @param {string} prop
     * @param {Array<[number, number, ((t:number)=>number)?]>} keys
     * @param {() => void} [onComplete]
     * @param {number} [fromValue]
     */
    anim(prop, keys, onComplete, fromValue) {
      if (!Array.isArray(keys) || keys.length === 0) return api;
      const origin = fromValue !== undefined ? fromValue : api.get(prop) ?? 0;
      tracks.set(prop, { prop, keys, step: 0, origin, began: now(), done: onComplete });
      return api;
    },

    /** Avanza todos los tracks y escribe sus valores. */
    update() {
      const stamp = now();
      for (const tr of [...tracks.values()]) {
        const key = tr.keys[tr.step];
        if (!key) {
          tracks.delete(tr.prop);
          continue;
        }
        const [target, span, easing] = key;
        const ms = Number(span) > 0 ? span : 1;
        const fn = typeof easing === 'function' ? easing : linear;
        const progress = Math.min(1, Math.max(0, (stamp - tr.began) / ms));
        api._values[tr.prop] = tr.origin + (target - tr.origin) * fn(progress);
        if (progress < 1) continue;
        // el tramo termina: el siguiente empieza desde el valor alcanzado
        tr.origin = target;
        tr.step += 1;
        tr.began = stamp;
        if (tr.step < tr.keys.length) continue;
        tracks.delete(tr.prop);
        tr.done?.();
      }
    },

    /** ¿El campo está reservado por un track? */
    locked(prop) {
      return tracks.has(prop);
    },

    /** ¿Hay algo en movimiento? */
    get busy() {
      return tracks.size > 0;
    },

    get(prop) {
      return api._values[prop];
    },

    set(prop, value) {
      if (!tracks.has(prop)) api._values[prop] = value;
      return api;
    },

    /** Cancela el track de un campo (lo libera). */
    clear(prop) {
      tracks.delete(prop);
    },

    /** Cancela todos los tracks (reset). */
    clearAll() {
      tracks.clear();
    },

    _values: {},
  };
  return api;
}

/**
 * Convierte una tabla de tiempos en fases acumuladas: cada clave aporta su
 * `…Start` y su `…End`, y `duration` es la suma de todos los tramos.
 * `keys` permite excluir claves que no forman parte del fx.
 * @param {Readonly<Record<string, number>>} timing
 * @param {ReadonlyArray<string>} [keys]
 * @returns {Readonly<Record<string, number>>} fases acumuladas
 *   `{w2Start, w2End, w4Start, …, duration}` (clave = clave en minúscula).
 */
export function buildPhases(timing, keys) {
  if (!timing || typeof timing !== 'object') return Object.freeze({ duration: 0 });
  const order = Array.isArray(keys) ? keys : Object.keys(timing);
  const phases = {};
  let at = 0;
  for (const name of order) {
    const lower = String(name).toLowerCase();
    const span = Number(timing[name]);
    const ms = Number.isFinite(span) && span > 0 ? span : 0;
    phases[`${lower}Start`] = at;
    at += ms;
    phases[`${lower}End`] = at;
  }
  phases.duration = at;
  return Object.freeze(phases);
}

/**
 * Interpola por tramos con suavizado: progresión por segmentos de una función
 * pedaza.
 * @param {Array<[number, number, number, number]>} stops [[tDesde, tHasta, vDesde, vHasta], …]
 */
export function piecewise(t, stops) {
  if (!Array.isArray(stops) || stops.length === 0) return 0;
  for (const [a, b, from, to] of stops) {
    if (t < b) {
      if (t <= a) return from;
      return from + (to - from) * smooth((t - a) / (b - a));
    }
  }
  return stops[stops.length - 1][3];
}

export { Ease };
