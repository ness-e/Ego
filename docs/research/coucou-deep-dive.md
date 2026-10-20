# Investigación Profunda: Coucou (Louis-CFM/coucou)
### Análisis de Observabilidad de Ejecución, Gobernanza HITL, Motor de Atención y Mutaciones Seguras

| Campo | Valor |
| --- | --- |
| Estado | Canónico — Informe de Investigación y Arquitectura |
| Repositorio Origen | `repos-referencia/coucou/` · [GitHub](https://github.com/Louis-CFM/coucou) |
| Autor / Licencia | Louis-CFM · MIT (Código) / Restricción de Marca (Mochi, Assets) |
| Stack del Origen | macOS (Swift, SwiftUI, AppKit, Socket) + Windows (Tauri 2, Rust, Vite, TypeScript) |
| Rol en Ego | Referencia de Observabilidad de Agentes en Ejecución, Atención y Gobernanza HITL |
| Owner | ness-e / Principal Systems Engineer |
| Fecha | 2026-10-07 |

---

## 1. Resumen Ejecutivo y Tesis de Extracción

`Louis-CFM/coucou` es una aplicación de escritorio diseñada para observar, acompañar y controlar sesiones de agentes de programación en tiempo real (Claude Code, Gemini CLI, OpenCode, Codex, etc.). 

### La Tesis Fundamental de Ingeniería
> **La pieza estratégica de Coucou NO es el notch ni la mascota Mochi.**
> 
> Lo verdaderamente valioso para Ego es su **arquitectura de observación reactiva, gobierno de atención y control no bloqueante de agentes en ejecución**:
> 
> ```text
> Eventos Externos ──> Normalización ──> Evento Canónico ──> State Reducer ──>
>     ├── Atención / Presencia (UI / Canvas / System Tray)
>     ├── Gobernanza (Approval / HITL con ACK y Timeouts)
>     └── Registro de Ejecución (Run Recorder / VantaDB / ChangeSet)
> ```

Ego, como **Sistema Operativo Cognitivo (SOC)**, ejecuta trabajo cognitivo continuo multi-agente. Requiere observar ese trabajo, interrumpirlo de forma determinista, solicitar autorización humana para acciones sensibles y registrar la trazabilidad completa sin convertir cada interacción en una conversación bloqueante.

---

## 2. Los Cuatro Pilares Arquitectónicos de Coucou para Ego

### Pilar 1: Normalización de Eventos en el Borde (Edge Normalization)
* **El Problema:** Claude Code, Codex, Gemini, OpenCode, Hermes y servidores MCP emiten eventos con terminologías, cargas útiles y formatos incompatibles.
* **La Solución en Coucou:** Un servidor de captura intercepta eventos heterogéneos y los mapea inmediatamente a un enum canónico (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PermissionRequest`, `Stop`, etc.).
* **Aplicación en Ego:** Creación de la capa `EventIngress -> EventNormalizer -> CanonicalEgoEvent`. El Cognitive Runtime de Ego jamás conoce las peculiaridades de formato de herramientas externas.

### Pilar 2: Comunicación No Bloqueante por Defecto con Bloqueo Quirúrgico
* **El Problema:** Si la interfaz de observabilidad se congela o se cierra, el agente no debe detener su ejecución.
* **La Solución en Coucou:**
  - *Eventos ordinarios (actividad, progreso, logs):* Despacho `fire-and-forget`. Si la UI no responde, el agente continúa.
  - *Solicitudes interactivas (`ApprovalRequest`, `QuestionRequest`):* Conexión síncrona bloqueante, pero protegida por **ACK inmediato de la UI**, timeouts configurables, cancelación limpia y fallback seguro.
* **Aplicación en Ego:** El sistema de aprobación (`ApprovalTransport`) exige un ACK de disponibilidad de interfaz antes de pausar el proceso de ejecución.

### Pilar 3: Identificación Exacta de la Acción Autorizada (`ActionIdentity`)
* **El Problema:** Si dos herramientas o dos subagentes solicitan ejecutar un comando Bash simultáneamente, una aprobación humana genérica de "Bash" causaría una condición de carrera crítica (aprobar el comando equivocado).
* **La Solución en Coucou:** Correlación exacta basada en sesión, herramienta, input y JSON con claves canónicamente ordenadas.
* **Aplicación en Ego:** Formulación del contrato `ActionIdentity`:
  ```ts
  export interface ActionIdentity {
    runId: string;
    taskId: string;
    subEgoId: string;
    toolId: string;
    invocationId: string;
    inputDigest: string; // SHA-256 del input canónico
  }
  ```
  Una autorización humana solo puede desbloquear la invocación que produjo exactamente ese digest.

### Pilar 4: Desacoplamiento Radical del Estado (Anti-Singleton `AppState`)
* **El Problema en Coucou:** Coucou agrupa en un único `AppState` el estado de la UI, integraciones, sesiones, tareas, aprobaciones, chat y ajustes. En una aplicación pequeña funciona, pero en un SOC como Ego causaría bloqueos de renderizado y rigidez.
* **La Solución en Ego:** Fragmentación en 7 estados ortogonales:
  1. `RuntimeState`: Ejecuciones activas, hilos y workers.
  2. `InteractionState`: Solicitudes HITL pendientes (approvals, questions).
  3. `AttentionState`: Nivel de atención requerido (dormant, compact, active, interrupt).
  4. `WorkspaceState`: Canvas, selección de artefactos y vistas.
  5. `ProjectState`: Datos persistentes del proyecto en VantaDB.
  6. `IntegrationState`: Conectores MCP, estado de salud y cursores.
  7. `UserPreferences`: Ajustes de usuario.

---

## 3. Servicios Clave para el Construction Mode de Ego

### A. `ChangeSetService` (Evolución de `DiffEngine`)
Coucou incluye un motor de diffs de texto que calcula adiciones, eliminaciones y contexto con límites de seguridad (evita algoritmos cuadráticos en archivos masivos y conmuta a resúmenes cuando el archivo supera el umbral).
* **Implementación en Ego:** `packages/changes/ChangeSetService.ts`.
* **Capacidad:** Genera contratos inmutables `ChangeSet` para código, documentos markdown, esquemas y configuraciones, alimentando el Dynamic Workspace y el Canvas sin saturar la memoria RAM.

### B. `RunSnapshot` y `RunRecorder` (Evolución de `TurnSnapshot`)
Coucou reconstruye cada turno a partir de la secuencia de eventos recibidos (`TurnRecorder`), registrando inputs, acciones, outputs y cambios de archivos.
* **Implementación en Ego:** `packages/analytics/RunRecorder.ts`.
* **Sustrato:** El `RunRecorder` escucha el bus de eventos y persiste cada ejecución estructurada (`RunSnapshot`) directamente en **VantaDB** bajo namespaces `projects/<id>/runs/`, permitiendo auditoría histórica y reproducción fidedigna.

### C. `SafeConfigMutationService` (Servicio Transversal de Plataforma)
Antes de alterar archivos de configuración de agentes externos o del usuario, Coucou ejecuta un pipeline de 12 pasos a prueba de fallos:
```text
Lectura ──> Parseo ──> Validación de esquema ──> Cálculo de estado nuevo ──>
Diff preview ──> Backup temporal ──> Cálculo de fingerprint (SHA-256) ──>
Confirmación humana HITL ──> Re-verificación de fingerprint ──>
Escritura atómica (write temp + atomic rename) ──> Preservación de permisos del SO.
```
* **Aplicación en Ego:** Utilizado para mutaciones en `.ego/`, configuración de servidores MCP, claves de proveedores y ajustes de repositorios locales.

---

## 4. Descarte Categórico (Qué NO Extraer de Coucou)

Siguiendo el principio de sobriedad y la **Jerarquía Canónica de Ego**:

| Elemento en Coucou | Naturaleza | Decisión en Ego | Fundamento Técnico |
|---|---|:---:|---|
| **Notch / Isla Flotante** | UI física de macOS | ❌ **DESCARTAR** | Ego es una aplicación desktop completa en Electron (Chat + Canvas); el notch es específico de hardware Apple y restringe el espacio de trabajo. |
| **Mochi (Personaje / Mascota)** | Arte, animaciones y lore de marca | ❌ **DESCARTAR** | Mochi tiene restricción de derechos de autor (`LICENSE-ASSETS.md`). Ego cuenta con su propia identidad y mascota sombra Rive (`docs/product/mascota.md`). |
| **Backend en Rust/Tauri de Coucou** | Runtime de Coucou Windows | ❌ **DESCARTAR** | Ego corre su Cognitive Runtime directamente en Node.js 22 dentro de Electron Main, integrando Rust exclusivamente a través de los bindings napi-rs de VantaDB. |
| **CloudKit Sync & Relay APNs** | Sincronización propietaria Apple | ❌ **DESCARTAR** | Ego es local-first soberano sobre VantaDB. La sincronización externa se abordará en P2 mediante CRDT / Ego Cloud agnóstico. |
| **Polling de Ratón a 60 Hz** | Algoritmo de hover del notch | ❌ **DESCARTAR** | Consume ciclos de CPU innecesarios y degrada la autonomía de batería. |

---

## 5. Mapeo Canónico de Componentes: Coucou → Ego

```text
Coucou (Patrón / Componente)             Ego (Arquitectura Canónica)
─────────────────────────────────────────────────────────────────────────────
HookServer.swift / server.rs        ──>  EventGateway (Ingreso de eventos)
Hook Event Enums                    ──>  CanonicalEgoEvent (Contrato unificado)
AgentTask                           ──>  Run / ExecutionState (NO es Sub-Ego)
PillCatalog                         ──>  Registry Pattern (IDs estables)
PendingApproval                     ──>  ApprovalRequest (Gobernanza HITL)
AskUserQuestion                     ──>  QuestionRequest (Interaction Engine)
isPinned                            ──>  InteractionLease (Retención de foco)
IslandStateMachine                  ──>  AttentionStateMachine (FSM pura)
AppState (Singleton)                ──>  7 Estados Ortogonales Desacoplados
TurnSnapshot / TurnRecorder         ──>  RunSnapshot / RunRecorder (VantaDB)
DiffEngine                          ──>  ChangeSetService (Workspace / Canvas)
Config Preview & Atomic Write       ──>  SafeConfigMutationService
DemoEngine                          ──>  Synthetic Runtime / Demo Mode
SafeWebURL                          ──>  URL & Resource Policy
RecapStore                          ──>  ActivityAnalytics (Métricas en VantaDB)
```

---

## 6. Integración en el Roadmap de Ego

1. **P0 (Alpha):**
   - Ingress de eventos normalizado (`EventGateway`).
   - Contrato canónico de `ActionIdentity` y `ApprovalRequest` con ACK.
   - `SafeConfigMutationService` para instaladores y MCP.
   - `ChangeSetService` básico para visualización de modificaciones.
2. **P1 (Beta):**
   - `RunRecorder` y persistencia de `RunSnapshot` en VantaDB.
   - `AttentionStateMachine` para gobernar el Activity Center y Daily State.
   - `ActivityAnalytics` con agregación de intervalos no solapados.
   - `Synthetic Runtime` para pruebas de integración y demos deterministas.
3. **P2 (Evolución):**
   - Relay externo opcional y control remoto desatendido.

---

## 8. Verificación de la extracción contra el código (2026-10-19) — Ola 1, A5

> La fuente canónica del estado por patrón es
> [`docs/review/backlog-coucou.md`](../review/backlog-coucou.md). Este apartado documenta
> **qué de lo que este deep-dive propuso existe hoy en Ego, y con qué estado**.

### 8.1 Los cuatro pilares, verificados contra el código

| Pilar (este deep-dive) | Adaptación en Ego | Estado | Evidencia |
|---|---|:---:|---|
| **Pilar 1** — Normalización de eventos en el borde | `packages/events/src/EventNormalizer.ts:35` + `EventIngress.ts:45` | 🆕 Pendiente | Módulo y tests existen; **sin caller**: el `EventBus` emite `EgoEvent` ya tipado y no hay todavía adaptadores de agentes externos. El cableado depende del primer adapter externo (`COUC-22`). |
| **Pilar 2** — Comunicación no bloqueante por defecto | `packages/events/src/EventIngress.ts:45` | 🆕 Pendiente | Mismo origen que el Pilar 1. |
| **Pilar 3** — Identificación exacta de la acción autorizada (`ActionIdentity`) | `packages/execution/src/ApprovalEngine.ts:35` (`computeActionIdentity`) + `packages/execution/src/types.ts:81` + `packages/events/src/ApprovalIdentity.ts:59` | ✅ Completada | **Caller en producción:** `apps/desktop/src/main.ts:30`. El digest SHA-256 sobre los argumentos canónicos se usa también como credencial de aprobación en `packages/execution/src/WidgetHitlBridge.ts:93-122` (Pilar 4). |
| **Pilar 4** — Desacoplamiento radical del estado (anti-singleton `AppState`) | `packages/ui-runtime/src/stores/EgoStateStores.ts` (7 slices) | 🚫 **Descartada (con justificación)** | El slice genérico no se cablea: en Ego la fragmentación equivalente ya la dan los módulos canónicos por dominio (`AttentionStateMachine`, `ApprovalEngine`, estado de runtime en `main.ts`, store Zustand de UI en `renderer/components/ui-kit/store.ts`). Un store adicional sería una tercera fuente de verdad. **El objetivo del Pilar 4 (no singleton) se cumple; la instrumentación propuesta no.** |

### 8.2 Servicios clave del Construction Mode

| Servicio | Adaptación | Estado | Evidencia |
|---|---|:---:|---|
| **A** — `ChangeSetService` (evolución de `DiffEngine`) | `packages/tools/src/native/git/ChangeSetService.ts` | ✅ Completada | Caller transitivo: `packages/execution/src/SafeConfigMutation.ts:81` → `packages/integrations/src/mcp/McpManager.ts` → `main.ts:23`. |
| **B** — `RunSnapshot` / `RunRecorder` (evolución de `TurnSnapshot`) | `packages/tasks/src/RunRecorder.ts` | 🆕 Pendiente | Implementación completa (`RunSnapshot`, `RunAction`, digest canónico SEC-06 H6, consumo de `EventBus`) pero **sin caller**. Cableado pendiente: instanciarlo al cierre de turno en `BackgroundEngine` / `ToolExecutionLoop`. |
| **C** — `SafeConfigMutationService` (servicio transversal) | `packages/execution/src/SafeConfigMutation.ts` | ✅ Completada | Caller: `packages/integrations/src/mcp/{McpManager,McpClient}.ts` → `main.ts:23`; UI en `renderer/components/mcp/McpManagerModal.tsx`. |

### 8.3 Descarte categórico (sección 4 de este deep-dive)

El catálogo de "qué NO extraer" de la §4 se normalizó el 2026-10-19 a la forma canónica
`🚫 Descartada (con justificación)` en [`docs/extractions/coucou.md`](../extractions/coucou.md) §39.
Resumen de los 11 descartes con fundamento técnico: notch/NSPanel/AppKit/SwiftUI, CloudKit,
Tauri + backend Rust, singleton `AppState`, Pill como entidad de dominio, layout constants,
Mochi (marca), polling 60 Hz, integración Claude Code como dependencia central, UI de notch como
identidad de producto, presencia como producto de Ego.

### 8.4 Nota sobre el motor de avatar (tarea `COUC-21`)

`packages/avatar/src/render/projection.js:2` declara el puerto del `drawEyes()` de
`coucou mochi/engine.ts` (MIT). El **patrón técnico** (proyección ocular yaw/pitch, resortes,
timeline determinista) queda asimilado; la **marca y el arte** quedan descartados
(`docs/extractions/coucou.md` §52.4, decisión D4 del owner). El paquete `@ego/avatar` no tiene
dependents: la ventana flotante ejecuta la copia vendorizada
`apps/desktop/renderer/floating/vendor/avatar/` (decisión D5: se mantienen las tres copias).
