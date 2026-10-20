# Extracción Técnica: Codex CLI (repos-referencia/codex) #

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de patrones |
| Repositorio Origen | `repos-referencia/codex/` (Commit verificado: `0144894`, rama `main`, profundidad 1) |
| Stack del Origen | Rust (workspace Cargo, ~130 crates bajo `codex-rs/`) · TUI `ratatui`+`crossterm` · sandbox nativo del SO (Seatbelt macOS / bubblewrap+Landlock+seccomp Linux / MXC-RestrictedToken Windows) · MCP vía `rmcp` · Apache-2.0 |
| Rol en Ego | Referencia de la capa de **Gobernanza de Ejecución**: política de permisos, decisión de aprobación, edición estructurada de ficheros y vocabulario de eventos |
| Owner | ness-e |
| Fecha | 2026-10-20 |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia ##

`openai/codex` resuelve de forma análoga a Ego el problema central de la **Fase 02 (Acción)** y la **Fase 11
(Seguridad)**: cómo un agente de código ejecuta comandos y escribe ficheros en la máquina del usuario sin convertir
cada operación en una pregunta manual, y cómo esa cesión de autoridad queda **auditable, explicable y revocable**.

Lo que Codex aporta a Ego no es su producto (un CLI de codegen de OpenAI) sino **cuatro modelos de datos** que Ego
hoy tiene dispersos o ausentes:

1. Un **perfil de permisos** (`PermissionProfile`) que separa permisos de *filesystem* y de *red* y que permite
   **degradar a un nivel más restrictivo en vez de escalar** cuando la escalada destruiría una restricción ya
   activa (`codex-rs/sandboxing/src/policy_transforms.rs:19-53`,
   `codex-rs/core/src/tools/sandboxing.rs:290-310`).
2. Una **decisión de política de tres estados** (`allow` / `prompt` / `forbidden`) con **reglas de prefijo** y
   coincidencia por alternativas (`codex-rs/execpolicy/src/decision.rs:9-16`,
   `codex-rs/execpolicy/src/rule.rs:16-60`), frente al veredicto ternario-pero-distinto de Ego
   (`allow | deny | requireApproval`).
3. Un **formato de parche estructurado con anclaje contextual** (`codex-rs/apply-patch/src/parser.rs:1-45`,
   `codex-rs/apply-patch/src/file_update.rs:60-100`) que permite editar un fichero sin reescribirlo entero.
4. Un **vocabulario de eventos de protocolo** que hace explícita la degradación de modelo
   (`codex-rs/protocol/src/protocol.rs:1498-1499`, `:2237-2241`).

Lo que Codex **no** aporta: su TUI de terminal (`ratatui`), sus backends de sandbox nativos del sistema operativo
y su plano de control cloud propietario. Los tres chocan con los guardrails de `AGENTS.md` §4.

### Tabla de divergencias ###

| Dimensión | Codex | Ego (Cognitive OS) | Decisión |
| --- | --- | --- | --- |
| **Lenguaje y runtime** | Rust: workspace Cargo de 131 crates, TUI `ratatui`/`crossterm` | TypeScript strict + Node 22 (main) + React 19 (renderer) | **Traducir, no portar**: solo modelos de datos y algoritmos puros; ningún crate. |
| **Gobernanza de ejecución** | `PermissionProfile` + `SandboxManager::transform` con backends por SO | `ToolPermissions` (`allow/deny/requireApproval`) + `ApprovalEngine` + `NetPolicy` (`SEC-05`, `ACT-06`) | **EXTRAER & ADAPTAR**: perfil unificado y no-escalación con lecturas denegadas, en TS puro. |
| **Aprobación** | `ExecApprovalRequirement` (`Skip`/`NeedsApproval`/`Forbidden`) + `ApprovalStore` con alcance de sesión | `ApprovalDecision { approved: boolean }` sin caché ni alcance (`packages/execution/src/types.ts:117-123`) | **EXTRAER & ADAPTAR**: caché por clave + alcance de sesión. |
| **Persistencia de sesión** | Rollouts JSONL en `~/.codex/sessions` (`codex-rs/rollout/src/recorder.rs:77-104`) | VantaDB in-process (`NativeVantaDB`, Fjall LSM) | **DESCARTAR** el formato JSONL; conservar solo la idea de *replay* determinista. |
| **Superficie de UI** | TUI de terminal + `app-server` JSON-RPC | Electron + React 19 (`apps/desktop/renderer/`) | **DESCARTAR**: la TUI es un crate de terminal, no una primitive de librería web. |
| **Identidad y telemetría** | Login ChatGPT OAuth + `codex-rs/analytics` + `otel-trace-websocket` | BYOK + `CredentialManager` (`SEC-03`) + telemetría local (`DEC-08`) | **DESCARTAR**: dependencia de proveedor y salida de datos del perímetro local. |
| **Backend de ejecución** | Seatbelt / bubblewrap+Landlock+seccomp / MXC | Enforcement en TS: permisos + aprobación + anti-SSRF | **DESCARTAR**: implicaría un crate nativo nuevo y un `.node` adicional en el bundle (`DIST-02`). |

