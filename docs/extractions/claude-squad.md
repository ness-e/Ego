# Extracción Técnica: Claude Squad (repos-referencia/claude-squad) #

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de patrones |
| Repositorio Origen | `repos-referencia/claude-squad/` (upstream `smtg-ai/claude-squad`, commit `ce1ffb4`, origen `session/instance.go`) |
| Licencia del origen | AGPL-3.0 — smtg-ai/claude-squad |
| Commit verificado | ce1ffb4 |
| Ruta de origen | `session/instance.go` |
| Stack del Origen | Go 1.23 (`go.mod:3`) + Bubble Tea / Lip Gloss (TUI), `creack/pty` (PTY), `tmux` (multiplexor externo), Cobra (CLI), Next.js (`web/`) |
| Rol en Ego | Referencia de orquestación multi-agente CLI: gestor de instancias con estado reanudable, aislamiento por `git worktree` y acotado de coste de diff |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Licencia | **AGPL-3.0** (`LICENSE.md:1-3`) — copyleft fuerte: solo se extraen **patrones e ideas**, nunca código traducido literalmente |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia ##

`claude-squad` resuelve un problema **análogo** al de Ego en la Fase 03 (Sub-Egos) y la Fase 07 (Tareas en
segundo plano): gestionar **N agentes CLI independientes en paralelo**, cada uno con su propio directorio de
trabajo aislado, su propio estado persistido y su propio ciclo de vida (arranque → trabajo → espera de input →
pausa → reanudación). Aporta tres patrones no cubiertos por los repositorios de referencia ya asimilados
(`hermes-agent`, `openclaw`, `helmor`): (a) el **degradado explícito a estado reanudable** cuando el sustrato
externo de una sesión ha muerto, (b) el **coste de memoria acotado del diff** cuando hay N sesiones concurrentes,
y (c) el **hash de la salida de terminal** como detector barato de cambio.

El resto del repositorio es superficie de producto de una TUI y de integración con GitHub, y queda descartado
(§3, §5).

### Nota de licencia (obligatoria, AGPL-3.0) ###

AGPL-3.0 es copyleft fuerte: una traducción literal de funciones Go a TypeScript — aunque sea de 20 líneas —
produce una obra derivada que hereda la obligación copyleft. Por tanto, **toda extracción admisible es de
patrón/idea, no de código**. Ningún fichero de `packages/` o `apps/desktop/` debe contener código derivado de
este repositorio; en caso de hacerlo, el work derivado queda obligado a AGPL-3.0 y es incompatible con la
distribución Apache-2.0 de Ego (§8 de `AGENTS.md`). Los patrones concretos que sí se adoptan (estrategia de
degradado, selección de nivel de coste de diff, orden de resolución de binario) son reimplementaciones
independientes en TypeScript estricto a partir de la *descripción del comportamiento*, no de su texto.

### Divergencias Fundamentales ###

