# Extracción Técnica: Helmor (repos-referencia/helmor) #

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de capacidades |
| Repositorio Origen | `repos-referencia/helmor/` (upstream `dohooo/helmor`, commit `a76cda1`, origen `src/components/terminal-output-scheduler.ts`) |
| Licencia del origen | Apache-2.0 — dohooo/helmor |
| Commit verificado | a76cda1 |
| Ruta de origen | `src/components/terminal-output-scheduler.ts` |
| Stack del Origen | Tauri 2 (Rust) + React 19 + TypeScript strict + Bun + PTY + TailwindCSS + Biome |
| Rol en Ego | Referencia de consola/PTY, coalescencia de salida y primitivas UI de Composer |
| Owner | ness-e |
| Fecha | 2026-10-08 · Revisado 2026-10-20 (Ola 2) |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia ##

`helmor` es una aplicación de terminal asistida por agentes autónomos construida sobre Tauri 2 y React.
Su mayor aporte de ingeniería es la resolución de la **saturación de interfaz y la sobrecarga del Event
Loop provocadas por ráfagas masivas de comandos CLI** (`npm install`, `cargo build`, builds en bucle),
mediante un planificador de salida determinista (`src/components/terminal-output-scheduler.ts`) y un
coalescedor equivalente en Rust (`src-tauri/src/workspace/scripts.rs`).

La revisión del 2026-10-20 añade tres patrones que la ficha anterior no recogía: el **gate de arranque
TUI con replay de secuencias ANSI**, la **inferencia de interrupción en el backend con ventana de
asentamiento** y el **hook de ciclo de vida** que el CLI de agente ejecuta contra el host para derivar
estado *busy/idle*.

### Divergencias Fundamentales (Qué Descartamos y Por Qué) ###

| Dimensión | Helmor | Ego (Cognitive OS) | Decisión Crítica |
|---|---|---|---|
| **Shell Desktop Framework** | Tauri 2 con backend en Rust puro (`src-tauri/`). | Electron + Node.js 22 en el proceso Main (`apps/desktop/`). | 🚫 **Descartada (con justificación)** — DESCARTAR Tauri 2. Ego está estandarizado en Electron por la madurez del ecosistema Node.js, `contextIsolation` estricto y la integración directa con bindings napi-rs de VantaDB. |
| **Package Manager & Runtime** | Bun runtime (`bun.lock`, bun scripts). | Node.js 22 + pnpm workspaces con frozen-lockfile. | 🚫 **Descartada (con justificación)** — DESCARTAR Bun. Ego se ejecuta sobre el runtime estable de Node.js 22 estipulado en la Decisión P02. |
| **Persistencia** | Configuración local y almacenamiento efímero de sesión en memoria. | VantaDB 0.8.0 nativo (`NativeVantaDB` in-process) con persistencia en `ego_memory.vdb`. | 🚫 **Descartada (con justificación)** — DESCARTAR persistencia efímera. El historial de ejecución y las salidas de terminal relevantes persisten en VantaDB. |

---

## 2. Catálogo Detallado de Capacidades, Herramientas y Patrones Extraíbles ##

### Bloque A: Planificador de Salida de Terminal en el Renderer ###

*Ubicación en fuente:* `repos-referencia/helmor/src/components/terminal-output-scheduler.ts` (154 líneas)

