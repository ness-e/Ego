import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { ProactivityEngine } from "../src/ProactivityEngine.js";

/**
 * EGO-FIND-51 (Ola 1 / A3 / T2) — Proactividad con triggers reales.
 *
 * `ProactivityEngine` se instanciaba en `main.ts:3175` pero NO tenía ni un
 * `registerCronTrigger`/`registerWatchTrigger` en `apps/desktop/src`: ni cron
 * ni file-watch disparaban nada. Además `triggerFileChange` era una API
 * manual (nadie la llamaba) y `stopAll()` no cerraba ningún watcher.
 *
 * Este test fija el contrato: el motor debe observar el filesystem de verdad
 * (`fs.watch`), enrutar los cambios al trigger que casa con el patrón,
 * respectar el debounce, y cerrar todos los listeners al parar.
 */

describe("T2 — Proactividad: triggers reales (EGO-FIND-51)", () => {
  let tmpDir: string;
  let engine: ProactivityEngine;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ego-proactivity-"));
    engine = new ProactivityEngine();
  });

  afterEach(() => {
    engine.stopAll();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Espera determinista: sondea hasta que la condición se cumple.
   *
   * Un `sleep` fijo es una fuente de flakiness bajo carga (la entrega de
   * eventos de `fs.watch` puede retrasarse más de lo previsto). Con el
   * sondeo, el test espera lo que haga falta y además fija un **margen de
   * quietud** para comprobar que el debounce realmente agrupó.
   */
  async function waitUntil(
    condition: () => boolean,
    timeoutMs = 5000,
    pollMs = 20
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (condition()) return;
      await wait(pollMs);
    }
    throw new Error(
      `waitUntil: la condición no se cumplió en ${timeoutMs}ms (last check: ${condition()})`
    );
  }

  it("`startWatching` dispara el trigger cuando un archivo casa con el patrón", async () => {
    const handler = vi.fn();
    engine.registerWatchTrigger(
      {
        id: "w1",
        subEgoId: "ego.dev",
        pattern: "*.txt",
        debounceMs: 20,
        enabled: true,
      },
      handler
    );

    await engine.startWatching(tmpDir);
    expect(engine.isWatching()).toBe(true);

    fs.writeFileSync(path.join(tmpDir, "notas.txt"), "hola", "utf8");
    await waitUntil(() => handler.mock.calls.length > 0);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(String(handler.mock.calls[0]?.[0])).toContain("notas.txt");
  });

  it("el debounce agrupa ráfagas de cambios en una sola invocación", async () => {
    const handler = vi.fn();
    const DEBOUNCE_MS = 400;
    engine.registerWatchTrigger(
      {
        id: "w1",
        subEgoId: "ego.dev",
        pattern: "*.txt",
        debounceMs: DEBOUNCE_MS,
        enabled: true,
      },
      handler
    );

    await engine.startWatching(tmpDir);

    // Las 5 escrituras son SÍNCRONAS: caen en la misma ventana de debounce
    // aunque la entrega de eventos se retrase.
    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(path.join(tmpDir, "notas.txt"), `v${i}`, "utf8");
    }

    await waitUntil(() => handler.mock.calls.length > 0);
    // Margen de quietud: si el debounce agrupase mal, aparecería una 2ª llamada.
    await wait(DEBOUNCE_MS + 300);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("un trigger desactivado no se dispara", async () => {
    const handler = vi.fn();
    engine.registerWatchTrigger(
      {
        id: "w1",
        subEgoId: "ego.dev",
        pattern: "*.txt",
        debounceMs: 20,
        enabled: false,
      },
      handler
    );

    await engine.startWatching(tmpDir);
    fs.writeFileSync(path.join(tmpDir, "notas.txt"), "hola", "utf8");
    await wait(220);

    expect(handler).not.toHaveBeenCalled();
  });

  it("`stopAll` cierra el watcher: tras parar, no llegan más eventos", async () => {
    const handler = vi.fn();
    engine.registerWatchTrigger(
      {
        id: "w1",
        subEgoId: "ego.dev",
        pattern: "*.txt",
        debounceMs: 20,
        enabled: true,
      },
      handler
    );

    await engine.startWatching(tmpDir);
    engine.stopAll();
    expect(engine.isWatching()).toBe(false);

    fs.writeFileSync(path.join(tmpDir, "notas.txt"), "hola", "utf8");
    await wait(220);

    expect(handler).not.toHaveBeenCalled();
  });

  it("`startCronScheduler` dispara los triggers cron cuya expresión casa", async () => {
    const handler = vi.fn();
    engine.registerCronTrigger(
      {
        id: "c1",
        subEgoId: "ego.dev",
        cronExpression: "* * * * *",
        taskTitle: "Tarea cada minuto",
        enabled: true,
      },
      handler
    );

    engine.startCronScheduler({ intervalMs: 30 });
    expect(engine.isCronSchedulerRunning()).toBe(true);

    await wait(150);

    expect(handler).toHaveBeenCalled();
    engine.stopAll();
    expect(engine.isCronSchedulerRunning()).toBe(false);
  });

  it("el scheduler NO dispara triggers cron desactivados", async () => {
    const handler = vi.fn();
    engine.registerCronTrigger(
      {
        id: "c1",
        subEgoId: "ego.dev",
        cronExpression: "* * * * *",
        taskTitle: "Tarea",
        enabled: false,
      },
      handler
    );

    engine.startCronScheduler({ intervalMs: 30 });
    await wait(150);

    expect(handler).not.toHaveBeenCalled();
  });

  it("la policy de aprobación bloquea el disparo del file-watch (fail-closed)", async () => {
    const handler = vi.fn();
    const onApprovalRequired = vi.fn();

    const gated = new ProactivityEngine({
      approvalPolicy: {
        requiresApproval: async () => true,
        onApprovalRequired,
      },
    });

    gated.registerWatchTrigger(
      {
        id: "w1",
        subEgoId: "ego.dev",
        pattern: "*.txt",
        debounceMs: 20,
        enabled: true,
      },
      handler
    );

    await gated.startWatching(tmpDir);
    fs.writeFileSync(path.join(tmpDir, "notas.txt"), "hola", "utf8");
    await wait(220);

    expect(handler).not.toHaveBeenCalled();
    expect(onApprovalRequired).toHaveBeenCalled();
    gated.stopAll();
  });

  it("`startWatching` sobre un directorio inexistente no lanza (degrada)", async () => {
    const missing = path.join(tmpDir, "no-existe");
    await expect(engine.startWatching(missing)).resolves.toBe(false);
    expect(engine.isWatching()).toBe(false);
  });
});
