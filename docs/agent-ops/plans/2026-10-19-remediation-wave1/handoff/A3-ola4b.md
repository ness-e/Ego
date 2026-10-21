# Handoff A3 — Ola 4b (Fase 03: Sub-Egos) — 2026-10-21

> **Agente:** A3 (ejecución: tools · subegos · tasks · recovery)
> **Ola:** 4b — T1 (**E5** identidad declarativa + budget circuit breakers) · T2 (**E13** skills con
> divulgación progresiva + `expand_tools` + ejecutor real de delegación) · T3 (3 correcciones de mi
> zona) · T4 (peticiones de A1 traspasadas a A2/A5/A1).
> **Plan:** `docs/agent-ops/plans/2026-10-19-remediation-wave1/VERDICT.md` §7 (Fase 03) ·
> `OLA3-CONTRATO.md` §"Handoff".
> **Zona de escritura:** `packages/tools/**`, `packages/subegos/**`, `packages/tasks/**`,
> `packages/recovery/**` + **este** handoff.
> **Sin commits. Sin `git checkout/reset/stash/clean`. Sin `pnpm install`.**
> **No he tocado `apps/**`, `packages/{memory,knowledge,runtime,models,decision,execution,events,security,tool-call-repair}/**`,
> `packages/avatar/**`, `packages/domains/**`, `packages/{dailystate,ui-runtime,integrations}/**`,
> `docs/**` (salvo este fichero), raíz ni `scripts/**`.** De los ficheros de fuera de zona sólo he
> **leído** lo necesario para calcular diffs exactos.

---

## 0. Resumen

| Ítem | Estado | Dónde |
|---|---|---|
| **T3.1** lint global rojo (import duplicado) | ✅ | ya estaba corregido (verificado) |
| **T3.2** convergencia `TempWorkspace` con A4 | ✅ | `packages/tools/src/TempWorkspace.ts` |
| **T3.3** `fs_edit_patch` con hunks parciales | ✅ | `packages/tools/src/native/fs/NativeFsEditTool.ts` |
| **T1 / E5** identidad declarativa (`SOUL.md` / `AGENT.md`) | ✅ | `packages/subegos/src/{soulDocument,SubEgoIdentity}.ts` + `SubEgoSoul.ts` |
| **T1 / E5** budget circuit breakers (tokens/coste/tiempo) | ✅ | `packages/subegos/src/SubEgoBudgetBreaker.ts` + `SubEgoRuntime.ts` |
| **T2 / E13** `lookup_skills` | ✅ | `packages/tools/src/meta/{skillCatalog,metaTools}.ts` |
| **T2 / E13** `search_tools` | ✅ | ídem |
| **T2 / E13** `expand_tools` | ✅ | ídem |
| **T2 / E13** ejecutor por defecto conforme a `StructuredChildOutput` | ✅ (ya lo estaba) | test añadido en `delegation-runtime.test.ts` |
| **T4** `trust_aware` (A1 → A3 → A2) | 📤 Exact diff en §5.2 | — |
| **T4** 21 patrones (A1 → A3 → A5) | 📤 §5.4 | — |
| **T4** ADR de E5 (A3 → A1) | 📤 §2.6 | — |

**Tests**: `tools` 18→**19** ficheros · 149→**173** tests · `subegos` 20→**22** ficheros · 221→**253**
tests · `tasks` 18/84 (sin cambios) · `recovery` 14/51 (sin cambios). **+56 tests** en la ola.

---

## 1. T3 — Las 3 correcciones de mi zona

### 1.1 T3.1 — El lint global rojo (import duplicado)

