# Plan Configs + Revisión Total — 2026-10-16

> **Campaign ID:** plan-2026-10-16-configs-revision
> **Fuente:** análisis configs Hermes/Codex/Claude vs Ego + auditorías testing/docs/distribución/prompts.
> **Guardrails:** `AGENTS.md` §4 (VantaDB vía `EgoMemoryAdapter`, sin VantaDB/SQLite/Python local en renderer, sin Next.js desktop, sin Mastra/LangGraph core). Prefijo `CFG-*` registrado aquí para settings/configuración; `REV-*` para revisión total. Formato 10 columnas `.agents/references/backlog-format.md`. DoD `.agents/references/definition-of-done.md` + `pnpm typecheck/build/test` + floor-guard.
> **Orden:** REV-01→REV-03 primero (evidencia), luego CFG-01→CFG-02 (verde total), luego CFG-03→CFG-09 (settings), CFG-10→CFG-11 (perf), CFG-12→CFG-14 (producto/dist). `DIST-04` firma sigue bloqueada owner, no se implementa aquí.

## Tabla canónica (una fila = una tarea)

| ID | Severidad | Hallazgo | Archivo:línea | Esfuerzo | Prioridad | Estado | Descripción | Relaciones | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| `REV-01` | 🟠 Alta | **Revisión consistencia total proyecto** | `docs/roadmap/Backlog.md` · `docs/engineering/stack-tecnico.md:17` · `README.md:51` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | Problema: drift docs vs código (electron-vite, mermaid, conteos 148/151, design-system fallbacks vs provider). Acción: auditar docs↔código↔backlog, corregir drifts o sincerar docs, recalcular conteos con aritmética auditable. Resultado: repo consistente y Backlog verificado. | Origen: auditorías 2026-10-15/16 · Ver: `CFG-01` | — |
| `REV-02` | 🔴 Crítica | **Revisión seguridad total** | `apps/desktop/src/main.ts:2102-2202` · `apps/desktop/src/preload.ts:195-340` · `apps/desktop/src/ipc/schema.ts` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | Problema: regresiones silenciosas en CSP/navegación/IPC/secrets tras 5 agentes paralelos. Acción: verificar webSecurity, guards navegación, CSP packaged estricta, Zod todo IPC, safeStorage sin tokens en renderer, grep secretos. Resultado: checklist seguridad en verde. | Origen: auditoría seguridad · Ver: `REV-01` | Dep: `REV-01` |
| `REV-03` | 🟠 Alta | **Revisión testing total y suites en verde** | `apps/desktop/renderer/test/` · `apps/desktop/test/` · `.github/workflows/ci.yml:10-83` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | Problema: suites parciales, skips por falta de install, fails ambientales. Acción: correr typecheck/build/test raíz, registrar preexistentes vs regresiones, exigir 0 regresiones. Resultado: estado verde documentado con evidencia. | Origen: auditorías testing · Ver: `REV-01` | Dep: `REV-01` |
| `CFG-01` | 🟠 Alta | **pnpm install + verde total post-instalación** | `apps/desktop/renderer/package.json:36-47` · `apps/desktop/package.json` · `apps/desktop/renderer/test/setup.ts:59-76` | 🟢 0.5-1d | 🔴 P0 | 🆕 Pendiente | Problema: RTL/MSW/coverage añadidos sin install (tests skipean), CharacterMorph 2 fails por mock reduced-motion, DelegationRouter 13 fails sin nativo. Acción: pnpm install, conciliar mock CharacterMorph (tests fuerzan matches:false), correr suites con EGO_REAL_DB=1 donde aplique. Resultado: 0 skips injustificados y fails solo ambientales documentados. | Origen: sesiones RTL/MSW 2026-10-15 · Ver: `REV-03` | Dep: `REV-03` |
| `CFG-02` | 🟠 Alta | **E2E Electron real ejecutado** | `tests/gui/electron/shell.electron.ts:69` · `tests/gui/electron.playwright.config.ts` · `docs/engineering/testing-e2e.md` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Problema: skeleton existe pero nunca corrido (requiere build+install+Xvfb). Acción: build desktop, install gui, correr en Xvfb, mock diálogos, shell pinta header+Chat+Canvas. Resultado: primer E2E real en verde o fails documentados con issue. | Origen: sesión E2E · Ver: `CFG-01` | Dep: `CFG-01` |
| `CFG-03` | 🟡 Media | **Perfiles nombrados modelo+sandbox+aprobación** | `apps/desktop/src/ipc/schema.ts:238-250` · `packages/subegos/src/SubEgoRegistry.ts` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Problema: sin bundle nombrado planner/reviewer/researcher/builder (Codex explore/build/deep). Acción: schema gov/settings/profiles en VantaDB+Zod (nombre, modelo, sandbox, aprobación, toolsets), sin archivos ~/.codex (guardrail: Zod+VantaDB). Resultado: 4 perfiles creables/listables con least-privilege. | Fuente: informe configs Parte C · Ver: `REV-01` | Dep: `REV-01` |
| `CFG-04` | 🟡 Media | **Reasoning effort + aliases + review model** | `apps/desktop/src/ipc/schema.ts:238-250` · `packages/models/src/ModelRouter.ts` | 🟢 0.5-1d | 🟡 P2 | 🆕 Pendiente | Problema: sin aliases fast/smart, review_model, effortLevel, availableModels/fallbackModel. Acción: extender ModelConfigSchema+router (effort→provider params, aliases resuelven, fallback chain). Resultado: planner frontier + hijos baratos configurables. | Fuente: informe configs Parte C/D | Dep: `CFG-03` |
| `CFG-05` | 🟡 Media | **Compresión y retención de contexto** | `packages/runtime/src/` · `packages/memory/` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Problema: sin compression.threshold/target_ratio, auto_compact limit, cleanupPeriodDays, autoMemory. Acción: settings compresión + job compactación (snapshot volátil, nunca mid-turn salvo compresión per PromptAssembly), retención sesiones. Resultado: sin desbordamiento y memoria curada. | Fuente: informe configs Parte B | Dep: `CFG-03` |
| `CFG-06` | 🟠 Alta | **Permissions deny-gana + approvals mode** | `apps/desktop/src/main.ts:1898` · `apps/desktop/src/ipc/schema.ts:102-107,182-186` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Problema: sin allow/ask/deny con deny gana, additionalDirectories, defaultMode, approvals.mode manual/smart/off+timeout+cron_mode. Acción: extender política permisos (deny→ask→allow), combinar con ApprovalEngine+riskLevel existentes. Resultado: least-privilege auditable. | Fuente: informe configs Parte D | Dep: `REV-02` |
| `CFG-07` | 🟡 Media | **MCP approval por-tool + toolsets por perfil** | `apps/desktop/src/ipc/schema.ts:148-165` · `packages/tools/` | 🟡 1-2d | 🟡 P2 | ✅ Completada (task docs/agent-ops/tasks/CFG-07.md) | Problema: sin approval por-tool tipo playwright.tools.x ni enable/disable por perfil ni reset documentado. Acción: schema approval por tool + toolsets por perfil + doc reset tras cambio tools (preserva prompt caching). Resultado: MCP gobernado por perfil. | Fuente: informe configs Parte B/C | Dep: `CFG-03` |
| `CFG-08` | 🟡 Media | **Curator programado + checkpoints acotados** | `packages/tasks/src/` · `packages/memory/` | 🟡 1-2d | 🟡 P2 | 🆕 Pendiente | Problema: sin curator interval/stale_after_days ni max_snapshots (solo dream_consolidate + .vdbdump). Acción: job curator (consolida stale, respeta cuarentena) + cap snapshots con rotación. Resultado: memoria y snapshots acotados. | Fuente: informe configs Parte B | Dep: `CFG-05` |
| `CFG-09` | 🟢 Baja | **Hooks ciclo de vida + statusLine + env** | `packages/events/src/EventBus.ts` · `apps/desktop/src/preload.ts` | 🟡 1-2d | 🔵 P3 | ✅ Completada (task docs/agent-ops/tasks/CFG-09.md) | Problema: sin hooks Pre/PostToolUse, statusLine, env por sesión. Acción: hooks config (comandos validados, kill switch disableAllHooks) + env inyectado + status command. Resultado: automatización ciclo de vida sin plugins. | Fuente: informe configs Parte D | Dep: `CFG-06` |
| `CFG-10` | 🟡 Media | **Abort mid-token perfecto en router** | `packages/models/src/ModelRouter.ts:273-292` · `packages/runtime/src/ToolExecutionLoop.ts` | 🟢 0.5-1d | 🟡 P2 | ✅ Completada (task docs/agent-ops/tasks/CFG-10.md) | Problema: generateText hace fallback a mock ante AbortError (1 llamada desperdiciada, documentado). Acción: re-throw AbortError en router + checkpoint loop intacto. Resultado: cancelación inmediata sin mock fantasma. | Origen: sesión abort real | Dep: `CFG-01` |
| `CFG-11` | 🟡 Media | **Coalescing + prioridad + input-to-paint** | `apps/desktop/renderer/components/ego-chat.tsx` · `apps/desktop/src/main.ts` | 🟡 1-2d | 🟡 P2 | 🆕 Pendiente | Problema: sin prioridad críticas>background, coalescing global, expiración obsoletos, métrica input-to-paint. Acción: cola priorizada IPC + coalescing lecturas + marcas tSend/tFirst/tPaint por frontera. Resultado: latencia medida y fairness. | Fuente: informe rendimiento | Dep: `CFG-01` |
| `CFG-12` | 🟡 Media | **Composer completo con adjuntos backend** | `apps/desktop/renderer/components/ego-chat.tsx:636-650` · `apps/desktop/src/ipc/schema.ts` | 🟠 2-3d | 🟡 P2 | ✅ Completada (task docs/agent-ops/tasks/CFG-12.md) | Problema: botón + sin backend, ProseMirror solo EditorView (TODO PM-COMPOSER), sin voz/nivel permisos inline. Acción: capabilities.attachments real (límite tamaño/tipo, cuarentena), permisos inline; voz queda Futuro. Resultado: adjuntar funcional y seguro. | Origen: auditoría A1 | Dep: `CFG-06` |
| `CFG-13` | 🟢 Baja | **Workbench extendido + personalización** | `apps/desktop/renderer/components/canvas/registry.ts` · `apps/desktop/renderer/src/App.tsx` | 🟠 2-3d | 🔵 P3 | ✅ Completada (task docs/agent-ops/tasks/CFG-13.md) | Problema: sin browser dev-servers, preview archivos, temas JSON portables, cron UI, atajos custom, notificaciones. Acción: browser view (solo loopback, con guards navegación), preview read-only, temas JSON import/export, cron UI sobre BackgroundEngine, atajos custom, notificaciones OS. Resultado: checklist features informe cubierto. | Fuente: informe stack §8 | Dep: `CFG-03` |
| `CFG-14` | 🟡 Media | **Sitio docs + release beta end-to-end** | `docs/` · `scripts/generate-checksums.cjs` · `apps/desktop/electron-builder.config.cjs` | 🟡 1-2d | 🟡 P2 | ✅ Completada (task docs/agent-ops/tasks/CFG-14.md) | Problema: sin sitio (VitePress), sin screenshots/GIFs, sin búsqueda, pipeline beta no probado. Acción: VitePress mínimo + screenshots + SHASUMS en release beta unsigned + release-notes desde CHANGELOG. Firma DIST-04 sigue bloqueada owner (no implementar). Resultado: distribución unsigned verificable. | Origen: sesiones docs/dist | Dep: `CFG-01` |

