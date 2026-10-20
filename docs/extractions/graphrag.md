# Extracción Técnica: Microsoft GraphRAG (repos-referencia/graphrag) #

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de patrones |
| Repositorio Origen | `repos-referencia/graphrag/` (microsoft/graphrag **v3.3.0**, MIT, commit `5faaaf4`, rama `main`, profundidad 1) |
| Stack del Origen | Python ≥3.11 en monorepo de 8 paquetes (`graphrag`, `graphrag-cache`, `graphrag-chunking`, `graphrag-common`, `graphrag-input`, `graphrag-llm`, `graphrag-storage`, `graphrag-vectors`) + pandas/pyarrow + pydantic v2 + `graspologic-native` (binario nativo) + LiteLLM |
| Rol en Ego | Referencia de diseño para la capa Knowledge/GraphRAG (Fase 06). No se porta código: se extraen patrones de pipeline, consulta, caché y configuración |
| Owner | ness-e |
| Fecha | 2026-10-20 |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia ##

`microsoft/graphrag` es la implementación de referencia más madura del patrón **RAG modular basado en grafos**:
en vez de trocear documentos y embeberlos, extrae entidades y relaciones con LLM, agrupa el grafo en
comunidades jerárquicas y produce **dos estrategias de consulta** distintas —*local* (semilla + vecindario) y
*global* (map-reduce sobre resúmenes de comunidad)— sobre el mismo corpus.

Resuelve en Ego el mismo problema que ya resuelven `packages/knowledge/src/GraphRagEngine.ts` (KB-06),
`packages/knowledge/src/HybridSearch.ts` (KB-04) y `packages/knowledge/src/ProjectMemoryGraph.ts` (KB-11).
**Ego ya tiene GraphRAG implementado y en producción** (`apps/desktop/src/main.ts:2206-2208` instancia
`KnowledgeIndexer`, `HybridSearch` y `GraphRagEngine`; `apps/desktop/src/main/ipc/register-ipc.ts:1363` expone
`ipc.knowledge.graphRag`). Por tanto este repositorio **no aporta una capacidad nueva**, sino un catálogo de
patrones de pipeline/consulta/caché/configuración que permiten **endurecer** lo que Ego ya tiene.

### Divergencias Fundamentales ###

| Dimensión | GraphRAG | Ego (Cognitive OS) | Decisión Crítica |
| --- | --- | --- | --- |
| **Runtime y lenguaje** | Python 3.11 con `pandas`, `networkx`, `spacy`, `nltk` y binario `graspologic-native` (`packages/graphrag/pyproject.toml:34-67`) | Node.js 22 en Main process; Python solo como sidecar opcional de ingesta (`packages/knowledge/src/ingest/PythonSidecarBridge.ts:43`) | **DESCARTAR** el runtime Python. Solo se extraen los algoritmos y contratos expresados como patrones. |
| **Sustrato de persistencia** | Parquet + blobs (`packages/graphrag-storage/graphrag_storage/tables/parquet_table.py`), vector store externo LanceDB / Azure AI Search / CosmosDB (`packages/graphrag-vectors/graphrag_vectors/vector_store_type.py:9-14`) | VantaDB 0.8.0 in-process (BM25 + HNSW) tras `EgoMemoryAdapter` (`AGENTS.md` §4) | **DESCARTAR** Parquet/LanceDB/CosmosDB. El sustrato es VantaDB. |
| **Embeddings** | Servicio externo por batches contra la API del proveedor (`packages/graphrag/graphrag/index/operations/embed_text/embed_text.py:110-118`) | Guardrail §4: la inferencia densa reside **exclusivamente** en el subproceso `vantadb-mcp`; el fast path es BM25 puro | **DESCARTAR** el vector store externo y toda ruta de embedding en TypeScript. |
| **Modelo de grafo** | Entidades/relaciones extraídas por LLM, agrupadas en comunidades Leiden con resúmenes por comunidad | Hechos tipados `(subject, predicate, object)` con aristas canónicas Decisión→ADR→Commit→Files→Tests→Outcome (`packages/knowledge/src/schemas/knowledge.ts:41-55`, `packages/knowledge/src/ProjectMemoryGraph.ts`) | **DESCARTAR** la capa de comunidades. El grafo canónico de Ego es `kb/facts` + `ProjectMemoryGraph`. |
| **Gobernanza de la consulta** | Sin control de aprobación: el pipeline LLM decide qué se extrae y qué se indexa | Principio 6 (`AGENTS.md` §4): toda acción sensible pasa por `ApprovalEngine` con `ActionIdentity` | **ADAPTAR** todo patrón que dispare llamadas LLM hacia la cadena `ModelRouter` → `ApprovalEngine` → `ExecutionManager`. |
| **Estrategia de consulta** | Local (vecindario del grafo) y Global (map-reduce sobre resúmenes) | Solo expansion local en 4 fases (`packages/knowledge/src/GraphRagEngine.ts:99-258`) | **EXTRAER PATRÓN** del presupuesto de contexto de la consulta local; **DIFERIR** el global map-reduce. |

