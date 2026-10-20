---
kind: review
status: active
description: "Backlog especializado para la revisión, extracción de patrones y adaptación técnica de aaif-goose/goose hacia el monorepo de Ego."
tags: [ego, goose, extraction, review, governance, permissions, hooks, providers]
schema: "10-column canonical schema (.agents/references/backlog-format.md compatible)"
---

# Backlog de Revisión y Extracción: Goose (aaif-goose/goose) #

## Gobernanza de la ejecución, inspectores de tool-call y declaratividad de providers ##

| Campo | Valor |
| --- | --- |
| Estado | Activo — 9 hallazgos, 0 filas en el limbo |
| Repositorio Origen | `repos-referencia/goose/` (commit `9920efa`, rama `main`, Apache-2.0) |
| Total de Tareas | **9** (`GOOS-01..09`) |
| Fases Impactadas en Ego | Fases 01 (CORE), 02 (ACT), 03 (SUB), 07 (TASK), 11 (SEC), 12 (DIST) |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Última verificación | 2026-10-20 — greps sobre `packages/` + `apps/desktop/` (excluye `test/`, `dist/`, `node_modules/`) |

> **Propósito:** Registro canónico de auditoría, extracción de patrones y adaptación técnica de
> `repos-referencia/goose` hacia el monorepo de Ego. **Regla de Operación:** *No copiar código*. Extraer la
> lógica de diseño, contratos y patrones arquitectónicos, reescribiéndolos en TypeScript estricto, React 19 y
> Node 22 Main Process, apoyándose en VantaDB como sustrato de memoria. **Esquema:** Tabla canónica de 10
> columnas: `| ID | Severidad | Hallazgo | Archivo Goose | Esfuerzo | Prioridad | Estado |`
> `Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |`

---

## 0. Verificación de estado (2026-10-20) ##

Criterio de `✅ Completada`: existe el fichero adaptado **y** hay un caller en producción (grep sobre
`packages/` + `apps/desktop/`, excluyendo `test/`, `dist/` y `node_modules/`).

| Estado | Significado canónico |
| --- | --- |
| `✅ Completada` | Asimilado, integrado y con **caller en producción verificado**. La celda cita la ruta real. |
| `🚫 Descartada (con justificación)` | El patrón no se aplica en Ego, fue sustituido por otro módulo canónico, o viola un guardrail. La celda contiene el motivo técnico. |
| `🆕 Pendiente` | Patrón asimilado o identificado, **sin caller en producción**. La celda dice el cableado exacto y quién lo ejecuta. |
| `⏳ Futura (fase)` | Diferido a una fase posterior, con fase destino explícita y motivo del diferimiento. |

**Nota de alcance — repositorio NUEVO.** Goose no había sido inspeccionado antes de esta revisión. **No hay
ninguna fila `✅ Completada`**: no existe fichero adaptado ni caller de producción para ningún patrón de este
repo. Las filas `🆕 Pendiente` identifican trabajo de cableado pendiente, no código ya escrito. Búsquedas de
verificación ejecutadas:

```text
Select-String "Inspector|InspectionResult|egress|Egress" packages/ -> 4 hits, ninguno es inspector
Select-String "readOnly|exfil|repetition|maxRepetitions" packages/ -> 14 hits, ninguno en permisos
Select-String "configureHooks|HooksConfig" packages/ apps/ -> solo packages/events/src/ y test/
Select-String "\.clone\(" packages/tools/src/ToolRegistry.ts -> clone() en :278, solo invocado en test
Select-String "guidance|steer|interject|queue" packages/runtime -> 0 hits
Select-String "contextLimit|apiKeyEnv|baseUrl" packages/models/src -> 28 hits, ninguno en catálogo
Select-String "sanitizeProcessEnv" packages/ -> TerminalCommandPolicy.ts:602, NativeTerminalTool.ts:87
```

---

## 1. Resumen Ejecutivo de Extracción ##

Goose no aporta nada aprovechable a la capa de presentación de Ego: es un agente en Rust con TUI ACP y un
Electron propio, mientras que la UI de Ego está canificada en `@assistant-ui/react` + Canvas declarativo. Su
aporte real es **otro**: Goose es la referencia más completa inspeccionada hasta la fecha sobre **cómo se
gobierna la ejecución de una tool-call** — con una cadena de inspectores componible, un almacén persistente de
decisiones por invocación (hash de argumentos + caducidad), un inspector de egreso que clasifica el destino *y
la dirección* del tráfico de un comando, y un lease que congela el catálogo de herramientas mientras un run está
en curso.

