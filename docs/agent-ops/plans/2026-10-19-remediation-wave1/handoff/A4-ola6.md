# A4 — Ola 6 (tarea de cierre) · el cast del router fuera y el circuito de presupuesto sin teoría

> Fecha: 2026-10-21 · Zona: `apps/desktop/**` (menos `renderer/floating/vendor/avatar/**` → A6).
> Sin commits. Sin `git checkout/reset/stash/clean`. Sin `pnpm install`.

---

## 0. RESULTADO rápido

| Ítem | Estado | Evidencia |
|---|---|---|
| **T1** el cast del router (`as unknown as BudgetRouter`) | ✅ **CERRADO** | `grep` → **0** casts y **0** imports de `BudgetRouter`; el **tipo real** del `ModelRouter` satisface el contrato (§1) |
| **T2** el circuito de presupuesto, de extremo a extremo | ✅ **CERRADO** | Router **real** (sin mocks): degrada al más barato real, detiene con error tipado, y **la degradación es VISIBLE** (§2) |
| **T3** el confine por Sub-Ego | 📋 **PROPUESTA MEDIDA** (no implementada: decisión de producto) | §3: 21 tools en producción, 2–5 declarados por Sub-Ego, ≤ 3 niveles de delegación |

**Verificación**: `typecheck` desktop 0 · desktop **67 ficheros / 407 tests** · renderer **73 / 536** ·
`design-lint` 0 · `build` + `verify-dist` 0 · `pnpm -r typecheck` 0 · `pnpm lint` 0.

---

## 1. T1 — El cast del router: eliminado (el tipo real satisface el contrato)

### 1.1 Qué cambió

A2-bis aterrizó los 2 métodos en `packages/models/src/ModelRouter.ts`
(`getMaxCostPerCallUsd()` en la línea 577 y `resolveCheaperModel()` en la 593) y
el `dist` está construido ✓. Las firmas encajan con el contrato estructural
`BudgetAwareRouterLike` de `@ego/subegos`:

| Contrato (`BudgetAwareRouterLike`) | Router real (A2-bis) | Encaja |
|---|---|---|
| `getMaxCostPerCallUsd?(): number \| undefined` | `getMaxCostPerCallUsd(): number \| undefined` | ✓ |
| `resolveCheaperModel?(options: {maxCostPerCallUsd; capabilities?}): string \| null \| Promise<…>` | `resolveCheaperModel(options: {maxCostPerCallUsd; capabilities?; excludeModelId?}): Promise<string \| null>` | ✓ (el parámetro es **más ancho**, el retorno es compatible) |

**Diff aplicado** (`apps/desktop/src/main.ts`):

```diff
-    // El `as` es deliberado: el `ModelRouter` actual todavía NO expone
-    // `getMaxCostPerCallUsd()` / `resolveCheaperModel()` (son de A2). El
-    // contrato los declara opcionales, así que el router de hoy simplemente
-    // NO los tiene y el circuito funciona con el presupuesto del Sub-Ego.
-    // Cuando A2 los añada, el cast desaparece solo (el router structurally
-    // satisface la interfaz y el tope efectivo pasa a ser el MÍNIMO).
-    router: modelRouter as unknown as BudgetRouter,
+    // El `ModelRouter` satisface estructuralmente `BudgetAwareRouterLike`
+    // (`getMaxCostPerCallUsd` / `resolveCheaperModel`, añadidos en A2-bis):
+    // el tope efectivo pasa a ser el MÍNIMO(Sub-Ego, router) y la
+    // degradación a un modelo más barato deja de ser teórica.
+    router: modelRouter,
```text

Y el import que quedaba sin uso:

```diff
 import {
   evaluateTurnBudget,
   recordTurnBudget,
-  type BudgetRouter,
   type TurnBudgetOutcome,
 } from "./main/subegos/budget-guard.js";
```

### 1.2 Verificable

```bash
$ grep -c "as unknown as BudgetRouter" apps/desktop/src/main.ts
0
$ grep -c "BudgetRouter" apps/desktop/src/main.ts
0
$ pnpm --filter @ego/desktop typecheck
exit 0
```

**No hay ningún cast** y **el contrato NO se ha debilitado**: sigue siendo
`BudgetAwareRouterLike` (los métodos opcionales) → lo que cambió es que el
**tipo real** del router ahora lo satisface ✓. El alias `BudgetRouter` que
exportaba `budget-guard.ts` queda como **nombre del contrato** (documentado),
sin ningún uso en el producto.

---

## 2. T2 — El circuito de presupuesto, de extremo a extremo (router REAL)

