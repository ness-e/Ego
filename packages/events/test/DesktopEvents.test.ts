import { describe, it, expect } from "vitest";
import { EventBus } from "../src/EventBus.js";

/**
 * HIG-03-F1 — Los 4 eventos legacy del desktop deben ser canónicos:
 * `subego.registered`, `subego.state_changed`, `project.switched`,
 * `settings.model_updated` (mismo patrón que `daily.decision.recorded`).
 */
describe("@ego/events — Desktop canonical events (HIG-03-F1)", () => {
  it("emite y recibe subego.registered con payload canónico", async () => {
    const bus = new EventBus();
    const received: unknown[] = [];

    bus.on("subego.registered", (event) => {
      received.push(event);
    });

    bus.emit(
      "subego.registered",
      { subEgoId: "ego.tester", name: "Tester", role: "QA", createdAt: Date.now() },
      { source: "test" }
    );

    await new Promise((r) => setTimeout(r, 20));
    expect(received).toHaveLength(1);
  });

  it("emite y recibe subego.state_changed con payload canónico", async () => {
    const bus = new EventBus();
    const received: unknown[] = [];

    bus.on("subego.state_changed", (event) => {
      received.push(event);
    });

    bus.emit(
      "subego.state_changed",
      { subEgoId: "ego.tester", state: "paused", timestamp: Date.now() },
      { source: "test" }
    );

    await new Promise((r) => setTimeout(r, 20));
    expect(received).toHaveLength(1);
  });

  it("emite y recibe project.switched con payload canónico", async () => {
    const bus = new EventBus();
    const received: unknown[] = [];

    bus.on("project.switched", (event) => {
      received.push(event);
    });

    bus.emit(
      "project.switched",
      { projectId: "default", timestamp: Date.now() },
      { source: "test" }
    );

    await new Promise((r) => setTimeout(r, 20));
    expect(received).toHaveLength(1);
  });

  it("emite y recibe settings.model_updated con payload canónico", async () => {
    const bus = new EventBus();
    const received: unknown[] = [];

    bus.on("settings.model_updated", (event) => {
      received.push(event);
    });

    bus.emit(
      "settings.model_updated",
      { activeProvider: "mock", timestamp: Date.now() },
      { source: "test" }
    );

    await new Promise((r) => setTimeout(r, 20));
    expect(received).toHaveLength(1);
  });
});
