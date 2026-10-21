# Handoff A5-ola5 — Extracción de repos de referencia — 2026-10-21

> **Agente:** A5 (persona `ego-docs`) · **Ola:** 5
> **Plan:** `docs/agent-ops/plans/2026-10-19-remediation-wave1/A5-extraccion.md`
> **Handoff previo:** [`A5-ola4b.md`](A5-ola4b.md)
> **Zona exclusiva:** `docs/extractions/**`, `docs/review/**`
> **Fuera de zona (no tocado):** `docs/{adr,roadmap,agent-ops,research,index}/**` (A1/A8), `packages/**` (A2/A3), `apps/**` (A4/A6), raíz y `scripts/**` (A7)

---

## 1. Cambios aplicados (ficheros propios)

### 1.1 T1 — Las 20 filas 🆕 de los 7 repos heredados: descripción precisa de qué falta

Verificadas una por una contra el código real (472 ficheros de producción; `node_modules/`, `dist/`,
`out/`, `test/` y `vendor/` excluidos; se exige **import real o invocación real**, no comentario).
**Ninguna de las 20 se había asimilado en las olas 2–4**: todas siguen en `🆕 Pendiente`, pero su
descripción pasa de "pendiente" a **qué falta exactamente, dónde y con qué criterio de aceptación**.

