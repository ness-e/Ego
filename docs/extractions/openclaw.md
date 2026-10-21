# Extracción Técnica: OpenClaw (repos-referencia/openclaw) #

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de patrones |
| Repositorio Origen | `repos-referencia/openclaw/` (clonado en profundidad 1 el 2026-10-20; `node >=24.16.0 <25 \|\| >=26.1.0`, pnpm 12.5.1, ESM) |
| Stack del Origen | 100% TypeScript (Node.js 24/26, pnpm workspaces, Vitest, tsdown) + Kysely SQLite |
| Rol en Ego | Referencia de arquitectura de Gateway, Admisión de Runs, Tool Repair y Workers |
| Owner | ness-e |
| Fecha | 2026-10-07 · Revisión de fondo 2026-10-20 |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia ##

**OpenClaw** es un framework de asistencia autónoma desarrollado en **100% TypeScript nativo**,
compartiendo el mismo runtime y gestor de paquetes que Ego (Node.js + pnpm workspaces).

A diferencia de Hermes Agent (cuyo backend era en Python), los módulos de OpenClaw están escritos
en TypeScript moderno con tipado estricto, lo que permite extraer patrones arquitectónicos y
adaptarlos directamente a los paquetes de Ego sin requerir traducción entre lenguajes.

> **Nota de revisión (2026-10-20).** Esta ficha pasó una revisión de fondo contra el clon real.
> Todas las evidencias de la §5 se re-verificaron por grep sobre `packages/` + `apps/desktop/`
> (excluyendo `test/`, `dist/` y `node_modules/`). Se corrigieron **ocho evidencias** que
> apuntaban a líneas o rutas inexistentes, se reclasificaron **tres compuertas** y se
> incorporation **seis hallazgos nuevos** (`OCLW-19..24`). El detalle por fila vive en
> [`docs/review/backlog-openclaw.md`](../review/backlog-openclaw.md).

### Divergencias Fundamentales (Qué Descartamos y Por Qué) ###

| Dimensión | OpenClaw | Ego (Cognitive OS) | Decisión Crítica |
|---|---|---|---|
| **Sustrato de Memoria** | Archivos Markdown planos + Kysely ORM sobre SQLite (`node-sqlite.mjs`). | VantaDB 0.8.0 nativo in-process (`NativeVantaDB` vía napi-rs) + Fjall LSM + HNSW + BM25 + GraphRAG. | **DESCARTAR SQLite**. Ego utiliza `NativeVantaDB` como sustrato único soberano. Se descarta la capa Kysely de OpenClaw. |
| **Arquitectura de Interfaz** | Gateway Headless orientado a red local + clientes de mensajería (WhatsApp/Telegram) + Web Control UI. | Aplicación Desktop Soberana (Electron 33 + React 19 + Assistant-UI) con Dynamic Workspace. | **DESCARTAR Web UI headless**. Ego se concentra en su experiencia desktop de alta fidelidad. |
| **Transporte Principal** | Servidor WebSocket/HTTP en loopback (`127.0.0.1`). | IPC nativo de Electron fuertemente tipado (`contextBridge`) con aislamiento de contexto. | **ADAPTAR**. No levantamos sockets TCP/HTTP internos para la UI local; usamos el bus IPC seguro de Electron. |

---

## 2. Inventario Quirúrgico de Patrones a Extraer ##

### Bloque A: Gobernanza de Ejecución y Contexto de Admisión ###

*Ubicación en fuente:* `repos-referencia/openclaw/src/agents/admitted-run-context.ts`

1. **`AdmittedRunContext` & `OperationalRunInstanceRef`**
   - **Qué hace:** Formaliza la admisión inmutable de cada ejecución del agente. Cada run lleva un token de identidad,
     identificador de instancia y `runId` único para trazabilidad estricta.
   - **Adaptación en Ego:** Incorporado en el `ExecutionManager` de Ego
     (`packages/execution/src/AdmittedRunContext.ts`), garantizando que cada llamada a un Sub-Ego o Tool lleve contexto
     auditable y cancelable.
   - **Relación con Backlog Ego:** `ACT-01`, `ACT-03`.

2. **Propagación Nativa de `AbortSignal`**
   - **Qué hace:** Asocia un `AbortSignal` a la autoridad del operador (`AdmittedRunOperatorAuthority`). Si el usuario
     cancela la tarea, el signal se propaga en cascada abortando llamadas a modelos, procesos de terminal y consultas de
     base de datos.
   - **Adaptación en Ego:** Integración en `EgoMemoryAdapter` y el pipeline IPC de Electron.
   - **Relación con Backlog Ego:** `CORE-02`, `ACT-03`.

