# Extracción Técnica: mini-SWE-agent (repos-referencia/mini-swe-agent) #

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de patrones |
| Repositorio Origen | `repos-referencia/mini-swe-agent/` (upstream `SWE-agent/mini-swe-agent`, commit `04d809c`, origen `src/minisweagent/agents/default.py`) |
| Licencia del origen | MIT — SWE-agent/mini-swe-agent |
| Commit verificado | 04d809c |
| Ruta de origen | `src/minisweagent/agents/default.py` |
| Stack del Origen | Python 3.10+ · `litellm` (9 clases de proveedor) · `pydantic` v2 · `jinja2` · `typer` + `rich`/`textual` · `tenacity` · `datasets` (HF) · entornos Docker / Singularity / Contree / Bubblewrap / Modal |
| Rol en Ego | Bucle mínimo de agente, presupuestos de turno, contrato de observación, caché de prefijo y configuración en capas |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Licencia | MIT (`repos-referencia/mini-swe-agent/LICENSE.md:1-3`) — permite adaptación con atribución en cabecera |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia ##

`mini-SWE-agent` es el agente SWE minimalista del equipo de Princeton/Stanford detrás de SWE-bench (8.6k
estrellas, MIT). Su valor para Ego **no está en el dominio SWE** (resolver issues de repositorios ajenos es
contaminación de dominio), sino en cinco transversales del **runtime cognitivo** que el Cognitive Runtime
todavía no tiene:

1. **Taxonomía de salida terminal tipada**: el bucle termina lanzando una excepción que **transporta el
   mensaje final** (`InterruptAgentFlow` → `Submitted` / `LimitsExceeded` / `TimeExceeded` /
   `UserInterruption` / `FormatError`, `src/minisweagent/exceptions.py:1-26`), de modo que el desenlace es un
   mensaje más del historial lineal y no un canal paralelo
   (`src/minisweagent/agents/default.py:114-124`).
2. **Presupuesto triple de turno** (`step_limit` / `cost_limit` / `wall_time_limit_seconds`) comprobado
   **antes** de cada llamada al modelo, más un tope global de proceso por variables de entorno
   (`agents/default.py:26-33,132-147`; `models/__init__.py:13-42`).
3. **Observación con cabeza/cola y recuento explícito de caracteres omitidos**, con consejo de recuperación
   accionable (`src/minisweagent/config/benchmarks/swebench.yaml:131-158`).
4. **Caché de prefijo por `cache_control` sobre el último mensaje**, que evita que un historial creciente se
   re-facture en cada turno (`src/minisweagent/models/utils/cache_control.py:49-67`).
5. **Configuración en capas con centinela `UNSET`** que distingue "no proporcionado" de "explícitamente
   nulo" (`src/minisweagent/utils/serialize.py:6-29`; `src/minisweagent/config/__init__.py:31-61`).

**Advertencia de lectura sobre el formato de parche.** El formato `*** Begin Patch` / `*** Update File`
**no existe en este clon**: grep sobre el árbol completo
(`Begin Patch|Update File|Add File|Delete File|End Patch`) → **0 coincidencias**. La versión clonada es
`mini-swe-agent v2.4.6` (`src/minisweagent/__init__.py:11`), *bash-only*: una única tool `bash`
(`src/minisweagent/models/utils/actions_toolcall.py:11-27`) y edición de ficheros por comandos shell. El
contrato real de entrega es **verificación por `git diff`** (`config/benchmarks/swebench.yaml:75-104`).
Cualquier afirmación sobre un parser de parches en este repo sería falsa; lo que se extrae es el *contrato de
edición verificada*, no un parser (`MSWE-07`).

### Divergencias Fundamentales (Qué Descartamos y Por Qué) ###

