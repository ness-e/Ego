---
kind: review
status: active
description: "Backlog especializado para la revisión, extracción de patrones y adaptación técnica de
  microsoft/graphrag hacia el monorepo de Ego."
tags: [ego, graphrag, extraction, review, knowledge, graph, rag, retrieval]
schema: "10-column canonical schema (.agents/references/backlog-format.md compatible)"
---

# Backlog de Revisión y Extracción: Microsoft GraphRAG (microsoft/graphrag) #

## GraphRAG modular sobre grafos: qué se extrae a un motor que ya tiene GraphRAG en producción ##

> **Propósito:** Registro canónico de auditoría y extracción de patrones de `repos-referencia/graphrag`
> (microsoft/graphrag v3.3.0, MIT, commit `5faaaf4`) hacia el monorepo de Ego.
>
> **Regla de Operación:** *No copiar código directamente*. Extraer la lógica de diseño, contratos y patrones
> arquitectónicos, reescribiendo en TypeScript estricto, React 19 y Node 22 Main Process, con VantaDB como sustrato
> de memoria.
>
> **Alcance de esta revisión:** Ego **ya tiene GraphRAG implementado y en producción** (`KB-06`,
> `apps/desktop/src/main.ts:2206-2208`). Este backlog no abre una capacidad nueva: endurece el pipeline, la
> estrategia de consulta, la caché y la configuración de la capa de conocimiento.
>
> **Esquema:** Tabla canónica de 10 columnas: `ID`, `Severidad`, `Hallazgo`, `Archivo GraphRAG`, `Esfuerzo`,
> `Prioridad`, `Estado`, `Descripción & Adaptación en Ego`, `Relaciones Ego`, `Dependencias`.

---

## 0. Verificación de estado (2026-10-20) ##

Criterio de `✅ Completada` (`docs/extractions/README.md` §4): existe el fichero adaptado **y** hay un caller en
producción (grep sobre `packages/` + `apps/desktop/`, excluyendo `test/`, `dist/` y `node_modules/`).

| Estado | Significado canónico |
| --- | --- |
| `✅ Completada` | Asimilado, integrado y con **caller en producción verificado**. La celda cita la ruta real. |
| `🚫 Descartada (con justificación)` | El patrón no se aplica en Ego, fue sustituido por otro módulo canónico, o viola un guardrail. La celda contiene el motivo técnico. |
| `🆕 Pendiente` | Asimilado (el código existe y está probado) pero **sin caller en producción**. La celda dice el cableado exacto y quién lo ejecuta. |
| `⏳ Futura (fase)` | Diferido a una fase posterior, con fase destino explícita. |

**Nota de alcance — repositorio nuevo:** GraphRAG no estaba en el catálogo de extracciones antes de esta revisión.
**Nada ha sido asimilado todavía**, por lo que el recuento de `✅ Completada` es 0: no existe ningún fichero derivado
de este repo en `packages/` ni en `apps/desktop/`. Búsquedas de verificación ejecutadas sobre `packages/` +
`apps/desktop/` (las tres primeras devuelven 0 coincidencias; las dos últimas listan los puntos ya en producción):

```text
Select-String "leiden|Leiden|communityReport|community_report|mapReduce|map-reduce|globalSearch|global_search" -> 0
Select-String "llm_cache|system/llm|LlmCache|responseCache" -> 0
Select-String "GraphRagEngine|HybridSearch|KnowledgeIndexer" -> main.ts:2206-2208, register-ipc.ts:1363
Select-String "VDB-REQ-0[789]" -> GraphRagEngine.ts:56,268 · HybridSearch.ts:15,36 · schemas/knowledge.ts:65
```

---

## 1. Resumen Ejecutivo de Tareas de Extracción ##

