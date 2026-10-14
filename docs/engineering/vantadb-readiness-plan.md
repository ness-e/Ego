# Plan de Preparación de VantaDB para Ego (VantaDB Readiness Plan)

| Campo | Valor |
| --- | --- |
| Estado | Canónico — Requisitos formales de Ego hacia VantaDB |
| Owner | ness-e |
| Fecha | 2026-10-07 |
| Referencia cruzada | `docs/architecture/memoria-vantadb.md` + `C:\Users\Eros\VantaDB Proyect\VantaDB\docs\dev\Backlog.md` |

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
│  • Cognitive Path: vantadb-mcp (subprocess stdio, 88 tools — cifra del proyecto hermano VantaDB, no verificable desde Ego; R2 T09)            │
│  • Búsqueda híbrida: BM25 + HNSW + RRF federado                        │
│  • Embeddings: BM25 puro en fast path (VDB-INC-01; denso vía mcp)      │
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

---

## 3. Matriz de Requisitos Formales de Ego hacia VantaDB

| Requisito en Ego | ID en VantaDB | Estado en VantaDB | Prioridad | Impacto en Ego |
|---|---|:---:|:---:|---|
| **GraphRAG nativo en Node** | `DIST-15` | ✅ Implementado (2026-10-04) | P0 | Permite a Ego ejecutar `graphragSearch` nativo desde main process. |
| **Release formal 0.8.0** | `PROC-01` | ⏸️ Bloqueada (OK owner) | P0 | Fija la versión estable inmutable en `package.json` de Ego. |
| **Precompilados multiplataforma** | `DIST-04` | 🆕 En curso | P0 | Asegura que `.node` corra en Windows, macOS y Linux sin compilar Rust en cliente. |
| **Atributo `asarUnpack` validado** | `CI-ELECTRON` | ⚠️ Tarea requerida | P0 | Garantiza que el empaquetador no rompa la carga de los binarios nativos. |
| **Fachada modular `vanta-memory`** | `COGN-01` | ⚠️ Tarea requerida | P1 | Elimina el subproceso MCP interno de P0; unifica todo in-process vía napi-rs. |
| **Context Engine como API** | `COGN-02` | ⚠️ Tarea requerida | P1 | Ego delega la compresión de contexto y poda de tokens a Rust (`assembleContext`). |
| **Task Checkpoints nativos** | `MEMG-20` | 📋 Catalogado en backlog | P1 | Resiliencia de tareas asíncronas de Sub-Egos ante cierres o fallos del sistema. |
| **Grafo ↔ Memoria causal** | `MEMG-03` | 📋 Catalogado en backlog | P1 | Enlaza decisiones, hechos y tareas en una topología causal navegable. |
| **Cancelación vía `AbortSignal`** | `ASYNC-01` | ⚠️ Tarea requerida | P1 | Previene bloqueos del Event Loop en búsquedas largas o indexación pesada. |
| **Tests de contrato cruzado** | `CONTRACT-01`| ⚠️ Tarea requerida | P1 | CI compartido que detecta regresiones de API antes de actualizar dependencias. |
| **Zero-Copy Vector Ingestion** | `BIND-01` (`VDB-REQ-04`) | ⚠️ Tarea requerida | P1 | Vistas de memoria `Float32Array` / `PyBuffer` directas a `&[f32]`, eliminando presión en GC. |
| **Vacuum de Grafos HNSW** | `VEC-01` (`VDB-REQ-05`) | ⚠️ Tarea requerida | P1 | Purga de *tombstones* y recableado de adyacencias tras borrado/actualización de recuerdos. |
| **ANN-Benchmarks Nightly CI** | `CI-ANN-NIGHTLY` | ⚠️ Tarea requerida | P2 | Monitoreo nocturno automatizado de Recall vs QPS para prevenir regresiones en `develop`. |

---

## 4. Tareas Nuevas a Registrar en el Backlog de VantaDB

Para cerrar la brecha entre los proyectos, el backlog técnico de VantaDB (`docs/dev/Backlog.md`) debe incorporar formalmente los siguientes ítems que no se encontraban catalogados:

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
2. **`vantadb-node` sin reemplazo versionado:** el registry npm responde `404` a `vantadb-node@*` (evidencia 2026-10-12), por lo que `file:../../../VantaDB/vantadb-node` se retiene con justificación en `@ego/desktop` y `@ego/memory`. **Requisito upstream:** publicar `vantadb-node` en el registry (o canal versionado equivalente) para cerrar H05/M05/H23/H24 y lograr install 100% reproducible sin path local.

---

## 7. Vigilancia upstream (UP-01 — 2026-10-13, sin código)

Verificación 2026-10-13: `vantadb-node` sigue 404; `vantadb@0.8.0` publicado. Estado: `FIND-249` (cifrado at-rest) abierto → SEC-09 sigue stopgap; `VDB-REQ-04/05/06` abiertos → emulaciones TS vigentes; `VDB-REQ-08/09`, `VDB-INC-04`, `VDB-BUG-06` registrados 2026-10-12 (`4758edd`). Próxima revisión: al planificar DIST-09.
