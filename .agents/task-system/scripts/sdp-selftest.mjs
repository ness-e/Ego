// sdp-selftest.mjs — self-check del SDP v3 (sin frameworks; assert puro).
// Uso: bun .agents/task-system/scripts/sdp-selftest.mjs
import { strict as assert } from "node:assert"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import {
  discoverSkillsV3, extractKeywordsFromInputs, singularize, applyPolicyPins,
  isFamilyExcluded, loadSkillsIndex, calculateSkillScoreV3, SDP_VERSION,
} from "../mcp/sdp-v3.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, "..", "..", "..")
const TASK_SYSTEM = join(PROJECT_ROOT, ".agents", "task-system")
const ctx = { projectRoot: PROJECT_ROOT, taskSystemDir: TASK_SYSTEM }

let pass = 0
let fail = 0
function t(name, fn) {
  try { fn(); pass++; console.log(`ok   ${name}`) }
  catch (e) { fail++; console.error(`FAIL ${name}: ${e.message}`) }
}

t("version v3", () => assert.equal(SDP_VERSION, "v3"))

t("B1 alias ES→EN", () => {
  const k = extractKeywordsFromInputs("docs/agent-ops/plans/x.md", ["seguridad", "deuda", "entorno"], "HARD-09")
  assert(k.normalized.includes("security"), "seguridad→security")
  assert(k.normalized.includes("quality"), "deuda→quality")
  assert(k.derived.includes("security"))
})

t("B1 plurales/singular", () => {
  assert.equal(singularize("tests"), "test")
  assert.equal(singularize("gates"), "gate")
  assert.equal(singularize("queries"), "query")
  assert.equal(singularize("cli"), "cli")
})

t("R1 pin trust boundary (unsafe/ffi)", () => {
  const p = applyPolicyPins("src/ffi.rs unsafe pyo3")
  assert(p.some(x => x.skill === "security-and-hardening"), "security pin")
})

t("R1 pin CI/release", () => {
  const p = applyPolicyPins(".github/workflows/ci-rust.yml release-plz")
  assert(p.some(x => x.skill === "ci-cd-and-automation"))
  assert(p.some(x => x.skill === "git-workflow-and-versioning"))
})

t("R1 pin harness (.agents/)", () => {
  const p = applyPolicyPins(".agents/task-system/state-tools.mjs")
  assert(p.some(x => x.skill === "doubt-driven-development"))
})

t("B2 familias excluidas (exact-token only)", () => {
  assert.equal(isFamilyExcluded("incl-inclusive-personas-generate", ["personas"]), false, "token exacto permite")
  assert.equal(isFamilyExcluded("incl-inclusive-personas-generate", ["docs"]), true, "sin token → excluida")
  assert.equal(isFamilyExcluded("ci-cd-and-automation", ["docs"]), false, "no-familia nunca excluida")
})

t("B2 deprecated excluida", () => {
  const r = discoverSkillsV3({ archivosClave: "docs/x.md", phase: "VERIFY", contractKeywords: ["debugging", "error", "recovery"], taskId: "X-1" }, ctx)
  assert(!r.skills.some(s => s.name === "debugging-and-error-recovery"), "deprecated no debe aparecer")
})

t("B3 índice cargado (requiere build-skills-index)", () => {
  const idx = loadSkillsIndex(TASK_SYSTEM)
  assert(idx, "índice existe")
  assert(idx.count > 150, `count=${idx.count}`)
  assert(idx.skills["ci-cd-and-automation"], "skill presente")
  assert(idx.skills["debugging-and-error-recovery"]?.deprecated === true, "deprecated flag")
})

t("L1 score con overlap de descripción", () => {
  const base = calculateSkillScoreV3({ name: "zzz-neutral-skill", rating: 5, phase: "BUILD", taskType: "none", keywords: ["zzz"], descTokens: [] })
  const withDesc = calculateSkillScoreV3({ name: "zzz-neutral-skill", rating: 5, phase: "BUILD", taskType: "none", keywords: ["zzz"], descTokens: ["zzz", "other"] })
  assert(withDesc > base, `desc boost (${base} → ${withDesc})`)
})

t("pipeline completo — caso real HARD-02 (gates/CI)", () => {
  const r = discoverSkillsV3({
    archivosClave: "dev-tools/verify.ps1, .github/workflows/ci-rust.yml, docs/engineering/CI_POLICY.md",
    phase: "BUILD", contractKeywords: ["gates", "coverage", "nightly"], taskId: "HARD-02", maxSkills: 8,
  }, ctx)
  assert.equal(r.sdpVersion, "v3")
  assert(r.skills.length > 0 && r.skills.length <= 8, `len=${r.skills.length}`)
  assert(r.skills.some(s => s.name === "campaign-executor"), "base presente")
  assert(r.pinned.length > 0, "pins presentes (CI/release)")
  assert(r.skills.some(s => s.pinned === true), "pin en selección")
})

t("pipeline completo — keywords ES (alias)", () => {
  const r = discoverSkillsV3({ archivosClave: "docs/agent-ops/tasks/HARD-05.md", phase: "BUILD", contractKeywords: ["seguridad", "entorno"], taskId: "HARD-05" }, ctx)
  assert(r.derivedKeywords.includes("security"), "alias derivado")
})

t("base bypass de minScore", () => {
  const r = discoverSkillsV3({ archivosClave: "docs/foo.md", phase: "BUILD", contractKeywords: [], taskId: "Z-1" }, ctx)
  assert(r.skills.some(s => s.name === "campaign-executor"))
})

t("S1 cuota de calidad reservada (maxSkills tight)", () => {
  const r = discoverSkillsV3({ archivosClave: "docs/api/VERSIONING.md", phase: "BUILD", contractKeywords: ["breaking", "release"], taskId: "HARD-01", maxSkills: 7 }, ctx)
  assert(r.skills.length <= 7, `len=${r.skills.length} (≤7)`)
  assert(r.skills.some(s => ["code-review-and-quality", "doubt-driven-development", "security-and-hardening", "test-driven-development"].includes(s.name)), "calidad garantizada por reserva")
})

t("S1 garantía universal (pool NO candidata → fallback índice) [R-01]", () => {
  const r = discoverSkillsV3({ archivosClave: "release/notes/changelog.md", phase: "SHIP", contractKeywords: ["breaking", "release"], taskId: "R-01", maxSkills: 6 }, ctx)
  assert(r.skills.length <= 6, `len=${r.skills.length} (≤6)`)
  const q = r.skills.find(s => ["code-review-and-quality", "doubt-driven-development", "security-and-hardening", "test-driven-development"].includes(s.name))
  assert(q, "pool garantizada aun sin ser candidata (fallback índice)")
  assert.equal(q.justification, "quality guarantee (S1)")
})

console.log(`\nSDP v3 selftest: ${pass} pass, ${fail} fail${fail ? " — HAY FALLAS" : " ✅"}`)
if (fail) process.exit(1)
