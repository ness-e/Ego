# C02 — Blast-radius: inventario total de `EgoMemoryAdapter.get()`

> Task 1 del plan `docs/agent-ops/plans/2026-10-12-c02-get-envelope.md` (ruta ego-arch, solo lectura).
> Firma actual verificada: `packages/memory/EgoMemoryAdapter.ts:165-170` —
> `async get(namespace: string, key: string): Promise<unknown>` retorna `parseRecord(record)`
> (payload pelado, sin envelope, sin metadata accesible).
> Contrato futuro: `get()` retorna `{key, payload, metadata}` con metadata DESENVUELTA
> (tagged `{Float,String,Bool}` → valores planos, vía `unwrapMetadata`, workaround VDB-BUG-02).

## Método de barrido

Comando canónico del plan (adaptado: `grep` no existe en pwsh/Windows; barrido equivalente
exhaustivo con búsqueda literal sobre `packages/`, `apps/`, `tests/`):

- Patrones: `adapter.get(`, `this.adapter.get(`, `this.memory.get(`, `memoryAdapter.get(`,
  `memory.get(`, `coldAdapter.get(`, `restoreAdapter.get(`, `restoredAdapter.get(`,
  `activeAdapter.get(`, `adapterInstance.get(`, `mockAdapter.get(`.
- Cada match verificado con contexto ±10 líneas y clasificado por uso real del retorno.
- Tipos: **PAYLOAD** (usa el retorno como payload directo: casts `as {..}`, lee `.verdict`,
  `.title`, `.content`, `.data`, schemas Zod sobre el retorno) · **METADATA**
  (lee `.metadata.*`, ignora el payload) · **AMBOS** (lee payload y metadata).

## Tabla — producción (`packages/*/src`, `apps/*/src`): 22 sitios

| archivo:línea | tipo | migración a envelope |
|---|---|---|
| packages/knowledge/src/KnowledgeIndexer.ts:51 | METADATA | Uso directo: `existing?.metadata?.["content_hash"]`. Payload se ignora. |
| packages/knowledge/src/KnowledgeIndexer.ts:141 (`getFact`) | AMBOS | Ya espera `{payload,metadata}` (retorna `{content: res.payload, metadata: res.metadata}`). Sin cambio de forma; con envelope pasa a funcionar (hoy `metadata` es `undefined` → bug silencioso). |
| packages/knowledge/src/FactLifecycle.ts:31 (`promoteFromQuarantine`) | AMBOS | Ya espera `{payload,metadata}`. Sin cambio; con envelope funciona. |
| packages/knowledge/src/FactLifecycle.ts:111 (`supersedeFact`) | AMBOS | Idem anterior. |
| packages/knowledge/src/FactLifecycle.ts:200 (`consolidateMemories` retire) | AMBOS | Idem anterior. |
| packages/knowledge/src/ProjectMemoryGraph.ts:93 (`explainArtifact`) | METADATA | Uso directo: `traceRecord?.metadata`. Payload no se usa. |
| packages/decision/src/DecisionAuditor.ts:60 (`getVerdict`) | PAYLOAD | REQUIERE migración: cast actual `{type,verdict}` deja de matchear → `(await get(...))?.payload as {verdict…}`. |
| packages/dailystate/src/DailyStatePersistence.ts:74 (`getSnapshot`) | PAYLOAD | REQUIERE migración: `DailySnapshotRecordSchema.parse((await get(...))?.payload)`. |
| packages/subegos/src/SelfImprovementLoop.ts:109 | PAYLOAD | Ya tolerante (`"payload" in stored` → unwrap). Sin cambio obligatorio (recomendado `?.payload ?? stored`). |
| packages/subegos/src/CharacterProfile.ts:291 (`loadCharacterProfile`) | PAYLOAD | Ya tolerante. Sin cambio. |
| packages/subegos/src/SubEgoBudget.ts:133 (`getMetrics`) | PAYLOAD | Ya tolerante. Sin cambio. |
| packages/tasks/src/TaskMemory.ts:93 (`getSnapshot`) | PAYLOAD | REQUIERE migración: parsea el retorno directo con `TaskMemoryDataSchema` → `?.payload ?? result` (con envelope el Schema fallaría). |
| packages/tasks/src/RunRecorder.ts:211 (`loadPersistedRun`) | PAYLOAD | Ya tolerante (`item.payload ?? item`). Sin cambio. |
| apps/desktop/src/windows/WindowStateManager.ts:192 | PAYLOAD | Ya tolerante. Sin cambio. |
| apps/desktop/src/main.ts:218 (`getOrCreateDefaultProject`) | PAYLOAD | Ya tolerante. Sin cambio. |
| apps/desktop/src/main.ts:766 (restore `model_config`) | PAYLOAD | Ya tolerante. Sin cambio. |
| apps/desktop/src/main.ts:1012 (IPC `memory` passthrough `adapter.get`) | PAYLOAD | Passthrough: hereda el envelope automáticamente; consumidores en renderer deben desempaquetar `.payload`/`.metadata`. |
| apps/desktop/src/main.ts:1239 (`ipc.mcp.toggleServer`) | PAYLOAD | Ya forma envelope (`as {payload}` + `existing.payload`). Sin cambio; funciona directo. |
| apps/desktop/src/main.ts:1412 (`ipc.projects.getActive`) | PAYLOAD | Ya tolerante. Sin cambio. |
| apps/desktop/src/main.ts:1480 (`ipc.settings.getModelConfig`) | PAYLOAD | `unwrapSettingsPayload` ya tolerante. Sin cambio. |
| apps/desktop/src/main.ts:1560 (`ipc.settings.saveModelConfig` fallback) | PAYLOAD | Idem anterior. Sin cambio. |
| apps/desktop/src/main.ts:1879 (`ipc.daily.journal` get) | PAYLOAD | REQUIERE migración: lee `.content` directo del retorno (`put` guarda `payload:{date,content,…}`) → `(record as Envelope)?.payload.content`. |