| ID | Repo | Qué falta (verificado 2026-10-21) | Owner |
|---|---|---|:---:|
| `COUC-24` | coucou | Preservar el `mode` del destino sobre el temporal antes del `rename`: `packages/tools/src/native/fs/NativeFsTool.ts` → 0 hits de `mode`/`chmod`/`0oNNN` (un `.env` en `0600` queda en `0644`). Igual en `packages/recovery/src/fsAsync.ts:51`. | A3 |
| `COUC-25` | coucou | El **productor** de la decisión de atención: 0 hits de `AttentionEvaluator`/`AttentionSignal`. Hoy `packages/runtime/src/AttentionStateMachine.ts:84` consume un `state`+`priority` decidido a mano en `apps/desktop/src/main.ts:555-582`. | A2 |
| `COUC-26` | coucou | `schedule` (cron), backoff, presupuesto de recursos, última ejecución exitosa y health por worker: `packages/tasks/src/BackgroundEngine.ts` → 0 hits (el `backoff` que existe es el del `ModelRouter`). | A3 |
| `COUC-28` | coucou | `ActionSummarizer` en el core: 0 hits. El flotante deriva el resumen del input crudo (`apps/desktop/renderer/floating/floating.tsx:210`) mientras main ya lo resuelve (`apps/desktop/src/main.ts:2547`). | A2 (+A4) |
| `HELM-06` | helmor | Flush por prefijo UTF-8 válido antes de la frontera IPC: 0 hits de `PTY_FLUSH`/`utf8Safe`/`validPrefix`. `TerminalOutputBuffer.ts` concatena y decodifica al final → puede partir un multibyte. | A3 |
| `HELM-07` | helmor | Inferencia de interrupción `ESC`/`ETX` en el backend con ventana de 500 ms: 0 hits de `INTERRUPT_SETTLE`/ETX. | A3 |
| `HELM-08` | helmor | Gate de arranque TUI + replay ANSI del prefijo descartado: 0 hits de `1049h`/`altScreen`/`replayAnsi`. | A3 (+A4) |
| `HELM-09` | helmor | Derivar *busy*/*idle* desde los hooks de ciclo de vida del CLI de agente. Los 8 hits de `setBusy*` en el renderer son `setBusyId` de React, sin relación. | A4 |
| `HELM-10` | helmor | Liberar el timer de drenado al desmontar: `apps/desktop/renderer/components/canvas/TerminalView.tsx` tiene `useEffect` (`:53`) pero **0 `clearTimeout`** → el `setTimeout(pump, 16)` sobrevive al desmontaje. | A4 |
| `CARP-05` | career-ops | Reintento de `rename` ante `EPERM`/`EACCES`/`EBUSY` con escala 1, 2, 5, 10, 25, 50, 100 ms. El tmp+rename **sí** está asimilado (`NativeFsTool.ts:164-184`, `fsAsync.ts:51`, `CrashRecoveryEngine.ts:59`); el único `EPERM` del repo (`CrashRecoveryEngine.ts:357`) es "proceso de otro usuario", no contención de fichero. | A3 |
| `CARP-06` | career-ops | La guarda fail-closed de catálogo vacío en `scripts/audit-extraction-gates.mjs`: 0 hits de `fichas.length === 0`. (El *roster derivado* ya está asimilado.) | A7 |
| `DSEK-09` | deepseek | El evento de corte `session/end-seed` y el conteo `inheritedEventCount`: `packages/memory/SessionFork.ts:81-82` sólo marca `forkedFrom`/`forkedAtMs` (2 hits de marcadores en el fichero). | A2 |
| `DSEK-10` | deepseek | Marca de tipo de compilación (`Branded<>`/`brandString`): 0 hits. Los IDs siguen siendo `string` sin distinción. | A2 |
| `DSEK-12` | deepseek | Retención acotada con metadatos exactos de omisión (`Omitted`/`ItemRetainer`/`TextRetainer`): 0 hits. | A2 |
| `OCLW-10` | openclaw | Asimilación **degradada**: `packages/tasks/src/WorkerTaskPool.ts:63` declara que **NO usa `node:worker_threads`** (el nombre canónico real es `LocalTaskPool`, `:70`); se instancia (`apps/desktop/src/main/window/create-window.ts:534`) pero `getWorkerTaskPool()` (`runtime-getters.ts:143`) tiene **0 llamadas**: nadie le despacha trabajo. El patrón de worker real ya existe en `packages/execution/src/ZeroContextKernel.ts:28`. | A3 |
| `OCLW-19` | openclaw | Detección de bucle por **no-progreso**: `packages/execution/src/CircuitBreaker.ts:15` cuenta fallos consecutivos; los 8 hits de `toolLoop` en `apps/desktop/src/main/` son el nombre de la variable `toolLoop`, no un detector. | A2 |
| `OCLW-20` | openclaw | Cuarentena de tools con schema no soportado: `packages/tools/src/ToolRegistry.ts:156` valida con Zod pero no aísla la tool. | A3 |
| `OCLW-22` | openclaw | Primitiva única de carrera con abort + timeout: `packages/execution/src/ExecutionManager.ts` → 0 hits de `race`/`Promise.race`. | A2 |
| `OCLW-23` | openclaw | Compactación adaptativa por chunks: `packages/runtime/src/ContextCompaction.ts:531` hace poda head/tail fija; 0 hits de `SAFETY_MARGIN`/chunked. | A2 |
| `OCLW-24` | openclaw | Reparación de `tool_use`↔`tool_result` huérfanos: 0 hits de `orphanTool`/`repairToolUse`/`stripToolResult`. | A2 |

### 1.2 Corrección de un veredicto propio (import real ≠ import de tipo)

> **`DSEK-04` (`SchemaMigrator`): `✅ Completada` → `🚫 Descartada (con justificación)`.**
> El veredicto de la Ola 4b era **incorrecto**: `packages/recovery/src/ProjectImport.ts:16` es un
> **`import type`** (sólo tipos) y la dependencia es **opcional**
> (`private readonly schemaMigrator?: SchemaMigrator`, `:31`). El único punto de instanciación es
> `packages/recovery/src/SnapshotManager.ts:100` (`new ProjectImport(this.adapter)`), que **no inyecta**
> ningún migrador → `if (this.schemaMigrator)` (`:181`) nunca es true y `SchemaMigrator.migrate()`
> **no se ejecuta jamás**. No hay ningún `new SchemaMigrator` en el repo.
> El patrón de migración aditiva **sí** está asimilado, pero en
> `ProjectImport` + `packages/knowledge/src/KnowledgeExport.ts` +
> `packages/memory/SensitiveNamespaces.ts`. `SchemaMigrator` es una **tercera** implementación,
> desconectada.
> **Regla vigente, ya escrita en `docs/review/README.md`:** un `import type`, un re-export o una
> mención en un comentario **no son caller**.

### 1.3 T2 — Inventario de código muerto publicado y rastreado en los backlogs

- **20 filas** de los 7 backlogs y sus 7 fichas llevan ahora la marca
  `**Codigo muerto:** modulo asimilado sin caller de produccion -> retirar. Zona duenosa: <@ego/x> (A<n>).`
- El inventario agregado (tabla de 20 módulos con fichero, patrón, veredicto, zona duenosa y owner)
  está publicado en **`docs/review/README.md`**, sección *"Código asimilado sin cablear — inventario
  agregado (2026-10-21, A5)"*, con el método de detección y la lista de módulos **que sí** tienen
  caller real (para que la Ola 6 no retire lo que está vivo).
- Detalle por módulo: ver §2.2.

### 1.4 T3 — Cadena de atribución

- **Las 18 fichas nuevas aguantan** (verificado por A5 en la Ola 4b y re-verificado el 2026-10-21):
  18/18 repos clonados existen, 18/18 commits citados coinciden con `git rev-parse HEAD` del clon,
  18/18 licencias citadas coinciden con el fichero de licencia real.
- **Atribución falsa: 0.** Barrido de las 51 filas `✅ Completada` de las 25 fichas: 43 citan ruta de
  Ego (`packages/`, `apps/desktop/`), 1 cita ruta de upstream **declarándolo como "Fuente:"** y
  afirmando que "Ego ya lo impone" (`HERM-29`, forma correcta), 7 citan rutas **relativas al
  renderer** (`renderer/components/...`, `ego-chat.tsx`) → no son rutas de upstream, pero sí son
  ambiguas para un verificador automático (ver solicitud a A7, comprobación 6).
- **Harness de verificación de procedencia**: especificación completa escrita en
  `docs/extractions/README.md` §4.4 (nombre, invocación, 6 comprobaciones, formato de salida) para
  que **A7** lo implemente en `scripts/verify-extraction-provenance.mjs`.
- **Estado real de la atribución del avatar** (A6, re-verificado por A5 el 2026-10-21) actualizado en
  `docs/extractions/README.md` §4.3 y `docs/extractions/coucou.md` §52.4:

| Elemento | Estado real |
|---|:---:|
| `packages/avatar/LICENSE.md` + `LICENSE` + `NOTICE` | ✅ existen (3 ficheros) |
| Cabeceras `Adapted from <upstream> (MIT), <ruta>` | ⚠️ **8 de 90** ficheros (las 8 en `src/studio/`). La cifra "16" de la Ola 4b contaba dos ocurrencias por fichero. |
| Residuos "verbatim"/"PORTES VERBATIM" | ⚠️ **9** ficheros: `src/core/timeline.js:2`, `src/render/ara-head.js:1`, `src/render/body.js:3`, `src/runtime/poses.js:11`, `src/studio/render/particles.js:1`, `src/studio/render/visor.js:1`, `src/studio/rig/eyes.js:1`, `src/studio/rig/hands.js:2`, `src/studio/sound.js:1` |
| Residuos `'coucou-mochi'` | ⚠️ **2**, ambos en **comentarios** (no funcionales): `src/runtime/avatar-element.js:2015`, `src/studio/avatar.js:70` |

### 1.5 Ficheros modificados

`docs/review/{README,backlog-coucou,backlog-hermes,backlog-khoj,backlog-helmor,backlog-career-ops,backlog-deepseek-harness,backlog-openclaw}.md` ·
`docs/extractions/{README,coucou,hermes-agent,openclaw,khoj,helmor,career-ops,deepseek-harness}.md`

Los 3 deep-dives (`docs/research/*-deep-dive.md`) se revisaron y **no requerían cambios**: su contenido
(§Pilar 1..4 de coucou, §RFC-01..05 de hermes, §RFC-OCLW-01..03 de openclaw) es consistente con los
veredictos de esta ola. `docs/research/` es zona de A8 en esta ola.

---

## 2. Solicitudes fuera de zona (NO aplicadas)

### 2.1 Para A7 — `scripts/**`

| # | Fichero | Cambio pedido | Motivo |
|---|---|---|---|
| **A5-S1** | `scripts/verify-extraction-provenance.mjs` (**nuevo**) | Implementar el harness descrito en `docs/extractions/README.md` §4.4: para cada ficha `docs/extractions/<slug>.md` comprobar (1) que existe `repos-referencia/<slug>/`; (2) que el commit citado en la línea `Commit verificado:` coincide con `git -C repos-referencia/<slug> rev-parse --short=7 HEAD`; (3) que la licencia citada coincide con el `LICENSE`/`LICENSE.md`/`NOTICE` del clon; (4) que la ruta `repos-referencia/<slug>/` citada existe; (5) que la ficha y su backlog comparten el mismo conjunto de IDs; (6) que ninguna fila `✅ Completada` atribuya a un upstream un patrón nativo de Ego (heurística: si la evidencia cita `repos-referencia/...`, debe citar también la ruta de Ego equivalente). Salida con el formato de `audit-extraction-gates.mjs`; **exit 1** ante cualquier discrepancia. | La procedencia (commit + licencia) de las 25 fichas es hoy una **afirmación manual** que sólo se re-verifica cuando A5 la vuelve a mirar. Sin harness, un `git pull` de un clon puede dejar la ficha citando un commit obsoleto sin que nada lo detecte. |
| **A5-S2** | `scripts/audit-extraction-gates.mjs` | Añadir la guarda fail-closed de catálogo vacío: antes del bucle `for (const ficha of fichas)`, `if (fichas.length === 0) { console.error("[audit-extraction-gates] catálogo de fichas vacío: la comprobación no puede mirar y debe fallar, no pasar"); process.exit(1); }` | Comprobación de compuerta que **no puede mirar** debe fallar, no pasar (es la clase de bug que documenta el propio original). Hoy `readdirSync(EXTRACTIONS)` con 0 entradas se reporta como "0 tareas". Fila `CARP-06`. |
| **A5-S3** | `scripts/sync-extraction-indexes.mjs` → tabla `CATALOG` | Actualizar los recuentos de las 7 filas heredadas (el resto de campos no cambia): `hermes-agent` → 30, **16**, **7**, **0**, 7 · `openclaw` → 24, **9**, **8**, **6**, 1 · `coucou` → 29, **12**, **12**, **4**, 1 · `khoj` → 13, **3**, **3**, **0**, 7 · `helmor` → 10, **4**, **1**, **5**, 0 · `career-ops` → 8, 2, 3, 2, 1 · `deepseek-harness` → 12, **0**, **5**, **3**, 4. Agregado: **289 · ✅53 · 🚫72 · 🆕130 · ⏳34**. | El `CATALOG` es la **fuente única** de los tres índices. A5 ya escribió los números correctos a mano en `docs/extractions/README.md` §4.1 y `docs/review/README.md` **en el formato exacto que el script genera**, de modo que con este parche la salida del script es idempotente; mientras no se aplique, la próxima ejecución del script **revertirá** ambos ficheros. **Es el punto más urgente del handoff.** |
| **A5-S4** | `scripts/sync-extraction-indexes.mjs` (texto del bloque §3.1) | El texto generado afirma: *"Todos son repositorios nuevos: ninguno tiene hallazgos en estado `✅ Completada` por asimilación propia (el `0 ✅` de cada repo nuevo es correcto…)"*. Es **falso**: `gemini-cli` (2), `claude-squad` (1), `mem0` (2) y `mcp-servers` (2) sí tienen `✅ Completada` con caller real. | Afirmación incorrecta en un doc canónico. |
| **A5-S5** | `scripts/audit-extraction-gates.mjs` | El gate **no comprueba que una fila `✅ Completada` tenga caller de producción**: sólo que el estado sea una de las 4 formas canónicas. Fue justo ese hueco el que dejó pasar 2 falsos verdes (`OCLW-16`/`OCLW-17`, ficheros inexistentes) y **3 "completadas" cuya cadena de callers eran comentarios JSDoc o un `import type`** (`COUC-07`/`COUC-10`/`DSEK-04`). | Automatizar la comprobación que A5 tiene que hacer a mano en cada ola (y que ya ha fallado dos veces). |

### 2.2 Para A2 — `packages/{memory,knowledge,runtime,events,execution}/**` (retirar código muerto)

| # | Módulo a retirar | Fichero | Patrón | Owner |
|---|---|---|---|:---:|
| **A5-S6** | `EventNormalizer` | `packages/events/src/EventNormalizer.ts:35` | `COUC-01` | A2 |
| **A5-S7** | `EventIngress` | `packages/events/src/EventIngress.ts:45` | `COUC-02` | A2 |
| **A5-S8** | `SafeConfigMutation` | `packages/execution/src/SafeConfigMutation.ts:25` | `COUC-10` | A2 |
| **A5-S9** | `SyntheticRuntime` | `packages/runtime/src/SyntheticRuntime.ts:17` | `COUC-14` | A2 |
| **A5-S10** | `SessionTimelineRewind` | `packages/memory/SessionTimelineRewind.ts` | `HERM-14` | A2 |
| **A5-S11** | `ZeroContextKernel` | `packages/execution/src/ZeroContextKernel.ts:165` | `HERM-18` | A2 |
| **A5-S12** | `DataContract` | `packages/memory/DataContract.ts:51` | `CARP-01` | A2 |
| **A5-S13** | `UntrustedContentSanitizer` | `packages/memory/UntrustedContentSanitizer.ts` | `CARP-04` | A2 |
| **A5-S14** | `SessionLifecycleLocks` | `packages/memory/SessionLifecycleLocks.ts:23` | `OCLW-05` | A2 |
| **A5-S15** | `TranscriptReadWindow` | `packages/memory/TranscriptReadWindow.ts:38` | `OCLW-06` | A2 |
| **A5-S16** | `StructuredInput` | `packages/runtime/src/StructuredInput.ts:62` | `OCLW-12` | A2 |
| **A5-S17** | `OpaqueId` + `SessionCheckpointPolicy` | `packages/memory/OpaqueId.ts:30`, `SessionCheckpointPolicy.ts:43` | `DSEK-03`, `DSEK-05` | A2 |
| **A5-S18** | `getVersionHistory` / `getAtTimestamp` | `packages/memory/EgoMemoryAdapter.ts:986` / `:1048` | `DSEK-02` | A2 |

> Nota: `OpaqueId`/`SessionCheckpointPolicy` no son código muerto "por accidente": son la
> **implementación de un patrón que Ego no aplica** (los `sessionId` en producción son cadenas
> libres — `apps/desktop/src/ipc/schema.ts:712`). Si el owner decide aplicar el patrón, el
> trabajo es **cablear**, no retirar: ver `DSEK-03`/`DSEK-05` en el backlog.

### 2.3 Para A3 — `packages/{tools,recovery,tasks,ui-runtime}/**`

| # | Módulo a retirar / corregir | Fichero | Patrón | Owner |
|---|---|---|---|:---:|
| **A5-S19** | `ChangeSetService` | `packages/tools/src/native/git/ChangeSetService.ts:56` | `COUC-07` | A3 |
| **A5-S20** | `MockIPCBridge` | `packages/ui-runtime/src/MockIPCBridge.ts:89` | `COUC-15` | A3 |
| **A5-S21** | `WindowsUserEnv` | `packages/recovery/src/WindowsUserEnv.ts` | `HERM-06` | A3 |
| **A5-S22** | `WindowsSandboxFallback` | `packages/recovery/src/WindowsSandboxFallback.ts` | `HERM-07` | A3 |
| **A5-S23** | `ProcessSupervisor` | `packages/recovery/src/ProcessSupervisor.ts:20` | `OCLW-13` | A3 |
| **A5-S24** | `SchemaMigrator` | `packages/recovery/src/SchemaMigrator.ts` | `DSEK-04` | A3 |
| **A5-S25** | `WorkerTaskPool` | `packages/tasks/src/WorkerTaskPool.ts` | `OCLW-10` | A3 |

> `A5-S25` tiene dos salidas posibles y la decisión es de A3/owner: (a) migrar a
> `node:worker_threads` reales —el patrón ya existe en
> `packages/execution/src/ZeroContextKernel.ts:28`—, o (b) renombrar el módulo y la API a
> `LocalTaskPool` y documentar que el paralelismo no existe. Hoy la clase se instancia
> (`apps/desktop/src/main/window/create-window.ts:534`) pero no se le despacha trabajo
> (`getWorkerTaskPool()` con 0 llamadas).

### 2.4 Para A4 — `apps/desktop/**`

| # | Fichero | Cambio pedido | Motivo |
|---|---|---|---|
| **A5-S26** | `apps/desktop/src/main.ts` (arranque) | Invocar `WindowsUserEnv` **antes** de `app.whenReady()`: si la app se lanza desde el Explorador de Windows, `process.env.PATH` no incluye `%USERPROFILE%\AppData\Local` y las tools que invocan `git`/`npm` fallan. **Deuda de plataforma real**, no cosmética (fila `HERM-06`). | Retirar el módulo sin cablearlo pierde la única defensa de Ego contra ese fallo de Windows. |
| **A5-S27** | `apps/desktop/src/main.ts` (arranque) | Invocar `WindowsSandboxFallback` si Chromium falla con `STATUS_BREAKPOINT` (0x80000003) (fila `HERM-07`). | — |
| **A5-S28** | `apps/desktop/renderer/components/canvas/TerminalView.tsx` | Liberar el timer de drenado en el `useEffect` (`:53`): hoy no hay ni un `clearTimeout` y el `setTimeout(pump, 16)` sobrevive al desmontaje (fila `HELM-10`). | Retención de proceso y escritura en un componente desmontado. |
| **A5-S29** | `apps/desktop/renderer/components/canvas/TerminalView.tsx` | Consumir `useTerminalSession` (`apps/desktop/renderer/hooks/useTerminalSession.ts:30`), hoy sin consumidor (fila `HELM-03`). | — |
| **A5-S30** | `apps/desktop/src/main.ts` / renderer | Derivar *busy*/*idle* del terminal desde los hooks de ciclo de vida del CLI de agente, con hook no-op estricto que traga fallos (fila `HELM-09`). | — |
| **A5-S31** | `apps/desktop/renderer/floating/floating.tsx:210` | Consumir el resumen de acción del core en vez de derivarlo del input crudo (fila `COUC-28`, owner A2 para el `ActionSummarizer`). | — |