1. **Planificador de Salida por Cuotas y Fast-Path de Foreground (`terminal-output-scheduler.ts:9-154`)**
   - **Qué hace:** evita que comandos con millones de líneas bloqueen el hilo de renderizado de React.
     Encola los chunks recibidos del PTY y los drena en cuotas de `DRAIN_CHUNK_CHARS = 16 * 1024`
     (línea 11). La ventana de drenado es **dual**: 8 ms para el terminal en primer plano
     (`FOREGROUND_FLUSH_DELAY_MS`, línea 10) y 50 ms para los de fondo (`BACKGROUND_FLUSH_DELAY_MS`,
     línea 9). Un terminal visible con cola vacía escribe directo (líneas 99-102): cero latencia
     añadida en la pestaña activa.
   - **Herramientas que usa:** colas en memoria por terminal, `setTimeout` cooperativo, round-robin
     entre terminales (`MAX_TERMINALS_PER_DRAIN = 2`, línea 12) y fast-path de primer plano.
   - **Adaptación en Ego:** `apps/desktop/renderer/components/canvas/TerminalView.tsx:16-38`
     (`CHUNK_SIZE = 16384` + `drainOutputChunks` con `setTimeout(pump, 16)`), en producción vía
     `canvas/registry.ts:69` → `ComponentRenderer.tsx:41` → `CanvasRuntime.tsx:168`.
   - **Relación con Backlog Ego:** `ACT-03`, `ACT-04` (Fase 02), `CANV-07` (Fase 04).
     **Compuerta:** `HELM-01`.
   - **Corrección:** el drenado usa `setTimeout`, **no** `requestAnimationFrame`.

2. **Límite de Cola con Buffer Anular (`ring-buffer cap: 11-16`)**
   - **Qué hace:** `MAX_QUEUE_CHARS = 2 * 1024 * 1024` (línea 15) acota la memoria de la cola. Al
     superar el tope se **descarta lo más antiguo** (líneas 111-116). Helmor **no** conserva cabeza y
     cola: la compactación head+tail es una **mejora propia de Ego** (`TerminalOutputBuffer.compact()`).
   - **Adaptación en Ego:** `packages/tools/src/native/terminal/TerminalOutputBuffer.ts:19`
     (`MAX_QUEUE_BYTES`, en **bytes**) con compactación head+tail en `compact()` (líneas 91-103).
   - **Relación con Backlog Ego:** `ACT-03` (Fase 02). **Compuerta:** `HELM-02`.

3. **Ciclo de Vida del Scheduler (`clearTerminalWrites` / `disposeTerminalWrites:142-154`)**
   - **Qué hace:** el scheduler expone dos operaciones explícitas de limpieza: descartar la cola de un
     terminal (`clearTerminalWrites`) y eliminar el terminal del scheduler **liberando el timer de
     drenado** cuando ya no queda ninguna cola (líneas 149-153). Sin esa segunda operación el
     `setTimeout` del drenado sobrevive al desmontaje y retiene el proceso.
   - **Adaptación en Ego:** `apps/desktop/renderer/components/canvas/TerminalView.tsx:18-38` encadena
     `setTimeout` **sin ninguna ruta de cancelación**: el `pump` en curso sobrevive al desmontaje del
     componente y escribe en un `setState` de un componente ya retirado.
   - **Relación con Backlog Ego:** `CANV-07` (Fase 04). **Compuerta:** `HELM-10`.

### Bloque B: Coalescencia de Salida en el Backend y Sanitización UTF-8 ###

*Ubicación en fuente:* `repos-referencia/helmor/src-tauri/src/workspace/scripts.rs`

1. **Coalescedor de Backend con Flush UTF-8 Seguro (`scripts.rs:64-68,1017-1141`)**
   - **Qué hace:** el backend **también** coalesce, antes de cruzar la frontera IPC. Lee del PTY en
     bloques de `PTY_READ_BUF_BYTES = 16 * 1024` y emite **un** evento por ventana de
     `PTY_FLUSH_INTERVAL = 8 ms` o por umbral de `PTY_FLUSH_BYTES = 16 * 1024`, lo que ocurra antes
     (líneas 66-68 y 1109). El detalle crítico es el **flush UTF-8 seguro**: usa
     `std::str::from_utf8(pending)` y emite solo el **prefijo válido**, conservando la cola
     incompleta final (líneas 1034-1053); si la cola incompleta supera la longitud máxima de una
     secuencia UTF-8, emite de forma *lossy* para no bloquear el buffer (líneas 1040-1046).
   - **Adaptación en Ego:** no existe equivalente. `TerminalOutputBuffer` concatena bytes y decodifica
     al final (correcto), pero el drenado del renderer **trocea por unidades de código UTF-16**
     (`TerminalView.tsx:30`), lo que puede partir un par suplente y emitir mojibake.
   - **Relación con Backlog Ego:** `ACT-04` (Fase 02), `CANV-07` (Fase 04).
     **Compuerta:** `HELM-06`.

