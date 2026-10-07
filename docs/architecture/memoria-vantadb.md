# Memoria VantaDB — fuente vigente

| Campo | Valor |
| --- | --- |
| Estado | Implementado en P0 — fuente vigente de motor + API + adapter |
| Owner | ness-e |
| Fecha | 2026-10-05 |
| Fuente histórica | `../prd/08-7-vantadb-columna-vertebral-de-memoria.md` + auditoría opción C |
| VantaDB verificado | 0.8.0 base dev (02-oct-2026); `EgoMemoryAdapter.ts` conectado y compilado |
| Regla | Este archivo se edita; `../prd/08*` queda congelado como referencia histórica |

## Qué es (foto 0.8.0, no contrato final)

Rust embebido local-first Apache 2.0. Un producto cuatro superficies: Engine (WAL + híbrida + `vanta-memory` L0→L3), Agent door (`vantadb-mcp` 87 tools), Studio Tauri viewer congelado, Lab congelado. En desktop Electron el motor corre en main con datos en carpeta de usuario (`join(app.getPath("userData"), "ego_memory.vdb")`).

## Implementación de `EgoMemoryAdapter`

El adaptador ubicado en `packages/memory/EgoMemoryAdapter.ts` es el único punto de entrada a VantaDB y proporciona:

1. **`putMulti(items: EgoPut[])`:** Normalización estricta de metadatos (`org_id`, `ts`, `agent_id`, `confidence`, `state`). Serialización JSON automática para payloads no string.
2. **`searchMulti(namespaces, query, options)`:** Búsqueda híbrida en paralelo a través de los namespaces permitidos con fusión y ordenamiento descendente por puntuación RRF.
3. **`recall(keyOrQuery, namespace)`:** Consulta directa O(1) con degradación transparente a búsqueda BM25 cuando no es una clave exacta.
4. **`quarantine(item, reason)`:** Almacenamiento seguro en `quarantine/pending` con TTL de 14 días.
5. **`promote(quarantineKey, targetNamespace)`:** Transición atómica de hechos aprobados y registro inmutable en `gov/audit`.
6. **`supersedeFact(oldKey, newItem)`:** Ejecución nativa de `db.memory.supersede()` con trazabilidad causal de versiones.
7. **`registerSubEgo(manifest)` y `listSubEgos()`:** Gestión de identidades dinámicas en `gov/sub_egos`.

## Garantías y tabla de uso

Persistencia Fjall WAL CRC32C auto-repair; híbrida BM25+HNSW; TTL + `purge_expired()` + `supersede` atómico; grafo IQL BFS/DFS/PageRank; operación `operational_metrics()`. Usos: `put` todo hecho; `memory.get` contexto exacto; `search` recall; `searchMulti` lote; filtros por estado/agente/cliente; TTL cuarentena/seguimientos; `supersede` KB/tickets; IQL trazabilidad.
