# Handoff A1 (Ola 4) — 2026-07-21 — Verificación empírica del binding 0.9.0 + registro de VantaDB

> **Agente:** A1 (documentación canónica, ADRs, Backlog, informes)
> **Ola:** 4 — T1 (reclasificación empírica de los 23 hallazgos de VantaDB) · T2
> (ADR-0022 de E4 + decisión de paleta `warning`) · T3 (inventario E2E + cierre de
> la Ola 3 en el VERDICT).
> **Plan:** `docs/agent-ops/plans/2026-10-19-remediation-wave1/A1-docs.md` (continuación)
> **Zona:** `docs/**` salvo `docs/review/**`, `docs/extractions/**`,
> `docs/research/**` (A5) y `docs/adr/0022-*.md` (A2) · `AGENTS.md` · `CHANGELOG.md`.
> **Sin commits. Sin `git checkout/reset/stash/clean`. Sin `pnpm install`.**
> **No he tocado `packages/**` ni `apps/**`** — he leído sus ficheros **solo** para
> medir la evidencia que cito y para calcular los diffs exactos que pido.

---

## 1. T1 — El registro de VantaDB, verificado contra el binding real

`docs/VANTADB-FEEDBACK-Y-MEJORAS.md`: **533 → 786 líneas**, 23 → **25 hallazgos**.

### 1.1 Tabla de verificaciones aplicada

| ID | Verificado | Evidencia empírica (2026-10-21, `vantadb-node@0.9.0`) |
|---|---|---|
| `VDB-BUG-01` | ✅ RESUELTO | `list(ns,{limit:10,cursor:undefined})` → 1 registro, `next_cursor=null` |
| `VDB-BUG-02` | 🟡 PARCIAL | Entero 2^53+1 vuelve como `<object>`: ya no hay pérdida f64, pero Ego sigue necesitando `unwrapMetadata` |
| `VDB-BUG-03` | ❓ sin verificar | Bloqueo residual de descriptores en Windows (fuera de ronda) |
| `VDB-BUG-04` | ❌ PERSISTE | `put` con metadata anidada de 7 niveles → *«unknown variant `b`…»*: `VantaValue` es unión **plana** |
| `VDB-BUG-05` | ✅ RESUELTO | `search({text_query:""})` → 0 hits, sin excepción |
| `VDB-BUG-06` | ❓ sin verificar | `dist/native.js` resuelve `vantadb-node` como devDependency (fuera de ronda) |
| `VDB-INC-01` | ❌ PERSISTE | `capabilities().embedding` sin `embed-local`; `provider=undefined` → no hay embeddings locales |
| `VDB-INC-02` | ❓ sin verificar | Exclusión mutua de proceso (`flock`) (fuera de ronda) |
| `VDB-INC-03` | ✅ RESUELTO | `get()` tras `close()` **lanza** «database is closing» |
| `VDB-INC-04` | ✅ RESUELTO | `delete` → `get`=null **Y** `search`=0 hits → tombstones no legibles |
| `VDB-REQ-01` | ❓ sin verificar | Petición de mejora al motor (fuera de ronda) |
| `VDB-REQ-02` | ✅ RESUELTO | `searchMulti(ns,{query_vector:[]})` → 2 hits; la API **documenta** el vector vacío para sólo-texto |
| `VDB-REQ-03`…`08` | ❓ sin verificar | Peticiones de mejora al motor (fuera de ronda) |
| `VDB-REQ-09` | ✅ RESUELTO | **`vantadb-node@0.9.0` publicado en npm** (Apache-2.0; win32/darwin/linux; x64+arm64; firmas + `sha512`) |
| `VDB-REQ-10` | ❌ PERSISTE | Sin método `embed`; `vector_search=true` pero el fast path sigue BM25 léxico |
| `VDB-REQ-11` | 🟡 PARCIAL | `query` ausente en el binding de Node, PERO `iql_queries=true`, 6 algoritmos de grafo y `vantadb-ts` expone `system.query(query)` |
| `VDB-REQ-12` | 🟡 PARCIAL | `insertNode`/`addEdge` aceptados, pero `graphragSearch` devuelve 0 nodos / 0 aristas |
| `VDB-REQ-13` | ✅ RESUELTO | `contextAssemble({messages,token_budget:500})` → **system preservado** y **pares tool preservados** ⇒ **la puerta del ADR-0020 está VERDE** |
| **`VDB-REQ-14`** (nuevo) | ❌ PERSISTE | **320 MB de pre-reserva por store** (4×`vstore_L*.vanta` de 64 MB + `0.jnl`); store vacío = **320,06 MB**; `ConnectOptions` = { `read_only`, `memory_limit` } ⇒ **no parametrizable** |
| **`VDB-REQ-15`** (nuevo) | 🟡 PARCIAL | `memoryRecall({trust_aware:true})` ofrece re-rank compuesto con confianza (S8/FIND-320, MEMG-21) → **disponible, sin cablear** |

