---
title: Registro Canónico de Fallos, Inconsistencias y Peticiones de Mejora para VantaDB
status: activo
owner: ness-e
last_updated: 2026-10-07
context: "Derivado de la integración real de Ego con VantaDB 0.8.0 y vantadb-node (Fjall LSM / NAPI-RS)"
---

# Registro Canónico de Hallazgos y Mejoras para VantaDB

> **Propósito:** Fuente única de verdad de todos los errores, fallas, inconsistencias arquitectónicas, fricciones de API y peticiones de mejora identificadas durante el desarrollo e integración de **Ego (Sistema Operativo Cognitivo)** sobre el motor **VantaDB**.
>
> Este documento debe actualizarse de forma incremental con cada hallazgo para retroalimentar el desarrollo del core de VantaDB en Rust y sus bindings NAPI-RS.

---

## Índice de Hallazgos

| ID | Tipo | Severidad | Componente | Descripción Resumida |
|---|---|---|---|---|
| `VDB-BUG-01` | Bug | 🔴 Alta | `vantadb-node` | Rechazo de `cursor: undefined` como `Null` (`cursor must be a number`) |
| `VDB-BUG-02` | Bug | 🔴 Alta | `vantadb-node` / Serde | Fallo de deserialización IEEE-754 a `VantaValue::Int(i64)` |
| `VDB-BUG-03` | Bug / Bloqueo | 🟠 Media | `NativeVantaDB` (Fjall) | Bloqueo residual de descriptores en Windows ante excepciones (`FjallError: Locked`) |
| `VDB-INC-01` | Inconsistencia | 🔴 Alta | `Embedded` / Documentación | Ausencia de Auto-Embed ONNX local en `Embedded::put_one` |
| `VDB-REQ-01` | Petición de Mejora | 🟡 Media | Core `Search` | Soporte nativo de comodines en `search_multi` (`projects/default/*`) |
| `VDB-REQ-02` | Petición de Mejora | 🟢 Baja | `NativeVantaDB.js` | `query_vector` obligatorio para búsquedas puras de texto BM25 |
| `VDB-REQ-03` | Petición de Mejora | 🟡 Media | Tokenizer BM25 | Normalización de signos de puntuación española (`¿`, `?`, `¡`, `!`) |

---

## Detalle Técnico de los Hallazgos

### `VDB-BUG-01`: Rechazo de `cursor: undefined` en `db.list()`
* **Componente:** `vantadb-node/src/lib.rs:825-831`
* **Síntoma:** Al invocar `db.list({ namespace: "...", limit: 100, cursor: undefined })`, la operación rechaza con:
  ```
  VantaError: list: cursor must be a number
  ```
* **Causa Raíz:** En Node.js/NAPI-RS, un campo con valor `undefined` se serializa en `serde_json::Value` como `Value::Null`. El parser en Rust evalúa:
  ```rust
  if let Some(c) = obj.get("cursor") {
      cursor = Some(c.as_u64().ok_or_else(|| Error::from_reason("cursor must be a number"))? as usize);
  }
  ```
  `obj.get("cursor")` retorna `Some(Value::Null)`. `c.as_u64()` devuelve `None` y dispara el error. Adicionalmente, la documentación indica que el backend WASM emite cursores como `string` decimal, pero el binding Node rechaza cadenas.
