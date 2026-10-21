# ADR 0020: Compactación de contexto — `ContextCompaction` canónico, nativo condicionado #

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-20 · **pregunta corregida 2026-10-21** (Ola 5, T1) |
| Estado | Aceptado (condicional: la vía nativa queda **activada** solo tras superar la puerta de invariantes **y** abrir el puente de alcance) |
| Nivel jerárquico | 4.Architecture (`docs/jerarquia-canonica.md`) |
| Decisor | Owner (Ola 1b, `EGO-FIND-21`) · recomendación técnica A2 · redacción A1 |

## Contexto ##

Ego necesita podar el historial de turnos sin que el prompt crezca sin cota.
Hoy existen **dos** motores posibles, y la documentación canónica hasta hace
poco describía **solo uno**, de forma incorrecta.

### 1. Motor propio de Ego (TypeScript) — `packages/runtime/src/ContextCompaction.ts` ###

- **742 líneas**, con `ContextCompaction.test.ts` (15 tests) y
  `ContextCompaction-unified.test.ts` (6 tests).
- `compact()` y `compactSync()` comparten el **motor único**
  (`planCompaction()` → head / dropped / tail, `applySummary()`,
  `extractSummary()`).
- Aporta lo que el nativo **no** tiene:
  - **Preserva el system prompt** inicial (`protected_prefix`).
  - **Preserva los pares assistant `tool_call` / `tool_result` intactos**.
  - **Resumidor LLM inyectable** (`SummarizerFn`), con el adaptador real
    `createRouterSummarizer(router, opts)` sobre el `ModelRouter`
    (`packages/models/src/routerSummarizer.ts`, que también exporta
    `renderCompactionTranscript`).
  - **Fallback heurístico determinista** cuando no hay resumidor.
  - **Archivado** del tramo podado en `kb/history_archive` (`autoMemory`,
    `CompactionArchiveTarget`/`CompactionArchiveRecord`).
- **Cableado y en producción**: `apps/desktop/src/main.ts:1965` instancia el
  job, `main.ts:1731` llama a `compact()` y `main.ts:1737` le pasa el
  `compactionSummarizer` (`main.ts:1995` lo construye con `createRouterSummarizer`).

### 2. Motor nativo del binding — `contextAssemble(options)` ###

- El **binding** `vantadb-node@0.9.0` expone `contextAssemble(options): Promise<any>`
  con `{ messages, token_budget, protected_prefix?, compaction_ratio?, min_keep? }` y la
  **heurística `chars/3`** (`TokenEstimator::default`; `precise-tokens` es opt-in).
  Verificado en `vantadb-node@0.9.0/index.d.ts`: `:622 contextAssemble`, `:614
  memoryRecall`, `:629 memoryConsolidate`, `:636 memoryReinforce`.
- Es una **función pura** del engine: determinista, **sin estado**, y
  funciona incluso mientras la base de datos se cierra.

> **Corrección de nombre (importante).** La Ola 1c existió precisamente para
> cazar referencias mal asignadas. El método nativo de compactación de
> historial **se llama `contextAssemble()`**, no `compact()`. El binding sí
> tiene `compactLayout()` (compacta el *vector store* HNSW) y `compactWal()`
> (compacta el WAL), que son **otra cosa**. Confundirlos rompería la
> trazabilidad justo cuando se quiere arreglarla.

#### 2.1 Corrección de la Ola 5: el motor existe; lo que estaba roto era el **alcance**

> **2026-10-21 (A1, Ola 5 T1).** Una lectura de la Ola 4 (A4, T4.2) concluyó que
> *"el método no existe"* y que *"el ADR-0020 presupone algo falso"*. **La
> conclusión no era correcta**, y este ADR se corrige para que no se propague.
> Lo verifiqué contra el árbol instalado, capa por capa:

| Capa | ¿Expone `contextAssemble`? | Evidencia |
|---|---|---|
| **`vantadb-node@0.9.0`** (binding napi-rs) | **SÍ** — y las 5 APIs cognitivas más | `vantadb-node@0.9.0/index.d.ts:614,622,629,636` |
| **`vantadb@0.9.0`** (wrapper TS, `vantadb/native`) | **NO** — lista fija de métodos, **sin passthrough** | `vantadb@0.9.0/dist/native.d.ts:103` + `dist/native.js:157` |
| **`vantadb@0.6.1`** (global, fuera del repo) | **NO** — y además **no tiene `vantadb-node`** | `C:\Users\Eros\node_modules\vantadb` (importaría `VANTADB_NOT_FOUND: Node not found: 7`) |

**Y la resolución escapaba del repo** (medido, y **corregido el 2026-07-21 por A7**):

