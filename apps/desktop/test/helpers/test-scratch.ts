/**
 * T-X1 — Scratch compartido y resistant a la muerte del proceso.
 *
 * ## Por qué existe
 * `NativeVantaDB.connect(path)` **pre-reserva 320 MB** (5 × 64 MB: cuatro
 * `data/vstore_L*.vanta` + el journal `0.jnl`) en el momento de conectar, con
 * independencia de los datos que se escriban después. Medido (handoff
 * A4-ola3 §T-X1): un store vacío ocupa 320,06 MB.
 *
 * Los tests del desktop crean un store por test (`beforeEach`) o por fichero
 * (`beforeAll`) y lo borran en el `afterEach`/`afterAll`. **Si el proceso
 * muere** (timeout del test, `kill`, reinicio del servidor), el teardown no
 * se ejecuta y el directorio se queda **para siempre**: 320 MB por huérfano.
 * Con 19 paquetes en paralelo, el acumulado llevó el disco C: al 2,5 %.
 *
 * ## La convención (compartida con A3 — misma raíz, mismo nombre, misma regla)
 *
 * 1. **Raíz**: `%TEMP%/ego-test-scratch/` — **compartida** por todos los
 *    agentes. Cada agente barre la raíz completa, así que la limpieza de uno
 *    recoge también los huérfanos del otro.
 * 2. **Directorio de corrida**: `<raíz>/run-<epochMs>-<pid>-<rand6>/`.
 *    El PID es la clave: permite saber si el dueño sigue vivo.
 * 3. **Directorio de test**: `<run>/<suite>-<n>/`.
 * 4. **Barrido al inicio de cada corrida**: se borra todo `run-*` cuyo PID
 *    **no esté vivo** (proceso muerto → sus restos son basura) o cuya
 *    antigüedad supere `SCRATCH_MAX_AGE_MS` (por si el PID se reutilizó).
 *    Esto es lo que hace la limpieza **resistant a la muerte del proceso**:
 *    la corrida siguiente recoge lo que la anterior dejó.
 * 5. **Teardown idempotente**: `fs.rmSync(dir, { recursive, force, maxRetries,
 *    retryDelay })` — `force` la hace idempotente y los reintentos absorben
 *    los bloqueos de fichero de Windows (el binding nativo puede tener
 *    handles abiertos un instante).
 * 6. **Best-effort al morir**: `process.on("exit")` + `SIGINT`/`SIGTERM`
 *    borran el run-dir de esa corrida. Es una red adicional: la real es el
 *    barrido del punto 4.
 *
 * **Nunca** se crea un store suelto en `%TEMP%`: siempre dentro de la raíz.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Raíz compartida de todo el scratch de tests (misma para A3 y A4). */
export const TEST_SCRATCH_ROOT = path.join(os.tmpdir(), "ego-test-scratch");

/**
 * Raíz que usa el módulo de producción de A3 (`@ego/tools` →
 * `TempWorkspace.ts`, `TEMP_WORKSPACE_ROOT_NAME = "ego-scratch"`).
 *
 * Se barre TAMBIÉN para que la limpieza funcione desde cualquier zona: si
 * A4 barre la raíz de A3 y A3 barre la de A4, un huérfano se recoge lo
 * mismovite que se produce. La convergencia de nombres (una sola raíz) es
 * la deuda de A3 (ver handoff A4-ola3 §5.3); hasta entonces, esta
 * duplicidad de barrido es lo que evita que la fuga siga creciendo.
 */
export const ALT_SCRATCH_ROOT = path.join(os.tmpdir(), "ego-scratch");

/** Todas las raíces que barre este módulo. */
export const SCRATCH_ROOTS: readonly string[] = [
  TEST_SCRATCH_ROOT,
  ALT_SCRATCH_ROOT,
];

/** Antigüedad máxima de un run-dir antes de considerarlo huérfano. */
export const SCRATCH_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/**
 * `run-<epochMs>-<pid>-<rand6>` (convención de A4) o `run-<pid>-<rand>`
 * (convención de A3 / `TempWorkspace.ts`). Ambos llevan el PID, que es lo
 * que permite saber si el dueño sigue vivo.
 */
