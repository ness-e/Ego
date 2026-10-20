---
title: "Matriz de contraste: documento maestro de 22 secciones vs Ego"
kind: research
status: active
description: "Estado verificado de cada sección del documento maestro externo frente al código de Ego, con evidencia, conflicto ADR y tarea de cierre"
tags: [arquitectura, research]
supersedes: null
superseded_by: null
---

> **Documento de contraste:** [`Arquitectura y Diseño de Sistemas para Plataformas y Agentes de IA.md`](./Arquitectura%20y%20Dise%C3%B1o%20de%20Sistemas%20para%20Plataformas%20y%20Agentes%20de%20IA.md) — research externo, **NO normativo**.
> **Fecha de verificación:** 2026-10-19 · **Verificador:** A8 · **Ola:** 1 de remediación (Bloques 0+A+B+C+D), estado post-ola.
> **Referencia de descarte:** [`docs/adr/0011-stab14-asimilados-descartes.md`](../adr/0011-stab14-asimilados-descartes.md).
> **Alcance del documento maestro:** NO es una especificación de Ego. Describe una plataforma cloud omnicanal (Tauri v2, daemon 24/7, PostgreSQL/pgvector/Qdrant, MicroVMs Firecracker, WebRTC, SSR, omnicanal de mensajería) mayoritariamente **descartada formalmente por ADR-0011** y por los 10 principios innegociables de `AGENTS.md`.

## Cómo leer esta matriz #

| Columna | Significado |
| --- | --- |
| **Estado** | `✅ Implementado` · `🟡 Parcial` · `❌ Ausente` · `🚫 Descartado por decisión` · `➖ No aplica (desktop local-first)` |
| **Conflicto con ADR-0011** | `Sí` = el requisito está formalmente descartado → **no es deuda de Ego**. `No` = no descartado → **brecha real**. `Parcial` = parte descartada, parte vigente. |
| **Tarea que lo cierra** | `E<n>` = Bloque E de la Ola 2 (ver §5). `—` = no aplica. `A<n>` = cierre en curso en la Ola 1. `DIST-xx` = backlog de distribución con bloqueo de owner. |
| **Bloque** | `E` = Ola 2 (motor y deuda P2) · `A7` = Ola 1 en curso · `—` = cerrado o no aplica |

**Cifras de alineación (defensa explícita).** Medir contra las 22 secciones completas infla la nota:
la cifra honesta tiene dos cortes — **bruto** (todo el documento) y **adaptado** (el subconjunto que Ego
decidió adoptar tras los descartes de ADR-0011). La cifra **51 %** y la **68 %** que circulaban en
informes previos son sobreestimaciones: no descontaron los bloques formalmente descartados ni
penalizaron que dos de los siete commits del Plan P0 arreglaran código nunca instanciado.

---

## 1. Matriz de las 22 secciones #

