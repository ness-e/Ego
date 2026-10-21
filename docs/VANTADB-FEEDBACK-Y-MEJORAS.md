---
title: Registro Canónico de Fallos, Inconsistencias y Peticiones de Mejora para VantaDB
status: activo
owner: ness-e
last_updated: 2026-10-10
context: "Derivado de la integración real de Ego con VantaDB 0.8.0 y vantadb-node (Fjall LSM / NAPI-RS)"
---

# Registro Canónico de Hallazgos y Mejoras para VantaDB

> **Propósito:** Fuente única de verdad de todos los errores, fallas, inconsistencias arquitectónicas, fricciones de API y peticiones de mejora identificadas durante el desarrollo e integración
> de **Ego (Sistema Operativo Cognitivo)** sobre el motor **VantaDB**.
>
> Este documento debe actualizarse de forma incremental con cada hallazgo para retroalimentar el desarrollo del core de VantaDB en Rust y sus bindings NAPI-RS.

---

## Estado verificado 2026-10-21 (contra el binding `vantadb-node@0.9.0`)

> **Qué es esto:** cada hallazgo del registro se **ejecutó contra el binding real
> `vantadb-node@0.9.0`** (no contra la documentación). El veredicto es empírico:
> cuando el motor lanza un error, se cita el **mensaje literal**.
>
> Esta tabla es un **resumen**; el detalle de cada entrada, con su evidencia, está
> más abajo. Los IDs van **sin backticks** aquí a propósito: el gate
> `scripts/verify-vantadb-ids.mjs` toma cualquier fila que empiece por
> `| \`VDB-XXX-NN\` |` como fila de índice y machacaría la entrada real.
> La tabla canónica es la de `## Índice de Hallazgos ##`, más abajo.
>
> **Recuento:** 26 hallazgos — **8 resueltos**, **4 parciales**,
> **4 persisten** y **10 sin verificar** (peticiones de mejora al motor fuera del
> alcance de esta ronda).

| Hallazgo | Tipo | Veredicto | Evidencia empírica |
|---|---|---|---|
| VDB-BUG-01 | Bug | ✅ RESUELTO | `list(ns,{limit:10,cursor:undefined})` → 1 registro, `next_cursor=null`: la API pasó a objeto de opciones y ya no existe el error «cursor must be a number» |
| VDB-BUG-02 | Bug | 🟡 PARCIAL | Un entero 2^53+1 vuelve como `<object>` (envoltorio etiquetado = contrato documentado): ya no hay pérdida f64, pero Ego **sigue necesitando** `unwrapMetadata` |
| VDB-BUG-03 | Bug | ❓ sin verificar | Bloqueo residual de descriptores en Windows: fuera del alcance de esta ronda |
| VDB-BUG-04 | Bug | ❌ PERSISTE | `put` con metadata anidada de 7 niveles → *«unknown variant `b`…»*: `VantaValue` es una unión **plana**, sin variante Map/Object recursiva |
| VDB-BUG-05 | Bug | ✅ RESUELTO | `search({text_query:""})` → 0 hits sin excepción: ya no «text_query must not be empty» |
| VDB-BUG-06 | Bug | ❓ sin verificar | `vantadb/dist/native.js` resuelve `vantadb-node` como devDependency: fuera del alcance de esta ronda |
| VDB-INC-01 | Inconsistencia | ❌ PERSISTE | `capabilities().embedding` sin `embed-local` compilado; el binding de Node devuelve `provider=undefined` → **no hay embeddings locales** |
| VDB-INC-02 | Inconsistencia | ❓ sin verificar | Exclusión mutua de proceso (`flock`): fuera del alcance de esta ronda |
| VDB-INC-03 | Inconsistencia | ✅ RESUELTO | `get()` tras `close()` **lanza** «database is closing»: el descriptor ya no queda invalidable en silencio |
| VDB-INC-04 | Inconsistencia | ✅ RESUELTO | `delete` → `get`=null **Y** `search`=0 hits: las tombstones **ya no son legibles** |
| VDB-REQ-01 | Petición | ❓ sin verificar | Petición de mejora al motor: fuera del alcance de esta ronda |
| VDB-REQ-02 | Petición | ✅ RESUELTO | `searchMulti(ns,{query_vector:[]})` → 2 hits; la API **documenta** el vector vacío para búsqueda sólo-texto ⇒ el workaround **puede retirarse** — y **se retiró** el 2026-10-21 (A2-bis) |
| VDB-REQ-03 | Petición | ❓ sin verificar | Petición de mejora al motor: fuera del alcance de esta ronda |
| VDB-REQ-04 | Petición | ❓ sin verificar | Petición de mejora al motor: fuera del alcance de esta ronda |
| VDB-REQ-05 | Petición | ❓ sin verificar | Petición de mejora al motor: fuera del alcance de esta ronda |
| VDB-REQ-06 | Petición | ❓ sin verificar | Petición de mejora al motor: fuera del alcance de esta ronda |
| VDB-REQ-07 | Petición | ❓ sin verificar | Petición de mejora al motor: fuera del alcance de esta ronda |
| VDB-REQ-08 | Petición | ❓ sin verificar | Petición de mejora al motor: fuera del alcance de esta ronda |
| VDB-REQ-09 | Petición | ✅ RESUELTO | **`vantadb-node@0.9.0` está publicado en npm** (Apache-2.0; win32/darwin/linux; x64+arm64; con firmas y `sha512`) → desbloquea `EGO-FIND-64` y `DIST-09` |
| VDB-REQ-10 | Petición | ❌ PERSISTE | Sin método `embed`; `capabilities().vector_search=true` pero el fast path sigue siendo **BM25 léxico** |
| VDB-REQ-11 | Petición | 🟡 PARCIAL | `query` (IQL) ausente en el binding de Node, PERO `capabilities().iql_queries=true`, hay **6 algoritmos de grafo** y `vantadb-ts` **sí** expone `system.query(query)` |
| VDB-REQ-12 | Petición | 🟡 PARCIAL | `insertNode` + `addEdge` **aceptados**, pero `graphragSearch` devuelve **0 nodos / 0 aristas**: el sustrato se siembra y la búsqueda **no lo traverse** |
| VDB-REQ-13 | Petición | ✅ RESUELTO | `contextAssemble({messages,token_budget:500})` → **system preservado** y **pares tool preservados** ⇒ la **puerta del ADR-0020 está VERDE** ⇒ E2 desbloqueado |
| VDB-REQ-14 | Petición | ❌ PERSISTE | **Pre-reserva de 320 MB por store al conectar** (4×`vstore_L*.vanta` de 64 MB + `0.jnl`), no parametrizable. En Ego: 1 store en producción = **320,03 MB de disco** y **≈ 0,45 MB de RAM** |
| VDB-REQ-15 | Petición | ✅ CABLEADO | `memoryRecall({trust_aware:true})` ofrece re-rank compuesto con confianza (S8/FIND-320, MEMG-21) y **ya está cableado en Ego** (A2-bis), verificado contra el motor real |
| VDB-REQ-16 | Petición | 🟡 PARCIAL | El binding `vantadb-node@0.9.0` tiene las 4 APIs, pero la fachada de `vantadb@0.9.0` no las re-expone y, sin el enlace materializado, fuera de `packages/memory` se resuelve el global 0.6.1 |

### Las 3 conclusiones accionables

