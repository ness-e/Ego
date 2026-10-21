# Extracción Técnica: Vibe Kanban (repos-referencia/vibe-kanban) #

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de patrones |
| Repositorio Origen | `repos-referencia/vibe-kanban/` (upstream `BloopAI/vibe-kanban`, commit `d5cbb53`, origen `crates/worktree-manager/src/worktree_manager.rs`) |
| Licencia del origen | Apache-2.0 — BloopAI/vibe-kanban |
| Commit verificado | d5cbb53 |
| Ruta de origen | `crates/worktree-manager/src/worktree_manager.rs` |
| Stack del Origen | Workspace Rust de 30 crates (Tokio + axum/WebSocket + SQLx/SQLite + libgit2 y git CLI) + shell Tauri 2 (`crates/tauri-app/`) + monorepo pnpm con React/TypeScript (`packages/local-web`, `packages/remote-web`, `packages/web-core`) |
| Rol en Ego | Referencia de orquestación multi-agente: worktree por tarea, ciclo de vida de sesiones de agente, bus de eventos derivado de la persistencia, merge/rebase de cambios y reconciliación de estado al arrancar |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Licencia | Apache-2.0 (`repos-referencia/vibe-kanban/LICENSE:1-3`) — compatible con el modelo Apache 2.0 de Ego; no exige atribución de código derivado si no se copia |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia ##

Vibe Kanban resuelve con un enfoque de **"un worktree por tarea y un proceso de agente por worktree"** el
mismo problema que Ego tiene abierto en la Fase 03 (Sub-Egos): aislar el trabajo de N agentes de código
simultáneos y poder integrar, revisar y reconciliar sus cambios sin tocar el árbol vivo del usuario.

Lo transferible no es el producto (un tablero Kanban de tareas de codificación), sino cuatro mecánicas:

1. **Ciclo de vida del worktree por tarea** con semántica `ensure` idempotente, lock por ruta y validación
   del registro en los metadatos git.
2. **Ciclo de vida del proceso de agente**: spawn con timeout de arranque, monitor de salida unificado,
   cancelación en dos fases y kill del grupo de procesos.
3. **Bus de eventos derivado de la persistencia**: los hooks de escritura de la BD emiten parches
   incrementales; el cliente recibe snapshot inicial + deltas.
4. **Integración del cambio del agente**: merge squash con guarda de divergencia y rebase con guardas de
   seguridad.

**Advertencia de divergencia de partida:** el commit inspeccionado (`d5cbb53`, `v0.1.45`) es una evolución
muy posterior al «Tauri + Rust» asumido en el encargo. El repositorio actual es un workspace Rust de
30 crates con servidor HTTP propio, WebSocket, `crates/remote` con ElectricSQL, relay WebRTC y túneles.
El subconjunto instructive para Ego es mucho menor que el repo completo, y una parte sustantiva del
repositorio es infraestructura de nube ajena al alcance *local-first* de Ego.

### Tabla de divergencias ###