### Bloque B: Resiliencia en Invocación de Herramientas ###

*Ubicación en fuente:* `repos-referencia/openclaw/packages/tool-call-repair/`

1. **Auto-Reparación Sintáctica de Tool Calls (`packages/tool-call-repair`)**
   - **Qué hace:** Intercepta salidas de modelos LLM cuando emiten llamadas a herramientas malformadas (JSON truncado
     por límites de tokens, comillas sin cerrar, nombres de parámetros aproximados o tipos string en lugar de números).
     Aplica un motor de reparación heurístico en TypeScript antes de que la llamada falle.
   - **Adaptación en Ego:** Integrado en el despachador de herramientas
     (`packages/tool-call-repair/src/ToolCallRepairEngine.ts`, invocado desde
     `packages/runtime/src/ToolExecutionLoop.ts`), evitando que fallos menores de modelos locales (Ollama Llama 3)
     interrumpan el flujo de trabajo.
   - **Relación con Backlog Ego:** `ACT-01`, `ACT-09` (RFC-OCLW-01).

### Bloque C: Ciclo de Vida de Sesiones y Paginación ###

*Ubicación en fuente:* `repos-referencia/openclaw/src/sessions/`

1. **Locks Atómicos por Sesión (`session-lifecycle-locks.ts`)**
   - **Qué hace:** Exclusión mutua que garantiza que dos eventos concurrentes (ej. un webhook en segundo plano y un
     mensaje del usuario) no muten la misma sesión al mismo tiempo.
   - **Adaptación en Ego:** Implementado en el gestor de sesiones de Ego sobre memoria VantaDB.
   - **Relación con Backlog Ego:** `CORE-07`, `REC-01`.

2. **Ventanas Deslizantes de Transcripción (`transcript-read-window.ts`)**
   - **Qué hace:** Paginación de lecturas de mensajes para hilos muy largos, cargando solo los últimos $N$ turnos en
     memoria para visualización y ensamblado de contexto.
   - **Adaptación en Ego:** Utilizado para la carga virtualizada de mensajes en `@assistant-ui/react`.
   - **Relación con Backlog Ego:** `CORE-05`, `CORE-07`.

3. **Seguimiento de Diffs y Revisiones Acumuladas (`session-diff-revisions.ts`)**
   - **Qué hace:** Rastrea y calcula los cambios incrementales de archivos realizados a lo largo de una sesión,
     permitiendo inspeccionar qué modificó el agente en conjunto.
   - **Adaptación en Ego:** Base del panel de revisión de cambios en el Dynamic Workspace de Ego.
   - **Relación con Backlog Ego:** `ACT-10`, `CANV-06` (RFC-OCLW-02).

### Bloque D: Seguridad y Workers Aislados ###

*Ubicación en fuente:* `repos-referencia/openclaw/packages/`

1. **Política de Seguridad de Red (`packages/net-policy/`)**
   - **Qué hace:** Validador estricto de URLs que bloquea peticiones SSRF a `localhost`, `127.0.0.1`, `169.254.169.254`
     (metadatos AWS) o redes privadas cuando las herramientas del agente hacen web fetching.
   - **Adaptación en Ego:** Módulo de seguridad para herramientas de navegación web
     (`packages/security/src/ssrfPolicy.ts` como canónica única, reexportada por
     `packages/tools/src/native/security/NetPolicy.ts`), consumida por `packages/security/src/ToolPermissions.ts`.
   - **Relación con Backlog Ego:** `SEC-01`, `SEC-02`.

2. **Runtime de Workers en Node.js (`packages/worker-runtime/`, `src/infra/worker-task-pool.ts`)**
   - **Qué hace:** Ejecución de tareas pesadas de CPU en `node:worker_threads` independientes para evitar congelar el
     hilo principal; el clon añade admisión por capacidad y GC de workers ociosos.
   - **Adaptación en Ego:** Asimilación **degradada**: `packages/tasks/src/WorkerTaskPool.ts` es un pool **local
     cooperativo** cuyo propio encabezado declara que no usa `worker_threads` ni aporta paralelismo real. Ver `OCLW-10`
     en la §5.
   - **Relación con Backlog Ego:** `TASK-05` (RFC-OCLW-03).

