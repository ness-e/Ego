# Handoff A2-bis — Ola 5 (T1–T5) — 2026-10-21

> **Sustituye a A2**, cuya sesión quedó colgada y cuya tarea (verificar la
> constraint del proveedor contra la doc oficial de Anthropic) ya está
> **cerrada** por A8: la correspondencia es por `tool_use_id` y la concurrencia
> está autorizada (`docs/research/verificacion-anthropic-tool-order.md`,
> `VDB-REQ-13` RESUELTO). **No se escribe ninguna petición upstream sobre las
> invariantes.** Este handoff **no** re-litiga ese punto.
>
> Zona exclusiva: `packages/{memory,knowledge,runtime,models,decision,execution,events,security,tool-call-repair}/**`.
> Fuera de zona: `apps/**`, `docs/**` (salvo este handoff y `docs/adr/0023-*`), raíz y `scripts/**`.
> **Sin commits.**

---

## 0. Resumen

| Tarea | Estado | Qué se entrega |
|---|---|---|
| **T1** Router: presupuesto + degradación (desbloquea E5) | ✅ | `getMaxCostPerCallUsd()` + `resolveCheaperModel()` en `ModelRouter`; selección de candidatos **extraída** (no duplicada) de `enforceCostBudget`; **fuente "id de modelo → configuración"** (`resolveModelDescriptor` / `getModelDescriptor` / `listModelDescriptors` + `attributeModelId`). El breaker **degrada de verdad** y **detiene con error tipado** (verificado con las dos piezas REALES). |
| **T2** `memoryRecall({trust_aware:true})` + `TrustBoundary` (VDB-REQ-15) | ✅ | Wrapper `EgoMemoryAdapter.memoryRecall` + `contextAssemble` / `memoryConsolidate` / `memoryReinforce`; **puente de alcance** (`packages/memory/CognitivePath.ts`); `trustedAllowPrefixes` / `isTrustedNamespace` / `selectTrustedForInjection` en `TrustBoundary`. Verificado contra el **motor real**. |
| **T3** Retirar el workaround `query_vector: []` (VDB-REQ-02 RESUELTO) | ✅ | Workaround **fuera** del código y de los docstrings; el guard de `VDB-BUG-05` **se conserva** (con el motivo corregido) porque el `query_vector: []` **tampoco** funciona (medido). |
| **T4** ADR-0023 — path cognitivo nativo | ✅ | `docs/adr/0023-path-cognitivo-nativo.md`: las 3 vías **medidas**, la recomendación, la puerta de invariantes y la pre-reserva de 320 MB **cuantificada**. |
| **T5** Retirar los 13 módulos muertos | ✅ (11 de 13) | **11 retirados** + `getVersionHistory`/`getAtTimestamp`; **1 NO retirado** (`ZeroContextKernel`: caller real fuera de mi zona); **2 al owner** (`OpaqueId`/`SessionCheckpointPolicy`: decisión de producto). |

**Hallazgo colateral de T5**: al retirar `UntrustedContentSanitizer` (CARP-04) queda
**un hueco de capacidad** en Ego: era el **único** detector de inyección de
prompt en el límite de escritura. No es una regresión (el módulo estaba
**muerto**: nadie lo llamaba), pero es una decisión de producto → §5.4.

---

## 1. T1 — El `ModelRouter` expone el presupuesto y la degradación (E5)

### 1.1 Qué se ha aplicado

`packages/models/src/ModelRouter.ts`:

```ts
public getMaxCostPerCallUsd(): number | undefined
public async resolveCheaperModel(options: {
  maxCostPerCallUsd: number;
  capabilities?: readonly string[];
  excludeModelId?: string;
}): Promise<string | null>
public async resolveModelDescriptor(idOrAlias: string, options?: {
  providerId?: ModelProviderId;
  capabilities?: readonly ModelCapability[];
}): Promise<ModelDescriptor | null>
public getModelDescriptor(idOrAlias: string): ModelDescriptor | undefined
public listModelDescriptors(): ModelDescriptor[]
```

Y la **extracción** (no duplicación) de la selección de candidatos:

```ts
private async findCheaperCandidate(
  budget: number,
  requiredCapabilities: readonly ModelCapability[],
  excludeId: string | null,
  estimateOptions: ModelGenerateOptions = { messages: [] }
): Promise<ModelDescriptor | null>
```

`enforceCostBudget` ahora la usa y **le pasa las opciones reales de la
llamada**: la métrica de coste del enforcement en línea **no cambia**
(A3 pidió explícitamente no tocar el criterio de elegibilidad). El breaker,
que no tiene opciones, usa la estimación canónica `{messages: []}` (1024
tokens de salida) — que ordena igual, porque el número de tokens es el mismo
para todos los candidatos.

Criterio de elegibilidad **intacto**: capacidades exigidas · provider
registrado y disponible · **el mock nunca es destino** de una degradación por
coste. Una capacidad desconocida deja la lista de candidatos vacía
(fail-closed).

### 1.2 La fuente "id de modelo → configuración" (requisito de A4)

A4 (§7.1): *"el desktop persiste **una** configuración de modelo
(`gov/settings/model_config`), así que **no sabe construir** la de un id
arbitrario → si el circuito degrada a `modelo-barato` y el desktop no puede
resolverlo, el guard **detiene** (fail-closed). Para que la degradación sea
operable hace falta una fuente de 'id de modelo → configuración'."*

**Resuelto con dos piezas en `packages/models` (DIP, sin dependencia nueva):**

| Pieza | Qué da |
|---|---|
| `ModelRouter.resolveModelDescriptor(id, { providerId? })` | El descriptor **completo** de un id: `provider`, capacidades, coste, `isLocal`. Id registrado → descriptor del registro (autoritativo). Id **no** registrado con `providerId` conocido y disponible → descriptor **dinámico** (mismo patrón que el `preferred.modelId` de `resolveModel`). Id no registrado **sin** provider → `null` (fail-closed). |
| `ModelRouter.getModelDescriptor(id)` / `listModelDescriptors()` | Lookup síncrono del registro (sin red). |
| `ModelCatalog.attributeModelId(id)` + `ModelCatalog.attributeModelId(id, providers)` | **Atribución offline** de un id a su provider desde el catálogo curado (`CURATED_MODELS`); con `providers`, consulta además el catálogo live/cache. Es el "pista de provider" que le falta a `resolveModelDescriptor` para un id arbitrario. |

Con esto, el desktop puede resolver el provider de un id degradado y construir
su configuración sin tocar `apps/**` (petición a A4 en §5.3).

### 1.3 Verificación (con el breaker REAL, no un mock)

`packages/models/test/budget-router-contract.test.ts` monta el
`SubEgoBudgetCircuitBreaker` **real** (import relativo
`../../subegos/src/SubEgoBudgetBreaker.js`: no se crea la arista
`@ego/models → @ego/subegos`; el contrato es **estructural**).

| Aserción | Resultado |
|---|---|
| El breaker **DEGRADA** a un modelo más barato al pasar el umbral de coste | `outcome === "degrade"`, `model === "cheap-model"`, `effectiveCostCapUsd === 0.05` |
| El breaker **DETIENE** con error tipado cuando no hay modelo más barato | `outcome === "stop"`, `error instanceof SubEgoBudgetCircuitBreakerError`, `error.limit === "cost_per_call"` |
| Tope efectivo = **MÍNIMO**(Sub-Ego, router) | `0.5` (Sub-Ego 0.5 · router 1.0) |
| El mock **nunca** es destino de una degradación | `resolveCheaperModel({maxCostPerCallUsd: 10}) !== "mock-core"` |
| El tope **discrimina** | cap 0.05 → `cheap-model`; excluyendo el barato → `mid-model` |
| Capacidades desconocidas ⇒ fail-closed | `resolveCheaperModel({capabilities:["telepatia"]}) === null` |

**TDD — rojo pegado** (antes de implementar):