---

## 2. Inventario Quirúrgico de Patrones a Extraer ##

### Bloque A: Pipeline de indexación como grafo de workflows registrable ###

*Ubicación en fuente:* `repos-referencia/graphrag/packages/graphrag/graphrag/index/workflows/factory.py`

1. **`PipelineFactory` y las cuatro listas de workflows (`factory.py:17-97`)**
   - **Qué hace:** el pipeline de indexación es una **lista ordenada de nombres de workflow** (`_standard_workflows`,
     `_fast_workflows`, `_update_workflows`, `factory.py:52-83`) resuelta contra un registro
     `ClassVar[dict[str, WorkflowFunction]]` (`factory.py:20`). La variante *Fast* sustituye la extracción por LLM
     (`extract_graph`) por la basada en NLP (`extract_graph_nlp`) y `prune_graph`; la variante *Update* concatena un
     bloque de re-indexado. El usuario puede **sobrescribir la lista completa** desde config (`factory.py:46`,
     `packages/graphrag/graphrag/config/models/graph_rag_config.py:171-174`).
   - **Adaptación en Ego:** registrar en `packages/knowledge/src/` un `KnowledgePipeline` con la misma semántica
     (registro por nombre + lista declarativa de pasos), de modo que `KB-01` (`ingest`) y `KB-03` (`index`) se
     compongan sin reescribir `apps/desktop/src/main.ts`.
   - **Relación con Backlog Ego:** `KB-01`, `KB-03`, `KB-06` (Fase 06).
2. **Orquestación con volcado de estado y estadísticas por paso (`index/run/run_pipeline.py:117-189`)**
   - **Qué hace:** cada workflow se ejecuta bajo un perfilador, se emite `workflow_start`/`workflow_end`, se vuelca
     `stats.json` y `context.json` tras **cada** paso (`run_pipeline.py:143`, `:150-151`) y un fallo se convierte en un
     `PipelineRunResult` con `error` en vez de abortar el proceso (`run_pipeline.py:153-157`).
   - **Adaptación en Ego:** ninguna — ya cubierto por el `EventBus` (`ACT-05`, `ACT-12`:
     `packages/events/src/EventBus.ts`, `packages/runtime/src/ToolExecutionLoop.ts`) y por
     `packages/tasks/src/TaskCheckpoint.ts` (`TASK-03`). No portar.
   - **Relación con Backlog Ego:** `ACT-05`, `ACT-12`, `TASK-03`.

### Bloque B: Estrategia de consulta ###

*Ubicación en fuente:* `repos-referencia/graphrag/packages/graphrag/graphrag/query/structured_search/`

1. **Global search map-reduce con puntuación de relevancia (`global_search/search.py:142-214` y `:306-431`)**
   - **Qué hace:** fase *map* en paralelo sobre lotes de resúmenes de comunidad (`asyncio.gather` con
     `Semaphore(32)`, `global_search/search.py:104`, `:172-180`), fase *reduce* que **filtra los puntos con
     `score == 0`**, los ordena por puntuación descendente, formatea cada punto como `----Analyst N----` +
     `Importance Score` y **trunca por presupuesto de tokens** (`max_data_tokens`,
     `global_search/search.py:355-380`). Si no queda ningún punto con `score > 0` y no se permite conocimiento
     general, devuelve una respuesta enlatada `NO_DATA_ANSWER` (`:340-353`).
   - **Adaptación en Ego:** **no asimilar**. Requiere la capa de resúmenes de comunidad (descartada) y multiplica
     las llamadas al modelo por lote, lo que contradice el perfil local-first de coste de `ModelRouter`
     (`packages/models/src/ModelRouter.ts:581-614`, presupuesto por llamada).
   - **Relación con Backlog Ego:** `KB-06`, `DOM-03`.
