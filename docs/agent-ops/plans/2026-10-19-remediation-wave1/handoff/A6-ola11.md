# Handoff A6 (Ola 11) — 2026-10-21 — `EGO-FIND-116`: el motor observa el perfil del personaje

> Zona de A6: `packages/avatar/**`,
> `apps/desktop/renderer/floating/vendor/avatar/**` y
> `docs/extractions/coucou.md`. Sin commits. Sin `pnpm install`.

## 0. Resumen ejecutivo (léase primero)

El perfil de personaje **persistía y hacía round-trip**, pero el motor **no lo
observaba**: el `<ego-avatar>` se pintaba igual con un perfil o con otro.

| Ítem | Estado | Resultado |
|---|---|---|
| **T1** — el motor observa `base-form` / `traits` / `outfit` | ✅ | El elemento los observa, los traduce a las palancas del motor (silueta, apéndice, marca, aura, accesorio del studio) y **el render cambia** con ellos. Test propio que lo demuestra sobre el **SVG real**. |
| **T2** — el `TypeError` de A7 | ✅ | El mío **no lo tenía** (el guard ya estaba) ⇒ el mensaje es ahora **accionable** y hay test. A2-bis **ya lo había arreglado** en su implementación genérica ⇒ se le da el patrón y el texto, no un bug. |

**Clasificación**: los dos ficheros nuevos son **nativos** (código propio de
Ego, sin traducción de ningún upstream) ⇒ **derivados 58 (sin cambio) ·
nativos 31 → 33**.

## 1. T1 — El motor observa el perfil

### 1.1 El diff de A4 §7.1, aplicado

`packages/avatar/src/runtime/avatar-element.js`:

| Punto | Qué |
|---|---|
| **L19** | `import { resolveProfile, applyProfileToGenome } from './profile.js';` |
| **L239** | `observedAttributes` suma `'base-form', 'traits', 'outfit'` (con el comentario de por qué: sin esto el perfil persiste pero no alimenta el render) |
| **L252-254** | el estado del perfil en el constructor: `_profileAttrs` (lo crudo que llega), `_profileOverrides` (los genes resueltos), `_profileAccessory` |
| **L560-566** | el tratamiento en `attributeChangedCallback`: guarda el valor crudo y llama a `_applyProfile()` |
| **L596-616** | el método nuevo **`_applyProfile()`**: resuelve el perfil, aplica el accesorio al studio (`setParam('accessory', …)`) y **repinta** (`_remountWithGenome()`) |
| **L626-633** | `_rebuild()` mezcla el perfil **DEBAJO** de los overrides manuales (un `setGene` explícito del usuario gana al perfil persistido) |

### 1.2 El módulo nuevo: `src/runtime/profile.js` (NATIVO)

Traduce el vocabulario del perfil (que vive en el renderer) al que el motor
**sí sabe expresar**. **No inventa geometría**: cada rasgo va a una palanca que
el motor ya tiene.

**Formas base → la silueta** (`BASE_FORMS`, L36). El motor tiene una sola
silueta parametrizada (`shape.roundness` 0 = cuadrado … 100 = redondo, y
`shape.ratio` = aplastado vertical):

| `baseForm` | roundness | ratio | Razón |
|---|:---:|:---:|---|
| `quantum-monolith` | 82 | 1.00 | la más redonda y neutra (es el **default del renderer**) |
| `energy-core` | 62 | 0.96 | redonda, algo más compacta |
| `fractal-polyhedron` | 26 | 0.94 | poliedrica: esquinas vivas |
| `delta-core` | 34 | 0.90 | la triangular del motor legacy: la más angulosa |
| *(desconocida)* | 82 | 1.00 | cae en la del motor (no inventa) |

**Rasgos canónicos → palancas** (`TRAIT_KINDS`, L51):

| `TraitKind` | Expresión en el motor |
|---|---|
| `antennae` | genoma `appendage: 'antenna'` |
| `geometric-crest` | genoma `appendage: 'ears'` |
| `energy-cores` | genoma `marking: 'dots'` |
| `aura-field` | genoma `aura` (el resplandor) |
| `halo` · `orbital-rings` | accesorio del studio `halo` |
| `quantum-crown` | accesorio del studio `crown` |
| `floating-shards` | **no expresado** → declarado en `UNMAPPED_TRAITS` (L67): las partículas del motor son **del estado** (la boca al hablar, las 'z' al bostezar), no un knob del genoma |

