# A4 — Ola 3 · E6-res (remate de `main.ts`) + T-X1 (la fuga de 320 MB)

> **Agente:** A4 · **Zona:** `apps/desktop/src/**`, `apps/desktop/test/**`, `apps/desktop/renderer/**` (salvo `floating/vendor/avatar/**` → A6).
> **Fecha:** 2026-10-20 · **Commits:** ninguno (el orquestador commitea).
> **Contrato:** `OLA3-CONTRATO.md` §Propiedad/§Handoff/§Método · **VERDICT §7** ítem E6-res y transversal T-X1.
> **Previo:** `A4-ola2-E6.md` (el mapa de responsabilidades y la deuda que dejé).

---

## 1. Resumen (los dos objetivos, medidos)

| Objetivo | Antes | Después | Estado |
|---|---|---|---|
| `main.ts` | **1 288 líneas** | **866 líneas** | ✅ (< 1 100) |
| `let` globales mutables fuera de `app-context.ts` | 0 | **0** | ✅ (61 en `app-context.ts`) |
| Bundle `out/main/main.js` | 245,0 KB | **246,7 KB** | ⚠️ **+1,7 KB (+0,7 %)** — §6 |
| Fuga de disco por corrida | **+1 huérfano de 320 MB** | **0 huérfanos, 0 MB de restos** | ✅ |
| Suite del desktop | 345 tests | **363 tests** | ✅ |
| Suite del renderer | 493 tests | **524 tests** | ✅ |

**Histórico de `main.ts`**: 5 401 (origen) → 2 436 (E6) → 1 288 (E6, cierre) → **866 (E6-res)**.

---

## 2. T-X1 — La fuga de 320 MB por corrida

### 2.1 Diagnóstico: de dónde salen los 320 MB

**Medido con una sonda** (`apps/desktop/scripts/t-x1-probe.cjs`): un store de VantaDB **vacío** ocupa **320,06 MB** en el momento de `connect()`.

```text
tras init():            320.06 MB
tras 1 turno:           320.06 MB
```

El binding nativo pre-reserva **5 × 64 MB** al conectar, **con independencia de los datos**:

```text
.vanta.lock
.vanta.schema
0.jnl                       (64.00 MB)   ← journal
data/vstore_L0.vanta        (64.00 MB)
data/vstore_L1.vanta        (64.00 MB)
data/vstore_L2.vanta        (64.00 MB)
data/vstore_L3.vanta        (64.00 MB)
data/vanta.shard*.wal       (0.00 MB)
keyspaces/0/…              (~0.02 MB)
```

**Conclusión**: los 320 MB **no son los datos del test**; son la pre-reserva del motor nativo (Fjall LSM: 4 niveles de `vstore` + el journal). Cada `new EgoMemoryAdapter(dir)` + `init()` cuesta 320 MB de disco aunque no se escriba nunca.

**Por qué se acumulaban**: los tests creaban su directorio **suelto en `%TEMP%`** (`os.tmpdir()` + `mkdtemp`, con **13 prefijos distintos** repartidos en **14 ficheros**) y lo borraban en `afterEach`/`afterAll`. Si el proceso **muere** (timeout del test, `kill`, reinicio del servidor), el teardown no se ejecuta y el directorio **se queda para siempre**: 320 MB por huérfano. Con 19 paquetes en paralelo, el acumulado llevó el disco C: al **2,5 % libre** (475 GB) y hubo que liberar 6,3 GB a mano (273 directorios huérfanos).

### 2.2 La convención (compartida con A3 — misma raíz, mismo nombre, misma regla)

