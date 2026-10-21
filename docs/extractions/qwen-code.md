# Extracción Técnica: Qwen Code (repos-referencia/qwen-code) #

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de patrones |
| Repositorio Origen | `repos-referencia/qwen-code/` (Commit verificado: `6ec1b83`, rama `main`, profundidad 1 — `.git/refs/heads/main` = `6ec1b830448793c4aef672340a44f488045bc962`) |
| Stack del Origen | TypeScript strict ESM (Node.js ≥22) + React 19.2 + Ink 7.0.3 (TUI) + pnpm workspaces (18 paquetes) + MCP cliente/servidor + memoria local en ficheros · Apache-2.0 · versión `0.25.3` |
| Rol en Ego | Contrapunto directo del modelo de **Sub-Egos**: agente de código con sistema multi-agente y subagentes declarativos por fichero Markdown |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Licencia | Apache-2.0 (Qwen Code, `QwenLM/qwen-code`) — asimilación por **adaptación de patrón**, sin copia de código |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia ##

Qwen Code es un fork open source de Gemini CLI (28.5k estrellas, Apache-2.0). Para Ego su valor **no está en
el producto** (CLI de terminal, TUI en Ink, canales de mensajería, control de móvil) sino en **tres terrenos que tocan
el núcleo del Cognitive Runtime**: (a) el modelo de subagentes declarativos por fichero Markdown, (b) la disciplina
de **presupuesto de la superficie visible al modelo**, y (c) las **reglas de autoridad** que separan lo que un
tercero afirma de lo que el usuario ha autorizado.

El punto de contacto más agudo con Ego es el **modelo multi-agente**: Qwen Code define subagentes como ficheros
Markdown con frontmatter YAML (`packages/core/src/subagents/types.ts:71-213`), resueltos por precedencia de nivel
(`session > project > user > extension > builtin`, `types.ts:39-44`), con allowlist/denylist de tools declarativa
(`types.ts:78-90`). Ego ya tiene un modelo de Sub-Ego **más rico** —manifiesto Zod con `soul`, `namespaces`,
`budget`, `SharedMemory` con leases y `DelegationRouter` jerárquico—, por lo que **el modelo de Sub-Ego de Ego no
se sustituye**: se complementan en tres puntos concretos que Qwen resuelve mejor (modo de aprobación efectivo,
coste de la superficie declarada, piso de exclusión de tools).

El hallazgo de mayor impacto para el owner es `QWEN-04`: Qwen establece que las `annotations` MCP
(`readOnlyHint`, `destructiveHint`…) son **autodeclaradas por el servidor y nunca verificables**, y que el nombre de
una tool de terceros **no es autoridad**. Ego hace justo lo contrario en
`packages/integrations/src/mcp/McpClient.ts:749-775`, donde el nivel de riesgo de una tool MCP se infiere
**exclusivamente del nombre** (`read_*` ⇒ `safe`) y ese nivel decide si la llamada entra o no en la compuerta HITL
(`packages/security/src/ToolPermissions.ts:356`).

### Divergencias Fundamentales (Qué Descartamos y Por Qué) ###

