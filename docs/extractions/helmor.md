# Extracción Técnica: Helmor (repos-referencia/helmor)

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de capacidades |
| Repositorio Origen | `repos-referencia/helmor/` (Commit verificado: oct-2026) |
| Stack del Origen | Tauri 2 (Rust) + React 19 + TypeScript strict + Bun + PTY (pseudoterminal) + TailwindCSS + Biome |
| Rol en Ego | Referencia de Infraestructura de Consola/PTY, Coalescencia de Salida y Primitivas UI de Composer |
| Owner | ness-e |
| Fecha | 2026-10-08 |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia

`helmor` es una aplicación de terminal asistida por agentes autónomos construida sobre Tauri 2 y React. Su mayor aporte de ingeniería radica en la resolución de problemas de **saturación de interfaz y sobrecarga del Event Loop provocada por ráfagas masivas de comandos CLI (`npm install`, `cargo build`, builds en bucle)**, mediante un planificador de salida de terminal determinista (`terminal-output-scheduler.ts`) y primitivas avanzadas de entrada de usuario en el Composer.

### Divergencias Fundamentales (Qué Descartamos y Por Qué)

| Dimensión | Helmor | Ego (Cognitive OS) | Decisión Crítica |
|---|---|---|---|
| **Shell Desktop Framework** | Tauri 2 con backend en Rust puro (`src-tauri/`). | Electron (último estable) + Node.js 22 en el proceso Main (`apps/desktop/`). | **DESCARTAR Tauri 2**. Ego está estandarizado en Electron por la madurez del ecosistema Node.js, `contextIsolation` estricto y la integración directa con bindings napi-rs de VantaDB. |
| **Package Manager & Runtime** | Bun runtime (`bun.lock`, bun scripts). | Node.js 22 + pnpm workspaces con frozen-lockfile. | **DESCARTAR Bun**. Ego se ejecuta sobre el runtime estable de Node.js 22 estipulado en la Decisión P02. |
| **Persistencia** | Archivos de configuración locales y almacenamiento efímero de sesión en memoria. | VantaDB 0.8.0 nativo (`NativeVantaDB` in-process) con persistencia física estructurada en `ego_memory.vdb`. | **DESCARTAR persistencia efímera**. Todo el historial de ejecución, salidas de terminal relevantes y estados de sesión persisten en VantaDB. |

---

## 2. Catálogo Detallado de Capacidades, Herramientas y Patrones Extraíbles

### Bloque A: Coalescencia de Terminal, Throttling y Buffer Anular (PTY)
*Ubicación en fuente:* `repos-referencia/helmor/src/components/terminal-output-scheduler.ts`

1. **Planificador de Salida por Cuotas (`terminal-output-scheduler.ts:1-155`)**
   - **Qué hace:** Evita que comandos con millones de líneas de salida bloqueen el hilo de renderizado de React. Encola los chunks recibidos desde el PTY y los drena en ráfagas calibradas (`DRAIN_CHUNK_CHARS: 16KB` por tick de animación / `requestAnimationFrame`), garantizando que la UI se mantenga responsiva a 60 FPS sin saltos de scroll.
   - **Herramientas que usa:** Colas en memoria enlazadas, timers de drenado cooperativo, `requestAnimationFrame` en renderer o `setImmediate` en Main.
   - **Adaptación en Ego:** Implementar en `packages/execution/src/terminal/TerminalOutputScheduler.ts` y en el visualizador de consola del Canvas (`apps/desktop/renderer/components/canvas/terminal/TerminalViewer.tsx`). Imprescindible para las herramientas nativas `terminal.exec` de Fase 02 (`ACT-04`) y el visor en Canvas de Fase 04 (`CANV-07`).
   - **Relación con Backlog Ego:** `ACT-03`, `ACT-04` (Fase 02), `CANV-07` (Fase 04). **Compuerta:** `HELM-01`.

2. **Límite de Cola con Buffer Anular (`ring-buffer cap: 13-25`)**
   - **Qué hace:** Establece un límite superior de memoria para salidas continuas (`MAX_QUEUE_CHARS: 2MB`). Cuando una ejecución genera salida infinita, el buffer descarta automáticamente los datos más antiguos reteniendo el inicio y el final de la ejecución, evitando un colapso por `Out Of Memory` (OOM).
   - **Adaptación en Ego:** Incorporar como política obligatoria dentro de `ExecutionManager.ts` para supervisar la ejecución de cualquier subproceso o comando ejecutado por un Sub-Ego.
   - **Relación con Backlog Ego:** `ACT-03` (Fase 02). **Compuerta:** `HELM-02`.

---

### Bloque B: Sincronización Reactiva de Sesiones y Manejo de Señales
*Ubicación en fuente:* `repos-referencia/helmor/src/features/terminal/` y `src/components/`

3. **Almacén Reactivo de Sesiones de Terminal (`terminal-session-store.ts`)**
   - **Qué hace:** Gestiona múltiples sesiones CLI concurrentes desacoplando el estado de proceso (vivo, terminado, código de salida) del componente visual de la terminal, evitando re-renders innecesarios en paneles adyacentes.
   - **Adaptación en Ego:** Base para la gestión de sesiones de ejecución de herramientas en el Dynamic Workspace (`packages/ui-runtime/` y `CANV-01`).
   - **Relación con Backlog Ego:** `CANV-01`, `CANV-07` (Fase 04). **Compuerta:** `HELM-03`.

