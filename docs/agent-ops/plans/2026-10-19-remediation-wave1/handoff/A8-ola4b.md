# Handoff A8-ola4b — 2026-10-21

> **Rol:** árbitro de la Ola 4b (cierre del contraste con el documento maestro + plan de la Ola 4).
> **Zona:** `docs/research/**` (excepto `character-audit-and-coucou-inventory.md` → A6) y este handoff.
> **Sin commits.** El orquestador commitea.

## 1. Cambios aplicados (ficheros propios)

| # | Fichero | Qué y por qué |
| --- | --- | --- |
| 1 | `docs/research/arquitectura-master-matrix.md` (reescrito) | **T1 + T3.** Matriz de las 22 secciones **re-verificada una por una contra el código actual** (no heredada): cada fila con evidencia `archivo:línea` leída hoy, el recuento **C/A/D** de sub-requisitos y el cambio de estado desde 2026-10-19. **§7 pasó de ❌ a 🟡** (exportadores) y ya **no queda ninguna sección en ❌ absoluto**. Cifras recalculadas con método publicado (§3). |
| 2 | `docs/research/verificacion-anthropic-tool-order.md` (nuevo) | **T2.** Verificación independiente de `EGO-FIND-80` contra la **fuente primaria** de Anthropic, con la evidencia del bloqueo, la vía que funciona y las citas textuales con URL y fecha. **Conclusión: la constraint que la Ola 3 tenía por bloqueante no existe en su forma general.** |
| 3 | `docs/research/README.md` | Hub actualizado: fecha de verificación de la matriz y entrada del informe de T2. |

## 2. Verificación de la constraint del proveedor — `EGO-FIND-80` (T2)

**Veredicto: REFUTADA la premisa. `EGO-FIND-80` → RESUELTA. `EGO-FIND-43` → DESBLOQUEADO.**

### 2.1 El bloqueo, reproducido con evidencia

| Vía | URL | Resultado |
| --- | --- | --- |
| `fetch` directo | `https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use` | **HTTP 200 pero con la página de región**: el cuerpo es literalmente *"App unavailable in region — Unfortunately, Claude is only available in certain regions right now."* + *"View supported countries"*. Cero líneas de la doc de tool use. |
| `websearch` (host) | consulta sobre la constraint | **HTTP 403** |
| `metasearch.search_web` (MCP) | *"Anthropic tool_result blocks must be in the same order as tool_use parallel tool use"* | Respuestas irrelevantes (home de anthropic.com, Wikipedia) |
| `metasearch.search_github` | `anthropic-cookbook tool_use parallel tool_result order` | **0 resultados** |
| `metasearch.search_code` | `"tool_result blocks must be in the same order as tool_use"` | Ruido (npm sin relación) |

### 2.2 La vía que funciona: lector de texto (`r.jina.ai`) — **fuente primaria, HTTP 200**

| URL oficial | HTTP | Longitud | Estado |
| --- | --- | --- | --- |
| `https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use` | 200 | 9 051 | ✅ doc real |
| `https://docs.anthropic.com/docs/en/agents-and-tools/tool-use/overview` | 200 | 10 580 | ✅ doc real |
| `https://docs.anthropic.com/docs/en/agents-and-tools/tool-use/handle-tool-calls` | 200 | 24 248 | ✅ doc real |
| `https://docs.anthropic.com/docs/en/agents-and-tools/tool-use/parallel-tool-use` | 200 | 6 192 | ✅ doc real |
| `https://docs.anthropic.com/en/api/messages` | 200 | 43 297 | ✅ referencia de API |
| `https://raw.githubusercontent.com/anthropics/anthropic-sdk-typescript/main/src/resources/messages/messages.ts` | 200 | 229 150 | ✅ source del SDK |

### 2.3 Las citas (2026-10-21)

> "**The API doesn't prescribe an execution order: you can run the calls concurrently
> (`Promise.all`, `asyncio.gather`), sequentially in the order they appear, or in any combination that
> suits your tools.**"
> — `https://docs.anthropic.com/docs/en/agents-and-tools/tool-use/parallel-tool-use`
> "**Whichever strategy you use, return one `tool_result` for each `tool_use` block, all together in
> the next user message. Match each result to its call with `tool_use_id`,** and put every
> `tool_result` block before any text content in that message."
> — *misma página*
> "The computer use tool and the browser use tool are stricter… **run them sequentially in the order
> they appear and stop at the first failure**."
> — *misma página*
> "**Tool result blocks must immediately follow their corresponding tool use blocks in the message
> history.** … **In the user message containing tool results, the `tool_result` blocks must come
> FIRST in the content array.** Any text must come AFTER all tool results."
> — `https://docs.anthropic.com/docs/en/agents-and-tools/tool-use/handle-tool-calls`

