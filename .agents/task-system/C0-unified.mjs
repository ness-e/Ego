// C0-unified.mjs — CANONICAL C0 v2 absorbente (runtime + spec index).
// Absorbe en UNA sola fuente:
//   1. config/state-tools.mjs      → allowed/denied por estado (re-export exacto, cero divergencia)
//   2. prompts/iter-loop-tools.md  → transiciones/guardas C0 (Statewright pattern)
//   3. workflows/*.json            → instrucciones por tipo (phase templates, classification-output)
//   4. mcp/campaign-server.mjs     → BUDGET_LIMITS (espejo; el server sigue siendo fuente de enforcement)
//   5. skills/campaign-executor    → DoD 3 niveles + Self-Harness + Evaluator-optimizer
//   6. prompts/question-gates.md   → Gates D/V/C (+ P como contexto)
//
// Regla de compatibilidad (C0-UNIFY-06): legacy SIGUE funcionando.
// state-tools.mjs y workflows/*.json quedan como legacy deprecated con pointer
// a este archivo, pero su runtime es idéntico (este módulo re-exporta, no copia).
// Flag aditivo v2: `unified:true` por llamada MCP o env `C0_V2=1` global.
// Sin flag → comportamiento legacy exacto (enforce_state inalterado).
//
// Prose spec pareja: `.agents/task-system/C0-unified.md` (tablas + diagrama +
// migración). Este .mjs es la fuente ejecutable; el .md es la vista humana.
// Si divergen, manda este .mjs (verificado por config/parity-check.mjs).
import { STATE_TOOLS as LEGACY_STATE_TOOLS, getAllowedTools as legacyGetAllowedTools, validateAction as legacyValidateAction, REVIEW_ACCEPT_RULES as LEGACY_REVIEW_ACCEPT_RULES, validateReviewAccept as legacyValidateReviewAccept } from "./config/state-tools.mjs"

// ---------- 1. Enforcement legacy (re-export exacto — NO copiar listas) ----------
export const STATE_TOOLS = LEGACY_STATE_TOOLS
export const getAllowedTools = legacyGetAllowedTools
export const validateAction = legacyValidateAction
// HARD-07: review gate mecanizado (REVIEW→ACCEPT) — mismo re-export exacto del runtime legacy.
export const REVIEW_ACCEPT_RULES = LEGACY_REVIEW_ACCEPT_RULES
export const validateReviewAccept = legacyValidateReviewAccept

export const C0_VERSION = 2
export const C0_CANONICAL = ".agents/task-system/C0-unified.mjs"
export const C0_SPEC = ".agents/task-system/C0-unified.md"
export const C0_LEGACY = {
  stateTools: ".agents/task-system/config/state-tools.mjs",
  workflowsDir: ".agents/task-system/workflows/",
  proseSpec: ".agents/task-system/prompts/iter-loop-tools.md",
  note: "legacy deprecated — espejo funcional, canónico es C0-unified.mjs",
}

export const C0_STATES = Object.keys(STATE_TOOLS)

// ---------- 2. Transiciones + guardas C0 (Statewright pattern) ----------
// Fuente prose: prompts/iter-loop-tools.md §MODO EJECUCIÓN + skills/campaign-executor/SKILL.md §Fase 2.
// Los estados de workflows/*.json (localizing/spec/audit/...) NO pasan por enforce_state:
// son classification-output (guía de fases), el runtime enforcea SIEMPRE estos 10.
export const C0_TRANSITIONS = {
  PLAN: ["ACT"],
  ACT: ["VERIFY"],
  VERIFY: ["PLAN", "STALL", "COLLATERAL"],
  COLLATERAL: ["RESEARCH", "EVALUATE"],
  RESEARCH: ["ACT"],
  EVALUATE: ["REVIEW", "ACT"],
  REVIEW: ["VERIFY", "ACCEPT"],
  ACCEPT: ["CLOSE"],
  CLOSE: [],
  STALL: [],
}

export const C0_INVALID = [
  ["PLAN", "EVALUATE", "no implementado"],
  ["ACT", "ACCEPT", "no verificado"],
  ["ACT", "CLOSE", "no revisado"],
  ["ACT", "REVIEW", "no evaluado"],
]

