# Coucou → Ego: expediente de extracción técnica

## 0. Propósito

Este documento define cómo estudiar y extraer de `Louis-CFM/coucou` las ideas, patrones, arquitectura, lógica y piezas de implementación que puedan integrarse en Ego sin convertir a Ego en un clon de Coucou.

Regla principal:

> Extraer mecanismos, contratos y patrones de ingeniería; no importar la forma superficial del producto.

Coucou es actualmente una aplicación de presencia y control para sesiones de agentes de programación: observa eventos de agentes, mantiene estado de sesiones, muestra actividad, permite intervenciones humanas, integra servicios y extiende la experiencia entre escritorio e iPhone. El repositorio es MIT para el código, mientras que la marca/personaje Mochi y determinados assets no forman parte de esa licencia.

---

# 1. Veredicto ejecutivo

## Qué es realmente interesante en Coucou

La pieza estratégica no es el notch.

La arquitectura valiosa de Coucou puede resumirse como:

**Eventos externos → normalización → estado canónico → atención/presencia → interacción humana → acción de vuelta → registro/recap**

Esto coincide con una necesidad central de Ego:

**Ego ejecuta trabajo cognitivo continuo y necesita observarlo, gobernarlo, interrumpirlo, pedir autorización, representar su estado y permitir intervención humana sin convertir toda interacción en una conversación bloqueante.**

Por tanto, Coucou debe tratarse en Ego como una fuente de patrones para cuatro áreas:

1. **Runtime / Event Ingress**
2. **Governance / Human-in-the-loop**
3. **Background Activity / Attention**
4. **Execution observability / Run records**

La UI de notch, pills, Mochi, CloudKit y la estructura concreta de Coucou no deben convertirse en arquitectura de Ego.

---

# 2. Clasificación de extracción

## 2.1 Extraer directamente como patrón

### A. Event normalization at the edge

Cada integración tiene eventos distintos, pero Coucou los transforma a un conjunto canónico:

- SessionStart
- UserPromptSubmit
- PreToolUse
- PostToolUse
- PostToolUseFailure
- PermissionRequest
- Notification
- Stop
- StopFailure
- SessionEnd
- SubagentStart
- SubagentStop

### Aplicación a Ego

Crear:

`EventIngress → EventNormalizer → CanonicalEvent`

El runtime de Ego no debería conocer cómo Claude Code, Copilot, OpenCode, Hermes, Gemini CLI o un MCP concreto nombran sus eventos.

Cada adapter traduce hacia el contrato interno.

**Patrón:**

```text
External Adapter
    ↓
Raw Event
    ↓
Normalizer
    ↓
Canonical Ego Event
    ↓
Cognitive Runtime
```

Esto debe formar parte de la arquitectura base de integración de Ego.

---

## 2.2 Extraer directamente: comunicación no bloqueante por defecto

Coucou tiene una regla excelente:

- evento normal → fire-and-forget
- intervención humana real → conexión mantenida hasta resolver o expirar

Esto evita bloquear el agente sólo porque la aplicación de acompañamiento esté apagada, pausada o rota.

### Ego

Adoptar:

```text
Normal Event
  → accept
  → enqueue/process
  → return immediately

Interactive Request
  → create InteractionRequest
  → await decision
  → timeout/fallback
  → return result
```

Esto encaja directamente con:

- Approval
- HumanQuestion
- Confirmation
- HITL
- Sensitive action review

y con el principio de Ego:

**La presencia de Ego no debe convertirse en una dependencia de disponibilidad para el ejecutor externo, salvo cuando una acción requiera legítimamente autorización humana.**

---

# 3. El patrón más importante: identificación exacta de una acción pendiente

Coucou no identifica una aprobación únicamente por:

`tool = Bash`

Construye una identidad mucho más precisa a partir de:

- pill/actor
- session
- tool
- command
- tool input

Y utiliza JSON con claves ordenadas para mantener una representación estable.

Después, una acción posterior sólo resuelve la aprobación si coincide con esa identidad exacta.

Esto protege frente a sesiones y herramientas paralelas.

## Ego

Esto debe evolucionar a un contrato propio:

```ts
interface ActionIdentity {
  runId: string;
  taskId: string;
  subEgoId: string;
  toolId: string;
  invocationId: string;
  inputDigest: string;
}
```

Y:

```ts
interface ApprovalRequest {
  requestId: string;
  action: ActionIdentity;
  authorityScope: string;
  riskClass: string;
  createdAt: string;
  expiresAt: string;
}
```

La decisión nunca debe aplicarse únicamente por `toolName`.

### Regla de Ego

> Una autorización sólo puede resolver exactamente la acción para la que fue emitida.

Esta pieza es especialmente importante para ejecución paralela.

---

# 4. Coucou `AgentTask` ≠ Ego `Sub-Ego`

Este límite debe quedar escrito antes de extraer código.

En Coucou:

`AgentTask` representa esencialmente una sesión/participante visible:

- id
- name
- state
- steps
- source
- cwd
- badge
- finalLine

No es el equivalente conceptual de un Sub-Ego de Ego.

## En Ego

El equivalente correcto se divide:

```text
Sub-Ego
    ├── Identity
    ├── Instructions
    ├── Skills
    ├── Memory access
    ├── Tools
    ├── Permissions
    ├── Budget
    └── Capabilities

Run
    ├── runId
    ├── subEgoId
    ├── projectId
    ├── status
    ├── events
    ├── artifacts
    ├── actions
    └── outcome
```

La sesión visual de Coucou se convierte en **Run/Execution State**, no en Sub-Ego.

---

# 5. Extraer el concepto de participante persistente vs participante efímero

Coucou distingue de hecho entre:

- participantes declarados/persistentes
- agentes externos que aparecen dinámicamente durante una sesión

Eso es muy útil para Ego.

## Ego

Debe distinguir:

### Persistent Sub-Ego

Existe como objeto de usuario:

- tiene configuración
- tiene memoria
- puede estar habilitado/deshabilitado
- aparece en el workspace
- puede recibir trabajo recurrente

### Ephemeral Specialist

Se crea para resolver una tarea:

- no necesariamente visible
- vida corta
- sin interfaz propia obligatoria
- puede devolver resultado al Sub-Ego padre
- desaparece cuando termina

Así se evita obligar a Ego a registrar un nuevo Sub-Ego permanente cada vez que necesita una especialización temporal.

---

# 6. Extraer la máquina de estados pura

`IslandStateMachine` es una de las mejores piezas de arquitectura del repositorio.

Sus propiedades relevantes:

- no depende de AppKit
- no depende de AppState
- sólo recibe eventos
- produce transiciones
- encapsula timers
- define guards
- soporta estados externos
- permite `onTransition`

Eso es exactamente el patrón que Ego debe usar para estados complejos.

## No copiar los estados

No usar:

- hidden
- petit
- home
- coucou

como estados de Ego.

## Crear una abstracción propia

### Attention / Presence State Machine

```text
dormant
compact
active
interaction
```

con inputs como:

```text
activity_started
activity_changed
important_event
user_entered
user_left
interaction_required
interaction_resolved
pinned
expired
shutdown
```

Esto puede gobernar:

- Dynamic Workspace
- Activity Center
- tray/presence
- notifications
- compact mode
- human attention
- foreground/background surface

El principio reusable es:

> Estado temporal complejo fuera de la UI y sin dependencia de framework gráfico.

---

# 7. Extraer `AppState`, pero NO el singleton

Coucou centraliza mucha información en `AppState`.

Eso funciona para una aplicación pequeña de UI, pero para Ego sería un anti-patrón si se copia directamente.

Coucou mezcla:

- UI state
- integration state
- session state
- task state
- pending interaction state
- settings
- chat state
- media state
- recap state

## Ego debe partirlo

### RuntimeState

Estado del runtime y ejecuciones.

### InteractionState

Approvals, questions, confirmations, human input.

### AttentionState

Qué merece atención, prioridad y superficie.

### WorkspaceState

Canvas, selección, vistas, artefactos activos.

### ProjectState

Estado persistente del proyecto.

### IntegrationState

Conectores, health, cursors, errors.

### UserPreferences

Preferencias de interfaz.

La extracción correcta de Coucou es el patrón de estado reactivo y sus invariantes, no su forma de singleton.

---

# 8. `PillCatalog` → Registry Pattern

