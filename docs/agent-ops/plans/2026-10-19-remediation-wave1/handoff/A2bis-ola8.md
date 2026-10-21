# Handoff A2-bis — Ola 8 — 2026-10-21

> Zona: `packages/{memory,tasks,runtime,events,knowledge,models,decision,execution,security,tool-call-repair,domains,ui-runtime,tools,integrations,dailystate}/**`.
> **Prohibido y NO tocado**: `packages/avatar/**` (A6), `apps/**` (A4), `docs/**` salvo este
> handoff (A1/A5), raíz y `scripts/**` (A7). **Sin commits.**
> Continuación de `A2bis.md` (Ola 5) y `A2bis-router.md` (Ola 6).

---

## 0. Resumen

| Tarea | Estado | Qué se entrega |
|---|---|---|
| **F1** `EGO-FIND-83` (retirar el crédito a khoj) | ✅ | **0 referencias `KHOJ-xx`** en el código de mi zona (17 → 0). Cada una sustituida por la verdad: *qué mecanismo* es propio y que el patrón se estudió en khoj (AGPL-3.0) como **referencia de diseño, sin traducción de código**. |
| **F2** Clasificación D/P/N | ✅ | **24 ficheros** de mi zona clasificados uno a uno **contra el clon real** (`repos-referencia/`). **5 D** (con cabecera canónica `Adapted from`), **19 P** (texto veraz, sin `Adapted from`). **0 N** con atribución engañosa pendiente. |
| **F3** `LICENSE.md` | ✅ | **2 creados** (`packages/ui-runtime/`, `packages/tools/`) + **1 actualizado** (`packages/tool-call-repair/`). Paquetes sin código derivado **NO** reciben `LICENSE.md` (sería ruido). |
| **T4** `DreamConsolidator` cableado | ✅ | Motor movido a `packages/memory` y **cableado en el hook real** (`EgoMemoryLifecycle.runDreamConsolidation`, el temporizador de inactividad de 5 min que ya estaba en producción). **Evidencia observable**: registro inmutable `gov/audit` con acción `dream_consolidation`. **Cero cambios en `apps/**`**. |
| **T4** `MemoryCurator` | ✅ veredicto | **(a) capacidad que falta** → cablearla (diff exacto para A4 en §6). **No** es duplicado. |
| **Puerta de atribución** | ✅ | **5 tests de puerta** (`test/attribution.test.ts` en `tool-call-repair`, `ui-runtime`, `tools`, `domains`, `events`): nadie puede volver a afirmar derivación sin la cabecera canónica, y todo fichero derivado está en su `LICENSE.md`. |

---

## 1. F1 — `EGO-FIND-83`: el crédito a khoj, retirado

**Decisión del owner (2026-10-20)**: *"retirar todo el crédito a khoj"* — el código
atribuido a khoj (AGPL-3.0) era **implementación propia de Ego**.

**Antes**: 17 referencias `KHOJ-xx` en 6 ficheros de mi zona (17 líneas).
**Ahora**: **0**.

| Fichero | Referencia retirada | Sustitución (la verdad) |
|---|---|---|
| `packages/knowledge/src/schemas/knowledge.ts` | `KHOJ-01`, `KHOJ-02` (×5) | *"**Implementación propia de Ego.** Los dos mecanismos que implementa — digest SHA-256 de deduplicación (`contentHash`) y ruta de encabezados jerárquica (`headingPath`) — son **código propio**: el patrón se estudió en khoj (AGPL-3.0) como **referencia de diseño**, sin traducción de código (el upstream usa MD5 y no tiene ruta de encabezados)."* |
| `packages/knowledge/src/ingest/AdaptiveChunker.ts` | `KHOJ-01`, `KHOJ-02` (×3) | *"Fragmentador adaptativo jerárquico — **implementación propia de Ego**… el patrón de fragmentación jerárquica se estudiará como referencia de diseño; **no se ha traducido código** de ese proyecto. Sus parámetros reales difieren de los de aquí (el upstream cuenta palabras, no tokens, y usa solapamiento 0 y MD5)."* |
| `packages/knowledge/src/filters/ScoreThresholdFilter.ts` | `KHOJ-03` (×2) | *"**Implementación propia de Ego.** El umbral 0.70 es una **calibración propia**… pero **no hay traducción de código** (aquí el corte es un 0.70 propio, no el del upstream)."* |
| `packages/knowledge/src/HybridSearch.ts` | `KHOJ-03` (×4) | Los identificadores pasan a la **etiqueta propia de Ego** `H10` (H10 ya era la referencia interna del filtro de umbral). |
| `packages/knowledge/src/extractors/FactExtractor.ts` | `KHOJ-04` | *"Extractor heurístico y estructurado de hechos atómicos. **Implementación propia de Ego.** Sin atribución de código derivado."* |
| `packages/knowledge/src/FactLifecycle.ts` | `KHOJ-05` | *"Consolida y actualiza autónomamente memorias y hechos cognitivos… **Implementación propia de Ego.** Sin atribución de código derivado."* |
| `packages/knowledge/test/{AdaptiveChunker,HybridSearch,QuarantineAndLifecycle,ScoreThresholdFilter}.test.ts` | `KHOJ-01..05` (×6) | Títulos de test y comentarios reescritos con el mecanismo ("fragmentación jerárquica propia de Ego", "Guarda de umbral (H10)"). |

> ⚠️ **Una referencia queda FUERA de mi zona** (A3): `packages/subegos/src/SelfImprovementLoop.ts:2`
> — *"…y compuerta `KHOJ-05` (extracción de hechos y auto-reflexión)"*. **No lo he tocado**
> (`packages/subegos/**` no es mi zona). Texto exacto propuesto en §5.2.

---

## 2. F2 — Informe por fichero (clasificación D/P/N)

**Método**: para cada fichero con atribución, (1) localizar el fichero de origen **en el clon
real** `repos-referencia/<slug>/`, (2) leer su `LICENSE` y su `remote.origin.url`,
(3) comparar la **superficie exportada** y la **estructura** con el fichero de Ego, y
(4) medir la **similitud de trigramas** sobre el código normalizado (sin comentarios).
Un "patrón asimilado" que shares nombres de símbolos pero no lógica **no** es un port.

### 2.1 Veredictos **D** (derivado real → cabecera canónica + `LICENSE.md`)

