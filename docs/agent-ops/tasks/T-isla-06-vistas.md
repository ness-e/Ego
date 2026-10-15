# T-isla-06-vistas — Vistas flotante (overview/pill/approval/question/ticker/countdown)

- Plan: `docs/agent-ops/plans/2026-10-15-isla-flotante-ego-completa.md` (Task 6, Wave 3 paralelo con Task4-autoshow — DISJUNTOS)
- Estado: ✅ COMPLETED (código + verify; commit pendiente del orquestador)
- SDP: test-driven-development, source-driven-development (+ base auto: campaign-executor, progreso)
- Comandos: `pnpm --filter @ego/renderer exec vitest run test/floating-views.test.tsx` · `pnpm --filter @ego/renderer typecheck`
- NO commit (orquestador commitea `feat: vistas flotante approval/question/ticker`). NUNCA push.

## Contrato

Crear en `apps/desktop/renderer/floating/`: `views.tsx` (ViewHost{el/sync/tick/focus},
buildOverview/buildPill/buildApproval/buildQuestion/buildError/buildFinished/buildConfused/buildNote,
header tabs overview/prompt/upload+settings/sound, CompactMiniGrid 2x2, pillBadge solo si focusId!=id,
approval botones construidos 1 vez + idempotente), `ticker.ts` (sync encola steps MAX_QUEUE 4,
tick ROW_H 22 DURATION 380 cubic(.4,0,.2,1) sin CSS transitions, place current→completed),
`countdown.tsx` (CountdownBar autoClose 15s, window=min(10,autoClose*0.6), bar 160px).
Test: `apps/desktop/renderer/test/floating-views.test.tsx`.
Acceptance: tests PASS + tsc renderer 0 en mis archivos.

## Spec (decisiones por evidencia — Gate D: no disparado)

| # | Decisión | Evidencia (no asunción) |
|---|----------|-------------------------|
| 1 | Mecanismo ViewHost/ticker sí, copy visual coucou NO (clases `ego-*`, marcadores texto `›/✓`, sin iconos coucou, sin Mochi/minibots) | `docs/extractions/coucou.md:9,36` + plan D1 |
| 2 | Ticker ROW_H 22 / DURATION 380 / MAX_QUEUE 4 / ease cubic(.4,0,.2,1), JS-driven rAF sin CSS transitions, overflow descarta oldest | `repos-referencia/coucou/windows/src/views/ticker.ts:15-21,124-126,130-155` |
| 3 | Countdown window=min(10,autoClose*0.6), bar 160px, autoClose 15s | `repos-referencia/coucou/windows/src/island/island.ts:821-831` + `core/state.ts:100` |
| 4 | Approval botones construidos 1 vez (no re-render que trague click) + guard idempotente | `views.ts:306-315` (comentario mousedown/mouseup) + DoD test doble-click (brief task) |
| 5 | pillBadge solo si focusId!=id | Brief task (contrato explícito) |
| 6 | Question 1-4 preguntas / 2-4 opciones, respondible inline vía onAnswer (Ego, no "answer in terminal") | Plan `2026-10-15...md:369` (`question 1-4q/2-4opts`); no existe `QuestionRequest` en `packages/execution` (grep 0) → el plan es fuente de verdad |
| 7 | ApprovalData alinea con `WidgetPresentationRequest` (approvalId, toolName, riskLevel, arguments) + `command` línea display (Task7 deriva de arguments) | `packages/execution/src/WidgetHitlBridge.ts:4-17` |
| 8 | Builders puros `(data, actions)` sin singleton global (renderer = presentación, sin Node/VantaDB) | `apps/desktop/AGENTS.md` guardrails |
| 9 | MiniGrid 2x2 máx 4 (compact) | `island.ts:863-877` (`otherTasks.slice(0,4)`) |
| 10 | Geometría PANEL 720x320, NOTCH 184x32 | `layout.ts:53-60` + `floating-anim.ts:27-35` (ya porteado Task5) |

