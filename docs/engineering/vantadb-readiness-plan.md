# Plan de Preparación de VantaDB para Ego (VantaDB Readiness Plan)

| Campo | Valor |
| --- | --- |
| Estado | Canónico — Requisitos formales de Ego hacia VantaDB |
| Owner | ness-e |
| Fecha | 2026-07-07 · **actualizado 2026-10-21** (verificación empírica contra `vantadb-node@0.9.0`) |
| Versión de VantaDB | **`vantadb-node@0.9.0` — PUBLICADO en npm** (Apache-2.0; `win32`/`darwin`/`linux`; `x64`+`arm64`; con firmas y `sha512`) |
| Referencia cruzada | `docs/architecture/memoria-vantadb.md` + `C:\Users\Eros\VantaDB Proyect\VantaDB\docs\dev\Backlog.md` |
| Registro de hallazgos | [`docs/VANTADB-FEEDBACK-Y-MEJORAS.md`](../VANTADB-FEEDBACK-Y-MEJORAS.md) — 25 hallazgos, verificados contra el binding real el 2026-10-21 |

> **Estado verificado 2026-10-21.** Cada hallazgo del registro se **ejecutó contra el
> binding real `vantadb-node@0.9.0`**, no contra la documentación. Resultado:
> **7 resueltos · 4 parciales · 4 persisten · 10 sin verificar**. La tabla
> completa, con el **mensaje literal** del motor cuando aplica, está en el
> registro. Este plan resume lo que eso significa para la preparación de Ego.

---

## 1. Propósito y Principio Rector

Este documento establece el **contrato de evolución coordinada** entre Ego (el Sistema Operativo Cognitivo) y VantaDB (su sustrato local de memoria y conocimiento). 

> **Regla de Frontera:** Ego define los contratos funcionales de memoria que necesita para operar (`EgoMemory`). VantaDB evoluciona como motor independiente para satisfacer esos contratos mediante código nativo en Rust, sin incorporar lógica de negocio, modelos ni orquestación de agentes.

---

## 2. Estado de Disponibilidad por Fases de Ego

