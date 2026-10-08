// build-skills-index.mjs — genera .agents/task-system/skills-index.json
// desde .agents/skills/*/SKILL.md (front-matter) + SKILLS-MANIFEST.md (ratings/deprecated).
// Uso: bun .agents/task-system/scripts/build-skills-index.mjs
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, "..", "..", "..")
const SKILLS_DIR = join(PROJECT_ROOT, ".agents", "skills")
const MANIFEST = join(PROJECT_ROOT, "SKILLS-MANIFEST.md")
const OUT = join(PROJECT_ROOT, ".agents", "task-system", "skills-index.json")

const STOP = new Set(["the", "a", "an", "and", "or", "of", "to", "for", "with", "when", "use", "using", "this", "that", "it", "in", "on", "is", "are", "be", "by", "as", "at", "from", "into", "your", "you", "its", "not", "no", "can", "will", "should", "must", "any", "all", "each", "other", "more", "most", "than", "then", "there", "these", "those", "they", "them", "their", "we", "our", "us", "if", "so", "but", "also", "such", "via", "per", "etc"])

function tokensOf(text) {
  return [...new Set(String(text).toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/).filter(w => w.length > 2 && !STOP.has(w)))]
}

function parseFrontMatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return {}
  const fm = {}
  const lines = m[1].split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([a-zA-Z_]+):\s*(.*)$/)
    if (!kv) continue
    let [, k, v] = kv
    if (v === "|" || v === ">") {
      const buf = []
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) { i++; buf.push(lines[i].trim()) }
      v = buf.join(" ")
    }
    fm[k] = String(v).replace(/^["']|["']$/g, "")
  }
  return fm
}

// --- manifest: ratings + deprecated ---
const manifest = existsSync(MANIFEST) ? readFileSync(MANIFEST, "utf-8") : ""
const ratings = {}
const deprecated = new Set()
for (const line of manifest.split(/\r?\n/)) {
  const row = line.match(/^\|\s*`?([a-z0-9][a-z0-9-]{2,})`?\s*\|\s*(\d+|—|-)\s*\|([^|]*)\|?/)
  if (!row) continue
  const [, name, rating, status] = row
  if (/^\d+$/.test(rating)) ratings[name] = parseInt(rating, 10)
  if (/DEPRECATED|NO cargar/i.test(status || "")) deprecated.add(name)
}

// --- skills dir ---
const skills = {}
for (const d of readdirSync(SKILLS_DIR)) {
  const p = join(SKILLS_DIR, d)
  try { if (!statSync(p).isDirectory()) continue } catch { continue }
  const skillMd = join(p, "SKILL.md")
  if (!existsSync(skillMd)) continue
  const md = readFileSync(skillMd, "utf-8")
  const fm = parseFrontMatter(md)
  const name = fm.name || d
  const description = fm.description || ""
  if (skills[name]) {
    console.warn(`WARN nombre duplicado "${name}" (dirs: ${skills[name].dir} vs ${d}) — se conserva el primero`)
    continue
  }
  skills[name] = {
    name,
    description,
    dir: d,
    tokens: tokensOf(`${name} ${description}`),
    rating: ratings[name] ?? ratings[d] ?? null,
    deprecated: deprecated.has(name),
    path: `.agents/skills/${d}/SKILL.md`,
    hash: createHash("sha1").update(md).digest("hex").slice(0, 12),
  }
}

writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), count: Object.keys(skills).length, skills }, null, 2) + "\n", "utf-8")
console.log(`skills-index.json: ${Object.keys(skills).length} skills -> ${OUT}`)
console.log(`ratings: ${Object.keys(ratings).length} | deprecated: ${[...deprecated].join(", ") || "(ninguna)"}`)
