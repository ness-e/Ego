---
kind: review
status: active
description: "Backlog especializado para la revisión, extracción de patrones y adaptación técnica de openai/codex hacia el monorepo de Ego."
tags: [ego, codex, extraction, review, sandbox, governance]
schema: "10-column canonical schema (.agents/references/backlog-format.md compatible)"
---

# Backlog de Revisión y Extracción: Codex CLI (openai/codex) #

## Gobernanza de ejecución, aprobación HITL y edición estructurada de ficheros ##

| Campo | Valor |
| --- | --- |
| Estado | Activo — 9 hallazgos, todos cerrados en estado canónico; 0 asimilados (repo nuevo) |
| Repositorio Origen | `repos-referencia/codex/` (Commit verificado: `0144894`, rama `main`, profundidad 1) |
| Total de Tareas | **9** (`CDX-01`..`CDX-09`) |
| Fases Impactadas en Ego | Fase 01 (`CORE`), Fase 02 (`ACT`), Fase 04 (`CANV`), Fase 08 (`DS`), Fase 11 (`SEC`) |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Última verificación | 2026-10-20 — grep sobre `packages/` + `apps/desktop/` (excluye `test/`, `dist/`, `node_modules/`) |

> **Propósito:** Registro canónico y secuencial de auditoría, extracción de patrones y adaptación técnica de
> `repos-referencia/codex` hacia el monorepo de Ego.
>
> **Regla de Operación:** *No copiar código directamente*. Extraer la lógica de diseño, los contratos y los patrones
> arquitectónicos, reescribiéndolos en TypeScript estricto, React 19 y Node 22 Main Process, apoyándose en VantaDB
> como sustrato de memoria.
>
> **Esquema:** Tabla canónica de 10 columnas: `ID`, `Severidad`, `Hallazgo`, `Archivo Codex`, `Esfuerzo`, `Prioridad`,
> `Estado`, `Descripción & Adaptación en Ego`, `Relaciones Ego`, `Dependencias`.

---

## 0. Verificación de estado (2026-10-20) ##

Cada fila fue auditada contra el **código real** de `repos-referencia/codex/` y contra el **código real de Ego**.
Criterio de `✅ Completada`: existe el fichero adaptado **y** hay un caller en producción (grep sobre `packages/` +
`apps/desktop/`, excluyendo `test/`, `dist/` y `node_modules/`).

| Estado | Significado canónico |
| --- | --- |
| `✅ Completada` | Asimilado, integrado y con **caller en producción verificado**. La celda cita la ruta real. |
| `🚫 Descartada (con justificación)` | El patrón no se aplica en Ego, fue sustituido por otro módulo canónico, o viola un guardrail. La celda contiene el motivo técnico. |
| `🆕 Pendiente` | Asimilado (el código existe y está probado) pero **sin caller en producción**. La celda dice el cableado exacto y quién lo ejecuta. |
| `⏳ Futura (fase)` | Diferido a una fase posterior, con fase destino explícita. |

**Nota de alcance (obligatoria):** Codex es un repositorio de referencia **nuevo**, recién añadido a
`repos-referencia/`. **Nada ha sido asimilado todavía**, de modo que **no existe ningún `✅ Completada`** en este
backlog. Los greps de partida devolvieron cero coincidencias en `packages/` y `apps/desktop/`; en consecuencia,
todos los patrones asimilables quedan en `🆕 Pendiente` con su cableado exacto, y las superficies no transferibles
en `🚫 Descartada`.

### Búsquedas de verificación ejecutadas ###

```text
Select-String "apply_patch|applyPatch|PermissionProfile|SandboxViolation"  packages/ apps/desktop/  -> 0
Select-String "ModelReroute|reroute|prefixRule|ExecPolicy|approvedForSession"  packages/ apps/desktop/  -> 0
Select-String "smart|autoApprove|automatic"  packages/execution/src/  -> 0
Select-String "ToolDecision"  packages/security/src/ToolPermissions.ts:25  -> allow|deny|requireApproval
Select-String "extraBlockedCommands"  packages/security/src/ToolPermissions.ts:72  -> readonly RegExp[]
Select-String "EgoEventType"  packages/events/src/types.ts:5  -> sin "model.rerouted"
```

---

## 1. Resumen Ejecutivo de Extracción ##

