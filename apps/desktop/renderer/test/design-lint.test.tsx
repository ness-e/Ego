/**
 * design-lint.test.tsx — la PUERTA DE CALIDAD del design system de Ego.
 *
 * El design system está documentado (`docs/design/design-system.md` §1 tokens
 * y §7 las 7 combinaciones prohibidas de contraste) pero las reglas eran
 * *prosa*: nadie las ejecutaba y el código divergía. `apps/desktop/scripts/
 * design-lint.cjs` es el linter que las hace cumplir; este test es el
 * contrato que demuestra que la puerta:
 *
 *   1. está ENCENDIDA sobre el renderer actual (0 violaciones de las reglas
 *      ERROR, con la lista blanca de deuda heredada documentada abajo);
 *   2. DETECTA de verdad las violaciones (fixture en un tmpdir);
 *   3. mide la adopción del kit (`rawControls`).
 *
 * Por qué NO se duplica la lógica del linter: el test invoca el script real
 * con `--json` y parsea su informe. Si el linter cambia, el test lo ve.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/* ------------------------------------------------------------------ *
 * Rutas
 * ------------------------------------------------------------------ */

/** Directorio del propio test (`apps/desktop/renderer/test`). */
const TEST_DIR = dirname(fileURLToPath(import.meta.url));

/** Raíz del renderer (`apps/desktop/renderer`). */
const RENDERER_ROOT = resolve(TEST_DIR, "..");

/** El linter (`apps/desktop/scripts/design-lint.cjs`). */
const SCRIPT_PATH = resolve(TEST_DIR, "..", "..", "scripts", "design-lint.cjs");

/* ------------------------------------------------------------------ *
 * Tipos del informe JSON que emite el linter
 * ------------------------------------------------------------------ */

type Severity = "error" | "warning";
type ExemptionKind = "estructural" | "deuda";

interface LintFinding {
  readonly rule: string;
  readonly severity: Severity;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly match: string;
  readonly message: string;
}

interface LintRuleSummary {
  readonly severity: Severity;
  readonly title: string;
  readonly count: number;
  readonly suppressed: number;
}

interface LintWhitelistEntry {
  readonly rule: string;
  readonly files: readonly string[];
  readonly lines: readonly (readonly number[])[] | null;
  readonly match: string | null;
  readonly reason: string;
  readonly since: string;
  readonly findingId: string | null;
  readonly kind: ExemptionKind;
}

interface LintReport {
  readonly version: number;
  readonly baseDir: string;
  readonly filesScanned: number;
  readonly rules: Readonly<Record<string, LintRuleSummary>>;
  readonly findings: readonly LintFinding[];
  readonly suppressed: readonly (LintFinding & {
    readonly reason: string;
    readonly since: string;
    readonly findingId: string | null;
    readonly kind: ExemptionKind;
  })[];
  readonly staleWhitelist: readonly {
    readonly rule: string;
    readonly file: string;
    readonly reason: string;
    readonly since: string;
    readonly findingId: string | null;
  }[];
  readonly internalErrors: readonly { readonly file: string; readonly message: string }[];
  readonly rawControls: {
    readonly total: number;
    readonly byKind: { readonly button: number; readonly input: number; readonly textarea: number };
    readonly byFile: Readonly<
      Record<string, { readonly button: number; readonly input: number; readonly textarea: number; readonly total: number }>
    >;
  };
  readonly whitelist: readonly LintWhitelistEntry[];
  readonly allowedArbitraryTextSizes: readonly string[];
  /**
   * Las escalas fijas del design system, en forma machine-readable.
   * La puerta las publica para que el test verifique que el CONTRATO
   * (qué radio, qué superficie, qué altura de cabecera) es el que dice
   * `docs/design/design-system.md` §1 y §6, y no el que le dé la gana al
   * linter.
   */
  readonly scales: {
    readonly palette: {
      readonly rawFamilies: readonly string[];
      readonly colorUtilities: readonly string[];
      readonly tokens: readonly string[];
      readonly scrim: { readonly pattern: string; readonly requiresOverlaySignature: boolean };
    };
    readonly radius: {
      readonly allowedSizes: readonly string[];
      readonly allowedArbitrary: readonly string[];
    };
    readonly surfaces: {
      readonly solid: readonly string[];
      readonly derivedWithAlpha: string;
    };
    readonly headerHeights: {
      readonly enforced: readonly string[];
      readonly recognized: readonly string[];
      readonly chromeMarkers: readonly string[];
    };
  };
  readonly summary: { readonly errors: number; readonly warnings: number; readonly total: number; readonly suppressed: number };
  readonly ok: boolean;
}

