# VERDICT — Ola 1 de remediación (2026-10-19) #

| Campo | Valor |
| --- | --- |
| Estado | Arbitro de la Ola 1 · referencia para la Ola 2 |
| Owner | A8 (sesión `ses_ea9e4f315ffeu3tvSJNKIJHi4q`) |
| Fecha | 2026-10-19 |
| Matriz con evidencia | [`docs/research/arquitectura-master-matrix.md`](../../../research/arquitectura-master-matrix.md) |

> **Ámbito de este documento:** estado final de la Ola 1 (Bloques 0+A+B+C+D) y plan de cierre de la
> **Ola 2 (Bloque E)**. Arbitro: **A8** (contraste con el documento maestro de 22 secciones).
> **Matriz con evidencia completa:** [`docs/research/arquitectura-master-matrix.md`](../../../research/arquitectura-master-matrix.md).
> **Plan de la ola:** [`README.md`](./README.md) · **Mi plan:** [`A8-maestro.md`](./A8-maestro.md).

---

## 1. Matriz final — documento maestro (22 secciones) vs Ego #

**Fecha de verificación: 2026-10-19** (post-ola, código real).

| Estado | Secciones | Nº |
| --- | --- | --- |
| ✅ Implementado | — | **0** |
| 🟡 Parcial | 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22 | **19** |
| ❌ Ausente | 7 | **1** |
| 🚫 Descartado por decisión | 14 | **1** |
| ➖ No aplica (desktop local-first) | 1 | **1** |

**Alineación: ~43 % bruto / ~62 % contra el alcance adaptado de Ego.** Las cifras previas (51 %, 68 %)
son sobreestimaciones: no descontaron los bloques formalmente descartados por ADR-0011.

**Cambio neto de la Ola 1 en esta matriz:** §11 (seguridad agéntica) pasó de ❌ a 🟡 con el canal dual
y taint tracking reales (`packages/runtime/src/TrustBoundary.ts`). Ninguna sección llegó a ✅.

---

## 2. Qué se cerró en la Ola 1 #

| Finding | Qué lo cerró | Evidencia |
| --- | --- | --- |
| `EGO-FIND-20` | Crash del chat virtualizado | `apps/desktop/renderer/components/chat/ChatMessageList.tsx:82-116` + `apps/desktop/renderer/test/ChatVirtualizationAppend.test.tsx` + `docs/adr/0014-virtualizacion-chat-virtua.md` |
| `EGO-FIND-21` | `ContextCompaction` era código muerto | `apps/desktop/src/main.ts:2731,2596-2603` + `docs/adr/0017-context-compaction-llm-inyectable.md` |
| `EGO-FIND-22` (parcial) | Delegación de Sub-Egos cableada | `apps/desktop/src/main.ts:2917` + `packages/subegos/src/DelegationRuntime.ts:88` |
| `EGO-FIND-32/33` | Terminal: allowlist real + env saneado + proxy de secretos | `packages/tools/src/native/terminal/TerminalCommandPolicy.ts:288-331` · `packages/integrations/src/mcp/SecretProxy.ts:32-120` |
| `EGO-FIND-34/35` | Namespaces canónicos y `metadata.source` forzado | `apps/desktop/ego.namespaces.json` (26 namespaces) |
| `EGO-FIND-36` | Cascada de decisión de 3 niveles viva | `packages/decision/src/DecisionRouter.ts:50-54` + `apps/desktop/src/main.ts:2977` |
| `EGO-FIND-37..40` | Backoff, capabilities, coste, complejidad, `cache_control` | `packages/models/test/ModelRouter-resilience.test.ts:388-450` |
| `EGO-FIND-41` | MMR con coseno real | `packages/knowledge/src/similarity.ts:43` |
| `EGO-FIND-42` | GraphRAG con arista nativa | `packages/knowledge/src/GraphRagEngine.ts:284-320` + `packages/memory/EgoMemoryAdapter.ts:1100` |
| `EGO-FIND-45` | Catálogo fantasma eliminado | `packages/tools/src/ToolContract.ts:51` + `packages/subegos/src/SubEgoRegistry.ts:285` |
| `EGO-FIND-46` | MCP Server de Ego implementado | `packages/integrations/src/mcp/McpServer.ts` (**implementado, no arrancado** — ver §4) |
| `EGO-FIND-47/48` | Registry de Canvas dinámico | `packages/ui-runtime/src/ComponentRegistry.ts:55-196` + `apps/desktop/renderer/components/canvas/registry.ts:3,58` |
| `EGO-FIND-50` | `manage_background_task` | `packages/tasks/src/BackgroundTaskTools.ts` + `apps/desktop/src/main.ts:3038` |
| `EGO-FIND-51` | Proactividad con triggers reales | `apps/desktop/src/main.ts:3070-3102` (cron + `fs.watch`) |
| `EGO-FIND-60` | Taint tracking + canal dual (CaMeL) | `packages/runtime/src/TrustBoundary.ts:20-128` + `packages/runtime/src/ToolExecutionLoop.ts:335,500-511` |
| `EGO-FIND-79` | Duplicado del documento maestro eliminado | Raíz borrada; única copia en `docs/research/` con encabezado "research externo — NO normativo" |
| `EGO-FIND-24/25/67/68/70` | Avatar: licencia, sync SHA-256, geometría propia | `handoff/A6.md` |
| `EGO-FIND-75/76/77` | Reconciliación documental y ADRs 0001-0017 | `docs/adr/`, `docs/roadmap/` |

**Conteo: 23 findings cerrados o Advanced.** El gate de integrity del P0 (0 de 7 commits íntegros) pasa a
**5 de 7 commits íntegros** (`1532e38` sigue en "mitad" por `DreamConsolidator`; `b411524` y `135afdc`
siguen parciales por deuda menor).

---

## 3. Plan de cierre — Ola 2 (Bloque E) #

**Regla de orden heredada de `AGENTS.md` §6:** *una fase completa antes de la siguiente*. El orden
siguiente respeta la progresión por fases, **no** el valor de negocio.

### Estado de la Ola 2 (verificado 2026-07-20, remedido por A1) #

