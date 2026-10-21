# A4 — Ola 9 (2ª parte) · Vista filtrada del registro de tools por Sub-Ego

> Fecha: 2026-10-21 · Zona: `packages/tools/**` + `packages/subegos/**` + `apps/desktop/**`.
> Sin commits. Sin `git checkout/reset/stash/clean`. Sin `pnpm install`.
> No he tocado `packages/{avatar,integrations,security,runtime}/**`, `docs/**`, la raíz ni
> `scripts/**` (A6/A3/A2-bis/A1/A7).

---

## 0. RESULTADO rápido

| Ítem | Estado | Evidencia |
|---|---|---|
| **T1** inventario real (consultas → qué ve hoy) | ✅ | tabla en §1 (con `fichero:línea`) |
| **T2** vista filtrada implementada e integrada | ✅ **CERRADO en mi zona** | `packages/tools/src/subEgoView.ts` (nuevo) + la E13 sobre la vista (§3) |
| **T3** el budget por Sub-Ego ve la vista | ✅ | `resolveSubEgoToolSurface` + el ejecutor de la delegación (§4) |
| **T4** TDD real (rojo → verde) | ✅ | RED: **6/6 fallan** sin el filtrado → VERDE: 6/6 (§5) |
| **T5** lo que no hay que romper | ✅ | `tools` 181 ✓ · `subegos` 253 ✓ · desktop 436 ✓ (el global sigue consultable) |
| **T6** documentación | ✅ | texto para A1 (§8) + borrador de ADR (§9) |

**Verificación**: `@ego/tools` typecheck 0 · `@ego/subegos` typecheck 0 · `@ego/desktop` typecheck 0 ·
`@ego/tools` test **181** ✓ · `@ego/subegos` test **253** ✓ · `@ego/desktop` test **436** ✓ (402 sin los 3 ficheros de A3) ·
`design-lint` 0 · `verify-vantadb-ids` 0 · `pnpm -r typecheck`/`pnpm lint` → §10 (bloqueo ajeno).

---

## 1. T1 — El inventario real (con `fichero:línea`)

### 1.1 El registro y cómo se registra una tool

| Qué | Dónde | Estado |
|---|---|---|
| El registro | `packages/tools/src/ToolRegistry.ts:23` (`ToolRegistry`, un `Map<string, ToolDefinition>`) | **fuente de verdad única** ✓ |
| Cómo se registra | `packages/tools/src/ToolRegistry.ts:36` (`register(tool, {allowOverride})`) → `:49` (`this.tools.set(tool.name, Object.freeze({...tool}))`) | — |
| `origin` (procedencia) | `packages/tools/src/types.ts:25` → `"native" \| "mcp" \| "custom" \| "skill"` | **NO es de quién** |
| `owner` / `subEgoId` de la tool | — | **NO EXISTÍA** (el `subEgoId` de `types.ts:34` es del `ToolExecutionContext`, no de la definición) → **hueco** |
| Filtro por Sub-Ego | — | **NO EXISTÍA** → **hueco** |

### 1.2 La tabla de consultas → qué ve hoy (y qué ve ahora)