| Quién importa `vantadb` | Antes | Ahora |
|---|---|---|
| `packages/memory` | `node_modules/.pnpm/vantadb@0.9.0` ✅ | lo mismo ✅ |
| `apps/desktop` | **no lo declaraba** → global `vantadb@0.6.1` ❌ | `vantadb@0.9.0` ✅ (resolución ascendente) |
| `tests` | **no lo declaraba** → global `vantadb@0.6.1` ❌ | `vantadb@0.9.0` ✅ (resolución ascendente) |

> **La corrección (A7, Ola 5):** la **raíz** del workspace declara `"vantadb":
> "0.9.0"` y `"vantadb-node": "0.9.0"` (`package.json:70-71`), de modo que por
> **resolución ascendente** los 20 miembros resuelven la versión **del repo** (y no
> el `node_modules` global del usuario). Y hay **puerta** para que esto no se
> repita: `scripts/verify-vantadb-resolution.mjs` (`vantadb:check`, bloqueante en
> CI y dentro de `verify:all`) verifica la resolución desde **todos** los
> miembros del workspace. **Sin esa puerta, un agente podía volver a concluir
> —con una medición aparentemente válida— que el motor no tenía una API.**

**Por tanto la premisa de este ADR era correcta y su consecuencia no.** El
binding expone `contextAssemble()` y **la invariante se cumple** (el system
prompt y los pares `tool_call`/`tool_result` se preservan: puerta **VERDE**,
verificada empíricamente contra el binding). Lo que estaba roto eran **dos
puentes de alcance**, no el motor:

1. **La fachada de `vantadb@0.9.0` no re-expone** los métodos cognitivos del
   binding (`contextAssemble`, `memoryRecall`, `memoryConsolidate`,
   `memoryReinforce`): su `NativeVantaDB` es una clase con métodos explícitos y
   **sin `Proxy` ni passthrough**, así que el producto **no puede** llamar al
   nativo por `vantadb/native` aunque el binding lo tenga.
2. **La resolución se rompe fuera de `packages/memory`**: `apps/desktop` y
   `tests` caen al **global `0.6.1`**, que no tiene ni las APIs ni el binding.

Registrado como **`VDB-REQ-16`** en el registro canónico de VantaDB (con la
mitigación aplicada y la puerta `vantadb:check`).

### 3. Lo que la documentación decía (falso) ###

`docs/architecture/memoria-vantadb.md` §10 afirmaba: *"Ego no construye su
propio algoritmo heurístico de poda de tokens en TypeScript; consume el Context
Engine de VantaDB"*. Es **falso**: Ego sí construye ese algoritmo
(`ContextCompaction.ts`) y además el binding lo expone. Corregido en la Ola 1b.

## Alternativas consideradas ##

1. **Adoptar `contextAssemble()` nativo y dejar el motor TS como fallback
   offline** (o eliminarlo).
   - Ventaja: una sola implementación; el doc canónico deja de ser ambiguo.
   - Coste: se pierden el resumen LLM de alta fidelidad, el archivado y las
     invariantes de system prompt y pares tool — hay que reconstruirlas encima.
2. **Mantener `ContextCompaction` como motor de Ego** y documentar el nativo
   como disponibilidad futura.
   - Ventaja: conserva todas las invariantes sin trabajo.
   - Coste: persiste la ambigüedad documental (dos motores, una fuente de
     verdad que elegir).
3. **Híbrido (elegida)**: `ContextCompaction` decide **cuándo** compactar y
   **con qué invariantes**; el `contextAssemble()` nativo hace el recorte
   mecánico cuando el presupuesto es holgado, y el resumen LLM cuando no lo es.
   - Condición: el nativo **no se usa** hasta que supere la puerta de
     invariantes (§"Decisión", punto 3).

## Decisión ##

1. **El motor canónico de compactación de Ego es `ContextCompaction`
   (TypeScript).** Es el único que preserva system prompt, pares tool,
   resumen LLM y archivado, y es el único cableado en producción.
2. **El `contextAssemble()` nativo se documenta como vía disponible**, no
   como sustituto inmediato.
3. **Puerta de invariantes (condición de activación) — VERDE, y una segunda
   condición sigue abierta.** El nativo solo se activa cuando supere los tests
   de invariantes de `ContextCompaction` (system prompt preservado + pares
   `tool_call`/`tool_result` intactos). **Estado 2026-10-21: la puerta se
   superó** — verificado empíricamente contra `vantadb-node@0.9.0`: *system
   preservado = true* y *pares tool preservados = true*. Por tanto **ya no cabe
   hablar de una petición upstream al motor por las invariantes** (se cerró como
   `VDB-REQ-13` RESUELTO).
   **La segunda condición es de alcance, no de calidad:** el nativo solo se
   activa cuando el producto **pueda alcanzarlo**, es decir cuando (a) el
   wrapper `vantadb` exponga los métodos cognitivos del binding y (b) la
   resolución de `vantadb` sea la misma en todo el repo (hoy `apps/desktop` y
   `tests` caen al global `0.6.1`). Eso es **`VDB-REQ-16`** y está **en curso**
   (A7, raíz y `scripts/**`).
   Mientras no se abra ese puente, **el motor TS sigue siendo el único
   canónico y no hay ningún cambio de comportamiento**.