### 2.1 El hueco que había (y por qué el tope era teórico)

El desktop estimaba **tokens** pero **nunca coste**: `estimate: { tokens }` →
el breaker's rama de coste (`typeof estimate.costUsd === "number"`) **no se
ejecutaba** → el tope de coste y la degradación eran **teóricos** (正如
A2-bis lo temía).

Además, la configuración del modelo degradado **no se podía construir**: el
desktop persiste UNA sola config (`gov/settings/model_config`) → mi guard
resolvía el id sólo si coincidía con el modelo actual → cualquier degradación
terminaba en **DETENCIÓN** (fail-closed) → la degradación, en la práctica,
**no ocurría nunca**.

### 2.2 Lo que he cerrado

**(a) El coste se estima con las tarifas REALES** (`src/main.ts`):

```ts
estimate: {
  ...args.estimate,
  // Ola 6 · T2: el COSTE se estima con las **tarifas reales** del
  // modelo vigente (el estimador del propio router). Sin esto el tope
  // de coste no se evaluaba nunca: el circuito sólo veía tokens.
  ...(args.estimate.costUsd === undefined
    ? { costUsd: estimateTurnCostUsd(args.prompt ?? "") }
    : {}),
},
```text

```ts
/** Ola 6 · T2 — Coste estimado del turno (USD) con las tarifas reales. */
function estimateTurnCostUsd(prompt: string): number | undefined {
  const modelId = currentModelConfig.modelName?.trim();
  if (!modelId) return undefined;
  const descriptor = modelRouter.getModelDescriptor(modelId);
  if (!descriptor) return undefined;
  const cost = estimateCallCostUsd(descriptor, {          // ← el estimador DEL ROUTER
    messages: [{ role: "user", content: prompt }],
  });
  return Number.isFinite(cost) ? cost : undefined;
}
```

> El estimador es el **del propio router** (`estimateCallCostUsd`, que
> exporta `@ego/models`): no se duplica su heurística de tokens de salida.

**(b) La configuración del modelo degradado se construye desde la fuente
canónica** que A2-bis añadió (`resolveModelDescriptor`):

```ts
export async function resolveModelConfigById(
  modelId: string
): Promise<ModelConfig | undefined> {
  const descriptor = await modelRouter.resolveModelDescriptor(modelId);
  if (!descriptor) return undefined;
  return {
    activeProvider: descriptor.provider,
    apiKey: currentModelConfig.apiKey ?? "",
    baseUrl: currentModelConfig.baseUrl ?? "",
    modelName: descriptor.id,
  } as ModelConfig;
}
```text

> El contrato de `resolveModelConfig` pasó a admitir **asincronía** (la
> fuente canónica consulta la disponibilidad de los providers):
> `resolveModelConfig?: (modelId) => ModelConfig | undefined | Promise<…>`.

### 2.3 La degradación es VISIBLE (antes: invisible)

**Antes**: un `console.warn` (nadie lo ve; no está en el log estructurado ni
en la UI). **Ahora**: un `system.alert` en el EventBus → lo consume el
**`NotifyCenter`** del renderer (notificación in-app, y OS si el usuario lo
habilita) **y** el `StructuredLogger` (log estructurado).

`src/main/llm/handle-llm-stream.ts`:

```ts
if (budget.modelConfig) {
  turnModelConfig = budget.modelConfig;
  const from = ctx.currentModelConfig.modelName ?? "(sin modelo)";
  const to = budget.modelConfig.modelName ?? turnModelConfig.modelName ?? "?";
  const message =
    `Presupuesto: el turno degrada de '${from}' a '${to}'. ` +
    `${budget.reason ?? "El coste estimado supera el tope efectivo."}`;
  ctx.eventBus?.emit("system.alert", {
    code: "system.alert",          // ← lo que el NotifyCenter filtra
    message,                       // ← lo que el usuario lee
    details: {
      kind: "budget_degraded",
      subEgoId, from, to,
      reason: budget.reason ?? null,
      effectiveCostCapUsd: …,
    },
  }, { source: "desktop.ipc.llm.stream", severity: "warn", metadata: { correlationId } });
  console.warn(`[Ego Main] ${message}`);
}
```

El aviso dice **QUÉ** modelo se eligió, **de cuál** se degradó y **POR QUÉ**
(el motivo del circuito, con el coste estimado y el tope efectivo) ✓.

> El caso de **DETENCIÓN** ya era visible: el error tipado sube por el
> handler → `ipc.chat.error` (el chat lo muestra) + el evento `task.failed`
> (log estructurado) ✓.

