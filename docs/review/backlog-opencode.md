---
title: OpenCode Review & Extraction Backlog — Ego SOC
kind: review
status: active
description: "Backlog especializado para la revisión, extracción de patrones y adaptación técnica de opencode (sst/opencode) hacia el monorepo de Ego."
tags: [ego, opencode, extraction, review, runtime, permissions, compaction, tools, electron]
schema: "10-column canonical schema (.agents/references/backlog-format.md compatible)"
---

## Backlog de Revisión y Extracción: OpenCode (sst/opencode) ##

> **Subtítulo:** Runtime Cognitive de referencia — gobernanza de permisos, admisión idempotente de
> prompts, compactación negociada con el proveedor, registro de tools con namespaces, snapshots
> direccionados por contenido y aislación de Electron.

| Campo | Valor |
| --- | --- |
| Estado | Activo — revisión inicial ejecutada, sin asimilaciones todavía |
| Repositorio Origen | `repos-referencia/opencode/` (commit `db45c95`, rama `dev`, MIT) |
| Total de Tareas | **9** (`OCDE-01..09`) |
| Fases Impactadas en Ego | Fase 01 (`CORE`), Fase 02 (`ACT`), Fase 06 (`KB`), Fase 07 (`TASK`), Fase 10 (`REC`), Fase 11 (`SEC`), Fase 12 (`DIST`) + P1 |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Última verificación | 2026-10-20 — inspección directa del clon + grep de contraparte en `packages/` y `apps/desktop/` |

> **Regla de Operación:** *No copiar código directamente*. Extraer la lógica de diseño, contratos y
> patrones arquitectónicos, reescribiendo limpiamente en TypeScript estricto sobre Node 22, React 19
> y VantaDB.
> **Esquema:** Tabla canónica de 10 columnas: `ID`, `Severidad`, `Hallazgo`, `Archivo OpenCode`,
> `Esfuerzo`, `Prioridad`, `Estado`, `Descripción & Adaptación en Ego`, `Relaciones Ego`, `Dependencias`.

---

## 0. Verificación de estado ##

Cada hallazgo se auditó contra el **código real** del clon (`repos-referencia/opencode/`, commit
`db45c95`). Criterio de `✅ Completada`: existe el fichero adaptado **y** hay un caller en producción
(grep sobre `packages/` + `apps/desktop/`, excluyendo `test/`, `dist/` y `node_modules/`).

| Estado | Significado canónico |
|---|---|
| `✅ Completada` | Asimilado, integrado y con **caller en producción verificado**. La celda cita la ruta real. |
| `🚫 Descartada (con justificación)` | El patrón no se aplica en Ego, fue sustituido por otro módulo canónico, o viola un guardrail. La celda contiene el motivo técnico. |
| `🆕 Pendiente` | Patrón identificado y asimilable, **sin fichero adaptado ni caller en producción**. La celda dice el cableado exacto y quién lo ejecuta. |
| `⏳ Futura (fase)` | Diferido a una fase posterior, con fase destino explícita y motivo del diferimiento. |

**Nota de alcance — repositorio nuevo.** OpenCode no figuraba en los siete backlogs de extracción
previos (`docs/extractions/README.md` §3). **Ninguna capacidad de este repo ha sido asimilada
todavía**, por lo que **ninguna fila puede cerrar en `✅ Completada`**. Verificación ejecutada:

```text
grep -rE "codemode|CodeMode|Ruleset|doorbell|SessionInbox|shrinkSteps|SHRINK_STEPS|replayable" packages/ apps/desktop/
  -> 0 coincidencias (packages/ y apps/desktop/, sin test/ ni dist/)

grep -rn "setPermissionRequestHandler|setPermissionCheckHandler" apps/desktop/src
  -> 0 coincidencias  (hueco real de hardening: OCDE-07)

grep -rn "inbox|Inbox|steer|pendingPrompt" packages/
  -> packages/subegos/src/DelegationRouter.ts:245-246 (steerQueue EN MEMORIA, sólo delegación)
     + 1 comentario en packages/avatar/vendor/coucou/core/bridge.ts:88 (código vendorizado, no aplica)
```

---

## 1. Resumen Ejecutivo de Tareas de Extracción ##