### Bloque C: Almacén Reactivo de Sesiones y Gate de Arranque ###

*Ubicación en fuente:* `repos-referencia/helmor/src/features/terminal/terminal-session-store.ts` (363 líneas)

1. **Almacén Reactivo de Sesiones de Terminal (`terminal-session-store.ts:1-363`)**
   - **Qué hace:** gestiona sesiones CLI concurrentes desacoplando el estado de proceso (vivo,
     terminado, código de salida) del componente visual. Publica **snapshots por workspace**
     (`subscribeToWorkspaceTerminalSessions`, líneas 131-148) en lugar de estado por componente, con
     ring-buffer de `MAX_CHUNK_BYTES = 2 * 1024 * 1024` por sesión (línea 54) y aviso explícito de
     truncado (`truncationNotice`, línea 56).
   - **Adaptación en Ego:** `packages/ui-runtime/src/TerminalSessionStore.ts` y su copia
     **byte-idéntica** `packages/tools/src/native/terminal/TerminalSessionStore.ts`, con
     `useTerminalSession` / `useWorkspaceTerminalSessions` en
     `apps/desktop/renderer/hooks/useTerminalSession.ts:30,158`.
   - **Relación con Backlog Ego:** `CANV-01`, `CANV-07` (Fase 04). **Compuerta:** `HELM-03`.

2. **Gate de Arranque TUI con Replay de Secuencias ANSI (`terminal-session-store.ts:150-186`)**
   - **Qué hace:** retiene la salida previa a la TUI del CLI de agente (prompt del shell y eco del
     comando de arranque) hasta que aparece el marcador de pantalla alternativa
     (`TUI_START_RE`, línea 157: `1049h`, `1047h`, `47h`, `2026h`, `1004h`) o hasta un timeout de
     `BOOT_GATE_TIMEOUT_MS = 3000` (línea 160). Al liberar el gate **reproduce las secuencias de
     control del prefijo descartado** (`PRELUDE_SEQ_RE`, líneas 167-169) para que el estado de
     modos del emulador no quede desincronizado.
   - **Adaptación en Ego:** aplicable al visor de terminal del Canvas, que hoy muestra el prompt y el
     eco del comando como si fueran salida del agente. Ego tiene `packages/ui-runtime/src/AnsiParser.ts`,
     luego el requisito de "no desincronizar el estado ANSI" sí tiene receptor.
   - **Relación con Backlog Ego:** `CANV-07` (Fase 04). **Compuerta:** `HELM-08`.

### Bloque D: Interrupción, Señales y Hooks de Ciclo de Vida ###

*Ubicación en fuente:* `repos-referencia/helmor/src/components/terminal-ime.ts`,
`src-tauri/src/terminal.rs` y `src-tauri/src/cli/terminal_hook.rs`

1. **Escalada de Cancelación por Señales (`src-tauri/src/terminal.rs:105-110`)**
   - **Qué hace:** Helmor traduce la pulsación de interrupción a una señal real: la disciplina de
     línea del PTY convierte `\x03` en `SIGINT` para el **grupo de procesos** en primer plano
     (`src/lib/api.ts:4482`), y el cierre de sesión escala `SIGTERM` → `SIGKILL` sobre ese mismo
     grupo (`src-tauri/src/platform/process.rs:55`). El objetivo no es el proceso leader sino el
     árbol completo, que es lo que deja hijos zombis.
   - **Adaptación en Ego:** `packages/tools/src/native/terminal/NativeTerminalTool.ts:115-135`
     escala `AbortSignal` → `SIGINT` → `SIGTERM` a los 1500 ms; la política de comandos vivos está en
     `apps/desktop/src/main/terminal-policy.ts`.
   - **Relación con Backlog Ego:** `ACT-04` (Fase 02). **Compuerta:** `HELM-04`.

