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

# 39. Qué NO extraer

## No extraer como arquitectura

- notch
- NSPanel
- AppKit
- SwiftUI
- CloudKit
- Tauri
- Rust backend de Coucou
- singleton AppState
- Pill como entidad de dominio
- layout constants como dominio
- Mochi
- 60 Hz mouse polling como mecanismo general
- integración específica con Claude Code como dependencia central

## No extraer como identidad de producto

Coucou es una experiencia de presencia.

Ego es un Cognitive Operating System.

La interfaz de Coucou puede informar Ego, pero no definirlo.

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
| CloudKit | Bajo | Implementation-specific | No |
| Pill UI | Bajo como core | Design-specific | No |
| Mochi | Cero para Ego core | Brand/asset | No |
| Notch | Cero como arquitectura | Product-specific | No |

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
