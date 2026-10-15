// countdown.tsx — Barra de auto-colapso del flotante (Task 6).
//
// Port del MECANISMO de `repos-referencia/coucou/windows/src/island/island.ts:821-831`
// (`updateCountdown`, MIT, (c) Louis Raillart): la barra solo aparece dentro de
// una ventana final `windowS = min(10, autoClose*0.6)` y encoge a 160px→0 con
// el tiempo restante. Solo mecanismo: sin estilos coucou, clases `ego-*`.
//
// El auto-close default (15s) coincide con `core/state.ts:100`
// (`autoCloseInterval: 15`) y con el `homeToCompact` de Task1.

import { createElement, useEffect, useRef, type ReactElement } from "react";
import { clamp } from "./floating-anim.js";

/** Segundos de auto-close por defecto (coucou state.ts:100). */
export const COUNTDOWN_AUTOCLOSE_S = 15;
/** Ancho máximo de la barra, px (coucou island.ts:830). */
export const COUNTDOWN_BAR_PX = 160;
/** Techo de la ventana visible, s (coucou island.ts:827). */
export const COUNTDOWN_MAX_WINDOW_S = 10;

/** Ventana final donde la barra es visible: min(10, autoClose*0.6). */
export function countdownWindowS(autoCloseS: number): number {
  return Math.min(COUNTDOWN_MAX_WINDOW_S, autoCloseS * 0.6);
}

/** Ancho px para el tiempo restante; 0 fuera de la ventana o expirado. */
export function countdownWidthPx(remainingS: number, autoCloseS: number): number {
  const windowS = countdownWindowS(autoCloseS);
  if (!Number.isFinite(remainingS) || remainingS < 0 || remainingS >= windowS) return 0;
  return Math.max(0, clamp(remainingS / windowS, 0, 1) * COUNTDOWN_BAR_PX);
}

export interface CountdownOptions {
  autoCloseS?: number;
  /** Pinneado: nunca colapsa → barra oculta (coucou island.ts:822). */
  pinned?: boolean;
}

/** Controlador DOM: el dueño (Task7/floating.tsx) le da tick por frame. */
export class CountdownController {
  readonly el: HTMLElement;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "ego-countdown";
    this.el.style.width = "0px";
    this.el.setAttribute("aria-hidden", "true");
  }

  update(nowMs: number, collapseAtMs: number | null, opts: CountdownOptions = {}): void {
    if (collapseAtMs == null || opts.pinned) {
      this.el.style.width = "0px";
      return;
    }
    const remainingS = (collapseAtMs - nowMs) / 1000;
    this.el.style.width = `${countdownWidthPx(remainingS, opts.autoCloseS ?? COUNTDOWN_AUTOCLOSE_S)}px`;
  }
}

export interface CountdownBarProps extends CountdownOptions {
  collapseAtMs: number | null;
}

/** Barra React con su propio rAF (se detiene al desmontar). */
export function CountdownBar(props: CountdownBarProps): ReactElement {
  const slotRef = useRef<HTMLDivElement | null>(null);
  const collapseAt = props.collapseAtMs;
  const autoCloseS = props.autoCloseS;
  const pinned = props.pinned;

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const ctrl = new CountdownController();
    slot.appendChild(ctrl.el);
    let raf = 0;
    const frame = (t: number): void => {
      ctrl.update(t, collapseAt, { autoCloseS, pinned });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ctrl.el.remove();
    };
  }, [collapseAt, autoCloseS, pinned]);

  return createElement("div", { className: "ego-countdown-slot", ref: slotRef });
}
