import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fork, execSync } from "node:child_process";
import { CrashRecoveryEngine } from "../../src/CrashRecoveryEngine.js";

describe("Chaos Monkey: Hard-Kill & Resilience (REC-08)", () => {
  let tmpDir: string;
  let lockFilePath: string;
  let dataDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ego-chaos-hardkill-"));
    lockFilePath = path.join(tmpDir, "ego.lock");
    dataDir = path.join(tmpDir, "data");
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("detecta dirty shutdown, purga lock huérfano y preserva datos tras SIGKILL forzoso", async () => {
    const workerScript = path.join(__dirname, "kill-target-worker.cjs");
    const workerSession = "worker-chaos-session-1";

    const worker = fork(workerScript, [lockFilePath, dataDir, workerSession], {
      stdio: "pipe",
    });

    const workerPid = worker.pid!;
    expect(workerPid).toBeDefined();

    // Esperar de forma determinista a que el worker esté activo escribiendo (hasta 5s bajo carga de CPU)
    const startWait = Date.now();
    while (Date.now() - startWait < 5000) {
      if (
        fs.existsSync(lockFilePath) &&
        fs.existsSync(dataDir) &&
        fs.readdirSync(dataDir).length >= 5
      ) {
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }

    // Validar que el lockfile fue generado por el worker
    expect(fs.existsSync(lockFilePath)).toBe(true);
    const initialLock = JSON.parse(fs.readFileSync(lockFilePath, "utf8"));
    expect(initialLock.pid).toBe(workerPid);

    // Hard-kill incondicional
    if (process.platform === "win32") {
      try {
        execSync(`taskkill /F /PID ${workerPid}`, { stdio: "ignore" });
      } catch {
        worker.kill("SIGKILL");
      }
    } else {
      worker.kill("SIGKILL");
    }

    // Esperar a que el proceso termine
    await new Promise((r) => setTimeout(r, 200));

    // Verificar que el worker ya no existe
    let isDead = false;
    try {
      process.kill(workerPid, 0);
    } catch {
      isDead = true;
    }
    expect(isDead).toBe(true);

    // Instanciar CrashRecoveryEngine para resolver el dirty shutdown
    const engine = new CrashRecoveryEngine({
      storageDir: tmpDir,
      staleThresholdMs: 1000,
    });
    const report = await engine.checkAndAcquireLock("master-resilience-session");

    expect(report.wasDirty).toBe(true);
    expect(report.previousPid).toBe(workerPid);
    expect(report.recoveryAction).toBe("stale_lock_purged");

    // Verificar que el nuevo lock fue asignado a este proceso
    expect(fs.existsSync(lockFilePath)).toBe(true);
    const newLock = JSON.parse(fs.readFileSync(lockFilePath, "utf8"));
    expect(newLock.pid).toBe(process.pid);
    expect(newLock.sessionId).toBe("master-resilience-session");

    // Verificar durabilidad de datos: los archivos escritos antes del kill deben ser íntegros
    const writtenFiles = fs.readdirSync(dataDir);
    expect(writtenFiles.length).toBeGreaterThanOrEqual(5);

    for (const f of writtenFiles) {
      const content = fs.readFileSync(path.join(dataDir, f), "utf8");
      const parsed = JSON.parse(content);
      expect(parsed.index).toBeDefined();
      expect(parsed.data).toBe("payload_data");
    }

    // Limpieza ordenada
    engine.releaseLock();
    expect(fs.existsSync(lockFilePath)).toBe(false);
  });
});
