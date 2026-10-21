# Extracción Técnica: OpenCode (repos-referencia/opencode) #

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de patrones |
| Repositorio Origen | `repos-referencia/opencode/` (upstream `sst/opencode`, commit `db45c95`, origen `packages/core/src/permission.ts`) |
| Licencia del origen | MIT — sst/opencode |
| Commit verificado | db45c95 |
| Ruta de origen | `packages/core/src/permission/sql.ts` |
| Stack del Origen | TypeScript estricto sobre **Effect + Schema** · runtime **Bun** · monorepo **turbo** · persistencia **SQLite/Drizzle** · desktop **Electron 44.4.5 + electron-vite 6** con renderer **Solid.js** · TUI OpenTUI · cliente MCP oficial · licencia MIT |
| Rol en Ego | Referencia de **Runtime Cognitivo**: gobernanza de permisos, admisión idempotente de prompts, compactación de contexto, registro de tools, snapshots direccionados por contenido y aislación de Electron |
| Owner | ness-e |
| Fecha | 2026-10-20 |

> **Alcance real del clon.** El repo **no** contiene `packages/opencode/src/` ni `packages/agent/`
> (el runtime vive en `packages/core/src/`), y el árbol actual es
> `packages/{core,server,client,protocol,schema,desktop,app,ui,tui,plugin,sdk,codemode,web,...}` —
> no hay `packages/codepipeline/`. La ficha cita únicamente rutas verificadas por lectura directa
> sobre el clon.

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia ##

OpenCode resuelve análogamente a Ego cuatro problemas que el SOC tiene abiertos:
**gobernanza de la acción** (permisos con comodines y concesiones persistidas),
**admisión de prompts** (una cola durable e idempotente por sesión),
**gestión de ventana de contexto** (compactación que reacciona al rechazo del proveedor) y
**registro de herramientas** (namespaces, prioridad de registro y captura por revisión).
Su valor para Ego es de **patrón de diseño**, no de código: la arquitectura base es incompatible.

### Divergencias Fundamentales (Qué Descartamos y Por Qué) ###

| Dimensión | OpenCode | Ego (Cognitive OS) | Decisión Crítica |
|---|---|---|---|
| **Base de ejecución** | Effect (`Effect`, `Layer`, `Schema`, `Context.Service`) sobre Bun. | TypeScript estricto sobre Node 22, sin runtime de effects; `AGENTS.md` §1 fija el stack. | **DESCARTAR Effect como dependencia.** Reimplementar el runtime sobre Effect es una reescritura total sin valor de producto. Se extraen *semánticas* (fail-closed, agrupamiento de fallos), no la librería. |
| **Sustrato de persistencia** | SQLite + Drizzle ORM + `Durable Objects` (`packages/core/src/database/`, `packages/core/src/permission/sql.ts`). | `NativeVantaDB` (napi-rs, Fjall LSM) como único sustrato; `AGENTS.md` §4 prohíbe el acceso directo a VantaDB fuera de `EgoMemoryAdapter`. | **DESCARTAR SQLite/Drizzle.** El patrón de admisión idempotente se traduce a operaciones `put`/`get` sobre namespaces `session/*` de VantaDB. |
| **Renderer** | Solid.js (`packages/app`, `packages/ui`, `packages/desktop/src/renderer/desktop-app.tsx`). | React 19 + `@assistant-ui/react` (`AGENTS.md` §1). | **DESCARTAR Solid.** La capa de presentación de Ego ya está decidida y consolidada. |
| **Ejecución de tools** | Code Mode: un runtime JS confinado compone llamadas a tools (`packages/core/src/codemode/tool.ts:71-78`). | Un tool call = un turno de aprobación en el `ApprovalEngine` (principio 6). | **DESCARTAR Code Mode.** Ver `OCDE-08`. |
| **Transporte de la UI** | Servidor HTTP local en loopback + cliente generado (`packages/server/`, `packages/client/`, `packages/protocol/openapi.json`). | IPC tipado de Electron (`contextIsolation=true`, `sandbox=true`). | **DESCARTAR el servidor HTTP como transporte de UI.** Se conserva únicamente el patrón de credencial de servicio local (ver `OCDE-09`). |

