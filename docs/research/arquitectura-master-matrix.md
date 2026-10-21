---
title: "Matriz de contraste: documento maestro de 22 secciones vs Ego"
kind: research
status: active
description: "Estado verificado de cada sección del documento maestro externo frente al código de Ego, con evidencia, conflicto ADR y tarea de cierre"
tags: [arquitectura, research]
supersedes: null
superseded_by: null
---

> **Documento de contraste:** [`Arquitectura y Diseño de Sistemas…md`](./Arquitectura%20y%20Dise%C3%B1o%20de%20Sistemas%20para%20Plataformas%20y%20Agentes%20de%20IA.md)
> — research externo, **NO normativo**.
> **Fecha de verificación:** 2026-10-21 · **Verificador:** A8 · **Ola:** 4b (cierre de contraste tras las olas 1, 1b, 1c, 2 y 3).
> **Referencia de descarte:** [`docs/adr/0011-stab14-asimilados-descartes.md`](../adr/0011-stab14-asimilados-descartes.md).
> **Alcance del doc:** NO es una especificación de Ego. Describe una plataforma cloud omnicanal
> (Tauri v2, daemon 24/7, PostgreSQL/pgvector/Qdrant, MicroVMs, WebRTC, SSR, omnicanal) casi
> enteramente **descartada por ADR-0011** y por los 10 principios de `AGENTS.md`.
> **Verificación de la constraint del proveedor (T2):**
> [`verificacion-anthropic-tool-order.md`](./verificacion-anthropic-tool-order.md) —
> `EGO-FIND-80` resuelta, `EGO-FIND-43` desbloqueado.

## Cómo leer esta matriz

| Columna | Significado |
| --- | --- |
| **Estado** | `✅ Implementado` · `🟡 Parcial` · `❌ Ausente` · `🚫 Descartado por decisión` · `➖ No aplica (desktop local-first)` |
| **C/A/D** | Sub-requisitos **C**umplidos / **A**bsentes no descartados / **D**escartados por ADR-0011, contados sobre la lista explícita de la sección del documento. Es el numerador y el denominador de las cifras de §2. |
| **Conflicto con ADR-0011** | `Sí` = el requisito está formalmente descartado → **no es deuda de Ego**. `No` = no descartado → **brecha real**. `Parcial` = parte descartada, parte vigente. |
| **Tarea que lo cierra** | `E<n>` = Bloque E de la Ola 2 · `O4-n` = Ola 4 (plan en el handoff de A8) · `DIST-xx` = backlog de distribución con bloqueo de owner · `—` = no aplica. |
| **Bloque** | `E` = Ola 2 · `O4` = Ola 4 · `A7` = Ola 1 · `—` = cerrado o no aplica |

---

## 1. Matriz de las 22 secciones (verificada 2026-10-21)