| Dimensión | mini-SWE-agent | Ego (Cognitive OS) | Decisión Crítica |
| --- | --- | --- | --- |
| **Lenguaje y runtime** | Python 3.10+ con `litellm`, `pydantic`, `typer`, `textual` (`pyproject.toml:33-48`). | Node.js 22 + TypeScript strict en el proceso Main de Electron (`AGENTS.md` §1-2). | **ADAPTAR** los patrones a TypeScript; la implementación Python queda fuera de P0 (`AGENTS.md` §4). |
| **Superficie de acción** | Una sola tool `bash`; el LLM hace todo con el shell (`models/utils/actions_toolcall.py:11-27`). | `ToolRegistry` declarativo con N tools, taxonomía de riesgo y políticas HITL (`ACT-01`, `SEC-05`). | **ADAPTAR** el contrato (presupuestos, observación, salida), **no** la tool: Mono-tool en Ego destruiría `ACT-01`/`ACT-04`. |
| **Aislamiento de ejecución** | Contenedor efímero por instancia, `docker run --rm` (`environments/docker.py:74-99`). | Sandbox de Electron + `ToolPermissions` + `PathValidator` (`SEC-05`). | **ADAPTAR** el patrón de *instancia aislada y desechable*; **DESCARTAR** Docker (Ego es desktop local-first sin orquestador de contenedores). |
| **Persistencia de la trayectoria** | Fichero `*.traj.json` en disco con `trajectory_format` versionado (`agents/default.py:159-190`). | VantaDB como sustrato único (`AGENTS.md` §4): `gov/audit` y `session/*`. | **ADAPTAR** el esquema a un registro en VantaDB; no introducir un segundo sustrato de persistencia. |
| **Proveedores de modelo** | `litellm` con 9 clases (`models/__init__.py:78-89`). | `ModelRouter` propio sobre AI SDK v7 (`CORE-03`, `INT-02`). | **DESCARTAR** `litellm`: un segundo router no canónico compite con `packages/models/src/ModelRouter.ts`. |
| **Formato de parche** | Inexistente en v2 (0 coincidencias de `Begin Patch`); la edición es por shell + verificación de `git diff`. | `ChangeSetService` genera diffs (`packages/tools/src/native/git/ChangeSetService.ts:56-90`). | **DESCARTAR** la idea de parser de parches: no hay upstream que portar y Ego ya tiene motor de diff canónico. |

---

## 2. Inventario Quirúrgico de Patrones a Extraer ##

### Bloque A: Bucle mínimo, protocols estructurales y salida terminal tipada ###

*Ubicación en fuente:* `src/minisweagent/agents/default.py`, `src/minisweagent/exceptions.py`,
`src/minisweagent/__init__.py`

1. **`run()` — bucle de una sola sentencia (`agents/default.py:88-124`)** — Compone el par *system + user*
   inicial (`:92-95`), ejecuta `step()` y captura tres familias de excepción: `FormatError` (cobra el coste ya
   facturado y cuenta la racha, `:100-114`), `InterruptAgentFlow` (mensaje terminal, `:115-116`) y excepción
   inesperada (se relanza tras registrar la traza, `:117-119`); el `finally` persiste la trayectoria en cada
   iteración (`:120-121`) y el bucle sale cuando el **último mensaje** tiene `role == "exit"` (`:122-124`).
   - **Adaptación en Ego:** la taxonomía `LoopStatus` de `packages/runtime/src/types.ts:15-20`
     (`completed`, `approval_required`, `max_steps_exceeded`, `aborted`, `error`) se amplía con un discriminante
     `exit_status` + `submission` portado a un mensaje terminal, para que el desenlace del turno sea
     **auditable en `gov/audit`** (`SEC-06`) y **presentable en Canvas** (`CANV-05`).
   - **Relación con Backlog Ego:** `ACT-02`, `ACT-06`, `SEC-06`, `CANV-05`.
2. **`Protocols` como contrato estructural (`__init__.py:43-81`)** — `Model`, `Environment` y `Agent` se
   declaran como `typing.Protocol` (tipado estructural, sin ABC ni herencia), de modo que cada componente se
   sustituye sin tocar el resto. `step()` es literalmente `execute_actions(self.query())`
   (`agents/default.py:128`), y `query()` consulta, acumula el coste (`:150`) y añade el mensaje (`:151`).
   - **Adaptación en Ego:** aplicable a `packages/runtime/src/ToolExecutionLoop.ts` para desacoplar
     `ModelRouter` / `ToolRegistry` / `Environment` sin jerarquía de clases. Es mejora de ergonomía, no hueco
     funcional: `AGENTS.md` §2 ya exige el desacoplamiento y el loop ya existe
     (`ToolExecutionLoop.ts:76,306`).
   - **Relación con Backlog Ego:** `ACT-01`, `ACT-02`, `INT-01`.

