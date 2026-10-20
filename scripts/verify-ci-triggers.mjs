#!/usr/bin/env node
// scripts/verify-ci-triggers.mjs — T1 (EGO-FIND-18): gate de triggers alcanzables.
//
// Por qué: los 6 workflows de `.github/workflows/` declaraban `branches: [main]`
// mientras la rama por defecto del repo es `master` (`git branch -r` → solo
// `origin/master`). Consecuencia: CI, docs-lint, release-please y smoke-native
// NUNCA se ejecutaron. El job `verify` (lint+typecheck+test+build) llevaba
// meses sin correr.
//
// Qué hace este script:
//   1. Lee cada workflow de `.github/workflows/*.yml` (o de un ref de git).
//   2. Extrae los filtros de rama de cada trigger (`push`, `pull_request`,
//      `schedule`, `workflow_dispatch`).
//   3. Clasifica cada workflow:
//        - REACHABLE   → tiene al menos un trigger que puede dispararse
//        - INERT       → todos sus triggers filtran por ramas que no existen
//   4. Falla (exit 1) si hay algún workflow INERT.
//
// Uso:
//   node scripts/verify-ci-triggers.mjs                 # contra el working tree
//   node scripts/verify-ci-triggers.mjs --ref HEAD~1   # contra un ref de git
//
// Exit codes: 0 = todos alcanzables · 1 = hay workflows inertes · 2 = error de uso.

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS_DIR = join(ROOT, '.github', 'workflows');

// --- args ---------------------------------------------------------------
const argv = process.argv.slice(2);
const refIdx = argv.indexOf('--ref');
const REF = refIdx >= 0 ? argv[refIdx + 1] : null;
if (refIdx >= 0 && !REF) {
  console.error('[verify-ci-triggers] --ref requiere un valor (ej. HEAD~1)');
  process.exit(2);
}

// --- helpers ------------------------------------------------------------