### 2.4 Consecuencias

1. La correspondencia `tool_result` ↔ `tool_use` es **por `tool_use_id`**, **no posicional**.
2. La ejecución concurrente está **autorizada** por la API para tools de usuario.
3. El orden secuencial es obligatorio **solo** en los batch actions de `computer use` / `browser use`
   (que Ego no usa: el browser va por MCP externo).
4. **Nada que cambiar en el código**: la implementación ya entregada
   (`packages/runtime/src/ToolExecutionLoop.ts:739-768`, `Promise.allSettled` que conserva el orden de
   entrada) es **más estricta** que la API y por tanto sigue siendo correcta.
5. **Por qué el source del SDK no mostraba el error**: el SDK valida *tipos y forma*, no *orden
   posicional*. Esa es exactamente la diferencia que `EGO-FIND-80` pedía contrastar.

**Vías verificables para el owner** (si quiere la fuente primaria sin proxy): (a) el lector de texto
`r.jina.ai` — usado aquí; (b) el repo de docs de Anthropic, clonable con `git`; (c)
`anthropic-sdk-typescript` y `anthropic-cookbook` en GitHub, accesibles; (d) la doc directa desde una
región soportada (la comprobación de región es de Anthropic, no del cliente).

## 3. Matriz de las 22 secciones con veredicto y evidencia

Detalle completo, método de recuento y evidencia línea a línea en
[`docs/research/arquitectura-master-matrix.md`](../../../../research/arquitectura-master-matrix.md) §1.
Resumen del vector: **0 ✅ · 20 🟡 · 0 ❌ · 1 🚫 (§14) · 1 ➖ (§1)**.

