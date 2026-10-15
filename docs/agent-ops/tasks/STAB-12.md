# STAB-12: MCP streamable-http + hooks + handoff/fork

## Metadata
- **Plan file:** `docs/agent-ops/plans/2026-10-16-plan-estabilizacion-ego.md` (Task 13)
- **Fuente:** plan Task 13 + auditorías subagentes 2026-10-15/16
- **Esfuerzo:** 🟡 1d
- **Prioridad:** 🟠 P1
- **Tipo:** TypeScript (feature-add: símbolos públicos nuevos → Spec SDD obligatoria + Gate D)
- **Turns estimados:** 10-14
- **Creado:** 2026-10-16
- **last-synced:** 2026-10-16
- **Estado:** ✅ COMPLETO (contrato verde + commit local; review P2-01 pendiente por orquestador)
- **Incógnitas (uphill):** 0 (Spec D1-D7 cerrada; D4/D5 con recomendado-aplicado documentado para orquestador)
- **Pendientes (downhill):** 0 (8/8 steps ✅)

**SDP:** `api-and-interface-design` (contratos transport/http/handoff primero, adición sin ruptura, validación en bordes) + `security-and-hardening` (threat model SSRF, allowlist efectiva, fail-closed, cero eco, sin secretos en config). Base auto vía MCP no disponible en este harness → sync manual + RESULTADO como handoff.
**SKILLS_CARGADAS:** api-and-interface-design, security-and-hardening
**Referencias leídas:** clean-code-clean-architecture.md §1-2 (SLAP, ≤3 args, errores explícitos, Boy Scout), question-gates.md (vía pipeline-full), task.md §Regla 0.

## Blast Radius

| Dirección | Módulos |
|-----------|---------|
| Callers | `McpManager.registerServer/connectServer` → `McpClient` (nuevo branch transport); `main.ts handleLlmStream/toolLoop` → `ToolExecutionLoop` (nuevos gates opt-in); `main.ts ipc.mcp.addServer` (validación URL); renderer futuro `ipc.sessions.fork` (canal nuevo tríada ipc.ts+main+preload) |
| Callees | `NetPolicy.validateUrl` (`@ego/tools`, ya existe, OCLW-09); `evaluateToolCall` (`@ego/security`, ya existe, STAB-02); `EventBus.evaluatePreToolUse/recordPostToolUse` (ya existen, CFG-09); `adapter.get/list/put/recordAudit` (gateway único) |
| Implicaciones | `transport` enum ampliado aditivo (stdio/sse intactos); `McpClient.connect()` ramifica por transport (stdio path byte-idéntico); `ToolExecutionLoop` gates opt-in con defaults que preservan comportamiento (sin gate configurado = sin cambio); `HookKind` ampliado aditivo; `HookConfig` inválida sigue fail-closed |