| Dimensión | Qwen Code | Ego (Cognitive OS) | Decisión Crítica |
| --- | --- | --- | --- |
| **Superficie de usuario** | CLI + TUI React Ink 7 (`packages/cli/package.json:78`) | Electron 33 + React 19 renderer + Canvas dinámico | **DESCARTAR TUI**. Duplica el shell de chat y el Canvas de Ego y obliga a mantener dos modelos de interacción. |
| **Modelo de agente** | Subagentes = Markdown + YAML frontmatter en disco (`.qwen/agents/*.md`), precedencia por nivel | Sub-Ego = manifiesto Zod persistido en VantaDB (`gov/sub_egos`) con `soul`, `namespaces`, `budget` | **ADAPTAR, no sustituir**. El modelo de Ego es superior en identidad y aislamiento; de Qwen se extraen tres elementos (modo de aprobación, presupuesto de superficie, piso de tools). |
| **Topología de coordinación** | Equipo plano: líder + compañeros con *board* compartido, mailbox e identidad ALS (`packages/core/src/agents/team/`) | Jerárquica: `DelegationRouter` padre→hijo con `maxDepth=3` y `DEFAULT_MAX_SPAWN_DEPTH=0` (plano) | **DESCARTAR la topología de equipo**. Contradice `SUB-06` y el modelo de coste `breadth^depth`. |
| **Persistencia** | Ficheros Markdown/JSON en disco, locks por fichero (`packages/core/src/agents/team/board-lock.ts`) | VantaDB 0.8.0 in-process (Fjall LSM) + namespaces + leases | **DESCARTAR el sustrato de ficheros**. Solo se extraen los patrones lógicos. |
| **Ejecución de turno** | In-process (`AgentCore`) o proceso externo vía ACP/Codex (`types.ts:47-64`) | Cognitive Runtime propio en Node 22 Main + `ToolExecutionLoop` + `ApprovalEngine` | **DESCARTAR el ejecutor externo**: ejecuta fuera del `ApprovalEngine`, rompiendo el principio 6. |
| **Clasificación de riesgo MCP** | Las `annotations` del servidor son pista no verificada (`permissions/classifier-prompts/system-prompt.ts:101-109`) | Riesgo inferido por el **nombre** de la tool (`McpClient.ts:749-775`) | **ADAPTAR Y CORREGIR**: es un gap de seguridad de Ego, no una mejora cosmética. |

---

## 2. Inventario Quirúrgico de Patrones a Extraer ##

### Bloque A: Subagentes declarativos, precedencia y modo de aprobación ###

*Ubicación en fuente:* `packages/core/src/subagents/`

1. **Modo de aprobación por definición de subagente (`types.ts:99-106`, `agent-frontmatter-schema.ts:26-33, 61-68`)**
   - **Qué hace:** cada definición declara su propio `approvalMode`; si se omite, se hereda del padre con regla
     explícita ("los modos permisivos del padre ganan; si no, `auto-edit`"). El mapa
     `permissionMode → approvalMode` (`agent-frontmatter-schema.ts:61-68`) conserva la intención restrictiva de
     `dontAsk` mapeándolo a `default` y no a `auto-edit`.
   - **Adaptación en Ego:** el manifiesto `SubEgoManifest` ya declara `autonomy`
     (`packages/subegos/src/SubEgoManifest.ts:109, 228`) pero **ningún módulo lo lee**: `grep -i autonomy` sobre
     `packages/execution/src` y `packages/decision/src` devuelve **0 coincidencias**; sólo aparece en esquema,
     fábrica, plantillas y en la vista `apps/desktop/renderer/components/sub-egos.tsx:576`. El campo es hoy un
     interruptor decorativo.
   - **Relación con Backlog Ego:** `SUB-01`, `SUB-09`, `ACT-06`, `SEC-05`.

2. **Modo `bubble` — escalada de confirmación a la sesión padre (`types.ts:29, 99-105`)**
   - **Qué hace:** un subagente en segundo plano que necesita confirmación **no se auto-deniega**: su solicitud se
     "burbujea" a la sesión padre, que la muestra con una insignia del agente emisor
     (`packages/core/src/agents/team/leaderPermissionBridge.ts:97-111, 121-140`).
   - **Adaptación en Ego:** `ApprovalEngine` ya transporta `subEgoId` en la `ActionIdentity` y en la solicitud
     (`packages/execution/src/ApprovalEngine.ts:22, 47, 90, 242`) y la UI lo muestra
     (`apps/desktop/renderer/components/activity-widget/ActivityWidget.tsx:169`). Falta la **derivación del modo a
     partir del manifiesto** (ver punto 1), no el transporte.
   - **Relación con Backlog Ego:** `ACT-06`, `ACT-07`, `SUB-01`.

### Bloque B: Disciplina de coste de la superficie visible al modelo ###

*Ubicación en fuente:* `packages/core/src/tools/agent/`, `packages/core/src/subagents/builtin-agents.ts`

