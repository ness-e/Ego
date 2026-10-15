# STAB-04: delegate_task fin-a-fin en ToolExecutionLoop

## Metadata
- **Plan file:** `docs/agent-ops/plans/2026-10-16-plan-estabilizacion-ego.md` (Task 5)
- **Fuente:** plan Task 5 + DelegationRouter endurecido (tareas 1-7) sin exponer como tool
- **Esfuerzo:** 🟡 1d
- **Prioridad:** 🔴 P0 (Wave 1 con STAB-02/03, archivos disjuntos)
- **Tipo:** feature-add (tool pública nueva + símbolos públicos) → Spec SDD obligatoria + Gate D
- **Turns estimados:** 8-12
- **Creado:** 2026-10-16
- **last-synced:** 2026-10-16
- **Estado:** ⏳ IN PROGRESS (Step 1 ✅ discovery+spec; Steps 2-5 pendientes)
- **Incógnitas (uphill):** 0 (todas resueltas por evidencia/contrato en Gate D)
- **Pendientes (downhill):** 4 (tests RED → impl → verify → commit)
- **Prohibidos:** `apps/desktop/src/main.ts` prompt (STAB-03), `packages/security/src/ToolPermissions.ts` (STAB-02), worktrees/dist
- **Next:** STAB-05

## Blast Radius
| Dirección | Módulos |
|-----------|---------|
| Callers | `ToolExecutionLoop.run` → `ToolRegistry.get/validateInput` → `ExecutionManager.execute` → `tool.execute(input, ctx)` (dispatch genérico, sin editar loop) |
| Callees | `DelegationRouter.delegateTask/validateDelegateTaskInput/assertChildToolAllowed/normalizeStructuredOutput/delegateMany/steer/stop/listActive/drainSteer` + `BLOCKED_CHILD_TOOLS` |
| Riesgo | Alto (recursión infinita si leaf subdelega) → mitigado: `maxSpawnDepth 0` default + `DelegationCycleError` + `DelegationBlockedToolError` + bloqueo leaf en 2 capas |
| Archivos afectados | 4 (nuevo `packages/subegos/src/DelegationTools.ts`, `packages/subegos/src/index.ts` export, `packages/subegos/package.json` dep, nuevo `packages/subegos/test/DelegationTools.test.ts`) — blast <10, sin hot-path editado → NO dispara pregunta GO/dividir |

## Impacto mapeado (Regla 0)
- **Archivos leídos (completos):** `packages/subegos/src/DelegationRouter.ts` (1-1059), `packages/subegos/src/types.ts` (DelegationRequest/Result/Status), `packages/runtime/src/ToolExecutionLoop.ts` (dispatch get→validateInput→execute), `packages/runtime/src/types.ts` (ToolExecutionContext), `packages/tools/src/ToolRegistry.ts` + `types.ts` (contrato ToolDefinition/Zod), `packages/tools/src/native/fs/NativeFsTool.ts` (convención factory `create*Tool`), `packages/subegos/package.json`, `packages/runtime/package.json`, `packages/tools/package.json`, tests `DelegationRouter.test.ts` + `subegos-delegation.test.ts`, `.agents/references/clean-code-clean-architecture.md` (§1-§8 + Apéndice V), `spec-template.md`, `STAB-01.md` (formato task file)
- **Referencias hacia dentro:** `DelegationTools.ts` (nuevo) → `DelegationRouter.ts` (métodos endurecidos) + `@ego/tools` (tipos `ToolDefinition/ToolExecutionContext`); `index.ts` re-exporta; test → `src/index.js`
- **Referencias entrantes (quién usará lo nuevo):** capa composición (`apps/desktop` main futuro, NO en esta tarea) vía `registerDelegationTools(registry, router)`; `ToolExecutionLoop` sin cambios (dispatch genérico ya existe)
- **Veredicto impacto:** medio-bajo — 1 archivo nuevo (~250 líneas) + 1 export + 1 dep + 1 test; cero edición en loop/router/registry; nueva dep `subegos→tools` acíclica (tools solo depende de zod)

