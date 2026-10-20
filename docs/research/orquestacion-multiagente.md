# Orquestación multi-agente: estado del arte 2026 y veredicto para Ego #

| Campo | Valor |
| --- | --- |
| Estado | Research — material de referencia, no normativo |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Alcance | Frameworks, topologías y protocolos de orquestación |
| Fuentes | API de GitHub, lectura de código y búsqueda web |
| Licencias fuente | MIT y Apache-2.0 verificadas; sin copyleft fuerte |

> Nada de este documento es normativo. Lo que gobierna el producto son
> [`docs/jerarquia-canonica.md`](../jerarquia-canonica.md),
> [`principios-innegociables.md`](../product/principios-innegociables.md)
> y los ADRs de [`docs/adr/`](../adr/README.md).

## 1. Resumen ejecutivo (TL;DR) ##

1. Ego **ya tiene el grueso de la orquestación**: manifiesto, soul,
   memoria compartida con leases, worktrees, presupuesto por Sub-Ego,
   delegación con control de ciclos y profundidad, bus de eventos, HITL y
   checkpoints de tarea. Ningún framework externo aporta un mecanismo que
   Ego no tenga ya.
2. El hueco real son cuatro cosas: delegación durable y reanudable, capa
   declarativa de grafo de workflows, guardrails declarativos por Sub-Ego
   y un "Agent Card" interoperable del catálogo.
3. **No se adopta ninguna dependencia de orquestación.** Todos los
   frameworks relevantes son Python; Ego es TS-first y su runtime cognitivo
   es propio por decisión canónica (`AGENTS.md` §4 y
   [`docs/architecture/vision-general.md`](../architecture/vision-general.md)).
4. **Se adoptan patrones, no librerías**: `Send`, `Command` e `Interrupt`
   de LangGraph; handoffs de OpenAI; condiciones de terminación de
   AutoGen; `Edge` y checkpoint de Microsoft Agent Framework; `TaskChannel`
   de CAMEL; planificación de CrewAI; reflexión de Generative Agents;
   subagentes y contexto versionado de Letta Code; grafo YAML de ChatDev.
5. **Se descartan**: los frameworks completos como dependencia; los
   agentes autónomos de 2023 (AutoGPT, babyagi, SuperAGI, AgentVerse) por
   licencia o inactividad; y las topologías de debate, auction y society
   por falta de encaje con el producto objetivo: una sola persona, coste
   y latencia.
6. **Licencias**: ninguno de los más de veinte proyectos relevantes usa
   copyleft fuerte (AGPL, FSL, BUSL). Sí hay dos trampas: la plataforma de
   AutoGPT usa PolyForm Shield (source-available, no OSI) y `babyagi` no
   tiene fichero de licencia, luego no hay derecho de uso. El código de
   `microsoft/autogen` es MIT aunque la raíz del repo sea CC-BY-4.0.
7. **Interoperabilidad**: MCP es maduro y está en transición de MIT a
   Apache-2.0; A2A está en la Linux Foundation (más de 150 organizaciones y
   uso enterprise declarado desde abril de 2026; cifras **no verificado
   (2026-10-20)**, no hay API pública para confirmarlas); AGNTCY
   es un colectivo fragmentado. Ninguno reemplaza el `SubEgoManifest` de
   Ego: lo complementan.
8. **Señal de mercado**: el sector se ha movido de "framework de agentes"
   a "workflow declarativo más canvas más directorio". Eso es lo que Ego
   debe copiar: un grafo serializable, versionable y editable en el
   Canvas, no otro runtime.
9. **Tres capacidades concretas a incorporar**, detalladas en §9.4:
   delegación durable con checkpoint e idempotencia; capa declarativa de
   workflows con aristas condicionales; guardrails declarativos por
   Sub-Ego.
10. **Riesgo principal**: la sobreingeniería. Un grafo de workflows mal
    diseñado en Ego compite con su propio Canvas y con el Decision
    Router, y multiplica el coste por turno sin aportar control nuevo.
11. **Deuda abierta**: seis preguntas al owner en §10, la primera sobre si
    el producto quiere un canvas de workflows o solo un catálogo de
    Sub-Egos.

## 2. Metodología ##

### 2.1 Qué se buscó ###

Se buscó respuesta a cuatro preguntas concretas:

- Qué frameworks de orquestación multi-agente existen, cuáles siguen
  vivos y bajo qué licencia.
- Qué topologías de enjambre existen y con qué primitivas se implementan.
- Cómo se reparte rol, fase y autoridad en los sistemas de empresa de
  agentes, y qué es transferible al modelo de Sub-Ego.
- Cuál es el estado de la interoperabilidad entre agentes y de los
  mercados de agentes.

### 2.2 Criterios de inclusión ###

Un proyecto entra en el corpus si cumple al menos tres de estos cinco:

| Criterio | Definición operativa |
| --- | --- |
| Fama | 1 000+ estrellas o publicación en revista |
| Uso | push en los últimos 12 meses o uso real |
| Licencia | permisiva o copyleft analizable sin ambigüedad |
| Aplicabilidad | toca orquestación, no solo inferencia |
| Transferencia | mecanismo legible y portable a TypeScript |

La condición de actividad se aplicó con la fecha del último push
verificada por la API, nunca con la memoria del modelo.

### 2.3 Cómo se verificó ###

- **Cifras**: API REST de GitHub sobre `/repos/{owner}/{repo}` para
  estrellas, licencia SPDX, fecha de último push, lenguaje y descripción.
  Consulta del 2026-10-20. Cada cifra del documento sale de esa llamada.
- **Existencia**: los repositorios que la API devolvió 404 se declaran
  inexistentes; no se estiman. `microsoft/magentic-one` y
  `TinyLlama/TinyLlama` devuelven 404 y se marcan como no verificados.
  Ambos 404 se reconfirmaron en la auditoría del 2026-10-20 (§12).
- **Código**: lectura directa de ficheros en `raw.githubusercontent.com`
  para localizar el fichero y la línea donde vive cada mecanismo. Las
  rutas citadas son `ruta:línea` en el repositorio original.
- **Licencias**: lectura del fichero `LICENSE` de la raíz de cada repo,
  no solo el SPDX de la API, porque ambos discrepanen en casos como
  `microsoft/autogen` y el repo de la especificación de MCP.
- **Cualitativo**: búsqueda web para A2A, AGNTCY, registro de MCP y
  mercados de agentes, porque no hay API pública fiable para eso.

### 2.4 Límites declarados ###

- Sin shell en el entorno de ejecución, `markdownlint-cli2` no pudo invocarse
  en la redacción original: la verificación de formato se hizo por reglas y con
  `grep`. La auditoría del 2026-10-20 (§12) sí ejecutó el linter sobre los
  cuatro informes de `docs/research/` sin encontrar violaciones.
- Las estrellas miden fama, no uso real en producción.
- No se midió rendimiento: el estado del arte se leyó, no se midió.
- `docs/roadmap/Backlog.md` y `packages/*` se usaron como fuente de
  verdad para saber qué tiene Ego ya, y no proponer lo existente.

## 3. Estado del arte ##

### 3.1 Tabla maestra ###

Cifras verificadas por la API de GitHub el 2026-10-20. Abreviaturas:
`Py` Python, `TS` TypeScript, `JS` JavaScript, `NB` notebooks. La columna
de veredicto usa las cuatro salidas del protocolo: Referencia, Adoptar,
Descartar y Vigilar.

| Proyecto | Stars | Licencia | Último push | Lenguaje | Resuelve | Veredicto |
| --- | --- | --- | --- | --- | --- | --- |
| LangChain | 148111 | MIT | 2026-10-20 | Py | SDK de agentes | Referencia |
| AutoGPT | 187668 | MIT+Poly | 2026-10-20 | Py | Plataforma | Descartar |
| Claude Code | 152812 | Sin OSI | 2026-10-19 | TS | CLI agente | Solo leer |
| MetaGPT | 70932 | MIT | 2026-01-21 | Py | Empresa dev | Referencia |
| AutoGen | 61495 | MIT+CC | 2026-10-16 | Py | Teams | Referencia |
| CrewAI | 59901 | MIT | 2026-10-20 | Py | Roles y tareas | Referencia |
| Agno | 42832 | Apache | 2026-10-20 | Py | Equipos | Referencia |
| LangGraph | 43554 | MIT | 2026-10-19 | Py | Grafos de estado | Referencia |
| AgentScope | 33525 | Apache | 2026-10-20 | Py | SDK de agentes | Vigilar |
| ChatDev | 34556 | Apache | 2026-10-16 | Py | Workflows YAML | Adoptar |
| deepagents | 30438 | MIT | 2026-10-20 | Py | Harness | Solo leer |
| smolagents | 29937 | Apache | 2026-10-06 | Py | Código-agentes | Solo leer |
| Agents SDK | 30160 | MIT | 2026-10-20 | Py | Handoffs | Adoptar |
| A2A | 26219 | Apache | 2026-10-19 | Shell | Protocolo A2A | Vigilar |
| Letta | 25198 | Apache | 2026-10-18 | n/d | Memoria de agente | Referencia |
| Generative | 22253 | Apache | 2024-08-05 | n/d | Memoria | Adoptar |
| Swarm | 22064 | MIT | 2026-04-15 | Py | Handoffs | Vigilar |
| Google ADK | 21917 | Apache | 2026-10-20 | Py | Toolkit | Referencia |
| babyagi | 22356 | Sin lic. | 2026-01-31 | Py | Loop de tareas | Descartar |
| Pydantic AI | 20746 | MIT | 2026-10-20 | Py | Toolsets tipados | Referencia |
| SuperAGI | 17707 | MIT | 2025-01-22 | Py | Plataforma | Descartar |
| CAMEL | 17939 | Apache | 2026-10-19 | Py | Sociedad de agentes | Referencia |
| AgentFw | 14224 | MIT | 2026-10-19 | Py | Workflows con edges | Adoptar |
| Magentic-UI | 10097 | MIT | 2026-09-23 | Py | Agente con GUI | Solo leer |
| MCP spec | 9486 | MIT→Ap | 2026-10-20 | TS | Protocolo tools | Vigilar |
| Swarms | 7283 | Apache | 2026-10-20 | Py | Orquestación | Solo leer |
| CrewAI ex. | 6152 | Sin lic. | 2026-04-20 | NB | Plantillas | Referencia |
| AG2 | 5006 | Apache | 2026-10-20 | Py | Fork de AutoGen | Descartar |
| AgentVerse | 5158 | Apache | 2024-09-09 | JS | Simulación | Descartar |
| Agents SDK js | 3930 | MIT | 2026-10-19 | TS | Handoffs JS | Vigilar |
| Letta Code | 3 660 | Apache | 2026-10-20 | TS | Harness con memoria | Adoptar |
| Google ADK js | 1443 | Apache | 2026-10-20 | TS | Toolkit JS | Vigilar |

