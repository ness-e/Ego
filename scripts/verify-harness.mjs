#!/usr/bin/env node
// scripts/verify-harness.mjs — T11 (EGO-FIND-64 parcial): gate de salud del
// rack de agentes del harness.
//
// POR QUÉ ESTE SCRIPT (y no solo el PS1):
//   `.agents/dev-tools/sync-opencode-agents.ps1 -Check` ya detecta drift entre
//   `.agents/` y `.opencode/`, pero:
//     a) es PowerShell → en CI (ubuntu) depende de que `pwsh` esté en el
//        runner (lo está, pero es una dependencia implícita del harness);
//     b) NO valida que el frontmatter generado sea SEMÁNTICAMENTE válido
//        para OpenCode (claves de `permission` soportadas, `description`
//        no vacío, `mode` presente);
//     c) NO cubre el anti-drift de referencias de `AGENTS.md` que vive en
//        `check-agents-refs.ps1`.
//
// Este script unifica las tres comprobaciones en un gate cross-platform
// (Node puro, sin dependencias) que CI puede ejecutar en cualquier SO.
//
// QUÉ VERIFICA:
//   1. `.opencode/agents/*.md` tiene frontmatter válido para OpenCode:
//      `description` no vacío · `mode` ∈ {subagent, primary, all} ·
//      `permission` con mapa de claves DENTRO del conjunto soportado.
//   2. Sin drift: el conjunto de nombres de `.opencode/agents/` coincide con
//      `.agents/agents/`, y el `description` de cada agente generado
//      corresponde al de su fuente canónica.
//   3. Sin drift de comandos: `.opencode/command/*.md` ≡ `.agents/commands/*.md`.
//   4. Anti-stale de referencias: las rutas citadas entre backticks en
//      `AGENTS.md` existen en disco (puerto de `check-agents-refs.ps1`).
//
// EXIT: 0 = harness sano · 1 = drift o frontmatter inválido · 2 = error de uso.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_AGENTS = join(ROOT, ".agents", "agents");
const SRC_COMMANDS = join(ROOT, ".agents", "commands");
const DST_AGENTS = join(ROOT, ".opencode", "agents");
const DST_COMMANDS = join(ROOT, ".opencode", "command");

/** Claves de `permission` soportadas por OpenCode (ver README de OpenCode). */
const ALLOWED_PERMISSION_KEYS = new Set([
  "read",
  "edit",
  "glob",
  "grep",
  "list",
  "bash",
  "task",
  "external_directory",
  "webfetch",
  "websearch",
  "lsp",
  "skill",
  "question",
  "doom_loop",
]);

const ALLOWED_MODES = new Set(["subagent", "primary", "all"]);

const failures = [];
const warnings = [];
const fail = (m) => failures.push(m);
const warn = (m) => warnings.push(m);

/** Extrae el bloque YAML de frontmatter (sin parser: formato plano clave: valor). */
function parseFrontmatter(content) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!m) return null;
  const raw = m[1];
  const lines = raw.split(/\r?\n/);
  const data = {};
  let inPermission = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) continue;

    // Bloque escalar plegado/literal: `description: >-` + líneas indentadas.
    const blockScalar = /^([A-Za-z0-9_-]+):\s*[>|-]{1,2}\s*$/.exec(line);
    if (blockScalar && !/^\s/.test(line)) {
      const key = blockScalar[1];
      const parts = [];
      let j = i + 1;
      for (; j < lines.length; j += 1) {
        const l2 = lines[j];
        if (l2.trim() && !/^\s/.test(l2)) break;
        if (l2.trim()) parts.push(l2.trim());
      }
      data[key] = parts.join(" ");
      i = j - 1;
      continue;
    }

    const permMatch = /^(\s*)permission:\s*$/.exec(line);
    if (permMatch) {
      inPermission = true;
      continue;
    }
    const topLevel = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (topLevel && !/^\s/.test(line)) {
      inPermission = false;
      data[topLevel[1]] = stripComment(topLevel[2]).trim();
      continue;
    }
    const permEntry = /^\s+([A-Za-z0-9_*-]+):\s*(.+?)\s*$/.exec(line);
    if (permEntry && inPermission) {
      data.permission = data.permission ?? {};
      data.permission[permEntry[1]] = stripComment(permEntry[2]).trim();
      continue;
    }
  }
  return { raw, data };
}

/** Quita el comentario final `# ...` de un valor YAML escalar. */
function stripComment(value) {
  const hash = value.indexOf("#");
  return hash === -1 ? value : value.slice(0, hash);
}

/** Normaliza espacios para comparar descripciones plegadas vs planas. */
function normalizeText(s) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function listMd(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort();
}

// ── 1 + 2: frontmatter válido y sin drift de agentes ────────────────────────
const srcAgentFiles = listMd(SRC_AGENTS);
const dstAgentFiles = listMd(DST_AGENTS);

const srcNames = new Set(srcAgentFiles.map((f) => basename(f, ".md")));
const dstNames = new Set(dstAgentFiles.map((f) => basename(f, ".md")));

