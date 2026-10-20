---
kind: review
status: active
description: "Backlog especializado para la revisión, extracción de patrones y adaptación técnica de claude-squad (orquestación multi-agente CLI en Go) hacia el monorepo de Ego."
tags: [ego, claude-squad, extraction, review, agents, worktree, terminal, agpl]
schema: "10-column canonical schema (.agents/references/backlog-format.md compatible)"
---

# Backlog de Revisión y Extracción: Claude Squad (smtg-ai/claude-squad) #

## Orquestación multi-agente CLI: gestor de instancias reanudable, aislamiento por worktree y acotado del coste de diff ##

| Campo | Valor |
| --- | --- |
| Estado | Activo — revisión cerrada el 2026-10-20, sin filas en el limbo |
| Repositorio Origen | `repos-referencia/claude-squad/` (commit `ce1ffb4392b01f38e2c4599c7c84d2a93973b138`, rama `main`, v1.0.20, AGPL-3.0) |
| Total de Tareas | 9 (`CSQD-01..09`) |
| Fases Impactadas en Ego | 01 (CORE), 02 (ACT), 03 (SUB), 04 (CANV), 07 (TASK), 09 (DOM), 10 (REC), 11 (SEC) |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Última verificación | Grep sobre `packages/` + `apps/desktop/` (excluyendo `test/`, `dist/`, `node_modules/`) |

---

## 0. Verificación de estado (2026-10-20) ##

Este repositorio de referencia es **nuevo** en el catálogo: no había asimilación previa de ningún patrón suyo. Cada
fila se auditó contra el **código real** (`repos-referencia/claude-squad/`, commit `ce1ffb4`) y contra el estado
de producción del monorepo de Ego.

| Estado | Significado canónico |
| --- | --- |
| `✅ Completada` | Asimilado, integrado y con **caller en producción verificado**. La celda cita la ruta real y el punto de cableado. |
| `🚫 Descartada (con justificación)` | El patrón no aplica en Ego, fue sustituido por otro módulo canónico, o viola un guardrail. La celda contiene el motivo técnico. |
| `🆕 Pendiente` | Patrón asimilado o pendiente de asimilación, pero **sin caller en producción**. La celda dice el **cableado exacto** y **quién lo ejecuta**. |
| `⏳ Futura (fase)` | Diferido a una fase posterior, con fase destino explícita. |

### Búsquedas de verificación ejecutadas ###

```text
CSQD-04  Select-String "SubEgoWorktreeManager"    packages/ apps/  -> SubEgoWorktree.ts:67 + main.ts:20,1271
CSQD-05  Select-String "SessionDiffRevisions"      packages/ apps/  -> native/index.ts:34
CSQD-05  -> + testSessionDiffRevisions.test.ts -> 0 callers en produccion
CSQD-01  Select-String "BackgroundEngine"          apps/desktop/    -> apps/desktop/src/main.ts:49,215,2225
CSQD-08  Select-String "AnsiParser|parseAnsi"      apps/            -> renderer/components/assistant-ui/ansi-text.tsx:2,35
CSQD-07  Select-String "autoApproveReadOperations" packages/ui-runtime/ -> stores/EgoStateStores.ts:65,131
CSQD-03  Select-String "createHash|sha256"         packages/tools/src/native/terminal/ -> 0 resultados
```

> **Nota de licencia (AGPL-3.0).** Todo lo asimilado es **patrón/idea**, no código. Una traducción literal de Go a
> TypeScript produciría una obra derivada copyleft, incompatible con la distribución Apache-2.0 de Ego
> (`AGENTS.md` §8). Ningún fichero de `packages/` o `apps/desktop/` puede contener código derivado de este
> repositorio.

---

## 1. Resumen Ejecutivo de Extracción ##

