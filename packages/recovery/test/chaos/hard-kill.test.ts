import { createTempWorkspace } from "@ego/tools";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fork } from "node:child_process";
import { CrashRecoveryEngine } from "../../src/CrashRecoveryEngine.js";

/**
 * Chaos Monkey: Hard-Kill & Resilience (REC-08).
 *
 * Ola 1b T4 — **flaky bajo carga**. Causa raíz (medida, no supuesta):
 *
 * 1. El worker de caos escribe `ego.lock` con un `writeFileSync` **no
 *    atómico** y lo **reescribe cada 5 escrituras** (~50 ms). El test leía
 *    ese fichero con `JSON.parse(readFileSync(...))` sin protección: si la
 *    lectura caía en mitad de la escritura, el JSON estaba truncado y el
 *    test moría con `SyntaxError: Unexpected end of JSON input`.
 *    Reproducción: 2-3 fallos de 12 ejecuciones en secuencia.
 *
 * 2. La espera de "el worker está activo" era un **sondeo del filesystem con
 *    un presupuesto de 5 s** que, si se agotaba, continuaba igualmente: el
 *    test follows adelante sin la precondición y fallaba después con un error
 *    confuso.
 *
 * 3. Y — lo más importante — el test **sobre-especificaba**: exigía que el
 *    lock previo a la muerte fuera JSON válido. Un hard kill NO garantiza
 *    eso: un lock truncado es un estado legítimo y es precisamente la señal
 *    que el motor debe detectar. El motor tenía además el hueco
 *    correspondiente (lock ilegible ⇒ "arranque limpio", dirty shutdown
 *    perdido en silencio). Corregido en `CrashRecoveryEngine` (Ola 1b T4).
 *
 * REESCRITURA (condición de espera determinista, sin `sleep`):
 * - El worker envía `process.send({ status: "writing_active", count })` por
 *   IPC cuando ha escrito 10 ficheros: esa es la señal determinista de
 *   "está escribiendo" (no un sondeo del disco).
 * - La lectura del lock previo es **tolerante**: un lock truncado es un
 *   estado esperado tras un hard kill, no un error.
 * - La precondición se **exige** con un mensaje explícito si no se cumple.
 * - Lo que se afirma es el contrato real: el motor detecta el cierre
 *   abrupto, purga el lock huérfano y los datos sobreviven.
 */
describe("Chaos Monkey: Hard-Kill & Resilience (REC-08)", () => {
  let tmpDir: string;
  let lockFilePath: string;
  let dataDir: string;

  beforeEach(() => {
    tmpDir = createTempWorkspace({ prefix: "ego-chaos-hardkill-" }).path;
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
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    });

    const workerPid = worker.pid!;
    expect(workerPid).toBeDefined();

    // --- Condición de espera DETERMINISTA -------------------------------
    // El worker avisa por IPC cuando su bucle de escritura está activo
    // (count === 10). No es un `sleep` ni un sondeo del disco: es el
    // handshake del propio productor.
    const active = await new Promise<{ count: number }>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            "El worker de caos no/dpareció 'writing_active' en 15s: el test no puede garantizar la precondición."
          )
        );
      }, 15_000);

      worker.on("message", (message: unknown) => {
        const payload = message as { status?: string; count?: number } | null;
        if (payload && payload.status === "writing_active") {
          clearTimeout(timer);
          resolve({ count: payload.count ?? 0 });
        }
      });

      worker.on("error", (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    expect(active.count).toBeGreaterThanOrEqual(10);

    // El lock del worker existe. Su contenido puede estar TRUNCADO (el
    // worker lo reescribe de forma no atómica): eso es un estado legítimo
    // tras un hard kill, no un error del test.
    expect(fs.existsSync(lockFilePath)).toBe(true);
    const rawLock = fs.readFileSync(lockFilePath, "utf8");
    const lockIsParsable = (() => {
      try {
        JSON.parse(rawLock);
        return true;
      } catch {
        return false;
      }
    })();

    // --- Hard-kill incondicional ----------------------------------------
    if (process.platform === "win32") {
      try {
        require("node:child_process").execSync(`taskkill /F /PID ${workerPid}`, { stdio: "ignore" });
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

    // --- El motor debe detectar el cierre abrupto ------------------------
    const engine = new CrashRecoveryEngine({
      storageDir: tmpDir,
      staleThresholdMs: 1000,
    });
    const report = await engine.checkAndAcquireLock("master-resilience-session");

    // Éste es el contrato: hubo una instancia previa y el motor lo sabe.
    expect(report.wasDirty).toBe(true);
    expect(["stale_lock_purged", "corrupt_lock_purged"]).toContain(report.recoveryAction);

    // El nuevo lock es válido y pertenece a este proceso.
    expect(fs.existsSync(lockFilePath)).toBe(true);
    const newLock = JSON.parse(fs.readFileSync(lockFilePath, "utf8"));
    expect(newLock.pid).toBe(process.pid);
    expect(newLock.sessionId).toBe("master-resilience-session");

    // Verificar durabilidad de datos: los archivos escritos antes del kill
    // deben ser íntegros.
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

    // Nota de diagnóstico: si el lock del worker era legible, el motor lo
    // habría purgado por "stale_lock_purged"; si estaba truncado (escritura
    // no atómica interrumpida), por "corrupt_lock_purged". Ambos son
    // dirty shutdown correcto.
    if (!lockIsParsable) {
      expect(report.recoveryAction).toBe("corrupt_lock_purged");
    }
  });
});