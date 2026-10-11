import { describe, it, expect } from "vitest";
import { IntervalSet } from "../src/IntervalSet.js";

describe("COUC-12: IntervalSet (Non-overlapping time aggregation)", () => {
  it("fusiona intervalos disjuntos y solapados correctamente", () => {
    const iset = new IntervalSet();
    iset.add(100, 200);
    iset.add(150, 300); // solapa con [100, 200] -> [100, 300]
    iset.add(400, 500); // disjunto

    expect(iset.count()).toBe(2);
    expect(iset.toArray()).toEqual([
      { start: 100, end: 300 },
      { start: 400, end: 500 },
    ]);
  });

  it("calcula totalDurationMs sin contar doblemente sesiones paralelas", () => {
    const iset = new IntervalSet();
    // Sesión A: de 10:00 a 11:00 (60 min = 3,600,000 ms)
    iset.add(0, 3600000);
    // Sesión B paralela: de 10:30 a 11:30 (superpone 30 min y agrega 30 min)
    iset.add(1800000, 5400000);

    // El tiempo total debe ser de 0 a 5400000 ms (90 min), NO 120 min.
    expect(iset.totalDurationMs()).toBe(5400000);
    expect(iset.totalMinutes()).toBe(90);
  });

  it("identifica si un timestamp está contenido en algún intervalo", () => {
    const iset = new IntervalSet([
      { start: 10, end: 20 },
      { start: 30, end: 40 },
    ]);

    expect(iset.contains(15)).toBe(true);
    expect(iset.contains(25)).toBe(false);
    expect(iset.contains(35)).toBe(true);
  });

  it("calcula intersecciones de rangos temporales", () => {
    const iset = new IntervalSet([
      { start: 100, end: 200 },
      { start: 300, end: 400 },
    ]);

    const inter = iset.intersect(150, 350);
    expect(inter).toEqual([
      { start: 150, end: 200 },
      { start: 300, end: 350 },
    ]);
  });

  it("maneja bordes invertidos y descarta intervalos de duración cero", () => {
    const iset = new IntervalSet();
    iset.add(50, 50); // duración cero
    expect(iset.count()).toBe(0);

    iset.add(200, 100); // invertido -> se normaliza a [100, 200]
    expect(iset.count()).toBe(1);
    expect(iset.totalDurationMs()).toBe(100);
  });
});
