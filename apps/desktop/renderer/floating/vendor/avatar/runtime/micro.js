// micro.js — keyframes de micro-animación (squash, hop, insignia, saludos…).
// ADAPTADO de vendor/coucou/mochi/engine.ts (MIT, © Louis Raillart) — ver LICENSE.md.
// Tablas keyframe literales del original, aplicadas sobre nuestro timeline.
// Las keys de cabeza de ARA (error/nod/warning) también viven aquí: son el
// mismo tipo de dato (listas [objetivo, ms, ease] para createTimeline) y así
// hay UN solo registro de keyframes en todo el proyecto.
import { Ease, cubicBezier } from '../core/anim.js';

/** Cada micro es un mapa campo → lista de keys [valorObjetivo, duraciónMs, ease]. */
export const MICRO = Object.freeze({
  squash: {
    fields: {
      sy: [[0.78, 70, Ease.out], [1.1, 130, Ease.out], [1, 170, Ease.inOut]],
      sx: [[1.16, 70, Ease.out], [0.95, 130, Ease.out], [1, 170, Ease.inOut]],
    },
  },
  gulp: {
    fields: {
      sy: [[0.78, 80, Ease.out], [1.18, 130, Ease.out], [1, 220, Ease.back]],
      sx: [[1.28, 80, Ease.out], [0.92, 130, Ease.out], [1, 220, Ease.back]],
    },
  },
  errorShake: {
    fields: {
      ox: [[0.08, 50, Ease.out], [-0.08, 70, Ease.inOut], [0.05, 70, Ease.inOut], [0, 90, Ease.out]],
    },
  },
  approvalHop: {
    fields: {
      oy: [[-0.2, 150, Ease.out], [0, 300, Ease.back]],
    },
  },
  badgePop: {
    fields: {
      badgeS: [[1, 280, Ease.back]],
    },
  },
  loveLift: {
    fields: {
      oy: [[-0.1, 160, Ease.out], [0, 300, Ease.back]],
    },
  },
  surpriseLift: {
    fields: {
      oy: [[-0.3, 140, Ease.out], [0, 380, Ease.back]],
      es: [[1.25, 120, Ease.out], [1, 500, Ease.inOut]],
    },
  },
  proudTilt: {
    fields: {
      tilt: [[-0.14, 220, Ease.out], [-0.14, 1700, Ease.lin], [0, 280, Ease.inOut]],
    },
  },
  winkTilt: {
    fields: {
      tilt: [[0.12, 160, Ease.out], [0.12, 300, Ease.lin], [0, 240, Ease.inOut]],
    },
  },
  winkTiltShort: {
    fields: {
      tilt: [[0.13, 100, Ease.out], [0.13, 320, Ease.lin], [0, 200, Ease.inOut]],
    },
  },
  yawn: {
    fields: {
      sy: [[1.12, 500, Ease.inOut], [1, 500, Ease.inOut]],
      sx: [[0.94, 500, Ease.inOut], [1, 500, Ease.inOut]],
    },
  },
  happyBlush: {
    // Antes escribía el campo 'blush' (mejillas de coucou, eliminadas con el
    // rig ARA): ahora es un leve oleaje del ojo — lo usa el emote `sad`.
    fields: {
      es: [[1.06, 200, Ease.out], [1, 600, Ease.inOut]],
    },
  },
  greet: {
    fields: {
      oy: [[-0.06, 220, Ease.out], [0, 220, Ease.back]],
      sy: [[0.95, 100, Ease.out], [1, 260, Ease.back]],
      sx: [[1.04, 100, Ease.out], [1, 260, Ease.back]],
    },
  },
  greetHands: {
    fields: {
      hands: [[1, 280, Ease.out], [1, 1050, Ease.lin], [0, 200, Ease.inOut]],
    },
  },
  happyBounce: {
    fields: {
      oy: [[-0.3, 120, Ease.out], [0.03, 200, Ease.inOut], [0, 160, Ease.back]],
      sy: [[0.82, 80, Ease.out], [1.18, 130, Ease.out], [0.88, 160, Ease.inOut], [1, 200, Ease.back]],
      sx: [[1.15, 80, Ease.out], [0.88, 130, Ease.out], [1.06, 160, Ease.inOut], [1, 200, Ease.back]],
    },
  },
  happyPop: {
    fields: {
      oy: [[-0.3, 120, Ease.out], [0.03, 200, Ease.inOut], [0, 160, Ease.back]],
      sy: [[0.82, 80, Ease.out], [1.18, 130, Ease.out], [0.88, 160, Ease.inOut], [1, 200, Ease.back]],
      sx: [[1.15, 80, Ease.out], [0.88, 130, Ease.out], [1.06, 160, Ease.inOut], [1, 200, Ease.back]],
    },
  },
  annoyedHead: {
    fields: {
      yaw: [[-0.65, 50, Ease.out], [0.65, 90, Ease.inOut], [-0.5, 80, Ease.inOut], [0.4, 75, Ease.inOut], [-0.2, 70, Ease.inOut], [0, 140, Ease.out]],
    },
  },
  loveRock: {
    fields: {
      tilt: [[-0.1, 180, Ease.out], [0.1, 340, Ease.inOut], [0, 220, Ease.inOut]],
    },
  },
  hop: {
    fields: {
      oy: [[-0.28, 110, Ease.out], [0, 190, Ease.back]],
      sy: [[0.9, 90, Ease.out], [1.08, 120, Ease.out], [1, 150, Ease.inOut]],
      sx: [[1.06, 90, Ease.out], [0.96, 120, Ease.out], [1, 150, Ease.inOut]],
    },
  },
  roll: {
    fields: {
      roll: [[360, 950, Ease.inOut]],
    },
  },
  rollDouble: {
    fields: {
      roll: [[720, 1300, Ease.inOut]],
    },
  },
});

