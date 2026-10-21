# Handoff A2-bis (router) — Ola 6 — 2026-10-21

> Alcance: **sólo `packages/models/**`**. T1 (los 2 métodos del router) + T2 (el
> destino operable "id de modelo → configuración"). Sin commits.
> Precedente: este handoff **cierra** lo que dejó abierto `A2bis.md` (Ola 5) y
> `A1-ola6.md` §4.1.

---

## 0. Resumen

| Tarea | Estado | Qué se entrega |
|---|---|---|
| **T1** | ✅ | `getMaxCostPerCallUsd()` y `resolveCheaperModel()` **con el contrato cerrado** (semántica exacta de "sin tope" y de "sin alternativa") + un **guard de contrato en tiempo de compilación**. |
| **T2** | ✅ | El destino operable **síncrono**: `ModelRouter.resolveModelTarget(id)` → `{modelId, provider, profile, capabilities, estimatedCostUsd, registered, providerRegistered}` + `ModelCatalog.providerProfile()` (qué credencial y qué `baseUrl` necesita cada provider). |
| **Extra** | 🐛→✅ | **Bug encontrado y corregido**: la "trampa del tope 0" (`getMaxCostPerCallUsd()` devolvía `0` en vez de `undefined` ⇒ el circuito paraba **todos** los turnos). |

**Lo que A4 ya tenía en el árbol cuando llegué** (verificado, no supuesto):
los dos casts de `apps/desktop/src/main.ts` (`router: modelRouter as unknown as
BudgetRouter`) **ya estaban quitados** y `budget-guard.ts` **ya consume** la API
de la Ola 5 (`resolveModelDescriptor`, `getModelDescriptor`). Lo que faltaba era
**cerrar el contrato** (para que nadie lo reinterprete) y **operar el
destino** (la credencial del provider correcto). Ver §4.

---

## 1. T1 — El contrato de los 2 métodos (semántica exacta)

### 1.1 `getMaxCostPerCallUsd(): number | undefined`

| Configuración del router | Valor devuelto | Por qué |
|---|---|---|
| `new ModelRouter()` / `new ModelRouter({})` | **1.0** | El **default del constructor**: es el mismo valor que ya usa `enforceCostBudget` (EGO-FIND-39), así que el tope global y el enforcement en línea nunca se contradicen. |
| `{maxCostPerCallUsd: 2.5}` | **2.5** | El tope configurado. |
| `{maxCostPerCallUsd: 0}` / negativo / `NaN` / no finito | **`undefined`** | **Sin tope.** `0` significaría "todo cuesta 0" y el breaker calcularía `MÍNIMO(Sub-Ego, 0) = 0`, parando **todos** los turnos. `undefined` = "no hay tope global": el circuito vigila el resto de límites (tokens, duración, gasto diario). Es exactamente la semántica que ya tenía `enforceCostBudget` (un tope no positivo = sin tope), aplicada al lector. |

> **El contrato decide qué gana cuando hay conflicto:** el tope efectivo es
> el **MÍNIMO** entre el del Sub-Ego y el global del router
> (`SubEgoBudgetBreaker.effectiveCostCapUsd`). Con el router **sin tope**
> (`undefined`), el tope efectivo es el del Sub-Ego.

### 1.2 `resolveCheaperModel(options | number): Promise<string | null>`

**Formas admitidas** (las dos, para que cualquier consumidor del contrato
estructural pueda llamar sin adaptadores):

```ts
// Canónica — la del contrato real `BudgetAwareRouterLike`
resolveCheaperModel({ maxCostPerCallUsd: 0.05, capabilities?: readonly string[] })
// Abreviada — la del handoff A1-ola6 §4.1
resolveCheaperModel(0.05)
```