4. **Sanitización de IME y Emisión de Señales del Sistema (`terminal-ime.ts:1-120`)**
   - **Qué hace:** Normaliza caracteres de entrada complejos (composición IME para teclados internacionales) y mapea eventos de teclado hacia señales UNIX/Windows como `SIGINT` (Ctrl+C), `SIGQUIT` o `SIGTERM` sin desincronización de cursor.
   - **Adaptación en Ego:** Integración en el controlador de entrada de consola interactiva en `packages/tools/native/terminal.ts`.
   - **Relación con Backlog Ego:** `ACT-04` (Fase 02). **Compuerta:** `HELM-04`.

---

### Bloque C: Primitivas UX de Composer y Mención de Contexto
*Ubicación en fuente:* `repos-referencia/helmor/src/components/` y `src/features/composer/`

5. **Botón y Badges de Adjunto de Contexto Focalizado (`append-context-button.tsx`, `file-mention-badge.tsx`)**
   - **Qué hace:** Permite al usuario adjuntar dinámicamente referencias a archivos, selecciones de código o métricas del sistema directamente en la caja de entrada del chat como cápsulas visuales interactivas (*badges* con previsualización al pasar el cursor).
   - **Adaptación en Ego:** Implementar en el Composer de `@assistant-ui/react` para la capacidad de Selección de Contexto (`CANV-04` en Fase 04) y el Activity Widget (`CANV-11`).
   - **Relación con Backlog Ego:** `CANV-04`, `CANV-11` (Fase 04).

6. **Selector Rápido y Command Palette (`quick-switch/`, `quick-panel/`)**
   - **Qué hace:** Modal modal flotante activable por atajo global (`Ctrl+K` / `Cmd+K`) con búsqueda difusa para cambiar rápidamente de repositorio, sesión de agente o comando.
   - **Adaptación en Ego:** Ya alineado con la Cognitive Navigation Sidebar (`CORE-13`), complementando el atajo `Ctrl+K` para navegación instantánea entre Proyectos y Sub-Egos.
   - **Relación con Backlog Ego:** `CORE-13` (Fase 01), `CANV-01` (Fase 04).

---

## 3. Matriz de Extracción vs Descarte

| Componente / Feature de Helmor | Archivo Fuente | Acción | Justificación Técnica |
|---|---|:---:|---|
| **Throttling y scheduler de terminal PTY (16KB/tick)** | `terminal-output-scheduler.ts` | 📥 **Extraer & Adaptar** | Patrón crítico para evitar congelamientos de React ante logs masivos de compiladores. |
| **Ring-buffer cap de 2MB anti-OOM** | `terminal-output-scheduler.ts:13-25` | 📥 **Extraer & Adaptar** | Esencial para la estabilidad de `ExecutionManager` en ejecuciones prolongadas en segundo plano. |
| **Almacén reactivo de sesiones PTY** | `features/terminal/terminal-session-store.ts` | 📥 **Extraer & Adaptar** | Desacopla eficientemente el estado de procesos de la capa de presentación de React 19. |
| **Manejo de señales del sistema e IME** | `terminal-ime.ts` | 📥 **Extraer & Adaptar** | Necesario para cancelación limpia (`SIGINT`) de herramientas nativas por el usuario. |
| **File mention badges y contexto en Composer** | `append-context-button.tsx`, `file-mention-badge.tsx` | 📥 **Extraer & Adaptar** | Enriquece la UX del Chat de Ego enlazándolo con el Canvas (`CANV-04`). |
| **Quick Switcher / Command Palette (`Ctrl+K`)** | `features/quick-switch/` | 💡 **Solo Inspiración** | Ego ya implementó los atajos en `CORE-13`; extraer únicamente los estilos visuales de badges. |
| **Backend en Rust nativo de Tauri (`src-tauri/`)** | `src-tauri/` | 🚫 **Descartar (Justificado)** | Ego está basado en Electron + Node 22; los bindings nativos se confinan a `NativeVantaDB` (napi-rs). |
| **Storybook y configuraciones de Bun** | `.storybook/`, `bun.lock` | 🚫 **Descartar (Justificado)** | Ego utiliza pnpm y Vite puro sin dependencias de Bun ni Storybook en producción. |

---

## 4. Impacto en el Backlog de Ego y Trazabilidad

| ID Compuerta | Archivo / Función Helmor | Tarea Canónica Ego | Estado en Backlog Review |
|:---:|---|:---:|:---:|
| `HELM-01` | `terminal-output-scheduler.ts:1-155` (Scheduler 16KB) | `ACT-04` (Fase 02), `CANV-07` (Fase 04) | [`docs/review/backlog-helmor.md`](../review/backlog-helmor.md) |
| `HELM-02` | `terminal-output-scheduler.ts:13-25` (Ring-buffer 2MB) | `ACT-03`, `ACT-04` (Fase 02) | [`docs/review/backlog-helmor.md`](../review/backlog-helmor.md) |
| `HELM-03` | `terminal-session-store.ts` (Store reactivo) | `CANV-01`, `CANV-07` (Fase 04) | [`docs/review/backlog-helmor.md`](../review/backlog-helmor.md) |
| `HELM-04` | `terminal-ime.ts:1-120` (IME & señales SIGINT) | `ACT-04` (Fase 02) | [`docs/review/backlog-helmor.md`](../review/backlog-helmor.md) |