2. **Guard de Composición IME para xterm en WKWebView (`terminal-ime.ts:1-117`)**
   - **Qué hace:** corrige tres quirks de xterm 6 en WebKit: la confirmación instantánea del IME llega
     como `keydown` + `input` sin `keypress`; WebKit puede poblar el textarea antes de
     `compositionstart`; y cambiar de fuente de entrada a mitad de composición confirma el buffer
     pinyin en crudo. Reenvía el commit si xterm no lo entrega en `COMMIT_FALLBACK_MS = 80` (línea
     13) y descarta los espacios de segmentación con `isAbandonedImeAsciiBuffer` (líneas 20-24).
   - **Adaptación en Ego:** **no aplicable**: el terminal de Ego no es xterm sino un `<div>` de líneas
     de texto (`TerminalView.tsx:176-209`), sin compositor de terminal que sincronizar.
   - **Relación con Backlog Ego:** `ACT-04` (Fase 02). **Sin compuerta propia — 🚫 Descartada (con
     justificación)**, ver la matriz §3 y el descarte a nivel de componente del backlog.

3. **Inferencia de Interrupción en el Backend con Ventana de Asentamiento (`terminal.rs:55-110`)**
   - **Qué hace:** detecta la pulsación de interrupción (`ESC`, `ETX`, y sus formas CSI-u de kitty)
     en `observe_stdin` y, tras `INTERRUPT_SETTLE = 500 ms`, marca la sesión como ociosa **si ningún
     hook la liberó antes**. El razonamiento es explícito: los modos de fallo son asimétricos (un idle
     falso se autocura en el siguiente hook; un interrupt perdido deja el spinner colgado). El
     heurístico **se mueve al backend a propósito**: la versión en el renderer se eliminó porque
     cada falso positivo disparaba un IPC + re-render que rompía una composición IME en curso.
   - **Adaptación en Ego:** `packages/tools/src/native/terminal/NativeTerminalTool.ts` solo conoce la
     cancelación explícita por `AbortSignal` (líneas 114-135): no infiere la interrupción del usuario.
   - **Relación con Backlog Ego:** `ACT-04` (Fase 02). **Compuerta:** `HELM-07`.

4. **Hook de Ciclo de Vida del CLI de Agente (`terminal_hook.rs:1-90`)**
   - **Qué hace:** el host inyecta `helmor terminal-hook` como comando de callback en los eventos de
     ciclo de vida del agente (SessionStart, UserPromptSubmit, Stop). El hook mapea el evento a
     *busy/idle* (`event_to_busy`, líneas 85-90; `SessionStart` **no** es busy) y captura el prompt
     enviado para que la sesión se nombre sola. Es **no-op estricto** si falta la variable de entorno
     de sesión (líneas 21-26) y **traga todos los fallos** (líneas 39-74): un hook jamás debe romper
     al agente.
   - **Adaptación en Ego:** el `TerminalSessionStore` de Ego solo conoce `running` / `exited` /
     `error`: **no hay estado *busy* (el agente trabajando) frente a *idle* (esperando al usuario)**,
     que es la distinción que un spinner de terminal necesita.
   - **Relación con Backlog Ego:** `ACT-04` (Fase 02), `CANV-07` (Fase 04).
     **Compuerta:** `HELM-09`.

### Bloque E: Primitivas UX de Composer y Mención de Contexto ###

*Ubicación en fuente:* `repos-referencia/helmor/src/components/` y `src/features/composer/`

1. **Botón y Badges de Adjunto de Contexto Focalizado (`append-context-button.tsx`, `file-mention-badge.tsx`)**
   - **Qué hace:** permite adjuntar dinámicamente referencias a archivos, selecciones de código o
     métricas del sistema en la caja de entrada del chat como cápsulas visuales interactivas, con
     previsualización al pasar el cursor.
   - **Adaptación en Ego:** `apps/desktop/renderer/components/FileMentionBadge.tsx:41`, en producción
     vía `renderer/components/ego-chat.tsx:37` (import) y `:1694` (render).
   - **Relación con Backlog Ego:** `CANV-04`, `CANV-11` (Fase 04). **Compuerta:** `HELM-05`.