| Situación | Resultado |
|---|---|
| Hay un modelo más barato dentro del tope | su **id** |
| **No hay ninguno** | **`null`** ⇒ el circuito **DETIENE** con `SubEgoBudgetCircuitBreakerError` (fail-closed). Nunca devuelve el `mock` (devolvería una respuesta ficticia al usuario), nunca devuelve un modelo por encima del tope. |
| El candidato **no** cumple `requiredCapabilities` | queda **fuera** de la lista (filtro AND). Una capacidad **desconocida** deja la lista vacía ⇒ `null` (fail-closed, no se degrada a ciegas). |
| Tope `<= 0`, no finito o `NaN` | **`null`** (sin tope no se degrada: no hay criterio para elegir). |

**Métrica de coste**: `estimateCallCostUsd(candidato, {messages: []})` =
`1024 × costPerOutputTokenUsd` (estimación canónica). Es la **misma** función
que usa `enforceCostBudget` — la selección de candidatos está **extraída**
(`findCheaperCandidate`), **no duplicada**: el breaker decide *cuándo* degradar,
el router decide *con qué modelo*.

### 1.3 El guard de contrato en tiempo de compilación

`packages/models/src/BudgetRouterContract.ts` (nuevo) espeja el contrato
`BudgetAwareRouterLike` de `packages/subegos` y **falla al compilar** si el
`ModelRouter` deja de satisfacerlo:

```ts
export type ModelRouterSatisfiesBudgetContract = AssertTrue<
  ModelRouter extends BudgetRouterContractRequired ? true : false
>;
```

**Demostrado, no supuesto** (rompí el método a propósito y revertí):

```text
$ # con `getMaxCostPerCallUsd` renombrado a `getMaxCostPerCallUsdXYZ`
src/BudgetRouterContract.ts(74,3): error TS2344: Type 'false' does not satisfy the constraint 'true'.
EXIT=2
$ # revertido
EXIT=0
```

> **Por qué un espejo y no un import**: `packages/models` es la capa más baja
> del runtime; importar `@ego/subegos` crearía una arista que no debe existir.
> La comprobación **autoritativa** (los dos paquetes juntos) vive en el
> desktop, que sí depende de ambos — ver §4.
>
> **Ojo**: la primera versión del guard usaba la variante de métodos
> **opcionales** y **no detectaba** nada (un tipo con métodos opcionales los
> satisface aunque no los tenga: `{a?: X}` acepta `{}`). Corregido con una
> variante de métodos **obligatorios** (`BudgetRouterContractRequired`), que
> es la que muerde.

---

## 2. La evidencia de la degradación REAL (router real + catálogo real)

Test: `packages/models/test/router-budget-contract.test.ts` (16 tests). Monta el
**`SubEgoBudgetCircuitBreaker` real** (no un mock) con el **`ModelRouter` real**
y el **catálogo real** (los modelos por defecto del router: `gpt-4o`,
`claude-3-5-sonnet-20241022`, `llama3.2:3b`, `gemini-3.8-flash`,
`deepseek-chat`, `mock-core`) y un **provider real**
(`OpenAICompatibleProvider` con una credencial de prueba: `isAvailable()` no
hace red).

| Aserción | Resultado medido |
|---|---|
| El circuito **DEGRADA** de verdad al superar el tope de coste | `outcome === "degrade"`, `model === "gpt-4o"`, `effectiveCostCapUsd === 0.05` |
| El circuito **DETIENE** con error tipado cuando no hay alternativa | `outcome === "stop"`, `error instanceof SubEgoBudgetCircuitBreakerError`, `error.limit === "cost_per_call"` |
| El tope efectivo es el **MÍNIMO**(Sub-Ego, router) | `0.5` (Sub-Ego 0.5 · router 1.0) |
| Con el router **sin tope global** (`undefined`), manda el del Sub-Ego | `0.05` (y **no** `0` — ver §3) |
| `resolveCheaperModel` con alternativa | `"gpt-4o"` (1024 × 0.00001 = **0.01024 USD**) |
| `resolveCheaperModel` sin alternativa | `null` |
| El candidato cumple `requiredCapabilities` | con `capabilities: ["tool_calling"]` el modelo barato **sin** `tool_calling` queda fuera y gana el que lo tiene |
| Capacidad desconocida | `null` (fail-closed) |

