# Arquitectura Unificada de Ego — Doctrina Técnica Canónica
### Síntesis Soberana de Ego (Cognitive OS), VantaDB (Sustrato Cognitivo), Hermes Agent y OpenClaw (Fuentes de Patrones)

| Campo | Valor |
| --- | --- |
| Estado | Canónico e Inmutable — Doctrina Rectora de Arquitectura |
| Nivel Jerárquico | Nivel 0 / Nivel 1 (Jerarquía Canónica `docs/jerarquia-canonica.md`) |
| Owner | ness-e / Principal Systems Engineer |
| Fecha | 2026-10-07 |
| Precedencia | Prevalece sobre cualquier análisis previo de repositorios externos |

---

## 1. Dictamen Ejecutivo

Los tres proyectos analizados cumplen funciones distintas, soberanas y complementarias dentro del ecosistema:

```text
VantaDB
=
Cognitive Memory / Knowledge Engine (First-Party Substrate)

Hermes Agent
=
Reference source for Desktop UX, Skills, Code Execution
and proven agentic interaction patterns

OpenClaw
=
Reference source for Runtime, Execution Governance,
Resilience and TypeScript-native agent infrastructure

Coucou
=
Reference source for Execution Observability, Attention Management,
Non-blocking HITL Ingress, ChangeSets and Safe Config Mutations

Ego
=
Cognitive Operating System (Orquestador Soberano)
```

> ### Principio Rector de Soberanía
> **Ego no debe convertirse en una copia de Hermes, OpenClaw ni Coucou, y VantaDB no debe convertirse en una parte inseparable de Ego.**
>
> **Ego proporciona el sistema de coordinación que combina memoria, modelos, Sub-Egos, herramientas, ejecución, gobernanza y experiencia de usuario, utilizando VantaDB como su principal substrate de memoria y conocimiento, y aprovechando patrones seleccionados de Hermes, OpenClaw y Coucou bajo estricto filtrado.**

* **VantaDB** ya proporciona una superficie madura de almacenamiento, retrieval híbrido, grafos, GraphRAG, temporalidad, cuarentena, cifrado, snapshots, export/import y capacidades cognitivas avanzadas.
* **Hermes Agent** aporta patrones de experiencia desktop en Electron/React, `@assistant-ui/react`, generación y auditoría AST de skills, pipelines de ejecución de código y background activity.
* **OpenClaw** aporta patrones de gobernanza de ejecución en TypeScript, admisión inmutable de runs, cancelación mediante `AbortSignal`, exclusión mutua de sesiones, resiliencia ante tool-calls rotos, workers dedicados y seguridad estricta de red (anti-SSRF).
* **Coucou** aporta patrones de normalización de eventos en el borde, comunicación no bloqueante con ACK para HITL, correlación criptográfica de acciones autorizadas (`ActionIdentity`), desacoplamiento en 7 estados, motor de diffs (`ChangeSetService`) y mutaciones atómicas a prueba de fallos (`SafeConfigMutationService`).

---

## 2. Separación Canónica de Responsabilidades

### VantaDB (Proyecto First-Party Independiente)
VantaDB es un producto de infraestructura independiente bajo licencia Apache 2.0. Su responsabilidad está estrictamente acotada a la persistencia y cognición de datos:

```text
Persistence · Retrieval · Memory · Knowledge · Graph · GraphRAG · Context · Temporal ·
Consolidation · Embeddings · Task Memory · Checkpoints · Provenance · Snapshots · Export/Import
```

El motor nativo en Rust implementa Fjall LSM, HNSW, BM25, RRF, MMR, grafos, GraphRAG, IQL, bitemporalidad (`valid_at`, `recorded_at`), supersesión, cuarentena, cifrado y snapshots. Su capa `vanta-memory` aporta Dream Consolidation, Context Engine, Micro-Memory-Documents, checkpoints, reinforcement Hebbiano y resolución temporal.

#### ❌ VantaDB NO debe encargarse de:
```text
Sub-Egos · Model Router · Tool Registry · Orchestration · Workspace UX · Billing ·
User Interaction · Product Domains · Global Scheduling de Ego
```

---

## 3. Ego (The Cognitive Operating System)

Ego es el Sistema Operativo Cognitivo que dota de propósito, gobernanza y contexto a la interacción:

```text
Intent · Context Orchestration · Sub-Egos · Model Router · Decision Intelligence ·
Tool Registry · Execution Manager · Tasks · Events · Permissions · Approvals ·
Integrations · Dynamic Workspace · Project State · Proactivity · User Experience
```

```text
Ego
 ├── Cognitive Runtime
 ├── Sub-Egos
 ├── Models
 ├── Decision Intelligence
 ├── Tools
 ├── Execution
 ├── Governance
 ├── Workspace
 └── Project Memory
        └── VantaDB
```

---

## 4. Hermes Agent (Fuente de Patrones de Desktop y Ejecución)

