# Extracción Técnica: SWE-agent (repos-referencia/swe-agent) #

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de patrones |
| Repositorio Origen | `repos-referencia/swe-agent/` (Commit verificado: `3ea751c`, rama `main`, profundidad 1) |
| Stack del Origen | Python 3.11 + Pydantic v2 + pydantic-settings + Jinja2 + LiteLLM + SWE-ReX/Docker + Bash |
| Rol en Ego | Referencia de diseño del ACI (Agent-Computer Interface) y del contrato tool↔modelo |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Licencia | MIT — todo fichero derivado exige cabecera `Adapted from SWE-agent (MIT)` y aviso en el `LICENSE.md` del paquete |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia ##

SWE-agent (Princeton, NeurIPS 2024) aporta a Ego una tesis concreta y transferible: **la calidad de un agente no la
decide el modelo, la decide el contrato de su interfaz con la computadora (ACI)**. Su `docs/background/aci.md:1-16`
condensa cuatro decisiones de diseño que hoy no están formalizadas en Ego: un linter que bloquea la edición si el
código no es sintácticamente válido, un visor de archivos por ventanas de 100 líneas en vez de `cat`, un buscador que
lista solo los ficheros con coincidencia (nada de contexto por match) y un mensaje explícito cuando una orden no
produce salida.

El resto del repositorio es un arnés de investigación: Python, un contenedor Docker por instancia, LiteLLM como capa
de inferencia, el dataset SWE-bench y un juez LLM que puntúa la propia solución. Eso es **lenguaje y dominio
ajenos**: se descarta con justificación (AGENTS.md §4).

Lo que Ego ya tiene y este repo confirma como correcto: `ToolRegistry` (`packages/tools/src/ToolRegistry.ts:23`) ya
separa catálogo, esquema Zod, riesgo y aprobación; `PromptAssembly` (`packages/subegos/src/PromptAssembly.ts:235`)
ya garantiza un tier estable byte-stable; `ContextCompaction` (`packages/runtime/src/ContextCompaction.ts:388`) ya
compacta el historial. Lo que a Ego le falta es el **puente** entre esas tres piezas: el contrato de tool documentado
al modelo, el corte de observación con marcador de elisión y el gate que revierte una escritura que introduce
errores nuevos.

### Tabla de divergencias ###

| Dimensión | SWE-agent | Ego (Cognitive OS) | Decisión |
| --- | --- | --- | --- |
| Lenguaje de runtime | Python 3.11 + Pydantic | TypeScript strict + Node 22 en el Main de Electron | **DESCARTAR** el runtime Python; portar los patrones a TS |
| Aislamiento de ejecución | Contenedor Docker por instancia (`sweagent/environment/swe_env.py:27-28`, imagen `python:3.11`) | Tools in-process en `apps/desktop/src/main.ts` gobernadas por `ApprovalEngine` | **DESCARTAR** el harness Docker: contradice local-first y el principio 6 |
| Capa de inferencia | LiteLLM como router multi-proveedor (`sweagent/agent/models.py:15`) | `ModelRouter` propio (`packages/models/src/ModelRouter.ts`) + AI SDK v7 como adaptador | **DESCARTAR** LiteLLM: duplicaría la arquitectura de modelos |
| Contrato tool↔modelo | `Command`/`Argument` → schema function-calling **y** `command_docs` inyectado en el prompt (`sweagent/tools/commands.py:79-205`, `sweagent/tools/utils.py:75-107`) | `ToolRegistry` con esquema Zod y export JSON Schema, pero sin render textual del contrato | **ADAPTAR**: derivar la guía de tools desde el registro |
| Historial de observaciones | Elisión determinista con marcador `"Old environment output: (n lines omitted)"` (`sweagent/agent/history_processors.py:147-176`) | Compactación con resumidor LLM (`packages/runtime/src/ContextCompaction.ts:491`) | **ADAPTAR**: elisión sin coste de LLM como capa previa |
| Dominio de evaluación | SWE-bench + juez LLM que autoevalúa (`sweagent/agent/reviewer.py:375-449`) | SOC con dominios Knowledge/Product/CRM/Analytics | **DESCARTAR** dataset y juez: dominio ajeno |

---

## 2. Inventario Quirúrgico de Patrones a Extraer ##

### Bloque A: El ACI como artefacto de primera clase ###

