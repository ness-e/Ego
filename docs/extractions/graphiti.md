# Extracción Técnica: Graphiti (repos-referencia/graphiti) #

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de patrones |
| Repositorio Origen | `repos-referencia/graphiti/` — `getzep/graphiti`, commit `6e3e3cb` (rama `main`, profundidad 1), paquete `graphiti-core` 0.31.1 (`repos-referencia/graphiti/pyproject.toml:1-12`) |
| Stack del Origen | Python ≥3.10 + Pydantic 2 + drivers de grafo externos (Neo4j, FalkorDB, Neptune, Kuzu) + clientes de embedding externos (OpenAI, Azure, Gemini, Voyage) + FastAPI (`server/`) + servidor MCP (`mcp_server/`) |
| Rol en Ego | Referencia canónica del **modelo de datos temporal/bitemporal** y del pipeline de grafo de conocimiento (extracción de hechos, resolución de entidades, invalidación por contradicción) |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Licencia | Apache-2.0 (`repos-referencia/graphiti/LICENSE:1-3`) |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia ##

Graphiti resuelve para agentes de IA el mismo problema que la Fase 06 de Ego (`KB-01..11`): convertir texto no
estructurado en un grafo de conocimiento consultable. Su valor para Ego **no está en su stack** (Python + Neo4j es
incompatible con los guardrails), sino en tres modelos semánticos que Ego todavía no tiene:

1. **Bitemporalidad real de dos ejes** — separa el *tiempo de validez* (`valid_at`/`invalid_at`: cuándo el hecho fue
   cierto en el mundo) del *tiempo de transacción* (`created_at`/`expired_at`: cuándo el sistema lo supo y lo
   registró). Ego tiene **un solo eje**: `invalid_at` se rellena con `now` en el instante de la supersesión
   (`packages/knowledge/src/FactLifecycle.ts:162`), con lo que el motor etiquetado como "bitemporal"
   (`packages/knowledge/src/BitemporalQueries.ts:77-155`) es en realidad una consulta de tiempo de transacción.
2. **Invalidación por contradicción** — un contrato de prompt estructurado (`duplicate_facts` / `contradicted_facts`)
   combinado con una regla temporal **determinista** que caduca el hecho viejo cuando el nuevo lo refuta. Ego no
   tiene detección de contradicción en ningún paquete.
3. **Cascada de resolución de entidades determinista-primero** (identidad → nombre exacto → similitud → LLM como
   último recurso). Ego deduplica por firma normalizada en barrido, sin cascada ni degradación por niveles.

### Divergencias Fundamentales (Qué Descartamos y Por Qué) ###