| Id | Capacidad | Estado tras la Ola 2 | Evidencia |
| --- | --- | --- | --- |
| **E1** | Ejecución paralela de tool calls | ✅ **CERRADA** (A2) | Diseño en 3 fases (preparación secuencial → ejecución concurrente → emisión secuencial). **Medición**: `N=6 L=100ms C=3 → real=220ms` (paralelo teórico 200 ms, serie 600 ms), `concurrencia_max_observada=3`. Test: `ToolExecutionLoop-parallel.test.ts` (6). Cierra `EGO-FIND-43`. La constraint del proveedor se verificó contra el **source del SDK** (doc oficial geobloqueada por región) → `EGO-FIND-80` abierta. |
| **E6** | Descomposición de `main.ts` | ✅ **CERRADA** (A4) | `main.ts`: 5 401 → 5 507 → 2 857 → **1 287 líneas** (objetivo < 1 500, con 213 de margen). **20 módulos** extraídos bajo `apps/desktop/src/main/`. **0 `let` de módulo** mutables fuera de `app-context.ts` (medido). La deuda pasó a ser **gate de CI**: `apps/desktop/test/e6-runtime-state.test.ts` (4 comprobaciones: sin `let` global, `app-context` con setter por estado, `main.ts` < 1 500, handlers IPC en su sitio). Cierra `EGO-FIND-54`. **Residual**: bloque del tray (~190 líneas) + 3 bloques cohesivos (~170 líneas) → Ola 3. |
| **E7** | DOMPurify + CSP `img-src` + egress | ✅ **CERRADA** | **DOMPurify** aplicado (`apps/desktop/renderer/lib/sanitize-html.ts:39`, allowlist estructural, recursos solo locales). **CSP** construida por `buildCsp()` (`electron-security.ts:104`) y aplicada vía `session.defaultSession.webRequest.onHeadersReceived` (`create-window.ts:985-990`): `default-src 'self'` · `script-src 'self'` (packaged) · `style-src 'self' 'unsafe-inline'` · **`img-src 'self' data: blob:`** · `frame-src 'self'` · `object-src 'none'` · `frame-ancestors 'none'` · `base-uri` · `form-action`. Cierra `EGO-FIND-61`. |
| **E10** | OKLCH + 6 hallazgos AA | 🟡 **PARCIAL** | **Cerrado**: OKLCH (A4, 4 paletas, `ThemeTokensOklch.test.tsx`), `docs/design/DESIGN.md` (A1) y los **6 `it.fails` de contraste → 0 `it.fails` en todo el repo**: el contraste pasó a ser una aserción real calculada sobre `theme-tokens.css` (`wcagRatio(...) ≥ 4.5`), lo que además mata la divergencia de las paletas hardcodeadas. Cierra `EGO-FIND-71`. **Pendiente**: `prefers-contrast` (**0 coincidencias** en el renderer) y `@container` (1 sola coincidencia, en `floating/floating.css:593`). |
| — | Estado `warning` del motor + encadenado en el renderer | ✅ **CERRADA** (A6 + A4) | Motor: estado `warning` con tinte ámbar `hsl(48 92% 55%)`, pose `warn` e insignia `⚠` **nuevas**, `sway`, glow 0.4, sonido `tick` (`packages/avatar/src/runtime/states.js:36,86,127`), puente al studio 1:1. Renderer: resolución extraída a **función pura** (`components/character/avatar-live-state.ts`) y `case "warning"` en el mapa (`CharacterBadge.tsx:90`). **Medido**: golden **168 → 174**, `geometry:check` **174/174**, `node --test packages/avatar/tests/` **274 pass / 0 fail** (266 + 8). Registrado como `EGO-FIND-84`. |
| — | **Guard de contrato de estados** (puerta) | ✅ **CERRADA** (A4) | `apps/desktop/renderer/test/avatar-state-contract.test.ts` (7 tests): enumera **TODOS** los `CharacterState` y comprueba que cada uno existe en el motor, que **ninguno cae en el `idle` de reserva** (el síntoma exacto de «falta el `case`») y que los conjuntos de señal del chat y del motor coinciden. Registrado como `EGO-FIND-85`. |
| — | **Round-trip Ego → studio → Ego** | ✅ **CERRADA** (A4 detectó, A6 cerró) | 4 estados perdían la identidad (`thinking`, `approval`, `question`, `ratelimit`). **Medido** sobre el mapa real (`packages/avatar/src/studio/adapter.js`): **15/15 estados con round-trip identidad, 0 LOSSY**. `ratelimit` deja de compartir imagen con `warning` y pasa a `bored` (6 combos nuevos en la golden). |
| — | `correlationId` (turno → tool → evento) | ✅ **CERRADA** (A2) | `packages/events/src/correlation.ts` es la implementación canónica (migrada de `scripts/correlation.mjs`, que no era importable desde un paquete del workspace). El loop deriva un **span hijo determinista por tool call** y lo propaga en `tool.started`/`tool.executed`/`tool.failed`/`approval.required`/`approval.resolved`. Cierra `EGO-FIND-74`. |
| — | Vitest 3 en los manifiestos | ✅ **CERRADA** (A2) | **20 de 20** manifiestos con campo `vitest` declaran `^3.2.7`; **0** en `^2.1.2`. El **override `vitest` de la raíz se eliminó** (con él, los tests corrían bajo v3 mientras el manifiesto decía `^2.1.2`: el ratchet era verde sobre una mentira). `pnpm-lock.yaml` con 21 entradas `^3.2.7`. |
| — | Corpus legal fuera del lint | ✅ **CERRADA** (A7) | El corpus de atribución MIT (30 ficheros de terceros) ya no se lintea como código de Ego; ratchet recalibrado. Cadena MIT resoluble (`attribution:check` → *"CADENA MIT RESOLUBLE"*). |
| — | Electron fuera de EOL | ✅ **CERRADA** (A4) | `electron` `^33.2.0` (33.4.11, EOL) → **`^41.10.7`**, y el `pnpm.overrides` que aplicaba el salto sin tocar el manifiesto (prohibido por **D1**) **desaparece**. Cierra `EGO-FIND-23`. |
| **E2** | Path cognitivo nativo | ⏸️ **Pendiente — el mayor multiplicador** | El binding `vantadb-node@0.8.0` ya expone `graphragSearch`, `memoryRecall` (con `trust_aware`), `contextAssemble`, `memoryConsolidate` y `memoryReinforce` (`index.d.ts:603-636`), pero **solo `graphragSearch` está cableado**. Antes de cablear el resto hay que pasar la **puerta de invariantes** del [ADR-0020](../../../adr/0020-compactacion-motor-ts-vs-nativo.md): ¿el `contextAssemble()` nativo preserva el system prompt y los pares `tool_call`/`tool_result`? Si no → petición upstream (`VDB-REQ-13`, ya abierta). Cierra `EGO-FIND-29`. |
| **E3** | Binarios MCP embebidos + firma | ⛔ **BLOQUEO OWNER** | `DIST-04` (certificados de firma). |

### Decisiones del owner ratificadas el 2026-07-20 #

| Decisión | Contenido | Registro |
| --- | --- | --- |
| **D-A** | Transporte del MCP Server de Ego → **HTTP streamable en `127.0.0.1`, in-proceso en main** (no proceso hijo stdio). | `docs/adr/0021-mcp-server-transporte-y-token.md` |
| **D-B** | El token del MCP Server **no se expone al renderer**; vive solo en main (keychain). | `docs/adr/0021-mcp-server-transporte-y-token.md` · `EGO-FIND-81` |
| **D-C** | El motor de personaje canónico es **`@ego/avatar`** (repo `avatar`), no la FSM legacy. | `docs/adr/0018-motor-de-personaje.md` §"Retirada de la FSM legacy" |

### Ola 2 · Orden canónico por fase #

