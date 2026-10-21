// upload-canvas.ts — Canvas del drop del flotante + URL segura + cola de ingest (Task 9, D4).
//
// Port del MECANISMO de `repos-referencia/coucou/windows/src/upload/canvas.ts`
// (MIT, (c) Louis Raillart; a su vez port de UploadCanvasView.swift). Mientras el
// engine está activo este canvas dibuja todo el cuerpo de la isla: tarjeta,
// marco punteado de drop, texto, barra de progreso, tarjeta choose, criatura y
// el archivo succionado. Sin CSS transitions: el rAF del flotante ownea cada frame.
//
// Desviaciones documentadas del original:
// - Criatura NEUTRA en vez de Mochi (D1 owner + LICENSE-ASSETS): superelipse con
//   morph + ojos pill/cup/content + boca. Solo mecanismo geométrico, cero marca.
// - `isSafeWebUrl`: port de `NotchBuddy/Sources/App/SafeWebURL.swift` (solo
//   http/https + host; bloquea file:/smb:/custom del output del modelo). El gate
//   final en main (`openExternalValidated`, https-only) NO se toca.
// - `DropQueue`: drop en flotante → `knowledge.ingest` en background + ticks para
//   el `StepTicker` (Task6). Cola secuencial; fuera de zona se ignora sin error.
// - `ContextProvider`: interfaz + no-op (attach-window-context opcional, §34).

import { USC, eIn, eInOut, eOut, lerp, progressAt } from "./upload-seq.js";
import type { UploadEyeShape, UploadFrame } from "./upload-seq.js";

/**
 * Paleta de la escena de drop.
 *
 * El canvas 2D no resuelve `var(--token)`: por eso se lee el valor
 * computado del custom property en `:root` (que `floating.css` declara con
 * los MISMOS tokens que `src/index.css`) y se cachea. Así la escena se
 * pinta con la paleta del design system —no con hex propios— y las
 * transparencias se aplican con `ctx.globalAlpha` (no con colores rgba
 * sueltos).
 */
type IslandToken =
  | "paper"
  | "panel"
  | "raised"
  | "ink"
  | "faint"
  | "dim"
  | "hairline"
  | "brand"
  | "success"
  | "error"
  | "indigo";

/** Token del sistema → custom property equivalente. */
const TOKEN_VAR: Record<IslandToken, string> = {
  paper: "--color-paper",
  panel: "--color-panel",
  raised: "--color-raised",
  ink: "--color-ink",
  faint: "--color-faint",
  dim: "--color-dim",
  hairline: "--color-hairline",
  brand: "--color-brand",
  success: "--color-success",
  error: "--color-error",
  indigo: "--color-chart-indigo",
};

/** Mismo valor por defecto que declara `floating.css` (preset `default-dark`). */
const TOKEN_FALLBACK: Record<IslandToken, string> = {
  paper: "oklch(0.13 0.004 285.8)",
  panel: "oklch(0.195 0.004 286)",
  raised: "oklch(0.26 0.008 285.8)",
  ink: "oklch(0.985 0 89.9)",
  faint: "oklch(0.712 0.013 286.1)",
  dim: "oklch(0.636 0.0118 286.1)",
  hairline: "oklch(0.274 0.005 286)",
  brand: "oklch(0.769 0.165 70.1)",
  success: "oklch(0.696 0.149 162.5)",
  error: "oklch(0.645 0.215 16.4)",
  indigo: "oklch(0.6801 0.1583 276.9)",
};

const tokenCache = new Map<IslandToken, string>();

/** Color del sistema para el canvas (cacheado: se lee una sola vez). */
function token(name: IslandToken): string {
  const cached = tokenCache.get(name);
  if (cached !== undefined) return cached;
  let value = "";
  try {
    if (typeof document !== "undefined" && typeof getComputedStyle === "function") {
      value = getComputedStyle(document.documentElement).getPropertyValue(TOKEN_VAR[name]).trim();
    }
  } catch {
    value = "";
  }
  const resolved = value.length > 0 ? value : TOKEN_FALLBACK[name];
  tokenCache.set(name, resolved);
  return resolved;
}

