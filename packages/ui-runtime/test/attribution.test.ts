import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

/**
 * Puerta de atribución de código derivado (plano 1: CÓDIGO).
 *
 * Reglas (EGO-FIND-82 / EGO-FIND-83):
 * - Un fichero **realmente derivado** (port literal) lleva la cabecera
 *   canónica `// Adapted from <upstream> (<LICENCIA>), <ruta de origen>`.
 * - Un fichero que **afirma** derivación sin esa cabecera es un error: o se
 *   normaliza a la forma canónica, o se corrige la cabecera para que diga la
 *   verdad ("implementación propia de Ego", sin `Adapted from`).
 * - Todo fichero derivado está listado en el `LICENSE.md` del paquete, con el
 *   aviso de licencia de su upstream.
 *
 * Ola 10 (A2-bis): el contrato tiene DENOMINADOR — el
 * `provenance.manifest.json` del paquete. La puerta de `scripts/
 * check-attribution.mjs` (implementación genérica compartida, alojada en
 * `@ego/tool-call-repair`) clasifica fichero a fichero y MUERDE: un derivado
 * sin cabecera ⇒ exit 1; un nativo con cabecera ⇒ exit 1.
 */

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(PKG, "src");
const LICENSE_MD = path.join(PKG, "LICENSE.md");
const MANIFEST = path.join(PKG, "provenance.manifest.json");
const GATE = path.join(PKG, "scripts", "check-attribution.mjs");

const CANONICAL = /^\s*(?:\/\/|\/\*\*?)?\s*Adapted from\s+([^(]+?)\s*\(([^)]+)\),\s*(.+)$/m;
const CLAIMS_DERIVATION =
  /Extra[ií]d[oa] y adaptad[oa]|Adaptad[oa] de|C[oó]digo \*\*derivad|C[oó]digo derivad|Puerto literal|port literal/i;
/** Una NEGACIÓN ("no hay atribución de código derivado") no es una afirmación. */
const NEGATION = /No hay atribución|sin atribución de c[oó]digo derivado|no hay traducci[oó]n/i;
/** La cabecera se lee en las 60 primeras líneas (un docblock puede empezar más abajo). */
const HEADER_LINES = 60;

interface Derived {
  file: string;
  rel: string;
  upstream: string;
  license: string;
  origin: string;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) out.push(p);
  }
  return out;
}

/** Ficheros con cabecera canónica, con su upstream/licencia/ruta de origen. */
function derivedFiles(): Derived[] {
  const out: Derived[] = [];
  for (const file of sourceFiles(SRC)) {
    const text = fs.readFileSync(file, "utf8");
    const m = CANONICAL.exec(text);
    if (!m) continue;
    out.push({
      file,
      rel: path.relative(PKG, file).split(path.sep).join("/"),
      upstream: (m[1] ?? "").trim(),
      license: (m[2] ?? "").trim(),
      origin: (m[3] ?? "").trim(),
    });
  }
  return out;
}

describe("Puerta de atribución de código derivado", () => {
  it("ningún fichero afirma derivación sin la cabecera canónica", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const text = fs.readFileSync(file, "utf8");
      const lines = text.split(/\r?\n/).slice(0, HEADER_LINES);
      const claims = lines
        .map((l, i) => ({ line: l, i }))
        .filter(({ line }) => CLAIMS_DERIVATION.test(line))
        // Una NEGACIÓN puede estar partida entre dos líneas ("... es propio. Sin"
        // / "atribución de código derivado."): se mira una ventana alrededor.
        .filter(({ i }) => {
          const window = lines
            .slice(Math.max(0, i - 2), i + 3)
            .map((l) => l.replace(/^\s*\*\s?/, "").replace(/^\s*\/\*\*?\s*/, ""))
            .join(" ");
          return !NEGATION.test(window);
        });
      if (claims.length === 0) continue;
      if (CANONICAL.test(text)) continue;
      offenders.push(path.relative(PKG, file));
    }
    expect(offenders).toEqual([]);
  });

  it("todo fichero derivado está listado en el LICENSE.md con su upstream y su licencia", () => {
    const derived = derivedFiles();
    // Un paquete SIN código derivado no necesita LICENSE.md (crear uno sería ruido).
    if (derived.length === 0) return;
    expect(fs.existsSync(LICENSE_MD)).toBe(true);
    const license = fs.readFileSync(LICENSE_MD, "utf8");
    for (const d of derived) {
      expect(license, `${d.rel} no está en el LICENSE.md`).toContain(d.rel);
      expect(license, `falta el aviso de ${d.upstream}`).toContain(d.upstream);
      expect(license, `falta la licencia ${d.license}`).toContain(d.license);
      expect(license, `falta la ruta de origen ${d.origin}`).toContain(d.origin);
    }
  });

  it("el MANIFIESTO de procedencia clasifica todo lo atribuible y la puerta pasa", () => {
    // El denominador del contrato: sin manifiesto no hay cobertura auditable.
    expect(fs.existsSync(MANIFEST), "falta provenance.manifest.json").toBe(true);
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
    expect(manifest.derived.length, "el paquete declara sus derivados").toBeGreaterThan(0);

    // La puerta (genérica, compartida) debe pasar sobre el paquete real.
    let out = "";
    let code = 0;
    try {
      out = execFileSync(process.execPath, [GATE, "--root", PKG, "--json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (e) {
      code = (e as { status?: number }).status ?? 1;
      out = (e as { stdout?: string }).stdout ?? "";
    }
    let report: { ok?: boolean; problems?: string[] } | null = null;
    try {
      report = JSON.parse(out);
    } catch {
      /* la puerta pudo fallar antes de emitir el informe */
    }
    expect(code, `la puerta debe pasar; problemas: ${JSON.stringify(report?.problems)}`).toBe(0);
    expect(report?.ok).toBe(true);
  });
});
