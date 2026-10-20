# Extracción Técnica: Continue (repos-referencia/continue) #

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de patrones |
| Repositorio Origen | `repos-referencia/continue/` (Commit verificado: `5522c6f`, rama `main`, profundidad 1) |
| Stack del Origen | TypeScript estricto + Node 22 + React 19 + Vite; monorepo pnpm con `core/` (runtime headless), `extensions/vscode`, `extensions/intellij`, `packages/config-yaml` (Zod), `packages/continue-sdk` |
| Rol en Ego | Contrapunto *config-driven* del `ModelRouter` y contrato canónico de context providers |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Licencia | Apache-2.0 (`LICENSE:1` — "Apache License / Version 2.0") |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia ##

`continue` es un agente de código open source para IDE (VS Code + JetBrains). Para Ego no es una
fuente de UI ni de runtime de chat: su valor está en **tres planos de configuración declarativa**
que el `ModelRouter` de Ego todavía no tiene:

1. **Registro de providers y capacidades por descriptor** — el provider, su contexto, sus
   capacidades (`tool_use`, `image_input`) y sus parámetros viven en **datos** (YAML/JSON con esquema
   Zod), no en clases TypeScript.
2. **Roles de modelo declarativos con rectificación de selección** — el config declara a qué roles
   sirve cada modelo; la selección persistida se rectifica contra el config vigente y se re-persiste
   para que nunca referencie un modelo inexistente.
3. **Registro de context providers con contrato uniforme** — cada fuente de contexto (fichero
   actual, diff, terminal, problems, reglas, codebase) es una clase con descripción estática y un
   único método `getContextItems(query, extras)`.

Lo que Continue **no** aporta a Ego: autocompletado de tabulación, next-edit, parcheo de diffs,
indexado de codebase con LanceDB/SQLite y un ecosistema de integraciones SaaS (Jira, GitHub Issues,
Postgres, Discord, Google Calendar). Esos bloques son producto ajeno o dominio ajeno.

### Divergencias Fundamentales ###

| Dimensión | Continue | Ego (Cognitive OS) | Decisión |
| --- | --- | --- | --- |
| **Proveedores de modelo** | Registro en código (`LLMClasses`, `core/llm/llms/index.ts:73-135`) + instancias creadas desde config (`core/config/yaml/models.ts:50-146`). Capacidades declaradas en el config (`modelCapabilitySchema`, `packages/config-yaml/src/schemas/models.ts:37-42`). | Registro en código (`packages/models/src/ModelRouter.ts:286`) con 6 adaptadores en `packages/models/src/providers/`; capacidades fijadas en `registerDefaultModels()` (`ModelRouter.ts:857-940`). | **EXTRAER PATRÓN**: mover la *declaración* de providers/capacidades a un catálogo declarativo persistido. |
| **Roles de modelo** | 8 roles declarativos (`modelRolesSchema`, `packages/config-yaml/src/schemas/models.ts:23-33`) resueltos a `modelsByRole` (`core/config/yaml/loadYaml.ts:280-343`). | 4 roles por *clase de capacidad* (`fast-classifier`, `reasoning-heavy`, `coder`, `general-chat`; `packages/models/src/types.ts:21-25`) fijados en código (`ModelRouter.ts:936-939`). | **EXTRAER PATRÓN**: roles declarativos + rectificación de selección persistida. |
| **Selección por rol** | `rectifySelectedModelsFromGlobalContext` (`core/config/selectedModels.ts:10-80`): si la selección persistida desaparece, cae al primer candidato y **reescribe** la persistencia. | `resolveModel` (`ModelRouter.ts:449-547`) resuelve por binding + alias + fallback, pero **no persiste** la elección efectiva. | **EXTRAER PATRÓN**. |
| **Contexto** | Registro de `IContextProvider` con `description` estática y `getContextItems(query, extras)` (`core/context/index.ts:10-37`); 30 providers registrados (`core/context/providers/index.ts:43-74`), defaults + override por config, error no fatal por provider desconocido y filtrado por IDE (`core/config/loadContextProviders.ts:22-95`). | `packages/tasks/src/ContextProvider.ts:24-86` captura **contexto ambiental del SO** (app activa, título de ventana) — concepto distinto. No existe registro de fuentes de contexto de código. | **EXTRAER PATRÓN** (contrato), no la implementación. |
| **Persistencia de config** | Ficheros en disco: `~/.continue/config.yaml`, `~/.continue/.env`, `GlobalContext`. | VantaDB `gov/settings/*` + keychain del SO (`SEC-03`). | **DIVERGENCIA CRÍTICA**: la capa de persistencia de Continue no es aplicable. |
| **Config ejecutable** | `config.ts` compilado con esbuild (`core/config/load.ts:667-789`) que ejecuta código arbitrario en el proceso. | Renderer untrusted, lógica en main, todo IPC validado con Zod (`SEC-02`). | **DESCARTAR**. |
| **Indexado de codebase** | LanceDB + SQLite + reranker (`core/context/retrieval/pipelines/`). | VantaDB HNSW/BM25 + GraphRAG (`KB-03`, `KB-04`, `KB-06`). | **DESCARTAR**: sustrato ya resuelto. |
| **Dominios de negocio** | Jira, GitHub Issues, Postgres, Discord, Google Calendar. | SOC: Knowledge/Product/Engineering/Analytics/CRM (`DOM-01..09`). | **DESCARTAR**: contaminación de dominio (`AGENTS.md` §4). |

