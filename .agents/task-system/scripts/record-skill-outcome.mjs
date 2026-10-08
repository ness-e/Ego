// record-skill-outcome.mjs — registra outcome SDP (feedback loop S2).
// Uso: bun .agents/task-system/scripts/record-skill-outcome.mjs <taskId> ok|fail <skills,coma>
// Ej:  bun .agents/task-system/scripts/record-skill-outcome.mjs HARD-01 ok ci-cd-and-automation,test-driven-development
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..", "..", "..")
const FILE = join(ROOT, ".agents", "task-system", "memory", "skill-outcomes.json")

const [taskId, outcome, skillsArg] = process.argv.slice(2)
if (!taskId || !["ok", "fail"].includes(outcome)) {
  console.error("uso: record-skill-outcome.mjs <taskId> ok|fail <skills,coma>")
  process.exit(1)
}
const skills = (skillsArg || "").split(",").map(s => s.trim()).filter(Boolean)

let data = { entries: [] }
if (existsSync(FILE)) {
  try { data = JSON.parse(readFileSync(FILE, "utf-8")) } catch { data = { entries: [] } }
}
if (!Array.isArray(data.entries)) data.entries = []
data.entries.push({ date: new Date().toISOString().slice(0, 10), taskId, outcome, skills })
writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n", "utf-8")
console.log(`outcome registrado: ${taskId} ${outcome} [${skills.join(", ")}] (${data.entries.length} entries)`)