Notas de la tabla:

- `MIT+Poly`: MIT fuera de `autogpt_platform/` y PolyForm Shield dentro.
- `MIT+CC`: el código de AutoGen es MIT en `LICENSE-CODE`; la raíz del
  repo es CC-BY-4.0 para la documentación.
- `MIT→Ap`: transición declarada de MIT a Apache-2.0 en el repo de la
  especificación de MCP.
- `Sin lic.`: la API no detecta SPDX y no hay fichero de licencia en la raíz.
  Sin derecho de uso: solo lectura conceptual.
- `Sin OSI`: existe fichero de licencia, pero no es una licencia libre
  (`anthropics/claude-code` trae un `LICENSE.md` propio de Anthropic).
- `n/d`: la API no declara lenguaje principal para el repositorio (caso de
  `letta-ai/letta` y `joonspk-research/generative_agents`).
- `crewAIInc/crewAI-examples` está **archivado** (`archived: true`) desde su
  último push; se conserva sólo como referencia de plantillas.
- El bloque AGNTCY no es un repo único: `agntcy/oasf` 340, `agntcy/slim`
  229, `agntcy/dir` 199, `agntcy/acp-spec` 169 e `agntcy/identity` 107.
- `AgentFw` es `microsoft/agent-framework`; `Agent SDK` es el de OpenAI.
- `Generative` es `joonspk-research/generative_agents` y `CrewAI ex.` es
  `crewAIInc/crewAI-examples`. Ambos aparecen con nombre completo en las
  fichas de §3.2.

### 3.2 Fichas por proyecto ###

#### LangGraph ####

- Repo: `langchain-ai/langgraph`
- URL: <https://github.com/langchain-ai/langgraph>
- 43 554 estrellas, MIT, push 2026-10-19, Python.
- Grafo de estados explícito: los nodos leen y escriben un estado
  compartido por canales reducidos.
- Mecanismo clave: `Send` (fan-out dinámico map-reduce), `Command`
  (actualizar estado y a la vez enrutar), `Interrupt` (HITL por
  interrupción) y `recursion_limit` como corte duro de coste.
- Ficheros: `libs/langgraph/langgraph/types.py:738` (`Send`), `:833`
  (`Command`), `:584` (`Interrupt`); `graph/state.py:131` (`StateGraph`),
  `:376` (`add_node`), `:928` (`add_edge`), `:982`
  (`add_conditional_edges`), `:1177` (`compile`);
  `pregel/main.py:460` (`class Pregel`), `:2665` (`recursion_limit`);
  `pregel/_loop.py:650` (`tick`).
- Veredicto: la referencia más útil del corpus para diseñar la capa
  declarativa de §9.4, pero no se añade como dependencia.

#### LangChain ####

- Repo: `langchain-ai/langchain`
- URL: <https://github.com/langchain-ai/langchain>
- 148 111 estrellas, MIT, push 2026-10-20, Python.
- Capa de SDK e integraciones; el modelo de grafos vive en LangGraph.
- Veredicto: ya cubierto por `packages/models` (AI SDK v7 como
  adaptador). No aporta nada al runtime cognitivo.

#### AutoGen ####

- Repo: `microsoft/autogen`
- URL: <https://github.com/microsoft/autogen>
- 61 495 estrellas, código MIT, push 2026-10-16, Python.
- Aporta el vocabulario de topologías: `RoutedAgent` enruta por tipo de
  mensaje; `BaseGroupChatManager.select_speaker` decide quién habla;
  `Swarm` implementa handoff; `MagenticOneOrchestrator` mantiene un
  *task ledger* y re-planifica; `SocietyOfMindAgent` mete un equipo
  detrás de una interfaz de agente único.
- Ficheros: `autogen-core/src/autogen_core/_routed_agent.py:415`;
  `autogen-agentchat/teams/_group_chat/_base_group_chat.py:40` y `:74`
  (`max_turns` y `termination_condition`);
  `_base_group_chat_manager.py:306` (`select_speaker`);
  `_swarm_group_chat.py:15`;
  `_magentic_one/_magentic_one_orchestrator.py:58` y `:247`;
  `autogen_agentchat/agents/_society_of_mind_agent.py:159`.
- Veredicto: el catálogo de topologías más explícito del corpus. Se
  extraen las condiciones de terminación y el ledger; no se adopta el
  framework, porque Microsoft ya está migrando a Agent Framework.

#### AG2 ####

- Repo: `ag2ai/ag2`
- URL: <https://github.com/ag2ai/ag2>
- 5 006 estrellas, Apache-2.0, push 2026-10-20, Python.
- Fork comunitario de AutoGen, ahora "AgentOS".
- Veredicto: descartar. Duplica AutoGen con dos años de retraso y crea
  ruido de mantenimiento sin aportar un mecanismo propio.

#### Microsoft Agent Framework ####

- Repo: `microsoft/agent-framework`
- URL: <https://github.com/microsoft/agent-framework>
- 14 224 estrellas, MIT, push 2026-10-19, Python.
- Sucesor oficial de AutoGen y de Semantic Kernel. La unidad de
  orquestación es el *executor*: un grafo de ejecutores unidos por `Edge`,
  con condición opcional por arista, checkpoint propio y `max_iterations`
  por defecto.
- Ficheros: `python/packages/core/agent_framework/_workflows/_edge.py:76`
  (`class Edge`, condición por lambda); `_runner.py:44` (`RunnerImpl`),
  `:55` (`max_iterations: int = 100`), `:108` (`run_until_convergence`);
  `_checkpoint.py:35` (`WorkflowCheckpoint`) y `:148` (`load`);
  `_executor.py:36` (`class Executor`) y `:251` (`execute`).
- Veredicto: adoptar idea. El par *edge con condición más checkpoint por
  workflow* es exactamente lo que falta en el Orchestration Bus de Ego.

#### Google ADK ####

- Repo: `google/adk-python`
- URL: <https://github.com/google/adk-python>
- 21 917 estrellas, Apache-2.0, push 2026-10-20, Python.
- Toolkit de Google con jerarquía de agentes por composición: `sub_agents`
  y `parent_agent` forman un árbol, y la topología se expresa con clases
  (`SequentialAgent`, `ParallelAgent`, `LoopAgent`).
- Ficheros: `src/google/adk/agents/base_agent.py:134` (`BaseAgent`),
  `:176` (`parent_agent`), `:187` (`sub_agents`), `:528`
  (`find_agent`); `agents/llm_agent.py:270` (`LlmAgent`) y `:494`
  (`before_model_callback`); `agents/sequential_agent.py:96`;
  `agents/parallel_agent.py:176`; `agents/loop_agent.py:52`
  (`LoopAgentState`, con `max_iterations`).
- Veredicto: referencia. Su expresión de topología por composición de
  clases es la más limpia del corpus; sirve para nombrar y documentar las
  topologías de Ego, no para importar código.

#### OpenAI Agents SDK ####

- Repo: `openai/openai-agents-python`
- URL: <https://github.com/openai/openai-agents-python>
- 30 160 estrellas, MIT, push 2026-10-20, Python. Réplica JS: 3 930.
- El handoff es una *herramienta*: el agente receptor se declara como tool
  del emisor, con `HandoffInputData` tipado y `is_enabled` como predicado
  dinámico. Hay guardrails de entrada y de salida, y `Agent.as_tool`
  permite anidar agentes como herramientas.
- Ficheros: `src/agents/handoffs/__init__.py:229` (`def handoff`), `:71`
  (`HandoffInputData`), `:126` (`class Handoff`), `:192` (`is_enabled`);
  `src/agents/agent.py:319` (`class Agent`), `:373` y `:378`
  (guardrails), `:606` (`as_tool`); `src/agents/guardrail.py:72`;
  `src/agents/run.py:46` (`DEFAULT_MAX_TURNS`), `:281` (`run`).