```
┌────────────────────────────────────────────────────────────────────────┐
│ FASE 01–02: CORE COGNITIVO & ACCIÓN (P0)                               │
│  Estado VantaDB: ✅ DISPONIBLE HOY (Arquitectura Híbrida)              │
│  • Fast Path: NativeVantaDB (in-process vía napi-rs, Fjall LSM)       │
│  • Binding: vantadb-node@0.9.0 PUBLICADO en npm (ya consumible)       │
│  • Cognitive Path: vantadb-mcp (subprocess stdio, 88 tools — cifra del proyecto hermano VantaDB, no verificable desde Ego; R2 T09)            │
│  • Búsqueda: BM25 lexico en fast path (sin RRF: es peticion        │
│    upstream, VDB-REQ-10 — VERIFICADO 2026-10-21: PERSISTE, sin      │
│    método `embed`; vector_search=true pero el fast path sigue BM25);  │
│    RRF + HNSW denso via el Cognitive Path                               │
│  • Embeddings: BM25 puro en fast path (VDB-INC-01 — VERIFICADO        │
│    2026-10-21: PERSISTE, capabilities().embedding sin embed-local);   │
│    denso vía mcp                                                       │
│  • Compactación: la invariante del ADR-0020 está VERDE (VDB-REQ-13     │
│    RESUELTO 2026-10-21): contextAssemble() preserva el system prompt  │
│    y los pares tool_call/tool_result → E2 desbloqueado                │
│  • Gobernanza: Cuarentena (ADR-046) y Supersesión (ADR-028)           │
├────────────────────────────────────────────────────────────────────────┤
│ FASE 03–07: SUB-EGOS, WORKSPACE, DECISION & KNOWLEDGE (P1)             │
│  Estado VantaDB: 🔨 EN DESARROLLO (Fachada Cognitiva Unificada)        │
│  • Fachada nativa vanta-memory expuesta directamente en napi-rs       │
│  • Context Engine nativo (assembleContext / token compression)         │
│  • Task Memory y Checkpoints resilientes (MEMG-20)                    │
│  • Integración Grafo ↔ Memoria (MEMG-03)                              │
│  • Consolidación onírica programable (Dream Consolidation)            │
│  • Code Intelligence (code_*) expuesto nativamente                    │
├────────────────────────────────────────────────────────────────────────┤
│ FASE 08–12: DAILY STATE, RECOVERY, DISTRIBUCIÓN (P2)                   │
│  Estado VantaDB: 🔮 ROADMAP FUTURO                                     │
│  • Enfriamiento temporal de aristas del grafo (FUT-17 Edge Decay)     │
│  • WAL como Change Data Capture hacia el Event Bus (FUT-16)            │
│  • Sincronización multi-dispositivo y CRDT (MEMG-05)                   │
│  • Unified Semantic Memory Layer (FUT-25)                              │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Las 3 palancas que abre la verificación del 2026-10-21

1. **`vantadb-node@0.9.0` está publicado en npm.** La instalación deja de depender
   del checkout hermano (`file:../../../VantaDB/vantadb-node`) y CI puede ejercitar
   el binding real en vez de un stub. Cierra `EGO-FIND-64` y `DIST-09` (lo aplica A7
   en los dos manifiestos).
2. **La invariante del ADR-0020 está verde.** `contextAssemble()` preserva el system
   prompt y los pares `tool_call`/`tool_result` ⇒ **E2 (Fase 06) desbloqueado** y el
   motor nativo —*función pura, sin estado de motor, que funciona con la base de
   datos cerrándose*— es candidato a sustituir las 520 líneas de `ContextCompaction`
   TS. El ADR-0020 («híbrido condicionado») ya tiene la condición cumplida.
3. **La pre-reserva de 320 MB por store (`VDB-REQ-14`) es la petición más urgente.**
   No es una mejora de rendimiento: es un **coste fijo por memoria abierta** que
   afecta al 100 % del estado persistente del producto y hace aparecer
   `IO error: Disk full` en un test ajeno cuando el disco se llena.

---

## 3. Matriz de Requisitos Formales de Ego hacia VantaDB

| Requisito en Ego | ID en VantaDB | Estado en VantaDB | Prioridad | Impacto en Ego |
|---|---|:---:|:---:|---|
| **GraphRAG nativo en Node** | `DIST-15` | ✅ Implementado (2026-10-04) | P0 | Permite a Ego ejecutar `graphragSearch` nativo desde main process. |
| **Release formal 0.8.0** | `PROC-01` | ⏸️ Bloqueada (OK owner) | P0 | Fija la versión estable inmutable en `package.json` de Ego. |
| **Precompilados multiplataforma** | `DIST-04` | 🆕 En curso | P0 | Asegura que `.node` corra en Windows, macOS y Linux sin compilar Rust en cliente. |
| **Atributo `asarUnpack` validado** | `CI-ELECTRON` | ⚠️ Tarea requerida | P0 | Garantiza que el empaquetador no rompa la carga de los binarios nativos. |
| **Fachada modular `vanta-memory`** | `COGN-01` | ⚠️ Tarea requerida | P1 | Elimina el subproceso MCP interno de P0; unifica todo in-process vía napi-rs. |
| **Context Engine como API** | `COGN-02` | 🟡 **Invariante VERDE** (2026-10-21) | P1 | `contextAssemble()` preserva el system prompt y los pares tool ⇒ **E2 desbloqueado**. |
| **Binding publicado en npm** | `VDB-REQ-09` | ✅ **Resuelto 2026-10-21** | P0 | Cierra `EGO-FIND-64` y `DIST-09`: la instalación deja de depender del checkout hermano. |
| **Pre-reserva del vector store** | `VDB-REQ-14` | ❌ **Persiste 2026-10-21** | P0 | **320 MB por store abierto**, no parametrizable. Afecta al 100 % del estado persistente. |
| **Canal denso (embeddings) en el fast path** | `VDB-REQ-10` | ❌ **Persiste 2026-10-21** | P1 | Sin método `embed`: el fast path sigue BM25 léxico y la fusión RRF real no se ejecuta. |
| **Embeddings ONNX locales** | `VDB-INC-01` | ❌ **Persiste 2026-10-21** | P1 | `capabilities().embedding` sin `embed-local`; el denso sigue dependiendo del subproceso MCP. |
| **IQL / grafo nativo en el binding** | `VDB-REQ-11` | 🟡 **Parcial 2026-10-21** | P1 | `query` sigue ausente en el binding de Node; hay 6 algoritmos de grafo y `vantadb-ts` expone `system.query(query)`. |
| **Task Checkpoints nativos** | `MEMG-20` | 📋 Catalogado en backlog | P1 | Resiliencia de tareas asíncronas de Sub-Egos ante cierres o fallos del sistema. |
| **Grafo ↔ Memoria causal** | `MEMG-03` | 📋 Catalogado en backlog | P1 | Enlaza decisiones, hechos y tareas en una topología causal navegable. |
| **Cancelación vía `AbortSignal`** | `ASYNC-01` | ⚠️ Tarea requerida | P1 | Previene bloqueos del Event Loop en búsquedas largas o indexación pesada. |
| **Tests de contrato cruzado** | `CONTRACT-01`| ⚠️ Tarea requerida | P1 | CI compartido que detecta regresiones de API antes de actualizar dependencias. |
| **Zero-Copy Vector Ingestion** | `BIND-01` (`VDB-REQ-04`) | ⚠️ Tarea requerida | P1 | Vistas de memoria `Float32Array` / `PyBuffer` directas a `&[f32]`, eliminando presión en GC. |
| **Vacuum de Grafos HNSW** | `VEC-01` (`VDB-REQ-05`) | ⚠️ Tarea requerida | P1 | Purga de *tombstones* y recableado de adyacencias tras borrado/actualización de recuerdos. |
| **ANN-Benchmarks Nightly CI** | `CI-ANN-NIGHTLY` | ⚠️ Tarea requerida | P2 | Monitoreo nocturno automatizado de Recall vs QPS para prevenir regresiones en `develop`. |

---

## 4. Tareas Nuevas a Registrar en el Backlog de VantaDB

Para cerrar la brecha entre los proyectos, el backlog técnico de VantaDB (`docs/roadmap/Backlog.md`) debe incorporar formalmente los siguientes ítems que no se encontraban catalogados:

### Tarea 1: `COGN-01` — Fachada Modular `VantaCognitiveAPI` en `vantadb-node`

* **Ámbito:** `vantadb-node/`, `vanta-memory/`
* **Esfuerzo:** 2-3 semanas
* **Prioridad:** 🟠 P1
* **Descripción:** Exponer una fachada de alto nivel en Node-API (`NativeVantaDB.memory.*`, `NativeVantaDB.context.*`, `NativeVantaDB.tasks.*`) que envuelva las capacidades de `vanta-memory` en Rust (recall con scopes, dream consolidate, reinforce y checkpoints), eliminando el subproceso `vantadb-mcp` del runtime interno de Ego.

### Tarea 2: `CI-ELECTRON` — Pipeline de Validación en Runtime Electron Real
* **Ámbito:** `.github/workflows/`, `vantadb-node/`
* **Esfuerzo:** 1-2 días
* **Prioridad:** 🔴 P0 / P1
* **Descripción:** Configurar un test automatizado en CI que cargue `NativeVantaDB` dentro de un proceso Electron real (headless) en Windows x64, macOS y Linux, validando que el empaquetado `asarUnpack: ["**/*.node"]` y la compatibilidad de ABI funcionen sin segfaults.

### Tarea 3: `CONTRACT-01` — Suite de Verificación de Contratos Ego ↔ VantaDB
* **Ámbito:** `tests/contract/`
* **Esfuerzo:** 2-3 días
* **Prioridad:** 🟠 P1
* **Descripción:** Test suite automatizada que valida que las firmas de `NativeVantaDB` y las herramientas de `vantadb-mcp` satisfacen punto por punto las interfaces de `EgoMemory` definidas en Ego (`packages/memory/EgoMemoryAdapter.ts`), alertando de breaking changes antes de publicar releases.

### Tarea 4: `ASYNC-01` — Soporte de Cancelación (`AbortSignal`) en Llamadas Napi
* **Ámbito:** `vantadb-node/src/`
* **Esfuerzo:** 1-2 días
* **Prioridad:** 🟠 P1
* **Descripción:** Incorporar `AbortSignal` opcional en las operaciones asíncronas pesadas (`search`, `graphragSearch`, `bulk_import`), propagando la señal de cancelación a los canales Tokio en Rust para abortar la computación de inmediato si el usuario cancela la consulta en la interfaz.

### Tarea 5: `BIND-01` (`VDB-REQ-04`) — Ingesta Vectorial Zero-Copy (`Float32Array` / `PyBuffer`)
* **Ámbito:** `vantadb-node/`, `vantadb-py/`
* **Esfuerzo:** 3-5 días
* **Prioridad:** 🟠 P1
* **Descripción:** Implementar binding directo sin copia para vectores y tensores: en Node-API recibir `napi::bindgen_prelude::Float32Array` con acceso directo a `as_slice()` hacia `&[f32]`, y en Python implementar el protocolo de búfer de PyO3 (`PyReadonlyArray1<f32>`). Elimina la sobrecarga de serialización JSON/serde y amortigua picos de memoria en ingesta masiva.

### Tarea 6: `VEC-01` (`VDB-REQ-05`) — Vacuum y Desfragmentación Incremental de Grafos HNSW
* **Ámbito:** `src/index/vector/`, `vanta-vector/`
* **Esfuerzo:** 1-2 semanas
* **Prioridad:** 🟠 P1
* **Descripción:** Diseñar un mecanismo de compactación vectorial en segundo plano (`vacuum_vector_index`) que purgue los nodos eliminados de las listas de adyacencia de HNSW y reestructure los enlaces multicapa. Mitiga la degradación de precisión de búsqueda y fragmentación de memoria tras ciclos intensivos de sobrescritura y olvido de recuerdos episódicos.

### Tarea 7: `CI-ANN-NIGHTLY` — Pipeline Automatizado Nocturno de ANN-Benchmarks
* **Ámbito:** `.github/workflows/`, `benches/`
* **Esfuerzo:** 2-3 días
* **Prioridad:** 🟡 P2
* **Descripción:** Configurar un workflow programado nocturno (nightly) que ejecute benchmarks automatizados contra datasets canónicos de ANN-Benchmarks (ej. GloVe-100, SIFT-128), midiendo curvas de *Recall vs QPS* para detectar regresiones de rendimiento causadas por modificaciones en los heurísticos de poda de grafos en la rama `develop`.


---

## 5. Criterio de No-Bloqueo para Ego

1. **Ego arranca de inmediato:** La Fase 01 de Ego tiene todo lo necesario para operar con la versión actual de VantaDB.
2. **Evolución paralela:** Las tareas `COGN-01`, `CONTRACT-01` y `ASYNC-01` pertenecen a la campaña de VantaDB para P1 y no impiden la construcción de los flujos de chat, herramientas locales ni diseño de Canvas en Ego.

---

## 6. Requisito de dependencias desktop (F5T10 — 2026-10-12)

1. **`vantadb` WASM fuera de `@ego/desktop`:** ningún import directo en `apps/desktop` (verificado por grep 2026-10-12); el desktop accede a memoria solo vía `@ego/memory` → `NativeVantaDB`. Eliminado de `apps/desktop/package.json`.
2. **`vantadb-node` versionado:** ~~el registry npm responde `404` a
   `vantadb-node@*`~~ → **resuelto el 2026-10-21**: `vantadb-node@0.9.0` está
   **publicado en npm** (Apache-2.0; `win32`/`darwin`/`linux`; `x64`+`arm64`;
   con firmas y `sha512`).
   **Pendiente (A7, `EGO-FIND-64`):** los dos manifiestos siguen apuntando a
   `file:../../../VantaDB/vantadb-node` (`apps/desktop/package.json:38`,
   `packages/memory/package.json:27`) y CI sigue compilando un stub no-op. El
   cambio a versión semántica es lo que convierte la publicación en un beneficio
   real: install reproducible sin path local y **CI ejercitando el binding
   real**.

---

## 7. Vigilancia upstream (UP-01 — 2026-10-13, revisado 2026-10-21)

**Verificación 2026-10-21 contra `vantadb-node@0.9.0` (binding real, no documentación):**

| ID | Veredicto | Qué cambió |
|---|---|---|
| `VDB-REQ-09` | ✅ Resuelto | `vantadb-node@0.9.0` publicado en npm. |
| `VDB-REQ-13` | ✅ Resuelto | `contextAssemble()` preserva el system prompt y los pares `tool_call`/`tool_result` ⇒ invariante del ADR-0020 **verde**. |
| `VDB-REQ-02` | ✅ Resuelto | `query_vector: []` documentado como camino sólo-texto ⇒ el workaround de Ego es retirable. |
| `VDB-BUG-01` | ✅ Resuelto | `cursor: undefined` ya no se rechaza. |
| `VDB-BUG-05` | ✅ Resuelto | `text_query: ""` ya no se rechaza (0 hits, sin excepción). |
| `VDB-INC-03` | ✅ Resuelto | `get()` tras `close()` **lanza** «database is closing» (ya no queda invalidable en silencio). |
| `VDB-INC-04` | ✅ Resuelto | Tras `delete`, `get`=null **y** `search`=0 hits: las tombstones ya no son legibles. |
| `VDB-REQ-15` | 🟡 Parcial | `memoryRecall({ trust_aware: true })` ofrece re-rank compuesto con confianza: **disponible, sin cablear**. |
| `VDB-REQ-11` | 🟡 Parcial | `query` (IQL) sigue ausente en el binding de Node; hay 6 algoritmos de grafo y `vantadb-ts` sí expone `system.query(query)`. |
| `VDB-REQ-12` | 🟡 Parcial | `insertNode`/`addEdge` se aceptan, pero `graphragSearch` devuelve 0 nodos / 0 aristas. |
| `VDB-BUG-02` | 🟡 Parcial | Ya no hay pérdida f64 (el envoltorio etiquetado es el contrato), pero Ego sigue necesitando `unwrapMetadata`. |
| `VDB-BUG-04` | ❌ Persiste | `VantaValue` sigue siendo una unión **plana**: sin variante Map/Object recursiva. |
| `VDB-INC-01` | ❌ Persiste | `capabilities().embedding` sin `embed-local`: no hay embeddings locales. |
| `VDB-REQ-10` | ❌ Persiste | Sin método `embed`: el fast path sigue siendo BM25 léxico. |
| `VDB-REQ-14` | ❌ Persiste (**nuevo**) | **320 MB de pre-reserva por store**, no parametrizable. |

**Sin verificar en esta ronda (10):** `VDB-BUG-03`, `VDB-BUG-06`, `VDB-INC-02`, `VDB-REQ-01`, `VDB-REQ-03`, `VDB-REQ-04`, `VDB-REQ-05`, `VDB-REQ-06`, `VDB-REQ-07`, `VDB-REQ-08`.

**Estado del resto:** `FIND-249` (cifrado at-rest, `VDB-REQ-08`) sigue abierto → SEC-09
sigue siendo stopgap; `VDB-REQ-04/05/06` siguen abiertos → las emulaciones TS siguen
vigentes. Próxima revisión: al cerrar `EGO-FIND-64` (cambio de manifiesto a
`vantadb-node@0.9.0`) y al decidir el motor de compactación con el ADR-0020.
