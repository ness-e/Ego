---
kind: review
status: active
description: "Backlog especializado para la revisión, extracción de patrones y adaptación técnica de repos-referencia/vibe-kanban hacia el monorepo de Ego."
tags: [ego, vibe-kanban, extraction, review, worktrees, multi-agent, git, hitl]
schema: "10-column canonical schema (.agents/references/backlog-format.md compatible)"
---

# Backlog de Revisión y Extracción: Vibe Kanban (BloopAI/vibe-kanban) — Ego SOC #

## Orquestación multi-agente sobre worktrees: ciclo de vida, integración de cambios y reconciliación de estado ##

| Campo | Valor |
| --- | --- |
| Estado | Activo — 8 compuertas, 0 filas en el limbo |
| Repositorio Origen | `repos-referencia/vibe-kanban/` (BloopAI/vibe-kanban, commit `d5cbb53`, `v0.1.45`, Apache-2.0) |
| Total de Tareas | **8** (`VIBE-01..08`) |
| Fases Impactadas en Ego | Fase 02 (ACCIÓN), Fase 03 (SUB-EGOS), Fase 07 (TASKS), Fase 10 (RECOVERY) |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Última verificación | 2026-10-20 — grep sobre `packages/` + `apps/desktop/` excluyendo `test/`, `dist/`, `node_modules/` |

---

## 0. Verificación de estado ##

Cada fila fue auditada contra el **código real** del commit `d5cbb53` y contrastada con el código de
Ego. Criterio de `✅ Completada`: existe el fichero adaptado **y** hay un caller en producción.

| Estado | Significado canónico |
| --- | --- |
| `✅ Completada` | Asimilado, integrado y con **caller en producción verificado**. La celda cita la ruta real. |
| `🚫 Descartada (con justificación)` | El patrón no se aplica en Ego, fue sustituido por otro módulo canónico, o viola un guardrail. La celda contiene el motivo técnico. |
| `🆕 Pendiente` | Patrón asimilado o a asimilar, pero **sin caller en producción**. La celda dice el cableado exacto y quién lo ejecuta. |
| `⏳ Futura (fase)` | Diferido a una fase posterior, con fase destino explícita y motivo. |

**Nota de alcance (repo nuevo):** `vibe-kanban` se incorpora hoy al catálogo de `repos-referencia/`.
**Ninguna compuerta de este repo ha sido asimilada todavía**, por lo que el recuento de `✅ Completada`
es legítimamente **0**. La única compuerta que no arranca como pendiente es la que Ego ya cubre con un
módulo canónico (`VIBE-02`), y por eso cierra como `🚫 Descartada`.

### Búsquedas de verificación ejecutadas ###

```text
grep "createWorktree|finalizeWorktree"  packages/ apps/  -> 0 callers en produccion (solo tests)
grep "worktree"                apps/desktop/  -> register-ipc.ts:1654 (listWorktrees), main.ts:1271 (prune)
grep "rebase|squash|merge_changes"     packages/  -> 0 hits (solo regex en IntentClassifier.ts:166)
grep "json-patch|applyPatch|JSONPatch"  packages/  -> 0 hits
grep "claude-code|codex"                packages/  -> 0 hits funcionales (sin runner de agente externo)
grep "gov/audit"                packages/memory/  -> EgoMemoryAdapter.ts:1321,1340 (log de auditoria)
```

---

## 1. Resumen Ejecutivo de Extracción ##

Vibe Kanban aporta a Ego una única carencia estructural: **la Fase 03 de Sub-Egos tiene los módulos
escritos pero no el flujo integrado**. Hoy existe `SubEgoWorktreeManager`
(`packages/subegos/src/SubEgoWorktree.ts:139`) y `WorktreeManager`
(`packages/domains/src/engineering/WorktreeManager.ts:161`), pero **ningún `createWorktree` tiene caller
de producción**: el renderer solo lista worktrees (`apps/desktop/src/main/ipc/register-ipc.ts:1654`) y el
job de limpieza solo poda huérfanos (`apps/desktop/src/main.ts:1271-1277`). Vibe Kanban muestra
exactamente cómo cerrar ese hueco —worktree idempotente con lock por ruta— y añade dos capacidades que
Ego no tiene en absoluto: **integración del cambio del agente** (merge squash con guarda de
divergencia + rebase con guardas) y **ciclo de vida de una sesión de agente externo** (spawn con timeout
de arranque, monitor de salida, cancelación en dos fases y kill del grupo de procesos).

