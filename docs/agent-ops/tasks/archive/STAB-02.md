# STAB-02: Permissions deny-gana + terminal hardening

## Metadata
- **Plan file:** `docs/agent-ops/plans/2026-10-16-plan-estabilizacion-ego.md` (Task 3)
- **Fuente:** plan Task 3 + Gate P 2026-10-16 (defaultMode=deny fail-closed, vinculante)
- **Esfuerzo:** 🟡 1d
- **Prioridad:** 🔴 P0
- **Tipo:** TypeScript (security + desktop main)
- **Turns estimados:** 8-12
- **Creado:** 2026-10-16
- **last-synced:** 2026-10-16
- **Estado:** ✅ COMPLETED (2026-10-16: contrato verde + commit local; review P2-01 pendiente por orquestador)
- **Incógnitas (uphill):** 0 (Gate P resolvió defaultMode=deny; resto decidido-por-evidencia en Spec)
- **Pendientes (downhill):** 6 steps

**SDP:** `security-and-hardening` (trust boundaries: renderer→main spawn, gov/settings persist, cero eco) + `test-driven-development` (lógica nueva en evaluateToolCall + gate spawn). Base auto (campaign-executor/progreso/ponytail vía MCP, no disponibles en este harness → sync manual de plan).
**SKILLS_CARGADAS:** security-and-hardening, test-driven-development
**Referencias leídas:** definition-of-done.md (standing + Ego DoD), question-gates.md (gates P/D/V/C + spec válida), task.md §Regla 0, clean-code Apéndice V (capas: security=entidad pura cero-dep; main=Humble Object/driver), electron-ipc (vía ipc-contract 1:1).

## Blast Radius

| Dirección | Módulos |
|-----------|---------|
| Callers | `tests/security/injection-boundaries.test.ts` (consume `evaluateToolCall` 2 args), `packages/security/src/index.ts` (re-export), renderer `ipc.terminal.spawn` → main handler, futuros `DelegationRouter`/`McpManager` (NO tocados: solo leen allowlist) |
| Callees | `ToolPermissions.ts` cero-dep (puro, sin fs/red); main handler → `PathValidator.validatePath` (`@ego/tools`), `adapter.get/put` (`gov/settings`), `ApprovalEngine` (timeout desde settings) |
| Implicaciones | `evaluateToolCall` defaults preservan comportamiento actual (compat con 30+ asserts existentes); veto deny en spawn solo bloquea lo que ya era deny en matriz; 2 canales IPC nuevos exigen tríada ipc.ts+main+preload (ipc-contract 1:1) |

## Impacto mapeado (Regla 0)
- **Archivos leídos (completos):** `packages/security/src/ToolPermissions.ts` (348L), `packages/security/src/index.ts`, `packages/security/test/ToolPermissions.test.ts` (249L), `apps/desktop/src/ipc/schema.ts` (§CFG-06 770-819), `apps/desktop/src/main.ts` (regiones 100-209, 1595-1745, 2440-2560, 2600-2630, 3355-3435, 4040-4133), `apps/desktop/src/ipc.ts` (116L), `apps/desktop/src/preload.ts` (§settings/terminal), `apps/desktop/test/permissions-policy.test.ts` (108L), `apps/desktop/test/ipc-zod-coverage.test.ts` (192L), `apps/desktop/test/ipc-contract.test.ts` (grep), `packages/execution/src/ApprovalEngine.ts` (60-229), `packages/tools/src/native/fs/PathValidator.ts` (36-60)
- **Archivos referenciados hacia dentro:** main.ts ← `@ego/security` (solo Credential*; `evaluateToolCall` NO importado — gap a cerrar); `PermissionsSettingsSchema` ← schema.ts:806; `TASK_SAFE_KINDS` ← main.ts:191 usado en :2528; `ApprovalEngine` ← `@ego/execution` construido en main.ts:2608 con timeout fijo
- **Archivos que referencian a los editados:** `tests/security/injection-boundaries.test.ts` → ToolPermissions; `package-index.test.ts` → index exports; `ipc-contract.test.ts` → ipc.ts+main+preload 1:1; STAB-03/04 NO referencian (regiones disjuntas: prompt 1751+ / DelegationRouter — prohibidos)
- **Veredicto impacto:** medio-alto — terminal es el mayor blast radius; cambios acotados a 7 archivos, defaults fail-closed preservan verdes existentes

## Contrato
`pnpm --filter @ego/security test` + `pnpm --filter @ego/desktop test -- ipc-zod-coverage` verdes + `evaluateToolCall` orden deny→approval→allow probado + `gov/settings/permissions` persiste

## Spec (SDD — feature-add con símbolos públicos nuevos: campos de `ToolPermissionsOptions`, `isCron`, 2 canales IPC)