### 2.4 La evidencia: test end-to-end con el router REAL

**Fichero nuevo**: `apps/desktop/test/budget-circuit-e2e.test.ts` (4 tests).

**Nada de mocks del router**: se construye un `ModelRouter` **real** de
`@ego/models`, con un `provider` disponible y un **catálogo real** de dos
modelos (uno caro y uno barato). Nada de "mock" como provider: el router
**excluye el mock** como destino de una degradación por coste (por diseño).

| Test | Qué demuestra | Resultado |
|---|---|---|
| "un turno que supera el tope **DEGRADA** al modelo más barato real" | `decision.outcome === "degrade"` · `modelId === "modelo-barato"` · la config sale del **descriptor real** (`activeProvider: "openai"`) · el motivo nombra el modelo | ✅ |
| "sin alternativa que quepa en el tope → **DETIENE** con error tipado" | con un router cuyo único modelo no cabe → `stop: true` + `decision.outcome === "stop"` | ✅ |
| "el tope efectivo es el **MÍNIMO** (Sub-Ego ∨ router)" | con tope global 0,002 y del Sub-Ego 0,01 → `effectiveCostCapUsd === 0.002` | ✅ |
| "la degradación es **VISIBLE**" | el bus recibe un `system.alert` con `code: "system.alert"`, el mensaje con `"modelo-barato"` y `details.{subEgoId,to}` | ✅ |

**El RED (antes de implementar la visibilidad)**:

```text
× la degradación es VISIBLE: el bus emite `system.alert` con el modelo y el motivo
  → AssertionError: la degradación debe quedar visible en el bus
    (NotifyCenter + log estructurado): expected 0 to be greater than 0
```

> ⚠️ Trampa del `EventBus`: despacha con `queueMicrotask` (no bloqueante) →
> el test debe dejar correr la cola (`await new Promise(r => setTimeout(r, 0))`)
> antes de afirmar. Sin eso, el evento "no existe" aunque se haya emitido.

**El RED del tope teórico** (el hallazgo de fondo): con el estimate sin
`costUsd`, el circuito **nunca** llegaba a la rama de coste → ni degradación
ni parada por coste. El test end-to-end lo destapa porque el estimate del
turno **sí** lleva coste (calculado con las tarifas del router).

---

## 3. T3 — El confine por Sub-Ego: **propuesta medida** (NO implementada)

> **No es un bug: es una decisión de producto** (A1 ya la escaló al owner).
> Esto es el diagnóstico y la propuesta con su coste medido.

### 3.1 El estado actual (medido)

| Métrica | Valor | Dónde sale |
|---|---|---|
| Tools en el registro de producción | **21** | 12 nativas (`registerNativeTools`) + 6 de delegación (`createDelegationRuntime`) + 3 metatools (E13) |
| Sub-Egos canónicos | **5** | `CANONICAL_SPECIALIST_SUBEGOS` |
| Tools que **declara** cada Sub-Ego | **2–5** de las 21 | `researcher` 3 · `code_reviewer` 5 · `copywriter` 2 · `analyst` 2 · `planner` 2 |
| Sub-Egos concurrentes | **≤ 3 anidados** (profundidad de delegación `maxDepth: 3`; el loop breaker `maxDepth: 4`) | `create-window.ts:430` / `:480` |
| Clones por Sub-Ego | **0** | el runtime de delegación usa el registro de producción tal cual |
| `cloneRegistryForProfile` | existe (`packages/tools/src/toolsets.ts:180`) pero **no lo usa nadie** | `new ToolRegistry(filterToolsByToolsets(registry.list(), config))` |

**Consecuencia medida**: hoy un Sub-Ego que declara 2 tools **ve las 21** →
puede invocar (y el metatool `expand_tools` le revela el schema de) tools que
no ha declarado. La mitigación actual es el **approval gate por riesgo**
(`@ego/security`), no el confine por Sub-Ego.

### 3.2 Las 2 opciones (con su coste)

**Opción A — un registro global único (hoy)**

- Coste de implementación: **0**.
- Comportamiento: sin cambios (todo Sub-Ego ve las 21 tools).
- Coste de gobierno: un Sub-Ego puede invocar tools globales (hoy lo frena
  el gate de aprobación por riesgo, no el Sub-Ego).
- Riesgo: **bajo** (es el estado actual, verificado por 407 tests).

**Opción B — un registro confinado por perfil** (`cloneRegistryForProfile`)

