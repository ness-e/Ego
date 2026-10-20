---
kind: review
status: active
description: "Backlog especializado para la revisión, extracción de patrones y adaptación técnica de
  mem0ai/mem0 hacia el monorepo de Ego (capa de memoria conversacional)."
tags: [ego, mem0, extraction, review, memory, extraction-pipeline, deduplication, graph-memory]
schema: "10-column canonical schema (.agents/references/backlog-format.md compatible)"
---

# Mem0 Review & Extraction Backlog — Ego SOC #

> **Propósito:** Registro canónico y secuencial de auditoría, extracción de patrones y adaptación técnica de
> `repos-referencia/mem0` hacia el monorepo de Ego.
> **Regla de Operación:** *No copiar código directamente*. Extraer la lógica de diseño, contratos y patrones
> arquitectónicos, reescribiendo limpiamente en TypeScript estricto, React 19 y Node 22 Main Process,
> apoyándose en VantaDB como sustrato de memoria.
> **Esquema:** Tabla canónica de 10 columnas:
> `| ID | Severidad | Hallazgo | Archivo Mem0 | Esfuerzo | Prioridad | Estado |
> Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |`
> **Ficha de extracción:** [`docs/extractions/mem0.md`](../extractions/mem0.md)

---

## 0. Verificación de estado (2026-10-20) ##

Cada fila fue auditada contra el **código real** del commit
`0724291bd864cf807e88ee8981c8226644e8fb42` (rama `main`, profundidad 1) y contra el **código real de Ego**.
Criterio de `✅ Completada`: existe el fichero adaptado **y** hay un caller en producción (grep sobre
`packages/` + `apps/desktop/`, excluyendo `test/`, `dist/` y `node_modules/`).

| Estado | Significado canónico |
|---|---|
| `✅ Completada` | Asimilado, integrado y con **caller en producción verificado**. La celda cita la ruta real. |
| `🚫 Descartada (con justificación)` | El patrón no se aplica en Ego, fue sustituido por otro módulo canónico, o viola un guardrail. La celda contiene el motivo técnico. |
| `🆕 Pendiente` | Patrón asimilado o pendiente de asimilar, pero **sin caller en producción**. La celda dice el cableado exacto y quién lo ejecuta. |
| `⏳ Futura (fase)` | Diferido a una fase posterior, con fase destino explícita. |

**Nota de alcance (repo nuevo):** `mem0` es una revisión **sin asimilación previa**. Ningún fichero del repo de
referencia se ha copiado a `packages/` ni a `apps/desktop/`; ninguna cabecera `Adapted from mem0ai/mem0` existe
en el monorepo. Las dos filas `✅ Completada` no son portas de mem0: son **capacidades de Ego ya en producción
que cierran la compuerta** (el grafo nativo y el curator de consolidación), verificadas por grep.

### Búsquedas de verificación ejecutadas ###

```text
Select-String "FactExtractor" packages/ apps/
  -> solo packages/knowledge/src/index.ts:8 + tests (SIN caller en apps/)
Select-String "runCuratorConsolidation|startCuratorJob" packages/ apps/
  -> EgoMemoryLifecycle.ts:399,510,517 + apps/desktop/src/main.ts:1966
Select-String "DreamConsolidator" packages/ apps/
  -> packages/tasks/src/MemoryCurator.ts:2 + packages/tasks/src/index.ts:10 (SIN caller)
Select-String "GraphRagEngine|ProjectMemoryGraph" apps/desktop/
  -> main.ts:33,37,201,205,683,699,2208,2212 + register-ipc.ts:1369
Select-String "get_update_memory_messages" mem0/
  -> solo la definicion en mem0/configs/prompts.py:406 (SIN caller)
```

---

## 1. Resumen Ejecutivo de Tareas de Extracción ##

