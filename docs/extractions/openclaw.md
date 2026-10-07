# Extracción Técnica: OpenClaw (repos-referencia/openclaw)

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de patrones |
| Repositorio Origen | `repos-referencia/openclaw/` (Commit verificado: oct-2026) |
| Stack del Origen | 100% TypeScript (Node.js 24/26, pnpm workspaces, Vitest, tsdown) + Kysely SQLite |
| Rol en Ego | Referencia de Arquitectura de Gateway, Admisión de Runs, Tool Repair y Workers |
| Owner | ness-e |
| Fecha | 2026-10-07 |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia

**OpenClaw** es un framework de asistencia autónoma desarrollado en **100% TypeScript nativo**, compartiendo el mismo runtime y gestor de paquetes que Ego (Node.js + pnpm workspaces).

A diferencia de Hermes Agent (cuyo backend era en Python), los módulos de OpenClaw están escritos en TypeScript moderno con tipado estricto, lo que permite extraer patrones arquitectónicos y adaptarlos directamente a los paquetes de Ego sin requerir traducción entre lenguajes.

### Divergencias Fundamentales (Qué Descartamos y Por Qué)

| Dimensión | OpenClaw | Ego (Cognitive OS) | Decisión Crítica |
|---|---|---|---|
| **Sustrato de Memoria** | Archivos Markdown planos + Kysely ORM sobre SQLite (`node-sqlite.mjs`). | VantaDB 0.8.0 nativo in-process (`NativeVantaDB` vía napi-rs) + Fjall LSM + HNSW + BM25 + GraphRAG. | **DESCARTAR SQLite**. Ego utiliza `NativeVantaDB` como sustrato único soberano. Se descarta la capa Kysely de OpenClaw. |
| **Arquitectura de Interfaz** | Gateway Headless orientado a red local + clientes de mensajería (WhatsApp/Telegram) + Web Control UI. | Aplicación Desktop Soberana (Electron 40 + React 19 + Assistant-UI) con Dynamic Workspace. | **DESCARTAR Web UI headless**. Ego se concentra en su experiencia desktop de alta fidelidad. |
| **Transporte Principal** | Servidor WebSocket/HTTP en loopback (`127.0.0.1`). | IPC nativo de Electron fuertemente tipado (`contextBridge`) con aislamiento de contexto. | **ADAPTAR**. No levantamos sockets TCP/HTTP internos para la UI local; usamos el bus IPC seguro de Electron. |

---

## 2. Inventario Quirúrgico de Patrones a Extraer

### Bloque A: Gobernanza de Ejecución y Contexto de Admisión
*Ubicación en fuente:* `repos-referencia/openclaw/src/agents/admitted-run-context.ts`

1. **`AdmittedRunContext` & `OperationalRunInstanceRef`**
   - **Qué hace:** Formaliza la admisión inmutable de cada ejecución del agente. Cada run lleva un token de identidad, identificador de instancia y `runId` único para trazabilidad estricta.
   - **Adaptación en Ego:** Incorporado en el `ExecutionManager` de Ego (`packages/core/execution/admitted-run-context.ts`), garantizando que cada llamada a un Sub-Ego o Tool lleve contexto auditable y cancelable.
   - **Relación con Backlog Ego:** `ACT-01`, `ACT-03`.

2. **Propagación Nativa de `AbortSignal`**
   - **Qué hace:** Asocia un `AbortSignal` a la autoridad del operador (`AdmittedRunOperatorAuthority`). Si el usuario cancela la tarea, el signal se propaga en cascada abortando llamadas a modelos, procesos de terminal y consultas de base de datos.
   - **Adaptación en Ego:** Integración en `EgoMemoryAdapter` y el pipeline IPC de Electron.
   - **Relación con Backlog Ego:** `CORE-02`, `ACT-03`.

---

### Bloque B: Resiliencia en Invocación de Herramientas
*Ubicación en fuente:* `repos-referencia/openclaw/packages/tool-call-repair/`

1. **Auto-Reparación Sintáctica de Tool Calls (`packages/tool-call-repair`)**
   - **Qué hace:** Intercepta salidas de modelos LLM cuando emiten llamadas a herramientas malformadas (JSON truncado por límites de tokens, comillas sin cerrar, nombres de parámetros aproximados o tipos string en lugar de números). Aplica un motor de reparación heurístico en TypeScript antes de que la llamada falle.
   - **Adaptación en Ego:** Integrado en el despachador de herramientas (`packages/execution/tool-call-repair.ts`), evitando que fallos menores de modelos locales (Ollama Llama 3) interrumpan el flujo de trabajo.
   - **Relación con Backlog Ego:** `ACT-01`, `ACT-09` (RFC-OCLW-01).

