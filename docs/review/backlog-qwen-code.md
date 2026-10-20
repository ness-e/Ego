---
kind: review
status: active
description: "Backlog especializado para la revisión, extracción de patrones y adaptación técnica de qwen-code (fork de Gemini CLI con sistema multi-agente y subagentes) hacia el monorepo de Ego."
tags: [ego, qwen-code, extraction, review, subagents, multi-agent, mcp, compaction, security]
schema: "10-column canonical schema (.agents/references/backlog-format.md compatible)"
---

# Qwen Code Review & Extraction Backlog — Ego SOC #

| Campo | Valor |
| --- | --- |
| Estado | Activo — Backlog de revisión, extracción y adaptación técnica de `qwen-code` hacia el monorepo de Ego |
| Repositorio Origen | `repos-referencia/qwen-code/` (QwenLM/qwen-code, commit verificado `6ec1b83`, rama `main`) |
| Total de Tareas | **9** (`QWEN-01..09`) — 0 ✅ · 2 🚫 · 6 🆕 · 1 ⏳ |
| Fases Impactadas en Ego | 01 (`CORE`), 02 (`ACT`), 03 (`SUB`), 06 (`KB`), 11 (`SEC`) |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Última verificación | 2026-10-20 — 9 hallazgos re-auditados contra el código real del origen y de `packages/` + `apps/desktop/` |

> **Propósito:** Registro canónico y secuencial de auditoría, extracción de patrones y adaptación técnica de
> `repos-referencia/qwen-code` hacia el monorepo de Ego.
> **Regla de Operación:** *No copiar código directamente*. Extraer la lógica de diseño, contratos y patrones
> arquitectónicos, reescribiendo limpiamente en TypeScript estricto, React 19 y Node 22 Main Process, apoyándose en
> VantaDB como sustrato de memoria.
> **Esquema:** Tabla canónica de 10 columnas:
> `| ID | Severidad | Hallazgo | Archivo Qwen Code | Esfuerzo | Prioridad | Estado |
> Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |`

## 0. Verificación de estado (2026-10-20) ##

Cada fila fue auditada contra el **código real** de `repos-referencia/qwen-code` (commit `6ec1b83`, rama `main`) y
contrastada con el **código real de Ego** (`packages/` + `apps/desktop/`, excluyendo `test/`, `dist/`,
`node_modules/`).

| Estado | Significado canónico |
| --- | --- |
| `✅ Completada` | Asimilado, integrado y con **caller en producción verificado**. La celda cita la ruta real. |
| `🚫 Descartada (con justificación)` | El patrón no se aplica en Ego, fue sustituido por otro módulo canónico, o viola un guardrail. La celda contiene el motivo técnico. |
| `🆕 Pendiente` | Asimilado (el código existe y está probado) pero **sin caller en producción**. La celda dice el cableado exacto y quién lo ejecuta. |
| `⏳ Futura (fase)` | Diferido a una fase posterior, con fase destino explícita. |

### Búsquedas de verificación ejecutadas sobre el código de Ego ###

```text
grep -ri "autonomy"            packages/execution/src packages/decision/src -> 0 coincidencias
grep -rn "readOnlyHint|annotations" packages/                          -> 0 coincidencias
grep -rn "inferRiskLevel"       packages/integrations/src              -> McpClient.ts:320, 749-775
grep -rn "image|media|base64|mime" packages/runtime/src/ContextCompaction.ts -> 0 coincidencias
grep -rn '"AGENTS.md"'          packages/ apps/desktop/src             -> 0 lecturas de disco
grep -rn "EXCLUDED_TOOLS|excludedTools" packages/subegos/src packages/tools/src -> 0 coincidencias
```

> **Alcance de la revisión:** repositorio **nuevo** en `repos-referencia/`. Nada ha sido asimilado todavía, por lo
> que el recuento arranca con **0 `✅ Completada`**. No se declara `✅` sin fichero adaptado **y** caller en
> producción verificado.

---

## 1. Resumen Ejecutivo de Tareas de Extracción ##

