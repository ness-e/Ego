import { describe, it, expect, vi } from "vitest";
import { CharacterMotionGuard } from "../components/character/CharacterMotionGuard.js";

function manualRaf() {
  const queue: Array<(time: number) => void> = [];
  const scheduled: number[] = [];
  let nextHandle = 1;
  const cancelled: number[] = [];
  const rafProvider = (cb: (time: number) => void): number => {
    const h = nextHandle++;
    queue.push(cb);
    scheduled.push(h);
    return h;
  };
  const cancelRafProvider = (h: number): void => {
    cancelled.push(h);
  };
  const pump = (time: number, maxFrames = 10): number => {
    let frames = 0;
    while (queue.length > 0 && frames < maxFrames) {
      const cb = queue.shift()!;
      frames++;
      cb(time + frames * 16);
    }
    return frames;
  };
  return { rafProvider, cancelRafProvider, pump, scheduled, cancelled, pending: () => queue.length };
}

describe("CHAR-11: CharacterMotionGuard — Accesibilidad y fuga de rAF", () => {
  it("kill-switch o reduced-motion desactivan la animación y fijan fps 0", () => {
    const killed = new CharacterMotionGuard({ userAnimationKillSwitch: true });
    expect(killed.shouldAnimate()).toBe(false);
    expect(killed.getTargetFps()).toBe(0);

    const reduced = new CharacterMotionGuard({ prefersReducedMotion: true });
    expect(reduced.shouldAnimate()).toBe(false);
    expect(reduced.getTargetFps()).toBe(0);

    const ok = new CharacterMotionGuard({});
    expect(ok.shouldAnimate()).toBe(true);
    expect(ok.getTargetFps()).toBe(60);
  });

  it("conmuta 60 fps en foco → 15 fps en fondo", () => {
    const guard = new CharacterMotionGuard({});
    expect(guard.getTargetFps()).toBe(60);
    guard.setWindowFocused(false);
    expect(guard.getTargetFps()).toBe(15);
    guard.setWindowFocused(true);
    expect(guard.getTargetFps()).toBe(60);
  });

  it("respeta fps objetivo personalizados", () => {
    const guard = new CharacterMotionGuard({ targetFpsFocused: 30, targetFpsBackground: 10 });
    expect(guard.getTargetFps()).toBe(30);
    guard.setWindowFocused(false);
    expect(guard.getTargetFps()).toBe(10);
  });

  it("con animación desactivada pinta un frame estático sin encolar rAF", () => {
    const rig = manualRaf();
    const guard = new CharacterMotionGuard({
      prefersReducedMotion: true,
      rafProvider: rig.rafProvider,
      cancelRafProvider: rig.cancelRafProvider,
    });
    const cb = vi.fn();
    const dispose = guard.startLoop(cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(0);
    expect(rig.scheduled).toHaveLength(0);
    expect(guard.getActiveHandle()).toBeNull();
    dispose();
  });

  it("el loop activo respeta el intervalo de frame y el dispose cancela el handle (anti-leak)", () => {
    const rig = manualRaf();
    const guard = new CharacterMotionGuard({
      rafProvider: rig.rafProvider,
      cancelRafProvider: rig.cancelRafProvider,
    });
    const cb = vi.fn();
    const dispose = guard.startLoop(cb);
    expect(rig.scheduled).toHaveLength(1);

    rig.pump(Date.now(), 5);
    expect(cb.mock.calls.length).toBeGreaterThan(0);

    const handleBefore = guard.getActiveHandle();
    expect(handleBefore).not.toBeNull();
    dispose();
    expect(guard.getActiveHandle()).toBeNull();
    expect(rig.cancelled).toContain(handleBefore as number);
  });

  it("stopLoop sin loop previo no falla ni cancela nada", () => {
    const rig = manualRaf();
    const guard = new CharacterMotionGuard({
      rafProvider: rig.rafProvider,
      cancelRafProvider: rig.cancelRafProvider,
    });
    expect(() => guard.stopLoop()).not.toThrow();
    expect(rig.cancelled).toHaveLength(0);
  });

  it("los setters reactivan la animación al desactivar kill-switch y reduced-motion", () => {
    const guard = new CharacterMotionGuard({ prefersReducedMotion: true, userAnimationKillSwitch: true });
    expect(guard.shouldAnimate()).toBe(false);
    guard.setReducedMotion(false);
    expect(guard.shouldAnimate()).toBe(false);
    guard.setKillSwitch(false);
    expect(guard.shouldAnimate()).toBe(true);
    expect(guard.getTargetFps()).toBe(60);
  });
});