`PillCatalog.swift` es importante por una razón diferente.

Coucou tiene una fuente única de verdad para:

- id
- nombre
- categoría
- color
- source
- disponibilidad
- build target

Eso evita que cada pantalla invente sus propios nombres y IDs.

## Ego

Crear un `Registry` equivalente para:

- Sub-Egos
- Integrations
- Tools
- Model Providers
- Models
- Skills
- Workspace components
- Events

Ejemplo:

```ts
interface RegistryDefinition {
  id: string;
  version: string;
  kind: RegistryKind;
  capabilities: string[];
  availability: Availability;
  metadata: Record<string, unknown>;
}
```

## Regla

IDs estables son contrato.

No renombrar identificadores persistentes sólo porque se cambió una etiqueta visual.

Esto debe aplicarse a Ego en:

- tool IDs
- capability IDs
- integration IDs
- Sub-Ego IDs
- event types
- schema versions

---

# 9. Event dispatcher: extracción de la lógica de transición

`HookServer.processEvent()` muestra un patrón muy claro:

```text
event
 ↓
identify session
 ↓
identify project
 ↓
identify actor
 ↓
classify event
 ↓
update state
 ↓
record activity
 ↓
surface attention
```

## Ego

Convertirlo en pipeline explícito:

```text
Canonical Event
   ↓
Event Context Resolver
   ├── project
   ├── run
   ├── sub-ego
   ├── task
   └── authority
   ↓
Event Reducer
   ↓
Runtime State
   ↓
Activity/Event Store
   ↓
Attention Evaluator
   ↓
Workspace/User Surface
```

Esto es preferible a un `HookServer` gigantesco.

---

# 10. El gran refactor conceptual: `HookServer` → `Event Gateway`

El archivo `HookServer.swift` funciona, pero contiene demasiadas responsabilidades:

- socket server
- parsing
- routing
- agent validation
- event processing
- approval transport
- questions
- hook installers
- config migration
- fingerprinting
- file writing
- integration support

## Ego no debe importar esta forma.

Debe descomponerse en:

```text
EventGateway
EventNormalizer
RunResolver
EventReducer
ApprovalTransport
QuestionTransport
IntegrationInstaller
ConfigMutationService
RequestIdentity
```

Cada uno con interfaces propias.

---

# 11. Approval transport: candidato prioritario P0

Coucou demuestra una arquitectura robusta para HITL:

```text
Agent
  ↓
PermissionRequest
  ↓
Application
  ↓
Pending request
  ↓
Human decision
  ↓
exact request correlation
  ↓
Agent
```

Tiene además:

- timeout
- cancellation
- duplicate request handling
- pending state
- UI pin
- restoration of previous focus
- external resolution detection

## Ego

Convertir esto en:

```ts
interface ApprovalTransport {
  submit(request: ApprovalRequest): Promise<ApprovalResolution>;
  resolve(requestId: string, decision: ApprovalDecision): Promise<void>;
  cancel(requestId: string, reason: string): Promise<void>;
}
```

Y separar:

```text
Approval Engine
Approval Policy
Approval Transport
Approval UI
Audit
```

No poner el approval dentro del renderer.

---

# 12. Human Question ≠ Approval

Coucou ya distingue dos flujos:

- PermissionRequest
- AskUserQuestion

Eso es correcto y debe preservarse.

## Ego

Introducir un tipo superior:

```text
InteractionRequest
```

con subtipos:

```text
ApprovalRequest
QuestionRequest
ConfirmationRequest
ChoiceRequest
InputRequest
```

### Ejemplo

```ts
type InteractionRequest =
  | ApprovalRequest
  | QuestionRequest
  | ConfirmationRequest
  | InputRequest;
```

Así el runtime no depende de una UI concreta.

---

# 13. `isPinned` → Interaction Lease

El concepto de “pinned while human attention is required” es útil.

Pero en Ego no debería ser simplemente una bandera visual.

Debe ser una propiedad de la interacción:

```text
InteractionRequest
  ├── status
  ├── priority
  ├── createdAt
  ├── expiresAt
  ├── requiresAttention
  └── attentionLease
```

Mientras exista un lease válido:

- no auto-dismiss
- no degradar silenciosamente
- no ejecutar sin resolución
- mantener visible en alguna superficie adecuada

---

# 14. Background Activity

Coucou hace algo muy útil:

- cuando existe trabajo pero no requiere atención, muestra presencia compacta
- cuando hay una alerta importante, eleva la superficie
- cuando no existe actividad, desaparece

Ese comportamiento es más importante para Ego que la estética de Mochi.

## Ego

Debe tener un `Attention Evaluator`:

```text
Event
 ↓
importance
urgency
risk
user relevance
current focus
 ↓
Attention Decision
 ├── silent
 ├── background
 ├── notify
 ├── surface
 └── interrupt
```

Esto conecta directamente con la idea previa de Ego de:

**Background Activity + Daily State + Activity Center**

---

# 15. `PillBadge` → Attention Signal

El badge de Coucou representa:

> “Hay algo que deberías mirar, pero no necesariamente ahora mismo.”

Esto es mejor entendido como:

`Attention Signal`.

## Ego

```ts
interface AttentionSignal {
  id: string;
  sourceId: string;
  severity: "info" | "notice" | "warning" | "critical";
  category: string;
  createdAt: string;
  expiresAt?: string;
  requiresAction: boolean;
}
```

La UI puede representarlo como:

- badge
- activity row
- notification
- Daily State item
- Canvas indicator

El core no debe conocer el formato visual.

---

# 16. DiffEngine → ChangeSet Service

`DiffEngine` es una extracción directa para Ego, especialmente para Construction Mode.

Características especialmente útiles:

- cálculo local
- límites de tamaño
- límite de líneas
- protección frente a coste cuadrático
- fallback a resumen cuando el diff completo no es razonable
- hunks con contexto
- representación compacta

## Ego

Crear:

`ChangeSetService`

Aplicaciones:

- código
- documentos
- configuración
- archivos
- generated artifacts
- workspace objects

Contrato conceptual:

```ts
interface ChangeSet {
  artifactId: string;
  before: ArtifactVersionRef;
  after: ArtifactVersionRef;
  summary: ChangeSummary;
  hunks?: ChangeHunk[];
  truncated: boolean;
}
```

### Regla

Nunca cargar diffs enormes en el estado principal del runtime sólo para poder enseñarlos.

---

# 17. Diff marker → metadata reference pattern

Coucou utiliza un marcador compacto para que una entrada de UI referencie un diff mediante:

- archivo
- additions
- removals
- diffId

sin insertar todo el diff dentro de la cadena visual.

El patrón útil es:

> UI event/row references an immutable payload by ID.

## Ego

Nunca usar texto de UI como almacenamiento accidental.

Usar:

```text
ActivityItem
  └── payloadRef
        └── ChangeSet
```

Esto también sirve para:

- artifacts
- tool calls
- decisions
- evidence
- logs
- reports

---

# 18. `TurnSnapshot` → Run Snapshot

`TurnSnapshot` es una de las mejores piezas conceptuales de Coucou.

Contiene:

- prompt
- actions
- outputs
- file changes
- final answer
- timestamps
- session/project identity

## Ego

Convertirla en:

`RunSnapshot`

o:

`SubEgoRunRecord`

pero con mayor alcance:

```text
Run
 ├── intent
 ├── project
 ├── subEgo
 ├── plan
 ├── actions
 ├── tool calls
 ├── artifacts
 ├── changes
 ├── decisions
 ├── approvals
 ├── evidence
 ├── outcome
 ├── errors
 ├── startedAt
 └── endedAt
```

Persistencia:

**VantaDB**, no CloudKit.

---

# 19. TurnRecorder → Run Recorder

Coucou reconstruye el último turno a partir de eventos que ya recibe.

Eso es exactamente el enfoque correcto para Ego:

> no inventar un segundo sistema de observación si el runtime ya posee los eventos.

## Ego

```text
Canonical Event
   ├── Runtime reducer
   ├── Run Recorder
   ├── Memory sync
   └── Attention evaluator
```

El recorder debe ser consumidor del bus de eventos.

No debe convertirse en una segunda fuente de verdad.

---

# 20. RecapStore → Activity Analytics

Coucou calcula:

- tiempo
- sesiones
- archivos
- líneas
- comandos
- preguntas
- permisos
- agente principal
- proyecto principal
- día más activo
- sesión más larga

El patrón es útil.

Pero Ego tiene un alcance mucho mayor.

## Ego

Transformar esto en:

`Activity Analytics`

con:

- work runs
- Sub-Ego utilization
- tool use
- decision count
- approval latency
- blocked work
- failures
- artifact production
- project activity
- memory activity
- background jobs
- cost/model usage

Persistencia en VantaDB.

---

# 21. Cálculo de intervalos solapados

El `RecapStore` evita contar dos veces sesiones paralelas al fusionar intervalos.

Es una pequeña pieza algorítmica pero muy buena.

Debe extraerse como utilidad transversal:

`IntervalSet.mergeOverlaps()`

Usos en Ego:

- tiempo de trabajo
- ejecución paralela
- duración de jobs
- SLA
- presencia
- uso de recursos
- disponibilidad

---

# 22. Graceful degradation

Coucou hace esto repetidamente:

- app apagada → hook continúa
- modelo no disponible → error utilizable
- payload malformado → fallback
- decisión fuera de tiempo → terminal toma control
- integración caída → conserva estado y muestra error
- archivo grande → resumen
- diff demasiado costoso → fallback
- CloudKit unavailable → no rompe ejecución local

Esto debe convertirse en un principio explícito de Ego:

> Ningún componente auxiliar debe convertir una degradación de observabilidad en una interrupción innecesaria de trabajo.

---

# 23. Config mutation safety

Esta es una de las extracciones más valiosas de todo el repositorio.

Coucou, antes de modificar configuración externa:

1. lee el archivo
2. valida el formato
3. calcula nuevo estado
4. produce diff
5. crea backup
6. calcula fingerprint
7. muestra preview
8. espera confirmación
9. vuelve a comprobar fingerprint
10. escribe atómicamente
11. conserva configuraciones de terceros
12. elimina solamente sus propios entries durante uninstall

## Ego

Esto debe convertirse en un servicio transversal:

`SafeConfigMutationService`

Contrato:

```ts
preview()
confirm()
apply()
rollback()
removeOwnedEntries()
```

Y:

```text
read
 → parse
 → validate
 → transform
 → diff
 → fingerprint
 → human approval
 → verify fingerprint
 → atomic write
```

Esto aplica a:

- MCP
- skills
- hooks
- provider configs
- shell config
- integration config
- project metadata

---

# 24. Atomic write + permission preservation

Coucou además evita escribir directamente sobre el archivo final:

```text
write temp
 → preserve permissions
 → rename atomically
```

Esto reduce corrupción por crash y evita ampliar accidentalmente permisos.

## Ego

Debe incorporarse al `SafeFileMutation` abstraction.

Especialmente importante para:

- `.ego/*`
- config
- secrets-adjacent files
- integration manifests
- generated project files

---

# 25. Fingerprint / optimistic concurrency

El fingerprint de Coucou tiene una función simple:

> “¿El archivo sigue siendo el mismo que el usuario revisó?”

Eso es una forma práctica de optimistic concurrency.

## Ego

Generalizar a:

```text
ResourceVersion
ContentDigest
ETag
RevisionId
```

y usar:

```text
previewRevision == currentRevision
```

antes de aplicar una mutación sensible.

Esto debe funcionar también para:

- approvals
- workspace mutations
- generated files
- config
- external service actions

---

# 26. Secret handling

Coucou separa:

- front-end
- backend
- secret store

El renderer sólo sabe si un secret está presente, no conoce necesariamente su valor.

## Ego

La regla debe ser:

```text
Renderer
  → Secret Capability
  → privileged runtime
  → OS credential store
```

Nunca:

```text
Renderer
  → raw API key
```

Y esto encaja con el boundary que Ego ya decidió para Electron.

---

# 27. `Bridge` → Ego typed IPC contract

La versión Windows de Coucou contiene un patrón muy limpio:

```text
Renderer
   ↓
typed bridge
   ↓
Tauri command/event layer
   ↓
privileged Rust
```

Además permite ejecutar la UI en navegador con no-op fallbacks.

## Ego

Esto refuerza:

```text
React Renderer
   ↓
typed IPC protocol
   ↓
Electron Main / Utility Process
   ↓
Cognitive Runtime / VantaDB / OS
```

Ego no debe exponer Node directamente al renderer.

---

# 28. Browser-safe UI iteration

El bridge de Coucou puede funcionar como no-op fuera de Tauri.

Este patrón tiene valor de ingeniería:

> la UI puede iterarse sin arrancar toda la infraestructura nativa.

Para Ego:

- `MockIPC`
- `MockRuntime`
- `SyntheticEventSource`
- `DemoDataProvider`

Esto acelera desarrollo del Canvas y componentes.

---

# 29. DemoEngine → Synthetic Runtime

Coucou tiene una demo determinista que:

- inyecta sesiones
- inyecta diffs
- simula approvals
- simula preguntas
- simula chat
- simula servicios
- preserva estado real
- restaura el estado al salir
- no toca red ni persistencia real

Esto es extremadamente útil para Ego.

## Ego

Crear:

`Synthetic Runtime / Demo Mode`

Debe poder generar:

```text
Project
Run
Sub-Ego
ToolCall
Approval
Question
Artifact
ChangeSet
Background Job
Completion
Failure
```

Esto permite:

- demos
- tests de integración
- UI development
- QA reproducible
- onboarding
- screenshots/videos
- regression fixtures

Importante: debe ejecutarse como una fuente de eventos sintéticos, no como lógica especial repartida por componentes.

---

# 30. Generation token para cancelar demos/trabajos viejos

Coucou utiliza un `generation` que invalida closures de ciclos anteriores.

Es un patrón simple para evitar que trabajo asíncrono viejo modifique estado nuevo.

## Ego

Generalizar como:

`RunEpoch` / `ExecutionGeneration`.

Puede utilizarse para:

- cancelación
- reinicio de workspace
- reconnect
- replacing an active task
- restart of integration
- stale async callback prevention

---

# 31. Cancellation propagation

El transporte Windows y el runtime de Coucou modelan cuidadosamente:

- timeout
- acknowledgement
- decision
- cancellation

Esto encaja con la decisión previa de Ego de adoptar `AbortSignal` desde OpenClaw.

## Ego

La cancelación debe atravesar toda la cadena:

```text
User
 ↓
Run
 ↓
Sub-Ego
 ↓
Planner
 ↓
Tool
 ↓
Worker
 ↓
External process
```

No sólo cancelar el frontend.

---

# 32. ACK antes de bloquear

Uno de los patrones más interesantes del relay Windows:

```text
PermissionRequest
   ↓
send event
   ↓
wait short ACK
   ↓
if UI actually accepted:
    keep request pending
else:
    decline/fallback immediately
```

Esto evita que el agente quede bloqueado casi dos minutos mientras la UI está:

- pausada
- rota
- no montada
- congelada

## Ego

Generalizar como:

`Interactive Request Admission`.

Antes de convertir una acción en una espera humana prolongada:

1. comprobar que el mecanismo de interacción está disponible
2. aceptar la solicitud
3. sólo entonces mantener el executor bloqueado
4. aplicar timeout
5. fallback seguro

Esta es una pieza excelente de governance.

---

# 33. Safe URL policy

`safeWebURL` acepta sólo:

- http
- https
- host válido

y rechaza schemes como:

- file
- smb
- custom app schemes

## Ego

Debe existir un `Resource/URL Policy`.

No permitir que output de un modelo abra arbitrariamente:

- `file://`
- `smb://`
- custom protocols
- local application deep links

Esto pertenece al execution/security layer, no a la UI.

---

# 34. Context Capture

`WindowContextCapture` obtiene:

- app activa
- título de ventana
- URL del navegador

Esto implementa la idea:

> la intención del usuario puede depender del contexto que ya está mirando.

## Ego

Convertir a:

`Context Capture Provider`

API conceptual:

```ts
interface ContextProvider {
  getContext(): Promise<ContextSnapshot>;
}
```

Tipos potenciales:

- active application
- active window
- active browser tab
- selected text
- selected files
- workspace
- terminal
- current project
- current Canvas selection

La UI puede decidir cuándo adjuntar el contexto, pero el provider debe ser desacoplado de la UI.

---

# 35. Cross-platform pure logic

