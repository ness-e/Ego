# Extracción Técnica: AG-UI (repos-referencia/ag-ui) #

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de patrones (1.ª revisión, repo nuevo) |
| Repositorio Origen | `repos-referencia/ag-ui/` (Commit verificado: `3decbe8`, rama `main`, profundidad 1) |
| Stack del Origen | TypeScript 5.8 estricto + RxJS 7 (Observables) + Zod + Nx monorepo (pnpm workspaces) + spec 1.0 en Markdown (`docs/spec/1.0/`), SDKs TS/Python/.NET/Rust/Dart/Java + 23 integraciones de frameworks |
| Rol en Ego | Contrapunto directo al borde agente↔UI de `packages/ui-runtime/` (CanvasBridge, A2UIAdapter, ComponentRegistry) y al bus canónico `packages/events/` (EventBus, EgoEvent) |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Licencia | MIT (origen). Cualquier porte debe llevar cabecera `Adapted from ag-ui-protocol/ag-ui (MIT), <ruta>` + `LICENSE.md` en el paquete (README §4.3) |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia ##

AG-UI es un **protocolo de interoperabilidad** (Agent-User Interaction Protocol, versión de protocolo `1.0`, SDK
cliente `1.0.3`), no una arquitectura de aplicación. Resuelve el mismo problema que el borde de Ego —transportar
ciclo de vida, estado y llamadas de herramienta entre un runtime de agente y su UI— pero con tres decisiones de
diseño que **no** encajan en el stack canónico de Ego:

1. **Vocabulario de eventos propio.** AG-UI define una unión discriminada de 31 eventos (`RUN_STARTED`,
   `RUN_FINISHED`, `TEXT_MESSAGE_*`, `TOOL_CALL_*`, `STATE_SNAPSHOT`, `STATE_DELTA`, `MESSAGES_SNAPSHOT`,
   `ACTIVITY_*`, `REASONING_*`, `SUBAGENT_*`, `RAW`, `CUSTOM`) con `type` + `timestamp` + `rawEvent` + `metadata`
   (`sdks/typescript/packages/core/src/generated/types.ts:2555`, `:3018`).
2. **Estado compartido como documento sincronizado.** El estado es un valor JSON arbitrario transportado por
   instantáneas completas o deltas **RFC 6902 (JSON Patch)** sobre JSON Pointer RFC 6901 (`types.ts:723`, `:904`,
   `:765`, `:883`).
3. **Capa de coprocesamiento observable.** Una cadena de *middleware* (`Middleware.run(input, next)`) que puede
   transformar, filtrar y auditar el flujo de eventos sin tocar el agente
   (`client/src/middleware/middleware.ts:9`, `:24`).

Ego ya tiene resueltos los tres-gasol **en otra forma**: un bus canónico tipado y cerrado
(`packages/events/src/types.ts:5`, `packages/events/src/EventBus.ts:81`), un normalizador de eventos externos
(`packages/events/src/EventNormalizer.ts:35`) y un protocolo Canvas↔Chat con ChangeSets atómicos
(`packages/ui-runtime/src/CanvasBridge.ts:165`). **Conclusión de cabecera: AG-UI no es la arquitectura de Ego; es
un posible *protocolo de salida* para el futuro Ego Web / integraciones externas.** Se extraen cuatro patrones
puntuales; se descartan cuatro con fundamento.

### Divergencias Fundamentales (Qué Descartamos y Por Qué) ###