1. **`vantadb-node@0.9.0` está publicado en npm** (Apache-2.0; `win32`/`darwin`/`linux`;
   `x64`+`arm64`; con firmas y `sha512`). ⇒ **`EGO-FIND-64` y `DIST-09` se
   desbloquean**: los dos manifiestos (`apps/desktop/package.json:38`,
   `packages/memory/package.json:27`) pueden pasar de `file:../../../VantaDB/vantadb-node`
   a **versión semántica**, y CI deja de compilar un stub no-op para ejercitar el
   binding real. *Lo aplica A7* (manifiestos + lockfile).
2. **La invariante del [ADR-0020](adr/0020-compactacion-motor-ts-vs-nativo.md) está
   VERDE**: `contextAssemble({messages,token_budget:500})` preserva el **system
   prompt** y los **pares `tool_call`/`tool_result`**. ⇒ **E2 (Fase 06) queda
   desbloqueado** y el `contextAssemble()` nativo —*función pura, sin estado de
   motor, que funciona incluso con la base de datos cerrándose*— es **candidato a
   sustituir las 520 líneas de `ContextCompaction` TS**. El ADR-0020 («híbrido
   condicionado») **ya tiene la condición cumplida**: le toca a A2 decidir.
3. **`VDB-REQ-14` es la petición más urgente** de todo el registro: **320 MB de
   pre-reserva por store al conectar** (`packages/memory/EgoMemoryAdapter.ts:291`),
   **no parametrizable** por `ConnectOptions`. Afecta al **100 % del estado
   persistente del producto** y, en la suite, hace aparecer un `IO error: Disk full`
   **en un test ajeno** — el síntoma en el sitio equivocado.

### Lo que además se puede retirar ya (sin tocar código de la Ola 4)

* **`VDB-REQ-02`**: el workaround `query_vector: []` **puede retirarse** (la API de
  0.9.0 lo documenta como el camino de búsqueda sólo-texto). Diff exacto en el
  handoff `A1-ola4.md` §3 para A2.
* **`VDB-BUG-05`**: `text_query: ""` ya no se rechaza → el guard de
  `packages/memory/EgoMemoryAdapter.ts:697` es retirable.
* **`VDB-BUG-01`**: `cursor: undefined` ya no se rechaza → la omisión condicional
  de `packages/memory/EgoMemoryAdapter.ts:510` es inocua.

---

## Índice de Hallazgos ##

|---|---|---|---|---|---|
| ID | Tipo | Severidad | Componente | Descripción Resumida | Estado verificado 2026-10-21 |
| `VDB-BUG-01` | Bug | 🔴 Alta | `vantadb-node` | Rechazo de `cursor: undefined` como `Null` (`cursor must be a number`) | ✅ RESUELTO |
| `VDB-BUG-02` | Bug | 🔴 Alta | `vantadb-node` / Serde | Serialización de metadata y valores primitivos desde Node: enteros f64 IEEE-754 y envoltorio etiquetado | 🟡 PARCIAL |
| `VDB-BUG-03` | Bug / Bloqueo | 🟠 Media | `NativeVantaDB` (Fjall) | Bloqueo residual de descriptores en Windows ante excepciones (`FjallError: Locked`) | ❓ sin verificar |
| `VDB-INC-01` | Inconsistencia | 🔴 Alta | `Embedded` / Documentación | Ausencia de Auto-Embed ONNX local en `Embedded::put_one` | ❌ PERSISTE |
| `VDB-INC-02` | Inconsistencia / Bloqueo | 🔴 Alta | `Fjall` LSM / Concurrencia | Exclusión mutua de proceso (`flock`) impidiendo acceso multi-proceso embebido (sidecar Python) | ❓ sin verificar |
| `VDB-BUG-04` | Bug / Limitación | 🟠 Media | `vantadb-node` / Serde | Rechazo de estructuras anidadas profundas en `metadata` (`VantaValue` carece de variante Map/Object recursiva) | ❌ PERSISTE |
| `VDB-BUG-05` | Bug / Validación | 🟡 Media | Core `Search` / Guards | Rechazo de búsqueda léxica con texto vacío `text_query: ""` (`query_vector must be a non-empty array`) | ✅ RESUELTO |
| `VDB-INC-03` | Inconsistencia | 🟠 Media | `NativeVantaDB` (Ciclo de Vida) | Invalidación de descriptores tras `db.close()`: el adaptador mnemónico queda inerte (hot recovery) | ✅ RESUELTO |
| `VDB-INC-04` | Inconsistencia | 🟠 Media | Fjall LSM / `delete` + `vanta-vector` | Borrado físico no garantizado: tras `delete` los datos siguen en disco (tombstone) | ✅ RESUELTO |
| `VDB-BUG-06` | Bug / Limitación | 🟠 Media | `vantadb/dist/native.js` (import dinámico) | El entry de `vantadb` resuelve `vantadb-node` declarado solo como devDependency | ❓ sin verificar |
| `VDB-REQ-01` | Petición de Mejora | 🟡 Media | Core `Search` | Soporte nativo de comodines en `search_multi` (`projects/default/*`) | ❓ sin verificar |
| `VDB-REQ-02` | Petición de Mejora | 🟢 Baja | `NativeVantaDB.js` | `query_vector` obligatorio para búsquedas puras de texto BM25 | ✅ RESUELTO |
| `VDB-REQ-03` | Petición de Mejora | 🟡 Media | Tokenizer BM25 | Normalización de signos de puntuación española (`¿`, `?`, `¡`, `!`) | ❓ sin verificar |
| `VDB-REQ-04` | Petición de Mejora | 🟠 Media | `vantadb-node` / `vantadb-py` | Ingesta sin copia (*Zero-Copy*) para arrays de vectores (`Float32Array` / `PyBuffer`) | ❓ sin verificar |
| `VDB-REQ-05` | Petición de Mejora | 🟠 Media | Core `vanta-vector` / HNSW | *Vacuum* y desfragmentación periódica de grafos HNSW (purga de *tombstones*) | ❓ sin verificar |
| `VDB-REQ-06` | Petición de Mejora | 🟡 Media | Core `Temporal` | Soporte nativo de consultas bitemporales (`AS OF <timestamp>` sobre intervalos `[valid_at, invalid_at)`) | ❓ sin verificar |
| `VDB-REQ-07` | Petición de Mejora | 🟠 Media | Core `graphragSearch` | Poda y límite configurable de grado en expansión de grafos para evitar sobrecarga | ❓ sin verificar |
| `VDB-REQ-08` | Petición de Mejora | 🔴 Alta | Core `Fjall` LSM / at-rest | Cifrado en reposo (FIND-249): namespaces cifrados o motor con key del SO | ❓ sin verificar |
| `VDB-REQ-09` | Petición de Mejora | 🔴 Alta | `vantadb-node` / packaging | Publicar binding Node versionado en registry (`npm view vantadb-node` hoy 404) | ✅ RESUELTO |
| `VDB-REQ-10` | Petición de Mejora | 🔴 Alta | `vantadb-node` (fast path / embeddings) | Sin embeddings en el fast path: BM25 léxico puro (`query_vector: []`), sin fusión RRF real | ❌ PERSISTE |
| `VDB-REQ-11` | Petición de Mejora | 🟠 Media | `vantadb-node` (grafo / IQL) | El binding no expone el motor IQL (`query`): las aristas del GraphRAG se infieren | 🟡 PARCIAL |
| `VDB-REQ-12` | Petición de Mejora | 🟠 Media | `vantadb-node` (grafo) / Ego `ProjectMemoryGraph` | Sustrato de grafo sin sembrar: sin `insertNode`/`addEdge` devolvía `edges: []` | 🟡 PARCIAL |
| `VDB-REQ-13` | Petición de Mejora | 🟠 Media | `vantadb-node` (context engine) | El `contextAssemble()` nativo no garantiza preservar el system prompt ni los pares tool | ✅ RESUELTO |
| `VDB-REQ-14` | Petición de Mejora | 🔴 Alta | `vantadb-node` (pre-reserva del vector store) | Pre-reserva de 320 MB por store al conectar, no parametrizable por `ConnectOptions` | ❌ PERSISTE |
| `VDB-REQ-15` | Petición de Mejora | 🟡 Media | `vantadb-node` (recall / confianza) | Re-rank compuesto con confianza en `memoryRecall({ trust_aware: true })`, sin cablear | 🟡 PARCIAL |
| `VDB-REQ-16` | Petición de Mejora | 🟠 Alta | `vantadb` (wrapper + resolución) | El wrapper no re-expone las APIs cognitivas del binding y, sin el enlace materializado, fuera de `packages/memory` se resuelve el global 0.6.1 | 🟡 PARCIAL |

