import { describe, it, expect } from "vitest";
import {
  CLOSE_MS,
  HITL_H,
  NOTCH_H,
  NOTCH_W,
  OPEN_SPRING_DAMPING,
  OPEN_SPRING_RESPONSE,
  PANEL_H,
  PANEL_W,
  STRIP_H,
  STRIP_W,
  IslandAnimator,
  Spring,
  Tracked,
  closeCurve,
  islandSize,
  shouldAcceptMouse,
} from "../renderer/floating/floating-anim.js";

describe("geometria", () => {
  it("compact < expanded", () => {
    expect(islandSize("compact").w).toBeLessThan(islandSize("expanded").w);
  });

  it("hidden = strip invisible 240x6", () => {
    expect(islandSize("hidden")).toEqual({ w: 240, h: 6 });
    expect(islandSize("hidden")).toEqual({ w: STRIP_W, h: STRIP_H });
  });

  it("compact = NOTCH 184x32", () => {
    expect(islandSize("compact")).toEqual({ w: NOTCH_W, h: NOTCH_H });
    expect(islandSize("compact").w).toBe(184);
  });

  it("expanded = panel 720x320", () => {
    expect(islandSize("expanded")).toEqual({ w: PANEL_W, h: PANEL_H });
    expect(islandSize("expanded")).toEqual({ w: 720, h: 320 });
  });

  it("hitl = 720x400 (mas alto que expanded)", () => {
    expect(islandSize("hitl")).toEqual({ w: PANEL_W, h: HITL_H });
    expect(islandSize("hitl")).toEqual({ w: 720, h: 400 });
    expect(islandSize("hitl").h).toBeGreaterThan(islandSize("expanded").h);
  });

  it("modo desconocido lanza RangeError", () => {
    expect(() => islandSize("narnia" as never)).toThrow(RangeError);
  });

  it("click-through: solo hitl captura el raton", () => {
    expect(shouldAcceptMouse("hitl")).toBe(true);
    expect(shouldAcceptMouse("hidden")).toBe(false);
    expect(shouldAcceptMouse("compact")).toBe(false);
    expect(shouldAcceptMouse("expanded")).toBe(false);
  });
});

describe("fisica springs (port coucou anim.ts)", () => {
  it("open spring usa 0.5/0.72 por defecto", () => {
    expect(OPEN_SPRING_RESPONSE).toBe(0.5);
    expect(OPEN_SPRING_DAMPING).toBe(0.72);
    const s = new Spring(184);
    expect(s.omega).toBeCloseTo((2 * Math.PI) / 0.5, 10);
    expect(s.zeta).toBe(0.72);
  });

  it("spring converge al target con sub-stepping estable", () => {
    const s = new Spring(NOTCH_W);
    s.target = PANEL_W;
    for (let i = 0; i < 600; i++) s.step(1 / 60);
    expect(s.settled).toBe(true);
    expect(s.value).toBeCloseTo(PANEL_W, 0);
  });

  it("curva de cierre 340 ms (.45,0,.2,1): f(0)=0, f(1)=1, monotona", () => {
    expect(CLOSE_MS).toBe(340);
    expect(closeCurve(0)).toBeCloseTo(0, 6);
    expect(closeCurve(1)).toBeCloseTo(1, 6);
    let prev = -Infinity;
    for (let i = 0; i <= 20; i++) {
      const v = closeCurve(i / 20);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it("Tracked: encoger con curva NO rebota (acotado al intervalo)", () => {
    const t = new Tracked(PANEL_W);
    const now0 = 1_000_000;
    t.curveTowards(NOTCH_W, CLOSE_MS, now0);
    let lo = Infinity;
    let hi = -Infinity;
    for (let ms = 0; ms <= CLOSE_MS + 60; ms += 16) {
      t.step(1 / 60, now0 + ms);
      lo = Math.min(lo, t.value);
      hi = Math.max(hi, t.value);
    }
    expect(lo).toBeGreaterThanOrEqual(NOTCH_W - 0.5);
    expect(hi).toBeLessThanOrEqual(PANEL_W + 0.5);
    expect(t.animating).toBe(false);
    expect(t.value).toBeCloseTo(NOTCH_W, 0);
  });
});

describe("IslandAnimator event-driven (sin polling 60 Hz)", () => {
  function fakeRaf() {
    const queue: Array<(t: number) => void> = [];
    let schedules = 0;
    let cancels = 0;
    return {
      queue,
      stats: () => ({ schedules, cancels }),
      requestRaf: (cb: (t: number) => void): number => {
        schedules += 1;
        queue.push(cb);
        return schedules;
      },
      cancelRaf: (_id: number): void => {
        cancels += 1;
      },
    };
  }

  /** Drena la cola RAF simulando frames de 16 ms hasta asentar o agotar budget. */
  function drainToSettled(
    anim: IslandAnimator,
    raf: ReturnType<typeof fakeRaf>,
    startNow: number,
    budget = 1200,
  ): number {
    let now = startNow;
    for (let i = 0; i < budget; i++) {
      const cb = raf.queue.shift();
      if (!cb) break;
      now += 16;
      cb(now);
      if (!anim.running) break;
    }
    return now;
  }

  it("arranca parado; setMode lo enciende y al asentarse se detiene", () => {
    const raf = fakeRaf();
    const rects: Array<{ w: number; h: number }> = [];
    const anim = new IslandAnimator("hidden", {
      requestRaf: raf.requestRaf,
      cancelRaf: raf.cancelRaf,
      onRect: (r) => rects.push(r),
    });
    expect(anim.running).toBe(false);

    anim.setMode("expanded", 5_000);
    expect(anim.running).toBe(true);
    drainToSettled(anim, raf, 5_000);
    expect(anim.running).toBe(false);
    expect(anim.animating).toBe(false);
    expect(anim.currentRect()).toEqual({ w: 720, h: 320 });
    expect(rects.length).toBeGreaterThan(0);
  });

  it("RAF stop en hidden: tras asentarse no se re-encadena (0% CPU idle)", () => {
    const raf = fakeRaf();
    const anim = new IslandAnimator("expanded", {
      requestRaf: raf.requestRaf,
      cancelRaf: raf.cancelRaf,
    });
    anim.setMode("hidden", 9_000);
    const before = raf.stats().schedules;
    expect(before).toBeGreaterThan(0);
    drainToSettled(anim, raf, 9_000);
    expect(anim.running).toBe(false);
    expect(anim.currentRect()).toEqual({ w: 240, h: 6 });
    const settled = raf.stats().schedules;
    // Sin polling: sin nuevos eventos no hay nuevos RAF.
    anim.tick(9_000 + CLOSE_MS + 5_000);
    expect(raf.stats().schedules).toBe(settled);
    expect(anim.running).toBe(false);
  });

  it("setMode repetido al mismo modo no re-enciende el loop", () => {
    const raf = fakeRaf();
    const anim = new IslandAnimator("compact", {
      requestRaf: raf.requestRaf,
      cancelRaf: raf.cancelRaf,
    });
    anim.setMode("compact", 1_000);
    expect(anim.running).toBe(false);
    expect(raf.stats().schedules).toBe(0);
  });
});
