---
kind: review
status: active
description: "Backlog especializado para la revisión, extracción de patrones y adaptación técnica de Agent Canvas Desktop (OpenHands) hacia el monorepo de Ego."
tags: [ego, openhands, agent-canvas, electron, extraction, review, event-stream, client-tools, approval-policy]
schema: "10-column canonical schema (.agents/references/backlog-format.md compatible)"
---

# Backlog de Revisión y Extracción: OpenHands (OpenHands/OpenHands) #

## Compuerta de extracción: shell Electron, renderer React Router y contrato del Agent Server ##

| Estado | Repositorio Origen | Total de Tareas | Fases Impactadas en Ego | Owner | Fecha | Última verificación |
| --- | --- | :---: | --- | --- | --- | --- |
| Activo — 12 compuertas, 0 asimiladas | `repos-referencia/openhands/` (`@openhands/agent-canvas` 1.28.1, commit `8d39305`, MIT) | **12** (`OHND-01..12`) | Fases 01 (`CORE`), 02 (`ACT`), 03 (`SUB`), 04 (`CANV`), 05 (`DEC`), 07 (`TASK`), 10 (`REC`), 11 (`SEC`), 12 (`DIST`) + P1 Cloud | ness-e | 2026-10-20 | 2026-10-20 — grep sobre `packages/` + `apps/desktop/` (excluye `test/`, `dist/`, `node_modules/`) |

---

## 0. Verificación de estado (2026-10-20) ##

| Estado | Significado canónico |
| --- | --- |
| `✅ Completada` | Asimilado, integrado y con **caller en producción verificado**. La celda cita la ruta real. |
| `🚫 Descartada (con justificación)` | El patrón no se aplica en Ego, fue sustituido por otro módulo canónico, o viola un guardrail. La celda contiene el motivo técnico. |
| `🆕 Pendiente` | Patrón asimilado (o pendiente de asimilar) **sin caller en producción**. La celda dice el **cableado exacto** y **quién lo ejecuta**. |
| `⏳ Futura (fase)` | Diferido a una fase posterior, con fase destino explícita. |

**Nota de alcance (obligatoria):** repositorio de referencia **nuevo**. Ningún patrón de OpenHands ha sido asimilado
todavía en `packages/` ni en `apps/desktop/`. Por `AGENTS.md` §4, **ninguna fila puede marcarse `✅ Completada`** sin
fichero adaptado **y** caller en producción verificado por grep. Búsquedas de verificación ejecutadas:

```text
grep -r "SeqCursor|resumeCursor|replayFrom|lastSeq|sequenceNumber" packages/   -> 0 coincidencias
grep -r "clientTool|ClientTool|rendererTool"                        packages/   -> 0 coincidencias
grep -r "isRetryable|withRetry"                                     packages/   -> 0 coincidencias
grep -r "reservedTag|displayTags|sessionTags|tagKey|metadataStore"  packages/   -> 0 coincidencias
grep -r "LookupSecret|secretRef|credentialRef"                      packages/   -> 0 coincidencias
grep -r "activeProfile|active_profile|llmProfile|selectedProfile"   packages/   -> 0 coincidencias
grep -r "react-router|createBrowserRouter|RouterProvider" apps/desktop/renderer/ -> 0 coincidencias
```

**Frontera del repositorio (verificada):** `repos-referencia/openhands/` es una **aplicación de escritorio Electron**
(`electron/main.mjs`, `electron/preload*.cjs`, `electron-builder.config.mjs`) con renderer React 19 + Vite + React
Router 7 + Tailwind: el gemelo de stack más cercano a Ego después de `hermes-agent`. El *Agent Server* (Python) **ya no
está en este repo** — vive en `OpenHands/software-agent-sdk`; el desktop app lo orquesta como proceso subordinado. Por
tanto `OHND-09` es una **observación de contrato externo**, no código local asimilable.

---

## 1. Resumen Ejecutivo de Extracción ##