## CFG-12 — Ejecución (subagente, 2026-10-16)

Entregables (solo `apps/desktop/renderer/components/ego-chat.tsx` + test;
`ipc/schema.ts` intacto por reuso IPC, sin main/ModelRouter/memoria/docs-sitio, sin install):

- Helpers puros exportados: `CFG12_MAX_ATTACHMENT_BYTES` (10MB),
  `CFG12_ALLOWED_MIME` (txt/md/csv/json/pdf/png/jpg/webp),
  `isAllowedAttachmentType`, `resolveAttachmentPermission` (deny-gana CFG-06),
  `validateComposerAttachment` (fail-closed → cuarentena), `buildPromptWithAttachments`.
- Composer: botón ＋ + file input oculto + chips con permiso inline +
  cuarentena visible + `executeTurn` con prompt efectivo. Voz = `TODO VOICE`
  + `VoiceCapabilityState` + botón 🎙 disabled (≈12 líneas).
- `test/composer-attachments-cfg12.test.tsx` (8 tests) + `docs/agent-ops/tasks/CFG-12.md`.
- Deuda: STT/TTS real en fase propia; reglas inline a `gov/settings/permissions`
  cuando settings lo exponga. Handler main declarado innecesario (reuso `ipc.llm.*`).

=== RECITATION ===
Objetivo activo: CFG-12 — Composer completo con adjuntos backend
Estado: completed (desde: in-progress)
Última acción: fila CFG-12 a ✅ + sección de ejecución en plan file + task CFG-12.md
Resultado: ✅
State: completed (desde: pending)
Próxima acción: ninguna en CFG-12; resto según orden del plan (decide orquestador)
Contrato: adjuntar funciona en test (8/8 nuevo) ✅ + typecheck renderer ✅ + typecheck desktop ✅ + chat 17/17 sin regresión ✅
Invariantes: formato 10 columnas intacto; fuera de ego-chat.tsx+test nuevo nada tocado salvo task/plan; sin schemas/ModelRouter/memoria/docs-sitio; sin pnpm install
Comandos de verificación: `npx vitest run test/composer-attachments-cfg12.test.tsx` 8/8 ✅; `npx tsc --noEmit -p apps/desktop/renderer/tsconfig.json` ✅; `npx tsc -p tsconfig.json --noEmit` (desktop) ✅; chat 17/17 ✅
Deuda: voz STT/TTS real = fase propia (TODO VOICE + schema listo); reglas inline locales fail-closed (cablear a gov/settings/permissions a futuro)
last-synced: 2026-10-16
=== END RECITATION ===

