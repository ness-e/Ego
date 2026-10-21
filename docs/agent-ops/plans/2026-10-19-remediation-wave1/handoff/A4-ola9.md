# A4 — Ola 9 · `MemoryCurator` cableado en producción (cierra `EGO-FIND-22`)

> Fecha: 2026-10-21 · Zona: `apps/desktop/**` (+ `apps/desktop/test/**`).
> Sin commits. Sin `git checkout/reset/stash/clean`. Sin `pnpm install`.
> No he tocado `packages/**`, `docs/**`, la raíz, `scripts/**` ni
> `apps/desktop/renderer/floating/vendor/**` (A6).

---

## 0. RESULTADO rápido

| Ítem | Estado | Evidencia |
|---|---|---|
| **T1** el diff de A2-bis aplicado | ✅ **CERRADO (con 1 adaptación)** | `apps/desktop/src/main/subsystems/memory-curation.ts` (nuevo) + el cableado en `create-window.ts` (§2) |
| **T2** TDD real (rojo → verde) | ✅ **CERRADO** | RED: *"Failed to load url ../src/main/subsystems/memory-curation.js"* → VERDE: 3 tests (§3) |
| **T3** el diff encaja con el código real | ✅ **VERIFICADO** | la API coincide 1:1; los 2 arreglos de A2-bis siguen ahí (§4) |
| **T4** ciclo de vida completo | ✅ **CERRADO** | una sola instanciación · parada en el apagado · **sin duplicar** la consolidación (§5) |

**Verificación**: `typecheck` desktop **0** · desktop **69 ficheros / 417 tests** · `build` **0** ·
`design-lint` **0** · `verify-vantadb-ids` **0** · presupuesto de lint **314 ≤ 317** ✓.
`pnpm -r typecheck` y `pnpm lint` fallan **sólo por `packages/avatar`** (A6, en paralelo) → §7.

---

## 1. Qué cambia (resumen)

`MemoryCurator` estaba implementado y verificado en `packages/tasks` pero
**sin instanciar en producción** → su capacidad (**marcar stale**) no ocurría
nunca. Ahora:

| Pieza | Fichero |
|---|---|
| El módulo (la costura) | `apps/desktop/src/main/subsystems/memory-curation.ts` (NUEVO) |
| El arranque | `apps/desktop/src/main/window/create-window.ts` → `startMemoryCuration(adapter, { intervalHours: 24, staleAfterDays: 90 })` |
| El apagado | `apps/desktop/src/main.ts` → `stopMemoryCuration()` en `app.on("before-quit")` |
| El estado vivo | `apps/desktop/src/main/state/app-context.ts` → `memoryCurator` + `setMemoryCurator()` |
| La prueba | `apps/desktop/test/memory-curation.test.ts` (NUEVO, 3 tests) |

---

## 2. T1 — El diff aplicado (y la **única** adaptación que hice)

El diff de A2-bis (`handoff/A2bis-ola8.md` §5.4) **encaja tal cual** con el
código real (§4) → lo apliqué sin cambios en la API.

**Lo que sí cambié (y por qué)**: el diff declaraba el estado del curator como
un `let` **a nivel de módulo**:

```diff
-let curator: MemoryCurator | null = null;
+// E6: el estado mutable del proceso vive en `app-context.ts` (único sitio),
+// no en el módulo que lo usa.
+import { memoryCurator, setMemoryCurator } from "../state/app-context.js";
```text

**Por qué (no fue capricho)**: el gate `apps/desktop/test/e6-runtime-state.test.ts`
— *"no queda ningún `let` global mutable fuera de app-context.ts"* — lo cazó
en mi primera versión:

```text
FAIL  test/e6-runtime-state.test.ts > E6 — el main process tiene UN sitio con su estado mutable
AssertionError: estado mutable fuera de main/state/app-context.ts:
  main/subsystems/memory-curation.ts:22 curator: expected [ Array(1) ] to deeply equal []
```text

Es exactamente el precedente de `memory-cleanup.ts` (que guarda sus timers en
`app-context.ts`, no en su módulo) ✓. La adaptación **conserva la API pública
del diff** (`startMemoryCuration` / `stopMemoryCuration` idénticas) ✓.

**Además, dos cosas que el diff no traía y el brief pedía (T4)**:
1. La llamada de arranque va **envuelta en `try/catch`** (como el
   `startCuratorJob` de STAB-06 que tiene al lado): si la curaduría no
   arranca, la app **no** se cae ("el boot nunca tumba por esto").
2. El **apagado** (`stopMemoryCuration()` en `main.ts`), que el diff no
   mencionaba: sin él, el `setInterval` del curator sobrevive al cierre.

