# Backlog de Revisión y Extracción: Coucou (Louis-CFM/coucou) #

### Catálogo de Tareas Canónicas para Observabilidad, Atención, Gobernanza y Mutaciones Seguras ###

| Campo | Valor |
| --- | --- |
| Estado | Activo — Backlog de Extracción Complementario |
| Repositorio Origen | `repos-referencia/coucou/` · Commit verificado: oct-2026 |
| Total de Tareas | **29 tareas canónicas** (`COUC-01..29`) |
| Fases Impactadas en Ego | Fase 01, Fase 02, Fase 04, Fase 07, Fase 10, Fase 11 |
| Owner | ness-e / Principal Systems Engineer |
| Fecha | 2026-10-07 |
| Última verificación | **2026-10-20** (Ola 2 de revisión de fondo) |

---

## 0. Verificación de estado (2026-10-20) ##

Cada fila fue re-auditada contra el **código real** tras los cambios de A2/A3. Criterio de `✅ Completada`:
existe el fichero adaptado **y** hay un caller en producción (grep sobre `packages/` + `apps/desktop/`,
excluyendo `test/`, `dist/` y `node_modules/`).

| Estado | Significado canónico |
|---|---|
| `✅ Completada` | Asimilado, integrado y con **caller en producción verificado**. La celda cita la ruta real. |
| `🚫 Descartada (con justificación)` | El patrón no se aplica en Ego, fue sustituido por otro módulo canónico, o viola un guardrail. La celda contiene el motivo técnico. |
| `🆕 Pendiente` | Asimilado (el código existe y está probado) pero **sin caller en producción**. La celda dice el cableado exacto y quién lo ejecuta. |
| `⏳ Futura (fase)` | Diferido a una fase posterior, con fase destino explícita. |

**Nota de alcance (coucou)**: la ficha `docs/extractions/coucou.md` es el documento de mayor
extensión del catálogo (más de 2 200 líneas) y hasta 2026-10-19 **no contenía ninguna mención de
descarte** — el rechazo se redactaba como el apartado libre "§39. Qué NO extraer". El
2026-10-19 se normalizó a la forma canónica (ver `docs/extractions/coucou.md` §39).

**Ola 2 (2026-10-20) — revisión de fondo.** Se re-verificaron las 23 filas de la Ola 1 contra el
clon real y se añadieron 6 hallazgos nuevos (`COUC-24..29`). Resultado: **3 filas bajaron** de
`✅ Completada` a `🆕 Pendiente` por evidencia de caller falsa (`COUC-07`, `COUC-08`, `COUC-10`),
**1 fila subió** de `🆕 Pendiente` a `✅ Completada` (`COUC-21`, que sí tiene callers de paquete)
y se corrigieron **todas** las líneas citadas de `apps/desktop/src/main.ts`, que estaban desfasadas.
Detalle de cada corrección en §5.

---

## 1. Resumen Ejecutivo de Extracción ##

El análisis de `coucou` aporta a Ego componentes críticos de **infraestructura de ejecución y gobernanza**, resolviendo la observación de agentes desatendidos sin saturar la atención del usuario ni bloquear procesos innecesariamente.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MATRIZ DE DISTRIBUCIÓN POR FASE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Fase 01 (Core Cognitivo):         COUC-01, COUC-05, COUC-15, COUC-27      │
│  Fase 02 (Acción & Tools / HITL):  COUC-02, COUC-03, COUC-04, COUC-10, 11   │
│                                    COUC-28, COUC-29                        │
│  Fase 04 (Dynamic Workspace):      COUC-07, COUC-08, COUC-14, COUC-24      │
│  Fase 07 (Tasks & Background):     COUC-06, COUC-09, COUC-12, COUC-16, 25  │
│                                    COUC-26                                  │
│  Fase 11 (Seguridad & Políticas):  COUC-13                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Recuento de estados (verificado programáticamente sobre las 29 filas de la tabla §2):**

| `✅ Completada` | `🚫 Descartada` | `🆕 Pendiente` | `⏳ Futura` | Total |
|:---:|:---:|:---:|:---:|:---:|
| 10 | 6 | 12 | 1 | **29** |

---

## 2. Catálogo Detallado de Extracción (10 Columnas Canónicas) ##

