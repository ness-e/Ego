# Extracción Técnica: Mem0 (repos-referencia/mem0) #

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de patrones |
| Repositorio Origen | `repos-referencia/mem0/` (upstream `mem0ai/mem0`, commit `0724291`, origen `mem0/memory/main.py`) |
| Licencia del origen | Apache-2.0 — mem0ai/mem0 |
| Commit verificado | 0724291 |
| Ruta de origen | `mem0/memory/main.py` |
| Stack del Origen | Python 3.10–3.12 (SDK `mem0ai` 2.2.1, Pydantic v2) + TypeScript strict (SDK `mem0ai` 3.3.1, tsup/pnpm) + FastAPI self-hosted (`server/`) · Apache-2.0 |
| Rol en Ego | Referencia de **capa de memoria conversacional**: extracción de recuerdos, deduplicación, arbitraje de mutación, scope y grafo de memorias |
| Owner | ness-e |
| Fecha | 2026-10-20 |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia ##

`mem0ai/mem0` es la referencia más directa que existe para la **capa de memoria** de un Sistema Operativo
Cognitivo: no es un chat ni un gestor de tareas, es la maquinaria que decide *qué se recuerda* de una
conversación, *cómo se actualiza* lo ya recordado y *cómo se evita duplicarlo*. Esa es exactamente la brecha
de Ego: `packages/memory/` tiene sustrato (VantaDB), namespaces, ciclo de vida y gobernanza, pero **no tiene
ninguna etapa que extraiga memoria del turno de chat**.
`packages/knowledge/src/extractors/FactExtractor.ts` existe y está probado, pero no tiene caller en producción.

El repo es, además, un buen ejemplo de **divergencia entre su propia documentación interna y su código**:
`mem0/AGENTS.md` todavía anuncia `mem0/graphs/` con "4 proveedores" y "Python 3.9", pero en el commit
`0724291` el paquete `mem0/graphs/` **no existe**, `MemoryConfig` (`mem0/configs/base.py:29-58`) no declara
sección `graph` y `pyproject.toml:15` exige `>=3.10`. La única traza residual de graph stores es un docstring
(`mem0/exceptions.py:396`). Todo análisis de este documento se hizo contra el **código**, no contra el
`AGENTS.md` del repo.

### Divergencias Fundamentales (Qué Descartamos y Por Qué) ###

| Dimensión | Mem0 | Ego (Cognitive OS) | Decisión Crítica |
|---|---|---|---|
| **Sustrato de persistencia** | Vector store externo (30 proveedores) + SQLite para historial y mensajes (`mem0/memory/storage.py:11`). | VantaDB 0.8.0 nativo in-process (`NativeVantaDB` napi-rs, Fjall LSM), namespaces por dominio, `EgoMemoryAdapter` como gateway único. | **DESCARTAR** SQLite y los vector stores externos. Extraer solo la *semántica* (hash de dedup, historial de eventos, scope determinista) sobre `EgoMemoryAdapter`. |
| **Embeddings en la ruta de escritura** | `embed_batch` obligatorio en cada escritura (`mem0/memory/main.py:996`). | Fast path BM25 léxico puro (`query_vector: []`, workaround `VDB-REQ-02`); la inferencia densa vive solo en `vantadb-mcp`. | **DESCARTAR** el embedding denso en TS (guardrail `AGENTS.md` §4). La dedup semántica se reexpresa como BM25 + `min_confidence`. |
| **Arbitraje de escritura** | v1: el LLM decide `ADD/UPDATE/DELETE/NONE` (`mem0/configs/prompts.py:176-324`). v3 (commit vivo): ADD-only + `linked_memory_ids` (`mem0/memory/main.py:944`). | `FactLifecycle` con create/supersede/retire determinista + cuarentena y promoción humana (ADR-046). | **ADAPTAR** como etapa opcional post-turno, nunca sustituyendo la promoción humana de `quarantine/pending`. |
| **Scope de identidad** | Triple plano `user_id`/`agent_id`/`run_id` en metadata, con al menos uno obligatorio (`mem0/memory/main.py:391-397`). | Namespaces por dominio versionados en `ego.namespaces.json` + `egos/<id>/*` + permisos por manifiesto (`docs/architecture/namespaces.md:40-47`). | **DESCARTAR** el triple plano: duplicaría el eje de scope canónico. `agent_id` ya es metadata canónica forzada (`EgoMemoryAdapter.ts:508`). |
| **Grafo de memoria** | Graph store externo (Neo4j/Memgraph/Kuzu/pgvector) — y **eliminado del SDK OSS** en este commit. | Grafo nativo VantaDB: `GraphRagEngine` + `ProjectMemoryGraph`, ya en producción. | **DESCARTAR** el store externo. Lo transferible es el *patrón de enlazado*, no el grafo de terceros. |
| **Plataforma** | API hosted (`MemoryClient`) + `server/` FastAPI self-hosted con Docker. | Desktop local-first sin servicio cloud obligatorio (principios 1 y 9). | **DESCARTAR** la plataforma hosted: rompe la propiedad/exportación de datos. |