---

## 2. Inventario Quirúrgico de Patrones a Extraer ##

### Bloque A — Registro declarativo de providers de modelo ###

1. **Catálogo de providers + capacidades declaradas en config**
   - **Ruta exacta:** `packages/config-yaml/src/schemas/models.ts:178-205` (campos del modelo),
     `:37-42` (capacidades con `z.string()` libre para forward-compat),
     `core/config/yaml/models.ts:44-48` (`getModelClass`), `:103-107` (mapa `tool_use`→`tools`,
     `image_input`→`uploadImage`), `core/llm/llms/index.ts:73-135` (`LLMClasses`).
   - **Qué hace:** el usuario declara en YAML/JSON qué providers existen, con qué base URL, qué
     contexto y **qué capacidades**; el runtime instancia la clase de provider correspondiente y
     proyecta las capacidades a flags del adaptador.
   - **Adaptación en Ego:** catálogo declarativo de providers persistido en
     `gov/settings/model_catalog`, validado con Zod, que registre `ModelDescriptor`
     (`packages/models/src/types.ts:27-36`) en el `ModelRouter` al arrancar, sustituyendo el
     `registerDefaultModels()` hardcodeado (`packages/models/src/ModelRouter.ts:857-940`).
   - **Relación con Backlog Ego:** `CORE-03`, `CORE-04`, `INT-02`.

1. **Descubrimiento de modelos del proveedor con degradación** —
   `core/config/yaml/models.ts:148-187` (sentinel `AUTODETECT`)
   - **Qué hace:** si el config dice `model: AUTODETECT`, pregunta al provider por su catálogo y
     crea una entrada por modelo.
   - **Adaptación en Ego:** ya resuelto por `packages/models/src/ModelCatalog.ts:219-267` (live →
     cache VantaDB → curado), en producción en `apps/desktop/src/main/ipc/register-ipc.ts:18,2345`.
     No se extrae: **sustituido por módulo canónico**.
   - **Relación con Backlog Ego:** `CORE-03` (ya cubierto).

### Bloque B — Roles de modelo y ciclo de vida de la configuración ###