## 2. Inventario Quirúrgico de Patrones a Extraer ##

### Bloque A: Política de permisos y decisión de aprobación ###

#### 1. Perfil de permisos unificado y no-escalación preservando lecturas denegadas ####

- *Ruta:* `codex-rs/sandboxing/src/policy_transforms.rs:19-53` (`normalize_additional_permissions`),
  `codex-rs/core/src/tools/sandboxing.rs:290-310` (`unsandboxed_execution_allowed`,
  `sandbox_permissions_preserving_denied_reads`).
- *Qué hace:* Normaliza permisos adicionales (deduplica entradas, rechaza globs que no sean de solo-denegación) y
  detecta el caso en que **escalar fuera del sandbox destruiría una restricción activa**: si la política tiene
  lecturas denegadas, el motor **degrada a ejecución sandboxeada** en lugar de escalar.
- *Adaptación en Ego:* `PermissionProfile` en TS puro (`packages/security/src/PermissionProfile.ts`) con
  `fileSystem: { kind, writableRoots[], deniedReadPaths[] }` y `network: { enabled }`. Lo consume
  `packages/security/src/ToolPermissions.ts:25`; `packages/execution/src/ApprovalEngine.ts:75-96` degrada a
  `requireApproval` en vez de conceder acceso amplio.
- *Relación con Backlog Ego:* `SEC-05`, `SEC-08`, `ACT-06`.

#### 2. Decisión de política de tres estados y reglas de prefijo ####

- *Ruta:* `codex-rs/execpolicy/src/decision.rs:9-16` (`Decision`),
  `codex-rs/execpolicy/src/rule.rs:16-60` (`PatternToken`, `PrefixPattern`),
  `codex-rs/execpolicy/src/rule.rs:62-77` (`RuleMatch` con `justification`).
- *Qué hace:* Una regla devuelve `allow`, `prompt` o `forbidden`. El patrón de prefija admite token fijo o
  **alternativas** (`Alts`), de modo que una regla cubre `git status` y `git commit` sin enumerar prefijos
  completos; cada coincidencia puede llevar una justificación legible.
- *Adaptación en Ego:* `PolicyDecision = "allow" | "prompt" | "forbidden"` y
  `PrefixRule { first; rest: (string | string[])[]; decision; justification? }` en
  `packages/security/src/PolicyRules.ts`. Sustituye a `extraBlockedCommands: readonly RegExp[]`
  (`packages/security/src/ToolPermissions.ts:72`), que no puede expresar "preguntar".
- *Relación con Backlog Ego:* `SEC-05`, `ACT-06`.

#### 3. Rechazo coherente cuando la política prohíbe preguntar ####