for (const n of srcNames) {
  if (!dstNames.has(n)) fail(`agente sin equivalente en .opencode/agents/: ${n}`);
}
for (const n of dstNames) {
  if (!srcNames.has(n)) fail(`agente huérfano en .opencode/agents/ (no existe en .agents/agents/): ${n}`);
}

for (const file of dstAgentFiles) {
  const name = basename(file, ".md");
  const path = join(DST_AGENTS, file);
  const content = readFileSync(path, "utf8");
  const fm = parseFrontmatter(content);

  if (!fm) {
    fail(`${file}: sin frontmatter (--- ... ---)`);
    continue;
  }
  const { data } = fm;

  if (!data.description || data.description.length === 0) {
    fail(`${file}: falta 'description' (obligatorio para que OpenCode registre el agente)`);
  }
  if (!data.mode) {
    fail(`${file}: falta 'mode' (esperado: ${[...ALLOWED_MODES].join(" | ")})`);
  } else if (!ALLOWED_MODES.has(data.mode)) {
    fail(`${file}: 'mode' inválido "${data.mode}" (esperado: ${[...ALLOWED_MODES].join(" | ")})`);
  }
  if (!data.permission || Object.keys(data.permission).length === 0) {
    fail(`${file}: falta 'permission' (mapa de permisos)`);
  } else {
    for (const [key, value] of Object.entries(data.permission)) {
      const isWildcard = key.includes("*");
      if (!isWildcard && !ALLOWED_PERMISSION_KEYS.has(key)) {
        fail(`${file}: clave de permission no soportada por OpenCode: "${key}"`);
      }
      if (!["allow", "ask", "deny"].includes(value)) {
        fail(`${file}: valor inválido para permission.${key}: "${value}" (esperado: allow|ask|deny)`);
      }
    }
  }

  // Drift de descripción contra la fuente canónica.
  const srcPath = join(SRC_AGENTS, `${name}.md`);
  if (existsSync(srcPath)) {
    const srcFm = parseFrontmatter(readFileSync(srcPath, "utf8"));
    if (srcFm?.data?.description && normalizeText(srcFm.data.description) !== normalizeText(data.description)) {
      fail(`${file}: 'description' desincronizado con .agents/agents/${name}.md (drift)`);
    }
  }
}

// ── 3: sin drift de comandos ────────────────────────────────────────────────
const srcCmdFiles = listMd(SRC_COMMANDS);
const dstCmdFiles = listMd(DST_COMMANDS);
const srcCmdNames = new Set(srcCmdFiles.map((f) => basename(f, ".md")));
const dstCmdNames = new Set(dstCmdFiles.map((f) => basename(f, ".md")));
for (const n of srcCmdNames) {
  if (!dstCmdNames.has(n)) fail(`comando sin equivalente en .opencode/command/: ${n}`);
}
for (const n of dstCmdNames) {
  if (!srcCmdNames.has(n)) fail(`comando huérfano en .opencode/command/: ${n}`);
}

// ── 4: anti-stale de referencias en AGENTS.md ───────────────────────────────
const AGENTS = join(ROOT, "AGENTS.md");
if (existsSync(AGENTS)) {
  const raw = readFileSync(AGENTS, "utf8").replace(/```[\s\S]*?```/g, "");
  let checked = 0;
  for (const m of raw.matchAll(/`([^`\r\n]+)`/g)) {
    let p = m[1].trim();
    p = p.replace(/:\d+.*$/, "");
    p = p.replace(/[/\\]+$/, "");
    p = p.replace(/^["']|["']$/g, "");
    if (/\s/.test(p)) continue;
    if (/^[a-z]+:\/\//.test(p)) continue;
    if (p.startsWith("~")) continue;
    if (p.startsWith("/")) continue;
    if (/[<>*?#|":]/.test(p)) continue;
    if (!/[/\\]/.test(p)) continue;
    const leaf = basename(p);
    if (/^[A-Z]\.[A-Za-z0-9]+$/.test(leaf)) continue;
    if (!extname(p)) continue;
    if (p.startsWith("prompts/") || p.startsWith("prompts\\")) {
      p = `.agents/task-system/${p}`;
    }
    checked += 1;
    if (!existsSync(join(ROOT, p))) {
      fail(`AGENTS.md: referencia stale -> ${p}`);
    }
  }
  console.log(`[verify-harness] referencias en AGENTS.md comprobadas: ${checked}`);
} else {
  warn("AGENTS.md no encontrado en la raíz del repo");
}

// ── informe ─────────────────────────────────────────────────────────────────
console.log(
  `[verify-harness] agentes .agents/: ${srcAgentFiles.length} · .opencode/: ${dstAgentFiles.length} · comandos .agents/: ${srcCmdFiles.length} · .opencode/: ${dstCmdFiles.length}`,
);
for (const w of warnings) console.log(`[verify-harness] WARN ${w}`);
if (failures.length > 0) {
  console.error(`[verify-harness] ${failures.length} problema(s):`);
  for (const f of failures) console.error(`  FAIL ${f}`);
  process.exit(1);
}
console.log("[verify-harness] harness sano: frontmatter válido, sin drift, refs ok");
process.exit(0);