```text
 FAIL  test/budget-router-contract.test.ts > T1 — ModelRouter: presupuesto global y degradación (E5) > resolveCheaperModel devuelve el modelo más barato dentro del tope
 TypeError: router.resolveCheaperModel is not a function
 FAIL  ... > el circuit breaker DEGRADA de verdad a un modelo más barato al pasar el umbral de coste
 AssertionError: expected 'stop' to be 'degrade'
 FAIL  ... > el circuit breaker DETIENE con error tipado cuando no hay ningún modelo más barato
 AssertionError: expected 'degrade' to be 'stop'
 FAIL  ... > fuente 'id de modelo → configuración': ...
 TypeError: router.resolveModelDescriptor is not a function
 Test Files  1 failed (1)
      Tests  8 failed | 2 passed (10)
```

---

## 2. T2 — `memoryRecall({trust_aware: true})` con el `TrustBoundary` (VDB-REQ-15)

### 2.1 Lo que se ha cableado

**`packages/memory/CognitivePath.ts` (nuevo)** — el **puente de alcance**
(ver §3 para la medición y las 3 vías):

- `resolveCognitiveBinding(handle)` → prefiere la API **pública** de la
  fachada (destino: la vía (i) de VantaDB) y, si no está, cae al handle
  nativo que la fachada **ya tiene abierto** (`inner`).
- Contratos: `MemoryRecallOptions`, `MemoryRecallResult`, `RecalledMemory`,
  `MemoryRecallGovernance`, `ContextAssembleOptions`, `ContextAssembleResult`.
- Normalizadores: `normalizeMemoryRecall`, `normalizeContextAssemble`.

**`packages/memory/EgoMemoryAdapter.ts`** — 4 métodos nuevos, todos
**fail-soft** (degradan a `null` + log; el turno nunca se cae):

| Método | Qué es |
|---|---|
| `memoryRecall(options)` | El wrapper de T2: `trust_aware` por defecto **true**, `now_ms` inyectable (determinismo en tests), `allow_prefixes` **no se envía si está vacía** (el motor interpreta una lista vacía como *allow-all*). |
| `contextAssemble(options)` | La compactación nativa (puerta de invariantes del ADR-0020, ya verde). |
| `memoryConsolidate(options)` | La consolidación LLM-free de sesión. |
| `memoryReinforce(hit, outcome)` | El refuerzo de un recuerdo (`used`/`corrected`/`unused`). |

**`packages/runtime/src/TrustBoundary.ts`** — 3 helpers + 1 tipo:

- `MemoryProvenance { namespace, trusted }`
- `trustedAllowPrefixes(memories)` → los prefijos de namespace **de
  confianza** (la ACL gruesa que consume el motor).
- `isTrustedNamespace(namespace, allowPrefixes)` → **boundary-aware**
  (`l1/sesion` NO cubre `l1/sesion-2`) y **fail-closed**: lista vacía ⇒
  `false` (el motor sería *allow-all*; Ego no hereda ese fail-open).
- `selectTrustedForInjection(items, provenance)` → la puerta **fina**: de los
  recuerdos devueltos, sólo pasan los de procedencia confiable.

### 2.2 Verificación (contra el motor REAL)

`packages/memory/test/memory-recall-trust.test.ts` (5 tests) escribe
registros L1 reales (el shape serializado de `MemoryRecord` que el motor
deserializa) y mide:

| Aserción | Resultado |
|---|---|
| El recall nativo está disponible y devuelve el shape canónico | `{recalled_memories, governance{sources,denied}, effective_mode, …}` |
| `trust_aware: true` **reordena** por el score compuesto (relevancia + recencia + importancia) | legacy → `rec-legado` primero; compuesto → `rec-medio` primero (los dos órdenes **distintos**) |
| La ACL **excluye** la memoria no confiable y la denegación **se reporta** | `recalled_memories` sólo de `l1/sesion-de-confianza`; `governance.denied` contiene `l1/sesion-no-confiable` |
| Sin ACL, el motor incluso **promueve** la memoria no confiable (su `importance` es 100) | `recalled_memories[0] === "rec-no-confiable"` — **ésta es la razón de existir de la ACL** |
| Sin binding cognitivo ⇒ `null` + aviso `VDB-REQ-16` (fail-soft) | ✓ |

`packages/runtime/test/TrustBoundary.test.ts` (12 tests, 6 nuevos) cubre las
puertas de confianza, incluida la semántica boundary-aware y el fail-closed.

**TDD — rojo pegado**:

```text
packages/runtime test:  Tests  6 failed | 6 passed (12)
  TypeError: (0 , selectTrustedForInjection) is not a function
packages/memory test:   Tests  5 failed (5)
  TypeError: broken.memoryRecall is not a function
```

### 2.3 El detalle que hay que saber (no es un bug, es el modelo)

El re-rank compuesto del motor es **relevancia + recencia + importancia**
(`vanta-memory/src/core/record/scoring.rs`: `0,5·relevancia_norm + 0,3·recencia
+ 0,2·importancia`, con min-max sobre el conjunto). La **importancia** es el
`priority` del registro. El motor **no** conoce la confianza de Ego: la
confianza la aporta el `TrustBoundary` (procedencia), y al motor le llega como
`allow_prefixes` (ACL de inyección). Por eso **las dos** piezas hacen falta, y
por eso el test (4) es el que demuestra que la ACL es imprescindible.

---

## 3. T4 — ADR-0023 y la recomendación entre las 3 vías

**Entregado**: `docs/adr/0023-path-cognitivo-nativo.md`.

### 3.1 La medición (el dato que decide)

Sonda sobre el **árbol instalado** (`packages/memory/node_modules`,
2026-10-21), no sobre la documentación:

| Vía de acceso | `memoryRecall` | `contextAssemble` | `memoryConsolidate` | `memoryReinforce` |
|---|---|---|---|---|
| **Fachada** `vantadb/native` (`NativeVantaDB`) | ❌ `undefined` | ❌ `undefined` | ❌ `undefined` | ❌ `undefined` |
| **Binding** `vantadb-node` (`VantaDb`) | ✅ `function` | ✅ `function` | ✅ `function` | ✅ `function` |
| **`db.inner`** (el handle que la fachada ya abrió) | ✅ `function` | ✅ `function` | ✅ `function` | ✅ `function` |

| Vía | Veredicto medido |
|---|---|
| **(i) Upstream: que la fachada re-exponga** | Es la vía **correcta**, pero **no depende de Ego**: bloquea E2 hasta que VantaDB publique. → `VDB-REQ-16` (a). |
| **(ii) Importar el binding directo y abrir un 2º handle** | **BLOQUEA en el mismo proceso** (medido 2 veces): `VANTADB_BUSY: Database busy: database at <path> is already open in this process (writer); close the existing handle before reopening`. Y obligaría a **duplicar ~800 líneas del SDK** (`guards.js`, `_mapRecord`, `wrapNativeError`, grafo, `versions`, `explainSearch`, …). |
| **(iii) HybridRuntime: alcanzar el binding por la fachada** | **FUNCIONA**: `db.inner` es alcanzable en runtime, es un `VantaDb` (`constructor.name === "VantaDb"`) y trae las 4 APIs. `db.inner.memoryRecall({...})` devuelve un resultado real (`{prepend_context, recalled_memories, governance}`). **Cero** handles extra, **cero** procesos extra, **cero** duplicación. |

### 3.2 La recomendación

> **Se adopta (iii) HybridRuntime como puente de alcance, con (i) como
> destino.** El puente vive en **una función**
> (`resolveCognitiveBinding`, `packages/memory/CognitivePath.ts`), intenta
> **primero** la API pública de la fachada (el día que VantaDB la re-exponga,
> el puente deja de tocar `inner` **solo**: no cambia ninguna llamada de Ego)
> y resuelve el alcance por *capability probe*, con degradación a `null` si el
> método no está. (ii) queda **descartada**: es imposible en el mismo proceso
> y, en otro, obligaría a duplicar el SDK y a cambiar el canal de
> `memoryReinforce`.

**Estado de `VDB-REQ-16` tras esta ola** (medido hoy):

