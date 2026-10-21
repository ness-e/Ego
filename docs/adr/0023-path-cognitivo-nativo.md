# ADR 0023: Path cognitivo nativo — el motor de VantaDB es el que decide, con un puente de alcance explícito

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-21 |
| Estado | Aceptado |
| Nivel jerárquico | 4.Architecture (`docs/jerarquia-canonica.md`) |
| Decisor | Owner · recomendación técnica y redacción A2-bis · **verificado y publicado por A1** (Ola 6) |

## Contexto

Ego necesita un **path cognitivo nativo**: que el motor de VantaDB decida qué
recuerdos entran en el contexto, con re-rank por confianza, compactación
nativa del historial y consolidación de sesión. Es la capacidad **E2** de la
Fase 06.

El motor **ya tiene** esa capacidad. El binding `vantadb-node@0.9.0` expone
cinco APIs cognitivas:

| API | Qué hace | Evidencia |
|---|---|---|
| `graphragSearch(namespace, query?, queryVector?)` | Pipeline GraphRAG nativo | `vantadb-node@0.9.0/index.d.ts:603` |
| `memoryRecall(options)` | Recall de L1 con re-rank compuesto por confianza | `index.d.ts:614` |
| `contextAssemble(options)` | Compactación pura de un historial bajo un presupuesto de tokens | `index.d.ts:622` |
| `memoryConsolidate(options)` | Consolidación LLM-free de una sesión | `index.d.ts:629` |
| `memoryReinforce(hit, outcome)` | Refuerzo de un recuerdo recuperado | `index.d.ts:636` |

Y el motor de **recall por confianza** (`memoryRecall({trust_aware: true})`)
es el re-rank compuesto de MEMG-21 (`vanta-memory/src/core/record/scoring.rs`):
`composite = 0,5·relevancia_norm + 0,3·recencia + 0,2·importancia`, con
normalización min-max sobre el conjunto de candidatos. La **importancia** es el
`priority` del registro (0-100); `priority < 0` (instrucción global estricta)
vale `1,0`.

### 1. El obstáculo: la fachada no re-expone las APIs cognitivas

El producto importa la **fachada** `vantadb@0.9.0` (`vantadb/native`), no el
binding. Y la fachada declara una **lista fija** de métodos, sin `Proxy` ni
passthrough dinámico:

```js
// vantadb@0.9.0/dist/native.js:153-158
static async connect(path = ":memory:", options) {
  const { VantaDb } = await import("vantadb-node");
  const inner = await VantaDb.connect(path, options ?? undefined);
  return new NativeVantaDB(inner);   // ← el binding queda dentro de la fachada
}
```

**Medido sobre el árbol instalado (2026-10-21, sonda sobre
`packages/memory/node_modules`):**

| Vía de acceso | `memoryRecall` | `contextAssemble` | `memoryConsolidate` | `memoryReinforce` |
|---|---|---|---|---|
| Fachada `vantadb/native` (`NativeVantaDB`) | ❌ `undefined` | ❌ `undefined` | ❌ `undefined` | ❌ `undefined` |
| Binding `vantadb-node` (`VantaDb`) | ✅ `function` | ✅ `function` | ✅ `function` | ✅ `function` |
| `db.inner` (el handle que la fachada ya abrió) | ✅ `function` | ✅ `function` | ✅ `function` | ✅ `function` |

La tercera fila es la clave: la fachada **conserva** el handle nativo que ella
misma abrió. En el JS compilado `inner` es un campo público (`private` sólo
en el `.d.ts`), y `db.inner.constructor.name === "VantaDb"`.

Esto es la parte (a) de **`VDB-REQ-16`**. La parte (b) —la resolución del
paquete `vantadb` fuera de `packages/memory`— **ya está resuelta**: medido hoy,
`packages/memory`, `apps/desktop` y `tests` resuelven **todos** `vantadb@0.9.0`
(el enlace local materializado; el global `0.6.1` sigue existiendo en
`C:\Users\Eros\node_modules\vantadb` pero ya no es la ruta de resolución).

### 2. La puerta de invariantes ya está VERDE

