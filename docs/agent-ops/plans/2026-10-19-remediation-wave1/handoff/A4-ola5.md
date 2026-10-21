# A4 — Ola 5 · E5/E13 al producto + lista blanca por huella + división de IPC + auditoría con color

> Fecha: 2026-10-21 · Zona: `apps/desktop/**` (menos `renderer/floating/vendor/avatar/**` → A6).
> Sin commits. Sin `git checkout/reset/stash/clean`. Sin `pnpm install` (A7 lo estaba reparando:
> el store de pnpm estuvo **vacío** durante la ola; los tests que fallaron por
> "Cannot find module" se reintentaron y pasaron).

---

## 0. RESULTADO rápido

| Ítem | Estado | Evidencia |
|---|---|---|
| **T1** E5 (identidad declarativa) + presupuesto en el producto | ✅ **CERRADO** | 3 diffs de A3 aplicados + verificación de los 3 caminos (§1) |
| **T1** E13 (metatools `lookup_skills`/`search_tools`/`expand_tools`) | ✅ **CERRADO** | Registrados en el registro de producción + 6 tests (§2) |
| **T1** Los 2 métodos del router (A2) | 📤 **ENTREGADO a A2** | §7.1 (diff exacto, con el contrato que mi lado consume) |
| **T2** Lista blanca indexada por hash del contenido | ✅ **CERRADO** | 6 entradas · 79 huellas · 3 casos verificados (§3) |
| **T3** `register-ipc.ts` (2 570 líneas) | ✅ **CERRADO** | **2 571 → 84 líneas**, 22 módulos de dominio + gate de 6 checks (§4) |
| **T4** Auditoría: color + canvas de avatares + camino de referencia | ✅ **CERRADO** | 7/7 pasos, 0 infracciones, **con color** (§5) |

**Verificación global**: `typecheck` desktop 0 · `typecheck` renderer 0 · desktop **66 ficheros / 403 tests** ·
renderer **73 ficheros / 533 tests** · `design-lint` exit 0 (12 reglas, 0 errores) · `build` + `verify-dist` exit 0 ·
`pnpm lint` exit 0 · auditoría **7/7, 0 infracciones, exit 0**.

---

## 1. T1 — E5 (identidad declarativa + presupuesto) LLEGA al producto

### 1.1 El diff 1 de A3 (identidad declarativa) — aplicado, con la semántica de fallo corregida

**Fichero**: `apps/desktop/src/main/subegos/identity.ts` (NUEVO) + `apps/desktop/src/main.ts`.

El diff de A3 cargaba la identidad en `resolveTurnSoul`, pero su `catch` genérico
convertía **el fail-closed en un fallback silencioso**: si la identidad es
**obligatoria** (`required: true`) y su fichero falta, `loadSubEgoIdentity`
lanza `SubEgoIdentityNotFoundError` y el `catch` devolvía el nucleus → el turno
continuaba con **otra identidad** que nadie pidió.

Mi versión (**`src/main/subegos/identity.ts`**) mantiene la fail-closed:

```ts
export async function resolveTurnSoul(subEgoId: string): Promise<SubEgoSoul> {
  try {
    const manifest = await subEgoRegistry?.get(subEgoId);
    if (manifest) {
      const resolution = await resolveSubEgoIdentity(manifest, {
        workspacePath: defaultWorkspaceRoot(),
      });
      for (const warning of resolution.warnings) {
        console.warn(`[resolveTurnSoul] ${warning}`);
      }
      return resolution.soul;
    }
  } catch (err) {
    // Fail-closed de IDENTIDAD: la identidad obligatoria ausente es un
    // error de gobernanza, no un motivo para servir otra identidad.
    if (isRequiredIdentityMissing(err)) throw err;
    // Fallback intencional al nucleus (fail-open solo en identidad, nunca en permisos).
  }
  return getDefaultNucleusSoul();
}
```text

**El camino completo, medido** (`test/subego-identity-integration.test.ts`, 5 tests):