2. **Selector Rápido y Command Palette (`quick-switch/`, `quick-panel/`)**
   - **Qué hace:** modal flotante activable por atajo global (`Ctrl+K` / `Cmd+K`) con búsqueda difusa
     para cambiar de repositorio, sesión de agente o comando.
   - **Adaptación en Ego:** ya alineado con la Cognitive Navigation Sidebar (`CORE-13`), complementando
     el atajo `Ctrl+K` para navegación instantánea entre Proyectos y Sub-Egos.
   - **Relación con Backlog Ego:** `CORE-13` (Fase 01), `CANV-01` (Fase 04). **Sin compuerta propia.**

---

## 3. Matriz de Extracción vs Descarte ##

| Componente / Feature de Helmor | Archivo Fuente | Acción | Justificación Técnica |
|---|---|:---:|---|
| **Planificador de salida de terminal (16 KB por tick)** | `terminal-output-scheduler.ts:9-154` | 📥 **Extraer & Adaptar** | Crítico para evitar congelamientos de React ante logs masivos de compiladores. |
| **Ring-buffer cap de 2 MB anti-OOM** | `terminal-output-scheduler.ts:11-16` | 📥 **Extraer & Adaptar** | Esencial para la estabilidad del `ExecutionManager` en ejecuciones prolongadas. |
| **Ciclo de vida del scheduler (clear/dispose + liberación de timer)** | `terminal-output-scheduler.ts:142-154` | 📥 **Extraer & Adaptar** | Sin cancelación del drenado, el timer sobrevive al desmontaje del visor. |
| **Coalescedor de backend con flush UTF-8 seguro** | `src-tauri/src/workspace/scripts.rs:64-68,1017-1141` | 📥 **Extraer & Adaptar** | Evita cortar secuencias UTF-8 a mitad en el umbral de bytes; aporta el par ventana + umbral. |
| **Almacén reactivo de sesiones de terminal** | `features/terminal/terminal-session-store.ts:1-363` | 📥 **Extraer & Adaptar** | Desacopla el estado de proceso de la capa de presentación de React 19. |
| **Gate de arranque TUI con replay ANSI** | `features/terminal/terminal-session-store.ts:150-186` | 📥 **Extraer & Adaptar** | Suprime el prompt y el eco del comando de arranque sin desincronizar el parser ANSI. |
| **Inferencia de interrupción en el backend** | `src-tauri/src/terminal.rs:55-110` | 📥 **Extraer & Adaptar** | Resuelve el spinner colgado cuando el CLI no dispara hook de fin de turno. |
| **Hook de ciclo de vida del CLI de agente** | `src-tauri/src/cli/terminal_hook.rs:1-90` | 📥 **Extraer & Adaptar** | Deriva busy/idle y el nombre de la sesión desde el propio agente. |
| **Guard de composición IME para xterm** | `components/terminal-ime.ts:1-117` | 🚫 **Descartada (con justificación)** | Ego no incrusta xterm: su terminal es un `<div>` de texto. No hay compositor que sincronizar. |
| **File mention badges y contexto en Composer** | `append-context-button.tsx`, `file-mention-badge.tsx` | 📥 **Extraer & Adaptar** | Enriquece la UX del Chat de Ego enlazándolo con el Canvas (`CANV-04`). |
| **Quick Switcher / Command Palette (`Ctrl+K`)** | `features/quick-switch/` | 💡 **Solo Inspiración** | Ego ya implementó los atajos en `CORE-13`; extraer solo los estilos visuales de badges. |
| **Backend en Rust nativo de Tauri (`src-tauri/`)** | `src-tauri/` | 🚫 **Descartada (con justificación)** | Ego está basado en Electron + Node 22; los bindings nativos se confinan a `NativeVantaDB` (napi-rs). |
| **Storybook y configuraciones de Bun** | `.storybook/`, `bun.lock` | 🚫 **Descartada (con justificación)** | Ego utiliza pnpm y Vite puro sin dependencias de Bun ni Storybook en producción. |