- Veredicto: adoptar idea. El handoff como tool con predicado
  `is_enabled` resuelve un caso que Ego tiene: hoy la delegación siempre
  es explícita, y un handoff condicional es más barato y más natural.

#### OpenAI Swarm ####

- Repo: `openai/swarm`
- URL: <https://github.com/openai/swarm>
- 22 064 estrellas, MIT, push 2026-04-15, Python.
- Framework educativo de unas pocas centenas de líneas para expresar
  handoffs. El propio repo se describe como "educational" y su sucesor
  es el Agents SDK.
- Veredicto: vigilar. No se usa ni se cita como base; su valor es
  histórico, porque popularizó el patrón de handoff que hoy es
  estándar.

#### CrewAI ####

- Repo: `crewAIInc/crewAI`
- URL: <https://github.com/crewAIInc/crewAI>
- 59 901 estrellas, MIT, push 2026-10-20, Python.
- Modelo de roles y tareas: un `Crew` tiene `Agent` con rol y objetivo,
  `Task` con resultado esperado, y un `Process` que decide si la
  ejecución es `sequential` o `hierarchical`. En jerárquico, un
  `manager_agent` planifica, delega a los ejecutores y juzga el
  resultado.
- Ficheros: `lib/crewai/src/crewai/process.py:4` (`class Process`);
  `lib/crewai/src/crewai/crew.py:164` (`class Crew`), `:492`
  (`is_hierarchical`), `:497` (el manager es el agente ejecutor), `:1069`
  (`usage_metrics`), `:1135` (`kickoff_async`), `:1526`
  (`_run_hierarchical_process`).
- Veredicto: referencia. El modelo rol más tarea más process más
  manager es el pariente más cercano del modelo de Sub-Ego de Ego, y su
  planificación explícita es transferible.

#### Pydantic AI ####

- Repo: `pydantic/pydantic-ai`
- URL: <https://github.com/pydantic/pydantic-ai>
- 20 746 estrellas, MIT, push 2026-10-20, Python.
- Aporta el concepto de *toolset*: un contenedor de herramientas que se
  compone (combinado, filtrado, prefijado, diferido) y que puede exigir
  aprobación antes de ejecutarse. `AbstractToolset` define `get_tools` y
  `call_tool`.
- Ficheros: `pydantic_ai_slim/pydantic_ai/toolsets/abstract.py:85`
  (`AbstractToolset`), `:251` (`get_tools`), `:256` (`call_tool`);
  `toolsets/approval_required.py` (`ApprovalRequiredToolset`);
  `agent/__init__.py:494` (`class Agent`).
- Veredicto: referencia fuerte para `packages/tools`. La composición de
  toolsets encaja con el `ToolRegistry` de Ego y con `ApprovalEngine`.

#### smolagents ####

- Repo: `huggingface/smolagents`
- URL: <https://github.com/huggingface/smolagents>
- 29 937 estrellas, Apache-2.0, push 2026-10-06, Python.
- Dos primitivas relevantes: `managed_agents`, que permite a un agente
  invocar a otros agentes, y `planning_interval`, que obliga a
  re-planificar cada N pasos. `max_steps` (20 por defecto) corta el
  coste.
- Ficheros: `src/smolagents/agents.py:268` (`MultiStepAgent`), `:278`
  (`max_steps`), `:281` (`managed_agents`), `:283` (`planning_interval`),
  `:1215` (`ToolCallingAgent`), `:1505` (`CodeAgent`).
- Veredicto: solo leer. La re-planificación periódica es interesante,
  pero Ego ya tiene `LoopBreaker` y re-planificación en el Decision
  Router.

#### Agno ####

- Repo: `agno-agi/agno`
- URL: <https://github.com/agno-agi/agno>
- 42 832 estrellas, Apache-2.0, push 2026-10-20, Python.
- Un `Team` agrupa miembros con `mode`, `delegate_task_to_member` y
  `share_member_interactions`, que decide si los miembros comparten
  historial o lo mantienen aislado.
- Ficheros: `libs/agno/agno/team/team.py:83` (`class Team`), `:115`
  (`mode`), `:149` (`share_member_interactions`), `:863` (`run`).
- Veredicto: referencia. El interruptor "compartir interacciones o no"
  es la decisión de diseño que Ego ya resuelve con `SharedMemory` y el
  aislamiento `egos/<id>/*`; confirmarlo reduce ambigüedad.

#### CAMEL ####

- Repo: `camel-ai/camel`
- URL: <https://github.com/camel-ai/camel>
- 17 939 estrellas, Apache-2.0, push 2026-10-19, Python (rama `master`).
- La `Workforce` es un coordinador que reparte tareas a *workers* mediante
  un `TaskChannel`, con estado explícito (`WorkforceState`), pipeline de
  procesamiento, fallback de asignación y métricas propias.
- Ficheros: `camel/societies/workforce/workforce.py:176` (`class
  Workforce`), `:133` (`class WorkforceState`), `:2669`
  (`process_task_async`), `:2714` (`_process_task_with_pipeline`), `:3209`
  (`reset`), `:3907` (`_handle_task_assignment_fallbacks`);
  `camel/societies/workforce/task_channel.py:85` (`class TaskChannel`) y
  `:315` (`get_task_by_id`). En el mismo directorio: `worker.py`,
  `single_agent_worker.py`, `role_playing_worker.py`,
  `workflow_memory_manager.py` y `workforce_metrics.py`.
- Veredicto: referencia. El `TaskChannel` como cola con estado
  explícito y el fallback de asignación son dos patrones que faltan en
  el `DelegationRouter` de Ego.

#### AgentScope ####

- Repo: `agentscope-ai/agentscope`
- URL: <https://github.com/agentscope-ai/agentscope>
- 33 525 estrellas, Apache-2.0, push 2026-10-20, Python.
- Toolkit con `ReActAgent`, memoria con compresión y un adaptador A2A de
  cliente (`A2AAgent`) para invocar agentes remotos.
- Ficheros: `src/agentscope/agent/_agent.py:288` (`reply_stream`) y
  `:1135` (bucle de razonar y actuar);
  `src/agentscope/agent/_a2a_agent.py:189` (`class A2AAgent`).
- Veredicto: vigilar. Que un cliente A2A quepa en un SDK pequeño es el
  dato útil para §7.

#### MetaGPT ####

- Repo: `FoundationAgents/MetaGPT`
- URL: <https://github.com/FoundationAgents/MetaGPT>
- 70 932 estrellas, MIT, push 2026-01-21, Python. Antes `geekan/MetaGPT`.
- "Primera empresa de software con IA": un `Team` contrata `Role`s
  (Architect, ProjectManager, ProductManager, Engineer, QaEngineer,
  Searcher, Sales) que producen acciones tipadas (`WritePRD`, `WriteDesign`,
  `WriteTasks`, `WriteCode`, `WriteTest`, `WriteCodeReview`, `RunCode`).
- Ficheros: `metagpt/team.py:32` (`class Team`), `:83` (`hire`), `:102`
  (`run_project`); `metagpt/roles/role.py:82` (`RoleReactMode`), `:399`
  (`_observe`), `:454` (`_react`); `metagpt/roles/__init__.py` (roles y
  sub-paquete `di/`); `metagpt/actions/__init__.py` (acciones).
- Veredicto: referencia. Es el diseño más cercano a "Ego administra una
  empresa": roles tipados con acciones tipadas. Transferible: el patrón
  rol, acción tipada y artefacto, con intercambio estructurado en vez de
  prosa libre.

#### ChatDev ####

- Repo: `OpenBMB/ChatDev`
- URL: <https://github.com/OpenBMB/ChatDev>
- 34 556 estrellas, Apache-2.0, push 2026-10-16, Python.
- La 2.0 ("DevAll") ha pasado de empresa virtual a **plataforma no-code**:
  workflows en YAML, canvas visual, SDK de Python, `mcp_example` y
  memoria. La 1.0, con CEO, CTO y programador en fases de diseño, código
  y test, vive en la rama `chatdev1.0`.
- Ficheros: `workflow/graph.py:53` (`class GraphExecutor`), `:213`
  (`global_state`), `:490` (`max_parallel` por arista, con validación de
  consistencia entre aristas entrantes); `entity/graph_config.py:12`
  (`class GraphConfig`); `runtime/sdk.py` (`run_workflow` con `yaml_file`,
  `task_prompt`, `token_usage` y `WorkflowRunResult`).
- Veredicto: adoptar idea. El salto de "roles fijos" a "grafo
  declarativo editable" es la señal de mercado más relevante del
  corpus.

#### AgentVerse ####

- Repo: `OpenBMB/AgentVerse`
- URL: <https://github.com/OpenBMB/AgentVerse>
- 5 158 estrellas, Apache-2.0, push 2024-09-09, JavaScript.
- Simulación de sociedades de agentes para tareas y escenarios.
- Veredicto: descartar. Sin push desde 2024-09 y sin mecanismo
  transferible que no esté ya cubierto por MetaGPT o CAMEL.

#### Generative Agents ####

- Repo: `joonspk-research/generative_agents`
- URL: <https://github.com/joonspk-research/generative_agents>
- 22 253 estrellas, Apache-2.0, push 2024-08-05, lenguaje no declarado.
- Aporta el modelo de memoria con tres retrievers (biográfico, reflexivo
  y relevante), el trigger de reflexión por importancia acumulada y la
  generación de insights con evidencia, más un planificador diario.