## Impacto mapeado (Regla 0)
- **Archivos leídos (completos):** `packages/integrations/src/mcp/McpClient.ts` (540L), `packages/integrations/src/mcp/types.ts` (180L), `packages/integrations/src/mcp/McpManager.ts` (260L), `packages/integrations/test/McpClient.test.ts` (§1-80), `packages/security/src/ToolPermissions.ts` (408L), `packages/tools/src/native/security/NetPolicy.ts` (169L), `packages/events/src/EventBus.ts` (459L), `packages/events/src/types.ts` (§162-221), `packages/memory/EgoMemoryLifecycle.ts` (550L), `packages/memory/SessionTimelineRewind.ts` (319L), `packages/runtime/src/ToolExecutionLoop.ts` (§53-100, §340-570), `apps/desktop/src/ipc/schema.ts` (§146-160 McpServerConfig), `apps/desktop/src/ipc.ts` (§1-80), `apps/desktop/src/main.ts` (regiones 2860-2900 restore-MCP, 3258-3430 addServer, 4428-4450 evaluateToolCall), `packages/memory/EgoMemoryAdapter.ts` (§list 580-631, §recordAudit 1167-1200), `packages/memory/package.json`, `packages/integrations/package.json`
- **Archivos referenciados hacia dentro:** `McpManager.registerServer` → `new McpClient(config)` sin validar transport/url (gap); `ToolExecutionLoop` → `approvalEngine.evaluateRequirement` pero NUNCA `evaluateToolCall`/`evaluatePreToolUse` (gap doble); `EventBus` kinds = solo Pre/PostToolUse (sin SessionStart/End); `EgoMemoryLifecycle` sin fork (TimelineRewind.forkBranch es ramas in-memory, no copia session/turns); `McpServerConfigSchema.transport` = `stdio|sse` (sin http); `main.ts:4433 evaluateToolCall` sin `allowedMcpServers` (gap allowlist decorativa)
- **Archivos que referencian a los editados:** `McpManager.test.ts` + `McpClient.test.ts` (stdio intacto); `HooksCfg09.test.ts` (kinds existentes); `SessionTimelineRewind.test.ts` (no tocado); `ipc-contract.test.ts` (tríada 1:1 si añado canal); STAB-05/06/13 prohibidos (compresión/CAS/UX intocados)
- **Veredicto impacto:** medio — 9 archivos, superficie pública nueva (transport, HookKinds, SessionFork, 1 canal IPC) justificada en Spec; defaults preservan verdes existentes

## Contrato
tests `streamable-http` + `allowedMcpServers` enforced + hooks fail-closed registrados `gov/audit` + `session.fork` copia `session/turns` + handoff validado

## Spec (SDD — feature-add con símbolos públicos nuevos)

| # | Decisión | Opciones (+tradeoff) | Default recomendado | Resuelto |
|---|----------|----------------------|--------------------|----------|
| D1 | Transporte http: ¿POST stateless o SSE streaming? | A) POST JSON-RPC stateless por llamada (simple, sin conexión persistente; sin eventos server→client) / B) SSE streaming completo (complejidad: reconexión, cursor, Last-Event-ID) | A (spec MCP streamable-http admite POST simple con respuesta JSON; SSE se difiere a deuda; 1 fetch por `sendRequest`) | ✅ decidido-por-evidencia (MCP spec 2025-03-26 §streamable-http: POST simple válido; appetite 1d) |
| D2 | SSRF en URL http: ¿https-only + bloqueo total loopback/privadas? | A) https-only + NetPolicy (bloquea loopback, RFC1918, link-local, metadata; sin excepciones) / B) permitir http/localhost para dev (abre SSRF a metadata vía DNS-rebind en prod) | A (el contrato del plan exige explícitamente "localhost/169.254 bloqueado"; stdio cubre servidores locales; TOCTOU documentado como limitación conocida del skill) | ✅ decidido-por-evidencia (plan Task 13 + skill security-and-hardening §SSRF) |
| D3 | Auth en servidores http: ¿header `authorization` en config? | A) permitir (secreto en claro en `gov/mcp_servers` — viola "sin secretos en config") / B) bloquear `authorization`/`proxy-authorization` en schema fail-closed; bearer vía `env` → vault (patrón addServer existente) | B (coherente con F1T2/F5T10 "ningún secreto en claro al renderer ni en VantaDB"; deuda: `authTokenRef` vault-first) | ✅ decidido-por-evidencia (main.ts:3251-3253 + schema BYOK Task 10) |
| D4 | Enforcement allowlist: ¿dónde se cablea `allowedMcpServers`? | A) solo en `main.ts addServer` (registro; no cubre ejecución) / B) gate pre-ejecución en `ToolExecutionLoop` con callback `permissionCheck` inyectado (punto único, cubre todo caller) + validación URL en `addServer` | B (el loop es el único punto por el que pasa toda ejecución tool; inyección evita arista runtime→security; main provee `allowedMcpServers` = ids enabled del manager) | ✅ recomendado-aplicado (subagente sin canal interactivo: Gate D registrado; orquestador puede revertir a A) |
| D5 | Hooks sessionStart/End: ¿kinds nuevos o eventos ad-hoc? | A) eventos sueltos sin validación / B) `HookKind += SessionStart\|SessionEnd` + `evaluateSessionStart/End` fail-closed + evento `hook.decided` que main persiste a `gov/audit` (capas: runtime emite, main persiste) | B (fail-closed uniforme con CFG-09; sin adapter en runtime; auditoría inmutable SEC-06) | ✅ recomendado-aplicado (idem D4) |
| D6 | `session.fork`: ¿qué copia? | A) todo (`session/turns` + `sessions/timelines` + checkpoints) / B) solo `session/turns` (contrato literal) + micro-checkpoint del fork + objeto handoff validado `{from,to,summary,findings,files,issues,checkpointId}` | B (contrato literal; timelines son de STAB-05/CAS-adjacente prohibido; checkpoint reutiliza `createMicroCheckpoint` existente) | ✅ decidido-por-evidencia (contrato plan Task 13) |
| D7 | Canal IPC fork: ¿nombre? | A) `ipc.sessions.fork` (agrupa con `ipc.sessions.*` T13) / B) `ipc.session.fork` (singular) | A (convención plural existente: `ipc.sessions.list/get/resume` + SessionsListSchema T13) | ✅ decidido-por-evidencia (schema.ts:650-669) |

