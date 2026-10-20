# Extracción Técnica: Hermes Agent (repos-referencia/hermes-agent) #

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de patrones |
| Repositorio Origen | `repos-referencia/hermes-agent/` (Commit verificado: oct-2026) |
| Stack del Origen | Electron 40 + React 19 + TypeScript + Vite + `@assistant-ui/react` + TailwindCSS + Python 3.11 Backend (FastAPI/JSON-RPC/SQLite) |
| Rol en Ego | Gemelo de Stack Desktop / UI & Shell Reference |
| Owner | ness-e |
| Fecha | 2026-10-20 |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia ##

`hermes-agent` es el repositorio de referencia más relevante para la capa de **Presentación, Shell Desktop y
Componentes de Chat de Ego** debido a que comparte el mismo frontend y runtime de interfaz:

- **Electron 40 + React 19 + TypeScript strict + Vite**
- Integración profunda con **`@assistant-ui/react`**
- Sistema de diseño monocromático, sobrio y funcional

### Divergencias Fundamentales (Qué Descartamos y Por Qué) ###

| Dimensión | Hermes Agent | Ego (Cognitive OS) | Decisión Crítica |
| --- | --- | --- | --- |
| **Backend Runtime** | Proceso secundario en Python (`agent/`, `gateway/`, `cli.py`) levantado como subprocess. | Node.js 22 en el proceso Main de Electron (`apps/desktop/src/main.ts`). | **DESCARTAR backend Python**. Ego ejecuta su Cognitive Runtime directamente en Node 22 in-process. Python en Ego queda confinado a sidecar opcional para ingesta pesada en P1. |
| **Persistencia** | SQLite relacional con FTS (`hermes_state_*.py`). | VantaDB 0.8.0 nativo in-process (`NativeVantaDB` vía napi-rs) + Fjall LSM + HNSW + BM25 + ONNX embeddings. | **DESCARTAR SQLite**. Ego utiliza `NativeVantaDB` como sustrato soberano. Solo extraemos los patrones lógicos de sesiones/timeline/rewind. |
| **Comunicación Main ↔ UI** | JSON-RPC 2.0 sobre WebSockets o HTTP local. | IPC nativo fuertemente tipado de Electron (`ipcMain` / `ipcRenderer` con `contextBridge`). | **ADAPTAR**. No levantamos sockets TCP/HTTP internos para UI local; usamos el bus IPC seguro con `contextIsolation=true`. |

---

## 2. Inventario Quirúrgico de Patrones a Extraer ##

### Bloque A: Primitivas y Componentes `@assistant-ui/react` ###

*Ubicación en fuente:* `repos-referencia/hermes-agent/apps/desktop/src/components/assistant-ui/`

1. **`artifact-card.tsx`**
   - **Qué hace:** Renderizado interactivo de artefactos generados por el modelo (código, documentos markdown,
     previsualizaciones HTML) fuera del flujo lineal de texto, con acciones de copiar, maximizar, exportar y
     versionado.
   - **Adaptación en Ego:** Es la base para el componente de tarjetas de artefactos en el Chat de Ego
     (`apps/desktop/renderer/components/assistant-ui/artifact-card.tsx`), enlazándolo con el Canvas del Workspace
     Dinámico (Fase 04).
   - **Relación con Backlog Ego:** `CORE-05`, `CANV-01`, `CANV-02`.
2. **`markdown-text.tsx` y suites de renderizado (`prose-safety`, `reasoning`, `filelinks`)**
   - **Qué hace:** Pipeline de markdown enriquecido y endurecido. Implementa bloques plegables para
     razonamiento/pensamiento del modelo (`<details>` o accordion), enlaces seguros a archivos locales con
     validación contra el sandbox, tablas responsive y protección contra inyección de HTML arbitrario.
   - **Adaptación en Ego:** Extracción del pipeline de procesamiento AST en
     `apps/desktop/renderer/components/assistant-ui/markdown-text.tsx`. **Corrección canónica (§9):** Ego NO adopta
     la exposición de chain-of-thought interno como requisito de UX. El patrón visual del accordion se adapta
     exclusivamente para **Explicabilidad, Evidencia y Auditoría ("¿Por qué?")**: fuentes consultadas en VantaDB,
     contexto inyectado, Sub-Egos y herramientas involucradas, incertidumbre y decisiones adoptadas.
   - **Relación con Backlog Ego:** `CORE-05`, `CANV-07`.