### TDD — rojo pegado (antes de implementar)

```text
 ❯ test/router-budget-contract.test.ts (16 tests | 7 failed) 16ms
   × (a′) un tope NO positivo o no finito significa SIN tope ⇒ `undefined`
 AssertionError: expected +0 to be undefined
   × (f) acepta también la forma abreviada (un número suelto) del handoff A1-ola6 §4.1
 AssertionError: expected null to be 'gpt-4o' // Object.is equality
   × con el router SIN tope global (`undefined`), el tope efectivo es el del Sub-Ego
 AssertionError: expected +0 to be 0.05 // Object.is equality
   × resuelve un id REGISTRADO a su provider, credencial, baseUrl y capacidades
 TypeError: router.resolveModelTarget is not a function
   × resuelve un id NO registrado por el catálogo curado (attribution offline)
 TypeError: router.resolveModelTarget is not a function
   × devuelve `null` si el id no se puede atribuir a ningún provider (fail-closed)
 TypeError: router.resolveModelTarget is not a function
   × el perfil de provider dice qué credencial necesita (y los locales, ninguna)
 TypeError: (0 , providerProfile) is not a function
 Test Files  1 failed (1)
      Tests  7 failed | 9 passed (16)
```

---

## 3. El bug encontrado: la "trampa del tope 0"

**Síntoma**: `getMaxCostPerCallUsd()` devolvía el valor configurado tal cual,
incluido `0`.

**Consecuencia real, medida**: el breaker calcula
`tope efectivo = MÍNIMO(tope del Sub-Ego, tope del router)`. Con el router en
`0`, el mínimo es `0` ⇒ **toda** llamada con `costUsd > 0` dispara la
degradación, y como no hay modelo más barato que cueste `0`, el circuito
**DETIENE todos los turnos**. Un router con "tope 0" (que en la semántica de
`enforceCostBudget` significa "sin tope") habría **tumbado el producto**.

**Corrección**: `getMaxCostPerCallUsd()` devuelve `undefined` cuando el tope
configurado no es un número positivo finito. `undefined` es exactamente lo que
el breaker ya sabe interpretar ("no hay tope global" ⇒ manda el del Sub-Ego).

**Verificado en los dos extremos**:

```text
× con el router SIN tope global (`undefined`), el tope efectivo es el del Sub-Ego
  AssertionError: expected +0 to be 0.05        ← ANTES (con el tope 0)
  ✓ después: 0.05
```

---

## 4. T2 — El destino operable: "id de modelo → configuración"

### 4.1 Qué ya existía (verificado, no rehecho)

De la Ola 5 (`A2bis.md` §1.2) ya estaban en `packages/models`:

| Pieza | Estado | Qué da |
|---|---|---|
| `ModelRouter.getModelDescriptor(id)` | ✅ verificado | Descriptor del registro (provider, capacidades, coste). **Síncrono**. |
| `ModelRouter.listModelDescriptors()` | ✅ verificado | El registro completo. |
| `ModelRouter.resolveModelDescriptor(id, {providerId?})` | ✅ verificado | Descriptor de un id **no registrado** con provider conocido (dinámico). **Asíncrono** (consulta `provider.isAvailable()`). |
| `ModelCatalog.attributeModelId(id)` | ✅ verificado | Atribución **offline** de un id a su provider (catálogo curado). **Síncrono**. |

### 4.2 Lo que he añadido en esta ola (por qué)

El consumidor del desktop (`apps/desktop/src/main/subegos/budget-guard.ts:114`
y `apps/desktop/src/main.ts:635`) necesita responder a **una sola pregunta**:
*"dado el id al que el circuito degradó, ¿puedo construir su configuración?"*
Le faltaban dos cosas:

| Falta | Añadido | Por qué |
|---|---|---|
| Un camino **síncrono** | `ModelRouter.resolveModelTarget(id): ModelTarget \| null` | `resolveModelDescriptor` es asíncrono (consulta la disponibilidad del provider). El destino operable debe poder resolverse sin red: la atribución por catálogo curado es offline. |
| **Qué credencial** usa cada provider | `ModelCatalog.providerProfile(provider)` → `{credentialSlot, baseUrlSlot, isLocal}` | El desktop persiste UNA configuración con **varios** slots de credencial (`openaiKey`, `anthropicKey`, `googleKey`, `deepseekKey`) + `baseUrl`/`openaiBaseURL`/… Saber **qué slot** corresponde a cada provider es conocimiento del paquete de modelos (es el mismo reparto que usa `createProductionRouter(keys)`). `packages/models` **no** importa el esquema del desktop (DIP): sólo declara el nombre del slot. |

```ts
export interface ModelTarget {
  readonly modelId: string;
  readonly provider: ModelProviderId;
  readonly profile: ModelProviderProfile;   // credentialSlot + baseUrlSlot + isLocal
  readonly capabilities: readonly ModelCapability[];
  readonly estimatedCostUsd?: number;
  readonly registered: boolean;             // ¿capacidades y coste conocidos?
  readonly providerRegistered: boolean;      // ¿hay provider registrado para él?
}
```

Semántica:

| Caso | `resolveModelTarget` |
|---|---|
| Id **registrado** | provider, capacidades y coste **exactos** (fuente autoritativa: el registro del router). `registered: true`. |
| Id **no registrado** pero atribuible por el catálogo curado | provider + perfil; **capacidades vacías** (no se inventan) y `registered: false` ⇒ el llamante sabe que **no puede asumir** `tool_calling`. |
| Id **no atribuible** | **`null`** ⇒ fail-closed (el guard DETIENE). |

---

## 5. Nota para A4 (`apps/desktop/**`)

### 5.1 Los casts: ya no hacen falta (y hay un guard que loEnsure)

Los dos casts que A1 §4.2 mencionaba **ya están fuera** del árbol
(`apps/desktop/src/main.ts:611` y `:678` → `router: modelRouter`), y el
`typecheck` del desktop pasa. Mi API los satisface **estructuralmente**:

```ts
// packages/subegos/src/SubEgoBudgetBreaker.ts (el contrato real, sin tocar)
export interface BudgetAwareRouterLike {
  getMaxCostPerCallUsd?(): number | undefined;
  resolveCheaperModel?(options: {
    maxCostPerCallUsd: number;
    capabilities?: readonly string[];
  }): string | null | Promise<string | null>;
}
```

Y para que **nadie vuelva a poner un `as`**, `packages/models` lleva el guard
en tiempo de compilación (§1.3). Si A4 quiere la comprobación **autoritativa**
(los dos paquetes a la vez), puede añadir esto en
`apps/desktop/src/main/subegos/budget-guard.ts` — es un typecheck, no un test:

```ts
import type { ModelRouter } from "@ego/models";
import type { BudgetAwareRouterLike } from "@ego/subegos";

// Falla al compilar si el ModelRouter deja de satisfacer el contrato.
type _AssertRouterSatisfiesContract = ModelRouter extends BudgetAwareRouterLike ? true : never;
const _assertRouterSatisfiesContract: _AssertRouterSatisfiesContract = true;
```

### 5.2 🐛 La credencial del modelo degradado (esto hay que arreglarlo)

`apps/desktop/src/main.ts:635-646` (código actual de A4):

```ts
export async function resolveModelConfigById(
  modelId: string
): Promise<ModelConfig | undefined> {
  const descriptor = await modelRouter.resolveModelDescriptor(modelId);
  if (!descriptor) return undefined;
  return {
    activeProvider: descriptor.provider,
    apiKey: currentModelConfig.apiKey ?? "",   // ← la clave del modelo ACTUAL
    baseUrl: currentModelConfig.baseUrl ?? "", // ← el baseUrl del modelo ACTUAL
    modelName: descriptor.id,
  } as ModelConfig;
}
```