---

## 4. Estado real verificado (2026-10-20) — Ola 2 de remediación ##

> Fuente canónica del estado por tarea: [`docs/review/backlog-helmor.md`](../review/backlog-helmor.md).
> Criterio de cierre: fichero adaptado **y** caller en producción (grep sobre `packages/` +
> `apps/desktop/`, excluyendo `test/`, `dist/` y `node_modules/`).

| ID | Patrón | Estado | Evidencia / Fundamento |
|---|---|:---:|---|
| `HELM-01` | Scheduler de coalescencia (16 KB/tick) | ✅ Completada | `apps/desktop/renderer/components/canvas/TerminalView.tsx:16-38` (`CHUNK_SIZE = 16384`, `drainOutputChunks`) → `canvas/registry.ts:69` → `ComponentRenderer.tsx:41` → `CanvasRuntime.tsx:168`. **Corrección:** la cuota vive en el renderer, no en `TerminalOutputBuffer` (ver `HELM-10` y §5). |
| `HELM-02` | Ring buffer 2 MB | ✅ Completada | `packages/tools/src/native/terminal/TerminalOutputBuffer.ts:19` (`MAX_QUEUE_BYTES = 2 * 1024 * 1024`) con compactación head+tail en `compact()` (`:91-103`) → `NativeTerminalTool.ts:83,139,143,165` → `packages/tools/src/native/index.ts:41` → `apps/desktop/src/main.ts:2148`. **Corrección:** la cifra es en **bytes**, no en caracteres. |
| `HELM-03` | UI sync bridge de sesiones | 🚫 Descartada (con justificación) | 🚫 Sin caller: `packages/ui-runtime/src/TerminalSessionStore.ts` y el hook `apps/desktop/renderer/hooks/useTerminalSession.ts:30` sólo se re-exportan. El estado real está en `TerminalOutputBuffer` + `NativeTerminalTool.ts`. |
| `HELM-04` | Escalada de cancelación SIGINT → SIGTERM | ✅ Completada | `packages/tools/src/native/terminal/NativeTerminalTool.ts:115-135` (`AbortSignal` → `SIGINT` → `SIGTERM` a 1500 ms) → `packages/tools/src/native/index.ts:42` → `apps/desktop/src/main.ts:2148`; política en `apps/desktop/src/main/terminal-policy.ts`. **Corrección:** el fichero fuente real del patrón es `src-tauri/src/terminal.rs:105-110`, no `terminal-ime.ts` (§5). |
| `HELM-05` | File mention badges | ✅ Completada | `apps/desktop/renderer/components/FileMentionBadge.tsx:41` → `renderer/components/ego-chat.tsx:37` (import) y `:1694` (render). |
| `HELM-06` | Coalescedor de backend con flush UTF-8 seguro | 🆕 Pendiente | 🆕 Falta el flush por prefijo UTF-8 valido antes de la frontera IPC (0 hits de `PTY_FLUSH`/`utf8Safe`): `TerminalOutputBuffer.ts` decodifica al final. **Owner: A3.** |
| `HELM-07` | Inferencia de interrupción en el backend | 🆕 Pendiente | 🆕 Falta la inferencia de interrupcion ESC/ETX en el backend con ventana de 500 ms (0 hits de `INTERRUPT_SETTLE`/ETX). **Owner: A3.** |
| `HELM-08` | Gate de arranque TUI con replay ANSI | 🆕 Pendiente | 🆕 Falta el gate de arranque TUI y el replay de secuencias ANSI del prefijo descartado (0 hits de `1049h`/`altScreen`/`replayAnsi`). **Owner: A3** (+ A4). |
| `HELM-09` | Hook de ciclo de vida del agente (busy/idle) | 🆕 Pendiente | 🆕 Falta derivar busy/idle desde los hooks de ciclo de vida del CLI de agente: `TerminalSessionStatus` solo distingue running/exited/error. **Owner: A4.** |
| `HELM-10` | Ciclo de vida del scheduler (cancelación del drenado) | 🆕 Pendiente | 🆕 Falta la liberacion del timer de drenado en `apps/desktop/renderer/components/canvas/TerminalView.tsx` (0 `clearTimeout`): el `setTimeout(pump, 16)` sobrevive al desmontaje. **Owner: A4.** |