3. **`ask-directive.tsx`**
   - **Qué hace:** Interfaz visual para preguntas interactivas del agente al usuario (formularios inline, opciones
     múltiples, prompts de clarificación).
   - **Adaptación en Ego:** Base del sistema de Human-in-the-Loop (HITL) para solicitud de aclaraciones del Sub-Ego
     al usuario sin romper el streaming.
   - **Relación con Backlog Ego:** `ACT-04`, `ACT-05`.
4. **`message-render-boundary.tsx`**
   - **Qué hace:** Error boundary granular por cada mensaje individual en el hilo. Si un mensaje falla al renderizar
     (por ejemplo un widget de tool malformado), solo ese mensaje muestra un estado de error, sin colapsar toda la
     ventana de chat.
   - **Adaptación en Ego:** Implementación obligatoria en el Thread de `@assistant-ui/react` para tolerancia a fallos.
   - **Relación con Backlog Ego:** `CORE-05`, `REC-04`.

### Bloque B: Shell Desktop, Layout & Window Management ###

*Ubicación en fuente:* `repos-referencia/hermes-agent/apps/desktop/src/components/` y `apps/desktop/electron/`

1. **`pane-shell/` (Layout Shell de la Aplicación)**
   - **Qué hace:** Contenedor de paneles reajustables (split pane) con colapso suave, paneles laterales para árbol
     de proyectos/sesiones, panel central de chat y panel derecho de canvas/herramientas.
   - **Adaptación en Ego:** Estructura del Dynamic Workspace de Ego (`shell.tsx` y `workspace-layout.tsx`).
   - **Relación con Backlog Ego:** `CANV-01`.
2. **`model-picker.tsx` y `session-picker.tsx`**
   - **Qué hace:** Selectores desplegables con búsqueda difusa (`fuzzy.ts`), categorización por proveedor y badges de
     estado y costos.
   - **Adaptación en Ego:** Selector de modelos para el Model Router de Ego (`packages/models/`) y navegador de
     sesiones persistentes.
   - **Relación con Backlog Ego:** `CORE-03`, `CORE-04`.
3. **Hardening de Windows en Electron (`apps/desktop/electron/`)**
   - **Archivos fuente clave:**
     - `windows-sandbox-fallback.ts`: Detección de incompatibilidades de sandbox Chromium en ciertas
       configuraciones de Windows y resolución segura sin comprometer la máquina.
     - `windows-user-env.ts`: Ingesta correcta del PATH y variables de entorno del usuario en Windows (evita el bug
       clásico de Electron donde `PATH` no incluye `npm`, `git` o binarios de usuario instalados en
       `%USERPROFILE%\AppData\Local`).
     - `window-state.ts`: Persistencia de tamaño, posición y estado de pantalla (maximizada/minimizada) entre
       aperturas sin parpadeo.
     - `window-controls.ts`: Controles de ventana personalizados (minimizar, maximizar, cerrar) para ventanas
       frameless estilizadas.
   - **Adaptación en Ego:** Integración directa en el proceso Main de Electron de Ego (`apps/desktop/src/main.ts` y
     utilidades del sistema).
   - **Relación con Backlog Ego:** `CORE-01`, `CORE-02`, `DIST-01`.

### Bloque C: Protocolo, Comandos & UX Tools ###

*Ubicación en fuente:* `repos-referencia/hermes-agent/apps/shared/src/`

1. **`slash.ts` (Parser de Comandos Slash)**
   - **Qué hace:** Parser y autocompletado en el compositor para comandos rápidos (`/reset`, `/compact`, `/model`,
     `/skill`).
   - **Adaptación en Ego:** Soporte de comandos slash en el Composer de `@assistant-ui/react` para invocar Sub-Egos
     (`/subego`), cambiar modelos (`/model`) o activar herramientas de depuración.
   - **Relación con Backlog Ego:** `CORE-05`, `SUB-01`.
