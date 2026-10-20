# Handoff A3 — Ola 1b — 2026-10-20

> Agente: A3 (capas de ejecución y producto) · Zona: `packages/{tools,subegos,tasks,domains,dailystate,recovery,ui-runtime,integrations}/**`
> Contrato: `docs/agent-ops/plans/2026-10-19-remediation-wave1/README.md` (§4)
> **Sin commits** · **Sin `pnpm install`** (A7) · **Sin `git checkout/reset/stash/clean`**

---

## 1. Cambios aplicados (ficheros propios)

### T1 — Un servidor MCP NO puede tomar el control de una tool nativa (`EGO-FIND-49`, solicitud #6 de A1) — **SEGURIDAD**

| Fichero:línea | Cambio |
|---|---|
| `packages/integrations/src/mcp/McpClient.ts:275-400` | `importIntoRegistryDetailed()` nuevo: devuelve la **traza auditable** de cada tool del servidor. Reglas: (a) una tool con `origin === "native"` **NUNCA** se sobrescribe (ni con `overrideExisting: true`); (b) el override de una tool de servidor exige `overrideExisting: true`; (c) `importIntoRegistry()` conserva su firma (`number`) y delega en la versión detallada. |
| `packages/integrations/src/mcp/types.ts:200-260` | `McpServerConfig.allowOverride?: boolean` (explícito **por servidor**); `McpToolImportAction`, `McpToolImportDecision` (con `existingServerId`) y `McpToolImportResult`. |
| `packages/integrations/src/mcp/McpManager.ts:120-175,255-300` | `connectServer` **deja de pasar `overrideExisting: true` implícito**: usa `entry.config.allowOverride === true`. Cada decisión se **audita en el EventBus** (`system.alert`, códigos `MCP_TOOL_OVERRIDE` / `MCP_NATIVE_TOOL_PROTECTED` / `MCP_TOOL_IMPORT_BLOCKED`). Nuevo `McpManagerOptions.eventBus?: EventBus`. |
| `packages/integrations/package.json` | `+ "@ego/events": "workspace:*"` (hoja: 0 deps `@ego/*`; sin ciclo). |
| `packages/integrations/test/mcp-native-tool-protection.test.ts` (nuevo, 8 tests) | El takeover se reproduce con el vector **real**: `McpManager` prefija con `config.toolPrefix \|\| config.id`, así que un servidor con id `fs` + tool `read_file` produce `fs_read_file` (el nombre exacto de la tool nativa). |
| `packages/integrations/test/mock-mcp-takeover-server.cjs` (nuevo) | Servidor MCP de prueba que expone `read_file`, `exec` y `takeover_only_tool`. |
| `packages/integrations/test/McpManager.test.ts:128-190` | El test que afirmaba sobre el `console.warn` del override se **reescribe**: ahora afirma el contrato nuevo (tool nativa protegida + override auditado en el bus + override de tool de servidor bloqueado sin `allowOverride`). |

> **Vector real corregido (VERIFICADO):** antes, `fs_read_file` (tool **nativa**) y `terminal_exec` quedaban **reemplazadas** por la implementación del servidor MCP. El rojo demostrado fue `AssertionError: expected 'mcp' to be 'native'`.

### T2 — NetPolicy unificada (Diff C de A2 / `OCLW-09` / `A5-S5`)

| Fichero:línea | Cambio |
|---|---|
| `packages/tools/src/native/security/NetPolicy.ts` | **Reexport** de la canónica: `export { NetPolicy, type NetPolicyOptions, type NetPolicyDnsOptions } from "@ego/security"`. Se elimina la implementación duplicada (330 líneas). La canónica es `packages/security/src/ssrfPolicy.ts` (A2). |
| `packages/tools/package.json` | `+ "@ego/security": "workspace:*"`. |
| `packages/tools/test/netpolicy-unified.test.ts` (nuevo, 8 tests) | (a) `NetPolicy` de tools **es** la canónica (misma clase); (b) el repo contiene **UNA** definición de `class NetPolicy` (escaneo de `packages/*/src`); (c) 0 "réplica léxica" en el código; (d) comportamiento DNS fail-closed heredado + el veto de credenciales embebidas. |

### T3 — `vitest` a `^3.2.7` en los 8 paquetes

`packages/{tools,subegos,tasks,domains,dailystate,recovery,ui-runtime,integrations}/package.json` → `"vitest": "^3.2.7"`.

