# A4 — Ola 1c — Handoff

> **Agente:** A4 · **Zona de escritura:** `apps/desktop/**` (EXCEPTO `apps/desktop/renderer/floating/vendor/avatar/**` → A6).
> **Plan:** `docs/agent-ops/plans/2026-10-19-remediation-wave1/A4-desktop.md` (T1–T15) + Ola 1b + Ola 1c (T0–T8).
> **Contrato:** `docs/agent-ops/plans/2026-10-19-remediation-wave1/README.md` · **Verdicts:** `VERDICT.md` §4.2 (R1, R2, R3, R14, R15).
> **Fecha:** 2026-10-20 · **Commits:** ninguno (árbol sucio a propósito, por instrucción del owner).

---

## 1. Estado del repo al cerrar la Ola 1c

| Comprobación | Resultado |
|---|---|
| `pnpm --filter @ego/desktop typecheck` | **exit 0** |
| `pnpm --filter @ego/renderer exec tsc --noEmit` | **exit 0** |
| `pnpm --filter @ego/desktop test` | **56 ficheros / 342 tests pasan** (+5 skipped) |
| `pnpm --filter @ego/renderer test` | **65 ficheros / 436 tests pasan** |
| `pnpm --filter @ego/desktop build` + `verify-dist.cjs` | **exit 0** — *TODOS LOS CHEQUEOS EN VERDE* |
| `pnpm --filter @ego/renderer build` | **exit 0** |
| `pnpm typecheck` (global) | **exit 0** |
| `pnpm lint` (global) | **exit 0** |

---

## 2. T1 — El flake de `ipc-bridges-t13.test.ts`: **causa raíz y arreglo**

### 2.1 El hallazgo de A7 era correcto y la causa NO era una carrera

A7 reportó: *"falla bajo carga y pasa aislado (10/10, 4,6 s)"*. **No era un flake de sincronización**: no había estado compartido, ni orden de eventos, ni suposición sobre `ipcMain.handle`.

### 2.2 Causa raíz (medida, no inferida)

El test hacía **`await import("../src/main.js")` DENTRO del cuerpo de un `it`**:

```ts
it("401 del proveedor → error accionable 'key inválida' y NO persiste", async () => {
  const { probeModelKey } = await import("../src/main.js");   // ← aquí
  ...
});
```

La primera evaluación de `../src/main.js` resuelve el **grafo de módulos completo del proceso main** (17 paquetes del workspace + el binding nativo de VantaDB). Medido:

| Contexto | Coste del import | Test que lo paga |
|---|---|---|
| Aislado | **1 543 ms** (`IMPORT_MS=1543`) | "401 del proveedor" |
| Suite de main en paralelo | **2 561 ms** | "401 del proveedor" (medido en la fase `tests`) |
| Después del fix (import a nivel de módulo) | **11 ms** en toda la fase `tests` (624 ms en `collect`) | **ninguno** |

El presupuesto por test de vitest es de **5 000 ms**. Con la suite global de 19 paquetes en paralelo, ese import se comía el 50 % del presupuesto → **timeout**, no un fallo de aserción.

**Veredicto:** era un **coste de setup cargado en el scope equivocado** (dentro del test en vez de en la fase de `collect`). La "carga" solo amplificaba un defecto estructural del test.

**No había bug de producción** en este camino: verifiqué el flujo real (`ipc.settings.saveModelConfig` → `probeModelKey` **antes** de `applyModelConfig` y del `adapter.put`): un 401 lanza y **no persiste nada**. El contrato "NO persiste" se cumplía; simplemente **nunca se comprobaba** (el test era tautológico, ver §5).

### 2.3 El arreglo (y de paso, la tautología)

El fichero se reescribió: el import sube a **nivel de módulo** (se paga en `collect`, que no tiene timeout por test) y el contrato pasa a verificarse **por comportamiento** (handlers capturados e invocados) en vez de por texto fuente.

**RED→GREEN demostrado** (A/B sobre el mismo fichero):

```
###### RED: import DENTRO del test ######
 Test Files  1 failed | 6 passed (11)     ← 5 tests rotos (los que usan probeModelKey)
###### GREEN: import a NIVEL DE MODULO ######
 Test Files  1 passed (1)
      Tests  11 passed (11)
```

### 2.4 Verificación exigida: N repeticiones en paralelo

