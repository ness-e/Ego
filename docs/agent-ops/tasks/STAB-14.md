# STAB-14 — Adaptaciones repos-referencia aptas

> **Plan:** `docs/agent-ops/plans/2026-10-16-plan-estabilizacion-ego.md` (Task 15)
> **Estado:** ⏳ IN PROGRESS
> **Appetite:** max 3d (si excede → partir 14a/14b)
> **Gate P usuario:** completo con ADRs (vinculante)
> **SDP:** security-and-hardening + test-driven-development (base auto). Keywords contrato: SSRF, sandbox, approval-identity, admit-timeout, worker-backoff, filelock-wx, chunk-dedup, fingerprint-CAS.

## DISCOVERY — Compuertas Opción B por patrón

Verificación código-real 2026-10-15/16 (grep + read, no asumido):

| # | Patrón | Fuente referencia | Estado destino | Veredicto |
|---|--------|-------------------|----------------|-----------|
| 1 | ApprovalIdentity (runId/taskId/subEgoId/toolId/inputDigest) | coucou HookServer / openclaw admitted-run-context | ❌ no existe en `packages/events` | **ADAPTAR** (nuevo `packages/events/src/ApprovalIdentity.ts` + test decisión cruzada rechazada) |
| 2 | InteractionTransport submit/resolve/cancel + admit() timeout corto | coucou island/fsm + bridge.ts | ❌ no existe | **ADAPTAR** (nuevo `packages/events/src/InteractionTransport.ts` + test fallback sin bloqueo) |
| 3 | AttentionStateMachine dormant/compact/active/interaction | coucou island/fsm.ts | ✅ existe en `packages/runtime/src/AttentionStateMachine.ts` (variante isla hidden/compact/expanded/alert/hitl_approval + ISLA_TIMING) | **ASIMILAR** (no duplicar en dailystate; se extiende solo si falta) |
| 4 | SafeConfigMutation preview/confirm/apply/rollback + fingerprint CAS | coucou / integrations McpClient COUC-10 | ✅ existe en `packages/execution/src/SafeConfigMutation.ts` (fingerprintOriginal/New + confirm + anti-race) | **ASIMILAR** (verificado por tests existentes) |
| 5 | ChangeSetService artifactId/hunks/payloadRef + ActivityItem.payloadRef | coucou COUC-07 | ⚠️ existe `packages/tools/src/native/git/ChangeSetService.ts` SIN payloadRef/artifactId | **ADAPTAR-delta** (campos opcionales aditivos + helper, sin rewrite) |
| 6 | net-policy SSRF (localhost/169.254/RFC1918 bloqueados) | openclaw net-policy | ✅ existe `packages/tools/src/native/security/NetPolicy.ts` (bloquea loopback/RFC1918/link-local/metadata) | **ASIMILAR + re-export** frontera en `packages/security/src/netPolicy.ts` (contrato pide path security; standalone sin dep para evitar ciclo tools→security) |
| 7 | WorkerPolicy priority/budget/backoff/health | helmor / openclaw pool | ⚠️ existe `LocalTaskPool` cooperativo (sin priority/budget/backoff/health) | **ADAPTAR** (nuevo `packages/tasks/src/WorkerPolicy.ts` policy pura sobre el pool, sin worker_threads) |
| 8 | AdaptiveChunker 256+overlap+heading_path+SHA dedup → kb/docs | khoj text_to_entries (solo algoritmos) | ✅ existe `packages/knowledge/src/ingest/AdaptiveChunker.ts` (256/32 + headingPath + SHA-256 + dedup) | **ASIMILAR** (tests existentes) |
| 9 | FileLockManager wx+backoff+PID | career-ops pipeline-lock.mjs (solo ingeniería) | ✅ existe `packages/tools/src/native/fs/FileLockManager.ts` (wx + backoff×1.5 + PID + stale) | **ASIMILAR** (tests existentes) |

**Descartes justificados (🚫 Descartada, backlog-format §3):**
- 🚫 Python/SQLite/FastAPI/pgvector/embeddings Python (khoj runtime, deepseek storage) — guardrail AGENTS §4; solo algoritmos reimplementados en TS.
- 🚫 ATS/empleos/CVs/schemas negocio career-ops — contaminación dominio ajeno (AGENTS §4).
- 🚫 Scrapers/telecom/voz (khoj scrapers, modelos voz externos) — fuera alcance SOC.
- 🚫 Tauri/Bun/notch/SwiftUI/HookServer.swift runtime — desktop es Electron; solo FSM/lógica portable.
- 🚫 Sockets WS internos coucou bridge — Ego usa EventBus + IPC tipado, no WS internos.

## Gate D — ronda batcheada (spec-first, 1 ronda, pre-ACT)

Sin tool interactivo en contexto subagente → decisiones evidencia-basadas registradas; orquestador/usuario confirma en review. Recomendado primero en cada una:
1. **Ubicación ApprovalIdentity/InteractionTransport:** (Recomendado) `packages/events` junto a EventNormalizer/hooks STAB-12 ✅ evidencia: approval.required/resolved ya viven en events/types. Alternativa: packages/security — rechazada (identidad de correlación, no secreto).
2. **Estados Attention:** (Recomendado) mantener variante isla existente, NO crear segunda FSM en dailystate ✅ evidencia: runtime ya VERIFIED + tests isla. Alternativa: duplicar dormant/active — rechazada (doble fuente verdad).
3. **WorkerPolicy vs threads reales:** (Recomendado) policy pura sobre LocalTaskPool cooperativo ✅ evidencia: handlers son clausuras no transferibles (F4T8 H11). Alternativa: worker_threads — rechazada (rompe API, fuera appetite).
4. **net-policy en security:** (Recomendado) standalone sin dep tools ✅ evidencia: evita ciclo dependencias; tests pinean mismos vectores. Alternativa: dep workspace tools — rechazada (ciclo potencial).