/** Pila tipográfica del sistema (la misma que declara `--ego-font`). */
const FONT = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/** Espejo del `rr()` de referencia: rounded rect con radio limitado a la caja. */
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rad);
}

/** Cuerpo superelíptico — port de usBodyPath(m, R) (canvas.ts:23-41). */
function creaturePath(ctx: CanvasRenderingContext2D, m: number, R: number): { rx: number; ry: number } {
  const mc = Math.max(0, Math.min(m, 1));
  const n = 2.15 + (5.5 - 2.15) * mc;
  const rx = R * (1.04 - 0.04 * mc);
  const ry = R * (0.97 - 0.03 * mc);
  ctx.beginPath();
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const px = rx * Math.sign(ca) * Math.pow(Math.abs(ca), 2 / n);
    const py = ry * Math.sign(sa) * Math.pow(Math.abs(sa), 2 / n);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  return { rx, ry };
}

function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: CanvasTextAlign = "left",
): void {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  // Los anchors .leading/.center/.trailing de SwiftUI centran verticalmente.
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y);
}

export interface UploadCanvasActions {
  /** Botón primario — entregar el archivo al chat. */
  ask(): void;
  /** Botón secundario. */
  cancel(): void;
}

export interface UploadCanvasFile {
  name: string;
}

export class UploadCanvas {
  /** Wrapper con el canvas y los dos botones invisibles de choose. */
  readonly el: HTMLElement;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private overlay: HTMLElement;
  private sizedFor = 0;
  private fileName: string | null = null;

  constructor(actions: UploadCanvasActions) {
    this.canvas = document.createElement("canvas");
    this.canvas.id = "upload-canvas";

    // Hit areas invisibles en las posiciones de referencia. Las etiquetas se
    // pintan en el canvas; estos solo capturan el click (canvas.ts:82-94).
    const mk = (x: number, w: number, onclick: () => void): HTMLButtonElement => {
      const b = document.createElement("button");
      b.className = "upload-hit";
      b.style.left = `${x}px`;
      b.style.top = "113px";
      b.style.width = `${w}px`;
      b.style.height = "26px";
      b.addEventListener("click", onclick);
      return b;
    };
    this.overlay = document.createElement("div");
    this.overlay.id = "upload-overlay";
    this.overlay.append(mk(114, 168, actions.ask), mk(290, 120, actions.cancel));

    this.el = document.createElement("div");
    this.el.id = "upload-layer";
    this.el.append(this.canvas, this.overlay);

    this.ctx = this.canvas.getContext("2d");
  }

  /** Nombre del archivo en vuelo (barra + choose); null lo oculta. */
  setFile(file: UploadCanvasFile | null): void {
    this.fileName = file ? file.name : null;
  }

