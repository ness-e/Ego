# Extracción Técnica: Khoj (repos-referencia/khoj) #

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de capacidades |
| Repositorio Origen | `repos-referencia/khoj/` (commit `ae229ca`, rama `master`, clon en profundidad 1) |
| Stack del Origen | Python 3.11 + FastAPI + Next.js + SQLite / PostgreSQL (pgvector) + LangChain + sentence-transformers |
| Rol en Ego | Referencia de algoritmos de chunking, búsqueda semántica, extracción de hechos y automatizaciones |
| Owner | ness-e |
| Fecha | 2026-10-20 (Ola 2 de remediación) |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia ##

`khoj` es un asistente personal y motor de búsqueda de conocimiento offline/online para notas, documentos y
conversaciones. Resuelve en producción la segmentación semántica de documentos heterogéneos, el filtrado por
umbral de similitud y la extracción automatizada de hechos a partir de turnos de diálogo.

> **Correcciones de la Ola 2 (2026-10-20).** La versión anterior de esta ficha describía el chunking de Khoj con
> "solapamiento de 32-64 tokens", "hash SHA-256" y un metadato `heading_path`, y situaba `extract_facts` en
> `helpers.py:150-210`. **Ninguna de esas cuatro afirmaciones se sostiene en el código**: el solapamiento real es
> `0`, el hash real es MD5, la jerarquía de encabezados se inyecta como prefijo de texto (no existe campo
> `heading_path`) y `extract_facts_from_query` vive en `helpers.py:994-1034`. El detalle verificado está en §2 y el
> veredicto por compuerta en §5.

### Divergencias Fundamentales (Qué Descartamos y Por Qué) ##

| Dimensión | Khoj | Ego (Cognitive OS) | Decisión Crítica |
|---|---|---|---|
| **Backend Runtime** | Servidor monolítico Python FastAPI (`src/khoj/main.py`, `routers/`). | Node.js 22 en el proceso Main de Electron (`apps/desktop/src/main.ts`). | **DESCARTAR backend Python**. Ego ejecuta su Cognitive Runtime in-process en TypeScript. Python en Ego queda reservado exclusivamente a un sidecar opcional para importación por lotes masivos (`scripts/ingest/bulk_import.py`). |
| **Persistencia Vectorial** | SQLite relacional + pgvector / ChromaDB / FAISS en memoria (`src/khoj/database/`). | VantaDB 0.8.0 nativo in-process (`NativeVantaDB` vía napi-rs) con motor Fjall LSM + HNSW vectorial + BM25 léxico. | **DESCARTAR PostgreSQL/pgvector/Chroma**. VantaDB gestiona directamente persistencia columnar y búsqueda híbrida en disco sin servidores externos. |
| **Cálculo de Embeddings** | Torch / sentence-transformers locales en Python (`src/khoj/processor/embeddings.py`). | Auto-embed nativo en Rust ONNX Runtime dentro de VantaDB. | **DESCARTAR embeddings en Python o TS**. VantaDB genera vectores en su pipeline nativo C++/Rust, evitando saturar el Event Loop de Node o requerir un entorno Python pesado. |
| **Modelos de Negocio / Dominio** | Gestión de suscripciones Stripe, integración de telefonía Twilio/WhatsApp, envío de emails SMTP (`src/khoj/routers/api_subscription.py`, `api_phone.py`, `twilio.py`, `email.py`). | Sistema Operativo Cognitivo de escritorio soberano y local-first. | **DESCARTAR por Violación de Dominio (Guardrail §4)**. Funcionalidades de telecomunicaciones y facturación SaaS quedan estrictamente fuera del alcance de Ego. |

---

## 2. Catálogo Detallado de Capacidades, Herramientas y Patrones Extraíbles ##

### Bloque A: Pipeline de Chunking y Preprocesamiento de Documentos ##

*Ubicación en fuente:* `repos-referencia/khoj/src/khoj/processor/content/`

