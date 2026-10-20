# Handoff A2 — Ola 1c — 2026-10-20

> Agente: A2 (núcleo cognitivo, 9 paquetes) · Zona: `packages/{memory,knowledge,runtime,models,decision,execution,events,security,tool-call-repair}/**`
> Nada fuera de la zona fue editado. `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` es de **A1** → §2 (texto completo de las 3 entradas, listo para pegar).

## 1. Cambios aplicados (ficheros propios)

### T1 — Renumeración de las referencias `VDB-*` de la zona (guardrail AGENTS.md §4)

| Fichero:línea | Antes | Ahora | Por qué |
|---|---|---|---|
| `packages/knowledge/src/schemas/knowledge.ts:66` | `TODO(EGO-FIND-41 / VDB-REQ-08)` | `Workaround upstream: VDB-REQ-10` | `VDB-REQ-08` = *cifrado en reposo*; el tema es canal denso/RRF |
| `packages/knowledge/src/HybridSearch.ts:18,40` | `VDB-REQ-08` (x2) | `VDB-REQ-10` (x2) | idem |
| `packages/knowledge/src/similarity.ts:10,12,74` | `VDB-REQ-08` (x3) | `VDB-REQ-10` (x3) | idem |
| `packages/knowledge/src/GraphRagEngine.ts:54,267` | `VDB-REQ-09` (x2) | `VDB-REQ-11` (x2) | `VDB-REQ-09` = *publicar el binding*; el tema es IQL/grafo no expuesto |
| `packages/knowledge/src/ProjectMemoryGraph.ts:102,116` | `VDB-REQ-10` (x2) | `VDB-REQ-12` (x2) | `VDB-REQ-10` no existia; el tema es la siembra del sustrato de grafo |
| `packages/memory/EgoMemoryAdapter.ts:679` | `VDB-REQ-08` | `VDB-REQ-10` | canal denso/RRF |
| `packages/memory/EgoMemoryAdapter.ts:1099,1123,1147,1180,1212` | `VDB-REQ-10` (x5) | `VDB-REQ-12` (x5) | siembra del sustrato de grafo |
| `packages/memory/EgoMemoryAdapter.ts:1208,1248` | `VDB-REQ-09` (x2) | `VDB-REQ-11` (x2) | IQL no expuesto |
| `packages/memory/GraphRag.ts:13,16` | (sin ID) | `VDB-REQ-11`, `VDB-REQ-12` | el modulo normaliza `graphragSearch` (DIST-15) => debe citar el workaround |
| `packages/knowledge/test/GraphSeeding.test.ts:5` | `VDB-REQ-10` | `VDB-REQ-12` | mismo tema |

**Forma canonica adoptada en todas** (la que el gate de A7 reconoce): `// Workaround: VDB-REQ-NN` o `// Workaround upstream: VDB-REQ-NN`, **seguida de una frase con el workaround concreto**, no el ID solo. Ejemplos:

- `packages/knowledge/src/HybridSearch.ts:18` — *"Workaround upstream: VDB-REQ-10 — el binding `vantadb-node@0.8.0` no expone embeddings en el fast path, asi que Ego no puede calcular un coseno denso real; el MMR usa coseno lexico (TF) como aproximacion."*
- `packages/memory/EgoMemoryAdapter.ts:1099` — *"Workaround: VDB-REQ-12 — el sustrato de grafo no se sembraba, de modo que la expansion nativa del GraphRAG devolvia `edges: []`."*
- `packages/memory/EgoMemoryAdapter.ts:1248` — *"Workaround upstream: VDB-REQ-11 — ausencia de `query`/IQL en el binding napi-rs 0.8.0: el descubrimiento de aristas del GraphRAG no puede consultarse con `graphQuery` y usa `graphragSearch()` / API de grafo."*

**Correccion de contenido obsoleto (misma revision)**: `packages/knowledge/src/GraphRagEngine.ts:54` afirmaba *"Ego **todavia no puebla** el sustrato de grafo"* — es **falso** desde la Ola 1b (se siembra con `linkGraphNodes` + `seedGraphEdges`). Sustituido por la descripcion real (fase nativa; si no hay aristas, fase 3) con la referencia a `VDB-REQ-12`.