*Ubicación en fuente:* `repos-referencia/swe-agent/sweagent/tools/`

1. **`commands.py:79-205` — `Command`/`Argument` como contrato único de tool**
   - **Qué hace:** cada tool declara `name`, `docstring`, `signature`, `end_name` y una lista tipada de `Argument`
     (`name`, `type`, `required`, `enum`, `argument_format`). Los validadores garantizan argumentos requeridos antes
     de los opcionales, nombres únicos, patrón de nombre y **coherencia entre la firma y los argumentos**
     (`commands.py:167-205`).
   - **Adaptación en Ego:** `ToolRegistry` valida la definición pero no valida que la `description` sea utilizable como
     contrato para el modelo. Extraer el validador de coherencia + el generador de guía.
   - **Relación con Backlog Ego:** `ACT-01`, `ACT-02`, `CORE-03`, `SUB-01`.

2. **`utils.py:75-107` (`generate_command_docs`) + `tools.py:214-218` + `agents.py:667`**
   - **Qué hace:** la documentación de las tools se genera automáticamente desde las mismas declaraciones, se cachea
     en `ToolConfig.command_docs` y se inyecta en el system prompt (`{{command_docs}}`). No hay dos fuentes de verdad.
   - **Adaptación en Ego:** nuevo `packages/tools/src/ToolContractDocs.ts` con `renderToolGuide(registry)` → Markdown
     estable, inyectado en `buildStableTier` (`packages/subegos/src/PromptAssembly.ts:244-253`) vía el campo
     `toolGuide`, que hoy se rellena a mano (`packages/subegos/src/SubEgoSoul.ts:143,444`).
   - **Relación con Backlog Ego:** `ACT-01`, `ACT-02`, `SUB-03`.

3. **`commands.py:133-165` — `get_function_calling_tool()`**
   - **Qué hace:** la misma declaración produce el schema OpenAI function-calling.
   - **Adaptación en Ego:** ya cubierto por `ToolRegistry.toAiSdkTools()`
     (`packages/tools/src/ToolRegistry.ts:231`). Sin trabajo nuevo; se documenta como confirmación del acierto del
     diseño actual.
   - **Relación con Backlog Ego:** `ACT-01`.

### Bloque B: Linter de resultado y ventana de edición ###

*Ubicación en fuente:* `repos-referencia/swe-agent/tools/windowed_edit_linting/`, `tools/windowed/`

1. **`tools/windowed_edit_linting/bin/edit:94-119` — gate de linter post-edición con reversión**
   - **Qué hace:** guarda el lint previo, aplica la edición, vuelve a lintear y, si hay **errores nuevos**, **deshace
     la edición** (`wf.undo_edit()`), imprime el diff aplicado frente al original y el error, y sale con código 1.
     `tools/windowed/lib/flake8_utils.py:92-134` filtra los errores preexistentes (reindexando líneas por la ventana
     editada) para no atribuir a la edición la deuda ajena.
   - **Adaptación en Ego:** patrón "gate + revert + feedback accionable" reutilizable por cualquier tool
     destructiva (`fs_write_file`, `terminal_exec`, parcheo de código). Ego tiene un linter de **manifiestos**
     (`packages/integrations/src/skills/SkillLinter.ts:82`) pero ningún linter de **resultado** post-ejecución.
   - **Relación con Backlog Ego:** `ACT-04`, `ACT-06`, `ACT-08`, `SUB-05`.

2. **`tools/windowed/lib/windowed_file.py:53-115` + `config/sweagent_0_7/07.yaml:88-96` —
   visor en ventanas de 100 líneas**
   - **Qué hace:** el archivo abierto se muestra en una ventana de `WINDOW` líneas (100) con `OVERLAP` 2; comandos
     `open/goto/scroll_up/scroll_down` con estado persistido en un registro en fichero
     (`tools/registry/lib/registry.py:7-56`).
   - **Adaptación en Ego:** `fs_read_file` ya lee por `offset`/`maxBytes` en bytes
     (`packages/tools/src/native/fs/NativeFsTool.ts:18-26,76-116`) pero devuelve contenido plano, sin numeración de
     líneas ni rango navegable.
   - **Relación con Backlog Ego:** `ACT-04`, `CANV-02`.

### Bloque C: Contrato observación→prompt ###

*Ubicación en fuente:* `repos-referencia/swe-agent/sweagent/agent/`