| Dimensión | Graphiti | Ego (Cognitive OS) | Decisión Crítica |
|---|---|---|---|
| **Runtime y lenguaje** | Python ≥3.10, Pydantic 2, asyncio (`graphiti_core/pyproject.toml:12-21`) | Node.js 22 en el proceso Main de Electron; TypeScript strict | **DESCARTAR** el runtime Python: AGENTS.md §4 prohíbe Python como dependencia de núcleo. Solo se extraen contratos y reglas, reescritos en TypeScript. |
| **Sustrato de persistencia** | Bases de grafo externas: Neo4j, FalkorDB, Neptune, Kuzu (`graphiti_core/driver/`) | VantaDB 0.8.0 in-process (`NativeVantaDB`, napi-rs) + Fjall LSM + grafo nativo | **DESCARTAR** los drivers externos: `EgoMemoryAdapter` es el gateway único de memoria (AGENTS.md §4, "NO acceso directo a VantaDB"). |
| **Vectorización** | Embeddings densos calculados en el cliente (`graphiti_core/edges.py:292-303`, `graphiti_core/utils/maintenance/edge_operations.py:520`) y reranking con cross-encoder (`graphiti_core/cross_encoder/`) | Fast path BM25 puro (`query_vector: []`, `VDB-REQ-02`); la inferencia densa ONNX y L0-L3 viven solo en el subproceso `vantadb-mcp` | **DESCARTAR** el cálculo de embeddings en TS: guardrail duro de AGENTS.md §4. |
| **Modelo temporal** | Bitemporal de dos ejes (`graphiti_core/edges.py:263-290`) | Un eje (`packages/knowledge/src/schemas/knowledge.ts:50-53`) | **EXTRAER** el segundo eje temporal (`recorded_at`). Es exactamente la petición upstream `VDB-REQ-06` (`docs/VANTADB-FEEDBACK-Y-MEJORAS.md:34,216-221`). |
| **Motor de inferencia** | Pipeline de prompts por etapa: nodos → aristas → dedupe → timestamps → atributos → resúmenes | Un único modelo con AI SDK v7 como adaptador + `ModelRouter` propio (`packages/models`) | **EXTRAER** las *contracciones de salida* de los prompts, no el runtime: la inferencia de Ego sigue pasando por el Model Router. |
| **Recuperación** | Búsqueda híbrida con RRF sobre listas independientes (BM25 + coseno + BFS) | `searchMulti` fusiona por score en un único ranking (`packages/memory/EgoMemoryAdapter.ts:665-681`) | **DESCARTAR** el RRF: el sustrato no expone multi-lista; el propio `packages/knowledge/src/HybridSearch.ts:28-37` lo declara ("**No hay RRF**"). |
| **Aislamiento** | `group_id` por nodo/arista + índices por contexto (`graphiti_core/namespaces/`) | Namespaces jerárquicos en VantaDB (`kb/*`, `proj/*`, `session/*`, `gov/*`, `egos/*`) | **SIN APORTE**: el aislamiento ya está resuelto en la taxonomía de namespaces de Ego. |
| **Contaminación de dominio** | Ninguna: `examples/ecommerce/` es un runner de demo, no un modelo de negocio | — | **LIMPIO**: a diferencia de `career-ops` o `khoj`, Graphiti no introduce schemas de negocio ajenos al SOC. |

---

## 2. Inventario Quirúrgico de Patrones a Extraer ##

### Bloque A: Modelo de datos temporal (bitemporal de dos ejes) ###

*Ubicación en fuente:* `repos-referencia/graphiti/graphiti_core/edges.py`,
`.../utils/maintenance/temporal_edge_utils.py`

1. **`EntityEdge` con cuatro marcas temporales** (`graphiti_core/edges.py:263-290`)
   - **Qué hace:** separa `created_at` / `expired_at` (tiempo de transacción: cuándo se registró y cuándo se dio por
     caduca la afirmación) de `valid_at` / `invalid_at` (tiempo de validez: cuándo el hecho fue cierto en el mundo).
     Añade `reference_time` (`edges.py:285-287`): el instante del episodio que produjo la arista, usado para
     desambiguar fechas relativas.
   - **Adaptación en Ego:** extender el esquema `Fact` (`packages/knowledge/src/schemas/knowledge.ts:50-53`) con
     `recordedAt` y `supersededAt`, dejar `invalidAt` exclusivamente para el tiempo de validez, y hacer que
     `FactLifecycle.supersedeFact` (`packages/knowledge/src/FactLifecycle.ts:117-177`) deje de escribir
     `invalid_at: now` (`:162`). La nomenclatura canónica ya está fijada en
     `docs/architecture/arquitectura-unificada.md:368` (`valid_at` / `recorded_at`).
   - **Relación con Backlog Ego:** `KB-08`, `KB-09`, `DSEK-01`, `DSEK-02`, `VDB-REQ-06`.

2. **Normalización determinista de bounds temporales**
   (`graphiti_core/utils/maintenance/temporal_edge_utils.py:14-37,39-96`)
   - **Qué hace:** tres regex (`_FUTURE_ASSERTION_RE`, `_DEADLINE_RE`, `_ONGOING_STATE_END_RE`) que distinguen una
     aserción en futuro ("will", "plans to") de un *deadline blando* ("by March 2026"), y normalizan
     `valid_at`/`invalid_at` sin llamada al modelo. Las reglas equivalentes están en el prompt
     (`graphiti_core/prompts/extract_edges.py:184-193`): un deadline blando **no** es `invalid_at`; una aserción
     futura usa el `reference_time`, no la fecha futura.
   - **Adaptación en Ego:** función pura `normalizeTemporalBounds(fact, referenceTime, validAt, invalidAt)` en
     `packages/knowledge/src/` — determinista, sin embeddings, por tanto compatible con el guardrail del fast path.
     Hoy `packages/knowledge/src/extractors/FactExtractor.ts:99,140` fija `validAt: now` invariable y el esquema solo
     admite un `temporalScope` grueso (`packages/knowledge/src/schemas/knowledge.ts:47`).
   - **Relación con Backlog Ego:** `KB-04`, `KB-08`, `CORE-12`.