Agent Canvas Desktop aporta a Ego **diez patrones transferibles**: (1) un **log de eventos secuenciado** con sobre de
protocolo y **cursor de reanudación que salta huecos**; (2) **client tools** —herramientas cuyo handler vive en el
cliente, con anotaciones de riesgo—; (3) **ledger de idempotencia por `toolCallId`**; (4) **política de aprobación
negociada por sesión** e **indirección de secretos por referencia**; (5) **metadatos etiquetados con claves reservadas
frente a visibles**; (6) **clasificación de error definitivo frente a transitorio** con reintento selectivo; (7) **log
de arranque** con buffer acotado, sanitización ANSI y replay íntegro; (8) **router declarativo** con rutas anidadas,
`catch-all` y chunk por ruta; (9) **un solo escritor** del estado de cliente con sello de doble reloj; y (10) el
contrato de negociación de versión del backend. En cambio, se descartan con justificación el **runtime sandbox Docker**,
la **contaminación de dominio** (OpenHands Cloud, MARS/DigitalOcean, organizaciones, PostHog) y —por estar ya
superados por módulos canónicos de Ego— la **política de URLs de ventana**, el **preload mínimo por ventana**, el
**drenaje de `before-quit`** y el **aislamiento por worktree**. Se difiere a P1 el **agent server HTTP/WS propio**.

El valor estructural para Ego es que `EventBus` hoy pierde todo al reiniciar (historial circular de 100 eventos en
RAM, `packages/events/src/EventBus.ts:84-85,153-157`) y `EgoEvent` no tiene `seq` (`packages/events/src/types.ts:76-89`):
no existe forma de reanudar un turno interrumpido con garantía de no perder ni duplicar eventos, que es exactamente lo
que `TASK-03` y `REC-01` presuponen.

### MATRIZ DE DISTRIBUCIÓN POR FASE ###

```text
FASE 01 CORE   ······················ OHND-01  OHND-04  OHND-05  OHND-12      (4)
FASE 02 ACT    ······················ OHND-02  OHND-03  OHND-06                (3)
FASE 03 SUB    ······················ transversal: OHND-02/03 dan soporte al runtime de Sub-Egos
FASE 04 CANV   ······················ OHND-02  OHND-11  OHND-12               (3)
FASE 05 DEC    ······················ transversal: OHND-04 acota la política, OHND-12 la traza
FASE 07 TASK   ······················ OHND-01                                 (1)
FASE 10 REC    ······················ OHND-01  OHND-06  OHND-10               (3)
FASE 11 SEC    ······················ OHND-04  OHND-06                       (2)
FASE 12 DIST   ······················ OHND-10  OHND-11                       (2)
P1 CLOUD       ······················ OHND-09                                 (1)
DESCARTES      ······················ OHND-07  OHND-08                       (2)
```

**Recuento de estados:** 0 `✅ Completada` · 2 `🚫 Descartada` · 9 `🆕 Pendiente` · 1 `⏳ Futura` — **12 tareas**.

---

## 2. Catálogo Detallado de Extracción (10 Columnas Canónicas) ##

