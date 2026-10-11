// CharacterEngine.ts — Motor Canvas 2D procedimental de Coucou Mochi / Delta Core para Ego
// Portado y tipado estrictamente a TypeScript para React 19 / Electron Renderer.
// Integra geometrías analíticas (superelipse y triángulo Delta Core C_3), micro-interacciones,
// 13 expresiones de ojos, proyección esférica 3D y retroalimentación con WebAudioSynth (COUC-20).

import { Ease, lerp, type EaseFn } from "./anim.js";
import { OUTFITS, type HeadFrame, VIEW_TILT } from "../wardrobe/CharacterWardrobe.js";
import { Sound } from "./sound.js";

export type EyeShape =
  | "pill" | "wide" | "dot" | "line" | "flat" | "happy" | "closed"
  | "spiral" | "heart" | "star" | "tired" | "wink" | "cup";

export type BadgeKind = "dots" | "bang" | "question" | "dot";

export interface Badge {
  kind: BadgeKind;
  color: RGB;
}

export type RGB = readonly [number, number, number];

export type TweenKey = readonly [target: number, durationMs: number, ease: EaseFn];

interface Tween {
  prop: PropKey;
  keys: TweenKey[];
  index: number;
  from: number;
  startMs: number;
  onComplete?: () => void;
}

type PropKey =
  | "yaw" | "pitch" | "roll" | "tilt" | "open" | "sx" | "sy"
  | "oy" | "ox" | "tint" | "morph" | "hands" | "blush" | "es" | "badgeS"
  | "triangleMorph";

export type BotStateName =
  | "idle" | "working" | "thinking" | "searching" | "approval"
  | "question" | "error" | "finished" | "ratelimit" | "sleeping" | "dizzy";

export type BotEmoteName =
  | "love" | "surprised" | "proud" | "wink" | "yawn" | "happy" | "annoyed";

interface BotStateCfg {
  color: RGB;
  tint: number;
  eye: EyeShape;
  badge: Badge | null;
  bounces: boolean;
  scans: boolean;
  breathes: boolean;
  zz: boolean;
  sweat: boolean;
  look: readonly [number, number] | null;
  tilt: number;
}

interface Particle {
  type: "heart" | "star" | "spark" | "sweat" | "z";
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  rot: number;
  size: number;
}

const EYE_W = 0.25;
const EYE_H = 0.27;
const EYE_SP = 0.37;
const EYE_P = -0.12;
const BASE_TOP: RGB = [0.929, 0.929, 0.937]; // #EDEDEF
const BASE_BOTTOM: RGB = [0.769, 0.773, 0.792]; // #C4C5CA
const INK = "rgb(26,20,18)";
const MINI_INK = "rgb(16,19,26)";

export const STATE_COLORS: Record<BotStateName, RGB> = {
  idle: [0.902, 0.914, 0.933],
  working: [0.231, 0.62, 1],
  thinking: [0.545, 0.361, 0.965],
  searching: [0.388, 0.396, 0.949],
  approval: [0.961, 0.647, 0.141],
  question: [0.133, 0.827, 0.933],
  error: [0.957, 0.314, 0.369],
  finished: [0.204, 0.831, 0.6],
  ratelimit: [0.984, 0.573, 0.235],
  sleeping: [0.58, 0.635, 0.722],
  dizzy: [0.957, 0.447, 0.714],
};

const baseCfg = {
  bounces: false,
  scans: false,
  breathes: false,
  zz: false,
  sweat: false,
  look: null,
  tilt: 0,
};

export const BOT_STATES: Record<BotStateName, BotStateCfg> = {
  idle: { ...baseCfg, color: STATE_COLORS.idle, tint: 0, eye: "pill", badge: null },
  working: { ...baseCfg, color: STATE_COLORS.working, tint: 0.72, eye: "pill", badge: { kind: "dots", color: STATE_COLORS.working } },
  thinking: { ...baseCfg, color: STATE_COLORS.thinking, tint: 0.72, eye: "pill", badge: { kind: "dots", color: STATE_COLORS.thinking }, look: [0.55, 0.55] },
  searching: { ...baseCfg, color: STATE_COLORS.searching, tint: 0.72, eye: "pill", badge: { kind: "dots", color: STATE_COLORS.searching }, scans: true },
  approval: { ...baseCfg, color: STATE_COLORS.approval, tint: 0.78, eye: "wide", badge: { kind: "bang", color: STATE_COLORS.approval }, bounces: true },
  question: { ...baseCfg, color: STATE_COLORS.question, tint: 0.75, eye: "pill", badge: { kind: "question", color: STATE_COLORS.question }, tilt: 0.17 },
  error: { ...baseCfg, color: STATE_COLORS.error, tint: 0.78, eye: "flat", badge: { kind: "dot", color: STATE_COLORS.error } },
  finished: { ...baseCfg, color: STATE_COLORS.finished, tint: 0.35, eye: "happy", badge: { kind: "dot", color: STATE_COLORS.finished } },
  ratelimit: { ...baseCfg, color: STATE_COLORS.ratelimit, tint: 0.72, eye: "tired", badge: { kind: "dot", color: STATE_COLORS.ratelimit }, sweat: true },
  sleeping: { ...baseCfg, color: STATE_COLORS.sleeping, tint: 0.32, eye: "closed", badge: null, breathes: true, zz: true },
  dizzy: { ...baseCfg, color: STATE_COLORS.dizzy, tint: 0.7, eye: "spiral", badge: null },
};