## Impacto mapeado (Regla 0)

- Leídos completos: `renderer/floating/floating.tsx`, `avatar-bridge.ts`, `floating-anim.ts`,
  `floating.html`, `floating-avatar.tsx`, `renderer/test/floating-avatar.test.tsx`,
  `coucou/windows/src/views/views.ts` (1-509), `views/ticker.ts` (1-156),
  `island/island.ts` (countdown 821-831, minigrid 863-877), `core/layout.ts` (1-120),
  `apps/desktop/src/preload.ts` (85-111), `packages/execution/src/WidgetHitlBridge.ts` (1-120).
- Callees (hacia dentro): `floating-anim.js` (cubicBezier/clamp/lerp), `react` (solo countdown component + mount helper).
- Entrantes: cero callers actuales (archivos nuevos). Futuros: Task7-HITL consume buildApproval/buildQuestion; floating.tsx monta ViewHost.
- Veredicto: riesgo BAJO. Archivos nuevos, cero edición de existentes, cero regresiones posibles fuera de renderer/test. PROHIBIDOS intactos (main.ts, src/windows/*, preload.ts, packages/*).

## Steps

- [x] S0 DISCOVERY: fuentes + Spec + este task file (Save Point)
- [ ] S1 RED: `test/floating-views.test.tsx` → FAIL (`buildApproval is not a function` / Cannot find module)
- [ ] S2 GREEN ticker.ts (StepTicker + consts + placeRow)
- [ ] S3 GREEN views.tsx (ViewHost + 8 builders + header + pill + minigrid + registry)
- [ ] S4 GREEN countdown.tsx (pure fns + controller + React component)
- [x] S5 VERIFY: vitest 16/16 + vecinos 48/48 + typecheck 0 + DoD 7 + Review P2-01 Fast + RESULTADO §7 (SIN commit: orquestador)

## Log

- S0: Sin red necesaria (mecanismo 100% local). Sin `question` tool → gates que disparen = INCOMPLETO+BLOQUEO.
- S1 RED: `vitest run test/floating-views.test.tsx` → 1 failed / 0 tests (transform: no resuelve `../floating/views.js`). Contraseña TDD pagada.
- S2–S4 GREEN: ticker.ts (StepTicker + placeTickerRow + consts) · views.tsx (ViewHost + 8 builders + header + pill + minigrid + buildViews + ViewMount) · countdown.tsx (pure fns + controller + React). Test ajustado a API providers `getData` (diseño, no asunción).
- S5 VERIFY: `pnpm --filter @ego/renderer test -- test/floating-views…` 16/16 ✓; vecinos avatar+anim+sound 48/48 ✓ cero regresiones; `pnpm --filter @ego/renderer typecheck` 0 errores ✓ (7 propios corregidos al 1er intento: noUncheckedIndexedAccess + re-export; colaterales ChartView/CharacterMorph: 0 en esta corrida).
- Nota CLI: `pnpm --filter @ego/renderer exec vitest run …` emite `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "vitest" not found` engañoso aunque vitest SÍ corre; usar el script `test -- <file>` (Task12 lo documenta).

## Review (P2-01 Fast — renderer/*, modo degradado sin subagente disponible)

- Veredicto: approve. Spot-check: builders puros sin estado global; approval idempotente (decided flag + botones disabled); ticker sin `transition` ni timers; countdownrespeta pinned/null; clases `ego-*` (cero copy visual coucou); única mención "Mochi" es de descarte (línea 8, convención T-isla-gates).
- Verify mecánico: vitest 16/16 + typecheck 0 = ALL PASS. Sin bypass: waiver n/a (tier Fast, sin adversarial).
- Alcance commit (orquestador): SOLO `apps/desktop/renderer/floating/{views.tsx,ticker.ts,countdown.tsx}` + `apps/desktop/renderer/test/floating-views.test.tsx` (+ este task file). Archivos de Task4/otros workers en `git status` NO tocar.