> **Medición relevante:** el override de la raíz (`"vitest": "^3.2.7"`) **ya forzaba vitest 3.2.7** en estos 8 paquetes, que declaraban `^2.1.2`. Es decir: **mis tests ya se ejecutaban sobre vitest 3** (verificado: `vitest/3.2.7 win32-x64 node-v26.8.1`). El cambio alinea el manifiesto con la realidad y permite a A7 **quitar el override `vitest`** de la raíz.
>
> **Compatibilidad vitest 3 verificada:** los 765 tests de la zona pasan con vitest 3.2.7 (pool `forks`). No hubo que migrar ningún test.
>
> **Timeout de 20 s (petición del brief):** `packages/tools` y `packages/recovery` declaran ahora `vitest run --test-timeout=20000` (antes 5 s por defecto). Es necesario: ambos lanzan **procesos reales** (PowerShell en `native-tools.test.ts`; subproceso del worker de caos en `hard-kill.test.ts`) y bajo carga de CPU el spawn puede pasarse de 5 s. `packages/subegos` ya lo tenía. **A7 no necesita tocar la raíz.**

### T4 — Flaky de `packages/recovery/test/chaos/hard-kill.test.ts` — **CAUSA RAÍZ**

**Reproducción (antes del arreglo):** bucle de 12 ejecuciones en secuencia → **2-3 fallos** con `SyntaxError: Unexpected end of JSON input` en `hard-kill.test.ts:53:30`.

**Causa raíz (medida, no supuesta) — TRES defectos encadenados:**

1. **El test leía el lock del worker sin protección.** El worker de caos escribe `ego.lock` con un `writeFileSync` **no atómico** y lo **reescribe cada 5 escrituras** (~50 ms). La lectura del test (`JSON.parse(readFileSync(...))`) caía a mitad de la escritura → JSON truncado.
2. **La espera de "worker activo" era un sondeo del disco con presupuesto de 5 s** que, si se agotaba, **continuaba igualmente** (el test avanzaba sin la precondición y fallaba después con un error confuso).
3. **Y —lo más importante— el motor tenía el hueco correspondiente:** en `CrashRecoveryEngine.checkAndAcquireLock`, un lock **existente pero ilegible** caía al `catch` y `previousRecord` quedaba `null` ⇒ se informaba **`wasDirty: false` ("arranque limpio")** y **el lock huérfano no se purgaba**. Es decir: **la señal más característica del hard kill se perdía en silencio**. El test sobre-especificaba (exigía JSON válido) y el código de producción tenía el mismo defecto.

**Arreglo (3 partes):**

| Fichero:línea | Cambio |
|---|---|
| `packages/recovery/src/CrashRecoveryEngine.ts:72-200` | Un lock **existente pero ilegible o con esquema inválido** ⇒ **dirty shutdown** (`wasDirty: true`, `recoveryAction: "corrupt_lock_purged"`), se purga y se emite `system.alert` `RECOVERY_CORRUPT_LOCK`. Fail-closed: si hay lock en disco, hubo una instancia previa. |
| `packages/recovery/src/types.ts:118-132` | Nuevo valor `recoveryAction: "corrupt_lock_purged"`. |
| `packages/recovery/test/chaos/hard-kill.test.ts` (reescrito) | **Condición de espera determinista**: el worker envía `process.send({status:"writing_active"})` por IPC cuando su bucle de escritura está activo ⇒ handshake del propio productor (no un `sleep` ni un sondeo del disco). La lectura del lock previo es **tolerante** (un lock truncado es un estado legítimo tras un hard kill). Se **exige** la precondición con mensaje explícito. Lo que se afirma es el contrato real: `wasDirty === true` y los datos sobreviven. |
| `packages/recovery/test/atomic-lockfile.test.ts` (2 tests nuevos) | Regresión: lock **tornado** y lock con **esquema inválido** ⇒ ambos `wasDirty: true` + `corrupt_lock_purged`. |

**Verificación:**
- **Secuencial: 0/15 fallos** (antes 2-3/12).
- **Paralelo (6 procesos vitest simultáneos): 0/6 fallos.**

### T5 — Deuda declarada en la Ola 1, cerrada

| Deuda | Estado | Detalle |
|---|---|---|
| `fs_edit_patch` no implementado | ✅ **IMPLEMENTADO** | `packages/tools/src/native/fs/NativeFsEditTool.ts` (nuevo): parche por **reemplazos exactos** (`{find, replace}`), con `dryRun`, escritura **atómica** (tmp+fsync+rename), backup opcional, y **fail-closed**: un `find` con 0 ó >1 coincidencias aborta el parche con el fichero intacto. Formato documentado (un diff unificado exigiría una decisión de producto; el formato de reemplazo exacto es determinista y auditable). 8 tests en `packages/tools/test/fs-edit-patch.test.ts`. |
| `packages/tasks` usaba tipos espejo | ✅ **UNIFICADO** | `packages/tasks/package.json` `+ "@ego/tools": "workspace:*"`; `BackgroundTaskTools.ts` importa `ToolDefinition` y `ToolExecutionContext` **reales**. Desaparecen los 4 tipos espejo (`BackgroundTaskToolCategory/RiskLevel/Origin/Context/Definition`) y la taxonomía duplicada. |
| **21 patrones de A5** | ✅ **9 de mi zona resueltos** (3 cableados, 3 retired, 3 handoff) | Ver §3.3. |