---

## Detalle Técnico de los Hallazgos ##

### `VDB-BUG-01`: Rechazo de `cursor: undefined` en `db.list()` ###

* **Componente:** `vantadb-node/src/lib.rs:825-831`
* **Síntoma:** *(histórico, 0.8.0)* Al invocar `db.list({ namespace: "...", limit: 100, cursor: undefined })`, la operación rechazaba con:

  ```
  VantaError: list: cursor must be a number
  ```

  > **Verificado 2026-10-21 contra `vantadb-node@0.9.0`:** `list(ns,{limit:10,cursor:undefined})` devuelve 1 registro con `next_cursor=null`. La API pasó a objeto de opciones y **el error ya no
  existe**.
* **Causa Raíz:** En Node.js/NAPI-RS, un campo con valor `undefined` se serializa en `serde_json::Value` como
  `Value::Null`. El parser en Rust evalúa:

  ```rust
  if let Some(c) = obj.get("cursor") {
      cursor = Some(c.as_u64().ok_or_else(|| Error::from_reason("cursor must be a number"))? as usize);
  }
  ```

  `obj.get("cursor")` retorna `Some(Value::Null)`. `c.as_u64()` devuelve `None` y dispara el error. Adicionalmente, la documentación indica que el backend WASM emite cursores como `string` decimal,
  pero el binding Node rechaza cadenas.
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

* **Impacto en Ego:** `packages/memory/EgoMemoryAdapter.ts:510` tiene que omitir la clave `cursor` cuando es `undefined` e inyectarla solo si es `number`: sin eso, **toda** paginación de `list()`
  lanzaba. Con 0.9.0 el objeto de opciones acepta `undefined` y el workaround es inocuo (puede retirarse).
* **Estado:** ✅ **Resuelto en `vantadb-node@0.9.0`** (verificado 2026-10-21). Workaround en Ego: la omisión condicional de `cursor` en `EgoMemoryAdapter.ts:510` — inocua, retirable.
* **Estado verificado (2026-10-21):** ✅ RESUELTO — `list(ns,{limit:10,cursor:undefined})` → 1 registro, `next_cursor=null`: la API pasó a objeto de opciones y ya no existe el error «cursor must
  be a number»

---

### `VDB-BUG-02`: Serialización de metadata y valores primitivos desde Node (enteros IEEE-754 y envoltorio etiquetado) ###

* **Componente:** `packages/memory/EgoMemoryAdapter.ts:479` (evidencia en Ego) — motor `vantadb-node/src/sdk/types.rs` (`enum VantaValue`), deserialización de metadata
* **Síntoma:** *(histórico, 0.8.0)* Al enviar metadatos con enteros desde Node.js (ej. `{ ts: Date.now() }`), el binding Rust fallaba con:

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
* **Estado verificado (2026-10-21):** 🟡 PARCIAL — Un entero 2^53+1 vuelve como `<object>` (el envoltorio etiquetado es el contrato documentado): **ya no hay pérdida de precisión f64**, pero Ego
  **sigue necesitando** `unwrapMetadata`

---

### `VDB-BUG-03`: Bloqueo de Directorio Fjall en Windows ante Errores no Atrapados ###

* **Componente:** `packages/memory/test/contract-vantadb.test.ts:33` (evidencia en Ego) — motor de almacenamiento Fjall (`Embedded::open_with_config`)
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
* **Impacto en Ego:** el teardown con cierre forzado es **obligatorio** en toda suite que abre un store: las 12 suites de `packages/memory/test/` y `packages/knowledge/test/` cierran en
  `afterAll`/`afterEach` (p. ej. `packages/memory/test/contract-vantadb.test.ts:33`). Si el proceso muere antes del cierre, el directorio queda bloqueado y la siguiente apertura en la misma ruta
  falla.
* **Estado:** ❓ Sin verificar en esta ronda (2026-10-21). Workaround en Ego: teardown forzado en `afterAll`/`afterEach`.
* **Estado verificado (2026-10-21):** ❓ sin verificar — Bloqueo residual de descriptores en Windows: fuera del alcance de esta ronda

---

### `VDB-INC-01`: Ausencia de Auto-Embed ONNX Local en el Fast Path (`Embedded::put_one`) ###

* **Componente:** `src/sdk/api/memory.rs:733` vs `docs/architecture/memoria-vantadb.md`
* **Síntoma:** *(verificado 2026-10-21 contra 0.9.0 — PERSISTE)* La documentación canónica de Ego establecía que VantaDB auto-generaba embeddings
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
* **Síntoma:** la documentación canónica de Ego establecía que VantaDB auto-generaba embeddings densos (384d) de forma automática al invocar `put()` sin vector; el motor no lo hace.
* **Impacto en Ego:** el fast path sólo puede buscar por término: `packages/knowledge/src/HybridSearch.ts:18` declara que no hay RRF y `packages/knowledge/src/similarity.ts:12` sustituye el
  coseno denso por un coseno léxico. Sin embeddings, `KB-04` no puede responder por significado, sólo por coincidencia de términos.
* **Solución recomendada en VantaDB:** agregar una feature opcional `embed-on-put` o un hook configurable en `Config` que permita auto-embedding embebido transparente donde ONNX Runtime esté
  compilado.
* **Estado:** ❌ **Persiste en 0.9.0** (verificado 2026-10-21: `capabilities().embedding` sin `embed-local`, `provider=undefined`). Workaround en Ego: separación formal Fast Path / Cognitive Path
  (`vantadb-mcp` para L0-L3).
* **Estado verificado (2026-10-21):** ❌ PERSISTE — `capabilities().embedding` sin `embed-local` compilado; el binding de Node devuelve `provider=undefined` → **no hay embeddings locales**

---

### `VDB-REQ-01`: Soporte Nativo de Comodines en Namespaces (`search_multi`) ###

* **Componente:** `packages/memory/EgoMemoryAdapter.ts:708` (evidencia en Ego) — `src/sdk/search/multi.rs` y `validate_namespace`
* **Petición:** Permitir expresiones de prefijo/comodín como `projects/default/*` o `kb/*` directamente en
  `Embedded::search_multi`.
* **Situación Actual:** La función `validate_namespace` restringe los caracteres a `[A-Za-z0-9._/-]+`. Caracteres como
  `*` son rechazados con `VALIDATION_ERROR`.