Hermes se utiliza **exclusivamente como fuente de patrones y componentes reutilizables**, jamás como arquitectura base de Ego.

El protocolo de extracción condicionada rige cualquier incorporación:
```text
Patrón externo
      ↓
¿Capacidad ya definida en Ego?
      ↓
Sí → Mejorar / Adaptar a TypeScript y Tailwind
No → Formular RFC + Evaluación Crítica (Utilidad, Trade-offs, FMEA)
```

Hermes aporta principalmente: Desktop UI, patrones `@assistant-ui/react`, render de artefactos, directivas interactivas HITL, hardening de entorno Windows en Electron, model picker, gestión de estado de ventana, especificación de skills (`agentskills.io`), aislamiento con Git Worktrees, kernel de ejecución zero-context y salvaguarda mediante snapshots previos a escrituras destructivas.

---

## 5. OpenClaw (Fuente de Patrones de Runtime TypeScript y Gobernanza)

OpenClaw se utiliza como referencia de excelencia para el **runtime en TypeScript y la gobernanza de ejecución**.

Su valor para Ego radica en:
* **Admisión inmutable de ejecuciones (`AdmittedRunContext`):** Tokens de contexto inalterables con scopes de autoridad explícitos.
* **Cancelación cooperativa nativa:** Propagación en cascada de `AbortSignal` a herramientas y subprocesos.
* **Consistencia de sesión:** Locks atómicos en memoria para exclusión mutua de escrituras y ventanas deslizantes de lectura para transcripciones grandes.
* **Resiliencia de herramientas:** Auto-reparación determinista de tool calls malformados (`tool-call-repair`).
* **Seguridad de red:** Políticas anti-SSRF deterministas (`net-policy`).
* **Aislamiento en hilos secundarios:** `worker-runtime` para no bloquear el bucle de eventos de Electron.

---

## 6. Qué se Adopta de Hermes

### Mejoras Directas (Capacidades ya definidas en Ego)
1. `artifact-card.tsx` → Tarjetas interactivas de artefactos vinculadas al Dynamic Workspace.
2. `markdown-text.tsx` → Pipeline AST sanitizado (con la corrección semántica estipulada en §9).
3. `message-render-boundary.tsx` → Aislamiento de fallos de renderizado por mensaje individual.
4. `ask-directive.tsx` → Formularios interactivos para confirmación HITL de herramientas.
5. `windows-user-env.ts` → Normalización y herencia del `PATH` de Windows al inicio de Electron.
6. `window-state.ts` → Restauración sin parpadeos de dimensiones y maximización de ventana.
7. `model-picker.tsx` → Selector desacoplado de modelos para el `ModelRouter`.
8. `session-picker.tsx` → Navegador lateral de sesiones con filtrado rápido.
9. `memory_provider.py` → Indicador determinista de recall mental (glifo 🧠 `RecallStatus`).

### Nuevas Capacidades Aprobadas (RFCs)
1. **Git Worktree Isolation (RFC-01):** Ramas temporales de git para que Sub-Egos de ingeniería experimenten sin alterar el directorio del usuario.
2. **Code Execution Kernel (RFC-02):** Encadenamiento programático de herramientas en un solo turno de ejecución.
3. **Skill AST Auditing (RFC-03):** Linter de seguridad sobre el árbol de sintaxis abstracta para validar herramientas autogeneradas.
4. **Destructive-Write Snapshots (RFC-04):** Checkpoints automáticos en cuarentena previos a escrituras destructivas en disco.

---

## 7. Qué se Adopta de OpenClaw

### Mejoras Directas
1. `AdmittedRunContext` → Validación previa y token inmutable antes de procesar cualquier ejecución.
2. `AbortSignal Cascading` → Detención limpia e inmediata de ejecuciones al abortar el usuario.
3. `Session Locks` → Exclusión mutua que impide condiciones de carrera en una misma sesión.
4. `Transcript Sliding Windows` → Paginación eficiente del historial de chat en memoria.
5. `Anti-SSRF Network Policy` → Bloqueo estricto de accesos a `localhost`, redes privadas y metadatos cloud.
6. `Mermaid Renderer` → Renderizado reactivo y sanitizado de diagramas de arquitectura.

### Nuevas Capacidades Aprobadas (RFCs)
1. **Tool-Call Auto Repair (RFC-OCLW-01):** Reparación determinista de JSON truncado o comillas rotas sin malgastar turnos del LLM.
2. **Diff / Revision Graph (RFC-OCLW-02):** Grafo acumulativo de revisiones y diffs para alimentar el Canvas y auditoría.
3. **Worker Runtime (RFC-OCLW-03):** Delegación de indexación, parsing y computación pesada a `worker_threads`.

---

## 8. Qué NO se Adopta Categóricamente

