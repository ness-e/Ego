// ticker.ts — Ticker de steps para el overview del flotante (Task 6).
//
// Port del MECANISMO de `repos-referencia/coucou/windows/src/views/ticker.ts`
// (MIT, (c) Louis Raillart): tres filas (completed/current/incoming), posiciones
// recomputadas desde un unico reloj en `tick()` — SIN CSS transitions ni timers.
// Los steps que llegan en rafaga se ENCOLAN (no se dropean); overflow > MAX_QUEUE
// descarta los mas viejos. Solo mecanismo: DOM propio con clases `ego-*`,
// marcadores de texto (›/✓), sin iconos ni estilos coucou.
//
// Comparte fisica con `floating-anim.ts` (Task5): la curva es la misma familia
// cubic(.4,0,.2,1) que el closeCurve de la isla.

import { cubicBezier, clamp, lerp } from "./floating-anim.js";

/** Altura de fila del ticker, px (coucou ticker.ts:15). */
export const TICKER_ROW_H = 22;
/** Duracion de una transicion de step, ms (coucou ticker.ts:17). */
export const TICKER_DURATION_MS = 380;
/** Cola maxima: mas alla se dejan de mostrar todos (coucou ticker.ts:19). */
export const TICKER_MAX_QUEUE = 4;
/** Escala del texto completed vs current (coucou ticker.ts:20). */
export const TICKER_COMPLETED_SCALE = 11.5 / 13;
/** Ease de cada transicion (coucou ticker.ts:21). */
export const tickerEase = cubicBezier(0.4, 0, 0.2, 1);

export interface TickerStepsInput {
  steps: string[];
  stepIndex: number;
}

interface TickerRow {
  el: HTMLElement;
  currentMark: HTMLElement;
  doneMark: HTMLElement;
  currentText: HTMLElement;
  doneText: HTMLElement;
  text: string;
}

function makeRow(): TickerRow {
  const currentMark = document.createElement("span");
  currentMark.className = "ego-tick-mark";
  currentMark.textContent = "›";
  currentMark.style.position = "absolute";
  const doneMark = document.createElement("span");
  doneMark.className = "ego-tick-done";
  doneMark.textContent = "✓";
  doneMark.style.position = "absolute";
  const currentText = document.createElement("span");
  currentText.className = "ego-tick-current";
  const doneText = document.createElement("span");
  doneText.className = "ego-tick-done-text";
  doneText.style.position = "absolute";
  const icon = document.createElement("span");
  icon.className = "ego-tick-icon";
  icon.style.position = "relative";
  icon.append(currentMark, doneMark);
  const body = document.createElement("span");
  body.style.position = "relative";
  body.append(currentText, doneText);
  const el = document.createElement("div");
  el.className = "ego-ticker-row";
  // JS-driven: jamas CSS transitions (el rAF de tick() owns cada frame).
  el.append(icon, body);
  return { el, currentMark, doneMark, currentText, doneText, text: "" };
}

function setRowText(row: TickerRow, text: string): void {
  if (row.text === text) return;
  row.text = text;
  row.currentText.textContent = text;
  row.doneText.textContent = text;
}

/**
 * Coloca una fila. `phase` 0 = current (full size), 1 = completed
 * (atenuada, subida y reducida) — mismos crossfades que coucou place().
 */
export function placeTickerRow(row: TickerRow, y: number, phase: number, opacity: number): void {
  const scale = 1 - phase * (1 - TICKER_COMPLETED_SCALE);
  row.el.style.transform = `translate(${-phase * 10}px, ${y}px) scale(${scale})`;
  row.el.style.opacity = String(opacity);
  row.currentMark.style.opacity = String(clamp(1 - phase * 2, 0, 1));
  row.doneMark.style.opacity = String(clamp(phase * 2 - 1, 0, 1));
  row.currentText.style.opacity = String(clamp(1 - phase * 1.6, 0, 1));
  row.doneText.style.opacity = String(clamp(phase * 2 - 0.4, 0, 1));
}

export class StepTicker {
  readonly el: HTMLElement;
  private a = makeRow(); // completed
  private b = makeRow(); // current
  private c = makeRow(); // incoming
  private queue: string[] = [];
  private startMs: number | null = null;
  private displayIndex = -1;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "ego-ticker";
    this.el.append(this.a.el, this.b.el, this.c.el);
    this.rest();
  }

  /** Estado entre transiciones: completed arriba, current debajo. */
  private rest(): void {
    placeTickerRow(this.a, 0, 1, 1);
    placeTickerRow(this.b, TICKER_ROW_H, 0, 1);
    placeTickerRow(this.c, TICKER_ROW_H * 2, 0, 0);
  }

  get animating(): boolean {
    return this.startMs != null || this.queue.length > 0;
  }

  /** Longitud de la cola pendiente (gancho de test/observabilidad). */
  get queueLength(): number {
    return this.queue.length;
  }

  /** Indice ya presentado (gancho de test). */
  get shownIndex(): number {
    return this.displayIndex;
  }

  /** Texto de la fila current (gancho de test). */
  get currentText(): string {
    return this.b.text;
  }

  sync(input: TickerStepsInput | null): void {
    const steps = input && input.steps.length > 0 ? input.steps : ["…"];
    const idx = input ? Math.min(input.stepIndex, steps.length - 1) : -1;

    // Primer render: cae en su lugar, sin animacion.
    if (this.displayIndex < 0) {
      this.displayIndex = idx;
      setRowText(this.a, idx > 0 ? (steps[idx - 1] ?? "…") : "…");
      setRowText(this.b, steps[Math.max(idx, 0)] ?? "…");
      this.rest();
      return;
    }

    // La sesion reinicio (steps limpiados): re-seed en vez de scroll.
    if (idx < this.displayIndex) {
      this.queue = [];
      this.startMs = null;
      this.displayIndex = idx;
      setRowText(this.a, idx > 0 ? (steps[idx - 1] ?? "…") : "…");
      setRowText(this.b, steps[Math.max(idx, 0)] ?? "…");
      this.rest();
      return;
    }

    for (let i = this.displayIndex + 1; i <= idx; i++) {
      const step = steps[i];
      if (step !== undefined) this.queue.push(step);
    }
    this.displayIndex = idx;
    if (this.queue.length > TICKER_MAX_QUEUE) {
      this.queue = this.queue.slice(-TICKER_MAX_QUEUE);
    }
  }

  /** Llamado cada frame por el overview mientras esta visible. */
  tick(nowMs: number): void {
    if (this.startMs == null) {
      if (this.queue.length === 0) return;
      setRowText(this.c, this.queue[0] ?? "…");
      placeTickerRow(this.c, TICKER_ROW_H * 2, 0, 0);
      this.startMs = nowMs;
    }

    const p = clamp((nowMs - this.startMs) / TICKER_DURATION_MS, 0, 1);
    const e = tickerEase(p);

    placeTickerRow(this.a, lerp(0, -TICKER_ROW_H, e), 1, clamp(1 - p * 1.35, 0, 1));
    placeTickerRow(this.b, lerp(TICKER_ROW_H, 0, e), e, 1);
    placeTickerRow(this.c, lerp(TICKER_ROW_H * 2, TICKER_ROW_H, e), 0, e);

    if (p < 1) return;

    // Commit: current→completed, incoming→current. Los textos se mueven,
    // los elementos se quedan — sin reordenar, sin solape.
    setRowText(this.a, this.b.text);
    setRowText(this.b, this.c.text);
    this.queue.shift();
    this.startMs = null;
    this.rest();
  }
}
