---
title: Cline Review & Extraction Backlog — Ego SOC
kind: review
status: active
description: "Backlog especializado para la revisión, extracción de patrones y adaptación técnica de repos-referencia/cline hacia el monorepo de Ego."
tags: [ego, cline, extraction, review, agent-runtime, checkpoints, approval, compaction]
schema: "10-column canonical schema (.agents/references/backlog-format.md compatible)"
---

## Backlog de Revisión y Extracción: Cline (cline/cline) ##

> **Propósito:** Registro canónico y secuencial de auditoría, extracción de patrones y adaptación técnica de
> `repos-referencia/cline` hacia el monorepo de Ego.
>
> **Regla de Operación:** *No copiar código directamente*. Extraer la lógica de diseño, contratos y patrones
> arquitectónicos, reescribiendo limpiamente en TypeScript estricto, React 19 y Node 22 Main Process, apoyándose
> en VantaDB como sustrato de memoria.
>
> **Esquema:** Tabla canónica de 10 columnas:
> `| ID | Severidad | Hallazgo | Archivo Cline | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego |
> Relaciones Ego | Dependencias |`

---

## 0. Verificación de estado (2026-10-20) — revisión de apertura ##

`repos-referencia/cline` es un **repositorio de referencia nuevo**: no existe asimilación previa, por lo que no
hay tarea en estado `✅ Completada`. Cada fila se ha cerrado en uno de los cuatro estados canónicos de
`AGENTS.md` §4 y `docs/extractions/README.md` §4, sin filas en el limbo.

| Estado | Significado canónico |
| --- | --- |
| `✅ Completada` | Asimilado, integrado y con **caller en producción verificado**. La celda cita la ruta real. |
| `🚫 Descartada (con justificación)` | El patrón no se aplica en Ego, fue sustituido por otro módulo canónico, o viola un guardrail. La celda contiene el motivo técnico. |
| `🆕 Pendiente` | Patrón asimilado o con adaptación identificada pero **sin fichero adaptado ni caller en producción**. La celda dice el **cableado exacto** y **quién lo ejecuta**. |
| `⏳ Futura (fase)` | Diferido a una fase posterior, con fase destino explícita. |

### Búsquedas de verificación ###

Ejecutadas sobre `packages/` + `apps/desktop/` (excluyendo `test/`, `dist/`, `node_modules/`), todas con 0
coincidencias:

```text
Select-String "commit-tree|write-tree|refs/cline|GIT_INDEX_FILE|checkpointScratchDir" packages/  -> 0
Select-String "LoopDetectionTracker|MistakeTracker|ToolResultCache|McpToolName" packages/  -> 0
Select-String "CompactionBudgetLedger|USER_REJECTED_TOOL" packages/  -> 0
Select-String "LoopDetection|MistakeTracker|ToolResultCache|CompactionBudget|USER_REJECTED" apps/desktop/src/  -> 0
```

**Nota de alcance:** la verificación cubre exclusivamente los 6 patrones adaptables detectados. Los componentes de
hospedero y plataforma de Cline (extensión VS Code, daemon `cline-hub`, cuenta/commercialización, ACP) se cierran
en `🚫 Descartada` con su fundamento técnico y no se buscan en el código de Ego.

---

## 1. Resumen Ejecutivo de Extracción ##

Cline aporta a Ego cuatro transversales de runtime que hoy no existen en el Cognitive Runtime: **reversión real de
cambios en el workspace** (snapshots por refs privados de Git con captura de archivos no rastreados), **guardas
duras contra bucles y errores repetidos** en el bucle de herramientas, **economía del contexto de herramienta**
(caché con URI de recuperación) y **auditoría de la compactación** (ledger de presupuesto con acciones tipadas).
Aporta además un patrón de gobernanza de bajo coste: distinguir el rechazo del usuario del fallo técnico en el
`tool-result`, para que el modelo no reintente a ciegas. El resto del repositorio (webview de VS Code, daemon
compartido, cuenta/credits, ACP) es producto de otro hospedero o dominio ajeno a un SOC local-first y queda
descartado con justificación.

### MATRIZ DE DISTRIBUCIÓN POR FASE ###