### 2.5 Para A1 — `docs/roadmap/Backlog.md` (zona de A1)

| # | Cambio pedido | Motivo |
|---|---|---|
| **A5-S32** | El bloque de compuertas de `docs/roadmap/Backlog.md:41-47` debe reflejar los recuentos nuevos: **289 · ✅53 · 🚫72 · 🆕130 · ⏳34** (los 7 heredados: 30/16/7/0/7, 24/9/8/6/1, 29/12/12/4/1, 13/3/3/0/7, 10/4/1/5/0, 8/2/3/2/1, 12/0/5/3/4). | A5 ya los escribió cuadrados en sus dos README; el maestro es de A1 y se consolida con el `CATALOG` de A7 (A5-S3). |
| **A5-S33** | Si alguna fila `OCLW-16` / `OCLW-17` aparece aún como asimilada, marcarla **`🚫 Descartada (con justificación)`**. | Eran los 2 falsos verdes de `EGO-FIND-28`. |
| **A5-S34** | Si la matriz de compuertas distingue "asimilado" de "asimilado sin cablear", la nueva categoría es **`🔴 código muerto → retirar`** (20 módulos, inventario en `docs/review/README.md`). | La Ola 6 necesita saber a quién escribir para la deuda de código. |

### 2.6 Para A6 — `packages/avatar/**` (zona de A6)

