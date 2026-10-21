# Extracción Técnica: Goose (repos-referencia/goose) #

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de patrones |
| Repositorio Origen | `repos-referencia/goose/` (upstream `aaif-goose/goose`, commit `9920efa`, origen `crates/goose/src/tool_inspection.rs`) |
| Licencia del origen | Apache-2.0 — aaif-goose/goose |
| Commit verificado | 9920efa |
| Ruta de origen | `crates/goose/src/tool_inspection.rs` |
| Stack del Origen | Rust (workspace Cargo, crates `goose`, `goose-agent`, `goose-mcp`, `goose-providers`, `goose-cli`, `goose-roaming`) + Electron/React (`ui/desktop/`) + TUI ACP (`ui/text/`) |
| Rol en Ego | Referencia de **gobernanza de la ejecución**: cadena de inspectores de tool-call, almacén de permisos con caducidad, inspección de egreso, hooks de ciclo de vida, lease de catálogo y catálogo declarativo de providers |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Licencia | Apache-2.0 (`repos-referencia/goose/LICENSE:1`) |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia ##

Goose (antes `block/goose`, hoy `aaif-goose/goose`) es un agente extensible de Block escrito en Rust. No es un
gemelo de stack de Ego: no aporta UI de chat ni shell de escritorio aprovechable. Su valor para el Sistema
Operativo Cognitivo está **concentrado en la capa de gobernanza de la ejecución**: cómo se decide si una tool
call se permite, cómo se memoriza esa decisión, cómo se detecta que una operación es una exfiltración y cómo se
mantiene estable el catálogo de herramientas mientras un run está en curso.

Goose también aporta dos piezas de **declaratividad** con impacto directo en el Model Router: un catálogo de
providers en JSON (`crates/goose-providers/src/declarative/definitions/`, 50 ficheros) y un formato de receta
versionada (`crates/goose/src/recipe/mod.rs:43`).

### Divergencias Fundamentales (Qué Descartamos y Por Qué) ###

| Dimensión | Goose | Ego (Cognitive OS) | Decisión Crítica |
| --- | --- | --- | --- |
| **Runtime de agente** | Workspace Rust con `StateMachine`/`Operation`/`Effect` (`crates/goose-agent/src/machine.rs:55`, `operation.rs:89`). | Cognitive Runtime en TypeScript estricto sobre Node.js 22 (`packages/runtime/src/ToolExecutionLoop.ts:53`). | **EXTRAER PATRÓN.** La descomposición Operation→Effect es transferible; la implementación Rust no. |
| **Persistencia** | JSON de sesiones y `tool_permissions.json` en disco (`crates/goose/src/permission/permission_store.rs:47`). | `NativeVantaDB` (napi-rs) in-process con Fjall LSM (`packages/memory/EgoMemoryAdapter.ts`). | **ADAPTAR.** Solo la semántica del registro de permisos; el sustrato es VantaDB. |
| **Permisos** | Veredicto por *nombre de tool* + modos `Chat`/`Auto`/`Approve`/`SmartApprove` (`crates/goose/src/permission/permission_inspector.rs:159-196`). | Veredicto por llamada con `ActionIdentity` inmutable y digest SHA-256 de argumentos (`packages/execution/src/ApprovalEngine.ts:75`). | **EXTRAER & ADAPTAR.** Se conserva la granularidad de Ego y se añade la memoria de decisiones con TTL. |
| **Providers** | 50 definiciones JSON declarativas con `engine`, `base_url`, `context_limit` por modelo (`crates/goose-providers/src/declarative/definitions/groq.json:1-68`). | Adaptadores hardcodeados + catálogo *live* de 5 proveedores (`packages/models/src/ModelCatalog.ts:10,21`). | **EXTRAER & ADAPTAR.** Portar el esquema, no los ficheros. |
| **Superficie de usuario** | TUI ACP en `ui/text/`, Electron en `ui/desktop/`, CLI con `--text`. | Chat `@assistant-ui/react` + Canvas declarativo (`apps/desktop/renderer/components/`). | **DESCARTAR** la TUI/ACP y la UI de Goose; no aportan a la capa de presentación canónica de Ego. |
| **Servicios cloud** | `crates/goose-roaming/src/` (`relay.rs`, `peerbook.rs`, `trust.rs`), `oidc-proxy/`. | Local-first y soberano (principio 9); sin relay saliente. | **DESCARTAR.** Veredicto de guardrail en §5. |