```diff
// apps/desktop/src/main/window/create-window.ts
+import { startMemoryCuration } from "../subsystems/memory-curation.js";
   try {
     lifecycle.startCuratorJob({ intervalMs: 60 * 60 * 1000, staleAfterDays: 30, maxSnapshots: 50 });
   } catch (err) { … }
+  // CFG-08: curaduría programada (marca stale). Sin `DreamConsolidator`: el
+  // "sueño" lo dispara el lifecycle (ver `@ego/memory`), así que pasárselo
+  // aquí consolidaría dos veces por el mismo ciclo.
+  try {
+    startMemoryCuration(adapter, { intervalHours: 24, staleAfterDays: 90 });
+  } catch (err) {
+    console.warn("[Ego Main] Curaduría CFG-08 no arrancó (la memoria no se curaría):", err);
+  }
```

```diff
// apps/desktop/src/main.ts (en `app.on("before-quit")`, ANTES de cerrar el adapter)
+      // Ola 9 (A4): la curaduría programada (CFG-08) se detiene ANTES de
+      // cerrar el adapter (usa el store): si siguiera viva, una corrida
+      // podría escribir contra un store cerrado.
+      try {
+        stopMemoryCuration();
+      } catch {
+        // noop: el apagado nunca falla por la curaduría
+      }
       if (adapter) {
         await adapter.close();
       }
```text

---

## 3. T2 — TDD real: la evidencia de que la curaduría ocurre

**Fichero**: `apps/desktop/test/memory-curation.test.ts` (3 tests). Store real
(`EgoMemoryAdapter` sobre el scratch compartido de T-X1) → **sin mocks**.

### 3.1 El RED (antes del cableado)

```text
× test/memory-curation.test.ts > Ola 9 — la curaduría de memoria ocurre en el producto
Caused by: Error: Failed to load url ../src/main/subsystems/memory-curation.js
  (resolved id: ../src/main/subsystems/memory-curation.js) in
  C:/Users/Eros/VantaDB Proyect/Ego/apps/desktop/test/memory-curation.test.ts. Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```text

### 3.2 El VERDE (qué demuestra cada test)

| Test | Qué demuestra |
|---|---|
| **"marca stale el fact viejo (superseded + superseded_by) y deja la auditoría curator_run"** | la **capacidad ocurre**: el fact stale de `kb/facts` queda `state: "superseded"` + `superseded_by: "curator:stale"` y su payload con `is_latest: false` (soft-replace: **no se borra**); el fact **fresco** no se toca; y queda la **auditoría** `curator_run` en `gov/audit` con el recuento (`details.staleConsolidatedCount === 1`, `details.staleNamespacesScanned` contiene `kb/facts`) |
| **"el temporizador NO retiene el proceso (unref) y se puede parar"** | `curator.running === true` al arrancar y `false` tras `stopMemoryCuration()` → el `setInterval` con `unref()` no impide el cierre de Electron |
| **"LA CURADURÍA ESTÁ CABLEADA: el arranque la inicia y el apagado la para"** | el arranque llama a `startMemoryCuration(adapter…)` y el apagado a `stopMemoryCuration()` → **si alguien borra el cableado, este test falla** |

```text
$ npx vitest run test/memory-curation.test.ts
 Test Files  1 passed (1)
      Tests  3 passed (3)
```text

### 3.3 La prueba de que el test **caza** el deshacer del cableado

Deshice el cableado (comenté la llamada) y repetí:

```text
$ npx vitest run test/memory-curation.test.ts
 FAIL  test/memory-curation.test.ts > … > LA CURADURÍA ESTÁ CABLEADA: el arranque la inicia y el apagado la para
AssertionError: el arranque debe llamar a startMemoryCuration (si se borra la llamada, este test falla):
  expected ' … ' to match /startMemoryCuration\(\s*adapter/
 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)
```text

> ⚠️ **El primer intento NO lo cazaba** (el test pasaba con la llamada
> comentada, porque la regex encontraba la línea comentada). Lo arreglé
> **eliminando los comentarios antes de escanear** la fuente (la misma
> técnica que usa el linter del design system). Con el arreglo, el truco de
> "comentar la llamada" **falla** ✓.

**Por qué el punto del cableado es estructural (y lo digo explícitamente)**:
el arranque vive en `create-window.ts`, que importa `electron` → **no se puede
arrancar en el entorno de test** (node, sin mock de Electron en el repo). Es
la **única** comprobación posible de que la llamada está en su sitio; el
**comportamiento** (los otros dos tests) sí está probado de verdad, contra el
adapter real y el módulo de producción.

---

## 4. T3 — El diff encaja con el código real (verificado, sin adaptar la API)