1. **Roles declarativos + rectificación de la selección persistida**
   - **Ruta exacta:** `packages/config-yaml/src/schemas/models.ts:23-33` (`modelRolesSchema`),
     `core/config/yaml/loadYaml.ts:280-343` (roles → `modelsByRole`),
     `core/config/selectedModels.ts:10-80` (`rectifySelectedModelsFromGlobalContext`).
   - **Qué hace:** cada modelo declara los roles que sirve; al cargar se indexa por rol. La
     selección guardada por rol se valida contra los candidatos vigentes; si desaparece, cae al
     primero y **reescribe** la persistencia.
   - **Adaptación en Ego:** `RouterModelSettings` (`packages/models/src/ModelRouter.ts:230-238`) ya
     transporta `availableModels`/`fallbackModel`; falta el binding rol→modelos **por config** y la
     rectificación persistida por proyecto en `gov/settings/model_selection`.
   - **Relación con Backlog Ego:** `CORE-03`, `INT-02`.

1. **Cascada de recarga con cancelación cooperativa**
   - **Ruta exacta:** `core/config/ConfigHandler.ts:46-136` (`cascadeAbortController`,
     `abortCascade()`, `cascadeInit` con `signal`),
     `core/config/profile/ProfileLifecycleManager.ts:42-70` (`clearConfig`/`reloadConfig`/memoización
     del `pendingConfigPromise`).
   - **Qué hace:** cualquier cambio externo (settings del IDE, cambio de perfil, provider MCP)
     dispara una cascada; la cascada en curso se aborta con `AbortController` y la nueva toma el
     relevo, de modo que nunca se aplica un estado a medio construir. Los listeners se notifican
     sólo al final.
   - **Adaptación en Ego:** hoy Ego recarga cachés sueltas e independientes de `gov/settings/*`
     (`apps/desktop/src/main.ts:1156` permisos, `:1198` compresión, `:1978` `model_config`, `:2366`
     `gov/mcp_servers`); un cambio de BYOK puede dejar router, permisos y toolsets en estados
     inconsistentes.
   - **Relación con Backlog Ego:** `INT-02`, `SEC-05`, `ACT-01`.

### Bloque C — Contexto ###

1. **Registro de context providers con contrato uniforme**
   - **Ruta exacta:** `core/context/index.ts:10-37` (`BaseContextProvider`: `description` estática +
     `getContextItems(query, extras)` + `loadSubmenuItems`),
     `core/context/providers/index.ts:43-74` (registro de 30 clases) y `:76-82`
     (`contextProviderClassFromName`), `core/config/loadContextProviders.ts:22-95` (defaults +
     override por config + error no fatal por provider desconocido + filtrado por IDE).
   - **Qué hace:** cada fuente de contexto declara título y tipo (submenú / fichero / contexto) y
     expone un único método de consulta; el loader instancia las clases registradas, aplica params
     del config y **falla de forma no fatal** si un provider configurado no existe.
   - **Adaptación en Ego:** un `ContextProviderRegistry` en `packages/subegos` con el mismo contrato,
     alimentando el TIER 2 / CONTEXT de `buildContextTier`
     (`packages/subegos/src/PromptAssembly.ts:294-317`). Primeros providers: código abierto, código
     relevante, problems, terminal, web.
   - **Relación con Backlog Ego:** `KB-01`, `KB-03`, `CORE-12`, `DOM-01`.

### Bloque D — Motor de tool calls ###

1. **Detección incremental del arranque de una tool call en streaming**
   - **Ruta exacta:** `core/tools/systemMessageTools/detectToolCallStart.ts:3-30` (`isInToolCall`,
     `isInPartialStart`, `modifiedBuffer`),
     `core/tools/systemMessageTools/toolCodeblocks/parseSystemToolCall.ts:11-121`
     (`handleToolCallBuffer` acumula líneas y emite deltas).
   - **Qué hace:** sobre el texto plano que emite un modelo sin tool-calling nativo, detecta
     **durante** el streaming el arranque de un bloque de tool call. El caso `isInPartialStart`
     resuelve la ambigüedad: si el buffer es sólo un prefijo de un token de arranque conocido,
     todavía no se dispara, para no partir una llamada a medio escribir.
   - **Adaptación en Ego:** Ego repara tool calls *a posteriori* sobre el texto completo
     (`packages/runtime/src/ToolExecutionLoop.ts:367-377`, motor
     `packages/tool-call-repair/src/ToolCallRepairEngine.ts`, `balanced-json.ts:22-80`). Falta el
     corte por streaming, que evitaría que el JSON crudo de la llamada llegue a renderizarse en el
     chat.
   - **Relación con Backlog Ego:** `ACT-02`, `ACT-08`.