| Escenario | Resultado |
|---|---|
| Manifiesto con `identity: {file: "SOUL.md"}` + fichero real | `source: "file"` · el alma efectiva sale del **fichero** (el manifiesto decía otra cosa) |
| Manifiesto **sin** identidad | `source: "manifest"` · sin avisos → el loader en código sigue siendo la fuente |
| Fichero **no obligatorio** e ilegible | `source: "manifest"` + **aviso** con el nombre del fichero (fail-open de identidad) |
| Fichero **obligatorio** e ilegible | **`SubEgoIdentityNotFoundError`** (fail-closed) |

### 1.2 El diff 2 de A3 (metatools) — aplicado con un catálogo de cuerpo perezoso

**Fichero**: `apps/desktop/src/main/tools/meta-tools.ts` (NUEVO) + `create-window.ts`.

```ts
const skillScanner = new SkillScanner();
setSkillScanner(skillScanner);
registerProgressiveMetaTools(toolRegistry, { scanner: skillScanner });
```

**Divulgación progresiva de verdad**: el catálogo que se inyecta expone el
cuerpo de cada skill como **getter perezoso** → el `SKILL.md` se lee del disco
**sólo** cuando el metatool pide `includeBody: true` (y la entrada ha salido
en los resultados). Sin eso, la "divulgación en dos pasos" era de mentira: el
cuerpo viajaba en memoria en cada llamada.

**El camino completo, medido** (`test/meta-tools-integration.test.ts`, 6 tests):

| Afirmación | Verificación |
|---|---|
| Los 3 metatools quedan **registrados** | `registry.has("lookup_skills"/"search_tools"/"expand_tools")` ✓ |
| `lookup_skills` devuelve el **resumen** primero | `matches[0]` = id, nombre, descripción, etiquetas · **sin `body`** ✓ |
| `lookup_skills` con `includeBody` trae el cuerpo **bajo demanda** | `matches[0].body` = el contenido del `SKILL.md` ✓ |
| `expand_tools` expone un **subconjunto** con el **schema completo** | `expanded: ["fs_read_file"]` · `parameters.properties` con sus campos ✓ |
| `expand_tools` **falla cerrado** ante una tool inexistente | `rejects.toThrow(/no existen/)` ✓ |
| `search_tools` devuelve **resúmenes** (sin schema) | `matches[0].inputSchema` undefined ✓ |

> ⚠️ Detalle de la API de A3: el schema completo viaja en **`parameters`**
> (no en `inputSchema`) → el `ToolJsonSchema` del registro lo llama así.

### 1.3 El diff 3 de A3 (metatools en el clon confinado) — **no hay ancla**

A3 pedía registrar los metatools **también** en el clon confinado de cada
Sub-Ego (`cloneRegistryForProfile`). En el desktop **ese clon no existe**:
`cloneRegistryForProfile` vive en `packages/tools` y **no lo usa nadie**; el
desktop tiene **un** registro de producción (el del turno), que es el que ve
el modelo.

**Decisión**: registro los metatools en el registro real del turno → la
invariante de gobernanza que A3 quería («los metatools ven sólo lo que su
registro ve») **se cumple por construcción**: ven exactamente lo que ve el
turno. Implementar un clon por Sub-Ego sería un cambio de gobernanza mayor
(afectaría a qué tools puede invocar cada Sub-Ego) → **decisión de producto,
no mía**; queda anotado en §7.3.

### 1.4 El circuito de presupuesto (E5, segunda mitad) — cableado con contrato estructural

**Fichero**: `apps/desktop/src/main/subegos/budget-guard.ts` (NUEVO) +
`handle-llm-stream.ts` + `main.ts`.

- El breaker de A3 (`SubEgoBudgetCircuitBreaker`) y su contrato
  `BudgetAwareRouterLike` (estructural, con los 2 métodos **opcionales**) se
  usan **sin dependencia dura** de `packages/models`.
- Mi lado (`budget-guard.ts`) NO importa `@ego/models`: pide el router por la
  interfaz estructural ✓ → cuando A2 añada los 2 métodos, el cast desaparece
  solo y el tope efectivo pasa a ser el **MÍNIMO** (propio del Sub-Ego ∨ global).