| # | Fichero | Cambio pedido | Motivo |
|---|---|---|---|
| **A5-S35** | `packages/avatar/src/{core/timeline.js:2, render/ara-head.js:1, render/body.js:3, runtime/poses.js:11, studio/render/particles.js:1, studio/render/visor.js:1, studio/rig/eyes.js:1, studio/rig/hands.js:2, studio/sound.js:1}` | Normalizar las cabeceras que aún declaran "verbatim" / "PORTES VERBATIM". | D4 (sustituir por geometría propia) y convención de atribución. Detalle en `docs/extractions/coucou.md` §52.4. |
| **A5-S36** | `packages/avatar/src/runtime/avatar-element.js:2015` y `packages/avatar/src/studio/avatar.js:70` | Quitar la mención a `'coucou-mochi'` de los comentarios (el valor funcional ya no existe). | Residuo de marca. |
| **A5-S37** | `packages/avatar/src/render/projection.js:2`, `packages/avatar/src/render/static.js:3` | Cabecera `Adapted from Louis-CFM/coucou (MIT), <ruta>` (son los dos puertos derivados de Coucou que aún no la llevan). | Formato canónico de atribución. |
| **A5-S38** | `packages/avatar/src/**` | Confirmar en el cierre de A6 el test del atributo `hands` (`packages/avatar/tests/hands-attribute.test.js`: ruta `always`/`auto`/`hidden` y reinicio intencionado de `handsMode` en `applyPreset`). | Ítem 1.1 que A5 sólo dejó anotado (T4 de la Ola 5): es zona de A6, A5 no lo ha tocado. |