/** Lista de ramas remotas reales (ej. ['origin/master']). */
function remoteBranches() {
  try {
    const out = execFileSync('git', ['branch', '-r', '--format=%(refname:short)'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s && !s.includes('->'));
  } catch {
    return [];
  }
}

/** Lee el contenido de un workflow: del working tree o de un ref de git. */
function readWorkflow(fileName) {
  if (REF) {
    try {
      return execFileSync('git', ['show', `${REF}:.github/workflows/${fileName}`], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      return null; // el fichero no existía en ese ref
    }
  }
  try {
    return readFileSync(join(WORKFLOWS_DIR, fileName), 'utf8');
  } catch {
    return null;
  }
}

/**
 * Extrae los triggers y sus filtros de rama de un workflow YAML.
 * Parser mínimo y deliberado: sólo entiende la forma que usa este repo
 * (bloques `on:` a dos niveles con `branches:` / `branches-ignore:`).
 */
export function parseTriggers(yaml) {
  const lines = yaml.split(/\r?\n/);
  const triggers = [];
  let inOn = false;
  let inOnChild = false;
  let current = null;
  let pendingEvent = null;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.replace(/\s+$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    // Detecta la clave raíz `on:` (o `true:`/`on:` quoted).
    if (indent === 0 && /^(on|'on'|"on"):\s*$/.test(line)) {
      inOn = true;
      continue;
    }
    if (!inOn) continue;

    // Salió del bloque `on:` → cualquier clave de nivel 0 lo cierra.
    if (indent === 0) {
      inOn = false;
      continue;
    }

    // Evento de nivel 2 dentro de `on:` (indent 2), p.ej. `  push:`
    if (indent === 2) {
      inOnChild = true;
      const isEvent = /^[a-z_]+:\s*(.*)$/.test(trimmed);
      if (isEvent) {
        const name = trimmed.slice(0, trimmed.indexOf(':'));
        const inline = trimmed.slice(trimmed.indexOf(':') + 1).trim();
        current = { event: name, branches: null, branchesIgnore: null };
        triggers.push(current);
        // `push:` a secas → evento sin filtro (dispara en todas las ramas).
        if (inline === '') {
          // puede tener hijos
        } else {
          // valor inline (ej. `workflow_dispatch:` con nada) → sin filtro
        }
      }
      continue;
    }

    if (!current) continue;

    // `branches:` / `branches-ignore:` a indent 4
    if (indent >= 4) {
      const m = /^(branches|branches-ignore):\s*\[(.*)\]\s*$/.exec(trimmed);
      if (m) {
        const list = m[2]
          .split(',')
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean);
        if (m[1] === 'branches') current.branches = list;
        else current.branchesIgnore = list;
        continue;
      }
      // Formato YAML de bloque:
      //   branches:
      //     - main
      if (/^(branches|branches-ignore):\s*$/.test(trimmed)) {
        const key = trimmed.slice(0, trimmed.indexOf(':')).trim();
        const list = [];
        let j = i + 1;
        for (; j < lines.length; j += 1) {
          const l2 = lines[j];
          const ind2 = l2.length - l2.trimStart().length;
          if (ind2 < 6) break;
          const item = l2.trim();
          if (item.startsWith('- ')) {
            list.push(item.slice(2).trim().replace(/^['"]|['"]$/g, ''));
          }
        }
        if (key === 'branches') current.branches = list;
        else current.branchesIgnore = list;
        i = j - 1;
        continue;
      }
      if (/^cron:/.test(trimmed)) current.cron = trimmed.slice(5).trim();
    }
  }

  return triggers;
}

/**
 * Un trigger es alcanzable si:
 *   - `schedule` o `workflow_dispatch` → siempre alcanzable.
 *   - `branches` ausente → alcanzable en cualquier rama.
 *   - `branches` presente → alcanzable si alguna de sus ramas existe (local o remota).
 */
export function isTriggerReachable(trigger, knownBranches) {
  if (trigger.event === 'schedule' || trigger.event === 'workflow_dispatch') return true;
  if (!trigger.branches) return true;
  if (trigger.branchesIgnore && trigger.branchesIgnore.length > 0) {
    return trigger.branches.some((b) => !trigger.branchesIgnore.includes(b));
  }
  return trigger.branches.some((b) => knownBranches.has(b) || knownBranches.has(`origin/${b}`));
}

// --- ejecución ----------------------------------------------------------

const remotes = remoteBranches();
const known = new Set(remotes);
try {
  const local = execFileSync('git', ['branch', '--format=%(refname:short)'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  local
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((b) => known.add(b));
} catch {
  /* sin git local: solo remotas */
}

let files;
try {
  files = readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml')).sort();
} catch {
  console.error(`[verify-ci-triggers] no existe ${WORKFLOWS_DIR}`);
  process.exit(2);
}

const target = REF ? `ref ${REF}` : 'working tree';
console.log(`[verify-ci-triggers] ${files.length} workflow(s) · ${target}`);
console.log(`[verify-ci-triggers] ramas conocidas: ${[...known].sort().join(', ')}`);

let failures = 0;
const report = [];

for (const fileName of files) {
  const yaml = readWorkflow(fileName);
  if (yaml === null) {
    console.log(`[verify-ci-triggers] skip ${fileName} (no existe en ${target})`);
    continue;
  }

  // T1d (Ola 1d): sintaxis YAML de los workflows.
  //
  // Trampa real medida en esta ola: un `- name: Avatar: sync-check (...)`
  // SIN comillas rompe el parseo YAML ("Nested mappings are not allowed in
  // compact mappings") → GitHub rechaza el workflow entero y TODO el
  // pipeline cae, sin que ningún otro gate lo detecte. Se comprueba aquí el
  // patrón exacto (clave `- name:` con `:` sin comillas en el valor) y, si el
  // parser YAML está disponible en el árbol, el parseo completo.
  for (const [i, line] of yaml.split(/\r?\n/).entries()) {
    const m = /^(\s*)- name:\s+(.+)$/.exec(line);
    if (!m) continue;
    const value = m[2].trim();
    if (value.startsWith('"') || value.startsWith("'")) continue;
    if (/^[^:]*:\s/.test(value)) {
      failures += 1;
      console.error(
        `[verify-ci-triggers] FAIL ${fileName}:${i + 1}: '- name:' sin comillas y con ':' ` +
          `dentro del valor rompe el parseo YAML → "${value}"`,
      );
    }
  }
  try {
    const { parse } = await import("yaml").catch(() => ({ parse: null }));
    if (parse) {
      parse(yaml);
    }
  } catch (err) {
    failures += 1;
    console.error(`[verify-ci-triggers] FAIL ${fileName}: YAML inválido → ${err.message.split("\n")[0]}`);
  }

  const triggers = parseTriggers(yaml);
  if (triggers.length === 0) {
    console.log(`[verify-ci-triggers] WARN ${fileName}: no se detectaron triggers`);
    continue;
  }
  const reachable = triggers.filter((t) => isTriggerReachable(t, known));
  const inert = triggers.filter((t) => !isTriggerReachable(t, known));
  const detail = triggers
    .map((t) => {
      const filt = t.branches ? `[${t.branches.join(',')}]` : '(todas)';
      return `${t.event}${filt}${t.cron ? ` cron=${t.cron}` : ''}`;
    })
    .join(' | ');

  if (reachable.length === 0) {
    failures += 1;
    report.push({ fileName, status: 'INERT', detail });
    console.error(`[verify-ci-triggers] FAIL ${fileName}: INERT — ${detail}`);
  } else {
    report.push({ fileName, status: 'OK', detail });
    console.log(`[verify-ci-triggers] ok   ${fileName}: ${detail}`);
  }
  if (inert.length > 0 && reachable.length > 0) {
    console.log(
      `[verify-ci-triggers] WARN ${fileName}: ${inert.length} trigger(s) inertes, ${reachable.length} alcanzable(s)`
    );
  }
}

if (failures > 0) {
  console.error(`[verify-ci-triggers] ${failures} workflow(s) INERTES: ${report.filter((r) => r.status === 'INERT').map((r) => r.fileName).join(', ')}`);
  process.exit(1);
}
console.log(`[verify-ci-triggers] TODOS LOS WORKFLOWS ALCANZABLES (${report.length})`);
process.exit(0);
