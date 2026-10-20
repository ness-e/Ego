# Extracción Técnica: OpenHands (repos-referencia/openhands) #

| Estado | Repositorio Origen | Stack del Origen | Rol en Ego | Owner | Fecha | Licencia |
| --- | --- | --- | --- | --- | --- | --- |
| Activo — ficha canónica de extracción y análisis de patrones | `repos-referencia/openhands/` (commit `8d39305`, rama `main`, profundidad 1) | Electron + React + Vite + React Router + Tailwind + TypeScript (MIT) | **Gemelo de stack Desktop (2º tras `hermes-agent`)** — shell Electron, preloads por ventana, router declarativo, canvas de agente y log de arranque | ness-e | 2026-10-20 | MIT (`package.json:5`, `LICENSE`) |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia ##

### 1.1 Qué es realmente este repositorio (verificado) ###

`repos-referencia/openhands/` es el paquete npm `@openhands/agent-canvas` v1.28.1 (`package.json:2-3`): una
**aplicación de escritorio Electron** que orquesta agentes de código con interfaz visual y streaming de ejecución.
No es "el frontend de OpenHands" en sentido menor:

* **Shell Electron completo**: `electron/main.mjs` (885 líneas) crea una ventana *splash* frameless y una ventana
  principal de 1440×900 maximizada con `titleBarStyle:"hiddenInset"` en macOS (`electron/main.mjs:385-405`), y se
  empaqueta con `electron-builder.config.mjs` (`npm run build:desktop`). Lleva un preload propio por ventana con
  `contextBridge` y superficie mínima: `electron/preload.cjs` (splash) y `electron/preload-main.cjs` (shell).
* **Renderer React 19 + Vite 8 + React Router 7 + Tailwind 4 + HeroUI 2 + Zustand 5 + TanStack Query 5**
  (`package.json:23-75`).
* **Producto, no librería**: `docker/`, `helm/`, `vercel.json`, `scripts/`, `tools/` y `specs/` completan un sistema
  distribuible (web, docker, helm y desktop).
* **Frontera del repositorio**: el *Agent Server* (Python) **ya no está aquí** — vive en
  `OpenHands/software-agent-sdk`, según la tabla "Repository Ownership" del `AGENTS.md` del propio repo. El desktop app
  lo *orquesta* como proceso subordinado (`electron/main.mjs:668-710` arranca el stack vía `uvx` y espera su
  readiness). En consecuencia, todo hallazgo de esta ficha sobre el agent server es una **observación de contrato
  externo**, no código local; los hallazgos de fondo son patrones del **shell Electron y del renderer React**, que sí
  son código de este repo.

### 1.2 Paralelismo con Ego ###

Ego y Agent Canvas Desktop son el **mismo tipo de producto**: una app Electron que aloja un runtime de agente, expone
chat + streaming + canvas, y empaqueta un instalador firmado. Por eso este repo es, después de `hermes-agent`, el
**gemelo de stack más cercano a Ego**. Resuelve cinco problemas que Ego tiene abiertos o resueltos de forma más débil:

1. **Un stream de eventos reanudable** (log secuenciado + cursor que salta huecos) en lugar de un buffer circular en RAM.
2. **Client tools**: herramientas cuyo handler vive en el cliente, con anotaciones de riesgo (`canvas_ui`,
   `launch_child_conversation`, `request_secret`).
3. **Un log de arranque legible por el usuario** (buffer acotado, sanitización ANSI, replay íntegro) — en una app
   empaquetada la consola es la única superficie de diagnóstico.
4. **Un renderer con router declarativo** (code-splitting por ruta y fallback `catch-all`) en lugar de un `App.tsx` con
   render condicional, y **un único escritor** del estado durable de cliente con reconciliación explícita entre el
   reloj del servidor y el del cliente.

### 1.3 Tabla de divergencias ###