- *Ruta:* `codex-rs/core/src/exec_policy.rs:48-56` (motivos `PROMPT_CONFLICT_REASON`,
  `REJECT_SANDBOX_APPROVAL_REASON`, `REJECT_RULES_APPROVAL_REASON`),
  `codex-rs/core/src/exec_policy.rs:212-240` (`prompt_is_rejected_by_policy`),
  `codex-rs/core/src/tools/sandboxing.rs:196-232` (`default_exec_approval_requirement`).
- *Qué hace:* Si la política dice `Never` pero una regla exige `prompt`, el motor **no** ejecuta en silencio:
  devuelve `Forbidden` con motivo. Separa el motivo "regla" del motivo "escalada de sandbox" para que un modo
  granular pueda habilitar uno y denegar el otro.
- *Adaptación en Ego:* `ApprovalPolicyRule` (`packages/execution/src/types.ts:149-155`) pasa de
  `requireApproval: boolean` a veredicto de tres estados; `ApprovalEngine` traduce "política que prohíbe preguntar"
  a `Forbidden` con `reason` en la auditoría `gov/audit` (`SEC-06`).
- *Relación con Backlog Ego:* `ACT-06`, `SEC-05`.

#### 4. Caché de aprobación por clave con alcance de sesión ####

- *Ruta:* `codex-rs/core/src/tools/sandboxing.rs:41-64` (`ApprovalStore`),
  `codex-rs/core/src/tools/sandboxing.rs:72-118` (`with_cached_approval`).
- *Qué hace:* Las decisiones `ApprovedForSession` se cachean por clave serializada. `apply_patch` modifica varios
  ficheros a la vez, así que la función acepta **un vector de claves**: si todas están aprobadas omite el prompt;
  si el usuario aprueba, cachea cada clave por separado para que una tarea posterior que toque un subconjunto no
  vuelva a preguntar.
- *Adaptación en Ego:* `ApprovalDecisionCache` en `packages/execution/src/ApprovalEngine.ts`, indexado por el
  `inputDigest` SHA-256 que ya calcula `computeActionIdentity`
  (`packages/execution/src/ApprovalEngine.ts:75-96`), con `scope: "once" | "session"`. La tarjeta de aprobación
  (`ACT-07`) ofrece explícitamente "Aprobar para esta sesión".
- *Relación con Backlog Ego:* `ACT-06`, `ACT-07`, `INT-05`.

#### 5. Revisor automático con invariante fail-closed ####

- *Ruta:* `codex-rs/core/src/guardian/mod.rs:1-4` (el revisor elige la evidencia, el núcleo impone los
  requisitos), `codex-rs/core/src/guardian/decision.rs:44-52` (`decide_approval`; invariante documentada:
  *"No contributor is never an implicit allow"*).
- *Qué hace:* Una extensión revisa la solicitud y devuelve un veredicto; si no hay veredicto, la decisión
  **vuelve al flujo humano**. La ausencia de revisor nunca se interpreta como permiso, y hay requisitos de revisión
  obligatorios por modelo que el anfitrión no puede desactivar.
- *Adaptación en Ego:* el modo `"smart"` de `ToolApprovalsOptions`
  (`packages/security/src/ToolPermissions.ts:60-66`) hoy solo se porta ("se portan para composición") y no tiene
  revisor. Traducción: `AutoReviewer` en `packages/execution/src/AutoReviewer.ts` con contrato
  `decide(ctx): "allow" | "prompt" | "forbid" | undefined`, donde `undefined` significa **preguntar al usuario**,
  nunca "aprobar".
- *Relación con Backlog Ego:* `ACT-06`, `ACT-07`.

### Bloque B: Edición de ficheros y vocabulario de eventos ###

#### 6. Parche estructurado con anclaje contextual ####

- *Ruta:* `codex-rs/apply-patch/src/parser.rs:4-25` (gramática),
  `codex-rs/apply-patch/src/parser.rs:37-45` (marcadores `*** Begin Patch` / `*** Update File:` / `@@`),
  `codex-rs/apply-patch/src/parser.rs:66-109` (enum `Hunk`),
  `codex-rs/apply-patch/src/file_update.rs:25-55` (`derive_new_contents_from_chunks`),
  `codex-rs/apply-patch/src/file_update.rs:60-100` (`compute_replacements` con `seek_sequence::seek_sequence`).