| Lo que el diff usa | Lo que hay en `packages/tasks/src/MemoryCurator.ts` | ¿Encaja? |
|---|---|---|
| `new MemoryCurator(adapter, { intervalHours, staleAfterDays })` | `constructor(adapter: EgoMemoryAdapter, options: MemoryCuratorOptions = {}, consolidator?: DreamConsolidator)` (línea 115) | ✓ (el 3.er arg es opcional → el diff **no** le pasa un consolidator ✓) |
| `curator.start((stats: CuratorRunStats) => …)` | `public start(onRun?: (stats: CuratorRunStats) => void): void` (línea 236) | ✓ |
| `curator.stop()` | `public stop(): void` (línea 259) | ✓ |
| `stats.staleConsolidatedCount` | `CuratorRunStats.staleConsolidatedCount` (línea 18) | ✓ |
| `stats.staleNamespacesScanned` | `CuratorRunStats.staleNamespacesScanned` (línea 19) | ✓ |
| `import { MemoryCurator, type CuratorRunStats } from "@ego/tasks"` | `packages/tasks/src/index.ts:14` → `export * from './MemoryCurator.js';` | ✓ |

**`MemoryCurator` sigue en `packages/tasks/`** ✓ (A2-bis sólo movió el
`DreamConsolidator` a `packages/memory/`) → el diff apuntaba al sitio
correcto.

### 4.1 Los 2 arreglos de A2-bis: **siguen corregidos** (verificado)

| Arreglo | Estado |
|---|---|
| El `setInterval` **sin `unref()`** (habría impedido que Electron cerrase) | ✅ `MemoryCurator.ts:253-255` → `if (typeof t.unref === "function") { t.unref(); }` — y mi test lo vigila (`running` + parada) |
| El `catch(() => {})` **mudo** | ✅ `MemoryCurator.ts:211-215` → el fallo de la auditoría se **loguea** (`[MemoryCurator] auditoría de corrida falló (resultado intacto)`) |

---

## 5. T4 — El ciclo de vida completo

| Requisito | Cómo está resuelto | Verificado |
|---|---|---|
| **Una sola vez** en el arranque | `startMemoryCuration` es **idempotente**: para el curator anterior antes de sustituirlo (`memoryCurator?.stop()`) → nunca hay dos temporizadores vivos (que harían la curaduría dos veces por ciclo) | `grep "new MemoryCurator"` → **1** en producción (el resto, los tests del paquete) |
| **`stopMemoryCuration()` en el apagado** | `main.ts` → `app.on("before-quit")`, **antes** de `adapter.close()` (el curator usa el store: una corrida contra un store cerrado fallaría) | el test del cableado lo exige |
| **NO duplicar la consolidación** | el módulo **no** le pasa un `DreamConsolidator` (el 3.er argumento queda sin usar) → la consolidación ("sueño") la sigue disparando el lifecycle | `packages/memory/EgoMemoryLifecycle.ts:164` (`new DreamConsolidator`) y `:649` (el hook) → **intactos** ✓ |

**La diferencia entre las dos capacidades** (y por qué no se fusionan):
`DreamConsolidator` = **consolidar** (fusiona facts duplicados, purga la
cuarentena) → lo dispara el lifecycle en su hook de inactividad de 5 min.
`MemoryCurator` = **marcar stale** (soft-replace de lo que lleva mucho sin
actividad) → es la capacidad que faltaba y la que se cablea aquí.

---

## 6. Verificación

| Comando | Exit | Resumen |
|---|---|---|
| `pnpm --filter @ego/desktop typecheck` | **0** | sin errores |
| `pnpm --filter @ego/desktop test` | **0** | **69 ficheros · 417 tests** (pedido: 414+) |
| `pnpm --filter @ego/desktop build` (+ `verify-dist`) | **0** | “TODOS LOS CHEQUEOS EN VERDE” |
| `node apps/desktop/scripts/design-lint.cjs` | **0** | 12 reglas · 0 errores |
| `node scripts/verify-vantadb-ids.mjs` | **0** | 955 ficheros · 85 referencias · 0 errores |
| `pnpm --filter @ego/renderer typecheck` | **0** | sin errores |
| `pnpm -r typecheck` | ⚠️ **2** | **falla sólo en `packages/avatar`** (A6, en paralelo) → §7 |
| `pnpm lint` | ⚠️ **2** | el **presupuesto de lint pasa (314 ≤ 317)**; el fallo es el typecheck de `packages/avatar` (A6) → §7 |

**Sobre el presupuesto de lint**: mi primera versión de la Ola 9 añadía 2
avisos legítimos (`no-unsafe-optional-chaining` en el test) y el recuento
subió a 322 (presupuesto 317) → **los corregí** y **borré mi script
desechable** `apps/desktop/scripts/t-x1-inventory-ipc.cjs` (6 avisos; su
función la cubre ahora el gate permanente `ipc-modules-gate.test.ts`) → el
recuento queda en **314**, con 3 de margen ✓.