| Grupo de Trabajo | Rango IDs | Tareas | Fases de Ego Impactadas | Prioridad | Beneficio Principal |
| --- | --- | :---: | --- | :---: | --- |
| **A. Pipeline de indexación** | `GRAG-01`, `GRAG-03`, `GRAG-08` | 3 | Fase 06 (`KB`) | 🟠 P1 | Indexación declarativa por pasos, poda determinista del grafo y re-indexado por delta |
| **B. Estrategia de consulta** | `GRAG-02`, `GRAG-09` | 2 | Fase 06 (`KB`), Fase 09 (`DOM`) | 🟠 P1 | Presupuesto de grafo en la consulta local; map-reduce diferido |
| **C. Construcción del grafo** | `GRAG-04`, `GRAG-06` | 2 | Fase 06 (`KB`) | 🔴 P0 / 🟠 P1 | Gleaning por LLM para `kb/facts`; descarte de la capa de comunidades |
| **D. Caché, tasa y configuración** | `GRAG-05`, `GRAG-07` | 2 | Fase 01 (`CORE`), Fase 03 (`SUB`) | 🟠 P1 | Caché de respuestas LLM por hash y cuota de tokens en vuelo |
| **TOTAL** | `GRAG-01..09` | **9** | **Fases 01, 03, 06, 09** | — | — |

### MATRIZ DE DISTRIBUCIÓN POR FASE ###

```text
Fase 01 Core (CORE-03, CORE-08)  [GRAG-05]  caché de respuestas LLM por hash
Fase 03 Sub-Egos (SUB-09)        [GRAG-07]  cuota de tokens en vuelo por Sub-Ego
Fase 06 Knowledge (KB-01..KB-11) [GRAG-01]  pipeline declarativo de indexación
                                     [GRAG-03]  poda por percentil de peso + LCC
                                     [GRAG-04]  extracción de grafo por LLM (gleaning)
                                     [GRAG-08]  indexación incremental por delta
Fase 09 Dominios (DOM-03)         [GRAG-09]  priorización in-network/out-network
Fase 06 (P1, diferida)            [GRAG-02]  global search map-reduce (bloqueado)
```

#### Recuento de estados (verificado sobre las 9 filas de la tabla §2) ####

| `✅ Completada` | `🚫 Descartada` | `🆕 Pendiente` | `⏳ Futura` | Total |
| :---: | :---: | :---: | :---: | :---: |
| 0 | 1 | 7 | 1 | **9** |

---

## 2. Catálogo Detallado de Extracción (10 Columnas Canónicas) ##

