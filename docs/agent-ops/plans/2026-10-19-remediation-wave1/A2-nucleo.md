# Plan A2 — Núcleo cognitivo: memoria, conocimiento, runtime, modelos, decisión, ejecución

**Agente:** A2 (sesión `ses_eaa0dfc63ffec5FzOkB3X2swwy`) · **Persona:** `.opencode/agents/ego-worker.md`
**Zona exclusiva:** `packages/memory/**`, `packages/knowledge/**`, `packages/runtime/**`, `packages/models/**`, `packages/decision/**`, `packages/execution/**`, `packages/events/**`, `packages/security/**`, `packages/tool-call-repair/**`
**Prohibido:** `apps/**`, `docs/**`, `tests/gui/**`, `.github/**`, y cualquier otro `packages/*`

## Objetivo

Que el núcleo cognitivo **haga lo que la arquitectura declara**. Hoy: el Cognitive Path no existe, dos commits del P0 arreglaron código muerto, el MMR es decorativo, el router no evalúa complejidad ni coste, y el sanitizador no neutraliza lo que detecta.

## Tareas

### T1 — Conectar `ContextCompactionJob` al flujo de turnos (`EGO-FIND-21`) — **CRÍTICO**
`packages/runtime/src/ContextCompaction.ts` (520 líneas + 14 tests) tiene **0 instanciaciones** en `src/` (verificado). `apps/desktop/src/main.ts:2387` solo archiva el historial en `kb/history_archive` sin compactar.
**Tu trabajo (paquete):**
- Revisa el API público de `ContextCompaction` (`compact`, `compactSync`, `evaluateCompactionNeed`) y **hazlo inyectable y correcto**: `compactSync()` hoy **ignora `opts.summarizer`** (`:550`) y solo usa `opts.summarize` → unifica ambas rutas en un único motor de resumen.
- `autoMemory` (`:11`) está declarado y documentado ("archiva el resumen en `kb/history_archive`") pero **nunca se usa** → implementa el archivado o elimina el setting y su docstring.
- **Añade la inyección del `summarizer` real**: define el contrato `SummarizerFn` y un adaptador que use el `ModelRouter` de `packages/models` (sin acoplar `runtime` → `models` si el grafo no lo permite: si hace falta, usa un tipo estructural `() => Promise<string>`).
- **Handoff obligatorio para A4** (`apps/desktop/src/main.ts` es de A4): escribe en tu handoff el diff exacto para instanciar `ContextCompactionJob` en el bootstrap de main y llamarlo al final del turno cuando `evaluateCompactionNeed` dispare, con el turno rebuilt en `isCompressionRebuild: true`.
- **Verificable**: test de integración que compacta un hilo >60 turnos y comprueba que el prompt resultante tiene ≤ `compressionTargetRatio` de mensajes y contiene el resumen. Test rojo primero.

### T2 — Router: backoff, capabilities, coste y complejidad (`EGO-FIND-37`, `EGO-FIND-38`, `EGO-FIND-39`, `EGO-FIND-40`)
`packages/models/src/ModelRouter.ts`:
- **Backoff exponencial con jitter ante 429** (`:432-463`): hoy solo rota credencial encadenada y puede repetir la misma key. Añade backoff con jitter antes de cada rotación, con test que use fake timers.
- **Fallback que ignora `requiredCapabilities`** (`:390-402`): puede devolver un modelo sin `tool_calling` a quien lo exige. Aplica el filtro de capabilities también en las ramas de fallback.
- **`maxCostPerCallUsd` (`:17`, `:150`) se configura y nunca se lee** → wirealo: si el coste estimado de la llamada supera el presupuesto, degrada a un modelo más barato o rechaza con error tipado.
- **Routing por complejidad/multimodalidad** (`:321-406`): `resolveModel(role,…)` es binding por rol y la capability `"vision"` nunca enruta. Añade scoring de complejidad (tokens / nº archivos / multimodal) → aliases `fast`/`smart`.
- **Prompt caching real** (`EGO-FIND-40`): 0 ocurrencias de `cache_control` en `packages/models/src/providers/`. Añade `providerOptions.anthropic.cacheControl` para el bloque de sistema estable. Verifica la API vigente del provider antes de escribir (usa `source-driven-development` o la doc oficial del SDK AI SDK v7).

