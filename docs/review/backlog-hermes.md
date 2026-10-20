---
kind: review
status: active
description: "Backlog de revisión y extracción de patrones de hermes-agent hacia el monorepo de Ego."
tags: [ego, hermes-agent, extraction, review, desktop, assistant-ui, electron]
schema: "10-column canonical schema (.agents/references/backlog-format.md compatible)"
---

# Backlog de Revisión y Extracción: Hermes Agent (hermes-agent) #

## Auditoría de extracción de patrones sobre el gemelo de stack desktop ##

| Campo | Valor |
| --- | --- |
| Estado | Activo — 30 hallazgos, todos cerrados en estado canónico; 14 asimilados con caller de producción |
| Repositorio Origen | `repos-referencia/hermes-agent/` (Commit verificado: oct-2026) |
| Total de Tareas | **30** (`HERM-01`..`HERM-30`) |
| Fases Impactadas en Ego | Fase 01 (`CORE`), Fase 02 (`ACT`), Fase 03 (`SUB`), Fase 04 (`CANV`), Fase 05 (`DEC`), Fase 07 (`TASK`), Fase 11 (`SEC`), Fase 12 (`DIST`) |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Última verificación | 2026-10-20 — grep sobre `packages/` + `apps/desktop/` (excluye `test/`, `dist/`, `node_modules/`) |

> **Propósito:** Registro canónico y secuencial de auditoría, extracción de patrones y adaptación técnica de
> `repos-referencia/hermes-agent` hacia el monorepo de Ego.
>
> **Regla de Operación:** *No copiar código directamente*. Extraer la lógica de diseño, contratos y patrones
> arquitectónicos, reescribiendo limpiamente en TypeScript estricto, React 19 y Node 22 Main Process, apoyándose en
> VantaDB como sustrato de memoria.
>
> **Esquema:** Tabla canónica de 10 columnas: `ID`, `Severidad`, `Hallazgo`, `Archivo Hermes`, `Esfuerzo`, `Prioridad`,
> `Estado`, `Descripción & Adaptación en Ego`, `Relaciones Ego`, `Dependencias`.

---

## 0. Verificación de estado (2026-10-20) — Ola 2 de remediación ##

Cada fila fue re-auditada contra el **código real** del clon y contra el **código real de Ego**. Criterio de
`✅ Completada`: existe el fichero adaptado **y** hay un caller en producción (grep sobre `packages/` +
`apps/desktop/`, excluyendo `test/`, `dist/` y `node_modules/`).

| Estado | Significado canónico |
| --- | --- |
| `✅ Completada` | Asimilado, integrado y con **caller en producción verificado**. La celda cita la ruta real. |
| `🚫 Descartada (con justificación)` | El patrón no se aplica en Ego, fue sustituido por otro módulo canónico, o viola un guardrail. La celda contiene el motivo técnico. |
| `🆕 Pendiente` | Asimilado (el código existe y está probado) pero **sin caller en producción**. La celda dice el cableado exacto y quién lo ejecuta. |
| `⏳ Futura (fase)` | Diferido a una fase posterior, con fase destino explícita. |

### Correcciones de la Ola 1 (evidencias que ya no se sostenían) ###

La Ola 1 fijó líneas de evidencia que el repositorio ha movido desde entonces. Re-verificadas el 2026-10-20:

| ID | Evidencia en Ola 1 | Evidencia verificada en Ola 2 |
| --- | --- | --- |
| `HERM-01` / `HERM-02` | `ego-chat.tsx:43` | `ego-chat.tsx:42` (`MarkdownText`) |
| `HERM-04` | `ego-chat.tsx:44` | `ego-chat.tsx:43` (`MessageRenderBoundary`) |
| `HERM-05` | `markdown-text.tsx:3` | `markdown-text.tsx:3` (correcta) -> `ego-chat.tsx:42` |
| `HERM-09` | `App.tsx:9`, `Sidebar.tsx` | `App.tsx:9` (import), `App.tsx:361` (montaje); `Sidebar.tsx:39` solo notifica el colapso |
| `HERM-10` | `App.tsx:338` | `App.tsx:8` (import), `App.tsx:349` (montaje) |
| `HERM-13` | `main.ts:9,2920,773` | `main.ts:7` (import), `main.ts:1958` (instancia), `main.ts:738` (`getLifecycle`) |
| `HERM-19` | `main.ts:23,3101` | `main.ts:11` (import), `main.ts:2198` (instancia), `register-ipc.ts:756` (uso) |
| `HERM-20` | `App.tsx:630` | `App.tsx:4` (import), `App.tsx:717` (montaje) |
| `HERM-21` | `ego-chat.tsx:45`; fuente `agent/token_counter.py`, `cost_tracker.py` | `ego-chat.tsx:44`; fuente real `hermes_state_usage.py` (los ficheros citados no existen en el clon) |
| `HERM-17` | `✅ Completada` (worktrees cableados) | **Revertido a `🆕 Pendiente`**: `createWorktree` no tiene caller de producción |

### Búsquedas de verificación ejecutadas ###