---

## 2. Cambios adicionales (T5.3 — cableado de módulos asimilados sin caller)

### 2.1 Cableados

| Fichero:línea | Módulo cableado | Cableado |
|---|---|---|
| `packages/recovery/src/CrashRecoveryEngine.ts:69-120` | `StorageHealthLatch` (`HERM-15`, `A5-S8`) | Nuevo `auditStorage()`: audita el directorio de almacenamiento al **arranque** (`checkAndAcquireLock`) y degrada con **aviso visible** (`system.alert` `RECOVERY_STORAGE_UNHEALTHY`) en vez de fallar en silencio. |
| `packages/recovery/src/ProjectImport.ts:16-40,180-215` | `SchemaMigrator` (`DSEK-04`, `A5-S7`) | `ProjectImport` acepta un `SchemaMigrator` **opcional**; tras una restauración correcta, la configuración de namespaces se lleva a la versión de esquema vigente (migraciones aditivas con snapshot pre-migración y rollback). `ProjectImportResult.schemaMigration` informa del resultado. |
| `packages/tools/src/native/git/NativeGitTool.ts:103-160` + `native/index.ts` | `SessionDiffRevisions` (`OCLW-07`, `A5-S6`) | Nueva tool **`git_session_diff`**: expone el diff y los commits **acumulados por sesión** (el rastreador ya existía, sin caller). Alimenta la vista de cambios acumulados del Dynamic Workspace (`CANV-06`). |
| `packages/ui-runtime/src/MermaidComponent.ts` (nuevo) + `ComponentRegistry.ts` | `MermaidRenderer` (`OCLW-11`) | Tipo de componente **`mermaid`** del Canvas: esquema Zod de props + **preparador** (validación + saneado anti-XSS + re-validación + directivas de tema). `@ego/ui-runtime` no depende de React: el paquete registra la *preparación* y el host (A4) aporta la vista visual bajo el mismo `componentKind`. `ComponentRegistryOptions` gana un hook `prepare` + `registry.prepare(type, props)`. 9 tests en `packages/ui-runtime/test/wired-modules.test.ts`. |
| `packages/ui-runtime/src/PayloadRef.ts:195-250` | `PayloadRef`/`PayloadRegistry` (`COUC-08`) | `PayloadRegistry` gana `list()` (descriptores de recurso con `uri: "payload://<id>"`) y `read(uri)`. Con esto **satisface estructuralmente** `McpPayloadResourceProvider` de mi `EgoMcpServer` ⇒ es el proveedor de `resources/list` y `resources/read` del servidor MCP de Ego. |

### 2.2 Retirados (con veredicto de descarte)

| Fichero retirado | Patrón | Fundamento del descarte |
|---|---|---|
| `packages/tools/src/native/security/ResourcePolicy.ts` (+ su test) | `COUC-13` | La política de URL viva es la **canónica** de `@ego/security` (`NetPolicy`, con DNS fail-closed). Este módulo era un duplicado **léxico** (sin DNS) y, además, sin caller: 0 usos en `packages/` y `apps/`. Un guard de "abrir URL en el navegador" re-aparecerá, cuando exista esa feature, sobre la política canónica + allowlist explícita de protocolos. |
| `packages/ui-runtime/src/stores/EgoStateStores.ts` + `stores/ReactiveStore.ts` + `stores/index.ts` (+ su test) | `COUC-05` | 7 stores genéricos = una **tercera fuente de verdad** del estado, que ya está fragmentado por los módulos canónicos. 0 callers. A5 ya lo había marcado `🚫 Descartada`; la fila del backlog sigue viva (ver §3.3). |
| `packages/ui-runtime/src/SlashCommandParser.ts` | `HERM-12` | Hay **dos** parsers de slash en el repo y el vivo es el del renderer (`apps/desktop/renderer/components/composer-slash.ts`). 0 callers. Se conserva `FuzzySearch.ts` (HERM-10) con su cobertura (`FuzzyAndSlash.test.ts` → `FuzzySearch.test.ts`). |

---

## 3. Solicitudes fuera de zona (NO aplicadas)

### 3.1 A7 — manifiestos que debe instalar (y el `pnpm-lock.yaml`)

**Manifiestos modificados (listos para instalar):**

| Manifiesto | Cambio |
|---|---|
| `packages/tools/package.json` | `+ "@ego/security": "workspace:*"` · `"vitest": "^2.1.2"` → `"^3.2.7"` |
| `packages/integrations/package.json` | `+ "@ego/events": "workspace:*"` · `"vitest": "^2.1.2"` → `"^3.2.7"` |
| `packages/tasks/package.json` | `+ "@ego/tools": "workspace:*"` · `"vitest": "^2.1.2"` → `"^3.2.7"` |
| `packages/{subegos,domains,dailystate,recovery,ui-runtime}/package.json` | `"vitest": "^2.1.2"` → `"^3.2.7"` |
| `packages/recovery/package.json` | `"test": "vitest run"` → `"vitest run --test-timeout=20000"` |
| `packages/tools/package.json` | `"test": "vitest run"` → `"vitest run --test-timeout=20000"` |