- **Fragmentación por límite de tokens con jerarquía de encabezados (`text_to_entries.py:60-140`)**
  - **Qué hace:** Trocea cada entrada con `RecursiveCharacterTextSplitter` de LangChain usando `chunk_size=256` y
    **`chunk_overlap=0`** (sin solapamiento), con `length_function` de **palabras** (`text.split()`) y separadores
    `párrafo > frase > palabra > carácter`. Para cada chunk recalcula la línea de origen en el fichero original
    (§2, Bloque D) y antepone el encabezado padre recortado a los 100 últimos caracteres.
  - **Corrección Ola 2:** el solapamiento es **0**, no "32-64 tokens"; el límite cuenta **palabras**, no tokens de
    modelo; el hash de deduplicación es **MD5** (`text_to_entries.py:36-37`), no SHA-256; y el tokenizador es
    LangChain, no TikToken.
  - **Adaptación en Ego:** `packages/knowledge/src/ingest/AdaptiveChunker.ts`. Ego **mejora** a Khoj en tres puntos:
    solapamiento real de 32 tokens, digest SHA-256 y `headingPath` como array estructurado (no texto prepended).
  - **Relación con Backlog Ego:** `KB-01`, `KB-02` (Fase 06). **Compuerta:** `KHOJ-01`.

- **Extractores por formato (`content/markdown/`, `content/pdf/`, `content/docx/`, `content/org_mode/`,
  `content/plaintext/`, `content/github/`, `content/notion/`)**
  - **Qué hace:** Módulos que normalizan cada formato a entradas `Entry` antes del troceado; PDF y DOCX usan
    loaders de `langchain_community` (`PyMuPDFLoader`, `Docx2txtLoader`) y el parser Markdown trocea por jerarquía
    de encabezados con recursión sobre el nivel de heading (`markdown_to_entries.py:72-142`).
  - **Adaptación en Ego:** `packages/knowledge/src/ingest/DocumentParser.ts` + `MarkdownExtractor.ts` cubren
    Markdown, texto plano, JSON y CSV; PDF y DOCX quedan fuera (el sidecar `scripts/ingest/bulk_import.py` es la
    vía prevista, aún no cableada para estos formatos).
  - **Relación con Backlog Ego:** `KB-01`. **Compuerta:** `KHOJ-02`.

### Bloque B: Búsqueda Semántica, Umbrales y Reducción de Ruido ##

*Ubicación en fuente:* `repos-referencia/khoj/src/khoj/search_type/text_search.py`

- **Filtrado por umbral de confianza del bi-encoder (`text_search.py:113-135`)**
  - **Qué hace:** El umbral **no es una constante del código**: se lee de la configuración del modelo de búsqueda
    (`search_model.bi_encoder_confidence_threshold`) y, si el modelo no lo define, el corte es `math.inf`
    (es decir, **sin filtro**). El valor se pasa como `max_distance` a `EntryAdapters.search_with_embeddings`; si
    ningún vecino lo supera, la búsqueda no devuelve nada.
  - **Corrección Ola 2:** la ficha anterior afirmaba un `min_score = 0.72` "calibrado" en el código de Khoj. **No
    existe tal constante**: el umbral vive en la configuración del modelo. El `0.70` es un valor propio de Ego.
  - **Adaptación en Ego:** `packages/knowledge/src/filters/ScoreThresholdFilter.ts`, invocado por
    `HybridSearch.search` (`packages/knowledge/src/HybridSearch.ts:88-89`). **Corrección Ola 2:** el umbral **no** se
    aplica en `EgoMemoryAdapter.searchMulti` (`packages/memory/EgoMemoryAdapter.ts:682`), que devuelve la lista
    BM25 cruda; el corte vive exclusivamente en la capa de `HybridSearch`.
  - **Relación con Backlog Ego:** `CORE-09` (Fase 01), `KB-03`, `KB-04` (Fase 06). **Compuerta:** `KHOJ-03`.

### Bloque C: Extracción Cognitiva de Hechos y Consolidación ##

*Ubicación en fuente:* `repos-referencia/khoj/src/khoj/routers/helpers.py:994-1066`

