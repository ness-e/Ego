# Extracción Técnica: Cline (repos-referencia/cline) #

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de patrones |
| Repositorio Origen | `repos-referencia/cline/` (Commit verificado: `ca7402c`, rama `main`, profundidad 1) |
| Stack del Origen | Monorepo TypeScript (Bun 1.4.2) · SDK con paquetes `@cline/shared` / `@cline/llms` / `@cline/agents` / `@cline/core` · extensión VS Code (webview React + gRPC/proto) · CLI headless (Commander) · daemon `cline-hub` |
| Rol en Ego | Motor de agente, snapshots de workspace, política de aprobación y guardas de seguridad del runtime |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Licencia | Apache-2.0 (`repos-referencia/cline/LICENSE:1-2`) — exige atribución en código derivado |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia ##

Cline es un agente de código autónomo con tres hospederos sobre un **único SDK**: extensión VS Code, CLI
headless y daemon local compartido. Su valor para Ego no está en la interfaz (webview React de VS Code, TUI,
dashboard web), sino en **cuatro transversales del runtime** que el Cognitive Runtime de Ego todavía no tiene:

1. **Snapshot restorable del working tree** mediante refs privados de Git, con captura de archivos no
   rastreados vía tercer padre de `stash`
   (`sdk/packages/core/src/hooks/checkpoint-hooks.ts:497-709`).
2. **Guardas de seguridad del bucle de herramientas**: detección de llamadas idénticas repetidas con umbrales
   *soft/hard* y firma canónica de argumentos
   (`sdk/packages/core/src/runtime/safety/loop-detection.ts:50-87`), más un tracker de errores consecutivos con
   decisión de recuperación (`sdk/packages/core/src/runtime/safety/mistake-tracker.ts:80-159`).
3. **Caché de resultados de herramienta con URI de recuperación** para no duplicar salidas grandes en el prompt
   (`sdk/packages/core/src/session/services/tool-result-cache.ts:17-98`).
4. **Proyección de presupuesto de compactación** con ledger auditable de qué se recortó y por qué
   (`sdk/packages/core/src/extensions/context/budget-projection/types.ts:1-90`).

Cline aporta además dos patrones de *fail-closed* que refuerzan el principio 6 de Ego: la aprobación **deniega**
cuando no hay callback configurado (`sdk/packages/agents/src/agent-runtime.ts:2509-2514`) y el rechazo del usuario
se devuelve al modelo con un discriminante explícito que lo separa de un fallo de herramienta
(`sdk/packages/shared/src/llms/tools.ts:95-105`).

### Divergencias Fundamentales (Qué Descartamos y Por Qué) ###

| Dimensión | Cline | Ego (Cognitive OS) | Decisión Crítica |
| --- | --- | --- | --- |
| **Hospedero / UI** | Extensión VS Code con webview React, `contextBridge` y gRPC/proto (`apps/vscode/webview-ui/`, `apps/vscode/proto/`). | Electron 33 + React 19 propio, preload con IPC tipado y `contextIsolation=true` (`AGENTS.md` §1-2). | **DESCARTAR** la capa de presentación de la extensión. Portar el webview duplicaría el Chat de Ego y arrastraría el contrato gRPC/proto, incompatible con el IPC tipado canónico. Solo se extraen los patrones de motor. |
| **Topología de proceso** | Daemon compartido por máquina (`sdk/packages/core/src/hub/daemon/`) al que se enganchan CLI, extensión y escritorio por WebSocket. | Runtime in-process en el proceso Main de Electron (`AGENTS.md` §2). | **DESCARTAR** el daemon: un segundo proceso residente contradice el principio 9 (local-first) y añade un ciclo de vida distribuido que Ego no necesita. |
| **Identidad / monetización** | Cuenta Cline, créditos, organizaciones y facturación (`sdk/packages/core/src/account/cline-account-service.ts`, `apps/cline-hub/`). | Modelo open source Apache-2.0 + servicios Cloud/Sync/AI Credits propios (`AGENTS.md` §8). | **DESCARTAR** por contaminación de dominio (`AGENTS.md` §4): credenciales, créditos y organizaciones externas no pertenecen al dominio de un SOC local-first. |
| **Persistencia del workspace** | Snapshots en refs de Git del repositorio del usuario (`refs/cline/checkpoints/<sessionId>/<runCount>`), índice Git privado en el data dir del usuario. | VantaDB como sustrato único de memoria (`AGENTS.md` §4, prohibiciones). | **ADAPTAR**: la captura del working tree es un artefacto de filesystem, no un registro de memoria; vive en Git, pero su *metadato* (índice de checkpoints) se persiste en VantaDB (`system/checkpoints`). |