## Invariantes de dominio (handoff — MUST)
- **Invariantes a preservar:** stdio path byte-idéntico (tests McpClient existentes verdes); deny-gana innegociable (mcp_not_allowlisted siempre deny); hooks: config inválida → throw sin mutar (fail-closed CFG-09); cero eco (reasons/keys sin URLs/secretos); renderer untrusted (Zod en main); `gov/*` sin secretos (headers auth bloqueados); STAB-05/06/13 prohibidos (compresión/CAS/UX, timelines, worktrees intocados); commit LOCAL nunca push.
- **Comandos de verificación:** `pnpm --filter @ego/integrations test`, `pnpm --filter @ego/events test`, `pnpm --filter @ego/runtime test`, `pnpm --filter @ego/memory test`, `pnpm --filter @ego/desktop test`, `pnpm --filter @ego/desktop typecheck`
- **Deuda pendiente:** SSE streaming diferido (D1) · `authTokenRef` vault-first (D3) · TOCTOU DNS-rebind documentado (mitigación: redirect:error + sin credenciales en URL + nota skill) · review P2-01 por agente distinto (este harness sin subagentes) · campaign MCP no disponible → sync manual + RESULTADO

## Recitation
| Campo | Valor |
|-------|-------|
| activeGoal | STAB-12 MCP http + hooks + handoff/fork |
| lastAction | DISCOVERY + task file + Spec SDD (Steps 0-1 ✅) |
| result | PARTIAL |
| nextAction | Step 2: McpClient http + tests |
| contract | ver Contrato + Invariantes |
| nextTask | STAB-13 (Wave 4; STAB-11 paralelo) |

## Deuda técnica (Regla 6 — MUST)
**Saldo neto:** +3 diferidos documentados (SSE, authTokenRef, TOCTOU-nota) — ninguno bloquea contrato.

## Definition of Done (3 niveles)
- **Task:** contrato verde con tests nuevos (http, allowlist enforced, hooks fail-closed + audit, fork copia turns, handoff validado) + suites existentes sin regresión + checklist security-and-hardening §Verify + cero `any` nuevo.
- **Commit:** atómico `feat:` local (NUNCA push), solo archivos del blast radius.
- **Release:** N/A (sin publish; doc API en task file).

## FASE SECURITY (obligatoria — toca trust boundaries: red MCP, spawn, sesiones)
Threat model (STRIDE rápido): S: firma R10 intacta (http no omite `isSignedServer`; sin firma → HITL); T: Zod fail-closed en schema + NetPolicy pre-connect + `redirect:"error"`; R: `hook.decided` → `gov/audit` sha256 (SEC-06) + `session_start/fork` auditados; I: cero eco (redactUrl en errores; headers nunca a logs); D: timeoutMs ≤300000 + body cap 1MB + turns cap en fork (limit 1000); E: allowlist efectiva deny + hooks fail-closed + cron deny intacto. Skill security-and-hardening checklist §Verify al cierre.

