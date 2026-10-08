#!/usr/bin/env node
// EVAL-02 — parity check for the C0 state machine definitions (v2 extendida C0-UNIFY-06).
// Canónico v2: `.agents/task-system/C0-unified.mjs` (re-export exacto del legacy).
// Verifica:
//   1. Legacy `config/state-tools.mjs` ≡ `C0-unified.mjs` STATE_TOOLS (keys + allowed/denied exactos).
//   2. Los 10 estados presentes en: prompts/iter-loop-tools.md, C0-unified.md,
//      skills/campaign-executor/SKILL.md (falla exit 1 si falta alguno).
//   3. BUDGET_LIMITS espejo (C0-unified.mjs) con números 10/40/40/5/120 + mención en server.
//   4. TYPE_PROFILES iniciales ≡ workflows/*.json (initial + instructions fase inicial).
import { readFileSync, readdirSync } from "node:fs"
import { resolve, join, dirname } from "node:path"
import { pathToFileURL } from "node:url"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const TASK_SYSTEM = resolve(__dirname, "..")
const ROOT = resolve(TASK_SYSTEM, "..", "..")

const { STATE_TOOLS: LEGACY } = await import(pathToFileURL(join(TASK_SYSTEM, "config", "state-tools.mjs")).href)
const UNIFIED = await import(pathToFileURL(join(TASK_SYSTEM, "C0-unified.mjs")).href)
const canonical = Object.keys(LEGACY)
let failed = false
const ok = (msg) => console.log(`✅ ${msg}`)
const bad = (msg) => { failed = true; console.error(`❌ ${msg}`) }

// 1. Legacy ≡ Unified (exacto — el re-export no puede divergir)
const uKeys = Object.keys(UNIFIED.STATE_TOOLS)
if (JSON.stringify([...uKeys].sort()) !== JSON.stringify([...canonical].sort())) {
  bad(`C0-unified.mjs STATE_TOOLS keys divergen: legacy [${canonical}] vs unified [${uKeys}]`)
} else {
  let drift = []
  for (const s of canonical) {
    const a = JSON.stringify(LEGACY[s]), b = JSON.stringify(UNIFIED.STATE_TOOLS[s])
    if (a !== b) drift.push(s)
  }
  if (drift.length) bad(`C0-unified.mjs diverge en estados: ${drift.join(", ")} (debe ser re-export exacto)`)
  else ok(`C0-unified.mjs ≡ state-tools.mjs — ${canonical.length} estados idénticos`)
}

// 2. Estados presentes en las 3 fuentes prose
const targets = {
  "prompts/iter-loop-tools.md": join(TASK_SYSTEM, "prompts", "iter-loop-tools.md"),
  "C0-unified.md": join(TASK_SYSTEM, "C0-unified.md"),
  "skills/campaign-executor/SKILL.md": join(ROOT, ".agents", "skills", "campaign-executor", "SKILL.md"),
}
for (const [label, path] of Object.entries(targets)) {
  let body = ""
  try { body = readFileSync(path, "utf-8") } catch { bad(`${label} — no legible en ${path}`); continue }
  const missing = canonical.filter(s => !new RegExp(`\\b${s}\\b`).test(body))
  if (missing.length) bad(`${label} — faltan estados: ${missing.join(", ")}`)
  else ok(`${label} — ${canonical.length} estados presentes`)
}

// 3. BUDGET_LIMITS espejo
const EXPECTED_BUDGET = { maxIterations: 10, maxToolCalls: 40, maxSubAgents: 40, maxConsecutiveFails: 5, maxDurationMinutes: 120 }
if (JSON.stringify(UNIFIED.BUDGET_LIMITS) !== JSON.stringify(EXPECTED_BUDGET)) {
  bad(`C0-unified.mjs BUDGET_LIMITS diverge: ${JSON.stringify(UNIFIED.BUDGET_LIMITS)}`)
} else {
  ok(`BUDGET_LIMITS espejo OK — 10/40/40/5/120`)
}
try {
  const server = readFileSync(join(TASK_SYSTEM, "mcp", "campaign-server.mjs"), "utf-8")
  const nums = ["maxIterations: 10", "maxToolCalls: 40", "maxSubAgents: 40", "maxConsecutiveFails: 5", "maxDurationMinutes: 120"]
  const missingNums = nums.filter(n => !server.includes(n))
  if (missingNums.length) bad(`campaign-server.mjs BUDGET_LIMITS sin: ${missingNums.join(", ")}`)
  else ok(`campaign-server.mjs BUDGET_LIMITS presentes (10/40/40/5/120)`)
} catch { bad("campaign-server.mjs no legible para BUDGET check") }

// 4. TYPE_PROFILES ≡ workflows/*.json (initial + instructions inicial)
try {
  const dir = join(TASK_SYSTEM, "workflows")
  const files = readdirSync(dir).filter(f => f.endsWith(".json"))
  let checked = 0
  for (const f of files) {
    const wfName = f.replace(/\.json$/, "")
    const profile = UNIFIED.TYPE_PROFILES?.[wfName]
    if (!profile) { bad(`TYPE_PROFILES sin '${wfName}' (${f})`); continue }
    const json = JSON.parse(readFileSync(join(dir, f), "utf-8"))
    if (json.definition.initial !== profile.initial) {
      bad(`${f} initial diverge: json '${json.definition.initial}' vs unified '${profile.initial}'`)
      continue
    }
    const initPhase = json.definition.states[json.definition.initial]
    if (initPhase && initPhase.instructions !== profile.phases[profile.initial]?.instructions) {
      bad(`${f} instructions de '${profile.initial}' divergen del JSON`)
      continue
    }
    checked++
  }
  if (checked) ok(`TYPE_PROFILES ≡ workflows/*.json — ${checked} perfiles (initial + instructions)`)
} catch (e) { bad(`workflows parity falló: ${e.message}`) }

if (failed) {
  console.error("\n❌ Paridad C0 rota. C0-unified.mjs es la fuente canónica; actualizá el espejo que diverge.")
  process.exit(1)
}
console.log(`\n✅ Paridad C0 OK — ${canonical.length} estados (${canonical.join(", ")}) en todas las fuentes.`)