---

## 2. Inventario Quirúrgico de Patrones a Extraer ##

### Bloque A: Gobernanza de la acción (permisos y registro de tools) ###

1. **Reglas de permisos con comodines, agente + sesión, fail-closed**
   - **Ubicación:** `packages/core/src/permission.ts:19` (`missingAgentPermissions = deny *`), `:87-100`
     (`evaluate()` con `Wildcard.match` y `findLast` — **gana la última regla que coincide**, no la
     primera), `:148-163` (merge del ruleset del agente con el de la sesión).
   - **Qué hace:** un veredicto `allow | ask | deny` por par (acción, recurso) con comodines en ambos
     ejes, fail-closed cuando el agente no resuelve permisos.
   - **Adaptación en Ego:** ampliar `packages/security/src/ToolPermissions.ts` (que hoy emite
     `allow | deny | requireApproval` por llamada, sin ruleset) con un evaluador de reglas con
     comodines fusionando permisos de Sub-Ego (`packages/subegos/src/SubEgoManifest.ts`) y de sesión.
   - **Relación con Backlog Ego:** `ACT-06`, `SEC-05`, `SEC-06`.

2. **Concesión persistida `always` + rechazo en lote con feedback**
   - **Ubicación:** `packages/core/src/permission.ts:269-329` (`reply()`: `always` → `saved.add()` en
     `:303-309` y auto-aprobación de pendientes equivalentes en `:314-326`; `reject` → cancela **todas**
     las peticiones de la misma sesión en `:286-299`, con `CorrectedError` si el usuario aporta
     feedback, `:283`); persistencia en `packages/core/src/permission/saved.ts:72-116` (índice único
     por proyecto → `ConflictError`).
   - **Qué hace:** la respuesta del usuario a una aprobación no es un booleano de un turno: es una
     **política** que puede persistir, que cancela en lote las peticiones equivalentes y que
     transporta feedback correctivo al modelo.
   - **Adaptación en Ego:** `ApprovalEngine` (`packages/execution/src/ApprovalEngine.ts`) no tiene hoy
     concesión persistida ni cancelación en lote; el feedback ya existe como `ActionIdentity`
     (`packages/events/src/ApprovalIdentity.ts`).
   - **Relación con Backlog Ego:** `ACT-06`, `ACT-07`, `INT-05`, `SEC-06`.

3. **Registro de tools con namespaces, prioridad y captura por revisión**
   - **Ubicación:** `packages/core/src/tool.ts:161-226` (estado reconstruible con `State.create`,
     `transform`/`reload`, `snapshot(permissions)` que captura definiciones **y** ejecutores por
     revisión) y `packages/core/src/tool/runtime.ts:278-281` (`effectiveName`: `<namespace>_<tool>`,
     con `.` → `_`); contrato normativo en `packages/core/src/tool/AGENTS.md` (la última definición
     registrada válida gana; `dispose` es idempotente y revela la definición anterior).
   - **Qué hace:** el registro no es un `Map` mutable sino un conjunto de *transformaciones*
     reejecutables (el motor genérico está en `packages/core/src/state.ts:160-252`: `State.create`
     reconstruye el valor aplicando cada transformación en orden, y una transformación agrupada que
     falla se desactiva sin tumbar el resto); cada petición captura su propio snapshot, de modo que un
     `reload` posterior no altera una ejecución en vuelo.
   - **Adaptación en Ego:** `packages/tools/src/ToolRegistry.ts` sólo expone
     `register`/`registerMany`/`unregister`; falta el namespace, la prioridad por revisión y la
     captura por turno.
   - **Relación con Backlog Ego:** `ACT-01`, `ACT-02`, `ACT-11`.

### Bloque B: Admisión de prompts y ciclo de vida de la sesión ###

