import * as fs from "node:fs";

/**
 * fsAsync — utilidades de I/O asíncrono para `packages/recovery`.
 *
 * EGO-FIND-66 (Ola 1 / A3 / T11): el paquete tenía 53 llamadas de I/O
 * **síncrono** (`*Sync`) que bloqueaban el event loop del proceso main
 * (Electron: la UI se congela durante un export/import/snapshot).
 *
 * Este módulo centraliza las operaciones necesarias y las deja **todas**
 * asíncronas, con una helper para publicar contenido de forma atómica
 * (tmp + fsync + rename), que es el patrón que ya usaba el heartbeat.
 */

/**
 * `true` si la ruta existe (async, sin I/O síncrono).
 */
export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.promises.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lee un fichero de texto. Devuelve `null` si no existe o no se puede leer.
 */
export async function readTextFile(
  targetPath: string,
  encoding: BufferEncoding = "utf8"
): Promise<string | null> {
  try {
    return await fs.promises.readFile(targetPath, encoding);
  } catch {
    return null;
  }
}

/**
 * Escribe un fichero de texto de forma **atómica**: temporal con el PID en el
 * nombre → `fsync` → `rename`. Si algo falla, se limpia el temporal y el
 * destino previo queda intacto.
 */
export async function writeTextFileAtomic(
  targetPath: string,
  content: string,
  encoding: BufferEncoding = "utf8"
): Promise<void> {
  const tmpPath = `${targetPath}.${process.pid}.tmp`;
  try {
    // "w+": en Windows, fsync sobre un fd de solo-lectura falla con EPERM.
    const handle = await fs.promises.open(tmpPath, "w+");
    try {
      await handle.writeFile(content, encoding);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.promises.rename(tmpPath, targetPath);
  } catch (err: unknown) {
    try {
      await fs.promises.unlink(tmpPath);
    } catch {
      // noop: mejor un temporal huérfano que un fichero truncado
    }
    throw err;
  }
}

/**
 * Elimina una ruta si existe. No lanza si no existe.
 */
export async function removeIfExists(targetPath: string): Promise<boolean> {
  try {
    await fs.promises.unlink(targetPath);
    return true;
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "ENOENT") return false;
    throw err;
  }
}

/**
 * Crea un directorio (y sus padres) si no existe.
 */
export async function ensureDir(targetPath: string): Promise<void> {
  await fs.promises.mkdir(targetPath, { recursive: true });
}