---

## 2. Inventario Quirúrgico de Patrones a Extraer ##

### Bloque A: Snapshot y reversión del workspace (motor de checkpoints) ###

*Ubicación en fuente:* `repos-referencia/cline/sdk/packages/core/src/hooks/checkpoint-hooks.ts`

1. **`createCheckpointHooks` (`:497-709`)**
   - **Qué hace:** engancha un hook `beforeModel` que crea un snapshot restorable al inicio de cada *run raíz* y
     lo registra en los metadatos de sesión como `checkpoint.latest` + `checkpoint.history` (`:699-706`). Distingue
     el caso "nuevo turno de usuario" (`introducedUserRun`) del "run ya checkpointado" (`alreadyCheckpointed`,
     leído del historial durable) para **no sobrescribir** el snapshot previo con un workspace ya mutado
     (`:686-691`).
   - **Adaptación en Ego:** `packages/tasks/src/WorkspaceCheckpoint.ts` (nuevo), invocado desde el
     `BackgroundEngine` como hook previo al stream del modelo. Solo aplica a runs raíz de Sub-Egos con `cwd` de
     workspace. La degradación se hace observable con un `EgoEvent` `task.checkpoint` de
     `outcome ∈ {stash, head_clean, head_fallback, skipped}` y `durationMs`, **nunca** con rutas de archivo ni
     contenidos (`:550-568`).
   - **Relación con Backlog Ego:** `TASK-03`, `REC-05`, `DOM-01`, `ACT-05`, `SEC-06`, `DEC-08`.

2. **Captura de archivos no rastreados con tercer padre (`createUntrackedParentCommit`, `:249-338`)**
   - **Qué hace:** `git stash create` no guarda archivos *untracked*. Cline construye un commit con árbol propio
     (`write-tree` + `commit-tree`, `:327-336`) y lo engarza como **tercer padre** del commit de stash, de modo que
     el restore puede rebobinar también lo que el agente creó. Para evitar re-hashear todo el workspace en cada
     turno, persiste un `GIT_INDEX_FILE` privado por sesión y fuerza `core.ignorestat=false` /
     `core.splitIndex=false` (`:179-201`) para que el *stat cache* de Git no falsifique la detección de cambios.
   - **Adaptación en Ego:** mismo algoritmo sobre `execFile("git", ...)`; el índice privado se guarda en
     `userData/checkpoint-scratch/<hash(cwd+sessionId)>` con modo `0700` (`:264`).
   - **Relación con Backlog Ego:** `TASK-03`, `SEC-05`, `DOM-01`.

3. **Aislamiento de refs y limpieza (`deleteCheckpointRefs` `:437-463`, `retainCheckpointRefs` `:465-480`)**
   - **Qué hace:** los snapshots se guardan bajo `refs/cline/checkpoints/<sessionId>/<runCount>` (`:630`), un
     namespace **privado** que no aparece en `git stash list` pero mantiene los objetos alcanzables y a prueba de
     GC; la eliminación borra esas refs y el scratch dir. **Adaptación en Ego:** namespace
     `refs/ego/checkpoints/<sessionId>/<runCount>` y persistencia de la lista de refs vivas en VantaDB
     (`system/checkpoints`) para purgar al cerrar la sesión.
   - **Relación con Backlog Ego:** `SEC-06`, `REC-02`.

4. **Telemetría de degradación del snapshot**
   - **Qué hace:** emite `checkpoint.snapshot` con `outcome ∈ {stash, head_clean, head_fallback, skipped}` y
     `durationMs`; **nunca** rutas de archivo ni contenidos. `head_clean` no es degradación (árbol limpio) sino
     el resultado normal; `head_fallback` sí lo es.
   - **Relación con Backlog Ego:** `ACT-05`, `SEC-06`, `DEC-08`.

