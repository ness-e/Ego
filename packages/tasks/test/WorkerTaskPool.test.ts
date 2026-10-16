import { describe, it, expect, vi } from "vitest";
import { WorkerTaskPool, LocalTaskPool } from "../src/WorkerTaskPool.js";
import { WorkerPolicy } from "../src/WorkerPolicy.js";

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

  it("debe integrar WorkerPolicy en LocalTaskPool para admisión y tracking de salud", async () => {
    const policy = new WorkerPolicy({ maxConcurrent: 2, maxQueue: 5 });
    const pool = new LocalTaskPool(2, policy);

    expect(pool.getPolicy()).toBe(policy);
    expect(policy.isHealthy()).toBe(true);

    // Ejecución exitosa registra éxito en policy
    const res = await pool.submit(async () => 42);
    expect(res).toBe(42);
    expect(policy.consecutiveFailureCount()).toBe(0);

    // Ejecución fallida registra fallo en policy
    await expect(
      pool.submit(async () => {
        throw new Error("task crash");
      })
    ).rejects.toThrow("task crash");
    expect(policy.consecutiveFailureCount()).toBe(1);

    // Tarea rechazada por shouldAdmit
    const rejectingPolicy = new WorkerPolicy();
    vi.spyOn(rejectingPolicy, "shouldAdmit").mockReturnValue(false);
    const rejectingPool = new LocalTaskPool(2, rejectingPolicy);

    await expect(
      rejectingPool.submit(async () => "never runs")
    ).rejects.toThrow(/Task rejected by WorkerPolicy/);

    pool.terminate();
    rejectingPool.terminate();
  });
});