```
8/8 ejecuciones CONCURRENTES: 11/11 tests pasan
```

(8 procesos `vitest` lanzados a la vez sobre el mismo fichero.)

---

## 3. T2 — Solicitudes de A3 aplicadas / no aplicadas (con veredicto)

| # | Solicitud de A3 | Estado | Veredicto |
|---|---|---|---|
| 1+2 | `eventBus` en `McpManager` (EGO-FIND-49) | ✅ **APLICADO** | `new McpManager(toolRegistry, { …, eventBus })`. Sin bus, un takeover de tool nativa no dejaba traza. |
| 3 | `RunRecorder` (COUC-09) | ✅ **APLICADO** | `runRecorder = new RunRecorder(adapter, eventBus)` + `runRecorder.dispose()` en `before-quit` (sin `dispose()`, el listener sobrevivía al apagado). |
| 4 | `payloadRegistry` en el `EgoMcpServer` (COUC-08) | ✅ **APLICADO** | `payloadRegistry: PayloadRegistry.getInstance()` (singleton) → `resources/list` y `resources/read` exponen los payloads reales. |
| 5 | `WindowStateHelper` canónico (HERM-08) | ✅ **APLICADO** | `WindowStateManager` **delega** la geometría en `WindowStateHelper` (`matchingWorkArea` / `resolveSafeBounds`) en vez de reimplementarla. Cambio de comportamiento **deliberado y mejorado**: el helper mira el `workArea` (excluye la barra de tareas) y no los `bounds`; antes una ventana asomando bajo la barra de tareas se daba por "visible". Test nuevo en `test/window-state.test.ts` (5 tests). |
| 6 | `WindowsSandboxFallback` / `WindowsUserEnv` / `ProcessSupervisor` | 🚫 **NO CABLEADO — veredicto** | Los tres viven en `packages/recovery` (zona de A3) y son **asimilados sin caller**. `ProcessSupervisor` tiene sentido para el proceso de un *worker* supervisor, no del main de Electron (que ya gestiona `app.on("before-quit")`); `WindowsSandboxFallback`/`WindowsUserEnv` soniky de arranque en Windows y **no aplican al runtime actual** (Ego arranca el navegador embebido, no una app Win32). **Veredicto: NO cablearlos** — hacerlo sería añadir código muerto. Proceden a **retirada** por A3 con veredicto formal (patrón `🚫 Descartada`), igual que hizo con `ResourcePolicy.ts` y `EgoStateStores.ts`. |
| 7 | Tipo `mermaid` en el renderer (OCLW-11) | ✅ **APLICADO** | `components/canvas/MermaidView.tsx` (nuevo) + registro en el registry dinámico bajo `MERMAID_COMPONENT_KIND`, con `propsSchema: MermaidComponentPropsSchema` y `prepare: prepareMermaidComponent`. **Fail-closed**: si `valid === false` no se renderiza el contenido. Test: `renderer/test/MermaidComponent.test.tsx` (4 tests). |
| 8 | Refrescar la lista de tools del catálogo | 🚫 **NO APLICA** | `fs_edit_patch` y `git_session_diff` las registra `registerNativeTools` (main) y el renderer las ve por el catálogo; no hay lista cacheada que refrescar. |
| — | `main.ts:5368` → `validatePathAsync` | 🚫 **OBSOLETO** | Ya **no existe** ninguna llamada síncrona a `PathValidator.validatePath` en `apps/desktop/**`: el spawn del terminal valida con `evaluateToolCall` (política canónica de `@ego/security`) y el resto con `assertPathInScope` (`src/main/path-scope.ts`). Verificado por búsqueda en todo `apps/desktop/src`. |
| — | Tipos espejo de `@ego/tasks` | 🚫 **NO HAY ESPEJO** | `apps/desktop/src/main/task-kinds.ts` define `TASK_SAFE_KINDS`… y **no hay equivalente canónico en `@ego/tasks`** (0 coincidencias). No es un espejo: es una allowlist **local y deliberada** (los kinds que corren sin HITL). Lo que sí era un espejo —la allowlist de comandos del terminal— ya se había unificado en la Ola 1 (`terminal-policy.ts` re-exporta la canónica de `@ego/tools`). **Veredicto: sin cambios.** |
| — | Los 6 `it.fails` de contraste (EGO-FIND-71) | ✅ **APLICADO** (A1, §4) | §4 de este handoff. |
| — | 3 tests tautológicos (EGO-FIND-63) | ✅ **APLICADO** | §5 de este handoff. |