| Dimensión | Claude Squad | Ego (Cognitive OS) | Decisión Crítica |
| --- | --- | --- | --- |
| **Sustrato de ejecución** | Programa externo (`claude`, `codex`, `aider`) dentro de una sesión `tmux`; Ego no ejecuta CLIs de terceros. | Sub-Egos in-process en Node 22 (`packages/subegos/src/SubEgoRuntime.ts`), con `terminal_exec` como tool. | **ADAPTAR patrones de ciclo de vida; descartar la dependencia de CLIs externos.** |
| **Persistencia de sesión** | JSON plano en `~/.claude-squad/state.json` (`config/state.go:11-47`, `session/storage.go:11-42`). | VantaDB 0.8.0 nativo in-process (`NativeVantaDB`) a través de `EgoMemoryAdapter`; nunca acceso directo. | **DESCARTAR el almacén JSON**; el patrón de serialización explícita (`ToInstanceData`/`FromInstanceData`) sí se traduce a esquema Zod sobre namespaces `session/*`. |
| **Multiplexor de terminal** | `tmux` como sustrato externo (`session/tmux/tmux.go:95-157`); sin `tmux` la app no arranca. | Sin dependencia de `tmux`; PTY en proceso main con `TerminalOutputBuffer` (16 KB/tick, ring 2 MB). | **DESCARTAR `tmux`**; extraer solo la *semántica* de supervivencia de sesión (§5, `CSQD-09`). |
| **Superficie de usuario** | TUI Bubble Tea (`app/app.go:28-35`, `ui/*.go`). | Electron 33 + React 19 en el renderer; el renderer es presentación pura. | **DESCARTAR la TUI** (`AGENTS.md` §4: sin lógica de negocio en renderer; modelo `Cmd`/`Msg` incompatible con React). |
| **Auto-aprobación** | Modo `AutoYes`: un daemon detached pulsa Enter sobre cualquier prompt detectado por scraping (`daemon/daemon.go:19-88`, `session/tmux/tmux.go:159-184`). | HITL con `ActionIdentity` inmutable (`packages/execution/src/ApprovalEngine.ts`) + allowlist acotada `autoApproveReadOperations` (`packages/ui-runtime/src/stores/EgoStateStores.ts:65,131`). | **DESCARTAR el auto-yes** (principio 6 innegociable; la heurística por texto aprobaría confirmaciones no pretendidas). |
| **Publicación en remoto** | `gh repo sync` + apertura de navegador (`session/git/worktree_git.go:70-126`). | Conector MCP oficial de GitHub (`packages/integrations/src/github/`, `DOM-07`); nivel A es git local. | **DESCARTAR el push a GitHub**: dominio ajeno al SOC y ya cubierto por el conector canónico. |

---

## 2. Inventario Quirúrgico de Patrones a Extraer ##

### Bloque A: Gestor de instancias y modelo de estados ###

*Ubicación en fuente:* `repos-referencia/claude-squad/session/instance.go`, `session/storage.go`

1. **FSM de instancia `Running / Ready / Loading / Paused`** (`session/instance.go:18-29`)
   - **Qué hace:** cuatro estados con semántica distinta: trabajando, esperando input, arrancando, y pausado
     (worktree retirado pero rama conservada). `SetStatus` es la única mutadora y el resto del código ramifica
     sobre el valor.
   - **Adaptación en Ego:** **no se adapta como FSM nueva.** Ego ya tiene un ciclo de vida canónico de trabajo en
     segundo plano en `packages/tasks/src/BackgroundEngine.ts`
     (`'submitted'|'queued'|'running'|'paused'|'completed'|'failed'|'cancelled'`, `pause()` en `:296`,
     `resume()` en `:327`) y un estado de Sub-Ego en `packages/subegos/src/types.ts:6`
     (`"active"|"paused"|"archived"`), ambos con caller en producción (`apps/desktop/src/main.ts:2225`).
     Crear una tercera FSM de sesión dejaría ambigua la canónica (D3, `AGENTS.md` §4).
   - **Relación con Backlog Ego:** `TASK-01`, `SUB-03` (ya cubiertos; no se abre tarea nueva).

2. **Rehidratación tolerante: sustrato externo muerto → estado reanudable**
   (`session/instance.go:248-263`, `session/instance.go:137-144`, `session/storage.go:76-94`)
   - **Qué hace:** al rehidratar una sesión guardada, si el sustrato ya no existe se marca `Paused` y **se
     devuelve `nil` en vez de abortar**; el comentario del código lo explicita: "una sola sesión muerta ocultaría
     todas las demás". `LoadInstances` aborta en el primer error, por eso el degradado se aplica antes.
   - **Adaptación en Ego:** `BackgroundEngine.resume()` exige `status === 'paused'`
     (`packages/tasks/src/BackgroundEngine.ts:327`), pero **no existe ninguna lógica que degrade a `paused`
     cuando el sustrato externo de una tarea deja de estar vivo** (proceso muerto, PTY cerrado, worktree
     borrado). Propuesta: `packages/tasks/src/TaskSessionRehydration.ts`, invocada al arrancar el motor en
     `apps/desktop/src/main.ts` (~`:2225`), que marque `paused` y emita `task:paused`
     (`BackgroundEngine.ts:303`) en lugar de propagar el fallo.
   - **Relación con Backlog Ego:** `TASK-01`, `TASK-03`, `REC-01`.

