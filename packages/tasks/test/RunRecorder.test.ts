import { describe, it, expect, vi, beforeEach } from "vitest";
import { RunRecorder } from "../src/RunRecorder.js";
import { EventBus } from "@ego/events";

describe("COUC-09: RunRecorder (RunSnapshot assembly & VantaDB persistence)", () => {
  let mockMemoryAdapter: any;
  let eventBus: EventBus;
  let recorder: RunRecorder;
  const storeMap = new Map<string, any>();

  beforeEach(() => {
    storeMap.clear();
    mockMemoryAdapter = {
      put: vi.fn(async (item: { namespace: string; key: string; payload: unknown }) => {
        storeMap.set(`${item.namespace}/${item.key}`, item.payload);
      }),
      get: vi.fn(async (namespace: string, key: string) => {
        return { payload: storeMap.get(`${namespace}/${key}`) ?? null };
      }),
    };
    eventBus = new EventBus();
    recorder = new RunRecorder(mockMemoryAdapter, eventBus);
  });

  it("registra manualmente acciones y persiste el RunSnapshot en VantaDB al finalizar", async () => {
    recorder.startRun({
      runId: "run_manual_1",
      projectId: "proj_alpha",
      sessionId: "session_42",
      goal: "Refactorizar autenticación",
    });

    recorder.recordToolStart("run_manual_1", "fs_read_file", "call_1", { path: "auth.ts" });
    recorder.recordToolSuccess("run_manual_1", "call_1", "export class Auth {}", 35);

    recorder.recordToolStart("run_manual_1", "git_status", "call_2");
    recorder.recordToolFailure("run_manual_1", "call_2", "No git repository found", 12);

    const snapshot = await recorder.finishRun("run_manual_1", {
      status: "completed",
      finalMessage: "Autenticación refactorizada exitosamente.",
    });

    expect(snapshot).toBeDefined();
    expect(snapshot!.status).toBe("completed");
    expect(snapshot!.actions.length).toBe(2);
    expect(snapshot!.actions[0].status).toBe("success");
    expect(snapshot!.actions[1].status).toBe("failed");
    expect(snapshot!.durationMs).toBeGreaterThanOrEqual(0);

    // Verificar que se invocó put en el adaptador de memoria con la ruta projects/proj_alpha/runs
    expect(mockMemoryAdapter.put).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: "projects/proj_alpha/runs",
        key: "run_manual_1",
      })
    );

    // Recuperar corrida persistida
    const loaded = await recorder.loadPersistedRun("proj_alpha", "run_manual_1");
    expect(loaded).toBeDefined();
    expect(loaded!.runId).toBe("run_manual_1");
    expect(loaded!.finalMessage).toBe("Autenticación refactorizada exitosamente.");
  });

  it("reconstruye el snapshot consumiendo eventos canónicos del EventBus automáticamente", async () => {
    // 1. Iniciar tarea
    eventBus.emit("task.started", { taskId: "run_auto_99", startedAt: Date.now() }, { source: "test" });

    // 2. Herramienta ejecutada
    eventBus.emit(
      "tool.started",
      { callId: "c_1", toolName: "terminal_exec", input: { command: "ls" } },
      { source: "test", sessionId: "run_auto_99" }
    );
    eventBus.emit(
      "tool.executed",
      { callId: "c_1", toolName: "terminal_exec", durationMs: 40, result: "package.json" },
      { source: "test", sessionId: "run_auto_99" }
    );

    // 3. Finalizar tarea
    eventBus.emit(
      "task.completed",
      { taskId: "run_auto_99", durationMs: 100, result: "Listado completado" },
      { source: "test", sessionId: "run_auto_99" }
    );

    // Pequeño delay para microtareas del EventBus
    await new Promise((r) => setTimeout(r, 20));

    const snapshot = recorder.getSnapshot("run_auto_99");
    expect(snapshot).toBeDefined();
    expect(snapshot!.actions.length).toBe(1);
    expect(snapshot!.actions[0].toolName).toBe("terminal_exec");
    expect(snapshot!.actions[0].status).toBe("success");
  });

  it("elimina el snapshot de activeRuns tras persistir sin perder historial (F4T8 H14)", async () => {
    recorder.startRun({ runId: "run_gc_1", projectId: "proj_alpha", goal: "g" });
    expect(recorder.getActiveRun("run_gc_1")).toBeDefined();
    expect(recorder.activeRunCount()).toBe(1);

    await recorder.finishRun("run_gc_1", {
      status: "completed",
      finalMessage: "ok",
    });

    // Sin fuga: ya no figura como activa...
    expect(recorder.getActiveRun("run_gc_1")).toBeUndefined();
    expect(recorder.activeRunCount()).toBe(0);
    // ...pero el historial acotado sigue disponible y lo persistido intacto.
    expect(recorder.getSnapshot("run_gc_1")?.status).toBe("completed");
    const loaded = await recorder.loadPersistedRun("proj_alpha", "run_gc_1");
    expect(loaded?.runId).toBe("run_gc_1");
  });
});
