import path from "node:path";
import fs from "node:fs";

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
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }

    return resolvedTarget;
  }
}
