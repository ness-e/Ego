---
kind: review
status: active
description: "Backlog especializado para la revisión, extracción de patrones y adaptación técnica de charmbracelet/crush hacia el monorepo de Ego."
tags: [ego, crush, extraction, review, lsp, permissions, sessions, hooks, electron]
schema: "10-column canonical schema (.agents/references/backlog-format.md compatible)"
---

# Backlog de Revisión y Extracción: Crush (charmbracelet/crush) #

> **Propósito:** Registro canónico y secuencial de auditoría, extracción de patrones y adaptación técnica de
> `repos-referencia/crush` hacia el monorepo de Ego.
>
> **Regla de Operación:** *No copiar código directamente*. Crush es **FSL-1.1** (no MIT) y su cláusula de *Competing
> Use* choca con el Dominio Engineering de Ego: de este repo sólo se extraen **patrones** (contratos, algoritmos
> descritos en prosa), nunca ficheros derivados. Ver `docs/extractions/crush.md` §1.3.
>
> **Esquema:** Tabla canónica de 10 columnas:
>
> `| ID | Severidad | Hallazgo | Archivo Crush | Esfuerzo | Prioridad | Estado |`
>
> `| Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |`

| Campo | Valor |
| --- | --- |
| Estado | Activo — backlog de compuertas abierto, **sin** tareas asimiladas todavía |
| Repositorio Origen | `repos-referencia/crush/` (commit `8fa35a0f10e675aae222fe8626d2d13c2dcb49f5`, rama `main`) |
| Total de Tareas | 9 (`CRSH-01..09`) |
| Fases Impactadas en Ego | 01 (`CORE`), 02 (`ACT`), 05 (`DEC`), 09 (`DOM`), 10 (`REC`), 11 (`SEC`) |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Última verificación | 2026-10-20 — grep sobre `packages/` + `apps/desktop/` (excluyendo `test/`, `dist/`, `node_modules/`) |

## 0. Verificación de estado ##

Cada fila se auditó contra el **código real** de `packages/` y `apps/desktop/`. Criterio de `✅ Completada`: existe
fichero adaptado **y** caller en producción verificado por grep.

| Estado | Significado canónico |
| --- | --- |
| `✅ Completada` | Asimilado, integrado y con **caller en producción verificado**. La celda cita la ruta real. |
| `🚫 Descartada (con justificación)` | El patrón no aplica en Ego, fue sustituido por un módulo canónico, o viola un guardrail. La celda contiene el motivo técnico. |
| `🆕 Pendiente` | Patrón asimilado pero **sin caller en producción**, o pendiente de asimilación inicial. La celda dice el **cableado exacto** y **quién lo ejecuta**. |
| `⏳ Futura (fase)` | Diferido a una fase posterior, con fase destino explícita. |

**Nota de alcance:** `crush` es un repositorio de referencia **nuevo** (clonado el 2026-10-20, profundidad 1).
**Ninguno** de sus patrones ha sido asimilado todavía en `packages/` ni en `apps/desktop/`; por eso el recuento de
`✅ Completada` es **0** y **no hay filas en el limbo**: las 9 tareas cierran en `🆕 Pendiente` (8) o `🚫 Descartada`
(1).

### Recuento de estados (verificado sobre las 9 filas de la tabla §2) ###

| `✅ Completada` | `🚫 Descartada` | `🆕 Pendiente` | `⏳ Futura` | Total |
| --- | --- | --- | --- | --- |
| 0 | 1 | 8 | 0 | **9** |

**Recuento:** 0 `✅ Completada` · 1 `🚫 Descartada` · 8 `🆕 Pendiente` · 0 `⏳ Futura` — **9 tareas**.

#### Búsquedas de verificación ejecutadas (2026-10-20) ####

```text
grep -ri "lsp\|goToDefinition\|definition"  packages/ apps/desktop/
  -> 0 hits relevantes (solo packages/tasks/src/BackgroundEngine.ts:41)
grep -ri "diagnostic"                      apps/desktop/              -> 0 hits
grep -ri "allowedTools\|PermissionKey"     packages/ apps/desktop/    -> 0 hits
grep -ri "dropCount\|mustDeliver"          packages/ apps/desktop/    -> 0 hits
grep -rn "evaluatePreToolUse"              apps/desktop/
  -> preload.ts:271,466 · main.ts:2537 · ipc.ts:95,313 · register-ipc.ts:2153 (solo BLOQUEA)
grep -rn "ContextCompactionJob"            apps/desktop/
  -> main.ts:16,177,1724,1956 (en produccion)
grep -rn "maxSteps\|LoopBreaker"           packages/
  -> ToolExecutionLoop.ts:76,262,306 · LoopBreaker.ts:33 (conteo y profundidad)
```