### T2 — Texto de las 3 entradas del registro (para A1)

`docs/VANTADB-FEEDBACK-Y-MEJORAS.md` es de A1 -> **no editado por mi**. Texto completo en §2, listo para pegar (indice + seccion de detalle), con la forma que valida el gate de A7 (`scripts/verify-vantadb-ids.mjs`): fila de indice + seccion `### VDB-XXX-NN: Titulo` + bullets `Componente` / `Peticion` / `Situacion Actual` / `Evidencia en Ego` / `Impacto en Ego` / `Solucion recomendada en VantaDB` / `Estado`, y `archivo:linea` en el componente (W3).

### T3 — Barrido completo de la zona (informe en §3)

## 2. Solicitudes fuera de zona (NO aplicadas)

| # | Fichero | Cambio pedido | Motivo | Bloqueante |
|---|---|---|---|---|
| 1 | `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` | **Pegar las 3 entradas** (§2.1, §2.2, §2.3): filas de indice tras `VDB-REQ-09` (linea 37) + secciones de detalle al final del fichero | `docs/` es de A1. **Sin esto el gate de A7 falla con 23 errores E1/E2**: las referencias de mi zona son correctas, pero los IDs aun no estan registrados | — (A1) |
| 2 | `scripts/verify-vantadb-ids.mjs` (A7) | Ninguno: el gate funciona y detecto el problema correctamente. Tras A1 aplique §2, debe dar **0 errores**. Nota: el gate emite W2 ("ID Alta nunca citado") si una entrada Alta no se cita; mis 3 entradas si se citan | — (A7, informativo) |
| 3 | `docs/architecture/memoria-vantadb.md` (A1) | Anadir una nota de que el RRF real (canal denso) es requisito upstream `VDB-REQ-10` y que la unica politica de red vive en `@ego/security` (`ssrfPolicy.ts`) | Coherencia documental con el registro | — (A1) |
| 4 | `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` (A1) | **Bug preexistente del registro (2 filas de indice que faltan)** (§2.4): `VDB-INC-04` y `VDB-BUG-06` tienen seccion de detalle pero **NO** fila de indice ⇒ el gate falla con **2 errores E3** aunque A1 registre mis 3 IDs | Hallazgo descubierto al simular el gate con mis 3 entradas; es independiente de mi zona (no lo puedo arreglar: `docs/` es de A1) | — (A1) |

### 2.4 Filas de indice que faltan en el registro (para A1, §2.4) — **bloquean el gate**

Simule el gate de A7 (`scripts/verify-vantadb-ids.mjs --root <copia temporal>`) con un registro temporal que incluye mis 3 entradas propuestas. Resultado: **22 IDs registrados · 2 errores · 44 avisos**, y los 2 errores son **E3 preexistentes** (no de mis entradas):

```markdown
| `VDB-INC-04` | Inconsistencia | Media | Fjall LSM / `delete` + `vanta-vector` / HNSW | Borrado fisico no garantizado: tras `delete` los datos dejan de listarse pero permanecen recuperables a nivel disco (tombstone) hasta un vacuum con purga que no existe |
| `VDB-BUG-06` | Bug / Limitacion | Media | `vantadb/dist/native.js` (import dinamico del binding) | El entry productivo del paquete `vantadb` resuelve `vantadb-node` declarado solo como devDependency: en instalaciones limpias o empaquetados estrictos la resolucion es fragil |
```

Con esas 2 filas mas mis 3 entradas (§2.1-§2.3), el gate queda en **0 errores**. Mis 3 entradas no generan **ningun** aviso (ni W1 de anclaje tematico, ni W3 de evidencia, ni W4 de estado, ni W5 de secciones minimas): el texto esta redactado con los terminos significativos que el gate cruza contra los comentarios del codigo.

### 2.1 Entrada `VDB-REQ-10` (para A1) — Canal denso (embeddings) + RRF real

**Fila de indice** (insertar tras la linea 37, la de `VDB-REQ-09`):