| Grupo de Trabajo | Rango IDs | Tareas | Fases de Ego Impactadas | Prioridad | Beneficio Principal |
|---|---|:---:|---|:---:|---|
| **A. Extracción desde el turno** | `MEM0-01`, `MEM0-04` | 2 | Fase 06 (`KB`), Fase 07 (`TASK`) | Alta | Cierra la brecha crítica: Ego no extrae memoria del chat |
| **B. Arbitraje y anti-alucinación** | `MEM0-02`, `MEM0-03` | 2 | Fase 06 (`KB`), Fase 05 (`DEC`) | Alta | Decide qué se actualiza y impide facts colgantes inventados por el modelo |
| **C. Consolidación y dedup en reposo** | `MEM0-05` | 1 | Fase 07 (`TASK`), Fase 10 (`REC`) | Media | Ya en producción: evita duplicados y contradicciones sin borrado |
| **D. Scope y gobernanza de identidad** | `MEM0-06` | 1 | Fase 01 (`CORE`), Fase 03 (`SUB`), Fase 11 (`SEC`) | Media | Evita un segundo eje de scope paralelo al canónico |
| **E. Grafo de memorias** | `MEM0-07`, `MEM0-08` | 2 | Fase 06 (`KB`), Fase 09 (`DOM`) | Media | Grafo nativo ya en producción; el store externo queda descartado |
| **F. Perfil y preferencias del usuario** | `MEM0-09` | 1 | Fase 08 (`DS`), Fase 06 (`KB`) | Media | Insumo semántico que el prompt de extracción necesita |
| **TOTAL** | `MEM0-01..09` | **9** | **Fases 01, 03, 05, 06, 07, 08, 09, 10, 11** | — | — |

**MATRIZ DE DISTRIBUCIÓN POR FASE** (incidencias fase × tarea; una tarea puede tocar varias fases)

```text
Fase 01 CORE   [MEM0-06......................]  1
Fase 03 SUB    [MEM0-06......................]  1
Fase 05 DEC    [........MEM0-02.MEM0-03......]  2
Fase 06 KB     [MEM0-01.MEM0-02.MEM0-03.MEM0-04.MEM0-09]  5
Fase 07 TASK   [MEM0-01.MEM0-04.MEM0-05......]  3
Fase 08 DS     [....................MEM0-09..]  1
Fase 09 DOM    [..............MEM0-07.MEM0-08.]  2
Fase 10 REC    [..................MEM0-05....]  1
Fase 11 SEC    [MEM0-06......................]  1
              9 tareas · 17 incidencias (fase × tarea)
```

### Recuento de estados (verificado sobre las 9 filas de la tabla §2) ###

| `✅ Completada` | `🚫 Descartada` | `🆕 Pendiente` | `⏳ Futura` | Total |
| :---: | :---: | :---: | :---: | :---: |
| 2 | 2 | 5 | 0 | **9** |

---

## 2. Catálogo Detallado de Extracción (10 Columnas Canónicas) ##