Codex es, de los repositorios de referencia de Ego, el que más se acerca al **problema de gobernanza de ejecución**:
un agente que ejecuta comandos y escribe ficheros en la máquina del usuario. Su aporte a Ego no es el producto (un
CLI de codegen de OpenAI) sino cuatro modelos de datos que hoy faltan o están simplificados en Ego: el **perfil de
permisos unificado** con no-escalación, el **veredicto de política de tres estados** con reglas de prefijo, la
**caché de aprobación con alcance de sesión**, y el **parche estructurado con anclaje contextual**. En
contraposición, Codex arrastra tres superficies que colisionan frontalmente con los guardrails de `AGENTS.md` §4: los
**backends de sandbox nativos del SO** (Rust nativo), la **TUI `ratatui`/`crossterm`** y el **plano de control cloud
del proveedor**.

### MATRIZ DE DISTRIBUCIÓN POR FASE (fase principal de cada hallazgo) ###

```text
  FASE 01 · CORE  (Cognitive Core)      │ CDX-07   CDX-08                 │  2
  FASE 02 · ACT   (Action & Tools)       │ CDX-03   CDX-05   CDX-06        │  3
  FASE 11 · SEC   (Security)             │ CDX-01   CDX-02   CDX-04        │  3
  SIN FASE DESTINO (descarte con fundamento) │ CDX-09                     │  1
  ───────────────────────────────────────┴───────────────────────────────┴──
                                                          TOTAL          │  9
```

### Recuento de estados (verificado sobre las 9 filas de la tabla §2) ###

| `✅ Completada` | `🚫 Descartada` | `🆕 Pendiente` | `⏳ Futura` | Total |
| :---: | :---: | :---: | :---: | :---: |
| 0 | 1 | 8 | 0 | **9** |

Ninguna fila queda en el limbo: los 9 hallazgos cierran en uno de los cuatro estados canónicos.

---

## 2. Catálogo Detallado de Extracción (10 Columnas Canónicas) ##

