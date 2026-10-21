# Handoff A5-ola4b — Extracción de repos de referencia — 2026-10-21

> **Agente:** A5 (persona `ego-docs`) · **Ola:** 4b
> **Plan:** `docs/agent-ops/plans/2026-10-19-remediation-wave1/A5-extraccion.md` (T1–T7)
> **Zona exclusiva:** `docs/extractions/**`, `docs/review/**`, `docs/research/{coucou,hermes-agent,openclaw}-deep-dive.md`
> **Hallazgos canónicos cubiertos:** `EGO-FIND-28` + `A5-01..A5-19`

---

## 1. Cambios aplicados (ficheros propios)

### 1.1 T1 — Los 21 patrones "asimilados sin caller", resueltos a estado terminal

Verificación por grep sobre `packages/` + `apps/desktop/` (excluye `test/`, `dist/`, `node_modules/`)
distinguiendo **import real** de **comentario** (los `Select-String` ingenuos contaban comentarios
como callers: eso produjo los falsos verdes de la Ola 1).

| ID | Módulo | Veredicto | Evidencia |
|---|---|:---:|---|
| `COUC-01` | `EventNormalizer` | 🚫 | Duplicado: el mapeo de tipos crudos (`PreToolUse`/`PostToolUse`/`SessionStart`) está en `packages/events/src/EventBus.ts:292-294` → `apps/desktop/src/main/ipc/register-ipc.ts`. `EventNormalizer.ts:35` sin caller. |
| `COUC-02` | `EventIngress` | 🚫 | Duplicado: la admisión no bloqueante está en `packages/events/src/EventBus.ts:368-390` (`evaluatePreToolUse` con kill-switch; `recordPostToolUse` nunca bloquea) → `register-ipc.ts`. `EventIngress.ts:45` sin caller. |
| `COUC-05` | `EgoStateStores` | 🚫 | **Retirado** (commit `41985ed`, "drop the unused stores"); `packages/ui-runtime/src/stores/` queda vacío. El particionado real lo dan `AttentionStateMachine` + `ApprovalEngine` + estado de runtime en `main.ts`. |
| `COUC-07` | `ChangeSetService` | 🚫 | `packages/tools/src/native/git/ChangeSetService.ts:56` sólo lo importa `packages/execution/src/SafeConfigMutation.ts:4`, y **`SafeConfigMutation` no tiene caller** (ver `COUC-10`): la cadena que declaraba la Ola 1 era un **comentario JSDoc** (`packages/integrations/src/mcp/McpManager.ts:85`). El diff en producción es `GitParser` → `NativeGitTool.ts`. |
| `COUC-08` | `PayloadRef` | ✅ | **Caller real**: `packages/ui-runtime/src/PayloadRef.ts:137` (`PayloadRegistry`) → `apps/desktop/src/main/mcp/mcp-server-runtime.ts:29` → `EgoMcpServer` (`packages/integrations/src/mcp/McpServer.ts:259,292`). |
| `COUC-09` | `RunRecorder` | ✅ | **Caller real**: `apps/desktop/src/main/state/app-context.ts:40` y `apps/desktop/src/main/window/create-window.ts:114,312`. |
| `COUC-10` | `SafeConfigMutation` | 🚫 | Sin caller: `McpManager.ts:85` y `McpClient.ts:97,217` son **comentarios**. La config MCP vive en VantaDB (`gov/mcp_servers`), no en fichero: no hay fichero que mutar. |
| `COUC-13` | `ResourcePolicy` | 🚫 | **Retirado** (commit `6a82b57`). La política viva es `packages/security/src/ToolPermissions.ts` + `packages/security/src/ssrfPolicy.ts`. |
| `COUC-14` | `SyntheticRuntime` | 🚫 | Sin caller; Ego no tiene modo demo (0 hits de `demoMode` en `apps/desktop/`). |
| `COUC-15` | `MockIPCBridge` | 🚫 | Sin caller; `installIfMissing()` (`:266`) no se invoca. El renderer usa el preload real. |
| `HERM-06` | `WindowsUserEnv` | 🚫 | Sin caller; 0 usos de `reg query`/`HKCU` en `apps/desktop/src/`. **Deuda real de Windows** → petición a A4. |
| `HERM-07` | `WindowsSandboxFallback` | 🚫 | Sin caller; 0 usos de `no-sandbox`/`STATUS_BREAKPOINT`. |
| `HERM-08` | `WindowStateHelper` | ✅ | **Caller real**: `apps/desktop/src/windows/WindowStateManager.ts:5` (import), `:305` (`resolveSafeBounds`), `:337` (`matchingWorkArea`). Cierra la divergencia de la Ola 1. |
| `HERM-12` | `SlashCommandParser` | 🚫 | **Retirado** (commit `41985ed`). El parser canónico es `apps/desktop/renderer/components/composer-slash.ts`. |
| `HERM-14` | `SessionTimelineRewind` | 🚫 | Sin caller; el fork de sesión en producción es `packages/memory/SessionFork.ts` → `apps/desktop/src/main/ipc/register-ipc.ts`. |
| `HERM-15` | `StorageHealthLatch` | ✅ | **Caller real**: `packages/recovery/src/CrashRecoveryEngine.ts:5` → `apps/desktop/src/main/state/app-context.ts` + `main.ts`. |
| `HERM-17` | `SubEgoWorktree` (aislamiento) | 🚫 | `createWorktree:139` / `finalizeWorktree:187` sin caller (sólo `EngineeringDomain.createWorktree`, que nadie invoca desde `apps/`). Sólo la limpieza (`pruneOrphanWorktrees:270` → `MemoryCleanupJob.ts:156`) está viva. |
| `HERM-18` | `ZeroContextKernel` | 🚫 | Sin caller; choca con el principio 6 (sin turnos de modelo no se puede sellar la `ActionIdentity` por tool call). |
| `KHOJ-04` | `FactExtractor` | 🚫 | Sin consumidor; la escritura de hechos en producción es `packages/domains/src/knowledge/KnowledgeDomain.ts:128,168` (`kb/facts`). |
| `KHOJ-05` | soft-replace de hechos | 🚫 | `consolidateMemories` (`packages/knowledge/src/FactLifecycle.ts:183`) sin callers de producción; `DreamConsolidator`/`MemoryCurator` nunca se instancian fuera de tests. |
| `HELM-03` | `TerminalSessionStore` | 🚫 | Sin caller; el hook `apps/desktop/renderer/hooks/useTerminalSession.ts:30` sólo se re-exporta. El estado real está en `TerminalOutputBuffer` + `NativeTerminalTool.ts`. |
| `CARP-01` | `DataContract` | 🚫 | Sin caller; la frontera viva es `packages/memory/SensitiveNamespaces.ts` + `QuarantineAwareReads.ts`. |
| `CARP-04` | `UntrustedContentSanitizer` | 🚫 | Sin caller; la cuarentena viva es `packages/knowledge/src/QuarantineManager.ts` → `apps/desktop/src/main/ipc/register-ipc.ts:388`. |
| `DSEK-01` | `supersedeFact` | 🚫 | Escritura no alcanzable: `supersedeFact` (`FactLifecycle.ts:117`) sólo se invoca desde `consolidateMemories` (`:183`), sin callers de producción. `EgoMemoryAdapter.supersedeFact` (`:892`) tampoco. |
| `DSEK-02` | `getVersionHistory` / `getAtTimestamp` | 🚫 | Sin caller; las queries bitemporales en producción son `packages/knowledge/src/BitemporalQueries.ts`. |
| `DSEK-03` | `OpaqueId` | 🚫 | `generateOpaqueId` (`packages/memory/OpaqueId.ts:30`) sólo lo usa `SessionCheckpointPolicy.ts:155`, que tampoco está cableada. Los `sessionId` en producción son cadenas libres (`apps/desktop/src/ipc/schema.ts:712`). |
| `DSEK-04` | `SchemaMigrator` | ✅ | **Caller real**: `packages/recovery/src/ProjectImport.ts:16` (import) al importar un `.vdbdump`. |
| `DSEK-05` | `SessionCheckpointPolicy` | 🚫 | Sin caller: `packages/dailystate/src/DailyStatePersistence.ts:138` es un **comentario**, no un import. La frontera real es `packages/security/src/ToolPermissions.ts` (`evaluateToolCall` → `register-ipc.ts`). |
| `OCLW-06` | `TranscriptReadWindow` | 🚫 | Sin caller; la lectura real va por `EgoMemoryAdapter` + `SessionRetention.ts`. |
| `OCLW-07` | `SessionDiffRevisions` | ✅ | **Caller real**: `packages/tools/src/native/git/NativeGitTool.ts:8` → `packages/tools/src/native/index.ts:39` → `apps/desktop/src/main.ts:3086`. |
| `OCLW-09` | `NetPolicy` | ✅ | **Unificado** en `packages/security/src/ssrfPolicy.ts` ← `ToolPermissions.ts:23,310` ← `register-ipc.ts` (`evaluateToolCall`). El `packages/tools/src/native/security/NetPolicy.ts` es reexport puro. |
| `OCLW-11` | `MermaidRenderer` | ✅ | **Caller real**: `packages/ui-runtime/src/MermaidComponent.ts:2` + registro en `apps/desktop/renderer/components/canvas/registry.ts:79-84` (`MermaidView`). |
| `OCLW-13` | `ProcessSupervisor` | 🚫 | Sin caller; la recuperación real es `CrashRecoveryEngine` + `OpGate` → `apps/desktop/src/main/state/app-context.ts`. |
| `OCLW-21` | `SubEgoWorktree` (aislamiento) | 🚫 | Asimilado a medias y desconectado (mismo patrón que `HERM-17`). |

