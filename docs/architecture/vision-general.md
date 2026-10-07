| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente vigente de arquitectura general |
| Owner | ness-e |
| Fecha | 2026-10-06 |

# Visión General de la Arquitectura

## Ego como Sistema Operativo Cognitivo
Ego es un Sistema Operativo Cognitivo (SOC). Va más allá de ser un simple chatbot o asistente; orquesta memoria persistente, capacidades especializadas, coordinación de herramientas y ejecución proactiva, actuando como el sistema operativo central para los proyectos del usuario. (Ver `../product/definicion-soc.md`).

Bajo el principio rector de **"Ego es uno para el usuario y muchos por dentro"**, el usuario interactúa unificadamente con **Ego** sin necesidad de gestionar la complejidad de los agentes internos, a menos que opte voluntariamente por interactuar con un Sub-Ego mediante `@mención`.

## Arquitectura por capacidades
En lugar de capas rígidas tradicionales, la arquitectura se organiza en torno a 9 capacidades fundamentales mapeadas a sus implementaciones técnicas:
1. **Memoria**: VantaDB como substrate local-first de memoria, conocimiento y recuperación cognitiva (persistencia + retrieval híbrido + grafos + context engine + dream consolidation).
2. **Cognición**: Enrutamiento multi-proveedor de modelos y Decision Intelligence Layer (clasificación, scoring, routing, extracción, validación y decisiones estructuradas).
3. **Especialización**: Catálogo de dominios y plantillas de Sub-Egos.
4. **Coordinación**: Capa de coordinación (Meta-Ego) y Orchestration Bus (red de especialistas).
5. **Ejecución**: Herramientas locales y conexiones a APIs.
6. **Planificación**: LLMs designados (Planners).
7. **Supervisión**: Telemetría, Gobernanza, Supervisores.
8. **Adaptación**: Sugerencia proactiva de capacidades.

## Implementación técnica
- **Presentación**: Electron + React + TypeScript + Vite (electron-vite). Proporciona un workspace dinámico (Chat + Canvas) y un Runtime de UI con un catálogo de componentes declarativos (Ver [ui-runtime.md](../architecture/ui-runtime.md)). *Nota: Next.js se reserva exclusivamente para Ego Web (landing, auth, cloud).*
- **Aplicación y Coordinación**: Main Node. Incluye el Gateway que normaliza los EgoEvent, la **Decision Intelligence Layer** (capa transversal de clasificación, evaluación, scoring, routing, extracción y validación estructurada con su Decision Router), la capa de coordinación central (**Meta-Ego**) y el **Orchestration Bus** para la comunicación inter-agente gobernada. Ego utiliza un runtime cognitivo propio sobre un bus de eventos (EgoEvent), con interfaces extensibles para workflows, modelos, herramientas, memoria y ejecución. Frameworks externos como LangGraph o Mastra pueden integrarse posteriormente mediante adaptadores cuando una necesidad concreta justifique su incorporación. La comunicación con el frontend utiliza `contextIsolation=true`, `sandbox=true` y un bridge (preload) fuertemente tipado.
- **Memoria**: VantaDB 0.8.0 embedded vía `NativeVantaDB` de `"vantadb/native"` (napi-rs) en el proceso principal para operaciones frecuentes (put/get/search/graph) + `vantadb-mcp` como subprocess cognitivo stdio para capacidades avanzadas de `vanta-memory` (recall/context assembly/dream consolidation/scenes/skills). EgoMemoryAdapter como gateway único. Prohibidos `Client` WASM, `vanta-proxy` (FROZEN) y `vantadb-server` en desktop. Opera como memoria compartida del proyecto con aislamiento de estado privado por Sub-Ego. (Ver [memoria-vantadb.md](../architecture/memoria-vantadb.md)).
- **Sub-Egos**: Catálogo de dominios funcionales + catálogo inicial de Sub-Egos preconfigurados + instancias dinámicas (técnicamente instancias de agentes) organizadas como una red coordinada (Ver [agentes.md](../architecture/agentes.md) y [dominios-funcionales.md](../architecture/dominios-funcionales.md)).
- **Integración**: Arquitectura desacoplada en 3 niveles (Nivel A: First-party nativo, Nivel B: MCP universal, Nivel C: Import/Webhook/API genérico). Ego opera bidireccionalmente como **MCP Client** (consumidor de herramientas y recursos externos) y como **MCP Server** (exposición de contexto del proyecto, memoria en VantaDB, grafo de conocimiento y tareas para IDEs y agentes externos). Integraciones P0: Filesystem, Git, Terminal, MCP Client, MCP Server, GitHub (vía MCP oficial) y HTTP/Webhooks (Ver [integraciones.md](../engineering/integraciones.md)).
- **IA y Modelos**: Arquitectura multi-proveedor agnóstica desde P0. Ego Model Interface (abstracción propia de Ego) canaliza las peticiones hacia el Model Router, el cual utiliza adaptadores de integración (como Vercel AI SDK, utilizado como adaptador de integración y no como arquitectura propietaria; adaptadores directos y adaptadores locales). Selección por capacidades (`text`, `vision`, `audio`, `tool_calling`, `structured_output`, `reasoning`, `embeddings`, `code`, `streaming`), roles funcionales, costo, latencia, disponibilidad, privacidad y presupuesto (AI Wallet / budget). Soporte para modelos Cloud (OpenAI, Anthropic, Google, xAI, etc.), Local (Ollama, LM Studio, llama.cpp con enfoque offline-first), BYOK y endpoints compatibles con OpenAI, con fallbacks automáticos y observabilidad exhaustiva.