**Outfits → accesorio del studio** (`OUTFITS`, L77): `santaHat→santa`,
`partyHat→witch`, `crown→crown`, `sunglasses→aviator-glasses`,
`roundGlasses→glasses`. Los que el motor **no tiene** (`beanie`, `scarf`,
`bow`) quedan declarados en `UNMAPPED_OUTFITS` (L86): el motor tiene **un
solo hueco** de accesorio (16 piezas) y no inventa las que le faltan.

**Precedencia**: el **outfit manda** sobre el rasgo que también pida accesorio
(la ropa explícita gana) — está en el código y en el test.

Tolerancia: `parseTraits` (L101) devuelve `[]` ante un JSON corrupto, un
formulario base o un valor que no sea un array ⇒ **un perfil corrupto es un
perfil vacío, no un fallo**.

### 1.3 El test (rojo primero, output pegado)

`packages/avatar/tests/profile.test.js` (nuevo, 10 casos). **ROJO** (antes de
implementar el elemento):

```text
  not ok 1 - el elemento OBSERVA base-form, traits y outfit
  ok 2 - EL RENDER CAMBIA: la forma base cambia la silueta pintada
  ok 3 - EL RENDER CAMBIA: un rasgo cambia el genoma y el dibujo
  not ok 4 - EL RENDER CAMBIA: el outfit cambia el accesorio del studio
  ok 5 - el outfit manda sobre el rasgo que tambien pide accesorio
  not ok 6 - el perfil se aplica al genoma del elemento
  not ok 7 - cambiar el perfil despues RE-pinta el avatar (no solo se guarda)
  ok 8 - el mismo perfil produce SIEMPRE el mismo resultado (determinista)
  ok 9 - un perfil corrupto degrada (no rompe)
  not ok 10 - un rasgo que el motor no expresa se DECLARA, no se inventa
    error: 'base-form observado'
    expected: true
    actual: false
  # tests 10
  # pass 5
  # fail 5
```

**VERDE** (estado actual): **10/10** ✔

La prueba de render es sobre el **SVG real** (`renderShell` con el genoma del
perfil), **no** sobre un aceptador de atributos: *"el atributo se acepta" no es
lo que se comprueba; lo que se comprueba es que el dibujo cambia"*. Y como
pide el enunciado, **el golden geométrico NO se re-graba**: el cambio de
geometría del perfil no altera la golden (el golden es del motor por estado y
módulo; el perfil es un overlay de identidad) ⇒ `geometry:check` sigue en
**231/231** ✔.

### 1.4 Lo que el motor NO expresa (declarado, no inventado)

| Perfil | Por qué |
|---|---|
| `floating-shards` | las partículas del motor son del **estado**, no un knob del genoma |
| outfit `beanie` | el motor no tiene gorro aderido |
| outfit `scarf` | el motor no tiene bufanda |
| outfit `bow` | el motor no tiene lazo |

Cada uno sale en `resolveProfile().unmapped` ⇒ es **visible**, no silencioso.

## 2. T2 — El `TypeError` del manifiesto ausente

### 2.1 En mi puerta: ya estaba guardado, ahora el error es accionable

`packages/avatar/scripts/check-attribution.mjs` **no** petaba con `TypeError`
(el guard ya existía) ⇒ el problema real era que el mensaje no decía **cómo
arreglarlo**. Ahora:

```text
falta el manifiesto de procedencia: provenance.manifest.json — es el DENOMINADOR
de la puerta (declara que ficheros son derivados y cuales nativos). Genera sus
presupuestos con: node scripts/measure-verbatim.mjs
```

**Test** (`tests/attribution.test.js`, caso 8): sin manifiesto, la puerta
falla con exit 1, el informe señala el manifiesto ausente, el mensaje explica
para qué sirve **y cómo arreglarlo**, y la salida **no** contiene ni
`TypeError` ni `undefined`.

⇒ También se comprobó el otro camino de `TypeError`: un manifiesto con un
upstream **desconocido** ⇒ la puerta lo señala (`"se espera: // Adapted from
desconocido (?)"`), sin reventar ✔.

### 2.2 Para A2-bis (texto exacto)