1. **`agents.py:69-82` y `:729-746` — truncado con marcador y observación vacía explícita**
   - **Qué hace:** si la observación supera `max_observation_length` (100 000 caracteres) se usa
     `next_step_truncated_observation_template`, que declara cuántos caracteres se elidieron y **cómo** reducir la
     salida; si la salida está vacía se emite un mensaje explícito ("Your command ran successfully and did not produce
     any output") en lugar de una cadena vacía.
   - **Adaptación en Ego:** `packages/runtime/src/ToolExecutionLoop.ts:384` mete `res.text || ""`; un tool sin salida
     deja al modelo sin ninguna señal de éxito. `ExecutionManager.enforceOutputLimit`
     (`packages/execution/src/ExecutionManager.ts:467-505`) ya envuelve lo truncado, pero el **historial** no se elide.
   - **Relación con Backlog Ego:** `ACT-03`, `ACT-08`, `TASK-02`.

2. **`history_processors.py:85-176` — `LastNObservations` (elisión determinista)**
   - **Qué hace:** conserva las últimas `n` observaciones íntegras (5 en el config 0.7) y sustituye el resto por
     `"Old environment output: (n lines omitted)"`. El parámetro `polling` evita reescribir el historial en cada turno
     (rompería el prompt cache) y las etiquetas `keep_output`/`remove_output` permiten excepciones por tool.
   - **Adaptación en Ego:** capa determinista y sin coste de LLM por delante de `ContextCompaction`.
   - **Relación con Backlog Ego:** `CORE-05`, `CORE-07`, `TASK-02`.

3. **`tools/search/bin/search_dir:18-36` — búsqueda sucinta por directorio**
   - **Qué hace:** lista **solo** los ficheros con al menos una coincidencia y el número de coincidencias por
     fichero; el contexto por match se descartó por confuso; si casan más de 100 ficheros se pide estrechar la
     búsqueda.
   - **Adaptación en Ego:** `fs_grep` (`packages/tools/src/native/fs/NativeFsSearchTools.ts:263-269`) devuelve
     `matches[]` con `{path, line, text}` — volcado línea a línea, justo lo que el paper descarta.
   - **Relación con Backlog Ego:** `ACT-04`, `KB-04`.

### Bloque D: Configuración, presupuesto y runner ###

*Ubicación en fuente:* `repos-referencia/swe-agent/sweagent/agent/models.py`, `sweagent/utils/config.py`,
`sweagent/run/`

1. **`models.py:66-150` y `:632-670` — presupuestos por instancia, total y por llamada**
   - **Qué hace:** tres límites independientes (`per_instance_cost_limit` 3.0 USD por defecto, `total_cost_limit`,
     `per_instance_call_limit`) verificados tras cada llamada; al superar cualquiera se aborta el turno.
     `InstanceStats` (`:292-308`) acumula coste, tokens enviados/recibidos y nº de llamadas.
   - **Adaptación en Ego:** `SubEgoBudgetTracker` (`packages/subegos/src/SubEgoBudget.ts:103`) ya implementa cuotas
     por Sub-Ego, **pero sin caller en producción**: `grep "SubEgoBudgetTracker" packages/ apps/` solo devuelve el
     propio módulo y sus tests (`packages/subegos/test/`, `tests/e2e/`).
   - **Relación con Backlog Ego:** `SUB-09`, `SUB-03`, `CORE-03`.

2. **`utils/config.py:15-58` + `run/common.py:286-367` + `run/run_single.py:83-122` +
   `agents.py:149-167` — configuración por defecto**
   - **Qué hace:** defaults en YAML versionados; `--config` carga y **fusiona** varios YAML; los overrides de CLI son
     claves punteadas (`--agent.model.name`); `extra="forbid"` rechaza claves desconocidas; `_get_auto_correct`
     (`run_single.py:104-122`) sugiere el parámetro correcto cuando el usuario escribe uno obsoleto.
   - **Adaptación en Ego:** no existe un sistema de defaults + overrides para el runtime; `SafeConfigMutation`
     (`packages/execution/src/SafeConfigMutation.ts`) es otra cosa (mutación atómica de configuración MCP).
   - **Relación con Backlog Ego:** `SUB-01`, `SUB-02`, `ACT-09`, `CORE-03`.

---

## 3. Matriz de Extracción vs Descarte ##

| Componente SWE-agent | Acción | Razón Técnica |
| --- | --- | --- |
| `sweagent/tools/commands.py` (`Command`/`Argument`) | EXTRAER & ADAPTAR | Contrato tipado único que alimenta a la vez el schema y la documentación. |
| `sweagent/tools/utils.py:75-107` (`generate_command_docs`) | EXTRAER & ADAPTAR | La guía de tools debe derivarse del registro, no escribirse a mano por Sub-Ego. |
| `sweagent/agent/history_processors.py:85-176` | EXTRAER & ADAPTAR | Elisión determinista: ahorro de contexto sin coste de LLM ni ruptura de caché. |
| `tools/windowed_edit_linting/bin/edit:94-119` | EXTRAER PATRÓN | Gate + revert reutilizable por cualquier tool destructiva de Ego. |
| `tools/windowed/lib/flake8_utils.py:92-134` | EXTRAER PATRÓN | El veredicto debe atribuirse a la acción, no al ruido preexistente. |
| `tools/windowed/` (ventana de 100 líneas) | EXTRAER PATRÓN | Lectura paginada y navegable en vez de volcado plano. |
| `tools/search/bin/search_dir:18-36` | EXTRAER PATRÓN | Salida sucinta por fichero: menos tokens y menos confusión para el modelo. |
| `sweagent/agent/models.py:66-150` (presupuestos) | EXTRAER PATRÓN | Tres límites de gasto independientes con corte automático y stats. |
| `sweagent/utils/config.py` + `run/common.py:286-367` | EXTRAER PATRÓN | Defaults versionados + overrides + validación estricta de claves. |
| `sweagent/agent/reviewer.py:375-449` (Reviewer/Chooser) | 🚫 Descartada (con justificación) | Bruto LLM que puntúa la propia solución: dominio ajeno y solapado con `packages/subegos/src/SelfImprovementLoop.ts` (`SUB-12`) y `packages/decision/src/DecisionAuditor.ts`. |
| `sweagent/agent/models.py:15` (LiteLLM) | 🚫 Descartada (con justificación) | Capa de inferencia unificada que duplicaría el `ModelRouter` propio; AGENTS.md §1 fija AI SDK v7 como **adaptador**, no como arquitectura. |
| `sweagent/environment/swe_env.py:27-28` + `sweagent/run/run_batch.py` | 🚫 Descartada (con justificación) | Python + contenedor Docker por instancia + dataset SWE-bench: guardrail de lenguaje (§4), contradice local-first y contamina el dominio con un benchmark de software engineering. |
| `tools/web_browser/`, `tools/filemap/`, `tools/image_tools/` | 🚫 Descartada (con justificación) | Automatización de GUI y procesado de imagen con servidor embebido: sobreingeniería en P0; Ego cubre navegación vía MCP y render vía Canvas. |

---

## 4. Estado real verificado (2026-10-20) ##

> Repositorio de referencia **nuevo**: no hay asimilación previa. Criterio de `✅ Completada`: fichero adaptado **y**
> caller en producción verificado por grep sobre `packages/` + `apps/desktop/`, excluyendo `test/`, `dist/` y
> `node_modules/`.

| ID | Patrón | Estado | Evidencia / Fundamento |
| --- | --- | --- | --- |
| `SWAG-01` | Contrato tool→documentación auto-generada (ACI) | 🆕 Pendiente | `packages/tools/src/ToolRegistry.ts:207,231` exporta schema, pero no existe render textual; `PromptAssembly.ts:118` y `SubEgoSoul.ts:143,444` reciben `toolGuide` a mano. **Cableado:** crear `packages/tools/src/ToolContractDocs.ts` y pasarlo a `buildStableTier` desde `SubEgoRuntime` (owner A4). |
| `SWAG-02` | Linter de resultado post-acción con reversión | 🆕 Pendiente | Solo existe linter de manifiestos (`packages/integrations/src/skills/SkillLinter.ts:82`); no hay verificación del resultado de una tool ya ejecutada. **Cableado:** gate tras `fs_write_file`/`terminal_exec` en `packages/execution/src/ExecutionManager.ts` (owner A2/A4). |
| `SWAG-03` | Elisión determinista de observaciones + marcador de "sin salida" | 🆕 Pendiente | `packages/runtime/src/ToolExecutionLoop.ts:384` inserta `res.text \|\| ""`; `packages/runtime/src/ContextCompaction.ts:491` solo compacta con resumidor LLM. **Cableado:** processor de elisión previo al query en `ToolExecutionLoop` (owner A2). |
| `SWAG-04` | Lectura paginada por líneas con posición navegable | 🆕 Pendiente | `packages/tools/src/native/fs/NativeFsTool.ts:18-26,76-116` corta por **bytes** (`offset`/`maxBytes`) y no numera líneas. **Cableado:** parámetros `lineStart`/`lineCount` en `createFsReadFileTool` (owner A4). |
| `SWAG-05` | Búsqueda sucinta: listar solo ficheros con ≥1 coincidencia | 🆕 Pendiente | `packages/tools/src/native/fs/NativeFsSearchTools.ts:263-269` devuelve `matches[]` línea a línea con texto; sin agrupar por fichero ni tope de ficheros. **Cableado:** nuevo modo `groupByFile` en `createFsGrepTool` (owner A3). |
| `SWAG-06` | Configuración por defecto en YAML + overrides + `extra=forbid` | 🆕 Pendiente | No existe sistema de defaults del runtime; `packages/execution/src/SafeConfigMutation.ts` es mutación atómica de config MCP, otro dominio. **Cableado:** `packages/subegos/src/SubEgoManifest.ts` es el sitio natural (owner A2). |
| `SWAG-07` | Límites de coste por instancia / total / por llamada | 🆕 Pendiente | `packages/subegos/src/SubEgoBudget.ts:103` (`SubEgoBudgetTracker`) sin caller de producción: `grep "SubEgoBudgetTracker" packages/ apps/` → solo el módulo y `packages/subegos/test/` + `tests/e2e/`. **Cableado:** instanciarlo en `packages/subegos/src/SubEgoRuntime.ts` (owner A2). |
| `SWAG-08` | Runtime Python + harness Docker/SWE-ReX + dataset SWE-bench | 🚫 Descartada (con justificación) | AGENTS.md §4 prohíbe Python como dependencia de núcleo y el harness de contenedores contradice el desktop local-first; el dataset SWE-bench pertenece al dominio de software engineering, no a un SOC. |
| `SWAG-09` | LiteLLM como capa de inferencia unificada | 🚫 Descartada (con justificación) | AGENTS.md §1 fija AI SDK v7 como adaptador y el `ModelRouter` propio como arquitectura; añadir LiteLLM (`sweagent/agent/models.py:15`) crearía una segunda abstracción de modelos en competencia con `packages/models/src/ModelRouter.ts`. |

**Recuento:** 0 `✅ Completada` · 2 `🚫 Descartada` · 7 `🆕 Pendiente` · 0 `⏳ Futura` — **9 tareas**.

---

## 5. Descarte normalizado a la forma canónica ##

Las filas de la matriz §3 que usan la forma `**DESCARTAR**` se normalizan aquí a `🚫 Descartada (con justificación)`
(AGENTS.md §4) conservando el motivo original:

| Componente SWE-agent | Veredicto | Fundamento |
| --- | --- | --- |
| `sweagent/agent/reviewer.py:375-449` (Reviewer/Chooser) | 🚫 **Descartada (con justificación)** | Bruto LLM que puntúa la propia solución y decide el reintento: dominio ajeno (evaluación de benchmarks) y solapado con `packages/subegos/src/SelfImprovementLoop.ts` (`SUB-12`) y `packages/decision/src/DecisionAuditor.ts`. |
| `sweagent/agent/models.py:15` (LiteLLM) | 🚫 **Descartada (con justificación)** | Capa de inferencia unificada que duplicaría el `ModelRouter` propio; AGENTS.md §1: AI SDK v7 es **adaptador**, no arquitectura. |
| `sweagent/environment/swe_env.py:27-28` + `sweagent/run/run_batch.py` | 🚫 **Descartada (con justificación)** | Python + contenedor Docker por instancia + dataset SWE-bench: guardrail de lenguaje (§4), contradice local-first y es contaminación de dominio ajena a un SOC. |
| `tools/web_browser/`, `tools/filemap/`, `tools/image_tools/` | 🚫 **Descartada (con justificación)** | Automatización de GUI (ratón/teclado/navegador embebido) y procesado de imagen con servidor propio: sobreingeniería en P0; Ego cubre navegación por MCP y render por Canvas. |
