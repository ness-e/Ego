---
title: Active Backlog — Ego Cognitive Operating System
kind: engineering
status: active
description: "Catálogo exhaustivo de tareas de construcción de Ego por fases (Fases 01 a 12), arquitectura P0, matrices de compuertas de extracción (Opción B) y criterios de aceptación."
tags: [ego, soc, cognitive-os, backlog, roadmap, phases, vertical-slice, extraction-gates]
schema: "10-column canonical schema (.agents/references/backlog-format.md compatible)"
---

# Active Backlog — Ego Cognitive Operating System

> **Propósito:** Fuente única de verdad de todas las tareas técnicas y de producto de Ego — organizadas por orden de ejecución en 12 fases secuenciales (Vertical Slice).
> **Estrategia:** Corte vertical desde el Cognitive Runtime hacia afuera. Fases 01 a 05 conforman **P0-Alpha** (Núcleo Cognitivo); Fases 06 a 12 conforman **P0-Beta** (Producto, Operación y Distribución).
> **Regla de Finalización (Fase = DONE):** `IMPLEMENTADO + INTEGRADO + PRUEBA FUNCIONAL PASA + PRUEBA DE ERROR PASA + PERSISTENCIA VERIFICADA + NO HAY REGRESIONES CRÍTICAS + CRITERIOS UX CUMPLIDOS`.
> **Esquema:** Tabla canónica de 10 columnas:
> `| ID | Severidad | Hallazgo | Archivo:línea | Esfuerzo | Prioridad | Estado | Descripción | Relaciones | Dependencias |`

---

## Exec Summary

| Fase | Título | Rango de IDs | Tareas | Hito | Esfuerzo Estimado | Prioridad | Criterio de Aceptación Clave |
|---|---|---|:---:|:---:|:---:|:---:|---|
| **Fase 01** | Core Cognitivo | `CORE-01..15` | 15 | **P0-Alpha** | 2-3 semanas | ✅ Completada (15/15) | Chat local funcional con persistencia real en VantaDB tras reinicio |
| **Fase 02** | Acción & Tools | `ACT-01..12` | 12 | **P0-Alpha** | 2-3 semanas | 🟡 En curso (8/12) | Tool Calling local controlado con aprobación humana (HITL) |
| **Fase 03** | Sub-Egos | `SUB-01..12` | 12 | **P0-Alpha** | 2-3 semanas | 🔴 P0 | Múltiples Sub-Egos cooperan recursivamente compartiendo memoria |
| **Fase 04** | Dynamic Workspace | `CANV-01..12` | 12 | **P0-Alpha** | 3-4 semanas | 🔴 P0 | Canvas generativo declarativo desacoplado del chat clásico |
| **Fase 05** | Decision Intelligence | `DEC-01..09` | 9 | **P0-Alpha** | 2 semanas | 🔴 P0 | Ego clasifica y delega autónomamente al Sub-Ego óptimo (Golden Path Alpha) |
| **Fase 06** | Knowledge & Data | `KB-01..11` | 11 | **P0-Beta** | 3 semanas | 🟠 P1 | Búsqueda híbrida (RRF) y GraphRAG sobre repositorios locales |
| **Fase 07** | Tasks & Background | `TASK-01..11` | 11 | **P0-Beta** | 2-3 semanas | 🟠 P1 | Tareas persistentes en background con checkpoints de estado |
| **Fase 08** | Daily State | `DS-01..08` | 8 | **P0-Beta** | 1-2 semanas | 🟠 P1 | Asistente de operaciones continuo con briefing dinámico diario |
| **Fase 09** | Dominios Funcionales | `DOM-01..09` | 9 | **P0-Beta** | 3-4 semanas | 🟠 P1 | Workspaces especializados (Engineering, Product, CRM, Analytics) |
| **Fase 10** | Recovery & Hardening | `REC-01..09` | 9 | **P0-Beta** | 2 semanas | 🟠 P1 | Tolerancia total a crashes, snapshots y exportación `.vdbdump` |
| **Fase 11** | Seguridad | `SEC-01..09` | 9 | **P0-Beta** | 2 semanas | 🟠 P1 | Sandboxing riguroso, validación IPC y gestión segura de secretos |
| **Fase 12** | Distribución | `DIST-01..12` | 12 | **P0-Beta** | 2-3 semanas | 🟠 P1 | Instaladores firmados (NSIS/DMG) con auto-updater y clean machine |
| **TOTAL** | **12 Fases Completas** | — | **129** | **P0 Completo** | **~28–36 semanas** | — | **Golden Path Beta multi-día y multi-dominio completado** |

> **Backlogs Especializados de Referencia y Extracción (7 Repositorios):**
> Para acelerar la implementación sin reinventar la rueda ni importar deuda técnica, Ego mantiene 7 backlogs especializados derivados del escrutinio profundo de `repos-referencia/`:
> - [`docs/review/backlog-hermes.md`](../review/backlog-hermes.md): 19 tareas (`HERM-01..19`) — gemelo de stack `hermes-agent` (UI assistant-ui, artifacts, hardening Windows, packaging). Ficha: [`hermes-agent.md`](../extractions/hermes-agent.md).
> - [`docs/review/backlog-openclaw.md`](../review/backlog-openclaw.md): 15 tareas (`OCLW-01..15`) — `openclaw` (admisión inmutable de runs, auto-reparación de tools, locks de sesión y workers). Ficha: [`openclaw.md`](../extractions/openclaw.md).
> - [`docs/review/backlog-coucou.md`](../review/backlog-coucou.md): 16 tareas (`COUC-01..16`) — `coucou` (normalización en el borde, atención, HITL con ACK, ChangeSet, SafeConfigMutation). Ficha: [`coucou.md`](../extractions/coucou.md).
> - [`docs/review/backlog-khoj.md`](../review/backlog-khoj.md): 5 tareas (`KHOJ-01..05`) — `khoj` (chunking de 256 tokens con deduplicación, filtrado de confianza coseno y extracción de hechos). Ficha: [`khoj.md`](../extractions/khoj.md).
> - [`docs/review/backlog-helmor.md`](../review/backlog-helmor.md): 4 tareas (`HELM-01..04`) — `helmor` (programador de drenado PTY / coalescencia de ráfagas terminales y puente reactivo de UI). Ficha: [`helmor.md`](../extractions/helmor.md).
> - [`docs/review/backlog-career-ops.md`](../review/backlog-career-ops.md): 4 tareas (`CARP-01..04`) — `career-ops` (contrato de datos Usuario vs Sistema, locks atómicos en FS y cuarentena de inputs). Ficha: [`career-ops.md`](../extractions/career-ops.md).
> - [`docs/review/backlog-deepseek-harness.md`](../review/backlog-deepseek-harness.md): 4 tareas (`DSEK-01..04`) — `deepseek-harness` (sesiones versionadas, IDs opacos y patrón supersede sin borrado destructivo). Ficha: [`deepseek-harness.md`](../extractions/deepseek-harness.md).
>
> ### 🛑 Protocolo Canónico de Compuertas de Extracción e Inspección Previa (Opción B)
> **Regla Obligatoria:** Antes de iniciar la codificación de tareas en cualquier fase, el implementador o agente debe ejecutar la **Matriz de Compuertas de Extracción e Inspección Previa** asociada a dicha fase:
> 1. **Inspección Quirúrgica de Capacidades:** Consultar la ficha técnica canónica en `docs/extractions/<repo>.md` y el backlog de revisión en `docs/review/backlog-<repo>.md`. No limitarse a fórmulas abstractas: inspeccionar qué features, herramientas, complementos y flujos UX implementa el repositorio fuente.
> 2. **Evaluación de Guardrails y Factibilidad:** Evaluar si la capacidad respeta los 10 principios innegociables de Ego (`AGENTS.md`). Prohibido importar dependencias pesadas de Python, bases relacionales SQLite o esquemas de negocio ajenos (ej. postulaciones ATS o scrapers masivos).
> 3. **Síntesis de Decisión Técnica (Veredicto):** Definir si el patrón se **Asimila** directamente, se **Adapta** a TypeScript/React 19/VantaDB o se marca como **`🚫 Descartada (con justificación)`** documentalmente.
> 4. **Cierre de Compuerta y Ejecución:** Asentar la evidencia en la ficha técnica y proceder con la implementación y verificación de las tareas canónicas de Ego.

---

## 🚀 FASE 01: Core Cognitivo (P0-Alpha)

> **Objetivo:** Establecer la base del Sistema Operativo Cognitivo: Electron, VantaDB in-process, Model Router, streaming de chat y persistencia verificada tras reinicio.

### 🛑 Matriz de Compuertas de Extracción e Inspección Previa (Fase 01)

| ID Compuerta | Repo Origen | Patrón / Feature a Inspeccionar | Ficha Canónica | Tareas Ego Habilitadas | Decisión / Acción Esperada | Estado |
|:---:|---|---|---|---|---|:---:|
| `HERM-01` | hermes-agent | Primitivas `@assistant-ui/react` y chat shell | [`hermes-agent.md`](../extractions/hermes-agent.md) | `CORE-05` | 📥 Asimilar componentes para chat y streaming | ✅ Completada |
| `HERM-02` | hermes-agent | Pipeline seguro de markdown y explicabilidad AST | [`hermes-agent.md`](../extractions/hermes-agent.md) | `CORE-05` | 📥 Adaptar renderizado seguro y accordion de auditoría | ✅ Completada |
| `HERM-06` | hermes-agent | Resolución de variables de entorno y PATH Windows | [`hermes-agent.md`](../extractions/hermes-agent.md) | `CORE-01` | 📥 Inyectar PATH de usuario en Electron Main | ✅ Completada |
| `HERM-07` | hermes-agent | Sandbox fallback seguro para Chromium en Windows | [`hermes-agent.md`](../extractions/hermes-agent.md) | `CORE-02` | 📥 Hardening de procesos sin degradar sandbox | ✅ Completada |
| `COUC-01` | coucou | Normalización de eventos externos en el borde | [`coucou.md`](../extractions/coucou.md) | `CORE-01`, `CORE-02` | 📥 Contrato `EventIngress -> EventNormalizer` | ✅ Completada |
| `DSEK-01` | deepseek-harness | Patrón supersede histórico (soft-replace) | [`deepseek-harness.md`](../extractions/deepseek-harness.md) | `CORE-07` | 📥 Inmutabilidad de versiones en VantaDB | ✅ Completada |
| `DSEK-03` | deepseek-harness | Identificadores de sesión opacos e inmutables | [`deepseek-harness.md`](../extractions/deepseek-harness.md) | `CORE-01`, `CORE-06` | 📥 Prefijos estructurados para claves de sesión | ✅ Completada |
| `CARP-01` | career-ops | Contrato de partición de datos (User vs System) | [`career-ops.md`](../extractions/career-ops.md) | `CORE-07` | 📥 Inmutabilidad de datos de usuario en VantaDB | ✅ Completada |
| `KHOJ-03` | khoj | Filtrado de ruido por umbral de similitud coseno | [`khoj.md`](../extractions/khoj.md) | `CORE-09` | 📥 Corte dinámico de confianza en búsqueda híbrida | ✅ Completada |
| `KHOJ-04` | khoj | Heurística estructurada de extracción de hechos | [`khoj.md`](../extractions/khoj.md) | `CORE-12` | 📥 Extracción de hechos post-turno en lifecycle | ✅ Completada |

### Catálogo de Tareas Canónicas (Fase 01)

