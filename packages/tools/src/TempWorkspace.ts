import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * TempWorkspace — gestión de directorios temporales con limpieza a prueba de
 * muerte de proceso.
 *
 * T-X1 (Ola 3, A3). Los tests de `packages/subegos` abren un store REAL de
 * VantaDB, y VantaDB **preasigna** el store: 64 MB de journal (`0.jnl`) + 4
 * segmentos `vstore_L*.vanta` de 64 MB = **320 MB por store**, con
 * independencia del volumen de datos. Seis stores = ~1 GB de escritura por
 * corrida, y si el proceso muere (timeout, kill, reinicio) el directorio
 * queda huérfano en `%TEMP%` para siempre.
 *
 * Este módulo resuelve las dos mitades:
 *
 * 1. **Raíz por corrida.** Todos los workspaces de un proceso cuelgan de
 *    `%TEMP%/ego-test-scratch/run-<epochMs>-<pid>-<rand6>`. Un solo `rm -rf` se
 *    lleva todo lo que creó el proceso.
 * 2. **Limpieza a prueba de muerte.**
 *    - `process.on("exit")`: se ejecuta al salir normalmente, con excepción no
 *      capturada o tras un `process.exit()`.
 *    - `SIGINT`/`SIGTERM`: se limpia y se **re-lanza** la señal para no
 *      alterar el comportamiento por defecto del proceso.
 *    - **Barrido por antigüedad al inicio de la siguiente corrida**: un
 *      `run-*` cuyo `mtime` es antiguo (por defecto 6 h) se elimina. Esto
 *      recupera lo que dejó un `SIGKILL` (que no puede capturarse).
 *
 * Es código de PRODUCCIÓN (no un helper de test) porque el producto también
 * crea directorios temporales (`ProjectExport`, snapshots, worktrees) y sufre
 * el mismo problema.
 */

/**
 * Nombre de la raíz bajo la que viven los workspaces.
 *
 * CONVERGENCIA CON A4 (Ola 4b, T3.2): la raíz compartida es
 * `%TEMP%/ego-test-scratch/` — la misma que usa `apps/desktop/test/helpers/
 * test-scratch.ts`. Una sola raíz ⇒ el barrido de un agente recoge también
 * los huérfanos del otro (antes: `ego-scratch` en A3 y `ego-test-scratch` en
 * A4, con dos barridos que no se recogían el uno al otro).
 */
export const TEMP_WORKSPACE_ROOT_NAME = "ego-test-scratch";

/** Antigüedad por defecto tras la cual un workspace se considera huérfano. */
export const DEFAULT_STALE_AFTER_MS = 6 * 60 * 60 * 1000; // 6 horas

/**
 * Identificador único de la corrida (proceso).
 *
 * CONVERGENCIA CON A4: el nombre del run-dir es
 * `run-<epochMs>-<pid>-<rand6>` (la convención de A4). La marca de tiempo
 * permite barrer por antigüedad sin depender del `mtime` del directorio, y el
 * PID permite saber si el dueño sigue vivo.
 */