---

## 3. Verificación

| Comando | Exit | Resumen |
|---|---|---|
| `node scripts/audit-extraction-gates.mjs` | **0** | 25 repos · 289 tareas · **0 filas en el limbo** · recuentos coherentes entre ficha y backlog. Agregado: **✅53 · 🚫72 · 🆕130 · ⏳34**. Los 7 heredados: COUC 12/12/4/1 · HERM 16/7/0/7 · KHOJ 3/3/0/7 · HELM 4/1/5/0 · CARP 2/3/2/1 · DSEK 0/5/3/4 · OCLW 9/8/6/1. |
| `node docs/testing/check-docs-paths.mjs` | **0** | 0 enlaces rotos · 0 rutas inexistentes en docs canónicos. |
| `node scripts/check-docs-lint.mjs` | **0** | "gate OK: ninguna violación nueva en docs canónicos ni documentos mal formados" (7097 actuales vs. 7098 de base: una menos que la base, las de A3/A4 ya arregladas). |
| `node scripts/verify-vantadb-ids.mjs` | **0** | 0 errores · 4 avisos (VDB-REQ-08/09/14/16, preexistentes, no bloquean). |
| Verificación de caller (import real vs. comentario / `import type` / re-export) | — | 472 ficheros de producción analizados; 21 módulos con caller real confirmados **uno a uno** (no por coincidencia de texto). |
| Barrido de atribución falsa | — | 51 filas `✅ Completada` en 25 fichas: 43 con ruta de Ego, 1 con upstream declarado como "Fuente:" + implementación de Ego, 7 con rutas relativas al renderer (ambiguas, no falsas). **0 atribuciones falsas.** |
| Inventario de código muerto | — | 20 módulos, 20 filas anotadas en los 7 backlogs **y** en las 7 fichas (verificado: 20 de 126 filas de catálogo con la marca, 1 vez cada una). |
| Contaminación de dominio | — | Sin cambios en esta ola; sigue **LIMPIO** (re-verificado en la Ola 4b post A2/A3). |
| Codificación / EOL | — | 0 problemas en los 56 ficheros de `docs/extractions/` + `docs/review/` (UTF-8 sin BOM, LF, sin CJK, sin mojibake). |

