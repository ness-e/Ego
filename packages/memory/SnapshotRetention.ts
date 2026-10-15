import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface SnapshotRetentionOptions {
  /** Tope de dumps a conservar (por defecto 50). Debe ser entero >= 1. */
  maxSnapshots?: number;
  /**
   * Ruta del snapshot activo (absoluta o relativa a `directory`).
   * NUNCA se elimina, aunque sea el más antiguo o exceda el tope.
   */
  activePath?: string;
}

export interface SnapshotRetentionReport {
  directory: string;
  kept: string[];
  pruned: string[];
  /** true si no había activo que preservar o el activo sobrevivió. */
  activePreserved: boolean;
  maxSnapshots: number;
}

/**
 * Rotación de snapshots `.vdbdump` con tope (CFG-08).
 *
 * Conserva los `maxSnapshots` dumps más recientes (por mtime, desempate por
 * nombre) y elimina el resto. El snapshot activo (`activePath`) nunca se
 * elimina: si cae fuera del tope, desplaza al conservado más antiguo para
 * que el total siga acotado sin perder el activo.
 *
 * Defensivo: directorio inexistente/ilegible → reporte vacío (no lanza).
 * Fallos de `unlink` individuales se reportan por `console.warn` y el
 * archivo queda en `kept` (nunca se declara podado lo que sigue en disco).
 */
export async function pruneSnapshotDumps(
  directory: string,
  options: SnapshotRetentionOptions = {}
): Promise<SnapshotRetentionReport> {
  const maxSnapshots = options.maxSnapshots ?? 50;
  if (!Number.isInteger(maxSnapshots) || maxSnapshots < 1) {
    throw new Error(
      `[SnapshotRetention] maxSnapshots debe ser entero >= 1 (recibido: ${options.maxSnapshots})`
    );
  }

  const empty: SnapshotRetentionReport = {
    directory,
    kept: [],
    pruned: [],
    activePreserved: true,
    maxSnapshots,
  };

  let entries: string[];
  try {
    entries = await fs.readdir(directory);
  } catch {
    return empty;
  }

  const dumps = entries.filter((f) => f.endsWith(".vdbdump"));
  if (dumps.length === 0) return empty;

  const activeResolved =
    options.activePath !== undefined
      ? path.resolve(directory, options.activePath)
      : null;

  interface DumpStat {
    fullPath: string;
    mtimeMs: number;
  }
  const stats: DumpStat[] = [];
  for (const file of dumps) {
    const fullPath = path.resolve(directory, file);
    try {
      const st = await fs.stat(fullPath);
      if (!st.isFile()) continue;
      stats.push({ fullPath, mtimeMs: st.mtimeMs });
    } catch {
      continue;
    }
  }
  if (stats.length === 0) return empty;

  // Más recientes primero (mtime desc, desempate por nombre desc).
  stats.sort((a, b) => {
    if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs;
    return b.fullPath.localeCompare(a.fullPath);
  });

  let kept = stats.slice(0, maxSnapshots).map((s) => s.fullPath);
  let toPrune = stats.slice(maxSnapshots).map((s) => s.fullPath);

  // El activo nunca se poda: si quedó fuera del tope, desplaza al
  // conservado más antiguo (último de `kept`, el más viejo entre ellos).
  if (activeResolved !== null && !kept.includes(activeResolved)) {
    const activeIdx = toPrune.indexOf(activeResolved);
    if (activeIdx >= 0) {
      toPrune.splice(activeIdx, 1);
      const displaced = kept.pop();
      if (displaced !== undefined) toPrune.push(displaced);
      kept.push(activeResolved);
    }
  }

  const pruned: string[] = [];
  const keptExtended = [...kept];
  for (const victim of toPrune) {
    try {
      await fs.unlink(victim);
      pruned.push(victim);
    } catch (err) {
      console.warn(
        `[SnapshotRetention] no se pudo podar ${victim}: ${err instanceof Error ? err.message : String(err)}`
      );
      keptExtended.push(victim);
    }
  }

  const activePreserved =
    activeResolved === null || !pruned.includes(activeResolved);

  return {
    directory,
    kept: keptExtended.sort(),
    pruned: pruned.sort(),
    activePreserved,
    maxSnapshots,
  };
}
