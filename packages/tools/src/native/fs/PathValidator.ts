import path from "node:path";
import fs from "node:fs";
import { getErrorParts } from "../../error-parts.js";

/**
 * Rutas reservadas críticas del sistema que NUNCA pueden ser tocadas por herramientas de Ego.
 * Guardrail de Sandbox (§4 AGENTS.md, CARP-03).
 */
const RESERVED_SYSTEM_DIRS = [
  "C:\\Windows",
  "C:\\Program Files",
  "C:\\Program Files (x86)",
  "/etc",
  "/bin",
  "/sbin",
  "/usr/bin",
  "/usr/sbin",
  "/sys",
  "/proc",
];

export interface PathValidationOptions {
  workspacePath: string;
  allowSystemPaths?: boolean;
}

/**
 * Validador de rutas de acceso al sistema de archivos para herramientas nativas de Ego.
 * Previene escapes de directorio (path traversal), acceso a rutas reservadas y symlink attacks.
 */
export class PathValidator {
  /**
   * Resuelve y valida que una ruta se encuentre confinada estrictamente al workspace permitido.
   * Lanza un Error descriptivo si la ruta vulnera el perímetro de seguridad.
   */
  public static validatePath(targetPath: string, workspacePath: string): string {
    if (!targetPath || typeof targetPath !== "string") {
      throw new Error("Ruta de archivo inválida o vacía");
    }

    if (!workspacePath || typeof workspacePath !== "string") {
      throw new Error("workspacePath no configurado para la operación");
    }

    // Normalizar directorios absolutos
    const resolvedWorkspace = path.resolve(workspacePath);
    const resolvedTarget = path.isAbsolute(targetPath)
      ? path.resolve(targetPath)
      : path.resolve(resolvedWorkspace, targetPath);

    // 1. Verificación de rutas críticas del sistema operativo
    for (const sysDir of RESERVED_SYSTEM_DIRS) {
      if (resolvedTarget.toLowerCase().startsWith(sysDir.toLowerCase())) {
        throw new Error(`Acceso denegado: '${resolvedTarget}' es una ruta protegida del sistema operativo`);
      }
    }

    // 2. Verificación de contención en el Workspace (Sandbox Boundary)
    const relative = path.relative(resolvedWorkspace, resolvedTarget);
    const isInsideWorkspace = !relative.startsWith("..") && !path.isAbsolute(relative);

    if (!isInsideWorkspace) {
      throw new Error(
        `Violación de Sandbox (CARP-03): La ruta '${resolvedTarget}' está fuera del workspace permitido '${resolvedWorkspace}'`
      );
    }

    // 3. Verificación de enlaces simbólicos si el destino ya existe físicamente
    try {
      if (fs.existsSync(resolvedTarget)) {
        const realTargetPath = fs.realpathSync(resolvedTarget);
        const realWorkspacePath = fs.realpathSync(resolvedWorkspace);
        const realRelative = path.relative(realWorkspacePath, realTargetPath);

        if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
          throw new Error(
            `Violación de Sandbox por Symlink: El enlace apunta a '${realTargetPath}', fuera del workspace`
          );
        }
      }
    } catch (err: unknown) {
      if (getErrorParts(err).code !== "ENOENT") {
        throw err;
      }
    }

    return resolvedTarget;
  }

  /**
   * Valida y resuelve una ruta de forma **asíncrona**, cerrando el TOCTOU.
   *
   * EGO-FIND-66 (T11): la variante síncrona `validatePath` validaba con
   * `existsSync`/`realpathSync` y la tool abría el fichero DESPUÉS, en otra
   * llamada: una ventana en la que un symlink podía cambiar de destino.
   *
   * Esta variante:
   * 1. resuelve el **directorio padre** con `realpath` (async): si un symlink
   *    apunta fuera del workspace, se detecta aunque el destino final aún no
   *    exista;
   * 2. resuelve el destino si existe;
   * 3. exige que ambos queden dentro del workspace real (no solo del lógico).
   *
   * `@ego/tools` la usa en todas sus tools; la variante síncrona se conserva
   * por compatibilidad (la usa `apps/desktop/src/main.ts`).
   */
  public static async validatePathAsync(
    targetPath: string,
    workspacePath: string
  ): Promise<string> {
    if (!targetPath || typeof targetPath !== "string") {
      throw new Error("Ruta de archivo inválida o vacía");
    }

    if (!workspacePath || typeof workspacePath !== "string") {
      throw new Error("workspacePath no configurado para la operación");
    }

    const resolvedWorkspace = path.resolve(workspacePath);
    const resolvedTarget = path.isAbsolute(targetPath)
      ? path.resolve(targetPath)
      : path.resolve(resolvedWorkspace, targetPath);

    // 1. Rutas críticas del sistema operativo
    for (const sysDir of RESERVED_SYSTEM_DIRS) {
      if (resolvedTarget.toLowerCase().startsWith(sysDir.toLowerCase())) {
        throw new Error(
          `Acceso denegado: '${resolvedTarget}' es una ruta protegida del sistema operativo`
        );
      }
    }

    // 2. Contención en el workspace (perímetro lógico)
    const relative = path.relative(resolvedWorkspace, resolvedTarget);
    const isInsideWorkspace = !relative.startsWith("..") && !path.isAbsolute(relative);
    if (!isInsideWorkspace) {
      throw new Error(
        `Violación de Sandbox (CARP-03): La ruta '${resolvedTarget}' está fuera del workspace permitido '${resolvedWorkspace}'`
      );
    }

    // 3. Contención en el workspace REAL (resuelve symlinks del padre y del
    //    destino). Esto es lo que cierra el TOCTOU de la variante síncrona.
    const realWorkspacePath = await fs.promises.realpath(resolvedWorkspace);
    const parentDir = path.dirname(resolvedTarget);
    const realParentDir = await fs.promises.realpath(parentDir).catch(() => parentDir);
    const realTargetPath = await fs.promises
      .realpath(resolvedTarget)
      .catch(() => path.join(realParentDir, path.basename(resolvedTarget)));

    for (const candidate of [realParentDir, realTargetPath]) {
      const realRelative = path.relative(realWorkspacePath, candidate);
      if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
        throw new Error(
          `Violación de Sandbox por Symlink: El enlace apunta a '${candidate}', fuera del workspace`
        );
      }
    }

    return resolvedTarget;
  }
}