| # | Decisión | Opciones (+tradeoff) | Default recomendado | Resuelto |
|---|----------|----------------------|--------------------|----------|
| 1 | Semántica de `defaultMode` en `ToolPermissionsOptions` | A) fallback final allow↔deny (rompe 30+ tests, cambia UX) / B) rige casos "desconocido/sin-perímetro" (unknown_tool/category, missing_workspace); innegociables (blocked_command, reserved_path, outside_workspace, unsafe_url, mcp_not_allowlisted) siempre deny | B (deny por defecto = comportamiento actual; deny-gana innegociable; Gate P "deny fail-closed" sin regresión) | ✅ decidido-por-evidencia (ref: ToolPermissions.ts:262-338 + Gate P plan:447) |
| 2 | Coexistencia con `PermissionsPolicy.defaultMode` (acceptEdits, schema.ts:791) | A) cambiar schema a deny (rompe test permissions-policy:18 + UX) / B) capas distintas: schema=política UX del usuario; options=veredicto fail-closed de la capa security | B (sin cambio de schema → sin SDD de schema; cero conflicto real) | ✅ decidido-por-evidencia (ref: schema.ts:770-819, permissions-policy.test.ts:16-23) |
| 3 | `additionalDirectories` en confinamiento | A) solo workspace (ignora campo) / B) raíces extra: absoluto bajo workspace O bajo additional dir pasa confinamiento; relativo sigue workspace-relative | B (espeja `resolveScopeDirs` main.ts:1743 + `isPathInScope` :1663) | ✅ decidido-por-evidencia (ref: main.ts:1660-1666,1742-1745) |
| 4 | `approvals` en options: qué enforcea `evaluateToolCall` | A) todo (mode/off downgradea veredictos — viola fail-closed) / B) solo `cronMode` (deny veta, ask→approval); `mode/timeoutMs` se portan para composición (los consume `shouldRequireApproval` + `ApprovalEngine`) | B (veredictos siguen advisory; engine conserva innegociables — comentario main.ts:1596-1597) | ✅ decidido-por-evidencia (ref: main.ts:1697-1740, ApprovalEngine.ts:145-184) |
| 5 | `isCron` en `ToolCallRequest` | A) sin flag (cronMode inerte en security) / B) flag opcional; solo con `isCron:true` se evalúa cronMode (default deny espeja schema cronMode:deny) | B (sin flag = sin cambio de comportamiento; compat injection-boundaries) | ✅ decidido-por-evidencia (ref: schema.ts:798-804, main.ts:1703-1711) |
| 6 | Veto en `ipc.terminal.spawn`: ¿qué veredicto bloquea? | A) deny+requireApproval bloquean (regresión: `ls`/`git status` morirían — R5 safe-set permite directo) / B) solo deny veta; requireApproval no bloquea (R5 safe-set gobierna allow; mensaje escape-HITL intacto) | B (deny-gana + endurece: 16 patrones vs 6 de main; cero regresión) | ✅ decidido-por-evidencia (ref: main.ts:241-269,4070-4085) |
| 7 | Nombres canales IPC nuevos ❓ | A) `ipc.permissions.getSettings/saveSettings` (convención `ipc.settings.*`, corto) / B) `ipc.settings.getPermissions/savePermissions` (agrupa con modelConfig) | B (agrupación por dominio settings; miso schema `PermissionsSettingsSchema`) | ❓ pregunta-batcheada Gate D al orquestador (implemento B; revert 3 líneas si elige A) |

## Invariantes de dominio (handoff — MUST)
- **Invariantes a preservar:** deny-gana innegociable (blocked_command/reserved/outside/unsafe_url/mcp_not_allowlisted siempre deny aun con `defaultMode:"allow"`); cero eco (reasons nunca contienen comando/URL/path); renderer untrusted (todo input Zod fail-closed); `gov/settings` sin secretos (permisos no llevan keys); STAB-03/04 intocados (handleLlmStream 1751+, DelegationRouter, ToolExecutionLoop).
- **Comandos de verificación:** `pnpm --filter @ego/security test`, `pnpm --filter @ego/desktop test -- ipc-zod-coverage permissions-policy ipc-contract`, `pnpm --filter @ego/desktop typecheck`
- **Deuda pendiente:** review P2-01 por agente distinto pendiente (worker sin subagentes; ver §Review) · `campaign_update_task_state`/progreso MCP no disponibles en este harness → sync manual de plan + RESULTADO como handoff · codegraph/check_index_coverage MCP no disponibles → blast radius vía grep/read (documentado)

## Recitation
| Campo | Valor |
|-------|-------|
| activeGoal | STAB-02 deny-gana + terminal hardening |
| lastAction | Step 6 verify + commit (Steps 2-6 ✅) |
| result | OK |
| nextAction | ninguno (task completa; review P2-01 al orquestador) |
| contract | ver Contrato + Invariantes |
| nextTask | STAB-05 (Wave 2; STAB-03/04 corren en paralelo Wave 1) |