Coucou mantiene código de lógica portátil separado del framework:

- FSM
- layout
- parsing
- state model
- diff
- shared models

Eso respalda una decisión de Ego:

> Las reglas de negocio y runtime deben poder ejecutarse sin Electron/React.

Arquitectura deseada:

```text
packages/
  cognitive-runtime
  protocol
  memory
  execution
  attention
  governance
  changeset
  context
```

y encima:

```text
Electron UI
Web UI
CLI
Automation
Mobile
```

---

# 36. Mobile relay pattern

El relay Cloudflare de Coucou es útil como patrón de infraestructura:

- stateless
- payload allowlisted
- tamaño máximo
- no guarda proyectos
- no maneja lógica de dominio
- usa un secret server-side
- sólo hace forwarding

## Ego

No adoptar Cloudflare ni APNs como arquitectura.

Extraer el patrón:

> Cuando sea necesario un componente cloud, mantenerlo mínimo, stateless y schema-constrained.

Esto encaja con:

- cloud optional
- local-first
- remote notifications
- external control surfaces

---

# 37. Pollers pausable/observable

Coucou pausa pollers cuando no está aportando valor.

Esto conecta con el Background Activity de Ego.

## Ego

Cada background worker debe tener:

- priority
- schedule
- run condition
- visibility relevance
- resource budget
- cancellation
- backoff
- last successful run
- health

No ejecutar 20 integraciones permanentemente porque algún humano decidió conectar 20 APIs.

La arquitectura debe gestionar:

```text
Idle
Observed
Important
Urgent
```

con diferentes políticas de polling/execution.

---

# 38. Tool summary generation

Coucou convierte tool inputs en descripciones compactas:

```text
Edit · LoginForm.tsx
Bash · npm test
WebSearch · query
```

Es un patrón de observabilidad.

## Ego

Crear:

`ActionSummarizer`

entrada:

```text
ToolInvocation
```

salida:

```text
human-readable summary
```

La UI nunca debería construir sus propios resúmenes a partir de raw tool input.

---

# 39. Veredicto de Descarte Justificado — qué NO se extrae de Coucou

> **Taxonomía canónica (AGENTS.md §4):** `🚫 Descartada (con justificación)`.
> Esta sección se normalizó el **2026-10-19** (Ola 1 de remediación, agente A5). Hasta esa
> fecha la ficha no contenía **ninguna** mención de descarte: el rechazo estaba redactado
> como una lista libre de "No extraer", que no satisface el guardrail de compuertas de
> `AGENTS.md` §4 (todo hallazgo debe terminar en `✅ Completada` o `🚫 Descartada`).

## 39.1 Descartada como arquitectura

| Pieza de Coucou | Veredicto | Fundamento técnico |
|---|:---:|---|
| Notch / NSPanel / AppKit / SwiftUI | 🚫 **Descartada (con justificación)** | Son primitivas del shell de macOS. Ego usa Electron + React 19 (`apps/desktop/`); el shell y su ciclo de vida son una decisión de stack de `AGENTS.md` §1, no un patrón extraíble. |
| CloudKit | 🚫 **Descartada (con justificación)** | Dependencia de nube de Apple. Viola el principio 1 (memoria local persistente) y el 8 (local-first + propiedad/exportación de datos). El sustrato es VantaDB in-process. |
| Tauri 2 + backend Rust de Coucou | 🚫 **Descartada (con justificación)** | Los bindings nativos de Ego se confinan a `NativeVantaDB` (napi-rs). Un segundo runtime nativo duplicaría el modelo de datos y rompería el guardrail de "un único sustrato de memoria". |
| Singleton `AppState` | 🚫 **Descartada (con justificación)** | Ver §7: el estado se fragmenta en stores ortogonales. En Ego la fragmentación equivalente ya la dan los módulos canónicos por dominio (`AttentionStateMachine`, `ApprovalEngine`, estado de runtime en `main.ts`). |
| Pill como entidad de dominio | 🚫 **Descartada (con justificación)** | Un "Pill" es un actor visual, no un concepto de dominio. En Ego los actores son Sub-Egos (`packages/subegos/src/SubEgoManifest.ts`). |
| Layout constants como dominio | 🚫 **Descartada (con justificación)** | Las constantes de layout son un artefacto de la UI de Coucou, no un contrato. |
| Mochi (personaje, marca, arte, sonido) | 🚫 **Descartada (con justificación)** | Marca y activo de terceros bajo licencia **distinta de MIT**. La decisión canónica es que "ningún nombre, dibujo, sonido ni icono de Mochi/Coucou entra al producto". Ver §52 y la decisión D4 del owner (2026-10-19): los puertos verbatim se sustituyen por geometría propia. |
| Polling de ratón a 60 Hz como mecanismo general | 🚫 **Descartada (con justificación)** | Coste de CPU permanente sin valor. Ego usa eventos (`setIgnoreMouseEvents` + `forward`, sin polling) en la ventana flotante (`apps/desktop/renderer/floating/`). |
| Integración específica con Claude Code como dependencia central | 🚫 **Descartada (con justificación)** | Acopla el runtime a un agente concreto. En Ego el contrato es el `CanonicalEgoEvent` y los adaptadores son sustituibles. |

## 39.2 Descartada como identidad de producto

Coucou es una experiencia de presencia.

Ego es un Cognitive Operating System.

La interfaz de Coucou puede informar Ego, pero no definirlo.

| Elemento | Veredicto | Fundamento técnico |
|---|:---:|---|
| La UI de notch, pills, Mochi y CloudKit como **arquitectura** de Ego | 🚫 **Descartada (con justificación)** | `AGENTS.md` §2 fija la jerarquía de decisiones: *Identity → Principles → ProductModel → Capabilities → Architecture*. La identidad de Coucou no puede preceder al modelo de producto de Ego. |
| La **presencia** como producto de Ego | 🚫 **Descartada (con justificación)** | Ego no es un "notch companion". La capacidad equivalente en Ego es *Background Activity & Proactivity* (`packages/tasks/src/ProactivityEngine.ts`), que es una capacidad del SOC, no una identidad de producto. |

---

# 40. Qué sí debe copiarse conceptualmente a Ego

## Nivel Capability

### C1. Event-driven runtime observability
Ego debe comprender estados del trabajo continuo.

### C2. Human interaction control
Ego debe poder detener, aprobar, contestar y confirmar.

### C3. Attention management
Ego debe decidir qué merece atención.

### C4. Run recording
Cada ejecución debe poder reconstruirse.

### C5. Change visualization
Los cambios deben poder inspeccionarse.

### C6. Safe mutation
Las mutaciones sensibles requieren preview/version check/atomicity.

### C7. Graceful degradation
Observabilidad y UX no deben romper el trabajo.

### C8. Context capture
El contexto activo puede convertirse en contexto de proyecto/ejecución.

---

# 41. Arquitectura Ego resultante

La incorporación conceptual de Coucou debería verse así:

```text
                    EGO
          Cognitive Operating System
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   Cognitive       Governance     Attention
    Runtime           │              │
        │         Approval /      Activity /
        │         Interaction     Presence
        │              │              │
        └──────────────┼──────────────┘
                       │
                 Event Bus
                       │
          ┌────────────┼────────────┐
          │            │            │
      Sub-Egos       Tools       Background
          │            │            │
          └────────────┼────────────┘
                       │
                 Run Recorder
                       │
              ChangeSet / Artifacts
                       │
             Project Memory Contract
                       │
                    VantaDB
```

---

# 42. Mapeo Coucou → Ego

| Coucou | Ego |
|---|---|
| HookServer | EventGateway + EventNormalizer |
| Hook event | Canonical EgoEvent |
| AgentTask | Run/RuntimeParticipant |
| PillCatalog | Registry |
| pendingApproval | ApprovalRequest |
| AskUserQuestion | QuestionRequest |
| isPinned | InteractionLease |
| PillBadge | AttentionSignal |
| IslandStateMachine | AttentionStateMachine |
| AppState | Runtime/Interaction/Workspace/Attention states |
| TurnSnapshot | RunSnapshot |
| TurnRecorder | RunRecorder |
| RecapStore | ActivityAnalytics |
| DiffEngine | ChangeSetService |
| diff marker | PayloadRef |
| WindowContextCapture | ContextProvider |
| Bridge | Typed Ego IPC |
| SafeWebURL | URL/Resource Policy |
| DemoEngine | Synthetic Event Source |
| generation | RunEpoch |
| pollers | Background Workers |
| relay | Optional stateless external relay |
| config preview/backup/fingerprint | SafeConfigMutation |

