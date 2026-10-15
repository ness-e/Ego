// floating-anim.ts — Fisica springs + geometria de la isla flotante (Task 5, COUC-18).
//
// Port de `repos-referencia/coucou/windows/src/core/anim.ts`
// (MIT, (c) Louis Raillart) via `repos-referencia/avatar/src/core/anim.js`.
// Solo mecanismo (muelle SwiftUI + curva de cierre + geometria); NADA visual
// de Mochi (LICENSE-ASSETS lo prohibe — ver T-isla-gates).
//
// Reglas de este modulo (contrato Task 5):
// - hidden  = strip invisible 240x6 (island.rs STRIP_W/H: wake strip).
// - compact = NOTCH_W x NOTCH_H = 184x32 (layout.ts).
// - expanded = PANEL 720x320 (SPEC.md: tamano fijo, isla pegada al borde sup).
// - hitl    = 720x400 (approval card necesita mas alto que el panel base).
// - Abrir/crecer  -> spring 0.5/0.72 (rebote SwiftUI).
// - Cerrar/encoger -> curva temporal 340 ms (.45,0,.2,1), sin rebote.
// - RAF se DETIENE en hidden (0% CPU idle). PROHIBIDO polling 60 Hz:
//   el driver solo avanza por eventos (setMode) + RAF encadenado;
//   el click-through se decide por mouseenter/leave + rect (ver Manager).

export type IslandMode = "hidden" | "compact" | "expanded" | "hitl";

export interface IslandSize {
  w: number;
  h: number;
}

// --- Geometria canonica (coucou layout.ts + island.rs + contrato Task 5) ---
export const NOTCH_W = 184;
export const NOTCH_H = 32;
export const PANEL_W = 720;
export const PANEL_H = 320;
/** Altura extra de la tarjeta HITL (approval/question) sobre el panel base. */
export const HITL_H = 400;
/** Strip invisible que despierta la isla cuando esta hidden (island.rs). */
export const STRIP_W = 240;
export const STRIP_H = 6;

// --- Fisica canonica (anim.ts: open spring + close ease 340 ms) ---
export const OPEN_SPRING_RESPONSE = 0.5;
export const OPEN_SPRING_DAMPING = 0.72;
export const CLOSE_MS = 340;

export function islandSize(mode: IslandMode): IslandSize {
  switch (mode) {
    case "hidden":
      return { w: STRIP_W, h: STRIP_H };
    case "compact":
      return { w: NOTCH_W, h: NOTCH_H };
    case "expanded":
      return { w: PANEL_W, h: PANEL_H };
    case "hitl":
      return { w: PANEL_W, h: HITL_H };
    default:
      throw new RangeError(`islandSize: modo desconocido ${(mode as string) ?? mode}`);
  }
}

/** La ventana solo captura el raton en HITL; el resto es click-through. */
export function shouldAcceptMouse(mode: IslandMode): boolean {
  return mode === "hitl";
}

export const Ease = {
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t: number) => {
    const c1 = 1.7;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  lin: (t: number) => t,
  easeIn: (t: number) => t * t * t,
};

export type EaseFn = (t: number) => number;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));
export const seg = (t: number, a: number, b: number): number => clamp((t - a) / (b - a), 0, 1);

/** cubic-bezier(x1,y1,x2,y2) — biseccion de 12 iteraciones (suficiente a 60 fps). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EaseFn {
  const cx = (t: number) => (1 - t) ** 2 * 3 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3;
  const cy = (t: number) => (1 - t) ** 2 * 3 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3;
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

/** Curva de cierre 340 ms (.45,0,.2,1) — sin rebote al encoger. */
export const closeCurve = cubicBezier(0.45, 0, 0.2, 1);

/**
 * Muelle estilo SwiftUI: omega = 2PI/response, zeta = dampingFraction.
 * Integrado con sub-stepping (max 1/240 s): un frame perdido no lo desestabiliza.
 */
export class Spring {
  value: number;
  target: number;
  velocity = 0;
  omega: number;
  zeta: number;

  constructor(value: number, response = OPEN_SPRING_RESPONSE, damping = OPEN_SPRING_DAMPING) {
    this.value = value;
    this.target = value;
    this.omega = (2 * Math.PI) / response;
    this.zeta = damping;
  }

  configure(response: number, damping: number): void {
    this.omega = (2 * Math.PI) / response;
    this.zeta = damping;
  }

  set(value: number): void {
    this.value = value;
    this.target = value;
    this.velocity = 0;
  }

  get settled(): boolean {
    return Math.abs(this.target - this.value) < 0.01 && Math.abs(this.velocity) < 0.05;
  }