| Dimensión | AG-UI | Ego (Cognitive OS) | Decisión Crítica |
| --- | --- | --- | --- |
| **Vocabulario de eventos** | Unión de 31 tipos `Event` en `core/src/generated/types.ts:2555`, con `rawEvent` verbatim y `metadata` libre. | `EgoEventType` cerrado (~40 tipos canónicos) + `CanonicalEventPayloadMap` tipado por evento (`packages/events/src/types.ts:5`, `:100`). | **DESCARTAR** la unión AG-UI como vocabulario interno. El `EventNormalizer` (`packages/events/src/EventNormalizer.ts:7`) ya cumple el papel de traducir eventos externos al vocabulario canónico; AG-UI queda como *protocolo de interop* (Nivel C), no como segunda fuente de verdad. |
| **Transporte** | HTTP + SSE + WebSocket + protobuf binario, cliente y servidor en red (`client/src/transform/{http,sse,proto}.ts`, `AgentCapabilities.transport` en `types.ts:2660`). | IPC Electron tipado con `contextIsolation=true`, `sandbox=true` (`apps/desktop/src/preload.ts:299-427`), sin red local obligatoria. | **DESCARTAR** los transportes de AG-UI en desktop. Solo serían admisibles en Ego Web (HTTP público), donde el borde sí es red. |
| **Dependencias reactivas** | RxJS (`Observable`, `ReplaySubject`, `concatMap`) en el núcleo del cliente (`client/src/middleware/middleware.ts:3-4`). | TypeScript estricto + Node 22 + Electron, sin RxJS; asincronía con `Promise`, `AbortController` y `queueMicrotask` (`packages/events/src/EventBus.ts:160`). | **EXTRAER PATRÓN** (semántica del reductor y del chain), **no** la dependencia RxJS. Un `Observable` no encaja en el IPC Electron ni en el `EventBus` canónico. |
| **Persistencia de estado** | El estado vive en el productor y se transmite; el cliente solo lo aplica en memoria (`client/src/apply/default.ts:698-760`). | VantaDB 0.8.0 in-process (`NativeVantaDB`) es el sustrato soberano; `CanvasPersistence` persiste el Canvas en `workspace/*` (`CANV-06`). | **EXTRAER PATRÓN** (snapshot/delta), **no** el modelo de estado en memoria del cliente. |
| **A2UI** | Middleware que emite superficies generativas con catálogo y ciclo de vida `building → retrying → failed` (`middlewares/a2ui-middleware/src/index.ts:138`, `:187`). | `A2UIAdapter` + `CanvasBridge` + `CanvasComponentRegistry` (`packages/ui-runtime/src/A2UIAdapter.ts:22`, `packages/ui-runtime/src/CanvasBridge.ts:284`, `packages/ui-runtime/src/ComponentRegistry.ts:55`). | **EXTRAER PATRÓN** (validación semántica previa a pintar + reintento acotado). La superficie A2UI ya es canónica en Ego: `CANV-01`, `CANV-02`, `CANV-05`. |
| **Integraciones de frameworks** | 23 conectores (LangGraph, CrewAI, ADK, Mastra, LangChain, Strands, PydanticAI, LlamaIndex, A2A…). | Cognitive Runtime propio con Model Router; las integraciones no deben tocar Runtime/Router/Sub-Egos (`AGENTS.md` §7). | **DESCARTAR** el catálogo. Solo el patrón de *traductor de proveedor a evento canónico* es transferible, y ya está cubierto por `EventNormalizer`. |

---

## 2. Inventario Quirúrgico de Patrones a Extraer ##

### Bloque A: Contrato de eventos y ciclo de vida del run ###

*Ubicación en fuente:* `sdks/typescript/packages/core/src/generated/types.ts`

1. **`Event` (unión discriminada) y `BaseEvent`**
   - **Qué hace:** Define el contrato cerrado del protocolo: cada evento lleva `type` (discriminante), `timestamp`
     (número JSON, deliberadamente no float), `rawEvent` (evento nativo del proveedor, verbatim, para depuración) y
     `metadata` (extensión libre por clave). `types.ts:2555` enumera las 31 variantes; `types.ts:3018` define
     `BaseEvent` compuesto en cada una.
   - **Adaptación en Ego:** No se adopta la unión. Lo transferible es la **composición de `BaseEvent`** (campos
     comunes + payload por variante) como criterio de diseño para cualquier futura ampliación del protocolo, y la
     idea de `rawEvent` verbatim como canal de depuración, ya satisfecha por
     `packages/events/src/StructuredLogger.ts` y el `metadata` de `EgoEvent` (`packages/events/src/types.ts:94`).
   - **Relación con Backlog Ego:** `ACT-05`, `ACT-12`, `CORE-02`.