### Bloque B: Detección de contradicciones e invalidación temporal ###

*Ubicación en fuente:* `repos-referencia/graphiti/graphiti_core/prompts/dedupe_edges.py`,
`.../utils/maintenance/edge_operations.py`

1. **Contrato de prompt `duplicate_facts` / `contradicted_facts`**
   (`graphiti_core/prompts/dedupe_edges.py:25-33`, `:44-117`)
   - **Qué hace:** el modelo devuelve **dos listas de índices con numeración continua** sobre dos bloques
     (`EXISTING FACTS` y `FACT INVALIDATION CANDIDATES`). El prompt incluye contrapesos explícitos contra el falso
     positivo ("NEVER mark facts as contradicted unless the new fact explicitly makes the old fact false", `:48-49`;
     "Do NOT infer contradiction from recency alone", `:89-90`) y un ejemplo que separa duplicado de contradicción
     (`"software engineer"` → `"senior engineer"` = contradicción, no duplicado, `:104-106`).
   - **Adaptación en Ego:** contrato de salida estructurado equivalente para el `ModelRouter`, consumido por un
     resolvedor de contradicciones. Hoy **no existe detección de contradicción**: `grep "contradict"` sobre
     `packages/memory` y `packages/tasks` → 0 coincidencias; `packages/tasks/src/DreamConsolidator.ts:274-305` solo
     deduplica por firma y `packages/tasks/src/MemoryCurator.ts:181-187` marca
     `superseded_by: 'curator:stale'` por antigüedad, no por refutación.
   - **Relación con Backlog Ego:** `KB-08`, `TASK-08`, `CORE-12`.

2. **Regla temporal determinista de invalidación**
   (`graphiti_core/utils/maintenance/edge_operations.py:715-783`)
   - **Qué hace:** `_apply_temporal_invalidation` caduca la arista resuelta si ya trae `invalid_at`, y
     `resolve_edge_contradictions` compara **fechas** entre el hecho nuevo y los candidatos: si
     `candidate.valid_at > resolved.valid_at`, el nuevo **supersede** al viejo fijándole
     `invalid_at = candidate.valid_at` y `expired_at = now` (`:774-781`). La inferencia (qué contradice a qué) la da
     el modelo; **la aplicación es aritmética y determinista**.
   - **Adaptación en Ego:** misma división de responsabilidades — inferencia estructurada por modelo, aplicación por
     regla. Es la pieza que le falta a `FactLifecycle.consolidateMemories`
     (`packages/knowledge/src/FactLifecycle.ts:183-284`).
   - **Relación con Backlog Ego:** `KB-08`, `KB-09`, `DSEK-01`.

### Bloque C: Resolución de entidades en cascada ###

*Ubicación en fuente:* `repos-referencia/graphiti/graphiti_core/utils/maintenance/node_operations.py`

1. **Cascada identidad → nombre exacto → similitud → LLM**
   (`node_operations.py:456-484`, `:540-575`, `:816-910`)
   - **Qué hace:** antes de gastar una llamada al modelo, `resolve_extracted_nodes` intenta resolver por propiedad
     de identidad, luego por nombre exacto (lookup durable en el driver, `:554`) y luego por similitud; **solo lo no
     resuelto llega al LLM** (`:874-891`). El patrón evita el falso positivo de "dos nodos distintos con el mismo
     nombre" separando los niveles de confianza.
   - **Adaptación en Ego:** los niveles 1-2 son puramente léxicos y por tanto ejecutables en el fast path; el nivel 3
     (semántico) debe delegarse al subproceso `vantadb-mcp` (Cognitive Path) y el nivel 4 al `ModelRouter`. Hoy
     `packages/knowledge/src/extractors/FactExtractor.ts:97,128` deriva el id por hash
     `sha256(subject:object:source)` — determinista, pero sin resolución ni cascada.
   - **Relación con Backlog Ego:** `KB-08`, `TASK-08`, `CORE-12`.