1. **Inbox durable con admisión idempotente y entrega `steer`/`queue`**
   - **Ubicación:** `packages/core/src/session/inbox.ts:155-202` (`reconcile`/`admit`: **la primera
     admisión gana**; reintento con el mismo ID es idempotente; reutilización cruzada de sesión o de
     tipo → `LifecycleConflict`), `:496-531` (`promote`: el `steer` tiene prioridad y los controles
     `compaction`/`move` cortan la promoción), `:277-336` (proyección: tabla *pending-only*; la
     entrega inserta el mensaje visible y borra la fila de inbox en la misma transacción).
   - **Qué hace:** separa **admitir** (durable, idempotente) de **entregar** (visible al modelo). Un
     prompt del usuario nunca se pierde por un reinicio y nunca se duplica por un reintento de IPC.
   - **Adaptación en Ego:** no existe inbox de prompts;
     `packages/subegos/src/DelegationRouter.ts:245-246` tiene un `steerQueue` **en memoria** (se
     pierde al reiniciar) y sólo para delegación entre Sub-Egos.
   - **Relación con Backlog Ego:** `CORE-07`, `CORE-12`, `TASK-02`, `TASK-03`.

2. **Un único fibre de ejecución por clave, con timbre e interrupción**
   - **Ubicación:** `packages/core/src/session/run-coordinator.ts:60-120` (`make()`: `wake` es un
     timbre que coalesce por clave, `run` une a la ejecución activa, `interrupt` reclama las
     pendientes y dispara la interrupción sin esperar al cleanup, `awaitIdle` sigue a los sucesores).
   - **Qué hace:** serializa por sesión y permite concurrencia entre sesiones, sin cola global ni
     locks externos.
   - **Adaptación en Ego:** `packages/tasks/src/BackgroundEngine.ts` es una cola con prioridad y
     límite de concurrencia; no serializa por clave de sesión ni define la semántica de interrupción.
   - **Relación con Backlog Ego:** `TASK-01`, `TASK-04`, `TASK-09`, `TASK-10`.

### Bloque C: Gestión de contexto, snapshots e isolación de Electron ###

1. **Compactación que reacciona al rechazo del proveedor**
   - **Ubicación:** `packages/core/src/session/compaction.ts:93-108` (`SHRINK_STEPS = [0.7, 0.5, 0.35]`,
     `RESERVE_MIN = 16_000`, `RESERVE_SHARE = 0.15`), `:397-487` (`deliver()`: ante "too long" del
     proveedor reintenta al 70 %, 50 % y 35 % del tamaño estimado; distingue "payload too large"
     —medios en línea— de "contexto demasiado largo"), `:110-149` (plantilla de checkpoint
     estructurada: Objective, Requirements, Decisions, Work State, Next Move, Relevant Files,
     Important Context).
   - **Qué hace:** la compactación no es un umbral fijo sino una **negociación con el proveedor**: si
     el modelo rechaza por longitud, se reduce el objetivo escalonadamente hasta que encaja, y el
     checkpoint conserva estado de trabajo estructurado en lugar de un resumen libre.
   - **Adaptación en Ego:** `packages/runtime/src/ContextCompaction.ts` decide por umbral/ratio
     (`compressionThreshold` 0.50, `autoCompactTokens` 200000) y no tiene escalera de reducción ni
     plantilla de checkpoint. La instanciación del motor sigue abierta en `EGO-FIND-21`.
   - **Relación con Backlog Ego:** `EGO-FIND-21`, `EGO-FIND-40`, `CORE-04`.

2. **Snapshot de filesystem direccionado por contenido**
   - **Ubicación:** `packages/core/src/snapshot.ts:90-143` (repositorio git dedicado por proyecto en
     `<global.data>/snapshot/<projectID>/<hash del worktree>`, `capture` best-effort que nunca rompe
     el flujo) y `:196-213` (`restore` con validación de contención: `FSUtil.contains(worktree,
     absolute)` → "Path escapes the project").
   - **Qué hace:** el estado del workspace se versiona como *árbol de objetos*, no como copia de
     ficheros; los diffs y el restore selectivo salen del mismo sustrato.
   - **Adaptación en Ego:** `packages/recovery/src/SnapshotManager.ts` empaqueta y restaura
     **proyectos** (`.vdbdump`), no el filesystem del workspace; no hay dirección por contenido ni
     restore selectivo por ruta.
   - **Relación con Backlog Ego:** `REC-01`, `REC-05`, `ACT-04`, `COUC-11`.