| Grupo de Trabajo | Rango IDs | Tareas | Fases de Ego Impactadas | Prioridad | Beneficio Principal |
| --- | --- | :---: | --- | :---: | --- |
| **A. Ciclo de vida de instancia** | `CSQD-01..02` | 2 | Fase 07 (`TASK`), Fase 10 (`REC`) | P0 | Degradado explícito a estado reanudable cuando el sustrato externo de una sesión muere, en lugar de abortar la carga completa |
| **B. Monitor y coste de diff** | `CSQD-03, CSQD-05` | 2 | Fase 02 (`ACT`), Fase 04 (`CANV`), Fase 09 (`DOM`) | P0 | Digest de salida para no retransmitir payload estático; diff a dos niveles para acotar memoria con N Sub-Egos concurrentes |
| **C. Aislamiento y resolución** | `CSQD-04, CSQD-06` | 2 | Fase 03 (`SUB`), Fase 02 (`ACT`), Fase 11 (`SEC`) | P0 | Worktree por instancia ya en producción; resolución determinista del binario CLI con error accionable |
| **D. Superficie descartada** | `CSQD-07..08` | 2 | Fase 01 (`CORE`), Fase 11 (`SEC`) | P2 | Cierra formalmente el auto-yes por scraping, la TUI Bubble Tea y el perfil de programa duplicado |
| **E. Capacidad futura** | `CSQD-09` | 1 | Fase 07 (`TASK`), Fase 10 (`REC`) | P3 | Supervisión de agentes CLI externos que sobreviven al cierre de la app (sustrato tipo `tmux`) |
| **TOTAL** | `CSQD-01..09` | **9** | **Fases 01, 02, 03, 04, 07, 09, 10, 11** | — | — |

### Matriz de distribución por fase ###

```text
  Fase 01 · CORE  ──────────  CSQD-01 (descartado), CSQD-08 (descartado)
  Fase 02 · ACT   ──────────  CSQD-03, CSQD-05, CSQD-06
  Fase 03 · SUB   ──────────  CSQD-04 (en produccion)
  Fase 04 · CANV  ──────────  CSQD-03, CSQD-05
  Fase 07 · TASK  ──────────  CSQD-02, CSQD-03, CSQD-05, CSQD-09 (futura)
  Fase 09 · DOM   ──────────  CSQD-05
  Fase 10 · REC   ──────────  CSQD-02, CSQD-09 (futura)
  Fase 11 · SEC   ──────────  CSQD-06, CSQD-07 (descartado)
```

### Recuento de estados (verificado sobre las 9 filas de la tabla §2) ###

```text
  ESTADO              CSQD-01 CSQD-02 CSQD-03 CSQD-04 CSQD-05 CSQD-06 CSQD-07 CSQD-08 CSQD-09   TOTAL
  ✅ Completada             ·       ·       ·       X       ·       ·       ·       ·       ·      1
  🚫 Descartada             X       ·       ·       ·       ·       ·       X       X       ·      3
  🆕 Pendiente              ·       X       X       ·       X       X       ·       ·       ·      4
  ⏳ Futura (P1)             ·       ·       ·       ·       ·       ·       ·       ·       X      1
  TOTAL                     1       1       1       1       1       1       1       1       1      9
```

**Recuento:** 1 `✅ Completada` · 3 `🚫 Descartada` · 4 `🆕 Pendiente` · 1 `⏳ Futura` — **9 tareas**.

---

## 2. Catálogo Detallado de Extracción (10 Columnas Canónicas) ##