3. **Renderizado de Mermaid (`packages/mermaid-renderer/`)**
   - **Qué hace:** Validación AST y generación SVG de diagramas Mermaid.
   - **Adaptación en Ego:** Componente de renderizado para el Canvas del Workspace Dinámico.
   - **Relación con Backlog Ego:** `CANV-03`, `CANV-05`.

### Bloque E: Resiliencia de Runtime (Hallazgos de la revisión de fondo) ###

*Ubicación en fuente:* `repos-referencia/openclaw/src/agents/`, `packages/retry/`

1. **Detección de Bucle de Herramienta por No-Progreso (`tool-loop-detection.ts`)**
   - **Qué hace:** Seis detectores independientes (repetición genérica, argument churn, tool desconocida repetida, poll
     sin progreso, circuit breaker global, ping-pong) con hash del outcome de la tool y umbrales escalonados.
   - **Adaptación en Ego:** No asimilado. Ego corta *fallos* (`CircuitBreaker`) y *ciclos de delegación*
     (`LoopBreaker`), pero no detecta repetición **semántica** de la misma tool. Ver `OCLW-19`.
   - **Relación con Backlog Ego:** `ACT-09`.

2. **Primitivas de Carrera con Abort y Timeout (`packages/retry/`)**
   - **Qué hace:** `racePromiseWithAbortSignal` y `raceWithTimeout` con `cause` preservado, `unref` del timer y limpieza
     del listener de abort.
   - **Adaptación en Ego:** No asimilado. No existe una primitiva única de "carrera con abort + timeout" en
     `@ego/execution`. Ver `OCLW-22`.
   - **Relación con Backlog Ego:** `ACT-03`.

3. **Reparación de Emparejamiento de Tool Calls (`session-transcript-repair.ts`)**
   - **Qué hace:** Repara bloques `tool_result` huérfanos que un proveedor estricto rechaza, antes de compactar o
     reenviar el historial.
   - **Adaptación en Ego:** No asimilado. `packages/tool-call-repair` (RFC-OCLW-01) repara **JSON malformado**, no el
     **emparejamiento** de bloques. Ver `OCLW-24`.
   - **Relación con Backlog Ego:** `ACT-09`.

---

## 3. Matriz de Extracción vs Descarte ##

| Módulo OpenClaw | Acción en Ego | Razón Técnica / Arquitectónica |
|---|:---:|---|
| `packages/tool-call-repair/` | **EXTRAER & ADAPTAR** | TypeScript nativo puro; resuelve el 90% de fallos sintácticos en modelos pequeños. |
| `src/agents/admitted-run-context.ts` | **EXTRAER & ADAPTAR** | Modelo formal de tokens de admisión y propagación de `AbortSignal`. |
| `src/sessions/session-lifecycle-locks.ts` | **EXTRAER & ADAPTAR** | Exclusión mutua esencial para consistencia de turnos concurrentes. |
| `src/sessions/transcript-read-window.ts` | **EXTRAER & ADAPTAR** | Paginación y rendimiento de memoria en sesiones largas. |
| `src/sessions/session-diff-revisions.ts` | **EXTRAER & ADAPTAR** | Auditoría y visualización de cambios acumulados en archivos de proyecto. |
| `packages/net-policy/` | **EXTRAER & ADAPTAR** | Prevención determinista de ataques SSRF en tools de web scraping. |
| `packages/worker-runtime/` | **EXTRAER & ADAPTAR** | Aislamiento de tareas de cómputo en worker threads para no congelar Electron. |
| `packages/mermaid-renderer/` | **EXTRAER & ADAPTAR** | Componente visual para diagramación dinámica en el Canvas de Ego. |
| `src/agents/tool-loop-detection.ts` | **EXTRAER & ADAPTAR** | Corta la repetición semántica de tools; distinto del circuit breaker por fallos. |
| `src/agents/tool-schema-quarantine.ts` | **EXTRAER & ADAPTAR** | Aísla una tool con schema no soportado en vez de romper la llamada completa. |
| `src/agents/worktrees/` | **EXTRAER & ADAPTAR** | Capacidad, lease y GC de worktrees: el aislamiento de Sub-Egos necesita un ciclo de vida completo. |
| `packages/retry/` | **EXTRAER & ADAPTAR** | Primitivas de carrera con abort y timeout reutilizables por todo el runtime. |
| `src/agents/compaction-planning.ts` | **EXTRAER & ADAPTAR** | Compactación adaptativa por chunks en lugar de un único poda head/tail. |
| `src/agents/session-transcript-repair.ts` | **EXTRAER & ADAPTAR** | El emparejamiento `tool_use`↔`tool_result` roto invalida la llamada en proveedores estrictos. |
| `node-sqlite.mjs` / Kysely SQLite | **DESCARTAR** | Ego utiliza `NativeVantaDB` como sustrato único soberano. |
| `src/channels/*` + `extensions/whatsapp` + `extensions/telegram` | **DESCARTAR EN P0** | Postergar a P1 para mantener el foco en la aplicación Desktop SOC. |
| Control UI Web / TUI | **DESCARTAR** | Ego cuenta con su propia UI de escritorio en Electron + React 19. |

