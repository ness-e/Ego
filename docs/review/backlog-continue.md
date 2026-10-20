---
title: Continue Review & Extraction Backlog — Ego SOC
kind: review
status: active
description: "Backlog especializado para la revisión, extracción de patrones y adaptación técnica de Continue (continuedev/continue) hacia el monorepo de Ego."
tags: [ego, continue, extraction, review, config-driven, model-router, context-providers, tool-calling]
schema: "10-column canonical schema (.agents/references/backlog-format.md compatible)"
---

## Backlog de Revisión y Extracción: Continue (continuedev/continue) ##

## Catálogo de Tareas Canónicas para Config-Driven de Providers, Context Providers y Ciclo de Vida de la Configuración ##

| Campo | Valor |
| --- | --- |
| Estado | Activo — Backlog de Extracción Complementario |
| Repositorio Origen | `repos-referencia/continue/` · Commit verificado: `5522c6f` (rama `main`, profundidad 1) |
| Total de Tareas | **9 tareas canónicas** (`CONT-01..09`) |
| Fases Impactadas en Ego | Fase 01 (`CORE`), Fase 02 (`ACT`), Fase 06 (`KB`), Fase 09 (`DOM`), Fase 11 (`SEC`) |
| Owner | ness-e / Principal Systems Engineer |
| Fecha | 2026-10-20 |
| Última verificación | **2026-10-20** (grep sobre `packages/` + `apps/desktop/`, excluyendo `test/`, `dist/`, `node_modules/`) |

---

## 0. Verificación de estado ##

| Estado | Significado canónico |
| --- | --- |
| `✅ Completada` | Asimilado, integrado y con **caller en producción verificado**. La celda cita la ruta real. |
| `🚫 Descartada (con justificación)` | El patrón no se aplica en Ego, fue sustituido por otro módulo canónico, o viola un guardrail. La celda contiene el motivo técnico. |
| `🆕 Pendiente` | Patrón asimilable identificado en la fuente, **sin implementación en Ego**. La celda dice el cableado exacto y quién lo ejecuta. |
| `⏳ Futura (fase)` | Diferido a una fase posterior, con fase destino explícita. |

**Nota de alcance (Continue).** Continue es un repositorio de referencia **nuevo** en
`repos-referencia/`: no existe ola de asimilación previa, ningún fichero adaptado bajo `packages/` o
`apps/desktop/` y ningún caller en producción derivado de él. Por tanto el recuento de
`✅ Completada` es **0**, y no por descuido: cada patrón se contrastó contra el código real de Ego
antes de decidir su estado. Ninguna fila queda en el limbo (`AGENTS.md` §4).

### Búsquedas de verificación ejecutadas (2026-10-20) ###

```text
grep "ContextProvider"                    packages/ apps/desktop/
  -> packages/tasks/src/ContextProvider.ts (COUC-16, contexto ambiental SO)
  -> packages/tasks/src/index.ts:14 (re-export, sin caller)
  -> packages/tasks/test/ContextProvider.test.ts (test)
  -> apps/desktop/renderer/floating/upload-canvas.ts:649 (interfaz Noop)
grep "ContextProviderRegistry|contextProviders" packages/
  -> 0 coincidencias (no existe registro de fuentes de contexto)
grep "ToolCallRepairEngine"                packages/
  -> packages/runtime/src/ToolExecutionLoop.ts:19,368,375,443 (caller en producción)
grep "bindRole|registerDefaultModels"      packages/models/src/
  -> ModelRouter.ts:294 / ModelRouter.ts:857-940 (roles y descriptors en código)
grep "gov/settings"                         apps/desktop/src/
  -> main.ts:1156 (permissions) · :1198 (compression) · :1978 (model_config) · :2366 (mcp_servers)
```

---

## 1. Resumen Ejecutivo de Extracción ##

Continue aporta a Ego el eslabón que falta entre *«el usuario declara»* y *«el router ejecuta»*:
**config declarativo de providers, roles y fuentes de contexto**, con un ciclo de vida de recarga
consistente y sin estados intermedios. Continue **no** aporta UI de chat, ni runtime de inferencia
(AI SDK v7 ya es el adaptador canónico, `AGENTS.md` §1), ni indexación/búsqueda (VantaDB ya la cubre:
`KB-03`, `KB-04`, `KB-06`).