```text
Select-String "WindowsUserEnv|WindowsSandboxFallback" packages/ apps/ -> solo packages/recovery/src/index.ts
Select-String "WindowStateHelper"                     packages/ apps/ -> solo packages/ui-runtime/src/WindowState.ts
Select-String "SlashCommandParser"                    packages/ apps/ -> solo packages/ui-runtime/src/index.ts
Select-String "SessionTimelineRewind"                 packages/ apps/ -> solo packages/memory/index.ts
Select-String "StorageHealthLatch"                    packages/ apps/ -> solo packages/recovery/src/index.ts
Select-String "createWorktree"                        packages/ apps/ -> packages/domains/src/engineering, sin caller
Select-String "ZeroContextKernel"                     packages/ apps/ -> solo packages/execution/src/index.ts
Select-String "SkillLinter"                           packages/ apps/ -> SkillScanner.ts:32 -> main.ts:2198
Select-String "applyEphemeralOverlay"                 packages/ apps/ -> main.ts:1437 (caller de produccion)
Select-String "Mica|Acrylic|vibrancy"                 packages/ apps/ -> 0
```

---

## 1. Resumen Ejecutivo de Tareas de Extracción ##

| Grupo de Trabajo | Rango IDs | Tareas | Fases de Ego Impactadas | Prioridad | Beneficio Principal |
| --- | --- | :---: | --- | :---: | --- |
| **A. Primitivas UI & Chat** | `HERM-01..05` | 5 | Fase 01 (`CORE`), Fase 02 (`ACT`), Fase 04 (`CANV`) | 🔴 P0 | Acelera desarrollo de Chat y Artifacts con `@assistant-ui/react` |
| **B. Shell Desktop & Windows** | `HERM-06..09` | 4 | Fase 01 (`CORE`), Fase 04 (`CANV`), Fase 11 (`SEC`) | 🔴 P0 | Resuelve bugs críticos de Electron en Windows (PATH, frameless, estado) |
| **C. Selectores & Comandos** | `HERM-10..12` | 3 | Fase 01 (`CORE`), Fase 03 (`SUB`) | 🟠 P1 | UX avanzada de Model Router, cambio de sesiones y comandos `/` |
| **D. Memoria, Estado & Empaquetado** | `HERM-13..16` | 4 | Fase 01 (`CORE`), Fase 07 (`TASK`), Fase 12 (`DIST`) | 🟠 P1 | Robustez en timeline de chat y distribución con Electron Builder |
| **E. Capacidades Evaluadas (RFCs)** | `HERM-17..19` | 3 | Fase 02 (`ACT`), Fase 03 (`SUB`) | 🟠 P1 | Aislamiento de Sub-Egos en Git, zero-context RPC y linter AST de tools |
| **F. UX y Costes** | `HERM-20..21` | 2 | Fase 01 (`CORE`), Fase 04 (`CANV`) | 🟠 P1 | Omnibar federado y visualizador de tokens/coste |
| **G. Mensajería Externa** | `HERM-22` | 1 | Fase 11 (`SEC`), P1 | 🔵 P3 | Gateways de mensajería (futuro) |
| **H. Resiliencia & Contratos Compartidos** | `HERM-23..27` | 5 | Fase 01 (`CORE`), Fase 02 (`ACT`), Fase 04 (`CANV`), Fase 05 (`DEC`), Fase 12 (`DIST`) | 🟠 P1 | Supervisión del runtime, backoff, failover, contrato de translucidez y guardia de skew |
| **I. Gobernanza de Aprobación & Prompt** | `HERM-28..30` | 3 | Fase 02 (`ACT`), Fase 11 (`SEC`) | 🟠 P1 | Floor no-anulable, invariante de caché de prompt y disyuntor de denegaciones |
| **TOTAL** | `HERM-01..30` | **30** | **Fases 01, 02, 03, 04, 05, 07, 11, 12** | — | — |

### Recuento de estados (verificado programáticamente sobre las 30 filas de la tabla §2) ###

| `✅ Completada` | `🚫 Descartada` | `🆕 Pendiente` | `⏳ Futura` | Total |
| :---: | :---: | :---: | :---: | :---: |
| 14 | 3 | 6 | 7 | **30** |

Ninguna fila queda en el limbo: los 30 hallazgos cierran en uno de los cuatro estados canónicos.

---

## 2. Catálogo Detallado de Extracción (10 Columnas Canónicas) ##