| # | Sección | Estado | Evidencia (archivo:línea) | Conflicto con ADR-0011 | Tarea que lo cierra | Bloque |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Taxonomía de los 8 referentes | ➖ No aplica (desktop local-first) | `docs/research/Arquitectura y Diseño de Sistemas para Plataformas y Agentes de IA.md:9-18` | No (descriptivo, no es requisito de código) | — | — |
| 2 | Componentes esenciales: Router, memoria CoALA, sandbox, MCP | 🟡 Parcial | Router `packages/models/src/ModelRouter.ts:262-544` · memoria `packages/memory/EgoMemoryAdapter.ts:244-1290` · GraphRAG `packages/knowledge/src/GraphRagEngine.ts:284-320` · MCP `packages/integrations/src/mcp/McpClient.ts:476-486` · sandbox `packages/execution/src/ZeroContextKernel.ts:111` | Parcial — sandbox cloud/microVM descartado (`0011:33-34`); `node:vm` es la adaptación local legítima | E2 (RRF y path cognitivo nativo) | E |
| 3 | Capacidades funcionales core (ReAct, self-healing, proactividad, fan-out) | 🟡 Parcial | ReAct `packages/runtime/src/ToolExecutionLoop.ts:373-462` · self-healing `packages/runtime/src/ToolExecutionLoop.ts:436-440` · proactividad `apps/desktop/src/main.ts:224,2358` · fan-out de subagentes `packages/subegos/src/DelegationRouter.ts:904` | No | E1 (tool calls en paralelo) | E |
| 4 | Integraciones y Skills (MCP, GitHub, PTY, watchers, omnicanal) | 🟡 Parcial | MCP `packages/integrations/src/mcp/McpClient.ts:34-39` · GitHub `packages/integrations/src/github/GitHubMcpConnector.ts:44` · Skills `packages/integrations/src/skills/SkillScanner.ts:98` · watchers `apps/desktop/src/main.ts:2358` | Sí para omnicanal y PTY (`0011:36`) | E3 (binarios MCP embebidos) · E13 (skills con divulgación progresiva) | E |
| 5 | UX/UI: Canvas dual, inspector de tareas, HITL, voz, daemon | 🟡 Parcial | Canvas `apps/desktop/renderer/components/canvas/EditorView.tsx:4-11` · HITL con edición de args `apps/desktop/renderer/components/tools/ApprovalCard.tsx:250-263` · voz ausente · daemon ausente | Sí para daemon y voz externa (`0011:36-37`) | E3-opcional (voz) | E |
| 6 | Internal Tooling Suite (fs, git, terminal, browser, REPL, exportadores) | 🟡 Parcial | fs/git/terminal `packages/tools/src/native/` · allowlist de terminal `packages/tools/src/native/terminal/TerminalCommandPolicy.ts:288-331` · background `packages/tasks/src/BackgroundTaskTools.ts` · browser ausente · REPL Python ausente · exportadores ausentes | No | E4 (exportadores + REPL) | E |
| 7 | Entregables de producción (PDF, DOCX, XLSX, PPTX, web apps) | ❌ Ausente | 0 coincidencias de `render_pdf`, `generate_docx`, `generate_xlsx`, `generate_pptx` en `packages/` y `apps/`; única exportación real `apps/desktop/renderer/components/ego-chat.tsx:1427` (Markdown) | No | E4 | E |
| 8 | Configuración, políticas y gobernanza (permisos, credenciales, secret proxy, budgets) | 🟡 Parcial | permisos `packages/security/src/ToolPermissions.ts:299-395` · credenciales `packages/security/src/CredentialManager.ts:335` · secret proxy `packages/integrations/src/mcp/SecretProxy.ts:32-120` + resolución `packages/integrations/src/mcp/McpClient.ts:486,663` · `SOUL.md` ausente · budgets ausentes | No | E5 (identidad declarativa + circuit breakers) | E |
| 9 | System Design: 6 capas + 10 fases del ciclo de vida | 🟡 Parcial | IPC tipado `apps/desktop/src/ipc/schema.ts` · EventBus `packages/events/` · loop `apps/desktop/src/main.ts:189,1442` · capa 2 (gateway WS) inexistente · capa 5 = `node:vm` | Parcial — capa 5 cloud descartada | E6 (descomposición de `main.ts`) | E |
| 10 | Multi-agente: 5 patrones de orquestación | 🟡 Parcial | supervisor-worker y fan-out `packages/subegos/src/DelegationRouter.ts:381-394,904` · cableado en producción `apps/desktop/src/main.ts:193` · DAG secuencial y generador-crítico ausentes | No | E13 (ejecutor real en delegación) | E |
| 11 | Seguridad agéntica y defenses contra inyección indirecta | 🟡 Parcial | taint + canal dual `packages/runtime/src/TrustBoundary.ts:20-128` · guard en el loop `packages/runtime/src/ToolExecutionLoop.ts:335,500-522` · sanitizador que neutraliza las 11 tags de control `packages/memory/UntrustedContentSanitizer.ts:30,196-198` · DOMPurify y CSP `img-src` ausentes | **No — brecha real** (era ❌ antes de la ola) | E7 (DOMPurify + CSP) | E |
| 12 | Observabilidad, trazabilidad y evals | 🟡 Parcial | EventBus y trazas `packages/events/` · detector de bucles `apps/desktop/src/main.ts:2305-2334` · OpenTelemetry y Langfuse ausentes · benchmarks ausentes | No (el EventBus propio satisface el principio `AGENTS.md` §2; OTel es FORMATO, no requisito) | E8 (OTel + sink de disco) | E |
| 13 | Coste y latencia: prompt caching, model cascading | 🟡 Parcial | `cache_control` real en Anthropic `packages/models/test/ModelRouter-resilience.test.ts:388-450` · cascada de fallback `packages/models/src/ModelRouter.ts:484-544` · PromptAssembly 3-capas `packages/subegos/src/PromptAssembly.ts` | No | — (cerrado en Ola 1) | — |
| 14 | Infraestructura de sandboxes en la nube a escala | 🚫 Descartado por decisión | `docs/adr/0011-stab14-asimilados-descartes.md:33-34` · sin infra cloud en el repo | **Sí** — guardrail `AGENTS.md` §4 (Node 22 + VantaDB nativo) | — | — |
| 15 | Distribución, empaquetado y monetización | 🟡 Parcial | installer Electron `apps/desktop/electron-builder.config.cjs` · BYOK `packages/security/src/CredentialManager.ts:335` · **uv/bun NO embebidos** `packages/integrations/src/mcp/McpClient.ts:34-39` · firma ausente | Parcial — Electron es alternativa válida en la propia tabla del documento (§15.1) | E3 · DIST-04 / DIST-06 / DIST-09 | E |
| 16 | Hoja de ruta en 4 fases | 🟡 Parcial | Fase 1 y 2 cumplidas · Fase 3 parcial (Canvas dual sin voz/daemon) · Fase 4 parcial (sin Postgres/Qdrant, con RRF pendiente) | Sí en las fases 3-4 (Tauri, daemon, omnicanal, Postgres) | E2 · E6 | E |
| 17 | Investigación UX, arquitectura de información de 3 zonas, journeys | 🟡 Parcial | 3 zonas `apps/desktop/renderer/src/App.tsx` · omnibar Cmd+K · HITL flow completo · onboarding <60 s ausente · time-travel ausente | No | E9 (time-travel y bifurcación) | E |
| 18 | Identidad visual, OKLCH, tipografía, DESIGN.md | 🟡 Parcial | tokens **OKLCH** (32 literales `oklch`) `apps/desktop/renderer/src/styles/theme-tokens.css:32-72` con rampa de superficie y contrato de contraste en `docs/design/DESIGN.md` · `apps/desktop/renderer/src/index.css:21-53` conserva 36 hex de fallback · 6 hallazgos AA vivos `apps/desktop/renderer/test/a11y.test.tsx` · sin `prefers-contrast` ni `@container` | No | E10 (OKLCH + 6 hallazgos AA + DESIGN.md raíz) | E |
| 19 | Maquetación pixel-perfect, responsive, microinteracciones | 🟡 Parcial | 44px verificado en todo el renderer `apps/desktop/renderer/test/Targets44.test.tsx:95-213` · split panes · `@container` ausente · `prefers-contrast` ausente | No | E10 | E |
| 20 | Componentes, estado en 4 capas, enrutamiento | 🟡 Parcial | ui-kit + Zustand + Cmd+K · registry dinámico `apps/desktop/renderer/components/canvas/registry.ts:85-116` · CRDT/Yjs ausente · deep-linking ausente | No | E11 (CRDT + deep linking) | E |
| 21 | APIs en tiempo real, seguridad frontend, 60-120 FPS | 🟡 Parcial | Web Worker `apps/desktop/renderer/workers/shiki.worker.ts` · virtualización correcta `apps/desktop/renderer/components/chat/ChatMessageList.tsx:82-116` · iframe loopback `apps/desktop/renderer/components/canvas/BrowserView.tsx:80-103` · DOMPurify y CSP ausentes | No | E7 | E |
| 22 | Accesibilidad WCAG 2.2 y pirámide de testing | 🟡 Parcial | axe en RTL `apps/desktop/renderer/test/a11y.test.tsx` · `prefers-reduced-motion` soportado · contraste WCAG determinista · **11 specs E2E con `describe.skip`** `tests/gui/specs/02-streaming.spec.ts:17` y 10 más · Storybook, MSW y Lighthouse CI ausentes | No | A7 (E2E real) · E12 (pirámide de tests) | A7 / E |

