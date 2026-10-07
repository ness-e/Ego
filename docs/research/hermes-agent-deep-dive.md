# Deep Dive Técnico: Hermes Agent (Nous Research)
### Análisis de Capacidades, Ecosistema Online, Evaluación Crítica y Matriz de Incorporación en Ego

| Campo | Valor |
| --- | --- |
| Estado | Canónico — Documento de investigación técnica profunda (Local + Online) |
| Repositorio Local | `repos-referencia/hermes-agent/` (Commit verificado: oct-2026) |
| Fuentes Online Oficiales | `hermes-agent.nousresearch.com` · `portal.nousresearch.com` · Nous Research (Lanzamiento Feb-2026) · `agentskills.io` |
| Autor / Organización | Nous Research |
| Licencia | MIT |
| Rol del Evaluador | Ingeniero Principal de Sistemas & Analista Crítico |
| Fecha de Actualización | 2026-10-07 |

---

## 1. Resumen Ejecutivo y Ecosistema Global (Online + Local)

Lanzado oficialmente por **Nous Research en febrero de 2026**, **Hermes Agent** se posiciona como el primer framework de agentes de IA de código abierto con un **Closed Learning Loop** (bucle cerrado de auto-mejora continua), rompiendo con el paradigma de los "agentes amnésicos" que olvidan todo al cerrar la sesión.

El ecosistema de Hermes se compone de tres pilares interconectados:
1. **Hermes Core & Desktop:** Aplicación desktop multiplataforma (macOS, Windows, Linux) desarrollada exactamente sobre el stack elegido para Ego: **Electron 40 + React 19 + TypeScript strict + `@assistant-ui/react` + Vite + TailwindCSS**.
2. **Closed Learning Loop & Skills Hub:** Sistema de memoria procedural compatible con el estándar abierto `agentskills.io`, donde el agente extrae habilidades de sus tareas exitosas, las compila, las audita sintácticamente y las mejora de forma autónoma.
3. **Nous Portal & Tool Gateway:** Infraestructura unificada en la nube que elimina el "síndrome de fatiga de API keys". A través de una sola suscripción, provee acceso a más de 300 modelos frontier y un Tool Gateway gestionado (búsqueda web de grado agente, browser headless en la nube, generación de imágenes FLUX 2 y síntesis TTS), permitiendo alternar con BYOK (Bring Your Own Key) en cualquier momento.

---

## 2. Taxonomía de Capacidades: Lo que Hermes Ofrece