| ID | Severidad | Hallazgo | Archivo OpenHands | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `OHND-01` | 🔴 Crítica | **Log de eventos secuenciado con cursor de reanudación que salta huecos** | `src/types/agent-server/session-frames.ts:15-107`, `src/utils/session-seq-cursor.ts:9-63` | 🟡 2-3d | 🔴 P0 | 🆕 Pendiente | Extraer el patrón, no el transporte. `EgoEvent` gana `seq` monótono por sesión y un `SessionResumeCursor` que conserva el `seq` más alto **sin hueco por debajo**, apila los vistos por encima y, si el hueco persiste (`MAX_AHEAD = 1024`), lo salta en vez de congelarse (el evento ilegible tampoco llegará en el replay). Hoy `EventBus` sólo conserva 100 eventos en RAM y los pierde al reiniciar. **Cableado:** `packages/events/src/SessionEventLog.ts` + `SessionResumeCursor.ts`, numerar en `EventBus.emit` (`packages/events/src/EventBus.ts:100-165`) y persistir en VantaDB `session/<id>/log` (owner A2). | Ego: `ACT-05`, `ACT-12`, `TASK-03`, `REC-01`, `CORE-12` · Extracción: `docs/extractions/openhands.md` §Bloque A | — |
| `OHND-02` | 🔴 Crítica | **Client tools: herramientas cuyo handler vive en el cliente, con contrato y anotaciones de riesgo** | `src/api/canvas-ui-client-tool.ts:9-20,60-91`, `src/api/launch-child-conversation-client-tool.ts:61-112`, `src/types/agent-server/core/base/action.ts:319-325` | 🟡 2d | 🔴 P0 | 🆕 Pendiente | El servidor anuncia las tools en `client_tools` al arrancar la conversación y emite la acción por el canal; el contrato declara `readOnlyHint`/`destructiveHint`/`idempotentHint`/`openWorldHint` y una descripción-manual para el modelo. En Ego la única tool de Canvas, `canvas_render`, es main-side y no puede pedir a la UI que revele una pestaña. **Cableado:** `executionTarget: "main" \| "renderer"` en `packages/tools/src/ToolRegistry.ts` + dispatch vía `packages/events/src/InteractionTransport.ts` (owner A2). | Ego: `ACT-01`, `CANV-03`, `INT-05`, `SUB-03` | — |
| `OHND-03` | 🟠 Alta | **Ledger de idempotencia por `toolCallId` (reclamación previa a la ejecución)** | `src/utils/claim-client-tool-call.ts:10-34`, `src/services/child-conversation-launch.ts:518-525`, `src/services/secret-request.ts:48-55` | 🟢 1d | 🔴 P0 | 🆕 Pendiente | Las client tools no idempotentes (lanzar una sesión facturable, pedir un secreto) reclaman el `toolCallId` **antes** de actuar y devuelven `false` en el replay, para que una reconexión o una carrera REST/WS no repita trabajo real. `ToolExecutionLoop` ya propaga `call.id` como `callId`/`toolCallId` (`packages/runtime/src/ToolExecutionLoop.ts:118,405,435,683`) pero no lo usa para deduplicar. **Cableado:** `packages/execution/src/ToolCallLedger.ts`, consulta previa a la ejecución material (`ToolExecutionLoop.ts:695-699`), persistido en `session/<id>/ledger` (owner A2). | Ego: `ACT-08`, `ACT-02`, `CORE-12` | `OHND-01` |
| `OHND-04` | 🔴 Crítica | **Política de aprobación negociada por sesión + secretos por indirección** | `src/api/agent-server-adapter.ts:767-792,1196,1286-1307,1416-1417`, `src/types/agent-server/core/base/action.ts:362-367` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | La política se resuelve **una vez** y viaja explícita en el arranque: `NeverConfirm` / `ConfirmRisky` / `AlwaysConfirm`, con analizador enchufable. En Ego `ApprovalEngine.evaluateRequirement` sólo consulta reglas estáticas y un `GovernanceMode` global (`packages/execution/src/ApprovalEngine.ts:160-225`): no existe política por sesión. En paralelo, `request.secrets` viaja como `LookupSecret` y el valor nunca atraviesa el canal del agente. **Cableado:** `SessionApprovalPolicy` en `packages/execution/src/`, resuelta en la admisión de `packages/memory/EgoMemoryLifecycle.ts`, y `secretRef` (id + propósito) como único handle visible para el agente (owner A2). El analizador **LLM** se descarta por coste; sólo el patrón de política y los analizadores `pattern`/`policy_rail` son transferibles. | Ego: `ACT-06`, `SEC-05`, `SEC-03`, `SEC-04`, `CORE-12`, `INT-05` | — |
| `OHND-05` | 🟡 Media | **Metadatos de sesión: claves reservadas frente a claves visibles, con orden estable** | `src/api/agent-server-adapter.ts:561-678` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | Los `tags` del servidor son un `Record<string,string>` genérico, pero la UI sólo muestra los no reservados; las claves de routing interno y los sellos de máquina quedan fuera, con prioridad de alta señal y normalización de clave (`trim().toLowerCase()`) para que un backend con `"Origin"` no pierda el orden. Esto evita que el routing interno llegue a la UI y que el usuario falsifique clasificaciones. **Cableado:** helper de proyección en `packages/events/src/` + namespace `session/<id>/meta` (owner A2). | Ego: `CORE-07`, `DS-03`, `SEC-06` | — |
| `OHND-06` | 🟠 Alta | **Clasificación de error definitivo frente a transitorio y reintento con backoff selectivo** | `src/api/agent-server-compatibility.ts:203-231,253-278,320-326`, `src/api/with-retry.ts:7-30` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | `isRetryableError` clasifica: sin respuesta → retryable; `408`/`429` → retryable; `4xx` distinto de esos → **no** retryable (el servidor rechazó la petición); `5xx` → retryable. Y `isDefinitiveLocalBackendError` separa el fallo decidido por el servidor del tránsito. En `packages/integrations/src/mcp/McpClient.ts:571-575,672-682` sólo hay timeout, sin reintento clasificado. **Cableado:** `packages/integrations/src/http-retry.ts` + integración en `McpClient` y en `packages/execution/src/CircuitBreaker.ts` (owner A3). | Ego: `ACT-09`, `INT-01`, `REC-06` | — |
| `OHND-07` | 🟠 Alta | **Runtime sandbox en contenedor (Docker) como sustrato de ejecución** | `src/api/agent-server-adapter.ts:541-566,1156-1165`, `docs/architecture.md:80-82` | — | — | 🚫 Descartada (con justificación) | Un desktop local-first no puede exigir un runtime de contenedores ni un daemon de ejecución: eso duplica el aislamiento ya cubierto por `packages/tools/src/native/security/ResourcePolicy.ts` y `packages/tools/src/native/fs/PathValidator.ts` (`SEC-05`) y contradice el guardrail de no introducir procesos backend obligatorios en P0 (`AGENTS.md` §4). Se conserva **sólo** el patrón de aislamiento negociado por sesión, sin tecnología Docker. | Ego: `ACT-03`, `SEC-05` | — |
| `OHND-08` | 🟠 Alta | **OpenHands Cloud, MARS (DigitalOcean), organizaciones, suscripciones LLM y telemetría PostHog** | `src/api/mars/`, `src/api/cloud/`, `src/api/llm-subscription-service.ts`, `package.json:44`, `config/defaults.json:42-45` | — | — | 🚫 Descartada (con justificación) | Contaminación de dominio (`AGENTS.md` §4): introducen modelos de negocio ajenos a un SOC —organizaciones, facturación, alojamiento gestionado, suscripciones por proveedor— y salida de telemetría externa, incompatibles con el principio 9 (local-first y propiedad/exportación de los datos). 0 hits esperados en `packages/` + `apps/desktop/`. | Ego: — (guardrail de dominio) | — |
| `OHND-09` | 🔵 Futura | **Contrato del Agent Server HTTP + WebSocket (observación externa, no código local)** | `src/hooks/use-websocket.ts:29-258`, `src/api/event-service/event-service.api.ts:75-154`, `src/api/agent-server-client-options.ts:45-69` | 🟣 3d | 🔵 P3 | ⏳ Futura (P1 — Cloud) | El Agent Server **no forma parte de este repositorio**: vive en `OpenHands/software-agent-sdk` y el desktop app lo orquesta como proceso subordinado (`electron/main.mjs:668-710`). Lo único local es el **cliente** que habla con él, luego este hallazgo es una observación de contrato externo, no código asimilable. Sujeto al guardrail de `AGENTS.md` §7 (el Cognitive Runtime nunca contiene lógica de servicio) y al principio 9: incompatible con P0. **Fase destino:** P1, sólo si el owner aprueba un modo Ego Cloud (Ego Web + sync); el contrato de frames de `OHND-01` sería entonces el eje de la negociación de versión y capacidades. | Ego: `INT-01`, `DIST-01` | `OHND-01` |
| `OHND-10` | 🟠 Alta | **Log de arranque en el splash: buffer acotado, sanitización ANSI/CR, flush por lotes IPC y replay íntegro** | `electron/main.mjs:476-537,367-379,505-512`, `electron/preload.cjs:13-31` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Cada línea de log de los servicios subordinados se sanea (se quitan las secuencias ANSI y se colapsa el redibujo por `\r` al último frame), se guarda en un buffer acotado (2000 líneas) y se transmite al splash en lotes cada 200 ms; cuando la página del splash carga, el buffer **se reenvía íntegro** para no perder lo emitido antes de que existiera el renderer. En una app empaquetada `stdout` va a `/dev/null`: ese console es la **única** superficie de diagnóstico. En Ego `packages/recovery/src/DiagnosticsLogger.ts` (`REC-07`) escribe a disco rotativo, que el usuario no ve, y `apps/desktop/src/main.ts` no tiene buffer de arranque. **Cableado:** `apps/desktop/src/main/boot-log.ts` (buffer + `sanitizeLogLine` + flush por lotes) + `renderer/components/diagnostics/BootLogPanel.tsx` con "Copiar diagnóstico" (owner A4). | Ego: `REC-07`, `REC-02`, `DIST-02` | — |
| `OHND-11` | 🟠 Alta | **Router declarativo en el renderer con rutas anidadas, `catch-all` y chunk por ruta** | `src/routes.ts:8-50`, `react-router.config.ts:88-94`, `src/root.tsx:94,234` | 🔴 2-3sem | 🟠 P1 | 🆕 Pendiente | El renderer se declara como config de rutas **declarativo** (`layout` + `route` anidados, un `index` por sección, un `catch-all` `route("*")` que absorbe URLs desconocidas) y se construye en modo SPA (`ssr: false`, `basename` normalizado). Cada ruta es su propio módulo ⇒ code-splitting por ruta sin configuración extra y límite de error por vista. En Ego el renderer **no tiene router** (grep → 0 coincidencias): todo se resuelve con render condicional desde `apps/desktop/renderer/src/App.tsx` con un único `RootErrorBoundary.tsx`; no hay deep-link a conversación/proyecto, ni aislamiento de fallo por vista, ni chunk por vista (el budget vive en `manualChunks`, `apps/desktop/electron.vite.config.ts:51-83`). **Cableado:** `react-router` 7 en modo SPA sobre `apps/desktop/renderer/src/routes.ts`, conservando `manualChunks` y el budget de `scripts/verify-dist.cjs` (owner A4). | Ego: `CANV-01`, `CORE-13`, `DIST-03` | — |
| `OHND-12` | 🟡 Media | **Un solo escritor del estado de cliente + sello de doble reloj (servidor vs cliente)** | `src/hooks/chat/record-model-switch-message.ts:14-153`, `src/api/conversation-metadata-store.ts:38-48,108-119` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Todo camino que conoce un cambio (el `/model` del usuario vía REST, el handler del socket en vivo y el seed de historial) escribe **por una única función** que además sella `stamped_at`; al recargar, el seed re-deriva el estado del historial pero **sólo re-sella si la observación es estrictamente más nueva**, porque las observaciones llevan timestamp del servidor y la mutación del cliente lleva reloj local (heurística asumida explícitamente frente al rollback silencioso). El merge es incremental, nunca reemplazo. En Ego no existe perfil de modelo activo por sesión (grep `activeProfile\|llmProfile` → 0 en `packages/`): el `ModelRouter` decide por turno (`packages/models/src/ModelRouter.ts`) sin dejar constancia de qué perfil quedó activo ni de si el cambio lo hizo el agente o el usuario. **Cableado:** `packages/models/src/SessionModelProfile.ts` (escritor único + `stamped_at` en `session/<id>/meta`) y `settings.model_updated` (`packages/events/src/types.ts:53`) como fuente de verdad del sello (owner A2). | Ego: `DEC-01`, `CORE-07`, `CANV-07` | `OHND-05` |