### Resumen de la matriz #

| Estado | Secciones | Nº |
| --- | --- | --- |
| ✅ Implementado | — | **0** |
| 🟡 Parcial | 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22 | **19** |
| ❌ Ausente | 7 | **1** |
| 🚫 Descartado por decisión | 14 | **1** |
| ➖ No aplica | 1 | **1** |

> **Ninguna sección llega a `✅ Implementado`.** La razón es estructural, no de ejecución: cada sección
> del documento maestro enumera 5-10 requisitos y Ego cumple entre 2 y 6. El único ❌ absoluto (§7,
> entregables de producción) y el único 🚫 (§14) son los extremos.

### Alineación estimada (dos cortes, defendibles) #

| Corte | Denominador | Resultado | Cómo se obtiene |
| --- | --- | --- | --- |
| **Bruto** | 20 secciones aplicables (excluye §1 ➖ y §14 🚫) | **~43 %** | ✅=1.0 · 🟡≈0.5 · ❌=0.0, con ponderación por número de sub-requisitos cumplidos de cada sección |
| **Adaptado al alcance Ego** | 18 secciones tras descontar cloud/omnicanal/Tauri/Postgres/SSR | **~62 %** | Igual, pero §2, §4, §5, §9, §14, §15, §16 se puntúan solo por sus sub-requisitos no descartados |