**Resultado:** de los 21, **6 pasan a `✅ Completada`** (COUC-08, COUC-09, HERM-08, HERM-15, DSEK-04,
OCLW-07, OCLW-11 — 7 contando `OCLW-09` que ya lo estaba) y **el resto a `🚫 Descartada (con justificación)`**.
Cero filas quedan como "asimilado sin caller" sin veredicto.

### 1.2 Ficheros modificados

| Fichero | Cambio |
|---|---|
| `docs/review/backlog-{coucou,hermes-agent,khoj,helmor,career-ops,deepseek-harness,openclaw}.md` | Estado + descripción de las 33 filas resueltas; recuento declarado recalculado sobre las filas reales. |
| `docs/extractions/{coucou,hermes-agent,khoj,helmor,career-ops,deepseek-harness,openclaw}.md` | Misma matriz "Estado real verificado" sincronizada con su backlog (el gate `audit-extraction-gates.mjs` exige el mismo conjunto de IDs y el mismo recuento en ambos). |
| `docs/extractions/coucou.md` §52.4 | Residuos de Mochi re-verificados (el listado de la Ola 2 estaba desactualizado: `overlays.js` ya está limpio y han aparecido `rig/eyes.js` y `rig/hands.js`). Distinción explícita Mochi vs. `agent-robot-avatar` (upstream distinto, atribución legítima). |
| `docs/extractions/README.md` §4.1 · §4.3 | Tabla maestra con los recuentos reales; §4.3 actualizada (LICENSE.md **ya existe**, 16 cabeceras `Adapted from`, 9 residuos de etiquetado). |
| `docs/review/README.md` | Recuentos por repo + total sincronizados. |
| `docs/research/{coucou,hermes-agent,openclaw}-deep-dive.md` | Revisados: su contenido (§Pilar 1..4, §RFC-01..05) es consistente con los veredictos; no han requerido cambios. |