---

## 2. Inventario Quirúrgico de Patrones a Extraer ##

### Bloque A: Pipeline de extracción de memoria ###

*Ubicación en fuente:* `repos-referencia/mem0/mem0/memory/main.py` y
`repos-referencia/mem0/mem0/configs/prompts.py`

1. **Pipeline aditivo ADD-only con contexto de 3 ventanas (`mem0/memory/main.py:918-955`)**
   - **Qué hace:** Fase 0 reúne los últimos 10 mensajes del scope (`main.py:920-922`); Fase 1 recupera 10
     memorias existentes del mismo scope y las reindexa con ids secuenciales (`main.py:925-940`); Fase 2 llama
     al LLM con un prompt de extracción aditiva. Las memorias existentes **solo** sirven para deduplicar y
     enlazar, nunca como fuente (`mem0/configs/prompts.py:511`).
   - **Adaptación en Ego:** etapa nueva
     `packages/knowledge/src/extractors/ConversationMemoryExtractor.ts` invocada desde
     `EgoMemoryLifecycle.syncTurn` (`packages/memory/EgoMemoryLifecycle.ts:268`), con las tres ventanas
     servidas por `EgoMemoryAdapter` (`kb/facts` + `session/turns` + `journal/signals`).
   - **Relación con Backlog Ego:** `KB-08`, `KB-09`, `TASK-08`, `CORE-12`.

2. **Arbitraje `ADD/UPDATE/DELETE/NONE` por LLM (`mem0/configs/prompts.py:176-324`; espejo TS en
   `mem0-ts/src/oss/src/prompts/index.ts:20-40` y `:105-243`)**
   - **Qué hace:** el LLM compara hechos nuevos contra la memoria existente y emite por cada hecho un evento
     con su `old_memory`; la regla "conserva la memoria más informativa" (`:216-222`) evita el overwrite
     degradante.
   - **Hallazgo crítico verificado:** en el commit `0724291` este prompt es **código muerto en el SDK OSS** —
     `get_update_memory_messages` (`prompts.py:406`) no tiene ningún caller (`grep` en `mem0/` → solo su
     definición) y el pipeline vivo usa `ADDITIVE_EXTRACTION_PROMPT` (`main.py:944`). La v1 sobrevive
     únicamente en el SDK TypeScript (`mem0-ts/src/oss/src/prompts/index.ts:105`).
   - **Adaptación en Ego:** `packages/knowledge/src/arbitration/MemoryArbitrator.ts` con esquema Zod
     `ADD|UPDATE|DELETE|NONE` equivalente, alimentando `FactLifecycle.consolidateMemories`
     (`packages/knowledge/src/FactLifecycle.ts:183`).
   - **Relación con Backlog Ego:** `KB-08`, `DEC-02`, `SUB-12`.

