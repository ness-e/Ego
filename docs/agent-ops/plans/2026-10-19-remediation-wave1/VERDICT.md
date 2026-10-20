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

**La brecha más urgente de la Ola 2 es E7 (DOMPurify + CSP):** es la única pieza del documento maestro
que es simultáneamente (a) requisito de seguridad frontend, (b) no descartada por ninguna decisión,
(c) de esfuerzo bajo (una dependencia + una cabecera CSP), y (d) la que cierra la última pata de §11,
la sección con más peso documental sin cumplir.

---

*Verificado por A8 el 2026-10-19 con lectura directa del código. Sin commits: el orquestador commitea.*