**Estado: ya estaba corregido.** El import duplicado que A4 midió
(`packages/tools/test/fs-search-tools.test.ts:1:10` → *"Identifier createTempWorkspace has already
been declared"*) lo corregí en la Ola 3. Verificado ahora:

```powershell
$ Get-Content packages\tools\test\fs-search-tools.test.ts | Select-Object -First 12
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  createTempWorkspace,
  ToolRegistry,
  registerNativeTools,
  createFsReadFileTool,
  createFsGlobTool,
  createFsGrepTool,
  matchesGlob,
} from "../src/index.js";

$ npx oxlint --ignore-path .gitignore apps packages tests scripts eval --max-warnings 320 \
    | Select-String -Pattern "^\S+:\d+:\d+:\s+error"
(vacío = 0 errores)
```

`pnpm lint` sale **exit 0** al cierre de esta ola (ver §6).

### 1.2 T3.2 — Convergencia de `TempWorkspace` con la convención de A4

**El diff exacto pedido está en `handoff/A4-ola3.md` §5.3.** Lo he aplicado **completo**. Las tres
divergencias que A4 señalaba:

| | A4 pedía | Antes (A3) | Ahora |
|---|---|---|---|
| Raíz | `%TEMP%/ego-test-scratch/` (compartida) | `%TEMP%/ego-scratch/` | **`ego-test-scratch`** |
| Run-dir | `run-<epochMs>-<pid>-<rand6>` | `run-<pid>-<rand>` | **`run-<epochMs>-<pid>-<rand6>`** |
| Criterio de barrido | **PID muerto** (la antigüedad es la red de seguridad) | sólo antigüedad (6 h) | **PID muerto ⇒ se borra ya** |
| Teardown | idempotente (`force` + reintentos) | `force` + `maxRetries: 3` | **`force` + `maxRetries: 5` + `retryDelay: 200`** |

**TDD — rojo primero (4/13 fallos):**

```text
❯ test/temp-workspace.test.ts (13 tests | 4 failed)
  × CONVERGENCIA A4: un run de PID MUERTO se borra aunque sea reciente
  × CONVERGENCIA A4: el nombre del run-dir es `run-<epochMs>-<pid>-<rand6>`
  × CONVERGENCIA A4: la raíz compartida es `ego-test-scratch`
  × CONVERGENCIA A4: `isProcessAlive` está exportado (lo usa el módulo de A4)
```

**Verde:** `Test Files 1 passed (1) · Tests 13 passed (13)`.

**Cambios concretos** (`packages/tools/src/TempWorkspace.ts`):

```ts
export const TEMP_WORKSPACE_ROOT_NAME = "ego-test-scratch";   // antes: "ego-scratch"

const RUN_ID = `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

// `parseRunPid` acepta las DOS convenciones (la vigente y la de A3 anterior),
// para que el barrido limpie también los run-dirs de la versión previa.
function parseRunPid(name: string): number | null {
  const a4 = /^run-\d+-(\d+)-[a-z0-9]+$/.exec(name);
  if (a4) { const pid = Number(a4[1]); return Number.isInteger(pid) && pid > 0 ? pid : null; }
  const legacy = /^run-(\d+)-/.exec(name);
  if (!legacy) return null;
  const pid = Number(legacy[1]);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

// EXPORTADO (A4 lo importa para usar la MISMA implementación del criterio).
export function isProcessAlive(pid: number): boolean { /* signal 0; EPERM = vivo */ }
```

Y el barrido — **el PID muerto gana sobre la antigüedad** (antes un run muerto de 5 minutos
sobrevivía hasta 6 h):

```ts
const ownerPid = parseRunPid(entry.name);
if (ownerPid !== null && isProcessAlive(ownerPid)) continue;   // dueño VIVO: no se toca
const size = directorySizeSync(full);
const deadOwner = ownerPid !== null;
const tooOld = ageMs >= staleAfterMs;
const isEmpty = size === 0;
if (!deadOwner && !isEmpty && !tooOld) continue;               // se borra si: muerto | vacío | viejo
fs.rmSync(full, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
```

**Consecuencia**: ahora el barrido de un agente (A3 o A4) recoge los huérfanos **del otro**, porque
comparten raíz. Antes eran dos barridos que no se recogían el uno al otro.

> **Nota para A4**: el módulo de A4 (`apps/desktop/test/helpers/test-scratch.ts`) tiene un
> `ALT_SCRATCH_ROOT` para barrer la raíz antigua de A3 (`ego-scratch`). **Esa rama queda muerta**
> desde esta ola: ya no se crea ninguna raíz con ese nombre. No hace falta tocarla (es inocua), pero
> si A4 quiere simplificar, puede borrar la constante y su barrido.

### 1.3 T3.3 — `fs_edit_patch` con hunks parciales

Cierra la deuda nº 5 del handoff de la Ola 3 (*"`fs_edit_patch` no es un diff unificado … un
formato con hunks parciales es decisión de producto"*). La decisión ya está tomada por la ola:
**hunks parciales con fail-closed ante ambigüedad**.

**TDD — rojo primero (3/13 fallos):**

```text
❯ test/fs-edit-patch.test.ts (13 tests | 3 failed)
  × hunk parcial: recorta el `find` hasta la coincidencia única (prefijo común)
  × hunk parcial: recorta por el SUFIJO común
  × hunk parcial: `dryRun` previsualiza sin escribir
```

**Implementación** (`packages/tools/src/native/fs/NativeFsEditTool.ts`): nueva función `applyHunk`
que sustituye al `countOccurrences` + `replace` directo:

1. Si el `find` casa **exactamente una vez** → se aplica tal cual (comportamiento anterior).
2. Si casa 0 veces → **recorte por prefijo/sufijo común**: se recorta el `find` por los dos
   extremos (primera línea, luego última línea) hasta encontrar un fragmento que case
   **exactamente una vez**; el `replace` se recorta de forma **correspondiente** (mismas líneas por
   delante y por detrás), de modo que el resultado es el que el autor del parche pretendía.
3. Si el `find` casa **más de una vez** → se rechaza (fail-closed, mensaje con el nº de
   coincidencias) — el fichero queda **intacto**.
4. Si no hay coincidencia única tras el recorte → se rechaza con
   *"(0 coincidencias, ni tras recortar por prefijo/sufijo común)"*.

El `dryRun` funciona con los hunks parciales (previsualiza el resultado sin escribir).

---

## 2. T1 — E5: identidad declarativa + budget circuit breakers

### 2.1 El problema

El "alma" de un Sub-Ego vivía **en código**: `packages/subegos/src/SubEgoSoul.ts` (628 líneas) con
su esquema Zod (`SubEgoSoulSchema`, 56 líneas de campos) y su renderizador (`toSoulBlock()`).
Consecuencias:

- Crear un especialista nuevo exigía **tocar TypeScript** (y recompilar el paquete).
- La identidad no se podía **versionar** junto al proyecto que la usa.
- El contenido del alma (narrativa, valores) estaba **encajonado** en un string de un objeto Zod:
  el cuerpo en Markdown era imposible de expresar.

E5 externaliza la identidad a un **artefacto declarativo** (`SOUL.md` o `AGENT.md`:
frontmatter YAML + cuerpo Markdown) que **el manifiesto declara** y **el runtime carga**.

### 2.2 El formato del artefacto

```markdown
---
id: ego.auditor-tecnico
name: Auditor Técnico
tone: analytical
reasoningStyle: first-principles
values:
  - La evidencia precede a la opinión
  - Un hallazgo sin reproducible no es un hallazgo
inviolableRules:
  - Nunca declarar "listo" sin tests en verde
customDirectives:
  - Reportar por severidad decreciente
temperament:
  skepticismLevel: high
  proactivityLevel: propose-first
  detailDepth: summary-first
---

Eres un auditor técnico de un equipo de ingeniería.

Tu trabajo es encontrar defectos, no validar el trabajo de otros.
```

- **frontmatter** → los campos estructurados del alma.
- **cuerpo** → `identityBody` (narrativa), que se inyecta en el prompt como sección
  `[IDENTITY NARRATIVE]`.
- Formato `agent-md`: admite además un bloque anidado `soul:` (merge por encima del frontmatter
  plano). El formato `soul-md` **ignora** el bloque anidado.
- Round-trip estable: `SubEgoSoul.fromMarkdown(soul.toMarkdown())` conserva la identidad.

### 2.3 El cargador: fallback, fail-closed y confine

`packages/subegos/src/SubEgoIdentity.ts` (nuevo) + `packages/subegos/src/soulDocument.ts` (nuevo,
parser puro).

El manifiesto declara la identidad (campo **aditivo** `identity`):

```ts
export interface SubEgoIdentity {
  file: string;                                  // ruta relativa al workspace o absoluta
  format: "auto" | "soul-md" | "agent-md";      // `auto` lo deduce del nombre
  required: boolean;                             // si es true, la ausencia aborta (fail-closed)
}
```

`loadSubEgoIdentity(manifest, { reader, workspacePath, allowOutsideWorkspace?, defaults? })` →
`{ soul, source: "file" | "manifest", file?, warnings[] }`:

| Situación | Resultado |
|---|---|
| Sin `identity` en el manifiesto | `source: "manifest"` — **fallback**: la API pública actual sigue funcionando |
| Artefacto declarado y legible | `source: "file"` |
| Artefacto declarado, ausente, `required: false` | `source: "manifest"` + `warnings[]` |
| Artefacto declarado, ausente, `required: true` | **`SubEgoIdentityNotFoundError`** (fail-closed) |
| Frontmatter corrupto, `required: true` | **`SubEgoIdentityNotFoundError`** |
| Ruta fuera del confine | **`SubEgoIdentityUnsafePathError`** (path traversal) |

El **confine**: `resolveIdentityPath()` ancla las rutas relativas al `workspacePath` y **rechaza**
(absolutas incluidas) cualquier ruta que salga de él, salvo que se pase
`allowOutsideWorkspace: true` (identidades globales).

**El manifiesto sigue siendo la autoridad de gobernanza**: el artefacto declara *identidad*
(nombre, valores, reglas, narrativa), **nunca** tools, permisos, namespaces ni presupuesto.

### 2.4 Los circuit breakers de presupuesto

`packages/subegos/src/SubEgoBudgetBreaker.ts` (nuevo). Tres límites, todos **medibles**:

| Límite | Origen | Efecto al superarse |
|---|---|---|
| `tokens_per_call` | `budget.maxTokensPerCall` (ya existía) | **detiene** |
| `daily_cost` | `budget.maxDailyCostUsd` (ya existía) | **detiene** |
| `cost_per_call` | `budget.maxCostPerCallUsd` **(nuevo)** + tope global del router | **degrada** o **detiene** |
| `turn_duration` | `budget.maxTurnDurationMs` **(nuevo)** | **detiene** (abre el circuito) |

La decisión es tipada:

```ts
export type SubEgoBudgetDecision =
  | { outcome: "allow"; effectiveCostCapUsd?: number }
  | { outcome: "degrade"; model: string; reason: string;
      estimatedCostUsd: number; effectiveCostCapUsd: number }
  | { outcome: "stop"; error: SubEgoBudgetCircuitBreakerError };
```

`SubEgoBudgetCircuitBreakerError extends SubEgoBudgetError` con `limit`, `current`, `maxAllowed`,
`subEgoId` — **error tipado**, no un flag.

**Medible** (assert sobre números, no sobre flags):

```ts
export interface SubEgoBudgetCounters {
  turns: number; degradedTurns: number; stoppedTurns: number;
  tokensUsed: number; costUsd: number; totalDurationMs: number;
  lastLimit?: SubEgoBudgetLimit;
}
```

**Degradar, no duplicar la política del router**: la resolución del modelo barato es

1. `budget.cheaperModelId` (explícito en el manifiesto), si está declarado;
2. si no, **el router** (`router.resolveCheaperModel({ maxCostPerCallUsd })`);
3. si ninguno puede ⇒ **detiene** con error tipado.

**El tope efectivo es el MÍNIMO** entre el del Sub-Ego y el global del router
(`router.getMaxCostPerCallUsd()`): ninguna llamada puede costar más que lo permita el más
restrictivo de los dos.

### 2.5 La conexión con el `ModelRouter` (estructural, sin dependencia)

`@ego/subegos` **no** depende de `@ego/models` (no lo añadiría: `packages/models` es zona de A2 y
la dependencia iría en la dirección equivocada). La conexión es **estructural** (DIP):

```ts
// packages/subegos/src/SubEgoBudgetBreaker.ts
export interface BudgetAwareRouterLike {
  getMaxCostPerCallUsd?(): number | undefined;
  resolveCheaperModel?(options: {
    maxCostPerCallUsd: number;
    capabilities?: readonly string[];
  }): string | null | Promise<string | null>;
}
```

**No se reimplementa nada del router**: el breaker decide *cuándo* abrir el circuito; el router
decide *con qué modelo* seguir. El diff exacto para que el `ModelRouter` satisfaga este contrato
está en **§5.1** (A2).

**Integración en el runtime** (`SubEgoRuntime`, mi zona):

- `new SubEgoRuntime({ budgetBreaker })` — opcional; sin él, **cero cambio de comportamiento**.
- `executeTurn()`: antes del turno consulta el circuito (si está abierto por duración, el turno
  **no arranca**); después del turno registra el consumo real (`recordAfterTurn`).
- `runtime.consultBudget(subEgoId, { tokens, costUsd })`: punto de enganche con la capa de modelos;
  si la decisión es `degrade`, publica el modelo en `instance.scratchpad` bajo
  `SUB_EGO_DEGRADED_MODEL_KEY = "__budget_model"`.

`SubEgoBudgetTracker.recordTurnUsage()` acepta ahora `usage.costUsd` explícito (el coste **real**
que ya calculó la capa de modelos), en vez de reestimarlo con la tabla de precios: aditivo, sin
romper la API.

**TDD — rojo primero (15/16 y 14/14 fallos):**

```text
❯ test/SubEgoIdentity.test.ts (16 tests | 15 failed)      # TypeError: (0 , parseSoulDocument) is not a function
❯ test/SubEgoBudgetBreaker.test.ts (14 tests | 14 failed) # SubEgoBudgetCircuitBreaker is not a function
```

**Verde:** `SubEgoIdentity` 16/16 · `SubEgoBudgetBreaker` 15/15.

### 2.6 Texto del ADR de E5 (para A1) — listo para aplicar

> **Fichero sugerido**: `docs/adr/0024-identidad-declarativa-y-circuit-breakers-de-presupuesto.md`
> (el 0023 lo tiene A2 pendiente; **A1**, verifica el número libre antes de escribirlo).

```markdown
# ADR-0024 — Identidad declarativa de Sub-Egos y circuit breakers de presupuesto

- Estado: Aceptado
- Fecha: 2026-10-21
- Zona: packages/subegos (E5, Fase 03 "Sub-Egos")
- Sustituye a: (nada) — amplía `SubEgoSoul` (SUB-11) y `SubEgoBudget` (SUB-09)

## Contexto

La identidad de un Sub-Ego (nombre, rol, valores, reglas innegociables, narrativa) vivía
**en código**: `packages/subegos/src/SubEgoSoul.ts` con un esquema Zod de 56 campos y un
renderizador de prompt. Eso obligaba a modificar TypeScript para crear un especialista nuevo
y hacía imposible versionar la identidad junto al proyecto que la usa.

En paralelo, el presupuesto de un Sub-Ego sólo tenía dos cuotas (`maxTokensPerCall`,
`maxDailyCostUsd`): no había **límite de tiempo** (un turno podía colgarse eternamente), no
había **degradación** (al agotar el presupuesto el Sub-Ego se detenía sin más) y el tope de
**coste por llamada** no estaba conectado al `ModelRouter`, que ya sabe degradar a un modelo
más barato (`maxCostPerCallUsd`, EGO-FIND-39).

## Decisión

### 1. La identidad se externaliza a un artefacto declarativo

Un Sub-Ego declara su identidad en un artefacto Markdown con frontmatter YAML
(`SOUL.md`, o `AGENT.md` con un bloque `soul:` anidado):

    ---
    id: ego.auditor-tecnico
    name: Auditor Técnico
    tone: analytical
    values: [...]
    inviolableRules: [...]
    ---

    <narrativa de identidad en Markdown>

El **manifiesto** declara el artefacto con un campo aditivo `identity`
(`{ file, format, required }`) y el **runtime lo carga**
(`loadSubEgoIdentity(manifest, { reader, workspacePath })`).

Reglas:

1. **La API pública no cambia**: sin artefacto declarado, el loader en código
   (`SubEgoSoul.fromManifest`) sigue siendo el fallback. Ningún Sub-Ego existente deja de
   funcionar.
2. **Fail-closed**: `identity.required = true` + artefacto ausente o corrupto ⇒ error tipado
   (`SubEgoIdentityNotFoundError`). No hay identidad a medias.
3. **Confine**: la ruta se ancla al workspace; salir de él es
   `SubEgoIdentityUnsafePathError` (path traversal), salvo `allowOutsideWorkspace` explícito.
4. **Separación de poderes**: el artefacto declara *identidad*; el manifiesto sigue declarando
   *gobernanza* (tools, permisos, namespaces, presupuesto). El artefacto no puede conceder
   permisos.
5. **El cuerpo Markdown es la narrativa** (`identityBody`) y se inyecta en el prompt del alma
   como sección `[IDENTITY NARRATIVE]`, dentro del Tier 3 (Soul), que ya está subordinado al
   Tier 1 (guardrails de seguridad) y al Tier 2 (core rules). La precedencia **no cambia**.

### 2. Los presupuestos abren un circuito medible

Cada Sub-Ego declara un presupuesto con tres dimensiones —tokens, coste y tiempo— y un circuit
breaker (`SubEgoBudgetCircuitBreaker`) que decide, de forma **medible** (contadores numéricos,
no flags), una de tres acciones: **permitir**, **degradar a un modelo más barato** o
**detener con un error tipado** (`SubEgoBudgetCircuitBreakerError`, con `limit`, `current`,
`maxAllowed`, `subEgoId`).

El tope de coste por llamada efectivo es el **mínimo** entre el declarado por el Sub-Ego y el
global del `ModelRouter`.

### 3. La política de modelos NO se duplica

El circuit breaker decide *cuándo* degradar; el `ModelRouter` decide *con qué modelo*. La
conexión es **estructural** (`BudgetAwareRouterLike`): `@ego/subegos` no depende de
`@ego/models`. El router expone `getMaxCostPerCallUsd()` y `resolveCheaperModel()`; si no hay
modelo más barato disponible, el circuito **detiene** con error tipado (fail-closed: nunca se
degrada a un `mock` que devolvería una respuesta ficticia).

## Consecuencias

- Se puede crear y versionar un Sub-Ego (con su identidad) sin tocar TypeScript.
- Los Sub-Egos existentes siguen funcionando: el fallback es el comportamiento por defecto.
- Un Sub-Ego puede colgar en el tiempo: el tope `maxTurnDurationMs` abre el circuito.
- `@ego/models` expone dos métodos públicos más (diff en `handoff/A3-ola4b.md` §5.1).
- La contabilidad de presupuesto se apoya en `SubEgoBudgetTracker` (no se duplica la métrica).

## Alternativas descartadas

- **Sólo YAML (`SOUL.yaml`)**: ya existía `SubEgoSoul.fromYaml()`, pero un YAML no admite la
  narrativa libre con la que se describe una identidad; el Markdown sí (y es legible en un PR).
- **Duplicar la degradación dentro de `packages/subegos`**: rejected — duplicaría la tabla de
  precios y la lógica de disponibilidad del router, que es la fuente canónica.
- **Añadir `@ego/models` como dependencia de `@ego/subegos`**: rejected — acopla el runtime de
  Sub-Egos al router y crea un ciclo potencial (`models` ↔ `subegos`).
- **Un único `maxCostPerCallUsd` global**: rejected — el tope por Sub-Ego es una necesidad de
  gobernanza (un Sub-Ego de alto coste no debe vaciar la cuota de los demás).
```

---

## 3. T2 — E13: skills con divulgación progresiva + `expand_tools` + ejecutor real

### 3.1 El problema

**0 coincidencias** de `expand_tools` / `search_tools` / `lookup_skills` en todo el repo. El
catálogo de tools era **fijo por rol/perfil** (`cloneRegistryForProfile`) y el de skills no existía
como catálogo consultable. El modelo no podía pedir "más herramientas" ni "¿hay una skill para
esto?": o recibía el catálogo entero (contexto inflado) o nada.

### 3.2 La escalera de divulgación progresiva

Los 3 metatools forman una escalera; el modelo baja **sólo cuando lo necesita**:

| Metatool | Pregunta que responde | Devuelve | Coste en contexto |
|---|---|---|---|
| `lookup_skills` | "¿hay una skill para esto?" | índice relevante: `id`, `name`, `description`, `tags`, `score` | bajo |
| `search_tools` | "¿qué tools hay para esto?" | resúmenes: `name`, `description`, `category`, `riskLevel`, `requiresApproval` | bajo |
| `expand_tools` | "¿cómo se llama exactamente esta tool?" | **schema JSON completo** de las tools pedidas | alto (a demanda) |

`lookup_skills` tiene **dos pasos**: por defecto devuelve sólo el índice; el cuerpo de la skill
(`SKILL.md`) se entrega con `includeBody: true`. Un `lookup_skills` con 1 coincidencia sobre un
catálogo de 3 skills devuelve **1 skill y `total: 3`** — la prueba de que no se vuelca el catálogo.

### 3.3 `lookup_skills`

- **Catálogo inyectado** (DIP): `SkillCatalogLike { list(): SkillCatalogEntry[] | Promise<…> }`.
  `packages/tools` **no** depende de `@ego/integrations` (donde vive `SkillScanner`):would crear
  un ciclo (`integrations` ya depende de `tools`). El adaptador son 5 líneas (§5.3).
- **Búsqueda determinista y explicable** (`rankSkills` / `scoreSkill`): coincidencia exacta de
  `id` (+100) o `name` (+60); el nombre contiene la consulta (+30); cada token de la consulta
  aparece en el nombre (+10), en el `id` (+8), en las etiquetas (+6) o en la descripción (+4).
  Empates → por `id` ascendente ⇒ **orden estable y reproducible**.
- **Sin catálogo configurado ⇒ `MetaToolError`** (fail-closed: no se devuelve un catálogo vacío
  que el modelo interpretaría como "no hay skills").

### 3.4 `search_tools` y `expand_tools`

- `search_tools` devuelve **resúmenes sin schema** (el schema es trabajo de `expand_tools`),
  con filtros por `category` y `riskLevel`.
- `expand_tools` expone el **schema JSON completo** (`ToolRegistry.exportJsonSchemas()`), por
  nombres exactos o por consulta de texto.
- **Fail-closed ante tool desconocida**: reutiliza el contrato que ya existe
  (`findMissingTools` de `packages/tools/src/ToolContract.ts`) — **no se duplica** el contrato.
  Si pides una tool que no existe, se rechaza Naming **todas** las tools pedidas.

### 3.5 Gobernanza: los metatools ven sólo lo que su registro ve

Los metatools se registran **en el registro en el que están registrados**. Si se registran en el
**clon confinado** de un Sub-Ego, ese Sub-Ego no puede expandir tools fuera de su confine: el
contrato `findMissingTools` lo hace fallar. Test:

```text
✓ E13 — `expand_tools` > GOBERNANZA: no expande tools fuera del registro confinado (Sub-Ego)
```

**Recomendación operativa**: registrar los metatools **por Sub-Ego** (en su clon confinado), no
sólo en el registro global.

### 3.6 El ejecutor por defecto de la delegación

Ya estaba arreglado en la Ola 1 (`DelegationRouter.executeTask` devuelve
`{ summary, findings, files, issues }` — el contrato `StructuredChildOutput`). Lo que faltaba era
**el test que lo demostrara**: el test existente sólo comprobaba `result.output` "definido".

**Añadido** (`packages/subegos/test/delegation-runtime.test.ts`):

```text
✓ E13/T2: el ejecutor por defecto cumple el contrato `StructuredChildOutput`
  expect(typeof output.summary).toBe("string");
  expect(Array.isArray(output.findings)).toBe(true);
  expect(Array.isArray(output.files)).toBe(true);
  expect(Array.isArray(output.issues)).toBe(true);
```

**TDD — rojo primero (15/15 fallos):**

```text
❯ test/meta-tools.test.ts (15 tests | 15 failed)
  → (0 , rankSkills) is not a function
  → (0 , registerMetaTools) is not a function
```

**Verde:** `meta-tools` 15/15.

**Catálogo canónico**: `META_TOOL_NAMES = ["lookup_skills", "search_tools", "expand_tools"]`, con
un test que lo ata a lo que `registerMetaTools` registra realmente (mismo patrón que
`NATIVE_TOOL_NAMES`). `NATIVE_TOOL_NAMES` **no** cambia: los metatools no son conectores Nivel A,
son metatools con opciones (catálogo de skills), y se registran con `registerMetaTools`, no con
`registerNativeTools`.

---

## 4. Verificación

| Comando | Exit | Resumen |
|---|---|---|
| `pnpm --filter @ego/tools test` | **0** | 19 ficheros · **173 tests** (Ola 3: 18/149 → **+24**) |
| `pnpm --filter @ego/subegos test` | **0** | 22 ficheros · **253 tests** (Ola 3: 20/221 → **+32**) |
| `pnpm --filter @ego/tasks test` | **0** | 18 ficheros · **84 tests** (sin cambios) |
| `pnpm --filter @ego/recovery test` | **0** | 14 ficheros · **51 tests** (sin cambios) |
| `pnpm -r typecheck` | **0** | 0 errores en el monorepo (19 paquetes + apps) |
| `pnpm lint` | **0** | oxlint por debajo del umbral + typecheck en verde |
| `pnpm --filter @ego/tools --filter @ego/subegos build` | **0** | `dist/` actualizado (lo consumen `integrations` y `apps/desktop`) |
| `catch {}` vacíos en mi zona | — | **0** |
| Mojibake en los 18 ficheros tocados | — | **0** |

**TDD — rojos demostrados antes de cada fix (output pegado arriba):**

| Tarea | Rojo |
|---|---|
| T3.2 convergencia `TempWorkspace` | 4/13 fallos |
| T3.3 hunks parciales | 3/13 fallos |
| E5 identidad declarativa | 15/16 fallos (`parseSoulDocument is not a function`) |
| E5 budget circuit breakers | 14/14 fallos (`SubEgoBudgetCircuitBreaker is not a function`) |
| E13 metatools | 15/15 fallos (`rankSkills is not a function`) |

---

## 5. Solicitudes fuera de zona (con diff exacto)

### 5.1 A2 (`packages/models`) — el `ModelRouter` debe satisfacer el contrato del circuit breaker

**Por qué**: E5 exige "conectar con el `maxCostPerCallUsd` que A2 ya cableó en el `ModelRouter`
(no lo reimplementes)". El breaker **no** reimplementa nada: pide al router el tope global y el
modelo más barato. Para eso el router expone **dos métodos públicos** (el resto de la lógica se
**extrae**, no se copia).

**Fichero**: `packages/models/src/ModelRouter.ts`

```diff
@@ clase ModelRouter, tras `enforceCostBudget` (@@ ~615)
+  /**
+   * E5: tope global de coste por llamada (USD).
+   *
+   * Lo consume el circuit breaker de presupuesto de Sub-Ego
+   * (`packages/subegos/src/SubEgoBudgetBreaker.ts`), que combina el tope
+   * propio del Sub-Ego con este tomando el MÍNIMO.
+   */
+  public getMaxCostPerCallUsd(): number | undefined {
+    return this.config.maxCostPerCallUsd;
+  }
+
+  /**
+   * E5: resuelve el modelo más barato que cumple el tope indicado.
+   *
+   * Delega en la MISMA selección de candidatos que `enforceCostBudget`
+   * (no la duplica): el breaker de Sub-Ego decide *cuándo* degradar; el
+   * router decide *con qué modelo*. Devuelve `null` si no hay ninguno
+   * disponible (el breaker entonces DETIENE con error tipado).
+   */
+  public async resolveCheaperModel(options: {
+    maxCostPerCallUsd: number;
+    capabilities?: readonly string[];
+  }): Promise<string | null> {
+    const candidate = await this.findCheaperCandidate(
+      options.maxCostPerCallUsd,
+      options.capabilities ?? [],
+      null
+    );
+    return candidate?.id ?? null;
+  }
+
+  /**
+   * Selección del modelo más barato que cumple el tope (extraída de
+   * `enforceCostBudget` para que la usen las dos rutas).
+   */
+  private async findCheaperCandidate(
+    budget: number,
+    requiredCapabilities: ModelCapability[],
+    excludeId: string | null
+  ): Promise<ModelDescriptor | null> {
+    let best: ModelDescriptor | null = null;
+    let bestCost = Number.POSITIVE_INFINITY;
+
+    for (const candidate of this.models.values()) {
+      if (excludeId !== null && candidate.id === excludeId) continue;
+      if (candidate.provider === "mock") continue;
+      if (!requiredCapabilities.every((cap) => candidate.capabilities.has(cap))) continue;
+      const provider = this.providers.get(candidate.provider);
+      if (!provider) continue;
+      if (!(await provider.isAvailable())) continue;
+      const cost = estimateCallCostUsd(candidate, { messages: [] });
+      if (cost <= budget && cost < bestCost) {
+        best = candidate;
+        bestCost = cost;
+      }
+    }
+    return best;
+  }

@@ `enforceCostBudget` (@@ ~592): el bucle de candidatos se SUSTITUYE por la llamada
-    let best: ModelDescriptor | null = null;
-    let bestCost = Number.POSITIVE_INFINITY;
-    for (const candidate of this.models.values()) { … }
+    const best = await this.findCheaperCandidate(budget, requiredCapabilities, descriptor.id);
+    const bestCost = best ? estimateCallCostUsd(best, options) : Number.POSITIVE_INFINITY;
```

> **Nota**: `estimateCallCostUsd(descriptor, { messages: [] })` estima 0 tokens de entrada; para
> una comparación *relativa* entre modelos eso no cambia el orden (el output estimado es el
> mismo), pero si A2 prefiere, puede usar el descriptor directamente
> (`costPerInputTokenUsd`/`costPerOutputTokenUsd`). Lo que **no** debe hacer es cambiar el
> criterio de elegibilidad (capacidades, provider disponible, exclusión del mock).

**Test sugerido para A2** (`packages/models/test/`):

```ts
it("resolveCheaperModel devuelve el modelo más barato dentro del tope", async () => {
  const router = new ModelRouter({ maxCostPerCallUsd: 2.0 });
  // registrar 2 modelos con costes distintos y providers disponibles
  const cheaper = await router.resolveCheaperModel({ maxCostPerCallUsd: 0.5 });
  expect(cheaper).toBe("el-modelo-barato");
});

it("resolveCheaperModel devuelve null si ningún modelo cabe en el tope", async () => {
  const router = new ModelRouter({ maxCostPerCallUsd: 0.0001 });
  expect(await router.resolveCheaperModel({ maxCostPerCallUsd: 0.0001 })).toBeNull();
});
```

**Y el cableado en el runtime de Sub-Egos** (el `executor` de `createDelegationRuntime` y la
capa de modelos del main) recibe el router como `BudgetAwareRouterLike`:

```diff
- setDelegationRuntime(createDelegationRuntime({
-   storage: adapter,
-   toolRegistry,
+ setDelegationRuntime(createDelegationRuntime({
+   storage: adapter,
+   toolRegistry,
+   budgetBreaker: new SubEgoBudgetCircuitBreaker({
+     subEgoId: "ego.nucleus",
+     budget: { … },
+     router: modelRouter,   // satisface BudgetAwareRouterLike (A2)
+   }),
```

(El campo `budgetBreaker` en `DelegationRuntimeDeps` **no existe todavía**: lo pido como
extensión opcional, en §5.5.)

### 5.2 A2 (`packages/memory` + `packages/runtime`) — `memoryRecall({ trust_aware: true })` (VDB-REQ-15)

> Esto es lo que **A1 me pide** en `handoff/A1-ola4.md` §5.5. `packages/memory/**` y
> `packages/runtime/**` son **de A2**, así que **no lo he tocado**: te lo paso con el diff exacto.

**Hecho verificado empíricamente** (no supuesto): la capacidad **existe** en el binding 0.9.0
(`node_modules/vantadb-node@0.9.0/index.d.ts:607`):

```ts
  /**
   * One auto-recall pass over L1/session/agent/team memory (MEMG-24).
   * `options`: `{user_text, session_key, scope?, max_results?, min_overlap?,
   * team_id?, agent_id?, allow_prefixes?, trust_aware?, now_ms?}`. …
   * `trust_aware` (default `false`) opts into the composite re-rank
   * (S8/FIND-320, MEMG-21 precedent); `false` keeps the legacy ordering
   * byte-identical. `now_ms` (epoch ms, default: wall-clock) only feeds
   * the opt-in path and makes it deterministic in tests.
   */
  memoryRecall(options: any): Promise<any>
```

**Hecho verificado (y relevante)**: en todo el repo **no hay ni una llamada** a `memoryRecall` ni
a `adapter.recall()`:

```powershell
$ Get-ChildItem apps\desktop\src,packages -Recurse -File -Filter *.ts |
    Select-String -Pattern "\.recall\(|memoryRecall"
(no output)
```

⇒ El recall cognitivo **no está cableado en Ego todavía** (es parte de E2, Fase 06). Lo que falta
es el **wrapper** en el adaptador, que es la pieza de la que A2 puede depender ya.

**Diff 1 — `packages/memory/EgoMemoryAdapter.ts`** (wrapper sobre la capacidad nativa):

```diff
@@ junto a `async recall(...)` (@@ ~761)
+  /**
+   * Recall cognitivo con re-rank compuesto por CONFIANZA (VDB-REQ-15).
+   *
+   * La capacidad YA EXISTE en el motor 0.9.0: `memoryRecall({trust_aware:true})`
+   * (ver `vantadb-node@0.9.0/index.d.ts:607`). Lo que faltaba era el cableado
+   * en Ego: el `TrustBoundary` (ADR-0019) decide qué procedencias son de
+   * confianza y el motor las pondera en el re-rank, de modo que el contenido
+   * no confiable no sube por repetición de término.
+   *
+   * `trust_aware` por defecto **true** (es el.path que el `TrustBoundary`
+   * quiere); `false` conserva el orden legacy byte a byte.
+   */
+  async memoryRecall(options: {
+    user_text: string;
+    session_key: string;
+    scope?: string;
+    max_results?: number;
+    min_overlap?: number;
+    team_id?: string;
+    agent_id?: string;
+    allow_prefixes?: string[];
+    trust_aware?: boolean;
+    now_ms?: number;
+  }): Promise<unknown> {
+    const db = this.ensureReady();
+    try {
+      return await db.memoryRecall({
+        ...options,
+        trust_aware: options.trust_aware ?? true,
+        now_ms: options.now_ms ?? Date.now(),
+      });
+    } catch (err) {
+      console.error(
+        `[EgoMemoryAdapter] memoryRecall falló: ${sanitizeForLog(describeError(err))}`
+      );
+      return null;
+    }
+  }
```

**Diff 2 — `packages/runtime/src/TrustBoundary.ts`** (derivar los prefijos de confianza):

```diff
@@ junto a `isTainted` (@@ ~42)
+/**
+ * Prefijos de memoria en los que SÍ se confía (ADR-0019 + VDB-REQ-15).
+ *
+ * Se cruza el `TrustBoundary` de taint con la procedencia de cada recuerdo:
+ * un recuerdo cuyo origen está marcado como no confiable no entra en el
+ * `allow_prefixes` del recall, y el motor no lo pondera en el re-rank.
+ */
+export interface MemoryProvenance {
+  /** Namespace/procedencia del recuerdo (p. ej. "kb/docs", "web/x"). */
+  readonly namespace: string;
+  /** ¿El contenido es de confianza? */
+  readonly trusted: boolean;
+}
+
+export function trustedAllowPrefixes(
+  memories: readonly MemoryProvenance[]
+): string[] {
+  return [
+    ...new Set(
+      memories
+        .filter((m) => m.trusted)
+        .map((m) => m.namespace.split("/").slice(0, 2).join("/"))
+    ),
+  ];
+}
```

**Diff 3 — el call site** (viene con **E2**, Fase 06, no en esta ola): quien arme el contexto
cognitivo debe llamar

```ts
const allow = trustedAllowPrefixes(provenance);
const recall = await adapter.memoryRecall({
  user_text, session_key, allow_prefixes: allow, trust_aware: true, now_ms: Date.now(),
});
```

> **Nota para A2**: `now_ms` hace la ruta opt-in **determinista en tests** (el propio binding lo
> documenta). Conviene fijarlo en los tests de `packages/memory`.

### 5.3 A4 (`apps/desktop`) — que la identidad declarativa y los metatools lleguen a producción

Sin estos 3 diffs, E5 y E13 quedan **implementados pero inalcanzables** desde el producto.

**Diff 1 — `apps/desktop/src/main.ts`** (`resolveTurnSoul`, línea ~543): cargar la identidad
declarativa cuando el manifiesto la declara.

```diff
- import {
-   SubEgoSoul,
+ import {
+   SubEgoSoul,
+   loadSubEgoIdentity,
+   createNodeIdentityFileReader,
 } from "@ego/subegos";

@@ `resolveTurnSoul` (@@ ~543)
 export async function resolveTurnSoul(subEgoId: string): Promise<SubEgoSoul> {
   try {
     const manifest = await subEgoRegistry?.get(subEgoId);
-    if (manifest) return SubEgoSoul.fromManifest(manifest);
+    if (manifest) {
+      // E5: si el manifiesto declara su artefacto de identidad (`SOUL.md` /
+      // `AGENT.md`), se carga desde disco; si no se puede leer y no es
+      // obligatorio, se cae al loader en código (fail-open de IDENTIDAD,
+      // nunca de gobernanza).
+      const resolution = await loadSubEgoIdentity(manifest, {
+        reader: createNodeIdentityFileReader(),
+        workspacePath: process.env.EGO_WORKSPACE_PATH || process.cwd(),
+      });
+      for (const warning of resolution.warnings) {
+        console.warn(`[resolveTurnSoul] ${warning}`);
+      }
+      return resolution.soul;
+    }
   } catch {
     // Fallback intencional al nucleus (fail-open solo en identidad, nunca en permisos).
   }
   return getDefaultNucleusSoul();
 }
```

**Diff 2 — `apps/desktop/src/main/window/create-window.ts`** (línea ~382, junto a
`registerNativeTools`): registrar los 3 metatools con el catálogo de skills.

```diff
- import { ToolRegistry, registerNativeTools } from "@ego/tools";
+ import { ToolRegistry, registerNativeTools, registerMetaTools } from "@ego/tools";
+ import { SkillScanner } from "@ego/integrations";

@@ tras `registerNativeTools(...)` (@@ ~395)
+  // E13: metatools de divulgación progresiva. El catálogo de skills es
+  // INYECTADO (`SkillCatalogLike`): `packages/tools` no depende de
+  // `packages/integrations` (evita el ciclo), así que el adaptador son 5
+  // líneas aquí.
+  const skillScanner = new SkillScanner();
+  registerMetaTools(toolRegistry, {
+    skills: {
+      list: () =>
+        skillScanner.scan().map((s) => ({
+          id: s.id,
+          name: s.name,
+          description: s.description,
+          tags: s.tags ?? [],
+          path: s.path,
+        })),
+    },
+  });
```

> **A4**: los nombres exactos de los campos de `ScannedSkill` (`id`, `name`, `description`,
> `tags`, `path`) hay que confirmarlos contra `packages/integrations/src/skills/SkillScanner.ts`
> (lo he leído: `ScannedSkill` tiene `id`, `name`, `description`, `securityLevel`, `path`…; si
> `tags` no existe, se quita esa línea — es opcional en `SkillCatalogEntry`).

**Diff 3 — `apps/desktop/src/main/window/create-window.ts`**: registrar los metatools **también en
el clon confinado de cada Sub-Ego** (gobernanza: `expand_tools` no debe exponer tools fuera del
confinement). Donde ya se clona el registro por perfil
(`cloneRegistryForProfile(registry, config)`):

```diff
- const scoped = cloneRegistryForProfile(toolRegistry, config);
+ const scoped = cloneRegistryForProfile(toolRegistry, config);
+ registerMetaTools(scoped, { skills });   // E13: los metatools ven sólo el confine
```

### 5.4 A5 (`docs/review/**`) — volcar los 21 patrones

El inventario ya está calculado (tabla de 21 filas + 2 nuevas) en
`handoff/A3-ola3.md` **§5**. **No lo he volcado**: `docs/**` es zona de A1/A5/A8 y A1 me lo pasó
explícitamente para A5.

**Cambio respecto a la Ola 3** (actualiza la tabla al volcar):

| ID | Módulo | Estado | Cambio en esta ola |
|---|---|---|---|
| `OCLW-17` | `packages/tools/.../exporters/**` | ✅ Completada | — (Ola 3) |
| `OCLW-18` | `packages/tools/.../repl/**` | ✅ Completada | — (Ola 3) |
| `OCLW-19` *(nuevo)* | `packages/subegos/.../soulDocument.ts` + `SubEgoIdentity.ts` | ✅ **Completada** | **E5**: la identidad vive en un artefacto declarativo (`SOUL.md`/`AGENT.md`), no en código |
| `OCLW-20` *(nuevo)* | `packages/subegos/.../SubEgoBudgetBreaker.ts` | ✅ **Completada** | **E5**: circuit breaker de tokens/coste/tiempo con degradación o parada tipada |
| `OCLW-21` *(nuevo)* | `packages/tools/.../meta/**` | ✅ **Completada** | **E13**: metatools de divulgación progresiva (`lookup_skills`, `search_tools`, `expand_tools`) |
| `OCLW-11` | `packages/ui-runtime/.../MermaidRenderer.ts` | 🟡 Parcial | sigue pendiente la vista React (A4) |
| `COUC-08` | `packages/ui-runtime/.../PayloadRef.ts` | 🟡 Parcial | sigue pendiente pasarlo en main (A4, diff 6) |
| `COUC-09` | `packages/tasks/.../RunRecorder.ts` | 🟡 Parcial | sigue pendiente instanciarlo en main (A4, diff 5) |
| `HERM-08`, `HERM-07`, `HERM-06`, `OCLW-13`, `COUC-15` | — | ⏳ Pendiente de A4/A7 | sin cambios |
| `COUC-01`, `COUC-02`, `HERM-14`, `KHOJ-04`, `OCLW-06`, `OCLW-14`, `DSEK-02`, `HERM-18` | — | ⬜ A2 | sin cambios |
| `COUC-21` | `packages/avatar/**` | ⬜ A6 | sin cambios |
| `HELM-03` | `apps/desktop/renderer/hooks/useTerminalSession.ts` | ⬜ A4 | sin cambios |
| `COUC-13`, `COUC-05`, `HERM-12` | — | 🚫 Descartada (con justificación) | ya retiradas en la Ola 1b |
| `OCLW-09`, `OCLW-07`, `HERM-15`, `DSEK-04` | — | ✅ Completada | ya cerradas |

> **Numeración**: propongo `OCLW-19/20/21` (continuación de la serie `OCLW` usada en la Ola 3).
> Si A5 prefiere otra serie, que la aplique al volcar: lo que importa es que las 3 filas nuevas
> aparezcan con su **evidencia** (fichero + test), no con relleno.

### 5.5 A1 (`docs/**`) — el ADR de E5 + 2 filas de Backlog

1. **El ADR de E5** → texto completo en **§2.6** de este handoff. Título propuesto:
   `ADR-0024 — Identidad declarativa de Sub-Egos y circuit breakers de presupuesto`.
   (A1: verifica el número libre — el 0023 lo tiene A2 pendiente.)
2. **Filas nuevas en `docs/roadmap/Backlog.md`** (formato `EGO-FIND-###`):

| ID | Descripción | Estado |
|---|---|---|
| `EGO-FIND-88` | E5 — la identidad de los Sub-Egos vivía en código (`SubEgoSoul.ts`): crear un especialista exigía tocar TypeScript | ✅ **Completada** (Ola 4b, A3): artefacto declarativo `SOUL.md`/`AGENT.md`, cargador con fallback + fail-closed + confine, ADR-0024 |
| `EGO-FIND-89` | E5 — el presupuesto de Sub-Ego no tenía límite de tiempo ni degradación de modelo, y el tope de coste por llamada no estaba conectado al `ModelRouter` | ✅ **Completada** (Ola 4b, A3): `SubEgoBudgetCircuitBreaker` (tokens/coste/tiempo, contadores medibles, error tipado) + contrato `BudgetAwareRouterLike` (A2 expone `getMaxCostPerCallUsd`/`resolveCheaperModel`) |
| `EGO-FIND-90` | E13 — 0 metatools: `lookup_skills`/`search_tools`/`expand_tools` no existían; el catálogo de tools era fijo por rol/perfil y las skills no eran consultables | ✅ **Completada** (Ola 4b, A3): los 3 metatools con divulgación progresiva, gobernados por el registro confinado |

**Veredicto**: cerrar **E5** y **E13** en `VERDICT.md` §7 (Fase 03) una vez A2 aplique el diff
del `ModelRouter` (§5.1) y A4 los 3 diffs de producción (§5.3) — la capacidad está
**SPECIFIED + IMPLEMENTED + VERIFIED** en mi zona; lo que falta es el **cableado en el
producto** (otra zona).

---

## 6. Deuda / no resuelto

1. **El producto todavía no usa E5 ni E13**: los 3 diffs de §5.3 (A4) son el cuello de botella
   para que la identidad declarativa y los metatools sean alcanzables desde la app. **Bloqueo:
   A4** (no owner).
2. **El `ModelRouter` no expone todavía `getMaxCostPerCallUsd()` ni `resolveCheaperModel()`**: sin
   ese diff (A2, §5.1) el circuit breaker funciona, pero la degradación por coste sólo puede
   usar el `cheaperModelId` explícito del manifiesto. **Bloqueo: A2** (no owner).
3. **`budgetBreaker` no cuelga todavía de `DelegationRuntimeDeps`**: lo he dejado en
   `SubEgoRuntime` (mi zona) y propongo añadirlo a `DelegationRuntimeDeps` en la misma ola que el
   diff del `ModelRouter` (A2, §5.1, última línea del diff) o en A4 (§5.3). Es una línea.
4. **El `lookup_skills` no tiene catálogo por defecto**: sin `SkillCatalogLike` inyectado falla con
   `MetaToolError` (fail-closed, por diseño). El adaptador de 5 líneas está en §5.3. **Hoy
   `registerMetaTools` lo registra siempre** (aunque no haya catálogo) y el error salta **al
   invocarlo**, no al registrarlo: así el catálogo de tools es estable y el fallo es explícito
   en el momento en que el modelo pide una skill. Si A4 prefiere que `lookup_skills` **no
   aparezca** en el catálogo cuando no hay skills configuradas, que lo registre condicionalmente
   (son 3 líneas). **A4, decisión tuya.**
5. **A7 debe ejecutar `pnpm install`** (heredado de la Ola 3): materializa `@ego/security` (devDep
   de `packages/tools`) y `@ego/tools` (devDep de `packages/recovery`). Sin install, CI no
   compila. Yo no he instalado nada.
6. **El `lint` global es un gate compartido**: estaba en rojo por trabajo concurrente de A4
   (`apps/desktop/scripts/t11-*.cjs`). Al cierre de esta ola está **verde** (exit 0). Si A4 vuelve
   a añadir scripts con `console`, vuelve a saltar.
7. **La identidad declarativa no tiene todavía "plantillas"**: no he creado ningún `SOUL.md` de
   ejemplo en disco. Es material de producto (A1/A8) o un test-fixture; no lo he hecho para no
   escribir fuera de mi zona.
8. **El `expand_tools` no expone el cuerpo de las skills**: `lookup_skills` sí (con
   `includeBody`). Es intencional: son dos escalas distintas.

---

## 7. Ficheros tocados

**Nuevos (5 de producción + 3 de test):**

| Fichero | Qué |
|---|---|
| `packages/subegos/src/soulDocument.ts` | parser puro del artefacto (`frontmatter` + cuerpo) |
| `packages/subegos/src/SubEgoIdentity.ts` | declaración en el manifiesto + cargador (fallback/fail-closed/confine) |
| `packages/subegos/src/SubEgoBudgetBreaker.ts` | circuit breaker de tokens/coste/tiempo + contrato con el router |
| `packages/tools/src/meta/skillCatalog.ts` | catálogo de skills (contrato estructural) + motor de ranking |
| `packages/tools/src/meta/metaTools.ts` | los 3 metatools + `registerMetaTools` + `META_TOOL_NAMES` |
| `packages/subegos/test/SubEgoIdentity.test.ts` | 16 tests (E5 identidad) |
| `packages/subegos/test/SubEgoBudgetBreaker.test.ts` | 15 tests (E5 presupuesto) |
| `packages/tools/test/meta-tools.test.ts` | 15 tests (E13 metatools) |

**Modificados (9):**

`packages/subegos/src/SubEgoSoul.ts` · `packages/subegos/src/SubEgoManifest.ts` ·
`packages/subegos/src/SubEgoRuntime.ts` · `packages/subegos/src/SubEgoBudget.ts` ·
`packages/subegos/src/types.ts` · `packages/subegos/src/index.ts` · `packages/tools/src/index.ts` ·
`packages/tools/src/TempWorkspace.ts` · `packages/tools/src/native/fs/NativeFsEditTool.ts`
· `packages/tools/test/temp-workspace.test.ts` · `packages/tools/test/fs-edit-patch.test.ts` ·
`packages/subegos/test/delegation-runtime.test.ts`

---

## 8. RESULTADO

```text
RESULTADO: {
  agente: A3-ola4b,
  status: COMPLETO,
  scope: "Ola 4b — Fase 03 (Sub-Egos): T1 (E5) + T2 (E13) + T3 (3 correcciones) + T4 (peticiones)",
  archivos_modificados: [
    "packages/tools/src/meta/{skillCatalog,metaTools}.ts",
    "packages/tools/src/TempWorkspace.ts",
    "packages/tools/src/native/fs/NativeFsEditTool.ts",
    "packages/tools/src/index.ts",
    "packages/tools/test/{meta-tools,temp-workspace,fs-edit-patch}.test.ts",
    "packages/subegos/src/{soulDocument,SubEgoIdentity,SubEgoBudgetBreaker}.ts",
    "packages/subegos/src/{SubEgoSoul,SubEgoManifest,SubEgoRuntime,SubEgoBudget,types,index}.ts",
    "packages/subegos/test/{SubEgoIdentity,SubEgoBudgetBreaker,delegation-runtime}.test.ts",
    "docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A3-ola4b.md"
  ],
  hallazgos_resueltos: [
    "E5-a (identidad declarativa): el 'alma' de un Sub-Ego pasa de código (`SubEgoSoul.ts`, 628 líneas) a un artefacto `SOUL.md`/`AGENT.md` (frontmatter YAML + cuerpo Markdown) que el manifiesto declara",
    "E5-a: fallback al loader en código si no se declara, fail-closed con `required: true`, confine de ruta (path traversal ⇒ error tipado), round-trip alma→markdown→alma estable",
    "E5-b (budget circuit breakers): `SubEgoBudgetCircuitBreaker` con 4 límites medibles (tokens_per_call, cost_per_call, daily_cost, turn_duration); al superarlos DEGRADA o DETIENE con error tipado",
    "E5-b: tope efectivo = MÍNIMO(Sub-Ego, router); contadores numéricos (turns/degradedTurns/stoppedTurns/tokensUsed/costUsd/totalDurationMs); integrado en `SubEgoRuntime` (opcional)",
    "E13-a (`lookup_skills`): metatool que busca en un catálogo de skills inyectado (`SkillCatalogLike`, DIP) y devuelve SÓLO las relevantes; divulgación en dos pasos (`includeBody`)",
    "E13-b (`search_tools`): metatool que busca tools en el registro y devuelve RESÚMENES (sin schema), con filtros por categoría y riesgo",
    "E13-c (`expand_tools`): metatool que expone el schema JSON completo de un subconjunto de tools, fail-closed ante tool desconocida reutilizando `findMissingTools` (ToolContract, NO duplicado)",
    "E13-c: gobernado por el registro confinado del Sub-Ego (no expone tools fuera de su ámbito)",
    "E13-d (ejecutor por defecto de la delegación): ya cumplía `StructuredChildOutput` desde la Ola 1; añadido el test que lo demuestra (antes sólo comprobaba 'output definido')",
    "T3.1: lint global rojo por import duplicado en `fs-search-tools.test.ts` — ya corregido; verificado con oxlint (0 errores) y `pnpm lint` exit 0",
    "T3.2: convergencia de `TempWorkspace` con A4 — raíz única `ego-test-scratch`, run-dir `run-<epochMs>-<pid>-<rand6>`, barrido por PID MUERTO (la antigüedad = red de seguridad)",
    "T3.2: teardown idempotente (force + maxRetries 5 + retryDelay 200) e `isProcessAlive` exportado para que A4 use la MISMA implementación",
    "T3.3: `fs_edit_patch` con hunks parciales (recorte por prefijo/sufijo común hasta la coincidencia única, `replace` recortado de forma correspondiente), dry-run y fail-closed ante `find` ambiguo",
    "T3.3: cierra la deuda nº 5 de la Ola 3 (`fs_edit_patch` sin hunks parciales)"
  ],
  verify: {
    tests: "561 passed / 0 failed (tools 173 + subegos 253 + tasks 84 + recovery 51) — +56 tests vs Ola 3; 0 regresiones",
    typecheck: "exit 0 (`pnpm -r typecheck` global, 19 paquetes + apps)",
    lint: "exit 0 (`pnpm lint`)",
    build: "exit 0 (`pnpm --filter @ego/tools --filter @ego/subegos build`; su `dist/` lo consumen `integrations` y `apps/desktop`)",
    tdd_rojos_demostrados: [
      "T3.2 → 4/13 fallos (divergencias con la convención de A4)",
      "T3.3 → 3/13 fallos (hunks parciales no soportados)",
      "E5 identidad → 15/16 fallos (`parseSoulDocument is not a function`)",
      "E5 presupuesto → 14/14 fallos (`SubEgoBudgetCircuitBreaker is not a function`)",
      "E13 metatools → 15/15 fallos (`rankSkills is not a function`)"
    ],
    calidad: "0 `catch {}` vacíos en mi zona · 0 mojibake en los 18 ficheros tocados + el handoff · 0 dirs huérfanos / 0 MB retenidos en `%TEMP%/ego-test-scratch` tras la corrida"
  },
  solicitudes_handoff: 4,
  fuera_de_zona: [
    "A2 (§5.1): `ModelRouter` debe exponer `getMaxCostPerCallUsd()` y `resolveCheaperModel()` (extrayendo la selección de candidatos de `enforceCostBudget`, NO duplicándola)",
    "A2 (§5.1): con ese diff, el circuit breaker degrada con el modelo más barato del router en vez de sólo con el `cheaperModelId` explícito",
    "A2 (§5.2): `memoryRecall({trust_aware:true})` (VDB-REQ-15) — la capacidad YA EXISTE en el binding 0.9.0 (`vantadb-node@0.9.0/index.d.ts:607`)",
    "A2 (§5.2): NO HAY ni una llamada a `memoryRecall` en todo el repo; diff exacto del wrapper en `EgoMemoryAdapter` + helper `trustedAllowPrefixes` en `TrustBoundary`",
    "A4 (§5.3): 3 diffs para que E5/E13 lleguen a producción (`resolveTurnSoul` carga la identidad; `registerMetaTools` con el adaptador de `SkillScanner`; metatools en el clon confinado)",
    "A5 (§5.4): volcar la tabla de los 21 patrones (+3 nuevos: OCLW-19 identidad declarativa, OCLW-20 circuit breaker, OCLW-21 metatools) en `docs/review/`",
    "A1 (§5.5): aplicar el texto del ADR de E5 (§2.6) y las 3 filas de Backlog EGO-FIND-88/89/90"
  ],
  deuda_abierta: [
    "E5/E13 están SPECIFIED + IMPLEMENTED + VERIFIED en mi zona, pero NO son alcanzables desde el producto hasta que A4 aplique los 3 diffs de §5.3 (cuello de botella de la fase, no de mi zona)",
    "La degradación por coste usa hoy el `cheaperModelId` explícito del manifiesto; el modelo más barato del router requiere el diff de A2 en §5.1",
    "`budgetBreaker` está en `SubEgoRuntime` pero no cuelga de `DelegationRuntimeDeps` (1 línea; puede ir con el diff de A2 o de A4)",
    "A7: `pnpm install` (heredado de la Ola 3) — materializa `@ego/security` en tools y `@ego/tools` en recovery; sin install CI no compila. Yo no he instalado nada",
    "El `lint` global es un gate compartido: A4 dejó el repo en rojo en la Ola 3 con `apps/desktop/scripts/t11-*.cjs`; al cierre de esta ola está verde (exit 0)",
    "No hay `SOUL.md` de ejemplo en disco: es material de producto (A1/A8) o fixture; no lo he creado para no escribir fuera de mi zona",
    "El churn de ≈1 GB por corrida (preasignación de VantaDB) sigue: agrupar stores entre ficheros de test cambiaría el aislamiento ⇒ decisión de producto"
  ],
  SKILLS_CARGADAS: ["test-driven-development", "systematic-debugging", "code-review-and-quality"]
}
```