- El turno **evalúa antes** y **registra después**:

```ts
// handle-llm-stream.ts (antes del loop)
const budget = await ctx.evaluateTurnBudget({
  subEgoId,
  estimate: { tokens: estimatePromptTokens(req.prompt ?? "") },
});
if (budget.stop) throw budget.error ?? new Error(budget.reason ?? "…");
if (budget.modelConfig) turnModelConfig = budget.modelConfig;   // degrada
```text

```ts
// (después del loop)
await ctx.recordTurnBudget({
  subEgoId,
  usage: { tokens: loopResult.usage?.totalTokens ?? 0, durationMs: …, model: … },
});
```

**El camino completo, medido** (`test/budget-breaker-integration.test.ts`, 8 tests):

| Afirmación | Verificación |
|---|---|
| El circuito **DEGRADA** a un modelo más barato | `decision.outcome === "degrade"` + `modelConfig` resuelta ✓ |
| Si el router **no encuentra** modelo barato → **DETIENE** con error tipado | `SubEgoBudgetCircuitBreakerError` con `limit: "cost_per_call"` ✓ |
| Si la degradación **no se puede traducir** a configuración → **DETIENE** (fail-closed: seguir con el caro violaría el tope) | `stop: true` + motivo explícito ✓ |
| El tope efectivo es el **MÍNIMO** (Sub-Ego ∨ router) | `effectiveCostCapUsd` ✓ |
| El límite de **tokens por llamada** es efectivo **sin router** | `estimateTokens` (heurística `chars/3`, la del motor nativo) ✓ |
| El límite de **duración** abre el circuito → el turno siguiente se detiene | `turn_duration` ✓ |
| Sin manifiesto → no hay presupuesto → el turno pasa | `outcome: "allow"` ✓ |

> **Qué queda INERTE hasta que A2 entregue los 2 métodos**: los límites de
> **coste** (por llamada y diario) — el desktop no calcula el coste en USD
> (lo sabe el router) → se registra 0. Los de **tokens** y **duración** ya son
> efectivos hoy. Es el contrato que A2 desbloquea (§7.1).

---

## 2. T1 — Qué hay que actualizar en el Backlog (para A1)

Las filas que A1 dejó en 🟡 por "implementado pero inalcanzable" **ahora son
alcanzables**, con esta evidencia:

| Fila | Antes | Ahora | Evidencia |
|---|---|---|---|
| `EGO-FIND-88` (E5 identidad) | 🟡 inaccesible | ✅ | `resolveTurnSoul` → `resolveSubEgoIdentity` (`src/main/subegos/identity.ts`) · 5 tests |
| `EGO-FIND-89` (E5 presupuesto) | 🟡 inaccesible | ✅ (parcial: falta A2) | `budget-guard.ts` + `handle-llm-stream.ts` · 8 tests · el tope de coste queda pendiente de A2 |
| `EGO-FIND-90` (E13 metatools) | 🟡 inaccesible | ✅ | `registerProgressiveMetaTools` en `create-window.ts` · 6 tests |

---

## 3. T2 — La lista blanca se indexa por **hash del contenido**, no por ID posicional

### 3.1 El problema (medido)

La lista blanca usaba `lines: [[60,75]]` (rangos **posicionales**) y el ID
`EGO-DL-0NN` como clave. Un hex literal nuevo o eliminado en un fichero
**desplazaba** las líneas → la excepción dejaba de suprimir nada (la puerta
fallaba con *"EGO-DL-010 no suprime nada"*) o suprimía otra cosa.

### 3.2 La corrección

**`apps/desktop/scripts/design-lint.cjs`**:

```js
function fingerprintOf(file, match) {
  return createHash("sha256")
    .update(`${file}\u0000${match}`)
    .digest("hex")
    .slice(0, 16);
}
```text