```markdown
| `VDB-REQ-10` | Peticion de Mejora | Alta | `vantadb-node` (fast path / embeddings) | Ausencia de embeddings en el fast path: el binding no expone vectores densos por hit, la busqueda es BM25 lexico puro (`query_vector: []`) y no hay fusion RRF real |
```

**Seccion de detalle** (anadir al final del fichero, antes del cierre):

```markdown
### `VDB-REQ-10`: Canal denso (embeddings) y fusion RRF real ausentes en el fast path
* **Componente:** `vantadb-node` (bindings NAPI-RS) — motor de busqueda hibrida · evidencia en Ego: `packages/memory/EgoMemoryAdapter.ts:679`, `packages/knowledge/src/HybridSearch.ts:18`
* **Peticion:** Exponer en el binding NAPI-RS el vector denso de la consulta (ONNX `multilingual-e5-small`, 384d, ya disponible en `vanta-memory` / `vantadb-mcp`) o los scores coseno por hit, de modo que el fast path pueda ejecutar la fusion RRF (BM25 + denso) y devolver una lista vectorial real.
* **Situacion Actual:** `vantadb-node@0.8.0` **si implementa** RRF en el motor (`SearchExplanationHit.rrf_text_rank` / `rrf_vector_rank`, `HybridFusionReport.rrf_k`, `text_candidates`, `vector_candidates`, `fused_candidates`), pero solo se activa cuando la busqueda incluye un `query_vector` denso. El fast path napi-rs que usa Ego es **BM25 lexico puro** (`query_vector: []`, workaround `VDB-REQ-02`), de modo que el RRF nunca llega a ejecutarse y la busqueda es mono-lista.
* **Evidencia en Ego:** `packages/memory/EgoMemoryAdapter.ts:679` (docstring de `searchMulti`: "Sin RRF y sin lista vectorial"), `packages/knowledge/src/HybridSearch.ts:18` y `:40` (re-rank mono-lista, MMR con coseno lexico), `packages/knowledge/src/similarity.ts:12` (interfaz `SimilarityProvider` como sustituto del coseno denso), `packages/knowledge/src/schemas/knowledge.ts:66`.
* **Impacto en Ego:** la recuperacion de conocimiento de Ego (`KB-04` `HybridSearch`, `KB-06` `GraphRagEngine`) es puramente lexaica: no puede responder por significado sino por coincidencia de terminos, el MMR tiene que aproximar la similitud densa con coseno lexico, y el ahorro de la busqueda hibrida real (y del prompt caching de contexto) no se materializa.
* **Solucion recomendada en VantaDB:** exponer en el binding NAPI-RS una via para obtener el embedding denso de la consulta (o un `search_multi` que calcule el vector en el engine con ONNX y fusione por RRF), de modo que `query_vector` deje de ser un placeholder vacio y `HybridFusionReport` se pueble.
* **Estado:** Abierto (upstream). Workaround en Ego: `query_vector: []` (`VDB-REQ-02`) + MMR con coseno lexico (`packages/knowledge/src/similarity.ts`).
```

### 2.2 Entrada `VDB-REQ-11` (para A1) — Grafo/IQL nativo no expuesto

**Fila de indice** (tras `VDB-REQ-10`):

```markdown
| `VDB-REQ-11` | Peticion de Mejora | Media | `vantadb-node` (grafo / IQL) | El binding no expone el motor IQL (`query`) ni un `graphragSearch` con alcance multi-namespace: el descubrimiento de aristas del GraphRAG es heuristico (metadata + regex) |
```

**Seccion de detalle**:

