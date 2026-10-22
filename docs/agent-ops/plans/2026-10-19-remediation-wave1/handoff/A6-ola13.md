# Handoff A6 (Ola 13) — 2026-10-22 — el mapa de outfits (la última petición de A4)

> Zona de A6: `packages/avatar/**`,
> `apps/desktop/renderer/floating/vendor/avatar/**` y
> `docs/extractions/coucou.md`. Sin commits. Sin `pnpm install`.

## 0. Resumen ejecutivo (léase primero)

La petición de **A4 §6.1** ("el `outfit`: el accesorio del renderer no llega al
motor") está **aplicada**.

| Petición | Estado | Resultado |
|---|---|---|
| **A4 §6.1** — el mapa de outfits | ✅ | El mapa vive en el **motor** (`src/runtime/profile.js`, `OUTFITS`), no en el renderer: el vocabulario canónico es del motor y el renderer ya lo importa **con tipos** (`profile.d.ts`). Los **8** accesorios de `ACCESSORY_OPTIONS` tienen ahora pieza ⇒ el accesorio persistido **se aplica**. |
| **A4 §6.1** — lo que no se expresa | ✅ | `beanie` / `scarf` / `bow` (vocabulario legacy) **no tienen pieza** ⇒ **se declaran** (`unmapped`), no se aproximan. |

**Hallazgo colateral (bug real, encontrado por el test rojo)**: un outfit
**desconocido** se ignoraba **en silencio** (`accessory: 'none'` y `unmapped`
vacío ⇒ el perfil "parecía aplicarse" y no se aplicaba). Ahora **cualquier**
outfit que no esté en el mapa se **declara** `unmapped`.

**Clasificación**: lo nuevo es **código propio** ⇒ **derivados 58 (SIN cambio) ·
nativos 35 → 36**. El recuento de derivados **no baja** ⇒ **no he sustituido
geometría por propia** ⇒ no hay nada que re-declarar en el manifiesto (la pieza
del accesorio **ya existía** en el motor; sólo faltaba el mapa).

## 1. T1 — El mapa de outfits

### 1.1 El hueco (medido, no inferido)

El renderer ofrece **8** accesorios de ropa
(`apps/desktop/renderer/components/character/wardrobe/WardrobeSelector.tsx:60-68`,
`ACCESSORY_OPTIONS`):

```ts
export const ACCESSORY_OPTIONS: Array<{ id: string; label: string }> = [
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

El motor **ya tenía las 8 piezas** (`ENGINE_ACCESSORIES`, 16 piezas) ⇒ lo que
faltaba era **el mapa**: `resolveProfile` sólo conocía 5 ids legacy
(`santaHat`/`partyHat`/`crown`/`sunglasses`/`roundGlasses`) ⇒ **7 de 8** caían
en `unmapped` ⇒ el accesorio persistido **no se aplicaba**.

### 1.2 El arreglo — el mapa vive en el motor

`packages/avatar/src/runtime/profile.js:105-127` — el mapa es **canónico del
motor** (no una lista suelta en el renderer):

```js
export const OUTFITS = Object.freeze({
  // El vocabulario LEGACY de ropa del renderer (`CharacterWardrobe.ts`):
  santaHat: 'santa',
  partyHat: 'witch',
  crown: 'crown',
  sunglasses: 'aviator-glasses',
  roundGlasses: 'glasses',

  // El vocabulario ACTUAL de accesorios del renderer (`ACCESSORY_OPTIONS` en
  // `WardrobeSelector.tsx`): el motor YA tiene estas piezas, asi que el mapa es
  // identidad. Antes estos 7 caian en `unmapped` y el accesorio persistido no
  // se aplicaba (peticion de A4, Ola 13).
  none: 'none',
  'cx-full-kit': 'cx-full-kit',
  'cx-antenna': 'cx-antenna',
  headphones: 'headphones',
  'cyber-goggles': 'cyber-goggles',
  halo: 'halo',
  sprout: 'sprout',
});
```

> Coherencia con el vocabulario canónico: `OUTFITS` vive **al lado** de
> `BASE_FORMS` (`profile.js:44`) y `TRAIT_KINDS` (`profile.js:65`) ⇒ el mapa
> **es** parte del contrato canónico, y `profile.d.ts` lo declara con el mismo
> tipo (`Readonly<Record<string, string>>`) ⇒ el renderer lo puede importar
> **con tipos** sin duplicar el vocabulario.
>
> `crown` está en las dos listas (legacy y actual) con la **misma clave** ⇒ el
> motor mapea `crown → 'crown'` ✔. `halo` mapea a la pieza `halo` ✔; no choca
> con el **rasgo** `halo` porque el outfit **pisa** al accesorio del rasgo
> (ejes distintos, regla ya existente del motor).

### 1.3 El bug colateral: un outfit desconocido se ignoraba en silencio

`packages/avatar/src/runtime/profile.js:253-258`:

```js
  // 2) El outfit manda: la ropa explicita pisa el accesorio de los rasgos.
  // Un outfit que NO esta en el mapa se DECLARA (no se ignora en silencio: un
  // perfil que "parece aplicarse" y no se aplica es peor que uno que lo dice).
  if (profile.outfit) {
    const piece = OUTFITS[profile.outfit];
    if (piece) accessory = piece;
    else unmapped.push(profile.outfit);
  }
```

**Antes**: `profile.outfit && UNMAPPED_OUTFITS.includes(profile.outfit)` ⇒
cualquier id **fuera** de la lista de 3Known-no-mapped pasaba **sin declarar**
⇒ `accessory: 'none'`, `unmapped: []` ⇒ el perfil **parecía** aplicado y no lo
estaba. Ahora **cualquier** outfit no mapeado se declara `unmapped` ✔.

### 1.4 El test (comportamiento: la pieza **se dibuja**)

`packages/avatar/tests/profile-outfit.test.js` (nuevo, 5 casos). No comprueba
que "se acepta el atributo": comprueba que la pieza **produce operaciones de
pintado** en el motor de canvas (`drawTopAccessory` con un `ctx` instrumentado)
y que el elemento la **deja puesta** en el studio.

**ROJO** (antes de implementar) — salida pegada:

```text
  ok 1 - los 8 accesorios del renderer tienen pieza en el motor (y NO quedan unmapped)
  not ok 2 - el mapa cubre el vocabulario del renderer Y el legacy
  error: 'falta el outfit "none" en el mapa'
  expected: true
  actual: false
  not ok 3 - EL OUTFIT SE DIBUJA: la pieza produce operaciones de pintado
  error: 'el outfit "cx-full-kit" -> "none" tiene que dibujar algo'
  expected: true
  actual: false
  not ok 4 - el elemento deja la pieza del outfit puesta en el studio
  error: |-
  Expected values to be strictly equal:
  + actual - expected
  expected: 'headphones'
  actual: 'none'
  ok 5 - lo que el motor NO expresa se declara (outfits sin pieza)
```

**VERDE** (después):

```text
  ok 1 - los 8 accesorios del renderer tienen pieza en el motor (y NO quedan unmapped)
  ok 2 - el mapa cubre el vocabulario del renderer Y el legacy
  ok 3 - EL OUTFIT SE DIBUJA: la pieza produce operaciones de pintado
  ok 4 - el elemento deja la pieza del outfit puesta en el studio
  ok 5 - lo que el motor NO expresa se declara (outfits sin pieza)
  # tests 5
  # pass 5
  # fail 0
```

## 2. Lo que **no** se expresa (y por qué)

| Vocabulario | Id | Por qué |
|---|---|---|
| Legacy (`CharacterWardrobe.ts`) | `beanie` | El motor tiene **UN** hueco de accesorio y **16** piezas; entre ellas **no** hay gorro aderido ⇒ no hay pieza equivalente ⇒ **no se aproxima** (un "gorro" dibujado como otra cosa sería mentir sobre la identidad). |
| Legacy | `scarf` | Ídem: no hay bufanda en el motor. |
| Legacy | `bow` | Ídem: no hay lazo en el motor. |
| Cualquier otro id | *(cualquiera)* | Se declara `unmapped` (§1.3) — **nunca** se ignora en silencio. |

Declarados en `packages/avatar/src/runtime/profile.js:129-135`
(`UNMAPPED_OUTFITS`).

**Las 16 piezas del motor** (`ENGINE_ACCESSORIES`, `profile.js:137-141`): el
mapa cubre **12** (`none`, `cx-antenna`, `cx-full-kit`, `headphones`,
`glasses`, `aviator-glasses`, `cyber-goggles`, `santa`, `witch`, `crown`,
`halo`, `sprout`). Las **4** que quedan **reservadas** para los rasgos
(`cat-ears`, `bunny-ears`, `fox-ears`, `bear-ears`) ⇒ **no** son un hueco:
son la otra mitad del eje de accessories.

## 3. La clasificación (D4 ejecutada)

**No hay geometría nueva**: el accesorio **ya existía** en el motor ⇒ lo único
nuevo es **el mapa** (código propio).

| | Antes | Ahora |
|---|---|---|
| Derivados | 58 | **58 (SIN cambio)** |
| Nativos | 35 | **36** (+1: `tests/profile-outfit.test.js`) |
| Total | 93 | **94** |

⇒ El recuento de **derivados no baja** porque en esta ola **no** se sustituye
geometría: el mapa es **puente de vocabulario**, no pieza nueva ⇒ el upstream
**no** se ha sustituido por código propio ⇒ nada que re-declarar.

`no-verbatim:check` sigue con **presupuesto 0** en los **94** ficheros
(`profile.js` es nativo y sigue con residuo **0** ⇒ el mapa no ha introducido
ningún shingle del upstream).

## 4. Verificación (comando · exit · resumen)

| Comando | Exit | Resumen |
|---|---|---|
| `pnpm --filter @ego/avatar test` | 0 | **342/342** pass (antes 337 → +5 del test del outfit) |
| `pnpm --filter @ego/avatar typecheck` | 0 | — |
| `pnpm --filter @ego/avatar build` | 0 | — |
| `pnpm --filter @ego/avatar build:check` | 0 | — |
| `pnpm --filter @ego/avatar sync:check` | 0 | **SIN DRIFT** (re-sincronizado con la copia vendorizada) |
| `pnpm --filter @ego/avatar geometry:check` | 0 | **231/231** — el outfit es un accesorio, **no** cambia la geometría por estado ⇒ **no** he regrabado el golden |
| `pnpm --filter @ego/avatar attribution:check` | 0 | CLASIFICACIÓN CONFORME (**58/36**) |
| `pnpm --filter @ego/avatar upstream:check` | 0 | — |
| `pnpm --filter @ego/avatar no-verbatim:check` | 0 | presupuesto **0** en **94** ficheros |
| `node packages/avatar/scripts/check-bridge.mjs` | 0 | CONTRATO CUMPLIDO |
| `pnpm --filter @ego/renderer test` | 0 | **543 passed** |
| `pnpm -r typecheck` | 0 | — |
| `pnpm lint` | 0 | presupuesto **446 real / 470** — **no lo he subido** (A7 es su dueño) |
| `node scripts/check-docs-lint.mjs` | 0 | gate OK — **MD040 arreglado** (§6) |

## 5. Ficheros tocados

| Fichero | Qué |
|---|---|
| `packages/avatar/src/runtime/profile.js` | `:105-127` el mapa `OUTFITS` · `:129-135` `UNMAPPED_OUTFITS` documentado · `:253-258` el outfit desconocido se declara |
| `packages/avatar/tests/profile-outfit.test.js` | **nuevo** (5 casos) |
| `packages/avatar/tests/attribution.test.js` | línea base de la clasificación: 35 → **36** nativos |
| `packages/avatar/provenance.manifest.json` | +1 nativo (`tests/profile-outfit.test.js`) |
| `packages/avatar/upstream-divergence.json` | re-generado (`--update`) |
| `apps/desktop/renderer/floating/vendor/avatar/**` | re-sincronizado (`sync --write`) — copia vendorizada |
| `docs/extractions/coucou.md` | el reparto del motor: 93 → **94** ficheros (58 derivados + 36 nativos) |
| `docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A6-ola12.md` | **MD040 ×4** arreglado (fences sin lenguaje, dentro y fuera de blockquote) |

## 6. Peticiones fuera de zona (texto exacto)

### 6.1 A4 — nada pendiente de esta ola

El mapa de A4 §6.1 está aplicado tal cual ⇒ **A4 no tiene que tocar nada** en
`components/**` para el `outfit`: el renderer ya envía `outfit={config.outfitId}`
(`characterProfileBridge.ts:298`) y el motor ya entiende **los 8** ids.

### 6.2 A1 — texto exacto para el Backlog

> **Añadir a la nota de `EGO-FIND-116`** (la que escribió A4 en §6.2), **sin
> cambiar su estado** (`✅ Completada`):
>
> ```text
> · Ola 13 (A6): el `outfit` también alimenta el render. El vocabulario de ropa
>   del renderer (`ACCESSORY_OPTIONS`: none, cx-full-kit, cx-antenna, headphones,
>   cyber-goggles, crown, halo, sprout) se traduce en el MOTOR (`OUTFITS`, en
>   `packages/avatar/src/runtime/profile.js`), que ya tenía las 8 piezas: antes
>   7 de 8 caían en `unmapped` y el accesorio persistido no se aplicaba. Verificado
>   por comportamiento (la pieza se DIBUJA, no "se acepta el atributo"). Lo que el
>   motor no expresa se DECLARA: `beanie`/`scarf`/`bow` (no hay pieza) y cualquier
>   outfit desconocido, que ya no se ignora en silencio. Ficheros:
>   `packages/avatar/src/runtime/profile.js`, `packages/avatar/tests/profile-outfit.test.js`.
> ```

### 6.3 A2-bis / A7 / A5 / A3 / A8 — sin peticiones

> **A7 (informativo, no es una petición)**: al correr
> `node scripts/check-docs-lint.mjs`, la **absorción automática** del gate
> (`scripts/docs-lint-baseline.json`, **tu** fichero) añadió una entrada para
> `A6-ola13.md` con `MD013/line-length: 2` en el momento en que mi fichero aún
> tenía 2 líneas largas. **Ya las he arreglado** (el fichero tiene **0**
> violaciones) ⇒ esa entrada está **caducada** y el `totalViolations` de la base
> queda **2 por encima** de la realidad. No he tocado el fichero (es tu zona);
> un `--write-baseline` cuando puedas lo deja exacto.

## 7. Deuda abierta (declarada)

1. **A4** — decidir si `beanie` / `scarf` / `bow` deben **verse**: si sí,
   hace falta una **pieza nueva** en el motor (y entonces el recuento de
   derivados **no** cambia: sería nativa).
2. **A4** — el `traits` en la forma canónica `{kind, intensity}` (petición de la
   Ola 12, sigue abierta: el motor no conoce los ids de la UI y los declararía
   `unmapped`).
3. **A4** — `floating-shards` y los rasgos con magnitud sin palanca
   (`unmappedIntensity`) no tienen expresión en el motor.
4. **Menor** — las 4 piezas de orejas (`cat-ears`, `bunny-ears`, `fox-ears`,
   `bear-ears`) son **reservadas** para los rasgos: el `outfit` no las puede
   elegir (el motor tiene UN hueco de accesorio). Si el renderer quiere un
   "gato" como ropa, hace falta un segundo hueco.
5. **Menor** — el mapa es **de vocabulario**, no de **estética**: `halo` como
   *outfit* y `halo` como *rasgo* son la misma pieza ⇒ si el usuario elige el
   outfit "halo", el rasgo halo queda eclipsado (regla ya existente: el outfit
   pisa al accesorio del rasgo).

## 8. `RESULTADO`

```json
{
  "agente": "A6",
  "status": "COMPLETE",
  "archivos_modificados": [
    "packages/avatar/src/runtime/profile.js",
    "packages/avatar/tests/profile-outfit.test.js",
    "packages/avatar/tests/attribution.test.js",
    "packages/avatar/provenance.manifest.json",
    "packages/avatar/upstream-divergence.json",
    "apps/desktop/renderer/floating/vendor/avatar/** (re-sincronizado)",
    "docs/extractions/coucou.md",
    "docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A6-ola12.md (MD040)"
  ],
  "hallazgos_resueltos": [
    "A4 6.1: el mapa de outfits - el vocabulario de ropa del renderer (ACCESSORY_OPTIONS: 8 ids) se traduce en el MOTOR (OUTFITS, profile.js:105-127), que ya tenia las 8 piezas.",
    "Antes 7 de 8 caian en unmapped y el accesorio persistido NO se aplicaba.",
    "El mapa vive al lado de BASE_FORMS y TRAIT_KINDS => es vocabulario canonico, y profile.d.ts lo declara con tipos (no hay lista suelta en el renderer).",
    "Bug colateral (encontrado por el test rojo): un outfit DESCONOCIDO se ignoraba en silencio (accessory 'none', unmapped vacio => el perfil 'parecia aplicarse' y no se aplicaba).",
    "Ahora cualquier outfit fuera del mapa se DECLARA unmapped (profile.js:253-258).",
    "Test propio (5 casos) que demuestra que el outfit SE APLICA por comportamiento: la pieza produce operaciones de pintado en el motor de canvas (drawTopAccessory con ctx instrumentado).",
    "ROJO pegado en la seccion 1.4. El elemento la deja puesta en el studio.",
    "Lo que NO se expresa se DECLARA: beanie/scarf/bow (el motor tiene UN hueco de accesorio y 16 piezas, y entre ellas no hay gorro aderido, bufanda ni lazo) + cualquier outfit desconocido.",
    "Clasificacion: lo nuevo es codigo PROPIO -> derivados 58 (SIN cambio) / nativos 35 -> 36 (94 ficheros).",
    "El recuento de derivados no baja porque NO hay geometria nueva: la pieza ya existia, solo faltaba el mapa.",
    "=> no he sustituido upstream por codigo propio.",
    "MD040 x4 arreglado en A6-ola12.md (fences sin lenguaje, dentro y fuera de blockquote) => check-docs-lint exit 0 y las violaciones totales de docs BAJAN (7287 -> 7258).",
    "Golden NO regrabado: el outfit es un accesorio, no geometria por estado => geometry:check 231/231 sin tocar el golden."
  ],
  "verify": {
    "avatar test": "342/342 pass - exit 0",
    "avatar typecheck": "exit 0",
    "avatar build": "exit 0",
    "avatar build:check": "exit 0",
    "avatar sync:check": "SIN DRIFT - exit 0",
    "avatar geometry:check": "231/231 - exit 0",
    "avatar attribution:check": "CLASIFICACION CONFORME (58/36) - exit 0",
    "avatar upstream:check": "exit 0",
    "avatar no-verbatim:check": "presupuesto 0 en 94 ficheros - exit 0",
    "bridge:check": "CONTRATO CUMPLIDO - exit 0",
    "renderer test": "543 passed - exit 0",
    "pnpm -r typecheck": "exit 0",
    "pnpm lint": "exit 0 (presupuesto: 446 real / 470; no lo he subido)",
    "docs-lint": "gate OK - exit 0 (MD040 arreglado)"
  },
  "solicitudes_handoff": [
    "A1 - texto exacto para ANADIR a la nota de EGO-FIND-116 (sin cambiar su estado), en la seccion 6.2 del handoff.",
    "A4 - sin peticiones pendientes en esta ola: el mapa esta aplicado tal cual y el renderer ya envia outfit={config.outfitId}.",
    "A4 - si beanie/scarf/bow deben verse, hace falta una pieza nueva en el motor (seria nativa; el recuento de derivados no cambia).",
    "A4 - sigue abierta la peticion de la Ola 12: mandar el atributo traits en la forma canonica {kind, intensity}."
  ],
  "deuda_abierta": [
    "A4: beanie/scarf/bow no tienen expresion en el motor (declarado, no inventado)",
    "A4: el atributo traits debe viajar en la forma canonica para que la intensidad llegue",
    "A4: floating-shards y los rasgos con magnitud sin palanca (unmappedIntensity) no tienen expresion",
    "Menor: el motor tiene UN hueco de accesorio => las 4 piezas de orejas son reservadas para los rasgos y no se pueden elegir como ropa",
    "Menor: 'halo' como outfit eclipsa el rasgo halo (regla ya existente: el outfit pisa al accesorio del rasgo)"
  ],
  "SKILLS_CARGADAS": []
}
```