- **Extracción estructurada de hechos desde el último turno (`helpers.py:994-1034`)**
  - **Qué hace:** `extract_facts_from_query` arma un prompt con **los dos últimos turnos** de conversación
    (`construct_chat_history(..., n=2)`) y **las memorias ya existentes** serializadas como `matched_facts`, y
    obliga al modelo a responder con un esquema estricto: `MemoryUpdates` (`helpers.py:987-991`) con exactamente dos
    listas de cadenas, `create` y `delete`. Si el JSON no valida, degrada a `MemoryUpdates(create=[], delete=[])`
    en lugar de propagar el error.
  - **Corrección Ola 2:** la ficha anterior atribuía a Khoj un formato de hechos "atómicos, con categoría, certeza
    e impacto temporal". Eso es el **esquema de Ego** (`packages/knowledge/src/schemas/knowledge.ts`), no el de Khoj:
    Khoj produce listas planas de cadenas y decide crear o borrar por comparación con las memorias existentes.
  - **Adaptación en Ego:** `packages/knowledge/src/extractors/FactExtractor.ts` (heurística determinista, sin LLM)
    más el eslabón de prompting estructurado, pendiente de cablear.
  - **Relación con Backlog Ego:** `CORE-12`, `KB-04`. **Compuerta:** `KHOJ-04`.

- **Actualización y borrado de memorias tras cada turno (`helpers.py:1038-1066`)**
  - **Qué hace:** `ai_update_memories` llama a `extract_facts_from_query` y persiste el resultado: guarda cada
    memoria creada y **borra físicamente** (`UserMemoryAdapters.delete_memory`) cada memoria marcada para
    eliminar. No hay supersesión ni historial.
  - **Corrección Ola 2:** la ficha anterior afirmaba que Khoj "marca el hecho previo como obsoleto y actualiza el
    puntero activo" y que el patrón "mapea 1:1" al `supersede()` de Ego. **Khoj borra**; el *soft-replace* con
    arista `SUPERSEDED_BY` es una **mejora propia de Ego** (`packages/knowledge/src/FactLifecycle.ts:117`), no una
    asimilación literal.
  - **Adaptación en Ego:** base conceptual de `TASK-08` (Dream Consolidation) y `SUB-12` (Closed Learning Loop).
  - **Relación con Backlog Ego:** `CORE-12`, `TASK-08`, `SUB-12`. **Compuerta:** `KHOJ-05`.

### Bloque D: Vistas de Chunk, Procedencia y Filtros Temporales ##

*Ubicación en fuente:* `repos-referencia/khoj/src/khoj/processor/content/markdown/markdown_to_entries.py`,
`repos-referencia/khoj/src/khoj/search_filter/date_filter.py`

- **Doble vista `raw` / `compiled` con prefijo de contexto (`markdown_to_entries.py:171-183`)**
  - **Qué hace:** Cada entrada guarda **dos** representaciones: `raw` (texto original) y `compiled` (el texto con
    el nombre del fichero como encabezado de nivel superior `# <fichero>` y la ancestría de encabezados antepuesta).
    El embedding y la búsqueda operan sobre `compiled`; la vista `raw` es la que se muestra al usuario.
  - **Adaptación en Ego:** `DocumentChunk` guarda una única vista (`content`); el `headingPath` de Ego es
    estructurado y no compensado por un prefijo de contexto.
  - **Relación con Backlog Ego:** `KB-01` (Fase 06). **Compuerta:** `KHOJ-07`.

- **Anclaje de línea de origen por chunk (`markdown_to_entries.py:169`, `text_to_entries.py:82-109`)**
  - **Qué hace:** Cada chunk conserva su línea exacta en el fichero original mediante un fragmento URI
    `file://<ruta>#line=<n>`, recalculado durante el troceado al localizar el chunk en el texto crudo. Un chunk sin
    coincidencia localizable conserva la línea de la sección padre.
  - **Adaptación en Ego:** `DocumentChunk` no guarda offsets de línea; la cita al usuario no puede apuntar a la
    línea exacta del origen.
  - **Relación con Backlog Ego:** `KB-01` (Fase 06). **Compuerta:** `KHOJ-08`.