export function hexToRGB(hex: string): RGB {
  const h = hex.replace("#", "");
  const v = parseInt(h, 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

const rgba = (c: RGB, a = 1) =>
  `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

const mix3 = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

function rrPoint(ca: number, sa: number, tw: number, th: number, tr: number): { x: number; y: number } {
  const ax = Math.abs(ca);
  const ay = Math.abs(sa);
  const scale = 1 / Math.max(ax / tw, ay / th);
  let x = ca * scale;
  let y = sa * scale;
  const cx = Math.max(0, Math.abs(x) - (tw - tr));
  const cy = Math.max(0, Math.abs(y) - (th - tr));
  if (cx > 0 && cy > 0) {
    const len = Math.hypot(cx, cy);
    if (len > 0) {
      const f = tr / len;
      x = Math.sign(ca) * (tw - tr + cx * f);
      y = Math.sign(sa) * (th - tr + cy * f);
    }
  }
  return { x, y };
}

export class CharacterEngine {
  isMini = false;
  bodyColor: RGB | null = null;
  activeOutfit: string | null = null;

  // Estado animado
  yaw = 0; pitch = 0; roll = 0; tilt = 0; open = 1;
  sx = 1; sy = 1; oy = 0; ox = 0;
  tint = 0; morph = 0; hands = 0; blush = 0; es = 1; badgeS = 0;
  triangleMorph = 0; // 0 = superelipse, 1 = triángulo Delta Core

  // Física de arrastre (lag de resortes para accesorios)
  physDx = 0;
  physDy = 0;
  private prevYaw = 0;
  private prevPitch = 0;

  // Ranura de boca / Gulp spring
  slotH = 0;
  slotHTarget = 0;
  slotHVel = 0;
  isChewing = false;

  // Objetivos de interpolación
  tgYaw = 0; tgPitch = 0; tgTilt = 0; tgSy = 1; tgSx = 1; tgEs = 1;
  particleOverhang = 0;

  col: RGB = STATE_COLORS.idle;
  colT: RGB = STATE_COLORS.idle;

  state: BotStateName = "idle";
  cfg: BotStateCfg = BOT_STATES.idle;

  eyeOverride: EyeShape | null = null;
  eyeOverrideUntil = 0;
  permanentEye: EyeShape | null = null;
  permanentEmote: BotEmoteName | null = null;
  miniNextBehavior = 0;

  badge: Badge | null = null;
  private badgeKey = "none";
  private badgeToken = 0;

  // Interacción
  private slapTimes: number[] = [];
  private greetToken = 0;
  private waveStart = 0;
  private waveUntil = 0;

  customBackDraw?: (ctx: CanvasRenderingContext2D, head: HeadFrame) => void;
  customFrontDraw?: (ctx: CanvasRenderingContext2D, head: HeadFrame) => void;

  private tweens = new Map<PropKey, Tween>();
  private particles: Particle[] = [];
  private nextBlink = performance.now() / 1000 + 1.5;

  constructor() {
    this.setState("idle", true);
  }

  setState(name: BotStateName, snap = false) {
    const cfg = BOT_STATES[name];
    if (!cfg) return;
    const prev = this.state;
    this.state = name;
    this.cfg = cfg;
    this.colT = cfg.color;

    if (snap) {
      this.col = cfg.color;
      this.tint = cfg.tint;
      this.tilt = cfg.tilt;
      this.tgTilt = cfg.tilt;
      this.badge = cfg.badge;
      this.badgeS = cfg.badge ? 1 : 0;
      this.badgeKey = cfg.badge ? `${cfg.badge.kind}:${cfg.badge.color.join(",")}` : "none";
      return;
    }

    this.anim("tint", [[cfg.tint, 220, Ease.inOut]]);
    this.tgTilt = cfg.tilt;
    this.updateBadge(cfg.badge);

    switch (name) {
      case "finished":
        this.doRoll(950, 1);
        setTimeout(() => this.emit("spark", 5), 500);
        Sound.play("finish");
        break;
      case "error":
        this.anim("ox", [
          [0.08, 50, Ease.out],
          [-0.08, 70, Ease.inOut],
          [0.05, 70, Ease.inOut],
          [0, 90, Ease.out],
        ]);
        Sound.play("error");
        break;
      case "approval":
        this.anim("oy", [[-0.2, 150, Ease.out], [0, 300, Ease.back]]);
        Sound.play("approval");
        break;
      case "dizzy":
        this.doRoll(1300, 2);
        break;
      case "question":
        this.blink();
        Sound.play("question");
        break;
      case "ratelimit":
        this.emit("sweat", 1);
        break;
      default:
        if (prev !== "idle" || name !== "idle") this.blink();
    }
  }

  setOutfit(outfitId: string | null) {
    this.activeOutfit = outfitId;
  }

  setShape(shapeName: "delta-core" | "triangle" | "coucou-mochi" | "superellipse") {
    const isTri = shapeName === "delta-core" || shapeName === "triangle";
    const target = isTri ? 1 : 0;
    this.anim("triangleMorph", [[target, 520, Ease.inOut]], () => {
      this.emit("spark", 4);
    });
    if (isTri) {
      this.anim("sy", [[0.88, 120, Ease.out], [1.08, 180, Ease.out], [1.0, 220, Ease.back]]);
      this.anim("sx", [[1.12, 120, Ease.out], [0.94, 180, Ease.out], [1.0, 220, Ease.back]]);
    } else {
      this.anim("sy", [[1.12, 120, Ease.out], [0.94, 180, Ease.out], [1.0, 220, Ease.back]]);
      this.anim("sx", [[0.88, 120, Ease.out], [1.06, 180, Ease.out], [1.0, 220, Ease.back]]);
    }
    Sound.play("blip");
  }

  blink() {
    this.anim("open", [[0.06, 70, Ease.inOut], [1, 130, Ease.out]]);
  }

  squash() {
    this.anim("sy", [[0.78, 70, Ease.out], [1.1, 130, Ease.out], [1, 170, Ease.inOut]]);
    this.anim("sx", [[1.16, 70, Ease.out], [0.95, 130, Ease.out], [1, 170, Ease.inOut]]);
  }

  gulp() {
    Sound.play("blip");
    this.slotHTarget = 0.42;
    setTimeout(() => {
      this.slotHTarget = 0;
      this.isChewing = true;
      setTimeout(() => { this.isChewing = false; }, 800);
    }, 460);
    this.anim("sy", [[0.78, 80, Ease.out], [1.18, 130, Ease.out], [1, 220, Ease.back]]);
    this.anim("sx", [[1.28, 80, Ease.out], [0.92, 130, Ease.out], [1, 220, Ease.back]]);
    this.blink();
  }

  slap() {
    this.interruptGreet();
    if (this.state === "dizzy") return;
    const t = performance.now() / 1000;
    this.slapTimes = this.slapTimes.filter((s) => t - s < 1.7);
    this.slapTimes.push(t);
    Sound.play("slap");
    this.squash();
    if (this.slapTimes.length >= 3) {
      this.slapTimes = [];
      this.setState("dizzy");
    } else {
      this.eyeOverride = "line";
      this.eyeOverrideUntil = t + 0.8;
      setTimeout(() => Sound.play("annoyed"), 60);
    }
  }

  doRoll(durationMs: number, turns: number) {
    this.roll = 0;
    this.anim("roll", [[Math.PI * 2 * turns, durationMs, Ease.inOut]], () => {
      this.roll = 0;
    });
  }

  greet() {
    const t = performance.now() / 1000;
    const tok = ++this.greetToken;
    this.waveStart = t + 0.45;
    this.waveUntil = t + 1.55;

    this.eyeOverride = "happy";
    this.eyeOverrideUntil = t + 2.0;
    this.anim("oy", [[-0.06, 220, Ease.out], [0.0, 220, Ease.back]]);

    setTimeout(() => {
      if (this.greetToken !== tok) return;
      this.anim("hands", [[1, 280, Ease.out]]);
      this.anim("sy", [[0.95, 100, Ease.out], [1.0, 260, Ease.back]]);
      this.anim("sx", [[1.04, 100, Ease.out], [1.0, 260, Ease.back]]);
      Sound.play("greet");
    }, 250);

    setTimeout(() => { if (this.greetToken === tok) this.blink(); }, 550);
    setTimeout(() => { if (this.greetToken === tok) this.blink(); }, 1500);
    setTimeout(() => {
      if (this.greetToken !== tok) return;
      this.waveUntil = 0;
      this.anim("hands", [[0, 200, Ease.inOut]]);
    }, 1550);
    setTimeout(() => {
      if (this.greetToken !== tok) return;
      this.eyeOverride = "happy";
      this.eyeOverrideUntil = (performance.now() / 1000) + 0.3;
    }, 1750);
  }

  interruptGreet() {
    if (this.hands <= 0.01 && (performance.now() / 1000) >= this.waveUntil) return;
    this.greetToken++;
    this.waveUntil = 0;
    this.waveStart = 0;
    this.anim("hands", [[0, 150, Ease.inOut]]);
  }

  triggerEmote(emote: BotEmoteName, duration = 1.8) {
    const t = performance.now() / 1000;
    const EMOTE_EYE: Record<BotEmoteName, EyeShape> = {
      love: "heart",
      surprised: "dot",
      proud: "star",
      wink: "wink",
      yawn: "tired",
      happy: "happy",
      annoyed: "line",
    };
    this.eyeOverride = EMOTE_EYE[emote];
    this.eyeOverrideUntil = t + duration;

    switch (emote) {
      case "love":
        this.anim("blush", [
          [1, 300, Ease.out],
          [1, (duration - 0.6) * 1000, Ease.lin],
          [0, 300, Ease.inOut],
        ]);
        this.emit("heart", 4);
        this.anim("oy", [[-0.1, 160, Ease.out], [0, 300, Ease.back]]);
        Sound.play("approval");
        break;
      case "surprised":
        this.anim("oy", [[-0.3, 140, Ease.out], [0, 380, Ease.back]]);
        this.anim("es", [[1.25, 120, Ease.out], [1, 500, Ease.inOut]]);
        Sound.play("blip");
        break;
      case "proud":
        this.emit("star", 5);
        this.anim("tilt", [
          [-0.14, 220, Ease.out],
          [-0.14, (duration - 0.5) * 1000, Ease.lin],
          [0, 280, Ease.inOut],
        ]);
        this.anim("blush", [
          [0.7, 250, Ease.out],
          [0.7, (duration - 0.5) * 1000, Ease.lin],
          [0, 300, Ease.inOut],
        ]);
        Sound.play("finish");
        break;
      case "wink":
        this.anim("tilt", [
          [0.12, 160, Ease.out],
          [0.12, (duration - 0.4) * 1000, Ease.lin],
          [0, 240, Ease.inOut],
        ]);
        Sound.play("blip");
        break;
      case "yawn":
        this.anim("sy", [[1.12, 500, Ease.inOut], [1, 500, Ease.inOut]]);
        this.anim("sx", [[0.94, 500, Ease.inOut], [1, 500, Ease.inOut]]);
        setTimeout(() => {
          this.eyeOverride = "closed";
          this.emit("z", 2);
        }, 700);
        break;
      case "happy":
        this.anim("blush", [[0.6, 200, Ease.out], [0, 600, Ease.inOut]]);
        Sound.play("finish");
        break;
      case "annoyed":
        this.eyeOverride = "line";
        this.eyeOverrideUntil = t + 0.8;
        setTimeout(() => Sound.play("annoyed"), 60);
        break;
    }
  }

  private updateBadge(badge: Badge | null) {
    const key = badge ? `${badge.kind}:${badge.color.join(",")}` : "none";
    if (key === this.badgeKey) return;
    this.badgeKey = key;
    const token = ++this.badgeToken;
    if (this.badge && badge) {
      this.anim("badgeS", [
        [0, 110, Ease.out],
        [1.15, 160, Ease.back],
        [1, 90, Ease.inOut],
      ]);
      setTimeout(() => {
        if (this.badgeToken === token) this.badge = badge;
      }, 100);
    } else if (badge) {
      this.badge = badge;
      this.anim("badgeS", [[1.18, 200, Ease.back], [1, 100, Ease.inOut]]);
    } else {
      this.anim("badgeS", [[0, 140, Ease.out]], () => {
        if (this.badgeToken === token) this.badge = null;
      });
    }
  }

  lookAt(x: number, y: number) {
    this.tgYaw = Math.max(-0.65, Math.min(0.65, x));
    this.tgPitch = Math.max(-0.45, Math.min(0.45, y));
  }

  anim(prop: PropKey, keys: TweenKey[], onComplete?: () => void) {
    const from = (this as unknown as Record<PropKey, number>)[prop] ?? 0;
    this.tweens.set(prop, {
      prop,
      keys,
      index: 0,
      from,
      startMs: performance.now(),
      onComplete,
    });
  }

  emit(type: Particle["type"], count = 1) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        type,
        x: (Math.random() - 0.5) * 18,
        y: -10 + Math.random() * 5,
        vx: (Math.random() - 0.5) * 24,
        vy: -35 - Math.random() * 30,
        age: 0,
        life: 0.8 + Math.random() * 0.5,
        rot: (Math.random() - 0.5) * 0.8,
        size: 9 + Math.random() * 5,
      });
    }
  }

  update(dt: number) {
    const n = performance.now() / 1000;
    const nowMs = performance.now();

    // Actualizar tweens
    for (const [prop, tw] of Array.from(this.tweens.entries())) {
      const curKey = tw.keys[tw.index];
      if (!curKey) {
        this.tweens.delete(prop);
        continue;
      }
      const [target, duration, ease] = curKey;
      const progress = duration > 0 ? Math.min(1, (nowMs - tw.startMs) / duration) : 1;
      const val = lerp(tw.from, target, ease(progress));
      (this as unknown as Record<PropKey, number>)[prop] = val;

      if (progress >= 1) {
        tw.index++;
        if (tw.index < tw.keys.length) {
          tw.from = target;
          tw.startMs = nowMs;
        } else {
          this.tweens.delete(prop);
          tw.onComplete?.();
        }
      }
    }

    // Seguir objetivos de mirada y rotación suave
    this.yaw = lerp(this.yaw, this.tgYaw, 0.12);
    this.pitch = lerp(this.pitch, this.tgPitch, 0.12);
    this.tilt = lerp(this.tilt, this.tgTilt, 0.12);
    this.col = mix3(this.col, this.colT, 0.08);

    // Calcular lag físico para sombreros y accesorios
    const dYaw = (this.yaw - this.prevYaw) / Math.max(0.001, dt);
    const dPitch = (this.pitch - this.prevPitch) / Math.max(0.001, dt);
    this.prevYaw = this.yaw;
    this.prevPitch = this.pitch;
    this.physDx = lerp(this.physDx, -dYaw * 0.15, 0.15);
    this.physDy = lerp(this.physDy, -dPitch * 0.15, 0.15);

    // Parpadeo automático
    if (n >= this.nextBlink && !this.eyeOverride) {
      this.anim("open", [[0.1, 80, Ease.out], [1, 90, Ease.inOut]]);
      this.nextBlink = n + 2.5 + Math.random() * 3.5;
    }

    // Expirar anulación de ojo
    if (this.eyeOverride && n >= this.eyeOverrideUntil) {
      this.eyeOverride = null;
    }

    // Ranura de boca / Gulp spring
    const kMouth = 18;
    const dMouth = 0.72;
    const mouthAcc = kMouth * kMouth * (this.slotHTarget - this.slotH) - 2 * dMouth * kMouth * this.slotHVel;
    this.slotHVel += mouthAcc * dt;
    this.slotH += this.slotHVel * dt;

    // Partículas
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 20 * dt; // gravedad suave
    }
  }

  draw(x: CanvasRenderingContext2D, W: number, H: number) {
    const R = W * 0.3;
    const rx = R * 1.14;
    const ry = R * 0.88;
    const cx = W / 2 + this.ox * R;
    const cy = H / 2 + this.particleOverhang / 2 + this.oy * R + R * 0.06;

    const headFrame: HeadFrame = {
      R,
      rx,
      ry,
      yaw: this.yaw,
      pitch: this.pitch,
      tilt: this.tilt,
      view: VIEW_TILT,
      phys: { dx: this.physDx, dy: this.physDy },
    };

    const outfit = this.activeOutfit ? OUTFITS[this.activeOutfit] : null;

    // Capa 0: Outfits traseros (ej. respaldo de coronas, alas)
    if (outfit?.back) {
      x.save();
      x.translate(cx, cy);
      if (this.tilt !== 0) x.rotate(this.tilt);
      x.scale(this.sx, this.sy);
      outfit.back(x, headFrame);
      x.restore();
    }

    if (this.customBackDraw) {
      x.save();
      x.translate(cx, cy);
      if (this.tilt !== 0) x.rotate(this.tilt);
      x.scale(this.sx, this.sy);
      this.customBackDraw(x, headFrame);
      x.restore();
    }

    this.drawHandsBehind(x, R, rx, ry, cx, cy);

    x.save();
    x.translate(cx, cy);
    if (this.tilt !== 0) x.rotate(this.tilt);
    x.scale(this.sx, this.sy);

    const body = this.bodyPath(rx, ry, R);
    this.drawBody(x, body, R, rx, ry, outfit?.bodyColors);

    // Rubor en mejillas
    const blushVal = Math.max(this.blush, this.tint * 0.5) * (1 - this.morph);
    if (blushVal > 0.01) {
      x.save();
      x.clip(body);
      const yOffset = Math.sin(this.yaw) * rx * 0.8;
      x.fillStyle = `rgba(255,120,150,${0.5 * blushVal})`;
      for (const sd of [-1, 1]) {
        x.beginPath();
        x.ellipse(sd * rx * 0.55 + yOffset, ry * 0.2, R * 0.17, R * 0.1, 0, 0, Math.PI * 2);
        x.fill();
      }
      x.restore();
    }

    this.drawEyes(x, body, R, rx, ry);
    if (this.morph > 0.05 || this.slotH > 0.01) this.drawMouth(x, body, R);

    // Capa 4: Outfits frontales
    if (outfit?.front) {
      outfit.front(x, headFrame, body);
    }

    if (this.customFrontDraw) {
      this.customFrontDraw(x, headFrame);
    }

    x.restore();

    if (this.badge && this.badgeS > 0.01 && this.morph < 0.25) {
      this.drawBadge(x, this.badge, R, cx, cy);
    }
    this.drawParticles(x, cx, cy);
  }

  private bodyPath(rx: number, ry: number, R: number): Path2D {
    const n = 72;
    const expN = 2.0 / 2.7;
    const tw = R * 1.0;
    const th = R * 0.94;
    const tr = R * 0.42;
    const p = new Path2D();
    const m = this.morph;
    const tm = this.triangleMorph || 0;

    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const px0 = rx * (ca >= 0 ? Math.pow(ca, expN) : -Math.pow(-ca, expN));
      const py0 = ry * (sa >= 0 ? Math.pow(sa, expN) : -Math.pow(-sa, expN));
      let px = px0;
      let py = py0;

      if (m >= 0.005) {
        const rr = rrPoint(ca, sa, tw, th, tr);
        px = lerp(px0, rr.x, m);
        py = lerp(py0, rr.y, m);
      }

      if (tm > 0.001) {
        // Triángulo Delta Core: Simetría rotacional C_3 con curvatura suave y esquinas redondeadas
        // Vértice superior en a = -PI/2 (thRot = 0), base inferior horizontal convexa
        const thRot = a + Math.PI / 2;
        const k = Math.cos(3 * thRot);
        const rTri = 0.92 + 0.38 * k - 0.07 * (k * k - 0.5);
        const pxTri = Math.cos(a) * rTri * rx * 1.18;
        const pyTri = Math.sin(a) * rTri * ry * 1.08 + (ry * 0.16 * tm);
        px = lerp(px, pxTri, tm);
        py = lerp(py, pyTri, tm);
      }

      if (i === 0) p.moveTo(px, py);
      else p.lineTo(px, py);
    }
    p.closePath();
    return p;
  }

  private drawBody(
    x: CanvasRenderingContext2D,
    body: Path2D,
    R: number,
    rx: number,
    ry: number,
    overrideColors?: [string, string]
  ) {
    if (this.bodyColor) {
      x.fillStyle = rgba(this.bodyColor, 1);
      x.fill(body);
      return;
    }
    const g = x.createLinearGradient(rx * 0.7, -ry * 0.85, -rx * 0.8, ry * 0.9);
    if (overrideColors) {
      g.addColorStop(0, overrideColors[0]);
      g.addColorStop(1, overrideColors[1]);
    } else {
      g.addColorStop(0, rgba(BASE_TOP));
      g.addColorStop(1, rgba(BASE_BOTTOM));
    }
    x.fillStyle = g;
    x.fill(body);

    const effectiveTint = this.tint * (1 - this.morph);
    if (effectiveTint > 0.01) {
      const tg = x.createLinearGradient(0, ry, 0, -ry);
      tg.addColorStop(0, rgba(this.col, 0.72 * effectiveTint));
      tg.addColorStop(1, rgba(this.col, 0));
      x.fillStyle = tg;
      x.fill(body);
    }

    const sh = x.createRadialGradient(0, 0, R * 0.15, 0, 0, R * 1.25);
    sh.addColorStop(0, "rgba(0,0,0,0)");
    sh.addColorStop(0.6, "rgba(0,0,0,0)");
    sh.addColorStop(1, "rgba(0,0,0,0.2)");
    x.fillStyle = sh;
    x.fill(body);

    const hl = x.createRadialGradient(rx * 0.34, -ry * 0.46, 0, rx * 0.34, -ry * 0.46, R * 0.42);
    hl.addColorStop(0, "rgba(255,255,255,0.55)");
    hl.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = hl;
    x.fill(body);
  }

  private drawEyes(x: CanvasRenderingContext2D, body: Path2D, R: number, rx: number, ry: number) {
    const shape: EyeShape = this.eyeOverride ?? this.permanentEye ?? this.cfg.eye;
    const es = this.es;
    const ink = this.isMini ? MINI_INK : INK;
    x.save();
    x.clip(body);
    for (const sd of [-1, 1]) {
      const eyeYaw = sd * EYE_SP + this.yaw;
      let eyePitch = EYE_P + this.pitch + this.roll;
      eyePitch = (((eyePitch + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      const cp = Math.cos(eyePitch);
      if (Math.cos(eyeYaw) * cp <= 0.04) continue;

      const px = Math.sin(eyeYaw) * cp * rx;
      const py = -Math.sin(eyePitch) * ry + (this.triangleMorph * ry * 0.14);
      const fx = Math.max(0.18, Math.cos(eyeYaw));
      const fy = Math.max(0.18, cp);

      x.save();
      x.translate(px, py);
      x.scale(fx, fy * this.open);

      const ew = R * EYE_W * es;
      const eh = R * EYE_H * es;

      x.fillStyle = ink;
      x.strokeStyle = ink;
      x.lineWidth = R * 0.07;
      x.lineCap = "round";

      if (shape === "happy") {
        x.beginPath();
        x.arc(0, eh * 0.1, ew * 0.48, Math.PI * 1.15, Math.PI * 1.85);
        x.stroke();
      } else if (shape === "closed" || shape === "line") {
        x.beginPath();
        x.moveTo(-ew * 0.5, 0);
        x.lineTo(ew * 0.5, 0);
        x.stroke();
      } else if (shape === "flat") {
        x.beginPath();
        x.moveTo(-ew * 0.5, 0);
        x.lineTo(ew * 0.5, 0);
        x.stroke();
      } else if (shape === "dot") {
        x.beginPath();
        x.arc(0, 0, Math.min(ew, eh) * 0.28, 0, Math.PI * 2);
        x.fill();
      } else if (shape === "star") {
        this.starPath(x, ew * 0.55, ew * 0.25);
        x.fill();
      } else if (shape === "heart") {
        this.heartPath(x, ew * 0.55);
        x.fill();
      } else if (shape === "wink") {
        if (sd < 0) {
          x.beginPath();
          x.moveTo(-ew * 0.5, 0);
          x.lineTo(ew * 0.5, 0);
          x.stroke();
        } else {
          const r = Math.min(ew, eh) * 0.48;
          x.beginPath();
          x.roundRect(-ew / 2, -eh / 2, ew, eh, r);
          x.fill();
        }
      } else if (shape === "tired") {
        x.beginPath();
        x.moveTo(-ew * 0.5, eh * 0.2);
        x.lineTo(ew * 0.5, eh * 0.2);
        x.stroke();
      } else if (shape === "spiral") {
        x.beginPath();
        x.arc(0, 0, Math.min(ew, eh) * 0.35, 0, Math.PI * 1.8);
        x.stroke();
      } else if (shape === "cup") {
        x.beginPath();
        x.arc(0, -eh * 0.1, ew * 0.45, Math.PI * 0.15, Math.PI * 0.85);
        x.stroke();
      } else {
        // "pill" o "wide"
        const r = Math.min(ew, eh) * 0.48;
        x.beginPath();
        x.roundRect(-ew / 2, -eh / 2, ew, eh, r);
        x.fill();
      }
      x.restore();
    }
    x.restore();
  }

  private drawMouth(x: CanvasRenderingContext2D, body: Path2D, R: number) {
    x.save();
    x.clip(body);
    const mw = R * 0.25;
    const mh = Math.max(R * 0.12 * this.morph, R * 0.18 * this.slotH);
    x.beginPath();
    x.ellipse(0, R * 0.28, mw, mh, 0, 0, Math.PI * 2);
    x.fillStyle = "rgba(40,15,20,0.75)";
    x.fill();
    x.restore();
  }

  private drawHandsBehind(x: CanvasRenderingContext2D, _R: number, rx: number, ry: number, cx: number, cy: number) {
    if (this.hands <= 0.01) return;
    const n = performance.now() / 1000;
    const bodyH = 2 * ry;
    const hew = 0.3 * ry * this.hands;
    const heh = 0.26 * ry * this.hands;
    const hwB = rx * this.sx;
    const hhB = ry * this.sy;
    const isWaving = n >= this.waveStart && this.waveStart > 0 && n < this.waveUntil;

    for (const sd of [-1, 1]) {
      let localX: number;
      let localY: number;
      let handRot = 0;

      if (sd > 0 && isWaving) {
        const wt = n - this.waveStart;
        const rise = Math.min(1, wt / 0.18);
        const riseEased = 1 - Math.pow(1 - rise, 3);
        const restX = hwB * 1.08;
        const restY = hhB * 0.7;
        const oscX = Math.cos(13 * wt) * 0.06 * bodyH;
        const oscY = -Math.sin(13 * wt) * 0.14 * bodyH;
        const waveX = hwB * 1.1 + oscX;
        const waveY = -hhB * 0.15 + oscY;
        localX = restX + (waveX - restX) * riseEased;
        localY = restY + (waveY - restY) * riseEased;
        handRot = (-0.5 + Math.sin(13 * wt) * 0.35) * riseEased;
      } else if (sd < 0 && isWaving) {
        const wt = n - this.waveStart;
        localX = -hwB * 1.08;
        localY = hhB * 0.7 + Math.sin(6 * wt) * 0.04 * bodyH;
      } else {
        localX = sd * hwB * 1.08;
        localY = hhB * 0.7;
      }

      const cosT = Math.cos(this.tilt);
      const sinT = Math.sin(this.tilt);
      const worldX = cx + cosT * localX - sinT * localY;
      const worldY = cy + sinT * localX + cosT * localY;

      x.save();
      x.translate(worldX, worldY);
      if (handRot !== 0) x.rotate(handRot);
      const g = x.createLinearGradient(hew * 0.7, -heh * 0.85, -hew * 0.8, heh * 0.9);
      if (this.bodyColor) {
        x.fillStyle = rgba(this.bodyColor);
      } else {
        g.addColorStop(0, rgba(BASE_TOP));
        g.addColorStop(1, rgba(BASE_BOTTOM));
        x.fillStyle = g;
      }
      x.beginPath();
      x.ellipse(0, 0, hew, heh, 0, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = "rgba(0,0,0,0.08)";
      x.lineWidth = 1;
      x.stroke();
      x.restore();
    }
  }

  private drawBadge(x: CanvasRenderingContext2D, badge: Badge, R: number, cx: number, cy: number) {
    x.save();
    x.translate(cx + R * 0.82, cy - R * 0.72);
    x.scale(this.badgeS, this.badgeS);
    const br = R * 0.22;
    x.fillStyle = rgba(badge.color);
    x.beginPath();
    x.arc(0, 0, br, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = "#FFFFFF";
    if (badge.kind === "bang") {
      x.font = `bold ${Math.round(br * 1.3)}px sans-serif`;
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText("!", 0, 0);
    } else if (badge.kind === "question") {
      x.font = `bold ${Math.round(br * 1.2)}px sans-serif`;
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText("?", 0, 0);
    } else if (badge.kind === "dots") {
      for (const d of [-br * 0.45, 0, br * 0.45]) {
        x.beginPath();
        x.arc(d, 0, br * 0.18, 0, Math.PI * 2);
        x.fill();
      }
    }
    x.restore();
  }

  private drawParticles(x: CanvasRenderingContext2D, cx: number, cy: number) {
    for (const p of this.particles) {
      const alpha = 1 - p.age / p.life;
      x.save();
      x.translate(cx + p.x, cy + p.y);
      x.rotate(p.rot);
      x.globalAlpha = alpha;
      if (p.type === "heart") {
        x.fillStyle = "#FF4081";
        this.heartPath(x, p.size);
        x.fill();
      } else if (p.type === "star" || p.type === "spark") {
        x.fillStyle = "#FFD700";
        this.starPath(x, p.size, p.size * 0.45);
        x.fill();
      } else if (p.type === "sweat") {
        x.fillStyle = "#4FC3F7";
        x.beginPath();
        x.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
        x.fill();
      } else if (p.type === "z") {
        x.fillStyle = "#9E9E9E";
        x.font = `bold ${Math.round(p.size * 1.5)}px sans-serif`;
        x.fillText("Z", 0, 0);
      }
      x.restore();
    }
  }

  private heartPath(x: CanvasRenderingContext2D, s: number) {
    x.beginPath();
    x.moveTo(0, s * 0.38);
    x.bezierCurveTo(-s * 1.05, -s * 0.15, -s * 0.5, -s * 0.95, 0, -s * 0.38);
    x.bezierCurveTo(s * 0.5, -s * 0.95, s * 1.05, -s * 0.15, 0, s * 0.38);
    x.closePath();
  }

  private starPath(x: CanvasRenderingContext2D, ro: number, ri: number) {
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? ri : ro;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    x.closePath();
  }
}