| # | Sección | Veredicto | C/A/D | Evidencia principal |
| --- | --- | --- | --- | --- |
| 1 | Taxonomía de referentes | ➖ No aplica | — | doc:9-18 — descriptivo |
| 2 | Router / CoALA / sandbox / MCP | 🟡 | 9/4/4 | `packages/models/src/ModelRouter.ts:262-544` · `packages/memory/EgoMemoryAdapter.ts:244-1389` · `packages/knowledge/src/GraphRagEngine.ts:284-320` · `packages/execution/src/ZeroContextKernel.ts:111` |
| 3 | Capacidades funcionales | 🟡 | 4/2/0 | **paralelismo** `packages/runtime/src/ToolExecutionLoop.ts:739-768` · proactividad `apps/desktop/src/main/window/create-window.ts:569-601` |
| 4 | Integraciones y Skills | 🟡 | 4.5/4.5/2 | MCP `packages/integrations/src/mcp/McpClient.ts:34-39` · **0 hits de `lookup_skills`** |
| 5 | UX/UI (voz, daemon) | 🟡 | 5.5/5.5/2 | **voz STT/TTS** `apps/desktop/renderer/components/voice/useVoice.ts:85-140` + `apps/desktop/src/main/ipc/register-ipc.ts:2367-2441` — sin full-duplex/VAD/barge-in |
| 6 | Internal Tooling Suite | 🟡 | 11.5/5.5/3 | **exportadores** `packages/tools/src/exporters/exportArtifactTool.ts:170-188` · **REPL TS** `packages/tools/src/repl/evalExpressionTool.ts:53-57` |
| 7 | Entregables de producción | 🟡 **(subió de ❌)** | 2.5/2.5/0 | exportadores propios sin dependencias + test `packages/tools/test/exporters.test.ts:247-299` |
| 8 | Configuración y gobernanza | 🟡 | 3.5/4.5/1 | secret proxy `packages/integrations/src/mcp/SecretProxy.ts:32-120` · **budgets** `packages/subegos/src/SubEgoBudget.ts:186-266` + `packages/execution/src/ExecutionManager.ts:68-89` |
| 9 | System Design 6 capas | 🟡 | 10/6/0 | **main.ts = 785 líneas**; el god file se movió a `apps/desktop/src/main/ipc/register-ipc.ts` (2 404) |
| 10 | Multi-agente | 🟡 | 5.5/3.5/3 | fan-out `packages/subegos/src/DelegationRouter.ts:904` · cableado `apps/desktop/src/main/window/create-window.ts:401` |
| 11 | Seguridad agéntica | 🟡 | 6/1/0 | taint `packages/runtime/src/TrustBoundary.ts:20-128` · **DOMPurify** `apps/desktop/renderer/lib/sanitize-html.ts:39` · **CSP** `apps/desktop/src/main/security/electron-security.ts:115-120` — **falta solo el egress allowlist** |
| 12 | Observabilidad / evals | 🟡 | 4/7/0 | `correlationId` `packages/events/src/correlation.ts:50-74` + `scripts/telemetry-sink.mjs` — **0 hits de OTel/OTLP** |
| 13 | Costes y latencia | 🟡 | 6.5/1.5/0 | `cache_control` `packages/models/test/ModelRouter-resilience.test.ts:388-450` · **aliases fast/smart por perfil** `:312-316` |
| 14 | Sandboxes en la nube | 🚫 | 0/0/6 | `docs/adr/0011-stab14-asimilados-descartes.md:33-34` |
| 15 | Distribución y monetización | 🟡 | 1/3/0 | **`vantadb-node@0.9.0`** `apps/desktop/package.json:38` + `packages/memory/package.json:27` · **uv/bun NO embebidos** `McpClient.ts:34-39` |
| 16 | Roadmap en 4 fases | 🟡 | 2.5/1.5/0 | **Fase 01 y 02 COMPLETAS** |
| 17 | UX research / journeys | 🟡 | 4.5/8.5/0 | 3 zonas `apps/desktop/renderer/src/App.tsx` — sin onboarding, sin time-travel, sin usab testing |
| 18 | Identidad visual / OKLCH | 🟡 | 10.5/5.5/0 | **OKLCH** `apps/desktop/renderer/src/index.css:20-35` + `DesignSystemProvider.tsx:51-151` · **0 `it.fails`** · `docs/design/DESIGN.md` — falta `prefers-contrast` y serif |
| 19 | Maquetación / responsive | 🟡 | 11/6/0 | **`@container` en 5 componentes** (`floating/floating.css:581,593` · `MetricsConsole.tsx:76` · `DailyDashboard.tsx:432` · `sub-egos.tsx:305` · `WardrobeSelector.tsx:305`) — falta `prefers-contrast` |
| 20 | Componentes / estado / routing | 🟡 | 12.5/3.5/0 | 11 primitives Radix · registry dinámico `apps/desktop/renderer/components/canvas/registry.ts:85-116` — **0 hits de CRDT y de deep-link** |
| 21 | APIs RT / seguridad frontend | 🟡 | 9/4/0 | Web Worker `apps/desktop/renderer/workers/shiki.worker.ts` · virtualización `components/chat/ChatMessageList.tsx:82-116` · DOMPurify + CSP |
| 22 | Accesibilidad / pirámide de tests | 🟡 | 4.5/4.5/0 | puerta `design-lint` `apps/desktop/scripts/design-lint.cjs` (R1-R7) — **11 specs E2E en `describe.skip`** `tests/gui/specs/02-streaming.spec.ts:17` y 10 más |

## 4. Cifras de alineación y su método

**Método (publicado y auditable).** Cada sección se descompone en los **sub-requisitos enumerados por el
propio documento**. Se cuentan **C**umplidos (implementación verificable en el código actual, no una
mención documental), **A**bsentes no descartados y **D**escartados por ADR-0011. Los descartados salen
del numerador **y** del denominador. §1 (taxonomía de mercado) y §14 (íntegramente descartada) quedan
fuera. El recuento C/A/D de cada fila está en la matriz.

| Corte | Cálculo | Resultado |
| --- | --- | --- |
| **Bruto** | 128 / (128 + 84 + 18) | **55.7 %** |
| **Adaptado al alcance Ego** | 128 / (128 + 84) | **60.4 %** ← cifra a citar |
| Vector de estados (método grueso anterior) | 20 × 🟡(0.5) / 20 | **50.0 %** |