```markdown
### `VDB-REQ-11`: Motor IQL y grafo nativo no expuestos por el binding
* **Componente:** `vantadb-node` (bindings NAPI-RS) — motor de grafo e IQL · evidencia en Ego: `packages/memory/EgoMemoryAdapter.ts:1208`, `packages/knowledge/src/GraphRagEngine.ts:54`
* **Peticion:** Exponer en el binding NAPI-RS el motor IQL (metodo `query`) y/o ampliar `graphragSearch` para aceptar varios namespaces de semilla, de modo que el descubrimiento de vecinos del grafo se pueda consultar de forma nativa y no inferirse heuristicamente desde el contenido.
* **Situacion Actual:** la superficie publica de `NativeVantaDB@0.8.0` **no incluye** ningun metodo `query` (IQL): `EgoMemoryAdapter.graphQuery()` es un *capability probe* que siempre devuelve `{ ok: false }`. Si existen `insertNode`, `getNode`, `addEdge`, `graphBfs`, `graphDfs`, `graphDegree` y `graphragSearch` (DIST-15), pero `graphragSearch` acepta **un solo** namespace de semilla y `max_degree_per_node` no es configurable (ver `VDB-REQ-07`).
* **Evidencia en Ego:** `packages/memory/EgoMemoryAdapter.ts:1208` (docstring de `graphRagSearch`), `packages/memory/EgoMemoryAdapter.ts:1248` (docstring de `graphQuery`), `packages/memory/GraphRag.ts:13`, `packages/knowledge/src/GraphRagEngine.ts:54` y `:267` (fase 3: heuristica metadata `supersedes` / `doc_id` + regex `\b(doc_[a-f0-9]{8,16}|fact_[a-f0-9]{8,16})\b`).
* **Impacto en Ego:** la expansion multi-salto del GraphRAG de Ego (`KB-06`) no consulta el grafo real salvo en los subgrafos ya sembrados (ver `VDB-REQ-12`); el resto de las relaciones las infiere de menciones en el texto, con falsos positivos (cualquier cadena con forma `doc_<hex>`) y falsos negativos (relaciones que no aparecen literalmente en el contenido).
* **Solucion recomendada en VantaDB:** publicar el motor IQL en el binding NAPI-RS (o documentar formalmente que IQL no forma parte de la superficie Node) y permitir `graphragSearch` con una lista de namespaces de semilla.
* **Estado:** Abierto (upstream). Workaround en Ego: descubrimiento por `graphragSearch` + degradacion a heuristica metadata/regex (`packages/knowledge/src/GraphRagEngine.ts:271`).
```

### 2.3 Entrada `VDB-REQ-12` (para A1) — Sustrato de grafo `insertNode`/`addEdge`

**Fila de indice** (tras `VDB-REQ-11`):

```markdown
| `VDB-REQ-12` | Peticion de Mejora | Media | `vantadb-node` (grafo) / Ego `ProjectMemoryGraph` | El sustrato de grafo no se sembraba: sin `insertNode`/`addEdge` el GraphRAG nativo devolvia `edges: []` y la expansion multi-salto no consultaba el grafo real |
```

**Seccion de detalle**:

```markdown
### `VDB-REQ-12`: Sustrato de grafo (`insertNode`/`addEdge`) sin sembrar por parte de Ego
* **Componente:** `vantadb-node` (bindings NAPI-RS) — sustrato de grafo del pipeline `graphragSearch` (DIST-15) · evidencia en Ego: `packages/memory/EgoMemoryAdapter.ts:1099`, `packages/knowledge/src/ProjectMemoryGraph.ts:102`
* **Peticion:** Derivar automaticamente las aristas del grafo a partir de los registros KV (o exponer una API que lo haga), de modo que `graphragSearch` tenga relaciones que recorrer sin que el cliente las siembre una por una.
* **Situacion Actual:** `vantadb-node@0.8.0` **si expone** `insertNode`, `addEdge` y `getNode`, y el `node_id` de los registros KV (u128 decimal) coincide con el id de nodo del grafo, de modo que sembrar aristas es viable. El problema era de Ego: no se invocaba esa API, el grafo quedaba vacio y `graphragSearch` devolvia `edges: []` para todo subgrafo.
* **Evidencia en Ego:** `packages/memory/EgoMemoryAdapter.ts:1099`, `:1123`, `:1147`, `:1180`, `:1212` (delegaciones `getGraphNodeId` / `insertGraphNode` / `addGraphEdge` / `linkGraphNodes`), `packages/knowledge/src/ProjectMemoryGraph.ts:102` y `:116` (siembra de la cadena causal traza -> referencias por fichero, arista `derived_from`), `packages/knowledge/test/GraphSeeding.test.ts:5`.
* **Impacto en Ego:** sin el siembra, `KB-06` (`GraphRagEngine`) se degradaba siempre a la heuristica de metadatos y regex, y la subgraph de causalidad de ingenieria (`proj/traces` -> `proj/file_traces`) no era recorrible por el pipeline nativo.
* **Solucion recomendada en VantaDB:** derivar el grafo de los registros KV de forma nativa (o exponer `graphragSearch` con un modo "derivar aristas desde metadata"), de modo que el cliente no tenga que sembrar el grafo a mano.
* **Estado:** **Resuelto en Ego** (2026-10-20) con el workaround `EgoMemoryAdapter.linkGraphNodes` + `ProjectMemoryGraph.seedGraphEdges` (aristas `derived_from` de la cadena causal). **ID upstream equivalente**: `DIST-15` (pipeline GraphRAG nativo) y `MEMG-03` (grafo de memoria de proyecto); permanece abierta la peticion de derivacion automatica descrita arriba.
```

