// SDP v3 — Skill Discovery Protocol (dinámico, testable).
// Mejoras v3 (2026-09-27, decisión owner "todas las mejoras"):
//   B1 alias ES↔EN + normalización morfológica (plurales)
//   B2 cierre de drift spec↔impl: familias excluidas (incl-*/gsap-*/understand-*),
//      deprecated excluidas, minScore 0.6, boost por taskType
//   B3 índice enriquecido (skills-index.json: descripción + tokens + rating + deprecated)
//   L1 re-rank por overlap de descripción (tokens)
//   R1 policy pins por path/señal (skills obligatorias deterministas)
//   S1 cuota de diversidad (skill de calidad si hay señal de riesgo)
//   S2 boost por outcomes (skill-outcomes.json)
// Fuente spec: .agents/references/skills-engineering.md §SDP v3
// Movido desde campaign-server.mjs (TYPE_PATTERNS/detectType/LIFECYCLE_SKILLS/grep + lógica v2).

import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

export const SDP_VERSION = "v3"

// ---------- Type detection (movido del server) ----------

export const TYPE_PATTERNS = [
  { pattern: /packages\/memory\//, type: "typescript", label: "Memory Package", skills: ["source-driven-development", "test-driven-development"], checks: ["pnpm --filter @ego/memory test", "pnpm typecheck"] },
  { pattern: /packages\/(models|runtime|execution|tools|events)\//, type: "typescript", label: "Cognitive Runtime Packages", skills: ["source-driven-development", "test-driven-development"], checks: ["pnpm typecheck", "pnpm test"] },
  { pattern: /apps\/desktop\/src\/renderer\//, type: "react", label: "Desktop Renderer UI", skills: ["frontend-design", "react-dev"], checks: ["pnpm build", "pnpm typecheck"] },
  { pattern: /apps\/desktop\/src\/main\//, type: "typescript", label: "Desktop Main Process", skills: ["source-driven-development", "doubt-driven-development", "ponytail"], checks: ["pnpm build", "pnpm typecheck", "npx tsc --noEmit -p apps/desktop"] },
  { pattern: /Ego-python\//, type: "python", label: "Python SDK", skills: ["source-driven-development"], checks: ["python -m pytest"] },
  { pattern: /web\/src\//, type: "frontend", label: "Web frontend", skills: ["frontend-ui-engineering", "design-taste-frontend"], checks: ["npx tsc --noEmit", "npm run lint"] },
  { pattern: /\.github\//, type: "devops", label: "CI/CD / DevOps", skills: ["ci-cd-and-automation", "doubt-driven-development"], checks: ["yamllint .github/"] },
  { pattern: /desktop\/src/, type: "desktop", label: "Desktop Tauri", skills: ["frontend-ui-engineering", "source-driven-development"], checks: ["cd desktop && npm run build"] },
  { pattern: /Ego-mcp\//, type: "mcp", label: "MCP server", skills: ["source-driven-development", "security-and-hardening"], checks: ["cargo check -p Ego-mcp", "cargo test -p Ego-mcp --test mcp_tests"] },
  { pattern: /ego-proxy\//, type: "proxy", label: "LLM proxy", skills: ["source-driven-development"], checks: ["cargo check -p ego-proxy", "cargo test -p ego-proxy"] },
  { pattern: /Ego-server\//, type: "server", label: "HTTP server", skills: ["source-driven-development", "security-and-hardening"], checks: ["cargo check -p Ego-server"] },
  { pattern: /docs\//, type: "docs", label: "Documentation", skills: ["writing-guidelines", "writing-plans"], checks: ["scripts/validate-docs-coverage.ps1"] },
  { pattern: /(^|[^a-z-])src\//, type: "rust", label: "Rust core", skills: ["source-driven-development", "doubt-driven-development", "ponytail"], checks: ["cargo check -p Ego"] },
]

export const ESTIMATE_MAP = { "🟢": { turns: "5-10", label: "Bajo" }, "🟡": { turns: "15-30", label: "Medio" }, "🔴": { turns: "30-60", label: "Alto" } }

export function detectType(archivosClave) {
  if (!archivosClave || archivosClave.trim() === "") return { type: "unknown", label: "No detectable", skills: [], checks: [], estimate: null }

  const m = TYPE_PATTERNS.find(tp => tp.pattern.test(archivosClave))
  if (!m) return { type: "unknown", label: "No detectable", skills: ["campaign-executor"], checks: ["cargo check -p Ego"], estimate: null }

  const effortMatch = archivosClave.match(/[🟢🟡🔴]/)
  const estimate = effortMatch ? ESTIMATE_MAP[effortMatch[0]] : null

  return { type: m.type, label: m.label, skills: m.skills, checks: m.checks, estimate }
}

// ---------- Lifecycle mapping (movido del server) ----------

export const LIFECYCLE_SKILLS = {
  DEFINE: [
    { name: "spec-driven-development", trigger: "Nueva feature, API, cambio significativo — escribe spec/PRD antes de código" },
    { name: "interview-me", trigger: "Requisitos ambiguos — extrae lo que el usuario realmente necesita" },
    { name: "idea-refine", trigger: "Concepto vago → propuesta concreta" },
  ],
  PLAN: [
    { name: "planning-and-task-breakdown", trigger: "Spec listo → tareas pequeñas, verificables, con dependencias" },
  ],
  BUILD: [
    { name: "incremental-implementation", trigger: "Implementar en slices verticales delgados (test → code → verify → commit)" },
    { name: "test-driven-development", trigger: "Lógica nueva, bugs — Red-Green-Refactor, pirámide 80/15/5" },
    { name: "context-engineering", trigger: "Sesión nueva, tarea compleja — empaqueta contexto relevante para el agente" },
    { name: "source-driven-development", trigger: "Decisiones de framework/library — verifica docs oficiales primero" },
    { name: "doubt-driven-development", trigger: "Stakes altos (producción, seguridad) — verificación adversarial en contexto fresco" },
    { name: "frontend-ui-engineering", trigger: "UI nueva o modificación en web/" },
    { name: "api-and-interface-design", trigger: "APIs, boundaries de módulos, interfaces públicas" },
  ],
  VERIFY: [
    { name: "systematic-debugging", trigger: "Tests fallan, builds rotos, comportamiento inesperado — root cause first (Iron Law)" },
    { name: "browser-testing-with-devtools", trigger: "Depurar algo que corre en navegador (web/)" },
  ],
  REVIEW: [
    { name: "code-review-and-quality", trigger: "Antes de mergear cualquier cambio — revisión en 5 ejes" },
    { name: "code-simplification", trigger: "Código funciona pero es más complejo de lo necesario" },
    { name: "security-and-hardening", trigger: "Input de usuario, auth, datos, integraciones externas" },
    { name: "performance-optimization", trigger: "Requisitos de performance o regresiones sospechadas" },
  ],
  SHIP: [
    { name: "git-workflow-and-versioning", trigger: "Siempre — commits atómicos, trunk-based, ~100 líneas por cambio" },
    { name: "ci-cd-and-automation", trigger: "CI/CD pipelines, Shift Left, feature flags" },
    { name: "shipping-and-launch", trigger: "Antes de deploy — checklists, rollout gradual, rollback" },
    { name: "documentation-and-adrs", trigger: "Decisiones arquitectónicas, cambios de API, features nuevas" },
    { name: "deprecation-and-migration", trigger: "Remover sistemas viejos, migrar usuarios, sunset features" },
    { name: "observability-and-instrumentation", trigger: "Telemetría, logging estructurado, métricas RED" },
  ],
}

// ---------- Keyword mapping (spec + extensiones v3 de dominio) ----------

export const KEYWORD_TO_SKILLS = {
  rust: ["source-driven-development", "test-driven-development", "systematic-debugging"],
  engine: ["api-and-interface-design", "performance-optimization"],
  storage: ["deprecation-and-migration", "observability-and-instrumentation"],
  wal: ["security-and-hardening", "deprecation-and-migration"],
  index: ["performance-optimization", "systematic-debugging"],
  hnsw: ["performance-optimization", "source-driven-development"],
  concurrency: ["security-and-hardening", "doubt-driven-development"],
  ffi: ["security-and-hardening", "systematic-debugging"],
  pyo3: ["security-and-hardening", "api-and-interface-design"],
  wasm: ["performance-optimization", "shipping-and-launch"],
  python: ["source-driven-development", "api-and-interface-design"],
  sdk: ["api-and-interface-design", "documentation-and-adrs"],
  bindings: ["security-and-hardening", "test-driven-development"],
  web: ["frontend-ui-engineering", "browser-testing-with-devtools"],
  ui: ["frontend-ui-engineering", "design-taste-frontend"],
  component: ["frontend-ui-engineering", "incremental-implementation"],
  nextjs: ["frontend-ui-engineering", "source-driven-development"],
  tailwind: ["frontend-ui-engineering"],
  motion: ["design-motion-principles", "frontend-ui-engineering"],
  accessibility: ["a11y-accessibility-audit", "incl-accessible-content-review"],
  a11y: ["a11y-accessibility-scan", "a11y-accessibility-fix"],
  test: ["test-driven-development", "systematic-debugging"],
  debug: ["systematic-debugging", "browser-testing-with-devtools"],
  flaky: ["systematic-debugging", "code-review-and-quality"],
  coverage: ["test-driven-development", "constraint-driven-development"],
  benchmark: ["performance-optimization", "observability-and-instrumentation"],
  profile: ["performance-optimization"],
  security: ["security-and-hardening", "doubt-driven-development"],
  unsafe: ["security-and-hardening", "systematic-debugging"],
  audit: ["security-and-hardening"],
  "supply-chain": ["security-and-hardening", "deprecation-and-migration"],
  ci: ["ci-cd-and-automation", "shipping-and-launch"],
  release: ["shipping-and-launch", "git-workflow-and-versioning"],
  version: ["git-workflow-and-versioning", "release-notes-one-pager"],
  changelog: ["documentation-and-adrs", "release-notes-one-pager"],
  deploy: ["shipping-and-launch", "observability-and-instrumentation"],
  architecture: ["api-and-interface-design", "deprecation-and-migration"],
  design: ["ego-design-orchestrator", "impeccable"],
  api: ["api-and-interface-design", "spec-driven-development"],
  interface: ["api-and-interface-design", "frontend-ui-engineering"],
  refactor: ["code-simplification", "incremental-implementation"],
  simplify: ["code-simplification"],
  pipeline: ["campaign-executor", "progreso"],
  task: ["campaign-executor", "planning-and-task-breakdown"],
  plan: ["planning-and-task-breakdown", "spec-driven-development"],
  backlog: ["progreso", "campaign-executor"],
  docs: ["documentation-and-adrs", "writing-guidelines"],
  adr: ["documentation-and-adrs", "deprecation-and-migration"],
  spec: ["spec-driven-development", "interview-me"],
  constraint: ["constraint-driven-development", "code-review-and-quality"],
  quality: ["constraint-driven-development", "code-review-and-quality"],
  // --- extensiones v3 (dominios del proyecto) ---
  server: ["security-and-hardening", "source-driven-development"],
  mcp: ["source-driven-development", "security-and-hardening"],
  cli: ["api-and-interface-design", "documentation-and-adrs"],
  install: ["shipping-and-launch", "documentation-and-adrs"],
  dependabot: ["ci-cd-and-automation", "security-and-hardening"],
  sbom: ["ci-cd-and-automation", "security-and-hardening"],
  wheels: ["ci-cd-and-automation"],
  notebook: ["documentation-and-adrs"],
  colab: ["documentation-and-adrs"],
  hooks: ["ci-cd-and-automation"],
  bundle: ["git-workflow-and-versioning"],
  backup: ["deprecation-and-migration"],
  telemetry: ["observability-and-instrumentation"],
  privacy: ["security-and-hardening"],
  git: ["git-workflow-and-versioning"],
  commit: ["git-workflow-and-versioning"],
  review: ["code-review-and-quality"],
  harness: ["doubt-driven-development"],
  schema: ["deprecation-and-migration", "database-design"],
  migration: ["deprecation-and-migration", "database-schema-designer"],
  memory: ["documentation-and-adrs", "api-and-interface-design"],
}

// B2d: boost por tipo de tarea (taskType) — spec: boost_type_match 0.2
export const TYPE_TO_SKILLS = {
  "bug-fix": ["systematic-debugging", "test-driven-development"],
  bug: ["systematic-debugging", "test-driven-development"],
  "feature-add": ["spec-driven-development", "incremental-implementation", "test-driven-development"],
  refactor: ["code-simplification", "incremental-implementation"],
  docs: ["documentation-and-adrs", "writing-guidelines"],
  documentation: ["documentation-and-adrs", "writing-guidelines"],
  security: ["security-and-hardening"],
  test: ["test-driven-development"],
  ci: ["ci-cd-and-automation"],
  release: ["shipping-and-launch", "git-workflow-and-versioning"],
}

// ---------- B1: aliases ES↔EN + normalización morfológica ----------

export const KEYWORD_ALIASES = {
  // ES → EN (planning del proyecto en español)
  seguridad: "security", entorno: "ci", deuda: "quality", frontera: "api",
  esquema: "schema", migracion: "migration", verificacion: "test", validacion: "test",
  publicacion: "release", memoria: "memory", indice: "index", pruebas: "test",
  documentacion: "docs", revision: "audit", lanzamiento: "release", despliegue: "deploy",
  planificacion: "plan", rendimiento: "performance", concurrencia: "concurrency",
  almacenamiento: "storage", cifrado: "security", gobernanza: "security",
  diseno: "design", interfaz: "interface", accesibilidad: "accessibility",
  blindado: "security", respaldo: "backup", versionado: "version", gates: "ci",
  instalacion: "install", telemetria: "telemetry", privacidad: "privacy",
  trazas: "telemetry", cobertura: "coverage", perfilado: "profile",
  simplificar: "simplify", refactorizar: "refactor", arreglar: "debug",
  corregir: "debug", errores: "debug", fallo: "debug", requisitos: "spec",
  auditoria: "audit", contrato: "api", politica: "quality", presupuesto: "quality",
  trenes: "release", carril: "plan", humo: "test", smoke: "test",
  // EN synonyms / variantes
  tests: "test", testing: "test", workflows: "ci", hardening: "security",
  semver: "version", versioning: "version", breaking: "version",
  bundles: "bundle", secrets: "security", auth: "security", credentials: "security",
  pypi: "release", npm: "release", crates: "release", docker: "deploy",
}

export function singularize(w) {
  if (!w || w.length < 4) return w
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y"
  if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) return w.slice(0, -1)
  return w
}

export function extractKeywordsFromInputs(archivosClave, contractKeywords, taskId) {
  const raw = new Set()
  if (archivosClave) {
    for (const part of String(archivosClave).split(/[\s,\/\.]+/)) {
      const kw = part.toLowerCase().replace(/[^a-z0-9-]/g, "")
      if (kw.length > 2) raw.add(kw)
    }
  }
  for (const kw of contractKeywords || []) {
    const k = String(kw).toLowerCase().trim().replace(/_/g, "-")
    if (k) raw.add(k)
  }
  if (taskId) {
    const prefix = String(taskId).split("-")[0].toLowerCase()
    if (prefix.length > 1) raw.add(prefix)
  }
  const normalized = new Set()
  const derived = new Set()
  for (const k of raw) {
    normalized.add(k)
    const s = singularize(k)
    if (s !== k) normalized.add(s)
    const alias = KEYWORD_ALIASES[k] || KEYWORD_ALIASES[s]
    if (alias && !raw.has(alias)) { normalized.add(alias); derived.add(alias) }
  }
  return { raw: [...raw], normalized: [...normalized], derived: [...derived] }
}

// ---------- B2: familias excluidas + deprecated ----------

export const EXCLUDED_FAMILIES = ["incl-", "gsap-", "understand-"]

// Familia excluida: solo se permite si un keyword raw es token exacto del nombre (spec).
export function isFamilyExcluded(name, rawKeywords) {
  const lower = String(name).toLowerCase()
  const fam = EXCLUDED_FAMILIES.find(f => lower.startsWith(f))
  if (!fam) return false
  const tokens = lower.split("-")
  return !(rawKeywords || []).some(k => tokens.includes(String(k).toLowerCase()))
}

export function isDeprecatedInManifest(manifestContent, name) {
  if (!manifestContent) return false
  const esc = escapeRegExp(name)
  return new RegExp("\\|\\s*`?" + esc + "`?\\s*\\|[^\\n]*DEPRECATED", "i").test(manifestContent)
}

export function getRatingFromManifest(manifestContent, name) {
  if (!manifestContent) return 5
  const esc = escapeRegExp(name)
  const m = manifestContent.match(new RegExp("\\|\\s*`?" + esc + "`?\\s*\\|\\s*(\\d+)\\s*\\|", "i"))
  return m ? parseInt(m[1], 10) : 5
}

// ---------- R1: policy pins (skills obligatorias por path/señal) ----------

export const POLICY_PINS = [
  { match: /\.agents\//i, skills: ["doubt-driven-development"], label: "harness (.agents/)" },
  { match: /\.github\/|release-plz|semver|workflow/i, skills: ["ci-cd-and-automation", "git-workflow-and-versioning"], label: "CI/release" },
  { match: /unsafe|\bffi\b|pyo3|wasm|\bauth\b|secret|credential/i, skills: ["security-and-hardening"], label: "trust boundary" },
  { match: /docs\/api\//i, skills: ["documentation-and-adrs", "api-and-interface-design"], label: "API docs" },
  { match: /tests?\/|test_|\bfix\b|\bbug\b/i, skills: ["test-driven-development", "systematic-debugging"], label: "tests/fix" },
  { match: /storage|\bwal\b|schema|migration/i, skills: ["deprecation-and-migration"], label: "storage/schema" },
  { match: /performance|bench|hot[- ]?path/i, skills: ["performance-optimization"], label: "performance" },
]

export function applyPolicyPins(signalText) {
  const out = []
  const text = String(signalText || "")
  for (const pin of POLICY_PINS) {
    if (!pin.match.test(text)) continue
    for (const skill of pin.skills) {
      if (!out.some(p => p.skill === skill)) out.push({ skill, label: pin.label })
    }
  }
  return out
}

// ---------- S1: cuota de diversidad ----------

export const RISK_RE = /security|unsafe|breaking|auth|release|migration|schema|deuda|debt|governance|gobernanza/i
export const QUALITY_POOL = ["code-review-and-quality", "doubt-driven-development", "security-and-hardening", "test-driven-development"]

// ---------- B3: índice enriquecido ----------

export function loadSkillsIndex(taskSystemDir) {
  try {
    const p = join(taskSystemDir, "skills-index.json")
    if (!existsSync(p)) return null
    const idx = JSON.parse(readFileSync(p, "utf-8"))
    if (!idx || !idx.skills) return null
    return idx
  } catch { return null }
}

// ---------- S2: outcomes (feedback loop) ----------

export function loadSkillOutcomes(taskSystemDir) {
  try {
    const p = join(taskSystemDir, "memory", "skill-outcomes.json")
    if (!existsSync(p)) return {}
    const data = JSON.parse(readFileSync(p, "utf-8"))
    const entries = Array.isArray(data.entries) ? data.entries : []
    const stats = {}
    for (const e of entries) {
      for (const s of e.skills || []) {
        if (!stats[s]) stats[s] = { loads: 0, ok: 0, fail: 0 }
        stats[s].loads++
        if (e.outcome === "ok") stats[s].ok++
        else if (e.outcome === "fail") stats[s].fail++
      }
    }
    return stats
  } catch { return {} }
}

export function outcomeBoost(stats, name) {
  const s = stats[name]
  if (!s || s.loads < 3) return 0
  const rate = s.ok / Math.max(1, s.ok + s.fail)
  if (rate >= 0.7) return 0.1
  if (rate < 0.4) return -0.1
  return 0.05
}

// ---------- manifest grep (movido + limpiado) ----------

export function escapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") }

export function grepSkillsManifest(projectRoot, keywords) {
  const manifestPath = join(projectRoot, "SKILLS-MANIFEST.md")
  if (!existsSync(manifestPath)) return []
  const content = readFileSync(manifestPath, "utf-8")
  const lines = content.split(/\r?\n/)
  const results = []
  for (const kw of keywords || []) {
    const k = String(kw).toLowerCase()
    if (k.length < 3) continue
    for (const line of lines) {
      if (!line.toLowerCase().includes(k)) continue
      const backticks = line.match(/`([a-z0-9][a-z0-9-]{2,})`/gi) || []
      for (const bt of backticks) results.push(bt.replace(/`/g, ""))
      const row = line.match(/^\|\s*([a-z0-9][a-z0-9-]{2,})\s*\|/)
      if (row) results.push(row[1])
    }
  }
  return [...new Set(results)]
}

// ---------- scoring v3 ----------

export function calculateSkillScoreV3({ name, rating, phase, taskType, keywords, descTokens = [], outcomeBoost: ob = 0 }) {
  let score = (rating || 5) / 10
  const lowerName = String(name).toLowerCase()
  const kw = (keywords || []).map(k => String(k).toLowerCase())

  const phaseSkills = (LIFECYCLE_SKILLS[phase] || []).map(s => s.name)
  if (phaseSkills.includes(name)) score += 0.3

  const typeSkills = TYPE_TO_SKILLS[String(taskType || "").toLowerCase()] || []
  if (typeSkills.includes(name)) score += 0.2

  let mapped = 0
  for (const k of kw) {
    const m = KEYWORD_TO_SKILLS[k] || []
    if (m.includes(name)) mapped++
  }
  score += Math.min(0.3, mapped * 0.15)

  for (const k of kw) {
    if (lowerName.includes(k) || k.includes(lowerName.split("-")[0])) { score += 0.1; break }
  }

  const overlap = (descTokens || []).filter(t => kw.includes(t)).length
  score += Math.min(0.15, overlap * 0.05)

  if (rating >= 8) score += 0.1
  else if (rating >= 7) score += 0.05

  score += ob
  return Math.min(1, Math.max(0, score))
}

// ---------- pipeline principal ----------

export function discoverSkillsV3(input, ctx) {
  const {
    archivosClave = "", phase = "BUILD", contractKeywords = [],
    taskId = null, taskType = null, maxSkills = 8, minScore = 0.6,
  } = input || {}
  const { projectRoot, taskSystemDir } = ctx

  // 1. Base por tipo + base fija
  let typeInfo = null
  let typeLabel = taskType || "unknown"
  let baseSkills = ["campaign-executor", "progreso"]
  try {
    typeInfo = detectType(archivosClave)
    baseSkills = [...new Set([...(typeInfo.skills || []), "campaign-executor", "progreso"])]
    typeLabel = typeInfo.label || taskType || "unknown"
  } catch { /* base-only */ }

  // 2. Lifecycle
  const lifecycleSkills = (LIFECYCLE_SKILLS[phase] || []).map(s => s.name)

  // 3. Keywords (B1: raw + normalized + derived)
  const kwInfo = extractKeywordsFromInputs(archivosClave, contractKeywords, taskId)
  const keywords = kwInfo.normalized

  // 4. Manifest grep
  const manifestSkills = grepSkillsManifest(projectRoot, keywords)

  // 5. Índice enriquecido (B3)
  const index = loadSkillsIndex(taskSystemDir)
  const indexMatches = []
  if (index) {
    const kwSet = new Set(keywords)
    for (const [name, meta] of Object.entries(index.skills || {})) {
      if (meta.deprecated) continue
      const toks = meta.tokens || []
      if (toks.some(t => kwSet.has(t))) indexMatches.push(name)
    }
  }

  // 6. Keyword mapping
  const keywordMappedSkills = []
  for (const kw of keywords) {
    for (const s of (KEYWORD_TO_SKILLS[kw] || [])) {
      if (!keywordMappedSkills.includes(s)) keywordMappedSkills.push(s)
    }
  }

  // 7. Merge + dedup
  let allCandidates = [...new Set([...baseSkills, ...lifecycleSkills, ...keywordMappedSkills, ...manifestSkills, ...indexMatches])]

  // 8. Familias excluidas (B2)
  let excludedFamiliesSkipped = 0
  allCandidates = allCandidates.filter(name => {
    if (isFamilyExcluded(name, kwInfo.raw)) { excludedFamiliesSkipped++; return false }
    return true
  })

  // 9. Deprecated (B2)
  const manifestPath = join(projectRoot, "SKILLS-MANIFEST.md")
  const manifestContent = existsSync(manifestPath) ? readFileSync(manifestPath, "utf-8") : ""
  let deprecatedExcluded = 0
  allCandidates = allCandidates.filter(name => {
    const dep = (index?.skills?.[name]?.deprecated) || isDeprecatedInManifest(manifestContent, name)
    if (dep) { deprecatedExcluded++; return false }
    return true
  })

  // 10. Outcomes (S2)
  const outcomes = loadSkillOutcomes(taskSystemDir)
  let outcomesApplied = 0

  // 11. Scoring (con re-rank por descripción L1 + outcomes S2)
  const scored = allCandidates.map(name => {
    const rating = index?.skills?.[name]?.rating ?? getRatingFromManifest(manifestContent, name)
    const descTokens = index?.skills?.[name]?.tokens || []
    const ob = outcomeBoost(outcomes, name)
    if (ob !== 0) outcomesApplied++
    const score = calculateSkillScoreV3({ name, rating, phase, taskType: taskType || typeLabel, keywords, descTokens, outcomeBoost: ob })
    let justification
    if (baseSkills.includes(name)) justification = `base type: ${typeLabel} (score ${score.toFixed(2)})`
    else if (lifecycleSkills.includes(name)) {
      const ls = LIFECYCLE_SKILLS[phase]?.find(x => x.name === name)
      justification = `lifecycle ${phase}: ${ls ? ls.trigger.substring(0, 60) : name} (score ${score.toFixed(2)})`
    } else if (keywordMappedSkills.includes(name)) {
      const hits = keywords.filter(k => (KEYWORD_TO_SKILLS[k] || []).includes(name)).join(",")
      justification = `keyword mapping: ${hits} (score ${score.toFixed(2)})`
    } else if (manifestSkills.includes(name)) justification = `manifest grep (score ${score.toFixed(2)})`
    else justification = `index/description match (score ${score.toFixed(2)})`
    if (ob > 0) justification += " [outcomes+]"
    if (ob < 0) justification += " [outcomes-]"
    return { name, score, rating, justification, pinned: false }
  }).filter(s => s.score >= minScore || baseSkills.includes(s.name))
    .sort((a, b) => b.score - a.score)

  const skillMap = new Map(scored.map(s => [s.name, s]))

  // 12. Policy pins (R1) — obligatorias
  const signalText = `${archivosClave} ${(contractKeywords || []).join(" ")}`.toLowerCase()
  const pins = applyPolicyPins(signalText)

  // 13. Selección: pins + base FIJA (obligatorias) + cupo de calidad S1 reservado ANTES del fill + fill por score
  const mandatory = [...new Set([...pins.map(p => p.skill), ...baseSkills])]
  const selected = [...mandatory]
  let qualityReserved = null
  if (mandatory.length < maxSkills && RISK_RE.test(signalText) && !selected.some(n => QUALITY_POOL.includes(n))) {
    qualityReserved = scored.find(s => QUALITY_POOL.includes(s.name) && !selected.includes(s.name))?.name || null
    if (!qualityReserved) {
      // R-01: garantía universal — si la pool no es candidata, inyectar la mejor por rating (índice/manifest)
      qualityReserved = QUALITY_POOL
        .filter(n => !selected.includes(n))
        .map(n => ({ n, r: index?.skills?.[n]?.rating ?? getRatingFromManifest(manifestContent, n) }))
        .sort((a, b) => b.r - a.r)[0]?.n || null
    }
  }
  const fillCap = qualityReserved ? maxSkills - 1 : maxSkills
  for (const s of scored) {
    if (selected.length >= fillCap) break
    if (!selected.includes(s.name)) selected.push(s.name)
  }
  if (qualityReserved && !selected.includes(qualityReserved)) selected.push(qualityReserved)
  // R-02: recuperar el cupo si la reservada entró durante el fill
  for (const s of scored) {
    if (selected.length >= maxSkills) break
    if (!selected.includes(s.name)) selected.push(s.name)
  }

  const finalSkills = selected.map(name => {
    const pin = pins.find(p => p.skill === name)
    if (pin) {
      const rating = index?.skills?.[name]?.rating ?? getRatingFromManifest(manifestContent, name)
      return { name, score: 1, rating, justification: `policy: ${pin.label}`, pinned: true }
    }
    return skillMap.get(name) || { name, score: null, rating: index?.skills?.[name]?.rating ?? null, justification: "quality guarantee (S1)", pinned: false }
  })
  const sortOrder = ["campaign-executor", "progreso", "ponytail"]
  const sorted = [
    ...sortOrder.filter(n => finalSkills.some(x => x.name === n)).map(n => finalSkills.find(x => x.name === n)),
    ...finalSkills.filter(x => !sortOrder.includes(x.name)),
  ].filter(Boolean)

  return {
    sdpVersion: SDP_VERSION,
    phase, taskId: taskId || null, taskType: taskType || typeLabel,
    keywords, rawKeywords: kwInfo.raw, derivedKeywords: kwInfo.derived, keywordsCount: keywords.length,
    baseSkills, lifecycleSkills, keywordMappedSkills, manifestSkills,
    indexLoaded: !!index, indexMatches: indexMatches.length,
    totalCandidates: allCandidates.length, filteredByScore: scored.length,
    excludedFamiliesSkipped, deprecatedExcluded, outcomesApplied,
    pinned: pins, maxSkills, minScore,
    skills: sorted,
    commands: sorted.map(s => `skill ${s.name}`),
    checks: typeInfo?.checks || [], estimate: typeInfo?.estimate || null,
  }
}