---

## 4. T2 — Contraste: los 6 `it.fails` de contraste (EGO-FIND-71) → CERRADOS

**El hallazgo (medido, no inferido):** en `renderer/test/a11y.test.tsx` había **6 `it.fails(...)`** que documentaban ratios **reales** por debajo de AA. El dim y el borde fuerte del design system son **tokens FIJOS** (`#8a8a92` y `#71717a`), y las superficies de varios presets no llegaban.

**El fix (el que pedía el plan): ajustar los TOKENS DE SUPERFICIE de los presets afectados**, conservando matiz y croma (bajada de L en OKLCH).

| Hallazgo | Preset.token | Fijo | Exigido | Antes | Después | Ratio nuevo |
|---|---|---|---|---|---|---|
| FIND-A11Y-01 | warm-sepia.raised | `#78716c` | 3:1 | 2.14:1 | `#2c2825` | **3.05:1** |
| FIND-A11Y-04 | midnight-cyan.raised | `#8a8a92` | 4.5:1 | 4.27:1 | `#1a2536` | **4.50:1** |
| FIND-A11Y-05 | emerald-terminal.panel | `#8a8a92` | 4.5:1 | 2.84:1 | `#002b1b` | **4.50:1** |
| FIND-A11Y-02 | emerald-terminal.panel | `#71717a` | 3:1 | 2.01:1 | `#002b1b` | **3.19:1** |
| FIND-A11Y-06 | amber-warm.panel | `#8a8a92` | 4.5:1 | 4.43:1 | `#272323` | **4.54:1** |
| FIND-A11Y-03 | amber-warm.raised | `#71717a` | 3:1 | 2.13:1 | `#2c2825` | **3.02:1** |

### 4.1 Dos huecos MÁS que el plan no listaba (encontrados por el guard nuevo)

Al escribir un assert **de barrido** ("los tokens fijos cumplen en TODAS las superficies de TODOS los presets") aparecieron **dos huecos reales adicionales**, que también quedaron cerrados:

| Hueco | Preset.token | Fijo | Antes | Después |
|---|---|---|---|---|
| (7) `emerald-terminal.raised` | `#8a8a92` | 4.5:1 | 2.24:1 | `#032a1f` → **4.53:1** |
| (8) `emerald-terminal.background` (rampa no monótona) | `#8a8a92` | 4.5:1 | 4.52:1 sobre panel | `#022a21` → **4.52:1**, y `background < panel < raised` |

Además, la **paleta estática** `renderer/src/styles/theme-tokens.css` (las 4 paletas `[data-palette]`) tenía el **mismo hueco** que `warm-sepia.raised` (`oklch(0.374 …)` = `#44403c` → 2.14:1 contra su propio `--ego-color-border-strong`). Corregido a `oklch(0.28 0.008 59.3)` (= `#2c2825`).

### 4.2 Guardas que blindan el fix (para que no vuelva)

- `renderer/test/a11y.test.tsx`: los 6 `it.fails` son ahora `it` normales, y se añadió un assert de **barrido** (los tokens fijos cumplen en las 3 superficies de los 4 presets) + la restitución del `raised` en el assert de `borderStrong` de `warm-sepia` (que el hallazgo había dejado fuera).
- `renderer/test/ThemeTokensOklch.test.tsx`: 2 asserts nuevos — `border-strong` vs `raised` ≥ 3:1 y dim fijo vs `raised` ≥ 4.5:1 sobre las 4 paletas estáticas.

### 4.3 Coste de diseño que conviene conocer

En `emerald-terminal`, el dim fijo es un **gris neutro** (`#8a8a92`) sobre superficies **verdes**: para llegar a 4.5:1 la superficie tiene que bajar a L ≤ 0.0181, es decir, **casi al nivel del panel**. La "elevación" en ese preset es visualmente imperceptible. Es la consecuencia matemática de un gris neutro sobre verde, no un descuido. Si el owner quiere rampa visible en ese preset, la palanca es el **dim por preset** (que hoy es global), no la superficie.

---

## 5. T2 — Los 3 tests tautológicos convertidos en asserts de COMPORTAMIENTO (EGO-FIND-63)