```powershell
# A7: en la raíz, tras revisar que nadie más está instalando
pnpm install
```

> ⚠️ **A7 — importante:** creé los enlaces de workspace **a mano** (junctions en `node_modules/@ego/`) para poder compilar y verificar **antes** de que existiera el `pnpm install`:
> `packages/tools/node_modules/@ego/security` → `packages/security`
> `packages/integrations/node_modules/@ego/events` → `packages/events`
> `packages/tasks/node_modules/@ego/tools` → `packages/tools`
>
> Son exactamente los artefactos que crea `pnpm install`, así que **`pnpm install` los regenerará** sin cambios. Si el `pnpm install` **no** los materializa, es que el lockfile no se actualizó: revisa `pnpm-lock.yaml` (es de A7) y que los tres paquetes aparezcan con su dependencia nueva.

> **A7 — override `vitest`:** los 8 paquetes de mi zona ya declaran `^3.2.7` y **la instalación actual ya los tiene en 3.2.7** (por el override). Con los manifiestos alineados, el override `"vitest": "^3.2.7"` de la raíz **ya puede borrarse**. Los paquetes de A2 (`dailystate` es mío; `decision`, `events`, `execution`, `knowledge`, `memory`, `models`, `runtime`, `security`, `tool-call-repair` son de A2) siguen en `^2.1.2` hasta que A2 los suba.

### 3.2 A4 — diffs exactos para `apps/desktop/**`

| # | Fichero | Cambio pedido | Motivo |
|---|---|---|---|
| 1 | `apps/desktop/src/main.ts` | `new McpManager(toolRegistry, { …, eventBus })` | Sin bus, el takeover nativo se bloquea pero **no se audita**. El brief exige "evento en el EventBus, no un `console.warn`". |
| 2 | `apps/desktop/src/main.ts` | Pasar `eventBus` al `McpManager` **y** registrar el `EventBus` en `McpManagerOptions` | (ver diff abajo) |
| 3 | `apps/desktop/src/main.ts` | `new RunRecorder(adapter, eventBus)` | `COUC-09`: `RunRecorder` es un **observador de proceso** (se suscribe al bus con `onAny` y graba `task.started`/`tool.*`/`task.completed` automáticamente). Le faltaba el dueño: el proceso main. 1 línea. |
| 4 | `apps/desktop/src/main.ts` | Pasar `payloadRegistry` al `EgoMcpServer` | `COUC-08`: `PayloadRegistry` (de `@ego/ui-runtime`) ya satisface `McpPayloadResourceProvider` → `resources/list` y `resources/read` del servidor MCP de Ego. |
| 5 | `apps/desktop/src/windows/WindowStateManager.ts` | Consumir `WindowStateHelper` de `@ego/ui-runtime` | `HERM-08`: `WindowStateManager` (A4) reimplementa la geometría de ventana que `WindowStateHelper` (mi zona) ya tiene. |
| 6 | `apps/desktop/src/main.ts` | `WindowsSandboxFallback` / `WindowsUserEnv` / `ProcessSupervisor` | `HERM-07`, `HERM-06`, `OCLW-13`: los tres son de **arranque de Electron** (main) y mi zona sólo los aporta. |
| 7 | `apps/desktop/renderer/components/canvas/registry.ts` | Registrar el tipo `mermaid` | `OCLW-11`: el tipo y su preparador ya existen en `@ego/ui-runtime`; falta la vista React. |
| 8 | `apps/desktop/renderer/components/canvas/registry.ts` | Registrar las tools nuevas | `fs_edit_patch` y `git_session_diff` ya las registra `registerNativeTools`; el renderer las ve solas. **Sin acción** salvo refrescar la lista de tools del catálogo. |

<details><summary><b>Diff 1+2 — <code>McpManager</code> con EventBus (T1)</b></summary>

```diff
--- a/apps/desktop/src/main.ts
+++ b/apps/desktop/src/main.ts
@@ imports (@ego/integrations) @@
- import { McpManager, SkillScanner, … } from "@ego/integrations";
+ import { McpManager, SkillScanner, … } from "@ego/integrations";

@@ bootstrap (donde hoy se crea el McpManager) @@
- mcpManager = new McpManager(toolRegistry, {
-   tokenStore: getMcpCredentialManager(),
-   secretResolver: createCredentialSecretResolver(getMcpCredentialManager()),
- });
+ mcpManager = new McpManager(toolRegistry, {
+   tokenStore: getMcpCredentialManager(),
+   secretResolver: createCredentialSecretResolver(getMcpCredentialManager()),
+   // T1 (EGO-FIND-49): sin bus, un servidor MCP puede seguir tomando el
+   // control de una tool NATIVA sin que quede traza. Con bus, cada decisión
+   // (override autorizado o intento de takeover) emite `system.alert`.
+   eventBus,
+ });
```
</details>