---

## 2. Inventario Quirúrgico de Patrones a Extraer ##

### Bloque A: Gobernanza de la tool-call (inspectores, permisos, egreso) ###

1. **Cadena componible de inspectores** — `crates/goose/src/tool_inspection.rs:34` (trait `ToolInspector`),
   `:57` (`ToolInspectionManager`), `:170` (`apply_inspection_results_to_permissions`).
   - **Qué hace:** Cada inspector (`permission`, `security`, `egress`, `repetition`) devuelve
     `InspectionResult { tool_request_id, action, reason, confidence, inspector_name, finding_id }` con tres
     acciones (`Allow`/`Deny`/`RequireApproval`). La mezcla es **monótona**: `Allow` nunca pisa un `Deny` o un
     `RequireApproval` previo (`:253-256`); un `Deny` expulsa la llamada de `approved` y de `needs_approval`
     (`:214-232`). El fallo de un inspector no aborta la cadena (`:107-115`).
   - **Adaptación en Ego:** Sustituir el veredicto único de `evaluateToolCall`
     (`packages/security/src/ToolPermissions.ts:260`) por una cadena de inspectores donde cada inspector puede
     **elevar** el veredicto pero nunca rebajarlo, y todo veredicto queda trazado con `reason` + `findingId` para
     la auditoría `gov/audit`.
   - **Relación con Backlog Ego:** `ACT-06`, `SEC-01`..`SEC-05`, `SEC-06`.

2. **Almacén persistente de permisos por tool-call** — `crates/goose/src/permission/permission_store.rs:23`
   (`ToolPermissionStore`), `:79` (`check_permission`), `:92` (`record_permission`), `:117`
   (`hash_tool_context`), `:63` (escritura atómica `tmp` + `rename`), `:129` (`cleanup_expired`).
   - **Qué hace:** Indexa las decisiones por `"{tool_name}:{hash_b3(args)}"`. El hash de argumentos diferencia
     invocaciones *distintas* de la misma tool, de modo que aprobar `ls -la` no habilita `rm -rf`. Cada registro
     admite **caducidad opcional** y conserva una versión legible del contexto (`readable_context`) para
     auditoría. La persistencia es atómica y la limpieza de caducados ocurre en la carga.
   - **Adaptación en Ego:** Ego ya calcula un digest canónico de argumentos
     (`packages/execution/src/ApprovalEngine.ts:75`, `computeActionIdentity` → `inputDigest` SHA-256) pero **no
     persiste la decisión**: `PendingApproval` vive en memoria. Portar el almacén a VantaDB
     (`gov/permissions/<tool>/<digest>`) con TTL cierra el hueco entre "aprobado en este turno" y "aprobado para
     esta invocación concreta".
   - **Relación con Backlog Ego:** `ACT-06`, `SEC-06`, `CORE-07`.

3. **Inspección de egreso (destino y dirección)** — `crates/goose/src/security/egress_inspector.rs:49`
   (`extract_destinations`), `:211` (`detect_direction`), `:275` (`is_shell_tool`/`is_web_tool`), `:369` (emisión
   del resultado).
   - **Qué hace:** Extrae de un comando de terminal los destinos de red (URL, `git@host:repo`, `s3://`, `gs://`,
     `scp`/`rsync`, `ssh`, `docker push/login`, `nc`/genérico, `npm publish`, `cargo publish`) y clasifica la
     **dirección** (`Outbound`/`Inbound`) según la semántica del comando (`git push` sale, `git clone` entra,
     `curl -X POST` sube, `scp` depende del último argumento). Emite `InspectionAction::Allow` con
     `confidence: 0.0`: es **observacional**, alimenta auditoría y no bloquea por sí mismo.
   - **Adaptación en Ego:** `packages/security/src/netPolicy.ts` y `ssrfPolicy.ts` frenan el destino SSRF de
     tools *web*, pero no clasifican la dirección de egreso de un `terminal_exec` (`git push`, `npm publish`,
     `scp`). El inspector debe elevar a `requireApproval` cuando detecte exfiltración y registrar el destino en
     `gov/audit` (`SEC-06`).
   - **Relación con Backlog Ego:** `SEC-03`, `SEC-06`, `ACT-06`.