const RUN_ID = `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

let runRoot: string | undefined;
/**
 * Raíces creadas por ESTE proceso. El hook `exit` debe limpiarlas todas
 * (incluidas las de raíz personalizada), no sólo la raíz por defecto.
 */
const ownedRunRoots = new Set<string>();
let exitHookInstalled = false;

/**
 * Raíz de la corrida actual: `%TEMP%/ego-test-scratch/run-<epochMs>-<pid>-<rand6>`.
 */
export function getTempWorkspaceRunRoot(): string {
  if (!runRoot) {
    runRoot = path.join(os.tmpdir(), TEMP_WORKSPACE_ROOT_NAME, `run-${RUN_ID}`);
    ownedRunRoots.add(runRoot);
  }
  return runRoot;
}
/**
 * Instala los hooks de limpieza a prueba de muerte (idempotente).
 */
function installCleanupHooks(): void {
  if (exitHookInstalled) return;
  exitHookInstalled = true;

  process.on("exit", () => {
    removeRunRootSync();
  });

  const onSignal = (signal: NodeJS.Signals): void => {
    try {
      removeRunRootSync();
    } catch {
      // best effort: el barrido por antigüedad recuperará lo que falte
    }
    // Restablece el comportamiento por defecto y re-lanza la señal: el
    // proceso debe morir como si nadie escuchase.
    process.removeListener(signal, onSignal);
    process.kill(process.pid, signal);
  };

  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
}

/**
 * Elimina las raíces de corrida creadas por este proceso (síncrono,
 * idempotente).
 */
export function removeRunRootSync(): void {
  for (const root of ownedRunRoots) {
    try {
      fs.rmSync(root, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200,
      });
    } catch {
      // best effort: el barrido por antigüedad recuperará lo que falte
    }
  }
  ownedRunRoots.clear();
  runRoot = undefined;
}

/**
 * Extrae el PID del propietario de una raíz de corrida.
 *
 * CONVERGENCIA CON A4: se aceptan las DOS convenciones de nombre para que el
 * barrido limpie también los run-dirs creados por la versión anterior:
 * - `run-<epochMs>-<pid>-<rand6>` (convención de A4, la vigente).
 * - `run-<pid>-<rand>` (convención de A3 anterior).
 */
function parseRunPid(name: string): number | null {
  const a4 = /^run-\d+-(\d+)-[a-z0-9]+$/.exec(name);
  if (a4) {
    const pid = Number(a4[1]);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  }
  const legacy = /^run-(\d+)-/.exec(name);
  if (!legacy) return null;
  const pid = Number(legacy[1]);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

/**
 * `true` si el proceso existe (señal 0: no mata, sólo consulta).
 *
 * EPERM = existe pero pertenece a otro usuario ⇒ VIVO.
 *
 * Exportado para que el módulo de A4 (`apps/desktop/test/helpers/
 * test-scratch.ts`) use **la misma** implementación (una sola fuente de
 * verdad para el criterio de PID muerto).
 */
export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    // EPERM = existe pero no tenemos permiso para señalarlo → VIVO.
    return (err as NodeJS.ErrnoException | null)?.code === "EPERM";
  }
}

/**
 * Resultado de un barrido de workspaces huérfanos.
 */
export interface TempWorkspaceSweepResult {
  /** Directorios eliminados. */
  readonly removed: string[];
  /** Bytes liberados (estimados tras la eliminación). */
  readonly bytesFreed: number;
}

/**
 * Elimina los workspaces huérfanos de corridas anteriores.
 *
 * Se ejecuta automáticamente al crear el primer workspace de la corrida (y
 * se puede invocar explícitamente, p. ej. desde un test).
 */
export function sweepStaleTempWorkspaces(
  options: { staleAfterMs?: number; root?: string; now?: number } = {}
): TempWorkspaceSweepResult {
  const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  const now = options.now ?? Date.now();
  const root = options.root ?? path.join(os.tmpdir(), TEMP_WORKSPACE_ROOT_NAME);

  const removed: string[] = [];
  let bytesFreed = 0;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return { removed, bytesFreed };
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!entry.name.startsWith("run-")) continue;

    const full = path.join(root, entry.name);

    // La corrida actual NUNCA se barre: barrerla borraría los workspaces
    // vivos de este proceso.
    if (ownedRunRoots.has(full)) continue;

    // CONVERGENCIA CON A4 (handoff A4-ola3 §5.3, punto 0): el criterio es
    // el **PID MUERTO**, no la antigüedad. Un run que murió hace 5 minutos es
    // basura y la corrida siguiente lo recoge YA; la antigüedad (6 h) es sólo
    // la red de seguridad por si el PID se reutilizó.
    const ownerPid = parseRunPid(entry.name);
    if (ownerPid !== null && isProcessAlive(ownerPid)) {
      // El dueño sigue VIVO: su run-dir no se toca jamás. Sin esta
      // comprobación, el barrido de un proceso puede borrar la raíz de OTRO
      // proceso vivo (una raíz recién creada está vacía durante un instante).
      continue;
    }

    const size = directorySizeSync(full);
    const deadOwner = ownerPid !== null; // el PID no está vivo

    let ageMs: number;
    try {
      ageMs = now - fs.statSync(full).mtimeMs;
    } catch {
      continue;
    }

    const tooOld = ageMs >= staleAfterMs;
    const isEmpty = size === 0;

    // Se borra si: el dueño está MUERTO, o la raíz está vacía, o es demasiado
    // antigua (PID reutilizado).
    if (!deadOwner && !isEmpty && !tooOld) continue;

    try {
      fs.rmSync(full, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200,
      });
      removed.push(full);
      bytesFreed += size;
    } catch {
      // best effort: se reintentará en la siguiente corrida
    }
  }

  return { removed, bytesFreed };
}

/**
 * Tamaño total (bytes) de un directorio, recursivo.
 *
 * NOTA (I/O síncrono deliberado): este módulo usa `fs` **síncrono** a
 * propósito. El hook `process.on("exit")` no puede esperar a una promesa: si la
 * limpieza fuese asíncrona, el proceso moriría antes de completar el borrado y
 * el directorio quedaría huérfano (exactamente el problema que se corrige).
 * No es un path de IPC: es una utilidad de limpieza que se ejecuta una vez
 * por proceso.
 */
function directorySizeSync(dir: string): number {
  let total = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else {
        try {
          total += fs.statSync(full).size;
        } catch {
          // ignore
        }
      }
    }
  }
  return total;
}

/**
 * Opciones de `createTempWorkspace`.
 */
export interface TempWorkspaceOptions {
  /** Prefijo del directorio (p. ej. `subegos-store`). */
  prefix: string;
  /** Antigüedad máxima para el barrido (ms). */
  staleAfterMs?: number;
  /** Raíz personalizada (por defecto `%TEMP%/ego-test-scratch`). */
  root?: string;
}

/**
 * Workspace temporal creado bajo la raíz de la corrida.
 */
export interface TempWorkspace {
  /** Ruta absoluta del directorio (ya existe). */
  readonly path: string;
  /** Elimina el workspace. Idempotente. */
  cleanup(): void;
  /** `true` si el directorio sigue existiendo. */
  exists(): boolean;
}

/**
 * Crea un directorio temporal **dentro de la raíz de la corrida**.
 *
 * Ventajas frente a `fs.mkdtempSync(os.tmpdir(), ...)`:
 * - Todo lo que crea el proceso cuelga de una única raíz (un `rm -rf`).
 * - La limpieza por muerte de proceso está garantizada (exit + SIGINT/SIGTERM).
 * - Lo que deja un `SIGKILL` se recupera con el barrido por antigüedad.
 */
export function createTempWorkspace(options: TempWorkspaceOptions): TempWorkspace {
  const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;

  // Barrido por antigüedad: recupera lo que dejó una corrida anterior que
  // murió sin poder limpiar (SIGKILL, corte de luz, kill del CI).
  sweepStaleTempWorkspaces({ staleAfterMs, root: options.root });

  installCleanupHooks();

  const base = options.root
    ? path.join(options.root, `run-${RUN_ID}`)
    : getTempWorkspaceRunRoot();

  fs.mkdirSync(base, { recursive: true });
  ownedRunRoots.add(base);

  const dir = fs.mkdtempSync(path.join(base, `${options.prefix}-`));

  return {
    path: dir,
    cleanup(): void {
      try {
        fs.rmSync(dir, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 200,
        });
      } catch {
        // best effort: el barrido por antigüedad lo recuperará
      }
    },
    exists(): boolean {
      return fs.existsSync(dir);
    },
  };
}