```text
CLNE-01  Snapshot de workspace por refs de Git ......... Fase 07 Tasks  + Fase 10 Recovery   🆕
CLNE-02  Guardas de bucles y errores consecutivos ..... Fase 02 Acción  + Fase 05 Intelligence 🆕
CLNE-03  Caché de tool results con URI de recuperación  Fase 02 Acción  + Fase 06 Knowledge  🆕
CLNE-04  Nombre determinista de tool MCP .............. Fase 02 Acción  + Fase 11 Security   🆕
CLNE-05  Ledger de presupuesto de compactación ....... Fase 02 Acción  + Fase 08 Daily State 🆕
CLNE-06  Fail-closed + discriminante de rechazo ...... Fase 02 Acción  + Fase 11 Security   🆕
CLNE-07  Extensión VS Code (webview + gRPC/proto) .... — (capa de hospedero ajena)          🚫
CLNE-08  Hub daemon + cuenta/credits + ACP ........... — (dominio ajeno + sobreingeniería)   🚫
CLNE-09  Modo headless one-shot con salida JSON ...... Fase 12 Distribution (P1)              ⏳
  Fase 02 Acción    █████  5 tareas   (CLNE-02, CLNE-03, CLNE-04, CLNE-05, CLNE-06)
  Fases 05/06/08    █      3 enlaces  (CLNE-02 → DEC-06, CLNE-03 → KB-01, CLNE-05 → DS-05)
  Fases 07/10/11/12 ██     1+1+2+1   (CLNE-01 → TASK-03/REC-05, CLNE-04/06 → SEC-05, CLNE-09 → DIST)
```

### Recuento de estados (verificado sobre las 9 filas de la tabla §2) ###

| `✅ Completada` | `🚫 Descartada` | `🆕 Pendiente` | `⏳ Futura` | Total |
| :---: | :---: | :---: | :---: | :---: |
| 0 | 2 | 6 | 1 | **9** |

---

## 2. Catálogo Detallado de Extracción (10 Columnas Canónicas) ##

