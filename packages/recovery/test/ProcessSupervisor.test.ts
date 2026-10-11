import { describe, it, expect } from "vitest";
import { ProcessSupervisor } from "../src/ProcessSupervisor.js";

describe("ProcessSupervisor Suite (OCLW-13)", () => {
  it("debe detectar el modo de supervisión del proceso actual", () => {
    const mode = ProcessSupervisor.detectSupervisorMode();
    expect(["electron", "pm2", "systemd", "windows-scheduled-task", "unmanaged"]).toContain(mode);
  });

  it("debe ejecutar hooks de snapshot y handlers de limpieza ante error fatal", async () => {
    let snapshotTaken = false;
    let cleanupExecuted = false;

    const supervisor = new ProcessSupervisor({
      onCrashSnapshot: async () => {
        snapshotTaken = true;
      },
    });

    const unregister = supervisor.registerCleanup(async () => {
      cleanupExecuted = true;
    });

    await supervisor.handleFatalError(new Error("Crash simulado"));

    expect(snapshotTaken).toBe(true);
    expect(cleanupExecuted).toBe(true);

    unregister();
  });
});