El segundo bloque de valor es de **declaratividad**: 50 proveedores definidos en JSON
(`crates/goose-providers/src/declarative/definitions/`) y un formato de receta versionada con sub-recetas y
esquema de salida. Goose ofrece así el patrón más directo para abrir el Model Router de Ego a providers
OpenAI-compatible sin escribir código.

### MATRIZ DE DISTRIBUCIÓN POR FASE ###

```text
FASE 01 CORE COGNITIVO  │ GOOS-02  GOOS-06  GOOS-08                    (3)
FASE 02 ACCIÓN & TOOLS  │ GOOS-01  GOOS-02  GOOS-03  GOOS-04  GOOS-05  GOOS-08   (6)
FASE 03 SUB-EGOS       │ GOOS-05  GOOS-07                              (2)
FASE 07 TASKS           │ GOOS-07                                    (1)
FASE 11 SEGURIDAD       │ GOOS-01  GOOS-03  GOOS-04                    (3)
FASE 12 DISTRIBUCIÓN    │ GOOS-06                                    (1)
────────────────────────────────────────────────────────────────────────────────
Sin fase (descarte)     │ GOOS-09                                    (1)
```

#### Recuento de estados (verificado sobre las 9 filas de la tabla §2) ####

| `✅ Completada` | `🚫 Descartada` | `🆕 Pendiente` | `⏳ Futura` | Total |
| :---: | :---: | :---: | :---: | :---: |
| 0 | 1 | 7 | 1 | **9** |

---

## 2. Catálogo Detallado de Extracción (10 Columnas Canónicas) ##