### Bloque B: Ciclo de vida de hooks y bucle de sesión ###

1. **Taxonomía extendida de hooks de ciclo de vida** — `crates/goose/src/hooks/mod.rs:54` (`enum HookEvent`:
   `PreToolUse`, `PreToolUseResult`, `PostToolUse`, `PostToolUseFailure`, `SessionStart`, `SessionEnd`,
   `UserPromptSubmit`, `BeforeReadFile`, `AfterFileEdit`, `BeforeShellExecution`, `AfterShellExecution`, `Stop`),
   `:119` (regla con `matcher`), `:43` (timeout por defecto 30 s).
   - **Qué hace:** Un hook puede **vetar** antes de la tool (`PreToolUse`) y además **observar el resultado de la
     decisión** (`PreToolUseResult`), de modo que un auditor externo ve la denegación *antes* de que el modelo
     reciba el rechazo (`crates/goose/src/agents/state_machine/ops_toolcalling.rs:119-160`).
   - **Adaptación en Ego:** `packages/events/src/types.ts:177` solo define `PreToolUse`, `PostToolUse`,
     `SessionStart`, `SessionEnd`. Añadir los eventos por efecto (`BeforeShellExecution`, `AfterFileEdit`,
     `BeforeReadFile`), por ciclo (`UserPromptSubmit`, `Stop`) y por resultado (`PreToolUseResult`,
     `PostToolUseFailure`) cierra la taxonomía; el gate fail-closed y la auditoría ya están en producción
     (`apps/desktop/src/main/ipc/register-ipc.ts:2153,2165`; `apps/desktop/src/main.ts:2058`).
   - **Relación con Backlog Ego:** `ACT-05`, `ACT-12`, `SEC-05`.

2. **Guía de usuario entre turnos (steer)** — `crates/goose/src/agents/state_machine/ops_steer.rs:22`
   (`SteerOperation`), `:20` (`SteerQueue`), `:60-97` (drenado); condición de hueco en
   `crates/goose-agent/src/operation.rs:74` (`ends_turn`).
   - **Qué hace:** Encola mensajes del usuario y los inyecta **solo** en el hueco entre el turno del modelo y el
     siguiente turno de herramienta (`ends_turn(messages) || last_effective_role(messages) == Tool`), nunca a
     mitad de una tool call. El drain se materializa como efecto y se emite `UserPromptSubmit`.
   - **Adaptación en Ego:** `packages/runtime/src/ToolExecutionLoop.ts` no ofrece ninguna cola de interyección;
     el usuario solo puede hablar entre turnos completos. Incorporar la cola como efecto del loop, con la misma
     condición de hueco, es un cambio aditivo y de bajo riesgo.
   - **Relación con Backlog Ego:** `CORE-05`, `ACT-02`.

### Bloque C: Estabilidad del catálogo de herramientas ###

1. **Lease de catálogo congelado por ejecución** —
   `crates/goose/src/agents/extension_manager/lease.rs:1-3` (contrato: *"A lease keeps the slots and tool catalog
   it was resolved with, so a held lease is unaffected by selection changes and tool-list changes; only a newly
   resolved lease sees them"*), `:175` (`ExtensionLease`), `:113` (`ToolCatalog`), `:210-216` (catálogo
   materializado en `OnceCell`), `:136-143` (deduplicación de nombres con aviso), `:573-635` (`resolve_tool` con
   recuperación de nombres mangled).
   - **Qué hace:** Un run en vuelo trabaja contra un **catálogo inmutable** aunque el usuario recargue la
     configuración de extensiones durante la ejecución. Un lease caducado invalida las aprobaciones que dependían
     de él (`crates/goose/src/agents/state_machine/ops_toolcalling.rs:30`).
   - **Adaptación en Ego:** `packages/tools/src/ToolRegistry.ts:278` ofrece `clone(filter)`, pero **solo se usa en
     tests** (`packages/tools/test/ToolRegistry.test.ts:219`); no existe un lease que congele el catálogo durante
     un run frente a una recarga por `SafeConfigMutationService`
     (`packages/execution/src/SafeConfigMutation.ts:120`). El lease debe adquirirse en el loop y liberarse al
     cerrar el turno.
   - **Relación con Backlog Ego:** `ACT-01`, `ACT-09`, `COUC-10`.

