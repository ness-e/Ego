# Automatización con agentes: workflow engines, ejecución durable y uso del ordenador #

| Campo | Valor |
| --- | --- |
| Estado | Activo — investigación de estado del arte (material de referencia, **no normativo**) |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Verificación de datos | GitHub API `repos/<org>/<repo>` + HTML de `github.com/<org>/<repo>` (stars, licencia, último push) |
| Alcance | Workflow engines, automatización con agentes, computer/browser use, asistentes locales |
| Relación | Complementa a `docs/extractions/{opencode,codex,openhands,mini-swe-agent,goose}.md` |

> **Este documento no es normativo.** Lo que gobierna el producto son
> [`docs/jerarquia-canonica.md`](../jerarquia-canonica.md),
> [`docs/product/principios-innegociables.md`](../product/principios-innegociables.md) y los ADRs.
> Este informe **extrae patrones**, no propone dependencias.

---

## 1. Resumen ejecutivo (TL;DR) ##

1. El estado del arte se divide en **tres capas con contratos distintos**: (a) *workflow engines*
   deterministas y durables (Temporal, DBOS, Restate, Trigger.dev), (b) *orquestadores de agentes*
   sobre grafos (LangGraph, CrewAI Flows, AutoGen GraphFlow, n8n/Dify/Flowise) y (c) *agentes que
   actúan sobre el ordenador o el navegador* (Anthropic, OpenAI CUA, browser-use, UFO, Stagehand).
2. La distinción de Anthropic es la bisagra de diseño de todo el sector: **workflows** = LLMs y
   herramientas orquestados por **rutas de código predefinidas**; **agents** = LLMs que **dirigen
   dinámicamente** su propio proceso y el uso de herramientas.
3. **Ego ya es, por arquitectura, un motor determinista con un agente dentro.** El Cognitive Runtime
   es el motor; el `ToolExecutionLoop` es el agente acotado. La conclusión operativa es que la
   automatización fiable de Ego debe vivir en el motor, no en el agente.
4. La mayoría de los *workflow engines* líderes son **servidores cloud** (Temporal, Airflow, n8n
   self-hosted multi-tenant, Conductor, DolphinScheduler). Contradicen el principio 9 (local-first).
   **Se extrae el patrón, no la dependencia.**
5. Los cinco mecanismos más transferibles son: **checkpoint en frontera de paso**, **clave de
   idempotencia + ledger previo a la ejecución**, **presupuesto triple (pasos / coste / reloj de
   pared)**, **aprobación suspendida con estado persistido** y **degradación a salida estructurada**
   en vez de corte brusco del turno.
6. El computer-use de referencia **no tiene tope de iteraciones** (`loop.py:118`, `while True:`) y
   delega el reintento al SDK (`max_retries=4`, `loop.py:125`). Es un patrón **no** transferible tal
   cual: Ego ya tiene `maxSteps` y presupuesto de coste, y debe añadir reloj de pared.
7. El computer-use más avanzado (OpenAI CUA sample app) **escribe código en un runtime persistente**
   en vez de emitir acciones una a una, lo que reduce los round-trips y permite verificar el efecto
   de cada cambio antes de continuar.
8. `browser-use` aporta el patrón de **degradación terminal**: al agotar `max_failures` se
   desactiva todo salvo la herramienta `done` y el agente debe declarar `success=false`
   (`service.py:1583-1587`). Es exactamente el contrato que Ego necesita para cerrar un turno
   fallido sin perder la trazabilidad.
9. **Veredicto computer-use para Ego**: no adoptar un agente de escritorio completo en P0. Adoptar
   el **nivel de control estructurado** (Playwright/CDP como tool nativa, no como agente) y dejar
   el control por píxeles/coordenadas para P1 tras endurecer `ApprovalEngine`.
10. **Copyleft fuerte** detectado en siete proyectos que se suelen asumir como permisivos: **n8n**
    (Sustainable Use License, *source-available*, no OSI), **Inngest** (SSPL v1), **Windmill**
    (mezcla Apache-2.0 + AGPLv3 + propietario), **Skyvern** (AGPL-3.0), **Cherry Studio** y
    **Reor** (AGPL-3.0), **Lightpanda** (AGPL-3.0).

---

## 2. Metodología ##

### 2.1 Criterios de inclusión ###

Un proyecto entra en el corpus si cumple **al menos tres** de estos cinco criterios:

| Criterio | Definición operativa |
| --- | --- |
| Fama | ≥1 000 estrellas en GitHub al 2026-10-20, o referencias explícitas en los informes canónicos de Anthropic/OpenAI/Google |
| Uso | Producto en producción con documentación pública de arquitectura y guías de operación |
| Madurez |actividad pública verificable en los últimos 12 meses (último push) y esquema de releases |
| Licencia | Licencia OSI permisiva **o** al menos un núcleo con licencia permisiva identificable |
| Transferencia | Existe un mecanismo interno (código, fichero, parámetro) citable y portable a TypeScript |

### 2.2 Procedimiento de verificación ###

- **Estrellas, licencia, lenguaje y último push**: se leyeron del repositorio real vía la API de
  GitHub (`https://api.github.com/repos/<org>/<repo>`) y, cuando la API agotaba el cupón de
  peticiones anónimas (60/h), del JSON embebido en el HTML de `github.com/<org>/<repo>`
  (campo `stargazerCount`). **Todas las cifras de la tabla maestra están verificadas**, salvo que
  se marque explícitamente *no verificado*.
- **Mecanismos**: se leyó el código fuente en `raw.githubusercontent.com` y se citan rutas y líneas
  reales (`ruta:línea`). No se infiere comportamiento sin leer el fichero.
- **Artículos conceptuales**: se leyeron directamente. Anthropic *Building effective agents* se leyó
  en `https://www.anthropic.com/engineering/building-effective-agents` (HTTP 200, texto extraído).
  *Compound AI Systems* se leyó en el blog de BAIR. El PDF de OpenAI (*A practical guide to building
  agents*) se verificó por URL y por resumen indexado, pero **el PDF no fue extraído**: las
  afirmaciones sobre él se marcan como paráfrasis, nunca como cita literal.
- **No verificado**: `openai/cua-sample` y `openai/openai-cua` **no existen** (HTTP 404). El
  repositorio real es `openai/openai-cua-sample-app`. `Scrapybara/scrapybara` y `pieces-app/pieces`
  **no existen** bajo esos nombres.
- **Auditoría posterior (2026-10-20)**: todas las cifras, licencias y lenguajes de
  §3, §6 y §7 se reconsultaron contra la API REST de GitHub y se comprobaron las rutas
  internas del repo. El detalle está en la sección final «Verificación de datos».

### 2.3 Criterio de veredicto ###

| Veredicto | Significado |
| --- | --- |
| **ADOPTAR** | El motor o componente puede entrar en el repo como dependencia sin colisionar con los guardrails |
| **ADAPTAR** | El patrón es valioso; la implementación se reescribe en el sustrato de Ego (TypeScript + VantaDB) |
| **PATRÓN** | Se extrae una idea o un parámetro; no se porta código |
| **DESCARTAR** | Incompatible con los 10 principios, con el stack o con la licencia; se documenta el motivo |

---

## 3. Estado del arte ##

### 3.1 Tabla maestra — workflow engines y orquestadores de procesos ###

