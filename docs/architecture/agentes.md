| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente vigente de arquitectura de Sub-Egos |
| Owner | ness-e |
| Fecha | 2026-10-06 |
| Fuente histórica | `../prd/11-10-modelo-multi-agente-departamental.md`, `../prd/24-23-departamentos-completos-de-9-a-23-agentes.md` y Decisiones P1-P10, P17, P19 2026-10-06 |

# Arquitectura de Sub-Egos (Agent Runtime)

## Modelo: capacidades dinámicas, no roles fijos
Ego **NO** tiene un catálogo rígido de 23 Sub-Egos permanentes. En su lugar, posee un catálogo inicial de Sub-Egos preconfigurados (plantillas de especialistas basadas en dominios funcionales) que pueden ser utilizados, combinados, personalizados o instanciados dinámicamente. El número de Sub-Egos no es una propiedad fija de la arquitectura.

## Tres conceptos fundamentales
1. **Dominio**: El área de responsabilidad o "qué trabajo existe" (ej. Marketing, Engineering).
2. **Plantilla de Sub-Ego**: Define responsabilidades, capacidades, conocimiento, reglas, herramientas y comportamiento base.
3. **Instancia de Sub-Ego**: Una entidad concreta trabajando dentro de un proyecto, creada a partir de una plantilla, personalizada por el usuario, o generada por la combinación de múltiples capacidades.

## Definición de Sub-Ego
Un Sub-Ego es un especialista de IA persistente con responsabilidades, contexto, capacidades, herramientas y reglas de comportamiento determinadas dentro del proyecto. Técnicamente, cada Sub-Ego se ejecuta como una instancia de agente.
Nota: Los Sub-Egos **NO** son "empleados digitales".

## Activación contextual
Ego utiliza *lazy activation* (activación bajo demanda). El sistema determina qué capacidades o especialistas se necesitan basándose en la intención, el contexto y el estado del proyecto. El usuario no necesita saber qué Sub-Ego está respondiendo. Las capacidades están disponibles en la arquitectura sin necesidad de estar activas permanentemente. Es válido tener 0 Sub-Egos visibles mientras Ego usa Sub-Egos internamente.

## Control del usuario
El usuario **PUEDE**:
- Activar/desactivar capacidades.
- Establecer Sub-Egos disponibles.
- Personalizar responsabilidades y cambiar instrucciones/comportamiento.
- Asignar herramientas y permisos.
- Crear Sub-Egos personalizados combinando capacidades.
- Establecer favoritos o limitar áreas por proyecto/contexto.

Sin embargo, el usuario **NO** está obligado a gestionar esta arquitectura para que Ego funcione correctamente.

## Sugerencia de nuevas capacidades
Ego detecta necesidades recurrentes basadas en los patrones de uso reales y recomienda nuevas capacidades. Por ejemplo, si el usuario está realizando muchas tareas de QA, Ego puede sugerir instanciar un Sub-Ego especializado con capacidades de DevQA.

## Sub-Egos personalizados
Los usuarios pueden crear Sub-Egos personalizados combinando múltiples dominios funcionales:
- **"Growth Advisor"** = Marketing + Analytics + Sales + Strategy
- **"Technical Product Lead"** = Product + Engineering + Data

El modelo de creación permite:
- Dominio → Plantilla → Sub-Ego Especializado → Personalización del Usuario
- Múltiples dominios → Sub-Ego Personalizado → Responsabilidad Específica

## Fábrica de Sub-Egos — sistema inteligente de diseño
La Fábrica de Sub-Egos **NO es un simple CRUD** de configuración de agentes. Es un sistema inteligente de diseño, configuración, validación y evolución de especialistas adaptados a las necesidades reales del usuario y del proyecto.

Ego actúa como un **diseñador de especialistas**:
- Analiza la intención del usuario a partir de su lenguaje natural.
- Identifica los dominios funcionales, capacidades, herramientas e integraciones requeridas.
- Asigna y parametriza los permisos mínimos necesarios.
- Detecta responsabilidades excesivamente amplias o difusas y propone refinamientos para asegurar que el especialista mantenga un enfoque nítido y efectivo.

