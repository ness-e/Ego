| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente vigente de términos |
| Owner | ness-e |
| Fecha | 2026-10-06 |

# Glosario de Ego

- **Ego**: La aplicación completa; el Sistema Operativo Cognitivo en su totalidad.
- **Sistema Operativo Cognitivo (SOC)**: Capa de software que organiza y coordina recursos para que la IA entienda, recuerde, razone, planifique y actúe sobre un proyecto de manera continua. Gestiona contexto, memoria, conocimiento, Sub-Egos, objetivos, tareas, herramientas, decisiones y acciones.
- **Dominio Funcional**: Área de responsabilidad que Ego puede cubrir (Estrategia, Producto, Ingeniería, Marketing, etc.). No se trata de un agente fijo, sino de un espacio de competencia.
- **Plantilla de Especialista**: Definición base (responsabilidades, capacidades, conocimiento, reglas, herramientas y comportamiento) para una función de un Sub-Ego.
- **Sub-Ego**: Entidad inteligente especializada que opera dentro de Ego. Todo especialista inteligente dentro de Ego es un Sub-Ego. Los Sub-Egos predefinidos y los personalizados son la misma entidad; la diferencia es su origen y configuración inicial. Ego proporciona un conjunto inicial de Sub-Egos especializados y permite crear y personalizar otros. Técnicamente, cada Sub-Ego se ejecuta como una instancia de agente.
- **Sub-Egos existentes**: Especialistas creados, configurados o disponibles dentro del proyecto.
- **Sub-Egos disponibles**: Especialistas que pueden recibir trabajo en un momento dado.
- **Sub-Egos concurrentes**: Especialistas ejecutando trabajo simultáneamente. El número es administrado dinámicamente por el Execution Manager.
- **Agente / Instancia de Agente**: Término técnico e interno en el código para referirse a lo que el producto llama Sub-Ego. Representa la instancia en ejecución del especialista de IA.
- **Alter Ego**: Concepto de marketing y narrativo para referirse a los Sub-Egos. No es terminología oficial del producto.
- **Capacidad Transversal**: Capacidad funcional que cruza y sirve a todos los dominios (ej. Memoria, Investigación, Analítica, Gobernanza, Voz, Journal, Decision Intelligence).
- **Meta-Ego**: Capa de orquestación y coordinación central de Ego. No es un Sub-Ego más, sino el componente responsable de interpretar la intención del usuario, coordinar Sub-Egos, gestionar especialistas temporales y mantener la coherencia del proyecto. Término interno de arquitectura; el usuario interactúa simplemente con Ego.
- **Execution Manager**: Componente del sistema de orquestación que controla cuántos Sub-Egos pueden ejecutar trabajo simultáneamente, basándose en recursos, presupuesto, prioridad, complejidad y políticas del proyecto.
- **Orchestration Bus**: Capa de infraestructura interna que gestiona la comunicación entre Sub-Egos, proporcionando trazabilidad, permisos, enrutamiento, contexto, prioridad, presupuesto y auditoría.
- **Memoria compartida del proyecto**: Conocimiento común del proyecto accesible por todos los Sub-Egos según sus permisos. Incluye objetivos, decisiones, historial, entidades, relaciones, hechos, documentos, tareas, eventos y estado operativo.
- **Catálogo de Capacidades**: Conjunto inicial extensible de dominios funcionales y plantillas de especialistas que el usuario puede instanciar.
- **Workspace Dinámico**: Entorno de trabajo principal, fluido y componible, que combina Chat y Canvas para adaptarse a la tarea actual.
- **Principios Innegociables**: Las 10 propiedades fundamentales del sistema que definen la identidad de Ego. Cualquier decisión que las viole requiere una revisión explícita de producto.
- **Jerarquía Canónica**: Sistema de 12 niveles de autoridad que establece la precedencia entre decisiones de producto, capacidades, arquitectura, diseño e implementación.
- **Background Activity / Proactividad**: Capacidad de Ego para ejecutar trabajo persistente en segundo plano y comunicar resultados sin requerir interacción constante del usuario. Reemplaza el concepto anterior de "Dots" como concepto arquitectónico.
- **UI Runtime**: Sistema de componentes declarativos capaz de renderizar interfaces de usuario a partir de esquemas producidos por los Sub-Egos.
- **Canvas**: Área principal de trabajo del Workspace Dinámico donde los Sub-Egos construyen y exponen interfaces interactivas y declarativas.
- **Dots**: Concepto visual anterior para representar actividad en segundo plano. Reemplazado por el concepto más amplio de Background Activity & Proactivity.
- **Decision Intelligence Layer**: Capa transversal de Ego para clasificación, evaluación, scoring, routing, extracción, validación y otras decisiones estructuradas. Puede utilizar modelos especializados (como Jev de TypeSafe), LLMs con structured output, modelos locales o reglas determinísticas.
- **Decision Router**: Componente de enrutamiento dentro de la Decision Intelligence Layer que canaliza las decisiones hacia reglas, modelos especializados o LLMs, garantizando fallbacks automáticos.
- **Jev**: Modelo de decisiones estructuradas de TypeSafe (System One Model). Uno de los posibles proveedores de la Decision Intelligence Layer de Ego, no una dependencia obligatoria.
- **VantaDB**: Motor de memoria en Rust (embebido) optimizado para Ego, combinando búsqueda vectorial, grafos de conocimiento y control de caducidad (TTL).
- **EgoMemoryAdapter**: Capa única de abstracción y comunicación sobre VantaDB.
- **Namespace**: Prefijo de dominio o subespacio que organiza lógicamente los hechos dentro de VantaDB.
- **Hecho Atómico**: La unidad mínima de información estructurada almacenada en un namespace de memoria.
- **Cuarentena**: Estado en el que se encuentra un hecho pendiente de validación o aprobación por parte de un humano (gobernanza).
- **Supersede**: Operación de reemplazo atómico y versionado de un hecho obsoleto por uno nuevo.
- **IQL**: Lenguaje de consulta de grafos propio de VantaDB.
- **SubEgoManifest**: Contrato Zod que define la configuración de un Sub-Ego.
- **Gateway**: Punto de entrada principal en la arquitectura que normaliza y encamina todos los eventos del sistema hacia un `EgoEvent`.
- **Proyecto Vivo**: El objeto principal y persistente sobre el que Ego opera; el estado general e historia de los esfuerzos del usuario.
- **Enrutamiento de Modelos**: Sistema que selecciona de forma dinámica el mejor modelo de IA (remoto o local) para una tarea basándose en capacidades requeridas y roles funcionales (ej. Planner, Orchestrator, Supervisor).
- **Ego Model Interface**: Abstracción propia e independiente de Ego que define los contratos de interacción con modelos de IA, desacoplando el núcleo de cualquier proveedor o SDK externo.
- **Model Router**: Selecciona modelos por capacidades requeridas (texto, visión, audio, tool calling, structured output, reasoning, embeddings, código, streaming), costo, latencia, disponibilidad, privacidad, presupuesto y políticas del usuario. Soporta proveedores nativos, OpenAI-compatible, locales y personalizados. Vercel AI SDK se utiliza como adaptador de integración.
- **AI SDK**: Capa de adaptadores e integración para interactuar con proveedores de modelos (actualmente AI SDK v7 de Vercel). En Ego funciona exclusivamente como adaptador técnico de integración, no como la arquitectura del sistema, la cual reside en Ego Model Interface y Model Router.
- **AI Wallet / Presupuesto de IA**: Sistema de gestión de créditos y presupuesto de consumo de modelos de IA por usuario.
- **BYOK (Bring Your Own Key)**: Capacidad del usuario de conectar sus propias API keys de proveedores de IA.
- **Entitlements**: Capa que define los derechos y capacidades de una cuenta, desacoplada del proveedor de facturación.
- **Ego Cloud**: Infraestructura gestionada por Ego para usuarios que no quieren auto-hospedar.
- **MoR (Merchant of Record)**: Proveedor que gestiona facturación, impuestos y pagos (ej: Paddle, Lemon Squeezy).
- **MCP Client**: Capacidad de Ego para conectarse a servidores MCP externos y consumir herramientas, recursos y prompts de servicios de terceros.
- **MCP Server**: Capacidad de Ego para exponer su contexto, memoria, conocimiento, tareas y estado como recursos accesibles para aplicaciones externas de IA.
- **Integration Catalog / Catálogo de Integraciones**: Registro de integraciones disponibles con metadatos de tipo, proveedor, transporte, autenticación, permisos, estado y nivel de confianza (Official, Verified, Community, Custom, Experimental).
- **Activación Contextual / Lazy Activation**: Mecanismo por el cual las capacidades y Sub-Egos de Ego existen en un catálogo y se instancian únicamente cuando la intención del usuario lo amerita. Permite tener 0 Sub-Egos visibles en estado base.
- **Canvas Causal**: Capacidad avanzada de observabilidad, auditoría visual y razonamiento causal profundo proyectada para post-P0 (P2). En P0 se reemplaza por Explicabilidad Contextual bajo demanda.
- **Especialista Temporal**: Sub-Ego coordinado internamente para resolver una tarea ad-hoc, invisible por defecto al usuario. Si una combinación temporal se vuelve recurrente, Ego propone promoverla a Sub-Ego persistente.
- **Explicabilidad Contextual**: Capacidad transversal de Ego para fundamentar sus decisiones bajo demanda (3 niveles: Usuario, Avanzado, Auditoría) y proactivamente ante acciones sensibles. Reemplaza el Canvas Causal permanente en P0.