2. **Priorización de relaciones in-network / out-network con presupuesto de grafo
   (`context_builder/local_context.py:232-317`)**
   - **Qué hace:** al construir el contexto local, las relaciones **internas** al subgrafo semilla se priorizan
     siempre; las **externas** se ordenan por número de enlaces compartidos (`links`) y después por el atributo de
     ranking, y se truncan con un presupuesto `top_k_relationships * len(selected_entities)`
     (`local_context.py:256-317`). El ensamblado respeta además `max_context_tokens` con corte por tabla
     (`local_context.py:77-81`).
   - **Adaptación en Ego:** es la pieza de mayor valor y **no existe en Ego**: `GraphRagEngine` solo aplica un tope
     plano `maxDegreePerNode` (10 por defecto, `packages/knowledge/src/GraphRagEngine.ts:103-104`, `:345-385`).
     Sustituir el corte plano por *rank → in-network → out-network por centralidad* y un presupuesto
     `maxDegree * nº de semillas`.
   - **Relación con Backlog Ego:** `KB-06`, `DOM-03`, `VDB-REQ-07`.

### Bloque C: Construcción del grafo y sus resúmenes ###

*Ubicación en fuente:* `repos-referencia/graphrag/packages/graphrag/graphrag/index/operations/`

1. **Extracción de grafo por LLM con bucle de *gleaning* (`extract_graph/graph_extractor.py:59-122`)**
   - **Qué hace:** tras la primera extracción de tuplas `<|>` delimitadas por `##`, si `max_gleanings > 0` el
     extractor **re-pregunta al modelo** con `CONTINUE_PROMPT` y, entre gleanings, con `LOOP_PROMPT` que el modelo
     responde `"Y"` para continuar o cualquier otra cosa para parar (`graph_extractor.py:101-120`). Dos criterios de
     salida: se agota `max_gleanings` o el modelo declara que no hay más entidades.
   - **Adaptación en Ego:** `packages/knowledge/src/extractors/FactExtractor.ts` es **heurístico y determinista**
     (regex de verbos y pares clave-valor, `FactExtractor.ts:9-10`, `:66-152`): no ve entidades que no estén en forma
     canónica. El gleaning es la vía para elevar la cobertura de `kb/facts` cuando la fuente es prosa, pero debe
     seguir la cadena `ModelRouter` → `ApprovalEngine` (principio 6).
   - **Relación con Backlog Ego:** `KB-03`, `KB-08`, `DOM-03`.
2. **Clustering jerárquico Leiden y resúmenes de comunidad
   (`graphs/hierarchical_leiden.py:11-26`, `operations/summarize_communities/summarize_communities.py:37-100`)**
   - **Qué hace:** `hierarchical_leiden` delega íntegramente en el binario `graspologic_native`
     (`hierarchical_leiden.py:8`, `:17-26`) con `max_cluster_size=10` y semilla fija `0xDEADBEEF`; el resultado son
     comunidades multinivel (`level`, `parent`, `children`) que luego se resumen con un LLM por community
     (`summarize_communities.py:75-98`) y se explotan en hallazgos con `summary` + `explanation`
     (`summarize_communities/community_reports_extractor.py:25-41`).
   - **Adaptación en Ego:** **descartar**. El grafo canónico de Ego es `kb/facts` con aristas tipadas y supersesión
     atómica (`KB-08`, `packages/knowledge/src/FactLifecycle.ts`), y el grafo de proyecto ya aporta la jerarquía
     Decisión→ADR→Commit→Files→Tests→Outcome (`KB-11`, `packages/knowledge/src/ProjectMemoryGraph.ts`).
   - **Relación con Backlog Ego:** `KB-06`, `KB-08`, `KB-11`.