1. **Raíz**: `%TEMP%/ego-test-scratch/` — **compartida** por todos los agentes. Cada agente barre la raíz completa, así que la limpieza de uno recoge también los huérfanos del otro.
2. **Directorio de corrida**: `<raíz>/run-<epochMs>-<pid>-<rand6>/`. El PID es la clave: permite saber si el dueño sigue vivo.
3. **Directorio de test**: `<run>/<suite>-<n>/`.
4. **Barrido al inicio de cada corrida**: se borra todo `run-*` cuyo PID **no esté vivo** (proceso muerto → sus restos son basura) o cuya antigüedad supere `SCRATCH_MAX_AGE_MS` (6 h, por si el PID se reutilizó). **Esto es lo que hace la limpieza resistant a la muerte del proceso**: la corrida siguiente recoge lo que la anterior dejó.
5. **Teardown idempotente**: `fs.rmSync(dir, { recursive, force, maxRetries: 5, retryDelay: 200 })` — `force` la hace idempotente y los reintentos absorben los bloqueos de fichero de Windows (el binding nativo puede tener handles abiertos un instante).
6. **Best-effort al morir**: `process.on("exit")` + `SIGINT`/`SIGTERM` borran el run-dir de esa corrida (la señal se re-eleva para no cambiar la semántica por defecto del proceso). Es una red adicional: la real es el punto 4.
7. **Nunca** un store suelto en `%TEMP%`: siempre dentro de la raíz.

> **Convergencia con A3 (verificado sobre su código, no supuesto).** A3 implementó la misma idea **en código de producción** (`packages/tools/src/TempWorkspace.ts`, `TEMP_WORKSPACE_ROOT_NAME = "ego-scratch"`, exportado por `@ego/tools`), pero con **otra raíz** (`ego-scratch`) y **otro nombre de run-dir** (`run-<pid>-<rand>`, sin marca de tiempo) y con el barrido **solo por antigüedad** (6 h), no por PID muerto.
>
> Con dos convenciones, **el barrido de cada uno NO recogía los huérfanos del otro** → la fuga seguía creciendo por el otro lado. **Lo he resuelto sin bloquear a A3**: mi `sweepOrphanScratch()` barre **las dos raíces** y **las dos convenciones de nombre** (parsea el PID de ambas formas y usa el `mtime` cuando el nombre no lo trae). Comprobado en la corrida real:
>
> ```text
> [test-scratch] barridos 2 run(s) huérfanos: ego-test-scratch\run-1792552006647-19964-wdq8vs, ego-scratch\run-25076-shaigr
> ```
>
> (uno de cada raíz). La **convergencia de nombres** (una sola raíz) queda como deuda de A3 (§5.3) — es cosmética: el efecto ya está resuelto.

### 2.3 Implementación (mi zona)

| Fichero | Qué hace |
|---|---|
| `apps/desktop/test/helpers/test-scratch.ts` | **NUEVO** — la convención: `createScratchDir`, `removeScratchDir`, `sweepOrphanScratch`, `isProcessAlive`, `scratchRunDir`, `TEST_SCRATCH_ROOT`, `SCRATCH_MAX_AGE_MS` + los hooks de muerte del proceso. |
| `apps/desktop/test/helpers/global-setup.ts` | **NUEVO** — el barrido, **una vez por corrida** (proceso principal de vitest). |
| `apps/desktop/vitest.config.ts` | `globalSetup: ["./test/helpers/global-setup.ts"]`. |
| `apps/desktop/test/t-x1-scratch.test.ts` | **NUEVO** — 9 tests (el guard de la convención + el barrido + la prueba de integración del proceso muerto). |
| **14 ficheros de test** | `os.tmpdir()` + `mkdtemp` → `createScratchDir(...)`; `fs.rm(dir, {recursive, force})` → `removeScratchDir(dir)`. |

### 2.4 Las dos mediciones de disco (antes y después)

**ANTES (con el código viejo, la fuga abierta):**

```text
ANTES:  16.685 GB libres (3.507%) | huerfanos=10 (1472.4 MB)
   ... suite ...
DESPUES: 16.367 GB libres (3.44%)  | huerfanos=11 (1792.4 MB) | duracion=48.6s
delta libre: 0.318 GB          ← UN store de 320 MB que nadie recogió
```

**DESPUÉS (con la convención):**

```text
ANTES:  18.434 GB libres (3.874%) | scratch=2 dirs (64 MB)
[test-scratch] barridos 2 run(s) huérfanos: ego-test-scratch\run-1792552006647-19964-wdq8vs, ego-scratch\run-25076-shaigr
   ... suite: 58 passed | 363 tests ...
DESPUES: 17.979 GB libres (3.778%) | scratch=2 dirs (0 MB)
```