- **Extracción e indexación de fechas del contenido con filtro temporal de consulta**
  (`date_filter.py:87-100`, `text_to_entries.py:237-247`, `date_filter.py:118-174`)
  - **Qué hace:** En la ingesta se extraen las fechas mencionadas en el texto (formatos estructurados y naturales)
    y se indexan como entradas `EntryDates` ligadas al chunk. En la consulta, un DSL `dt>=` / `dt<` sobre la query
    se convierte en un intervalo temporal que acota los resultados.
  - **Adaptación en Ego:** `BitemporalQueries` (`packages/knowledge/src/BitemporalQueries.ts:77`) trabaja sobre el
    **eje de validez** del registro (`valid_at` / `invalid_at`), no sobre fechas contenidas en el texto; y
    `KnowledgeIndexer` no extrae fechas del contenido. La ruta `getAtTimestamp`
    (`packages/memory/EgoMemoryAdapter.ts:1048`) es un eje **transaccional** distinto y **no tiene caller en
    producción** (solo tests), por lo que no puede usarse como sustrato de esta capacidad.
  - **Relación con Backlog Ego:** `KB-09` (Fase 06). **Compuerta:** `KHOJ-09`.

### Bloque E: Recuperación en Dos Etapas y Diversificación de Resultados ##

*Ubicación en fuente:* `repos-referencia/khoj/src/khoj/search_type/text_search.py`

- **Re-rank de segundo nivel con cross-encoder (`text_search.py:192-257`)**
  - **Qué hace:** Tras la recuperación por bi-encoder, si hay más de un resultado y el modelo dispone de servidor de
    inferencia, un **cross-encoder** re-puntúa cada par (consulta, chunk); el orden final es por score de
    cross-encoder y, en empate, por score de bi-encoder.
  - **Adaptación en Ego:** `HybridSearch` reordena por score del motor y aplica MMR por diversidad
    (`packages/knowledge/src/HybridSearch.ts:104-113`), pero **no hay etapa de re-puntuación semántica**.
  - **Relación con Backlog Ego:** `KB-04` (Fase 06). **Compuerta:** `KHOJ-10`.

- **Deduplicación por corpus (`text_search.py:141-164`)**
  - **Qué hace:** Al componer la respuesta, `collate_results` descarta los hits cuyo `corpus_id` ya apareció, de
    modo que varios chunks del mismo documento no pueden monopolizar el top-k: cada documento aporta como máximo
    un fragmento al resultado final.
  - **Adaptación en Ego:** el MMR de `HybridSearch` diversifica por **similitud**, no por **documento de origen**;
    un documento con muchos chunks casi idénticos puede seguir acaparando el top-k.
  - **Relación con Backlog Ego:** `KB-04` (Fase 06). **Compuerta:** `KHOJ-11`.

### Bloque F: Herramientas de Sistema y Conectores de Khoj ##

*Ubicación en fuente:* `repos-referencia/khoj/src/khoj/processor/tools/` y `routers/`

- **Cliente MCP de herramientas externas (`processor/tools/mcp.py:13-124`)**
  - **Qué hace:** Envoltura fina sobre el SDK oficial de Python para MCP: transporte `stdio` o `SSE` según la ruta,
    `list_tools`, `call_tool` y normalización del contenido tipado (`TextContent`, `AudioContent`, `ImageContent`).
  - **Fundamento:** Ego ya consume el SDK oficial de MCP en TypeScript
    (`packages/integrations/src/mcp/McpClient.ts`), con gestión de secretos y validación de schemas propias. La
    envoltura de Khoj no aporta ninguna capacidad que el SDK no dé, y `AGENTS.md` §7 obliga a usar el SDK oficial.
  - **Relación con Backlog Ego:** `ACT-09`, `ACT-11` (Fase 02). **Compuerta:** `KHOJ-12`.

