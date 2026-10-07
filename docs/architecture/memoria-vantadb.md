# Memoria VantaDB — Arquitectura de Integración

| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente vigente de integración VantaDB×Ego |
| Owner | ness-e |
| Fecha | 2026-10-06 |
| VantaDB verificado | 0.8.0 (auditoría de código completa: 4 subagentes, ~500 archivos Rust/TS) |

## Decisión canónica

> **VantaDB es el motor de memoria, conocimiento y recuperación local-first desarrollado como proyecto first-party independiente y utilizado por Ego como su principal substrate de Project Memory.**
>
> **Ego define los contratos de memoria que necesita como Cognitive OS; VantaDB proporciona implementaciones nativas de esos contratos mediante su motor Rust y sus superficies de interoperabilidad.**
>
> **VantaDB NO es "la base de datos de Ego". Es la infraestructura local de memoria, conocimiento y recuperación cognitiva de Ego.**

## Relación entre proyectos

```
Ego = Cognitive Operating System
  (orquestación, Sub-Egos, tools, modelos, UX, governance)

VantaDB = Cognitive Memory/Knowledge Engine
  (persistencia, retrieval, grafos, contexto, consolidación, embeddings)
```

Ego posee las capacidades como contratos. VantaDB implementa la parte de memoria y conocimiento. Ambos proyectos son independientes pero coordinados del mismo ecosistema.

## Arquitectura de integración (P0)

```
Electron Main Process
├── EgoMemoryAdapter (gateway único)
│   │
│   ├── Fast Path: NativeVantaDB (in-process)
│   │    └─ put/get/search/searchMulti/supersede/graph/IQL
│   │    └─ Motor: Fjall LSM + HNSW + BM25 + WAL SHA-256
│   │    └─ Auto-embed: multilingual-e5-small (384d, ONNX)
│   │
│   └── Cognitive Path: MCP Client (stdio)
│        └─ vantadb-mcp (subprocess gestionado)
│             └─ vanta-memory (Rust, L0→L3)
│             └─ recall/context_assemble/dream/scenes/skills
│
├── Cognitive Runtime
├── Model Router
└── Tool Registry
```

### Fast Path (NativeVantaDB)

Operaciones frecuentes ejecutadas in-process sin serialización:

- `put` / `putBatch` — escritura con auto-embed
- `get` / `delete` — recuperación O(1)
- `search` / `searchMulti` — búsqueda híbrida RRF (BM25 + HNSW)
- `supersede` — sustitución atómica (ADR-028)
- `insertNode` / `traverse` / `graphBfs` — operaciones de grafo
- `query` — IQL v4

Características: in-process, async (Tokio pool), baja latencia, persistencia real (Fjall), sin JSON-RPC.

### Cognitive Path (vantadb-mcp)

Operaciones cognitivas avanzadas via subprocess MCP (88 tools):

- `memory_recall` — auto-recall con scopes (session/agent/team)
- `context_assemble` — compresión multinivel determinista bajo presupuesto de tokens
- `dream_consolidate` — fusión de memorias durante inactividad
- `scene_*` — escenas episódicas L2
- `skill_*` — habilidades versionadas con bloqueo optimista
- `code_*` — inteligencia de código (callers/callees/impact)
- `memory_reinforce` — bucle de retroalimentación de confianza

`vanta-memory` está implementado en Rust puro (0 exports a Node.js). El subprocess MCP es la única vía actual.

### Evolución P1: eliminación del subprocess

```
P1: NativeVantaDB expone fachada cognitiva via napi-rs
    → recall/context/dream/reinforce/checkpoint directamente in-process
    → vantadb-mcp queda solo como MCP Server de Ego hacia el exterior
```

## Binding correcto

```ts
// ✅ CORRECTO — persistencia real, async, Fjall LSM
import { NativeVantaDB } from "vantadb/native";
const db = await NativeVantaDB.connect(storagePath, { read_only: false });

// ❌ PROHIBIDO — WASM en memoria, sin persistencia en disco
import { Client } from "vantadb";
```

## Capacidades de VantaDB que Ego consume