| ID | Severidad | Hallazgo | Archivo Coucou | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| `COUC-01` | 🔴 Crítica | **Normalización de Eventos en el Borde (`EventNormalizer`)** | `NotchBuddy/Sources/App/HookServer.swift:342` (`processEvent`) | 🟢 1d | 🔴 P0 | 🆕 Pendiente | asimilado en `packages/events/src/EventNormalizer.ts:35` (tipos canónicos `tool.started`, `approval.required`, …) **sin caller en producción**: las únicas referencias son el reexport `packages/events/src/index.ts:3` y `packages/events/test/EventBus.test.ts:118`. El `EventBus` de Ego emite `EgoEvent` ya tipado y no existe todavía ningún adaptador externo que normalizar. **Cableado pendiente:** invocar `EventNormalizer` en el punto de entrada de eventos externos cuando exista el primer adapter (depende de `COUC-22` / `HERM-22`) — owner A2. | Ego: `CORE-01`, `ACT-01`, `ACT-05` · Ver: `docs/research/coucou-deep-dive.md` §Pilar 1 | — |
| `COUC-02` | 🔴 Crítica | **Event Ingress No Bloqueante por Defecto** | `NotchBuddy/Sources/App/HookServer.swift:271` (`handleClient`), `:1146` (`sendLine`) | 🟢 0.5d | 🔴 P0 | 🆕 Pendiente | asimilado en `packages/events/src/EventIngress.ts:45` (fire-and-forget para eventos informativos; bloqueo solo para interactivos con timeout) **sin caller en producción** (únicas referencias: `packages/events/src/index.ts:6` y `packages/events/test/EventIngress.test.ts`). **Cableado pendiente:** el mismo punto de entrada que `COUC-01` — owner A2. | Ego: `ACT-02`, `ACT-03` | `COUC-01` |
| `COUC-03` | 🔴 Crítica | **Correlación Exacta de Acción Autorizada (`ActionIdentity`)** | `NotchBuddy/Sources/CoucouKit/IslandTypes.swift:33-41` (`ApprovalInfo`), `NotchBuddy/Sources/App/HookServer.swift:195-200` (`approvalInputKey`, JSON con claves ordenadas) | 🟢 1d | 🔴 P0 | ✅ Completada | Identificar una acción pendiente mediante `runId + taskId + subEgoId + toolId + invocationId + inputDigest` (hash canónico de input). Evita colisiones de permisos en ejecuciones paralelas. Implementado en `packages/execution/src/ApprovalEngine.ts:75` (`computeActionIdentity`) + `packages/execution/src/types.ts:95` (`ActionIdentity`). **Evidencia:** caller en `apps/desktop/src/main.ts:20` (import) y `main.ts:2429` (instancia del `ApprovalEngine`). **Nota:** `packages/events/src/ApprovalIdentity.ts:53` es una implementación paralela **sin caller** → `COUC-29`. | Ego: `ACT-04`, `ACT-05` · Ver: `docs/architecture/arquitectura-unificada.md` §24 | `COUC-02` |
| `COUC-04` | 🟠 Alta | **Admisión Interactiva con ACK Previo (`InteractiveAdmission`)** | `windows/src/island/hooks.ts:273-328` (ACK en 800 ms, una tarjeta por request) | 🟢 0.5d | 🔴 P0 | ✅ Completada | Requerir un ACK inmediato de disponibilidad de la UI antes de pausar la ejecución en una solicitud HITL. Si la UI no responde en 500-800ms, aplica fallback seguro sin colgar el proceso. Implementado en `packages/execution/src/WidgetHitlBridge.ts:54` (ACK por defecto 800 ms en `:66`) y en la política "una tarjeta, un request" (`:77-91`, decline inmediato ante duplicado). **Evidencia:** `apps/desktop/src/main.ts:20` (import) y `main.ts:2441-2465` (`presentApproval` + `acknowledgePresentation`); presentación en `apps/desktop/renderer/floating/views.tsx`. | Ego: `ACT-04` | `COUC-03` |
| `COUC-05` | 🟠 Alta | **Desacoplamiento de Estado Reactivo (Anti-Singleton)** | `NotchBuddy/Sources/App/AppState.swift` | 🟡 1-2d | 🔴 P0 | 🚫 Descartada (con justificación) | el particionado ortogonal del estado **ya está realizado en Ego por módulos canónicos por dominio**: `AttentionStateMachine` (attention, `packages/runtime/src/AttentionStateMachine.ts:50`), `ApprovalEngine` (interaction, `packages/execution/src/ApprovalEngine.ts`), estado de runtime en `apps/desktop/src/main.ts`, y store Zustand de UI en `apps/desktop/renderer/components/ui-kit/store.ts`. `packages/ui-runtime/src/stores/EgoStateStores.ts:83` (7 interfaces ortogonales + `ReactiveStore`) sería una **tercera fuente de verdad** del estado y no se cablea; verificado que **no tiene caller** (sólo `packages/ui-runtime/src/stores/index.ts:2` y su test). La invariante de Coucou (no singleton monolítico) se cumple por la separación main/renderer, no por un store adicional. | Ego: `CORE-01`, `CORE-05` | — |
| `COUC-06` | 🟠 Alta | **Máquina de Estados de Atención Pura (`AttentionStateMachine`)** | `NotchBuddy/Sources/App/IslandStateMachine.swift` | 🟢 1d | 🟠 P1 | ✅ Completada | FSM desacoplada de la UI que transiciona entre estados de atención (`hidden`, `compact`, `expanded`, `alert`, `hitl_approval`) según urgencia, riesgo y foco del usuario. Implementado en `packages/runtime/src/AttentionStateMachine.ts:50`. **Evidencia:** `apps/desktop/src/main.ts:15` (import), `main.ts:500-554` (`getAttentionFsm` + `recomputeFloatingAttention` → tray y ventana flotante) y `apps/desktop/renderer/floating/floating.tsx`. **Nota:** la FSM sólo *consume* una decisión ya tomada; el evaluador que falta es `COUC-25`. | Ego: `TASK-04`, `DS-02` | `COUC-05` |
| `COUC-07` | 🔴 Crítica | **Servicio de Diff y ChangeSet (`ChangeSetService`)** | `NotchBuddy/Sources/CoucouKit/DiffEngine.swift:30-31` (cotas), `:42-68` (guardas) | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | Motor de diffs local con límites de seguridad (límites de líneas, protección contra coste cuadrático O(N*M) y fallback a resumen estadístico). Genera contratos `ChangeSet` para el Canvas. Implementado en `packages/tools/src/native/git/ChangeSetService.ts:56`. **Evidencia (re-verificada 2026-10-20): NO hay caller de producción.** Su único import real es `packages/execution/src/SafeConfigMutation.ts:4,81-82`, y ese módulo tampoco tiene caller (ver `COUC-10`). La cadena `→ McpManager.ts → main.ts:23` que se declaraba en la Ola 1 era un **comentario**, no un import. **Cableado pendiente:** que `SafeConfigMutationService` tenga un consumidor real (ver `COUC-10`) o cablear `ChangeSetService` al Canvas / a la tool `git_diff` — owner A3/A4. | Ego: `CANV-03`, `CANV-04` | — |
| `COUC-08` | 🟡 Media | **Patrón de Referencia Inmutable a Payload (`PayloadRef`)** | `NotchBuddy/Sources/App/PhoneLink/TurnRecorder.swift:99-101`, `NotchBuddy/Sources/CoucouKit/TurnSnapshot.swift:59-65` | 🟢 0.5d | 🔴 P0 | 🆕 Pendiente | Desacoplar las filas visuales de la UI del contenido pesado mediante identificadores `payloadRef`, evitando almacenar diffs o artefactos masivos en el árbol del DOM. **Implementación canónica:** campo `payloadRef` + `ChangeSetService.buildPayloadRef()` / `withPayloadRef()` en `packages/tools/src/native/git/ChangeSetService.ts:49,184,194` (digest `sha256:`). **Evidencia (re-verificada 2026-10-20): NO hay caller de producción** — hereda el hueco de `COUC-07`. **Nota:** `packages/ui-runtime/src/PayloadRef.ts:126` (`PayloadRegistry`, SHA-256 en JS puro) es un duplicado browser-safe **sin caller**; no se cablea. | Ego: `CANV-02` | `COUC-07` |
| `COUC-09` | 🟠 Alta | **Grabador y Snapshot de Ejecución (`RunRecorder`)** | `NotchBuddy/Sources/App/PhoneLink/TurnRecorder.swift`, `NotchBuddy/Sources/CoucouKit/TurnSnapshot.swift` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | asimilado en `packages/tasks/src/RunRecorder.ts:67` (`RunSnapshot` + `RunAction` + digest canónico SEC-06 H6, consume `EventBus`) **sin caller en producción** (únicas referencias: `packages/tasks/src/index.ts:13` y `packages/tasks/test/RunRecorder.test.ts`). **Cableado pendiente:** instanciar el `RunRecorder` al cierre de cada turno en `packages/tasks/src/BackgroundEngine.ts` o `packages/runtime/src/ToolExecutionLoop.ts` para persistir el registro estructurado en VantaDB bajo `projects/<id>/runs/` — owner A3 (tasks) / A2 (runtime). | Ego: `TASK-05`, `KB-08` | `COUC-01` |
| `COUC-10` | 🔴 Crítica | **Pipeline de Mutación Segura de Configuración (`SafeConfigMutation`)** | `NotchBuddy/Sources/App/HookServer.swift:1160` (`installHookScript`), `:1477-1502` (backup + escritura atómica de `settings.json`) | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | Servicio de 12 pasos para modificar archivos de configuración (`.ego/*`, MCP): lectura -> validación -> diff -> backup -> fingerprint SHA-256 -> aprobación HITL -> verificación -> escritura atómica -> eliminación de entries propios. Implementado en `packages/execution/src/SafeConfigMutation.ts:25` (los 12 pasos están, incluido `removeOwnedEntries` en `:228`). **Evidencia (re-verificada 2026-10-20): NO hay caller de producción.** `McpManager.ts:85` y `McpClient.ts:97,217` **sólo lo mencionan en comentarios**; el `reload()` de `McpClient.ts:220-248` hace un rollback **en memoria** del objeto de configuración, sin preview, sin fingerprint y sin escritura atómica de fichero. Además la config MCP de Ego persiste en **VantaDB** (`gov/mcp_servers`, `apps/desktop/src/main.ts:2370`), no en un JSON externo: hoy no hay fichero ajeno que mutar con seguridad. **Cableado pendiente:** (a) crear el instalador de hooks de agente externo (`~/.claude/settings.json`) que la Ola 1 asumía, o (b) migrar la persistencia MCP a fichero y cablear `preview/confirm/apply` en `McpManager.registerServer` — owner A2/A3. | Ego: `ACT-11`, `SEC-04` | `COUC-07` |
| `COUC-11` | 🟠 Alta | **Escritura Atómica con Preservación de Permisos** | `NotchBuddy/Sources/App/HookServer.swift:243` (`chmod 0600`), `:1249,1479` (escritura `.atomic`) | 🟢 0.5d | 🔴 P0 | ✅ Completada | Rutina que escribe en fichero temporal, genera backup previo (`.ego_bak`) y realiza un reemplazo atómico mediante rename, evitando corrupción por crash. Implementado en `packages/tools/src/native/fs/FileLockManager.ts:19` (adquisición de lock con flag exclusivo) y en la escritura atómica de `packages/tools/src/native/fs/NativeFsTool.ts:164-171`. **Evidencia:** `NativeFsTool.ts:7,147` -> `packages/tools/src/native/index.ts:27` -> `apps/desktop/src/main.ts:2148` (`registerNativeTools`); toda escritura nativa de Ego pasa por el lock. **Corrección de la Ola 2:** la línea citada era `main.ts:3086` (obsoleta) y la mitad de "preservación de permisos" **NO** está implementada (ver `COUC-24`). | Ego: `ACT-04`, `REC-01`, `REC-02` | `COUC-10` |
| `COUC-12` | 🟡 Media | **Agregación de Intervalos No Solapados (`IntervalSet`)** | `NotchBuddy/Sources/App/RecapStore.swift:177-178`, `:297` (`mergedTotalSeconds`) | 🟢 0.5d | 🟠 P1 | 🚫 Descartada (con justificación) | `packages/domains/src/IntervalSet.ts:16` existe y está probado, pero **no tiene caller** (sólo `packages/domains/src/index.ts:13` y `packages/domains/test/IntervalSet.test.ts`) y el requisito que lo motivaba (métrica de "tiempo de trabajo efectivo" sin doble conteo de sesiones paralelas) lo cubren hoy los timestamps por tarea y los checkpoints de `packages/tasks/src/TaskCheckpoint.ts` (`tasks/<taskId>/checkpoints`) más los contadores de `packages/dailystate`. Añadir un segundo motor de intervalos en `@ego/domains` es sobreingeniería hasta que exista una métrica de "work time" en el Daily State. **Revisión:** reevaluar si `DS-03` pide la métrica. | Ego: `DOM-08`, `DS-03` | — |
| `COUC-13` | 🟠 Alta | **Política de Filtrado Seguro de URLs (`ResourcePolicy`)** | `NotchBuddy/Sources/App/SafeWebURL.swift` | 🟢 0.5d | 🔴 P0 | 🚫 Descartada (con justificación) | `packages/tools/src/native/security/ResourcePolicy.ts` existe pero **no tiene caller** (sólo `packages/tools/test/ResourcePolicy.test.ts`), y la política de URLs **viva y en producción** es otra: `packages/security/src/ToolPermissions.ts` (veredicto de tool calls) + `packages/security/src/netPolicy.ts:31` (`validateSSRFUrl`, frontera SSRF con DNS). Dos políticas de URL en el repo = dos fuentes de verdad sobre qué se puede abrir. El módulo de `@ego/tools` no se cablea; la política canónica es la de `@ego/security`. **Revisión Ola 2: la duplicidad está resuelta** — sólo `@ego/security` está cableado, `ResourcePolicy` sigue huérfano. | Ego: `SEC-02` | — |
| `COUC-14` | 🟠 Alta | **Runtime Sintético y Modo Demo (`SyntheticRuntime`)** | `NotchBuddy/Sources/App/DemoEngine.swift` | 🟡 1-2d | 🟠 P1 | 🆕 Pendiente | asimilado en `packages/runtime/src/SyntheticRuntime.ts:17` **sin caller en producción** (únicas referencias: `packages/runtime/src/index.ts:6` y `packages/runtime/test/SyntheticRuntime.test.ts`). **Cableado pendiente:** usarlo como fuente de eventos sintéticos en la suite E2E/QA reproducible (`tests/e2e/`, owner A7) y como modo demo del Canvas, tal como describe `docs/extractions/coucou.md` §29. | Ego: `CANV-10`, `TEST-01` | `COUC-01` |
| `COUC-15` | 🟡 Media | **Mock IPC para Iteración Aislada de UI** | `windows/src/core/bridge.ts:10-21` (`IS_TAURI` + `call` no-op) | 🟢 1d | 🔴 P0 | 🆕 Pendiente | asimilado en `packages/ui-runtime/src/MockIPCBridge.ts:89` **sin caller en producción**: `installIfMissing()` (`:266`) no se invoca desde ningún sitio y las únicas referencias son `packages/ui-runtime/src/index.ts:11` y `packages/ui-runtime/test/MockIPCBridge.test.ts`. **Cableado pendiente:** exponer el bridge en el dev-server del renderer (Vite) para iterar el Dynamic Workspace sin arrancar Electron — owner A4/A7. | Ego: `CORE-01`, `CANV-01` | `COUC-05` |
| `COUC-16` | 🟠 Alta | **Captura de Contexto Activo del Sistema (`ContextProvider`)** | `NotchBuddy/Sources/App/WindowContextCapture.swift` | 🟢 1d | 🟠 P1 | 🚫 Descartada (con justificación) | `packages/tasks/src/ContextProvider.ts:24` existe pero **no tiene caller** (sólo `packages/tasks/src/index.ts:14` y su test), y el renderer define **su propio contrato divergente**: `apps/desktop/renderer/floating/upload-canvas.ts:649-654` declara `interface ContextProvider` + `class NoopContextProvider` (con `attach-window-context` como extra opcional). Dos contratos distintos de captura de contexto = deriva garantizada. El módulo del paquete no se cablea; se unifica en uno solo. **Revisión Ola 2: la duplicidad NO está resuelta** — sigue vigente la deuda D2. | Ego: `TASK-08` | — |
| `COUC-17` | 🔴 Crítica | **Ventana Flotante Secundaria (Dynamic Island de Escritorio)** | `windows/src/island/island.ts`, `NotchBuddy/Sources/App/IslandWindowController.swift` | 🟡 2d | 🔴 P0 | ✅ Completada | Cierre formal isla 2026-10-15 (implementación real, no solo absorbida): ventana con contenido avatar `0a3ef0e` + autoshow `06bb54b` + vistas `f129dc2` + HITL ACK `8b24737` + persistencia `6de7291` (`apps/desktop/src/windows/FloatingWindow.ts` + `renderer/floating/floating.html`; comparte `AttentionStateMachine` WIDG-03). **Evidencia:** `apps/desktop/src/main.ts:59-62` (import de `FloatingWindowManager` y `syncFromAttention`) y `main.ts:237-239` (`ensureFloatMgr`). | Ego: `CANV-11`, `TASK-02`, `DS-02` | `COUC-06`, `COUC-18` |
| `COUC-18` | 🟠 Alta | **Motor de Físicas de Resortes (`Spring Physics`) y Animación de Píldora** | `windows/src/core/anim.ts`, `windows/src/island/island.ts` | 🟢 1d | 🟠 P1 | ✅ Completada | Cierre formal isla 2026-10-15 (implementación real `e3b3903`): `renderer/floating/floating-anim.ts` con `Spring`/`Tracked`/`Ease`/`cubicBezier`/`closeCurve` + `islandSize` por modo + RAF detenido en hidden + click-through event-driven sin polling 60Hz. Base previa: `TraitPhysics` (`character-system.md` §13) + morphing 3 fases 350–550 ms. **Evidencia (corregida 2026-10-20):** `apps/desktop/renderer/floating/floating-anim.ts` lo consumen `countdown.tsx:12` (`clamp`) y `ticker.ts:13` (`cubicBezier`, `clamp`, `lerp`). La tercera cita de la Ola 1, `views.tsx:8`, era un **comentario de cabecera**, no un import. | Ego: `CANV-11` | — |
| `COUC-19` | 🟡 Media | **Icono Interactivo en Bandeja del Sistema (System Tray de Windows)** | `windows/src-tauri/src/tray.rs` | 🟢 1d | 🟠 P1 | ✅ Completada | Cierre formal isla 2026-10-15 (`6de7291`): tray tricolor (verde idle, azul pensando, rojo HITL) + tooltips + menú Open/Settings/Pause/Quit con `pauseAllTasks`/`resumeAllTasks` + click-restore + persistencia flotante (`floating_window` en `system/window-state`, debounce 500ms, `validateBoundsAgainstDisplays`). Implementado en `apps/desktop/src/main/tray-status.ts:14,53,75,95` + `main.ts` + `WindowStateManager.ts`. **Evidencia (corregida 2026-10-20):** `apps/desktop/src/main.ts:83-90` (import de `TRAY_COLORS`, `pauseAllTasks`, `resumeAllTasks`), `main.ts:613` (`ensureTray`) y `main.ts:2763` (invocación). La Ola 1 citaba `main.ts:186-193, 648-715`, ya obsoleto. | Ego: `CANV-11`, `TASK-04` | `COUC-06` |
| `COUC-20` | 🟡 Media | **Sistema de Feedback Auditivo (`SoundEngine`)** | `NotchBuddy/Sources/App/SoundEngine.swift`, `windows/src/core/sound.ts` | 🟢 1d | 🟡 P2 | ✅ Completada | Cierre formal isla 2026-10-15 (`4f90fa2`): `renderer/floating/floating-sound.ts` envuelve el motor de sonido del avatar (recetas procedurales, volumen 0.12 con bounds 0-0.2, idle-suspend 1500ms, muted desde estado flotante; cero WAV binarios). Motor WAV completo queda fuera de alcance (P2), sin descarte. **Evidencia (corregida 2026-10-20):** `apps/desktop/renderer/floating/floating-sound.ts:384` importa `@ego/avatar/runtime/sound.js` (el paquete es la fuente canónica; la Ola 1 apuntaba a `packages/avatar/src/runtime/sound.js`, que es el mismo fichero tras el alias de Vite). | Ego: `CORE-01`, `ACT-04` | — |
| `COUC-21` | 🟠 Alta | **Motor de Avatar Cognitivo Procedural 2D Personalizable** | `windows/src/mochi/engine.ts:749-784` (`drawEyes`), `design/outfits/` | 🟡 2d | 🟠 P1 | ✅ Completada | asimilado en `packages/avatar/src/render/projection.js:2` (puerto MIT del `drawEyes()` de `windows/src/mochi/engine.ts:749-784`) + `packages/avatar/src/runtime/{micro,states,sound}.js`. **Corrección de la Ola 2:** la afirmación de la Ola 1 ("`@ego/avatar` tiene **0 imports** en el workspace; la app ejecuta la copia vendorizada") es **falsa** desde la Ola 1b: `apps/desktop/renderer/floating/floating-avatar.tsx:86` importa `@ego/avatar/runtime/avatar-element.js`, `floating-sound.ts:384` importa `@ego/avatar/runtime/sound.js` y `apps/desktop/renderer/components/character/CharacterBadge.tsx:21` importa el elemento. **Decisión D5 del owner (2026-10-19) revisada:** se mantienen las tres copias **en el repo** (upstream / paquete / vendorizada, esta última sólo para la cadena MIT y la puerta `sync:check`), pero la **vendorizada no se importa**. **Pendiente residual:** `packages/avatar/src/render/projection.js` sólo se publica en el barrel `packages/avatar/src/index.js:58`; `render/eyes.js` no lo consume → el puerto de `drawEyes` queda sin caller (decisión pendiente del owner: integrarlo en el render path o retirar la exportación). | Ego: `CANV-11`, `CORE-05` | `COUC-18` |
| `COUC-22` | 🔵 Futura | **Notificaciones Móviles y Bridge Remoto de Aprobación HITL** | `relay/src/index.ts` (patrón de relay stateless), `NotchBuddy/Sources/App/PhoneLink/ApprovalRelay.swift` | 🟣 3d | 🔵 P3 | ⏳ Futura (P1) | *Fila creada 2026-10-19* (el ID solo aparecía en la matriz de fases §3, sin fila en el catálogo). Requiere un canal de red saliente + relay stateless + credenciales por dispositivo, incompatible con el modelo *local-first soberano* del desktop sin la capa de relay que `docs/extractions/coucou.md` §36 especifica pero que Ego no tiene implementada. Fase destino: P1 (`INT-04`, `DOM-04`). **Corrección de la Ola 2:** la ruta del fuente era `windows/src/core/relay.ts`, que **no existe**; el relay real es `relay/src/index.ts` (Cloudflare Worker). | Ego: `INT-04`, `DOM-04` | `COUC-04` |
| `COUC-23` | 🔵 Futura | **Independización Geométrica de Ego & Catálogo Procedural Extendido** | `packages/subegos/src/CharacterProfile.ts` | 🟡 1-2d | 🔵 P2 | ✅ Completada | Independización geométrica y catálogo procedural extendido con `@ego/avatar` sin `coucou-mochi`: formas nativas de Sub-Egos (`delta-core`, `squircle-core`, `monolith-core`, `polyhedron-core`) y soporte para morphing dinámico multi-geometría en el runtime. **Evidencia (corregida 2026-10-20):** `packages/subegos/src/CharacterProfile.ts:126,129` (`CharacterProfileSchema`) consumido por `packages/subegos/src/SubEgoManifest.ts:2,117` -> `apps/desktop/src/main.ts:21`; espejo en el renderer en `apps/desktop/renderer/components/character/wardrobe/characterProfileBridge.ts:1-6` y `WardrobeSelector.tsx:8`. | Ego: `SUB-11`, `CHAR-12`, `CANV-11` | `COUC-21` |
| `COUC-24` | 🟠 Alta | **Preservación de Permisos POSIX en la Escritura Atómica** | `NotchBuddy/Sources/App/HookServer.swift:243` (`chmod 0600`), `:1167,1171` (dir `0700`, wrapper `0755`) | 🟢 0.5d | 🟠 P1 | 🆕 Pendiente | *Fila nueva (Ola 2, 2026-10-20).* Coucou no sólo escribe atómicamente: fija el modo del fichero antes de usarlo. En Ego, `packages/tools/src/native/fs/NativeFsTool.ts:164-171` y `packages/execution/src/SafeConfigMutation.ts:164-173` escriben en un temporal con los permisos por defecto del proceso y lo renombran, de modo que un `.env` o una clave en `0600` queda en `0644` tras una escritura. **Cableado pendiente:** leer `mode` con `fs.promises.stat()` antes de escribir y aplicar `fs.promises.chmod(tmpPath, mode)` sobre el temporal antes del `rename`, en ambos módulos — owner A3 (tools) con A2 (execution). **Prueba:** escribir sobre un fichero `0600` y verificar que el modo se conserva. | Ego: `ACT-04`, `SEC-04`, `REC-02` | `COUC-11` |
| `COUC-25` | 🟠 Alta | **Evaluador de Atención y Señal de Atención (`AttentionEvaluator` / `AttentionSignal`)** | `NotchBuddy/Sources/App/IslandStateMachine.swift`, `windows/src/island/hooks.ts:306-314` | 🟡 1d | 🟠 P1 | 🆕 Pendiente | *Fila nueva (Ola 2, 2026-10-20).* La ficha §14 y §15 describen un evaluador que traduce atributos de evento (importancia, urgencia, riesgo, foco actual) a una decisión de superficie y un tipo `AttentionSignal`. Ego tiene **sólo la mitad receptora**: `packages/runtime/src/AttentionStateMachine.ts:84` consume un `state` y un `priority` que alguien ya decidió, y la decisión real está cableada a mano en `apps/desktop/src/main.ts:520-554` (distingue sólo "hay HITL" de "hay trabajo activo"). El tipo `AttentionSignal` no existe en el workspace. **Cableado pendiente:** `packages/runtime/src/AttentionEvaluator.ts` que traduzca un `EgoEvent` (severidad, `riskLevel`, foco de la ventana) a un `AttentionRequest` de la FSM, invocado desde `recomputeFloatingAttention` — owner A2 (runtime) con A4 (renderer). | Ego: `TASK-04`, `DS-02`, `CORE-06` | `COUC-06` |
| `COUC-26` | 🟡 Media | **Presupuesto, Salud y Degradación del Worker en Background** | `NotchBuddy/Sources/App/GitHubPulse.swift` y los 7 pollers de `NotchBuddy/Sources/App/` | 🟡 1d | 🟠 P1 | 🆕 Pendiente | *Fila nueva (Ola 2, 2026-10-20).* La ficha §37 pide que cada worker declare prioridad, schedule, condición de ejecución, presupuesto de recursos, cancelación, backoff, última ejecución exitosa y salud. `packages/tasks/src/BackgroundEngine.ts:39` implementa prioridad (`:113-115`), concurrencia, timeout, política de aprobación y checkpoints, pero **no** implementa schedule, backoff, presupuesto, health ni última ejecución exitosa. **Cableado pendiente:** extender `TaskDefinition` con `schedule`, `backoffMs`, `resourceBudget` y `lastSuccessfulRun`, y exponerlos por IPC — owner A3 (tasks). | Ego: `TASK-01`, `TASK-04`, `DS-02` | `COUC-06` |
| `COUC-27` | 🟠 Alta | **Capacidad de Presencia de Secreto (el renderer nunca ve el valor)** | `windows/src/core/bridge.ts:91-93` (`secretPresent`, `secretSet`, `secretClear`) | 🟢 0.5d | 🔴 P0 | 🚫 Descartada (con justificación) | *Fila nueva (Ola 2, 2026-10-20).* Coucou expone presencia de clave al renderer (`secretPresent`) sin revelar nunca el valor. Ego ya lo tiene **en forma más estricta**: `packages/security/src/CredentialManager.ts:414` (`hasSecret` — sólo presencia) más `apps/desktop/src/main/credentials/vault.ts` (keychain del SO, con `encrypt`/`decrypt` exclusivamente en main). Se descarta **por sustitución**, no por no aplicar: el módulo canónico de `@ego/security` es más estricto (integración con el keychain del sistema operativo frente a un almacén propio en Rust). | Ego: `SEC-03`, `CORE-01` | — |
| `COUC-28` | 🟠 Alta | **Resumen de Acción en el Core (`ActionSummarizer`)** | `windows/src/island/hooks.ts:298` (`approvalTarget`) | 🟡 1d | 🟠 P1 | 🆕 Pendiente | *Fila nueva (Ola 2, 2026-10-20).* La ficha §38 establece que "la UI nunca debería construir sus propios resúmenes a partir de raw tool input". Hoy el flotante lo hace: `apps/desktop/renderer/floating/floating.tsx:210` calcula la línea de display con `commandFor(toolName, args)` a partir del input crudo, mientras el camino principal ya lo resuelve en main (`apps/desktop/src/main.ts:2547`, `pickString(args["command"])`). Dos rutas de resumen = dos verdades. **Cableado pendiente:** `packages/execution/src/ActionSummarizer.ts` que produzca la línea de display a partir de `toolName` + `arguments`, y que el campo `command` viaje ya calculado en `WidgetPresentationRequest` (`packages/execution/src/WidgetHitlBridge.ts:4-17`) — owner A2. | Ego: `ACT-04`, `CANV-02` | `COUC-03` |
| `COUC-29` | 🟠 Alta | **Segunda Implementación de la Identidad de Acción (`ApprovalIdentity` huérfano)** | `NotchBuddy/Sources/App/AppState.swift:343` (`pendingApproval`) | 🟢 0.5d | 🟠 P1 | 🚫 Descartada (con justificación) | *Fila nueva (Ola 2, 2026-10-20).* `packages/events/src/ApprovalIdentity.ts:53` implementa `buildApprovalIdentity` + `assertSameApproval` con los mismos campos (`runId`, `taskId`, `subEgoId`, `toolId`, `inputDigest`) que el canónico `packages/execution/src/ApprovalEngine.ts:75` (`computeActionIdentity`), pero **sin caller** (sólo el reexport `packages/events/src/index.ts:7` y su test). Dos contratos de identidad de acción son la misma deriva que la Ola 2 detectó en `ContextProvider` (`COUC-16`) y en `PayloadRef` (`COUC-08`). Se descarta **por sustitución**: el canónico en producción es `packages/execution/src/ApprovalEngine.ts:75`, que además recomputa el digest server-side. | Ego: `ACT-04`, `SEC-06` | `COUC-03` |