**Por qué 43 % / 62 % ya no valen:** (a) el método cambió de *secciones* a *sub-requisitos* con
denominador publicado — el método viejo puntúa igual una sección con 6/13 sub-requisitos que una con
2/13; (b) el estado cambió (§7 de ❌ a 🟡), lo que por sí solo mueve el método grueso de 43 % a 50 %;
(c) el **62 % "adaptado" anterior no era reproducible** (era una estimación sin denominador contado) y
**lo sustituyo por 60.4 %**, ligeramente menor aunque se haya cerrado mucha deuda, precisamente porque
el número anterior estaba inflado. Las cifras previas (51 %, 68 %) siguen sin ser defendibles: el 68 %
exigiría tratar 20 secciones 🟡 como ≥0.75, imposible con 4 bloques de capacidad completa aún ausentes.

## 5. Brechas que el documento maestro aún exige y que nadie ha tocado (T3)

| # | Brecha | Estado | Evidencia | Tipo | Cierre |
| --- | --- | --- | --- | --- | --- |
| B3 | `DreamConsolidator` / `MemoryCurator` sin instanciar | **ABIERTA** | 0 instanciaciones en `src/`; solo `packages/tasks/test/` | deuda técnica | O4-4 |
| B4 | Suite E2E: **11 specs** en `describe.skip` | **ABIERTA** | `tests/gui/specs/02-streaming.spec.ts:17` y 10 más | deuda técnica | O4-18 |
| B11 | `expand_tools` / `search_tools` / `lookup_skills` | **ABIERTA** | 0 coincidencias en el repo | capacidad nueva | O4-6 |
| B12 + **B15** | Time-travel / bifurcación | **ABIERTA** | 0 hits de `restore`/`branch`/`timeTravel`/`revert` en `packages/tasks/src/` | capacidad nueva | O4-11 |
| B13 | `prefers-contrast` (el `@container` **ya está**: 5 componentes) | **PARCIAL** | 0 hits de `prefers-contrast`; `@container` en `floating/floating.css:581` y 4 más | deuda técnica | O4-13 |
| **B14** + **B18** | Formato OTel/OTLP y convenciones `gen_ai.*` | **ABIERTA** | 0 hits de `OTLP`/`otel`/`gen_ai` — sí hay `correlationId` y sink de disco | capacidad nueva | O4-12 |
| **B16** | CRDT (Yjs) + deep linking | **ABIERTA** | 0 hits de `yjs`/`CRDT`/`deep-link` | capacidad nueva | O4-8 |
| **B17** | §5.4 voz: **no es "ausente"** — existe STT/TTS opt-in, falta full-duplex/VAD/barge-in | **CORRECCIÓN** | `apps/desktop/renderer/components/voice/useVoice.ts:85-140` + `apps/desktop/src/main/ipc/register-ipc.ts:2367-2441` | capacidad nueva | O4-5 |
| **B19** | §8.3 budgets: **ya no está ausente** | **CORRECCIÓN** | `packages/subegos/src/SubEgoBudget.ts:186-266` + `packages/execution/src/ExecutionManager.ts:68-89` | — | cerrado |
| — | §11.2 egress allowlist de salida | **ABIERTA** | `NetPolicy` bloquea SSRF/IPs privadas, pero no hay proxy auditado de dominios | deuda técnica | O4-14 |
| — | §6.3 browser-use nativo con AXTree + Set-of-Marks | **ABIERTA** | hoy se sirve por MCP externo (`packages/tools/src/toolsets.ts:79-80`) | capacidad nueva | O4-7 |
| — | §8.1 identidad declarativa `SOUL.md` / `AGENT.md` | **ABIERTA** | el "soul" vive en código (`packages/subegos/src/SubEgoSoul.ts`) | capacidad nueva | O4-9 |

**Corrección metodológica que hereda la Ola 4:** mi auditoría del 2026-10-19 dio §5.4 (voz) y §8.3
(budgets) por **ausentes**. Ambas son **falsas**: la voz existe en modo STT/TTS opt-in con kill switch
y aviso de privacidad, y los budgets existen como `SubEgoBudget` + `ToolCircuitBreaker`. El motivo del
error: busqué *dependencias de terceros* y *funcionalidad exacta del documento* en lugar de *capacidad
verificable*. La regla para la Ola 4: **una capacidad se cuenta como ausente solo tras demostrar que no
existe ninguna implementación**, no porque no sea idéntica a la del documento.

## 6. Plan de la Ola 4 (ordenado por fases, no por valor)

> Orden canónico por la progresión estricta de `AGENTS.md` §6: **una fase completa antes de la
> siguiente**. Paralelismo dentro de la fase, secuencia entre fases.