2. **`theme-presets.ts` y `translucency.ts`**
   - **Qué hace:** Manejo de paletas de color sobrias, contraste alto, soporte para translucidez nativa en Windows
     (Mica / Acrylic) y sincronización con las preferencias del sistema operativo.
   - **Adaptación en Ego:** Integración en el sistema de diseño TailwindCSS de Ego (ver §3 Regla B/N formalizada +
     `docs/design/design-system.md`). La translucidez nativa como efecto visual queda diferida (`HERM-26`); lo que se
     conserva es el **contrato compartido** main↔renderer.
   - **Relación con Backlog Ego:** `CORE-01`, `CANV-01`.

### Bloque D: Patrones de Ciclo de Vida de Memoria y Sesiones ###

*Ubicación en fuente:* `repos-referencia/hermes-agent/agent/memory_provider.py` y `hermes_state_*.py`

1. **Lifecycle de Memory Provider (`memory_provider.py`)**
   - **Qué hace:** Contrato formal de ciclo de vida: `initialize -> prefetch -> sync_turn -> shutdown`, más el
     indicador de recall determinista (`RecallStatus`, glyph 🧠) que informa al usuario cuántos recuerdos fueron
     inyectados en la conversación.
   - **Adaptación en Ego:** Incorporado en el contrato `EgoMemoryAdapter` y en la bandeja de contexto de Ego
     (`ContextBadge` en la UI), permitiendo al usuario ver exactamente qué fragmentos de VantaDB L0-L3 enriquecieron
     su turno.
   - **Relación con Backlog Ego:** `CORE-06`, `CORE-07`, `KB-03`.
2. **Timeline, Rewind y Health Checks (`hermes_state_timeline.py`, `hermes_state_rewind.py`, `hermes_state_health.py`)**
   - **Qué hace:** Historial inmutable de estados de sesión con capacidad de rebobinar (deshacer los últimos N turnos
     o regenerar desde un punto arbitrario) y verificación de integridad de la base de datos al arrancar.
   - **Adaptación en Ego:** Implementado sobre los namespaces de sesión en VantaDB (`session/*`) y el motor de
     checkpoints de tareas (Fase 07).
   - **Relación con Backlog Ego:** `CORE-07`, `REC-01`, `REC-02`.

### Bloque E: Resiliencia, Supervisión y Contratos Compartidos ###

*Ubicación en fuente:* `repos-referencia/hermes-agent/apps/desktop/electron/`, `apps/shared/src/`, `agent/` y `tools/`

1. **Supervisión del proceso de runtime (`backend-ownership.ts`, `backend-probes.ts`, `backend-exit-recovery.ts`)**
   - **Qué hace:** Identidad de proceso por `nonce` + `startMarker` (un PID reutilizado nunca se confunde con el
     anterior), ficha de propiedad con cuarentena de contenido ilegible, sondas de disponibilidad acotadas en el
     tiempo ("un fichero en disco no prueba un runtime usable") y un pestillo de reaparición con techo de
     reapariciones por ventana que detecta el *crash-loop*.
   - **Adaptación en Ego:** Contrato de supervisión para el subproceso cognitivo `vantadb-mcp` y el sidecar Python
     opcional, hoy inexistente en el repo (`EGO-FIND-29`).
   - **Relación con Backlog Ego:** `CORE-06`, `CORE-08`.
2. **Backoff de reconexión con *full jitter* (`reconnect-backoff.ts`)**
   - **Qué hace:** Escalera exponencial con jitter completo (AWS) y, sobre todo, la regla de que **una conexión que
     abre y muere dentro de 5 s cuenta como intento fallido**: reiniciar la escalera en cada "apertura" reconecta
     eternamente en el intento 0.
   - **Adaptación en Ego:** Reutilizar el backoff con jitter ya existente en `packages/models/src/ModelRouter.ts` y
     extenderlo al cliente MCP, que hoy no reconecta.
   - **Relación con Backlog Ego:** `ACT-09`, `ACT-11`, `CORE-03`.
3. **Escalera de failover con *cooldown* y `reset_at` del proveedor (`agent/fallback_cooldown.py`)**
   - **Qué hace:** Cooldown del primario de 60 s a 4 h, honrando el `reset_at` que declara el proveedor (convertido
     a duración para no mezclar reloj de pared con reloj monótono) y sin rearme cuando el fallo no viene del
     primario.
   - **Adaptación en Ego:** Complementar el pool de credenciales y la cadena de fallback de `ModelRouter` con
     semántica de 429 y de modelo rechazado.
   - **Relación con Backlog Ego:** `CORE-03`, `CORE-04`.