| Grupo de Trabajo | Rango IDs | Tareas | Fases de Ego Impactadas | Prioridad | Beneficio Principal |
| --- | --- | :---: | --- | :---: | --- |
| **A. Modo de aprobación del Sub-Ego** | `QWEN-01` | 1 | Fase 02 (`ACT`), Fase 03 (`SUB`), Fase 11 (`SEC`) | 🔴 P0 | Convierte `autonomy` (campo muerto) en política efectiva de aprobación |
| **B. Coste de la superficie del modelo** | `QWEN-02` | 1 | Fase 01 (`CORE`), Fase 02 (`ACT`), Fase 03 (`SUB`) | 🟠 P1 | Medición verificable del coste en tokens de la superficie declarada (−59,8 % documentado) |
| **C. Piso de capacidad por rol** | `QWEN-03` | 1 | Fase 02 (`ACT`), Fase 03 (`SUB`) | 🔴 P0 | Defence en profundidad: un Sub-Ego no alcanza el plano de control del padre |
| **D. Frontera de autoridad ante terceros** | `QWEN-04`, `QWEN-05` | 2 | Fase 02 (`ACT`), Fase 11 (`SEC`) | 🔴 P0 | Cierra un bypass de HITL: hoy el riesgo de una tool MCP se deduce **del nombre** |
| **E. Compactación y contexto por ficheros** | `QWEN-06`, `QWEN-07` | 2 | Fase 01 (`CORE`), Fase 06 (`KB`) | 🟠 P1 | Slimming de entrada con sanitización; ingesta jerárquica de contexto de proyecto |
| **F. Modelos no asimilables** | `QWEN-08`, `QWEN-09` | 2 | — (descarte) | 🔵 P3 | Ejecutor externo, TUI, dominios ajenos y topología de equipo |
| **TOTAL** | `QWEN-01..09` | **9** | **Fases 01, 02, 03, 06, 11** | — | — |

### Recuento de estados (verificado sobre las 9 filas de la tabla §2) ###

| `✅ Completada` | `🚫 Descartada` | `🆕 Pendiente` | `⏳ Futura` | Total |
| :---: | :---: | :---: | :---: | :---: |
| 0 | 2 | 6 | 1 | **9** |

### MATRIZ DE DISTRIBUCIÓN POR FASE ###

```text
Fase 01 CORE ────────── QWEN-02 (superficie declarada) · QWEN-06 (slimming de compactación)
Fase 02 ACT  ────────── QWEN-01 (modo de aprobación) · QWEN-02 · QWEN-03 (piso de tools)
                          QWEN-04 (annotations MCP) · QWEN-05 (truncado visible)
Fase 03 SUB  ────────── QWEN-01 (autonomy → policy) · QWEN-02 · QWEN-03
Fase 06 KB   ────────── QWEN-07 (contexto jerárquico + folder trust)
Fase 11 SEC  ────────── QWEN-01 · QWEN-04 · QWEN-05
Descarte ────────────── QWEN-08 (ejecutor externo + TUI + dominios ajenos) · QWEN-09 (Agent Team peer-to-peer)
```

---

## 2. Catálogo Detallado de Extracción (10 Columnas Canónicas) ##