## Coordinación y comunicación: Orchestration Bus y Meta-Ego
Ego adopta un modelo de **red coordinada**, no una jerarquía piramidal rígida:

- **Meta-Ego como capa de coordinación:** El Meta-Ego es la **capa central de orquestación y coordinación** de Ego, **no un Sub-Ego**. Es un término interno de arquitectura; el usuario simplemente interactúa con **Ego** (*"Ego es uno para el usuario y muchos por dentro"*). El Meta-Ego interpreta la intención del usuario, selecciona capacidades, coordina especialistas, supervisa la ejecución, resuelve conflictos y sintetiza las respuestas.
- **Orchestration Bus:** Capa de infraestructura interna que gestiona la comunicación entre Sub-Egos. Proporciona enrutamiento, trazabilidad, control de permisos, inyección de contexto, prioridad, asignación presupuestaria y auditoría.
- **Comunicación directa inter-agente:** Los Sub-Egos **pueden comunicarse directamente entre sí** (consultas P2P autorizadas, eventos reactivos, delegación de tareas y pedidos de opinión especializada) a través del Orchestration Bus, sin necesidad de que cada interacción deba transitar obligatoriamente por el Meta-Ego.

```
                EGO / CORE
                    │
        ┌───────────┴───────────┐
        │   ORCHESTRATION BUS   │
        └───────────┬───────────┘
          ↙         ↓         ↘
     Sub-Ego A ↔ Sub-Ego B ↔ Sub-Ego C
          ↘         ↓         ↙
            Shared Project Memory (VantaDB)
```

## Runtime cognitivo propio (Cognitive Runtime)
En P0, Ego prescinde de frameworks de agentes pesados como dependencias centrales (sin Mastra ni LangGraph como núcleo). En su lugar, Ego implementa un **runtime cognitivo propio, ligero y extensible**, concebido específicamente para actuar como un Sistema Operativo Cognitivo.

### Principios rectores
- **"Ego debe poseer la abstracción y no la implementación de terceros."**
- **"Construir lo que define a Ego. Reutilizar lo que es commodity. Integrar lo que resuelve una complejidad especializada."**
- **"Ego no construirá 'el mejor framework de agentes'. Construirá el runtime que necesita un Sistema Operativo Cognitivo."**
- **"Ego no depende de un modelo específico. Depende de capacidades de inteligencia. Los proveedores y modelos son intercambiables."**
- **"Ego debe depender de capacidades de inteligencia, no de proveedores específicos."**
- **"Jev puede desaparecer y la arquitectura de Ego no debería cambiar."**