## Contrato
`pnpm --filter @ego/subegos test` + `pnpm --filter @ego/runtime test` verdes + `delegate_task/delegate_many/delegation_steer/delegation_stop/delegation_list_active/delegation_drain_steer` invocables vía `ToolRegistry.validateInput+execute` con `goal/context` obligatorios y `BLOCKED_CHILD_TOOLS` enforced

## Spec SDD (spec-template.md §5 — Diseño Propuesto + Decisiones)
- **Tipo:** feature-add
- **Origen:** backlog (plan estabilización STAB-04)
- **Fecha:** 2026-10-16
- **Veredicto Preliminar:** 🟢 Factible para Ego
- **Estado de la spec:** ✅ confirmada por contrato+evidencia (Gate D por-evidencia, ver tabla; subagente sin canal `question` interactivo)

### 1. Problema
`DelegationRouter` expone `delegateTask/delegateMany/steer/stop/listActive/drainSteer` solo como API TS. Sin tools registradas, el `ToolExecutionLoop` jamás puede delegar en prod: la delegación existe solo en tests. (≤5 líneas.)

### 2. Viabilidad vs Principios
- ¿Respeta arquitectura Desktop?: Sí (main-composición registra tools; renderer intocado).
- ¿Memoria por EgoMemoryAdapter/NativeVantaDB?: Sí (router usa SharedMemory/Registry existentes; sin acceso directo nuevo).
- ¿Evita dependencias prohibidas?: Sí (solo se añade `@ego/tools` workspace a subegos; acíclica: tools→zod únicamente). ✅ NO descarta.

### 3. DoD Mecánico
1. `pnpm --filter @ego/subegos typecheck` 0 errores.
2. `pnpm --filter @ego/subegos test` verde (incluye `DelegationTools.test.ts` ≥10 casos).
3. `pnpm --filter @ego/runtime test` verde (sin regresión; loop intocado).
4. Dispatch simulado `registry.validateInput + tool.execute` OK para las 6 tools (prueba fin-a-fin a nivel contrato, mismo camino que `ToolExecutionLoop.run` usa).

### 4. Alcance
- **Incluye:** `DelegationTools.ts` (factory + `registerDelegationTools`), export en `index.ts`, dep workspace, tests, commit local.
- **NO incluye:** cablear registro en `apps/desktop/src/main.ts` (composición, tarea futura/STAB-05+); tocar `ToolExecutionLoop.ts`, `ToolPermissions.ts`, prompts; reintentos automáticos (0; reintenta el modelo vía loop).

### 5. Diseño Propuesto (≤10 líneas)
Nuevo `packages/subegos/src/DelegationTools.ts`: `createDelegationTools(router, opts?) → ToolDefinition[]` con 6 tools Zod (`delegate_task`, `delegate_many`, `delegation_steer`, `delegation_stop`, `delegation_list_active`, `delegation_drain_steer`); identidad desde `ToolExecutionContext` (`callerEgoId ← input ?? ctx.subEgoId ?? ctx.extra.callerEgoId ?? "user"`; `projectId ← input ?? ctx.projectId ?? ctx.extra.projectId`, fail-closed si falta); `parentContext ← ctx.extra.delegationParentContext`; `childRole ← ctx.extra.childRole` (leaf→bloqueo pre-router + router lo re-bloquea); `delegate_many` = N×`delegateTask` con concurrencia acotada default 3, orden preservado; sin reintentos automáticos; errores `Delegation*Error` se propagan (ExecutionManager los convierte en failed).