## Tabla — tests (adapter real + 2 fakes de adapter): 60 sitios, todos PAYLOAD

Migración genérica tests: `(await adapter.get(...))?.payload as T` (o cast a envelope).
Excepciones anotadas por fila.

| archivo:línea | tipo | migración / nota |
|---|---|---|
| packages/memory/test/memory.test.ts:57 | PAYLOAD | `?.payload.title` |
| packages/memory/test/memory.test.ts:61 | PAYLOAD | `?.payload` (string) |
| packages/memory/test/memory.test.ts:85 | PAYLOAD | `?.payload` (string) |
| packages/memory/test/memory.test.ts:102 | PAYLOAD | `?.payload` (string) |
| packages/memory/test/memory.test.ts:123 (`restoreAdapter`) | PAYLOAD | `?.payload.title` |
| packages/memory/test/memory.test.ts:145 | PAYLOAD | `?.payload.userMessage` |
| packages/memory/test/data-contract-and-sanitizer.test.ts:143 | PAYLOAD | `?.payload.rawText` / `.threatScore` |
| packages/memory/test/data-contract-and-sanitizer.test.ts:162 | PAYLOAD | `?.payload.isSanitized` / `.content` |
| packages/memory/test/contract-vantadb.test.ts:230 | PAYLOAD | `?.payload.email` |
| packages/memory/test/contract-vantadb.test.ts:237 | PAYLOAD | Solo null-check → sin cambio lógico (tipar envelope opcional) |
| packages/memory/test/contract-vantadb.test.ts:255 | PAYLOAD | `?.payload.version` |
| packages/memory/test/contract-vantadb.test.ts:289 (`restoreAdapter`) | PAYLOAD | `?.payload.version` |
| packages/memory/test/checkpoint-policy.test.ts:43 | PAYLOAD | `?.payload.toolName` / `.sessionId` / `.status` |
| packages/memory/test/checkpoint-policy.test.ts:69 | PAYLOAD | `?.payload.sessionId` / `.turnCount` / `.summary` |
| packages/memory/test/golden-path-alpha.test.ts:116 (`activeAdapter`) | PAYLOAD | `?.payload.name` |
| packages/memory/test/golden-path-alpha.test.ts:124 (`activeAdapter`) | PAYLOAD | Ya tolerante (`{payload:{userPrompt}} \| {userPrompt}`). Sin cambio. |
| packages/memory/test/golden-path-alpha.test.ts:148 (`restoreAdapter`) | PAYLOAD | `?.payload.name` |
| packages/runtime/test/tools-execution.test.ts:250 (`restoredAdapter`) | PAYLOAD | `?.payload.sessionId` / `.toolExecutions` / `.messages` |
| packages/runtime/test/tools-execution.test.ts:263 | PAYLOAD | `?.payload.path` / `.sha256` |
| packages/runtime/test/tools-execution.test.ts:272 | PAYLOAD | `?.payload.decision` |
| packages/runtime/test/tools-execution.test.ts:364 (`activeAdapter`) | PAYLOAD | `(… as any)?.payload.decision` |
| tests/e2e/tools-execution.test.ts:249 (`restoredAdapter`) | PAYLOAD | Duplicado e2e del runtime:250. `?.payload…` |
| tests/e2e/tools-execution.test.ts:262 | PAYLOAD | Duplicado e2e del runtime:263. |
| tests/e2e/tools-execution.test.ts:271 | PAYLOAD | Duplicado e2e del runtime:272. |
| tests/e2e/tools-execution.test.ts:363 (`activeAdapter`) | PAYLOAD | Duplicado e2e del runtime:364. |
| tests/e2e/golden-path-alpha.test.ts:116 (`activeAdapter`) | PAYLOAD | Duplicado e2e de memory/golden:116. |
| tests/e2e/golden-path-alpha.test.ts:124 | PAYLOAD | Ya tolerante (igual que memory/golden:124). Sin cambio. |
| tests/e2e/golden-path-alpha.test.ts:148 (`restoreAdapter`) | PAYLOAD | Duplicado e2e de memory/golden:148. |
| tests/e2e/mvp-software-loop.test.ts:153 | PAYLOAD | `?.payload.id` (cast `ProjectManifest` directo) |
| tests/e2e/mvp-software-loop.test.ts:310 (`coldAdapter`) | PAYLOAD | `?.payload.name` / `.activeSubEgoId` |
| tests/e2e/mvp-software-loop.test.ts:326 (`coldAdapter`) | PAYLOAD | `?.payload.path` / `.summary` |
| tests/e2e/mvp-software-loop.test.ts:335 (`coldAdapter`) | PAYLOAD | `?.payload.action` / `.toolName` |
| tests/e2e/subegos-delegation.test.ts:243 (`coldAdapter`) | PAYLOAD | `?.payload.delegatedWorker` / `.resultSummary` |
| tests/e2e/canvas-interaction.test.ts:199 | PAYLOAD | REQUIERE: lee `.data` directo → `?.payload.data` antes de `deserialize`. |
| tests/e2e/golden-path-alpha-full.test.ts:114 | PAYLOAD | `toEqual(projectContext)` sobre retorno → `?.payload`. |
| tests/e2e/golden-path-alpha-full.test.ts:136 | PAYLOAD | `?.payload.id` |
| tests/e2e/golden-path-alpha-full.test.ts:137 | PAYLOAD | `?.payload.spec` |
| tests/e2e/golden-path-alpha-full.test.ts:213 | PAYLOAD | Solo defined-check → sin cambio lógico. |
| tests/e2e/golden-path-alpha-full.test.ts:349 | PAYLOAD | `?.payload.id` |
| tests/e2e/golden-path-alpha-full.test.ts:353 | PAYLOAD | `?.payload.techStack` |
| tests/e2e/golden-path-alpha-full.test.ts:363 | PAYLOAD | `?.payload.status` / `.assignedTo` |
| tests/e2e/golden-path-alpha-full.test.ts:368 | PAYLOAD | REQUIERE: `deserialize(rawSavedCanvas…)` → `deserialize((rawSavedCanvas as Envelope)?.payload…)` |
| packages/subegos/test/subegos-delegation.test.ts:243 (`coldAdapter`) | PAYLOAD | Duplicado del e2e:243. |
| apps/desktop/test/mvp-software-loop.test.ts:152 | PAYLOAD | Duplicado del e2e:153. |
| apps/desktop/test/mvp-software-loop.test.ts:309 (`coldAdapter`) | PAYLOAD | Duplicado del e2e:310. |
| apps/desktop/test/mvp-software-loop.test.ts:325 (`coldAdapter`) | PAYLOAD | Duplicado del e2e:326. |
| apps/desktop/test/mvp-software-loop.test.ts:334 (`coldAdapter`) | PAYLOAD | Duplicado del e2e:335. |
| apps/desktop/test/golden-path-alpha-full.test.ts:114 | PAYLOAD | Duplicado del e2e-full:114. |
| apps/desktop/test/golden-path-alpha-full.test.ts:136 | PAYLOAD | Duplicado del e2e-full:136. |
| apps/desktop/test/golden-path-alpha-full.test.ts:137 | PAYLOAD | Duplicado del e2e-full:137. |
| apps/desktop/test/golden-path-alpha-full.test.ts:213 | PAYLOAD | Duplicado del e2e-full:213 (defined-check). |
| apps/desktop/test/golden-path-alpha-full.test.ts:349 | PAYLOAD | Duplicado del e2e-full:349. |
| apps/desktop/test/golden-path-alpha-full.test.ts:353 | PAYLOAD | Duplicado del e2e-full:353. |
| apps/desktop/test/golden-path-alpha-full.test.ts:363 | PAYLOAD | Duplicado del e2e-full:363. |
| apps/desktop/test/golden-path-alpha-full.test.ts:368 | PAYLOAD | Duplicado del e2e-full:368 (requiere `?.payload` en `deserialize`). |
| apps/desktop/test/canvas-interaction.test.ts:198 | PAYLOAD | Duplicado del e2e-canvas:199 (requiere `?.payload.data`). |
| apps/desktop/test/ipc-tool-loop.test.ts:146 | PAYLOAD | `?.payload.userPrompt` / `.assistantReply`. |
| apps/desktop/test/projects-ipc.test.ts:91 | PAYLOAD | Solo defined-check → sin cambio lógico. |
| apps/desktop/test/knowledge-ipc.test.ts:184 (`mockAdapter`, fake con `inMemoryStorage`) | PAYLOAD | Fake: actualizar el mock para devolver envelope `{key,payload,metadata}`. |
| apps/desktop/test/daily-state-ipc.test.ts:136 (`mockAdapter`, fake) | PAYLOAD | Fake que lee `.content` directo → mock a envelope + `?.payload.content`. |

