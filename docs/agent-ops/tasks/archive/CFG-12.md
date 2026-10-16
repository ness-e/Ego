# CFG-12 — Composer completo con adjuntos backend

- **Estado:** ✅ COMPLETED
- **Plan:** docs/agent-ops/plans/2026-10-16-plan-configs-revision-total.md
- **Archivos clave:** `apps/desktop/renderer/components/ego-chat.tsx`, `apps/desktop/renderer/test/composer-attachments-cfg12.test.tsx`
- **last-synced:** 2026-10-16

## Alcance (decisión usuario: completo, voz difiere si bloquea)

- Adjuntos backend + permisos inline: implementado.
- Voz STT/TTS: diferida a fase propia (bloquearía por IPC/media); queda `TODO VOICE` + schema listo (`VoiceCapabilityState`) + botón 🎙 deshabilitado honesto. <50 líneas para voz: cumplido (tipo + botón + TODO ≈ 12 líneas).

## Blast Radius

- Solo `ego-chat.tsx` (Composer) + test nuevo. Sin `ipc/schema.ts` (reuso `ipc.llm.*` existente con `prompt: string`), sin handler main (declarado innecesario: validación fail-closed en renderer, cuarentena nunca viaja), sin ModelRouter/memoria/docs-sitio.

## Decisiones (ponytail: reusar > stdlib > plataforma > mínimo)

1. Reusar IPC existente: adjuntos viajan como resumen de metadatos en el `prompt` (`buildPromptWithAttachments`); sin binarios al main, sin schema nuevo.
2. Validación fail-closed en renderer: fuera de allowlist o >10MB o permiso `deny` → `quarantined: true`, nunca se incluye en el turno.
3. Permisos inline heredan CFG-06: `resolveAttachmentPermission` = deny-gana (`deny > ask > allow`, sin match → `ask`), misma semántica que `resolvePermissionDecision` en `main.ts:1642`.
4. Voz: solo TODO + tipo + botón disabled (difiere STT/TTS completo).

## Steps

- [x] Step 1: helpers puros CFG-12 en `ego-chat.tsx` (allowlist, 10MB, deny-gana, cuarentena, `buildPromptWithAttachments`) + `VoiceCapabilityState`.
- [x] Step 2: estado composer + `handleFiles`/`removeAttachment` + `executeTurn` con prompt efectivo y limpieza.
- [x] Step 3: UI (botón ＋, file input oculto, chips con permiso inline, cuarentena visible, botón voz disabled) + test 8/8.
- [x] Step 4: verify (typecheck renderer ✅, typecheck desktop ✅, test nuevo 8/8 ✅, chat 17/17 sin regresión ✅) + plan/task sync.

## Contrato

"adjuntar funciona en test + typecheck renderer y desktop" — ✅:
- `npx vitest run test/composer-attachments-cfg12.test.tsx` → 8/8.
- `npx tsc --noEmit -p apps/desktop/renderer/tsconfig.json` → limpio.
- `npx tsc -p tsconfig.json --noEmit` (desktop) → limpio.
- Chat existente (`ChatStreaming`/`ChatAssistantUI`/`ChatTurnCost`) → 17/17 sin regresión.

## Deuda

- Voz STT/TTS real (captura mic + `audioInput` por `ipc.llm.*`) → fase propia.
- Reglas de permiso inline hoy locales (`[]` → `ask` fail-closed); cablear a `gov/settings/permissions` vía `settings.getGovPolicies` cuando el picker de settings lo exponga.
- Sin `any`; sin pnpm install; `ipc/schema.ts` intacto por decisión (reuso IPC).