1. **Overrides de herramientas por modelo**
   - **Ruta exacta:** `core/tools/applyToolOverrides.ts:14-69`,
     `packages/config-yaml/src/schemas/models.ts:106-124` (`toolOverrideSchema`,
     `chatOptionsSchema.toolOverrides`).
   - **Qué hace:** por modelo se puede reescribir la descripción de una tool, su título visible, la
     frase de acción, o **deshabilitarla**; un override que apunta a una tool inexistente produce un
     error no fatal que lista las tools disponibles.
   - **Adaptación en Ego:** el `ToolRegistry` habilita tools por toolset/perfil
     (`packages/tools/src/toolsets.ts:158-179`) pero **no** por modelo ni por capability; nada
     impide hoy pasar a un modelo sin `tool_calling` el schema completo de tools.
   - **Relación con Backlog Ego:** `ACT-01`, `ACT-02`, `SEC-05`.

### Bloque E — Secretos ###

1. **Taxonomía de scopes de secretos con separación location/value**
   - **Ruta exacta:** `packages/config-yaml/src/interfaces/SecretResult.ts:3-11` (`SecretType`:
     user/package/organization/models_add_on/local_env/process_env), `:13-64` (unión discriminada
     `SecretLocation`), `:66-137` (`encodeSecretLocation`/`decodeSecretLocation` reversible).
   - **Qué hace:** un secreto se identifica por **dónde vive** (`user:<slug>/<name>`,
     `organization:<org>/<name>`, `local_env:<NAME>`), no por su valor; el valor sólo aparece en el
     resultado resuelto. La codificación textual hace la referencia portable y auditable.
   - **Adaptación en Ego:** `packages/security/src/CredentialManager.ts:74-91` guarda
     `service`+`account` (plano, sin scope) y el modelo resuelve una única key por provider
     (`apps/desktop/src/main/models/model-config.ts:74-118`). Sin scopes no hay BYOK por proyecto ni
     por organización.
   - **Relación con Backlog Ego:** `SEC-03`, `SEC-04`, `INT-02`.

---

## 3. Matriz de Extracción vs Descarte ##