| Fichero | Antes | Ahora |
|---|---|---|
| `test/ipc-bridges-t13.test.ts` | `expect(mainSrc).toContain('ipcMain.handle("ipc.sessions.list"')` + `expect(preloadSrc).toContain('"ipc.sessions.list"')` + `expect(egoSrc).toContain("sessions")` | Se mockea `electron`, se **capturan los handlers registrados** y se **invocan**: los 6 canales existen y son invocables; `ipc.sessions.list` responde; `ipc.settings.getStorageInfo` devuelve el estado real del almacén; `ipc.settings.getGovPolicies` devuelve las políticas. El preload y el mock del renderer se comprueban por su API, no por su texto. **11 tests** (antes 10). |
| `test/tasks-wiring.test.ts` | 4 asserts `toContain` sobre `mainSrc` | Los handlers de tasks/terminal se **capturan e invocan**: `ipc.tasks.list` responde con la forma del contrato; `ipc.terminal.spawn` **rechaza** un payload inválido (Zod) en vez de ejecutarlo. El contrato se comprueba contra `EgoIpcInvokeChannels` (no contra el texto de `ipc.ts`). **7 tests** (antes 5). El único assert que sigue siendo de fuente es el del Tray, y **ya no es tautológico**: afirma el ciclo de vida completo (`new Tray(` **y** `tray.destroy()`), no la existencia del string. |
| `renderer/test/ShikiOffload.test.tsx` | `expect(src).toContain("shiki/core")` | Se mantiene el check del source **para el caso que solo el source puede ver** (que el worker NO importe el bundle completo) pero se añaden dos asserts **de comportamiento**: el entry del worker debe ser un **módulo ES** (`self.onmessage`) y el host debe pedir `type: "module"` (con `format: "iife"` el build falla con `Invalid value "iife" for option "output.format"`). Además el test del resaltado comprueba que el fallback, si lo hubo, queda **MARCADO** (`data-shiki-fallback="true"`), no silencioso. **5 tests** (antes 4). |

---

## 6. T3 — `main.ts`: **2 857 → 2 436 líneas** (objetivo < 2 500 ✅)

| Módulo nuevo | Líneas | Qué contiene |
|---|---|---|
| `src/main/llm/handle-llm-stream.ts` | 385 | El handler del turno de LLM (streaming). Cuerpo movido **verbatim**; las referencias a los globales de módulo pasan a leerse de `ctx` (contexto explícito con **getters** en `main.ts` → los valores se leen **en vivo**; `activeProjectId` cambia cuando el usuario elige otro proyecto). |
| `src/main/security/permissions-policy.ts` | 118 | La política de permisos (funciones **puras**): `permissionRuleMatches`, `resolvePermissionDecision`, `isPathInScope`, `resolveEffectivePermission`, `shouldRequireApproval` + los tipos `PermissionQuery`/`PermissionToolInfo`. |
| `src/main/settings-cache.ts` | 130 | La caché de settings: `getCachedPermissionsSettings`, `loadPermissionsSettingsIntoCache`, `getCachedCompressionSettings`, `loadCompressionSettingsIntoCache`, `parsePermissionsSettings`. |

**Trampa evitada (importante):** la caché de permisos **ya vivía** en `src/main/ipc/ipc-state.ts` (estado compartido con los handlers IPC). Extraerla habría creado una **segunda copia** del estado → el getter y los handlers divergirían (el bug silencioso más caro de esta familia). Por eso `settings-cache.ts` **consume** el estado de `ipc-state.ts`, no lo duplica.

**Los 81 guards de contrato** que leen `src/main/**` con el helper `readMainSource()` siguen verdes (verifican el conjunto de ficheros, no uno solo).

**Resto de `main.ts`** (2 436 líneas): `createWindow` (~1 076) con el bootstrap de subsistemas, `createIpcDeps` (60), y los helpers de tray/proyecto/limpieza de memoria.

**Integridad de la extracción (verificada):** los **23** miembros del `ctx` se usan **todos** en el cuerpo del módulo y **todos** tienen su getter en `main.ts` (comprobación automática: 23/23). Además, el typecheck estricto + los tests del camino de LLM (`mvp-software-loop`, `golden-path-alpha-full`) cubren la equivalencia semántica.

---

