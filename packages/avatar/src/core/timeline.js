// timeline.js — secuenciador de tracks por campo + fases desde tablas de tiempos.
// PORTES VERBATIM:
//  · runner anim()/update(): vendor/coucou/mochi/engine.ts:477-507 (tracks [to, dur, ease]
//    por prop con `locks` — un campo atrapado por un tween no lo pisan los
//    sistemas de movimiento).
//  · buildPhases(): agent-robot-avatar actions.js:32-42 (tabla de tiempos →
//    fases acumuladas por cursor).
//  · segment(): actions.js:46-50 (= morph.js `seg`, se reexporta).
import { seg as segment, smooth } from './morph.js';
import { Ease } from './anim.js';

export { segment };

/**
 * Crea un runner de tweens por campo.
 * @param {{now?: () => number}} [opts] reloj inyectable (tests: now manual)
 */
export function createTimeline({ now = () => performance.now() } = {}) {
  /** @type {Map<string, {prop: string, keys: Array<[number, number, (t:number)=>number]>, index: number, from: number, startMs: number, onComplete?: () => void}>} */
  const tweens = new Map();
  const locks = new Set();

  const api = {
    /**
     * Programa una secuencia de keys sobre un campo.
     * (vendor/coucou/mochi/engine.ts:477 — misma semántica: desde el valor ACTUAL del campo)
     * @param {string} prop
     * @param {Array<[number, number, (t:number)=>number]>} keys [valorObjetivo, duraciónMs, ease]
     * @param {() => void} [onComplete]
     * @param {number} [fromValue] valor inicial (si se conoce fuera del runner)
     */
    anim(prop, keys, onComplete, fromValue) {
      if (!Array.isArray(keys) || keys.length === 0) return api;
      const from = fromValue !== undefined ? fromValue : api.get(prop) ?? 0;
      tweens.set(prop, { prop, keys, index: 0, from, startMs: now(), onComplete });
      locks.add(prop);
      return api;
    },

    /** (vendor/coucou/mochi/engine.ts:490-507) Avanza todos los tweens y escribe valores. */
    update() {
      const nowMs = now();
      for (const tw of [...tweens.values()]) {
        const k = tw.keys[tw.index];
        if (!k) {
          tweens.delete(tw.prop);
          locks.delete(tw.prop);
          continue;
        }
        const dur = Number(k[1]) > 0 ? k[1] : 1;
        const ease = typeof k[2] === 'function' ? k[2] : (t) => t;
        const p = Math.min(1, Math.max(0, (nowMs - tw.startMs) / dur));
        api._values[tw.prop] = tw.from + (k[0] - tw.from) * ease(p);
        if (p >= 1) {
          tw.from = k[0];
          tw.index += 1;
          tw.startMs = nowMs;
          if (tw.index >= tw.keys.length) {
            tweens.delete(tw.prop);
            locks.delete(tw.prop);
            tw.onComplete?.();
          }
        }
      }
    },

    /** ¿El campo está atrapado por un tween? (coucou `locks`) */
    locked(prop) {
      return locks.has(prop);
    },

    /** ¿Hay algo en movimiento? (vendor/coucou/mochi/engine.ts:456) */
    get busy() {
      return tweens.size > 0;
    },

    get(prop) {
      return api._values[prop];
    },

    set(prop, value) {
      if (!locks.has(prop)) api._values[prop] = value;
      return api;
    },

    /** Cancela el tween de un campo (lo libera y limpia). */
    clear(prop) {
      tweens.delete(prop);
      locks.delete(prop);
    },

    /** Cancela todos los tweens (reset). */
    clearAll() {
      tweens.clear();
      locks.clear();
    },

    _values: {},
  };
  return api;
}

/**
 * (ARA actions.js:32-42, port literal) Convierte una tabla de tiempos
 * {W2: 400, W4: 600, …} en fases acumuladas: {w2Start, w2End, w4Start, …, duration}.
 * Como en el original, `keys` permite excluir claves que no forman parte del
 * fx (ARA excluye W1 de la secuencia de fases).
 * @param {Readonly<Record<string, number>>} timing
 * @param {ReadonlyArray<string>} [keys]
 * @returns {Readonly<Record<string, number>>} fases acumuladas
 *   `{w2Start, w2End, w4Start, …, duration}` (clave = clave en minúscula).
 */
export function buildPhases(timing, keys) {
  if (!timing || typeof timing !== 'object') return Object.freeze({ duration: 0 });
  if (!Array.isArray(keys)) keys = Object.keys(timing);
  let cursor = 0;
  const phases = {};
  for (const key of keys) {
    phases[`${key.toLowerCase()}Start`] = cursor;
    const step = Number(timing[key]);
    cursor += Number.isFinite(step) && step > 0 ? step : 0;
    phases[`${key.toLowerCase()}End`] = cursor;
  }
  phases.duration = cursor;
  return Object.freeze(phases);
}

/**
 * Interpola por tramos con smoothstep: progresión por segmentos de una
 * función pedaza (patrón de barrido de mirada de ARA).
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