### T3 — Búsqueda híbrida: MMR efectivo y honestidad del contrato (`EGO-FIND-41`)
`packages/knowledge/src/HybridSearch.ts:91-147`:
- El MMR es **decorativo**: relevancia = score BM25 sin acotar (0..>10) frente a Jaccard ∈[0,1] ⇒ con λ=0.7 la diversidad pesa ≤0.3 y **nunca cambia el orden**. Normaliza la relevancia a [0,1] (min-max del lote, como hace `ScoreThresholdFilter`) antes de aplicar MMR.
- Sigue usando **Jaccard de palabras**, no coseno. Como `query_vector` sigue vacío (workaround upstream `VDB-REQ-02`), implementa la **interfaz** de similitud densa (`cosine(a,b)`) con test propio, y usa la vecinal por defecto hasta que exista lista vectorial real.
- **Corrige los docstrings falsos**: `EgoMemoryAdapter.searchMulti` (`:652-656`) afirma "Búsqueda híbrida multi-namespace con RRF (BM25 + HNSW)" y `KnowledgeSearchOptionsSchema` afirma "BM25+Vector+RRF". **No hay RRF.** Reescribe los docstrings para que describan lo que hace (federada BM25 multi-namespace + MMR) y añade un `TODO` explícito con el ID de backlog para RRF real cuando VantaDB 0.9+ lo permita.

### T4 — GraphRAG: descubrimiento de arista real (`EGO-FIND-42`)
`packages/knowledge/src/GraphRagEngine.ts:211-251` — el `adapter.get()` es real (✅ commit `1532e38`) pero los vecinos se descubren por **metadata + regex** `\b(doc_[a-f0-9]{8,16}|fact_...)\b`.
- `EgoMemoryAdapter.graphQuery` (`:1068`) y `insertNode/addEdge/getNode` tienen **0 callers**. Usa `graphQuery` (IQL) para el descubrimiento de vecinos, con fallback al método actual si el grafo está vacío.
- Si el grafo de VantaDB realmente no soporta este patrón en 0.8.0, **documéntalo como limitación upstream** en `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` con un ID `VDB-REQ-*` y **referencia el ID en el código** (`// Workaround: VDB-REQ-XX`). Prohibido el workaround silencioso.

### T5 — Taint tracking + canal P-LLM/Q-LLM (`EGO-FIND-60`) — **la brecha de mayor retorno**
`packages/memory/UntrustedContentSanitizer.ts:22-58` = 7 regex, **solo en inglés**; 0 matches de `taint`/`P-LLM`/`Q-LLM` en `packages/`.
- **El sanitizador no neutraliza lo que detecta**: los patrones incluyen `instruction`, `developer_mode`, `ego_internal` (`:40`) pero `wrapUntrustedContent` solo neutraliza `system`, `prompt`, `tool_call` (`:109-112`) → **fuga directa**. Corrige: todo patrón detectado debe quedar neutralizado.
- **Taint tracking mínimo**: propaga un flag de procedencia en el mensaje (`ModelMessage` o el tipo equivalente) que marque "esto vino de una fuente no confiable". El runtime debe **filtrar** en el prompt assembly lo que viene tainted antes de una tool destructiva.
- **Canal dual-LLM (CaMeL) mínimo**: separa el *control channel* (instrucciones del sistema) del *data channel* (contenido externo), de modo que un texto externo no pueda alterar instrucciones. Documenta el diseño en un ADR (pídelo por handoff a A1, que escribe los ADRs).
- Patrones ES y EN ampliados; tests de regresión con casos de inyección **ofuscada** (no solo los 7 literales).

### T6 — Namespaces y metadata (`EGO-FIND-34`, `EGO-FIND-35`)
- `apps/desktop/ego.namespaces.json` está desfasado respecto al código (~30 namespaces reales; `kb/facts` con 22 usos, `proj/traces`, `session/turns`, `system/checkpoints`, `gov/settings`, `gov/approvals` ausentes). **El JSON no es tu zona** (está en `apps/desktop/`) → **hándalo a A4** con la lista exacta y el esquema correcto.
- `DecisionRouter.ts:54-55` emite `proj/<id>` y `agent/<id>` contra el esquema real `egos/<id>/*` → corrígelo en `packages/decision/` (tu zona).
- `EgoMemoryAdapter.ts:24-30,468-500`: `source` está en el esquema pero `EgoPut` no tiene ese campo y `writeLive` nunca lo escribe → añádelo y forzalo.

