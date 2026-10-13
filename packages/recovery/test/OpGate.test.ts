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

  it("reset() rechaza con ops en vuelo en vez de huérfanas (M22)", async () => {
    const gate = new OpGate();
    let release!: () => void;
    const gateBlocker = new Promise<void>((r) => {
      release = r;
    });
    const op = gate.withGate(async () => {
      await gateBlocker;
      return "done";
    });

    expect(() => gate.reset()).toThrow(/en vuelo/);

    release();
    await op;
    // Sin ops en vuelo el reset vuelve a ser válido
    gate.reset();
    expect(gate.getStatus().inFlightCount).toBe(0);
  });

  it("reset() rechaza durante un drain pendiente y lo permite tras drenar", async () => {
    const gate = new OpGate({ drainTimeoutMs: 1000 });
    let release!: () => void;
    const gateBlocker = new Promise<void>((r) => {
      release = r;
    });
    const op = gate.withGate(async () => {
      await gateBlocker;
      return "done";
    });
    const drainPromise = gate.drain();

    // Ambas guardas disparan (ops en vuelo + drain pendiente): lo que importa
    // es que reset() NO silenciosamente rehabilita la compuerta a mitad de drain.
    expect(() => gate.reset()).toThrow(/reset\(\) rechazado/);

    release();
    const drainRes = await Promise.all([drainPromise, op]);
    expect(drainRes[0].drained).toBe(true);

    // Tras drenar limpio, reset() rehabilita la compuerta
    gate.reset();
    expect(gate.getStatus().isDraining).toBe(false);
    await expect(gate.withGate(async () => "ok")).resolves.toBe("ok");
  });
});