1. **Allowlist declarativa de tools con contabilidad de token (`builtin-agents.ts:280-342`)**
   - **Qué hace:** el subagente `review-agent` declara explícitamente sus 6 tools en vez de heredar el registro
     completo. El comentario de la fuente registra la medición: **21 178 tokens de declaraciones de tools por
     turno** con herencia completa frente a **3 447** con allowlist, y un prompt de entrega que cayó de 139 013 a
     55 897 tokens (**−59,8 %**).
   - **Adaptación en Ego:** `SubEgoManifest.tools` (`SubEgoManifest.ts:101`) existe y `SubEgoSelector`
     (`packages/decision/src/SubEgoSelector.ts:36-37`) filtra por nombre, pero **no existe ninguna verificación de
     coste** de la superficie declarada. La fuente aporta el método (medir, no suponer) y un umbral verificable en
     test.
   - **Relación con Backlog Ego:** `SUB-01`, `SUB-09`, `ACT-01`, `CORE-03`.

2. **Presupuesto por turno de la superficie de una tool (`agent-description-budget.test.ts:17-37`)**
   - **Qué hace:** cada carácter de la descripción y del esquema de parámetros de una tool se paga en **cada**
     request; el test fija presupuestos por turno con una cláusula legítima que cabe y un bloque de prosa que no.
     La regla: *"una descripción de tool se paga en cada turno"* ⇒ se mide, no se estima.
   - **Adaptación en Ego:** apply a `packages/tools/src/ToolRegistry.ts:23` (registro) y al constructor de
     peticiones del runtime: un presupuesto por descripción/esquema, con test que falle si se renombra un parámetro
     presupuestado.
   - **Relación con Backlog Ego:** `ACT-01`, `ACT-02`, `SUB-09`.

### Bloque C: Piso de capacidad y anti fan-out ###

*Ubicación en fuente:* `packages/core/src/agents/runtime/subagent-plan-tool-policy.ts`

1. **Conjunto de exclusión fail-closed para subagentes (`subagent-plan-tool-policy.ts:20-23, 51-83`)**
   - **Qué hace:** un `Set` explícito de tools que **nunca** están disponibles para un subagente no-equipo:
     `WORKFLOW` (excluido para impedir fan-out recursivo `O(k^n)`), `TASK_CREATE/UPDATE/LIST`, `TODO_WRITE`,
     `TEAM_CREATE/DELETE`, `ENTER/EXIT_WORKTREE`, `SEARCH_MEMORY`/`MANAGE_MEMORY` y las tools de ciclo de plan. El
     razonamiento está escrito: son tools de plano de control que pertenecen al padre; exponerlas sólo amplía la
     superficie de interferencia cruzada.
   - **Adaptación en Ego:** `DelegationRouter` limita la profundidad
     (`packages/subegos/src/DelegationRouter.ts:348, 393-394`) y fija `DEFAULT_MAX_SPAWN_DEPTH = 0` (`:115`), pero
     el límite es **de profundidad, no de superficie**: un Sub-Ego con `tools: ["task_create"]` podría escribir en
     el plano de control del padre.
   - **Relación con Backlog Ego:** `SUB-06`, `SUB-05`, `ACT-01`, `ACT-06`.

### Bloque D: Frontera de autoridad y proyección acotada para terceros ###

*Ubicación en fuente:* `packages/core/src/permissions/`, `packages/core/src/tools/`

1. **Las `annotations` MCP son pista no verificada (`classifier-prompts/system-prompt.ts:101-109`)**
   - **Qué hace:** el clasificador de auto-modo recibe `readOnlyHint`/`destructiveHint`/`idempotentHint`/
     `openWorldHint` marcadas como **autodeclaradas por el servidor**: "pueden aumentar la sospecha pero nunca
     justificar permitir una acción por sí solas". La misma línea establece que los marcadores de truncado
     (`…[truncated N chars]`, `[omitted: …]`) **nunca son evidencia de seguridad**: lo omitido no es ausencia.
   - **Adaptación en Ego:** corregir `packages/integrations/src/mcp/McpClient.ts:320, 749-775` (riesgo inferido del
     nombre) y `packages/security/src/ToolPermissions.ts:349-356` (nivel `safe` ⇒ sin HITL).
   - **Relación con Backlog Ego:** `SEC-05`, `SEC-08`, `ACT-01`, `ACT-09`.

