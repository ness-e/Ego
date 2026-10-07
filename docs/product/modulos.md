| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente vigente de definición de módulos |
| Owner | ness-e |
| Fecha | 2026-10-06 |
| Fuente histórica | `../prd/12-11-m-dulos-funcionales.md` (congelado) + Decisiones P3-P11 2026-10-06 |

## Principio
Los módulos **NO son secciones fijas de la aplicación ni departamentos rígidos**. Representan capacidades funcionales que Ego puede proveer. Cada capacidad es responsable de construir su propio workspace dinámicamente cuando es requerido para resolver una tarea. (Ver [Dominios funcionales](../architecture/dominios-funcionales.md)).

## Capacidades P0 — Entorno mínimo funcional
Este es el conjunto de capacidades esenciales que deben estar operativas para el lanzamiento inicial:

- **Memoria y Conocimiento (KB):** Búsqueda híbrida, hechos atómicos (atomic facts), cuarentena de datos, supersede (reemplazo) y deduplicación. Todo impulsado por VantaDB a través del EgoMemoryAdapter.
- **CRM/Ventas mínimo:** Gestión de contactos, oportunidades (deals), relaciones y línea de tiempo (timeline). Basado fuertemente en el motor de grafos.
- **Fábrica de Sub-Egos:** Sistema inteligente de diseño, configuración y ciclo de vida de especialistas (no un simple CRUD). Soporta tres métodos de creación: conversacional (Ego interpreta la intención y diseña la configuración), plantillas predefinidas y configuración manual avanzada. Define cada instancia mediante un `SubEgoManifest` estructurado sujeto a revisión y aprobación explícita del usuario previa a su instanciación. Gestiona la distinción entre Sub-Egos persistentes (con memoria, estado y evolución continua en VantaDB) y especialistas temporales internos (coordinados transparentemente por Ego para tareas puntuales). Integra capacidad de evolución post-creación (sugerencias proactivas de ampliación de capacidades, permisos, división o fusión según patrones de uso), control de acceso (ACL) y aislamiento de estado privado por namespace (con memoria compartida del proyecto accesible según permisos). En P0 rige un límite técnico provisional de hasta 3 Sub-Egos concurrentes simultáneos (restricción transitoria de ingeniería para estabilidad inicial, no una propiedad permanente del producto). A partir de P1+, este mecanismo evoluciona hacia concurrencia dinámica gobernada por el Execution Manager (*resource-aware scheduling*).
- **Gobernanza:** Aprobación humana para acciones sensibles, pista de auditoría inmutable y políticas de seguridad básicas.
- **Explicabilidad contextual:** Capacidad de justificar decisiones bajo demanda (3 niveles: usuario, avanzado, auditoría) y proactivamente antes de acciones con impacto.
- **Workspace dinámico:** Implementación de Chat + Canvas utilizando el esquema de componentes declarativos.
- **Estado dinámico del proyecto:** Pantalla de inicio dinámica que muestra el estado actual del proyecto, acciones pendientes y elementos que requieren atención. Generado por Ego utilizando los Sub-Egos y el sistema de componentes declarativos.
- **Background Activity:** Visualización en tiempo real del estado de tareas y sistema.
- **Exportación/Importación:** Manejo de snapshots `.vdbdump` y mecanismos de restauración segura.
- **Modo construcción básico:** Capacidad para que Ego interactúe con código, archivos y tareas fundamentales de desarrollo (software/coding).

## Capacidades P1 — Valor productivo
- Concurrencia dinámica de Sub-Egos: Programación adaptativa (*resource-aware scheduling*) gobernada por el Execution Manager según recursos, presupuesto y prioridad.
- Diario (Journal)
- QA y Testing automatizado para desarrollo
- Soporte al cliente
- Gobernanza avanzada (Decision Intelligence / Jev)
- Capacidades extendidas de ingeniería de software

## Capacidades P2 — Escalar
- E-commerce
- Investigación profunda (Research)
- Interacciones por voz
- Marketing y campañas
- Analíticas avanzadas
- Canvas Causal: Observabilidad avanzada, auditoría visual y razonamiento causal profundo (evolución post-P0 de la explicabilidad contextual).
- Gobernanza total
- Sub-Egos proactivos
- Orquestación de procesos complejos

## Capacidades posteriores
Los dominios restantes se irán activando bajo demanda, escalando orgánicamente a medida que las necesidades estructurales de los proyectos de los usuarios evolucionen.

## Tabla capacidad → dominio → primitiva VantaDB

| Capacidad | Dominio (Funcional) | Primitiva VantaDB Destacada |
| --- | --- | --- |
| Memoria / Conocimiento | Base de conocimiento | `hybrid search` (RRF), `quarantine`, `supersede`, `deduplication` |
| Contexto adaptativo | Cognición | `context_assemble` (compresión multinivel), `memory_recall` (auto-recall con scopes) |
| Consolidación cognitiva | Cognición | `dream_consolidate` (fusión/dedup/normalización durante inactividad) |
| Tareas resilientes | Ejecución | `task_checkpoint` (reanudación tras crash, MEMG-20) |
| Retroalimentación | Cognición | `memory_reinforce` (+0.05 si usado / -0.10 si corregido) |
| Conocimiento de código | Ingeniería | `code_*` (callers/callees/impacto, inteligencia de código) |
| Grafo y GraphRAG | Base de conocimiento | `graph` (BFS/DFS/PageRank), `graphrag_search` (seed→expand→weight→text) |
| Resolución temporal | Cognición | Resolución determinista ("ayer por la tarde" → Unix-ms, español nativo) |
| Skills versionadas | Configuración | `SkillStore` (versionado + bloqueo optimista para Sub-Egos) |
| Escenas episódicas | Cognición | `scene_*` (agrupación L2 con heat decay) |
| CRM / Ventas | Relacional | `graph`, `searchMulti` |
| Fábrica de Sub-Egos | Configuración del sistema | Documentos JSON estructurados, `TTL` |
| Gobernanza | Seguridad y Auditoría | Registros inmutables (append-only), WAL SHA-256, purga criptográfica VER-02 |
| Explicabilidad contextual | Gobernanza / Cognición | Citas a registros (`gov/audit`), referencias de namespaces, grafo causal |
| Analíticas | Métricas | Agregación, time-series, bitemporalidad (`AS OF`) |

## Principio de evolución
Las capacidades del sistema no crecen simplemente agregando más Sub-Egos de forma desordenada. Estas evolucionan mediante la estructuración de: **dominios + capacidades transversales + Sub-Egos especializados + herramientas + flujos de trabajo + memoria compartida + automatización**.
