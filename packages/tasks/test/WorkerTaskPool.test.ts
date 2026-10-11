import { describe, it, expect } from "vitest";
import { WorkerTaskPool } from "../src/WorkerTaskPool.js";

describe("WorkerTaskPool Suite (OCLW-10)", () => {
  it("debe ejecutar tareas concurrentes respetando el límite de maxWorkers", async () => {
    const pool = new WorkerTaskPool({ maxWorkers: 2 });

    const results = await Promise.all([
      pool.execute("tarea-1", 10, async (val) => val * 2),
      pool.execute("tarea-2", 20, async (val) => val * 3),
      pool.execute("tarea-3", 30, async (val) => val * 4),
    ]);

    expect(results).toEqual([20, 60, 120]);

    const metrics = pool.getMetrics();
    expect(metrics.totalCompleted).toBe(3);
    expect(metrics.totalFailed).toBe(0);
    expect(metrics.activeWorkers).toBe(0);

    pool.terminate();
  });

  it("debe abortar tareas que excedan el timeout configurado", async () => {
    const pool = new WorkerTaskPool({ maxWorkers: 2, defaultTimeoutMs: 50 });

    await expect(
      pool.execute(
        "tarea-lenta",
        null,
        async () => {
          await new Promise((r) => setTimeout(r, 120));
          return "tarde";
        },
        { timeoutMs: 40 }
      )
    ).rejects.toThrow(/Timeout de 40ms excedido/);

    pool.terminate();
  });
});
