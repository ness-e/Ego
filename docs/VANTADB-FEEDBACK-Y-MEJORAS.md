---
title: Registro Canónico de Fallos, Inconsistencias y Peticiones de Mejora para VantaDB
status: activo
owner: ness-e
last_updated: 2026-10-10
context: "Derivado de la integración real de Ego con VantaDB 0.8.0 y vantadb-node (Fjall LSM / NAPI-RS)"
---

# Registro Canónico de Hallazgos y Mejoras para VantaDB ##

> **Propósito:** Fuente única de verdad de todos los errores, fallas, inconsistencias arquitectónicas, fricciones de API y peticiones de mejora identificadas durante el desarrollo e integración de **Ego (Sistema Operativo Cognitivo)** sobre el motor **VantaDB**.
>
> Este documento debe actualizarse de forma incremental con cada hallazgo para retroalimentar el desarrollo del core de VantaDB en Rust y sus bindings NAPI-RS.

---

## Índice de Hallazgos ##

| ID | Tipo | Severidad | Componente | Descripción Resumida |
|---|---|---|---|---|
| `VDB-BUG-01` | Bug | 🔴 Alta | `vantadb-node` | Rechazo de `cursor: undefined` como `Null` (`cursor must be a number`) |
| `VDB-BUG-02` | Bug | 🔴 Alta | `vantadb-node` / Serde | Serialización de metadata y valores primitivos desde Node: enteros f64 IEEE-754 y envoltorio etiquetado |
| `VDB-BUG-03` | Bug / Bloqueo | 🟠 Media | `NativeVantaDB` (Fjall) | Bloqueo residual de descriptores en Windows ante excepciones (`FjallError: Locked`) |
| `VDB-INC-01` | Inconsistencia | 🔴 Alta | `Embedded` / Documentación | Ausencia de Auto-Embed ONNX local en `Embedded::put_one` |
| `VDB-INC-02` | Inconsistencia / Bloqueo | 🔴 Alta | `Fjall` LSM / Concurrencia | Exclusión mutua de proceso (`flock`) impidiendo acceso multi-proceso embebido (`NativeVantaDB` + sidecar Python) |
| `VDB-BUG-04` | Bug / Limitación | 🟠 Media | `vantadb-node` / Serde | Rechazo de estructuras anidadas profundas en `metadata` (`VantaValue` carece de variante Map/Object recursiva) |
| `VDB-BUG-05` | Bug / Validación | 🟡 Media | Core `Search` / Guards | Rechazo de búsqueda léxica con texto vacío `text_query: ""` (`query_vector must be a non-empty array`) |
| `VDB-INC-03` | Inconsistencia | 🟠 Media | `NativeVantaDB` (Ciclo de Vida) | Invalidación de descriptores tras `db.close()`: el adaptador mnemónico queda inerte (hot recovery) |
| `VDB-INC-04` | Inconsistencia | 🟠 Media | Fjall LSM / `delete` + `vanta-vector` | Borrado físico no garantizado: tras `delete` los datos siguen en disco (tombstone) |
| `VDB-BUG-06` | Bug / Limitación | 🟠 Media | `vantadb/dist/native.js` (import dinámico) | El entry productivo de `vantadb` resuelve `vantadb-node` declarado solo como devDependency |
| `VDB-REQ-01` | Petición de Mejora | 🟡 Media | Core `Search` | Soporte nativo de comodines en `search_multi` (`projects/default/*`) |
| `VDB-REQ-02` | Petición de Mejora | 🟢 Baja | `NativeVantaDB.js` | `query_vector` obligatorio para búsquedas puras de texto BM25 |
| `VDB-REQ-03` | Petición de Mejora | 🟡 Media | Tokenizer BM25 | Normalización de signos de puntuación española (`¿`, `?`, `¡`, `!`) |
| `VDB-REQ-04` | Petición de Mejora | 🟠 Media | `vantadb-node` / `vantadb-py` | Ingesta sin copia (*Zero-Copy*) para arrays de vectores (`Float32Array` / `PyBuffer`) |
| `VDB-REQ-05` | Petición de Mejora | 🟠 Media | Core `vanta-vector` / HNSW | *Vacuum* y desfragmentación periódica de grafos HNSW (purga de *tombstones*) |
| `VDB-REQ-06` | Petición de Mejora | 🟡 Media | Core `Temporal` | Soporte nativo de consultas bitemporales (`AS OF <timestamp>` sobre intervalos `[valid_at, invalid_at)`) |
| `VDB-REQ-07` | Petición de Mejora | 🟠 Media | Core `graphragSearch` | Poda y límite configurable de grado de conectividad en expansión de grafos para evitar sobrecarga de memoria |
| `VDB-REQ-08` | Petición de Mejora | 🔴 Alta | Core `Fjall` LSM / at-rest | Cifrado en reposo (FIND-249): namespaces cifrados o motor con key del SO |
| `VDB-REQ-09` | Petición de Mejora | 🔴 Alta | `vantadb-node` / packaging | Publicar binding Node versionado en registry (`npm view vantadb-node` hoy 404) |
| `VDB-REQ-10` | Petición de Mejora | 🔴 Alta | `vantadb-node` (fast path / embeddings) | Sin embeddings en el fast path: BM25 léxico puro (`query_vector: []`), sin fusión RRF real |
| `VDB-REQ-11` | Petición de Mejora | 🟠 Media | `vantadb-node` (grafo / IQL) | El binding no expone el motor IQL (`query`): las aristas del GraphRAG se infieren |
| `VDB-REQ-12` | Petición de Mejora | 🟠 Media | `vantadb-node` (grafo) / Ego `ProjectMemoryGraph` | Sustrato de grafo sin sembrar: sin `insertNode`/`addEdge` el GraphRAG devolvía `edges: []` |
| `VDB-REQ-13` | Petición de Mejora | 🟠 Media | `vantadb-node` (context engine) | El `contextAssemble()` nativo no garantiza preservar el system prompt ni los pares `tool_call`/`tool_result` |
| `VDB-REQ-13` | Petición de Mejora | 🟠 Media | `vantadb-node` (context engine) | El `contextAssemble()` nativo no garantiza las invariantes que Ego necesita al compactar: que el system prompt se preserve y que los pares assistant `tool_call` / `tool_result` queden intactos |