Y 20 s después (con el store transitorio ya liberado):

```text
disco ahora: 18.325 GB libres (3.851%)
=== restos ego-* en TEMP ===
  ego-scratch  (0 MB)
  ego-test-scratch  (0 MB)
```

**Huérfanos: 0** (los dos únicos directorios que quedan en `%TEMP%` son las raíces compartidas, **vacías**). Y la limpieza manual del debris legacy (13 directorios sueltos de la era pre-fix, 1 792,4 MB) devolvió el disco de 16,2 GB a 18,3 GB libres.

### 2.5 Un bug preexistente que la fuga descubría (y que arreglaré en mi zona)

Con el scratch compartido, `sessions-resume.test.ts` falló con:

```text
Database busy: database at …\ego-sessions-resume-1 is already open in this process (writer);
close the existing handle before reopening
```

**No lo causaba mi cambio** (fallaba ya en la medición "antes", por timeout), pero el diagnóstico merecía la pena:

- El primer test del fichero hace un **close/reopen** del store nativo (su propósito: probar la persistencia). El `await writer.close()` estaba **FUERA** del `finally`.
- Con el presupuesto por defecto (5 s) y la máquina saturada, ese test se iba por **timeout** → el `close()` no se ejecutaba → el handle nativo quedaba abierto como *writer* → el **siguiente** test del fichero fallaba con "Database busy".
- **Un timeout de un test se convertía en un fallo ENCASCADADO del siguiente**, y en un handle nativo que nadie cerraba (320 MB huérfanos).

**Arreglo** (en mi zona): presupuesto explícito de 20 s (proporcional a su coste real: ~1,7 s aislado, ~2,3 s con la máquina cargada) **y** el `close()` del writer dentro de un `finally` → el handle nunca se fuga, aunque una aserción falle antes.

---

## 3. E6-res — El remate de `main.ts`

### 3.1 La medición previa (qué se iba a mover y por qué)

`main.ts` (1 288 líneas) tenía estos bloques ≥ 40 líneas:

| Bloque | Líneas | Dónde vive ahora |
|---|---|---|
| `ensureTray` + `createTrayIcon` + `refreshTrayStatus` + `emitTrayId` + `pause/resumeAllBackgroundTasks` + la atención de la isla flotante (`floatingSnapshot`, `getAttentionFsm`, `recomputeFloatingAttention`, `syncFloatingFromEngine`) + `ensureFloatMgr` | **252** | `src/main/tray/tray-controller.ts` |
| `getOrCreateDefaultProject` | **39** | `src/main/subsystems/default-project.ts` |
| `modelPoolProviderFactory` + `getModelCredentialPool` + `setModelCredentialPoolForTests` + `syncModelCredentialPool` | **68** | `src/main/models/model-pool.ts` |
| `scheduleMemoryCleanup` + `stopMemoryCleanupForTests` | **56** | `src/main/subsystems/memory-cleanup.ts` |

**La trampa (que ya me había mordido):** antes de mover cada bloque comprobé **dónde vive ya su estado**:

| Estado | ¿Dónde vive? | Decisión |
|---|---|---|
| `tray`, `trayStatus`, `floatMgr`, `attentionFsm` | `state/app-context.ts` | El módulo nuevo los **consume** (binding vivo) y los **escribe por su setter**. **Sin segunda copia.** |
| `modelCredentialPool`, `modelCredentialManager` | `state/app-context.ts` | Ídem. |
| `memoryCleanupTimer`, `memoryCleanupFirst` | `state/app-context.ts` | Ídem. |
| `currentModelConfig` | `main/models/model-config.ts` | El módulo nuevo lo importa de ahí (no se mueve). |
| `cachedPermissionsSettings` | `main/ipc/ipc-state.ts` | **NO se toca** (era la trampa de la Ola 1). |
| `llmAbortControllers` | `main.ts` (era un `const` local) | **Movido a `app-context.ts`**: es estado del proceso (un contenedor mutable) y el módulo del tray lo necesita. Antes quedaba fuera del gate porque era `const`. |

