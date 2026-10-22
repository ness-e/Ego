# Handoff A6 (Ola 12) — 2026-10-22 — las dos peticiones de A4 sobre el perfil del personaje

> Zona de A6: `packages/avatar/**`,
> `apps/desktop/renderer/floating/vendor/avatar/**` y
> `docs/extractions/coucou.md`. Sin commits. Sin `pnpm install`.

## 0. Resumen ejecutivo (léase primero)

Las dos peticiones de A4 (§8.1 de `A4-ola11.md`) están aplicadas.

| Petición | Estado | Resultado |
|---|---|---|
| **(a)** `profile.d.ts` | ✅ | Declaración pública nueva en `src/runtime/profile.d.ts` (junto al `.js`), **con la firma de A4** y además las piezas nuevas de la Ola 12. El paquete además **exporta** `./runtime/profile.js` ⇒ el renderer puede importarlo sin tocar su `tsconfig`. |
| **(b)** La intensidad viaja | ✅ | El atributo `traits` acepta **las dos formas** (`["halo"]` y `[{"kind":"halo","intensity":0.4}]`), y la intensidad **se expresa con las palancas que el motor ya tiene**. Test propio que demuestra que **el render cambia** (el SVG real). |

**Clasificación**: lo nuevo es **código propio** ⇒ **derivados 58 (SIN cambio) ·
nativos 33 → 35**. El recuento de derivados **no baja** ⇒ **no he sustituido
geometría por propia** ⇒ no hay nada que re-declarar en el manifiesto.

## 1. T1(a) — `profile.d.ts`

**Fichero nuevo**: `packages/avatar/src/runtime/profile.d.ts` (junto al `.js`, que
es el patrón que ya usa el paquete: `runtime/avatar-element.d.ts`,
`runtime/sound.d.ts`).

Contiene **exactamente** la forma que propone A4 (para que su test tipado
compile tal cual):

```ts
export declare const BASE_FORMS: Readonly<Record<string, { roundness: number; ratio: number }>>;
export declare const TRAIT_KINDS: Readonly<Record<string, Readonly<Record<string, string>>>>;
export declare const UNMAPPED_TRAITS: readonly string[];
export declare const OUTFITS: Readonly<Record<string, unknown>>;
export declare const UNMAPPED_OUTFITS: readonly string[];
export declare function parseTraits(json: string | null | undefined): string[];
export declare function resolveProfile(profile: {...} | null | undefined): unknown;
```

…y además lo que la Ola 12 necesita, **sin romper la forma de A4**:

| Export | Tipo | Nota |
|---|---|---|
| `TraitEntry` | interfaz | `{kind, intensity, enabled}` |
| `BaseFormShape` | interfaz | `{roundness, ratio}` |
| `ResolvedProfile` | interfaz | el tipo REAL de `resolveProfile` (A4 lo dejó en `unknown`: con `unknown` su test tipado no podría leer `r.shape.roundness`) |
| `CharacterProfile` | interfaz | el perfil que llega del renderer |
| `AURA_RANGE` | `readonly [number, number]` | el rango del aura del genoma (la palanca de la intensidad) |
| `UNMAPPED_INTENSITIES` | `readonly string[]` | los rasgos que se aplican pero **sin** magnitud expresable |
| `ENGINE_ACCESSORIES` | `readonly string[]` | las 16 piezas que el motor tiene |
| `parseTraitEntries(json)` | `TraitEntry[]` | la entrada completa, con su intensidad |
| `applyProfileToGenome(genome, profile)` | `object` | aplica el perfil al genoma |

> `parseTraits` mantiene **exactamente** la firma que propone A4
> (`(json) => string[]`) ⇒ su test compila sin cambios.

**Además**: `packages/avatar/package.json` **exporta** `./runtime/profile.js`
(`package.json:24`) ⇒ el renderer puede `import … from "@ego/avatar/runtime/profile.js"`
**sin** tocar su `tsconfig.json` (el `paths` que propone A4 sigue sirviendo,
pero ya no es necesario). Esto es necesario para que el import no falle con
TS2307/TS7016.

## 2. T1(b) — La intensidad viaja y se expresa

### 2.1 El formato que el motor acepta

`parseTraits` (L185) y `parseTraitEntries` (L159) aceptan **las dos formas**:

```js
parseTraits('["halo","antennae"]')                       // → ['halo','antennae']
parseTraits('[{"kind":"halo","intensity":0.4}]')         // → ['halo']
parseTraits('["halo",{"kind":"antennae","intensity":0.2}]') // → ['halo','antennae']
parseTraitEntries('[{"kind":"halo","intensity":0.4}]')   // → [{kind:'halo',intensity:0.4,enabled:true}]
```