| Orden | Fase | Id | Capacidad | Tipo | Depende de |
| --- | --- | --- | --- | --- | --- |
| 1 | 02 Acción | **E1** | Ejecución paralela de tool calls | (a) deuda técnica | `EGO-FIND-43` — bloqueada por Anthropic (orden de `tool_result`). **Decidir: reordenar o agrupar servidores con `tool_use` paralelos** |
| 2 | 02 Acción | **E4** | Exportadores de artefactos (PDF/DOCX/XLSX/PPTX) + REPL Python | (b) capacidad nueva | Sin Python (guardrail §4): implementación TS |
| 3 | 02 Acción | **E6** | Descomposición de `main.ts` (5 507 → <1 500) | (a) deuda técnica | — |
| 4 | 03 Sub-Egos | **E5** | Identidad declarativa (`SOUL.md`/`AGENT.md`) + budget circuit breakers | (b) capacidad nueva | — |
| 5 | 03 Sub-Egos | **E13** | Skills con divulgación progresiva (`lookup_skills`) + `expand_tools` + ejecutor real de delegación | (b) capacidad nueva | — |
| 6 | 04 Canvas | **E11** | CRDT (Yjs) en el Canvas + deep linking | (b) capacidad nueva | — |
| 7 | 06 Knowledge | **E2** | Path cognitivo nativo de VantaDB: RRF real, `memoryRecall`/`contextAssemble`/`memoryConsolidate`/`memoryReinforce`, embeddings | (b) capacidad nueva | El binding `vantadb-node@0.8.0` **ya expone** `graphragSearch`, `memoryRecall`, `contextAssemble`, `memoryConsolidate`, `memoryReinforce` (`index.d.ts:603-636`); solo `graphRagSearch` está cableado (`packages/memory/EgoMemoryAdapter.ts:1100`) |
| 8 | 10 Recovery | **E9** | Time-travel y bifurcación desde checkpoint | (b) capacidad nueva | — |
| 9 | 11 Security | **E7** | DOMPurify + CSP `img-src` + egress allowlist | (a) deuda técnica | — |
| 10 | 11 Security | **E10** | OKLCH completo + 6 hallazgos AA + `prefers-contrast` + `@container` + `DESIGN.md` raíz | (a) deuda técnica | — |
| 11 | 11 Security | **E8** | OpenTelemetry/OTLP + sink de disco para `StructuredLogger` | (b) capacidad nueva | — |
| 12 | 12 Distribution | **E12** | Pirámide de tests: E2E real, Storybook, MSW, Lighthouse CI | (a) deuda técnica | Depende del cierre de A7 |
| 13 | 12 Distribution | **E3** | Binarios MCP embebidos (uv/bun) + firma de instalador | (a) deuda técnica | `DIST-04` (bloqueo owner: certificados) |

### Clasificación exigida por el plan A8 #

- **(a) Deuda técnica de Ego — arreglar ya:** E1, E3, E6, E7, E10, E12.
- **(b) Capacidad nueva — exige fase propia con ficha de extracción:** E2, E4, E5, E8, E9, E11, E13.
  Cada una necesita su ficha en `docs/extractions/` o su ADR antes de codificar (§4 del README de la ola).
- **(c) Descartado — no vuelve:** Tauri v2, daemon 24/7, omnicanal, PostgreSQL/pgvector, Qdrant, Neo4j,
  MicroVMs/gVisor, LangGraph/Temporal/Pydantic-AI/LiteLLM, SSR/RSC, SQLite-WASM en renderer, nivel 4 de
  permisos, sandboxes cloud. Fundamento: `docs/adr/0011-stab14-asimilados-descartes.md`.

### Reglas de la progresión por fases (no negociables) #

1. E1/E4/E6 (Fase 02) se cierran **antes** de tocar Fase 03+.
2. E2 (Fase 06) no puede empezar hasta que las Fases 03-05 estén `VERIFIED`.
3. E7/E10/E8 (Fase 11) cierran después de Fase 10.
4. E3/E12 (Fase 12) son las últimas y arrastran el bloqueo de owner de `DIST-04`.

---

## 4. Reasignaciones de ficheros entre agentes (T7 — guardián del contrato) #

Solicitudes fuera de zona detectadas en los handoffs, con estado verificado a 2026-10-19.

### 4.1 Aplicadas por A4 durante la Ola 1 #

| # | Origen | Fichero | Cambio | Estado |
| --- | --- | --- | --- | --- |
| 1 | A2 #1 | `apps/desktop/src/main.ts` | Instanciar `ContextCompactionJob` | ✅ `main.ts:2731` |
| 2 | A2 #2 | `apps/desktop/src/main.ts` | `DecisionRouter` con `scorerProvider` | ✅ `main.ts:2977` |
| 3 | A2 #3 | `apps/desktop/ego.namespaces.json` | JSON de namespaces regenerado | ✅ 26 namespaces |
| 4 | A3 #1 | `apps/desktop/src/main.ts` | Instanciar delegación y registrar sus 6 tools | ✅ `main.ts:2917` |
| 5 | A3 #2 | `apps/desktop/src/main.ts` | Registrar `manage_background_task` | ✅ `main.ts:3038` |
| 6 | A3 #3 | `apps/desktop/src/main.ts` | Enganchar cron + file-watch | ✅ `main.ts:3070-3102` |
| 7 | A3 #6 | `apps/desktop/src/main/terminal-policy.ts` | Reexportar la allowlist canónica | ✅ `terminal-policy.ts:19,44` |
| 8 | A3 #7 | `apps/desktop/src/main.ts` | `releaseLockAsync()` en el apagado | ✅ `main.ts:5928` |
| 9 | A3 #8 | `apps/desktop/renderer/components/canvas/registry.ts` | Migrar al `CanvasComponentRegistry` dinámico | ✅ `registry.ts:3,58` |
| 10 | A2 #4 | `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` | Entradas `VDB-REQ-08..11` | ✅ 4 entradas presentes |

### 4.2 Pendientes — reasignadas por A8 #