* **Workaround en Ego:** [`EgoMemoryAdapter.ts`](../packages/memory/EgoMemoryAdapter.ts#L157) consulta
  `listNamespaces()`, filtra manualmente con regex los namespaces coincidentes y los expande
  antes de enviarlos a Rust.
* **Solución recomendada en VantaDB:** Añadir el método `search_prefix(prefix: &str, request)` en el SDK de Rust que
  realice el escaneo del índice de particiones de forma nativa.
* **Impacto en Ego:** `packages/memory/EgoMemoryAdapter.ts:708` lista los namespaces y expande a mano el comodín en **cada** búsqueda que lo lleva: el motor no conoce el comodín y Ego paga una
  enumeración completa por consulta.
* **Estado:** ❓ Sin verificar en esta ronda (2026-10-21). Workaround en Ego: expansión manual de `prefijo/*` contra `listNamespaces()`.
* **Estado verificado (2026-10-21):** ❓ sin verificar — Petición de mejora al motor: fuera del alcance de esta ronda

---

### `VDB-REQ-02`: `query_vector` Obligatorio para Búsquedas BM25 en Node ###

* **Componente:** `node_modules/vantadb/dist/native.js:332` (`buildSearchRequestBase`)
* **Petición:** Permitir que `query_vector` sea opcional o nulo cuando se especifica `text_query`.
* **Situación Actual:** *(verificado 2026-10-21 contra 0.9.0 — RESUELTO)* la guarda ya no bloquea: la API **documenta** que un `query_vector` vacío con `text_query` es el camino de búsqueda
  sólo-texto (BM25). En 0.8.0 `guards.js` lanzaba:

  ```
  buildSearchRequestBase: query_vector must be an array
  ```

  Incluso si el llamador solo desea ejecutar una búsqueda por texto BM25 pura. Obliga a enviar `query_vector: []`.
* **Solución recomendada en VantaDB:** En `buildSearchRequestBase`, si `request.text_query` está presente y
  `query_vector` es `undefined`, inicializar `query_vector = []` por defecto.
* **Impacto en Ego:** `packages/memory/EgoMemoryAdapter.ts:739` y `:775` envían `query_vector: []` en **toda** búsqueda para satisfacer la guarda del binding. Con 0.9.0 el workaround es
  **retirable** (la API documenta el vector vacío para búsqueda sólo-texto) y su retirada no cambia el resultado: se midió 2 hits con y sin él.
* **Estado:** ✅ **Resuelto en `vantadb-node@0.9.0`** (verificado 2026-10-21) **y retirado del código el 2026-10-21 (A2-bis, T3)**. Workaround en Ego: **ninguno** — el `query_vector: []` explícito ya no está. **Medido:** `search` con `text_query` funciona **sin** `query_vector`. **Matiz:** el guard de `VDB-BUG-05` **se conserva**, porque `text_query: ""` **con** `query_vector: []` **lanza** (`query_vector must be a non-empty array`).
* **Estado verificado (2026-10-21):** ✅ RESUELTO — `searchMulti(ns,{query_vector:[]})` → 2 hits; la API **documenta** «Pass an empty query_vector with text_query for text-only (BM25)» → el
  workaround de Ego **puede retirarse**

---

### `VDB-REQ-03`: Sanitización de Puntuación en el Tokenizador BM25 ###

* **Componente:** `packages/memory/EgoMemoryLifecycle.ts:154` (evidencia en Ego) — tokenizador léxico / Tantivy en `src/index/tokenizer.rs`
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
* **Impacto en Ego:** `packages/memory/EgoMemoryLifecycle.ts:154` sanea la puntuación española (`[¿?¡!.,;:()]` → espacio) **antes de cada búsqueda**, porque el tokenizador no la descarta: sin ese
  `replace`, una consulta como «¿Cuáles son los principios?» no encuentra «principios».
* **Estado:** ❓ Sin verificar en esta ronda (2026-10-21). Workaround en Ego: saneado de puntuación en `EgoMemoryLifecycle.ts:154`.
* **Estado verificado (2026-10-21):** ❓ sin verificar — Petición de mejora al motor: fuera del alcance de esta ronda

---

### `VDB-REQ-04`: Soporte de Buffers Nativos Zero-Copy (`Float32Array` / `PyBuffer`) ###

* **Componente:** `packages/knowledge/src/similarity.ts:12` (evidencia en Ego) — `vantadb-node/src/` (NAPI-RS) y `vantadb-py/` (PyO3)
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
* **Impacto en Ego:** hoy la petición es **inocua para Ego**: no hay camino de ingestión vectorial densa en el fast path, y `packages/knowledge/src/similarity.ts:12` es el sustituto léxico del
  coseno denso. Pasará a ser→「deuda de latencia» cuando `VDB-REQ-10` se cierre.
* **Estado:** ❓ Sin verificar en esta ronda (2026-10-21). Workaround en Ego: no aplica (no hay vectores en el fast path).
* **Estado verificado (2026-10-21):** ❓ sin verificar — Petición de mejora al motor: fuera del alcance de esta ronda

---

### `VDB-REQ-05`: Proceso de Vacuum y Purga de Nodos Eliminados en el Grafo HNSW ###

* **Componente:** `packages/knowledge/src/schemas/knowledge.ts:66` (evidencia en Ego) — core de vector indexing / `vanta-vector`
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
* **Impacto en Ego:** también **inocua hoy**: `packages/knowledge/src/schemas/knowledge.ts:66` documenta que el fast path es BM25 puro, así que no hay índice HNSW que purgar. Se vuelve deuda real
  cuando exista la lista densa.
* **Estado:** ❓ Sin verificar en esta ronda (2026-10-21). Workaround en Ego: no aplica (aún no hay índice vectorial denso).
* **Estado verificado (2026-10-21):** ❓ sin verificar — Petición de mejora al motor: fuera del alcance de esta ronda

---

### `VDB-INC-02`: Exclusión Mutua de Proceso en Fjall LSM frente a Subprocesos / Sidecars ###

* **Componente:** `packages/knowledge/src/ingest/PythonSidecarBridge.ts:40` (evidencia en Ego) — motor de almacenamiento Fjall (`Embedded::open_with_config` / `flock`)
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
* **Impacto en Ego:** el sidecar Python **no puede abrir el store**: `packages/knowledge/src/ingest/PythonSidecarBridge.ts:40` lo usa como worker que emite JSONL por `stdio` y nunca toca VantaDB;
  el proceso main (único con el lock) ejecuta la inserción. Es un desacople de arquitectura forzado por el motor.
* **Estado:** ❓ Sin verificar en esta ronda (2026-10-21). Workaround en Ego: sidecar desacoplado del almacenamiento (JSONL por `stdio`).
* **Estado verificado (2026-10-21):** ❓ sin verificar — Exclusión mutua de proceso (`flock`): fuera del alcance de esta ronda

---

### `VDB-BUG-04`: Limitación de Serialización de Metadatos Complejos Anidados en `VantaValue` ###

* **Componente:** `packages/decision/src/DecisionAuditor.ts:16` (evidencia en Ego) — `vantadb-node/src/sdk/types.rs` (`enum VantaValue`) y bindings NAPI-RS
* **Síntoma:** *(verificado 2026-10-21 contra 0.9.0 — PERSISTE)* Al insertar registros con metadatos estructurados complejos (ej. listas de objetos como `preconditions:
  [{ name: "workspace", satisfied: true }]` en `gov/audit` o `heading_path: ["Capítulo 1", "Sección A"]`
  en `kb/docs`), la llamada a `db.put()` falla con error de deserialización en Rust:

  ```
  VantaError: put: invalid metadata: expected primitive or string value
  ```

  En 0.9.0 el mensaje es más explícito y nombra la unión:

  ```text
  unknown variant `b`, expected one of `String`, `Int`, `Float`, `Bool`, `DateTime`, `ListString`, `List…`
  ```

  `VantaValue` sigue siendo una unión **plana**: no hay variante `Map`/`Object` recursiva, así que hay que aplanar la metadata anidada a cadena JSON.
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
* **Impacto en Ego:** `packages/decision/src/DecisionAuditor.ts:16` serializa la metadata a cadena JSON antes de escribirla y el consumidor necesita un `JSON.parse` defensivo: una `metadata` con
  7 niveles anidados es un **error de deserialización en Rust**, no una degradación. Afecta a KB, hechos, checkpoints y trazas.
* **Estado:** ❌ **Persiste en 0.9.0** (verificado 2026-10-21: *«unknown variant `b`, expected one of `String`, `Int`, `Float`, `Bool`, `DateTime`, `ListString`, `List…`»*). Workaround en Ego:
  aplanado a `JSON.stringify` en el punto de escritura.
* **Estado verificado (2026-10-21):** ❌ PERSISTE — `put` con metadata anidada de 7 niveles → *«unknown variant `b`, expected one of `String`, `Int`, `Float`, `Bool`, `DateTime`, `ListString`,
  `List…`»*: `VantaValue` es una unión **plana**, sin variante Map/Object recursiva

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
* **Impacto en Ego:** `packages/memory/EgoMemoryAdapter.ts:697` **rechaza en runtime** todo barrido sin término léxico (devuelve `[]` y loguea) en vez de dejar que el motor lo resuelva; el
  barrido real obliga a usar `list()`/`listPaged()`. Con 0.9.0 el rechazo es innecesario.
* **Estado:** ✅ **Resuelto en `vantadb-node@0.9.0`** (verificado 2026-10-21: `search({text_query:""})` → 0 hits sin excepción). Workaround en Ego: el guard de `EgoMemoryAdapter.ts:697` —
  retirable.
* **Estado verificado (2026-10-21):** ✅ RESUELTO — `search({text_query:""})` → 0 hits sin excepción: ya no «text_query must not be empty»

---

### `VDB-INC-03`: Invalidación de Descriptores de Instancia tras `db.close()` en el Mismo Proceso ###

* **Componente:** `packages/knowledge/src/HybridSearch.ts:61` (evidencia en Ego) — ciclo de vida de `NativeVantaDB` en NAPI-RS, re-inyección del adaptador mnemónico
* **Síntoma:** *(histórico, 0.8.0)* Si se cierra el adaptador de base de datos (`adapter.close()` / `db.close()`) y se crea una nueva
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
* **Estado verificado (2026-10-21):** ✅ RESUELTO — `get()` tras `close()` **lanza** «database is closing»: el descriptor ya no queda invalidable en silencio

---

### `VDB-REQ-06`: Soporte Nativo de Consultas Bitemporales (`AS OF <timestamp>`) ###

* **Componente:** `packages/knowledge/src/BitemporalQueries.ts:39` (evidencia en Ego) — motor de almacenamiento y consulta en `vanta-core`
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
* **Impacto en Ego:** `packages/knowledge/src/BitemporalQueries.ts:39` reconstruye el estado histórico **enteramente en espacio de usuario**, recorriendo aristas `SUPERSEDED_BY` e interpretando
  metadatos temporales a mano: `KB-09` es código propio donde el motor podría dar la respuesta.
* **Estado:** ❓ Sin verificar en esta ronda (2026-10-21). Workaround en Ego: emulación bitemporal en `packages/knowledge/src/BitemporalQueries.ts`.
* **Estado verificado (2026-10-21):** ❓ sin verificar — Petición de mejora al motor: fuera del alcance de esta ronda

---

### `VDB-REQ-07`: Poda y Límite de Grado en Expansión de Grafos (`graphragSearch`) ###

* **Componente:** `packages/knowledge/src/GraphRagEngine.ts:54` (evidencia en Ego) — `src/sdk/api/graphrag.rs` (`DIST-15`)
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

* **Impacto en Ego:** `packages/knowledge/src/GraphRagEngine.ts:54` acota los saltos y filtra candidatos **antes** de delegar la expansión, porque el motor no expone `max_degree_per_node`: un
  nodo-hub puede provocar un abanico combinatorio de lecturas.
* **Estado:** ❓ Sin verificar en esta ronda (2026-10-21). Workaround en Ego: acotado defensivo de saltos y candidatos en `GraphRagEngine.ts`.
* **Estado verificado (2026-10-21):** ❓ sin verificar — Petición de mejora al motor: fuera del alcance de esta ronda

---

### `VDB-REQ-08`: Cifrado en reposo (FIND-249) ###

* **Componente:** `packages/memory/EgoMemoryAdapter.ts:806` (evidencia en Ego) — motor Fjall LSM / capa de almacenamiento
* **Petición:** Cifrado at-rest: namespaces cifrados con key del SO o motor con soporte de clave (equivalente a lo que
  Ego hace en memoria con `safeStorage`).
* **Situación Actual:** VantaDB 0.8.0 persiste todo en claro en disco. La cuarentena por defecto de Ego (SEC-09)
  redirige namespaces sensibles a `quarantine/pending`, pero el contenido sigue legible a nivel
  filesystem.
* **Impacto en Ego:** SEC-09 es stopgap: sin cifrado del motor, "cuarentena" no es confidencialidad. La relajación de
  SEC-09 está bloqueada hasta el cierre de FIND-249.
* **Solución recomendada en VantaDB:** Cifrado por namespace con clave externa (Keychain/DPAPI) o flag de cifrado a
  nivel `connect()`, con rotación documentada.
* **Impacto en Ego:** `packages/memory/EgoMemoryAdapter.ts:806` enruta a `quarantine/pending` lo que no está revisado: es **control de acceso, no confidencialidad** — el contenido sigue legible
  en disco. Por eso SEC-09 es un stopgap y su relajación está bloqueada.
* **Estado:** ❓ Sin verificar en esta ronda (2026-10-21). Workaround en Ego: cuarentena de namespaces sensibles (`EgoMemoryAdapter.ts:806`).
* **Estado verificado (2026-10-21):** ❓ sin verificar — Petición de mejora al motor: fuera del alcance de esta ronda

---

### `VDB-REQ-09`: Publicar `vantadb-node` versionado en registry ###

* **Componente:** `apps/desktop/package.json:38` (evidencia en Ego) — packaging / distribución del binding NAPI-RS
* **Petición:** Publicar `vantadb-node` con versiones semánticas en el registry de npm.
  > **Verificado 2026-10-21 — RESUELTO:** `vantadb-node@0.9.0` **está publicado** (Apache-2.0; `win32`/`darwin`/`linux`; `x64`+`arm64`; con firmas y `sha512`). Históricamente (2026-10-12/13) `npm
  view vantadb-node` devolvía 404.
* **Situación Actual:** *(2026-10-21)* el consumo por `file:../../../VantaDB/vantadb-node` (checkout hermano frágil)
  **sigue en los dos manifiestos** (`apps/desktop/package.json:38`, `packages/memory/package.json:27`) y CI
  sigue compilando un stub ficticio: la publicación existe, pero **Ego todavía no la consume**.
  Ese es el contenido de `EGO-FIND-64` / `DIST-09`, que el cambio de manifiesto (A7) cierra.
* **Impacto en Ego:** Bloquea H05/M05/H23/H24 y DIST-09 (pin VantaDB). Cada máquina necesita el checkout hermano en la
  ruta exacta.
* **Solución recomendada en VantaDB:** Publicar el binding (o documentar el canal oficial de distribución: scope, tag
  o artefacto) y declarar su ABI/compatibilidad N-API por versión de
  Electron/Node.
* **Impacto en Ego:** `apps/desktop/package.json:38` y `packages/memory/package.json:27` dependían de `file:../../../VantaDB/vantadb-node`: cada máquina necesitaba el checkout hermano en la ruta
  exacta y CI compilaba un stub no-op. Con 0.9.0 publicado, esa dependencia puede pasar a **versión semántica** y la instalación se vuelve reproducible.
* **Estado:** ✅ **Resuelto: `vantadb-node@0.9.0` publicado en npm** (verificado 2026-10-21). Desbloquea `EGO-FIND-64` y `DIST-09`; el cambio de manifiesto lo aplica A7.
* **Estado verificado (2026-10-21):** ✅ RESUELTO — **`vantadb-node@0.9.0` está publicado en npm** (Apache-2.0; win32/darwin/linux; x64+arm64; con firmas y `sha512`) → desbloquea `EGO-FIND-64` y
  `DIST-09`

---

### `VDB-INC-04`: Borrado físico no garantizado (tombstones legibles) ###

* **Componente:** `packages/security/src/CryptoErasure.ts:1` (evidencia en Ego) — Fjall LSM / `delete` + `vanta-vector` / HNSW, borrado lógico frente a purga física
* **Síntoma:** *(histórico, 0.8.0)* Tras `delete`, los datos dejaban de listarse pero permanecían recuperables a nivel disco hasta
  compactación/vacuum (que no existe: ver `VDB-REQ-05`).
* **Situación Actual:** El borrado es lógico (tombstone). La purga criptográfica de Ego (SEC-07) solo puede garantizar
  borrado a nivel API (sobrescritura + rotación de claves + verificación de lectura), no físico.
* **Impacto en Ego:** `CryptoErasure` documenta `physicalErasure: api-level-only` como límite honesto. Sin vacuum con
  purga, "borrar" no borra.
* **Solución recomendada en VantaDB:** Vacuum con purga física de tombstones (conectar con `VDB-REQ-05`) o API de
  borrado seguro que reescriba los segmentos afectados.
* **Estado:** Abierto (upstream). Workaround en Ego: `CryptoErasure` declara `physicalErasure: api-level-only`
  (borrado a nivel API + rotación de claves + verificación de lectura).
* **Estado verificado (2026-10-21):** ✅ RESUELTO — `delete` → `get`=null **Y** `search`=0 hits: las tombstones **ya no son legibles**

---

### `VDB-BUG-06`: `dist/native.js` resuelve `vantadb-node` como devDependency ###

* **Componente:** `apps/desktop/package.json:38` (evidencia en Ego) — `vantadb/dist/native.js`, import dinámico del binding en el entry productivo
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
* **Estado verificado (2026-10-21):** ❓ sin verificar — `vantadb/dist/native.js` resuelve `vantadb-node` como devDependency: fuera del alcance de esta ronda

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
* **Estado verificado (2026-10-21):** ❌ PERSISTE — Sin método `embed`; `capabilities().vector_search=true` pero el fast path sigue siendo **BM25 léxico**

---

### `VDB-REQ-11`: Motor IQL y grafo nativo no expuestos por el binding ###

* **Componente:** `packages/memory/EgoMemoryAdapter.ts:1208` (evidencia en Ego) — motor de grafo e IQL de `vantadb-node`
* **Petición:** Exponer en el binding NAPI-RS el motor IQL (método `query`) y/o ampliar `graphragSearch` para aceptar
  varios namespaces de semilla, de modo que el descubrimiento de vecinos del grafo se pueda consultar de
  forma nativa y no inferirse heurísticamente desde el contenido.
* **Situación Actual:** *(verificado 2026-10-21 contra 0.9.0 — PARCIAL)* la superficie pública del binding de Node **sigue sin** ningún método `query` (IQL):
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
* **Estado verificado (2026-10-21):** 🟡 PARCIAL — `query` (IQL) **ausente en el binding de Node**, PERO `capabilities().iql_queries=true`, hay **6 algoritmos de grafo** (`graphBfs`, `graphDfs`,
  `graphFilteredTraversal`, `graphTopologicalSort`, `graphDegree`, `graphIsDag`) y el paquete TS (`vantadb-ts`) **sí** expone `system.query(query)` → vía disponible o petición al binding

---

### `VDB-REQ-12`: Sustrato de grafo (`insertNode`/`addEdge`) sin sembrar por parte de Ego ###

* **Componente:** `packages/memory/EgoMemoryAdapter.ts:1099` (evidencia en Ego) — sustrato de grafo de `vantadb-node` (pipeline `graphragSearch`, DIST-15)
* **Petición:** Derivar automáticamente las aristas del grafo a partir de los registros KV (o exponer una API que lo
  haga), de modo que `graphragSearch` tenga relaciones que recorrer sin que el cliente las siembre una
  por una.
* **Situación Actual:** *(verificado 2026-10-21 contra 0.9.0 — PARCIAL)* el binding **sí expone** `insertNode`, `addEdge` y `getNode`, y el `node_id` de los
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
* **Estado verificado (2026-10-21):** 🟡 PARCIAL — `insertNode` + `addEdge` **aceptados**, pero `graphragSearch` devuelve **0 nodos / 0 aristas**: el sustrato se siembra y la búsqueda **no lo
  traverse**

### `VDB-REQ-13`: El `contextAssemble()` nativo debe preservar el system prompt y los pares tool ###

* **Componente:** `packages/runtime/src/ContextCompaction.ts:1` (evidencia en Ego) — context engine y compactación de historial de `vantadb-node`
* **Petición:** Garantizar en `contextAssemble(options)` que el bloque de sistema (`protected_prefix`) se conserva
  literalmente y que los pares assistant `tool_call` / `tool_result` nunca se separan ni se descartan,
  de modo que un historial compactado siga siendo válido para una API que exige el orden de los
  `tool_result`.
* **Situación Actual:** *(verificado 2026-10-21 contra 0.9.0 — RESUELTO)* `contextAssemble(options)` expone `{ messages, token_budget,
  protected_prefix?, compaction_ratio?, min_keep? }` y la heurística `chars/3`
  (`TokenEstimator::default`; `precise-tokens` opt-in), pero el contrato **no declara** que
  preserve el prefijo protegido ni la integridad de los pares de herramientas: son invariantes
  que Ego sí necesita y que hoy solo garantiza su motor propio (`ContextCompaction.ts`, 742
  líneas, 21 tests).
* **Evidencia en Ego:** `packages/runtime/src/ContextCompaction.ts` (motor canónico: preserva el system prompt y los
  pares tool, resume con LLM inyectable y archiva en `kb/history_archive`),
  `packages/runtime/test/ContextCompaction.test.ts` (15 tests de invariantes),
  `packages/runtime/test/ContextCompaction-unified.test.ts` (6 tests),
  `apps/desktop/src/main/llm/handle-llm-stream.ts:397` (llamada a `compact()`).
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
* **Estado verificado (2026-10-21):** ✅ RESUELTO — `contextAssemble({messages,token_budget:500})` → **system preservado=true** y **pares tool_call/tool_result preservados=true** → la **puerta de
  invariantes del ADR-0020 está VERDE** → E2 (Fase 06) desbloqueado
* **Matiz de alcance (Ola 5, 2026-10-21):** la verificación se hizo **contra el binding directo** (`vantadb-node@0.9.0`, el objeto `VantaDb` nativo), **no** contra la ruta `vantadb/native` que usa el producto. El **binding** expone el método (`vantadb-node@0.9.0/index.d.ts:622`), pero la **fachada** `vantadb@0.9.0` (`dist/native.d.ts:103`) declara una lista fija de métodos **sin passthrough dinámico**, así que el producto **no puede alcanzarlo** por esa vía. Y fuera de `packages/memory` la resolución cae al **global `vantadb@0.6.1`**, que no tiene ni el método ni el binding. ⇒ El requisito de las invariantes **está satisfecho**; lo que falta es el **puente de alcance**, que se registra como **`VDB-REQ-16`**.

### `VDB-REQ-14`: Pre-reserva de 320 MB por store al conectar, no parametrizable

* **Componente:** `packages/memory/EgoMemoryAdapter.ts:291` (evidencia en Ego) — pre-reserva del vector store en `NativeVantaDB.connect()` (segmentos `vstore_L*.vanta` + journal `0.jnl`)
* **Petición:** Permitir dimensionar o desactivar la pre-reserva del índice vectorial al abrir un store, y que `ConnectOptions` exponga los parámetros que la controlan.
* **Situación Actual:** *(verificado 2026-10-21 contra `vantadb-node@0.9.0` — PERSISTE)* al conectar, el motor pre-reserva **4 segmentos `vstore_L*.vanta` de 64 MB** más el journal `0.jnl`.
  Medido con sonda: un store **VACÍO** ocupa **320,06 MB** en disco. `ConnectOptions` **solo expone `read_only` y `memory_limit`**: la pre-reserva **no es parametrizable**.
* **Impacto en Ego:** **320 MB por memoria abierta** en `packages/memory/EgoMemoryAdapter.ts:291` (`NativeVantaDB.connect(this.storagePath, { read_only: false })`): proyecto por defecto,
  sesiones, sub-egos. En la suite completa el **peak** pide **~19 GB simultáneos**, y con el disco al 2,5 % el fallo se manifiesta como `IO error: Disk full` **en un test ajeno** — el síntoma
  aparece en el sitio equivocado. Es la única petición de este registro que afecta al **100 % del estado persistente del producto**.
* **Solución recomendada en VantaDB:** exponer en `ConnectOptions` un parámetro de dimensión de la pre-reserva (o un modo `lazy`/sin índice vectorial para stores sin búsqueda densa), de forma que
  un store que no usa búsqueda densa no pague 320 MB por la posibilidad de usarla.
* **Estado:** ❌ **Persiste en 0.9.0** (verificado 2026-10-21) — **pero cuantificada en Ego (2026-10-21, A2-bis)**: Ego abre **1** store en producción (`ego_memory.vdb`) → **320,03 MB de disco** y **≈ 0,45 MB de RAM** (Δ RSS medido: 0,39 / 0,50 / 0,53 MB). **La pre-reserva es de DISCO, no de RAM**: los segmentos `vstore_L*.vanta` son ficheros pre-asignados. El pico de **~19 GB** es un artefacto de la **suite de tests** (cada fichero abre su store), **no del producto**. Workaround en Ego: **ninguno viable** para el consumo en sí; la mitigación parcial es mantener **un solo** store abierto (lo que ya hace) — cualquier store adicional (proyecto, sub-egos, snapshots) multiplicaría los 320 MB. Es la petición **más urgente** de este registro.
* **Evidencia empírica (2026-10-21):** 4 segmentos `vstore_L*.vanta` de 64 MB + `0.jnl`; store vacío = **320,06 MB**; `ConnectOptions` = { `read_only`, `memory_limit` }.
* **Estado verificado (2026-10-21):** ❌ **PERSISTE** — 4 segmentos `vstore_L*.vanta` de 64 MB + `0.jnl`; store vacío = **320,03–320,06 MB**; `ConnectOptions` = { `read_only`, `memory_limit` }. **Cuantificado en Ego**: 1 store en producción = 320,03 MB de **disco** + ≈ 0,45 MB de **RAM**; `connect()` cuesta 348–379 ms. Ver `docs/adr/0023-path-cognitivo-nativo.md` §"Deuda cuantificada".
* **Corroboración cruzada (A3, T-X1 — 2026-10-20):** A3 llegó al mismo hallazgo **desde el lado de los tests**, investigando la fuga de 320 MB por corrida: *"el store de 320 MB NO es un residuo
  evitable de mis datos: es la PREASIGNACIÓN del motor VantaDB. Un store son 64 MB de journal (`0.jnl`) + 4 segmentos `vstore_L*.vanta`"*. Midió **1 044 MB** retenidos por corrida (3 × 320 MB + 3
  × 64 MB) con un delta de disco libre de **−1 044 MB**. Dos equipos, dos caminos, el mismo número.