| ID | Severidad | Hallazgo | Archivo Goose | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GOOS-01` | Crítica | **Cadena componible de inspectores de tool-call** con mezcla monótona de veredictos | `crates/goose/src/tool_inspection.rs:34,57,170` · `crates/goose/src/permission/permission_inspector.rs:15` | 2-3 d | P0 | 🆕 Pendiente | El trait `ToolInspector` (`:34`) y el `ToolInspectionManager` (`:57`) componibilizan la política: cada inspector devuelve `InspectionResult { action, reason, confidence, finding_id }` y `apply_inspection_results_to_permissions` (`:170`) aplica escalada monótona — `Allow` nunca pisa un `Deny` o `RequireApproval` previo (`:253-256`), y el fallo de un inspector no aborta la cadena (`:107-115`). **Adaptación:** nuevo `packages/security/src/inspectors/` con la misma semántica de mezcla; `evaluateToolCall` (`packages/security/src/ToolPermissions.ts:260`) delega y deja de ser un veredicto único; el resultado entra en `ApprovalEngine` (`packages/execution/src/ApprovalEngine.ts:115`) y en la auditoría `gov/audit` con `findingId`. | Ego: `ACT-06`, `SEC-01`..`SEC-05` · Extracción: `docs/extractions/goose.md` §2 Bloque A.1 | — |
| `GOOS-02` | Crítica | **Almacén persistente de permisos por tool-call** con hash de argumentos, caducidad y escritura atómica | `crates/goose/src/permission/permission_store.rs:23,79,92,117,63` | 2 d | P0 | 🆕 Pendiente | Indexa las decisiones por `"{tool}:{hash_b3(args)}"`, de modo que aprobar `ls -la` no habilita `rm -rf`; cada registro admite expiración opcional, conserva un contexto legible para auditoría, persiste con `tmp` + `rename` (`:63`) y purga caducados en la carga (`:129`). **Adaptación:** `packages/execution/src/ApprovalEngine.ts:75` ya calcula `inputDigest` SHA-256 canónico, pero `PendingApproval` (`:98`) es solo en memoria; crear `packages/security/src/ToolPermissionStore.ts` sobre VantaDB (`gov/permissions/<tool>/<digest>`), leído antes de suspender la llamada y escrito tras la decisión del usuario. | Ego: `ACT-06`, `SEC-06`, `CORE-07` | `GOOS-01` |
| `GOOS-03` | Alta | **Inspector de egreso**: destino de red y dirección (outbound/inbound) de un comando de terminal | `crates/goose/src/security/egress_inspector.rs:49,211,275,369` | 2 d | P0 | 🆕 Pendiente | Extrae destinos (URL, `git@host:repo`, `s3://`, `gs://`, `scp`/`rsync`, `ssh`, `docker push`, `nc`, `npm`/`cargo publish`) y clasifica la **dirección** según la semántica del comando (`git push` sale, `git clone` entra, `curl -X POST` sube, `scp` depende del último argumento); emite `Allow` con `confidence: 0.0`, es decir, observacional. **Adaptación:** `packages/security/src/netPolicy.ts` y `ssrfPolicy.ts` frenan el destino SSRF de tools web pero no la exfiltración por `terminal_exec`; el inspector debe elevar a `requireApproval` y registrar el destino en `gov/audit`, aplicándose en `apps/desktop/src/main/ipc/register-ipc.ts:1898` donde hoy solo actúa la denylist de comandos. | Ego: `SEC-03`, `SEC-06`, `ACT-06` | `GOOS-01` |
| `GOOS-04` | Alta | **Taxonomía extendida de hooks de ciclo de vida** (12 eventos, incluido el evento de resultado de la decisión) | `crates/goose/src/hooks/mod.rs:54,119,43` · `crates/goose/src/agents/state_machine/ops_toolcalling.rs:119-160` | 1-2 d | P1 | 🆕 Pendiente | Goose define `PreToolUse`, `PreToolUseResult`, `PostToolUse`, `PostToolUseFailure`, `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `BeforeReadFile`, `AfterFileEdit`, `BeforeShellExecution`, `AfterShellExecution` y `Stop`; un hook puede **vetar** antes de la tool y además **observar el veredicto** (`PreToolUseResult`), de modo que un auditor ve la denegación antes de que el modelo reciba el rechazo. Ego solo tiene 4 (`HookKind` en `packages/events/src/types.ts:177`), con gate fail-closed en `packages/events/src/EventBus.ts:284` y producción en `apps/desktop/src/main/ipc/register-ipc.ts:2153,2165`. **Adaptación:** extender `HookKind` con los eventos por efecto, por ciclo y por resultado, y emitirlos desde `packages/runtime/src/ToolExecutionLoop.ts:260` y desde las tools nativas. | Ego: `ACT-05`, `ACT-12`, `SEC-05` | — |
| `GOOS-05` | Alta | **Lease de catálogo de herramientas** congelado durante la ejecución | `crates/goose/src/agents/extension_manager/lease.rs:1-3,175,113,210` | 1-2 d | P1 | 🆕 Pendiente | Contrato explícito: *"a held lease is unaffected by selection changes and tool-list changes; only a newly resolved lease sees them"*. El catálogo se materializa en `OnceCell` (`:210`), deduplica nombres con aviso (`:136`) y la caducidad del lease invalida las aprobaciones que dependían de él (`crates/goose/src/agents/state_machine/ops_toolcalling.rs:30`). Ego tiene `ToolRegistry.clone(filter)` (`packages/tools/src/ToolRegistry.ts:278`) pero **solo se usa en tests** (`packages/tools/test/ToolRegistry.test.ts:219`), y `SafeConfigMutationService.apply` (`packages/execution/src/SafeConfigMutation.ts:120`) puede recargar MCP en caliente sin congelar el catálogo del run en vuelo. **Adaptación:** `ToolRegistry.snapshotLease()` adquirido por turno en el loop y liberado al cerrarlo; las recargas no invalidan leases vivos. | Ego: `ACT-01`, `ACT-09`, `SUB-06` · Compuerta: `COUC-10` | — |
| `GOOS-06` | Alta | **Catálogo declarativo de providers en JSON** (50 definiciones con `engine`, `api_key_env`, `context_limit`, `docs_url`) | `crates/goose-providers/src/declarative/definitions/groq.json:1-68` · `crates/goose-providers/src/declarative/macros.rs:1-27` | 1-2 d | P1 | 🆕 Pendiente | Añadir un proveedor OpenAI-compatible es escribir un JSON, no un adaptador; el bloque `setup` (`setup_method: "single_api_key"`, `docs_url`) alimenta además el onboarding BYOK. Ego conoce 5 proveedores (`packages/models/src/ModelCatalog.ts:10`) y `CURATED_MODELS` (`:21`) solo guarda nombres, sin límites de contexto ni `max_tokens` por modelo. **Adaptación:** `packages/models/src/providers/ProviderDescriptor.ts` + `packages/models/src/providers/catalog/*.json` consumidos por `createProductionRouter.ts` y por el configurador BYOK; portar el **esquema**, no los ficheros. | Ego: `CORE-03`, `CORE-04`, `DIST-07` | — |
| `GOOS-07` | Media | **Receta declarativa versionada** con sub-recetas y salida `json_schema`, y **modo headless** (`--text`, `--output-format`, `--no-session`, `--resume`) | `crates/goose/src/recipe/mod.rs:43,120` · `crates/goose/src/recipe/manifest.rs:26` · `crates/goose-cli/src/cli.rs:243,321,373,383` | 3 d | P2 | ⏳ Futura (Fase 03) | La receta declara `version`, `instructions`, `prompt`, `extensions`, `settings`, `parameters`, `response.json_schema`, `sub_recipes` y `retry`; las sub-recetas se resuelven por ruta relativa al fichero padre (`crates/goose/src/recipe/manifest.rs:73`) y el manifiesto tiene id estable + `last_modified`. La CLI permite ejecutar sin sesión (`--no-session`), con salida `json\|stream-json` (`--output-format`) y reanudar un run (`--resume`). **Motivo del diferimiento:** Ego no tiene modelo de flujos ejecutables; `SubEgoManifest` describe un Sub-Ego, no un flujo. **Fase destino:** Fase 03 (Sub-Egos) y Fase 07 (Tasks), ligado a `SUB-01`, `SUB-11` y `TASK-07`; el modo headless se difiere al mismo bloque. | Ego: `SUB-01`, `SUB-11`, `TASK-07`, `DIST-07` | `GOOS-05` |
| `GOOS-08` | Media | **Guía de usuario entre turnos** (cola drenada solo en el hueco modelo→herramienta) | `crates/goose/src/agents/state_machine/ops_steer.rs:20,22,60-97` · `crates/goose-agent/src/operation.rs:74` | 1 d | P2 | 🆕 Pendiente | `SteerQueue` (`ops_steer.rs:20`) encola mensajes del usuario y `SteerOperation::run` (`:60-97`) los drena **solo** cuando `ends_turn(messages)` o el rol efectivo es `Tool` (`crates/goose-agent/src/operation.rs:74`), nunca a mitad de una tool call; el drain se materializa como efecto y dispara `UserPromptSubmit`. Ego no tiene cola: `Select-String "guidance\|steer\|interject\|queue" packages/runtime` → 0 hits. **Adaptación:** cola en `packages/runtime/src/ToolExecutionLoop.ts:260` con la misma condición de hueco, expuesta por IPC y renderizada en `apps/desktop/renderer/components/ego-chat.tsx`; es aditivo y no altera la granularidad de aprobación. | Ego: `CORE-05`, `ACT-02` | `GOOS-04` |
| `GOOS-09` | Crítica | **Denylist de variables de entorno de hijack + stack Rust, TUI/ACP y roaming P2P/OIDC** | `crates/goose/src/agents/extension.rs:91` · `crates/goose-roaming/src/relay.rs,peerbook.rs,trust.rs` · `oidc-proxy/` · `ui/text/` | 0.5 d | P0 | 🚫 Descartada (con justificación) | La denylist de `Envs::DISALLOWED_KEYS` (`extension.rs:91`: `PATH`, `LD_PRELOAD`, `LD_LIBRARY_PATH`, `NODE_OPTIONS`, `DYLD_*`, `PYTHONPATH`, `CLASSPATH`, `ComSpec`, `TEMP`…) está **sustituida** por la allowlist explícita canónica de Ego, `sanitizeProcessEnv` (`packages/tools/src/native/terminal/TerminalCommandPolicy.ts:602`), en producción vía `NativeTerminalTool.ts:87` y `packages/integrations/src/mcp/SecretProxy.ts:151`: la allowlist excluye esas variables por omisión y admite excepción puntual (`extraAllowedEnv`), luego es estrictamente superior. El runtime Rust (`crates/goose-agent/`, `crates/goose-cli/`), la TUI ACP (`ui/text/`), el Electron de Goose (`ui/desktop/`), el roaming P2P (`relay.rs`, `peerbook.rs`, `trust.rs`), el `oidc-proxy/` y las capacidades de voz (`dictation/`, `live_voice/`, `goose_apps/`) quedan fuera por stack no canónico, por violar el principio 9 (local-first y soberanía del dato) o por no pertenecer al modelo canónico de UI de Ego. | Ego: `SEC-04` · Guardrail: `AGENTS.md` §4 (principio 9) | — |

---

## 3. Matriz de Integración con el Backlog Maestro ##

Cada tarea `GOOS-*` es **pre-requisito de diseño y código** de las fases del Backlog Maestro
(`docs/roadmap/Backlog.md`):

```text
GOOSE — 9 hallazgos
  GOOS-01 inspectores    GOOS-02 permisos TTL    GOOS-03 egreso
  GOOS-04 hooks          GOOS-05 lease tools     GOOS-06 providers JSON
  GOOS-07 receta         GOOS-08 steer           GOOS-09 descarte
       │
       ▼
  FASE 01 CORE  ─────GOOS-06/08──────────────┐
  FASE 02 ACT   ──GOOS-01/02/03/04/05/08─────┤
  FASE 03 SUB   ──────GOOS-05/07─────────────┤
  FASE 07 TASKS ────────GOOS-07──────────────┤
  FASE 11 SEC   ──GOOS-01/02/03/04/09────────┤
  FASE 12 DIST  ─────────GOOS-06─────────────┘
```

### Protocolo de Extracción por Tarea ###

1. **Aislamiento:** inspeccionar el fichero fuente en `repos-referencia/goose/` identificando dependencias
   externas (crates Rust, `rmcp`, `tokio`) y descartando crates nativos, TUI/ACP, roaming/relay y la denylist de
   env (sustituida por allowlist).
2. **Reescritura y verificación:** escribir el módulo en TypeScript estricto dentro de `packages/`, cumpliendo
   `tsconfig.json` y `AGENTS.md` §4, y probarlo aislado (Vitest) antes de integrarlo; todo inspector nuevo debe
   tener test de que **eleva** el veredicto y nunca lo rebaja.
3. **Cierre:** marcar `✅ Completada` **solo** con fichero adaptado + caller de producción verificado por grep
   sobre `packages/` + `apps/desktop/`; si el patrón no aplica, `🚫 Descartada (con justificación)`; si está
   identificado pero sin cablear, `🆕 Pendiente` con el cableado exacto y su responsable.

## 4. Deuda abierta derivada de esta verificación ##

| # | Ítem | Tipo | Owner | Bloqueante |
| --- | --- | --- | --- | --- |
| D1 | `GOOS-01`/`GOOS-03`: `evaluateToolCall` (`packages/security/src/ToolPermissions.ts:260`) es un veredicto único y no componible; no hay inspector de egreso ni cadena de inspectores | Código | A2/A3 | No |
| D2 | `GOOS-02`: `ApprovalEngine` mantiene `PendingApproval` en memoria (`packages/execution/src/ApprovalEngine.ts:98`); no hay decisiones persistidas por digest ni caducidad | Código | A2 | No |
| D3 | `GOOS-04`: `HookKind` cubre 4 de los 12 eventos de Goose (`packages/events/src/types.ts:177`) y `configureHooks` (`packages/events/src/EventBus.ts:284`) no tiene caller de producción: los hooks se evalúan pero nunca se configuran | Código | A4/A3 | No |
| D4 | `GOOS-05`: `ToolRegistry.clone()` (`packages/tools/src/ToolRegistry.ts:278`) sin caller de producción; el catálogo puede cambiar a mitad de un run por recarga MCP (`packages/execution/src/SafeConfigMutation.ts:120`) | Código | A3 | No |
| D5 | `GOOS-06`: el router depende de adaptadores hardcodeados y el onboarding BYOK no tiene catálogo declarativo de providers | Código | A1 | No |
| D6 | `GOOS-07`: no existe modelo de flujos ejecutables en Ego; `SubEgoManifest` describe un Sub-Ego, no un flujo con parámetros y esquema de salida | Diseño | ness-e | Sí — requiere decisión de producto |
| D7 | `docs/extractions/README.md` §4.1 (tabla maestra y recuento de 83 tareas) no incluye la fila de goose: el conteo de repos y estados queda desalineado respecto a esta revisión | Documentación | ness-e | No |