Y `resolveProfile` (L196) trabaja con las **entradas**, no con los nombres ⇒ la
intensidad llega hasta la palanca.

### 2.2 Dónde se expresa la intensidad

El motor tiene **una sola** palanca de intensidad: **el aura** (el genoma lo
tiene como número en `[0.25, 1]`, `core/genome.js`). Las demás son palancas
discretas (un apéndice, una marca, un accesorio): no tienen magnitud.

| Rasgo | Palanca | Intensidad |
|---|---|---|
| `aura-field` | genoma `aura` | **sí**: `aura = 0.25 + 0.75 × intensidad` (`AURA_RANGE`, L55) |
| `antennae` | genoma `appendage: 'antenna'` | no ⇒ declarado |
| `geometric-crest` | genoma `appendage: 'ears'` | no ⇒ declarado |
| `energy-cores` | genoma `marking: 'dots'` | no ⇒ declarado |
| `halo` · `orbital-rings` | accesorio `halo` | no ⇒ declarado |
| `quantum-crown` | accesorio `crown` | no ⇒ declarado |

**Lo que NO se expresa, se DECLARA (no se inventa ni se disimula):**

- `unmapped` — el rasgo **no** se expresa en absoluto: `floating-shards`
  (las partículas del motor son del estado, no un knob del genoma) y los
  outfits `beanie` / `scarf` / `bow` (el motor tiene un solo hueco de accesorio
  y 16 piezas).
- `unmappedIntensity` — el rasgo **se aplica**, pero su magnitud no tiene
  palanca: los seis de la tabla de arriba.

⇒ Dos listas distintas, con dos significados distintos, y `resolveProfile()`
devuelve las dos ⇒ **quien lo consume puede ver exactamente qué se ha
expresado y qué no**.

### 2.3 El test (rojo primero, output pegado)

`packages/avatar/tests/profile-intensity.test.js` (nuevo, 6 casos).

**ROJO** (antes de implementar):

```text
  # SyntaxError: The requested module '../src/runtime/profile.js' does not provide
  an export named 'AURA_RANGE'
  not ok 1 - tests\profile-intensity.test.js
  # tests 1
  # pass 0
  # fail 1
```

**VERDE** (estado actual):

```text
  ok 1 - parseTraits acepta las DOS formas: nombres y objetos
  ok 2 - parseTraitEntries devuelve la entrada completa (con su intensidad)
  ok 3 - LA INTENSIDAD CAMBIA EL RENDER: el aura del genoma la lleva
  ok 4 - un rasgo desactivado (enabled:false) NO se aplica
  ok 5 - la intensidad que el motor NO expresa se DECLARA (no se amaga)
  ok 6 - sin intensidad, el rasgo se aplica a tope (compatibilidad)
  # tests 6
  # pass 6
  # fail 0
```

La prueba de render compara **el SVG real**, no un aceptador de atributos. Para
que el aura (la palanca de la intensidad) llegue al SVG, `staticSVG` acepta
ahora un genoma concreto:

```diff
--- a/packages/avatar/src/render/static.js
+++ b/packages/avatar/src/render/static.js
@@ -32,7 +32,7 @@
- * @param {{state?: string, emote?: string, pose?: string}} [opts]
+ * @param {{state?: string, emote?: string, pose?: string, genome?: object}} [opts]
@@ -36,7 +36,7 @@
 export function staticSVG(seed, opts = {}) {
-  const genome = generateGenome(seed);
+  const genome = opts.genome || generateGenome(seed);
```

Es **aditivo**: sin `opts.genome` el comportamiento es el de siempre ⇒ el
golden no se mueve (`geometry:check` sigue en **231/231** ✔).

### 2.4 ⚠️ El punto de coordinación con A4 (importante)

Verificado contra el código real del bridge (`characterProfileBridge.ts`):

- `toCharacterPayload` **guarda** `traits` como objetos `{kind, intensity,
  enabled}` ✔ (ya lo arregla A4).
- `asCustomConfig` devuelve, para un perfil **con** `uiConfig` (todos los
  guardados por la versión nueva del bridge), `traits` = **los ids de la UI**
  (`sensor_antenna_scanner`, `visor_analytical`, …) y la intensidad aparte, en
  `traitIntensities` (un mapa id → intensidad).

⇒ **El motor NO conoce los ids de la UI** (son vocabulario del renderer, y el
motor no debe acoplarse a él). Para que la intensidad llegue, el `CharacterBadge`
tiene que mandar el atributo `traits` en la **forma canónica**:

```js
traits='[{"kind":"halo","intensity":0.4},{"kind":"antennae","intensity":1}]'
```

⇒ **Petición a A4** (texto para pegar):

```text
El motor ya acepta las dos formas del atributo `traits`:
  · `["halo","antennae"]`                        (nombres)
  · `[{"kind":"halo","intensity":0.4}]`          (canónica, con intensidad)
y `parseTraits` devuelve los nombres en las dos formas.

OJO con el round-trip: `asCustomConfig` devuelve, para los perfiles CON
`uiConfig`, `traits` = los IDS DE LA UI (`sensor_antenna_scanner`,
`visor_analytical`, ...) y la intensidad aparte en `traitIntensities`. El motor
NO conoce los ids de la UI (son tu vocabulario): si el `CharacterBadge` manda
`traits` tal cual, el motor los declara como `unmapped` y no se aplica nada.

Para que el perfil se vea, `CharacterBadge` debe mandar la forma CANONICA:
  traits='[{"kind":"halo","intensity":0.4},{"kind":"antennae","intensity":1}]'
construida con el mapa UI_TRAIT_TO_KIND + `traitIntensities` (que ya tienes).

El motor declara lo que NO expresa (para que no se amague):
  · `unmapped`          -> el rasgo no se expresa: `floating-shards`;
                           outfits `beanie`/`scarf`/`bow`.
  · `unmappedIntensity` -> el rasgo se aplica pero su MAGNITUD no tiene
                           palanca: todos menos `aura-field` (el aura es la
                           unica palanca de intensidad del motor).
El modulo se importa tipado: `@ego/avatar/runtime/profile.js` (el paquete ya lo
exporta; si prefieres el `paths` de tu tsconfig, tambien funciona).
```

## 3. La clasificación de lo nuevo

| Fichero | Clasificación | Motivo | Presupuesto |
|---|---|---|---|
| `packages/avatar/src/runtime/profile.d.ts` | **NATIVO** | Declaración de tipos **propia** (no es geometría ni upstream): el perfil → motor. | `maxShingles: 0` |
| `packages/avatar/tests/profile-intensity.test.js` | **NATIVO** | Test propio de la Ola 12. | `maxShingles: 0` |

⇒ **Derivados 58 (sin cambio) · nativos 33 → 35**.

**El recuento de derivados NO baja** ⇒ **no he sustituido geometría upstream
por propia**: la Ola 12 no toca la geometría, sólo el **overlay de identidad**
que el perfil aplica encima (silueta, apéndice, marca, aura, accesorio). El
golden geométrico **no se regraba** (`geometry:check` 231/231 ✔) y la puerta de
residuo verbatim sigue en verde (93 presupuestos, 0 fuera de presupuesto ✔).

## 4. Verificación (comando + exit + resumen)

| # | Comando | Exit | Resumen |
|---|---|:---:|---|
| 1 | `pnpm --filter @ego/avatar test` | **0** | **337 tests, 337 pass, 0 fail** (331 + 6 nuevos) |
| 2 | `pnpm --filter @ego/avatar typecheck` | **0** | código + tests |
| 3 | `pnpm --filter @ego/avatar build` | **0** | `dist/` al día (50 ficheros) |
| 4 | `pnpm --filter @ego/avatar sync:check` | **0** | `SIN DRIFT` |
| 5 | `pnpm --filter @ego/avatar geometry:check` | **0** | `GEOMETRIA IDENTICA a la golden: 231 combinaciones` |
| 6 | `pnpm --filter @ego/avatar attribution:check` | **0** | `CLASIFICACION CONFORME` (58/35) |
| 7 | `pnpm --filter @ego/avatar upstream:check` | **0** | `SIN DIVERGENCIA NO DECLARADA` |
| 8 | `pnpm --filter @ego/avatar no-verbatim:check` | **0** | `SIN RESIDUO VERBATIM` (93 presupuestos) |
| 9 | `node packages/avatar/scripts/check-bridge.mjs` | **0** | `CONTRATO CUMPLIDO` (15/15) |
| 10 | `pnpm --filter @ego/renderer test` | **0** | **528 passed** (75 ficheros) |
| 11 | `pnpm --filter @ego/renderer typecheck` | **0** | el renderer compila con el módulo de perfil tipado |
| 12 | `pnpm --filter @ego/desktop typecheck` | **0** | |
| 13 | `pnpm --filter @ego/desktop test` | **0** | **430 passed, 5 skipped** (71 ficheros) |
| 14 | `pnpm -r typecheck` | **0** | todo el repo |
| 15 | `pnpm lint` | **0** | presupuesto de avisos respetado (446 real / 470 — **no lo he subido**) |