## 3. Barrido de la zona (T3)

Barrido recursivo de `packages/knowledge/**` y `packages/memory/**` (`Workaround` + `VDB-(BUG|INC|REQ)-\d+`), excluyendo `dist/` y `node_modules/`.

| ID referenciado | Registrado | Significado en el registro | Compatible con el comentario del codigo | Nota |
|---|---|---|---|---|
| `VDB-BUG-01` | Si | `cursor: undefined` rechazado por `list()` | Si | `EgoMemoryAdapter.ts:625`, `:1414` |
| `VDB-BUG-02` | Si | Metadata etiquetada (`Float`/`String`/`Bool`) | Si | `EgoMemoryAdapter.ts:479,563,604,637`, `unwrapMetadata.ts:1`, `BitemporalQueries.ts:39`, `cursorListing.ts:27`, `FactLifecycle.ts:30` |
| `VDB-BUG-04` | Si | Metadatos anidados rechazados por Serde | Si | `KnowledgeIndexer.ts:14,68,83` |
| `VDB-BUG-05` | Si | `text_query: ""` rechazado | Si | `EgoMemoryAdapter.ts:695,699` |
| `VDB-INC-01` | Si | Sin auto-embed ONNX en `put_one` | Si | `EgoMemoryAdapter.ts:325`, `EgoMemoryLifecycle.ts:266` |
| `VDB-INC-02` | Si | `flock`: exclusividad multi-proceso | Si | `PythonSidecarBridge.ts:39` |
| `VDB-INC-03` | Si | Descriptores invalidados tras `close()` | Si | `HybridSearch.ts:61`, `KnowledgeIndexer.ts:25` |
| `VDB-REQ-01` | Si | Comodines en `search_multi` | Si | `EgoMemoryAdapter.ts:707` |
| `VDB-REQ-02` | Si | `query_vector` obligatorio para BM25 | Si | `EgoMemoryAdapter.ts:674,737,774`, `HybridSearch.ts:14,37`, `similarity.ts:5` |
| `VDB-REQ-03` | Si | Normalizacion de puntuacion espanola en el tokenizador | Si | `EgoMemoryLifecycle.ts:155` |
| `VDB-REQ-06` | Si | Consultas bitemporales nativas (`AS OF`) | Si | `BitemporalQueries.ts:70` |
| `VDB-REQ-07` | Si | Poda de grado en la expansion de grafos | Si | `GraphRagEngine.ts:37,138`, `GraphRagEngine.test.ts:16` |
| `VDB-REQ-10` | **NO (pendiente A1)** | Canal denso (embeddings) + RRF real | Si | `HybridSearch.ts:18,40`, `similarity.ts:10,12,74`, `knowledge.ts:66`, `EgoMemoryAdapter.ts:679` |
| `VDB-REQ-11` | **NO (pendiente A1)** | Grafo/IQL nativo no expuesto | Si | `GraphRagEngine.ts:54,267`, `EgoMemoryAdapter.ts:1208,1248`, `GraphRag.ts:13` |
| `VDB-REQ-12` | **NO (pendiente A1)** | Sustrato de grafo `insertNode`/`addEdge` | Si | `ProjectMemoryGraph.ts:102,116`, `EgoMemoryAdapter.ts:1099,1123,1147,1180,1212`, `GraphRag.ts:16`, `GraphSeeding.test.ts:5` |