4. **Contrato de translucidez nativa compartido (`apps/shared/src/translucency.ts`)**
   - **Qué hace:** Un único módulo donde main y renderer coinciden en el significado del ajuste: sonda de capacidad
     por SO (fail-closed en Windows anterior a 22H2), mapeo **total** entre materiales para que un valor guardado en
     macOS resuelva en Windows, escalera por apariencia y aplicación **en la creación de la ventana** (una ventana con
     backing opaco no se puede cambiar a cristal después).
   - **Adaptación en Ego:** Patrón de módulo compartido a replicar cuando el design-system de Ego admita materiales
     del sistema.
   - **Relación con Backlog Ego:** `CANV-01`, `CORE-01`.
5. **Detección de instalación "rasgada" (`apps/desktop/electron/bundle-skew.ts`)**
   - **Qué hace:** Compara el *stamp* de build con el árbol de código y **solo** declara desincronización ante
     prueba positiva (el stamp debe ser ancestro de HEAD); por diseño falla en silencio cuando no hay stamp, el
     commit es desconocido o no es ancestro, porque un falso positivo afirma al usuario que su instalación está
     rota.
   - **Adaptación en Ego:** Guardia de desincronización de versiones para la/update de Electron en la Fase 12.
   - **Relación con Backlog Ego:** `DIST-01`, `DIST-03`.
6. **Gobernanza de la aprobación (`tools/approval_detection.py`, `tools/approval.py`)**
   - **Qué hace:** Distingue un *floor* de comandos sin vía de recuperación (incondicional, por debajo de cualquier
     modo permisivo) de las operaciones destructivas pero recuperables (que sí pasan por aprobación), y añade un
     **disyuntor de denegaciones consecutivas** que, tras N veredictos de denegación, escala el mensaje a parada
     forzada mutando solo el texto del resultado de herramienta (invariante de caché de prompt).
   - **Adaptación en Ego:** El *floor* ya es canónico en Ego (`ToolPermissions`); el disyuntor de denegaciones no
     existe y es el hueco real.
   - **Relación con Backlog Ego:** `ACT-06`, `ACT-07`, `SEC-05`.
7. **Invariante de caché de prompt (`AGENTS.md:20` de la raíz del clon, `agent/prompt_builder.py`)**
   - **Qué hace:** El prompt caching por conversación es inviolable: el system prompt es byte-estable de por vida, la
     **única** mutación sancionada es la compactación, y todo lo que deba inyectarse a mitad de conversación viaja
     como mensaje de usuario o resultado de herramienta, nunca mutando el system prompt.
   - **Adaptación en Ego:** Ya implementado y cableado (`packages/runtime/src/types.ts:258-263`,
     `packages/runtime/src/ToolExecutionLoop.ts:273-296`, `packages/subegos/src/PromptAssembly.ts:384-396`).
   - **Relación con Backlog Ego:** `CORE-05`, `CORE-12`.

### Regla B/N formalizada (D9, decisión owner 2026-10-14) ###

La "interfaz sobria B/N" citada en el Bloque C queda definida formalmente (cierra la cita huérfana):

- **Base monocromática funcional:** superficies en escala neutra (`bg-paper/panel/raised`, `text-ink/faint/dim`,
  `border-hairline`).
- **Color solo con significado:** accent ámbar `#f59e0b` para marca/acción primaria; emerald/amber/rose/cyan/purple
  exclusivamente para estados semánticos; cero decoración cromática.
- **Dark-only:** sin tema claro en P0 (`UserPrefs.theme` = futuro documentado).
- Fuente vigente: `docs/design/design-system.md` §§1–2.

---

## 3. Matriz de Extracción vs Descarte ##

