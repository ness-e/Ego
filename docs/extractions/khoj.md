# Extracción Técnica: Khoj (repos-referencia/khoj)

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de capacidades |
| Repositorio Origen | `repos-referencia/khoj/` (Commit verificado: oct-2026) |
| Stack del Origen | Python 3.11 + FastAPI + Next.js + SQLite / PostgreSQL (pgvector) + LangChain / LlamaIndex + HuggingFace Embeddings |
| Rol en Ego | Referencia de Algoritmos de Chunking, Búsqueda Semántica, Extracción de Hechos y Automatizaciones |
| Owner | ness-e |
| Fecha | 2026-10-08 |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia

`khoj` es un asistente personal y motor de búsqueda de conocimiento offline/online para notas, documentos y conversaciones. Resuelve de forma probada en producción la segmentación semántica de documentos heterogéneos, el filtrado por umbral de similitud vectorial y la extracción automatizada de hechos personales a partir de turnos de diálogo.

### Divergencias Fundamentales (Qué Descartamos y Por Qué)

| Dimensión | Khoj | Ego (Cognitive OS) | Decisión Crítica |
|---|---|---|---|
| **Backend Runtime** | Servidor monolítico Python FastAPI (`src/khoj/main.py`, `routers/`). | Node.js 22 en el proceso Main de Electron (`apps/desktop/src/main.ts`). | **DESCARTAR backend Python**. Ego ejecuta su Cognitive Runtime in-process en TypeScript. Python en Ego queda reservado exclusivamente a un sidecar opcional para importación por lotes masivos (`bulk_import.py`) en Fase 06. |
| **Persistencia Vectorial** | SQLite relacional + pgvector / ChromaDB / FAISS en memoria (`src/khoj/database/`). | VantaDB 0.8.0 nativo in-process (`NativeVantaDB` vía napi-rs) con motor Fjall LSM + HNSW vectorial + BM25 léxico. | **DESCARTAR PostgreSQL/pgvector/Chroma**. VantaDB gestiona directamente persistencia columnar y búsqueda híbrida en disco sin servidores externos. |
| **Cálculo de Embeddings** | Torch / sentence-transformers locales en Python (`src/khoj/processor/embeddings.py`). | Auto-embed nativo en Rust ONNX Runtime dentro de VantaDB. | **DESCARTAR embeddings en Python o TS**. VantaDB genera vectores en su pipeline nativo C++/Rust, evitando saturar el Event Loop de Node o requerir un entorno Python pesado. |
| **Modelos de Negocio / Dominio** | Gestión de suscripciones Stripe, integración de telefonía Twilio/WhatsApp, envío de emails SMTP (`src/khoj/routers/email.py`, `twilio.py`). | Sistema Operativo Cognitivo de escritorio soberano y local-first. | **DESCARTAR por Violación de Dominio (Guardrail §4)**. Funcionalidades de telecomunicaciones y facturación SaaS quedan estrictamente fuera del alcance de Ego. |

---

## 2. Catálogo Detallado de Capacidades, Herramientas y Patrones Extraíbles

### Bloque A: Pipeline de Chunking y Preprocesamiento de Documentos
*Ubicación en fuente:* `repos-referencia/khoj/src/khoj/processor/content/`

1. **Algoritmo de Fragmentación Jerárquica con Solapamiento (`text_to_entries.py:45-120`)**
   - **Qué hace:** Divide textos extensos en bloques consistentes de 256 tokens con una ventana de solapamiento de 32-64 tokens, preservando la jerarquía de encabezados Markdown/Org-mode como metadatos de contexto (`heading_path: "Capítulo 1 > Sección 2"`). Calcula un hash SHA-256 sobre el contenido canónico de cada bloque para deduplicación idempotente.
   - **Herramientas que usa:** Tokenizador TikToken / HuggingFace, regex de encabezados estructurados, digest crypto.
   - **Adaptación en Ego:** Implementar en `packages/knowledge/src/chunking/AdaptiveChunker.ts`. El chunker emitirá registros atómicos con estructura `{ text, headingPath, hash, tokenCount }` listos para inserción masiva en los namespaces `kb/docs/*` de VantaDB.
   - **Relación con Backlog Ego:** `KB-01`, `KB-02` (Fase 06). **Compuerta:** `KHOJ-01`.