## 7. T4 — Ciclo de vida del `EgoMcpServer`: cerrado (bearer revocado, sin referencias vivas)

### 7.1 El fallo (RED demostrado)

Antes de este trabajo:
- el servidor se cerraba (el puerto se liberaba) pero **el token bearer seguía en el keychain**: el siguiente arranque lo **reutilizaba**, así que un token que el usuario creía revocado seguía siendo válido para cualquier cliente externo que lo hubiera cacheado;
- el `McpManager` (y con él el `secretResolver`, que captura el `CredentialManager` del keychain) **no se liberaba** en el apagado: las referencias a credenciales sobrevivían al cierre de la app.

```
###### RED ######
AssertionError: el token debe revocar al cerrar: … expected 'qKIyJvUqZU5sF3Bb6Y4e8fy4UiI2JOOLiFOxZ…' to be undefined
AssertionError: expected '-OmlKcnNNrNoAGMAH6ppbK4dNt6-Nwyuc_7hz…' not to be '-OmlKcnNNrNoAGMAH6ppbK4dNt6-Nwyuc_7hz…'
AssertionError: el token revocado no debe autenticar: expected 200 to be 401
 Test Files  1 failed | 2 passed (5)
###### GREEN ######
 Test Files  1 passed (5)
```

### 7.2 El arreglo

- `McpTokenVault` acepta ahora `deleteSecret?` (el `CredentialManager` real lo tiene: es síncrono y devuelve `boolean`).
- `startEgoMcpServer` devuelve un handle cuyo `close()` **cierra el listener Y revoca el token** (idempotente: cerrar dos veces no lanza ni revoca dos veces).
- `before-quit`: `mcpServerHandle.close()` (revoca) → `mcpManager.dispose()` (suelta los clientes MCP y el `secretResolver`) → `runRecorder.dispose()` (suelta el listener del bus).

### 7.3 El test (`test/mcp-server-lifecycle.test.ts`, 5 tests)

1. arrancar → usar → cerrar: **el puerto deja de aceptar conexiones**.
2. al cerrar, **el token desaparece del almacén**.
3. el token revocado **no se reutiliza** (el siguiente arranque genera otro).
4. el token antiguo **devuelve 401** contra el servidor nuevo.
5. cerrar dos veces **no lanza** (idempotente).

---

## 8. T5 — Dominio de `DomainCanvasView` (R3) — ya cerrado en la Ola 1b

Recordatorio del handoff `A4-ola1b.md` §7: `components/domains/{views.tsx,domain-registry.ts,types.ts}` (nuevos) + `DomainCanvasView.tsx` (reescrito a 62 líneas, **0 ramas**), con test `renderer/test/DomainCanvasRegistry.test.tsx` (5 tests, RED→GREEN demostrado). En la Ola 1c no hubo cambios ahí.

---

## 9. T6 — `pnpm.overrides`: diff exacto para A7

### 9.1 Lo que YA subí (mi zona)

```diff
--- a/apps/desktop/package.json
+++ b/apps/desktop/package.json
   "devDependencies": {
-    "electron": "^33.2.0",
-    "electron-builder": "^25.1.8",
+    "electron": "^41.10.7",
+    "electron-builder": "^26.15.3",
     "electron-vite": "^5.0.0",
     "msw": "^2",
     "typescript": "^5.6.3",
-    "vitest": "^2.1.2",
+    "vitest": "^3.2.7",
     "wait-on": "^9.5.1"
   }

--- a/apps/desktop/renderer/package.json
+++ b/apps/desktop/renderer/package.json
   "devDependencies": {
-    "@vitest/coverage-v8": "^2.1.2",
+    "@vitest/coverage-v8": "^3.2.7",
     …
-    "vitest": "^2.1.2"
+    "vitest": "^3.2.7"
   }
```

Además (diff de A6, §3.1): `"@ego/avatar": "workspace:*"` en `apps/desktop/package.json` **y** en `apps/desktop/renderer/package.json`.

### 9.2 El diff que A7 debe aplicar en el `package.json` RAÍZ