### Descartes de Hermes
* ❌ **Backend en Python (`FastAPI`, `uv`, subprocess):** Ego ejecuta su runtime 100% en Node.js 22 in-process.
* ❌ **Persistencia en SQLite:** Se sustituye íntegramente por `NativeVantaDB`.
* ❌ **JSON-RPC sobre HTTP/WS interno:** Se utiliza el canal IPC fuertemente tipado de Electron.

### Descartes de OpenClaw
* ❌ **Persistencia en SQLite / Kysely:** Se sustituye por VantaDB.
* ❌ **Gateway Headless y Web Control UI como interfaz principal:** Ego es una aplicación desktop nativa en Electron.
* ❌ **Conectores Omnicanal (20+ redes de mensajería) en P0:** Postergados formalmente a Fase 09 para no dispersar el desarrollo del Golden Path de escritorio.

---

## 9. Corrección Canónica sobre el Rendering de Reasoning

> ### Directriz de UX Innegociable
> Aunque la extracción inicial de componentes de Hermes mencionaba bloques para renderizar *chain-of-thought*, **Ego NO adopta la exposición del razonamiento interno crudo (raw internal reasoning) como requisito de UX**.

La arquitectura de Ego se fundamenta en **Explicabilidad, Evidencia y Auditoría (Explainability / Evidence / Audit)**:

```text
Why? (Explicabilidad Contextual)
  ↓
Evidence & Sources (Fuentes consultadas en VantaDB)
Context Injected (Recuerdos y fragmentos recuperados)
Sub-Egos Involved (Especialistas participantes)
Tools & Arguments (Herramientas despachadas)
Actions Executed (Impacto en el sistema)
Uncertainty / Confidence (Puntuación de certeza)
```

Por tanto:
* El componente visual extraído de Hermes (`markdown-text.tsx` / accordion colapsable) **se conserva únicamente como contenedor de UI**.
* Su semántica se redirige a mostrar el **desglose causal de la decisión ("¿Por qué?")**, accesible bajo demanda y nunca como un volcado verboso de pensamientos no verificables.

---

## 10. Integración Canónica de VantaDB en P0

VantaDB no es una integración externa ni un conector de terceros; es **infraestructura first-party de Ego**.

En **P0 (Alpha)** se utiliza la **arquitectura híbrida**:

```text
Electron Main Process
│
└── Ego Memory Adapter (Gateway Único)
      │
      ├── NativeVantaDB (in-process via napi-rs)
      │     └── Storage / Hybrid Retrieval / Graph / Namespaces
      │
      └── Internal MCP Client (subprocess stdio)
            └── vantadb-mcp
                  └── vanta-memory (Recall / Context Engine / Dream / Checkpoints)
```

Esta arquitectura permite utilizar `NativeVantaDB` a latencia cero de memoria para operaciones frecuentes, complementándolo con `vantadb-mcp` para capacidades cognitivas avanzadas de `vanta-memory` que aún no cuentan con bindings directos a Node.js.

---

## 11. Integración Nativa Profunda en P1

En **P1**, la arquitectura evoluciona hacia la integración nativa completa:

```text
Electron Main Process
│
└── Ego Memory Adapter
      │
      └── VantaCognitiveAPI (Fachada Nativa Estable)
            │
            └── napi-rs (Bindings de Rust compilados)
                  │
                  └── VantaDB Rust Core
                        ├── Storage (Fjall LSM)
                        ├── Retrieval (HNSW + BM25 RRF)
                        ├── Graph & GraphRAG
                        ├── vanta-memory (Context Engine)
                        ├── Dream Consolidation
                        ├── Temporal Resolution
                        └── Task Checkpoints
```

La limitación actual en P0 radica exclusivamente en la exposición de bindings a Node.js, no en la capacidad del motor de Rust. En P1 se elimina la sobrecarga de serialización stdio del MCP interno.

---

## 12. Fachada VantaCognitiveAPI

VantaDB debe exponer hacia Ego una fachada de alto nivel, estable y cohesiva:

```ts
export interface VantaCognitiveAPI {
  // Almacenamiento & CRUD
  put(doc: MemoryDocument): Promise<void>;
  get(id: string): Promise<MemoryDocument | null>;
  delete(id: string): Promise<void>;

  // Recuperación & Búsqueda
  search(query: string, opts?: SearchOptions): Promise<SearchResult[]>;
  hybridSearch(query: string, opts?: HybridOptions): Promise<SearchResult[]>;
  mmrSearch(query: string, opts?: MmrOptions): Promise<SearchResult[]>;
  recall(contextQuery: string, limit?: number): Promise<RecallResult>;

  // Context Engine
  assembleContext(scope: ContextScope): Promise<AssembledContext>;
  compressContext(context: AssembledContext, maxTokens: number): Promise<CompressedContext>;

  // Grafo de Conocimiento & GraphRAG
  insertNode(node: GraphNode): Promise<void>;
  insertEdge(edge: GraphEdge): Promise<void>;
  traverse(originId: string, depth: number): Promise<GraphTraversal>;
  graphRagSearch(query: string): Promise<GraphRagResult>;

  // Evolución de Memoria
  supersede(oldFactId: string, newFact: MemoryDocument): Promise<void>;
  reinforce(factId: string, deltaWeight: number): Promise<void>;
  consolidate(opts?: ConsolidationOpts): Promise<ConsolidationSummary>;

  // Bitemporalidad
  resolveTemporal(entityId: string, asOf: Date): Promise<EntityState>;

  // Checkpoints de Tareas
  checkpoint(taskId: string, state: TaskState): Promise<string>;
  restoreCheckpoint(checkpointId: string): Promise<TaskState>;

  // Ingesta Masiva
  ingest(documents: DocumentBatch): Promise<IngestSummary>;
  index(namespace: string): Promise<void>;
}
```