| ID | Severidad | Hallazgo | Archivo Qwen Code | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `QWEN-01` | 🔴 Crítica | **Modo de aprobación efectivo derivado del manifiesto del Sub-Ego** (`approvalMode` + modo `bubble`) | `packages/core/src/subagents/types.ts:29, 99-106`; `packages/core/src/subagents/agent-frontmatter-schema.ts:26-33, 61-68`; `packages/core/src/agents/team/leaderPermissionBridge.ts:97-111` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | Qwen deriva de cada definición de subagente su modo de aprobación, con herencia explícita del padre y un modo `bubble` que **escala la confirmación a la sesión padre** en vez de auto-denegar. En Ego el campo equivalente existe pero **está muerto**: `SubEgoManifest.autonomy` (`packages/subegos/src/SubEgoManifest.ts:109, 228`) tiene **0 consumidores** en `packages/execution/src` y `packages/decision/src` — sólo aparece en esquema, fábrica, plantillas y en la vista `apps/desktop/renderer/components/sub-egos.tsx:576`. El transporte ya está resuelto (`packages/execution/src/ApprovalEngine.ts:22, 47, 242` transporta `subEgoId`; la UI lo muestra en `apps/desktop/renderer/components/activity-widget/ActivityWidget.tsx:169`). **Cableado:** derivar `approvalMode` efectivo en `packages/subegos/src/SubEgoManifest.ts` y aplicarlo en `packages/execution/src/ApprovalEngine.ts` y en `packages/subegos/src/DelegationRouter.ts` al construir el contexto hijo. Responsable: owner `packages/subegos` + `packages/execution`. | Ego: `SUB-01`, `SUB-09`, `ACT-06`, `SEC-05` · Extracción: `docs/extractions/qwen-code.md` §2 Bloque A | — |
| `QWEN-02` | 🟠 Alta | **Presupuesto por turno de la superficie visible al modelo** (allowlist declarativa + contabilidad de tokens) | `packages/core/src/subagents/builtin-agents.ts:280-342`; `packages/core/src/tools/agent/agent-description-budget.test.ts:17-37` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | La fuente mide, no estima: el subagente `review-agent` declara 6 tools en vez de heredar el registro completo y el comentario registra **21 178 → 3 447 tokens/turno** de declaraciones de tools, con el prompt de entrega cayendo de 139 013 a 55 897 tokens (**−59,8 %**). El test de presupuesto fija, por turno, el tamaño máximo de cada descripción y esquema de parámetro ("una descripción de tool se paga en cada turno"). En Ego la superficie declarada existe (`SubEgoManifest.tools`, `packages/subegos/src/SubEgoManifest.ts:101`; filtro en `packages/decision/src/SubEgoSelector.ts:36-37`) pero **no hay ninguna medición ni umbral**. **Cableado:** añadir el verificador de coste al registro de `packages/tools/src/ToolRegistry.ts:23` y un test de presupuesto por turno en `packages/runtime/` que falle si una descripción crece sin límite o si un parámetro presupuestado se renombra. Responsable: owner `packages/tools` + `packages/runtime`. | Ego: `SUB-01`, `SUB-09`, `ACT-01`, `CORE-03` · Extracción: §2 Bloque B | `QWEN-03` |
| `QWEN-03` | 🔴 Crítica | **Piso fail-closed de tools para Sub-Egos** (anti fan-out `O(k^n)` y anti plano de control) | `packages/core/src/agents/runtime/subagent-plan-tool-policy.ts:20-23, 51-83` | 🟡 1d | 🔴 P0 | 🆕 Pendiente | Conjunto explícito de tools que **nunca** están disponibles para un subagente: `WORKFLOW` (excluido para impedir fan-out recursivo `O(k^n)`), `TASK_CREATE/UPDATE/LIST`, `TODO_WRITE`, `TEAM_CREATE/DELETE`, `ENTER/EXIT_WORKTREE`, `SEARCH_MEMORY`/`MANAGE_MEMORY` y el ciclo de plan. Ego limita **profundidad** (`packages/subegos/src/DelegationRouter.ts:348, 393-394`) y fan-out (`DEFAULT_MAX_SPAWN_DEPTH = 0`, `:115`), pero **no limita superficie**: un Sub-Ego con `tools: ["task_create"]` alcanza el plano de control del padre. **Cableado:** publicar el conjunto de exclusión en `packages/subegos/src/` y aplicarlo al filtrado de tools de `packages/tools/src/ToolRegistry.ts` en la construcción del contexto delegado. Responsable: owner `packages/subegos` + `packages/tools`. | Ego: `SUB-06`, `SUB-05`, `ACT-01`, `ACT-06` · Extracción: §2 Bloque C | — |
| `QWEN-04` | 🔴 Crítica | **Las `annotations` MCP y el nombre de la tool no son autoridad** | `packages/core/src/permissions/classifier-prompts/system-prompt.ts:101-109`; `packages/core/src/tools/mcp-classifier-input.ts:65-70` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | La regla de Qwen: `readOnlyHint`/`destructiveHint`/`idempotentHint`/`openWorldHint` son **autodeclaradas por el servidor y no verificadas** — "pueden aumentar la sospecha pero nunca justificar permitir una acción por sí solas" — y una tool de servidor sin `annotations` no es más segura por llamarse `read_*`. **Ego hace lo contrario**: `packages/integrations/src/mcp/McpClient.ts:320, 749-775` deriva el nivel de riesgo **sólo del nombre** (`get`/`read`/`list`/`search`/`fetch`/`inspect` ⇒ `safe`) y `packages/security/src/ToolPermissions.ts:356` deja fuera de la compuerta HITL todo lo que no sea `destructive`/`sensitive`. Un servidor MCP hostil puede nombrar `read_*` una tool destructiva y obtener aprobación automática. **Cableado:** en `McpClient.ts`, dejar de derivar `safe` por nombre (`sensitive` por defecto para MCP salvo allowlist explícita del usuario) y leer `annotations` **sólo para subir** de nivel, nunca para bajarlo; añadir el caso de prueba en `packages/security/test/ToolPermissions.test.ts`. Responsable: owner `packages/security` + `packages/integrations`. | Ego: `SEC-05`, `SEC-08`, `ACT-01`, `ACT-09` · Extracción: §2 Bloque D | — |
| `QWEN-05` | 🟠 Alta | **Proyección acotada con truncado siempre visible** ("lo omitido nunca se presenta como ausente") | `packages/core/src/tools/mcp-classifier-input.ts:18-48` | 🟡 1d | 🟠 P1 | 🆕 Pendiente | La proyección de una llamada MCP al clasificador se acota con presupuesto compartido (16 000 chars), tope por cadena (2 000), profundidad (8) y entradas (64); **todo corte deja un marcador en línea** (`…[truncated N chars]`, `[omitted: …]`) y activa `arguments_truncated`/`name_truncated`. La lista de claves de `annotations` reenviadas está exportada para que el test del prompt afirme que toda clave reenviada aparece nombrada como no verificada. En Ego `packages/execution/src/ExecutionManager.ts:467-501` ya marca `truncated: true` en el resultado, pero **el marcador no viaja a la tarjeta de aprobación** (`apps/desktop/renderer/components/tools/ApprovalCard.tsx` no referencia el truncado) ni a la proyección del clasificador. **Cableado:** propagar el marcador al payload de `ipc.approval.request` (`apps/desktop/src/main.ts:2410-2411`) y renderizarlo en `ApprovalCard.tsx`; cubrir el caso en `apps/desktop/renderer/test/ApprovalCard.test.tsx`. Responsable: owner `packages/execution` + renderer. | Ego: `ACT-06`, `ACT-07`, `SEC-05`, `SEC-08` · Extracción: §2 Bloque D | `QWEN-04` |
| `QWEN-06` | 🟠 Alta | **Adelgazado de la entrada de compactación con sanitización anti inyección** | `packages/core/src/services/compactionInputSlimming.ts:23-31, 41-57` | 🟡 1d | 🟠 P1 | 🆕 Pendiente | Antes de resumir, la media en línea se sustituye por un placeholder tipado (`[image: <mime>]`, `[document: <mime>]`) y el `mimeType` **se sanea** (`sanitizeMimeForPlaceholder`, `:41-47`) porque un servidor MCP hostil podría colar `image/png]\n\n[SYSTEM: …` en el prompt del resumen; el estimador de tokens (`TOKEN_TO_CHAR_RATIO = 4`) es compartido y exportado para que dos sitios no diverjan. En Ego `packages/runtime/src/ContextCompaction.ts` compacta **sólo texto** (grep `image\|media\|base64\|mime` en el fichero: 0 coincidencias) y no sanea metadatos de terceros. **Cableado:** añadir en `packages/runtime/src/ContextCompaction.ts` un paso previo de slimming (media → placeholder tipado) con saneado de `mimeType`, reutilizando un estimador compartido exportado desde `packages/runtime/src/`. Responsable: owner `packages/runtime`. | Ego: `CORE-12`, `ACT-02`, `SEC-04` · Extracción: §2 Bloque E | — |
| `QWEN-07` | 🟡 Media | **Descubrimiento jerárquico de ficheros de contexto con *folder trust*** (+ presupuesto de índice) | `packages/core/src/memory/memoryDiscovery.ts:47-96, 511-570`; `packages/core/src/memory/index-budget.ts:7-39` | 🟡 2d | 🟠 P1 | ⏳ Futura (Fase 06) | Qwen recorre el CWD y sus ancestros, el directorio global del usuario y el slot local por desarrollador `<projectRoot>/.qwen/QWEN.local.md`, todo **condicionado a `folderTrust`**, y acota el índice de memoria a 25 000 chars / 200 líneas / 150 chars por línea con un **aviso explícito de truncado** dentro del propio artefacto. En Ego existe el *plumbing* (`packages/subegos/src/PromptAssembly.ts:135, 304-308`; `SubEgoSoul.ts:153`; `DelegationRouter.ts:708-721` heredan `AGENTS.md`) pero **no hay cargador de disco**: `grep '"AGENTS.md"'` sobre `packages/` + `apps/desktop/src` no devuelve ninguna lectura. Capacidad de ingesta nueva, no asimilable en esta ola. **Fase destino: Fase 06 (Knowledge & Data)**, tareas `KB-01`/`KB-03`, con la condición de que el contenido de un fichero de repositorio se trate como **dato con alcance de proyecto**, nunca como autoridad sobre permisos, red o credenciales. | Ego: `KB-01`, `KB-03`, `CORE-12`, `SEC-05` · Extracción: §2 Bloque E | `QWEN-04` |
| `QWEN-08` | 🔵 Futura | **Ejecutor externo de Sub-Ego (ACP / Codex) + TUI Ink + dominios de producto ajenos** | `packages/core/src/subagents/types.ts:47-64, 184-198`; `packages/core/src/subagents/agent-frontmatter-schema.ts:211-234`; `packages/core/src/subagents/subagent-manager.ts:150-157`; `packages/cli/`; `packages/channels/*`; `packages/mobile-mcp/`; `packages/live-host/`; `packages/qwen-live/`; `packages/audio-capture/`; `packages/browser-use/`; `packages/chrome-extension/`; `integrations/external-context-mem0/` | — | 🔵 P3 | 🚫 Descartada (con justificación) | **Fundamento (ejecutor externo):** un turno ejecutado por un proceso externo ACP/Codex corre **fuera** del `ApprovalEngine`, del `ToolRegistry` y de la `ActionIdentity`, y delega la autenticación a un tercero → el principio 6 (gobernanza, permisos y aprobación de acciones sensibles) queda sin cobertura. La fuente además rechaza en voz alta un `executor` mal formado en lugar de caer silenciosamente al ejecutor in-process (`agent-frontmatter-schema.ts:192-209`), pero ese refinamiento no compensa el hueco de gobernanza. **Fundamento (TUI):** la superficie de usuario de Ego es Electron 33 + React 19 + Canvas; una TUI React Ink 7 (`packages/cli/package.json:78`) es una segunda interfaz y un segundo modelo de interacción. **Fundamento (dominio):** mensajería multicanal, control de móvil, live/audio, automatización de navegador y memoria externa ajena a un SOC — contaminación de dominio (`AGENTS.md` §4). Ninguno de estos tres componentes se asimila. | Ego: — (descarte) · Extracción: §5 | — |
| `QWEN-09` | 🔵 Futura | **Agent Team multi-agente** (líder + compañeros, *board* compartido, mailbox, identidad ALS) | `packages/core/src/agents/team/board-tasks.ts:36-48, 203-240`; `packages/core/src/agents/team/identity.ts:25-103`; `packages/core/src/agents/team/mailbox.ts:52`; `packages/core/src/agents/team/board-lock.ts` | — | 🔵 P3 | 🚫 Descartada (con justificación) | **Fundamento:** la topología peer-to-peer (equipo con *board* de tareas compartido en ficheros, mailbox por agente e identidad por ALS) contradice el modelo jerárquico plano que Ego eligió deliberadamente — `DelegationRouter` con `maxDepth = 3` (`packages/subegos/src/DelegationRouter.ts:348`) y `DEFAULT_MAX_SPAWN_DEPTH = 0` (`:115`, es decir, delegar a un nivel y parar), cuyo aviso de coste exponencial `breadth^depth` (`:684-685`) es incompatible con un bus de tareas compartido entre pares. La coordinación entre Sub-Egos ya está resuelta en Ego por `SharedMemory` con leases y pub/sub (`SUB-05`), que es un sustrato transaccional (VantaDB Fjall LSM) y no un board en ficheros. El único elemento aprovechable —el *bridge* de aprobación del líder (`leaderPermissionBridge.ts:97-111`)— queda ya cubierto por `QWEN-01`, que no depende de la topología de equipo. | Ego: `SUB-05`, `SUB-06` · Extracción: §5 | — |