  /** `wallTime` en segundos mueve los dashes, como el timeline de macOS. */
  draw(f: UploadFrame, wallTime: number): void {
    // Los botones solo existen cuando la tarjeta choose ya apareció.
    this.overlay.style.display = f.chooseAlpha > 0.5 ? "block" : "none";
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.sizedFor !== dpr) {
      this.sizedFor = dpr;
      this.canvas.width = Math.round(USC.W * dpr);
      this.canvas.height = Math.round(USC.ISL_H * dpr);
      this.canvas.style.width = `${USC.W}px`;
      this.canvas.style.height = `${USC.ISL_H}px`;
    }
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, USC.W, USC.ISL_H);

    this.drawScene(ctx, f, wallTime);
  }

  // ── Escena ────────────────────────────────────────────────────────────────

  private drawScene(ctx: CanvasRenderingContext2D, f: UploadFrame, wallTime: number): void {
    // Fondo de isla.
    ctx.fillStyle = token("paper");
    ctx.fillRect(0, 0, USC.W, USC.ISL_H);

    // Tarjeta.
    ctx.save();
    rr(ctx, USC.CARD_X, USC.CARD_Y, USC.CARD_W, USC.CARD_H, USC.CARD_R);
    ctx.clip();
    ctx.fillStyle = token("panel");
    ctx.fillRect(USC.CARD_X, USC.CARD_Y, USC.CARD_W, USC.CARD_H);

    // Resplandor verde desde el borde inferior de la tarjeta.
    if (f.greenWash > 0) {
      const gx = USC.CARD_X + USC.CARD_W / 2;
      const gy = USC.CARD_Y + USC.CARD_H;
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, USC.CARD_H * 1.5);
      g.addColorStop(0, token("success"));
      g.addColorStop(0.55, token("success"));
      g.addColorStop(1, "transparent");
      // La intensidad del wash la fija la opacidad global (el color del
      // sistema no lleva alfa propio).
      ctx.save();
      ctx.globalAlpha = f.greenWash * 0.9;
      ctx.fillStyle = g;
      ctx.fillRect(USC.CARD_X, USC.CARD_Y, USC.CARD_W, USC.CARD_H);
      ctx.restore();
    }
    ctx.restore();

    // Borde punteado, marchando ~20 pt/s.
    if (f.zoneAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = f.zoneAlpha * (f.zoneOver ? 0.55 : 0.14);
      ctx.strokeStyle = f.zoneOver ? token("success") : token("hairline");
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -wallTime * 20;
      rr(ctx, USC.CARD_X + 0.75, USC.CARD_Y + 0.75, USC.CARD_W - 1.5, USC.CARD_H - 1.5, USC.CARD_R - 0.5);
      ctx.stroke();
      ctx.restore();
    }

    if (f.zoneAlpha > 0 && f.textAlpha > 0) this.drawDropText(ctx, f);
    if (f.barAlpha > 0 || f.barReveal > 0) this.drawProgressBar(ctx, f);
    if (f.chooseAlpha > 0) this.drawChoose(ctx, f);

    this.drawCreature(ctx, f);
    if (f.fileVisible) this.drawFile(ctx, f);
  }

  // ── Texto de zona + chips ─────────────────────────────────────────────────

  private drawDropText(ctx: CanvasRenderingContext2D, f: UploadFrame): void {
    ctx.save();
    ctx.globalAlpha = f.textAlpha;
    text(ctx, "Drop your files here", USC.TEXT_X, USC.TEXT_Y - 4, `500 14px ${FONT}`, token("ink"));

    let cx = USC.TEXT_X;
    for (const chip of ["PDF", "Images", "Code", "Docs"]) {
      const w = chip.length * 6.5 + 16;
      // Chip = superficie elevada con un velo suave (no un blanco roto).
      ctx.save();
      ctx.globalAlpha = f.textAlpha * 0.35;
      ctx.fillStyle = token("raised");
      rr(ctx, cx, USC.TEXT_Y + 9, w, 18, 9);
      ctx.fill();
      ctx.restore();
      text(ctx, chip, cx + 8, USC.TEXT_Y + 18, `500 12px ${FONT}`, token("faint"));
      cx += w + 6;
    }
    ctx.restore();
  }

  // ── Barra de progreso ─────────────────────────────────────────────────────

  private drawProgressBar(ctx: CanvasRenderingContext2D, f: UploadFrame): void {
    ctx.save();
    ctx.globalAlpha = Math.max(f.barAlpha, 0.001);

    const x0 = USC.BAR_X0;
    const x1 = USC.BAR_X1;
    const by = USC.BAR_Y;
    const barLen = (x1 - x0) * f.barReveal;

    const name = this.fileName ?? "file";
    text(ctx, `Uploading ${name}`, x0, by - 30, `500 12px ${FONT}`, token("dim"));

    if (f.check > 0) {
      ctx.save();
      ctx.translate(x1 - 8, by - 30);
      ctx.scale(f.check, f.check);
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fillStyle = token("success");
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-3.6, 0.2);
      ctx.lineTo(-1, 2.8);
      ctx.lineTo(3.8, -2.6);
      ctx.strokeStyle = token("paper");
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.restore();
    } else {
      text(ctx, `${Math.round(f.progress * 100)} %`, x1, by - 30, `500 12px ${FONT}`, token("dim"), "right");
    }

    // Track.
    if (barLen > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = token("raised");
      rr(ctx, x0, by - 3, barLen, 6, 3);
      ctx.fill();
      ctx.restore();
    }

    // Fill.
    const fx = lerp(x0, x1, f.progress);
    if (fx > x0 + 1) {
      const g = ctx.createLinearGradient(x0, 0, fx, 0);
      g.addColorStop(0, token("success"));
      g.addColorStop(1, token("success"));
      ctx.fillStyle = g;
      rr(ctx, x0, by - 3, fx - x0, 6, 3);
      ctx.fill();
      // Destello: velo claro del sistema sobre la barra (mismo mecanismo,
      // color del sistema en vez de un verde suelto).
      if (f.flash > 0) {
        ctx.save();
        ctx.globalAlpha = f.flash * 0.5;
        ctx.fillStyle = token("ink");
        rr(ctx, x0, by - 3, fx - x0, 6, 3);
        ctx.fill();
        ctx.restore();
      }
    }

    // Estela, larga según la velocidad de la barra.
    if (f.progress > 0.01 && f.progress < 1) {
      const v =
        (progressAt(f.t + 0.01, USC.T_PROG_START, f.progEnd) -
          progressAt(f.t, USC.T_PROG_START, f.progEnd)) / 0.01;
      const tl = Math.max(8, Math.min(34, 8 + v * 40));
      const g = ctx.createLinearGradient(fx - tl, 0, fx, 0);
      g.addColorStop(0, "transparent");
      g.addColorStop(1, token("success"));
      ctx.save();
      ctx.filter = "blur(3px)";
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = g;
      rr(ctx, fx - tl, by - 4, tl, 8, 4);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // ── Tarjeta choose ────────────────────────────────────────────────────────

  private drawChoose(ctx: CanvasRenderingContext2D, f: UploadFrame): void {
    ctx.save();
    ctx.globalAlpha = f.chooseAlpha;
    ctx.translate(0, (1 - f.chooseAlpha) * 4);

    const name = this.fileName ?? "file";
    text(ctx, `${name} is ready.`, 114, 80, `600 14px ${FONT}`, token("ink"));
    text(ctx, "What do you want to do with it?", 114, 100, `400 12px ${FONT}`, token("dim"));

    // Botón primario = `bg-ink` / `text-paper` (variante `primary` del kit).
    ctx.fillStyle = token("ink");
    rr(ctx, 114, 113, 168, 26, 13);
    ctx.fill();
    text(ctx, "Ask a question about it", 198, 126, `500 12px ${FONT}`, token("paper"), "center");

    // Botón secundario = superficie elevada.
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = token("raised");
    rr(ctx, 290, 113, 120, 26, 13);
    ctx.fill();
    ctx.restore();
    text(ctx, "Cancel", 350, 126, `500 12px ${FONT}`, token("ink"), "center");
    ctx.restore();
  }

  // ── Criatura neutra (NO Mochi) ────────────────────────────────────────────
  //
  // Misma geometría del original (superelipse + morph + boca + ojos
  // pill/cup/content): solo mecanismo, paleta neutra gris, cero marca.

  private drawCreature(ctx: CanvasRenderingContext2D, f: UploadFrame): void {
    const R = f.d / 2 / 1.04;
    const mc = Math.max(0, Math.min(f.morph, 1));

    ctx.save();
    ctx.translate(f.x, f.y + f.hop);
    ctx.rotate(f.tilt);
    ctx.scale(f.sx, f.sy);

    const { rx, ry } = creaturePath(ctx, f.morph, R);

    // Cuerpo neutro: gris del sistema (ink → faint), sin color propio.
    const bg = ctx.createLinearGradient(rx * 0.7, -ry * 0.9, -rx * 0.8, ry * 0.9);
    bg.addColorStop(0, token("ink"));
    bg.addColorStop(1, token("faint"));
    ctx.fillStyle = bg;
    ctx.fill();

    // Sombra de borde.
    const sg = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 1.3);
    sg.addColorStop(0, "transparent");
    sg.addColorStop(0.62, "transparent");
    sg.addColorStop(1, token("paper"));
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.restore();

    // El path se reutiliza como clip de todo lo interior.
    ctx.save();
    creaturePath(ctx, f.morph, R);
    ctx.clip();

    // Borde superior, cuando la forma ya es caja.
    if (mc > 0.3) {
      const a = Math.max(0, Math.min(1, (mc - 0.3) / 0.7));
      ctx.save();
      ctx.globalAlpha = 0.6 * a;
      ctx.beginPath();
      ctx.moveTo(-rx * 0.72, -ry + 0.9);
      ctx.lineTo(rx * 0.72, -ry + 0.9);
      ctx.strokeStyle = token("ink");
      ctx.lineWidth = 1.2;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();
    }

    // Agujero de boca.
    const mh = f.mouth * R * mc;
    if (mh > 0.3) {
      const mw = 2 * rx - 0.24 * R;
      const mx = -mw / 2;
      const my = -ry + 0.1 * R;
      const g = ctx.createLinearGradient(0, my, 0, my + mh);
      g.addColorStop(0, token("paper"));
      g.addColorStop(1, token("panel"));
      ctx.fillStyle = g;
      rr(ctx, mx, my, mw, mh, Math.min(mw / 2, mh / 2));
      ctx.fill();
      if (mh > 4) {
        const r = Math.min(mw / 2, mh / 2);
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.moveTo(mx + r, my + mh + 0.5);
        ctx.lineTo(mx + mw - r, my + mh + 0.5);
        ctx.strokeStyle = token("ink");
        ctx.lineWidth = 1;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
      }
    }

    // Ojos.
    const ew = R * 0.25;
    const eh = R * (0.62 - 0.16 * mc);
    const ey = R * (0.02 + 0.28 * mc);
    const sp = R * 0.3;
    const lx = f.lookX * R * (0.34 - 0.08 * mc);
    const ly = f.lookY * R * (0.16 - 0.09 * mc);
    for (const sd of [-1, 1]) {
      ctx.save();
      ctx.translate(sd * sp + lx, ey + ly);
      drawEye(ctx, f.eye, ew, eh);
      ctx.restore();
    }

    ctx.restore(); // clip del cuerpo
    ctx.restore(); // transform
  }

  // ── El archivo y la succión ───────────────────────────────────────────────

  private drawFile(ctx: CanvasRenderingContext2D, f: UploadFrame): void {
    const cx = f.cursorX;
    const cy = f.cursorY + 14;

    if (f.suck <= 0) {
      ctx.save();
      ctx.globalAlpha = 0.92;
      drawDoc(ctx, cx, cy, 1, 1);
      ctx.restore();
      return;
    }

    const m = f.mouthRect;
    const W0 = 34;
    const H0 = 42;
    const p = eIn(f.suck);
    const topY = lerp(cy - H0 / 2, m.y - 2, eInOut(f.suck));
    const hs = lerp(1.08, 0.55, eInOut(f.suck));
    const Hh = H0 * hs;
    const sc = lerp(1, 0.55, p);
    const q = eOut(f.suck);
    const fCx = lerp(cx, m.x + m.w / 2, eOut(f.suck));
    const wob = Math.sin(f.suck * Math.PI * 2) * 0.1 * (1 - p);
    const clipY = m.y + m.h * 0.5;

    // La hoja se dibuja en 28 tiras horizontales, cada una angostada hacia la
    // boca: la página parece embudarse. Todo bajo la línea de boca se recorta —
    // eso es lo que la hace ver tragada (canvas.ts:405-429).
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, USC.W, clipY);
    ctx.clip();

    for (let i = 0; i < 28; i++) {
      const v0 = i / 28;
      const wsc = lerp(1, lerp(0.92, (0.22 * m.w) / W0, Math.pow(v0, 1.2)), q) * sc;
      const yy = topY + v0 * Hh;
      const hh = Hh / 28 + 0.6;

      ctx.save();
      ctx.translate(fCx, yy);
      ctx.rotate(wob);
      ctx.beginPath();
      ctx.rect((-W0 * wsc) / 2, 0, W0 * wsc, hh);
      ctx.clip();
      ctx.translate(-fCx, -yy);
      drawDoc(ctx, fCx, topY + Hh / 2, wsc, hs);
      ctx.restore();
    }
    ctx.restore();

    // Migas verdes arrastradas con el archivo.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.6;
      const k = Math.max(0, Math.min(1, (f.suck - i * 0.08) / 0.7));
      if (k <= 0 || k >= 1) continue;
      const sx0 = cx + Math.cos(a) * 24;
      const sy0 = cy + Math.sin(a) * 24;
      const ex = m.x + m.w / 2;
      const ey = m.y + m.h * 0.3;
      const kk = Math.pow(k, 0.7);
      const px = lerp(sx0, ex, kk);
      const py = lerp(sy0, ey, kk) - Math.sin(Math.PI * k) * 6;
      const rad = 2.2 * (1 - k * 0.5);
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.fillStyle = token("success");
      ctx.fill();
      ctx.restore();
    }
  }
}