### Bloque B: Monitor de sesión y diff de salida ###

*Ubicación en fuente:* `repos-referencia/claude-squad/session/tmux/tmux.go`, `session/instance.go`, `app/app.go`

1. **Monitor de cambios por hash SHA-256 de la salida**
   (`session/tmux/tmux.go:204-219`, `session/tmux/tmux.go:246-267`)
   - **Qué hace:** `statusMonitor` guarda el digest de la última salida comparada; `HasUpdated()` recalcula el
     digest y devuelve `updated` solo si cambió, evitando retransmitir la salida completa cuando no hay novelty.
     Además extrae un flag `hasPrompt` por coincidencia de cadena.
   - **Adaptación en Ego:** `packages/tools/src/native/terminal/TerminalOutputBuffer.ts` (16 KB/tick, ring 2 MB)
     **no calcula ningún digest**: cada snapshot re-serializa el buffer completo, de modo que el renderer recibe
     el payload íntegro en cada tick aunque el contenido no haya cambiado. Propuesta:
     `packages/tools/src/native/terminal/TerminalOutputDigest.ts` con digest incremental SHA-256 por chunk,
     cableado en `packages/tools/src/native/terminal/TerminalSessionStore.ts` y consumido por
     `apps/desktop/renderer/hooks/useTerminalSession.ts:34,162`. **Nota:** existen dos copias de
     `TerminalSessionStore` (`packages/tools/src/native/terminal/TerminalSessionStore.ts` y
     `packages/ui-runtime/src/TerminalSessionStore.ts`); el cableado debe recaer en una sola (ver deuda abierta
     D-CSQD-1).
   - **Relación con Backlog Ego:** `ACT-04`, `CANV-07`, `HELM-01`/`HELM-02` (compuertas).

2. **Diff de dos niveles: contenido completo solo para la sesión seleccionada**
   (`session/instance.go:600-618`, `session/git/diff.go:57-75`, `session/git/diff.go:80-98`,
   `app/app.go:945-982`)
   - **Qué hace:** `ComputeDiff()` (diff completo, con contenido) se usa solo para la instancia seleccionada; el
     resto de las N instancias se resuelven con `ComputeDiffNumstat()` → `git diff --numstat` (solo contadores
     add/remove, sin materializar el diff). El tick de metadata corre en goroutines paralelas y el snapshot de
     instancias se toma en el hilo principal (`app/app.go:935-943`) para no competir con el render.
   - **Adaptación en Ego:** `packages/tools/src/native/git/SessionDiffRevisions.ts:89-164` calcula **siempre** el
     diff completo (`:133-145`) y lo parsea con `GitParser.parseDiff`; con N Sub-Egos concurrentes eso mantiene
     N diffs completos en memoria. Propuesta: extender `computeRevisions` con un modo `summary` que use
     `--numstat` y solo materialice el diff de la sesión visible.
   - **Relación con Backlog Ego:** `CANV-02`, `CANV-06`, `DOM-01`, `TASK-01`.

3. **Baseline de commit por sesión y diff acumulado contra ese baseline**
   (`session/git/worktree_ops.go:70-80`, `session/git/diff.go:26-52`)
   - **Qué hace:** `recordBaseCommit()` guarda el SHA con el que arranca el worktree; todos los diffs
     posteriores se calculan contra ese SHA (no contra `HEAD`), de modo que el diff representa exactamente lo
     producido por la sesión. `git add -N .` incluye los untracked en el diff.
   - **Adaptación en Ego:** el módulo ya existe y está probado —
     `packages/tools/src/native/git/SessionDiffRevisions.ts:41-164` (`recordBaseline` en `:47-63`,
     `computeRevisions` en `:89-164`) — pero **no tiene caller en producción**: las únicas referencias son el
     re-export del barrel `packages/tools/src/native/index.ts:34` y su test
     `packages/tools/test/SessionDiffRevisions.test.ts`. Falta exponerlo como tool `git_diff` con baseline de
     sesión en `packages/tools/src/native/git/NativeGitTool.ts:62-98` y reflejarlo en el Canvas.
   - **Relación con Backlog Ego:** `ACT-04`, `CANV-02`, `OCLW-07` (compuerta abierta).