| ID | Severidad | Hallazgo | Archivo Hermes | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `HERM-01` | 🔴 Crítica | **Primitiva `artifact-card.tsx` para render de artefactos** | `apps/desktop/src/components/assistant-ui/artifact-card.tsx` | 🟢 1d | 🔴 P0 | ✅ Completada | Implementado en `apps/desktop/renderer/components/assistant-ui/artifact-card.tsx`. Renderiza tarjetas compactas para código, SVG, HTML y markdown con título, versión, líneas, copia rápida y apertura directa en el Canvas Dinámico. **Evidencia:** `markdown-text.tsx:4` importa `ArtifactCard` -> `apps/desktop/renderer/components/ego-chat.tsx:42` (`MarkdownText`). Corregida la línea de la Ola 1 (`:43` -> `:42`). | Ego: `CORE-05`, `CANV-02` · Extracción: `docs/extractions/hermes-agent.md` §Bloque A | — |
| `HERM-02` | 🔴 Crítica | **Pipeline AST y sanitización en `markdown-text.tsx`** | `apps/desktop/src/components/assistant-ui/markdown-text.tsx` | 🟡 1-2d | 🔴 P0 | ✅ Completada | Implementado en `apps/desktop/renderer/components/assistant-ui/markdown-text.tsx`. Suprime raw CoT (`<thinking>`) según §9, integra acordeones de Explicabilidad y Evidencia (`<ego:why>`), tarjetas de artefactos y directivas. **Evidencia:** `ego-chat.tsx:42` importa `MarkdownText`; `ansi-text.tsx:2` importa `parseAnsi` de `@ego/ui-runtime`. Corregida la línea de la Ola 1 (`:43` -> `:42`). | Ego: `CORE-05`, `CANV-07` · Ver: `docs/architecture/arquitectura-unificada.md` §9 | — |
| `HERM-03` | 🟠 Alta | **Directiva interactiva HITL `ask-directive.tsx`** | `apps/desktop/src/components/assistant-ui/ask-directive.tsx` | 🟢 1d | 🔴 P0 | ✅ Completada | Implementado en `apps/desktop/renderer/components/assistant-ui/ask-directive.tsx`. Chips interactivos de opciones, estado resuelto anti-duplicación y enlace al chat / canal de eventos de Ego. **Evidencia:** `markdown-text.tsx:5` importa `AskDirective` -> `ego-chat.tsx:42`. | Ego: `ACT-04`, `ACT-05` | `HERM-02` |
| `HERM-04` | 🟠 Alta | **Límite de error por mensaje `message-render-boundary.tsx`** | `apps/desktop/src/components/assistant-ui/message-render-boundary.tsx` | 🟢 0.5d | 🔴 P0 | ✅ Completada | Implementado en `apps/desktop/renderer/components/assistant-ui/message-render-boundary.tsx`. Error Boundary por mensaje con auto-reintento para desincronizaciones de store transitorias y fallback accesible. **Evidencia:** `ego-chat.tsx:43` importa `MessageRenderBoundary`. Corregida la línea de la Ola 1 (`:44` -> `:43`). | Ego: `CORE-05`, `REC-04` | — |
| `HERM-05` | 🟡 Media | **Renderizado de secuencias ANSI `ansi-text.tsx`** | `apps/desktop/src/components/assistant-ui/ansi-text.tsx` | 🟢 0.5d | 🟡 P2 | ✅ Completada | Implementado en `packages/ui-runtime/src/AnsiParser.ts` y `apps/desktop/renderer/components/assistant-ui/ansi-text.tsx`. Parsea secuencias SGR ANSI y renderiza spans coloreados para terminal/tool output. **Evidencia:** `ansi-text.tsx:2` importa `parseAnsi` de `@ego/ui-runtime` -> `markdown-text.tsx:3` -> `ego-chat.tsx:42`. | Ego: `ACT-02`, `CANV-07` | — |
| `HERM-06` | 🔴 Crítica | **Resolución del entorno de usuario Windows `windows-user-env.ts`** | `apps/desktop/electron/windows-user-env.ts` | 🟢 0.5d | 🔴 P0 | 🆕 Pendiente | asimilado en `packages/recovery/src/WindowsUserEnv.ts` (lee `HKCU\Environment` vía `reg query`, expande `%VAR%` y repara `process.env.PATH`) **sin caller en producción** (única referencia: `packages/recovery/src/index.ts:10`). **Cableado pendiente:** invocarlo en el arranque de Electron **antes** de `app.whenReady()` (`apps/desktop/src/main.ts`, owner A4) — es el bug clásico de PATH en Windows y no puede resolverse después de que Chromium resuelva el entorno. | Ego: `CORE-01`, `DIST-01` | — |
| `HERM-07` | 🟠 Alta | **Fallback seguro de Sandbox en Windows `windows-sandbox-fallback.ts`** | `apps/desktop/electron/windows-sandbox-fallback.ts` | 🟢 1d | 🔴 P0 | 🆕 Pendiente | asimilado en `packages/recovery/src/WindowsSandboxFallback.ts` (detecta crash de sandbox `STATUS_BREAKPOINT` 0x80000003, persiste marker y aplica fallback `--no-sandbox` con re-probe) **sin caller en producción** (única referencia: `packages/recovery/src/index.ts:11`). **Cableado pendiente:** invocarlo en el arranque de Electron (`apps/desktop/src/main.ts`, owner A4) cuando Chromium falle con el código de breakpoint. | Ego: `CORE-02`, `SEC-01` | — |
| `HERM-08` | 🟠 Alta | **Persistencia de estado de ventana `window-state.ts`** | `apps/desktop/electron/window-state.ts` | 🟢 0.5d | 🔴 P0 | 🆕 Pendiente | asimilado en `packages/ui-runtime/src/WindowState.ts` (exporta `WindowStateHelper`, `MIN_WINDOW_WIDTH=480`, `MIN_WINDOW_HEIGHT=640`, `MIN_VISIBLE_MARGIN=48`) **sin caller**: `Select-String "WindowStateHelper"` sobre `packages/` + `apps/` -> 0 fuera de su propio fichero. El gestor real `apps/desktop/src/windows/WindowStateManager.ts` (owner A4) **reimplementa** la lógica de normalización de geometría y detección de pantalla desconectada sin importar el módulo canónico. **Cableado pendiente:** `WindowStateManager` debe consumir `WindowStateHelper` (o el módulo del paquete se retira). | Ego: `CORE-01` | — |
| `HERM-09` | 🟡 Media | **Shell con split-pane reajustable `pane-shell/`** | `apps/desktop/src/components/pane-shell/` | 🟡 1-2d | 🔴 P0 | ✅ Completada | Implementado en `apps/desktop/renderer/components/PaneShell.tsx`. SplitPane horizontal reajustable con drag handler, doble clic para reset y persistencia de anchos en localStorage. **Evidencia:** `apps/desktop/renderer/src/App.tsx:9` importa `SplitPane` y `:361` lo monta; `renderer/components/sidebar/Sidebar.tsx:39` solo notifica el colapso. Corregida la evidencia de la Ola 1: `Sidebar.tsx` no monta el `SplitPane`. | Ego: `CANV-01` | — |
| `HERM-10` | 🟠 Alta | **Selector de modelos con búsqueda difusa `model-picker.tsx`** | `apps/desktop/src/components/model-picker.tsx` | 🟢 1d | 🔴 P0 | ✅ Completada | Implementado en `apps/desktop/renderer/components/ModelPicker.tsx` y `packages/ui-runtime/src/FuzzySearch.ts`. Selector modal con ranking difuso, agrupación por proveedor y visualización de capacidades. **Evidencia:** `ModelPicker.tsx:3` importa `fuzzyRank` de `@ego/ui-runtime` (`FuzzySearch.ts`) y lo usa en `:162`; `App.tsx:8` importa el selector y `:349` lo monta. Corregida la línea de montaje de la Ola 1 (`:338` -> `:349`). | Ego: `CORE-03`, `CORE-04` | — |
| `HERM-11` | 🟠 Alta | **Navegador y selector de sesiones `session-picker.tsx`** | `apps/desktop/src/components/session-picker.tsx` | 🟢 1d | 🔴 P0 | ✅ Completada | Implementado en `apps/desktop/renderer/components/SessionPicker.tsx`. Navegador y buscador difuso de sesiones recientes para reanudación (`/resume`) con timestamps relativos. **Evidencia:** `SessionPicker.tsx:3` importa `fuzzyRank`; `renderer/components/sidebar/Sidebar.tsx:23,792` monta el selector. | Ego: `CORE-05`, `CORE-07` | — |
| `HERM-12` | 🟡 Media | **Parser y autocompletado de comandos slash `slash.ts`** | `apps/shared/src/slash.ts` | 🟢 0.5d | 🟠 P1 | 🚫 Descartada (con justificación) | `packages/ui-runtime/src/SlashCommandParser.ts` existe y está probado, pero **no tiene caller**: el Composer usa un parser propio en `apps/desktop/renderer/components/composer-slash.ts` (`LOCAL_SLASH_COMMANDS` en `:15`, `parseSlashCommand` en `:21`, importado en `ego-chat.tsx:38`), que además cubre las menciones `@archivo`. Dos parsers de slash en el repo = ambigüedad sobre cuál es el canónico. **Re-verificado 2026-10-20: el duplicado persiste.** El módulo del paquete no se cablea; el parser del renderer es el que se ejecuta. **Nota:** `SlashCommandParser` sí consume `fuzzyRank` de `HERM-10`, que sí está en producción. | Ego: `CORE-05`, `SUB-01` | — |
| `HERM-13` | 🟠 Alta | **Patrón de ciclo de vida e indicador de recall de memoria** | `agent/memory_provider.py` | 🟡 1d | 🔴 P0 | ✅ Completada | Extraer el concepto formal de ciclo de vida de memoria (`initialize -> prefetch -> sync_turn`) y el indicador determinista de recall (`RecallStatus`) implementado en `packages/memory/EgoMemoryLifecycle.ts`. **Evidencia:** `apps/desktop/src/main.ts:7` (import de `EgoMemoryLifecycle`), `main.ts:1958` (`lifecycle = new EgoMemoryLifecycle(adapter)`), `main.ts:738` (`getLifecycle()`); uso efectivo en `main.ts:1487,1586,1775,1959,1975` y `apps/desktop/src/main/ipc/register-ipc.ts:2100,2123`. Corregidas las tres líneas de la Ola 1 (`:9,2920,773` -> `:7,1958,738`); `renderer/lib/session-resume.ts:5` es un comentario, no un caller. | Ego: `CORE-06`, `CORE-12`, `KB-03` | — |
| `HERM-14` | 🟠 Alta | **Semántica de timeline inmutable y rewind de sesión** | `hermes_state_timeline.py`, `hermes_state_rewind.py` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | asimilado en `packages/memory/SessionTimelineRewind.ts` (rebobinado inmutable sin borrado destructivo sobre namespaces `session/*`, soporte para branches y estado superseded) **sin caller en producción** (única referencia: `packages/memory/index.ts:15`). **Cableado pendiente:** exponer el rewind desde el IPC de sesión (`ipc.session.fork` / `ipc.session.resume` ya existen en `apps/desktop/src/ipc/schema.ts`) reutilizando `SessionFork.ts` y `SessionCheckpointPolicy.ts` — owner A2. | Ego: `CORE-07`, `REC-01` | `HERM-13` |
| `HERM-15` | 🟡 Media | **Auditoría de integridad al arrancar (Health Check)** | `hermes_state_health.py`, `hermes_state_maintenance.py` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | asimilado en `packages/recovery/src/StorageHealthLatch.ts:42` (detecta lock colgado `FjallError: Locked`, corrupción o fallo de deserialización y gestiona latch de degradación) **sin caller en producción** (única referencia: `packages/recovery/src/index.ts:12`). **Cableado pendiente:** instanciarlo en el arranque del `CrashRecoveryEngine` (`packages/recovery/src/CrashRecoveryEngine.ts`, owner A3) para degradar con aviso visible en vez de fallar en silencio. | Ego: `REC-02`, `REC-03` | — |
| `HERM-16` | 🟠 Alta | **Configuración de empaquetado y actualización Electron** | `apps/desktop/electron-builder.config.cjs`, `update-feed.cjs` | 🟡 1-2d | 🟠 P1 | ✅ Completada | Implementado en `apps/desktop/electron-builder.config.cjs:22` (`asarUnpack` de módulos binarios nativos `*.node` y `vantadb`) y packaging hardening. **Evidencia:** el gate de build `apps/desktop/scripts/verify-dist.cjs:59-63` y `smoke-native-packaged.cjs:79-81` fallan si `asarUnpack` deja de incluir `**/*.node` (requisito de `apps/desktop/AGENTS.md`). | Ego: `DIST-01`, `DIST-03`, `DIST-04` | — |
| `HERM-17` | 🟠 Alta | **Aislamiento de Subagentes con Git Worktrees (RFC-01)** | `tools/subagent_worktree.py` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Implementado en `packages/subegos/src/SubEgoWorktree.ts` (gestión de `git worktree`, bifurcación segura y reporte para revisión HITL). **Re-verificado 2026-10-20: la mitad de aislamiento NO tiene caller de producción.** `createWorktree` (`packages/subegos/src/SubEgoWorktree.ts:139`) y `packages/domains/src/engineering/WorktreeManager.ts:161` solo se alcanzan desde `EngineeringDomain.createWorktree` (`packages/domains/src/engineering/EngineeringDomain.ts:235`), que **nadie invoca desde `apps/`**; el IPC de dominio solo lee (`register-ipc.ts:1654` -> `listWorktrees`). Lo que sí está en producción es la **limpieza**: `main.ts:1278` instancia `SubEgoWorktreeManager` y `main.ts:1281-1284` cablea `pruneOrphanWorktrees` en el `MemoryCleanupJob` (`packages/tasks/src/MemoryCleanupJob.ts:154-156`). **Cableado pendiente:** invocar `createWorktree` en la ruta de delegación de Sub-Egos (owner A2/A4) para que un Sub-Ego que edite el repositorio trabaje en su propio worktree. | Ego: `SUB-07`, `SUB-08`, `DOM-01` · Ver: `docs/research/hermes-agent-deep-dive.md` §RFC-01 | — |
| `HERM-18` | 🟠 Alta | **Kernel de Ejecución Zero-Context RPC (RFC-02)** | `tools/code_execution_rpc.py`, `code_kernel.py` | 🟡 2d | 🟠 P1 | 🚫 Descartada (con justificación) | `packages/execution/src/ZeroContextKernel.ts:165` existe (sandbox in-process con `node:vm`, cuota de llamadas y dispatch seguro de tools) pero **no tiene caller** (única referencia: `packages/execution/src/index.ts:8`) y su semántica choca con un guardrail de Ego: ejecutar una cadena de tools **sin turnos de modelo** elimina la granularidad de aprobación por tool call que impone el principio 6 (gobernanza, permisos y aprobación de acciones sensibles). El `ApprovalEngine` solo puede aprobar una tool call cuando esta llega por el loop con su `ActionIdentity` (`COUC-03`); un kernel que encadena llamadas internamente no podría sellar cada eslabón. **Alternativa vigente:** `OCLW-03` (auto-reparación) reduce turnos sin saltarse la aprobación. | Ego: `ACT-07` · Ver: `docs/research/hermes-agent-deep-dive.md` §RFC-02 | — |
| `HERM-19` | 🟡 Media | **Auditoría AST y Linter de Skills (RFC-03)** | `tools/skills_ast_audit.py`, `skill_linter.py` | 🟢 1d | 🟠 P1 | ✅ Completada | Extraer lógica de validación sintáctica y de seguridad sobre Abstract Syntax Trees para inspeccionar herramientas generadas dinámicamente antes de su registro. **Implementación:** `packages/integrations/src/skills/SkillLinter.ts:82` (clase `SkillLinter`, `lintManifest`, `SkillSecurityLevel`). **Evidencia:** `packages/integrations/src/skills/SkillScanner.ts:4,32` (lo instancia y lo usa en `:118`) -> `apps/desktop/src/main.ts:11` (import de `SkillScanner`), `main.ts:2198` (`skillScanner = new SkillScanner()`) -> `apps/desktop/src/main/ipc/register-ipc.ts:756` (`skillScanner.scan`). Corregidas las líneas de la Ola 1 (`main.ts:23,3101` -> `main.ts:11,2198`). | Ego: `ACT-11`, `SUB-05` · Ver: `docs/research/hermes-agent-deep-dive.md` §RFC-03 | — |
| `HERM-20` | 🟠 Alta | **Búsqueda Difusa de Comandos en Caliente (`/` Hot Palette)** | `apps/shared/src/slash.ts`, `fuzzy.ts` | 🟢 1d | 🟠 P1 | ✅ Completada | Reconciliado T09: el omnibar de Task 8 ES HERM-20 — `apps/desktop/renderer/components/omnibar.tsx` (Ctrl+K federado a `searchMulti` con debounce) + `/` en composer + test `Omnibar.test.tsx`. **Evidencia:** `apps/desktop/renderer/src/App.tsx:4` importa `<Omnibar />` y `:717` lo monta; `renderer/components/sidebar/Sidebar.tsx:27,545,581` emite `requestOpenOmnibar()`. Corregida la línea de montaje de la Ola 1 (`:630` -> `:717`). | Ego: `CORE-05`, `CANV-01` | `HERM-12` |
| `HERM-21` | 🟡 Media | **Visualizador de Tokens y Costes en Tiempo Real** | `hermes_state_usage.py`, `agent/credits_tracker.py` | 🟢 1d | 🟡 P2 | ✅ Completada | Implementado en `apps/desktop/renderer/components/daily-state/MetricsConsole.tsx` y badge de costos por turno en `ego-chat.tsx`; cubierto por `MetricsConsole.test.tsx` y `ChatTurnCost.test.tsx` (T19 commit `a986c99`). **Evidencia:** `renderer/components/daily-state/DailyDashboard.tsx:572` monta `<MetricsConsole />`; `ego-chat.tsx:44` importa `toTurnUsage` (uso en `:1114`). **Corrección de fuente:** el patrón vive en `hermes_state_usage.py` (columnas `estimated_cost_usd`, `actual_cost_usd`, `cost_status`, `cost_source`), no en `agent/token_counter.py` ni `cost_tracker.py`, que **no existen** en el clon; la Ola 1 citaba ficheros inexistentes. | Ego: `CORE-03`, `CANV-07` | — |
| `HERM-22` | 🔵 Futura | **Gateways de Mensajería Externa (Telegram / Discord / Slack)** | `gateway/channels/` | 🟣 3d | 🔵 P3 | ⏳ Futura (P1) | Conectores bidireccionales para interactuar con Ego desde clientes externos de chat sin abrir la aplicación desktop. **Motivo del diferimiento:** exige canal de red saliente + credenciales por canal + un proceso gateway resident, incompatibles con el desktop *local-first soberano* sin la capa de relay stateless que `docs/extractions/coucou.md` §36 define pero que no está implementada. Fase destino: P1 (`INT-04`, `DOM-04`). | Ego: `INT-04`, `DOM-04` | — |
| `HERM-23` | 🟠 Alta | **Supervisión del proceso de runtime: identidad, sonda de disponibilidad, pestillo de reaparición y reaper acotado** | `apps/desktop/electron/backend-ownership.ts:1-13,45`, `backend-probes.ts:1,9`, `backend-exit-recovery.ts:17-24,33-37` | 🟡 2-3d | 🟠 P1 | ⏳ Futura (Fase 01) | Hermes identifica cada runtime hijo por `nonce` + `pid` + `startMarker` (un PID reutilizado nunca se confunde con el anterior), conserva una ficha de propiedad con cuarentena de contenido ilegible, afirma que "un fichero en disco no prueba un runtime usable" y sondea con presupuesto acotado (15 s por defecto, tope 120 s). El `exit` se clasifica en *actual* o *stale* y un pestillo de reaparición (3 reapariciones por ventana de 120 s) detecta el *crash-loop*; el fallo real que corrigieron fue una ventana de **9 horas** con la UI viva y sin motor. **Adaptación en Ego:** el subproceso cognitivo `vantadb-mcp` está documentado (`AGENTS.md:26`, `docs/architecture/memoria-vantadb.md:32`) pero **no se invoca en ningún punto** (`EGO-FIND-29`), de modo que no hay contrato de supervisión que lo proteja cuando se implemente. **Cableado:** `packages/memory/` — gestor de subprocess con identidad por `nonce`, sonda de disponibilidad al arranque y pestillo de reaparición, antes que `packages/memory/EgoMemoryAdapter.ts` (owner A2). | Ego: `CORE-06`, `CORE-08` · Extracción: `docs/extractions/hermes-agent.md` §Bloque E.1 | — |
| `HERM-24` | 🟠 Alta | **Backoff de reconexión con *full jitter* y regla de "apertura inestable"** | `apps/shared/src/reconnect-backoff.ts:12,33,36,51` | 🟢 1d | 🟠 P1 | ⏳ Futura (Fase 02) | Escalera exponencial con **jitter completo** (AWS): sin jitter, N clientes que se desconectaron en el mismo instante reconectan en bloque (tormenta de reconexión). La regla transferible es más fina: una conexión que **abre y muere dentro de 5 s** (`RECONNECT_STABLE_OPEN_MS`) cuenta como intento **fallido**, porque reiniciar la escalera en cada "apertura" reconecta eternamente en el intento 0. **Adaptación en Ego:** existe backoff con jitter, pero solo para rotación de credenciales (`packages/models/src/ModelRouter.ts:63,692`); el cliente MCP (`packages/integrations/src/mcp/McpClient.ts:443`) no reconecta en absoluto. **Cableado:** helper de backoff compartido en `packages/integrations/src/mcp/` con la regla de apertura estable, reutilizando `computeBackoffDelayMs` (owner A2/A4). | Ego: `ACT-09`, `ACT-11`, `CORE-03` · Extracción: §Bloque E.2 | — |
| `HERM-25` | 🟠 Alta | **Escalera de failover con *cooldown* de 60 s a 4 h y `reset_at` del proveedor** | `agent/fallback_cooldown.py:24-42,45-76` | 🟡 1-2d | 🟠 P1 | ⏳ Futura (Fase 05) | Al abandonar el primario se arma un cooldown de 60 s, 2 min, ... hasta 4 h; si el proveedor declara `reset_at`, ese valor manda (es una marca de reloj de pared y se convierte a duración antes de compararse con el reloj monótono interno, nunca se mezclan). Solo se rearma al dejar el primario: encadenar desde un fallback activo significa que el primario no era la fuente del fallo. Regla de coste: si el rate limit del primario se reabre en menos de N segundos, **quedarse es más barato que cambiar de modelo**. **Adaptación en Ego:** `ModelRouter` rota credenciales y evalúa la cadena de fallback por petición (`packages/models/src/ModelRouter.ts:729-789`) pero no conoce el 429 ni el `reset_at`. **Cableado:** estado de cooldown por (proveedor, modelo) en `packages/models/src/ModelRouter.ts` (owner A2). | Ego: `CORE-03`, `CORE-04` · Extracción: §Bloque E.3 | — |
| `HERM-26` | 🟡 Media | **Contrato de translucidez nativa con módulo compartido main ↔ renderer y sonda de capacidad por SO** | `apps/shared/src/translucency.ts:61,99,211,350,444` | 🟡 1-2d | 🟠 P1 | ⏳ Futura (Fase 04) | Un único módulo donde ambos procesos coinciden en el significado del ajuste: una palanca 0-100 con dos modos (`clear` = opacidad nativa, `glass` = material nativo + superficies adelgazadas en el renderer), sonda de capacidad **fail-closed** (Windows 11 build ≥ 22621; `setBackgroundMaterial` no existe antes), exclusión deliberada de `'auto'` para que DWM no borre en silencio la elección del usuario, mapeo **total** entre materiales (un valor guardado en macOS resuelve en Windows y el selector pliega duplicados) y escalera por apariencia (apariencia > base > default). La regla operativa: el material se aplica **en la creación de la ventana**, porque una ventana con backing opaco no se puede cambiar a cristal después. **Adaptación en Ego:** no hay translucidez (`grep "Mica\|Acrylic\|vibrancy"` -> 0 en `packages/` y `apps/desktop/`) y el design-system es dark-only y sin decoración cromática, de modo que el efecto visual exige decisión explícita del owner; lo transferible sin decisión es el **contrato compartido** (normalización única + sonda de capacidad). **Cableado:** módulo de contrato en `packages/ui-runtime/` cuando se apruebe el efecto (owner ness-e). | Ego: `CANV-01`, `CORE-01` · Extracción: §Bloque E.4 | — |
| `HERM-27` | 🟡 Media | **Detección de instalación "rasgada" por prueba positiva y silencio por diseño** | `apps/desktop/electron/bundle-skew.ts:44-55,71-80` | 🟢 1d | 🟠 P1 | ⏳ Futura (Fase 12) | El bundle empaquetado lleva un *stamp* con el commit de build; la desincronización solo se declara ante **prueba positiva**: el stamp debe ser ancestro de HEAD (`git merge-base --is-ancestor` va primero, porque `A..HEAD` solo significa "cuánto ahead" si A es ancestro) y el delta se acota a las rutas que de verdad llegan al usuario (`RUNTIME_PATHS`). Por diseño **falla en silencio** si no hay stamp, el commit es desconocido o no es ancestro: un falso positivo afirma al usuario que su instalación está rota. **Adaptación en Ego:** `apps/desktop/electron-builder.config.cjs` existe (`HERM-16`) pero no hay ninguna guardia que detecte renderer, main y runtime nativo desincronizados tras un update parcial. **Cableado:** stamp de build + comprobación de ancestry en el arranque de `apps/desktop/src/main.ts`, con aviso visible solo ante prueba positiva (owner A4, Fase 12). | Ego: `DIST-01`, `DIST-03` · Extracción: §Bloque E.5 | `HERM-16` |
| `HERM-28` | 🟠 Alta | **Floor de aprobación no-anulable para comandos sin vía de recuperación** | `tools/approval_detection.py:59-65` | 🟢 0.5d | 🟠 P1 | 🚫 Descartada (con justificación) | Hermes separa un *floor* incondicional (comandos que NUNCA se ejecutan, ni con `--yolo` ni con `approvals.mode=off`: un floor por debajo del modo permisivo, deliberadamente diminuto — solo lo que no tiene vía de recuperación) de las operaciones destructivas pero recuperables, que sí pasan por aprobación. **Ego ya tiene ese floor de forma canónica:** `packages/security/src/ToolPermissions.ts:277-285` (`BLOCKED_COMMAND_PATTERNS`) deniega **antes** de la aprobación y "deny gana" sobre `defaultMode: allow` (`:266-269`), y `SEC-05` está cerrada. **Fundamento:** patrón sustituido por un módulo canónico de Ego; no hay nada que asimilar ni cablear. | Ego: `SEC-05`, `ACT-06` · Extracción: §Bloque E.6 | — |
| `HERM-29` | 🔴 Crítica | **Invariante de caché de prompt: prefijo byte-estable y compactación como única mutación sancionada** | `AGENTS.md:20` (raíz del clon), `agent/prompt_builder.py`, `agent/context_compressor.py` | 🟡 1d | 🔴 P0 | ✅ Completada | Hermes declara el prompt caching "sagrado" por conversación: el system prompt es byte-estable de por vida, la **única** mutación sancionada es la compactación, y todo lo que deba inyectarse a mitad de conversación viaja como mensaje de usuario o resultado de herramienta, nunca mutando el system prompt. **Ego ya lo impone y ya está cableado:** `packages/runtime/src/types.ts:258-263` (`SystemPromptRebuildReason = "session_start" \| "compression"`, con la mención explícita "ÚNICO cache-break sancionado mid-conversación (Hermes)"), enforcement en `packages/runtime/src/ToolExecutionLoop.ts:273-296` (si el fingerprint del prefijo cambia y no es rebuild por compresión, el turno **se rechaza sin llamar al modelo**), overlay efímero que jamás muta el prefijo en `packages/subegos/src/PromptAssembly.ts:384-396` (`applyEphemeralOverlay`, `assertNoEphemeralInCachedPrefix`) y caller de producción en `apps/desktop/src/main.ts:24,1437`. | Ego: `CORE-05`, `CORE-12` · Extracción: §Bloque E.7 | — |
| `HERM-30` | 🟠 Alta | **Disyuntor de denegaciones consecutivas en el motor de aprobación** | `tools/approval.py:59-67,77-86,94-112` | 🟢 1d | 🟠 P1 | ⏳ Futura (Fase 02) | Cada reintento de un comando denegado por el revisor consume otra llamada de LLM; tras N veredictos de denegación consecutivos en una sesión (3 por defecto, 0 desactiva) el mensaje de denegación **escala a una orden de parada forzada** ("deja de intentar variaciones, repórtalo al usuario"), y cualquier aprobación resetea el contador. Solo cambia el texto del **resultado de herramienta**, sin cirugía de historial ni interrupciones, de modo que es invariante de caché de prompt; el contador está acotado a 256 sesiones con expulsión de la más antigua. **Adaptación en Ego:** existe circuit breaker por **fallo** de herramienta (`packages/execution/src/CircuitBreaker.ts:105`) pero ningún contador de **denegaciones** en `packages/execution/src/ApprovalEngine.ts:115`: un bucle de reintentos sobre la misma acción denegada consume turnos y paciencia sin tope. **Cableado:** contador por sesión en `packages/execution/src/ApprovalEngine.ts` + texto escalonado en la `ApprovalCard` (`ACT-07`, `INT-05`) (owner A2). | Ego: `ACT-06`, `ACT-07`, `INT-05`, `SEC-05` · Extracción: §Bloque E.6 | `HERM-29` |