| ID | Severidad | Hallazgo | Archivo:línea | Esfuerzo | Prioridad | Estado | Descripción | Relaciones | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| `CORE-01` | 🔴 Crítica | **Scaffolding Electron + React 19 + TypeScript + Vite** | `apps/desktop/` | 🟡 1-2d | 🔴 P0 | ✅ Completada | Monorepo pnpm configurado, React 19 + Vite en renderer, Tailwind v4, paths limpios y typecheck verde sin Next.js. | Ver: `AGENTS.md` §1 · Compuertas: `HERM-06`, `DSEK-03` | — |
| `CORE-02` | 🔴 Crítica | **Preload IPC fuertemente tipado con aislamiento de contexto** | `apps/desktop/src/preload.ts` | 🟢 1d | 🔴 P0 | ✅ Completada | `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. Esquemas Zod en `src/ipc/schema.ts` y listeners tipados. | Ver: `docs/architecture/ui-runtime.md` · Compuertas: `HERM-07`, `COUC-01` | `CORE-01` |
| `CORE-03` | 🔴 Crítica | **Model Router propio con adaptador AI SDK v7** | `packages/models/` | 🟡 2-3d | 🔴 P0 | ✅ Completada | Abstracción `EgoModelInterface` y clase `ModelRouter` con enrutamiento inteligente por roles funcionales, costo, latencia y fallback mock. | Ver: `docs/architecture/vision-general.md` | `CORE-01` |
| `CORE-04` | 🟠 Alta | **Soporte multi-proveedor base (Cloud + Local Offline)** | `packages/models/src/providers/` | 🟡 1-2d | 🔴 P0 | ✅ Completada | Implementación de `OpenAICompatibleProvider` (OpenAI, DeepSeek, Ollama local en `localhost:11434`) y `MockProvider` determinista. | Ver: `docs/engineering/stack-tecnico.md` | `CORE-03` |
| `CORE-05` | 🟠 Alta | **Chat UI interactivo con streaming (@assistant-ui/react)** | `apps/desktop/renderer/components/` | 🟡 2-3d | 🔴 P0 | ✅ Completada | Primitivas de `@assistant-ui/react` conectadas al canal `llmStream`, visualizando badge de memoria `🧠 EgoRecallStatus`. | Ver: `docs/product/ux-ui.md` · Compuertas: `HERM-01`, `HERM-02` | `CORE-01` |
| `CORE-06` | 🔴 Crítica | **Inicialización asíncrona de EgoMemoryAdapter en Main process** | `apps/desktop/src/main.ts:29` | 🟢 2h | 🔴 P0 | ✅ Completada | Invocación obligatoria `await adapter.init()` en `createWindow()` con apertura del motor de persistencia antes de exponer la ventana. | Ver: `packages/memory/EgoMemoryAdapter.ts` | `CORE-01` |
| `CORE-07` | 🔴 Crítica | **Persistencia verificada en disco (Fjall LSM) entre reinicios** | `packages/memory/EgoMemoryAdapter.ts` | 🟡 1-2d | 🔴 P0 | ✅ Completada | Persistencia física comprobada en `ego_memory.vdb` en la carpeta `userData` del SO mediante `NativeVantaDB` (Fjall LSM) y recuperación íntegra de estado. | Ver: `docs/testing/estrategia.md` · Compuertas: `DSEK-01`, `CARP-01` | `CORE-06` |
| `CORE-08` | 🟠 Alta | **Auto-Embed local y desacoplamiento Fast vs Cognitive Path** | `packages/memory/` | 🟡 1d | 🔴 P0 | ✅ Completada | Auditoría de motor VantaDB completada: delimitado Fast Path in-process (BM25 sin coste de embeddings en TS) y Cognitive Path (L0-L3 delegable a `vantadb-mcp`). | Ver: `docs/architecture/memoria-vantadb.md` §8 | `CORE-06` |
| `CORE-09` | 🟠 Alta | **Búsqueda híbrida federada concurrente con `searchMulti`** | `packages/memory/EgoMemoryAdapter.ts:147` | 🟡 1-2d | 🔴 P0 | ✅ Completada | Búsqueda federada paralela en namespaces (`kb/*`, `projects/*`, `session/*`) con expansión de comodines y ordenamiento unificado por score. | Ver: `docs/architecture/namespaces.md` · Compuerta: `KHOJ-03` | `CORE-06` |
| `CORE-10` | 🟡 Media | **Exportación e importación básica de sesiones (.vdbdump)** | `packages/memory/EgoMemoryAdapter.ts:495` | 🟢 1d | 🔴 P0 | ✅ Completada | Métodos `exportDump` e `importDump` con cabecera canónica `VDBJSON\n`, streaming JSONL, hash SHA-256 y restauración atómica en disco. | Ver: `docs/architecture/memoria-vantadb.md` §15 | `CORE-07` |
| `CORE-11` | 🔴 Crítica | **Validación E2E del Golden Path Alpha (Pasos 1 al 7)** | `tests/e2e/golden-path-alpha.test.ts` | 🟡 2d | 🔴 P0 | ✅ Completada | Suite E2E automatizada que valida ciclo de 7 pasos: Apertura → Proyecto → Hechos L0-L3 → Turno con 🧠 → .vdbdump → Cierre → Reinicio y recuperación intacta. | Ver: `docs/roadmap/roadmap.md` §P0-Alpha | `CORE-01`..`CORE-10` |
| `CORE-12` | 🔴 Crítica | **Unificación de Ciclo de Vida de Memoria (Hermes + VantaDB L0-L3)** | `packages/memory/EgoMemoryLifecycle.ts` | 🟡 1-2d | 🔴 P0 | ✅ Completada | Módulo `EgoMemoryLifecycle` con 6 fases: Session admission, Pre-turn prefetch con glifo 🧠, micro-checkpoints, post-turn sync y dream consolidation. | Ver: `docs/architecture/ciclo-memoria-unificado.md` · Compuerta: `KHOJ-04` | `CORE-06`, `CORE-07` |
| `CORE-13` | 🔴 Crítica | **Cognitive Navigation Sidebar (Dual Rail & Drawer)** | `apps/desktop/renderer/components/sidebar.tsx` | 🟡 1-2d | 🔴 P0 | ✅ Completada | Panel lateral de 3 estados (Rail 54px, Drawer 260px, Hidden), selectores de Proyectos/Sub-Egos/Sesiones, atajos de teclado (`Ctrl+B`, `Ctrl+N`, `Ctrl+K`) y modal de configuración. | Ver: `docs/architecture/navigation-sidebar.md` | `CORE-01`, `CORE-05` |
| `CORE-14` | 🟠 Alta | **Manejo visible de errores de turno en Chat UI (`ipc.chat.error`)** | `apps/desktop/src/preload.ts` · `apps/desktop/renderer/components/ego-chat.tsx` | 🟢 1d | 🔴 P0 | ✅ Completada | Listener `onChatError` expuesto en preload, tarjeta visual de error reactiva con botón de reintento (`Retry`) sin perder el prompt y banner de alerta en `@assistant-ui/react`. | Ver: `CORE-05` | Dep: `CORE-05` |
| `CORE-15` | 🔴 Crítica | **Suite de contrato EgoMemoryAdapter ↔ NativeVantaDB (lado Ego de MEMG-24)** | `packages/memory/test/contract-vantadb.test.ts` | 🟡 2-3d | 🔴 P0 | ✅ Completada | Pinean firmas y comportamiento (put/get/searchMulti/cursor/wildcard/escalares) contra el commit pineado de VantaDB; fallan ante breaking changes del binding. Contrapartida de VantaDB `MEMG-24`. | Origen: VantaDB `MEMG-24` + `DIST-19` | Dep: `CORE-06` |

---

## ⚡ FASE 02: Acción & Tool Calling (P0-Alpha)

> **Objetivo:** Permitir que el sistema ejecute herramientas locales controladas, maneje errores de forma resiliente y requiera aprobación humana en acciones sensibles.

### 🛑 Matriz de Compuertas de Extracción e Inspección Previa (Fase 02)

| ID Compuerta | Repo Origen | Patrón / Feature a Inspeccionar | Ficha Canónica | Tareas Ego Habilitadas | Decisión / Acción Esperada | Estado |
|:---:|---|---|---|---|---|:---:|
| `COUC-03` | coucou | ActionIdentity digest y modelo causal de acción | [`coucou.md`](../extractions/coucou.md) | `ACT-04`, `ACT-06` | 📥 Hashear intención y parámetros antes de ejecutar | ✅ Completada |
| `COUC-04` | coucou | Human-in-the-loop (HITL) interactivo con ACK en borde | [`coucou.md`](../extractions/coucou.md) | `ACT-06`, `ACT-07` | 📥 Conexión mantenida hasta confirmación o timeout | ✅ Completada |
| `COUC-10` | coucou | Mutación segura de configuración (`SafeConfigMutation`) | [`coucou.md`](../extractions/coucou.md) | `ACT-09`, `ACT-11` | 📥 Reload atómico de herramientas y servidores MCP | 🆕 Pendiente |
| `COUC-11` | coucou | Escritura atómica en FS con snapshot previo de reversión | [`coucou.md`](../extractions/coucou.md) | `ACT-04` | 📥 Backup temporal antes de modificar archivos en disco | ✅ Completada |
| `CARP-02` | career-ops | Exclusión mutua concurrente por lockfile atómico | [`career-ops.md`](../extractions/career-ops.md) | `ACT-04` | 📥 Prevenir colisiones de escritura de tools/agentes | ✅ Completada |
| `CARP-03` | career-ops | Cobertura estricta y whitelist de rutas de sistema | [`career-ops.md`](../extractions/career-ops.md) | `ACT-04` | 📥 Bloquear escrituras fuera de directorios de proyecto | ✅ Completada |
| `CARP-04` | career-ops | Cuarentena y desinfección de payloads untrusted | [`career-ops.md`](../extractions/career-ops.md) | `ACT-06` | 📥 Aislar respuestas de herramientas no seguras | ✅ Completada |
| `HELM-01` | helmor | Programador de drenado PTY y coalescencia (16KB/tick) | [`helmor.md`](../extractions/helmor.md) | `ACT-04` | 📥 Evitar congelamiento de UI por ráfagas de consola | ✅ Completada |
| `HELM-02` | helmor | Ring-buffer cap de 2MB anti-OOM en salidas CLI | [`helmor.md`](../extractions/helmor.md) | `ACT-03`, `ACT-04` | 📥 Truncado determinista de logs masivos en memoria | ✅ Completada |
| `HELM-04` | helmor | Sanitización de IME y emisión de señales SIGINT/SIGTERM | [`helmor.md`](../extractions/helmor.md) | `ACT-04` | 📥 Cancelación cooperativa de comandos interactivos | ✅ Completada |
| `OCLW-03` | openclaw | Auto-reparación en vuelo de llamadas a tools malformadas | [`openclaw.md`](../extractions/openclaw.md) | `ACT-08` | 📥 Reintentos guiados con contexto causal exacto | ✅ Completada |
| `OCLW-04` | openclaw | Normalización estricta de argumentos de tools con Zod | [`openclaw.md`](../extractions/openclaw.md) | `ACT-01`, `ACT-08` | 📥 Coerción de tipos y validación previa a ejecución | ✅ Completada |
| `OCLW-08` | openclaw | Parser de diffs unificados (Unidiff) para previsualización | [`openclaw.md`](../extractions/openclaw.md) | `ACT-04`, `ACT-07` | 📥 Renderizado limpio de cambios antes de aprobar | ✅ Completada |
| `HERM-03` | hermes-agent | Interfaz visual de directivas interactivas (`ask-directive.tsx`) | [`hermes-agent.md`](../extractions/hermes-agent.md) | `ACT-06`, `ACT-07` | 📥 Tarjetas HITL inline en `@assistant-ui/react` | ✅ Completada |
| `HERM-18` | hermes-agent | Ejecución de RPC Kernel local sin turnos de modelo | [`hermes-agent.md`](../extractions/hermes-agent.md) | `ACT-09` | 📥 Despacho directo de herramientas del sistema | 🆕 Pendiente |
| `HERM-19` | hermes-agent | Linter AST de Skills y políticas de aislamiento de extensiones | [`hermes-agent.md`](../extractions/hermes-agent.md) | `ACT-11` | 📥 Validación de manifiestos y seguridad de extensiones | 🆕 Pendiente |

### Catálogo de Tareas Canónicas (Fase 02)

| ID | Severidad | Hallazgo | Archivo:línea | Esfuerzo | Prioridad | Estado | Descripción | Relaciones | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| `ACT-01` | 🔴 Crítica | **Tool Registry desacoplado del Cognitive Runtime** | `packages/tools/ToolRegistry.ts` | 🟡 2-3d | 🔴 P0 | ✅ Completada | Registro central de herramientas declarativas con esquemas Zod, clasificación taxonómica, nivel de riesgo (safe, sensitive, destructive), políticas HITL, exportación JSON Schema y adaptadores AI SDK v7. | Ver: `docs/architecture/vision-general.md` | `CORE-03` |
| `ACT-02` | 🔴 Crítica | **Soporte de Tool Calling multi-turno con AI SDK v7** | `packages/runtime/ToolExecutionLoop.ts` | 🟡 2-3d | 🔴 P0 | ✅ Completada | Orquestación cognitiva multi-turno: validación Zod, inyección causal de rol tool, suspensión y reanudación HITL, protección anti-bucles (maxSteps) y telemetría de eventos. | Ver: `docs/architecture/vision-general.md` | `ACT-01` |
| `ACT-03` | 🔴 Crítica | **Execution Manager con aislamiento, timeouts y cuotas** | `packages/execution/ExecutionManager.ts` | 🟡 2-3d | 🔴 P0 | ✅ Completada | Gestor supervisor de procesos y herramientas: timeouts por llamada, cancelación cooperativa (AbortController), control de concurrencia y límites de memoria/salida. | Ver: `docs/engineering/integraciones.md` · Compuerta: `HELM-02` | `ACT-02` |
| `ACT-04` | 🟠 Alta | **Conectores Nivel A Nativos (Filesystem, Git local, Terminal)** | `packages/tools/native/` | 🟡 2-3d | 🔴 P0 | ✅ Completada | Herramientas locales seguras: `fs_read_file`, `fs_write_file` (atómico y backup), `git_status`, `git_diff`, `terminal_exec` (restringido a workspace y ring buffer 2MB). | Ver: `docs/engineering/integraciones.md` §Nivel A · Compuertas: `COUC-03`, `COUC-11`, `CARP-02`, `CARP-03`, `HELM-01`, `HELM-04`, `OCLW-08` | `ACT-01` |
| `ACT-05` | 🟠 Alta | **Bus de eventos interno `EgoEvent` y logging estructurado** | `packages/events/EventBus.ts` | 🟢 1-2d | 🔴 P0 | ✅ Completada | EventEmitter tipado para trazabilidad de intenciones, ejecuciones de herramientas, fallos y latencias de turno con dispatch asíncrono y normalizador en el borde. | Ver: `docs/architecture/vision-general.md` · Compuerta: `COUC-01` [Finalizada 2026-10-08] | `CORE-01` |
| `ACT-06` | 🔴 Crítica | **Sistema de Aprobación de Acciones Sensibles (HITL / Approval)** | `packages/execution/src/ApprovalEngine.ts` | 🟡 2d | 🔴 P0 | ✅ Completada | Interceptor obligatorio: escrituras fuera de sandbox, borrado de archivos, ejecución de comandos bash o peticiones externas quedan congeladas hasta confirmación humana con ActionIdentity inmutable. | Ver: `docs/product/principios-innegociables.md` §6 · Compuertas: `COUC-03`, `COUC-04`, `CARP-04`, `HERM-03` | `ACT-03` |
| `ACT-07` | 🟠 Alta | **Componente interactivo de Aprobación en Chat UI** | `apps/desktop/renderer/components/tools/` | 🟢 1-2d | 🔴 P0 | ✅ Completada | Tarjeta interactiva en `@assistant-ui/react` con vista previa de acción, diff de archivos y botones explícitos: `Aprobar` / `Rechazar` / `Editar parámetros`. | Ver: `docs/architecture/ui-runtime.md` · Compuertas: `HERM-03`, `COUC-04`, `OCLW-08` | `ACT-06` |
| `ACT-08` | 🟠 Alta | **Manejo de errores y reintentos con contexto causal** | `packages/runtime/src/ErrorHandler.ts` | 🟢 1-2d | 🔴 P0 | ✅ Completada | Si una herramienta falla (permiso denegado, sintaxis errónea), inyectar el error exacto como mensaje de sistema para autocorrección guiada por el modelo. | Ver: `docs/roadmap/roadmap.md` §Fase 02 · Compuertas: `OCLW-03`, `OCLW-04` | `ACT-02` |
| `ACT-09` | 🟠 Alta | **Cliente MCP universal sobre stdio (Nivel B Integración)** | `packages/integrations/mcp/McpClient.ts` | 🟡 2-3d | 🔴 P0 | 🆕 Pendiente | Conexión e interoperabilidad con servidores MCP locales (ej. servidor oficial de GitHub), descubriendo e importando esquemas dinámicamente. | Ver: `docs/engineering/integraciones.md` §MCP · Compuertas: `COUC-10`, `HERM-18` | `ACT-01` |
| `ACT-10` | 🔴 Crítica | **Validación E2E del Golden Path Alpha (Pasos 8 al 12)** | `tests/e2e/tools-execution.test.ts` | 🟡 2d | 🔴 P0 | 🆕 Pendiente | Test E2E: Tarea solicitada → Modelo selecciona tool → Tool pide aprobación → Usuario aprueba → Tool ejecuta → Salida persiste en VantaDB. | Ver: `docs/roadmap/roadmap.md` | `ACT-01`..`ACT-07` |
| `ACT-11` | 🟠 Alta | **Gestor y Marketplace Local de MCP Servers y Skills a Elección** | `apps/desktop/renderer/components/mcp/` | 🟡 2d | 🔴 P0 | 🆕 Pendiente | Interfaz para que el usuario añada, configure y active servidores MCP (stdio/SSE) y carpetas de Skills personalizadas (`.ego/skills/`, `~/.ego/skills/`) con validación de seguridad. | Ver: `docs/engineering/integraciones.md` · Compuertas: `HERM-19`, `COUC-10` | `ACT-01`, `ACT-09` |
| `ACT-12` | 🔴 Crítica | **Integrar EventBus en ToolExecutionLoop y Desktop Main** | `packages/runtime/src/ToolExecutionLoop.ts` · `apps/desktop/src/main.ts` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | Emitir intent/tool/fallo/latencia de turno al bus en runtime y en los handlers IPC; test de que un turno genera eventos. Sin esto `ACT-05` es código huérfano (IMPLEMENTED pero no INTEGRATED). | Ver: `ACT-05` · Compuerta: `COUC-01` | Dep: `ACT-05`, `ACT-02` |

---

## 🧠 FASE 03: Sub-Egos (P0-Alpha)

> **Objetivo:** Habilitar el paradigma multi-Sub-Ego: especialistas persistentes, memoria compartida sobre VantaDB, delegación de tareas y aislamiento de estado privado.

### 🛑 Matriz de Compuertas de Extracción e Inspección Previa (Fase 03)

| ID Compuerta | Repo Origen | Patrón / Feature a Inspeccionar | Ficha Canónica | Tareas Ego Habilitadas | Decisión / Acción Esperada | Estado |
|:---:|---|---|---|---|---|:---:|
| `HERM-12` | hermes-agent | Slash commands para invocación directa de especialistas | [`hermes-agent.md`](../extractions/hermes-agent.md) | `SUB-01`, `SUB-02` | 📥 Comandos `/subego` integrados en el Chat | 🆕 Pendiente |
| `HERM-17` | hermes-agent | Aislamiento de workspaces de agente vía Git Worktrees | [`hermes-agent.md`](../extractions/hermes-agent.md) | `SUB-07` | 📥 Aislamiento físico de ramas sin clonar repos | 🆕 Pendiente |
| `HERM-19` | hermes-agent | Linter de seguridad AST para capacidades de agentes | [`hermes-agent.md`](../extractions/hermes-agent.md) | `SUB-05` | 📥 Control de acceso a namespaces autorizados | 🆕 Pendiente |
| `COUC-01` | coucou | Normalización de eventos estructurados inter-agente | [`coucou.md`](../extractions/coucou.md) | `SUB-06` | 📥 Bus de eventos de orquestación canónico | 🆕 Pendiente |
| `KHOJ-05` | khoj | Consolidación y refuerzo autónomo de memorias | [`khoj.md`](../extractions/khoj.md) | `SUB-12` | 📥 Closed learning loop y refuerzo en VantaDB | 🆕 Pendiente |
| `DSEK-03` | deepseek-harness | Identificadores opacos para entidades de Sub-Ego | [`deepseek-harness.md`](../extractions/deepseek-harness.md) | `SUB-01`, `SUB-04` | 📥 Claves inmutables prefijadas `sub_<id>` | 🆕 Pendiente |

### Catálogo de Tareas Canónicas (Fase 03)

| ID | Severidad | Hallazgo | Archivo:línea | Esfuerzo | Prioridad | Estado | Descripción | Relaciones | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| `SUB-01` | 🔴 Crítica | **Contrato y esquema formal `SubEgoManifest` tipado con Zod** | `packages/subegos/SubEgoManifest.ts` | 🟢 1d | 🔴 P0 | 🆕 Pendiente | Definir campos canónicos: `id`, `name`, `role`, `responsibilities`, `capabilities`, `tools`, `permissions`, `memoryScope`, `behavior`, `autonomy`. | Ver: `docs/architecture/agentes.md` · Compuertas: `HERM-12`, `DSEK-03` | `CORE-01` |
| `SUB-02` | 🟠 Alta | **Fábrica Inteligente de Sub-Egos (3 modalidades)** | `packages/subegos/SubEgoFactory.ts` | 🟡 2-3d | 🔴 P0 | 🆕 Pendiente | Soporte de creación: 1) Modo conversacional guiado por Ego, 2) Selección de plantillas por dominio, 3) Editor JSON/YAML avanzado. | Ver: `docs/architecture/agentes.md` · Compuerta: `HERM-12` | `SUB-01` |
| `SUB-03` | 🔴 Crítica | **Sub-Ego Runtime y ciclo de vida (Lazy Activation)** | `packages/subegos/SubEgoRuntime.ts` | 🟡 2-3d | 🔴 P0 | 🆕 Pendiente | Instanciación bajo demanda; los especialistas no consumen recursos en memoria si no tienen tareas activas asignadas. | Ver: `docs/architecture/agentes.md` | `SUB-01` |
| `SUB-04` | 🔴 Crítica | **Aislamiento de estado privado `egos/<id>/*` en VantaDB** | `packages/memory/EgoMemoryAdapter.ts:331` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | Garantizar que cada Sub-Ego tiene su scratchpad y estado local aislado en `egos/<id>/*`, inaccesible directamente por otros Sub-Egos. | Ver: `docs/architecture/namespaces.md` · Compuerta: `DSEK-03` | `CORE-06` |
| `SUB-05` | 🔴 Crítica | **Control de acceso a namespaces compartidos (`kb/*`, `crm/*`)** | `packages/memory/PermissionsGuard.ts` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | Enforzar en runtime que los Sub-Egos solo leen/escriben namespaces autorizados explícitamente en su manifiesto según `ego.namespaces.json`. | Ver: `docs/architecture/namespaces.md` · Compuerta: `HERM-19` | `SUB-04` |
| `SUB-06` | 🟠 Alta | **Orchestration Bus y protocolo de delegación inter-Sub-Ego** | `packages/subegos/OrchestrationBus.ts` | 🟡 2-3d | 🔴 P0 | 🆕 Pendiente | Comunicación estructurada entre especialistas: Sub-Ego A puede transferir contexto o sub-tareas a Sub-Ego B con trazabilidad causal inmutable. | Ver: `docs/architecture/vision-general.md` · Compuerta: `COUC-01` | `SUB-03` |
| `SUB-07` | 🟠 Alta | **Registro y catálogo de Sub-Egos en namespace `gov/sub_egos`** | `packages/memory/EgoMemoryAdapter.ts:331` | 🟢 1d | 🔴 P0 | ⏳ En curso | Métodos `registerSubEgo` y `listSubEgos` para persistencia duradera del catálogo de especialistas en VantaDB. | Ver: `packages/memory/EgoMemoryAdapter.ts` · Compuerta: `HERM-17` | `CORE-06` |
| `SUB-08` | 🟡 Media | **Vista y panel de gestión de Sub-Egos en UI (`SubEgosView`)** | `apps/desktop/renderer/components/SubEgosView.tsx` | 🟡 2d | 🔴 P0 | 🆕 Pendiente | Interfaz para listar Sub-Egos activos, inspeccionar sus manifiestos, ajustar permisos y revisar su consumo de tokens/memoria. | Ver: `docs/product/ux-ui.md` | `SUB-07` |
| `SUB-09` | 🟡 Media | **Límites de presupuesto y cuotas de consumo por Sub-Ego** | `packages/subegos/SubEgoBudget.ts` | 🟢 1d | 🔴 P0 | 🆕 Pendiente | Monitoreo de tokens de entrada/salida y costo acumulado por especialista con corte automático si supera el presupuesto asignado. | Ver: `docs/product/modelo-economico.md` | `SUB-03` |
| `SUB-10` | 🔴 Crítica | **Validación E2E del Golden Path Alpha (Pasos 10 al 14)** | `tests/e2e/subegos-delegation.test.ts` | 🟡 2d | 🔴 P0 | 🆕 Pendiente | Test E2E: Ego selecciona Sub-Ego → Sub-Ego consulta memoria compartida → Sub-Ego delega sub-tarea a segundo Sub-Ego → Resultado integrado emitido. | Ver: `docs/roadmap/roadmap.md` | `SUB-01`..`SUB-06` |
| `SUB-11` | 🔴 Crítica | **Sub-Ego Soul / Alma: Definición de Personalidad y Tono** | `packages/subegos/SubEgoSoul.ts` | 🟢 1d | 🔴 P0 | 🆕 Pendiente | Definición de identidad, tono, estilo de razonamiento y reglas innegociables por Sub-Ego (`SOUL.md` / `SubEgoManifest.soul`) persistido en `egos/<id>/soul` en VantaDB para consistencia perpetua. | Ver: `docs/architecture/subego-soul.md` | `SUB-01` |
| `SUB-12` | 🟠 Alta | **Superación Personal & Closed Learning Loop (Auto-Reflexión)** | `packages/subegos/SelfImprovementLoop.ts` | 🟡 2d | 🔴 P0 | 🆕 Pendiente | Mecanismo de auto-reflexión post-tarea: el Sub-Ego analiza errores, extrae patrones, auto-corrige sus propias habilidades y refuerza en VantaDB (`reinforce`) las estrategias exitosas. | Ver: `docs/architecture/subego-soul.md` · Compuerta: `KHOJ-05` | `SUB-02`, `SUB-03` |

---

## 🎨 FASE 04: Dynamic Workspace & Canvas (P0-Alpha)

> **Objetivo:** Trascender la interfaz de chat clásica: espacio de trabajo generativo declarativo (Canvas), manipulación interactiva de artefactos y explicabilidad contextual.

### 🛑 Matriz de Compuertas de Extracción e Inspección Previa (Fase 04)

| ID Compuerta | Repo Origen | Patrón / Feature a Inspeccionar | Ficha Canónica | Tareas Ego Habilitadas | Decisión / Acción Esperada | Estado |
|:---:|---|---|---|---|---|:---:|
| `HERM-01` | hermes-agent | Tarjetas interactivas de artefactos (`artifact-card.tsx`) | [`hermes-agent.md`](../extractions/hermes-agent.md) | `CANV-01`, `CANV-02` | 📥 Primitivas visuales desacopladas del chat | 🆕 Pendiente |
| `HERM-05` | hermes-agent | Renderizado seguro de streams de terminal y colores ANSI | [`hermes-agent.md`](../extractions/hermes-agent.md) | `CANV-07` | 📥 Visor de logs y consola enriquecida en Canvas | 🆕 Pendiente |
| `HERM-09` | hermes-agent | Arquitectura de paneles reajustables (`pane-shell`) | [`hermes-agent.md`](../extractions/hermes-agent.md) | `CANV-01` | 📥 Split-pane con colapso suave y persistente | 🆕 Pendiente |
| `COUC-05` | coucou | Desacoplamiento de 7 stores reactivos de UI | [`coucou.md`](../extractions/coucou.md) | `CANV-01`, `CANV-03` | 📥 Gestión de estado sin suscripciones redundantes | 🆕 Pendiente |
| `COUC-06` | coucou | Máquina de estados finitos de atención (Attention FSM) | [`coucou.md`](../extractions/coucou.md) | `CANV-11` | 📥 Ego Activity Widget con niveles de atención | 🆕 Pendiente |
| `COUC-07` | coucou | Motor de diffs y ChangeSet atómico con límites de payload | [`coucou.md`](../extractions/coucou.md) | `CANV-03` | 📥 Sync reactivo bidireccional Chat <-> Canvas | 🆕 Pendiente |
| `COUC-08` | coucou | Indirección de datos por referencia (`PayloadRef`) | [`coucou.md`](../extractions/coucou.md) | `CANV-02`, `CANV-06` | 📥 No transferir megabytes de datos por IPC crudo | 🆕 Pendiente |
| `COUC-14` | coucou | Emulador sintético de runtime (`SyntheticRuntime`) | [`coucou.md`](../extractions/coucou.md) | `CANV-10` | 📥 Mock interactivo para pruebas de UI sin backend | 🆕 Pendiente |
| `COUC-15` | coucou | Mock IPC Bridge para pruebas aisladas de componentes | [`coucou.md`](../extractions/coucou.md) | `CANV-01` | 📥 Aislamiento de tests en React sin Electron vivo | 🆕 Pendiente |
| `OCLW-07` | openclaw | Grafo inmutable de revisiones y diffs de sesión | [`openclaw.md`](../extractions/openclaw.md) | `CANV-06` | 📥 Persistencia de versiones de artefactos en VantaDB | 🆕 Pendiente |
| `OCLW-11` | openclaw | Renderizado reactivo y dinámico de diagramas Mermaid | [`openclaw.md`](../extractions/openclaw.md) | `CANV-01`, `CANV-03` | 📥 Componente de grafos y flujos en Canvas | 🆕 Pendiente |
| `OCLW-14` | openclaw | Bus de eventos de actividad de agentes en tiempo real | [`openclaw.md`](../extractions/openclaw.md) | `CANV-11` | 📥 Telemetría viva de agentes en Activity Widget | 🆕 Pendiente |
| `HELM-01` | helmor | Programador de salida PTY (16KB/tick) en visor Canvas | [`helmor.md`](../extractions/helmor.md) | `CANV-07` | 📥 Scroll suave y 60 FPS en visor de consola | 🆕 Pendiente |
| `HELM-03` | helmor | Almacén reactivo de sesiones CLI concurrentes | [`helmor.md`](../extractions/helmor.md) | `CANV-01`, `CANV-07` | 📥 Pestañas de consola desacopladas del árbol de UI | 🆕 Pendiente |

### Catálogo de Tareas Canónicas (Fase 04)

| ID | Severidad | Hallazgo | Archivo:línea | Esfuerzo | Prioridad | Estado | Descripción | Relaciones | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| `CANV-01` | 🔴 Crítica | **Catálogo declarativo de componentes UI (Esquemas Zod)** | `packages/ui-runtime/schemas/` | 🟡 2-3d | 🔴 P0 | 🆕 Pendiente | Definir contratos JSON para componentes generables: `Table`, `Card`, `Form`, `Chart`, `Board` (Kanban), `Editor` (Markdown/Code). | Ver: `docs/architecture/ui-runtime.md` · Compuertas: `HERM-09`, `COUC-05`, `COUC-15`, `OCLW-11`, `HELM-03` | `CORE-01` |
| `CANV-02` | 🔴 Crítica | **Canvas Generative Runtime en React 19** | `apps/desktop/renderer/components/canvas/` | 🔴 1-2sem | 🔴 P0 | 🆕 Pendiente | Renderizador dinámico seguro que traduce contratos JSON emitidos por Sub-Egos a componentes interactivos reales sin evaluar HTML crudo. | Ver: `docs/architecture/ui-runtime.md` · Compuertas: `HERM-01`, `COUC-08` | `CANV-01` |
| `CANV-03` | 🟠 Alta | **Protocolo bidireccional Chat ↔ Canvas (Sync reactivo)** | `packages/ui-runtime/CanvasBridge.ts` | 🟡 2-3d | 🔴 P0 | 🆕 Pendiente | Sincronización en tiempo real: mutaciones en el Canvas reflejan eventos en el Chat; instrucciones en el Chat modifican artefactos vivos del Canvas. | Ver: `docs/architecture/workspace-dinamico.md` · Compuertas: `COUC-07`, `OCLW-11` | `CANV-02` |
| `CANV-04` | 🟠 Alta | **Mecanismo de Selección de Contexto (Selection Context)** | `apps/desktop/renderer/hooks/useSelectionContext.ts` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | Permitir al usuario seleccionar filas, tarjetas o texto en el Canvas y enviarlo con un clic al Composer de Chat como contexto focalizado. | Ver: `docs/roadmap/roadmap.md` §Fase 04 | `CANV-02` |
| `CANV-05` | 🟡 Media | **Componentes de Sub-Ego (Report, Approval, Recommendation)** | `apps/desktop/renderer/components/canvas/agent/` | 🟡 2d | 🔴 P0 | 🆕 Pendiente | Bloques especializados de resumen ejecutivo, propuestas con justificación causal y solicitudes estructuradas de aprobación. | Ver: `docs/architecture/ui-runtime.md` §Agent | `CANV-01` |
| `CANV-06` | 🟠 Alta | **Persistencia de estado del Canvas en VantaDB** | `packages/ui-runtime/CanvasPersistence.ts` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | Los artefactos, tablas y diagramas generados en el Canvas persisten por proyecto en VantaDB (`workspace/*`) para reabrirse idénticos entre sesiones. | Ver: `docs/architecture/memoria-vantadb.md` · Compuertas: `OCLW-07`, `COUC-08` | `CORE-06` |
| `CANV-07` | 🟡 Media | **Explicabilidad Contextual ("¿Por qué?") bajo demanda** | `apps/desktop/renderer/components/explainability/` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | Botón contextual en artefactos y decisiones que despliega la justificación causal (modelo usado, memoria consultada, regla aplicada) sin panel fijo intrusivo. | Ver: `docs/product/ux-ui.md` §P11 · Compuertas: `HERM-05`, `HELM-01`, `HELM-03` | `CANV-02` |
| `CANV-08` | 🟡 Media | **Sistema de Personajes Procedural en Canvas 2D (`CharacterRuntime`)** | `apps/desktop/renderer/components/character/` | 🟡 2d | 🔴 P0 | 🆕 Pendiente | Motor procedural paramétrico en Canvas 2D / Path2D sin librerías pesadas: squircle deformable, proyección 3D de ojos con mouse-tracking, física de accesorios, morphing en 3 fases (350–550ms) y regla de estabilidad visual (anti-fatiga en chat). | Ver: `docs/architecture/character-system.md` | `CORE-01` |
| `CANV-09` | 🟡 Media | **Auditoría de Presupuesto UI (Semáforo 15–20% de esfuerzo)** | `docs/roadmap/metricas-okr.md:41` | 🟢 4h | 🔴 P0 | 🆕 Pendiente | Instrumentar seguimiento de horas invertidas en UI vs lógica para mantener la disciplina presupuestaria estipulada en la Decisión P22. | Ver: `docs/roadmap/metricas-okr.md` | — |
| `CANV-10` | 🔴 Crítica | **Validación E2E del Golden Path Alpha (Pasos 15 al 20)** | `tests/e2e/canvas-interaction.test.ts` | 🟡 2d | 🔴 P0 | 🆕 Pendiente | Test E2E: Sub-Ego emite contrato JSON → Canvas renderiza tabla interactiva → Usuario edita celda → Nuevo estado persiste en VantaDB. | Ver: `docs/roadmap/roadmap.md` · Compuerta: `COUC-14` | `CANV-01`..`CANV-06` |
| `CANV-11` | 🟠 Alta | **Ego Activity Widget (Ejecución, Atención y Aprobaciones HITL)** | `apps/desktop/renderer/components/activity-widget/` | 🟡 2d | 🔴 P0 | 🆕 Pendiente | Superficie viva en header/dock: telemetría de tareas activas, microanimaciones reactivas a tools (`scan-horizontal`, `pulse-breath`), resolución interactiva de aprobaciones HITL con atajos (`Enter`/`Esc`) y colas multi-agente (`[Dev] [Fin] +2`). | Ver: `docs/architecture/character-system.md` §6 · Compuertas: `COUC-06`, `OCLW-14` | `CANV-08`, `ACT-04` |
| `CANV-12` | 🟠 Alta | **Suite vitest para @ego/renderer (hoy 0 tests)** | `apps/desktop/renderer/` | 🟡 2-3d | 🟠 P1 | 🆕 Pendiente | Cobertura inicial de componentes críticos (`sidebar`, `ego-chat`, `shell`) con mock IPC bridge aislado de Electron vivo. Usa la compuerta `COUC-15` ya declarada y pendiente. | Ver: `CORE-05` · Compuerta: `COUC-15` | Dep: `CORE-01` |

---

## 🎯 FASE 05: Decision Intelligence (P0-Alpha / Hito Alpha)

> **Objetivo:** Automatizar la toma de decisiones cognitivas: clasificación estructurada de intenciones, scoring tipado, cascada de 3 niveles y cierre del Golden Path Alpha (20 pasos).

### 🛑 Matriz de Compuertas de Extracción e Inspección Previa (Fase 05)

| ID Compuerta | Repo Origen | Patrón / Feature a Inspeccionar | Ficha Canónica | Tareas Ego Habilitadas | Decisión / Acción Esperada | Estado |
|:---:|---|---|---|---|---|:---:|
| `COUC-03` | coucou | Modelo causal de evaluación previa a acción | [`coucou.md`](../extractions/coucou.md) | `DEC-01`, `DEC-02` | 📥 Precondiciones explícitas y hash de intención | 🆕 Pendiente |
| `OCLW-01` | openclaw | Admisión determinista de corridas y validación de contexto | [`openclaw.md`](../extractions/openclaw.md) | `DEC-01`, `DEC-02` | 📥 Veredictos tipados antes de despachar turnos | 🆕 Pendiente |
| `OCLW-02` | openclaw | Detección temprana de ciclos de delegación infinita | [`openclaw.md`](../extractions/openclaw.md) | `DEC-06` | 📥 Rompedor de bucles (profundidad > 4) con fallback | 🆕 Pendiente |
| `HERM-03` | hermes-agent | Directivas de clarificación interactiva ante incertidumbre | [`hermes-agent.md`](../extractions/hermes-agent.md) | `DEC-06` | 📥 Prompt estructurado al usuario cuando confianza < 0.6 | 🆕 Pendiente |

### Catálogo de Tareas Canónicas (Fase 05)

| ID | Severidad | Hallazgo | Archivo:línea | Esfuerzo | Prioridad | Estado | Descripción | Relaciones | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| `DEC-01` | 🔴 Crítica | **Abstracción de la Decision Intelligence Layer y DecisionRouter** | `packages/decision/DecisionRouter.ts` | 🟡 2-3d | 🔴 P0 | 🆕 Pendiente | Capa transversal que desacopla la evaluación de decisiones del proveedor subyacente; emite veredictos tipados en JSON estricto. | Ver: `docs/architecture/jev.md` · Compuertas: `COUC-03`, `OCLW-01` | `CORE-03` |
| `DEC-02` | 🔴 Crítica | **Clasificación tipada de intenciones y análisis de precondiciones** | `packages/decision/IntentClassifier.ts` | 🟡 2d | 🔴 P0 | 🆕 Pendiente | Mapeo determinista de intenciones del usuario hacia dominios, namespaces destino, urgencia y nivel de aprobación requerido. | Ver: `docs/architecture/jev.md` · Compuertas: `COUC-03`, `OCLW-01` | `DEC-01` |
| `DEC-03` | 🔴 Crítica | **Cascada de decisión en 3 niveles (Reglas → Jev → LLM local)** | `packages/decision/DecisionCascade.ts` | 🟡 2-3d | 🔴 P0 | 🆕 Pendiente | 1) Reglas regex deterministas ($0, <1ms) → 2) Modelo especializado de decisión → 3) Fallback a LLM estructurado (Ollama/Claude). | Ver: `docs/architecture/jev.md` §36 | `DEC-02` |
| `DEC-04` | 🟡 Media | **Adaptador externo opcional para Jev (TypeSafe AI System One)** | `packages/decision/providers/JevProvider.ts` | 🟢 1-2d | 🟡 Media | 🆕 Pendiente | Conector HTTPS a endpoint `/v1/systemone` para evaluación tipada en paralelo (70-500ms). Ego degrada limpiamente a reglas si no está configurado. | Ver: `docs/architecture/jev.md` §15 | `DEC-03` |
| `DEC-05` | 🟠 Alta | **Enrutamiento y selección óptima de Sub-Egos por afinidad** | `packages/decision/SubEgoSelector.ts` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | Selección basada en matching de capacidades y grafo relacional entre la intención y el catálogo de manifiestos disponibles. | Ver: `docs/architecture/agentes.md` | `SUB-01`, `DEC-01` |
| `DEC-06` | 🟠 Alta | **Detección de bucles infinitos y fallbacks controlados** | `packages/decision/LoopBreaker.ts` | 🟢 1d | 🔴 P0 | 🆕 Pendiente | Detección de ciclos de delegación circular entre Sub-Egos (profundidad > 4) con detención y escalación a pregunta clarificadora al usuario. | Ver: `docs/roadmap/roadmap.md` §Fase 05 · Compuertas: `OCLW-02`, `HERM-03` | `DEC-05` |
| `DEC-07` | 🟠 Alta | **Registro inmutable de veredictos en namespace `gov/audit`** | `packages/memory/EgoMemoryAdapter.ts:240` | 🟢 1d | 🔴 P0 | 🆕 Pendiente | Cada veredicto (clasificación, modelo elegido, confianza calibrada) se guarda atómicamente en VantaDB para auditoría y aprendizaje. | Ver: `docs/architecture/namespaces.md` | `CORE-06` |
| `DEC-08` | 🟡 Media | **Optimización y telemetría de latencia de turno (800–1500 ms)** | `packages/decision/Telemetry.ts` | 🟢 1d | 🔴 P0 | 🆕 Pendiente | Medición p99 del ciclo completo de decisión e IPC; emisión de métricas a `metrics/telemetry`. | Ver: `docs/operations/despliegue.md` | `DEC-03` |
| `DEC-09` | 🔴 Crítica | **CIERRE DEL HITO P0-ALPHA: Verificación Golden Path Alpha (20 pasos)** | `tests/e2e/golden-path-alpha-full.test.ts` | 🔴 3d | 🔴 P0 | 🆕 Pendiente | Ejecución automatizada de los 20 pasos de principio a fin sin fallos ni pérdidas de contexto. Sello de salida para P0-Alpha. | Ver: `docs/roadmap/roadmap.md` §154 | `CORE-*` a `DEC-*` |

---

## 📚 FASE 06: Knowledge & Data (P0-Beta)

> **Objetivo:** Ingesta masiva de documentos, almacenamiento vectorial local, búsqueda híbrida (RRF), GraphRAG, Data Views y gobierno de datos (cuarentena y supersesión).

### 🛑 Matriz de Compuertas de Extracción e Inspección Previa (Fase 06)

| ID Compuerta | Repo Origen | Patrón / Feature a Inspeccionar | Ficha Canónica | Tareas Ego Habilitadas | Decisión / Acción Esperada | Estado |
|:---:|---|---|---|---|---|:---:|
| `KHOJ-01` | khoj | Chunking de 256 tokens con solapamiento y digest SHA-256 | [`khoj.md`](../extractions/khoj.md) | `KB-01`, `KB-02` | 📥 Segmentación determinista con deduplicación | 🆕 Pendiente |
| `KHOJ-02` | khoj | Extracción jerárquica preservando encabezados de contexto | [`khoj.md`](../extractions/khoj.md) | `KB-01` | 📥 Metadatos jerárquicos (`heading_path`) en VantaDB | 🆕 Pendiente |
| `KHOJ-03` | khoj | Filtrado por corte dinámico de umbral coseno | [`khoj.md`](../extractions/khoj.md) | `KB-03`, `KB-04` | 📥 Descarte de ruido semántico antes de fusión RRF | 🆕 Pendiente |
| `KHOJ-04` | khoj | Extracción automatizada de hechos estructurados | [`khoj.md`](../extractions/khoj.md) | `KB-04` | 📥 Generación estructurada de triples para el grafo | 🆕 Pendiente |
| `CARP-04` | career-ops | Cuarentena de payloads de fuentes externas no verificadas | [`career-ops.md`](../extractions/career-ops.md) | `KB-07` | 📥 Aislamiento en `quarantine/pending` con TTL 14 días | ⏳ En curso |
| `DSEK-01` | deepseek-harness | Soft-replace y aristas `SUPERSEDED_BY` en grafo de hechos | [`deepseek-harness.md`](../extractions/deepseek-harness.md) | `KB-08` | 📥 Reemplazo de hechos sin mutaciones destructivas | ⏳ En curso |
| `DSEK-02` | deepseek-harness | Árbol de versiones y reconstrucción temporal de estado | [`deepseek-harness.md`](../extractions/deepseek-harness.md) | `KB-09` | 📥 Consultas bitemporales `AS OF` sobre VantaDB | 🆕 Pendiente |

### Catálogo de Tareas Canónicas (Fase 06)

| ID | Severidad | Hallazgo | Archivo:línea | Esfuerzo | Prioridad | Estado | Descripción | Relaciones | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| `KB-01` | 🟠 Alta | **Pipeline de ingesta local multiformato (PDF, MD, CSV, TXT, JSON)** | `packages/knowledge/ingest/` | 🟡 2-3d | 🟠 P1 | 🆕 Pendiente | Parser local y extractor de texto con chunking adaptativo (respetando encabezados y límites semánticos). | Ver: `docs/architecture/memoria-vantadb.md` · Compuertas: `KHOJ-01`, `KHOJ-02` | `CORE-06` |
| `KB-02` | 🟡 Media | **Sidecar opcional en Python para extracción pesada (bulk_import)** | `scripts/ingest/bulk_import.py` | 🟡 2d | 🟡 Media | 🆕 Pendiente | Proceso secundario invocado por stdio con `vantadb-py` para procesamiento masivo de lotes sin degradar la memoria del proceso Electron. | Ver: `docs/engineering/lenguajes.md` §26 · Compuerta: `KHOJ-01` | `KB-01` |
| `KB-03` | 🟠 Alta | **Indexación vectorial en VantaDB (`kb/docs` y `kb/facts`)** | `packages/knowledge/KnowledgeIndexer.ts` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Inserción en VantaDB con metadatos obligatorios (`org_id`, `ts`, `source`, `confidence`) y auto-embed ONNX. | Ver: `docs/architecture/namespaces.md` · Compuerta: `KHOJ-03` | `CORE-08` |
| `KB-04` | 🟠 Alta | **Búsqueda híbrida con fusión RRF y reordenamiento MMR** | `packages/knowledge/HybridSearch.ts` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Búsqueda combinada: BM25 léxico + HNSW semántico con fusión Reciprocal Rank Fusion y diversidad MMR integrada en VantaDB. | Ver: `docs/architecture/memoria-vantadb.md` §102 · Compuertas: `KHOJ-03`, `KHOJ-04` | `CORE-09` |
| `KB-05` | 🟠 Alta | **Data Views interactivas en Canvas (Record, Query y Relation View)** | `apps/desktop/renderer/components/canvas/data/` | 🟡 2-3d | 🟠 P1 | 🆕 Pendiente | Componentes visuales para inspeccionar tablas, registros individuales y navegación topológica del grafo (`node_id` tipado como `string`). | Ver: `docs/architecture/ui-runtime.md` §31 | `CANV-02` |
| `KB-06` | 🟠 Alta | **Integración del pipeline GraphRAG nativo** | `packages/knowledge/GraphRagEngine.ts` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Ejecución de `graphragSearch`: semilla léxica/vectorial → expansión de relaciones → ponderación → generación de contexto estructurado. | Ver: `docs/roadmap/roadmap.md` §Fase 06 | `CORE-09` |
| `KB-07` | 🟠 Alta | **Aislamiento y flujo de Cuarentena en `quarantine/pending` (ADR-046)** | `packages/memory/EgoMemoryAdapter.ts:183` | 🟢 1d | 🟠 P1 | ⏳ En curso | Entrada de hechos no verificados con TTL de 14 días y aislamiento estricto hasta supervisión humana. | Ver: `packages/memory/EgoMemoryAdapter.ts` · Compuerta: `CARP-04` | `CORE-06` |
| `KB-08` | 🟠 Alta | **Flujo de Promoción y Supersesión atómica de hechos (ADR-028)** | `packages/memory/EgoMemoryAdapter.ts:206` | 🟢 1-2d | 🟠 P1 | ⏳ En curso | Promoción a namespaces limpios y sustitución suave (*soft-replace*) vinculando aristas `SUPERSEDED_BY` sin borrado en caliente. | Ver: `packages/memory/EgoMemoryAdapter.ts` · Compuerta: `DSEK-01` | `KB-07` |
| `KB-09` | 🟡 Media | **Consultas Bitemporales (`valid_at` / `invalid_at` y `AS OF`)** | `packages/knowledge/BitemporalQueries.ts` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Capacidad de consultar el estado de la memoria histórica del proyecto en un momento temporal específico del pasado. | Ver: `docs/architecture/memoria-vantadb.md` §108 · Compuerta: `DSEK-02` | `CORE-06` |
| `KB-10` | 🟡 Media | **Exportación e importación de bases de conocimiento completas** | `packages/knowledge/KnowledgeExport.ts` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | Serialización portable de datasets de conocimiento para compartir entre proyectos o respaldar. | Ver: `docs/architecture/memoria-vantadb.md` §15 | `CORE-10` |
| `KB-11` | 🟠 Alta | **Project Memory Graph v0 (Decisión→ADR→Commit→Código→Test→Outcome)** | `packages/knowledge/` | 🟡 2-3d | 🟠 P1 | 🆕 Pendiente | Grafo de proyecto consultable que responde por qué existe una arquitectura: aristas Decisión→ADR→Commit→Files→Tests→Outcome sobre el grafo VantaDB. Contrapartida de `MEMG-03`/`MGR-22..24`. | Origen: VantaDB `MEMG-03` | Dep: `KB-06`, `KB-08`, `KB-09` |

---

## ⏱️ FASE 07: Tasks & Background (P0-Beta)

> **Objetivo:** Ejecución continua asíncrona, Task Memory independiente del chat, checkpoints de tareas resilientes y proactividad de Sub-Egos en segundo plano.

### 🛑 Matriz de Compuertas de Extracción e Inspección Previa (Fase 07)

| ID Compuerta | Repo Origen | Patrón / Feature a Inspeccionar | Ficha Canónica | Tareas Ego Habilitadas | Decisión / Acción Esperada | Estado |
|:---:|---|---|---|---|---|:---:|
| `OCLW-13` | openclaw | Sesiones en background desacopladas del hilo de chat | [`openclaw.md`](../extractions/openclaw.md) | `TASK-01`, `TASK-02` | 📥 Ejecución en segundo plano sin bloquear interfaz | 🆕 Pendiente |
| `OCLW-15` | openclaw | Puntos de control de tarea con reanudación post-crash | [`openclaw.md`](../extractions/openclaw.md) | `TASK-03`, `TASK-10` | 📥 Checkpoints persistentes de variables y estado | 🆕 Pendiente |
| `COUC-06` | coucou | FSM de atención para notificaciones de background no intrusivas | [`coucou.md`](../extractions/coucou.md) | `TASK-05`, `TASK-07` | 📥 Disparadores proactivos sin saturar al usuario | 🆕 Pendiente |
| `KHOJ-05` | khoj | Consolidación periódica de memorias en periodos de inactividad | [`khoj.md`](../extractions/khoj.md) | `TASK-08` | 📥 Dream Consolidation periódica en VantaDB | 🆕 Pendiente |

### Catálogo de Tareas Canónicas (Fase 07)

| ID | Severidad | Hallazgo | Archivo:línea | Esfuerzo | Prioridad | Estado | Descripción | Relaciones | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| `TASK-01` | 🔴 Crítica | **Motor de tareas persistentes en segundo plano (Background Engine)** | `packages/tasks/BackgroundEngine.ts` | 🟡 2-3d | 🟠 P1 | 🆕 Pendiente | Ejecutor asíncrono para trabajos de larga duración (análisis de código, investigación web, resúmenes) sin bloquear la interfaz. | Ver: `docs/roadmap/roadmap.md` §Fase 07 · Compuerta: `OCLW-13` | `ACT-03` |
| `TASK-02` | 🔴 Crítica | **Formalización de `Task Memory` desacoplada del chat** | `packages/tasks/TaskMemory.ts` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Entidad mnemónica dedicada: meta, contexto de ejecución, descubrimientos intermedios y resultado final aislados del historial de conversación. | Ver: `docs/architecture/memoria-vantadb.md` §6 · Compuerta: `OCLW-13` | `CORE-06` |
| `TASK-03` | 🔴 Crítica | **Puntos de control resilientes (Task Checkpoints / MEMG-20)** | `packages/tasks/TaskCheckpoint.ts` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Registro periódico del estado y variables de la tarea en VantaDB; permite reanudar tareas interrumpidas tras un crash o reinicio. | Ver: `docs/architecture/memoria-vantadb.md` §12 · Compuerta: `OCLW-15` | `TASK-02` |
| `TASK-04` | 🟠 Alta | **Scheduler adaptativo consciente de recursos (Concurrency Controller)** | `packages/tasks/ResourceScheduler.ts` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Control de concurrencia adaptativo basado en carga de CPU, presupuesto de tokens disponible y prioridad de la tarea. | Ver: `docs/product/modulos.md` §26 | `TASK-01` |
| `TASK-05` | 🟡 Media | **Bandeja de Actividad en Segundo Plano en footer (`shell.tsx`)** | `apps/desktop/renderer/components/shell.tsx:103` | 🟢 1d | 🟠 P1 | ⏳ En curso | Indicadores visuales en el pie de página que muestran tareas activas, porcentaje de avance y alertas proactivas. | Ver: `apps/desktop/renderer/components/shell.tsx` · Compuerta: `COUC-06` | `TASK-01` |
| `TASK-06` | 🟠 Alta | **Bus de eventos asíncronos y sistema de notificaciones discretas** | `packages/tasks/TaskNotifications.ts` | 🟢 1-2d | 🟠 P1 | 🆕 Pendiente | Notificaciones en la interfaz cuando una tarea en background completa un hito crítico o requiere intervención humana. | Ver: `docs/product/ux-ui.md` §53 | `TASK-05` |
| `TASK-07` | 🟡 Media | **Comportamiento proactivo de Sub-Egos (Schedules & Triggers)** | `packages/subegos/ProactivityEngine.ts` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Disparadores temporales (cron local) y reactivos a cambios de archivos para que los especialistas sugieran acciones sin petición explícita. | Ver: `docs/architecture/agentes.md` §77 · Compuerta: `COUC-06` | `SUB-03` |
| `TASK-08` | 🟠 Alta | **Consolidación Onírica en inactividad (Dream Consolidation)** | `packages/memory/DreamConsolidator.ts` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Invocación periódica de `dream_consolidate` en VantaDB durante reposo: deduplicación, resolución de contradicciones y enfriamiento de memorias. | Ver: `docs/architecture/memoria-vantadb.md` §11 · Compuerta: `KHOJ-05` | `CORE-06` |
| `TASK-09` | 🟠 Alta | **Cancelación cooperativa de tareas en vuelo vía `AbortSignal`** | `packages/tasks/TaskCancellation.ts` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | El usuario puede detener cualquier tarea en background de forma instantánea liberando workers y cerrando handles de archivos. | Ver: `docs/roadmap/roadmap.md` §Fase 07 | `TASK-01` |
| `TASK-10` | 🔴 Crítica | **Prueba de Resiliencia: Matar proceso Electron mid-task y reanudar** | `tests/chaos/task-crash-resume.test.ts` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Test de caos: simular caída abrupta durante una tarea pesada → reabrir app → verificar que la tarea se restaura desde el último checkpoint. | Ver: `docs/roadmap/roadmap.md` §Fase 10 · Compuerta: `OCLW-15` | `TASK-03` |
| `TASK-11` | 🟠 Alta | **Propagación AbortSignal UI→Node→Rust (lado Ego de DIST-20)** | `packages/tasks/TaskCancellation.ts` · `packages/execution/ExecutionManager.ts` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Cancelar GraphRAG/search/assembly en vuelo al pulsar Cancelar en UI; liberar workers y cerrar handles. Requiere el soporte `AbortSignal` de VantaDB `DIST-20` para cancelación nativa completa. | Origen: VantaDB `DIST-20` | Dep: `TASK-09` |

---

## 🌅 FASE 08: Daily State (P0-Beta)

> **Objetivo:** Seguimiento continuo de la atención del usuario: dashboard de bienvenida, reconstrucción de contexto al abrir la app, métricas de sesión y priorización.

### 🛑 Matriz de Compuertas de Extracción e Inspección Previa (Fase 08)

| ID Compuerta | Repo Origen | Patrón / Feature a Inspeccionar | Ficha Canónica | Tareas Ego Habilitadas | Decisión / Acción Esperada | Estado |
|:---:|---|---|---|---|---|:---:|
| `COUC-06` | coucou | Síntesis de estado de atención al arranque de la aplicación | [`coucou.md`](../extractions/coucou.md) | `DS-01`, `DS-02` | 📥 Dashboard inicial con resumen contextual y alertas | 🆕 Pendiente |
| `COUC-09` | coucou | RunRecorder cronológico para auditoría de acciones del día | [`coucou.md`](../extractions/coucou.md) | `DS-03`, `DS-08` | 📥 Feed de decisiones y snapshot diario en VantaDB | 🆕 Pendiente |
| `OCLW-07` | openclaw | Inspección de revisiones acumuladas para briefing matutino | [`openclaw.md`](../extractions/openclaw.md) | `DS-01` | 📥 Resumen de cambios y tareas pendientes del proyecto | 🆕 Pendiente |

### Catálogo de Tareas Canónicas (Fase 08)

| ID | Severidad | Hallazgo | Archivo:línea | Esfuerzo | Prioridad | Estado | Descripción | Relaciones | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| `DS-01` | 🟠 Alta | **Motor de síntesis de Daily State** | `packages/dailystate/DailyStateEngine.ts` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Agregador que recopila al abrir la app: decisiones recientes, tareas completadas, alertas de cuarentena y cambios de repositorios. | Ver: `docs/roadmap/roadmap.md` §Fase 08 · Compuertas: `COUC-06`, `OCLW-07` | `CORE-06` |
| `DS-02` | 🟠 Alta | **Dashboard dinámico de bienvenida en Canvas** | `apps/desktop/renderer/components/daily/DailyDashboard.tsx` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Pantalla inicial con saludo contextual, estado operativo del proyecto, resumen de la sesión previa y sugerencias accionables. | Ver: `docs/product/ux-ui.md` · Compuerta: `COUC-06` | `CANV-02` |
| `DS-03` | 🟡 Media | **Registro y visor de decisiones tomadas** | `apps/desktop/renderer/components/daily/DecisionsFeed.tsx` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | Feed cronológico de decisiones arquitectónicas y de negocio acordadas con los Sub-Egos registradas en `gov/audit`. | Ver: `docs/architecture/namespaces.md` · Compuerta: `COUC-09` | `DEC-07` |
| `DS-04` | 🟡 Media | **Priorización inteligente de objetivos de la jornada** | `packages/dailystate/GoalPrioritizer.ts` | 🟢 1-2d | 🟠 P1 | 🆕 Pendiente | Sugerencia automatizada de las 3 tareas de mayor impacto a abordar en el día según el backlog y los bloqueos detectados. | Ver: `docs/product/definicion-soc.md` §21 | `DS-01` |
| `DS-05` | 🟡 Media | **Consola de métricas de proyecto y consumo de IA** | `apps/desktop/renderer/components/daily/MetricsConsole.tsx` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | Visualización gráfica de tokens consumidos, gasto en USD (BYOK), distribución por modelo y tiempo de respuesta p99. | Ver: `docs/architecture/namespaces.md` §29 | `DEC-08` |
| `DS-06` | 🟡 Media | **Módulo de Journal personal del usuario en `journal/*`** | `apps/desktop/renderer/components/journal/JournalView.tsx` | 🟢 1-2d | 🟠 P1 | 🆕 Pendiente | Espacio de notas rápidas, reflexiones y metas personales con TTL diferenciado (30/90 días) y análisis de tono. | Ver: `docs/architecture/namespaces.md` §22 | `CORE-06` |
| `DS-07` | 🟠 Alta | **Bandeja de aprobaciones pendientes acumuladas** | `apps/desktop/renderer/components/daily/PendingApprovals.tsx` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | Panel que reúne todas las acciones en background que quedaron esperando confirmación del usuario para resolver en lote. | Ver: `ACT-06` | `DS-02` |
| `DS-08` | 🟠 Alta | **Persistencia y snapshot histórico del Daily State en VantaDB** | `packages/dailystate/DailyStatePersistence.ts` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | Guardado diario en `system/snapshots` permitiendo consultar resúmenes de cualquier fecha pasada. | Ver: `docs/architecture/namespaces.md` §30 · Compuerta: `COUC-09` | `CORE-06` |

---

## 🏛️ FASE 09: Dominios Funcionales (P0-Beta)

> **Objetivo:** Especialización por áreas de responsabilidad: workspaces y Sub-Egos preconfigurados para Ingeniería, Producto, Conocimiento, Analítica y CRM.

### 🛑 Matriz de Compuertas de Extracción e Inspección Previa (Fase 09)

| ID Compuerta | Repo Origen | Patrón / Feature a Inspeccionar | Ficha Canónica | Tareas Ego Habilitadas | Decisión / Acción Esperada | Estado |
|:---:|---|---|---|---|---|:---:|
| `HERM-17` | hermes-agent | Aislamiento de worktrees para desarrollo de software | [`hermes-agent.md`](../extractions/hermes-agent.md) | `DOM-01` | 📥 Workspace de código aislado en Dominio Engineering | 🆕 Pendiente |
| `COUC-10` | coucou | Mutación segura de configuraciones por dominio funcional | [`coucou.md`](../extractions/coucou.md) | `DOM-06`, `DOM-09` | 📥 Plantillas de Sub-Ego extensibles sin tocar el core | 🆕 Pendiente |

### Catálogo de Tareas Canónicas (Fase 09)

| ID | Severidad | Hallazgo | Archivo:línea | Esfuerzo | Prioridad | Estado | Descripción | Relaciones | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| `DOM-01` | 🟠 Alta | **Dominio Engineering: Workspace de código y Sub-Ego Dev** | `packages/domains/engineering/` | 🟡 2-3d | 🟠 P1 | 🆕 Pendiente | Sub-Ego especializado en código, visor de árbol de archivos, integración con Git local, inspección de dependencias y linters. | Ver: `docs/architecture/dominios-funcionales.md` · Compuerta: `HERM-17` | `SUB-01`, `ACT-04` |
| `DOM-02` | 🟠 Alta | **Dominio Product: Gestión de backlog, roadmap y PRDs** | `packages/domains/product/` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Sub-Ego de Producto, Canvas con vistas Kanban/Timeline para épicas y generación asistida de especificaciones técnicas. | Ver: `docs/architecture/dominios-funcionales.md` | `CANV-01` |
| `DOM-03` | 🟠 Alta | **Dominio Knowledge: Investigación profunda y síntesis** | `packages/domains/knowledge/` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Sub-Ego Research, integración con GraphRAG, navegación del grafo de conceptos y generación de bibliografías estructuradas. | Ver: `docs/architecture/dominios-funcionales.md` | `KB-06` |
| `DOM-04` | 🟡 Media | **Dominio Analytics: Visualización de datos y métricas** | `packages/domains/analytics/` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Sub-Ego Data Analyst, gráficos interactivos en Canvas (línea, barra, dispersión) y ejecución de agregaciones sobre VantaDB. | Ver: `docs/architecture/dominios-funcionales.md` | `CANV-01` |
| `DOM-05` | 🟡 Media | **Dominio CRM/Sales: Gestión de contactos, deals y timeline** | `packages/domains/crm/` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Sub-Ego CRM, namespaces `crm/contacts` y `crm/deals`, pipeline de etapas de venta y registro cronológico de interacciones. | Ver: `docs/architecture/namespaces.md` §18 | `CANV-01` |
| `DOM-06` | 🟠 Alta | **Plantillas oficiales de Sub-Egos preconfigurados en catálogo** | `packages/subegos/templates/` | 🟢 1-2d | 🟠 P1 | 🆕 Pendiente | Manifiestos estandarizados y testeados para cada dominio listos para activación inmediata sin configuración manual. | Ver: `docs/architecture/agentes.md` §101 · Compuerta: `COUC-10` | `SUB-01` |
| `DOM-07` | 🟠 Alta | **Conector oficial MCP de GitHub para Dominio Engineering** | `packages/integrations/github/` | 🟢 1-2d | 🟠 P1 | 🆕 Pendiente | Conexión con servidor MCP oficial de GitHub para sincronización bidireccional de issues, PRs y revisiones de código. | Ver: `docs/engineering/integraciones.md` §Nivel B | `ACT-09` |
| `DOM-08` | 🟡 Media | **Vistas de colaboración inter-dominio en Canvas** | `apps/desktop/renderer/components/domains/` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Tableros donde conviven elementos de múltiples áreas (ej. una feature de Producto vinculada a un commit de Dev y un deal de CRM). | Ver: `docs/architecture/dominios-funcionales.md` | `CANV-02` |
| `DOM-09` | 🟠 Alta | **Mecanismo de extensibilidad orgánica de nuevos dominios** | `packages/domains/DomainRegistry.ts` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | Incorporación de dominios futuros (Marketing, Legal, Soporte) mediante manifiestos modulares sin modificar el core del SOC. | Ver: `docs/architecture/dominios-funcionales.md` §56 · Compuerta: `COUC-10` | `SUB-01` |

---

## 🛡️ FASE 10: Recovery & Hardening (P0-Beta)

> **Objetivo:** Resiliencia extrema, tolerancia total a fallos, cero pérdidas de datos, salvaguarda `.vdbdump` y observabilidad profunda de producción.

### 🛑 Matriz de Compuertas de Extracción e Inspección Previa (Fase 10)

| ID Compuerta | Repo Origen | Patrón / Feature a Inspeccionar | Ficha Canónica | Tareas Ego Habilitadas | Decisión / Acción Esperada | Estado |
|:---:|---|---|---|---|---|:---:|
| `DSEK-01` | deepseek-harness | Supersede atómico para resiliencia ante cierres abruptos | [`deepseek-harness.md`](../extractions/deepseek-harness.md) | `REC-01` | 📥 Cero corrupción en WAL de VantaDB Fjall LSM | 🆕 Pendiente |
| `DSEK-02` | deepseek-harness | Reconstrucción de linaje histórico para time-travel recovery | [`deepseek-harness.md`](../extractions/deepseek-harness.md) | `REC-01` | 📥 Reconstitución de estados previos tras crash | 🆕 Pendiente |
| `DSEK-04` | deepseek-harness | Migraciones de persistencia aditivas sin schema drop | [`deepseek-harness.md`](../extractions/deepseek-harness.md) | `REC-03`, `REC-06` | 📥 Retrocompatibilidad absoluta de volcados `.vdbdump` | 🆕 Pendiente |
| `CARP-01` | career-ops | Contrato de preservación incondicional de datos de usuario | [`career-ops.md`](../extractions/career-ops.md) | `REC-01`, `REC-03` | 📥 Blindaje de archivos del usuario frente a resets | 🆕 Pendiente |
| `CARP-02` | career-ops | Exclusión mutua basada en lockfiles para restauraciones | [`career-ops.md`](../extractions/career-ops.md) | `REC-01`, `REC-04` | 📥 Impedir operaciones concurrentes durante recovery | 🆕 Pendiente |
| `HERM-04` | hermes-agent | Persistencia resiliente de geometría de ventana (`window-state`) | [`hermes-agent.md`](../extractions/hermes-agent.md) | `REC-01` | 📥 Restauración idéntica de tamaño/posición de app | 🆕 Pendiente |

### Catálogo de Tareas Canónicas (Fase 10)

| ID | Severidad | Hallazgo | Archivo:línea | Esfuerzo | Prioridad | Estado | Descripción | Relaciones | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| `REC-01` | 🔴 Crítica | **Motor de recuperación automática ante crashes (Crash Recovery)** | `packages/recovery/CrashRecoveryEngine.ts` | 🟡 2-3d | 🟠 P1 | 🆕 Pendiente | Detección de cierres sucios (dirty shutdown), verificación de integridad del WAL y restauración limpia de estado en el arranque. | Ver: `docs/roadmap/roadmap.md` §Fase 10 · Compuertas: `DSEK-01`, `DSEK-02`, `CARP-01`, `CARP-02`, `HERM-04` | `CORE-07` |
| `REC-02` | 🔴 Crítica | **Barrera de durabilidad `OpGate` en cierre de aplicación** | `apps/desktop/src/main.ts` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | Interceptar evento `before-quit` de Electron para invocar `await adapter.close()`, drenando operaciones en vuelo antes de matar el proceso. | Ver: `packages/memory/EgoMemoryAdapter.ts:317` | `CORE-06` |
| `REC-03` | 🔴 Crítica | **Exportación soberana completa de proyectos a `.vdbdump`** | `packages/recovery/ProjectExport.ts` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Generar un paquete autónomo comprimido con cabecera `VDBJSON` conteniendo todos los namespaces, grafos, tareas y metadatos. | Ver: `docs/operations/snapshots-respaldo.md` · Compuertas: `DSEK-04`, `CARP-01` | `CORE-10` |
| `REC-04` | 🔴 Crítica | **Importación y restauración funcional en máquina limpia** | `packages/recovery/ProjectImport.ts` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Restaurar un archivo `.vdbdump` en una instalación virgen de Ego, validando idénticos conteos de registros, vectores y aristas. | Ver: `docs/testing/estrategia.md` §39 · Compuerta: `CARP-02` | `REC-03` |
| `REC-05` | 🟠 Alta | **Sistema de Snapshots locales periódicos y pre-riesgo** | `packages/recovery/SnapshotManager.ts` | 🟢 1-2d | 🟠 P1 | 🆕 Pendiente | Snapshots automáticos diarios y puntos de restauración antes de operaciones de alto impacto (migraciones masivas o borrados). | Ver: `docs/operations/despliegue.md` §19 | `REC-03` |
| `REC-06` | 🟠 Alta | **Versionado y migración de esquemas en `ego.namespaces.json`** | `packages/memory/SchemaMigrator.ts` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Mecanismo declarativo para migrar esquemas de VantaDB entre versiones de Ego sin pérdida de compatibilidad hacia atrás. | Ver: `docs/roadmap/roadmap.md` §122 · Compuerta: `DSEK-04` | `CORE-06` |
| `REC-07` | 🟡 Media | **Sistema de logging rotativo y diagnóstico local** | `packages/diagnostics/Logger.ts` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | Logs estructurados rotativos en disco con saneamiento de datos sensibles para soporte y diagnóstico de errores en cliente. | Ver: `docs/operations/despliegue.md` | `CORE-01` |
| `REC-08` | 🟠 Alta | **Test de Resiliencia Integral: Chaos Monkey local de apagado** | `tests/chaos/hard-kill.test.ts` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Matar forzosamente el proceso Electron durante escrituras masivas concurrentes y verificar que VantaDB arranca sin corrupción. | Ver: `docs/testing/estrategia.md` | `REC-01`, `REC-02` |
| `REC-09` | 🟠 Alta | **Chaos de durabilidad contra FIND-246/248 (snapshot→kill→restore)** | `tests/chaos/` · `packages/recovery/` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Export→kill mid-snapshot→restore con conteos idénticos de registros/vectores/aristas. Registra como riesgo conocido que el sustrato puede perder nodos hasta el cierre de `FIND-246`/`FIND-248`. | Origen: VantaDB `FIND-246`, `FIND-248` | Dep: `REC-01`, `REC-02`, `REC-03` |

---

## 🔒 FASE 11: Seguridad & Gobernanza (P0-Beta)

> **Objetivo:** Protección rigurosa del sistema del usuario: sandboxing de Electron, validación IPC, Credential Manager en Keychain nativo y auditoría inmutable.

### 🛑 Matriz de Compuertas de Extracción e Inspección Previa (Fase 11)

| ID Compuerta | Repo Origen | Patrón / Feature a Inspeccionar | Ficha Canónica | Tareas Ego Habilitadas | Decisión / Acción Esperada | Estado |
|:---:|---|---|---|---|---|:---:|
| `CARP-03` | career-ops | Whitelist y auditoría estricta de rutas de sistema permitidas | [`career-ops.md`](../extractions/career-ops.md) | `SEC-01`, `SEC-05` | 📥 Bloqueo en runtime de accesos fuera de workspace | 🆕 Pendiente |
| `CARP-04` | career-ops | Desinfección y cuarentena de entradas externas no confiables | [`career-ops.md`](../extractions/career-ops.md) | `SEC-04` | 📥 Filtrado estricto contra inyecciones de payloads | 🆕 Pendiente |
| `HERM-19` | hermes-agent | Linter AST de extensiones y verificación de sandbox | [`hermes-agent.md`](../extractions/hermes-agent.md) | `SEC-01`, `SEC-05` | 📥 Verificación estricta de extensiones de terceros | 🆕 Pendiente |
| `COUC-10` | coucou | Mutación gobernada de configuración sin bypass de permisos | [`coucou.md`](../extractions/coucou.md) | `SEC-05` | 📥 Aprobación humana para alterar permisos de tools | 🆕 Pendiente |
| `DSEK-05` | deepseek-harness | Aislamiento y borrado criptográfico de credenciales | [`deepseek-harness.md`](../extractions/deepseek-harness.md) | `SEC-03`, `SEC-04` | 📥 Integración con Keychain y cero secretos en storage | 🆕 Pendiente |

### Catálogo de Tareas Canónicas (Fase 11)

| ID | Severidad | Hallazgo | Archivo:línea | Esfuerzo | Prioridad | Estado | Descripción | Relaciones | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| `SEC-01` | 🔴 Crítica | **Auditoría de Sandboxing y Context Isolation de Electron** | `apps/desktop/src/main.ts:42` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | Verificar que ninguna API de Node.js o VantaDB se exponga al renderer; aplicar cabeceras CSP (Content Security Policy) estrictas. | Ver: `AGENTS.md` §Seguridad · Compuertas: `CARP-03`, `HERM-19` | `CORE-02` |
| `SEC-02` | 🔴 Crítica | **Validación exhaustiva de contratos IPC con Zod en Main** | `apps/desktop/src/ipc/handlers.ts` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Todo mensaje recibido por IPC desde el renderer debe validarse contra esquemas Zod estrictos; el renderer es considerado untrusted. | Ver: `docs/engineering/lenguajes.md` §32 | `CORE-02` |
| `SEC-03` | 🔴 Crítica | **Credential Manager integrado con Keychain nativo del SO** | `packages/security/CredentialManager.ts` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Almacenamiento seguro de API keys y credenciales mediante Windows DPAPI, macOS Keychain o Secret Service en Linux (vía `keytar`). | Ver: `AGENTS.md` §Seguridad · Compuerta: `DSEK-05` | `CORE-01` |
| `SEC-04` | 🔴 Crítica | **Barrera de fuga de secretos (Zero Secrets in Storage)** | `packages/security/SecretsFilter.ts` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | Interceptor que garantiza que ninguna API key, token o secreto se escriba en VantaDB, logs, prompts o mensajes visibles. | Ver: `docs/roadmap/roadmap.md` §Fase 11 · Compuertas: `CARP-04`, `DSEK-05` | `SEC-03` |
| `SEC-05` | 🟠 Alta | **Matriz de permisos de herramientas y restricción de Sandbox** | `packages/security/ToolPermissions.ts` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Control granular: paths de disco permitidos (restringidos al workspace), bloqueo de red arbitraria y comandos prohibidos. | Ver: `docs/product/principios-innegociables.md` §6 · Compuertas: `CARP-03`, `HERM-19`, `COUC-10` | `ACT-01` |
| `SEC-06` | 🟠 Alta | **Auditoría inmutable de acciones sensibles en `gov/audit`** | `packages/memory/EgoMemoryAdapter.ts:240` | 🟢 1-2d | 🟠 P1 | ⏳ En curso | Cada comando ejecutado, archivo escrito o aprobación concedida se registra con hash SHA-256 e ID del Sub-Ego responsable. | Ver: `packages/memory/EgoMemoryAdapter.ts` | `CORE-06` |
| `SEC-07` | 🟡 Media | **Purga criptográfica de datos sensibles (ADR-046 / VER-02)** | `packages/security/CryptoErasure.ts` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | Destrucción verificable de hechos o namespaces a solicitud del usuario, garantizando borrado físico irrecuperable en disco. | Ver: `docs/architecture/memoria-vantadb.md` §14 | `CORE-06` |
| `SEC-08` | 🟠 Alta | **Suite de pruebas de penetración y límites de modelo** | `tests/security/injection-boundaries.test.ts` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Intentar inyecciones de prompt para forzar escapes de sandbox o lectura de archivos fuera de scope; verificar que los guardrails en TypeScript bloquean el ataque. | Ver: `docs/testing/estrategia.md` | `SEC-01`..`SEC-05` |
| `SEC-09` | 🔴 Crítica | **Cuarentena por defecto para namespaces sensibles sin cifrado (FIND-249)** | `packages/memory/EgoMemoryAdapter.ts` · `packages/security/SecretsFilter.ts` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | Namespaces sensibles van a `quarantine/pending` con aviso UI explícito de ausencia de cifrado at-rest; cero secretos en storage/logs/prompts. Se relaja solo al cerrar VantaDB `FIND-249`. | Origen: VantaDB `FIND-249` · Ver: `SEC-03`, `SEC-04`, `KB-07` | Dep: `SEC-03`, `KB-07` |

---

## 📦 FASE 12: Distribución & Empaquetado (P0-Beta / Lanzamiento)

> **Objetivo:** Empaquetado multiplataforma automatizado, firmado de código nativo, auto-actualización en segundo plano y verificación en Clean Machine.

### 🛑 Matriz de Compuertas de Extracción e Inspección Previa (Fase 12)

| ID Compuerta | Repo Origen | Patrón / Feature a Inspeccionar | Ficha Canónica | Tareas Ego Habilitadas | Decisión / Acción Esperada | Estado |
|:---:|---|---|---|---|---|:---:|
| `HERM-14` | hermes-agent | Pipeline automatizado de empaquetado con `electron-builder` | [`hermes-agent.md`](../extractions/hermes-agent.md) | `DIST-01`, `DIST-03` | 📥 Scripts de build multi-plataforma limpios | 🆕 Pendiente |
| `HERM-15` | hermes-agent | Exclusión ASAR de binarios compilados `asarUnpack: ["**/*.node"]` | [`hermes-agent.md`](../extractions/hermes-agent.md) | `DIST-02` | 📥 Carga correcta de `vantadb/native` en binario final | 🆕 Pendiente |
| `HERM-16` | hermes-agent | Infraestructura de firmado digital (Authenticode EV / Notary) | [`hermes-agent.md`](../extractions/hermes-agent.md) | `DIST-04` | 📥 Certificados y firma para evitar bloqueos del SO | 🆕 Pendiente |

