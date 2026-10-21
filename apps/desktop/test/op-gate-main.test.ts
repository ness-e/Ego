import { describe, it, expect } from "vitest";
import { OpGate, CrashRecoveryEngine } from "@ego/recovery";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createScratchDir, removeScratchDir } from "./helpers/test-scratch.js";

describe("OpGate & CrashRecoveryEngine Desktop Integration (REC-01, REC-02)", () => {
  it("crea y administra la barrera de drenado OpGate en el ciclo de vida", async () => {
    const gate = new OpGate({ drainTimeoutMs: 500 });
    expect(gate.getStatus().isDraining).toBe(false);
    expect(gate.getStatus().inFlightCount).toBe(0);

    let executed = false;
    await gate.withGate(async () => {
      executed = true;
    });

    expect(executed).toBe(true);

    const drainRes = await gate.drain(100);
    expect(drainRes.drained).toBe(true);
    expect(gate.getStatus().isDraining).toBe(true);
  });

  it("administra ego.lock y detecta cierre limpio", async () => {
    const tmpDir = createScratchDir("ego-main-lock");
    try {
      const engine = new CrashRecoveryEngine({ storageDir: tmpDir });
      const report = await engine.checkAndAcquireLock("session_desktop");
      expect(report.wasDirty).toBe(false);
      expect(report.recoveryAction).toBe("clean_start");

      const lockFile = path.join(tmpDir, "ego.lock");
      expect(fs.existsSync(lockFile)).toBe(true);

      engine.releaseLock();
      expect(fs.existsSync(lockFile)).toBe(false);
    } finally {
      removeScratchDir(tmpDir);
    }
  });
});