2. **Ciclo de vida del run y sus desenlaces**
   - **Qué hace:** `RUN_STARTED` (con `threadId`, `runId`, `protocolVersion`, `input` ecoado), `RUN_FINISHED` con
     `outcome` discriminado (`success` | `interrupt` | `cancelled`, `types.ts:1695`, `:1773`, `:1794`, `:1804`) y
     `RUN_ERROR` (`types.ts:1935`). El `protocolVersion` viaja *en banda*, no por el transporte, para que un
     intercambio grabado siga siendo autodescriptivo (`types.ts:1588`).
   - **Adaptación en Ego:** Ego ya modela el turno con `task.started`/`task.completed`/`task.failed`
     (`packages/events/src/types.ts:101-105`) y `metrics.turn` (`:148`). Se descarta el modelo de outcome
     (`interrupt`) y se conserva la idea de **versionado en banda** como candidato para el canal de interoperabilidad
     de Ego Web.
   - **Relación con Backlog Ego:** `ACT-05`, `ACT-12`, `CORE-02`.

### Bloque B: Estado compartido (snapshot + deltas RFC 6902) ###

*Ubicación en fuente:* `sdks/typescript/packages/core/src/generated/types.ts`,
`sdks/typescript/packages/client/src/apply/default.ts`

1. **`StateSnapshotEvent` / `StateDeltaEvent` / `JsonPatch`**
   - **Qué hace:** `STATE_SNAPSHOT` reemplaza el estado completo (`types.ts:723`); `STATE_DELTA` lo muta con un patch
     RFC 6902 (`types.ts:904`) compuesto por operaciones `add|remove|replace|move|copy|test` sobre JSON Pointer
     RFC 6901 (`types.ts:765`, `:770-870`, `:883`, `:899`). El reducer del cliente aplica el patch **sin mutar el
     original** y **de forma atómica**: `jsonpatch.applyPatch(state, delta, true, false)`
     (`client/src/apply/default.ts:747`), con captura de error que **no** emite actualización si el patch falla
     (`:750-757`). La compactación de stream colapsa todos los snapshots/deltas de una ventana en **un único snapshot
     final** (`client/src/compact/compact.ts:87`).
   - **Adaptación en Ego:** Ego **no tiene aplicador RFC 6902**:
     `grep -E "jsonpatch|JsonPatch|applyPatch"` sobre `packages/` → **0 coincidencias**. El `CanvasBridge` aplica
     ChangeSets propios con *path punteado* (`packages/ui-runtime/src/CanvasBridge.ts:165`, `:311`) y no con JSON
     Pointer. El patrón a portar es: *snapshot completo + deltas incrementales atómicos + compactación a snapshot
     final*.
   - **Relación con Backlog Ego:** `CANV-03`, `CANV-06`, `KB-05`.

### Bloque C: Capa de coprocesamiento en el borde agente↔UI ###

*Ubicación en fuente:* `sdks/typescript/packages/client/src/middleware/`

1. **Cadena `Middleware` y `runNextWithState`**
   - **Qué hace:** `Middleware` es una clase abstracta con `run(input, next)`; `runNext` normaliza los eventos
     *chunk* a secuencias completas; `runNextWithState` (`client/src/middleware/middleware.ts:40`) mantiene un
     **reducer espejo** que acumula `messages` y `state` y entrega `{ event, messages, state }` **después** de
     aplicar cada evento. El reducer es privado y su `error` handler es deliberadamente vacío para que un fallo de
     contabilidad no tumbe el host (`:56-82`).
   - **Adaptación en Ego:** `grep -E "middleware|Middleware"` sobre `packages/` → **0 coincidencias**: Ego no tiene
     cadena de coprocesamiento en el borde. Existe normalización (`EventNormalizer`) e ingreso no bloqueante
     (`EventIngress`), pero no un punto de composición extensible donde colgar transformaciones (A2UI, coalescencia,
     filtrado de tools) sin tocar el runtime.
   - **Relación con Backlog Ego:** `CANV-03`, `ACT-12`, `SEC-02`.

2. **`FilterToolCallsMiddleware`**
   - **Qué hace:** Filtra `TOOL_CALL_*` por lista permitida/prohibida; el conjunto de IDs bloqueados vive **por
     suscripción** (`defer`, `client/src/middleware/filter-tool-calls.ts:56`) y se reinicia en `RUN_STARTED` (`:64`),
     porque una instancia compartida borraría los IDs de un run interrumpido. **Importante:** filtra la *emisión* de
     eventos, **no** la ejecución de la herramienta (`docs/concepts/middleware.mdx:132`).
   - **Adaptación en Ego:** Descartado como mecanismo de seguridad (ver AGUI-04). El principio reutilizable
     —*el estado de filtrado es por run, no por instancia*— sí aplica a `packages/events/src/EventIngress.ts:47`,
     donde el mapa `pendingInteractions` es por instancia.
   - **Relación con Backlog Ego:** `ACT-06`, `SEC-05`.