### Bloque D: Declaratividad de providers y automatización ###

1. **Catálogo declarativo de providers** — `crates/goose-providers/src/declarative/definitions/groq.json:1-68`
   (esquema: `name`, `engine`, `api_key_env`, `base_url`, `models[]` con `context_limit`/`max_tokens`,
   `supports_streaming`, `preserves_thinking`, `setup{category,setup_method,docs_url}`);
   `crates/goose-providers/src/declarative/macros.rs:1-27` (montaje por `include_str!`); directorio con **50**
   definiciones.
   - **Qué hace:** Añadir un proveedor compatible con OpenAI es escribir un JSON, no un adaptador Rust. El
     bloque `setup` (`setup_method: "single_api_key"`, `docs_url`) alimenta además el onboarding BYOK.
   - **Adaptación en Ego:** `packages/models/src/ModelCatalog.ts:10` conoce 5 proveedores y `CURATED_MODELS`
     (`:21`) solo guarda *nombres* de modelo, sin `context_limit`, `max_tokens`, `api_key_env` ni `docs_url`.
     Portar el **esquema** (JSON + `ProviderDescriptor` tipado en `packages/models/src/types.ts`) permite abrir el
     router a providers OpenAI-compatible sin escribir código.
   - **Relación con Backlog Ego:** `CORE-03`, `CORE-04`, `DIST-07`.

2. **Receta versionada y ejecución headless** — `crates/goose/src/recipe/mod.rs:43` (`Recipe`: `version`,
   `title`, `description`, `instructions`, `prompt`, `extensions`, `settings`, `parameters`,
   `response.json_schema`, `sub_recipes`, `retry`), `:120` (`SubRecipe`),
   `crates/goose/src/recipe/manifest.rs:26` (manifiestos con id estable y `last_modified`); CLI headless en
   `crates/goose-cli/src/cli.rs:243` (`--text`), `:321` (`--output-format text|json|stream-json`), `:373`
   (`--no-session`), `:383` (`--resume`).
   - **Qué hace:** Un flujo ejecutable se declara como fichero versionado; la receta fija prompt, extensiones,
     parámetros y esquema de salida; las sub-recetas se resuelven por ruta relativa al fichero padre. El modo
     headless permite invocar el agente sin sesión persistida, con salida JSON o JSON en streaming, y reanudar un
     run previo.
   - **Adaptación en Ego:** no existe manifiesto declarativo de flujo; lo más cercano es `SubEgoManifest`
     (`packages/subegos/`), que describe un Sub-Ego pero no un flujo ejecutable. La receta encaja mejor en la
     Fase 03 (Sub-Egos) que en P0.
   - **Relación con Backlog Ego:** `SUB-01`, `SUB-11`, `TASK-07`, `DIST-07`.

---

## 3. Matriz de Extracción vs Descarte ##