| # | Fichero | Upstream | Licencia | Ruta de origen (verificada) | Evidencia |
|---|---|---|---|---|---|
| D1 | `packages/tool-call-repair/src/balanced-json.ts` | `openclaw` | MIT | `packages/normalization-core/src/balanced-json.ts` | El fichero existe en el clon. Tipos y algoritmo **idénticos**: `JsonOpeningDelimiter`, `BalancedJsonFragment`, `isJsonOpeningDelimiter()`, barrido con pila + `inString`/`escaped`. **Similitud de trigramas 0,726** (Ego 1 697 chars vs upstream 2 036). La cabecera anterior citaba `packages/normalization-core/balanced-json.ts` → **ruta equivocada** (faltaba el `src/`). |
| D2 | `packages/tool-call-repair/src/grammar.ts` | `openclaw` | MIT | `packages/tool-call-repair/src/grammar.ts` | El fichero existe en el clon. Las **4 constantes exportadas son byte-idénticas** (`END_TOOL_REQUEST`, `HARMONY_CHANNEL_MARKER`, `HARMONY_MESSAGE_MARKER`, `HARMONY_CALL_MARKER`) y el escáner `scanPlainTextToolCalls` es un **subconjunto** del upstream (Ego 3 116 chars vs 9 751). |
| D3 | `packages/ui-runtime/src/AnsiParser.ts` | `hermes-agent` | MIT | `apps/desktop/src/lib/ansi.ts` | El fichero existe en el clon. `AnsiSegment`, el union `AnsiColor` de 16 colores y el mapa `FG_BY_CODE` con los mismos códigos. **Similitud 0,723** (Ego 2 276 vs 3 030). |
| D4 | `packages/ui-runtime/src/FuzzySearch.ts` | `hermes-agent` | MIT | `apps/shared/src/fuzzy.ts` | El fichero existe en el clon. `FuzzyMatch`, `searchFold`, `fuzzyScore`, `fuzzyRank` con los **mismos nombres y la misma firma** (`RankedItem` renombrado a `RankedResult`). **Similitud 0,756** (Ego 2 112 vs 2 600). |
| D5 | `packages/tools/src/native/git/ChangeSetService.ts` | `coucou` | MIT | `NotchBuddy/Sources/CoucouKit/DiffEngine.swift` | El fichero existe en el clon (Swift). Conserva los tipos del motor de origen: `DiffLine` con su `enum Kind {context, added, removed}`, `DiffHunk`, `FileDiff` y el algoritmo de líneas/hunks. Es un **port Swift→TS**. |

### 2.2 Veredictos **P** (patrón asimilado → texto veraz, **sin** `Adapted from`)

| # | Fichero | Upstream | Patrón | Evidencia de que **no** es un port |
|---|---|---|---|---|
| P1 | `packages/domains/src/IntervalSet.ts` | Coucou · COUC-12 | Agregación de intervalos | Algoritmo O(N log N) propio. |
| P2 | `packages/domains/src/WorkboardContract.ts` | OpenClaw · OCLW-15 | Contrato de tableros | El esquema de estados **difiere**: Ego `backlog\|todo\|in_progress\|review\|done` (5, títulos en español) vs upstream `triage\|backlog\|todo\|scheduled\|ready\|running\|review\|blocked\|done` (9). La cabecera decía *"Extraído y adaptado de"* → **afirmación falsa**, corregida. |
| P3 | `packages/events/src/ApprovalIdentity.ts` | openclaw | `admitted-run-context` | Reimplementación TS declarada; el propio texto ya decía "nunca copiar código de referencia". |
| P4 | `packages/events/src/InteractionTransport.ts` | Coucou | `island/fsm` + bridge | Reimplementación TS declarada. |
| P5 | `packages/events/src/ToolActivityEmitter.ts` | OpenClaw · OCLW-14 | Eventos de actividad | **La ruta citada no existe en el clon** (`src/infra/agent-activity-events.js` → ausente; el upstream tiene `src/agents/*activity*.ts`). La cabecera afirmaba una derivación **no verificable** → corregida a P. |
| P6 | `packages/execution/src/WidgetHitlBridge.ts` | Coucou · COUC-01/03 | Contrato mecánico de la tarjeta de aprobación | El upstream (`coucou/windows/src/island/hooks.ts:273-328`) es el island de React (`State`, `Bridge`, `island`, `Sound.play`); el de Ego es un **contrato de eventos** entre el widget y el main. No hay código compartido. |
| P7 | `packages/execution/src/ZeroContextKernel.ts` | Hermes · HERM-18 | Kernel zero-context | El upstream es `tools/code_kernel.py`: un **kernel Python persistente** con otro protocolo (JSON-lines) y otra semántica. El de Ego es `worker_threads` + `node:vm` endurecido (VULN-SEC-08-01). Afirmación "Extraído y adaptado de" **falsa** → corregida. |
| P8 | `packages/knowledge/src/filters/ScoreThresholdFilter.ts` | khoj (AGPL-3.0) | Umbral de score | Ver F1: el umbral 0.70 es una calibración **propia** (el upstream corta por `bi_encoder_confidence_threshold`). |
| P9 | `packages/knowledge/src/ingest/AdaptiveChunker.ts` | khoj (AGPL-3.0) | Chunking jerárquico | Ver F1: SHA-256 + solapamiento 32 tokens + ruta de encabezados son **propios** (el upstream usa MD5, palabras y solapamiento 0). |
| P10 | `packages/knowledge/src/schemas/knowledge.ts` | khoj (AGPL-3.0) | Esquema de fragmento | Ver F1. |
| P11 | `packages/memory/EgoMemoryLifecycle.ts` | Hermes | `RecallStatus` | El estado propio (`count`/`glyph`/`sources`/`tokensEstimate`/`hits`) es de Ego. |
| P12 | `packages/memory/OpaqueId.ts` | DeepSeek-Harness · DSEK-03 | Ids opacos canónicos | Formato `${prefix}_${timestamp_base36}_${entropy}` y el código son propios. |
| P13 | `packages/runtime/src/ContextCompaction.ts` | Hermes | `pre-compress` | Archivado en `kb/history_archive` con `autoMemory` propio; la etiqueta de patrón pasa a la forma "patrón asimilado de Hermes · `pre-compress`". |
| P14 | `packages/tasks/src/ContextProvider.ts` | Coucou · COUC-16 | `WindowContextCapture` | Captura desacoplada propia. |
| P15 | `packages/tasks/src/WorkerPolicy.ts` | helmor/openclaw | `worker-pool` | El propio texto ya decía "Reimplementación TS del patrón, no copia de referencia"; normalizado. |
| P16 | `packages/tool-call-repair/src/coercion.ts` | OpenClaw | Coerción de argumentos | **No es un port**: `coerceBoolean` acepta `yes/y/on/no/n/off` (el upstream sólo `true`/`false`); `coerceNumber` parsea cadenas (el upstream `asFiniteNumber` no); `normalizeToolArguments` exenta las claves de contenido `content/body/code/script/query/message/prompt` (el upstream `record-coerce.ts` es una familia de type guards sin relación). La cabecera decía *"Extraído y adaptado de"* → **afirmación falsa**, corregida. |
| P17 | `packages/tools/src/native/fs/FileLockManager.ts` | Career-Ops · CARP-02 | `pipeline-lock.mjs` | Lockfiles con detección de locks caducos: propio. |
| P18 | `packages/tools/src/native/git/GitParser.ts` | OpenClaw · OCLW-08 | Unidiff + `porcelain status` | Parser propio. |
| P19 | `packages/tools/src/native/git/SessionDiffRevisions.ts` | OpenClaw | Diff acumulado de sesión | El upstream resuelve el **merge-base de una rama**; Ego registra el **SHA base de la sesión**. APIs distintas. La cabecera decía *"Extraído y adaptado de"* → **afirmación falsa**, corregida. |
| P20 | `packages/ui-runtime/src/MockIPCBridge.ts` | Coucou · COUC-15 | Mock bridge | Puente en memoria propio. |
| P21 | `packages/ui-runtime/src/WindowState.ts` | Hermes · HERM-08 | Geometría de ventanas | Geometría y restauración propias. |
| P22 | `packages/ui-runtime/src/MermaidRenderer.ts` | OpenClaw · OCLW-11 | `mermaid-renderer` | El upstream **renderiza** Mermaid a SVG en el navegador (iframe + DOMPurify); Ego hace un **validador estático** sin DOM. El upstream **no tiene** `validate`, ni `DANGEROUS_PATTERNS`, ni `MAX_SOURCE_LENGTH` (buscados en el clon). Afirmación "Extraído y adaptado de" **falsa** → corregida. |