// ── Formas de ojo (canvas.ts:456-487) ────────────────────────────────────────

function drawEye(ctx: CanvasRenderingContext2D, shape: UploadEyeShape, w: number, h: number): void {
  // La tinta del ojo es la superficie más oscura del sistema.
  const ink = token("paper");
  switch (shape) {
    case "pill":
      ctx.fillStyle = ink;
      rr(ctx, -w / 2, -h / 2, w, h, w / 2);
      ctx.fill();
      break;

    case "cup": {
      // Arriba plano, abajo semicircular.
      const hh = h * 0.55;
      ctx.beginPath();
      ctx.moveTo(-w / 2, -hh / 2);
      ctx.lineTo(w / 2, -hh / 2);
      ctx.lineTo(w / 2, hh / 2 - w / 2);
      ctx.arc(0, hh / 2 - w / 2, w / 2, 0, Math.PI, false);
      ctx.closePath();
      ctx.fillStyle = ink;
      ctx.fill();
      break;
    }

    case "content":
      ctx.beginPath();
      ctx.arc(0, -h * 0.12, w * 0.85, Math.PI * 0.15, Math.PI * 0.85, false);
      ctx.strokeStyle = ink;
      ctx.lineWidth = w * 0.5;
      ctx.lineCap = "round";
      ctx.stroke();
      break;
  }
}