| Grupo de Trabajo | Rango IDs | Tareas | Fases de Ego Impactadas | Prioridad | Beneficio Principal |
| --- | --- | :---: | --- | :---: | --- |
| **A. Config declarativo de modelos** | `CONT-01..02` | 2 | Fase 01 (`CORE-03`, `CORE-04`), Fase 09 (`INT-02`) | 🔴 P0 | Providers, capacidades y roles salen del código a datos; la selección persistida se rectifica contra el catálogo vigente. |
| **B. Ciclo de vida de la configuración** | `CONT-03` | 1 | Fase 01 (`INT-02`), Fase 11 (`SEC-05`) | 🟠 P1 | Rebind atómico de router + permisos + toolsets + MCP bajo cancelación cooperativa. |
| **C. Fuentes de contexto** | `CONT-04` | 1 | Fase 06 (`KB-01`, `KB-03`), Fase 09 (`DOM-01`) | 🔴 P0 | Contrato uniforme de contexto (código, problems, terminal, web) ausente en Ego. |
| **D. Tool calls y superficie de tools** | `CONT-05..06` | 2 | Fase 02 (`ACT-01`, `ACT-02`, `ACT-08`) | 🟠 P1 | Corte de tool call en streaming y gating/overrides de tools por modelo y capability. |
| **E. Secretos con scope** | `CONT-07` | 1 | Fase 11 (`SEC-03`, `SEC-04`) | 🟠 P1 | Referencia de secreto por scope, separada del valor; habilita BYOK por proyecto. |
| **F. Descartes** | `CONT-08..09` | 2 | — | — | Contaminación de dominio, configuración ejecutable, secretos en fichero y heurísticas embebidas. |
| **TOTAL** | `CONT-01..09` | **9** | **Fases 01, 02, 06, 09, 11** | — | — |

### Recuento de estados (verificado sobre las 9 filas de la tabla §2) ###

| `✅ Completada` | `🚫 Descartada` | `🆕 Pendiente` | `⏳ Futura` | Total |
| :---: | :---: | :---: | :---: | :---: |
| 0 | 2 | 7 | 0 | **9** |

```text
MATRIZ DE DISTRIBUCIÓN POR FASE (Continue → Ego)

Fase 01  CORE     │ CONT-01  CONT-02                     [██░░░░░░░░]  2
Fase 02  ACT      │ CONT-05  CONT-06                     [██░░░░░░░░]  2
Fase 06  KB       │ CONT-04                               [█░░░░░░░░░]  1
Fase 09  DOM      │ (CONT-04 → DOM-01 Engineering)        [░░░░░░░░░░]  0
Fase 11  SEC      │ CONT-03  CONT-07                     [██░░░░░░░░]  2
Descartes          │ CONT-08  CONT-09                     [█░░░░░░░░░]  2
```

---

## 2. Catálogo Detallado de Extracción (10 Columnas Canónicas) ##