---

# 43. Arquitectura de paquetes propuesta en Ego

```text
packages/
  cognitive-runtime/
    event-gateway/
    event-bus/
    run-engine/
    run-state/
    cancellation/

  governance/
    approval/
    interaction/
    authority/
    permissions/
    risk/
    audit/

  attention/
    attention-state/
    attention-evaluator/
    activity-signals/
    notification-policy/

  execution/
    tool-runtime/
    worker-runtime/
    process-runtime/
    action-summarizer/
    resource-policy/

  changes/
    changeset/
    diff/
    revision/
    artifact/

  context/
    context-contract/
    providers/
    capture/

  integrations/
    registry/
    adapters/
    installers/
    config-mutation/

  analytics/
    run-analytics/
    activity/
    metrics/

  demo/
    synthetic-events/
    fixtures/

  ipc/
    protocol/
    main/
    renderer/

  memory/
    contract/
    vantadb-adapter/
```

---

# 44. Orden de integración

## P0

### 1. Canonical Event Contract

Definir:

- Event envelope
- correlation IDs
- project ID
- run ID
- task ID
- Sub-Ego ID
- invocation ID
- timestamps
- source
- payload
- provenance

### 2. EventGateway

Implementar adapters para:

- internal runtime
- MCP
- external agent hooks
- subprocesses

### 3. Run Recorder

Persistir ejecución estructurada.

### 4. Approval Engine

Con:

- exact identity
- expiry
- cancellation
- decision
- fallback
- audit

### 5. Interaction Engine

Preguntas/confirmaciones además de approvals.

### 6. Attention Engine

Evaluar:

- severity
- urgency
- importance
- user focus
- action required

### 7. ChangeSet

Integrarlo al Construction Mode.

### 8. SafeConfigMutation

Usarlo desde los primeros installers.

---

# 45. P1

- mobile/control surface
- richer activity analytics
- background worker optimization
- context providers
- artifact history
- revision graph
- synthetic runtime
- reusable action summaries
- advanced interruption policies
- richer external agent adapters

---

# 46. P2

- distributed attention
- remote execution control
- multi-device interaction
- richer relay infrastructure
- advanced mobile presence
- cross-device activity continuity

---

# 47. Tests obligatorios derivados de Coucou

## Event system

- same event from two adapters produces same canonical event
- malformed external event never crashes runtime
- unknown event is safely ignored/quarantined
- event correlation remains stable

## Approval

- decision applies only to exact request
- parallel tool cannot resolve another request
- expired approval is rejected
- duplicate decision is ignored
- stale decision is ignored
- cancellation propagates
- missing interaction surface does not block forever

## Config mutation

- malformed file is never overwritten
- foreign entries survive
- preview shows actual diff
- modified resource after preview causes refusal
- backup exists
- atomic write survives simulated interruption
- permissions are preserved

## Run recording

- missing Stop event does not corrupt active run state
- parallel runs remain separate
- actions correlate to correct invocation
- large outputs are bounded
- large diffs degrade gracefully

## Attention

- ordinary work does not interrupt user
- critical approval does
- background work remains visible in Daily State
- resolved alerts disappear correctly
- pin/lease prevents premature dismissal

## Demo

- synthetic events cannot mutate real project state
- starting/stopping demo restores real state
- generation prevents stale async writes

---

# 48. Documentación que conviene crear en el repositorio de Coucou para la extracción

No modificaría su código todavía. Primero conviene crear un expediente de referencia fuera de la arquitectura activa:

```text
reference/coucou/
  README.md
  architecture-map.md
  event-model.md
  state-model.md
  approval-flow.md
  interaction-flow.md
  config-safety.md
  run-model.md
  diff-model.md
  attention-model.md
  cross-platform.md
  extraction-matrix.md
  ego-mapping.md
  legal-notes.md
```

La regla es que esos documentos describan el repositorio observado, no lo refactoricen.

---

# 49. Matriz de extracción

| Pieza | Valor para Ego | Tipo | Prioridad |
|---|---:|---|---:|
| Event normalization | Muy alto | Architecture | P0 |
| Approval correlation | Muy alto | Capability + Architecture | P0 |
| Blocking/non-blocking transport | Muy alto | Architecture | P0 |
| Safe config mutation | Muy alto | Capability | P0 |
| Run snapshot | Muy alto | Architecture | P0 |
| Attention model | Muy alto | Capability | P0 |
| Pure FSM | Alto | Pattern | P0 |
| ChangeSet/Diff | Alto | Capability | P0 |
| Typed IPC boundary | Alto | Architecture | P0 |
| Graceful degradation | Muy alto | Principle | P0 |
| Context capture | Alto | Capability | P1 |
| Activity analytics | Medio/alto | Capability | P1 |
| Synthetic demo runtime | Alto | Engineering | P1 |
| Poller/resource policy | Alto | Architecture | P1 |
| Mobile relay | Medio | Infrastructure pattern | P2 |
| CloudKit | Bajo | Implementation-specific | 🚫 **Descartada (con justificación)** — ver §39.1 |
| Pill UI | Bajo como core | Design-specific | 🚫 **Descartada (con justificación)** — ver §39.1 |
| Mochi | Cero para Ego core | Brand/asset | 🚫 **Descartada (con justificación)** — ver §39.1 y §52 |
| Notch | Cero como arquitectura | Product-specific | 🚫 **Descartada (con justificación)** — ver §39.1 |

---

# 50. Regla legal de extracción

El repositorio declara el código bajo MIT.

La estrategia segura para Ego es:

- reutilizar código sujeto a la licencia del código
- conservar los avisos de copyright/licencia aplicables
- preferir extracción de ideas y patrones sobre copiar bloques completos
- no copiar Mochi, nombre, iconografía, sonidos ni media protegida
- separar claramente código derivado de Coucou y código original de Ego

La licencia no debe convertirse en una excusa para copiar también la identidad visual. La humanidad ya ha demostrado suficiente entusiasmo por confundir “open source” con “todo me pertenece”.

---

# 51. Decisión final

`coucou` merece entrar en el conjunto oficial de referencias de Ego.

Pero no como:

> “Ego incorpora Coucou”

sino como:

> **Coucou aporta al diseño de Ego un patrón probado para observar, gobernar y presentar trabajo de agentes en ejecución continua.**

La extracción principal es:

```text
Coucou
  ├── Event normalization
  ├── Session/run representation
  ├── Human approval
  ├── Human questions
  ├── Attention/presence
  ├── Change visualization
  ├── Context capture
  ├── Safe configuration mutation
  ├── Activity recording
  └── Graceful degradation

             ↓ extracción

Ego
  ├── Event Gateway
  ├── Run Engine
  ├── Governance / HITL
  ├── Attention Engine
  ├── ChangeSet
  ├── Context Providers
  ├── Safe Mutation
  ├── Activity Analytics
  └── Dynamic Workspace
```

La frontera debe quedar clara:

**Ego mantiene la definición, el modelo de capacidades y la arquitectura. Coucou suministra patrones de implementación y experiencia que ya han demostrado ser útiles en un sistema real de agentes.**

La integración correcta no es copiar Coucou. Es **reconstruir sus mecanismos dentro de los contratos de Ego**.

---

# 52. Estado real verificado (2026-10-20) — Ola 2 de revisión de fondo #

> Esta sección es la **fuente canónica del estado** de la extracción de `coucou`. El detalle
> por tarea (con ruta exacta y evidencia de caller) vive en
> [`docs/review/backlog-coucou.md`](../review/backlog-coucou.md).
>
> **Ola 2 (2026-10-20):** revisión de fondo contra el clon real de `repos-referencia/coucou`.
> Se re-verificaron los 23 hallazgos de la Ola 1 y se añadieron 6 hallazgos nuevos
> (`COUC-24..29`). Tres filas bajaron de `✅ Completada` a `🆕 Pendiente` por evidencia falsa
> y una subió de `🆕 Pendiente` a `✅ Completada`. Ver §52.6 (afirmaciones inexactas) y
> §52.7 (hallazgos nuevos).

