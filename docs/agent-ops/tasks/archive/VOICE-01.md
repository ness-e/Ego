# VOICE-01 — Voz STT/TTS opt-in con kill switch y privacy review

> **Plan:** `docs/agent-ops/plans/2026-10-16-plan-configs-revision-total.md` · **Wave:** única · **Previa:** CFG-12 ✅ · **Next:** ninguna (cierra voz)
> **Appetite:** 1-2d · **Branch:** master · **Commit:** `feat: VOICE-01 STT/TTS opt-in` (LOCAL, nunca push)
> **SDP:** campaign-executor, progreso, ponytail, systematic-debugging, test-driven-development, code-review-and-quality, security-and-hardening, doubt-driven-development

## 1. Tarea (objetivo + contrato + acceptance)

**Objetivo:** cerrar el TODO VOICE (≈12 líneas en `ego-chat.tsx:231-234,1218-1229`: `VoiceCapabilityState` + botón 🎙 disabled) con dictado STT→composer y lectura TTS opt-in, sin secretos en renderer, con kill switch global y privacy notice visible.

**Contrato exacto:**
- (a) Botón mic ≥44px con `aria-label` + estados `recording`/`disabled` (`data-testid="composer-voice-button"` preservado).
- (b) STT transcribe al composer input (WebSpeech default local; groq-whisper opcional vía main). Mock determinístico inyectable en tests; sin mic real en CI.
- (c) TTS solo con toggle explícito opt-in + kill switch `disableVoice` (deny-gana: kill veta STT y TTS aunque haya opt-in).
- (d) API keys (groq) solo en main vía safeStorage/env; el renderer nunca ve el secreto (schema de voz sin campos `*Key`; `EgoFetch`-style: main inyecta auth).
- (e) Privacy notice visible: "el audio se envía al proveedor solo al dictar/leer; nunca se graba en segundo plano".
- (f) Suites verdes: typecheck renderer 0 + typecheck desktop 0 + voz 6/6 + ChatStreaming 6/6 sin regresión.

## 2. Blast Radius

**Clave (línea):**
- `apps/desktop/renderer/components/ego-chat.tsx:231-234` (tipo `VoiceCapabilityState` + comentario TODO) y `:1218-1229` (botón 🎙 disabled) — SOLO botón+hook, no reescribir composer.
- NUEVO `apps/desktop/renderer/components/voice/useVoice.ts` (hook + puros aislados).
- NUEVO `apps/desktop/renderer/components/voice/VoiceButton.tsx` (botón + notice).
- NUEVO `apps/desktop/renderer/test/voice-cfg.test.tsx` (6 tests).
- `apps/desktop/src/ipc/schema.ts` — SOLO apéndice sección voice al final (NO tocar ModelConfig/profiles/permissions/MCP).
- `apps/desktop/src/main.ts` — SOLO apéndice sección voice handlers `ipc.voice.*` (NO tocar guards 1837-1950, CSP, fetch 2063-2148, folders, permissions CFG-06, queue CFG-11).
- NUEVO `apps/desktop/test/voice-schema.test.ts` (schema puro, sin Electron).
- `apps/desktop/renderer/lib/ego.ts` — tipos bridge voice mínimos (`voice?` opcional) + mock.
- `apps/desktop/src/preload.ts` — namespace `voice` aditivo (`ipc.voice.*`).

**Relacionados:** `DesignSystemProvider` (tokens existentes, sin cambios), `ChatStreaming.test.tsx` (regresión 6/6).

**Prohibido tocar:** `packages/runtime/src/AttentionStateMachine.ts`, `packages/runtime/src/ErrorHandler.ts`, `packages/tasks/src/ProactivityEngine.ts`, `packages/tasks/src/TaskCheckpoint.ts`, `packages/memory/EgoMemoryAdapter.ts`, `packages/memory/OpaqueId.ts`, `packages/memory/SessionTimelineRewind.ts`, `packages/memory/QuarantineAwareReads.ts`, `packages/models/src/ModelRouter.ts`, `renderer/test/setup.ts`, `renderer/floating/*`, `packages/ui-runtime/*`, `apps/desktop/electron.vite.config.ts`, `docs/.vitepress/*`, `docs/public/*`, `docs/deployment/*`, `scripts/generate-checksums.cjs`, `.github/workflows/*`, `Arreglar-OpenCode.ps1`, `Untitled-1.py`, `__pycache__/`, `robot-chat-follow.png`, `docs/agent-ops/reports/verify-audit.jsonl`.

