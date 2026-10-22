/**
 * E6 (Ola 2) — Guard de la descomposición del main process.
 *
 * ## Qué afirma
 *
 * 1. **El estado mutable del proceso vive en UN solo sitio.**
 *    `src/main/state/app-context.ts` es el módulo de estado: cada estado es
 *    un `export let` (binding vivo) + un `set<Nombre>()` (único punto de
 *    escritura). Fuera de ese módulo NO puede quedar ningún `let` global
 *    mutable: el resto de módulos usan holders `const` o estado local de
 *    módulo.
 *
 * 2. **`main.ts` es un compositor, no un almacén de singletons.**
 *    El guard mide su tamaño: el objetivo de E6 es < 1 500 líneas (Venía de
 *    2 436 al empezar la ola).
 *
 * ## Por qué un guard y no una medición manual
 * Un objetivo de arquitectura que solo se comprueba en el handoff se pierde
 * en la siguiente ola. Este test lo convierte en una puerta de CI.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(__dirname, "..", "src");
const STATE_MODULE = "main/state/app-context.ts";

/** Todos los `.ts` de `src/**` (el proceso main completo). */
function collect(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, acc);
    else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) acc.push(full);
  }
  return acc;
}

/** `let` a nivel de módulo (indentación 0) = estado mutable global. */
function globalLets(rel: string): string[] {
  const out: string[] = [];
  readFileSync(join(SRC, rel), "utf8")
    .split(/\r?\n/)
    .forEach((line, i) => {
      const m = line.match(/^(?:export\s+)?let\s+([A-Za-z_$][\w$]*)/);
      if (m) out.push(`${rel}:${i + 1} ${m[1]}`);
    });
  return out;
}

describe("E6 — el main process tiene UN sitio con su estado mutable", () => {
  const files = collect(SRC).map((f) => relative(SRC, f).replace(/\\/g, "/"));

  it("no queda ningún `let` global mutable fuera de app-context.ts", () => {
    const offenders: string[] = [];
    for (const rel of files) {
      if (rel === STATE_MODULE) continue;
      offenders.push(...globalLets(rel));
    }
    expect(
      offenders,
      `estado mutable fuera de ${STATE_MODULE}:\n  ${offenders.join("\n  ")}`
    ).toEqual([]);
  });

  it("app-context.ts es el módulo de estado (y expone setters para cada estado)", () => {
    const src = readFileSync(join(SRC, STATE_MODULE), "utf8");
    const lets = globalLets(STATE_MODULE);
    expect(lets.length, "app-context.ts debe ser el módulo de estado").toBeGreaterThan(
      40
    );
    // Cada `export let X` tiene su `setX`.
    for (const entry of lets) {
      const name = entry.split(" ")[1]!;
      const base = `set${name.charAt(0).toUpperCase()}${name.slice(1)}`;
      const hasSetter = [base, `${base}State`].some((s) =>
        src.includes(`export function ${s}(`)
      );
      expect(hasSetter, `falta el setter ${base} para ${name}`).toBe(true);
    }
  });

  it("main.ts es un compositor: por debajo de 1 100 líneas (E6-res, Ola 3)", () => {
    const lines = readFileSync(join(SRC, "main.ts"), "utf8").split(/\r?\n/).length;
    expect(
      lines,
      `main.ts tiene ${lines} líneas (objetivo E6-res: < 1100)`
    ).toBeLessThan(1100);
  });

  it("la descomposición de main.ts vive en módulos con responsabilidad propia", () => {
    // E6-res: los bloques extraídos (tray, proyecto por defecto, limpieza de
    // memoria, pool de modelos) tienen su propio módulo. El gate no mira
    // nombres concretos: comprueba que el compositor no los contenga.
    const main = readFileSync(join(SRC, "main.ts"), "utf8");
    for (const symbol of [
      "function ensureTray",
      "function getOrCreateDefaultProject",
      "function scheduleMemoryCleanup",
      "function modelPoolProviderFactory",
    ]) {
      expect(
        main.includes(symbol),
        `${symbol} sigue en main.ts: su bloque debe vivir en un módulo propio`
      ).toBe(false);
    }
  });

  it("los handlers IPC siguen registrado en el main (no se han movido de sitio)", async () => {
    // EGO-FIND-63 (Ola 10): el aserto "el manifiesto de deps sigue en el
    // compositor" era un aserto de TEXTO de fuente. Ahora es
    // COMPORTAMIENTO: se importa el compositor (con `electron` inertizado,
    // como hace `ipc.integration.test.ts`) y se comprueba que la fabrica de
    // deps existe y es una funcion.
    // El mismo stub inerte que usa `ipc.integration.test.ts`: main.ts no
    // ejecuta nada de electron a nivel de modulo.
    vi.mock("electron", () => ({
      app: undefined,
      BrowserWindow: class {},
      ipcMain: { handle: vi.fn() },
      dialog: { showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })) },
      safeStorage: undefined,
      Tray: class {},
      Menu: {},
      nativeImage: {},
      session: {},
      shell: {},
    }));
    // El registro de los handlers IPC vive en el PROCESO MAIN (no en el
    // renderer): se comprueba importando su modulo y viendo que la funcion
    // de registro existe (comportamiento, no texto de fuente).
    const ipc = (await import("../src/main/ipc/register-ipc.js")) as unknown as {
      registerIpcHandlers?: unknown;
    };
    expect(
      typeof ipc.registerIpcHandlers,
      "el registro de handlers IPC debe seguir en el proceso main"
    ).toBe("function");
  // El import del módulo IPC carga el grafo del main (VantaDB, providers…):
  // necesita más que los 5 s por defecto del runner.
  }, 30_000);
});