El resto del repositorio (shell Tauri, servidor axum propio, SQLite, `crates/remote` con ElectricSQL,
relay WebRTC, revisión de PRs) queda descartado por guardrail o por contaminación de dominio.

### Matriz de distribución por fase ###

```text
FASE 02 · ACCIÓN (ACT-03, ACT-06, ACT-07)
  └── VIBE-05  Ciclo de vida del proceso de agente externo
  └── VIBE-06  Puente de aprobación HITL hacia el ejecutor externo

FASE 03 · SUB-EGOS (SUB-03, SUB-07, SUB-08)
  ├── VIBE-01  ensure idempotente de worktree + lock por ruta
  ├── VIBE-03  Merge squash con guarda de divergencia  ─┐ misma
  ├── VIBE-04  Rebase con guardas y conflicto accionable ─┘ módulo
  └── VIBE-05  (dependencia de VIBE-03/VIBE-04 para el ciclo de vida)

FASE 07 · TASKS (TASK-01, TASK-03)
  └── VIBE-08  Reconciliación de estado persistido vs. runtime al arrancar

FASE 07 · TASKS (P1, diferida)
  └── VIBE-07  Bus de eventos derivado de hooks de escritura  ⏳ (requiere VantaDB upstream)

DESCARTADA (ya cubierto por módulo canónico)
  └── VIBE-02  Barrido de worktrees/workspaces huérfanos → SubEgoWorktree.pruneOrphanWorktrees
```

### Recuento de estados (verificado sobre las 8 filas de la tabla §2) ###

| `✅ Completada` | `🚫 Descartada` | `🆕 Pendiente` | `⏳ Futura` | Total |
| :---: | :---: | :---: | :---: | :---: |
| 0 | 1 | 6 | 1 | **8** |

---

## 2. Catálogo Detallado de Extracción (10 Columnas Canónicas) ##