### 6. Decisiones (Gate D — 1 ronda; resueltas por evidencia/contrato, Recomendado primero)
| # | Decisión | Opciones (+tradeoff) | Default recomendado | Resuelto |
|---|----------|----------------------|---------------------|----------|
| 1 | Dónde vive la factory | **(a) `packages/subegos` (Recomendado: dueña del router, DIP; dep acíclica a tools)** / (b) `packages/runtime` (acopla runtime→subegos, viola SDP: runtime es estable) / (c) `packages/tools` (tools no debe conocer delegación) | (a) | ✅ evidencia: `ToolRegistry.ts:23` + `NativeFsTool.ts:27` patrón factory; `runtime/package.json` sin dep subegos; `tools/package.json` solo zod |
| 2 | Superficie de tools | **(a) 6 tools (Recomendado: delegate_task + delegate_many + steer/stop/list/drain; cubre contrato "delegateTask/delegateMany/steer/stop/drainSteer como tool")** / (b) solo delegate_task (deja steer/stop sin control vivo) | (a) | ✅ contrato plan Task 5 |
| 3 | Nombres/firmas | **(a) snake_case `delegate_task/delegate_many/delegation_*` (Recomendado: `delegate_task` ya existe en BLOCKED_CHILD_TOOLS:136 y mensajes)** / (b) kebab/camel (rompe match con blocklist) | (a) | ✅ evidencia `DelegationRouter.ts:135-144` |
| 4 | Identidad (caller/projectId) | **(a) input opcional con fallback a ctx + fail-closed (Recomendado: ergonomía modelo + sin default silencioso)** / (b) todo obligatorio en input (verboso; el modelo repite IDs) | (a) | ✅ evidencia `ToolExecutionContext` tiene `subEgoId/projectId/extra` (`tools/types.ts:30-38`) |
| 5 | `delegate_many` | **(a) N×delegateTask con pool acotado (Recomendado: hereda validate+assert+normalize por ítem)** / (b) envolver `router.delegateMany` directo (pierde validate/normalize → viola contrato) | (a) | ✅ contrato: "con validate+assertChildToolAdded+normalize" |
| 6 | riskLevel/approval | **(a) delegate_*: system/sensitive + requiresApproval:false explícito; control-vivo: safe (Recomendado: sensitive ya escala a approval si la política cambia; el loop hijo gobierna sus tools)** / (b) requiresApproval:true (bloquea autonomía; cada delegación pide HITL) | (a) | ✅ evidencia `ToolRegistry.resolveApprovalRequirement:181-202` (explícito prevalece); Gate P STAB-02 deny-gana no aplica aquí (no es ToolPermissions) |
| 7 | Reintentos | **(a) 0 automáticos (Recomendado: Validation/Blocked/Cycle/MaxDepth finales; Timeout/NotFound se reportan, reintenta el modelo)** / (b) retry con backoff (oculta ciclos; riesgo coste exponencial `estimateFanoutCost`) | (a) | ✅ evidencia `DelegationRouter.ts:658-675` coste 3^depth |
| 8 | Rol child por defecto en tool | **(a) `leaf` (Recomendado: plano depth0→1; orchestrator exige max_spawn_depth>=1 explícito)** / (b) orchestrator (abre subdivisión por defecto) | (a) | ✅ contrato plan + `DEFAULT_MAX_SPAWN_DEPTH=0` (`DelegationRouter.ts:115`) |

GATES_EVALUADOS (parcial): P:no (heredado GO plan) D:disparado→spec por-evidencia 8/8 sin N/A V:no C:no | subagente sin question interactivo, contrato+evidencia resuelven

## Invariantes de dominio (handoff — MUST)
- **Invariantes a preservar:** leaf NUNCA subdelega (2 capas: tool pre-check + router `parentContext.childRole`); `maxSpawnDepth` default 0; `maxConcurrency` default 3; goal/context no-vacíos (zod + router); salida estructurada `{summary,findings,files,issues}` normalizada; errores `Delegation*Error` propagados sin reclasificar; NO tocar `main.ts`, `ToolPermissions.ts`, `ToolExecutionLoop.ts`.
- **Comandos de verificación:** `pnpm --filter @ego/subegos typecheck`, `pnpm --filter @ego/subegos test`, `pnpm --filter @ego/runtime test`
- **Deuda pendiente:** registro en composición desktop (main) queda para tarea futura; review P2-01 por agente distinto pendiente al cierre.