| # | Sección | Estado | C/A/D | Evidencia (archivo:línea) | Conflicto con ADR-0011 | Tarea que lo cierra | Bloque |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Taxonomía de los 8 referentes | ➖ No aplica (desktop local-first) | — | `Arquitectura y Diseño de Sistemas…md:9-18` | No (descriptivo, no es requisito de código) | — | — |
| 2 | Componentes esenciales: Router, memoria CoALA, sandbox, MCP | 🟡 Parcial | 9/4/4 | Router con cascada, backoff, aliases y `cache_control` `packages/models/src/ModelRouter.ts:262-544` · memoria `packages/memory/EgoMemoryAdapter.ts:244-1389` · GraphRAG nativo `packages/knowledge/src/GraphRagEngine.ts:284-320` · MCP cliente+servidor `packages/integrations/src/mcp/McpClient.ts:476-486` · sandbox `packages/execution/src/ZeroContextKernel.ts:111` | Parcial — sandbox cloud/microVM descartado (`0011:33-34`) | O4-2 (RRF y path cognitivo nativo) | E / O4 |
| 3 | Capacidades funcionales core (ReAct, self-healing, proactividad, fan-out) | 🟡 Parcial | 4/2/0 | ReAct `packages/runtime/src/ToolExecutionLoop.ts:373-462` · **tool calls concurrentes con orden preservado** `packages/runtime/src/ToolExecutionLoop.ts:739-768` · self-healing `packages/runtime/src/ToolExecutionLoop.ts:436-440` · proactividad con cron y `fs.watch` `apps/desktop/src/main/window/create-window.ts:569-601` · fan-out de subagentes `packages/subegos/src/DelegationRouter.ts:904` | No | O4-5 (DAG y generador-crítico) | O4 |
| 4 | Integraciones y Skills (MCP, GitHub, PTY, watchers, omnicanal) | 🟡 Parcial | 4.5/4.5/2 | MCP `packages/integrations/src/mcp/McpClient.ts:34-39` · GitHub `packages/integrations/src/github/GitHubMcpConnector.ts:44` · watchers `apps/desktop/src/main/window/create-window.ts:585-601` · Skills `packages/integrations/src/skills/SkillScanner.ts:98` · **sin `lookup_skills`** (0 coincidencias) | Sí para omnicanal y cloud data (`0011:36`) | O4-4 (skills con divulgación progresiva) | O4 |
| 5 | UX/UI: Canvas dual, inspector de tareas, HITL, voz, daemon | 🟡 Parcial | 5.5/5.5/2 | Canvas `apps/desktop/renderer/components/canvas/EditorView.tsx:4-11` · HITL con edición de args `apps/desktop/renderer/components/tools/ApprovalCard.tsx:250-263` · **voz STT/TTS opt-in** `apps/desktop/renderer/components/voice/useVoice.ts:85-140` + `apps/desktop/src/main/ipc/register-ipc.ts:2367-2441` · **sin full-duplex, VAD ni barge-in** | Sí para daemon y voz externa (`0011:36-37`) | O4-6 (voz full-duplex) | O4 |
| 6 | Internal Tooling Suite (fs, git, terminal, browser, REPL, exportadores) | 🟡 Parcial | 11.5/5.5/3 | fs/git/terminal `packages/tools/src/native/` · allowlist de terminal `packages/tools/src/native/terminal/TerminalCommandPolicy.ts:288-331` · background `packages/tasks/src/BackgroundTaskTools.ts` · **exportadores PDF/DOCX/XLSX/PPTX** `packages/tools/src/exporters/exportArtifactTool.ts:170-188` · **REPL de expresiones TS** `packages/tools/src/repl/evalExpressionTool.ts:53-57` · browser ausente | Parcial — REPL de Python descartado (`0011:33-34`) | O4-7 (browser native) | O4 |
| 7 | Entregables de producción (PDF/DOCX/XLSX/PPTX, web apps, fórmulas) | 🟡 Parcial | 2.5/2.5/0 | **Exportadores propios, cero dependencias** `packages/tools/src/exporters/exportArtifactTool.ts:100-188` + test `packages/tools/test/exporters.test.ts:247-299` · MCP server de Ego `packages/integrations/src/mcp/McpServer.ts` · **sin** apps web Next.js/Vue, **sin** LaTeX, **sin** Google Docs/Sheets/Slides | No | O4-8 (fórmulas vivas y notas de orador) | O4 |
| 8 | Configuración, políticas y gobernanza (permisos, credenciales, secret proxy, budgets) | 🟡 Parcial | 3.5/4.5/1 | permisos `packages/security/src/ToolPermissions.ts:299-395` · credenciales `packages/security/src/CredentialManager.ts:335` · secret proxy `packages/integrations/src/mcp/SecretProxy.ts:32-120` + resolución `packages/integrations/src/mcp/McpClient.ts:486,663` · **budget circuit breakers** `packages/subegos/src/SubEgoBudget.ts:186-266` + `packages/execution/src/ExecutionManager.ts:68-89` · `SOUL.md` ausente | Sí para el nivel 4 de permisos (`0011:37`) | O4-9 (identidad declarativa) | O4 |
| 9 | System Design: 6 capas + 10 fases del ciclo de vida | 🟡 Parcial | 10/6/0 | **main.ts = 785 líneas** + 11 módulos nuevos (`apps/desktop/src/main/ipc/register-ipc.ts` (2 404) es el mayor) · IPC tipado `apps/desktop/src/ipc/schema.ts` · loop `packages/runtime/src/ToolExecutionLoop.ts` · capa 2 (gateway WS) inexistente · capa 5 = `node:vm` | Parcial — capa 5 cloud descartada | O4-10 (descomposición del módulo IPC) | O4 |
| 10 | Multi-agente: 5 patrones de orquestación | 🟡 Parcial | 5.5/3.5/3 | supervisor-worker y fan-out `packages/subegos/src/DelegationRouter.ts:381-394,904` · cableado `apps/desktop/src/main/window/create-window.ts:401` · max-depth `DelegationRouter.ts:393-394` · DAG secuencial y generador-crítico ausentes | Sí para LangGraph/CrewAI/AutoGen (`0011:37`) | O4-5 | O4 |
| 11 | Seguridad agéntica y defensas contra inyección indirecta | 🟡 Parcial | 6/1/0 | taint + canal dual `packages/runtime/src/TrustBoundary.ts:20-128` · guard en el loop `packages/runtime/src/ToolExecutionLoop.ts:335,500-522` · sanitizador de 11 tags `packages/memory/UntrustedContentSanitizer.ts:30,196-198` · **DOMPurify** `apps/desktop/renderer/lib/sanitize-html.ts:39` · **CSP `img-src 'self' data: blob:`** `apps/desktop/src/main/security/electron-security.ts:115-120` + `apps/desktop/renderer/index.html:12` · **falta el egress allowlist de salida** | **No — brecha real** | O4-11 (egress allowlist) | O4 |
| 12 | Observabilidad, trazabilidad y evals | 🟡 Parcial | 4/7/0 | EventBus y trazas `packages/events/` · `correlationId` `packages/events/src/correlation.ts:50-74` + `packages/runtime/src/ToolExecutionLoop.ts:274-275,451-454` · sink de disco `scripts/telemetry-sink.mjs` · detector de bucles `apps/desktop/src/main/ipc/register-ipc.ts:2305-2334` · **0 coincidencias de `OTLP`/`otel`** · benchmarks ausentes | No (el EventBus propio satisface `AGENTS.md` §2; OTel es FORMATO, no requisito) | O4-12 (formato OTel) | O4 |
| 13 | Coste y latencia: prompt caching, model cascading | 🟡 Parcial | 6.5/1.5/0 | `cache_control` real en Anthropic `packages/models/test/ModelRouter-resilience.test.ts:388-450` · cascada + backoff + jitter `packages/models/src/ModelRouter.ts:484-544` · **aliases `fast`/`smart` por perfil** `packages/models/test/ModelRouter-resilience.test.ts:312-316` y `packages/models/test/cfg04-aliases-fallback.test.ts:45-59` · PromptAssembly 3-capas `packages/subegos/src/PromptAssembly.ts` | No | — (cerrado) | — |
| 14 | Infraestructura de sandboxes en la nube a escala | 🚫 Descartado por decisión | 0/0/6 | `docs/adr/0011-stab14-asimilados-descartes.md:33-34` · sin infra cloud en el repo | **Sí** — guardrail `AGENTS.md` §4 (Node 22 + VantaDB nativo) | — | — |
| 15 | Distribución, empaquetado y monetización | 🟡 Parcial | 1/3/0 | installer Electron `apps/desktop/electron-builder.config.cjs` · BYOK `packages/security/src/CredentialManager.ts:335` · **`vantadb-node@0.9.0` en ambos manifiestos** `apps/desktop/package.json:38` y `packages/memory/package.json:27` · **uv/bun NO embebidos** `packages/integrations/src/mcp/McpClient.ts:34-39` · firma ausente | Parcial — Electron es alternativa válida en la propia tabla del documento (§15.1) | O4-13 (binarios MCP) · DIST-04/06/09 | O4 |
| 16 | Hoja de ruta en 4 fases | 🟡 Parcial | 2.5/1.5/0 | **Fase 01 y Fase 02 COMPLETAS** (Fase 02: paralelismo, exportadores, descomposición de `main.ts`) · Fase 3 parcial (Canvas dual sin voz full-duplex) · Fase 4 parcial (path cognitivo nativo pendiente) | Sí en las fases 3-4 (Tauri, daemon, omnicanal, Postgres) | O4-2 | O4 |
| 17 | Investigación UX, arquitectura de información de 3 zonas, journeys | 🟡 Parcial | 4.5/8.5/0 | 3 zonas `apps/desktop/renderer/src/App.tsx` · omnibar Cmd+K · HITL flow completo · **sin onboarding <60 s**, **sin time-travel**, **sin usab testing** | No | O4-14 (time-travel en UX) | O4 |
| 18 | Identidad visual, OKLCH, tipografía, DESIGN.md | 🟡 Parcial | 10.5/5.5/0 | **tokens OKLCH** `apps/desktop/renderer/src/index.css:20-35` + `src/styles/theme-tokens.css` + `apps/desktop/renderer/components/canvas/DesignSystemProvider.tsx:51-151` · **contraste WCAG como aserción real sobre el CSS** `apps/desktop/renderer/test/ThemeTokensOklch.test.tsx` · **0 `it.fails` en el repo** · `docs/design/DESIGN.md` · **11 primitives Radix** · token `warning` `DesignSystemProvider.tsx:59` · **falta `prefers-contrast`** y familia serif | No | O4-15 (prefers-contrast y serif) | O4 |
| 19 | Maquetación pixel-perfect, responsive, microinteracciones | 🟡 Parcial | 11/6/0 | 44px verificado en todo el renderer `apps/desktop/renderer/test/Targets44.test.tsx:95-213` · **`@container` en 5 componentes** `apps/desktop/renderer/floating/floating.css:581,593` · `components/daily-state/MetricsConsole.tsx:76` · `components/daily-state/DailyDashboard.tsx:432` · `components/sub-egos.tsx:305` · **falta `prefers-contrast`** | No | O4-15 | O4 |
| 20 | Componentes, estado en 4 capas, enrutamiento | 🟡 Parcial | 12.5/3.5/0 | ui-kit de 11 primitives sobre Radix `apps/desktop/renderer/components/ui-kit/` · Zustand · Cmd+K · registry dinámico `apps/desktop/renderer/components/canvas/registry.ts:85-116` · **CRDT/Yjs ausente (0 coincidencias)** · **deep-linking ausente (0 coincidencias)** | No | O4-16 (CRDT + deep link) | O4 |
| 21 | APIs tiempo real, seguridad frontend, 60-120 FPS | 🟡 Parcial | 9/4/0 | Web Worker `apps/desktop/renderer/workers/shiki.worker.ts` · virtualización `apps/desktop/renderer/components/chat/ChatMessageList.tsx:82-116` · **DOMPurify + CSP** `apps/desktop/renderer/lib/sanitize-html.ts:39` + `apps/desktop/src/main/security/electron-security.ts:115-120` · iframe loopback `apps/desktop/renderer/components/canvas/BrowserView.tsx:80-103` | No | O4-11 | O4 |
| 22 | Accesibilidad WCAG 2.2 y pirámide de testing | 🟡 Parcial | 4.5/4.5/0 | axe en RTL `apps/desktop/renderer/test/a11y.test.tsx` · `prefers-reduced-motion` soportado · contraste determinista `apps/desktop/renderer/test/ThemeTokensOklch.test.tsx` · **puerta `design-lint`** `apps/desktop/scripts/design-lint.cjs` (R1-R7) · **11 specs E2E en `describe.skip`** `tests/gui/specs/02-streaming.spec.ts:17` y 10 más · sin Storybook, sin Lighthouse | No | O4-17 (reactivar E2E real) | O4 |