### Bloque D: Comunidades y resumen jerárquico ###

*Ubicación en fuente:* `repos-referencia/graphiti/graphiti_core/utils/maintenance/community_operations.py`

1. **Label propagation + reducción map-reduce + re-resumen incremental**
   (`community_operations.py:96-141`, `:201-253`, `:397-434`)
   - **Qué hace:** agrupa entidades por propagación de etiquetas sobre la proyección de grafo (ponderada por número
     de aristas), resume cada comunidad reduciendo **por parejas** hasta obtener un único resumen, y re-resume
     incrementalmente cuando entra una entidad nueva.
   - **Adaptación en Ego:** aplicable a `proj/traces` + `proj/file_traces`, cuyo sustrato de grafo **ya se puebla**
     (`packages/knowledge/src/ProjectMemoryGraph.ts:114-143` →
     `packages/memory/EgoMemoryAdapter.ts:1144-1148` `addEdge`). No hay implementación:
     `grep "label_propagation|labelPropagation"` sobre `packages/` → 0 coincidencias. Se difiere por la densidad del
     grafo y el coste de modelo.
   - **Relación con Backlog Ego:** `KB-06`, `KB-11`, `DOM-03`.

### Bloque E: Recuperación ###

*Ubicación en fuente:* `repos-referencia/graphiti/graphiti_core/search/`

1. **RRF multi-lista y rerankers declarativos**
   (`search/search_utils.py:1786-1801`, `search/search_config.py:32-118`, `search/search.py:121-153`)
   - **Qué hace:** fusiona listas rankeadas independientes con `1/(i+rank_const)`; configura por tipo de entidad qué
     métodos usar (`bm25` / `cosine_similarity` / `bfs`) y qué reranker (`rrf` / `node_distance` /
     `episode_mentions` / `mmr` / `cross_encoder`); y **solo computa el vector de la query** si algún método lo exige
     (`search.py:152-153` → `search_vector = [0.0] * EMBEDDING_DIM`).
   - **Adaptación en Ego:** la config declarativa es transferible; el RRF no lo es (Ego tiene mono-lista). Ver
     `GRPH-06`/`GRPH-07`.
   - **Relación con Backlog Ego:** `KB-04`, `KB-06`.

---

## 3. Matriz de Extracción vs Descarte ##

| Componente Graphiti | Acción en Ego | Razón Técnica / Arquitectónica |
|---|:---:|---|
| `edges.py:263-290` (bitemporal de 2 ejes) | **EXTRAER & ADAPTAR** | Cierra `VDB-REQ-06`: Ego solo tiene un eje temporal y contamina el campo de validez con tiempo de transacción. |
| `temporal_edge_utils.py:14-96` (bounds temporales) | **EXTRAER & ADAPTAR** | Función determinista sin coste de embeddings; compatible con el guardrail del fast path. |
| `prompts/dedupe_edges.py:25-117` + `edge_operations.py:715-783` | **EXTRAER & ADAPTAR** | Detección de contradicción inexistente en Ego; inferencia por modelo + aplicación determinista. |
| `node_operations.py:456-910` (cascada de resolución) | **EXTRAER PATRÓN** | Traducir la jerarquía de niveles; el nivel semántico va a `vantadb-mcp`, nunca a TS. |
| `community_operations.py:96-434` | **EXTRAER PATRÓN** (diferido) | Requiere grafo denso; el de Ego solo tiene aristas `derived_from` de trazas. |
| `search/search_utils.py:1786-1801` (RRF) | **DESCARTAR** | El sustrato de Ego devuelve una lista única; RRF real es petición upstream de VantaDB. |
| `search/search.py:308-362` + `search_utils.py:1804-1863` (BFS + distancia) | **DESCARTAR** | Sustituido por `packages/knowledge/src/GraphRagEngine.ts:139-340`. |
| `edges.py:292-303` + `embedder/` (embeddings en cliente) | **DESCARTAR** | Guardrail duro: sin embeddings calculados en TS; la inferencia densa vive en `vantadb-mcp`. |
| `driver/` + `server/` + `mcp_server/` + `namespaces/` | **DESCARTAR** | Drivers externos, FastAPI y servidor MCP Python son ajenos al desktop local-first; VantaDB es el sustrato único. |