La clave de una excepción es ahora **(regla, fichero, hash del contenido
infractor)**. Si el contenido cambia, la excepción **deja de suprimir** → la
puerta falla de verdad (obligando a revisar la excepción) en vez de
desplazarse en silencio. Los rangos de líneas se eliminan del mecanismo (son
posicionales por definición).

**La migración es mecánica**: el propio linter imprime el bloque nuevo
(`--prune` → las huellas se calculan de los hallazgos suprimidos) y un script
lo inyecta (`t-x1-reindex-whitelist.cjs`).

**Resultado**: `6 entradas · 79 huellas de contenido` (antes: 5 entradas con
rangos de líneas). Motivo, fecha e ID **se conservan** (el ID pasa a ser
informativo, no la clave).

### 3.3 Los 3 casos verificables (`renderer/test/design-lint.test.tsx`, +3 tests)

| Caso | Verificación |
|---|---|
| **(a) sin cambios** → el mismo resultado | la puerta sigue **verde** con las mismas cuentas (81 R1 granfathered, 1 R2, 3 R9, 40 R12) ✓ |
| **(b) AÑADIR un hex a un fichero con excepción** → la puerta **falla** | `#ff00aa` añadido a `DesignSystemProvider.tsx` → `status 1` y el hallazgo R1 con ese hex ✓ (no se desplaza) |
| **(c) ELIMINAR el hex** → la puerta avisa de que la excepción **sobra** | `report.staleWhitelist` incluye `EGO-DL-001` ✓ (no se ignora en silencio) |

---

## 4. T3 — `register-ipc.ts`: el criterio de división y su gate

### 4.1 El criterio (decisión de A4, como owner técnico)

> **Un módulo por DOMINIO DE CANAL**: `ipc.<dominio>.*` → un fichero en
> `src/main/ipc/domains/`.

**Por qué este y no otro** (A1 pidió justificarlo):

1. **El canal ya codifica el dominio.** La división no es arbitraria: es la
   taxonomía que el producto expone (el `preload`, los esquemas Zod, la API
   del renderer). No inventa una taxonomía nueva.
2. **Los canales de un dominio comparten estado e invariantes** (el registro
   de proyectos, el store de sesiones, el catálogo de modelos): juntos, sus
   invariantes quedan en un sitio y **el dominio de fallo es evidente**.
3. **Es estable**: añadir un canal a un dominio no toca otro fichero.
4. **Es verificable**: de aquí sale un gate (abajo).

**Alternativas descartadas**:
- **Por proceso** (main / preload / renderer): el fichero entero ES la parte
  del main → no divide nada.
- **Por capa** (validación / persistencia / transporte): dispersaría los
  canales de un dominio en 3 ficheros → el lector tendría que saltar, y los
  invariantes de un dominio quedarían repartidos.

### 4.2 El resultado (medido)

| | Antes | Ahora |
|---|---|---|
| `src/main/ipc/register-ipc.ts` | **2 571 líneas** | **84 líneas** (raíz de composición) |
| Ficheros de IPC | 3 | **26** (22 de dominio + `domain-support.ts` + `canonical-specialists.ts` + la raíz) |
| Fichero más grande | 2 571 | **360** (`domains/settings.ts`) |
| Canales registrados | 81 | **81** (los mismos) |

Módulos: `memory` · `subegos` · `approval` · `gov` · `llm` · `mcp` · `skills` ·
`projects` · `net` · `snapshots` · `settings` · `decision` · `knowledge` ·
`daily` · `domains` · `tasks` · `floating` · `terminal` · `sessions` ·
`hooks` · `voice` · `models`.

- `src/main/ipc/domain-support.ts` — los helpers que usan **más de un
  dominio** (el enmascarado de las keys de proveedor, que consumen `settings`
  y `snapshots`): duplicarlos sería crear dos verdades; meterlos en un
  dominio los ataría a ese dominio.
- `src/main/ipc/canonical-specialists.ts` — el catálogo de especialistas y su
  siembra: es **DATO**, no un handler (270 líneas que no deben decidir el
  tamaño del fichero de IPC).

### 4.3 El gate (`apps/desktop/test/ipc-modules-gate.test.ts`, 6 tests)