**El problema**: si el circuito degrada de un modelo de un provider a otro
(p. ej. de `gpt-4o` (openai) a `deepseek-chat`), la config construida lleva la
**clave del provider equivocado**. Consecuencias: la llamada falla con 401
(ruido) o, peor, se **envía la clave de un provider a otro**.

**El arreglo** (usa el perfil de provider que acabo de exponer):

```diff
  export async function resolveModelConfigById(
    modelId: string
  ): Promise<ModelConfig | undefined> {
-   const descriptor = await modelRouter.resolveModelDescriptor(modelId);
-   if (!descriptor) return undefined;
+   // Destino operable (síncrono): provider + qué credencial/baseUrl usa.
+   const target = modelRouter.resolveModelTarget(modelId);
+   if (!target) return undefined;
+   if (!target.providerRegistered) return undefined;  // fail-closed
+   const { profile } = target;
     return {
-     activeProvider: descriptor.provider,
-     apiKey: currentModelConfig.apiKey ?? "",
-     baseUrl: currentModelConfig.baseUrl ?? "",
-     modelName: descriptor.id,
-   } as ModelConfig;
+     ...currentModelConfig,
+     activeProvider: target.provider,
+     // La credencial es la del PROVIDER del modelo degradado, no la del
+     // modelo vigente (si no, se manda la key de un provider a otro).
+     apiKey: profile.credentialSlot
+       ? (currentModelConfig[profile.credentialSlot] ?? currentModelConfig.apiKey ?? "")
+       : "",
+     baseUrl: profile.baseUrlSlot
+       ? (currentModelConfig[profile.baseUrlSlot] ?? currentModelConfig.baseUrl ?? "")
+       : "",
+     modelName: target.modelId,
+   };
  }
```

(Con `...currentModelConfig` desaparecen también el `as ModelConfig`: el
`ModelConfig` del desktop exige `reviewModel` y `fallbackModel`, que el
spread conserva.)

**Nota**: `resolveModelTarget` es **síncrono**, así que `resolveModelConfig`
puede dejar de ser `async` si A4 lo prefiere — pero el guard ya hace
`await request.resolveModelConfig?.(modelId)`, así que **ambos** funcionan
(sync y async). No hay que cambiar nada en el guard.

### 5.3 El resto del consumo actual de A4 (verificado, sin cambios necesarios)

| Consumidor | Qué usa | Estado |
|---|---|---|
| `apps/desktop/src/main.ts:657` (`estimateTurnCostUsd`) | `getModelDescriptor(modelId)` | ✅ síncrono, sin red |
| `apps/desktop/src/main.ts:638` (`resolveModelConfigById`) | `resolveModelDescriptor(modelId)` | ✅ asíncrono (ver §5.2 para el arreglo de la credencial) |
| `apps/desktop/src/main.ts:611` / `:678` | `router: modelRouter` (sin cast) | ✅ compila |
| `apps/desktop/test/budget-circuit-e2e.test.ts` | `getModelDescriptor` | ✅ |
| `apps/desktop/test/budget-breaker-integration.test.ts` | router estructural de mentira | ✅ (contrato) |

---

## 6. Verificación

| Comando | Exit | Resumen |
|---|---|---|
| `pnpm --filter @ego/models test` | **0** | **12 ficheros** (11 previos + 1 nuevo de 16 tests) · 0 fallos |
| `pnpm --filter @ego/models typecheck` | **0** | incluye el guard de contrato (falla si el router deja de satisfacerlo) |
| `pnpm -r typecheck` | **0** | 0 errores en el monorepo |
| `pnpm lint` | **0** | oxlint + typecheck |
| Zona completa (`memory,knowledge,runtime,models,decision,execution,events,security,tool-call-repair`) | **0** | **111 ficheros**, 0 fallos |
| `pnpm --filter @ego/desktop test` | **0** | 67 ficheros pasados · 1 skipped (sin regresión) |
| `node scripts/verify-vantadb-ids.mjs` | **0** | 942 ficheros · 84 referencias · 0 errores · 2 avisos W2 preexistentes upstream |