2. **Proyección acotada de la llamada MCP con truncado siempre visible (`tools/mcp-classifier-input.ts:18-48, 65-70`)**
   - **Qué hace:** la llamada MCP se proyecta al clasificador con presupuesto compartido
     (`MCP_CLASSIFIER_MAX_TOTAL_CHARS = 16 000`), tope por cadena (2 000), profundidad (8) y entradas (64); **todo
     corte deja un marcador en línea** y activa `arguments_truncated`/`name_truncated`. La lista de claves de
     `annotations` que se reenvían está exportada para que el test del prompt afirme que **toda clave reenviada
     aparece nombrada en el prompt** como no verificada.
   - **Adaptación en Ego:** el equivalente en la compuerta HITL es
     `apps/desktop/renderer/components/tools/ApprovalCard.tsx` y la proyección en
     `packages/execution/src/ExecutionManager.ts:467-501` (que ya marca `truncated: true`, pero no lo propaga a la
     tarjeta).
   - **Relación con Backlog Ego:** `ACT-06`, `ACT-07`, `SEC-05`, `SEC-08`.

### Bloque E: Compactación y contexto de proyecto por ficheros ###

*Ubicación en fuente:* `packages/core/src/services/`, `packages/core/src/memory/`

1. **Adelgazado de la entrada de compactación con sanitización anti inyección**
   (`services/compactionInputSlimming.ts:23-31, 41-57`)
   - **Qué hace:** antes de resumir, la media en línea se sustituye por un placeholder tipado
     (`[image: <mime>]`, `[document: <mime>]`); el `mimeType` **se sanea** (`sanitizeMimeForPlaceholder`, `:41-47`)
     porque un servidor MCP hostil podría colar `image/png]\n\n[SYSTEM: …` en el prompt del resumen. El estimador
     de tokens (`TOKEN_TO_CHAR_RATIO = 4`) es compartido y exportado para que dos sitios no divergan.
   - **Adaptación en Ego:** `packages/runtime/src/ContextCompaction.ts` opera **sólo sobre texto** (grep
     `image|media|base64|mime` en el fichero: 0 coincidencias); no hay slimming de entrada ni sanitización de
     metadatos de terceros.
   - **Relación con Backlog Ego:** `CORE-12`, `ACT-02`, `SEC-04`.

2. **Descubrimiento jerárquico de ficheros de contexto con *folder trust* (`memory/memoryDiscovery.ts:47-96, 511-570`)**
   - **Qué hace:** se recorren el CWD y sus ancestros, el directorio global del usuario y el slot local por
     desarrollador `<projectRoot>/.qwen/QWEN.local.md`, todo **condicionado a `folderTrust`**, con concurrencia
     limitada (10) y recorrido por lotes para no agotar descriptores de fichero.
   - **Adaptación en Ego:** existe el *plumbing* (`packages/subegos/src/PromptAssembly.ts:135, 304-308`,
     `SubEgoSoul.ts:153`, `DelegationRouter.ts:708-721` heredan `AGENTS.md`), pero **no existe cargador de disco**:
     `grep '"AGENTS.md"'` sobre `packages/` + `apps/desktop/` no devuelve ninguna lectura. Falta la jerarquía, el
     gate de confianza y el slot local.
   - **Relación con Backlog Ego:** `KB-01`, `KB-03`, `CORE-12`, `SEC-05`.

---

## 3. Matriz de Extracción vs Descarte ##