3. **Aislación de permisos de Electron y cabeceras con credencial por frame**
   - **Ubicación:** `packages/desktop/src/main/windows/security.ts:8-22` (`allowRendererPermissions`:
     allowlist de permisos **y** comprobación de `webContents.id` y del origen solicitante),
     `:24-35` (`wireNavigationPolicy`: deny-by-default, `will-navigate` y `setWindowOpenHandler`),
     `:37-63` (`wireRendererHeaders`: la cabecera `Authorization` se inyecta **sólo** si el frame es
     top-level del renderer; el resto de frames y los service workers no heredan acceso).
   - **Qué hace:** separa tres planos que Electron suele mezclar: permisos del navegador, política de
     navegación y propagación de credenciales.
   - **Adaptación en Ego:** `apps/desktop/src/main/security/electron-security.ts:138-149` cubre
     `will-navigate` y `setWindowOpenHandler`, pero **no** instala `setPermissionRequestHandler` /
     `setPermissionCheckHandler` (verificado por grep: 0 ocurrencias en `apps/desktop/src`).
   - **Relación con Backlog Ego:** `SEC-01`, `SEC-02`, `CORE-02`.

---

## 3. Matriz de Extracción vs Descarte ##

| Componente OpenCode | Acción en Ego | Razón Técnica / Arquitectónica |
|---|:---:|---|
| `packages/core/src/permission.ts`, `packages/core/src/permission/saved.ts` | **EXTRAER & ADAPTAR** | Semántica de reglas con comodines, concesión persistida y rechazo en lote; falta en `ApprovalEngine`. |
| `packages/core/src/session/inbox.ts` | **EXTRAER & ADAPTAR** | Admisión idempotente + entrega diferida: requisito para prompts durables en un desktop local-first. |
| `packages/core/src/session/compaction.ts` | **EXTRAER PATRÓN** | La escalera de reducción y la plantilla de checkpoint son valiosas; el motor Effect no se adopta. |
| `packages/core/src/tool.ts`, `tool/runtime.ts`, `packages/core/src/state.ts` | **EXTRAER PATRÓN** | Namespaces, prioridad por revisión y snapshot por turno; el motor `State` reejecutable se inspira, no se copia. |
| `packages/core/src/snapshot.ts` | **EXTRAER PATRÓN** | Dirección por contenido + restore selectivo con anti-escape de rutas. |
| `packages/core/src/session/run-coordinator.ts` | **EXTRAER PATRÓN** | Semántica de timbre/interrupción por clave, aplicable a `BackgroundEngine`. |
| `packages/desktop/src/main/windows/security.ts`, `headers.ts` | **EXTRAER & ADAPTAR** | Hueco real en el hardening de Electron de Ego (permisos del navegador sin handler). |
| `packages/core/src/codemode/tool.ts` | **DESCARTAR** | Elimina la granularidad de aprobación por tool call (principio 6); mismo fundamento que `HERM-18`. |
| `packages/server/src/pairing.ts`, `packages/desktop/src/main/service/background-service.ts` | **SOLO INSPIRACIÓN** | Acceso remoto y servicio residente: valor de producto P1, no de P0 (ver `OCDE-09`). |
| Effect + Schema + Bun + turbo + Drizzle/SQLite | **DESCARTAR** | Guardrails de `AGENTS.md` §4 y §1: sustrato VantaDB, runtime Node 22, IA SDK v7. |
| Solid.js (`packages/app`, `packages/ui`, `packages/desktop/src/renderer`) | **DESCARTAR** | El renderer de Ego es React 19 + `@assistant-ui/react`; no se replica la capa de presentación. |
| OpenTUI (`packages/tui/`) | **DESCARTAR** | Ego es aplicación desktop con ventana; no hay cliente terminal previsto en la hoja de ruta. |
| `packages/posts/` (blog Astro), `salesforce/force-app/` (Salesforce DX: Lead, Contact, Console Account Sync) | **DESCARTAR** | Contaminación de dominio y sitios de marketing: fuera del alcance del SOC. |

