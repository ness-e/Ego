import { describe, it, expect, beforeEach } from "vitest";
import { SyntheticRuntime } from "../src/SyntheticRuntime.js";
import { EventBus } from "@ego/events";

describe("COUC-14: SyntheticRuntime & DemoEngine", () => {
  let eventBus: EventBus;
  let runtime: SyntheticRuntime;

  beforeEach(() => {
    eventBus = new EventBus();
    runtime = new SyntheticRuntime(eventBus);
  });

  it("ejecuta un tour simulado determinista emitiendo eventos canónicos con token RunEpoch", async () => {
    const eventsReceived: string[] = [];

    eventBus.onAny((evt) => {
      eventsReceived.push(evt.type);
    });

    await runtime.startTour({ speedMultiplier: 10, autoResolveApprovals: true });

    expect(eventsReceived).toContain("task.started");
    expect(eventsReceived).toContain("tool.started");
    expect(eventsReceived).toContain("tool.executed");
    expect(eventsReceived).toContain("approval.required");
    expect(eventsReceived).toContain("approval.resolved");
    expect(eventsReceived).toContain("task.completed");
    expect(runtime.isSimulating()).toBe(false);
  });

  it("detiene la simulación e invalida epoch tokens pendientes al invocar stop()", async () => {
    const eventsReceived: string[] = [];
    eventBus.onAny((evt) => eventsReceived.push(evt.type));

    // Iniciar con velocidad lenta
    const tourPromise = runtime.startTour({ speedMultiplier: 0.1 });
    expect(runtime.isSimulating()).toBe(true);
    const initialEpoch = runtime.currentEpoch();

    // Detener inmediatamente
    runtime.stop();
    expect(runtime.isSimulating()).toBe(false);
    expect(runtime.currentEpoch()).toBe("");

    await tourPromise;
    // No debe haber completado la tarea porque la época quedó invalidada
    expect(eventsReceived).not.toContain("task.completed");
  });

  it("emite escenarios puntuales de forma sincrónica para tests o validación de UI", async () => {
    const events: string[] = [];
    eventBus.onAny((evt) => events.push(evt.type));

    runtime.emitScenario("basic_refactor", "run_scen_1");
    await new Promise((r) => setTimeout(r, 10));
    expect(events).toEqual(["task.started", "tool.started", "tool.executed", "task.completed"]);
  });
});
