import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { DiagnosticsLogger } from "../src/DiagnosticsLogger.js";

describe("DiagnosticsLogger", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ego-diag-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("sanea claves API, Bearer tokens y contraseñas en mensajes y detalles", () => {
    const logger = new DiagnosticsLogger({ logsDir: tmpDir });

    const entry = logger.info(
      "auth",
      "Petición con clave sk-1234567890abcdef1234567890 y Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      { apiKey: "sk-abcdef1234567890abcdef1234", password: "secret_password_123" }
    );

    expect(entry.message).not.toContain("sk-1234567890abcdef1234567890");
    expect(entry.message).toContain("[REDACTED_API_KEY]");
    expect(entry.message).toContain("Bearer [REDACTED_TOKEN]");

    const details = entry.details as any;
    expect(details.apiKey).toBe("[REDACTED]");
    expect(details.password).toBe("[REDACTED]");
  });

  it("rota archivos de log automáticamente al superar maxFileSizeBytes", async () => {
    // Configurar un límite pequeño de 200 bytes para probar rotación rápida
    const logger = new DiagnosticsLogger({
      logsDir: tmpDir,
      maxFileSizeBytes: 200,
      maxFiles: 3,
    });

    for (let i = 0; i < 20; i++) {
      logger.info("test", `Mensaje repetitivo para llenar el buffer de log número ${i}`);
    }
    await logger.flush();

    const currentLog = path.join(tmpDir, "ego.diagnostics.log");
    const rotated1 = path.join(tmpDir, "ego.diagnostics.1.log");

    expect(fs.existsSync(currentLog)).toBe(true);
    expect(fs.existsSync(rotated1)).toBe(true);
  });

  it("genera un paquete de diagnóstico anónimo exportDiagnosticsBundle", async () => {
    const logger = new DiagnosticsLogger({ logsDir: tmpDir });
    logger.info("init", "Arranque del sistema");
    logger.recordDirtyShutdown({
      wasDirty: true,
      recoveryAction: "stale_lock_purged",
      timestamp: Date.now(),
    });

    const bundle = await logger.exportDiagnosticsBundle({
      pid: 1234,
      sessionId: "sess-abc",
      startedAt: Date.now(),
      lastHeartbeat: Date.now(),
      version: "0.1.0",
    });

    expect(bundle.systemInfo.egoVersion).toBe("0.1.0");
    expect(bundle.systemInfo.platform).toBe(os.platform());
    expect(bundle.recentLogs.length).toBeGreaterThanOrEqual(1);
    expect(bundle.dirtyShutdownHistory.length).toBe(1);
    expect(bundle.lockStatus?.pid).toBe(1234);
  });
});