### Bloque B: Presupuestos de turno y de proceso ###

*Ubicación en fuente:* `src/minisweagent/agents/default.py`, `src/minisweagent/models/__init__.py`

1. **Presupuesto triple comprobado antes de la llamada (`agents/default.py:26-33,132-147`)** — `step_limit`
   (nº de llamadas), `cost_limit` (USD acumulado) y `wall_time_limit_seconds` (reloj de pared) se evalúan
   **antes** de gastar tokens; cada incumplimiento lanza una excepción terminal distinta
   (`LimitsExceeded` / `TimeExceeded`) y `0` significa "sin límite" (`:31`).
   - **Adaptación en Ego:** Ego tiene `maxSteps` (`packages/runtime/src/ToolExecutionLoop.ts:76,262,306`) y
     presupuesto por llamada (`packages/models/src/ModelRouter.ts:581-614`), pero **no tiene presupuesto de
     reloj de pared** ni tope global de proceso. Verificado por grep:
     `wallClock|wall_clock|wallTimeLimit|maxConsecutiveFormat` → **0 coincidencias** en `packages/`.
   - **Relación con Backlog Ego:** `ACT-02`, `SUB-09`, `DS-05`.
2. **Tope global de proceso y racha de errores de formato (`models/__init__.py:13-42`;
   `agents/default.py:32-33,100-114`)** — `GlobalModelStats` agrega coste y nº de llamadas de todo el proceso
   bajo `threading.Lock` y aborta al superar `MSWEA_GLOBAL_COST_LIMIT` / `MSWEA_GLOBAL_CALL_LIMIT`
   (`:30-31`). En paralelo, `max_consecutive_format_errors` (3 por defecto) corta el run tras N fallos de
   formato consecutivos, y el coste de esas llamadas —ya facturadas por el proveedor— se carga igualmente al
   acumulador (`:102`), para que los reintentos malformados no sean gratis.
   - **Adaptación en Ego:** `packages/subegos/src/SubEgoBudget.ts:103-266` presupuesta **por Sub-Ego**
     (`maxTokensPerCall`, `maxDailyCostUsd`) y `packages/execution/src/CircuitBreaker.ts:204` limita llamadas
     por herramienta, pero ningún agregador corta el proceso completo;
     `packages/runtime/src/ErrorHandler.ts:40` cuenta `maxConsecutiveToolErrors` para fallos de
     **herramienta**, no de **formato de salida del modelo**.
   - **Relación con Backlog Ego:** `SUB-09`, `DEC-08`, `DS-05`, `ACT-08`.

### Bloque C: Contrato de observación y de error de formato ###

*Ubicación en fuente:* `src/minisweagent/config/benchmarks/swebench.yaml`,
`src/minisweagent/config/mini.yaml`, `src/minisweagent/models/utils/actions_toolcall.py`

1. **Observación con cabeza/cola y `elided_chars` (`config/benchmarks/swebench.yaml:131-158`)** — Si la
   salida supera 10 000 caracteres, el modelo recibe `<output_head>` (5 000) + `<elided_chars>` con el
   **número exacto de caracteres omitidos** + `<output_tail>` (5 000), y un `<warning>` con consejo operativo
   ("usa `head`, `tail` o `sed`; si necesitas todo, redirige a fichero y busca dentro"). La variante
   `config/mini.yaml:112-128` emite el mismo contrato en JSON (`output_head` / `output_tail` /
   `elided_chars`).
   - **Adaptación en Ego:** `packages/execution/src/ExecutionManager.ts:469-501` (`enforceOutputLimit`) trunca
     y **descarta** el tramo final, envolviendo la salida en `{ truncated, preview }` sin cuantificar lo
     perdido ni ofrecer vía de relectura. El contrato head/tail + recuento es superior para el modelo y es
     barato de adoptar. Verificado por grep: `elided|output_head|outputHead|elidedChars` → **0
     coincidencias**.
   - **Relación con Backlog Ego:** `ACT-03`, `ACT-08`, `CANV-07`.
