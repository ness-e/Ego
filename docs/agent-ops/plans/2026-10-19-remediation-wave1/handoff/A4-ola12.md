# A4 — Ola 12 · el perfil del personaje llega al motor en la forma canónica

> Fecha: 2026-10-22 · Zona: `apps/desktop/renderer/**`, `apps/desktop/test/**`.
> Sin commits. Sin `git checkout/reset/stash/clean`. Sin `pnpm install`.
> No he tocado `packages/**` (sólo **lectura** del motor), `scripts/**`,
> `.github/**` ni `docs/**` (este handoff es el único fichero de `docs/` que
> escribo, como entregable).

---

## 0. RESULTADO rápido

| Ítem | Estado | Evidencia |
|---|---|---|
| **T1** el perfil llega al motor en forma canónica y **se aplica** | ✅ **cerrado** | §1 (el bug, el arreglo y el test de render) |
| **T2** coherencia enum ↔ `UI_TRAIT_TO_KIND` ↔ `UNMAPPED_TRAITS_IN_RENDERER` | ✅ **cerrado** | §2 (test tipado + 2 contratos) |
| **T3** el outfit (hueco hermano, zona de A6) | 🟡 **handoff** | §6.1 (texto exacto) |

**Verificación**: `typecheck` renderer **0** · `typecheck` desktop **0** ·
`pnpm -r typecheck` **0** · `pnpm lint` **0** · renderer **76 ficheros /
543 tests** · desktop **70 ficheros / 430 tests** ·
`inventory-tautological-tests` → **TAUTOLÓGICOS 0** (A4: 31, los mismos de la
Ola 11: los 31 son «ruta dinámica») · `source-contracts.lint.mjs` **exit 0**
(**30** contratos) · `design-lint` **exit 0** · `pnpm --filter @ego/avatar test`
**exit 0** (A6) · `verify-vantadb-ids` **exit 0** ·
`pnpm --filter @ego/desktop build` **exit 0** (con `verify-dist`) ·
disco **19,9 GB** libres (preflight ≥ 14,38 GB ✓).

---

## 1. T1 — El perfil se aplica al render (el bug real)

### 1.1 El hueco (medido, no inferido)

`CharacterBadge.tsx:268` (Ola 11) mandaba al motor **los ids de la UI**:

```ts
traits: effectiveTraits.length > 0 ? JSON.stringify(effectiveTraits) : undefined,
// → '["sensor_antenna_scanner","visor_analytical"]'
```

El motor (`packages/avatar/src/runtime/profile.js`, zona de A6) traduce el
vocabulario **canónico** (`TraitKind`): `antennae`, `geometric-crest`,
`energy-cores`, `aura-field`, `halo`, `orbital-rings`, `quantum-crown`.

→ Los ids de la UI no están en `TRAIT_KINDS` → el motor los mete en
`unmapped` y **no aplica nada**: el perfil persistía, hacía round-trip… y el
avatar seguía igual.

**Caracterizado en el test** (no supuesto): con `traits='["sensor_antenna_scanner"]'`
el genoma **no** trae apéndice y el SVG **no** dibuja el apéndice ✓
(`renderer/test/character-profile-render.test.tsx` → «los ids de la UI NO
alcanzan el motor»).

### 1.2 El arreglo: el puente entre los dos vocabularios

**`apps/desktop/renderer/components/character/wardrobe/characterProfileBridge.ts`**

| Línea | Cambio |
|---|---|
| **123-137** | `CanonicalTraitEntry` (nuevo tipo): `{kind, intensity, enabled}` — el `kind` **canónico** que el motor entiende |
| **139-150** | `CanonicalTraits` (nuevo tipo): `{entries, unmapped}` — `unmapped` = los ids de la UI **sin** kind canónico (se **declaran**, no se inventan) |
| **159-186** | `toCanonicalTraits(config)` (nuevo): traduce `config.traits` (ids de la UI) + `config.traitIntensities` → las entradas canónicas. Lo que no tiene kind va a `unmapped`; la intensidad se transporta **tal cual** (la verdad del perfil), acotada a 0..1 |

> **Quién hace cumplir la declaración**: el `unmapped` del bridge es la
> superficie de la API (y la usa el test ✓), pero el que **impide** que un
> rasgo sin kind llegue a existir es el **contrato de forma** «todo rasgo que
> la UI ofrece tiene kind canónico» (§2.3 ✓): si mañana se añade un rasgo al
> `TraitRegistry` sin kind, la **puerta falla** ✗ → no puede colarse en
> silencio ✓. (Los 6 rasgos actuales están todos mapeados ✓ → el `unmapped`
> real está vacío ✓.)