3. **Anclaje temporal relativo a la fecha de observación (`mem0/configs/prompts.py:524-535`)**
   - **Qué hace:** el prompt exige resolver "ayer", "la semana pasada" contra la *Observation Date* (la fecha
     real del turno), nunca contra la fecha del sistema: "User fue a París la semana pasada" es inservible 6
     meses después.
   - **Adaptación en Ego:** el `ts` canónico ya lo fuerza `EgoMemoryAdapter` (`EgoMemoryAdapter.ts:506`); el
     extractor debe inyectarlo como `observationDate` en el prompt, no como `currentDate`.
   - **Relación con Backlog Ego:** `KB-09`, `CORE-06`.

### Bloque B: Detección de memoria existente, dedup y scope ###

*Ubicación en fuente:* `mem0/memory/main.py`, `mem0/memory/storage.py`, `mem0/memory/utils.py`

1. **Deduplicación determinista por hash en la ruta de escritura (`mem0/memory/main.py:1007-1026`; espejo TS
   `mem0-ts/src/oss/src/memory/index.ts:1000-1034`)**
   - **Qué hace:** hash MD5 del texto; se descarta si coincide con el hash de una memoria ya recuperada en
     Fase 1 o con otro hash del mismo lote (`seen_hashes`). Doble barrera: contra duplicado histórico y contra
     duplicado intra-lote.
   - **Adaptación en Ego:** `FactExtractor` ya genera ids direccionables por contenido
     (`fact_${sha256(subject:object:source)}`, `packages/knowledge/src/extractors/FactExtractor.ts:97,128,166`)
     → la reescritura es idempotente por clave. Falta la barrera intra-lote: un `seen_hashes` en el extractor.
   - **Relación con Backlog Ego:** `KB-03`, `KB-07`, `TASK-08`.

2. **Anti-alucinación de identificadores: mapeo UUID→índice en el prompt (`mem0/memory/main.py:935-940`; espejo
   TS `mem0-ts/src/oss/src/memory/index.ts:899-918`)**
   - **Qué hace:** las memorias existentes se muestran al modelo con ids **secuenciales** ("0", "1"…) y un
     `uuid_mapping` interno; el modelo nunca ve UUIDs y no puede inventarlos, pero solo puede referirse a las
     que le han sido mostradas.
   - **Adaptación en Ego:** `FactExtractor.parseFactJson` acepta el `id` que devuelve el modelo sin contrastarlo
     contra un conjunto válido (`packages/knowledge/src/extractors/FactExtractor.ts:157-193`); un `oldFactId`
     alucinado crearía una arista `SUPERSEDED_BY` colgante en `FactLifecycle.supersedeFact`
     (`FactLifecycle.ts:117-177`).
   - **Relación con Backlog Ego:** `KB-08`, `SEC-06`, `DEC-07`.

3. **Scope determinista por identidad con escapado (`mem0/memory/main.py:314-404` y `:407-419`)**
   - **Qué hace:** `_build_session_scope` concatena las claves de identidad **ordenadas** (`user_id`,
     `agent_id`, `run_id`) escapando los delimitadores estructurales `%`, `&` y `=` (`_escape_scope_value`,
     `:407-409`); `_build_filters_and_metadata` **elimina** las claves de identidad del metadata libre del
     llamante (`_strip_identity_keys`, `:143-164` y `:363-365`) para que la metadata no pueda colocar una
     memoria en un scope no solicitado.
   - **Adaptación en Ego:** el modelo de namespaces por dominio ya cubre el scope, y los campos canónicos de
     metadata (`org_id`, `ts`, `source`, `agent_id`, `confidence`, `state` — más `created_at`) se fuerzan en
     cada escritura (`EgoMemoryAdapter.ts:505-514`). Lo asimilable es la **garantía de que la metadata libre no
     fija el scope**: los campos canónicos se reasignan tras copiarla (`EgoMemoryAdapter.ts:505-514`), de modo
     que `ts`/`created_at` son deterministas y `org_id`/`agent_id`/`confidence`/`state`/`source` caen a su
     default cuando faltan.
   - **Relación con Backlog Ego:** `CORE-06`, `SUB-04`, `SEC-06`.