2. **Discriminación "error de formato" vs. "truncado por límite de tokens"
   (`models/utils/actions_toolcall.py:30-76`; `config/mini.yaml:129-149`)** — El síntoma "no hay tool call"
   tiene dos causas distintas y el template las separa por `finish_reason`: si `finish_reason == "length"` el
   mensaje pide concisión; si no, pide corregir el formato de la tool call (`mini.yaml:130-149`). La excepción
   `FormatError` transporta el `finish_reason` como variable de template (`actions_toolcall.py:36,70`).
   - **Adaptación en Ego:** `packages/runtime/src/ErrorHandler.ts` + `packages/tool-call-repair/` reparan JSON
     truncado, pero el bucle no distingue "el modelo se quedó sin tokens" de "el modelo produjo basura", y
     `CausalErrorCategory` (`packages/runtime/src/types.ts:215-224`) no tiene categoría para ello.
   - **Relación con Backlog Ego:** `ACT-08`, `ACT-02`, `DEC-08`.

### Bloque D: Caché de prefijo y configuración en capas ###

*Ubicación en fuente:* `src/minisweagent/models/utils/cache_control.py`,
`src/minisweagent/models/utils/anthropic_utils.py`, `src/minisweagent/config/__init__.py`,
`src/minisweagent/utils/serialize.py`

1. **Caché de prefijo sobre el último mensaje (`models/utils/cache_control.py:49-67`)** — Limpia los marcadores
   previos y coloca `cache_control: {type:"ephemeral"}` en el **último** mensaje, de modo que el prefijo
   creciente de la conversación (que solo cambia por el append) se reutilice en caché. En la misma pasada,
   `models/utils/anthropic_utils.py:11-28` reordena los bloques `thinking` al frente del mensaje del
   asistente, requisito de la API de Anthropic, e inyecta un bloque de texto vacío si el mensaje solo tenía
   razonamiento (`:26`).
   - **Adaptación en Ego:** Ego ya cachea el bloque **de sistema**
     (`packages/models/src/providers/AiSdkAnthropicProvider.ts:243-271`;
     `packages/models/src/types.ts:108-113`, EGO-FIND-40 verificado por test en
     `packages/models/test/ModelRouter-resilience.test.ts:388-450`) pero **no** marca el último mensaje de
     usuario/tool. La reordenación de bloques `thinking` no aplica: AI SDK v7 normaliza el payload.
   - **Relación con Backlog Ego:** `CORE-03`, `INT-02`, `SUB-09`.
2. **Configuración en capas con centinela `UNSET` (`config/__init__.py:12-61`;
   `utils/serialize.py:6-29`; `run/mini.py:70-92`)** — La resolución recorre una lista de candidatos (path
   explícito → `MSWEA_CONFIG_DIR` → builtin → extra → benchmarks) (`config/__init__.py:17-23`); los overrides
   `clave=valor` se convierten en dict anidado (`:31-53`); el merge recursivo **omite los valores `UNSET`**
   (`utils/serialize.py:19-21`), lo que permite que la CLI sobrescriba el YAML sin borrar claves no tocadas.
   Las credenciales van a un `.env` **global** en el directorio de configuración del usuario, nunca al
   repositorio (`run/utilities/config.py:78-92`). Complemento: `models/utils/retry.py:9-25` aplica backoff
   exponencial con lista explícita de excepciones **no reintentables** (`litellm_model.py:50-57`), distinción
   que Ego no tiene (aunque su backoff con jitter, EGO-FIND-37, sí es superior).
   - **Adaptación en Ego:** no existe un resolvedor de configuración en capas; grep
     `recursive_merge|UNSET|ConfigResolver` → **0 coincidencias**. Hoy la configuración está dispersa:
     `packages/subegos/src/SubEgoFactory.ts:356-383` parsea YAML de Sub-Egos,
     `packages/execution/src/SafeConfigMutation.ts:25` muta configuración de forma segura y
     `packages/models/src/ModelRouter.ts` declara opciones embebidas en el código.
   - **Relación con Backlog Ego:** `SEC-05`, `SEC-03`, `ACT-01`, `SUB-02`, `INT-02`.

### Bloque E: Contrato de edición/entrega y harness de evaluación ###

*Ubicación en fuente:* `src/minisweagent/config/benchmarks/swebench.yaml`,
`src/minisweagent/environments/local.py`, `src/minisweagent/run/benchmarks/`