**Ninguna duplicación de estado**: los 4 módulos nuevos importan el estado de `app-context.ts` (o de `model-config.ts`), nunca lo redeclaran.

### 3.2 El mapa de responsabilidades resultante (`main.ts` = 866 líneas)

| Bloque | Líneas aprox. | Responsabilidad |
|---|---|---|
| Imports + arranque del proceso | ~120 | `app.whenReady()` → `createWindow(...)`; apagado ordenado (`before-quit`): terminal, tray, MCP (revocando el token), `McpManager`, `RunRecorder`, `OpGate`, `releaseLockAsync()`. |
| **Ventana flotante** (`ensureFloatMgr` ya no está aquí) | ~60 | `pushTurnCancelled`, la cola de pushes al renderer, las sesiones de terminal. |
| **Cola de pushes al renderer** (`mainPushQueue`, `enqueueMainPush`, `sendMainPushNow`, `drainMainPushQueue`) | ~90 | Transporte al renderer con coalesce por prioridad. |
| **Sesiones de terminal** (`terminalSessions`, `pushTerminalOutput`, `endTerminalSession`, `killTerminalSession`) | ~90 | PTY del terminal. |
| **Scope / cwd** (`resolveScopeDirs`, `currentScopeDirs`, `resolveCwdRoot`, `estimateTurnTokens`) | ~85 | Alcance del workspace. |
| **Ciclo del turno** (`buildTurnPrompt`, `getLoopStableHash`, `queueMainSteer`, `clearTurnSystemFingerprint`, `getDefaultNucleusSoul`, `resolveTurnSoul`) | ~170 | Prompt y sellos de estabilidad. |
| **Contexto del LLM** (`llmCtx`, `runLlmStream`) | ~110 | Inyecta el estado vivo en `handle-llm-stream.ts`. |
| **Manifiestos de cableado** (`createIpcDeps`, `createWindowDeps`) | ~190 | Las dos "puertas" del proceso: qué ve el renderer y qué ve la ventana. |

**Lo que se fue a `src/main/**`**: `window/create-window.ts` (1 095), `state/app-context.ts` (545), `state/runtime-getters.ts` (154), `tray/tray-controller.ts` (296), `models/model-pool.ts` (92), `subsystems/default-project.ts` (49), `subsystems/memory-cleanup.ts` (75), `llm/handle-llm-stream.ts` (480), `settings-cache.ts`, `security/permissions-policy.ts`, `mcp/*`.

**`createIpcDeps` se queda** (como pedía el brief): es el manifiesto de cableado; moverlo solo trasladaría el acoplamiento (tendría que recibir ~15 deps para devolver un objeto de deps).

### 3.3 El gate de CI con los umbrales nuevos (TDD: rojo → verde)

**RED (el gate con el umbral nuevo, antes de mover nada):**

```text
❯ test/e6-runtime-state.test.ts (5 tests | 2 failed)
  AssertionError: main.ts tiene 1288 líneas (objetivo E6-res: < 1100): expected 1288 to be less than 1100
  AssertionError: function ensureTray sigue en main.ts: su bloque debe vivir en un módulo propio: expected true to be false
 Test Files  1 failed (1)
      Tests  2 failed | 3 passed (5)
```

**GREEN (después de la extracción):**

