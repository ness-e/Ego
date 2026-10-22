/**
 * Ola 10 (A2-bis) — LA PUERTA DE ATRIBUCIÓN DEL PLANO 1 (CÓDIGO).
 *
 * `EGO-FIND-82`: el contrato de atribución sólo cubría `packages/avatar/`.
 * Este test ejercita la puerta **genérica** que se extiende al resto de
 * `packages/**` (implementación: `packages/tool-call-repair/scripts/
 * check-attribution.mjs`): su denominador es el `provenance.manifest.json`
 * del paquete.
 *
 * ## Qué afirma (comportamiento, no "la puerta existe")
 * 1. Un paquete CONFORME pasa (exit 0).
 * 2. Un **derivado sin cabecera canónica** falla (exit 1) — la puerta MUERDE.
 * 3. Un **nativo con cabecera canónica** falla (exit 1): sería una
 *    atribución falsa (precedente EGO-FIND-83).
 * 4. Un derivado con cabecera que NO está en el manifiesto falla (exit 1):
 *    la atribución no puede vivir fuera del contrato.
 * 5. `--check` es REPRODUCIBLE: sobre un árbol conforme informa 0 cambios y
 *    sale con 0; sobre un árbol no conforme informa el plan de cabeceras y
 *    sale con 1 — y NO escribe nada.
 * 6. El paquete real (`@ego/tool-call-repair`) pasa.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, "..");
const GATE = join(PKG, "scripts", "check-attribution.mjs");

/** Ejecuta la puerta contra un paquete raíz y devuelve {code, report}. */
function runGate(root: string, extra: string[] = []): { code: number; report: any; out: string } {
  let out = "";
  let code = 0;
  try {
    out = execFileSync(process.execPath, [GATE, "--root", root, "--json", ...extra], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e: any) {
    code = e.status ?? 1;
    out = e.stdout ?? "";
  }
  let report: any = null;
  try {
    report = JSON.parse(out);
  } catch {
    /* la puerta pudo fallar antes de emitir el informe */
  }
  return { code, report, out };
}

/**
 * Paquete mínimo conforme: un derivado con cabecera y un nativo sin ella.
 * `derivedHeader` permite construir el caso "derivado SIN cabecera".
 */
function makePackage(options: { derivedHeader?: string | null; nativeHasHeader?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), "ego-attr-"));
  mkdirSync(join(root, "src"), { recursive: true });

  writeFileSync(join(root, "LICENSE"), "MIT License\n\nCopyright (c) 2026 Ego Project\n");
  writeFileSync(join(root, "NOTICE"), "Ego - fixture\n\n1. openclaw - fixture upstream\n   MIT License\n");
  writeFileSync(
    join(root, "LICENSE.md"),
    "# Licencias\n\n## openclaw\n\nMIT - Copyright (c) 2026 OpenClaw Foundation.\n\n" +
      "| `src/derived.ts` | openclaw | `packages/tool-call-repair/src/grammar.ts` | MIT |\n",
  );
  writeFileSync(
    join(root, "provenance.manifest.json"),
    JSON.stringify(
      {
        version: 1,
        package: "fixture",
        headerForm: "Adapted from <upstream> (<LICENCIA>), <ruta de origen>",
        coverage: "all",
        sourceRoots: ["src"],
        upstreams: {
          openclaw: { license: "MIT", human: "OpenClaw", reference: "repos-referencia/openclaw" },
        },
        derived: [
          {
            path: "src/derived.ts",
            upstream: "openclaw",
            origin: "packages/tool-call-repair/src/grammar.ts",
            evidence: "port medido",
          },
        ],
        native: [{ path: "src/native.ts", reason: "implementación propia de Ego" }],
      },
      null,
      2,
    ) + "\n",
  );

  const derivedHeader =
    options.derivedHeader === null
      ? "// derived.ts - fichero derivado SIN cabecera.\nexport const derived = 1;\n"
      : (options.derivedHeader ??
        "// derived.ts - fichero derivado.\n" +
          "// Adapted from openclaw (MIT), packages/tool-call-repair/src/grammar.ts\n" +
          "export const derived = 1;\n");
  writeFileSync(join(root, "src", "derived.ts"), derivedHeader);
  writeFileSync(
    join(root, "src", "native.ts"),
    options.nativeHasHeader
      ? "// native.ts - propio de Ego.\n" +
        "// Adapted from openclaw (MIT), packages/tool-call-repair/src/grammar.ts\n" +
        "export const native = 1;\n"
      : "// native.ts - propio de Ego.\nexport const native = 1;\n",
  );
  return root;
}