| Componente Hermes | Acción en Ego | Razón Técnica / Arquitectónica |
| --- | :---: | --- |
| `apps/desktop/src/components/assistant-ui/*` | **EXTRAER & ADAPTAR** | Gemelo directo de stack; aceleración inmediata de 3-4 semanas de trabajo de UI. |
| `apps/desktop/electron/windows-*.ts` | **EXTRAER & ADAPTAR** | Solución probada a fallos recurrentes de Electron en Windows (PATH, sandbox, frameless). |
| `apps/shared/src/slash.ts` | **EXTRAER & ADAPTAR** | Parser desacoplado y reutilizable para autocompletado en el compositor. |
| `agent/memory_provider.py` | **EXTRAER PATRÓN** | Adoptar el concepto de ciclo de vida e indicador de recall; descartar implementación Python. |
| `hermes_state_*.py` | **EXTRAER PATRÓN** | Traducir semántica de timeline y rewind a operaciones de VantaDB Fjall LSM; no usar SQLite. |
| `apps/desktop/packaging/*` | **EXTRAER & ADAPTAR** | Configuración de Electron Builder probada con auto-update para Windows y macOS. |
| `apps/desktop/electron/backend-{ownership,probes,exit-recovery}.ts` | **EXTRAER PATRÓN** | Contrato de supervisión de un runtime hijo; aplicable al subproceso cognitivo `vantadb-mcp` (`HERM-23`). |
| `agent/*.py` (Core Agent Loop) | **DESCARTAR** | Ego tiene su propio Cognitive Runtime en TypeScript con AI SDK v7 y Model Router. |
| Python virtualenv / poetry / uv | **DESCARTAR** | Prohibido en P0. Ego es 100% autónomo con Node.js 22 y binario napi-rs VantaDB. |
| Servidor WebSockets JSON-RPC | **DESCARTAR** | Reemplazado por canales IPC seguros de Electron con validación tipada. |

---

## 4. Nuevas Capacidades Evaluadas e Incorporadas (RFCs de Categoría 2) ##

Derivado de la investigación profunda (local en `repos-referencia/hermes-agent/` y online en el ecosistema oficial de
Nous Research feb-2026), se evaluaron e incorporaron formalmente los siguientes patrones como mejoras controladas para
Ego (ver detalle en [`docs/research/hermes-agent-deep-dive.md`](../research/hermes-agent-deep-dive.md)):

1. **RFC-01: Aislamiento de Sub-Egos con Git Worktrees (`tools/subagent_worktree.py`)**
   - **Incorporación en Ego:** Asignado a `SUB-07` (Fase 03: Sub-Egos). Los Sub-Egos de Ingeniería trabajan en un
     `git worktree` temporal (`.ego/worktrees/<id>`) para no tocar los archivos del usuario en vivo ni romper
     compilaciones activas.
2. **RFC-02: Kernel de Ejecución Zero-Context RPC (`tools/code_execution_rpc.py`)**
   - **Incorporación en Ego:** Asignado a `ACT-07` (Fase 02: Acción & Tools). Permite que el modelo emita scripts que
     encadenan herramientas locales sin gastar múltiples turnos ni miles de tokens de contexto, ejecutándose en un
     worker thread seguro (`node:vm`).
3. **RFC-03: Auditoría AST y Linter de Skills (`tools/skills_ast_audit.py`)**
   - **Incorporación en Ego:** Asignado a `SUB-05` (Fase 03: Sub-Egos). Audita el código de herramientas generadas
     dinámicamente mediante el AST de TypeScript/Babel para bloquear inyecciones maliciosas antes de su registro.
   - **Implementación real (verificada 2026-10-19):** `packages/integrations/src/skills/SkillLinter.ts:82` (clase
     `SkillLinter`, `lintManifest`, `SkillSecurityLevel`), instanciado por
     `packages/integrations/src/skills/SkillScanner.ts:32` y en producción en `apps/desktop/src/main.ts:11,2198`.
     La ficha anterior no citaba ruta de fichero.
4. **RFC-04: Snapshots Previos a Escrituras Destructivas (`tools/file_tools_write_guards.py`)**
   - **Incorporación en Ego:** Asignado a `ACT-06` (Fase 02) y `REC-01` (Fase 10). Conectado directamente a las
     transacciones y cuarentena de VantaDB Fjall LSM para rollback instantáneo (`/undo`).

---

## 5. Estado real verificado (2026-10-20) — Ola 2 de remediación (A5) ##

> Fuente canónica del estado por tarea: [`docs/review/backlog-hermes.md`](../review/backlog-hermes.md).
> Criterio de cierre: fichero adaptado **y** caller en producción (grep sobre `packages/` +
> `apps/desktop/`, excluyendo `test/`, `dist/` y `node_modules/`).

