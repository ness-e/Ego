# Extracción Técnica: Hermes Agent (repos-referencia/hermes-agent)

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de patrones |
| Repositorio Origen | `repos-referencia/hermes-agent/` (Commit verificado: oct-2026) |
| Stack del Origen | Electron 40 + React 19 + TypeScript + Vite + `@assistant-ui/react` + TailwindCSS + Python 3.11 Backend (FastAPI/JSON-RPC/SQLite) |
| Rol en Ego | Gemelo de Stack Desktop / UI & Shell Reference |
| Owner | ness-e |
| Fecha | 2026-10-07 |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia

`hermes-agent` es el repositorio de referencia más relevante para la capa de **Presentación, Shell Desktop y Componentes de Chat de Ego** debido a que comparte el mismo frontend y runtime de interfaz:
* **Electron 40 + React 19 + TypeScript strict + Vite**
* Integración profunda con **`@assistant-ui/react`**
* Sistema de diseño monocromático, sobrio y funcional

### Divergencias Fundamentales (Qué Descartamos y Por Qué)

| Dimensión | Hermes Agent | Ego (Cognitive OS) | Decisión Crítica |
|---|---|---|---|
| **Backend Runtime** | Proceso secundario en Python (`agent/`, `gateway/`, `cli.py`) levantado como subprocess. | Node.js 22 en el proceso Main de Electron (`apps/desktop/src/main.ts`). | **DESCARTAR backend Python**. Ego ejecuta su Cognitive Runtime directamente en Node 22 in-process. Python en Ego queda confinado a sidecar opcional para ingesta pesada en P1. |
| **Persistencia** | SQLite relacional con FTS (`hermes_state_*.py`). | VantaDB 0.8.0 nativo in-process (`NativeVantaDB` vía napi-rs) + Fjall LSM + HNSW + BM25 + ONNX embeddings. | **DESCARTAR SQLite**. Ego utiliza `NativeVantaDB` como sustrato soberano. Solo extraemos los patrones lógicos de sesiones/timeline/rewind. |
| **Comunicación Main ↔ UI** | JSON-RPC 2.0 sobre WebSockets o HTTP local. | IPC nativo fuertemente tipado de Electron (`ipcMain` / `ipcRenderer` con `contextBridge`). | **ADAPTAR**. No levantamos sockets TCP/HTTP internos para UI local; usamos el bus IPC seguro con `contextIsolation=true`. |

---

## 2. Inventario Quirúrgico de Patrones a Extraer

### Bloque A: Primitivas y Componentes `@assistant-ui/react`
*Ubicación en fuente:* `repos-referencia/hermes-agent/apps/desktop/src/components/assistant-ui/`

1. **`artifact-card.tsx`**
   - **Qué hace:** Renderizado interactivo de artefactos generados por el modelo (código, documentos markdown, previsualizaciones HTML) fuera del flujo lineal de texto, con acciones de copiar, maximizar, exportar y versionado.
   - **Adaptación en Ego:** Es la base para el componente de tarjetas de artefactos en el Chat de Ego (`apps/desktop/renderer/components/artifact-card.tsx`), enlazándolo con el Canvas del Workspace Dinámico (Fase 04).
   - **Relación con Backlog Ego:** `CORE-05`, `CANV-01`, `CANV-02`.

2. **`markdown-text.tsx` & suites de renderizado (`prose-safety`, `reasoning`, `filelinks`)**
   - **Qué hace:** Pipeline de markdown enriquecido y endurecido. Implementa bloques plegables para razonamiento/pensamiento del modelo (`<details>` o accordion), enlaces seguros a archivos locales con validación contra el sandbox, tablas responsive y protección contra inyección de HTML arbitrario.
   - **Adaptación en Ego:** Extracción del pipeline de procesamiento AST en `apps/desktop/renderer/components/markdown-renderer.tsx`. **Corrección canónica (§9):** Ego NO adopta la exposición de chain-of-thought interno como requisito de UX. El patrón visual del accordion se adapta exclusivamente para **Explicabilidad, Evidencia y Auditoría ("¿Por qué?")**: fuentes consultadas en VantaDB, contexto inyectado, Sub-Egos y herramientas involucradas, incertidumbre y decisiones adoptadas.
   - **Relación con Backlog Ego:** `CORE-05`, `CANV-07`.

3. **`ask-directive.tsx`**
   - **Qué hace:** Interfaz visual para preguntas interactivas del agente al usuario (formularios inline, opciones múltiples, prompts de clarificación).
   - **Adaptación en Ego:** Base del sistema de Human-in-the-Loop (HITL) para solicitud de aclaraciones del Sub-Ego al usuario sin romper el streaming.
   - **Relación con Backlog Ego:** `ACT-04`, `ACT-05`.