### 2.3 Veredictos **N** (nativo: la atribución era engañosa y se quitó)

| Fichero | Qué se quitó |
|---|---|
| `packages/events/src/types.ts` | *"Derivado de docs/architecture/vision-general.md"* → el upstream de esa frase es un doc **interno de Ego**, no un repo de referencia: se matiza. |
| `packages/tools/src/native/security/NetPolicy.ts` | *"re-export de la política de red anti-SSRF **canónica** de Ego"* → ya era cierto (código de Ego). Sin cambio de fondo. |
| `packages/decision/src/schemas/verdict.ts`, `packages/models/src/providers/esm-loader.ts`, `packages/memory/test/memory-recall-trust.test.ts` | Falsos positivos del barrido (no son atribuciones). Sin cambio. |

### 2.4 Recuento final

| Veredicto | Ficheros |
|---|---|
| **D** (derivado real → cabecera canónica) | **5** |
| **P** (patrón asimilado → texto veraz) | **22** |
| **N** (nativo / atribución engañosa retirada) | **3** (2 con cambio de fondo + 1 matiz) |
| **Total clasificado** | **27** ficheros (24 con atribución en prosa + 3 revisados por el barrido) |

### 2.5 Cabeceras canónicas por paquete (mi zona)

| Paquete | Cabeceras `Adapted from` | Ficheros |
|---|---|---|
| `packages/tool-call-repair` | **2** | `src/balanced-json.ts`, `src/grammar.ts` |
| `packages/ui-runtime` | **2** | `src/AnsiParser.ts`, `src/FuzzySearch.ts` |
| `packages/tools` | **1** | `src/native/git/ChangeSetService.ts` |
| **TOTAL** | **5** | (en `packages/avatar/**`: 59, de A6 — no tocados) |

### 2.6 Paquetes con `LICENSE.md` (después de esta ola)

| Paquete | `LICENSE.md` | Upstreams declarados |
|---|---|---|
| `packages/tool-call-repair` | **actualizado** | OpenClaw (MIT) — 2 ficheros derivados; `src/coercion.ts` pasa a la tabla de **nativos** |
| `packages/ui-runtime` | **creado** | Hermes Agent (MIT) — 2 ficheros derivados |
| `packages/tools` | **creado** | Coucou (MIT) — 1 fichero derivado |
| `packages/avatar` | (A6) | agent-robot-avatar, coucou… |

> **No se crea `LICENSE.md` en los paquetes sin código derivado** (17 paquetes): sería ruido.

---

## 3. F3 — El contenido de los `LICENSE.md`

Todos los datos están **verificados contra el clon real**:

| Upstream | `remote.origin.url` | `LICENSE` | Commit | Ficheros |
|---|---|---|---|---|
| `openclaw` | `https://github.com/openclaw/openclaw` | MIT — Copyright (c) 2026 OpenClaw Foundation | `0c7a83d` | `packages/normalization-core/src/balanced-json.ts`, `packages/tool-call-repair/src/grammar.ts` |
| `hermes-agent` | `https://github.com/nousresearch/hermes-agent` | MIT — Copyright (c) 2025 Nous Research | `4787e4d` | `apps/desktop/src/lib/ansi.ts`, `apps/shared/src/fuzzy.ts` |
| `coucou` | `https://github.com/Louis-CFM/coucou` | MIT — Copyright (c) 2026 Louis Raillard | `595092b` | `NotchBuddy/Sources/CoucouKit/DiffEngine.swift` |

**Correcciones aplicadas** en `packages/tool-call-repair/LICENSE.md`:
`src/coercion.ts` sale de la tabla de derivados (es P) · la ruta de `balanced-json.ts` era
`packages/normalization-core/balanced-json.ts` (**no existía**; ahora `packages/normalization-core/src/balanced-json.ts`) ·
el commit `ce1ffb4` estaba **desactualizado** (ahora `0c7a83d`).

> **No se añade `NOTICE`**: la licencia es MIT y el aviso de copyright va dentro del propio
> `LICENSE.md` (que es lo que la cláusula MIT exige). El `packages/avatar/NOTICE` existe por
> tener **varios** upstreams y ficheros de licencia propios.

---

## 4. La puerta de atribución (tests nuevos de F2)

`packages/{tool-call-repair,ui-runtime,tools,domains,events}/test/attribution.test.ts`
(2 tests cada uno, **auto-mantenidos**: derivan el upstream y la licencia de las **propias**
cabeceras canónicas del paquete, así que no hay una lista que pueda desincronizarse):

1. *"ningún fichero afirma derivación sin la cabecera canónica"* — barre `src/`, lee las 60
   primeras líneas de cada fichero y falla si encuentra una fórmula de atribución
   (`Extraído y adaptado de`, `Adaptado de`, `Código **derivado**`, `Puerto literal`…) **sin**
   la línea `Adapted from …`. Descarta las **negaciones** ("sin atribución de código derivado"),
   que pueden estar partidas entre dos líneas.
