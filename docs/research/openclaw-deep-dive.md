# Deep Dive Técnico: OpenClaw (OpenClaw Foundation)
### Análisis de Arquitectura TypeScript, Ecosistema Online, Evaluación Crítica y Matriz de Incorporación en Ego

| Campo | Valor |
| --- | --- |
| Estado | Canónico — Documento de investigación técnica profunda (Local + Online) |
| Repositorio Local | `repos-referencia/openclaw/` (Commit verificado: oct-2026) |
| Fuentes Online Oficiales | `openclaw.ai` · `docs.openclaw.ai` · OpenClaw Foundation (501(c)(3)) |
| Licencia | MIT |
| Stack del Origen | 100% TypeScript (Node.js 24/26, pnpm monorepo) + Gateway WebSocket/RPC + SQLite/Kysely |
| Rol del Evaluador | Ingeniero Principal de Sistemas & Analista Crítico |
| Fecha | 2026-10-07 |

---

## 1. Resumen Ejecutivo y Ecosistema Global (Online + Local)

**OpenClaw (🦞)** es un framework de asistencia autónoma de código abierto desarrollado bajo la gobernanza de la **OpenClaw Foundation** (organización 501(c)(3) independiente).

Su propuesta técnica central es: **"Your assistant, on your devices, in your chats"** bajo una filosofía de **"Trusted Gateway, Untrusted Execution, Deterministic Policy"**.

### Arquitectura Dual: Gateway + Agent Core
1. **The Gateway (Control Plane Local):** Un servicio de orquestación en Node.js que se enlaza exclusivamente al loopback local (`127.0.0.1`). Gestiona sesiones concurrentes, eventos, enrutamiento a modelos (Claude, Codex, Ollama), ejecución de herramientas y canales de comunicación externos.
2. **Agent Runtime (ReAct Execution Engine):** El motor cognitivo que ejecuta los bucles de razonamiento y acción (Reason + Act). Utiliza un sistema formal de admisión de ejecuciones (`admitted-run-context`), locks de estado por sesión y trabajadores aislados (`worker-runtime`).
3. **Omnicanalidad Extensa:** Conecta el mismo cerebro local a más de 20 canales de mensajería (WhatsApp, Telegram, Discord, Slack, iMessage, Teams, Signal, Google Chat) y apps complementarias con Canvas y audio.

A diferencia de Hermes Agent (que dependía de un subproceso Python), **OpenClaw es 100% TypeScript nativo**, lo que lo convierte en una fuente de referencia de código directo excepcionalmente valiosa para el Cognitive Runtime de Ego.

---

## 2. Taxonomía de Capacidades Descubiertas en OpenClaw

