# FIND-11-02 — Escape colapsa en la flotante (gap T-isla-11-e2e.md:50)

Estado: ⏳ IN PROGRESS (DISCOVERY→EJECUCIÓN→CIERRE, worker único)
Plan: docs/agent-ops/plans/2026-10-15-isla-flotante-ego-completa.md (gap checklist Task11 vs Task6)
SDP: test-driven-development (RED→GREEN) + source-driven-development (patrón Escape ActivityTray) + campaign-executor/progreso (base).
Skills cargadas: test-driven-development, source-driven-development.

## Contrato
(a) Implementar `Escape` colapsa en la flotante: pulsar Escape con la flotante
expandida/alerta la colapsa (vista local a `compact`/`hidden`, coherente con el
colapso `expanded→compact` de `AttentionStateMachine`; NO resuelve ni rechaza
HITL — solo colapsa vista, el pending sigue en main).
(b) `Enter` idempotente ya evidenciado (`views.tsx:317`, no tocar).
(c) Test nuevo `apps/desktop/renderer/test/floating-keyboard.test.tsx` PASS;
suite renderer flotante verde; `pnpm --filter @ego/renderer typecheck` 0 en
mis archivos.
(d) Una sola ubicación: `apps/desktop/renderer/floating/floating.tsx`
(keydown listener + cleanup en unmount). NO ViewHost, NO ambas.
Acceptance: Escape en expanded = colapsa; Escape en hidden = no-op; Escape NO
resuelve HITL (approve/deny intactos); cero regresiones; sin secretos;
renderer sin VantaDB.

## Spec (Gate D — 1 ronda batched YA hecha en el brief; sin re-preguntas)
| # | Decisión | Evidencia / valor |
|---|----------|-------------------|
| S1 | Esc = colapsar VISTA local (`setSnapshot` a `compact`/`hidden`), pending intacto (Recomendado) | Brief FIND: "colapsa vista sin tocar pending". Bridge `EgoFloatingBridge` (`preload.ts:99-111`) NO expone collapse/hide — solo `onState/approve/deny/setMuted`; `AttentionStateMachine` vive en `packages/*` (PROHIBIDO). Colapso real de FSM requeriría IPC nuevo en main (fuera de radio). Vista-local es la única opción en alcance |
| S2 | `expanded`/`alert`/`hitl_approval` → `compact`; `compact` → `hidden`; `hidden` → no-op | Coherente con FSM (`AttentionStateMachine.ts:138-146`: `expanded→compact` conserva request, luego `compact→hidden` vía release). Escape recorre el mismo camino en dos pulsaciones, sin tocar la cola real |
| S3 | Foco tras colapso: al botón mute (control estable de la ventana) si el foco estaba dentro del `main` | Patrón ActivityTray (`ActivityTray.tsx:102-110`: Esc colapsa + foco al trigger; `a11y.test.tsx:359-378`). La flotante NO tiene trigger externo (es su propia ventana); el botón mute es el único control persistente → adaptación documentada, no asunción |
| S4 | Handler en `FloatingApp` (`floating.tsx`), NO en ViewHost | `floating.tsx:35` es el único componente React montado hoy (82L Task3); ViewHost (`views.tsx:527`) aún no se monta en flotante (Task7 lo hará). Un solo punto = sin duplicación; keydown es hoja sin callers |
| S5 | Solo `Escape`; no atrapar Tab ni Enter; `preventDefault+stopPropagation` solo al colapsar | Esc es teclado, no animación (reduced-motion no aplica pero no se rompe: sin springs en el handler). Enter intacto (`views.tsx:317`) |
| S6 | Test nuevo `floating-keyboard.test.tsx` (no extender `floating-views.test.tsx`) | Task6 owns `floating-views.test.tsx` (16 tests verdes); archivo nuevo = radio disjunto, cero riesgo de churn ajeno |

## Impacto mapeado (Regla 0)
- Archivos leídos completos: `floating.tsx` (82L: `FloatingApp` avatar+píldora+mute+onState),
  `views.tsx` (539L: `buildApproval` idempotente `decide` 316-322, `ViewMount`, ViewHost sin montar en flotante),
  `avatar-bridge.ts` (95L: `avatarStateFor/presenceFor`), `floating-anim.ts` (340L: `islandSize` hidden/compact/expanded/hitl,
  RAF stop en hidden), `floating.html` (37L: mount points), `AttentionStateMachine.ts` (209L: `requestAttention/releaseAttention`,
  `tick` expanded→compact→hidden, `setPinned`), `preload.ts:85-111,460-474` (tipos `FloatingStateSnapshot`/`EgoFloatingBridge`,
  sin método collapse), `ActivityTray.tsx:102-110` (patrón Escape+focus), `a11y.test.tsx:359-378` (assert Esc colapsa),
  `floating-views.test.tsx` (218L: convención `act`+`createRoot` reuse), `test/setup.ts` (happy-dom + `IS_REACT_ACT_ENVIRONMENT`),
  `vite.config.ts` (happy-dom, setupFiles).