| ID | Severidad | Hallazgo | Archivo Claude Squad | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CSQD-01` | Media | **FSM de instancia `Running/Ready/Loading/Paused` + Pause/Resume + perfiles de programa** | `session/instance.go:18-29`, `:423-507`, `:510-572`; `config/config.go:29-47`, `:52-82` | — | P2 | 🚫 Descartada (con justificación) | **No se adapta.** Ego ya tiene un ciclo de vida canónico de trabajo en segundo plano en `packages/tasks/src/BackgroundEngine.ts` (estados `submitted\|queued\|running\|paused\|completed\|failed\|cancelled`; `pause()` en `:296`, `resume()` en `:327`), cableado en `apps/desktop/src/main.ts:2225`, y un estado de Sub-Ego en `packages/subegos/src/types.ts:6` (`"active"\|"paused"\|"archived"`). Los perfiles nombrados de programa duplicarían `SubEgoManifest` (`packages/subegos/src/SubEgoManifest.ts:15`) y `ModelRouter` (`packages/models/src/ModelRouter.ts`): primitive redundante (D3, `AGENTS.md` §4). Una tercera FSM de sesión dejaría ambigua la canónica. | Ego: `TASK-01`, `SUB-03`, `SUB-07` | — |
| `CSQD-02` | Alta | **Rehidratación tolerante: sustrato externo muerto → estado reanudable, sin abortar la carga** | `session/instance.go:248-263`, `:137-144`; `session/storage.go:76-94` | 1-2d | P0 | 🆕 Pendiente | El patrón: al rehidratar una sesión guardada, si el sustrato ya no existe se marca `Paused` y se devuelve `nil` en vez de abortar ("una sola sesión muerta ocultaría todas las demás", `session/instance.go:252-253`). **Ego:** `BackgroundEngine.resume()` exige `status === 'paused'` (`packages/tasks/src/BackgroundEngine.ts:327`) pero **no existe ninguna lógica que degrade a `paused` cuando el sustrato externo de una tarea deja de estar vivo** (proceso muerto, PTY cerrado, worktree borrado). **Cableado pendiente:** crear `packages/tasks/src/TaskSessionRehydration.ts` e invocarlo en `apps/desktop/src/main.ts` (~`:2225`) para marcar `paused` y emitir `task:paused` (`BackgroundEngine.ts:303`) en lugar de propagar el fallo — owner A2. | Ego: `TASK-01`, `TASK-03`, `REC-01` | `CSQD-04` |
| `CSQD-03` | Alta | **Monitor de cambios por hash SHA-256 de la salida de terminal** | `session/tmux/tmux.go:204-219`, `:246-267` | 1d | P0 | 🆕 Pendiente | El patrón: `statusMonitor` conserva el digest de la última salida comparada y `HasUpdated()` solo retransmite si el digest cambió, evitando reenviar el payload íntegro cuando no hay novedad. **Ego:** `packages/tools/src/native/terminal/TerminalOutputBuffer.ts` (16 KB/tick, ring 2 MB) **no calcula ningún digest** (`Select-String "createHash \| sha256"` en ese directorio → 0 resultados): cada snapshot re-serializa el buffer completo. **Cableado pendiente:** crear `packages/tools/src/native/terminal/TerminalOutputDigest.ts` (digest incremental por chunk) y cablearlo en `packages/tools/src/native/terminal/TerminalSessionStore.ts`, consumido por `apps/desktop/renderer/hooks/useTerminalSession.ts:34,162` — owner A4. Ver deuda D-CSQD-1: existen dos copias del store y hay que elegir el canónico. | Ego: `ACT-04`, `CANV-07`, `HELM-01`, `HELM-02` | D-CSQD-1 |
| `CSQD-04` | Crítica | **Aislamiento por worktree con commit base registrado y poda de huérfanos** | `session/git/worktree.go:37-46`, `:48-70`; `session/git/worktree_ops.go:12-36`, `:83-113`, `:170-236`; `session/git/worktree_git.go:154-196` | — | P0 | ✅ Completada | Asimilado en `packages/subegos/src/SubEgoWorktree.ts`: `createWorktree` (`:139-180`) registra el `baseCommit` (`:153-157`), `finalizeWorktree` (`:187-259`) decide podar o preservar para revisión HITL según `rev-list --count baseCommit..HEAD` y `status --porcelain`, y `pruneOrphanWorktrees` (`:270-336`) barre directorios no registrados en `git worktree list --porcelain` sin podar a ciegas. **Evidencia de caller en producción:** `apps/desktop/src/main.ts:20` (import de `SubEgoWorktreeManager`) y `apps/desktop/src/main.ts:1271` (`new SubEgoWorktreeManager()`). | Ego: `SUB-03`, `DOM-01`, `HERM-17` | — |
| `CSQD-05` | Crítica | **Diff por sesión con baseline y dos niveles de coste (diff completo vs `--numstat`)** | `session/git/diff.go:26-52`, `:57-75`, `:80-98`; `session/git/worktree_ops.go:70-80`; `session/instance.go:600-618`; `app/app.go:945-982` | 1-2d | P0 | 🆕 Pendiente | El patrón: el baseline es el SHA con el que arrancó el worktree (no `HEAD`), y el diff se calcula contra él; además solo la sesión **seleccionada** materializa el diff completo (`ComputeDiff`), mientras el resto se resuelve con `git diff --numstat` (`ComputeDiffNumstat`), con snapshot de instancias tomado en el hilo principal (`app/app.go:935-943`) y metadata en goroutines paralelas. **Ego:** `packages/tools/src/native/git/SessionDiffRevisions.ts:41-164` existe y está probado (`packages/tools/test/SessionDiffRevisions.test.ts`) pero **sin caller en producción** (únicas referencias: el barrel `packages/tools/src/native/index.ts:34` y el test) y **siempre** materializa el diff completo (`:133-145`), con coste O(N) en memoria para N Sub-Egos concurrentes. **Cableado pendiente:** exponerlo como tool `git_diff` con baseline de sesión en `packages/tools/src/native/git/NativeGitTool.ts:62-98` y añadir el modo `summary` (`--numstat`) para las sesiones no visibles — owner A3. | Ego: `ACT-04`, `CANV-02`, `CANV-06`, `DOM-01`, `OCLW-07` | `CSQD-04` |
| `CSQD-06` | Media | **Resolución determinista del binario CLI (alias de shell → `PATH`) con error accionable** | `config/config.go:113-153` | 0.5d | P1 | 🆕 Pendiente | El patrón: `GetClaudeCommand()` resuelve primero el alias de la shell del usuario (sourcing de `.zshrc`/`.bashrc` + `which`, extrayendo la ruta real si la salida es una definición de alias) y solo después cae a `exec.LookPath`; si ambos fallan devuelve un error explícito en vez de un ENOENT opaco. **Ego:** `packages/tools/src/native/terminal/NativeTerminalTool.ts:146-152` solo captura el evento `error` del spawn y propaga el ENOENT crudo de Node, sin indicar la ruta buscada ni el remediador. **Cableado pendiente:** crear `packages/tools/src/native/terminal/BinaryResolver.ts` con orden determinista (PATH → candidatos conocidos) y error accionable, invocarlo **antes** del `spawn` en `NativeTerminalTool.ts:97` y acoplarlo a la allowlist deny-by-default de `packages/tools/src/native/terminal/TerminalCommandPolicy.ts` — owner A4. | Ego: `ACT-04`, `SEC-05` | — |
| `CSQD-07` | Crítica | **Auto-aceptación de prompts por scraping + daemon detached con fichero PID (AutoYes)** | `daemon/daemon.go:19-88`, `:91-127`, `:131-167`; `session/tmux/tmux.go:159-184` | — | P2 | 🚫 Descartada (con justificación) | Un proceso detached que sondea cada sesión y pulsa Enter ante cualquier prompt detectado por coincidencia de substring ("Do you trust the files in this folder?", "No, and tell Claude what to do differently", `session/tmux/tmux.go:167-181`) contradice el principio 6 (gobernanza, permisos, aprobación de acciones sensibles) y el modelo de `ActionIdentity` inmutable de `packages/execution/src/ApprovalEngine.ts` (ACT-06) y `packages/security/src/ToolPermissions.ts` (SEC-05). La heurística por texto aprobaría confirmaciones no pretendidas (p. ej. un diálogo de permisos del propio agente). Ego solo admite auto-aprobación **acotada y auditable**: `autoApproveReadOperations` (`packages/ui-runtime/src/stores/EgoStateStores.ts:65,131`). La detección de prompts por scraping de la salida de un pane queda además prohibida por el guardrail de no introducir lógica específica de servicio en el Runtime. | Ego: `ACT-06`, `SEC-05` (cubiertos) | — |
| `CSQD-08` | Media | **TUI Bubble Tea (`Cmd`/`Msg`, `tea.Model`) y colorizador de diff embebido** | `app/app.go:28-35`, `:196-344`; `ui/diff.go:111-137`; `ui/terminal.go:125-183`; `ui/overlay/profilePicker.go:11-89` | — | P2 | 🚫 Descartada (con justificación) | La TUI es incompatible con el renderer Electron/React 19 de Ego, que es presentación pura sin lógica de negocio (`AGENTS.md` §4 y `apps/desktop/AGENTS.md`); además, traducir literalmente `colorizeDiff` (`ui/diff.go:111-137`, ~27 líneas AGPL) impondría AGPL-3.0 al work derivado. El colorizado de diff ya está cubierto por `packages/ui-runtime/src/AnsiParser.ts` (en producción vía `apps/desktop/renderer/components/assistant-ui/ansi-text.tsx:2,35`) y por `packages/tools/src/native/git/GitParser.ts` (`parseDiff`). El `ProfilePicker` queda cubierto por `CSQD-01`. | Ego: `CANV-01`, `CANV-02`, `HERM-05` (cubiertos) | `CSQD-01` |
| `CSQD-09` | Media | **Supervisión de agentes CLI externos que sobreviven al cierre de la app (sustrato tipo `tmux`)** | `session/tmux/tmux.go:95-157`, `:186-202`; `session/instance.go:509-572` | 3-5d | P3 | ⏳ Futura (P1) | Capacidad de lanzar agentes CLI externos (Claude Code, Codex, OpenCode) como sesiones persistentes que sobreviven al cierre de Ego y se reanudan después. claude-squad lo resuelve con `tmux` como sustrato (`new-session -d`, `attach-session`, `ErrSessionNotFound` → degradar a `Paused`), lo que arrastra una dependencia de binario externo incompatible con el stack actual de Ego. **Motivo del diferimiento:** la capacidad **no está contemplada** en `docs/roadmap/Backlog.md`; abrirla exige Vía 2 del README §2 (Gate de Research + aprobación del owner) antes de promotion a tarea. **Fase destino: P1** (`TASK-01`/`TASK-07` y `REC-01`). Precondición: resolver el sustrato sin `tmux` (proceso hijo supervisado por `packages/recovery/src/ProcessSupervisor.ts` + checkpoint en `packages/tasks/src/TaskCheckpoint.ts`). | Ego: `TASK-01`, `TASK-07`, `REC-01` | D-CSQD-5 |

---

## 3. Matriz de Integración con el Backlog Maestro ##

Cada tarea `CSQD-*` se ejecuta como pre-requisito de diseño y código de las fases del Backlog Maestro
(`docs/roadmap/Backlog.md`):

```text
  CSQD-01 FSM+perfiles ........... 🚫 sustituido por BackgroundEngine   ──►  (sin fase)
  CSQD-02 rehidratacion tolerante  🆕 TASK-01 / TASK-03 / REC-01       ──►  F07 TASK · F10 REC
  CSQD-03 hash de salida ......... 🆕 ACT-04 / CANV-07                ──►  F02 ACT  · F04 CANV
  CSQD-04 worktree por instancia .. ✅ SUB-03 / DOM-01 (en produccion)  ──►  F03 SUB
  CSQD-05 diff baseline + 2 niv .. 🆕 ACT-04 / CANV-02 / DOM-01        ──►  F02 ACT  · F04 CANV · F09 DOM
  CSQD-06 resolucion de binario ... 🆕 ACT-04 / SEC-05                 ──►  F02 ACT  · F11 SEC
  CSQD-07 auto-yes + daemon ....... 🚫 contradice el principio 6       ──►  (sin fase)
  CSQD-08 TUI Bubble Tea .......... 🚫 renderer = presentacion pura     ──►  (sin fase)
  CSQD-09 agentes CLI persistentes  ⏳ P1 (Gate de Research pendiente)  ──►  F07 TASK · F10 REC