2. *"todo fichero derivado está listado en el LICENSE.md con su upstream y su licencia"* — si el
   paquete **no** tiene código derivado, no exige `LICENSE.md` (no se crea ruido); si lo tiene,
   exige el fichero, la ruta, el upstream, la licencia y la ruta de origen.

**Verde**:
```text
packages/tool-call-repair test:  Test Files  1 passed (1)
packages/ui-runtime test:       Test Files  1 passed (1)
packages/tools test:            Test Files  1 passed (1)
packages/domains test:          Test Files  1 passed (1)
packages/events test:           Test Files  1 passed (1)
```

---

## 5. Solicitudes fuera de zona (con el texto exacto)

### 5.1 A5 (`docs/extractions/khoj.md` + `docs/review/backlog-khoj.md`) — el crédito a khoj

El código **ya no cita** `KHOJ-01..05` (F1). La ficha y el backlog deben dejar de
**afirmar** que el código de Ego viene de khoj. Texto exacto para `docs/extractions/khoj.md`
(la tabla de "Estado real verificado", líneas ~242-246):

```diff
-| `KHOJ-01` | Chunking por límite de tokens + dedupe por hash | ✅ Completada | `packages/knowledge/src/ingest/AdaptiveChunker.ts:16,42` → `DocumentParser.ts:4,17` y `MarkdownExtractor.ts:2,19` → `apps/desktop/src/main.ts:40,2238` → `apps/desktop/src/main/ipc/register-ipc.ts:1340-1341`. |
+| `KHOJ-01` | Chunking por límite de tokens + dedupe por hash | 🚫 Descartada (con justificación) | El código es **implementación propia de Ego** (`packages/knowledge/src/ingest/AdaptiveChunker.ts`): SHA-256 + solapamiento de 32 tokens + ruta de encabezados. El upstream usa MD5, cuenta palabras y solapamiento 0. Se estudió como **referencia de diseño, sin traducción de código** (EGO-FIND-83: retirado todo el crédito a khoj, AGPL-3.0). |
-| `KHOJ-02` | Parsers por formato | ✅ Completada | `packages/knowledge/src/ingest/DocumentParser.ts:12,53-71` y `MarkdownExtractor.ts:15,77-94` → `apps/desktop/src/main.ts:2238` → `register-ipc.ts:1340-1341`. Alcance asimilado: Markdown, texto plano, JSON y CSV (PDF y DOCX de Khoj no asimilados). |
+| `KHOJ-02` | Parsers por formato | 🚫 Descartada (con justificación) | **Implementación propia de Ego** (`packages/knowledge/src/ingest/DocumentParser.ts`, `MarkdownExtractor.ts`). Alcance asimilado: Markdown, texto plano, JSON y CSV (PDF y DOCX de khoj **no** asimilados). Patrón estudiado como referencia de diseño, sin traducción de código. |
-| `KHOJ-03` | Umbral de similitud | ✅ Completada | `packages/knowledge/src/filters/ScoreThresholdFilter.ts:22,27` → `packages/knowledge/src/HybridSearch.ts:88-89` → `apps/desktop/src/main.ts:33,2231` → `register-ipc.ts:1350`. **Rutas corregidas**: el fichero real es `ScoreThresholdFilter.ts` y el corte **no** se aplica en `EgoMemoryAdapter.searchMulti`. |
+| `KHOJ-03` | Umbral de similitud | 🚫 Descartada (con justificación) | El corte de umbral es una **calibración propia de Ego** (0.70 + normalización min-max por lote, etiqueta interna `H10`), no el `bi_encoder_confidence_threshold` del upstream. Implementación propia; patrón estudiado como referencia de diseño, sin traducción de código. |
-| `KHOJ-04` | `extract_facts_from_query` | 🚫 Descartada (con justificación) | 🚫 Sin consumidor: `packages/knowledge/src/extractors/FactExtractor.ts:62`. La escritura de hechos en producción es `packages/domains/src/knowledge/KnowledgeDomain.ts:128,168` (`kb/facts`). |
+| `KHOJ-04` | `extract_facts_from_query` | 🚫 Descartada (con justificación) | 🚫 Sin consumidor: `packages/knowledge/src/extractors/FactExtractor.ts:62`. La escritura de hechos en producción es `packages/domains/src/knowledge/KnowledgeDomain.ts:128,168` (`kb/facts`). El extractor es **implementación propia de Ego** (patrón estudiado, sin traducción de código). |
-| `KHOJ-05` | `ai_update_memories` | 🚫 Descartada (con justificación) | 🚫 El soft-replace no es alcanzable: `consolidateMemories` (`packages/knowledge/src/FactLifecycle.ts:183`) y `DreamConsolidator` / `MemoryCurator` sin instanciación en producción. Sólo el lado de lectura está vivo. |
+| `KHOJ-05` | `ai_update_memories` | 🚫 Descartada (con justificación) | 🚫 El soft-replace no es alcanzable: `consolidateMemories` (`packages/knowledge/src/FactLifecycle.ts:183`). **Actualización 2026-10-21 (A2-bis):** `DreamConsolidator` **ya está cableado** en producción (`packages/memory/EgoMemoryLifecycle.ts` → hook de inactividad de 5 min ⇒ dedup de `kb/facts` + purga de `quarantine/pending`, con evidencia en `gov/audit` acción `dream_consolidation`); el que sigue sin instanciar es `MemoryCurator` (se cablea con el diff de §6.3). El código es **implementación propia de Ego** (patrón estudiado, sin traducción de código). |
```