> **Directriz de Encapsulación:** VantaDB expone **capacidades cognitivas estables**, no sus detalles internos de bajo nivel ni cientos de funciones desnudas de Rust.

---

## 13. Roadmap de VantaDB Orientado a Ego

### Fase P0 (Consolidación Local & Bindings)
1. Corregir integración de `NativeVantaDB` en Electron Main.
2. Publicación de release estable para Node.js 22.
3. Exposición de GraphRAG en bindings de Node.
4. API de ciclo de vida nativo (`init`, `flush`, `shutdown`).
5. Soporte nativo para operaciones asíncronas y cancelación.
6. Aislamiento formal de namespaces por proyecto (`project_id`).
7. Tolerancia y recuperación automática ante caídas.
8. Exportación e importación versionada (`.vdbdump`).
9. Rutinas de snapshots de directorio consistentes.
10. Compatibilidad estricta con `@electron/rebuild`.
11. Batería de tests de contrato conjunto Ego ↔ VantaDB.
12. Documentación técnica para Node/Electron.

### Fase P1 (Fachada Cognitiva Nativa)
13. Fachada nativa `vanta-memory` vía `napi-rs`.
14. Exposición nativa de `recall()`.
15. Exposición nativa de `assembleContext()`.
16. Ejecución nativa de *Dream Consolidation* en segundo plano.
17. Refuerzo Hebbiano nativo (`reinforce()`).
18. Resolución temporal de estados pasados.
19. Memoria episódica de tareas (`Task Memory`).
20. Checkpoints atómicos de tareas.
21. Interconexión nativa Grafo ↔ Memoria.
22. Búsqueda nativa GraphRAG integrada en recall.
23. API de inteligencia de código local.
24. Indexación incremental de repositorios git.
25. `SkillStore` persistente sobre VantaDB.
26. Metadatos de procedencia y evidencia auditables.
27. Feed de cambios reactivo (*Change Feed*).
28. Gobernanza de políticas de acceso por namespace.

### Fase P2+ (Escalado & Sincronización)
29. Capa de memoria semántica compartida.
30. Multi-writer basado en CRDT.
31. Sincronización multi-dispositivo cifrada.
32. Decaimiento y atenuación de bordes de grafo (*Edge decay*).
33. Evolución cognitiva autónoma de grafos.
34. Soporte opcional para VantaDB Cloud / Sync remoto.

---

## 14. Project Memory como Capacidad Unificada

> **Corrección Conceptual:** `Project Memory` en Ego **jamás debe documentarse como un simple "guardado de conversaciones"**.

Constituye la columna vertebral cognitiva del proyecto:

```text
Project Memory
│
├── Persistent Memory     (Datos inmutables en Fjall LSM)
├── Working Memory        (Contexto activo del turno actual)
├── Task Memory           (Árboles de subtareas y estados intermedios)
├── Semantic Retrieval    (Búsqueda vectorial HNSW ONNX)
├── Lexical Retrieval     (Búsqueda exacta BM25)
├── Hybrid Retrieval      (Fusión RRF + reranking MMR)
├── Graph Context         (Relaciones ontológicas IQL)
├── Temporal Context      (Validez bitemporal valid_at / recorded_at)
├── Context Compression   (Compresión semántica respetando límites)
├── Reinforcement         (Aprendizaje Hebbiano ponderado por éxito)
├── Consolidation         (Dream consolidation fuera de línea)
├── Provenance            (Trazabilidad de origen y autor de cada dato)
├── Verification          (Estados confirmado / cuarentena / contradicho)
└── Supersession          (Reemplazo atómico de hechos obsoletos)
```

---

## 15. Ciclo de Memoria Unificado (`EgoMemoryLifecycle`)

La integración entre el ciclo de interacción de Hermes y la evolución biológica de VantaDB se articula en 7 pasos canónicos:

```text
01. Session Admission        (Validación de token y contexto inmutable)
        ↓
02. Context Recall           (Prefetch federado sobre VantaDB + glifo 🧠 RecallStatus)
        ↓
03. Active Turn              (Generación de modelo y streaming a UI)
        ↓
04. Tool / Sub-Ego Exec      (Ejecución con checkpoints intermedios)
        ↓
05. Post-Turn Sync           (Persistencia inmediata de hechos en Fjall L1)
        ↓
06. Checkpoint / Compaction  (Salvaguarda antes de comprimir contexto)
        ↓
07. Idle Consolidation       (Dream consolidation y refuerzo en reposo)
```

* **Hermes aporta:** El *cómo* se gestiona la memoria alrededor del turno conversacional.
* **VantaDB aporta:** El *dónde* se almacena y *cómo* evoluciona el conocimiento.
* **Ego aporta:** El *cuándo* se activa cada fase y *cómo* se orquesta con el runtime cognitivo.

---

## 16. Sub-Ego Runtime

Los Sub-Egos son **entidades cognitivas autónomas**, no simples pantallas ni plantillas de prompt:

```text
Identity · Soul · Responsibilities · Capabilities · Tools ·
Memory · Permissions · Model · Autonomy · Tasks · Events · Skills
```

Cada Sub-Ego integra:
* Su propio manifiesto de personalidad (`SubEgoSoul`) con tono, temperamento y reglas innegociables específicas de su dominio.
* Aislamiento de memoria privada con acceso compartido al sustrato del proyecto en VantaDB.
* Memoria autobiográfica reflexiva en `egos/<id>/soul/lessons`.

---

## 17. Arquitectura de Skills

La sinergia Hermes + VantaDB consolida una infraestructura de habilidades extensible:

```text
Sub-Ego ──(usa / crea)──> Skill ──(valida)──> AST Audit ──(guarda)──> SkillStore (VantaDB + .ego/skills/)
```

### Ciclo de Vida de una Skill
```text
Generate (Sub-Ego formula procedimiento)
   ↓
AST Audit (SkillAstAuditor analiza seguridad)
   ↓
Security Validation (Verificación de permisos y dependencias)
   ↓
Approval when needed (Confirmación HITL si realiza acciones sensibles)
   ↓
Persist (Indexación procedural en VantaDB + archivo SKILL.md)
   ↓
Use (Despacho durante la resolución de tareas)
   ↓
Measure Outcome (Evaluación de tasa de éxito y fallos)
   ↓
Reinforce / Refine (Refuerzo Hebbiano o ajuste heurístico)
```

---

## 18. Closed Learning Loop (Con Límites de Seguridad)

Ego adopta el bucle cerrado de aprendizaje, pero establece **guardrails inexpugnables**:

```text
Execution ──> Outcome ──> Evaluation ──> Reflection ──> Lesson ──> VantaDB ──> Future Recall
```

> ### Límite de Autoridad
> La auto-reflexión de un Sub-Ego puede mejorar sus **habilidades procedimentales, sus archivos `SKILL.md`, su memoria reflexiva y sus preferencias heurísticas**.
> **Bajo ninguna circunstancia un Sub-Ego tiene permiso para modificar el Cognitive Runtime, los permisos del sistema ni las reglas innegociables de su Manifiesto.**

---

## 19. Execution Runtime Unificado

Integración de las fortalezas de OpenClaw y Hermes en el flujo de ejecución:

```text
Intent (Instrucción del usuario)
  ↓
Run Admission (Validación inmutable AdmittedRunContext [OpenClaw])
  ↓
Policy / Permissions (Evaluación de riesgos y políticas de seguridad)
  ↓
Planning & Selection (Selección de Sub-Ego y herramientas)
  ↓
Execution Manager (Supervisión con AbortSignal y cuotas [OpenClaw])
  ↓
Tool / Worker / Worktree (Aislamiento por Worker o Git Worktree [Hermes])
  ↓
Result Validation & Repair (Auto-reparación de tool-calls [OpenClaw])
  ↓
Memory Synchronization (Persistencia atómica en VantaDB)
  ↓
User / Dynamic Workspace (Emisión a UI y actualización de Canvas)
```

---

## 20. Code Execution Kernel

Se adopta como optimización del Execution Runtime para evitar inferencias redundantes:

```text
LLM
 ↓ Emite script declarativo
Code Execution Kernel (node:vm sandboxed)
 ├── Tool A (read_file)
 ├── Tool B (diff)
 ├── Tool C (lint)
 └── Tool D (test)
 ↓ Retorna resultado consolidado
LLM (1 solo turno, ahorro masivo de tokens y latencia)
```

Se ejecuta bajo sandboxing riguroso y control estricto de accesos.

---

## 21. Worker Runtime (Protección del Event Loop)

Se adopta de OpenClaw para garantizar una UI de escritorio fluida:

```text
Electron Main Process
  │
  ├── Cognitive Runtime (Orquestación, IPC, coordinación ligera)
  │
  └── Worker Runtime (worker_threads dedicados)
        ├── Indexación y hashing masivo de repositorios
        ├── Parsing y auditoría AST de skills
        ├── Tareas pesadas de fondo
        └── Ejecución de scripts en segundo plano
```