| # | Origen | Fichero | Cambio pedido | Dueño asignado | Bloqueante |
| --- | --- | --- | --- | --- | --- |
| R1 | A3 #4 | `apps/desktop/src/main.ts` | Arrancar el `EgoMcpServer` (`packages/integrations/src/mcp/McpServer.ts` existe y está testeado; **0 instanciaciones en `src/`**). Requiere decidir transporte: proceso hijo stdio vs. socket local | **A4** (Ola 1, cierre) | Falta decisión de transporte |
| R2 | A3 #5 | `apps/desktop/src/main.ts` | Pasar el `secretResolver` (keychain) al `McpClient`. `McpClient` lo soporta (`packages/integrations/src/mcp/McpClient.ts:81,118`) pero `main.ts` no lo inyecta → los marcadores `{{SECRET:…}}` viajan sin resolver | **A4** (Ola 1, cierre) | — |
| R3 | A3 #9 | `apps/desktop/renderer/components/domains/DomainCanvasView.tsx` | Eliminar las 10 ramas `domainId === "…"` (`:228,244,257,292,304,426,501,626,827,859`) → resolver por `componentKind` contra el registry | **A4** (Ola 1, cierre) | — |
| R4 | A3 #11 | `packages/security/src/ToolPermissions.ts` | Delegar en `NetPolicy` de `@ego/tools` o eliminar la réplica léxica (`:147`, `:346` — el propio comentario admite "réplica léxica de NetPolicy; sin DNS aquí") | **A2** (Ola 2, E7) | Dos políticas de red divergentes |
| R5 | A3 #12 | `packages/execution/src/ExecutionManager.ts` | Circuit breaker por tool + quota por Sub-Ego | **A2** (Ola 2, E1) | — |
| R6 | A2 #8 | `apps/desktop/renderer/**` + `.github/workflows/**` | `EGO-FIND-61`: DOMPurify + CSP `img-src` en el chat | **A7** (CSP) + **A4** (DOMPurify) → Ola 2 **E7** | — |
| R7 | A2 #5 | `docs/adr/` | ADR del canal dual (CaMeL) para `packages/runtime/src/TrustBoundary.ts` | **A1** (Ola 1, cierre) | — |
| R8 | A2 #6 | `docs/architecture/memoria-vantadb.md` | §2 (punto 10) afirma que "Ego no construye su propio algoritmo heurístico de poda de tokens en TypeScript" — **contradicho** por `ContextCompaction.ts` y por el `compact()` nativo del binding | **A1** (Ola 1, cierre) | — |
| R9 | A2 #7 | `docs/architecture/namespaces.md` + `AGENTS.md` | La línea "knowledge ← búsqueda híbrida **RRF**" describe una capacidad que no existe en el fast path (BM25 puro) | **A1** (Ola 1, cierre) | — |
| R10 | A6 #6 | `docs/adr/0018-motor-de-personaje.md` | Crear el ADR con el texto que entrega A6 en su handoff | **A1** (Ola 1, cierre) | Texto listo en `handoff/A6.md:181-274` |
| R11 | A6 #7 | `docs/roadmap/Backlog.md` | Marcar `EGO-FIND-24`, `EGO-FIND-25`, `EGO-FIND-67`, `EGO-FIND-68`, `EGO-FIND-69`, `EGO-FIND-70` como resueltos | **A1** (Ola 1, cierre) | `EGO-FIND-69` depende de A4 |
| R12 | A6 #8 | `AGENTS.md` | Anotar la excepción de tipado del motor de avatar (JS plano + `checkJs`) | **A1** (Ola 1, cierre) | — |
| R13 | A6 #1 | `.github/workflows/**` | Ejecutar `pnpm --filter @ego/avatar sync:check` y `geometry:check` en CI | **A7** (Ola 1, cierre) | — |
| R14 | A6 #4 | `apps/desktop/**` | Archivar o eliminar `CharacterCanvas.tsx` y `CharacterMiniBadge.tsx` (0 usos) | **A4** (Ola 1, cierre) | — |
| R15 | A6 #5 | `apps/desktop/renderer/components/character/**` | Decidir si `CharacterStateMachine` se instancia o se retira (FSM de 14 estados nunca instanciada) | **A4** (zona) + decisión del owner | Decisión de producto |
| R16 | A5 §3.1-3.5 | según tabla | 5 bloques de solicitudes de A5 a A1/A2/A3/A4/A6 | **según destino** | Ver `handoff/A5.md:114-181` |
| R17 | — | `docs/research/README.md` | Añadir la entrada de la nueva matriz `arquitectura-master-matrix.md` al hub de research y marcar el documento maestro como no normativo | **A5** o **A1** (dueño de `docs/index.md`) | Fuera de la zona de A8 |

---

## 5. Lista consolidada de commits pendientes (para el orquestador) #

> Un commit por fichero o grupo lógico. Sin `--force`. conventional commits en inglés.

| # | Ámbito | Fichero | Mensaje sugerido |
| --- | --- | --- | --- |
| C1 | A8 | `docs/research/arquitectura-master-matrix.md` | `docs(research): add master-document contrast matrix with 22 verified sections` |
| C2 | A8 | `docs/research/Arquitectura y Diseño de Sistemas para Plataformas y Agentes de IA.md` | `docs(research): mark master document as external non-normative research` |
| C3 | A8 | `Arquitectura y Diseño de Sistemas para Plataformas y Agentes de IA.md` (borrado) | `chore(docs): remove untracked duplicate of the master research document` |
| C4 | A8 | `docs/agent-ops/plans/2026-10-19-remediation-wave1/VERDICT.md` | `docs(agent-ops): record wave-1 verdict and wave-2 closure plan` |
| C5 | A8 | `docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A8.md` | `docs(agent-ops): add A8 handoff` |
| C6 | A1 | `docs/adr/0018-motor-de-personaje.md` | `docs(adr): record the character engine decision` |
| C7 | A1 | `docs/adr/0019-canal-dual-taint-tracking.md` | `docs(adr): record the dual-channel taint boundary` |
| C8 | A1 | `docs/architecture/memoria-vantadb.md`, `docs/architecture/namespaces.md` | `docs(architecture): reconcile compaction and RRF claims with the code` |
| C9 | A1 | `docs/roadmap/Backlog.md` | `docs(roadmap): close resolved findings from wave 1` |
| C10 | A1 | `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` | `docs(vantadb): register VDB-REQ-08..11 workarounds` |
| C11 | A1 | `AGENTS.md` | `docs: document the avatar typing exception` |
| C12 | A4 | `apps/desktop/src/main.ts` | `feat(desktop): wire the Ego MCP server and the secret resolver` |
| C13 | A4 | `apps/desktop/renderer/components/domains/DomainCanvasView.tsx` | `refactor(renderer): resolve domain views through the dynamic registry` |
| C14 | A4 | `apps/desktop/renderer/components/character/**` | `chore(renderer): remove the unused character canvas components` |
| C15 | A7 | `.github/workflows/**` | `ci: add avatar sync and geometry gates, and the electron e2e job` |
| C16 | A7 | `apps/desktop/renderer/**` (CSP) + `tests/gui/**` | `feat(security): enforce CSP img-src and reactivate the electron e2e suite` |
| C17 | A2 | `packages/security/src/ToolPermissions.ts` | `refactor(security): delegate network checks to the canonical NetPolicy` |
| C18 | A3/A4 | `apps/desktop/src/main.ts` (DreamConsolidator) | `feat(tasks): wire the dream consolidator into the curator job` |
| C19 | A5/A1 | `docs/research/README.md`, `docs/index.md` | `docs: index the master-document contrast matrix` |

---

## 6. Veredicto de la ola #

**Estado de la Ola 1: PARTIAL.** El Bloque A (integridad de la remediación P0) está **sustancialmente
cerrado**: 4 de los 5 defectos del Plan P0 (compactación muerta, crash del chat, selects nativos,
44 px) están resueltos y verificados por test. El Bloque B (seguridad) está **sustancialmente cerrado**
en su parte difícil (taint + canal dual, secret proxy, allowlist de terminal, NetPolicy con DNS) pero
**deja abiertos** DOMPurify/CSP y el egress firewall. El Bloque C (honestidad documental) está
cerrado salvo las 5 reasignaciones R7-R12 de §4.2.

**El riesgo residual mayor de la ola es la regresión de `main.ts`:** pasó de 5 401 a 5 507 líneas
mientras cableaba la ola. Cerrar cuatro defectos no reduce la deuda estructural; la
descomposición (E6) debe ser la primera tarea estructural de la Ola 2, no la última.
*(Actualización 2026-07-20: E6 está en curso y `main.ts` ya va de 5 507 a **1 520** líneas
con 20 módulos extraídos bajo `apps/desktop/src/main/`; el objetivo < 1 500 queda a 20 líneas.)*

**La brecha más urgente de la Ola 2 es E7 (DOMPurify + CSP):** es la única pieza del documento maestro
que es simultáneamente (a) requisito de seguridad frontend, (b) no descartada por ninguna decisión,
(c) de esfuerzo bajo (una dependencia + una cabecera CSP), y (d) la que cierra la última pata de §11,
la sección con más peso documental sin cumplir.

---

## 7. Ola 3, 4 y 4b — CERRADAS · Ola 5 — en curso #

**Estado 2026-07-20 (Ola 2) → 2026-07-21 (Olas 3, 4, 4b y 5), remediado por A1.**