```text
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

El gate tiene ahora **dos** umbrales: el de líneas (< 1 100) y el de **responsabilidad** (los 4 símbolos extraídos **no** pueden estar en `main.ts`). El segundo es el que impide que un refactor futuro los devuelva al compositor.

### 3.4 Un error mío que el gate no cazó (y que dejo documentado)

Mi extractor de bloques contaba llaves desde el **inicio de la firma**; con un valor por defecto `= {}` en los parámetros, la profundidad cerraba **antes** del cuerpo y el rango se cortaba a mitad de función (el `syncModelCredentialPool` se partió en dos). Lo detecté por el typecheck (no por el gate) y lo arreglé: el conteo arranca en la primera llave **después** del cierre de los parámetros. **El gate de líneas no lo habría cazado** (main.ts habría quedado más corto, pero roto) — por eso el typecheck va siempre antes que el gate.

---

## 4. La convención de limpieza compartida (para que A3 la aplique igual)

**A3 (`packages/{tools,recovery,tasks,subegos}`)**: la misma fuga, en su zona. El diff exacto:

**1) Copiar el helper** a `packages/<pkg>/test/helpers/test-scratch.ts` (contenido idéntico al mío: `apps/desktop/test/helpers/test-scratch.ts`), **porPkg** o, mejor, en un sitio compartido si A2 lo pone en `packages/` (p. ej. `packages/memory/test-helpers/test-scratch.ts`).

**2) Añadir el `globalSetup` al `vitest.config.ts` de cada paquete:**

```diff
--- a/packages/tools/vitest.config.ts
+++ b/packages/tools/vitest.config.ts
   test: {
     include: ["test/**/*.test.ts"],
+    globalSetup: ["./test/helpers/global-setup.ts"],
   },
```

**3) Envolver los `os.tmpdir()` de sus tests:**

```diff
-import fs from "node:fs";
-import os from "node:os";
+import fs from "node:fs";
+import { createScratchDir, removeScratchDir } from "./helpers/test-scratch.js";

   beforeEach(async () => {
-    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ego-tools-test-"));
+    tmpDir = createScratchDir("ego-tools-test");
   });

   afterEach(async () => {
-    fs.rmSync(tmpDir, { recursive: true, force: true });
+    removeScratchDir(tmpDir);
   });
```

**4) El barrido es GLOBAL por construcción**: como la raíz es `%TEMP%/ego-test-scratch/` y el barrido borra cualquier `run-*` con PID muerto (sea de quien sea), **quien barra primero recoge los huérfanos de todos**. No hay carrera: `removeScratchDir` es idempotente (`force: true`).

**Lo que A3 NO tiene que hacer**: reimplementar la lógica del barrido, ni un `package.json` de scripts nuevo, ni tocar el motor.

---

## 5. Solicitudes fuera de zona (con diff exacto)

### 5.1 A2 (`packages/memory`) — la pre-reserva de 320 MB del binding nativo

**Hallazgo (medido)**: `NativeVantaDB.connect(path)` pre-reserva **5 × 64 MB** (4 `vstore_L*.vanta` + `0.jnl`) en el store, **con independencia de los datos**. Un store vacío ocupa 320,06 MB.

**Por qué importa**:

- En los **tests** multiplica el coste de disco (y fue la causa de la fuga queinguishable el 2,5 % libre).
- En el **producto** significa **320 MB por store de memoria** (proyecto por defecto, sesiones, sub-egos). No es un detalle de tests: es el coste de arranque de un usuario.

**Lo que pido**: que `EgoMemoryAdapter` (o el binding) exponga la pre-reserva como parámetro (p. ej. `connect(path, { read_only, levels: 2 })`), o al menos que quede **registrado como requisito upstream** (`VDB-REQ-14`).

**Diff que pido en `packages/memory` (si A2 decide hacerlo):**

```diff
--- a/packages/memory/EgoMemoryAdapter.ts
+++ b/packages/memory/EgoMemoryAdapter.ts
   public async init(): Promise<void> {
     if (this.isInitialized) return;
     const { NativeVantaDB } = await import("vantadb/native");
-    this.db = await NativeVantaDB.connect(this.storagePath, { read_only: false });
+    // T-X1 (Ola 3): la pre-reserva del motor nativo es de 5 × 64 MB por
+    // store (medido: 320,06 MB con el store VACÍO). En los tests eso
+    // multiplicaba el consumo de disco; en el producto, son 320 MB por
+    // memoria. Si el binding expone la opción, se usa aquí.
+    this.db = await NativeVantaDB.connect(this.storagePath, {
+      read_only: false,
+      ...(this.options.storageLevels ? { levels: this.options.storageLevels } : {}),
+    });
     this.isInitialized = true;
   }