## Deuda técnica (Regla 6 — MUST)
**Saldo neto:** Cero nueva (factory aditiva; dep workspace acíclica). Deuda heredada: sin registro en main (futura tarea composición).

## Definition of Done
- Task: contrato §3 (2 suites verdes + 6 tools invocables + BLOCKED enforced). Commit: `feat:` atómico local, NUNCA push. Release: N/A (sin cambio API pública externa; símbolos nuevos intra-monorepo).

## Herramientas necesarias
- shell (pnpm typecheck/test), edit/write, read/grep.

**SDP:** api-and-interface-design (tool pública: contrato primero, errores consistentes, validación en frontera) + test-driven-development (RED→GREEN→REFACTOR, prove-it) + systematic-debugging (solo si verify falla) + base auto (campaign-executor/progreso/ponytail vía MCP, no manual). Diagnosticadas vía keywords contrato; MCP campaign_* no disponible en este worker → ejecución manual equivalente.

## FASE SECURITY (cambio toca trust boundary: permisos `delegate:<id>` + BLOCKED_CHILD_TOOLS)
Checklist `security-and-hardening` aplicada al diseño:
- [x] Validación en frontera: schemas Zod (`goal/context/targetEgoId` no-vacíos) + `validateDelegateTaskInput` en router.
- [x] Fail-closed: `projectId` ausente → `DelegationValidationError` (sin default silencioso); `callerEgoId` cae a `"user"` (sistema lo trata como raíz auditada, igual que `delegate()`).
- [x] Deny-gana preservado: pre-check `childRole=leaf` + `assertChildToolAllowed` + router `parentContext` — 3 capas, ninguna relaja STAB-02.
- [x] Sin secretos en inputs/outputs: solo goal/context/IDs; `normalizeStructuredOutput` no filtra secretos — el executor del hijo es responsable (documentado en Notas).
- [x] Errores sin fuga interna: mensajes `Delegation*Error` ya curados (sin stack interno salvo `error` string del delegate base).
- [ ] `cargo audit`: N/A (sin cambio dependencias nativas; solo dep workspace TS).

## FASE PERFORMANCE (delegateMany = fan-out; NO hot path del loop)
- Concurrencia acotada default 3 (`DEFAULT_FANOUT_CONCURRENCY`), `preserveOrder` true; sin benchmark exigible (no toca vector/engine/search). Gate: sin regresión suites + timeouts configurables passthrough.

## Steps

### Step 1: Discovery + task file + Spec SDD + Gate D
- **Archivos:** este task file (nuevo)
- **Acción:** Cero código: leer router/loop/registry/tipos/tests/referencias; poblar Regla 0 + Spec + Gate D
- **Verify:** task file existe con Spec §5 + tabla 8/8 sin N/A
- **Estado:** ✅ DONE (2026-10-16)

### Step 2: RED — tests DelegationTools (TDD)
- **Archivos:** `packages/subegos/test/DelegationTools.test.ts` (nuevo, ~270 líneas)
- **Acción:** ≥10 casos: validate vacío/blanco, éxito normalizado, salida no-estructurada rechaza, leaf bloqueado, orchestrator sin depth rechaza, ciclo rechaza, delegate_many orden+acotado+uno-inválido-rechaza, steer→drain, stop/list, registro 6 tools en registry fake
- **Verify:** `pnpm --filter @ego/subegos test -- DelegationTools` FALLA (símbolos no existen) — RED probado
- **Estado:** ✅ DONE (2026-10-16: RED real `Failed to load url ../src/DelegationTools.js`; +2 fixes de test: cierre `});`, import `SubEgoManifest.js`, instructions ≥10 chars, expectativa `min(1)`; final 16/16)

