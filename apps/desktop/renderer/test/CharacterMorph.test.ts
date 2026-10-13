import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  easeInOutCubic,
  lerpRGB,
  CharacterMorphController,
  type MorphTarget,
} from "../components/character/transitions/CharacterMorph.js";

describe("CHAR-09: CharacterMorph — Interpolación y Transiciones de Identidad Visual", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Funciones de interpolación matemática", () => {
    it("easeInOutCubic debe respetar límites y simetría", () => {
      expect(easeInOutCubic(0)).toBe(0);
      expect(easeInOutCubic(1)).toBe(1);
      expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 5);
      expect(easeInOutCubic(-0.5)).toBe(0);
      expect(easeInOutCubic(1.5)).toBe(1);
    });

    it("lerpRGB debe interpolar componentes de color suavemente", () => {
      const colorA = [100, 150, 200] as const;
      const colorB = [200, 50, 100] as const;

      const atStart = lerpRGB(colorA, colorB, 0);
      expect(atStart).toEqual([100, 150, 200]);

      const atHalf = lerpRGB(colorA, colorB, 0.5);
      expect(atHalf[0]).toBe(150);
      expect(atHalf[1]).toBe(100);
      expect(atHalf[2]).toBe(150);

      const atEnd = lerpRGB(colorA, colorB, 1);
      expect(atEnd).toEqual([200, 50, 100]);
    });
  });

  describe("2. CharacterMorphController — Ciclo de vida y morphing", () => {
    const targetA: MorphTarget = {
      bodyColor: [50, 100, 150],
      eyeShape: "pill",
      outfitId: null,
      accentColor: [56, 189, 248],
    };

    const targetB: MorphTarget = {
      bodyColor: [200, 80, 40],
      eyeShape: "wink",
      outfitId: "sunglasses",
      accentColor: [245, 158, 11],
    };

    it("debe ejecutar la transición actualizando el target hasta completarse", () => {
      const controller = new CharacterMorphController(450);
      const updates: MorphTarget[] = [];
      const onComplete = vi.fn();

      let mockNow = 1000;
      vi.spyOn(performance, "now").mockImplementation(() => mockNow);

      const rafCapture: { cb: ((time: number) => void) | null } = { cb: null };
      vi.spyOn(window, "requestAnimationFrame").mockImplementation(
        ((cb: (time: number) => void): number => {
          rafCapture.cb = cb;
          return 123;
        }) as (...args: Array<unknown>) => number
      );

      controller.start(
        targetA,
        targetB,
        (current) => updates.push(current),
        onComplete
      );

      expect(controller.isActive()).toBe(true);

      // Avanzar a la mitad del tiempo (225ms)
      mockNow = 1225;
      rafCapture.cb?.(mockNow);

      expect(updates.length).toBeGreaterThan(0);
      const mid = updates[updates.length - 1];
      expect(mid.eyeShape).toBe("wink"); // Conmuta en >= 0.5

      // Avanzar al final del tiempo (450ms)
      mockNow = 1500;
      rafCapture.cb?.(mockNow);

      expect(controller.isActive()).toBe(false);
      expect(onComplete).toHaveBeenCalled();
      const end = updates[updates.length - 1];
      expect(end.bodyColor).toEqual([200, 80, 40]);
      expect(end.outfitId).toBe("sunglasses");
    });

    it("debe aplicar corte instantáneo si el usuario prefiere movimiento reducido (prefers-reduced-motion)", () => {
      // Mockear matchMedia para prefers-reduced-motion: reduce
      vi.spyOn(window, "matchMedia").mockImplementation((query: string) => {
        return {
          matches: query.includes("prefers-reduced-motion"),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        } as unknown as MediaQueryList;
      });

      const controller = new CharacterMorphController(450);
      const updates: MorphTarget[] = [];
      const onComplete = vi.fn();

      controller.start(
        targetA,
        targetB,
        (current) => updates.push(current),
        onComplete
      );

      // Debe completarse de inmediato sin iniciar bucle activo
      expect(controller.isActive()).toBe(false);
      expect(onComplete).toHaveBeenCalled();
      expect(updates).toHaveLength(1);
      expect(updates[0]).toEqual(targetB);
    });

    it("cancel debe detener inmediatamente cualquier animación en curso", () => {
      const cancelSpy = vi.spyOn(window, "cancelAnimationFrame");
      const controller = new CharacterMorphController(450);

      vi.spyOn(window, "requestAnimationFrame").mockReturnValue(999);

      controller.start(targetA, targetB);
      expect(controller.isActive()).toBe(true);

      controller.cancel();
      expect(controller.isActive()).toBe(false);
      expect(cancelSpy).toHaveBeenCalledWith(999);
    });
  });
});