### Bloque B: Guardas de seguridad del bucle de herramientas ###

*Ubicación en fuente:* `repos-referencia/cline/sdk/packages/core/src/runtime/safety/`

1. **`LoopDetectionTracker` (`loop-detection.ts:50-157`)**
   - **Qué hace:** firma la llamada con JSON **canónico** (claves ordenadas recursivamente, `sortKeys` en
     `:40-48`), de modo que el mismo tool con los argumentos en otro orden es la misma llamada. Cuenta
     repeticiones consecutivas y devuelve tres veredictos: `ok`, `soft` (aviso, umbral 3) y `hard` (parar el run,
     umbral 5) (`:113-157`).
   - **Adaptación en Ego:** `packages/runtime/src/LoopDetectionTracker.ts`, instalado como hook `beforeTool` del
     `ToolExecutionLoop`. Reutilizar el `canonicalJson` ya existente en
     `packages/events/src/ApprovalIdentity.ts:39-47`.
   - **Relación con Backlog Ego:** `ACT-02`, `ACT-08`, `DEC-06`.

2. **`MistakeTracker` (`mistake-tracker.ts:39-192`)**
   - **Qué hace:** contador de errores consecutivos clasificados en
     `api_error | invalid_tool_call | tool_execution_failed` (`:39-42`). Al alcanzar el límite invoca un callback de
     decisión que puede **continuar con una guía** (y reinicia el contador) o **parar** con un mensaje que
     conserva el estado de sesión para reanudar (`:165-192`).
   - **Adaptación en Ego:** `packages/runtime/src/MistakeTracker.ts`, con `onLimitReached` enlazado al
     `ApprovalEngine` para que la decisión de parar o continuar sea un acto gobernado y auditado.
   - **Relación con Backlog Ego:** `ACT-08`, `ACT-12`, `SEC-06`.

### Bloque C: Economía del contexto de herramienta ###

*Ubicación en fuente:* `repos-referencia/cline/sdk/packages/core/src/session/services/tool-result-cache.ts`

1. **`ToolResultCache` (`:17-98`)**
   - **Qué hace:** guarda el texto completo de un resultado sobredimensionado y expone una **URI de
     recuperación** `cline://cache/<sessionId>/<uuid>.result.txt` (`:44`) que el modelo puede volver a leer con
     `read_files`. Presupuesto de 16 MiB por sesión con evicción LRU (`:5`, `:38-42`), expiración a 5 iteraciones
     sin lectura (`:6`, `:75-84`), URI restringida a la sesión propietaria (`:63-65`) y mensaje explícito de cache
     miss que prohíbe repetir efectos (`:7-8`).
   - **Adaptación en Ego:** `packages/tools/src/ToolResultCache.ts` + extensión de `fs_read_file` para resolver
     `ego://cache/<sessionId>/<id>` con los mismos límites de línea y abort que la lectura normal.
   - **Relación con Backlog Ego:** `ACT-04`, `ACT-02`, `KB-01`.

2. **Nombres deterministas de herramienta MCP (`sdk/packages/core/src/extensions/mcp/name-transform.ts:6-35`)**
   - **Qué hace:** compone `server__tool`, sanea caracteres no válidos y, si el nombre supera **64 caracteres**
     (límite de function-name de OpenAI) o requiere sanitización, lo trunca y le añade un hash SHA-1 de 8
     caracteres: `<base>_<hash>` (`:30-34`).
   - **Adaptación en Ego:** `packages/integrations/src/mcp/McpToolName.ts`, con registro del mapa
     `original → canónico` en el log de auditoría.
   - **Relación con Backlog Ego:** `ACT-09`, `ACT-11`, `SEC-05`.