**TDD — rojos demostrados**: `router-budget-contract.test.ts` → **7/16 fallos**
antes de implementar (el `+0` en vez de `undefined`, la forma abreviada no
soportada, `resolveModelTarget`/`providerProfile` inexistentes). El guard de
contrato se demostró **en rojo y en verde** rompiéndolo a propósito (§1.3).

---

## 7. Ficheros tocados

**Modificados**
- `packages/models/src/ModelRouter.ts` — `getMaxCostPerCallUsd()` (contrato de "sin tope"), `resolveCheaperModel()` (forma abreviada + contrato de "sin alternativa"), `resolveModelTarget()` (nuevo, síncrono).
- `packages/models/src/ModelCatalog.ts` — `MODEL_PROVIDER_PROFILES`, `providerProfile()`, `ModelTarget` (+ `ModelCredentialSlot` / `ModelBaseUrlSlot`).
- `packages/models/src/index.ts` — exporta el módulo del guard.

**Nuevos**
- `packages/models/src/BudgetRouterContract.ts` — espejo del contrato + guard en tiempo de compilación.
- `packages/models/test/router-budget-contract.test.ts` — 16 tests (contrato, degradación real con router real + catálogo real, destino operable).
- `docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A2bis-router.md` — este handoff.

**Sin tocar**: `apps/**` (A4), `docs/**` salvo este handoff (A1/A5/A8), raíz y `scripts/**` (A7). **Sin commits.**

---

## 8. RESULTADO