```diff
   "pnpm": {
     "overrides": {
-      "electron": "^41.10.7",
-      "electron-builder": "^26.15.3",
-      "app-builder-lib": "26.15.3",
-      "builder-util-runtime": "^9.7.0",
-      "vitest": "^3.2.7",
-      "@vitest/coverage-v8": "^3.2.7",
-      "tinypool": "^2.2.0",
-      "tar": "^7.5.22",
-      "vitepress>vite": "^6.4.4"
+      "vitest": "^3.2.7",
+      "tinypool": "^2.2.0",
+      "tar": "^7.5.22",
+      "vitepress>vite": "^6.4.4"
     }
   }
```

**Qué se puede borrar YA y por qué:**

| Override | ¿Borrable? | Por qué |
|---|---|---|
| `electron` | ✅ **SÍ** | `apps/desktop` ya declara `^41.10.7` (la versión que el override forzaba). |
| `electron-builder` | ✅ **SÍ** | `apps/desktop` ya declara `^26.15.3`. |
| `app-builder-lib` | ✅ **SÍ** | `electron-builder@26.15.3` declara `app-builder-lib: "26.15.3"` **exacto** → el pin era redundante. |
| `builder-util-runtime` | ✅ **SÍ** | `electron-builder@26.15.3` declara `builder-util-runtime: "9.7.0"` **exacto** → redundante. |
| `@vitest/coverage-v8` | ✅ **SÍ** | `apps/desktop/renderer` ya declara `^3.2.7`. |
| `tar` | ⚠️ **SÍ, tras verificar el install** | Con `electron-builder@26.15.3` → `app-builder-lib@26.15.3` → `tar: ^7.5.7` (ya en rango) y `@electron/rebuild: ^4` → `node-gyp@^10` → `tar@^7`. El `tar@6` que forzaba el override venía de `node-gyp@6` ← `@electron/rebuild@3/6` ← `electron-builder@25`. **Verificar tras el install** (no puedo confirmarlo sin `pnpm install`). |
| `vitest` | ❌ **NO TODAVÍA** | **17 paquetes** (zona de A2) siguen declarando `vitest@^2.1.2`: `dailystate, decision, domains, events, execution, integrations, knowledge, memory, models, recovery, runtime, security, subegos, tasks, tool-call-repair, tools, ui-runtime`. Cuando A2 los suba a `^3.2.7`, se puede borrar. |
| `tinypool` | ❌ **DEBE PERMANECER** | `vitest@3.2.7` declara `tinypool: ^1.1.1`; el override fuerza un **major** (2.2.0) sobre una dependencia **transitiva** que no se puede expresar en los manifiestos (vitest no es de nadie de esta ola). Es un override de *seguridad*, no de resolución. |
| `vitepress>vite` | ➡️ **Decisión de A7** | Scope a `vitepress` (dependencia de docs). No es de mi zona. |

### 9.3 `vantadb-node` → tarball: **BLOQUEADO por el orquestador**

A7 pidió en `apps/desktop/package.json`:

```diff
-    "vantadb-node": "file:../../../VantaDB/vantadb-node"
+    "vantadb-node": "file:../../vendor/vantadb-node/vantadb-node-0.8.0.tgz"
```

**NO lo he aplicado**: `vendor/` **no existe** en el repo (`vendor/vantadb-node/vantadb-node-0.8.0.tgz` no está). Aplicarlo ahora dejaría el repo **rojo** (dependencia no resoluble). El orden correcto es:

1. **La Orchestrator** copia el tarball: `C:\Users\Eros\VantaDB Proyect\VantaDB\vantadb-node\vantadb-node-0.8.0.tgz` → `C:\Users\Eros\VantaDB Proyect\Ego\vendor\vantadb-node\vantadb-node-0.8.0.tgz` (2 598 617 bytes).
2. **A4** aplica el diff de arriba en `apps/desktop/package.json` **y** en `packages/memory/package.json` (A2).
3. **A7** ejecuta `pnpm install` para reescribir el lockfile con el `integrity`: `sha512-8u1bMpncEpQhtrar94M/qNZ9RsUdOdFmYHpo7gR79NuABlCPa4nPDlEcQgGjLBGWQ0ntdM7fRuEPI6/iZF61zw==`.

> **Aviso (incidencia vivida en la Ola 1b):** una instalación concurrente dejó `vantadb-node` **a medio copiar** en el store de pnpm (solo el `.node`, sin `index.js`/`index.cjs`/`index.d.ts`/`package.json`) → 37 tests de main caían con `VantaError: connect (is the native binding built?)`. Se reparó copiando los 4 ficheros desde el directorio fuente al store. **Si A7 vuelve a ver ese error, es esto.**