| Componente Qwen Code | Hallazgo | Acción en Ego | Razón Técnica / Arquitectónica |
| --- | --- | :---: | --- |
| `subagents/types.ts:29, 99-106` + `agent-frontmatter-schema.ts:61-68` | `QWEN-01` | **EXTRAER & ADAPTAR** | El modo de aprobación efectivo debe derivarse del manifiesto; hoy `autonomy` es un interruptor sin consumidor. |
| `agents/team/leaderPermissionBridge.ts:97-111` | `QWEN-01` | **EXTRAER & ADAPTAR** | La escalada de confirmación al padre ya existe en el transporte de Ego; falta la política que la origina. |
| `subagents/builtin-agents.ts:280-342` | `QWEN-02` | **EXTRAER & ADAPTAR** | Allowlist declarativa con contabilidad de token: −59,8 % de prompt en un caso real y medido. |
| `tools/agent/agent-description-budget.test.ts:17-37` | `QWEN-02` | **EXTRAER & ADAPTAR** | Presupuesto por turno de descripciones y esquemas, fijado por test. |
| `agents/runtime/subagent-plan-tool-policy.ts:51-83` | `QWEN-03` | **EXTRAER & ADAPTAR** | Piso fail-closed de tools: defence en profundidad frente al fan-out `O(k^n)` y al plano de control. |
| `permissions/classifier-prompts/system-prompt.ts:101-109` | `QWEN-04` | **EXTRAER & ADAPTAR** | Las `annotations` MCP no son autoridad; el nombre de la tool tampoco. Gap de seguridad real en `McpClient.ts:749-775`. |
| `tools/mcp-classifier-input.ts:18-48, 65-70` | `QWEN-05` | **EXTRAER & ADAPTAR** | Proyección acotada con truncado siempre visible: lo omitido nunca se presenta como ausente. |
| `services/compactionInputSlimming.ts:23-31, 41-57` | `QWEN-06` | **EXTRAER & ADAPTAR** | Slimming de entrada + sanitización de metadatos de terceros antes del prompt de resumen. |
| `memory/memoryDiscovery.ts:47-96, 511-570` | `QWEN-07` | **EXTRAER PATRÓN** | Descubrimiento jerárquico + gate de confianza; se difiere a la fase de Knowledge (ingesta). |
| `memory/index-budget.ts:7-39` | `QWEN-07` | **EXTRAER PATRÓN** | Presupuesto de índice con aviso explícito de truncado (25 000 chars / 200 líneas / 150 por línea). |
| `subagents/types.ts:47-64, 184-198` + `agent-frontmatter-schema.ts:211-234` + `subagent-manager.ts:150-157` | `QWEN-08` | 🚫 **Descartada (con justificación)** | El ejecutor externo (ACP/Codex) ejecuta el turno fuera del `ApprovalEngine` y del `ActionIdentity`: el principio 6 queda sin cobertura. |
| `agents/team/` (`board-tasks.ts:36-48, 203-240`, `identity.ts:25-103`, `mailbox.ts`) | `QWEN-09` | 🚫 **Descartada (con justificación)** | Topología de equipo (líder + compañeros, board compartido, mailbox) incompatible con la delegación jerárquica plana de Ego (`SUB-06`). |
| `packages/cli/` (TUI React Ink 7) + `agents/backends/TmuxBackend.ts`, `ITermBackend.ts` | `QWEN-08` | 🚫 **Descartada (con justificación)** | La UI de terminal de Ego es el shell Electron; una TUI es una segunda superficie de producto. |
| `packages/channels/*`, `mobile-mcp/`, `live-host/`, `qwen-live/`, `audio-capture/`, `browser-use/`, `chrome-extension/`, `integrations/external-context-mem0/` | `QWEN-08` | 🚫 **Descartada (con justificación)** | Contaminación de dominio: mensajería, control de dispositivo, live/audio, navegador y memoria externa ajenas a un SOC. |

---

## 4. Estado real verificado (2026-10-20) ##

> Criterio de cierre (`AGENTS.md` §4, `docs/extractions/README.md` §4): `✅ Completada` exige fichero adaptado **y**
> caller en producción verificado por grep sobre `packages/` + `apps/desktop/` (excluyendo `test/`, `dist/`,
> `node_modules/`).
>
> **Este repositorio de referencia es nuevo: nada ha sido asimilado todavía.** Las búsquedas de verificación
> ejecutadas:

```text
grep -ri "autonomy"        packages/execution/src packages/decision/src -> 0 coincidencias
    (sólo esquema, fábrica, plantillas y UI)
grep -rn "readOnlyHint|annotations" packages/                      -> 0 coincidencias
    (las annotations MCP no se leen)
grep -rn "inferRiskLevel"   packages/integrations/src             -> McpClient.ts:320, 749-775
    (riesgo por nombre)
grep -rn "image|media|base64|mime" packages/runtime/src/ContextCompaction.ts -> 0 coincidencias
grep -rn '"AGENTS.md"'      packages/ apps/desktop/src            -> 0 lecturas de disco
    (sólo comentarios y el propio repo)
```