**Recuento:** 25 hallazgos — **7 resueltos · 4 parciales · 4 persisten · 10 sin verificar**.

### 1.2 Lo que cambió en el fichero

- **Sección de síntesis nueva al principio**: tabla de veredictos + **3 conclusiones
  accionables** (0.9.0 publicado → `EGO-FIND-64`/`DIST-09` desbloqueados · la
  invariante del ADR-0020 verde → E2 desbloqueado · `VDB-REQ-14` es la petición
  más urgente) + la lista de workarounds retirables.
  *Los IDs van **sin backticks** en esa tabla a propósito: el gate toma cualquier
  fila `| \`VDB-XXX-NN\` |` como fila de índice y machacaría la entrada real.*
- **Fila duplicada `VDB-REQ-13` eliminada** del índice (aparecía 2 veces).
- **Columna nueva** «Estado verificado 2026-10-21» en el índice.
- **T-X2 cerrado**: las 15 entradas legacy normalizadas (todas tienen ya `Estado:`,
  `Impacto en Ego:` y `archivo:línea` en el `Componente`). Cada *Impacto* es una
  **afirmación comprobable** con `archivo:línea`, no relleno.
- **Detalle reescrito** en los 13 hallazgos cuyo veredicto cambió, con el
  **mensaje literal** del motor cuando aplica.
- **Estructura de listas normalizada** en las 25 entradas (blanco antes/después de
  cada heading y de cada valla) — de paso, el fichero **bajó** 62 violaciones de
  markdownlint respecto a la línea base.

### 1.3 El gate

`node scripts/verify-vantadb-ids.mjs` → **exit 0, 0 errores, 3 avisos** (antes:
0 errores, 24 avisos). Los 3 avisos son **W2** (`VDB-REQ-08`, `VDB-REQ-09`,
`VDB-REQ-14`): IDs de severidad Alta que nunca se citan en el código — es lo
correcto, son peticiones puramente upstream. Los avisos **W3/W4/W5 (21) están a 0**.

### 1.4 Una corroboración cruzada que da fuerza al hallazgo

**A3 llegó a `VDB-REQ-14` desde el lado de los tests** (T-X1, Ola 3), sin ver
mi verificación: *"el store de 320 MB NO es un residuo evitable de mis datos: es
la PREASIGNACIÓN del motor VantaDB. Un store son 64 MB de journal (`0.jnl`) + 4
segmentos `vstore_L*.vanta`"*, con **1 044 MB** retenidos por corrida. **Dos
equipos, dos caminos, el mismo número.** Lo he dejado anotado en la entrada.

---

## 2. T2 — ADR-0022 y la decisión de paleta `warning`

### 2.1 `docs/adr/0022-exportadores-de-artefactos.md` (nuevo)