**Referencias a `VDB-REQ-08` / `VDB-REQ-09` en mi zona: 0** (verificado por `grep` sobre `packages/knowledge/**` y `packages/memory/**`, excluyendo `dist/`).

**Referencias a IDs inexistentes fuera de mi zona: 0.** Barrido repo-wide (`packages/`, `apps/`, `tests/`, `scripts/`, excluyendo `node_modules`/`dist`/`out`/`repos-referencia`): los unicos IDs no registrados que aparecen eran `VDB-REQ-10` (6 hits) **en mi zona**, ya corregidos. No hay referencias ajenas que hándar a A7.

**Estado del gate de A7** (`node scripts/verify-vantadb-ids.mjs`):
- Antes de esta ola: los 23 errores E1/E2 correspondian a `VDB-REQ-08`/`09` mal asignados y `VDB-REQ-10` inexistente.
- Ahora: **23 errores E1/E2, todos por los 3 IDs nuevos todavia no registrados** (las referencias ya son correctas). En cuanto A1 pegue §2.1-§2.3 **y** las 2 filas de §2.4, el gate debe dar **0 errores**.
- **Simulacion hecha** (copia temporal del arbol + registro con mis 3 entradas, sin tocar `docs/`): `22 IDs registrados · 2 error(es) · 44 aviso(s)`. Los 2 errores son **E3 preexistentes** (`VDB-INC-04` y `VDB-BUG-06`: tienen seccion de detalle pero no fila de indice) → §2.4. Mis 3 entradas no generan **ningun** aviso.
- El gate tambien emite avisos **W1** (anclaje tematico) preexistentes para `VDB-BUG-02` (6 sitios) y `VDB-INC-03` (1 sitio): el titulo/detail del registro ("Fallo de deserializacion IEEE-754 a `VantaValue::Int(i64)`") no comparte terminos con los comentarios de Ego (que hablan de "metadata etiquetada"). **No los he tocado** (el arreglo corresponde al detalle del registro, que es de A1); los menciono por si A1 quiere ajustarlos al normalizar las 19+3 entradas.

## 4. Verificacion

| Comando | Exit | Resumen |
|---|---|---|
| `pnpm --filter @ego/knowledge test` | 0 | 86 tests / 22 files |
| `pnpm --filter @ego/memory test` | 0 | 153 tests / 24 files |
| `pnpm --filter @ego/knowledge typecheck` | 0 | sin errores |
| `pnpm --filter @ego/memory typecheck` | 0 | sin errores |
| `grep` `VDB-REQ-0[89]` en mi zona (sin `dist/`) | — | **0 coincidencias** |
| `node scripts/verify-vantadb-ids.mjs` | 1 | 23 errores, **todos** `VDB-REQ-10/11/12` (IDs nuevos aun no registrados por A1) · 0 errores por `VDB-REQ-08`/`09` |
| `node scripts/verify-vantadb-ids.mjs --root <copia temporal con mis 3 entradas>` | 1 | 22 IDs · **2 errores E3 preexistentes** (`VDB-INC-04`, `VDB-BUG-06` sin fila de indice → §2.4) · **0 errores de mis 3 entradas** · 0 avisos sobre mis entradas |

**Sin commits.** Sin `git checkout/reset/stash/clean`. Sin `pnpm install`. No se toco `packages/{tools,subegos,tasks,domains,dailystate,recovery,ui-runtime,integrations}/**` ni `docs/`.

## 5. Deuda / no resuelto

