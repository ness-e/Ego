import { describe, it, expect } from "vitest";
import {
  IpcPriorityQueue,
  CFG11_OBSOLETE_TTL_MS,
  CFG11_MAX_CONSECUTIVE_NON_BG,
  type IpcPriority,
} from "../src/main/ipc-priority-queue.js";

/**
 * CFG-11 — Cola priorizada IPC (main): críticas > interactivas > background,
 * coalescing de lecturas equivalentes, expiración de obsoletos y fairness
 * (background nunca muere). Módulo puro: sin Electron, sin timers reales
 * (reloj inyectable) — corre sin main process.
 */
function burst(q: IpcPriorityQueue, n: number, p: IpcPriority, now = 0): void {
  for (let i = 0; i < n; i++) {
    q.enqueue({ channel: `ipc.test.${p}`, payload: { i }, priority: p, now });
  }
}

describe("CFG-11: cola priorizada — orden críticas > interactivas > background", () => {
  it("ráfaga background + 1 crítica → la crítica sale primera (<100ms)", () => {
    const q = new IpcPriorityQueue();
    burst(q, 50, "background");
    q.enqueue({ channel: "ipc.chat.error", payload: {}, priority: "critical", now: 0 });
    const t0 = performance.now();
    const first = q.dequeue(1);
    const elapsed = performance.now() - t0;
    expect(first?.channel).toBe("ipc.chat.error");
    expect(elapsed).toBeLessThan(100);
  });

  it("interactivas van tras críticas y antes que background", () => {
    const q = new IpcPriorityQueue();
    q.enqueue({ channel: "bg", payload: {}, priority: "background", now: 0 });
    q.enqueue({ channel: "chat-delta", payload: {}, priority: "interactive", now: 0 });
    q.enqueue({ channel: "crit", payload: {}, priority: "critical", now: 0 });
    expect(q.dequeue(1)?.channel).toBe("crit");
    expect(q.dequeue(1)?.channel).toBe("chat-delta");
    expect(q.dequeue(1)?.channel).toBe("bg");
  });

  it("FIFO dentro del mismo nivel", () => {
    const q = new IpcPriorityQueue();
    burst(q, 3, "interactive");
    const order = [q.dequeue(0)?.payload, q.dequeue(0)?.payload, q.dequeue(0)?.payload].map(
      (p) => (p as { i: number }).i
    );
    expect(order).toEqual([0, 1, 2]);
  });
});

describe("CFG-11: fairness — background nunca muere", () => {
  it("flood de críticas no inaniciona al background", () => {
    const q = new IpcPriorityQueue();
    q.enqueue({ channel: "bg1", payload: {}, priority: "background", now: 0 });
    burst(q, 30, "critical");
    const seen: string[] = [];
    for (let i = 0; i <= CFG11_MAX_CONSECUTIVE_NON_BG; i++) {
      const m = q.dequeue(i);
      if (m) seen.push(m.channel);
    }
    expect(seen).toContain("bg1");
    expect(seen.indexOf("bg1")).toBeLessThanOrEqual(CFG11_MAX_CONSECUTIVE_NON_BG);
  });

  it("background espera como máximo N pops interactivas", () => {
    const q = new IpcPriorityQueue();
    q.enqueue({ channel: "bg1", payload: {}, priority: "background", now: 0 });
    burst(q, 30, "interactive");
    let bgAt = -1;
    for (let i = 0; i < 40; i++) {
      if (q.dequeue(0)?.channel === "bg1") {
        bgAt = i;
        break;
      }
    }
    expect(bgAt).toBeGreaterThanOrEqual(0);
    expect(bgAt).toBeLessThanOrEqual(CFG11_MAX_CONSECUTIVE_NON_BG);
  });
});

describe("CFG-11: coalescing + expiración", () => {
  it("misma coalesceKey reemplaza (último gana, tamaño 1)", () => {
    const q = new IpcPriorityQueue();
    q.enqueue({ channel: "ipc.chat.recall_status", payload: { v: 1 }, priority: "background", coalesceKey: "recall:turn_1", now: 0 });
    q.enqueue({ channel: "ipc.chat.recall_status", payload: { v: 2 }, priority: "background", coalesceKey: "recall:turn_1", now: 10 });
    expect(q.size()).toBe(1);
    expect(q.dequeue(20)?.payload).toEqual({ v: 2 });
    expect(q.stats.coalesced).toBe(1);
  });

  it("claves distintas no coalescen", () => {
    const q = new IpcPriorityQueue();
    q.enqueue({ channel: "a", payload: {}, priority: "background", coalesceKey: "k1", now: 0 });
    q.enqueue({ channel: "a", payload: {}, priority: "background", coalesceKey: "k2", now: 0 });
    expect(q.size()).toBe(2);
  });

  it("obsoleto más allá del TTL se descarta (default 5s)", () => {
    expect(CFG11_OBSOLETE_TTL_MS).toBe(5000);
    const q = new IpcPriorityQueue();
    q.enqueue({ channel: "stale", payload: {}, priority: "background", now: 0 });
    expect(q.dequeue(CFG11_OBSOLETE_TTL_MS + 1)).toBeNull();
    expect(q.stats.expired).toBe(1);
    expect(q.size()).toBe(0);
  });

  it("dentro del TTL no expira", () => {
    const q = new IpcPriorityQueue();
    q.enqueue({ channel: "fresh", payload: {}, priority: "background", now: 1000 });
    expect(q.dequeue(1000 + CFG11_OBSOLETE_TTL_MS - 1)?.channel).toBe("fresh");
  });
});