| Dimensión | OpenHands (Agent Canvas Desktop) | Ego (Cognitive OS) | Decisión |
| --- | --- | --- | --- |
| **Shell de escritorio** | `electron/main.mjs`: splash frameless con log de arranque en vivo, ventana principal maximizada, cierre que drena el stack de procesos con red de seguridad de 6 s (`:817-873`) | `apps/desktop/src/main.ts` (Electron 33), sin proceso servidor subordinado | **Extraer el patrón de buffer de arranque** (`OHND-10`). **Descartar** el stack de procesos Python subordinado (guardrail: sin backend obligatorio en P0). |
| **Frontera main ↔ renderer** | Preload CommonJS por ventana con `contextBridge` y superficie mínima (`desktopBoot`, `desktopShell`); el renderer degrada a no-ops fuera de escritorio (`src/utils/desktop-shell.ts:29-46`) | Preload único tipado que expone el contrato IPC completo con esquemas Zod (`apps/desktop/src/preload.ts`, `apps/desktop/src/ipc/schema.ts`) | **Descartar** el preload mínimo por ventana: el modelo de Ego (IPC tipado + validación en main, `SEC-02`) es más estricto y ya es canónico. Conservar sólo la degradación a no-op. |
| **Estructura del renderer** | React Router 7 en modo SPA (`react-router.config.ts:88-94`: `ssr:false`, `basename` normalizado) con config declarativo de rutas anidadas y `catch-all` (`src/routes.ts:8-50`) | Sin router: un único `App.tsx` con render condicional y un `RootErrorBoundary.tsx` | **Extraer el patrón de router declarativo con chunk por ruta** (`OHND-11`). |
| **Canvas de agente** | Panel derecho por pestañas (files, terminal, browser, vscode, planner, tasklist) **dirigido por el propio agente** mediante la tool `canvas_ui` (`src/api/canvas-ui-client-tool.ts:60-91`) | Canvas declarativo `packages/ui-runtime/` + `canvas_render`, que es main-side (`packages/tools/src/native/canvas/NativeCanvasTool.ts:33-40`) | **Extraer el patrón de client tools** (`OHND-02`): es lo que convierte un canvas en un canvas *de agente*. |
| **Motor de ejecución** | Runtime por conversación: `DockerExecutionWorkspace` (`/workspace`) o `LocalWorkspace` (`src/api/agent-server-adapter.ts:541-566,1156-1165`) | Herramientas nativas en proceso con `PathValidator`/`ResourcePolicy`; `node:vm` en `ZeroContextKernel.ts:147` (descartada en `HERM-18`) | **Descartar Docker** como sustrato de ejecución; conservar el patrón de aislamiento negociado por sesión. |
| **Persistencia del stream** | Log durable en el servidor; rehidratación por `searchEvents` paginado (`src/api/event-service/event-service.api.ts:75-154`) | `EventBus` con historial circular de 100 eventos en RAM (`packages/events/src/EventBus.ts:84-85,153-157`); `EgoEvent` **sin** `seq` (`packages/events/src/types.ts:76-89`) | **Extraer y adaptar**: el log secuenciado durable vive en VantaDB, no en un proceso servidor. |
| **Aprobación y credenciales** | `confirmation_policy` negociada al iniciar + analizador enchufable (`src/api/agent-server-adapter.ts:767-792`); secretos por `LookupSecret` (`:1286-1307`) | `ApprovalEngine` con reglas estáticas + `GovernanceMode` global (`packages/execution/src/ApprovalEngine.ts:160-225`); `CredentialManager` (keychain) + `SecretsFilter` | **Extraer** la política por sesión y la indirección por referencia; **descartar** el analizador LLM (coste por llamada). |
| **Superficie de negocio** | OpenHands Cloud, organizaciones, MARS (DigitalOcean), suscripciones LLM, telemetría PostHog (`src/api/mars/`, `src/api/cloud/`, `package.json:44`, `config/defaults.json:42-45`) | Local-first, sin telemetría externa, sin organizaciones ni facturación (principio 9) | **Descartar por contaminación de dominio** (`AGENTS.md` §4). |

---

## 2. Inventario Quirúrgico de Patrones a Extraer ##

### Bloque A — Log de eventos secuenciado y cursor de reanudación ###

*Ubicación en fuente: `src/types/agent-server/session-frames.ts`, `src/utils/session-seq-cursor.ts`*

**A.1 Frames de sesión con sobre de protocolo** (`src/types/agent-server/session-frames.ts:15-79`)

* **Qué hace:** separa el sobre de transporte del registro durable. Siete tipos: `sync` (anuncia el rango que viene),
  `durable` (evento persistido, con `seq`), `transient` (publicado sin persistir, sin `seq`),
  `item_started`/`delta`/`item_aborted` (stream incremental con `item_id` + `attempt` + `order` monótono) y `error`
  (fallo del socket, no del modelo). `asSessionFrame` (`:95-107`) devuelve `null` ante lo desconocido: el sobre puede
  crecer sin romper clientes antiguos.
* **Adaptación en Ego:** `packages/events/src/` gana un discriminante `EgoFrame`
  (`sync`/`durable`/`transient`/`delta`/`item_aborted`) sobre el `EgoEvent` ya tipado; los `delta` resuelven el
  streaming sin ensuciar el log durable.
* **Relación con Backlog Ego:** `ACT-05`, `ACT-12`, `TASK-03`.

**A.2 Cursor de reanudación con salto de huecos** (`src/utils/session-seq-cursor.ts:9-63`)