---

## 10. T7 — Deuda de la Ola 1 cerrada en mi zona

| Deuda | Estado |
|---|---|
| `DESIGN.md` con los tokens OKLCH | ✅ **A1 lo escribe** (ya lo tenía en el handoff de la Ola 1b §3.3: la tabla completa de las 4 paletas con sus valores OKLCH y los ratios verificados). **A1** actualizó además `docs/design/design-system.md` §8.1 (la fila de `Select` ya refleja la migración a Radix y las justificaciones D3 coinciden con las mías). **Confirmado: el contenido que le pasé está completo y vigente.** |
| `packages/recovery/test/chaos/hard-kill.test.ts` flaky bajo carga | ➡️ **NO es de mi zona** (`packages/**` → A2/A3). Pasa en aislamiento. Lo entrego con el diagnóstico: el test mata el proceso y espera al **lock corrupto**; bajo carga el plazo se agota. |
| `transition-all` | ✅ **0** en todo `apps/desktop/renderer` (verificado por barrido). |
| Store Zustand: re-render global por delta | ✅ **CERRADO** (Ola 1b §11): `appendToLastMessage` conserva la identidad del array y del último mensaje. Test: `renderer/test/ChatTranscriptNoGlobalRerender.test.ts` (4 tests). |

---

## 11. Decisión de transporte del MCP Server (para ratificación del owner)

**Ratifico la decisión del orquestador**: **HTTP streamable en `127.0.0.1`, en-proceso (NO proceso hijo stdio)**, con token bearer obligatorio.

**Por qué in-proceso y no stdio** (el argumento, con el matiz que aporta la implementación): las tools y la memoria de Ego viven en el **proceso main** (VantaDB vía `EgoMemoryAdapter`, `ToolRegistry`, `ApprovalEngine`). Un servidor en un proceso hijo stdio obligaría a proxiar **todo** (tools + memoria) por el pipe y duplicaría el runtime → el catálogo expuesto sería una copia desincronizada, no el catálogo real. In-proceso, `tools/list` devuelve **el `ToolRegistry` de verdad**.

**Por qué HTTP y no solo stdio también para el in-proceso:** `EgoMcpServer` expone `handleRequest(request)` (agnóstico de transporte) + `startStdio()`. El transporte HTTP lo implemento yo en `src/main/mcp/mcp-http-server.ts` (mi zona), sin tocar `packages/integrations/**`. HTTP sobre loopback es lo que permite que **otro proceso** (un cliente MCP externo) hable con Ego sin exponerse a la LAN; stdio solo hablaría con un padre que lo lanza.

**Las 4 garantías de seguridad, implementadas y testeadas** (ver §7 y el handoff de la Ola 1b §4.2):

| Requisito | Implementación | Test |
|---|---|---|
| (a) solo loopback | `startEgoMcpHttpServer` **lanza** si el host no es `127.0.0.1`/`::1`/`localhost` | `rejects.toThrow(/loopback/i)` para `0.0.0.0` y `::` |
| (b) bearer obligatorio, nunca en disco ni en el renderer en claro | 32 bytes aleatorios (`base64url`), persistidos **cifrados** en el `CredentialManager` (keychain) bajo `mcp/ego-mcp-server`, **reutilizados** entre arranques, **revocados** al cerrar. Nunca en la URL, nunca en la respuesta, nunca en el renderer. El log de arranque imprime **solo la URL**. | `expect(handle.url).not.toContain("token")` + `expect(JSON.stringify(body)).not.toContain(TOKEN)` + el token revocado devuelve 401 |
| (c) gate HITL fail-closed | El gate es el **mismo `ApprovalEngine`** del chat: `evaluateRequirement` → si exige aprobación, `requestApproval` y solo se ejecuta con `approved === true`. Sin gate, el propio `EgoMcpServer` rechaza. | `tools/call` de una tool `destructive` → el gate se invoca y la ejecución se rechaza |
| (d) rechazo sin token ANTES de tocar el registry | El bearer se valida en el `requestListener` **antes** de parsear el body y antes de `server.handleRequest(...)`; comparación en **tiempo constante** (`timingSafeEqual`). | sin token → **401** y `expect(gateCalls).toHaveLength(0)` |