4. **Historial de eventos por memoria con esquema ADD/UPDATE/DELETE (`mem0/memory/storage.py:102-126`,
   `:150-191`)**
   - **Qué hace:** tabla `history` con `memory_id`, `old_memory`, `new_memory`, `event`, `is_deleted`,
     `actor_id`, `role`; permite reconstruir la evolución de una memoria.
   - **Adaptación en Ego:** ya cubierto por el versionado inmutable del adapter (`getVersionHistory`,
     `EgoMemoryAdapter.ts:986`) y por `kb/audit` (`FactLifecycle.writeAudit`, `FactLifecycle.ts:298-323`).
   - **Relación con Backlog Ego:** `KB-08`, `SEC-06`, `REC-01`.

### Bloque C: Grafo de memorias y perfil del usuario ###

*Ubicación en fuente:* `mem0/configs/prompts.py`, `mem0/utils/entity_extraction.py`

1. **Enlazado de memorias por `linked_memory_ids` (`mem0/configs/prompts.py:513` y `:516`; TS
   `mem0-ts/src/oss/src/prompts/index.ts:326,329,749,775-781`)**
   - **Qué hace:** el modelo declara, junto a cada memoria nueva, los ids de las memorias existentes con las
     que se relaciona (mismo hecho, preferencia que se desplaza, continuación de un relato). La persistencia
     lo hace un *entity store* vectorial con dedup global, coincidencia exacta y coincidencia semántica con
     umbral 0.95 (`mem0/memory/main.py:1100-1204`, `:1166`).
   - **Adaptación en Ego:** convertir `linked_memory_ids` en aristas del grafo nativo vía
     `packages/memory/GraphRag.ts` (`normalizeNativeGraphRag`) y `GraphRagEngine`.
   - **Relación con Backlog Ego:** `KB-06`, `KB-11`, `DOM-03`.

2. **"Profile" del usuario como insumo del prompt (`mem0/configs/prompts.py:496-498` y `:1036`)**
   - **Qué hace:** el prompt de extracción recibe un bloque `## Summary` con un resumen narrativo del perfil del
     usuario, y la guía de "qué extraer" pide capturar preferencias, planes y relaciones explícitamente
     (`prompts.py:485`).
   - **Adaptación en Ego:** no existe memoria semántica de preferencias: `UserPrefsState`
     (`packages/ui-runtime/src/stores/EgoStateStores.ts:60-66`) es solo preferencias visuales y de
     accesibilidad. El resumen debe derivarse de `journal/*` + `kb/facts`, no de un store nuevo.
   - **Relación con Backlog Ego:** `DS-01`, `DS-02`, `KB-08`.

---

## 3. Matriz de Extracción vs Descarte ##