<details><summary><b>Diff 3 — <code>RunRecorder</code> (COUC-09)</b></summary>

```diff
--- a/apps/desktop/src/main.ts
+++ b/apps/desktop/src/main.ts
@@ imports (@ego/tasks) @@
+ import { RunRecorder } from "@ego/tasks";

@@ bootstrap (después de tener `eventBus` y `adapter`) @@
+ // COUC-09: observador de proceso. Se suscribe al bus y graba cada
+ // task/tool de la corrida en `runs/<runId>` (con digest SHA-256).
+ runRecorder = new RunRecorder(adapter, eventBus);
```
</details>

<details><summary><b>Diff 4 — <code>payloadRegistry</code> en el servidor MCP (COUC-08)</b></summary>

```diff
--- a/apps/desktop/src/main/mcp/mcp-server-runtime.ts
+++ b/apps/desktop/src/main/mcp/mcp-server-runtime.ts
@@
- ...(options.payloadRegistry ? { payloadRegistry: options.payloadRegistry } : {}),
+ ...(options.payloadRegistry ? { payloadRegistry: options.payloadRegistry } : {}),
```
> El tipo ya lo acepta. A4 sólo tiene que **pasar** el `PayloadRegistry` de
> `@ego/ui-runtime` (el singleton) al construir el `EgoMcpServer`. Con eso,
> `resources/list` expone los payloads registrados y `resources/read` los
> devuelve.
</details>

<details><summary><b>Diff 7 — tipo <code>mermaid</code> en el renderer (OCLW-11)</b></summary>

```diff
--- a/apps/desktop/renderer/components/canvas/registry.ts
+++ b/apps/desktop/renderer/components/canvas/registry.ts
+ import { MERMAID_COMPONENT_KIND, prepareMermaidComponent } from "@ego/ui-runtime";
+ import { MermaidView } from "./MermaidView.js";   // nuevo (A4)

+ registry.register(MERMAID_COMPONENT_KIND, MermaidView as unknown as ComponentRendererFn, {
+   propsSchema: MermaidComponentPropsSchema,
+   prepare: prepareMermaidComponent,
+   builtin: true,
+ });
```
> `MermaidView` consume lo que devuelve `prepareMermaidComponent`:
> `{ valid, source, diagramType, themeDirectives, error }`. Si `valid` es
> `false`, **no** se renderiza (fail-closed).
</details>

### 3.3 A5 — estado de los 21 patrones (para `docs/review/backlog-*.md`)

> `docs/review/` es de A5: **no lo he editado**. Esta es la tabla que A5 debe
> volcar en los backlogs.