---

### `VDB-REQ-15`: Re-rank compuesto con confianza disponible en `memoryRecall({ trust_aware: true })`

* **Componente:** `packages/memory/EgoMemoryAdapter.ts:1208` (evidencia en Ego) — motor de recall de `vanta-memory` (S8 / FIND-320 / MEMG-21)
* **Petición:** Exponer en la superficie de Node el re-rank compuesto con confianza que el motor ya calcula, para que el cliente pueda puntuar y reordenar los recuerdos con la confianza de
  origen.
* **Situación Actual:** *(verificado 2026-10-21 contra `vantadb-node@0.9.0` — PARCIAL)* `memoryRecall({ trust_aware: true })` **ofrece** re-rank compuesto con confianza. Lo que falta no es la
  capacidad del motor, sino el **cableado** en Ego: la ruta de recall de `packages/memory/EgoMemoryAdapter.ts:1208` no la consume.
* **Impacto en Ego:** Ego ya tiene la pieza que falta — el `TrustBoundary` de taint (`docs/adr/0019-canal-dual-taint-tracking.md`) marca el contenido externo como `trust: "untrusted"` — pero **no
  lo combina con la confianza del recall**: la puntuación de un recuerdo heute es léxica, no ponderada por procedencia. Con esta capacidad, el mismo `trust_aware` podría reordenar los recuerdos
  de forma que el contenido no confiable no suba por repetición de término.