interface LintRun {
  readonly report: LintReport;
  readonly status: number;
  readonly stderr: string;
}

/* ------------------------------------------------------------------ *
 * Ejecución del linter
 * ------------------------------------------------------------------ */

/**
 * Ejecuta `design-lint.cjs --json [dirs...]` y devuelve el informe parseado
 * junto con el código de salida.
 *
 * `execFileSync` lanza cuando el proceso sale con código != 0, que es
 * exactamente lo que pasa cuando la puerta encuentra violaciones: por eso
 * el error se captura para leer su `status` y su `stdout`.
 */
function runDesignLint(args: readonly string[] = []): LintRun {
  const argv = [SCRIPT_PATH, "--json", ...args];
  try {
    const stdout = execFileSync(process.execPath, argv, {
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024,
    });
    return { report: JSON.parse(stdout) as LintReport, status: 0, stderr: "" };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    const stdout = failure.stdout ?? "";
    if (stdout.trim() === "") throw error;
    return {
      report: JSON.parse(stdout) as LintReport,
      status: failure.status ?? 1,
      stderr: failure.stderr ?? "",
    };
  }
}

/** Formatea una lista de hallazgos para un mensaje de aserción legible. */
function describeFindings(findings: readonly LintFinding[]): string {
  if (findings.length === 0) return "(ninguno)";
  return findings.map((f) => `${f.file}:${f.line}:${f.column} ${f.rule} ${f.match}`).join("\n");
}

/* ------------------------------------------------------------------ *
 * LISTA BLANCA — el registro explícito de lo que la puerta NO bloquea.
 *
 * Fuente de verdad: la tabla `WHITELIST` de `design-lint.cjs`. Aquí se
 * replica el ÍNDICE (id + regla + tipo) para que el cambio de la lista
 * blanca sea un diff visible en el test y no una edición silenciosa.
 *
 * Estado a 2026-10-20 (Ola 2 — migración del renderer al design system):
 * la deuda REAL quedó eliminada, no exentada. Sólo sobreviven las
 * excepciones ESTRUCTURALES, que existen por diseño:
 *   - EGO-DL-001 · provider de tokens (los hex viven donde nacen los tokens),
 *   - EGO-DL-002 · motor de avatar (la paleta de sprites es dato del personaje),
 *   - EGO-DL-003 · paleta de presets del avatar en WardrobeSelector,
 *   - EGO-DL-004 · posicionamiento calculado en runtime (SelectionToolbar).
 *
 * DEUDA AGRUPADA (heredada; la puerta absorbe el histórico para que el
 * CÓDIGO NUEVO no pueda reincidir, pero cada fichero sigue enumerado):
 *   - EGO-DL-016 · R7 · `ui-kit/Modal.tsx` (paleta cruda del banner de error),
 *   - EGO-DL-020 · R7 · paleta cruda de Tailwind (`emerald-*`, `rose-*`…),
 *   - EGO-DL-021 · R9 · radio fuera de la escala de 3 pasos,
 *   - EGO-DL-022 · R10 · cabecera con altura fuera del chrome (`h-11`),
 *   - EGO-DL-023 · R11 · superficie derivada con alfa (`bg-panel/95`…).
 *
 * Cada entrada lleva: motivo, fecha de alta e ID de hallazgo. Ninguna
 * exención existe para R6 (`<select>` nativo): el renderer no debe tener
 * ninguno (ADR-0015). Ninguna exención existe para R8: es una métrica, no
 * una regla.
 * ------------------------------------------------------------------ */
interface ExpectedExemption {
  readonly id: string;
  readonly rule: string;
  readonly kind: ExemptionKind;
  /** Motivo resumido (la versión larga vive en `design-lint.cjs`). */
  readonly motivo: string;
}