3. **Ledger de presupuesto de compactación (`sdk/packages/core/src/extensions/context/budget-projection/types.ts:1-90`)**
   - **Qué hace:** define el resultado de la proyección como una lista de **acciones auditables**
     (`truncated_text`, `dropped_block`, `dropped_message`, `preserved`) con su razón (`over_budget`,
     `unsafe_to_truncate`, `tool_pair_boundary`, `protected_live_tail`) y avisos cuando el presupuesto es
     inalcanzable (`budget_impossible`, `budget_unachievable_with_protections`). La "cola viva" (últimos turnos) se
     clasifica explícitamente como
     `included_verbatim | included_degraded | summarized_as_context | omitted_with_warning | preserved_out_of_band`
     (`:20-25`), y el presupuesto distingue `triggerTokens`, `targetTokens` y `overheadTokens` fijo de system
     prompt + schemas (`sdk/packages/core/src/extensions/context/compaction.ts:62-87`). **Adaptación en Ego:**
     `packages/runtime/src/CompactionBudgetLedger.ts`, emitiendo cada acción como `EgoEvent` para que el usuario
     pueda auditar qué se perdió en una compactación.
   - **Relación con Backlog Ego:** `ACT-02`, `KB-04`, `DS-05`.

### Bloque D: Modo headless de un solo disparo ###

*Ubicación en fuente:* `repos-referencia/cline/apps/cli/src/commands/program.ts`,
`apps/cli/src/runtime/run-agent.ts`, `apps/cli/src/main.ts`

1. **Ejecución one-shot con salida JSON estructurada (`program.ts:59-65,90,119-134,207-211`; `run-agent.ts:49-68`; `main.ts:794`)**
   - **Qué hace:** el CLI acepta un prompt posicional, expone `--json` para emitir eventos como JSON Lines
     (`run_start`, `run_abort_requested`, …), expone `--system` para sustituir el prompt del sistema y
     `--retries <count>` para acotar los errores consecutivos antes de abortar. En modo JSON se **prohíbe** el
     modo interactivo sin prompt (`main.ts:794`), de modo que la salida es siempre parseable por un automatizador.
   - **Adaptación en Ego:** un modo headless de Ego requeriría exponer el Cognitive Runtime fuera del proceso
     Electron; es una capacidad nueva, no una adaptación. Se difiere.
   - **Relación con Backlog Ego:** `DIST-01` (empaquetado), `TASK-01` (BackgroundEngine).

---

## 3. Matriz de Extracción vs Descarte ##

| Componente Cline | Acción en Ego | Razón Técnica / Arquitectónica |
| --- | :---: | --- |
| `sdk/packages/core/src/hooks/checkpoint-hooks.ts` | **EXTRAER & ADAPTAR** | Snapshot restorable del working tree con índice Git privado y refs aisladas; aporta reversión real de cambios de archivo, que el `SessionCheckpointPolicy` de Ego (durabilidad de transcripción) no cubre. |
| `sdk/packages/core/src/runtime/safety/loop-detection.ts` | **EXTRAER & ADAPTAR** | La firma canónica corrige un defecto medible de Ego: `hashArguments` de `ErrorHandler` usa `JSON.stringify` sin ordenar claves, por lo que la misma llamada reordenada no se detecta. |
| `sdk/packages/core/src/runtime/safety/mistake-tracker.ts` | **EXTRAER & ADAPTAR** | Clasifica `api_error` / `invalid_tool_call` / `tool_execution_failed` y delega la decisión de parar en un callback gobernado y auditable. |
| `sdk/packages/core/src/session/services/tool-result-cache.ts` | **EXTRAER & ADAPTAR** | URI de recuperación con presupuesto por sesión; hoy Ego solo trunca y descarta (`TerminalOutputBuffer.ts:68`), sin vía de relectura. |
| `sdk/packages/core/src/extensions/mcp/name-transform.ts` | **EXTRAER & ADAPTAR** | Resuelve dos defectos de Ego: ausencia de tope de 64 caracteres y colisión silenciosa de nombres entre servidores MCP. |
| `sdk/packages/core/src/extensions/context/budget-projection/` | **EXTRAER & ADAPTAR** | Ego ya corta por ratio y protege la frontera tool/tool (`ContextCompaction.ts:454-459`); le falta el ledger auditable y el desglose de overhead. |
| `sdk/packages/agents/src/agent-runtime.ts` (aprobación) | **EXTRAER PATRÓN** | Solo el discriminante "rechazo de usuario ≠ fallo de herramienta" y el deny por falta de callback; el motor de aprobación de Ego (`ApprovalEngine`) ya es más fuerte. |
| `apps/vscode/` (webview React, gRPC/proto) | **DESCARTAR** | Capa de presentación de un hospedero que Ego no tiene. `AGENTS.md` §1 fija Electron + React 19 propio con IPC tipado; portar el webview y su contrato proto duplicaría el Chat y el Canvas. |
| `sdk/packages/core/src/hub/`, `apps/cline-hub/`, `sdk/packages/core/src/account/`, `apps/cli/src/acp/` | **DESCARTAR** | Daemon compartido por máquina, cuenta cloud, créditos, organizaciones y protocolo de cliente para editores externos: contaminación de dominio y sobreingeniería frente al runtime in-process local-first de Ego. |
| `apps/cli/` (modo headless one-shot + salida JSON) | **SÓLO INSPIRACIÓN** | Capacidad nueva (exponer el runtime fuera de Electron), no una adaptación de patrón. Se difiere a Fase 12 sin implementación. |