Redactado con el texto técnico de A3 (`handoff/A3-ola3.md` §3), con la plantilla
canónica: contexto · **alternativas con licencias verificadas** (`pdfkit`, `jspdf`,
`pdf-lib`, `docx`, `exceljs`, `xlsx@0.18.5` —ya no se publica en npm, con CVEs—,
`pptxgenjs`, `jszip` —licencia dual MIT OR GPL-3.0—, `archiver`, `fflate`) ·
decisión (**cero dependencias** sobre `node:zlib`) · consecuencias · referencias.
Indexado en `docs/adr/README.md` (22 ADRs).

**El «REPL Python» es un REPL de expresiones en TypeScript** (`eval_expression`):
intérprete propio, **sin `eval`/`new Function`/`node:vm`/`child_process`**.

### 2.2 La decisión de paleta `warning` — documentada con medición

**Valor:** `warning` = `oklch(0.837 0.164 84.4)` en los 2 presets cuyo `brand` es el
ámbar (`default-dark`, `amber-warm`).

**Motivo:** los iconos de dominio se tiñen con tokens semánticos
(`components/domains/DomainSelector.tsx:26-32`): `engineering` → `text-brand` y
`product` → `text-warning`. Con `warning` = `brand`, **los dos iconos salían
idénticos** en esos 2 presets.

**Medición (cálculo determinista, el mismo método que §7 del design system):**

| Preset | `warning` vs bg | vs raised | ¿colisión con `brand`? |
|---|---|---|---|
| `default-dark` | **8.24:1** | **8.05:1** | antes **SÍ** · ahora no |
| `midnight-cyan` | 5.83:1 | 5.70:1 | no (su `brand` es cyan) |
| `emerald-terminal` | **8.24:1** | **8.06:1** | no |
| `amber-warm` | **8.24:1** | **8.05:1** | antes **SÍ** · ahora no |

El valor nuevo **además mejora el contraste** (8.24:1 frente a 5.83:1 del
anterior). Documentado en `docs/design/design-system.md` §2.4 (nuevo) y en
`AGENTS.md` §4, con la **regla** que sale de la decisión: *un token semántico no
puede coincidir con el `brand` de su preset si ambos se usan como color de icono
de dominio*.

### 2.3 El ADR del path cognitivo nativo — PENDIENTE

`docs/adr/0023-path-cognitivo-nativo.md` **NO se ha creado**: A2 aún no ha
entregado el texto (su handoff de la Ola 3 no está en el repo). Cuando A2 lo
entregue, lo redacto con la misma plantilla. **El 0023 queda reservado** para
que A2 no colisione con el 0022.

---

## 3. T3 — Lo que el otro agente dejó en `docs/`

### 3.1 `docs/dev/e2e-skip-inventory.md` — actualizado al estado REAL

**La premisa de la tarea no se cumple: el cierre de A2 no ha aterrizado.**
Medido el 2026-07-21:

| Métrica | Valor | Cómo |
|---|---|---|
| Ficheros de spec en `tests/gui/specs/` | **16** | barrido de `git ls-files` |
| Bloques `describe.skip` | **11** | recuento de `describe.skip(` por fichero |
| Ficheros sin skip | **5** | los que el gate marca con `WARN … sin skips` |
| `it.skip` / `.only` | **0** / **0** | recuento |
| Gate estático | **VERDE — 16 specs, 0 fallos** | `node tests/gui/scripts/check-gui-coverage.cjs` (exit 0) |

`git status --short -- tests/gui` está **vacío** (el árbol coincide con `HEAD`) y
**no existe** `handoff/A2-ola3.md`. Por tanto el inventario **no da por cerrado**
ningún skip: la tabla maestra de §2 sigue reflejando los 11 bloques de Clase B,
que es el estado real. Corregí además una imprecisión: la redacción anterior
decía «3 specs activos» y son **5 ficheros sin skip** (sólo 3 de ellos son bloques
`describe`; `01-arranque` y `10-a11y-tab` son `test()` sueltos).

### 3.2 `VERDICT.md` §7 — Ola 3 cerrada + plan de la Ola 4