---

## 4. Estado real verificado (2026-10-20) ##

> Criterio de cierre (`AGENTS.md` §4): `✅ Completada` exige fichero adaptado **y** caller en producción
> verificado por grep sobre `packages/` + `apps/desktop/` (excluyendo `test/`, `dist/`, `node_modules/`).
> **Este repositorio de referencia es nuevo: no hay nada asimilado todavía.** Verificación ejecutada:

```text
grep -rE "codemode|CodeMode|Ruleset|doorbell|SessionInbox|shrinkSteps|SHRINK_STEPS|replayable" packages/ apps/desktop/
  -> 0 coincidencias (packages/ y apps/desktop/, sin test/ ni dist/)
```

Por tanto **ningún hallazgo puede cerrar en `✅ Completada`**.

| ID | Patrón | Estado | Evidencia / Fundamento |
|---|---|:---:|---|
| `OCDE-01` | Reglas de permisos con comodines + concesión `always` + rechazo en lote | 🆕 Pendiente | Fichero adaptado **no existe**. Cablear en `packages/execution/src/ApprovalEngine.ts` + `packages/security/src/ToolPermissions.ts`: añadir evaluador de ruleset con comodines (fail-closed), una columna `always` persistida en namespace `gov/permissions` y batch-reject de la sesión. Responsable: owner A2 (Execution). |
| `OCDE-02` | Inbox durable con admisión idempotente y entrega `steer`/`queue` | 🆕 Pendiente | Fichero adaptado **no existe**. Crear `packages/runtime/src/SessionInbox.ts` sobre `EgoMemoryAdapter` (namespace `session/inbox`), idempotente por ID de ítem, y cablear la admisión en el IPC de prompt (`apps/desktop/src/ipc/schema.ts`). Responsable: owner A2 (Runtime). |
| `OCDE-03` | Compactación con escalera de reducción y checkpoint estructurado | 🆕 Pendiente | Fichero adaptado **no existe**. Ampliar `packages/runtime/src/ContextCompaction.ts` (hoy sólo umbral/ratio) con la escalera 70/50/35 % y la plantilla de checkpoint; cerrar `EGO-FIND-21` (motor sin instanciar). Responsable: owner A2 (Runtime). |
| `OCDE-04` | Registro de tools con namespaces y captura por revisión | 🆕 Pendiente | Fichero adaptado **no existe**. Ampliar `packages/tools/src/ToolRegistry.ts` con namespace (`<ns>_<tool>`), prioridad por revisión y `snapshot()` de definiciones+ejecutores por turno en `packages/runtime/src/ToolExecutionLoop.ts`. Responsable: owner A4 (Tools). |
| `OCDE-05` | Snapshot de filesystem direccionado por contenido | 🆕 Pendiente | Fichero adaptado **no existe**. Crear `packages/recovery/src/WorkspaceSnapshot.ts` (árbol de objetos + restore selectivo con anti-escape de rutas) y cablearlo en el `SafeConfigMutation` (`packages/execution/src/SafeConfigMutation.ts`) antes de escrituras destructivas. Responsable: owner A3 (Recovery). |
| `OCDE-06` | Coordinador de ejecución por clave (timbre + interrupt) | 🆕 Pendiente | Fichero adaptado **no existe**. Extraer la semántica a `packages/tasks/src/SessionRunCoordinator.ts` y cablearlo en `packages/tasks/src/BackgroundEngine.ts` para serializar por sesión sin cola global. Responsable: owner A3 (Tasks). |
| `OCDE-07` | Handlers de permisos de Electron + credencial por frame | 🆕 Pendiente | Fichero adaptado **no existe**. Añadir `setPermissionRequestHandler` / `setPermissionCheckHandler` con allowlist en `apps/desktop/src/main/security/electron-security.ts:138` (`applyNavigationGuards`) y test que compruebe que un permiso no listado se deniega. Responsable: owner A4 (Desktop). |
| `OCDE-08` | Code Mode (JS confinado componiendo tool calls) | 🚫 Descartada (con justificación) | `packages/core/src/codemode/tool.ts:71-78` encadena llamadas a tools **sin turnos de modelo**, lo que suprime la granularidad de aprobación HITL que impone el principio 6 y el `ApprovalEngine` (`ACT-06`). Coincide con el descarte ya registrado en `HERM-18`. Alternativa vigente: `OCDE-04` (captura por revisión) + `EGO-FIND-21`. |
| `OCDE-09` | Servicio local HTTP + emparejamiento por código de un solo uso | ⏳ Futura (P1) | `packages/server/src/pairing.ts:24-31` emite un código `base64url` de 16 bytes con TTL de 5 min y consumo único; `packages/desktop/src/main/service/background-service.ts` mantiene un servicio residente separado del shell. **Fase destino: P1 (Ego Web / control remoto)**, no P0: exige canal de red saliente y superficie de autenticación ajena al desktop local-first. |