El hallazgo, verificado: **la implementación genérica de A2-bis ya lo tiene
arreglado** (`packages/tool-call-repair/scripts/check-attribution.mjs:192-195`
devuelve `{ok:false, problems:[…]}` con el mensaje *"no existe
provenance.manifest.json (el denominador de la puerta)"*) ⇒ **no hay un
`TypeError` que arreglar**: hay un mensaje que se puede mejorar.

⇒ **Petición a A2-bis** (texto para pegar en su handoff):

```text
T2 (EGO-FIND-116) — la puerta ya no revienta con `TypeError` cuando falta
`provenance.manifest.json` (verificado: `packages/tool-call-repair/scripts/
check-attribution.mjs:192-195` devuelve `{ok:false}` con un problema). Lo que
falta es que el mensaje sea ACCIONABLE: ahora dice "no existe
provenance.manifest.json (el denominador de la puerta)" y no dice CÓMO
generarlo. Propuesta (el mismo texto que usa mi puerta,
`packages/avatar/scripts/check-attribution.mjs`):

  problems.push(
    `falta el manifiesto de procedencia: ${relative(root, manifestPath)} — es el ` +
      `DENOMINADOR de la puerta (declara que ficheros son derivados y cuales ` +
      `nativos). Genera sus presupuestos con: node scripts/measure-verbatim.mjs`,
  );

Y, si la puerta admite `--fix`: la REGLA que fija mi puerta (Ola 10,
EGO-FIND-109) es que **`--fix` NO puede mutar el repositorio** — escribe una
PROPUESTA y aplicar exige `--fix --apply`. Una puerta que puede aprobarse a si
misma no es una puerta. La implementacion generica no tiene `--fix` (solo
calcula `changes`): si se anade, que sea con esa regla.
```

## 3. La clasificación de lo que he añadido al manifiesto

| Fichero | Clasificación | Motivo | Presupuesto |
|---|---|---|---|
| `src/runtime/profile.js` | **NATIVO** | Implementación **propia** de Ego: traduce el vocabulario del perfil (el del renderer) a las palancas del motor. **No es un port**: no hay geometría upstream en él, y el detector de verbatim lo confirma. | `maxShingles: 0` |
| `tests/profile.test.js` | **NATIVO** | Test propio de la Ola 11. | `maxShingles: 0` |

⇒ **Derivados 58 (sin cambio) · nativos 31 → 33**. El recuento de derivados
**no baja**, y esa es la prueba de que este cambio **no** es una sustitución
de geometría: es código nuevo.

**El golden NO se re-graba** (`geometry:check` 231/231 ✔): el perfil es un
overlay de identidad (silueta + accesorio), no un cambio de la geometría por
estado que la golden fija.

## 4. Verificación (comando + exit + resumen)

| # | Comando | Exit | Resumen |
|---|---|:---:|---|
| 1 | `pnpm --filter @ego/avatar test` | **0** | **331 tests, 331 pass, 0 fail** (320 + 11 nuevos) |
| 2 | `pnpm --filter @ego/avatar typecheck` | **0** | código + tests |
| 3 | `pnpm --filter @ego/avatar build` | **0** | `dist/` al día (50 ficheros) |
| 4 | `pnpm --filter @ego/avatar sync:check` | **0** | `SIN DRIFT` |
| 5 | `pnpm --filter @ego/avatar geometry:check` | **0** | `GEOMETRIA IDENTICA a la golden: 231 combinaciones` (sin re-grabar) |
| 6 | `pnpm --filter @ego/avatar attribution:check` | **0** | `CLASIFICACION CONFORME` (58/33) |
| 7 | `pnpm --filter @ego/avatar upstream:check` | **0** | `SIN DIVERGENCIA NO DECLARADA` |
| 8 | `pnpm --filter @ego/avatar no-verbatim:check` | **0** | `SIN RESIDUO VERBATIM` (91 presupuestos) |
| 9 | `node packages/avatar/scripts/check-bridge.mjs` | **0** | `CONTRATO CUMPLIDO` (15/15) |
| 10 | `pnpm --filter @ego/desktop typecheck` | **0** | el renderer compila con el motor nuevo |
| 11 | `pnpm --filter @ego/desktop test` | **0** | **430 passed, 5 skipped** (71 ficheros) |
| 12 | `pnpm -r typecheck` | **0** | todo el repo |
| 13 | `pnpm lint` | **0** | presupuesto de avisos respetado (recuento real 446, presupuesto 470 — **no lo he subido**) |

## 5. El texto exacto para A1 (la fila `EGO-FIND-116` → ✅)

```text
EGO-FIND-116 | 🟡 Media | **El perfil de personaje persiste y hace round-trip,
pero no alimenta el render: `traits`, `baseForm` y `outfitId` no llegan al
`<ego-avatar>`** | `packages/avatar/src/runtime/profile.js` (nuevo) ·
`packages/avatar/src/runtime/avatar-element.js` (observa `base-form`/`traits`/
`outfit` y los aplica al genoma) · `packages/avatar/tests/profile.test.js`
(nuevo) | 🟡 1d | 🟠 P1 | ✅ Completada | **Hecho (A6, Ola 11).** El elemento
`<ego-avatar>` observa ya `base-form`, `traits` y `outfit` (los mismos atributos
que cablea el renderer, `CharacterBadge.tsx:267-269`) y el perfil se traduce a
las palancas que el motor **sí expresa**: la silueta del genoma
(`shape.roundness`/`shape.ratio`), el apéndice, la marca, el aura y el accesorio
del studio. **El render cambia con el perfil** —lo comprueba un test que
compara el **SVG real** (`renderShell`), no un aceptador de atributos—. El
vocabulario se traduce en un módulo propio (`src/runtime/profile.js`, **nativo**:
no es geometría upstream) con tres tablas explícitas: las 4 `baseForm` → la
silueta, los 8 `TraitKind` → las palancas del motor, y los outfits → el
accesorio (el outfit manda sobre el rasgo que también pida pieza: la ropa
explícita gana). Lo que el motor **no puede expresar** se DECLARA, no se
inventa: el rasgo `floating-shards` (las partículas del motor son del estado,
no un knob del genoma) y los outfits `beanie`/`scarf`/`bow` (el motor tiene un
solo hueco de accesorio y 16 piezas). El golden geométrico **no** se re-graba
(231/231): el perfil es un overlay de identidad, no un cambio de la geometría
por estado que la golden fija. ·
**Pendiente (A4, si quiere afinar el mapeo):** el motor no expresa
`floating-shards` ni los outfits `beanie`/`scarf`/`bow`; si el renderer quiere
que se vean, hace falta una pieza nueva en el motor (o un rasgo del genoma).
```

## 6. Ficheros tocados en esta ola (exclusivamente mi zona)

| Fichero | Cambio |
|---|---|
| `packages/avatar/src/runtime/profile.js` | **nuevo** (nativo): las tablas del perfil → motor, `parseTraits`, `resolveProfile`, `applyProfileToGenome` |
| `packages/avatar/src/runtime/avatar-element.js` | observa `base-form`/`traits`/`outfit`; `_applyProfile()`; el perfil se mezcla bajo los overrides manuales |
| `packages/avatar/tests/profile.test.js` | **nuevo**: 10 casos (el render cambia con el perfil) |
| `packages/avatar/tests/attribution.test.js` | caso nuevo: el manifiesto ausente ⇒ error accionable (no `TypeError`); baseline 58/33 |
| `packages/avatar/scripts/check-attribution.mjs` | el mensaje del manifiesto ausente es accionable |
| `packages/avatar/provenance.manifest.json` | 2 entradas **nativas** nuevas (presupuesto 0) |
| `packages/avatar/upstream-divergence.json` | hashes re-declarados |
| `apps/desktop/renderer/floating/vendor/avatar/**` | re-sincronizado |

**No tocados**: `apps/desktop/renderer/components/**` (A4), `apps/desktop/src/**`,
`packages/{tools,ui-runtime,tool-call-repair,tasks,memory,runtime,security}/**`
(A2-bis), `scripts/**` y `.github/**` (A7), el resto de `docs/**` salvo
`docs/extractions/coucou.md`.

**Sin commits** · **sin `pnpm install`** · **sin `git checkout/reset/stash/clean`**.

## 7. Deuda abierta

1. **A4** — el mapeo del perfil es del motor (A6) pero el **vocabulario** es
   del renderer: si el renderer añade un `TraitKind` o un `baseForm`, el motor
   lo ignora y lo declara en `unmapped` (visible, no silencioso) ⇒ conviene que
   A4 revise `UNMAPPED_TRAITS` / `UNMAPPED_OUTFITS` cuando amplíe el
   vocabulario.
2. **A4** — la **intensidad** del rasgo (`traits[].intensity`) se pierde en el
   round-trip del bridge (solo viajan los nombres) ⇒ el motor los aplica al
   100 %. Si la intensidad debe notarse, el bridge tiene que conservarla (es
   zona de A4).
3. **A2-bis** — el texto de §2.2 (el mensaje accionable y la regla de
   `--fix`).
4. **A1** — el texto de §5 (la fila `EGO-FIND-116` → ✅).
5. **Menor** — `floating-shards` sin expresión: si el motor quiere
   partículas por perfil, necesita un knob (hoy las partículas son del estado).

## 8. `RESULTADO`

```json
{
  "agente": "A6",
  "status": "COMPLETE",
  "archivos_modificados": [
    "packages/avatar/src/runtime/profile.js",
    "packages/avatar/src/runtime/avatar-element.js",
    "packages/avatar/tests/profile.test.js",
    "packages/avatar/tests/attribution.test.js",
    "packages/avatar/scripts/check-attribution.mjs",
    "packages/avatar/provenance.manifest.json",
    "packages/avatar/upstream-divergence.json",
    "apps/desktop/renderer/floating/vendor/avatar/** (re-sincronizado)"
  ],
  "hallazgos_resueltos": [
    "EGO-FIND-116: el motor ahora OBSERVA base-form / traits / outfit y el RENDER cambia con el perfil. El perfil se traduce a las palancas del motor (silueta, apendice, marca, aura, accesorio del studio) en un modulo PROPIO (src/runtime/profile.js). Test propio (10 casos) que compara el SVG real, no un aceptador de atributos. El golden NO se regraba: geometry:check sigue 231/231.",
    "EGO-FIND-116 (plano 2): lo que el motor no puede expresar se DECLARA (floating-shards; outfits beanie/scarf/bow) en vez de inventarse. El outfit manda sobre el rasgo que tambien pide accesorio.",
    "EGO-FIND-116 (T2): mi puerta NO tenia el TypeError (el guard ya existia); el mensaje del manifiesto ausente es ahora ACCIONABLE (dice que falta, para que sirve y como se genera) y hay un test que lo fija (ni TypeError ni undefined en la salida).",
    "Clasificacion: los 2 ficheros nuevos son NATIVOS (propios, sin traduccion de upstream), con presupuesto de residuo 0. Derivados 58 (sin cambio) / nativos 31 -> 33. La puerta de verbatim lo confirma.",
    "Verificado que el renderer sigue compilando y sus 430 tests pasan con el motor nuevo (el perfil no rompe nada de A4)."
  ],
  "verify": {
    "avatar test": "331/331 pass - exit 0",
    "avatar typecheck": "exit 0",
    "avatar build": "exit 0",
    "avatar sync:check": "SIN DRIFT - exit 0",
    "avatar geometry:check": "231/231 (sin regrabar) - exit 0",
    "avatar attribution:check": "CLASIFICACION CONFORME (58/33) - exit 0",
    "avatar upstream:check": "exit 0",
    "avatar no-verbatim:check": "exit 0",
    "bridge:check": "CONTRATO CUMPLIDO - exit 0",
    "desktop typecheck": "exit 0",
    "desktop test": "430 passed / 5 skipped - exit 0",
    "pnpm -r typecheck": "exit 0",
    "pnpm lint": "exit 0 (presupuesto de avisos: 446 real / 470; no lo he subido)"
  },
  "solicitudes_handoff": [
    "A1 - texto exacto para la fila EGO-FIND-116 del Backlog (-> Completada), en la seccion 5 del handoff.",
    "A2-bis - el TypeError ya no existe en tu implementacion generica (verificado); lo que falta es el mensaje ACCIONABLE y la regla de que --fix no mute. Texto exacto en la seccion 2.2.",
    "A4 - dos puntos: (a) revisar UNMAPPED_TRAITS / UNMAPPED_OUTFITS cuando amplies el vocabulario (el motor los declara, no los inventa); (b) la intensidad de los rasgos se pierde en el round-trip del bridge (solo viajan los nombres) - si debe notarse, el bridge tiene que conservarla (es tu zona)."
  ],
  "deuda_abierta": [
    "A4: el vocabulario del perfil es del renderer: un TraitKind o baseForm nuevo llega al motor como 'no expresado' (visible, no silencioso)",
    "A4: la intensidad de los rasgos se pierde en el round-trip (solo los nombres)",
    "A2-bis: mensaje accionable del manifiesto ausente + regla de --fix sin mutacion",
    "A1: cerrar la fila EGO-FIND-116",
    "Menor: floating-shards sigue sin expresion (las particulas del motor son del estado)"
  ],
  "SKILLS_CARGADAS": []
}
```
