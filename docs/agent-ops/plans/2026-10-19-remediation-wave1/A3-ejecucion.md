# Plan A3 — Capas de ejecución y producto: tools, sub-egos, tasks, dominios, daily state, recovery, ui-runtime, integrations

**Agente:** A3 (sesión `ses_eaa0dfc60ffecReAfnctmVnrWQ`) · **Persona:** `.opencode/agents/ego-worker.md`
**Zona exclusiva:** `packages/tools/**`, `packages/subegos/**`, `packages/tasks/**`, `packages/domains/**`, `packages/dailystate/**`, `packages/recovery/**`, `packages/ui-runtime/**`, `packages/integrations/**`
**Prohibido:** `apps/**`, `docs/**`, `.github/**`, y `packages/{memory,knowledge,runtime,models,decision,execution,events,security,tool-call-repair,avatar}/**`

## Objetivo

Que las capacidades que la arquitectura declara **existan y estén en producción**. Hoy: solo 6 tools reales frente a 20+ declaradas, la delegación y la proactividad son código muerto, Ego no implementa MCP Server, y el workspace dinámico está hardcodeado.

## Tareas

### T1 — Cablear la delegación de Sub-Egos (`EGO-FIND-22`) — **CRÍTICO**
`registerDelegationTools` (`packages/subegos/src/DelegationTools.ts:330`) solo se invoca en tests; `new DelegationRouter` → **0** en `apps/desktop/src`.
- **Tu trabajo (paquete)**: revisa `DelegationRouter` (1 077 líneas, god file) y `SharedMemory` (998 líneas) y **extiéndelos con lo que falta para ser cableables**: un factory/punto de entrada único (`createDelegationRuntime(deps)`) que construya router + registry + shared memory y registre las 6 tools en el `ToolRegistry`. Test de integración **dentro del paquete** que ejercite el ciclo completo delegar→ejecutar→devolver, **sin** depender de `apps/desktop`.
- **Handoff a A4**: diff exacto para instanciar `createDelegationRuntime(...)` en `main.ts` y registrar las tools.
- **Bonus si es seguro**: extrae `DelegationCore` + `DelegationPolicy` + `DelegationFanout` de `DelegationRouter.ts` para bajar el god file. **Solo si los tests siguen verdes sin cambiar el comportamiento.**

### T2 — Proactividad con triggers reales (`EGO-FIND-51`)
`ProactivityEngine` se instancia en `main.ts:3175` pero **no hay ni un `registerCronTrigger`/`registerWatchTrigger`** en `apps/desktop/src`.
- **Tu trabajo (paquete)**: implementa y **testea** el disparador de file-watch (`fs.watch` con debounce) y la resolución de cron dentro de `packages/tasks/src/ProactivityEngine.ts`, con cleaned-up de listeners.
- **Handoff a A4**: diff para enganchar los triggers en `main.ts` (cron desde `ResourceScheduler` + `fs.watch` sobre el workspace).