| Componente Mem0 | Acción en Ego | Razón Técnica / Arquitectónica |
|---|:---:|---|
| Pipeline aditivo ADD-only (`main.py:918-955`) | **EXTRAER PATRÓN** | Es la etapa que falta: Ego extrae hechos de documentos, no del turno de chat. |
| Arbitraje `ADD/UPDATE/DELETE/NONE` (`prompts.py:176-324`) | **EXTRAER PATRÓN** | Complementa `FactLifecycle`; nunca sustituye la promoción humana de ADR-046. |
| Mapeo UUID→índice anti-alucinación (`main.py:935-940`) | **EXTRAER PATRÓN** | Cierra un agujero real: ids de hechos inventados por el modelo. |
| Dedup por hash en escritura (`main.py:1007-1026`) | **EXTRAER PATRÓN** | Los ids direccionables de `FactExtractor` ya dan idempotencia; falta la barrera intra-lote. |
| Scope `user_id`/`agent_id`/`run_id` (`main.py:314-419`) | **🚫 Descartada** | Duplicaría el eje de scope canónico (`ego.namespaces.json` + permisos por manifiesto) y rompería "los namespaces definen dónde vive el dato" (`namespaces.md:51`). |
| Historial SQLite de eventos (`storage.py:102-191`) | **🚫 Descartada** | Sustituido por el versionado inmutable del adapter y `kb/audit`. |
| Filtrado por metadata con operadores `AND/OR/NOT` (`main.py:1538-1640`) | **🚫 Descartada** | El binding `search` de VantaDB no acepta predicados sobre metadata: la llamada de Ego expone solo 6 campos (`EgoMemoryAdapter.ts:729-738`). |
| Graph store Neo4j/Memgraph/Kuzu/pgvector | **🚫 Descartada** | Base de datos externa: rompe los principios 1 y 9 y el guardrail "VantaDB es el sustrato soberano". Además ya no existe en el SDK OSS de este commit. |
| Enlazado `linked_memory_ids` + entity store (`main.py:1100-1204`) | **EXTRAER PATRÓN** | Trasladable al grafo nativo; el store vectorial de entidades no. |
| "Profile" / preferencias del usuario (`prompts.py:496-498`) | **EXTRAER PATRÓN** | Falta la memoria semántica de preferencias; el insumo ya existe en `journal/*`. |
| Memoria procedural (`prompts.py:326-403`, `main.py:2007-2050`) | **🚫 Descartada** | Solapada con `TaskMemory` (TASK-02) y con el curator de `EgoMemoryLifecycle`; añadir un tercer mecanismo de resumen es sobreingeniería. |
| Extracción de entidades con spaCy (`utils/entity_extraction.py:1-16`) | **🚫 Descartada** | Dependencia de modelo NLP en el proceso; el grafo nativo de VantaDB cubre el enlace sin NLP pesado. |
| Lemmatización para BM25 (`utils/lemmatization.py:22-47`) | **🚫 Descartada** | El BM25 vive dentro de VantaDB (`NativeVantaDB`); lemmatizar en TS duplicaría el índice y rompería el fast path. |
| API hosted `MemoryClient` + `server/` FastAPI | **🚫 Descartada** | Dependencia cloud: viola la propiedad y exportación de datos (principios 1 y 9). |
| `integrations/` (Vercel AI SDK, plugins de editores) | **🚫 Descartada** | Guardrail: "agregar una integración no debe modificar Runtime, Router, Sub-Egos ni Workspace" (`AGENTS.md` §7). |

---

## 4. Estado real verificado (2026-10-20) ##

> Criterio de cierre (`docs/extractions/README.md` §4): `✅ Completada` exige fichero adaptado **y** caller en
> producción verificado por grep sobre `packages/` + `apps/desktop/`, excluyendo `test/`, `dist/` y
> `node_modules/`.

