#!/usr/bin/env node
// scripts/verify-ci-gates.mjs — PUERTA: toda puerta del repo está cableada en CI
// (o está en la lista de exentas, con su motivo).
//
// POR QUÉ EXISTE (EGO-FIND-106, Ola 9):
//   El patrón "puerta nueva que funciona en local y no está en ningún
//   pipeline" se ha repetido VARIAS veces en la remediación:
//     · `packages/avatar/scripts/check-no-verbatim.mjs`  (D4 sin verificar)
//     · `packages/avatar/scripts/check-bridge.mjs`
//     · `packages/avatar/scripts/check-upstream-divergence.mjs`
//     · `scripts/verify-backlog-gates.mjs`
//     · `scripts/audit-extraction-gates.mjs`
//   El fallo no es de la puerta: es que **nada comprueba que una puerta esté
//   cableada**. Esta puerta lo convierte en ley: una puerta nueva que no
//   aparezca en CI tiene que estar en `CI_GATE_EXEMPT` con un motivo, o el
//   gate falla.
//
// QUÉ CONSIDERA UNA PUERTA: un ejecutable cuyo nombre empieza por `check-`,
//   `verify-` o `audit-` (los verificadores). Los `fix-*`, `sync-*`, `t11-*`,
//   `e6-*`, `t-x1-*`, `capture-*` y las herramientas de una sola vez NO son
//   puertas: no se comprueban.
//
// CÓMO SE DETERMINA SI ESTÁ CABLEADA:
//   · `directo`   → su nombre aparece en el texto de un workflow.
//   · `delegador` → la invoca un delegador de `scripts/` que sí está en un
//                   workflow (el patrón que usa A6 para sus puertas).
//   · `vía npm`   → la invoca un script npm que CI EJECUTA de verdad (se
//                   resuelven los `pnpm …` de los workflows y las cadenas de
//                   dos niveles: p.ej. el build de la raíz → el build de
//                   @ego/desktop → verify-dist.cjs).
//   · `exenta`    → está en `CI_GATE_EXEMPT` con su motivo.
//
// USO:
//   node scripts/verify-ci-gates.mjs           → puerta
//   node scripts/verify-ci-gates.mjs --json    → informe machine
//
// Códigos de salida: 0 = toda puerta está cableada o exenta · 1 = hay una puerta
// sin cablear y sin exención.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, resolve, dirname, basename, sep } from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const AS_JSON = argv.includes("--json");
/** `--root <dir>`: audita otro árbol (lo usa el test con un fixture). */
const rootIdx = argv.indexOf("--root");
const ROOT =
  rootIdx >= 0 && argv[rootIdx + 1]
    ? resolve(process.cwd(), argv[rootIdx + 1])
    : resolve(join(dirname(fileURLToPath(import.meta.url)), ".."));

/**
 * Puertas que deliberadamente NO van en CI, con su motivo.
 * Si una puerta deja de estar exenta, este gate falla (hay que quitar la fila).
 */
const CI_GATE_EXEMPT = new Map([
  [
    "scripts/verify-ci-gates.mjs",
    "es esta misma puerta: comprobar que las demás están cableadas no puede estar cableado por sí misma (sería circular).",
  ],
  [
    "scripts/test-audit-extraction-gates.mjs",
    "es el TEST de otra puerta (audit-extraction-gates), no una puerta: lo ejecuta la propia puerta que sí está en CI.",
  ],
  [
    "scripts/test-verify-lint-budget.mjs",
    "es el TEST de la puerta del presupuesto de lint; el test corre en CI como paso propio ('Test de la puerta del presupuesto de lint').",
  ],
  [
    "scripts/verify-extraction-provenance.test.mjs",
    "es el TEST de la puerta de procedencia; lo ejecuta la propia puerta que sí está en CI.",
  ],
]);

/** Carpetas donde puede haber ejecutables verificables. */
const SCAN_DIRS = ["scripts", "packages", "apps/desktop/scripts"];

const isGateName = (name) =>
  /^(check|verify|audit)-/.test(name) && !name.includes(".test.");

function candidates() {
  const out = [];
  const walk = (dir, depth) => {
    if (depth > 3) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name === "dist" || e.name === "out") continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        walk(p, depth + 1);
        continue;
      }
      if (!/\.(mjs|cjs)$/.test(e.name)) continue;
      if (!isGateName(e.name)) continue;
      out.push(relative(ROOT, p).split(sep).join("/"));
    }
  };
  for (const d of SCAN_DIRS) {
    const abs = join(ROOT, d);
    if (!existsSync(abs)) continue;
    walk(abs, 0);
  }
  return out.sort();
}