### Bloque C: Worktree manager por instancia ###

*Ubicación en fuente:* `repos-referencia/claude-squad/session/git/`

1. **Aislamiento por worktree con commit base registrado y poda de huérfanos**
   (`session/git/worktree.go:37-46`, `session/git/worktree.go:48-70`,
   `session/git/worktree_ops.go:12-36`, `session/git/worktree_ops.go:83-113`,
   `session/git/worktree_ops.go:170-236`, `session/git/worktree_git.go:154-196`)
   - **Qué hace:** un worktree por instancia en un directorio propio, con ruta única (`timestamp` en
     `worktree.go:67`), rama propia, SHA base registrado, y un barrido de limpieza que parsea
     `git worktree list --porcelain` para detectar directorios huérfanos y podarlos. `IsDirty` /
     `IsValidWorktree` / `IsBranchCheckedOut` sirven de precondiciones antes de pausar o reanudar.
   - **Adaptación en Ego:** ya asimilado y en producción — `packages/subegos/src/SubEgoWorktree.ts`
     (`createWorktree` en `:139-180` con `baseCommit` en `:153-157`; `finalizeWorktree` en `:187-259`;
     `pruneOrphanWorktrees` en `:270-336`). **Evidencia de caller en producción:**
     `apps/desktop/src/main.ts:20` (import de `SubEgoWorktreeManager`) y `apps/desktop/src/main.ts:1271`
     (`new SubEgoWorktreeManager()`).
   - **Relación con Backlog Ego:** `SUB-03`, `DOM-01`, `HERM-17` (compuerta cerrada).

### Bloque D: Lanzamiento de agentes y detección de disponibilidad ###

*Ubicación en fuente:* `repos-referencia/claude-squad/config/config.go`, `session/tmux/tmux.go`

1. **Resolución determinista del binario CLI: alias de shell → `PATH`** (`config/config.go:113-153`)
   - **Qué hace:** `GetClaudeCommand()` intenta primero resolver el alias de la shell del usuario (sourcing de
     `.zshrc`/`.bashrc` + `which`, con extracción de la ruta real si la salida es una definición de alias) y
     solo después cae a `exec.LookPath`; si ambos fallan devuelve un error explícito "command not found in
     aliases or PATH" en lugar de un ENOENT opaco.
   - **Adaptación en Ego:** `packages/tools/src/native/terminal/NativeTerminalTool.ts:146-152` solo captura el
     evento `error` del spawn y propaga el ENOENT crudo de Node, sin indicar la ruta buscada ni el
     remediador. Propuesta: `packages/tools/src/native/terminal/BinaryResolver.ts` con orden determinista (PATH →
     candidatos conocidos) y error accionable, invocado **antes** del `spawn` en `NativeTerminalTool.ts:97` y
     acoplado a la política de `packages/tools/src/native/terminal/TerminalCommandPolicy.ts` (allowlist
     deny-by-default).
   - **Relación con Backlog Ego:** `ACT-04`, `SEC-05`.

2. **Perfiles nombrados de programa** (`config/config.go:29-47`, `config/config.go:52-82`,
   `ui/overlay/profilePicker.go:11-89`)
   - **Qué hace:** registro `Profile {Name, Program}` que traduce un alias legible ("codex") al comando real,
     con un selector en la UI de creación de sesión.
   - **Adaptación en Ego:** **no se adapta.** La identidad de un agente en Ego es el `SubEgoManifest`
     (`packages/subegos/src/SubEgoManifest.ts:15`) y el enrutamiento de modelos es el `ModelRouter`
     (`packages/models/src/ModelRouter.ts`); un segundo registro de "identidad de agente programable" sería una
     primitive duplicada y una fuente de verdad paralela (§4 D3).
   - **Relación con Backlog Ego:** `SUB-01`, `SUB-07` (cubiertos).