### Componentes de Ego Core Runtime
El runtime cognitivo propio de Ego se compone de los siguientes módulos integrados:
1. **Agent Loop:** Ciclo fundamental de ejecución cognitiva (Input → Context Manager → Decision Intelligence Layer / Model Router → LLM / Decision Model → Tool Dispatch / Sub-Ego Delegation / Approval HITL / Response).
2. **Model Router:** Enrutamiento inteligente multi-proveedor basado en **capacidades requeridas** (`text`, `vision`, `audio`, `tool_calling`, `structured_output`, `reasoning.high`, `coding.high`, `classification.low`, `embeddings`, `streaming`, etc.) en combinación con costo, latencia, disponibilidad, privacidad, presupuesto y preferencias del usuario. La arquitectura de Ego es agnóstica de proveedores desde P0: Ego Model Interface (abstracción propia) despacha hacia adaptadores de integración (Vercel AI SDK como adaptador de integración —no como arquitectura propietaria—, adaptadores directos y adaptadores locales). Soporta proveedores Cloud (OpenAI, Anthropic, Google, xAI, etc.), Local (Ollama, LM Studio, llama.cpp), BYOK, endpoints compatibles con OpenAI y Custom Providers con soporte de fallbacks y observabilidad exhaustiva.
3. **Decision Intelligence Layer:** Capa transversal para clasificación, scoring, routing, extracción, validación, evaluación, selección, moderación y triage de decisiones estructuradas. Opera mediante un Decision Router que orquesta reglas determinísticas, modelos especializados de decisión (como Jev de TypeSafe AI como proveedor externo opcional, no vinculante), LLMs con structured output y modelos locales, con fallbacks garantizados.
4. **Tool/MCP Registry:** Registro unificado y gobernado de herramientas locales y conexiones a servidores MCP.
5. **Context Manager:** Ensamblado contextual dinámico. Puede delegar la compresión multinivel a VantaDB Context Engine (via `context_assemble`). Inyección de memoria relevante y poda semántica de tokens por llamada.
6. **Shared Memory Access:** Conexión con VantaDB vía `NativeVantaDB` (napi-rs, Fast Path) + `vantadb-mcp` (Cognitive Path) y `EgoMemoryAdapter` como gateway único. Memoria compartida del proyecto con aislamiento de estado privado (`egos/<id>/*`).
7. **Sub-Ego Coordination:** Gestión de colaboración inter-agente (consultas directas P2P, eventos reactivos y delegación técnica).
8. **Task/Execution Manager:** Programación y despacho de tareas, control de dependencias y regulación dinámica de concurrencia.
9. **Permission System:** Control de acceso basado en listas de permisos (ACL) y comprobación de directivas antes de accesos a namespaces o herramientas.
10. **Budget/Cost Controller:** Supervisión de costes, límites de tokens y latencia asignados a cada turno o Sub-Ego.
11. **Event Bus (`EgoEvent`):** Infraestructura reactiva para la emisión, enrutamiento y suscripción de eventos tipados en todo el sistema.
12. **Approval/HITL (Human-in-the-Loop):** Puntos de interrupción y validación para acciones de alto impacto o estados en cuarentena.
13. **State Persistence:** Guardado y restauración determinista del estado operativo del runtime y de las sesiones de trabajo.
14. **Retry/Recovery:** Manejo resiliente de fallos de proveedores de modelos, reintentos exponenciales y degradación elegante con fallbacks automáticos entre tiers y modelos.
15. **Observability:** Telemetría multidimensional por turno, tracking de proveedor, modelo, tarea, Sub-Ego, tokens consumidos, costo, latencia, errores y fallbacks, con trazabilidad inmutable en `gov/audit`.
16. **Dynamic Workspace Events:** Emisión de eventos y esquemas de UI declarativa para renderizado reactivo en el frontend.

### Separación: Cognitive Runtime vs. Execution Runtime
La arquitectura desacopla estrictamente dos dominios de ejecución:
- **Cognitive Runtime (Runtime Cognitivo):** Reside en el proceso principal y se encarga del razonamiento, enrutamiento de modelos, ensamblado de contexto, orquestación de tareas, políticas de gobernanza y síntesis de respuestas. Es agnóstico respecto a dónde se ejecuta el código físico.
- **Execution Runtime (Runtime de Ejecución):** Entorno responsable de la ejecución material de código, herramientas, comandos del sistema y procesos de usuario. Diseñado para soportar múltiples backends según la necesidad de aislamiento: local (Node/OS directo), Docker, entornos sandbox seguros (ej. E2B) y nube. El código NUNCA se ejecuta en el renderer de la interfaz.