| Componente Continue | Acción | Razón Técnica / Arquitectónica |
| --- | :---: | --- |
| `packages/config-yaml/src/schemas/models.ts` (esquema de modelo + roles + capacidades) | **EXTRAER PATRÓN** | Fuente de verdad declarativa; reduce el `ModelRouter` a un consumidor de datos. |
| `core/config/yaml/models.ts:50-146` (`modelConfigToBaseLLM`) | **EXTRAER PATRÓN** | Proyección config→descriptor con precedencias explícitas y fusion de `requestOptions`. |
| `core/config/selectedModels.ts` (rectificación) | **EXTRAER PATRÓN** | Elimina referencias persistidas a modelos inexistentes. |
| `core/config/ConfigHandler.ts` (cascada con abort) | **EXTRAER PATRÓN** | Rebind atómico de subsistemas sin estado intermedio. |
| `core/context/index.ts` + `core/context/providers/index.ts` | **EXTRAER PATRÓN** | Contrato uniforme de fuentes de contexto; ausente en Ego. |
| `core/tools/systemMessageTools/detectToolCallStart.ts` | **EXTRAER PATRÓN** | Detección incremental en streaming; el motor de Ego sólo repara a posteriori. |
| `core/tools/applyToolOverrides.ts` | **EXTRAER PATRÓN** | Superficie de tools condicionada al modelo/capability. |
| `packages/config-yaml/src/interfaces/SecretResult.ts` | **EXTRAER PATRÓN** | Referencia de secreto por scope, separada del valor. |
| `core/llm/toolSupport.ts` (`PROVIDER_TOOL_SUPPORT`) | **🚫 Descartada** | Segunda fuente de verdad de capacidades por *nombre de modelo*: se pudre y contradice la declaración por config. |
| `core/context/providers/{JiraIssues,GitHubIssues,Postgres,Discord,Google}*` | **🚫 Descartada** | Contaminación de dominio (`AGENTS.md` §4): modelos de negocio ajenos a un SOC. |
| `core/config/load.ts:667-789` (`config.ts` + esbuild) | **🚫 Descartada** | Configuración ejecutable = ejecución de código arbitrario en el proceso; incompatible con `SEC-02` y con el aislamiento del renderer. |
| `core/util/paths.ts:377-383` + `core/config/load.ts:74-96` (`.env`) | **🚫 Descartada** | Secretos en fichero de texto plano; contraria a `SEC-03`/`SEC-04`. |
| `core/context/retrieval/**` + indexado LanceDB/SQLite | **🚫 Descartada** | Sustrato ya cubierto por VantaDB (HNSW+BM25+GraphRAG: `KB-03`, `KB-04`, `KB-06`). |
| `core/autocomplete/**`, `core/nextEdit/**`, `core/edit/**` | **🚫 Descartada** | Producto de IDE: autocompletado de tabulación, next-edit y parcheo de diffs no son capacidades de un SOC desktop. |
| `core/llm/llms/*` (~60 clases de provider) | **🚫 Descartada** | AI SDK v7 es el adaptador canónico de inferencia (`AGENTS.md` §1); portar 60 clases es sobreingeniería frente a los 6 adaptadores de `packages/models/src/providers/`. |

---

## 4. Estado real verificado (2026-10-20) ##

> Criterio de cierre: fichero adaptado **y** caller en producción verificado por grep sobre
> `packages/` + `apps/desktop/` (excluye `test/`, `dist/`, `node_modules/`). Continue es un
> repositorio de referencia **nuevo**: no hay fichero adaptado ni caller en producción, por lo que
> **no existe ninguna fila en `✅ Completada`** — y no por descuido: cada patrón se contrastó contra
> el código real de Ego antes de decidir.