## Totales (cuadran)

| categoría | n |
|---|---|
| TOTAL sitios `EgoMemoryAdapter.get()` | **82** |
| PAYLOAD (retorno usado como payload) | 76 (16 prod + 60 tests) |
| METADATA (solo `.metadata.*`) | 2 (KnowledgeIndexer:51, ProjectMemoryGraph:93) |
| AMBOS (payload + metadata) | 4 (KnowledgeIndexer:141, FactLifecycle:31,111,200) |
| Sin clasificar | **0** |

Verificación: 76 + 2 + 4 = 82. ✔

Subconjuntos operativos para Tasks 4–5:

- Ya tolerantes al envelope (verificar, sin cambio obligatorio): SelfImprovementLoop:109,
  CharacterProfile:291, SubEgoBudget:133, RunRecorder:211, WindowStateManager:192,
  main.ts:218,766,1412,1480,1560, main.ts:1239 (ya-envelope), golden turnRecord (:124 e2e y
  paquete), projects-ipc:91, e2e-full:213 (+duplicado desktop), contract:237.
- Requieren migración real (forma actual incompatible con envelope): DecisionAuditor:60,
  DailyStatePersistence:74, TaskMemory:93, main.ts:1012 (passthrough(renderer)),
  main.ts:1879, KnowledgeIndexer:141 + FactLifecycle:31,111,200 + ProjectMemoryGraph:93
  (funcionarán sin cambio de forma, pero hoy están rotos en silencio: `.metadata` siempre
  `undefined` — confirma hallazgo `revision-proyecto-2026-10-12.md:76`), resto de tests PAYLOAD.