**Recuento:** 4 `✅ Completada` · 1 `🚫 Descartada` · 5 `🆕 Pendiente` · 0 `⏳ Futura` — **10 tareas**.

---

## 5. Correcciones factuales verificadas (2026-10-20) ##

Cada fila re-verifica una afirmación de la versión anterior de esta ficha contra el código real del
clon (`repos-referencia/helmor`, commit `a76cda1`) y del workspace de Ego.

| Afirmación anterior | Verificación | Estado de la afirmación |
|---|---|:---:|
| "El terminal de `apps/desktop/src/main.ts:292` usa `spawn` de `node:child_process`" | `main.ts` **no** hace ningún `spawn` (solo importa `type ChildProcess`, línea 5). Los dos sitios de spawn son `packages/tools/src/native/terminal/NativeTerminalTool.ts:97` (ruta tool) y `apps/desktop/src/main/ipc/register-ipc.ts:1940` (ruta IPC de sesión). | 🚫 Falsa (línea y fichero) |
| "`apps/desktop/src/main.ts:3086` (`registerNativeTools`)" | `registerNativeTools` se invoca en `apps/desktop/src/main.ts:2148`. | 🚫 Falsa |
| "el terminal IPC propio de `apps/desktop/src/main.ts:395` (`pushTerminalOutput`)" | `pushTerminalOutput` está en `apps/desktop/src/main.ts:360`; sus emisores reales están en `apps/desktop/src/main/ipc/register-ipc.ts:1956,1959,1962`. | 🚫 Falsa |
| "`terminal-ime.ts` mapea teclas a `SIGINT` / `SIGQUIT` / `SIGTERM`" | `terminal-ime.ts:1-117` es **solo** un guard de composición IME para xterm en WKWebView; no contiene ninguna señal. El patrón de señal vive en `src-tauri/src/terminal.rs:105-110` (`is_interrupt_keypress`) y en la disciplina de línea del PTY (`\x03` → SIGINT al grupo de procesos, `src/lib/api.ts:4482`). | 🚫 Falsa |
| "La coalescencia de 16 KB está implementada en `TerminalOutputBuffer.ts`" | `TerminalOutputBuffer.DRAIN_CHUNK_BYTES` **no tiene consumidores**: `getDrainChunkBytes()` (`:49`) solo aparece en su propia definición. El drenado real está en el renderer (`TerminalView.tsx:16-38`). | 🚫 Falsa (constante inerte) |
| "El ring buffer conserva el inicio y el final de la ejecución" (atribuido a Helmor) | Helmor **descarta lo más antiguo** (`terminal-output-scheduler.ts:111-116`). La compactación head+tail es una mejora propia de Ego (`TerminalOutputBuffer.compact()`). | 🚫 Inexacta (atribución) |
| "El drenado usa `requestAnimationFrame`" | Helmor drena con `setTimeout` (8 ms foreground / 50 ms background); el drenado por tick no existe en el código fuente. | 🚫 Falsa |
| "`terminal-output-scheduler.ts:1-155`" | El fichero tiene 154 líneas. | ⚠️ Inexacta (rango) |
| "No hay PTY en Ego" | `Select-String "node-pty"` sobre `packages/` + `apps/` → 0 coincidencias. La coalescencia se adaptó **sobre pipes** de `child_process`. | ✅ Cierta |
| "Las cuotas son en bytes, no en caracteres" | `TerminalOutputBuffer.MAX_QUEUE_BYTES` (bytes) frente a `terminal-output-scheduler.MAX_QUEUE_CHARS` (chars en el original). | ✅ Cierta |
| "El store de sesiones de terminal está duplicado" | `packages/tools/src/native/terminal/TerminalSessionStore.ts` y `packages/ui-runtime/src/TerminalSessionStore.ts` son byte-idénticos (324 líneas cada uno) y **cada uno exporta su propio `defaultTerminalSessionStore`**: el renderer consume la copia de `@ego/ui-runtime`, luego hay dos estados separados en el proceso. | ✅ Cierta (con riesgo añadido) |