1. **Entrega verificada por `git diff` y centinela de fin (`config/benchmarks/swebench.yaml:75-104`;
   `environments/local.py:45-56`)** — El protocolo exige (1) generar el diff con
   `git diff -- <ficheros modificados> > patch.txt` listando **solo** ficheros de código, (2) **verificar** que
   el parche contiene las cabeceras `--- a/` y `+++ b/` antes de entregar, y (3) emitir el comando exacto
   `echo COMPLETE_TASK_AND_SUBMIT_FINAL_OUTPUT && cat patch.txt`. El entorno comprueba la primera línea de
   stdout (`local.py:48`) y, si coincide con returncode 0, lanza `Submitted` con el resto de stdout como
   entrega (`:49-56`).
   - **Adaptación en Ego:** el motor de diff ya es canónico
     (`packages/tools/src/native/git/ChangeSetService.ts:56-90`) y `git_diff` ya es tool nativa
     (`packages/tools/src/native/git/NativeGitTool.ts:64`); lo que falta es el **gate obligatorio**: un
     Sub-Ego de Engineering no puede declarar cumplida la tarea sin que el diff del workspace se haya
     materializado y revisado (coherente con `ACT-06`/`ACT-07`, que ya muestran el diff en la tarjeta de
     aprobación).
   - **Relación con Backlog Ego:** `ACT-06`, `ACT-07`, `DOM-01`, `SEC-06`.
2. **Harness de evaluación por instancia aislada y reanudable
   (`run/benchmarks/swebench.py:68-119,122-177,229-233`;
   `run/benchmarks/utils/batch_progress.py:36-178`)** — Imagen de contenedor **por instancia**
   (`swebench.py:68-76`), entorno inicializado con comando de arranque parametrizado (`:89-93`), `preds.json`
   actualizado bajo `threading.Lock` (`:97-108`), **reanudabilidad** (las instancias ya resueltas se saltan al
   relanzar, `:229-233`), trayectoria por instancia (`:162-175`) y reporte YAML agregado de `exit_status`
   (`batch_progress.py:145-178`).
   - **Adaptación en Ego:** el patrón de "caso aislado + estado terminal por caso + reanudación + reporte
     agregado" es reusable para el QA de Ego, pero la **implementación** (Docker, datasets de HuggingFace,
     Modal) es ajena a un SOC local-first. Fase destino: **Fase 07 (Tasks) / P1**.
   - **Relación con Backlog Ego:** `TASK-01`, `TASK-03`, `TASK-10`, `DEC-07`.

---

## 3. Matriz de Extracción vs Descarte ##