### Bus de eventos: EgoEvent
La coordinación interna se apoya en el bus de eventos tipados `EgoEvent`, que desacopla la comunicación y habilita la reactividad del sistema. Los eventos canónicos de coordinación inter-Sub-Ego y del sistema incluyen:
- `task.created`: Registro de una nueva tarea en el sistema.
- `task.started`: Inicio de procesamiento de una tarea.
- `task.completed`: Finalización exitosa de una tarea con sus resultados.
- `task.failed`: Fallo en la ejecución con registro de error y causa.
- `subego.invoked`: Activación de un Sub-Ego o especialista temporal.
- `subego.message`: Mensaje o consulta intercambiada entre Sub-Egos en el Orchestration Bus.
- `subego.delegated`: Delegación explícita de subtareas entre especialistas.
- `memory.updated`: Modificación o consolidación de hechos en VantaDB.
- `approval.required`: Requerimiento de aprobación humana antes de proceder con una acción.
- `tool.executed`: Ejecución y resultado de una herramienta o MCP.
- `artifact.created`: Generación de un nuevo documento, esquema o entregable.
- `workspace.updated`: Mutaciones en el estado o vistas del workspace dinámico.
- `project.changed`: Cambios en la configuración o contexto global del proyecto vivo.

### Frameworks externos como adaptadores opcionales
Ego posee sus propias abstracciones y contratos de interfaz. Frameworks de agentes externos (como LangGraph o Mastra) no son dependencias del núcleo en P0; quedan reservados como **adaptadores opcionales y futuros** situados detrás de las interfaces propias de Ego (`EgoWorkflowAdapter`, `EgoAgentAdapter`), incorporables únicamente cuando una necesidad funcional o de workflow altamente especializada justifique su inclusión.

Asimismo, los repositorios de referencia de la industria (Hermes, OpenHands, Codex, Claude Code, Dots, etc.) se emplean como **patrones arquitectónicos de referencia y aprendizaje de diseño**, y **no** como dependencias directas de código.

#### Criterios de evaluación para frameworks externos
Cualquier framework considerado en el futuro debe ser evaluado contra 12 criterios estrictos:
1. **Ajuste arquitectónico (*architecture fit*):** Compatibilidad con la filosofía SOC y el modelo de Ego.
2. **Control del estado (*state control*):** Capacidad de Ego para inspeccionar y gobernar el estado de extremo a extremo.
3. **Soporte de proveedores (*provider support*):** Flexibilidad multi-modelo y soporte offline-first (Ollama/Llama).
4. **Compatibilidad con memoria:** Integración limpia con VantaDB y `ego.namespaces.json`.
5. **Registro de herramientas (*tool registry*):** Soporte nativo para herramientas locales y protocolos MCP.
6. **Soporte del modelo de Sub-Egos:** Adaptabilidad al ciclo de vida de especialistas de Ego.
7. **Persistencia de estado:** Capacidad de serialización y snapshots fiables.
8. **Observabilidad:** Exposición de trazas detalladas y métricas compatibles con `gov/audit`.
9. **Rendimiento:** Baja sobrecarga y latencia mínima añadida al ciclo cognitivo.
10. **Licencia:** Compatibilidad con licencias de código abierto (Apache 2.0).
11. **Sustituibilidad (*replaceability*):** Facilidad de desacoplamiento sin contaminar el resto del sistema.
12. **Complejidad accidental:** Mínima fricción operativa y ausencia de dependencias innecesarias.

## Arquitectura de integración: MCP y conectores desacoplados
Bajo la decisión P23 (variante D+), Ego adopta una estrategia de integración híbrida estandarizada en torno al protocolo abierto **MCP (Model Context Protocol)**, combinando conectores nativos para servicios críticos e interfaces genéricas para el resto del ecosistema:

- **Ego como MCP Client:** Capacidad universal para conectarse a servidores MCP externos (locales vía `stdio` o remotos vía `SSE`/HTTP) y consumir dinámicamente sus herramientas, recursos y prompts.
- **Ego como MCP Server:** Expone las capacidades internas del sistema (`project_context`, `memory_search`, `knowledge_search`, `tasks`, `project_state`) a clientes y agentes externos (OpenCode, Claude Desktop, Cursor, Codex) de forma gobernada y local.