> *"La creación manual es opcional; la comprensión de la intención es obligatoria."*

### Métodos de creación complementarios
El sistema ofrece tres vías de creación complementarias según el nivel de control deseado:

1. **Conversacional (Principal):** El usuario describe su necesidad u objetivo en lenguaje natural (ej. *"Necesito a alguien que audite los contratos y me avise de cláusulas de riesgo"*). Ego interpreta la intención, formula la arquitectura del especialista y genera la configuración propuesta completa.
2. **Plantillas (Templates):** Catálogo de Sub-Egos predefinidos para casos de uso comunes basados en los dominios funcionales probados del sistema (ej. DevQA, Growth Advisor, Data Analyst), listos para instanciar o clonar.
3. **Configuración avanzada:** Interfaz para el control manual exhaustivo de cada parámetro, regla, namespace, herramienta y política de ejecución para usuarios técnicos o casos de alta especificidad.

## SubEgoManifest
Toda instancia de Sub-Ego se rige por un `SubEgoManifest`, un contrato declarativo estructurado que define su existencia y límites operativos:

- **Identidad (Identity):** Nombre único, propósito explícito y descripción funcional.
- **Responsabilidades (Responsibilities):** Objetivos primarios y secundarios claramente delimitados.
- **Capacidades (Capabilities):** Dominios funcionales asociados y destrezas cognitivas/técnicas activas.
- **Herramientas (Tools):** Herramientas MCP y funciones locales disponibles, junto con sus integraciones habilitadas.
- **Memoria (Memory):** Acceso a la memoria compartida del proyecto en VantaDB más partición de memoria especializada con contexto histórico acumulado.
- **Permisos (Permissions):** Reglas de lectura, escritura y ejecución segmentadas por namespace de VantaDB.
- **Comportamiento (Behavior):** Directivas del sistema (system prompt), políticas éticas y restricciones operativas (*constraints*).
- **Autonomía (Autonomy):** Nivel de agencia (sugerir ideas, solicitar aprobación previa antes de ejecutar, o actuar automáticamente en tareas rutinarias). **Por defecto, el nivel de autonomía es conservador** para garantizar la seguridad y supervisión humana.
- **Disparadores (Triggers):** Petición directa del usuario, eventos del sistema o ejecuciones programadas (*schedules*).
- **Colaboración (Collaboration):** Lista de Sub-Egos autorizados para comunicación directa y reglas de intercambio de contexto.

**Revisión y aprobación previa:** Antes de que cualquier Sub-Ego sea instanciado en el entorno, Ego presenta el `SubEgoManifest` resultante al usuario para su revisión, ajuste y aprobación explícita.

## Sub-Egos persistentes vs especialistas temporales
La arquitectura distingue con claridad entre dos modalidades de especialización:

- **Sub-Ego persistente:** Es una entidad formal creada o confirmada por el usuario. Mantiene su configuración, memoria a largo plazo en VantaDB, historial de trabajo y estado continuo entre sesiones. Evoluciona a lo largo del tiempo conforme interactúa con el proyecto.
- **Especialista temporal:** Ego coordina internamente un conjunto de capacidades para resolver una tarea puntual sin necesidad de crear ni exponer una entidad visible en la interfaz.
  - *Ejemplo:* Ante la instrucción *"Analiza ventas"*, Ego coordina internamente las capacidades de Sales + Finance + Analytics + Marketing bajo el capó, sin abrumar al usuario exigiéndole crear 4 Sub-Egos visibles.
  - Los especialistas temporales son **internos e invisibles por defecto**, optimizando la carga cognitiva del usuario.
  - **Promoción a persistente:** Si Ego detecta que una combinación de capacidades temporales se utiliza de manera recurrente, puede sugerir proactivamente al usuario consolidarla y convertirla en un Sub-Ego persistente dedicado.

## Evolución post-creación
Un Sub-Ego no concluye su diseño en el momento de su creación. Ego monitoriza de forma continua el uso real de cada especialista y detecta oportunidades de optimización operativa:

- **Ampliación de capacidades:** Sugerir la adición de nuevas destrezas o herramientas cuando las tareas delegadas desbordan su alcance inicial.
- **Ajuste de permisos:** Proponer la concesión o restricción de permisos en función de los recursos que efectivamente utiliza.
- **Partición (Split):** Detectar Sub-Egos sobrecargados cuyas responsabilidades han crecido en exceso y proponer dividirlos en dos especialistas complementarios y enfocados.
- **Fusión (Merge):** Identificar Sub-Egos redundantes o con solapamientos excesivos de responsabilidades y proponer combinarlos en una única entidad más eficiente.

> *"Un Sub-Ego no es únicamente una configuración estática. Es una entidad especializada que puede ser diseñada, instanciada, configurada y evolucionada por Ego o por el usuario."*

## Catálogo inicial de Sub-Egos
Los roles departamentales originales se han reorganizado en dominios funcionales extensibles con Sub-Egos preconfigurados. Para la lista completa y organizada, consultar [Dominios Funcionales](../architecture/dominios-funcionales.md).

## Meta-Ego: capa de coordinación
El **Meta-Ego** es la **capa central de orquestación y coordinación** de Ego, **NO un Sub-Ego más**. No compite con los Sub-Egos ni constituye un especialista con dominio temático específico (como Marketing o QA); es el componente arquitectónico responsable de la cohesión e inteligencia orquestada del sistema.

### Principio de experiencia: "Ego es uno para el usuario y muchos por dentro"
El usuario interactúa exclusivamente con **Ego** como interlocutor unificado (salvo que decida explícitamente interactuar con un Sub-Ego mediante `@mención`). El usuario no necesita conocer ni gestionar la existencia del Meta-Ego; "Meta-Ego" es un concepto técnico de arquitectura interna.

### Funciones del Meta-Ego
- **Interpretar la intención del usuario:** Comprender y descomponer los requerimientos expresados en lenguaje natural.
- **Determinar capacidades requeridas:** Identificar qué dominios y destrezas cognitivas/técnicas son necesarias.
- **Seleccionar y coordinar Sub-Egos:** Activar Sub-Egos persistentes o conformar especialistas temporales bajo demanda.
- **Dividir problemas complejos y asignar tareas:** Descomponer objetivos en planes operativos y subtareas distribuidas.
- **Proporcionar contexto relevante:** Inyectar a cada especialista la información pertinente de la memoria compartida de VantaDB.
- **Supervisar la ejecución:** Monitorizar el progreso de las tareas, identificar cuellos de botella y gestionar dependencias.
- **Resolver conflictos:** Arbitrar desacuerdos de enfoque o prioridades entre diferentes Sub-Egos.
- **Evaluar resultados:** Validar la completitud y calidad técnica de las soluciones generadas.
- **Controlar permisos, autonomía y presupuesto:** Salvaguardar límites de tokens/costes y políticas de seguridad (ACL).
- **Sintetizar resultados para el usuario:** Unificar los aportes de múltiples especialistas en una respuesta integrada, fluida y coherente.

Los Sub-Egos no son entidades aisladas bajo jerarquía piramidal ciega; **operan y colaboran dentro del sistema de coordinación de Ego**.

## Comunicación y coordinación entre Sub-Egos
El modelo de interacción entre Sub-Egos es una **red coordinada**, no una jerarquía rígida. Los Sub-Egos **pueden comunicarse directamente entre sí**, sin necesidad de que todo mensaje pase obligatoriamente por el Meta-Ego. Sin embargo, toda comunicación inter-agente se realiza a través de una capa de infraestructura gobernada: el **Orchestration Bus**.

### Diagrama de arquitectura de coordinación

```
                EGO / CORE
                    │
        ┌───────────┴───────────┐
        │   ORCHESTRATION BUS   │
        └───────────┬───────────┘
          ↙         ↓         ↘
     Sub-Ego A ↔ Sub-Ego B ↔ Sub-Ego C
          ↘         ↓         ↙
            Shared Project Memory
```

Aunque los Sub-Egos pueden interactuar directamente de igual a igual (peer-to-peer), no existen canales ocultos (*backchannels*) fuera de control: **toda comunicación transita a través del Orchestration Bus** para asegurar trazabilidad, gobernanza, auditoría y balance de recursos.