> **Recálculo 2026-10-20 (tras la Ola 1b y la 1c).** El **vector de estados no ha
> cambiado** — sigue siendo 0 ✅ / 19 🟡 / 1 ❌ (§7) / 1 🚫 (§14) / 1 ➖ (§1) — y por
> tanto **las dos cifras se mantienen: ~43 % bruto y ~62 % adaptado**. Dos secciones
> suben en *sub-requisitos cumplidos* sin cambiar de estado (ninguna pasa de 🟡 a ✅):
> **§11** cierra la pata del sanitizador (`UntrustedContentSanitizer` neutraliza ya
> las 11 tags de control) y **§18** cierra las patas de OKLCH y `DESIGN.md`. Ninguna de
> las dos alcanza el ✅ porque §11 sigue sin DOMPurify/CSP `img-src` y §18 sigue con los
> 6 hallazgos AA vivos, sin `prefers-contrast` y sin `@container`.

**Contra las cifras previas:** el **51 %** no es defendible (no descontó los bloques descartados por ADR-0011
y puntuó §14 como si fuera una brecha). El **68 %** no es defendible bajo ninguna ponderación razonable
(exige tratar 19 secciones 🟡 como ≥0.75, imposible cuando 4 bloques de capacidad completa faltan:
exportadores, voz, CRDT, OTel).

---

## 2. Re-verificación de las 23 afirmaciones del informe previo (post-ola) #

**Fecha de verificación:** 2026-10-19. Cada afirmación se releyó en el código actual.

| # | Afirmación previa | Estado | Evidencia actual |
| --- | --- | --- | --- |
| 1 | "GraphRAG no consulta la BD" | **Refutada** | `packages/knowledge/src/GraphRagEngine.ts:193` (`adapter.get(ns, key)`) y path nativo `graphragSearch` `:284-320` sobre `EgoMemoryAdapter.graphRagSearch` (`packages/memory/EgoMemoryAdapter.ts:1100`) |
| 2 | "El descubrimiento de arista sigue heurístico (metadata + regex)" | **Refutada** (arista nativa) | `packages/knowledge/src/GraphRagEngine.ts:284-320` usa `adapter.graphRagSearch("kb/docs", query)`; el camino heurístico `extractNodeReferences` queda como **fallback** `:345` |
| 3 | "`query_vector: []` es un bug" | **Refutada** | Workaround upstream registrado `VDB-REQ-02` en `packages/memory/EgoMemoryAdapter.ts:707-709,744-745`. **No es bug; no vuelve** |
| 4 | "HybridSearch sin RRF" | **Confirmada** | `packages/knowledge/src/HybridSearch.ts:76-85` — re-rank mono-lista honesto, sin fusión RRF canónica |
| 5 | "MMR con Jaccard, no coseno" | **Refutada** | `packages/knowledge/src/similarity.ts:43` (`cosineTermSimilarity`) + `packages/knowledge/test/HybridSearch-mmr.test.ts:77-88` |
| 6 | "DreamConsolidator ignora lo que pase de 50" | **Refutada** (paginación real) | `packages/tasks/src/DreamConsolidator.ts:68-87` → `EgoMemoryAdapter.listPaged` `:605-631` → `db.list({namespace, limit, cursor})` |
| 7 | "DreamConsolidator es código muerto" | **Confirmada** | `new DreamConsolidator` / `new MemoryCurator`: **0 en `src/`**. Solo `packages/tasks/test/` los instancia. **B3 sigue abierta** |
| 8 | "ContextCompaction es código muerto" | **Refutada** | `apps/desktop/src/main.ts:2731` (`new ContextCompactionJob`), evaluación y ejecución `:2596-2603`; ADR `docs/adr/0017-context-compaction-llm-inyectable.md` |
| 9 | "FactExtractor / IntentClassifier son regex" | **Confirmada** | `packages/knowledge/src/extractors/FactExtractor.ts:28,56` · `packages/decision/src/IntentClassifier.ts:71,79,87` |
| 10 | "God files: `main.ts` 5 401 y `ego-chat.tsx` 2 067" | **Confirmada y agravada** | `main.ts` = **5 507** (creció 106 líneas al cablear la Ola 1) · `ego-chat.tsx` = 2 067 (la virtualización se movió a `components/chat/ChatMessageList.tsx`) |
| 11 | "I/O síncrono en hot paths" | **Parcial** | `packages/tools/src/native/fs/FileLockManager.ts:54,55,64,97,118,125` y `PathValidator.ts:70` siguen síncronos |
| 12 | "Chat sin virtualizar" | **Refutada** | `apps/desktop/renderer/components/chat/ChatMessageList.tsx:82-116` |
| 13 | "El chat revienta con >60 mensajes + append" | **Refutada (arreglada)** | `ChatMessageList.tsx:3,82,116` usa `unstable_useThreadMessageIds()` + `ThreadPrimitive.Unstable_MessageById`; test nuevo `apps/desktop/renderer/test/ChatVirtualizationAppend.test.tsx`; ADR `docs/adr/0014-virtualizacion-chat-virtua.md` |
| 14 | "Sin Web Workers" | **Refutada** | `apps/desktop/renderer/workers/shiki.worker.ts`; ADR `docs/adr/0016-shiki-web-worker.md` |
| 15 | "Editor ProseMirror" | **Refutada** | `apps/desktop/renderer/components/canvas/EditorView.tsx:4-11` usa `@codemirror/*`; ADR `docs/adr/0013-codemirror6-en-canvas.md` |
| 16 | "Tokens hex sin OKLCH" | **Confirmada** | `apps/desktop/renderer/src/index.css:21-53` · `src/styles/theme-tokens.css:31-64` — 0 `oklch` en todo el CSS del renderer |
| 17 | "Sandbox: `node:vm`" | **Refutada en su ubicación** | Vive en **`packages/execution/src/ZeroContextKernel.ts:111`**, no en `packages/tools/src/sandbox/`. Endurecido (worker + null-proto + watchdog + `maxToolCalls`) |
| 18 | "BrowserView es solo iframe" | **Confirmada** | `apps/desktop/renderer/components/canvas/BrowserView.tsx:80-103` — solo loopback; sin AXTree, sin Set-of-Marks, sin `browser_navigate` |
| 19 | "Sanitizador de 7 regex" | **Confirmada** | `packages/memory/UntrustedContentSanitizer.ts:22-58` — exactamente 7 patrones |
| 20 | "Sin taint tracking ni canal dual-LLM" | **Refutada** | `packages/runtime/src/TrustBoundary.ts:20-128` (`isTainted`, `splitChannels`, `assembleTrustedPrompt`, `filterTaintedForDestructiveAction`, `markUntrusted`); aplicado en `packages/runtime/src/ToolExecutionLoop.ts:335,500-511` |
| 21 | "Sin proxy de secretos: el token real viaja al subproceso MCP" | **Refutada** | `packages/integrations/src/mcp/SecretProxy.ts:32-120` (`EGO_SECRET_*` + `{{SECRET:clave}}`); resolución en el cliente `McpClient.ts:486,659`. **Excepción registrada**: servidores que exigen el token en env al arrancar |
| 22 | "Terminal solo denylist" | **Refutada** | Allowlist segmentada deny-by-default `packages/tools/src/native/terminal/TerminalCommandPolicy.ts:288-331` + `PROCESS_ENV_ALLOWLIST` `:551-612`; aplicada en `NativeTerminalTool.ts:68-70` |
| 23 | "DIST-04/06/09 pendientes" | **Confirmada** | `docs/roadmap/Backlog.md:479,481,484` — los tres siguen `🆕 Pendiente` con bloqueo de owner |