- Referencias hacia dentro (lo que toco usa): `useState/useEffect/useCallback/useRef` (react),
  `FloatingAvatar`, tipo `FloatingStateSnapshot` (type-only preload), `window.egoFloating.onState/setMuted`.
  Ningún símbolo nuevo de producción salvo el handler local (hoja).
- Referencias entrantes (quién usa lo que toco): nadie — `FloatingApp`/`mountFloating` sin importadores en renderer
  (grep: solo `floating.tsx`); `floating.html` lo carga como entry. keydown es hoja sin callers; riesgo bajo.
- Veredicto: impacto SOLO UX teclado flotante (visual local); a11y: foco al mute tras colapsar, sin atrapar Tab;
  HITL intacto (sin llamadas a `approve/deny`). PROHIBIDOS respetados: sin tocar `apps/desktop/src/*`,
  `desktop/test/*`, `packages/*`, `tests/e2e+gui`, `docs/roadmap+review`, verify-audit.jsonl.
- Scope validado (manual: sin MCP `campaign_validate_scope` en este runner): editables =
  `apps/desktop/renderer/floating/floating.tsx` + `apps/desktop/renderer/test/floating-keyboard.test.tsx`; solo lectura el resto.

## Steps
- [x] S1 DISCOVERY: plan + gap + Regla 0 + Spec (este file) — Gate D: propuesta FIND aplicada, sin hallazgo bloqueante
- [x] S2 RED: `floating-keyboard.test.tsx` creado (8 tests) → 5 FAIL colapso ausente (3 PASS no-op/Enter/cleanup, esperado)
- [x] S3 GREEN: handler Escape en `floating.tsx:52-88` + `muteRef` + cleanup → 8/8 PASS
- [x] S4 VERIFY: suite flotante 67/67 verde + `typecheck` 0 + Review Fast approve (self spot-check, ver §Review)
- [ ] S5 CIERRE: RESULTADO §7 + GATES + SKILLS (NO commit — orquestador; NUNCA push)

## Verify log
- S2 RED: `pnpm --filter @ego/renderer exec vitest run test/floating-keyboard.test.tsx` → 5 failed / 3 passed
  (`expected 'expanded' to be 'compact'` ×5; no-op/Enter/cleanup PASS por ausencia de handler — señal RED correcta).
- S3 GREEN: mismo comando → 8/8 PASS (123ms).
- S4 suite flotante (views 16 + anim 14 + avatar 6 + sound 12 + upload 11 + keyboard 8): 67/67 PASS, 6 files.
- S4 typecheck: `pnpm --filter @ego/renderer typecheck` → 0 errores (tsc limpio).
- S4 git status: mi radio = `M floating.tsx` + `?? floating-keyboard.test.tsx` + `?? FIND-11-02-escape.md`.
  Colaterales AJENOS (NO tocar, NO incluir): `M apps/desktop/test/FloatingWindow.test.ts` (FIND-11-01 paralelo),
  `M docs/agent-ops/reports/verify-audit.jsonl`, `?? Arreglar-OpenCode.ps1/Untitled-1.py/__pycache__/robot-chat-follow.png`,
  `?? FIND-11-01-mock.md`.

## Review (P2-01 Fast — renderer/*, self spot-check)
- Alcance: 1 ubicación (`floating.tsx`), 0 ediciones fuera de radio; `views.tsx` intacto (Enter 317 no tocado).
- Handler: solo `Escape` (retorno temprano resto), `preventDefault/stopPropagation` solo al colapsar,
  sin `approve/deny/setMuted`, sin `any` (cast vía `unknown`), cleanup en unmount (test 8).
- A11y: foco al mute tras colapsar (adaptación documentada S3 — sin trigger externo en flotante); Tab libre.
- Veredicto: **approve**. Nota: self-review (sin agente distinto en este runner) — el orquestador aplica P2-01
  formal al commitear.

## Findings
- Ninguno nuevo. Gap origen: T-isla-11-e2e.md:50.
