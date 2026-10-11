import { describe, it, expect } from "vitest";
import { OpGate } from "../src/OpGate.js";

describe("OpGate (REC-02)", () => {
  it("permite operaciones concurrentes cuando la compuerta no está en drenado", async () => {
    const gate = new OpGate();
    let counter = 0;

    const op1 = gate.withGate(async () => {
      await new Promise((r) => setTimeout(r, 20));
      counter += 1;
      return "op1";
    });

    const op2 = gate.withGate(async () => {
      await new Promise((r) => setTimeout(r, 10));
      counter += 2;
      return "op2";
    });

    const results = await Promise.all([op1, op2]);
    expect(results).toEqual(["op1", "op2"]);
    expect(counter).toBe(3);
    expect(gate.getStatus().inFlightCount).toBe(0);
  });

  it("espera a que las operaciones en vuelo terminen antes de resolver drain()", async () => {
    const gate = new OpGate({ drainTimeoutMs: 1000 });
    let completed = false;

    // Lanzar operación lenta
    const slowOp = gate.withGate(async () => {
      await new Promise((r) => setTimeout(r, 50));
      completed = true;
      return "done";
    });

    // Iniciar drenado
    const drainPromise = gate.drain();

    // Intentar lanzar nueva operación debe fallar de inmediato
    await expect(
      gate.withGate(async () => "blocked")
    ).rejects.toThrow("Draining");

    const [drainRes, slowRes] = await Promise.all([drainPromise, slowOp]);
    expect(drainRes.drained).toBe(true);
    expect(drainRes.remaining).toBe(0);
    expect(slowRes).toBe("done");
    expect(completed).toBe(true);
  });
});