// ── Icono de documento ───────────────────────────────────────────────────────

/**
 * Hoja genérica con esquina doblada. Igual que el original: Windows no tiene
 * el icono real del archivo al alcance del webview, así que esta forma es
 * todos los casos — el mismo fallback que dibuja el Swift (canvas.ts:491-495).
 */
function drawDoc(ctx: CanvasRenderingContext2D, cx: number, cy: number, wsc: number, hsc: number): void {
  const w = 34 * wsc;
  const h = 42 * hsc;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const fold = 8 * Math.min(wsc, hsc);

  ctx.save();
  ctx.shadowColor = token("paper");
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.beginPath();
  ctx.moveTo(x + 2, y);
  ctx.lineTo(x + w - fold, y);
  ctx.lineTo(x + w, y + fold);
  ctx.lineTo(x + w, y + h - 2);
  ctx.quadraticCurveTo(x + w, y + h, x + w - 2, y + h);
  ctx.lineTo(x + 2, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - 2);
  ctx.lineTo(x, y + 2);
  ctx.quadraticCurveTo(x, y, x + 2, y);
  ctx.closePath();
  ctx.fillStyle = token("ink");
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(x + w - fold, y);
  ctx.lineTo(x + w - fold, y + fold);
  ctx.lineTo(x + w, y + fold);
  ctx.closePath();
  ctx.fillStyle = token("faint");
  ctx.fill();

  // Línea de color de la hoja: el azul del sistema (paleta de charts).
  ctx.fillStyle = token("indigo");
  rr(ctx, x + w * 0.18, y + h * 0.58, w * 0.64, h * 0.16, 2);
  ctx.fill();
}