- Ficheros: `reverie/backend_server/persona/cognitive_modules/retrieve.py:16`
  (`def retrieve`); `reflect.py:38`
  (`generate_insights_and_evidence`), `:135` (`reflection_trigger`),
  `:172` (`def reflect`); `plan.py:931` (`def plan`).
- Veredicto: adoptar idea. El trigger por importancia acumulada es más
  barato que la consolidación onírica por periodicidad y encaja con el
  `SelfImprovementLoop` de Ego.

#### Magentic-One ####

- Repo propio: **no existe**. `microsoft/magentic-one` devuelve 404 en
  la API el 2026-10-20; el orquestador vive dentro de `microsoft/autogen`,
  en `teams/_group_chat/_magentic_one/`.
- Mecanismo: un orquestador mantiene un *task ledger* con progreso,
  re-planifica y detecta estancamiento. El push del repo padre
  (2026-10-16) confirma que sigue vivo.
- Veredicto: referencia. El *task ledger* es un patrón transferible
  pequeño y de alto valor: convierte "el equipo no avanza" en una señal
  explícita en lugar de un silencio con gasto.

#### Swarms ####

- Repo: `kyegomez/swarms`
- URL: <https://github.com/kyegomez/swarms>
- 7 283 estrellas, Apache-2.0, push 2026-10-20, Python.
- Se define como "enterprise-grade multi-agent orchestration" con modos
  secuencial, concurrente y jerárquico sobre un mismo `Agent`.
- Veredicto: solo leer. El marketing está por encima del contenido, y
  los modos que ofrece ya están cubiertos por la composición de
  Sub-Egos de Ego.

#### Letta ####

- Repo: `letta-ai/letta`
- URL: <https://github.com/letta-ai/letta>
- 25 198 estrellas, Apache-2.0, push 2026-10-18. **Es el repo archivo**:
  su README indica que el código actual vive en `letta-ai/letta-code`.
- Repo activo: `letta-ai/letta-code`
- URL: <https://github.com/letta-ai/letta-code>
- 3 660 estrellas, Apache-2.0, push 2026-10-20, TypeScript sobre Bun.
- Mecanismos: subagentes integrados (general-purpose, *forked* y *recall*)
  con la regla de que un agente puede llamar a cualquier otro, incluso a
  sí mismo; contexto completo, incluidos los bloques de memoria,
  versionado en git (MemFS); sueño con `/sleeptime`, `/dream` y
  `/reflect`; más hooks, permisos y crons.
- Veredicto: adoptar idea. La combinación de contexto versionado en git,
  subagentes invocables y bloque de memoria editable es la más cercana al
  `SubEgoSoul` más `SubEgoWorktree` más `SelfImprovementLoop` de Ego.

#### SuperAGI ####

- Repo: `TransformerOptimus/SuperAGI`
- URL: <https://github.com/TransformerOptimus/SuperAGI>
- 17 707 estrellas, MIT, push 2025-01-22, Python.
- Plataforma dev-first de agentes autónomos; sin push desde enero de 2025.
- Veredicto: descartar. Inactivo, y su modelo de agente autónomo con
  toolbox ya está superado por el runtime de Ego.

#### babyagi ####

- Repo: `yoheinakajima/babyagi`
- URL: <https://github.com/yoheinakajima/babyagi>
- 22 356 estrellas, **sin fichero de licencia**: la API no detecta SPDX y
  `LICENSE` y `LICENSE.md` devuelven 404. Push 2026-01-31, Python.
- Veredicto: descartar. Sin licencia no hay derecho de uso, y el patrón
  de loop de tareas sobre un vector ya está cubierto por `TaskMemory` y
  `BackgroundEngine`.

#### AutoGPT ####

- Repo: `Significant-Gravitas/AutoGPT`
- URL: <https://github.com/Significant-Gravitas/AutoGPT>
- 187 668 estrellas, push 2026-10-20, Python. Licencia mixta verificada
  en la raíz: MIT fuera de `autogpt_platform/` y **PolyForm Shield**
  dentro, que es source-available y no es una licencia OSI.
- Veredicto: descartar como fuente de código por la licencia mixta. El
  historial sí es informativo: fue el primer agente autónomo de éxito
  popular y hoy es una plataforma con interfaz, y ningún framework
  moderno hereda su arquitectura de loop libre.

#### Claude Code ####

- Repo: `anthropics/claude-code`
- URL: <https://github.com/anthropics/claude-code>
- 152 812 estrellas, `LICENSE.md` propio de Anthropic (© Anthropic PBC,
  sujeto a sus términos comerciales, sin licencia OSI), push 2026-10-19,
  TypeScript.
- No es un framework de orquestación sino un *harness* de agente con
  subagentes; sirve de referencia de industria para el modelo de
  permisos por herramienta.
- Veredicto: solo leer. No se cita su código, porque no hay licencia
  libre verificable, ni se usa como patrón normativo.

#### Magentic-UI ####

- Repo: `microsoft/magentic-ui`
- URL: <https://github.com/microsoft/magentic-ui>
- 10 097 estrellas, MIT, push 2026-09-23, Python.
- "MagenticLite": agente experimental que opera sobre el navegador y el
  sistema de ficheros local.
- Veredicto: solo leer. Interesa por la combinación de agente con
  interfaz local, que es el territorio de Ego, pero no aporta
  primitivas de orquestación.

#### MCP, A2A y AGNTCY ####

- MCP: `modelcontextprotocol/modelcontextprotocol`
- URL: <https://github.com/modelcontextprotocol/modelcontextprotocol>
- 9 486 estrellas, push 2026-10-20, TypeScript. La licencia de la raíz
  declara una transición: MIT a Apache-2.0 para código y especificación
  nuevos; documentación bajo CC-BY-4.0.
- A2A: `a2aproject/A2A`
- URL: <https://github.com/a2aproject/A2A>
- 26 219 estrellas, Apache-2.0, push 2026-10-19. En la Linux Foundation
  desde junio de 2025; en abril de 2026 superaba 150 organizaciones con
  uso enterprise declarado.
- AGNTCY: sin repo único. `agntcy/oasf` (esquema de capacidades),
  `agntcy/slim` (mensajería), `agntcy/dir` (descubrimiento),
  `agntcy/acp-spec` (interconexión) e `agntcy/identity` (identidad y
  verificación). El directorio de agentes circula como draft IETF
  (`draft-mp-agntcy-ads-02`).
- Veredicto: ver §7.

## 4. Topologías de enjambre ##

| Topología | Implementación | Primitivas | Para Ego | Patrón a extraer |
| --- | --- | --- | --- | --- |
| Supervisor | Coordina y reparte | speaker | Sí | Ledger de plan |
| Handoff | Tool con is_enabled | handoff | Sí | Handoff condicional |
| Jerárquico | Manager delega | roles | Por dominio | Manager |
| Red | Turnos rotatorios | max_turns | Con límites | Fin explícito |
| Pipeline | Secuencia | edges | Base | Pipeline declarativo |
| Paralelo | Ramas | Send, fanout | Sí | Límite por arista |
| Debate | Turnos enfrentados | rondas | No | Ninguno |
| Auction | Mercado de tareas | ofertas | No | Ninguno |
| Society | Equipo como agente | router | No | Ninguno |

Notas:

- **Supervisor**: la forma natural de Ego. AutoGen la implementa con
  `BaseGroupChatManager.select_speaker`
  (`_base_group_chat_manager.py:306`) y Magentic-One la refuerza con un
  *task ledger* (`_magentic_one_orchestrator.py:58`). El `DelegationRouter`
  de Ego ya es un supervisor jerárquico con `maxDepth`, control de ciclos
  y concurrencia de tres.
- **Handoff**: OpenAI lo resuelve como tool (`handoffs/__init__.py:229`)
  con predicado `is_enabled` (`:192`); AutoGen lo resuelve con
  `HandoffMessage` en `_swarm_group_chat.py:15`. Ego tiene delegación
  explícita; le falta el handoff condicional.
- **Jerárquico**: CrewAI (`process.py:4`, `crew.py:1526`) y MetaGPT
  (`team.py:83`) son los dos referentes. Es la topología que describe el
  producto objetivo de Ego: una persona que dirige especialistas.
- **Red**: AutoGen aporta `max_turns` y `termination_condition`
  (`_base_group_chat.py:74` y `:73`). Es crítico: sin condición de
  terminación explícita, un grupo de agentes es un multiplicador de
  coste.
- **Pipeline**: Google ADK (`sequential_agent.py:96`) y ChatDev 2.0
  (`graph.py:53`) lo expresan. Es la base natural del Canvas de Ego.
- **Paralelo**: LangGraph con `Send` (`types.py:738`), ADK con
  `ParallelAgent` (`parallel_agent.py:176`) y ChatDev con `max_parallel`
  por arista (`graph.py:490`). El límite de concurrencia por arista es el
  detalle que evita el desbordamiento al presupuesto.
- **Debate**: útil en investigación y en evaluación; en un producto de
  escritorio con coste por turno multiplica el gasto sin beneficio
  observable. No se propone.
- **Auction**: el modelo de precios de Ego es por turnos y por Sub-Ego
  (`SubEgoBudget.ts`), no por mercado. Descartar.