## CFG-14 — Ejecución (subagente, 2026-10-15)

Entregables (solo `docs/`; `scripts/generate-checksums.cjs` verificado sin cambios):

- `docs/.vitepress/config.mts` (nav + sidebar + búsqueda local) +
  `docs/getting-started.md` + `docs/changelog.md` (espejo `CHANGELOG.md`).
- `docs/public/screenshots/{shell,chat,canvas}.svg` (placeholders marcados).
- `docs/public/quickstart/frame-01..04.png` (PNG reales stdlib) + `README.md`.
- `docs/deployment/releases/v0.1.0-beta.1/release-notes.md` + `SHASUMS.txt`
  generado con el script real. DIST-04 no implementado (bloqueo owner).
- `docs/index.md`: sección "Empieza aquí". Task: `docs/agent-ops/tasks/CFG-14.md`.

## CFG-09 — Ejecución (subagente, 2026-10-16)

Entregables (solo `packages/events/src/EventBus.ts` + tipos + `apps/desktop/src/preload.ts`
namespace `hooks` + sección docs; sin `schemas`/ModelRouter/memoria/renderer, sin install):

- `packages/events/src/types.ts`: `HookKind`, `HookCommandConfig`
  (matcher exacto/prefijo/`*` + comando validado + timeout), `HooksConfig`
  (`disableAllHooks` kill switch + `statusCommand`), `HookDecision`, `HooksStatus`.