- **§7.0 Ola 3 — cerrada**: E4 ✅ (A3, → ADR-0022) · E6-res ✅ (A4, `main.ts`
  1 288 → **866** líneas) · T-X1 ✅ (A3+A4, 1 044 MB por corrida) · T-X2 ✅ (A1,
  los 15 avisos W3/W4/W5 a 0) · `EGO-FIND-64` ✅ (el bloqueo upstream desaparece)
  · E2-bis/T-X3 🔄 en curso (A2).
- **§7.1 Ola 4 — plan** (18 ítems, orden canónico por la progresión de fases de
  `AGENTS.md` §6): entra **E2 desbloqueado**, **VDB-REQ-15** (capacidad que ya
  existe y falta cablear), **VDB-REQ-14** (la más urgente) y la **retirada de los
  3 workarounds**; y **`DIST-09` deja de ser un bloqueo de owner** (0.9.0
  publicado ⇒ es un cambio de manifiesto, no una decisión).

---

## 4. T1 (cont.) — Backlog y plan de preparación

- `docs/roadmap/Backlog.md`:
  - **`EGO-FIND-64` → ✅ Completada** (el paquete está publicado; el cambio de
    manifiesto lo aplica A7).
  - **`EGO-FIND-29` → 🟡 Parcial** con la evidencia: la **invariante del ADR-0020
    está VERDE** ⇒ E2 desbloqueado, pero las APIs nativas siguen sin cablearse.
  - **Nueva fila `EGO-FIND-87`** = `VDB-REQ-14` (petición upstream, 🔴 P0): 320 MB
    por store, no parametrizable, afecta al 100 % del estado persistente.
  - Estado: **77 ✅ · 3 🟡 · 7 🆕** (87 filas `EGO-FIND`).
- `docs/engineering/vantadb-readiness-plan.md`: cabecera con la versión
  (**0.9.0, PUBLICADO**), §2.1 con las 3 palancas, matriz de requisitos
  actualizada (5 filas nuevas: `COGN-02` verde, `VDB-REQ-09` resuelto,
  `VDB-REQ-14` persiste, `VDB-REQ-10` persiste, `VDB-INC-01` persiste,
  `VDB-REQ-11` parcial), §6 con el `404` tachado, §7 con la tabla de los 15
  verificados.

---

## 5. Solicitudes fuera de zona (NO aplicadas) — con diff exacto

### 5.1 A2 — retirar el workaround de `query_vector: []` (`VDB-REQ-02` RESUELTO)

> **Matiz importante antes de tocar nada:** el fast path **sigue siendo BM25
> léxico** (`VDB-REQ-10` PERSISTE: no hay método `embed`). Lo que se retira es
> **el workaround**, no la limitación. El texto de los docstrings debe seguir
> diciendo que no hay lista densa; lo que cambia es que ya **no hay que mandar
> `query_vector: []` para que la guarda lo acepte**.

**`packages/memory/EgoMemoryAdapter.ts`** (a) — líneas 737-739:

```diff
         return await db.search({
           namespace: ns,
           text_query: query,
-          // Workaround: VDB-REQ-02 (guards.js exige array aunque la búsqueda
-          // sea BM25 léxica pura en fast path): enviar `[]` explícito.
-          query_vector: [],
           top_k: topK,
           exclude_superseded: options.excludeSuperseded ?? true,
           min_confidence: options.minConfidence,
         });
```

(b) — líneas 774-775:

```diff
       const hits = await db.search({
         namespace,
         text_query: keyOrQuery,
-        // Workaround: VDB-REQ-02 (ver searchMulti): `[]` para BM25 léxica pura.
-        query_vector: [],
         top_k: 1,
         exclude_superseded: true,
       });
```

(c) — líneas 672-675 (docstring de `searchMulti`): cambiar la mención del
workaround por la limitación real, para que el docstring no afirme algo que ya
no es cierto:

```diff
-   * **Sin RRF y sin lista vectorial (EGO-FIND-41):** el fast path napi-rs
-   * opera en BM25 léxico puro (`query_vector: []` — workaround upstream
-   * `VDB-REQ-02`), de modo que no hay lista densa que fusionar ni score
+   * **Sin RRF y sin lista vectorial (EGO-FIND-41):** el fast path napi-rs
+   * opera en BM25 léxico puro (sin embeddings en el fast path —
+   * `VDB-REQ-10`), de modo que no hay lista densa que fusionar ni score
```

(d) — líneas 695-702: el guard de `VDB-BUG-05` **ya no es necesario**
(`text_query: ""` se acepta: 0 hits, sin excepción). **Retirarlo es OPCIONAL y
tiene un efecto de comportamiento** (hoy un barrido sin término devuelve `[]` con
log; con el guard retirado devuelve 0 hits sin log). Decisión de A2:

```diff
-    // Workaround: VDB-BUG-05 (guards.js evalúa text_query:"" como falsy y exige
-    // query_vector denso). Barridos sin término léxico deben usar list()/listPaged().
-    if (query.trim().length === 0) {
-      console.error(
-        `[EgoMemoryAdapter] searchMulti(${namespaces.join(",")}) rechazado: texto vacío (VDB-BUG-05); usar list()/listPaged() para barridos`
-      );
-      return [];
-    }
```

(e) —`packages/memory/test/contract-vantadb.test.ts:144`:

```diff
       const hits = await rawDb.search({
         namespace: ns,
         text_query: "cognitive operating system",
-        query_vector: [],
         top_k: 5,
       });
```

(f) — docstrings que citan el workaround (sólo texto):
`packages/knowledge/src/HybridSearch.ts:14` y `:37` ·
`packages/knowledge/src/similarity.ts:5` ·
`packages/knowledge/src/schemas/knowledge.ts:66`.

> **Nota de trazabilidad:** `VDB-REQ-02` es de severidad **Baja**, así que
> retirar sus citas del código **no genera** el aviso W2 (que sólo salta para
> severidad Alta/Crítica). Pero si se quiere conservar la señal, se puede dejar
> una línea que diga *"`VDB-REQ-02` RESUELTO en 0.9.0: la API documenta el
> vector vacío para búsqueda sólo-texto"*.

### 5.2 A2 — el ADR del path cognitivo nativo (`ADR-0023`)

Entregar el texto; lo redacto con la plantilla canónica. El **contenido ya
está verificado** por mí (la invariante del ADR-0020 es verde contra el binding
real), así que el ADR puede afirmarla con evidencia.

### 5.3 A2 — decidir el motor de compactación (ADR-0020, condición cumplida)

`ADR-0020` decía «híbrido **condicionado**»: el nativo se activaba *si* la
puerta de invariantes se cumplía. **Se ha cumplido** (system prompt y pares
`tool_call`/`tool_result` preservados). El nativo es, además, **función pura,
sin estado de motor, y funciona con la base de datos cerrándose** → candidato a
sustituir las **520 líneas** de `ContextCompaction` TS. La decisión es de A2; el
ADR-0020 necesita su actualización.

### 5.4 A7 — `vantadb-node@0.9.0` en los dos manifiestos

`apps/desktop/package.json:38` y `packages/memory/package.json:27` siguen en
`file:../../../VantaDB/vantadb-node`. Con 0.9.0 publicado, pasan a
`"vantadb-node": "0.9.0"` (o el tarball vendorizado). Cierra `EGO-FIND-64` y
`DIST-09` de verdad, y hace que CI ejercite el binding real.

### 5.5 A2/A3 — `VDB-REQ-15`: cablear la confianza en el recall

`memoryRecall({trust_aware:true})` **ya existe** en el motor. Falta el cableado
en Ego, y el `TrustBoundary` de taint (`ADR-0019`) es la pieza que ya está: la
puntuación de un recuerdo puede ponderarse por procedencia, de modo que el
contenido no confiable no suba por repetición de término.