### 1.3 T3 — Auditoría de las 18 fichas nuevas: **todas aguantan**

| Comprobación | Resultado |
|---|---|
| (a) ¿el repo existe en `repos-referencia/`? | **18/18** ✅ |
| (b) ¿el commit/licencia citado coincide con el clon real? | **18/18** ✅ — el commit citado en la línea 6 de cada ficha (`Commit verificado: <hash>`) **coincide con `git rev-parse HEAD` del clon**; la licencia citada coincide con el fichero `LICENSE` real en los 18. |
| (c) ¿tienen ≥1 decisión de descarte con fundamento? | **18/18** ✅ — 29 filas `🚫 Descartada` en total, **29/29 con fundamento** (>60 caracteres de justificación, no relleno). |
| (d) ¿alguna fila "Completada" sin caller? | **0** ✅ — las 7 filas `✅ Completada` (gemini-cli 2, claude-squad 1, mem0 2, mcp-servers 2) citan todas `archivo:línea` de un caller real. |
| (e) ¿IDs únicos y correlativos? | **18/18** ✅ (lo confirma `audit-extraction-gates.mjs`: 0 huecos, 0 duplicados). |

**Ninguna de las 18 fichas necesita reescritura.** Las 2 repos clonados sin ficha siguen siendo
`avatar` y `agent-robot-avatar` (upstream del motor de personaje, no compuertas de extracción): no
tienen backlog ni ficha por diseño — el motor de avatar se gobierna por `CHAR-*` en el Backlog Maestro.

