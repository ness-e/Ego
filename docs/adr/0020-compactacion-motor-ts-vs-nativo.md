# ADR 0020: Compactación de contexto — `ContextCompaction` canónico, nativo condicionado #

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-20 |
| Estado | Aceptado (condicional: la vía nativa queda **activada** solo tras superar la puerta de invariantes) |
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

- `vantadb-node@0.8.0` expone `contextAssemble(options): Promise<any>` con
  `{ messages: ChatMessage[], token_budget, protected_prefix?,
  compaction_ratio?, min_keep? }` y la **heurística `chars/3`**
  (`TokenEstimator::default`; `precise-tokens` es opt-in).
- Es una **función pura** del engine: determinista, **sin estado**, y
  funciona incluso mientras la base de datos se cierra.

> **Corrección de nombre (importante).** La Ola 1c existió precisamente para
> cazar referencias mal asignadas. El método nativo de compactación de
> historial **se llama `contextAssemble()`**, no `compact()`. El binding sí
> tiene `compactLayout()` (compacta el *vector store* HNSW) y `compactWal()`
> (compacta el WAL), que son **otra cosa**. Confundirlos rompería la
> trazabilidad justo cuando se quiere arreglarla.

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
3. **Puerta de invariantes (condición de activación).** El nativo solo se
   activa cuando supere los tests de invariantes de `ContextCompaction`
   (system prompt preservado + pares `tool_call`/`tool_result` intactos). Si
   el nativo **no** los preserva, se registra como **petición upstream
   nueva** (`VDB-REQ-13`) y el motor TS sigue siendo el único canónico.
4. **Mientras la puerta no se supere, no hay cambio de comportamiento**: el
   cambio es puramente documental y de registro. El ADR se cierra cuando la
   puerta se evalúe, en la Ola 2 (E2).

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
  - La evaluación de la puerta de invariantes (ejecutar `contextAssemble()`
    contra los tests de `ContextCompaction`) está **pendiente** → Ola 2 · E2.
  - `packages/runtime/src/ContextCompaction.ts` es el motor con más superficie
    propia del lado de la memoria: cualquier reescritura del motor nativo
    obligará a revisar sus 21 tests.
- Riesgo: si el nativo resultara **superior** en calidad de poda y el TS
  quedara con las invariantes como único valor añadido, la decisión podría
    revisarse (ADR nuevo que sustituya a este, no edición de este).

## Referencias ##

- `packages/runtime/src/ContextCompaction.ts` — motor canónico.
- `packages/runtime/test/ContextCompaction.test.ts` · `packages/runtime/test/ContextCompaction-unified.test.ts` — invariantes.
- `packages/models/src/routerSummarizer.ts` — `createRouterSummarizer` / `renderCompactionTranscript`.
- `apps/desktop/src/main.ts:1731,1737,1965,1995` — instanciación y llamada.
- `vantadb-node@0.8.0` `index.d.ts` — `contextAssemble(options)` (y `compactLayout()` / `compactWal()`, que son otra cosa).
- `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` — `VDB-REQ-13` (petición upstream de las invariantes).
- `docs/architecture/memoria-vantadb.md` §10 — contexto canónico corregido.
- `docs/adr/0017-context-compaction-llm-inyectable.md` — el contrato del resumidor inyectable.
- `docs/roadmap/Backlog.md` — `EGO-FIND-21` (cerrado), `EGO-FIND-29` (path cognitivo, parcial).