### 5.6 VantaDB (upstream) — `VDB-REQ-14`: la petición más urgente

Ya está redactada con toda la evidencia. **No es una tarea de Ego**: es una
petición al motor (exponer el dimensionado de la pre-reserva, o un modo `lazy`
sin índice vectorial para stores sin búsqueda densa). Lo que **sí** es de Ego:
decidir cuántos stores abiertos hay a la vez (proyecto + sesiones + sub-egos).

### 5.7 Owner — el canal de obtención del token MCP (`EGO-FIND-81`)

Sin la decisión del canal (env `EGO_MCP_TOKEN` vs. fichero `0600` vs. ambos) no
se puede escribir la guía de `docs/user/`. Es la única petición de esta ola
bloqueada por el owner.

---

## 6. Verificación

| Comando | Exit | Resumen |
|---|---|---|
| `node scripts/verify-vantadb-ids.mjs` | **0** | **0 errores** · 3 avisos (W2 ×3, todos upstream) · 25 IDs · 838 ficheros. Los 21 avisos W3/W4/W5 del Ola 2 están a **0**. |
| `node docs/testing/check-docs-paths.mjs` | **0** | 375 docs · **0 enlaces rotos** · **0 rutas inexistentes** en docs canónicos |
| `pnpm docs:build` | **0** | `build complete in 80.23s` |
| `node scripts/check-docs-lint.mjs` | **0** | **0 regresiones** · 7 069 violaciones en 336 ficheros (base: 7 131 → **−62**: el registro bajó 62) |
| Round-trip Ego→studio→Ego | — | **15/15 identidad, 0 LOSSY** (A6, Ola 3) |
| `node tests/gui/scripts/check-gui-coverage.cjs` | **0** | GATE GUI VERDE — 16 specs, 0 fallos estáticos |
| Estado del Backlog | — | **77 ✅ · 3 🟡 · 7 🆕** (87 filas `EGO-FIND`) |

---

## 7. Deuda / no resuelto

1. **El ADR del path cognitivo nativo (`0023`) no existe**: A2 no ha entregado el
   texto. Bloqueo: **A2** (no owner).
2. **El cierre de E2-bis/T-X3 (doc oficial de Anthropic) sigue en curso** (A2) y
   `EGO-FIND-80` sigue abierta. Bloqueo: **A2**.
3. **La retirada de los workarounds (`VDB-REQ-02`, `VDB-BUG-05`, `VDB-BUG-01`)**
   está calculada pero **no aplicada** (sección §5.1). Bloqueo: **A2**.
4. **El cambio de manifiesto a `vantadb-node@0.9.0`** está pendiente (§5.4).
   Bloqueo: **A7**.
5. **`VDB-REQ-14` (320 MB por store)** no tiene dueño en VantaDB todavía: es una
   **petición upstream** con el texto escrito (§5.6).
6. **El canal del token MCP (`EGO-FIND-81`)** sigue bloqueado por el **owner**.
7. **Los 11 `describe.skip` de la suite GUI no se han reactivado**: el cierre
   atribuido a A2 no ha aterrizado (§3.1). Bloqueo: **A2**.
8. **`DIST-04` (certificados de firma)** sigue bloqueado por el owner.

---

## 8. Nota de estado del árbol

Working tree sucio y compartido con A2–A8 — **esperado por contrato** (README §5.5).
**No he hecho ningún commit, ni `git checkout/reset/stash/clean`, ni `pnpm install`.**
No he tocado `packages/**` ni `apps/**`.

> **Ficheros de otros agentes que `git status` puede mostrar y no son míos:**
> `docs/research/**` (A5), `packages/tools/**` · `packages/subegos/**` · `packages/tasks/**` ·
> `packages/recovery/**` (A3), `apps/desktop/**` (A4), `packages/avatar/**` (A6),
> `scripts/**` · `.github/**` (A7), `packages/{memory,knowledge,runtime,...}/**` (A2).