1. **El gate de A7 sigue en rojo (exit 1) hasta que A1 registre los 3 IDs.** Es la dependencia dura: mis referencias ya son correctas y coherentes con la asignacion, pero `AGENTS.md` §4 exige que el workaround este registrado. Texto listo para pegar en §2.1-§2.3.
2. **Los avisos W1 de `VDB-BUG-02` / `VDB-INC-03`** (7 sitios) son preexistentes: el detalle del registro describe el sintoma interno de VantaDB ("deserializacion IEEE-754") mientras los comentarios de Ego describen el workaround ("metadata etiquetada"). El arreglo es de A1 (normalizar el detalle del registro); no he tocado los comentarios de mi zona porque son correctos semanticamente.
3. **La documentacion canonica sigue diciendo cosas falsas** que la Ola 1 ya desmintio y que A1 deberia corregir: `docs/architecture/memoria-vantadb.md` §10 ("Ego no construye su propio algoritmo heuristico de poda de tokens en TypeScript" — es falso: existe `packages/runtime/src/ContextCompaction.ts`) y la linea de `AGENTS.md` que describe `packages/knowledge` como "busqueda hibrida RRF" (el fast path es BM25 puro; el RRF real es `VDB-REQ-10`).
4. **Sin cambios de comportamiento**: esta ola es 100% trazabilidad (comentarios y referencias). No hay test nuevo porque no cambia comportamiento; la verificacion es el gate de A7 + los tests existentes de la zona.

```
RESULTADO: {
  agente: A2-nucleo-ola1c,
  status: PARTIAL,
  archivos_modificados: [
    "packages/knowledge/src/schemas/knowledge.ts",
    "packages/knowledge/src/HybridSearch.ts",
    "packages/knowledge/src/similarity.ts",
    "packages/knowledge/src/GraphRagEngine.ts",
    "packages/knowledge/src/ProjectMemoryGraph.ts",
    "packages/knowledge/test/GraphSeeding.test.ts",
    "packages/memory/EgoMemoryAdapter.ts",
    "packages/memory/GraphRag.ts",
    "docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A2-ola1c.md"
  ],
  hallazgos_resueltos: [
    "16 referencias VDB-* de mi zona renumeradas segun la asignacion del orquestador",
    "0 referencias a VDB-REQ-08 / VDB-REQ-09 (significado incorrecto) en mi zona",
    "0 referencias a IDs inexistentes fuera de mi zona (no hay nada que hándar a A7)",
    "contenido obsoleto corregido: GraphRagEngine.ts:54 afirmaba que Ego no sembraba el grafo"
  ],
  bloqueos: [
    "El gate scripts/verify-vantadb-ids.mjs sigue en exit 1 (23 errores E1/E2) hasta que A1 registre VDB-REQ-10, VDB-REQ-11 y VDB-REQ-12. Texto completo en §2.1-§2.3 de este handoff.",
    "Ademas, aunque A1 registre mis 3 entradas, el gate seguira en exit 1 por 2 errores E3 PREEXISTENTES (VDB-INC-04 y VDB-BUG-06 tienen seccion de detalle pero no fila de indice). Filas propuestas en §2.4."
  ],
  verify: { typecheck: "exit 0 en @ego/knowledge y @ego/memory", tests: "knowledge 86 passed, memory 153 passed, 0 failed",
    gate_vantadb: "exit 1 con 23 errores, todos por los 3 IDs nuevos pendientes de A1 (0 errores por IDs mal asignados); con las 3 entradas simuladas: 22 IDs, 2 errores E3 preexistentes, 0 errores y 0 avisos sobre mis entradas" },
  solicitudes_handoff: 4,
  deuda_abierta: [
    "A1: registrar VDB-REQ-10 / VDB-REQ-11 / VDB-REQ-12 (desbloquea el gate de A7)",
    "A1: corregir docs/architecture/memoria-vantadb.md §10 y la linea de AGENTS.md sobre RRF",
    "A1: normalizar los detalles de VDB-BUG-02 / VDB-INC-03 para silenciar los avisos W1"
  ],
  SKILLS_CARGADAS: ["test-driven-development", "source-driven-development", "code-review-and-quality", "documentation-and-adrs"]
}
```