### Bloque E: Superficie descartable ###

*Ubicación en fuente:* `daemon/daemon.go`, `session/tmux/tmux.go`, `ui/diff.go`, `session/git/worktree_git.go`,
`app/app.go`

1. **Auto-aceptación por scraping + daemon detached** (`daemon/daemon.go:19-88`, `:91-127`, `:131-167`;
   `session/tmux/tmux.go:159-184`) — **descartado**, ver §5.
2. **TUI Bubble Tea y colorizador de diff embebido** (`app/app.go:28-35`, `:196-344`; `ui/diff.go:111-137`;
   `ui/terminal.go:125-183`) — **descartado**, ver §5.
3. **Push a GitHub con `gh`** (`session/git/worktree_git.go:70-126`) — **descartado**, ver §5.

---

## 3. Matriz de Extracción vs Descarte ##

| Componente Claude Squad | Acción en Ego | Razón Técnica / Arquitectónica |
| --- | :---: | --- |
| `session/instance.go` (FSM + Pause/Resume) | 🚫 **Descartada** | Sustituido por `packages/tasks/src/BackgroundEngine.ts` (`pause()`/`resume()`) y `packages/subegos/src/types.ts:6`; una tercera FSM de sesión sería ambigua. |
| `session/instance.go:248-263` (degradado a reanudable) | **EXTRAER PATRÓN** | Reimplementar como `packages/tasks/src/TaskSessionRehydration.ts`; hoy no existe degradado a `paused` por muerte del sustrato. |
| `session/tmux/tmux.go:204-219` (hash de salida) | **EXTRAER PATRÓN** | `TerminalOutputBuffer.ts` no calcula digest; el renderer recibe el payload completo en cada tick. |
| `session/git/diff.go:57-75` + `app/app.go:945-982` (diff a dos niveles) | **EXTRAER PATRÓN** | `SessionDiffRevisions.ts` materializa siempre el diff completo: coste O(N) en memoria con N Sub-Egos. |
| `session/git/worktree_ops.go:70-80` + `session/git/diff.go:26-52` (baseline por sesión) | **EXTRAER PATRÓN** | El módulo ya existe (`SessionDiffRevisions.ts`) y está probado, pero **sin caller en producción**. |
| `session/git/` (worktree por instancia) | **EXTRAER & ADAPTAR** | Ya asimilado en `packages/subegos/src/SubEgoWorktree.ts` con caller en `apps/desktop/src/main.ts:20,1271`. |
| `config/config.go:113-153` (resolución de binario) | **EXTRAER PATRÓN** | Sustituye el ENOENT opaco de `NativeTerminalTool.ts:146-152` por un error accionable y determinista. |
| `config/config.go:29-47` (perfiles de programa) | 🚫 **Descartada** | Duplica `SubEgoManifest` + `ModelRouter`; primitive redundante (D3). |
| `daemon/daemon.go` + `CheckAndHandleTrustPrompt` | 🚫 **Descartada** | Auto-aprobación por heurística de texto: contradice el principio 6 y `ApprovalEngine`/`ToolPermissions`. |
| `app/app.go` + `ui/*.go` (TUI Bubble Tea) | 🚫 **Descartada** | Renderer Electron/React; el modelo `Cmd`/`Msg` no es traducible sin lógica en renderer. |
| `ui/diff.go:111-137` (`colorizeDiff`) | 🚫 **Descartada** | Sustituido por `packages/ui-runtime/src/AnsiParser.ts` (en producción vía `apps/desktop/renderer/components/assistant-ui/ansi-text.tsx:2`) y `packages/tools/src/native/git/GitParser.ts`. Además, traducir literalmente ese código imposing AGPL-3.0 al work derivado. |
| `session/git/worktree_git.go:70-126` (push con `gh`) | 🚫 **Descartada** | Dominio ajeno (publicación en GitHub) ya cubierto por el conector MCP canónico `packages/integrations/src/github/` (`DOM-07`). |
| `session/tmux/tmux.go` (multiplexor `tmux`) | 🚫 **Descartada** | Dependencia de binario externo no presente en el stack de Ego; se extrae solo la semántica de supervivencia (`CSQD-09`). |
| `config/state.go` + `session/storage.go` (almacén JSON) | 🚫 **Descartada** | Ego persiste en VantaDB vía `EgoMemoryAdapter`; nunca acceso directo a disco para estado de sesión. |