### 1.4 T4 — Test del atributo `hands`: anotado, **no tocado**

`packages/avatar/tests/hands-attribute.test.js` existe y documenta la ruta del atributo `hands`
(`always`/`auto`/`hidden`) y el reinicio intencionado de `handsMode` en `applyPreset`. Es **zona de A6**
(`packages/avatar/**`): A5 no lo ha modificado. Queda anotado aquí para que A6 lo confirme en su cierre.

---

## 2. Solicitudes fuera de zona (NO aplicadas)

### 2.1 Para A7 — `scripts/**` (dueño de `scripts/sync-extraction-indexes.mjs`)

| # | Fichero | Cambio pedido | Motivo |
|---|---|---|---|
| **A5-S1** | `scripts/sync-extraction-indexes.mjs` → tabla `CATALOG` | Actualizar los recuentos de las 7 filas heredadas con estos valores exactos (los demás campos no cambian):<br>`hermes-agent` → 30, **16**, **7**, **0**, 7, "7.5"<br>`openclaw` → 24, **9**, **8**, **6**, 1, "6.0"<br>`coucou` → 29, **12**, **12**, **4**, 1, "6.5"<br>`khoj` → 13, **3**, **3**, **0**, 7, "7.0"<br>`helmor` → 10, **4**, **1**, **5**, 0, "7.5"<br>`career-ops` → 8, 2, 3, 2, 1, "6.0"<br>`deepseek-harness` → 12, **1**, **4**, **3**, 4, "6.5"<br>El total agregado pasa de **289 · ✅47 · 🚫51 · 🆕157 · ⏳34** a **289 · ✅54 · 🚫71 · 🆕130 · ⏳34**. | `CATALOG` es la **fuente única** de los tres índices. A5 ya actualizó a mano `docs/extractions/README.md` y `docs/review/README.md` con esos números (para que los recuentos cuadren ya), pero mientras `CATALOG` no se actualice, la próxima ejecución de `node scripts/sync-extraction-indexes.mjs` **revertirá** ambos ficheros. Con este parche, el script reproduce exactamente lo que A5 dejó escrito. |
| **A5-S2** | `scripts/sync-extraction-indexes.mjs` (texto del bloque §3.1) | El texto generado afirma: *"Todos son repositorios nuevos: ninguno tiene hallazgos en estado `✅ Completada` por asilación propia (el `0 ✅` de cada repo nuevo es correcto…)"*. Es **falso**: `gemini-cli` (2), `claude-squad` (1), `mem0` (2) y `mcp-servers` (2) sí tienen `✅ Completada` con caller real. | Afirmación incorrecta en un doc canonico. |
| **A5-S3** | `scripts/audit-extraction-gates.mjs` | El gate **no comprueba que una fila `✅ Completada` tenga caller de producción** (sólo que el estado sea una de las 4 formas canónicas). Fue justo ese hueco el que dejó pasar 2 falsos verdes (`OCLW-16`/`OCLW-17`, ficheros inexistentes) y 11 "completadas" cuya cadena de callers era un comentario. | El gate actual valida coherencia formal, no veracidad material. A5 lo verificó a mano para las 81 filas de los 7 repos heredados (y las 18 fichas nuevas), pero la comprobación no está automatizada. |