---

## 4. Estado real verificado (2026-10-20) ##

> Criterio de cierre: fichero adaptado **y** caller en producción (grep sobre `packages/` +
> `apps/desktop/`, excluyendo `test/`, `dist/`, `node_modules/`).
> **Alcance:** repositorio de referencia **nuevo** — nada de Graphiti ha sido asimilado todavía.

| ID | Patrón | Estado | Evidencia / Fundamento |
|---|---|:---:|---|
| `GRPH-01` | Bitemporalidad de dos ejes (`valid_at`/`invalid_at` vs `created_at`/`expired_at`) | 🆕 Pendiente | El segundo eje no existe: `packages/knowledge/src/schemas/knowledge.ts:50-53` solo declara `validAt`/`invalidAt`, y `packages/knowledge/src/FactLifecycle.ts:162` escribe `invalid_at: now` (tiempo de transacción) en el campo de validez. Divergencia interna: `packages/memory/EgoMemoryAdapter.ts:1048-1069` (`getAtTimestamp`) sí razona en tiempo de transacción (`created_at`/`superseded_at`) y `:986` (`getVersionHistory`) recorre la cadena de versiones, pero **0 callers en producción** (grep: solo `packages/memory/EgoMemoryAdapter.ts` + `packages/memory/test/version-tree.test.ts`). **Cableado:** añadir `recordedAt`/`supersededAt` al esquema `Fact`, separar los ejes en `FactLifecycle.supersedeFact` (`:117-177`) y corregir el filtro de `BitemporalQueries.asOf` (`packages/knowledge/src/BitemporalQueries.ts:110-111`) para que consulte el intervalo de validez, no de transacción — owner KB/A2. |
| `GRPH-02` | Normalización determinista de bounds temporales (aserciones futuras, deadlines blandos) | 🆕 Pendiente | `graphiti_core/utils/maintenance/temporal_edge_utils.py:14-37,39-96`. En Ego no existe: `packages/knowledge/src/extractors/FactExtractor.ts:99,140` fija `validAt: now` invariable y `packages/knowledge/src/schemas/knowledge.ts:47` solo admite el `temporalScope` grueso. **Cableado:** nueva función pura `normalizeTemporalBounds()` en `packages/knowledge/src/`, invocada desde `FactExtractor.extractFromText` (`FactExtractor.ts:66`) y `parseFactJson` (`:157`) — owner KB/A2. |
| `GRPH-03` | Detección de contradicciones (contrato `duplicate_facts`/`contradicted_facts`) + invalidación temporal determinista | 🆕 Pendiente | `graphiti_core/prompts/dedupe_edges.py:25-33,44-117` y `graphiti_core/utils/maintenance/edge_operations.py:715-783,864-1089`. En Ego no hay detección de contradicción: grep `contradict` sobre `packages/` → 0 coincidencias; `packages/tasks/src/DreamConsolidator.ts:274-305` solo deduplica por firma y `packages/tasks/src/MemoryCurator.ts:181-187` marca `superseded_by: 'curator:stale'` por antigüedad. **Cableado:** nuevo `packages/knowledge/src/ContradictionResolver.ts` (inferencia por `ModelRouter` + regla temporal determinista) invocado desde `FactLifecycle.consolidateMemories` (`packages/knowledge/src/FactLifecycle.ts:183-284`) y `DreamConsolidator` — owner KB/A2. |
| `GRPH-04` | Cascada de resolución de entidades (identidad → nombre exacto → similitud → LLM) | 🆕 Pendiente | `graphiti_core/utils/maintenance/node_operations.py:456-484,540-575,816-910`. Ego no tiene cascada: `packages/knowledge/src/extractors/FactExtractor.ts:97,128` deriva el id por hash `sha256(subject:object:source)` sin resolución, y `packages/tasks/src/DreamConsolidator.ts:274-305` deduplica en barrido plano. **Cableado:** nuevo `packages/knowledge/src/EntityResolution.ts` con los niveles léxicos en el fast path y el nivel semántico delegado a `vantadb-mcp` (nunca calculando embeddings en TS), invocado desde `FactLifecycle` — owner KB/A2. |
| `GRPH-05` | Label propagation + resumen jerárquico map-reduce + re-resumen incremental | ⏳ Futura (Fase 06) | `graphiti_core/utils/maintenance/community_operations.py:96-141,201-253,397-434`. Sin implementación en Ego (grep `label_propagation\|labelPropagation` → 0). El sustrato ya es real: `packages/knowledge/src/ProjectMemoryGraph.ts:114-143` siembra aristas `derived_from` vía `packages/memory/EgoMemoryAdapter.ts:1144-1148` (`addEdge`). **Diferimiento:** el grafo de Ego solo tiene aristas de trazas de ingeniería; la detección de comunidades exige un grafo denso y el resumen map-reduce multiplica las llamadas al modelo. Fase destino: Fase 06 (`KB-06`, `KB-11`), Ola 2. |
| `GRPH-06` | Fusión RRF multi-lista + rerankers declarativos | 🚫 **Descartada (con justificación)** | `graphiti_core/search/search_utils.py:1786-1801` y `graphiti_core/search/search_config.py:32-118`. Ego no dispone de multi-lista: `packages/memory/EgoMemoryAdapter.ts:665-681` documenta que `searchMulti` fusiona por score en un único ranking y que el fast path es BM25 puro (`VDB-REQ-02`); `packages/knowledge/src/HybridSearch.ts:28-37` declara el mismo límite ("**No hay RRF**… el re-rank es mono-lista") y `:125-180` aplica MMR sobre lista única. El RRF real es una petición **upstream de VantaDB** (handoff `docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A2-ola1b.md:206`), no un patrón que Graphiti aporte. La parte declarativa (config de rerankers) sí se recoge en `GRPH-03`/`GRPH-04`. |
| `GRPH-07` | Expansión BFS desde nodos origen + reranker por distancia al nodo centro | 🚫 **Descartada (con justificación)** | `graphiti_core/search/search.py:308-362` y `graphiti_core/search/search_utils.py:1804-1863`. Sustituido por el módulo canónico de Ego: `packages/knowledge/src/GraphRagEngine.ts:160-246` (expansión multi-salto con poda de grado `maxDegreePerNode` y decaimiento por salto en `:221`) y `:272-340` (`expandViaNativeGraph`, aristas reales del sustrato). Verificado en producción: `apps/desktop/src/main.ts:2208` (`new GraphRagEngine(adapter)`) → `apps/desktop/src/main/ipc/register-ipc.ts:1369` (`ipc.knowledge.graphRag`). El *reranker* por shortest-path de Graphiti exige el motor IQL `query`, que el binding napi-rs no expone (`packages/knowledge/src/GraphRagEngine.ts:52-59`). |
| `GRPH-08` | Embeddings densos calculados en el cliente + reranking con cross-encoder | 🚫 **Descartada (con justificación)** | `graphiti_core/edges.py:292-303`, `graphiti_core/utils/maintenance/edge_operations.py:520,1043-1051`, `graphiti_core/embedder/` (OpenAI, Azure, Gemini, Voyage). **Guardrail duro AGENTS.md §4:** no calcular embeddings en TypeScript en el fast path; el binding `NativeVantaDB` es BM25 puro (`query_vector: []`, `VDB-REQ-02`) y la inferencia densa ONNX y las capas L0-L3 residen exclusivamente en el subproceso `vantadb-mcp`. `packages/knowledge/src/HybridSearch.ts:14-17` ya documenta que no existe lista vectorial densa y que la similitud del MMR es coseno léxica. Asimilarlo violaría dos guardrails (fast path en TS y unicidad del gateway de memoria). |
| `GRPH-09` | Drivers de grafo externos + indexación temporal + servidores FastAPI/MCP en Python | 🚫 **Descartada (con justificación)** | `graphiti_core/driver/` (neo4j, falkordb, neptune, kuzu), `graphiti_core/graph_queries.py:40-126` (índices sobre `expired_at`/`valid_at`/`invalid_at` + FULLTEXT), `server/` (FastAPI `graph_service`), `mcp_server/`, `graphiti_core/namespaces/`. AGENTS.md §4: "NO acceso directo a VantaDB — todo pasa por `EgoMemoryAdapter`"; el sustrato de grafo de Ego es el grafo nativo de VantaDB (`packages/memory/EgoMemoryAdapter.ts:1111-1210`: `insertNode`/`addEdge`/`graphragSearch`), sin drivers externos ni procesos Python en el núcleo. La indexación temporal de Graphiti solo es aplicable cuando exista soporte nativo equivalente → se arrastra a `VDB-REQ-06`. |