---

## 4. Estado real verificado (2026-10-20) ##

> Criterio de cierre: fichero adaptado **y** caller en producción (grep sobre `packages/` + `apps/desktop/`,
> excluyendo `test/`, `dist/`, `node_modules/`).
>
> Este repositorio de referencia es **nuevo**: no hay asimilación previa. Se ejecutaron las búsquedas de
> verificación siguientes y **ninguna** devuelve un caller de producción.

```text
Select-String "commit-tree|write-tree|refs/cline|GIT_INDEX_FILE|checkpointScratchDir" packages/  -> 0
Select-String "LoopDetectionTracker|MistakeTracker|ToolResultCache|McpToolName" packages/  -> 0
Select-String "CompactionBudgetLedger|USER_REJECTED_TOOL" packages/  -> 0
Select-String "LoopDetection|MistakeTracker|ToolResultCache|CompactionBudget|USER_REJECTED" apps/desktop/src/  -> 0
```

| ID | Patrón | Estado | Evidencia / Fundamento |
| --- | --- | :---: | --- |
| `CLNE-01` | Snapshot de workspace por refs privados de Git | 🆕 Pendiente | No existe en `packages/`. `packages/tasks/src/TaskCheckpoint.ts` guarda estado de tarea en VantaDB y `packages/memory/SessionCheckpointPolicy.ts:43` solo fuerza el flush de durabilidad del historial; ninguno captura el working tree. **Cableado:** `packages/tasks/src/BackgroundEngine.ts` (hook previo al stream) + nuevo `packages/tools/src/native/git/WorkspaceSnapshotTool.ts`. Owner A3/A4. |
| `CLNE-02` | Guardas de runtime: bucles por tool call (firma canónica, soft/hard) + errores consecutivos | 🆕 Pendiente | No existe en `packages/`. `packages/runtime/src/ErrorHandler.ts:269-304` solo cuenta llamadas **fallidas** y usa `JSON.stringify` sin ordenar claves (`:306-309`), de modo que la misma llamada con claves reordenadas no se detecta; además el aviso es consultivo y no detiene el run. **Cableado:** `packages/runtime/src/ToolExecutionLoop.ts` (hook `beforeTool`). Owner A2. |
| `CLNE-03` | Caché de resultados de tool con URI de recuperación | 🆕 Pendiente | No existe en `packages/`. `packages/tools/src/native/terminal/TerminalOutputBuffer.ts:68` trunca con marcador y descarta; `packages/tools/src/native/fs/NativeFsTool.ts:100-116` expone `truncated` + offset pero no relectura del tramo omitido. **Cableado:** `packages/tools/src/ToolResultCache.ts` + resolución `ego://cache/...` en `fs_read_file`. Owner A4. |
| `CLNE-04` | Nombre determinista de herramienta MCP (colisiones + límite 64) | 🆕 Pendiente | No existe en `packages/`. `packages/integrations/src/mcp/McpClient.ts:308` compone `prefix_toolName` sin tope de longitud; en `:310` una colisión de nombre **descarta la herramienta** y en `:316` `allowOverride` la **sobrescribe** con solo un warning. **Cableado:** `packages/integrations/src/mcp/McpToolName.ts` en `McpClient.registerTools`. Owner A2. |
| `CLNE-05` | Ledger de presupuesto de compactación (acciones auditables) | 🆕 Pendiente | No existe en `packages/`. `packages/runtime/src/ContextCompaction.ts:6-32` define umbrales y `:454-459` protege la frontera tool/tool, pero no emite ledger de qué bloque se recortó/descartó ni desglosa el overhead fijo (system prompt + schemas). **Cableado:** `packages/runtime/src/ContextCompactionJob` (`ContextCompaction.ts:388`) emite `EgoEvent` por acción. Owner A2. |
| `CLNE-06` | Fail-closed de aprobación y discriminante rechazo-de-usuario | 🆕 Pendiente | No existe en `packages/`. `packages/runtime/src/ToolExecutionLoop.ts:483-488` devuelve `{status:"rejected"}` y `:679`/`:862` el mismo motivo genérico para veto de política y rechazo del usuario, sin el sufijo que impide al modelo reintentar como fallo técnico. **Cableado:** constantes en `packages/execution/src/ApprovalEngine.ts` y anexado en el tool-result de rechazo. Owner A2. |
| `CLNE-07` | Extensión VS Code (webview React + gRPC/proto) | 🚫 **Descartada (con justificación)** | `apps/vscode/webview-ui/`, `apps/vscode/proto/` y `apps/vscode/src/sdk/sdk-compaction.ts:1` pertenecen a la capa de presentación de un hospedero que Ego no tiene. `AGENTS.md` §1 fija Electron 33 + React 19 con preload IPC tipado; portar el webview y su contrato proto duplicaría `CORE-05`/`CANV-02` y convertiría el renderer en cliente de gRPC, contradiciendo el aislamiento del renderer (`AGENTS.md` §2). |
| `CLNE-08` | Hub daemon compartido, cuenta/credits Cline y ACP | 🚫 **Descartada (con justificación)** | `sdk/packages/core/src/hub/daemon/`, `apps/cline-hub/`, `sdk/packages/core/src/account/cline-account-service.ts` y `apps/cli/src/acp/acpAgent.ts` arrastran (a) contaminación de dominio —cuenta cloud, créditos, organizaciones— prohibida por `AGENTS.md` §4; (b) un daemon residente por máquina con discovery y tokens, contrario al runtime in-process y al principio 9 (local-first); (c) ACP es un protocolo de cliente para editores externos, no un patrón de Sub-Egos. |
| `CLNE-09` | Modo headless one-shot con salida JSON estructurada | ⏳ Futura (Fase 12) | `apps/cli/src/commands/program.ts:59-65,119-134,207-211`, `apps/cli/src/runtime/run-agent.ts:49-68` y `apps/cli/src/main.ts:794` ofrecen `--json` con eventos JSON Lines, `--system` y `--retries`. Exigiría exponer el Cognitive Runtime fuera del proceso Electron (nueva superficie, no adaptación). Fase destino: **Fase 12 (Distribution) / P1**, una vez resueltos la firma y el empaquetado (`DIST-03`, `DIST-04`). |