> Nota: A5 **no ha ejecutado** `node scripts/sync-extraction-indexes.mjs` (habría sobrescrito los índices
> con el `CATALOG` viejo). Los recuentos de los dos README de A5 se han escrito a mano **en el formato
> exacto que el script genera**, de modo que con A5-S1 aplicado la salida del script es idempotente.

### 2.2 Para A1 — `docs/roadmap/Backlog.md` (zona de A1)

| # | Fichero | Cambio pedido | Motivo |
|---|---|---|---|
| **A5-S4** | `docs/roadmap/Backlog.md:41-47` (bloque de compuertas) | Los **recuentos ya cuadran** (A1 los reconcilió con el `CATALOG` de A7: 30/24/29/13/10/8/12 + los 18 nuevos = 289). Sólo quedan **3 correcciones de texto**:<br>• línea de `openclaw`: quitar **"hot-reloading de tools y file watcher"** (ambos están `🚫 Descartada`) y escribir **"checkpoints post-crash"**.<br>• línea de `helmor`: **"coalescencia de ráfagas terminales"** → **"coalescencia 16 KB/tick + ring-buffer 2 MB sobre pipes (sin PTY: `node-pty` no está en el workspace)"**.<br>• línea de `khoj`: **"filtrado de confianza coseno"** → **"filtrado por umbral de similitud (`ScoreThresholdFilter`)"**. | Son afirmaciones materiales falsas o que anuncian capacidades descartadas. |
| **A5-S5** | `docs/roadmap/Backlog.md` (tabla de compuertas de extracción) | Si alguna fila `OCLW-16`/`OCLW-17` aparece como asimilada, marcarla **`🚫 Descartada (con justificación)`** con el motivo de `docs/review/backlog-openclaw.md`. | Eran los 2 falsos verdes de `EGO-FIND-28`. |

> `docs/roadmap/Backlog.md` es de A1: A5 no lo ha tocado. `scripts/sync-extraction-indexes.mjs` (A7)
> también reescribe ese bloque; con A5-S1 aplicado y A5-S4 aplicado a mano, ambos coinciden.

### 2.3 Para A2 — `packages/{memory,knowledge,runtime,events,execution}/**`