function workflowTexts() {
  const dir = join(ROOT, ".github", "workflows");
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const f of entries) {
    if (!f.endsWith(".yml") && !f.endsWith(".yaml")) continue;
    out.push({ file: f, text: readFileSync(join(dir, f), "utf8") });
  }
  return out;
}

/**
 * Manifiestos del workspace: etiqueta -> scripts, y nombre-de-paquete ->
 * etiqueta (el nombre `@ego/desktop` NO es su carpeta `apps/desktop`, y CI
 * filtra por NOMBRE con `--filter`).
 */
function npmManifests() {
  const byLabel = new Map();
  const byPkgName = new Map();
  const add = (label, pkgPath) => {
    const p = join(ROOT, pkgPath);
    if (!existsSync(p)) return;
    try {
      const j = JSON.parse(readFileSync(p, "utf8"));
      const scripts = {};
      for (const [name, cmd] of Object.entries(j.scripts ?? {})) {
        if (typeof cmd === "string") scripts[name] = cmd;
      }
      byLabel.set(label, scripts);
      if (typeof j.name === "string") byPkgName.set(j.name, label);
    } catch {
      /* manifiesto ilegible: se ignora */
    }
  };
  add("root", "package.json");
  for (const scope of ["packages", "apps", "tests"]) {
    const base = join(ROOT, scope);
    if (!existsSync(base)) continue;
    let entries;
    try {
      entries = readdirSync(base, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      add(`${scope}/${e.name}`, `${scope}/${e.name}/package.json`);
      const nested = join(base, e.name);
      let sub;
      try {
        sub = readdirSync(nested, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const s of sub) {
        if (!s.isDirectory()) continue;
        add(`${scope}/${e.name}/${s.name}`, `${scope}/${e.name}/${s.name}/package.json`);
      }
    }
  }
  return { byLabel, byPkgName };
}

/** Resuelve un `--filter <pkg>` a la etiqueta de su manifiesto. */
function resolvePkg(pkg, byPkgName, labels) {
  if (byPkgName.has(pkg)) return byPkgName.get(pkg);
  return labels.find(
    (l) => l === pkg || l.endsWith("/" + pkg) || l === "packages/" + pkg || l === "apps/" + pkg,
  );
}

/**
 * Qué scripts npm ejecuta CI de verdad, según el texto de los workflows.
 * Devuelve { rootScripts:Set, packageScripts:Map<label,Set> }.
 */
function ciInvokedScripts(wfs, byLabel, byPkgName) {
  const rootScripts = new Set();
  const packageScripts = new Map();
  const labels = [...byLabel.keys()];

  const addPkgScript = (label, name) => {
    if (!packageScripts.has(label)) packageScripts.set(label, new Set());
    packageScripts.get(label).add(name);
  };

  const scan = () => {
    for (const { text } of wfs) {
      for (const rawLine of text.split(/\r?\n/)) {
        // los pasos de un workflow son "run: pnpm <algo>": se quita el prefijo
        const cmd = rawLine.trim().replace(/^run:\s*/, "").trim();
        if (!cmd.startsWith("pnpm ")) continue;

        // pnpm --filter <pkg> run <name>   |   pnpm --filter <pkg> <name>
        const filt = /^pnpm\s+--filter\s+("[^"]+"|'[^']+'|[^\s]+)\s+(?:run\s+)?([A-Za-z0-9:_-]+)/.exec(cmd);
        if (filt) {
          const pkg = filt[1].replace(/^["']|["']$/g, "");
          const name = filt[2];
          if (pkg.startsWith("!")) continue;
          if (pkg.includes("*") || pkg === "...") {
            for (const label of labels) {
              if (label === "root") continue;
              addPkgScript(label, name);
            }
            continue;
          }
          const label = resolvePkg(pkg, byPkgName, labels);
          addPkgScript(label ?? pkg, name);
          continue;
        }
        // pnpm -r ... run <name> → todos los paquetes
        const rec = /^pnpm\s+-r\b.*?\brun\s+([A-Za-z0-9:_-]+)/.exec(cmd);
        if (rec) {
          for (const label of labels) {
            if (label === "root") continue;
            addPkgScript(label, rec[1]);
          }
          continue;
        }
        // pnpm <name> | pnpm run <name> → raíz
        const root = /^pnpm\s+(?:run\s+)?([A-Za-z0-9:_-]+)/.exec(cmd);
        if (root && !root[1].startsWith("-")) rootScripts.add(root[1]);
      }
    }
  };

  scan();
  // Cadenas de 2 niveles: si un script de la RAÍZ invoca
  // `pnpm --filter <pkg> <script>`, ese script de <pkg> también lo ejecuta CI
  // (p.ej. build de la raíz → build de @ego/desktop → verify-dist.cjs).
  let grew = true;
  let guard = 0;
  while (grew && guard++ < 5) {
    grew = false;
    const rootMap = byLabel.get("root") ?? {};
    for (const name of rootScripts) {
      const cmd = rootMap[name] ?? "";
      for (const m of cmd.matchAll(
        /pnpm\s+--filter\s+("[^"]+"|'[^']+'|[^\s]+)\s+(?:run\s+)?([A-Za-z0-9:_-]+)/g,
      )) {
        const pkg = m[1].replace(/^["']|["']$/g, "");
        const sname = m[2];
        const label = resolvePkg(pkg, byPkgName, labels);
        const key = label ?? pkg;
        if (!packageScripts.has(key)) packageScripts.set(key, new Set());
        if (!packageScripts.get(key).has(sname)) {
          packageScripts.get(key).add(sname);
          grew = true;
        }
      }
    }
  }
  return { rootScripts, packageScripts };
}

/** ¿Algún delegador de scripts/ invoca esta puerta? */
function delegatorFor(base) {
  const dir = join(ROOT, "scripts");
  const self = basename(fileURLToPath(import.meta.url));
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const e of entries) {
    if (!e.isFile() || !/\.(mjs|cjs)$/.test(e.name)) continue;
    if (e.name === self) continue;
    let text;
    try {
      text = readFileSync(join(dir, e.name), "utf8");
    } catch {
      continue;
    }
    if (text.includes(base)) return e.name;
  }
  return null;
}

const wfs = workflowTexts();
const { byLabel, byPkgName } = npmManifests();
const { rootScripts, packageScripts } = ciInvokedScripts(wfs, byLabel, byPkgName);

const rows = [];
const failures = [];
for (const gate of candidates()) {
  const base = gate.split("/").pop();
  const inWf = wfs.filter((w) => w.text.includes(base)).map((w) => w.file);

  // "vía npm": algún script npm que CI EJECUTA de verdad invoca la puerta
  const inNpm = [];
  const rootMap = byLabel.get("root") ?? {};
  for (const name of rootScripts) {
    if ((rootMap[name] ?? "").includes(base)) inNpm.push(`root#${name}`);
  }
  for (const [label, names] of packageScripts) {
    const scripts = byLabel.get(label) ?? {};
    for (const name of names) {
      if ((scripts[name] ?? "").includes(base)) inNpm.push(`${label}#${name}`);
    }
  }

  const delegator = delegatorFor(base);
  const delegatorInWf = delegator
    ? wfs.filter((w) => w.text.includes(delegator)).map((w) => w.file)
    : [];
  const exempt = CI_GATE_EXEMPT.get(gate);

  let estado;
  if (inWf.length) estado = "in CI (directo)";
  else if (delegator && delegatorInWf.length) estado = `in CI (delegador ${delegator})`;
  else if (inNpm.length) estado = "in CI (vía npm)";
  else if (exempt) estado = "exenta";
  else {
    estado = "SIN CABLEAR";
    failures.push(
      `${gate}: puerta nueva sin cablear en CI. Cábala (paso en .github/workflows/ci.yml) ` +
        `o añádela a CI_GATE_EXEMPT en scripts/verify-ci-gates.mjs con su motivo.`,
    );
  }
  rows.push({ gate, estado, workflows: inWf, npm: inNpm, delegator, exempt: exempt ?? null });
}

if (AS_JSON) {
  console.log(
    JSON.stringify({ ok: failures.length === 0, gates: rows.length, failures, rows }, null, 2),
  );
} else {
  console.log(`[verify-ci-gates] ${rows.length} ejecutables verificadores en el repo`);
  for (const r of rows) {
    console.log(
      `  ${r.estado === "SIN CABLEAR" ? "✗" : "✓"} ${r.gate.padEnd(52)} ${r.estado}` +
        (r.workflows.length ? `  [${r.workflows.join(",")}]` : "") +
        (r.npm.length ? `  [${r.npm.join(",")}]` : ""),
    );
  }
  console.log("");
  if (failures.length === 0) {
    console.log("[verify-ci-gates] OK: toda puerta está cableada en CI o exenta con motivo.");
  } else {
    console.error(`[verify-ci-gates] ${failures.length} puerta(s) sin cablear:`);
    for (const f of failures) console.error(`  - ${f}`);
  }
}

process.exit(failures.length ? 1 : 0);