---

## 4. Nuevas Capacidades Evaluadas e Incorporadas (RFCs Aprobados) ##

Derivado de la investigación técnica en OpenClaw, se formalizan e incorporan tres nuevos RFCs en el Backlog de Ego (ver
detalle en [`docs/research/openclaw-deep-dive.md`](../research/openclaw-deep-dive.md)):

1. **RFC-OCLW-01: Auto-Reparación de Tool Calls (`packages/tool-call-repair`)**
   - *Destino:* `ACT-09` (Fase 02). Reparación determinista de JSON roto sin consumir turnos del LLM.
2. **RFC-OCLW-02: Grafo de Diffs Acumulados por Sesión (`src/sessions/session-diff-revisions.ts`)**
   - *Destino:* `ACT-10` (Fase 02) y `CANV-06` (Fase 04). Visualización de cambios acumulados en el Canvas.
3. **RFC-OCLW-03: Runtime de Workers en Background (`packages/worker-runtime`)**
   - *Destino:* `TASK-05` (Fase 07). Ejecución de procesamiento en `worker_threads` para fluidez total de Electron.

---

## 5. Estado real verificado (2026-10-20) — Ola 2 de remediación (A5) ##

> Fuente canónica del estado por tarea: [`docs/review/backlog-openclaw.md`](../review/backlog-openclaw.md).
> Criterio de cierre: fichero adaptado **y** caller en producción (grep sobre `packages/` +
> `apps/desktop/`, excluyendo `test/`, `dist/` y `node_modules/`).
> Revisión de fondo del 2026-10-20: re-verificación de las 18 filas previas (correcciones de
> línea y de ruta) + 6 hallazgos nuevos (`OCLW-19..24`).