| ID | Patrón | Estado | Evidencia / Fundamento |
|---|---|:---:|---|
| `MEM0-01` | Pipeline aditivo de extracción desde el turno de chat | 🆕 Pendiente | No existe en `packages/`. `FactExtractor` (`packages/knowledge/src/extractors/FactExtractor.ts:62`) solo tiene caller en `packages/knowledge/src/index.ts:8` y tests. **Cableado:** `EgoMemoryLifecycle.syncTurn` (`packages/memory/EgoMemoryLifecycle.ts:268`) → extractor nuevo → `FactLifecycle.consolidateMemories` (`packages/knowledge/src/FactLifecycle.ts:183`). Owner: A2 (memoria) con A1 (knowledge). |
| `MEM0-02` | Arbitraje `ADD/UPDATE/DELETE/NONE` por LLM con esquema Zod | 🆕 Pendiente | No existe en `packages/`. `FactLifecycle` decide de forma determinista (`FactLifecycle.ts:183-284`), sin LLM. **Cableado:** `packages/knowledge/src/arbitration/MemoryArbitrator.ts` invocado desde `MEM0-01`, alimentando `consolidateMemories`. Owner: A1 con A2. |
| `MEM0-03` | Anti-alucinación de ids (mapeo de ids válidos en el prompt) | 🆕 Pendiente | Gap real: `FactExtractor.parseFactJson` (`FactExtractor.ts:157-193`) adopta el `id` del modelo sin whitelist; `supersedeFact` (`FactLifecycle.ts:117-177`) crearía aristas colgantes. **Cableado:** `MemoryArbitrator` debe recibir un mapa `id → key` y rechazar `old_memory` fuera del conjunto; test en `packages/knowledge/test/`. Owner: A1. |
| `MEM0-04` | Deduplicación por hash en la ruta de escritura | 🆕 Pendiente | Parcial: `FactExtractor` genera ids direccionables por contenido (`FactExtractor.ts:97,128,166`) pero **sin caller**; falta la barrera intra-lote (`seen_hashes`). **Cableado:** dentro de `MEM0-01`, deduplicar el lote antes de escribir. Owner: A1. |
| `MEM0-05` | Consolidación en reposo que resuelve duplicados y contradicciones | ✅ Completada | `EgoMemoryLifecycle.runCuratorConsolidation` (`packages/memory/EgoMemoryLifecycle.ts:399-504`) consolida turnos `stale` de `session/turns` en `kb/facts/curator_<sessionId>` con upsert idempotente por `turnCount`, respetando `quarantine/pending` y sin borrado destructivo. **Caller en producción:** `apps/desktop/src/main.ts:1966` (`lifecycle.startCuratorJob({ intervalMs: 3600000, staleAfterDays: 30, maxSnapshots: 50 })`). Sueño consolidado en `EgoMemoryLifecycle.ts:301,541-548`. |
| `MEM0-06` | Scope de identidad `user_id`/`agent_id`/`run_id` | 🚫 Descartada (con justificación) | Duplicaría el eje de scope canónico: `apps/desktop/ego.namespaces.json:4-31` versiona los namespaces por dominio y `docs/architecture/namespaces.md:40-47` define los permisos por manifiesto; `metadata.agent_id` ya es campo canónico forzado en cada escritura (`packages/memory/EgoMemoryAdapter.ts:508`). Adoptar el triple plano dejaría dos axes de scope en paralelo y ambigüedad sobre cuál es el canónico. |
| `MEM0-07` | Grafo de memoria (relaciones entre recuerdos) | ✅ Completada | `packages/knowledge/src/GraphRagEngine.ts:78` y `packages/knowledge/src/ProjectMemoryGraph.ts:36`, con el binding nativo `packages/memory/GraphRag.ts` (`normalizeNativeGraphRag`, importado en `EgoMemoryAdapter.ts:23-26`). **Callers en producción:** `apps/desktop/src/main.ts:33,37,201,205,683,699,2208,2212` y el handler IPC `ipc.knowledge.graphRag` (`apps/desktop/src/main/ipc/register-ipc.ts:1363-1376`, esquema en `apps/desktop/src/ipc.ts:274`). *Alcance:* el grafo nativo cubre relaciones de proyecto (KB-11); el enlace explícito memoria→memoria de `linked_memory_ids` queda en `MEM0-01`. |
| `MEM0-08` | Graph store externo (Neo4j/Memgraph/Kuzu/pgvector) | 🚫 Descartada (con justificación) | Triple guardrail: (a) base de datos externa → viola los principios 1 y 9 (memoria local persistente, local-first y propiedad/exportación de datos); (b) el sustrato de grafo de Ego es VantaDB (`packages/memory/GraphRag.ts`); (c) en el commit `0724291` el paquete `mem0/graphs/` ya no existe (`MemoryConfig` en `mem0/configs/base.py:29-58` no declara sección `graph`; única traza residual en `mem0/exceptions.py:396`), de modo que no hay ni siquiera upstream que portar. |
| `MEM0-09` | "Profile" del usuario y memoria semántica de preferencias | 🆕 Pendiente | No existe: `UserPrefsState` (`packages/ui-runtime/src/stores/EgoStateStores.ts:60-66`) solo cubre preferencias visuales y de accesibilidad; el prompt de extracción de mem0 (`mem0/configs/prompts.py:496-498`, `:1036`) exige un bloque `## Summary` con el perfil del usuario, insumo que hoy no se construye. **Cableado:** generar el bloque `## Summary` desde `journal/*` + `kb/facts` al construir el prompt de `MEM0-01`; el briefing diario (`DS-02`) es el consumidor natural. Owner: A2 con A8 (Daily State). |

