import { describe, it, expect, vi } from "vitest";
import { CharacterMotionGuard } from "../renderer/components/character/CharacterMotionGuard.js";

describe("CharacterMotionGuard (CHAR-11)", () => {
  it("desactiva animaciones cuando prefers-reduced-motion está habilitado", () => {
    let rafCalled = 0;
    const fakeRaf = vi.fn((cb) => {
      rafCalled++;
      return 101;
    });
    const fakeCancelRaf = vi.fn();

    const guard = new CharacterMotionGuard({
      prefersReducedMotion: true,
      rafProvider: fakeRaf,
      cancelRafProvider: fakeCancelRaf,
    });

    expect(guard.shouldAnimate()).toBe(false);
    expect(guard.getTargetFps()).toBe(0);

    const frameCallback = vi.fn();
    const dispose = guard.startLoop(frameCallback);

    // Debe invocar el frame una única vez estáticamente y detener el loop
    expect(frameCallback).toHaveBeenCalledWith(0);
    dispose();
  });

  it("desactiva animaciones cuando el kill-switch está activado por el usuario", () => {
    const guard = new CharacterMotionGuard({
      userAnimationKillSwitch: true,
    });

    expect(guard.shouldAnimate()).toBe(false);
    expect(guard.getTargetFps()).toBe(0);
  });

  it("aplica throttling adaptativo: 60 fps con foco vs 15 fps en segundo plano", () => {
    const guard = new CharacterMotionGuard({
      isWindowFocused: true,
    });

    expect(guard.shouldAnimate()).toBe(true);
    expect(guard.getTargetFps()).toBe(60);

    guard.setWindowFocused(false);
    expect(guard.getTargetFps()).toBe(15);
  });

  it("cancela rigurosamente el handle de requestAnimationFrame al desmontar", () => {
    let handleCounter = 1;
    const fakeRaf = vi.fn(() => ++handleCounter);
    const fakeCancelRaf = vi.fn();

    const guard = new CharacterMotionGuard({
      rafProvider: fakeRaf,
      cancelRafProvider: fakeCancelRaf,
    });

    const dispose = guard.startLoop(() => {});
    expect(guard.getActiveHandle()).not.toBeNull();

    dispose();
    expect(fakeCancelRaf).toHaveBeenCalled();
    expect(guard.getActiveHandle()).toBeNull();
  });
});