A través de la inspección de su monorepo pnpm (`packages/`, `src/`, `crates/`), se estructuran sus capacidades en 8 dominios fundamentales:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    ARQUITECTURA DE CAPACIDADES OPENCLAW                      │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ 1. Gobernanza de Admisión & Runs     │ 5. Tool-Call Auto-Repair              │
│    · AdmittedRunContext inmutable    │    · Reparación de JSON malformado    │
│    · Control de autoridad y scopes   │    · Normalización de esquemas        │
│    · Propagación de AbortSignal      │    · Reintento heurístico síncrono    │
├──────────────────────────────────────┼───────────────────────────────────────┤
│ 2. Sesiones & Locks Atómicos         │ 6. Seguridad de Red (Net-Policy)      │
│    · Session-lifecycle-locks         │    · Bloqueo anti-SSRF de localhost   │
│    · Ventanas de lectura paginadas   │    · Allowlist determinista dominios  │
│    · Tracking de diffs y revisiones  │    · Proxy y rate limiting local      │
├──────────────────────────────────────┼───────────────────────────────────────┤
│ 3. Agent Harness Runtime             │ 7. Worker Runtime & Sandboxing        │
│    · Harnesses desacoplados por SDK  │    · Node worker_threads aislados     │
│    · Structured Input (formularios)  │    · SandboxFsBridge                  │
│    · Watched sessions prompts        │    · Docker headless sandboxing       │
├──────────────────────────────────────┼───────────────────────────────────────┤
│ 4. Mermaid & Canvas Visual Core      │ 8. Omnichannel Ingress Gateway        │
│    · Validación sintáctica Mermaid   │    · Conexión a 20+ redes mensajería  │
│    · Proyecciones declarativas UI    │    · Device pairing con tokens        │
│    · Sincronización optimista WS     │    · Web Control UI y TUI nativo      │
└──────────────────────────────────────┴───────────────────────────────────────┘
```

---

## 3. Comparativa Crítica: Ego vs OpenClaw

| Dimensión Técnica | OpenClaw (🦞) | Ego (Cognitive OS) | Evaluación del Ingeniero Principal |
|---|---|---|---|
| **Lenguaje de Núcleo** | TypeScript 100% (Node 24/26, pnpm). | TypeScript 100% (Node 22, pnpm). | **Alineación total de stack.** Patrones de OpenClaw son directamente portables a Ego sin fricción de lenguaje. |
| **Sustrato de Memoria** | Archivos Markdown planos + Kysely sobre SQLite (`node-sqlite.mjs`). | **VantaDB 0.8.0 nativo in-process** (`NativeVantaDB` napi-rs + Fjall LSM + HNSW + BM25 + GraphRAG). | **Ego es inmensamente superior.** OpenClaw carece de búsqueda híbrida nativa y grafos de conocimiento. Se descarta SQLite de OpenClaw. |
| **Entorno de Presentación** | Headless Gateway + Control UI web ligera + clientes de mensajería (WhatsApp, Telegram). | **Desktop SOC Soberano (Electron 40 + React 19 + Assistant-UI)** con Dynamic Workspace. | **Ego ofrece experiencia desktop de primera clase.** OpenClaw está optimizado para bots de chat; Ego es un sistema operativo cognitivo interactivo. |
| **Gobernanza de Ejecución** | Modelo formal de admisión (`AdmittedRunContext`), grants y tokens de autorización. | Definido en `ExecutionManager` y `ApprovalManager`. | **OpenClaw aporta un rigor excepcional.** Su pipeline de admisión de runs y propagación de `AbortSignal` supera lo definido inicialmente en Ego. |
| **Resiliencia en Tool Calling**| Paquete autónomo `packages/tool-call-repair` para arreglar JSON roto del modelo. | Tool executor básico. | **OpenClaw resuelve un problema crítico.** La reparación sintáctica en caliente previene fallos silenciosos en modelos pequeños. |

---

## 4. Clasificación según la Regla de Extracción Condicionada

### A. Categoría 1: Ya Definido en Ego (Candidatos a Mejora Directa)

Estos módulos optimizan y blindan capacidades que ya forman parte del Backlog Maestro de Ego:

| Módulo / Archivo OpenClaw | Destino en Ego | Tarea Ego Impactada | Justificación Técnica |
|---|---|:---:|---|
| `src/agents/admitted-run-context.ts` | `packages/core/execution/admitted-run-context.ts` | **Fase 02** (`ACT-01`, `ACT-03`) | Formaliza la admisión inmutable de cada ejecución del agente, asociando `runId`, `instanceId`, scopes de autoridad y propagación de `AbortSignal`. |
| `src/sessions/session-lifecycle-locks.ts` | `packages/memory/session-locks.ts` | **Fase 01 & 10** (`CORE-07`, `REC-01`) | Locks atómicos por ID de sesión que evitan condiciones de carrera si entran múltiples mensajes o herramientas concurrentemente. |
| `src/sessions/transcript-read-window.ts` | `packages/memory/transcript-window.ts` | **Fase 01** (`CORE-05`, `CORE-07`) | Paginación y ventanas deslizantes de lectura de transcripción; evita cargar megabytes de historial en RAM al renderizar el chat. |
| `packages/net-policy/` | `packages/security/net-policy.ts` | **Fase 11** (`SEC-01`, `SEC-02`) | Política de red determinista que bloquea ataques SSRF (ej. herramientas del agente intentando consultar `127.0.0.1` o metadatos de nube). |
| `packages/mermaid-renderer/` | `apps/desktop/renderer/components/mermaid-viewer.tsx` | **Fase 04** (`CANV-03`, `CANV-05`) | Validación y renderizado reactivo de diagramas Mermaid dentro del Canvas del Dynamic Workspace de Ego. |

---

### B. Categoría 2: No Definido en Ego (Evaluación Crítica & RFCs)

Sometemos las funcionalidades novedosas al filtro crítico de utilidad, riesgo y trade-offs:

#### RFC-OCLW-01: Módulo Autónomo de Auto-Reparación de Tool Calls (`packages/tool-call-repair`)
* **Qué es:** Una librería pura de TypeScript que intercepta llamadas a herramientas devueltas por el LLM antes de fallar. Si el JSON está truncado, tiene comillas sin cerrar, claves con nombres aproximados o tipos mal convertidos (ej. string en vez de número), aplica heurísticas deterministas para repararlo en memoria sin quemar otro turno de inferencia.
* **Evaluación de Utilidad Real:** **Extremadamente Alta**. Modelos locales (Ollama Llama 3 / Qwen 2.5) o modelos rápidos en streaming suelen emitir JSON con imperfecciones menores que tiran abajo los agentes convencionales.
* **Trade-offs & FMEA:**
  - *Ventajas:* Cero latencia adicional; resiliencia total ante fallos de formato; compatible con cualquier proveedor.
  - *Riesgos:* Posibilidad de asumir un valor incorrecto si la reparación altera la semántica del parámetro -> *Mitigación:* Reparar únicamente sintaxis y tipado; si la ambigüedad persiste, solicitar aclaración HITL.
* **Veredicto del Analista:** **APROBAR PARA FASE 02 (`ACT-09`)**. Incorporación inmediata en TypeScript.

---

#### RFC-OCLW-02: Seguimiento de Diffs y Revisiones Acumuladas por Sesión (`src/sessions/session-diff-revisions.ts`)
* **Qué es:** Un motor de seguimiento que calcula y mantiene el grafo de cambios sobre archivos (diffs incrementales) generados por los Sub-Egos a lo largo de una conversación.
* **Evaluación de Utilidad Real:** **Muy Alta**. Permite que el usuario consulte en cualquier momento: *"¿Qué archivos ha modificado Ego en esta sesión?"*, ver el diff unificado acumulado y realizar rollbacks selectivos de un archivo específico.
* **Trade-offs & FMEA:**
  - *Ventajas:* Visibilidad total de cambios; auditable; complementa el aislamiento de Git Worktrees de Hermes.
  - *Riesgos:* Overhead de memoria si se modifican binarios -> *Mitigación:* Ignorar archivos no textuales y poner límites de tamaño (1 MB por diff).
* **Veredicto:** **APROBAR PARA FASE 02 (`ACT-10`) Y FASE 04 (`CANV-06`)**.

---

#### RFC-OCLW-03: Runtime de Workers Aislados (`packages/worker-runtime`)
* **Qué es:** Un harness en Node.js que ejecuta herramientas intensivas de CPU (ej. procesamiento de archivos masivos, parsing AST, indexación) dentro de `node:worker_threads` independientes, comunicándose por puertos de mensajes (`MessagePort`).
* **Evaluación de Utilidad Real:** **Crítica para Electron**. En Electron, si el proceso Main ejecuta una operación pesada de CPU en el event loop principal, la ventana gráfica (Renderer) se congela y deja de responder a los clicks del usuario.
* **Veredicto:** **APROBAR PARA FASE 07 (`TASK-05`)**. Garantiza que las tareas en background de Ego nunca bloqueen la fluidez de la UI.

---

#### RFC-OCLW-04: Conectores Omnicanal de Redes de Mensajería (WhatsApp, Telegram, Discord)
* **Qué es:** Capa de transporte en OpenClaw (`src/channels/`) para conectar el asistente a más de 20 plataformas (WhatsApp, Telegram, Discord, Slack, iMessage, Teams, Signal, Google Chat).
* **Evaluación:** Implementar 20 canales en P0 dispersaría el foco del producto desktop principal.
* **Veredicto:** **POSTERGAR A P1 (Fase 09+)**. Se documenta en el catálogo de capacidades postergadas con su plan de reactivación.

---

## 5. Catálogo Exhaustivo de Capacidades Postergadas de OpenClaw (Roadmap P1/P2)

Siguiendo el mandato de gobernanza técnica, **todas las capacidades investigadas en OpenClaw quedan formalmente documentadas**, estableciendo la fase futura de reactivación y la justificación técnica de su postergación en P0:

| Capacidad Investigada | Archivo Fuente en OpenClaw | Fase Futura de Reactivación | Justificación Técnica de Postergación en P0 | Plan de Reactivación en Ego |
|---|---|:---:|---|---|
| **Conectores Omnicanal (20+ Canales)** | `src/channels/` (WhatsApp, Telegram, Slack, etc.) | **Fase 09 (Dominios)** | En P0-Alpha el 100% del esfuerzo debe enfocarse en el Golden Path de escritorio (Desktop SOC). Los bots de mensajería distraen del Dynamic Workspace. | En Fase 09 se adaptará el gateway como adaptador opcional dentro del dominio de CRM y Comunicación. |
| **Sandboxing en Contenedores Docker** | `src/agents/sandbox/fs-bridge.js`, `docker-healthcheck.ts` | **Fase 11 (Seguridad)** | En P0 el aislamiento se realiza a nivel de proceso (`ExecutionManager` con `AbortSignal` y Git Worktrees). Exigir Docker en desktop añade una dependencia de 2 GB y fricción de instalación al usuario. | En Fase 11 se integrará Docker como backend de aislamiento opcional para ejecución de código no confiable. |
| **Túneles de Exposición Remota (Tailscale/Cloudflare)** | `src/gateway/tailscale-published-origin.ts`, `fly.toml` | **Fase 12+ (Ego Cloud)** | Ego es estrictamente **local-first** en P0. La exposición a WAN/LAN requiere auditoría de seguridad exhaustiva para no abrir vulnerabilidades en la máquina del usuario. | Se reactivará en la fase de Ego Cloud / Sync remoto para conectar el desktop con Ego Web. |
| **Control UI Web & TUI Nativo** | `ui/`, `src/tui/` | **P1-Beta (Herramientas CLI)** | Ego utiliza Electron + React 19 como interfaz canónica. Mantener una interfaz web paralela y una TUI en terminal duplica el coste de mantenimiento de UI. | Se evaluará para un modo "Ego Server Headless" para servidores sin entorno gráfico. |
| **Nodos Complementarios (Android / Wear OS)** | `packages/sdk/`, companion apps | **P2 (Ego Mobile)** | Requiere desarrollar y firmar aplicaciones móviles nativas para Android/iOS con permisos de cámara y ubicación, fuera del alcance del SOC desktop inicial. | Se estudiará en el roadmap móvil de Ego una vez estabilizado el núcleo de escritorio. |

---

## 6. Inventario Quirúrgico de Rutas Locales a Auditar

Para ejecutar la extracción en el monorepo de Ego, se deben consultar las siguientes rutas exactas en `repos-referencia/openclaw/`:

```
repos-referencia/openclaw/
├── packages/
│   ├── tool-call-repair/             → [RFC-OCLW-01] Adaptar a packages/core/tools/
│   ├── net-policy/                   → [OCLW-05] Adaptar a packages/security/net-policy.ts
│   ├── mermaid-renderer/             → [OCLW-06] Adaptar a apps/desktop/renderer/
│   └── worker-runtime/               → [RFC-OCLW-03] Worker threads para background tasks
└── src/
    ├── agents/
    │   └── admitted-run-context.ts   → [OCLW-01] Contexto inmutable de ejecución
    └── sessions/
        ├── session-lifecycle-locks.ts → [OCLW-02] Exclusión mutua de sesiones
        ├── transcript-read-window.ts  → [OCLW-03] Paginación de transcripciones
        └── session-diff-revisions.ts  → [RFC-OCLW-02] Grafo de diffs acumulados
```

---

## 7. Directivas de Cierre

1. **Stack Unificado:** Toda la extracción de OpenClaw se realiza en TypeScript nativo, encajando sin adaptadores de lenguaje en el monorepo pnpm de Ego.
2. **Cero Dependencia de SQLite:** Se descarta `node-sqlite.mjs` de OpenClaw; la persistencia se conecta de forma soberana a `NativeVantaDB`.
3. **Prioridad Inmediata:** `tool-call-repair` y `admitted-run-context` se asignan como prioridades directas para robustecer la Fase 02 (`ACT-01..10`) de Ego.