| # | Consulta | Dónde (antes) | Qué veía | Qué ve **ahora** |
|---|---|---|---|---|
| 1 | **La superficie del modelo** (`toAiSdkTools` → el loop) | `packages/tools/src/ToolRegistry.ts:231` → el loop (`packages/runtime`) | el **GLOBAL** | la **vista** del Sub-Ego del turno → *pendiente de A2-bis* (§7.1) |
| 2 | **`search_tools`** (E13, resumen) | `packages/tools/src/meta/metaTools.ts:231` (`registry.list()`) | el **GLOBAL** | la **vista** del `context.subEgoId` ✓ (hecho) |
| 3 | **`expand_tools`** (E13, schema completo) | `packages/tools/src/meta/metaTools.ts:345` (`registry.exportJsonSchemas()`) | el **GLOBAL** | la **vista** ✓ (hecho), y el chequeo de existencia se hace **sobre la misma superficie** → fail-closed |
| 4 | **La ejecución** de una tool | el loop (`packages/runtime`) → `registry.get(name)` | el **GLOBAL** | la **vista** → *pendiente de A2-bis* (§7.1) |
| 5 | **El budget por Sub-Ego** | — | **NO EXISTÍA** | la **superficie efectiva** = declarada ∧ vista ✓ (hecho, §4) |
| 6 | **La declaración** del Sub-Ego (`manifest.tools`) | `packages/subegos/src/types.ts:142`; sólo se copia en `apps/desktop/src/main/ipc/canonical-specialists.ts:147` | **inerte** (nadie la filtra) | **aplicada**: la superficie efectiva la respeta ✓ |
| 7 | **La introspección** (UI, servidor MCP, `ipc.mcp.*`) | `apps/desktop/src/main/ipc/domains/mcp.ts:208`, `apps/desktop/src/main/window/create-window.ts:772` | el **GLOBAL** | el **GLOBAL** (deliberado: es la vista del *usuario*, T5) ✓ |
| 8 | **El filtro por rol** (delegación) | `packages/subegos/src/DelegationRouter.ts:757` (`getAllowedToolsForRole`) | filtra lo **pedido**, por **rol** | se mantiene (es otra eje: rol ≠ dueño) ✓ |

### 1.3 El arrival tardío

`packages/integrations/src/mcp/McpClient.ts:424` → `registry.register(toolDef, { allowOverride: true })`:
las tools de un servidor MCP que se conecta **en caliente** se registran en el
registro **global** → todo consumidor que consulta en el momento de la llamada
las ve ✓ (por eso hoy no hay divergencia: **nadie copia** el registro).

**Pero** llegan **sin dueño** → visibles para todos los Sub-Egos → el
agujero de aislamiento (documentado en §2.3 y en el ADR de §9). El
registro debe pasar a declarar el dueño → *pendiente de A3* (§7.2).

### 1.4 Dónde está hoy la decisión de filtrado

**No está** → ese es el hueco. Lo único que hay:
- `packages/subegos/src/DelegationRouter.ts:135` (`BLOCKED_CHILD_TOOLS`) y `:757`
  (`getAllowedToolsForRole`): un filtro por **rol** sobre lo **pedido** (no
  sobre la superficie del registro).
- `packages/tools/src/toolsets.ts:180` (`cloneRegistryForProfile`): un **clon**
  por perfil de toolsets — **no lo usa nadie** y, además, congelaría el
  catálogo (el arrival tardío no aparecería).

---

## 2. T2 — La vista filtrada: diseño y justificación

### 2.1 Dónde vive y por qué

**`packages/tools/src/subEgoView.ts`** (nuevo) — el dueño del registro es quien
define la proyección ✓.

```ts
export function subEgoToolsView(registry: ToolRegistry, subEgoId: string): ToolRegistryView
```

**Criterios que pedía el brief** (y cómo los cumple):

| Criterio | Cómo |
|---|---|
| **Una sola fuente de verdad** | la vista no copia nada: cada consulta recalcula el filtro sobre el registro vivo ✓ |
| **El arrival tardío se ve sin reconstruir** | la vista consulta el `Map` en cada llamada → una tool registrada después aparece ✓ (test (2)) |
| **El coste de la vista es bajo** | un predicado por tool sobre un catálogo de ~20: O(n) por consulta, sin estado propio ✓ |
| **La E13 sigue funcionando** | `search_tools`/`expand_tools` consultan la vista cuando el contexto trae `subEgoId` ✓ (test (3)) |

