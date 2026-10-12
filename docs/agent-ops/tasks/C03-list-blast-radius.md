# C03 — Blast radius de `adapter.list()`: inventario de consumidores por uso de metadata

- Plan: `docs/agent-ops/plans/2026-10-12-c03-list-unwrap.md` (Task 1, agente `ego-arch`)
- Contrato auditado: `packages/memory/EgoMemoryAdapter.ts:177-192`
  (`list(namespace, limit)` retorna `{ key, payload, metadata? }` con `metadata`
  **sin desenvolver** — i.e. forma tagged VantaDB: `{ String, Float, Bool, "Null" }`;
  ver `packages/memory/unwrapMetadata.ts:1-21`. `get()` sí desenvuelve
  (`EgoMemoryAdapter.ts:171`); `list()` no (`:184-188`).
- Cambio previsto (Tasks 3-4): `list()` pasará a metadata desenvuelta.
  PAYLOAD-ONLY no cambian; LEE-META se verifican en Tasks 3-4.
- Método: grep `\.list\(` en `packages/` (63 matches) y `apps/` (9 matches),
  lectura ±10 líneas por match en alcance (`adapter.list` / `memory.list` /
  `memoryAdapter.list`). Excluidos: `db.list` crudo, `registry.list`,
  `api.*.list`, `SubEgoRegistry.list` propio, `ToolRegistry.list`.

## Clases

- **LEE-META**: el código lee `rec.metadata[...]` / `item.metadata` tras el `list()`.
- **PAYLOAD-ONLY**: solo lee `key` / `payload` (o solo cuenta `.length`); ignora `metadata`.
- **CRUDO-INTERNO**: `db.list` crudo dentro del adapter / utilidades internas — fuera de alcance.

## Inventario (21 sitios en alcance, 0 sin clasificar)

| archivo:línea | clase | veredicto |
|---|---|---|
| `packages/knowledge/src/BitemporalQueries.ts:33` | LEE-META (`valid_at`, `invalid_at`, `subject`, `fact_id`, resto) | Se verifica en Tasks 3-4. Hoy espera escalares (`typeof === "number"`); con tagged recibe `{Float}` y cae a defaults — el unwrap lo **corrige**, no lo rompe. |
| `packages/knowledge/src/QuarantineManager.ts:58` | LEE-META (`fact_id`, `subject`, `predicate`, `object`, `confidence`, `temporal_scope`, `source`, `valid_at`, `invalid_at`) | Se verifica en Tasks 3-4. Mismo caso: `String(meta[...])` sobre tagged daría `[object Object]`; el unwrap lo corrige. |
| `packages/knowledge/src/QuarantineManager.ts:99` | LEE-META (`expires_at`) | Se verifica en Tasks 3-4. `typeof === "number"` falla con tagged (`{Float}` → 0, purga inoperante); el unwrap lo corrige. |
| `packages/knowledge/src/ProjectMemoryGraph.ts:85` | PAYLOAD-ONLY (filtra por `r.key`, usa `r.payload` como `traceId`; no toca `metadata` del `list`) | Sin cambios. Nota: el `metadata` leído en `:103-110` proviene de `adapter.get()`, no de este `list()`. |
| `packages/knowledge/src/KnowledgeExport.ts:46` | LEE-META (passthrough: copia `rec.metadata` íntegro al paquete; el SHA-256 cubre metadata) | Se verifica en Tasks 3-4. No depende del shape tagged (no lee campos); el checksum **cambiará** tras el unwrap — esperado, no bloqueante. Re-exportar fixtures si existen. |
| `packages/dailystate/src/DecisionsFeed.ts:30` | LEE-META (`metadata.ts`, `metadata.agent_id`, con ramas dual-shape `String`/objeto en `:56-60`) | Se verifica en Tasks 3-4. Ya tolera ambos shapes; tras el unwrap las ramas tagged quedan muertas pero inofensivas. |
| `packages/dailystate/src/DailyStatePersistence.ts:104` | PAYLOAD-ONLY (parsea `rec.payload` con `DailySnapshotRecordSchema`, ordena por `payload.date`) | Sin cambios. |
| `packages/dailystate/src/DailyStateEngine.ts:43` | LEE-META (`metadata.ts`, `metadata.agent_id`, ramas dual-shape en `:71-77`, idéntico a DecisionsFeed) | Se verifica en Tasks 3-4. Ya tolera ambos shapes; ramas tagged muertas pero inofensivas tras el unwrap. |
| `packages/dailystate/src/DailyStateEngine.ts:98` | PAYLOAD-ONLY (solo `payload.status/state`) | Sin cambios. |
| `packages/dailystate/src/DailyStateEngine.ts:120` | PAYLOAD-ONLY (solo `.length`) | Sin cambios. |
| `packages/dailystate/src/DailyStateEngine.ts:129` | PAYLOAD-ONLY (solo `payload.resolved/status`) | Sin cambios. |
| `packages/dailystate/src/DailyStateEngine.ts:143` | PAYLOAD-ONLY (solo campos de `payload`) | Sin cambios. |
| `packages/decision/src/DecisionAuditor.ts:80` | PAYLOAD-ONLY (solo `item.payload.verdict`) | Sin cambios. |
| `packages/subegos/src/SelfImprovementLoop.ts:211` | PAYLOAD-ONLY (solo `item.payload` → `LessonLearnedSchema`) | Sin cambios. |
| `packages/tasks/src/DreamConsolidator.ts:40` | LEE-META (`metadata.expiresAt`) | Se verifica en Tasks 3-4. `typeof === "number"` falla con tagged; el unwrap lo corrige. |
| `packages/tasks/src/DreamConsolidator.ts:55` | LEE-META (lee `payload.*` + propaga `...(fact.metadata)` en `:81` al `put`) | Se verifica en Tasks 3-4. Passthrough de metadata al `put`; sin dependencia del shape tagged. |
| `packages/tasks/src/TaskCheckpoint.ts:71` | PAYLOAD-ONLY (solo `item.payload` → `TaskCheckpointRecordSchema` + checksum) | Sin cambios. |
| `packages/recovery/src/ProjectExport.ts:61` | LEE-META (passthrough: copia `item.metadata` íntegro a `DumpRecord`; el hash SHA-256 cubre metadata) | Se verifica en Tasks 3-4. Igual que KnowledgeExport: checksum cambiará tras el unwrap — esperado, no bloqueante. |
| `apps/desktop/src/main.ts:874` (`gov/mcp_servers`) | PAYLOAD-ONLY (solo `record.payload.config/enabled`) | Sin cambios. |
| `apps/desktop/src/main.ts:1291` (`gov/projects`) | PAYLOAD-ONLY (solo `rec.payload` → `ProjectManifestSchema`) | Sin cambios. |
| `packages/knowledge/test/double-index.test.ts:77` (test) | PAYLOAD-ONLY (solo `r.key` / longitud) | Sin cambios (test; no sensible a metadata). |

## Totales (cuadran)

- Total en alcance: **21**
- LEE-META: **9** (BitemporalQueries 1, QuarantineManager 2, KnowledgeExport 1,
  DecisionsFeed 1, DailyStateEngine:43 1, DreamConsolidator 2, ProjectExport 1)
- PAYLOAD-ONLY: **12** (ProjectMemoryGraph 1, DailyStatePersistence 1,
  DailyStateEngine 4, DecisionAuditor 1, SelfImprovementLoop 1, TaskCheckpoint 1,
  main.ts 2, double-index.test.ts 1)
- CRUDO-INTERNO (fuera de alcance, solo anotados): **4**
- Sin clasificar: **0**
- 9 + 12 = 21 ✔

## Fuera de alcance (anotado, no clasificado como consumidor)

| sitio | motivo |
|---|---|
| `packages/memory/EgoMemoryAdapter.ts:183` (`db.list` dentro de `list()`) | Implementación del propio contrato, no consumidor. |
| `packages/memory/EgoMemoryAdapter.ts:638` (`db.list` en `listSubEgos`) | CRUDO-INTERNO: usa `db.list` directo y solo `parseRecord` (payload); no toca `adapter.list()`. |
| `packages/memory/EgoMemoryAdapter.ts:715` (`db.list` en `exportDump`) | CRUDO-INTERNO: dump byte-fiel previsto — **debe seguir crudo** tras el unwrap (Task 3-4 no debe tocarlo). |
| `packages/subegos/src/SubEgoRegistry.ts:478` (`storageAny.db.list`) | CRUDO-INTERNO propio del registry. `:649` es `this.list` propio, no `adapter.list()`. |
| `ToolRegistry.list`, `registry.list` (tests), `api.projects/subegos.list`, `ego().subegos/projects.list` (renderer) | Otros `list()` — distinto contrato, fuera de alcance. |

## BLOQUEANTES

**Ninguno.** Ningún lector depende del shape tagged:
- Los lectores escalares (BitemporalQueries, QuarantineManager, DreamConsolidator:40)
  hoy degradan con tagged y el unwrap los corrige.
- Los lectores dual-shape (DecisionsFeed, DailyStateEngine:43) ya toleran ambos;
  las ramas tagged quedan muertas pero inofensivas.
- Los passthrough (KnowledgeExport, ProjectExport, DreamConsolidator:55/81) no
  inspeccionan campos; solo cambia el checksum/export — esperado.
