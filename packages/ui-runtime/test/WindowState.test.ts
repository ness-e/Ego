import { describe, it, expect } from "vitest";
import {
  WindowStateHelper,
  MIN_WINDOW_WIDTH,
  MIN_WINDOW_HEIGHT,
  DisplayInfo,
} from "../src/WindowState.js";

describe("HERM-08: WindowStateHelper (Pure geometry & multi-monitor state)", () => {
  const displays: DisplayInfo[] = [
    {
      id: 1,
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    },
    {
      id: 2,
      workArea: { x: 1920, y: 0, width: 1920, height: 1040 },
    },
  ];

  it("sanitize limpia datos corruptos, aplica dimensiones mínimas y redondea", () => {
    expect(WindowStateHelper.sanitize(null)).toBeNull();
    expect(WindowStateHelper.sanitize({ width: "invalid", height: 100 })).toBeNull();

    const clean = WindowStateHelper.sanitize({
      width: 100, // Menor que MIN_WINDOW_WIDTH
      height: 200, // Menor que MIN_WINDOW_HEIGHT
      x: 150.8,
      y: 200.2,
      isMaximized: true,
    });

    expect(clean).toBeDefined();
    expect(clean!.width).toBe(MIN_WINDOW_WIDTH);
    expect(clean!.height).toBe(MIN_WINDOW_HEIGHT);
    expect(clean!.x).toBe(151);
    expect(clean!.y).toBe(200);
    expect(clean!.isMaximized).toBe(true);
  });

  it("matchingWorkArea identifica el monitor con mayor solapamiento", () => {
    const area = WindowStateHelper.matchingWorkArea(
      { x: 1950, y: 100, width: 800, height: 600 },
      displays
    );

    expect(area).toBeDefined();
    expect(area!.x).toBe(1920); // Monitor 2
  });

  it("resolveSafeBounds restaura posición en monitor válido", () => {
    const saved = WindowStateHelper.sanitize({
      width: 1000,
      height: 700,
      x: 100,
      y: 100,
      isMaximized: false,
    });

    const bounds = WindowStateHelper.resolveSafeBounds(saved, displays);
    expect(bounds.x).toBe(100);
    expect(bounds.y).toBe(100);
    expect(bounds.width).toBe(1000);
    expect(bounds.height).toBe(700);
  });

  it("resolveSafeBounds recentra la ventana si las coordenadas guardadas corresponden a un monitor desconectado", () => {
    const saved = WindowStateHelper.sanitize({
      width: 1000,
      height: 700,
      x: 5000, // Fuera de todos los monitores
      y: 3000,
      isMaximized: false,
    });

    const singleDisplay: DisplayInfo[] = [
      { workArea: { x: 0, y: 0, width: 1920, height: 1040 } },
    ];

    const bounds = WindowStateHelper.resolveSafeBounds(saved, singleDisplay);
    // Debe haber sido recentrado dentro del monitor principal (0..1920)
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(1920);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(1040);
  });
});