- *Qué hace:* El parche del modelo se parsea a hunks (add/delete/update, con `Move to:`). El update **no** se
  aplica por número de línea: se localiza la línea de contexto (`@@`) con búsqueda secuencial tolerante
  (`codex-rs/apply-patch/src/seek_sequence.rs`) y se calculan reemplazos sobre el contenido real. Si el contexto no
  aparece, falla con "Failed to find context" en vez de corromper el fichero.
- *Adaptación en Ego:* nueva herramienta `fs_apply_patch` en `packages/tools/src/native/fs/`, junto a
  `fs_write_file` (`packages/tools/src/native/fs/NativeFsTool.ts:128-129`), que hoy reescribe el fichero completo.
  Reutiliza la atomicidad y el backup ya implementados
  (`packages/tools/src/native/fs/NativeFsTool.ts:148-156`) y añade el diff contextual que evita el bucle de
  desincronización modelo↔fichero.
- *Relación con Backlog Ego:* `ACT-04`, `ACT-07`, `SEC-05`.

#### 7. Evento de reroute de modelo visible ####

- *Ruta:* `codex-rs/protocol/src/protocol.rs:1498-1499` (variante `EventMsg::ModelReroute`),
  `codex-rs/protocol/src/protocol.rs:2237-2241` (`ModelRerouteEvent { from_model, to_model, reason }`).
- *Qué hace:* Cuando el enrutador cambia de modelo emite un evento de primera clase con origen, destino y motivo.
  No es un log: es parte del protocolo que el front-end consume.
- *Adaptación en Ego:* `EgoEventType` (`packages/events/src/types.ts:5-49`) no tiene tipo de reroute, y la cadena de
  fallback de `ModelRouter` (`packages/models/src/ModelRouter.ts:729-789`) solo deja un `console.warn` (`:781`).
  Añadir `"model.rerouted"` al bus y emitirlo desde `runFallbackChain` hace la degradación visible en
  `MetricsConsole` (`DS-05`) y en Explicabilidad (`CANV-07`).
- *Relación con Backlog Ego:* `CORE-03`, `CANV-07`, `DS-05`.

#### 8. Degradación con estado de sesión y presupuesto de reintentos acotado ####

- *Ruta:* `codex-rs/core/src/client.rs:719-738` (`force_http_fallback`),
  `codex-rs/core/src/client.rs:2423-2439` (`try_switch_fallback_transport`),
  `codex-rs/core/src/responses_retry.rs:23-24` (delay inicial 5 s, tope 60 s),
  `codex-rs/core/src/responses_retry.rs:32-118` (`ResponsesStreamRetryState`).
- *Qué hace:* Al agotar el presupuesto de reintentos del proveedor, la degradación de transporte (WebSocket →
  HTTP) es **permanente para la sesión**, no por petición, y se contabiliza con métrica propia
  (`codex.transport.fallback_to_http`). El backoff de reconexión es exponencial con tope duro.
- *Adaptación en Ego:* `ModelRouter` mantiene un único `fallbackModelId`
  (`packages/models/src/ModelRouter.ts:395-400`) y evalúa la cadena **por petición** (`:729-789`). Traducción:
  estado de degradación a nivel de sesión en `packages/models/src/ModelRouter.ts` (`degradedTransport`), con
  reintentos acotados y backoff exponencial con tope, expuesto como `model.rerouted` con
  `reason: "transport_degraded"`.
- *Relación con Backlog Ego:* `CORE-03`, `INT-02`, `DEC-06`.

### Bloque C: Superficies no transferibles ###

#### 9. Backends de sandbox del SO, TUI de terminal y plano de control cloud del proveedor ####