Verificación de partida sobre `packages/` + `apps/desktop/` (excluye `test/`, `dist/`, `node_modules/`):

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
```

| ID | Patrón | Estado | Evidencia / Fundamento |
| --- | --- | :---: | --- |
| `HERM-01` | `artifact-card.tsx` | ✅ Completada | `renderer/components/assistant-ui/artifact-card.tsx` → `markdown-text.tsx:4` → `ego-chat.tsx:42` (`MarkdownText`). Corregida la línea del import (`:43` → `:42`). |
| `HERM-02` | `markdown-text.tsx` | ✅ Completada | `markdown-text.tsx` → `ego-chat.tsx:42`. Corregida la línea del import (`:43` → `:42`). |
| `HERM-03` | `ask-directive.tsx` | ✅ Completada | `ask-directive.tsx` → `markdown-text.tsx:5` → `ego-chat.tsx:42`. |
| `HERM-04` | `message-render-boundary.tsx` | ✅ Completada | `message-render-boundary.tsx` → `ego-chat.tsx:43`. Corregida la línea del import (`:44` → `:43`). |
| `HERM-05` | `ansi-text.tsx` | ✅ Completada | `packages/ui-runtime/src/AnsiParser.ts` → `renderer/components/assistant-ui/ansi-text.tsx:2` → `markdown-text.tsx:3` → `ego-chat.tsx:42`. |
| `HERM-06` | `windows-user-env.ts` | 🆕 Pendiente | `packages/recovery/src/WindowsUserEnv.ts` sin caller (única referencia: `packages/recovery/src/index.ts:10`). Cablear en el arranque de Electron antes de `app.whenReady()` (owner A4). |
| `HERM-07` | `windows-sandbox-fallback.ts` | 🆕 Pendiente | `packages/recovery/src/WindowsSandboxFallback.ts` sin caller (única referencia: `packages/recovery/src/index.ts:11`). Cablear en el arranque de Electron (owner A4). |
| `HERM-08` | `window-state.ts` | 🆕 Pendiente | `packages/ui-runtime/src/WindowState.ts:31` (`WindowStateHelper`) sin caller; `apps/desktop/src/windows/WindowStateManager.ts` reimplementa la lógica. **Divergencia documentada.** |
| `HERM-09` | `pane-shell/` | ✅ Completada | `renderer/components/PaneShell.tsx` → `App.tsx:9` (import) y `:361` (montaje). Corregida la evidencia: `Sidebar.tsx:39` solo notifica el colapso, no monta el `SplitPane`. |
| `HERM-10` | `model-picker.tsx` | ✅ Completada | `packages/ui-runtime/src/FuzzySearch.ts` (`fuzzyRank`) → `ModelPicker.tsx:3,162` → `App.tsx:8` (import) y `:349` (montaje). Corregida la línea de montaje (`:338` → `:349`). |
| `HERM-11` | `session-picker.tsx` | ✅ Completada | `SessionPicker.tsx:3` → `Sidebar.tsx:23,792`. |
| `HERM-12` | `slash.ts` | 🚫 **Descartada (con justificación)** | `packages/ui-runtime/src/SlashCommandParser.ts` sin caller; el Composer usa `renderer/components/composer-slash.ts:15,21` (`LOCAL_SLASH_COMMANDS`, `parseSlashCommand`), importado en `ego-chat.tsx:38`. Dos parsers = ambigüedad sobre el canónico. El duplicado **persiste** (verificado 2026-10-20). |
| `HERM-13` | Ciclo de vida de memoria | ✅ Completada | `packages/memory/EgoMemoryLifecycle.ts` → `main.ts:7` (import), `main.ts:1958` (`new EgoMemoryLifecycle(adapter)`), `main.ts:738` (`getLifecycle()`); uso en `main.ts:1487,1586,1775,1959,1975` y `register-ipc.ts:2100,2123`. Corregidas las líneas citadas (`:9,2920,773` → `:7,1958,738`). |
| `HERM-14` | Timeline / rewind | 🆕 Pendiente | `packages/memory/SessionTimelineRewind.ts` sin caller (única referencia: `packages/memory/index.ts:15`). Cablear desde el IPC de sesión (owner A2). |
| `HERM-15` | Health check de almacenamiento | 🆕 Pendiente | `packages/recovery/src/StorageHealthLatch.ts:42` sin caller (única referencia: `packages/recovery/src/index.ts:12`). Cablear en `CrashRecoveryEngine` (owner A3). |
| `HERM-16` | Packaging / auto-update | ✅ Completada | `apps/desktop/electron-builder.config.cjs:22` (`asarUnpack` de `*.node`), verificado por `apps/desktop/scripts/verify-dist.cjs:59-63` y `smoke-native-packaged.cjs:79-81`. |
| `HERM-17` | Git worktrees (RFC-01) | 🆕 Pendiente | **Revertido en Ola 2.** `packages/subegos/src/SubEgoWorktree.ts:139` (`createWorktree`) y `packages/domains/src/engineering/WorktreeManager.ts:161` **no tienen caller de producción**: `EngineeringDomain.createWorktree` (`packages/domains/src/engineering/EngineeringDomain.ts:235`) no se invoca desde `apps/`, y `register-ipc.ts:1654` solo llama a `listWorktrees` (lectura). Sí está en producción la **mitad de limpieza**: `main.ts:1278` instancia `SubEgoWorktreeManager` y `main.ts:1281-1284` cablea `pruneOrphanWorktrees` en el `MemoryCleanupJob`. Cablear `createWorktree` en la ruta de delegación de Sub-Egos (owner A2/A4). |
| `HERM-18` | Zero-Context RPC (RFC-02) | 🚫 **Descartada (con justificación)** | `packages/execution/src/ZeroContextKernel.ts:165` sin caller y en tensión con el principio 6: la granularidad de aprobación HITL la impone el `ApprovalEngine` por tool call y no un kernel que encadena llamadas sin turnos de modelo. |
| `HERM-19` | AST lint de skills (RFC-03) | ✅ Completada | `packages/integrations/src/skills/SkillLinter.ts:82` → `SkillScanner.ts:4,32` → `main.ts:11` (import), `main.ts:2198` (`new SkillScanner()`) → `register-ipc.ts:756` (`skillScanner.scan`). Corregidas las líneas citadas (`:23,3101` → `:11,2198`). |
| `HERM-20` | Hot palette `/` | ✅ Completada | `renderer/components/omnibar.tsx` → `App.tsx:4` (import) y `:717` (`<Omnibar />`); `Sidebar.tsx:27,545,581`. Corregida la línea de montaje (`:630` → `:717`). |
| `HERM-21` | Visualizador de tokens/coste | ✅ Completada | `renderer/components/daily-state/MetricsConsole.tsx:18` (`toTurnUsage`) → `ego-chat.tsx:44` (import) y `:1114` (uso) → `DailyDashboard.tsx:572`. Corregida la línea del import (`:45` → `:44`). Fuente real: `hermes_state_usage.py` (columnas `estimated_cost_usd` / `actual_cost_usd` / `cost_status`), **no** `agent/token_counter.py` ni `cost_tracker.py` (esos ficheros no existen en el clon). |
| `HERM-22` | Gateways de mensajería | ⏳ Futura (P1) | Requiere canal de red saliente + relay stateless, no implementados. |
| `HERM-23` | Supervisión del proceso de runtime | ⏳ Futura (Fase 01) | Nuevo. Fuente: `apps/desktop/electron/backend-ownership.ts:1-13,45`, `backend-probes.ts:1,9`, `backend-exit-recovery.ts:17-24,33-37`. Ego tiene el subproceso cognitivo `vantadb-mcp` documentado pero **sin invocar** (`EGO-FIND-29`): sin identidad por `nonce`/`startMarker`, ni sonda de disponibilidad, ni pestillo de reaparición, un motor muerto deja la UI viva sin motor. |
| `HERM-24` | Backoff de reconexión con jitter | ⏳ Futura (Fase 02) | Nuevo. Fuente: `apps/shared/src/reconnect-backoff.ts:33,36,51`. Ego tiene backoff con jitter solo para rotación de credenciales (`packages/models/src/ModelRouter.ts:63,692`); el cliente MCP (`packages/integrations/src/mcp/McpClient.ts:443`) no reconecta y no distingue "apertura inestable" de "conexión estable". |
| `HERM-25` | Cooldown de failover por proveedor | ⏳ Futura (Fase 05) | Nuevo. Fuente: `agent/fallback_cooldown.py:24-42,45-76`. Ego rota credenciales y encadena fallback (`packages/models/src/ModelRouter.ts:729-789`) pero no honra `reset_at` del proveedor ni el reloj monótono frente al de pared. |
| `HERM-26` | Translucencia nativa con contrato compartido | ⏳ Futura (Fase 04) | Nuevo. Fuente: `apps/shared/src/translucency.ts:61,99,211,350,444`. Ego no tiene Mica/Acrylic/vibrancy (`grep "Mica\|Acrylic\|vibrancy"` → 0 en `packages/` y `apps/desktop/`); requiere decisión explícita del owner frente a la Regla B/N. |
| `HERM-27` | Detección de instalación rasgada | ⏳ Futura (Fase 12) | Nuevo. Fuente: `apps/desktop/electron/bundle-skew.ts:44-55,71-80`. Ego tiene `electron-builder.config.cjs` (`HERM-16`) pero ninguna guardia que detecte bundle y runtime desincronizados tras un update parcial. |
| `HERM-28` | Floor de aprobación no-anulable | 🚫 **Descartada (con justificación)** | Nuevo, pero ya canónico en Ego: `packages/security/src/ToolPermissions.ts:277-285` (`BLOCKED_COMMAND_PATTERNS`) deniega **antes** de la aprobación y "deny gana" sobre `defaultMode: allow` (`:266-269`); `SEC-05` ya está cerrada. No hay nada que asimilar. |
| `HERM-29` | Invariante de caché de prompt | ✅ Completada | Nuevo. Fuente: `repos-referencia/hermes-agent/AGENTS.md:20` y `agent/prompt_builder.py`, `agent/context_compressor.py`. Ego ya lo impone: `packages/runtime/src/types.ts:258-263` (`SystemPromptRebuildReason = "session_start" \| "compression"`), enforcement en `packages/runtime/src/ToolExecutionLoop.ts:273-296` (rechaza el turno sin llamar al modelo si el prefijo cambia) y overlay efímero que no muta el prefijo en `packages/subegos/src/PromptAssembly.ts:384-396`, con caller de producción en `apps/desktop/src/main.ts:24,1437`. |
| `HERM-30` | Disyuntor de denegaciones consecutivas | ⏳ Futura (Fase 02) | Nuevo. Fuente: `tools/approval.py:59-67,77-86,94-112`. Ego tiene circuit breaker por **fallo** de herramienta (`packages/execution/src/CircuitBreaker.ts:105`) pero ningún contador de **denegaciones** del usuario en `packages/execution/src/ApprovalEngine.ts:115`: un bucle de reintentos sobre la misma acción denegada consume turnos y paciencia sin tope. |

**Recuento:** 14 `✅ Completada` · 3 `🚫 Descartada` · 6 `🆕 Pendiente` · 7 `⏳ Futura` — **30 tareas**.

---

## 6. Descarte de componente — normalizado a la forma canónica (2026-10-20) ##

Las filas de la matriz §3 usaban la forma `**DESCARTAR**`; se normalizan aquí a
`🚫 Descartada (con justificación)` (AGENTS.md §4) conservando el motivo original:

| Componente Hermes | Veredicto | Fundamento |
| --- | :---: | --- |
| `agent/*.py` (Core Agent Loop) | 🚫 **Descartada (con justificación)** | Ego tiene su propio Cognitive Runtime en TypeScript con AI SDK v7 y Model Router. |
| Python virtualenv / poetry / uv | 🚫 **Descartada (con justificación)** | Prohibido en P0. Ego es 100 % autónomo con Node.js 22 y binario napi-rs VantaDB. |
| Servidor WebSockets JSON-RPC | 🚫 **Descartada (con justificación)** | Reemplazado por canales IPC seguros de Electron con validación tipada (`contextIsolation=true`). |
| SQLite relacional (`hermes_state_*.py`) | 🚫 **Descartada (con justificación)** | DESCARTAR SQLite. Ego utiliza `NativeVantaDB` como sustrato soberano; solo se extraen los patrones lógicos de sesiones/timeline/rewind (`HERM-14`). |

> Estado por tarea y detalle de cableado: [backlog-hermes.md](../review/backlog-hermes.md). Catálogo de extracciones:
> [README.md](./README.md).