| # | Fase | Id | Capacidad | Tipo | Esfuerzo | Depende de | Ficha / ADR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 02 Acción | **EGO-FIND-80** | Cerrar el finding con la evidencia de la fuente primaria (esta handoff §2) y **desbloquear `EGO-FIND-43`** | (a) doc | 0.5 d | — | `docs/research/verificacion-anthropic-tool-order.md` → Backlog `EGO-FIND-80` |
| 2 | 02 Acción | **VDB-REQ-02 / VDB-BUG-05 / VDB-BUG-01** | Retirar los 3 workarounds (`query_vector: []`, guard de `text_query: ""`, omisión de `cursor`) | (a) deuda técnica | 0.5 d | `vantadb-node@0.9.0` ya publicado | diff exacto ya calculado en `handoff/A1-ola4.md` §3 |
| 3 | 02 Acción | **EGO-FIND-43** | Verificar el contrato `tool_result` ↔ `tool_use_id` en el cliente y documentar que el paralelismo **no** está bloqueado | (a) verificación | 0.5 d | ítem 1 | — |
| 4 | 02 Acción | **EGO-FIND-22** | Instanciar `DreamConsolidator` + `MemoryCurator` en el `curatorJob` (o eliminarlos) | (a) deuda técnica | 0.5 d | — | Backlog `EGO-FIND-22` |
| 5 | 03 Sub-Egos | **O4-5** | **Voz full-duplex con VAD y barge-in** (WebRTC o equivalente local) | (b) capacidad nueva | 5-8 d | decisión de producto | ficha de extracción propia; `docs/research/canales-comunicacion-y-social.md` como referencia |
| 6 | 03 Sub-Egos | **O4-6** | `lookup_skills` + `expand_tools` + divulgación progresiva de Skills | (b) capacidad nueva | 2-3 d | — | `docs/extractions/` nueva; `docs/research/plantillas-agentes-y-enjambres.md` |
| 7 | 03 Sub-Egos | **E5** | Identidad declarativa `SOUL.md` / `AGENT.md` + budgets por rol | (b) capacidad nueva | 2-3 d | — | ADR nuevo (propuesta) |
| 8 | 04 Canvas | **E11** | CRDT (Yjs) en el Canvas + deep linking | (b) capacidad nueva | 3-5 d | — | `docs/extractions/openhands.md:247` (`OHND-11`) |
| 9 | 06 Knowledge | **E2** | **Path cognitivo nativo**: `memoryRecall({trust_aware})` · `contextAssemble` · `memoryConsolidate` · `memoryReinforce` + embeddings. **El mayor multiplicador**: el binding 0.9.0 ya expone las cinco; solo `graphRagSearch` está cableado | (b) capacidad nueva | 5-8 d | Fases 03-05 `VERIFIED` | **ADR-0023** (texto de A2 pendiente) |
| 10 | 06 Knowledge | **VDB-REQ-15** | Re-rank compuesto con la confianza de `memoryRecall({trust_aware:true})`, combinada con el taint de `ADR-0019` | (b) capacidad nueva | 2 d | ítem 9 | `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` |
| 11 | 10 Recovery | **E9** | Time-travel y bifurcación desde checkpoint (restaurar a un paso y derivar una rama) | (b) capacidad nueva | 3-4 d | — | ADR nuevo |
| 12 | 11 Security | **E8** | Formato OTel/OTLP + convenciones semánticas `gen_ai.*` sobre el `correlationId` existente | (b) capacidad nueva | 3 d | — | ADR nuevo |
| 13 | 11 Security | **E10-res** | `prefers-contrast` + familia serif editorial + cierre de los 6 hallazgos AA restantes en los presets no medidos | (a) deuda técnica | 1 d | — | `docs/design/design-system.md` |
| 14 | 11 Security | **O4-14** | Egress allowlist de salida (proxy auditado a dominios autorizados) | (a) deuda técnica | 2 d | — | ADR nuevo |
| 15 | 11 Security | **EGO-FIND-49** | `McpManager.connectServer` no puede pisar tools nativas sin `allowOverride` auditado | (a) deuda técnica | 1 d | — | Backlog `EGO-FIND-49` |
| 16 | 11 Security | **EGO-FIND-86** | `design-lint`: indexar la lista blanca por **hash del contenido**, no por ID posicional (`EGO-DL-0NN`) | (a) deuda técnica | 0.5 d | — | Backlog `EGO-FIND-86` |
| 17 | 11 Security | **EGO-FIND-81** | Canal de obtención del token MCP para clientes externos (guía de usuario) | (b) documentación | 0.5 d | ⛔ **BLOQUEO OWNER** | `docs/adr/0021-mcp-server-transporte-y-token.md` |
| 18 | 12 Distribution | **E12** | Reactivar los 11 `describe.skip` de la suite GUI contra Electron real + Storybook + Lighthouse CI | (a) deuda técnica | 3-5 d | cierre de A7 | `docs/dev/e2e-skip-inventory.md` §1.0 |
| 19 | 12 Distribution | **E3** | Binarios MCP embebidos (uv/bun) — installer sin dependencias del usuario | (a) deuda técnica | 2 d | ⛔ **BLOQUEO OWNER** (`DIST-04`: certificados de firma) | `docs/adr/0021-…` |
| — | transversal | **VDB-REQ-14** | Pre-reserva de 320 MB por store, no parametrizable | (a) petición upstream | — | upstream | `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` §`VDB-REQ-14` · Backlog `EGO-FIND-87` |