---

## 3. Matriz de Integración con el Backlog Maestro ##

Las 29 tareas de Coucou se integran formalmente en las fases de Ego como herramientas de robustecimiento:

```text
Fase 01 (Core Cognitivo)
  ├── COUC-01: EventNormalizer (Ingreso universal de eventos)
  ├── COUC-05: Desacoplamiento en 7 Stores de Estado
  ├── COUC-15: Mock IPC para desarrollo ágil en navegador
  ├── COUC-20: SoundEngine (Feedback auditivo cognitivo)
  └── COUC-27: Presencia de secreto sin revelar el valor

Fase 02 (Acción & Tools)
  ├── COUC-02: Event Ingress No Bloqueante
  ├── COUC-03: ActionIdentity (Digest criptográfico para HITL)
  ├── COUC-04: Interactive Admission con ACK
  ├── COUC-10: SafeConfigMutationService
  ├── COUC-11: Escritura Atómica y Preservación de Permisos
  ├── COUC-24: Preservación de permisos POSIX al escribir
  ├── COUC-28: ActionSummarizer en el core
  └── COUC-29: Identidad de acción (canónica única)

Fase 04 (Dynamic Workspace)
  ├── COUC-07: ChangeSetService & DiffEngine
  ├── COUC-08: PayloadRef (Desacoplamiento de datos pesados)
  ├── COUC-14: SyntheticRuntime (Modo Demo y Fixtures)
  ├── COUC-17: Dynamic Island Flotante en Electron (Overlay)
  ├── COUC-18: Spring Physics para animaciones fluidas
  └── COUC-21: Motor de Avatar Cognitivo Procedural 2D

Fase 07 (Tasks & Background)
  ├── COUC-06: AttentionStateMachine
  ├── COUC-09: RunRecorder (Persistencia de ejecuciones en VantaDB)
  ├── COUC-12: IntervalSet (Métricas de tiempo sin solapamiento)
  ├── COUC-16: ContextProvider (Captura de contexto de ventana)
  ├── COUC-19: System Tray de Windows con código de color
  ├── COUC-25: Evaluador de atención y AttentionSignal
  └── COUC-26: Presupuesto y salud del worker en background

Fase 11 (Seguridad)
  └── COUC-13: ResourcePolicy & Safe URLs

Fase Futura (P1 / Extensiones Remotas & Desacoplamiento)
  ├── COUC-22: Notificaciones y aprobación remota en teléfono
  └── COUC-23: Independización Geométrica de Ego & Catálogo Procedural Extendido
```