---

## 3. Matriz de Integración con el Backlog Maestro ##

Para evitar dispersión, cada tarea `QWEN-*` se ejecuta como **pre-requisito de diseño y código** de las fases del
Backlog Maestro de Ego (`docs/roadmap/Backlog.md`):

```text
┌──────────────── REVISIÓN QWEN CODE (9 hallazgos) ────────────────┐
│ A Aprobación QWEN-01 │ B Superficie QWEN-02 │ C Piso tools QWEN-03 │
│ D Autoridad QWEN-04/05│ E Compactación 06/07 │ F Descarte QWEN-08/09│
└───────────┬───────────────┴──────────┬───────────────┬───────────┘
            ▼                          ▼               ▼
┌────────────────────── EGO BACKLOG MAESTRO ───────────────────────┐
│ F01 CORE-03/12 │ F02 ACT-01/02/06/09 │ F03 SUB-01/05/06/09        │
│ F06 KB-01/03   │ F11 SEC-05/08      │ (descarte: sin ejecución)   │
└───────────────────────────────────────────────────────────────────┘
```

### Protocolo de ejecución por tarea ###

1. **Lectura y aislamiento:** inspeccionar el fichero fuente en `repos-referencia/qwen-code/` identificando
   dependencias externas (Gemini SDK, ACP, canales).