| ID | Severidad | Hallazgo | Archivo Codex | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CDX-01` | Crítica | **Perfil de permisos unificado (fs + red) y no-escalación preservando lecturas denegadas** | `codex-rs/sandboxing/src/policy_transforms.rs:19-53` · `codex-rs/core/src/tools/sandboxing.rs:290-310` | 2-3d | P0 | 🆕 Pendiente | Codex normaliza permisos adicionales y detecta el caso en que **escalar fuera del sandbox destruiría una restricción activa**: con lecturas denegadas, degrada a ejecución sandboxeada en vez de escalar. Adaptación: `packages/security/src/PermissionProfile.ts` (nuevo) con `fileSystem: { kind, writableRoots[], deniedReadPaths[] }` y `network: { enabled }`; lo consumen `packages/security/src/ToolPermissions.ts:25` y `packages/execution/src/ApprovalEngine.ts:75-96`, que degrada a `requireApproval` en vez de ampliar el perímetro. **Cableado pendiente:** instanciar el perfil en la construcción del `ToolPermissions` en `apps/desktop/src/main.ts` (owner A2). | Ego: `SEC-05`, `SEC-08`, `ACT-06` · Extracción: `docs/extractions/codex.md` §2 Bloque A.1 | — |
| `CDX-02` | Alta | **Taxonomía normalizada de violaciones de sandbox (filesystem y red)** | `codex-rs/sandboxing/src/violation.rs:11-31` (palabras clave) · `:39-54` (backend) · `:68-99` (razones fs) · `:101-115` (red) | 1-2d | P1 | 🆕 Pendiente | Codex normaliza la denegación observada en el proceso a razones canónicas (`operation_not_permitted`, `permission_denied`, `read_only_file_system`, `policy_denied`, `failed_to_write_file`, `sigsys`) más backend y fragmento de salida, separando filesystem de red. Ego solo tiene `PERMISSION_DENIED` dentro de `CausalErrorCategory` (`packages/runtime/src/types.ts:215-224`), lo que impide distinguir "fichero de solo lectura" de "política denegada" en el remedy hint. **Cableado pendiente:** añadir `SandboxViolationReason` a `packages/runtime/src/types.ts` y mapearlo en `packages/runtime/src/ErrorHandler.ts:30-45` (owner A2). | Ego: `ACT-08`, `SEC-05`, `SEC-08` · Extracción: §2 Bloque A | `CDX-01` |
| `CDX-03` | Crítica | **Caché de aprobación por clave con alcance de sesión** | `codex-rs/core/src/tools/sandboxing.rs:41-64` (`ApprovalStore`) · `:72-118` (`with_cached_approval`) | 1-2d | P0 | 🆕 Pendiente | Codex cachea las decisiones `ApprovedForSession` por clave serializada y admite **un vector de claves** (una edición de parche toca varios ficheros): si todas están aprobadas omite el prompt, y al aprobar cachea cada clave por separado para que una tarea posterior que toque un subconjunto no vuelva a preguntar. Ego tiene `ApprovalDecision { approved: boolean }` (`packages/execution/src/types.ts:117-123`) sin `scope` ni almacén, por lo que "aprobar para esta sesión" obliga a re-preguntar. **Cableado pendiente:** `ApprovalDecisionCache` en `packages/execution/src/ApprovalEngine.ts`, indexado por el `inputDigest` SHA-256 que ya produce `computeActionIdentity` (`packages/execution/src/ApprovalEngine.ts:75-96`), resuelto desde `ipc.approval.resolve`; la tarjeta `ACT-07` ofrece el botón "Aprobar para la sesión" (owner A2). | Ego: `ACT-06`, `ACT-07`, `INT-05` · Extracción: §2 Bloque A.4 | `CDX-04` |
| `CDX-04` | Crítica | **Decisión de política de tres estados y reglas de prefijo con tokens alternativos** | `codex-rs/execpolicy/src/decision.rs:9-16` (`Decision`) · `codex-rs/execpolicy/src/rule.rs:16-60` (`PatternToken`, `PrefixPattern`) · `:62-77` (`RuleMatch` con `justification`) | 2-3d | P0 | 🆕 Pendiente | Una regla devuelve `allow`, `prompt` o `forbidden`; el patrón de prefija acepta token fijo o **alternativas** (`Alts`), de modo que una regla cubre `git status` y `git commit` sin enumerar prefijos completos, y cada coincidencia puede llevar justificación legible. Ego tiene `ToolDecision = "allow" \| "deny" \| "requireApproval"` (`packages/security/src/ToolPermissions.ts:25`) y `extraBlockedCommands: readonly RegExp[]` (`:72`): no expresa "preguntar" ni coincidencia por prefijo. **Cableado pendiente:** `packages/security/src/PolicyRules.ts` con `PrefixRule { first; rest: (string \| string[])[]; decision; justification? }`, y `ApprovalPolicyRule` (`packages/execution/src/types.ts:149-155`) passando de booleano a veredicto de tres estados (owner A2/A4). | Ego: `SEC-05`, `ACT-06` · Extracción: §2 Bloque A.2 | — |
| `CDX-05` | Alta | **Revisor automático de aprobaciones con invariante fail-closed** | `codex-rs/core/src/guardian/mod.rs:1-4` · `codex-rs/core/src/guardian/decision.rs:44-52` (`decide_approval`) | 2d | P1 | 🆕 Pendiente | El revisor automático devuelve un veredicto; si no lo hay, la decisión **vuelve al flujo humano** ("no contributor is never an implicit allow"), y hay requisitos de revisión obligatorios por modelo que el anfitrión no puede desactivar. Ego declara el modo `"smart"` en `ToolApprovalsOptions` (`packages/security/src/ToolPermissions.ts:60-66`) pero solo lo porta ("se portan para composición"): no existe revisor (`grep "smart\|autoApprove"` sobre `packages/execution/src` → 0). **Cableado pendiente:** `packages/execution/src/AutoReviewer.ts` con contrato `decide(ctx): "allow" \| "prompt" \| "forbid" \| undefined`, donde `undefined` significa preguntar al usuario y nunca aprobar (owner A2). | Ego: `ACT-06`, `ACT-07` · Extracción: §2 Bloque A.5 | `CDX-03` |
| `CDX-06` | Alta | **Parche estructurado con anclaje contextual en vez de reescritura completa** | `codex-rs/apply-patch/src/parser.rs:4-25` (gramática) · `:37-45` (marcadores) · `:66-109` (`Hunk`) · `codex-rs/apply-patch/src/file_update.rs:25-55` · `:60-100` (`seek_sequence`) | 2-3d | P1 | 🆕 Pendiente | El parche emitido por el modelo se parsea a hunks y el update se localiza por **línea de contexto** (`@@`) con búsqueda secuencial tolerante, no por número de línea; si el contexto no aparece falla con "Failed to find context" en vez de corromper el fichero. Ego solo tiene `fs_write_file` (`packages/tools/src/native/fs/NativeFsTool.ts:128-129`), que reescribe el fichero entero y por tanto depende de que el modelo haya reemitido el contenido completo. **Cableado pendiente:** `fs_apply_patch` en `packages/tools/src/native/fs/`, reutilizando la atomicidad y el backup ya implementados (`packages/tools/src/native/fs/NativeFsTool.ts:148-156`) (owner A4). | Ego: `ACT-04`, `ACT-07`, `SEC-05` · Extracción: §2 Bloque B.6 | `CDX-04` |
| `CDX-07` | Alta | **Evento de reroute de modelo visible (origen, destino, motivo)** | `codex-rs/protocol/src/protocol.rs:1498-1499` (variante `EventMsg::ModelReroute`) · `:2237-2241` (`ModelRerouteEvent`) | 1d | P1 | 🆕 Pendiente | Codex no registra la degradación de modelo como log: emite un evento de primera clase del protocolo con `from_model`, `to_model` y `reason`, de modo que el front-end puede mostrarla. En Ego `EgoEventType` (`packages/events/src/types.ts:5-49`) no tiene tipo de reroute y `runFallbackChain` (`packages/models/src/ModelRouter.ts:729-789`) solo deja un `console.warn` (`:781`), de modo que el usuario no puede saber por qué se le cambió el modelo. **Cableado pendiente:** nuevo tipo `"model.rerouted"` en `packages/events/src/types.ts` y emisión desde `ModelRouter`, visible en `MetricsConsole` (`DS-05`) y en Explicabilidad (`CANV-07`) (owner A2). | Ego: `CORE-03`, `CANV-07`, `DS-05` · Extracción: §2 Bloque B.7 | — |
| `CDX-08` | Media | **Degradación con estado de sesión y presupuesto de reintentos con backoff acotado** | `codex-rs/core/src/client.rs:719-738` (`force_http_fallback`) · `:2423-2439` (`try_switch_fallback_transport`) · `codex-rs/core/src/responses_retry.rs:23-24` (delay 5 s, tope 60 s) · `:32-118` (`ResponsesStreamRetryState`) | 1-2d | P2 | 🆕 Pendiente | Al agotar el presupuesto de reintentos del proveedor, Codex degrada el transporte **de forma permanente para la sesión** (no por petición) y lo contabiliza con métrica propia (`codex.transport.fallback_to_http`); el backoff de reconexión es exponencial con tope duro. Ego mantiene un único `fallbackModelId` (`packages/models/src/ModelRouter.ts:395-400`) y evalúa la cadena `runFallbackChain` (`:729-789`) **por petición**, sin estado degradado ni presupuesto. **Cableado pendiente:** estado `degradedTransport` en `packages/models/src/ModelRouter.ts`, reintentos acotados con backoff exponencial y degradación expuesta como `model.rerouted` con `reason: "transport_degraded"` (owner A2). | Ego: `CORE-03`, `INT-02`, `DEC-06` · Extracción: §2 Bloque B.8 | `CDX-07` |
| `CDX-09` | Media | **Backends de sandbox nativos del SO, TUI `ratatui` y plano de control cloud del proveedor** | `codex-rs/sandboxing/src/manager.rs:50-64` · `codex-rs/linux-sandbox/src/seccomp.rs:45-90` · `codex-rs/mxc-sandbox/src/lib.rs:98` · `codex-rs/tui/Cargo.toml:82,93` · `codex-rs/cloud-tasks/` · `codex-rs/analytics/` | 0 | P0 | 🚫 Descartada (con justificación) | Sin traducción posible a TypeScript/Node 22: (a) los backends de sandbox son crates Rust nativos con políticas `.sbpl` y binarios cross-platform, lo que exigiría un `.node` nuevo en el bundle (`DIST-02`) y contradice el stack canónico (`AGENTS.md` §1) — el enforcement de Ego es `ToolPermissions` + `ApprovalEngine` + `NetPolicy` (`SEC-05`); (b) la TUI `ratatui`/`crossterm` no es primitive de librería web y la UI de Ego es Electron + React 19 (`CORE-05`); (c) el plano cloud de OpenAI (`cloud-tasks`/`cloud-client`/`cloud-config`) contradice el principio 9 (local-first y propiedad/exportación de datos) y la telemetría del proveedor (`analytics`, `otel-trace-websocket`) rompe el perímetro local, ya cubierto por BYOK + `CredentialManager` (`SEC-03`) y telemetría local (`DEC-08`). **El patrón de datos sí se conserva:** de (a) se extraen `CDX-01` y `CDX-02`; de (c) nada. | Ego: `SEC-05`, `CORE-05`, `SEC-03` · Extracción: §3 y §5 | — |

---

## 3. Matriz de Integración con el Backlog Maestro ##

Cada tarea `CDX-*` se ejecuta como **pre-requisito de diseño y código** de las fases del Backlog Maestro
(`docs/roadmap/Backlog.md`):

```text
  FASE 01 · CORE ── CORE-03 (Model Router) ──┬── CDX-07  (evento model.rerouted)
                                             └── CDX-08  (degradación con estado de sesión)

  FASE 02 · ACT  ── ACT-06 (ApprovalEngine) ─┬── CDX-03  (caché con alcance de sesión)
                     ACT-07 (tarjeta HITL)  ├── CDX-05  (AutoReviewer fail-closed)
                     ACT-04 (fs nativo)     └── CDX-06  (fs_apply_patch contextual)

  FASE 04 · CANV ── CANV-07 ("¿Por qué?") ───── CDX-07  (origen/destino/motivo del reroute)

  FASE 08 · DS   ── DS-05 (MetricsConsole) ──── CDX-07  (métrica de degradación de modelo)

  FASE 11 · SEC  ── SEC-05 (ToolPermissions) ─┬── CDX-01  (PermissionProfile unificado)
                     SEC-08 (límites)          ├── CDX-02  (taxonomía de violaciones)
                     SEC-06 (auditoría)        └── CDX-04  (veredicto de 3 estados)