* **Solución recomendada en VantaDB:** documentar la forma exacta del objeto de confianza que devuelve `memoryRecall({ trust_aware: true })` (campos, escala, semántica de la puntuación compuesta)
  y exponerla en el binding de Node con tests de contrato, de forma que el cliente no tenga que inferirla.
* **Estado:** ✅ **Cableado en Ego (2026-10-21, A2-bis, T2)**. El cableado existe: `EgoMemoryAdapter.memoryRecall` + `packages/memory/CognitivePath.ts` + `TrustBoundary.trustedAllowPrefixes` / `selectTrustedForInjection`. **Pendiente:** el *call site* que arma el contexto cognitivo (E2, Fase 06). Ya **no** es una carencia del motor: era una tarea de integración de Ego, y está hecha.
* **Evidencia empírica (2026-10-21):** `memoryRecall({ trust_aware: true })` → re-rank compuesto con confianza disponible (S8/FIND-320, MEMG-21) · **cableado y verificado contra el motor real** en `packages/memory/test/memory-recall-trust.test.ts` (5 tests).
* **Estado verificado (2026-10-21):** ✅ **CABLEADO** — la capacidad existe en el motor **y** está cableada en Ego, verificada contra el motor real (no contra un mock): `packages/memory/test/memory-recall-trust.test.ts` (5 tests). Lo que queda es el *call site* del contexto cognitivo (E2).