| Dimensión | Vibe Kanban | Ego (Cognitive OS) | Decisión |
| --- | --- | --- | --- |
| **Runtime y shell** | Servidor Rust `axum` independiente + shell Tauri 2 (`crates/tauri-app/`) + web React servida por HTTP | Electron 33 (Node 22 en main) + renderer React 19 + IPC tipado (`contextIsolation=true`) | **DESCARTAR** shell Tauri y servidor HTTP propio. Solo se extraen patrones de orquestación; el transporte en Ego es IPC. |
| **Persistencia** | SQLite con SQLx (hooks `update_hook` / `preupdate_hook`) | `NativeVantaDB` napi-rs in-process (Fjall LSM + BM25), `EgoMemoryAdapter` como gateway único | **DESCARTAR** SQLite. El patrón «eventos derivados de hooks» se difiere a VantaDB (VIBE-07). |
| **Orquestación de agentes** | Un proceso CLI externo (Claude Code, Codex, Gemini, OpenCode, Cursor, Copilot…) por tarea tras el trait `StandardCodingAgentExecutor` | Sub-Egos como entidades cognitivas internas; **no existe runner de agente CLI externo** (grep `claude-code\|codex` en `packages/` → 0 hits funcionales) | **EXTRAER PATRÓN** del ciclo de vida (spawn/monitor/kill) como capacidad futura (VIBE-05, VIBE-06). |
| **Aislamiento de código** | `git worktree` por tarea con cleanup en 4 pasos y recreación idempotente | Dos managers de worktree ya escritos: `packages/subegos/src/SubEgoWorktree.ts:139` y `packages/domains/src/engineering/WorktreeManager.ts:161` | **EXTRAER PATRÓN** de `ensure` idempotente + lock por ruta; el barrido de huérfanos ya está cubierto (VIBE-02). |
| **Integración de cambios** | Merge squash con guarda de divergencia + rebase con guardas (`crates/git/src/lib.rs:575`, `:1129`) | Sin merge ni rebase en `packages/` (grep `rebase\|squash\|merge_changes` → 0 hits salvo la regex de `packages/decision/src/IntentClassifier.ts:166`) | **EXTRAER & ADAPTAR** a un servicio Git de Ego (VIBE-03, VIBE-04). |
| **Dominio de producto** | Tablero de tareas de codificación, PRs, workspaces multi-repo, "vibe id" | SOC: chat, canvas dinámico, dominios (Engineering, Product, Knowledge, Analytics, CRM) | **DESCARTAR** el modelo de dominio (`workspace`/`task`/`merge`/`vibe id`), el flujo de PR y el panel Kanban. |
| **Infraestructura de nube** | `crates/remote` (ElectricSQL), `crates/relay-*` (WebRTC, túneles), `crates/remote-web` | Local-first con exportación soberana (principio 9) | **DESCARTAR**: dominio ajeno + contradice el principio 9. |

---

## 2. Inventario Quirúrgico de Patrones a Extraer ##

### Bloque A: Worktree manager por tarea ###

1. **`ensure` idempotente con lock por ruta** —
   `crates/worktree-manager/src/worktree_manager.rs:16-17` (registro global `WORKTREE_CREATION_LOCKS`),
   `:88-116` (`ensure_worktree_exists` adquiere un mutex por ruta antes de tocar el disco),
   `:302-338` (`create_worktree_with_retry` limpia metadatos y reintenta una vez).
   - **Qué hace:** dos tareas que piden worktree sobre el mismo repo no colisionan; si el worktree ya
     está bien formado se reutiliza en lugar de recrearlo.
   - **Adaptación en Ego:** Ego **no serializa** la creación de worktrees.
     `packages/subegos/src/SubEgoWorktree.ts:139-180` hace `worktree remove --force` + `worktree add -B`
     sin mutex, y `packages/domains/src/engineering/WorktreeManager.ts:161-207` tampoco. Verificado además
     que **ningún `createWorktree` tiene caller de producción**: en `apps/` solo se invoca `listWorktrees`
     (`apps/desktop/src/main/ipc/register-ipc.ts:1654`) y `pruneOrphanWorktrees`
     (`apps/desktop/src/main.ts:1271-1277`).
   - **Relación con Backlog Ego:** `SUB-07`, `SUB-08`, `DOM-01`.

2. **Validación en dos niveles (disco + metadatos git)** —
   `crates/worktree-manager/src/worktree_manager.rs:155-183` (`is_worktree_properly_set_up`: existe en
   disco **y** está registrado en `.git/worktrees/*/gitdir`), `:185-227` (`find_worktree_git_internal_name`).
   - **Qué hace:** detecta el caso «directorio huérfano sin registro git», que `git worktree add` rechaza
     con «path already exists».
   - **Adaptación en Ego:** el barrido de huérfanos ya usa `git worktree list --porcelain`
     (`packages/subegos/src/SubEgoWorktree.ts:286-297`), pero la ruta de **creación** no valida el
     registro antes de `add`. Se debe cerrar en el mismo módulo.
   - **Relación con Backlog Ego:** `SUB-07`, `DOM-01`.