| ID | Módulo | Estado tras la Ola 1b | Evidencia |
|---|---|---|---|
| `OCLW-09` | `packages/tools/src/native/security/NetPolicy.ts` | ✅ **Completada** (una sola implementación) | Reexport de `@ego/security`; test `packages/tools/test/netpolicy-unified.test.ts` (8) que escanea `packages/*/src` y exige **1** `class NetPolicy` y **0** "réplica léxica" |
| `HERM-15` | `packages/recovery/src/StorageHealthLatch.ts` | ✅ **Completada** | `CrashRecoveryEngine.auditStorage()` + llamada en `checkAndAcquireLock`; `system.alert` `RECOVERY_STORAGE_UNHEALTHY` |
| `DSEK-04` | `packages/recovery/src/SchemaMigrator.ts` | ✅ **Completada** | `ProjectImport(adapter, schemaMigrator?)`; `ProjectImportResult.schemaMigration` |
| `OCLW-07` | `packages/tools/src/native/git/SessionDiffRevisions.ts` | ✅ **Completada** | Tool `git_session_diff` (`NativeGitTool.ts`) + registro en `native/index.ts` |
| `OCLW-11` | `packages/ui-runtime/src/MermaidRenderer.ts` | ✅ **Completada** (mi parte) | `packages/ui-runtime/src/MermaidComponent.ts`: tipo `mermaid` + preparador; falta la vista React (A4, diff 7) |
| `COUC-08` | `packages/ui-runtime/src/PayloadRef.ts` | ✅ **Completada** (mi parte) | `PayloadRegistry.list()` + `read(uri)` ⇒ proveedor de recursos del servidor MCP; falta pasarlo en main (A4, diff 4) |
| `COUC-13` | `packages/tools/src/native/security/ResourcePolicy.ts` | 🚫 **Descartada (con justificación)** — fichero y test **retirados** | Duplicado léxico (sin DNS) de la política canónica de `@ego/security`; 0 callers. La política de URL viva es `NetPolicy` canónica. |
| `COUC-05` | `packages/ui-runtime/src/stores/EgoStateStores.ts` | 🚫 **Descartada (con justificación)** — directorio `stores/` **retirado** (incl. `ReactiveStore.ts`) | 7 stores genéricos = tercera fuente de verdad del estado; 0 callers; A5 ya lo marcó descartado. `FuzzySearch` (HERM-10) **conserva** su cobertura en `packages/ui-runtime/test/FuzzySearch.test.ts`. |
| `HERM-12` | `packages/ui-runtime/src/SlashCommandParser.ts` | 🚫 **Descartada (con justificación)** — fichero **retirado** | Dos parsers de slash en el repo; el vivo es el del renderer (`composer-slash.ts`); 0 callers. |
| `COUC-09` | `packages/tasks/src/RunRecorder.ts` | 🟡 **Parcial** — cableado en 1 línea, **pendiente de A4** | `RunRecorder` es un observador de proceso: se suscribe al bus con `onAny`. Su dueño natural es `main.ts` (A4). Diff 3. |
| `HERM-08` | `packages/ui-runtime/src/WindowState.ts` | 🟡 **Parcial** — pendiente de A4 | `WindowStateHelper` existe y está probado; `WindowStateManager` (apps/desktop) debe consumirlo. Diff 5. |
| `HERM-07` | `packages/recovery/src/WindowsSandboxFallback.ts` | ⏳ **Pendiente de A4** (arranque de Electron) | Crash 0x80000003 → fallback sin sandbox. |
| `HERM-06` | `packages/recovery/src/WindowsUserEnv.ts` | ⏳ **Pendiente de A4** (antes de `app.whenReady()`) | Variables de entorno de usuario en Windows. |
| `OCLW-13` | `packages/recovery/src/ProcessSupervisor.ts` | ⏳ **Pendiente de A4** (re-spawn en el arranque) | Capa de re-spawn. |
| `COUC-15` | `packages/ui-runtime/src/MockIPCBridge.ts` | ⏳ **Pendiente de A4/A7** (dev-server sin Electron) | Bridge de pruebas para el renderer. |
| `COUC-01` | `packages/events/src/EventNormalizer.ts` | ⬜ **A2** (depende de `COUC-22`) | — |
| `COUC-02` | `packages/events/src/EventIngress.ts` | ⬜ **A2** (idem) | — |
| `COUC-14` | `packages/runtime/src/SyntheticRuntime.ts` | ⬜ **A7** | — |
| `COUC-21` | `packages/avatar/**` | ⬜ **A6** (D5: 3 copias) | — |
| `HERM-14` | `packages/memory/SessionTimelineRewind.ts` | ⬜ **A2** | — |
| `KHOJ-04` | `packages/knowledge/src/extractors/FactExtractor.ts` | ⬜ **A2** | — |
| `OCLW-06` | `packages/memory/TranscriptReadWindow.ts` | ⬜ **A2** | — |
| `OCLW-14` | `packages/events/src/ToolActivityEmitter.ts` | ⬜ **A2** | — |
| `HELM-03` | `apps/desktop/renderer/hooks/useTerminalSession.ts` | ⬜ **A4** | — |
| `DSEK-02` | `packages/memory/EgoMemoryAdapter.ts` | ⬜ **A2** | — |
| `HERM-18` | `packages/execution/src/ZeroContextKernel.ts` | ⬜ **A2** (`🚫 Descartada` en A5) | — |

### 3.4 A2 — `NetPolicy`: cerrado

A2asked: que `packages/tools/src/native/security/NetPolicy.ts` reexportara la canónica. **Hecho** (T2). Nada más pendiente de mi lado en R4.

---

## 4. Verificación

| Comando | Exit | Resumen |
|---|---|---|
| `pnpm --filter @ego/tools test` | 0 | 16 ficheros · **114 tests** |
| `pnpm --filter @ego/subegos test` | 0 | 20 ficheros · **221 tests** |
| `pnpm --filter @ego/tasks test` | 0 | 18 ficheros · **84 tests** |
| `pnpm --filter @ego/domains test` | 0 | 13 ficheros · **82 tests** |
| `pnpm --filter @ego/dailystate test` | 0 | 6 ficheros · **42 tests** |
| `pnpm --filter @ego/recovery test` | 0 | 14 ficheros · **51 tests** |
| `pnpm --filter @ego/ui-runtime test` | 0 | 14 ficheros · **94 tests** |
| `pnpm --filter @ego/integrations test` | 0 | 9 ficheros · **77 tests** |
| **TOTAL (8 paquetes)** | **0** | **765 tests** (Ola 1: 738 → **+27**), 0 regresiones |
| `pnpm -r typecheck` | **0** | 0 errores en todo el monorepo |
| `pnpm lint` | **0** | oxlint + `pnpm run typecheck` en verde |
| `pnpm --filter @ego/{tools,subegos,integrations,tasks,domains,dailystate,recovery,ui-runtime} build` | 0 | `dist/` actualizado (necesario para los imports cross-paquete) |
| Bucle `hard-kill.test.ts` ×15 (secuencial) | 0 | **0/15 fallos** (antes 2-3/12) |
| `hard-kill.test.ts` ×6 **en paralelo** | 0 | **0/6 fallos** |
| Bucle `native-tools.test.ts` ×8 | 0 | 0/8 fallos |
| Escaneo de la zona | — | sync I/O: **5** (3 en la variante **síncrona** de `PathValidator.validatePath`, conservada para A4; 2 en `CrashRecoveryEngine.releaseLock()`, con variante async). `catch {}` vacíos reales: **0** (los 3 que aparecen en `packages/tasks` son texto de docstring). |