---

## 4. Estado real verificado (2026-10-20) ##

> Criterio de cierre (`docs/extractions/README.md` §4): `✅ Completada` exige **fichero adaptado + caller en
> producción verificado por grep** sobre `packages/` + `apps/desktop/` (excluyendo `test/`, `dist/`,
> `node_modules/`). Este repositorio de referencia es **nuevo**: nada había sido asimilado antes de esta
> revisión.

| ID | Patrón | Estado | Evidencia / Fundamento |
| --- | --- | :---: | --- |
| `CSQD-01` | FSM de instancia + Pause/Resume + perfiles de programa | 🚫 **Descartada (con justificación)** | Sustituido por `packages/tasks/src/BackgroundEngine.ts:296,327` (pause/resume, cableado en `apps/desktop/src/main.ts:2225`), `packages/subegos/src/types.ts:6` y `packages/subegos/src/SubEgoManifest.ts:15`. |
| `CSQD-02` | Rehidratación tolerante (sustrato muerto → reanudable) | 🆕 Pendiente | No existe el fichero. Crear `packages/tasks/src/TaskSessionRehydration.ts` y cablearlo en `apps/desktop/src/main.ts` (~`:2225`) para degradar a `paused` y emitir `task:paused` (`BackgroundEngine.ts:303`) — owner A2. |
| `CSQD-03` | Monitor de cambios por hash SHA-256 de la salida | 🆕 Pendiente | No existe el fichero. Crear `packages/tools/src/native/terminal/TerminalOutputDigest.ts` y cablearlo en `packages/tools/src/native/terminal/TerminalSessionStore.ts` + `apps/desktop/renderer/hooks/useTerminalSession.ts:34,162` — owner A4 (ver deuda D-CSQD-1: dos copias del store). |
| `CSQD-04` | Worktree por instancia con commit base registrado | ✅ Completada | `packages/subegos/src/SubEgoWorktree.ts:139-180` (baseCommit en `:153-157`), `:187-259`, `:270-336` → caller `apps/desktop/src/main.ts:20` (import) y `:1271` (`new SubEgoWorktreeManager()`). |
| `CSQD-05` | Diff por sesión con baseline y dos niveles de coste | 🆕 Pendiente | `packages/tools/src/native/git/SessionDiffRevisions.ts:41-164` existe y está probado (`packages/tools/test/SessionDiffRevisions.test.ts`) pero **sin caller en producción** (únicas referencias: `packages/tools/src/native/index.ts:34` y el test). Cablear en `packages/tools/src/native/git/NativeGitTool.ts:62-98` + Canvas; añadir modo `summary` con `--numstat` — owner A3. |
| `CSQD-06` | Resolución determinista del binario CLI (alias → PATH) | 🆕 Pendiente | No existe el fichero. Crear `packages/tools/src/native/terminal/BinaryResolver.ts` y cablearlo antes del `spawn` en `packages/tools/src/native/terminal/NativeTerminalTool.ts:97`, sustituyendo el error opaco de `:146-152` — owner A4. |
| `CSQD-07` | Auto-aceptación por scraping + daemon detached (AutoYes) | 🚫 **Descartada (con justificación)** | Contradice el principio 6 (gobernanza/aprobación) y `packages/execution/src/ApprovalEngine.ts` / `packages/security/src/ToolPermissions.ts`. Ego solo admite auto-aprobación **acotada** (`autoApproveReadOperations`, `packages/ui-runtime/src/stores/EgoStateStores.ts:65,131`). |
| `CSQD-08` | TUI Bubble Tea + `colorizeDiff` embebido | 🚫 **Descartada (con justificación)** | Ego es Electron + React 19 con renderer de presentación pura (`AGENTS.md` §4). El colorizado ya está cubierto por `packages/ui-runtime/src/AnsiParser.ts` → `apps/desktop/renderer/components/assistant-ui/ansi-text.tsx:2` y `packages/tools/src/native/git/GitParser.ts`. |
| `CSQD-09` | Supervisión de agentes CLI externos persistentes (supervivencia tipo `tmux`) | ⏳ Futura (P1) | Depende de una capacidad **no contemplada** en el backlog canónico (lanzar y supervisar CLIs de agentes externos que sobreviven al cierre de la app). Fase destino: **P1** (`TASK-01`/`TASK-07`, `REC-01`). Sujeto a Vía 2 del README §2 (Gate de Research + aprobación del owner) antes de promotion. |