## 52.1 Criterio de cierre de compuerta ##

Un patrón solo se cierra como `✅ Completada` cuando:

1. existe el fichero adaptado en el repo, **y**
2. hay un **caller en producción** verificado por grep sobre `packages/` + `apps/desktop/`
   (excluyendo `test/`, `dist/`, `node_modules/`).

Si el código existe pero no tiene caller → `🆕 Pendiente` con el cableado exacto y su responsable.
Si el patrón no aplica, está sustituido o viola un guardrail → `🚫 Descartada (con justificación)`.
**Nunca** `✅ Completada` sin fichero: ese era el falso verde queotivó la auditoría.

**Regla añadida en la Ola 2:** un caller **transitivo** no cuenta si la cadena de imports pasa
por un módulo sin caller. Una cadena que termina en un módulo muerto prueba que alguien
escribió el import, no que la capacidad esté integrada en producción.

## 52.2 Recuento ##

| `✅ Completada` | `🚫 Descartada` | `🆕 Pendiente` | `⏳ Futura` | Total |
|:---:|:---:|:---:|:---:|:---:|
| 10 | 6 | 12 | 1 | **29** |

## 52.3 Veredicto por patrón (resumen)

| ID | Patrón | Estado | Evidencia / Fundamento |
|---|---|:---:|---|
| `COUC-01` | Normalización de eventos en el borde | 🆕 Pendiente | `packages/events/src/EventNormalizer.ts:35` — sin caller: sólo `packages/events/src/index.ts:3` y `packages/events/test/`. No hay adaptadores de agentes externos aún (depende de `COUC-22`). |
| `COUC-02` | Ingress no bloqueante | 🆕 Pendiente | `packages/events/src/EventIngress.ts:45` — sin caller: sólo `packages/events/src/index.ts:6` y `packages/events/test/`. |
| `COUC-03` | `ActionIdentity` | ✅ Completada | `packages/execution/src/ApprovalEngine.ts:75` (`computeActionIdentity`) + `packages/execution/src/types.ts:95` → `apps/desktop/src/main.ts:20, 2429`. Duplicado sin caller: `packages/events/src/ApprovalIdentity.ts:53` (ver `COUC-29`). |
| `COUC-04` | Admisión interactiva con ACK | ✅ Completada | `packages/execution/src/WidgetHitlBridge.ts:54, 77-91` → `apps/desktop/src/main.ts:20, 2441-2465` (`presentApproval` + `acknowledgePresentation`). |
| `COUC-05` | Anti-singleton de estado (7 stores) | 🚫 Descartada | Sustituido por los módulos canónicos por dominio; `packages/ui-runtime/src/stores/EgoStateStores.ts` sería una tercera fuente de verdad. Sin caller (sólo `packages/ui-runtime/src/stores/index.ts:2` y test). |
| `COUC-06` | FSM de atención | ✅ Completada | `packages/runtime/src/AttentionStateMachine.ts:50` → `apps/desktop/src/main.ts:15, 500-554` (`getAttentionFsm` + `recomputeFloatingAttention` → tray y ventana flotante). |
| `COUC-07` | `ChangeSetService` | 🆕 Pendiente | `packages/tools/src/native/git/ChangeSetService.ts:56` — **sin caller de producción**: su único import real es `packages/execution/src/SafeConfigMutation.ts:4`, y ese módulo tampoco tiene caller (ver `COUC-10`). La cadena `→ McpManager.ts → main.ts:23` de la Ola 1 era un comentario, no un import. |
| `COUC-08` | `PayloadRef` | 🆕 Pendiente | Canónico en `packages/tools/src/native/git/ChangeSetService.ts:49,184,194` — mismo hueco de caller que `COUC-07`. Duplicado browser-safe sin caller: `packages/ui-runtime/src/PayloadRef.ts:126` (`PayloadRegistry`). |
| `COUC-09` | `RunRecorder` | 🆕 Pendiente | `packages/tasks/src/RunRecorder.ts:67` — sin caller: sólo `packages/tasks/src/index.ts:13` y test. Cablear al cierre de turno (A3/A2). |
| `COUC-10` | `SafeConfigMutation` | 🆕 Pendiente | `packages/execution/src/SafeConfigMutation.ts:25` — **sin caller de producción**: `McpManager.ts:85` y `McpClient.ts:97,217` sólo lo mencionan en comentarios; el `reload()` de `McpClient.ts:220-248` hace rollback en memoria, sin preview, sin fingerprint y sin escritura atómica de fichero. La config MCP de Ego persiste en VantaDB (`gov/mcp_servers`), no en un JSON externo. |
| `COUC-11` | Escritura atómica + lock | ✅ Completada | `packages/tools/src/native/fs/FileLockManager.ts:19` → `packages/tools/src/native/fs/NativeFsTool.ts:7,147` → `packages/tools/src/native/index.ts:27` → `apps/desktop/src/main.ts:2148` (`registerNativeTools`). **La mitad de "preservación de permisos" NO está implementada** → `COUC-24`. |
| `COUC-12` | `IntervalSet` | 🚫 Descartada | Sin caller: sólo `packages/domains/src/index.ts:13` y test. La métrica la cubren los checkpoints y contadores del Daily State. |
| `COUC-13` | `ResourcePolicy` | 🚫 Descartada | La política de URLs viva es `packages/security/src/ToolPermissions.ts` + `packages/security/src/netPolicy.ts:31` (`validateSSRFUrl`). `packages/tools/src/native/security/ResourcePolicy.ts` sigue sin caller. |
| `COUC-14` | `SyntheticRuntime` | 🆕 Pendiente | `packages/runtime/src/SyntheticRuntime.ts:17` — sin caller: sólo `packages/runtime/src/index.ts:6` y test. Cablear en la suite E2E (A7). |
| `COUC-15` | `MockIPCBridge` | 🆕 Pendiente | `packages/ui-runtime/src/MockIPCBridge.ts:89` — sin caller: `installIfMissing()` (`:266`) no se invoca desde ningún sitio; sólo `packages/ui-runtime/src/index.ts:11` y test. Cablear en el dev-server del renderer (A4/A7). |
| `COUC-16` | `ContextProvider` | 🚫 Descartada | Duplicidad **no resuelta**: `packages/tasks/src/ContextProvider.ts:24` (sin caller) frente a `apps/desktop/renderer/floating/upload-canvas.ts:649-654` (`interface ContextProvider` + `NoopContextProvider`). Se unifica en un solo contrato (A2/A4). |
| `COUC-17` | Ventana flotante | ✅ Completada | `apps/desktop/src/windows/FloatingWindow.ts` → `apps/desktop/src/main.ts:59-62` (import) y `main.ts:237-239` (`ensureFloatMgr`). |
| `COUC-18` | Spring physics | ✅ Completada | `apps/desktop/renderer/floating/floating-anim.ts` → `countdown.tsx:12` y `ticker.ts:13`. La tercera cita `views.tsx:8` de la Ola 1 era **un comentario de cabecera**, no un import. |
| `COUC-19` | System tray | ✅ Completada | `apps/desktop/src/main/tray-status.ts:14,75,95` (`TRAY_COLORS`, `pauseAllTasks`, `resumeAllTasks`) → `apps/desktop/src/main.ts:83-90`, `main.ts:613` (`ensureTray`), `main.ts:2763` (invocación). |
| `COUC-20` | `SoundEngine` | ✅ Completada | `apps/desktop/renderer/floating/floating-sound.ts:384` importa `@ego/avatar/runtime/sound.js` (recetas procedurales; sin WAV binarios). |
| `COUC-21` | Motor de avatar procedural | ✅ Completada | **Revisión de la Ola 2:** `@ego/avatar` **sí** tiene callers en producción — `apps/desktop/renderer/floating/floating-avatar.tsx:86`, `floating-sound.ts:384` y `apps/desktop/renderer/components/character/CharacterBadge.tsx:21`. La copia vendorizada se conserva en el repo (cadena MIT + `sync:check`) pero **no se importa**: D5 se mantiene en su parte de "tres copias en el repo", no en la de "la app ejecuta la vendorizada". |
| `COUC-22` | Notificaciones móviles / HITL remoto | ⏳ Futura (P1) | Requiere relay stateless + canal externo, no implementados. **Ruta real del fuente:** `relay/src/index.ts` (Cloudflare Worker), no `windows/src/core/relay.ts` como citaba la Ola 1. |
| `COUC-23` | Geometría propia de Sub-Egos | ✅ Completada | `packages/subegos/src/CharacterProfile.ts:126,129` → `packages/subegos/src/SubEgoManifest.ts:2,117` → `apps/desktop/src/main.ts:21`. |
| `COUC-24` | Preservación de permisos POSIX | 🆕 Pendiente | **Hallazgo nuevo.** `packages/tools/src/native/fs/NativeFsTool.ts:164-171` y `packages/execution/src/SafeConfigMutation.ts:164-173` escriben en temporal y renombran **sin `chmod`**: un fichero `0600` queda `0644`. Coucou sí fija el modo (`HookServer.swift:243` → `0600`; `:1167,1171` → `0700` dir, `0755` wrapper). |
| `COUC-25` | Evaluador de atención (`AttentionSignal`) | 🆕 Pendiente | **Hallazgo nuevo.** `packages/runtime/src/AttentionStateMachine.ts:84` **consume** un `state`/`priority` ya decidido; no existe ningún evaluador que traduzca importancia/urgencia/riesgo/foco a esa decisión, ni el tipo `AttentionSignal` de §15. |
| `COUC-26` | Presupuesto y salud del worker | 🆕 Pendiente | **Hallazgo nuevo.** `packages/tasks/src/BackgroundEngine.ts:39` tiene prioridad y concurrencia, pero **no** schedule, backoff, presupuesto de recursos, health ni última ejecución exitosa (§37). |
| `COUC-27` | Capacidad de presencia de secreto | 🚫 Descartada | **Hallazgo nuevo.** Sustituido por `packages/security/src/CredentialManager.ts:414` (`hasSecret`: sólo presencia, nunca el valor) + `apps/desktop/src/main/credentials/vault.ts` (keychain del SO). Más estricto que Coucou, que mantenía su propio almacén en Rust. |
| `COUC-28` | `ActionSummarizer` en el core | 🆕 Pendiente | **Hallazgo nuevo.** `apps/desktop/renderer/floating/floating.tsx:210` construye la línea de display con `commandFor(toolName, args)` a partir del input crudo — justo lo que §38 prohíbe. `apps/desktop/src/main.ts:2547` ya lo resuelve en main: hoy hay dos rutas de resumen. |
| `COUC-29` | Segunda identidad de acción (`@ego/events`) | 🚫 Descartada | **Hallazgo nuevo.** `packages/events/src/ApprovalIdentity.ts:53` duplica la identidad canónica sin caller (sólo `packages/events/src/index.ts:7`); el canónico en producción es `packages/execution/src/ApprovalEngine.ts:75`. Dos contratos de identidad = deriva garantizada. |

