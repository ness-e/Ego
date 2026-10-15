# T-isla-07-hitl — HITL completo flotante↔main (WIDG-04, COUC-03/04)

Estado: ⏳ IN PROGRESS (DISCOVERY completo → ACT)
Wave: 4 SOLO (main.ts hot, sin paralelo). Appetite 1d.
SDP: test-driven-development + source-driven-development + doubt-driven-development (base-only + SDP sin candidatos MCP; campaign-executor/progreso no disponibles en este runner → gates manuales)

## Spec (GO Gate D de la sesión — no re-preguntar)

| # | Decisión | Evidencia / Fuente |
|---|---|---|
| D1 | ACK 800ms como admisión antes de bloquear | `repos-referencia/coucou/windows/src/island/hooks.ts:300-302` ("relay's short ack window closes in 800 ms; everything below is synchronous") |
| D2 | Timeout aprobación 115s → decline seguro (110s coucou original `hooks.ts:327`, 115s Windows) | `hooks.ts:315-327` pendingTimeout 110_000; GO sesión fija 115s |
| D3 | Identidad exacta = ActionIdentity completa (sessionId+subEgoId+toolName+callId+inputDigest SHA-256 keys ordenadas), nunca solo toolName | `packages/execution/src/ApprovalEngine.ts:34-55` computeActionIdentity + `336-358` expectedDigest; mapeo contrato: runId→sessionId, invocationId→callId, toolId→toolName, taskId→approvalId/metadata (sin campos nuevos: cero asunciones) |
| D4 | Duplicado/pausado/externo → decline inmediato; cierre externo → "Handled in X" | `hooks.ts:144-150` (paused→decline), `:277-279` (externo→decline), `:286-289` (segundo request distinto→decline) |
| D5 | Fallback a main sin colgar executor = bridge.presentApproval siempre settle (true ACK / false timeout) + engine.requestApproval independiente | `ApprovalEngine.ts:224-251` timeout propio; bug hallado: path ACK nunca resuelve (cuelgue) |
| D6 | preload NO se modifica (Task3 DONE); sin canal IPC nuevo; ACK main-side = floatMgr visible&&!muted&&!disabled (admit sincrónico estilo coucou) | `apps/desktop/src/preload.ts:460-480` egoFloating ya expone approve/deny→ipc.approval.resolve; `floating.tsx:60-61` Task6 ya conecta approve/deny |
| D7 | main.ts hunk mínimo: onApprovalRequested = send main inmediato (existente) + present flotante (mejora) + updateState hitl_approval + refreshTrayStatus; schema +expectedDigest opcional (back-compat, fail-closed) | `main.ts:3090-3093`, `:3434-3449`, `FloatingWindow.ts:115-118` hitl→click-through false |

GATES_EVALUADOS (DISCOVERY): P:no (scope = task detail, sin colaterales) D:disparado (GO sesión, tabla arriba) V:no C:no.

## Impacto mapeado (Regla 0)

Leídos completos: `packages/execution/src/WidgetHitlBridge.ts` (130L), `packages/execution/test/WidgetHitlBridge.test.ts` (116L), `packages/execution/src/ApprovalEngine.ts` (438L: computeActionIdentity, requestApproval timeout, resolveApproval expectedDigest, clearAll), `packages/execution/src/types.ts` (ActionIdentity/ApprovalDecision/PendingApproval), `apps/desktop/src/windows/FloatingWindow.ts` (142L: toTrayStatus, shouldAutoShow, FloatingWindowManager.updateState hitl→click-through false), `apps/desktop/src/preload.ts` (solo grep: egoFloating approve/deny→ipc.approval.resolve, setMuted), `apps/desktop/renderer/floating/views.tsx:300-347` (buildApproval idempotente), `repos-referencia/coucou/windows/src/island/hooks.ts:143-335` (PermissionRequest flujo completo), `.agents/rules/electron-ipc.md` (9L), `main.ts` parcial: `:26` imports, `:259-265` floatMgr, `:471` refreshTrayStatus, `:495-527` snapshot/sync, `:2990-3016` task approval wiring, `:3085-3093` engine+onApprovalRequested, `:3434-3449` ipc.approval.resolve, schema.ts `:102-109` ResolveApprovalSchema.
Refs in (callers): ApprovalEngine.requestApproval (executor), main.ts onApprovalRequested (a cablear), floating renderer egoFloating.approve/deny→ipc.approval.resolve. Refs out (callees): ApprovalEngine.computeActionIdentity/resolveApproval/getPendingApproval, floatMgr.updateState/show/getState, win.webContents.send ipc.approval.request.
Veredicto: blast radius = packages/execution (bridge+test) + hunk mínimo main.ts (imports+onApprovalRequested+handler pass-through) + schema campo opcional. Sin tocar renderer/floating/*, packages/runtime/*, Task9/10 files. Riesgo bajo; main.ts hot → hunks mínimos, sin reformat.

## Steps

- [x] S0 DISCOVERY (Regla 0 + Spec) — este archivo
- [x] S1 RED: 5 casos nuevos → 4 FAIL + 1 reforzado (promise ACK colgaba 'HUNG', sin duplicate-guard, sin identity-check, sin dismissExternal)
- [x] S2 GREEN: WidgetHitlBridge reescrito (ACK settle true/false, duplicate-decline, resolve identidad-exacta + decline-sin-pendiente, dismissExternal) → 9/9 + suite execution 47/47
- [x] S3 main.ts wiring mínimo (import + hitlBridge lazy + onApprovalRequested present + hitl_approval + tray; schema expectedDigest opcional + handler pass-through) → tsc 0 ambos packages
- [x] S4 VERIFY + Review fast + DoD 7 → RESULTADO §7 (NO commit por orquestador selectivo, NUNCA push)

## Save Point

COMPLETO 2026-10-15: bridge `packages/execution/src/WidgetHitlBridge.ts`, test +5 casos, `main.ts` hunks mínimos, `schema.ts` +expectedDigest opcional. Colateral preexistente NO tocado: FloatingWindow.test.ts x6 rojo (mocks webContents, archivos fuera del diff). verify-audit.jsonl modificado por hooks ajenos (no tocar). Review fast: approve degradado (single-reviewer, sin subagentes en este runner; cross-model skipped no-interactivo).