- **Motor de investigación iterativa (`routers/research.py:277,476`)**
  - **Qué hace:** Sub-proceso multi-paso que desglosa una pregunta en sub-consultas, elige la siguiente
    herramienta, sintetiza hallazgos parciales y refina la hipótesis final.
  - **Fundamento:** Ego cubre la iteración de forma **genérica** (runtime de Sub-Ego → `ToolExecutionLoop`) y tiene
    el dominio Knowledge en producción (`packages/domains/src/knowledge/KnowledgeDomain.ts`, instanciado en
    `apps/desktop/src/main/ipc/register-ipc.ts:1588`), pero **no** existe un orquestador específico con
    descomposición explícita de la pregunta, síntesis parcial refinable y política de herramientas propia.
  - **Relación con Backlog Ego:** `DOM-03` (Fase 09). **Compuerta:** `KHOJ-13`.

---

## 3. Matriz de Extracción vs Descarte ##

| Componente / Feature de Khoj | Archivo Fuente | Acción | Justificación Técnica |
|---|---|:---:|---|
| **Chunking por límite de tokens con dedupe por hash MD5** | `processor/content/text_to_entries.py:60-140` | 📥 **Extraer & Adaptar** | Algoritmo probado; Ego ya lo asimiló mejorando solapamiento, digest y jerarquía de encabezados. |
| **Extractores por formato (Markdown, Org, PDF, DOCX, Plaintext, GitHub, Notion)** | `processor/content/*/` | 📥 **Extraer & Adaptar** | Normalización por formato antes del troceado; en Ego asimilado para Markdown, texto plano, JSON y CSV. |
| **Filtro de umbral del bi-encoder (`bi_encoder_confidence_threshold`)** | `search_type/text_search.py:113-135` | 📥 **Extraer & Adaptar** | Evita inyectar ruido en el contexto del LLM antes de contextualizar. |
| **Extractor de hechos atómicos (`extract_facts_from_query`)** | `routers/helpers.py:994-1034` | 📥 **Extraer & Adaptar** | Primitiva mnemónica esencial para el ciclo de vida de memoria de Ego (`CORE-12`). |
| **Consolidación y resolución de contradicciones (`ai_update_memories`)** | `routers/helpers.py:1038-1066` | 📥 **Extraer & Adaptar** | Khoj borra; Ego lo mejora con supersesión suave y aristas causales. |
| **Doble vista `raw` / `compiled` con prefijo de contexto** | `processor/content/markdown/markdown_to_entries.py:171-183` | 📥 **Extraer & Adaptar** | Permite conservar la fuente limpia para citar y una vista optimizada para recuperar. |
| **Anclaje de línea de origen (`file://…#line=N`)** | `processor/content/markdown/markdown_to_entries.py:169`, `processor/content/text_to_entries.py:82-109` | 📥 **Extraer & Adaptar** | Procedencia verificable por chunk; base de una cita trazable en la UI. |
| **Extracción e indexación de fechas del contenido con filtro `dt`** | `search_filter/date_filter.py:87-100`, `processor/content/text_to_entries.py:237-247` | 📥 **Extraer & Adaptar** | Complementa la bitemporalidad de registro con un eje temporal de contenido. |
| **Re-rank de segundo nivel con cross-encoder** | `search_type/text_search.py:192-257` | 📥 **Extraer & Adaptar** | Recuperación en dos etapas, más precisa que el orden por score de recuperación. |
| **Deduplicación por corpus (`corpus_id`)** | `search_type/text_search.py:141-164` | 📥 **Extraer & Adaptar** | Evita que un documento con muchos chunks monopolice el top-k. |
| **Cliente de herramientas MCP (`mcp.py`)** | `processor/tools/mcp.py:13-124` | 🚫 **Descartada (con justificación)** | Envoltura fina sobre el SDK oficial; Ego ya usa el SDK oficial en TypeScript (`packages/integrations/src/mcp/McpClient.ts`). No aporta capacidad nueva. |
| **Motor de investigación multi-paso (`research.py`)** | `routers/research.py:277,476` | 💡 **Solo Inspiración** | La iteración genérica ya existe (runtime de Sub-Ego + `ToolExecutionLoop`); el orquestador específico con descomposición de la pregunta queda diferido. |
| **Scraper web y búsqueda online pesada (`online_search.py`)** | `processor/tools/online_search.py` | 🚫 **Descartada (con justificación)** | Fuera de alcance de P0; viola el principio local-first soberano. Las búsquedas externas en Ego se canalizan vía herramientas MCP gobernadas. |
| **Ejecución arbitraria de código Python (`run_code.py`)** | `processor/tools/run_code.py` | 🚫 **Descartada (con justificación)** | Riesgo de seguridad severo. Ego utiliza el Execution Manager con aislamiento de procesos y aprobación HITL (`ACT-03`, `SEC-05`). |
| **Backend FastAPI / Routers HTTP** | `main.py`, `routers/api*.py` | 🚫 **Descartada (con justificación)** | Ego es una aplicación desktop con proceso Main Node.js 22; no requiere un servidor REST HTTP intermedio. |
| **PostgreSQL, pgvector y migraciones SQL** | `database/` | 🚫 **Descartada (con justificación)** | Incompatible con la arquitectura soberana local basada en VantaDB in-process (Fjall LSM). |
| **Módulos Twilio, WhatsApp, Email y Stripe** | `routers/twilio.py`, `routers/api_phone.py`, `routers/email.py`, `routers/api_subscription.py` | 🚫 **Descartada (con justificación)** | Contaminación de dominios ajenos (Guardrail §4 de `AGENTS.md`). La fila de backlog asociada es `KHOJ-06` (⏳ Futura, porque pertenece a Ego Web, no al desktop). |

