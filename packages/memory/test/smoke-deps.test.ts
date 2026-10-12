import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * F2T6 / H05+M05 — Pines de dependencia canónica y bloqueo WASM.
 * Vía única de import: `vantadb/native` + `vantadb/types` (dep `vantadb`
 * versionada). Prohibido: `Client` WASM, `vantadb-wasm`, import directo
 * de `vantadb-node` desde el código de `@ego/memory`.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.resolve(here, "..");

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /from\s+["']vantadb["']/, label: 'import bare "vantadb" (Client WASM)' },
  // Solo especificadores de import entre comillas (la prosa de prohibición en
  // comentarios no cuenta como dependencia).
  { pattern: /["']vantadb-wasm["']/, label: "vantadb-wasm" },
  { pattern: /from\s+["']vantadb-node["']/, label: 'import directo "vantadb-node"' },
  { pattern: /new\s+Client\s*\(/, label: "new Client() WASM" },
];

function sourceFiles(): string[] {
  return fs
    .readdirSync(pkgDir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => path.join(pkgDir, f));
}

describe("F2T6/H05+M05 — Dependencia canónica y bloqueo WASM", () => {
  it("vantadb/native expone NativeVantaDB con factory connect (dep canónica operativa)", async () => {
    const native = await import("vantadb/native");
    expect(native.NativeVantaDB).toBeDefined();
    expect(typeof native.NativeVantaDB.connect).toBe("function");
  });

  it("ningún fuente de @ego/memory importa vía prohibida (wasm/bare/directa)", () => {
    const violations: string[] = [];
    for (const file of sourceFiles()) {
      const content = fs.readFileSync(file, "utf8");
      for (const { pattern, label } of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`${path.basename(file)}: ${label}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("package.json declara la dep canónica vantadb versionada", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.["vantadb"]).toBeDefined();
  });
});