4. **`message-render-boundary.tsx`**
   - **Qué hace:** Error boundary granular por cada mensaje individual en el hilo. Si un mensaje falla al renderizar (por ejemplo un widget de tool malformado), solo ese mensaje muestra un estado de error, sin colapsar toda la ventana de chat.
   - **Adaptación en Ego:** Implementación obligatoria en el Thread de `@assistant-ui/react` para tolerancia a fallos.
   - **Relación con Backlog Ego:** `CORE-05`, `REC-04`.

---

### Bloque B: Shell Desktop, Layout & Window Management
*Ubicación en fuente:* `repos-referencia/hermes-agent/apps/desktop/src/components/` y `electron/`

1. **`pane-shell/` (Layout Shell de la Aplicación)**
   - **Qué hace:** Contenedor de paneles reajustables (split pane) con colapso suave, paneles laterales para árbol de proyectos/sesiones, panel central de chat y panel derecho de canvas/herramientas.
   - **Adaptación en Ego:** Estructura del Dynamic Workspace de Ego (`shell.tsx` y `workspace-layout.tsx`).
   - **Relación con Backlog Ego:** `CANV-01`.

2. **`model-picker.tsx` y `session-picker.tsx`**
   - **Qué hace:** Selectores desplegables con búsqueda difusa (`fuzzy.ts`), categorización por proveedor y badges de estado y costos.
   - **Adaptación en Ego:** Selector de modelos para el Model Router de Ego (`packages/models/`) y navegador de sesiones persistentes.
   - **Relación con Backlog Ego:** `CORE-03`, `CORE-04`.

3. **Hardening de Windows en Electron (`apps/desktop/electron/`)**
   - **Archivos fuente clave:**
     - `windows-sandbox-fallback.ts`: Detección de incompatibilidades de sandbox Chromium en ciertas configuraciones de Windows y resolución segura sin comprometer la máquina.
     - `windows-user-env.ts`: Ingesta correcta del PATH y variables de entorno del usuario en Windows (evita el bug clásico de Electron donde `PATH` no incluye `npm`, `git` o binarios de usuario instalados en `%USERPROFILE%\AppData\Local`).
     - `window-state.ts`: Persistencia de tamaño, posición y estado de pantalla (maximizada/minimizada) entre aperturas sin parpadeo.
     - `window-controls.ts`: Controles de ventana personalizados (minimizar, maximizar, cerrar) para ventanas frameless estilizadas.
   - **Adaptación en Ego:** Integración directa en el proceso Main de Electron de Ego (`apps/desktop/src/main.ts` y utilidades del sistema).
   - **Relación con Backlog Ego:** `CORE-01`, `CORE-02`, `DIST-01`.

---

### Bloque C: Protocolo, Comandos & UX Tools
*Ubicación en fuente:* `repos-referencia/hermes-agent/apps/shared/src/`

1. **`slash.ts` (Parser de Comandos Slash)**
   - **Qué hace:** Parser y autocompletado en el compositor para comandos rápidos (`/reset`, `/compact`, `/model`, `/skill`).
   - **Adaptación en Ego:** Soporte de comandos slash en el Composer de `@assistant-ui/react` para invocar Sub-Egos (`/subego`), cambiar modelos (`/model`) o activar herramientas de depuración.
   - **Relación con Backlog Ego:** `CORE-05`, `SUB-01`.

2. **`theme-presets.ts` y `translucency.ts`**
   - **Qué hace:** Manejo de paletas de color sobrias, contraste alto, soporte para translucidez nativa en Windows (Mica / Acrylic) y sincronización con las preferencias del sistema operativo.
   - **Adaptación en Ego:** Integración en el sistema de diseño TailwindCSS de Ego (cumpliendo la regla de interfaz sobria B/N de `docs/product/ux-ui.md`).
   - **Relación con Backlog Ego:** `CORE-01`, `CANV-01`.

---

### Bloque D: Patrones de Ciclo de Vida de Memoria y Sesiones
*Ubicación en fuente:* `repos-referencia/hermes-agent/agent/memory_provider.py` y `hermes_state_*.py`

1. **Lifecycle de Memory Provider (`memory_provider.py`)**
   - **Qué hace:** Contrato formal de ciclo de vida: `initialize -> prefetch -> sync_turn -> shutdown`, más el indicador de recall determinista (`RecallStatus`, glyph 🧠) que informa al usuario cuántos recuerdos fueron inyectados en la conversación.
   - **Adaptación en Ego:** Incorporado en el contrato `EgoMemoryAdapter` y en la bandeja de contexto de Ego (`ContextBadge` en la UI), permitiendo al usuario ver exactamente qué fragmentos de VantaDB L0-L3 enriquecieron su turno.
   - **Relación con Backlog Ego:** `CORE-06`, `CORE-07`, `KB-03`.