| ID | Severidad | Hallazgo | Archivo GraphRAG | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GRAG-01` | 🟠 Alta | **Pipeline de indexación declarativo (registro de workflows + contrato tipado por etapa)** | `packages/graphrag/graphrag/index/workflows/factory.py:17-97` · `config/models/graph_rag_config.py:40-333` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Patrón **no asimilado**: no existe fichero adaptado ni caller en Ego. La ingesta de Ego es hoy una cadena lineal `DocumentParser` → `AdaptiveChunker` → `KnowledgeIndexer` (`packages/knowledge/src/ingest/`, `packages/knowledge/src/KnowledgeIndexer.ts`), sin registro de pasos ni config por etapa. En el origen el pipeline es una lista ordenada de nombres de workflow resuelta contra un registro (`factory.py:20`, `:52-83`), con variantes Fast/Update y override por config (`factory.py:46`, `graph_rag_config.py:171-174`); la configuración es un único modelo pydantic que compone sub-configuraciones por etapa con validadores `mode="after"` (`graph_rag_config.py:84-92`, `:325-333`). **Cableado exacto:** crear `packages/knowledge/src/KnowledgePipeline.ts` con registro por nombre (`Map<string, Step>`) y lista ordenada de pasos, y `packages/knowledge/src/schemas/knowledgePipeline.ts` con el contrato Zod por etapa; instanciarlo en `apps/desktop/src/main.ts:2206` junto a `knowledgeIndexer`. **Responsable:** owner de `packages/knowledge` (Fase 06). | Ego: `KB-01`, `KB-03`, `KB-06` · Extracción: `docs/extractions/graphrag.md` §2 Bloque A | `GRAG-08` |
| `GRAG-02` | 🟡 Media | **Global search map-reduce con puntuación de relevancia y presupuesto de tokens** | `packages/graphrag/graphrag/query/structured_search/global_search/search.py:142-214`, `:306-431` | 🔴 3d | 🔵 P2 | ⏳ Futura (Fase 06, P1) | Fase *map* paralela con `Semaphore(32)`, fase *reduce* que descarta los puntos con `score == 0`, ordena por puntuación y trunca por `max_data_tokens`; devuelve respuesta enlatada si no hay nada relevante (`NO_DATA_ANSWER`, `:340-353`). **Motivo del diferimiento:** depende de la capa de resúmenes de comunidad —descartada en `GRAG-06`— y multiplica el coste por llamada, contra el presupuesto de `ModelRouter` (`packages/models/src/ModelRouter.ts:581-614`). **Fase destino:** Fase 06 en su tramo P0-Beta, solo si se abre una capa de resúmenes; reevaluar contra `KB-06` y `DOM-03`. | Ego: `KB-06`, `DOM-03` | `GRAG-06` |
| `GRAG-03` | 🟠 Alta | **Poda determinista del grafo por percentil de peso de arista y componente conexa mayor (LCC)** | `packages/graphrag/graphrag/index/operations/prune_graph.py:14-115` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | Patrón **no asimilado**: no existe fichero adaptado ni caller en Ego. Ego solo aplica un tope plano de grado (`packages/knowledge/src/GraphRagEngine.ts:103-104`) y no distingue ruido de señal por peso de arista. **Cableado exacto:** añadir en `GraphRagEngine.expandViaNativeGraph` (`packages/knowledge/src/GraphRagEngine.ts:272-340`) un filtro por percentil de peso y un recorte por LCC, alineado con `VDB-REQ-07` (`docs/VANTADB-FEEDBACK-Y-MEJORAS.md:225-238`). **Responsable:** owner de `packages/knowledge`. | Ego: `KB-06` · VantaDB: `VDB-REQ-07` | `GRAG-09` |
| `GRAG-04` | 🔴 Crítica | **Extracción de grafo por LLM con bucle de gleaning** | `packages/graphrag/graphrag/index/operations/extract_graph/graph_extractor.py:59-122` · `extract_covariates/claim_extractor.py:119-163` | 🟡 2d | 🔴 P0 | 🆕 Pendiente | Patrón **no asimilado**: no existe fichero adaptado ni caller en Ego. `packages/knowledge/src/extractors/FactExtractor.ts` es heurístico y determinista (regex de verbos y pares clave-valor, `FactExtractor.ts:9-10`, `:66-152`): no extrae entidades de prosa libre. El gleaning re-pregunta al modelo con `CONTINUE_PROMPT` y `LOOP_PROMPT` hasta `max_gleanings` o hasta que el modelo responde distinto de `"Y"`. **Cableado exacto:** nueva ruta `extractFactsWithLlm` en `packages/knowledge/src/extractors/` invocable desde `KnowledgeIndexer`, siempre a través de `ModelRouter` (`packages/models/src/ModelRouter.ts`) y `ApprovalEngine` (`packages/execution/src/ApprovalEngine.ts:115`) por el principio 6. **Responsable:** owner de `packages/knowledge` + `packages/decision`. | Ego: `KB-03`, `KB-08`, `DOM-03`, `ACT-06` | `GRAG-05` |
| `GRAG-05` | 🟠 Alta | **Caché de respuestas LLM con clave por hash de argumentos y métrica de acierto** | `packages/graphrag-llm/graphrag_llm/middleware/with_cache.py:21-154` · `packages/graphrag-cache/graphrag_cache/cache_key.py:34-36` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Patrón **no asimilado**: no existe fichero adaptado ni caller en Ego. El middleware calcula `cache_key = hash_data(kwargs)`, guarda `{response, metrics}`, no cachea streaming ni respuestas simuladas (`with_cache.py:59-65`) e inyecta `metrics["cached_responses"] = 1` (`:87`, `:135`), degradando a la llamada real ante error de deserialización (`:92-95`). Ego ya cachea el **catálogo** de modelos (`packages/models/src/ModelCatalog.ts:195-260`, TTL 1 h en `gov/catalog`) pero no las **respuestas**. **Cableado exacto:** `packages/models/src/LlmResponseCache.ts` con clave `sha256(modelo + mensajes + parámetros)` y store en VantaDB; instrumentar el contador de aciertos. Las implementaciones `Json`/`Sqlite`/`Memory` del origen se descartan (SQLite prohibido). **Responsable:** owner de `packages/models`. | Ego: `CORE-03`, `CORE-08`, `KB-03` | — |
| `GRAG-06` | 🔴 Crítica | **Clustering jerárquico Leiden y capa de resúmenes de comunidad** | `packages/graphrag/graphrag/graphs/hierarchical_leiden.py:11-26` · `index/operations/summarize_communities/summarize_communities.py:37-100` | — | — | 🚫 Descartada (con justificación) | **Fundamento:** (1) requiere el binario `graspologic_native` (`hierarchical_leiden.py:8`, `:17-26`), incompatible con el fast path Node/napi-rs de Ego y con el guardrail §4 de AGENTS.md; (2) la capa de comunidades con resúmenes LLM por community es sustituida por el grafo canónico de Ego: hechos tipados `(subject, predicate, object)` (`packages/knowledge/src/schemas/knowledge.ts:41-55`), supersesión atómica sin borrado (`KB-08`, `packages/knowledge/src/FactLifecycle.ts`) y Project Memory Graph con aristas Decisión→ADR→Commit→Files→Tests→Outcome (`KB-11`, `packages/knowledge/src/ProjectMemoryGraph.ts`); (3) grep de `leiden \| Leiden \| communityReport` sobre `packages/`+`apps/` → 0, no hay caller ni módulo equivalente que retirar. **No se extrae ni se difiere.** | Ego: `KB-06`, `KB-08`, `KB-11` | — |
| `GRAG-07` | 🟠 Alta | **Límite de tasa por tokens en el middleware de LLM** | `packages/graphrag-llm/graphrag_llm/middleware/with_rate_limiting.py:48-77` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Patrón **no asimilado**: no existe fichero adaptado ni caller en Ego. El middleware calcula el coste en tokens (`max_tokens` + tokens del prompt o de los embeddings) y **adquiere cupo antes de invocar al proveedor** (`with_rate_limiting.py:51-62`): la cuota es de tokens, no de peticiones. Ego limita concurrencia de **herramientas** (`packages/execution/src/ExecutionManager.ts:75`, `:392-443`) y cuenta llamadas por Sub-Ego (`packages/execution/src/CircuitBreaker.ts:204`), pero no contabiliza tokens en vuelo. **Cableado exacto:** contador de tokens por Sub-Ego en `packages/models/src/ModelRouter.ts`, alimentando el presupuesto de `SUB-09`, reutilizando el turnstile de `ExecutionManager`. **Responsable:** owner de `packages/models` + `packages/execution`. | Ego: `SUB-09`, `CORE-03`, `DEC-08`, `ACT-03` | `GRAG-05` |
| `GRAG-08` | 🟠 Alta | **Indexación incremental por delta con identificadores monótonos y copia de seguridad previa** | `packages/graphrag/graphrag/index/update/incremental_index.py:29-78` · `index/run/run_pipeline.py:69-73`, `:182-189` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Patrón **no asimilado**: no existe fichero adaptado ni caller en Ego. `get_delta_docs` compara títulos del dataset con los documentos ya finalizados y devuelve `InputDelta(new_inputs, deleted_inputs)` (`incremental_index.py:29-58`); `concat_dataframes` reetiqueta con `initial_id = old_df["human_readable_id"].max() + 1` antes de concatenar (`:61-77`); el runner copia el output previo a una carpeta `previous` antes de fusionar (`run_pipeline.py:69-73`). Ego tiene idempotencia por `content_hash` (`packages/knowledge/src/KnowledgeIndexer.ts:50-63`) y supersesión sin borrado (`KB-08`), pero **no** la ruta de re-indexado por delta. **Cableado exacto:** `packages/knowledge/src/IncrementalIndexPlan.ts` computando el delta sobre `kb/docs` y re-derivando `kb/facts` vía `KnowledgeIndexer.indexFact`, con snapshot previo en VantaDB. **Responsable:** owner de `packages/knowledge`. | Ego: `KB-03`, `KB-08`, `TASK-01`, `REC-01` | `GRAG-01` |
| `GRAG-09` | 🟠 Alta | **Priorización de relaciones in-network / out-network con presupuesto de grafo en la consulta local** | `packages/graphrag/graphrag/query/context_builder/local_context.py:232-317` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | Patrón **no asimilado**: no existe fichero adaptado ni caller en Ego. Las relaciones internas al subgrafo semilla se priorizan siempre; las externas se ordenan por número de enlaces compartidos y se truncan con presupuesto `top_k * nº de entidades` (`local_context.py:256-317`); el ensamblado corta por `max_context_tokens` (`:77-81`). Ego corta por grado plano (`packages/knowledge/src/GraphRagEngine.ts:103-104`, `:345-385`) sin ranking por centralidad. **Cableado exacto:** sustituir el corte de `GraphRagEngine.extractNodeReferences` (`packages/knowledge/src/GraphRagEngine.ts:345-385`) por ordenación in-network → out-network por enlaces compartidos, con presupuesto proporcional al número de semillas. **Responsable:** owner de `packages/knowledge` (Fase 06, `KB-06`). | Ego: `KB-06`, `DOM-03` · VantaDB: `VDB-REQ-07` | `GRAG-03` |

---

## 3. Integración con el Backlog Maestro de Ego ##

Cada tarea `GRAG-*` es **pre-requisito de diseño** de una fase del Backlog Maestro (`docs/roadmap/Backlog.md`).
Ninguna abre fase nueva: todas endurecen la Fase 06 ya cerrada (`KB-01..KB-11`, `✅ Completada 11/11` en
`Backlog.md:30`).

```text
   ┌───────────────────────────────────────────────────────────────────────┐
   │ FASE 01 CORE (CORE-03, CORE-08)                                      │
   │   GRAG-05 ──► caché de respuestas LLM por hash (packages/models)     │
   ├───────────────────────────────────────────────────────────────────────┤
   │ FASE 03 SUB-EGOS (SUB-09)                                            │
   │   GRAG-07 ──► cuota de tokens en vuelo por Sub-Ego                    │
   ├───────────────────────────────────────────────────────────────────────┤
   │ FASE 06 KNOWLEDGE (KB-01..KB-11)                                     │
   │   GRAG-01 ──► pipeline declarativo de indexación                     │
   │   GRAG-03 ──► poda por percentil de peso + LCC                       │
   │   GRAG-04 ──► extracción de grafo por LLM (gleaning)                 │
   │   GRAG-08 ──► indexación incremental por delta                        │
   │   GRAG-02 ──► global map-reduce  (⏳ P1, bloqueado por GRAG-06)      │
   │   GRAG-06 ──► ✗ descartado (comunidades Leiden sustituidas)          │
   ├───────────────────────────────────────────────────────────────────────┤
   │ FASE 09 DOMINIOS (DOM-03)                                            │
   │   GRAG-09 ──► priorización in-network/out-network en GraphRAG        │
   └───────────────────────────────────────────────────────────────────────┘
