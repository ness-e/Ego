// review-gate.test.mjs — HARD-07: review gate mecanizado (REVIEW→ACCEPT).
// Contrato: `completed` exige `reviewer_context ≠ author_context` (mode fresh) o
// waiver owner-registrado (mode degraded); la simulación del caso degradado NO
// permite ACCEPT. Casos: T1 fresh OK · T2 degraded sin waiver BLOQUEADO ·
// T3 degraded con waiver OK + registro (decisions + trace) · T4 over-block guard
// (recitation estilo histórico API-09 con review fresco → OK; in-progress intacto).
// Node v24 built-in test runner — cero dependencias nuevas (convención mcp/).
import { test, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { validateReviewAccept, REVIEW_ACCEPT_RULES } from "../config/state-tools.mjs"
import { validateReviewAccept as unifiedValidateReviewAccept } from "../C0-unified.mjs"
import { updateTaskStateCore, recordReviewWaiver } from "./campaign-server.mjs"

const PLAN = `# Plan: HARD-07 Review Gate Fixture

> **Inicio:** 2026-09-27
> **Campaign ID:** 7c0ffee0-1234-5678-9abc-def012345678

## Tasks

### Task 1: Sample task
- **Prioridad:** 🟢
- **Estado:** ⬜ PENDING
- **Archivos clave:** src/foo.rs
- **Contrato:** verify
- **Fuente:** test
`

let worktree
let planPath

beforeEach(() => {
  worktree = mkdtempSync(join(tmpdir(), "hard07-review-"))
  const planDir = join(worktree, "docs", "dev", "plans")
  mkdirSync(planDir, { recursive: true })
  planPath = join(planDir, "plan.md")
  writeFileSync(planPath, PLAN, "utf-8")
})

afterEach(() => {
  if (worktree) { try { rmSync(worktree, { recursive: true, force: true }) } catch {} }
})

const FRESH = {
  mode: "fresh",
  reviewer: "ego-review",
  reviewer_context: "ses_reviewer_fresh",
  author_context: "ses_author_impl",
  verdict: "approve",
}
const DEGRADED_WAIVED = {
  mode: "degraded",
  verdict: "approve",
  waiver: { owner: "Eros", ref: "decisión owner 2026-09-27" },
}

// ---------- T1: fresh OK ----------

test("T1: review fresh (reviewer_context ≠ author_context, approve) → ACCEPT OK", () => {
  // El canónico v2 re-exporta el MISMO runtime (cero divergencia por construcción).
  assert.strictEqual(unifiedValidateReviewAccept, validateReviewAccept)
  assert.strictEqual(REVIEW_ACCEPT_RULES.requiredVerdict, "approve")

  const v = validateReviewAccept(FRESH)
  assert.strictEqual(v.allowed, true)
  assert.strictEqual(v.mode, "fresh")

  const res = updateTaskStateCore(planPath, "1", "completed", { review: FRESH }, worktree)
  assert.strictEqual(res.updated, true)
  assert.strictEqual(res.review.mode, "fresh")
  assert.ok(readFileSync(planPath, "utf-8").includes("✅ COMPLETED"))
})

// ---------- T2: degraded sin waiver → BLOQUEADO ----------

test("T2: review degradado sin waiver → ACCEPT BLOQUEADO, sin write", () => {
  // Caso incidente API-09: ronda degradada (mismo contexto) — NO debe permitir ACCEPT.
  const v = validateReviewAccept({ mode: "degraded", verdict: "approve" })
  assert.strictEqual(v.allowed, false)
  assert.ok(v.reason.includes("waiver"))

  // Degradación disfrazada de fresh (reviewer_context === author_context) también bloquea.
  const vSame = validateReviewAccept({ ...FRESH, reviewer_context: FRESH.author_context })
  assert.strictEqual(vSame.allowed, false)

  const res = updateTaskStateCore(planPath, "1", "completed", { review: { mode: "degraded", verdict: "approve" } }, worktree)
  assert.strictEqual(res.updated, false)
  assert.strictEqual(res.reviewBlocked, true)
  assert.ok(res.error.includes("waiver"))
  // El plan queda intacto (no write, ni estado ni recitation).
  assert.ok(readFileSync(planPath, "utf-8").includes("⬜ PENDING"))

  // Sin payload en absoluto → también bloqueado (fail-fast accionable).
  const noPayload = updateTaskStateCore(planPath, "1", "completed", null, worktree)
  assert.strictEqual(noPayload.updated, false)
  assert.strictEqual(noPayload.reviewBlocked, true)
})

// ---------- T3: degraded con waiver → OK + registro ----------

test("T3: review degradado con waiver {owner, ref} → OK + registro en decisions/trace", () => {
  const v = validateReviewAccept(DEGRADED_WAIVED)
  assert.strictEqual(v.allowed, true)
  assert.deepStrictEqual(v.waiver, { owner: "Eros", ref: "decisión owner 2026-09-27" })

  const res = updateTaskStateCore(planPath, "1", "completed", { review: DEGRADED_WAIVED }, worktree)
  assert.strictEqual(res.updated, true)
  assert.deepStrictEqual(res.review.waiver, { owner: "Eros", ref: "decisión owner 2026-09-27" })

  // Registro durable (hermético: memoryDir inyectado al tmp del test).
  const memDir = join(worktree, "memory")
  const rec = recordReviewWaiver(res.campaignId, "1", res.review.waiver, worktree, memDir)
  assert.strictEqual(rec.recorded, true)
  const decisions = readFileSync(join(memDir, "decisions.md"), "utf-8")
  assert.ok(decisions.includes("owner=Eros"))
  assert.ok(decisions.includes("decisión owner 2026-09-27"))

  // Trace event review.waiver emitido en el worktree del campaign.
  const traceFile = join(worktree, "traces", `${res.campaignId}.jsonl`)
  assert.ok(existsSync(traceFile))
  assert.ok(readFileSync(traceFile, "utf-8").includes("review.waiver"))
})

// ---------- T4: over-block guard (tarea histórica válida) ----------

test("T4: over-block guard — recitation histórica (estilo API-09) con review fresco → ACCEPT OK", () => {
  const historical = {
    activeGoal: "API-09 — cerrar campaña",
    status: "completed",
    lastAction: "Steps 1-8 ✅, contrato 6/6 verificado mecánicamente",
    result: "OK",
    nextAction: "ninguna",
    contract: "smoke 11/11 + verify ALL PASS",
    nextTask: "ninguno",
    review: FRESH,
  }
  // verdict changes-required nunca permite ACCEPT (borde del gate)…
  assert.strictEqual(validateReviewAccept({ ...FRESH, verdict: "changes-required" }).allowed, false)
  // …y la tarea válida con payload histórico completo NO se bloquea de más.
  const res = updateTaskStateCore(planPath, "1", "completed", historical, worktree)
  assert.strictEqual(res.updated, true)

  // El gate aplica SOLO a completed: in-progress sigue funcionando sin review.
  const r2 = updateTaskStateCore(planPath, "1", "in-progress", null, worktree)
  assert.strictEqual(r2.updated, true)
})

// ---------- T5: regresión — guard de existencia con el primitivo canónico ----------

test("T5: id numérico sobre plan con header canónico (`### Task 7: CODE`) → write completo (recitation no perdida)", () => {
  // Regresión F1 (reviewers HARD-07): el guard del write fantasma usaba
  // parseTasks(id canónico = código) para el check de existencia, mientras
  // updateState resuelve con findTaskById (acepta número O código). Con id
  // numérico sobre un header con código, el estado se escribía y la recitation
  // se descartaba en silencio. El guard ahora usa findTaskById (mismo primitivo).
  const CODED_PLAN = `# Plan: coded fixture

> **Inicio:** 2026-09-27
> **Campaign ID:** c0ded000-1111-2222-3333-444455556666

## Tasks

### Task 7: HARD-99 — Coded task
- **Estado:** ⬜ PENDING
`
  writeFileSync(planPath, CODED_PLAN, "utf-8")
  const res = updateTaskStateCore(planPath, "7", "completed", { taskId: "7", lastAction: "cierre", review: FRESH }, worktree)
  assert.strictEqual(res.updated, true)
  const after = readFileSync(planPath, "utf-8")
  assert.ok(after.includes("✅ COMPLETED")) // estado escrito
  assert.ok(after.includes("=== RECITATION 7 ===")) // recitation NO perdida (regresión F1)
})
