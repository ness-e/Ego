# HIG-01 — Normalizar `tsc` en `tests/`

- **Estado:** ⏳ EN PROGRESO
- **Plan:** `docs/agent-ops/plans/2026-10-13-plan-deuda-residual.md` (Task 1)
- **Archivos clave:** `tests/package.json`, `tests/tsconfig.json` (nuevo), `tests/e2e/*.test.ts` (6), `tests/security/*.test.ts` (1), `tests/chaos/*.test.ts` (1)
- **Contrato:** `pnpm --filter @ego/e2e-tests typecheck` exit 0 + `pnpm test:e2e` verde (baseline 14/14).
- **Skills (SDP):** `campaign-executor` (base), `test-driven-development` (pinned), `systematic-debugging` (pinned, bug-drift).
- **Referencias leídas:** `pipeline-full.md` (completo), `definition-of-done.md` (completo), `dev-tools.md` (completo), `clean-code-clean-architecture.md` (Apéndice V pendiente de lectura completa — ver §Apéndice V).

## Spec (decisiones HITL del plan + zero-code planning)

| Decisión no declarada en el plan | Opción elegida (recomendada) | Fundamento |
|---|---|---|
| Identidad de tipos src-vs-dist | Unificar a `dist` (contratos compilados) | `packages/*/package.json` exponen solo `dist` (`main`/`types`/`exports` → `dist`); `golden-path-alpha-full` (el más nuevo) ya importa vía `@ego/*` → `dist`. Importar `src` cruza identidades de clases con `private` (`EgoMemoryAdapter.db`) → TS2345. Vitest ejecuta `dist`, así que typecheck y runtime quedan autoconsistentes. La frescura de `dist` es problema de HIG-02, no de esta task. |
| `type: module` en `tests/package.json` | Sí, añadirlo | Los tests usan sintaxis ESM + `import.meta.url` (SEC-08); sin `type:module`, `module:NodeNext` los trata como CJS → TS1470. Vitest ya los ejecuta como ESM; sin riesgo. |
| Roles `ModelRole` inválidos (`"code-review"`) | Mapear a `"coder"` | Rol canónico más cercano (código/auditoría); el router ya trae fallback a `mock-core`, así que el assertion `id === "mock-core"` se preserva. No se toca `packages/models/src`. |
| `DelegationRequest` drift (`task:{...}`, `contextPayload`, sin `projectId`/`input`) | Forma canónica `{projectId, callerEgoId, targetEgoId, task:string, input}` | Copiada de `packages/subegos/test/DelegationRouter.test.ts:95-101` (working example). Detección de ciclos ocurre antes del publish de `input` → añadir `input` no crea side-effects en los tests de ciclo. |
| `syncTurnToDisk({toolCalls})` | Eliminar `toolCalls` | La firma solo acepta `{sessionId, turnIndex, userMessage, assistantResponse, recalledKeys?}`; en runtime el extra se ignora silenciosamente → eliminar alinea tipos con realidad sin cambiar comportamiento. |
| Loops `while (!pendingReq)` infinitos (Variantes C/D) | Acotar con `attempts < 50` + `expect not null` | Patrón probado de la Variante B (única sin errores `never`); además evita hang infinito de suite si la aprobación nunca llega. |
| `activeProviders` / `defaultRoles` en `ModelRouterConfig` | Eliminar (usar `new ModelRouter()`) | La config canónica solo tiene `{preferLocal, maxCostPerCallUsd}`; el constructor ya registra `MockProvider` + bindings por defecto que cubren `reasoning-heavy`/`coder`/`general-chat` con fallback a `mock-core`. |

## Impacto mapeado (Regla 0)

- **Archivos leídos completos:** `tests/e2e/mvp-software-loop.test.ts` (349L), `tests/e2e/tools-execution.test.ts` (486L), `tests/e2e/subegos-delegation.test.ts` (313L), `tests/security/injection-boundaries.test.ts` (546L, parcial 1-60 + resto), `tests/e2e/golden-path-alpha.test.ts` (parcial), `tests/e2e/canvas-interaction.test.ts` (parcial), `tests/chaos/task-crash-resume.test.ts` (parcial), `tests/e2e/golden-path-alpha-full.test.ts` (parcial 1-60 + 240-359).
- **Referencias hacia dentro (tests → paquetes):** `@ego/memory` (clases con `private db` → identidad dual si se mezcla src/dist), `@ego/models` (`ModelRouterConfig`, `ModelRole`), `@ego/tools` (`ToolExecutionContext.callId` requerido), `@ego/execution` (`ExecutionManagerConfig.maxOutputSizeBytes`, `resolveApproval`), `@ego/runtime` (`LoopRunOptions`), `@ego/subegos` (`DelegationRequest`, `delegate`), `@ego/ui-runtime` (`TableColumnSchema`: `type`+`sortable` requeridos en el tipo de salida), `apps/desktop/src/ipc/schema.js` (estable, sin drift).
- **Referencias entrantes:** ninguna (tests son hojas; solo los corre vitest/CI). `pnpm -r typecheck` pasará a incluir `tests` (nuevo script).
- **Veredicto:** blast radius contenido en `tests/` + `tests/package.json`. Prohibidos intactos: `packages/*/src`, `apps/*/src`, `.agents/**`. Dist de paquetes se usa como-esta (solo lectura en typecheck y runtime); NO se reconstruye (evita cambiar el comportamiento bajo test; HIG-02 owning frescura).

## Inventario de errores (tsc ad-hoc NodeNext, 35 líneas `error TS`)