| Componente Goose | Acción en Ego | Razón Técnica / Arquitectónica |
| --- | :---: | --- |
| `crates/goose/src/tool_inspection.rs` (cadena de inspectores) | **EXTRAER & ADAPTAR** | Desacopla el veredicto de política de la ejecución; permite añadir inspectores sin tocar el runtime. |
| `crates/goose/src/permission/permission_store.rs` | **EXTRAER & ADAPTAR** | La granularidad hash-de-argumentos + TTL aporta control real sobre aprobaciones reutilizables. |
| `crates/goose/src/security/egress_inspector.rs` | **EXTRAER & ADAPTAR** | Cubre un vector que la política SSRF de Ego no observa: la exfiltración por comandos de terminal. |
| `crates/goose/src/hooks/mod.rs` (taxonomía) | **EXTRAER & ADAPTAR** | Ego tiene 4 de los 12 eventos; faltan los de efecto, ciclo y resultado. |
| `crates/goose/src/agents/state_machine/ops_steer.rs` | **EXTRAER & ADAPTAR** | Interacción no disruptiva; aditivo al loop, sin tocar la granularidad de aprobación. |
| `crates/goose/src/agents/extension_manager/lease.rs` | **EXTRAER & ADAPTAR** | Estabilidad del catálogo bajo recarga en caliente; `clone()` de Ego no cubre el caso. |
| `crates/goose-providers/src/declarative/definitions/*.json` | **EXTRAER PATRÓN** | Portar el *esquema* declarativo; no los 50 ficheros ni el macro Rust. |
| `crates/goose/src/recipe/*` + CLI headless | **EXTRAER PATRÓN** | Formato declarativo valuable, pero de alcance P1/Fase 03: exige modelo de flujos en Ego. |
| `crates/goose/src/agents/extension.rs:91` (denylist de env) | **DESCARTAR** | Sustituido por la allowlist explícita canónica de Ego (`sanitizeProcessEnv`), estrictamente superior. |
| `crates/goose-agent/` + `crates/goose-cli/` (runtime Rust) | **DESCARTAR** | Ego es TypeScript strict sobre Node 22; portar un runtime en Rust contradice el stack canónico. |
| `ui/text/` (TUI ACP), `ui/desktop/` (Electron de Goose) | **DESCARTAR** | La presentación de Ego ya está canificada en `@assistant-ui/react` + Canvas. |
| `crates/goose-roaming/`, `oidc-proxy/` | **DESCARTAR** | Relay saliente y sincronización entre dispositivos: viola el principio 9 (local-first y soberanía del dato). |
| `crates/goose/src/dictation/`, `live_voice/`, `goose_apps/` | **DESCARTAR** | Capacidades de voz y de apps de terceros fuera del alcance del SOC y del modelo canónico de UI. |

---

## 4. Estado real verificado (2026-10-20) ##

> Criterio de cierre: fichero adaptado **y** caller en producción verificado por grep sobre `packages/` +
> `apps/desktop/`, excluyendo `test/`, `dist/` y `node_modules/`. **Este repositorio de referencia es NUEVO**:
> no hay asimilación previa. Las búsquedas de verificación ejecutadas fueron:

```text
Select-String "Inspector|InspectionResult|egress|Egress" packages/ -> 4 hits, ninguno es inspector
Select-String "readOnly|exfil|repetition|maxRepetitions" packages/ -> 14 hits, ninguno en permisos
Select-String "configureHooks|HooksConfig" packages/ apps/ -> solo packages/events/src/ y test/
Select-String "\.clone\(" packages/tools/src/ToolRegistry.ts -> clone() en :278, solo invocado en test
Select-String "guidance|steer|interject|queue" packages/runtime -> 0 hits
Select-String "contextLimit|apiKeyEnv|baseUrl" packages/models/src -> 28 hits, ninguno en catálogo
Select-String "sanitizeProcessEnv" packages/ -> TerminalCommandPolicy.ts:602, NativeTerminalTool.ts:87
```

