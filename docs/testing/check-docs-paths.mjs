#!/usr/bin/env node
/**
 * check-docs-paths.mjs — Verificador de integridad referencial de `docs/`.
 *
 * Comprueba dos cosas sobre el corpus Markdown de `docs/`:
 *
 *   1. Enlaces Markdown relativos: todo `[texto](ruta.md)` debe resolver a un
 *      fichero existente. Los `http(s)://` se ignoran. Los enlaces absolutos
 *      (`/capturas/x.svg`) resuelven contra `docs/public/` (static dir de
 *      VitePress). El código inline (backticks) se ignora para no contar
 *      ejemplos de sintaxis como enlaces.
 *   2. Rutas citadas en código inline: todo token tipo `packages/...`,
 *      `apps/...`, `docs/...`, `scripts/...`, `tests/...` con extensión de
 *      fichero debe existir en el árbol real.
 *
 * Alcance del chequeo de rutas (2):
 *   - `CANONICAL`: todo `docs/` salvo los directorios de trabajo histórico y los
 *     que pertenecen a otros agentes de la ola. Son los documentos que
 *     describen el estado *vigente* del producto: si citan una ruta, esa ruta
 *     debe existir.
 *   - `WORKLOG`: `docs/agent-ops/plans/**` y `docs/agent-ops/tasks/**` son
 *     registros históricos de ejecución. Sus citas apuntan a ficheros que
 *     pasaron a otra ubicación o se eliminaron; reescribirlas sería
 *     reescribir la historia. Se cuentan y se listan aparte, pero NO rompen el
 *     build.
 *
 * Exclusiones de la ola (propiedad exclusiva de otro agente):
 *   `docs/agent-ops/plans/2026-10-19-remediation-wave1/**` (A8) contiene
 *   referencias a ficheros de handoff que cada agente crea al final de su turno.
 *
 * Uso:
 *   node docs/testing/check-docs-paths.mjs            # informe + exit 1 si falla
 *   node docs/testing/check-docs-paths.mjs --json     # salida JSON
 *   node docs/testing/check-docs-paths.mjs --quiet    # solo resumen
 *
 * Salida: exit 0 = sin hallazgos canónicos; exit 1 = hay hallazgos canónicos.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs"
import { join, dirname, resolve, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
const DOCS = join(ROOT, "docs")
const PUBLIC = join(DOCS, "public")

const argv = process.argv.slice(2)
const AS_JSON = argv.includes("--json")
const QUIET = argv.includes("--quiet")

/** Prefijos de ruta (relativos a la raíz del repo) que se verifican. */
const ROOT_PREFIX = /^(packages|apps|docs|scripts|tests|repos-referencia|eval|images)\//

/** Extensiones aceptadas como "fichero" en una cita de ruta. */
const FILE_EXT = /\.(ts|tsx|js|mjs|cjs|mts|json|ya?ml|md|html|css|txt|ico|png|jpg|jpeg|svg|webp|lock)$/i

/** Directorios que nunca se recorren (artefactos de build). */
const SKIP_DIRS = new Set([".vitepress", "node_modules", "dist", "out", ".git"])

/** Prefijos de `docs/` excluidos del chequeo de rutas (histórico / otro agente). */
const PATH_CHECK_EXCLUDE = [
  "docs/agent-ops/plans/",
  "docs/agent-ops/tasks/",
  "docs/agent-ops/reports/",
  "docs/extractions/",
  "docs/review/",
  "docs/research/",
]

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue
      walk(full, out)
    } else if (e.isFile() && e.name.endsWith(".md")) {
      out.push(full)
    }
  }
  return out
}

const stripLineSuffix = (p) => p.replace(/:\d+(?:-\d+)?$/, "")
/**
 * Placeholders: plantillas de ruta (`<repo>`, `{file}`) y plantillas de
 * versión (`vX.Y.Z`, `1.2.3`) son ejemplos, no citas de ficheros reales.
 * Se evalúa el basename: `docs/deployment/releases/vX.Y.Z.md` es una plantilla.
 */
const isPlaceholder = (t) => {
  if (/[<>{}*?]/.test(t)) return true
  const base = (t.split("/").pop() ?? "").replace(/\.[^.]+$/, "")
  if (/^v?X\.Y\.Z$/i.test(base)) return true
  if (/^v?\d+\.\d+\.\d+$/.test(base)) return true
  return false
}
const rel = (from, to) => relative(ROOT, to).split(sep).join("/")