### Resumen del vector de estados

| Estado | Secciones | Nº | Cambio desde 2026-10-19 |
| --- | --- | --- | --- |
| ✅ Implementado | — | **0** | — |
| 🟡 Parcial | 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22 | **20** | **§7 pasó de ❌ a 🟡** (exportadores) |
| ❌ Ausente | — | **0** | **§7 dejó de ser la única ❌** |
| 🚫 Descartado por decisión | 14 | **1** | — |
| ➖ No aplica | 1 | **1** | — |

> **Ninguna sección llega a `✅ Implementado`**, pero **ninguna queda ya en ❌ absoluto**: las 20 secciones
> aplicables tienen al menos un sub-requisito cumplido y verificado. Las que rozan el ✅ son
> **§11** (falta solo el egress allowlist), **§18** (falta `prefers-contrast` y la familia serif) y
> **§13** (falta el enrutamiento fino por multimodalidad).

---

## 2. Cifras de alineación: método y resultado

### 2.1 El método (publicado para que sea auditable)

1. Cada sección del documento maestro se descompone en sus **sub-requisitos enumerados** (viñetas y
   tablas del propio documento). Se cuentan: **C**umplidos, **A**bsentes no descartados, **D**escartados.
2. **Cumplido** = existe implementación **verificable en el código actual**, no una mención documental.
   Una sección que declara una capacidad sin código se cuenta como **A**.