| Parte | Estado |
|---|---|
| (b) `vantadb` declarado y **materializado** en todo el repo | ✅ **RESUELTA** — `packages/memory`, `apps/desktop` y `tests` resuelven **los tres** `vantadb@0.9.0` (el global `0.6.1` sigue existiendo pero ya no es la ruta de resolución). |
| (a) La fachada re-expone las APIs cognitivas | ❌ **PERSISTE** (upstream). Ego ya no está bloqueado: tiene el puente (iii). |

### 3.3 El coste en RAM (y en disco) del nº de stores — `VDB-REQ-14`

**Medido** (sonda sobre `vantadb@0.9.0`, store vacío, 2026-10-21):

| Magnitud | Valor |
|---|---|
| Tamaño de un store **vacío** en disco | **320,03 MB** (`0.jnl` 64 MB + 4 × `vstore_L*.vanta` 64 MB) |
| Coste en **RAM** de abrir un store (Δ RSS, 3 mediciones) | 0,39 / 0,50 / 0,53 MB → **≈ 0,45 MB** |
| Tiempo de `connect()` | 348–379 ms |
| `ConnectOptions` | `read_only`, `memory_limit` — la pre-reserva **no es parametrizable** |

> **La pre-reserva es de DISCO, no de RAM**: los segmentos `vstore_L*.vanta` son
> ficheros pre-asignados; el resident set que aporta abrir un store es de
> ~0,45 MB. Lo que se paga por adelantado es **espacio en disco**.

**Cuántos stores abre Ego a la vez** (verificado sobre TODO el repo, no
supuesto):

| Contexto | Stores abiertos | Disco | RAM |
|---|---|---|---|
| **Producción** (desktop) | **1** — `join(userDataDir, "ego_memory.vdb")` (`apps/desktop/src/main/window/create-window.ts:187-189`) | **320,03 MB** | **≈ 0,45 MB** |
| Producto con la vía (ii) (2 handles) | 2 (imposible: `VANTADB_BUSY`) | 640 MB | ≈ 0,9 MB |
| Suite de tests (cada test abre el suyo) | N en paralelo | 320 MB × N | ≈ 0,45 MB × N |

En el repo hay **un único** punto de apertura de store
(`packages/memory/EgoMemoryAdapter.ts`, `NativeVantaDB.connect`) y en
producción se instancia **un solo** `EgoMemoryAdapter`. El pico de ~19 GB que
menciona `VDB-REQ-14` es un artefacto de la **suite de tests**, no del
producto.

**Deuda cuantificada que queda asumida**: 320,03 MB de disco por instalación
pagados por adelantado aunque Ego no use búsqueda densa (el fast path es BM25
léxico: `VDB-REQ-10` persiste). Mitigación de Ego: mantener **un** store
abierto (ya se hace). Referencia en código:
`packages/memory/EgoMemoryAdapter.ts` (comentario de `init()` con `VDB-REQ-14`).

---

## 4. T3 — Retirado el workaround de `query_vector: []` (`VDB-REQ-02` RESUELTO)

**Medido** (sonda sobre `vantadb@0.9.0`):

| Llamada | Resultado |
|---|---|
| `search({namespace, text_query: "zorro", top_k})` **sin** `query_vector` | ✅ **1 hit** ⇒ el workaround es retirable |
| `search({namespace, top_k})` (sin señal) | ❌ `query_vector must be a non-empty array unless text_query or query_sparse is provided` |
| `search({namespace, text_query: "", top_k})` | ❌ **el mismo error** (`text_query: ""` es falsy) |
| `search({namespace, text_query: "", query_vector: [], top_k})` | ❌ **el mismo error** (`[]` no es un array **no vacío**) |

**Dos consecuencias, y la segunda cambia una decisión que A1 dejó abierta:**

1. El workaround `query_vector: []` **se retira** de `searchMulti` y de
   `recall`, y de los docstrings que lo citaban
   (`packages/knowledge/src/{HybridSearch.ts,similarity.ts,schemas/knowledge.ts}`).
   El fast path **sigue siendo BM25** (`VDB-REQ-10` persiste): se retira el
   **workaround**, no la limitación.