| ID | Patrón | Estado | Evidencia / Fundamento |
|---|---|:---:|---|
| `OCLW-01` | Admisión inmutable de runs | ✅ Completada | `packages/execution/src/AdmittedRunContext.ts:7,27,175` → `packages/decision/src/schemas/intent.ts:2,11` (importa `validateAdmittedRunContext` y `toDecisionRunContext` de `@ego/execution`) + `packages/execution/src/ExecutionManager.ts:253,270,293,330` (propagación) + `apps/desktop/src/main.ts:1508,1543`. |
| `OCLW-02` | `AbortSignal` | ✅ Completada | `apps/desktop/src/main.ts:265` (`llmAbortControllers`), `:1464` (alta por turno), `:1827` (baja); handler `ipc.llm.cancel` en `apps/desktop/src/main/ipc/register-ipc.ts:517`; `packages/execution/src/ExecutionManager.ts:171-176,276`; `packages/execution/src/ApprovalEngine.ts:295-330`. |
| `OCLW-03` | Auto-reparación de tool calls | ✅ Completada | `packages/tool-call-repair/src/ToolCallRepairEngine.ts:23` → `packages/runtime/src/ToolExecutionLoop.ts:19` (import), `:368` (`extractFromText`), `:375` (`stripToolCalls`), `:443` (`repair`) → `apps/desktop/src/main.ts:19` (import de `@ego/runtime`), `:2518` (`new ToolExecutionLoop`). |
| `OCLW-04` | Normalización de argumentos | ✅ Completada | `packages/tool-call-repair/src/coercion.ts:63` (`normalizeToolArguments`) → `ToolCallRepairEngine.ts:3,31,46,58,114` → mismo caller en producción que `OCLW-03`. |
| `OCLW-05` | Locks atómicos de sesión | 🚫 Descartada (con justificación) | `packages/memory/SessionLifecycleLocks.ts:23` existe pero sólo se cita como **string** en el manifiesto del Canvas (`apps/desktop/renderer/components/canvas/WorkbenchView.tsx:88`), con una ruta **obsoleta** (`packages/memory/src/SessionLifecycleLocks.ts`) que no existe. La exclusión mutua en producción la dan `packages/memory/SessionCheckpointPolicy.ts` (fail-closed) y `packages/memory/SessionFork.ts`. Un tercer mecanismo de lock sería una tercera fuente de verdad sobre la secuencia de turnos. **Acción:** corregir la ruta del manifiesto del Canvas (owner A4). **Codigo muerto:** modulo asimilado sin caller de produccion -> retirar. Zona duenosa: @ego/memory (A2). **Codigo muerto:** modulo asimilado sin caller de produccion -> retirar. Zona duenosa: @ego/memory (A2). **Codigo muerto:** modulo asimilado sin caller de produccion -> retirar. Zona duenosa: @ego/memory (A2). |
| `OCLW-06` | Ventana deslizante de transcripción | 🚫 Descartada (con justificación) | 🚫 Sin caller: `packages/memory/TranscriptReadWindow.ts:38`. La lectura real va por `EgoMemoryAdapter` + `SessionRetention.ts`. **Codigo muerto:** modulo asimilado sin caller de produccion -> retirar. Zona duenosa: @ego/memory (A2). **Codigo muerto:** modulo asimilado sin caller de produccion -> retirar. Zona duenosa: @ego/memory (A2). **Codigo muerto:** modulo asimilado sin caller de produccion -> retirar. Zona duenosa: @ego/memory (A2). |
| `OCLW-07` | Grafo de diffs acumulados | ✅ Completada | ✅ Caller: `packages/tools/src/native/git/NativeGitTool.ts:8` -> `packages/tools/src/native/index.ts:39` -> `apps/desktop/src/main.ts:3086`. |
| `OCLW-08` | Parser de parches unificados | ✅ Completada | `packages/tools/src/native/git/GitParser.ts:39` → `NativeGitTool.ts:6,51,95` → `packages/tools/src/native/index.ts:32` → `apps/desktop/src/main.ts:2148` (`registerNativeTools`). |
| `OCLW-09` | Política anti-SSRF | ✅ Completada | **Una sola implementación en el repo:** `packages/security/src/ssrfPolicy.ts:67` (`export class NetPolicy`). `packages/tools/src/native/security/NetPolicy.ts:37-41` es **reexport puro** y `packages/security/src/netPolicy.ts:10,19,35` es fachada de compatibilidad: la divergencia que la Ola 1b cerró ya no existe. **Callers de producción:** `packages/integrations/src/mcp/types.ts:1,314,350` (`validateUrl` / `validateUrlWithDns`), `apps/desktop/src/main/security/electron-security.ts:14,305` (`validateSSRFUrl`) y `apps/desktop/src/main.ts:2539` (`evaluateToolCall` → `packages/security/src/ToolPermissions.ts:23,248`). |
| `OCLW-10` | Runtime de workers | 🆕 Pendiente | 🆕 Asimilacion degradada: `WorkerTaskPool.ts:63` declara que NO usa `node:worker_threads` (el nombre canonico real es `LocalTaskPool`) y `getWorkerTaskPool()` tiene 0 llamadas. **Owner: A3.** |
| `OCLW-11` | Render Mermaid | ✅ Completada | ✅ Caller: `packages/ui-runtime/src/MermaidComponent.ts:2` + registro en `apps/desktop/renderer/components/canvas/registry.ts:79-84` (`MermaidView`). |
| `OCLW-12` | Formularios interactivos | 🚫 Descartada (con justificación) | `packages/runtime/src/StructuredInput.ts:62` (`StructuredInputCompiler`) sólo se referencia en el re-export `packages/runtime/src/index.ts:5`. El flujo de entrada estructurada al usuario **ya existe en producción y es otro**: `packages/execution/src/WidgetHitlBridge.ts` (importado en `apps/desktop/src/main.ts:20`), `apps/desktop/renderer/components/tools/ApprovalCard.tsx:31` y `apps/desktop/renderer/components/assistant-ui/ask-directive.tsx`. Un segundo generador de esquemas quedaría sin destino de consumo; la granularidad de aprobación por tool call la impone el `ApprovalEngine`. **Codigo muerto:** modulo asimilado sin caller de produccion -> retirar. Zona duenosa: @ego/runtime (A2). **Codigo muerto:** modulo asimilado sin caller de produccion -> retirar. Zona duenosa: @ego/runtime (A2). **Codigo muerto:** modulo asimilado sin caller de produccion -> retirar. Zona duenosa: @ego/runtime (A2). |
| `OCLW-13` | Respawn de proceso | 🚫 Descartada (con justificación) | 🚫 Sin caller: `packages/recovery/src/ProcessSupervisor.ts:20`. La recuperación real es `CrashRecoveryEngine` + `OpGate` -> `apps/desktop/src/main/state/app-context.ts`. **Codigo muerto:** modulo asimilado sin caller de produccion -> retirar. Zona duenosa: @ego/recovery (A3). **Codigo muerto:** modulo asimilado sin caller de produccion -> retirar. Zona duenosa: @ego/recovery (A3). **Codigo muerto:** modulo asimilado sin caller de produccion -> retirar. Zona duenosa: @ego/recovery (A3). |
| `OCLW-14` | Despachador de actividad de tools | 🚫 Descartada (con justificación) | `packages/events/src/ToolActivityEmitter.ts:52` sólo se referencia en el re-export `packages/events/src/index.ts:5`. **Motivo:** el patrón ya está cubierto en producción por el propio loop, que emite `tool.started` (`packages/runtime/src/ToolExecutionLoop.ts:404,869`), `tool.executed` (`:727,911`) y `tool.failed` (`:117,417,452,749,934`) directamente en el `EventBus`, y el bus retransmite al renderer por `ipc.event` (`apps/desktop/src/main.ts:2755-2758`). `ToolActivityEmitter` emitiría los mismos tipos canónicos sobre el mismo bus → **segunda fuente de verdad** para el mismo evento. Sólo `tool.patch_summary` es exclusivo: si el Canvas lo necesita, se añade un tipo de evento al bus, no un segundo emisor. |
| `OCLW-15` | Puntos de control post-crash | ✅ Completada | `packages/tasks/src/TaskCheckpoint.ts:16` (`TaskCheckpointManager`, checksum SHA-256 en `:25`, namespace `tasks/<taskId>/checkpoints`) → `apps/desktop/src/main.ts:53` (import), `:225` (instancia), `:2248` (construcción), `:2263-2264` (`loadLatestCheckpoint`). **Fuente real corregida:** `src/agents/main-session-recovery/main-session-recovery-checkpoint.ts` — el path `snapshots/session/` citado antes **no existe** en el clon. |
| `OCLW-16` | Hot-reload de tools | 🚫 Descartada (con justificación) | **El fichero `packages/tools/src/HotReloadToolLoader.ts` nunca existió** (grep `HotReload` sobre `packages/` → 0; el backlog lo declaraba "Completada" — falso verde de la auditoría del 2026-10-19). **Matiz re-verificado el 2026-10-20:** el clon **sí** tiene hot-reload, pero de **configuración**, no de código de tools (`src/gateway/config-reload.ts:1434`, `src/config/source-file.ts:293,312`); la ruta de origen citada `src/tools/dynamic-loader.ts` **no existe**. **Motivo del descarte en Ego:** el catálogo de tools es código embebido y versionado (`packages/tools/src/native/index.ts` → `registerNativeTools` en `apps/desktop/src/main.ts:2148`); recargar tools en caliente exigiría invalidar los contratos Zod cacheados, re-registrar en `ToolRegistry` y **re-validar permisos** en `@ego/security/ToolPermissions` (superficie de ataque y de gobernanza) para un beneficio marginal en un desktop local-first. **Alternativa vigente:** re-escaneo de skills en arranque (`SkillScanner`, `apps/desktop/src/main.ts:2198`). |
| `OCLW-17` | File watcher reactivo | 🚫 Descartada (con justificación) | **El fichero `packages/tools/src/WorkspaceFileWatcher.ts` nunca existió** (grep `FileWatcher` sobre `packages/` → 0; el backlog lo declaraba "Completada" — falso verde). **Ruta de origen corregida:** `src/infra/file-watcher.ts` **tampoco existe**; el fichero real del clon es `src/infra/file-watch-notifier.ts`. **Motivo:** la reactividad de archivo ya la cubre `packages/tasks/src/ProactivityEngine.ts` con `fs.watch` (owner A3, Ola 1) y el Canvas refresca por acción del usuario; un watcher global de workspace en `@ego/tools` sería una **segunda ruta de invalidación** del Canvas. Si `CANV-06` (diff acumulado en vivo) lo exige, se implementa **dentro de `OCLW-07`**, no como módulo aparte. |
| `OCLW-18` | Mensajería externa | ⏳ Futura (P1) | **Rutas de origen corregidas:** los adaptadores viven en `extensions/whatsapp/` y `extensions/telegram/` (plugins), no en `src/channels/whatsapp/` ni `src/channels/telegram/` (0 ficheros). Requiere canal de red saliente y relay stateless, no implementados. Fase destino: P1 (`INT-05`, `DOM-04`). |
| `OCLW-19` | Detección de bucle de herramienta por no-progreso | 🆕 Pendiente | 🆕 Falta la deteccion de bucle por no-progreso: `CircuitBreaker.ts:15` cuenta fallos consecutivos (0 detectores de no-progreso/argument-churn/ping-pong). **Owner: A2.** |
| `OCLW-20` | Cuarentena de esquemas de tool | 🆕 Pendiente | 🆕 Falta la cuarentena de tools con schema no soportado: `ToolRegistry.ts:156` valida con Zod pero no aisla la tool. **Owner: A3.** |
| `OCLW-21` | Ciclo de vida de worktrees con capacidad, leases y GC | 🚫 Descartada (con justificación) | 🚫 Asimilado a medias y desconectado: `createWorktree:139` / `finalizeWorktree:187` sin caller de producción. Sólo la limpieza (`pruneOrphanWorktrees:270`) está viva. |
| `OCLW-22` | Carreras con `AbortSignal` y timeout acotado | 🆕 Pendiente | **Fuente:** `packages/retry/src/index.ts`: `racePromiseWithAbortSignal` (`:9`) y `raceWithTimeout` (`:48`), con `cause` preservado, `unref` del timer, límite duro de timer (`:1`) y limpieza del listener de abort. **Ego:** `packages/execution/src/ExecutionManager.ts:171-176` crea e inyecta el `AbortController`, pero no existe primitiva única de "carrera con abort + timeout" (grep `raceWithTimeout\|racePromise` en `packages/` → 0). **Cableado:** primitiva compartida en `@ego/execution` usada por `ExecutionManager`, `ApprovalEngine` y `ToolExecutionLoop` (owner A2). |
| `OCLW-23` | Planificación adaptativa de compactación por chunks | 🆕 Pendiente | **Fuente:** `src/agents/compaction-planning.ts` (ratio base 0.4, mínimo 0.15, `SAFETY_MARGIN` 1.2, `SUMMARIZATION_OVERHEAD_TOKENS` 4096) + `compaction-planning-worker.ts` + `compaction-planning-projection.ts`: decide modo **split** o **single**, proyecta lo omitido y delega el cómputo a un worker. **Ego:** `packages/runtime/src/ContextCompaction.ts:531` (`planCompaction`) hace un único poda head/tail con umbrales fijos; no hay chunking adaptativo ni descarga a worker. **Cableado:** extender `planCompaction` con modo split y ejecutar la proyección vía `packages/tasks/src/WorkerTaskPool.ts` (owner A2/A3). |
| `OCLW-24` | Reparación de transcripción y emparejamiento `tool_use`↔`tool_result` | 🆕 Pendiente | **Fuente:** `src/agents/session-transcript-repair.ts` (`repairToolUseResultPairing`, `stripToolResultDetails`), usado en compactación (`compaction-planning.ts:9,295`), en el safeguard (`agent-hooks/compaction-safeguard.ts:45`) y en el replay (`embedded-agent-runner/replay-history.ts:49,631`): repara `tool_result` huérfanos que un proveedor estricto rechaza. **Ego:** `packages/tool-call-repair` (RFC-OCLW-01) repara **JSON malformado**, no el **emparejamiento** de bloques; grep `tool_result\|pairing` en `packages/` → sólo sanitización de contenido. **Cableado:** reparación de emparejamiento antes de compactar en `packages/runtime/src/ContextCompaction.ts` (owner A2). |