### Step 3: GREEN — DelegationTools.ts + export + dep
- **Archivos:** `packages/subegos/src/DelegationTools.ts` (nuevo, ~330 líneas), `packages/subegos/src/index.ts` (export ya presente en HEAD vía b88be61 — edit no-op), `packages/subegos/package.json` (+`@ego/tools` workspace; lock ya lo contenía — sin diff lock), `pnpm install` (link verificado por tests)
- **Acción:** Factory + 6 ToolDefinitions + `registerDelegationTools`; SLAP ≤20 líneas/función; sin `any` injustificado; solo imports `type` de tools + zod + router
- **Verify:** `pnpm --filter @ego/subegos typecheck` 0 errores (+1 fix: `DelegationResult` viene de `types.ts`, no del router)
- **Estado:** ✅ DONE (2026-10-16)

### Step 4: VERIFY — suites + fixes
- **Archivos:** los de Steps 2-3 + fixes acotados
- **Acción:** `pnpm --filter @ego/subegos test` + `pnpm --filter @ego/runtime test`; retry ladder; 2 mismo-error → Gate V STOP
- **Verify:** ambas verdes
- **Estado:** ✅ DONE (2026-10-16: subegos 17 files/192 tests incl. 16 nuevos; runtime 11 files/60 tests sin regresión; typecheck 0 errores. Gate V no disparado: 0 fallas mismo-error en código prod)

### Step 5: Cierre — commit + review + RESULTADO
- **Archivos:** solo tocados STAB-04 (`git add` selectivo)
- **Acción:** commit local `feat:` (NUNCA push) + §Review veredicto + `skill progreso` si disponible + bloque RESULTADO
- **Verify:** `git log --oneline -1` + `git status --short` sin extras
- **Estado:** ⬜ PENDING

## Dependencias
- Wave 1 paralela con STAB-02/03 (archivos disjuntos: aquí `DelegationTools*`+`subegos/index`; 02 toca security, 03 main+PromptAssembly) — sin bloqueo mutuo. Next: STAB-05.

## Review (GATE — agente distinto, P2-01)
- **Revisor:** pendiente (orquestador asigna; worker no puede spawnear revisor distinto)
- **Enfoque:** ¿leaf bloqueado en 2 capas con test? ¿algún edit fuera de los 4 archivos? ¿dep acíclica?
- **Cómo se probó:** `pnpm --filter @ego/subegos test` 17f/192t + `pnpm --filter @ego/runtime test` 11f/60t + typecheck 0 err; dispatch `registry.validateInput+execute` en test 16
- **Veredicto:** ⬜ pendiente (self-check: 4 archivos exactos — `DelegationTools.ts`, `DelegationTools.test.ts`, `package.json` 1 línea, `STAB-04.md`; `index.ts` sin diff — export pre-existía en HEAD b88be61; prohibidos intocados: `main.ts`, `ToolPermissions.ts`, `ToolExecutionLoop.ts`; dep `subegos→tools` acíclica — tools solo depende de zod)

## Recitation
| Campo | Valor |
|-------|-------|
| activeGoal | STAB-04 delegate_task como tool fin-a-fin |
| lastAction | Steps 1-4 ✅: spec+tests(16)+impl+suites verdes; listo commit local |
| result | PARTIAL |
| nextAction | Step 5: commit local selectivo (4 archivos) + RESULTADO |
| contract | Contrato § + DoD Spec §3: subegos 192t ✅, runtime 60t ✅, 6 tools invocables ✅, BLOCKED ✅; invariantes leaf/depth/concurrency; deuda: registro en main futuro + review P2-01 |
| nextTask | STAB-05 |

## Notas
- `normalizeStructuredOutput` no sanea secretos en `summary/findings`: el contenido lo genera el executor del hijo; si un flujo maneja secretos, sanear en el executor — fuera de alcance aquí.
- `delegate()` base acepta `callerEgoId "system"/"user"` sin manifiesto: la tool cae a `"user"` cuando el loop no aporta identidad — comportamiento auditado y consistente con router.
- `steer()` crea registro fantasma si el id es desconocido (comportamiento router existente, útil pre-ejecución); la tool lo expone tal cual.