* **Qué hace:** los eventos durables **no llegan en orden de `seq`** (una actualización de estado puede adelantarse al
  mensaje persistido justo antes), así que reanudar desde el `seq` más alto perdería lo que estaba en vuelo. El cursor
  guarda el `seq` más alto **sin hueco por debajo**, apila los vistos por encima en `ahead` y drena (`:30-36`). Si el
  hueco persiste (`MAX_AHEAD = 1024`, `:24`), **salta el hueco** en vez de congelarse (`:52-55`), porque un evento
  ilegible tampoco llegará en el replay.
* **Adaptación en Ego:** `EgoEvent` gana `seq` monótono por sesión y un `SessionResumeCursor` en `packages/events/src/`,
  alimentado desde `EventBus.emit` (`packages/events/src/EventBus.ts:100-165`) y persistido en VantaDB
  (`session/<id>/log`).
* **Relación con Backlog Ego:** `TASK-03`, `REC-01`, `CORE-12`.

### Bloque B — Client tools: herramientas que ejecuta el cliente, no el servidor ###

*Ubicación en fuente: `src/api/canvas-ui-client-tool.ts`, `src/api/launch-child-conversation-client-tool.ts`,
`src/utils/claim-client-tool-call.ts`*

**B.1 Contrato `ClientToolSpec` con anotaciones de riesgo** (`src/api/canvas-ui-client-tool.ts:9-20,60-91`)

* **Qué hace:** tool cuyo *handler vive en el cliente*: el servidor la anuncia en `client_tools` al arrancar la
  conversación (`src/api/agent-server-adapter.ts:1405-1415`) y emite la acción por el socket
  (`src/types/agent-server/core/base/action.ts:319-325` `CanvasUIAction`). El contrato declara anotaciones estilo MCP:
  `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` (`:85-90`). La descripción es un manual de uso
  para el modelo (`:22-58`).
* **Adaptación en Ego:** `packages/tools/src/ToolRegistry.ts` admite `executionTarget: "main" \| "renderer"`; las
  tools de renderer (revelar un artefacto en el Canvas, abrir una terminal, pedir un secreto) se despachan por
  `packages/events/src/InteractionTransport.ts`. Hoy la única tool de Canvas, `canvas_render`, es main-side y no puede
  pedirle a la UI que revele una pestaña.
* **Relación con Backlog Ego:** `ACT-01`, `CANV-03`, `INT-05`.

**B.2 Ledger de idempotencia por `toolCallId`** (`src/utils/claim-client-tool-call.ts:10-34`)

* **Qué hace:** algunas client tools **no son idempotentes** (lanzar una conversación en Cloud cuesta dinero; pedir un
  secreto molesta). El ledger *reclama* el `toolCallId` **antes** de ejecutar y devuelve `false` en un replay, para que
  una reconexión o una carrera REST/WS no repita trabajo real. Aplicado en
  `src/services/child-conversation-launch.ts:518-525` y `src/services/secret-request.ts:48-55`.
* **Adaptación en Ego:** `packages/runtime/src/ToolExecutionLoop.ts` ya propaga `call.id` como
  `callId`/`toolCallId` (`:118,405,435,683`) pero no lo usa como clave de deduplicación; el ledger vive en VantaDB
  (`session/<id>/ledger`) y se consulta **antes** de la ejecución material
  (`packages/runtime/src/ToolExecutionLoop.ts:695-699`).
* **Relación con Backlog Ego:** `ACT-08`, `ACT-02`, `CORE-12`.

### Bloque C — Gobierno de sesión y superficie de metadatos ###

*Ubicación en fuente: `src/api/agent-server-adapter.ts`, `src/api/conversation-metadata-store.ts`*

**C.1 Política de confirmación negociada al abrir la sesión, y secretos por
indirección** (`src/api/agent-server-adapter.ts:767-792,1196,1286-1307,1416-1417`;
`src/types/agent-server/core/base/action.ts:362-367`)

* **Qué hace:** (a) La política se resuelve **una vez** y viaja explícita en el arranque: `NeverConfirm` (sin
  `confirmation_mode`), `ConfirmRisky` (con `security_analyzer:"llm"` → umbral `HIGH`, `confirm_unknown:true`) o
  `AlwaysConfirm`; el analizador es enchufable (`LLMSecurityAnalyzer`, `PatternSecurityAnalyzer`,
  `PolicyRailSecurityAnalyzer`, `:781-792`). (b) `request.secrets` viaja como `LookupSecret` =
  `{kind, url, headers?, description?}`: el **valor** nunca pasa por el agente, que sólo ve nombre y propósito; si el
  secreto ya está guardado se adjunta al instante y si no, se encola a una tarjeta de chat que se lo pide al usuario
  (`src/services/secret-request.ts:24-68`, con la guía explícita de no pedirlo en el chat, `:76-80`).
