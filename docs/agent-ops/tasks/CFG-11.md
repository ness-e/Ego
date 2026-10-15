# CFG-11 — Coalescing + prioridad + input-to-paint
- **Estado:** ⏳ IN PROGRESS (Steps 1-3 ✅, Step 4 verify en curso)
- **Plan:** docs/agent-ops/plans/2026-10-16-plan-configs-revision-total.md
- **Fecha:** 2026-10-16
- **Wave:** 0 (disjunta con CFG-01/CFG-10). **BLOQUEANTES verdes:** perf-streaming (rAF+virtual+memo) + abort-loop (CFG-10 `861841f`).
- **Archivos clave:** `apps/desktop/renderer/components/ego-chat.tsx` · `apps/desktop/src/main.ts` (SOLO sección nueva) · `apps/desktop/src/main/ipc-priority-queue.ts` (nuevo, puro) · `apps/desktop/test/ipc-priority-queue-cfg11.test.ts` (nuevo) · `apps/desktop/renderer/test/input-to-paint-cfg11.test.tsx` (nuevo)
- **SDP:** performance-optimization, test-driven-development, systematic-debugging, code-review-and-quality (+ base auto: campaign-executor/progreso/ponytail vía MCP no disponible en worker — aplicadas manualmente). Refs leídas: performance-checklist, testing-patterns, clean-code Apéndice V, frontend-web (R-FE), observability-checklist.

## Blast Radius
Callers renderer: Composer Send/Cancel/Esc → `onNew` → `executeTurn` → `llmStream` → `onChatDelta` → `pendingStreamRef`/flush → `setMessages` → viewport stick. Callees main: `handleLlmStream` + `turnId`/`AbortController` + `toolLoop.run` + `win.webContents.send` (16 sitios). Implicaciones: marcas no cambian UX ni firmas IPC; cola reordena solo bajo contención (fast-path directo si vacía) + coalesce solo lecturas idempotentes (`recall_status` por turno); preserva aria-live/role=status/Jump/abort/skeleton/memo. RIESGO medio (hot path streaming + main IPC).