3. **Cleanup en 4 pasos + directorio propiedad de la app** —
   `crates/worktree-manager/src/worktree_manager.rs:229-265` (`comprehensive_worktree_cleanup`: desregistrar
   worktree → limpiar metadatos → borrar directorio → `git worktree prune`), `:511-518`
   (`get_worktree_base_dir` usa siempre un subdirectorio propio `.vibe-kanban-workspaces` para no tocar
   carpetas del usuario).
   - **Adaptación en Ego:** la garantía «no tocar carpetas del usuario» ya está implementada de forma
     más estricta por `assertInsideRoot` (`packages/domains/src/engineering/WorktreeManager.ts:91-118`) y
     `validateBranchName` (`:33-62`). Solo falta el cleanup en 4 pasos.
   - **Relación con Backlog Ego:** `SUB-07`, `SEC-05`.

### Bloque B: Ciclo de vida de la sesión de agente ###

1. **Spawn con timeout de arranque + monitor de salida unificado** —
   `crates/local-deployment/src/container.rs:1369-1403` (spawn con timeout de 30 s, registro del hijo en
   el store, `spawn_exit_monitor`), `crates/executors/src/executors/mod.rs:313-339` (`SpawnedChild` con
   `child`, `exit_signal` y `cancel` — señal bidireccional entre executor y contenedor), `:55-64` y
   `:177-200` (capacidades declarativas por agente: `SessionFork`, `SetupHelper`, `ContextUsage`).
   - **Qué hace:** separa «el proceso pidió salir» de «el contenedor quiere cancelar», y distingue fallo
     de arranque de fallo de ejecución.
   - **Adaptación en Ego:** `packages/execution/src/ExecutionManager.ts:131-145` solo aborta
     `AbortController` de tools in-process. No hay runner de proceso externo ni supervisor de grupo de
     procesos (`packages/tools/src/native/terminal/NativeTerminalTool.ts:97` hace `spawn` de shell sin
     supervisor).
   - **Relación con Backlog Ego:** `SUB-03`, `ACT-03`, `TASK-09`.

2. **Cancelación en dos fases y kill de grupo de procesos** —
   `crates/local-deployment/src/container.rs:1405-1477` (`stop_execution`: token de cancelación → espera
   5 s del monitor → `kill_process_group`; después marca el estado en BD y drena el stream),
   `crates/utils/src/process.rs:5-31` (SIGINT → SIGTERM → SIGKILL con 2 s entre señales, y `kill`+`wait`
   final), `crates/local-deployment/src/container.rs:1603-1633` (`kill_all_running_processes` al apagar
   el servidor).
   - **Adaptación en Ego:** mapeo directo a `packages/execution/src/ExecutionManager.ts` +
     `packages/recovery/src/OpGate.ts` (drenaje en cierre), pero con supervisor de grupo de procesos en
     win32 (`taskkill /T /F`), que hoy no existe.
   - **Relación con Backlog Ego:** `ACT-03`, `TASK-09`, `REC-02`.

3. **Puente de aprobación HITL hacia el ejecutor externo** —
   `crates/executors/src/approvals.rs:29-55` (contrato `ExecutorApprovalService`: `create_tool_approval`
   → id inmediato, `wait_tool_approval` bloqueante con `CancellationToken`),
   `crates/services/src/services/approvals/executor_approvals.rs:40-98` (crea la petición, guarda el
   *waiter* y notifica al usuario), `:100-127` (`tokio::select!` entre cancelación y resolución),
   `:130-170` (mapeo de `ApprovalOutcome` a `Approved`/`Denied{reason}`/`TimedOut`/`Answered`).
   - **Qué hace:** el agente externo queda **bloqueado** hasta que el usuario resuelve la aprobación en la
     UI; si se cancela la ejecución, la aprobación se cancela en cascada.
   - **Adaptación en Ego:** el núcleo ya existe en `packages/execution/src/ApprovalEngine.ts:111-340`
     (retención asíncrona de promesas con ACK en el borde, timeout, `abortSignal` y `ActionIdentity`).
     Falta **el adaptador** hacia un runner externo.
   - **Relación con Backlog Ego:** `ACT-06`, `ACT-07`, `INT-05`, `SUB-03`.

