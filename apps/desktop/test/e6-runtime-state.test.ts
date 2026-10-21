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
import { describe, it, expect } from "vitest";
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

  it("main.ts es un compositor: por debajo de 1 500 líneas", () => {
    const lines = readFileSync(join(SRC, "main.ts"), "utf8").split(/\r?\n/).length;
    expect(
      lines,
      `main.ts tiene ${lines} líneas (objetivo E6: < 1500)`
    ).toBeLessThan(1500);
  });

  it("los handlers IPC siguen registrado en el main (no se han movido de sitio)", () => {
    const main = readFileSync(join(SRC, "main.ts"), "utf8");
    // El manifiesto de deps sigue en el compositor.
    expect(main).toContain("createIpcDeps");
    // Y el registro ocurre en el proceso main (no en el renderer).
    const tree = collect(SRC)
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    expect(tree).toContain("registerIpcHandlers(");
  });
});