3. **Poda determinista del grafo antes de clusterizar (`index/operations/prune_graph.py:14-115`)**
   - **Qué hace:** cuatro filtros independientes y cumulativos: (a) eliminación del nodo *ego* de mayor grado
     (`remove_ego_nodes`, `prune_graph.py:45-47`); (b) umbral de grado con límite superior por desviación típica
     `mean + k·std` (`prune_graph.py:50-58`, `:109-115`); (c) filtro de frecuencia de entidad con el mismo criterio
     estadístico (`:66-76`); (d) recorte de aristas por **percentil de peso** y, opcionalmente, recorte a la
     **componente conexa mayor** (`:86-104`).
   - **Adaptación en Ego:** criterios puramente deterministas y sin dependencias: son aplicables tal cual a la fase 2
     de `GraphRagEngine.expandViaNativeGraph` (`packages/knowledge/src/GraphRagEngine.ts:272-340`), que hoy solo
     corta por grado plano.
   - **Relación con Backlog Ego:** `KB-06`, `VDB-REQ-07`.

### Bloque D: Caché, incrementalidad y configuración ###

*Ubicación en fuente:* `repos-referencia/graphrag/packages/graphrag-cache/`,
`packages/graphrag-llm/graphrag_llm/middleware/`, `packages/graphrag/graphrag/config/`

1. **Caché de respuestas LLM con clave por hash de argumentos y métrica de acierto
   (`middleware/with_cache.py:21-154`, `graphrag_cache/cache_key.py:34-36`)**
   - **Qué hace:** middleware que envuelve completion y embedding; calcula `cache_key = hash_data(kwargs)` y
     almacena `{response, metrics}`; **no cachea** ni el streaming ni las respuestas simuladas
     (`with_cache.py:59-65`, `:114-116`); al recuperar de caché inyecta `metrics["cached_responses"] = 1` (`:87`,
     `:135`) y, ante un error de deserialización, degrada a la llamada real en lugar de fallar (`:92-95`).
   - **Adaptación en Ego:** el patrón ya existe para el catálogo de modelos
     (`packages/models/src/ModelCatalog.ts:195-260`, clave por proveedor + fingerprint de credencial, TTL 1 h,
     persistido en `gov/catalog`) pero **no** para respuestas de completación. Extender a `packages/models/src/` con
     store en VantaDB; **descartar** las implementaciones `Json`/`Sqlite`/`Memory` de
     `packages/graphrag-cache/graphrag_cache/cache_factory.py:65-89` (SQLite está prohibido como sustrato).
   - **Relación con Backlog Ego:** `CORE-03`, `CORE-08`, `KB-03`.
2. **Límite de tasa por tokens en el middleware de LLM (`middleware/with_rate_limiting.py:48-77`)**
   - **Qué hace:** calcula el coste de la llamada en tokens (`max_tokens` + tokens del prompt o de los embeddings) y
     **adquiere un cupo del limitador antes de invocar al proveedor** (`with_rate_limiting.py:51-62`): la cuota es de
     tokens, no de peticiones.
   - **Adaptación en Ego:** `ExecutionManager` limita concurrencia de **herramientas** (`maxConcurrentExecutions` = 5,
     `packages/execution/src/ExecutionManager.ts:75`) y `SubEgoCallQuota` cuenta llamadas por Sub-Ego
     (`packages/execution/src/CircuitBreaker.ts:204`), pero **no hay contabilidad de tokens en vuelo** para las
     llamadas al modelo. Es la pieza que falta para que `SUB-09` (presupuesto por Sub-Ego) sea un presupuesto de
     tokens y no de llamadas.
   - **Relación con Backlog Ego:** `SUB-09`, `CORE-03`, `DEC-08`.