> Disco libre: **19,88 GB** (el preflight pide 14,38).

## 5. Lo que cambió, con `fichero:línea`

| Fichero | Línea | Cambio |
|---|---|---|
| `src/runtime/profile.js` | L55 | `AURA_RANGE` (el rango del aura del genoma: la palanca de la intensidad) |
| | L88 | `UNMAPPED_INTENSITIES` (los rasgos que se aplican pero sin magnitud) |
| | L159 | `parseTraitEntries(json)` — normaliza a `{kind, intensity, enabled}` y acepta **las dos formas** |
| | L185 | `parseTraits(json)` — los nombres, en las dos formas (firma de A4) |
| | L196 | `resolveProfile` — trabaja con las entradas; la intensidad va al aura; `unmapped` + `unmappedIntensity` |
| | L226 | el registro de la intensidad no expresable |
| `src/runtime/profile.d.ts` | (nuevo) | la declaración pública (forma de A4 + las piezas nuevas) |
| `src/render/static.js` | L32, L41 | `staticSVG(seed, {genome})`: renderiza un genoma concreto (aditivo) |
| `package.json` | L24 | exporta `./runtime/profile.js` |
| `tests/profile-intensity.test.js` | (nuevo) | 6 casos: la intensidad cambia el SVG real |
| `tests/attribution.test.js` | (baseline) | 58/35 (honesto: los 2 nativos nuevos) |
| `provenance.manifest.json` | 2 entradas | `src/runtime/profile.d.ts` y `tests/profile-intensity.test.js` como **NATIVOS** |
| `upstream-divergence.json` | hashes | re-declarados (el contenido cambió) |
| `apps/desktop/renderer/floating/vendor/avatar/**` | — | re-sincronizado |

**No tocados**: `apps/desktop/renderer/components/**` (A4), `apps/desktop/src/**`,
`packages/{tools,ui-runtime,tool-call-repair,tasks,memory,runtime,security}/**`
(A2-bis), `scripts/**` y `.github/**` (A7), el resto de `docs/**` salvo
`docs/extractions/coucou.md` (A1).

**Sin commits** · **sin `pnpm install`** · **sin `git checkout/reset/stash/clean`**.

## 6. El texto exacto para A1

**No cambia ninguna fila del Backlog** en esta ola: las dos peticiones eran
cualidades del motor (una declaración de tipos y la intensidad), no un hallazgo
con fila propia. La fila `EGO-FIND-116` (que A4 ya propone pasar a
✅ Completada en su §6.2) **sigue valiendo** y su evidencia se refuerza:

> **Añadir a la nota de `EGO-FIND-116`** (la de A4 §6.2), sin cambiar su
> estado:
>
> ```text
> · Ola 12 (A6): el motor acepta el atributo `traits` en las dos formas
>   (`["halo"]` y `[{"kind":"halo","intensity":0.4}]`) y la INTENSIDAD se
>   expresa con las palancas que el motor ya tiene (el aura del genoma es la
>   única con magnitud). Lo que no se expresa se DECLARA: `unmapped` (el
>   rasgo no se expresa: `floating-shards`; outfits `beanie`/`scarf`/`bow`) y
>   `unmappedIntensity` (el rasgo se aplica, pero su magnitud no tiene
>   palanca). El módulo de perfil tiene declaración de tipos propia
>   (`src/runtime/profile.d.ts`) ⇒ el renderer puede cotejar los vocabularios
>   en un test TIPADO. El golden geométrico no se regraba (231/231): el perfil
>   es un overlay de identidad, no un cambio de la geometría por estado.
> ```

## 7. Deuda abierta

1. **A4** — mandar el atributo `traits` en la **forma canónica**
   (`{kind, intensity}`) y no en los ids de la UI: el motor no conoce el
   vocabulario de la UI y declararía los rasgos como `unmapped` (§2.4).
2. **A4** — decidir si los rasgos con magnitud sin palanca (`unmappedIntensity`)
   necesitan una pieza nueva en el motor (hoy se aplican a tope).
3. **A4** — `floating-shards` y los outfits `beanie`/`scarf`/`bow` no tienen
   expresión en el motor: si deben verse, hace falta una pieza nueva.
4. **A2-bis** — sin peticiones en esta ola (el `TypeError` del manifiesto
   ausente ya lo tenía corregido; ver el handoff de la Ola 11, §2.2).