### Bloque C: Estado, eventos e integración de cambios ###

1. **Bus de eventos derivado de los hooks de escritura de la BD** —
   `crates/services/src/services/events.rs:59-313` (`create_hook`: `preupdate_hook` para `DELETE` — con
   clave compuesta en `scratch` — y `update_hook` para `INSERT`/`UPDATE`/`DELETE`, que rehidrata la fila y
   publica un parche), `crates/services/src/services/events/streams.rs:16-145` (snapshot inicial +
   `LogMsg::Ready` + stream filtrado por `session_id`), `crates/utils/src/msg_store.rs:13` y `:26-72`
   (broadcast con historia acotada a 100 MB).
   - **Qué hace:** la BD es la **única** fuente de verdad y el bus se deriva de ella; no hay emisiones
     manuales que puedan desincronizarse.
   - **Adaptación en Ego:** `packages/events/src/EventBus.ts:81-89` es un bus **por emisión explícita**;
     grep `json-patch\|applyPatch\|JSONPatch` sobre `packages/` → **0 coincidencias**. El patrón exige
     hooks de escritura que `NativeVantaDB` no expone → depende de evolución upstream de VantaDB.
   - **Relación con Backlog Ego:** `TASK-06`, `TASK-01`, `CANV-03`.

2. **Reconciliación de estado persistido vs. runtime al arrancar** —
   `crates/services/src/services/container.rs:273-326` (`cleanup_orphan_executions`: marca `Failed` todo
   proceso que la BD decía `Running` y captura el `after_head_commit` real antes de cerrar), `:333-378`
   (`backfill_before_head_commits`), `crates/server/src/startup.rs:155-171` (invocación en
   `initialize_deployment`).
   - **Qué hace:** al arrancar, la realidad del disco (HEAD real del repo) reconcilia el estado
     persistido; ningún proceso queda fantasma en `Running`.
   - **Adaptación en Ego:** `packages/recovery/src/CrashRecoveryEngine.ts:18-226` detecta *dirty shutdown*
     por heartbeat y libera locks, pero no reconcilia tareas en vuelo contra el estado persistido;
     `packages/tasks/src/TaskCheckpoint.ts:28-65` guarda checkpoints sin barrido de tareas «en vuelo»
     huérfanas.
   - **Relación con Backlog Ego:** `TASK-01`, `TASK-03`, `REC-01`, `REC-08`.

3. **Merge squash con guarda de divergencia y ref de continuidad** —
   `crates/git/src/lib.rs:575-673` (`merge_changes`): guarda de divergencia en `:589-596` (bloquea el
   merge si la rama base avanzó), ruta CLI con `merge_squash_commit` + `update-ref` de la rama de tarea al
   SHA del squash en `:617-638`, y ruta **libgit2 en memoria sin checkout** cuando la rama base no está
   checkouteada en `:640-671`. Orquestación HTTP en
   `crates/server/src/routes/workspaces/git.rs:179-266` (rechaza si hay PR abierto `:195-203` o si el
   destino es remoto `:205-213`).
   - **Qué hace:** el `update-ref` de continuidad es la pieza más valiosa: tras el squash, la rama de la
     tarea se mueve al commit fusionado para que el trabajo siguiente continúe sin conflictos.
   - **Adaptación en Ego:** `packages/subegos/src/SubEgoWorktree.ts:249-258` preserva el worktree «para
     revisión HITL» cuando hay commits o cambios, pero **no integra nada** y no existe servicio de merge
     en `packages/`.
   - **Relación con Backlog Ego:** `DOM-01`, `SUB-08`, `SEC-05`.

4. **Rebase con guardas de seguridad y error accionable** —
   `crates/git/src/lib.rs:1129-1223` (`rebase_branch`): nunca opera sobre un worktree sucio (`:1143`),
   **rechaza** si ya hay un rebase en curso en lugar de abortarlo (`:1148-1150`), y traduce el conflicto
   de la CLI a `MergeConflicts` con la rama intentada y la lista de ficheros (`:1169-1206`). Además
   `reconcile_worktree_to_commit` (`:892-929`) evalúa si un reset es necesario antes de aplicarlo.
   - **Adaptación en Ego:** sin rebase en `packages/`; reutilizaría `validateBranchName` /
     `assertInsideRoot` de `packages/domains/src/engineering/WorktreeManager.ts:33-118` como fail-closed
     de entrada.
   - **Relación con Backlog Ego:** `DOM-01`, `SUB-08`.