```text
RESULTADO: {
  agente: A2-bis-router,
  status: COMPLETO,
  scope: "Ola 6 — T1 (los 2 métodos del ModelRouter) + T2 (destino operable id de modelo → configuración)",
  archivos_modificados: [
    "packages/models/src/ModelRouter.ts",
    "packages/models/src/ModelCatalog.ts",
    "packages/models/src/index.ts"
  ],
  archivos_nuevos: [
    "packages/models/src/BudgetRouterContract.ts",
    "packages/models/test/router-budget-contract.test.ts",
    "docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A2bis-router.md"
  ],
  contrato_entregado: {
    getMaxCostPerCallUsd: "number | undefined — 1.0 (default del constructor) si no se configura; el tope configurado si es positivo y finito; `undefined` (= SIN tope) si es 0, negativo, NaN o no finito",
    resolveCheaperModel: "Promise<string | null> — id del modelo más barato dentro del tope (mock NUNCA; capacidades filtradas con AND); `null` si no hay alternativa ⇒ el circuito DETIENE con error tipado. Acepta el objeto de opciones (forma del contrato real) y un número suelto (forma abreviada de A1-ola6 §4.1)",
    tope_efectivo: "MÍNIMO(tope del Sub-Ego, tope global del router); con el router sin tope (`undefined`) manda el del Sub-Ego"
  },
  evidencia_real: [
    "El circuito REAL (SubEgoBudgetCircuitBreaker) con el ModelRouter REAL y el catálogo REAL degrada a 'gpt-4o' al superar el tope (coste estimado 0,01024 USD) — sin mocks",
    "El circuito REAL DETIENE con SubEgoBudgetCircuitBreakerError (limit: 'cost_per_call') cuando no hay modelo dentro del tope",
    "El candidato DEBE cumplir requiredCapabilities: con ['tool_calling'] el modelo barato que no lo tiene queda fuera; una capacidad desconocida ⇒ null (fail-closed)",
    "Guard de contrato en tiempo de compilación demostrado en rojo (TS2344) y en verde rompiendo y revirtiendo el método a propósito"
  ],
  bug_encontrado_y_corregido: [
    "La 'trampa del tope 0': getMaxCostPerCallUsd() devolvía 0 (no undefined) ⇒ el breaker calculaba MÍNIMO(Sub-Ego, 0) = 0 y DETENÍA todos los turnos. Ahora 0/negativo/NaN ⇒ `undefined` (= sin tope), verificado con el breaker real (tope efectivo 0,05 en vez de 0)"
  ],
  t2_destino_operable: {
    verificado_de_ola_5: [
      "ModelRouter.getModelDescriptor(id) (síncrono)",
      "ModelRouter.listModelDescriptors()",
      "ModelRouter.resolveModelDescriptor(id, {providerId?}) (asíncrono; descriptor dinámico para ids no registrados)",
      "ModelCatalog.attributeModelId(id) (atribución offline por catálogo curado)"
    ],
    anadido_esta_ola: [
      "ModelRouter.resolveModelTarget(id): ModelTarget | null — SINCRÓNICO, sin red: provider + perfil + capacidades + coste estimado + `registered` + `providerRegistered`",
      "ModelCatalog.providerProfile(provider) → {credentialSlot, baseUrlSlot, isLocal}: qué credencial y qué baseUrl necesita cada provider (los locales no necesitan ninguna)"
    ],
    semantica: "id registrado ⇒ capacidades y coste exactos; id no registrado pero atribuible ⇒ capacidades VACÍAS (no se inventan) y registered: false; id no atribuible ⇒ null (fail-closed)"
  },
  nota_para_a4: {
    casts: "los dos casts de main.ts (router: modelRouter as unknown as BudgetRouter) YA NO están en el árbol y el typecheck pasa; el guard en tiempo de compilación (packages/models/src/BudgetRouterContract.ts) hace que nadie pueda volver a poner un `as` sin romper el build",
    bug_a_arreglar: "apps/desktop/src/main.ts:635-646 — `resolveModelConfigById` copia `currentModelConfig.apiKey`/`baseUrl` (del modelo VIGENTE) a la config del modelo DEGRADADO: si el provider cambia, se manda la clave de un provider a otro. Arreglo con `resolveModelTarget()` + `profile.credentialSlot`/`profile.baseUrlSlot` (diff exacto en §5.2)",
    opcional: "el guard autoritativo en el desktop: `type _Assert = ModelRouter extends BudgetAwareRouterLike ? true : never` en budget-guard.ts"
  },
  verify: {
    tests: "pnpm --filter @ego/models test → 12 ficheros, 0 fallos (16 tests nuevos); zona completa → 111 ficheros, 0 fallos; @ego/desktop → 67 pasados, 1 skipped",
    typecheck: "exit 0 (`pnpm -r typecheck`, monorepo completo; el guard de contrato también compila)",
    lint: "exit 0 (`pnpm lint`)",
    vantadb_ids: "exit 0 (0 errores, 2 avisos W2 preexistentes upstream)",
    tdd_rojos_demostrados: [
      "router-budget-contract.test.ts → 7/16 fallos (`expected +0 to be undefined`, `expected null to be 'gpt-4o'`, `resolveModelTarget is not a function`, `providerProfile is not a function`)",
      "guard de contrato → TS2344 al romper el método (exit 2) y exit 0 al revertirlo"
    ]
  },
  fuera_de_zona: [
    "A4 (§5.2): el diff exacto para que la config del modelo degradado lleve la credencial del provider CORRECTO",
    "A4 (§5.1, opcional): el guard de contrato autoritativo en el desktop"
  ],
  debt: [
    "El espejo `BudgetRouterContract` puede desincronizarse si `packages/subegos` cambia su contrato: el guard falla al compilar (no en runtime), pero hay que actualizar el espejo. La comprobación autoritativa (los dos paquetes) la puede añadir A4 en el desktop",
    "`resolveCheaperModel` estima con 1024 tokens de salida (estimación canónica): es la misma métrica que `enforceCostBudget`, pero no tiene en cuenta la longitud real del prompt (el desktop sí la estima con `estimateTurnCostUsd`)"
  ]
}
```