## Deuda técnica (Regla 6 — MUST)
**Saldo neto:** 0 (sin deuda nueva; la review P2-01 queda como pendiente de orquestador, no como deuda de código)

## Definition of Done (3 niveles)
- **Task:** contrato verde + orden deny→approval→allow con tests + persistencia probada (estática: handlers usan safeParse+adapter.put; inventario coverage actualizado) + checklist security-and-hardening §Verify + cero `any`.
- **Commit:** atómico `feat:` local (NUNCA push), solo los 7 archivos del blast radius.
- **Release:** N/A (sin cambio de schema público Zod; doc API solo si el orquestador lo pide — `PermissionsSettingsSchema` intacto).

## FASE SECURITY (obligatoria — toca trust boundaries)
Threat model (STRIDE rápido): S: N/A (IPC local + senderFrame); T: settings Zod fail-closed + adapter gateway único; R: `recordAudit` best-effort en saveSettings (espeja saveModelConfig:3585); I: cero eco en reasons nuevas; D: caps schema (rules≤128, dirs≤32) + MAX_TERMINAL_SESSIONS intacto; E: deny-gana + innegociables. Skill security-and-hardening checklist §Verify al cierre.

## FASE PERFORMANCE
N/A con justificación: `evaluateToolCall` es puro síncrono (regex/substring sobre inputs ≤8KB), 1 llamada por spawn (no loops de search/ingesta, no vector/engine/serialización — AGENTS Regla 4). Sin nuevas deps. Gate: tiempo de suite sin regresión anómala.

## Herramientas necesarias
- `pnpm --filter @ego/security test`, `pnpm --filter @ego/desktop test`, typecheck, git commit local

## Investigation Notes
- Iron Law N/A (feature, no bug). Hipótesis confirmada: allowlist MCP efectiva en matriz pero `evaluateToolCall` sin caller en prod (gap); terminal spawn cwd/timeout desde renderer con solo R5 (6 patrones) + PathValidator workspace-only.
- Gate P vinculante: plan:447 "STAB-02 defaultMode=deny fail-closed" → Spec #1/#2.
- Conflicto aparente schema acceptEdits vs Gate P deny: resuelto Spec #2 (capas distintas, sin cambio de schema).
- `parsePermissionsSettings`/`shouldRequireApproval`/`resolveScopeDirs` existen pero sin loader/persistencia ni caller de settings (grep: solo definición) → Steps 4-5 cierran "persiste".
- `ApprovalEngine` mode standard + `defaultTimeoutMs` fijo 60_000 (main.ts:2608-2615) → Step 4 lo deriva de settings cacheados (60s default intacto).
- `TASK_SAFE_KINDS` cableado en :2528 pero predicado inline no exportado → Step 4 exporta `isTaskKindSafe` + test paused-vs-directo (respuesta al riesgo plan:99).

## Incógnitas vs Pendientes
| Eje | Contador |
|-----|----------|
| Incógnitas | 0 |
| Pendientes | 5 steps (2-6) |

## Steps

### Step 1: DISCOVERY + task file (ESTE STEP)
- **Archivos:** este task file
- **Acción:** Blast radius + Regla 0 + Spec + steps atómicos
- **Verify:** task file existe con Spec válida (tabla ≥1 fila con alternativas+default)
- **Estado:** ✅ DONE (2026-10-16)

### Step 2: `ToolPermissionsOptions` + `evaluateToolCall` (≤100 líneas diff)
- **Archivos:** `packages/security/src/ToolPermissions.ts`, `packages/security/src/index.ts` (tipos)
- **Acción:** añadir `ToolDefaultMode` (`"deny"|"allow"`, default deny), `additionalDirectories`, `approvals {mode?, timeoutMs?, cronMode?}` (default cronMode deny), `isCron?` en request; `checkPath` acepta raíces extra; cron gate antes de matriz; unknowns respetan defaultMode; innegociables siempre deny
- **Verify:** `pnpm --filter @ego/security test` (suite vieja debe seguir verde: compat total)
- **Estado:** ✅ DONE (2026-10-16: 89/89 verde incl. 9 tests STAB-02 nuevos; tsc limpio)

### Step 3: Tests orden deny→approval→allow + nuevos campos (TDD)
- **Archivos:** `packages/security/test/ToolPermissions.test.ts`
- **Acción:** RED→GREEN: orden (blocked+sensible→deny; sensible+destructive→sensitive_path approval; safe→allow), defaultMode allow (unknowns→allow PERO blocked/reserved→deny), additionalDirs (absoluto en dir extra pasa; fuera→deny), cron (isCron+deny→`cron_denied`; ask→approval; sin flag→sin efecto)
- **Verify:** `pnpm --filter @ego/security test` verde
- **Estado:** ✅ DONE (2026-10-16: RED 4 fallos confirmados pre-impl; GREEN 38/38 post-impl)