2. **Extractores de Formatos Específicos (`markdown/`, `pdf/`, `docx/`)**
   - **Qué hace:** Módulos especializados que limpian artefactos de formato (notas al pie, tablas rotas, saltos de página) antes de pasar el flujo al chunker semántico.
   - **Adaptación en Ego:** Adaptar extractores de Markdown y texto plano en TypeScript; delegar PDFs complejos al sidecar de ingesta en `scripts/ingest/` o a librerías de parsing ligeras en Node.
   - **Relación con Backlog Ego:** `KB-01`. **Compuerta:** `KHOJ-02`.

---

### Bloque B: Búsqueda Semántica, Umbrales y Reducción de Ruido
*Ubicación en fuente:* `repos-referencia/khoj/src/khoj/search_type/text_search.py`

3. **Filtrado por Umbral de Confianza Coseno (`score_threshold: 80-140`)**
   - **Qué hace:** Tras recuperar los k-vecinos más cercanos de la base vectorial, aplica un umbral dinámico de similitud coseno (`min_score = 0.72` calibrado). Si ningún resultado supera el corte, no inyecta basura al contexto del LLM, devolviendo un conjunto vacío y previniendo alucinaciones.
   - **Herramientas que usa:** Operaciones de álgebra lineal sobre vectores normalizados.
   - **Adaptación en Ego:** Integrar en el pipeline `HybridSearch.ts` y en `EgoMemoryAdapter.searchMulti`. Los resultados recuperados por VantaDB deben filtrarse por umbral antes de combinarse con el ranker RRF (Reciprocal Rank Fusion) de BM25.
   - **Relación con Backlog Ego:** `CORE-09` (Fase 01), `KB-03`, `KB-04` (Fase 06). **Compuerta:** `KHOJ-03`.

---

### Bloque C: Extracción Cognitiva de Hechos y Consolidación Onírica
*Ubicación en fuente:* `repos-referencia/khoj/src/khoj/routers/helpers.py:150-290`

4. **Heurística Estructurada de Extracción de Hechos (`extract_facts`)**
   - **Qué hace:** Prompt analítico que evalúa el último turno de diálogo entre usuario y asistente. Extrae hechos atómicos, preferencias, restricciones o datos técnicos del usuario en formato JSON con categoría, certeza e impacto temporal (efímero vs permanente).
   - **Adaptación en Ego:** Adaptar directamente dentro de `EgoMemoryLifecycle.ts` (Fase 01 / Fase 06) durante el paso post-turno `Post-Turn Memory Sync`. Los hechos extraídos se persisten en `egos/memory/facts/` o en `quarantine/pending` si la confianza es baja.
   - **Relación con Backlog Ego:** `CORE-12`, `KB-04`. **Compuerta:** `KHOJ-04`.

5. **Consolidación y Resolución de Contradicciones (`ai_update_memories`)**
   - **Qué hace:** Proceso periódico en segundo plano que compara hechos nuevos con los ya persistidos. Si un hecho nuevo contradice uno antiguo (ej. "el usuario cambió de editor preferido"), marca el hecho previo como obsoleto y actualiza el puntero activo.
   - **Adaptación en Ego:** Base conceptual para la tarea `TASK-08` (Consolidación Onírica / Dream Consolidation) y `SUB-12` (Closed Learning Loop de Sub-Egos). Se apoya en el método `supersede()` de `EgoMemoryAdapter` para mantener trazabilidad histórica sin borrado destructivo.
   - **Relación con Backlog Ego:** `CORE-12`, `TASK-08`, `SUB-12`. **Compuerta:** `KHOJ-05`.

---

### Bloque D: Herramientas de Sistema y Conectores de Khoj
*Ubicación en fuente:* `repos-referencia/khoj/src/khoj/processor/tools/` y `routers/`

6. **Cliente MCP de Herramientas Externas (`processor/tools/mcp.py`)**
   - **Qué hace:** Implementación de cliente sobre el protocolo Model Context Protocol (stdio/SSE) para conectar servidores de herramientas externos, mapeando sus funciones a llamadas invocables por el LLM.
   - **Adaptación en Ego:** Fuente de referencia complementaria a `ACT-09` (`packages/integrations/mcp/McpClient.ts`) para el descubrimiento dinámico de herramientas y negociación de capacidades.
   - **Relación con Backlog Ego:** `ACT-09`, `ACT-11` (Fase 02).

7. **Motor de Investigación Iterativa (`routers/research.py`)**
   - **Qué hace:** Sub-proceso multi-paso que desglosa una pregunta de investigación compleja en sub-consultas, busca fuentes web o locales, sintetiza hallazgos parciales y refina la hipótesis final.
   - **Adaptación en Ego:** Inspiración directa para el **Dominio Knowledge** (`DOM-03`) y el Sub-Ego Research en Fase 09.
   - **Relación con Backlog Ego:** `DOM-03` (Fase 09).