| ID | Severidad | Hallazgo | Archivo Cline | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CLNE-01` | 🔴 Crítica | **Snapshot restorable del working tree por refs privados de Git** | `sdk/packages/core/src/hooks/checkpoint-hooks.ts:497-709` | 🔴 3-5d | 🔴 P0 | 🆕 Pendiente | Crear `packages/tasks/src/WorkspaceCheckpoint.ts` reimplementando el patrón: `git stash create` + commit de árbol propio como **tercer padre** para capturar archivos no rastreados (`:249-338`), índice Git privado por sesión con `GIT_INDEX_FILE` y `core.ignorestat=false` / `core.splitIndex=false` (`:179-201`), refs aisladas `refs/ego/checkpoints/<sessionId>/<runCount>` invisibles a `git stash list` (`:630`), fallback a HEAD y evento `EgoEvent` `task.checkpoint` con `outcome ∈ {stash, head_clean, head_fallback, skipped}` (`:550-568`). El **metadato** de los checkpoints vive en VantaDB (`system/checkpoints`), nunca en el repo del usuario. **Cableado:** `packages/tasks/src/BackgroundEngine.ts` (hook previo al stream) + nuevo `packages/tools/src/native/git/WorkspaceSnapshotTool.ts`. **Owner A3/A4.** | Ego: `TASK-03`, `REC-05`, `DOM-01`, `SEC-06` · Extracción: `docs/extractions/cline.md` §Bloque A | `ACT-04` (conectores Nivel A) |
| `CLNE-02` | 🔴 Crítica | **Guardas de runtime: bucles por tool call + errores consecutivos** | `sdk/packages/core/src/runtime/safety/loop-detection.ts:50-157` · `mistake-tracker.ts:39-192` | 🟡 2-3d | 🔴 P0 | 🆕 Pendiente | Crear `packages/runtime/src/LoopDetectionTracker.ts` y `packages/runtime/src/MistakeTracker.ts`. **Defecto medible en Ego:** `packages/runtime/src/ErrorHandler.ts:269-304` firma con `JSON.stringify` sin ordenar claves (`:306-309`), por lo que la misma llamada con los argumentos reordenados **no se detecta**; además solo cuenta llamadas fallidas y su aviso es consultivo (no detiene el run). La adaptación aporta (a) firma canónica reutilizando `canonicalJson` de `packages/events/src/ApprovalIdentity.ts:39-47`, (b) umbrales soft/hard (3/5) con **parada del run** en el umbral duro, y (c) clasificación `api_error \| invalid_tool_call \| tool_execution_failed` con callback `onLimitReached` enlazado al `ApprovalEngine` para que "parar o continuar" sea un acto gobernado y auditado. **Cableado:** hook `beforeTool` en `packages/runtime/src/ToolExecutionLoop.ts`. **Owner A2.** | Ego: `ACT-02`, `ACT-08`, `ACT-12`, `DEC-06` | `ACT-02` |
| `CLNE-03` | 🟠 Alta | **Caché de resultados de herramienta con URI de recuperación** | `sdk/packages/core/src/session/services/tool-result-cache.ts:17-98` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Crear `packages/tools/src/ToolResultCache.ts`: el texto completo de un resultado sobredimensionado se conserva fuera del prompt y se expone como URI `ego://cache/<sessionId>/<uuid>.result.txt` (`:44`) relectible por `fs_read_file`, con presupuesto de 16 MiB por sesión y evicción LRU (`:5`, `:38-42`), expiración a 5 iteraciones sin lectura (`:6`, `:75-84`), URI restringida a la sesión propietaria (`:63-65`) y mensaje de cache miss que prohíbe repetir efectos (`:7-8`). **Gap en Ego:** `packages/tools/src/native/terminal/TerminalOutputBuffer.ts:68` trunca con marcador y **descarta**; `packages/tools/src/native/fs/NativeFsTool.ts:100-116` expone `truncated` + offset pero no relectura del tramo omitido. **Cableado:** `fs_read_file` resuelve la URI con los mismos límites de línea y abort que la lectura normal. **Owner A4.** | Ego: `ACT-04`, `ACT-02`, `KB-01` | `ACT-04` |
| `CLNE-04` | 🔴 Crítica | **Nombre determinista de herramienta MCP (colisiones y límite de longitud)** | `sdk/packages/core/src/extensions/mcp/name-transform.ts:6-35` | 🟢 0.5-1d | 🔴 P0 | 🆕 Pendiente | Crear `packages/integrations/src/mcp/McpToolName.ts`: componer `server__tool`, sanear caracteres no válidos y, si el nombre excede **64 caracteres** (límite de function-name de OpenAI) o requiere sanitización, truncar y añadir un hash SHA-1 de 8 caracteres → `<base>_<hash>` (`:30-34`). **Defecto medible en Ego:** `packages/integrations/src/mcp/McpClient.ts:308` compone `prefix_toolName` sin tope de longitud; en `:310` una colisión de nombre **descarta silenciosamente** la herramienta del segundo servidor y en `:316` `allowOverride` la **sobrescribe** con solo un warning en consola — en ambos casos el usuario pierde una capacidad sin enterarse. **Cableado:** invocar el transformador en `McpClient.registerTools` y registrar el mapa `original → canónico` en el log de auditoría. **Owner A2.** | Ego: `ACT-09`, `ACT-11`, `SEC-05` | `ACT-09` |
| `CLNE-05` | 🟠 Alta | **Ledger de presupuesto de compactación con acciones auditables** | `sdk/packages/core/src/extensions/context/budget-projection/types.ts:1-90` · `compaction.ts:62-87` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Crear `packages/runtime/src/CompactionBudgetLedger.ts`: la proyección emite una lista de acciones tipadas (`truncated_text`, `dropped_block`, `dropped_message`, `preserved`) con su razón (`over_budget`, `unsafe_to_truncate`, `tool_pair_boundary`, `protected_live_tail`) y avisos `budget_impossible` / `budget_unachievable_with_protections`; la cola viva se clasifica como `included_verbatim \| included_degraded \| summarized_as_context \| omitted_with_warning \| preserved_out_of_band` (`:20-25`); el presupuesto separa `triggerTokens`, `targetTokens` y `overheadTokens` fijo (system prompt + schemas de tools). **Gap en Ego:** `packages/runtime/src/ContextCompaction.ts:6-32` corta por ratio y `:454-459` protege la frontera tool/tool, pero no deja rastro auditable de qué se perdió ni desglosa el overhead. **Cableado:** `ContextCompactionJob` (`ContextCompaction.ts:388`) emite un `EgoEvent` por acción. **Owner A2.** | Ego: `ACT-02`, `KB-04`, `DS-05` | `ACT-02` |
| `CLNE-06` | 🟠 Alta | **Fail-closed de aprobación y discriminante rechazo-de-usuario** | `sdk/packages/shared/src/llms/tools.ts:95-105` · `sdk/packages/agents/src/agent-runtime.ts:2503-2541` | 🟢 0.5-1d | 🟠 P1 | 🆕 Pendiente | Añadir en `packages/execution/src/ApprovalEngine.ts` las constantes `USER_REJECTED_TOOL_REASON` y `TOOL_REJECTION_SUFFIX` ("NOT a tool or system failure. Clarify with user before proceeding.") y anexar el sufijo al `tool-result` de rechazo. **Gap en Ego:** `packages/runtime/src/ToolExecutionLoop.ts:483-488` devuelve `{status:"rejected"}` y `:679`/`:862` emiten el mismo motivo genérico para veto de política y rechazo del usuario, sin el discriminante que impide al modelo reintentar como si fuera un fallo técnico. Complemento: cuando no hay callback de aprobación configurado, la tool **no se ejecuta** (`agent-runtime.ts:2509-2514`) — mismo comportamiento fail-closed que `ApprovalEngine`. **Owner A2.** | Ego: `ACT-06`, `ACT-07`, `ACT-08` | `ACT-06` |
| `CLNE-07` | 🟡 Media | **Extensión VS Code: webview React + contrato gRPC/proto** | `apps/vscode/webview-ui/` · `apps/vscode/proto/` · `apps/vscode/src/sdk/sdk-compaction.ts:1` | — | — | 🚫 Descartada (con justificación) | Capa de presentación de un hospedero que Ego no tiene. `AGENTS.md` §1 fija Electron 33 + React 19 con preload IPC tipado; portar el webview y su contrato proto duplicaría `CORE-05`/`CANV-02` y convertiría el renderer en cliente gRPC, contradiciendo el aislamiento del renderer (`AGENTS.md` §2) y el guardrail "NO lógica de negocio en renderer". Solo se extraen los patrones de motor (`CLNE-01`..`CLNE-06`). | Ego: — | — |
| `CLNE-08` | 🟡 Media | **Hub daemon compartido, cuenta/credits Cline y protocolo ACP** | `sdk/packages/core/src/hub/daemon/` · `apps/cline-hub/` · `sdk/packages/core/src/account/cline-account-service.ts` · `apps/cli/src/acp/acpAgent.ts` | — | — | 🚫 Descartada (con justificación) | Tres fundamentos acumulativos: (a) **contaminación de dominio** (`AGENTS.md` §4): cuenta cloud, créditos, organizaciones y facturación no pertenecen al alcance de un SOC local-first; (b) **sobreingeniería**: un daemon residente por máquina con discovery, tokens y ciclo de vida distribuido contradice el runtime in-process de `AGENTS.md` §2 y el principio 9 (local-first); (c) ACP es un protocolo de cliente para editores externos, no un patrón de Sub-Egos. | Ego: — | — |
| `CLNE-09` | 🔵 Futura | **Modo headless one-shot con salida JSON estructurada** | `apps/cli/src/commands/program.ts:59-65,119-134,207-211` · `apps/cli/src/runtime/run-agent.ts:49-68` · `apps/cli/src/main.ts:794` | 🔴 3-5d | 🔵 P3 | ⏳ Futura (Fase 12) | Cline ofrece prompt posicional, `--json` con eventos JSON Lines (`run_start`, `run_abort_requested`), `--system` y `--retries <count>`, y prohíbe el modo interactivo sin prompt en modo JSON (`main.ts:794`) para que la salida sea siempre parseable. Trasladarlo a Ego exigiría **exponer el Cognitive Runtime fuera del proceso Electron**: es una capacidad nueva, no una adaptación de patrón, y queda diferida a **Fase 12 (Distribution) / P1** tras resolver firma y empaquetado (`DIST-03`, `DIST-04`). Sin implementación en esta ola. | Ego: `DIST-01`, `DIST-03`, `TASK-01` | `CLNE-02`, `DIST-04` |