### Catálogo de Tareas Canónicas (Fase 12)

| ID | Severidad | Hallazgo | Archivo:línea | Esfuerzo | Prioridad | Estado | Descripción | Relaciones | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| `DIST-01` | 🔴 Crítica | **Pipeline de build automatizado con electron-builder** | `apps/desktop/package.json` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Scripts de compilación tipada, empaquetado de assets y optimización de bundles con `@electron-forge` / `electron-builder`. | Ver: `docs/operations/despliegue.md` · Compuerta: `HERM-14` | `CORE-01` |
| `DIST-02` | 🔴 Crítica | **Configuración obligatoria de `asarUnpack: ["**/*.node"]`** | `apps/desktop/electron-builder.yml` | 🟢 2h | 🟠 P1 | 🆕 Pendiente | Configurar exclusión ASAR para binarios nativos compilados de Rust (`vantadb-node`), evitando fallos fatales de carga en runtime empaquetado. | Ver: `docs/operations/despliegue.md` §15 · Compuerta: `HERM-15` | `DIST-01` |
| `DIST-03` | 🟠 Alta | **Generación de instaladores nativos multiplataforma** | `apps/desktop/build/` | 🟡 2-3d | 🟠 P1 | 🆕 Pendiente | Targets: Windows (instalador NSIS `.exe` + MSI), macOS (DMG universal x64/arm64) y Linux (AppImage / `.deb`). | Ver: `docs/operations/despliegue.md` · Compuerta: `HERM-14` | `DIST-01` |
| `DIST-04` | 🔴 Crítica | **Firmado de código y notarización (Authenticode EV & Apple Notary)** | `scripts/release/sign.mjs` | 🟡 2-3d | 🟠 P1 | 🆕 Pendiente | Integración con certificados de firma digital para evitar pantallas de bloqueo de SmartScreen en Windows y Gatekeeper en macOS. | Ver: `docs/operations/despliegue.md` §15 · Compuerta: `HERM-16` | `DIST-03` |
| `DIST-05` | 🟠 Alta | **Sistema de actualización en segundo plano (Auto-Updater)** | `apps/desktop/src/updater.ts` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Detección de nuevas versiones de Ego en GitHub Releases, descarga diferencial en background y aviso discreto para reiniciar. | Ver: `docs/roadmap/roadmap.md` §145 | `DIST-01` |
| `DIST-06` | 🔴 Crítica | **Prueba Clean Machine en VM limpia sin toolchains de desarrollo** | `docs/dev/desktop/CLEAN_MACHINE_TEST.md` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Instalar y arrancar Ego en una máquina virtual Windows virgen (sin Node, Rust, Python ni C++ redistributables); verificar cero errores de DLLs o bindings. | Ver: `docs/roadmap/roadmap.md` §142 | `DIST-03` |
| `DIST-07` | 🟡 Media | **Documentación de usuario final, guía de inicio rápido y manual** | `docs/user/` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | Elaborar guía paso a paso de primer uso, configuración de modelos locales y BYOK, conceptos clave y solución de problemas comunes. | Ver: `docs/product/ux-ui.md` | `DIST-03` |
| `DIST-08` | 🔴 Crítica | **CIERRE DEL HITO P0-BETA: Verificación Golden Path Beta Multi-Día** | `tests/e2e/golden-path-beta.test.ts` | 🔴 3-4d | 🟠 P1 | 🆕 Pendiente | Validación final de un proyecto real de varios días con múltiples Sub-Egos, herramientas, memoria persistente acumulada y cero regresiones. Sello de release final. | Ver: `docs/roadmap/roadmap.md` §182 | `CORE-*` a `DIST-*` |
| `DIST-09` | 🔴 Crítica | **Pin de VantaDB develop y política de actualización** | `apps/desktop/package.json` · `pnpm-lock.yaml` · `docs/engineering/vantadb-readiness-plan.md` | 🟢 1d | 🔴 P0 | 🆕 Pendiente | Fijar commit SHA de `develop`, documentar cadencia de bump y mantener tabla workaround→FIND (`EGO-01..07`: cursor null, wildcard manual, escalares, lock Fjall) hasta su cierre. Elimina la lotería del `file:` frágil. | Origen: VantaDB Backlog `EGO-01..07` | Dep: `CORE-06` |
| `DIST-10` | 🔴 Crítica | **Smoke Electron headless con asarUnpack en CI (lado Ego de DIST-21)** | `.github/workflows/` · `apps/desktop/electron-builder.yml` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | Test en Windows x64 que carga el `.node` empaquetado, hace `connect()` sobre disco y falla ante ABI drift. Sin esto `DIST-02` es configuración sin verificar. | Origen: VantaDB `DIST-21` · Compuerta: `HERM-15` | Dep: `DIST-01`, `DIST-02` |
| `DIST-11` | 🟡 Media | **Lint real con gate o retirar el claim de AGENTS.md** | `eslint.config.*` · `package.json` | 🟢 0.5-1d | 🟠 P1 | 🆕 Pendiente | ESLint flat o Biome con gate en CI, o borrar `Lint: pnpm lint` de `AGENTS.md`. Hoy `pnpm lint` es `echo + typecheck`: pasa siempre sin lintear nada. | Ver: `AGENTS.md` §3 | — |
| `DIST-12` | 🟡 Media | **Dev concurrente desktop+renderer con VITE_DEV_SERVER_URL** | `package.json` · `apps/desktop/src/main.ts` | 🟢 0.5-1d | 🟠 P1 | 🆕 Pendiente | Lanzar Vite y Electron juntos en `pnpm dev` (concurrently) con `VITE_DEV_SERVER_URL` cableado; documentar el loop. Hoy `pnpm dev` solo lanza `electron .` sin dev-server. | Ver: `DIST-01` | Dep: `DIST-01` |