3. **Indexación incremental por delta con merge de identificadores monótonos
   (`index/update/incremental_index.py:29-78`)**
   - **Qué hace:** `get_delta_docs` compara títulos del dataset de entrada con los documentos ya finalizados y
     devuelve `InputDelta(new_inputs, deleted_inputs)` (`incremental_index.py:29-58`); `concat_dataframes` reetiqueta
     las filas nuevas con `initial_id = old_df["human_readable_id"].max() + 1` antes de concatenar
     (`incremental_index.py:61-77`); el runner copia el output previo a una carpeta `previous` antes de fusionar
     (`run_pipeline.py:69-73`, `:182-189`).
   - **Adaptación en Ego:** `KnowledgeIndexer.indexDocument` ya es **idempotente por `content_hash`**
     (`packages/knowledge/src/KnowledgeIndexer.ts:50-63`) y `FactLifecycle` sustituye hechos sin borrado (`KB-08`),
     pero **no existe** la ruta de re-indexado incremental que re-derive aristas y hechos de un subconjunto de
     documentos modificados.
   - **Relación con Backlog Ego:** `KB-03`, `KB-08`, `TASK-01`.
4. **Configuración declarativa por YAML validada por modelo de datos
   (`config/models/graph_rag_config.py:40-333`, `config/load_config.py:14-47`, `config/init_content.py:12-120`)**
   - **Qué hace:** un único `GraphRagConfig` (pydantic v2) compone sub-configuraciones por etapa (`extract_graph`,
     `extract_claims`, `cluster_graph`, `community_reports`, `local_search`, `global_search`, `cache`, `chunking`…),
     con validadores `@model_validator(mode="after")` que resuelven rutas y comprueban coherencia
     (`graph_rag_config.py:84-92`, `:325-333`); `load_config` acepta overrides anidados de CLI
     (`load_config.py:14-47`); `INIT_YAML` es la plantilla que `graphrag init` materializa
     (`init_content.py:12-120`).
   - **Adaptación en Ego:** Ego ya tiene el patrón de configuración declarativa validada
     (`packages/ui-runtime/src/schemas/components.ts` con Zod, `CANV-01`) y de mutación segura de ficheros
     (`packages/execution/src/SafeConfigMutation.ts:25`, `ACT-09`), pero **no** un contrato tipado que parametrize la
     cadena de ingesta/indexado de conocimiento.
   - **Relación con Backlog Ego:** `KB-01`, `KB-03`, `SUB-02`, `ACT-09`.

**Correspondencia inventario (§2) → hallazgos cerrados (§4):** Bloque A patrón 1 + Bloque D patrón 4 → `GRAG-01`
(pipeline declarativo: registro de workflows **y** contrato tipado por etapa) · Bloque B patrón 1 → `GRAG-02`
(diferido) · Bloque B patrón 2 → `GRAG-09` · Bloque C patrón 1 → `GRAG-04` · Bloque C patrón 2 → `GRAG-06`
(descartada) · Bloque C patrón 3 → `GRAG-03` · Bloque D patrón 1 → `GRAG-05` · Bloque D patrón 2 → `GRAG-07` ·
Bloque D patrón 3 → `GRAG-08`. El volcado de estado y estadísticas por paso (Bloque A patrón 2) no genera hallazgo
propio: se cierra como descarte en §5 por estar cubierto por `EventBus` y `TaskCheckpoint`.

---

## 3. Matriz de Extracción vs Descarte ##