---

## 3. Matriz de Integración con el Backlog Maestro ##

Cada compuerta `OHND-*` se ejecuta como pre-requisito de diseño y código de las fases del Backlog Maestro
(`docs/roadmap/Backlog.md`), respetando la regla de progresión estricta por fases de `AGENTS.md` §6.

```text
OHND-01  Log secuenciado + cursor ──► CORE-12 (admisión de sesión)
                                     ├─► TASK-03 (checkpoint reanudable)
                                     └─► REC-01 (reanudar tras crash)
OHND-02  Client tools (renderer) ───► ACT-01 (Tool Registry: executionTarget)
                                     ├─► CANV-03 (sync Chat ↔ Canvas)
                                     └─► INT-05 (bridge HITL)
OHND-03  Ledger de idempotencia ────► ACT-08 (errores/reintentos con contexto)
                                     └─► ACT-02 (ToolExecutionLoop)
OHND-04  Política por sesión ───────► ACT-06 (ApprovalEngine)
OHND-04  Secretos por referencia ───► SEC-03 (CredentialManager) + SEC-04 (cero secretos)
OHND-05  Metadatos reservados ──────► CORE-07 (VantaDB session/*) + SEC-06 (gov/audit)
OHND-06  Definitivo vs transitorio ─► ACT-09 (MCP cliente) + REC-06 (migraciones)
OHND-07  Docker sandbox ────────────► (DESCARTADO — ver fila OHND-07)
OHND-08  Cloud/MARS/telemetría ─────► (DESCARTADO — guardrail de dominio)
OHND-09  Agent server HTTP/WS ──────► (P1 — contrato externo, sólo con aprobación del owner)
OHND-10  Log de arranque + replay ──► REC-07 (DiagnosticsLogger) + REC-02 + DIST-02
OHND-11  Router declarativo ────────► CANV-01 (Canvas) + CORE-13 (Sidebar) + DIST-03
OHND-12  Un solo escritor + sello ──► DEC-01 (Model Router) + CORE-07 + CANV-07
```