* **Adaptación en Ego:** `SessionApprovalPolicy` resuelta en la admisión de sesión
  (`packages/memory/EgoMemoryLifecycle.ts`) y entregada al `ApprovalEngine`
  (`packages/execution/src/ApprovalEngine.ts:160-225`), que hoy sólo consulta reglas estáticas y un `GovernanceMode`
  global. El almacén canónico de secretos sigue siendo el `CredentialManager`
  (`packages/security/src/CredentialManager.ts`); lo que se extrae es la **referencia opaca** (`secretRef` = id +
  propósito) en lugar del valor. Se descarta el analizador LLM: multiplica el coste por llamada en un runtime que ya
  mide tokens y coste.
* **Relación con Backlog Ego:** `ACT-06`, `CORE-12`, `SEC-05`, `SEC-03`, `SEC-04`.

**C.2 Metadatos etiquetados: claves reservadas frente a claves mostrables** (`src/api/agent-server-adapter.ts:561-678`)

* **Qué hace:** los `tags` del servidor son un `Record<string,string>` genérico, pero la UI **sólo** muestra los no
  reservados. `RESERVED_CONVERSATION_TAG_KEYS` (`:606-627`) excluye el enrutado interno y los sellos de máquina;
  `PRIORITY_CONVERSATION_TAG_KEYS` (`:634-637`) fija un orden estable; `getDisplayConversationTags` (`:645-678`)
  normaliza la clave (`trim().toLowerCase()`) para que un backend cloud con `"Origin"` no pierda la prioridad, y
  descarta valores vacíos o sólo-espacios.
* **Adaptación en Ego:** `EgoEvent.metadata` y los metadatos de sesión en VantaDB (`session/<id>/meta`) adoptan la
  separación *reservado* (routing interno, stamps de máquina) frente a *visible* (etiquetas de usuario), con orden
  estable y normalización de clave.
* **Relación con Backlog Ego:** `CORE-07`, `DS-03`, `SEC-06`.

### Bloque D — Negociación de capacidades y clasificación de fallos ###

*Ubicación en fuente: `src/api/agent-server-compatibility.ts`, `src/api/with-retry.ts`*

**D.1 Suelo de versión y error definitivo frente a
transitorio** (`src/api/agent-server-compatibility.ts:20-24,203-231,253-278,292-326`;
`config/defaults.json:8-10`)

* **Qué hace:** `compatibility.minimumAgentServer` vive en un único JSON de verdad compartida; la comparación semver es
  propia e incluye prerelease (`:203-231`); hay tres errores distintos —versión no soportada, versión desconocida,
  backend inalcanzable— e `isDefinitiveLocalBackendError` (`:320-326`) separa el fallo **decidido por el servidor**
  (clave rechazada, versión vieja) del **tránsito**: el decidido no se reintenta porque reintentar no cambia el
  resultado.
* **Adaptación en Ego:** el mismo discriminante definitivo/transitorio se aplica a
  `packages/integrations/src/mcp/McpClient.ts` (hoy sólo tiene timeouts: `:571-575,672-682`, sin reintento) y a los
  *capability probes* de binding de VantaDB (`packages/memory/EgoMemoryAdapter.ts:1190,1217`).
* **Relación con Backlog Ego:** `ACT-09`, `INT-01`, `REC-06`.

**D.2 Reintento con backoff sólo en lo retryable** (`src/api/with-retry.ts:7-30`)

* **Qué hace:** `isRetryableError` clasifica: sin respuesta → retryable; `408`/`429` → retryable; `4xx` distinto de
  esos → **no** retryable (el servidor rechazó la petición, repetir devuelve lo mismo); `5xx` → retryable. `withRetry`
  (`:36-58`) hace backoff exponencial `base * 2^attempt`.
* **Adaptación en Ego:** reutilizable tal cual en `packages/integrations/` para HTTP/webhooks (Nivel C) y en el
  `CircuitBreaker` de `packages/execution/src/CircuitBreaker.ts`.
* **Relación con Backlog Ego:** `ACT-09`, `INT-01`.

### Bloque E — Shell Electron, preloads y estructura del renderer ###

*Ubicación en fuente: `electron/main.mjs`, `electron/preload.cjs`, `src/routes.ts`,
`src/hooks/chat/record-model-switch-message.ts`*

**E.1 Log de arranque en el splash: buffer acotado, sanitización y
replay** (`electron/main.mjs:476-537,367-379`; `electron/preload.cjs:13-31`)

* **Qué hace:** cada línea de log de los servicios subordinados se sanea (se quitan las secuencias ANSI y se colapsa
  el redibujo por `\r` al último frame, `:505-512`), se guarda en un buffer acotado (2000 líneas, `:487-518`) y se
  transmite al splash en lotes cada 200 ms (`:526-537`). Cuando la página del splash termina de cargar, el buffer **se
  reenvía íntegro** (`:367-379`) para que no se pierdan las líneas emitidas antes de que el renderer existiera. En una
  app empaquetada, `stdout` va a `/dev/null` y ese console es la **única** superficie de diagnóstico (`:476-486`).