**Afirmaciones adicionales refutadas por la ola** (no estaban en el informe previo): "Select usa Radix" →
**Refutada por D3**: `apps/desktop/renderer/components/ui-kit/Select.tsx:1` importa `@radix-ui/react-select`.
"Se eliminaron los `<select>` nativos" → **Confirmada ahora**: 0 `<select` en el renderer, con test de
barrido de fuente en `apps/desktop/renderer/test/Targets44.test.tsx:186-213`.
"44px aplicado" → **Confirmada ahora**: mismo test `:95-183`.
"Delegación no cableada" → **Refutada**: `apps/desktop/src/main.ts:2917` + `packages/subegos/src/DelegationRuntime.ts:88`.

---

## 3. Brechas nuevas B1-B13: estado tras la ola #

| # | Brecha | Estado | Evidencia actual | Quién la cierra |
| --- | --- | --- | --- | --- |
| B1 | Crash del chat con >60 mensajes + append | **Refutada (cerrada)** | `apps/desktop/renderer/components/chat/ChatMessageList.tsx:82-116` + `apps/desktop/renderer/test/ChatVirtualizationAppend.test.tsx` + `docs/adr/0014-virtualizacion-chat-virtua.md` | A4 — cerrado |
| B2 | `ContextCompaction` era código muerto | **Refutada (cerrada)** | `apps/desktop/src/main.ts:1731` (llamada a `compact()`) y `:1965` (instanciación del job) + `packages/models/src/routerSummarizer.ts:49` | A2/A4 — cerrado |
| B3 | `DreamConsolidator` era código muerto | **Confirmada (abierta)** | `new DreamConsolidator` / `new MemoryCurator`: 0 en `src/`. Solo `packages/tasks/test/` | **A4** (cablear en `main.ts`) o **A3** (eliminar) — Ola 2 |
| B4 | Suite E2E muerta | **Confirmada (abierta)** | 11 ficheros con `test.describe.skip("requiere backend Electron vivo")`: `tests/gui/specs/02-streaming.spec.ts:17`, `03-hitl.spec.ts:7`, `04-proyectos.spec.ts:14`, `05-subegos.spec.ts:18`, `06-canvas.spec.ts:21`, `07-mcp.spec.ts:15`, `08-daily.spec.ts:23`, `09-dominios.spec.ts:13`, `11-byok-block.spec.ts:8`, `12-omnibar.spec.ts:25`, `13-tray-build.spec.ts:30` | **A7** — Ola 1 (en curso) |
| B5 | 6 hallazgos WCAG AA vivos | **Confirmada (abierta)** | `apps/desktop/renderer/test/a11y.test.tsx` (`FIND-A11Y-01..06` con `it.fails`); ratios 1.59:1 a 2.14:1 en bordes, 2.24:1 a 4.43:1 en texto | **A4** (token fix) — Ola 2 E10 |
| B6 | El sanitizador no neutraliza lo que detecta | **Refutada (cerrada)** | `CONTROL_TAGS` cubre **11** tags (`packages/memory/UntrustedContentSanitizer.ts:30-42`) y `neutralizeControlTags()` las sustituye todas (`:196-198`), no solo las detectadas; test de regresión `packages/memory/test/untrusted-sanitizer-hardening.test.ts` | A2 — cerrado en la Ola 1c |
| B7 | `DreamConsolidator` trunca en silencio | **Refutada (cerrada)** | El resultado declara `truncated: boolean` (`packages/tasks/src/DreamConsolidator.ts:19,122`) y lo devuelve explícitamente al truncar (`:149` ok / `:155` truncado); el techo sigue siendo `batchSize (50) × maxPages (1 000)` (`:26,101-102`) pero **ya no es silencioso** | A3 — cerrado |
| B8 | 7 `<select>` nativos vivos | **Refutada (cerrada)** | 0 `<select` en `apps/desktop/renderer/**/*.tsx`; barrido de fuente en `apps/desktop/renderer/test/Targets44.test.tsx:186-213`; Radix en `ui-kit/Select.tsx:1`; ADR `docs/adr/0015-radix-select-accesible.md` | A4 — cerrado |
| B9 | Sin DOMPurify ni CSP `img-src` | **Confirmada (abierta)** | 0 coincidencias de `DOMPurify`, `content-security-policy`, `img-src` en `packages/` y `apps/` | **A7** (CSP) — Ola 2 E7 |
| B10 | Sin `cache_control` | **Refutada (cerrada)** | `packages/models/test/ModelRouter-resilience.test.ts:388-450` verifica `cache_control` en el payload de Anthropic y su ausencia sin `providerOptions` | A2 — cerrado |
| B11 | Sin `expand_tools` / `search_tools` | **Confirmada (abierta)** | 0 coincidencias en `packages/`; el catálogo existe (`packages/tools/src/ToolRegistry.ts`) pero no hay meta-herramienta de búsqueda | **A3** — Ola 2 E13 |
| B12 | Checkpointer sin time-travel | **Confirmada (abierta)** | `packages/tasks/src/TaskCheckpoint.ts` sin `restore`, `branch` ni `timeTravel` | **A3** — Ola 2 E9 |
| B13 | Sin `@container` ni `prefers-contrast` | **Confirmada (abierta)** | 0 coincidencias en el CSS del renderer | **A4** — Ola 2 E10 |

