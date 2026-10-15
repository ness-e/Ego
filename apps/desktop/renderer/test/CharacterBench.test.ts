import { describe, it, expect, vi, afterEach } from "vitest";
import { CharacterEngine } from "../components/character/core/CharacterEngine.js";

// CHAR-11: bench CPU/memoria + golden frames del motor (documentado).
//
// Método: happy-dom no implementa Canvas2D, así que el bench cubre la ruta
// lógica por frame (`update()` + tweens + partículas), que es la que escala
// con fps y la que el `CharacterMotionGuard` estrangula (60→15 fps). El
// `draw()` es Canvas2D nativo sin asignaciones por frame salvo Path2D local
// (ver `CharacterEngine.draw`: sin `new` retenido, sin listeners).
//
// Números medidos (Windows x64, Node 22, vitest):
// - `update(1/60)` × 20 000: ~30-60 ms (budget CI: 3000 ms) → ~1.5-3 µs/frame
// - Memoria: partículas purgadas a 0 tras expirar; en régimen (10/frame @60fps,
//   vida máx 1.3 s) vivas <= 800, sin crecimiento monótono.
// - Golden: vector de estado tras secuencia determinista (tiempo y azar
//   mockeados). Si cambia el motor, este test lo señala: actualizar GOLDEN
//   solo con justificación en el commit.
//
// Presupuesto §15 (`docs/architecture/character-system.md`): idle <= 1.0 % CPU,
// anim <= 2.5 % @60 fps. A 60 fps el budget por frame es 16.6 ms; el costo
// lógico medido por frame (línea update ×1) está >100× por debajo.

const GOLDEN: number[] = [
  0.29986, -0.199907, 0, 1, 1, 1, 0, 0, 0.72, 0, 0, 1, 1, 0, 0, 0,
];

function stateVector(eng: CharacterEngine): number[] {
  const pick = (v: number) => Math.round(v * 1e6) / 1e6;
  return [
    eng.yaw, eng.pitch, eng.tilt, eng.open, eng.sx, eng.sy,
    eng.oy, eng.ox, eng.tint, eng.morph, eng.blush, eng.es,
    eng.badgeS, eng.triangleMorph, eng.slotH, eng.hands,
  ].map(pick);
}

describe("CHAR-11: bench y golden frames del CharacterEngine", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("bench: 20 000 update() dentro del budget CPU", () => {
    const eng = new CharacterEngine();
    eng.setState("working");
    eng.lookAt(0.3, -0.2);
    eng.emit("spark", 20);
    const t0 = performance.now();
    for (let i = 0; i < 20_000; i++) {
      eng.update(1 / 60);
    }
    const elapsedMs = performance.now() - t0;
    console.log(`BENCH update×20000: ${elapsedMs.toFixed(1)} ms (budget 3000 ms)`);
    expect(elapsedMs).toBeLessThan(3000);
  });

  it("memoria: partículas en régimen acotadas y purgadas tras expirar", () => {
    const eng = new CharacterEngine();
    const internals = eng as unknown as { particles: { age: number; life: number }[] };
    for (let frame = 0; frame < 120; frame++) {
      eng.emit("spark", 10);
      eng.update(1 / 60);
    }
    expect(internals.particles.length).toBeLessThanOrEqual(800);
    eng.update(5);
    expect(internals.particles).toHaveLength(0);
  });

  it("golden: secuencia determinista produce el vector comprometido", () => {
    let nowMs = 10_000_000;
    vi.spyOn(performance, "now").mockImplementation(() => nowMs);
    const randoms = [0.1, 0.5, 0.9, 0.3, 0.7, 0.2, 0.8, 0.4, 0.6, 0.15];
    let ri = 0;
    vi.spyOn(Math, "random").mockImplementation(() => randoms[ri++ % randoms.length] ?? 0.5);

    const eng = new CharacterEngine();
    eng.setState("working");
    eng.lookAt(0.3, -0.2);
    eng.setShape("coucou-mochi");
    for (let i = 0; i < 60; i++) {
      nowMs += 16;
      eng.update(1 / 60);
    }
    const vector = stateVector(eng);
    if (GOLDEN.length === 0) {
      console.log(`GOLDEN_VECTOR=${JSON.stringify(vector)}`);
    }
    expect(vector).toEqual(GOLDEN);
  });
});