* **Workaround en Ego:** [`EgoMemoryAdapter.ts`](file:///c:/Users/Eros/VantaDB%20Proyect/Ego/packages/memory/EgoMemoryAdapter.ts#L510) omite la clave `cursor` si es `undefined`, inyectándola únicamente cuando es de tipo `number`.
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

### `VDB-BUG-02`: Deserialización de Enteros IEEE-754 a `VantaValue::Int`
* **Componente:** `vantadb-node/src/sdk/types.rs` (`enum VantaValue`)
* **Síntoma:** Al enviar metadatos con enteros desde Node.js (ej. `{ ts: Date.now() }`), el binding Rust falla con:
  ```
  VantaError: put: invalid metadata: invalid type: floating point 1791394643512.0, expected i64
  ```
* **Causa Raíz:** Los números en V8 (JavaScript) son de punto flotante de doble precisión IEEE-754 (`f64`). NAPI-RS serde deserializa números JS como floats por defecto. Al empatar con la variante serde `VantaValue::Int(i64)`, serde falla si no encuentra un tipo entero estricto.
* **Workaround en Ego:** [`EgoMemoryAdapter.ts`](file:///c:/Users/Eros/VantaDB%20Proyect/Ego/packages/memory/EgoMemoryAdapter.ts#L72) normaliza los tipos envolviendo valores primitivos en estructuras etiquetadas `{ Float: v }`, `{ String: v }`, `{ Bool: v }`, `'Null'`.
* **Solución recomendada en VantaDB:** Implementar deserialización tolerante en Rust con coerción: si un `f64` no tiene parte fraccionaria (`val.fract() == 0.0`), deserializarlo automáticamente como `VantaValue::Int(val as i64)`.

---

### `VDB-BUG-03`: Bloqueo de Directorio Fjall en Windows ante Errores no Atrapados
* **Componente:** Motor de almacenamiento Fjall (`Embedded::open_with_config`)
* **Síntoma:** Si un proceso o prueba unitaria falla con una excepción antes de invocar `db.close()`, los descriptores de archivo del LSM-tree retienen el lock. Cualquier intento posterior de reapertura en el mismo proceso falla con:
  ```
  VantaError: connect: IO error: FjallError: Locked
  ```
* **Workaround en Ego:** Envolver todas las suites de prueba en bloques `try / finally` y hooks `afterEach` que garantizan `adapter.close()` forzoso.
* **Solución recomendada en VantaDB:** Implementar un registro de instancias por proceso (`InstanceRegistry`) o finalizadores NAPI `napi_add_finalizer` que liberen el lock de Fjall cuando el objeto JS se descarta.

---

### `VDB-INC-01`: Ausencia de Auto-Embed ONNX Local en el Fast Path (`Embedded::put_one`)
* **Componente:** `src/sdk/api/memory.rs:733` vs `docs/architecture/memoria-vantadb.md`
* **Síntoma / Inconsistencia:** La documentación canónica de Ego establecía que VantaDB auto-generaba embeddings densos (384d) de forma automática al invocar `put()` sin vector. Sin embargo:
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
* **Petición a VantaDB:** Agregar en VantaDB una feature opcional `embed-on-put` o un hook configurable en `Config` para permitir auto-embedding embebido transparente en ambientes donde ONNX Runtime esté compilado.

---

### `VDB-REQ-01`: Soporte Nativo de Comodines en Namespaces (`search_multi`)
* **Componente:** `src/sdk/search/multi.rs` y `validate_namespace`
* **Petición:** Permitir expresiones de prefijo/comodín como `projects/default/*` o `kb/*` directamente en `Embedded::search_multi`.
* **Situación Actual:** La función `validate_namespace` restringe los caracteres a `[A-Za-z0-9._/-]+`. Caracteres como `*` son rechazados con `VALIDATION_ERROR`.
* **Workaround en Ego:** [`EgoMemoryAdapter.ts`](file:///c:/Users/Eros/VantaDB%20Proyect/Ego/packages/memory/EgoMemoryAdapter.ts#L157) consulta `listNamespaces()`, filtra manualmente con regex los namespaces coincidentes y los expande antes de enviarlos a Rust.
* **Solución recomendada en VantaDB:** Añadir el método `search_prefix(prefix: &str, request)` en el SDK de Rust que realice el escaneo del índice de particiones de forma nativa.

---

### `VDB-REQ-02`: `query_vector` Obligatorio para Búsquedas BM25 en Node
* **Componente:** `node_modules/vantadb/dist/native.js:332` (`buildSearchRequestBase`)
* **Petición:** Permitir que `query_vector` sea opcional o nulo cuando se especifica `text_query`.
* **Situación Actual:** `guards.js` lanza:
  ```
  buildSearchRequestBase: query_vector must be an array
  ```
  Incluso si el llamador solo desea ejecutar una búsqueda por texto BM25 pura. Obliga a enviar `query_vector: []`.
* **Solución recomendada en VantaDB:** En `buildSearchRequestBase`, si `request.text_query` está presente y `query_vector` es `undefined`, inicializar `query_vector = []` por defecto.

---

### `VDB-REQ-03`: Sanitización de Puntuación en el Tokenizador BM25
* **Componente:** Tokenizador léxico / Tantivy en `src/index/tokenizer.rs`
* **Petición:** Mejorar el tokenizador para que elimine automáticamente signos de puntuación iniciales y finales en español (`¿`, `?`, `¡`, `!`, `«`, `»`).
* **Situación Actual:** Si una consulta contiene `"¿Cuáles son los principios?"`, el token resultante puede ser `"¿cuáles"` o `"principios?"`. Si el documento indexado contiene `"principios"`, el match exacto de término falla debido al signo de interrogación adherido.
* **Workaround en Ego:** [`EgoMemoryLifecycle.ts`](file:///c:/Users/Eros/VantaDB%20Proyect/Ego/packages/memory/EgoMemoryLifecycle.ts#L98) sanitiza el prompt antes de enviarlo a `searchMulti`:
  ```ts
  const cleanPrompt = prompt.replace(/[¿?¡!.,;:()]/g, " ").trim();
  ```
* **Solución recomendada en VantaDB:** Incorporar un filtro de puntuación Unicode (`UnicodePunctuationFilter`) en el pipeline de tokenización avanzado de VantaDB.
