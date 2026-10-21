# Review Hub — Ego Cognitive Operating System

| Campo | Valor |
| --- | --- |
| Estado | Activo — Marco de revisión y auditoría técnica |
| Owner | ness-e |
| Fecha | 2026-10-07 |

---

## Propósito

El directorio `docs/review/` centraliza los procesos de auditoría crítica, inspección de código, validación de diseño y revisión técnica de repositorios y subsistemas antes y durante su implementación.

En Ego, ninguna pieza de código entra al núcleo sin pasar por un escrutinio de:
1. **Alineación con los 10 Principios Innegociables** (`docs/product/principios-innegociables.md`).
2. **Jerarquía Canónica de Decisiones** (`docs/jerarquia-canonica.md`).
3. **Guardrails Técnicos de `AGENTS.md`** (No WASM VantaDB, No backend Python obligatorio en P0, No cálculo de embeddings en TS, Context Isolation estricto en Electron).

---

## Contenido del Directorio

Cada backlog usa la **taxonomía canónica de compuerta** (`AGENTS.md` §4):
`✅ Completada` (fichero + caller en producción verificado) · `🚫 Descartada (con justificación)`
(motivo técnico en la celda) · `🆕 Pendiente` (código asimilado sin caller; la celda dice el
cableado y su responsable) · `⏳ Futura (fase)`. **Ninguna compuerta queda en el limbo.**

> **Fuente única de recuentos:** las filas de los catálogos de este directorio.
> Sincronizado el 2026-10-19 (Ola 1, A5) con `docs/extractions/README.md` §4.1.

* [`backlog-hermes.md`](backlog-hermes.md): 30 tareas (`HERM-01..HERM-30`).
  16 ✅ · 7 🚫 · 0 🆕 · 7 ⏳. gemelo de stack: UI Chat/Composer, artifacts, layout de ventanas, hardening Windows,
  packaging.
* [`backlog-openclaw.md`](backlog-openclaw.md): 24 tareas (`OCLW-01..OCLW-24`).
  9 ✅ · 8 🚫 · 6 🆕 · 1 ⏳. admisión inmutable de runs, auto-reparación de tools, locks de sesión, workers.
* [`backlog-coucou.md`](backlog-coucou.md): 29 tareas (`COUC-01..COUC-29`).
  12 ✅ · 12 🚫 · 4 🆕 · 1 ⏳. normalización en el borde, atención, HITL con ACK, ChangeSet, SafeConfigMutation.
* [`backlog-khoj.md`](backlog-khoj.md): 13 tareas (`KHOJ-01..KHOJ-13`).
  3 ✅ · 3 🚫 · 0 🆕 · 7 ⏳. chunking de 256 tokens con solapamiento y hash, filtrado de umbral, extracción de hechos.
* [`backlog-helmor.md`](backlog-helmor.md): 10 tareas (`HELM-01..HELM-10`).
  4 ✅ · 1 🚫 · 5 🆕 · 0 ⏳. terminal output scheduler (coalescencia 16 KB/tick, ring-buffer 2 MB), puente de UI.
* [`backlog-career-ops.md`](backlog-career-ops.md): 8 tareas (`CARP-01..CARP-08`).
  2 ✅ · 3 🚫 · 2 🆕 · 1 ⏳. DATA_CONTRACT.md (User vs System), locks atómicos de filesystem, cuarentena.
* [`backlog-deepseek-harness.md`](backlog-deepseek-harness.md): 12 tareas (`DSEK-01..DSEK-12`).
  1 ✅ · 4 🚫 · 3 🆕 · 4 ⏳. sesiones versionadas, IDs opacos, patrón supersede sin borrado, migraciones aditivas.
* [`backlog-opencode.md`](backlog-opencode.md): 9 tareas (`OCDE-01..OCDE-09`).
  0 ✅ · 1 🚫 · 7 🆕 · 1 ⏳. motor de sesión/agente: permisos persistidos, compactación negociada, code mode, inbox de
  prompts.
* [`backlog-codex.md`](backlog-codex.md): 9 tareas (`CDX-01..CDX-09`).
  0 ✅ · 1 🚫 · 8 🆕 · 0 ⏳. política de tool de tres estados, caché de aprobación por clave, perfil de permisos con
  degradación, parcheo con anclaje contextual.
* [`backlog-goose.md`](backlog-goose.md): 9 tareas (`GOOS-01..GOOS-09`).
  0 ✅ · 1 🚫 · 7 🆕 · 1 ⏳. cadena componible de inspectores de tool-call, inspector de egreso de red, lease del catálogo
  de tools.