> **Nota (2026-10-20, Ola 2):** el catálogo canónico son **29 filas** (`COUC-01..29`, sin huecos).
> La matriz de fases anterior listaba 22 tareas; la Ola 1 lo elevó a 23 al crear la fila `COUC-22`
> y dejar `COUC-12` (IntervalSet) y `COUC-16` (ContextProvider) en `🚫 Descartada (con justificación)`.
> La Ola 2 añade seis filas (`COUC-24..29`) y revisa los veredictos de `COUC-07`, `COUC-08`, `COUC-10`
> (a `🆕 Pendiente`) y `COUC-21` (a `✅ Completada`).

---

## 4. Deuda abierta derivada de esta verificación (→ handoff A5) ##

| # | Ítem | Tipo | Owner | Bloqueante |
|---|---|---|---|---|
| D1 | ~~`COUC-21`: `@ego/avatar` sin dependents en el workspace~~ **RESUELTO (Ola 2):** el paquete tiene 3 callers de producción; la copia vendorizada se conserva pero no se importa | Código | A6 | No |
| D2 | `COUC-16`: unificar el contrato `ContextProvider` entre `packages/tasks` y `renderer/floating/upload-canvas.ts` | Código | A2/A4 | No |
| D3 | ~~`COUC-13`: consolidar la política de URLs en `@ego/security`~~ **RESUELTO:** sólo `@ego/security` está cableado | Código | A2/A3 | No |
| D4 | `COUC-05`: `packages/ui-runtime/src/stores/EgoStateStores.ts` queda como módulo muerto si no se retira | Código | A3 | No |
| D5 | `COUC-10` / `COUC-07` / `COUC-08`: `SafeConfigMutationService` (y, en cascada, `ChangeSetService` y `payloadRef`) son **código muerto** — ningún import en `packages/` ni `apps/desktop/`. Decidir el consumidor real (instalador de hooks de agente externo o persistencia MCP en fichero) | Código | A2/A3 | No |
| D6 | `COUC-24`: la escritura atómica de Ego no preserva el modo del fichero (`0600` → `0644`) | Código | A3/A2 | No |
| D7 | `COUC-21` residual: `packages/avatar/src/render/projection.js` (puerto de `drawEyes`) sólo se publica en el barrel; `render/eyes.js` no lo consume | Código | A6 | No |
| D8 | `COUC-16` + `COUC-29`: dos contratos duplicados vivos (`ContextProvider` y `ApprovalIdentity`) sin caller, que sólo esperan cableado | Código | A2/A3 | No |

