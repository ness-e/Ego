import * as path from "node:path";
import * as fs from "node:fs";
import { pathExists } from "./fsAsync.js";

export type StorageHealthState = "ok" | "corrupt" | "locked";

export interface StorageHealthReport {
  state: StorageHealthState;
  dbPath: string;
  reason?: string;
  timestamp: number;
}

/**
 * F6T13/L10 — narrowing local (sin `any`): `@ego/recovery` no depende de
 * `@ego/tools`, por lo que no reutiliza su `getErrorParts`; la semántica es idéntica.
 */
function errorParts(err: unknown): { message: string; stack: string; code: string } {
  if (err instanceof Error) {
    const code = typeof (err as { code?: unknown }).code === "string" ? String((err as { code?: unknown }).code) : "";
    return { message: err.message, stack: err.stack ?? "", code };
  }
  if (typeof err === "object" && err !== null) {
    const record = err as Record<string, unknown>;
    return {
      message: typeof record.message === "string" ? record.message : String(err),
      stack: typeof record.stack === "string" ? record.stack : "",
      code: typeof record.code === "string" ? record.code : ""
    };
  }
  return { message: String(err), stack: "", code: "" };
}

/**
 * StorageHealthLatch - Pestillo de salud del almacenamiento local a nivel de proceso (Patrón Hermes HERM-15).
 *
 * Registra de forma determinista si la base de datos VantaDB (Fjall LSM) o su almacenamiento
 * ha sufrido bloqueo de descriptor (FjallError: Locked) o corrupción estructural.
 * Una vez activado el pestillo de corrupción, previene escrituras ciegas y guía al usuario
 * hacia la recuperación antes de que se inicien los Sub-Egos.
 */
export class StorageHealthLatch {
  private static readonly corruptLatches = new Map<string, { state: StorageHealthState; reason: string; timestamp: number }>();

  public static normalizePath(dbPath: string): string {
    return path.resolve(dbPath);
  }

  /**
   * Identifica si un error corresponde a un bloqueo de descriptores de Fjall (FjallError: Locked / VDB-INC-02).
   */
  public static isLockedError(error: unknown): boolean {
    if (!error) return false;
    const { message: msg, stack, code } = errorParts(error);
    return (
      msg.includes("FjallError: Locked") ||
      stack.includes("FjallError: Locked") ||
      (code === "VANTADB_IO_ERROR" && (msg.includes("Locked") || stack.includes("Locked")))
    );
  }

  /**
   * Identifica si un error corresponde a daño o corrupción estructural.
   */
  public static isStructuralCorruptionError(error: unknown): boolean {
    if (!error) return false;
    const msg = errorParts(error).message.toLowerCase();
    return (
      msg.includes("corrupt") ||
      msg.includes("notadb") ||
      msg.includes("unexpected eof") ||
      msg.includes("bad magic") ||
      msg.includes("crc mismatch")
    );
  }

  /**
   * Activa el pestillo de estado para una ruta de base de datos.
   */
  public static markStorageState(dbPath: string, state: StorageHealthState, reason: string): void {
    const key = this.normalizePath(dbPath);
    if (this.corruptLatches.has(key)) return; // El primer fallo es el que manda

    this.corruptLatches.set(key, {
      state,
      reason,
      timestamp: Date.now(),
    });
  }

  /**
   * Registra automáticamente un error si corresponde a bloqueo o corrupción.
   */
  public static noteStorageError(dbPath: string, error: unknown): boolean {
    if (this.isLockedError(error)) {
      this.markStorageState(
        dbPath,
        "locked",
        "El descriptor de VantaDB (Fjall LSM) se encuentra bloqueado por otro proceso o instancia previa."
      );
      return true;
    }

    if (this.isStructuralCorruptionError(error)) {
      this.markStorageState(
        dbPath,
        "corrupt",
        `Daño estructural detectado en la base de datos: ${errorParts(error).message}`
      );
      return true;
    }

    return false;
  }

  /**
   * Consulta el estado de salud de la base de datos.
   */
  public static getHealthReport(dbPath: string): StorageHealthReport {
    const key = this.normalizePath(dbPath);
    const latched = this.corruptLatches.get(key);

    if (latched) {
      return {
        state: latched.state,
        dbPath: key,
        reason: latched.reason,
        timestamp: latched.timestamp,
      };
    }

    return {
      state: "ok",
      dbPath: key,
      timestamp: Date.now(),
    };
  }

  /**
   * Limpia el pestillo (utilizado tras un proceso de recuperación verificado o en pruebas).
   */
  public static reset(dbPath?: string): void {
    if (dbPath) {
      this.corruptLatches.delete(this.normalizePath(dbPath));
    } else {
      this.corruptLatches.clear();
    }
  }

  /**
   * Auditoría previa de salud de archivos y directorios de VantaDB en el arranque.
   */
  public static async auditStorageDirectory(dbPath: string): Promise<{ ok: boolean; reason?: string }> {
    const resolved = this.normalizePath(dbPath);
    try {
      if (!(await pathExists(resolved))) {
        // Si no existe, se creará al inicializar
        return { ok: true };
      }

      const stat = await fs.promises.stat(resolved);
      if (!stat.isDirectory()) {
        const reason = `La ruta de almacenamiento '${resolved}' no es un directorio.`;
        this.markStorageState(resolved, "corrupt", reason);
        return { ok: false, reason };
      }

      return { ok: true };
    } catch (err: unknown) {
      const reason = `Error de acceso al directorio de almacenamiento '${resolved}': ${errorParts(err).message}`;
      this.markStorageState(resolved, "corrupt", reason);
      return { ok: false, reason };
    }
  }
}