---

## 3. Integración en el Flujo de Construcción de Ego ##

Cada tarea del backlog `HERM-*` se ejecuta como **pre-requisito de diseño y código** de las fases del Backlog Maestro de
Ego (`docs/roadmap/Backlog.md`):

```text
  FASE 01 · CORE ── CORE-05 (Chat) ─────────────┬── HERM-01..05  (primitivas assistant-ui)
                                                └── HERM-29      (invariante de cache de prompt)

  FASE 01 · CORE ── CORE-01 (Shell Windows) ─────┬── HERM-06..08  (hardening Windows)
                                                ├── HERM-09      (split-pane)
                                                └── HERM-23      (supervision del runtime)

  FASE 02 · ACT  ── ACT-06 (ApprovalEngine) ─────┬── HERM-18 (descartado)  HERM-28 (floor, descartado)
                                                ├── HERM-30  (disyuntor de denegaciones)
                                                └── HERM-24  (backoff de reconexion MCP)

  FASE 03 · SUB  ── SUB-07 (worktrees) ──────────── HERM-17  (createWorktree sin caller)

  FASE 05 · DEC  ── CORE-03 (Model Router) ───────── HERM-25  (cooldown de failover)

  FASE 12 · DIST ── DIST-01..04 ─────────────────┬── HERM-16  (empaquetado)
                                                └── HERM-27  (instalacion rasgada)

  P1         ── INT-04, DOM-04 ──────────────────── HERM-22  (gateways de mensajeria)
```