const RUN_DIR_RES = [
  /^run-(\d+)-(\d+)-([a-z0-9]+)$/, // A4: run-<epochMs>-<pid>-<rand>
  /^run-(\d+)-([a-z0-9]+)$/, // A3: run-<pid>-<rand>
];

let currentRunDir: string | null = null;
let suiteCounter = 0;
let hooksInstalled = false;

/** ¿Sigue vivo el proceso con ese PID? */
export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM = existe pero no tenemos permiso para señalarlo → VIVO.
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Borra un directorio de scratch. Idempotente y tolerante a bloqueos. */
export function removeScratchDir(dir: string): void {
  if (!dir) return;
  try {
    fs.rmSync(dir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  } catch {
    // Best-effort: el barrido del siguiente run lo recogerá.
  }
}

/**
 * El directorio de la CORRIDA actual (se crea una vez por proceso).
 * Todos los scratch de esta corrida cuelgan de aquí.
 */
export function scratchRunDir(): string {
  if (currentRunDir) return currentRunDir;
  const dir = path.join(
    TEST_SCRATCH_ROOT,
    `run-${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`
  );
  fs.mkdirSync(dir, { recursive: true });
  currentRunDir = dir;
  installExitHooks();
  return dir;
}

/** Crea un directorio de scratch para un test (dentro del run-dir). */
export function createScratchDir(suite: string): string {
  const dir = path.join(scratchRunDir(), `${suite}-${++suiteCounter}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Barre los run-dir huérfanos: los de procesos **muertos** y los
 * demasiado antiguos (PID reutilizado).
 *
 * Barre **las dos raíces** (la de A4 y la de A3) y **las dos convenciones**
 * de nombre, para que la limpieza funcione desde cualquier zona.
 */
export function sweepOrphanScratch(): { removed: string[]; kept: string[] } {
  const removed: string[] = [];
  const kept: string[] = [];
  const now = Date.now();
  for (const root of SCRATCH_ROOTS) {
    let entries: string[] = [];
    try {
      entries = fs.readdirSync(root);
    } catch {
      continue;
    }
    for (const name of entries) {
      const parsed = parseRunDir(root, name);
      if (!parsed) continue;
      const dir = path.join(root, name);
      const deadOwner = parsed.pid !== process.pid && !isProcessAlive(parsed.pid);
      const tooOld = now - parsed.stamp > SCRATCH_MAX_AGE_MS;
      if (deadOwner || tooOld) {
        removeScratchDir(dir);
        removed.push(path.join(path.basename(root), name));
      } else {
        kept.push(path.join(path.basename(root), name));
      }
    }
  }
  return { removed, kept };
}

/** Extrae el PID y la marca de tiempo de un nombre de run-dir. */
function parseRunDir(
  root: string,
  name: string
): { pid: number; stamp: number } | null {
  for (const re of RUN_DIR_RES) {
    const m = re.exec(name);
    if (!m) continue;
    if (m.length === 4) {
      // run-<epochMs>-<pid>-<rand> (convención de A4).
      return { pid: Number(m[2]), stamp: Number(m[1]) };
    }
    // run-<pid>-<rand> (convención de A3 / `TempWorkspace.ts`): sin marca
    // de tiempo → la antigüedad se decide por el `mtime` del directorio.
    let stamp = Date.now();
    try {
      stamp = fs.statSync(path.join(root, name)).mtimeMs;
    } catch {
      /* si no se puede leer, se trata como nuevo */
    }
    return { pid: Number(m[1]), stamp };
  }
  return null;
}

/**
 * Red adicional al barrido: si el proceso muere, borra lo que puede.
 * `exit` cubre el final normal; SIGINT/SIGTERM se re-elevan para no
 * cambiar la semántica por defecto del proceso.
 */
function installExitHooks(): void {
  if (hooksInstalled) return;
  hooksInstalled = true;

  const cleanup = (): void => {
    if (!currentRunDir) return;
    try {
      fs.rmSync(currentRunDir, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      });
    } catch {
      // Best-effort.
    }
  };

  process.once("exit", cleanup);
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      cleanup();
      // Re-elevar la señal con el comportamiento por defecto.
      process.removeAllListeners(signal);
      process.kill(process.pid, signal);
    });
  }
}