### Bloque D: Verificación de invariantes del stream ###

*Ubicación en fuente:* `sdks/typescript/packages/client/src/verify/verify.ts`

1. **`verifyEvents` — verificador de secuencia en el cliente**
   - **Qué hace:** Mantiene el balance *abierto/cerrado* de cada entidad (mensajes de texto, tool calls, spans de
     razonamiento, mensajes de razonamiento, actividades) y un **mapa de propietarios por tipo de entidad**
     (`verify.ts:16-60`). Los pasos se indexan por **(owner, nombre)** en mapas anidados (`:78`) porque un subagente
     puede abrir legítimamente un paso con el mismo nombre que su padre. La propiedad se *retiene* tras el cierre
     para que una continuación posterior pueda contrastarse (`:50-53`).
   - **Adaptación en Ego:** No hay equivalente (`grep` sin resultados en `packages/`). Es directamente aplicable al
     caso de Ego: `SUB-06` (`DelegationRouter`) permite anidamiento de Sub-Egos con profundidad `maxDepth=3`, y
     `ACT-02` (`ToolExecutionLoop`) emite eventos de tool por turno. Un verificador de invariantes de stream
     detectaría cesiones cruzadas entre padre e hijo.
   - **Relación con Backlog Ego:** `ACT-02`, `ACT-12`, `SUB-06`, `SEC-08`.

### Bloque E: Interoperabilidad A2UI ###

*Ubicación en fuente:* `middlewares/a2ui-middleware/src/index.ts`,
`sdks/typescript/packages/a2ui-toolkit/src/`

1. **Validación semántica de catálogo y ciclo de vida de reintento**
   - **Qué hace:** `validateA2UIComponents` (`a2ui-toolkit/src/validate.ts:104`) valida **semánticamente** el árbol
     de componentes contra un catálogo (root, catálogo, `required`, referencias hijas) antes de permitir el pintado;
     las *bindings* se difieren porque el modelo de datos aún no ha llegado (`validate.ts:60`, `:187-188`). El
     recovery loop (`a2ui-toolkit/src/recovery.ts:20`, `MAX_A2UI_ATTEMPTS = 3`; `:111`) reintenta con los errores de
     validación inyectados en el prompt y, si se agota, devuelve un envelope de fallo estructurado. El middleware
     proyecta el ciclo sobre **un `messageId` estable** (`a2ui-surface-<key>`) con
     `status: building | retrying | failed` (`a2ui-middleware/src/index.ts:187`), de modo que el esqueleto se
     **sustituye in situ** y nunca hay dos loaders (`:736-746`). Además, convierte la acción del usuario en mensajes
     sintéticos (`processUserAction`, `:280`) y **cancela las superficies sin respuesta** antes de continuar
     (`recoverUnansweredCalls`, `:972`).
   - **Adaptación en Ego:** `A2UIAdapter.translateSurfaceUpdate` (`packages/ui-runtime/src/A2UIAdapter.ts:22`) valida
     **solo estructura** con `CanvasComponentManifestSchema.safeParse` y, ante fallo, emite una op `fallback`
     (`:36`). No hay validación semántica contra el catálogo ni reintento. El `CanvasComponentRegistry`
     (`packages/ui-runtime/src/ComponentRegistry.ts:55`) ya dispone del `propsSchema` Zod por componente, que es la
     base natural para la validación semántica.
   - **Relación con Backlog Ego:** `CANV-01`, `CANV-02`, `CANV-05`.

---

## 3. Matriz de Extracción vs Descarte ##

