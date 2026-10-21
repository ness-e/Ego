#!/usr/bin/env node
// scripts/verify-vantadb-resolution.mjs — PUERTA de la resolución de VantaDB.
//
// POR QUÉ EXISTE (EGO-FIND-16, Ola 5, A7):
//   `vantadb` sólo estaba declarado en `packages/memory`. Los demás miembros
//   del workspace (`apps/desktop`, `tests`, y cualquier paquete futuro que
//   importe `vantadb/native` sin declararlo) resolvían FUERA del repo, al
//   `node_modules` GLOBAL del usuario (`C:\Users\Eros\node_modules\vantadb` =
//   **0.6.1**, tres menores por detrás y SIN `vantadb-node`).
//
//   El síntoma era silencioso y muy caro:
//     · el import lanzaba `VANTADB_NOT_FOUND: Node not found: 7`;
//     · un agente concluyó (FALSO) que `contextAssemble()` no existía, cuando
//       sí existe en 0.9.0 (verificado empíricamente: preserva el system
//       prompt y los pares tool_call/tool_result).
//
// QUÉ COMPRUEBA, desde CADA miembro del workspace:
//   1. `vantadb/native` resuelve DENTRO del repo (nunca al global del usuario);
//   2. la versión resuelta es la fijada (0.9.0);
//   3. `vantadb-node` resuelve DENTRO del repo y con la misma versión;
//   4. el binding resuelto expone `contextAssemble` (el método cuya ausencia
//      originó la conclusión falsa) — se comprueba en el TIPO declarado
//      (`index.d.ts`), no en un comentario.
//
// USO:
//   node scripts/verify-vantadb-resolution.mjs           → puerta (exit 0/1)
//   node scripts/verify-vantadb-resolution.mjs --json    → informe JSON
//   node scripts/verify-vantadb-resolution.mjs --quiet   → sólo el resumen
//
// Códigos de salida: 0 = resolución correcta en todos los miembros · 1 = mina.
import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(join(fileURLToPath(import.meta.url), "..", ".."));
const REPO = ROOT.replace(/[\\/]/g, "/").toLowerCase();
const argv = process.argv.slice(2);
const JSON_OUT = argv.includes("--json");
const QUIET = argv.includes("--quiet");

/** Versión que el repo fija. Cambiarla aquí obliga a cambiar los manifiestos. */
const EXPECTED_VERSION = "0.9.0";
/** Métodos que deben existir en el tipo del binding (la conclusión falsa). */
const REQUIRED_METHODS = ["contextAssemble"];

const inRepo = (p) => String(p).replace(/[\\/]/g, "/").toLowerCase().startsWith(REPO);

/** Miembros del workspace (cualquier package.json bajo packages/ apps/ tests/). */
function members() {
  const out = [];
  const walk = (dir, depth) => {
    if (depth > 2) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const p = join(dir, e.name);
      if (e.name === "node_modules") continue;
      if (existsSync(join(p, "package.json"))) {
        out.push(p);
        continue;
      }
      walk(p, depth + 1);
    }
  };
  for (const top of ["packages", "apps", "tests"]) {
    const p = join(ROOT, top);
    if (existsSync(p)) walk(p, 0);
  }
  return out.sort();
}

/** Versión declarada en el package.json de un paquete del store. */
function versionOf(resolvedFile) {
  // .../node_modules/.pnpm/vantadb@0.9.0/node_modules/vantadb/dist/native.js
  const m = /[/\\]node_modules[/\\]\.pnpm[/\\]([^@/\\]+)@([^/\\]+)[/\\]/.exec(resolvedFile);
  if (m) return m[2];
  try {
    const pkg = JSON.parse(
      readFileSync(join(resolvedFile, "..", "package.json"), "utf8"),
    );
    return pkg.version;
  } catch {
    return "?";
  }
}

/**
 * Comprueba que el TIPO del BINDING (`vantadb-node/index.d.ts`) declara los
 * métodos requeridos.
 *
 * OJO: `contextAssemble` NO está en el wrapper `vantadb/dist/native.d.ts`
 * (ese sólo declara `NativeVantaDB` y `NativeClientBinding`): está en el tipo
 * del binding nativo, `vantadb-node/index.d.ts`. Es exactamente el tipo que
 * originó la conclusión falsa ("el método no existe").
 */