---

### Bloque C: Ciclo de Vida de Sesiones y Paginación
*Ubicación en fuente:* `repos-referencia/openclaw/src/sessions/`

1. **Locks Atómicos por Sesión (`session-lifecycle-locks.ts`)**
   - **Qué hace:** Exclusión mutua que garantiza que dos eventos concurrentes (ej. un webhook en segundo plano y un mensaje del usuario) no muten la misma sesión al mismo tiempo.
   - **Adaptación en Ego:** Implementado en el gestor de sesiones de Ego sobre memoria VantaDB.
   - **Relación con Backlog Ego:** `CORE-07`, `REC-01`.

2. **Ventanas Deslizantes de Transcripción (`transcript-read-window.ts`)**
   - **Qué hace:** Paginación de lecturas de mensajes para hilos muy largos, cargando solo los últimos $N$ turnos en memoria para visualización y ensamblado de contexto.
   - **Adaptación en Ego:** Utilizado para la carga virtualizada de mensajes en `@assistant-ui/react`.
   - **Relación con Backlog Ego:** `CORE-05`, `CORE-07`.

3. **Seguimiento de Diffs y Revisiones Acumuladas (`session-diff-revisions.ts`)**
   - **Qué hace:** Rastrea y calcula los cambios incrementales de archivos realizados a lo largo de una sesión, permitiendo inspeccionar qué modificó el agente en conjunto.
   - **Adaptación en Ego:** Base del panel de revisión de cambios en el Dynamic Workspace de Ego.
   - **Relación con Backlog Ego:** `ACT-10`, `CANV-06` (RFC-OCLW-02).

---

### Bloque D: Seguridad y Workers Aislados
*Ubicación en fuente:* `repos-referencia/openclaw/packages/`

1. **Política de Seguridad de Red (`packages/net-policy/`)**
   - **Qué hace:** Validador estricto de URLs que bloquea peticiones SSRF a `localhost`, `127.0.0.1`, `169.254.169.254` (metadatos AWS) o redes privadas cuando las herramientas del agente hacen web fetching.
   - **Adaptación en Ego:** Módulo de seguridad para herramientas de navegación web (`packages/security/net-policy.ts`).
   - **Relación con Backlog Ego:** `SEC-01`, `SEC-02`.

2. **Runtime de Workers en Node.js (`packages/worker-runtime/`)**
   - **Qué hace:** Ejecución de tareas pesadas de CPU en `node:worker_threads` independientes para evitar congelar el hilo principal.
   - **Adaptación en Ego:** Vital para que las tareas en segundo plano de Ego no bloqueen la interfaz gráfica en Electron Main.
   - **Relación con Backlog Ego:** `TASK-05` (RFC-OCLW-03).

3. **Renderizado de Mermaid (`packages/mermaid-renderer/`)**
   - **Qué hace:** Validación AST y generación SVG de diagramas Mermaid.
   - **Adaptación en Ego:** Componente de renderizado para el Canvas del Workspace Dinámico.
   - **Relación con Backlog Ego:** `CANV-03`, `CANV-05`.

---

## 3. Matriz de Extracción vs Descarte

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
| `node-sqlite.mjs` / Kysely SQLite | **DESCARTAR** | Ego utiliza `NativeVantaDB` como sustrato único soberano. |
| `src/channels/*` (20+ adaptadores de red) | **DESCARTAR EN P0** | Postergar a P1 para mantener el foco en la aplicación Desktop SOC. |
| Control UI Web / TUI | **DESCARTAR** | Ego cuenta con su propia UI de escritorio en Electron + React 19. |

---

## 4. Nuevas Capacidades Evaluadas e Incorporadas (RFCs Aprobados)

Derivado de la investigación técnica en OpenClaw, se formalizan e incorporan tres nuevos RFCs en el Backlog de Ego (ver detalle en [`docs/research/openclaw-deep-dive.md`](../research/openclaw-deep-dive.md)):

1. **RFC-OCLW-01: Auto-Reparación de Tool Calls (`packages/tool-call-repair`)**
   - *Destino:* `ACT-09` (Fase 02). Reparación determinista de JSON roto sin consumir turnos del LLM.
2. **RFC-OCLW-02: Grafo de Diffs Acumulados por Sesión (`src/sessions/session-diff-revisions.ts`)**
   - *Destino:* `ACT-10` (Fase 02) y `CANV-06` (Fase 04). Visualización de cambios acumulados en el Canvas.
3. **RFC-OCLW-03: Runtime de Workers en Background (`packages/worker-runtime`)**
   - *Destino:* `TASK-05` (Fase 07). Ejecución de procesamiento en `worker_threads` para fluidez total de Electron.