### Step 4: main.ts — veto spawn + cwd scope + settings cache/boot + TASK_SAFE_KINDS export
- **Archivos:** `apps/desktop/src/main.ts`
- **Acción:** importar `evaluateToolCall`; veto deny en `ipc.terminal.spawn` (post-Zod, pre-spawn; sin eco); `resolveCwdRoot` (workspace+additionalDirs, exportado); `isTaskKindSafe` exportado + uso en approvalPolicy :2528; `cachedPermissionsSettings` + load en boot (post-model_config, pre-ApprovalEngine) + `ApprovalEngine.defaultTimeoutMs` desde settings
- **Verify:** `pnpm --filter @ego/desktop typecheck`
- **Estado:** ✅ DONE (2026-10-16: veto deny en spawn + resolveCwdRoot + isTaskKindSafe + cache/boot + engine timeout desde settings; typecheck verde tras rebuild local de @ego/security dist — no commiteado)

### Step 5: IPC settings + tríada + tests desktop
- **Archivos:** `apps/desktop/src/main.ts` (handlers `ipc.settings.getPermissions/savePermissions` + persist `gov/settings/permissions` + audit best-effort), `apps/desktop/src/ipc.ts` (2 canales), `apps/desktop/src/preload.ts` (puente+impl), `apps/desktop/test/ipc-zod-coverage.test.ts` (inventario), `apps/desktop/test/permissions-policy.test.ts` (cwd scope + kinds + cronDenied coherence)
- **Acción:** handlers con `PermissionsSettingsSchema.safeParse` (save) / sin input (get); preload `settings.getPermissions/savePermissions`; coverage: save→validated, get→noArg
- **Verify:** `pnpm --filter @ego/desktop test -- ipc-zod-coverage permissions-policy ipc-contract`
- **Estado:** ✅ DONE (2026-10-16: handlers get/savePermissions + tríada ipc.ts/preload + coverage 10/10 + desktop 13/13; ipc-contract 2 fallos PREEXISTENTES hooks/floating fuera de scope — ver Notas)

### Step 6: Verify full + commit + cierre
- **Archivos:** plan file (Task 3 → COMPLETO + commit)
- **Acción:** security test + desktop tests contrato + typecheck; commit `feat:` LOCAL (NUNCA push); security checklist §Verify; Context Save Point; RESULTADO con GATES_EVALUADOS + SKILLS_CARGADAS
- **Verify:** contrato del plan Task 3 en verde
- **Estado:** ✅ DONE (2026-10-16: ver abajo; commit local, NUNCA push)

## Dependencias
- Wave 1 paralela con STAB-03/04 (archivos/regiones disjuntos; NO tocar handleLlmStream ni DelegationRouter/loop)
- nextTask: STAB-05

## Review (GATE P2-01 — agente distinto)
- **Revisor:** pendiente (orquestador: ego-review/ego-audit; worker sin capacidad de spawn)
- **Enfoque:** ¿deny-gana preservado bajo defaultMode allow? ¿cero eco en reasons nuevas? ¿tríada IPC 1:1? ¿STAB-03/04 intocados?
- **Cómo se probó:** (al cierre)
- **Veredicto:** ⬜ pendiente

## Context Save Point
- 2026-10-16 Step 6: todo implementado y verificado. Colaterales: (1) `ipc-contract` 2 fallos preexistentes (`ipc.hooks.getStatus`, `floating:state_changed` — drift de otras waves, mi diff es aditivo y no los toca; candidato FIND para orquestador, NO tocado por scope); (2) suite desktop completa 212✅/8❌ donde los 8 son FloatingWindow mocks + los 2 ipc-contract citados, todos fuera de blast radius; (3) `isPathInScope` normaliza `\` en Windows (fix inline <30min, mismo archivo, con test regresión); (4) review P2-01 formal pendiente por agente distinto (orquestador).

## Notas
- Plan:447 Gate P + brief worker fijan deny como vinculante; schema acceptEdits intacto (Spec #2).
- Canales: implemento `ipc.settings.getPermissions/savePermissions` (Spec #7 opción B); pregunta batcheada al orquestador en RESULTADO.
- SECURITY phase: STRIDE rápido en task file; checklist skill: sin dep changes (no audit), sin secretos, Zod en bordes, cero eco verificado (`rule` es identificador fijo), `recordAudit` best-effort en save.
- PERFORMANCE phase: N/A justificado (1 llamada pura por spawn, sin hot paths).