* [`backlog-cline.md`](backlog-cline.md): 9 tareas (`CLNE-01..CLNE-09`).
  0 ✅ · 2 🚫 · 6 🆕 · 1 ⏳. snapshots de working tree restaurables, guardas de bucle, caché de resultados de tool, tool
  MCP determinista.
* [`backlog-gemini-cli.md`](backlog-gemini-cli.md): 9 tareas (`GCLI-01..GCLI-09`).
  2 ✅ · 1 🚫 · 5 🆕 · 1 ⏳. motor de reglas priorizadas con identidad MCP/subagente, confianza de workspace, protección
  de `.env*`.
* [`backlog-qwen-code.md`](backlog-qwen-code.md): 9 tareas (`QWEN-01..QWEN-09`).
  0 ✅ · 2 🚫 · 6 🆕 · 1 ⏳. subagentes multi-agente, riesgo de tool MCP no derivado del nombre, piso de superficie de
  tools por rol.
* [`backlog-openhands.md`](backlog-openhands.md): 12 tareas (`OHND-01..OHND-12`).
  0 ✅ · 2 🚫 · 9 🆕 · 1 ⏳. gemelo de stack desktop: bridge IPC tipado, log de arranque en splash, router declarativo,
  sello de perfil.
* [`backlog-vibe-kanban.md`](backlog-vibe-kanban.md): 8 tareas (`VIBE-01..VIBE-08`).
  0 ✅ · 1 🚫 · 6 🆕 · 1 ⏳. worktree idempotente con lock, merge/rebase con guardas, ciclo de vida del proceso de agente.
* [`backlog-mini-swe-agent.md`](backlog-mini-swe-agent.md): 9 tareas (`MSWE-01..MSWE-09`).
  0 ✅ · 1 🚫 · 7 🆕 · 1 ⏳. taxonomía de salida terminal, observación con `elided_chars`, gate de verificación por
  `git diff`.
* [`backlog-swe-agent.md`](backlog-swe-agent.md): 9 tareas (`SWAG-01..SWAG-09`).
  0 ✅ · 2 🚫 · 7 🆕 · 0 ⏳. diseño ACI, contrato observación→prompt, presupuestos de coste independientes.
* [`backlog-crush.md`](backlog-crush.md): 9 tareas (`CRSH-01..CRSH-09`).
  0 ✅ · 1 🚫 · 8 🆕 · 0 ⏳. LSP como fuente de contexto, diagnósticos embebidos, pre-aprobación con `halt`.
* [`backlog-continue.md`](backlog-continue.md): 9 tareas (`CONT-01..CONT-09`).
  0 ✅ · 2 🚫 · 7 🆕 · 0 ⏳. registro de context providers, capacidades declaradas en config, roles y rectificación de
  selección.
* [`backlog-claude-squad.md`](backlog-claude-squad.md): 9 tareas (`CSQD-01..CSQD-09`).
  1 ✅ · 3 🚫 · 4 🆕 · 1 ⏳. rehidratación degradada a reanudable, diff a dos niveles de coste, digest de salida de
  terminal.
* [`backlog-ag-ui.md`](backlog-ag-ui.md): 8 tareas (`AGUI-01..AGUI-08`).
  0 ✅ · 4 🚫 · 3 🆕 · 1 ⏳. validación semántica A2UI, deltas RFC 6902, verificador de invariantes de stream.
* [`backlog-graphiti.md`](backlog-graphiti.md): 9 tareas (`GRPH-01..GRPH-09`).
  0 ✅ · 4 🚫 · 4 🆕 · 1 ⏳. bitemporalidad de dos ejes, detección de contradicciones, cascada de resolución de entidades.
* [`backlog-graphrag.md`](backlog-graphrag.md): 9 tareas (`GRAG-01..GRAG-09`).
  0 ✅ · 1 🚫 · 7 🆕 · 1 ⏳. priorización in/out-network con presupuesto de grafo, pipeline declarativo, caché de
  respuestas LLM.
* [`backlog-mem0.md`](backlog-mem0.md): 9 tareas (`MEM0-01..MEM0-09`).
  2 ✅ · 2 🚫 · 5 🆕 · 0 ⏳. extracción de memoria desde el turno de chat, anti-alucinación de ids, arbitraje
  ADD/UPDATE/DELETE.
* [`backlog-mcp-servers.md`](backlog-mcp-servers.md): 9 tareas (`MCPS-01..MCPS-09`).
  2 ✅ · 2 🚫 · 4 🆕 · 1 ⏳. roots declarado y no implementado, anotaciones de riesgo MCP, descubrimiento documentado y
  ausente.
**Total: 289 tareas · 54 ✅ Completada · 71 🚫 Descartada · 130 🆕 Pendiente · 34 ⏳ Futura · 0 en el limbo.**