- *Ruta:* `codex-rs/sandboxing/src/manager.rs:50-64` (`get_platform_sandbox`: Seatbelt / LinuxSeccomp /
  WindowsRestrictedToken), `codex-rs/sandboxing/src/seatbelt.rs:36`,
  `codex-rs/linux-sandbox/src/seccomp.rs:45-90` (`PR_SET_NO_NEW_PRIVS` + filtro seccomp),
  `codex-rs/mxc-sandbox/src/lib.rs:98` (el backend AppContainer queda excluido),
  `codex-rs/tui/Cargo.toml:82,93` (263 entradas en `codex-rs/tui/src/`), `codex-rs/cloud-tasks/`,
  `codex-rs/cloud-client/`, `codex-rs/cloud-config/`, `codex-rs/chatgpt/`, `codex-rs/analytics/`,
  `codex-rs/otel-trace-websocket/`.
- *Qué son:* tres superficies sin equivalente transferible: (a) aislamiento real a nivel de sistema operativo;
  (b) una interfaz de terminal; (c) un plano de control SaaS y telemetría atados a un proveedor propietario.
- *Veredicto:* **🚫 Descartada (con justificación)** — fundamento en §5. De (a) se conserva **solo el modelo de
  datos**, que ya se ha promovido a `CDX-01` y `CDX-02`; de (b) y (c) no se extrae nada.

## 3. Matriz de Extracción vs Descarte ##

| Componente Codex | Acción | Razón Técnica / Arquitectónica |
| --- | :---: | --- |
| `sandboxing/src/policy_transforms.rs` | EXTRAER PATRÓN | Perfil de permisos unificado como dato puro; traducible a TS sin crate nativo. |
| `execpolicy/src/{decision,rule}.rs` | EXTRAER PATRÓN | Veredicto de tres estados y reglas de prefijo con alternativas: modelo de datos, no runtime. |
| `core/src/tools/sandboxing.rs` (aprobación) | EXTRAER PATRÓN | `ApprovalStore` y `with_cached_approval` son lógica pura sobre un mapa serializado. |
| `core/src/guardian/` | EXTRAER PATRÓN | Contrato del revisor automático y su invariante fail-closed, sin dependencia del runtime. |
| `apply-patch/src/{parser,file_update,seek_sequence}.rs` | EXTRAER PATRÓN | Gramática de parche y anclaje contextual: algoritmo puro, traducible tal cual. |
| `protocol/src/protocol.rs` (`ModelRerouteEvent`) | EXTRAER PATRÓN | Vocabulario de evento: se incorpora a `EgoEventType`. |
| `core/src/{client,responses_retry}.rs` | EXTRAER PATRÓN | Estado de degradación por sesión y presupuesto de reintentos con backoff acotado. |
| `sandboxing/src/{seatbelt,landlock,bwrap,windows}.rs`, `linux-sandbox/`, `mxc-sandbox/`, `windows-sandbox-rs/` | 🚫 Descartada | Crates Rust nativos, políticas `.sbpl` y binarios cross-platform. Contradice TypeScript strict + Node 22 (`AGENTS.md` §1) y exigiría un `.node` nuevo en el bundle (`DIST-02`). El enforcement canónico de Ego es `ToolPermissions` + `ApprovalEngine` + `NetPolicy` (`SEC-05`). |
| `tui/` (263 entradas en `codex-rs/tui/src/`, `ratatui`, `crossterm`) | 🚫 Descartada | TUI de terminal: no es primitive de librería web y la UI de Ego es Electron + React 19 (`CORE-05`). Sustituido por Chat + Canvas. |
| `cloud-tasks/`, `cloud-client/`, `cloud-config/` | 🚫 Descartada | Plano de control SaaS del proveedor: contradice el principio 9 (local-first y propiedad/exportación de datos). |
| `chatgpt/`, `login/`, `analytics/`, `otel-trace-websocket/` | 🚫 Descartada | Autenticación y telemetría atadas a un proveedor propietario; Ego usa BYOK + `CredentialManager` (`SEC-03`) y telemetría local (`DEC-08`). |
| `rollout/` (JSONL en `~/.codex/sessions`) | 🚫 Descartada | Formato de persistencia superseded por VantaDB (`CORE-07`); en este ciclo no se promueve ningún hallazgo de replay. |
| `codex-mcp/` (lado servidor), `codex_apps/`, conectores | 🚫 Descartada | Ecosistema de conectores y marketplace de apps, fuera del alcance del SOC. Ego solo necesita el **cliente** MCP (`ACT-09`). |