El [ADR-0020](0020-compactacion-motor-ts-vs-nativo.md) condicionaba el uso
del motor nativo a una **puerta de invariantes**: el `contextAssemble()`
nativo debe preservar el system prompt y no partir ningún par
`tool_call`/`tool_result`. Verificado empíricamente contra el binding
(`docs/adr/0020-compactacion-motor-ts-vs-nativo.md` §2.1): *system preservado =
true*, *pares tool preservados = true*. La petición upstream correspondiente
(`VDB-REQ-13`) está **RESUELTA** y no se escribe ninguna nueva.

Lo que quedaba abierto era el **alcance**, no la calidad del motor.

## Alternativas consideradas

Las tres vías se evaluaron **con medición**, no con suposición.

### (i) Que la fachada `vantadb` re-exponga las APIs cognitivas — *upstream*

- **Qué**: VantaDB publica una versión donde `NativeVantaDB` delega
  `memoryRecall`, `contextAssemble`, `memoryConsolidate` y `memoryReinforce`
  al binding, con la misma firma y la misma semántica.
- **Ventaja**: es la vía **correcta**. `vantadb/native` pasa a ser un espejo
  completo de `vantadb-node`; Ego deja de depender de un detalle de
  implementación del SDK; no hay código de puente en Ego.
- **Coste**: **no depende de Ego**. Bloquea E2 hasta que VantaDB publique.
- **Estado**: registrada como `VDB-REQ-16` (a) en
  `docs/VANTADB-FEEDBACK-Y-MEJORAS.md`. Es el **destino** de la decisión.

### (ii) Importar el binding directo (`vantadb-node`) para esas llamadas

- **Qué**: Ego abre su propio handle con `VantaDb.connect(path)` y llama a
  las APIs cognitivas por ahí.
- **Medido — BLOQUEA en el mismo proceso**: abrir un segundo handle sobre el
  mismo path responde
  `VANTADB_BUSY: Database busy: database at <path> is already open in this
  process (writer); close the existing handle before reopening`
  (medido dos veces: binding-contra-binding y binding-contra-fachada).
  El motor **no admite dos escritores** sobre el mismo store en un proceso.
- **Consecuencia 1**: para usar (ii) Ego tendría que **sustituir** la fachada
  en `EgoMemoryAdapter` y reimplementar su capa: normalización de metadatos
  (`guards.js`), mapeo de registros (`_mapRecord`), envoltura canónica de
  errores (`wrapNativeError`, los 10 códigos `VANTADB_*`), `searchMulti` con
  comodines, `versions`/`getVersion`, el grafo (`insertNode`/`addEdge`/BFS/DFS/
  shortest path/…), `explainSearch`, `similarToKey`, `count`, `deleteByFilter`,
  `compact*`, `rebuildIndex`, `metricsPrometheus`. Son ~800 líneas del SDK
  (`vantadb@0.9.0/dist/native.js`) que habría que **duplicar y mantener** en
  Ego: una divergencia silenciosa entre la fachada y el binding sería un
  fallo de datos, no un fallo visible.
- **Consecuencia 2**: abrir el store en **otro proceso** (p. ej. el subproceso
  `vantadb-mcp`) es posible, pero cambia el canal: el recall deja de ser una
  llamada en proceso a un mensaje MCP, y `memoryReinforce` (que cierra el
  bucle de refuerzo sobre un `hit` concreto) deja de poder **llegar** al mismo
  handle que escribió el recuerdo.
- **Consecuencia 3 (coste)**: un handle por proceso multiplica la
  pre-reserva de 320 MB (§"Deuda cuantificada").

### (iii) HybridRuntime — alcanzar el binding por la fachada que ya lo tiene

- **Qué**: la fachada resuelve primero por su **API pública** (si upstream la
  re-expone → (i) gana sola) y, si no, cae al handle nativo que **ya está
  abierto** (`db.inner`). Cero handles extra, cero procesos extra, cero
  duplicación de la capa del SDK.
- **Medido**: `db.inner` es alcanzable en runtime, es un `VantaDb` y trae las
  4 APIs. `db.inner.memoryRecall({...})` devuelve un resultado real
  (`{prepend_context, recalled_memories, governance, …}`); con la ACL de
  inyección activa, `governance.denied` enumera los namespaces denegados.
- **Coste**: un detalle de implementación del SDK (`inner` es `private` en el
  `.d.ts`). Se encapsula en **una función** (`resolveCognitiveBinding`) en un
  **único fichero** (`packages/memory/CognitivePath.ts`), con *capability
  probe* y degradación a `null` si el método no está.