describe("puerta de atribución (plano 1 · código) — EGO-FIND-82", () => {
  it("un paquete CONFORME pasa (exit 0)", () => {
    const root = makePackage();
    try {
      const { code, report } = runGate(root);
      expect(code, `problemas: ${JSON.stringify(report?.problems)}`).toBe(0);
      expect(report.ok).toBe(true);
      expect(report.derived).toEqual(["src/derived.ts"]);
      expect(report.native).toEqual(["src/native.ts"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("un DERIVADO SIN cabecera canónica falla (exit 1) — la puerta muerde", () => {
    const root = makePackage({ derivedHeader: null });
    try {
      const { code, report } = runGate(root);
      expect(code).toBe(1);
      expect(
        report.problems.some((p: string) => p.includes("derived.ts") && /cabecera/i.test(p)),
        `problemas: ${JSON.stringify(report.problems)}`,
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("un NATIVO CON cabecera canónica falla (exit 1): sería una atribución falsa", () => {
    const root = makePackage({ nativeHasHeader: true });
    try {
      const { code, report } = runGate(root);
      expect(code).toBe(1);
      expect(
        report.problems.some((p: string) => p.includes("native.ts")),
        `problemas: ${JSON.stringify(report.problems)}`,
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("un derivado con cabecera SIN declarar en el manifiesto falla (exit 1)", () => {
    const root = makePackage();
    try {
      writeFileSync(
        join(root, "src", "otro.ts"),
        "// otro.ts - un port sin contrato.\n" +
          "// Adapted from openclaw (MIT), packages/tool-call-repair/src/grammar.ts\n" +
          "export const otro = 1;\n",
      );
      const { code, report } = runGate(root);
      expect(code).toBe(1);
      expect(
        report.problems.some((p: string) => p.includes("otro.ts") && /manifiesto/i.test(p)),
        `problemas: ${JSON.stringify(report.problems)}`,
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("un paquete SIN LICENSE.md (con código derivado) falla (exit 1)", () => {
    const root = makePackage();
    try {
      rmSync(join(root, "LICENSE.md"));
      const { code, report } = runGate(root);
      expect(code).toBe(1);
      expect(
        report.problems.some((p: string) => /LICENSE\.md/i.test(p)),
        `problemas: ${JSON.stringify(report.problems)}`,
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("`--check` es REPRODUCIBLE: 0 cambios en un árbol conforme, y NO escribe", () => {
    const root = makePackage();
    try {
      const antes = readFileSync(join(root, "src", "derived.ts"), "utf8");
      const { code, report } = runGate(root, ["--check"]);
      expect(code, `problemas: ${JSON.stringify(report?.problems)}`).toBe(0);
      expect(report.changes).toEqual([]);
      // Repetir el check da el mismo resultado (reproducible).
      const second = runGate(root, ["--check"]);
      expect(second.code).toBe(0);
      expect(second.report.changes).toEqual([]);
      // Y no ha escrito nada.
      expect(readFileSync(join(root, "src", "derived.ts"), "utf8")).toBe(antes);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("`--check` sobre un árbol NO conforme informa el plan y sale con 1 (sin escribir)", () => {
    const root = makePackage({ derivedHeader: null });
    try {
      const antes = readFileSync(join(root, "src", "derived.ts"), "utf8");
      const { code, report } = runGate(root, ["--check"]);
      expect(code).toBe(1);
      expect(report.changes.length).toBeGreaterThan(0);
      expect(report.changes[0].path).toBe("src/derived.ts");
      expect(report.changes[0].line).toMatch(
        /Adapted from openclaw \(MIT\), packages\/tool-call-repair\/src\/grammar\.ts/,
      );
      expect(readFileSync(join(root, "src", "derived.ts"), "utf8")).toBe(antes);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("el paquete REAL (@ego/tool-call-repair) pasa (exit 0)", () => {
    const { code, report } = runGate(PKG);
    expect(code, `problemas: ${JSON.stringify(report?.problems)}`).toBe(0);
    expect(report.derived.length).toBe(2);
    expect(report.native.length).toBe(1);
    expect(existsSync(join(PKG, "provenance.manifest.json"))).toBe(true);
  });
});