Y en `docs/review/backlog-khoj.md`: los **5** estados de la tabla de compuertas
(`KHOJ-01..05`) pasan a `🚫 Descartada (con justificación)` con el mismo texto, y la
**tabla de catálogo** de `docs/extractions/khoj.md` (líneas 218-222, columna "Ruta de
origen") deja de leerse como *"código de Ego tomado de aquí"*: la procedencia que se registra
es la del **upstream estudiado**, y el estado de la compuerta es "patrón asimilado,
implementación propia".

### 5.2 A3 (`packages/subegos/src/SelfImprovementLoop.ts`) — la última referencia `KHOJ-xx`

```diff
-// Basado en Principios Innegociables §1, §4 y compuerta KHOJ-05 (extracción de hechos y auto-reflexión).
+// Basado en Principios Innegociables §1, §4 y en el patrón de "extracción de hechos y
+// auto-reflexión" (estudiado en khoj — AGPL-3.0 — como referencia de diseño;
+// **implementación propia de Ego**, sin traducción de código).
```

### 5.3 A1 (`docs/VANTADB-FEEDBACK-Y-MEJORAS.md` + `docs/roadmap/Backlog.md`) — 2 rutas rotas + `VDB-REQ-02`

**(a) Rutas rotas por el movimiento del `DreamConsolidator`** — `node docs/testing/check-docs-paths.mjs` sale **exit 1** hasta que A1 aplique esto (**no lo he tocado: `docs/**` es zona de A1**):

```diff
--- a/docs/roadmap/Backlog.md
@@ línea 818 (fila TASK-08)
-| `TASK-08` | 🔴 Alta | **Consolidación Onírica en inactividad (Dream Consolidation)** | `packages/tasks/src/DreamConsolidator.ts` | …
+| `TASK-08` | 🔴 Alta | **Consolidación Onírica en inactividad (Dream Consolidation)** | `packages/memory/DreamConsolidator.ts` | …
@@ línea 1137 (fila EGO-FIND-22)
-| `EGO-FIND-22` | … | `packages/subegos/src/DelegationRuntime.ts:14` → `packages/tasks/src/DreamConsolidator.ts:32` → `packages/tasks/src/MemoryCurator.ts:1` | … | 🟡 Parcial | 0 instanciaciones en `src/` (verificado 2026-10-19)…
+| `EGO-FIND-22` | … | `packages/subegos/src/DelegationRuntime.ts:14` → `packages/memory/DreamConsolidator.ts:32` → `packages/tasks/src/MemoryCurator.ts:1` | … | ✅ Completada | **`DreamConsolidator` YA está cableado** (2026-10-21, A2-bis): el motor se movió a `packages/memory/DreamConsolidator.ts` (dirección de dependencias `tasks → memory`) y lo dispara `EgoMemoryLifecycle.runDreamConsolidation()` en el **hook de inactividad de 5 min** que ya estaba en producción (`syncTurn` → `scheduleDreamConsolidation`). **Evidencia**: registro inmutable `gov/audit` con acción `dream_consolidation` + estado del registro en `kb/facts` (`is_latest:false` / `superseded_by`). `DelegationRouter` ya estaba cableado. **`MemoryCurator` sigue sin instanciar**: su capacidad (marcar stale) **no es un duplicado** ⇒ se cablea con el diff de §5.4 (A4). |
```

**(b) `VDB-REQ-02` en `docs/VANTADB-FEEDBACK-Y-MEJORAS.md`** (el workaround ya está retirado):

```diff
-| `VDB-REQ-02` | … | ✅ RESUELTO | … Workaround en Ego: `query_vector: []` (VDB-REQ-02) …
+| `VDB-REQ-02` | … | ✅ RESUELTO | … **Workaround en Ego: ninguno** — retirado el 2026-10-21 (A2-bis, Ola 5 T3): `search` con `text_query` funciona **sin** `query_vector`; el guard de `VDB-BUG-05` se **conserva** (con `text_query: ""` y con `query_vector: []` la API **lanza**: exige un vector **no vacío**).
```

### 5.4 A4 (`apps/desktop/**`) — el diff para cablear `MemoryCurator` (T4)

**No es obligatorio para que la consolidación ocurra** (ésta ya corre sola, §6.1), pero sí
para que la **capacidad de marcar stale** de `MemoryCurator` ocurra. Precedente exacto:
`apps/desktop/src/main/subsystems/memory-cleanup.ts` (que instancia `MemoryCleanupJob`).

```diff
--- a/apps/desktop/src/main/subsystems/memory-curation.ts   (nuevo)
+/**
+ * Curaduría programada de memoria (CFG-08) — `@ego/tasks`.
+ *
+ * Precedente: `apps/desktop/src/main/subsystems/memory-cleanup.ts` (STAB-05).
+ *
+ * `MemoryCurator` marca como `superseded` (soft-replace, **nunca** borra) los
+ * registros stale de `kb/facts` y `kb/docs`, y deja la auditoría
+ * `curator_run` en `gov/audit`.
+ *
+ * ⚠️ **NO** se le pasa un `DreamConsolidator`: la consolidación ("sueño") ya
+ * la dispara `EgoMemoryLifecycle` en su hook de inactividad (§6.1). Pasárselo
+ * aquí consolidaría dos veces por el mismo ciclo.
+ */
+import type { EgoMemoryAdapter } from "@ego/memory";
+import { MemoryCurator, type CuratorRunStats } from "@ego/tasks";
+
+let curator: MemoryCurator | null = null;
+
+export function startMemoryCuration(
+  adapter: EgoMemoryAdapter,
+  options: { intervalHours?: number; staleAfterDays?: number } = {}
+): MemoryCurator {
+  curator?.stop();
+  curator = new MemoryCurator(adapter, {
+    intervalHours: options.intervalHours ?? 24,
+    staleAfterDays: options.staleAfterDays ?? 90,
+  });
+  curator.start((stats: CuratorRunStats) => {
+    console.warn(
+      `[MemoryCurator] corrida: stale=${stats.staleConsolidatedCount} ` +
+      `namespaces=${stats.staleNamespacesScanned.join(",")}`
+    );
+  });
+  return curator;
+}
+
+export function stopMemoryCuration(): void {
+  curator?.stop();
+  curator = null;
+}
```

```diff
--- a/apps/desktop/src/main/window/create-window.ts
+ import { startMemoryCuration } from "../subsystems/memory-curation.js";
@@ (junto al arranque del curator de STAB-06)
   lifecycle.startCuratorJob({ intervalMs: 60 * 60 * 1000, staleAfterDays: 30, maxSnapshots: 50 });
+  // CFG-08: curaduría programada (marca stale). Sin `DreamConsolidator`: el
+  // "sueño" lo dispara el lifecycle (ver @ego/memory).
+  startMemoryCuration(adapter, { intervalHours: 24, staleAfterDays: 90 });
```

> `MemoryCurator.start()` ya hace `unref()` del timer (corregido en esta ola): sin eso, el
> `setInterval` habría **impedido que Electron cerrase**.

### 5.5 A7 (`scripts/**`) — si quiere la puerta como ejecutable

La puerta de atribución de esta ola vive **dentro de cada paquete** (`test/attribution.test.ts`),
que es el patrón que ya usa `packages/avatar` (`packages/avatar/scripts/check-attribution.mjs`).
Si A7 quiere un ejecutable único que barre todos los paquetes, la especificación es:

```text
node scripts/check-attribution.mjs [--root <dir>] [--json]
```
- Recorre `packages/*/src/**` (excluye `packages/avatar/**`, que tiene su propia puerta).
- **Falla (exit 1)** si: (a) un fichero afirma derivación (`Extraído y adaptado de`,
  `Adaptado de`, `Código **derivado**`, `Puerto literal`) sin la línea canónica
  `// Adapted from <upstream> (<LICENCIA>), <ruta de origen>`; (b) un fichero con
  cabecera canónica no está listado en el `LICENSE.md` de su paquete, o su paquete no
  tiene `LICENSE.md`; (c) el `LICENSE.md` no declara el upstream, la licencia o la ruta
  de origen que dice la cabecera canónica.
- Las **negaciones** ("sin atribución de código derivado") no son afirmaciones: se ignoran,
  y se buscan en una ventana de ±2 líneas (pueden estar partidas entre dos líneas).

---

## 6. T4 — La consolidación de hechos: **qué se observa** tras un ciclo

### 6.1 La evidencia (lo que se puede demostrar)

El ciclo de consolidación **ocurre** y deja tres rastros observables:

| # | Evidencia | Dónde | Cómo se comprueba |
|---|---|---|---|
| **1** | **Registro inmutable en `gov/audit`** con `action: "dream_consolidation"` y las estadísticas del ciclo (`scannedCount`, `deduplicatedCount`, `supersededCount`, `quarantinePurgedCount`, `parseErrors`, `truncated`, `timestamp`) | `EgoMemoryLifecycle.runDreamConsolidation()` → `adapter.recordAudit(...)` | `adapter.list("gov/audit")` filtrando `metadata.audit_action === "dream_consolidation"`, o la IPC `ipc.decision.listAudits` |
| **2** | **El estado del registro consolidado**: el duplicado queda `is_latest: false` + `superseded_by: <canónico>` en el **payload** y `state: "superseded"` en el **metadato**; el canónico queda `state: "active"` + `is_latest: true` | `kb/facts` | `adapter.get("kb/facts", <clave>)` |
| **3** | **La purga de la cuarentena expirada**: los registros con `expiresAt` vencido desaparecen de `quarantine/pending` | `quarantine/pending` | `adapter.list("quarantine/pending")` |

> El **disparador** es la **inactividad**: `syncTurn` programa el ciclo para dentro de
> `dreamIdleDelayMs` (5 min) y **reinicia el temporizador en cada turno** ⇒ el ciclo corre
> cuando el sistema lleva un rato sin actividad. Si se invoca a mano con actividad
> reciente, el ciclo **se salta** (`skippedNotIdle: true`) y **no** deja rastro de
> consolidación.

### 6.2 El cableado (por qué no hace falta tocar `apps/**`)

```text
turno del LLM (handle-llm-stream.ts:542)
  → EgoMemoryLifecycle.syncTurn(...)            [packages/memory]
      → persiste el turno en session/turns
      → this.lastActivityAt = Date.now()          ← actividad
      → scheduleDreamConsolidation()              ← temporizador de 5 min (unref)
          … 5 min sin turnos …
          → runDreamConsolidation()
              1. refuerzo hebbiano      → gov/audit "dream_consolidation_reinforce"
              2. DreamConsolidator.runCycle()
                   · purga quarantine/pending expirados
                   · dedup de kb/facts por firma normalizada (canónico = mayor timestamp)
                   · el resto → state:"superseded", is_latest:false, superseded_by
              3. gov/audit "dream_consolidation"   ← EVIDENCIA
```

**El `DreamConsolidator` se movió de `packages/tasks/src/` a `packages/memory/`** por la
**dirección de dependencias**: `packages/tasks` depende de `@ego/memory`, no al revés; con el
motor en `packages/memory`, `EgoMemoryLifecycle` puede usarlo **sin** crear un ciclo. El
API público de `@ego/tasks` **no se rompe**: `packages/tasks/src/index.ts` re-exporta
`DreamConsolidator` desde `@ego/memory`.

### 6.3 Veredicto de `MemoryCurator`: **(a) una capacidad que falta** → se cablea

**No es un duplicado.** Lo que hace y quién lo hace:

| Capacidad de `MemoryCurator` | ¿La hace otro módulo? |
|---|---|
| Marcar **stale** (`kb/facts`, `kb/docs`) como `superseded` (soft-replace, **sin borrar**) | **Nadie**. `SessionRetention.pruneStaleSessions` **borra** sesiones/turnos (otro namespace, otro criterio); el curator STAB-06 (`EgoMemoryLifecycle.runCuratorConsolidation`) **crea** facts desde turnos; el "sueño" **deduplica**. |
|Auditoría `curator_run` en `gov/audit` | Única (la del sueño es `dream_consolidation`). |
| Purga de `quarantine/pending` | **Delegada** al `DreamConsolidator`, que ya tiene dueño (el lifecycle). |

⇒ **Se cablea** (diff exacto en §5.4). Y para que el "sueño" tenga **un solo dueño**, el
producto **no** le pasa un `DreamConsolidator` al curator (si se lo pasa, consolidaría dos
veces por ciclo). Eso queda **documentado** en el propio `MemoryCurator`.

**Correcciones aplicadas en `packages/tasks/src/MemoryCurator.ts`** (esta ola):
`setInterval` **sin `unref()`** → lo tenía (habría impedido que Electron cerrase) y
**`.catch(() => {})` mudo** → ahora avisa por `console.warn`.

### 6.4 Los dos fallos que había que arreglar (ya estaban arreglados — verificado)

El encargo citaba dos defectos del `DreamConsolidator` en la Ola 1. **Ambos estaban ya
corregidos** en el árbol (T10 de la Ola 1) y sus tests los cubren; **verificado**:

| Defecto | Estado real (verificado en el código y en los tests) |
|---|---|
| `catch {}` externo que **abortaba todo el lote** ante un `JSON.parse` fallido | **Corregido**: el parseo es **por registro** (`DreamConsolidator.ts`, bloque 2 de `runCycle`): un payload corrupto cuenta `parseErrors++` y hace `continue`; el resto del lote se consolida. Test: *"un payload corrupto NO aborta el lote: se cuenta como parseError (T10)"*. Los `catch` externos ya **no están mudos**: registran con `console.warn`. |
| `seenSignatures` que **se reiniciaba por ciclo** dejando `is_latest:true` obsoleto | **Corregido**: la verdad vive en el **metadato persistido** (`state`, `is_latest`, `superseded_by`), no en un `Map` en memoria. Cada barrido recalcula la versión vigente de cada firma y el resto queda `superseded`; una firma única marcada `superseded` en un ciclo previo **se restaura**. Tests: *"el dedup es PERSISTENTE entre ciclos…"* y *"un fact marcado superseded en un ciclo previo se restaura si queda único (T10)"*. |

**Los he movido y re-verificado** (el motor ahora vive en `packages/memory/`), y he añadido
la prueba del **cableado** (§6.1).

### 6.5 TDD — rojo → verde (pegado)

**ROJO (antes de cablear)** — `packages/memory/test/dream-consolidation-wiring.test.ts`:
```text
 ❯ test/dream-consolidation-wiring.test.ts (5 tests | 5 failed) 30ms
   × (1) el ciclo de sueño deduplica los facts: el duplicado queda is_latest:false
 TypeError: Cannot read properties of undefined (reading 'deduplicatedCount')
   × (2) un payload corrupto NO aborta el resto del lote
 TypeError: Cannot read properties of undefined (reading 'parseErrors')
   × (3) la consolidación deja EVIDENCIA consultable en gov/audit
 AssertionError: no hay evidencia de que la consolidación ocurriera: expected undefined to be defined
   × (4) el ciclo purga la cuarentena expirada
 TypeError: Cannot read properties of undefined (reading 'quarantinePurgedCount')
   × (5) si el sistema NO está idle, el ciclo NO se ejecuta
 AssertionError: expected undefined to be true // Object.is equality
 Test Files  1 failed (1)
      Tests  5 failed (5)
```

**VERDE (después)**:
```text
 ✓ test/dream-consolidation-wiring.test.ts (6 tests) 109ms
 Test Files  1 passed (1)
```

**ROJO de la puerta de atribución** (antes de normalizar las cabeceras):
```text
 ❯ test/attribution.test.ts (2 tests | 1 failed)
 FAIL  test/attribution.test.ts > ningún fichero afirma derivación sin la cabecera canónica
 AssertionError: expected [ 'src\coercion.ts' ] to deeply equal []
 FAIL  test/attribution.test.ts > ningún fichero afirma derivación sin la cabecera canónica
 AssertionError: expected [ 'src\native\git\GitParser.ts', …(1) ] to deeply equal []
 FAIL  test/attribution.test.ts > ningún fichero afirma derivación sin la cabecera canónica
 AssertionError: expected [ 'src\MermaidRenderer.ts' ] to deeply equal []
```

**VERDE de la puerta**: los 5 paquetes en verde (§4).

---

## 7. Verificación

| Comando | Exit | Resumen |
|---|---|---|
| `pnpm --filter @ego/{memory,tasks,runtime,events,knowledge,models,decision,execution,security,tool-call-repair,domains,ui-runtime,tools} test` | **0** | **164 ficheros, 0 fallos** (memory 23 · knowledge 22 · tools 20 · ui-runtime 15 · domains 14 · runtime 17 · models 12 · decision 12 · execution 10 · events 9 · security 8 · tool-call-repair 2) |
| `pnpm -r typecheck` | **0** | 0 errores en el monorepo (incluye `tests/` y `apps/desktop`) |
| `pnpm lint` | **0** | oxlint + typecheck |
| `node scripts/verify-vantadb-ids.mjs` | **0** | 950 ficheros · 85 referencias · **0 errores** · 2 avisos W2 preexistentes (`VDB-REQ-08`/`VDB-REQ-09`, upstream) |
| `node scripts/check-docs-lint.mjs` | **0** | *"gate OK: ninguna violación nueva en docs canónicos ni documentos mal formados"* |

---

## 8. RESULTADO

```text
RESULTADO: {
  agente: A2-bis,
  status: COMPLETO,
  scope: "Ola 8 — F1 (EGO-FIND-83: crédito a khoj) + F2 (clasificación D/P/N) + F3 (LICENSE.md) + F4 (DreamConsolidator cableado + veredicto de MemoryCurator) + F5 (puertas y verificación)",
  archivos_nuevos: [
    "packages/memory/DreamConsolidator.ts            (movido de packages/tasks/src/)",
    "packages/memory/test/DreamConsolidator.test.ts  (movido de packages/tasks/test/)",
    "packages/memory/test/dream-consolidation-wiring.test.ts   ← TDD del cableado",
    "packages/ui-runtime/LICENSE.md                   ← F3",
    "packages/tools/LICENSE.md                        ← F3",
    "packages/{tool-call-repair,ui-runtime,tools,domains,events}/test/attribution.test.ts  ← F2 (puerta, 5 paquetes)"
  ],
  archivos_modificados: [
    "packages/knowledge/src/{schemas/knowledge.ts,ingest/AdaptiveChunker.ts,filters/ScoreThresholdFilter.ts,HybridSearch.ts,FactLifecycle.ts,extractors/FactExtractor.ts}",
    "packages/knowledge/test/{AdaptiveChunker,HybridSearch,QuarantineAndLifecycle,ScoreThresholdFilter}.test.ts",
    "packages/memory/{EgoMemoryLifecycle.ts,OpaqueId.ts,index.ts}",
    "packages/tasks/src/{MemoryCurator.ts,index.ts}",
    "packages/tasks/test/MemoryCurator.test.ts",
    "packages/tool-call-repair/{src/{balanced-json,coercion,grammar}.ts,LICENSE.md}",
    "packages/tools/src/native/{git/{ChangeSetService,GitParser,SessionDiffRevisions}.ts,fs/FileLockManager.ts}",
    "packages/tools/LICENSE.md",
    "packages/ui-runtime/src/{AnsiParser,FuzzySearch,MockIPCBridge,WindowState,MermaidRenderer}.ts",
    "packages/ui-runtime/LICENSE.md",
    "packages/domains/src/{IntervalSet,WorkboardContract}.ts",
    "packages/events/src/{ApprovalIdentity,InteractionTransport,ToolActivityEmitter}.ts",
    "packages/execution/src/{WidgetHitlBridge,ZeroContextKernel}.ts",
    "packages/runtime/src/ContextCompaction.ts"
  ],
  f1_credito_khoj: {
    antes: "17 referencias `KHOJ-xx` en 6 ficheros de la zona",
    ahora: "0",
    verdad_sustituida: "cada referencia pasa a 'implementación propia de Ego' + el matiz 'el patrón se estudió en khoj (AGPL-3.0) como referencia de diseño, sin traducción de código' (mecanismo, no código)",
    fuera_de_mi_zona: "1 referencia en packages/subegos/src/SelfImprovementLoop.ts:2 → texto exacto para A3 en §5.2"
  },
  f2_clasificacion: {
    D_derivados: [
      "packages/tool-call-repair/src/balanced-json.ts ← openclaw (MIT) packages/normalization-core/src/balanced-json.ts",
      "packages/tool-call-repair/src/grammar.ts ← openclaw (MIT) packages/tool-call-repair/src/grammar.ts",
      "packages/ui-runtime/src/AnsiParser.ts ← hermes-agent (MIT) apps/desktop/src/lib/ansi.ts",
      "packages/ui-runtime/src/FuzzySearch.ts ← hermes-agent (MIT) apps/shared/src/fuzzy.ts",
      "packages/tools/src/native/git/ChangeSetService.ts ← coucou (MIT) NotchBuddy/Sources/CoucouKit/DiffEngine.swift"
    ],
    P_patrones_asimilados: 22,
    N_nativos_revisados: 3,
    total_clasificado: 27,
    recuento: "D=5 · P=22 · N=3",
    cabeceras_canonicas_por_paquete: "tool-call-repair 2 · ui-runtime 2 · tools 1 → TOTAL 5 (avatar 59, de A6)",
    metodo: "comparación contra el clon real (repos-referencia/): fichero de origen, LICENSE, remote y commit; superficie exportada + similitud de trigramas (0,726 / 0,723 / 0,756 en los D)",
    afirmaciones_falsas_corregidas: [
      "packages/tool-call-repair/src/coercion.ts (las heurísticas no tienen equivalente en el upstream)",
      "packages/execution/src/ZeroContextKernel.ts (el upstream es un kernel Python persistente)",
      "packages/tools/src/native/git/SessionDiffRevisions.ts (merge-base vs SHA base de sesión)",
      "packages/ui-runtime/src/MermaidRenderer.ts (el upstream renderiza SVG; aquí hay un validador estático)",
      "packages/domains/src/WorkboardContract.ts (esquema de estados propio)",
      "packages/events/src/ToolActivityEmitter.ts (la ruta citada no existe en el clon)"
    ]
  },
  f3_license_md: {
    creados: ["packages/ui-runtime/LICENSE.md (hermes-agent MIT)", "packages/tools/LICENSE.md (coucou MIT)"],
    actualizados: ["packages/tool-call-repair/LICENSE.md — coercion.ts sale de derivados; rutas corregidas; commit ce1ffb4 → 0c7a83d"],
    no_creados: "los 15 paquetes restantes (sin código derivado ⇒ un LICENSE.md sería ruido)",
    total_con_license_md: "packages/{avatar,tool-call-repair,tools,ui-runtime}"
  },
  t4_consolidacion: {
    cableado: "EgoMemoryLifecycle.runDreamConsolidation() — el hook de inactividad de 5 min que YA estaba en producción (syncTurn → scheduleDreamConsolidation). Cero cambios en apps/**.",
    motor_movido: "packages/tasks/src/DreamConsolidator.ts → packages/memory/DreamConsolidator.ts (dirección de dependencias: tasks → memory). El API público de @ego/tasks se conserva (re-export).",
    evidencia: "gov/audit con action 'dream_consolidation' (estadísticas del ciclo) + estado del registro en kb/facts (is_latest:false / superseded_by / state:'superseded') + purga de quarantine/pending expirados",
    disparador: "inactividad del sistema (5 min sin turnos); si hay actividad reciente el ciclo se salta (skippedNotIdle) y no deja rastro",
    bugs_corregidos_antes: "los dos (parseo por registro + estado persistido en metadato) YA estaban corregidos en T10 de la Ola 1; verificados con sus tests, no reintroducidos",
    bugs_corregidos_ahora: [
      "MemoryCurator.start(): el setInterval no tenía unref() → habría impedido que Electron cerrase",
      "MemoryCurator.start(): el catch(() => {}) mudo → ahora console.warn"
    ],
    veredicto_memory_curator: "(a) CAPACIDAD QUE FALTA → se cablea (no es duplicado: 'marcar stale' no lo hace nadie más; el sueño ya tiene dueño y no se le pasa un DreamConsolidator). Diff exacto para A4 en §5.4."
  },
  verify: {
    tests: "164 ficheros / 0 fallos en la zona (memory 23 · knowledge 22 · tools 20 · ui-runtime 15 · domains 14 · runtime 17 · models 12 · decision 12 · execution 10 · events 9 · security 8 · tool-call-repair 2)",
    typecheck: "exit 0 (`pnpm -r typecheck`, monorepo completo)",
    lint: "exit 0 (`pnpm lint`)",
    vantadb_ids: "exit 0 (950 ficheros · 85 referencias · 0 errores · 2 avisos W2 preexistentes upstream)",
    docs_lint: "exit 0 (`node scripts/check-docs-lint.mjs`: gate OK)",
    tdd_rojos_demostrados: [
      "T4 cableado → 5/5 fallos (`Cannot read properties of undefined (reading 'deduplicatedCount')`, `expected undefined to be defined` para la evidencia)",
      "F2 puerta de atribución → 1/2 fallos por paquete (`expected [ 'src\\coercion.ts' ] to deeply equal []`, `expected [ 'src\\MermaidRenderer.ts' ] to deeply equal []`)",
      "T4 → 6/6 verde tras el cableado; F2 → 5/5 paquetes verde"
    ]
  },
  fuera_de_zona: [
    "A5 (§5.1): el texto exacto para las 5 filas de khoj (KHOJ-01..05) en docs/extractions/khoj.md y docs/review/backlog-khoj.md — incluido el cambio de estado de `DreamConsolidator`/`MemoryCurator` en KHOJ-05, que ya no es cierto",
    "A3 (§5.2): la última referencia `KHOJ-05` en packages/subegos/src/SelfImprovementLoop.ts:2",
    "A4 (§5.4): el diff para cablear MemoryCurator (subsistema nuevo + 1 llamada en create-window.ts). NO es necesario para que la consolidación ocurra",
    "A1 (§5.3): el texto de VDB-REQ-02 (workaround ya retirado) en docs/VANTADB-FEEDBACK-Y-MEJORAS.md **y** las 2 rutas del Backlog que rompió el movimiento del DreamConsolidator (`packages/tasks/src/DreamConsolidator.ts` → `packages/memory/DreamConsolidator.ts`) — `check-docs-paths.mjs` sale exit 1 hasta que se apliquen",
    "A7 (§5.5): la especificación del ejecutable `scripts/check-attribution.mjs` (si lo quiere único para todos los paquetes; ahora la puerta vive dentro de cada paquete, como en packages/avatar)"
  ],
  debt: [
    "packages/subegos/src/SelfImprovementLoop.ts:2 conserva `KHOJ-05` (zona de A3) — hasta que A3 lo aplique queda 1 referencia `KHOJ-xx` en el repo",
    "`node docs/testing/check-docs-paths.mjs` sale exit 1 por 2 rutas del Backlog que apuntan al path ANTIGUO del `DreamConsolidator` (docs/** = zona de A1): el diff exacto está en §5.3(a)",
    "El espejo de cabeceras canónicas se mantiene a mano en 5 ficheros: si upstream cambia la ruta, la cabecera queda obsoleta hasta la siguiente revisión (la puerta sólo detecta AFIRMACIONES, no rutas obsoletas)",
    "La atribución vive en el propio `LICENSE.md` de cada paquete (no en un manifiesto como el de packages/avatar): es más simple, pero no hay una fuente única agregada"
  ]
}
```