### Bloqueos del owner (verificados)

| Bloqueo | Estado | Verificación |
| --- | --- | --- |
| **`DIST-04`** (certificados de firma) | ⛔ **sigue abierto** | `docs/roadmap/Backlog.md:479` — requiere certificados que solo el owner puede aportar |
| **`EGO-FIND-81`** (canal del token MCP) | ⛔ **sigue abierto** | `docs/adr/0021-mcp-server-transporte-y-token.md` — falta decidir el canal (env `EGO_MCP_TOKEN` vs. fichero `0600` vs. ambos) y el descubrimiento del puerto efímero |
| **`DIST-06`** (VM limpia) | ⛔ abierto, no bloqueante | `docs/roadmap/Backlog.md:481` — el owner prepara la VM |
| **`EGO-FIND-64` / `DIST-09`** (`vantadb-node` por `file:`) | ✅ **DESBLOQUEADO** | **`vantadb-node@0.9.0` está publicado** y ambos manifiestos ya lo declaran: `apps/desktop/package.json:38` y `packages/memory/package.json:27`. Queda solo el cambio de lockfile + que CI ejercite el binding real (dueño A7) |
| **`EGO-FIND-80`** (constraint del proveedor) | ✅ **RESUELTO** | Verificado contra la fuente primaria: §2 de este handoff |
| **`EGO-FIND-43`** (paralelismo de tool calls) | ✅ **DESBLOQUEADO** | El paralelismo ya está implementado (`packages/runtime/src/ToolExecutionLoop.ts:739-768`) y **no** está bloqueado por el proveedor |

### Reglas de la progresión (no negociables)

1. Los ítems 1-4 (Fase 02) se cierran **antes** de tocar Fase 03+.
2. El ítem 9 (E2, Fase 06) no puede empezar hasta que las Fases 03-05 estén `VERIFIED`.
3. Los ítems 12-17 (Fase 11) cierran después de Fase 10.
4. Los ítems 18-19 (Fase 12) son los últimos y arrastran `DIST-04`.
5. **Ningún bloque marcado ⛔ BLOQUEO OWNER avanza sin desbloqueo.**

## 7. Verificación

| Comando | Exit | Resumen |
| --- | --- | --- |
| `node docs/testing/check-docs-paths.mjs --quiet` | **0** | 0 enlaces markdown rotos, 0 rutas inexistentes en docs canónicos (289 ficheros escaneados) |
| `node scripts/verify-vantadb-ids.mjs` | **0** | 25 IDs registrados · 910 ficheros · 62 referencias · **0 errores** · 3 avisos W2 (peticiones puramente upstream: `VDB-REQ-08`, `VDB-REQ-09`, `VDB-REQ-14`) |
| `pnpm docs:build` | **0** | VitePress 1.6.4 · build completo en 62.27 s · sin dead links |
| `npx markdownlint-cli2` sobre los 2 ficheros de A8 | 1 | Solo `MD013` (line-length en tablas anchas); 0 en cualquier otra clase. El corpus de `docs/` arrastra 19 000+ errores preexistentes → fix de `.markdownlint.json` pendiente de A7 |
| Re-verificación de evidencia | — | Cada fila de la matriz re-leída contra el código actual; 0 afirmaciones heredadas sin re-verificar |

## 8. Solicitudes fuera de zona (NO aplicadas)