---

## Detalle Técnico de los Hallazgos ##

### `VDB-BUG-01`: Rechazo de `cursor: undefined` en `db.list()` ###
* **Componente:** `vantadb-node/src/lib.rs:825-831`
* **Síntoma:** Al invocar `db.list({ namespace: "...", limit: 100, cursor: undefined })`, la operación rechaza con:
  ```
  VantaError: list: cursor must be a number
  ```
* **Causa Raíz:** En Node.js/NAPI-RS, un campo con valor `undefined` se serializa en `serde_json::Value` como
  `Value::Null`. El parser en Rust evalúa:
  ```rust
  if let Some(c) = obj.get("cursor") {
      cursor = Some(c.as_u64().ok_or_else(|| Error::from_reason("cursor must be a number"))? as usize);
  }
  ```
  `obj.get("cursor")` retorna `Some(Value::Null)`. `c.as_u64()` devuelve `None` y dispara el error. Adicionalmente, la documentación indica que el backend WASM emite cursores como `string` decimal, pero el binding Node rechaza cadenas.
* **Workaround en Ego:** [`EgoMemoryAdapter.ts`](../packages/memory/EgoMemoryAdapter.ts#L510) omite la clave `cursor`
  si es `undefined`, inyectándola únicamente cuando es de tipo `number`.
* **Solución recomendada en VantaDB:**
  ```rust
  if let Some(c) = obj.get("cursor") {
      if !c.is_null() {
          let num = c.as_u64().or_else(|| c.as_str().and_then(|s| s.parse().ok()))
              .ok_or_else(|| Error::from_reason("cursor must be a number"))?;
          cursor = Some(num as usize);
      }
  }
  ```

---

### `VDB-BUG-02`: Serialización de metadata y valores primitivos desde Node (enteros IEEE-754 y envoltorio etiquetado) ###

* **Componente:** `packages/memory/EgoMemoryAdapter.ts:479` (evidencia en Ego) — motor `vantadb-node/src/sdk/types.rs` (`enum VantaValue`), deserialización de metadata
* **Síntoma:** Al enviar metadatos con enteros desde Node.js (ej. `{ ts: Date.now() }`), el binding Rust falla con:
  ```
  VantaError: put: invalid metadata: invalid type: floating point 1791394643512.0, expected i64
  ```
* **Causa Raíz:** Los números en V8 (JavaScript) son de punto flotante de doble precisión IEEE-754 (`f64`). NAPI-RS
  serde deserializa números JS como floats por defecto. Al empatar con la variante serde
  `VantaValue::Int(i64)`, serde falla si no encuentra un tipo entero estricto. La misma raíz provoca
  el segundo síntoma: un `metadata` con primitivo sin envolver no encaja en ninguna variante de
  `VantaValue`, de modo que la metadata etiquetada (`{ Float: v }`, `{ String: v }`, `{ Bool: v }`,
  `'Null'`) es la única forma de escribir y leer primitivos desde Node.
* **Workaround en Ego:** [`EgoMemoryAdapter.ts`](../packages/memory/EgoMemoryAdapter.ts#L72) normaliza los tipos
  envolviendo valores primitivos en estructuras etiquetadas `{ Float: v }`, `{ String: v }`, `{
  Bool: v }`, `'Null'`; el desenvuelto inverso vive en `packages/memory/unwrapMetadata.ts:1` y
  se reutiliza en `packages/knowledge/src/BitemporalQueries.ts:39` y
  `packages/knowledge/src/cursorListing.ts:27`.
* **Evidencia en Ego:** `packages/memory/EgoMemoryAdapter.ts:479` (envoltura de primitivos), `:563` (desenvuelto de la
  metadata etiquetada en `putMulti`), `:604` y `:637` (lectura de `list()`),
  `packages/memory/unwrapMetadata.ts:1` (inverso del etiquetado),
  `packages/knowledge/src/BitemporalQueries.ts:39`,
  `packages/knowledge/src/cursorListing.ts:27`, `packages/knowledge/src/FactLifecycle.ts:30`.
* **Impacto en Ego:** toda la metadata de `EgoMemoryAdapter` (KB, hechos, checkpoints, trazas) viaja etiquetada, lo
  que obliga a un envoltorio/desenvoltor propio en cada consumidor y hace que un `metadata` plano
  con un entero sin envolver sea un error en runtime, no una degradación. Es el workaround con más
  superficie del lado de Ego.
* **Solución recomendada en VantaDB:** Implementar deserialización tolerante en Rust con coerción: si un `f64` no
  tiene parte fraccionaria (`val.fract() == 0.0`), deserializarlo automáticamente
  como `VantaValue::Int(val as i64)`; y aceptar primitivos sin envolver en
  `metadata` (variante `Value` genérica) para eliminar la necesidad de
  etiquetado.
* **Estado:** Abierto (upstream). Workaround en Ego: envoltorio etiquetado `{ Float }`/`{ String }`/`{ Bool
  }`/`'Null'` en `EgoMemoryAdapter` + `unwrapMetadata` como inverso.

---

### `VDB-BUG-03`: Bloqueo de Directorio Fjall en Windows ante Errores no Atrapados ###
* **Componente:** Motor de almacenamiento Fjall (`Embedded::open_with_config`)
* **Síntoma:** Si un proceso o prueba unitaria falla con una excepción antes de invocar `db.close()`, los descriptores
  de archivo del LSM-tree retienen el lock. Cualquier intento posterior de reapertura en el mismo proceso
  falla con:
  ```
  VantaError: connect: IO error: FjallError: Locked
  ```
* **Workaround en Ego:** Envolver todas las suites de prueba en bloques `try / finally` y hooks `afterEach` que
  garantizan `adapter.close()` forzoso.
* **Solución recomendada en VantaDB:** Implementar un registro de instancias por proceso (`InstanceRegistry`) o
  finalizadores NAPI `napi_add_finalizer` que liberen el lock de Fjall cuando el
  objeto JS se descarta.

---

### `VDB-INC-01`: Ausencia de Auto-Embed ONNX Local en el Fast Path (`Embedded::put_one`) ###
* **Componente:** `src/sdk/api/memory.rs:733` vs `docs/architecture/memoria-vantadb.md`
* **Síntoma / Inconsistencia:** La documentación canónica de Ego establecía que VantaDB auto-generaba embeddings
  densos (384d) de forma automática al invocar `put()` sin vector. Sin embargo:
  1. En `src/sdk/api/memory.rs:733`, `put_one` ejecuta:
     ```rust
     vector: input.vector.filter(|v| Self::usable_vector(v))
     ```
     No existe invocación a `LocalOnnxProvider` ni llamada a inferencia.
  2. `vantadb-node/Cargo.toml` no compila la feature `embed-local` para evitar dependencias dinámicas pesadas de ONNX Runtime en Node.js.
  3. La inferencia ONNX reside exclusivamente en `vantadb::llm` y se consume en `vanta-memory` (L1/L2) y `vantadb-mcp`.
* **Resolución en Ego:** Desacoplamiento formal de arquitectura:
  * **Fast Path (In-Process NAPI-RS):** Persistencia instantánea y búsqueda léxica BM25 pura (`query_vector: []`) con latencia < 2ms.
  * **Cognitive Path (Subproceso MCP `vantadb-mcp`):** Inferencia vectorial densa y compresión de contexto para capas L0-L3.
* **Petición a VantaDB:** Agregar en VantaDB una feature opcional `embed-on-put` o un hook configurable en `Config`
  para permitir auto-embedding embebido transparente en ambientes donde ONNX Runtime esté
  compilado.

---

### `VDB-REQ-01`: Soporte Nativo de Comodines en Namespaces (`search_multi`) ###
* **Componente:** `src/sdk/search/multi.rs` y `validate_namespace`
* **Petición:** Permitir expresiones de prefijo/comodín como `projects/default/*` o `kb/*` directamente en
  `Embedded::search_multi`.
* **Situación Actual:** La función `validate_namespace` restringe los caracteres a `[A-Za-z0-9._/-]+`. Caracteres como
  `*` son rechazados con `VALIDATION_ERROR`.
* **Workaround en Ego:** [`EgoMemoryAdapter.ts`](../packages/memory/EgoMemoryAdapter.ts#L157) consulta
  `listNamespaces()`, filtra manualmente con regex los namespaces coincidentes y los expande
  antes de enviarlos a Rust.
* **Solución recomendada en VantaDB:** Añadir el método `search_prefix(prefix: &str, request)` en el SDK de Rust que
  realice el escaneo del índice de particiones de forma nativa.

---

### `VDB-REQ-02`: `query_vector` Obligatorio para Búsquedas BM25 en Node ###
* **Componente:** `node_modules/vantadb/dist/native.js:332` (`buildSearchRequestBase`)
* **Petición:** Permitir que `query_vector` sea opcional o nulo cuando se especifica `text_query`.
* **Situación Actual:** `guards.js` lanza:
  ```
  buildSearchRequestBase: query_vector must be an array
  ```
  Incluso si el llamador solo desea ejecutar una búsqueda por texto BM25 pura. Obliga a enviar `query_vector: []`.
* **Solución recomendada en VantaDB:** En `buildSearchRequestBase`, si `request.text_query` está presente y
  `query_vector` es `undefined`, inicializar `query_vector = []` por defecto.

---

### `VDB-REQ-03`: Sanitización de Puntuación en el Tokenizador BM25 ###
* **Componente:** Tokenizador léxico / Tantivy en `src/index/tokenizer.rs`
* **Petición:** Mejorar el tokenizador para que elimine automáticamente signos de puntuación iniciales y finales en
  español (`¿`, `?`, `¡`, `!`, `«`, `»`).
* **Situación Actual:** Si una consulta contiene `"¿Cuáles son los principios?"`, el token resultante puede ser
  `"¿cuáles"` o `"principios?"`. Si el documento indexado contiene `"principios"`, el match
  exacto de término falla debido al signo de interrogación adherido.
* **Workaround en Ego:** [`EgoMemoryLifecycle.ts`](../packages/memory/EgoMemoryLifecycle.ts#L98) sanitiza el prompt
  antes de enviarlo a `searchMulti`:
  ```ts
  const cleanPrompt = prompt.replace(/[¿?¡!.,;:()]/g, " ").trim();
  ```
* **Solución recomendada en VantaDB:** Incorporar un filtro de puntuación Unicode (`UnicodePunctuationFilter`) en el
  pipeline de tokenización avanzado de VantaDB.

---

### `VDB-REQ-04`: Soporte de Buffers Nativos Zero-Copy (`Float32Array` / `PyBuffer`) ###
* **Componente:** `vantadb-node/src/` (NAPI-RS) y `vantadb-py/` (PyO3)
* **Petición:** Permitir el paso de matrices de embeddings y vectores mediante vistas de memoria directa
  (`Float32Array` en JavaScript / `PyBuffer` o `numpy.ndarray` en Python) mapeados directamente a
  punteros contiguos `&[f32]` en Rust, sin serialización intermedia ni duplicación en memoria.
* **Situación Actual:** `vantadb-node` deserializa vectores de punto flotante a través de arrays genéricos o structs
  de serde, lo que en operaciones masivas o búsquedas concurrentes genera presión innecesaria
  sobre el Garbage Collector de V8 y ciclos de CPU adicionales en la conversión de matrices.
* **Impacto en Ego:** Reduce la latencia del fast-path en Electron Main y previene picos de consumo RSS al indexar o
  consultar representaciones densas.
* **Solución recomendada en VantaDB:** Utilizar `napi::bindgen_prelude::Float32Array` en los argumentos de Node-API y
  acceder a `as_slice()` para lectura sin copia; en Python implementar el
  protocolo de búfer de PyO3 (`PyReadonlyArray1<f32>`).

---

### `VDB-REQ-05`: Proceso de Vacuum y Purga de Nodos Eliminados en el Grafo HNSW ###
* **Componente:** Core de vector indexing / `vanta-vector`
* **Petición:** Implementar un mecanismo de compactación incremental (*Vacuum*) para el índice HNSW que purgue los
  nodos eliminados (*tombstones*) y reconstruya las listas de adyacencia de los vecinos afectados.
* **Situación Actual:** Mientras que el motor subyacente Fjall LSM compacta automáticamente las claves y valores en
  disco, las actualizaciones o eliminaciones continuas de recuerdos en el índice vectorial dejan
  nodos fantasma o enlaces degradados en el grafo HNSW en memoria y disco, aumentando el tamaño
  del archivo y perjudicando la localidad de caché y el recall con el paso del tiempo.
* **Impacto en Ego:** Garantiza que agentes con ciclos de vida prolongados que reescriben recuerdos o descartan
  hipótesis no degraden la velocidad ni la precisión de búsqueda semántica.
* **Solución recomendada en VantaDB:** Agregar un comando o tarea en segundo plano `vacuum_vector_index(namespace)`
  que pode enlaces hacia nodos borrados y recablee las capas HNSW sin requerir
  una re-indexación completa desde cero.

---

### `VDB-INC-02`: Exclusión Mutua de Proceso en Fjall LSM frente a Subprocesos / Sidecars ###
* **Componente:** Motor de almacenamiento Fjall (`Embedded::open_with_config` / `flock`)
* **Síntoma:** Si un subproceso secundario (ej. un sidecar de extracción masiva en Python ejecutando `vantadb-py`)
  intenta instanciar `NativeVantaDB` sobre el mismo directorio mientras Electron Desktop (`apps/desktop`
  con `vantadb-node`) está en ejecución, la llamada falla de forma fatal con:
  ```
  VantaError: connect: IO error: FjallError: Locked
  ```
* **Causa Raíz:** Fjall LSM mantiene un bloqueo de archivo exclusivo a nivel de sistema operativo (`flock` en
  Linux/macOS, `LockFile` en Windows) sobre el directorio de datos para garantizar la integridad ACID
  y evitar corrupciones de escritura. Dos procesos independientes no pueden compartir el motor
  embebido in-process en modo lectura/escritura directo.
* **Impacto en Ego:** La tarea `KB-02` (Sidecar opcional en Python para ingesta pesada) no puede abrir la base de
  datos de VantaDB directamente para persistir fragmentos.
* **Workaround en Ego:** El sidecar en Python se desacopla del almacenamiento: actúa exclusivamente como un worker de
  procesamiento y tokenización que emite streams JSONL por `stdio` hacia el proceso Main de
  Electron. Electron Main (el único proceso con el lock activo) ejecuta la inserción batch
  mediante `EgoMemoryAdapter`.
* **Solución recomendada en VantaDB:** Documentar explícitamente el soporte de multi-proceso:
  1. Habilitar un modo de apertura de sólo lectura concurrente (`Embedded::open_readonly`) que no adquiera el lock exclusivo de escritura.
  2. Para modo lectura/escritura compartido, formalizar la recomendación de comunicar a través de un daemon/socket local o canal IPC.

---

### `VDB-BUG-04`: Limitación de Serialización de Metadatos Complejos Anidados en `VantaValue` ###
* **Componente:** `vantadb-node/src/sdk/types.rs` (`enum VantaValue`) y bindings NAPI-RS
* **Síntoma:** Al insertar registros con metadatos estructurados complejos (ej. listas de objetos como `preconditions:
  [{ name: "workspace", satisfied: true }]` en `gov/audit` o `heading_path: ["Capítulo 1", "Sección A"]`
  en `kb/docs`), la llamada a `db.put()` falla con error de deserialización en Rust:
  ```
  VantaError: put: invalid metadata: expected primitive or string value
  ```
* **Causa Raíz:** El tipo `VantaValue` en Rust modela valores primitivos (`String`, `Int`, `Float`, `Bool`) y arrays
  planos, pero no implementa una variante recursiva tipo `VantaValue::Map(HashMap<String,
  VantaValue>)` o `VantaValue::Json(serde_json::Value)` completa para metadatos jerárquicos
  arbitrarios.
* **Workaround en Ego:** En [`packages/decision/src/DecisionAuditor.ts`](../packages/decision/src/DecisionAuditor.ts)
  y en [`EgoMemoryAdapter.ts`](../packages/memory/EgoMemoryAdapter.ts), cualquier objeto o
  lista compleja anidada dentro de `metadata` debe aplanarse o convertirse explícitamente a
  cadena de texto mediante `JSON.stringify()` previo a la inserción, requiriendo `JSON.parse()`
  defensivo en el consumo.
* **Solución recomendada en VantaDB:** Agregar soporte para `serde_json::Value` arbitrario en los metadatos o
  enriquecer `VantaValue` con variantes `Map(HashMap<String, VantaValue>)` y
  `Array(Vec<VantaValue>)` que serialicen transparentemente desde y hacia objetos
  JavaScript anidados.

---

### `VDB-BUG-05`: Rechazo de Búsqueda con Texto Vacío en `search()` / `search_multi()` ###
* **Componente:** `vantadb/dist/guards.js:181` / `src/sdk/api/search.rs`
* **Síntoma:** Al intentar barrer o listar registros de un namespace utilizando `db.search()` o `search_multi()` con
  texto de consulta vacío `""` o espacios en blanco (ej. `db.search_multi(["gov/projects"], "", { topK:
  100 })`), el validador base lanza una excepción de validación fatal:
  ```
  DbError [VantaError]: buildSearchRequestBase: query_vector must be a non-empty array unless text_query or query_sparse is provided
  ```
* **Causa Raíz:** En `guards.js:181`, la guarda evalúa:
  ```javascript
  if (!text_query && !query_sparse && (!query_vector || query_vector.length === 0)) {
    throw new VantaError("buildSearchRequestBase: query_vector must be a non-empty array unless text_query or query_sparse is provided");
  }
  ```
  Una cadena vacía `text_query: ""` se evalúa como falsy (`!text_query === true`), forzando de forma estricta la presencia de un vector denso o esparso.
* **Workaround en Ego:** En `apps/desktop/src/main.ts` y en todos los servicios de dominio, no utilizar
  `searchMulti()` para barridos de namespaces sin término léxico; utilizar obligatoriamente la
  API nativa de paginación [`adapter.list(namespace,
  limit)`](../packages/memory/EgoMemoryAdapter.ts#L155).
* **Solución recomendada en VantaDB:** Permitir `text_query: ""` como coincidencia total (*match-all / full namespace
  scan*) o proveer un método explícito `db.scan()` / documentar la prohibición de
  búsquedas sin vector en la API TypeScript.

---

### `VDB-INC-03`: Invalidación de Descriptores de Instancia tras `db.close()` en el Mismo Proceso ###

* **Componente:** `packages/knowledge/src/HybridSearch.ts:61` (evidencia en Ego) — ciclo de vida de `NativeVantaDB` en NAPI-RS, re-inyección del adaptador mnemónico
* **Síntoma:** Si se cierra el adaptador de base de datos (`adapter.close()` / `db.close()`) y se crea una nueva
  instancia de base de datos en el mismo proceso (como ocurre en suites de prueba E2E multi-reinicio o en
  escenarios de hot-recovery post-crash), cualquier componente downstream que conserve la referencia
  original al adaptador lanza excepciones `[EgoMemoryAdapter] No inicializado`.
* **Causa Raíz:** Al llamar `db.close()`, los punteros nativos de Rust se liberan inmediatamente (`drop`), dejando el
  objeto NAPI en un estado inerte e irrecuperable.
* **Impacto en Ego:** Detectado durante la validación del Golden Path Alpha (`DEC-09` pasos 5-6 y 18-19), donde fue
  necesario re-vincular explícitamente la instancia de `EgoMemoryAdapter` a `DecisionAuditor` tras
  la reapertura en frío.
* **Workaround en Ego:** Inyección dinámica de dependencias y actualización explícita de referencias al adaptador en
  todos los servicios de runtime (`auditor.setAdapter(newAdapter)`); en el paquete de
  conocimiento, `setAdapter()` explícito tras reabrir (hot recovery) en
  `packages/knowledge/src/HybridSearch.ts:61` y
  `packages/knowledge/src/KnowledgeIndexer.ts:25`.
* **Evidencia en Ego:** `packages/knowledge/src/HybridSearch.ts:61` (actualiza el adaptador mnemónico para hot
  recovery), `packages/knowledge/src/KnowledgeIndexer.ts:25` (ídem),
  `packages/decision/src/DecisionAuditor.ts` (inyección del adaptador).
* **Solución recomendada en VantaDB:** Implementar un método `db.reopen(path)` o un wrapper de nivel de sesión que
  permita reactivar descriptores cerrados sin forzar la recreación del wrapper en
  JavaScript.
* **Estado:** Abierto (upstream). Workaround en Ego: re-inyección explícita del adaptador tras `db.close()`.

---

### `VDB-REQ-06`: Soporte Nativo de Consultas Bitemporales (`AS OF <timestamp>`) ###
* **Componente:** Motor de almacenamiento y consulta en `vanta-core`
* **Petición:** Proveer operadores o métodos nativos de consulta temporal (ej. `db.search_as_of({ namespace, query,
  as_of: timestamp })` o predicados sobre intervalos `[valid_at, invalid_at)`).
* **Situación Actual:** VantaDB 0.8.0 indexa marcas de tiempo de inserción `ts`, pero no soporta modelado bitemporal
  (tiempo de transacción vs tiempo de validez del hecho). No existe soporte nativo para
  consultar el estado exacto de una colección de recuerdos en un punto del pasado.
* **Impacto en Ego:** La tarea `KB-09` (Consultas Bitemporales) debe implementar la reconstrucción histórica
  enteramente en espacio de usuario en TypeScript (`BitemporalQueries.ts`), recorriendo aristas
  `SUPERSEDED_BY` e interpretando metadatos temporales de forma manual.
* **Solución recomendada en VantaDB:** Incorporar soporte para campos bitemporales estándar (`tx_time`, `valid_time`)
  e índices temporales en Fjall LSM para ejecutar consultas `AS OF` nativas a
  nivel de motor de almacenamiento.

---

### `VDB-REQ-07`: Poda y Límite de Grado en Expansión de Grafos (`graphragSearch`) ###
* **Componente:** `src/sdk/api/graphrag.rs` (`DIST-15`)
* **Petición:** Permitir parámetros de poda de grado (`max_degree_per_node`, `max_expanded_nodes`, `min_edge_weight`)
  en las opciones de `graphragSearch`.
* **Situación Actual:** La función actual recorre las aristas del grafo sin considerar la centralidad de grado de los
  nodos. Si un nodo semilla es un nodo altamente conectado (un "hub" con cientos de relaciones),
  la expansión de 2 saltos genera un abanico combinatorio desmedido de lecturas en disco y
  saturación de memoria.
* **Impacto en Ego:** Para la tarea `KB-06` (`GraphRagEngine`), Ego debe acotar defensivamente los saltos y filtrar
  candidatos antes de delegar la expansión, aumentando la complejidad del runtime.
* **Solución recomendada en VantaDB:** Agregar poda configurable en el algoritmo de recorrido en Rust:
  ```rust
  pub struct GraphRagOptions {
      pub max_depth: usize,
      pub max_degree_per_node: usize,
      pub max_total_nodes: usize,
      pub min_edge_weight: f32,
  }
  ```
---

### `VDB-REQ-08`: Cifrado en reposo (FIND-249) ###
* **Componente:** Motor Fjall LSM / capa de almacenamiento
* **Petición:** Cifrado at-rest: namespaces cifrados con key del SO o motor con soporte de clave (equivalente a lo que
  Ego hace en memoria con `safeStorage`).
* **Situación Actual:** VantaDB 0.8.0 persiste todo en claro en disco. La cuarentena por defecto de Ego (SEC-09)
  redirige namespaces sensibles a `quarantine/pending`, pero el contenido sigue legible a nivel
  filesystem.
* **Impacto en Ego:** SEC-09 es stopgap: sin cifrado del motor, "cuarentena" no es confidencialidad. La relajación de
  SEC-09 está bloqueada hasta el cierre de FIND-249.
* **Solución recomendada en VantaDB:** Cifrado por namespace con clave externa (Keychain/DPAPI) o flag de cifrado a
  nivel `connect()`, con rotación documentada.

---

### `VDB-REQ-09`: Publicar `vantadb-node` versionado en registry ###
* **Componente:** Packaging / distribución del binding NAPI-RS
* **Petición:** Publicar `vantadb-node` con versiones semánticas en el registry de npm (verificado 2026-10-12/13: `npm
  view vantadb-node` → 404).
* **Situación Actual:** El único consumo posible es `file:../../../VantaDB/vantadb-node` (checkout hermano frágil) más
  stub ficticio en CI. Instalación irreproducible, sin pin real, sin verificación del binding en
  pipeline.
* **Impacto en Ego:** Bloquea H05/M05/H23/H24 y DIST-09 (pin VantaDB). Cada máquina necesita el checkout hermano en la
  ruta exacta.
* **Solución recomendada en VantaDB:** Publicar el binding (o documentar el canal oficial de distribución: scope, tag
  o artefacto) y declarar su ABI/compatibilidad N-API por versión de
  Electron/Node.

---

### `VDB-INC-04`: Borrado físico no garantizado (tombstones legibles) ###

* **Componente:** `packages/security/src/CryptoErasure.ts:1` (evidencia en Ego) — Fjall LSM / `delete` + `vanta-vector` / HNSW, borrado lógico frente a purga física
* **Síntoma:** Tras `delete`, los datos dejan de listarse pero permanecen recuperables a nivel disco hasta
  compactación/vacuum (que no existe: ver `VDB-REQ-05`).
* **Situación Actual:** El borrado es lógico (tombstone). La purga criptográfica de Ego (SEC-07) solo puede garantizar
  borrado a nivel API (sobrescritura + rotación de claves + verificación de lectura), no físico.
* **Impacto en Ego:** `CryptoErasure` documenta `physicalErasure: api-level-only` como límite honesto. Sin vacuum con
  purga, "borrar" no borra.
* **Solución recomendada en VantaDB:** Vacuum con purga física de tombstones (conectar con `VDB-REQ-05`) o API de
  borrado seguro que reescriba los segmentos afectados.
* **Estado:** Abierto (upstream). Workaround en Ego: `CryptoErasure` declara `physicalErasure: api-level-only`
  (borrado a nivel API + rotación de claves + verificación de lectura).

---

### `VDB-BUG-06`: `dist/native.js` resuelve `vantadb-node` como devDependency ###

* **Componente:** `apps/desktop/package.json:35` (evidencia en Ego) — `vantadb/dist/native.js`, import dinámico del binding en el entry productivo
* **Síntoma:** El entry productivo del paquete `vantadb` hace import dinámico de `vantadb-node`, declarado solo como
  devDependency. En instalaciones limpias o empaquetados estrictos (asarUnpack) la resolución es frágil.
* **Situación Actual:** Funciona por accidente de layout `node_modules`, no por declaración. Evidencia en Ego: F2T6
  (el `file:` externo existe precisamente para proveer ese módulo).
* **Impacto en Ego:** Acopla la instalación al checkout hermano; cualquier `npm prune --production` o empaquetado
  puede romper `init()`.
* **Solución recomendada en VantaDB:** Declarar el binding como dependencia real (o peer con rango) u ofrecer
  `native.js` por variante de plataforma sin import cruzado.
* **Estado:** Abierto (upstream). Workaround en Ego: el binding se resuelve por `file:` externo al repo
  (`vantadb-node` como dependencia de producción del paquete de memoria) — ver `EGO-FIND-64`.

### `VDB-REQ-10`: Canal denso (embeddings) y fusión RRF real ausentes en el fast path ###

* **Componente:** `packages/memory/EgoMemoryAdapter.ts:679` (evidencia en Ego) — motor de búsqueda híbrida de `vantadb-node`
* **Petición:** Exponer en el binding NAPI-RS el vector denso de la consulta (ONNX `multilingual-e5-small`, 384d, ya
  disponible en `vanta-memory` / `vantadb-mcp`) o los scores coseno por hit, de modo que el fast path
  pueda ejecutar la fusión RRF (BM25 + denso) y devolver una lista vectorial real.
* **Situación Actual:** `vantadb-node@0.8.0` **sí implementa** RRF en el motor (`SearchExplanationHit.rrf_text_rank` /
  `rrf_vector_rank`, `HybridFusionReport.rrf_k`, `text_candidates`, `vector_candidates`,
  `fused_candidates`), pero solo se activa cuando la búsqueda incluye un `query_vector` denso.
  El fast path napi-rs que usa Ego es **BM25 léxico puro** (`query_vector: []`, workaround
  `VDB-REQ-02`), de modo que el RRF nunca llega a ejecutarse y la búsqueda es mono-lista.
* **Evidencia en Ego:** `packages/memory/EgoMemoryAdapter.ts:679` (docstring de `searchMulti`: "Sin RRF y sin lista
  vectorial"), `packages/knowledge/src/HybridSearch.ts:18` y `:40` (re-rank mono-lista, MMR con
  coseno léxico), `packages/knowledge/src/similarity.ts:12` (interfaz `SimilarityProvider` como
  sustituto del coseno denso), `packages/knowledge/src/schemas/knowledge.ts:66`.
* **Impacto en Ego:** la recuperación de conocimiento de Ego (`KB-04` `HybridSearch`, `KB-06` `GraphRagEngine`) es
  puramente léxica: no puede responder por significado sino por coincidencia de términos, el MMR
  tiene que aproximar la similitud densa con coseno léxico, y el ahorro de la búsqueda híbrida
  real (y del prompt caching de contexto) no se materializa.
* **Solución recomendada en VantaDB:** exponer en el binding NAPI-RS una vía para obtener el embedding denso de la
  consulta (o un `search_multi` que calcule el vector en el engine con ONNX y
  fusione por RRF), de modo que `query_vector` deje de ser un placeholder vacío y
  `HybridFusionReport` se pueble.
* **Estado:** Abierto (upstream). Workaround en Ego: `query_vector: []` (`VDB-REQ-02`) + MMR con coseno léxico
  (`packages/knowledge/src/similarity.ts`).

---

### `VDB-REQ-11`: Motor IQL y grafo nativo no expuestos por el binding ###

* **Componente:** `packages/memory/EgoMemoryAdapter.ts:1208` (evidencia en Ego) — motor de grafo e IQL de `vantadb-node`
* **Petición:** Exponer en el binding NAPI-RS el motor IQL (método `query`) y/o ampliar `graphragSearch` para aceptar
  varios namespaces de semilla, de modo que el descubrimiento de vecinos del grafo se pueda consultar de
  forma nativa y no inferirse heurísticamente desde el contenido.
* **Situación Actual:** la superficie pública de `NativeVantaDB@0.8.0` **no incluye** ningún método `query` (IQL):
  `EgoMemoryAdapter.graphQuery()` es un *capability probe* que siempre devuelve `{ ok: false }`.
  Sí existen `insertNode`, `getNode`, `addEdge`, `graphBfs`, `graphDfs`, `graphDegree` y
  `graphragSearch` (DIST-15), pero `graphragSearch` acepta **un solo** namespace de semilla y
  `max_degree_per_node` no es configurable (ver `VDB-REQ-07`).
* **Evidencia en Ego:** `packages/memory/EgoMemoryAdapter.ts:1208` (docstring de `graphRagSearch`),
  `packages/memory/EgoMemoryAdapter.ts:1248` (docstring de `graphQuery`),
  `packages/memory/GraphRag.ts:13`, `packages/knowledge/src/GraphRagEngine.ts:54` y `:267` (fase
  3: heurística metadata `supersedes` / `doc_id` + regex
  `\b(doc_[a-f0-9]{8,16}|fact_[a-f0-9]{8,16})\b`).
* **Impacto en Ego:** la expansión multi-salto del GraphRAG de Ego (`KB-06`) no consulta el grafo real salvo en los
  subgrafos ya sembrados (ver `VDB-REQ-12`); el resto de las relaciones las infiere de menciones
  en el texto, con falsos positivos (cualquier cadena con forma `doc_<hex>`) y falsos negativos
  (relaciones que no aparecen literalmente en el contenido).
* **Solución recomendada en VantaDB:** publicar el motor IQL en el binding NAPI-RS (o documentar formalmente que IQL
  no forma parte de la superficie Node) y permitir `graphragSearch` con una lista
  de namespaces de semilla.
* **Estado:** Abierto (upstream). Workaround en Ego: descubrimiento por `graphragSearch` + degradación a heurística
  metadata/regex (`packages/knowledge/src/GraphRagEngine.ts:271`).

---

### `VDB-REQ-12`: Sustrato de grafo (`insertNode`/`addEdge`) sin sembrar por parte de Ego ###

* **Componente:** `packages/memory/EgoMemoryAdapter.ts:1099` (evidencia en Ego) — sustrato de grafo de `vantadb-node` (pipeline `graphragSearch`, DIST-15)
* **Petición:** Derivar automáticamente las aristas del grafo a partir de los registros KV (o exponer una API que lo
  haga), de modo que `graphragSearch` tenga relaciones que recorrer sin que el cliente las siembre una
  por una.
* **Situación Actual:** `vantadb-node@0.8.0` **sí expone** `insertNode`, `addEdge` y `getNode`, y el `node_id` de los
  registros KV (u128 decimal) coincide con el id de nodo del grafo, de modo que sembrar aristas
  es viable. El problema era de Ego: no se invocaba esa API, el grafo quedaba vacío y
  `graphragSearch` devolvía `edges: []` para todo subgrafo.
* **Evidencia en Ego:** `packages/memory/EgoMemoryAdapter.ts:1099`, `:1123`, `:1147`, `:1180`, `:1212` (delegaciones
  `getGraphNodeId` / `insertGraphNode` / `addGraphEdge` / `linkGraphNodes`),
  `packages/knowledge/src/ProjectMemoryGraph.ts:102` y `:116` (siembra de la cadena causal traza
  -> referencias por fichero, arista `derived_from`),
  `packages/knowledge/test/GraphSeeding.test.ts:5`.
* **Impacto en Ego:** sin la siembra, `KB-06` (`GraphRagEngine`) se degradaba siempre a la heurística de metadatos y
  regex, y la subgraph de causalidad de ingeniería (`proj/traces` -> `proj/file_traces`) no era
  recorrible por el pipeline nativo.
* **Solución recomendada en VantaDB:** derivar el grafo de los registros KV de forma nativa (o exponer
  `graphragSearch` con un modo "derivar aristas desde metadata"), de modo que el
  cliente no tenga que sembrar el grafo a mano.
* **Estado:** **Resuelto en Ego** (2026-10-20) con el workaround `EgoMemoryAdapter.linkGraphNodes` +
  `ProjectMemoryGraph.seedGraphEdges` (aristas `derived_from` de la cadena causal). **ID upstream
  equivalente**: `DIST-15` (pipeline GraphRAG nativo) y `MEMG-03` (grafo de memoria de proyecto);
  permanece abierta la petición de derivación automática descrita arriba.

### `VDB-REQ-13`: El `contextAssemble()` nativo debe preservar el system prompt y los pares tool ###

* **Componente:** `packages/runtime/src/ContextCompaction.ts:1` (evidencia en Ego) — context engine y compactación de historial de `vantadb-node`
* **Petición:** Garantizar en `contextAssemble(options)` que el bloque de sistema (`protected_prefix`) se conserva
  literalmente y que los pares assistant `tool_call` / `tool_result` nunca se separan ni se descartan,
  de modo que un historial compactado siga siendo válido para una API que exige el orden de los
  `tool_result`.
* **Situación Actual:** `vantadb-node@0.8.0` expone `contextAssemble(options)` con `{ messages, token_budget,
  protected_prefix?, compaction_ratio?, min_keep? }` y la heurística `chars/3`
  (`TokenEstimator::default`; `precise-tokens` opt-in), pero el contrato **no declara** que
  preserve el prefijo protegido ni la integridad de los pares de herramientas: son invariantes
  que Ego sí necesita y que hoy solo garantiza su motor propio (`ContextCompaction.ts`, 742
  líneas, 21 tests).
* **Evidencia en Ego:** `packages/runtime/src/ContextCompaction.ts` (motor canónico: preserva el system prompt y los
  pares tool, resume con LLM inyectable y archiva en `kb/history_archive`),
  `packages/runtime/test/ContextCompaction.test.ts` (15 tests de invariantes),
  `packages/runtime/test/ContextCompaction-unified.test.ts` (6 tests),
  `apps/desktop/src/main.ts:1731` (llamada a `compact()`).
* **Impacto en Ego:** mientras el nativo no garantice esas invariantes, Ego **no puede** delegar la compactación en él
  sin riesgo de romper el contrato de herramientas de los proveedores (un `tool_result` huérfano o
  un system prompt perdido rompe el turno). Por eso
  [ADR-0020](adr/0020-compactacion-motor-ts-vs-nativo.md) mantiene el motor TypeScript como
  canónico y condiciona el nativo a una puerta de invariantes.
* **Solución recomendada en VantaDB:** documentar y garantizar en `contextAssemble()` la preservación del prefijo
  protegido y de los pares `tool_call`/`tool_result` (con tests de contrato en el
  binding), de modo que el motor nativo sea un sustituto drop-in del de Ego.
* **Estado:** Abierto (upstream). Workaround en Ego: `ContextCompaction` (TypeScript) como motor canónico — ver
  [ADR-0020](adr/0020-compactacion-motor-ts-vs-nativo.md).