### Tipos de comunicación
El Orchestration Bus admite cuatro modalidades de intercambio:

1. **Directa (P2P autorizada):** Comunicación directa entre dos Sub-Egos cuando su relación está explícitamente declarada y autorizada en sus respectivos manifiestos (ej. el Sub-Ego de Frontend consulta especificaciones técnicas al Sub-Ego de Backend).
2. **Eventos (Event-driven):** Publicación y suscripción a eventos significativos del proyecto (ej. `customer.created`, `code.committed`, `deployment.failed`). Los Sub-Egos reaccionan de manera autónoma ante cambios de estado relevantes.
3. **Delegación de tareas (Task Delegation):** Un Sub-Ego crea y delega una subtarea técnica a otro especialista competente, pasando el contexto necesario y esperando el entregable.
4. **Opinión y evaluación (Cross-domain Consultation):** Petición de evaluación o segunda opinión entre especialistas para decisiones multidisciplinares (ej. el Sub-Ego de Producto solicita una evaluación de factibilidad técnica a Ingeniería y un análisis de costes a Finanzas antes de formular una propuesta).

### Gobernanza de la comunicación
La comunicación entre especialistas está regulada por políticas de control precisas para evitar caos, bucles infinitos o costes desmedidos:
- **Relevancia:** La consulta o intercambio de contexto debe ser estrictamente pertinente a la tarea en curso.
- **Permisos y ACL:** Los Sub-Egos solo pueden interactuar con los pares y namespaces autorizados en su manifiesto.
- **Prioridad:** Encolado de mensajes según su urgencia (bloqueante, sincrónica, asincrónica de fondo).
- **Presupuesto y coste:** Cuotas de tokens y cómputo delimitadas para interacciones inter-agente.
- **Nivel de autonomía:** Verificación de si la delegación o acción requiere supervisión humana antes de su ejecución.
- **Profundidad máxima de delegación (*max delegation depth*):** Límite en la cadena de sub-delegaciones sucesivas (ej. Sub-Ego A → B → C) para prevenir recursión incontrolada.
- **Tiempo de ejecución (Timeouts):** Límites de respuesta para evitar bloqueos por especialistas ocupados o degradados.
- **Dependencias de tareas:** Secuenciación ordenada de pre-requisitos antes de liberar la ejecución del siguiente agente.
- **Impacto de la acción:** Escalación automática al usuario si la consecuencia de una acción compartida conlleva un alto impacto operativo o contractual.

## Modelo de memoria compartida
La memoria en Ego se fundamenta en el principio de:
> **"Memoria compartida con aislamiento de estado privado, permisos y capacidades"**

Ego **NO** implementa un "aislamiento estricto" que aísle cognitivamente a los Sub-Egos unos de otros o del proyecto. Todos los Sub-Egos trabajan sobre la **memoria compartida del proyecto** en VantaDB, manteniendo al mismo tiempo fronteras rigurosas sobre su estado privado y respetando las políticas de acceso (ACL).

### Activos de la memoria compartida del proyecto
Todos los Sub-Egos tienen acceso común (según los permisos de su manifiesto) a la base de conocimiento y estado del proyecto:
- **Objetivos y metas:** Visión estratégica y entregables prioritarios.
- **Decisiones y ADRs:** Registro histórico de decisiones adoptadas y sus justificaciones.
- **Historial del proyecto:** Línea temporal de eventos, turnos, conversaciones y cambios.
- **Entidades y relaciones:** Grafo semántico del proyecto (clientes, tareas, componentes, dependencias).
- **Hechos atómicos:** Información factual consolidada (`kb/*`).
- **Documentos y especificaciones:** Artefactos técnicos, requerimientos y documentación formal.
- **Tareas y estado operativo:** Estado del backlog, tareas en curso y resultados de ejecución.
- **Eventos:** Registro histórico de eventos en `events/*`.
- **Conocimiento del dominio:** Reglas de negocio y directrices contextuales.

### Aislamiento de estado privado
Cada Sub-Ego dispone de una partición aislada bajo `egos/<id>/*` para su estado privado:
- **Identidad y configuración:** Datos internos de su `SubEgoManifest`.
- **Estado operacional privado:** Scratchpad de razonamiento, variables de sesión y memoria de trabajo interna.
- **Permisos y capacidades asignadas:** Catálogo de herramientas y permisos que limitan su radio de acción.