---

## 4. Deuda / no resuelto

1. **`scripts/sync-extraction-indexes.mjs` sigue con el `CATALOG` viejo (A5-S3).** Es el punto más
   urgente: la próxima ejecución del script **revertirá** los dos README de A5. A5 los dejó
   cuadrados y en el formato exacto que el script genera, pero la fuente de verdad es el
   `CATALOG`, que es de A7.
2. **20 módulos de código muerto** (inventario en `docs/review/README.md`) siguen en el repo. No es
   trabajo de A5 retirarlos: son 14 peticiones a A2, 7 a A3 (algunos módulos tienen 2 filas de
   patrón) y 1 decisión de producto sobre `OpaqueId`/`SessionCheckpointPolicy` (retirar vs. cablear).
3. **El gate de A7 no valida que un `✅ Completada` tenga caller (A5-S5).** Es la tercera vez que
   esta comprobación manual de A5 encuentra un falso verde: primero `OCLW-16`/`OCLW-17` (ficheros
   inexistentes), luego `COUC-07`/`COUC-10` (cadena de callers = comentarios JSDoc), ahora
   `DSEK-04` (`import type` + dependencia opcional nunca inyectada). **La comprobación debería
   automatizarse antes de la Ola 6.**
4. **Las 7 filas `✅` de hermes-agent con rutas relativas al renderer** (`renderer/components/...`,
   `ego-chat.tsx:42`) son correctas pero **ambiguas** para un verificador automático. No las he
   reescrito (son correctas y son de otro agente); lo dejo como requisito de la comprobación 6
   del harness de A7.
5. **9 residuos de etiquetado "verbatim" + 2 de `'coucou-mochi'`** en `packages/avatar/src/**` y
   **13 ficheros derivados sin cabecera `Adapted from`** (de 41 sin cabecera en `src/`, la mayoría
   código nativo de Ego): cierre de A6 (A5-S35..A5-S37).
6. **El harness de procedencia no existe** (A5-S1). La procedencia de las 25 fichas es hoy una
   afirmación manual; un `git pull` de un clon puede desactualizar la ficha sin que nada lo detecte.
7. **Las 20 filas 🆕 de los 7 repos heredados** son ahora la **cola de trabajo real de la Ola 5**:
   cada una dice qué falta, dónde y con qué owner. Ninguna quedó en "pendiente" a secas.