## Spec (SDD) — superficie pública nueva

| Símbolo | Firma | Error paths | Decisión |
|---|---|---|---|
| `buildApprovalIdentity({runId,taskId,subEgoId,toolId,input})` | → `ApprovalIdentity` con `inputDigest: sha256(canonicalJson(input))` | input `undefined` → digest de `"null"` determinista; nunca throw | Gate D-1 |
| `assertSameApproval(expected, actual)` | throw `ApprovalIdentityMismatchError` si difiere runId/taskId/subEgoId/toolId/inputDigest | mensaje cita campo divergente; decisión cruzada rechazada | contrato test |
| `InteractionTransport.submit/resolve/cancel/admit` | `admit(id, timeoutMs): Promise<boolean>` nunca rechaza; `false` en timeout/cancel/unknown | submit duplicado → reemplaza; resolve unknown → `false`; admit post-resolve → `true` inmediato | contrato fallback sin bloqueo |
| `WorkerPolicy.shouldAdmit/sortByPriority/nextDelay/recordSuccess/recordFailure/isHealthy` | backoff `min(base*2^attempt, cap)`; health degradado tras `maxConsecutiveFailures`, recupera con 1 éxito | budget lleno → `shouldAdmit false` (no throw); delays deterministas | Gate D-3 |
| `ChangeSet{artifactId?,payloadRef?}` + `withPayloadRef/ buildPayloadRef` | aditivos opcionales; `buildPayloadRef = sha256 hex corto` | sin artifact → payloadRef `undefined`, nunca throw | delta sin rewrite |
| `isBlockedSSRFHost/validateSSRFUrl` (security) | `{safe, reason?}`; bloquea localhost/127/0/10/172.16-31/192.168/169.254/100.64-127/224+/::1/fe80/fc/fd + metadata hosts | URL malformada → unsafe; `allowLocalhost` opt-in explícito | Gate D-4, skill security-and-hardening |

## Impacto mapeado (Regla 0)

- **Leídos completos:** `packages/events/src/{index,types,EventNormalizer}.ts`, `packages/runtime/src/AttentionStateMachine.ts`, `packages/execution/src/SafeConfigMutation.ts` (parcial grep), `packages/tools/src/native/{git/ChangeSetService,security/NetPolicy,fs/FileLockManager}.ts`, `packages/knowledge/src/ingest/AdaptiveChunker.ts`, `packages/tasks/src/{WorkerTaskPool,index}.ts`, `packages/{events,tasks,security}/package.json`, `packages/security/src/index.ts`.
- **Referencias hacia dentro (nuevos):** solo `node:crypto` (sha256) + tipos locales; `WorkerPolicy` no importa pool (policy pura); `netPolicy` security sin deps nuevas.
- **Referencias entrantes:** ninguna (símbolos nuevos; ChangeSet campos opcionales no rompen callers; barrels aditivos).
- **Veredicto:** impacto BAJO, aditivo, sin blast radius transitivo. No toca STAB-11/12/13/15/16 ni VantaDB/renderer. `pnpm --filter` por paquete + typecheck workspace.

## Steps

- [x] S1 DISCOVERY + Spec + Regla 0 (este file)
- [x] S2 ApprovalIdentity + test (events — 5/5, suite 38/38)
- [x] S3 InteractionTransport + admit + test (events — 5/5, suite 38/38)
- [x] S4 WorkerPolicy + test (tasks — 4/4, suite 63/63)
- [x] S5 ChangeSet payloadRef delta + test (tools — 4/4, suite 64/64)
- [x] S6 security netPolicy + test (security — 6/6, suite 95/95)
- [x] S7 ADRs 0006–0011 + verify re-verificado asimilados (runtime 73, execution 42, knowledge 67) + commit local

## VERIFY_CONTRATO

- `pnpm --filter @ego/events test` ✅ 38/38 (ApprovalIdentity 5 + InteractionTransport 5 nuevos)
- `pnpm --filter @ego/tasks test` ✅ 63/63 (WorkerPolicy 4 nuevo)
- `pnpm --filter @ego/security test` ✅ 95/95 (netPolicy 6 nuevo)
- `pnpm --filter @ego/tools test` ✅ 64/64 (ChangeSetPayloadRef 4 nuevo)
- `pnpm --filter @ego/runtime test` ✅ 73/73 (AttentionStateMachine asimilado)
- `pnpm --filter @ego/execution test` ✅ 42/42 (SafeConfigMutation asimilado)
- `pnpm --filter @ego/knowledge test` ✅ 67/67 (AdaptiveChunker asimilado)
- `pnpm --filter @ego/events typecheck` ✅ 0 errores (archivos nuevos limpios)
- typecheck tasks/security/tools: SOLO errores preexistentes `noUncheckedIndexedAccess`
  en archivos NO tocados (ProactivityEngine, TaskCheckpoint, ToolPermissions,
  ChangeSetService-funcs previas, GitParser, NetPolicy-tools) → FIND follow-up
  (ADR-0011). Ningún error en archivos nuevos STAB-14.
- SECURITY phase (skill security-and-hardening): SSRF allowlist+deny, credenciales
  embebidas bloqueadas, `admit` sin bloqueo, ApprovalIdentity fail-closed,
  sin secretos en código, sin `eval`/innerHTML, sin deps nuevas ✅
- PERFORMANCE phase: N/A (ningún hot path: sin vectores/HNSW/search loops;
  `nextDelay` O(1), `sortByPriority` O(n log n) sobre colas acotadas por budget)