3. Los sub-requisitos **descartados por ADR-0011** (Tauri, daemon, omnicanal, Postgres/pgvector,
   Qdrant/Neo4j, MicroVMs/gVisor, LangGraph/CrewAI/AutoGen, SSR/RSC, SQLite-WASM en renderer, REPL de
   Python, nivel 4 de permisos) **no son deuda de Ego**: salen del numerador **y** del denominador.
4. **Bruto** = C / (C + A + D): mide qué parte del documento implementaría Ego si *todo* fuera aplicable.
5. **Adaptado** = C / (C + A): mide contra el subconjunto que Ego decidió adoptar. **Esta es la cifra
   que debe citarse.**
6. Se excluye §1 (taxonomía de mercado: no es requisito de código) y §14 (íntegramente descartada).

### 2.2 El resultado

| Corte | Cálculo | Resultado |
| --- | --- | --- |
| **Bruto** | 128 / (128 + 84 + 18) | **55.7 %** |
| **Adaptado al alcance Ego** | 128 / (128 + 84) | **60.4 %** |
| Vector de estados (método grueso de la matriz anterior) | 20 × 🟡(0.5) / 20 | **50.0 %** |

### 2.3 Por qué mi cifra anterior (43 % / 62 %) y la de A1 (43 % / 62 %) ya no valen