| # | Fichero | Cambio pedido | Motivo | Dueño | Bloqueante |
| --- | --- | --- | --- | --- | --- |
| S1 | `docs/roadmap/Backlog.md` | Marcar `EGO-FIND-80` como **RESUELTA** con la evidencia de la fuente primaria y **desbloquear `EGO-FIND-43`** | La premisa del bloqueo era incorrecta (§2 de este handoff) | **A1** | — |
| S2 | `docs/roadmap/Backlog.md` | Cerrar `EGO-FIND-61`, `EGO-FIND-71`, `EGO-FIND-22` (parcial) con la evidencia de las olas 1c/2/3 | Cierre contable | **A1** | — |
| S3 | `docs/adr/0023-path-cognitivo-nativo.md` | Crear el ADR del path cognitivo nativo | E2 es el mayor multiplicador de la Ola 4 | **A2** (texto) → **A1** (fichero) | Texto pendiente de A2 |
| S4 | `docs/research/README.md` | Actualizar la fila de la matriz a "verificado 2026-10-21" y añadir el informe de T2 | Hub desactualizado | **A8** (hecho, ver §1.3) | — |
| S5 | `docs/adr/0021-mcp-server-transporte-y-token.md` | Cerrar el canal del token MCP | ⛔ bloqueo owner | **owner** | Decisión de producto |
| S6 | `docs/roadmap/Backlog.md` | `DIST-04` (certificados) | ⛔ bloqueo owner | **owner** | Certificados |
| S7 | `apps/desktop/src/main/ipc/register-ipc.ts` | Es el **nuevo god file** (2 404 líneas) tras la descomposición de `main.ts`; el objetivo de E6 se cumplió en `main.ts` pero la deuda se trasladó | E6 estaba medido sobre `main.ts`; el gate `test/e6-runtime-state.test.ts` debe mirar el árbol entero, no un fichero | **A4** | — |
| S8 | `.markdownlint.json` | `MD013.tables: false` o un baseline | El gate `docs-lint.yml` corre sin baseline sobre un corpus con 19 000+ errores: nunca puede pasar | **A7** | — |

## 9. Alineación con los handoffs de los demás agentes

Cross-check de mi plan de Ola 4 contra los handoffs presentes en la ola (leídos, no asumidos):

| Handoff | Qué pide | Mi plan | Estado |
| --- | --- | --- | --- |
| `A1-ola4.md` §5.1 | Retirar el workaround `query_vector: []` (`VDB-REQ-02` resuelto) | ítem 2 (Fase 02) | ✅ coherente |
| `A1-ola4.md` §5.2 | `ADR-0023` del path cognitivo nativo | ítem 9 (Fase 06) | ✅ coherente; el texto sigue pendiente de A2 |
| `A1-ola4.md` §5.3 | Decidir el motor de compactación (`ADR-0020`, condición cumplida) | ítems 2 y 9 | ✅ coherente |
| `A1-ola4.md` §5.4 | `vantadb-node@0.9.0` en los dos manifiestos | **ya aplicado** | ✅ **cerrado**: `apps/desktop/package.json:38` y `packages/memory/package.json:27` declaran `0.9.0` (verificado 2026-10-21) |
| `A1-ola4.md` §5.5 | `VDB-REQ-15`: cablear la confianza en el recall | ítem 10 (Fase 06) | ✅ coherente |
| `A1-ola4.md` §5.6 | `VDB-REQ-14` (320 MB por store) | ítem transversal | ✅ coherente |
| `A1-ola4.md` §5.7 | `EGO-FIND-81` (canal del token MCP) | ítem 17 (Fase 11) | ✅ coherente; ⛔ sigue siendo bloqueo del owner |
| `A1-ola4.md` §3.1 | `docs/dev/e2e-skip-inventory.md` al estado real | ítem 18 (Fase 12) | ✅ coherente |

**Lo que mi plan aporta y ningún otro handoff lista** (verificado contra el código, §5 de esta handoff):
`EGO-FIND-80` resuelto · `EGO-FIND-43` desbloqueado · `EGO-FIND-22` (dream sin instanciar) ·
`expand_tools`/`lookup_skills` · **formato OTel y `gen_ai.*`** · **time-travel y bifurcación** ·
**CRDT (Yjs) y deep linking** · **voz full-duplex con VAD y barge-in** · **egress allowlist de salida** ·
browser-use nativo con AXTree y Set-of-Marks · identidad declarativa `SOUL.md`/`AGENT.md` ·
`prefers-contrast` y familia serif · `EGO-FIND-49` (override de tools MCP) ·
`EGO-FIND-86` (lista blanca del `design-lint` indexada por ID posicional) ·
**`register-ipc.ts` (2 404 líneas) es el nuevo god file** tras la descomposición de `main.ts`.