**Balance de brechas (recalculado 2026-10-20):** **7 refutadas** (B1, B2, B6, B7, B8, B10 + la reubicación de `ZeroContextKernel`), 0 parciales, **6 confirmadas** (B3, B4, B5, B9, B11, B12, B13 → 7 confirmadas).

> B6 y B7 las cerró la **Ola 1c** (A2: sanitizador que neutraliza las 11 tags de
> control; A3: truncado marcado en el resultado de `DreamConsolidator`).
> B4 (11 specs E2E en `describe.skip`) **sigue abierta por diseño**: el job `gui` los
> ejecuta en CI pero no los reactiva, porque requieren el backend Electron real y no el
> dev-server (ver `docs/dev/e2e-skip-inventory.md` §4).

---

## 4. Conflicto documento ↔ principios innegociables / ADR-0011 #

### 4.1 Formalmente descartados — NO son deuda de Ego #

| Requisito del documento | Sección | Fundamento del descarte |
| --- | --- | --- |
| Tauri v2 + Rust | §9.3, §15.1, §16-F3 | `docs/adr/0011-stab14-asimilados-descartes.md:37` — "🚫 Tauri/Bun/SwiftUI/HookServer runtime/notch — desktop es Electron 33". La propia tabla §15.1 del documento ofrece Electron como alternativa válida |
| Daemon 24/7 headless | §5.5, §9.3, §16-F3 | `docs/adr/0011:37` · `docs/extractions/openclaw.md:25` — "DESCARTAR Web UI headless" |
| Omnicanal WhatsApp/Telegram/Discord/Slack/iMessage | §4.2 | `docs/adr/0011:36` — "🚫 Scrapers/telecom/voz externa" |
| PostgreSQL + pgvector, Qdrant, Neo4j, Milvus, BigQuery, Snowflake, Kubernetes | §2.2, §4.2, §9.1-C6, §14, §16-F4 | `docs/adr/0011:33-34` — "🚫 Python/SQLite/FastAPI/pgvector/embeddings Python"; `AGENTS.md` §4 — VantaDB embebido es el almacén único |
| MicroVMs Firecracker / gVisor / cgroups / Warm Pools / hibernación | §2.3, §14 | `AGENTS.md` §4 — sin cloud ni multi-tenancy. `node:vm` es la adaptación local honesta |
| LangGraph, Temporal.io, Pydantic AI, LiteLLM, CrewAI, AutoGen | §9.1-C3, §10.2 | `AGENTS.md` §4 — bans explícitos. Ego tiene su propio runtime (`packages/runtime`) |
| Streaming SSR + React Server Components + Edge CDN | §21.4 | Desktop sin servidor. `AGENTS.md` §4 — "NO Next.js en desktop" |
| SQLite sobre WASM / OPFS en el renderer | §20.4-C3 | `AGENTS.md` §4 — "NO VantaDB en renderer", "NO `Client` de `vantadb` (WASM)" |
| Nivel 4 de permisos "Daemon Confiable 24/7" | §8.2 | Ego tiene 3 niveles verificables en `packages/security/src/ToolPermissions.ts:25` |
| Cloud Pro (SaaS con créditos) | §15.3 | Parcialmente compatible con el modelo de `AGENTS.md` §8, pero la parte de sandbox cloud y canales 24/7 cae en los descartes anteriores |
| `browser_navigate` con AXTree + Set-of-Marks como capacidad propia | §3.3, §6.3 | Fuera del alcance del producto hoy; puede servirse por MCP externo (`packages/tools/src/toolsets.ts:79-80` ya reconoce `browser_` y `playwright_`) |