## 4. Estado real verificado (2026-10-20) ##

Criterio de cierre `✅ Completada`: fichero adaptado en `packages/` o `apps/desktop/` **y** caller en producción
verificado por grep (excluye `test/`, `dist/`, `node_modules/`).

Verificación de partida sobre `packages/` + `apps/desktop/`:

```text
Select-String "apply_patch|applyPatch|PermissionProfile|SandboxViolation"  packages/ apps/desktop/  -> 0
Select-String "ModelReroute|reroute|prefixRule|ExecPolicy|approvedForSession"  packages/ apps/desktop/  -> 0
Select-String "smart|autoApprove|automatic"  packages/execution/src/  -> 0
```

Codex es un repositorio de referencia **nuevo**: no hay ni un patrón suyo asimilado. Por tanto **no existe ningún
`✅ Completada`**, y la columna de evidencia cita la ruta canónica de Ego donde el patrón debe aterrizar.

| ID | Patrón | Estado | Evidencia / Fundamento |
| --- | --- | :---: | --- |
| `CDX-01` | Perfil de permisos unificado + no-escalación con lecturas denegadas | 🆕 Pendiente | Sin asimilado. Cableado: `packages/security/src/PermissionProfile.ts` (nuevo) consumido por `packages/security/src/ToolPermissions.ts:25` y por `packages/execution/src/ApprovalEngine.ts:75-96` (degradar a `requireApproval` en vez de ampliar). Owner A2. |
| `CDX-02` | Taxonomía normalizada de violaciones de sandbox (fs/red) | 🆕 Pendiente | `CausalErrorCategory` (`packages/runtime/src/types.ts:215-224`) solo distingue `PERMISSION_DENIED`: faltan `read_only_file_system`, `policy_denied`, `sigsys` y la separación fs↔red. Cableado: extender `packages/runtime/src/types.ts` y `packages/runtime/src/ErrorHandler.ts:30-45`. Owner A2. |
| `CDX-03` | Caché de aprobación por clave con alcance de sesión | 🆕 Pendiente | `ApprovalDecision` (`packages/execution/src/types.ts:117-123`) solo tiene `approved: boolean`, sin `scope` ni almacén. Cableado: `ApprovalDecisionCache` en `packages/execution/src/ApprovalEngine.ts`, indexado por el `inputDigest` de `computeActionIdentity` (`packages/execution/src/ApprovalEngine.ts:75-96`), resuelto desde `ipc.approval.resolve`. Owner A2. |
| `CDX-04` | Decisión de tres estados + reglas de prefijo con alternativas | 🆕 Pendiente | `ToolDecision` (`packages/security/src/ToolPermissions.ts:25`) es `allow \| deny \| requireApproval` y `extraBlockedCommands` (`:72`) es `readonly RegExp[]`: no expresa "preguntar" ni coincidencia por prefijo. Cableado: `packages/security/src/PolicyRules.ts` + `ToolPermissions.ts`. Owner A2/A4. |
| `CDX-05` | Revisor automático con invariante fail-closed | 🆕 Pendiente | El modo `"smart"` de `ToolApprovalsOptions` (`packages/security/src/ToolPermissions.ts:60-66`) solo se porta; no existe revisor. Cableado: `packages/execution/src/AutoReviewer.ts` con `decide(): "allow" \| "prompt" \| "forbid" \| undefined` (`undefined` = preguntar, nunca aprobar). Owner A2. |
| `CDX-06` | Parche estructurado con anclaje contextual | 🆕 Pendiente | `fs_write_file` (`packages/tools/src/native/fs/NativeFsTool.ts:128-129`) reescribe el fichero completo; no existe herramienta de parche. Cableado: `fs_apply_patch` en `packages/tools/src/native/fs/`, reutilizando atomicidad y backup (`packages/tools/src/native/fs/NativeFsTool.ts:148-156`). Owner A4. |
| `CDX-07` | Evento de reroute de modelo visible | 🆕 Pendiente | `EgoEventType` (`packages/events/src/types.ts:5-49`) no incluye reroute; `runFallbackChain` (`packages/models/src/ModelRouter.ts:729-789`) solo deja `console.warn` (`:781`). Cableado: nuevo tipo `"model.rerouted"` en `packages/events/src/types.ts` + emisión desde `ModelRouter`. Owner A2. |
| `CDX-08` | Degradación con estado de sesión y reintentos acotados | 🆕 Pendiente | `ModelRouter` mantiene un único `fallbackModelId` (`packages/models/src/ModelRouter.ts:395-400`) y evalúa la cadena por petición (`:729-789`): no hay estado degradado ni presupuesto de reintentos. Cableado: `degradedTransport` en `packages/models/src/ModelRouter.ts` + backoff con tope. Owner A2. |
| `CDX-09` | Backends nativos de sandbox, TUI y plano cloud del proveedor | 🚫 Descartada (con justificación) | Fundamento en §5 (filas 1, 2, 3 y 5). Sin traducción posible a TS puro sin introducir crates nativos, un `.node` nuevo o dependencia de proveedor. |