## 10. Deuda abierta

- **§14 y §7.2-REPL-Python no vuelven** (ADR-0011). El REPL de expresiones TS es un sustituto honesto, no el REPL del documento.
- **La cifra de alineación depende del método**: vector de estados 50 %; sub-requisitos contados, 55.7 % bruto y 60.4 % adaptado. Toda cifra citada fuera de esta handoff debe traer su método.
- **`register-ipc.ts` (2 404) es ahora el god file**: la descomposición de `main.ts` movió la deuda, no la borró. La Ola 4 debería medir el árbol, no el fichero.
- **El bloqueo de docs.anthropic.com persiste** en este entorno: la vía que funciona es el lector de texto. Documentado en `docs/research/verificacion-anthropic-tool-order.md` §3.
- **No ejecuté `pnpm test` ni `pnpm typecheck`**: A8 no toca código y el árbol está en
  movimiento por A4/A7. Las verificaciones fueron de documentación (paths, IDs de VantaDB,
  build del sitio) y re-verificación de evidencia por lectura directa.

---

RESULTADO: {
  agente: A8-ola4b,
  status: COMPLETED,
  archivos_modificados: [
    "docs/research/arquitectura-master-matrix.md (reescrito: T1 + T3)",
    "docs/research/verificacion-anthropic-tool-order.md (nuevo: T2)",
    "docs/research/README.md (hub actualizado)",
    "docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A8-ola4b.md (nuevo)"
  ],
  hallazgos_resueltos: [
    "EGO-FIND-80 (constraint del proveedor verificada contra la fuente primaria: la premisa era incorrecta) → RESUELTA",
    "EGO-FIND-43 (paralelismo de tool calls) → DESBLOQUEADO",
    "EGO-FIND-64 / DIST-09 → DESBLOQUEADOS (vantadb-node@0.9.0 publicado y en ambos manifiestos)",
    "B5, B6, B7, B8, B9, B10, B19 → cerradas por las olas 1c/2/3 (re-verificado contra el código actual)"
  ],
  verify: {
    docs_paths: "node docs/testing/check-docs-paths.mjs → exit 0 (0 enlaces rotos, 0 rutas inexistentes)",
    vantadb_ids: "node scripts/verify-vantadb-ids.mjs → exit 0 (0 errores, 3 avisos W2 upstream)",
    docs_build: "pnpm docs:build → exit 0 (VitePress 1.6.4, 62.27 s, sin dead links)",
    lint: "markdownlint-cli2 → solo MD013 en tablas anchas; 0 en otras clases",
    tests: "n/a — A8 no toca código",
    typecheck: "n/a — A8 no toca código"
  },
  solicitudes_handoff: 8,
  deuda_abierta: [
    "B3 DreamConsolidator/MemoryCurator sin instanciar → O4-4",
    "B4 11 specs E2E en describe.skip → O4-18",
    "B11 expand_tools/lookup_skills ausentes → O4-6",
    "B12/B15 time-travel y bifurcación ausentes → O4-11",
    "B13 prefers-contrast ausente (el @container ya está) → O4-13",
    "B14/B18 formato OTel y gen_ai.* ausentes → O4-12",
    "B16 CRDT y deep-link ausentes → O4-8",
    "B17 voz: no es ausente, es parcial (falta full-duplex/VAD/barge-in) → O4-5",
    "§11.2 egress allowlist de salida ausente → O4-14",
    "§6.3 browser-use nativo con AXTree/SoM ausente → O4-7",
    "§8.1 identidad declarativa SOUL.md/AGENT.md ausente → O4-9",
    "register-ipc.ts (2404) es el nuevo god file → S7 (A4)",
    "gate markdownlint rojo en todo el repo → S8 (A7)",
    "DIST-04 y EGO-FIND-81 bloqueados por el owner"
  ],
  SKILLS_CARGADAS: [
    "coordinated-web-search",
    "documentation-skill",
    "code-simplification",
    "systematic-debugging",
    "doubt-driven-development",
    "writing-plans"
  ]
}