// ── URL segura (SafeWebURL.swift + extractions §33) ──────────────────────────
//
// Solo http/https + host válido llegan a `shell.openExternal`. El output del
// modelo y datos de API pueden traer file://, smb:// o custom schemes que
// lanzarían apps locales o deep links: nunca salen del renderer.

/** URL web plana válida o null. Acepta `string | null | undefined` (output modelo). */
export function isSafeWebUrl(raw: string | null | undefined): boolean {
  if (typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return false;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  const scheme = parsed.protocol.toLowerCase();
  if (scheme !== "http:" && scheme !== "https:") return false;
  if (!parsed.hostname) return false;
  return true;
}

// ── Cola de drop → ingest background ─────────────────────────────────────────
//
// El drop NUNCA bloquea la UI: `dropInZone` encola y resuelve en background vía
// `ipc knowledge.ingest` (main.ts:4279, ya existe + Zod). Cada archivo emite
// ticks para el `StepTicker` (ticker.ts): `tick 10%+✓` por archivo.

export interface IngestRequest {
  filePath: string;
  projectId?: string;
}

export interface IngestResult {
  ok: boolean;
  error?: string;
}

export interface DropQueueDeps {
  /** Típicamente `(req) => window.ego.knowledge.ingest(req)` (preload ya lo expone). */
  ingest: (req: IngestRequest) => Promise<IngestResult>;
  /** Puente al ticker del overview (`stepSequence tick 10%+✓` vía IPC existente). */
  onStep: (label: string) => void;
  projectId?: string;
}

function baseNameOf(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] ?? path;
}

