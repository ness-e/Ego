# Extracción Técnica: Crush (repos-referencia/crush) #

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de patrones |
| Repositorio Origen | `repos-referencia/crush/` (upstream `charmbracelet/crush`, commit `8fa35a0`, origen `internal/lsp/manager.go`) |
| Licencia del origen | MIT — charmbracelet/crush |
| Commit verificado | 8fa35a0 |
| Ruta de origen | `internal/agent/tools/diagnostics.go` |
| Stack del Origen | Go + Bubble Tea v2 / Lipgloss v2 / glamour v2 (TUI de terminal) + SQLite vía sqlc + `charm.land/fantasy` (abstracción multi-proveedor LLM) + `github.com/charmbracelet/x/powernap` (cliente LSP) |
| Rol en Ego | Referencia de **ingeniería de código**: LSP como fuente de contexto, permisos por comando, hooks con pre-aprobación, sesión con puntero de resumen y bus de eventos con dos políticas de entrega |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Licencia | **FSL-1.1-MIT (Functional Source License)** — **no** es MIT puro; ver §1.3 y §5 |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia ##

`crush` es un **agente de código de terminal** escrito en Go por Charm. No es un gemelo de stack de Ego: no hay
Electron, ni React, ni VantaDB, ni IPC. Su valor para Ego está casi exclusivamente en la **ingeniería de la conexión
entre modelo y código**: cómo se convierte un servidor de lenguaje en *contexto para el modelo*, cómo se gobierna la
acción antes de ejecutarla, cómo se persiste una sesión que se hace demasiado larga, y cómo se distribuyen eventos
sin bloquear al emisor.

Lo **no** transferible es la superficie: TUI de terminal, catálogo remoto de proveedores, créditos de un proveedor
comercial, telemetría a servidor de terceros y configuración ejecutable en bash. Eso se descarta con fundamento en §5.

### 1.1 Qué resuelve análogamente a Ego ###

| Capacidad Crush | Módulo canónico en Crush | Contraparte en Ego |
| --- | --- | --- |
| Código como contexto: símbolos con lenguaje y lint/typecheck en la salida de la tool | `internal/lsp/` + `internal/agent/tools/lsp_*.go` + `internal/agent/tools/diagnostics.go` | **Ausente**: grep `lsp\|definition\|diagnostic` sobre `packages/` y `apps/desktop/` → 0 coincidencias relevantes; sólo existe el canal de error de tool (`packages/runtime/src/ErrorHandler.ts`) |
| Permitir/denegar por comando con memoria de la decisión | `internal/permission/permission.go` | `packages/security/src/ToolPermissions.ts` (matriz fail-closed) — no hay allowlist por `tool:action` |
| Pre-aprobación por hook ligada a una llamada concreta | `internal/agent/hooked_tool.go` + `internal/hooks/` | `packages/events/src/EventBus.ts:368-383` — sólo puede **bloquear**, no aprobar ni reescribir |
| Sesión que sobrevive a un contexto desbordado | `internal/session/session.go` + `internal/agent/agent.go:1370-1518` | `packages/runtime/src/ContextCompaction.ts` (compacta, no reanuda desde un resumen persistido) |
| Bus de eventos sin bloquear al emisor | `internal/pubsub/broker.go` | `packages/events/src/EventBus.ts:81-120` — sin distinción de entrega terminal vs. streaming |

### 1.2 Divergencias Fundamentales ###