OpenCode aporta a Ego cuatro patrones de runtime que el SOC todavía no tiene resueltos: **concesión
de permisos persistida y rechazo en lote**, **admisión de prompts idempotente y durable**,
**compactación que negocia con el proveedor cuando el contexto no cabe** y **registro de tools con
namespaces y captura por revisión**. Aporta además dos huecos de seguridad concretos
(`setPermissionRequestHandler` ausente) y de recuperación (snapshot de filesystem direccionado por
contenido). Todo lo demás —Effect, Bun, SQLite/Drizzle, Solid.js, OpenTUI, Code Mode y los sublotes
de Salesforce/Astro— queda descartado con justificación.

### MATRIZ DE DISTRIBUCIÓN POR FASE ###

```text
Fase 01  CORE   [OCDE-02]  inbox durable + admisión idempotente
                [OCDE-03]  compactación con escalera de reducción
Fase 02  ACT    [OCDE-01]  reglas con comodines + concesión "always" + rechazo en lote
                [OCDE-04]  registro de tools con namespaces y captura por revisión
Fase 06  KB     [OCDE-03]  plantilla de checkpoint estructurado (archivo en kb/history_archive)
Fase 07  TASK   [OCDE-06]  coordinador de ejecución por clave (timbre + interrupt)
Fase 10  REC    [OCDE-05]  snapshot de filesystem direccionado por contenido
Fase 11  SEC    [OCDE-01]  reglas de permiso fail-closed por Sub-Ego y sesión
                [OCDE-07]  handlers de permisos de Electron + credencial por frame
Fase 12  DIST   [OCDE-07]  hardenimiento del renderer empaquetado
P1 / futuro      [OCDE-09]  servicio local + emparejamiento de un solo uso (fuera de P0)
Descartada       [OCDE-08]  Code Mode (JS confinado componiendo tool calls)
```

#### Recuento de estados (verificado sobre las 9 filas de la tabla §2) ####

| `✅ Completada`\| `🚫 Descartada`\| `🆕 Pendiente`\| `⏳ Futura` | Total |
| :---: | :---: | :---: | :---: | :---: |
| 0 | 1 | 7 | 1 | **9** |

---

## 2. Catálogo Detallado de Extracción (10 Columnas Canónicas) ##