### T7 — Cascada de decisión de 3 niveles (`EGO-FIND-36`)
`packages/decision/src/DecisionCascade.ts:94,134` — niveles 2 (scorer) y 3 (LLM estructurado) son **código muerto**: producción usa `new DecisionRouter()` (1 nivel, regex). `JevProvider` solo aparece en tests.
- **Implementa la integración**: el `DecisionRouter` debe aceptar un `scorerProvider` y un `llmFallbackFn` opcionales y usarlos cuando estén presentes, degradando a regex si no. Test con ambos caminos.
- **Handoff a A4**: el diff para instanciar la cascada en `main.ts:3103`.

### T8 — Ejecución de herramientas y límites (`EGO-FIND-43`, `EGO-FIND-44`)
`packages/runtime/src/ToolExecutionLoop.ts:387` — `for (const call of res.toolCalls) { await … }` serial, desaprovecha `maxConcurrentExecutions: 5`. **Paraleliza por tanda** con `Promise.allSettled`, respetando los gates de gobernanza **por llamada** (no un gate global antes de la tanda).
`packages/execution/src/ExecutionManager.ts:296-309` — `enforceOutputLimit` trunca por **caracteres** con límite en **bytes** (UTF-8 multi-byte excede la cuota), solo aplica a strings, y `truncatedString as unknown as T` rompe el tipo. **Mide por bytes**, aplica la cuota a salidas no-string (JSON), y devuelve un tipo de salida degradado explícito.
`ExecutionManager.ts:266-278` — `acquireSlot()` no es cancelable: una ejecución abortada en cola sigue esperando slot. **Hazla cancelable** (guarda el `resolve` y retíralo por `callId`).

### T9 — Extractores: regex rígidas (`A2-19`, `A2-20`)
- `packages/knowledge/src/extractors/FactExtractor.ts:28,56` — el patrón KV `^([^:]+):\s*(.+)$` matchea **cualquier línea con dos puntos** (URLs, "Nota:", timestamps) → falsos positivos sistemáticos. Acótalo a un vocabulario de claves o exige un predicado conocido; añade pasado/futuro/inglés.
- `packages/decision/src/IntentClassifier.ts:106-199` — `confidence` es **constante** por rama (0.95/0.90/0.88/0.85/0.70), nunca medida, y `detectRequiresApproval` no consulta el `riskLevel` real de la tool. **Calibra la confianza** y **deriva la aprobación del `riskLevel`/`category` de la tool** (no de regex sueltas).

### T10 — Limpieza de tipos (`EGO-FIND-65` parcial, `A2-21`, `A2-22`)
- 5 `as any` **sin justificación** en `packages/execution/src/ApprovalEngine.ts:393-422` (mutan identidades de aprobación → **ruta sensible de seguridad**). Tipa `expectedIdentity`/`currentIdentity` con un schema compartido.
- `packages/knowledge/test/*.test.ts` usan `mockAdapter: any` (5 ficheros) → una deriva de firma del adaptador no la detectaría ningún test. Tipa los mocks como `Pick<EgoMemoryAdapter, "searchMulti" | "get">`.
- Los `any` restantes de producción deben llevar **comentario de justificación** (AGENTS.md §4).

## DoD específico

- `pnpm --filter @ego/{memory,knowledge,runtime,models,decision,execution,events,security,tool-call-repair} test` → 0 regresiones (603 tests hoy).
- `pnpm -r typecheck` → exit 0.
- 0 `any` sin justificación en tu zona.
- Todo workaround de VantaDB registrado en `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` con ID referenciado en el código. **Ese fichero NO es tu zona** (es `docs/`) → **hándalo a A1** con el texto completo de la entrada.
- Cada corrección de comportamiento tiene un test **demostrado rojo** antes del fix.

## Handoff

`docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A2.md`
Debe incluir **obligatoriamente**: (a) diff exacto para `main.ts` (instanciación de `ContextCompactionJob` y de la `DecisionCascade`), (b) el JSON de namespaces regenerado para A4, (c) las entradas de `VANTADB-FEEDBACK-Y-MEJORAS.md` para A1.