### 4.2 NO descartados — son brecha real y siguen abiertas #

| Requisito del documento | Sección | Por qué no está descartado | Cierre |
| --- | --- | --- | --- |
| **DOMPurify + CSP `img-src`** | §21.2, §11.2 | Es un requisito de **seguridad frontend** que no choca con ningún principio. `AGENTS.md` §4 exige "Seguridad implications reviewed for any untrusted input". El vector de exfiltración por Markdown image (§11.1) sigue abierto | E7 |
| **Egress firewall / allowlist de salida** | §11.2 (punto 30) | Complementa el SSRF ya arreglado por A3 (`packages/security/src/native/security/NetPolicy.ts`); falta la capa de red | E7 |
| **Sandbox de ejecución real** | §2.3 | `node:vm` cubre el caso local; falta aislamiento de recursos (cgroups/quotas de CPU y memoria) — `ExecutionManager` ya tiene cuotas de bytes y cola cancelable | E2 |
| **Budget circuit breakers** | §8.3 | `AGENTS.md` §4 no lo prohíbe y es requisito de gobernanza. No hay contadores de coste en `packages/security/` | E5 |
| **Identidad declarativa `SOUL.md` / `AGENT.md`** | §8.1 | Hoy el "soul" vive en código (`packages/subegos/src/SubEgoSoul.ts`); el documento pide que sea Markdown versionable. Choca parcialmente con "no lógica de negocio en renderer", no con el principio de memoria local | E5 |
| **`expand_tools` / `search_tools`** | §2.4 | Requisito de escalabilidad del ToolRegistry; no choca con nada | E13 |
| **Time-travel / branch desde checkpoint** | §2.2-N5, §17.3-F4 | `TaskCheckpointManager` ya existe; falta la bifurcación | E9 |

### 4.3 El caso especial de §11 #

§11 (seguridad agéntica) **subió de ❌ a 🟡 en esta ola** gracias a `TrustBoundary` (taint + canal dual).
Sigue siendo **la sección con mayor retorno pendiente**, pero **ya solo queda una pata**: la
ausencia de **DOMPurify / CSP `img-src`**. La otra (el sanitizador no neutralizaba lo que detectaba)
**se cerró en la Ola 1c** — `UntrustedContentSanitizer` neutraliza ahora las 11 tags de control
(`packages/memory/UntrustedContentSanitizer.ts:30,196-198`). La pata que falta **no** está
descartada por decisión: es requisito de seguridad frontend (`AGENTS.md` §4) → E7.

---

## 5. Plan de cierre — Ola 2 (Bloque E) #

Ver la versión completa, con orden y dependencias, en
[`docs/agent-ops/plans/2026-10-19-remediation-wave1/VERDICT.md`](../agent-ops/plans/2026-10-19-remediation-wave1/VERDICT.md).