| # | Categoría | Archivos:líneas | Fix |
|---|---|---|---|
| 1 | src-vs-dist `EgoMemoryAdapter` (dual `private db`) | mvp:86,311; subegos:41-44,216-219 | import memory → `dist/index.js` |
| 2 | `activeProviders` ∌ `ModelRouterConfig` | mvp:91; tools:66,293,376 | `new ModelRouter()` |
| 3 | `defaultRoles` ∌ config (implícito en el mismo literal) | mvp:92-95; tools:67-70,294,377-378 | eliminar literal |
| 4 | `"code-review"` ∌ `ModelRole` | mvp:116,203,221 + `defaultRole` L198-203 | `"coder"` |
| 5 | `callId` faltante en `ToolExecutionContext` | mvp:215; tools:135,319,403,454 (+Variante D `requestApproval.context`) | añadir `callId` únicos |
| 6 | `DelegationRequest`: faltan `projectId`+`input`; `task:{...}`; `contextPayload` fantasma | subegos:170-176,268,278,301 | forma canónica |
| 7 | `toolCalls` ∌ `syncTurnToDisk` | mvp:292 | eliminar prop |
| 8 | columnas tabla sin `type`+`sortable` | full:278-280 | `type:"text", sortable:false` |
| 9 | `maxOutputBytes` → `maxOutputSizeBytes` | tools:101 | renombrar |
| 10 | `never` por loops infinitos (`pendingReq!`) | tools:411,475,477 | acotar loops estilo Variante B |
| 11 | `import.meta` en output CJS (TS1470) | security:49 | `"type":"module"` en `tests/package.json` |
| 12 | script `typecheck` ausente + `tsconfig` ausente | `tests/` | crear ambos |

Nota: el plan cita 57; el conteo ad-hoc da 35 líneas `error TS` (los multi-línea de detalle cuentan aparte según cómo se midió). El conteo canónico se fija con `tests/tsconfig.json` (puede sumar `noUnusedLocals/Parameters`).

## Steps de ejecución

- [x] Step 0 (DISCOVERY): inventario + taskfile con Spec/Impacto/Steps/Review
- [x] Step 1: crear `tests/tsconfig.json` + `typecheck` en `tests/package.json` + `type:module` → conteo canónico **36** (35 drift + 2×TS6133 nuevos por `noUnusedLocals`; TS1470 ya resuelto por `type:module`)
- [x] Step 2: fix identidad memory→dist (5 archivos) + roles/config router (mvp, tools)
- [x] Step 3: fix `callId` + `maxOutputSizeBytes` + `syncTurnToDisk` + columnas (+`actions:[]`) + delegaciones + loops acotados + 2×TS6133 (import muerto + línea muerta)
- [x] Step 4: VERIFY typecheck ✅ (`pnpm --filter @ego/e2e-tests typecheck` exit 0); e2e 43/45 — 2 fallos PREEXISTENTES verificados en baseline con stash (misma firma) → FIX_PROPUESTO, no aplicados (regla del owner)
- [ ] Step 5: CIERRE con bloque RESULTADO (sin commit — ego-worker no commitea)

## FIX_PROPUESTO (2 fallos runtime preexistentes — NO aplicar sin owner)

**Firma:** `mvp-software-loop.test.ts:149` y `golden-path-alpha-full.test.ts:136` — `adapter.get("gov/projects", …)` → `undefined` tras `put` exitoso.
**Evidencia de preexistencia:** stash de mis cambios (`git stash push -- tests/...`) + rerun → mismos 2 fallos (2026-10-13).
**Causa raíz (solo lectura de `packages/memory/*`):** `SENSITIVE_NAMESPACE_PREFIXES` incluye `"gov/"` (`SensitiveNamespaces.ts:40`); `gov/projects` no está exento (exentos: `quarantine/*`, `gov/audit*`, `gov/sub_egos*`); `EgoMemoryAdapter.put` enruta namespaces sensibles a `quarantine/pending` (enforcement SEC-09 activo; solo `system/snapshots` diferido) mientras `get` lee solo live → `null`. Patrón consistente: todos los tests que leen namespaces exentos/no-sensibles pasan (43/45).
**Opciones (para HIG-04 o follow-up):** (a) migrar esos 2 tests a `getWithQuarantine` (recomendado si se quiere e2e verde sin tocar producto); (b) eximir `gov/projects` (cambia superficie de seguridad — requiere owner + SEC); (c) aceptar como deuda hasta cierre SEC-09/HIG-04. Prohibido: cambiar namespaces de test para esquivar la cuarentena (enmascara comportamiento del producto).

## Review (self-harness: propose → evaluate → accept)

- Propose: fixes solo en tests, unificando a contratos `dist` ya ejecutados en runtime.
- Evaluate: (a) correctitud — cada fix copia forma canónica verificada en `packages/*/test` o `.d.ts`; (b) simplicidad — sin helpers nuevos, sin cambios de semántica de test; (c) consistencia — respeta guardrails (`packages/*/src` intactos) y convención del archivo más nuevo (`@ego/*`→dist).
- Accept: pendiente de VERIFY mecánico (Step 4).

## Apéndice V (clean-code: mapa de adaptación aplicado)

- Nombres existentes de tests se preservan (legibilidad como especificación; DAMP).
- Sin abstracciones nuevas: cada fix es el cambio mínimo que alinea el test con el contrato vigente (KISS; no se "mejora" nada fuera del error).
- Los loops acotados convierten un hang infinito en fallo rápido con mensaje (fail-fast > hang colgado).
- Deuda declarada, no silenciada: frescura de `dist` → HIG-02; se documenta en RESULTADO, no se esconde.