### `VDB-REQ-16`: `vantadb` se resuelve fuera del repo y el wrapper no expone las APIs cognitivas

* **Componente:** `packages/memory/EgoMemoryAdapter.ts:291` (evidencia en Ego) — cadena de resolución del paquete `vantadb` (`vantadb/native` → `dist/native.js` → `await import("vantadb-node")`)
* **Petición:** (a) que el wrapper `vantadb` **re-exponga** los métodos cognitivos que el binding trae (`contextAssemble`, `memoryRecall`, `memoryConsolidate`, `memoryReinforce`); (b) que `vantadb` se declare **de forma explícita y versionada** en el workspace, de modo que la resolución nunca dependa de un `node_modules` global; y (c) que **`vantadb` declare `vantadb-node` como dependencia propia y no opcional**, para que una instalación transitiva no pueda caer a un global incompatible.
* **Situación Actual (verificado 2026-10-21 contra el árbol instalado — PERSISTE):** hay **tres capas**, y el fallo está en las dos últimas.
  * **El binding `vantadb-node@0.9.0` SÍ expone las APIs**: `index.d.ts:622 contextAssemble(options)`, `:614 memoryRecall(options)`, `:629 memoryConsolidate(options)`, `:636 memoryReinforce(hit, outcome)`.
  * **El wrapper `vantadb@0.9.0` NO las expone**: su fachada `NativeVantaDB` (`dist/native.d.ts:103`) declara una **lista fija** de métodos (`connect`, `put`, `get`, `list`, `search`, `graphragSearch`, `insertNode`, `addEdge`, …) y **no tiene `Proxy` ni passthrough dinámico** (`dist/native.js:157` → `return new NativeVantaDB(inner)`). El método del binding queda **al otro lado de la fachada**.
  * **La resolución depende del directorio**: `packages/memory` → `node_modules/.pnpm/vantadb@0.9.0` ✅; `apps/desktop` y `tests` **no resuelven** ese paquete y caen al **global `C:\Users\Eros\node_modules\vantadb@0.6.1`**, que no tiene ninguna de las APIs cognitivas **ni `vantadb-node`** (importarlo daría `VANTADB_NOT_FOUND: Node not found: 7`).