**Recuento:** 0 `✅ Completada` · 4 `🚫 Descartada` · 4 `🆕 Pendiente` · 1 `⏳ Futura` — **9 tareas**.

> El `0 ✅` es el resultado correcto y esperado: Graphiti es un repositorio de referencia **nuevo** en
> Ego. Ningún artefacto suyo ha sido asimilado, por lo que no existe fichero adaptado con caller en
> producción que pueda citarse. Los cuatro `🆕 Pendiente` localizan el cableado exacto y el owner;
> los cuatro `🚫 Descartada` dejan el motivo técnico por escrito. **Cero filas en el limbo.**

---

## 5. Descarte normalizado a la forma canónica ##

Las filas de la matriz §3 usaban la forma `**DESCARTAR**`; se normalizan aquí a
`🚫 Descartada (con justificación)` (AGENTS.md §4) conservando el motivo original:

| Componente Graphiti | Veredicto | Fundamento |
|---|:---:|---|
| Runtime Python + Pydantic + asyncio (`graphiti_core/pyproject.toml:12-21`) | 🚫 **Descartada (con justificación)** | AGENTS.md §4 prohíbe Python como dependencia de núcleo. Ego ejecuta el Cognitive Runtime en Node.js 22 in-process; el sidecar Python (`scripts/ingest/bulk_import.py`, `KB-02`) queda confinado a ingesta pesada. Solo se extraen contratos y reglas, reescritos en TypeScript strict. |
| Drivers Neo4j / FalkorDB / Neptune / Kuzu (`graphiti_core/driver/`) | 🚫 **Descartada (con justificación)** | AGENTS.md §4: "NO acceso directo a VantaDB — todo pasa por `EgoMemoryAdapter`". El sustrato de grafo de Ego es el grafo nativo de VantaDB (`packages/memory/EgoMemoryAdapter.ts:1111-1210`), que además ya se puebla desde `packages/knowledge/src/ProjectMemoryGraph.ts:114-143`. |
| Embeddings densos en cliente y cross-encoder (`graphiti_core/embedder/`, `graphiti_core/cross_encoder/`) | 🚫 **Descartada (con justificación)** | Guardrail duro: la inferencia densa ONNX y las capas L0-L3 residen exclusivamente en el subproceso `vantadb-mcp`; el binding in-process es BM25 puro (`VDB-REQ-02`). Calcular embeddings en TypeScript violaría el fast path y la unicidad del gateway de memoria. |
| Servidor FastAPI (`server/`) y servidor MCP Python (`mcp_server/`) | 🚫 **Descartada (con justificación)** | El desktop de Ego es local-first y sovereign: la interfaz se expone por IPC tipado (`apps/desktop/src/preload.ts`), sin procesos Python residentes ni relay de red. Los conectores externos ya están cubiertos por la capa de integraciones (`packages/integrations/`, MCP cliente + servidor, `INT-04`). |
| Fusión RRF multi-lista (`search/search_utils.py:1786-1801`) | 🚫 **Descartada (con justificación)** | `EgoMemoryAdapter.searchMulti` (`packages/memory/EgoMemoryAdapter.ts:665-681`) devuelve una lista única fusionada por score y el fast path es BM25 puro; sin lista densa por hit no hay nada que fusionar. Es una petición upstream de VantaDB, documentada en `docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A2-ola1b.md:206`. |