| Componente GraphRAG | Acción en Ego | Razón Técnica / Arquitectónica |
| --- | :---: | --- |
| `index/workflows/factory.py` (registro + lista declarativa de workflows) | **EXTRAER & ADAPTAR** | Permite componer y versionar la ingesta sin reescribir `main.ts`; puro TypeScript sin dependencias. |
| `index/run/run_pipeline.py` (volcado de estado y stats por paso) | **DESCARTAR** | Cubierto por `EventBus` (ACT-05/ACT-12) y `TaskCheckpoint` (TASK-03): duplicar el mecanismo sería redundancia. |
| `query/structured_search/local_search/` + `context_builder/local_context.py:232-317` | **EXTRAER & ADAPTAR** | La priorización in-network/out-network con presupuesto por grafo es lógica pura y corrige el tope plano de grado de `GraphRagEngine`. |
| `query/structured_search/global_search/search.py` (map-reduce) | **DIFERIR** | Depende de los resúmenes de comunidad (descartados) y multiplica el coste por llamada al modelo. |
| `graphs/hierarchical_leiden.py` + `operations/summarize_communities/` | **DESCARTAR** | Binario `graspologic-native` (prohibido en el fast path) y capa de comunidades sustituida por `kb/facts` + `ProjectMemoryGraph` (KB-08, KB-11). |
| `operations/extract_graph/graph_extractor.py` (gleaning) | **EXTRAER & ADAPTAR** | Eleva la cobertura de `kb/facts` en prosa; se encadena con `ModelRouter` + `ApprovalEngine`. |
| `index/operations/prune_graph.py` (poda por grado/frecuencia/percentil de peso + LCC) | **EXTRAER PATRÓN** | La poda por percentil de peso de arista y el corte por componente conexa mayor son criterios deterministas reutilizables en la expansión de `GraphRagEngine` (VDB-REQ-07). |
| `graphrag-llm/middleware/with_cache.py` (patrón) + `graphrag-cache/*` (Json / Memory / Sqlite) | **EXTRAER PATRÓN** | Solo el patrón de clave por hash + métrica `cached_responses`, reimplementado sobre VantaDB; las implementaciones `Json`/`Sqlite`/`Memory` (`cache_factory.py:65-89`) se descartan: SQLite y ficheros JSON sueltos están prohibidos como sustrato de persistencia (AGENTS.md §4). |
| `graphrag-llm/middleware/with_rate_limiting.py` (cuota por tokens) | **EXTRAER & ADAPTAR** | Complementa `ExecutionManager` con contabilidad de tokens en vuelo. |
| `index/update/incremental_index.py` + `run_pipeline.py:69-73` | **EXTRAER & ADAPTAR** | Re-indexado por delta con merge monótono de identificadores; hoy solo existe la idempotencia por hash. |
| `config/models/graph_rag_config.py` + `init_content.py` | **EXTRAER PATRÓN** | Contrato tipado por etapa con validación; se adapta a Zod, no a YAML + pydantic. |
| `graphrag-vectors/*` (LanceDB, Azure AI Search, CosmosDB) | **DESCARTAR** | Vector store externo; el sustrato vectorial de Ego es VantaDB (HNSW) y la inferencia densa vive solo en `vantadb-mcp` (guardrail §4). |
| `packages/graphrag/pyproject.toml` (runtime Python completo) + `graphrag-input/graphrag_input/markitdown.py` | **DESCARTAR** | Python está prohibido como dependencia de núcleo (queda confinado al sidecar de ingesta, `KB-02`) y la conversión multiformato ya está resuelta en `KB-01` (`packages/knowledge/src/ingest/DocumentParser.ts`) con `AdaptiveChunker` jerárquico (`packages/knowledge/src/ingest/AdaptiveChunker.ts:16-172`). |

---

## 4. Estado real verificado (2026-10-20) ##

> Criterio de cierre (`docs/extractions/README.md` §4): `✅ Completada` exige fichero adaptado **y** caller en
> producción verificado por grep sobre `packages/` + `apps/desktop/` (excluyendo `test/`, `dist/`, `node_modules/`).
>
> **Este repositorio es nuevo: nada ha sido asimilado todavía.** Verificaciones ejecutadas sobre `packages/` y
> `apps/desktop/` (las dos primeras devuelven 0 coincidencias; la tercera lista los puntos de cableado ya en
> producción):
>
> ```text
> Select-String "leiden|Leiden|communityReport|community_report|mapReduce|map-reduce|globalSearch|global_search" -> 0
> Select-String "llm_cache|system/llm|LlmCache|responseCache" -> 0
> Select-String "GraphRagEngine|HybridSearch|KnowledgeIndexer" -> main.ts:2206-2208, register-ipc.ts:1363
> ```