## 5. Descarte normalizado a la forma canónica ##

Las filas de la matriz §3 marcadas `🚫 Descartada` se normalizan a `🚫 Descartada (con justificación)`
(`AGENTS.md` §4) conservando el motivo original:

| Componente Codex | Veredicto | Fundamento |
| --- | :---: | --- |
| `sandboxing/src/{seatbelt,landlock,bwrap,windows}.rs`, `linux-sandbox/`, `mxc-sandbox/`, `windows-sandbox-rs/` | 🚫 **Descartada (con justificación)** | Crates Rust nativos, políticas `.sbpl` y binarios cross-platform. Contradice TypeScript strict + Node 22 (`AGENTS.md` §1) y exigiría un `.node` nuevo en el bundle (`DIST-02`). El enforcement canónico de Ego es `ToolPermissions` + `ApprovalEngine` + `NetPolicy` (`SEC-05`). |
| `tui/` (263 entradas en `codex-rs/tui/src/`, `ratatui`, `crossterm`) | 🚫 **Descartada (con justificación)** | TUI de terminal: no es primitive de librería web y la UI de Ego es Electron + React 19 (`CORE-05`). Sustituido por Chat + Canvas. |
| `cloud-tasks/`, `cloud-client/`, `cloud-config/` | 🚫 **Descartada (con justificación)** | Plano de control SaaS del proveedor: contradice el principio 9 (local-first y propiedad/exportación de datos). |
| `chatgpt/`, `login/`, `analytics/`, `otel-trace-websocket/` | 🚫 **Descartada (con justificación)** | Autenticación y telemetría atadas a un proveedor propietario; Ego usa BYOK + `CredentialManager` (`SEC-03`) y telemetría local (`DEC-08`). |
| `rollout/` (JSONL en `~/.codex/sessions`) | 🚫 **Descartada (con justificación)** | Formato de persistencia superseded por VantaDB (`CORE-07`); en este ciclo no se promueve ningún hallazgo de replay. |
| `codex-mcp/` (lado servidor), `codex_apps/`, conectores | 🚫 **Descartada (con justificación)** | Ecosistema de conectores y marketplace de apps, fuera del alcance del SOC. Ego solo necesita el **cliente** MCP (`ACT-09`). |

**Recuento:** 0 `✅ Completada` · 1 `🚫 Descartada` · 8 `🆕 Pendiente` · 0 `⏳ Futura` — **9 tareas**.

> Estado por tarea y detalle de cableado: [backlog-codex.md](../review/backlog-codex.md). Catálogo de extracciones:
> [README.md](./README.md).