**Recuento:** 9 `✅ Completada` · 8 `🚫 Descartada` · 6 `🆕 Pendiente` · 1 `⏳ Futura` — **24 tareas**.

---

## 6. Descarte de componente — normalizado a la forma canónica (2026-10-19) ##

Las filas de la matriz §3 usaban la forma `**DESCARTAR**`; se normalizan aquí a
`🚫 Descartada (con justificación)` (AGENTS.md §4) conservando el motivo original:

| Módulo OpenClaw | Veredicto | Fundamento |
|---|:---:|---|
| `node-sqlite.mjs` / Kysely SQLite | 🚫 Descartada (con justificación) | Ego utiliza `NativeVantaDB` como sustrato único soberano. |
| `src/channels/*` + `extensions/whatsapp` + `extensions/telegram` | 🚫 Descartada (con justificación) — diferido a P1 | Posponer a P1 para mantener el foco en la aplicación Desktop SOC. La fila de backlog asociada es `OCLW-18` (⏳ Futura). |
| Control UI Web / TUI | 🚫 Descartada (con justificación) | Ego cuenta con su propia UI de escritorio en Electron + React 19. |

---

## 7. Hallazgos nuevos de la revisión de fondo (2026-10-20) ##

Seis hallazgos no recogidos por la ficha original. Todos son **transferibles** a Ego y ninguno
requiere romper un guardrail: son patrones de runtime, no features de producto.