**Recuento:** 2 `✅ Completada` · 2 `🚫 Descartada` · 5 `🆕 Pendiente` · 0 `⏳ Futura` — **9 tareas**.

---

## 5. Descarte normalizado a la forma canónica (2026-10-20) ##

Cada componente descartado en §3 se normaliza aquí a la forma canónica `🚫 Descartada (con justificación)`
(`AGENTS.md` §4), fundiendo en una sola fila el veredicto y su fundamento técnico:

| Componente Mem0 | Veredicto | Fundamento |
|---|:---:|---|
| Scope `user_id`/`agent_id`/`run_id` | 🚫 **Descartada (con justificación)** | Duplicaría el eje de scope canónico (`ego.namespaces.json` + permisos por manifiesto) y rompería "los namespaces definen dónde vive el dato" (`namespaces.md:51`). `agent_id` ya es metadata canónica forzada (`EgoMemoryAdapter.ts:508`). |
| Graph store Neo4j/Memgraph/Kuzu/pgvector | 🚫 **Descartada (con justificación)** | Base de datos externa: viola los principios 1 y 9 y el guardrail "VantaDB es el sustrato soberano"; el grafo nativo ya está en producción (`MEM0-07`). Además el paquete `mem0/graphs/` no existe en el commit `0724291`. |
| Historial SQLite de eventos | 🚫 **Descartada (con justificación)** | Sustituido por el versionado inmutable del adapter (`getVersionHistory`, `EgoMemoryAdapter.ts:986`) y la auditoría `kb/audit` (`FactLifecycle.writeAudit`, `FactLifecycle.ts:298-323`). |
| Memoria procedural (`prompts.py:326-403`) | 🚫 **Descartada (con justificación)** | Solapada con `TaskMemory` (TASK-02) y con el curator de `EgoMemoryLifecycle` (`MEM0-05`); un tercer mecanismo de resumen sería sobreingeniería. |
| Extracción de entidades con spaCy | 🚫 **Descartada (con justificación)** | Dependencia de modelo NLP en el proceso principal; el grafo nativo cubre el enlace sin NLP pesado, y el fast path no puede cargar modelos. |
| Lemmatización para BM25 | 🚫 **Descartada (con justificación)** | El índice BM25 vive dentro de VantaDB (`NativeVantaDB`); lemmatizar en TS duplicaría el índice y rompería el fast path léxico. |
| API hosted `MemoryClient` + `server/` FastAPI | 🚫 **Descartada (con justificación)** | Dependencia cloud obligatoria: contradice los principios 1 y 9 (local-first, propiedad y exportación de datos). |
| `integrations/` de mem0 | 🚫 **Descartada (con justificación)** | Guardrail `AGENTS.md` §7: agregar una integración no debe modificar Runtime, Router, Sub-Egos ni Workspace; el conectore GitHub de Ego (`DOM-07`) ya cubre el caso de Nivel B. |
| Filtrado por metadata `AND/OR/NOT` | 🚫 **Descartada (con justificación)** | El binding `search` de VantaDB no acepta predicados sobre metadata: la llamada de Ego expone solo `namespace`, `text_query`, `query_vector`, `top_k`, `exclude_superseded` y `min_confidence` (`EgoMemoryAdapter.ts:729-738`). El filtrado por contexto lo resuelve hoy el modelo de namespaces; el DSL quedaría sin sustrato hasta que VantaDB lo soporte. |