* **Adaptación en Ego:** `apps/desktop/src/main.ts` no tiene buffer de arranque ni superficie de log en la app;
  `packages/recovery/src/DiagnosticsLogger.ts` (`REC-07`) escribe a disco rotativo, que el usuario no ve. Extraer el
  patrón: buffer acotado + sanitización + flush por lotes IPC + replay al montar el renderer, expuesto como "Copiar
  diagnóstico" en el Ajustes de Ego.
* **Relación con Backlog Ego:** `REC-07`, `REC-02`, `DIST-02`.

**E.2 Router declarativo en el renderer con rutas anidadas y chunk por
ruta** (`src/routes.ts:8-50`; `react-router.config.ts:88-94`; `src/root.tsx:94,234`)

* **Qué hace:** el renderer se declara como un config de rutas **declarativo** (`layout` + `route` anidados, un
  `index` por sección, un `catch-all` `route("*")` que absorbe URLs desconocidas) y se construye en modo SPA
  (`ssr: false`, `basename` normalizado desde `VITE_BASE_PATH`). Cada ruta es su propio módulo ⇒ code-splitting por
  ruta sin configuración extra, y cada ruta puede llevar su propio límite de error.
* **Adaptación en Ego:** el renderer **no tiene router** (grep `react-router\|RouterProvider` sobre
  `apps/desktop/renderer` → 0 coincidencias): todo se resuelve con render condicional desde
  `apps/desktop/renderer/src/App.tsx`, con un único `RootErrorBoundary.tsx` global. No hay deep-link a
  conversación/proyecto, ni aislamiento de fallo por vista, ni chunk por vista (el budget vive en `manualChunks`,
  `apps/desktop/electron.vite.config.ts:51-83`).
* **Relación con Backlog Ego:** `CANV-01`, `CORE-13`, `DIST-03`.

**E.3 Un solo escritor del estado de cliente y sello de doble
reloj** (`src/hooks/chat/record-model-switch-message.ts:14-153`;
`src/api/conversation-metadata-store.ts:38-48,108-119`)

* **Qué hace:** todo camino que conoce un cambio (el `/model` del usuario vía REST, el handler del socket en vivo y
  el seed de historial) escribe **por una única función** (`stampActiveLlmProfile`, `:38-54`) que además sella
  `stamped_at`. Al recargar, el seed re-deriva el perfil activo del historial, pero **sólo re-sella si la observación
  es estrictamente más nueva** que el sello existente (`:143-151`): como las observaciones llevan timestamp del servidor
  y el `/model` del cliente lleva reloj local, la comparación cross-clock es una heurística asumida explícitamente
  (`:90-92`) frente a la alternativa de un rollback silencioso. El merge es incremental, nunca reemplazo
  (`:45-49,108-119`).
* **Adaptación en Ego:** no existe perfil de modelo activo por sesión (grep `activeProfile\|llmProfile` sobre
  `packages/` → 0 coincidencias); el `ModelRouter` decide por turno (`packages/models/src/ModelRouter.ts`) sin dejar
  constancia de *qué* perfil quedó activo ni de si el cambio lo hizo el agente o el usuario.
* **Relación con Backlog Ego:** `DEC-01`, `CORE-07`, `CANV-07`.

---

## 3. Matriz de Extracción vs Descarte ##