| Dimensión | Crush | Ego (Cognitive OS) | Decisión Crítica |
| --- | --- | --- | --- |
| **Superficie** | TUI de terminal (Bubble Tea v2, Lipgloss v2, glamour v2) | Electron 33 + React 19 + Chromium | **DESCARTAR TUI**. El modelo Elm (`tea.Msg`/`tea.Cmd`) no tiene equivalente en el renderer de Ego; las primitives son React + `@ego/ui-runtime` + Radix (D3). |
| **Persistencia** | SQLite con sqlc (`internal/db/`) | VantaDB 0.8.0 in-process (`NativeVantaDB`) + Fjall LSM | **DESCARTAR SQLite**. Se extraen los *patrones* de sesión y resumen, no el sustrato. |
| **Lenguaje** | Go 1.27 (`go.mod:3`), `CGO_ENABLED=0` | TypeScript strict (Node 22 Main, React 19 Renderer) | Reimplementar en TS. Nada de Go en el runtime de Ego. |
| **Configuración** | `crushrc`: script bash ejecutado para cargar config (`internal/shellconfig/load.go:33`) | `SafeConfigMutation` (`packages/execution/src/SafeConfigMutation.ts`) sobre VantaDB | **DESCARTAR `crushrc`**: ejecutar bash en el arranque para obtener configuración es una superficie de ejecución en el proceso Main, incompatible con el guardrail de sandbox de `SEC-01`. |
| **Proveedores LLM** | `charm.land/fantasy` + catálogo remoto `catwalk` + créditos Hyper | `packages/models/src/ModelRouter.ts` + BYOK con `CredentialManager` | **DESCARTAR el catálogo remoto**: una llamada de red a un servicio de terceros para descubrir modelos contradice el principio 9 (local-first). |
| **Telemetría** | PostHog (`internal/event/event.go:13`) | `gov/audit` local + `packages/events/src/EventBus.ts` | **DESCARTAR PostHog**: envío de eventos a un servidor externo choca con `SEC-04` (zero secrets in storage) y con la soberanía de datos del usuario. |

### 1.3 Nota de licencia (restricción vinculante) ###

Crush se distribuye bajo **FSL-1.1** (`LICENSE.md:1-5`), que concede licencia bajo MIT **a partir del segundo
aniversario** de cada versión (`LICENSE.md:87-92`) y prohíbe el *Competing Use*: poner el software a disposición de
terceros en un producto o servicio comercial que lo sustituya u ofrezca funcionalidad sustancialmente similar
(`LICENSE.md:32-41`). Ego tiene un Dominio Engineering (`DOM-01`) con Sub-Ego Dev y herramientas de código, es decir,
solapa funcionalmente con el valor de Crush. **Conclusión operativa: de Crush sólo se extraen patrones de diseño
(ideas, contratos, algoritmos descritos en prosa); no se deriva código, ni se copian fragmentos, ni se adapta línea a
línea.** Cualquier coder derivado exigiría revisión legal del owner y cabecera de licencia propia (FSL-1.1, no el
`Adapted from … (MIT)` de `docs/extractions/README.md` §4.3).

## 2. Inventario Quirúrgico de Patrones a Extraer ##

### Bloque A: LSP como fuente de contexto para el modelo ###

1. **Cliente LSP con arranque bajo demanda y estado por servidor**
   - *Ubicación:* `repos-referencia/crush/internal/lsp/manager.go:102-119` (`Start` sólo lanza el servidor que
     declara manejar el tipo de archivo del path); `internal/lsp/manager.go:123-151` (`skipAutoStartCommands`:
     binarios demasiado genéricos —`node`, `python`, `ruff`…— nunca se auto-arrancan);
     `internal/lsp/client.go:303-326` (`ServerState`: `Unstarted|Starting|Ready|Error|Stopped|Disabled`).
   - *Qué hace:* no levanta un LSP global al arrancar; lo despierta por primera necesidad, filtra por tipo de
     archivo y por *root markers* (`internal/lsp/manager.go:356-375`), y expone un estado por servidor para que la
     UI pueda mostrarlo.
   - *Adaptación en Ego:* un `LspManager` en `packages/tools/src/` (Main process) con arranque bajo demanda por
     tipo de archivo y un estado por servidor; el estado se publica como `EgoEvent` para el Canvas.
   - *Relación con Backlog Ego:* `DOM-01`, `ACT-04`.

2. **Resolución de símbolos validada por el servidor (grep + LSP)**
   - *Ubicación:* `internal/agent/tools/lsp_helpers.go:52-91` (grep con límites de palabra → candidatas →
     `findLSPClient` → se queda con las que el LSP acepta) y `internal/agent/tools/lsp_helpers.go:28-46`
     (`resolveSymbol` prueba candidatos hasta que `Definition` no devuelve "no identifier found", lo que descarta
     coincidencias en comentarios y cadenas).
   - *Qué hace:* no confía en `grep` para localizar un símbolo: usa el grep sólo como *candidato* y el LSP como
     *árbitro*. Es el patrón que hace fiable un `go-to-definition` sin depender del parser del modelo.
   - *Adaptación en Ego:* tool `lsp_definition` (y `lsp_symbols`, `lsp_references`, `lsp_call_hierarchy`) en el
     Tool Registry, con el mismo arbitraje.
   - *Relación con Backlog Ego:* `DOM-01`, `ACT-04`.