---

## 5. Correcciones de la Ola 2 (2026-10-20) ##

Detalle auditable de lo que cambió respecto al catálogo de la Ola 1. El detalle por tarea vive en
la tabla §2; aquí queda el resumen de las afirmaciones que resultaron **inexactas o falsas**.

| ID | Afirmación de la Ola 1 | Realidad verificada | Cambio de estado |
|---|---|---|:---:|
| `COUC-07` | Caller transitivo `SafeConfigMutation.ts → McpManager.ts → main.ts:23` | `McpManager.ts:85` sólo menciona el módulo en un comentario; `SafeConfigMutationService` no tiene ningún import en producción | 🆕 Pendiente |
| `COUC-08` | `payloadRef` en producción por herencia de `COUC-07` | Hereda el hueco: sólo se alcanza desde `SafeConfigMutation`, que es código muerto | 🆕 Pendiente |
| `COUC-10` | `McpManager.ts` y `McpClient.ts` son callers de `SafeConfigMutation` | Ambos sólo lo nombran en comentarios; el `reload()` de `McpClient.ts:220-248` hace rollback en memoria, sin preview, sin fingerprint y sin escritura de fichero | 🆕 Pendiente |
| `COUC-11` | Preservación de permisos implementada; caller en `main.ts:3086` | La preservación de permisos **no** existe (tmp + rename sin `chmod`); el caller real está en `main.ts:2148` | ✅ Completada (con la mitad de permisos derivada a `COUC-24`) |
| `COUC-16` | Duplicidad de `ContextProvider` a resolver | **No** resuelta: sigue el contrato del renderer en `upload-canvas.ts:649-654` | 🚫 Descartada (sin cambio) |
| `COUC-18` | Consumidores de `floating-anim.ts`: `countdown.tsx:12`, `ticker.ts:13`, `views.tsx:8` | `views.tsx:8` es un comentario de cabecera, no un import | ✅ Completada (evidencia corregida) |
| `COUC-21` | `@ego/avatar` tiene 0 imports; la app ejecuta la copia vendorizada | Hay 3 imports del paquete en producción (`floating-avatar.tsx:86`, `floating-sound.ts:384`, `CharacterBadge.tsx:21`); la vendorizada no se importa | ✅ Completada |
| `COUC-22` | Fuente en `windows/src/core/relay.ts` | Ese fichero no existe; el relay real es `relay/src/index.ts` | ⏳ Futura (P1) |
| Todas | Citas de `apps/desktop/src/main.ts` (`23`, `27`, `30`, `32`, `170-173`, `186-193`, `281`, `535-590`, `648-715`, `3086`) | Todas desfasadas salvo dos; las líneas reales son `11`, `15`, `20`, `21`, `59-62`, `83-90`, `237-239`, `500-554`, `613`, `2148`, `2441-2465`, `2763` | — |

Además, las rutas de la columna "Archivo Coucou" estaban abreviadas y **no resolvían** (por ejemplo
`NotchBuddy/HookServer.swift`); ahora apuntan a la ruta real dentro del clon
(`NotchBuddy/Sources/App/HookServer.swift`, `NotchBuddy/Sources/CoucouKit/DiffEngine.swift`, etc.).

> **Aviso de sincronización (no aplicado por esta revisión):** `docs/extractions/README.md` §4.1 y
> `docs/roadmap/Backlog.md` siguen declarando el recuento anterior de `coucou` (23 tareas:
> 12 / 4 / 6 / 1) y el estado `✅ Completada` de `COUC-10`. La tabla maestra y el backlog maestro
> deben re-sincronizarse con **10 / 6 / 12 / 1 / 29** (y `COUC-07`, `COUC-08`, `COUC-10` como
> `🆕 Pendiente`) por el agente owner de esos ficheros.