**Por qué NO un clon** (que era la opción B'): un clon **congela** el catálogo
en el momento del clonado → las tools que llegan tarde (las de un servidor
MCP que se conecta) **no aparecerían** → el Sub-Ego perdería tools que hoy
sí puede usar (una regresión silenciosa) ✗.

### 2.2 El contrato nuevo (`ToolDefinition`)

```ts
export interface ToolDefinition<…> {
  …
  /** Sub-Ego dueño de la tool. `undefined` ⇒ GLOBAL. */
  readonly ownerSubEgoId?: string;
}
```

Y el registro acepta el dueño en la llamada (para las tools que se registran
"en nombre de" un Sub-Ego):

```ts
registry.register(tool, { ownerSubEgoId: "ego.antonio" });
```

El dueño declarado **en la propia tool** tiene prioridad sobre el de la
llamada (`packages/tools/src/ToolRegistry.ts:49`).

### 2.3 La regla (fail-closed, explícita) y el **hallazgo de seguridad**

> Una tool es visible en la vista de `subEgoId` si y sólo si:
> - **tiene dueño** y el dueño es `subEgoId` → **privada** ✓
> - **no tiene dueño** → **GLOBAL**: la ven todas las vistas.

**⚠️ Hallazgo de seguridad (lo digo explícitamente, como pide el brief):**
*"sin dueño ⇒ global"* es una regla **abierta por defecto**: si alguien
registra una tool **privada** sin declarar dueño, **todo Sub-Ego la ve**.

- **Hoy es inocuo**: las ~20 tools del producto son infraestructura
  compartida (fs, git, terminal, MCP, delegación, metatools) y no son de
  ningún Sub-Ego.
- **Mañana no lo será**: las tools que *nacen* de un Sub-Ego (su servidor
  MCP, sus skills) son privadas por naturaleza → **deben declarar dueño**.
- **Mitigaciones**: (a) el dueño es un campo de **primera clase** del
  contrato (no un parámetro suelto); (b) la regla está escrita, testada
  (test (5)) y documentada; (c) `expand_tools` **falla cerrado** ante una
  tool fuera de la vista (no devuelve un schema vacío: **lanza**) → el
  aislamiento no es decorativo.

**La alternativa (fail-closed puro: "sin dueño ⇒ invisible para los
Sub-Egos")** la descarté: dejaría **vacía** la superficie de todos los
Sub-Egos (ninguna tool tiene dueño hoy) → la delegación se rompería. Queda
como decisión del owner en el ADR (§9).

### 2.4 La integración (TODAS las consultas de la tabla)

| # | Consulta | Integración | Estado |
|---|---|---|---|
| 1 | La superficie del modelo | el loop debe pedir `subEgoToolsView(registry, ctx.subEgoId)` | 📤 **A2-bis** (§7.1) |
| 2 | `search_tools` | `surfaceFor(registry, context)` (`packages/tools/src/meta/metaTools.ts:264`) | ✅ **hecho** |
| 3 | `expand_tools` | `surfaceFor(registry, context)` (`:379`) + el chequeo de existencia sobre la **misma** superficie (fail-closed) | ✅ **hecho** |
| 4 | La ejecución | el loop debe resolver por la vista | 📤 **A2-bis** (§7.1) |
| 5 | El budget por Sub-Ego | `resolveSubEgoToolSurface` (declarada ∧ vista) | ✅ **hecho** (§4) |
| 6 | La declaración (`manifest.tools`) | la superficie efectiva la aplica (por fin no es inerte) | ✅ **hecho** |
| 7 | La introspección | el **global**, sin cambios | ✅ **deliberado** (T5) |
| 8 | El filtro por rol | sin cambios (es otro eje: rol ≠ dueño) | ✅ |

**Sin `subEgoId` en el contexto** (la introspección de la UI, el servidor
MCP, las tools de la delegación) → la superficie es el **registro global**
✓ (fail-open *de la vista*, no del aislamiento: es el usuario mirando).

---

## 3. La E13 sobre la vista (el detalle que la hace funcionar)

Los metatools reciben `execute(input, context)` → el `ToolExecutionContext`
**ya lleva `subEgoId`** (`packages/tools/src/types.ts:34`) ✓ → no hacía falta
cambiar ningún contrato de llamada.

```ts
function surfaceFor(registry, context?): ToolQuerySurface {
  const subEgoId = context?.subEgoId;
  return subEgoId ? subEgoToolsView(registry, subEgoId) : registry;
}
```

Y `expand_tools` **falla cerrado**: pedir la tool de otro Sub-Ego **lanza**
(`no existen en el registro disponible para este ámbito`) en vez de devolver
un schema vacío ✓ → el aislamiento es real, no decorativo.

---

## 4. T3 — El budget por Sub-Ego ve la vista

**Antes**: el budget por Sub-Ego de tools **no existía**; `manifest.tools`
(la declaración) era **inerte** (se copiaba al manifiesto y nadie la
aplicaba) y `SubEgoBudget` (`packages/subegos/src/SubEgoBudget.ts`) mide
**tokens y coste**, no tools.

**Ahora**: `packages/tools/src/subEgoView.ts` →

```ts
export function resolveSubEgoToolSurface(options: {
  subEgoId: string;
  declaredTools: readonly string[];   // lo que declara el manifiesto
  view: ToolRegistryView;             // su vista
}): SubEgoToolSurface
```

→ `{ tools (declarada ∧ visible), missing (declarada pero no visible), budget }`.

**Por qué la intersección y no sólo la vista**: el budget debe medir **la
superficie que el Sub-Ego usa** → lo que **declaró** (su presupuesto
declarado) ∧ lo que **ve** (su aislamiento). Medir el registro global
mediría una superficie que no se usa (el bug que el brief señala) y medir
sólo la vista contaría tools que el Sub-Ego no pidió.

**Integración**: el ejecutor de la delegación del desktop
(`apps/desktop/src/main/window/create-window.ts:440`) resuelve la superficie
del hijo y la **expone** en el resultado (`toolSurface: { tools, missing, budget }`)
→ el budget del Sub-Ego es **observable** y no teórico ✓.

**Test** (test (4)): dos Sub-Egos con declaraciones distintas ⇒ presupuestos
distintos y **coherentes con lo que cada uno ve** (2 ≠ el `registry.count()`
global = 4) ✓.

---

## 5. T4 — TDD real

**Fichero**: `packages/tools/test/subEgo-view.test.ts` (6 tests).

### 5.1 El RED (el filtrado deshecho = el estado previo)

Desactivé el predicado de visibilidad (volviendo al "sin filtrado" de hoy)
y repetí:

```text
$ npx vitest run test/subEgo-view.test.ts
 Test Files  1 failed (1)
      Tests  6 failed (6)
```

→ **los 6 tests fallan** sin el filtrado ✓ → el test prueba el
comportamiento nuevo y **falla si se deshace** ✓.

### 5.2 El VERDE

```text
$ npx vitest run test/subEgo-view.test.ts
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

| Test | Qué afirma |
|---|---|
| (1) | un Sub-Ego **no** ve la tool privada de otro (`view.has(...) === false`, `count() === 1`) |
| (2) | **arrival tardío**: ve la suya aunque se registre **después** de creada la vista (sin reconstruir) → `count() === 2` (la global + la suya) |
| (3) | la **E13 sobre la vista**: `search_tools` ve sólo lo suyo; `expand_tools` **falla cerrado** ante la tool de otro y da el schema completo de la suya |
| (4) | el **budget** refleja la vista: 2 tools, no las 4 del global; `missing` lista la declarada-but-not-visible |
| (5) | la **regla fail-closed es explícita**: con dueño → privada; sin dueño → global |
| (6) | el **registro global sigue consultable** (la vista se añade, no sustituye) |

---

## 6. T5 — Lo que NO se rompe

| Suite | Resultado |
|---|---|
| `@ego/tools` (21 ficheros) | **181 tests ✓** (el registro, la divulgación y los toolsets siguen verdes) |
| `@ego/subegos` (22 ficheros) | **253 tests ✓** |
| `@ego/desktop` (70 ficheros) | **436 tests ✓** (402 de ellos sin los 3 ficheros de A3; incluye la E13 del Ola 5: `meta-tools-integration.test.ts`) |

**El registro global** sigue siendo consultable: `registry.count()`,
`registry.list()`, `registry.has()` → intactos ✓ (el test (6) lo verifica).

**Ningún test existente falló** ⇒ el contrato **no** cambió: se **añadió** una
vista (y un campo opcional `ownerSubEgoId` + `toolSurface?`), sin tocar las
firma de `register` más allá de una opción opcional ✓.

---

## 7. Solicitudes fuera de zona (texto exacto)

### 7.1 A2-bis (`packages/runtime/**`) — el loop debe usar la vista

**Por qué**: el **loop** es quien construye la superficie del modelo
(`toAiSdkTools`) y quien resuelve la tool que el modelo invoca. Hoy usa el
registro **global** → un Sub-Ego ve (y puede invocar) las tools privadas de
otro.

**Fichero**: `packages/runtime/src/ToolExecutionLoop.ts` (el `toolRegistry` que
recibe) → la vista se pide al registro, **no se clona**:

```ts
// Ola 9 · vista filtrada por Sub-Ego (decisión del owner 2026-10-21):
// la superficie del modelo y la resolución de la tool se hacen sobre la
// VISTA del Sub-Ego del turno, no sobre el registro global.
//
// `subEgoToolsView` NO clona: recalcula el filtro en cada consulta sobre el
// registro vivo → el *arrival tardío* (una tool que se registra en caliente)
// se ve sin reconstruir nada. El contrato vive en `@ego/tools`
// (`subEgoToolsView`, `resolveSubEgoToolSurface`).
import { subEgoToolsView } from "@ego/tools";

const view = ctx.subEgoId
  ? subEgoToolsView(this.toolRegistry, ctx.subEgoId)
  : this.toolRegistry;

// 1) La superficie del modelo:
//    view.toAiSdkTools(...)  ← el view expone el mismo contrato
// 2) La resolución de una tool invocada:
//    const tool = view.get(name);  → si no está, "tool desconocida" (fail-closed)
```

**Lo que necesito de A2-bis** (con el texto exacto, porque el tipo del view
debe encajar):
- que el `ToolExecutionContext` del loop ya lleve `subEgoId` (hoy sí lo
  lleva: `packages/tools/src/types.ts:34` ✓) → el view se puede pedir sin
  tocar nada más;
- que la **resolución** de una tool use `view.get(name)` en vez de
  `registry.get(name)` → **fail-closed**: una tool que no está en la vista no
  existe para ese Sub-Ego.

**Nota**: `ToolRegistryView` no expone `toAiSdkTools` todavía (mi módulo sólo
proyecta `list`/`get`/`has`/`count`/`exportJsonSchemas`). Si A2-bis lo
necesita, que me lo pida y añado `toAiSdkTools` al view (o que lo componga
con `view.list()`), **sin que el view clone nada**.

### 7.2 A3 (`packages/integrations/**`) — el arrival tardío debe declarar dueño

**Por qué**: `packages/integrations/src/mcp/McpClient.ts:424` registra las
tools del servidor MCP **sin dueño** → quedan **globales** → cualquier
Sub-Ego las ve (el agujero de aislamiento documentado en §2.3).

**Fichero**: `packages/integrations/src/mcp/McpClient.ts:424`:

```diff
-      registry.register(toolDef, { allowOverride: true });
+      // Ola 9 · vista filtrada por Sub-Ego (decisión del owner 2026-10-21):
+      // la tool de un servidor MCP que se conecta EN CALIENTE es de quien
+      // pidió el servidor. Sin dueño, la regla "sin dueño ⇒ global" la
+      // expondría a TODOS los Sub-Egos (agujero de aislamiento).
+      registry.register(toolDef, {
+        allowOverride: true,
+        ...(ownerSubEgoId !== undefined ? { ownerSubEgoId } : {}),
+      });
```

**De dónde sale `ownerSubEgoId`**: del contexto de la conexión (el servidor
MCP que se conecta pertenece a un Sub-Ego) → si el servidor MCP es
**global** (el caso normal: el servidor de la app), se deja sin dueño
(= global) ✓.

**Lo que necesito**: que `McpClient` pueda recibir el `ownerSubEgoId` de la
conexión (el `McpManager` ya lo sabe: es quien tiene el `serverId` y su
ámbito) → y me digas cómo se lo pasa, porque `McpClient` es zona de A3.

### 7.3 A1 (`docs/**`) — la fila del Backlog (texto exacto en §8) + el ADR (§9)

---

## 8. El texto exacto para A1 (`docs/roadmap/Backlog.md`)

**`docs/**` es de A1**: no he tocado el fichero. La fila que describe el
registro global y la E13 (los metatools) → que la A1 ya conoce; el texto
que hay que añadir es:

> **Estado real 2026-10-21 (Ola 9, A4 — decisión del owner "vista filtrada por Sub-Ego"):**
> el registro de tools global sigue siendo la **única fuente de verdad** (no se
> clona) y cada Sub-Ego consulta una **proyección** filtrada por dueño
> (`packages/tools/src/subEgoView.ts` → `subEgoToolsView`); el *arrival tardío*
> (una tool que se registra en caliente, p. ej. al conectarse un servidor MCP)
> se ve **sin reconstruir nada**, porque la vista recalcula el filtro en cada
> consulta. Regla (explícita, fail-closed): tool **con dueño** → privada de su
> Sub-Ego; tool **sin dueño** → global. La E13 (`search_tools`/`expand_tools`)
> consulta la **vista** (fail-closed: pedir la tool de otro es un error, no un
> schema vacío) y el **budget por Sub-Ego** mide su superficie efectiva
> (declarada ∧ vista), no el registro global. `manifest.tools` —que hasta
> ahora era una declaración inerte— pasa a ser el presupuesto declarado que la
> superficie efectiva aplica. Pendiente: la superficie del modelo y la
> resolución de la tool las aplica el loop (`packages/runtime`, A2-bis) y el
> dueño del arrival tardío lo declara la conexión MCP (`packages/integrations`,
> A3).

**Y la fila del Backlog de la E13 / metatools** (la que A1 tenga localizada):
añadir al final de sus notas:

> La divulgación progresiva (E13) se apoya en la **vista filtrada** por Sub-Ego
> (Ola 9): `search_tools` devuelve el resumen de lo que ese Sub-Ego ve y
> `expand_tools` el schema completo de lo suyo — una tool privada de otro
> Sub-Ego **no es expandible** (falla cerrado, no devuelve un schema vacío).

---

## 9. Borrador de ADR (para que lo publique A1)

> ### ADR-00XX — Vista filtrada del registro de tools por Sub-Ego
>
> **Contexto.** El registro de tools (`packages/tools`) es global y lo consultan
> (a) la superficie del modelo, (b) la E13 (`search_tools`/`expand_tools`) y
> (c) la ejecución. No había **dueño** en `ToolDefinition` (`origin` dice de
> dónde viene, no de quién es) ni filtro por Sub-Ego: las tools de arrival
> tardío (las de un servidor MCP que se conecta en caliente) se filtraban de
> forma **desigual** según el Sub-Ego que consultara. La única近似 aproximación
> era `cloneRegistryForProfile` (un **clon**, sin uso): congelaría el
> catálogo y el arrival tardío no aparecería.
>
> **Decisión.** El registro global **sigue siendo la única fuente de verdad**.
> Cada Sub-Ego consulta una **proyección** (`subEgoToolsView`): un predicado
> por tool, recalculado en cada consulta (⇒ el arrival tardío se ve sin
> reconstruir nada, sin clones y sin divergencia).
>
> **Regla de visibilidad (fail-closed).** Con dueño (`ownerSubEgoId`) → privada
> de su Sub-Ego. **Sin dueño → global.**
>
> **Consecuencias.** + El aislamiento por Sub-Ego es real y comprobable
> (`expand_tools` falla cerrado ante una tool ajena). + `manifest.tools` deja de
> ser inerte: es el presupuesto declarado que la superficie efectiva aplica, y
> el budget por Sub-Ego mide la superficie **que se usa** (declarada ∧ vista),
> no el catálogo global. − **Agujero de aislamiento conocido**: una tool
> registrada sin dueño es visible para todos. Hoy es inocuo (las tools del
> producto son infraestructura compartida), pero las tools que *nacen* de un
> Sub-Ego deben declarar dueño → el `ownerSubEgoId` es de primera clase en el
> contrato y la conexión MCP lo declara (A3); el loop aplica la vista a la
> superficie del modelo y a la resolución (A2-bis).
>
> **Alternativas descartadas.** *Clon por perfil*: congela el catálogo (el
> arrival tardío no aparece) y multiplica la memoria por Sub-Ego. *Fail-closed
> puro ("sin dueño ⇒ invisible")*: dejaría vacía la superficie de todos los
> Sub-Egos (ninguna tool tiene dueño hoy) y rompería la delegación. *Filtrar
> en la capa que consulta*: duplicaría la regla en tres sitios (la E13, el
> loop y el budget) y cada copia se olvidaría de actualizarse.

*(El ADR lo redacta y publica A1: `docs/**` es suyo.)*

---

## 10. Verificación y el único bloqueo

| Comando | Exit | Resumen |
|---|---|---|
| `pnpm --filter @ego/tools typecheck` | **0** | — |
| `pnpm --filter @ego/subegos typecheck` | **0** | — |
| `pnpm --filter @ego/desktop typecheck` | **0** | — |
| `pnpm --filter @ego/tools test` | **0** | **21 ficheros · 181 tests** |
| `pnpm --filter @ego/subegos test` | **0** | **22 ficheros · 253 tests** |
| `pnpm --filter @ego/desktop test` | **0**¹ | **70 ficheros · 436 tests** |
| `pnpm -r typecheck` | **0** | todos los paquetes (A6 ya terminó con el avatar) |
| `pnpm lint` | **0** | el presupuesto de lint se respeta |
| `node apps/desktop/scripts/design-lint.cjs` | **0** | 12 reglas · 0 errores |
| `node scripts/verify-vantadb-ids.mjs` | **0** | 0 errores |
| `pnpm --filter @ego/desktop build` (+ `verify-dist`) | **0** | “TODOS LOS CHEQUEOS EN VERDE” |

¹ **El falso rojo de A3 (acotado, con la prueba)**: la primera pasada del
suite del desktop dio **3 ficheros / 10 tests en rojo**:
`mcp-server-runtime.test.ts` (3), `mcp-token-channel.test.ts` (2) y
`t-x1-scratch.test.ts` (1, que flaggea el test nuevo de A3 por crear scratch
fuera de la raíz compartida).

**Son trabajo SIN COMMIT de A3**, y lo comprobé:
- `apps/desktop/src/main/mcp/mcp-server-runtime.ts` → **modificado** (no lo
  he tocado yo) y `mcp-token-broker.ts` + `mcp-token-keychain.ts` → **ficheros
  nuevos sin seguimiento** (el canal del token del MCP, `EGO-FIND-81`);
- `apps/desktop/test/mcp-token-channel.test.ts` → **fichero nuevo sin
  seguimiento** (no tiene commit);
- la causa de los 401 es el **token del MCP**, que nada de lo mío toca.

**Prueba de que no es mío**: excluyendo esos 3 ficheros, el resto de la
suite del desktop pasa entero:

```text
$ npx vitest run --exclude "**/mcp-server-runtime.test.ts" \
                 --exclude "**/mcp-token-channel.test.ts" \
                 --exclude "**/t-x1-scratch.test.ts"
 Test Files  67 passed | 1 skipped (68)
      Tests  402 passed | 5 skipped (407)
```

Además, el fallo del `t-x1-scratch` **es literalmente sobre el fichero
nuevo de A3** (`mcp-token-channel.test.ts`), no sobre ninguno mío.

> Nota: `pnpm -r typecheck` y `pnpm lint` salían ≠ 0 hace una hora por los
> 3 errores de tipos de `packages/avatar/` (A6, en paralelo) → **ya están
> resueltos** (A6 terminó): ambos salen **exit 0** ahora ✓.

---

## 11. Deuda que dejo

1. **La superficie del modelo y la resolución de la tool las aplica el loop**
   (`packages/runtime`, A2-bis) → hasta que lo haga, el aislamiento es
   **parcial**: la E13 (lo que el modelo *ve*) está filtrada, pero una tool
   invocada directamente por nombre se resolvería contra el global. Está
   en §7.1 con el texto exacto.
2. **El arrival tardío sin dueño sigue siendo global** hasta que A3 declare
   el dueño en la conexión MCP (§7.2).
3. **La vista no expone `toAiSdkTools`**: si A2-bis lo necesita, lo añado
   (sin clonar nada).
4. **El filtro por rol** (`getAllowedToolsForRole`) sigue siendo un eje
   **independiente** del dueño: un Sub-Ego puede ver una tool que su rol no
   le permite usar (o al revés). Son dos ejes distintos (aislamiento por
   Sub-Ego vs. permisos por rol) y no los mezclé ✓.