| # | Fichero | Cambio pedido | Motivo |
|---|---|---|---|
| **A5-S6** | `packages/knowledge/src/FactLifecycle.ts` | Invocar `FactExtractor` (`packages/knowledge/src/extractors/FactExtractor.ts:62`) en `consolidateMemories` como paso previo a `supersedeFact` — **o** retirar el extractor. | `KHOJ-04`: módulo implementado y probado, **0 consumidores**. |
| **A5-S7** | `packages/memory/SessionTimelineRewind.ts` / `packages/memory/TranscriptReadWindow.ts` | Exponer el rewind desde el IPC de sesión (`ipc.session.fork` / `ipc.session.resume`, ya en `apps/desktop/src/ipc/schema.ts`) y usar la ventana de lectura al listar turnos — **o** retirar ambos módulos. | `HERM-14` / `OCLW-06`: código muerto frente a `SessionFork` y `EgoMemoryAdapter`. |
| **A5-S8** | `packages/memory/EgoMemoryAdapter.ts:892,986,1048` | `supersedeFact`, `getVersionHistory` y `getAtTimestamp` **no tienen caller**: o delegar desde `packages/knowledge/src/BitemporalQueries.ts`, o retirarlos. | `DSEK-01` / `DSEK-02`: son la *siguiente* implementación duplicada de lo que ya vive en `@ego/knowledge`. |
| **A5-S9** | `packages/memory/OpaqueId.ts` + `apps/desktop/src/ipc/schema.ts:712` | Acuñar el `sessionId` con `generateOpaqueId("sess")` en el alta de sesión y en el esquema IPC — **o** retirar `OpaqueId.ts` y `SessionCheckpointPolicy.ts`. | `DSEK-03` / `DSEK-05`: en producción los `sessionId` son cadenas libres con fallback literal `"default_session"`. |
| **A5-S10** | `packages/memory/UntrustedContentSanitizer.ts`, `packages/memory/DataContract.ts` | Retirar o cablear: la frontera User-vs-System y la cuarentena ya las implementan `packages/memory/SensitiveNamespaces.ts` y `packages/knowledge/src/QuarantineManager.ts`. | `CARP-01` / `CARP-04`: módulos sin caller con una segunda taxonomía de namespaces. |
| **A5-S11** | `packages/events/src/ToolNormalizer`/`EventNormalizer.ts` + `EventIngress.ts` | Retirar o documentar como duplicados del `EventBus` (`packages/events/src/EventBus.ts:292-294` y `:368-390`). | `COUC-01` / `COUC-02`. |

### 2.4 Para A3 — `packages/{tools,recovery,tasks,subegos}/**`

| # | Fichero | Cambio pedido | Motivo |
|---|---|---|---|
| **A5-S12** | `packages/tools/src/native/security/NetPolicy.ts` | Consolidar la política SSRF: el canónico ya está en `packages/security/src/ssrfPolicy.ts` y `packages/tools/.../NetPolicy.ts` es reexport puro. Decidir si se borra el módulo o se deja como fachada. | `OCLW-09` — resuelto en la ficha, pendiente la limpieza de código. |
| **A5-S13** | `packages/tools/src/native/fs/ResourcePolicy.ts` (retirado) + `packages/ui-runtime/src/stores/` (vacío) | Ninguno existe ya. Confirmar que no queda ninguna referencia ni directorio vacío. | `COUC-13` / `COUC-05`. |
| **A5-S14** | `packages/recovery/src/ProcessSupervisor.ts`, `packages/recovery/src/WindowsUserEnv.ts`, `packages/recovery/src/WindowsSandboxFallback.ts`, `packages/recovery/src/StorageHealthLatch.ts` | `ProcessSupervisor`, `WindowsUserEnv` y `WindowsSandboxFallback` **no tienen caller** (`StorageHealthLatch` sí: `CrashRecoveryEngine.ts:5`). Retirar los tres o cablearlos donde corresponda. | `OCLW-13` / `HERM-06` / `HERM-07`. |
| **A5-S15** | `packages/subegos/src/SubEgoWorktree.ts` | `createWorktree:139` y `finalizeWorktree:187` sin caller: cablear en la ruta de delegación de Sub-Egos (A2/A4) o retirar. | `HERM-17` / `OCLW-21`. |
| **A5-S16** | `packages/ui-runtime/src/SlashCommandParser.ts` (retirado), `packages/ui-runtime/src/PayloadRef.ts`, `packages/runtime/src/StructuredInput.ts`, `packages/execution/src/ZeroContextKernel.ts` | `PayloadRef` **sí** tiene caller (`PayloadRegistry` → `mcp-server-runtime.ts:29`): documentarlo en el README del paquete. `StructuredInput` y `ZeroContextKernel` no: retirar o justificar. | `HERM-12` / `OCLW-12` / `HERM-18`. |

### 2.5 Para A4 — `apps/desktop/**`

