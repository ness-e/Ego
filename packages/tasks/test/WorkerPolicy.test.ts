import { describe, expect, it } from "vitest";
import { WorkerPolicy } from "../src/WorkerPolicy.js";

describe("STAB-14: WorkerPolicy (priority/budget/backoff/health)", () => {
  it("ordena por prioridad desc y antigüedad asc", () => {
    const p = new WorkerPolicy();
    const out = p.sortByPriority([
      { id: "a", priority: 10, createdAt: 3 },
      { id: "b", priority: 50, createdAt: 2 },
      { id: "c", priority: 50, createdAt: 1 },
    ]);
    expect(out.map((t) => t.id)).toEqual(["c", "b", "a"]);
  });

  it("budget: admite con hueco, rechaza cola o concurrencia llena", () => {
    const p = new WorkerPolicy({ maxQueue: 2, maxConcurrent: 1 });
    expect(p.shouldAdmit(0, 0)).toBe(true);
    expect(p.shouldAdmit(2, 0)).toBe(false);
    expect(p.shouldAdmit(0, 1)).toBe(false);
    expect(p.shouldAdmit(-1, 0)).toBe(false);
  });

  it("backoff exponencial con techo determinista", () => {
    const p = new WorkerPolicy({ backoffBaseMs: 100, backoffCapMs: 500 });
    expect([0, 1, 2, 3, 4, 10].map((a) => p.nextDelay(a))).toEqual([100, 200, 400, 500, 500, 500]);
  });

  it("salud: degrada tras N fallos y recupera con 1 éxito", () => {
    const p = new WorkerPolicy({ maxConsecutiveFailures: 3 });
    expect(p.isHealthy()).toBe(true);
    p.recordFailure();
    p.recordFailure();
    expect(p.isHealthy()).toBe(true);
    p.recordFailure();
    expect(p.isHealthy()).toBe(false);
    expect(p.consecutiveFailureCount()).toBe(3);
    p.recordSuccess();
    expect(p.isHealthy()).toBe(true);
  });
});