## Decisión

1. **El motor de VantaDB es el que decide el path cognitivo.** Ego cablea las
   cinco APIs: `graphragSearch` (ya cableado en `EgoMemoryAdapter.graphRagSearch`),
   `memoryRecall`, `contextAssemble`, `memoryConsolidate` y `memoryReinforce`
   (nuevas, en `EgoMemoryAdapter`, con los contratos en
   `packages/memory/CognitivePath.ts`).
2. **El puente de alcance es (iii) HybridRuntime, y (i) es su destino.**
   `resolveCognitiveBinding()` intenta **primero** la API pública de la
   fachada; sólo si no está, usa el handle nativo que la fachada ya tiene
   abierto. Cuando VantaDB re-exponga los métodos (vía (i)), el puente deja de
   tocar `inner` **solo**: no cambia ninguna llamada de Ego.
3. **La vía (ii) queda descartada**: es imposible en el mismo proceso
   (`VANTADB_BUSY`, medido) y, en otro proceso, obligaría a duplicar ~800
   líneas del SDK y a cambiar el canal de `memoryReinforce`.
4. **El puente es fail-soft**: si el método no está disponible, el recall
   devuelve `null` y registra el aviso; el turno continúa. Nunca se lanza.
5. **El motor TS de compactación sigue siendo canónico** (ADR-0020 no se
   modifica): el nativo queda **disponible y cableado**, pero su sustitución
   del motor TS es una decisión posterior que este ADR no toma. La puerta de
   invariantes está verde, así que el cableado es seguro; la **activación** del
   nativo como motor canónico requiere un ADR nuevo.
6. **La confianza la decide Ego, no el motor.** El motor sólo conoce
   *namespaces*; el `TrustBoundary` (ADR-0019) conoce la **procedencia**. El
   cableado es: `trustedAllowPrefixes(provenance)` → `allow_prefixes` (ACL
   gruesa del motor) y `selectTrustedForInjection(memories, provenance)` →
   puerta fina de inyección (fail-closed). Se midió por qué hace falta: sin
   la ACL, el motor **promueve** el recuerdo no confiable por su
   `importance` (100) por delante de los de confianza.

## Deuda cuantificada: la pre-reserva de 320 MB por store (`VDB-REQ-14`)

Medido sobre `vantadb@0.9.0` (2026-10-21):

| Magnitud | Valor medido |
|---|---|
| Tamaño de un store **vacío** en disco | **320,03 MB** (`0.jnl` 64 MB + 4 × `vstore_L*.vanta` 64 MB) |
| Coste en **RAM** de abrir un store (Δ RSS, 3 mediciones) | **0,39 / 0,50 / 0,53 MB** → **≈ 0,45 MB** |
| Tiempo de `connect()` | 348–379 ms |
| Parámetros de `ConnectOptions` | `read_only`, `memory_limit` (**la pre-reserva no es parametrizable**) |

**La pre-reserva es de DISCO, no de RAM**: los segmentos `vstore_L*.vanta` son
ficheros pre-asignados (file-backed); el resident set que aporta abrir un
store es de ~0,45 MB. Lo que se paga por adelantado es **espacio en disco**.

**Cuántos stores abre Ego a la vez:**

| Contexto | Stores abiertos | Coste en disco | Coste en RAM |
|---|---|---|---|
| **Producción** (desktop) | **1** — `join(userDataDir, "ego_memory.vdb")`, `apps/desktop/src/main/window/create-window.ts:187-189` | **320,03 MB** | **≈ 0,45 MB** |
| Producto, con el camino (ii) (2 handles) | 2 (imposible: `VANTADB_BUSY`) | 640 MB | ≈ 0,9 MB |
| Suite de tests (cada test abre el suyo) | N en paralelo | 320 MB × N | ≈ 0,45 MB × N |

En todo el repo hay **un único** punto de apertura de store
(`packages/memory/EgoMemoryAdapter.ts:303`, `NativeVantaDB.connect`), y en
producción se instancia **un solo** `EgoMemoryAdapter`. El pico de ~19 GB que
menciona `VDB-REQ-14` es un artefacto de la **suite de tests** (cada fichero de
test abre su store), no del producto: en producción, el coste es **320 MB de
disco y ~0,45 MB de RAM**.