Este modelo garantiza que todos los Sub-Egos compartan un entendimiento coherente y unificado del proyecto, al tiempo que se preserva la integridad de las identidades individuales, configuraciones privadas y restricciones de seguridad.

## Orquestación
El orquestador de Ego determina qué capacidades y Sub-Egos son necesarios para cada tarea. La concurrencia se gestiona mediante presupuestos de tokens/costes y métricas multidimensionales, no por CPU. Se recopila telemetría por cada turno, que se guarda en el namespace de `metrics/`. La orquestación técnica (Agent Runtime) se basa en el runtime cognitivo propio de Ego sobre el Orchestration Bus y el bus de eventos del sistema (`EgoEvent`), utilizando adaptadores de workflow opcionales cuando se requiere orquestación externa especializada.

## Concurrencia y límites de ejecución

> **Principio fundamental:** *"Ego no tiene un número máximo conceptual de Sub-Egos. Tiene un sistema de gestión de concurrencia y recursos."*

La arquitectura no impone un techo arbitrario al número de especialistas que pueden existir o colaborar en un proyecto. Lo que el sistema regula rigurosamente es la concurrencia activa en tiempo de ejecución.

### Tres conceptos fundamentales de concurrencia

Es indispensable diferenciar con precisión tres nociones que frecuentemente se confunden:

| Concepto | Definición | Ejemplo |
| --- | --- | --- |
| **Sub-Egos existentes** | Especialistas creados, configurados o disponibles dentro del catálogo del proyecto. No consumen cómputo activo mientras están inactivos. | 30 Sub-Egos configurados en el proyecto |
| **Sub-Egos disponibles** | Especialistas que pueden recibir trabajo o activarse contextualmente en un momento dado, habilitados para el flujo operativo. | 12 Sub-Egos disponibles para tareas |
| **Sub-Egos concurrentes** | Especialistas ejecutando trabajo simultáneamente en tiempo real. Este número es administrado dinámicamente por el Execution Manager. | 3 Sub-Egos ejecutando en paralelo |

**Ejemplo representativo:** Un proyecto puede tener **30 Sub-Egos existentes**, de los cuales **12 están disponibles** para operar sobre el backlog actual, pero en un instante dado solo **3 se encuentran concurrentes** ejecutando subtareas en paralelo bajo supervisión del sistema. Estos tres valores no representan el mismo número ni evolucionan de forma acoplada.

### El Execution Manager

El **Execution Manager** es el componente del sistema de orquestación responsable de regular cuántos Sub-Egos ejecutan trabajo de manera simultánea. En lugar de obedecer a un límite estático o número mágico, la concurrencia es **dinámica y gobernada** por el Execution Manager evaluando un conjunto de factores en tiempo real:

- **Recursos disponibles:** Cómputo local, memoria RAM y capacidad de la máquina anfitriona.
- **Presupuesto y coste:** Consumo acumulado de tokens y cuotas financieras asignadas a la sesión o proyecto.
- **Prioridad y urgencia:** Tareas críticas e interactivas en primer plano vs. procesamiento asíncrono en segundo plano.
- **Complejidad de la tarea:** Número de subtareas, dependencias lógicas y acoplamiento técnico.
- **Permisos y gobernanza:** Acceso a namespaces sensibles, recursos restringidos o pasos que exigen supervisión humana (Human-in-the-Loop).
- **Nivel de autonomía:** Grado de agencia concedido al especialista en su `SubEgoManifest`.
- **Latencia:** Objetivos de tiempo de respuesta comprometidos para la experiencia interactiva del usuario.
- **Profundidad de delegación (*delegation depth*):** Control para impedir cascadas recursivas de sub-delegación descontroladas.
- **Límites de proveedores de modelos:** Restricciones de tasa de peticiones (RPM/TPM) de las APIs de modelos (locales o externas).
- **Plan comercial del usuario:** Cuotas asignadas según la capa de suscripción aplicable.

### Principio de concurrencia justificada