---

## 3. Matriz de Extracción vs Descarte ##

| Componente Vibe Kanban | Acción en Ego | Razón Técnica / Arquitectónica |
| --- | :---: | --- |
| `crates/worktree-manager/src/worktree_manager.rs` (ensure + lock + metadatos) | **EXTRAER PATRÓN** | Semántica idempotente y serialización por ruta; `createWorktree` no tiene caller de producción en Ego. |
| `crates/worktree-manager/` + `crates/workspace-manager/` (barrido de huérfanos) | **DESCARTAR** | Sustituido por `SubEgoWorktreeManager.pruneOrphanWorktrees` (`packages/subegos/src/SubEgoWorktree.ts:270-336`), ya en producción y más conservador. |
| `crates/executors/src/executors/mod.rs` (spawn/monitor/kill, capacidades) | **EXTRAER PATRÓN** | Ciclo de vida de sesión de agente reutilizable sobre el `ExecutionManager` de Ego. |
| `crates/executors/src/approvals.rs` + `crates/services/src/services/approvals/` | **EXTRAER PATRÓN** | Adaptador HITL hacia ejecutor externo; el núcleo ya está en `packages/execution/src/ApprovalEngine.ts`. |
| `crates/git/src/lib.rs` (`merge_changes`, `rebase_branch`, `reconcile_worktree_to_commit`) | **EXTRAER & ADAPTAR** | Integración de cambios por Sub-Ego; hoy inexistente en Ego y de alto valor para `DOM-01`. |
| `crates/services/src/services/events.rs` + `events/streams.rs` | **EXTRAER PATRÓN (diferido)** | Requiere hooks de escritura en el sustrato; no disponibles en `NativeVantaDB` → evolución upstream. |
| `crates/services/src/services/container.rs` (reconciliación de huérfanos) | **EXTRAER PATRÓN** | Reconciliación persistido ↔ runtime al arrancar; aplicable a `BackgroundEngine` + `TaskCheckpoint`. |
| `crates/tauri-app/` + `packages/local-web/` + `packages/web-core/` | **DESCARTAR** | Ego es Electron + React 19 con IPC tipado; prohibido replicar shell Tauri. |
| `crates/db/` (SQLx/SQLite) + `crates/server/` (axum) | **DESCARTAR** | VantaDB es el sustrato soberano; el servidor HTTP propio no aplica a un desktop local-first. |
| `crates/review/`, `crates/git-host/` (Azure/GitHub), `crates/db/src/models/pull_request.rs` | **DESCARTAR** | Dominio ajeno: revisión de PRs de terceros y flujo de pull requests. Ego ya tiene el conector MCP oficial de GitHub (`DOM-07`). |
| `crates/remote/`, `crates/relay-*`, `crates/remote-web/`, `crates/deployment/` | **DESCARTAR** | Infraestructura cloud (ElectricSQL, WebRTC, túneles) ajena al alcance local-first (principio 9). |
| `crates/services/src/services/queued_message.rs`, `crates/services/src/services/pr_monitor.rs`, `crates/executors/src/executors/qa_mock.rs` | **DESCARTAR** | Cola en memoria de un follow-up por sesión (sin persistencia ni backlog), monitor de PRs y mock de QA: sin encaje en el SOC. |

---

## 4. Estado real verificado (2026-10-20) ##

> Fuente canónica del estado por tarea: [`docs/review/backlog-vibe-kanban.md`](../review/backlog-vibe-kanban.md).
> Criterio de cierre: fichero adaptado **y** caller en producción (grep sobre `packages/` + `apps/desktop/`,
> excluyendo `test/`, `dist/`, `node_modules/`).