// Guardas con semántica (qué condición habilita cada transición no-lineal).
export const C0_GUARDS = {
  "VERIFY->PLAN": "falló → reintentar (retry ladder, Agente de Diagnóstico sintetiza causa raíz)",
  "VERIFY->STALL": "2 fallas verify MISMO error (archivo+línea+mensaje) → Gate V (question-gates.md)",
  "VERIFY->COLLATERAL": "pasó → barrer errores colaterales (rápido <30min inline, lento → FIND-* en Backlog)",
  "COLLATERAL->RESEARCH": "ambigüedad (API externa, patrón no familiar) → investigar con web research",
  "COLLATERAL->EVALUATE": "sin errores colaterales → auto-evaluación",
  "EVALUATE->REVIEW": "auto-evaluación 3 ejes pasa → revisión",
  "EVALUATE->ACT": "auto-evaluación falla → re-implementar (máx 2 iteraciones evaluator-optimizer)",
  "REVIEW->VERIFY": "review encuentra issues → re-verificar",
  "REVIEW->ACCEPT": "review pasa (agente DISTINTO al implementador, P2-01) → aceptar · MECANIZADO (HARD-07): `validateReviewAccept` exige review:{mode:'fresh', reviewer_context ≠ author_context} o mode:'degraded' + waiver {owner, ref}; sin payload válido `updateTaskStateCore` NO escribe el ACCEPT",
  "ACCEPT->CLOSE": "DoD aceptado → commit y cierre",
}

export function isValidTransition(from, to) {
  const f = String(from || "").toUpperCase()
  const t = String(to || "").toUpperCase()
  return (C0_TRANSITIONS[f] || []).includes(t)
}