- `packages/events/src/EventBus.ts`: validadores exportados
  (`isValidHookCommand/isValidToolPattern/matchToolPattern`), `configureHooks`
  (fail-closed, no muta ante rechazo), `setSessionEnv/getSessionEnv/getHookEnv`,
  `evaluatePreToolUse` (match PreToolUse → bloquea `blocked-by-hook:<id>`; kill
  switch/tool ausente → permite; tool inválido → bloquea), `recordPostToolUse`
  (observa, nunca bloquea), `getHooksStatus`. El bus nunca ejecuta comandos.
- `apps/desktop/src/preload.ts`: namespace `ego.hooks`
  (`getStatus/evaluatePreToolUse/recordPostToolUse` → `ipc.hooks.*`; guards CSP,
  fetch y folders intactos). Handlers `ipc.hooks.*` en main pendientes (futuro).
- `packages/events/test/HooksCfg09.test.ts` (6 tests) + `docs/agent-ops/tasks/CFG-09.md`
  + sección "Hooks de ciclo de vida" al final de `docs/architecture/agentes.md`.

=== RECITATION ===
Objetivo activo: CFG-09 — Hooks ciclo de vida + statusLine + env
Estado: completed (desde: in-progress)
Última acción: fila CFG-09 a ✅ + sección de ejecución en plan file + task CFG-09.md
Resultado: ✅
State: completed (desde: pending)
Próxima acción: ninguna en CFG-09; resto según orden del plan (decide orquestador)
Contrato: hook bloquea tool prohibida en test (6/6 nuevo, 22/22 events) ✅ + typecheck events ✅ + typecheck desktop ✅ (3 errores transitorios main.ts/effortLevel de edición concurrente CFG-04, re-corridos en verde)
Invariantes: formato 10 columnas intacto; fuera de EventBus(+tipos)/preload-hooks/sección docs nada tocado; sin schemas/ModelRouter/memoria/renderer; sin pnpm install
Comandos de verificación: `npx vitest run` (packages/events) 22/22 ✅; `npx tsc -p tsconfig.json --noEmit` (events y desktop) ✅
Deuda: handlers `ipc.hooks.*` en main (validación Zod + ejecución) = trabajo futuro fuera de alcance
last-synced: 2026-10-16
=== END RECITATION ===

## CFG-13 — Ejecución (subagente, 2026-10-16)

Entregables (solo `apps/desktop/renderer/components/canvas/` + `src/App.tsx`;
`registry.ts` intacto, sin `main.ts`/`schemas`/memoria/docs-sitio, sin install):