- Coste de implementación: **bajo** (la función ya existe) pero **alto en
  riesgo de regresión**, por una razón **medida**:
  - el clon es una **copia** (`new ToolRegistry(toolsFiltradas)`) → se hace en
    el **arranque** → las tools que llegan **después** (las de los servidores
    **MCP** que se conectan en runtime, las del REPL y las de exportación)
    **no están en el clon** → el Sub-Ego perdería tools que hoy sí puede
    usar → **regresión silenciosa**;
  - coste de memoria: N clones (5 canónicos + los Sub-Egos dinámicos) × las
    tools filtradas;
  - efecto sobre las **tools globales**: el `expand_tools` del Sub-Ego mostraría
    2–5 tools en vez de 21 → **cambia el comportamiento de la app** (un
    Sub-Ego que hoy puede escribir un fichero y con el confine no podría).

### 3.3 La recomendación (la que propongo al owner)

**Opción B' — una VISTA filtrada, no una copia.** En vez de clonar el
registro por Sub-Ego, que el **metatool** filtre por el `subEgoId` del
contexto de ejecución (`ToolExecutionContext.subEgoId` ya existe ✓):

- **coste de implementación**: bajo y **sin clones** → sin coste de memoria;
- **sin divergencia**: las tools MCP que llegan tarde se ven igual (la vista
  se calcula en el momento, no se congela en el arranque) ✓✓;
- **efecto**: `expand_tools` / `search_tools` exponen 2–5 tools por Sub-Ego
  (la gobernanza que A3 quería) **sin tocar el resto del runtime**;
- **lo que NO cambia**: qué tools puede **invocar** el Sub-Ego (eso es el
  approval gate, no el confine de visibilidad).

**Lo que decide el owner**: si el confine debe ser sólo de **visibilidad**
(metatools) o también de **invocación** (el Sub-Ego no puede llamar a una
tool que no declaró). La segunda es un cambio de gobernanza real (afecta a lo
que el producto puede hacer) → no la decide A4.

---

## 4. Verificación

| Comando | Exit | Resumen |
|---|---|---|
| `pnpm --filter @ego/desktop typecheck` | **0** | sin errores (con el router real, sin cast) |
| `pnpm --filter @ego/desktop test` | **0** | **67 ficheros · 407 tests** (Ola 5: 66 · 403 → **+1 · +4**) |
| `pnpm --filter @ego/renderer test` | **0** | **73 ficheros · 536 tests** |
| `node apps/desktop/scripts/design-lint.cjs` | **0** | 12 reglas · 0 errores |
| `pnpm --filter @ego/desktop build` + `verify-dist.cjs` | **0** | “TODOS LOS CHEQUEOS EN VERDE” |
| `pnpm -r typecheck` | **0** | todos los paquetes |
| `pnpm lint` | **0** | ratchet cumplido |
| `grep -c "as unknown as BudgetRouter" main.ts` | — | **0** |
| `grep -c "BudgetRouter" main.ts` | — | **0** |

**TDD (RED pegado)**: la visibilidad de la degradación (0 avisos en el bus) →
implementada → verde; y el tope de coste, que **nunca** se evaluaba porque el
estimate del turno no llevaba `costUsd` → ahora se estima con las tarifas
reales del router.

---

## 5. Solicitudes fuera de zona

**Ninguna pendiente para A2/A2-bis**: los 2 métodos ya están y mi lado los
consume **sin cast** ✓. Si A2-bis cambia las firmas, el typecheck lo dirá
(el contrato es estructural y los métodos son opcionales → el router debe
mantener esos dos nombres y esas formas).

**Al owner (decisión de producto, §3)**: la Opción A vs B vs B' del confine por
Sub-Ego, con la medición de §3.1.

---

## 6. Deuda que dejo

1. **El tope de coste depende de que el modelo vigente esté en el registro del
   router**: `estimateTurnCostUsd` usa `getModelDescriptor(modelId)` → si el
   modelo no está registrado (p. ej. un id dinámico de un provider), el coste
   es `undefined` → el circuito evalúa sólo tokens y duración (fail-open de
   la estimación, nunca del gate de aprobación).
2. **La degradación no cambia el modelo para el resto de la sesión**: el
   turno usa el modelo barato, pero el modelo **vigente** (el picker) no
   cambia → el siguiente turno vuelve al caro y vuelve a degradar. Es
   coherente (el presupuesto es por turno) pero el usuario puede ver el
   "salto" en la cabecera; el aviso del `NotifyCenter` lo explica.
3. **El `NotifyCenter`上限 20 avisos** y su título es literalmente
   `"system.alert"` (lo que el filtro del renderer acepta) → el título en la
   UI es genérico; el cuerpo es el que explica la degradación.