```

### Protocolo de Extracción por Tarea ###

1. **Aislamiento:** leer el fichero fuente en `repos-referencia/codex/` e identificar dependencias externas (crates,
   binarios, políticas del SO). Descartar crates nativos, políticas `.sbpl`, TUI y todo el plano cloud/proveedor.
2. **Reescritura Canónica:** escribir el módulo en TypeScript estricto dentro de `packages/` o `apps/desktop/`,
   cumpliendo `AGENTS.md` §4 (sin `any`, sin lógica de negocio en el renderer, sin acceso directo a VantaDB), y
   probarlo de forma aislada (Vitest) antes de integrarlo en el hilo principal.
3. **Cierre de Tarea:** marcar `✅ Completada` **solo** con fichero adaptado + caller en producción verificado por
   grep; si el patrón no aplica, `🚫 Descartada (con justificación)`; si el código existe pero no está cableado,
   `🆕 Pendiente` con el cableado exacto y su responsable.

---

## 4. Deuda abierta derivada de esta verificación ##

| # | Ítem | Tipo | Owner | Bloqueante |
| --- | --- | --- | --- | --- |
| D1 | `CDX-01`: `ToolPermissions` no modela lecturas denegadas, luego una escalada de permisos no puede degradarse a un nivel más restrictivo | Código | A2 | No |
| D2 | `CDX-03` / `CDX-04` / `CDX-05`: el motor de aprobación de Ego no tiene caché con alcance de sesión, ni veredicto de tres estados, ni revisor automático fail-closed | Decisión | A2 | No |
| D3 | `CDX-06`: `fs_write_file` reescribe el fichero completo; no existe herramienta de parche contextual y el modelo puede desincronizarse del contenido real | Código | A4 | No |
| D4 | `CDX-07` / `CDX-08`: la degradación de modelo es invisible para el usuario (`console.warn`) y sin estado a nivel de sesión | Código | A2 | No |
| D5 | `CDX-09`: backends nativos, TUI y plano cloud quedan formalmente fuera de alcance; el descarte debe quedar registrado para no reabrirlo por curiosidad | Decisión | ness-e | No |

> Ficha técnica completa: [codex.md](../extractions/codex.md). Catálogo de extracciones:
> [extractions/README.md](../extractions/README.md).