---

## 22. Background Activity & Proactivity

> **Regla de Terminología:** "Dots" queda formalmente descartado como término técnico. La capacidad canónica es **Background Activity & Proactivity**.

Se materializa a través de superficies discretas:
* Bandeja del Sistema (System Tray).
* Activity Center y notificaciones nativas del SO.
* Resumen ejecutivo en el Daily State al iniciar el día.
* Componentes de estado en el Dynamic Workspace.

---

## 23. Gobernanza del Scheduler

> **Separación de Responsabilidades:**
> * **Ego Scheduler:** Gestiona el **QUÉ y CUÁNDO** a nivel de usuario (tareas programadas, automatizaciones cron, despacho a Sub-Egos).
> * **VantaDB Internal Mechanics:** Gestiona exclusivamente sus **procesos de mantenimiento interno** (*Dream Consolidation*, compactación Fjall, reindexación HNSW). VantaDB jamás actúa como el planificador general de tareas de Ego.

---

## 24. Gobernanza y Human-in-the-Loop (HITL)

```text
Run Admission ──> Authority Context ──> Permission Policy ──> Risk Assessment
                                                                    │
           ┌────────────────────────────────────────────────────────┴───────────────────────────────────────────────────────┐
           ↓                                                                                                                ↓
   Acción Segura (Lectura)                                                                                    Acción Sensible (Escritura/Red)
           ↓                                                                                                                ↓
  Ejecución Inmediata                                                                                        Human Approval (HITL interactivo)
                                                                                                                            ↓
                                                                                                                   Ejecución + Auditoría
```

Acciones que exigen confirmación obligatoria: escrituras destructivas en disco, ejecución de código arbitrario, lectura/mutación de credenciales, comunicaciones externas y operaciones financieras.

---

## 25. Auto-Reparación de Tool Calls

Se adopta de OpenClaw (`tool-call-repair`). Debe ser:
* **Determinista:** Corrección de JSON truncado, cierres de llaves faltantes o comillas mal escapadas.
* **Acotada:** Máximo de transformaciones sintácticas permitidas.
* **Auditable:** Se registra el diff entre el texto recibido del LLM y el objeto parseado.
* **Respetuosa del Esquema:** Jamás inventa parámetros ausentes ni altera argumentos ambiguos.

---

## 26. Seguridad de Red (Anti-SSRF Policy)

Se adopta de OpenClaw (`net-policy`). Toda petición de red originada por herramientas o plugins externos es interceptada para bloquear accesos a `127.0.0.1`, interfaces de loopback, rangos de subred privada (RFC 1918), servicios de metadatos cloud (`169.254.169.254`) y puertos no autorizados.

---

## 27. Aislamiento con Git Worktrees

Se adopta de Hermes (`subagent_worktree.py`) exclusivamente para Sub-Egos de desarrollo de software. Crea ramas temporales y árboles de trabajo físicos en disco para que el agente pruebe parches sin ensuciar la copia de trabajo del usuario. No aplica a Sub-Egos de áreas no técnicas.

---

## 28. Gestión Avanzada de Sesiones

Fusión de OpenClaw y Hermes:
* **De OpenClaw:** Locks atómicos por sesión para evitar escrituras concurrentes conflictivas y ventanas deslizantes de lectura para no sobrecargar la memoria RAM con historiales largos.
* **De Hermes:** Timeline de eventos, soporte para rebobinar turnos (rewind) y ramificación de conversaciones (branching), persistido directamente sobre VantaDB.

---

## 29. Grafo de Diffs y Revisiones

Se adopta de OpenClaw. Cada modificación sobre código o documentos genera un nodo en un grafo acumulativo con autor, Sub-Ego responsable, motivo, timestamp, diff unificado y enlace a la revisión padre, alimentando el Dynamic Workspace y el registro de auditoría.

---

## 30. Taxonomía Canónica de MCP

El protocolo Model Context Protocol (MCP) se divide en 3 niveles estrictos:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CATEGORÍAS DE MCP EN EGO                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Internal MCP (P0 Transitorio):                                          │
│     Ego Main Process ──(stdio)──> vantadb-mcp ──> vanta-memory               │
│     (Se reemplazará en P1 por la fachada nativa VantaCognitiveAPI).         │
├─────────────────────────────────────────────────────────────────────────────┤
│  2. External MCP (Ecosistema Externo):                                      │
│     Ego Main Process ──(stdio/SSE)──> GitHub / Slack / Notion / Custom MCP   │
│     (Mecanismo universal para consumir herramientas del usuario).           │
├─────────────────────────────────────────────────────────────────────────────┤
│  3. Ego MCP Server (Fachada Pública de Ego):                                │
│     Claude Desktop / Cursor / IDE ──> Ego MCP Server ──> Cognitive Runtime  │
│     (Expone contexto de alto nivel: Project, Memory, Tasks, Sub-Egos).      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 31. Distinción Absoluta: `vantadb-mcp != Ego MCP`