## Impacto mapeado (Regla 0)
- Leídos completos: `ego-chat.tsx` (1203L: executeTurn 630-762, rAF buffer 488-585, viewport stick 827-850, aria-live 976-1011, abort/Esc 768-821), `main.ts` (send-sites: 270, 284, 2036, 2074, 2221, 2266, 2873, 2952, 3016, 3026, 3096), `ego.ts` L425-447/564-566 (tipos `llmStream/llmCancel/onChatDelta` — sin cambios), `ChatStreaming.test.tsx` (6 tests), `ipc-contract.test.ts` (regex `webContents.send("ch"` — el dispatcher NUEVO no usa ese literal: sin ruptura).
- Referencias hacia dentro: `performance.now` (DOM+Node), `requestAnimationFrame` (patrón existente + fallback microtask), `setImmediate` (drain main).
- Referencias entrantes: ningún caller de la cola nueva (código nuevo); marcas solo refs internas.
- Veredicto: impacto acotado; prohibidos intactos (guards navegación/CSP/fetch-proxy/folders/permissions CFG-06/schemas/ModelRouter/memoria/tools/events/subegos/docs-sitio/floating/*/ui-runtime/electron.vite.config).

## Contrato
"input-to-paint medido por frontera (tSend/tFirst/tPaint) + fairness críticas>background verificada en test + typecheck renderer 0 errores + typecheck desktop 0 errores + ChatStreaming 6/6 sin regresión + a11y 15/15 intacto."

## Spec (Gate D — decisiones por evidencia de código, sin contradicción)
| # | Decisión | Opciones | Elegida + evidencia |
|---|---|---|---|
| S1 | Dónde priorizar | main queue vs renderer | **main** (renderer ya tiene rAF batching `scheduleStreamFlush`; la inanición vive en main: `eventBus.onAny`→`ipc.event` compite con deltas en el mismo `webContents.send`) |
| S2 | Formato marcas | performance.now+eventBus vs performance.now+log | **performance.now + `console.debug[chat.first_token]`** (renderer NO toca EventBus por R-FE-1; 1 línea/turno, sin spam) |
| S3 | Expiración obsoletos | drop >5s vs coalesce vs ambos | **ambos**: coalesce por key (solo lecturas idempotentes) + TTL 5s drop (defecto `CFG11_OBSOLETE_TTL_MS`) |
| S4 | Wiring main | re-cablear todo vs fast-path | **fast-path**: cola vacía → send directo (0 cambio observable); bajo contención → prioridad+fairness. Deltas chat quedan SYNC (orden sensible); `ipc.event`→background, `chat.error`/`turn-cancelled`/`approval`→critical |
| S5 | Fairness | strict-priority vs round-robin | **strict + garantía**: critical siempre primero; background ≥1 slot cada 8 pops no-background (`CFG11_MAX_CONSECUTIVE_NON_BG=8`) → background nunca muere |

## Invariantes (no romper)
aria-live/role=status/banner Memoria/skeleton anti-shift/memo/UserMessage-AssistantMessage/Jump-to-latest/abort Cancel+Esc/BYOK/slash-local; firmas IPC y `EgoIpcPushChannels` intactos; sin secretos/PII en logs (solo canal+latencias); cola sin imports Electron (testeable sin main).

## DoD
Contrato ✅ + `npx vitest run` fairness (≥5 tests) + `input-to-paint` (puros+1 DOM) verdes + typechecks 0/0 + ChatStreaming 6/6 + a11y 15/15 + OCR sin Critical/High + review registrado + commit LOCAL (nunca push).

## Baseline (medido antes, 2026-10-16)
ChatStreaming 6/6 (30.3s) · renderer tsc 0 err · desktop tsc 0 err. Nota: corrida tsc inicial mostró errores `floating/*` transitorios por commit concurrente Wave-0 (`f129dc2`); re-corridos en verde. Ráfaga: sin cola, N background bloquean 1 crítica (FIFO ciego) — el test fairness lo fija como RED.

## Steps de ejecución
- [x] Step 1: DISCOVERY + Spec + baseline + task file
- [x] Step 2: marcas renderer (`tSend/tFirst/tPaint` + `chat.first_token`) + helpers puros + test `input-to-paint-cfg11.test.tsx` (TDD RED→GREEN 4/4)
- [x] Step 3: módulo puro `ipc-priority-queue.ts` + sección CFG-11 en `main.ts` + test fairness `ipc-priority-queue-cfg11.test.ts` (TDD RED→GREEN 9/9)
- [x] Step 4: verify contrato + OCR + review + commit LOCAL + sync plan

## Review
- Enfoque: ¿prioridad correcta (críticas>interactivas>background)? ¿marcas no spamean (1 línea/turno)? ¿coalesce solo idempotentes (nunca `terminal.output`/deltas texto)?
- Prueba: fairness test + log latencia + suites verdes.
- **Veredicto (fast tier, 2026-10-16): APPROVE.** Reglas OCR grupo 1 aplicadas a los 3 archivos: sin typos/`any`/`==`/`var`/ternarios anidados; hooks OK (solo refs, sin setState nuevo); `getMainPushQueueStats` export sin callers = hook observabilidad intencional (USE/queue-depth, sin payloads); críticos (`turn-cancelled`/`chat.error`/`approval.request`) quedan en send directo documentado; `recall_status` único con coalesceKey; relays `ipc.event` background sin coalesce (portan secuencias). Sin Critical/High; 0 Medium. Reviewer: worker CFG-11 (mismo agente, tier fast — sin paths adversarial/globs sensibles tocados: guards/CSP/fetch/permissions intactos).

## Registro de Cumplimiento / Veredicto
- **Estado:** ✅ COMPLETED
- **Evidencia:** `npx vitest run test/ChatStreaming.test.tsx test/input-to-paint-cfg11.test.tsx` (renderer) 10/10 ✅ (6 streaming sin regresión + 4 nuevos; `chat.first_token` loguea first_token<1ms / paint 7-50ms en test); `npx vitest run test/ipc-priority-queue-cfg11.test.ts` (desktop) 9/9 ✅ (crítica primera tras ráfaga 50 bg en <100ms; bg ≤8 pops bajo flood); `npx tsc --noEmit` renderer 0 err ✅; `npx tsc -p tsconfig.json --noEmit` desktop 0 err ✅; `test/a11y.test.tsx` 15/15 + snapshots 7/7 ✅; OCR (pwsh7) sin Critical/High en archivos propios ✅; review fast-tier APPROVE ✅.
- **Deuda:** (1) `test/ipc-contract.test.ts` falla PREEXISTENTE sin mis cambios (verificado vía stash: `floating:state_changed` de commit concurrente Wave-0 fuera del contrato push — área floating PROHIBIDA, no tocada); (2) typecheck renderer mostró errores `floating/*` transitorios por commit concurrente `f129dc2`, re-corridos en verde; (3) `getMainPushQueueStats` sin callers aún (hook observabilidad futuro). Sin `pnpm install`.
- **last-synced:** 2026-10-16