| ID | Severidad | Hallazgo | Archivo Vibe Kanban | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `VIBE-01` | 🔴 Crítica | **Semántica `ensure` idempotente de worktree con lock por ruta y validación en metadatos git** | `crates/worktree-manager/src/worktree_manager.rs:16-17`, `:88-116`, `:155-183`, `:185-227` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | Ego tiene los dos managers escritos pero **sin integración**: `packages/subegos/src/SubEgoWorktree.ts:139-180` hace `worktree remove --force` + `worktree add -B` sin serializar, y `packages/domains/src/engineering/WorktreeManager.ts:161-207` exige `MutationApproval` (`requireApproval`, `:120-126`) pero nadie lo invoca en producción (verificado: `apps/` solo llama `listWorktrees` en `register-ipc.ts:1654` y `pruneOrphanWorktrees` en `main.ts:1271-1277`). Falta además validar que el directorio esté **registrado** en `.git/worktrees/*/gitdir` antes de `add`. **Cableado:** implementar `ensureWorktree()` con mutex por ruta dentro de `packages/subegos/src/SubEgoWorktree.ts` y exponerlo por IPC con gate `ApprovalEngine`; invocar desde `packages/subegos/src/SubEgoRuntime.ts` al activar un Sub-Ego de ingeniería. | Ego: `SUB-07`, `SUB-08`, `DOM-01` · Ver: `docs/extractions/vibe-kanban.md` §Bloque A | — |
| `VIBE-02` | 🟡 Media | **Barrido de worktrees y workspaces huérfanos** | `crates/worktree-manager/src/worktree_manager.rs:525-529`, `crates/workspace-manager/src/workspace_manager.rs:538-610`, `crates/local-deployment/src/container.rs:304` | 🟢 0.5d | 🟠 P1 | 🚫 Descartada (con justificación) | Sustituido por módulo canónico de Ego: `SubEgoWorktreeManager.pruneOrphanWorktrees` (`packages/subegos/src/SubEgoWorktree.ts:270-336`) con **caller de producción verificado** en `apps/desktop/src/main.ts:1271-1277` (dentro de `MemoryCleanupJob`). La política de Ego es **más conservadora** que la de Vibe: ante fallo de `git worktree list` no poda nada (`inspectionFailed: true`, `:295-297`) y exige antigüedad `cleanupPeriodDays` (`:308-333`); además Ego confina el destino con `assertInsideRoot` (`packages/domains/src/engineering/WorktreeManager.ts:91-118`), mientras Vibe se protege con un subdirectorio propio (`.vibe-kanban-workspaces`). | Ego: `SUB-07`, `DOM-01` · Ver: `docs/extractions/vibe-kanban.md` §Bloque A | — |
| `VIBE-03` | 🔴 Crítica | **Merge squash con guarda de divergencia y `update-ref` de continuidad** | `crates/git/src/lib.rs:575-673` (guarda `:589-596`, CLI + `update-ref` `:617-638`, libgit2 sin checkout `:640-671`); endpoint `crates/server/src/routes/workspaces/git.rs:179-266` | 🟡 2d | 🔴 P0 | 🆕 Pendiente | Ego **no tiene merge**: grep `rebase\|squash\|merge_changes` sobre `packages/` → 0 hits (solo la regex de `packages/decision/src/IntentClassifier.ts:166`). `SubEgoWorktree.finalizeWorktree` (`packages/subegos/src/SubEgoWorktree.ts:249-258`) preserva el worktree «para revisión HITL» cuando hay commits o cambios, pero **no integra nada**. La pieza de mayor valor es el `update-ref` de continuidad (`:630-636`, `:660-668`): tras el squash la rama de la tarea se mueve al commit fusionado para que el turno siguiente continúe sin conflictos. **Cableado:** `packages/domains/src/engineering/GitMergeService.ts` con `mergeSquash()` que reusa `validateBranchName`/`assertInsideRoot` (`packages/domains/src/engineering/WorktreeManager.ts:33-118`), rechace si la rama base avanzó (mismo criterio `ahead/behind`) e invoque desde `finalizeWorktree` solo tras aprobación HITL del `ApprovalEngine`. | Ego: `DOM-01`, `SUB-08`, `SEC-05` · Ver: `docs/extractions/vibe-kanban.md` §Bloque C | `VIBE-01` |
| `VIBE-04` | 🟠 Alta | **Rebase con guardas de seguridad y error de conflicto accionable** | `crates/git/src/lib.rs:1129-1223` (worktree limpio `:1143`, rebase en curso `:1148-1150`, `MergeConflicts` con ficheros `:1169-1206`); `reconcile_worktree_to_commit` `:892-929` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | Sin rebase en `packages/`. Se propone `rebaseOnto()` en el **mismo módulo que `VIBE-03`** con tres guardas fail-closed: (a) no operar sobre worktree sucio; (b) **rechazar** si ya hay un rebase en curso en lugar de abortarlo — abortar podría destruir trabajo del usuario a mitad de rebase; (c) traducir el conflicto de la CLI a un error tipado `MergeConflicts` con rama intentada y lista de ficheros (Vibe limita la lista a 10 con contador). Reutiliza `validateBranchName` como validación de entrada. **Cableado:** mismo fichero `GitMergeService.ts`, invocado cuando el Sub-Ego reanuda sobre una base movida. | Ego: `DOM-01`, `SUB-08` · Ver: `docs/extractions/vibe-kanban.md` §Bloque C | `VIBE-03` |
| `VIBE-05` | 🔴 Crítica | **Ciclo de vida del proceso de agente: spawn con timeout de arranque, monitor de salida unificado, cancelación en dos fases y kill de grupo** | `crates/local-deployment/src/container.rs:1369-1403` (spawn con timeout 30 s), `:1405-1477` (`stop_execution`: token → 5 s → kill), `:1603-1633` (kill de todos al apagar); `crates/executors/src/executors/mod.rs:313-339` (`SpawnedChild`), `:55-64`, `:177-200` (capacidades); `crates/utils/src/process.rs:5-31` (SIGINT→SIGTERM→SIGKILL) | 🔴 3d | 🔴 P0 | 🆕 Pendiente | Ego solo aborta tools in-process: `packages/execution/src/ExecutionManager.ts:131-145` (`abortExecution`/`abortAll`) y timeout por llamada (`:246`). **No existe runner de agente CLI externo** (grep `claude-code\|codex` en `packages/` → 0 hits funcionales) ni supervisor de grupo de procesos: `packages/tools/src/native/terminal/NativeTerminalTool.ts:97` hace `spawn` del shell sin grupo supervisado, por lo que los hijos MCP grandchildren sobreviven al cierre. La separación de Vibe (`exit_signal` executor→contenedor vs `cancel` contenedor→executor) evita la condición de carrera entre «el proceso terminó» y «el usuario canceló». **Cableado:** `packages/execution/src/AgentProcessRunner.ts` con `spawn`/`await`/`kill`, timeout de arranque, monitor de salida y kill de árbol en win32 (`taskkill /T /F`); invocar desde `packages/subegos/src/SubEgoRuntime.ts`. | Ego: `SUB-03`, `SUB-12`, `ACT-03`, `TASK-09` · Ver: `docs/extractions/vibe-kanban.md` §Bloque B | — |
| `VIBE-06` | 🟠 Alta | **Puente de aprobación HITL hacia el ejecutor externo (create → espera bloqueante con cancelación)** | `crates/executors/src/approvals.rs:29-55` (contrato), `:56-91` (noop); `crates/services/src/services/approvals/executor_approvals.rs:40-98` (create + waiter + notificación), `:100-127` (`select!` cancelación), `:130-170` (mapeo de outcome) | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | El **núcleo ya existe** en `packages/execution/src/ApprovalEngine.ts:111-340` (retención asíncrona de promesas con ACK en el borde, timeout, `abortSignal` que cancela la aprobación, `ActionIdentity` inmutable). Falta el **adaptador**: un `AgentApprovalBridge` que traduzca el contrato del runner externo al motor de aprobación, con un único waiter por `approval_id` y `tokio::select!`-equivalente (`Promise.race` con el `AbortSignal`) para que cancelar la ejecución cancele la aprobación en cascada. **Cableado:** `packages/execution/src/AgentApprovalBridge.ts`, invocado por `AgentProcessRunner` al traducir la salida del agente; notificar vía `packages/tasks/src/TaskNotifications.ts`. | Ego: `ACT-06`, `ACT-07`, `INT-05`, `SUB-03` · Ver: `docs/extractions/vibe-kanban.md` §Bloque B | `VIBE-05` |
| `VIBE-07` | 🟠 Alta | **Bus de eventos derivado de hooks de escritura de la BD (snapshot inicial + parches incrementales)** | `crates/services/src/services/events.rs:59-313` (`preupdate_hook` para `DELETE` con clave compuesta, `update_hook` para `INSERT`/`UPDATE`/`DELETE`), `crates/services/src/services/events/streams.rs:16-145` (snapshot + `Ready` + filtro por `session_id`), `crates/utils/src/msg_store.rs:13`, `:26-72` (broadcast con historia acotada a 100 MB) | 🔴 3d | 🔵 P3 | ⏳ Futura (Fase 07, P1) | La idea (la BD es la única fuente de verdad y el bus se **deriva** de ella, sin emisiones manuales que puedan desincronizarse) es la mejor del repo, pero exige **hooks de escritura** en el sustrato: `NativeVantaDB` (napi-rs) no los expone y `EgoMemoryAdapter` (`packages/memory/EgoMemoryAdapter.ts`) no tiene hook de escritura. El bus actual de Ego (`packages/events/src/EventBus.ts:81-89`) es de emisión explícita y no hay ningún mecanismo de parches (grep `json-patch\|applyPatch\|JSONPatch` sobre `packages/` → 0 hits). **Fase destino: Fase 07 (Tasks), P1**, y previamente requiere una entrada `VDB-REQ-*` en `docs/engineering/vantadb-readiness-plan.md` (evolución upstream de VantaDB) — por eso no es `🆕 Pendiente`. **Alternativa degradada sin hooks:** derivar el stream del log de auditoría ya existente (`packages/memory/EgoMemoryAdapter.ts:1321,1340` → `gov/audit`; `packages/knowledge/src/FactLifecycle.ts:308` → `kb/audit`), lo que daría un bus derivado de la persistencia a coste cero de motor. | Ego: `TASK-06`, `TASK-01`, `CANV-03` · Ver: `docs/extractions/vibe-kanban.md` §Bloque C | — |
| `VIBE-08` | 🟠 Alta | **Reconciliación de estado persistido vs. runtime al arrancar (procesos huérfanos + backfill)** | `crates/services/src/services/container.rs:273-326` (`cleanup_orphan_executions`), `:333-378` (`backfill_before_head_commits`); `crates/server/src/startup.rs:155-171` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | `packages/recovery/src/CrashRecoveryEngine.ts:18-226` detecta *dirty shutdown* por heartbeat, verifica el WAL y libera locks (`checkAndAcquireLock` `:72`, `releaseLock` `:208`), pero **no reconcilia tareas en vuelo** contra el estado persistido: no hay equivalente a «la BD dice `Running` pero el proceso ya no existe» porque `packages/tasks/src/TaskCheckpoint.ts:28-65` guarda checkpoints sin barrido posterior. La captura del `after_head_commit` real (Vibe `:297-321`) es el patrón transferable: al reconciliar, **leer el estado real del disco y escribirlo**, no solo corregir el flag. **Cableado:** en el arranque de `packages/tasks/src/BackgroundEngine.ts`, marcar `failed` toda tarea cuyo último checkpoint no tenga cierre y purgar worktrees cuyo Sub-Ego ya no exista en `gov/sub_egos`; registrar el evento en `packages/events/src/EventBus.ts` para que la UI lo muestre. | Ego: `TASK-01`, `TASK-03`, `REC-01`, `REC-08` · Ver: `docs/extractions/vibe-kanban.md` §Bloque C | `VIBE-01` |

