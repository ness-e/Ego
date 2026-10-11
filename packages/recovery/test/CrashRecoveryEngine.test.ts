import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { CrashRecoveryEngine } from "../src/CrashRecoveryEngine.js";

describe("CrashRecoveryEngine (REC-01)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ego-recovery-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // noop
    }
  });

  it("debe realizar un arranque limpio y escribir ego.lock cuando no existe bloqueo previo", async () => {
    const engine = new CrashRecoveryEngine({ storageDir: tmpDir });
    const report = await engine.checkAndAcquireLock("test-session-1");

    expect(report.wasDirty).toBe(false);
    expect(report.recoveryAction).toBe("clean_start");

    const lockPath = path.join(tmpDir, "ego.lock");
    expect(fs.existsSync(lockPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    expect(content.pid).toBe(process.pid);
    expect(content.sessionId).toBe("test-session-1");

    engine.releaseLock();
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it("debe detectar Dirty Shutdown si existe un lockfile previo con PID muerto", async () => {
    const lockPath = path.join(tmpDir, "ego.lock");
    const deadPidRecord = {
      pid: 99999999, // PID inexistente
      sessionId: "previous-crashed-session",
      startedAt: Date.now() - 60000,
      lastHeartbeat: Date.now() - 50000,
      version: "0.1.0",
    };
    fs.writeFileSync(lockPath, JSON.stringify(deadPidRecord), "utf8");

    const engine = new CrashRecoveryEngine({ storageDir: tmpDir });
    const report = await engine.checkAndAcquireLock("new-recovery-session");

    expect(report.wasDirty).toBe(true);
    expect(report.recoveryAction).toBe("stale_lock_purged");
    expect(report.previousPid).toBe(99999999);
    expect(report.previousSessionId).toBe("previous-crashed-session");

    engine.releaseLock();
  });

  it("debe detectar Dirty Shutdown si el heartbeat del lockfile expiró", async () => {
    const lockPath = path.join(tmpDir, "ego.lock");
    const staleRecord = {
      pid: process.pid,
      sessionId: "previous-session",
      startedAt: Date.now() - 30000,
      lastHeartbeat: Date.now() - 25000, // 25s atrás (> 10s staleThreshold)
      version: "0.1.0",
    };
    fs.writeFileSync(lockPath, JSON.stringify(staleRecord), "utf8");

    const engine = new CrashRecoveryEngine({
      storageDir: tmpDir,
      staleThresholdMs: 5000,
    });
    const report = await engine.checkAndAcquireLock("fresh-session");

    expect(report.wasDirty).toBe(true);
    expect(report.recoveryAction).toBe("stale_lock_purged");

    engine.releaseLock();
  });
});