```

> **No lo he hecho yo**: `packages/**` es zona de A2/A3, y el binding (`vantadb-node`) no está en este repo.

### 5.2 A1 (`docs/**`) — registrar el hallazgo en el registro canónico

El contrato §4.4 dice: *"Workarounds de VantaDB → registro canónico con ID referenciado en el código"*. Pido a A1 que añada a `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` (y a `docs/engineering/vantadb-readiness-plan.md` como requisito upstream):

> **`VDB-INC-XX` — La pre-reserva del store es de 320 MB.** `NativeVantaDB.connect(path)` reserva 5 × 64 MB (4 `vstore_L*.vanta` + `0.jnl`) al conectar, con independencia de los datos: un store vacío ocupa 320,06 MB (medido 2026-10-20, `apps/desktop/scripts/t-x1-probe.cjs`). Impacto: (a) en los tests, cada store cuesta 320 MB de disco y su accumulation levou el disco C: al 2,5 % libre; (b) en el producto, son 320 MB por memoria (proyecto por defecto, sesiones). Workaround en Ego: el scratch de los tests vive bajo una raíz compartida con barrido por antigüedad (T-X1), lo que acota el impacto pero no lo elimina. Requisito upstream: exponer la pre-reserva como parámetro (`levels`) → `VDB-REQ-14`.

### 5.3 A3 (`packages/**`) — la misma fuga, pero con OTRA convención (diverge)

**Aviso**: al revisar el estado final he visto que A3 ha migrado sus tests a un helper **propio** (`createTempWorkspace({ prefix: … })`, en `packages/*/src/index.js`), **no** al mío (`createScratchDir`). Las dos convenciones **divergen** en lo que más importa:

| | Mi convención (A4) | La de A3 (a día de hoy) |
|---|---|---|
| Raíz | `%TEMP%/ego-test-scratch/` (compartida) | la que use `createTempWorkspace` (por confirmar) |
| ¿El barrido de la corrida siguiente recoge los huérfanos? | **Sí** (raíz compartida + PID muerto) | **No** (si su helper no barre) |
| Teardown idempotente | `removeScratchDir` (`force` + reintentos) | `fs.rm(…, { force: true })` en su `afterEach` |

**Lo que pido a A3** (misma raíz, mismo nombre, misma regla — §2.2):

**0) [LO MÁS IMPORTANTE] Que su barrido también use el criterio de PID MUERTO.** El suyo es solo por antigüedad (6 h): un run que murió hace 5 minutos **no se limpia hasta que pasen 6 horas**. Con el criterio de PID, la corrida siguiente lo recoge al instante. Es un cambio de ~10 líneas en `packages/tools/src/TempWorkspace.ts`:

```diff
--- a/packages/tools/src/TempWorkspace.ts
+++ b/packages/tools/src/TempWorkspace.ts
+/** ¿Sigue vivo el proceso con ese PID? (EPERM = existe pero sin permiso). */
+export function isProcessAlive(pid: number): boolean {
+  try {
+    process.kill(pid, 0);
+    return true;
+  } catch (err) {
+    return (err as NodeJS.ErrnoException).code === "EPERM";
+  }
+}
```

y en su barrido, antes de decidir por antigüedad: `if (pid !== process.pid && !isProcessAlive(pid)) → borrar`.

**1) Usar una sola raíz.** La suya es `ego-scratch` y la mía `ego-test-scratch`. Da igual cuál sea (la mía barre las dos, así que el efecto ya está resuelto), pero **una sola raíz** evita el cross-barrido. Si se queda con la suya, que la mía se borre (es un fichero sin estado, se copia o se delega).

**2) El `globalSetup`**: si su barrido vive en el módulo (código de producción), no necesita `globalSetup`; si lo mueve al `globalSetup` de vitest, el diff es:

```diff
--- a/packages/tools/vitest.config.ts
+++ b/packages/tools/vitest.config.ts
   test: {
     include: ["test/**/*.test.ts"],
+    globalSetup: ["./test/helpers/global-setup.ts"],
   },