| ID | Severidad | Hallazgo | Archivo OpenCode | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| `OCDE-01` | Crítica | **Concesión de permisos persistida (`always`) + rechazo en lote con feedback** | `packages/core/src/permission.ts:269-329` · `packages/core/src/permission/saved.ts:72-116` | Alta (2-3d) | P0 | 🆕 Pendiente | Semántica a extraer: (a) reglas con comodines donde **gana la última que coincide** (`permission.ts:87-97`, `findLast`); (b) el ruleset se fusiona con el del agente y el de la sesión, fail-closed si el agente no resuelve (`permission.ts:19`, `:148-163`); (c) `reply()` persiste la concesión `always` por proyecto (`saved.add`, `:303-309`) y auto-aprueba las pendientes equivalentes (`:314-326`); (d) `reject` cancela **todas** las peticiones de la sesión (`:286-299`) y, si hay feedback, responde `CorrectedError` para que el modelo se autocorrija (`:283`). **Adaptación:** `packages/execution/src/ApprovalEngine.ts` sólo resuelve un veredicto por llamada; añadir el evaluador de ruleset, la columna `always` persistida en `gov/permissions` y el batch-reject de sesión, reutilizando `packages/events/src/ApprovalIdentity.ts` como digest de la acción. **Fichero adaptado: NO EXISTE.** Cableado: `ApprovalEngine.reply()` + `packages/security/src/ToolPermissions.ts` (hoy emite `allow \| deny \| requireApproval` sin ruleset). Responsable: owner A2 (Execution). | Ego: `ACT-06`, `ACT-07`, `INT-05`, `SEC-05`, `SEC-06` · Ficha: `docs/extractions/opencode.md` §2 Bloque A | `HERM-03` (tarjeta HITL ya en producción) |
| `OCDE-02` | Crítica | **Inbox durable de prompts con admisión idempotente y entrega `steer`/`queue`** | `packages/core/src/session/inbox.ts:155-202` · `:496-531` · `:277-336` | Alta (2-3d) | P0 | 🆕 Pendiente | Separar **admitir** (durable e idempotente: `reconcile()` devuelve la fila existente y el reintento con el mismo ID es no-op; reutilización cruzada de sesión o de tipo ⇒ `LifecycleConflict`) de **entregar** (visible al modelo): `promote()` da prioridad al `steer` y los controles `compaction`/`move` cortan la promoción; la tabla es *pending-only* y la entrega inserta el mensaje visible y borra la fila en la misma transacción. **Adaptación:** crear `packages/runtime/src/SessionInbox.ts` sobre `EgoMemoryAdapter` (namespace `session/inbox`), con `admit` idempotente por ID de ítem y `promote` en el boundary de paso; cablear la admisión en el IPC de prompt (`apps/desktop/src/ipc/schema.ts`). **Fichero adaptado: NO EXISTE.** Hoy Ego sólo tiene un `steerQueue` **en memoria** en `packages/subegos/src/DelegationRouter.ts:245-246`, que se pierde al reiniciar y no cubre la admisión del prompt de usuario. Responsable: owner A2 (Runtime). | Ego: `CORE-07`, `CORE-12`, `TASK-02`, `TASK-03` · Ficha: `docs/extractions/opencode.md` §2 Bloque B | `CORE-06` (adaptador de memoria) |
| `OCDE-03` | Alta | **Compactación que negocia con el proveedor (escalera 70/50/35 %) + checkpoint estructurado** | `packages/core/src/session/compaction.ts:93-108` · `:397-487` · `:110-149` | Media (1-2d) | P0 | 🆕 Pendiente | La compactación de OpenCode no es un umbral fijo: al rechazo "too long" del proveedor reintenta al 70 %, 50 % y 35 % del tamaño estimado (`SHRINK_STEPS`), distingue "payload too large" (medios en línea) de "contexto demasiado largo", y sustituye el historial por un checkpoint con secciones fijas (Objective, Requirements, Decisions, Work State, Next Move, Relevant Files, Important Context). **Adaptación:** `packages/runtime/src/ContextCompaction.ts` decide hoy por umbral/ratio (`compressionThreshold` 0.50, `autoCompactTokens` 200000) y no tiene escalera de reducción ni plantilla; añadir ambas y **cerrar `EGO-FIND-21`** (motor `ContextCompactionJob` sin instanciar en `src/`). **Fichero adaptado: NO EXISTE.** Responsable: owner A2 (Runtime). | Ego: `EGO-FIND-21`, `EGO-FIND-40`, `CORE-04` · Ficha: `docs/extractions/opencode.md` §2 Bloque C | `CORE-03` (ModelRouter como resumidor) |
| `OCDE-04` | Alta | **Registro de tools con namespaces, prioridad por revisión y captura por turno** | `packages/core/src/tool.ts:161-226` · `packages/core/src/tool/runtime.ts:278-281` · `packages/core/src/tool/AGENTS.md` | Media (1-2d) | P0 | 🆕 Pendiente | El registro no es un `Map` mutable sino un conjunto de transformaciones reejecutables (`State.create` + `transform`/`reload`): la última definición registrada válida gana, `dispose` es idempotente y **revela la definición anterior**; `snapshot(permissions)` captura definiciones *y* ejecutores por revisión, de modo que un `reload` posterior no altera una ejecución en vuelo. El nombre efectivo se aplana a `<namespace>_<tool>`. **Adaptación:** `packages/tools/src/ToolRegistry.ts` sólo expone `register`/`registerMany`/`unregister`; añadir namespace, prioridad por revisión y `snapshot()` por turno en `packages/runtime/src/ToolExecutionLoop.ts`. **Fichero adaptado: NO EXISTE.** Responsable: owner A4 (Tools). | Ego: `ACT-01`, `ACT-02`, `ACT-11` · Ficha: `docs/extractions/opencode.md` §2 Bloque A | `OCDE-01` (el filtrado por permisos usa el ruleset) |
| `OCDE-05` | Alta | **Snapshot de filesystem direccionado por contenido + restore selectivo con anti-escape** | `packages/core/src/snapshot.ts:90-143` · `:196-213` | Alta (2-3d) | P1 | 🆕 Pendiente | El estado del workspace se versiona como árbol de objetos en un repositorio git dedicado por proyecto (`<data>/snapshot/<projectID>/<hash>`), con `capture` best-effort que nunca rompe el flujo; `restore` valida contención de rutas (`FSUtil.contains` → "Path escapes the project") y sólo toca las rutas seleccionadas. **Adaptación:** `packages/recovery/src/SnapshotManager.ts` empaqueta y restaura **proyectos** (`.vdbdump`), no el filesystem del workspace; crear `packages/recovery/src/WorkspaceSnapshot.ts` y cablearlo en `packages/execution/src/SafeConfigMutation.ts` antes de escrituras destructivas. **Fichero adaptado: NO EXISTE.** Responsable: owner A3 (Recovery). | Ego: `REC-01`, `REC-05`, `ACT-04` · Ficha: `docs/extractions/opencode.md` §2 Bloque C | `COUC-11` (snapshot previo a escritura) |
| `OCDE-06` | Media | **Coordinador de ejecución por clave: un fibre, timbre coalescente e interrupción con reclamo** | `packages/core/src/session/run-coordinator.ts:60-120` | Media (1-2d) | P1 | 🆕 Pendiente | `make()` serializa por clave (sesión) y permite concurrencia entre sesiones: `wake` es un timbre que coalesce, `run` une a la ejecución activa y devuelve su salida, `interrupt` reclama las pendientes y dispara la interrupción sin esperar al cleanup, `awaitIdle` sigue a los sucesores. **Adaptación:** `packages/tasks/src/BackgroundEngine.ts` es una cola con prioridad y tope de concurrencia, sin serialización por sesión ni semántica de interrupción; extraer el coordinador a `packages/tasks/src/SessionRunCoordinator.ts` y cablearlo en el engine. **Fichero adaptado: NO EXISTE.** Responsable: owner A3 (Tasks). | Ego: `TASK-01`, `TASK-04`, `TASK-09`, `TASK-10` · Ficha: `docs/extractions/opencode.md` §2 Bloque B | `TASK-03` (checkpoints) |
| `OCDE-07` | Crítica | **Handlers de permisos de Electron + credencial sólo para el frame top-level del renderer** | `packages/desktop/src/main/windows/security.ts:8-22` · `:24-35` · `:37-63` · `headers.ts:11-24` | Baja (0.5-1d) | P0 | 🆕 Pendiente | Separa tres planos que Electron suele mezclar: (a) **permisos del navegador** — allowlist explícita (`clipboard-sanitized-write`, `notifications`) más comprobación de `webContents.id` y del origen solicitante; (b) **política de navegación** deny-by-default con apertura externa; (c) **propagación de credenciales** — la cabecera `Authorization` sólo se inyecta si el frame es top-level del renderer, de modo que webviews y service workers no heredan el acceso. **Hueco real en Ego:** `apps/desktop/src/main/security/electron-security.ts:138-149` cubre `will-navigate` y `setWindowOpenHandler`, pero **no** instala `setPermissionRequestHandler` / `setPermissionCheckHandler` (grep: 0 ocurrencias en `apps/desktop/src`), por lo que las peticiones de permisos del navegador quedan en el default de Electron. **Fichero adaptado: NO EXISTE.** Cableado: añadir los dos handlers a `applyNavigationGuards` y test que compruebe que un permiso no listado se deniega. Responsable: owner A4 (Desktop). | Ego: `SEC-01`, `SEC-02`, `CORE-02`, `DIST-03` · Ficha: `docs/extractions/opencode.md` §2 Bloque C | — |
| `OCDE-08` | Crítica | **Code Mode: runtime JS confinado que compone llamadas a tools sin turnos de modelo** | `packages/core/src/codemode/tool.ts:71-78` · `packages/core/src/tool.ts:236-255` | — | — | 🚫 Descartada (con justificación) | El runtime Code Mode ejecuta JavaScript en un sandbox donde `tools.<ns>["tool"](input)` encadena invocaciones **sin pasar por el loop de modelo**, con lo que se suprime la granularidad de aprobación HITL que imponen el principio 6 y el `ApprovalEngine` (`ACT-06`, `ActionIdentity` por tool call). Un kernel que encadena llamadas internamente no puede sellar cada eslabón de la cadena. **Fundamento:** guardrail de gobernanza del `AGENTS.md` §2 (principio 6) y coherencia con el descarte ya registrado en `HERM-18`. **Alternativa vigente:** `OCDE-04` (captura por revisión) + `EGO-FIND-21` (compactación sin perder turnos). | Ego: `ACT-06`, `ACT-07` · Ver: `docs/extractions/hermes-agent.md` §5 (`HERM-18`) | `OCDE-01` |
| `OCDE-09` | Media | **Servicio local HTTP con credencial de un solo uso y emparejamiento por código TTL** | `packages/server/src/pairing.ts:24-31` · `packages/desktop/src/main/service/background-service.ts:32-60` | Alta (3d) | P3 | ⏳ Futura (P1) | Emisión de un código `base64url` de 16 bytes con TTL de 5 minutos y **consumo único** (`Cache.invalidateWhen`) para autorizar a un cliente remoto; el desktop mantiene un servicio residente separado del shell con credencial inyectada por el main. **Motivo del diferimiento:** exige canal de red saliente y una superficie de autenticación que el desktop local-first no necesita en P0; `AGENTS.md` §2 (principio 9) prioriza la soberanía local. **Fase destino: P1 (Ego Web / control remoto).** No hay trabajo de código en P0. | Ego: `INT-04`, `DIST-05` · Ficha: `docs/extractions/opencode.md` §2 | — |