| ID | Patrón | Estado | Evidencia / Fundamento |
| --- | --- | :---: | --- |
| `GOOS-01` | Cadena componible de inspectores de tool-call | 🆕 Pendiente | No existe en `packages/`. **Cableado:** crear `packages/security/src/inspectors/` (interfaz `ToolInspector` + `ToolInspectionManager`) y hacer que `evaluateToolCall` (`packages/security/src/ToolPermissions.ts:260`) delegue; el veredicto mixto debe entrar en `ApprovalEngine.requestApproval` (`packages/execution/src/ApprovalEngine.ts:115`) conservando la mezcla monótona. **Owner:** A2 (ejecución) con A3 (seguridad). |
| `GOOS-02` | Permisos persistentes por tool-call con hash de args y TTL | 🆕 Pendiente | Ego calcula `inputDigest` (`packages/execution/src/ApprovalEngine.ts:75`) pero `PendingApproval` (`:98`) es solo en memoria. **Cableado:** nuevo `packages/security/src/ToolPermissionStore.ts` persistido en VantaDB (`gov/permissions/<tool>/<digest>`), leído en `ApprovalEngine` antes de suspender la llamada y escrito tras la decisión del usuario, con expiración y limpieza en carga. **Owner:** A2. |
| `GOOS-03` | Inspector de egreso (destino y dirección) | 🆕 Pendiente | `packages/security/src/netPolicy.ts` y `ssrfPolicy.ts` cubren el destino SSRF de tools web, no la dirección de `terminal_exec`. **Cableado:** nuevo inspector en la cadena de `GOOS-01`, aplicado antes de `terminal_exec` en `apps/desktop/src/main/ipc/register-ipc.ts:1898` (donde hoy solo se aplica la denylist de `FORBIDDEN_COMMAND_PATTERNS`), con registro del destino en `gov/audit` (`SEC-06`). **Owner:** A3. |
| `GOOS-04` | Taxonomía extendida de hooks de ciclo de vida | 🆕 Pendiente | Ego implementa 4 de los 12 eventos: `HookKind` en `packages/events/src/types.ts:177` (`PreToolUse`, `PostToolUse`, `SessionStart`, `SessionEnd`), gate fail-closed en `packages/events/src/EventBus.ts:284`, producción en `apps/desktop/src/main/ipc/register-ipc.ts:2153,2165` y auditoría en `apps/desktop/src/main.ts:2058`. **Cableado:** extender `HookKind` con `BeforeShellExecution`, `AfterFileEdit`, `BeforeReadFile`, `UserPromptSubmit`, `Stop`, `PreToolUseResult` y `PostToolUseFailure`, y emitir los nuevos eventos desde `packages/runtime/src/ToolExecutionLoop.ts:260` y desde las tools nativas de `packages/tools/src/native/`. **Owner:** A4 (runtime/UI) con A3. |
| `GOOS-05` | Lease de catálogo de tools congelado por ejecución | 🆕 Pendiente | `packages/tools/src/ToolRegistry.ts:278` (`clone(filter)`) solo se invoca en `packages/tools/test/ToolRegistry.test.ts:219`; `SafeConfigMutationService.apply` (`packages/execution/src/SafeConfigMutation.ts:120`) puede recargar MCP en caliente sin congelar el catálogo del run en vuelo. **Cableado:** `ToolRegistry.snapshotLease()` adquirido en `packages/runtime/src/ToolExecutionLoop.ts:260` y liberado al cerrar el turno; `SafeConfigMutationService` no invalida leases vivos y las aprobaciones que dependan de un lease caducado se reevalúan. **Owner:** A3. |
| `GOOS-06` | Catálogo declarativo de providers en JSON | 🆕 Pendiente | `packages/models/src/ModelCatalog.ts:10` declara 5 proveedores y `CURATED_MODELS` (`:21`) solo guarda nombres, sin `context_limit`, `max_tokens`, `api_key_env` ni `docs_url`. **Cableado:** nuevo `packages/models/src/providers/ProviderDescriptor.ts` + `packages/models/src/providers/catalog/*.json` (esquema portado de `crates/goose-providers/src/declarative/definitions/groq.json`), consumido por `createProductionRouter.ts` y por el onboarding BYOK. **Owner:** A1 (modelos). |
| `GOOS-07` | Receta versionada + ejecución headless | ⏳ Futura (Fase 03) | No existe manifiesto declarativo de flujo en Ego; `SubEgoManifest` describe un Sub-Ego, no un flujo ejecutable. **Fase destino:** Fase 03 (Sub-Egos) y Fase 07 (Tasks), ligado a `SUB-01`, `SUB-11` y `TASK-07`; el modo headless (`--text`, `--output-format json\|stream-json`, `--no-session`, `--resume`) se diferirá al mismo bloque por requerir un modelo de flujos que no existe en P0. |
| `GOOS-08` | Guía de usuario entre turnos (steer) | 🆕 Pendiente | `Select-String "guidance\|steer\|interject\|queue" packages/runtime` → 0 hits. **Cableado:** cola de mensajes del usuario en `packages/runtime/src/ToolExecutionLoop.ts:260`, drenada **solo** en el hueco post-turno (misma condición que `ends_turn` en `crates/goose-agent/src/operation.rs:74`), expuesta por IPC y renderizada en `apps/desktop/renderer/components/ego-chat.tsx`. **Owner:** A4. |
| `GOOS-09` | Denylist de env de hijack + stack Rust/TUI-ACP/roaming | 🚫 Descartada (con justificación) | La denylist de `crates/goose/src/agents/extension.rs:91` (`PATH`, `LD_PRELOAD`, `LD_LIBRARY_PATH`, `NODE_OPTIONS`, `DYLD_*`, `PYTHONPATH`, `CLASSPATH`, `ComSpec`, `TEMP`…) está **sustituida** por la allowlist explícita canónica de Ego, `sanitizeProcessEnv` (`packages/tools/src/native/terminal/TerminalCommandPolicy.ts:602`), en producción vía `NativeTerminalTool.ts:87` y `packages/integrations/src/mcp/SecretProxy.ts:151`: una allowlist excluye esas variables por omisión, no por lista negra, y admite la excepción puntual `extraAllowedEnv`. El runtime Rust (`crates/goose-agent/`, `crates/goose-cli/`), la TUI ACP (`ui/text/`), el Electron de Goose (`ui/desktop/`), el roaming P2P (`crates/goose-roaming/src/relay.rs`, `peerbook.rs`, `trust.rs`), el `oidc-proxy/` y las capacidades de voz (`crates/goose/src/dictation/`, `live_voice/`, `goose_apps/`) quedan fuera por stack no canónico, por violar el principio 9 (local-first y soberanía del dato) o por no pertenecer al modelo canónico de UI de Ego. |