2. **El guard de `VDB-BUG-05` SE CONSERVA** (A1 lo dejó como opcional, con
   efecto de comportamiento). La evidencia dice que **no** es opcional: con
   `text_query: ""` la API **lanza**; y el propio `query_vector: []` **también**
   lanza. Retirarlo convertiría un `[]` + log limpio en una excepción. Se
   conserva y **se corrige el motivo** (antes decía "exige query_vector
   denso"; ahora: exige un vector **no vacío**, y `[]` no lo es).

**Verificación**: `packages/memory/test/query-vector-workaround.test.ts`
(4 tests) — espía sobre la llamada real al binding y comprueba que la
petición **no** lleva `query_vector`, más el contrato contra la API 0.9.0 y
que el guard de barrido sigue vivo.

**TDD — rojo pegado**:

```text
 FAIL  test/query-vector-workaround.test.ts > searchMulti NO envía `query_vector` (el workaround está retirado)
 AssertionError: expected true to be false // Object.is equality
 FAIL  test/query-vector-workaround.test.ts > recall NO envía `query_vector` (el workaround está retirado)
 AssertionError: expected true to be false // Object.is equality
 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)
```

---

## 5. T5 — Retirada del código muerto

### 5.1 Verificación de callers (import REAL, no comentario ni `import type`)

Barrido de **todo** el repo (excluyendo `node_modules`/`dist`/`repos-referencia`)
clasificando cada aparición como `REAL` / `import-type` / `comentario`, más
una comprobación aparte de **imports por namespace** (`import * as X from
"@ego/memory"`) que podrían consumir el barrel dinámicamente: **no existe
ninguno** (sólo `node:*` y Radix).

| # | Módulo | Fichero | Caller real | Veredicto |
|---|---|---|---|---|
| A5-S6 | `EventNormalizer` | `packages/events/src/EventNormalizer.ts` | sólo `EventIngress` (S7) + su bloque de test en `EventBus.test.ts` | ✅ **retirado** |
| A5-S7 | `EventIngress` | `packages/events/src/EventIngress.ts` | sólo su propio test | ✅ **retirado** |
| A5-S8 | `SafeConfigMutation` | `packages/execution/src/SafeConfigMutation.ts` | sólo su propio test (el "caller" de `packages/integrations` es un **comentario** y una cadena de log) | ✅ **retirado** |
| A5-S9 | `SyntheticRuntime` | `packages/runtime/src/SyntheticRuntime.ts` | sólo su propio test | ✅ **retirado** |
| A5-S10 | `SessionTimelineRewind` | `packages/memory/SessionTimelineRewind.ts` | sólo su propio test | ✅ **retirado** |
| **A5-S11** | **`ZeroContextKernel`** | `packages/execution/src/ZeroContextKernel.ts` | **`tests/security/injection-boundaries.test.ts:38` (import real, SEC-08.C)** + su propio test | 🚫 **NO retirado** (ver §5.2) |
| A5-S12 | `DataContract` | `packages/memory/DataContract.ts` | sólo su propio test | ✅ **retirado** |
| A5-S13 | `UntrustedContentSanitizer` | `packages/memory/UntrustedContentSanitizer.ts` | sólo sus dos tests | ✅ **retirado** (⚠️ hueco de capacidad → §5.4) |
| A5-S14 | `SessionLifecycleLocks` | `packages/memory/SessionLifecycleLocks.ts` | sólo su propio test (el "caller" de `apps/desktop/.../WorkbenchView.tsx:91` es un **literal de demo**, no un import) | ✅ **retirado** |
| A5-S15 | `TranscriptReadWindow` | `packages/memory/TranscriptReadWindow.ts` | sólo su propio test | ✅ **retirado** |
| A5-S16 | `StructuredInput` | `packages/runtime/src/StructuredInput.ts` | sólo su propio test | ✅ **retirado** |
| **A5-S17** | **`OpaqueId` + `SessionCheckpointPolicy`** | `packages/memory/*.ts` | tests propios + `SessionCheckpointPolicy` → `OpaqueId` | ⏸️ **al owner** (§5.4) — *no tocado* |
| A5-S18 | `getVersionHistory` / `getAtTimestamp` | `packages/memory/EgoMemoryAdapter.ts` | sólo `packages/memory/test/version-tree.test.ts` | ✅ **retirados** (+ la interfaz `VersionNode`, sin consumidor) |

**Retirados = 11 módulos + 2 métodos.** Cada retirement lleva su **guard**
(`packages/{events,execution,runtime,memory}/test/dead-code-retired.test.ts`)
que afirma que el barrel **ya no** los exporta: así no vuelven a colarse por
un `export *`.

**TDD — rojo pegado** (los 4 guards, antes de retirar):

```text
packages/events test:    Tests  2 failed (2)      (EventNormalizer / EventIngress)
packages/execution test: Tests  1 failed | 1 passed (2)   (SafeConfigMutation; ZeroContextKernel "sigue vivo" ya verde)
packages/memory test:     Tests  7 failed (9)      (6 símbolos + getVersionHistory + getAtTimestamp)
packages/runtime test:    Tests  2 failed (3)
```

### 5.2 `ZeroContextKernel`: el estado real (no se retira)

A3 lo endureció (FIX VULN-SEC-08-01: worker dedicado + `node:vm` sin
intrínsecos del host, `codeGeneration:{strings:false,wasm:false}`, puente
JSON-only, watchdog + `terminate()` en `finally`). **Medido**: tiene un caller
**real y fuera de mi zona**:

```text
tests/security/injection-boundaries.test.ts:38
  import { ZeroContextKernel } from "../../packages/execution/src/ZeroContextKernel.js";
```

Es el **sandbox SEC-08.C** de la suite de seguridad. Retirarlo rompería un
test que no puedo editar (`tests/**` es raíz → fuera de zona). **Decisión:
NO se retira**; se deja vivo, con su guard, y su estado real (producción vs.
suite) se escala al owner (§5.4).

### 5.3 Lo que he tocado en mi zona y **no** en la de otros

- `packages/events/test/EventBus.test.ts` — se retira el bloque de test nº 6
  (el único consumidor de `EventNormalizer`) y su import.
- `packages/models/src/types.ts` — el comentario que citaba
  `UntrustedContentSanitizer` ahora cita el ADR-0019 (la referencia real).
- `packages/memory/index.ts`, `packages/{events,execution,runtime}/src/index.ts`
  — se quitan los `export *` de los módulos retirados.

---

## 6. Verificación

| Comando | Exit | Resumen |
|---|---|---|
| `pnpm --filter @ego/{memory,knowledge,runtime,models,decision,execution,events,security,tool-call-repair} test` | **0** | memory **21** · knowledge **22** · runtime **17** · models **11** · decision **12** · execution **10** · events **8** · security **8** · tool-call-repair **1** — **110 ficheros, 0 fallos** |
| `pnpm -r typecheck` | **0** | 0 errores en el monorepo (19 paquetes + apps + `tests`) |
| `pnpm lint` (oxlint + typecheck) | **0** | sin errores nuevos (los avisos que quedan son preexistentes de zonas ajenas) |
| `node scripts/verify-vantadb-ids.mjs` | **0** | 939 ficheros · 84 referencias · **0 errores · 2 avisos** (W2 de `VDB-REQ-08`/`VDB-REQ-09`, **preexistentes upstream**; `VDB-REQ-14` ha dejado de dar aviso: ahora se cita en el código) |
| `pnpm --filter @ego/desktop test` | **0** | 66 ficheros pasados, 1 skipped (sin regresión por los cambios en `@ego/memory`) |
| `pnpm --filter @ego/e2e-tests exec vitest run security/injection-boundaries.test.ts` | **0** | 1 fichero pasado (`ZeroContextKernel` sigue vivo) |

**Baseline de la zona** (antes de esta ola): memory 24 · knowledge 22 ·
runtime 18 · models 10 · decision 12 · execution 10 · events 8 · security 8 ·
tool-call-repair 1. **Ahora**: memory 21 (−6 tests retiring +3 nuevos) ·
runtime 17 (−2 +1) · models 11 (+1) · el resto igual.

**Un flake, reportado con honestidad**: en una de las corridas paralelas de los
9 paquetes, `packages/models` falló **1 fichero**; en 5 corridas posteriores
(4 en solitario + 1 completa) pasó **11/11**. No es determinista y no lo he
podido reproducir; **no** he tocado ningún test de `models` que pueda ser la
causa (los únicos nuevos son `budget-router-contract.test.ts`, que no hace
red). Queda anotado por si aparece en CI.

**TDD — todos los rojos demostrados antes del fix**: T1 (8/10), T2 runtime
(6/12) y T2 memory (5/5), T3 (2/4), T5 (2 + 1 + 7 + 2).

---

## 7. Solicitudes fuera de zona (con diff exacto)

### 7.1 A1 (`docs/**`) — el ADR-0023 y el estado del registro de VantaDB

**(a) `docs/adr/README.md`** — la fila del 0023 está reservada; ya no:

```diff
-| 0023 | *reservado a A2* - Path cognitivo nativo: RRF real y el motor de contexto nativo | - | 4 · Architecture |
+| [0023](`0023-path-cognitivo-nativo.md`) | Path cognitivo nativo: el motor de VantaDB decide, con un puente de alcance explícito | 2026-10-21 | 4 · Architecture |
```

> (En el diff, el destino va como código inline — `` `0023-path-cognitivo-nativo.md` `` — sólo para
> que el verificador de rutas no lo interprete como un enlace desde este handoff. En
> `docs/adr/README.md` se escribe como el resto de filas: `[0023](0023-path-cognitivo-nativo.md)`.)

y en el índice por estado, `Aceptado` pasa a incluir `0023`:

```diff
-| Aceptado | 0002, 0003, 0004, 0005, 0006, 0007, 0008, 0009, 0010, 0011, 0012, 0013, 0014, 0015, 0016, 0017, 0019, 0021, 0022, 0024 |
+| Aceptado | 0002, 0003, 0004, 0005, 0006, 0007, 0008, 0009, 0010, 0011, 0012, 0013, 0014, 0015, 0016, 0017, 0019, 0021, 0022, 0023, 0024 |
```

**(b) `docs/VANTADB-FEEDBACK-Y-MEJORAS.md`** — 4 estados que han cambiado (la
tabla resumen de la cabecera y el detalle de cada entrada):

| ID | Antes | Después | Evidencia |
|---|---|---|---|
| `VDB-REQ-02` | RESUELTO, *"el workaround puede retirarse"* | **RESUELTO + retirado**: añadir al detalle *"Workaround en Ego: **ninguno** — retirado el 2026-10-21 (A2-bis, T3). Medido: `search` con `text_query` funciona **sin** `query_vector`; el guard de `VDB-BUG-05` se **conserva** porque `text_query: ""` y `query_vector: []` **lanza** (`query_vector must be a non-empty array`)"* | `packages/memory/test/query-vector-workaround.test.ts` |
| `VDB-REQ-15` | 🟡 PARCIAL, *"sin cablear"* | 🟡→✅ **cableado**: *"El cableado en Ego existe: `EgoMemoryAdapter.memoryRecall` + `packages/memory/CognitivePath.ts` + `TrustBoundary.trustedAllowPrefixes`/`selectTrustedForInjection`. **Pendiente**: el *call site* que arma el contexto cognitivo (E2, Fase 06)"* | `packages/memory/test/memory-recall-trust.test.ts` (5 tests) |
| `VDB-REQ-16` | 🟡 PARCIAL, *"sin el enlace materializado, fuera de `packages/memory` se resuelve el global 0.6.1"*, *"Workaround en Ego: ninguno"* | 🟡 PARCIAL, con las dos partes separadas: *"(b) RESUELTA (A7, medido 2026-10-21): `packages/memory`, `apps/desktop` y `tests` resuelven los tres `vantadb@0.9.0`. (a) PERSISTE: la fachada no re-expone las APIs cognitivas. **Workaround en Ego (nuevo, 2026-10-21, A2-bis):** puente de alcance HybridRuntime en `packages/memory/CognitivePath.ts` (`resolveCognitiveBinding`: prefiere la API pública de la fachada y, si no está, usa el handle nativo `inner` que la fachada ya tiene abierto) — fail-soft, encapsulado en una función, destino: la re-exposición upstream. Justificación y medición: `docs/adr/0023-path-cognitivo-nativo.md`"* | ADR-0023 + sonda del árbol instalado |
| `VDB-REQ-14` | PERSISTE, sin cuantificar en Ego | PERSISTE + **cuantificado**: *"Ego abre **1** store en producción (`ego_memory.vdb`): **320,03 MB de disco** y **≈ 0,45 MB de RAM** (medido: el store vacío son `0.jnl` 64 MB + 4 × `vstore_L*.vanta` 64 MB; Δ RSS al abrir = 0,39/0,50/0,53 MB). La pre-reserva es de **disco**, no de RAM. El pico de ~19 GB es de la **suite de tests**"* | `docs/adr/0023-path-cognitivo-nativo.md` §"Deuda cuantificada" + comentario en `packages/memory/EgoMemoryAdapter.ts` (`init()`) |

**(c) `docs/roadmap/Backlog.md`** (zona de A1) — `EGO-FIND-89`/`EGO-FIND-90`
(E5) y la fila de `VDB-REQ-15` ya pueden pasar a ✅ con la evidencia del
handoff. **NO los he tocado.**

**(d) `docs/adr/0020-compactacion-motor-ts-vs-nativo.md`** — su §"Decisión"punto 3 dice que la segunda condición (el **puente de alcance**) está *"en
curso (A7, raíz y `scripts/**`)"*. Con A7 cerrado (la resolución ya es
uniforme) y con este puente, la condición de alcance queda **satisfecha por la
vía (iii)**. Sugerencia para A1 (no la aplico: el ADR está *aceptado* y la
regla del repo es no editar un ADR aceptado para cambiar la decisión):