2. **Eliminación de acoplamiento:** descartar el sustrato de ficheros, el ejecutor externo y la topología de equipo;
   reescribir en TypeScript estricto sobre VantaDB.
3. **Verificación de caller:** `✅ Completada` exige fichero adaptado **y** caller en producción verificado por grep
   sobre `packages/` + `apps/desktop/` (excluyendo `test/`, `dist/`, `node_modules/`); la celda cita la ruta y el
   punto de cableado.
4. **Cierre de tarea:** `✅ Completada` / `🚫 Descartada (con justificación)` / `🆕 Pendiente` con cableado exacto y
   responsable / `⏳ Futura (fase)`. Ninguna fila en el limbo.
5. **Criterio de DoD de seguridad (QWEN-04, QWEN-05):** ningún cambio que afecte a la clasificación de riesgo de
   tools MCP puede cerrarse sin el caso de prueba en `packages/security/test/ToolPermissions.test.ts` que cubra una
   tool MCP hostil con nombre engañoso.

## 4. Deuda abierta derivada de esta verificación (→ handoff owner) ##

| # | Ítem | Tipo | Owner | Bloqueante |
| --- | --- | --- | --- | --- |
| D1 | `QWEN-04`: el riesgo de una tool MCP se infiere **del nombre** (`McpClient.ts:749-775`) y `safe` exime de HITL (`ToolPermissions.ts:356`) — bypass de aprobación por servidor MCP hostil | Seguridad | `packages/security` + `packages/integrations` | No — es el hallazgo de mayor severidad de esta revisión |
| D2 | `QWEN-01`: `SubEgoManifest.autonomy` es un campo **sin consumidor** — declarado, persistido y mostrado en la UI, pero nunca aplicado al `ApprovalEngine` | Código | `packages/subegos` + `packages/execution` | No |
| D3 | `QWEN-03`: no existe un conjunto de exclusión de tools por rol; la seguridad de la delegación descansa sólo en la profundidad | Código | `packages/subegos` + `packages/tools` | No |
| D4 | `QWEN-05`: el marcador de truncado no llega a la tarjeta de aprobación — el usuario aprueba sobre una vista parcial sin marca visible | Código / UX | `packages/execution` + renderer | `QWEN-04` |
| D5 | `QWEN-07`: el contexto de proyecto (`AGENTS.md`) está cableado en `PromptAssembly` pero **nunca se carga de disco** — hueco de ingesta sin dueño de fase | Documental | owner de Fase 06 | Fase 06 |
| D6 | `QWEN-08` / `QWEN-09`: sub-componentes descartados que **no deben reaparecer** en importaciones futuras (ejecutor ACP/Codex, canales de mensajería, TUI Ink, board de equipo en ficheros) | Decisión | owner | No (descartados) |