---

## 4. Impacto en el Backlog de Ego y Trazabilidad ##

| ID Compuerta | Archivo / Función Khoj | Tarea Canónica Ego | Estado en Backlog Review |
|:---:|---|:---:|:---:|
| `KHOJ-01` | `processor/content/text_to_entries.py:60-140` (chunking 256 palabras) | `KB-01`, `KB-02` (Fase 06) | [`docs/review/backlog-khoj.md`](../review/backlog-khoj.md) |
| `KHOJ-02` | `processor/content/markdown/`, `content/pdf/`, `content/docx/` | `KB-01` (Fase 06) | [`docs/review/backlog-khoj.md`](../review/backlog-khoj.md) |
| `KHOJ-03` | `search_type/text_search.py:113-135` (umbral del bi-encoder) | `CORE-09` (Fase 01), `KB-03` (Fase 06) | [`docs/review/backlog-khoj.md`](../review/backlog-khoj.md) |
| `KHOJ-04` | `routers/helpers.py:994-1034` (`extract_facts_from_query`) | `CORE-12` (Fase 01), `KB-04` (Fase 06) | [`docs/review/backlog-khoj.md`](../review/backlog-khoj.md) |
| `KHOJ-05` | `routers/helpers.py:1038-1066` (`ai_update_memories`) | `CORE-12` (Fase 01), `SUB-12` (Fase 03), `TASK-08` (Fase 07) | [`docs/review/backlog-khoj.md`](../review/backlog-khoj.md) |
| `KHOJ-06` | `routers/api_subscription.py`, `api_phone.py`, `twilio.py`, `email.py` | `DOM-05`, `DOM-06` (Ego Web) | [`docs/review/backlog-khoj.md`](../review/backlog-khoj.md) |
| `KHOJ-07` | `processor/content/markdown/markdown_to_entries.py:171-183` (vistas `raw` / `compiled`) | `KB-01` (Fase 06) | [`docs/review/backlog-khoj.md`](../review/backlog-khoj.md) |
| `KHOJ-08` | `processor/content/markdown/markdown_to_entries.py:169` (anclaje `#line=N`) | `KB-01` (Fase 06) | [`docs/review/backlog-khoj.md`](../review/backlog-khoj.md) |
| `KHOJ-09` | `search_filter/date_filter.py:87-100` (fechas del contenido) | `KB-09` (Fase 06) | [`docs/review/backlog-khoj.md`](../review/backlog-khoj.md) |
| `KHOJ-10` | `search_type/text_search.py:192-257` (re-rank con cross-encoder) | `KB-04` (Fase 06) | [`docs/review/backlog-khoj.md`](../review/backlog-khoj.md) |
| `KHOJ-11` | `search_type/text_search.py:141-164` (dedupe por corpus) | `KB-04` (Fase 06) | [`docs/review/backlog-khoj.md`](../review/backlog-khoj.md) |
| `KHOJ-12` | `processor/tools/mcp.py:13-124` (cliente MCP) | `ACT-09`, `ACT-11` (Fase 02) | [`docs/review/backlog-khoj.md`](../review/backlog-khoj.md) |
| `KHOJ-13` | `routers/research.py:277,476` (motor de investigación) | `DOM-03` (Fase 09) | [`docs/review/backlog-khoj.md`](../review/backlog-khoj.md) |