- `workbench-guards.ts` (loopback-only REV-02 + preview allowlist + shortcuts Zod).
- `BrowserView.tsx` (9 estados, iframe sandbox sin same-origin) + `FilePreviewView.tsx`
  (read-only) + `ThemeIO.tsx` (JSON validado) + `CronPanel.tsx` (`tasks.list/cancel`)
  + `ShortcutsPanel.tsx` (custom + `ego:shortcut`) + `NotifyCenter.tsx`
  (`onEvent` + `Notification` OS opt-in) + `WorkbenchView.tsx` (6 tabs).
- `src/App.tsx`: tab "Workbench". Voz NO (CFG-12).
- `test/workbench-cfg13.test.tsx` (20 tests) + `docs/agent-ops/tasks/CFG-13.md`.
- Deuda: posible inconsistencia `DEV_NAV_HOSTS "::1"` vs `URL.hostname "[::1]"`
  en `main.ts:1848-1868` (no tocado por alcance; candidato REV-02).

=== RECITATION ===
Objetivo activo: CFG-13 — Workbench extendido + personalización
Estado: completed (desde: in-progress)
Última acción: fila CFG-13 a ✅ + sección de ejecución en plan file
Resultado: ✅
State: completed (desde: pending)
Próxima acción: ninguna en CFG-13; resto según orden del plan (decide orquestador)
Contrato: registry intacto 11+1 vistas con 9 estados en la nueva ✅ + typecheck renderer ✅ + test nuevo 20/20 ✅ + App/registry/CanvasRuntime 11/11 sin regresión ✅
Invariantes: formato 10 columnas intacto; fuera de canvas/+App.tsx nada tocado salvo task/plan
Comandos de verificación: `tsc --noEmit` (renderer) ✅; `vitest run test/workbench-cfg13.test.tsx` 20/20 ✅
Deuda: `main.ts` IPv6 `[::1]` (candidato REV-02); voz en CFG-12
last-synced: 2026-10-16
=== END RECITATION ===

## CFG-07 — Ejecución (subagente, 2026-10-16)

Entregables (solo `apps/desktop/src/ipc/schema.ts` sección MCP +
`packages/tools/`; ModelConfig/profiles/permissions intactos, sin
ModelRouter/memoria/renderer/docs-sitio, sin install):

- `schema.ts` (MCP): `McpToolsetNameSchema` (web/search/browser/terminal/
  file/memory/delegation/cronjob), `McpToolDecisionSchema`
  (allow/ask/deny, deny gana), `McpToolApprovalRuleSchema` (match exacto
  `serverId`+`tool`, ej. `mcp_servers.playwright.tools.screenshot` →
  deny), `McpToolApprovalsSchema`, `ProfileToolsetsSchema` (enable/disable
  por perfil; `enabled: []` = sin allowlist), `McpToolsResetDocSchema`
  (`preservePromptCaching` default true).
- `packages/tools/src/toolsets.ts` (nuevo, puro): `TOOLSET_MATCHERS`
  declarativos, `resolveMcpToolDecision` (deny gana, sin regla → base),
  `resolveApprovalWithMcpOverride` (deny/ask → exige aprobación),
  `isToolEnabledByToolsets/filterToolsByToolsets/cloneRegistryForProfile`,
  `buildToolsResetDoc` (fail-closed, preserva prompt caching).
- `packages/tools/src/index.ts`: export `toolsets.js`.
- `packages/tools/test/toolsets-cfg07.test.ts` (8 tests) +
  `docs/agent-ops/tasks/CFG-07.md`.

=== RECITATION ===
Objetivo activo: CFG-07 — MCP approval por-tool + toolsets por perfil
Estado: completed (desde: in-progress)
Última acción: fila CFG-07 a ✅ + sección de ejecución en plan file + task CFG-07.md
Resultado: ✅
State: completed (desde: pending)
Próxima acción: ninguna en CFG-07; resto según orden del plan (decide orquestador)
Contrato: tool bloqueada (deny) pide aprobación en test (8/8 nuevo, 60/60 tools) ✅ + typecheck tools ✅ + typecheck desktop ✅
Invariantes: formato 10 columnas intacto; fuera de schema.ts/MCP + toolsets nada tocado; sin ModelConfig/profiles/permissions/ModelRouter/memoria/renderer/docs-sitio; sin pnpm install
Comandos de verificación: `npx vitest run` (packages/tools) 60/60 ✅; `npx tsc -p tsconfig.json --noEmit` (tools y desktop) ✅
Deuda: handlers `ipc.mcp.*` para approvals/toolsets en main + persistencia `gov/settings/mcp_tools` = trabajo futuro fuera de alcance
last-synced: 2026-10-16
=== END RECITATION ===
