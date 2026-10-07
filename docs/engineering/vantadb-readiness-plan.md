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
│  • Cognitive Path: vantadb-mcp (subprocess stdio, 88 tools)            │
│  • Búsqueda híbrida: BM25 + HNSW + RRF federado                        │
│  • Embeddings: Auto-embed interno (ONNX multilingual-e5-small)         │
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

---

## 5. Criterio de No-Bloqueo para Ego

1. **Ego arranca de inmediato:** La Fase 01 de Ego tiene todo lo necesario para operar con la versión actual de VantaDB.
2. **Evolución paralela:** Las tareas `COGN-01`, `CONTRACT-01` y `ASYNC-01` pertenecen a la campaña de VantaDB para P1 y no impiden la construcción de los flujos de chat, herramientas locales ni diseño de Canvas en Ego.