La concurrencia **solo crece cuando existe una razón operativa genuina para ello** (por ejemplo, subtareas independientes cuyas entradas están resueltas y cuyos resultados pueden paralelizarse sin conflictos de estado). Crear paralelismo artificial sin justificación técnica solo introduce sobrecoste cognitivo, sobrecarga de contexto en memoria y consumo innecesario de tokens.

### Experiencia del usuario: abstracción total de la concurrencia

El usuario **NO gestiona la concurrencia directamente ni debe preocuparse por ella**. El usuario no necesita calcular cuántos Sub-Egos instanciar o poner a correr en simultáneo; Ego y el Execution Manager deciden el grado de paralelismo adecuado basándose en la naturaleza del trabajo, el contexto de ejecución y las restricciones del entorno.

### Separación de capas: Arquitectura vs. Planes comerciales

Los límites comerciales y los límites arquitectónicos pertenecen a **capas completamente desacopladas**:
- A nivel de **arquitectura**, Ego está diseñado para soportar concurrencia escalable y dinámica sin techos rígidos conceptuales.
- A nivel de **planes comerciales**, el producto puede definir escalones de servicio o cuotas (por ejemplo, límites en concurrencia simultánea o asignación mensual de cómputo), pero estas son políticas de empaquetado de negocio, no una limitación intrínseca del sistema de agentes.

### Evolución temporal de la concurrencia

El modelo de concurrencia sigue una ruta de maduración planificada a través de las fases del roadmap:

1. **P0 (Entorno mínimo funcional):** Límite técnico provisional bajo (~3 Sub-Egos concurrentes simultáneos). Este tope de 3 es **exclusivamente una restricción técnica transitoria de P0** para asegurar estabilidad del runtime, control estricto de costes y simplicidad operativa durante la fase inicial. **No es una propiedad permanente del producto**.
2. **P1 / P2 (Planificación dinámica consciente de recursos):** El Execution Manager introduce *resource-aware scheduling* dinámico, ajustando el número de Sub-Egos concurrentes en tiempo real según telemetría de recursos, prioridad de colas y presupuesto.
3. **Fase de Madurez (Auto-scheduling completo):** Programación y despacho totalmente autónomos (*auto-scheduling*), adaptativos por proyecto, sensibles al plan comercial del usuario y con capacidad de ajuste fino mediante políticas configurables para organizaciones y usuarios avanzados.


## Capa de Inteligencia de Decisiones (Decision Intelligence Layer)
Ego no depende arquitectónicamente de un modelo específico de decisiones; depende de una abstracción transversal: la **Decision Intelligence Layer**.

Esta capa es una capacidad transversal (no un departamento ni un agente aislado) responsable de todas las operaciones estructuradas de decisión y evaluación rápida del sistema:
- **Operaciones cubiertas:** Clasificar intenciones, calcular puntuaciones (scoring), enrutar flujos (routing), extraer datos estructurados, evaluar completitud, seleccionar especialistas, validar precondiciones, recomendar acciones, detectar anomalías, moderar contenidos y realizar triage operativo.

### Arquitectura de decisión desacoplada
```
Ego Core / Meta-Ego
        │
        ▼
Decision Intelligence Layer
        │
        ▼
  Decision Router
   ├── [1] Reglas determinísticas (patrones, código TS, heurísticas — <1ms, coste $0)
   ├── [2] Modelos especializados de decisión (ej. Jev de TypeSafe — 70-500ms, tipado, ultrabajo coste)
   ├── [3] LLMs con Structured Output / Tool Calling (modelos generales con salida JSON tipada)
   └── [4] Modelos locales (Ollama/Llama para operación sin conexión / offline-first)
```

### Principios rectores de la capa de decisiones
- **"Ego no depende de un modelo específico. Depende de capacidades de inteligencia. Los proveedores y modelos son intercambiables."**
- **"Jev puede desaparecer y la arquitectura de Ego no debería cambiar."**

### El rol de Jev en la arquitectura
Jev es un modelo externo desarrollado por TypeSafe AI (*System One Model*), **no un producto ni componente propietario de Ego**. En la arquitectura de Ego, Jev actúa exclusivamente como **uno de los posibles proveedores** integrados detrás del Decision Router, nunca como una dependencia monolítica, obligatoria o indispensable.