## 52.4 Veredicto de descarte — puertos verbatim de Mochi (decisión D4, owner 2026-10-19)

| Elemento | Veredicto | Fundamento |
|---|:---:|---|
| Puertos verbatim de `avatar_studio_cx_artlab_mochi_2_0.html` en `packages/avatar/src/studio/render/{body,ears,eyes,mouth,accessories}.js` | 🚫 **Descartada (con justificación)** — se sustituyen por geometría propia | Violan `AGENTS.md` §2 ("no copiar código directamente — extraer patterns y adaptar") y la decisión canónica de que ningún dibujo de Mochi entra al producto. **Decisión D4 del owner (2026-10-19):** reescritura con geometría propia que mantenga el comportamiento visual. **Ejecutor: A6** (owner de `packages/avatar/**` y de la copia vendorizada). A5 registra el veredicto y la cadena de atribución; A6 ejecuta la sustitución. |
| Preset `'coucou-mochi'` en `packages/avatar/src/runtime/avatar-element.js:2052` | 🚫 **Descartada (con justificación)** — eliminar | El nombre de marca de Coucou no puede permanecer en el producto. Mismo ejecutor (A6). |
| Cabeceras de atribución que no siguen el formato `Adapted from <upstream> (MIT), <ruta>` | 🚫 **Descartada (con justificación)** — normalizar | La convención canónica está en `docs/research/character-audit-and-coucou-inventory.md` §4 ("Cada archivo TS derivado de código MIT de Coucou lleva cabecera"). Verificado 2026-10-19: 0 coincidencias de `Louis-CFM` en `packages/` + `apps/`. A6 ejecuta; A5 registra. |
| `packages/avatar/LICENSE.md` referenciado 5 veces (`README.md:130,146,193`, `DESIGN.md:243,329`) pero **inexistente** | 🚫 **Descartada (con justificación)** — crear | Sin el fichero de licencias, el aviso MIT de los código derivado no viaja con el producto. **Ejecutor: A6.** |
| Motor de avatar de Coucou como **producto** (personaje, marca, música) | 🚫 **Descartada (con justificación)** | Ver §39.1 y §39.2. Lo que se conserva es la **técnica** (proyección ocular, resortes, timeline), reescrita con geometría propia. |

**Estado real verificado (2026-10-20, Ola 2):** la decisión D4 fue **ejecutada** por A6 en la Ola 1,
de modo que las cuatro primeras filas ya no son trabajo pendiente:

- `packages/avatar/LICENSE.md` **existe** (junto a `LICENSE` y `NOTICE`); las 15 referencias resuelven.
- El preset `'coucou-mochi'` fue **eliminado** de `packages/avatar/src/studio/config.js` y de `applyPreset`.
- Las cabeceras de `packages/avatar/src/studio/render/` están normalizadas a `Adapted from <upstream> (MIT), <ruta>`.
- Queda un residuo de etiquetado: `packages/avatar/src/studio/render/overlays.js:1`, `particles.js:1` y
  `visor.js:1` siguen declarándose *"port verbatim"* del HTML de Mochi (no de Coucou). No es geometría
  de Mochi sino overlay y partículas del studio, pero la etiqueta debe normalizarse. **Responsable: A6.**

## 52.5 Contaminación de dominio (re-verificada 2026-10-19, post A2/A3)

Barrido sobre `packages/` y `apps/` de los vectores de dominio de `career-ops` (ATS, vacantes,
candidatura, CV, salario, portales) y de `khoj` (scrapers web, `gte-small`, Twilio, Stripe, SMTP):
**0 coincidencias**. Los únicos hits de `khoj` en el código son comentarios de atribución
(`packages/knowledge/src/ingest/AdaptiveChunker.ts:11`, `filters/ScoreThresholdFilter.ts:6`,
`extractors/FactExtractor.ts:5`) y el sidecar propio `packages/knowledge/src/ingest/PythonSidecarBridge.ts`
→ `scripts/ingest/bulk_import.py`.

## 52.6 Afirmaciones de la ficha que la Ola 2 desmintió ##

La re-verificación no se limitó a comprobar líneas: contrastó cada evidencia de caller contra el
código real. Las siguientes afirmaciones de la Ola 1 resultaron **inexactas o falsas** y se corrigieron:

1. **`COUC-07` y `COUC-10`**: se declaraba un caller transitivo
   `SafeConfigMutation.ts → McpManager.ts → main.ts:23`. En el código real, `McpManager.ts:85` y
   `McpClient.ts:97,217` **sólo mencionan** `SafeConfigMutation` en comentarios; el `reload()` de
   `McpClient.ts:220-248` hace un rollback **en memoria** del objeto de configuración, sin preview,
   sin fingerprint y sin escritura atómica de fichero. `SafeConfigMutationService` no tiene ningún
   import en `packages/` ni en `apps/desktop/` fuera de su propio `index.ts` y su test. Ambas filas
   bajan a `🆕 Pendiente`.
2. **`COUC-08`**: `payloadRef` heredaba el caller de `COUC-07` y por tanto hereda su hueco; el
   duplicado `packages/ui-runtime/src/PayloadRef.ts` sigue sin caller. Baja a `🆕 Pendiente`.
3. **`COUC-21`**: se afirmaba que "`@ego/avatar` tiene **0 imports** en el workspace" y que "la app
   ejecuta la copia vendorizada". Es falso desde la Ola 1b: `floating-avatar.tsx:86`,
   `floating-sound.ts:384` y `CharacterBadge.tsx:21` importan el **paquete**. La decisión D5 sigue
   vigentes en su parte de "se conservan las tres copias en el repo" (cadena MIT + `sync:check`), pero
   **no** en la de "la app ejecuta la vendorizada". Sube a `✅ Completada`.