> **Verificación mecánica:** `node scripts/audit-extraction-gates.mjs` comprueba sobre los
> 25 repos que la ficha y el backlog comparten el mismo conjunto de IDs, que cada fila
> cierra en uno de los cuatro estados canónicos (0 en el limbo) y que el recuento
> declarado coincide con las filas reales. Los 18 repos de la Ola 2 son **nuevos**: su
> `0 ✅` en la mayoría de los casos es correcto y está justificado en el §0 de su backlog
> (nada asimilado todavía; un `✅` exigiría fichero adaptado **y** caller en producción
> verificado por grep).
> **Nota sobre el patrón de extracción de `khoj`:** el fichero canónico del filtro de umbral es
> `packages/knowledge/src/filters/ScoreThresholdFilter.ts` (no `CosineThresholdFilter.ts`).
> La corrección quedó registrada en la ficha y en el backlog.

---

## Código asimilado sin cablear — inventario agregado (2026-10-21, A5)

> **Qué es esto:** módulos cuyo patrón de extracción **está escrito en el repo** (con test, con
> contrato, con ficha) pero que **ningún fichero de producción importa**. Son código muerto: no
> aportan comportamiento y son una segunda fuente de verdad frente al módulo canónico que sí
> está cableado. **El registro es de A5; la retirada es de A2/A3/A4** (cada fila indica su zona).
>
> **Método de detección (Ola 5, A5):** se recorre `packages/` + `apps/desktop/src/` +
> `apps/desktop/renderer/` excluyendo `node_modules/`, `dist/`, `out/`, `test/` y `vendor/`, y se
> exige un **import real o una invocación real** — un `import type`, un re-export o una mención
> dentro de un comentario **no** cuentan como caller. (472 ficheros de producción analizados.)
>
> **Total: 20 módulos asimilados sin cablear** (🔴 código muerto → retirar).

| # | Módulo | Fichero | Patrón | Veredicto | Zona duenosa | Owner |
|:--:|---|---|---|:---:|---|:---:|
| 1 | `EventNormalizer` | `packages/events/src/EventNormalizer.ts:35` | `COUC-01` | 🔴 código muerto | `@ego/events` | **A2** |
| 2 | `EventIngress` | `packages/events/src/EventIngress.ts:45` | `COUC-02` | 🔴 código muerto | `@ego/events` | **A2** |
| 3 | `ChangeSetService` | `packages/tools/src/native/git/ChangeSetService.ts:56` | `COUC-07` | 🔴 código muerto (transitivo: sólo lo importa `SafeConfigMutation`, que tampoco está cableado) | `@ego/tools` | **A3** |
| 4 | `SafeConfigMutation` | `packages/execution/src/SafeConfigMutation.ts:25` | `COUC-10` | 🔴 código muerto (la config MCP vive en VantaDB, no en fichero) | `@ego/execution` | **A2** |
| 5 | `SyntheticRuntime` | `packages/runtime/src/SyntheticRuntime.ts:17` | `COUC-14` | 🔴 código muerto | `@ego/runtime` | **A2** |
| 6 | `MockIPCBridge` | `packages/ui-runtime/src/MockIPCBridge.ts:89` | `COUC-15` | 🔴 código muerto | `@ego/ui-runtime` | **A3** |
| 7 | `WindowsUserEnv` | `packages/recovery/src/WindowsUserEnv.ts` | `HERM-06` | 🔴 código muerto (deuda de plataforma real: el PATH de Windows no se repara) | `@ego/recovery` | **A3** |
| 8 | `WindowsSandboxFallback` | `packages/recovery/src/WindowsSandboxFallback.ts` | `HERM-07` | 🔴 código muerto | `@ego/recovery` | **A3** |
| 9 | `SessionTimelineRewind` | `packages/memory/SessionTimelineRewind.ts` | `HERM-14` | 🔴 código muerto (el fork real es `SessionFork.ts`) | `@ego/memory` | **A2** |
| 10 | `ZeroContextKernel` | `packages/execution/src/ZeroContextKernel.ts:165` | `HERM-18` | 🔴 código muerto (choca con el principio 6: sin turnos de modelo no se puede sellar la `ActionIdentity`) | `@ego/execution` | **A2** |
| 11 | `DataContract` | `packages/memory/DataContract.ts:51` | `CARP-01` | 🔴 código muerto (la frontera real es `SensitiveNamespaces.ts`) | `@ego/memory` | **A2** |
| 12 | `UntrustedContentSanitizer` | `packages/memory/UntrustedContentSanitizer.ts` | `CARP-04` | 🔴 código muerto (la cuarentena real es `QuarantineManager.ts`) | `@ego/memory` | **A2** |
| 13 | `SessionLifecycleLocks` | `packages/memory/SessionLifecycleLocks.ts:23` | `OCLW-05` | 🔴 código muerto (el fail-closed real es `SessionCheckpointPolicy.ts`) | `@ego/memory` | **A2** |
| 14 | `TranscriptReadWindow` | `packages/memory/TranscriptReadWindow.ts:38` | `OCLW-06` | 🔴 código muerto | `@ego/memory` | **A2** |
| 15 | `StructuredInput` | `packages/runtime/src/StructuredInput.ts:62` | `OCLW-12` | 🔴 código muerto (el formulario real es `WidgetHitlBridge` + `ApprovalCard`) | `@ego/runtime` | **A2** |
| 16 | `ProcessSupervisor` | `packages/recovery/src/ProcessSupervisor.ts:20` | `OCLW-13` | 🔴 código muerto (la recuperación real es `CrashRecoveryEngine` + `OpGate`) | `@ego/recovery` | **A3** |
| 17 | `getVersionHistory` / `getAtTimestamp` | `packages/memory/EgoMemoryAdapter.ts:986` / `:1048` | `DSEK-02` | 🔴 código muerto (las queries bitemporales reales son `BitemporalQueries.ts`) | `@ego/memory` | **A2** |
| 18 | `OpaqueId` | `packages/memory/OpaqueId.ts:30` | `DSEK-03` | 🔴 código muerto (los `sessionId` en producción son cadenas libres) | `@ego/memory` | **A2** |
| 19 | `SessionCheckpointPolicy` | `packages/memory/SessionCheckpointPolicy.ts:43` | `DSEK-05` | 🔴 código muerto (`DailyStatePersistence.ts:138` lo menciona en un **comentario**, no lo importa) | `@ego/memory` | **A2** |
| 20 | `SchemaMigrator` | `packages/recovery/src/SchemaMigrator.ts` | `DSEK-04` | 🔴 código muerto (import **type-only** y dependencia opcional nunca inyectada) | `@ego/recovery` | **A3** |