---

## 5. Estado real verificado (2026-10-20) — Ola 2 de remediación ##

> Fuente canónica del estado por tarea: [`docs/review/backlog-khoj.md`](../review/backlog-khoj.md).
> Criterio de cierre: fichero adaptado **y** caller en producción (grep sobre `packages/` + `apps/desktop/`,
> excluyendo `test/`, `dist/` y `node_modules/`).

| ID | Patrón | Estado | Evidencia / Fundamento |
|---|---|:---:|---|
| `KHOJ-01` | Chunking por límite de tokens + dedupe por hash | ✅ Completada | `packages/knowledge/src/ingest/AdaptiveChunker.ts:16,42` → `DocumentParser.ts:4,17` y `MarkdownExtractor.ts:2,19` → `apps/desktop/src/main.ts:40,2238` → `apps/desktop/src/main/ipc/register-ipc.ts:1340-1341`. |
| `KHOJ-02` | Parsers por formato | ✅ Completada | `packages/knowledge/src/ingest/DocumentParser.ts:12,53-71` y `MarkdownExtractor.ts:15,77-94` → `apps/desktop/src/main.ts:2238` → `register-ipc.ts:1340-1341`. Alcance asimilado: Markdown, texto plano, JSON y CSV (PDF y DOCX de Khoj no asimilados). |
| `KHOJ-03` | Umbral de similitud | ✅ Completada | `packages/knowledge/src/filters/ScoreThresholdFilter.ts:22,27` → `packages/knowledge/src/HybridSearch.ts:88-89` → `apps/desktop/src/main.ts:33,2231` → `register-ipc.ts:1350`. **Rutas corregidas**: el fichero real es `ScoreThresholdFilter.ts` y el corte **no** se aplica en `EgoMemoryAdapter.searchMulti`. |
| `KHOJ-04` | `extract_facts_from_query` | 🆕 Pendiente | `packages/knowledge/src/extractors/FactExtractor.ts:62` — **0 consumidores**: solo `packages/knowledge/src/index.ts:8` y dos tests. `FactLifecycle` (en producción) no lo invoca. **Cableado pendiente:** invocar el extractor en el post-turno (`apps/desktop/src/main.ts:1775`, `lifecycle.syncTurn`) o en `FactLifecycle.consolidateMemories` — owner A2. |
| `KHOJ-05` | `ai_update_memories` | 🆕 Pendiente | **Revertido en Ola 2.** `packages/knowledge/src/FactLifecycle.ts:117,183` — `consolidateMemories` tiene **0 callers en producción** (solo tests); el motor real `packages/tasks/src/DreamConsolidator.ts:274-319` **nunca se instancia fuera de tests**; lo único cableado es `promoteFromQuarantine` (`register-ipc.ts:1390`), que es otra capacidad (KB-07 / CARP-04). **Cableado pendiente:** instanciar `DreamConsolidator` junto a `factLifecycle` (`apps/desktop/src/main.ts:2234`) y/o invocar `consolidateMemories` desde el post-turno (`main.ts:1775`) — owner A2. |
| `KHOJ-06` | Stripe / Twilio / SMTP | ⏳ Futura (P1) | Dominio de Ego Web, no del desktop SOC; ver matriz de descarte §3. |
| `KHOJ-07` | Vistas `raw` / `compiled` | ⏳ Futura (Fase 06, P1) | Sin base en Ego: `DocumentChunk` (`packages/knowledge/src/schemas/knowledge.ts`) guarda una única vista `content`. Fase destino: `KB-01`, P1. |
| `KHOJ-08` | Anclaje de línea de origen | ⏳ Futura (Fase 06, P1) | Sin base en Ego: ningún chunk conserva offset de línea; el metadato `chunk_index` no permite citar la línea. Fase destino: `KB-01`, P1. |
| `KHOJ-09` | Fechas del contenido y filtro `dt` | ⏳ Futura (Fase 06, P1) | `BitemporalQueries` (`packages/knowledge/src/BitemporalQueries.ts:77`) cubre el eje de **validez**; no hay extracción de fechas en `KnowledgeIndexer`. `EgoMemoryAdapter.getAtTimestamp` (`:1048`) es eje transaccional y **no tiene caller en producción**: no sirve de sustrato. Fase destino: `KB-09`, P1. |
| `KHOJ-10` | Re-rank con cross-encoder | ⏳ Futura (Fase 06, P1) | `HybridSearch` (`packages/knowledge/src/HybridSearch.ts:104-113`) reordena por score y aplica MMR, sin re-puntuación semántica. Fase destino: `KB-04`, P1; condicionado a `VDB-REQ-08`. |
| `KHOJ-11` | Dedupe por corpus | ⏳ Futura (Fase 06, P1) | El MMR diversifica por similitud, no por documento de origen. Fase destino: `KB-04`, P1. |
| `KHOJ-12` | Cliente MCP de herramientas | 🚫 Descartada (con justificación) | Envoltura fina sobre el SDK oficial de MCP; Ego usa el SDK oficial en TypeScript (`packages/integrations/src/mcp/McpClient.ts`). Cero capacidad aportada, `AGENTS.md` §7. |
| `KHOJ-13` | Motor de investigación iterativa | ⏳ Futura (Fase 09, P1) | La iteración existe de forma genérica (runtime de Sub-Ego → `ToolExecutionLoop`) y `packages/domains/src/knowledge/KnowledgeDomain.ts` está en producción (`register-ipc.ts:1588`), pero no hay descomposición explícita de la pregunta ni síntesis parcial re refinable. Fase destino: `DOM-03`, P1. |