## Fuera de alcance C02 (NO se tocan; `getDb()` crudo)

- Internos del adapter (motor `NativeVantaDB` directo; el propio `get()` ya los envuelve):
  `packages/memory/EgoMemoryAdapter.ts:167,272,330,428,475,486,500` (`db.get({namespace,key})`).
- Tests con acceso crudo al motor (intencionado, verifican tagged metadata / borrado físico):
  `packages/memory/test/contract-vantadb.test.ts:83,156,162` (`rawDb.get`),
  `:181,:259` (`(adapter as unknown).db.get`).
- `packages/recovery/src/ProjectExport.ts:39` (`this.adapter.getDb()?.listNamespaces()`; datos vía
  `adapter.list`, ya envelope en `list()`).
- `Map.get` / registries en memoria (no es `EgoMemoryAdapter`): `ToolRegistry`,
  `EventBus`, `SessionCheckpointPolicy.turnCounters`, `SessionLifecycleLocks.queues`,
  `DomainRegistry.domains`, maps in-memory de `KnowledgeDomain/CrmDomain/ProductDomain`,
  `BackgroundEngine/TaskCancellation/ProactivityEngine`, `ToolExecutionLoop.registry`,
  `McpManager.servers`, `TerminalSessionStore`, `CanvasBridge`, `PayloadRef.store`,
  `TraitRegistry`, `SessionDiffRevisions`, `EventIngress.pendingInteractions`.
