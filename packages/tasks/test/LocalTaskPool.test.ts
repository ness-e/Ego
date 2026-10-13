import { describe, it, expect } from "vitest";
import { LocalTaskPool, WorkerTaskPool } from "../src/WorkerTaskPool.js";

describe("LocalTaskPool (F4T8 H11/H12)", () => {
  it("expone nombre honesto: LocalTaskPool con alias WorkerTaskPool retrocompatible", () => {
    const pool = new LocalTaskPool({ maxWorkers: 1 });
    expect(pool).toBeInstanceOf(LocalTaskPool);
    const legacy = new WorkerTaskPool({ maxWorkers: 1 });
    expect(legacy).toBeInstanceOf(LocalTaskPool);
    pool.terminate();
    legacy.terminate();
  });

  it("el timeout libera el slot sin doble conteo (la resolución tardía se ignora)", async () => {
    const pool = new LocalTaskPool({ maxWorkers: 1, defaultTimeoutMs: 30 });

    await expect(
      pool.execute("lenta", null, async () => {
        await new Promise((r) => setTimeout(r, 150));
        return "tarde";
      })
    ).rejects.toThrow(/Timeout/);

    // El slot quedó libre: la tarea rápida resuelve sin esperar a la lenta.
    const fast = await pool.execute("rapida", 1, async (v) => (v as number) * 2, {
      timeoutMs: 1000,
    });
    expect(fast).toBe(2);

    // Esperar a que la tarea lenta termine en segundo plano: su
    // resolución tardía debe ignorarse (sin doble conteo).
    await new Promise((r) => setTimeout(r, 250));

    const m = pool.getMetrics();
    expect(m.totalFailed).toBe(1);
    expect(m.totalCompleted).toBe(1);
    expect(m.activeWorkers).toBe(0);
    expect(m.queuedTasks).toBe(0);

    pool.terminate();
  });

  it("no bloquea el event loop mientras espera (ejecución cooperativa)", async () => {
    const pool = new LocalTaskPool({ maxWorkers: 1 });
    let ticked = false;
    setTimeout(() => {
      ticked = true;
    }, 10);

    const out = await pool.execute(
      "espera",
      null,
      async () => {
        await new Promise((r) => setTimeout(r, 60));
        return "ok";
      },
      { timeoutMs: 1000 }
    );

    expect(out).toBe("ok");
    expect(ticked).toBe(true);
    pool.terminate();
  });
});