export const MICRO_NAMES = Object.freeze(Object.keys(MICRO));

/**
 * Duración total (ms) de un micro = la suma de keys más larga entre sus campos.
 * @param {string} name
 */
export function microDuration(name) {
  const m = MICRO[name];
  if (!m) return 0;
  let max = 0;
  for (const keys of Object.values(m.fields)) {
    const total = keys.reduce((acc, k) => acc + k[1], 0);
    if (total > max) max = total;
  }
  return max;
}

/**
 * Aplica un micro a un timeline (createTimeline). Los campos atrapados por otro
 * tween (`locked`) se respetan — semántica `locks` de vendor/coucou/mochi/engine.ts:477-482.
 * @param {{anim:Function, locked:Function}} timeline
 * @param {string} name
 * @param {(name:string)=>void} [onComplete] se invoca UNA vez al terminar el micro
 * @returns {boolean} false si el micro no existe
 */
export function startMicro(timeline, name, onComplete) {
  const m = MICRO[name];
  if (!m) return false;
  if (!timeline || typeof timeline.anim !== 'function' || typeof timeline.locked !== 'function') return false;
  const entries = Object.entries(m.fields).filter(([field]) => !timeline.locked(field));
  if (entries.length === 0) {
    if (onComplete) onComplete(name);
    return true;
  }
  let remaining = entries.length;
  for (const [field, keys] of entries) {
    const last = remaining === 1;
    remaining -= 1;
    timeline.anim(field, keys, last && onComplete ? () => onComplete(name) : undefined);
  }
  return true;
}

/** Retardo del "pop" de insignia: encoge 90 ms y luego crece con back (coucou setBadge). */
export const BADGE_POP_SHRINK_MS = 90;
export const BADGE_POP_GROW_MS = 280;
export const BADGE_POP_GAP_MS = 100;

export function badgePopSequence() {
  return {
    shrink: [[0, BADGE_POP_SHRINK_MS, Ease.inOut]],
    grow: [[1, BADGE_POP_GROW_MS, Ease.back]],
  };
}

/**
 * Blink de coucou: cierra a 0.06 en 70 ms y abre a 1 en 130 ms (engine.ts:276-279).
 */
export const BLINK_KEYS = Object.freeze([[0.06, 70, Ease.inOut], [1, 130, Ease.out]]);
export const BLINK_DURATION = 200;

/* ── keys de cabeza de ARA (mismo tipo de dato: [objetivo, ms, ease]) ────────
 * Movidas desde runtime/action-fx.js (eliminado en la reunificación): son
 * keyframes para createTimeline, no matemática ocular, así que pertenecen
 * a este registro. */
const cbA = cubicBezier(0.38, 0, 0.28, 1);
const cbB = cubicBezier(0.35, 0, 0.22, 1);

/** Shake de error: translateX 0 → −4 (0,34 s) → +4 (0,72 s) → 0, 1380 ms (208-213). */
export function errorHeadKeys(duration = 1380) {
  const d = Number.isFinite(duration) && duration > 0 ? duration : 1380;
  return [
    [-4, 0.34 * d, cbA],
    [4, 0.38 * d, cbB],
    [0, 0.28 * d, cbB],
  ];
}

/** Nodo de asentimiento ("send"): translateY 0 → 5 (0,52 s) → 0, 920 ms (160-164). */
export function nodKeys(duration = 920) {
  const d = Number.isFinite(duration) && duration > 0 ? duration : 920;
  return [
    [5, 0.52 * d, Ease.lin],
    [0, 0.48 * d, Ease.lin],
  ];
}

/** Keys de cabeza del warning derivadas de las fases (243-251). */
export function warningHeadKeys(p) {
  if (!p || typeof p !== 'object') return [[0, 100, Ease.lin]];
  return [
    [0, p.w5Start, Ease.lin],
    [5, p.w5End - p.w5Start, cbA],
    [5, p.w5pEnd - p.w5End, Ease.lin],
    [-4, p.w6End - p.w5pEnd, cbB],
    [-4, p.w6pEnd - p.w6End, Ease.lin],
    [0, p.w7End - p.w6pEnd, cbB],
    [0, p.duration - p.w7End, Ease.lin],
  ];
}