const EXPECTED_EXEMPTIONS: readonly ExpectedExemption[] = [
  {
    id: "EGO-DL-001",
    rule: "R1",
    kind: "estructural",
    motivo: "Fuente canónica de tokens: los valores fijos medidos viven aquí (dim, border-strong, focus-ring, text-on-brand).",
  },
  {
    id: "EGO-DL-002",
    rule: "R1",
    kind: "estructural",
    motivo: "Motor de personaje (Canvas 2D): la paleta de sprites es dato del avatar, no tema de UI.",
  },
  {
    id: "EGO-DL-003",
    rule: "R1",
    kind: "estructural",
    motivo: "Paleta de presets del avatar (WardrobeSelector): dato del personaje, no tema de UI.",
  },
  {
    id: "EGO-DL-004",
    rule: "R2",
    kind: "estructural",
    motivo: "Posicionamiento calculado en runtime (coordenadas de selección): Tailwind no puede expresarlo.",
  },
  {
    id: "EGO-DL-021",
    rule: "R9",
    kind: "deuda",
    motivo: "Deuda heredada: radio fuera de la escala de 3 pasos (`rounded` a secas = 4px, `rounded-{lg,xl,2xl,3xl}`).",
  },
  {
    id: "EGO-DL-024",
    rule: "R12",
    kind: "deuda",
    motivo:
      "Deuda heredada: CSS crudo fuera del design system (`!important` y colores rgb()/hsl() literales) en el CSS legacy del flotante.",
  },
];

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */

