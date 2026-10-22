import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectPromptInjection } from "../src/PromptInjectionDetector.js";

/**
 * Medición de la **tasa de falsos positivos** del detector sobre el corpus
 * REAL del repo (Ola 9 · requisito de la decisión del owner: *"sin falsos
 * positivos desbordados"*).
 *
 * El corpus es **todo el contenido del repo** que el detector podría ver en
 * producción: el código de `packages/**` y `apps/**`, la documentación de
 * `docs/**`, los tests y los ficheros de configuración. Se excluyen
 * `node_modules`, artefactos de build y **los ficheros del propio detector**
 * (que contienen los patrones como literales: medirían al detector con sus
 * propias fuentes, no con contenido real).
 *
 * El test **publica** el número medido (por consola) y **falla** si la tasa
 * supera el umbral declarado: es la forma verificable de "no marcar todo como
 * sospechoso".
 */

/** Tope de tasa de falsos positivos admitido sobre el corpus del repo. */
const MAX_FALSE_POSITIVE_RATE = 0.02; // 2 %

const EXCLUDE_DIRS = new Set([
  "node_modules",
  "dist",
  "out",
  ".git",
  "coverage",
  ".vite",
  ".pnpm",
  "repos-referencia",
  "target",
  ".agents",
]);
const EXTS = new Set([".ts", ".tsx", ".js", ".mjs", ".md", ".txt", ".json", ".yaml", ".yml"]);

/** Raíz del repo: se busca el marcador de workspace hacia arriba. */
function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

/**
 * Ficheros cuyo **propósito** es contener vectores de ataque (fixtures de
 * tests de seguridad, corpus de ataques). No son "contenido legítimo": son
 * el material de prueba del detector. Se excluyen de la tasa principal, pero
 * la tasa **bruta** (con ellos) se publica igualmente.
 */
const ATTACK_FIXTURE_FILES = [
  "tests/security/injection-boundaries.test.ts",
  "packages/runtime/test/TrustBoundary.test.ts",
  "packages/subegos/test/SubEgoSoul.test.ts",
];

/** Artefactos generados (no son contenido del repo). */
const GENERATED_PATHS = ["tests/gui/playwright-report/", "tests/gui/test-results/"];

function isOwnFile(rel: string): boolean {
  return (
    rel.endsWith("src/PromptInjectionDetector.ts") ||
    rel.endsWith("test/PromptInjectionDetector.test.ts") ||
    rel.endsWith("test/PromptInjectionDetector.corpus.test.ts") ||
    rel.endsWith("test/InjectionPolicy.test.ts")
  );
}

function isAttackFixture(rel: string): boolean {
  return ATTACK_FIXTURE_FILES.includes(rel);
}

function isGenerated(rel: string): boolean {
  return GENERATED_PATHS.some((p) => rel.startsWith(p));
}

function walk(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (EXCLUDE_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXTS.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

describe("PromptInjectionDetector — tasa de falsos positivos sobre el corpus real", () => {
  // El corpus son ~1 700 ficheros: la medición tarda ~20 s (es una prueba de
  // corpus, no un test unitario) ⇒ timeout ampliado.
  it("marca menos del 2 % del contenido legítimo del repo", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const root = findRepoRoot(here);
    const all = walk(root);

    let scanned = 0;
    let flagged = 0;
    let scannedLegit = 0;
    let flaggedLegit = 0;
    const offenders: string[] = [];

    for (const f of all) {
      const rel = path.relative(root, f).split(path.sep).join("/");
      if (isOwnFile(rel)) continue;
      if (isGenerated(rel)) continue;
      let text: string;
      try {
        text = fs.readFileSync(f, "utf8");
      } catch {
        continue;
      }
      if (text.trim().length === 0) continue;
      scanned++;
      const result = detectPromptInjection(text);
      const isSuspicious = result.verdict === "suspicious";
      if (isSuspicious) flagged++;
      if (!isAttackFixture(rel)) {
        scannedLegit++;
        if (isSuspicious) flaggedLegit++;
      }
      if (isSuspicious && !isAttackFixture(rel) && offenders.length < 20) {
        offenders.push(
          `${rel} :: ${result.signals
            .map((s) => `${s.kind}/${s.severity} "${s.evidence.slice(0, 80)}"`)
            .join(", ")}`
        );
      }
    }

    const rate = flaggedLegit / Math.max(1, scannedLegit);
    const rawRate = flagged / Math.max(1, scanned);
    console.log(
      `[PromptInjectionDetector] corpus: ${scanned} ficheros (todo packages/, apps/, docs/, tests/ ` +
        `salvo los del detector y los artefactos generados)\n` +
        `[PromptInjectionDetector] tasa BRUTA (incluye fixtures de ataque): ${(rawRate * 100).toFixed(3)} % ` +
        `(${flagged}/${scanned})\n` +
        `[PromptInjectionDetector] tasa sobre contenido LEGÍTIMO: ${(rate * 100).toFixed(3)} % ` +
        `(${flaggedLegit}/${scannedLegit})`
    );
    if (offenders.length > 0) {
      console.log(`[PromptInjectionDetector] primeros falsos positivos:\n  ${offenders.join("\n  ")}`);
    }

    expect(scannedLegit, "el corpus medido está vacío: la medición no sería válida").toBeGreaterThan(100);
    expect(
      rate,
      `tasa de falsos positivos ${(rate * 100).toFixed(3)} % > ${(MAX_FALSE_POSITIVE_RATE * 100).toFixed(1)} %`
    ).toBeLessThanOrEqual(MAX_FALSE_POSITIVE_RATE);
  }, 180_000);
});
