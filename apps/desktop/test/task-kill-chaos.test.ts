import { describe, it, expect, vi } from "vitest";
import { BackgroundEngine, TaskCheckpointManager } from "@ego/tasks";

describe("T03/R8 — caos: matar una tarea no deja handles abiertos (REC-08)", () => {
  it("cancel() en running limpia abort, contadores y no retiene slots", async () => {
    const engine = new BackgroundEngine({ defaultTimeoutMs: 5000 });
    let aborted = false;

    engine.submit({
      id: "chaos-kill-task",
      title: "Tarea caos",
      metadata: { kind: "indexing" },
      execute: async ({ signal }) => {
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => resolve(), 10_000);
          signal.addEventListener("abort", () => {
            aborted = true;
            clearTimeout(t); // el handler cierra su recurso en el abort
            reject(new Error("aborted"));
          });
        });
      },
    });

    await vi.waitFor(() => {
      expect(engine.getTask("chaos-kill-task")?.status).toBe("running");
    });
    expect(engine.getActiveCount()).toBe(1);

    expect(engine.cancel("chaos-kill-task", "chaos kill")).toBe(true);

    await vi.waitFor(() => {
      const s = engine.getTask("chaos-kill-task")?.status;
      expect(s === "cancelled" || s === "failed").toBe(true);
    });

    expect(aborted).toBe(true);
    expect(engine.getActiveCount()).toBe(0);
    expect(engine.getQueueLength()).toBe(0);
  });

  it("el checkpoint previo al kill queda intacto y permite reanudar", async () => {
    const storage = new Map<string, Array<{ key: string; payload: unknown }>>();
    const mockAdapter: any = {
      put: vi.fn(async (item: { namespace: string; key: string; payload: unknown }) => {
        const items = storage.get(item.namespace) ?? [];
        const idx = items.findIndex((i) => i.key === item.key);
        if (idx >= 0) items[idx] = { key: item.key, payload: item.payload };
        else items.push({ key: item.key, payload: item.payload });
        storage.set(item.namespace, items);
      }),
      list: vi.fn(async (namespace: string) => storage.get(namespace) ?? []),
    };
    const checkpoints = new TaskCheckpointManager(mockAdapter);
    const engine = new BackgroundEngine({
      defaultTimeoutMs: 5000,
      checkpointProvider: {
        saveCheckpoint: async (taskId, state) => {
          await checkpoints.saveCheckpoint(
            taskId,
            typeof state.step === "number" ? state.step : 0,
            "chaos",
            state
          );
        },
        loadLatestCheckpoint: async (taskId) => {
          const cp = await checkpoints.loadLatestCheckpoint(taskId);
          return cp ? cp.state : null;
        },
      },
    });

    engine.submit({
      id: "chaos-checkpoint-task",
      title: "Tarea caos con checkpoint",
      metadata: { kind: "sync" },
      execute: async ({ signal, saveCheckpoint }) => {
        await saveCheckpoint({ step: 3, progress: 30 });
        // Patrón cooperativo documentado (R8): tras cada await, re-observar
        // la señal — un abort que aterriza durante el await no re-dispara
        // listeners registrados tarde (verificado en Node 22: late-listener
        // no fire). El handler DEBE chequear `signal.aborted` explícitamente.
        if (signal.aborted) throw new Error("killed");
        await new Promise<void>((_resolve, reject) => {
          if (signal.aborted) {
            reject(new Error("killed"));
            return;
          }
          signal.addEventListener("abort", () => {
            reject(new Error("killed"));
          });
        });
      },
    });

    await vi.waitFor(() => {
      expect(engine.getTask("chaos-checkpoint-task")?.status).toBe("running");
    });
    expect(engine.cancel("chaos-checkpoint-task", "chaos kill")).toBe(true);

    await vi.waitFor(() => {
      const s = engine.getTask("chaos-checkpoint-task")?.status;
      expect(s === "cancelled" || s === "failed").toBe(true);
    });

    const cp = await checkpoints.loadLatestCheckpoint("chaos-checkpoint-task");
    expect(cp).not.toBeNull();
    expect(cp?.stepIndex).toBe(3);
    expect(cp?.state).toEqual({ step: 3, progress: 30 });
    expect(engine.getActiveCount()).toBe(0);
  });
});