* **Matiz del estado de la instalación (Ola 5, medido el 2026-07-21):** los **manifiestos ya están corregidos** — `packages/memory/package.json`, `apps/desktop/package.json:38` y `tests/package.json:20` declaran `"vantadb": "0.9.0"` (A7). Lo que **no** está materializado es el **enlace**: `packages/memory/node_modules/vantadb` **existe** (11 entradas en su `node_modules`), mientras que `apps/desktop/node_modules/vantadb` y `tests/node_modules/vantadb` **no existen** (305 y 7 entradas respectivamente), pese a la declaración. La causa es que **la instalación del árbol está incompleta** (`node_modules/.bin` no existe en la raíz y el paquete `vitepress` ha desaparecido del store). Es decir: **la parte (b) de esta petición (declaración explícita) ya está hecha**; lo que falta es que el *install* la materialice, y **sigue en pie la parte (a)** —que el wrapper re-exponga los métodos cognitivos—, que es la única que **no** depende de Ego.
* **Impacto en Ego:** el producto **no puede llamar** a `contextAssemble()` (ni a `memoryRecall`, `memoryConsolidate`, `memoryReinforce`) por la ruta que usa (`vantadb/native`), aunque el motor las soporte y la invariante del [ADR-0020](adr/0020-compactacion-motor-ts-vs-nativo.md) **esté verde**. Consecuencia práctica: **E2 (Fase 06) no arranca por alcance, no por calidad del motor**, y cualquier test que importe `vantadb` desde `apps/desktop` o `tests` **está probando el global 0.6.1, no el motor del producto** — un `test` verde sobre el paquete equivocado.
* **Solución recomendada en VantaDB:** (a) re-exponer en el wrapper `vantadb` los métodos cognitivos del binding (misma firma, misma semántica), de forma que `vantadb/native` sea un espejo completo de `vantadb-node`; (b) que el paquete `vantadb` declare `vantadb-node` como dependencia **no opcional**; y (c) que el paquete declare su **versión mínima de Node**, para que una instalación transitiva no pueda caer a un global incompatible.
* **Estado:** 🟡 **Parcial** (verificado 2026-07-21). **(b) RESUELTA (A7, medido
  2026-07-21)**: `packages/memory`, `apps/desktop` y `tests` resuelven **los tres**
  `vantadb@0.9.0` (el enlace local materializado; el global `0.6.1` sigue existiendo en
  `C:\Users\Eros\node_modules\vantadb` pero ya no es la ruta de resolución).
  **(a) PERSISTE**: el wrapper `vantadb@0.9.0` no re-expone las APIs cognitivas — y esa
  es la parte que **no** depende de Ego. **Workaround en Ego (nuevo, 2026-07-21,
  A2-bis)**: puente de alcance **HybridRuntime** en `packages/memory/CognitivePath.ts`
  (`resolveCognitiveBinding`: prefiere la API pública de la fachada y, si no está, usa el
  handle nativo `inner` que la fachada ya tiene abierto) — *fail-soft*, encapsulado en una
  función, destino: la re-exposición upstream. Justificación y medición:
  `docs/adr/0023-path-cognitivo-nativo.md`.
* **Estado verificado (2026-07-21):** 🟡 **PARCIAL** — 3 capas medidas: el binding tiene las 4 APIs (`index.d.ts:614,622,629,636`) · la fachada no las expone (`dist/native.d.ts:103`, lista fija sin passthrough) · y **la resolución es ya uniforme** (los tres paquetes resuelven `vantadb@0.9.0`; el global `0.6.1` ya no es la ruta de resolución). **Lo que resuelve el alcance es el puente HybridRuntime** (vía (iii) del ADR-0023): `db.inner` es alcanzable en runtime y es un `VantaDb` ⇒ **no hace falta un fix upstream para el path cognitivo**.
* **Mitigación aplicada (A7, 2026-07-21) y puerta de regresión:** la **raíz** del workspace declara `"vantadb": "0.9.0"` y `"vantadb-node": "0.9.0"` (`package.json:70-71`) → por **resolución ascendente** los 20 miembros del workspace resuelven la versión **del repo**, no el `node_modules` global del usuario. Y hay **puerta bloqueante en CI**: `scripts/verify-vantadb-resolution.mjs` (`vantadb:check`, también dentro de `verify:all`) verifica la resolución desde **todos** los miembros del workspace. **Por qué no es un detalle menor:** sin esa puerta, un agente puede volver a concluir —con una medición aparentemente válida— que el motor no tiene una API. Ya pasó (ver `docs/adr/0020-compactacion-motor-ts-vs-nativo.md` §2.1).