4. **`COUC-11`**: se citaba `main.ts:3086`; la llamada real es `main.ts:2148`. Además, la fila se
   titulaba "Escritura Atómica con Preservación de Permisos" y **la preservación de permisos no
   está implementada**: `NativeFsTool.ts:164-171` y `SafeConfigMutation.ts:164-173` hacen tmp + rename
   sin `chmod`. Se abre `COUC-24` para ese hueco.
5. **`COUC-18`**: la evidencia citaba `views.tsx:8` como tercer consumidor de `floating-anim.ts`; esa
   línea es un **comentario de cabecera**. Los consumidores reales son `countdown.tsx:12` y `ticker.ts:13`.
6. **`COUC-22`**: la ruta del fuente era `windows/src/core/relay.ts`, que **no existe**. El relay real
   es `relay/src/index.ts` (Cloudflare Worker).
7. **Líneas de `apps/desktop/src/main.ts`**: casi todas las citas de la Ola 1 estaban desfasadas
   (`main.ts:23/27/30/32/170-173/186-193/281/535-590/648-715/3086` → `main.ts:11/15/20/21/59-62/83-90/
   237-239/500-554/613/2148/2441-2465/2763`). La tabla §52.3 cita ahora las líneas reales.
8. **Duplicidad de `ContextProvider` (`COUC-16`)**: **no** está resuelta — sigue existiendo el contrato
   del renderer en `upload-canvas.ts:649-654` junto al módulo de `@ego/tasks`.
9. **Duplicidad de política de URLs (`COUC-13`)**: **sí** está resuelta — sólo `@ego/security` está cableado.

## 52.7 Hallazgos nuevos de la Ola 2 ##

Seis hallazgos que la ficha no recogía, con su estado de compuerta:

| ID | Hallazgo | Fuente en Coucou | Estado |
|---|---|---|:---:|
| **COUC-24** | Preservación de permisos POSIX al escribir de forma atómica | `NotchBuddy/Sources/App/HookServer.swift:243,1167,1171` | 🆕 Pendiente |
| **COUC-25** | Evaluador de atención (importancia, urgencia, riesgo, foco → decisión de superficie) | `NotchBuddy/Sources/App/IslandStateMachine.swift`, `windows/src/island/hooks.ts:306-314` | 🆕 Pendiente |
| **COUC-26** | Presupuesto, salud y degradación por worker en background | `NotchBuddy/Sources/App/GitHubPulse.swift` y los 7 pollers de `Sources/App/` | 🆕 Pendiente |
| **COUC-27** | Capacidad de "presencia de secreto" (el renderer sólo pregunta si existe) | `windows/src/core/bridge.ts:91-93` | 🚫 Descartada |
| **COUC-28** | `ActionSummarizer` en el core (la UI no resume el input crudo) | `windows/src/island/hooks.ts:298` (`approvalTarget`) | 🆕 Pendiente |
| **COUC-29** | Segunda implementación de la identidad de acción | `NotchBuddy/Sources/App/AppState.swift:240-290` | 🚫 Descartada |

### 52.7.1 COUC-24 — Preservación de permisos POSIX ##

Coucou no se limita a escribir atómicamente: fija el modo del fichero antes de usarlo
(`HookServer.swift:243` → `0600`; `:1167` → directorio `0700`; `:1171,1175` → wrapper `0755`) y
además escribe con `.atomic` sobre ficheros ajenos (`~/.claude/settings.json`, `:1249,1316,1479`).

En Ego, `packages/tools/src/native/fs/NativeFsTool.ts:164-171` y
`packages/execution/src/SafeConfigMutation.ts:164-173` escriben en un temporal con los permisos por
defecto del proceso y lo renombran. Consecuencia: un `.env` o una clave en `0600` queda en `0644`
tras una escritura. **Cableado pendiente:** leer `mode` con `fs.promises.stat()` antes de escribir y
aplicar `fs.promises.chmod(tmpPath, mode)` sobre el temporal antes del `rename`, en ambos módulos.
**Responsable: A3** (tools) con **A2** (execution). **Prueba:** escribir sobre un fichero `0600` y
verificar que el modo se conserva.

### 52.7.2 COUC-25 — Evaluador de atención ##

La ficha §14 y §15 describen un `Attention Evaluator` que traduce atributos de evento
(importancia, urgencia, riesgo, foco actual) a una decisión de superficie, y un tipo
`AttentionSignal`. El código de Ego tiene **la mitad receptora**: `AttentionStateMachine.requestAttention()`
(`packages/runtime/src/AttentionStateMachine.ts:84`) consume un `state` y un `priority` que **alguien
ya decidió**. La decisión real está cableada a mano en `apps/desktop/src/main.ts:520-554`
(`recomputeFloatingAttention`), que distingue sólo "hay HITL" de "hay trabajo activo". El tipo
`AttentionSignal` **no existe** en el workspace.

**Cableado pendiente:** `packages/runtime/src/AttentionEvaluator.ts` que traduzca un `EgoEvent`
(severidad, `riskLevel`, foco de la ventana) a un `AttentionRequest` de la FSM, invocado desde
`recomputeFloatingAttention` antes de `requestAttention`. **Responsable: A2** (runtime) con **A4**
(renderer).

### 52.7.3 COUC-26 — Presupuesto y salud del worker ##

La ficha §37 pide que cada worker en background declare prioridad, schedule, condición de ejecución,
presupuesto de recursos, cancelación, backoff, última ejecución exitosa y salud. El motor canónico
`packages/tasks/src/BackgroundEngine.ts:39` implementa **prioridad** (`:113-115`), concurrencia
(`maxConcurrent`), timeout, política de aprobación y checkpoints; **no** implementa schedule, backoff,
presupuesto, health ni última ejecución exitosa. Coucou sí tiene esa noción por worker (7 pollers con
estado degradado explícito en `NotchBuddy/Sources/App/GitHubPulse.swift` y hermanos).

**Cableado pendiente:** extender `TaskDefinition` con `schedule`, `backoffMs`, `resourceBudget` y
`lastSuccessfulRun`, y exponerlos por IPC. **Responsable: A3** (tasks).

### 52.7.4 COUC-27 — Capacidad de presencia de secreto ##

Coucou expone `secretPresent` / `secretSet` / `secretClear` (`windows/src/core/bridge.ts:91-93`) con la
regla de que el renderer **nunca** ve el valor de una clave, sólo su presencia. Ego ya lo tiene y en
forma más estricta: `packages/security/src/CredentialManager.ts:414` (`hasSecret`) más
`apps/desktop/src/main/credentials/vault.ts` (keychain del SO, con `encrypt`/`decrypt` en main).
**Se descarta por sustitución**, no por no aplicar.

### 52.7.5 COUC-28 — `ActionSummarizer` en el core ##

La ficha §38 establece que "la UI nunca debería construir sus propios resúmenes a partir de raw tool
input". Hoy el flotante lo hace: `apps/desktop/renderer/floating/floating.tsx:210` calcula la línea de
display con `commandFor(toolName, args)` a partir del input crudo, mientras el camino principal ya lo
resuelve en main (`apps/desktop/src/main.ts:2547`, `pickString(args["command"])`). Dos rutas de resumen
= dos verdades.

**Cableado pendiente:** `packages/execution/src/ActionSummarizer.ts` que produzca la línea de display a
partir de `toolName` + `arguments`, y que el campo `command` viaje ya calculado en
`WidgetPresentationRequest` (`packages/execution/src/WidgetHitlBridge.ts:4-17`). **Responsable: A2.**

### 52.7.6 COUC-29 — Segunda identidad de acción ##

`packages/events/src/ApprovalIdentity.ts:53` implementa `buildApprovalIdentity` + `assertSameApproval`
con los mismos campos (`runId`, `taskId`, `subEgoId`, `toolId`, `inputDigest`) que el canónico
`packages/execution/src/ApprovalEngine.ts:75` (`computeActionIdentity`), pero **sin caller** (sólo el
reexport de `packages/events/src/index.ts:7` y su test). Dos contratos de identidad de acción son la
misma deriva que la Ola 2 detectó en `ContextProvider` (`COUC-16`) y en `PayloadRef` (`COUC-08`).
**Se descarta por sustitución** por el canónico de `@ego/execution`.