1. **`OCLW-19` — Detección de bucle por no-progreso.** El clon no corta la repetición de una tool
   por *fallos*, la corta por *ausencia de progreso*: hash del outcome, streak de no-progreso,
   argument churn (la misma tool con argumentos ligeramente distintos) y ping-pong entre dos tools.
   Es la defensa natural contra los modelos pequeños que Ego ejecuta en local.
2. **`OCLW-20` — Cuarentena de esquemas.** Un proveedor puede rechazar una forma de schema
   concreta. El clon pone esa tool en cuarentena con diagnóstico y la recupera después; Ego hoy
   valida con Zod pero no aísla: una tool con schema no soportable puede tumbar el turno entero.
3. **`OCLW-21` — Ciclo de vida de worktrees.** Ego ya tiene `SubEgoWorktree.ts`, pero
   `createWorktree` y `finalizeWorktree` no tienen caller: el aislamiento está implementado y
   desconectado. El clon añade las tres piezas que faltan para que el ciclo sea seguro:
   **capacidad** (no exceder el disco), **lease** (el GC no pode un worktree en uso) y
   **GC con protección de propietario**.
4. **`OCLW-22` — Primitivas de carrera con abort.** `racePromiseWithAbortSignal` y
   `raceWithTimeout` resuelven de forma uniforme el patrón "promesa que debe abortar o caducar",
   con `cause` preservado y limpieza del listener. Es una pieza pequeña que evita que cada
   llamada reimplemente la carrera a mano.