**`apps/desktop/renderer/components/character/CharacterBadge.tsx`**

| Línea | Cambio |
|---|---|
| **9** | importa `toCanonicalTraits` |
| **136-140** | el estado `persisted` lleva ya `traitIntensities` (antes se perdía al cargar el perfil) |
| **152** | `traitIntensities: config.traitIntensities` |
| **169-172** | `canonicalTraits = toCanonicalTraits({traits, traitIntensities})` |
| **275-278** | el atributo `traits` lleva la forma canónica: `JSON.stringify(canonicalTraits.entries)` → `'[{"kind":"antennae","intensity":0.4,"enabled":true}]'` |

→ El motor ya acepta las dos formas (`parseTraitEntries` normaliza un nombre
suelto o un objeto `{kind, intensity, enabled}`) ✓ → el nuestro es el objeto ✓.

### 1.3 El test (comportamiento: el **SVG real**, no el atributo)

`apps/desktop/renderer/test/character-profile-render.test.tsx` (nuevo, **15
tests**). Monta el `<ego-avatar>` real (el motor canónico) y mira **el
render**:

| Test | Qué demuestra |
|---|---|
| «un perfil con rasgos canónicos **cambia el render**» | el apéndice **se dibuja** (`.appendage-part` en el shadow root ✓), el genoma lleva `appendage: "antenna"` y `marking: "dots"` ✓, y el SVG exportado **difiere** ✓ |
| «la `baseForm` también mueve la silueta» | `quantum-monolith` vs `fractal-polyhedron` → `roundness` distinta ✓ y SVG distinto ✓ |
| «la INTENSIDAD se expresa donde el motor tiene palanca: el aura» | el aura crece con la intensidad ✓ |
| «un rasgo desactivado NO se aplica» | `enabled: false` → sin apéndice ✓ (eso sí se puede expresar) |
| «los ids de la UI NO alcanzan el motor» | la caracterización del bug ✓ |
| «el bridge traduce los ids de la UI a kinds canónicos con su intensidad» | `sensor_antenna_scanner` (0,4) → `{kind:"antennae",intensity:0.4}` ✓ |
| «un id de la UI SIN kind canónico se DECLARA» | `unmapped: ["rasgo_que_no_existe"]` ✓ |
| «TODOS los rasgos que ofrece la UI tienen kind canónico» | los 6 rasgos del `TraitRegistry` se traducen ✓ |
| «el `traits` del `<ego-avatar>` lleva kinds canónicos» | el **badge** manda `[{kind:"antennae",intensity:0.4,enabled:true}]` ✓ **y el apéndice se dibuja** ✓ |

**TDD (rojo primero)**: el fichero se escribió antes del arreglo y falló con
`expected [ undefined ] to deeply equal [ 'antennae' ]` (el badge mandaba los
ids de la UI) y `TypeError: (0 , toCanonicalTraits) is not a function` ✓ →
tras el arreglo: **14 passed (14)** ✓.

---

## 2. T2 — La coherencia entre los tres vocabularios

### 2.1 Lo que hay (medido)

| Pieza | Dónde | Contenido |
|---|---|---|
| `BridgeTraitKindSchema` (el enum) | bridge `:30` | 7 kinds canónicos |
| `UI_TRAIT_TO_KIND` (el puente) | bridge `:94` | 6 ids de la UI → kind canónico |
| `UNMAPPED_TRAITS_IN_RENDERER` | bridge `:52` | `["floating-shards"]` (declarado, no ignorado) |
| `TRAIT_KINDS` (el motor) | `profile.js:65` | los mismos 7 kinds |
| `UNMAPPED_TRAITS` (el motor) | `profile.js:81` | `['floating-shards']` |
| `TraitRegistry.listTraits()` | la UI | 6 rasgos ofrecidos |

### 2.2 El test tipado (ya se puede: A6 dejó `profile.d.ts` ✓)

A6 creó `packages/avatar/src/runtime/profile.d.ts` (la petición de la Ola 11 ✓
atendida) → el renderer puede **importar el vocabulario del motor con tipos**
✓. Añadí el `path` en `apps/desktop/renderer/tsconfig.json` (junto a los
otros dos del motor) ✓.