| ID | Severidad | Hallazgo | Archivo Mem0 | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `MEM0-01` | Crítica | **Pipeline aditivo de extracción de memoria desde el turno de chat (ADD-only + `linked_memory_ids`)** | `mem0/memory/main.py:918-955`, `mem0/configs/prompts.py:468-540` | 2-3d | Alta | 🆕 Pendiente | **Brecha central del SOC:** no existe en `packages/` ningún módulo que extraiga memoria del turno. `FactExtractor` (`packages/knowledge/src/extractors/FactExtractor.ts:62`) solo tiene caller en `packages/knowledge/src/index.ts:8` y tests. **Adaptación:** `packages/knowledge/src/extractors/ConversationMemoryExtractor.ts` con las tres ventanas de mem0 (10 mensajes recientes, 10 memorias existentes, mensajes nuevos), invocado desde `EgoMemoryLifecycle.syncTurn` (`packages/memory/EgoMemoryLifecycle.ts:268`) y escribiendo vía `FactLifecycle.consolidateMemories` (`packages/knowledge/src/FactLifecycle.ts:183`). Las memorias existentes alimentan **solo** deduplicación y enlace, nunca extracción. El `ts` canónico (`EgoMemoryAdapter.ts:506`) se inyecta como *Observation Date*, no como fecha del sistema. | Ego: `KB-08`, `KB-09`, `TASK-08`, `CORE-12` · Extracción: `docs/extractions/mem0.md` §2 Bloque A | `MEM0-05` |
| `MEM0-02` | Crítica | **Arbitraje de mutación por LLM (`ADD`/`UPDATE`/`DELETE`/`NONE`) con esquema Zod** | `mem0/configs/prompts.py:176-324` y `:406-460`; TS `mem0-ts/src/oss/src/prompts/index.ts:20-40` | 1-2d | Alta | 🆕 Pendiente | No existe en `packages/`. `FactLifecycle` decide de forma determinista (`FactLifecycle.ts:183-284`) y `FactLifecycle.consolidateMemories` ya expone `create`/`supersede`/`retire` — falta la capa que **decide**. **Hallazgo crítico:** en el commit `0724291` este prompt es código muerto en el SDK OSS (`get_update_memory_messages` en `prompts.py:406` no tiene caller; el pipeline vivo usa `ADDITIVE_EXTRACTION_PROMPT`, `main.py:944`); la v1 solo sobrevive en el SDK TypeScript. **Adaptación:** `packages/knowledge/src/arbitration/MemoryArbitrator.ts` con `MemoryUpdateSchema` Zod (`ADD`/`UPDATE`/`DELETE`/`NONE`) y la regla de mem0 "conserva la memoria más informativa" (`prompts.py:216-222`) para no degradar el overwrite. Debe ser **aditivo**: nunca sustituye la promoción humana de `quarantine/pending` (ADR-046). | Ego: `KB-08`, `DEC-02`, `SUB-12` | `MEM0-01` |
| `MEM0-03` | Alta | **Anti-alucinación de identificadores: mapeo de ids válidos en el prompt de extracción** | `mem0/memory/main.py:935-940`; TS `mem0-ts/src/oss/src/memory/index.ts:899-918` | 0.5-1d | Alta | 🆕 Pendiente | **Gap real y verificable:** mem0 muestra las memorias existentes al modelo con ids secuenciales ("0", "1") y un `uuid_mapping` interno, de modo que el modelo solo puede referirse a memorias que ha visto. En Ego, `FactExtractor.parseFactJson` (`FactExtractor.ts:157-193`) adopta el `id` que devuelve el modelo **sin contrastarlo** contra un conjunto válido; un `oldFactId` alucinado crearía una arista `SUPERSEDED_BY` colgante en `FactLifecycle.supersedeFact` (`FactLifecycle.ts:117-177`) y un `state` incoherente en `kb/facts`. **Adaptación:** `MemoryArbitrator` recibe un mapa `id → key` de las memorias realmente recuperadas y rechaza cualquier `old_memory` fuera del conjunto; test en `packages/knowledge/test/`. | Ego: `KB-08`, `SEC-06`, `DEC-07` | `MEM0-02` |
| `MEM0-04` | Alta | **Deduplicación determinista por hash en la ruta de escritura (doble barrera)** | `mem0/memory/main.py:1007-1026`; TS `mem0-ts/src/oss/src/memory/index.ts:1000-1034` | 0.5-1d | Alta | 🆕 Pendiente | mem0 descarta una memoria si su hash MD5 coincide con el de una memoria ya recuperada (**barrera histórica**) o con el de otra del mismo lote (**barrera intra-lote**, `seen_hashes`). Ego tiene la primera barrera por construcción: `FactExtractor` genera ids direccionables por contenido (`fact_${sha256(subject:object:source)}`, `FactExtractor.ts:97,128,166`), de modo que la reescritura es idempotente por clave — pero **el extractor no tiene caller**, así que la barrera no está operativa. Falta además la segunda barrera intra-lote. **Adaptación:** `seen_hashes` dentro del lote de `MEM0-01` antes de invocar `consolidateMemories`. | Ego: `KB-03`, `KB-07`, `TASK-08` | `MEM0-01` |
| `MEM0-05` | Media | **Consolidación en reposo que resuelve duplicados y contradicciones sin borrado destructivo** | `mem0/memory/main.py:1078-1098` (historial), `mem0/utils/entity_extraction.py:1-16` (entidades) | Ya asimilado | Media | ✅ Completada | Ego ya tiene la capacidad en producción y con caller verificado: `EgoMemoryLifecycle.runCuratorConsolidation` (`packages/memory/EgoMemoryLifecycle.ts:399-504`) consolida turnos `stale` de `session/turns` en `kb/facts/curator_<sessionId>` con **upsert idempotente por `turnCount`**, respetando `quarantine/pending` (nunca promueve lo que está en cuarentena) y **sin borrado destructivo** (`state: "retired"` en lugar de `DELETE`). **Evidencia del caller en producción:** `apps/desktop/src/main.ts:1966` — `lifecycle.startCuratorJob({ intervalMs: 60 * 60 * 1000, staleAfterDays: 30, maxSnapshots: 50 })`; el paso de sueño se agenda en `EgoMemoryLifecycle.ts:301` → `:541-548`. | Ego: `TASK-08`, `KB-08`, `REC-01` | — |
| `MEM0-06` | Media | **Scope de identidad por `user_id`/`agent_id`/`run_id` con escapado determinista** | `mem0/memory/main.py:314-404` y `:407-419` | — | Media | 🚫 Descartada (con justificación) | Adoptar el triple plano dejaría **dos ejes de scope en paralelo** y ambigüedad sobre cuál es el canónico. Ego ya tiene un registro de scope canónico, versionado y validado en runtime: `apps/desktop/ego.namespaces.json:4-31` (namespaces por dominio) + `docs/architecture/namespaces.md:40-47` (permisos por manifiesto) y la regla "los namespaces definen **dónde** vive el dato" (`namespaces.md:51`). `metadata.agent_id` ya es campo canónico forzado en cada escritura (`packages/memory/EgoMemoryAdapter.ts:505-514`), que es el equivalente del `agent_id` de mem0. El `run_id` de mem0 es en Ego `session/*`; el `user_id`, `journal/*` + `projects/<id>/*`. **Lo transferible** (la garantía de que la metadata libre del llamante no coloca una memoria en un scope no pedido, `main.py:143-164`) ya está parcialmente cubierto: los campos canónicos se reasignan después de copiarla (`EgoMemoryAdapter.ts:505-514`), de modo que `ts`/`created_at` son deterministas y `org_id`/`agent_id`/`confidence`/`state`/`source` caen a su default cuando faltan. | Ego: `CORE-06`, `SUB-04`, `SEC-06` | — |
| `MEM0-07` | Media | **Grafo de memoria: relaciones entre recuerdos** | `mem0/memory/main.py:1100-1204` (entity store), `mem0/configs/prompts.py:513,516` (`linked_memory_ids`) | Ya asimilado | Media | ✅ Completada | El grafo nativo de Ego cubre la capacidad y está en producción: `packages/knowledge/src/GraphRagEngine.ts:78` y `packages/knowledge/src/ProjectMemoryGraph.ts:36`, sobre el binding `packages/memory/GraphRag.ts` (`normalizeNativeGraphRag`, importado en `EgoMemoryAdapter.ts:23-26`). **Evidencia del caller en producción:** `apps/desktop/src/main.ts:33,37,201,205,683,699,2208,2212` (instancias) y el handler IPC `ipc.knowledge.graphRag` en `apps/desktop/src/main/ipc/register-ipc.ts:1363-1376` (llama `graphRagEngine.search(...)` en `:1369`), con esquema en `apps/desktop/src/ipc.ts:274`. **Alcance:** el grafo nativo cubre relaciones de proyecto (KB-11); el enlace explícito memoria→memoria de `linked_memory_ids` es un patrón **adicional** y queda cubierto por `MEM0-01` (no por esta fila). | Ego: `KB-06`, `KB-11`, `DOM-03` | `MEM0-01` |
| `MEM0-08` | Media | **Graph store externo (Neo4j / Memgraph / Kuzu / pgvector)** | `mem0/graphs/` (inexistente en `0724291`), `mem0/configs/base.py:29-58`, `mem0/exceptions.py:396` | — | Media | 🚫 Descartada (con justificación) | Triple fundamento: (a) **base de datos externa** → viola los principios 1 y 9 (memoria local persistente, local-first y propiedad/exportación de datos) y el guardrail "VantaDB es el sustrato soberano"; (b) el sustrato de grafo de Ego es VantaDB (`packages/memory/GraphRag.ts`), ya en producción (`MEM0-07`); (c) **no hay upstream que portar**: en el commit `0724291` el paquete `mem0/graphs/` no existe, `MemoryConfig` (`mem0/configs/base.py:29-58`) no declara sección `graph` y la única traza residual es un docstring (`mem0/exceptions.py:396`) — el propio `mem0/AGENTS.md` del repo sigue anunciando "4 proveedores" y está desfasado respecto al código. Adoptar un graph store de terceros sería además sobreingeniería: el grafo nativo ya resuelve el caso. | Ego: `KB-06`, `CORE-08` | — |
| `MEM0-09` | Media | **"Profile" del usuario y memoria semántica de preferencias como insumo del prompt** | `mem0/configs/prompts.py:496-498` y `:1036`; guía de extracción en `:485` | 1-2d | Media | 🆕 Pendiente | No existe en Ego: `UserPrefsState` (`packages/ui-runtime/src/stores/EgoStateStores.ts:60-66`) solo cubre preferencias visuales y de accesibilidad (`theme`, `reduceMotion`, `compactMode`, `soundEnabled`, `autoApproveReadOperations`); no hay memoria semántica de preferencias del usuario. El prompt de extracción de mem0 exige un bloque `## Summary` con el resumen narrativo del perfil (`prompts.py:496-498`, materializado en `:1036`), y la guía pide capturar preferencias, planes y relaciones explícitamente (`prompts.py:485`). **Adaptación:** construir ese bloque desde `journal/*` + `kb/facts` al ensamblar el prompt de `MEM0-01` — **sin crear un namespace ni un store nuevo** (el registro de namespaces es `ego.namespaces.json`); el briefing diario (`DS-02`) es el consumidor natural del perfil. | Ego: `DS-01`, `DS-02`, `KB-08` | `MEM0-01` |