---

## 3. Matriz de Integración con el Backlog Maestro ##

Cada compuerta `VIBE-*` es un **pre-requisito de diseño y código** de las fases del Backlog Maestro
(`docs/roadmap/Backlog.md`). Ninguna puede ejecutarse al margen de su fase.

```text
   VIBE-01 ──> SUB-07 / SUB-08 / DOM-01 ──┐
   VIBE-03 ──> DOM-01 / SEC-05 ───────────┤──> FASE 03 · SUB-EGOS
   VIBE-04 ──> DOM-01 (depende de 03) ────┤     (aislamiento real + integracion)
   VIBE-05 ──> SUB-03 / ACT-03 / TASK-09 ─┤
   VIBE-06 ──> ACT-06 / INT-05 (depende 05)┘

   VIBE-08 ──> TASK-01 / TASK-03 / REC-01 ───> FASE 07 + FASE 10
   VIBE-07 ──> TASK-06 ──> [VDB-REQ-*] ─────> FASE 07 (P1, diferido)

   VIBE-02 ──> ya cubierto por SubEgoWorktree.pruneOrphanWorktrees (sin trabajo nuevo)
```

### Protocolo de ejecución por compuerta ###

1. **Lectura y aislamiento:** inspeccionar el fichero fuente citado en la columna «Archivo Vibe Kanban» y
   listar sus dependencias externas.