A través de la investigación cruzada (análisis estático de los 300+ archivos locales en `repos-referencia/hermes-agent/` y la documentación técnica oficial online), se identifican las siguientes capacidades clave:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    ARQUITECTURA DE CAPACIDADES HERMES AGENT                  │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ 1. Closed Learning Loop & Skills     │ 5. Desktop Shell & Assistant-UI       │
│    · Auto-creación de skills         │    · Artifact Cards con pestañas      │
│    · Auditoría AST con linter        │    · Markdown AST con reasoning       │
│    · Dialectic User Modeling (Honcho)│    · Hardening de Electron en Windows │
├──────────────────────────────────────┼───────────────────────────────────────┤
│ 2. Zero-Context Code Execution       │ 6. Omnichannel Messaging Gateway      │
│    · Kernel RPC local en Python      │    · Telegram, Slack, Discord, Signal │
│    · Colapso de multi-step turns     │    · Apple iMessage (BlueBubbles)     │
│    · Snapshot previo a modificaciones│    · API REST OpenAI-compatible       │
├──────────────────────────────────────┼───────────────────────────────────────┤
│ 3. Aislamiento de Subagentes         │ 7. Context Engineering & MoA          │
│    · Git Worktrees dedicados         │    · Prompt caching boundaries        │
│    · Streaming de logs en vivo       │    · Mixture-of-Agents (debates)      │
│    · Esquemas tipados de retorno     │    · Micro y macro compactación       │
├──────────────────────────────────────┼───────────────────────────────────────┤
│ 4. 7 Terminal Backends               │ 8. Proactividad & Background          │
│    · Local PTY, Docker, SSH, HPC     │    · Cron scheduler en lenguaje nat.  │
│    · Daytona / Modal (serverless $0) │    · Process supervisor asíncrono     │
│    · Vercel AI Sandbox               │    · Curator daemon con nudges        │
└──────────────────────────────────────┴───────────────────────────────────────┘
```

---

## 3. Comparativa Crítica: Ego vs Hermes Agent

### Puntos Fuertes de Ego sobre Hermes (Ventaja de Ego)
* **Sustrato de Memoria (VantaDB vs SQLite/Markdown):**
  - *Hermes:* Utiliza archivos de texto planos (`MEMORY.md`, `USER.md`), SQLite tradicional con extensiones FTS5 y delega el modelado dialéctico a un servicio SaaS externo (Honcho).
  - *Ego:* Posee **VantaDB 0.8.0** (`NativeVantaDB` vía napi-rs in-process). Dispone de almacenamiento LSM nativo (Fjall), búsqueda híbrida densa/dispersa (HNSW ONNX + BM25) con fusión RRF, grafos nativos, GraphRAG, bitemporalidad, cuarentena atómica y checkpoints binarios. La arquitectura de Ego es infinitamente más soberana, local-first y potente.
* **Proceso Main Unificado (Node 22 vs Subproceso Python):**
  - *Hermes:* Obliga a levantar un proceso hijo pesado de Python para el backend (`agent/`, `gateway/`), lo que complica la distribución en Windows/macOS.
  - *Ego:* Todo el Cognitive Runtime corre in-process en Node.js 22 dentro de Electron, con comunicación IPC segura (`contextBridge`).

---

## 3. Bucles Agénticos, Catálogo de 40+ Herramientas, Widgets Vivos y Event Hooks

### A. Bucles Agénticos Iterativos (Iterative Agentic Loops)
Hermes implementa bucles agénticos cerrados diseñados para operar de forma iterativa hasta resolver el problema o solicitar intervención:
1. **Bucle de Modificación de Archivos (`file_tools.py`):**
   - Flujo: `read_file` → análisis AST → `file_tools_write_guards.py` (snapshot en cuarentena) → `patch_parser.py` (aplicación de unidiff) → `file_operations_lint.py` (compilación y verificación de linter).
   - Si el linter falla, el agente entra en sub-bucle correctivo sin consultar al usuario, intentando resolver el error de sintaxis hasta 3 veces.
2. **Bucle de Redacción y Gestión de Correos (`skills/email/`):**
   - Flujo: `draft_email` (redacción contextual) → `ask-directive.tsx` (presentación de widget vivo en el chat para previsualización por el usuario) → confirmación HITL → envío autenticado vía IMAP/SMTP/Gmail → registro en historial de auditoría.
3. **Bucle de Ejecución de Comandos y Auto-Recuperación:**
   - Flujo: Modelo emite comando → `tirith_security.py` evalúa riesgo → ejecución en PTY → captura de `stderr` → si el comando falla, el error exacto se inyecta con causalidad en el prompt del sistema → el modelo formula una hipótesis alternativa y reintenta de inmediato.

### B. Catálogo Exhaustivo de 40+ Herramientas Integradas
Organizadas por subsistema en `repos-referencia/hermes-agent/tools/`:
* **Filesystem & Código:** `file_tools.py`, `file_operations_search.py`, `file_operations_lint.py`, `working_diff.py`, `patch_parser.py`.
* **Ejecución & Sandboxing:** `terminal_tool.py` (7 backends), `code_execution_rpc.py`, `code_kernel.py`, `daemon_pool.py`.
* **Navegación Web & Extracción:** `web_tools.py`, `web_tools_extract.py`, `x_search_tool.py`, `Scrapling` (anti-bot crawler).
* **Control de Sistema & Computer Use:** `computer_use_tool.py`, `read_window_tool.py`, plugin `browser` (CDP / Playwright headless).
* **Protocolo MCP:** `mcp_tool.py`, `mcp_oauth.py`, `mcp_death_supervisor.py`, `mcp_liveness.py`, `mcp_tool_sampling.py`.
* **Skills & Subagentes:** `skills_tool.py`, `skills_hub.py`, `skills_ast_audit.py`, `delegate_tool.py`, `subagent_worktree.py`.
* **Memoria & Búsqueda:** `memory_tool.py`, `session_search_tool.py` (FTS5 SQLite).
* **Multimodal (Voz, Imagen, Video):** `vision_tools.py`, `image_generation_tool.py` (FLUX 2/Fal), `video_generation_tool.py`, `tts_tool.py`, `transcription_tools.py` (Whisper).
* **Productividad & Planificación:** `cronjob_tools.py`, `todo_tool.py`, `kanban_tools.py`, `project_tools.py`.
* **Seguridad & Guardrails:** `tirith_security.py`, `threat_patterns.py`, `path_security.py`, `write_approval.py`.

### C. Widgets Vivos en el Chat (GenUI en `@assistant-ui/react`)
En lugar de respuestas puramente textuales, Hermes renderiza interfaces interactivas vivas empotradas en el hilo:
* **Tarjetas de Progreso en Vivo (`delegation_live_log.py`):** Visualización reactiva del árbol de subagentes en ejecución paralela con logs en streaming.
* **Formularios HITL (`ask-directive.tsx`):** Formularios interactivos con botones de opción múltiple y campos de confirmación que detienen el loop hasta la acción del usuario.
* **Tarjetas de Artefactos Vivas (`artifact-card.tsx`):** Pestañas interactivas para alternar entre código fuente, markdown enriquecido y renderizado HTML en vivo.
* **Insignias de Estado & Sincronización (`sync-status-card.tsx`):** Badges en tiempo real sobre uso de cuota, latencia del modelo y estado de conexión.

### D. Event Hooks de Ciclo de Vida del Agente
Hermes expone un bus de hooks que intercepta cada fase del ciclo cognitivo:
* `on_session_start` / `on_session_end`: Preparación y limpieza de estado de sesión.
* `on_turn_start` / `on_turn_end`: Inyección de contexto y sincronización de memoria.
* `on_tool_call` / `on_tool_result` / `on_tool_error`: Validación de argumentos, ejecución y recuperación causal.
* `on_pre_compress`: Salvaguarda de checkpoints antes de truncar la ventana de contexto.
* `on_command_approval`: Interceptación de acciones sensibles para aprobación humana.

---

## 4. Clasificación según la Regla de Extracción Condicionada

> **Principio Rector:**
> 1. *Si ya está definido en Ego:* La extracción solo debe **optimizar, acelerar o robustecer** la implementación, sin alterar contratos ni violar guardrails.
> 2. *Si NO está definido en Ego:* **PROHIBIDO implementar directamente**. Se somete a evaluación crítica (utilidad real, trade-offs y FMEA) y se documenta formalmente como RFC.

### Matriz de Clasificación

| Dominio / Funcionalidad | Componente Fuente en Hermes | Estado en Ego | Clasificación | Acción de Ingeniería |
|---|---|:---:|:---:|---|
| **Render de Artifact Cards** | `apps/desktop/.../artifact-card.tsx` | Definido en Fase 01 & 04 | **Categoría 1 (Ya Definido)** | **MEJORA DIRECTA:** Extraer y adaptar a Tailwind B/N. |
| **Markdown AST + Explicabilidad** | `apps/desktop/.../markdown-text.tsx` | Definido en Fase 01 (`CORE-05`) | **Categoría 1 (Ya Definido)** | **MEJORA DIRECTA:** Bloques colapsables adaptados exclusivamente a Explicabilidad / Evidencia / Auditoría ("¿Por qué?"), nunca CoT crudo (§9). |
| **Error Boundary de Mensaje** | `apps/desktop/.../message-render-boundary.tsx` | Definido en Fase 01 (`CORE-05`) | **Categoría 1 (Ya Definido)** | **MEJORA DIRECTA:** Aislar fallos en widgets de Tools. |
| **Windows Env & Lifecycle** | `apps/desktop/electron/windows-*.ts` | Definido en Fase 01 (`CORE-01`) | **Categoría 1 (Ya Definido)** | **MEJORA DIRECTA:** Ingesta de PATH y window-state. |
| **Model Picker con Búsqueda** | `apps/desktop/src/components/model-picker.tsx` | Definido en Fase 01 (`CORE-03`) | **Categoría 1 (Ya Definido)** | **MEJORA DIRECTA:** UI desacoplada para ModelRouter. |
| **Formularios HITL (`ask-directive`)** | `apps/desktop/.../ask-directive.tsx` | Definido en Fase 02 (`ACT-04`) | **Categoría 1 (Ya Definido)** | **MEJORA DIRECTA:** Interfaz de confirmación interactiva. |
| **Ciclo de Vida de Memoria** | `agent/memory_provider.py` | Definido en `EgoMemoryAdapter` | **Categoría 1 (Ya Definido)** | **MEJORA DIRECTA:** Glifo indicador de recall (🧠). |
| **Aislamiento con Git Worktrees** | `tools/subagent_worktree.py` | *No definido previamente* | **Categoría 2 (No Definido)** | **EVALUACIÓN RFC-01:** Alto valor para Sub-Egos dev. |
| **Ejecución Zero-Context RPC** | `tools/code_execution_rpc.py` | *No definido previamente* | **Categoría 2 (No Definido)** | **EVALUACIÓN RFC-02:** Ahorro masivo de tokens. |
| **Linter y Auditoría AST Skills**| `tools/skills_ast_audit.py` | *No definido previamente* | **Categoría 2 (No Definido)** | **EVALUACIÓN RFC-03:** Seguridad crítica en Sub-Egos. |
| **Snapshot Previo a Modificación**| `tools/file_tools_write_guards.py` | *No definido previamente* | **Categoría 2 (No Definido)** | **EVALUACIÓN RFC-04:** Integrar con VantaDB cuarentena. |
| **Tool Gateway Gestionado** | Concepto Nous Portal | *Definido en modelo econ.* | **Categoría 2 (No Definido)** | **EVALUACIÓN RFC-05:** Solución al onboarding SaaS. |
| **Gateway Omnicanal (Telegram)**| `gateway/platforms/` | Postergado a Fase 07/08 | **Categoría 2 (No Definido)** | **POSTERGAR A P1:** Descartar en P0 para no desenfocar. |
| **7 Backends Terminal (Daytona)**| `tools/terminal_tool_backends.py` | Fuera de alcance P0 | **Categoría 2 (No Definido)** | **RECHAZAR EN P0:** Mantener solo terminal local. |

---

## 5. Evaluación Crítica y FMEA de Capacidades No Definidas (RFCs)

### RFC-01: Aislamiento de Sub-Egos mediante Git Worktrees
* **Qué es:** Cada vez que un Sub-Ego de Ingeniería o Producto debe realizar cambios en archivos del proyecto, se crea un `git worktree` efímero en un subdirectorio temporal (`.ego/worktrees/<subego-id>`) asociado a una rama oculta. Al finalizar, el Sub-Ego presenta un diff consolidado.
* **Por qué extraerlo:** Evita condiciones de carrera donde el agente modifica archivos que el usuario tiene abiertos en su editor, o rompe el build local mientras el usuario está trabajando.
* **Riesgos y FMEA:**
  - *Fallo:* Proyectos sin inicializar en Git -> *Mitigación:* Fallback a directorio temporal con copia en cuarentena.
  - *Espacio:* Carpetas pesadas como `node_modules` duplicadas -> *Mitigación:* Symlinks o `worktree` compartiendo la base.
* **Veredicto del Analista:** **APROBAR PARA FASE 03 (`SUB-07`)**. Se implementará en TypeScript en el Main process de Electron.

---

### RFC-02: Kernel de Ejecución Zero-Context-Cost Tool RPC
* **Qué es:** En tareas complejas (ej. buscar 10 archivos, parsearlos y combinarlos), el modelo no realiza 10 turnos de ida y vuelta con el LLM. En su lugar, emite un script que invoca herramientas locales de forma programática a través de un canal RPC in-process, devolviendo un único resultado consolidado.
* **Por qué extraerlo:** Nous Research documenta reducciones de coste de tokens de hasta el 70% y aceleración drástica del tiempo de respuesta.
* **Riesgos y FMEA:**
  - *Fallo de Seguridad:* Riesgo de RCE (Remote Code Execution) si el script no está aislado -> *Mitigación:* Confinamiento en `node:vm` o worker thread sin acceso al sistema de archivos fuera del sandbox de Ego.
* **Veredicto del Analista:** **APROBAR PARA FASE 02 (`ACT-07`) CON SANDBOXING ESTRICTO**. 

---

### RFC-03: Auditoría AST y Linter de Seguridad de Skills / Sub-Egos
* **Qué es:** Un validador de sintaxis y seguridad que analiza el Abstract Syntax Tree (AST) de cualquier herramienta, plugin o prompt estructurado antes de registrarlo en el sistema.
* **Por qué extraerlo:** En la Fase 03, los usuarios y los Sub-Egos podrán generar nuevas capacidades. Sin una auditoría AST, un prompt injection podría generar una herramienta que lea secretos del sistema o ejecute comandos dañinos.
* **Veredicto del Analista:** **APROBAR PARA FASE 03 (`SUB-05`)**. Se implementará en TypeScript usando el compilador de TypeScript o `@babel/parser`.

---

### RFC-04: Snapshots Automáticos Previos a Acciones Destructivas
* **Qué es:** En Hermes, cada modificación de archivo crea un snapshot instantáneo que permite deshacer (`/undo`) la operación.
* **Cómo encaja en Ego:** Ego ya tiene definida la **Cuarentena y Snapshots** en VantaDB (`docs/architecture/memoria-vantadb.md` y `career-ops`). En lugar de crear copias sueltas en disco como Hermes, conectamos esta guardia directamente con las transacciones de VantaDB Fjall LSM.
* **Veredicto del Analista:** **APROBAR PARA FASE 02 (`ACT-06`) Y FASE 10 (`REC-01`)**. Se implementa sobre VantaDB.

---

### RFC-05: Patrón "Tool Gateway" para Onboarding sin Fatiga de API Keys
* **Qué es:** El modelo de Nous Portal donde un usuario novato no tiene que registrarse en 5 proveedores distintos (búsqueda web, modelos, imagen); la suscripción de Ego provee un proxy unificado de herramientas de fábrica, manteniendo soporte BYOK completo.
* **Por qué es relevante:** Valida al 100% el modelo económico definido para Ego en [`docs/product/modelo-economico.md`](../product/modelo-economico.md) (SaaS + AI credits separados + BYOK).
* **Veredicto del Analista:** **MANTENER EN LA ESTRATEGIA DE PRODUCTO (Fase 12)**. El diseño de Ego ya contemplaba esta separación.

---

## 6. Inventario de Archivos Fuente a Auditar Localmente

Para la ejecución de las tareas inmediatas del Backlog de Ego, los ingenieros deben consultar exclusivamente las siguientes rutas en `repos-referencia/hermes-agent/`:

```
repos-referencia/hermes-agent/
├── apps/
│   ├── desktop/
│   │   ├── src/components/assistant-ui/
│   │   │   ├── artifact-card.tsx         → [HERM-01] Adaptar a apps/desktop/renderer/
│   │   │   ├── markdown-text.tsx         → [HERM-02] Pipeline de markdown y reasoning
│   │   │   ├── ask-directive.tsx         → [HERM-03] Formularios HITL para Tools
│   │   │   └── message-render-boundary.tsx → [HERM-04] Error Boundary por mensaje
│   │   ├── electron/
│   │   │   ├── windows-user-env.ts       → [HERM-06] Ingesta de PATH en Windows
│   │   │   ├── windows-sandbox-fallback.ts → [HERM-07] Sandbox seguro en Windows
│   │   │   └── window-state.ts           → [HERM-08] Geometría de ventana sin parpadeos
│   │   └── src/components/
│   │       ├── model-picker.tsx          → [HERM-10] Selector de modelos difuso
│   │       └── pane-shell/               → [HERM-09] Layout de paneles ajustables
│   └── shared/src/
│       ├── slash.ts                      → [HERM-12] Parser de comandos /
│       └── fuzzy.ts                      → Utilidad de búsqueda difusa
├── tools/
│   ├── subagent_worktree.py              → [RFC-01] Adaptar lógica de aislamiento Git
│   ├── code_execution_rpc.py             → [RFC-02] Kernel de ejecución Zero-Context
│   └── skills_ast_audit.py               → [RFC-03] Linter AST de seguridad de herramientas
└── agent/
    └── memory_provider.py                → [HERM-13] Lifecycle formal e indicador 🧠
```

---

## 7. Directiva de Cierre y Próximos Pasos

1. **Gobernanza Confirmada:** Ninguna línea de código de Hermes será copiada directamente. Se extraerán únicamente las especificaciones de diseño y patrones, reescribiéndolos en TypeScript estricto.
2. **Prioridad 1 en Marcha:** La Fase 01 de Ego (`CORE-01..11`) se nutre de forma inmediata de las mejoras UI y de Windows (`HERM-01`, `HERM-02`, `HERM-04`, `HERM-06`, `HERM-08`).
3. **Persistencia Soberana:** VantaDB se mantiene como el único e innegociable sustrato de memoria y estado del sistema.