```

**Protocolo de extracción por tarea:** lectura y aislamiento del fuente (commit `ce1ffb4`, delimitando
dependencias externas: Bubble Tea, `tmux`, `gh`) → eliminación de acoplamiento (TUI, almacén JSON, multiplexor
`tmux`, auto-yes, push a GitHub) → reescritura canónica del *comportamiento* en TypeScript estricto dentro de
`packages/` o `apps/desktop/`, sin copiar código AGPL y sin introducir lógica de negocio en el renderer → test
unitario del módulo + test de integración antes de cablearlo en `main.ts` → cierre de tarea por estado canónico
(`✅ Completada` **solo** con fichero adaptado + caller en producción verificado por grep; `🆕 Pendiente` con el
cableado exacto y su responsable).

---

## 4. Deuda abierta derivada de esta verificación ##

| # | Ítem | Tipo | Owner | Bloqueante |
| --- | --- | --- | --- | --- |
| D-CSQD-1 | `TerminalSessionStore` existe **duplicado**: `packages/tools/src/native/terminal/TerminalSessionStore.ts` y `packages/ui-runtime/src/TerminalSessionStore.ts` (contenido idéntico). Hay que designar el canónico antes de cablear el digest de `CSQD-03`. | Código | A4 | Sí (bloquea `CSQD-03`) |
| D-CSQD-2 | `packages/tools/src/native/git/SessionDiffRevisions.ts` existe y está probado pero **sin caller en producción** (solo el barrel `packages/tools/src/native/index.ts:34` y su test): código huérfano `IMPLEMENTED` y no `INTEGRATED`. | Código | A3 | No |
| D-CSQD-3 | `packages/tasks/src/BackgroundEngine.ts` no degrada a `paused` cuando el sustrato externo de una tarea deja de estar vivo; el `resume()` de `:327` queda sin disparante. | Código | A2 | No |
| D-CSQD-4 | Licencia **AGPL-3.0** de claude-squad: sin cabecera de atribución ni verificación de no-derivación en el repo. Debe quedar constancia de que todo lo asimilado es patrón/idea, para evitar que una traducción accidental imponga copyleft al work derivado. | Decisión | Owner (ness-e) | No (preventivo) |
| D-CSQD-5 | La capacidad "supervisar agentes CLI externos persistentes" **no existe** en `docs/roadmap/Backlog.md`; `CSQD-09` no puede promoverse a tarea sin el Gate de Research y la aprobación explícita del owner (Vía 2 del README §2). | Producto | Owner (ness-e) | Sí (bloquea `CSQD-09`) |
| D-CSQD-6 | El `CSQD-04` verifica que el aislamiento por worktree está en producción, pero el **baseline de commit por sesión** que le da sentido (`recordBaseCommit`, `session/git/worktree_ops.go:70-80`) no llega al Canvas: depende de `CSQD-05` para que el diff se compute contra ese SHA y no contra `HEAD`. | Código | A3 | No |
