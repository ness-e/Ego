---
id: CORE-15
title: "Suite de contrato EgoMemoryAdapter ↔ NativeVantaDB (Pinned Contract Suite)"
status: completed
phase: "Fase 01: Core Cognitivo"
priority: P0
component: "@ego/memory"
assignee: "Ego Nucleus Engine"
dependencies: ["CORE-06", "CORE-07", "CORE-09"]
origin: "VantaDB MEMG-24 + DIST-19"
tags: [memory, vantadb, napi-rs, contract-testing, fjall, lsm]
---

# TASK CORE-15: Suite de contrato EgoMemoryAdapter ↔ NativeVantaDB

## 1. Contexto y Justificación
`EgoMemoryAdapter` es el gateway único e innegociable a través del cual todo el Cognitive Runtime de Ego accede a la persistencia local de VantaDB. El adaptador se comunica in-process con `NativeVantaDB` (`vantadb/native`), el binding binario NAPI-RS compilado sobre el motor Rust (Fjall LSM + HNSW + BM25).

Cualquier cambio de firma o comportamiento en el binding NAPI-RS de VantaDB (tipos de escalares en metadatos, forma de argumentos en `connect`, `get`, `delete`, estructura del cursor de paginación o retornos de `search`) puede romper silenciosamente la persistencia de Ego en tiempo de ejecución. 

Esta tarea constituye la contrapartida del lado de Ego de la tarea `MEMG-24` de VantaDB: una suite de pruebas de contrato estricta que pinea y valida todas las firmas y comportamientos esperados por Ego. Si el binding binario se actualiza sin retrocompatibilidad, esta suite fallará de inmediato en CI.

---

## 2. Blast Radius e Impacto
- **Archivos creados/modificados:**
  - `packages/memory/test/contract-vantadb.test.ts` (Nueva suite de contrato exhaustiva con 13 casos)
  - `docs/roadmap/Backlog.md` (Actualización de estado a completada, 15/15 tareas)
  - `docs/roadmap/roadmap.md` (Cierre oficial de la Fase 01 al 100%)
- **Componentes aguas abajo (Downstream):**
  - `EgoMemoryLifecycle` (Prefetch pre-turn y sync post-turn)
  - `CognitiveRuntime` / `ChatStreamHandler` (Ensamblado de contexto y turnos)
  - `SubEgoRuntime` / `PermissionsGuard` (Namespaces aislados `egos/<id>/*`)
- **Componentes aguas arriba (Upstream):**
  - `NativeVantaDB` de `"vantadb/native"` (`vantadb-node` binario `.node`)

---

## 3. Contrato Técnico Pinned

La suite valida las siguientes invariantes innegociables:

1. **Ciclo de Conexión y Factory:**
   - `NativeVantaDB.connect(path, options)` abre una base de datos física real (Fjall LSM) y rechaza paths vacíos en `EgoMemoryAdapter`.
   - `close()` drena operaciones en vuelo y garantiza estado no operativo posterior.
   - `flush()` persiste el WAL a disco de manera asíncrona.

2. **Firmas de Escritura y Lectura (`put`, `putMulti`, `get`, `delete`):**
   - Normalización de metadatos tipados: `{ Float: number }`, `{ String: string }`, `{ Bool: boolean }`, `{ Null: null }`, `ListString`, etc., y metadatos flat.
   - Inyección automática de metadatos de auditoría: `org_id`, `ts`, `agent_id`, `confidence`, `state`.
   - `get({ namespace, key })` devuelve el registro decodificado (`payload` string o JSON parseado).
   - `delete({ namespace, key })` remueve el registro físicamente y devuelve confirmación booleana.

3. **Paginación por Cursor y Listado de Namespaces:**
   - `listNamespaces()` devuelve la lista de namespaces activos.
   - `list({ namespace, limit, cursor })` pagina deterministamente registros y emite `next_cursor` consumible en llamadas sucesivas.

4. **Búsqueda Federada y Expansión de Comodines (`searchMulti`):**
   - Resolución de comodines (`kb/*`, `projects/*`) contra namespaces existentes vía `listNamespaces()`.
   - Búsqueda federada paralela con ordenamiento unificado por score.
   - Filtro de supersesión (`exclude_superseded: true`).

5. **Operaciones Especializadas de Ego:**
   - Cuarentena (`quarantine`) con TTL controlado y metadatos de aislamiento.
   - Promoción (`promote`) de cuarentena hacia namespace destino con log de auditoría en `gov/audit`.
   - Supersesión histórica (`supersedeFact`, ADR-028 soft-replace) marcando `is_latest: false` en el registro previo y enlazando causalmente.
   - Volcado canónico (`exportDump` e `importDump`) con cabecera `VDBJSON\n`, JSONL y SHA-256.

---

## 4. Pasos de Ejecución
- [x] Paso 1: Analizar firmas expuestas en `vantadb/native` y `vantadb/types`.
- [x] Paso 2: Implementar la suite `packages/memory/test/contract-vantadb.test.ts` con todos los casos de contrato.
- [x] Paso 3: Ejecutar suite con Vitest (`npx vitest run packages/memory/test/contract-vantadb.test.ts`). Resultado: 13/13 pasados en verde (100%).
- [x] Paso 4: Ejecutar verificación de monorepo (`pnpm test` [77/77 tests pasando], `pnpm typecheck` [0 errores], `pnpm build` [éxito]).
- [x] Paso 5: Sincronizar Backlog y Roadmap marcando la tarea como completada y cerrando la Fase 01 al 100%.
- [x] Paso 6: Generar commit semántico en Git.