| ID | Patrón | Estado | Evidencia / Fundamento |
| --- | --- | :---: | --- |
| `VIBE-01` | `ensure` idempotente de worktree con lock por ruta y validación en metadatos git | 🆕 Pendiente | `packages/subegos/src/SubEgoWorktree.ts:139-180` y `packages/domains/src/engineering/WorktreeManager.ts:161-207` no serializan ni validan el registro git; verificado que **ningún `createWorktree` tiene caller de producción** (`apps/desktop/src/main/ipc/register-ipc.ts:1654` solo llama `listWorktrees`; `apps/desktop/src/main.ts:1271-1277` solo llama `pruneOrphanWorktrees`). Cableado: `ensureWorktree()` con mutex por ruta + registro IPC con `ApprovalEngine` (owner DOM-01/SUB-07). |
| `VIBE-02` | Barrido de worktrees y workspaces huérfanos | 🚫 Descartada (con justificación) | Sustituido por módulo canónico de Ego: `SubEgoWorktreeManager.pruneOrphanWorktrees` (`packages/subegos/src/SubEgoWorktree.ts:270-336`), con caller de producción verificado en `apps/desktop/src/main.ts:1271-1277`. Su política es más conservadora que la de Vibe (ante fallo de inspección no poda: `inspectionFailed: true`). |
| `VIBE-03` | Merge squash con guarda de divergencia y `update-ref` de continuidad | 🆕 Pendiente | No existe merge en `packages/` (grep `rebase\|squash\|merge_changes` → 0 hits salvo `packages/decision/src/IntentClassifier.ts:166`). Cableado: `packages/domains/src/engineering/GitMergeService.ts` con `mergeSquash()` reusando `validateBranchName`/`assertInsideRoot` (`packages/domains/src/engineering/WorktreeManager.ts:33-118`), invocado desde `finalizeWorktree` solo tras aprobación HITL (owner DOM-01/SEC-05). |
| `VIBE-04` | Rebase con guardas (worktree limpio, rebase en curso, conflicto accionable) | 🆕 Pendiente | Sin rebase en `packages/`. Cableado: mismo módulo que `VIBE-03`, método `rebaseOnto()` con refusal explícita si hay rebase en curso (nunca `abort`) y error tipado `MergeConflicts` con lista de ficheros (owner DOM-01). Depende de `VIBE-03`. |
| `VIBE-05` | Ciclo de vida del proceso de agente: spawn con timeout, monitor de salida, cancelación en dos fases, kill de grupo | 🆕 Pendiente | Ego solo aborta tools in-process (`packages/execution/src/ExecutionManager.ts:131-145`); no hay runner de agente externo ni supervisor de grupo (`packages/tools/src/native/terminal/NativeTerminalTool.ts:97` hace `spawn` sin supervisor). Cableado: `packages/execution/src/AgentProcessRunner.ts` con `spawn/await/kill` + kill de árbol en win32; invocar desde `packages/subegos/src/SubEgoRuntime.ts` (owner SUB-03). |
| `VIBE-06` | Puente de aprobación HITL hacia el ejecutor externo (create → espera bloqueante con cancelación) | 🆕 Pendiente | El núcleo ya existe (`packages/execution/src/ApprovalEngine.ts:111-340`: ACK en el borde, timeout, `abortSignal`, `ActionIdentity`); falta el **adaptador** al runner. Cableado: `packages/execution/src/AgentApprovalBridge.ts` sobre `ApprovalEngine`, invocado por `AgentProcessRunner` (owner SUB-03). Depende de `VIBE-05`. |
| `VIBE-07` | Bus de eventos derivado de hooks de escritura (snapshot inicial + parches) | ⏳ Futura (Fase 07, P1) | `packages/events/src/EventBus.ts:81-89` es de emisión explícita y grep `json-patch\|applyPatch\|JSONPatch` sobre `packages/` → 0 coincidencias. El patrón exige **hooks de escritura** en el sustrato: `NativeVantaDB` (napi-rs) no los expone → requiere evolución upstream de VantaDB en `docs/engineering/vantadb-readiness-plan.md` (nuevo `VDB-REQ-*`). Fase destino: Fase 07 (Tasks), P1. Alternativa degradada sin hooks: derivar el stream del log de auditoría ya existente (`packages/memory/EgoMemoryAdapter.ts:1321,1340` → `gov/audit`; `packages/knowledge/src/FactLifecycle.ts:308` → `kb/audit`). |
| `VIBE-08` | Reconciliación de estado persistido vs. runtime al arrancar | 🆕 Pendiente | `packages/recovery/src/CrashRecoveryEngine.ts:18-226` detecta *dirty shutdown* y libera locks, pero no reconcilia tareas «en vuelo» contra el estado persistido; `packages/tasks/src/TaskCheckpoint.ts:28-65` guarda checkpoints sin barrido de huérfanos. Cableado: al arrancar `packages/tasks/src/BackgroundEngine.ts`, marcar `failed` las tareas con checkpoint sin cierre y purgar worktrees cuyo Sub-Ego ya no existe (owner TASK-01/REC-01). |