/** Elimina los tramos de código inline (backticks) para no analizarlos. */
function stripInlineCode(text) {
  return text.replace(/`[^`\n]*`/g, "")
}

// ---------------------------------------------------------------- markdown links

function checkMarkdownLinks(files) {
  const broken = []
  const linkRe = /\]\(([^)\s]+)\)/g
  for (const file of files) {
    const text = stripInlineCode(readFileSync(file, "utf8"))
    const dir = dirname(file)
    let m
    while ((m = linkRe.exec(text)) !== null) {
      const raw = m[1]
      if (/^(https?:|mailto:|tel:|#)/i.test(raw)) continue
      if (isPlaceholder(raw)) continue
      const clean = decodeURIComponent(raw.split("#")[0].split("?")[0])
      if (!clean) continue
      // Un enlace absoluto `/x` es un asset servido por VitePress desde `docs/public/`.
      const abs = clean.startsWith("/")
        ? join(PUBLIC, clean)
        : resolve(dir, clean)
      if (!existsSync(abs)) {
        broken.push({ kind: "link", from: rel(ROOT, file), target: raw })
      }
    }
  }
  return broken
}

// --------------------------------------------------------------- inline path cites

function checkInlinePaths(files, { exclude = [] } = {}) {
  const broken = []
  const seen = new Set()
  const codeRe = /`([^`\n]+?)`/g
  for (const file of files) {
    const relPath = rel(ROOT, file)
    if (exclude.some((prefix) => relPath.startsWith(prefix))) continue
    const text = readFileSync(file, "utf8")
    let m
    while ((m = codeRe.exec(text)) !== null) {
      const raw = m[1].trim()
      if (!ROOT_PREFIX.test(raw)) continue
      if (isPlaceholder(raw)) continue
      // Puede haber varios paths separados por ` · ` dentro del mismo code span.
      for (const part of raw.split(/\s+·\s+|,\s*/)) {
        const token = stripLineSuffix(part.trim().replace(/[.,;]$/, ""))
        if (!ROOT_PREFIX.test(token)) continue
        if (!FILE_EXT.test(token)) continue
        if (isPlaceholder(token)) continue
        if (existsSync(join(ROOT, token))) continue
        const key = `${relPath}::${token}`
        if (seen.has(key)) continue
        seen.add(key)
        broken.push({ kind: "path", from: relPath, target: token })
      }
    }
  }
  return broken
}

// ------------------------------------------------------------------------- main

const files = walk(DOCS)
const linkIssues = checkMarkdownLinks(files)
const canonicalIssues = checkInlinePaths(files, { exclude: PATH_CHECK_EXCLUDE })
const worklogIssues = checkInlinePaths(files, {
  exclude: PATH_CHECK_EXCLUDE.filter((p) => !p.startsWith("docs/agent-ops/")),
}).filter((i) => i.from.startsWith("docs/agent-ops/"))

const result = {
  filesScanned: files.length,
  brokenLinks: linkIssues,
  brokenPathsCanonical: canonicalIssues,
  brokenPathsWorklog: worklogIssues,
  ok: linkIssues.length === 0 && canonicalIssues.length === 0,
}

if (AS_JSON) {
  console.log(JSON.stringify(result, null, 2))
} else if (!QUIET) {
  const fmt = (list) => {
    const byFile = new Map()
    for (const i of list) {
      if (!byFile.has(i.from)) byFile.set(i.from, [])
      byFile.get(i.from).push(i.target)
    }
    for (const [file, targets] of byFile) {
      console.log(`\n${file}`)
      for (const t of targets) console.log(`   -> ${t}`)
    }
  }
  console.log(`docs markdown escaneados   : ${result.filesScanned}`)
  console.log(`enlaces markdown rotos     : ${linkIssues.length}`)
  console.log(`rutas inexistentes (canón.): ${canonicalIssues.length}`)
  console.log(`rutas inexistentes (worklog): ${worklogIssues.length}  [informativo, no bloquea]`)
  if (linkIssues.length) {
    console.log("\n--- ENLACES ROTOS ---")
    fmt(linkIssues)
  }
  if (canonicalIssues.length) {
    console.log("\n--- RUTAS INEXISTENTES (DOCS CANÓNICOS) ---")
    fmt(canonicalIssues)
  }
}

if (!result.ok) {
  console.error(
    `\nFAIL: ${linkIssues.length} enlace(s) roto(s), ${canonicalIssues.length} ruta(s) inexistente(s) en docs canónicos.`,
  )
  process.exit(1)
}
console.log("\nOK: 0 enlaces rotos, 0 rutas inexistentes en docs canónicos.")
process.exit(0)