| Check | Qué garantiza |
|---|---|
| (a) | ningún fichero de `src/main/ipc/**` supera **400 líneas** |
| (a2) | `register-ipc.ts` es una raíz (≤ 400 líneas), no un god-file |
| (b) | cada canal del `preload` (`EgoIpcInvokeChannels`) se registra en **exactamente un** módulo (ni dos, ni ninguno) |
| (c) | la raíz registra **todos** los dominios |
| (d) | un módulo sólo contiene canales de **su** dominio |
| (e) | el número de canales sigue siendo **81** (el contrato no cambia) |

---

## 5. T4 — La auditoría visual: color, canvas de avatares y camino de referencia

### 5.1 Medición de color (el hueco de `brand ≡ warning`)

**`apps/desktop/scripts/design-audit-spec.mjs`** (nuevo, compartido por los
dos caminos):

- `colorToRgb(value)` — OKLCH o HEX → RGB 0..255.
- `readDesignTokens(providerSource, presetName)` — los tokens del preset
  desde la **fuente única** (`DesignSystemProvider.tsx`).
- `findTokenCollisions(tokens, pairs)` — **la colisión**: dos tokens que deben
  ser distinguibles (`brand`/`warning`, `brand`/`error`, `success`/`error`,
  `text`/`dim`, `dim`/`faint`…) con el **mismo RGB**.
- `sampleScreenshotColors(page, pngBuffer)` — **los píxeles REALES**: la
  captura PNG se dibuja en un canvas dentro del navegador y se leen con
  `getImageData` (es la salida real del compositor, no los estilos
  calculados).
- `colorsMatch(observed, expectedToken, tolerance)` — compara el color
  observado con el token (tolerancia de 3 por canal).

**Qué comprueba la corrida**:

1. El **fondo renderizado** (el pixel de la esquina) es el token `paper` del
   preset → si la app pintara un color congelado, la auditoría lo vería.
2. **No hay colisiones** entre los tokens que deben ser distinguibles → la
   colisión `brand ≡ warning` (que la auditoría anterior no podía ver, porque
   no miraba color) **se detecta**.

Medición real de la corrida (step `01-chat-vacio`):

```json
{"dominant":"7,7,9","corner":"21,21,23",
 "palette":[{"rgb":"7,7,9","count":678566},{"rgb":"21,21,23","count":522131},
            {"rgb":"35,35,40","count":95237},{"rgb":"6,6,8","count":35713}]}
```

`21,23` = `#151517` = el token `paper` del preset `default-dark` ✓.

### 5.2 El canvas de avatares, por fin auditado

El `WardrobeSelector` **sólo se monta** en la pestaña *Avatares y Mascota* de
*Personalización*, que la auditoría **no abría** → el avatar nunca se auditaba
en modo canvas. Nuevo paso en el spec compartido:

```js
{ id: "04b-avatares-canvas",
  click: "loc=role:button[name='Avatares y Mascota']",
  wait: 1800,
  note: "Canvas de avatares (WardrobeSelector)" },
```text

**Y encontró un defecto real**: al abrirlo, la auditoría="_reportó 6
infracciones `TARGET`": dos botones del panel de avatares medían **18 px**
(muy por debajo del objetivo táctil mínimo de 24 px del design system).

**Causa**: un `Button size="sm"` del `WardrobeSelector` con `h-auto` (para que
las etiquetas largas se partan por palabra) → el `h-7` del kit quedaba
anulado y la altura la marcaba el contenido (18 px).

**Fix** (`renderer/components/character/wardrobe/WardrobeSelector.tsx`):