| Proyecto | Stars | Licencia | Lenguaje | Qué resuelve | ¿Motor o Aplicación? | Veredicto Ego |
| --- | ---: | --- | --- | --- | --- | --- |
| [Temporal](https://github.com/temporalio/temporal) | 23 844 | MIT | Go | Ejecución durable de workflows y actividades con reintentos, señales y estadoQueryable | Motor | PATRÓN (durabilidad + señal/aprobación) |
| [n8n](https://github.com/n8n-io/n8n) | 208 095 | Sustainable Use License (no OSI) | TypeScript | Automatización visual con nodos, reintentos, deduplicación y agentes | Aplicación | PATRÓN (dedup + reintento); dependencia DESCARTADA por licencia |
| [Activepieces](https://github.com/activepieces/activepieces) | 25 126 | MIT (core) + licencia EE | TypeScript | Automatización con nodos y ~400 servidores MCP | Aplicación | PATRÓN (catálogo MCP como tooling) |
| [Windmill](https://github.com/windmill-labs/windmill) | 18 229 | Apache-2.0 + AGPLv3 + propietario | Rust | Scripts como workflows, webhooks, UIs | Aplicación | PATRÓN; núcleo AGPLv3 → no portar código |
| [Node-RED](https://github.com/node-red/node-red) | 23 762 | Apache-2.0 | JavaScript | Programación low-code orientada a eventos | Aplicación | PATRÓN (nodo como contrato) |
| [Kestra](https://github.com/kestra-io/kestra) | 29 901 | Apache-2.0 | Java | Orquestación y scheduling declarativo | Motor | PATRÓN (YAML declarativo) |
| [Apache Airflow](https://github.com/apache/airflow) | 47 223 | Apache-2.0 | Python | DAGs de datos, scheduling, retries, backfill | Motor | PATRÓN (backfill idempotente) |
| [Dagster](https://github.com/dagster-io/dagster) | 16 297 | Apache-2.0 | Python | Orquestación centrada en assets de datos | Motor | PATRÓN |
| [Prefect](https://github.com/PrefectHQ/prefect) | 24 043 | Apache-2.0 | Python | Flujos Python resilientes con estado persistente | Motor | PATRÓN (timeout de reloj de pared) |
| [Inngest](https://github.com/inngest/inngest) | 5 964 | SSPL v1 + Apache-2.0 futuro | Go | Step functions durables orientadas a eventos | Motor | PATRÓN; **SSPL → no portar código** |
| [Trigger.dev](https://github.com/triggerdotdev/trigger.dev) | 16 584 | Apache-2.0 | TypeScript | Agentes y workflows durables en TypeScript | Motor | **ADAPTAR** (único motor durable en TS permisivo) |
| [Restate](https://github.com/restatedev/restate) | 4 580 | BSL-1.1 (source-available; API `NOASSERTION`) | Rust | Ejecución durable con claves de idempotencia | Motor | PATRÓN (idempotency key); licencia no adoptable |
| [Hatchet](https://github.com/hatchet-dev/hatchet) | 8 148 | MIT | Go | Orquestación de tareas de fondo y agentes | Motor | PATRÓN |
| [Conductor OSS](https://github.com/conductor-oss/conductor) | 32 342 | Apache-2.0 | Java | Motor de workflows dirigido por eventos | Motor | PATRÓN |
| [DolphinScheduler](https://github.com/apache/dolphinscheduler) | 14 525 | Apache-2.0 | Java | Scheduling y DAGs de gran escala | Motor | PATRÓN |
| [DBOS Transact (TS)](https://github.com/dbos-inc/dbos-transact-ts) | 1 406 | MIT | TypeScript | Workflows durables sobre base de datos | Motor | **ADAPTAR** (el más cercano a Ego: TS + estado durable) |
| [DBOS Transact (PY)](https://github.com/dbos-inc/dbos-transact-py) | 1 639 | MIT | Python | Igual, para Python | Motor | PATRÓN |
| [Camunda](https://github.com/camunda/camunda) | 4 326 | No detectada | Java | BPMN y orquestación de procesos | Motor | PATRÓN (BPMN = vocabulario, no motor) |
| [Flowable](https://github.com/flowable/flowable-engine) | 9 598 | Apache-2.0 | Java | BPM ligero para desarrolladores | Motor | PATRÓN |
| [Netflix Maestro](https://github.com/Netflix/maestro) | 3 845 | Apache-2.0 | Java | Orquestador de workflows de Netflix | Motor | PATRÓN |
| [Cadence (Uber)](https://github.com/uber/cadence) | 9 504 | Apache-2.0 | Go | Orquestación durable y asíncrona | Motor | PATRÓN (precursor de Temporal) |

### 3.2 Tabla maestra — automatización con agentes ###

| Proyecto | Stars | Licencia | Lenguaje | Qué resuelve | ¿Motor o Aplicación? | Veredicto Ego |
| --- | ---: | --- | --- | --- | --- | --- |
| [Dify](https://github.com/langgenius/dify) | 158 980 | Licencia Dify (Apache-2.0 con condiciones) | Python | Workflows agentic, RAG, modelos y herramientas | Aplicación | PATRÓN (nodo con reintentos + contrato) |
| [Langflow](https://github.com/langflow-ai/langflow) | 155 859 | MIT | Python | Constructor visual de agentes y workflows | Aplicación | PATRÓN |
| [Flowise](https://github.com/FlowiseAI/Flowise) | 55 512 | No estándar | TypeScript | Agentes visuales con nodos y RAG | Aplicación | **Descartada como referencia**: repo *archivado* (último push 2026-08-13) |
| [CrewAI](https://github.com/crewAIInc/crewAI) | 59 901 | MIT | Python | Flows con `@start`/`@listen`, persistencia y feedback humano | Motor | **ADAPTAR** (persistencia de flow + feedback humano) |
| [AutoGen](https://github.com/microsoft/autogen) | 61 495 | CC-BY-4.0 (docs; código MIT) | Python | Teams de agentes, GraphFlow, MCP | Motor | PATRÓN (GraphFlow: grafo dirigido explícito) |
| [LangGraph](https://github.com/langchain-ai/langgraph) | 43 554 | MIT | Python | Agentes con checkpointing y ejecución durable | Motor | **ADAPTAR** (modelo de `Durability` y `RetryPolicy`) |
| [Relevance AI](https://github.com/relevanceai/relevanceai) | 284 | Apache-2.0 | Python | Workforce multi-agente | Aplicación | PATRÓN marginal; ecosystem pequeño |
| [Google ADK (Python)](https://github.com/google/adk-python) | 21 917 | Apache-2.0 | Python | Toolkit de agentes: Sequential, Parallel, Loop, Router | Motor | PATRÓN (patrones declarativos) |
| [Google ADK (JS)](https://github.com/google/adk-js) | 1 443 | Apache-2.0 | TypeScript | Mismo modelo en TypeScript | Motor | PATRÓN |

### 3.3 Fichas cortas por proyecto (selección argumentada) ###

#### Temporal — el patrón canónico de ejecución durable ####

Motor de workflows durables. Lo relevante para Ego no es Go ni el servidor, sino tres cosas:

1. **Reintentos con coeficiente por clase de operación.** `common/util.go:71-87` define intervalos y
   coeficientes distintos según el motivo: `taskRescheduleBackoffCoefficient = 1.1` (reintento de
   tarea), `1.5` para *task not ready* y *resource exhausted*. No es un único backoff global.
2. **Retardo solicitado por el servidor.** `common/backoff/retry.go:188-195` (`MakeBackoffAlgorithm`)
   permite que el llamador imponga un intervalo concreto en vez del algorítmico. Es el mecanismo que
   permite respetar un `Retry-After` de un proveedor sin romper la semántica del motor.
3. **La ActivityID es la clave de deduplicación.** `service/history/workflow/activity.go:255` y `:293`
   resuelven la actividad por `GetActivityByActivityID`. La identidad de la operación *es* la clave de
   idempotencia, no un campo aparte.

**Adaptación a Ego**: `packages/tasks/src/` ya tiene `TaskMemory` y checkpoints. Lo que falta es la
disciplina de *ActivityID = identidad estable de la unidad de trabajo*, y el backoff por clase de
fallo en lugar de uno global.

#### DBOS Transact — el motor durable más cercano a Ego ####

`dbos/_recovery.py:14-27` contiene el mecanismo más transferible de todo el corpus:

> "Recovery re-enqueues rather than executing directly, so that every recovered [workflow] … handoff
> admits exactly one runner, which makes duplicate recovery requests [idempotent]"

Traducción: la recuperación **reencola**, no ejecuta. Y la entrega al runner es **exactly-one**, de
modo que dos peticiones de recuperación duplicadas no ejecutan el workflow dos veces. Además,
`dbos/_recovery.py:30-48` (`startup_recovery_thread`) recupera workflows pendientes **al arrancar**,
que es exactamente el arranque en frío de una app de escritorio.

**Adaptación a Ego**: `BackgroundEngine` debería **re-encolar** en su cola durable en lugar de
reejecutar en el sitio. Es la diferencia entre "reanudar" y "rehacer".

#### LangGraph — el modelo de durabilidad explícito ####

`libs/langgraph/langgraph/types.py:98-104`:

> `Durability = Literal["sync", "async", "exit"]`
>
> - `'sync'`: los cambios se persisten **sincrónicamente antes** de que empiece el siguiente paso.
> - `'async'`: los cambios se persisten **asincrónicamente** mientras el siguiente paso se ejecuta.
> - `'exit'`: los cambios se persisten **sólo al salir** del grafo.

Es la abstracción que Ego necesita y no tiene: **el coste de durabilidad debe ser una decisión
explícita por paso**, no un global. Un paso que muta el filesystem no puede permitirse `exit`.

`types.py:427-443` fija la `RetryPolicy` por defecto: `initial_interval=0.5`,
`backoff_factor=2.0`, `max_interval=128.0`, `max_attempts=3`, `jitter=True` y un `retry_on`
explícito. `types.py:461-477` añade `TimeoutPolicy` con `run_timeout` como **tope duro de reloj de
pared** y cancelación cooperativa.

`libs/langgraph/langgraph/pregel/_checkpoint.py:174-200` implementa `checkpoint_superseded`: un
checkpoint con hijo ya no es el último, lo que permite detectar escritura concurrente sin bloquear.

**Adaptación a Ego**: el `TaskCheckpoint` de `packages/tasks/src/` debería llevar **modo de
durabilidad por paso** y registrar `superseded` cuando dos writes compiten por el mismo checkpoint.

#### n8n — deduplicación de primera clase y reintentos que NO hay que copiar ####

`packages/core/src/data-deduplication-service.ts` es un **servicio de deduplicación de primer
nivel**: `checkProcessedAndRecord` (comprueba y registra en una sola operación), `removeProcessed`,
`clearAllProcessedItems`, `getProcessedDataCount`, y un enum `DeduplicationScope` (workflow, global,
custom). Este es el patrón exacto que Ego necesita para el ledger de tool calls que
`docs/extractions/openhands.md` (`OHND-03`) ya dejó anotado como pendiente.

En cambio, `packages/core/src/execution-engine/workflow-execute.ts:1841-1850` (`getRetryParams`) es
un **contraejemplo**:

```text
Math.min(5, Math.max(2, executionData.node.maxTries || 3)),
Math.min(5000, Math.max(0, executionData.node.waitBetweenTries || 1000)),
```

Intervalo **fijo**, sin backoff exponencial ni jitter, y el consumo en `:2358-2403` es un
`sleep(waitBetweenTries)` en bucle. El propio repo acota los parámetros a 5 intentos y 5 s de
espera. Ego ya tiene backoff con jitter en `packages/models/src/ModelRouter.ts`: **no copiar el
reintento de n8n**.

**Licencia**: `LICENSE.md` declara la *Sustainable Use License* y excluye los ficheros `.ee`.
Es *source-available*, **no OSI** y incompatible con la redistribución Apache-2.0 de Ego.

#### CrewAI Flows — persistencia de flow + feedback humano ####

`lib/crewai/src/crewai/flow/persistence/sqlite.py:44` define `SQLiteFlowPersistence`; `:113-125`
crea la tabla `flow_states` (`id`, `flow_uuid`, `state_json`) con índice por `flow_uuid`; y `:65`
comenta *"Flow is paused, state is already persisted"*. La línea 65 es el patrón de **aprobación
suspendida**: cuando el flujo se pausa para pedir feedback humano, **el estado ya está en disco**.

`lib/crewai/src/crewai/flow/human_feedback.py` y `lib/crewai/src/crewai/flow/async_feedback/`
completan el circuito: pausa → estado persistido → feedback → reanudación.

**Adaptación a Ego**: el `ApprovalEngine` de `packages/execution/src/ApprovalEngine.ts` mantiene
`PendingApproval` **en memoria**. Debe pasar a persistir el estado del run **antes** de suspender,
de modo que cerrar la app no pierda la aprobación pendiente.

#### Trigger.dev y Restate — idempotencia explícita ####

Trigger.dev es el único motor durable serio escrito en TypeScript con licencia Apache-2.0
(16 584 estrellas), por lo que es la referencia natural si Ego quisiera un motor externo (no se
recomienda: contradice el guardrail de no backend en P0, pero el *patrón* es el más transferible de
la categoría).

Restate (4 580 estrellas, licencia BSL-1.1 source-available) aporta el concepto más puro de **clave de
idempotencia**: la clave la decide la aplicación, el motor garantiza que una misma clave con el
mismo contenido no se ejecute dos veces, y una clave con contenido distinto falla explícitamente.
Es el modelo que Ego necesita para "aplicar este parche", "enviar este correo", "publicar esta
versión".

#### Inngest, Windmill, Skyvern, Cherry Studio, Reor, Lightpanda — licencias que obligan a rechazar ####

| Proyecto | Licencia detectada | Consecuencia para Ego (Apache-2.0) |
| --- | --- | --- |
| Inngest | SSPL v1 con "Apache 2.0 Future License" | Copyleft tipo server: **no portar código**; sólo leer el diseño |
| Windmill | Apache-2.0 **+** AGPLv3 **+** licencia propietaria (mixta por fichero) | Núcleo AGPL: **no portar código** |
| Skyvern | AGPL-3.0 | **No portar código**; usable solo como referencia de diseño |
| Cherry Studio | AGPL-3.0 | **No portar código** |
| Reor | AGPL-3.0 | **No portar código** |
| Lightpanda | AGPL-3.0 | **No portar código** |
| n8n | Sustainable Use License | Source-available no OSI: **no portar código** |
| Restate | BSL-1.1 (Business Source License 1.1; la API devuelve `NOASSERTION`) | Source-available: **no portar código** |

**Regla operativa derivada**: de este corpus, **sólo son portables** Temporal (MIT), DBOS (MIT),
LangGraph (MIT), CrewAI (MIT), Trigger.dev (Apache-2.0), Playwright/Puppeteer/Stagehand/midscene
(MIT/Apache-2.0), browser-use (MIT), UFO (MIT), Jan (Apache-2.0), AnythingLLM (MIT) y
LibreChat/Leon (MIT). Open WebUI es BSD-3 con cláusula de marca: portable con atribución, pero
no reutilizable en un producto Apache-2.0 sin revisar esa cláusula. El resto se cita, no se toca.

---

## 4. Workflow vs agente ##

### 4.1 La distinción de Anthropic (verbatim) ###

De [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
(Anthropic, leído directamente el 2026-10-20):

> "Workflows are systems where LLMs and tools are orchestrated through predefined code paths. Agents,
> on the other hand, are systems where LLMs dynamically direct their own processes and tool usage,
> maintaining control over how they accomplish tasks."

Y el criterio de selección:

> "When more complexity is warranted, workflows offer predictability and consistency for well-defined
> tasks, whereas agents are the better option when flexibility and model-driven decision-making are
> needed at scale."

Los **cinco patrones de workflow** que Anthropic define: *prompt chaining*, *routing*,
*parallelization* (sectioning y voting), *orchestrator-workers* y *evaluator-optimizer*. El bloque
constructivo es el **augmented LLM** (LLM + retrieval + tools + memory).

### 4.2 El marco de OpenAI y el de Google ###

- **OpenAI**, [A practical guide to building agents](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)
  (PDF de 34 páginas; **no extraído**, sólo verificada la URL y el resumen indexado): el agente se
  define como un LLM que **gestiona la ejecución del workflow y selecciona herramientas
  dinámicamente dentro de guardrails definidos**. La guía separa explícitamente *agente* de
  *workflow* y de *LLM call* simple, y organiza el diseño en tres bloques (instrucciones,
  herramientas, guardrails) más la intervención humana como guardrail. *Paráfrasis, no cita.*
- **Compound AI Systems** (BAIR, [The Shift from Models to Compound AI Systems](https://bair.berkeley.edu/blog/2024/02/18/compound-ai-systems/),
  2024-02-18): el diseño de sistemas compound es modular (recuperador, modelo, herramientas,
  planificador, memoria); el artículo insiste en el eje **operación**: *"it is important to track all
  the steps taken by the application and intermediate outputs"*.
- **Google**: el patrón dominante es el del **ADK** (Agent Development Kit), que implementa de forma
  explícita los patrones *Sequential*, *Parallel*, *Loop* y *Router*, más **agent-as-tool** para la
  orquestación multi-agente. `google/adk-python` (21 917 estrellas) y `google/adk-js` (1 443) son
  las implementaciones de referencia. La documentación canónica vive en `adk.dev`.

### 4.3 Qué significa para el Cognitive Runtime de Ego ###

Ego **ya vive en el lado workflow** por arquitectura (`docs/architecture/vision-general.md` §"Runtime
cognitivo propio"): el `ToolExecutionLoop` es un flujo de código predefinido
(ensamblado → router → modelo → despacho de tool → aprobación → respuesta) donde el LLM **no**
dirige el proceso: decide *qué tool* invocar dentro de un conjunto cerrado, pero no *qué pasos*
ejecutar ni *en qué orden*.

| Eje | Workflow (motor determinista) | Agente (modelo al mando) | Veredicto para Ego |
| --- | --- | --- | --- |
| Quién decide el siguiente paso | El código | El LLM | **Motor**: el `BackgroundEngine` decide; el modelo sólo propone |
| Forma del estado | Step function con estado explícito | Historial conversacional | **Motor**: `TaskMemory` + `TaskCheckpoint` en VantaDB |
| Reintentos | Declarativos, por tipo de fallo | El modelo vuelve a intentarlo | **Motor**: `ExecutionManager` + `CircuitBreaker` ya existen |
| Aprobación humana | Punto de espera explícito en el grafo | El modelo pregunta en el chat | **Motor**: `ApprovalEngine` con estado persistido |
| Cuándo usarlo | Proceso bien definido, muchas instancias | Tarea abierta, subtareas impredecibles | Ego: motor por defecto, agente acotado por tarea |
| Coste de un error | Alto (estado corrupto) | Bajo (un turno más) | El motor protege el estado; el agente sólo decide |
| Cuello de botella | Latencia de la orquestación | Latencia + coste del modelo | Budget Controller debe medir el motor |
| Verificabilidad | Alta (log de pasos) | Media (hay que inferir la intención) | `gov/audit` con `seq` durable |

**Conclusión de diseño (propuesta, no implementada)**: en Ego, la frontera debe ser explícita y
nombrada:

- **El motor** decide *qué paso* de una `BackgroundTask` se ejecuta, *con qué presupuesto*, *cuándo
  reintenta* y *cuándo suspende por aprobación*. Es determinista y su estado es durable.
- **El agente** decide, **dentro de un paso**, qué tool usar y con qué argumentos. Su salida es un
  *step result* validado que el motor acepta o rechaza.
- **El modelo nunca salta pasos.** Ni añade pasos al grafo de un run en curso sin pasar por el
  motor. Esto es lo que impide que un agente entrañe desborde el presupuesto.
- **Consecuencia sobre computer-use**: un agente de computer-use que decide su propio bucle es
  justamente el caso en que el LLM dirige el proceso → pertenece al lado *agente*, y por tanto es
  donde el motor NO puede garantizar presupuesto ni idempotencia. Esto explica por qué en §6 se
  recomienda **control estructurado** (navegador) y no control por píxeles en P0.

### 4.4 Tabla comparativa: motor vs agente en los proyectos del corpus ###

| Proyecto | Híbrido workflow/agente | Estado durable | Idempotencia explícita | Aprobación humana | Veredicto Ego |
| --- | --- | --- | --- | --- | --- |
| Temporal | Workflow puro | Sí (historial) | Sí (ActivityID) | Sí (Signal/Update) | PATRÓN de referencia |
| DBOS | Workflow puro | Sí (tabla de workflows) | Sí (workflow_id) | No nativo | PATRÓN de referencia |
| LangGraph | **Híbrido** (grafo + agente) | Sí (checkpointers) | Con checkpointer | Sí (`interrupt()`) | ADAPTAR |
| CrewAI Flows | Híbrido | Sí (SQLite) | No | Sí (human feedback) | ADAPTAR |
| AutoGen GraphFlow | Agente (grafo dirigido) | No por defecto | No | No nativo | PATRÓN |
| n8n / Dify / Flowise | Workflow + nodos de agente | Sí (ejecuciones) | Sí (n8n: dedup service) | Sí (nodo de espera) | PATRÓN |
| browser-use | Agente puro | Opcional (`save_state`) | No | Pausa/raise | PATRÓN de degradación |
| OpenAI CUA sample | Agente puro (escribe código) | Runtime persistente | No | Stop manual | PATRÓN de bucle |

---

## 5. Mecanismos de ejecución fiable ##

### 5.1 Tabla de mecanismos ###

| Mecanismo | Implementaciones de referencia | Patrón transferible a Ego | Veredicto |
| --- | --- | --- | --- |
| **Checkpoint en frontera de paso** | LangGraph (`pregel/_checkpoint.py`), Temporal (historial), DBOS (`flow_states`), CrewAI (`persistence/sqlite.py`) | Escribir el estado del run **después** de cada paso y **antes** del siguiente, con un modo de durabilidad explícito | **ADOPTAR** — bloquea `TASK-03` |
| **Clave de idempotencia + ledger** | Temporal (`ActivityID`), Restate (`idempotency key`), n8n (`DataDeduplicationService`), DBOS (`workflow_id`) | Clave estable `(runId, stepKey)` consultada **antes** de la ejecución material | **ADOPTAR** — ya propuesto en `OHND-03` |
| **Recuperación por reencolado** | DBOS (`_recovery.py:14-27`) | Al arrancar, **reencolar** los runs pendientes en vez de reejecutarlos | **ADOPTAR** |
| **Presupuesto triple** | LangGraph (`TimeoutPolicy`, `RetryPolicy`), mini-SWE-agent (`step/cost/wall-clock`) | Límite de pasos + coste + **reloj de pared**, comprobado **antes** de gastar | **ADOPTAR** — `MSWE-02` ya lo dejó anotado |
| **Aprobación suspendida** | CrewAI (`sqlite.py:65`), Temporal (Signal/Update), Prefect (pause/resume), n8n (Wait) | Persistir el estado **antes** de suspender; la aprobación es un evento, no un bloqueo de hilo | **ADOPTAR** — `OHND-04` |
| **Reintento con backoff y jitter** | LangGraph (`types.py:427-443`), Temporal (`backoff/retry.go:176-186`) | Exponencial con tope, jitter y `retry_on` explícito | **YA EXISTE** en `ModelRouter` — no duplicar |
| **Reintento con intervalo fijo** | n8n (`workflow-execute.ts:1849-1850`) | — | **DESCARTAR** (contrajitter) |
| **Clasificación definitivo vs transitorio** | OpenHands (`with-retry.ts:7-30`), browser-use (`service.py:1995-1999`) | Un 4xx distinto de 408/429 no se reintenta: repetir devuelve lo mismo | **ADOPTAR** — `OHND-06` |
| **Circuit breaker** | Ego ya (`packages/execution/src/CircuitBreaker.ts`) | Ventana + umbral + semicircuito | **YA EXISTE** |
| **Degradación a salida estructurada** | browser-use (`service.py:1583-1587`) | Al agotar fallos, forzar una salida final con `success=false` en vez de cortar el turno | **ADOPTAR** — cierra `MSWE-01` |
| **Detección de estancamiento + replan** | browser-use (`service.py:1471-1475`) | Contador de fallos consecutivos → *nudge* de replanificación antes de abandonar | **ADOPTAR** |
| **Presupuesto de contexto con recorte explícito** | Anthropic demo (`loop.py:244`), browser-use (`max_clickable_elements_length`) | Recortar y **cuantificar** lo perdido; nunca truncar en silencio | **ADOPTAR** — `MSWE-03` |
| **Heartbeat de proceso vivo** | UFO (`aip/resilience/heartbeat_manager.py`) | Detectar que el proceso que esperaba una aprobación ha muerto | **ADOPTAR** |
| **Timeout con degradación suave** | UFO (`aip/resilience/timeout.py:67-82`) | `with_timeout_or_none`: agotar el tiempo devuelve `None`, no lanza | **ADOPTAR** |
| **Cancelación cooperativa** | LangGraph (`TimeoutPolicy`, cooperative cancellation) | Comprobar el flag de aborto **entre** pasos y entre acciones | **ADOPTAR** — `ExecutionManager` tiene abort |
| **Cola durable + idempotencia de admisión** | OpenCode (`packages/core/src/session/inbox.ts:155-202`) | Separar *admitir* (idempotente, durable) de *ejecutar* | **ADOPTAR** — `OCDE-02` |
| **Outbox / inbox transaccional** | **No verificado en este corpus**: ningún motor del corpus lo implementa de forma explícita y documentada | El patrón es de integración con colas, no de ejecución local | **DEUDA ABIERTA** |
| **Sagas / compensaciones** | **No verificado**: no encontrado en el corpus revisado | Compensación explícita para pasos no transaccionales | **DEUDA ABIERTA** |
| **Trazas distribuidas (OpenTelemetry)** | **No verificado**: fuera del corpus; los motores usan su propio log de eventos | Un `traceId` por run y `spanId` por paso | **DEUDA ABIERTA** |
| **Exactly-once vs at-least-once** | DBOS, Temporal, Restate (implícito por diseño) | Declarar explícitamente la semántica por tipo de step | **ADOPTAR** |

### 5.2 Detalle de los cinco mecanismos más valuables ###

#### 5.2.1 Checkpoint + modo de durabilidad por paso ####

LangGraph ofrece tres modos (`types.py:98-104`). El coste de persistir es real, así que la decisión
debe ser **por paso**, no global:

- `sync` → el checkpoint se escribe **antes** de empezar el siguiente paso. Coste: una escritura por
  paso.
- `async` → la escritura corre en paralelo al paso siguiente. Coste: latencia solapada, pero ventana
  de pérdida si el proceso muere.
- `exit` → sólo al salir. Coste: mínimo. **Inaceptable** para pasos que mutan estado externo.

En Ego, la regla de asignación debería ser:

| Tipo de paso | Modo | Ejemplo en Ego |
| --- | --- | --- |
| Lectura pura | `async` | `memory_search`, `knowledge_search` |
| Tool con efeito reversible | `sync` | `fs_write` en workspace |
| Tool con efecto externo | `sync` + ledger | `git_commit`, `http_post`, `email_send` |
| Aprobación | `sync` **obligatorio** | Antes de suspender, el estado del run está en disco |

#### 5.2.2 Idempotencia: la clave antes que el lock ####

Tres proyectos convergen en la misma forma:

- **Temporal**: la `ActivityID` *es* la identidad de deduplicación
  (`service/history/workflow/activity.go:255,293`).
- **Restate**: la aplicación elige la clave; el motor rechaza la misma clave con contenido distinto.
- **n8n**: `DataDeduplicationService.checkProcessedAndRecord` comprueba y registra en una sola
  operación, con `DeduplicationScope` (workflow / global / custom).

La regla para Ego: **la clave se deriva de la semántica de la operación, no del reloj ni del
contador de intentos**. `call.id` (que `ToolExecutionLoop` ya propaga) sirve para *deduplicar
reintentos de la misma llamada*, pero **no** para *evitar dos efectos externos iguales*
(`commit twice`, `send twice`). Son dos claves distintas:

- `toolCallId` → **reintento de la misma invocación** (idempotencia de transporte).
- `effectKey = hash(operación, args, destino)` → **efecto externo único** (idempotencia de negocio).

El ledger se consulta **antes** de la ejecución material, tal y como ya está especificado en
`docs/extractions/openhands.md` (`OHND-03`).

#### 5.2.3 Presupuesto triple y por proceso ####

mini-SWE-agent ya está auditado (`MSWE-02`): `step_limit`, `cost_limit` y `wall_time_limit_seconds`
comprobados **antes** de gastar tokens, más un tope global de proceso. LangGraph aporta el
equivalente (`TimeoutPolicy.run_timeout` como tope duro de reloj de pared; `RetryPolicy.max_attempts`).

Ego tiene `maxSteps` (`ToolExecutionLoop`) y presupuesto por Sub-Ego (`SubEgoBudget`), pero **no**
tiene reloj de pared ni agregador de proceso. Para una app de escritorio que ejecuta trabajo en
segundo plano, el reloj de pared es crítico: un bucle de tool calls puede gastar 3 minutos y 40 000
tokens sin salirse nunca de `maxSteps`.

#### 5.2.4 Aprobación suspendida con estado persistido ####

Este es el mecanismo que más falta tiene Ego. El `ApprovalEngine` mantiene `PendingApproval` en
memoria; si el usuario cierra la app mientras una acción sensible espera permiso, **la decisión se
pierde**. CrewAI resuelve exactamente esto: `sqlite.py:65` — *"Flow is paused, state is already
persisted"*.

El diseño correcto en Ego tiene tres estados y una transición:

```text
run.state = running
  → tool requiere aprobación
  → checkpoint escribe { pendingApproval: {tool, argsDigest, expiresAt} }
  → run.state = suspended          (no bloquea hilos; el proceso puede morir)
  → el usuario aprueba (evento approval.granted)
  → run.state = running, se re-ejecuta SOLO el paso pendiente
  → si expiresAt pasa sin decisión → política explícita: expirar / degradar / re-preguntar
```

La expiración **debe tener política declarada**, no comportamiento implícito.(browser-use ofrece el
patrón de degradación; Temporal y Prefect ofrecen el de timeout explícito.)

#### 5.2.5 Degradación terminal con salida estructurada ####

`browser_use/agent/service.py:1583-1587` es el patrón mejor documentado del corpus para cerrar un
turno fallido:

> "You failed {max_failures} times. Therefore we terminate the agent. Your only tool available is the
> 'done' tool. No other tool is available… If the task is not yet fully finished as requested by the
> user, set success in 'done' to false!"

Es exactamente el contrato que mini-SWE-agent deja anotado en `MSWE-01` (taxonomía de salida
terminal tipada). Para Ego significa: un `BackgroundTask` que agota su presupuesto **no** se
corta; emite un desenlace terminal con `success=false`, `reason="budget_exhausted"` y el
razonamiento del intento, y queda auditable en `gov/audit`.

Complemento: browser-use detecta estancamiento antes de abandonar (`service.py:1471-1475`) e inyecta
un *nudge* de replanificación. Es un paso intermedio valioso: reintentar con otra estrategia antes
de rendirse.

---

## 6. Computer use y browser use ##

### 6.1 Tabla de proyectos ###

| Proyecto | Stars | Mecanismo | SO | Licencia | Veredicto Ego |
| --- | ---: | --- | --- | --- | --- |
| [browser-use](https://github.com/browser-use/browser-use) | 118 592 | DOM + screenshots + acciones Playwright/CDP | Windows, macOS, Linux | MIT | **ADAPTAR** (degradación, replan, límites) |
| [OpenAI CUA sample app](https://github.com/openai/openai-cua-sample-app) | 1 903 | El modelo **escribe código** en runtime persistente (JS+Playwright / Python+PyAutoGUI) | Windows, macOS, Linux (escritorio) | MIT | **PATRÓN** (bucle de código, runtime persistente) |
| [Claude quickstarts (computer-use-demo)](https://github.com/anthropics/anthropic-quickstarts) | 18 881 | Acciones de ratón/teclado por coordenadas sobre capturas | Linux (Docker + X11), macOS vía VM | MIT | **PATRÓN** (protocolo de tool); NO el bucle |
| [Microsoft UFO](https://github.com/microsoft/UFO) | 10 075 | UI Automation (AppAction / HostAgent) sobre Windows | **Windows** | MIT | **PATRÓN** (el más relevante para un desktop Windows) |
| [Microsoft OmniParser](https://github.com/microsoft/OmniParser) | 25 532 | Convierte captura en estructura de GUI interactiva | Agnóstico (demos Windows) | CC-BY-4.0 (repo) | **PATRÓN** (percepción estructurada > píxeles) |
| [Skyvern](https://github.com/Skyvern-AI/skyvern) | 23 232 | Playwright + VLM + extracción estructurada | Agnóstico | **AGPL-3.0** | PATRÓN; no portar código |
| [Stagehand](https://github.com/browserbase/stagehand) | 25 746 | Capa de IA sobre Playwright: `act` / `extract` / `observe` / `agent` | Agnóstico | MIT | **ADOPTAR** (capa `observe`/`extract` sobre CDP) |
| [midscene](https://github.com/web-infra-dev/midscene) | 15 322 | VLM para assertions y scripts sobre el DOM | Agnóstico | MIT | PATRÓN (verificación visual) |
| [Steel Browser](https://github.com/steel-dev/steel-browser) | 7 845 | Navegador headless en Rust con API HTTP | Agnóstico | Apache-2.0 | PATRÓN (navegador como servicio local, patrón de aíslar el browser) |
| [Lightpanda](https://github.com/lightpanda-io/browser) | 36 767 | Navegador headless sin JS, en Rust | Agnóstico | **AGPL-3.0** | PATRÓN marginal; no portar |
| [Playwright](https://github.com/microsoft/playwright) | 98 113 | Automatización de navegador con selectores accesibles | Agnóstico | Apache-2.0 | **ADOPTAR** como dependencia de tool |
| [Puppeteer](https://github.com/puppeteer/puppeteer) | 95 726 | Automatización de navegador sobre CDP | Agnóstico | Apache-2.0 | PATRÓN (CDP como protocolo) |
| [LaVague](https://github.com/lavague-ai/LaVague) | 6 392 | Mundo → objetivo → acción (World Model) | Agnóstico | Apache-2.0 | PATRÓN (declarar objetivo, no acción) |
| [OpenAdapt](https://github.com/OpenAdaptAI/OpenAdapt) | 1 784 | Grabación y replay de acciones de usuario | Windows, macOS | MIT | PATRÓN (replay determinista = base de un ledger) |
| [Scrapybara OSS](https://github.com/Scrapybara/scrapybara-oss) | 39 | SDK para instancias cloud de navegador | Agnóstico | Apache-2.0 | DESCARTAR (cloud) |
| `Scrapybara/scrapybara` | — | Producto cloud propietario | — | — | **No existe** como repo público (404) |
| `openai/cua-sample` | — | — | — | — | **No existe** (404) |
| `openai/openai-cua` | — | — | — | — | **No existe** (404) |

### 6.2 Lecturas de código (los tres hallazgos que cambian decisiones) ###

#### 6.2.1 El bucle de referencia de Anthropic NO tiene tope ####

`computer-use-demo/computer_use_demo/loop.py:118` abre `while True:` sin condición de salida por
contador, y `:125` delega el reintento al SDK del proveedor (`Anthropic(api_key=api_key,
max_retries=4)`). El demo añade tresicorp ortes que sí son transferred-friendly:

- `:216-220` — las llamadas a un mismo toolset se ejecutan **en orden y se detienen en el primer
  fallo**; las restantes responden `NOT_EXECUTED_ERROR` (definido en `:44`) **sin ejecutarse**.
- `:244` — `_maybe_filter_to_n_most_recent_images` **evicta** capturas antiguas para controlar el
  contexto, en lugar de truncarlas.
- `:316-339` — `_inject_prompt_caching` marca puntos de cache en los 3 turnos más recientes.

**Para Ego**: el patrón "un toolset falla → el resto no se ejecuta" es exactamente el comportamiento
deseable cuando una tool escribe en disco y la siguiente depende de ella. La ausencia de tope de
iteraciones es **el punto que Ego no debe copiar**: ya existe `maxSteps`, y debe añadirse el reloj
de pared (§5.2.3).

#### 6.2.2 OpenAI CUA: el modelo escribe código, no acciones ####

Del README de `openai/openai-cua-sample-app` (leído el 2026-10-20):

> "A persistent runtime keeps useful state and helper functions available between calls. The model can
> write a loop to fill several fields, check that each change took effect, and return only the text
> or screenshots it needs. This can reduce model round trips and repeated input context while giving
> the model feedback to correct mistakes."

Cuatro consecuencias para Ego:

1. **Menos round-trips**: un bucle escrito por el modelo en el runtime es una llamada, no diez.
   Esto reduce coste y latencia — el eje `DEC-08`/`DS-05` de Ego.
2. **Verificación en línea**: *"check that each change took effect"* es el patrón `gather → act →
   verify → repeat` que se repite en toda la literatura de computer-use.
3. **Verificación del resultado, no de la respuesta**: *"the answer alone does not prove success"*.
   Coincide con `MSWE-07` (gate de diff verificado antes de declarar cumplida la tarea).
4. **Aislamiento de red en el ejemplo**: el demo *"blocks service workers and page requests to other
   sites"*, y declara explícitamente que las ejecuciones *"do not control your desktop or open your
   personal browser session"*. Es el mismo criterio que la política SSRF de Ego
   (`packages/security/src/ssrfPolicy.ts`), pero aplicado al browser.

#### 6.2.3 browser-use: los tres límites que hay que copiar ####

De `browser_use/agent/service.py`:

| Parámetro | Línea | Valor | Para qué sirve |
| --- | --- | --- | --- |
| `max_failures` | `:173` | 5 | Cortar el bucle de fallos |
| `max_actions_per_step` | `:179` | 5 | Acotar acciones por llamada al modelo (coste y atomicidad) |
| `max_clickable_elements_length` | `:211` | 40 000 | Tope del DOM serializado que ve el modelo |

Además:

- `:1031-1032` — `if self.state.paused: raise InterruptedError`: la pausa es una **excepción
  controlada**, no un flag polled en cinco sitios.
- `:1236-1238` — el contador de fallos consecutivos sólo cuenta pasos de **una sola acción**: los
  pasos multi-acción se cuentan con detección de bucle en su lugar. Es una distinción fina
  que evita abortar prematuramente.
- `:1471-1475` — *nudge* de replanificación al alcanzar `planning_replan_on_stall`.
- `:1583-1587` — degradación terminal (§5.2.5).
- `:1668-1684` — reintento cuando el modelo devuelve una acción vacía, con un mensaje de
  corrección explícito.
- `:1978-1999` — fallback a un LLM alterno cuando el primario falla por *rate limit* o error de
  proveedor (401/402/429/5xx), con clasificación explícita de qué es reintentable.

### 6.3 Qué significa para el `ApprovalEngine` y la política de permisos ###

El computer-use **mueve el centro de riesgo**. En una tool de filesystem la unidad de riesgo es el
fichero; en computer-use la unidad de riesgo es **la acción**, y una acción es ambigua por
definición: "click en (842, 391)" no dice qué se va a pulsar.

Cuatro consecuencias concretas para `packages/execution/src/ApprovalEngine.ts` y
`packages/security/src/ToolPermissions.ts`:

1. **La aprobación debe ser sobre el efecto, no sobre la coordenada.** Un clic en una pantalla
   no es revisable por un humano: la tarjeta de aprobación debe mostrar *qué se espera que ocurra*
   (URL destino, título de ventana, texto del elemento, una captura). Los repos de referencia
   resuelven esto con **extracción estructurada previa** (Stagehand `extract`, LaVague "world
   model", OmniParser).
2. **Hacen falta niveles de granularidad de la aprobación.** Hoy Ego aprueba *tool + digest de
   argumentos*. Con computer-use harían falta al menos tres niveles:
   - *Sesión*: permitir todas las acciones de lectura en un dominio durante 15 minutos.
   - *Clase de acción*: permitir `click`/`type` pero no `download`/`delete`/`submit`.
   - **Punto único**: la acción concreta, que es la que hoy existe.
3. **La irreversibilidad debe derivar del objetivo, no de la tool.** Enviar un correo es
   irreversible aunque la tool sea "escribir texto en un campo". La regla debe ser: si la acción
   **cierra un flujo externo** (submit, send, publish, commit, delete), se exige aprobación aunque
   la tool base sea inocua. Es el mismo espíritu que el inspector de egreso de Goose
   (`GOOS-03`), que eleva a `requireApproval` al detectar exfiltración.
4. **El presupuesto debe incluir el coste de la observación.** Cada paso de computer-use consume
   una captura (tokens de visión) + DOM serializado. `max_clickable_elements_length` y
   `only_n_most_recent_images` son dos variantes del mismo control: **presupuesto de observación**,
   distinto del presupuesto de tokens de texto.

**Veredicto computer-use para Ego**:

| Nivel | Contenido | Fase | Decisión |
| --- | --- | --- | --- |
| **N0 — Control estructurado** | Tool de navegador sobre Playwright/CDP: `navigate`, `click(selector)`, `type`, `extract`, `screenshot`. Selectores semánticos, no coordenadas | **Fase 09 (Dominios)** o antes | **ADOPTAR** — riesgo acotado, selectores revisables, integrable con `ApprovalEngine` actual |
| **N1 — Percepción asistida** | Extracción estructurada (OmniParser/Stagehand) para que la aprobación muestre el elemento, no un píxel | P1 | **PATRÓN** |
| **N2 — Computer-use por coordenadas** | Bucle de acciones sobre capturas del escritorio completo | Fuera de P0 | **DESCARTAR en P0** — sin granularidad de aprobación, sin idempotencia, con coste de visión no acotado |

---

## 7. Asistentes locales ##

| Proyecto | Stars | Arquitectura | Qué tiene que Ego no tenga | Veredicto Ego |
| --- | ---: | --- | --- | --- |
| [Ollama](https://github.com/ollama/ollama) | 183 882 | Runtime de modelos locales (servicio HTTP + CLI) + cuantización | Descarga y gestión de modelos; **es un runtime, no un agente** | **ADOPTAR como adaptador de proveedor local** (ya previsto en `vision-general.md`) |
| [Open WebUI](https://github.com/open-webui/open-webui) | 156 230 | Chat web + RAG + herramientas + plugins | Interfaz de chat completa y **licencia con condiciones de marca** | PATRÓN (UX de chat); licencia restrictiva |
| [LobeHub](https://github.com/lobehub/lobe-chat) | 83 352 | Chat + plugins + agentes +Knowledge base | Ecosistema de "skills" descargables | PATRÓN (modelo de skills); licencia propia |
| [GPT4All](https://github.com/nomic-ai/gpt4all) | 77 353 | Runtime local CPU/GPU con cuantización | Optimización para CPU y ejecución offline | PATRÓN (offline) |
| [Open Interpreter](https://github.com/openinterpreter/openinterpreter) | 68 614 | LLM + **ejecución de código local** + modo experimental | Ejecución de código en el host con aprobación | PATRÓN de la *surface* de código; **riesgo**: ejecución sin sandbox |
| [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) | 67 343 | Desktop Electron + workspace + RAG por documento | Workspace de documentos con citas | PATRÓN (workspace por proyecto) |
| [Cherry Studio](https://github.com/CherryHQ/cherry-studio) | 52 780 | Chat multi-modelo + MCP + knowledge | Integración MCP de un clic y base de conocimiento | PATRÓN; **AGPL-3.0 → no portar** |
| [LibreChat](https://github.com/LibreChat-AI/LibreChat) | 46 041 | Chat multi-provider + agentes + plugins | Multi-provider en una UI, **agents con tarjetas de herramientas** | PATRÓN (paridad de providers) |
| [Jan](https://github.com/janhq/jan) | 45 019 | Chat local con motor de inferencia embebido | Motor local en proceso | PATRÓN; Apache-2.0 con cabecera no estándar (API: `NOASSERTION`) |
| [Reor](https://github.com/reorproject/reor) | 8 540 | Desktop Electron + memoria local + RAG semántico | **File-system-like** y vista de notas conectadas | PATRÓN (memoria desktop); **AGPL-3.0** |
| [Leon](https://github.com/leon-ai/leon) | 17 591 | Asistente de escritorio con skills por webhook | Skills declarativos por webhook | PATRÓN |

### 7.1 Qué falta realmente a Ego tras esta comparación ###

Ego cubre ya, según `docs/architecture/vision-general.md` y `AGENTS.md` §2: chat con streaming,
memoria local persistente, tool registry, aprobación, multi-modelo con router, Sub-Egos, MCP
client/server y workspace dinámico. El delta real que aporta el corpus de asistentes locales es
**estrecho y de UX**, no de arquitectura:

1. **Un concepto de "skill" descargable** (LobeHub, Leon, Cherry Studio) con descubrimiento,
   instalación y descriptor declarativo. Ego tiene `SubEgoManifest` y el catálogo de Sub-Egos, pero
   **no** tiene un canal de instalación ni un registro de skills de terceros. La idea está germinando,
   pero **no existe todavía ningún `agent-harness.lock.json` en la raíz del repo** (comprobado el
   2026-10-20): hay que crearlo, no basta con leerlo.
2. **Ejecución de código con aprobación explícita** (Open Interpreter). Es una superficie que Ego
   hoy **no tiene** y que la mayoría de estas herramientas sí. Es un hueco de capacidad, no un
   requisito del SOC: la tool `terminal_exec` de Ego cubre el caso con más control.
3. **Gestión de modelos locales como Citizen de primera clase** (Jan, GPT4All, Ollama). Ego lo
   trata como adaptador del `ModelRouter`, lo cual es correcto; lo que falta es el **catálogo
   descargable** y la estimación de coste local (cero marginal) frente a la del presupuesto actual.
4. **Citas verificables sobre documentos** (AnythingLLM, Reor). Ego tiene `packages/knowledge/` con
   RRF y grafos, pero no un contrato de "respuesta con evidencia" en la UI del chat.

**Conclusión**: ningún asistente local aporta un mecanismo de ejecución que Ego no tenga ya. Aportan
**UX y catálogos**. No hay ninguno que justifique una dependencia nueva.

---

## 8. Diseño de referencia: escalar el `BackgroundEngine` a tareas largas y durables ##

> **Propuesta de diseño.** No es una tarea del Backlog y no modifica ningún fichero del repo. El
> objetivo es dejar el contrato cerrado para que el owner decida.

### 8.1 Separación de tres entidades ###

Hoy Ego tiene `task`. La duración larga exige tres:

| Entidad | Qué es | Persistencia | Vida |
| --- | --- | --- | --- |
| `Task` | La **intención** ("indexar el repo y abrir 5 issues") | `task/<id>` | Días |
| `Run` | Un **intento** de ejecutar esa intención | `run/<taskId>/<runId>` | Horas o días |
| `Step` | Una **unidad atómica** con efecto propio | `run/<id>/steps/<n>` | Segundos |

El `Run` es el objeto que se suspende por aprobación, se reanuda, se reintenta y se audita. La
`Task` puede tener varios `Run` (reintento manual, cambio de plan).

### 8.2 Máquina de estados del run ###

```text
queued ──► running ──► completed
              │  ▲
              │  └── checkpoint + resume (desde el último step confirmado)
              ├──► suspended (approval pendiente, con TTL)
              ├──► failed (terminal: budget_exhausted | tool_error | model_error)
              └──► abandoned (TTL global vencido)
```

Invariantes:

- `suspended` **no** bloquea un hilo, un proceso ni un turno de UI. El proceso puede morir.
- `failed` y `abandoned` **no** son intercambiables: `failed` es un desenlace con razón; `abandoned`
  es una ausencia de decisión.
- Sólo `running` escribe checkpoints. `suspended` escribe **una vez**, al suspenderse.

### 8.3 Contrato de checkpoint ###

Cada checkpoint contiene, como mínimo:

| Campo | Para qué |
| --- | --- |
| `runId`, `stepIndex` | Identidad y orden |
| `stepKey` | Clave estable de la unidad de trabajo (`hash(op, args normalizados)`) |
| `durability` | `sync` \| `async` \| `exit` — decidido por el tipo de paso (§5.2.1) |
| `status` | `pending` \| `done` \| `failed` |
| `resultDigest` | Digest del resultado, para re-ejecutar sin repetir efectos |
| `budgetUsed` | `{ steps, costUsd, wallClockMs }` acumulado |
| `pendingApproval` | `{ tool, argsDigest, expiresAt, policy }` si quedó suspendida |
| `checkpointId` | Identidad propia; permite detectar `superseded` (patrón LangGraph) |

### 8.4 Idempotencia: dos claves, no una ###

```text
toolCallId  = identidad de la invocación  → deduplica reintentos de transporte
effectKey   = hash(operación, args, destino) → deduplica efectos externos
```

Reglas:

- El `ledger` se consulta **antes** de la ejecución material (`ToolExecutionLoop`).
- El `effectKey` se persiste **con el resultado**; la segunda ejecución con la misma `effectKey`
  devuelve el resultado guardado sin re-ejecutar.
- Si la misma `effectKey` llega con **args distintos**, es un conflicto: se rechaza y se audita
  (patrón Restate).
- Las tools con efecto externo **deben** declarar `effectKey`. Las de lectura no.

### 8.5 Presupuesto: tres ejes y tres niveles ###

```text
por paso:      steps ≤ N_step, cost ≤ C_step, wallClock ≤ W_step
por run:       steps ≤ N_run,  cost ≤ C_run,  wallClock ≤ W_run
por proceso:   coste acumulado y nº de llamadas agregados (MSWE-02)
```

Se comprueba **antes** de gastar. Al superar un eje:

1. Si el eje es de pasos o coste → **degradación terminal** (`success=false`,
   `reason="budget_exhausted"`), no corte (§5.2.5).
2. Si el eje es de reloj de pared → **cancelación cooperativa** + desenlace
   `reason="wall_clock_exceeded"`.
3. Antes de rendirse, si el detector de estancamiento salta → *nudge* de replan (§5.2.5).

### 8.6 Aprobación suspendida ###

```text
1. El motor detecta que la tool exige aprobación.
2. Motor escribe checkpoint con { pendingApproval, expiresAt }  ← ANTES de suspender
3. Motor emite approval.required y pone run.state = suspended.
4. El proceso puede morir. Al arrancar, el run se reencola y vuelve a suspended.
5. El usuario aprueba → evento approval.granted → run.state = running → se re-ejecuta
   SOLO el step pendiente (no el run completo).
6. Si expiresAt vence sin decisión → política declarada:
   - abort   (por defecto para acciones sensibles)
   - degrade (sustituir por una tool de solo lectura)
   - escalate (preguntar de nuevo con contexto)
```

**Regla dura**: el motor **no** re-ejecuta un step cuyo `effectKey` ya tiene resultado guardado.

### 8.7 Recuperación y reanudación en frío ###

Patrón DBOS (`_recovery.py:14-27`):

1. Al arrancar, leer los runs con `state ∈ {running, suspended}` y `lease` vencido.
2. **Reencolar** (no reejecutar). La entrega al runner es exactly-one.
3. El runner retoma desde el último checkpoint confirmado; el step en curso se re-ejecuta
   (semántica **at-least-once**), y la idempotencia del `effectKey` lo hace seguro.
4. Un `heartbeat` (patrón UFO) permite detectar procesos muertos sin esperar al TTL completo.

### 8.8 Trazabilidad ###

- `EgoEvent` numerado con `seq` por sesión y persistido en VantaDB (patrón OpenHands `OHND-01`),
  con cursor de reanudación que salta huecos.
- Un `traceId` por run y un `spanId` por step, exportables a OpenTelemetry en el futuro.
- Todo el desenlace terminal (éxito, fallo, abandono) se escribe en `gov/audit` con su razón.

### 8.9 Qué NO se hace ###

- **No** se introduce un motor de workflows externo (Temporal, Airflow, Conductor): contradice el
  guardrail de no backend obligatorio en P0 y el principio 9.
- **No** se introduce LangGraph ni Mastra en el núcleo (`AGENTS.md` §4): el modelo de `Durability`
  y `RetryPolicy` se **porta** a los contratos propios de Ego.
- **No** se introduce Docker ni microVM para aislar la ejecución: contradice `OHND-07` y el
  principio 9; Ego ya tiene `ResourcePolicy` + `PathValidator` + `TerminalCommandPolicy`.
- **No** se toca `packages/runtime/src/ToolExecutionLoop.ts` sin antes cerrar `MSWE-01`, `MSWE-02` y
  `MSWE-03`, porque el presupuesto y la degradación seinstrumentan **en** el loop.

---

## 9. Trade-offs y riesgos ##

| Riesgo | Evidencia | Impacto | Mitigación propuesta |
| --- | --- | --- | --- |
| **Coste de tokens no acotado por reloj** | LangGraph añade `TimeoutPolicy.run_timeout`; mini-SWE-agent añade `wall_time_limit_seconds` | Un turno puede gastar presupuesto de coste sin salirse de `maxSteps` | Presupuesto triple (§8.5) |
| **Re-ejecución de efectos externos** | Temporal usa `ActivityID`; Restate usa clave de idempotencia | Correos duplicados, commits duplicados, issues duplicadas | `effectKey` + ledger previo (`OHND-03`) |
| **Pérdida de aprobaciones al reiniciar** | CrewAI persiste el estado antes de pausar (`sqlite.py:65`) | Acciones sensibles se ejecutan sin permiso, o el usuario pierde la decisión | Checkpoint `sync` obligatorio antes de `suspended` |
| **Bucle de agente sin tope** | `anthropic-quickstarts/loop.py:118` (`while True:`) | Coste y latencia no acotados | `maxSteps` + reloj de pared ya parciales en Ego |
| **Copiado accidental de código copyleft** | AGPL en Skyvern, Cherry Studio, Reor, Lightpanda; SSPL en Inngest; Sustainable Use en n8n | Contaminación de licencia en un proyecto Apache-2.0 | Regla: de este corpus sólo se portan MIT/Apache-2.0 |
| **Dependencia cloud oculta** | Airflow, Temporal server, Conductor, n8n self-hosted multi-tenant, Scrapybara | Rompe el principio 9 y exige operación | Extraer patrón, no dependencia |
| **Ampliar superficie de ataque del navegador** | OpenAI CUA demo: *"blocks service workers and page requests to other sites"*; Ego ya tiene `ssrfPolicy` | Un agente con browser puede exfiltrar por red o leer datos de sesión | Aislamiento de red por tool + sesión de browser separada |
| **Computer-use sin granularidad de aprobación** | Las acciones por coordenada no son revisables | El usuario aprueba a ciegas → el principio 6 se vacía | Aprobar **efecto y contexto**, no coordenada; N2 fuera de P0 |
| **Presupuesto de observación no acotado** | `browser-use` limita el DOM a 40 000 chars y evicta capturas antiguas | Cada paso consume tokens de visión no previstos | Presupuesto de observación por step |
| **Degradación silenciosa** | browser-use corta herramientas y fuerza `done` con `success=false` | Si Ego degrada sin decirlo, el usuario cree que la tarea se completó | Todo desenlace terminal lleva `reason` explícito y se muestra en la UI |
| **Cola de prioridad sin justipación** | OpenCode serializa por clave con `steer`/`queue` | Interacciones del usuario se pierden tras trabajo en curso | Separar admisión (durable, idempotente) de entrega |
| **Duplicidad de checkpointers** | LangGraph, CrewAI, DBOS, Temporal tienen cuatro modelos distintos | Elegir mal obliga a reescribir | Fijar el modelo de `Durability` (§5.2.1) como contrato canónico |
| **Coste de ventanas de aprobación abiertas** | Los asistentes locales suelen dejar la aprobación en el chat | Una app de escritorio con aprobación por segundo plano necesita TTL | `pendingApproval.expiresAt` + política de expiración |

---

## 10. Recomendación para Ego ##

> Estas identificaciones son **propuestas de investigación**. No se han añadido al Backlog Maestro
> (`docs/roadmap/Backlog.md`) ni a ningún otro fichero del repo.

### 10.1 Resumen de decisiones ###

| Elemento | Decisión | Fundamento |
| --- | --- | --- |
| Motor de workflows externo | 🚫 **Descartar** | Guardrail de no backend en P0 + principio 9. Ningún motor del corpus cabe en un desktop local-first sin reescribirlo |
| Temporal | 📐 **Patrón** | `ActivityID` como clave de idempotencia; backoff por clase de fallo; retardo solicitado por el servidor |
| DBOS Transact | 📐 **Adaptar** | Recuperación por reencolado + exactly-one runner: el patrón más directamente portable al `BackgroundEngine` |
| LangGraph | 📐 **Adaptar** | Modelo `Durability` (sync/async/exit) y `RetryPolicy`/`TimeoutPolicy` como contratos |
| CrewAI Flows | 📐 **Adaptar** | Persistir estado **antes** de pausar por feedback humano |
| Trigger.dev | 📐 **Patrón** | Referencia de motor durable en TypeScript permisivo, sin dependencia |
| n8n | 📐 **Patrón** | `DataDeduplicationService` (check-and-record atómico); **descartar** su reintento de intervalo fijo |
| Dify / Langflow / ADK | 📐 **Patrón** | Nodos declarativos, patrón Parallel/Loop/Router, agent-as-tool |
| AutoGen GraphFlow | 📐 **Patrón** | Grafo dirigido explícito entre agentes (coherente con el Orchestration Bus de Ego) |
| Airflow / Prefect / Dagster / Kestra / DolphinScheduler / Flowable / Camunda / Maestro / Cadence / Conductor | 📐 **Patrón** | Backfill idempotente, timeout de reloj de pared, vocabulario BPMN |
| Inngest / Windmill / Skyvern / Cherry Studio / Reor / Lightpanda / Restate | 🚫 **Descartar** (licencia) | SSPL, AGPL-3.0, mixta o no estándar: no portables a Apache-2.0 |
| browser-use | 📐 **Adaptar** | `max_failures`, `max_actions_per_step`, tope de DOM, replan, degradación terminal |
| OpenAI CUA sample | 📐 **Patrón** | Runtime persistente + modelo que escribe código + verificación de efecto |
| Anthropic computer-use-demo | 📐 **Patrón** | Protocolo de tool, toolset stop-on-failure, evictor de capturas, prompt caching |
| Microsoft UFO | 📐 **Patrón** | `aip/resilience` (timeout + degradación suave + heartbeat) y UI Automation de Windows |
| OmniParser / Stagehand / midscene / LaVague | 📐 **Patrón** | Percepción estructurada para que la aprobación sea legible |
| Steel Browser / Lightpanda | 📐 **Patrón** | Navegador como servicio local aislable |
| Playwright / Puppeteer | ✅ **Adoptar** | Dependencia Apache-2.0/MIT para la tool de navegador de Ego |
| OpenAdapt | 📐 **Patrón** | Replay determinista de acciones: base natural de un ledger de efectos |
| Asistentes locales (Ollama, Jan, GPT4All, Leon, LobeHub, AnythingLLM, LibreChat, Reor, Cherry Studio) | 📐 **Patrón** | UX de chat, skills descargables, motor local. **Ninguno aporta un mecanismo de ejecución nuevo** |
| Computer-use por coordenadas | 🚫 **Descartar en P0** | Sin granularidad de aprobación, sin idempotencia, coste de visión no acotado |

### 10.2 Mapa a fases ###

| Fase | Propuesta | Depende de |
| --- | --- | --- |
| **Fase 02 (Acción)** | Presupuesto triple con reloj de pared; `Durability` por paso; `effectKey` + ledger previo a la ejecución material; clasificador definitivo/transitorio | `MSWE-01/02/03`, `OHND-03`, `OHND-06` |
| **Fase 02 (Acción)** | Persistir el estado del run **antes** de suspender por aprobación; `pendingApproval` con TTL y política de expiración | `OHND-04`, `GOOS-02` |
| **Fase 03 (Sub-Egos)** | Nodo de agente como citizen del motor: grafo dirigido entre Sub-Egos (patrón GraphFlow) sobre el Orchestration Bus | `vision-general.md` §Orchestration Bus |
| **Fase 07 (Tasks)** | Recovery por reencolado + exactly-one runner; lease/heartbeat de run vivo; `BackgroundEngine` con `Run`/`Step` | `TASK-01/03/09/10`, `OCDE-06` |
| **Fase 07 (Tasks)** | Desenlace terminal tipado con `reason`; degradación en vez de corte; nudge de replan ante estancamiento | `MSWE-01` |
| **Fase 07 (Tasks)** | Traza durable con `seq` + cursor de reanudación; `traceId`/`spanId` por run y step | `OHND-01` |
| **Fase 09 (Dominios)** | Tool de navegador sobre Playwright/CDP con selectores semánticos; verificación de efecto antes de continuar | `DOM-01`, `SEC-05` |
| **Fase 09 (Dominios)** | Percepción estructurada para que la tarjeta de aprobación muestre el elemento, no un píxel | `ACT-06`, `ACT-07` |
| **Fase 11 (Security)** | Aprobación por clase de acción (leer / escribir / cerrar flujo externo) e irreversible derivada del objetivo | `SEC-05`, `SEC-06` |
| **Fase 11 (Security)** | Aislamiento de red del browser por tool y por sesión | `SEC-05` (`ssrfPolicy`) |
| **Fuera de P0 / P1** | Computer-use por coordenadas; runtime de código persistente al estilo CUA; microVM/containers para aislamiento | `OHND-07`, principio 9 |

### 10.3 Lo que Ego **no** debería hacer ###

1. **No** construir un "n8n de agentes": Ego ya es un runtime cognitivo con Tool Registry; un
   constructor visual de workflows es un producto distinto y ya cubierto por Dify/Langflow/n8n.
2. **No** adoptar un motor de workflows externo "sólo por los reintentos": el coste de integración
   (servidor, base de datos, esquema de estado) supera con creces el beneficio de 20 líneas de
   backoff con jitter que Ego ya tiene.
3. **No** implementar el bucle `while True:` del demo de Anthropic: Ego tiene `maxSteps` y presupuesto
   de coste; lo que falta es el reloj de pared, no la ausencia de límites.
4. **No** portar código de AGPL, SSPL, Sustainable Use o licencias propietarias. El corpus aporta
   ideas, no ficheros.

---

## 11. Deuda abierta y preguntas para el owner ##

### 11.1 Deuda abierta (verificada durante esta investigación) ###

| ID | Deuda | Estado |
| --- | --- | --- |
| `AUTOM-DEUDA-01` | **No se encontró outbox/inbox transaccional** implementado de forma explícita y documentada en ninguno de los 21 motores revisados. Es patrón de integración con colas, no de ejecución local | Abierta |
| `AUTOM-DEUDA-02` | **No se encontraron sagas ni compensaciones** explícitas en el corpus. Para pasos con efecto externo no transaccional (correo, publicación, despliegue) no hay patrón de referencia | Abierta |
| `AUTOM-DEUDA-03` | **OpenTelemetry no está en el corpus** revisado. Los motores usan su propio log de eventos; no hay referencia copiada para el formato de span | Abierta |
| `AUTOM-DEUDA-04` | El repositorio **no existe**: `openai/cua-sample`, `openai/openai-cua`, `Scrapybara/scrapybara`, `pieces-app/pieces` (404 verificado) | Cerrada (documentado) |
| `AUTOM-DEUDA-05` | `FlowiseAI/Flowise` está **archivado** (último push 2026-08-13). Dejar de tratarlo como referencia viva | Cerrada (documentado) |
| `AUTOM-DEUDA-06` | El PDF de OpenAI (*A practical guide to building agents*) **no fue extraído**: sólo se verificó la URL y el resumen indexado. Cualquier cita literal exigiría extraerlo | Abierta |
| `AUTOM-DEUDA-07` | La licencia de **Jan** (Apache-2.0 con cabecera no estándar), **Open WebUI** (BSD-3 con cláusula de marca), **LobeHub** (LobeHub Community License) y **Dify** (Apache-2.0 modificado) no encaja en SPDX estándar (`NOASSERTION`): habría que auditar caso por caso cualquier uso. **Restate** es BSL-1.1 y queda clasificada como source-available | Abierta |
| `AUTOM-DEUDA-08` | No se ha medido el **coste real por paso** de computer-use (tokens de visión + DOM) en ningún repo del corpus; los límites son heurísticos | Abierta |

### 11.2 Preguntas para el owner ###

Estas decisiones cambian la arquitectura del `BackgroundEngine` y **no están declaradas** en el
Backlog ni en los ADRs. Se formularon con contexto, opciones y recomendación.

**Pregunta 1 — ¿Cuál es la semántica de entrega por defecto de un `Step` con efecto externo?**

- Contexto: hoy `ToolExecutionLoop` reintenta sin ledger (`OHND-03` pendiente). Con una `effectKey`,
  un step puede ser *at-most-once* (si falla, no se reintenta) o *at-least-once* (se reintenta y el
  ledger evita el doble efecto).
- Opciones: (a) *at-most-once* para efectos irreversibles, *at-least-once* para el resto
  **(Recomendado)** — coincide con el criterio de irreversibilidad de §6.3; (b) *at-least-once* para
  todo, con ledger — más resiliente, pero exige `effectKey` en todas las tools con efecto; (c)
  *at-most-once* para todo — la más segura, la que menos automatiza.
- Impacto: define si `packages/tools/src/ToolRegistry.ts` debe exigir `effectKey` por tool.

**Pregunta 2 — ¿Qué ocurre si el usuario no responde a una aprobación suspendida?**

- Contexto: Ego ejecutará trabajo en segundo plano. Si el run queda `suspended` con la app cerrada,
  hace falta una política de expiración.
- Opciones: (a) expirar y abortar el step **(Recomendado)** — por defecto seguro para acciones
  sensibles; (b) expirar y degradar a una tool de solo lectura; (c) expirar y re-preguntar en el
  próximo arranque, sin límite de intentos.
- Impacto: define el comportamiento por defecto de `pendingApproval.expiresAt` y la visible en la UI.

**Pregunta 3 — ¿El reloj de pared es un límite duro o una señal de aviso?**

- Contexto: `MSWE-02` ya dejó anotado el presupuesto de reloj de pared ausente. LangGraph lo trata
  como tope duro con cancelación cooperativa.
- Opciones: (a) tope duro con cancelación cooperativa y desenlace `wall_clock_exceeded`
  **(Recomendado)** — coherente con `TimeoutPolicy`; (b) aviso al modelo para que termine solo,
  sin cancelación; (c) configurable por Sub-Ego con valor por defecto duro.
- Impacto: `packages/runtime/src/ToolExecutionLoop.ts` y `packages/subegos/src/SubEgoBudget.ts`.

**Pregunta 4 — ¿Ego expone un agent-as-tool (un Sub-Ego invocable como tool) en Fase 03?**

- Contexto: ADK, CrewAI y AutoGen GraphFlow hacen del "agente como herramienta" el patrón dominante
  de orquestación multi-agente. El Orchestration Bus de Ego ya permite comunicación P2P entre
  Sub-Egos, pero no está expuesto al `ToolRegistry`.
- Opciones: (a) sí, como tool de primera clase con presupuesto y aprobación propios
  **(Recomendado)** — es el puente natural entre el motor y el grafo de agentes; (b) no: la
  delegación sigue siendo interna al Meta-Ego; (c) sólo entre Sub-Egos, no visible en el chat.
- Impacto: `packages/tools/src/ToolRegistry.ts` y `packages/subegos/src/DelegationRouter.ts`.

**Pregunta 5 — ¿Se admite control por coordenadas del escritorio en algún momento?**

- Contexto: §6.3 recomienda descartarlo en P0. Pero existe un mercado real (UFO, OmniParser,
  Anthropic CUA) y hay peticiones de uso del ordenador que un selector semántico no cubre (apps de
  escritorio, canales nativos de Windows).
- Opciones: (a) **no** en la hoja de ruta del SOC; sólo control estructurado de navegador y de apps
  vía API/MCP **(Recomendado)** — coherente con el principio 6 y con la ausencia de computer-use en
  las fases del roadmap; (b) sí, en Fase 09 como tool de escritorio con aprobación por efecto y
  captura; (c) sí, pero únicamente como adaptador externo (MCP), sin motor propio.
- Impacto: si se acepta (b) o (c), hay que abrir una ficha de seguridad específica (sandbox de
  escritorio, allowlist de ventanas, aislamiento de red).

**Pregunta 6 — ¿Se adoptan las skills descargables de terceros?**

- Contexto: LobeHub, Leon y Cherry Studio ofrecen instalación de skills declarativas; Ego tiene
  `SubEgoManifest` pero ningún canal de instalación. **No existe todavía un
  `agent-harness.lock.json` en la raíz del repo** (verificado el 2026-10-20): la idea está en el
  aire, no implementada.
- Opciones: (a) no en P0; las skills se crean dentro de Ego **(Recomendado)** — evita superficie de
  supply-chain en un producto local-first; (b) sí, con verificación de firma y lista de permisos
  visible; (c) sólo instalación manual por el usuario.
- Impacto: `packages/subegos/src/` y el modelo de permisos de Sub-Ego.

---

## 12. Fuentes ##

### 12.1 Artículos conceptuales ###

- Anthropic, [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
  — leído directamente el 2026-10-20.
- BAIR, [The Shift from Models to Compound AI Systems](https://bair.berkeley.edu/blog/2024/02/18/compound-ai-systems/)
  — leído directamente el 2026-10-20.
- OpenAI, [A practical guide to building agents](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)
  — URL verificada; PDF **no extraído**.
- OpenAI, [A practical guide to building AI agents (página)](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/)
  — accesible sólo con User-Agent de navegador (HTTP 403 sin él).
- Google, [Agent Development Kit](https://adk.dev/) y repositorios `google/adk-python`, `google/adk-js`.

### 12.2 Repositorios con lectura de código ###

| Repositorio | Ficheros leídos |
| --- | --- |
| `anthropics/anthropic-quickstarts` | `computer-use-demo/computer_use_demo/loop.py` |
| `browser-use/browser-use` | `browser_use/agent/service.py` |
| `n8n-io/n8n` | `packages/core/src/data-deduplication-service.ts`, `packages/core/src/execution-engine/workflow-execute.ts`, `LICENSE.md` |
| `langchain-ai/langgraph` | `libs/langgraph/langgraph/types.py`, `libs/langgraph/langgraph/pregel/_checkpoint.py`, `libs/langgraph/langgraph/pregel/_retry.py` |
| `dbos-inc/dbos-transact-py` | `dbos/_recovery.py` |
| `temporalio/temporal` | `common/util.go`, `common/backoff/retry.go`, `service/history/workflow/activity.go` |
| `openai/openai-cua-sample-app` | `README.md` |
| `microsoft/UFO` | `aip/resilience/timeout.py`, árbol de `ufo/` y `aip/` |
| `crewAIInc/crewAI` | `lib/crewai/src/crewai/flow/persistence/sqlite.py`, árbol de `lib/crewai/src/crewai/flow/` |
| `microsoft/autogen` | árbol de `autogen_agentchat/teams/_group_chat/_graph/` |
| `google/adk-python`, `google/adk-js` | metadatos del repositorio |
| `sst/opencode` (clonado en `repos-referencia/`) | `packages/core/src/session/inbox.ts` (líneas 155-202: `reconcile` y `admit`) |

### 12.3 Verificación de metadatos ###

Estrellas, licencia, lenguaje y último push se leyeron de `https://api.github.com/repos/<org>/<repo>`
y del JSON embebido en `https://github.com/<org>/<repo>` (`stargazerCount`, `licenseInfo`,
`stargazersPath`), el 2026-10-20. Las licencias con `NOASSERTION` se confirmaron leyendo el fichero
`LICENSE`/`LICENSE.md` del repositorio. La rama por defecto se resolvió del campo `defaultBranch` de
la misma página (n8n usa `master`, `camel-ai/camel` y `kyegomez/swarms` también; el resto `main` o
`dev`).

---

## 13. Trazabilidad con el resto del corpus ##

| Ficha relacionada | Patrón que esta investigación **confirma o completa** |
| --- | --- |
| `docs/extractions/opencode.md` (`OCDE-02`, `OCDE-03`, `OCDE-06`) | La admisión idempotente y el coordinador por clave son la base de un `BackgroundEngine` durable; se añade el modelo de `Durability` por paso (§5.2.1) |
| `docs/extractions/openhands.md` (`OHND-03`, `OHND-04`, `OHND-06`) | El ledger de idempotencia por `toolCallId` es la mitad del problema: falta la `effectKey` de negocio (§8.4) |
| `docs/extractions/mini-swe-agent.md` (`MSWE-01`, `MSWE-02`, `MSWE-03`) | El presupuesto triple y el desenlace terminal tipado son **el** contrato que la industria aplica con nombres distintos (§5.2.5) |
| `docs/extractions/goose.md` (`GOOS-02`, `GOOS-03`) | La persistencia de la decisión de permisos y el inspector de egreso son previos a cualquier computer-use (§6.3) |
| `docs/extractions/codex.md` | (pendiente de lectura cruzada) |

*Fin del informe. Material de referencia, no normativo. Ningún fichero de
implementación del repo fue modificado.*

---

## Verificación de datos (2026-10-20) ##

Auditoría independiente de este informe. Los 56 repositorios citados se
reconsultaron en `GET /repos/{owner}/{repo}` de la API REST de GitHub el
2026-10-20 y se compararon `stargazers_count`, `pushed_at`,
`license.spdx_id`, `language` y `archived`. Las licencias dudosas
(`NOASSERTION`) se resolvieron leyendo el fichero de licencia en
`raw.githubusercontent.com`. Las rutas internas de Ego se comprobaron contra el
árbol local; las de repositorios externos no clonados quedan como no
verificadas.

| Dato verificado | Valor declarado | Valor real | Fuente | Estado |
| --- | --- | --- | --- | --- |
| `temporalio/temporal` — estrellas, licencia, lenguaje | 23 844 · MIT · Go | 23 844 · MIT · Go | API | Correcto |
| `n8n-io/n8n` — estrellas | 208 093 | 208 095 | API `stargazers_count` | Corregido · unificado con `backoffice-empresa-personal.md` (208 093) y `plantillas-agentes-y-enjambres.md` (208 014) |
| `activepieces/activepieces` — estrellas, lenguaje | 25 126 · TypeScript | 25 126 · TypeScript | API | Correcto |
| `windmill-labs/windmill` — estrellas, licencia, lenguaje | 18 229 · Apache-2.0 + AGPLv3 + propietario · Rust | 18 229 · Apache-2.0 + AGPLv3 + propietaria · Rust | API + `LICENSE` | Correcto · unificado con `backoffice-empresa-personal.md` (que decía TypeScript/Go) |
| `node-red/node-red` — estrellas, licencia, lenguaje | 23 762 · Apache-2.0 · JavaScript | 23 762 · Apache-2.0 · JavaScript | API | Correcto |
| `kestra-io/kestra` — estrellas, licencia, lenguaje | 29 901 · Apache-2.0 · Java | 29 901 · Apache-2.0 · Java | API | Correcto |
| `apache/airflow` — estrellas | 47 222 | 47 223 | API `stargazers_count` | Corregido |
| `dagster-io/dagster` — estrellas, licencia, lenguaje | 16 297 · Apache-2.0 · Python | 16 297 · Apache-2.0 · Python | API | Correcto |
| `PrefectHQ/prefect` — estrellas, licencia, lenguaje | 24 043 · Apache-2.0 · Python | 24 043 · Apache-2.0 · Python | API | Correcto |
| `inngest/inngest` — estrellas, licencia, lenguaje | 5 964 · SSPL v1 + Apache-2.0 futuro · Go | 5 964 · SSPL-1.0 + Apache 2.0 Future · Go | API + `LICENSE.md` | Correcto · unificado con `backoffice-empresa-personal.md` (que decía TypeScript) |
| `triggerdotdev/trigger.dev` — estrellas, licencia, lenguaje | 16 584 · Apache-2.0 · TypeScript | 16 584 · Apache-2.0 · TypeScript | API | Correcto |
| `restatedev/restate` — licencia | No estándar (NOASSERTION) | BSL-1.1 (Business Source License 1.1) | `LICENSE` | Corregido |
| `hatchet-dev/hatchet` — estrellas, licencia, lenguaje | 8 148 · MIT · Go | 8 148 · MIT · Go | API | Correcto |
| `conductor-oss/conductor` — estrellas, licencia, lenguaje | 32 342 · Apache-2.0 · Java | 32 342 · Apache-2.0 · Java | API | Correcto |
| `apache/dolphinscheduler` — estrellas, licencia, lenguaje | 14 525 · Apache-2.0 · Java | 14 525 · Apache-2.0 · Java | API | Correcto |
| `dbos-inc/dbos-transact-ts` — estrellas, licencia, lenguaje | 1 406 · MIT · TypeScript | 1 406 · MIT · TypeScript | API | Correcto |
| `dbos-inc/dbos-transact-py` — estrellas, licencia, lenguaje | 1 639 · MIT · Python | 1 639 · MIT · Python | API | Correcto |
| `camunda/camunda` — estrellas, lenguaje | 4 326 · Java | 4 326 · Java; sin SPDX en la API | API | Correcto |
| `flowable/flowable-engine` — estrellas, licencia, lenguaje | 9 598 · Apache-2.0 · Java | 9 598 · Apache-2.0 · Java | API | Correcto |
| `Netflix/maestro` — estrellas, licencia, lenguaje | 3 845 · Apache-2.0 · Java | 3 845 · Apache-2.0 · Java | API | Correcto |
| `uber/cadence` — estrellas, licencia, lenguaje | 9 504 · Apache-2.0 · Go | 9 504 · Apache-2.0 · Go | API | Correcto |
| `langgenius/dify` — estrellas | 158 976 | 158 980 | API `stargazers_count` | Corregido · unificado con `plantillas-agentes-y-enjambres.md` (158 951) |
| `langflow-ai/langflow` — estrellas | 155 859 | 155 859 | API `stargazers_count` | Correcto · unificado con `plantillas-agentes-y-enjambres.md` (155 851) |
| `FlowiseAI/Flowise` — estrellas, estado | 55 512 · archivado, push 2026-08-13 | 55 512 · `archived: true`, push 2026-08-13 | API | Correcto |
| `crewAIInc/crewAI` — estrellas | 59 900 | 59 901 | API `stargazers_count` | Corregido · unificado con `orquestacion-multiagente.md` y `plantillas-agentes-y-enjambres.md` |
| `microsoft/autogen` — estrellas, licencia | 61 495 · CC-BY-4.0 (docs; código MIT) | 61 495 · CC-BY-4.0 en la raíz, MIT en `LICENSE-CODE` | API + `LICENSE-CODE` | Correcto · unificado con `plantillas-agentes-y-enjambres.md` (61 492) |
| `langchain-ai/langgraph` — estrellas, licencia, lenguaje | 43 554 · MIT · Python | 43 554 · MIT · Python | API | Correcto |
| `relevanceai/relevanceai` — estrellas, licencia, lenguaje | 284 · Apache-2.0 · Python | 284 · Apache-2.0 · Python | API | Correcto |
| `google/adk-python` — licencia | No detectada | Apache-2.0 | API `spdx_id` | Corregido |
| `google/adk-js` — licencia | No detectada | Apache-2.0 | API `spdx_id` | Corregido |
| `browser-use/browser-use` — estrellas | 118 589 | 118 592 | API `stargazers_count` | Corregido |
| `openai/openai-cua-sample-app` — estrellas, licencia | 1 903 · MIT | 1 903 · MIT | API | Correcto |
| `anthropics/anthropic-quickstarts` — estrellas | 18 877 | 18 881 | API `stargazers_count` | Corregido |
| `microsoft/UFO` — estrellas, licencia | 10 075 · MIT | 10 075 · MIT | API | Correcto |
| `microsoft/OmniParser` — estrellas, licencia | 25 532 · CC-BY-4.0 | 25 532 · CC-BY-4.0 | API | Correcto |
| `Skyvern-AI/skyvern` — estrellas, licencia | 23 232 · AGPL-3.0 | 23 232 · AGPL-3.0 | API | Correcto |
| `browserbase/stagehand` — estrellas, licencia | 25 746 · MIT | 25 746 · MIT | API | Correcto |
| `web-infra-dev/midscene` — estrellas | 15 329 | 15 322 | API `stargazers_count` | Corregido |
| `steel-dev/steel-browser` — estrellas, licencia | 7 845 · Apache-2.0 | 7 845 · Apache-2.0 | API | Correcto |
| `lightpanda-io/browser` — estrellas | 36 766 | 36 767 | API `stargazers_count` | Corregido |
| `microsoft/playwright` — estrellas | 98 124 | 98 113 | API `stargazers_count` | Corregido |
| `puppeteer/puppeteer` — estrellas | 95 728 | 95 726 | API `stargazers_count` | Corregido |
| `lavague-ai/LaVague` — estrellas, licencia | 6 392 · Apache-2.0 | 6 392 · Apache-2.0 | API | Correcto |
| `OpenAdaptAI/OpenAdapt` — estrellas, licencia | 1 784 · MIT | 1 784 · MIT | API | Correcto |
| `Scrapybara/scrapybara-oss` — estrellas, licencia | 39 · Apache-2.0 | 39 · Apache-2.0 | API | Correcto |
| `ollama/ollama` — estrellas | 183 907 | 183 882 | API `stargazers_count` | Corregido |
| `open-webui/open-webui` — estrellas, licencia | 156 230 · BSD-3 con marca | 156 230 · Open WebUI License (BSD-3 con cláusula de marca) | API + `LICENSE` | Correcto · unificado con `plantillas-agentes-y-enjambres.md` (156 214) |
| `lobehub/lobe-chat` — estrellas, licencia | 83 352 · licencia propia | 83 352 · LobeHub Community License | API + `LICENSE` | Correcto · `lobehub/lobehub` redirige a `lobehub/lobe-chat` |
| `nomic-ai/gpt4all` — estrellas, licencia | 77 353 · MIT | 77 353 · MIT | API | Correcto |
| `openinterpreter/openinterpreter` — estrellas | 68 613 | 68 614 | API `stargazers_count` | Corregido |
| `Mintplex-Labs/anything-llm` — estrellas, licencia | 67 343 · MIT | 67 343 · MIT | API | Correcto · unificado con `plantillas-agentes-y-enjambres.md` (67 330) |
| `CherryHQ/cherry-studio` — estrellas | 52 778 | 52 780 | API `stargazers_count` | Corregido · unificado con `plantillas-agentes-y-enjambres.md` (52 771) |
| `LibreChat-AI/LibreChat` — estrellas | 46 039 | 46 041 | API `stargazers_count` | Corregido · unificado con `plantillas-agentes-y-enjambres.md` (46 027) |
| `janhq/jan` — estrellas | 45 020 | 45 019 | API `stargazers_count` | Corregido |
| `janhq/jan` — licencia | licencia propia | Apache-2.0 con cabecera no estándar; la API devuelve `NOASSERTION` | `LICENSE` | Corregido |
| `reorproject/reor` — estrellas, licencia, estado | 8 540 · AGPL-3.0 | 8 540 · AGPL-3.0 · `archived: true` | API | Corregido |
| `leon-ai/leon` — estrellas, licencia | 17 591 · MIT | 17 591 · MIT | API | Correcto |
| `openai/cua-sample` — existencia | 404 | 404 | API + HTML | Correcto |
| `openai/openai-cua` — existencia | 404 | 404 | API + HTML | Correcto |
| `Scrapybara/scrapybara` — existencia | 404 | 404 | API + HTML | Correcto |
| `pieces-app/pieces` — existencia | 404 | 404 | API + HTML | Correcto |
| `packages/core/src/session/inbox.ts:155-202` (OpenCode) — admisión idempotente | `session/inbox.ts:155-202` | `packages/core/src/session/inbox.ts:155-202` (`reconcile` en 155, `admit` en 169) | clonado local | Corregido |
| `packages/tasks/src/TaskMemory.ts` y `packages/tasks/src/TaskCheckpoint.ts` | declarados | existen | árbol local | Correcto |
| `packages/runtime/src/ToolExecutionLoop.ts` | declarado | existe | árbol local | Correcto |
| `packages/execution/src/ApprovalEngine.ts` — `PendingApproval` en memoria | declarado | existe | árbol local | Correcto |
| `packages/execution/src/CircuitBreaker.ts` | declarado | existe | árbol local | Correcto |
| `packages/models/src/ModelRouter.ts` — backoff con jitter | declarado | existe (`backoffJitterRatio`, líneas 19-24 y 48-49) | árbol local | Correcto |
| `packages/tools/src/ToolRegistry.ts`, `packages/security/src/ssrfPolicy.ts`, `packages/subegos/src/SubEgoBudget.ts`, `packages/events/src/types.ts` | declarados | existen | árbol local | Correcto |
| `packages/dailystate/` | declarado | existe (`src/DailyStateEngine.ts`, `src/GoalPrioritizer.ts`, `src/DecisionsFeed.ts`) | árbol local | Correcto |
| IDs del Backlog y de las extracciones (`TASK-01/03/09/10`, `SUB-06`, `SUB-09`, `SEC-05`, `SEC-06`, `ACT-06`, `ACT-07`, `DOM-01`, `EGO-FIND-46`, `EGO-FIND-74`, `MSWE-01/02/03/07`, `OHND-01/03/04/06/07`, `GOOS-02/03`, `OCDE-02/03/06`) | declarados | todos presentes | `docs/roadmap/Backlog.md`, `docs/extractions/*.md` | Correcto |
| `agent-harness.lock.json` en la raíz del repo | "ya existe en la raíz" | **no existe** | búsqueda en todo el árbol del repo | Corregido |
| Rutas y líneas de repos externos (`n8n-io/n8n`, `temporalio/temporal`, `dbos-inc/dbos-transact-py`, `langchain-ai/langgraph`, `browser-use/browser-use`, `crewAIInc/crewAI`, `microsoft/UFO`, `openai/openai-cua-sample-app`, `anthropics/anthropic-quickstarts`, `microsoft/autogen`) | declaradas | no comprobables en local | repos no clonados | No verificado (2026-10-20) |
| PDF de OpenAI (*A practical guide to building agents*) | URL verificada, PDF no extraído | sin verificar | — | No verificado (2026-10-20) |
| Recuento de "21 motores revisados" (`AUTOM-DEUDA-01`) | 21 | 21 repositorios motores en §3.1 | recuento propio | Correcto |
| Listas de agentes de mercado y `discussion 741` de A2A | declaradas | sin fuente en la API | búsqueda web | No verificado (2026-10-20) |

Notas de la auditoría:

- Los cuatro repositorios inexistentes que el informe ya declaraba
  (`openai/cua-sample`, `openai/openai-cua`, `Scrapybara/scrapybara`,
  `pieces-app/pieces`) se reconfirman como 404. Ningún repositorio real resultó
  inexistente.
- La afirmación de que `agent-harness.lock.json` "ya existe en la raíz del repo"
  era falsa: no existe ningún fichero con ese nombre en el árbol. Se corrige
  en §7.1 y en §11.2.
- La licencia de Restate no es "no estándar": es **BSL-1.1**, una licencia
  source-available. Se reclasifica y se corrige `AUTOM-DEUDA-07`.
- `google/adk-python` y `google/adk-js` sí tienen SPDX: **Apache-2.0** en ambos.
- `windmill-labs/windmill` es Rust y `inngest/inngest` es Go: coincidían con
  este informe y contradecían a `backoffice-empresa-personal.md`. Se unifican.

**Recuento**: 72 cifras verificadas · 22 corregidas · 3 marcadas "no
verificado".