| ID | Patrón | Estado | Evidencia / Fundamento |
| --- | --- | :---: | --- |
| `QWEN-01` | Modo de aprobación efectivo derivado del manifiesto (`approvalMode` + `bubble`) | 🆕 Pendiente | El campo existe y no se aplica: `SubEgoManifest.autonomy` (`packages/subegos/src/SubEgoManifest.ts:109, 228`) tiene **0 consumidores** en `packages/execution/src` y `packages/decision/src`. **Cableado:** derivar `approvalMode` efectivo en `packages/subegos/src/SubEgoManifest.ts` y aplicarlo en `packages/execution/src/ApprovalEngine.ts` (hoy sólo transporta `subEgoId`, `:22, 47, 242`) y en `packages/subegos/src/DelegationRouter.ts` al construir el contexto hijo. Responsable: owner de `packages/subegos` + `packages/execution`. |
| `QWEN-02` | Presupuesto de la superficie visible al modelo (allowlist + contabilidad de tokens) | 🆕 Pendiente | La superficie declarada existe (`SubEgoManifest.tools`, `packages/subegos/src/SubEgoManifest.ts:101`; filtro en `packages/decision/src/SubEgoSelector.ts:36-37`) pero **no hay medición ni umbral**. **Cableado:** añadir el verificador de coste al registro de `packages/tools/src/ToolRegistry.ts:23` y un test de presupuesto por turno en `packages/runtime/` que falle si una descripción de tool crece sin límite. Responsable: owner de `packages/tools` + `packages/runtime`. |
| `QWEN-03` | Piso fail-closed de exclusión de tools por rol de Sub-Ego | 🆕 Pendiente | Ego limita profundidad (`packages/subegos/src/DelegationRouter.ts:348, 393-394`) y fan-out (`DEFAULT_MAX_SPAWN_DEPTH = 0`, `:115`) pero **no tiene un conjunto de exclusión de tools**: un Sub-Ego con `tools: ["task_create"]` alcanza el plano de control del padre. **Cableado:** publicar el conjunto de exclusión en `packages/subegos/src/` y aplicarlo al filtrado de tools de `packages/tools/src/ToolRegistry.ts` en la construcción del contexto delegado. Responsable: owner de `packages/subegos` + `packages/tools`. |
| `QWEN-04` | Las `annotations` MCP y el nombre de la tool no son autoridad | 🆕 Pendiente | **Gap de seguridad en Ego:** `packages/integrations/src/mcp/McpClient.ts:320, 749-775` deriva el nivel de riesgo **sólo del nombre** (`read_*` ⇒ `safe`) y `packages/security/src/ToolPermissions.ts:356` deja fuera de la compuerta HITL todo lo que no sea `destructive`/`sensitive`. Un servidor MCP hostil puede nombrar una tool `read_*` y obtener aprobación automática. **Cableado:** en `McpClient.ts`, dejar de derivar `safe` por nombre (usar `sensitive` por defecto para MCP salvo allowlist explícita del usuario) y leer `annotations` **sólo** para subir de nivel, nunca para bajarlo. Responsable: owner de `packages/security` + `packages/integrations`. |
| `QWEN-05` | Proyección acotada con truncado siempre visible | 🆕 Pendiente | `packages/execution/src/ExecutionManager.ts:467-501` ya marca `truncated: true` en el resultado, pero **el marcador no viaja a la tarjeta de aprobación** (`apps/desktop/renderer/components/tools/ApprovalCard.tsx`, sin referencia a truncado) ni a la proyección del clasificador. **Cableado:** propagar el marcador `…[truncated N chars]` al payload de `ipc.approval.request` (`apps/desktop/src/main.ts:2410-2411`) y renderizarlo en `ApprovalCard.tsx`. Responsable: owner de `packages/execution` + renderer. |
| `QWEN-06` | Slimming de la entrada de compactación con sanitización de metadatos | 🆕 Pendiente | `packages/runtime/src/ContextCompaction.ts` compacta **sólo texto** y **no sanea** metadatos de terceros: un `mimeType` hostil que llegue al prompt de resumen rompe el sobre del placeholder. **Cableado:** añadir en `packages/runtime/src/ContextCompaction.ts` un paso previo de slimming (media → placeholder tipado) con saneado de `mimeType`, y reutilizar el estimador compartido de tokens. Responsable: owner de `packages/runtime`. |
| `QWEN-07` | Descubrimiento jerárquico de ficheros de contexto con gate de confianza | ⏳ Futura (Fase 06) | El *plumbing* existe (`packages/subegos/src/PromptAssembly.ts:135, 304-308`) pero **no hay cargador de disco** (`grep '"AGENTS.md"'` → 0 lecturas). Capacidad de ingesta nueva, no asimilable aún. **Fase destino: 06 (Knowledge & Data)**, tareas `KB-01`/`KB-03`, con la condición de que el contenido de fichero de repositorio se trate como **dato con alcance de proyecto**, nunca como autoridad sobre permisos o red. |
| `QWEN-08` | Ejecutor externo de Sub-Ego (ACP / Codex) + TUI y dominios ajenos | 🚫 Descartada (con justificación) | Un turno ejecutado por un proceso externo corre **fuera** del `ApprovalEngine`, del `ToolRegistry` y de la `ActionIdentity`: el principio 6 (gobernanza y aprobación de acciones sensibles) queda sin cobertura y el agente delegado usa su propia autenticación. La UI TUI (Ink 7) duplicaría el shell Electron de Ego, y los canales de mensajería, control de móvil, live/audio, navegador y memoria externa son contaminación de dominio (`AGENTS.md` §4). |
| `QWEN-09` | Agent Team multi-agente (líder + compañeros, board, mailbox) | 🚫 Descartada (con justificación) | La topología de equipo (peer-to-peer con *board* compartido en ficheros, mailbox e identidad ALS) contradice el modelo jerárquico plano que Ego eligió deliberadamente: `DelegationRouter` con `maxDepth = 3` y `DEFAULT_MAX_SPAWN_DEPTH = 0` (`packages/subegos/src/DelegationRouter.ts:115, 348`), cuyo aviso de coste exponencial `breadth^depth` (`packages/subegos/src/DelegationRouter.ts:684-685`) es incompatible con un bus de tareas compartido. La coordinación entre Sub-Egos ya está resuelta por `SharedMemory` con leases y pub/sub (`SUB-05`). |

