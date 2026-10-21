import { createTempWorkspace } from "@ego/tools";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { CrashRecoveryEngine } from "../src/CrashRecoveryEngine.js";

/**
 * EGO-FIND-66 (Ola 1 / A3 / T11) — Escritura atómica del lockfile.
 *
 * El heartbeat ya era atómico (tmp + fsync + rename, commit `b411524`), pero
 * la escritura INICIAL del lock (`writeLockFile`) seguía con `writeFileSync`:
 * un kill en ese instante dejaba `ego.lock` truncado, que se reinterpretaba
 * como "contenido corrupto" y provocaba el flake "Unexpected end of JSON
 * input" del test de caos `hard-kill.test.ts`.
 *
 * La escritura inicial debe usar la MISMA secuencia: tmp + fsync + rename.
 */
describe("T11 — Escritura atómica del lockfile (EGO-FIND-66)", () => {
  let tmpDir: string;
  let lockFilePath: string;

  beforeEach(() => {
    tmpDir = createTempWorkspace({ prefix: "ego-atomic-lock-" }).path;
    lockFilePath = path.join(tmpDir, "ego.lock");
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("el lockfile queda siempre como JSON válido tras adquirir el lock", async () => {
    const engine = new CrashRecoveryEngine({ storageDir: tmpDir });
    await engine.checkAndAcquireLock("sesion-1");

    const raw = fs.readFileSync(lockFilePath, "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
    expect(JSON.parse(raw).sessionId).toBe("sesion-1");
    engine.releaseLock();
  });

  it("no deja temporales residuales tras la escritura", async () => {
    const engine = new CrashRecoveryEngine({ storageDir: tmpDir });
    await engine.checkAndAcquireLock("sesion-2");

    const leftovers = fs
      .readdirSync(tmpDir)
      .filter((f) => f.includes("ego.lock") && f !== "ego.lock");
    expect(leftovers).toEqual([]);
    engine.releaseLock();
  });

  it("usa rename atómico (publica el temporal con `rename`)", async () => {
    const renameSpy = vi.spyOn(fs.promises, "rename");
    const engine = new CrashRecoveryEngine({ storageDir: tmpDir });

    await engine.checkAndAcquireLock("sesion-3");

    const renamedLock = renameSpy.mock.calls.some(
      (call) => typeof call[0] === "string" && call[0].includes("ego.lock") && call[1] === lockFilePath
    );
    expect(renamedLock).toBe(true);
    renameSpy.mockRestore();
    engine.releaseLock();
  });

  it("un temporal residual de una escritura interrumpida no corrompe el lock", async () => {
    // Simula el rastro de un kill durante una escritura atómica previa.
    fs.writeFileSync(path.join(tmpDir, `ego.lock.${process.pid}.tmp`), '{"partial":', "utf8");

    const engine = new CrashRecoveryEngine({ storageDir: tmpDir });
    const report = await engine.checkAndAcquireLock("sesion-4");

    expect(report.wasDirty).toBe(false);
    const raw = fs.readFileSync(lockFilePath, "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
    engine.releaseLock();
  });

  it("un lock TORNADO (JSON inválido) es un dirty shutdown: se purga y se reporta", async () => {
    // Una escritura no atómica interrumpida por un kill deja el lock a medias.
    // Ese es EL indicio de un hard kill: el motor NO puede informarlo como
    // "arranque limpio" ni dejar el lock huérfano en disco.
    fs.writeFileSync(lockFilePath, '{"pid": 4242, "sessionId": "ses', "utf8");

    const engine = new CrashRecoveryEngine({ storageDir: tmpDir });
    const report = await engine.checkAndAcquireLock("sesion-6");

    expect(report.wasDirty).toBe(true);
    expect(report.recoveryAction).toBe("corrupt_lock_purged");

    // El lock queda reemplazado por el nuevo (válido), no por el corrupto.
    const raw = fs.readFileSync(lockFilePath, "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
    expect(JSON.parse(raw).sessionId).toBe("sesion-6");
    engine.releaseLock();
  });

  it("un lock con esquema inválido (no sólo JSON roto) también es dirty shutdown", async () => {
    fs.writeFileSync(lockFilePath, JSON.stringify({ nope: true }), "utf8");

    const engine = new CrashRecoveryEngine({ storageDir: tmpDir });
    const report = await engine.checkAndAcquireLock("sesion-7");

    expect(report.wasDirty).toBe(true);
    expect(report.recoveryAction).toBe("corrupt_lock_purged");
    engine.releaseLock();
  });

  it("el heartbeat mantiene el lock válido tras varios ciclos", async () => {
    const engine = new CrashRecoveryEngine({
      storageDir: tmpDir,
      heartbeatIntervalMs: 20,
    });
    await engine.checkAndAcquireLock("sesion-5");

    await new Promise((r) => setTimeout(r, 150));

    const raw = fs.readFileSync(lockFilePath, "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
    expect(JSON.parse(raw).sessionId).toBe("sesion-5");
    await engine.stopHeartbeatAsync();
    engine.releaseLock();
  });
});