- **Society**: `SocietyOfMindAgent` de AutoGen
  (`_society_of_mind_agent.py:159`) es elegante, pero oculta el coste y
  la responsabilidad detrás de una interfaz de agente único, lo que
  choca con la trazabilidad inmutable de `gov/audit`. Descartar por ahora.

## 5. Mecanismos transversales ##

| Mecanismo | Implementaciones | Patrón transferible | Veredicto |
| --- | --- | --- | --- |
| Memoria compartida | Ego, CAMEL, Letta | Namespaces y leases | Ya existe |
| Autoridad | Ego, OpenAI, Pydantic | Guardrails por agente | Falta |
| Presupuesto | CrewAI, Ego, LangGraph | Tope por cadena | Parcial |
| Trazas | OpenAI, AG2, Ego | Span por turno | Parcial |
| Cancelación | AgentFw, Ego | Abort propagado | Ya existe |
| Reintentos | AgentFw, CrewAI | Reintento con causa | Ya existe |
| Idempotencia | AgentFw, CrewAI | Clave por tool call | Falta |
| Checkpoints | AgentFw, LangGraph | Estado reanudable | Parcial |
| Subagentes | Letta, ADK, smolagents | Auto-invocación acotada | Parcial |
| Aislamiento | CrewAI, ADK | Sandbox por agente | Parcial |
| Handoff con estado | OpenAI, AutoGen | Contexto transferido | Falta |

Detalle de los más valiosos.

### 5.1 Guardrails declarativos por agente ###

OpenAI separa guardrail de entrada y de salida, con ejecución en paralelo
al turno (`src/agents/guardrail.py:72`, `agent.py:373` y `:378`).
Pydantic AI hace lo propio en el otro extremo de la pila: el toolset
`ApprovalRequiredToolset` exige aprobación antes de exponer una
herramienta. Ego tiene `ApprovalEngine`
(`packages/execution/src/ApprovalEngine.ts`) y `TrustBoundary`
(`packages/runtime/src/TrustBoundary.ts`), pero la granularidad es de
*herramienta*, no de *agente*: hoy no se puede declarar que un Sub-Ego
nunca escriba fuera de su worktree en el manifiesto.

Propuesta: campo `guardrails` en `SubEgoManifest`, evaluado por el
`ApprovalEngine` antes de cada tool call, con degradación explícita a
aprobación humana si la política no puede verificarse.

### 5.2 Presupuesto por cadena de delegación ###

`SubEgoBudget.ts` ya calcula coste por tokens con precios por millón
(`MODEL_PRICING_PER_MILLION`, línea 72) y corta por Sub-Ego. LangGraph
ofrece el patrón complementario: `recursion_limit` como tope duro de
iteraciones (`pregel/main.py:2665`), con mensaje explícito al alcanzarlo
(`:3096`). CrewAI añade `usage_metrics` agregado por crew
(`crew.py:1069`). Lo que falta en Ego es el agregado: una cadena
padre, hijo y nieto puede multiplicar el presupuesto sin que ningún
Sub-Ego individual lo note.

### 5.3 Checkpoint reanudable de una delegación ###

Microsoft Agent Framework persiste el workflow completo
(`_checkpoint.py:35`, con `load` en `:148`) y lo reanuda con
`run_until_convergence` (`_runner.py:108`). Letta versiona el contexto en
git, de modo que deshacer es un revert. Ego tiene `TaskCheckpoint.ts` para
tareas en background, pero una delegación entre Sub-Egos no deja rastro
reanudable: `DelegationRouter.ts` no contiene `checkpoint`, `resume`,
`idempot` ni `AbortSignal`, verificado por grep sobre el fichero. Si la
aplicación cae a mitad de una cadena, el trabajo intermedio se pierde
aunque la tarea padre tenga checkpoint.

### 5.4 Ledger de progreso ###

Magentic-One mantiene un *task ledger* con el plan, los hechos obtenidos
y el estado de cada paso, y re-planifica cuando detecta estancamiento
(`_magentic_one_orchestrator.py:58` y `:247`). Es un mecanismo pequeño y
barato: un registro en `gov/audit` con el plan vigente y el último hecho
que lo desbloquea. Convierte "el equipo no avanza" en un evento
observable en lugar de un silencio con gasto.

### 5.5 Aislamiento de la ejecución de un agente ###

CrewAI y ADK ejecutan el trabajo de un agente en un entorno separado del
orquestador. Ego aísla el sistema de ficheros con worktrees
(`SubEgoWorktree.ts`) y el proceso con `sandbox=true` de Electron, pero
no aísla el *proceso* de un Sub-Ego respecto de otro: todos comparten el
proceso principal de Node. Para el caso de uso objetivo es aceptable;
para código no confiable, no.

## 6. Sistemas de empresa de agentes ##

### 6.1 Cómo se reparten rol, fase y autoridad ###

| Sistema | Reparto de roles | Fases | Autoridad |
| --- | --- | --- | --- |
| MetaGPT | 7 roles de empresa | SOP por rol | Rol ejecutor |
| ChatDev 1.0 | CEO, CTO, dev | Diseño, código, test | Chat de fase |
| CrewAI | Agente libre | Por task | Manager o plana |
| CAMEL | Workers | Pipeline | Coordinator |
| Generative Agents | Uno por persona | Día | Nadie |
| AgentVerse | Agentes libres | Escenario | Nadie |
| Ego | Sub-Ego por dominio | Eventos | Ego y HITL |

Observaciones:

- **MetaGPT** es el diseño más maduro de empresa: cada rol tiene un rol
  fijo, un contexto propio y produce acciones tipadas (`WritePRD`,
  `WriteDesign`, `WriteTasks`, `WriteCode`, `WriteTest`,
  `WriteCodeReview`). La autoridad es implícita: cada rol ejecuta lo que
  su SOP marca y publica el resultado.
- **ChatDev 1.0** repartía la autoridad por fase: la fase de diseño habla
  con la de codificación mediante un mensaje y un conjunto de archivos.
  La versión 2.0 sustituye la conversación por un grafo declarativo en
  YAML (`workflow/graph.py:53`).
- **CrewAI** hace explícita la autoridad: en `Process.hierarchical` el
  `manager_agent` planifica, delega y juzga (`crew.py:497` y `:1526`); en
  `sequential` la autoridad es plana y ordenada.
- **CAMEL** centraliza en un `TaskChannel` (`task_channel.py:85`) y un
  `WorkforceState` explícito (`workforce.py:133`). Es el diseño más
  parecido a un bus con bandeja.
- **Generative Agents** no tiene autoridad: la memoria y el plan son el
  estado, y la reflexión es el mecanismo de mejora.

### 6.2 Qué es transferible al modelo de Sub-Ego ###

- **Rol con acciones tipadas** (MetaGPT): el `SubEgoManifest` ya declara
  `responsibilities` y `capabilities`; el salto siguiente es declarar
  *acciones*, es decir, tipos de tarea que el Sub-Ego sabe ejecutar, y no
  solo texto. Es barato y evita ambigüedad al delegar.
- **Fase explícita** (ChatDev, CAMEL): los eventos canónicos de Ego
  (`task.created`, `task.started`, `task.completed`, `task.failed`) forman
  ya una máquina de fases; falta hacer explícita la *fase compartida*
  entre varios Sub-Egos que colaboran en un mismo objetivo.
- **Canal de tareas con estado** (CAMEL): una bandeja de tareas con
  estado explícito y consulta por identificador, en lugar de una
  delegación que se resuelve solo en memoria.
- **Planificador con presupuesto** (CrewAI): un plan por objetivo con
  reparto de presupuesto, en lugar de decidir turno a turno.
- **Memoria por rol con reflexión** (Generative Agents): el trigger por
  importancia acumulada como alternativa más barata al sueño periódico.

### 6.3 Qué NO es transferible ###

- **SOPs fijas por rol** (MetaGPT): el principio 4 de Ego es explícito
  en que los Sub-Egos son dinámicos; un catálogo fijo de roles de
  software contradice `docs/product/principios-innegociables.md`.
- **Conversación como protocolo** (ChatDev 1.0): el intercambio en prosa
  libre no es auditable ni gobernable; Ego tiene bus de eventos tipado.
- **Espejo de los harnesses** (Claude Code, Magentic-UI, Letta Code): son
  agentes únicos, o equipos que el usuario guía. El producto objetivo de
  Ego es el inverso: una persona que dirige una organización de agentes,
  con el usuario como único interlocutor.
- **Plataformas con nube obligatoria** (AutoGPT, SuperAGI, AgentVerse):
  violan el principio 9 (local-first) y el modelo de negocio por
  suscripción de servicios.

## 7. Interoperabilidad ##

### 7.1 MCP en contexto multi-agente ###

MCP es el estándar maduro: 9 486 estrellas en el repo de especificación,
con transición de licencia declarada de MIT a Apache-2.0 para las
contribuciones nuevas. Su lugar en la orquestación es indirecto: MCP
estandariza *herramientas y recursos*, no la relación entre agentes. El
repo de referencia está en `docs/engineering/integraciones.md` con tres
niveles: first-party, MCP y genérico.

Lo que aporta a la orquestación es un mecanismo uniforme por el que un
Sub-Ego expone capacidades a otro proceso, y otro por el que Ego publica
su memoria y su estado como recursos consultables.