5. **`OCLW-23` — Compactación adaptativa.** El clon decide entre resumir de una vez o dividir el
   historial en chunks con tamaño adaptativo, y delega el cómputo a un worker. Ego hace un único
   poda head/tail: con historiales largos pierde contexto útil por el summarizador.
6. **`OCLW-24` — Emparejamiento de tool calls.** Un `tool_result` huérfano (sin su `tool_use`)
   invalida la llamada en proveedores estrictos. El clon lo repara antes de compactar, resumir o
   reenviar. Es un patrón distinto del de `RFC-OCLW-01`, que repara JSON truncado.

## 8. Deuda abierta derivada de esta revisión ##

| # | Ítem | Tipo | Owner | Bloqueante |
|---|---|---|---|---|
| D1 | `OCLW-16` / `OCLW-17`: eliminar toda referencia residual a `HotReloadToolLoader` / `WorkspaceFileWatcher` si aparece en otro doc de `docs/roadmap/` | Docs | A1 | No |
| D2 | `OCLW-09`: **cerrado el 2026-10-20** — la consolidación de la política SSRF en una sola implementación (`packages/security/src/ssrfPolicy.ts`) ya está hecha; queda sólo sincronizar la nota de deuda | Docs | A1 | No |
| D3 | `OCLW-05`: corregir la ruta obsoleta `packages/memory/src/SessionLifecycleLocks.ts` del manifiesto del Canvas | Código | A4 | No |
| D4 | `OCLW-13`: decidir si el respawn de proceso vive en `packages/recovery` o en el arranque de Electron | Decisión | A4 | Sí (bloquea el cableado) |
| D5 | `OCLW-10`: los handlers del pool actual no son transferibles entre hilos; definir el contrato serializable para `worker_threads` reales | Decisión | A3/A4 | Sí (bloquea `TASK-05`) |
| D6 | `OCLW-21`: el aislamiento de Sub-Egos no es funcional hasta que `createWorktree` tenga caller; definir el punto de cableado en la delegación | Decisión | A3 | Sí (bloquea `CANV-06`) |