5. **Menor** — `staticSVG(seed, {genome})` es la vía para renderizar un
   genoma concreto; el elemento en vivo usa su propio runtime (con el DOM),
   así que no hay un equivalente sin DOM.

## 8. `RESULTADO`

```json
{
  "agente": "A6",
  "status": "COMPLETE",
  "archivos_modificados": [
    "packages/avatar/src/runtime/profile.js",
    "packages/avatar/src/runtime/profile.d.ts",
    "packages/avatar/src/render/static.js",
    "packages/avatar/package.json",
    "packages/avatar/tests/profile-intensity.test.js",
    "packages/avatar/tests/attribution.test.js",
    "packages/avatar/provenance.manifest.json",
    "packages/avatar/upstream-divergence.json",
    "apps/desktop/renderer/floating/vendor/avatar/** (re-sincronizado)"
  ],
  "hallazgos_resueltos": [
    "A4 (a): profile.d.ts - la declaracion publica del modulo de perfil, con la firma exacta que propone A4 (para que su test tipado compile) mas las piezas de la Ola 12 (TraitEntry, ResolvedProfile, CharacterProfile, AURA_RANGE, UNMAPPED_INTENSITIES, ENGINE_ACCESSORIES, parseTraitEntries, applyProfileToGenome). El paquete ademas exporta ./runtime/profile.js, para que el renderer lo importe sin tocar su tsconfig.",
    "A4 (b): la INTENSIDAD viaja y se expresa - el atributo traits acepta las dos formas (nombres y objetos {kind,intensity,enabled}) y la intensidad llega a la paleta del motor: el aura del genoma (la unica palanca con magnitud) la escala con AURA_RANGE. Test propio (6 casos) que demuestra que el RENDER cambia (el SVG real del render estatico), no que 'se acepta el atributo'.",
    "Lo que NO se expresa se DECLARA y con dos listas distintas: unmapped (el rasgo no se expresa: floating-shards; outfits beanie/scarf/bow) y unmappedIntensity (el rasgo se aplica pero su magnitud no tiene palanca).",
    "staticSVG acepta opts.genome (aditivo) para poder renderizar un genoma concreto en un test sin DOM; el golden NO se regraba (geometry:check 231/231).",
    "Clasificacion: lo nuevo es codigo PROPIO -> derivados 58 (SIN cambio) / nativos 33 -> 35. El recuento de derivados no baja porque en esta ola no se sustituye geometria: el perfil es un overlay de identidad."
  ],
  "verify": {
    "avatar test": "337/337 pass - exit 0",
    "avatar typecheck": "exit 0",
    "avatar build": "exit 0",
    "avatar sync:check": "SIN DRIFT - exit 0",
    "avatar geometry:check": "231/231 - exit 0",
    "avatar attribution:check": "CLASIFICACION CONFORME (58/35) - exit 0",
    "avatar upstream:check": "exit 0",
    "avatar no-verbatim:check": "exit 0",
    "bridge:check": "CONTRATO CUMPLIDO - exit 0",
    "renderer test": "528 passed - exit 0",
    "renderer typecheck": "exit 0",
    "desktop typecheck": "exit 0",
    "desktop test": "430 passed / 5 skipped - exit 0",
    "pnpm -r typecheck": "exit 0",
    "pnpm lint": "exit 0 (presupuesto: 446 real / 470; no lo he subido)"
  },
  "solicitudes_handoff": [
    "A4 - mandar el atributo traits en la forma CANONICA ({kind, intensity}) y no en los ids de la UI: el motor no conoce el vocabulario de la UI y declararia los rasgos como unmapped. Texto exacto en la seccion 2.4 del handoff.",
    "A4 - decidir si los rasgos con magnitud sin palanca (unmappedIntensity) necesitan una pieza nueva en el motor.",
    "A4 - floating-shards y los outfits beanie/scarf/bow no tienen expresion en el motor: si deben verse, hace falta una pieza nueva.",
    "A1 - texto exacto para ANADIR a la nota de EGO-FIND-116 (sin cambiar su estado), en la seccion 6 del handoff."
  ],
  "deuda_abierta": [
    "A4: el atributo traits debe viajar en la forma canonica para que la intensidad llegue",
    "A4: los rasgos con magnitud sin palanca se aplican a tope (declarado, no inventado)",
    "A4: floating-shards y 3 outfits sin expresion en el motor",
    "Menor: no hay equivalente sin DOM de staticSVG({genome}) para el elemento en vivo"
  ],
  "SKILLS_CARGADAS": []
}
```