export class DropQueue {
  private readonly deps: DropQueueDeps;
  private chain: Promise<void> = Promise.resolve();

  constructor(deps: DropQueueDeps) {
    this.deps = deps;
  }

  /** Drop dentro de la zona: encola cada archivo, 1 ingest por archivo, secuencial. */
  dropInZone(paths: string[]): Promise<void> {
    for (const filePath of paths) {
      this.chain = this.chain.then(() => this.ingestOne(filePath));
    }
    return this.chain;
  }

  /** Drop fuera de la zona: se ignora sin error ni ingest (graceful). */
  dropOutside(_paths: string[]): Promise<void> {
    return Promise.resolve();
  }

  private async ingestOne(filePath: string): Promise<void> {
    const name = baseNameOf(filePath);
    this.deps.onStep(`Ingesting ${name} 0%`);
    try {
      const res = await this.deps.ingest({ filePath, projectId: this.deps.projectId });
      // Archivo grande → el indexer resume (graceful §22); el canvas no crece.
      this.deps.onStep(res.ok ? `Ingested ${name} ✓` : `Ingest ${name} failed`);
    } catch {
      // Payload malformado → fallback sin tumbar el flotante (graceful §22).
      this.deps.onStep(`Ingest ${name} failed`);
    }
  }
}

// ── ContextProvider opcional (attach-window-context, extractions §34) ─────────

export interface WindowContextSnapshot {
  appName?: string;
  windowTitle?: string;
  browserUrl?: string;
}

export interface ContextProvider {
  getContext(): Promise<WindowContextSnapshot>;
}

/** No-op documentado: el cableado real (nativa) queda fuera de esta tarea. */
export class NoopContextProvider implements ContextProvider {
  getContext(): Promise<WindowContextSnapshot> {
    return Promise.resolve({});
  }
}