| Componente mini-SWE-agent | Acción en Ego | Razón Técnica / Arquitectónica |
| --- | :---: | --- |
| `agents/default.py:88-152` (bucle, salida terminal, presupuestos) | **EXTRAER & ADAPTAR** | Aporta la taxonomía de salida terminal tipada y el presupuesto de reloj de pared, ausentes en `packages/runtime/`. |
| `__init__.py:43-81` (Protocols estructurales) | **EXTRAER PATRÓN** | Tipado estructural para `Model`/`Environment`/`Agent`; mejora de ergonomía sobre un desacoplamiento que Ego ya exige. |
| `models/__init__.py:13-42` + `agents/default.py:100-114` | **EXTRAER & ADAPTAR** | Agregador de coste/nº de llamadas a nivel de proceso y racha de errores de formato; hoy el presupuesto es por Sub-Ego y por tool. |
| `config/benchmarks/swebench.yaml:131-158` (observación head/tail) | **EXTRAER & ADAPTAR** | `ExecutionManager.enforceOutputLimit` trunca y descarta; head/tail + `elided_chars` cuantifica lo perdido y ofrece recuperación. |
| `config/mini.yaml:129-149` + `actions_toolcall.py:30-76` | **EXTRAER & ADAPTAR** | Distingue truncado por límite de tokens de error de formato; `CausalErrorCategory` no tiene esa categoría. |
| `models/utils/cache_control.py:49-67` | **EXTRAER & ADAPTAR** | Extiende EGO-FIND-40 (ya cachea el bloque de sistema) al último mensaje, que es el prefijo creciente del turno. |
| `config/__init__.py:12-61` + `utils/serialize.py:6-29` | **EXTRAER & ADAPTAR** | Configuración en capas con centinela `UNSET`; hoy no existe resolvedor de configuración en el repo. |
| `models/utils/retry.py:9-25` + `models/utils/anthropic_utils.py:11-28` | **EXTRAER PATRÓN** | La lista de excepciones no reintentables es el delta útil (el backoff con jitter ya lo tiene `ModelRouter.ts`); la reordenación de `thinking` ya está resuelta por AI SDK v7. |
| `config/benchmarks/swebench.yaml:75-104` + `environments/local.py:45-56` | **EXTRAER & ADAPTAR** | Gate de verificación del diff antes de declarar cumplida la tarea y centinela de entrega auditable. |
| `run/benchmarks/` (harness de evaluación) | **SÓLO INSPIRACIÓN** | El patrón de instancia aislada y reporte de `exit_status` es valuable para el QA de Ego; la implementación (Docker + datasets) se difiere a Fase 07 (`MSWE-08`). |
| `environments/docker.py`, `environments/singularity.py`, `environments/extra/` (Contree, Bubblewrap, SWE-ReX Modal) | **DESCARTAR** | Orquestación de contenedores y sandbox remoto ajena al desktop local-first; contradice el principio 9 y `SEC-05`. |
| `models/__init__.py:78-89` (9 clases de proveedor vía `litellm`) | **DESCARTAR** | Un segundo router no canónico compite con `packages/models/src/ModelRouter.ts` (`CORE-03`) y añade una dependencia pesada no permitida en P0. |
| `run/benchmarks/swebench.py:53-62` (datasets SWE-bench) + `pyproject.toml:33-48` (`datasets`, `modal`, `contree-sdk`) | **DESCARTAR** | Contaminación de dominio (`AGENTS.md` §4): el corpus, el leaderboard y el modelo de producto de evaluación son de otro dominio; `datasets` arrastra HuggingFace al runtime. |
| Formato de parche `*** Begin Patch` / `*** Update File` | **DESCARTAR** | **No existe en este clon** (0 coincidencias de grep en v2.4.6). No hay upstream que portar y Ego ya tiene motor de diff canónico (`ChangeSetService.ts`); portar un parser crearía un segundo parser. |

---

## 4. Estado real verificado (2026-10-20) ##

> Criterio de cierre: fichero adaptado **y** caller en producción (grep sobre `packages/` + `apps/desktop/`,
> excluyendo `test/`, `dist/`, `node_modules/`).
> Este repositorio de referencia es **nuevo**: no hay asimilación previa. Las búsquedas siguientes se ejecutaron
> sobre `packages/` + `apps/desktop/` y ninguna devuelve un caller de producción.

```text
Select-String "exit_status|exitStatus|TerminalExit|submission"          packages/  -> 0 coincidencias
Select-String "wallClock|wall_clock|wallTimeLimit|maxConsecutiveFormat" packages/  -> 0 coincidencias
Select-String "elided|output_head|outputHead|elidedChars"              packages/  -> 0 coincidencias
Select-String "recursive_merge|UNSET|ConfigResolver"                    packages/  -> 0 coincidencias
Select-String "Begin Patch|Update File|Add File|Delete File|End Patch"  repos-referencia/mini-swe-agent/ -> 0 coincidencias
```