---

## 3. Integración en el Flujo de Construcción de Ego ##

Cada tarea del backlog `MEM0-*` es **pre-requisito de diseño y código** de las fases del Backlog Maestro
(`docs/roadmap/Backlog.md`). Ninguna tarea puede cerrarse como `✅ Completada` sin el criterio de §0.

```text
FASE 01 / 03 / 11   CORE-06 · SUB-04 · SEC-06
  └─ MEM0-06 (descartada: el scope canónico ya es namespaces + manifiesto)

FASE 06 KB          KB-03 · KB-07 · KB-08 · KB-09
  MEM0-01 (extractor) ──► MEM0-04 (dedup) ──► MEM0-03 (whitelist de ids)
                              ▲
                              └──► MEM0-02 (arbitraje ADD/UPDATE/DELETE/NONE)
                                     │
FASE 05 DEC         DEC-02 ◄──────────────────┘
FASE 07 TASK        ◄── MEM0-05 (curator: ya en producción)
FASE 08 DS          ◄── MEM0-09 (perfil del usuario) · DS-01 · DS-02
FASE 09 DOM         ◄── MEM0-07 (grafo nativo) · MEM0-08 (descartada)
FASE 10 REC         ◄── REC-01 (integridad tras consolidación)
```

### Protocolo de extracción por tarea ###