## FASE PERFORMANCE
N/A con justificación: http = 1 fetch por llamada (sin polling); gates = síncronos puros (regex/map lookups); fork = 1 barrido paginado acotado (limit 1000, fuera de hot path). Sin nuevas deps (fetch nativo Node 22). Gate: tiempo de suites sin regresión anómala.

## Herramientas necesarias
- `pnpm --filter <pkg> test`, typecheck, git commit local

## Steps
- [x] Step 0: skills + referencias + DISCOVERY + task file + Spec SDD + Gate D
- [x] Step 1: `types.ts` — transport `streamable-http` + url/headers + `assertSafeMcpHttpUrl` ✅
- [x] Step 2: `McpClient` rama http + `McpHttp.test.ts` 7/7 ✅ (fetch stubbed; SSRF/redirect/SSE cubiertos)
- [x] Step 3: `schema.ts` — transport enum + superRefine + `SessionForkSchema`/`SessionHandoffSchema`/`HookEvaluateSchema` ✅
- [x] Step 4: `EventBus` SessionStart/End + `hook.decided` + tests 6/6 ✅ (HooksCfg09 6/6 sin regresión)
- [x] Step 5: `ToolExecutionLoop` gates + tests 4/4 ✅ (events 6/6 sin regresión)
- [x] Step 6: `SessionFork.ts` + tests 3/3 ✅
- [x] Step 7: `main.ts` wiring + tríada IPC + `ipc.hooks.*` (gap 1:1 cerrado) + sanitize headers; zod-coverage 12/12 ✅
- [x] Step 8: verify full + commit local + RESULTADO ✅

## Verify (mecánico, 2026-10-16)
| Suite | Resultado |
|-------|-----------|
| `@ego/integrations` McpHttp+McpClient+McpManager | ✅ 27/27 |
| `@ego/events` full | ✅ 28/28 |
| `@ego/runtime` governance+events | ✅ 10/10 |
| `@ego/memory` fork+timeline+curator | ✅ 16/16 |
| `@ego/desktop` full | ✅ 243 passed; ❌ 8 ajenos preexistentes (FloatingWindow 6 + ipc-contract floating 2, WIDG-02 otra wave — no tocados por alcance) |
| `@ego/desktop` typecheck | ✅ 0 errores |
| typecheck memory/runtime/integrations | ⚠️ rojo PREEXISTENTE en archivos no tocados (EgoMemoryAdapter/OpaqueId/QuarantineAwareReads/SessionTimelineRewind, AttentionStateMachine/ErrorHandler, SkillLinter); cero errores nuevos en archivos STAB-12 |
| security checklist §Verify | ✅ sin secretos en código; Zod en bordes; cero eco; SSRF NetPolicy+redirect:error+https-only; sin deps nuevas |

## Investigation Notes
- Iron Law N/A (feature, no bug). Gaps confirmados: (1) transport sin http en 3 capas (schema/types/client); (2) allowlist decorativa (evaluada en matriz pero sin caller en prod — `ToolExecutionLoop` no llama a `evaluateToolCall`); (3) hooks sin Session kinds y sin persistencia a audit; (4) fork inexistente (TimelineRewind.forkBranch = ramas in-memory, no copia turns).
- `NetPolicy.validateUrl` ya bloquea loopback/RFC1918/link-local/metadata + `allowLocalhost` default false → reutilización directa (cero duplicación).
- `McpManager.registerServer` acepta cualquier config sin validar → validación http en manager (retorna ok:false+lastError, patrón F1T2) + schema en main.
- `EgoMemoryAdapter.list(namespace, limit)` retorna `[]` ante fallo con log (F2T6) → fork fail-closed: `[]` = 0 turnos copiados pero handoff válido con `copiedTurns:0` + audit; `get` retorna null ante ausente.