**Módulos con caller real (no incluidos en el inventario):** `PayloadRegistry`
(`packages/ui-runtime/src/PayloadRef.ts:137` -> `apps/desktop/src/main/mcp/mcp-server-runtime.ts:29,166`),
`RunRecorder` (`apps/desktop/src/main/window/create-window.ts:312`), `WindowStateHelper`
(`apps/desktop/src/windows/WindowStateManager.ts:5,305,337`), `StorageHealthLatch`
(`packages/recovery/src/CrashRecoveryEngine.ts:5,82,87`), `SessionDiffRevisions`
(`packages/tools/src/native/git/NativeGitTool.ts:8,155,158`), `MermaidRenderer`
(`packages/ui-runtime/src/MermaidComponent.ts:2,81,86,89` + `renderer/components/canvas/registry.ts:17`),
`NetPolicy`/`ssrfPolicy` (`packages/security/src/ToolPermissions.ts:23,310`),
`WorkerTaskPool` (instanciado en `apps/desktop/src/main/window/create-window.ts:534`, **pero sin
paralelismo real ni trabajo despachado** — ver `OCLW-10`).

> **Aviso (Ola 5, A5):** el veredicto de `DSEK-04` cambió de `✅ Completada` a `🚫 Descartada`
> al re-verificar con el método de import real: `ProjectImport.ts:16` es un `import type` y
> `SnapshotManager.ts:100` instancia `new ProjectImport(this.adapter)` **sin** migrador, luego
> `if (this.schemaMigrator)` nunca es true. Es la segunda corrección de este tipo (la primera
> fue `COUC-07`/`COUC-10`, cuya cadena de callers eran comentarios JSDoc). **Regla vigente: un
> `import type`, un re-export o un comentario no son caller.**

---

## Criterio de Aceptación para Reviews (Definition of Done)

Para que una revisión se considere cerrada y apta para extracción/implementación:
- [ ] **Origen comprobado:** Identificación exacta del archivo y línea en el repositorio fuente.
- [ ] **Evaluación de impedimentos:** Confirmación de que no introduce dependencias prohibidas.
- [ ] **Adaptación arquitectónica:** Especificación de cómo se reescribe el patrón en TypeScript / Node 22 / VantaDB.
- [ ] **Vínculo con el Backlog:** Asociación directa con uno o más IDs de `docs/roadmap/Backlog.md`.
- [ ] **Verificación de integración (añadido 2026-10-19):** el patrón asimilado tiene **caller en producción** verificable por grep sobre `packages/` + `apps/desktop/` (excluyendo `test/`). Si no lo tiene, la fila se declara `🆕 Pendiente` con el cableado exacto y su responsable; si el patrón no aplica, `🚫 Descartada` con fundamento técnico.
- [ ] **Sin descarte silencioso:** ningún hallazgo se borra ni se deja sin estado.