| Componente OpenHands | Acción | Razón Técnica / Arquitectónica |
| --- | :---: | --- |
| `session-frames.ts` + `session-seq-cursor.ts` | **EXTRAER & ADAPTAR** | Resuelve un hueco real de Ego: `EventBus` pierde todo al reiniciar (historial circular de 100 en RAM, `packages/events/src/EventBus.ts:84-85`) y `EgoEvent` no tiene `seq` (`packages/events/src/types.ts:76-89`). |
| `canvas-ui-client-tool.ts` + `launch-child-conversation-client-tool.ts` | **EXTRAER PATRÓN** | El contrato `ClientToolSpec` con anotaciones de riesgo es transferible; la implementación web no. Habilita tools que sólo el renderer puede cumplir. |
| `claim-client-tool-call.ts` | **EXTRAER PATRÓN** | `ToolExecutionLoop` ya tiene la identidad (`call.id`) pero no la usa para deduplicar. Es idempotencia de ejecución, no de memoria. |
| `agent-server-adapter.ts` (política de confirmación + `LookupSecret`) | **EXTRAER PATRÓN** | La negociación por sesión complementa (no sustituye) a `ApprovalEngine`; el analizador LLM se descarta por coste. La indirección del secreto es compatible con `SEC-04` y refuerza el keychain canónico. |
| `agent-server-adapter.ts` (tags reservados/visibles) | **EXTRAER PATRÓN** | Separar metadatos de máquina de metadatos de usuario evita fuga de routing interno a la UI y evita que el usuario falsifique clasificaciones. |
| `agent-server-compatibility.ts` + `with-retry.ts` | **EXTRAER PATRÓN** | La clasificación definitivo/transitorio es ortogonal al runtime: vale para MCP, webhooks y probes de binding. |
| `electron/main.mjs:476-537` (log de arranque) | **EXTRAER & ADAPTAR** | En una app empaquetada el stdout es `/dev/null`: sin una superficie de log en la UI, un fallo de arranque es opaco para el usuario. |
| `src/routes.ts` + `react-router.config.ts` | **EXTRAER PATRÓN** | El renderer de Ego no tiene router: no hay deep-link, ni error-por-vista, ni chunk-por-vista. |
| `record-model-switch-message.ts` | **EXTRAER PATRÓN** | El modelo "un solo escritor + sello persistido + reconciliación cross-clock" evita el rollback silencioso de un cambio de modelo. |
| `electron/lib/window-url-policy.mjs` | **DESCARTAR** | Sustituido y superado por `apps/desktop/src/main/security/electron-security.ts:46-80,138-149`, que ya parsea la URL (no hace *prefix matching*) y aplica deny-by-default más estricto que el allowlist de OpenHands. |
| `electron/preload.cjs`, `electron/preload-main.cjs` | **DESCARTAR** | Sustituido por el preload tipado único de Ego (`apps/desktop/src/preload.ts` + `apps/desktop/src/ipc/schema.ts`), que valida en main con Zod (`SEC-02`). |
| `electron/main.mjs:817-873` (drenaje de proceso y `before-quit`) | **DESCARTAR** | Sustituido por `packages/recovery/src/OpGate.ts:36-66` (`REC-02`): Ego ya drena operaciones en vuelo con timeout antes de cerrar. |
| `src/services/child-conversation-launch.ts:240-317` (worktree con degradación) | **DESCARTAR** | Sustituido por `packages/subegos/src/SubEgoWorktree.ts:28-36` (`HERM-17`), que ya incluye `preservedForReview` y `note` explícita de la degradación. |
| Runtime sandbox Docker (`agent-server-adapter.ts:541-566`) | **DESCARTAR** | Exigiría un runtime de contenedores y un daemon de ejecución en un desktop local-first; duplicaría `SEC-05`/`PathValidator`/`ResourcePolicy`. |
| OpenHands Cloud / MARS / organizaciones / PostHog | **DESCARTAR** | Contaminación de dominio: modelos de negocio y telemetría externa ajenos a un SOC local-first (principio 9). |
| Analizador de riesgo por LLM (`LLMSecurityAnalyzer`) | **DESCARTAR** | Añade una inferencia por llamada sensible en un runtime que ya presupuesta tokens y coste (`DEC-08`, `DS-05`); los analizadores `pattern`/`policy_rail` sí son transferibles. |

---

## 4. Estado real verificado (2026-10-20) ##

> Criterio de cierre: fichero adaptado **y** caller en producción verificado por grep sobre `packages/` +
> `apps/desktop/` (excluyendo `test/`, `dist/`, `node_modules/`).
> Este repositorio de referencia es **nuevo**: ninguna fila ha sido asimilada todavía.