| # | Fichero | Cambio pedido | Motivo |
|---|---|---|---|
| **A5-S17** | `apps/desktop/src/main.ts` (arranque) | Invocar `WindowsUserEnv` **antes** de `app.whenReady()`: si la app se lanza desde el Explorador de Windows, `process.env.PATH` no incluye `%USERPROFILE%\AppData\Local` y las tools que invocan `git`/`npm` fallan. | `HERM-06` — **deuda de plataforma real**, no cosmética. |
| **A5-S18** | `apps/desktop/src/main.ts` (arranque) | Invocar `WindowsSandboxFallback` si Chromium falla con `STATUS_BREAKPOINT` (0x80000003). | `HERM-07`. |
| **A5-S19** | `apps/desktop/src/main.ts:395` (`pushTerminalOutput`) | Enrutar la salida del terminal IPC por `TerminalOutputBuffer` (16 KB/tick + ring-buffer 2 MB), como ya hace `NativeTerminalTool`. Hoy hay **doble camino de salida sin coalescer**. | `HELM-01`/`HELM-02`. |
| **A5-S20** | `apps/desktop/renderer/components/canvas/TerminalView.tsx` | Consumir el hook `useTerminalSession` (`apps/desktop/renderer/hooks/useTerminalSession.ts:30`), hoy sin consumidor. | `HELM-03`. |
| **A5-S21** | `apps/desktop/renderer/components/canvas/WorkbenchView.tsx:88` | Corregir la ruta obsoleta `packages/memory/src/SessionLifecycleLocks.ts` (ese directorio **no existe**; los ficheros están en la raíz del paquete). | Deriva de ruta que llega al renderer. |
| **A5-S22** | `apps/desktop/renderer/floating/upload-canvas.ts:649-654` | Unificar el contrato `ContextProvider` con el de `packages/tasks/src/ContextProvider.ts` (o retirar el del paquete). | `COUC-16`. |

### 2.6 Para A6 — `packages/avatar/**` + vendorizada

| # | Fichero | Cambio pedido | Motivo |
|---|---|---|---|
| **A5-S23** | `packages/avatar/src/{studio/render/visor.js:1, studio/render/particles.js:1, studio/rig/eyes.js:1, studio/rig/hands.js:2, studio/sound.js:1, core/timeline.js:2, runtime/poses.js:11}` | Normalizar las cabeceras que aún declaran *"puerto verbatim"* / *"PORTES VERBATIM"* del HTML de Mochi o de `coucou mochi/engine.ts`. | `D4` (sustituir por geometría propia) y convención de atribución. Detalle en `docs/extractions/coucou.md` §52.4. |
| **A5-S24** | `packages/avatar/src/runtime/avatar-element.js:2015` y `packages/avatar/src/studio/avatar.js:70` | Quitar la mención a `'coucou-mochi'` de los **comentarios** (el valor funcional ya no existe: el preset se eliminó de `config.js`/`applyPreset`). | Residuo de marca. |
| **A5-S25** | `packages/avatar/tests/hands-attribute.test.js` | Confirmar en el cierre de A6 que el test del atributo `hands` (`always`/`auto`/`hidden`) y el reinicio de `handsMode` en `applyPreset` están cubiertos. | Ítem 1.1 del otro agente (T4): A5 no lo ha tocado por ser zona de A6. |

---

## 3. Verificación