| ID | Patrón | Estado | Evidencia / Fundamento |
| --- | --- | :---: | --- |
| `MSWE-01` | Taxonomía de salida terminal tipada (la excepción transporta el desenlace) | 🆕 Pendiente | No existe en `packages/`. `packages/runtime/src/types.ts:15-20` define `LoopStatus` (`completed` / `approval_required` / `max_steps_exceeded` / `aborted` / `error`) pero **no** transporta `exit_status` ni `submission`; grep `exit_status\|exitStatus\|submission` → 0. **Cableado:** ampliar `LoopStatus` en `packages/runtime/src/types.ts` y emitir el desenlace como `EgoEvent` en `packages/runtime/src/ToolExecutionLoop.ts`, persistido en `gov/audit` (`SEC-06`). Owner A2. |
| `MSWE-02` | Presupuesto triple de turno (pasos / coste / reloj de pared) + tope global de proceso | 🆕 Pendiente | Parcialmente cubierto: `packages/runtime/src/ToolExecutionLoop.ts:76,262,306` (`maxSteps`) y `packages/models/src/ModelRouter.ts:581-614` (`maxCostPerCallUsd`). Ausentes el **reloj de pared** y el **agregador global de proceso** (solo hay presupuesto por Sub-Ego en `packages/subegos/src/SubEgoBudget.ts:103-266` y cuota por tool en `packages/execution/src/CircuitBreaker.ts:204`). **Cableado:** `packages/runtime/src/ToolExecutionLoop.ts` (nuevos límites) + agregador en `packages/subegos/src/SubEgoBudget.ts`. Owner A2/A4. |
| `MSWE-03` | Observación con cabeza/cola y recuento explícito de caracteres omitidos | 🆕 Pendiente | No existe en `packages/`. `packages/execution/src/ExecutionManager.ts:469-501` (`enforceOutputLimit`) trunca y **descarta** el tramo final, envolviendo en `{ truncated, preview }` sin cuantificar lo perdido ni ofrecer relectura; grep `elided\|output_head` → 0. **Cableado:** renderer único de observaciones en `packages/runtime/src/ToolExecutionLoop.ts`, reutilizando el límite de `ExecutionManager` (`:165,284-285`). Owner A2/A4. |
| `MSWE-04` | Discriminación formato-vs-truncamiento + racha de errores de formato | 🆕 Pendiente | No existe en `packages/`. `packages/runtime/src/ErrorHandler.ts:40` cuenta `maxConsecutiveToolErrors` para fallos de **tool**, no de formato; `CausalErrorCategory` (`packages/runtime/src/types.ts:215-224`) no incluye categoría de salida truncada. **Cableado:** nueva categoría en `packages/runtime/src/types.ts` + racha en `packages/runtime/src/ToolExecutionLoop.ts`, usando el `finishReason` que ya viaja en `packages/models/src/types.ts` (`ModelStreamChunk`). Owner A2. |
| `MSWE-05` | Caché de prefijo por `cache_control` sobre el último mensaje | 🆕 Pendiente | Parcialmente cubierto y **extensible**: Ego cachea solo el bloque de sistema (`packages/models/src/providers/AiSdkAnthropicProvider.ts:243-271`; `packages/models/src/types.ts:108-113`; EGO-FIND-40 verificado en `packages/models/test/ModelRouter-resilience.test.ts:388-450`). No hay marca sobre el último mensaje de usuario/tool, que es el prefijo creciente del turno. **Cableado:** `toInstructions`/`toMessages` de `AiSdkAnthropicProvider.ts` + `packages/subegos/src/PromptAssembly.ts:384`. Owner A2. |
| `MSWE-06` | Configuración en capas con centinela `UNSET` + credenciales fuera del repositorio | 🆕 Pendiente | No existe en `packages/`. La configuración de Ego está dispersa: `packages/subegos/src/SubEgoFactory.ts:356-383` (YAML de Sub-Egos), `packages/execution/src/SafeConfigMutation.ts:25` (mutación segura) y opciones embebidas en `packages/models/src/ModelRouter.ts`; grep `recursive_merge\|UNSET\|ConfigResolver` → 0. **Cableado:** nuevo `packages/runtime/src/ConfigResolver.ts` con centinela `UNSET`, aplicado en `packages/models/src/ModelRouter.ts` y `packages/subegos/src/SubEgoFactory.ts`; credenciales solo en el `CredentialManager` (`SEC-03`), nunca en fichero de proyecto. Owner A2. |
| `MSWE-07` | Contrato de edición verificada por `git diff` + centinela de entrega auditable | 🆕 Pendiente | No existe como **gate**. El motor ya es canónico: `packages/tools/src/native/git/ChangeSetService.ts:56-90` (diff con cotas defensivas) y tool `git_diff` (`packages/tools/src/native/git/NativeGitTool.ts:64`); falta la obligación de **materializar y revisar el diff antes de declarar cumplida la tarea** y el centinela de entrega con su `submission`. **Cableado:** fase previa en `packages/execution/src/ApprovalEngine.ts:115` + cierre de turno en `packages/runtime/src/ToolExecutionLoop.ts` + evento en `gov/audit`. Owner A3/A4. |
| `MSWE-08` | Harness de evaluación por instancia aislada, reanudable y con reporte de `exit_status` | ⏳ Futura (Fase 07) | El patrón (`run/benchmarks/swebench.py:68-119,122-177,229-233`; `run/benchmarks/utils/batch_progress.py:36-178`) es valuable: caso aislado + estado terminal por caso + reanudación + reporte agregado. La **implementación** (Docker por instancia, datasets de HuggingFace, Modal) es incompatible con el runtime local-first de Ego (`AGENTS.md` §4, principio 9). Fase destino: **Fase 07 (Tasks) / P1**, construyendo el QA adversarial sobre `packages/tasks/src/BackgroundEngine.ts` + `packages/tasks/src/TaskCheckpoint.ts` (`TASK-01`, `TASK-03`, `TASK-10`) y el registro de veredictos de `packages/decision/src/DecisionAuditor.ts` (`DEC-07`). |
| `MSWE-09` | Stack de evaluación y multi-proveedor (litellm, datasets SWE-bench, Modal/Singularity/Contree/Bubblewrap) + ausencia de `*** Begin Patch` | 🚫 **Descartada (con justificación)** | Contaminación de dominio (`AGENTS.md` §4): el corpus SWE-bench, su leaderboard y el modelo de producto de evaluación son de otro dominio y no pertenecen al alcance de un SOC local-first. `litellm` (`models/__init__.py:78-89`) sería un **segundo router** no canónico frente a `packages/models/src/ModelRouter.ts` (`CORE-03`). Docker/Singularity/Contree/Bubblewrap/Modal (`environments/docker.py`, `environments/singularity.py`, `environments/extra/`) introducen orquestación de contenedores y egress cloud, incompatibles con `SEC-05` y `netPolicy`. Además, **el formato de parche `*** Begin Patch` no existe en este clon** (0 coincidencias en v2.4.6): no hay upstream que portar y Ego ya tiene motor de diff canónico; portar un parser de parches crearía un segundo parser junto a `ChangeSetService.ts`. |