### Categorización formal de MCP en Ego
- **MCP Interno (Subprocess stdio):** `vantadb-mcp` (88 tools) como puente cognitivo hacia `vanta-memory` (L0-L3) en P0. No es una integración de producto con un tercero, sino un mecanismo de interoperabilidad local entre procesos. Su objetivo en P1 es ser reemplazado por una fachada nativa vía napi-rs.
- **MCP Externo (Herramientas y SaaS):** Servidores MCP oficiales (GitHub) y de la comunidad para interactuar con herramientas y servicios externos.
- **MCP Server de Ego:** Punto de exposición soberano del Proyecto Vivo hacia otros editores y herramientas.

### Los tres niveles de integración
1. **Nivel A — First-party (Nativo):** Integraciones mantenidas directamente en Ego con UX profunda para servicios críticos del sistema (Filesystem, Terminal, Git local; en P1 Email y Calendario).
2. **Nivel B — MCP:** Capa estándar universal para la gran mayoría de herramientas, servicios SaaS y plataformas externas a través de servidores MCP (GitHub vía MCP oficial).
3. **Nivel C — Import/Webhook/API Genérico:** Interfaces universales para ingesta de datos estructurados (CSV, JSON, Markdown), llamadas REST y Webhooks en servicios sin soporte MCP.

### Pipeline de ejecución desacoplado
El flujo de despacho de herramientas e integraciones sigue un pipeline estricto de cuatro capas:
```
Cognitive Runtime → Tool Registry → Execution Manager → Integration Adapter → [Native Connector / MCP Client / HTTP Webhook]
```

### Aislamiento estricto del núcleo
- **Sin lógica de servicio en el runtime cognitivo:** El `Cognitive Runtime` jamás contiene bifurcaciones específicas de servicios externos (prohibido `if github...`, `if slack...`).
- **Criterio de extensibilidad:** Agregar, modificar o remover una integración **NO DEBE modificar** el `Cognitive Runtime`, `Model Router`, `Sub-Ego Runtime`, `Workspace Runtime` ni la `Decision Intelligence Layer`. Todas las integraciones interactúan exclusivamente a través de los contratos normalizados del `Tool Registry` y el `Integration Adapter`.

### Principios rectores
- **"Pocas integraciones implementadas profundamente, muchas integraciones posibles arquitectónicamente."**
- **"Ego debe poder conectarse con el ecosistema del usuario sin convertirse en el ecosistema del usuario."**

(Para especificaciones detalladas, matriz de fases y gestión de credenciales, consulte [integraciones.md](../engineering/integraciones.md)).

## Flujo canónico
El flujo de procesamiento de una interacción típica sigue esta secuencia:
1. El usuario interactúa con **Ego** (o un Sub-Ego genera un evento interno).
2. **Gateway** normaliza el evento a un formato `EgoEvent`.
3. **Decision Intelligence Layer** (reglas deterministas, modelos especializados de decisión como Jev de TypeSafe o structured output de LLMs) determina la intención, clasificación de tarea y presupuesto preliminar asignado mediante su Decision Router.
4. **Meta-Ego (Capa de Coordinación)** selecciona las capacidades y coordina los Sub-Egos requeridos.
5. **Sub-Egos** ejecutan la tarea y colaboran directamente a través del **Orchestration Bus** (comunicación directa autorizada, eventos, delegación u opinión) utilizando herramientas autorizadas.
6. Lectura y escritura en la memoria compartida del proyecto mediante **EgoMemoryAdapter** (preservando el estado privado bajo `egos/<id>/*`).
7. Generación de **Dynamic UI Schema**.
8. **Workspace** renderiza el resultado unificado en la interfaz.
9. Se registra toda la actividad en **gov/audit** y métricas en **metrics/**.

## Lenguajes TS-first
Todo el stack técnico, desde la UI hasta el backend en Node y las abstracciones del orquestador, están construidos de manera "TypeScript-first", garantizando tipado fuerte y contratos estables entre el orquestador, las herramientas y la UI.

## Transversal
El sistema está distribuido mediante un instalador de Electron. Se prioriza una filosofía **local-first** y **offline-first**, utilizando su propio keychain de seguridad y operando con dependencia cero en la nube (zero cloud dependency), asegurando máxima privacidad y rendimiento.