2. **Timeline, Rewind y Health Checks (`hermes_state_timeline.py`, `hermes_state_rewind.py`, `hermes_state_health.py`)**
   - **Qué hace:** Historial inmutable de estados de sesión con capacidad de rebobinar (deshacer los últimos N turnos o regenerar desde un punto arbitrario) y verificación de integridad de la base de datos al arrancar.
   - **Adaptación en Ego:** Implementado sobre los namespaces de sesión en VantaDB (`session/*`) y el motor de checkpoints de tareas (Fase 07).
   - **Relación con Backlog Ego:** `CORE-07`, `REC-01`, `REC-02`.

---

## 3. Matriz de Extracción vs Descarte

| Componente Hermes | Acción en Ego | Razón Técnica / Arquitectónica |
|---|:---:|---|
| `apps/desktop/src/components/assistant-ui/*` | **EXTRAER & ADAPTAR** | Gemelo directo de stack; aceleración inmediata de 3-4 semanas de trabajo de UI. |
| `apps/desktop/electron/windows-*.ts` | **EXTRAER & ADAPTAR** | Solución probada a fallos recurrentes de Electron en Windows (PATH, sandbox, frameless). |
| `apps/shared/src/slash.ts` | **EXTRAER & ADAPTAR** | Parser desacoplado y reutilizable para autocompletado en el compositor. |
| `agent/memory_provider.py` | **EXTRAER PATRÓN** | Adoptar el concepto de ciclo de vida e indicador de recall; descartar implementación Python. |
| `hermes_state_*.py` | **EXTRAER PATRÓN** | Traducir semántica de timeline y rewind a operaciones de VantaDB Fjall LSM; no usar SQLite. |
| `apps/desktop/packaging/*` | **EXTRAER & ADAPTAR** | Configuración de Electron Builder probada con auto-update para Windows y macOS. |
| `agent/*.py` (Core Agent Loop) | **DESCARTAR** | Ego tiene su propio Cognitive Runtime en TypeScript con AI SDK v7 y Model Router. |
| Python virtualenv / poetry / uv | **DESCARTAR** | Prohibido en P0. Ego es 100% autónomo con Node.js 22 y binario napi-rs VantaDB. |
| Servidor WebSockets JSON-RPC | **DESCARTAR** | Reemplazado por canales IPC seguros de Electron con validación tipada. |

---

## 4. Nuevas Capacidades Evaluadas e Incorporadas (RFCs de Categoría 2)

Derivado de la investigación profunda (local en `repos-referencia/hermes-agent/` y online en el ecosistema oficial de Nous Research feb-2026), se evaluaron e incorporaron formalmente los siguientes patrones como mejoras controladas para Ego (ver detalle en [`docs/research/hermes-agent-deep-dive.md`](../research/hermes-agent-deep-dive.md)):

1. **RFC-01: Aislamiento de Sub-Egos con Git Worktrees (`tools/subagent_worktree.py`)**
   - **Incorporación en Ego:** Asignado a `SUB-07` (Fase 03: Sub-Egos). Los Sub-Egos de Ingeniería trabajan en un `git worktree` temporal (`.ego/worktrees/<id>`) para no tocar los archivos del usuario en vivo ni romper compilaciones activas.
2. **RFC-02: Kernel de Ejecución Zero-Context RPC (`tools/code_execution_rpc.py`)**
   - **Incorporación en Ego:** Asignado a `ACT-07` (Fase 02: Acción & Tools). Permite que el modelo emita scripts que encadenan herramientas locales sin gastar múltiples turnos ni miles de tokens de contexto, ejecutándose en un worker thread seguro (`node:vm`).
3. **RFC-03: Auditoría AST y Linter de Skills (`tools/skills_ast_audit.py`)**
   - **Incorporación en Ego:** Asignado a `SUB-05` (Fase 03: Sub-Egos). Audita el código de herramientas generadas dinámicamente mediante el AST de TypeScript/Babel para bloquear inyecciones maliciosas antes de su registro.
4. **RFC-04: Snapshots Previos a Escrituras Destructivas (`tools/file_tools_write_guards.py`)**
   - **Incorporación en Ego:** Asignado a `ACT-06` (Fase 02) y `REC-01` (Fase 10). Conectado directamente a las transacciones y cuarentena de VantaDB Fjall LSM para rollback instantáneo (`/undo`).