---

## 3. Matriz de Integración con el Backlog Maestro ##

Las tareas `OCDE-*` se ejecutan como **pre-requisito de diseño y código** de las fases del Backlog
Maestro (`docs/roadmap/Backlog.md`), bajo el Protocolo de Compuertas de Extracción e Inspección
Previa (Opción B).

```text
  Revisión OpenCode (OCDE-01..09) — pre-requisito de diseño y código
    │
    ├─ F01 CORE   → OCDE-02 (inbox idempotente) · OCDE-03 (compactación)
    ├─ F02 ACT    → OCDE-01 (permisos persistidos) · OCDE-04 (registro de tools)
    ├─ F06 KB     → OCDE-03 (checkpoint estructurado)
    ├─ F07 TASK   → OCDE-06 (coordinador de ejecución)
    ├─ F10 REC    → OCDE-05 (snapshot FS por contenido)
    ├─ F11 SEC    → OCDE-01 (ruleset fail-closed) · OCDE-07 (permisos Electron)
    ├─ F12 DIST   → OCDE-07 (hardening del renderer empaquetado)
    ├─ P1         → OCDE-09 (servicio local + pairing)
    └─ Descartada → OCDE-08 (Code Mode)
```

### Protocolo de Extracción por Tarea ###

1. **Lectura y aislamiento:** inspeccionar el fichero fuente en `repos-referencia/opencode/` e
   identificar sus dependencias (`effect`, `drizzle-orm`, `bun`).