**Deuda cuantificada que queda asumida:** 320,03 MB de disco **por usuario**
pagados por adelantado aunque Ego no use búsqueda densa (el fast path es BM25
léxico: `VDB-REQ-10` persiste, no hay embeddings). El mitigated es upstream
(`VDB-REQ-14`): dimensionar la pre-reserva o abrir un modo `lazy` sin índice
vectorial. La mitigación **parcial** de Ego es mantener **un solo** store
abierto (lo que ya hace) — cualquier futuro store adicional (proyecto,
sub-egos, snapshots) multiplicaría los 320 MB por encima.

## Consecuencias

- Positivas:
  - E2 deja de estar bloqueada **por alcance**: el recall con confianza, la
    compactación nativa, la consolidación y el refuerzo son alcanzables desde
    el producto por la ruta real (`vantadb/native`).
  - `VDB-REQ-15` (re-rank con confianza) queda cableado y **verificado**
    contra el motor real, no contra un mock.
  - El puente queda encapsulado en una función: migrar a (i) es un cambio
    local, no una migración de producto.
  - La deuda de 320 MB queda **medida y atribuida**: 1 store en producción,
    320,03 MB de disco, ≈ 0,45 MB de RAM.
- Negativas:
  - Ego depende de un detalle de implementación del SDK (`inner`). Está
    encapsulado, es reversible y su ausencia degrada a `null` (fail-soft),
    pero es deuda que este ADR asume explícitamente.
  - La compactación nativa **no** sustituye todavía al motor TS: hay dos
    motores vivos (el TS canónico, el nativo cableado). La puerta de
    invariantes está verde, así que activarlo es seguro, pero es una
    decisión que este ADR **no** toma.
- Deuda asumida:
  - `VDB-REQ-16` (a) — la fachada debe re-exponer las APIs cognitivas: sigue
    **pendiente (upstream)**. Es el destino del puente.
  - `VDB-REQ-14` — la pre-reserva de 320 MB no es parametrizable: sigue
    **pendiente (upstream)**. Con 1 store en producción, el impacto es 320 MB
    de disco por instalación.
  - `VDB-REQ-10` — el fast path sigue siendo BM25 léxico: **no** hay RRF real
    ni MMR canónico; el path cognitivo **no** cambia este hecho.

## Referencias

- `packages/memory/CognitivePath.ts` — el puente de alcance (`resolveCognitiveBinding`), los contratos y los normalizadores.
- `packages/memory/EgoMemoryAdapter.ts` — `memoryRecall`, `contextAssemble`, `memoryConsolidate`, `memoryReinforce`, `graphRagSearch`.
- `packages/runtime/src/TrustBoundary.ts` — `trustedAllowPrefixes`, `isTrustedNamespace`, `selectTrustedForInjection`.
- `packages/memory/test/memory-recall-trust.test.ts` — el recall con confianza, verificado contra el motor real.
- `packages/runtime/test/TrustBoundary.test.ts` — las puertas de confianza (fail-closed).
- `apps/desktop/test/context-assemble-invariant.test.ts` — la puerta de invariantes y su guard.
- `docs/adr/0020-compactacion-motor-ts-vs-nativo.md` — el motor TS canónico y la puerta de invariantes (verde).
- `docs/adr/0019-canal-dual-taint-tracking.md` — el `TrustBoundary` de taint.
- `vantadb-node@0.9.0` `index.d.ts:603,614,622,629,636` — las cinco APIs cognitivas.
- `vantadb@0.9.0` `dist/native.d.ts:103` + `dist/native.js:153-158` — la fachada que no re-expone y el handle que conserva.
- `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` — `VDB-REQ-10` (PERSISTE), `VDB-REQ-13`
  (RESUELTO), `VDB-REQ-14` (PERSISTE), `VDB-REQ-15` (PARCIAL → cableado),
  `VDB-REQ-16` (PARCIAL: la parte (b) resuelta, la parte (a) pendiente).
- `vanta-memory/src/core/record/scoring.rs` — el re-rank compuesto (MEMG-21).
- `vanta-memory/src/core/hooks/auto_recall.rs` — la ACL de inyección y la clase de confianza por namespace.