### Protocolo de Extracción por Tarea ###

1. **Lectura y Aislamiento:** inspeccionar el archivo fuente en `repos-referencia/hermes-agent/` identificando
   dependencias externas.
2. **Eliminación de Acoplamiento:** descartar capas de Python, JSON-RPC HTTP y dependencias de SQLite.
3. **Reescritura Canónica:** escribir el componente o módulo en TypeScript dentro de `apps/desktop/` o `packages/`,
   cumpliendo el tipado estricto (`tsconfig.json`) y las directrices de `AGENTS.md`.
4. **Verificación:** probar de forma aislada en Storybook / Vitest / E2E antes de integrarlo en el hilo principal de
   Ego.
5. **Cierre de Tarea (2026-10-20):** marcar la tarea como `✅ Completada` **solo** con fichero adaptado + caller en
   producción verificado; si el patrón no aplica, `🚫 Descartada (con justificación)`; si el código existe pero no está
   cableado, `🆕 Pendiente` con el cableado exacto y su responsable; si el patrón es válido pero pertenece a una
   fase posterior, `⏳ Futura (fase)` con la fase destino.

---

## 4. Deuda abierta derivada de esta verificación (→ handoff A5) ##

| # | Ítem | Tipo | Owner | Bloqueante |
| --- | --- | --- | --- | --- |
| D1 | `HERM-06` / `HERM-07`: el hardening de Windows vive en `packages/recovery` sin cablear al arranque de Electron | Código | A4 | No |
| D2 | `HERM-08`: `WindowStateHelper` (`@ego/ui-runtime`) duplica lógica ya presente en `WindowStateManager` | Código | A4/A3 | No |
| D3 | `HERM-12`: dos parsers de slash (`packages/ui-runtime/src/SlashCommandParser.ts` vs `apps/desktop/renderer/components/composer-slash.ts`) | Código | A4/A3 | No |
| D4 | `HERM-18`: `ZeroContextKernel` sin caller y en tensión con la granularidad de aprobación HITL | Decisión | A2 | No (descartado) |
| D5 | `HERM-17`: el aislamiento por worktrees solo tiene la mitad de limpieza en producción; `createWorktree` no se invoca desde `apps/` | Código | A2/A4 | No |
| D6 | `HERM-23`: el subproceso cognitivo `vantadb-mcp` no tiene contrato de supervisión (identidad, sonda, pestillo de reaparición) | Código | A2 | No |
| D7 | `HERM-24` / `HERM-25`: el cliente MCP no reconecta y el Model Router no conoce el 429 del proveedor | Código | A2/A4 | No |
| D8 | `HERM-30`: el motor de aprobación no corta los bucles de reintento sobre acciones denegadas | Código | A2 | No |
| D9 | `HERM-26`: el efecto visual de translucencia exige decisión del owner frente a la Regla B/N dark-only | Decisión | ness-e | No |

> Ficha técnica completa: [hermes-agent.md](../extractions/hermes-agent.md). Catálogo de extracciones:
> [extractions/README.md](../extractions/README.md).