**Recuento:** 0 `✅ Completada` · 1 `🚫 Descartada` · 7 `🆕 Pendiente` · 1 `⏳ Futura` — **9 tareas**.

---

## 5. Descarte normalizado a la forma canónica ##

Las filas de la matriz §3 usaban la forma `**DESCARTAR**`; se normalizan aquí a
`🚫 Descartada (con justificación)` (AGENTS.md §4) conservando el motivo original:

| Componente mini-SWE-agent | Veredicto | Fundamento |
| --- | :---: | --- |
| `environments/docker.py`, `environments/singularity.py`, `environments/extra/` (Contree, Bubblewrap, SWE-ReX Modal) | 🚫 **Descartada (con justificación)** | Orquestación de contenedores y sandbox remoto: contradice el runtime in-process y local-first de `AGENTS.md` §2 y el principio 9; excede el perímetro de `SEC-05` (paths permitidos, red bloqueada). |
| `models/__init__.py:78-89` (9 clases de proveedor vía `litellm`) | 🚫 **Descartada (con justificación)** | Un segundo router no canónico compite con `packages/models/src/ModelRouter.ts` (`CORE-03`); `litellm` es una dependencia pesada prohibida en P0 (`AGENTS.md` §4). |
| `run/benchmarks/swebench.py:53-62` (datasets SWE-bench) + `pyproject.toml:33-48` (`datasets`, `modal`, `contree-sdk`) | 🚫 **Descartada (con justificación)** | Contaminación de dominio (`AGENTS.md` §4): corpus, leaderboard y producto de evaluación son de otro dominio; `datasets` arrastra HuggingFace al runtime de un SOC local-first. |
| Formato de parche `*** Begin Patch` / `*** Update File` | 🚫 **Descartada (con justificación)** | Inexistente en el clon v2.4.6 (0 coincidencias de grep). No hay upstream que portar; Ego ya dispone de motor de diff canónico (`ChangeSetService.ts`) y un segundo parser de parches sería ambiguo. Se extrae en su lugar el contrato de edición verificada (`MSWE-07`). |