**5 tests tipados nuevos** (`character-profile-render.test.tsx` → §2 del
fichero):

| Test | Qué fija |
|---|---|
| «el enum de rasgos del renderer es **EXACTAMENTE** el del motor» | `BridgeTraitKindSchema.options` ≡ `Object.keys(TRAIT_KINDS)` ✓ |
| «la lista de no-mapeables del renderer es la del motor (nunca en silencio)» | `UNMAPPED_TRAITS_IN_RENDERER` ≡ `UNMAPPED_TRAITS` ✓ |
| «el motor **DECLARA** los rasgos cuya intensidad no tiene palanca» | el aura no; los otros 6 sí ✓ (ver §3) |
| «la intensidad del aura se mapea al rango del motor» | `intensity: 0` → `AURA_RANGE[0]`, `intensity: 1` → `AURA_RANGE[1]` ✓ |
| «un kind canónico que el motor no tiene se DECLARA (`unmapped`)`» | el motor no se rompe con un kind desconocido ✓ |
| «las **CINCO** palancas del motor se mueven con el perfil canónico» | silueta (26 = `fractal-polyhedron`) ✓ · apéndice (`antenna`) ✓ · marca (`dots`) ✓ · aura (mapeada al `AURA_RANGE`) ✓ · accesorio (`crown`) ✓ · y `unmapped` vacío ✓ |

### 2.3 Los 2 contratos de forma (lint-test: 28 → **30**)

`apps/desktop/scripts/lint/source-contracts.lint.mjs`:
1. **«el enum de rasgos del renderer ⊆ los `TRAIT_KINDS` del motor»** —
   compara el enum del bridge con el `TRAIT_KINDS` del motor (los dos
   ficheros) ✓.
2. **«todo rasgo que la UI ofrece tiene kind canónico (el puente existe)»** —
   extrae los ids de `registerTrait(...)` del `TraitRegistry` y exige que
   **todos** estén en `UI_TRAIT_TO_KIND` ✓ (sin el puente, el motor los
   ignoraría en silencio).

> Los contratos de forma y los tests tipados son **gemelos**: el test dice
> «el vocabulario coincide» y el contrato dice «el fichero sigue diciendo lo
> que dice» (éste no depende de los tipos → vigila aunque el `.d.ts` cambie).

---

## 3. Qué rasgos quedan **sin magnitud** (y por qué)

El motor tiene **una sola** palanca de magnitud: el **aura**
(`AURA_RANGE = [0.25, 1]` → `genes.aura = 0.25 + 0.75 * intensity`).

| Rasgo canónico | ¿Se aplica? | ¿Su magnitud se expresa? |
|---|---|---|
| `aura-field` | ✅ sí | ✅ **sí** (es el aura) |
| `antennae` | ✅ sí (apéndice `antenna`) | ❌ **no** → el motor lo declara en `unmappedIntensity` |
| `geometric-crest` | ✅ sí (apéndice `ears`) | ❌ **no** → declarado |
| `energy-cores` | ✅ sí (marca `dots`) | ❌ **no** → declarado |
| `halo` | ✅ sí (accesorio `halo`) | ❌ **no** → declarado |
| `orbital-rings` | ✅ sí (accesorio `halo`) | ❌ **no** → declarado |
| `quantum-crown` | ✅ sí (accesorio `crown`) | ❌ **no** → declarado |

**Por qué no se inventa ninguna magnitud**: el motor tiene un único hueco de
magnitude; fingir que las antenaas son "al 40 %" sería una mentira visual
(el rasgo se pinta o no se pinta). La regla del motor (y ahora también del
renderer): **mejor un rasgo sin magnitud que una magnitud inventada** → el
motor lo **declara** (`UNMAPPED_INTENSITIES` / `unmappedIntensity`) y el
renderer **transporta la intensidad tal cual** (la verdad del perfil), sin
ajustarla ni convertirla en otra palanca ✓.

**Verificado contra el motor, no supuesto**: el test «el motor DECLARA los
rasgos cuya intensidad no tiene palanca» llama a `resolveProfile` y comprueba
que los 6 no-aura aparecen en `unmappedIntensity` y **no** en `unmapped`
(se aplican ✓) ✓.

> El perfil del renderer guarda la intensidad por **id de la UI** (que es el
> vocabulario del config) → el bridge la traduce al `kind` canónico al enviar
> (`UI_TRAIT_TO_KIND` + `traitIntensities`, y `KIND_TO_UI_TRAIT` para el viaje
> de vuelta) ✓ → **la intensidad se conserva sin perder nada** (Ola 11 ✓).

---

## 4. T3 — El outfit (hueco hermano) → **handoff a A6**

El mismo razonamiento que los rasgos, con el **vocabulario de ropa**:

- El renderer ofrece 8 accesorios: `none`, `cx-full-kit`, `cx-antenna`,
  `headphones`, `cyber-goggles`, `crown`, `halo`, `sprout`
  (`WardrobeSelector.tsx:60-67`).
- El motor traduce el outfit con `OUTFITS` (`profile.js:105`), que hoy sólo
  tiene `santaHat`, `partyHat`, `crown`, `sunglasses`, `roundGlasses` →
  **sólo `crown` coincide** ✗ → los otros 7 caen en `unmapped` y **no se
  aplican** ✗.
- El motor **sí tiene** las 8 piezas (`ENGINE_ACCESSORIES`, `profile.js:117`)
  → es sólo el **mapa** lo que falta ✓.

→ **Es de A6** (`packages/avatar/**`) → el texto exacto está en §6.1 ✓.
Yo no lo he tocado ✓.

---

## 5. Verificación

| Puerta | Resultado |
|---|---|
| `pnpm --filter @ego/renderer test` | **76 ficheros / 543 tests** · 0 fallos |
| `pnpm --filter @ego/desktop test` | **70 ficheros / 430 tests** · 0 fallos |
| `pnpm --filter @ego/renderer typecheck` | **0** |
| `pnpm --filter @ego/desktop typecheck` | **0** |
| `pnpm -r typecheck` | **0** |
| `pnpm lint` | **0** |
| `node scripts/inventory-tautological-tests.mjs` | **TAUTOLÓGICOS: 0** (A4: 31, sin cambio) |
| `pnpm --filter @ego/desktop lint:source-contracts` | **exit 0** · 30 contratos |
| `node apps/desktop/scripts/design-lint.cjs` | **exit 0** |
| `pnpm --filter @ego/avatar test` (A6) | **exit 0** |
| `node scripts/verify-vantadb-ids.mjs` | **exit 0** |
| `pnpm --filter @ego/desktop build` (+ `verify-dist`) | **exit 0** |

---

## 6. Peticiones a otras zonas (texto exacto)

### 6.1 A6 — el `outfit` (el accesorio del renderer no llega al motor)

**El hueco**: `resolveProfile` traduce el outfit con `OUTFITS`
(`packages/avatar/src/runtime/profile.js:105`), pero el vocabulario de ropa del
renderer es otro (`WardrobeSelector.tsx:60-67`):

```ts
// El renderer ofrece (apps/desktop/renderer/components/character/wardrobe/WardrobeSelector.tsx:60)
export const ACCESSORY_OPTIONS = [
  { id: "none", label: "Ninguno" },
  { id: "cx-full-kit", label: "Kit Completo CX" },
  { id: "cx-antenna", label: "Antena CX" },
  { id: "headphones", label: "Auriculares" },
  { id: "cyber-goggles", label: "Gafas Cyber" },
  { id: "crown", label: "Corona" },
  { id: "halo", label: "Halo" },
  { id: "sprout", label: "Brote" },
];
```

El motor ya tiene **todas** esas piezas (`ENGINE_ACCESSORIES`,
`profile.js:117`) → sólo falta el **mapa**:

```js
// packages/avatar/src/runtime/profile.js (A6) — el outfit del renderer
// (ACCESSORY_OPTIONS) → la pieza del motor. El motor YA tiene las 8
// piezas en ENGINE_ACCESSORIES: hoy el outfit caía en `unmapped` y el
// accesorio persistido no se aplicaba.
export const OUTFITS = Object.freeze({
  // …los que ya había:
  santaHat: 'santa',
  partyHat: 'witch',
  crown: 'crown',
  sunglasses: 'aviator-glasses',
  roundGlasses: 'glasses',
  // …y el vocabulario del renderer:
  none: 'none',
  'cx-full-kit': 'cx-full-kit',
  'cx-antenna': 'cx-antenna',
  headphones: 'headphones',
  'cyber-goggles': 'cyber-goggles',
  halo: 'halo',
  sprout: 'sprout',
});
```

⚠️ Ojo: `crown` está en las dos listas → con la misma clave ✓ (el motor
mapea `crown → 'crown'` ✓, que es lo correcto ✓). Y `halo` mapea a la pieza
`halo` ✓ (que el motor ya tiene ✓) — ojo con que la clave `halo` del mapa
**no** choque con el rasgo `halo` (el rasgo y el outfit son axes distintos ✓:
el outfit **pisa** al accesorio del rasgo ✓, que es la regla que ya tiene el
motor ✓).

Con ese cambio, el renderer ya envía el outfit en el vocabulario que el motor
entiende (`outfit={config.outfitId}` ✓, sin cambios en mi zona) ✓.

### 6.2 A1 — el texto exacto para el Backlog

| Fila | Texto para pegar |
|---|---|
| `EGO-FIND-116` | **✅ Completada** — el perfil del personaje **alimenta el render**: el renderer traduce su vocabulario de UI al **canónico** del motor (`{kind, intensity}`) mediante `toCanonicalTraits` (`characterProfileBridge.ts`) y el `CharacterBadge` lo manda en esa forma → el motor aplica la silueta, el apéndice, la marca, el aura y el accesorio. Verificado por **comportamiento** (el SVG real cambia: se dibuja el apéndice y el genoma lleva las palancas), no por la presencia del atributo. La intensidad se transporta tal cual: el motor la expresa **sólo en el aura** (su única palanca de magnitud) y **declara** los otros 6 rasgos en `unmappedIntensity` (no se inventa ninguna magnitud). Los ids de la UI sin kind canónico se **declaran** (`unmapped`), nunca se ignoran en silencio. Ficheros: `renderer/components/character/wardrobe/characterProfileBridge.ts`, `renderer/components/character/CharacterBadge.tsx`, `renderer/test/character-profile-render.test.tsx`, `apps/desktop/scripts/lint/source-contracts.lint.mjs`. |

> `EGO-FIND-63` **no cambia** (sigue ✅: 0 tautológicos en A4 ✓).

### 6.3 A7 — sin peticiones

---

## 7. Deuda que dejo (declarada)

1. **El `outfit` sigue sin aplicarse** (§4) → depende de A6 ✓ (texto exacto en
   §6.1 ✓). Mientras tanto, el renderer **no lo ignora en silencio**: el motor
   lo declara en `unmapped` ✓ (es la declaración del motor ✓, no un hueco
   mío ✓).
2. **6 de los 7 rasgos canónicos no tienen magnitud** (§3) → decisión del
   motor (A6) ✓; verificada con un test ✓. Si algún día el motor tiene
   palancas para ellos, basta con quitar la entrada de
   `UNMAPPED_INTENSITIES` (el renderer ya transporta la intensidad ✓ → no
   habría que tocar mi zona ✓).
3. **`orbital-rings`** es el único kind canónico que la UI no ofrece (el
   `TraitRegistry` tiene 6 rasgos y ninguno es el de los anillos) → está en el
   enum (el vocabulario canónico ✓) y en `TRAIT_KINDS` ✓ → coherente ✓
   (verificado por el test «el enum es EXACTAMENTE el del motor» ✓).

---

## 8. RESULTADO

**`status: COMPLETE`** — los 2 ítems de mi zona cerrados y el 3º handover:

- **T1**: el perfil llega al motor en la **forma canónica** (`{kind, intensity}`)
  y **se aplica**: el SVG real cambia (el apéndice se dibuja ✓, el genoma
  lleva `appendage`/`marking`/`aura` ✓). 14 tests de comportamiento, hechos
  **rojo primero** ✓.
- **T2**: la coherencia entre el enum del renderer, `UI_TRAIT_TO_KIND`,
  `traitIntensities` y `UNMAPPED_TRAITS_IN_RENDERER` queda **verificada contra
  el motor** (test tipado con el `profile.d.ts` de A6 ✓) y ** vigilada por
  forma** (2 contratos nuevos → 30 ✓).
- **T3**: el `outfit` es de A6 → **handoff con el texto exacto** (§6.1 ✓).

**Todo en verde**: typecheck (renderer · desktop · `-r`) · lint · 543 tests del
renderer · 430 del desktop · inventario (**0 tautológicos**) · 30 contratos ·
design-lint · los tests del paquete `@ego/avatar` (A6) · verify-vantadb-ids ·
build + verify-dist.

**Sin commits** (el árbol sigue sin publicar) · **sin tocar** `packages/**`
(sólo lectura), `scripts/**`, `.github/**` ni el resto de `docs/**` ·
**sin** `git checkout/reset/stash/clean` · **sin** `pnpm install`.