### T3 — Terminal: allowlist real y env saneado (`EGO-FIND-32`, `EGO-FIND-33`) — **SEGURIDAD**
`packages/tools/src/native/terminal/NativeTerminalTool.ts`:
- La ruta del agente usa **solo denylist de 6 regex** (`:10-17,51-57`); la allowlist `TERMINAL_SAFE_COMMANDS` (`apps/desktop/src/main.ts:5194`) solo gobierna el panel interactivo.
- **Bypass trivial**: `rm -fr /` (el regex exige `-rf`), `Remove-Item -Recurse -Force C:\`, `cmd /c del /s /q`, `powershell -enc`.
- `env: { ...process.env }` (`:75`) inyecta **el entorno completo** (tokens, rutas, credenciales de sesión) al subproceso PowerShell.
- **Tu trabajo**: (a) aplica la allowlist también en `NativeTerminalTool`, normalizando el head del comando y parseando la invocación de PowerShell (no por substring); (b) construye un `env` allowlist explícito (`PATH`, `SystemRoot`, `TEMP`, `HOME` + prefijo `EGO_*`); (c) deja explícito que **toda** la ejecución pasa por `evaluateToolCall`/HITL (ya documentado en `main.ts:5182`).
- **Handoff a A4**: el módulo de allowlist vive en `apps/desktop/src/main/terminal-policy.ts` (**zona de A4**) → pídele que exporte `TERMINAL_SAFE_COMMANDS`/`GIT_SAFE_SUBCOMMANDS` a un sitio compartible, o propón una copia en `packages/tools` (tú puedes crearla en tu zona) y coordina en el handoff.
- Tests de regresión con los 4 bypasses de arriba.
- **Mismo tratamiento** para `packages/integrations/src/mcp/McpClient.ts:347` (`env: { ...process.env, ...env }`): el **token real** viaja al subproceso MCP.
  **Decisión del owner (D2): marcador + resolución en el cliente MCP.** El subproceso recibe `EGO_SECRET_<NOMBRE>={{SECRET:<clave>}}` en vez del valor real; el **cliente MCP** (en el proceso main, con acceso al keychain vía `CredentialManager`) resuelve el marcador en la petición saliente → el servidor MCP **nunca ve el token**.
  - **Excepción admitida y registrada**: los servidores que exigen el token en la env **al arrancar** (health-check) conservan la env real; **lisálos explícitamente** en tu handoff y en el informe.
  - Test: el `env` que recibe el subproceso **no contiene** ningún valor de secreto en claro; el marcador llega al cliente y se resuelve en la petición.

### T4 — MCP Server de Ego (`EGO-FIND-46`) — **CUMPLE `AGENTS.md` §7**
Ego **no implementa servidor MCP**: 0 handlers `tools/list`, `resources/list`, `prompts/list`.
- Implementa en `packages/integrations/src/mcp/` un servidor stdio (y/o streamable-http) que exponga:
  - `tools/list` desde `ToolRegistry.list()`
  - `resources/list` sobre `PayloadRegistry` (de `packages/ui-runtime`) + namespaces de memoria
  - `prompts/list` sobre los manifiestos de Sub-Ego
- Verificable: test que arranca el servidor y lista al menos las 6 tools reales, 1 resource y 1 prompt.
- **Handoff a A4**: diff para registrar el arranque del servidor MCP en `main.ts` (probablemente como proceso hijo stdio).

### T5 — Catálogo de tools: eliminar los fantasma (`EGO-FIND-45`)
`packages/domains/src/DomainRegistry.ts:42-180` y `packages/domains/src/templates/officialSubEgoTemplates.ts:33-246` declaran 20+ nombres de tool **que no existen** (`filesystem_read`, `worktree_manage`, `knowledge_search`, `graph_rag_query`, `document_parse`, `memory_recall`, `product_*`, `analytics_*`, `crm_*`, `propose_draft`…). Solo 6 tools existen en producción.
- **Tu trabajo**: (a) **migra los nombres** a los reales (`fs_read_file`, `fs_write_file`, `git_status`, `git_diff`, `terminal_exec`, `canvas_render`) o **elimina** los que no correspondan; (b) añade un **validador de contrato** `assertToolsExist(declared, registry)` que se ejecute en `SubEgoRegistry.register` y `DomainRegistry.registerDomain`; (c) test de contrato que recorra todos los manifiestos y dominios y falle si un tool declarado no existe.
- Si un tool declarado **debería** existir pero no está implementado (ej. `memory_recall`, `graph_rag_query`), **no lo inventes**: quítalo del manifiesto y anótalo en el handoff como capacidad pendiente (A2 es quien podría implementarla).

### T6 — `manage_background_task` (`EGO-FIND-50`)
`BackgroundEngine.submit/cancel/pause/resume/listTasks` es API in-process sin tool ni IPC. **Añade la tool** `manage_background_task` (create/list/get/cancel/pause/resume) respaldada por `BackgroundEngine` + `TaskCheckpointManager` + la `approvalPolicy` existente, con `requiresApproval` según la política (cancelar/destruir → sensible).
- Verificable: test que lanza una tarea en background vía la tool, la lista, la pausa y la cancela.

### T7 — Herramientas FS avanzadas + circuit breaker (`A3-12`, `A3-13`)
- Añade `fs_read_file` con `offset`/`limit`/tope de bytes (hoy lee el archivo **entero** sin tope y el truncado ocurre *después* en `ExecutionManager`), `fs_glob`, `fs_grep` y `fs_edit_patch` con dry-run.
- **Circuit breaker** por tool MCP (un tool colgado no debe consumir un slot cada 30 s indefinidamente) y **quota de llamadas por Sub-Ego** en la capa de ejecución.

### T8 — UI Runtime: registry dinámico y workspace real (`EGO-FIND-47`, `EGO-FIND-48`)
- `apps/desktop/renderer/components/canvas/registry.ts:49-61` es un `Record` estático de 11 tipos → **tu zona es `packages/ui-runtime/`**, no el renderer. Tu parte: **extender `packages/ui-runtime`** con un registro dinámico (`registerComponent`/`unregisterComponent`, tipo extensible) y **eliminar el `componentKind` muerto** desde el lado del paquete (el `DomainView.componentKind` de 15 vistas se resuelve contra el registry).
- **Handoff a A4**: el diff para migrar `canvas/registry.ts` a `Map` + registrar los 11 tipos, y para eliminar las **10 ramas `domainId === "..."`** de `DomainCanvasView.tsx` (A4 es dueño del renderer).
- `packages/ui-runtime/src/PayloadRef.ts:163-168`: eviction **FIFO** pero el comentario dice LRU → corrige a LRU real (reordena en acceso) y usa `crypto.subtle` en vez del SHA-256 reimplementado a mano (`:1-94`).

### T9 — Daily State honesto (`EGO-FIND-52`)
`packages/dailystate/src/DailyStateEngine.ts:44-45,75,213`: `decisionsCount` = longitud de una página de 50 (no del namespace); `recentDecisions` = top-10 *después* de ordenar el primer lote (no son las 10 más recientes reales); 5 `catch {}` silenciosos convierten un fallo de lectura en "0 aprobaciones".
- Itera con `listPaged` hasta agotar; expon `partial: boolean` y `sourcesUnavailable: string[]` en el `DailyStateSummary`; **nunca** presentes 0 aprobaciones si la lectura falló.

### T10 — DreamConsolidator robusto (`EGO-FIND-22` parcial)
`packages/tasks/src/DreamConsolidator.ts:125` — `JSON.parse(fact.payload)` **sin try/catch dentro del bucle**: un payload corrupto aborta el lote y el `catch {}` externo (`:156`) lo silencia → dedup parcial e invisible. Además `seenSignatures` se reinicia por ciclo, dejando `is_latest:true` obsoleto en facts previos.
- Envuelve el parseo por registro; reporta `truncated` y `parseErrors` en las estadísticas; haz el dedup persistente (o por `metadata.state`).

### T11 — Recovery: escritura atómica y async (`EGO-FIND-66` parcial)
`packages/recovery/src/CrashRecoveryEngine.ts:205-216` — el heartbeat SÍ es atómico (tmp+fsync+rename, ✅ commit `b411524`), pero `writeLockFile` (`:215`) sigue con `fs.writeFileSync` **no atómico** → un kill en ese instante deja `ego.lock` truncado. **Usa la misma secuencia tmp+fsync+rename.**
- Migra las **53 llamadas sync** de `packages/recovery/src` a `fs/promises` (`SnapshotManager`, `SchemaMigrator`, `ProjectImport`, etc.).
- `packages/tools/src/native/fs/PathValidator.ts:70-79`: TOCTOU residual (`existsSync`+`realpathSync` **sync**, y el symlink solo se comprueba si el destino ya existe) → `fs.promises.realpath` del **directorio padre** y abrir con `O_NOFOLLOW` (POSIX).

### T12 — `SubEgoRegistry` desde el renderer (hacia A4) (`EGO-FIND-53`)
`apps/desktop/renderer/components/sub-egos.tsx:108-144` escribe directo en memoria para editar/borrar Sub-Egos, saltándose la validación del main. El renderer es de A4 → **hándalo a A4** con el diff de `ipc.subegos.update` / `ipc.subegos.delete` que debe exponer A4, usando `SubEgoRegistry.register` de tu zona como única vía de validación.

### T13 — NetPolicy unificada (`A5-09`)
`packages/tools/src/native/security/NetPolicy.ts` **no tiene callers**; la política viva es una *"réplica léxica"* en `packages/security/src/ToolPermissions.ts:147,346` (que es zona de **A2**, sin DNS). Tu zona es `packages/tools/`. **Unifica en `packages/tools/src/native/security/NetPolicy.ts`** (con resolución DNS) y **hándalo a A2** para que `packages/security/ToolPermissions.ts` delegue en él o elimine la réplica. Si la dependencia va en la dirección contraria, propón la tuya como canónica en el handoff.

## DoD específico

- `pnpm --filter @ego/{tools,subegos,tasks,domains,dailystate,recovery,ui-runtime,integrations} test` → 0 regresiones (678 tests hoy).
- `pnpm -r typecheck` → exit 0.
- 0 sync I/O en paths de IPC de tu zona.
- 0 `catch {}` vacío sin log (13 en producción; los de tu zona están cubiertos).
- Cada bypass de terminal tiene un test rojo demostrado.

## Handoff

`docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A3.md`
Incluye: diffs para `main.ts` (delegación, proactividad, MCP server), diff para el renderer (`registry.ts`, `DomainCanvasView.tsx`, `sub-egos.tsx`), y la propuesta de unificación de NetPolicy para A2.