**Recuento:** 3 `✅ Completada` · 1 `🚫 Descartada` · 2 `🆕 Pendiente` · 7 `⏳ Futura` — **13 tareas**.

## 6. Guardrail de embeddings y de dominio (re-verificado 2026-10-20) ##

- **Embeddings:** no hay `sentence-transformers`, `gte-small` ni cálculo de embeddings en TypeScript en `packages/` ni
  en `apps/`. La inferencia densa reside exclusivamente en el subproceso `vantadb-mcp` (capas L0-L3), conforme al
  guardrail de `AGENTS.md` §4. El bypass de Python queda confinado al sidecar opcional de ingesta masiva
  (`scripts/ingest/bulk_import.py`).
- **Dominio:** barrido de los vectores de `khoj` (`twilio`, `stripe`, `smtp`, `sentence-transformers`, `gte-small`)
  sobre `packages/` y `apps/` → **0 casos de dominio**. Las tres coincidencias literales de `stripe` no son
  contaminación: `packages/avatar/index.d.ts:66` (nombre de paleta), `packages/avatar/vendor/coucou/core/state.ts:68`
  (metadato de UI vendorizado) y `packages/security/src/SecretsFilter.ts:89` (patrón de redacción de claves
  Stripe). **Contaminación de dominio: LIMPIO.**
- **Corrección Ola 2:** la ficha anterior afirmaba "0 coincidencias" para el barrido completo. La afirmación correcta
  es "0 casos de dominio"; las coincidencias literales son controles defensivos o metadatos de terceros.