1. **Lectura y aislamiento:** inspeccionar el fichero fuente en `repos-referencia/mem0/` identificando
   dependencias externas (vector store, SQLite, spaCy, modelos de embeddings).
2. **Eliminación de acoplamiento:** descartar SQLite, los 30 vector stores, los 15 embedders, el graph store
   externo y la API hosted. Toda escritura pasa por `EgoMemoryAdapter`; nunca por `NativeVantaDB` directo.
3. **Reescritura canónica:** TypeScript estricto en `packages/knowledge/` o `packages/memory/`, con esquemas
   Zod, sin `any`, sin embeddings densos en el fast path.
4. **Verificación:** test unitario en `packages/knowledge/test/` o `packages/memory/test/` + caller en
   `apps/desktop/src/main.ts` o en `EgoMemoryLifecycle`.
5. **Cierre de tarea:** marcar `✅ Completada` **solo** con fichero adaptado + caller en producción
   verificado; si el patrón no aplica, `🚫 Descartada (con justificación)`; si el código existe pero no está
   cableado, `🆕 Pendiente` con el cableado exacto y su responsable.

---

## 4. Deuda abierta derivada de esta verificación ##

| # | Ítem | Tipo | Owner | Bloqueante |
|---|---|---|---|---|
| D1 | `MEM0-01`/`MEM0-02`/`MEM0-03`/`MEM0-04`: el pipeline de extracción de memoria desde el turno **no existe** en `packages/`; `FactExtractor` es código asimilado sin caller desde hace meses | Código | A2 (memoria) / A1 (knowledge) | No |
| D2 | `packages/tasks/src/DreamConsolidator.ts` (clase `DreamConsolidator`, línea 91) implementa dedup y resolución de contradicciones pero **no tiene caller en `apps/desktop/`**: el sueño real lo ejecuta `EgoMemoryLifecycle.runDreamConsolidation` (`EgoMemoryLifecycle.ts:374-390`), que solo registra refuerzo hebbiano en `gov/audit`. Dos implementaciones de la misma idea | Código | A3 (tasks) / A2 (memoria) | No |
| D3 | `MEM0-09`: no existe memoria semántica de preferencias del usuario; `UserPrefsState` es solo visual/accesibilidad | Código | A2 / A8 (daily state) | No |
| D4 | `MEM0-06`: si en el futuro se acepta un scope de usuario explícito, debe entrar por `ego.namespaces.json` y por el manifiesto del Sub-Ego, nunca como campo de metadata libre | Decisión | Owner | No (descartada) |
| D5 | El repo de referencia tiene su propia documentación interna desfasada (`mem0/AGENTS.md` anuncia `mem0/graphs/` y Python 3.9; el código en `0724291` no tiene ninguno de los dos). Cualquier relectura futura debe hacerse contra el código, no contra su `AGENTS.md` | Documentación | ness-e | No |