Veredicto: **adoptar y extender**. El `SubEgoManifest` ya es, de hecho,
un Agent Card: `id`, `name`, `role`, `capabilities`, `tools`,
`permissions`, `memoryScope` y `autonomy`. Publicarlo como recurso MCP
(`ego.sub_egos/<id>`) es trabajo pequeño y de alto valor, y el servidor
MCP de Ego está además identificado como deuda abierta
(`EGO-FIND-46`).

### 7.2 A2A (Agent2Agent) ###

A2A es el protocolo de comunicación entre aplicaciones de agente opacas.
26 219 estrellas, Apache-2.0, gobernado por la Linux Foundation desde
junio de 2025 y con más de 150 organizaciones y uso enterprise declarado
en abril de 2026 (**no verificado (2026-10-20)**: sin fuente en la API de
GitHub, la cifra procede de la búsqueda web). Define Agent Cards con la
descripción de capacidades,
mensajes y artefactos, y un ciclo de vida de tareas por JSON-RPC.

Veredicto: **vigilar, no adoptar todavía**. Motivos: (a) MCP cubre el
caso de uso real de Ego, porque el usuario tiene un solo interlocutor y
los Sub-Egos son internos, no servicios remotos; (b) A2A resuelve
interoperabilidad *entre proveedores*, que no es el problema de Ego; (c)
mantener un segundo protocolo es caro frente al beneficio. La señal a
vigilar es que `agentscope` ya expone un cliente A2A de unas 660 líneas
(`_a2a_agent.py`; **no verificado (2026-10-20)**, repo no clonado
localmente), señal de que la integración será barata si llega el
momento.

### 7.3 AGNTCY ###

AGNTCY es un colectivo, liderado por Cisco y Outshift entre otros, con
piezas separadas: esquema de capacidades (OASF), mensajería segura y de
baja latencia (SLIM), descubrimiento y anuncio (DIR), especificación de
interconexión (ACP) e identidad. El directorio de agentes circula como
draft IETF (`draft-mp-agntcy-ads-02`; **no verificado (2026-10-20)**, sin
fuente en la API de GitHub).

Veredicto: **descartar por ahora**. Su punto de partida es la
infraestructura cloud de una malla de agentes. Ego es local-first y
mono-usuario: el problema que AGNTCY resuelve no es el de Ego.

### 7.4 Mercados de agentes ###

El panorama de 2026 está fragmentado: los tres mayores son `mcp.so`,
Smithery y PulseMCP, cada uno con su propio proceso de alta, ranking y
curación; existe un registro oficial de MCP en
`registry.modelcontextprotocol.io`; y hay directorios nuevos que indexan
a la vez agentes, servidores MCP y skills. En A2A, el Agent Registry es
una discusión abierta (a2aproject/A2A, discussion 741). Todas estas
referencias son **no verificado (2026-10-20)**: no hay API pública fiable
para confirmarlas.

Veredicto: **el mercado no está maduro**. Para Ego la consecuencia
práctica es doble: (a) no hay un canal de distribución de Sub-Egos que
respalar todavía, así que el modelo de negocio no debe depender de un
marketplace de agentes; (b) sí conviene un *directorio local* de
Sub-Egos y skills que el usuario controle, que es exactamente lo que
`SubEgoRegistry` ya es.

## 8. Trade-offs y riesgos ##

### 8.1 Sobreingeniería ###

El riesgo mayor. Ego ya tiene 16 módulos de runtime cognitivo
documentados en `docs/architecture/vision-general.md`. Añadir un motor de
grafos completo, al estilo de `StateGraph`, implica un segundo modelo de
control paralelo al Decision Router y al Orchestration Bus. Regla
propuesta: el grafo declarativo debe ser una *proyección* del
Orchestration Bus, donde los nodos son Sub-Egos reales y las aristas son
transiciones permitidas, y no un segundo planificador que compita con el
primero.

### 8.2 Coste ###

Cada topología multiplica turnos. En el corpus, los controles de coste
son siempre por Sub-Ego y por iteración (`max_steps` de 20, `max_turns`,
`max_iterations` de 100, `recursion_limit`), pero ninguno agrega por
cadena de delegación. Para un producto cuyo usuario es una persona con
un presupuesto de AI Wallet, el agregado por cadena es obligatorio.

### 8.3 Observabilidad ###

Con varios agentes, el problema deja de ser "qué modelo respondió" y pasa
a ser "quién decidió, con qué estado y a qué coste". El corpus lo
resuelve con *spans* por turno (tracing de OpenAI) o con un ledger por
objetivo (Magentic-One). Ego tiene `StructuredLogger` y `gov/audit`, pero
el identificador de correlación aún no está cableado al bus, deuda
`EGO-FIND-74`: sin eso, la traza de una cadena de delegación no es
reconstruible.

### 8.4 Determinismo ###

La selección de agente y el plan son decisiones de LLM: no hay
determinismo. Los frameworks que lo prometen lo suplen con reglas
deterministas, que es justo lo que hace el `DecisionCascade` de Ego con
regex, modelo especializado y LLM. Regla: el *grafo* debe ser
determinista y versionado; la *decisión de qué nodo sigue* puede ser
heurística, pero siempre con la arista registrada en la traza.

### 8.5 Lock-in y cumplimiento de licencias ###

Los frameworks relevantes son MIT o Apache-2.0: no hay copyleft fuerte.
Los riesgos reales son (a) la plataforma de AutoGPT con PolyForm Shield,
source-available; (b) `babyagi` sin licencia; (c) el modelo de negocio de
varios (AutoGPT, SuperAGI, AgentVerse), que es nube más suscripción y
Ego no puede replicarlo por el principio 9; y (d) la dependencia de un
framework obligaría a Python en un producto TS-first.

### 8.6 Productos ya maduros que no se deben reconstruir ###

`TaskCheckpoint`, `TaskCancellation`, `ResourceScheduler`,
`ProactivityEngine`, `DreamConsolidator`, `SubEgoBudget`,
`SubEgoMemoryGuard`, `SharedMemory`, `SubEgoWorktree`, `DelegationRouter`
con control de ciclos y profundidad, `ApprovalEngine`, `TrustBoundary` y
`LoopBreaker`. Cualquier propuesta de este informe que toque esos
módulos debe ser una *extensión*, no un reemplazo.

## 9. Recomendación para Ego ##

### 9.1 Qué adoptar ###

| Patrón | Origen | Dónde vive | Por qué |
| --- | --- | --- | --- |
| Handoff condicional | OpenAI SDK | `packages/subegos` | Handoff barato |
| Condición de fin | AutoGen | `packages/runtime` | Corta el gasto |
| Ledger de progreso | Magentic-One | `packages/events` | Muestra el bloqueo |
| Edge con condición | AgentFw | `packages/runtime` | Base del grafo |
| Canal de tareas | CAMEL | `packages/subegos` | Cola con estado |
| Reflexión por peso | Gen. Agents | `packages/tasks` | Alternativa barata |
| Acciones tipadas | MetaGPT | `packages/subegos` | Sin ambigüedad |
| Canvas de workflows | ChatDev 2.0 | `apps/desktop` | Señal de mercado |
| Contexto versionado | Letta Code | `packages/subegos` | Historial de soul |
| Toolset componible | Pydantic AI | `packages/tools` | Encaja con registry |

### 9.2 Qué adaptar ###

- **Grafo declarativo de workflows**: nodos igual a Sub-Egos del registro,
  aristas igual a transiciones permitidas con condición opcional, estado
  compartido versionado en VantaDB. Se serializa como objeto versionado y
  se edita en el Canvas. No es un planificador: es una *declaración de
  qué Sub-Ego puede seguir a cuál*.
- **Handoff condicional**: un `DelegationRequest` puede declarar la
  condición bajo la cual se cede el turno al Sub-Ego receptor, en vez de
  que la cesión sea siempre explícita.
- **Ledger de progreso**: registro en `gov/audit` con plan vigente,
  hechos y último desbloqueo, alimentado por los eventos canónicos.
- **Presupuesto agregado**: `SubEgoBudget` suma el gasto de la cadena,
  padre más descendientes, y expone el total por objetivo.
- **Guardrails de Sub-Ego**: campo `guardrails` en el manifiesto,
  evaluado por `ApprovalEngine` y `TrustBoundary`.
- **Agent Card**: el `SubEgoManifest` se publica como recurso MCP
  (`ego.sub_egos/<id>`) y, más adelante, como Agent Card de A2A.

### 9.3 Qué descartar ###

- **Adoptar un framework de orquestación como dependencia**: contradice
  `AGENTS.md` §4 (runtime propio) y §1 (TypeScript-first).
- **AutoGen y Agent Framework**: contexto de diseño útil, dependencia
  prohibida.
- **AG2, AgentVerse, SuperAGI, babyagi y AutoGPT**: duplicados, inactivos
  o con licencia incompatible.
- **Topologías de debate, auction y society-of-agents**: sin encaje con
  el producto objetivo, y con coste alto o trazabilidad rota.
- **A2A y AGNTCY como requisitos de producto**: son problemas de
  interoperabilidad entre proveedores que Ego no tiene todavía.
- **El loop libre tipo AutoGPT**: sin presupuesto, sin HITL y sin
  determinismo; incompatible con el principio 6.

### 9.4 Capacidades concretas a incorporar ###

Mapa por paquete y por fase del roadmap, según
[`docs/roadmap/Backlog.md`](../roadmap/Backlog.md).