**Recuento:** 0 `✅ Completada` · 1 `🚫 Descartada` · 6 `🆕 Pendiente` · 1 `⏳ Futura` — **8 tareas**.

---

## 5. Descarte normalizado a la forma canónica ##

Las filas de la matriz §3 se normalizan aquí a `🚫 Descartada (con justificación)` (AGENTS.md §4)
conservando el motivo original:

| Componente Vibe Kanban | Veredicto | Fundamento |
| --- | :---: | --- |
| `crates/tauri-app/` + `packages/local-web/` + `packages/web-core/` | 🚫 **Descartada (con justificación)** | Ego es Electron 33 + React 19 con IPC tipado y `contextIsolation=true` (`AGENTS.md` §1, §2). Replicar un shell Tauri ni su bundle web aporta nada y duplicaría el runtime de UI. |
| `crates/db/` (SQLx/SQLite) + `crates/server/` (axum + WebSocket) | 🚫 **Descartada (con justificación)** | VantaDB 0.8.0 (`NativeVantaDB` in-process) es el sustrato soberano y el acceso pasa obligatoriamente por `EgoMemoryAdapter` (`AGENTS.md` §4). Un servidor HTTP/WS propio duplicaría el bus de eventos y el transporte IPC ya tipados. |
| `crates/review/`, `crates/git-host/` (Azure DevOps + GitHub), `crates/db/src/models/pull_request.rs` | 🚫 **Descartada (con justificación)** | Contaminación de dominio: revisión de PRs de terceros y ciclo de pull requests no pertenecen al alcance de un SOC. Ego ya cubre GitHub con el conector MCP oficial (`DOM-07`), que es el nivel de integración canónico. |
| `crates/remote/`, `crates/relay-*` (WebRTC, túneles), `crates/remote-web/`, `crates/deployment/` | 🚫 **Descartada (con justificación)** | Infraestructura cloud (ElectricSQL, relays, túneles) incompatible con el principio 9 (local-first y propiedad/exportación de datos) y con el modelo de negocio local-first de Ego (`AGENTS.md` §8). |
| `crates/services/src/services/queued_message.rs` | 🚫 **Descartada (con justificación)** | Cola en memoria (`DashMap`) de **un** follow-up por sesión, sin persistencia ni backlog ni métricas. La concurrencia y el control de carga de Ego ya viven en `packages/tasks/src/WorkerTaskPool.ts:78-108` y `packages/tasks/src/ResourceScheduler.ts`. |
| `crates/services/src/services/pr_monitor.rs` | 🚫 **Descartada (con justificación)** | Monitor de pull requests: dominio ajeno (ver fila anterior). |
| `crates/executors/src/executors/qa_mock.rs` | 🚫 **Descartada (con justificación)** | Mock de QA para pruebas end-to-end: artefacto de testing del upstream, sin valor de runtime para Ego. |
| `crates/services/src/services/diff_stream.rs` (stream de diffs con watcher de filesystem) | 🚫 **Descartada (con justificación)** | Solapa con la capacidad ya planificada de Canvas y diff en `packages/ui-runtime/` y con `packages/tools/native/` (git status/diff). Reimplementarlo sería sobreingeniería sin consumidor canónico. |