| ID | Patrón | Estado | Evidencia / Fundamento |
| --- | --- | :---: | --- |
| `CONT-01` | Registro de providers + capacidades declaradas en config | 🆕 Pendiente | No existe catálogo declarativo en Ego: `packages/models/src/providers/` son 6 clases TS y `ModelRouter.registerDefaultModels()` (`packages/models/src/ModelRouter.ts:857-940`) fija descriptors en código. **Cableado:** nuevo `packages/models/src/ModelDescriptorRegistry.ts` que lea el catálogo de `gov/settings/model_catalog` (Zod) y registre descriptors; invocar desde `applyModelConfig` (`apps/desktop/src/main/models/model-config.ts:349`). Owner: A2 (models). |
| `CONT-02` | Roles declarativos + rectificación de la selección | 🆕 Pendiente | `ModelRouter.bindRole` (`packages/models/src/ModelRouter.ts:294`) existe, pero los roles se fijan en código (`:936-939`) y no hay selección persistida por rol. **Cableado:** `applyModelConfig` (`apps/desktop/src/main/models/model-config.ts:349-365`) debe consumir `selectedModelByRole` desde `gov/settings/model_selection`, aplicar la rectificación (persistida → primer candidato → re-persistencia) y llamar a `router.bindRole`. Owner: A2. |
| `CONT-03` | Cascada de recarga con cancelación cooperativa | 🆕 Pendiente | Ego carga cachés sueltas e independientes: `gov/settings/permissions` (`apps/desktop/src/main.ts:1156`), `gov/settings/compression` (`main.ts:1198`), `gov/settings/model_config` (`main.ts:1978`), `gov/mcp_servers` (`main.ts:2366`). No hay coordinador con `AbortController`. **Cableado:** en `apps/desktop/src/main.ts`, un `ConfigReloadCoordinator` que re-ligue router + permisos + toolsets + MCP bajo un único `AbortSignal`, abortando la cascada en curso. Owner: A2/A4. |
| `CONT-04` | Registro de context providers | 🆕 Pendiente | Ego **no** tiene registro de fuentes de contexto: `packages/tasks/src/ContextProvider.ts:24-86` captura contexto ambiental del SO (COUC-16) y su único caller es el re-export `packages/tasks/src/index.ts:14` (grep `ContextProvider` sobre `packages/`+`apps/desktop/`: sólo `packages/tasks/**` y un `NoopContextProvider` del renderer en `apps/desktop/renderer/floating/upload-canvas.ts:649`). **Cableado:** nuevo `packages/subegos/src/context/ContextProviderRegistry.ts` + `providers/{Code,Problems,Terminal,Web}`; invocar desde `buildContextTier` (`packages/subegos/src/PromptAssembly.ts:294`). Owner: A3 (runtime/subegos). |
| `CONT-05` | Detección incremental de tool call en streaming | 🆕 Pendiente | La reparación post-hoc sí está en producción (`packages/runtime/src/ToolExecutionLoop.ts:19,368,375,443` → `packages/tool-call-repair/src/ToolCallRepairEngine.ts`), pero **no** existe detección por chunks: el texto crudo de la tool call puede emitirse al renderer antes de repararse. **Cableado:** en el handler de chunks de `ToolExecutionLoop`, aislar el bloque de tool call con un buffer incremental (`isInToolCall`/`isInPartialStart`) antes de propagar el texto a la UI. Owner: A3/A4. |
| `CONT-06` | Overrides de tools por modelo / gating por capability | 🆕 Pendiente | Ego habilita tools por toolset y perfil (`packages/tools/src/toolsets.ts:158-179`), no por modelo; `ModelDescriptor.capabilities` existe (`packages/models/src/types.ts:34`) pero nada filtra el schema de tools según `tool_calling`. **Cableado:** en `ToolExecutionLoop`, donde se calcula `toolSchemas` antes de `router.streamText` (`packages/runtime/src/ToolExecutionLoop.ts:~340`), filtrar por la capability del descriptor resuelto y aplicar overrides declarados en `gov/settings/model_config.toolOverrides`. Owner: A3. |
| `CONT-07` | Scopes de secretos (location/value) | 🆕 Pendiente | `packages/security/src/CredentialManager.ts:74-91` persiste `service`+`account` sin scope; el modelo resuelve una key por provider (`apps/desktop/src/main/models/model-config.ts:74-118`). No hay BYOK por proyecto ni por organización. **Cableado:** añadir `scope` al `StoredCredentialSchema` y resolver por `global → proyecto` en `resolvePersistedModelKeys`; el tramo `organization` queda para P1 (Cloud/Sync). Owner: A2 + SEC. |
| `CONT-08` | Providers de contexto de dominio ajeno + indexado de codebase | 🚫 Descartada (con justificación) | `core/context/providers/{JiraIssuesContextProvider,GitHubIssuesContextProvider,PostgresContextProvider,DiscordContextProvider,GoogleContextProvider}.ts` y el indexado LanceDB/SQLite (`core/context/retrieval/pipelines/`) son dominio y sustrato ajenos: `AGENTS.md` §4 prohíbe importar modelos de negocio de repos de referencia, y VantaDB ya cubre indexación y búsqueda (`KB-03`, `KB-04`, `KB-06`). Se extrae sólo el contrato (CONT-04). |
| `CONT-09` | `config.ts` ejecutable + dotenv en disco + heurística de capacidades embebida | 🚫 Descartada (con justificación) | (a) `core/config/load.ts:667-789` compila y ejecuta `config.ts` con esbuild dentro del proceso: ejecución de código arbitrario incompatible con el aislamiento y con `SEC-02` (validación Zod de todo IPC). (b) `core/util/paths.ts:377-383` + `core/config/load.ts:74-96` resuelven secretos desde `~/.continue/.env`: secretos en texto plano, contrarios a `SEC-03`/`SEC-04`. (c) `core/llm/toolSupport.ts:3-120` (`PROVIDER_TOOL_SUPPORT`) es una allowlist por nombre de modelo: segunda fuente de verdad que se pudre y contradice la capacidad declarada en config (CONT-01). |