**Recuento:** 0 `✅ Completada` · 1 `🚫 Descartada` · 7 `🆕 Pendiente` · 1 `⏳ Futura` — **9 tareas**.

---

## 5. Descarte de componente — normalizado a la forma canónica ##

Las filas de la matriz §3 que usaban `**DESCARTAR**` se normalizan aquí a
`🚫 Descartada (con justificación)` (`AGENTS.md` §4), conservando el motivo:

| Componente OpenCode | Veredicto | Fundamento |
|---|:---:|---|
| Effect + Schema (`packages/core/src/**` usa `Effect`, `Layer`, `Context.Service`) | 🚫 **Descartada (con justificación)** | `AGENTS.md` §1 fija Node 22 + TypeScript estricto + AI SDK v7 como stack de Ego. Adoptar Effect implicaría reescribir todo el Cognitive Runtime a cambio de cero valor de producto; se extraen las *semánticas* (fail-closed, agrupación de fallos, uninterrumpibilidad), no la librería. |
| Bun + turbo + `bun.lock` | 🚫 **Descartada (con justificación)** | `AGENTS.md` §1: gestor de paquetes **pnpm** (workspaces) y Node ≥22 en el toolchain. Bun es un runtime alternativo, no una dependencia admitible. |
| SQLite + Drizzle ORM (`packages/core/src/database/`, `permission/sql.ts`, `session/sql.ts`) | 🚫 **Descartada (con justificación)** | El sustrato de memoria de Ego es `NativeVantaDB` (Fjall LSM) y todo acceso pasa por `EgoMemoryAdapter` (`AGENTS.md` §4). Un segundo sustrato relacional duplicaría la autoridad de estado y rompería el principio 9 (local-first con exportación soberana). |
| Solid.js (`packages/app/`, `packages/ui/`, `packages/desktop/src/renderer/desktop-app.tsx`) | 🚫 **Descartada (con justificación)** | El renderer de Ego es React 19 + `@assistant-ui/react` (`AGENTS.md` §1) y su capa de presentación ya está consolidada (`CORE-05`, `CANV-*`). |
| Code Mode (`packages/core/src/codemode/tool.ts`) | 🚫 **Descartada (con justificación)** | Ver `OCDE-08`: suprime la aprobación por tool call (principio 6). |
| OpenTUI (`packages/tui/`) | 🚫 **Descartada (con justificación)** | Experimentos de UI de terminal; Ego es aplicación desktop con ventana y no tiene cliente terminal en la hoja de ruta. |
| `packages/posts/` (blog Astro) · `salesforce/force-app/` (Salesforce DX) | 🚫 **Descartada (con justificación)** | Contaminación de dominio (`AGENTS.md` §4): el segundo define objetos Lead/Contact y un permission set `Console_Account_Sync` de CRM Salesforce; el primero es un sitio de marketing en Astro. Ninguno aporta patrón de runtime al SOC. |