3. **Diagnósticos como salida obligatoria de la herramienta de edición**
   - *Ubicación:* `internal/agent/tools/edit.go:96-99`, `internal/agent/tools/write.go:160-164`,
     `internal/agent/tools/multiedit.go:104-108` (todas: `notifyLSPs(...)` y luego
     `text += getDiagnostics(...)`); `internal/agent/tools/view.go:247-257` (lectura: `openInLSPs` +
     `waitForLSPDiagnostics(300ms)`); `internal/agent/tools/diagnostics.go:130-178` (formato con
     `<file_diagnostics>` / `<project_diagnostics>` y un `<diagnostic_summary>` de conteo).
   - *Qué hace:* cada edición cierra con el estado de lint/typecheck del fichero recién tocado, embebido en la
     **misma respuesta de la herramienta**. El modelo no tiene que pedir los diagnósticos: le llegan.
     `internal/agent/templates/coder.md.tpl:383-389` cierra el contrato en el system prompt ("Fix issues in files
     you changed / Ignore issues in files you didn't touch").
   - *Adaptación en Ego:* `packages/runtime/src/ToolExecutionLoop.ts` inyecta, tras toda tool de escritura, un
     bloque `<diagnostics>` con los errores del fichero tocado, y `packages/runtime/src/ErrorHandler.ts`
     reutiliza ese canal para la autocorrección guiada.
   - *Relación con Backlog Ego:* `ACT-08`, `ACT-04`, `DOM-01`.

### Bloque B: Gobernanza de la acción (permisos y hooks) ###

1. **Allowlist por par `herramienta:acción` y decisión persistente por clave compuesta**
   - *Ubicación:* `internal/permission/permission.go:193-196` (`allowedTools` acepta `"tool:action"` o `"tool"`);
     `internal/permission/permission.go:93-99` (`PermissionKey{SessionID, ToolName, Action, Path}`);
     `internal/permission/permission.go:165-178` (`GrantPersistent` sólo registra el permiso si gana la carrera de
     resolución); `internal/permission/permission.go:258-270` (una decisión previa para esa clave se reutiliza sin
     volver a preguntar).
   - *Qué hace:* tres niveles de automatización — allowlist global, decisión recordada por
     sesión+herramienta+acción+ruta, y prompt interactivo — con un detalle de concurrencia correcto: sólo el
     ganador de la carrera escribe el permiso, de modo que un `GrantPersistent` que pierde contra un `Deny` no
     deja una auto-aprobación zombi.
   - *Adaptación en Ego:* extender `packages/security/src/ToolPermissions.ts` con una allowlist por `tool:action`
     y un registro de aprobaciones por sesión, detrás del `ApprovalEngine`
     (`packages/execution/src/ApprovalEngine.ts`).
   - *Relación con Backlog Ego:* `SEC-05`, `ACT-06`, `SEC-06`.

2. **Pre-aprobación por hook ligada al identificador de la llamada**
   - *Ubicación:* `internal/agent/hooked_tool.go:54-100` (el hook corre **antes** del permiso;
     `decision=allow` → `ctx = permission.WithHookApproval(ctx, call.ID)`);
     `internal/permission/permission.go:16-36` (la pre-aprobación es por `toolCallID`, nunca un bypass global: si
     el ID no coincide, no aplica); `internal/hooks/hooks.go:88-158` (agregación: *deny* gana sobre *allow*, *halt*
     es pegajoso, los parches `updated_input` hacen shallow-merge en orden de configuración).
   - *Qué hace:* un hook del usuario puede (a) bloquear una llamada, (b) **pre-aprobar** exactamente esa llamada,
     (c) **reescribir sus parámetros** y (d) **detener el turno entero** (`halt`), que es distinto de denegar una
     llamada.
   - *Adaptación en Ego:* extender `HookDecision` (`packages/events/src/types.ts:212`) con `decision:
     allow|deny|none` y `rewriteInput`, ligado al `toolCallID`; el `evaluatePreToolUse` de
     `packages/events/src/EventBus.ts:368-383` hoy sólo devuelve `allow:false`.
   - *Relación con Backlog Ego:* `SEC-05`, `ACT-06`, `ACT-01`.

### Bloque C: Sesión, resumen y continuidad ###

1. **Sesión con puntero de resumen (`SummaryMessageID`) y reanudación desde el resumen**
   - *Ubicación:* `internal/session/session.go:51-65` (campo `SummaryMessageID` en la entidad `Session`);
     `internal/session/session.go:197-231` (`Save` persiste ese puntero);
     `internal/message/message.go:527-551` (`ListFromSummary`: si el puntero está vacío devuelve la sesión entera;
     si el mensaje de resumen ya no existe, cae de vuelta a la sesión completa en vez de devolver vacío);
     `internal/agent/agent.go:1718-1732` (el prompt se reconstruye desde el resumen hacia adelante).
   - *Qué hace:* el resumen **no borra** el historial: lo *marca*. La sesión conserva un puntero al último resumen
     y la reanudación reconstruye el contexto desde ese punto. El transcript completo sigue siendo recuperable.
   - *Adaptación en Ego:* `packages/memory/EgoMemoryAdapter.ts` (namespace `session/<id>`) con un campo
     `summaryMessageId` por sesión y una lectura `listFromSummary`; en conexión con
     `packages/memory/SessionFork.ts` y `SessionTimelineRewind.ts` (que hoy no tienen caller en producción, ver
     `docs/review/backlog-hermes.md` `HERM-14`).
   - *Relación con Backlog Ego:* `CORE-07`, `REC-01`, `KB-08`.

2. **Auto-resumen por umbral de ventana + prompt de traspaso**
   - *Ubicación:* `internal/agent/agent.go:1103-1128` (condición de parada:
     `remaining = contextWindow − tokens`; umbral = buffer fijo para ventanas grandes o `cw × ratio` para
     pequeñas; **si la ventana es desconocida (`cw == 0`) no se resume**, para no truncar modelos locales);
     `internal/agent/agent.go:1223-1238` (si el turno se cortó con trabajo pendiente, se reencola la continuación
     con el prompt original: *"The previous session was interrupted because it got too long…"*);
     `internal/agent/templates/summary.md:1-48` (prompt de traspaso con secciones obligatorias: Current State,
     Files & Changes, Technical Context, Strategy & Approach, Exact Next Steps; exige `file:line` concretos).
   - *Qué hace:* dos piezas que se refuerzan: **cuándo** resumir (en tokens restantes reales de la ventana del
     modelo, no en un ratio genérico) y **cómo** (un documento de traspaso para un compañero, no un calco del
     diálogo).
   - *Adaptación en Ego:* `packages/runtime/src/ContextCompaction.ts` ya comprime por ratio
     (`compressionThreshold 0.5`) y por techo (`autoCompactTokens 200000`) y ya tiene un prompt de conservación
     estructurado (`:105-118`); falta (a) la expresión en tokens restantes de la ventana real del modelo, (b)
     reencolar la continuación, (c) las secciones de traspaso con `file:line`.
   - *Relación con Backlog Ego:* `CORE-12`, `CORE-06`, `CORE-11`.

### Bloque D: Ritmo de ejecución ###

1. **Bus de eventos con dos políticas de entrega**
   - *Ubicación:* `internal/pubsub/broker.go:1-23` (contrato de entrega),
     `internal/pubsub/broker.go:34-46` (buffer por suscriptor = 4096; timeout must-deliver = 50 ms),
     `internal/pubsub/broker.go:159-188` (`Publish`: no bloqueante, **pierde** el evento si el suscriptor va
     lento, y cuenta la pérdida), `internal/pubsub/broker.go:190-236` (`PublishMustDeliver`: envío bloqueante
     acotado por suscriptor para eventos terminales que no deben perderse).
   - *Qué hace:* distingue explícitamente el evento de alta frecuencia (delta de token: perderlo está bien) del
     evento terminal (fin de turno, resultado de tool, error, cancelación: debe llegar). Y hace observable la
     saturación con contadores.
   - *Adaptación en Ego:* `packages/events/src/EventBus.ts` (hoy `emit` es asíncrono no bloqueante, con historial
     de 100 eventos, sin política terminal) → añadir `emitCritical` con timeout acotado y contadores de drop
     expuestos en `DS-05` (consola de métricas).
   - *Relación con Backlog Ego:* `ACT-05`, `ACT-12`, `DS-05`.

2. **Detección de bucles por firma de interacción**
   - *Ubicación:* `internal/agent/loop_detection.go:11-14` (ventana 10 pasos, máximo 5 repeticiones),
     `internal/agent/loop_detection.go:45-71` (firma = SHA-256 de `toolName + input + output` de cada par
     llamada/resultado).
   - *Qué hace:* no se limita a contar pasos: detecta que el modelo está **repitiendo la misma interacción** (misma
     tool, mismos argumentos, mismo resultado) y corta el bucle mucho antes de agotar el presupuesto.
   - *Adaptación en Ego:* `packages/runtime/src/ToolExecutionLoop.ts` corta hoy por conteo (`maxSteps`, `:262,306`)
     y `packages/decision/src/LoopBreaker.ts` corta por profundidad de delegación; falta la detección semántica por
     firma.
   - *Relación con Backlog Ego:* `DEC-06`, `ACT-02`.

## 3. Matriz de Extracción vs Descarte ##

| Componente Crush | Acción (en Ego) | Razón Técnica |
| --- | --- | --- |
| `internal/lsp/` + `internal/agent/tools/lsp_*.go` (el cliente Go `powernap` no se adopta) | **EXTRAER PATRÓN** | Reimplementar en TypeScript un cliente LSP (protocolo JSON-RPC) para el Dominio Engineering. Es la mayor oportunidad: da al Sub-Ego Dev resolución de símbolos fiable sin parsear AST en el modelo. No se añade un binario Go al build de Ego (TypeScript + `.node` de Rust). |
| `internal/agent/tools/diagnostics.go` + el pegado de diagnostics en edit/write/multiedit/view | **EXTRAER PATRÓN** | Convierte lint/typecheck en evidencia dentro del turno, no en una consulta aparte. Complementa `ACT-08` con señal de calidad estática. |
| `internal/permission/permission.go` (allowlist `tool:action` + `PermissionKey`) | **EXTRAER PATRÓN** | Ego tiene la matriz fail-closed pero no la granularidad `herramienta:acción:ruta` ni la memoria de la decisión por sesión. Es la pieza que hace operable la gobernanza sin fatigar al usuario. |
| `internal/agent/hooked_tool.go` + `internal/hooks/hooks.go` | **EXTRAER PATRÓN** | Ego tiene hooks que sólo bloquean (`EventBus.ts:368-383`). Falta `allow`, `halt` y la reescritura de input, con la pre-aprobación atada al ID de la llamada. |
| `internal/session/session.go` (`SummaryMessageID`) + `internal/message/message.go:527` | **EXTRAER PATRÓN** | El resumen como *puntero* y no como borrado preserva la auditabilidad y la trazabilidad (`SEC-06`, `KB-08`). |
| `internal/agent/agent.go:1103-1128` + `templates/summary.md` | **EXTRAER PATRÓN** | Umbral en tokens restantes + prompt de traspaso con `file:line`. Mejora `ContextCompaction.ts`, que ya está en producción (`apps/desktop/src/main.ts:1724,1956`). |
| `internal/pubsub/broker.go` | **EXTRAER PATRÓN** | Dos políticas de entrega + contadores de saturación: los eventos terminales de Ego no deben perderse en un buffer lleno del renderer. |
| `internal/agent/loop_detection.go` | **EXTRAER PATRÓN** | Detección semántica de bucle, complementaria al corte por `maxSteps` y a la profundidad de `LoopBreaker`. |
| `internal/ui/**` (Bubble Tea v2, Lipgloss v2, glamour v2, `uv.ScreenBuffer`) | 🚫 **Descartada (con justificación)** | Ego es Electron + React 19. El modelo Elm (`tea.Msg`/`tea.Cmd`, "no hacer IO en `Update`") no tiene traducción directa: sus primitives son componentes React con Radix y `@ego/ui-runtime` (principio D3). |
| `internal/db/**` (SQLite + sqlc + migraciones) | 🚫 **Descartada (con justificación)** | VantaDB 0.8.0 (`NativeVantaDB`) es el sustrato soberano y único de Ego (`AGENTS.md` §4). El patrón de *sesión* se extrae; el motor, no. |
| `internal/shellconfig/**` (`crushrc`: config como script bash) | 🚫 **Descartada (con justificación)** | `LoadShellConfig` ejecuta un script bash para obtener la configuración (`internal/shellconfig/load.go:33`). Ejecutar código en el arranque del proceso Main contradice el aislamiento de `SEC-01` y el guardrail de sandbox. Ego usa `SafeConfigMutation` sobre VantaDB. |
| `internal/config/provider.go` (catálogo remoto), `internal/agent/hyper_credits.go`, `internal/oauth/` (Copilot), `internal/event/` (PostHog) | 🚫 **Descartada (con justificación)** | Dominio comercial y de servicios de un tercero, ajeno al SOC: créditos de proveedor, OAuth de Copilot, catálogo de modelos por red y telemetría a servidor externo. Contradice el principio 9 (local-first) y `SEC-04` (zero secrets in storage). |
| `github.com/charmbracelet/x/powernap` (cliente LSP en Go) | 🚫 **Descartada (con justificación)** | Dependencia externa en Go. Ego implementa su cliente LSP en TypeScript en el Main process; no se añade un binario Go a la distribución (el build de Ego es TypeScript + `.node` de Rust). |
| Derivación directa de código de Crush | 🚫 **Descartada (con justificación)** | Licencia FSL-1.1 con cláusula de *Competing Use* (`LICENSE.md:32-41`) y solapamiento funcional con `DOM-01`. Sólo se extraen patrones descritos en prosa; ningún fichero derivado de código. |

## 4. Estado real verificado (2026-10-20) ##

> Criterio de cierre (`docs/extractions/README.md` §4): `✅ Completada` exige fichero adaptado **y** caller en
> producción verificado por grep sobre `packages/` + `apps/desktop/` (excluyendo `test/`, `dist/`,
> `node_modules/`). Este repositorio de referencia es **nuevo**: no hay ni un solo patrón asimilado todavía, por lo
> que el recuento de `✅ Completada` es 0 y **ninguna fila queda en el limbo**.

| ID | Patrón | Estado | Evidencia / Fundamento |
| --- | :---: | --- | --- |
| `CRSH-01` | LSP como fuente de contexto (arranque bajo demanda, resolución validada, jerarquía de llamadas) | 🆕 Pendiente | Grep `lsp\|LSP\|goToDefinition\|definition` sobre `packages/` y `apps/desktop/` → **0 coincidencias** (único hit: `packages/tasks/src/BackgroundEngine.ts:41`, el mapa `definitions` no tiene relación). **Cableado exacto:** crear `packages/tools/src/lsp/` (cliente + manager) y registrar las tools `lsp_definition`, `lsp_symbols`, `lsp_references`, `lsp_call_hierarchy` en `packages/tools/src/ToolRegistry.ts` (`:36 register`, nativo en `packages/tools/src/native/index.ts`); instanciar el manager en `apps/desktop/src/main.ts` (owner A4). Ningún Sub-Ego puede hoy resolver un símbolo con lenguaje. |
| `CRSH-02` | Diagnósticos como salida de la herramienta de edición (ciclo lint → auto-corrección) | 🆕 Pendiente | No existe bloque de diagnósticos en la respuesta de las tools: grep `diagnostic` en `apps/desktop/` → **0 coincidencias**. Existe el canal de error de tool (`packages/runtime/src/ErrorHandler.ts`) pero sin señal de calidad estática. **Cableado exacto:** en `packages/runtime/src/ToolExecutionLoop.ts`, tras toda tool de escritura, anexar `<diagnostics>` con los errores del fichero tocado e inyectarlo como mensaje de tool; el `SystemPrompt` de los Sub-Egos de `packages/domains/src/engineering/` debe incluir la regla "corrige sólo los ficheros que has tocado" (owner A2/A4, `DOM-01`). |
| `CRSH-03` | Allowlist `herramienta:acción` + decisión recordada por clave compuesta | 🆕 Pendiente | `packages/security/src/ToolPermissions.ts:260-361` decide por categoría/riesgo/path/red/MCP/cron, **sin** allowlist por `tool:action` ni memoria de aprobaciones por sesión (grep `allowedTools\|PermissionKey` → 0). **Cableado exacto:** añadir `allowedToolActions` a `ToolPermissionsOptions` y un registro `sessionId+toolName+action+path` detrás de `packages/execution/src/ApprovalEngine.ts` (`apps/desktop/src/main.ts:2405`), consumible desde `evaluateToolCall` (`main.ts:2515`, `register-ipc.ts:1880`) — owner A2/A5. |
| `CRSH-04` | Pre-aprobación de hook ligada al `toolCallID` + `halt` + reescritura de input | 🆕 Pendiente | `packages/events/src/EventBus.ts:368-383` (`evaluatePreToolUse`) devuelve `allow:false` o `allow:true` y **nunca `allow:true` por decisión de hook**, ni tiene noción de halt ni de reescritura de parámetros (`HookDecision` en `packages/events/src/types.ts:212`). **Cableado exacto:** extender `HookDecision` con `decision: allow\|deny\|none`, `halt` y `rewriteInput`; el gate de `apps/desktop/src/main.ts:2537` debe propagar la pre-aprobación al `ApprovalEngine` **atada al ID de la llamada**, nunca como bypass global (owner A2/A5). |
| `CRSH-05` | Sesión con puntero de resumen (`SummaryMessageID`) y reanudación desde el resumen | 🆕 Pendiente | `packages/runtime/src/ContextCompaction.ts:703-741` archiva el resumen en `kb/history_archive` como registro suelto, **sin** puntero por sesión; `packages/memory/SessionTimelineRewind.ts` y `SessionFork.ts` existen pero `docs/review/backlog-hermes.md` `HERM-14` los marca sin caller en producción. **Cableado exacto:** añadir `summaryMessageId` al manifiesto de sesión en `packages/memory/EgoMemoryAdapter.ts` (namespace `session/<id>`) y una lectura `listFromSummary`; exponerla por `ipc.session.resume` (`apps/desktop/src/ipc/schema.ts`) reutilizando `SessionFork` — owner A2/A3. |
| `CRSH-06` | Auto-resumen por umbral de ventana real + prompt de traspaso con `file:line` | 🆕 Pendiente | `packages/runtime/src/ContextCompaction.ts:25-31` decide por **ratio** (0.5) y por **techo fijo** (200 000 tokens), no por tokens restantes de la ventana del modelo; el prompt de conservación (`:105-118`) exige decisiones/rutas/errores/tareas/restricciones pero **no** tiene las secciones de traspaso ("Files & Changes", "Exact Next Steps" con `file:line`) ni la regla de no resumir si la ventana es desconocida. El motor sí está en producción (`apps/desktop/src/main.ts:1724,1956`), luego es una **mejora** de un módulo existente, no una pieza nueva. **Cableado exacto:** `ContextCompactionSettings` + `evaluateCompactionNeed` en `packages/runtime/src/ContextCompaction.ts`, y `DEFAULT_SUMMARIZER_SYSTEM_PROMPT` — owner A2. |
| `CRSH-07` | Detección de bucles por firma de interacción (SHA-256 tool+input+output) | 🆕 Pendiente | Ego corta por conteo (`packages/runtime/src/ToolExecutionLoop.ts:262,306`, `maxSteps`) y por profundidad de delegación (`packages/decision/src/LoopBreaker.ts`); no hay detección por **firma** (grep `maxSteps\|LoopBreaker` → sin detector de repetición). **Cableado exacto:** añadir el detector en `packages/runtime/src/ToolExecutionLoop.ts` como condición de parada complementaria a `maxSteps`, con ventana 10 / máximo 5 repeticiones, y emitir `EgoEvent` de parada para `DEC-06` — owner A2. |
| `CRSH-08` | Bus de eventos con dos políticas de entrega y contadores de saturación | 🆕 Pendiente | `packages/events/src/EventBus.ts:100-120` emite de forma asíncrona no bloqueante con historial de 100 eventos; **no** distingue evento terminal de evento de streaming ni expone contadores de drop (grep `dropCount\|mustDeliver` → 0). **Cableado exacto:** añadir `emitCritical` con envío acotado (50 ms por suscriptor) y contadores `dropCount`/`mustDeliverDropCount` visibles en `apps/desktop/renderer/components/daily-state/MetricsConsole.tsx` — owner A2. |
| `CRSH-09` | Superficie de terminal, sustrato SQLite y configuración ejecutable en bash | 🚫 **Descartada (con justificación)** | (a) TUI: `internal/ui/**` sobre Bubble Tea v2 / Lipgloss v2 / glamour v2 — Ego es Electron + React 19; el modelo Elm no tiene traducción (D3). (b) SQLite/sqlc (`internal/db/**`): el sustrato canónico es VantaDB `NativeVantaDB` (`AGENTS.md` §4). (c) `crushrc`: `internal/shellconfig/load.go:33` ejecuta bash para obtener la config — superficie de ejecución en el proceso Main, incompatible con `SEC-01`; Ego usa `SafeConfigMutation`. (d) Dominio comercial ajeno: catálogo remoto `catwalk` (`internal/config/provider.go:200`), créditos Hyper, OAuth de Copilot y telemetría PostHog (`internal/event/event.go:13`) contradicen el principio 9 (local-first) y `SEC-04`. (e) `powernap` (Go) no es adoptable: el build de Ego es TypeScript + binarios `.node` de Rust. |

**Recuento:** 0 `✅ Completada` · 1 `🚫 Descartada` · 8 `🆕 Pendiente` · 0 `⏳ Futura` — **9 tareas**.

## 5. Descarte normalizado a la forma canónica ##

| Componente | Veredicto | Fundamento |
| --- | :---: | --- |
| `internal/ui/**` (Bubble Tea v2, Lipgloss v2, glamour v2, `uv.ScreenBuffer`) | 🚫 **Descartada (con justificación)** | Ego es Electron 33 + React 19 + Chromium. La arquitectura Elm (`tea.Msg`, `tea.Cmd`, "no hacer IO en `Update`") no se traduce al renderer de React; sus primitives son componentes React con Radix y `@ego/ui-runtime` (principio D3: usar la primitive de librería, no crear una propia). |
| `internal/db/**` (SQLite + sqlc + migraciones) | 🚫 **Descartada (con justificación)** | VantaDB 0.8.0 (`NativeVantaDB`, napi-rs) es el sustrato soberano y único (principio 1 y `AGENTS.md` §4). Del gestor de sesiones de Crush sólo se extrae el patrón de puntero de resumen (`CRSH-05`), nunca el motor de persistencia. |
| `internal/shellconfig/**` (`crushrc` como script bash) | 🚫 **Descartada (con justificación)** | Cargar la configuración ejecutando bash (`internal/shellconfig/load.go:33`) introduce ejecución arbitraria en el arranque del proceso Main y burla la validación Zod de `SEC-02` y el aislamiento de `SEC-01`. La configuración de Ego es declarativa y versionada (`SafeConfigMutation`). |
| `internal/config/provider.go` (catálogo `catwalk`), `internal/agent/hyper_credits.go`, `internal/oauth/**` (Copilot), `internal/event/**` (PostHog) | 🚫 **Descartada (con justificación)** | Dominio de servicios de un tercero, ajeno al alcance del SOC (`AGENTS.md` §4, contaminación de dominio). La descarga de un catálogo de modelos por red contradice el principio 9 (local-first, propiedad y exportación de datos); la telemetría a PostHog contradice `SEC-04` (cero secretos en almacenamiento) y la soberanía de datos. El `ModelRouter` y el `CredentialManager` de Ego ya cubren esta función con BYOK. |
| `github.com/charmbracelet/x/powernap` (cliente LSP en Go) | 🚫 **Descartada (con justificación)** | Dependencia externa en Go; el build y la distribución de Ego son TypeScript con binarios `.node` de Rust (`DIST-02`, `DIST-03`). El cliente LSP se reimplementa en el Main process de TypeScript (`CRSH-01`). |
| Derivación directa de código de Crush | 🚫 **Descartada (con justificación)** | Licencia **FSL-1.1** con cláusula de *Competing Use* (`LICENSE.md:32-41`) y licencia MIT sólo a partir del segundo aniversario de cada versión (`LICENSE.md:87-92`). Ego solapa funcionalmente con Crush en `DOM-01` (Sub-Ego Dev + herramientas de código), por lo que derivar código sería un *Competing Use*. Sólo se admiten patrones descritos en prosa; eludir la cabecera de atribución propia (`docs/extractions/README.md` §4.3) es imposible porque la licencia no es MIT. |

> Las filas de la matriz §3 que llevan `🚫 Descartada` se normalizan aquí a la forma canónica de `AGENTS.md` §4,
> conservando el fundamento. **Componentes descartados a nivel de matriz: 6** — cuatro de ellos (TUI, SQLite,
> `crushrc` y dominio comercial) quedan agregados en la tarea numerada `CRSH-09`; los otros dos (`powernap` y la
> derivación de código bajo FSL-1.1) se documentan aquí como filas de componente porque no constituyen tarea
> ejecutable. Los seis están en estado `🚫 Descartada (con justificación)`; ninguno queda en el limbo.
