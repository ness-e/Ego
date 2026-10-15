import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CharacterEngine,
  BOT_STATES,
  STATE_COLORS,
  hexToRGB,
  type BotStateName,
} from "../components/character/core/CharacterEngine.js";
import { Ease } from "../components/character/core/anim.js";

const ALL_STATES = Object.keys(BOT_STATES) as BotStateName[];

function mockNow(ms: number) {
  vi.spyOn(performance, "now").mockImplementation(() => ms);
}

describe("CHAR-05: CharacterEngine — Motor procedural Canvas 2D", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("1. Tablas canónicas de estados", () => {
    it("expone los 11 estados con color RGB, ojo y badge coherentes", () => {
      expect(ALL_STATES).toHaveLength(11);
      for (const name of ALL_STATES) {
        const cfg = BOT_STATES[name];
        expect(cfg.color).toHaveLength(3);
        expect(STATE_COLORS[name]).toEqual(cfg.color);
        expect(typeof cfg.eye).toBe("string");
        expect(typeof cfg.tint).toBe("number");
      }
    });

    it("idle arranca sin badge ni tinte; working tiñe y muestra badge", () => {
      expect(BOT_STATES.idle.badge).toBeNull();
      expect(BOT_STATES.idle.tint).toBe(0);
      expect(BOT_STATES.working.badge).not.toBeNull();
      expect(BOT_STATES.working.tint).toBeGreaterThan(0);
    });
  });

  describe("2. Utilidades puras", () => {
    it("hexToRGB convierte hex de 6 dígitos a triple RGB 0..1", () => {
      expect(hexToRGB("#ff0000")).toEqual([1, 0, 0]);
      expect(hexToRGB("#00ff00")).toEqual([0, 1, 0]);
      expect(hexToRGB("#0000ff")).toEqual([0, 0, 1]);
      const [r, g, b] = hexToRGB("#EDEDEF");
      expect(r).toBeCloseTo(0.929, 2);
      expect(g).toBeCloseTo(0.929, 2);
      expect(b).toBeCloseTo(0.937, 2);
    });
  });

  describe("3. setState con snap (determinista, sin timers ni sonido)", () => {
    it("aplica los 11 estados de forma instantánea y coherente", () => {
      const eng = new CharacterEngine();
      for (const name of ALL_STATES) {
        eng.setState(name, true);
        const cfg = BOT_STATES[name];
        expect(eng.state).toBe(name);
        expect(eng.col).toEqual(cfg.color);
        expect(eng.tint).toBe(cfg.tint);
        expect(eng.tilt).toBe(cfg.tilt);
        expect(eng.badge).toEqual(cfg.badge);
        expect(eng.badgeS).toBe(cfg.badge ? 1 : 0);
      }
    });

    it("ignora estados desconocidos sin romper el estado actual", () => {
      const eng = new CharacterEngine();
      eng.setState("working", true);
      eng.setState("no-existe" as BotStateName, true);
      expect(eng.state).toBe("working");
    });
  });

  describe("4. Interpolación animada (anim + update con tiempo mockeado)", () => {
    it("progresa un tween linealmente según el easing y lo completa", () => {
      const t0 = 1_000_000;
      mockNow(t0);
      const eng = new CharacterEngine();
      expect(eng.tint).toBe(0);

      eng.anim("tint", [[0.9, 200, Ease.inOut]]);
      mockNow(t0 + 100);
      eng.update(0.1);
      // inOut(0.5) = 0.5 → lerp(0, 0.9, 0.5)
      expect(eng.tint).toBeCloseTo(0.45, 5);

      mockNow(t0 + 300);
      eng.update(0.1);
      expect(eng.tint).toBeCloseTo(0.9, 5);
    });

    it("encadena múltiples claves de un tween en orden", () => {
      const t0 = 2_000_000;
      mockNow(t0);
      const eng = new CharacterEngine();
      eng.anim("ox", [
        [0.08, 50, Ease.out],
        [0, 50, Ease.out],
      ]);
      mockNow(t0 + 60);
      eng.update(0.05);
      // Primera clave (50ms) ya completada → ox en su objetivo
      expect(eng.ox).toBeCloseTo(0.08, 5);
      mockNow(t0 + 200);
      eng.update(0.05);
      // Segunda clave completa → de vuelta a 0
      expect(eng.ox).toBeCloseTo(0, 5);
    });

    it("setState no-snap converge el color hacia el objetivo", () => {
      const t0 = 3_000_000;
      mockNow(t0);
      const eng = new CharacterEngine();
      const dist = (a: readonly number[], b: readonly number[]) =>
        Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0));
      const before = dist(eng.col, BOT_STATES.working.color);
      eng.setState("working");
      for (let i = 0; i < 40; i++) {
        mockNow(t0 + i * 16);
        eng.update(0.016);
      }
      expect(dist(eng.col, BOT_STATES.working.color)).toBeLessThan(before);
    });
  });

  describe("5. Interacción", () => {
    it("lookAt limita yaw/pitch a sus rangos", () => {
      const eng = new CharacterEngine();
      eng.lookAt(10, -10);
      expect(eng.tgYaw).toBe(0.65);
      expect(eng.tgPitch).toBe(-0.45);
      eng.lookAt(-10, 10);
      expect(eng.tgYaw).toBe(-0.65);
      expect(eng.tgPitch).toBe(0.45);
    });

    it("tres slaps en <1.7s llevan a dizzy; slap en dizzy no hace nada", () => {
      let nowMs = 4_000_000;
      vi.spyOn(performance, "now").mockImplementation(() => nowMs);
      const eng = new CharacterEngine();
      eng.slap();
      expect(eng.state).not.toBe("dizzy");
      nowMs += 100;
      eng.slap();
      expect(eng.state).not.toBe("dizzy");
      nowMs += 100;
      eng.slap();
      expect(eng.state).toBe("dizzy");
      eng.slap();
      expect(eng.state).toBe("dizzy");
    });

    it("setShape triangle anima triangleMorph hacia 1", () => {
      const t0 = 5_000_000;
      mockNow(t0);
      const eng = new CharacterEngine();
      expect(eng.triangleMorph).toBe(0);
      eng.setShape("triangle");
      mockNow(t0 + 700);
      eng.update(0.05);
      expect(eng.triangleMorph).toBeCloseTo(1, 2);
    });

    it("greet activa override feliz y ventana de saludo", () => {
      const eng = new CharacterEngine();
      eng.greet();
      expect(eng.eyeOverride).toBe("happy");
      expect(eng.eyeOverrideUntil).toBeGreaterThan(0);
    });
  });

  describe("6. Partículas acotadas (memoria)", () => {
    it("emit acumula y update purga las expiradas", () => {
      const eng = new CharacterEngine();
      const internals = eng as unknown as { particles: { age: number; life: number }[] };
      expect(internals.particles).toHaveLength(0);
      eng.emit("spark", 5);
      expect(internals.particles).toHaveLength(5);
      eng.update(10);
      expect(internals.particles).toHaveLength(0);
    });
  });
});