| ID | Patrón | Estado | Evidencia / Fundamento |
| --- | --- | :---: | --- |
| `GRAG-01` | Pipeline declarativo de indexación (registro de workflows + contrato tipado por etapa) | 🆕 Pendiente | No existe en Ego: la ingesta es una cadena lineal `DocumentParser` → `AdaptiveChunker` → `KnowledgeIndexer` (`packages/knowledge/src/ingest/`, `packages/knowledge/src/KnowledgeIndexer.ts`), sin registro de pasos ni config por etapa. **Cableado:** crear `packages/knowledge/src/KnowledgePipeline.ts` con registro por nombre + lista de pasos, y `packages/knowledge/src/schemas/knowledgePipeline.ts` con el contrato Zod por etapa (equivalente a `GraphRagConfig`); instanciarlo en `apps/desktop/src/main.ts:2206` junto a `knowledgeIndexer`. **Responsable:** owner de `packages/knowledge` (Fase 06, `KB-01`/`KB-03`). |
| `GRAG-02` | Global search map-reduce sobre resúmenes de comunidad | ⏳ Futura (Fase 06, P1) | Depende de la capa de comunidades (descartada en `GRAG-06`) y multiplica el coste por llamada al modelo, contra el presupuesto de `ModelRouter` (`packages/models/src/ModelRouter.ts:581-614`). **Fase destino:** Fase 06 (Knowledge) en su variante P0-Beta, solo si se abre una capa de resúmenes; revisar entonces contra `KB-06` y `DOM-03`. |
| `GRAG-03` | Poda del grafo por percentil de peso de arista y componente conexa mayor | 🆕 Pendiente | Ego solo tiene corte plano de grado (`packages/knowledge/src/GraphRagEngine.ts:103-104`). **Cableado:** añadir poda por percentil y LCC en `GraphRagEngine.expandViaNativeGraph` (`packages/knowledge/src/GraphRagEngine.ts:272-340`) como criterios deterministas de `VDB-REQ-07` (`docs/VANTADB-FEEDBACK-Y-MEJORAS.md:225-238`). **Responsable:** owner de `packages/knowledge`. |
| `GRAG-04` | Extracción de grafo por LLM con bucle de gleaning | 🆕 Pendiente | `packages/knowledge/src/extractors/FactExtractor.ts` es heurístico y determinista (`FactExtractor.ts:9-10`, `:66-152`); no extrae entidades de prosa libre. **Cableado:** nueva ruta `extractFactsWithLlm` en `packages/knowledge/src/extractors/` invocada desde `KnowledgeIndexer` solo tras pasar `ModelRouter` (`packages/models/src/ModelRouter.ts`) y `ApprovalEngine` (`packages/execution/src/ApprovalEngine.ts:115`), por el principio 6. **Responsable:** owner de `packages/knowledge` + `packages/decision`. |
| `GRAG-05` | Caché de respuestas LLM con clave por hash y métrica de acierto | 🆕 Pendiente | Solo existe caché de catálogo (`packages/models/src/ModelCatalog.ts:195-260`, TTL 1 h en `gov/catalog`); grep de `llm_cache \| responseCache` sobre `packages/`+`apps/` → 0. **Cableado:** `packages/models/src/LlmResponseCache.ts` con clave `sha256(modelo+mensajes+parámetros)` y store en VantaDB; instrumentar `metrics.cached_responses`. **Responsable:** owner de `packages/models`. |
| `GRAG-06` | Clustering jerárquico Leiden + resúmenes de comunidad | 🚫 Descartada (con justificación) | Requiere el binario `graspologic_native` (`packages/graphrag/graphrag/graphs/hierarchical_leiden.py:8`, `:17-26`), incompatible con el fast path Node/napi-rs de Ego; y la capa de comunidades con resúmenes LLM es sustituida por el grafo canónico de hechos `kb/facts` (`packages/knowledge/src/schemas/knowledge.ts:41-55`), la supersesión atómica `KB-08` (`packages/knowledge/src/FactLifecycle.ts`) y el Project Memory Graph `KB-11` (`packages/knowledge/src/ProjectMemoryGraph.ts`). Grep de `leiden \| Leiden \| communityReport` sobre `packages/`+`apps/` → 0. |
| `GRAG-07` | Límite de tasa por tokens en el middleware de LLM | 🆕 Pendiente | `ExecutionManager` limita concurrencia de herramientas (`packages/execution/src/ExecutionManager.ts:75`) y `SubEgoCallQuota` cuenta llamadas, no tokens (`packages/execution/src/CircuitBreaker.ts:204`); no hay contabilidad de tokens en vuelo. **Cableado:** contador de tokens por Sub-Ego en `packages/models/src/ModelRouter.ts` alimentando `SUB-09`; el turnstile se toma de `packages/execution/src/ExecutionManager.ts:392-443`. **Responsable:** owner de `packages/models` + `packages/execution`. |
| `GRAG-08` | Indexación incremental por delta con identificadores monótonos | 🆕 Pendiente | `KnowledgeIndexer.indexDocument` es idempotente por `content_hash` (`packages/knowledge/src/KnowledgeIndexer.ts:50-63`) y `FactLifecycle` sustituye sin borrado (`KB-08`), pero no hay ruta de re-indexado por delta que re-derive hechos y aristas de documentos modificados. **Cableado:** `packages/knowledge/src/IncrementalIndexPlan.ts` computando el delta sobre `kb/docs` y re-derivando `kb/facts` vía `KnowledgeIndexer.indexFact`. **Responsable:** owner de `packages/knowledge`. |
| `GRAG-09` | Priorización de relaciones in-network/out-network con presupuesto de grafo | 🆕 Pendiente | `GraphRagEngine` corta por grado plano (`packages/knowledge/src/GraphRagEngine.ts:103-104`, `:345-385`); no hay ranking por centralidad ni presupuesto `top_k * nº de semillas`. **Cableado:** sustituir el corte de `extractNodeReferences` (`packages/knowledge/src/GraphRagEngine.ts:345-385`) por ordenación in-network → out-network por enlaces compartidos, con presupuesto proporcional al número de semillas. **Responsable:** owner de `packages/knowledge` (Fase 06, `KB-06`). |