| ID | Patrón | Estado | Evidencia / Fundamento |
| --- | --- | :---: | --- |
| `OHND-01` | Log de eventos secuenciado + cursor de reanudación con salto de huecos | 🆕 Pendiente | No asimilado. Grep `SeqCursor\|resumeCursor\|replayFrom\|lastSeq\|sequenceNumber` sobre `packages/` → 0 coincidencias. `EventBus` sólo guarda 100 eventos en RAM (`packages/events/src/EventBus.ts:84-85,153-157`). **Cableado:** `packages/events/src/SessionEventLog.ts` + `SessionResumeCursor.ts`, numerar en `EventBus.emit` (`:100-165`) y persistir en VantaDB `session/<id>/log` (owner A2). |
| `OHND-02` | Client tools ejecutadas en el cliente con contrato y anotaciones de riesgo | 🆕 Pendiente | No asimilado. Grep `clientTool\|ClientTool\|rendererTool` sobre `packages/` → 0 coincidencias; `canvas_render` es main-side (`packages/tools/src/native/canvas/NativeCanvasTool.ts:33-40`). **Cableado:** `executionTarget: "main" \| "renderer"` en `packages/tools/src/ToolRegistry.ts` + dispatch por `packages/events/src/InteractionTransport.ts` (owner A2). |
| `OHND-03` | Ledger de idempotencia por `toolCallId` | 🆕 Pendiente | No asimilado. Grep `idempot\|ledger\|dedup` sobre `packages/` → sólo deduplicación de memoria/knowledge, ningún ledger de tool calls. `ToolExecutionLoop` ya lleva `call.id` (`packages/runtime/src/ToolExecutionLoop.ts:118,405,435,683`) sin deduplicar. **Cableado:** `packages/execution/src/ToolCallLedger.ts`, consulta previa a la ejecución material (`ToolExecutionLoop.ts:695-699`), persistido en `session/<id>/ledger` (owner A2). |
| `OHND-04` | Política de aprobación negociada por sesión + secretos por indirección | 🆕 Pendiente | No asimilado. `ApprovalEngine.evaluateRequirement` sólo consulta reglas estáticas y el `GovernanceMode` global (`packages/execution/src/ApprovalEngine.ts:160-225`); tampoco existe referencia opaca de secreto (grep `LookupSecret\|secretRef` sobre `packages/` → 0 coincidencias), sólo el `CredentialManager` con valor. **Cableado:** `SessionApprovalPolicy` en `packages/execution/src/`, resuelta en la admisión de `packages/memory/EgoMemoryLifecycle.ts`, y `secretRef` (id + propósito) como único handle que ve el agente (owner A2). |
| `OHND-05` | Metadatos de sesión: claves reservadas frente a claves visibles | 🆕 Pendiente | No asimilado. Grep `reservedTag\|displayTags\|sessionTags\|tagKey` sobre `packages/` → 0 coincidencias; `EgoEvent.metadata` es un `Record` libre (`packages/events/src/types.ts:76-89`). **Cableado:** helper de proyección en `packages/events/src/` + namespace `session/<id>/meta` (owner A2). |
| `OHND-06` | Clasificación de error definitivo frente a transitorio y reintento con backoff | 🆕 Pendiente | No asimilado. Grep `isRetryable\|withRetry` sobre `packages/` → 0 coincidencias; `packages/integrations/src/mcp/McpClient.ts:571-575,672-682` sólo aplica timeout. **Cableado:** `packages/integrations/src/http-retry.ts` + integración en `McpClient` y en `packages/execution/src/CircuitBreaker.ts` (owner A3). |
| `OHND-07` | Runtime sandbox en contenedor (Docker) como sustrato de ejecución | 🚫 **Descartada (con justificación)** | Un desktop local-first no puede exigir un runtime de contenedores ni un daemon de ejecución: duplica el aislamiento ya cubierto por `packages/tools/src/native/security/ResourcePolicy.ts` y `packages/tools/src/native/fs/PathValidator.ts` (`SEC-05`) y contradice el guardrail de no introducir procesos backend obligatorios en P0. Sólo se conserva el patrón de aislamiento negociado por sesión, sin Docker. |
| `OHND-08` | OpenHands Cloud, MARS (DigitalOcean), organizaciones, suscripciones LLM y telemetría PostHog | 🚫 **Descartada (con justificación)** | Contaminación de dominio: `src/api/mars/`, `src/api/cloud/`, `src/api/llm-subscription-service.ts`, `package.json:44` (`posthog-js`) y `config/defaults.json:42-45` introducen modelos de negocio (organizaciones, facturación, alojamiento gestionado) y salida de telemetría ajenos a un SOC local-first con principio 9. |
| `OHND-09` | Contrato del Agent Server HTTP + WebSocket (observación externa, no código local) | ⏳ Futura (P1 — Cloud) | El Agent Server **no forma parte de este repositorio** (vive en `OpenHands/software-agent-sdk`); lo único local es el cliente que habla con él (`src/hooks/use-websocket.ts:29-258`, `src/api/event-service/event-service.api.ts:75-154`). Por tanto este hallazgo es una **observación de contrato externo**, no código asimilable. Sujeto al guardrail de `AGENTS.md` §7 (el Cognitive Runtime nunca contiene lógica de servicio) y al principio 9: incompatible con P0. **Fase destino:** P1, sólo si el owner aprueba un modo Ego Cloud (Ego Web + sync), donde el mismo contrato de frames de `OHND-01` sería el eje de la negociación. |
| `OHND-10` | Log de arranque en el splash: buffer acotado, sanitización ANSI/CR, flush por lotes IPC y replay íntegro | 🆕 Pendiente | No asimilado. `packages/recovery/src/DiagnosticsLogger.ts` (`REC-07`) escribe a disco rotativo y no hay ninguna superficie de log *dentro* de la app; `apps/desktop/src/main.ts` no tiene buffer de arranque. En un build empaquetado el stdout va a `/dev/null` (`electron/main.mjs:476-486`), luego hoy un fallo de arranque es opaco para el usuario. **Cableado:** `apps/desktop/src/main/boot-log.ts` (buffer 2000 líneas + `sanitizeLogLine` + flush por lotes) + renderer `components/diagnostics/BootLogPanel.tsx` con "Copiar diagnóstico" (owner A4). |
| `OHND-11` | Router declarativo en el renderer con rutas anidadas, `catch-all` y chunk por ruta | 🆕 Pendiente | No asimilado. Grep `react-router\|createBrowserRouter\|RouterProvider` sobre `apps/desktop/renderer` → 0 coincidencias: el renderer resuelve todo con render condicional desde `apps/desktop/renderer/src/App.tsx` y un único `RootErrorBoundary.tsx`. No hay deep-link a conversación/proyecto, ni límite de error por vista, ni chunk por vista. **Cableado:** `react-router` 7 en modo SPA sobre `apps/desktop/renderer/src/routes.ts`, con `basename` normalizado; mantener `manualChunks` y el budget de `scripts/verify-dist.cjs` (owner A4, fase `DIST-03`). |
| `OHND-12` | Un solo escritor del estado de cliente + sello de doble reloj para reconciliar servidor y cliente | 🆕 Pendiente | No asimilado. Grep `activeProfile\|active_profile\|llmProfile\|selectedProfile` sobre `packages/` → 0 coincidencias; el `ModelRouter` decide por turno (`packages/models/src/ModelRouter.ts`) sin dejar constancia del perfil activo ni del origen del cambio (agente vs usuario). **Cableado:** `packages/models/src/SessionModelProfile.ts` (escritor único + `stamped_at` en `session/<id>/meta`) y evento `settings.model_updated` (`packages/events/src/types.ts:53`) como fuente de verdad del sello (owner A2). |