### Cascada y resiliencia (Fallback)
El Decision Router implementa una cascada de decisión jerárquica con tolerancia a fallos garantizada:
1. **Reglas determinísticas:** Evaluación preliminar en código nativo (patrones de texto, entidades conocidas, reglas de gobernanza; coste cero).
2. **Modelos de decisión especializados:** Invocación de modelos como Jev cuando hay conectividad y se requiere clasificación rápida tipada (`choice`, `score`, `yes-no`, hasta 255 opciones en paralelo sin degradación por contexto).
3. **LLM con Structured Output / Modelos Locales:** Si el proveedor especializado no está disponible, falla por timeout o el sistema opera sin conexión (offline-first), la petición se degrada de forma transparente hacia LLMs con esquema estructurado tipado o modelos locales en Ollama.

Es posible además combinar los enfoques: reglas deterministas para prefiltrado + modelos de decisión para scoring y priorización + LLMs para comprensión semántica profunda.

## Sistema de Enrutamiento de Modelos (Model Router) y Multi-proveedor
Ego adopta una arquitectura de modelos **multi-proveedor y agnóstica desde P0**.

Principio rector:
> **"Ego debe depender de capacidades de inteligencia, no de proveedores específicos."**

### Arquitectura de capas de modelos
```
Ego Agent Loop / Meta-Ego
            │
            ▼
   Ego Model Interface (Abstracción propia de Ego)
            │
            ▼
       Model Router (Selección por capacidades y políticas)
            │
 ┌──────────┼──────────────────────┬──────────────────────┐
 ▼          ▼                      ▼                      ▼
Vercel AI SDK Adapter    Direct API Adapters    Local Adapters (Ollama)    Custom Provider Adapters
(Adaptador de integración)  (Endpoints nativos)    (LM Studio, llama.cpp)     (OpenAI-compatible)
```

- **Ego Model Interface:** Abstracción propietaria de Ego que define los contratos de invocación, streaming, llamada a herramientas (`tool_calling`) y estructuración de respuestas, garantizando total independencia de librerías externas.
- **Vercel AI SDK como adaptador:** Vercel AI SDK (versión agnóstica, alineada con AI SDK 7) se utiliza **exclusivamente como un adaptador técnico de integración**, no como la arquitectura del producto. Si el adaptador cambia, evoluciona o es sustituido, la lógica y contratos cognitivos de Ego permanecen intactos.

### Criterios de selección basados en capacidades (*Capability-based Routing*)
El Model Router selecciona dinámicamente el modelo óptimo evaluando:
1. **Capacidades requeridas por la tarea:**
   - Modalidad: `text`, `vision`, `audio`.
   - Habilidades funcionales: `tool_calling`, `structured_output`, `reasoning.high` / `reasoning.low`, `code_generation`, `embeddings`, `streaming`.
   - Roles funcionales asignados: *Orchestrator/Director*, *Supervisor/Monitor*, *Planner*, *Operator/Executor*, *Tool Connector*, *Evaluator/Critic*, *Researcher*, *Memory/Context*, *UI/Interface*.
2. **Dimensiones operativas y de gobierno:**
   - **Costo:** Balance entre coste por millón de tokens y presupuesto asignado (`budget`).
   - **Latencia:** Respuestas inmediatas en UI vs. procesamiento asíncrono en segundo plano.
   - **Disponibilidad y cuotas:** Monitorización de rate limits (RPM/TPM) y fallbacks automáticos ante sobrecargas o caídas (ej. de Claude Sonnet a GPT-4o o DeepSeek).
   - **Privacidad y soberanía de datos:** Priorización de ejecución offline-first en modelos locales (Ollama/Llama) para datos sensibles o sin conectividad.
   - **Preferencias del usuario y BYOK:** Respeto de claves de API provistas por el usuario y límites configurados en su AI Wallet.