2. **Eliminación de acoplamiento:** descartar Effect, SQLite/Drizzle y Bun; reexpresar la semántica
   sobre `EgoMemoryAdapter` (VantaDB) y los módulos canónicos de `packages/`.
3. **Reescritura canónica:** escribir el módulo en `packages/` o `apps/desktop/` con TypeScript
   estricto, sin `any` y sin lógica de negocio en el renderer.
4. **Verificación:** test unitario del módulo + prueba de error (denegación, conflicto de reglas, path
   que escapa del proyecto) + persistencia verificada.
5. **Cierre:** marcar `✅ Completada` **sólo** con fichero adaptado y caller en producción verificado
   por grep; si el patrón no aplica, `🚫 Descartada (con justificación)`; si el módulo no existe
   todavía, `🆕 Pendiente` con el cableado exacto y su responsable.

---

## 4. Deuda abierta derivada de esta verificación (→ handoff owner) ##

| # | Ítem | Tipo | Owner | Bloqueante |
|---|---|---|---|---|
| D1 | `OCDE-01`: el `ApprovalEngine` no tiene concesión persistida (`always`) ni batch-reject; cada "recordar" del usuario se pierde al reiniciar | Código | A2 | No |
| D2 | `OCDE-02`: no existe admisión durable de prompts; el `steerQueue` de `DelegationRouter.ts:246` es en memoria y no cubre el prompt de usuario | Código | A2 | No |
| D3 | `OCDE-03`: la compactación de Ego decide por umbral y nunca negocia con el proveedor; `EGO-FIND-21` sigue con el motor sin instanciar | Código | A2 | No |
| D4 | `OCDE-07`: **hueco de seguridad verificable** — Electron corre sin `setPermissionRequestHandler` / `setPermissionCheckHandler` en `apps/desktop/src` | Seguridad | A4 | No (mitigable en 0.5d) |
| D5 | `OCDE-09`: el emparejamiento y el servicio residente quedan sin fase asignada hasta que el owner defina el alcance de Ego Web | Decisión | Owner | Sí (requiere decisión de producto) |
| D6 | La ficha `docs/extractions/opencode.md` y este backlog **no están todavía enlazados** desde `docs/extractions/README.md` §3 ni desde el bloque de backlogs especializados de `docs/roadmap/Backlog.md:39-47` | Documentación | ness-e | No |