| ID | Severidad | Hallazgo | Archivo Continue | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CONT-01` | 🔴 Crítica | **Registro de providers y capacidades declaradas en config** | `packages/config-yaml/src/schemas/models.ts:37-42,178-205` · `core/config/yaml/models.ts:44-48,103-107` · `core/llm/llms/index.ts:73-135` | 🟡 2-3d | 🔴 P0 | 🆕 Pendiente | Continue declara el provider, su contexto y sus **capacidades** (`tool_use`, `image_input`) en datos, y el runtime proyecta esas capacidades a flags del adaptador. En Ego el catálogo está **en código**: `packages/models/src/providers/` son 6 clases TS y `ModelRouter.registerDefaultModels()` (`packages/models/src/ModelRouter.ts:857-940`) fija descriptors, `contextWindow` y costes. **Adaptación:** nuevo `packages/models/src/ModelDescriptorRegistry.ts` que lea un catálogo declarativo en `gov/settings/model_catalog` (validado con Zod) y registre `ModelDescriptor` (`packages/models/src/types.ts:27-36`) en el router. **Cableado:** invocar desde `applyModelConfig` (`apps/desktop/src/main/models/model-config.ts:349`). Owner: A2. | Ego: `CORE-03`, `CORE-04`, `INT-02` · Extracción: `docs/extractions/continue.md` §Bloque A.1 | — |
| `CONT-02` | 🔴 Crítica | **Roles de modelo declarativos con rectificación de la selección persistida** | `packages/config-yaml/src/schemas/models.ts:23-33` · `core/config/yaml/loadYaml.ts:280-343` · `core/config/selectedModels.ts:10-80` | 🟡 2d | 🔴 P0 | 🆕 Pendiente | Cada modelo declara los roles que sirve (`chat`, `edit`, `apply`, `summarize`, `embed`, `rerank`, `autocomplete`, `subagent`) y se indexa en `modelsByRole`; la selección guardada por rol se valida contra los candidatos vigentes y, si desaparece, cae al primero y **reescribe la persistencia**. En Ego `ModelRouter.bindRole` (`packages/models/src/ModelRouter.ts:294`) existe pero los 4 roles se fijan en código (`:936-939`) y **no hay selección persistida por rol**. **Adaptación:** binding rol→modelos por config + `selectedModelByRole` persistido en `gov/settings/model_selection` con la rectificación (persistida → primer candidato → re-persistencia). **Cableado:** `apps/desktop/src/main/models/model-config.ts:349-365` (`applyModelConfig` → `router.configureFromSettings` → `router.bindRole`). Owner: A2. | Ego: `CORE-03`, `INT-02` · Extracción: `docs/extractions/continue.md` §Bloque B.3 | `CONT-01` |
| `CONT-03` | 🟠 Alta | **Cascada de recarga de configuración con cancelación cooperativa** | `core/config/ConfigHandler.ts:46-136` · `core/config/profile/ProfileLifecycleManager.ts:42-70` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | `cascadeAbortController` + `abortCascade()`: cada cambio externo (settings de IDE, cambio de perfil, provider MCP) invalida la cascada en curso y arranca otra bajo el mismo `AbortController`; los listeners se notifican sólo al final, de modo que nunca se aplica un estado a medio construir. En Ego las cachés de `gov/settings/*` se recargan **de forma independiente y sin coordinación**: permisos (`apps/desktop/src/main.ts:1156`), compresión (`:1198`), `model_config` (`:1978`) y `gov/mcp_servers` (`:2366`). Un cambio de BYOK puede dejar router, permisos y toolsets inconsistentes. **Adaptación:** `ConfigReloadCoordinator` en main que re-ligue router + permisos + toolsets + MCP bajo un único `AbortSignal`. **Cableado:** `apps/desktop/src/main.ts` (punto de arranque tras `applyModelConfig`). Owner: A2/A4. | Ego: `INT-02`, `SEC-05`, `ACT-01` · Extracción: `docs/extractions/continue.md` §Bloque B.4 | `CONT-01`, `CONT-02` |
| `CONT-04` | 🔴 Crítica | **Registro de context providers con contrato uniforme** | `core/context/index.ts:10-37` · `core/context/providers/index.ts:43-74,76-82` · `core/config/loadContextProviders.ts:22-95` | 🟡 2-3d | 🔴 P0 | 🆕 Pendiente | Cada fuente de contexto expone `description` estática (título, tipo) y un único `getContextItems(query, extras)`; el loader instancia las clases registradas, aplica los params del config, carga defaults (fichero, fichero actual, diff, terminal, problems, reglas), **falla de forma no fatal** ante un provider desconocido y filtra por IDE. En Ego **no existe tal registro**: `packages/tasks/src/ContextProvider.ts:24-86` captura contexto **ambiental del SO** (app activa, título de ventana, selección) — concepto distinto — y su único caller es el re-export `packages/tasks/src/index.ts:14`. Grep `ContextProviderRegistry \| contextProviders` sobre `packages/`: 0 coincidencias. **Adaptación:** `packages/subegos/src/context/ContextProviderRegistry.ts` + `providers/{Code,Problems,Terminal,Web}` con el contrato Continue, alimentando el TIER 2 / CONTEXT. **Cableado:** `buildContextTier` (`packages/subegos/src/PromptAssembly.ts:294`). Owner: A3. | Ego: `KB-01`, `KB-03`, `CORE-12`, `DOM-01` · Extracción: `docs/extractions/continue.md` §Bloque C.5 | — |
| `CONT-05` | 🟠 Alta | **Detección incremental del arranque de una tool call en streaming** | `core/tools/systemMessageTools/detectToolCallStart.ts:3-30` · `core/tools/systemMessageTools/toolCodeblocks/parseSystemToolCall.ts:11-121` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | `detectToolCallStart` devuelve `{isInToolCall, isInPartialStart, modifiedBuffer}`: el caso `isInPartialStart` evita disparar con un buffer que es sólo prefijo de un token de arranque, de modo que una llamada a medio escribir no se parte; `handleToolCallBuffer` acumula líneas y emite deltas incrementales. En Ego la **reparación post-hoc sí está en producción** (`packages/runtime/src/ToolExecutionLoop.ts:19,368,375,443` → `packages/tool-call-repair/src/ToolCallRepairEngine.ts`, `balanced-json.ts:22-80`), pero el corte por chunks no existe: el JSON crudo de la llamada puede emitirse al renderer antes de repararse. **Adaptación:** buffer incremental en el handler de chunks que aisle el bloque de tool call antes de propagarlo a la UI. **Cableado:** `packages/runtime/src/ToolExecutionLoop.ts` (handler de chunks de `router.streamText`). Owner: A3/A4. | Ego: `ACT-02`, `ACT-08` · Extracción: `docs/extractions/continue.md` §Bloque D.6 | — |
| `CONT-06` | 🟠 Alta | **Overrides de herramientas por modelo y gating por capability** | `core/tools/applyToolOverrides.ts:14-69` · `packages/config-yaml/src/schemas/models.ts:106-124` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Por modelo se puede reescribir la descripción de una tool, su título visible o la frase de acción, o **deshabilitarla**; un override hacia una tool inexistente es un error no fatal que lista las tools disponibles. En Ego el `ToolRegistry` habilita tools por toolset y perfil (`packages/tools/src/toolsets.ts:158-179`) pero **no por modelo**: `ModelDescriptor.capabilities` existe (`packages/models/src/types.ts:34`) y nada filtra el schema de tools según `tool_calling`, de modo que hoy puede ofrecerse a un modelo incapaz el juego completo de tools. **Adaptación:** filtrado por capability del descriptor resuelto + overrides declarativos por modelo. **Cableado:** `packages/runtime/src/ToolExecutionLoop.ts`, donde se calcula `toolSchemas` antes de `router.streamText` (~línea 340); overrides en `gov/settings/model_config.toolOverrides`. Owner: A3. | Ego: `ACT-01`, `ACT-02`, `SEC-05` · Extracción: `docs/extractions/continue.md` §Bloque D.7 | `CONT-01` |
| `CONT-07` | 🟠 Alta | **Taxonomía de scopes de secretos con separación location/value** | `packages/config-yaml/src/interfaces/SecretResult.ts:3-11,13-64,66-137` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Un secreto se identifica por **dónde vive** (`user:<slug>/<name>`, `organization:<org>/<name>`, `package:<slug>/<name>`, `local_env:<NAME>`, `process_env:<NAME>`), no por su valor; el valor sólo aparece en el resultado resuelto y la codificación textual (`encodeSecretLocation`/`decodeSecretLocation`) es reversible y portable. En Ego `packages/security/src/CredentialManager.ts:74-91` persiste `service`+`account` **planos, sin scope**, y el modelo resuelve una única key por provider (`apps/desktop/src/main/models/model-config.ts:74-118`): no hay BYOK por proyecto ni por organización. **Adaptación:** añadir `scope` al `StoredCredentialSchema` y resolver por `global → proyecto`; el tramo `organization` se difiere a P1 (Cloud/Sync). **Cableado:** `resolvePersistedModelKeys` (`apps/desktop/src/main/models/model-config.ts:74`). Owner: A2 + SEC. | Ego: `SEC-03`, `SEC-04`, `INT-02` · Extracción: `docs/extractions/continue.md` §Bloque E.8 | — |
| `CONT-08` | 🟡 Media | **Providers de contexto de dominio ajeno + indexado de codebase** | `core/context/providers/{JiraIssuesContextProvider,GitHubIssuesContextProvider,PostgresContextProvider,DiscordContextProvider,GoogleContextProvider}.ts` · `core/context/retrieval/pipelines/` | 🟢 0.5d | 🔴 P0 | 🚫 Descartada (con justificación) | Tickets de Jira, incidencias de GitHub/GitLab, consultas a Postgres, mensajería de Discord y Google Calendar son **modelos de negocio ajenos** al alcance de un Sistema Operativo Cognitivo: `AGENTS.md` §4 prohíbe terminantemente importar schemas o entidades de dominios ajenos de un repositorio de referencia. El indexado con LanceDB/SQLite y reranker (`core/context/retrieval/pipelines/`) duplica un sustrato que VantaDB ya cubre (`KB-03` indexación, `KB-04` búsqueda híbrida, `KB-06` GraphRAG). Se conserva **sólo el contrato** de provider (CONT-04); ninguna implementación de estos providers se porta. | Ego: `KB-03`, `KB-04`, `KB-06` · Extracción: `docs/extractions/continue.md` §3, §5 | — |
| `CONT-09` | 🟠 Alta | **Configuración ejecutable, secretos en fichero y heurísticas de capacidad embebidas** | `core/config/load.ts:667-789` (esbuild/`config.ts`) · `core/config/load.ts:74-96` + `core/util/paths.ts:377-383` (`.env`) · `core/llm/toolSupport.ts:3-120` | 🟢 0.5d | 🟠 P1 | 🚫 Descartada (con justificación) | (a) `config.ts` se compila con esbuild y **ejecuta código arbitrario** dentro del proceso: incompatible con el aislamiento (`contextIsolation=true`, `sandbox=true`) y con `SEC-02` (todo IPC validado con Zod); un config ejecutable reintroduce superficie de ejecución arbitraria en el main. (b) Los secretos se resuelven desde `~/.continue/.env` por *string replace* del config: secretos en texto plano, contrarios a `SEC-03` (keychain del SO) y `SEC-04` (cero secretos en storage/logs/prompts). (c) `PROVIDER_TOOL_SUPPORT` es una allowlist de capacidades por **nombre de modelo**: segunda fuente de verdad que envejece y contradice la capacidad declarada en config; la capacidad autoritativa en Ego es `ModelDescriptor.capabilities` filtrada por `requiredCapabilities` (`packages/models/src/ModelRouter.ts:519`). | Ego: `SEC-02`, `SEC-03`, `SEC-04`, `CORE-03` · Extracción: `docs/extractions/continue.md` §3, §5 | — |

---

## 3. Matriz de Integración con el Backlog Maestro ##

```text
Fase 01 — Core (CORE-03, CORE-04, CORE-12)
   CONT-01 ──► catálogo declarativo de providers/capacidades ──► ModelRouter.registerModel
   CONT-02 ──► roles declarativos + rectificación de selección ──► ModelRouter.bindRole
   CONT-04 ──► registro de context providers ──► buildContextTier (TIER 2 / CONTEXT)

Fase 02 — Acción (ACT-01, ACT-02, ACT-08)
   CONT-05 ──► corte de tool call en streaming ──► ToolExecutionLoop (handler de chunks)
   CONT-06 ──► overrides/gating de tools por modelo ──► ToolRegistry + ToolExecutionLoop

Fase 06 — Knowledge (KB-01, KB-03)
   CONT-04 ──► providers Code/Problems/Terminal/Web sobre la ingesta y la búsqueda de VantaDB

Fase 11 — Security (SEC-02, SEC-03, SEC-04, SEC-05)
   CONT-03 ──► cascada de recarga con AbortController ──► main.ts (rebinde de subsistemas)
   CONT-07 ──► scopes de secretos (global → proyecto) ──► CredentialManager + model-config.ts

Fuera de alcance de Ego (descarte explícito)
   CONT-08 ──► Jira / GitHub Issues / Postgres / Discord / Google + indexado LanceDB
   CONT-09 ──► config.ts ejecutable · ~/.continue/.env · PROVIDER_TOOL_SUPPORT
```

---

## 4. Deuda abierta derivada de esta verificación ##

| # | Ítem | Tipo | Owner | Bloqueante |
| --- | --- | --- | --- | --- |
| D1 | `CONT-04`: Ego no tiene contrato de fuentes de contexto; `packages/tasks/src/ContextProvider.ts` (COUC-16) captura contexto ambiental del SO y su único caller es el re-export del índice del paquete | Código | A3 | No |
| D2 | `CONT-03`: cuatro cachés de `gov/settings/*` se recargan de forma independiente y sin coordinación (`main.ts:1156`, `:1198`, `:1978`, `:2366`) | Código | A2/A4 | No |
| D3 | `CONT-01`/`CONT-02`: `ModelRouter.registerDefaultModels()` (`packages/models/src/ModelRouter.ts:857-940`) es la fuente de verdad **en código** de providers, capacidades, roles y costes | Código | A2 | No |
| D4 | `CONT-07`: `CredentialManager` no tiene noción de scope; la BYOK es una única key por provider y `model_config` es un único namespace global | Decisión | A2 + SEC | No (tramo `organization` → P1) |
| D5 | `CONT-05`: el JSON crudo de una tool call puede alcanzar el renderer antes de ser reparado | Código | A3/A4 | No |
| D6 | `CONT-08`/`CONT-09`: no se ha ejecutado un barrido de contaminación sobre `packages/`+`apps/` para estas familias (el barrido canónico de `docs/extractions/README.md` §4.2 cubre `career-ops` y `khoj`, no `continue`) | Verificación | A5 | No |