// ---------- 3. Perfiles por tipo (workflows/*.json absorbidos) ----------
// Cada perfil conserva: id legacy, fase inicial, dod_version, fases completas
// (instructions + max_iterations + on + safe_next/thinking_LEVEL cuando existe).
// Los `allowed_tools` de fase son GUÍA classification-output, NO enforcement:
// el enforcement runtime usa SIEMPRE STATE_TOOLS (ver §2). Se preservan aquí
// para que la pareja v2 sea absorbente, marcados como `phaseToolsGuide: true`.
export const TYPE_PROFILES = {
  "bug-fix": {
    id: "Ego-bug-fix",
    initial: "localizing",
    dod_version: 1,
    legacyFile: "workflows/bug-fix.json",
    phases: {
      localizing: { instructions: "PROGRAMMATIC: Use the campaign executor to grep + extract relevant code sections. Recitation block captures the file/line scope of the bug.", max_iterations: 3, on: { LOCALIZED: "planning", FAIL: "failed" } },
      planning: { instructions: "Read relevant files and plan your fix. Do NOT edit anything yet. The verification gate will validate the plan before implementation.", max_iterations: 5, safe_next: "implementing", on: { PLAN_READY: "implementing", FAIL: "failed" } },
      implementing: { instructions: "Implement the fix. Make targeted, minimal edits. Use the campaign executor's verification gate before transitioning to testing.", max_iterations: 8, safe_next: "testing", on: { DONE: "testing", FAIL: "failed" } },
      testing: { instructions: "Run the tests via the campaign executor. If they fail, use TESTS_FAIL to go back and fix. Only use FAIL for unrecoverable errors. The verification gate blocks completion until all tests pass.", max_iterations: 3, on: { TESTS_PASS: "review", TESTS_FAIL: "implementing", FAIL: "failed" } },
      review: { instructions: "Evaluator-optimizer: auto-crítica 3 ejes (correctitud, simplicidad, consistencia). Verificar edge cases, ponytail ladder aplicada, codegraph_codegraph_explore post-implement para verificar blast radius. Máximo 2 iteraciones.", max_iterations: 2, on: { REVIEW_PASS: "accept", ISSUES_FOUND: "implementing", FAIL: "failed" } },
      accept: { instructions: "RATCHETED DOD v1. Leer dod_version del workflow. V1: contrato ✅, output validado ✅, blast radius verificado ✅, deuda técnica identificada ✅, documentación actualizada ✅. V2+: +ponytail-review sin findings, +test-coverage. V3+: +no secrets en diff, +conventional-commit validado. Si todas ✅ → ACCEPTED.", max_iterations: 2, on: { ACCEPTED: "close", REJECTED: "implementing", FAIL: "failed" } },
      close: { instructions: "git add -p + git commit con Conventional Commits. skill progreso (Trigger 1). Context Save Point.", max_iterations: 2, on: { CLOSED: "completed", FAIL: "failed" } },
    },
  },
  "feature-add": {
    id: "feature-add",
    initial: "spec",
    dod_version: 1,
    legacyFile: "workflows/feature-add.json",
    phases: {
      spec: { instructions: "Understand existing code patterns via codegraph_codegraph_explore. Define API boundary: what types, traits, function signatures. Do NOT code yet.", max_iterations: 3, on: { SPEC_READY: "implement", FAIL: "failed" } },
      implement: { instructions: "Implement incrementally (~100 lines). Verify compiles after each chunk. Follow existing patterns in neighboring files.", max_iterations: 10, on: { DONE: "verify", FAIL: "failed" } },
      verify: { instructions: "Run verification. If tests fail → IMPLEMENT. If compilation errors → IMPLEMENT.", max_iterations: 3, on: { VERIFIED: "review", FAIL: "implement", BLOCKED: "failed" } },
      review: { instructions: "Evaluator-optimizer: auto-crítica 3 ejes (correctitud, simplicidad, consistencia). Verificar edge cases, ponytail ladder aplicada, codegraph_codegraph_explore post-implement para verificar blast radius. Máximo 2 iteraciones.", max_iterations: 2, on: { REVIEW_PASS: "accept", ISSUES_FOUND: "implement", FAIL: "failed" } },
      accept: { instructions: "RATCHETED DOD v1. Leer dod_version del workflow. V1: contrato ✅, output validado ✅, blast radius verificado ✅, deuda técnica identificada ✅, documentación actualizada ✅. V2+: +ponytail-review sin findings, +test-coverage. V3+: +no secrets en diff, +conventional-commit validado. Si todas ✅ → ACCEPTED.", max_iterations: 2, on: { ACCEPTED: "close", REJECTED: "implement", FAIL: "failed" } },
      close: { instructions: "git add -p + git commit con Conventional Commits. skill progreso (Trigger 1). Context Save Point.", max_iterations: 2, on: { CLOSED: "completed", FAIL: "failed" } },
    },
  },
  refactor: {
    id: "refactor",
    initial: "audit",
    dod_version: 1,
    legacyFile: "workflows/refactor.json",
    phases: {
      audit: { instructions: "Map blast radius with codegraph_codegraph_explore: what calls this, what it calls, all impls. List every file that changes. Do NOT edit yet.", max_iterations: 3, on: { AUDIT_READY: "migrate", FAIL: "failed" } },
      migrate: { instructions: "One call site at a time. After each file, verify compiles (pnpm typecheck). No test changes yet.", max_iterations: 15, on: { DONE: "cleanup", FAIL: "failed" } },
      cleanup: { instructions: "Remove dead code, old types, deprecated exports. clean unused code. pnpm typecheck.", max_iterations: 3, on: { CLEAN: "verify", FAIL: "migrate" } },
      verify: { instructions: "Full verification. If tests fail → diagnose and fix. Verify no public API broke.", max_iterations: 3, on: { VERIFIED: "review", FAIL: "migrate", BLOCKED: "failed" } },
      review: { instructions: "Evaluator-optimizer: auto-crítica 3 ejes (correctitud, simplicidad, consistencia). Verificar edge cases, ponytail ladder aplicada, codegraph_codegraph_explore post-implement para verificar blast radius. Máximo 2 iteraciones.", max_iterations: 2, on: { REVIEW_PASS: "accept", ISSUES_FOUND: "migrate", FAIL: "failed" } },
      accept: { instructions: "RATCHETED DOD v1. Leer dod_version del workflow. V1: contrato ✅, output validado ✅, blast radius verificado ✅, deuda técnica identificada ✅, documentación actualizada ✅. V2+: +ponytail-review sin findings, +test-coverage. V3+: +no secrets en diff, +conventional-commit validado. Si todas ✅ → ACCEPTED.", max_iterations: 2, on: { ACCEPTED: "close", REJECTED: "migrate", FAIL: "failed" } },
      close: { instructions: "git add -p + git commit con Conventional Commits. skill progreso (Trigger 1). Context Save Point.", max_iterations: 2, on: { CLOSED: "completed", FAIL: "failed" } },
    },
  },
  research: {
    id: "Ego-research",
    initial: "scoping",
    dod_version: 1,
    legacyFile: "workflows/research.json",
    phases: {
      scoping: { instructions: "Break the research question into 3-5 specific sub-queries. List them clearly. Do NOT search yet. The campaign executor tracks scope in the recitation block.", max_iterations: 3, on: { QUERIES_READY: "searching", FAIL: "failed" } },
      searching: { instructions: "Execute each sub-query via web search. Collect URLs and snippets into filesystem memory for persistence across phases. Do NOT synthesize yet — just gather raw results.", max_iterations: 15, on: { SOURCES_COLLECTED: "extracting", FAIL: "failed" } },
      extracting: { instructions: "Fetch the top 5-10 most relevant URLs. Extract key facts, quotes, and data points. Record source URL for each fact. Store extracted data in filesystem memory for the synthesizing phase.", max_iterations: 12, on: { EXTRACTED: "synthesizing", FAIL: "failed" } },
      synthesizing: { instructions: "Synthesize all extracted data into a structured answer. Use tables where appropriate. Cite sources inline. Flag gaps or conflicting information. Write the final output. The campaign executor's verification gate will audit citations.", max_iterations: 5, on: { DONE: "verifying", FAIL: "failed" } },
      verifying: { instructions: "Review the synthesis for accuracy. Verify that every claim has a cited source. Check for hallucinated facts. If gaps found, note them explicitly. The verification gate blocks completion until all claims are sourced.", max_iterations: 3, on: { VERIFIED: "review", GAPS_FOUND: "searching", FAIL: "failed" } },
      review: { instructions: "Auto-crítica del output de research: ¿citas verificables? ¿sin afirmaciones sin fuente? ¿contradicciones resueltas? ¿formato estructurado? codegraph_codegraph_explore no aplica para research.", max_iterations: 2, on: { REVIEW_PASS: "accept", ISSUES_FOUND: "synthesizing", FAIL: "failed" } },
      accept: { instructions: "RATCHETED DOD v1. Leer dod_version del workflow. V1: todas las afirmaciones citadas ✅, sin alucinaciones ✅, formato estructurado ✅, gaps documentados ✅, fuentes verificables ✅. V2+: +ponytail-review, +no secrets. V3+: +citas con URL verificada. Si todas ✅ → ACCEPTED.", max_iterations: 2, on: { ACCEPTED: "close", REJECTED: "synthesizing", FAIL: "failed" } },
      close: { instructions: "Guardar output final en docs/Investigaciones/. skill progreso (Trigger 1). Context Save Point.", max_iterations: 2, on: { CLOSED: "completed", FAIL: "failed" } },
    },
  },
  "nine-second-saloon": {
    id: "Ego-nine-second-saloon",
    initial: "diagnose",
    dod_version: 1,
    legacyFile: "workflows/nine-second-saloon.json",
    phases: {
      diagnose: { instructions: "Read the task description. Use the campaign executor to check service status and read logs. Identify the root cause. Do NOT modify anything — destructive tools are structurally blocked at this phase. The platform API is available for read-only actions.", max_iterations: 8, safe_next: "investigate", on: { DIAGNOSED: "investigate", FAIL: "failed" } },
      investigate: { instructions: "Investigate the root cause further. Check environment variables, test connections. Still read-only — do NOT modify anything. The campaign executor recitation block preserves investigation state across iterations.", max_iterations: 6, on: { ROOT_CAUSE_FOUND: "propose_fix", FAIL: "failed" } },
      propose_fix: { instructions: "Propose the fix. Describe exactly what you will change and why. Do NOT execute the fix yet. Write your proposal as text output. The approval gate will require human sign-off before execution.", max_iterations: 3, on: { FIX_PROPOSED: "approve_fix", FAIL: "failed" } },
      approve_fix: { instructions: "RATCHETED DOD v1: auto-verificar seguro/específico/reversible/sin-efectos-colaterales. Si cumple → APPROVED. Si no → REJECTED.", max_iterations: 2, on: { APPROVED: "execute_fix", REJECTED: "propose_fix", FAIL: "failed" } },
      execute_fix: { instructions: "Execute the approved fix. Do NOT use destructive commands. The verification gate will confirm the fix works before completing.", max_iterations: 4, on: { FIX_APPLIED: "verify", FAIL: "failed" } },
      verify: { instructions: "Verify the fix worked. Test the connection, check service status, review logs. The campaign executor's verification gate blocks completion until the fix is confirmed working.", max_iterations: 4, on: { VERIFIED: "review", VERIFICATION_FAILED: "propose_fix", FAIL: "failed" } },
      review: { instructions: "Evaluator-optimizer: auto-crítica del fix. ¿Correctitud? ¿Simplicidad? ¿Consistencia? ¿efectos secundarios? Máximo 2 iteraciones.", max_iterations: 2, on: { REVIEW_PASS: "accept", ISSUES_FOUND: "execute_fix", FAIL: "failed" } },
      accept: { instructions: "RATCHETED DOD v1. V1: contrato ✅, output validado ✅, blast radius verificado ✅, deuda técnica identificada ✅, documentación actualizada ✅. V2+: +ponytail-review, +no secrets. V3+: +no secrets, +conventional-commit validado. Leer dod_version del workflow. Si todas ✅ → ACCEPTED.", max_iterations: 2, on: { ACCEPTED: "close", REJECTED: "execute_fix", FAIL: "failed" } },
      close: { instructions: "git add -p + git commit con Conventional Commits. skill progreso (Trigger 1). Context Save Point.", max_iterations: 2, on: { CLOSED: "completed", FAIL: "failed" } },
    },
  },
}