| Componente AG-UI | Acción en Ego | Razón Técnica / Arquitectónica |
| --- | :---: | --- |
| `core/src/generated/types.ts` — unión `Event` (31 tipos) | 🚫 **Descartada** | Ego tiene vocabulario canónico cerrado (`packages/events/src/types.ts:5`) y un normalizador que ya traduce eventos externos (`packages/events/src/EventNormalizer.ts:7`). Dos vocabularios = ambigüedad sobre cuál gobierna. |
| `client/src/apply/default.ts:698-760` — snapshot + delta RFC 6902 | **EXTRAER & ADAPTAR** | Patrón ausente en Ego (grep 0 coincidencias de `jsonpatch`/`JsonPatch`) y necesario para el Canvas sin recargar el documento completo en cada mutación. |
| `client/src/compact/compact.ts:87` — compactación a snapshot final | **EXTRAER PATRÓN** | Colapsar una ventana de deltas a un snapshot final es la base de un `state window`; aplicable a `CanvasPersistence` (`CANV-06`). |
| `client/src/middleware/middleware.ts:24` — cadena de coprocesamiento | ⏳ **Futura (Fase 04)** | Vía 2 de `docs/extractions/README.md` §2: es una capa arquitectónica **nueva**, no una mejora de una capacidad ya aprobada. Requiere ficha en `docs/research/` + aprobación del owner. |
| `client/src/middleware/filter-tool-calls.ts:19` | 🚫 **Descartada** | Filtra la emisión, no la ejecución (`docs/concepts/middleware.mdx:132`). En Ego la gobernanza es previo a la ejecución (`ApprovalEngine`, `SEC-05`); un filtro post-hoc es insuficiente y engañoso. |
| `client/src/verify/verify.ts:7` — `verifyEvents` | **EXTRAER & ADAPTAR** | Invariantes de stream open/close + propiedad por entidad; aplicable al anidamiento de Sub-Egos (`SUB-06`) y al bucle de tools (`ACT-02`). |
| `client/src/interrupts/index.ts:22` — `buildResumeArray` | 🚫 **Descartada** | Ego ya tiene HITL canónico con `ActionIdentity` inmutable y auditoría `gov/audit` (`ACT-06`, `SEC-06`). El modelo AG-UI colapsa la aprobación dentro del stream, diluyendo la granularidad. |
| `client/src/agent/agent.ts` + `client/src/apply/default.ts` — reducer de mensajes/estado | **EXTRAER PATRÓN** | El reductor espejo (`runNextWithState`) es transferible; la implementación completa no (RxJS + estado en memoria). |
| `core/src/generated/types.ts:2948` — `AgentCapabilities` | 🚫 **Descartada** | Sustituido por `SubEgoManifest` (`packages/subegos/src/SubEgoManifest.ts`, `SUB-01`), que ya declara capacidades, permisos, `memoryScope` y autonomía con esquema Zod. |
| `middlewares/a2ui-middleware/src/index.ts` — validación semántica + recovery | **EXTRAER & ADAPTAR** | El adaptador A2UI de Ego valida solo estructura; pintar un árbol no validado contra el catálogo es un defecto de robustez. |
| `middlewares/event-throttle-middleware/src/index.ts:35` — allowlist bufferizable | **EXTRAER PATRÓN** | La *allowlist* (todo evento no listado pasa de inmediato) es el modo de fallo seguro correcto para eventos de frontera. Ego ya tiene coalescencia de terminal (`HELM-01`), no de eventos de chat. |
| `middlewares/mcp-middleware/`, `mcp-apps-middleware/`, `a2a-middleware/` | 🚫 **Descartada** | Ego ya es MCP Client + MCP Server (`AGENTS.md` §7) y su `Integration Layer` no puede requerir adaptadores externos específicos. |
| `integrations/*` (23 frameworks: LangGraph, CrewAI, ADK, Mastra…) | 🚫 **Descartada** | Contaminación de dominio ajena a un SOC: son frameworks de agentes completos, no patrones. El Runtime de Ego nunca contiene lógica de servicio. |
| `sdks/python`, `sdks/dotnet`, `sdks/rust`, `sdks/java`, `sdks/dart`, `sdks/community/kotlin` | 🚫 **Descartada** | El stack de Ego es TypeScript + React 19 + Node 22 (`AGENTS.md` §1). |
| `docs/drafts/meta-events.mdx:185` — `share` / meta-events | 🚫 **Descartada** | Borrador normativo **no implementado** (sin `src/` correspondiente) y funcionalidad de colaboración multiusuario, fuera del alcance de un SOC desktop *local-first* de un solo usuario. |
| `apps/dojo`, `apps/client-cli-example` | 🚫 **Descartada** | Demos y harness de conformance; no aportan patrón transferible al runtime de Ego. |

---

## 4. Estado real verificado (2026-10-20) ##