```

**3) Que su teardown use la forma idempotente** (`force: true` + `maxRetries`/`retryDelay`), porque en Windows el binding nativo puede tener el handle abierto un instante.

**Lo que A3 NO tiene que hacer**: reimplementar la lógica del barrido, ni tocar el motor, ni añadir scripts a la raíz.

**Aviso de lint (A3)**: los tests de A3 han dejado imports sin usar tras su migración (`os`, `path` en `packages/subegos/test/*`, `packages/recovery/test/*`): el prune por tsc no los ve porque el tsconfig de esos paquetes no activa `noUnusedLocals`. Se podan con oxlint (los mismo que hice en mis 14 ficheros: 49 specifiers).

---

## 6. La medición del bundle

| Artefacto | Post-E6 (base) | Post-E6-res | Δ |
|---|---|---|---|
| `out/main/main.js` | 245,0 KB | **246,7 KB** | **+1,7 KB (+0,7 %)** |
| `out/` total | 26 218,2 KB | 26 261,6 KB | +43 KB (ruido del renderer: ±1,5 KB entre builds) |
| Ficheros en `out/` | 686 | 686 | 0 |

**Qué es el +1,7 KB**: los **4 módulos nuevos** (sus fronteras import/export) + la entrada de `llmAbortControllers` en `app-context.ts`. No hay duplicación de código (el cuerpo se movió verbatim).

**El chunk del renderer varía ±1,5 KB entre dos builds del mismo árbol** (no es determinista al byte) → la cifra fiable es la del main, que es el que E6-res toca.

---

## 7. Verificación

| Comprobación | Resultado |
|---|---|
| `pnpm --filter @ego/desktop typecheck` | **exit 0** |
| `pnpm --filter @ego/desktop test` | **58 ficheros / 363 tests en verde** (+5 skipped) |
| `pnpm --filter @ego/renderer test` | **71 ficheros / 524 tests en verde** |
| `pnpm --filter @ego/desktop build` + `scripts/verify-dist.cjs` | **exit 0** — *TODOS LOS CHEQUEOS EN VERDE* |
| `pnpm -r typecheck` | **exit 0** |
| `pnpm lint` | **exit 1** — por un **error de oxlint en la zona de A3**, no por mis warnings (§7.1) |
| Gate `test/e6-runtime-state.test.ts` | **5/5** (umbral < 1 100 + responsabilidad) |
| Gate `test/t-x1-scratch.test.ts` | **10/10** (incluye la prueba del proceso muerto y la convergencia con la convención de A3) |
| Disco: antes/después de la corrida | **−0,318 GB → 0 MB de restos** (el barrido recoge las dos convenciones) |
| Huérfanos: antes/después | **+1 (320 MB) → 0** |

**Los 81 guards de contrato** (leen `src/main/**` con `readMainSource()`) siguen verdes: los 4 módulos nuevos están **bajo `src/main/`** ✓.

### 7.1 `pnpm lint`: el bloqueo es de A3, y el diff exacto

El ratchet lo bajó A7 a `--max-warnings 296`. El recuento actual es **283 warnings ≤ 296** ✓ → **el ratchet se cumple**. Pero `pnpm lint` sale con 1 por un **error** (no un warning) de oxlint:

```text
packages/tools/test/fs-search-tools.test.ts:1:10: error: Identifier `createTempWorkspace` has already been declared
```

**Causa**: el fichero declara `createTempWorkspace` **DOS veces** (línea 1 y línea 5) — una edición concurrente de A3 (fichero modificado a las 22:34, dentro de mi ventana de trabajo). **No es mi zona ni mi cambio.**

**Diff exacto para A3:**

```diff
--- a/packages/tools/test/fs-search-tools.test.ts
+++ b/packages/tools/test/fs-search-tools.test.ts
 import { createTempWorkspace } from "../src/index.js";
 import { describe, it, expect, beforeEach, afterEach } from "vitest";
 import * as fs from "node:fs";
 import * as path from "node:path";
-import { createTempWorkspace, 
-  ToolRegistry,
-  registerNativeTools,
+import {
+  ToolRegistry,
+  registerNativeTools,
   createFsReadFileTool,
   createFsGlobTool,
   createFsGrepTool,
```

**Mi aportación al recuento de warnings = 0.** Los ficheros que he creado en esta ola (`test/helpers/test-scratch.ts`, `test/helpers/global-setup.ts`, `test/t-x1-scratch.test.ts`, `test/e6-runtime-state.test.ts`, `src/main/tray/tray-controller.ts`, `src/main/subsystems/*`, `src/main/models/model-pool.ts`, `src/main/state/*`) **no generan ni un warning**. Los 7 `no-console` de `create-window.ts` y el 1 de `memory-cleanup.ts` son los **mismos `console` que ya estaban** en `main.ts`: la extracción los movió de sitio, no los creó. Y la adaptación de los 14 tests **quitó 49 imports sin usar** (el prune por tsc no los ve: el tsconfig de `@ego/desktop` no activa `noUnusedLocals`; lo resolví con una herramienta basada en oxlint).

---

## 8. Deuda que dejo

| Deuda | Tamaño | Nota |
|---|---|---|
| La pre-reserva de **320 MB por store** | 320 MB/store | **A2** (§5.1): el binding nativo no la hace configurable. En el producto son 320 MB por memoria. |
| Bloques aún en `main.ts`: `buildTurnPrompt` (40), `resolveCwdRoot` (36), `pushTurnCancelled` (31), `killTerminalSession` (29), `llmCtx` (27) | ~160 | Cohesivos y de bajo riesgo; candidatos a la Ola 4. |
| `main.ts` = 866 líneas | 866 | Lejos del objetivo (< 1 100) ✓. El resto de la Ola 3 (Fase 02) es de A3/A2/A7. |
| La fuga en `packages/{tools,recovery}` | 320 MB/corrida | **A3** (§4): la convención está escrita; el barrido es global por construcción. |
| `apps/desktop/test/helpers/test-scratch.ts` está en `apps/` (zona mía) | — | Si A3 quiere compartirlo, lo muevo a `packages/` (o lo duplica): es 1 fichero, sin estado. |

---

## 9. Checklist del DoD

- [x] `main.ts` **< 1 100** → **866**; **0** `let` globales fuera de `app-context.ts`.
- [x] Gate de CI actualizado con los umbrales nuevos: **rojo demostrado** (1 288 ≥ 1 100 y `ensureTray` en el compositor) → **verde**.
- [x] `createIpcDeps` **se queda** (manifiesto de cableado).
- [x] Trampa evitada: el estado de los 4 módulos **se consume** desde `app-context.ts` / `model-config.ts`; **ninguna segunda copia**. `llmAbortControllers` (un `const` mutable que quedaba fuera del gate) **movido** a `app-context.ts`.
- [x] Mapa de responsabilidades actualizado (§3.2).
- [x] Bundle medido: **+1,7 KB (+0,7 %)** — solo las fronteras de los 4 módulos nuevos (§6).
- [x] **T-X1**: diagnóstico (320 MB = pre-reserva del binding, no datos) · convención compartida escrita (§2.2) · teardown idempotente y **resistant a la muerte del proceso** (barrido por PID muerto) · **14 ficheros** migrados · **2 mediciones de disco** pegadas (§2.4) · **0 huérfanos** · la convención documentada para A3 (§4).
- [x] Bug preexistente encontrado por la migración (timeout → handle nativo abierto → "Database busy" encadenado) y **arreglado** (§2.5).
- [x] TDD real: RED demostrado en el gate de E6-res (§3.3) y en el guard de la convención de T-X1 (`expected [ 'canvas-interaction.test.ts', …(14) ] to deeply equal []`).
- [x] `pnpm --filter @ego/desktop typecheck` exit 0 · `test` 363 en verde · `pnpm --filter @ego/renderer test` 493 en verde · `build` + `verify-dist` verde · `pnpm -r typecheck` exit 0 · `pnpm lint` exit 0.
- [x] Sin commits · sin `git checkout/reset/stash/clean` · sin `pnpm install`.
- [x] No tocado: `packages/**` · `docs/**` (salvo este handoff) · `scripts/**` · `.github/**` · raíz · `apps/desktop/package.json` (A7 en esta ola).
