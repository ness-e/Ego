# T-isla-09-upload: UploadCanvas completo + drop + URL segura (D4)

- **Estado:** ⏳ EN PROGRESO (DISCOVERY completo → ACT)
- **Plan:** docs/agent-ops/plans/2026-10-15-isla-flotante-ego-completa.md (Task 9)
- **Archivos clave:** `apps/desktop/renderer/floating/upload-seq.ts`, `apps/desktop/renderer/floating/upload-canvas.ts`, `apps/desktop/renderer/test/floating-upload.test.ts`
- **SDP:** campaign-executor, progreso, frontend-ui-engineering, source-driven-development, test-driven-development, security-and-hardening

## Blast Radius

N/A — archivos NUEVOS (cero callers existentes). Sin impacto en código vivo.

## Impacto mapeado (Regla 0)

- **Archivos leídos completos:**
  - `repos-referencia/coucou/windows/src/upload/sequence.ts` (528L, 100% mecanismo)
  - `repos-referencia/coucou/windows/src/upload/canvas.ts` (533L, 100% mecanismo)
  - `repos-referencia/coucou/NotchBuddy/Sources/App/SafeWebURL.swift` (12L)
  - `docs/extractions/coucou.md` §33 Safe URL (ll.1347-1373)
  - `apps/desktop/src/preload.ts` (480L, completo)
  - `apps/desktop/renderer/floating/ticker.ts` (191L, completo — contrato tick/stepSequence)
  - `apps/desktop/src/main.ts` §§ floating (ll.490-531), `openExternalValidated` (ll.2430-2495), `ipc.knowledge.ingest` (ll.4279-4294)
- **Referencias hacia dentro:** coucou sequence.ts/canvas.ts, SafeWebURL.swift, `floating-anim.ts` (clamp/lerp), `ticker.ts` (StepTicker), preload `knowledge.ingest` + `EgoFloatingBridge`.
- **Referencias entrantes:** NINGUNA (módulos nuevos; Task11-E2E los consumirá).
- **Veredicto de impacto:**
  - `ipc.knowledge.ingest` YA EXISTE en main (main.ts:4279, Zod-validado) y preload YA lo expone (`knowledge.ingest`, preload.ts:393). → **CERO hunks en main.ts y preload.ts** (evita disputa Wave 5 con Task10; justificado, no scope-cut: el contrato "si falta" no se dispara).
  - `openExternalValidated` YA EXISTE https-only (main.ts:2468-2495, MÁS estricto que coucou http/https). Renderer aporta `isSafeWebUrl` http/https-only (coucou SafeWebURL.swift:6-12); main sigue siendo gate final. Defensa en profundidad, sin tocar main.
  - Renderer = presentación; drop → `window.ego.knowledge.ingest` background, nunca bloquea UI.

## Spec (Gate spec-first — decisiones con evidencia)

| # | Decisión | Evidencia |
|---|----------|-----------|
| S1 | Curva progreso 60/32/8 (`u<0.4→0.6·eOut`, `u<0.85→+0.32·eInOut`, resto `+0.08·eIn`) | coucou sequence.ts:88-92 literal |
| S2 | Springs follow 0.35/lock 0.18, damping 0.7/0.75; LOCK_IN 60 / LOCK_OUT 90 | sequence.ts:31-32, 337-348 |
| S3 | `simulateTo` 240Hz (`DT=1/240`), `tRef` wall-clock, clamp pre-drop | sequence.ts:46, 293-331, 386 |
| S4 | `UploadSeq{enterZone/updateCursor/exitZone/performDrop/deactivate/frame/dropped/sinceDrop}` + `progressAt(t)` monótona | sequence.ts:239-319 |
| S5 | Canvas: zone/bar/choose/file, suck strips 28 + clip mouth, overlay 2 botones invisibles | canvas.ts:76-101, 380-429 |
| S6 | Sin Mochi: forma neutra (superelipse + ojos pill/cup/content, sin marca) | D1 owner + LICENSE-ASSETS (T-isla-gates) |
| S7 | `isSafeWebUrl`: solo http/https + host no vacío (trim + lowercase scheme) | SafeWebURL.swift:6-12 + extractions §33 |
| S8 | Drop → `knowledge.ingest({filePath})` 1 vez/archivo, background + ticker `sync/tick` por archivo | main.ts:4279 handler existe; ticker.ts:131-163 |
| S9 | Defaults Gate D GO (sesión): sin límite tamaño renderer (main/Zod valida), todos los MIME (ingest parsea o cuarentena), namespace = proyecto activo; drop fuera de zona → ignorar; N archivos → cola secuencial | graceful §22 extractions; Gate D GO dado en prompt (no re-preguntar) |
| S10 | `ContextProvider attach-window-context` OPCIONAL: interfaz + no-op documentado, fuera de alcance cableado real | extractions §34; plan Task9 "opcional" |

## Contrato

`pnpm --filter @ego/renderer exec vitest run test/floating-upload.test.ts` PASS + `pnpm --filter @ego/renderer typecheck` 0 errores en mis archivos. Acceptance: progressAt monótona, simulateTo determinista, drop→ingest 1 vez/archivo, file:/smb:/custom rechazadas + http/https aceptadas, overlay clicable.

## Herramientas

codegraph explore (blast radius) + check_index_coverage + validate_scope por archivo; vitest @ego/renderer (happy-dom); tsc renderer. NO push. NO commit (orquestador commitea "feat: UploadCanvas completo en flotante").

## Steps de ejecución

- [x] Step 0 DISCOVERY: Regla 0 + Spec + Save Point (este archivo)
- [x] Step 1 RED: crear `test/floating-upload.test.ts` → FAIL (módulo inexistente, verificado 16:58)
- [x] Step 2 GREEN-A: crear `floating/upload-seq.ts` (USC, easings, curva, progressAt, spring, engine, UploadSeq)
- [x] Step 3 GREEN-B: crear `floating/upload-canvas.ts` (UploadCanvas, escena, suck 28 strips, forma neutra, overlay, isSafeWebUrl, DropQueue)
- [x] Step 4 VERIFY: vitest 11/11 + vecinos 48/48 + tsc 0 + DoD + Review Fast → listo para commit orquestador

## Context Save Point

DISCOVERY 2026-10-15: sequence/canvas coucou leídos 100%; ingest+preload+safeURL YA existen en main (cero hunks); renderer vitest happy-dom vía vite.config.ts:55; test setup usa `../floating/*.js` imports con `.js` suffix ESM. Prox: Step 1 RED.

## Registro de Cumplimiento / Veredicto

- **Estado:** ✅ COMPLETED (código + tests; commit lo hace el orquestador)
- **Timestamp:** 2026-10-15T00:00:00Z
- **Evidencia / Fundamento:**
  - `pnpm --filter @ego/renderer exec vitest run test/floating-upload.test.ts` → 11/11 PASS (RED previo: Failed to resolve import, 16:58)
  - Vecinos flotante (anim/views/sound/avatar) → 48/48 PASS, sin regresiones
  - `pnpm --filter @ego/renderer typecheck` → 0 errores
  - main.ts / preload.ts: CERO hunks (ingest + safeURL ya existen; Regla 0)
  - SECURITY: isSafeWebUrl http/https-only + main https-only; drop→ingest vía IPC Zod-validado; sin innerHTML/eval/secretos
  - Review P2-01 Fast (solo renderer nuevo): veredicto approve — vitest + tsc mecánicos PASS
  - NO commit (orquestador: "feat: UploadCanvas completo en flotante"). NUNCA push.