### Deuda de doble camino de salida ###

El camino IPC de sesión (`apps/desktop/src/main/ipc/register-ipc.ts:1940-1960`) emite los chunks en
crudo hacia `ipc.event` y **no pasa por `TerminalOutputBuffer`**: las ráfagas de ese camino no se
coalescen ni se limitan a 2 MB. Deuda registrada en el backlog (`HELM-01/02` → owner A4).

Contexto de eventos relevante para el drenaje de terminal: el `EventBus` de Ego conserva solo 100
eventos en RAM (`packages/events/src/EventBus.ts:84-85,153-157`) y `EgoEvent` **no** lleva un campo
`seq` (`packages/events/src/types.ts:76-95`): cualquier verificador de secuencia o de reordenación
sobre el drenaje de terminal necesita ese campo antes de poder construirse (ver `AGUI-05`).

---

## 6. Impacto en el Backlog de Ego y Trazabilidad ##

| ID Compuerta | Archivo / Función Helmor | Tarea Canónica Ego | Estado en Backlog Review |
|:---:|---|---|:---:|
| `HELM-01` | `terminal-output-scheduler.ts:9-154` (Scheduler 16 KB) | `ACT-04` (Fase 02), `CANV-07` (Fase 04) | [`docs/review/backlog-helmor.md`](../review/backlog-helmor.md) |
| `HELM-02` | `terminal-output-scheduler.ts:11-16` (Ring-buffer 2 MB) | `ACT-03`, `ACT-04` (Fase 02) | [`docs/review/backlog-helmor.md`](../review/backlog-helmor.md) |
| `HELM-03` | `terminal-session-store.ts:1-363` (Store reactivo) | `CANV-01`, `CANV-07` (Fase 04) | [`docs/review/backlog-helmor.md`](../review/backlog-helmor.md) |
| `HELM-04` | `src-tauri/src/terminal.rs:105-110` (Señales de interrupción) | `ACT-04` (Fase 02) | [`docs/review/backlog-helmor.md`](../review/backlog-helmor.md) |
| `HELM-05` | `file-mention-badge.tsx` (Badges de contexto) | `CANV-04`, `CORE-01` (Fase 04) | [`docs/review/backlog-helmor.md`](../review/backlog-helmor.md) |
| `HELM-06` | `workspace/scripts.rs:64-68,1017-1141` (Flush UTF-8 seguro) | `ACT-04` (Fase 02), `CANV-07` (Fase 04) | [`docs/review/backlog-helmor.md`](../review/backlog-helmor.md) |
| `HELM-07` | `src-tauri/src/terminal.rs:55-110` (Inferencia de interrupción) | `ACT-04` (Fase 02) | [`docs/review/backlog-helmor.md`](../review/backlog-helmor.md) |
| `HELM-08` | `terminal-session-store.ts:150-186` (Gate TUI) | `CANV-07` (Fase 04) | [`docs/review/backlog-helmor.md`](../review/backlog-helmor.md) |
| `HELM-09` | `cli/terminal_hook.rs:1-90` (Hook busy/idle) | `ACT-04` (Fase 02), `CANV-07` (Fase 04) | [`docs/review/backlog-helmor.md`](../review/backlog-helmor.md) |
| `HELM-10` | `terminal-output-scheduler.ts:142-154` (Ciclo de vida) | `CANV-07` (Fase 04) | [`docs/review/backlog-helmor.md`](../review/backlog-helmor.md) |