---

## 7. El único bloqueo (exacto, y **no es mío**)

`pnpm -r typecheck` y `pnpm lint` fallan por **3 errores de tipos en
`packages/avatar/`** (la zona de **A6**, que está trabajando en paralelo):

```text
packages/avatar typecheck: src/render/ara-head.js(83,27): error TS2345:
  Argument of type 'number[]' is not assignable to parameter of type …
packages/avatar typecheck: src/render/static.js(50,41): error TS2339:
  Property 'idle' does not exist on type 'Readonly<{ thinking: { gaze…
packages/avatar typecheck: src/runtime/poses.js(106,34): error TS2339:
  Property 'idle' does not exist on type 'Readonly<{ thinking: { gaze…
```text

**Verificado que es de A6 y no mío**: comprobé el typecheck de los 17
paquetes uno a uno → **todos en verde salvo `@ego/avatar`** ✓. No he tocado
`packages/**` ni `apps/desktop/renderer/floating/vendor/**` ✓.

⚠️ Coherente con el aviso del brief: *"si ves un fallo, repite el test aislado
antes de asumir una regresión"*. Lo repetí (2 veces) y el fallo es
persistente → es el trabajo en curso de A6, no una regresión de esta ola.

---

## 8. El texto exacto para A1 (`docs/roadmap/Backlog.md`, fila `EGO-FIND-22`)

**`docs/**` es de A1**: no he tocado el fichero. Aquí va el texto exacto para
sustituir el estado `🟡 Parcial` de la fila (línea 1137) y para añadir la
evidencia.

### 8.1 La celda de estado (columna "Estado")

```text
✅ Completada
```text

### 8.2 El bloque de evidencia (a añadir al final de la celda de notas)

```text
**Estado real 2026-10-21 (Ola 9, A4):** `MemoryCurator` ✅ **instanciado y cableado
en producción** — `apps/desktop/src/main/subsystems/memory-curation.ts` (módulo
propio, no un `new` suelto en `main.ts`, por el precedente de
`subsystems/memory-cleanup.ts`); arranque en
`apps/desktop/src/main/window/create-window.ts` (`startMemoryCuration(adapter,
{ intervalHours: 24, staleAfterDays: 90 })`, envuelto en `try/catch` para que el
boot no tumbe) y parada en el apagado (`main.ts` → `app.on("before-quit")` →
`stopMemoryCuration()`, antes de cerrar el adapter); el estado vivo de la
instancia vive en `state/app-context.ts` (`memoryCurator` + `setMemoryCurator`),
como exige el gate E6 (un único sitio con el estado mutable). **Evidencia de que
la capacidad ocurre** (test de comportamiento, store real, sin mocks:
`apps/desktop/test/memory-curation.test.ts`): un fact stale de `kb/facts` queda
`state: "superseded"` + `superseded_by: "curator:stale"` con el payload en
`is_latest: false` (soft-replace, nunca borra), el fact fresco no se toca, y
queda la auditoría `curator_run` en `gov/audit` (`details.staleConsolidatedCount`,
`details.staleNamespacesScanned`). El temporizador lleva `unref()` (no impide
que Electron cierre) y la consolidación NO se duplica: el `DreamConsolidator`
sigue en `EgoMemoryLifecycle.ts:164` con su hook de inactividad, y el curator
no le pasa ninguno. Con esto, `EGO-FIND-22` queda **cerrado**: los tres
componentes (`DelegationRouter`, `DreamConsolidator`, `MemoryCurator`) están
instanciados y cableados en producción.
```

---

## 9. Deuda que dejo

1. **La primera corrida de la curaduría es a las 24 h** (el `intervalHours`
   por defecto). El `MemoryCurator` no tiene "primera corrida deferida" (a
   diferencia del `MemoryCleanupJob`, que sí la tiene a los 60 s): hasta la
   primera corrida, nada se marca stale. Es coherente con el diff de A2-bis
   (no lo he cambiado), pero conviene tenerlo en el radar.
2. **El `staleAfterDays` del producto es 90 días** (el del diff) mientras el
   job curator de STAB-06 usa 30 días: son **dos curators con politicas
   distintas** (STAB-06 consolida `session/turns`; CFG-08 marca stale en
   `kb/facts`/`kb/docs`). No es una contradicción, pero el número repetido
   en dos sitios invites a confusiones → si A1 quiere un único parámetro, es
   el sitio natural (`gov/settings`).
3. **El aviso de la UI** (el `NotifyCenter`) no se ve afectado: la curaduría
   no emite eventos al renderer (es un job de fondo que escribe en el store) →
   su evidencia es la auditoría en `gov/audit` ✓.