> ### Regla de Identidad
> `vantadb-mcp` es la interfaz MCP propia del motor VantaDB.
> `Ego MCP Server` es la interfaz MCP del Sistema Operativo Cognitivo Ego.

El servidor MCP público de Ego habla en términos del negocio del usuario: **Proyectos, Estado del Proyecto, Tareas, Sub-Egos, Base de Conocimiento y Evidencia**, jamás exponiendo detalles internos ni tablas crudas de VantaDB.

---

## 32. Separación Canónica: Capacidad vs Arquitectura vs Diseño vs Implementación

Toda especificación en Ego debe clasificar estrictamente sus definiciones:

| Dimensión | Pregunta Clave | Ejemplo: Memoria de Proyecto | Ejemplo: Gobernanza |
|---|---|---|---|
| **Capability (QUÉ)** | ¿Qué debe poder hacer el sistema? | Memoria persistente contextual compartida | Aprobación de acciones sensibles por el usuario |
| **Architecture (CÓMO funciona)** | ¿Cuáles son los mecanismos técnicos y contratos? | `EgoMemoryAdapter` + VantaDB HNSW/BM25 + Namespaces | `PermissionPolicy` + `ExecutionManager` + Interceptores |
| **Design (CÓMO se experimenta)** | ¿Cómo lo percibe e interactúa el usuario? | Indicador 🧠 RecallStatus + Botón contextual "¿Por qué?" | Modal emergente HITL con diff y botones aprobar/rechazar |
| **Implementation (CON QUÉ)** | ¿Qué librerías y tecnologías concretas se usan? | `NativeVantaDB` (Rust napi-rs) + React 19 + TypeScript | Zod + `@assistant-ui/react` + Zustand |

---

## 33. Regla de Extracción para Futuras Referencias

Cualquier análisis futuro de proyectos del estado del arte (OpenHands, Claude Code, Codex, Grok Bots, etc.) debe seguir el algoritmo:

```text
REPOSITORIO HALLADO
        ↓
CLASIFICAR CAPACIDADES
        ↓
¿YA EXISTE EN EGO?
        ↓
SÍ ──> ADAPT / OPTIMIZE
NO  ──> EVALUACIÓN RFC:
        • Utilidad real demostrable
        • Trade-offs y complejidad
        • Análisis de riesgos (FMEA)
        • Veredicto del Owner
        ↓
ACCIONES POSIBLES:
[ ADOPT | ADAPT | WRAP | INSPIRE | REJECT | POSTPONE ]
```

---

## 34. Priorización Global por Fases

### P0 (Alpha) — Golden Path de Escritorio
`NativeVantaDB` in-process · Contrato de Memoria · Ciclo de Vida de Memoria (`EgoMemoryLifecycle`) · `ModelRouter` propio · `AdmittedRunContext` · `AbortSignal` en cascada · `ToolRegistry` & `ExecutionManager` · Aprobación HITL · Políticas de seguridad base · `worker-runtime` básico · Render de artefactos y markdown enriquecido · Persistencia de sesiones en disco · Dynamic Workspace base.

### P1 (Beta) — Profundización & Capacidades Avanzadas
Fachada nativa `VantaCognitiveAPI` (napi-rs) · GraphRAG nativo en memoria · Memoria de Tareas (`Task Memory`) & Checkpoints · *Dream Consolidation* automática · Refuerzo Hebbiano continuo · Aislamiento con Git Worktrees · Code Execution Kernel · `SkillStore` con auditoría AST · Grafo de diffs y revisiones · Dynamic Workspace avanzado · Background Activity & Proactivity · Indexación inteligente de código.

### P2+ (Evolución & Expansión)
Conectores omnicanal (20+ redes) · Aplicaciones complementarias móviles · Ejecución distribuida/remota · Sincronización multi-dispositivo vía CRDT · Auto-mejora cognitiva avanzada · Orquestación multi-agente masiva (MoA) · Voz y multimodalidad avanzada · Ego Cloud Sync opcional.

---

## 35. Golden Path Unificado

La prueba de fuego definitiva que convalida la arquitectura completa:

```text
Usuario emite instrucción
        ↓
Ego identifica Proyecto y Contexto
        ↓
Project Memory (VantaDB) recupera contexto relevante (L0–L2)
        ↓
Model Router selecciona el modelo óptimo
        ↓
Meta-Ego selecciona el Sub-Ego especializado
        ↓
AdmittedRunContext valida autoridad y emite token inmutable
        ↓
Sub-Ego ejecuta ciclo con herramientas o workers
        ↓
Acciones sensibles pasan por aprobación HITL del usuario
        ↓
Resultado validado y sincronizado en VantaDB
        ↓
Dynamic Workspace actualiza el Canvas de forma reactiva
        ↓
Persistencia física en disco (Fjall LSM)
        ↓
[CERRAR APLICACIÓN] ──> [REINICIAR EGO] ──> [RECUPERAR ESTADO IDÉNTICO INTACTO]
```

