// anim.js — easings + springs.
// ADAPTADO de vendor/coucou/anim.ts (MIT, © Louis Raillart) — ver LICENSE.md.
// El original está en TypeScript para SwiftUI-equivalent springs; aquí se porta a
// JS ESM puro. Mantén la numeración de sub-stepping (240 Hz): un frame perdido no
// debe desestabilizar el muelle.

export const Ease = {
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => {
    const c1 = 1.7;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  lin: (t) => t,
  easeIn: (t) => t * t * t,
  // extras (patrón agent-robot-avatar)
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

/** cubic-bezier(x1,y1,x2,y2) — bisección de 12 iteraciones (suficiente a 60 fps). */
export function cubicBezier(x1, y1, x2, y2) {
  const cx = (t) => (1 - t) ** 2 * 3 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3;
  const cy = (t) => (1 - t) ** 2 * 3 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3;
  return (x) => {
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 12; i++) {
      const v = cx(t);
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return cy(t);
  };
}

export const closeCurve = cubicBezier(0.45, 0, 0.2, 1);

/**
 * Muelle estilo SwiftUI: omega = 2π/response, zeta = dampingFraction.
 * Integrado con sub-stepping (máx 1/240 s) para estabilidad con frames irregulares.
 */
export class Spring {
  constructor(value = 0, response = 0.5, damping = 0.72) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
    this.omega = (2 * Math.PI) / response;
    this.zeta = damping;
  }

  configure(response, damping) {
    this.omega = (2 * Math.PI) / response;
    this.zeta = damping;
  }

  set(value) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
  }

  get settled() {
    return Math.abs(this.target - this.value) < 0.01 && Math.abs(this.velocity) < 0.05;
  }

  step(dt) {
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const acc =
        this.omega * this.omega * (this.target - this.value) -
        2 * this.zeta * this.omega * this.velocity;
      this.velocity += acc * h;
      this.value += this.velocity * h;
    }
  }
}

/**
 * Valor con apertura asimétrica: spring con rebote al crecer,
 * curva temporal sin rebote (340 ms) al encoger. Patrón UI de coucou.
 */
export class Tracked {
  constructor(value = 0) {
    this.spring = new Spring(value);
    this.curveFrom = 0;
    this.curveTarget = 0;
    this.curveStart = 0;
    this.curveDur = 0;
    this.mode = 'idle';
  }

  get value() {
    return this.spring.value;
  }

  get animating() {
    return this.mode !== 'idle';
  }

  jump(v) {
    this.spring.set(v);
    this.mode = 'idle';
  }

  /** Abrir/crecer con muelle. */
  springTo(v, response = 0.5, damping = 0.72) {
    this.spring.configure(response, damping);
    this.spring.target = v;
    this.mode = 'spring';
  }

  /** Cerrar/encoger con curva temporal (sin rebote). */
  curveTo(v, duration = 0.34) {
    this.curveFrom = this.spring.value;
    this.curveTarget = v;
    this.curveStart = performance.now();
    this.curveDur = duration * 1000;
    this.mode = 'curve';
  }

  update(now = performance.now()) {
    if (this.mode === 'spring') {
      this.spring.step(1 / 60);
      if (this.spring.settled) this.mode = 'idle';
    } else if (this.mode === 'curve') {
      const t = clamp((now - this.curveStart) / this.curveDur, 0, 1);
      const e = closeCurve(t);
      this.spring.value = lerp(this.curveFrom, this.curveTarget, e);
      if (t >= 1) this.mode = 'idle';
    }
    return this.spring.value;
  }
}
