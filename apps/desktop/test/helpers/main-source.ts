import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Fuente completa del main process para los guards de contrato.
 *
 * T11 (EGO-FIND-54) descomponió el god-file `src/main.ts`: los 81 handlers
 * IPC viven ahora en `src/main/ipc/register-ipc.ts` y el resto de la lógica
 * en `src/main/**`. Los guards que verifican la superficie IPC (contrato,
 * cobertura Zod, cableado de tasks) deben ver el conjunto, no un solo
 * fichero — por eso se concatena todo `src/main/**` más `src/main.ts`.
 */
const SRC = join(__dirname, "..", "..", "src");

function collect(dir: string, acc: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.endsWith(".d.ts")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collect(full, acc);
    } else if (entry.endsWith(".ts")) {
      acc.push(full);
    }
  }
}

export function readMainSource(): string {
  const files: string[] = [join(SRC, "main.ts")];
  collect(join(SRC, "main"), files);
  return files
    .map((f) => `// ── ${f.slice(SRC.length + 1)} ──\n${readFileSync(f, "utf-8")}`)
    .join("\n");
}