  step(dt: number): void {
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

type TrackedMode = "spring" | "curve" | "idle";

/**
 * Valor con apertura asimetrica: spring con rebote al crecer,
 * curva temporal sin rebote (340 ms) al encoger. Patron UI de coucou.
 */
export class Tracked {
  private spring: Spring;
  private curveFrom = 0;
  private curveTarget = 0;
  private curveStart = 0;
  private curveDur = 0;
  private mode: TrackedMode = "idle";

  constructor(value: number) {
    this.spring = new Spring(value);
  }

  get value(): number {
    return this.spring.value;
  }

  get animating(): boolean {
    return this.mode !== "idle";
  }

  jump(v: number): void {
    this.spring.set(v);
    this.mode = "idle";
  }

  /** Abrir/crecer con muelle (open spring 0.5/0.72). */
  springTo(v: number, response = OPEN_SPRING_RESPONSE, damping = OPEN_SPRING_DAMPING): void {
    this.spring.configure(response, damping);
    this.spring.target = v;
    this.mode = "spring";
  }

  /** Cerrar/encoger con curva temporal (sin rebote). `durationMs` def. 340. */
  curveTowards(v: number, durationMs = CLOSE_MS, now: number = Date.now()): void {
    this.curveFrom = this.spring.value;
    this.curveTarget = v;
    this.curveStart = now;
    this.curveDur = durationMs;
    this.spring.target = v;
    this.spring.velocity = 0;
    this.mode = "curve";
  }

  /** Alias compatible con avatar core/anim.js (`duration` en segundos). */
  curveTo(v: number, duration = CLOSE_MS / 1000, now: number = Date.now()): void {
    this.curveTowards(v, duration * 1000, now);
  }

  step(dt: number, now: number = Date.now()): void {
    if (this.mode === "spring") {
      this.spring.step(dt);
      if (this.spring.settled) {
        this.spring.value = this.spring.target;
        this.spring.velocity = 0;
        this.mode = "idle";
      }
    } else if (this.mode === "curve") {
      const p = clamp((now - this.curveStart) / this.curveDur, 0, 1);
      this.spring.value = lerp(this.curveFrom, this.curveTarget, closeCurve(p));
      if (p >= 1) {
        this.spring.velocity = 0;
        this.mode = "idle";
      }
    }
  }
}

export type RafFn = (cb: (t: number) => void) => number;
export type CancelRafFn = (id: number) => void;
export type RectListener = (rect: IslandSize) => void;

export interface AnimatorHooks {
  requestRaf?: RafFn;
  cancelRaf?: CancelRafFn;
  onRect?: RectListener;
  /** dt fijo por frame; def. 1/60. */
  dt?: number;
}

/**
 * Driver event-driven de la geometria animada.
 *
 * - `setMode()` elige fisica segun direccion: crecer -> springTo (rebote),
 *   encoger -> curveTowards 340 ms (sin rebote). Igual que IslandContainer.
 * - El loop RAF vive SOLO mientras hay animacion; al asentarse en `hidden`
 *   se cancela (RAF stop -> 0% CPU idle). Sin setInterval ni polling 60 Hz:
 *   el avance lo dispara el evento + el RAF encadenado.
 * - `onRect` se emite solo cuando el rect redondeado cambia (el dueno —
 *   floating.tsx futuro — llama a win.setSize aqui, nunca polling).
 */
export class IslandAnimator {
  private w: Tracked;
  private h: Tracked;
  private mode: IslandMode;
  private rafId: number | null = null;
  private lastRect: IslandSize;
  private hooks: Required<Omit<AnimatorHooks, "onRect">> & Pick<AnimatorHooks, "onRect">;

  constructor(initial: IslandMode = "compact", hooks: AnimatorHooks = {}) {
    this.mode = initial;
    const s = islandSize(initial);
    this.w = new Tracked(s.w);
    this.h = new Tracked(s.h);
    this.lastRect = { ...s };
    this.hooks = {
      requestRaf:
        hooks.requestRaf ??
        ((cb) => requestAnimationFrame((t) => cb(t))),
      cancelRaf: hooks.cancelRaf ?? ((id) => cancelAnimationFrame(id)),
      onRect: hooks.onRect,
      dt: hooks.dt ?? 1 / 60,
    };
  }

  get currentMode(): IslandMode {
    return this.mode;
  }

  get running(): boolean {
    return this.rafId !== null;
  }

  get animating(): boolean {
    return this.w.animating || this.h.animating;
  }

  /** Rect actual redondeado a px enteros (listo para win.setSize). */
  currentRect(): IslandSize {
    return { w: Math.round(this.w.value), h: Math.round(this.h.value) };
  }

  setMode(next: IslandMode, now: number = Date.now()): void {
    if (next === this.mode && !this.animating) return;
    const prev = islandSize(this.mode);
    const size = islandSize(next);
    this.mode = next;
    // Crecer (cualquiera de las dos dimensiones) -> spring; encoger -> curva.
    if (size.w > prev.w || size.h > prev.h) {
      this.w.springTo(size.w);
      this.h.springTo(size.h);
    } else {
      this.w.curveTowards(size.w, CLOSE_MS, now);
      this.h.curveTowards(size.h, CLOSE_MS, now);
    }
    this.kick(now);
  }

  /** Avance manual (tests / entorno sin RAF). Retorna true si sigue animando. */
  tick(now: number = Date.now()): boolean {
    this.w.step(this.hooks.dt, now);
    this.h.step(this.hooks.dt, now);
    this.emitIfChanged();
    return this.animating;
  }

  stop(): void {
    if (this.rafId !== null) {
      this.hooks.cancelRaf(this.rafId);
      this.rafId = null;
    }
  }

  private kick(now: number): void {
    if (this.rafId !== null) return;
    // Emite el primer rect de forma sincrona para respuesta inmediata al evento.
    this.tick(now);
    if (!this.animating) return;
    this.rafId = this.hooks.requestRaf((t) => this.frame(t));
  }

  private frame(now: number): void {
    this.rafId = null;
    const alive = this.tick(now);
    // RAF stop: sin animacion pendiente no se re-encadena (clave en hidden).
    if (alive) {
      this.rafId = this.hooks.requestRaf((t) => this.frame(t));
    }
  }

  private emitIfChanged(): void {
    const r = this.currentRect();
    if (r.w !== this.lastRect.w || r.h !== this.lastRect.h) {
      this.lastRect = r;
      this.hooks.onRect?.(r);
    }
  }
}