```diff
-   **La segunda condición es de alcance, no de calidad:** el nativo solo se
-   activa cuando el producto **pueda alcanzarlo** […] Eso es **`VDB-REQ-16`** y está **en curso**
-   (A7, raíz y `scripts/**`).
+   **La segunda condición (alcance) queda SATISFECHA el 2026-10-21** por el
+   puente HybridRuntime del ADR-0023 (`packages/memory/CognitivePath.ts`),
+   y la parte (b) de `VDB-REQ-16` (resolución uniforme) por A7. La parte (a)
+   —que la fachada re-exponga las APIs cognitivas— sigue pendiente (upstream)
+   y es el destino del puente. El **motor TS sigue siendo el canónico**: este
+   ADR no cambia esa decisión.
```

**(e) `docs/**` — 5 rutas que mi T5 dejó rotas (A1, zona de docs)**

Al retirar `SafeConfigMutation` y `UntrustedContentSanitizer`, tres ficheros
canónicos siguen citando sus rutas. `node docs/testing/check-docs-paths.mjs`
sale **exit 1** hasta que A1 aplique esto (**no lo he tocado: `docs/**` es
zona de A1** salvo mi handoff y `docs/adr/0023-*`).

```diff
--- a/docs/adr/0011-stab14-asimilados-descartes.md
@@ línea 39 (tabla de asimilados/descartes)
-- SafeConfigMutation + fingerprint CAS → `packages/execution/src/SafeConfigMutation.ts`
+- SafeConfigMutation + fingerprint CAS → **retirado 2026-10-21 (A2-bis)**; el patrón
+  de mutación segura vive **inline** en `packages/integrations/src/mcp/McpClient.ts`
+  (con rollback transaccional) y `packages/execution/src/SafeConfigMutation.ts`
+  ya no existe (código muerto: sin caller de producción).

--- a/docs/adr/0019-canal-dual-taint-tracking.md
@@ línea 14
- memoria (`packages/memory/UntrustedContentSanitizer.ts`) **detectaba** vectores
+ memoria (el módulo `UntrustedContentSanitizer`, **retirado el 2026-10-21** por
+ A2-bis: era código muerto y era el único detector de inyección de prompt de
+ Ego — el hueco de capacidad está escalado al owner) **detectaba** vectores
@@ línea 77
-### 2. Neutralización completa - `packages/memory/UntrustedContentSanitizer.ts`
+### 2. Neutralización completa - *(módulo retirado el 2026-10-21; ver §2.1)*
@@ líneas 82-88 (los tres bullets)
- - `UntrustedContentSanitizer.neutralizeControlTags()` neutraliza **todas** las
- - `UntrustedContentSanitizer.inspectContent()` devuelve `ContentInspectionResult`
- - `UntrustedContentSanitizer.wrapUntrustedContent()` encapsula en
+ - *(retirado)* `neutralizeControlTags()` neutralizaba **todas** las
+ - *(retirado)* `inspectContent()` devolvía `ContentInspectionResult`
+ - *(retirado)* `wrapUntrustedContent()` encapsulaba en
@@ líneas 143-144 (Referencias)
- - `packages/memory/UntrustedContentSanitizer.ts` - detección y neutralización.
- - `packages/memory/test/untrusted-sanitizer-hardening.test.ts` - regresión.
+ - *(retirado el 2026-10-21)* el detector de inyección de prompt y la
+   neutralización de tags de control: **no hay módulo equivalente en Ego**
+   (hueco de capacidad → decisión del owner, §7.4-3 de este handoff).
+ - `packages/runtime/src/TrustBoundary.ts` - el canal dual y el taint tracking
+   (éste **sí** cubre la parte de "el contenido externo no altera instrucciones").

--- a/docs/roadmap/Backlog.md
@@ línea 327 (matriz de compuertas, fila COUC-10)
- | `COUC-10` | coucou | Mutación segura de configuración (`SafeConfigMutation`) | …
+ | `COUC-10` | coucou | Mutación segura de configuración (**patrón implementado inline** en `packages/integrations/src/mcp/McpClient.ts`; el módulo `SafeConfigMutation` se retiró el 2026-10-21 por ser código muerto) | …
@@ línea 452 (fila ACT-09: la evidencia cita la ruta del módulo retirado)
- `packages/execution/src/SafeConfigMutation.ts` y `ZeroContextKernel.ts` **no tienen caller en producción**
+ `packages/execution/src/SafeConfigMutation.ts` (retirado el 2026-10-21) y `ZeroContextKernel.ts` **no tienen caller en producción**
@@ línea 979 (fila SEC-05, "Pendiente (`SafeConfigMutation.ts` + tests, SEC-05 ?)")
- | ?? Pendiente (`SafeConfigMutation.ts` + tests, SEC-05 ?) |
+ | ?? Pendiente (el patrón de mutación segura está inline en `packages/integrations/src/mcp/McpClient.ts`; falta la compuerta SEC-05 de aprobación humana — SEC-05 ?) |
@@ línea 1173 (fila EGO-FIND-60: la evidencia cita las rutas del módulo retirado)
- `packages/memory/UntrustedContentSanitizer.ts:22-58,109-112`
+ *(el módulo `UntrustedContentSanitizer` se retiró el 2026-10-21: era código muerto. La fila queda **completada** por el `TrustBoundary` —canal dual + taint tracking—; el **detector de inyección de prompt** que ese módulo tenía no tiene replacement: hueco de capacidad → decisión del owner)*
```

> Nota: la fila `EGO-FIND-60` del Backlog **ya estaba** en ✅ Completada por el
> `TrustBoundary` (Ola 1). Lo que la referencia al módulo retirado respaldaba
> era el *sub-conjunto* de detección de inyección; ese sub-conjunto es el hueco
> de capacidad del §7.4-3. No es una regresión (el módulo no lo llamaba nadie),
> pero conviene que el Backlog lo diga para que no se lea como "resuelto".

### 7.2 A5 (`docs/extractions/**` + `docs/review/**`) — el inventario de código muerto
A5 es el dueño de las fichas y de los backlogs: **le paso el diff de estado,
no lo aplico**.

**(a) `docs/review/README.md`** — el inventario de 20 módulos pasa de "20
pendientes" a:

| Estado | Módulos |
|---|---|
| ✅ **retirados (11)** | `EventNormalizer` (COUC-01) · `EventIngress` (COUC-02) · `SafeConfigMutation` (COUC-10) · `SyntheticRuntime` (COUC-14) · `SessionTimelineRewind` (HERM-14) · `DataContract` (CARP-01) · `UntrustedContentSanitizer` (CARP-04) · `SessionLifecycleLocks` (OCLW-05) · `TranscriptReadWindow` (OCLW-06) · `StructuredInput` (OCLW-12) · `getVersionHistory`/`getAtTimestamp` (DSEK-02) |
| 🚫 **NO retirado (1)** | `ZeroContextKernel` (HERM-18): **caller real** `tests/security/injection-boundaries.test.ts:38` (SEC-08.C) |
| ⏸️ **decisión de producto (2)** | `OpaqueId` (DSEK-03) · `SessionCheckpointPolicy` (DSEK-05) |

**(b) Las 7 fichas** — una fila por patrón, con el estado y la evidencia
(texto listo para pegar):

| Patrón | Ficha | Estado nuevo | Nota para la ficha |
|---|---|---|---|
| COUC-01 | `coucou.md` | 🚫 **Descartada (retirada)** | *"Retirado 2026-10-21 (A2-bis). El normalizador en el borde no tiene consumidor: `EventIngress` (COUC-02) era su único usuario y ambos se retiraron. El `EventBus` de Ego normaliza por tipos declarados (`packages/events/src/types.ts`), no por adaptador de upstream."* |
| COUC-02 | `coucou.md` | 🚫 **Descartada (retirada)** | *"Retirado 2026-10-21 (A2-bis): sin consumidor de producción."* |
| COUC-10 | `coucou.md` | 🚫 **Descartada (retirada)** | *"Retirado 2026-10-21 (A2-bis): el patrón de mutación segura **sí** está implementado, pero **inline** en `packages/integrations/src/mcp/McpClient.ts` (con rollback transaccional), no en un módulo propio. El módulo era código muerto."* |
| COUC-14 | `coucou.md` | 🚫 **Descartada (retirada)** | *"Retirado 2026-10-21 (A2-bis): el runtime sintético no tiene consumidor."* |
| HERM-14 | `hermes-agent.md` | 🚫 **Descartada (retirada)** | *"Retirado 2026-10-21 (A2-bis): el rewind de timeline no tiene consumidor; la versión de registros la cubre `supersedeFact` + `versions`."* |
| HERM-18 | `hermes-agent.md` | 🟡 **Asimilado y cableado** (cambia de "código muerto" a "vivo") | *"**NO retirado**: tiene caller real en `tests/security/injection-boundaries.test.ts` (SEC-08.C — escapes del sandbox `node:vm`). A3 lo endureció (FIX VULN-SEC-08-01). Queda pendiente decidir si se cablea en producción (§5.4 del handoff A2-bis)."* |
| CARP-01 | `career-ops.md` | 🚫 **Descartada (retirada)** | *"Retirado 2026-10-21 (A2-bis): la separación usuario/sistema no la usa nadie; el isolamento real de Ego es el `TrustBoundary` de taint (ADR-0019) + `scanEgoPut` (`@ego/security`)."* |
| CARP-04 | `career-ops.md` | 🚫 **Descartada (retirada)** — ⚠️ **con hueco de capacidad** | *"Retirado 2026-10-21 (A2-bis): era código muerto, **pero** era el **único** detector de inyección de prompt de Ego (patrones EN/ES + neutralización de tags de control). Su retirada **no cambia el comportamiento** (nadie lo llamaba) pero deja el hueco: decisión de producto → §5.4 del handoff A2-bis."* |
| OCLW-05 | `openclaw.md` | 🚫 **Descartada (retirada)** | *"Retirado 2026-10-21 (A2-bis): los locks de ciclo de vida de sesión no tienen consumidor; la exclusión mutua real la da el motor (un solo handle por store, `VANTADB_BUSY`)."* |
| OCLW-06 | `openclaw.md` | 🚫 **Descartada (retirada)** | *"Retirado 2026-10-21 (A2-bis): la ventana de lectura de transcripción no tiene consumidor; la paginación con cursor real la cubre `listPaged()`/`getDb()` (F2T6/H04)."* |
| OCLW-12 | `openclaw.md` | 🚫 **Descartada (retirada)** | *"Retirado 2026-10-21 (A2-bis): la normalización de entrada estructurada no tiene consumidor; el `ToolExecutionLoop` valida los argumentos por su propio contrato."* |
| DSEK-02 | `deepseek-harness.md` | 🚫 **Descartada (retirada)** | *"Retirado 2026-10-21 (A2-bis): `getVersionHistory`/`getAtTimestamp` (árbol de versiones + time-travel) no tienen consumidor; la versión de un registro la expone el binding (`versions`/`getVersion`)."* |
| DSEK-03 | `deepseek-harness.md` | ⏸️ **decisión de producto** | *"No retirado: los `sessionId` en producción son cadenas libres (`apps/desktop/src/ipc/schema.ts:712`), luego el patrón no está aplicado. Decidir: retirar o cablear (§5.4 del handoff A2-bis)."* |
| DSEK-05 | `deepseek-harness.md` | ⏸️ **decisión de producto** | *"No retirado, por la misma razón que DSEK-03."* |

**(c) Los agregados**: `docs/extractions/README.md` §4.1 y
`docs/review/README.md` (§"código muerto") cambian los recuentos. El número
exacto lo recalcula `scripts/sync-extraction-indexes.mjs` (que es de A7) a
partir del `CATALOG` — **A5/A7, por favor, no lo escribo a mano**: mi cambio
afecta al **estado de 13 filas**, no al `CATALOG`.

### 7.3 A4 (`apps/desktop/**`) — tres cosas

**(a) El cast del router desaparece** (era el punto que A1 propuso):
`apps/desktop/src/main.ts:613` y `:636`:

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
```

(los dos sitios; el `BudgetRouter` importado en `main.ts:31` queda sin uso →
**A4 lo borra del import**).

**(b) La fuente "id de modelo → configuración"**: `main.ts:620-621` hoy hace

```ts
    resolveModelConfig: (modelId) =>
      modelId === currentModelConfig.modelName ? currentModelConfig : undefined,
```

Con `packages/models` ya hay la pieza que faltaba (A4 §7.1 lo pedía):

```ts
    // El desktop persiste UNA configuración de modelo activa; para un id
    // degradado hay que resolver su provider y construir su config.
    // `resolveModelDescriptor` devuelve el descriptor del registro (o uno
    // dinámico si el id no está, con el provider resuelto por
    // `attributeModelId`).
    resolveModelConfig: async (modelId) => {
      if (modelId === currentModelConfig.modelName) return currentModelConfig;
      const descriptor = await modelRouter.resolveModelDescriptor(modelId, {
        providerId: attributeModelId(modelId) ?? undefined,
      });
      if (!descriptor) return undefined;   // fail-closed: el guard DETIENE
      return buildModelConfigFor(descriptor);   // ← A4 decide la forma
    },
```

⚠️ La **forma** de `buildModelConfigFor` la decide A4 (es `ModelConfig` del
desktop). Lo que A2-bis entrega es el **descriptor** (provider + capacidades +
coste) y el **atribuidor** de provider.

**(c) Dos literals de UI que quedan obsoletos** (no son imports, pero son
visibles):

```diff
--- a/apps/desktop/renderer/components/mcp/McpManagerModal.tsx
-  description="Nivel B MCP + Skills ┬╖ Local Sovereign Runtime ┬╖ SafeConfigMutation (COUC-10)"
+  description="Nivel B MCP + Skills ┬╖ Local Sovereign Runtime ┬╖ mutación de config con rollback"
@@
-  <span>SafeConfigMutation (COUC-10)</span>
+  <span>Mutación de config con rollback transaccional</span>
--- a/apps/desktop/renderer/components/canvas/WorkbenchView.tsx
-  { name: "SessionLifecycleLocks.ts", path: "packages/memory/src/SessionLifecycleLocks.ts", type: "file" },
```

(el segundo es un literal de demo que además apuntaba a una ruta que nunca
existió: `packages/memory/src/…` en vez de `packages/memory/…`).

### 7.4 Owner — 3 decisiones de producto

**(1) `OpaqueId` (DSEK-03) y `SessionCheckpointPolicy` (DSEK-05): ¿retirar o cablear?**

- **No los he tocado** (lo pidió así el encargo).
- El estado real: `OpaqueId` (`generateOpaqueId`/`parseOpaqueId`/`isOpaqueId`)
  sólo lo usa `SessionCheckpointPolicy`, que a su vez sólo lo usan sus **propios
  tests**. En producción, los `sessionId` son **cadenas libres**
  (`apps/desktop/src/ipc/schema.ts:712`).
- Opciones: (a) **retirar** ambos (y sus 3 tests) → −2 módulos muertos;
  (b) **cablear**: `SessionCheckpointPolicy` crea snapshots de sesión
  periódicamente (fail-closed) y `OpaqueId` da ids opacos canónicos. El
  cableado toca `apps/desktop` (punto de invocación) ⇒ **no lo decido yo**.
- **Recomendación**: (a) **retirar**, salvo que el owner quiera la
  durability fail-closed de sesión como capacidad (entonces (b), con el
  `beforeModelStream` ya diseñado en `SessionCheckpointPolicy`).

**(2) `ZeroContextKernel` (HERM-18): ¿se cablea en producción?**

- Estado real: sandbox endurecido (worker + `node:vm` sin intrínsecos), con
  **caller real sólo en la suite de seguridad** (`tests/security/
  injection-boundaries.test.ts`, SEC-08.C). Cero uso en `apps/desktop`.
- Opciones: (a) mantenerlo como **componente de test de seguridad** (y
  documentarlo así, para que no se lea como código muerto por unknowing);
  (b) **cablearlo** como ejecutor de tools programáticas (el patrón de Hermes
  que evita gastar turnos) — es una capacidad de producto real, con su coste
  (un worker por invocación).
- **Recomendación**: (a) por ahora, con la decisión (b) anotada en el
  Backlog como capacidad candidata.

**(3) ⚠️ Hueco de capacidad tras retirar `UntrustedContentSanitizer` (CARP-04)**

- Hecho: `UntrustedContentSanitizer` era el **único** módulo de Ego con
  (i) detección de inyección de prompt (13 patrones EN/ES, con normalización
  anti-obfuscación: zero-width, bidi, espacios internos) y (ii) neutralización
  de tags de control (`<system>`, `<prompt>`, `<tool_call>`, …). **No lo
  llamaba nadie** ⇒ retirarlo **no cambia el comportamiento**.
- Pero: `scanEgoPut` (`@ego/security`) sólo detecta **secretos**, y
  `SensitiveNamespaces` sólo **namespaces sensibles**. El `TrustBoundary`
  (ADR-0019) marca el contenido externo y lo mete en `<data_channel>`, pero
  **no** neutraliza tags ni detecta patrones.
- Decisión: (a) **cablear** el patrón de CARP-04 en el borde de escritura
  (`scanEgoPut` → quarantine + marca `untrusted`), o (b) **aceptar** la brecha
  y documentarla. **No lo decido yo**: es política de seguridad.

### 7.5 Dueño de `packages/integrations/**` — comentarios que quedaron obsoletos

`SafeConfigMutation` se retiró, pero `packages/integrations` (fuera de mi
zona) menciona el módulo en comentarios y en una cadena de log:

```text
packages/integrations/src/mcp/McpClient.ts:97   * - Compuerta COUC-10: SafeConfigMutation y recarga at├│mica con rollback transaccional.
packages/integrations/src/mcp/McpClient.ts:217  * Mutaci├│n y recarga segura de configuraci├│n (COUC-10 - SafeConfigMutation).
packages/integrations/src/mcp/McpClient.ts:243  `SafeConfigMutation rollback aplicado: fallo al recargar servidor MCP: ${…
packages/integrations/src/mcp/McpManager.ts:85   * Aplica SafeConfigMutation (COUC-10): desconexi├│n at├│mica de la versi├│n previa si exist├¡a.
```

El **patrón** sigue implementado ahí (inline), pero el nombre del módulo ya no
existe. Sugerencia: renombrar la referencia a *"mutación segura de config
(patrón COUC-10)"*.

---

## 8. Ficheros tocados

**Nuevos**
- `packages/memory/CognitivePath.ts` (puente de alcance + contratos + normalizadores)
- `packages/memory/test/query-vector-workaround.test.ts`
- `packages/memory/test/memory-recall-trust.test.ts`
- `packages/memory/test/dead-code-retired.test.ts`
- `packages/models/test/budget-router-contract.test.ts`
- `packages/events/test/dead-code-retired.test.ts`
- `packages/execution/test/dead-code-retired.test.ts`
- `packages/runtime/test/dead-code-retired.test.ts`
- `docs/adr/0023-path-cognitivo-nativo.md`
- `docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A2bis.md` (este)

**Modificados**
- `packages/models/src/ModelRouter.ts` (T1) · `packages/models/src/ModelCatalog.ts` (T1) · `packages/models/src/types.ts` (comentario obsoleto)
- `packages/runtime/src/TrustBoundary.ts` (T2) · `packages/runtime/test/TrustBoundary.test.ts` (T2)
- `packages/memory/EgoMemoryAdapter.ts` (T2 + T3 + T5) · `packages/memory/index.ts` (T5) · `packages/memory/test/contract-vantadb.test.ts` (T3)
- `packages/knowledge/src/HybridSearch.ts`, `packages/knowledge/src/similarity.ts`, `packages/knowledge/src/schemas/knowledge.ts` (T3, docstrings)
- `packages/events/src/index.ts`, `packages/events/test/EventBus.test.ts` (T5)
- `packages/execution/src/index.ts` (T5) · `packages/runtime/src/index.ts` (T5)

**Borrados (11 módulos + 2 métodos + 8 ficheros de test)**
- `packages/events/src/{EventNormalizer,EventIngress}.ts` · `packages/events/test/EventIngress.test.ts`
- `packages/execution/src/SafeConfigMutation.ts` · `packages/execution/test/SafeConfigMutation.test.ts`
- `packages/runtime/src/{SyntheticRuntime,StructuredInput}.ts` · `packages/runtime/test/{SyntheticRuntime,StructuredInput}.test.ts`
- `packages/memory/{SessionTimelineRewind,DataContract,UntrustedContentSanitizer,SessionLifecycleLocks,TranscriptReadWindow}.ts`
- `packages/memory/test/{SessionTimelineRewind,data-contract-and-sanitizer,untrusted-sanitizer-hardening,SessionLifecycleLocks,TranscriptReadWindow,version-tree}.test.ts`
- `packages/memory/EgoMemoryAdapter.ts`: `getVersionHistory`, `getAtTimestamp` y la interfaz `VersionNode`.

**No tocado (fuera de zona)**: `apps/**`, `docs/**` (salvo `docs/adr/0023-*` y
este handoff), raíz, `scripts/**`, `packages/{subegos,tools,recovery,tasks,ui-runtime,integrations,domains,dailystate}/**`.

---

## 9. RESULTADO

```text
RESULTADO: {
  agente: A2-bis,
  status: COMPLETO,
  scope: "Ola 5 — T1 (router: presupuesto + degradación) + T2 (memoryRecall con TrustBoundary) + T3 (retirar el workaround query_vector) + T4 (ADR-0023) + T5 (retirar código muerto)",
  archivos_modificados: [
    "packages/models/src/{ModelRouter,ModelCatalog,types}.ts",
    "packages/models/test/budget-router-contract.test.ts",
    "packages/runtime/src/{TrustBoundary,index}.ts",
    "packages/runtime/test/{TrustBoundary.test.ts,dead-code-retired.test.ts}",
    "packages/memory/{CognitivePath.ts,EgoMemoryAdapter.ts,index.ts}",
    "packages/memory/test/{query-vector-workaround,memory-recall-trust,dead-code-retired}.test.ts",
    "packages/memory/test/contract-vantadb.test.ts",
    "packages/knowledge/src/{HybridSearch.ts,similarity.ts,schemas/knowledge.ts}",
    "packages/events/src/index.ts",
    "packages/events/test/{EventBus.test.ts,dead-code-retired.test.ts}",
    "packages/execution/src/index.ts",
    "packages/execution/test/dead-code-retired.test.ts",
    "docs/adr/0023-path-cognitivo-nativo.md",
    "docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A2bis.md"
  ],
  archivos_borrados: [
    "packages/events/src/{EventNormalizer.ts,EventIngress.ts}",
    "packages/events/test/EventIngress.test.ts",
    "packages/execution/src/SafeConfigMutation.ts",
    "packages/execution/test/SafeConfigMutation.test.ts",
    "packages/runtime/src/{SyntheticRuntime.ts,StructuredInput.ts}",
    "packages/runtime/test/{SyntheticRuntime.test.ts,StructuredInput.test.ts}",
    "packages/memory/{SessionTimelineRewind.ts,DataContract.ts,UntrustedContentSanitizer.ts,SessionLifecycleLocks.ts,TranscriptReadWindow.ts}",
    "packages/memory/test/{SessionTimelineRewind.test.ts,data-contract-and-sanitizer.test.ts,untrusted-sanitizer-hardening.test.ts,SessionLifecycleLocks.test.ts,TranscriptReadWindow.test.ts,version-tree.test.ts}"
  ],
  hallazgos_resueltos: [
    "T1: `ModelRouter.getMaxCostPerCallUsd()` + `resolveCheaperModel()` — el tope efectivo del circuit breaker de Sub-Ego pasa a ser el MÍNIMO(Sub-Ego, router) y la degradación a modelo más barato DEGRADA DE VERDAD (verificado con el `SubEgoBudgetCircuitBreaker` real) o DETIENE con `SubEgoBudgetCircuitBreakerError`",
    "T1: la selección de candidatos se EXTRAE (`findCheaperCandidate`), no se duplica; `enforceCostBudget` conserva su métrica de coste (le pasa las opciones reales)",
    "T1: fuente 'id de modelo → configuración' (`resolveModelDescriptor`/`getModelDescriptor`/`listModelDescriptors` + `ModelCatalog.attributeModelId`) — desbloquea el requisito de A4 §7.1",
    "T2: `memoryRecall({trust_aware:true})` cableado en `EgoMemoryAdapter` + puente de alcance (`packages/memory/CognitivePath.ts`) + `trustedAllowPrefixes`/`isTrustedNamespace`/`selectTrustedForInjection` en el `TrustBoundary` — verificado contra el motor real (reordenamiento compuesto + ACL que EXCLUYE la memoria no confiable y reporta la denegación)",
    "T2: cableadas también `contextAssemble`, `memoryConsolidate` y `memoryReinforce` (fail-soft), con `graphragSearch` ya existente",
    "T3: retirado el workaround `query_vector: []` (VDB-REQ-02) del código y de los docstrings; el fast path SIGUE siendo BM25 (VDB-REQ-10 persiste) — lo que se retira es el workaround, no la limitación",
    "T3: el guard de VDB-BUG-05 SE CONSERVA (con el motivo corregido): medido que `text_query: ''` LANZA y que `query_vector: []` también (exige array no vacío)",
    "T4: ADR-0023 escrito con las 3 vías MEDIDAS; se recomienda (iii) HybridRuntime con (i) upstream como destino; (ii) descartada por `VANTADB_BUSY` medido + duplicación de ~800 líneas del SDK",
    "T4: `VDB-REQ-14` cuantificado: Ego abre 1 store en producción → 320,03 MB de DISCO y ≈0,45 MB de RAM por store (el pico de ~19 GB es de la suite de tests)",
    "T4: `VDB-REQ-16` (b) RESUELTA (los 3 paquetes resuelven vantadb@0.9.0) y (a) PERSISTE con puente de alcance en Ego",
    "T5: 11 módulos muertos + `getVersionHistory`/`getAtTimestamp` retirados, cada uno con un guard que impide que vuelvan a colarse por un `export *`",
    "T5: `ZeroContextKernel` NO retirado — caller real fuera de mi zona (`tests/security/injection-boundaries.test.ts`, SEC-08.C)",
    "T5: hueco de capacidad detectado al retirar `UntrustedContentSanitizer` (era el único detector de inyección de prompt de Ego) → escalado al owner"
  ],
  verify: {
    tests: "110 ficheros / 0 fallos en la zona (memory 21 · knowledge 22 · runtime 17 · models 11 · decision 12 · execution 10 · events 8 · security 8 · tool-call-repair 1); @ego/desktop 66 ficheros sin regresión; tests/security/injection-boundaries 1/1",
    typecheck: "exit 0 (`pnpm -r typecheck` global)",
    lint: "exit 0 (`oxlint` + typecheck)",
    vantadb_ids: "exit 0 (`node scripts/verify-vantadb-ids.mjs`: 939 ficheros · 84 referencias · 0 errores · 2 avisos W2 preexistentes upstream)",
    tdd_rojos_demostrados: [
      "T1 → 8/10 fallos (`router.resolveCheaperModel is not a function`, breaker 'stop' en vez de 'degrade')",
      "T2 runtime → 6/12 fallos (`selectTrustedForInjection is not a function`)",
      "T2 memory → 5/5 fallos (`broken.memoryRecall is not a function`)",
      "T3 → 2/4 fallos (`query_vector` presente en la petición)",
      "T5 events → 2/2 · execution → 1/2 · memory → 7/9 · runtime → 2/3 fallos (el barrel aún exportaba los módulos retirados)"
    ]
  },
  fuera_de_zona: [
    "A1: fila del 0023 en docs/adr/README.md + 4 estados en docs/VANTADB-FEEDBACK-Y-MEJORAS.md (VDB-REQ-02/14/15/16) + nota en el ADR-0020 (§7.1)",
    "A5: inventario de código muerto (11 retirados / 1 no-retirado / 2 al owner) + 13 filas de las 7 fichas (§7.2)",
    "A4: quitar el cast `as unknown as BudgetRouter` (main.ts:613 y :636) + usar `resolveModelDescriptor`/`attributeModelId` para el `resolveModelConfig` + 2 literals de UI obsoletos (§7.3)",
    "Owner: `OpaqueId`/`SessionCheckpointPolicy` (retirar vs cablear) · `ZeroContextKernel` (test de seguridad vs producción) · hueco de detección de inyección de prompt tras retirar CARP-04 (§7.4)",
    "Dueño de packages/integrations: 4 referencias a `SafeConfigMutation` (comentarios + log) que quedan obsoletas (§7.5)"
  ],
  debt: [
    "VDB-REQ-16 (a): la fachada `vantadb@0.9.0` no re-expone las APIs cognitivas — upstream, es el destino del puente HybridRuntime",
    "VDB-REQ-14: 320,03 MB de disco por store (1 store en producción) — upstream",
    "VDB-REQ-10: el fast path sigue siendo BM25 léxico (no hay embeddings ni RRF real)",
    "E2 (Fase 06): el call site que arma el contexto cognitivo (quién llama a `memoryRecall` con los prefijos del `TrustBoundary`) sigue pendiente — es la última pieza de T2",
    "Un flake no reproducible en `packages/models` (1 fallo en 1 de 6 corridas; 5/6 en verde, 11/11 en las 4 repeticiones)"
  ]
}
```