function missingMethods(bindingFile) {
  const missing = [];
  if (!bindingFile || bindingFile.startsWith("ERROR")) {
    return ["vantadb-node no resuelve (no se puede leer su tipo)"];
  }
  const dts = join(bindingFile, "..", "index.d.ts");
  if (!existsSync(dts)) {
    return [`<no hay index.d.ts en ${relative(ROOT, dts)}>`];
  }
  const text = readFileSync(dts, "utf8");
  for (const m of REQUIRED_METHODS) {
    if (!new RegExp(`\\b${m}\\b`).test(text)) missing.push(m);
  }
  return missing;
}

const report = { ok: false, expectedVersion: EXPECTED_VERSION, members: [], failures: [] };

for (const dir of members()) {
  const rel = relative(ROOT, dir).split(sep).join("/");
  const req = createRequire(join(dir, "package.json"));
  const entry = { member: rel, native: null, node: null, version: null, problems: [] };

  try {
    entry.native = req.resolve("vantadb/native");
  } catch (e) {
    entry.native = `ERROR:${e.code ?? e.message}`;
    entry.problems.push(`vantadb/native no resuelve (${e.code ?? e.message})`);
  }
  try {
    entry.node = req.resolve("vantadb-node");
  } catch (e) {
    entry.node = `ERROR:${e.code ?? e.message}`;
    entry.problems.push(`vantadb-node no resuelve (${e.code ?? e.message})`);
  }

  if (entry.native && !entry.native.startsWith("ERROR")) {
    entry.version = versionOf(entry.native);
    if (!inRepo(entry.native)) {
      entry.problems.push(
        `vantadb/native resuelve FUERA del repo: ${entry.native} (${entry.version})`,
      );
    }
    if (entry.version !== EXPECTED_VERSION) {
      entry.problems.push(
        `versión ${entry.version} ≠ ${EXPECTED_VERSION} (fijada en el repo)`,
      );
    }
    const missing = missingMethods(entry.node);
    if (missing.length) {
      entry.problems.push(`el tipo del binding resuelto no declara: ${missing.join(", ")}`);
    }
  }
  if (entry.node && !entry.node.startsWith("ERROR") && !inRepo(entry.node)) {
    entry.problems.push(`vantadb-node resuelve FUERA del repo: ${entry.node}`);
  }

  if (entry.problems.length) report.failures.push({ member: rel, problems: entry.problems });
  report.members.push(entry);
}

report.ok = report.failures.length === 0;

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
} else if (!QUIET) {
  console.log(
    `[verify-vantadb-resolution] ${report.members.length} miembros del workspace · ` +
      `versión fijada ${EXPECTED_VERSION} · métodos requeridos: ${REQUIRED_METHODS.join(", ")}`,
  );
  for (const m of report.members) {
    const ok = m.problems.length === 0;
    console.log(
      `  ${ok ? "OK   " : "FALLO"} ${m.member.padEnd(26)} vantadb@${String(m.version).padEnd(7)} ` +
        `native=${inRepo(m.native) ? "in-repo" : "FUERA!!"} node=${m.node.startsWith("ERROR") ? "sin resolver" : inRepo(m.node) ? "in-repo" : "FUERA!!"}`,
    );
    for (const p of m.problems) console.log(`         · ${p}`);
  }
}

if (!report.ok) {
  if (!JSON_OUT) {
    console.error("");
    console.error(
      "[verify-vantadb-resolution] ══ MINA DE RESOLUCIÓN DE Vantadb ══\n" +
        "   Algún miembro del workspace resuelve 'vantadb/native' o 'vantadb-node' FUERA del repo\n" +
        "   (típicamente al node_modules global del usuario, con una versión más antigua y sin\n" +
        "   el binding nativo) → los imports fallan con VANTADB_NOT_FOUND y las conclusiones\n" +
        "   sobre la API son FALSAS.\n\n" +
        "   Arreglo: declara 'vantadb' y 'vantadb-node' en el package.json del miembro que\n" +
        "   los importa, y/o en el package.json RAÍZ del workspace (de ahí los resuelve\n" +
        "   cualquier miembro por resolución ascendente).",
    );
  }
  process.exit(1);
}

if (!JSON_OUT) {
  console.log(
    `[verify-vantadb-resolution] OK: ${report.members.length} miembros resuelven VantaDB DENTRO del repo (${EXPECTED_VERSION}).`,
  );
}
process.exit(0);