| Comando | Exit | Resumen |
|---|---|---|
| `node scripts/audit-extraction-gates.mjs` | **0** | 25 repos · 289 tareas · **0 filas en el limbo** · recuentos coherentes entre ficha y backlog. Agregado: **✅54 · 🚫71 · 🆕130 · ⏳34**. |
| `node docs/testing/check-docs-paths.mjs --quiet` | **0** | 0 enlaces rotos · 0 rutas inexistentes en docs canónicos. |
| `node scripts/verify-vantadb-ids.mjs` | **0** | 0 errores · 3 avisos (VDB-REQ-08/09/14, preexistentes, no bloquean). |
| `node scripts/check-docs-lint.mjs` | **1** | **10 regresiones, 0 ellas mías**: las 10 están en `handoff/A3-ola4b.md` y `handoff/A4-ola4b.md` (MD040/MD004/MD032/MD029/MD013/MD031). Ningún fichero de A5 añade violaciones. **No lo he arreglado: no es mi zona** → A3/A4. |
| Verificación de caller (grep con detección de import real vs. comentario) | — | 33 patrones re-verificados sobre `packages/` + `apps/desktop/` (excluye `test/`, `dist/`, `node_modules/`). |
| Recuento programático de filas y estados en los 7 backlogs heredados | — | 126 filas: **47 ✅ · 38 🚫 · 20 🆕 · 21 ⏳** · 0 sin clasificar · 0 filas con celdas mal formadas. |
| Coherencia ficha ↔ backlog | — | Los 7 pares tienen **el mismo conjunto de IDs** y el mismo recuento (lo exige el gate de A7). |
| Barrido de contaminación de dominio (post A2/A3) | — | 0 coincidencias de ATS / vacantes / candidatura / CV / salario / portales / `gte-small` / Twilio / Stripe / SMTP en `packages/` y `apps/`. **LIMPIO.** |
| T3: commit + licencia de las 18 fichas nuevas vs. clon real | — | 18/18 commits coinciden con `git rev-parse HEAD`; 18/18 licencias coinciden con el `LICENSE` real. |

---

## 4. Deuda / no resuelto

1. **`scripts/sync-extraction-indexes.mjs` sigue con el `CATALOG` viejo** (A5-S1). Mientras no se
   actualice, **la próxima ejecución del script revierte los dos README de A5**. A5 dejó los números
   correctos escritos a mano y en el formato exacto que el script genera, pero la fuente de verdad
   es el `CATALOG`, que es de A7. **Es el punto más urgente del handoff.**
2. **12 módulos asimilados sin caller quedan como código muerto** en el repo: `EventNormalizer`,
   `EventIngress`, `ChangeSetService`/`SafeConfigMutation`, `SyntheticRuntime`, `MockIPCBridge`,
   `SessionTimelineRewind`, `TranscriptReadWindow`, `DataContract`, `UntrustedContentSanitizer`,
   `StructuredInput`, `ZeroContextKernel`, `ProcessSupervisor`, `WindowsUserEnv`,
   `WindowsSandboxFallback`, `OpaqueId`/`SessionCheckpointPolicy`, `getVersionHistory`/`getAtTimestamp`.
   Cada uno tiene su petición de retirada o de cableado en §2.3–2.5. Son **deuda de código, no de
   documentación**: el backlog ya no dice que estén integrados.
3. **HERM-06 (PATH de Windows) es una deuda de plataforma real**, no de documentación: si Ego se
   lanza desde el Explorador, las tools que invocan `git`/`npm` fallan. Petición a A4 (A5-S17).
4. **El gate `audit-extraction-gates.mjs` no valida que un `✅ Completada` tenga caller** (A5-S3).
   While no se automate, la verificación material depende de que A5 la haga a mano en cada ola.
5. **`check-docs-lint.mjs` falla globalmente** por 10 regresiones en los handoffs de A3 y A4. No es
   de A5; no lo he tocado.
6. **9 residuos de etiquetado "verbatim"/"coucou-mochi"** en `packages/avatar/src/**` (A5-S23, A5-S24),
   más el item 1.1 (`hands-attribute.test.js`) pendiente de confirmación por A6 (A5-S25).
7. **Las 20 filas `🆕 Pendiente` que quedan en los 7 repos heredados** NO son de T1: son hallazgos
   *aún no asimilados* de las olas 2/3 (p. ej. `OCLW-19..24` — detección de ausencia de progreso,
   cuarentena de tool por schema, carreras con `AbortSignal`, compactación adaptativa, reparación de
   `tool_result` huérfanos). Quedan en `🆕 Pendiente` con owner, que es un **estado canónico**
   (no limbo) según el gate de A7. Re-verificar en Ola 2 que ninguna se convierta en falso verde.