### Tres niveles de soporte de proveedores
1. **Proveedores Nativos:** Integraciones optimizadas y mantenidas directamente por Ego para los principales ecosistemas (OpenAI, Anthropic, Google Gemini, Ollama, xAI).
2. **Proveedores OpenAI-Compatible:** Soporte genérico para cualquier servidor o proveedor que implemente el protocolo estándar de OpenAI (LM Studio, vLLM, llama.cpp, Mistral, Groq, DeepSeek, etc.).
3. **Custom Providers:** Módulos de terceros o extensiones privadas que implementan formalmente el contrato `EgoModelProvider`.

### Observabilidad y telemetría de modelos
Cada turno y llamada a través del Model Router registra métricas exhaustivas en `gov/audit` y `metrics/`:
- Proveedor y modelo seleccionado
- Tarea y Sub-Ego solicitante
- Conteo de tokens de entrada y salida
- Coste financiero imputado
- Latencia y tiempo de respuesta
- Errores, reintentos y activaciones de fallback ejecutadas

## Gobernanza
Todos los Sub-Egos deben registrar sus manifiestos. El control de acceso (ACL) se aplica por namespace. El registro de gobernanza/auditoría (gov/audit) es de solo adición (append-only) y existe un "kill switch" centralizado para detener Sub-Egos o el sistema en caso necesario.

## Comportamiento proactivo
Los Sub-Egos están diseñados para ser proactivos. Pueden:
- Recomendar, analizar y opinar sin que se les pida.
- Ofrecer mejoras de código o procesos.
- Reportar estado autónomamente y colaborar dentro del sistema de coordinación de Ego.
- Hablar e intercambiar contexto con otros Sub-Egos a través del Orchestration Bus.
- Participar en conversaciones cuando se menciona su área de dominio.

## Presencia y visibilidad
**"Un Sub-Ego es una entidad cognitiva, no una unidad de UI."** Su existencia e inteligencia no implican que deba contar con una pantalla o sección visual permanente en la aplicación.

### Distinción fundamental: Memoria ≠ Interfaz
Un Sub-Ego puede mantener memoria a largo plazo, contexto histórico acumulado, reglas aprendidas y estado persistente en VantaDB sin necesidad de tener una representación visual continua en pantalla. La persistencia cognitiva es independiente de la persistencia de interfaz.

### Niveles de presencia
La relación entre un Sub-Ego y la interfaz se modela mediante cuatro niveles:

1. **Invisible / Interno:** Actúa en segundo plano como especialista de apoyo para Ego u otros Sub-Egos (por ejemplo, validaciones de seguridad, análisis de métricas o indexación contextual). No posee presencia visual propia directa.
2. **Contextual:** Se manifiesta temporalmente en el canvas o chat cuando su experiencia es requerida por la tarea en curso. Al terminar el flujo, su interfaz se desvanece o repliega.
3. **Persistente:** Mantiene un workspace o vista activa dedicada porque gestiona datos continuos, monitoreo en tiempo real o herramientas de uso prolongado.
4. **Acceso directo (Pinned):** El usuario lo fija de manera explícita para acceso rápido. Ego analiza la frecuencia de interacción y puede proponer al usuario anclar Sub-Egos utilizados recurrentemente.

### Control y configuración del usuario
El usuario tiene soberanía total sobre la visibilidad y personalización de cada Sub-Ego:
- **Fijar / Desanclar (Pin/Unpin):** Destacar accesos directos en la interfaz según preferencia.
- **Ocultar / Mostrar:** Decidir si un Sub-Ego opera de forma invisible o visible.
- **Identidad visual:** Personalizar nombre descriptivo e icono representativo.
- **Permisos y herramientas:** Asignar o revocar acceso a herramientas y namespaces de VantaDB.
- **Acciones automáticas (Auto-action):** Configurar el grado de autonomía y si requiere aprobación previa.

### Gestión centralizada
Toda la configuración de Sub-Egos se gestiona desde un panel centralizado de administración, evitando dispersar controles en menús laterales o barras de navegación fragmentadas.

## Terminología
- **Sub-Ego**: El término de producto/cara al usuario para la entidad (preconfigurada o personalizada).
- **Agente / Agent Runtime**: El concepto técnico subyacente y la capa de ejecución (ej. `agent_id`).
- **Alter Ego**: Término de marketing (no usado en arquitectura interna).