## 1. Resumen Ejecutivo de Extracción ##

Crush aporta a Ego una sola familia de conocimiento valiosa: **cómo se convierte el código en contexto fiable para el
modelo y cómo se gobierna la acción antes de ejecutarla**. Concretamente, un cliente LSP con arranque bajo demanda
(Ego hoy no tiene ninguno), el bucle "edición → diagnósticos → auto-corrección del modelo", una allowlist de permisos
por `herramienta:acción` con decisión recordada por sesión, hooks que pueden *pre-aprobar* una llamada concreta (Ego
hoy sólo puede bloquearla), una sesión que se reanuda desde un puntero a su último resumen, y un bus de eventos con
dos políticas de entrega.

Todo lo demás —TUI de terminal, SQLite, configuración ejecutable en bash, catálogo remoto de proveedores, créditos de
un proveedor comercial, telemetría a servidor externo y la derivación de código bajo FSL-1.1— queda **descartado con
fundamento**.

### MATRIZ DE DISTRIBUCIÓN POR FASE ###

```text
FASE 01 Core Cognitivo ................................ CRSH-05  CRSH-06
FASE 02 Acción & Tool Calling ......................... CRSH-01  CRSH-02  CRSH-08
FASE 05 Decision Intelligence ......................... CRSH-07
FASE 09 Dominios Funcionales ......................... CRSH-01  CRSH-02
FASE 11 Seguridad & Gobernanza ....................... CRSH-03  CRSH-04
FASE 10 Recovery & Hardening ........................ CRSH-05
DESCARTE (no se ejecuta) ............................. CRSH-09
```

| Estado | Nº | Observación |
| --- | :---: | --- |
| `✅ Completada` | 0 | Repositorio nuevo: nada asimilado todavía. |
| `🚫 Descartada` | 1 | `CRSH-09` agrupa TUI + SQLite + `crushrc` + dominio comercial. |
| `🆕 Pendiente` | 8 | Cableado especificado tarea por tarea. |
| `⏳ Futura` | 0 | Ninguna tarea diferida: todas caben en fases ya abiertas. |
| **TOTAL** | **9** | — |

## 2. Catálogo Detallado de Extracción (10 Columnas Canónicas) ##