| Capacidad Ego | Implementación VantaDB | Disponible en vantadb-node |
|---|---|---|
| Persistent memory | Fjall LSM + WAL | ✅ |
| Hybrid retrieval (RRF) | BM25 + HNSW + MMR | ✅ |
| Graph traversals | BFS/DFS/PageRank/DAG | ✅ |
| GraphRAG | seed→expand→weight→text | ⚠️ Pendiente (DIST-15) |
| Bitemporality | valid_at/invalid_at + AS OF | ✅ |
| Supersession | ADR-028 (soft-replace) | ✅ |
| Quarantine | ADR-046 (datos no verificados) | ✅ |
| Auto-embed | ONNX Runtime + multilingual-e5-small | ✅ |
| Context compression | 3 niveles + spill-to-disk | ❌ Solo via MCP |
| Dream consolidation | Dedup + normalización + promoción | ❌ Solo via MCP |
| Memory recall | Prepend/append + scopes | ❌ Solo via MCP |
| Task checkpoints | MEMG-20 reanudable | ❌ Solo via MCP |
| Reinforcement loop | +0.05 used / -0.10 corrected | ❌ Solo via MCP |
| Temporal resolution | Español nativo → Unix-ms | ❌ Solo via MCP |
| Code intelligence | callers/callees/impact | ❌ Solo via MCP |
| SkillStore | Versionado + bloqueo optimista | ❌ Solo via MCP |

## Mapa de responsabilidades

| Responsabilidad | Ego | VantaDB |
|---|---|---|
| Product intent / Orchestration | **Sí** | No |
| Sub-Egos / Model Router | **Sí** | No |
| Tool Registry / Execution | **Sí** | No |
| Permissions / Governance | **Sí** | Infra parcial |
| Workspace / UX | **Sí** | No |
| External integrations | **Sí** | No |
| Memory Contract (definición) | **Sí** | No |
| Persistent storage | Consume | **Implementa** |
| Hybrid retrieval | Consume | **Implementa** |
| Graph / GraphRAG | Consume | **Implementa** |
| Context compression | Consume | **Implementa** |
| Dream consolidation | Consume | **Implementa** |
| Embeddings (ONNX local) | Consume | **Implementa** |

## Categorización MCP

| Categoría | Uso | Vida útil |
|---|---|---|
| **MCP Interno** | Ego → vantadb-mcp (cognitive bridge) | Solo P0 (eliminado en P1) |
| **MCP Externo** | Ego → GitHub, Notion, Slack | Permanente |
| **MCP Server de Ego** | Cursor/Claude → Ego → Project Memory | Permanente (puede reusar vantadb-mcp) |

## Configuración de empaquetado Electron

```yaml
# electron-builder.yml
asarUnpack:
  - "**/*.node"  # vantadb_native.*.node no puede cargarse desde .asar
```

```ts
// electron.vite.config.ts — no bundlear addons nativos
external: ['vantadb-node', 'vantadb']
```

## EgoMemoryAdapter — API pública

| Método | Descripción | Path |
|---|---|---|
| `init()` | Conexión async a VantaDB | Fast |
| `putMulti(items)` | Escritura en lote con metadatos de auditoría | Fast |
| `searchMulti(namespaces, query, options)` | Búsqueda híbrida federada nativa | Fast |
| `recall(keyOrQuery, namespace)` | Recuperación exacta O(1) + fallback búsqueda | Fast |
| `quarantine(item, reason)` | Aislamiento con TTL 14 días | Fast |
| `promote(quarantineKey)` | Promoción atómica + auditoría | Fast |
| `supersedeFact(oldKey, newItem)` | Sustitución con trazabilidad | Fast |
| `registerSubEgo(manifest)` | Registro de identidad en `gov/sub_egos` | Fast |
| `listSubEgos()` | Listado de Sub-Egos registrados | Fast |
| `flush()` | Sincronización WAL a disco | Fast |
| `close()` | Cierre ordenado con OpGate | Fast |
| `listNamespaces()` | Namespaces activos | Fast |

> **node_id es u128**: Tratar siempre como `string` en JavaScript (supera `Number.MAX_SAFE_INTEGER`).