---

## 36. Diagrama de Arquitectura Final

```text
                              EGO
                               │
                     ┌─────────┴─────────┐
                     │  Cognitive OS     │
                     └─────────┬─────────┘
                               │
                      Cognitive Runtime
                               │
       ┌───────────────┬───────┼───────┬───────────────┐
       │               │       │       │               │
    Models          Sub-Egos  Tools  Decisions      Workspace
       │               │       │       │               │
 Model Router       Runtime  Registry  Decision       Dynamic
 Providers          Memory   Execution  Intelligence   Canvas
       │               │       │       │
       └───────────────┴───────┴───────┘
                               │
                        Project Memory
                               │
                         Memory Contract
                               │
                           VantaDB
                               │
       ┌───────────────────────┼────────────────────────┐
       │                       │                        │
   Native API            Cognitive API               MCP
       │                       │                        │
      Node                  napi-rs              interoperability
       │                       │                        │
       └───────────────────────┴────────────────────────┘
                               │
                           Rust Core
                               │
       ┌───────────────────────┼────────────────────────┐
       │         │       │      │       │       │       │
    Storage   Retrieval Graph Context Memory Temporal Security
```

---

## 37. Frontera Definitiva entre Proyectos

```text
VantaDB
──────────────────────────────────────────────────────────────────
Memory · Knowledge · Retrieval · Graph · Context · Temporal ·
Persistence · Consolidation · Embeddings · Task Memory · Checkpoints
```

```text
Ego
──────────────────────────────────────────────────────────────────
Intent · Orchestration · Models · Sub-Egos · Tools · Execution ·
Governance · Tasks · Events · Workspace · Integrations · UX · Project State
```

```text
Hermes Agent / OpenClaw / Coucou
──────────────────────────────────────────────────────────────────
Hermes   → Desktop UX, Hardening Windows, Skills AST Audit, Worktrees, Code Kernel
OpenClaw → TypeScript Runtime, AdmittedRunContext, AbortSignal, Session Locks, Workers
Coucou   → Event Normalization, Non-blocking Ingress, ActionIdentity, ChangeSet, Safe Mutation
```

---

## 38. Las 10 Decisiones Congeladas

1. **VantaDB y Ego son proyectos independientes first-party que evolucionan coordinadamente.**
2. **VantaDB es el principal engine local-first de memoria y conocimiento de Ego, pero no define la identidad de Ego.**
3. **Ego consume VantaDB mediante una abstracción propia de memoria (`EgoMemoryAdapter`).**
4. **P0 utiliza `NativeVantaDB` + MCP interno hacia `vanta-memory` cuando sea necesario.**
5. **P1 busca reemplazar progresivamente ese MCP interno por una fachada cognitiva nativa mediante `napi-rs`.**
6. **Hermes, OpenClaw y Coucou son fuentes de patrones, no arquitecturas base.**
7. **Ninguna funcionalidad externa entra a Ego automáticamente: las capacidades nuevas pasan por RFC y evaluación crítica.**
8. **MCP es un protocolo de interoperabilidad, no la identidad de Ego.**
9. **Sub-Ego es la entidad cognitiva del producto; "agent" permanece como concepto técnico interno.**
10. **Capability, Architecture, Design e Implementation deben permanecer separados en toda la documentación.**

---

## 39. Decisión Global y Principio Rector

> **Ego debe construirse como un Cognitive Operating System propio, utilizando VantaDB como su principal substrate first-party de memoria y conocimiento, Hermes como fuente de patrones de experiencia desktop, skills y ejecución, OpenClaw como fuente de patrones de runtime, gobernanza, resiliencia y seguridad, y Coucou como fuente de patrones de observabilidad, atención, gobernanza HITL no bloqueante y mutaciones seguras.**
>
> **VantaDB se desarrollará para exponer una API nativa, estable y genérica que permita a Ego aprovechar progresivamente sus capacidades de Rust sin reimplementarlas en TypeScript.**
>
> **Hermes, OpenClaw y Coucou no se integrarán como frameworks centrales. Sus componentes y patrones serán seleccionados mediante el Protocolo de Extracción Condicionada y adaptados a las abstracciones propias de Ego.**
>
> **La arquitectura resultante debe maximizar la reutilización del trabajo ya construido sin sacrificar la independencia de los proyectos ni introducir acoplamientos innecesarios.**
>
> ### Principio Rector
> **VantaDB proporciona memoria y conocimiento. Hermes proporciona patrones de experiencia y ejecución. OpenClaw proporciona patrones de runtime y gobernanza. Coucou proporciona patrones de observabilidad, atención y control de cambios. Ego los convierte en un único Sistema Operativo Cognitivo.**