## 3. Impacto mapeado (Regla 0)

- **Archivos leídos completos:** `ego-chat.tsx` (1278 líneas: composer, TODO VOICE ×2, CFG-11/12 intactos), `schema.ts` (919 líneas: tail = PermissionsSettings), `preload.ts` (460 líneas: bridge + hooks + floating), `lib/ego.ts` (954 líneas: `EgoBridge` + mock), `composer-attachments-cfg12.test.tsx`, `ChatStreaming.test.tsx`, `test/setup.ts` (mock global, NO tocar).
- **Referencias hacia dentro (callees):** WebSpeech `SpeechRecognition`/`webkitSpeechRecognition` + `speechSynthesis` (renderer, sin secreto) → `ego().voice.*` (preload `ipc.voice.*`) → main handlers (Zod fail-closed + safeStorage/env, audit best-effort). Sin cambios de firmas IPC existentes; namespace nuevo.
- **Referencias entrantes (callers):** Composer mic Button → `useVoice` → `onTranscript` inserta en textarea del composer (vía `composerWrapRef`, evento `input`, display-only intacto) → `executeTurn`. TTS: botón "Leer última respuesta" → `speak(lastAssistantRef)` solo si opt-in y sin kill. `executeTurn` acuña `lastAssistantRef` con `finalReply`.
- **Veredicto:** impacto acotado a voz; sin migración; sin firmas existentes; riesgo medio (permiso mic OS denegado → estado `denied` honesto; autoplay bloquea TTS sin gesto → solo por click; costo nube groq/edge → default local + honest "no configurado").

## 4. Contrato / Spec (tabla 3 decisiones + invariantes + DoD)

| # | Decisión | Opciones | Recomendada + evidencia |
|---|---|---|---|
| D1 | STT provider | groq-whisper (nube+calidad+costo) vs WebSpeech nativo (local+gratis+calidad variable) | **WebSpeech default + groq opcional si hay key** (ponytail: reusar plataforma antes que SDK; ADR-0003: inferencia en main/proveedor, captura en renderer; keys solo main). |
| D2 | TTS provider | edge-nube vs `speechSynthesis` local | **`speechSynthesis` default + edge opcional futuro** (mismo tradeoff; sin autoplay: solo por gesto). |
| D3 | Auto-play respuestas | nunca vs opt-in toggle | **Nunca autoplay; solo botón Leer con opt-in explícito** (privacy review owner 2026-10-16). |

**Gate P/D:** decisiones por evidencia código (TODO VOICE real verificado) + decisión owner voz-ahora con privacy review + kill switch → sin `question` (código no contradice).

**Invariantes:** sin secretos en renderer (grep `groq|apiKey|*Key` en `components/voice/*` = 0 salvo `*Key` en comentarios prohibidos); kill switch deny-gana; sin autoplay; fail-closed Zod en borde main; composer/adjuntos/CFG-11 intactos.

**DoD (task/commit LOCAL, release N/A):** typechecks 2/2 en 0 + voz 6/6 + ChatStreaming 6/6 + OCR sin Critical/High + review registrado + commit LOCAL conventional con VOICE-01 + plan file actualizado + skill progreso.

**Herramientas:** `pnpm --filter @ego/renderer typecheck`, `pnpm --filter @ego/desktop typecheck`, `pnpm --filter @ego/renderer exec vitest run test/voice-cfg.test.tsx`, `pnpm --filter @ego/desktop exec vitest run test/voice-schema.test.ts`, `pnpm --filter @ego/renderer exec vitest run test/ChatStreaming.test.tsx`. Sin `pnpm install` (hecho CFG-01).

## 5. Steps atómicos (≤100 líneas c/u)