**Recuento:** 0 `✅ Completada` · 2 `🚫 Descartada` · 7 `🆕 Pendiente` · 0 `⏳ Futura` — **9 tareas**.

---

## 5. Descarte normalizado a la forma canónica ##

Las filas de la matriz §3 que era `**DESCARTAR**` se normalizan aquí a
`🚫 Descartada (con justificación)` (`AGENTS.md` §4), conservando el motivo original:

| Componente Continue | Veredicto | Fundamento |
| --- | :---: | --- |
| `core/llm/toolSupport.ts` (`PROVIDER_TOOL_SUPPORT`) | 🚫 **Descartada (con justificación)** | Allowlist de capacidades por nombre de modelo: fuente de verdad paralela a la declaración por config y ligada a un inventario de modelos que envejece. Se resuelve con `CONT-01` (capacidades declarativas) más el filtro `requiredCapabilities` ya existente en `ModelRouter.resolveModel` (`packages/models/src/ModelRouter.ts:519`). |
| `core/context/providers/{JiraIssues,GitHubIssues,Postgres,Discord,Google}*` | 🚫 **Descartada (con justificación)** | Contaminación de dominio (`AGENTS.md` §4): tickets, incidencias, bases de datos de terceros y mensajería son modelos de negocio ajenos al alcance de un Sistema Operativo Cognitivo. |
| `core/config/load.ts:667-789` (`config.ts` + esbuild) | 🚫 **Descartada (con justificación)** | Configuración ejecutable: contradice el guardrail de aislamiento (`contextIsolation=true`, `sandbox=true`, `nodeIntegration=false`) y `SEC-02` (validación Zod de todo IPC); reintroduce superficie de ejecución arbitraria en el proceso principal. |
| `core/util/paths.ts:377-383` + `core/config/load.ts:74-96` (`.env`) | 🚫 **Descartada (con justificación)** | Secretos en fichero de texto plano y sustitución por *string replace* del config; contraria a `SEC-03` (keychain del SO) y `SEC-04` (cero secretos en storage/logs/prompts). |
| `core/context/retrieval/**` (LanceDB + SQLite + reranker) | 🚫 **Descartada (con justificación)** | Sustrato de indexación ya resuelto por VantaDB (HNSW + BM25 + GraphRAG): `KB-03`, `KB-04`, `KB-06`. Portar el indexado de Continue duplicaría el motor canónico. |
| `core/autocomplete/**`, `core/nextEdit/**`, `core/edit/**` | 🚫 **Descartada (con justificación)** | Producto de IDE: autocompletado de tabulación, next-edit y parcheo de diffs no son capacidades de un Sistema Operativo Cognitivo desktop. |
| `core/llm/llms/*` (~60 clases de provider) | 🚫 **Descartada (con justificación)** | AI SDK v7 es el adaptador canónico de inferencia (`AGENTS.md` §1); replicar 60 clases de provider es sobreingeniería frente a los 6 adaptadores de `packages/models/src/providers/`. |
