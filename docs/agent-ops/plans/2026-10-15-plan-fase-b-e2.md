# Plan Fase B + E2 — Conexiones y automatización GUI (2026-10-15)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> Handoff vigente: `docs/agent-ops/plans/2026-10-14-handoff-ejecucion-paralela.md` (waves max 2, SARL, RESULTADO, prohibiciones: nunca push, no pnpm install/tocar .bin).

**Goal:** Cerrar resume real, costos visibles, firma MCP, pool multi-key, suite GUI E2 y limpieza worktree.

**Architecture:** Main dueño de secretos y catálogos; renderer solo presentación vía IPC tipado; VantaDB único store de sesiones; tests TDD por task.

**Tech Stack:** Electron 33 + React 19 + Vite + Tailwind v4 + Vitest + Playwright + NativeVantaDB + AI SDK v7

**Estado fuente:** T00–T17 completadas (commits `461c8d3`..`217c76c` + fixes); `pnpm build` + `pnpm test` verdes; T13 dejó `ipc.sessions.*`, `ipc.tasks.*`, `ipc.terminal.*`, `daily.listApprovals`, `settings.getStorageInfo/getGovPolicies`, probe-before-save.

---

### Task 18: T16-RESUME — resume real de sesión desde VantaDB

**Files:**
- Read: `apps/desktop/src/main.ts` (handlers `ipc.sessions.*` de T13), `packages/memory/EgoMemoryAdapter.ts` (namespaces `session/*`), `renderer/components/SessionPicker.tsx`, `renderer/components/ego-chat.tsx`
- Modify: `renderer/src/App.tsx` o `ego-chat.tsx` (al reanudar: cargar turnos de `sessions.get` e hidratar `messages`), `main.ts` SOLO si falta exponer historial (nuevo sub-canal `sessions.getTurns` con schema Zod)
- Test: `apps/desktop/test/sessions-resume.test.ts` (nuevo) + e2e: turno → reinicio → reanudar intacto

**Step 1:** failing test (resume devuelve turnos persistidos).
**Step 2:** run → FAIL. **Step 3:** implementar hidratación (sin inventar turnos: vacío honesto si no hay). **Step 4:** suites desktop+renderer verdes. **Step 5:** commit local `feat: real session resume from VantaDB`.

### Task 19: T16-COSTS — visor tokens/USD por turno (HERM-21)

**Files:**
- Modify: `renderer/components/daily-state/MetricsConsole.tsx` (reconciliar: tabla por turno con `usage` real de `llmStream`), `renderer/components/ego-chat.tsx` (SOLO mostrar coste del turno actual si `usage` viene; no tocar streaming)
- Test: `renderer/test/MetricsConsole.test.tsx` (nuevo: render con usage real + vacío honesto sin datos)

**Step 1:** failing test. **Step 2:** FAIL. **Step 3:** cablear `usage.{promptTokens,completionTokens,estimatedCostUsd}` a la consola + badge por turno. **Step 4:** suites verdes. **Step 5:** commit local `feat: per-turn token cost console`.

### Task 20: T16-R10 — verificación de firma MCP real

**Files:**
- Modify: `packages/integrations/src/mcp/McpClient.ts:106-111` (contrato de firma: formato clave pública en config, `verifySignature` fail-closed; `isSignedServer` pasa a verificación real, interino documentado se retira), `packages/integrations/src/mcp/*.ts` según blast radius
- Test: `packages/integrations/test/mcp-signature.test.ts` (firma válida/inválida/ausente)

**Step 1:** failing test. **Step 2:** FAIL. **Step 3:** implementar verificación (sin red; HMAC o Ed25519 según lo que soporte el formato que definas — documentar decisión en task file). **Step 4:** suites integrations+desktop verdes. **Step 5:** commit local `feat: real MCP server signature verification`.

### Task 21: T16-OAUTH — pool multi-key por proveedor

**Files:**
- Modify: `packages/security/src/CredentialManager.ts` (pool por proveedor: lista de keys, rotación ante 429/rate-limit con cooldown, fail-closed si se agotan), `packages/models/src/ModelRouter.ts` (SOLO leer pool: reintentar con siguiente key del mismo proveedor antes de fallback mock), `main.ts` (SOLO persistencia del pool en Credential Manager, nunca VantaDB)
- Test: `packages/security/test/credential-pool.test.ts` (rotación, cooldown, agotamiento)

**Step 1:** failing test. **Step 2:** FAIL. **Step 3:** implementar pool (empezar simple: N keys por proveedor, sin OAuth todavía). **Step 4:** suites verdes. **Step 5:** commit local `feat: per-provider credential pool with rotation`.

### Task 22: E2 — suite Playwright `tests/gui/` (13 ítems como specs)

**Files:**
- Create: `tests/gui/` (specs por ítem del checklist T10-Step-3: arranque, streaming, HITL, proyectos, sub-egos, canvas, MCP, daily, dominios, a11y-tab, BYOK-block, omnibar, tray; `skip` donde exija backend Electron vivo, documentado)
- Verify: `pnpm --filter @ego/e2e-tests test` o runner propio (definir en task file); ejecución contra `pnpm dev` SOLO cuando el owner lo levante

**Step 1:** specs escritos (failing por diseño donde aplique). **Step 2:** correr lo ejecutable sin Electron. **Step 3:** marcar skips honestos. **Step 4:** commit local `test: Playwright GUI suite for 13-item checklist`.

### Task 23: R12 — limpieza worktree denied

**Files:** ninguno (git). **Steps:** 1) `git worktree list` + verificar 0 trabajo valioso sin commitear dentro del worktree; 2) `git worktree remove <path>` (solo si limpio; si hay restos, reportar, NO `--force` sin aval); 3) verificar `git worktree list` limpio. Sin commit (no toca el repo).

---

## Orden de ejecución

W1: T18 + T20 (disjuntos: sesiones/chat vs MCP) · W2: T19 + T21 (costos UI vs credenciales) · W3: T22 + T23. FAIL_MODE=stop. `pnpm build` + `pnpm test` verdes entre waves. Commits locales, nunca push. State en `docs/agent-ops/state/pipeline-state.json` (T18–T23).