- Test doubles con storage propio (no llaman al adapter real; solo los 2 `mockAdapter` de
  knowledge-ipc:184 y daily-state-ipc:136 se cuentan arriba como fakes a actualizar):
  `DecisionAuditor.test.ts` (stubs casteados), `TaskMemory/RunRecorder/DreamConsolidator.test.ts`
  (`storeMap`), `MockIPCBridge.memoryStore`, `task-crash-resume` (`vantaDbStorage` Map),
  `decision-ipc` / `subegos-ipc` (`registry.get`, `inMemoryStorage`).
- Solo usan `list()` (contrato ya-envelope, fuera del blast radius de `get()`):
  `QuarantineManager.ts:58,99`, `DailyStateEngine.ts:43,98,120,129,143`,
  `KnowledgeExport.ts:46`, `BitemporalQueries.ts:33`, `DecisionAuditor.listRecentVerdicts`
  (`:80`, consume `item.payload` de `list()` — ya correcto).

## Notas para Task 2+

1. Los 4 sitios AMBOS + `ProjectMemoryGraph:93` + `KnowledgeIndexer:51` son los únicos
   consumidores de metadata: tras Task 3 comparan valores planos (`meta["content_hash"]`,
   `meta["affected_files_json"]`) sin desenvolver tagged — el unwrap vive en el adapter.
2. `main.ts:1012` (IPC passthrough) cambia de shape para el renderer sin cambiar código:
   coordinar con consumidores IPC en Task 5.
3. Sin commit (ruta ego-arch: solo lectura + inventario).