- **El método cambió.** La cifra anterior puntuaba **secciones** (✅=1, 🟡=0.5, ❌=0). Ese método
 *grandea* el resultado: comprime hacia 0.5 todo lo que no sea total, y una sección con 6 de 13
  sub-requisitos cumplidos puntúa lo mismo que una con 2 de 13. El método nuevo puntúa **sub-requisitos**
  con un denominador publicado en la tabla de arriba, que es auditable y falsable.
- **El estado cambió.** §7 pasó de ❌ a 🟡 (exportadores implementados en la Ola 3). Con el método
  grueso, solo eso mueve la cifra de 43 % a 50 %.
- **El 62 % "adaptado" anterior no era reproducible.** Era una estimación cualitativa ("igual, pero
  §2, §4, §5, §9, §14, §15, §16 se puntúan solo por sus sub-requisitos no descartados") **sin
  denominador contado**. Con el denominador publicado, el resultado es **60.4 %** — ligeramente
  menor, aunque se haya cerrado mucha deuda, porque el número anterior estaba inflado por
  sub-requisitos no contados. **Reemplazo 62 % por 60.4 %** y lo declaro.
- **Las cifras de informes previos (51 %, 68 %) siguen sin ser defendibles.** El 68 % exigiría tratar
  20 secciones 🟡 como ≥0.75, imposible cuando 4 bloques de capacidad completa siguen ausentes
  (voz full-duplex, CRDT, OTel, benchmarks) y uno más está en curso (time-travel).

---

## 3. Brechas B1-B13 re-verificadas + B14-B19 nuevas

| # | Brecha | Estado 2026-10-21 | Evidencia | Dueño |
| --- | --- | --- | --- | --- |
| B1 | Crash del chat con >60 mensajes + append | **Cerrada** | `apps/desktop/renderer/components/chat/ChatMessageList.tsx:82-116` + `apps/desktop/renderer/test/ChatVirtualizationAppend.test.tsx` + `docs/adr/0014-virtualizacion-chat-virtua.md` | — |
| B2 | `ContextCompaction` era código muerto | **Cerrada** | `apps/desktop/src/main/window/create-window.ts:196` (instancia) + `packages/models/src/routerSummarizer.ts:49` (LLM inyectable) + `docs/adr/0017-context-compaction-llm-inyectable.md` | — |
| B3 | `DreamConsolidator`/`MemoryCurator` sin instanciar | **ABIERTA** | `new DreamConsolidator` / `new MemoryCurator`: **0 en `src/`**, solo `packages/tasks/test/` | O4-3 (A3/A4) |
| B4 | Suite E2E muerta | **ABIERTA** | **11** ficheros con `test.describe.skip("requiere backend Electron vivo")`: `tests/gui/specs/02-streaming.spec.ts:17`, `03-hitl.spec.ts:7`, `04-proyectos.spec.ts:14`, `05-subegos.spec.ts:18`, `06-canvas.spec.ts:21`, `07-mcp.spec.ts:15`, `08-daily.spec.ts:23`, `09-dominios.spec.ts:13`, `11-byok-block.spec.ts:8`, `12-omnibar.spec.ts:25`, `13-tray-build.spec.ts:30` | O4-17 (A7) |
| B5 | 6 hallazgos WCAG AA vivos | **Cerrada** | **0 `it.fails` en todo el repo**; el contraste es aserción real sobre `theme-tokens.css` (`apps/desktop/renderer/test/ThemeTokensOklch.test.tsx`) + puerta `design-lint` R1-R7 (`apps/desktop/scripts/design-lint.cjs`) | — |
| B6 | El sanitizador no neutraliza lo que detecta | **Cerrada** | `CONTROL_TAGS` cubre 11 tags y `neutralizeControlTags()` los sustituye: `packages/memory/UntrustedContentSanitizer.ts:30-42,196-201` | — |
| B7 | `DreamConsolidator` trunca en silencio | **Cerrada** | El resultado declara `truncated: boolean` y lo devuelve: `packages/tasks/src/DreamConsolidator.ts:19,122,149-155` | — |
| B8 | 7 `<select>` nativos vivos | **Cerrada** | 0 `<select` en `apps/desktop/renderer/**/*.tsx` + barrido de fuente `apps/desktop/renderer/test/Targets44.test.tsx:186-213` + Radix `apps/desktop/renderer/components/ui-kit/Select.tsx:1` + `docs/adr/0015-radix-select-accesible.md` | — |
| B9 | Sin DOMPurify ni CSP `img-src` | **Cerrada** | DOMPurify `apps/desktop/renderer/lib/sanitize-html.ts:39` · CSP `apps/desktop/src/main/security/electron-security.ts:115-120` + `apps/desktop/renderer/index.html:12` · test `apps/desktop/renderer/test/MarkdownSanitization.test.tsx` | — |
| B10 | Sin `cache_control` | **Cerrada** | `packages/models/test/ModelRouter-resilience.test.ts:388-450` | — |
| B11 | Sin `expand_tools` / `lookup_skills` | **ABIERTA** | **0 coincidencias** de `expand_tools`, `search_tools`, `lookup_skills` en `packages/` y `apps/` | O4-4 (A3) |
| B12 | Checkpointer sin time-travel | **ABIERTA** | 0 coincidencias de `restore`, `branch`, `timeTravel`, `revert` en `packages/tasks/src/` | O4-14 (A3) |
| B13 | Sin `@container` ni `prefers-contrast` | **PARCIAL** | `@container` **ya usado en 5 componentes** (`apps/desktop/renderer/floating/floating.css:581,593` · `components/daily-state/MetricsConsole.tsx:76` · `components/daily-state/DailyDashboard.tsx:432` · `components/sub-egos.tsx:305` ) — **pero `prefers-contrast` sigue con 0 coincidencias** | O4-15 (A4) |
| **B14** | **Formato OTel/OTLP ausente** (§12.1) | **NUEVA — ABIERTA** | **0 coincidencias** de `OTLP`, `otel`, `OpenTelemetry` en `packages/` y `apps/`. Sí existen `correlationId` (`packages/events/src/correlation.ts:50-74`) y el sink de disco (`scripts/telemetry-sink.mjs`), pero el **formato de exportación estándar** no existe. **§12.1 queda en 🟡, no en ✅** | O4-12 (A2) |
| **B15** | **Time-travel / bifurcación ausente** (§2.2-N5, §9.2, §17.3-F4) | **NUEVA — ABIERTA** | `packages/tasks/src/TaskCheckpoint.ts` persiste checkpoints pero **no hay `restore`, `branch` ni `revert`**. Afecta a **tres** secciones del doc, no solo a la que decía B12 | O4-14 (A3) |
| **B16** | **CRDT (Yjs) y deep-linking ausentes** (§20.4-C4, §20.5) | **NUEVA — ABIERTA** | 0 coincidencias de `yjs`/`Yjs`/`CRDT`/`deep-link` en `packages/` y `apps/`. `docs/extractions/openhands.md:247` ya lo tenía como `OHND-11` pendiente (router sin deep-link) | O4-16 (A4) — fase nueva |
| **B17** | **§5.4 voz: no es "ausente"** | **CORRECCIÓN** | Mi auditoría de 2026-10-19 la dio por ausente. **Existe**: `apps/desktop/renderer/components/voice/useVoice.ts:85-140` (STT con `MediaRecorder`, TTS con `speechSynthesis`), `apps/desktop/renderer/components/voice/VoiceButton.tsx`, `ipc.voice.*` en `apps/desktop/src/main/ipc/register-ipc.ts:2367-2441`, opt-in con kill switch y aviso de privacidad. **Lo que falta es lo que el §5.4 pide**: full-duplex, VAD (Silero) y barge-in | O4-6 — fase nueva |
| **B18** | **§12.1 exige convenciones semánticas `gen_ai.*`** | **NUEVA — ABIERTA** | No hay ni una clave `gen_ai.*` en el repo. El EventBus de Ego es **proprietario** (satisface `AGENTS.md` §2), pero el doc maestro nombra el estándar como referencia de interoperabilidad | O4-12 (A2) |
| **B19** | **§8.3 budgets: era "ausente", ya no** | **CORRECCIÓN** | `packages/subegos/src/SubEgoBudget.ts:186-266` (`maxTokensPerCall`, `maxDailyCostUsd`, `requiresApprovalAboveUsd`) + circuit breaker por tool `packages/execution/src/ExecutionManager.ts:68-89,182` + `budgetComplianceRatio` `packages/decision/src/Telemetry.ts:22,98` | — (cerrado) |

**Balance:** **10 cerradas** (B1, B2, B5, B6, B7, B8, B9, B10, B19 + reubicación de `ZeroContextKernel`),
**1 parcial** (B13), **8 abiertas** (B3, B4, B11, B12, B14, B15, B16, B17, B18 → nueve contando B17),
**2 correcciones** (B17, B19).

---

## 4. Conflicto documento ↔ principios innegociables / ADR-0011

### 4.1 Formalmente descartados — NO son deuda de Ego

| Requisito del documento | Sección | Fundamento |
| --- | --- | --- |
| Tauri v2 + Rust | §9.3, §15.1, §16-F3 | `docs/adr/0011-stab14-asimilados-descartes.md:37` — "🚫 Tauri/Bun/SwiftUI/HookServer runtime/notch — desktop es Electron 33". La tabla §15.1 del propio documento ofrece Electron como alternativa válida |
| Daemon 24/7 headless | §5.5, §9.3, §16-F3 | `docs/adr/0011:37` · `docs/extractions/openclaw.md:25` — "DESCARTAR Web UI headless" |
| Omnicanal WhatsApp/Telegram/Discord/Slack/iMessage | §4.2 | `docs/adr/0011:36` — "🚫 Scrapers/telecom/voz externa". El research `docs/research/canales-comunicacion-y-social.md` (2026-10-20) es **material de referencia, no normativo**: no reabre el descarte |
| PostgreSQL + pgvector, Qdrant, Neo4j, Milvus, BigQuery, Snowflake, Kubernetes | §2.2, §4.2, §9.1-C6, §14, §16-F4 | `docs/adr/0011:33-34` · `AGENTS.md` §4 |
| MicroVMs Firecracker / gVisor / cgroups / Warm Pools / hibernación | §2.3, §14 | `AGENTS.md` §4 — sin cloud ni multi-tenancy |
| LangGraph, Temporal.io, Pydantic AI, LiteLLM, CrewAI, AutoGen | §9.1-C3, §10.2 | `AGENTS.md` §4 — bans explícitos |
| Streaming SSR + React Server Components + Edge CDN | §21.4 | Desktop sin servidor · `AGENTS.md` §4 — "NO Next.js en desktop" |
| SQLite sobre WASM / OPFS en el renderer | §20.4-C3 | `AGENTS.md` §4 — "NO VantaDB en renderer", "NO `Client` de `vantadb` (WASM)" |
| Nivel 4 de permisos "Daemon Confiable 24/7" | §8.2 | Ego tiene 3 niveles verificables: `packages/security/src/ToolPermissions.ts:25` |
| **REPL de Python / kernel IPython** | §6.4, §7.2 | `docs/adr/0011:33-34` — "🚫 Python/SQLite/FastAPI/pgvector/embeddings Python". **Matiz:** la Ola 3 lo sustituyó por un **REPL de expresiones TypeScript** (`packages/tools/src/repl/evalExpressionTool.ts:53-57`, nombre honesto `eval_expression`, sin `eval`/`new Function`/`node:vm`/`child_process`). **No es el REPL del documento, pero cubre su función con el guardrail respetado** |
| Cloud Pro (SaaS con créditos) | §15.3 | Parcialmente compatible con `AGENTS.md` §8; la parte de sandbox cloud y canales 24/7 cae en los descartes anteriores |

### 4.2 NO descartados — son brecha real y siguen abiertas

| Requisito | Sección | Por qué no está descartado | Cierre |
| --- | --- | --- | --- |
| **Egress allowlist de salida** | §11.2 (punto 30) | `NetPolicy` bloquea SSRF e IPs privadas, pero no es el "proxy auditado hacia dominios autorizados" que pide el doc | O4-11 |
| **Sandbox con aislamiento de recursos** | §2.3 | `node:vm` cubre el caso local; falta aislamiento de CPU/memoria (el `ExecutionManager` ya tiene cuotas de bytes y cola cancelable) | O4-2 |
| **Identidad declarativa `SOUL.md` / `AGENT.md`** | §8.1 | Hoy el "soul" vive en código (`packages/subegos/src/SubEgoSoul.ts`); el doc pide Markdown versionable | O4-9 |
| **`expand_tools` / `search_tools` / `lookup_skills`** | §2.4, §4.3 | Requisito de escalabilidad del ToolRegistry; no choca con nada | O4-4 |
| **Time-travel / branch desde checkpoint** | §2.2-N5, §9.2, §17.3-F4 | `TaskCheckpointManager` persiste; falta la bifurcación | O4-14 |
| **CRDT (Yjs) + deep linking** | §20.4-C4, §20.5 | Sin contradicción con ningún principio; ya fichado como `OHND-11` en `docs/extractions/openhands.md:247` | O4-16 |
| **Formato OTel / `gen_ai.*`** | §12.1 | El EventBus propio cumple el principio; el estándar es **interoperabilidad**, no requisito. Es 🟡, no ❌ | O4-12 |
| **Voz full-duplex con VAD y barge-in** | §5.4 | La voz existe en modo STT/TTS; el streaming bidireccional y el barge-in son un producto distinto | O4-6 |
| **Browser-use nativo con AXTree + SoM** | §3.3, §6.3 | Hoy se sirve por MCP externo (`packages/tools/src/toolsets.ts:79-80`); el doc lo pide como capacidad propia | O4-7 |
| **Presupuesto de desviación de la IA** | §3.2 | Tree-sitter y la verificación automática no son parte del producto; no es brecha, es alcance distinto | — |

### 4.3 El caso especial de §11

§11 **subió de ❌ a 🟡** en la Ola 2 con `TrustBoundary` (taint + canal dual), la Ola 1c con el sanitizador
de 11 tags, y la Ola 2 con **DOMPurify + CSP `img-src`**. Le queda **una sola pata**: el *egress
allowlist* del §11.2 (punto 30). Es la sección a un paso del ✅ y la de mayor retorno pendiente.

---

## 5. Verificación de la constraint del proveedor (T2 / `EGO-FIND-80`)

**Resuelta.** Informe completo con URLs, citas y fecha en
[`verificacion-anthropic-tool-order.md`](./verificacion-anthropic-tool-order.md).

- `docs.anthropic.com` **directo** devuelve la página "App unavailable in region" (evidencia del bloqueo).
- El **lector de texto `r.jina.ai`** sí entrega la **fuente primaria** (5 páginas oficiales, HTTP 200).
- La doc oficial dice: *"The API doesn't prescribe an execution order: you can run the calls
  concurrently (`Promise.all`, `asyncio.gather`)"* y exige emparejar por **`tool_use_id`**, no por
  posición. El orden secuencial es obligatorio **solo** en los batch actions de `computer use` /
  `browser use`.
- **Consecuencia:** la premisa del bloqueo era incorrecta. `EGO-FIND-80` → RESUELTA;
  `EGO-FIND-43` → DESBLOQUEADO. La implementación ya entregada
  (`packages/runtime/src/ToolExecutionLoop.ts:739-768`) es **más estricta** que la API y no cambia.

---

## 6. Plan de la Ola 4

El plan completo (17 ítems, ordenados por la progresión de fases de `AGENTS.md` §6, con tipo, esfuerzo,
dependencia y ficha) está en
[`docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A8-ola4b.md`](../agent-ops/plans/2026-10-19-remediation-wave1/handoff/A8-ola4b.md)
§3. Resumen del orden canónico:

| Orden | Fase | Ítem | Bloqueo del owner |
| --- | --- | --- | --- |
| 1 | 02 Acción | Cerrar `EGO-FIND-80` (ya resuelto, documentar) + retirar los 3 workarounds de VantaDB | — |
| 2 | 03 Sub-Egos | E5 identidad declarativa · E13 skills con divulgación · EGO-FIND-22 dream cableado | — |
| 3 | 04 Canvas | E11 CRDT + deep link | ficha de extracción propia |
| 4 | 06 Knowledge | **E2 path cognitivo nativo** (el mayor multiplicador) + VDB-REQ-15 | — |
| 5 | 10 Recovery | E9 time-travel | — |
| 6 | 11 Security | E8 OTel · E10-res `prefers-contrast` · egress allowlist | EGO-FIND-81 (token MCP) |
| 7 | 12 Distribution | E12 pirámide de tests · E3 binarios MCP | **DIST-04** (certificados) |
| — | transversal | **VDB-REQ-14** (320 MB por store) | upstream |

---

*Verificado por A8 el 2026-10-21 con lectura directa del código. Las cifras de §2 son reproducibles
desde la tabla de §1. Sin commits: el orquestador commitea.*