| ID | Severidad | Hallazgo | Archivo Crush | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CRSH-01` | 🔴 Crítica | **LSP como fuente de contexto para el modelo** (arranque bajo demanda por tipo de archivo, resolución de símbolos arbitrada por el servidor, jerarquía de llamadas, referencias) | `internal/lsp/manager.go:102-151`, `internal/lsp/client.go:692-769`, `internal/agent/tools/lsp_helpers.go:28-104`, `internal/agent/coordinator.go:911-918` | 🔴 1sem | 🔴 P0 | 🆕 Pendiente | **Verificado ausente en Ego** (grep `lsp\|definition` sobre `packages/` + `apps/desktop/` → 0 hits relevantes). Reimplementar en TypeScript un `LspManager` en `packages/tools/src/lsp/` (Main process): arranque perezoso por tipo de archivo, exclusión de binarios genéricos (`node`, `python`, `ruff`), estado por servidor y 4 tools (`lsp_definition`, `lsp_symbols`, `lsp_references`, `lsp_call_hierarchy`) registradas en `packages/tools/src/ToolRegistry.ts` (`:36`). **Cableado:** instanciar el manager en `apps/desktop/src/main.ts` y exponer su estado como `EgoEvent` para el Canvas. Sin esto, el Sub-Ego Dev de `DOM-01` no puede resolver un símbolo con lenguaje. | Ego: `DOM-01`, `ACT-04` · Extracción: `docs/extractions/crush.md` §2 Bloque A | `CRSH-02` |
| `CRSH-02` | 🔴 Crítica | **Ciclo lint/typecheck → auto-corrección**: los diagnósticos del fichero recién tocado se embeben en la respuesta de la herramienta de edición | `internal/agent/tools/diagnostics.go:130-178`, `internal/agent/tools/edit.go:96-99`, `internal/agent/tools/write.go:160-164`, `internal/agent/tools/multiedit.go:104-108`, `internal/agent/tools/view.go:247-257`, `internal/agent/templates/coder.md.tpl:383-389` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | **Verificado ausente** (grep `diagnostic` en `apps/desktop/` → 0 hits). Hoy Ego sólo tiene el canal de error de tool (`packages/runtime/src/ErrorHandler.ts`), que informa del fallo pero no de la calidad estática del fichero. Tras cualquier tool de escritura, anexar un bloque `<diagnostics>` (errores del fichero tocado + `<diagnostic_summary>` de conteo) al resultado de la tool e inyectarlo como mensaje de tool. El system prompt de los Sub-Egos de `packages/domains/src/engineering/` debe incluir la regla "corrige los errores de los ficheros que has tocado; ignora los demás". **Cableado:** `packages/runtime/src/ToolExecutionLoop.ts` + prompt de `packages/domains/src/engineering/`. | Ego: `ACT-08`, `ACT-04`, `DOM-01` | `CRSH-01` |
| `CRSH-03` | 🟠 Alta | **Allowlist por par `herramienta:acción` y decisión recordada por clave compuesta** (sesión + herramienta + acción + ruta), con la carrera resuelta correctamente | `internal/permission/permission.go:93-99`, `:165-178`, `:193-196`, `:258-270` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | **Verificado ausente**: `packages/security/src/ToolPermissions.ts:260-361` decide por categoría/riesgo/path/red/MCP/cron, sin granularidad `herramienta:acción:ruta` ni memoria de la decisión (grep `allowedTools\|PermissionKey` → 0 hits). Añadir `allowedToolActions` a `ToolPermissionsOptions` y un registro de aprobaciones por clave compuesta detrás del `ApprovalEngine`. Detalle a preservar: **sólo el ganador de la carrera escribe el permiso**, de modo que un `GrantPersistent` que pierde contra un `Deny` no deja una auto-aprobación zombi. **Cableado:** `packages/security/src/ToolPermissions.ts` → `packages/execution/src/ApprovalEngine.ts` (`apps/desktop/src/main.ts:2405`), consumido desde `evaluateToolCall` (`main.ts:2515`, `register-ipc.ts:1880`). | Ego: `SEC-05`, `ACT-06`, `SEC-06` | `CRSH-04` |
| `CRSH-04` | 🟠 Alta | **Pre-aprobación por hook ligada al `toolCallID`**, con `halt` (detener el turno) y reescritura de los parámetros de la tool | `internal/agent/hooked_tool.go:54-100`, `internal/permission/permission.go:16-36`, `internal/hooks/hooks.go:88-158` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | **Verificado ausente**: `packages/events/src/EventBus.ts:368-383` (`evaluatePreToolUse`, en producción vía `main.ts:2537` y `register-ipc.ts:2153`) sólo devuelve `allow:false` — no existe la decisión "allow" por hook, ni `halt`, ni reescritura de input. Extender `HookDecision` (`packages/events/src/types.ts:212`) con `decision: allow\|deny\|none`, `halt` y `rewriteInput`; propagar la pre-aprobación al `ApprovalEngine` **atada al identificador de la llamada** (nunca como bypass global). Preservar la agregación: *deny* gana sobre *allow*, *halt* es pegajoso, y los parches `updated_input` hacen shallow-merge en orden de configuración. | Ego: `SEC-05`, `ACT-06`, `ACT-01` | `CRSH-03` |
| `CRSH-05` | 🟠 Alta | **Sesión con puntero de resumen (`SummaryMessageID`)**: el resumen marca el historial en vez de borrarlo, y la reanudación reconstruye el contexto desde ese punto | `internal/session/session.go:51-65`, `:197-231`, `internal/message/message.go:527-551`, `internal/agent/agent.go:1718-1732` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | **Verificado ausente**: `packages/runtime/src/ContextCompaction.ts:703-741` archiva el resumen en `kb/history_archive` como registro suelto, **sin** puntero por sesión; `packages/memory/SessionTimelineRewind.ts` y `SessionFork.ts` existen pero `docs/review/backlog-hermes.md` `HERM-14` los marca sin caller en producción. Añadir `summaryMessageId` al manifiesto de sesión en `packages/memory/EgoMemoryAdapter.ts` (namespace `session/<id>`) y una lectura `listFromSummary` con el mismo fallback de Crush (puntero vacío o mensaje ausente → sesión completa, nunca vacío). **Cableado:** `ipc.session.resume` (`apps/desktop/src/ipc/schema.ts`) reutilizando `SessionFork`. | Ego: `CORE-07`, `REC-01`, `KB-08` | `CRSH-06` |
| `CRSH-06` | 🟠 Alta | **Auto-resumen por umbral de ventana real + prompt de traspaso**: cuándo resumir en tokens restantes y cómo (documento de relevo con `file:line`, no calco del diálogo) | `internal/agent/agent.go:1103-1128`, `:1223-1238`, `internal/agent/templates/summary.md:1-48` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | **Mejora de un módulo ya en producción**: `packages/runtime/src/ContextCompaction.ts:25-31` decide por ratio (0.5) y techo fijo (200 000 tokens), no por tokens restantes de la ventana real del modelo; el prompt de conservación (`:105-118`) no tiene las secciones de traspaso ni la regla "no resumir si la ventana es desconocida". **Cableado:** (a) expresar el umbral en tokens restantes del modelo; (b) reencolar la continuación cuando el turno se corta con trabajo pendiente; (c) añadir al prompt las secciones *Files & Changes* y *Exact Next Steps* con `file:line`. Motor en producción: `apps/desktop/src/main.ts:1724,1956`. | Ego: `CORE-12`, `CORE-06`, `CORE-11` | `CRSH-05` |
| `CRSH-07` | 🟡 Media | **Detección de bucles por firma de interacción** (SHA-256 de `toolName + input + output` sobre una ventana de 10 pasos) | `internal/agent/loop_detection.go:11-14`, `:45-71` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | **Verificado ausente**: Ego corta por conteo (`packages/runtime/src/ToolExecutionLoop.ts:262,306`, `maxSteps`) y por profundidad de delegación (`packages/decision/src/LoopBreaker.ts:33`); no hay detección *semántica* de repetición. Implementar el detector como condición de parada complementaria a `maxSteps` (ventana 10, máximo 5 repeticiones de la misma firma) y emitir un `EgoEvent` de parada para que `DEC-06` lo registre como tal (no como error de tool). | Ego: `DEC-06`, `ACT-02` | — |
| `CRSH-08` | 🟡 Media | **Bus de eventos con dos políticas de entrega**: `Publish` lossy para deltas de alta frecuencia y `PublishMustDeliver` con bloqueo acotado (50 ms) para eventos terminales, con contadores de saturación | `internal/pubsub/broker.go:1-23`, `:34-46`, `:159-188`, `:190-236` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | **Verificado ausente**: `packages/events/src/EventBus.ts:100-120` emite de forma asíncrona no bloqueante con historial de 100 eventos; no distingue evento terminal de evento de streaming ni expone contadores de drop (grep `dropCount\|mustDeliver` → 0 hits). Añadir `emitCritical` con envío acotado por suscriptor y contadores `dropCount`/`mustDeliverDropCount`, visibles en la consola de métricas del Daily State. Motivo: hoy un resultado de tool o un fin de turno puede perderse si el suscriptor va lento. | Ego: `ACT-05`, `ACT-12`, `DS-05` | — |
| `CRSH-09` | 🟡 Media | **Superficie de terminal, sustrato SQLite, configuración ejecutable en bash y dominio comercial de terceros** | `internal/ui/**` (Bubble Tea v2, Lipgloss v2, glamour v2), `internal/db/**` (SQLite + sqlc), `internal/shellconfig/load.go:33` (`crushrc`), `internal/config/provider.go:200` (catwalk), `internal/agent/hyper_credits.go`, `internal/oauth/**` (Copilot), `internal/event/event.go:13` (PostHog) | — | 🔵 P3 | 🚫 Descartada (con justificación) | **No se ejecuta.** (a) TUI: el modelo Elm (`tea.Msg`/`tea.Cmd`) no se traduce al renderer React de Ego; sus primitives son Radix + `@ego/ui-runtime` (D3). (b) SQLite: el sustrato canónico y único es VantaDB `NativeVantaDB` (`AGENTS.md` §4) — de la sesión sólo se extrae el patrón (`CRSH-05`). (c) `crushrc`: ejecutar bash para obtener la configuración (`internal/shellconfig/load.go:33`) introduce ejecución arbitraria en el arranque del proceso Main y burla la validación Zod de `SEC-02` y el aislamiento de `SEC-01`; la config de Ego es declarativa (`SafeConfigMutation`). (d) Dominio comercial ajeno al SOC: créditos de proveedor, OAuth de Copilot, catálogo de modelos por red y telemetría PostHog contradicen el principio 9 (local-first) y `SEC-04`. (e) `powernap` (Go) no es adoptable: el build de Ego es TypeScript + binarios `.node` de Rust. | Ego: `CORE-07`, `SEC-03`, `SEC-04`, `DIST-02` · Extracción: `docs/extractions/crush.md` §5 | — |

## 3. Matriz de Integración con el Backlog Maestro ##

Cada tarea `CRSH-*` se ejecuta como **pre-requisito de diseño y código** de las fases del Backlog Maestro
(`docs/roadmap/Backlog.md`):

```text
 ┌───────────────────────────────┐
 │  Crush Review & Extracción    │
 │  CRSH-01..09                  │
 └───────────────────────────────┘
      │             │        │
      ▼             ▼        ▼
 ┌───────────┐ ┌─────────┐ ┌─────────────────┐
 │ FASE 01   │ │ FASE 02 │ │ FASE 05/09/10/11│
 │ CORE-07   │ │ ACT-04  │ │ DEC-06          │
 │ CORE-12   │ │ ACT-06  │ │ DOM-01          │
 │ CORE-11   │ │ ACT-08  │ │ SEC-05 / SEC-06 │
 │ REC-01    │ │ ACT-12  │ │ ACT-01          │
 │ KB-08     │ │ DS-05   │ │                 │
 └───────────┘ └─────────┘ └─────────────────┘
      │             │        │
      └─────────────┴────────┘
                    ▼  DESCARTE: CRSH-09 (TUI · SQLite · crushrc · FSL)
```

### Protocolo de ejecución por tarea ###

1. **Extracción de patrón, no de código.** Redactar el contrato en prosa (fichero, líneas, comportamiento) y
   reimplementarlo en TypeScript estricto. Prohibido copiar fragmentos: la licencia FSL-1.1 de Crush lo veta
   (`docs/extractions/crush.md` §1.3).
2. **Aislamiento de dependencias.** Descartar `powernap`, `fantasy`, `charm.land/*`, SQLite y el cliente LSP de Go;
   el cliente LSP de Ego se implementa en el Main process.
3. **Reescritura canónica.** Código nuevo en `packages/` (sin aristas nuevas entre paquetes) o `apps/desktop/`;
   tipado estricto, sin `any`, schemas Zod en IPC.
4. **Verificación.** Test unitario del patrón + test de integración en el flujo real (turno de tool, aprobación,
   reanudación de sesión).
5. **Cierre de tarea.** Marcar `✅ Completada` **sólo** con fichero adaptado + caller en producción verificado por
   grep; si el patrón no aplica, `🚫 Descartada (con justificación)`; si el código existe pero no está cableado,
   `🆕 Pendiente` con el cableado exacto y su responsable.

## 4. Deuda abierta derivada de esta verificación ##

| # | Ítem | Tipo | Owner | Bloqueante |
| --- | --- | --- | --- | --- |
| D1 | `CRSH-01`: Ego no tiene cliente LSP; el Dominio Engineering (`DOM-01`) opera hoy con búsqueda textual ciega | Código | A4 | No |
| D2 | `CRSH-03` + `CRSH-04`: `ToolPermissions` no tiene allowlist por `herramienta:acción` y los hooks de `EventBus` sólo pueden bloquear — la gobernanza (`SEC-05`) sigue binaria | Código | A2/A5 | No |
| D3 | `CRSH-05`: `SessionTimelineRewind` y `SessionFork` (`packages/memory/`) siguen sin caller en producción; el puntero de resumen los activaría | Código | A2/A3 | No |
| D4 | `CRSH-08`: los eventos terminales del `EventBus` pueden perderse con un renderer lento (sin política must-deliver ni contadores) | Código | A2 | No |
| D5 | **Licencia FSL-1.1 de Crush**: no se admite derivación de código; cualquier adaptación exige revisión legal del owner y cabecera de licencia propia en el paquete afectado | Decisión | ness-e | No (restricción ya aplicada: sólo patrones) |
| D6 | `docs/extractions/README.md` §3 y §4.1 no incluyen todavía la fila de Crush; §4.3 presupone licencia MIT para todo código derivado | Documentación | ness-e | No |