---

## 3. Matriz de Extracción vs Descarte

| Componente / Feature de Khoj | Archivo Fuente | Acción | Justificación Técnica |
|---|---|:---:|---|
| **Chunking de 256 tokens con solapamiento y hash** | `processor/content/text_to_entries.py` | 📥 **Extraer & Adaptar** | Algoritmo probado que encaja directamente con la semántica de namespaces de VantaDB. |
| **Filtro de umbral coseno (`min_score`)** | `search_type/text_search.py` | 📥 **Extraer & Adaptar** | Crucial para evitar ruido en la inyección de contexto RAG antes de combinar RRF. |
| **Extractor de hechos atómicos (`extract_facts`)** | `routers/helpers.py:150-210` | 📥 **Extraer & Adaptar** | Primitiva mnemónica esencial para el ciclo de vida de memoria de Ego (`CORE-12`). |
| **Consolidación de memorias y contradicciones** | `routers/helpers.py:220-290` | 📥 **Extraer & Adaptar** | Mapea 1:1 al patrón supersede de VantaDB y al proceso de Dream Consolidation (`TASK-08`). |
| **Cliente de herramientas MCP (`mcp.py`)** | `processor/tools/mcp.py` | 💡 **Solo Inspiración** | Ego ya utiliza el SDK oficial de MCP en TypeScript (`@modelcontextprotocol/sdk`). |
| **Motor de investigación multi-paso (`research.py`)** | `routers/research.py` | 💡 **Solo Inspiración** | La lógica iterativa se adaptará en el Sub-Ego Research (`DOM-03`) en Fase 09. |
| **Scraper web y búsqueda online pesada (`online_search.py`)** | `processor/tools/online_search.py` | 🚫 **Descartar (Justificado)** | Fuera de alcance de P0; viola el principio local-first soberano. Las búsquedas externas en Ego se canalizan vía herramientas MCP gobernadas. |
| **Ejecución arbitraria de código Python (`run_code.py`)** | `processor/tools/run_code.py` | 🚫 **Descartar (Justificado)** | Riesgo de seguridad severo. Ego utiliza el Execution Manager con aislamiento de procesos y aprobación HITL (`ACT-03`, `SEC-05`). |
| **Backend FastAPI / Routers HTTP** | `main.py`, `routers/api*.py` | 🚫 **Descartar (Justificado)** | Ego es una aplicación desktop con proceso Main Node.js 22; no requiere un servidor REST HTTP intermedio. |
| **PostgreSQL, pgvector y migraciones SQL** | `database/` | 🚫 **Descartar (Justificado)** | Incompatible con la arquitectura soberana local basada en VantaDB in-process (Fjall LSM). |
| **Módulos Twilio, WhatsApp, Email y Stripe** | `routers/twilio.py`, `email.py`, etc. | 🚫 **Descartar (Justificado)** | Contaminación de dominios ajenos (Guardrail §4 de `AGENTS.md`). |

---

## 4. Impacto en el Backlog de Ego y Trazabilidad

| ID Compuerta | Archivo / Función Khoj | Tarea Canónica Ego | Estado en Backlog Review |
|:---:|---|:---:|:---:|
| `KHOJ-01` | `text_to_entries.py:45-120` (Chunking 256 tokens) | `KB-01`, `KB-02` (Fase 06) | [`docs/review/backlog-khoj.md`](../review/backlog-khoj.md) |
| `KHOJ-02` | `markdown_to_entries.py`, `pdf_to_entries.py` | `KB-01` (Fase 06) | [`docs/review/backlog-khoj.md`](../review/backlog-khoj.md) |
| `KHOJ-03` | `text_search.py:80-140` (Cosine threshold) | `CORE-09` (Fase 01), `KB-03` (Fase 06) | [`docs/review/backlog-khoj.md`](../review/backlog-khoj.md) |
| `KHOJ-04` | `helpers.py:150-210` (`extract_facts`) | `CORE-12` (Fase 01), `KB-04` (Fase 06) | [`docs/review/backlog-khoj.md`](../review/backlog-khoj.md) |
| `KHOJ-05` | `helpers.py:220-290` (`ai_update_memories`) | `CORE-12` (Fase 01), `SUB-12` (Fase 03), `TASK-08` (Fase 07) | [`docs/review/backlog-khoj.md`](../review/backlog-khoj.md) |