| Id | Capacidad | Sección doc | Estado | Tipo | Fase `AGENTS.md` §6 | Depende de |
| --- | --- | --- | --- | --- | --- | --- |
| E1 | Ejecución paralela de tool calls | §3.4, §13.2 | Ausente (bloqueada) | (a) deuda técnica | 02 Acción | EGO-FIND-43 — Anthropic exige que cada `tool_result` siga en orden a su `tool_use` |
| E2 | Path cognitivo nativo de VantaDB (RRF real, `memoryRecall`/`contextAssemble`/`memoryConsolidate`/`memoryReinforce`) + embeddings | §2.2, §9.1-C6 | Parcial | (b) capacidad nueva | 06 Knowledge | Binding `vantadb-node@0.8.0` ya expone `graphragSearch`, `memoryRecall`, `contextAssemble`, `memoryConsolidate`, `memoryReinforce` (`index.d.ts:603-636`); solo `graphRagSearch` está cableado en `EgoMemoryAdapter.ts:1100` |
| E3 | Binarios MCP embebidos (uv/bun) + firma de instalador | §15.2, §15.1 | Ausente | (a) deuda técnica | 12 Distribution | DIST-04 (bloqueo owner: certificados) |
| E4 | Exportadores de artefactos (PDF/DOCX/XLSX/PPTX) y REPL Python | §6.5, §7 | Ausente | (b) capacidad nueva | 02 Acción | Sin dependencia Python (AGENTS.md §4) — implementación TS |
| E5 | Identidad declarativa (`SOUL.md`/`AGENT.md`) + budget circuit breakers | §8.1, §8.3 | Ausente | (b) capacidad nueva | 03 Sub-Egos | — |
| E6 | Descomposición de `main.ts` (5 507 → <1 500) | §9.1 | Ausente | (a) deuda técnica | 02 Acción | — |
| E7 | DOMPurify + CSP `img-src` + egress allowlist | §21.2, §11.2 | Ausente | (a) deuda técnica | 11 Security | — |
| E8 | OpenTelemetry/OTLP + sink de disco para `StructuredLogger` | §12.1 | Ausente | (b) capacidad nueva | 11 Security | — |
| E9 | Time-travel y bifurcación desde checkpoint | §2.2-N5, §17.3-F4 | Ausente | (b) capacidad nueva | 10 Recovery | — |
| E10 | OKLCH completo + 6 hallazgos AA + `prefers-contrast` + `@container` + `DESIGN.md` raíz | §18, §19, §22.1 | Ausente | (a) deuda técnica | 11 Security | — |
| E11 | CRDT (Yjs) en el Canvas + deep linking | §20.4-C4, §20.5 | Ausente | (b) capacidad nueva | 04 Canvas | — |
| E12 | Pirámide de tests: E2E real, Storybook, MSW, Lighthouse CI | §22.2 | Ausente | (a) deuda técnica | 12 Distribution | Depende de A7 (Ola 1) |
| E13 | Skills con divulgación progresiva (`lookup_skills`) + `expand_tools` + ejecutor real de delegación | §2.4, §4.3, §10.3 | Parcial | (b) capacidad nueva | 03 Sub-Egos | — |

**Regla de orden heredada de `AGENTS.md` §6:** *una fase completa antes de la siguiente*. Esto obliga a
**reordenar** la lista por fase, no por valor: E7 y E10 (Fase 11) no pueden empezar hasta que E2
(Fase 06) esté cerrada, porque E2 toca `packages/memory` y `packages/knowledge`, y Fase 07/08/09/10
dependen de la misma base. El orden canónico queda en `VERDICT.md` §3.

---

## 6. Nota sobre las cifras de los informes previos #

| Cifra previa | Veredicto | Motivo |
| --- | --- | --- |
| **51 %** | Sobreestimación | No descontó los bloques formalmente descartados por ADR-0011 (Tauri, daemon, omnicanal, Postgres/Qdrant, MicroVM, SSR) ni penalizó que 2 de los 7 commits del P0 arreglaran código nunca instanciado |
| **68 %** | Indefendible | Exige tratar 19 secciones 🟡 como ≥0.75 con 4 bloques de capacidad completa ausentes (exportadores, voz, CRDT, OTel). Ninguna ponderación razonable lo sostiene |
| **43 % bruto** (esta matriz) | Defendible | 8.9/20 secciones aplicables con ✅=1.0, 🟡≈0.5, ❌=0.0, descartadas y no aplicables excluidas del denominador |
| **62 % adaptado** (esta matriz) | Defendible y es la cifra que debe citarse | Es la única que mide contra el subconjunto que Ego decidió adoptar tras ADR-0011 |