**Recuento:** 0 `✅ Completada` · 1 `🚫 Descartada` · 7 `🆕 Pendiente` · 1 `⏳ Futura` — **9 tareas**.

---

## 5. Descarte normalizado a la forma canónica ##

Las filas de la matriz §3 usaban la forma `**DESCARTAR**`; se normalizan aquí a `🚫 Descartada (con justificación)`
(AGENTS.md §4) conservando el motivo original:

| Componente GraphRAG | Veredicto | Fundamento |
| --- | :---: | --- |
| `index/run/run_pipeline.py` (volcado de estado y stats por paso) | 🚫 **Descartada (con justificación)** | Cubierto por el `EventBus` (`ACT-05`, `ACT-12`) y `TaskCheckpoint` (`TASK-03`); replicarlo crearía una segunda vía de telemetría de pipeline. |
| `graphs/hierarchical_leiden.py` + `operations/summarize_communities/` | 🚫 **Descartada (con justificación)** | Dependencia del binario `graspologic_native`, incompatible con el fast path Node/napi-rs; el grafo canónico de Ego (`kb/facts` + `ProjectMemoryGraph`, `KB-08`/`KB-11`) ya cubre jerarquía y linaje. |
| `graphrag-cache/json_cache.py`, `sqlite_cache.py`, `memory_cache.py` | 🚫 **Descartada (con justificación)** | SQLite y ficheros JSON sueltos están prohibidos como sustrato de persistencia (AGENTS.md §4); la caché debe residir en VantaDB (`packages/memory/EgoMemoryAdapter.ts`). Solo se conserva el patrón de clave por hash de `with_cache.py`, cerrado en `GRAG-05`. |
| `graphrag-vectors/*` (LanceDB, Azure AI Search, CosmosDB) | 🚫 **Descartada (con justificación)** | Vector store externo y embeddings contra API de proveedor: el guardrail §4 reserva la inferencia densa al subproceso `vantadb-mcp` y el fast path es BM25 puro. |
| Runtime Python completo (`packages/graphrag/pyproject.toml:34-67`) + `graphrag-input/graphrag_input/markitdown.py` | 🚫 **Descartada (con justificación)** | Python está prohibido como dependencia de núcleo; queda confinado al sidecar opcional de ingesta masiva (`KB-02`, `packages/knowledge/src/ingest/PythonSidecarBridge.ts:43`). La conversión multiformato ya está resuelta en `KB-01` (`packages/knowledge/src/ingest/DocumentParser.ts`) con `AdaptiveChunker` jerárquico (`packages/knowledge/src/ingest/AdaptiveChunker.ts:16-172`). |