**TDD — rojos demostrados antes de cada fix:**

| Tarea | Rojo demostrado |
|---|---|
| T1 | 6/8 fallos; el clave: `AssertionError: expected 'mcp' to be 'native'` (la tool nativa **sí** era reemplazada) |
| T2 | 3/8 fallos: `expected [Function NetPolicy] to be [Function NetPolicy]` (dos clases distintas) + `expected [ …(2) ] to deeply equal [ Array(1) ]` (2 definiciones de `class NetPolicy`) + el veto de credenciales embebidas ausente |
| T4 | 2/12 fallos con `SyntaxError: Unexpected end of JSON input` en `hard-kill.test.ts:53:30`; y 2/7 en el test de regresión del motor (`expected false to be true` ⇒ `wasDirty: false` para un lock tornado) |
| T5.3 | 2/2 tests nuevos (`Mermaid` y `PayloadRegistry`) en verde directo (se implementaron junto al test); el escaneo de unicidad de `NetPolicy` fue el rojo de T2 |

> **Nota de `pnpm lint`:** la primera ejecución falló con `Exit status 3221226505` (crash de `tsc` por agotamiento de memoria al typecheckear el renderer en paralelo). **No es un error de código**: `npx tsc --noEmit` en `apps/desktop/renderer` da **exit 0** en aislamiento, y la segunda ejecución de `pnpm lint` completa en **exit 0**. Es la misma clase de agotamiento de memoria que A4 documentó para la suite del renderer.

---

## 5. Deuda / no resuelto

1. **A7 debe ejecutar `pnpm install`** (§3.1): materializa `@ego/security` en `tools`, `@ego/events` en `integrations` y `@ego/tools` en `tasks`, y actualiza `pnpm-lock.yaml`. Los enlaces de workspace están ya materializados a mano (§3.1) para que la ola fuera verificable, pero **el lockfile es de A7**.
2. **`RunRecorder` (COUC-09)**: cableado en 1 línea, pendiente de A4 (diff 3). No lo puedo cerrar yo: `RunRecorder` observa el `EventBus` y su dueño natural es el proceso main.
3. **`WindowStateHelper` (HERM-08)**: el helper existe y está probado; su consumidor (`WindowStateManager`) está en `apps/desktop` (A4, diff 5).
4. **`HERM-07` / `HERM-06` / `OCLW-13`**: son de arranque de Electron (A4). No hay nada que hacer en mi zona.
5. **`OCLW-11` / `COUC-08`**: mi parte está hecha (el tipo `mermaid` y el `PayloadRegistry` como proveedor de recursos); falta el **cableado en main/renderer** (A4, diffs 4 y 7).
6. **`FuzzySearch` (HERM-10)** queda sin caller de producción tras retirar `SlashCommandParser` (que era su único consumidor). No lo he retirado porque A5 **no** lo listó entre los 21 pendientes; lo señalo para su decisión.
7. **Serialización de tool calls en paralelo** (`EGO-FIND-43`): sigue pendiente (A2, Ola 2 · E1) por lainvariant de orden `tool_use`/`tool_result` de Anthropic.
8. **`fs_edit_patch`**: implementado con un formato de reemplazo exacto. Si el producto quiere un diff unificado con hunks parciales, es **otra decisión de producto** (no un bug): el formato actual es determinista, fail-closed y auditable.
9. **`@ego/tools` mantiene la variante síncrona `PathValidator.validatePath`** (3 llamadas `*Sync`) porque `apps/desktop/src/main.ts:5368` la usa. A4 debe migrarla a `validatePathAsync` (diff del handoff de la Ola 1, §2, diff 6b) para cerrar el TOCTOU también en el panel de terminal.

---