- [x] **Step 1 — DISCOVERY + Spec + task file** (este archivo: Metadata/Blast Radius/Regla 0/Contrato/Spec/D + referencias leídas: clean-code Ap.V + security-checklist + testing-patterns).
- [x] **Step 2 — Schema voice + test desktop** (apéndice `schema.ts`: `VoiceSttSchema`/`VoiceTtsSchema`/`VoiceSettingsSchema` sin `*Key`; `test/voice-schema.test.ts` 6/6 puros; typecheck desktop 0).
- [x] **Step 3 — Hook + botón + test renderer** (NUEVO `voice/useVoice.ts` + `voice/VoiceButton.tsx`; `test/voice-cfg.test.tsx` 6/6 mock-mic; typecheck renderer 0).
- [x] **Step 4 — Bridge + main handlers** (apéndice `preload.ts` namespace voice; `lib/ego.ts` tipos mínimos + mock; apéndice `main.ts` handlers `ipc.voice.*` fail-closed + kill switch + audit; import extendido 1 hunk; guards/CSP/fetch/folders/permissions/queue intactos).
- [x] **Step 5 — Integración ego-chat + privacy + killswitch** (botón disabled → `VoiceButton`; transcript→textarea vía `composerWrapRef`; `lastAssistantRef` + botón Leer opt-in; notice visible; controles DEBAJO del composer para no desplazar el textarea en orden DOM — fix regresión CFG-11 verificada por stash protocol).
- [x] **Step 6 — Verify + OCR + review + commit + plan** (typechecks 2/2 en 0 + voz 6/6 + ChatStreaming 6/6 + renderer full 307/307 + desktop bridge/zod/voz 20/20; grep secretos renderer limpio salvo comentarios + lógica BYOK preexistente; OCR delegation sin Critical/High; review fast-tier APPROVE degradado; commit LOCAL; plan + task actualizados).

## 6. Review (P2-01 — fast-tier, degradado mismo-contexto)

- **Tier:** fast (diff = `apps/desktop/**` + `docs/agent-ops/tasks/VOICE-01.md`; ningún path matchea globs adversarial).
- **Modo:** degradado (sin agente distinto en runner; precedente CFG-01/CFG-02/CFG-11). Lente doubt-driven aplicada por el autor.
- **Enfoque y veredicto por pregunta:**
  - ¿STT/TTS opt-in correcto? SÍ — STT default WebSpeech local, groq solo con key en main; TTS solo por botón con checkbox opt-in, sin autoplay.
  - ¿Secretos solo en main? SÍ — grep renderer: 0 key material (solo comentarios + lógica BYOK `apiKey` preexistente CFG-era); schema voz sin `*Key`; `GROQ_API_KEY` solo env de main.
  - ¿Kill switch deny-gana? SÍ — `resolveVoiceSttEnabled/TtsEnabled` + handlers main chequean `disableVoice` primero; persiste en `gov/settings/voice`.
  - ¿Sin autoplay? SÍ — `speak` solo vía click "Leer última".
  - ¿Composer intacto? SÍ — salvo botón+hook+controles; regresión CFG-11 (checkboxes antes del textarea rompían `querySelector` del test) detectada por stash-protocol y corregida (controles debajo del composer); full renderer 307/307.
- **Prueba:** typechecks 2/2 en 0 + voz 6/6 + ChatStreaming 6/6 + composer 8/8 + paint 4/4 + desktop bridge/zod/voz 20/20 + OCR delegation sin Critical/High.
- **Deuda honesta:** STT groq exige `GROQ_API_KEY` en env de main (sin slot en ModelConfig por regla no-touch); TTS edge = rama honesta "pendiente de cableado de red"; opt-in TTS es session-local (no persiste — privacy-positivo).
- **Veredicto: APPROVE (degradado).**

## 7. Notas

- Fase1 N/A no-bug (feature), pero método correcto: RED mock-mic antes de integración (TDD), Iron Law si mic falla en CI (mock, no mic real).
- Security (mic = trust boundary): permiso OS explícito (el navegador lo pide; `denied` honesto), sin grabación oculta (solo durante `recording` visible), sin exfiltración sin consentimiento (STT nube solo con key configurada + notice; default local), kill switch global, sin secretos en renderer, Zod fail-closed en borde main, audit `gov/audit` best-effort.
- Sin red para research WebSpeech/groq: API WebSpeech usada es estable y defensiva (`webkit` prefix + feature-detect); groq/edge quedan como rama "no configurado" honesta → deuda TSYS-13 N/A (sin citas URL).
- WIP ajeno excluido del commit (lista §2 prohibidos + `git status` check en Gate C).