2. **Reescritura canónica:** reescribir en TypeScript estricto dentro de `packages/` o `apps/desktop/`,
   reutilizando los módulos de Ego ya existentes (`WorktreeManager`, `SubEgoWorktreeManager`,
   `ApprovalEngine`, `ExecutionManager`) en lugar de crear primitivas duplicadas (principio D3,
   `AGENTS.md` §4).
3. **Verificación y cierre:** test unitario en el paquete correspondiente + verificación de caller en
   producción por grep sobre `packages/` + `apps/desktop/`; marcar `✅ Completada` solo con fichero **y**
   caller, `🚫 Descartada (con justificación)` si no aplica, o `🆕 Pendiente` con el cableado exacto y
   su responsable.

## 4. Deuda abierta derivada de esta verificación ##

| # | Ítem | Tipo | Owner | Bloqueante |
| --- | --- | --- | --- | --- |
| D1 | `VIBE-01`: los dos `createWorktree` de Ego (`packages/subegos/src/SubEgoWorktree.ts:139`, `packages/domains/src/engineering/WorktreeManager.ts:161`) **no tienen caller de producción**; el aislamiento de Sub-Egos está escrito pero no integrado | Código | DOM-01 / SUB-07 | No |
| D2 | `VIBE-03`/`VIBE-04`: Ego no tiene servicio de merge ni rebase; el resultado del Sub-Ego se preserva para revisión manual sin mecanismo de integración | Código | DOM-01 | No |
| D3 | `VIBE-07`: `NativeVantaDB` no expone hooks de escritura → el bus derivado de la persistencia no es implementable sin evolución upstream de VantaDB (`VDB-REQ-*`) | Requisito upstream | Owner VantaDB | Sí (para VIBE-07) |
| D4 | `VIBE-05`/`VIBE-06`: no existe runner de agente CLI externo en `packages/`; sin él, la aprobación HITL solo cubre tools internas y no procesos de terceros | Capacidad | SUB-03 | No |
| D5 | `crates/tauri-app/`, `crates/remote/`, `crates/review/` y `crates/git-host/` dejan de estar en el radar de extracción; el repo inspeccionado (`v0.1.45`) es muy posterior al «Tauri + Rust» asumido en el encargo | Documentación | ness-e | No |