**Recuento:** 1 `✅ Completada` · 3 `🚫 Descartada` · 4 `🆕 Pendiente` · 1 `⏳ Futura` — **9 tareas**.

---

## 5. Descarte normalizado a la forma canónica ##

Las filas de §3 usaban la forma `**Descartada**`; se normalizan aquí a `🚫 Descartada (con justificación)`
(`AGENTS.md` §4) conservando el motivo original:

| Componente Claude Squad | Veredicto | Fundamento |
| --- | :---: | --- |
| `session/instance.go` (FSM `Running/Ready/Loading/Paused`) | 🚫 **Descartada (con justificación)** | Ego tiene un ciclo de vida canónico en `packages/tasks/src/BackgroundEngine.ts` (con `pause()`/`resume()` en producción) y un estado de Sub-Ego en `packages/subegos/src/types.ts:6`; duplicarlo crea ambigüedad sobre el canónico. |
| `config/config.go:29-47` (perfiles de programa) | 🚫 **Descartada (con justificación)** | Duplica `SubEgoManifest` (`packages/subegos/src/SubEgoManifest.ts:15`) y `ModelRouter` (`packages/models/src/ModelRouter.ts`): primitive redundante (D3, `AGENTS.md` §4). |
| `daemon/daemon.go` + `session/tmux/tmux.go:159-184` (AutoYes + scraping de prompt) | 🚫 **Descartada (con justificación)** | Un daemon que pulsa Enter ante cualquier prompt detectado por texto contradice el principio 6 y el modelo de `ActionIdentity` de `ApprovalEngine` (ACT-06) y `ToolPermissions` (SEC-05); la heurística por substring aprobaría confirmaciones no pretendidas. |
| `app/app.go` + `ui/` (TUI Bubble Tea) | 🚫 **Descartada (con justificación)** | Ego es Electron 33 + React 19; el renderer es presentación pura y el modelo `Cmd`/`Msg` no tiene equivalente (`AGENTS.md` §4). AGPL-3.0 impide además traducir el código literal. |
| `ui/diff.go:111-137` (`colorizeDiff`) | 🚫 **Descartada (con justificación)** | Sustituido por `packages/ui-runtime/src/AnsiParser.ts` (en producción) y `packages/tools/src/native/git/GitParser.ts`; además, traducirlo literalmente impondría AGPL-3.0 al work derivado. |
| `session/git/worktree_git.go:70-126` (commit + `gh repo sync` + push) | 🚫 **Descartada (con justificación)** | Publicación en GitHub: dominio ajeno a un SOC local-first; ya cubierto por el conector MCP oficial (`packages/integrations/src/github/`, `DOM-07`). |
| `session/tmux/tmux.go` (multiplexor `tmux`) | 🚫 **Descartada (con justificación)** | Dependencia de binario externo ausente del stack de Ego y en conflicto con el principio 10 (operación persistente y extensible); solo se conserva la semántica de supervivencia en `CSQD-09` (⏳ Futura). |
| `config/state.go` + `session/storage.go` (almacén JSON en `~/.claude-squad`) | 🚫 **Descartada (con justificación)** | Ego persiste el estado de sesión en VantaDB vía `EgoMemoryAdapter` (`CORE-07`, `CORE-12`); escribir JSON en el home del usuario rompe el sustrato soberano y la propiedad/exportación de datos (principio 9). |
