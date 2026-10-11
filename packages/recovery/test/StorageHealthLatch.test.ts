import { describe, it, expect, beforeEach } from "vitest";
import { StorageHealthLatch } from "../src/StorageHealthLatch.js";

describe("HERM-15: StorageHealthLatch (Storage diagnostics & lock recovery)", () => {
  beforeEach(() => {
    StorageHealthLatch.reset();
  });

  it("identifica errores FjallError: Locked de VantaDB", () => {
    const error = new Error("VANTADB_IO_ERROR: IO error: FjallError: Locked");
    (error as any).code = "VANTADB_IO_ERROR";

    expect(StorageHealthLatch.isLockedError(error)).toBe(true);
    expect(StorageHealthLatch.isStructuralCorruptionError(error)).toBe(false);
  });

  it("identifica errores de daño estructural o CRC mismatch", () => {
    const error = new Error("Database file is corrupt: bad magic number in header");
    expect(StorageHealthLatch.isStructuralCorruptionError(error)).toBe(true);
    expect(StorageHealthLatch.isLockedError(error)).toBe(false);
  });

  it("activa el pestillo de salud ante un error de bloqueo y lo mantiene latched", () => {
    const dbPath = "C:\\Users\\Eros\\.ego\\vantadb_data";
    const lockedErr = new Error("IO error: FjallError: Locked");

    const latched = StorageHealthLatch.noteStorageError(dbPath, lockedErr);
    expect(latched).toBe(true);

    const report = StorageHealthLatch.getHealthReport(dbPath);
    expect(report.state).toBe("locked");
    expect(report.reason).toContain("bloqueado por otro proceso");

    // Idempotencia: no se borra ni muta con errores menores posteriores
    StorageHealthLatch.noteStorageError(dbPath, new Error("Minor warning"));
    expect(StorageHealthLatch.getHealthReport(dbPath).state).toBe("locked");
  });

  it("reporta 'ok' para almacenes saludables y permite reset verificado", () => {
    const cleanPath = "C:\\Users\\Eros\\.ego\\clean_db";
    expect(StorageHealthLatch.getHealthReport(cleanPath).state).toBe("ok");

    StorageHealthLatch.markStorageState(cleanPath, "corrupt", "Prueba de daño");
    expect(StorageHealthLatch.getHealthReport(cleanPath).state).toBe("corrupt");

    StorageHealthLatch.reset(cleanPath);
    expect(StorageHealthLatch.getHealthReport(cleanPath).state).toBe("ok");
  });
});