> **Alcance de la verificación:** repositorio de referencia **nuevo**. Ningún patrón de AG-UI ha sido asimilado
> todavía en `packages/` ni `apps/desktop/`. Se ejecutó grep sobre `packages/` + `apps/desktop/` (excluyendo
> `test/`, `dist/`, `node_modules/`) antes de clasificar cada fila. Cero filas pueden ostentar `✅ Completada`.

| ID | Patrón | Estado | Evidencia / Fundamento |
| --- | --- | :---: | --- |
| `AGUI-01` | Unión de eventos del protocolo (`Event`, `BaseEvent`) como vocabulario canónico | 🚫 **Descartada (con justificación)** | Ego ya tiene `EgoEventType` cerrado + `CanonicalEventPayloadMap` (`packages/events/src/types.ts:5`, `:100`) y `EventBus` (`packages/events/src/EventBus.ts:81`). El `EventNormalizer` (`packages/events/src/EventNormalizer.ts:7`, `:35`) cumple el rol de traducción de eventos externos al vocabulario canónico — exactamente la función del borde AG-UI. Adoptar la unión AG-UI crearía un **segundo vocabulario canónico** y una frontera ambigua entre «evento de Ego» y «evento AG-UI». AG-UI queda clasificado como **protocolo de interoperabilidad externa (Nivel C)**, no como arquitectura interna. |
| `AGUI-02` | Estado compartido: `STATE_SNAPSHOT` + deltas RFC 6902 (JSON Patch) | 🆕 **Pendiente** | No existe aplicador RFC 6902 en Ego: `grep -E "jsonpatch\|JsonPatch\|applyPatch"` sobre `packages/` → **0 coincidencias**. El `CanvasBridge` usa path punteado propio (`packages/ui-runtime/src/CanvasBridge.ts:165`, `:311`). **Cableado exacto:** crear `packages/ui-runtime/src/JsonPatchApplier.ts` (operaciones `add/remove/replace/move/copy/test` sobre JSON Pointer, aplicación atómica sin mutar el original) y `packages/ui-runtime/src/StateDeltaApplier.ts` (snapshot + deltas + compactación a snapshot final), y conectarlos al canal de mutación del Canvas. **Responsable:** owner de `packages/ui-runtime/**` (A4). Fases 04 (`CANV-03`, `CANV-06`) y 06 (`KB-05`). |
| `AGUI-03` | Cadena de coprocesamiento en el borde agente↔UI (`Middleware.run(input, next)`, `runNextWithState`) | ⏳ **Futura (Fase 04)** | `grep -E "middleware\|Middleware"` sobre `packages/` → **0 coincidencias**. Existe normalización (`packages/events/src/EventNormalizer.ts`) e ingreso no bloqueante (`packages/events/src/EventIngress.ts:45`), pero no un punto de composición extensible. **Motivo del diferimiento:** es una **capa arquitectónica nueva**, no una mejora de una capacidad ya aprobada; por `docs/extractions/README.md` §2 (Vía 2) exige ficha en `docs/research/` y aprobación explícita del owner antes de codificar. **Fase destino:** 04 (`CANV-03`), extensible a `SEC-02` en Fase 11. El reductor espejo (`client/src/middleware/middleware.ts:40`) sí es asimilable dentro de esa fase. |
| `AGUI-04` | Contexto de herramientas definido por el cliente (`RunAgentInput.tools`, `Context[]`) | 🚫 **Descartada (con justificación)** | `types.ts:1508` (`Tool`), `:1536` (`Context`), `:1578` (`RunAgentInput` con `tools`/`context`); la propia spec lo restringe: *«`RunAgentInput.tools` es solo para las tools del cliente, no todas las del backend»* (`docs/concepts/tools.mdx:101-105`). En Ego el catálogo de tools vive **en main**, con clasificación de riesgo y exportación a JSON Schema (`packages/tools/src/ToolRegistry.ts:23`, `:207-214`, `ACT-01`), y el renderer solo lo consulta (`apps/desktop/src/preload.ts:320`, `ipc.mcp.listTools`). Exponer el schema de tools desde el renderer hacia el modelo abriría una **segunda ruta de catálogo** que esquivaría el `ApprovalEngine` (`ACT-06`) y la matriz de permisos (`SEC-05`), violando el principio 6. |
| `AGUI-05` | Verificador de invariantes de stream en el cliente (`verifyEvents`) | 🆕 **Pendiente** | No existe equivalente en Ego (grep sin resultados). **Cableado exacto:** crear `packages/events/src/EventSequenceVerifier.ts` con el balance abierto/cerrado por tipo de entidad y el **mapa de propietarios por entidad** (patrón `client/src/verify/verify.ts:16-60`), indexando los pasos por **(owner, nombre)** en mapas anidados (`:78`) para no colisionar padre/hijo en la delegación `SUB-06`; invocarlo en `packages/runtime/src/ToolExecutionLoop.ts` antes de emitir al bus y en `packages/events/src/EventIngress.ts` para eventos entrantes. **Responsable:** owner de `packages/events/**` (A2) + `packages/runtime/**` (A3). Fases 02 (`ACT-02`, `ACT-12`), 03 (`SUB-06`) y 11 (`SEC-08`). |
| `AGUI-06` | Protocolo de interrupción HITL con reanudación (`Interrupt`, `RUN_FINISHED(interrupt)`, `ResumeEntry`) | 🚫 **Descartada (con justificación)** | `types.ts:1718` (`Interrupt`), `:1550` (`ResumeEntry`), `:1773` (`RunFinishedInterruptOutcome`); `client/src/interrupts/index.ts:22` (`buildResumeArray`, que **lanza** ante respuestas ausentes o IDs desconocidos, `:31`, `:36`) y `:13` (`isInterruptExpired`). Ego ya resuelve HITL de forma más estricta: `ApprovalEngine` con `ActionIdentity` inmutable (`packages/execution/src/ApprovalEngine.ts`, `ACT-06`), `InteractionTransport` que **nunca rechaza** y resuelve `false` ante timeout (`packages/events/src/InteractionTransport.ts:75`), `approval.required`/`approval.resolved` con `timeoutMs` (`packages/events/src/types.ts:121`) y auditoría inmutable en `gov/audit` (`SEC-06`). Modelar la aprobación como un evento más del stream diluiría la granularidad de `ActionIdentity` y permitiría reanudar un run sin la identidad de acción que la auditoría exige. |
| `AGUI-07` | Middleware A2UI: validación semántica contra catálogo + ciclo de vida `building→retrying→failed` | 🆕 **Pendiente** | `middlewares/a2ui-middleware/src/index.ts:138` (clase), `:187` (lifecycle sobre `messageId` estable), `:249` (inyección del esquema como contexto), `:280` (acción de usuario → mensajes sintéticos), `:404` (procesado de stream), `:736` (snapshot acumulativo con `replace`), `:972` (cancelación de superficies sin respuesta); `sdks/typescript/packages/a2ui-toolkit/src/validate.ts:104` (`validateA2UIComponents`) y `recovery.ts:20` (`MAX_A2UI_ATTEMPTS = 3`). Ego valida **solo estructura**: `packages/ui-runtime/src/A2UIAdapter.ts:30-37` usa `safeParse` y emite op `fallback`. **Cableado exacto:** en `packages/ui-runtime/src/A2UIAdapter.ts`, validar el árbol semánticamente contra `CanvasComponentRegistry` (`packages/ui-runtime/src/ComponentRegistry.ts:55`, `propsSchema` por componente) **antes** de emitir la op `inject`; mapear el ciclo a los eventos del `CanvasBridge` (`packages/ui-runtime/src/CanvasBridge.ts:42` `canvas.inject`, `:222` `canvas.mutation` con `replace`) y acotar el reintento a 3 intentos. **Responsable:** owner de `packages/ui-runtime/**` (A4). Fase 04 (`CANV-01`, `CANV-02`, `CANV-05`). |
| `AGUI-08` | Declaración de capacidades del agente (`AgentCapabilities`, `HumanInTheLoopCapabilities`) | 🚫 **Descartada (con justificación)** | `types.ts:2948` (`AgentCapabilities`, 10 categorías: identity, transport, tools, output, state, multiAgent, reasoning, multimodal, execution, humanInTheLoop) y `:2908` (`HumanInTheLoopCapabilities` con `approvals`, `interventions`, `interrupts`). Ego ya tiene el descriptor canónico del Sub-Ego: `SubEgoManifest` (`packages/subegos/src/SubEgoManifest.ts`, `SUB-01`) declara `capabilities`, `tools`, `permissions`, `memoryScope`, `behavior` y `autonomy` con esquema Zod, y el catálogo lo expone en `packages/subegos/src/SubEgoRegistry.ts` (`SUB-07`). Mantener `AgentCapabilities` sería un **segundo descriptor de capacidades** con semántica solapada y no canónica. |