export const WORKFLOW_NAMES = Object.keys(TYPE_PROFILES)

// ---------- 4. Límites + DoD + Gates (absorbidos, espejos con fuente) ----------
// Espejo de campaign-server.mjs BUDGET_LIMITS (216-222). El server sigue siendo
// el enforcer; si este espejo diverge, manda el server y parity-check falla.
export const BUDGET_LIMITS = {
  maxIterations: 10,
  maxToolCalls: 40,
  maxSubAgents: 40,
  maxConsecutiveFails: 5,
  maxDurationMinutes: 120,
}

export const DOD = {
  task: "Contrato verificable del task file se cumple + capa determinista (fmt/clippy/nextest según stack) + tests del cambio pasan",
  commit: "Commit atómico (~100 líneas), conventional commit, git diff limpio, verificación mecánica (nunca auto-reporte)",
  release: "dev-tools/verify.ps1 completo (6 pasos), changelog, semver respetado, pre-push gate (Regla 1)",
  ratchet: "accept lee dod_version del perfil: V1 (contrato/output/blast-radius/deuda/docs) → V2 (+ponytail-review sin findings, +test-coverage) → V3 (+no secrets, +conventional-commit validado)",
}

export const GATES = {
  D: { when: "tras zero-code planning, ANTES de escribir el task file", triggers: ["blast radius >10 archivos / hot path / API pública", "plan agrega símbolos públicos nuevos (pub fn/tool/endpoint/binding)", "contrato ambiguo", "feature-add sin spec"], action: "question al usuario (GO/ajustar/dividir); sin respuesta → STOP" },
  V: { when: "2 fallas verify MISMO error (archivo+línea+mensaje)", triggers: ["umbral único MoM/stagnation/SARL"], action: "question obligatoria (reintentar fresh / cambiar estrategia / FAILED); sin respuesta → STOP" },
  C: { when: "durante el cierre, antes del commit", triggers: ["errores colaterales", "git status fuera de blast radius", "cierre de campaña"], action: "auto+log (colaterales <30min inline, resto FIND-*); pregunta solo en seguridad/cierre campaña" },
  P: { when: "durante triage del backlog (plan.md)", triggers: ["prioridad roja", "contrato ambiguo", "símbolos públicos nuevos", "feature-add sin spec"], action: "contexto — no lo evalúa el loop de ejecución" },
}

