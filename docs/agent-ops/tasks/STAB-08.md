# STAB-08 — Migración RTL sistemática + MSW renderer

> **Estado:** ⏳ IN PROGRESS (DISCOVERY completo, ACT en curso)
> **Plan:** docs/agent-ops/plans/2026-10-16-plan-estabilizacion-ego.md (Task 9)
> **Appetite:** max 3d · **Esfuerzo:** 🔴 2-3d · **Prioridad:** 🟠 P1
> **Contrato:** `pnpm --filter @ego/renderer test` verde con `render/screen/user-event/getByRole`
> en App/ApprovalCard/Omnibar/Chat/Canvas + `test/msw/ego-handlers.ts` browser +
> `Chat.rtl.msw.test` streaming ok/error/latencia
> **SDP:** test-driven-development (lógica nueva: handlers + Chat.rtl.msw) + base-only (migraciones mecánicas)

## Spec (Gate D — decisiones)

| # | Decisión | Opción (Recomendado primero) | Justificación |
|---|----------|------------------------------|---------------|
| 1 | Dónde viven los handlers browser | `renderer/test/msw/ego-handlers.ts` (nuevo) | Colocalizado con el contrato (`@ego/renderer test`); `apps/desktop/test/msw/handlers.ts` es main/fetch-proxy, no se toca |
| 2 | msw en renderer | Añadir `msw@^2` a `renderer/package.json` devDeps | `msw` solo está en `@ego/desktop`; pnpm estricto no lo resuelve desde renderer |
| 3 | Superficie mockeada | `POST /ego/llmStream` (streaming por chunks NDJSON), `POST /ego/memory`, `GET /ego/snapshots` + variantes error/latencia/401/404/429 | Cubre `EgoBridge` (`renderer/lib/ego.ts:599-637`): llmStream/memory/snapshots |
| 4 | Chat.rtl.msw sin EgoChat | Harness mínimo `ChatHarness` definido en el propio test (input + botón Enviar + lista `role=log`/`alert`) contra MSW | EgoChat real depende de `window.ego` bridge + assistant-ui; el contrato pide streaming ok/error/latencia, no E2E del composer |
| 5 | Archivos viejos anti-RTL | Reescritura in-place a RTL (mismo path, mismo comportamiento) | Evita cambiar la colecta de vitest; `ApprovalCard.rtl`/`Omnibar.rtl` existentes se conservan como referencia |
| 6 | a11y.test.tsx (436L) | Migrar solo helpers `mount`/`pressEscape` a `render/screen/user-event`; lógica axe intacta | Alcance acotado; reescribir 16 tests axe excede el step budget |
| 7 | Gate D blast | 9 archivos ≤ 10 → NO dispara pregunta | Conteo: package.json + ego-handlers + Chat.rtl.msw + 6 migraciones (App, ApprovalCard, Omnibar, ChatAssistantUI, CanvasRuntime, a11y) |

## Impacto mapeado (Regla 0)

**Archivos leídos completos:**
- `apps/desktop/renderer/test/App.test.tsx:1-83` (createRoot+act+textContent+setTimeout)
- `apps/desktop/renderer/test/ApprovalCard.test.tsx:1-122` (querySelector+dispatchEvent)
- `apps/desktop/renderer/test/ApprovalCard.rtl.test.tsx:1-51` (referencia RTL canónica, no se toca)
- `apps/desktop/renderer/test/ChatAssistantUI.test.tsx:1-190` (createRoot, 5 describes)
- `apps/desktop/renderer/test/CanvasRuntime.test.tsx:1-146` (createRoot, filtros)
- `apps/desktop/renderer/test/Omnibar.test.tsx:1-102` (createRoot + debounce 400ms)
- `apps/desktop/renderer/test/Omnibar.rtl.test.tsx:1-27` (referencia, no se toca)
- `apps/desktop/renderer/test/ChatStreaming.test.tsx:1-273` (bridge `window.ego`, NO se migra — usa mock bridge legítimo, fuera del blast)
- `apps/desktop/renderer/test/a11y.test.tsx:1-436` (16 tests axe, mount createRoot)
- `apps/desktop/renderer/test/setup.ts:1-315` (MockEgoBridge global `window.ego`, WAAPI stub, cleanup manual)
- `apps/desktop/test/msw/handlers.ts:1-46` (patrón `setupServer` a replicar)
- `apps/desktop/renderer/lib/ego.ts:599-637` (superficie mock: memory/llmStream/snapshots)
- `apps/desktop/renderer/vite.config.ts` (vitest happy-dom + setupFiles)

**Referencias hacia dentro (lo que toco importa):** `setup.ts` MockEgoBridge global — las migraciones lo reutilizan sin modificarlo.
Tests referencian componentes: `src/App.tsx`, `components/tools/ApprovalCard.tsx`,
`components/omnibar.tsx`, `components/ego-chat.tsx`, `components/canvas/CanvasRuntime.tsx`,
`components/assistant-ui/*`. Ningún componente se modifica (solo tests + 1 devDep).

**Referencias entrantes:** `pnpm --filter @ego/renderer test` (vitest colecta `test/**`);
`docs/engineering/testing-e2e.md` (menciona RTL, docs no se tocan en esta task).

**Veredicto:** impacto BAJO-MEDIO, test-only + 1 devDep. Sin cambios en prod, main.ts, SharedMemory, CI.
Prohibidos respetados: main.ts, SharedMemory, CI, .ego-worktrees/dist/out.

## Steps

- [x] S1 — `msw@^2` en renderer devDeps + `pnpm install` + `test/msw/ego-handlers.ts` (browser: llmStream NDJSON/memory/snapshots ok + error/latencia/401/404/429)
- [x] S2 — `test/Chat.rtl.msw.test.tsx`: harness RTL + MSW 8/8 (streaming ok / error 500 / latencia / 401 / 404 / 429 / memory / snapshots)
- [x] S3 — `ApprovalCard.test.tsx` → RTL 3/3 (getByRole + user-event; `.rtl` de referencia intacto)
- [x] S4 — `App.test.tsx` → RTL 4/4 (heading/dialog por rol; título Modal "Búsqueda federada (Ctrl+K)" requería match por rol, no texto exacto)
- [x] S5 — `Omnibar.test.tsx` 6/6 + `ChatAssistantUI.test.tsx` 9/9 + `CanvasRuntime.test.tsx` 3/3 RTL
- [x] S6 — `a11y.test.tsx` 15/15 helpers → RTL (mount render + user-event; axe intacto; fix `noUncheckedIndexedAccess` en cálculo de contraste)
- [x] S7 — VERIFY: `pnpm --filter @ego/renderer test` 40f/273t ✅ + `typecheck` ✅ → commit local → review P2-01 pendiente (orquestador)

## Learnings

- `vi.restoreAllMocks()` en `afterEach` vacía los `vi.fn().mockResolvedValue` del
  MockEgoBridge global (`test/setup.ts`): el 2º render de App revienta en `.then`
  (Sidebar:187, ego-chat:413, ActivityTray:122, App:122). Usar solo `cleanup()`;
  `setup.ts` ya hace `vi.clearAllMocks()` en `beforeEach`.
- `getByText("Búsqueda federada")` falla aunque el omnibar abra: el título vive en
  el heading del Modal como "Búsqueda federada (Ctrl+K)". Query por rol con regex.
- Texto partido en spans (AnsiText, contadores "N líneas") requiere asserts por
  nodo o testid, no match de frase completa.