**Recuento:** 0 `✅ Completada` · 4 `🚫 Descartada` · 3 `🆕 Pendiente` · 1 `⏳ Futura` — **8 tareas**.

---

## 5. Descarte normalizado a la forma canónica (2026-10-20) ##

Las filas de la matriz §3 se normalizan aquí a `🚫 Descartada (con justificación)` (AGENTS.md §4), conservando el
motivo original:

| Componente AG-UI | Veredicto | Fundamento |
| --- | :---: | --- |
| Unión `Event` del protocolo (31 tipos) | 🚫 **Descartada (con justificación)** | Ego tiene vocabulario canónico cerrado (`packages/events/src/types.ts:5`) y normalizador de eventos externos (`packages/events/src/EventNormalizer.ts:35`). AG-UI queda como protocolo de interop Nivel C, no como fuente de verdad interna. |
| `FilterToolCallsMiddleware` | 🚫 **Descartada (con justificación)** | Filtra la emisión de eventos, no la ejecución (`docs/concepts/middleware.mdx:132`). La gobernanza de Ego es **previo** a la ejecución (`ApprovalEngine` `ACT-06`, `SEC-05`); filtrar post-hoc es insuficiente y da falsa confianza. |
| `buildResumeArray` / protocolo de `Interrupt` | 🚫 **Descartada (con justificación)** | Sustituido por `ApprovalEngine` + `InteractionTransport` (`packages/events/src/InteractionTransport.ts:75`) con `ActionIdentity` inmutable y auditoría `gov/audit` (`SEC-06`). |
| `AgentCapabilities` / `HumanInTheLoopCapabilities` | 🚫 **Descartada (con justificación)** | Sustituido por `SubEgoManifest` (`packages/subegos/src/SubEgoManifest.ts`, `SUB-01`), que ya declara capacidades, permisos y autonomía con esquema Zod. |
| `RunAgentInput.tools` / `Context[]` (contexto de herramientas cliente) | 🚫 **Descartada (con justificación)** | El catálogo de tools vive en main (`packages/tools/src/ToolRegistry.ts:23`); abrir una segunda ruta desde el renderer saltaría `ApprovalEngine` y `SEC-05` (principio 6). |
| 23 integraciones de frameworks (`integrations/*`) | 🚫 **Descartada (con justificación)** | Contaminación de dominio ajena a un SOC y violación de `AGENTS.md` §7: el Cognitive Runtime nunca contiene lógica específica de framework. |
| SDKs no-TypeScript (Python, .NET, Rust, Java, Dart, Kotlin) | 🚫 **Descartada (con justificación)** | El stack de Ego es TypeScript + React 19 + Node 22 en main (`AGENTS.md` §1); Python queda confinado a sidecar opcional de ingesta (`KB-02`). |
| Extensión `share` / meta-events (`docs/drafts/meta-events.mdx:185`) | 🚫 **Descartada (con justificación)** | Borrador normativo **no implementado** (sin código en el repo) y función de colaboración multiusuario, fuera del alcance de un SOC desktop local-first de usuario único. |
| Middlewares `mcp-*`, `a2a-middleware` | 🚫 **Descartada (con justificación)** | Ego ya es MCP Client + MCP Server (`AGENTS.md` §7); los adaptadores específicos de servidor irían en `packages/integrations/`, no en el borde de eventos. |
| `apps/dojo`, `apps/client-cli-example` | 🚫 **Descartada (con justificación)** | Demos y harness de conformance; no aportan patrón transferible al runtime. |
| Transporte HTTP/SSE/WebSocket/protobuf | 🚫 **Descartada (con justificación)** | En desktop el borde es IPC tipado con `contextIsolation=true` (`CORE-02`). Solo admisible en Ego Web, donde el borde sí es red; no aplica a P0 del desktop. |
| Dependencia RxJS en el núcleo | 🚫 **Descartada (con justificación)** | El `EventBus` canónico despacha con `queueMicrotask` (`packages/events/src/EventBus.ts:160`) y el IPC Electron es síncrono/`Promise`. RxJS es una dependencia de framework nueva sin motivo concreto registrado en `docs/design/design-system.md` (§D3: primitives de librería). |