4. **Mientras la puerta no se supere, no hay cambio de comportamiento**: el
   cambio es puramente documental y de registro. El ADR se cierra cuando la
   puerta se evalúe, en la Ola 2 (E2). *(Actualizado 2026-10-21: la puerta **sí**
   se evaluó y está verde; lo que queda es el puente de alcance — punto 3.)*

## Consecuencias ##

- Positivas:
  - La documentación canónica deja de ser falsa en los dos extremos (§10 de
    `memoria-vantadb.md` reescrito en la Ola 1b).
  - El motor TS **no se toca** → cero riesgo de regresión en esta ola.
  - La petición upstream queda **registrada y trazable** (`VDB-REQ-13`), que
    es justamente lo que `AGENTS.md` §4 exige.
- Negativas:
  - Hay dos motores vivos; la "híbrida" es una **promesa condicionada**, no
    una capacidad entregada. El ADR lo dice explícitamente para que nadie la
    lea como implementada.
  - El motor TS (742 líneas) sigue siendo carga de mantenimiento de Ego.
- Deuda asumida:
  - ~~La evaluación de la puerta de invariantes (ejecutar `contextAssemble()`
    contra los tests de `ContextCompaction`) está **pendiente** → Ola 2 · E2.~~
    **Cerrada 2026-10-21: la puerta está VERDE** (verificada contra el binding).
  - **El puente de alcance** (que el producto pueda *llamar* al nativo) está
    **pendiente y en curso**: la fachada de `vantadb@0.9.0` no re-expone los
    métodos cognitivos, y `apps/desktop`/`tests` resuelven al global `0.6.1`.
    → `VDB-REQ-16` (A7). Hasta que se abra, E2 sigue sin arrancar **por
    alcance, no por calidad del motor**.
  - `packages/runtime/src/ContextCompaction.ts` es el motor con más superficie
    propia del lado de la memoria: cualquier reescritura del motor nativo
    obligará a revisar sus 21 tests.
- Riesgo: si el nativo resultara **superior** en calidad de poda y el TS
  quedara con las invariantes como único valor añadido, la decisión podría
    revisarse (ADR nuevo que sustituya a este, no edición de este).

## Referencias ##

- `packages/runtime/src/ContextCompaction.ts` — motor canónico (742 líneas).
- `packages/runtime/test/ContextCompaction.test.ts` (15 tests) · `packages/runtime/test/ContextCompaction-unified.test.ts` (6 tests) — invariantes.
- `packages/models/src/routerSummarizer.ts` — `createRouterSummarizer` / `renderCompactionTranscript`.
- `apps/desktop/src/main/window/create-window.ts:196` (instancia `ContextCompactionJob`) y `:226` (`createRouterSummarizer`) · `apps/desktop/src/main/llm/handle-llm-stream.ts:397`
  (`compact()`) y `:247` (`maybePreCompact`) — cableado actual *(las referencias `main.ts:1731,1737,1965,1995` de la versión de 2026-10-20 quedaron obsoletas al descomponer `main.ts`)*.
- `packages/memory/EgoMemoryLifecycle.ts:354` — `maybePreCompact` (archivado en `kb/history_archive`).
- `vantadb-node@0.9.0` `index.d.ts:622` — `contextAssemble(options)` (y `compactLayout()` / `compactWal()`, que son otra cosa).
- `vantadb@0.9.0` `dist/native.d.ts:103` + `dist/native.js:157` — la fachada que **no** re-expone los métodos cognitivos.
- `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` — `VDB-REQ-13` (petición upstream de las invariantes, **RESUELTO**) y `VDB-REQ-16` (resolución de `vantadb` fuera del repo).
- `apps/desktop/test/context-assemble-invariant.test.ts` — invariantes escritas y un guard que fallará el día que el método sea alcanzable por la ruta del producto.
- `docs/architecture/memoria-vantadb.md` §10 — contexto canónico corregido.
- `docs/adr/0017-context-compaction-llm-inyectable.md` — el contrato del resumidor inyectable.
- `docs/roadmap/Backlog.md` — `EGO-FIND-21` (cerrado), `EGO-FIND-29` (path cognitivo, parcial), `EGO-FIND-92` (`VDB-REQ-16`).