```

### Protocolo de ejecución por tarea ###

1. **Inspección y desacoplamiento:** releer la ruta exacta en `repos-referencia/graphrag/`, enumerar dependencias
   externas (todas Python/pandas salvo las citadas) y eliminar toda ruta que dependa de Python, Parquet, LanceDB,
   SQLite o de embeddings contra API externa; conservar la lógica pura.
2. **Reescritura:** TypeScript estricto (`strict: true`), Zod para los contratos, VantaDB como único sustrato,
   `ModelRouter` como único acceso a modelos.
3. **Gobernanza:** toda llamada LLM nueva pasa por `ApprovalEngine` (principio 6) y por el `EventBus` (ACT-05/ACT-12).
4. **Cierre:** marcar `✅ Completada` solo con fichero adaptado **y** caller en producción verificado por grep sobre
   `packages/` + `apps/desktop/`; si el patrón no aplica, `🚫 Descartada (con justificación)`; si el código existe y
   está probado pero sin caller, `🆕 Pendiente` con cableado y responsable; si se difiere, `⏳ Futura` con fase
   destino.
5. **Deuda VantaDB:** si la tarea identifica una fricción del motor, registrar el hallazgo en
   `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` antes de dar por cerrada (criterio de cierre §4 de AGENTS.md).

---

## 4. Deuda abierta derivada de esta verificación ##

| # | Ítem | Tipo | Owner | Bloqueante |
| --- | --- | --- | --- | --- |
| D1 | **Desalineación de IDs `VDB-REQ` en el código GraphRAG de Ego.** `packages/knowledge/src/GraphRagEngine.ts:56` y `:268` citan `VDB-REQ-09` como "el binding no expone IQL (`query`)", y `packages/knowledge/src/HybridSearch.ts:15` y `:36` y `packages/knowledge/src/schemas/knowledge.ts:65` citan `VDB-REQ-08` como requisito de "RRF real + coseno denso". En el registro canónico (`docs/VANTADB-FEEDBACK-Y-MEJORAS.md:35-37`) `VDB-REQ-08` es *cifrado en reposo (FIND-249)* y `VDB-REQ-09` es *publicación del binding Node en registry*; no existe entrada para RRF/coseno denso ni para IQL. Las tres referencias apuntan a hallazgos equivocados. | Documentación | Owner `packages/knowledge` + `packages/memory` | No |
| D2 | **Catálogo de extracciones desincronizado.** `docs/extractions/README.md` §3 (tabla de repositorios) y §4.1 (tabla maestra de estado) no incluyen la fila de `graphrag`; al no ser modificado por esta tarea, la sincronización queda pendiente de un proceso que actualice README y `docs/review/README.md`. | Documentación | Owner de `docs/extractions` | No |
| D3 | **`GRAG-01..09` sin ninguna tarea de backlog canónico asociada.** Las 8 filas no descartadas están en estado `🆕 Pendiente` o `⏳ Futura` y ninguna tiene todavía entrada en `docs/roadmap/Backlog.md`; `KB-01..KB-11` ya están `✅ Completada` (`Backlog.md:30`) y no admiten reopening silencioso. Cada `🆕 Pendiente` necesita su alta formal como tarea KB o DOM antes de cablearse. | Backlog | Owner del Backlog Maestro | No |
| D4 | **Grafo de VantaDB sin poblar.** `packages/knowledge/src/GraphRagEngine.ts:57-59` documenta que `insertNode`/`addEdge` no tienen llamantes, por lo que la fase 2 (aristas reales) devuelve `edges: []` y la fase 3 heurística es la activa. Ninguna tarea `GRAG-*` cierra ese hueco: poblar el sustrato de grafo es condición previa para que `GRAG-03` y `GRAG-09` tengan señal real que podar y ordenar. | Código | Owner `packages/memory` | Parcial (bloquea el valor real de GRAG-03 y GRAG-09) |
| D5 | **`GRAG-04` y `GRAG-02` disparan consumo de modelo sin pasar por `ApprovalEngine`.** La extracción por gleaning dispara N llamadas al modelo sobre contenido de usuario; debe quedar encadenada a `ApprovalEngine` (`packages/execution/src/ApprovalEngine.ts:115`) con `ActionIdentity` inmutable antes de cablearse. `GRAG-02` hereda la misma condición si se reanuda en el tramo P1 de la Fase 06. | Decisión | Owner `packages/execution` | No (condición de diseño) |