**Pendiente de decisión de producto (no lo decido yo):** el token **no** se expone al renderer. Si el owner quiere que la UI muestre o copie el token para conectar un cliente externo, hace falta un canal explícito (p. ej. `ipc.mcp.serverToken` con aprobación) → **decisión del owner**.

---

## 12. Ficheros tocados en la Ola 1c

**Nuevos (main):** `src/main/llm/handle-llm-stream.ts`, `src/main/security/permissions-policy.ts`, `src/main/settings-cache.ts`.
**Nuevos (renderer):** `renderer/components/canvas/MermaidView.tsx`, `renderer/test/MermaidComponent.test.tsx`.
**Nuevos (tests):** `test/mcp-server-lifecycle.test.ts`.
**Modificados:** `src/main.ts` (2 857 → **2 436**), `src/main/mcp/mcp-server-runtime.ts` (revocación del token + `PayloadRegistry`), `src/main/mcp/mcp-http-server.ts`, `src/main/ipc/register-ipc.ts` (sin cambios), `src/windows/WindowStateManager.ts` (helper canónico), `renderer/components/canvas/DesignSystemProvider.tsx` + `renderer/src/styles/theme-tokens.css` + `renderer/test/a11y.test.tsx` + `renderer/test/ThemeTokens.test.tsx` + `renderer/test/ThemeTokensOklch.test.tsx` (contraste), `test/ipc-bridges-t13.test.ts`, `test/tasks-wiring.test.ts`, `test/window-state.test.ts`, `test/compaction-summarizer-wiring.test.ts`, `renderer/test/ShikiOffload.test.tsx`, `packages/integrations/src/mcp/McpManager.ts` (**4 líneas**, bajo la reasignación R2 — ver abajo).

### 12.1 Cambio en `packages/integrations/**` (excepción justificada)

`packages/integrations/src/mcp/McpManager.ts`: **+4 líneas** para propagar el `secretResolver` al `McpClient` que crea. El VERDICT §4.2 reasigna **R2 a A4** ("*Pasar el `secretResolver` (keychain) al `McpClient`… **Dueño asignado: A4***"), y **sin** ese seam la decisión D2 es inerte: `McpManager` construía el cliente con `new McpClient(config)` (sin opciones) → el resolver nunca llegaba. El cambio es **aditivo y opcional** (una option nueva + su propagación); no altera ningún comportamiento por defecto.

---

## 13. Checklist del DoD

- [x] `pnpm --filter @ego/desktop typecheck`: exit 0.
- [x] `pnpm --filter @ego/renderer exec tsc --noEmit`: exit 0.
- [x] `pnpm --filter @ego/desktop test`: **342 pasan**, 0 fallan.
- [x] `pnpm --filter @ego/renderer test`: **436 pasan**, 0 fallan.
- [x] `pnpm --filter @ego/desktop build` + `verify-dist.cjs`: exit 0, verde.
- [x] `pnpm --filter @ego/renderer build`: exit 0.
- [x] `pnpm typecheck` y `pnpm lint` globales: exit 0.
- [x] T1 (flake): **causa raíz medida y corregida**; 8/8 ejecuciones concurrentes en verde.
- [x] T2: solicitudes de A3 aplicadas o con veredicto documentado (§3).
- [x] T3: `main.ts` **2 436** líneas (< 2 500); los 81 guards de contrato siguen verdes.
- [x] T4: ciclo de vida del MCP Server cerrado (token revocado, sin referencias vivas).
- [x] T5: avatar canónico (4 diffs de A6) + el espejo vendorizado **intacto** (D5).
- [x] T6: diff exacto de la raíz para A7 (§9.2) + `vantadb-node` documentado como bloqueado (§9.3).
- [x] T7: deuda de mi zona cerrada (§10).
- [x] TDD real con RED demostrado en T1 (flake), T2 (contraste), T4 (ciclo de vida) y T8 (Diff E).
- [x] Sin commits · sin `git checkout/reset/stash/clean` · sin `pnpm install`.
- [x] No tocado: `packages/avatar/**`, `floating/vendor/avatar/**` (A6), `docs/**` (A1), `packages/{memory,knowledge,runtime,models,decision,execution,events,security}/**` (A2), `package.json` raíz · `pnpm-lock.yaml` · `.github/**` (A7).
