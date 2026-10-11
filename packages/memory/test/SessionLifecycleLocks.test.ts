import { describe, it, expect } from "vitest";
import { SessionLifecycleLocks } from "../SessionLifecycleLocks.js";

describe("SessionLifecycleLocks Suite (OCLW-05)", () => {
  it("debe ejecutar operaciones concurrentes sobre la misma sesión de manera estrictamente serial", async () => {
    const locks = new SessionLifecycleLocks();
    const order: number[] = [];

    const task1 = locks.runExclusive("session-1", async () => {
      await new Promise((r) => setTimeout(r, 40));
      order.push(1);
      return "res-1";
    });

    const task2 = locks.runExclusive("session-1", async () => {
      order.push(2);
      return "res-2";
    });

    const [res1, res2] = await Promise.all([task1, task2]);

    expect(res1).toBe("res-1");
    expect(res2).toBe("res-2");
    expect(order).toEqual([1, 2]);
  });

  it("debe permitir concurrencia paralela entre sesiones distintas", async () => {
    const locks = new SessionLifecycleLocks();
    const startedAt = Date.now();

    const taskA = locks.runExclusive("session-A", async () => {
      await new Promise((r) => setTimeout(r, 40));
      return "A";
    });

    const taskB = locks.runExclusive("session-B", async () => {
      await new Promise((r) => setTimeout(r, 40));
      return "B";
    });

    const [a, b] = await Promise.all([taskA, taskB]);
    const duration = Date.now() - startedAt;

    expect(a).toBe("A");
    expect(b).toBe("B");
    expect(duration).toBeLessThan(75); // Ambas corrieron en paralelo (~40ms)
  });

  it("debe soportar reentrancia sin provocar deadlocks", async () => {
    const locks = new SessionLifecycleLocks();

    const result = await locks.runExclusive("session-reentrant", async () => {
      // Llamada interna para la misma sesión dentro de la misma cadena asíncrona
      const inner = await locks.runExclusive("session-reentrant", async () => {
        return "deep-success";
      });
      return `outer-${inner}`;
    });

    expect(result).toBe("outer-deep-success");
  });
});