La Ola 2 cerró **E1** (paralelismo), **E6** (descomposición de `main.ts`), **E7**
(DOMPurify + CSP), el estado **`warning`** del motor **con su encadenado en el
renderer**, el **guard de contrato de estados**, el **round-trip** Ego→studio→Ego,
`correlationId`, **vitest 3**, el corpus legal fuera del lint y **electron** fuera
de EOL. La **Ola 3** cerró **Fase 02 completa + 3 transversales**; la **Ola 4/4b**
cerró **Fase 03 (E5 + E13)**, el **design system** (6 ítems) y la **auditoría
visual desacoplada**.

### 7.0 Ola 3 — cerrada (verificado 2026-07-21) #

| Id | Capacidad | Estado | Evidencia |
|---|---|---|---|
| **E4** | Exportadores de artefactos (PDF/DOCX/XLSX/PPTX) + REPL | ✅ **CERRADA** (A3) | Escritor ZIP propio (PKWARE APPNOTE 6.3.3) + escritor PDF 1.7 propio sobre `node:zlib`: **cero dependencias**, cero licencias ambiguas, cero cambios de empaquetado Electron. El «REPL Python» es un **REPL de expresiones en TypeScript** (`eval_expression`): intérprete propio (tokenizador → parser → evaluador), **sin `eval`/`new Function`/`node:vm`/`child_process`**. → [ADR-0022](../../../adr/0022-exportadores-de-artefactos.md) |
| **E6-res** | Remate de la descomposición de `main.ts` | ✅ **CERRADA** (A4) | `main.ts`: 1 288 → **866 líneas** (objetivo < 1 100). El bloque del **tray** y los 3 bloques cohesivos se extrajeron; los 0 `let` globales siguen bajo el gate `test/e6-runtime-state.test.ts`. |
| **T-X1** | La fuga de 320 MB por corrida | ✅ **CERRADA** (A3 + A4) | Medido: **1 044 MB** retenidos por corrida (3 × 320 MB + 3 × 64 MB) → delta de disco libre **−1 044 MB**. **El hallazgo de raíz no era un residuo de datos: es la PREASIGNACIÓN del motor** ⇒ se registró como **`VDB-REQ-14`**. |
| **T-X2** | Normalizar las 15 entradas legacy del registro de VantaDB | ✅ **CERRADA** (A1) | Las 25 entradas tienen ya `Estado:`, `Impacto en Ego:` y `archivo:línea` en el `Componente`. El gate `scripts/verify-vantadb-ids.mjs` bajó de **24 avisos a 3** (los 3 restantes son W2: peticiones puramente upstream). |
| **EGO-FIND-64** | `vantadb-node` por `file:` fuera del repo | ✅ **CERRADA** — *el bloqueo upstream desaparece* | **`vantadb-node@0.9.0` está publicado en npm** (Apache-2.0; win32/darwin/linux; x64+arm64; con firmas y `sha512`). Queda solo aplicar el cambio en los 2 manifiestos (A7). |
| **E2-bis** / **T-X3** | Contrastar la constraint del proveedor contra la **doc oficial** de Anthropic | ✅ **CERRADA** (A8, Ola 4b) | **La premisa era incorrecta**: la doc oficial **no prescribe orden de ejecución** (*«The API doesn't prescribe an execution order… you can run the calls concurrently»*) y exige **emparejar por `tool_use_id`**, no por posición. El orden secuencial obligatorio aplica **solo** a los *batch actions* de `computer use`/`browser use`, que Ego no usa. Citas textuales + URLs en `docs/research/verificacion-anthropic-tool-order.md` §4. **Cierra `EGO-FIND-80` y desbloquea `EGO-FIND-43` sin tocar código**: la implementación de A2 es **más estricta** que la API. |

### 7.1 Ola 4 y 4b — cerradas (verificado 2026-07-21) #

| Id | Capacidad | Estado | Evidencia |
|---|---|---|---|
| **E5** | Identidad declarativa (`SOUL.md`/`AGENT.md`) + circuit breakers de presupuesto | 🟡 **IMPLEMENTADA, NO INTEGRADA** (A3) | Artefacto declarativo con cargador **fallback + fail-closed + confine** (`packages/subegos/src/SubEgoIdentity.ts`, 274 líneas) y `SubEgoBudgetCircuitBreaker` con **tres dimensiones** (tokens, coste y **tiempo**) y tres acciones medibles (permitir / degradar / detener con error tipado). → [ADR-0024](../../../adr/0024-identidad-declarativa-y-presupuestos.md). **Lo que falta:** A2 debe exponer `getMaxCostPerCallUsd()`/`resolveCheaperModel()` en `@ego/models` y A4 tiene **3 diffs de producción pendientes** ⇒ **no es alcanzable desde la app**. `EGO-FIND-88`/`89` quedan 🟡, no ✅. |
| **E13** | Metatools de divulgación progresiva (`lookup_skills`, `search_tools`, `expand_tools`) | 🟡 **IMPLEMENTADA, NO INTEGRADA** (A3) | Los 3 metatools en `packages/tools/src/meta/metaTools.ts`, gobernados por el **registro confinado** (un metatool ve sólo lo que su registro ve: no sirve para escalar privilegios). **Lo que falta:** registrarlos en el `ToolRegistry` que ve el chat (A4) ⇒ la escalera de divulgación es inaccesible desde el producto. `EGO-FIND-90` queda 🟡. |
| **Design system** | 6 ítems del design system | ✅ **CERRADO** (A4) | La puerta `design-lint` **corre ya en local** (es el `pretest` del renderer) · el contraste de los **tintes compuestos** del `Badge` está cubierto y **3 tokens `error`** corregidos (4,42–4,54:1 → **4,73–4,80:1**) · `Menu.ariaLabel` **nombra el menú** · `Button.trailing` nueva + **8 sitios migrados** + **2 hacks eliminados** · **R7** ve las tablas `cva` · **R12** nueva: la puerta analiza el CSS (deuda heredada nombrada `EGO-DL-024`). → `EGO-FIND-91` · `EGO-FIND-92` |
| **Auditoría visual** | Desacoplar la auditoría del compositor de `ego-lite` | ✅ **CERRADO** (A4) | **Dos caminos, un solo spec**: `design-audit-spec.mjs` (compartido) + `ego-browser-audit.mjs` (referencia) + `design-audit-headless.mjs` (**rescate** con Chromium headless) y el wrapper `run-design-audit.ps1` que **cae al rescate** si el compositor no produce pasos (criterio `stepsOk === 0`). Verde: **6/6 pasos · 0 infracciones · 6 capturas · exit 0, 2 corridas seguidas**. Se corrigieron **2 falsos positivos** (con test que impide relajarlos) + **1 defecto real de layout** (`-mr-3` → `-mr-2`). → `EGO-FIND-93` |
| **`correlationId`** | La ruta de error también | ✅ **CERRADO** (A4) | El `correlationId` del turno se propaga al loop y **cubre `tool.failed`**: el turno fallido lleva la misma raíz. Con test de integración sobre bus y loop reales. |
| **Resolución de `vantadb`** | El motor del producto, en todas partes | 🔄 **EN CURSO** (A7) | **La Ola 4 destapó que el motor no era el mismo según el directorio** (ver §7.2). A7 está cerrando la resolución. |
| **E2** | Path cognitivo nativo | 🟡 **DESBLOQUEADA por alcance** (A2-bis, Ola 5) | La **invariante está VERDE** (§7.2) y el **puente de alcance funciona**: `db.inner` es alcanzable en runtime y es un `VantaDb` ⇒ **no hace falta un fix upstream para el path cognitivo**. El puente HybridRuntime (`packages/memory/CognitivePath.ts`, `resolveCognitiveBinding`) prefiere la API pública de la fachada y sólo cae a `inner` si no está; *fail-soft*, en una función. Las 5 APIs quedan cableadas en `EgoMemoryAdapter` (`:1147` graphRagSearch · `:1169` memoryRecall · `:1219` contextAssemble · `:1251` memoryConsolidate · `:1282` memoryReinforce). **Pendiente**: el *call site* que arma el contexto cognitivo. → [ADR-0023](../../../adr/0023-path-cognitivo-nativo.md) |

### 7.2 Ola 5 — la contradicción del repo, resuelta #

**La contradicción:** la Ola 4 (A4, T4.2) concluyó que *«el método no existe»* y
que *«el ADR-0020 presupone algo falso y E2 no puede arrancar»*. **Era falso**, y
el repo se contradecía a sí mismo: el ADR-0020 afirmaba una invariante y el
handoff de A4 la negaba.

**Lo que verifiqué, capa por capa** (3 capas medidas sobre el árbol instalado):

| Capa | ¿Expone `contextAssemble`? | Evidencia |
|---|---|---|
| **`vantadb-node@0.9.0`** (binding napi-rs) | **SÍ** — y las 4 APIs cognitivas más | `index.d.ts:622 contextAssemble`, `:614 memoryRecall`, `:629 memoryConsolidate`, `:636 memoryReinforce` |
| **`vantadb@0.9.0`** (wrapper TS, `vantadb/native`) | **NO** — lista fija de métodos, **sin passthrough dinámico** | `dist/native.d.ts:103`; `dist/native.js:157` → `return new NativeVantaDB(inner)` |
| **`vantadb@0.6.1`** (global, fuera del repo) | **NO** — y **sin `vantadb-node`** | `C:\Users\Eros\node_modules\vantadb` (importaría `VANTADB_NOT_FOUND: Node not found: 7`) |

**Y la resolución depende del directorio:** `packages/memory` →
`node_modules/.pnpm/vantadb@0.9.0` ✅ · `apps/desktop` y `tests` **no declaran
`vantadb`** → caen al **global `0.6.1`**.

**El veredicto corregido:**

- La **premisa del ADR-0020 era correcta** (el binding expone `contextAssemble`) y
  **la invariante está garantizada** (system prompt y pares `tool_call`/`tool_result`
  preservados). **A4 acertó en lo que midió** —`typeof handle.contextAssemble ===
  "undefined"` es cierto para la ruta del producto— **y se equivocó en la
  conclusión**: el fallo era de **alcance**, no de motor.
- **E2 no arranca por alcance, no por calidad del motor.**
- Corregido en: el **ADR-0020** (§2.1 + §Decisión 3 + deuda), el **handoff de A4**
  (corrección fechada en §5.2 y en §7.1/§7.2), el **registro de VantaDB**
  (`VDB-REQ-13` con el matiz + **`VDB-REQ-16`** nueva) y el **Backlog**
  (`EGO-FIND-29` → 🟡 con el estado real, `EGO-FIND-94` nueva).
- **A2 no debe escribir la petición upstream** que A4 le pide en su §7.2: el
  requisito de las invariantes **ya está satisfecho**.

### 7.3 Filas nuevas abiertas en la Ola 5 (8) #

| Id | Qué | Estado |
|---|---|---|
| `EGO-FIND-88` | E5 — la identidad de los Sub-Egos vivía en código | 🟡 Parcial (implementada, no cableada) |
| `EGO-FIND-89` | E5 — sin límite de tiempo ni degradación en el presupuesto | 🟡 Parcial (implementada, no cableada) |
| `EGO-FIND-90` | E13 — 0 metatools: las skills no eran consultables | 🟡 Parcial (implementada, no cableada) |
| `EGO-FIND-91` | La puerta `design-lint` no veía las tablas `cva` ni el CSS | ✅ Completada |
| `EGO-FIND-92` | El contraste no medía los tintes compuestos del `Badge` | ✅ Completada |
| `EGO-FIND-93` | La auditoría visual estaba atada a un compositor que no captura (verde falso) | ✅ Completada |
| `EGO-FIND-94` | `vantadb` se resuelve fuera del repo y el wrapper no expone las APIs cognitivas (`VDB-REQ-16`) | 🆕 Pendiente (A7) |
| `EGO-FIND-95` | **`register-ipc.ts` con 2 570 líneas: el nuevo god file** tras descomponer `main.ts` | 🆕 Pendiente (A4) |

**Backlog tras la Ola 5: 81 ✅ · 6 🟡 · 8 🆕** (95 filas `EGO-FIND`).

### 7.4 El plan vigente (Ola 5 → siguiente) #

| Orden | Fase | Id | Capacidad | Estado / bloqueo |
| --- | --- | --- | --- | --- |
| 1 | 02 Acción | **VDB-REQ-16** | Que el producto pueda llamar al `contextAssemble()` nativo: fachada que re-exponga los métodos + resolución explícita en todo el workspace | 🔄 **EN CURSO** (A7). Es **lo único que separa E2 de arrancar**. |
| 2 | 03 Sub-Egos | **E5/E13 cableado** | Los 3 diffs de producción de A4 + los 2 métodos del router de A2 | 🆕 Sin ellos, `EGO-FIND-88/89/90` no salen de 🟡. |
| 3 | 03 Sub-Egos | **E13 (resto)** | Delegación real y `expand_tools` en el `ToolRegistry` del chat | 🆕 |
| 4 | 04 Canvas | **E11** | CRDT (Yjs) en el Canvas + deep linking | 🆕 |
| 5 | 05 Knowledge | **E9** | Time-travel y bifurcación desde checkpoint | 🆕 |
| 6 | 06 Knowledge | **E2** | Path cognitivo nativo — **desbloqueado en calidad, bloqueado en alcance** | ⛔ Depende de `VDB-REQ-16`. |
| 7 | 06 Knowledge | **VDB-REQ-15** | Re-rank compuesto con confianza de `memoryRecall({ trust_aware: true })` | 🆕 **La capacidad ya existe**: falta el cableado y el contrato con el `TrustBoundary`. |
| 8 | 06 Knowledge | **E5/E13 (resto)** | `memoryRecall`/`memoryConsolidate`/`memoryReinforce` cableados | 🆕 |
| 9 | 07 Tasks | **EGO-FIND-22** | `DreamConsolidator` y `MemoryCurator` sin instanciar | 🆕 `DelegationRouter` ya está instanciado. |
| 10 | 10 Recovery | **E6-res (deuda)** | `register-ipc.ts` (2 570 líneas) — **falta decidir el criterio** antes de tocarlo | 🆕 `EGO-FIND-95`. |
| 11 | 11 Security | **E8** | OpenTelemetry/OTLP + sink de disco | 🟡 Parcial. |
| 12 | 11 Security | **E10-res** | `prefers-contrast` (0 coincidencias) y `@container` (1) | 🟡 Parcial. |
| 13 | 11 Security | **EGO-FIND-86** | La lista blanca de `design-lint` indexada por ID posicional | 🆕 **Se autodesactiva bajo refactor.** |
| 14 | 11 Security | **EGO-FIND-49** | `McpManager.connectServer` sobrescribe tools nativas | 🆕 |
| 15 | 11 Security | **EGO-FIND-81** | Contrato de obtención del token MCP | ⛔ **BLOQUEO OWNER**. |
| 16 | 12 Distribution | **E12** | Pirámide de tests (incluye reactivar los **11 `describe.skip`** de la suite GUI) | 🆕 |
| 17 | 12 Distribution | **E3** | Binarios MCP embebidos + firma del instalador | ⛔ **BLOQUEO OWNER** (`DIST-04`). |

### 7.5 Ola 5 y Ola 6 — el path cognitivo y la integridad del repo #

| Trabajo | Estado | Evidencia |
|---|---|---|
| **Ola 5 · T1** (E5) — el `ModelRouter` expone el presupuesto y la degradación | ✅ **CERRADO** (A2-bis) | `getMaxCostPerCallUsd()` y `resolveCheaperModel()` en `@ego/models`; el tope efectivo pasa a ser el **mínimo** (Sub-Ego, router) y la degradación deja de ser teórica. Test con el breaker **real**, no un mock. |
| **Ola 5 · T2** — `memoryRecall({trust_aware: true})` con el `TrustBoundary` | ✅ **CERRADO** (A2-bis) | `EgoMemoryAdapter.memoryRecall` + `packages/memory/CognitivePath.ts` + `TrustBoundary.trustedAllowPrefixes`/`selectTrustedForInjection`. **Cierra `VDB-REQ-15`** (🟡 → ✅ cableado), verificado contra el motor real (`packages/memory/test/memory-recall-trust.test.ts`, 5 tests). |
| **Ola 5 · T3** — retirada del workaround de `query_vector: []` | ✅ **CERRADO** (A2-bis) | **Cierra `VDB-REQ-02`**: el workaround ya no está en el código. Medido: `search` con `text_query` funciona **sin** `query_vector`. El guard de `VDB-BUG-05` **se conserva** (`text_query: ""` **con** `query_vector: []` lanza). |
| **Ola 5 · T4** — el ADR del path cognitivo y la elección entre las 3 vías | ✅ **CERRADO** (A2-bis) | Las tres vías se midieron, no se supusieron: (i) *upstream* (correcta, no depende de Ego) · (ii) *binding directo* → **imposible en el mismo proceso** (`VANTADB_BUSY`, medido dos veces) · (iii) *HybridRuntime* → **la elegida**. → [ADR-0023](../../../adr/0023-path-cognitivo-nativo.md) |
| **Ola 5 · T5** — retirada del código muerto | ✅ **CERRADO** (A2-bis) | **11 módulos + 2 métodos** retirados, cada uno con su **guard** (`packages/{events,execution,runtime,memory}/test/dead-code-retired.test.ts`) que afirma que el barrel ya no los exporta. `ZeroContextKernel` **no** se retiró: lo usa el sandbox SEC-08.C. `OpaqueId` + `SessionCheckpointPolicy` quedaron **al owner**. |
| **Ola 6 · T1** — rutas rotas del Backlog | ✅ **CERRADO** (A1) | `check-docs-paths` → **exit 0**: 0 enlaces rotos, **0 rutas inexistentes** en docs canónicos. Las 3 filas que citaban módulos retirados y los 2 ADRs (`0011`, `0019`) reescritos con el **artefacto que sustituye al código** (el patrón inline en `McpClient.ts`, el `TrustBoundary`). |
| **Ola 6 · T2** — Backlog ↔ catálogo de extracción | ✅ **CERRADO** (A1) | `verify-backlog-gates` → **exit 0**: **546 filas coherentes** (antes 506). **33 filas** alineadas a `🚫 Descartada (con justificación)` con puntero a la fila canónica, y **7** a `✅ Completada` con el **caller de producción verificado** (no la ruta del upstream, que no existe en Ego). Las 2 celdas con texto descriptivo (`COUC-10`, `DSEK-05`) **reescritas**, no sólo el emoji. |
| **Ola 6 · T3** — publicar el ADR-0023 y actualizar el registro | ✅ **CERRADO** (A1) | ADR-0023 **verificado** antes de publicar (`inner` es campo público en el JS compilado: `native.js:123`; las 5 APIs en `index.d.ts:603,614,622,629,636`; la resolución de `vantadb` **uniforme** en los 3 paquetes) e indexado. Registro: `VDB-REQ-02` (resuelto **y retirado**) · `VDB-REQ-15` (✅ cableado) · `VDB-REQ-16` (b resuelta + a pendiente, con el puente como workaround de Ego) · `VDB-REQ-14` (cuantificada: 320,03 MB de **disco**, ≈ 0,45 MB de **RAM**, 1 store en producción). → 26 hallazgos: **8 resueltos · 4 parciales · 4 persisten · 10 sin verificar**. |

### 7.6 Contabilidad real del Backlog (verificada 2026-10-21, olas 9 y 10) #

> **Recuento medido** sobre `docs/roadmap/Backlog.md` (no una estimación): **123 filas
> `EGO-FIND`** — la serie de hallazgos de la revisión full y de las auditorías posteriores,
> que es la que `scripts/verify-backlog-gates.mjs` contrasta con el catálogo canónico.

| Estado | Filas | % |
|---|---:|---:|
| ✅ Completada | **121** | 98,4 % |
| 🟡 Parcial | **1** | 0,8 % |
| 🆕 Pendiente | **1** | 0,8 % |

> Las **12 tareas canónicas** del roadmap (12 fases + 03.1) están en **149 de 151**
> (las 2 que faltan, `DIST-04` y `DIST-06`, son **bloqueo del owner**: certificados
> de firma y prueba de arranque en VM limpia). El catálogo de extracción de los **25**
> repos de referencia está en **0 tareas en el limbo**. ADRs: **27**.
>
> ⚠️ El árbol se mueve: una **auditoría paralela** abrió `EGO-FIND-104..122` (19
> hallazgos más) y las olas 9-10 los han cerrado casi todos. **Lo que no cambia es
> el criterio**: una fila sólo pasa a ✅ con **evidencia verificable** (fichero:línea o test).

### 7.6.1 Las 2 que quedan abiertas, con su motivo en una línea #

| Id | Estado | Qué falta exactamente |
|---|---|---|
| `EGO-FIND-87` | 🆕 | `VDB-REQ-14` (**upstream**): 320,03 MB de pre-reserva por store, no parametrizable. No hay vía agent-side |
| `EGO-FIND-94` | 🟡 | La parte de Ego está cerrada (puente HybridRuntime + puerta `vantadb:check` bloqueante); queda **upstream** (`VDB-REQ-16a`: que el wrapper `vantadb@0.9.0` re-exponga las APIs cognitivas) |

> Las **121** filas cerradas incluyen las **19** que abrió la auditoría paralela
> (`EGO-FIND-104..122`): los 8 visuales del renderer, los 8 del motor de personaje,
> los 4 de la curaduría de memoria, los 4 de las puertas sin cablear y el resto.
> Las 2 que quedan **no son trabajo de Ego**: son peticiones al upstream de VantaDB.

### 7.6.2 Las 7 decisiones de producto que esperan al owner #

| # | Decisión | Contexto | Recomendación de quien laMidió |
|---|---|---|---|
| 1 | **`OpaqueId` (DSEK-03) y `SessionCheckpointPolicy` (DSEK-05): ¿retirar o cablear?** | `OpaqueId` sólo lo usa `SessionCheckpointPolicy`, que sólo usan sus propios tests; en producción los `sessionId` son **cadenas libres** (`apps/desktop/src/ipc/schema.ts:712`) | A2bis: **retirar** (−2 módulos muertos), salvo que se quiera la durability fail-closed de sesión (entonces cablear, con el `beforeModelStream` ya diseñado) |
| 2 | **`ZeroContextKernel` (HERM-18): ¿se cablea en producción?** | Sandbox endurecido (worker + `node:vm` sin intrínsecos) con caller real **sólo en la suite de seguridad** (`tests/security/injection-boundaries.test.ts`, SEC-08.C); cero uso en `apps/desktop` | A2bis: **mantenerlo como componente de test de seguridad** y documentarlo así, para que no se lea como código muerto por ignorancia; la alternativa (ejecutor de tools programáticas) es capacidad real con su coste |
| 3 | **Hueco de capacidad tras retirar `UntrustedContentSanitizer` (CARP-04): ¿cablear la detección o aceptar la brecha?** | Era el **único** módulo con detección de inyección de prompt (13 patrones EN/ES, normalización anti-obfuscación) y neutralización de tags de control. No lo llamaba nadie ⇒ retirarlo **no cambia el comportamiento**, pero `scanEgoPut` sólo detecta **secretos** y el `TrustBoundary` **no** neutraliza tags | A2bis: **no lo decide** (es política de seguridad). Opciones: (a) cablear en el borde de escritura (`scanEgoPut` → quarantine + marca `untrusted`), o (b) aceptar y documentar la brecha |
| 4 | **El clon confinado por Sub-Ego** (diff 3 de A3) | En el desktop **no existe** `cloneRegistryForProfile` y hay **un** registro de producción | A4: **no implementado**; la propuesta medida da ~2–5 tools por Sub-Ego sin coste de memoria, y **no cambia** qué tools puede invocar un Sub-Ego (eso lo decide el registro) |
| 5 | **El canal de obtención del token MCP** (`EGO-FIND-81`) | El token vive sólo en el main (keychain) y **no** se expone al renderer; un cliente externo necesita otro canal | A1: variable de entorno con nombre explícito (`EGO_MCP_TOKEN`) o fichero `0600` en el directorio de datos + **descubrimiento del puerto** (hoy efímero) → ✅ **RESUELTO por el owner (2026-10-21): "keychain + CLI local"** — el token se guarda en el keychain del SO y se expone **sólo** por un comando CLI local; el renderer nunca lo ve. En ejecución por **A3** |
| 6 | **Los certificados de firma** (`DIST-04`) | Bloquea E3 (binarios MCP embebidos + firma) y el bucket de distribución | — (material criptográfico que sólo el owner puede emitir) |
| 7 | **El cifrado at-rest** (`VDB-REQ-08` / FIND-249) | VantaDB persiste todo en claro; la cuarentena de SEC-09 es **control de acceso, no confidencialidad** | — (upstream). Decisión de owner: **relajar SEC-09 o no** mientras el motor no cifre → ✅ **RESUELTO por el owner (2026-10-21): "documentar el riesgo y esperar"** — no se cifra en la capa de Ego (cifrar sólo lo sensible rompe la búsqueda por contenido; cifrar todo deja el fast path BM25 inservible); el riesgo queda **documentado** en `docs/architecture/memoria-vantadb.md` §14 (la afirmación heredada "AES-256-GCM" era **falsa** → corregida) y la petición `VDB-REQ-08` sigue **upstream** |

### 7.6.2.b Decisiones del owner tomadas el 2026-10-21 (Ola 9) #

| # | Decisión | Veredicto | Estado |
|---|---|---|---|
| A | **Canal del token MCP** (`EGO-FIND-81`) | **Keychain + CLI local** | En ejecución (A3) |
| B | **Cifrado at-rest** (`VDB-REQ-08`) | **Documentar el riesgo y esperar al upstream** | ✅ Hecho: `memoria-vantadb.md` §14 + `VANTADB-FEEDBACK-Y-MEJORAS.md` |
| C | **Registro de tools: global vs. vista filtrada** | **Vista filtrada por Sub-Ego** (recomendación de A4) | En ejecución (A4) |
| D | **Hueco de detección de inyección de prompt** | **Reconstruir el detector** (módulo determinista en `packages/security/`) | En ejecución (A2-bis) |
| E | **Publicación de los commits** | **Publicar ahora** | ✅ Hecho: `origin/master` = `bb74656`, 0 commits sin publicar |

### 7.6.3 Las peticiones upstream que quedan (no son trabajo de Ego) #

| Id | Qué pide | Por qué no la cierra Ego |
|---|---|---|
| `VDB-REQ-14` | Que `ConnectOptions` permita **dimensionar o desactivar** la pre-reserva del índice vectorial (hoy 320,03 MB por store, no parametrizable: `read_only` + `memory_limit` a secas) | El consumo es **del motor**: el cliente no puede pedir «no reserves 320 MB». En Ego la mitigación es mantener **un solo** store abierto (lo que ya hace) |
| `VDB-REQ-16` (a) | Que el wrapper `vantadb@0.9.0` **re-exponga** los métodos cognitivos del binding (`memoryRecall`, `contextAssemble`, `memoryConsolidate`, `memoryReinforce`) y declare `vantadb-node` como dependencia **no opcional**, con versión mínima de Node | El binding **ya** los tiene (`index.d.ts:614,622,629,636`); lo que falta es el espejo en el wrapper. **No bloquea el path cognitivo**: el puente HybridRuntime (`packages/memory/CognitivePath.ts:70`) llega al binding por `db.inner`, que es un `VantaDb` alcanzable en runtime. El fix upstream sigue siendo lo correcto: es el **destino** del puente |


### Reglas de la progresión por fases (no negociables) #

1. La Ola 5 **no abre** fase nueva: cierra la contradicción y registra lo que las
   olas anteriores dejaron sin documentar.
2. `VDB-REQ-16` **ya no bloquea E2**: la vía (iii) del ADR-0023 (puente
   HybridRuntime) alcanza el binding por la fachada que ya lo tiene abierto ⇒
   **no hace falta un fix upstream para el path cognitivo**. La parte (a) sigue
   siendo el **destino** del puente, no un bloqueo.
3. Lo que una ola implementa pero **no integra** se registra como 🟡, no como ✅
   (matriz de capacidades de `AGENTS.md` §4: implementado ≠ integrado).
4. **Ningún bloque marcado ⛔ BLOQUEO OWNER avanza sin desbloqueo**.
5. Una fila de compuerta del Backlog **no se corrige cambiando el emoji**: el
   catálogo canónico (`docs/review/backlog-*.md`) es la fuente de verdad del
   estado, y la celda debe **apuntar a la fila canónica** o al **caller real**.
*Verificado por A8 el 2026-10-19 con lectura directa del código. Actualizado por A1 el
2026-07-20 (Ola 2), el 2026-07-21 (Olas 3, 4, 4b, 5 y 6). Sin commits: el orquestador commitea.*