describe("design-lint — puerta de calidad del design system", () => {
  describe("renderer actual", () => {
    const { report, status } = runDesignLint();

    it("escanea el renderer y no deja errores internos", () => {
      expect(report.filesScanned).toBeGreaterThan(50);
      expect(report.internalErrors).toEqual([]);
    });

    it("tiene 0 violaciones en las reglas ERROR (R1 hex, R2 style={{}}, R6 select nativo, R7 crudos, R9 radio, R10 cabecera, R11 superficie)", () => {
      const errorRules = ["R1", "R2", "R6", "R7", "R9", "R10", "R11"] as const;
      for (const rule of errorRules) {
        const violations = report.findings.filter((f) => f.rule === rule);
        expect(
          violations,
          `La puerta debe estar verde en ${rule}. Violaciones:\n${describeFindings(violations)}`,
        ).toHaveLength(0);
        expect(report.rules[rule]?.count ?? 0).toBe(0);
      }
    });

    it("sale con código 0 (la puerta PASA) sobre el renderer actual", () => {
      expect(
        report.summary.errors,
        `Errores sin grandfatherar:\n${describeFindings(report.findings.filter((f) => f.severity === "error"))}`,
      ).toBe(0);
      expect(report.ok).toBe(true);
      expect(status).toBe(0);
    });

    it("declara las 12 reglas con severidad y título", () => {
      const rules = report.rules;
      expect(Object.keys(rules).sort()).toEqual([
        "R1",
        "R10",
        "R11",
        "R12",
        "R2",
        "R3",
        "R4",
        "R5",
        "R6",
        "R7",
        "R8",
        "R9",
      ]);
      for (const [id, summary] of Object.entries(rules)) {
        expect(summary.title.length, `${id} debe tener título`).toBeGreaterThan(0);
        expect(["error", "warning"]).toContain(summary.severity);
      }
      // R1..R7 y R9..R12 bloquean (exit 1); R8 es métrica (aviso).
      for (const id of [
        "R1",
        "R2",
        "R3",
        "R4",
        "R5",
        "R6",
        "R7",
        "R9",
        "R10",
        "R11",
        "R12",
      ]) {
        expect(rules[id]?.severity, `${id} debe ser error`).toBe("error");
      }
      expect(rules["R8"]?.severity).toBe("warning");
    });

    it("publica las escalas fijas del design system (contrato machine-readable)", () => {
      const { scales } = report;
      // Radio: 3 pasos + `none` (ausencia de radio, no un cuarto paso).
      expect([...scales.radius.allowedSizes].sort()).toEqual(["full", "md", "none"]);
      expect(scales.radius.allowedArbitrary).toEqual(["var(--radius-card)"]);
      // Superficies: 3 niveles sólidos; el alfa derivado está prohibido.
      expect([...scales.surfaces.solid].sort()).toEqual(["bg-panel", "bg-paper", "bg-raised"]);
      expect(scales.surfaces.derivedWithAlpha).toBe("error");
      // Chrome: `h-11` es el canónico; se bloquean `h-12` y `h-10`.
      expect([...scales.headerHeights.enforced].sort()).toEqual(["h-10", "h-12"]);
      expect(scales.headerHeights.recognized.length).toBeGreaterThan(0);
      // Paleta: las familias crudas de Tailwind que el sistema sustituye.
      expect(scales.palette.rawFamilies).toContain("emerald");
      expect(scales.palette.rawFamilies).toContain("rose");
      expect(scales.palette.rawFamilies).toContain("cyan");
      expect(scales.palette.tokens).toContain("success");
      expect(scales.palette.scrim.requiresOverlaySignature).toBe(true);
    });

    it("mantiene la lista blanca de tamaños arbitrarios explícita y auditable", () => {
      // Vacía a propósito: la lista blanca global de `text-[Npx]` debe
      // revisarse a mano cuando alguien necesite un tamaño fuera de escala.
      expect(Array.isArray(report.allowedArbitraryTextSizes)).toBe(true);
      expect(report.allowedArbitraryTextSizes).toEqual([]);
    });
  });

  describe("lista blanca", () => {
    const { report } = runDesignLint();

    it("tiene el mismo índice de exenciones que el test declara", () => {
      const fromScript = report.whitelist.map((e) => ({
        id: e.findingId ?? "",
        rule: e.rule,
        kind: e.kind,
      }));
      expect(fromScript).toEqual(
        EXPECTED_EXEMPTIONS.map((e) => ({ id: e.id, rule: e.rule, kind: e.kind })),
      );
    });

    it("cada exención lleva motivo, fecha de alta e ID de hallazgo", () => {
      for (const entry of report.whitelist) {
        expect(entry.findingId, "toda exención necesita ID de hallazgo").toMatch(/^EGO-DL-\d{3}$/);
        expect(entry.reason.trim().length, `${entry.findingId} necesita motivo`).toBeGreaterThan(20);
        expect(entry.since, `${entry.findingId} necesita fecha de alta`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(["estructural", "deuda"]).toContain(entry.kind);
        expect(entry.files.length, `${entry.findingId} debe enumerar sus ficheros`).toBeGreaterThan(0);
      }
    });

    it("no exime R6 (select nativo) ni R8 (métrica): no hay por dónde colarse", () => {
      for (const entry of report.whitelist) {
        expect(entry.rule, `${entry.findingId} no puede eximir R6 ni R8`).not.toBe("R6");
        expect(entry.rule, `${entry.findingId} no puede eximir R6 ni R8`).not.toBe("R8");
      }
    });

    it("los ficheros exentos existen en disco (la lista no puede apuntar al vacío)", () => {
      for (const entry of report.whitelist) {
        for (const file of entry.files) {
          expect(existsSync(join(RENDERER_ROOT, file)), `${entry.findingId} → ${file} no existe`).toBe(true);
        }
      }
    });

    it("las exenciones estructurales siguen vivo (no se han roto)", () => {
      // Una exención `estructural` justifica un invariants del sistema: si
      // deja de aplican, hay que revisar el motivo, no dejarla colgada.
      const stale = report.staleWhitelist.filter((s) => {
        const expected = EXPECTED_EXEMPTIONS.find((e) => e.id === s.findingId);
        return expected?.kind === "estructural";
      });
      expect(stale, `Exenciones estructurales obsoletas: ${JSON.stringify(stale)}`).toEqual([]);
    });

    it("la deuda heredada queda contabilizada y trazable", () => {
      // Cada exención de deuda debe estar realmente suprimiendo algo: la
      // lista blanca es un registro vivo, no un parche ciego.
      for (const entry of report.whitelist) {
        const suppressedFor = report.suppressed.filter((s) => s.findingId === entry.findingId);
        if (entry.kind === "deuda") {
          expect(suppressedFor.length, `${entry.findingId} no suprime nada`).toBeGreaterThan(0);
          for (const s of suppressedFor) {
            expect(s.reason).toBe(entry.reason);
            expect(s.since).toBe(entry.since);
          }
        }
      }
    });
  });

  describe("la puerta está activa", () => {
    /** Escribe un fixture temporal y devuelve el informe del linter. */
    function lintFixture(source: string, prefix = "ego-design-lint-"): LintRun {
      const dir = mkdtempSync(join(tmpdir(), prefix));
      try {
        writeFileSync(join(dir, "Fixture.tsx"), source, "utf8");
        return runDesignLint([dir]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }

    it("detecta un hex literal y un <select> nativo en un fixture temporal", () => {
      const dir = mkdtempSync(join(tmpdir(), "ego-design-lint-"));
      try {
        // Fixture mínimo: SOLO las dos infracciones que se quieren probar.
        // Ni estilos inline, ni clases de paleta cruda, ni text-[Npx]: así
        // el recuento de errores es exactamente 2.
        writeFileSync(
          join(dir, "Fixture.tsx"),
          [
            "export function Fixture(): JSX.Element {",
            "  return (",
            "    <div>",
            '      <span>color {"#ff00aa"}</span>',
            '      <select name="opcion">',
            '        <option value="a">a</option>',
            "      </select>",
            "    </div>",
            "  );",
            "}",
            "",
          ].join("\n"),
          "utf8",
        );

        const run = runDesignLint([dir]);
        const errors = run.report.findings.filter((f) => f.severity === "error");

        expect(errors.map((f) => f.rule).sort()).toEqual(["R1", "R6"]);
        expect(errors.find((f) => f.rule === "R1")?.match).toBe("#ff00aa");
        expect(errors.find((f) => f.rule === "R6")?.match).toContain("select");
        expect(run.status, "el linter debe salir con 1 cuando hay errores").toBe(1);
        expect(run.report.ok).toBe(false);
        expect(run.report.summary.errors).toBe(2);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("enciende con una paleta cruda (bg-emerald-500, text-cyan-400)", () => {
      // R7 era LA puerta que no cubría nada: la regex sólo conocía
      // `white|black|zinc-*`, así que `emerald`/`cyan`/`rose` pasaban
      // desapercibidos. Ahora la paleta por defecto de Tailwind es error.
      const run = lintFixture(
        [
          "export function Fixture(): JSX.Element {",
          "  return (",
          '    <div className="bg-emerald-500" />',
          '    <span className="text-cyan-400">x</span>',
          "  );",
          "}",
          "",
        ].join("\n"),
      );

      const r7 = run.report.findings.filter((f) => f.rule === "R7");
      expect(r7.map((f) => f.match).sort(), `R7 no detectó la paleta cruda:\n${describeFindings(r7)}`).toEqual([
        "bg-emerald-500",
        "text-cyan-400",
      ]);
      expect(run.report.rules["R7"]?.count).toBe(2);
      expect(run.status).toBe(1);
    });

    it("enciende con un radio fuera de escala (rounded-2xl, rounded a secas, rounded-[8px])", () => {
      const run = lintFixture(
        [
          "export function Fixture(): JSX.Element {",
          "  return (",
          '    <div className="rounded-2xl" />',
          '    <div className="rounded" />',
          '    <div className="rounded-[8px]" />',
          "  );",
          "}",
          "",
        ].join("\n"),
      );

      const r9 = run.report.findings.filter((f) => f.rule === "R9");
      expect(r9.map((f) => f.match).sort(), `R9 no detectó el radio fuera de escala:\n${describeFindings(r9)}`).toEqual([
        "rounded",
        "rounded-2xl",
        "rounded-[8px]",
      ]);
      expect(run.status).toBe(1);
    });

    it("enciende con una paleta cruda dentro de una tabla `cva` (T1.5)", () => {
      // El hueco que cerró T1.5: las variantes compuestas por `cva` NO
      // pasan por `className=`, así que sus clases se escapaban de la
      // puerta (un `text-emerald-400` en una variante nueva pasaba).
      const dir = mkdtempSync(join(tmpdir(), "ego-design-lint-"));
      try {
        writeFileSync(
          join(dir, "Fixture.tsx"),
          [
            "import { cva } from './cva.js';",
            "export const variants = cva({",
            "  base: 'inline-flex items-center',",
            "  variants: {",
            "    tone: {",
            "      ok: 'bg-success/10 text-success',",
            "      bad: 'text-emerald-400',",
            "    },",
            "  },",
            "});",
            "",
          ].join("\n"),
          "utf8",
        );

        const run = runDesignLint([dir]);
        const errors = run.report.findings.filter((f) => f.severity === "error");
        expect(
          errors.map((f) => f.rule),
          "la paleta cruda de una variante `cva` debe encender R7"
        ).toEqual(["R7"]);
        expect(errors[0]?.match).toContain("text-emerald-400");
        expect(run.status).toBe(1);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("enciende con CSS crudo: `!important`, `rgb()` y hex fuera de token (T1.6)", () => {
      // El hueco que cerró T1.6: la puerta solo analizaba TSX, así que el
      // CSS del renderer (19 KB en floating/floating.css y cualquier CSS
      // nuevo) quedaba fuera.
      const dir = mkdtempSync(join(tmpdir(), "ego-design-lint-"));
      try {
        writeFileSync(
          join(dir, "Fixture.css"),
          [
            ".panel {",
            "  color: #ff00aa;",
            "  background: rgb(1 2 3);",
            "  z-index: 10 !important;",
            "}",
            "",
          ].join("\n"),
          "utf8",
        );

        const run = runDesignLint([dir]);
        const errors = run.report.findings.filter((f) => f.severity === "error");
        expect(
          errors.map((f) => f.rule).sort(),
          "el CSS crudo debe encender R1 (hex) y R12 (!important / color crudo)"
        ).toEqual(["R1", "R12", "R12"]);
        expect(errors.find((f) => f.match === "#ff00aa")?.rule).toBe("R1");
        expect(
          errors.filter((f) => f.rule === "R12").some((f) => f.match.includes("!")),
          "R12 debe ver el `!important`"
        ).toBe(true);
        expect(
          errors.filter((f) => f.rule === "R12").some((f) => f.match.includes("rgb(")),
          "R12 debe ver el color crudo"
        ).toBe(true);
        expect(run.status).toBe(1);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("NO enciende con el CSS de los ficheros de TOKENS (son la fuente canónica)", () => {
      const dir = mkdtempSync(join(tmpdir(), "ego-design-lint-"));
      try {
        writeFileSync(
          join(dir, "index.css"),
          [
            ":root {",
            "  --color-brand: var(--ego-color-brand, #f59e0b);",
            "  --color-panel: oklch(0.195 0.004 286);",
            "}",
            "",
          ].join("\n"),
          "utf8",
        );
        const run = runDesignLint([dir]);
        const errors = run.report.findings.filter((f) => f.severity === "error");
        expect(
          errors,
          "el fichero de tokens puede llevar hex (con su var(--color-*, …))"
        ).toEqual([]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    /**
     * T2 (Ola 5) — La lista blanca se indexa por la HUELLA del contenido
     * infractor, no por un ID posicional ni por un rango de líneas.
     *
     * Antes, un hex literal nuevo o eliminado en un fichero con excepción
     * desplazaba las líneas: la excepción dejaba de suprimir nada y la
     * puerta fallaba con un error que no explicaba el desplazamiento (o,
     * peor, suprimía otra cosa).
     */
    describe("lista blanca indexada por huella del contenido (T2)", () => {
      /** Ruta relativa de un fichero con excepción estructural (EGO-DL-001). */
      const WHITELISTED_FILE = "components/canvas/DesignSystemProvider.tsx";
      /** Hex que la excepción EGO-DL-001 tiene grabado (token fijo). */
      const WHITELISTED_HEX = "#71717a";

      /** Monta una fixture en la ruta EXACTA de un fichero con excepción. */
      function lintWhitelistedFile(content: string): LintRun {
        const dir = mkdtempSync(join(tmpdir(), "ego-design-lint-"));
        const target = join(dir, WHITELISTED_FILE);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, content, "utf8");
        return runDesignLint([dir]);
      }

      it("(a) sin cambios, el hex con excepción sigue suprimido (la puerta pasa)", () => {
        const run = lintWhitelistedFile(
          [
            "export const tokens = {",
            `  borderStrong: "${WHITELISTED_HEX}",`,
            "};",
            "",
          ].join("\n")
        );
        const errors = run.report.findings.filter((f) => f.severity === "error");
        expect(
          errors.map((f) => f.match),
          `el hex con excepción debe seguir suprimido:\n${describeFindings(errors)}`
        ).toEqual([]);
        expect(run.status).toBe(0);
      });

      it("(b) AÑADIR un hex nuevo a un fichero con excepción hace FALLAR la puerta", () => {
        // El contenido nuevo no está en las huellas de la excepción → no se
        // suprime → la puerta falla de verdad (en vez de desplazar la
        // excepción en silencio).
        const run = lintWhitelistedFile(
          [
            "export const tokens = {",
            `  borderStrong: "${WHITELISTED_HEX}",`,
            '  nuevo: "#ff00aa",',
            "};",
            "",
          ].join("\n")
        );
        const errors = run.report.findings.filter((f) => f.severity === "error");
        expect(
          errors.map((f) => f.match),
          `el hex NUEVO debe encender R1:\n${describeFindings(errors)}`
        ).toEqual(["#ff00aa"]);
        expect(run.status).toBe(1);
      });

      it("(c) ELIMINAR el hex de un fichero con excepción avisa de que la excepción SOBRA", () => {
        // La excepción ya no suprime nada: la puerta lo dice (no lo ignora
        // en silencio) para que se retire de la tabla.
        const run = lintWhitelistedFile(
          ["export const tokens = {", '  otro: "#ff00aa",', "};", ""].join("\n")
        );
        const stale = run.report.staleWhitelist;
        expect(
          stale.length,
          "la excepción debe marcarse como obsoleta"
        ).toBeGreaterThan(0);
        expect(
          stale.map((s) => s.findingId),
          `excepciones obsoletas inesperadas: ${JSON.stringify(stale)}`
        ).toContain("EGO-DL-001");
      });
    });

    it("enciende con una superficie derivada con alfa (bg-panel/95)", () => {
      const run = lintFixture(
        [
          "export function Fixture(): JSX.Element {",
          "  return (",
          '    <div className="bg-panel/95" />',
          '    <div className="bg-raised/40" />',
          '    <div className="bg-paper/80" />',
          "  );",
          "}",
          "",
        ].join("\n"),
      );

      const r11 = run.report.findings.filter((f) => f.rule === "R11");
      expect(r11.map((f) => f.match).sort(), `R11 no detectó la superficie derivada:\n${describeFindings(r11)}`).toEqual([
        "bg-panel/95",
        "bg-paper/80",
        "bg-raised/40",
      ]);
      expect(run.status).toBe(1);
    });

    it("enciende con una cabecera fuera del chrome (h-12)", () => {
      const run = lintFixture(
        [
          "export function Fixture(): JSX.Element {",
          "  return (",
          '    <header className="flex h-12 items-center justify-between border-b border-hairline bg-panel px-3">x</header>',
          "  );",
          "}",
          "",
        ].join("\n"),
      );

      const r10 = run.report.findings.filter((f) => f.rule === "R10");
      expect(r10.map((f) => f.match), `R10 no detectó la cabecera fuera de chrome:\n${describeFindings(r10)}`).toEqual([
        "h-12",
      ]);
      expect(run.status).toBe(1);
    });

    it("R10 distingue una cabecera de una celda-icono (no es ruido)", () => {
      // Un `h-12 w-12` en una celda-icono NO es una cabecera: sin el tag
      // `<header>` y sin marcador de chrome, R10 no debe disparar. Una
      // puerta que grita se deja de escuchar.
      const iconBox = lintFixture(
        [
          "export function Fixture(): JSX.Element {",
          "  return (",
          '    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-brand/20 border border-brand/30 text-brand" />',
          "  );",
          "}",
          "",
        ].join("\n"),
      );
      expect(
        iconBox.report.findings.filter((f) => f.rule === "R10"),
        "una celda-icono no es una cabecera: R10 no debe disparar",
      ).toHaveLength(0);

      // Pero un `<header>` sin marcadores SÍ salta: el tag basta.
      const headerTag = lintFixture(
        [
          "export function Fixture(): JSX.Element {",
          "  return (",
          '    <header className="flex h-10 items-center">x</header>',
          "  );",
          "}",
          "",
        ].join("\n"),
      );
      expect(
        headerTag.report.findings.filter((f) => f.rule === "R10"),
        "un <header> con h-10 debe saltar aunque no lleve marcador",
      ).toHaveLength(1);
    });

    it("acepta los valores que SÍ están en la escala (radio, superficie, cabecera)", () => {
      // La puerta no puede ser un interdiction sin excepciones: si el
      // sistema canónico se marca a sí mismo, la puerta es inservible.
      const run = lintFixture(
        [
          "export function Fixture(): JSX.Element {",
          "  return (",
          '    <div className="rounded-md" />',
          '    <div className="rounded-[var(--radius-card)]" />',
          '    <div className="rounded-full" />',
          '    <div className="rounded-none" />',
          '    <div className="rounded-t-md" />',
          '    <div className="rounded-tl-[var(--radius-card)]" />',
          '    <div className="bg-paper" />',
          '    <div className="bg-panel" />',
          '    <div className="bg-raised" />',
          '    <header className="flex h-11 items-center justify-between border-b border-hairline bg-panel px-3">x</header>',
          "  );",
          "}",
          "",
        ].join("\n"),
      );

      const errors = run.report.findings.filter((f) => f.severity === "error");
      expect(errors, `La puerta debe dejar pasar la escala canónica:\n${describeFindings(errors)}`).toHaveLength(0);
      expect(run.status).toBe(0);
    });

    it("permite el scrim del modal (bg-black/60 con firma de overlay) pero no un negro de superficie", () => {
      // El scrim es una CORTINA (overlay a pantalla completa), no una
      // superficie: es el único uso legítimo del negro crudo. La excepción
      // exige la firma del overlay para que `bg-black/40` como superficie
      // no se cuele por el mismo hueco.
      const scrim = lintFixture(
        [
          "export function Fixture(): JSX.Element {",
          "  return (",
          '    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs" />',
          "  );",
          "}",
          "",
        ].join("\n"),
      );
      expect(
        scrim.report.findings.filter((f) => f.rule === "R7"),
        "el scrim del modal debe permitirse",
      ).toHaveLength(0);
      expect(scrim.status).toBe(0);

      const surface = lintFixture(
        [
          "export function Fixture(): JSX.Element {",
          "  return (",
          '    <div className="bg-black/40" />',
          "  );",
          "}",
          "",
        ].join("\n"),
      );
      expect(
        surface.report.findings.filter((f) => f.rule === "R7"),
        "un negro con alfa como superficie NO es un scrim: debe saltar",
      ).toHaveLength(1);
    });

    it("no exime la paleta cruda por llevar el token equivalente en la misma lista", () => {
      // La exención vieja ("si la misma lista lleva `text-ink`, el `text-white`
      // es inocuo") era falsa: dos utilidades de color que compiten por la
      // misma propiedad NO se anulan, es un conflicto. Ahora salta.
      const run = lintFixture(
        [
          "export function Fixture(): JSX.Element {",
          "  return (",
          '    <div className="text-white text-ink" />',
          "  );",
          "}",
          "",
        ].join("\n"),
      );

      const r7 = run.report.findings.filter((f) => f.rule === "R7");
      expect(r7.map((f) => f.match), `R7 no debe eximir el conflicto:\n${describeFindings(r7)}`).toEqual(["text-white"]);
      expect(run.status).toBe(1);
    });

    it("detecta la paleta cruda dentro de un className con plantilla e interpolación", () => {
      // El motivo por el que R7 veía 0: en un `className={`… ${cond ? "bg-emerald-500" : …}`}`
      // el literal quedaba pegado a comillas y ninguna regla lo reconocía.
      const run = lintFixture(
        [
          "export function Fixture(): JSX.Element {",
          "  return (",
          "    <div",
          "      className={`h-2.5 w-2.5 rounded-full ${",
          '        ok ? "bg-emerald-500 animate-pulse" : "bg-rose-500"',
          "      }`}",
          "    />",
          "  );",
          "}",
          "",
        ].join("\n"),
      );

      const r7 = run.report.findings.filter((f) => f.rule === "R7");
      expect(r7.map((f) => f.match).sort(), `R7 no vio la paleta dentro de la plantilla:\n${describeFindings(r7)}`).toEqual([
        "bg-emerald-500",
        "bg-rose-500",
      ]);
    });

    it("respeta el escape hatch «design-lint: allow»", () => {
      const dir = mkdtempSync(join(tmpdir(), "ego-design-lint-allow-"));
      try {
        writeFileSync(
          join(dir, "Allowed.tsx"),
          [
            "export function Allowed(): JSX.Element {",
            "  return (",
            "    <div>",
            "      {/* design-lint: allow */}",
            "      <span style={{ top: 1 }}>x</span>",
            "    </div>",
            "  );",
            "}",
            "",
          ].join("\n"),
          "utf8",
        );

        const run = runDesignLint([dir]);
        const r2 = run.report.findings.filter((f) => f.rule === "R2");
        expect(r2, `R2 no debe reportar con escape hatch:\n${describeFindings(r2)}`).toHaveLength(0);
        expect(run.status).toBe(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("métrica de adopción del kit (R8)", () => {
    const { report } = runDesignLint();

    it("expone rawControls con total, breakdown por tipo y por fichero", () => {
      const { rawControls } = report;
      expect(typeof rawControls.total).toBe("number");
      expect(rawControls.total).toBeGreaterThan(0);
      expect(Object.keys(rawControls.byFile).length).toBeGreaterThan(0);
      for (const [file, counts] of Object.entries(rawControls.byFile)) {
        expect(typeof file).toBe("string");
        expect(counts.total).toBe(counts.button + counts.input + counts.textarea);
      }
    });

    it("es consistente: los totales cuadran con los desgloses", () => {
      const { rawControls } = report;
      const sumByFile = Object.values(rawControls.byFile).reduce((acc, c) => acc + c.total, 0);
      const sumByKind = rawControls.byKind.button + rawControls.byKind.input + rawControls.byKind.textarea;
      expect(sumByFile).toBe(rawControls.total);
      expect(sumByKind).toBe(rawControls.total);
    });

    it("R8 genera exactamente un aviso por fichero con controles crudos", () => {
      const r8Files = report.findings.filter((f) => f.rule === "R8").map((f) => f.file);
      expect(r8Files.sort()).toEqual(Object.keys(report.rawControls.byFile).sort());
      expect(report.rules["R8"]?.count).toBe(r8Files.length);
    });

    it("no exonera controles nativos: la métrica refleja el estado real", () => {
      // R8 nunca se suprime: el recuento debe reflejar el código tal cual.
      expect(report.suppressed.filter((f) => f.rule === "R8")).toHaveLength(0);
    });
  });
});