**Protocolo de ejecución por compuerta:** (1) relectura del fichero fuente en `repos-referencia/openhands/`; (2)
reescritura en TypeScript estricto dentro de `packages/` o `apps/desktop/`, sin arrastrar React Router, MSW ni el
cliente HTTP; (3) test unitario en el paquete destino; (4) verificación de caller con grep sobre `packages/` +
`apps/desktop/` excluyendo `test/`, `dist/` y `node_modules/`; (5) cierre de la fila en `✅ Completada` sólo con
fichero **y** caller verificados.

---

## 4. Deuda abierta derivada de esta verificación ##

| # | Ítem | Tipo | Owner | Bloqueante |
| --- | --- | --- | --- | --- |
| D1 | `OHND-01`: el bus de eventos de Ego no tiene log durable ni `seq`; `EventBus` conserva 100 eventos en RAM y se pierden al reiniciar | Código | A2 | No |
| D2 | `OHND-02`: `ToolRegistry` no distingue dónde se ejecuta una tool; toda tool de Canvas es main-side y no puede invocar una acción de UI | Código | A2 | No |
| D3 | `OHND-03`: `ToolExecutionLoop` transporta `call.id` como identidad causal pero no la usa como clave de deduplicación de ejecución | Código | A2 | No |
| D4 | `OHND-04`: el gobierno de aprobación es global (`GovernanceMode`); no existe política negociada por sesión, lo que impide modos por proyecto o por Sub-Ego | Decisión | A2 | No |
| D5 | `OHND-09`: el modo Ego Cloud (proceso servidor + sync) no está definido en la jerarquía canónica; cualquier fila de "agent server propio" requiere aprobación explícita del owner antes de redactarse | Decisión | Owner | Sí (bloquea `OHND-09` y cualquier tarea que dependa de un backend remoto) |
| D6 | `OHND-11`: introducir un router en el renderer es un cambio estructural del shell (no un componente): exige migrar el render condicional de `App.tsx`, redefinir el chunk budget de `scripts/verify-dist.cjs` y revisar el deep-link de la ventana flotante | Decisión | A4 | No (bloquea `OHND-11` hasta que se apruebe el enfoque) |
| D7 | `OHND-10`: en un build empaquetado el stdout de Ego va a `/dev/null`; sin superficie de diagnóstico en la UI, un fallo de arranque es opaco para el usuario | Código | A4 | No |