**Recuento:** 0 `✅ Completada` · 2 `🚫 Descartada` · 6 `🆕 Pendiente` · 1 `⏳ Futura` — **9 tareas**. 0 filas en el
limbo.

## 5. Descarte normalizado a la forma canónica (2026-10-20) ##

Las filas de la matriz §3 usaban la forma `**DESCARTAR**`; se normalizan aquí a `🚫 Descartada (con justificación)`
(AGENTS.md §4) conservando el motivo original. Las filas marcadas *(QWEN-08)* / *(QWEN-09)* son **sub-componentes**
de hallazgos ya contados en §4 y **no suman filas al recuento**.

| Componente Qwen Code | Veredicto | Fundamento |
| --- | :---: | --- |
| `subagents/types.ts:47-64, 184-198` · `agent-frontmatter-schema.ts:211-234` · `subagent-manager.ts:150-157` *(QWEN-08)* | 🚫 **Descartada (con justificación)** | El ejecutor externo (ACP/Codex) ejecuta el turno fuera del `ApprovalEngine` y del `ActionIdentity` (principio 6 sin cobertura) y delega la autenticación a un tercero. |
| `packages/cli/` (TUI React Ink 7) · `agents/backends/TmuxBackend.ts`, `ITermBackend.ts` *(QWEN-08)* | 🚫 **Descartada (con justificación)** | La superficie de usuario de Ego es Electron 33 + React 19 + Canvas; una TUI es una segunda interfaz de producto y un segundo modelo de interacción que mantener. |
| `packages/channels/*` (telegram, weixin, dingtalk, wecom, feishu, qqbot, email, github, gitlab) · `mobile-mcp/` · `live-host/` · `qwen-live/` · `audio-capture/` · `browser-use/` · `chrome-extension/` · `integrations/external-context-mem0/` *(QWEN-08)* | 🚫 **Descartada (con justificación)** | Contaminación de dominio: mensajería, control de dispositivo, live/audio, automatización de navegador y memoria externa ajenas al alcance de un Sistema Operativo Cognitivo (`AGENTS.md` §4, repositorios de referencia). |
| `packages/core/src/agents/team/` — `board-tasks.ts:36-48, 203-240` · `identity.ts:25-103` · `mailbox.ts` · `leaderPermissionBridge.ts` *(QWEN-09)* | 🚫 **Descartada (con justificación)** | Topología de equipo peer-to-peer incompatible con la delegación jerárquica plana de Ego (`SUB-06`) y con su modelo de coste exponencial ya documentado. |
