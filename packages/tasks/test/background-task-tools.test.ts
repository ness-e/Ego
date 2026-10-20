import { describe, it, expect, vi } from "vitest";
import {
  BackgroundEngine,
  createBackgroundTaskTool,
  registerBackgroundTaskTools,
} from "../src/index.js";

/**
 * EGO-FIND-50 (Ola 1 / A3 / T6) — `manage_background_task`.
 *
 * El agente no podía lanzar ni governar tareas en background: `BackgroundEngine`
 * era una API in-process sin tool ni IPC.
 */

describe("T6 — manage_background_task (EGO-FIND-50)", () => {
  function makeEngine(): BackgroundEngine {
    return new BackgroundEngine({ maxConcurrent: 2, defaultTimeoutMs: 5000 });
  }

  it("se registra en el ToolRegistry con el nombre canónico", () => {
    const registered: string[] = [];
    const engine = makeEngine();

    registerBackgroundTaskTools(
      {
        register: (tool) => {
          registered.push(tool.name);
        },
        has: (name) => registered.includes(name),
      },
      engine
    );

    expect(registered).toEqual(["manage_background_task"]);
    const tool = createBackgroundTaskTool(engine);
    expect(tool.riskLevel).toBe("sensitive");
    expect(tool.requiresApproval).toBe(true);
    expect(tool.category).toBe("system");
  });

  it("`create` lanza una tarea en background y la ejecuta", async () => {
    const engine = makeEngine();
    const executed = vi.fn(async () => ({ done: true }));
    const tool = createBackgroundTaskTool(engine, { executor: executed });

    const result = (await tool.execute(
      { action: "create", title: "Analizar métricas", description: "lee el dashboard" },
      { callId: "c1", sessionId: "s1" }
    )) as { ok: boolean; task: { id: string; status: string } };

    expect(result.ok).toBe(true);
    expect(result.task.id).toMatch(/^bg_/);

    // El engine la ejecuta de forma asíncrona.
    await new Promise((r) => setTimeout(r, 50));
    expect(executed).toHaveBeenCalledTimes(1);
  });

  it("`create` SIN executor falla con un error explícito (fail-closed)", async () => {
    const engine = makeEngine();
    const tool = createBackgroundTaskTool(engine);

    await expect(
      tool.execute({ action: "create", title: "x" }, { callId: "c2", sessionId: "s1" })
    ).rejects.toThrow(/no hay ejecutor de tareas configurado/i);
  });

  it("`list` enumera las tareas creadas", async () => {
    const engine = makeEngine();
    const tool = createBackgroundTaskTool(engine, { executor: async () => ({}) });

    await tool.execute({ action: "create", title: "T1" }, { callId: "c3", sessionId: "s1" });
    await tool.execute({ action: "create", title: "T2" }, { callId: "c4", sessionId: "s1" });

    const listed = (await tool.execute(
      { action: "list" },
      { callId: "c5", sessionId: "s1" }
    )) as { ok: boolean; tasks: Array<{ title: string }> };

    expect(listed.ok).toBe(true);
    expect(listed.tasks.length).toBe(2);
    expect(listed.tasks.map((t) => t.title).sort()).toEqual(["T1", "T2"]);
  });

  it("`get` devuelve la tarea y `get` de una inexistente no lanza", async () => {
    const engine = makeEngine();
    const tool = createBackgroundTaskTool(engine, { executor: async () => ({}) });

    const created = (await tool.execute(
      { action: "create", title: "T1" },
      { callId: "c6", sessionId: "s1" }
    )) as { task: { id: string } };

    const got = (await tool.execute(
      { action: "get", taskId: created.task.id },
      { callId: "c7", sessionId: "s1" }
    )) as { ok: boolean; task: { title: string } };
    expect(got.ok).toBe(true);
    expect(got.task.title).toBe("T1");

    const missing = (await tool.execute(
      { action: "get", taskId: "no_existe" },
      { callId: "c8", sessionId: "s1" }
    )) as { ok: boolean; message: string };
    expect(missing.ok).toBe(false);
    expect(missing.message).toMatch(/no encontrada/i);
  });

  it("`pause` y `resume` gobiernan el ciclo de vida", async () => {
    const engine = makeEngine();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const tool = createBackgroundTaskTool(engine, {
      executor: async () => {
        await gate;
        return {};
      },
    });

    const created = (await tool.execute(
      { action: "create", title: "Larga" },
      { callId: "c9", sessionId: "s1" }
    )) as { task: { id: string } };
    const taskId = created.task.id;

    await new Promise((r) => setTimeout(r, 20));

    const paused = (await tool.execute(
      { action: "pause", taskId },
      { callId: "c10", sessionId: "s1" }
    )) as { ok: boolean; task: { status: string } };
    expect(paused.ok).toBe(true);
    expect(paused.task.status).toBe("paused");

    const resumed = (await tool.execute(
      { action: "resume", taskId },
      { callId: "c11", sessionId: "s1" }
    )) as { ok: boolean };
    expect(resumed.ok).toBe(true);

    release?.();
    await new Promise((r) => setTimeout(r, 30));
  });

  it("`cancel` cancela una tarea en cola", async () => {
    const engine = new BackgroundEngine({ maxConcurrent: 1, defaultTimeoutMs: 5000 });
    const gate = new Promise<void>(() => {
      // nunca resuelve: mantiene el slot ocupado
    });

    const tool = createBackgroundTaskTool(engine, {
      executor: async () => {
        await gate;
        return {};
      },
    });

    const first = (await tool.execute(
      { action: "create", title: "Bloqueante" },
      { callId: "c12", sessionId: "s1" }
    )) as { task: { id: string } };
    const second = (await tool.execute(
      { action: "create", title: "Encolada" },
      { callId: "c13", sessionId: "s1" }
    )) as { task: { id: string } };

    const cancelled = (await tool.execute(
      { action: "cancel", taskId: second.task.id },
      { callId: "c14", sessionId: "s1" }
    )) as { ok: boolean; task: { status: string } };

    expect(cancelled.ok).toBe(true);
    expect(cancelled.task.status).toBe("cancelled");
    expect(first.task.id).not.toBe(second.task.id);
  });

  it("las acciones que exigen `taskId` fallan con mensaje claro", async () => {
    const engine = makeEngine();
    const tool = createBackgroundTaskTool(engine, { executor: async () => ({}) });

    for (const action of ["get", "cancel", "pause", "resume"] as const) {
      await expect(
        tool.execute({ action }, { callId: "c15", sessionId: "s1" })
      ).rejects.toThrow(/exige 'taskId'/i);
    }
  });
});