```diff
- className={`h-auto w-full rounded-md whitespace-normal text-left ${…
+ // Ola 5 · T4: `h-auto` a secas dejaba el botón en 18 px (por debajo del
+ // objetivo táctil mínimo de 24 px): lo detectó la auditoría al abrir por
+ // fin esta superficie. `min-h-7` mantiene el crecimiento con el suelo de 28 px.
+ className={`h-auto min-h-7 w-full rounded-md whitespace-normal text-left ${…
```

### 5.3 El camino de referencia (ego-lite): estado explícito y no se reintenta en balde

- **El verde falso ya no existe** (Ola 4): si el compositor no produce frames,
  el informe sale con `exitCode 2` y un error explícito.
- **Ahora además se recuerda**: `run-design-audit.ps1` guarda
  `%TEMP%\ego-audit-compositor.json` (`{dead, at}`) cuando el camino de
  referencia no da pasos; mientras siga muerto (24 h), **no se vuelve a
  intentar** (cada intento cuesta ~30 s y no puede dar nada) y se cae al
  rescate con un aviso explícito.

### 5.4 La corrida verde (output)

```bash
$ pwsh -File apps/desktop/scripts/run-design-audit.ps1 -Out $env:TEMP\ego-audit-ola5
[audit] 7/7 pasos ok
[audit] infracciones: 0 {}
[audit] maximizada: true · viewport forzado: true · pestañas abiertas: 1
[audit] informe: …\ego-audit-ola5\report.json
[audit] capturas: …\ego-audit-ola5\shots

[audit] runner:
[audit] 7/7 pasos ok
[audit] infracciones: 0 {}
[audit] capturas: 7 · maximizada: True · viewport forzado: True
EXIT=0
```

**Superficies auditadas: 7** (antes 6) — con el **canvas de avatares**
incluido y la **medición de color** activa.

---

## 6. Verificación

| Comando | Exit | Resumen |
|---|---|---|
| `pnpm --filter @ego/desktop typecheck` | **0** | sin errores (tras la división de 22 módulos) |
| `pnpm --filter @ego/renderer typecheck` | **0** | sin errores |
| `pnpm --filter @ego/desktop test` | **0** | **66 ficheros · 403 tests** (Ola 4: 62 · 378 → **+4 · +25**) |
| `pnpm --filter @ego/renderer test` | **0** | **73 ficheros · 533 tests** |
| `node apps/desktop/scripts/design-lint.cjs` | **0** | 12 reglas · **0 errores** · 135 ficheros |
| `pnpm --filter @ego/desktop build` + `verify-dist.cjs` | **0** | “TODOS LOS CHEQUEOS EN VERDE” |
| `pnpm -r typecheck` | **0** | todos los paquetes |
| `pnpm lint` | **0** | ratchet cumplido |
| `run-design-audit.ps1` | **0** | **7/7 pasos · 0 infracciones** · 7 capturas · color medido |

**TDD (RED pegado)**: la auditoría verde con color detectó **6 `TARGET`
reales** al abrir el canvas de avatares (18 px < 24 px) → fix en el
`WardrobeSelector` → verde. El gate de T3 falló primero con *"dominios no
registrados en la raíz"* y *"canales fuera de su dominio"* hasta que el
criterio quedó aplicado de verdad.

---

## 7. Solicitudes fuera de zona (con diff exacto)

### 7.1 A2 (`packages/models`) — los 2 métodos del router (desbloquean el tope de coste)

**Fichero**: `packages/models/src/ModelRouter.ts` — **es exactamente el diff de
A3-ola4b §5.1**, que A2 ya tiene; lo que cambia es que **ahora hay un
consumidor en el producto** y un contrato **estructural** que ya está en
`packages/subegos` (`BudgetAwareRouterLike`, con los dos métodos **opcionales**).

Lo que mi lado consume (contrato, no implementación):

```ts
// packages/subegos/src/SubEgoBudgetBreaker.ts — YA EXISTE (A3)
export interface BudgetAwareRouterLike {
  getMaxCostPerCallUsd?(): number | undefined;
  resolveCheaperModel?(options: {
    maxCostPerCallUsd: number;
    capabilities?: readonly string[];
  }): string | null | Promise<string | null>;
}
```text

**El cast que hoy hay en `apps/desktop/src/main.ts`** (y que desaparecerá solo
cuando A2 añada los métodos):

```ts
router: modelRouter as unknown as BudgetRouter,
```

**Lo que se desbloquea** (hoy **inerte**):

| Límite | Hoy | Con los 2 métodos de A2 |
|---|---|---|
| Tokens por llamada | ✅ activo | ✅ |
| Duración del turno | ✅ activo | ✅ |
| Coste por llamada | ❌ inerte (el desktop no calcula USD) | ✅ tope = MÍNIMO(propio, global) + degradación |
| Gasto diario | ❌ inerte | ✅ |

**Y un segundo punto** (también A2): el desktop persiste **una** configuración
de modelo (`gov/settings/model_config`), así que **no sabe construir** la de
un id arbitrario → si el circuito degrada a `modelo-barato` y el desktop no
puede resolverlo, el guard **detiene** (fail-closed). Para que la degradación
sea operable hace falta una fuente de "id de modelo → configuración" (el
`ModelCatalog` que ya se usa en `ipc.models.listModels` es un candidato).

### 7.2 A1 (`docs/**`) — el Backlog y el design system

1. **Backlog**: las 3 filas de E5/E13 pasan de 🟡 a ✅ con la evidencia de §2.
2. **`docs/design/design-system.md`**:
   - la **nueva regla R12** (CSS crudo: `!important` y `rgb()/hsl()` literales
     fuera de los ficheros de tokens) y la deuda nombrada `EGO-DL-024`
     (`floating/floating.css`, 40 hallazgos);
   - **R7** ahora cubre las tablas `cva({…})` (antes sólo el JSX literal);
   - la **lista blanca por hash del contenido** (§3): es un cambio de
     CONTRATO de la puerta (la clave ya no es el ID posicional);
   - el **objetivo táctil de 24 px** que la auditoría ahora mide también en el
     canvas de avatares (§5.2).
3. **ADR-0024** (A3): mi lado lo respeta (identidad + presupuesto por
   Sub-Ego, sin duplicar la política de modelos).

### 7.3 Owner / A1 — decisiones de producto que NO son mías

1. **El clon confinado por Sub-Ego** (diff 3 de A3): en el desktop **no
   existe** `cloneRegistryForProfile` y hay **un** registro de producción. Los
   metatools ven exactamente lo que ve el turno ✓, pero un Sub-Ego **no está
   confinado** a un subconjunto de tools. Implementarlo es un cambio de
   gobernanza (afectaría a qué puede invocar cada Sub-Ego) → **decisión de
   producto**.
2. **El coste en USD lo calcula el router, no el desktop** → mientras A2 no
   exponga la estimación, los límites de coste no vigilan nada (§7.1).

---

## 8. Deuda que dejo

1. **El camino de referencia (ego-lite)**: el compositor ha vuelto a funcionar
   (7/7 hoy), así que el estado "muerto" no se activó; el mecanismo queda
   probado por el camino de rescate (que es el que se usa si vuelve a caer).
2. **La medición de color compara el fondo y detecta colisiones de token**;
   no hace yet una comparación **elemento a elemento** (qué píxel debería ser
   `brand` y cuál `warning`). Es el siguiente paso natural.
3. **`domain-support.ts` y `canonical-specialists.ts`** son de "soporte": no
   son dominios de canal, pero viven bajo `src/main/ipc/` y los vigila el
   gate de tamaño ✓.
4. **El gate de IPC no comprueba todavía** que los módulos no importen unos a
   otros (hoy no lo hacen: la dependencia real es `register-ipc.ts` → dominio).
5. **El `tsconfig.json` del desktop sólo incluye `src/**/*`**: los ficheros de
   `apps/desktop/test/**` **no se typechequean** (lo medí: incluirlos da 151
   errores, casi todos del *renderer* — el tsconfig del desktop no tiene las
   lib del DOM). Mis tests nuevos son correctos en runtime, pero un error de
   tipos en un test **no lo vería** `pnpm --filter @ego/desktop typecheck`.
   Arreglarlo exige un tsconfig de tests con `lib: DOM` → decisión de A7/A1
   (toca `apps/desktop/package.json`/tsconfig, fuera de mi alcance de esta
   ola).