// ---------- 5. Flag v2 + perfil unificado (aditivo, no rompe legacy) ----------
export function isUnifiedEnabled(opts = {}) {
  if (opts && typeof opts.unified === "boolean") return opts.unified
  const env = typeof process !== "undefined" ? process.env?.C0_V2 : undefined
  return env === "1" || env === "true"
}

// Perfil unificado: C0 genérico (enforcement) + guía de fases del tipo.
// Lo que devuelven campaign_get_workflow / campaign_classify_workflow cuando
// el flag v2 está activo. Con flag apagado el server devuelve el legacy exacto.
export function getUnifiedProfile(workflowName) {
  const profile = TYPE_PROFILES[workflowName]
  if (!profile) return null
  return {
    workflow: workflowName,
    canonical: C0_CANONICAL,
    spec: C0_SPEC,
    version: C0_VERSION,
    initial: profile.initial,
    states: Object.keys(profile.phases),
    phases: profile.phases,
    phaseToolsGuide: true,
    enforcement: "C0 genérica (STATE_TOOLS) — los allowed_tools de fase son guía, NO enforcement",
    c0States: C0_STATES,
    transitions: C0_TRANSITIONS,
    guards: C0_GUARDS,
    dod: DOD,
    gates: { D: GATES.D, V: GATES.V, C: GATES.C },
    budget: BUDGET_LIMITS,
    legacyFile: profile.legacyFile,
    deprecated: `legacy ${profile.legacyFile} — ver ${C0_CANONICAL}`,
  }
}

export function resolveWorkflowProfile(workflowName, opts = {}) {
  if (!isUnifiedEnabled(opts)) return null
  return getUnifiedProfile(workflowName)
}