---

## 3. Integración con el Backlog Maestro de Ego ##

Cada tarea `CLNE-*` se ejecuta como **Pre-requisito de Diseño y Código** de las fases del Backlog Maestro
(`docs/roadmap/Backlog.md`):

```text
┌──────────────────────── Revisión & Extracción Cline ────────────────────────┐
│  CLNE-01  Checkpoints de workspace (Git)                                     │
│  CLNE-02  Guardas de bucle y errores consecutivas                            │
│  CLNE-03  Caché de tool results con URI                                      │
│  CLNE-04  Nombre determinista de tool MCP                                    │
│  CLNE-05  Ledger de presupuesto de compactación                              │
│  CLNE-06  Fail-closed + discriminante de rechazo                             │
│  CLNE-07  🚫 UI extensión VS Code                                            │
│  CLNE-08  🚫 Hub daemon + cuenta/credits + ACP                               │
│  CLNE-09  ⏳ Modo headless one-shot (JSON)                                   │
└──────────────────────────────────────────────────────────────────────────────┘
        │                    │                    │                 │
        ▼                    ▼                    ▼                 ▼
┌──────────────────────── Backlog Maestro de Ego (docs/roadmap/Backlog.md) ────┐
│  Fase 02 Acción      ACT-02  ACT-06  ACT-08  ACT-09  ACT-11  ACT-12         │
│  Fase 05 Intelligence DEC-06                                                │
│  Fase 06 Knowledge   KB-01                                                  │
│  Fase 07 Tasks       TASK-01  TASK-03                                       │
│  Fase 08 Daily State DS-05                                                  │
│  Fase 10 Recovery    REC-02  REC-05                                        │
│  Fase 11 Security    SEC-05  SEC-06                                        │
│  Fase 12 Distribución DIST-01  DIST-03  DIST-04                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Protocolo de Extracción por Tarea ###

1. **Lectura y Aislamiento:** inspeccionar el fichero fuente en `repos-referencia/cline/sdk/packages/` (y `apps/`
   solo para los patrones de CLI), identificando dependencias externas.
2. **Eliminación de Acoplamiento:** descartar el hub daemon, la cuenta Cline, ACP, la capa webview de VS Code y la
   persistencia SQLite; reescribir en TypeScript estricto.
3. **Reescritura Canónica:** escribir el módulo en `packages/` cumpliendo el tipado estricto de `AGENTS.md` §4 y el
   principio de primitives de librería (D3): reutilizar `canonicalJson`
   (`packages/events/src/ApprovalIdentity.ts:39-47`) en lugar de escribir un serializador nuevo.
4. **Verificación:** test unitario del módulo (umbrales, colisiones, presupuesto, round-trip de la URI) antes de
   integrarlo en el hilo principal.
5. **Cierre de Tarea:** marcar `✅ Completada` **solo** con fichero adaptado + caller en producción verificado; si
   el patrón no aplica, `🚫 Descartada (con justificación)`; si la adaptación está identificada pero no existe,
   `🆕 Pendiente` con el cableado exacto y su responsable; si se difiere, `⏳ Futura` con la fase destino.

---

## 4. Deuda abierta derivada de esta verificación (→ handoff owner) ##

| # | Ítem | Tipo | Owner | Bloqueante |
| --- | --- | --- | --- | --- |
| D1 | `CLNE-04`: `McpClient.registerTools` **descarta silenciosamente** una herramienta MCP ante colisión de nombre (`:310`) o la sobrescribe con `allowOverride` (`:316`). Pérdida de capacidad invisible para el usuario. | Código | A2 | No |
| D2 | `CLNE-02`: la firma de detección de bucles de `ErrorHandler.hashArguments` (`packages/runtime/src/ErrorHandler.ts:306-309`) no canonicaliza el orden de las claves; el guard solo cubre llamadas fallidas y nunca detiene el run. | Código | A2 | No |
| D3 | `CLNE-01`: Ego **no tiene reversión de cambios de archivo**. `SessionCheckpointPolicy` (`packages/memory/SessionCheckpointPolicy.ts:43`) solo garantiza durabilidad del historial en VantaDB; un Sub-Ego de Engineering puede dejar el workspace del usuario sin vía de rollback. | Decisión | A3/A4 | No |
| D4 | `CLNE-09`: exponer el Cognitive Runtime fuera de Electron (modo headless) es una superficie nueva; requiere decisión de owner sobre empaquetado y empaquetado CLI antes de abrir tarea. | Decisión | ness-e | `DIST-04` (sin firma, sin instalador) |
| D5 | Candidato no evaluado: sandbox de plugins en `worker` por sesión con registro de estado (`sdk/packages/core/src/extensions/plugin/plugin-registry.ts`). No es un patrón de motor y no se ha convertido en hallazgo; requiere decisión de owner sobre si Ego abre una superficie de plugins en Fase 03. | Decisión | ness-e | No |