| Capacidad | Paquete | Fase | Nota |
| --- | --- | --- | --- |
| Delegación durable | `packages/subegos` | 10 | Checkpoint por delegación |
| Idempotencia de tools | `packages/tools` | 11 | Clave por tool call |
| Grafo declarativo | `packages/runtime` | 04 | Proyección del bus |
| Canvas de workflows | `apps/desktop` | 04 | Editor de grafo |
| Handoff condicional | `packages/subegos` | 03 | Extensión de SUB-06 |
| Ledger de progreso | `packages/events` | 07 | Nuevo evento canónico |
| Presupuesto por cadena | `packages/subegos` | 07 | Extensión de SUB-09 |
| Guardrails de Sub-Ego | `packages/execution` | 11 | Campo en manifiesto |
| Agent Card MCP | `packages/integrations` | 12 | Publicar manifiesto |
| Directorio local | `packages/subegos` | 09 | Catálogo por dominio |

Detalle de las tres primeras, que son las de mayor retorno.

**1. Delegación durable, reanudable e idempotente**
(`packages/subegos/src/DelegationRouter.ts` y
`packages/tasks/src/TaskCheckpoint.ts`). Hoy `DelegationRouter` no persiste
el estado de una delegación en vuelo: el grep de `checkpoint`, `resume`,
`idempot` y `AbortSignal` sobre el fichero da cero coincidencias.
Al abrir una delegación se escribe un registro con `delegationId`,
`callChain`, `depth`, entrada y presupuesto restante; el resultado se
sella con un hash y se guarda en `gov/delegations`; reintentar la misma
`delegationId` devuelve el resultado sellado en vez de re-ejecutar. Se
apoya en el evento `task.checkpoint` que ya existe en
`packages/events/src/types.ts`. Impacto: una cadena que se corta a
mitad no pierde el trabajo hecho. Fase 10 (Recovery) como fase natural,
con la idempotencia en fase 11 (Security).

**2. Capa declarativa de workflows** (nuevo módulo en
`packages/runtime`, junto a `ToolExecutionLoop.ts`, y resolución de nodos
en `packages/subegos`). Un `EgoWorkflow` es un objeto serializable: lista
de nodos, donde cada nodo referencia un `subEgoId` del registro, y lista
de aristas, con origen, destino y condición opcional. Al compilarse, un
nodo se expande en el `DelegationRouter` existente; no hay motor nuevo. Se
persiste en VantaDB versionado y se edita en el Canvas de la fase 04,
reutilizando el `CanvasComponentRegistry` dinámico que ya existe.
Condiciones de terminación explícitas por arista, inspiradas en
`termination_condition` de AutoGen y `max_iterations` de Agent Framework.
Beneficio: el usuario puede ver y editar el flujo de su empresa, no solo
delegar por chat.

**3. Guardrails declarativos por Sub-Ego**
(`packages/subegos/src/SubEgoManifest.ts`,
`packages/execution/src/ApprovalEngine.ts` y
`packages/runtime/src/TrustBoundary.ts`). Nuevo campo `guardrails` en el
manifiesto: lista de restricciones verificadas antes de cada tool call
del Sub-Ego, por ejemplo solo escribir dentro de su worktree, nunca
emitir red, o exigir siempre aprobación. El `ApprovalEngine` las evalúa
junto con la política de la tool; si una guardrail no puede verificarse,
la acción degrada a aprobación humana en lugar de ejecutarse. Beneficio:
convierte el principio 6 de gobernanza, hoy global, en una política por
especialista, que es lo que pide el producto objetivo de administrar una
empresa.

### 9.5 Orden de ejecución sugerido ###

1. Fases 03 y 07: handoff condicional y ledger de progreso. Costo bajo,
   valor alto, sin tocar el bus de eventos.
2. Fases 10 y 11: delegación durable e idempotencia. Revierte el riesgo
   de pérdida de trabajo y prepara la fiabilidad de la Ola 2.
3. Fase 04: grafo declarativo y canvas de workflows. Es la pieza cara, y
   solo tras tener delegación durable, porque el grafo multiplica
   encadenados.
4. Fases 11 y 12: guardrails por Sub-Ego y publicación como Agent Card.

## 10. Deuda abierta y preguntas para el owner ##

1. **Canvas de workflows, ¿sí o no?** El corpus de 2026 converge en
   workflow declarativo más canvas. ¿Entra eso en el producto de Ego, o
   el catálogo de Sub-Egos y el Canvas de componentes actual bastan? La
   respuesta cambia el tamaño de la fase 04.
2. **¿Presupuesto por Sub-Ego, por cadena o por proyecto?** Hoy existe
   por Sub-Ego (`SUB-09`). El agregado por cadena es lo que impide la
   multiplicación silenciosa de coste.
3. **¿Se publica el `SubEgoManifest` como Agent Card?** Requiere decidir
   el transporte MCP, stdio o socket local, que es exactamente la
   decisión pendiente de `EGO-FIND-46`.
4. **¿Se invierte en A2A?** Hoy no aporta al caso de uso, pero es el
   estándar que otros productos usarán para interoperar con Ego.
5. **¿Mercado de Sub-Egos y skills?** El mercado está fragmentado y sin
   formato estable. ¿Ego distribuye un catálogo desde Ego Cloud o solo un
   directorio local? Afecta al modelo de negocio de nivel 8.
6. **Límite de profundidad de anidación.** `DelegationRouter` tiene
   `maxDepth` y `DEFAULT_MAX_SPAWN_DEPTH` igual a 0. Si un Sub-Ego puede
   invocar a otro Sub-Ego, como en Letta Code, ¿el owner quiere abrir ese
   grifo? Afecta a coste, trazabilidad y política de permisos.

## 11. Trazabilidad de la evidencia ##

- Cifras de repositorio: API REST de GitHub, consulta del 2026-10-20.
- Mecanismos con ruta y línea: lectura directa del código fuente en
  `raw.githubusercontent.com` el 2026-10-20.
- Interoperabilidad: búsqueda web con fuentes de la Linux Foundation
  para A2A, `agntcy.org` y `docs.agntcy.org` para AGNTCY, y el registro
  oficial de MCP.
- Estado de Ego: `docs/roadmap/Backlog.md`, `packages/subegos/src`,
  `packages/runtime/src`, `packages/decision/src`, `packages/events/src`,
  `packages/execution/src`, `packages/tasks/src` y
  `docs/architecture/vision-general.md`.
- Licencias: lectura directa de los ficheros `LICENSE` de la raíz de cada
  repo; las discrepancias con el SPDX de la API quedan anotadas en §3.1.
- Auditoría de verificación de cifras, rutas y licencias: §12.

## Verificación de datos (2026-10-20) ##

Auditoría independiente de este informe: cada dato de §3.1 se reconsultó en
`GET /repos/{owner}/{repo}` de la API REST de GitHub el 2026-10-20 y se
comparó con `stargazers_count`, `pushed_at`, `license.spdx_id`, `language` y
`archived`. Las licencias dudosas (`NOASSERTION`) se resolvieron leyendo el
fichero `LICENSE`/`LICENSE.md` en `raw.githubusercontent.com`. Los repositorios
que devolvieron 404 se confirman como inexistentes; no se sustituye ninguna
cifra por una estimación.