---

## 5. Descarte normalizado a la forma canónica ##

Las filas de la matriz §3 usaban la forma `**DESCARTAR**`; se normalizan aquí a
`🚫 Descartada (con justificación)` (AGENTS.md §4) conservando el motivo original:

| Componente Goose | Veredicto | Fundamento |
| --- | :---: | --- |
| `crates/goose/src/agents/extension.rs:91` (`Envs::DISALLOWED_KEYS`) | 🚫 **Descartada (con justificación)** | Sustituido por la allowlist explícita canónica `sanitizeProcessEnv` (`packages/tools/src/native/terminal/TerminalCommandPolicy.ts:602`), en producción vía `NativeTerminalTool.ts:87` y `SecretProxy.ts:151`. Allowlist > denylist: excluye las variables de hijack por omisión. |
| `crates/goose-agent/`, `crates/goose-cli/` (runtime Rust) | 🚫 **Descartada (con justificación)** | Ego es TypeScript strict sobre Node 22 (`packages/runtime/src/ToolExecutionLoop.ts`). Portar un runtime en Rust contradice el stack canónico; solo se extraen los patrones Operation/Effect y el lease. |
| `ui/text/` (TUI ACP), `ui/desktop/` (Electron de Goose) | 🚫 **Descartada (con justificación)** | La presentación de Ego está canificada en `@assistant-ui/react` + Canvas declarativo (`apps/desktop/renderer/components/`); no hay hueco para una TUI ni para un segundo shell Electron. |
| `crates/goose-roaming/` (`relay.rs`, `peerbook.rs`, `trust.rs`), `oidc-proxy/` | 🚫 **Descartada (con justificación)** | Relay saliente, identidad federada y sincronización entre dispositivos: contradice el principio 9 (memoria local persistente, local-first y propiedad/exportación del dato) y exigiría un servicio externo no previsto. |
| `crates/goose/src/dictation/`, `live_voice/`, `goose_apps/` | 🚫 **Descartada (con justificación)** | Voz en vivo y aplicaciones de terceros quedan fuera del alcance del SOC y del modelo canónico de UI (Canvas declarativo); no existe tarea que las acoja en el Backlog Maestro. |

**Recuento:** 0 `✅ Completada` · 1 `🚫 Descartada` · 7 `🆕 Pendiente` · 1 `⏳ Futura` — **9 tareas**.