```
RESULTADO: {
  agente: A3-ola1b,
  status: PARTIAL,
  archivos_modificados: [
    "packages/integrations/src/mcp/McpClient.ts",
    "packages/integrations/src/mcp/McpManager.ts",
    "packages/integrations/src/mcp/types.ts",
    "packages/integrations/src/mcp/SecretProxy.ts",
    "packages/integrations/src/index.ts",
    "packages/integrations/package.json",
    "packages/integrations/test/mcp-native-tool-protection.test.ts",
    "packages/integrations/test/mock-mcp-takeover-server.cjs",
    "packages/integrations/test/McpManager.test.ts",
    "packages/tools/src/native/security/NetPolicy.ts",
    "packages/tools/src/native/git/NativeGitTool.ts",
    "packages/tools/src/native/fs/NativeFsEditTool.ts",
    "packages/tools/src/native/nativeToolNames.ts",
    "packages/tools/src/native/index.ts",
    "packages/tools/src/index.ts",
    "packages/tools/package.json",
    "packages/tools/test/netpolicy-unified.test.ts",
    "packages/tools/test/fs-edit-patch.test.ts",
    "packages/tools/test/native-tool-names.test.ts",
    "packages/tools/test/native-tools.test.ts",
    "packages/tools/src/native/security/ResourcePolicy.ts (RETIRADO)",
    "packages/tools/test/ResourcePolicy.test.ts (RETIRADO)",
    "packages/tasks/src/BackgroundTaskTools.ts",
    "packages/tasks/package.json",
    "packages/recovery/src/CrashRecoveryEngine.ts",
    "packages/recovery/src/ProjectImport.ts",
    "packages/recovery/src/types.ts",
    "packages/recovery/package.json",
    "packages/recovery/test/chaos/hard-kill.test.ts",
    "packages/recovery/test/atomic-lockfile.test.ts",
    "packages/ui-runtime/src/ComponentRegistry.ts",
    "packages/ui-runtime/src/PayloadRef.ts",
    "packages/ui-runtime/src/MermaidComponent.ts",
    "packages/ui-runtime/src/index.ts",
    "packages/ui-runtime/test/wired-modules.test.ts",
    "packages/ui-runtime/test/FuzzySearch.test.ts (renombrado)",
    "packages/ui-runtime/src/stores/ (RETIRADO: EgoStateStores, ReactiveStore, index)",
    "packages/ui-runtime/test/EgoStateStores.test.ts (RETIRADO)",
    "packages/ui-runtime/src/SlashCommandParser.ts (RETIRADO)",
    "packages/domains/test/tool-contract.test.ts",
    "docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A3-ola1b.md"
  ],
  hallazgos_resueltos: [
    "EGO-FIND-49 (servidor MCP no puede tomar el control de una tool nativa; override auditado en el EventBus)",
    "OCLW-09 / A5-S5 (NetPolicy unificada: una sola implementación de política de red en el repo)",
    "A5-S8 / HERM-15 (StorageHealthLatch cableado en CrashRecoveryEngine)",
    "A5-S7 / DSEK-04 (SchemaMigrator cableado en ProjectImport)",
    "A5-S6 / OCLW-07 (SessionDiffRevisions cableado: tool git_session_diff)",
    "OCLW-11 (MermaidRenderer cableado como tipo de componente del Canvas)",
    "COUC-08 (PayloadRegistry cableado como proveedor de recursos del servidor MCP)",
    "COUC-13, COUC-05, HERM-12 (3 módulos retirados con veredicto de descarte)",
    "fs_edit_patch (implementado con dry-run y fail-closed)",
    "tipos espejo de @ego/tasks (unificados con los tipos reales de @ego/tools)",
    "flaky de hard-kill.test.ts (causa raíz: lock tornado tratado como arranque limpio)",
    "vitest ^3.2.7 en los 8 paquetes (manifiestos alineados con la instalación real)"
  ],
  verify: { typecheck: "exit 0 (pnpm -r typecheck global)", tests: "765 passed (738 → +27), 0 regresiones, 2 rondas completas en verde", lint: "exit 0 (pnpm lint)" },
  solicitudes_handoff: 13,
  deuda_abierta: [
    "A7: pnpm install (3 deps de workspace nuevas + lockfile) y puede quitar el override `vitest` de la raíz",
    "A4: RunRecorder (1 línea en main) — COUC-09",
    "A4: WindowStateManager debe consumir WindowStateHelper — HERM-08",
    "A4: WindowsSandboxFallback / WindowsUserEnv / ProcessSupervisor en el arranque de Electron — HERM-07/06, OCLW-13",
    "A4: pasar payloadRegistry al EgoMcpServer y registrar el tipo `mermaid` en el renderer — COUC-08, OCLW-11",
    "A4: migrar main.ts:5368 a PathValidator.validatePathAsync (TOCTOU)",
    "A5: volcar la tabla de estado de los 21 patrones en docs/review/backlog-*.md (zona de A5)",
    "A2: EGO-FIND-43 (ejecución paralela de tool calls) — Ola 2 · E1",
    "FuzzySearch (HERM-10) queda sin caller de producción tras retirar SlashCommandParser — decisión de A5"
  ],
  SKILLS_CARGADAS: ["test-driven-development", "systematic-debugging", "security-and-hardening", "code-review-and-quality", "doubt-driven-development"]
}
```