**Recuento:** 0 `✅ Completada` · 2 `🚫 Descartada` · 6 `🆕 Pendiente` · 1 `⏳ Futura` — **9 tareas**.

---

## 5. Descarte normalizado a la forma canónica ##

Las filas de la matriz §3 usaban la forma `**DESCARTAR**`; se normalizan aquí a
`🚫 Descartada (con justificación)` (AGENTS.md §4) conservando el motivo original:

| Componente Cline | Veredicto | Fundamento |
| --- | :---: | --- |
| `apps/vscode/` (webview React + gRPC/proto) | 🚫 **Descartada (con justificación)** | Capa de presentación de un hospedero ajeno a Ego. `AGENTS.md` §1: Electron 33 + React 19 con IPC tipado; portar el webview duplicaría Chat y Canvas y el renderer dejaría de ser local y sin gRPC. |
| `sdk/packages/core/src/hub/` + `apps/cline-hub/` | 🚫 **Descartada (con justificación)** | Daemon compartido por máquina: contradice el runtime in-process de `AGENTS.md` §2 y el principio 9 (local-first); añade discovery, tokens y ciclo de vida distribuido innecesario. |
| `sdk/packages/core/src/account/` + `apps/cli/src/acp/` | 🚫 **Descartada (con justificación)** | Contaminación de dominio (`AGENTS.md` §4): cuenta cloud, créditos, organizaciones y ACP no pertenecen al alcance de un Sistema Operativo Cognitivo local-first. |