**Recuento:** 0 `✅ Completada` · 2 `🚫 Descartada` · 9 `🆕 Pendiente` · 1 `⏳ Futura` — **12 tareas**.

## 5. Descarte normalizado a la forma canónica ##

Las filas de la matriz §3 usaban la forma `**DESCARTAR**`; se normalizan aquí a
`🚫 Descartada (con justificación)` (AGENTS.md §4) conservando el motivo original:

| Componente OpenHands | Veredicto | Fundamento |
| --- | :---: | --- |
| Política de URLs de ventana (`electron/lib/window-url-policy.mjs`) | 🚫 **Descartada (con justificación)** | Sustituido y superado por `apps/desktop/src/main/security/electron-security.ts:46-80,138-149`: Ego parsea la URL con `new URL()` (no hace *prefix matching*, que es exactamente el fallo que OpenHands documenta), limita la apertura externa a `https:` sin credenciales embebidas y niega todo popup. |
| Preload mínimo por ventana (`electron/preload.cjs`, `electron/preload-main.cjs`) | 🚫 **Descartada (con justificación)** | Sustituido por el preload tipado único de Ego (`apps/desktop/src/preload.ts` + `apps/desktop/src/ipc/schema.ts`), que expone un contrato Zod validado en main (`SEC-02`) en lugar de una superficie ad-hoc por ventana. |
| Drenaje de proceso y `before-quit` (`electron/main.mjs:817-873`) | 🚫 **Descartada (con justificación)** | Sustituido por `packages/recovery/src/OpGate.ts:36-66` y `REC-02`: Ego ya drena las operaciones en vuelo con timeout antes de cerrar, sin depender de señales POSIX ni del apagado de un árbol de procesos. |
| Aislamiento por worktree con degradación (`src/services/child-conversation-launch.ts:240-317`) | 🚫 **Descartada (con justificación)** | Sustituido por `packages/subegos/src/SubEgoWorktree.ts:28-36` (`HERM-17`), que ya expone `preservedForReview` y una `note` explícita cuando la degradación del aislamiento cambia el resultado. |
| Runtime sandbox Docker (`DockerExecutionWorkspace`) | 🚫 **Descartada (con justificación)** | Exige runtime de contenedores y daemon de ejecución en un desktop local-first; duplica `SEC-05` (`ResourcePolicy` + `PathValidator`) y contradice el guardrail de no introducir procesos backend obligatorios en P0. |
| OpenHands Cloud / MARS / organizaciones / suscripciones / PostHog | 🚫 **Descartada (con justificación)** | Contaminación de dominio: modelos de negocio ajenos al SOC y telemetría externa incompatible con el principio 9. |
| Analizador de riesgo basado en LLM (`LLMSecurityAnalyzer`) | 🚫 **Descartada (con justificación)** | Añade una inferencia por llamada sensible en un runtime que ya presupuesta tokens y coste (`DEC-08`, `DS-05`); `PatternSecurityAnalyzer`/`PolicyRailSecurityAnalyzer` sí son transferibles como implementación futura de la política por sesión de `OHND-04`. |