| Dato verificado | Valor declarado | Valor real | Fuente | Estado |
| --- | --- | --- | --- | --- |
| `langchain-ai/langchain` — estrellas | 148 111 | 148 111 | API `stargazers_count` | Correcto |
| `Significant-Gravitas/AutoGPT` — estrellas | 187 667 | 187 668 | API `stargazers_count` | Corregido |
| `Significant-Gravitas/AutoGPT` — licencia | MIT + PolyForm Shield | `NOASSERTION`; `LICENSE` mixto real: MIT fuera de `autogpt_platform/`, PolyForm Shield dentro | `LICENSE` | Correcto |
| `anthropics/claude-code` — estrellas | 152 804 | 152 812 | API `stargazers_count` | Corregido |
| `anthropics/claude-code` — licencia | Sin licencia | Sin SPDX; sí existe `LICENSE.md` propio (© Anthropic PBC, términos comerciales), no es OSI | `LICENSE.md` | Corregido |
| `FoundationAgents/MetaGPT` — estrellas | 70 932 | 70 932 | API `stargazers_count` | Correcto |
| `microsoft/autogen` — estrellas | 61 495 | 61 495 | API `stargazers_count` | Correcto |
| `microsoft/autogen` — licencia | MIT + CC | API `CC-BY-4.0`; `LICENSE-CODE` es MIT y `LICENSE` de la raíz es CC-BY-4.0 | `LICENSE`, `LICENSE-CODE` | Correcto |
| `crewAIInc/crewAI` — estrellas | 59 900 | 59 901 | API `stargazers_count` | Corregido · unificado con `plantillas-agentes-y-enjambres.md` y `automatizacion-y-agentes-ejecucion.md` |
| `agno-agi/agno` — último push | 2026-10-19 | 2026-10-20 | API `pushed_at` | Corregido |
| `langchain-ai/langgraph` — estrellas | 43 554 | 43 554 | API `stargazers_count` | Correcto |
| `agentscope-ai/agentscope` — estrellas | 33 523 | 33 525 | API `stargazers_count` | Corregido |
| `OpenBMB/ChatDev` — estrellas | 34 555 | 34 556 | API `stargazers_count` | Corregido |
| `langchain-ai/deepagents` — estrellas | 30 438 | 30 438 | API `stargazers_count` | Correcto |
| `huggingface/smolagents` — estrellas | 29 937 | 29 937 | API `stargazers_count` | Correcto |
| `openai/openai-agents-python` — estrellas | 30 160 | 30 160 | API `stargazers_count` | Correcto |
| `a2aproject/A2A` — estrellas | 26 217 | 26 219 | API `stargazers_count` | Corregido · unificado con `plantillas-agentes-y-enjambres.md` (26 218) |
| `letta-ai/letta` — estrellas | 25 198 | 25 198 | API `stargazers_count` | Correcto |
| `joonspk-research/generative_agents` — estrellas | 22 253 | 22 253 | API `stargazers_count` | Correcto |
| `openai/swarm` — estrellas | 22 064 | 22 064 | API `stargazers_count` | Correcto |
| `google/adk-python` — estrellas | 21 917 | 21 917 | API `stargazers_count` | Correcto |
| `yoheinakajima/babyagi` — licencia | Sin licencia | Sin SPDX y sin fichero `LICENSE` ni `LICENSE.md` (404) | API + `raw` | Correcto |
| `pydantic/pydantic-ai` — estrellas | 20 746 | 20 746 | API `stargazers_count` | Correcto |
| `TransformerOptimus/SuperAGI` — estrellas | 17 707 | 17 707 | API `stargazers_count` | Correcto |
| `camel-ai/camel` — estrellas | 17 938 | 17 939 | API `stargazers_count` | Corregido |
| `microsoft/agent-framework` — estrellas | 14 224 | 14 224 | API `stargazers_count` | Correcto |
| `microsoft/magentic-ui` — estrellas | 10 097 | 10 097 | API `stargazers_count` | Correcto |
| `modelcontextprotocol/modelcontextprotocol` — estrellas | 9 486 | 9 486 | API `stargazers_count` | Correcto |
| `modelcontextprotocol/modelcontextprotocol` — licencia | MIT → Apache-2.0 | Transición MIT→Apache-2.0 declarada en el `LICENSE`; la API devuelve `NOASSERTION` | `LICENSE` | Correcto |
| `kyegomez/swarms` — estrellas | 7 283 | 7 283 | API `stargazers_count` | Correcto |
| `crewAIInc/crewAI-examples` — estado | (no declarado) | `archived: true`, último push 2026-04-20 | API `archived` | Añadido |
| `ag2ai/ag2` — estrellas | 5 006 | 5 006 | API `stargazers_count` | Correcto |
| `OpenBMB/AgentVerse` — estrellas | 5 158 | 5 158 | API `stargazers_count` | Correcto |
| `openai/openai-agents-js` — estrellas | 3 930 | 3 930 | API `stargazers_count` | Correcto |
| `letta-ai/letta-code` — estrellas | 3 700 | 3 660 | API `stargazers_count` | Corregido |
| `letta-ai/letta-code` — último push | n/d | 2026-10-20 | API `pushed_at` | Corregido |
| `google/adk-js` — estrellas | 1 443 | 1 443 | API `stargazers_count` | Correcto |
| `agntcy/oasf` — estrellas | 340 | 340 | API `stargazers_count` | Correcto |
| `agntcy/slim` — estrellas | 229 | 229 | API `stargazers_count` | Correcto |
| `agntcy/dir` — estrellas | 199 | 199 | API `stargazers_count` | Correcto |
| `agntcy/acp-spec` — estado | (no declarado) | `archived: true`, último push 2025-05-23 | API `archived` | Añadido |
| `agntcy/identity` — estrellas | 107 | 107 | API `stargazers_count` | Correcto |
| `microsoft/magentic-one` — existencia | 404 | 404 | API `GET /repos/...` | Correcto |
| `TinyLlama/TinyLlama` — existencia | 404 | 404 | API `GET /repos/...` | Correcto |
| `packages/subegos/src/SubEgoBudget.ts:72` — `MODEL_PRICING_PER_MILLION` | línea 72 | línea 72 | lectura local | Correcto |
| `packages/subegos/src/DelegationRouter.ts` — sin `checkpoint`/`resume`/`idempot`/`AbortSignal` | 0 coincidencias | 0 coincidencias | grep local | Correcto |
| `packages/events/src/types.ts` — evento `task.checkpoint` | existe | existe (línea 11) | lectura local | Correcto |
| `packages/execution/src/ApprovalEngine.ts` — `PendingApproval` en memoria | existe | existe | lectura local | Correcto |
| Ruta de `DelegationRouter.ts` en §9.4 | `packages/subegos/DelegationRouter.ts` | `packages/subegos/src/DelegationRouter.ts` | árbol local | Corregido |
| Ruta de `TaskCheckpoint.ts` en §9.4 | `packages/tasks/TaskCheckpoint.ts` | `packages/tasks/src/TaskCheckpoint.ts` | árbol local | Corregido |
| Ruta de `SubEgoManifest.ts` en §9.4 | `packages/subegos/SubEgoManifest.ts` | `packages/subegos/src/SubEgoManifest.ts` | árbol local | Corregido |
| Ruta de `ApprovalEngine.ts` en §9.4 | `packages/execution/ApprovalEngine.ts` | `packages/execution/src/ApprovalEngine.ts` | árbol local | Corregido |
| Ruta de `TrustBoundary.ts` en §9.4 | `packages/runtime/TrustBoundary.ts` | `packages/runtime/src/TrustBoundary.ts` | árbol local | Corregido |
| Rutas y líneas de `langchain-ai/langgraph` (§3.2) | 9 referencias `ruta:línea` | no comprobables en local | repo no clonado | No verificado (2026-10-20) |
| Rutas y líneas de `microsoft/autogen` (§3.2) | 8 referencias `ruta:línea` | no comprobables en local | repo no clonado | No verificado (2026-10-20) |
| Rutas y líneas de `microsoft/agent-framework` (§3.2) | 7 referencias `ruta:línea` | no comprobables en local | repo no clonado | No verificado (2026-10-20) |
| Rutas y líneas de `google/adk-python` (§3.2) | 7 referencias `ruta:línea` | no comprobables en local | repo no clonado | No verificado (2026-10-20) |
| Rutas y líneas de `openai/openai-agents-python` (§3.2) | 10 referencias `ruta:línea` | no comprobables en local | repo no clonado | No verificado (2026-10-20) |
| Rutas y líneas de `crewAIInc/crewAI` (§3.2) | 8 referencias `ruta:línea` | no comprobables en local | repo no clonado | No verificado (2026-10-20) |
| Rutas y líneas de `pydantic/pydantic-ai` (§3.2) | 5 referencias `ruta:línea` | no comprobables en local | repo no clonado | No verificado (2026-10-20) |
| Rutas y líneas de `huggingface/smolagents` (§3.2) | 6 referencias `ruta:línea` | no comprobables en local | repo no clonado | No verificado (2026-10-20) |
| Rutas y líneas de `agno-agi/agno` (§3.2) | 4 referencias `ruta:línea` | no comprobables en local | repo no clonado | No verificado (2026-10-20) |
| Rutas y líneas de `camel-ai/camel` (§3.2) | 8 referencias `ruta:línea` | no comprobables en local | repo no clonado | No verificado (2026-10-20) |
| Rutas y líneas de `agentscope-ai/agentscope` (§3.2) | 3 referencias `ruta:línea` | no comprobables en local | repo no clonado | No verificado (2026-10-20) |
| Rutas y líneas de `FoundationAgents/MetaGPT` (§3.2) | 7 referencias `ruta:línea` | no comprobables en local | repo no clonado | No verificado (2026-10-20) |
| Rutas y líneas de `OpenBMB/ChatDev` (§3.2) | 4 referencias `ruta:línea` | no comprobables en local | repo no clonado | No verificado (2026-10-20) |
| Rutas y líneas de `joonspk-research/generative_agents` (§3.2) | 5 referencias `ruta:línea` | no comprobables en local | repo no clonado | No verificado (2026-10-20) |
| A2A: Linux Foundation desde junio de 2025, más de 150 organizaciones, uso enterprise desde abril de 2026 | declarado | sin fuente en API de GitHub | búsqueda web | No verificado (2026-10-20) |
| AGNTCY: draft IETF `draft-mp-agntcy-ads-02` | declarado | sin fuente en API de GitHub | búsqueda web | No verificado (2026-10-20) |
| Mercados de agentes: `mcp.so`, Smithery, PulseMCP, `registry.modelcontextprotocol.io`, discussion 741 de A2A | declarados | sin fuente en API de GitHub | búsqueda web | No verificado (2026-10-20) |
| `agentscope`: cliente A2A de "unas 660 líneas" | declarado | sin fuente en API de GitHub | repo no clonado | No verificado (2026-10-20) |

Notas de la auditoría:

- Ningún repositorio citado en §3.1 resultó inexistente. Los dos 404
  declarados (`microsoft/magentic-one` y `TinyLlama/TinyLlama`) se
  reconfirmaron.
- Las rutas `ruta:línea` de los repositorios externos **no** son verificables
  en local (esos repos no están clonados en `repos-referencia/`); sólo se
  comprobaron las rutas internas de Ego y los ficheros de licencia públicos.
- Las diferencias de una o dos estrellas son deriva en vivo entre la consulta
  original y la de auditoría, no un error de dato.

**Recuento**: 53 cifras verificadas · 18 corregidas · 18 marcadas "no
verificado".
