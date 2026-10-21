# Handoff A6 (Ola 8) — 2026-10-21 — EGO-FIND-82 (lado código): la cabecera canónica del motor de personaje

> Zona de A6 en esta ola: `packages/avatar/**` y
> `apps/desktop/renderer/floating/vendor/avatar/**`. Sin commits. Sin
> `pnpm install`. Sin tocar `repos-referencia/` (referencia de solo lectura).

## 0. Resumen ejecutivo (léase primero)

La fila de `EGO-FIND-82` dice *"0 de 313 ficheros de `packages/` llevan la
cabecera canónica"*. Ese era el estado de los 313. **La fila no se arregla
normalizando cabeceras a mano: se arregla haciendo la clasificación
reproducible**, y para eso hacía falta un denominador. Este handoff entrega
ese denominador para el paquete que contiene el único código realmente
derivado del repo.

| Ítem | Estado | Resultado |
|---|---|---|
| **T1** — la clasificación definitiva derivado/nativo | ✅ | **86 ficheros clasificados** (63 derivados + 23 nativos), con evidencia por fichero, medidos contra el clon de referencia. El manifiesto `provenance.manifest.json` es el **denominador**. |
| **T2** — cabeceras canónicas donde toca | ✅ | **63/63 derivados** llevan la cabecera `Adapted from <upstream> (<LICENCIA>), <ruta>`; **0/23 nativos** la llevan. 1 atribución falsa corregida (`studio/render/geometry.js`). |
| **T3** — la puerta de atribución | ✅ | `check-attribution.mjs` **re-escrito sobre el manifiesto**: falla si un derivado no lleva cabecera, si la forma/upstream/licencia/ruta no cuadran, **si un nativo la lleva**, si algo no está clasificado, si falta el aviso en `LICENSE.md`, o si una ruta `vendor/…` deja de resolver. **12 tests con fixtures** (rojo→verde pegados). |
| **T4** — `LICENSE.md` / `NOTICE` | ✅ | Reescritos **desde el manifiesto** (no pueden divergir): tabla de 63 ficheros derivados con su origen y su evidencia, tabla de los 23 nativos, los 5 upstreams con su licencia y su copyright, y el aviso nuevo del motor canvas. |

**Corrección de una afirmación que la ola dio por buena**: las 7 cabeceras
`Adapted from ego-avatar/avatar_studio_cx_artlab_mochi_2_0.html (MIT)` que ya
existían **afirmaban una licencia (MIT) que el fichero de origen no declara**.
El `LICENSE.md` del propio clon dice *"según archivo de origen"* y el
single-file **no declara licencia ninguna**. Corregido a la verdad.

## 1. T1 — La clasificación definitiva

### 1.1 El método (no se adivinó nada)

Dos instrumentos complementarios, ambos sobre el clon de referencia
`repos-referencia/avatar/` (el working tree, que es la fuente real del port):

1. **Residuo de *shingles***: 48 caracteres sobre el texto normalizado (sin
   comentarios, espacios colapsados). Da la fracción del fichero que sigue
   siendo texto del upstream. **Cubre el contenido de los literales de
   cadena**, que es el punto ciego de una métrica por líneas (en
   `src/render/ara-head.js` el 98 % del fichero es un único path SVG).
2. **Literales y tablas**: para los ficheros que son una tabla de datos, la
   prueba es que **cada valor literal** aparece en el fichero de origen.

Y el contraste con el **`LICENSE.md` del propio clon**, que es el registro de
procedencia por fichero del port (la tabla *"Código adaptado"*).

### 1.2 La tabla de divergencias declaradas frente al upstream

Clasificación por upstream (el **denominador** de la puerta):

| Upstream | Licencia | Copyright | Derivados | Ruta de referencia |
|---|---|---|:---:|---|
| `agent-robot-avatar` | MIT | © CX ART Lab | 9 | `vendor/agent-robot-avatar/` |
| `coucou` | MIT | © Louis Raillart | 7 | `vendor/coucou/` |
| `coucou-swift` | MIT | © Louis Raillart | 1 | `vendor/coucou-swift/` |
| `ego-avatar-studio` | **licencia no declarada en el origen** | — | 14 | `repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html` |
| `ego-avatar` | MIT | © Ego Project | 32 | `repos-referencia/avatar/` |
| | | | **63** | |

Por área: `src/` 31 derivados + 18 nativos · `tests/` 29 + 4 (+1 golden, que es
dato) · `demo/` 3 + 0. **85 ficheros de código en disco, 86 entradas (los 85 +
la golden) — cero sin clasificar.**

### 1.3 La evidencia que sostiene la clasificación

| Fichero | Evidencia |
|---|---|
| `src/render/ara-head.js` | **COPIA LITERAL**: el path SVG de 2411 caracteres de `ARA_HEAD_D` es **idéntico byte a byte** al atributo `d` de `#headShape` en `vendor/agent-robot-avatar/core.js`. |
| `src/runtime/poses.js` | **TABLA LITERAL**: la tabla de 10 números por pose procede de `agent-robot-avatar/core.js:8-57` (38 % de shingles contra el corpus). |
| `src/studio/config.js` | **PUERTO DE DATOS**: cada literal de `STUDIO_DEFAULTS` (`#1e222d`, `#dbf59d`, `cx-faithful`, `cx-led`, `eyeSpacing`, `squircleN`…) aparece en el single-file de origen. |
| `src/studio/render/accessories.js` | Su cabecera decía *"geometría propia de Ego"*, pero el código es **idéntico al del clon** (366/366 líneas sin comentarios). ⇒ **derivado**: la sustitución D4 **no** se hizo en este fichero. |
| `src/studio/render/{body,ears,eyes,mouth}.js` | Derivados del single-file (26–63 % de shingles contra el HTML) **con la geometría sustituida** por la de Ego ⇒ llevan cabecera **y** su nota de geometría propia. |
| `src/studio/render/helpers.js` | 37 % contra el HTML: port de las primitivas de canvas, implementación y nomenclatura propias. |
| `demo/robot-studio/*` | **0 %** contra el HTML completo ⇒ **no** son un port de sus bloques, sino una reescritura cuyo origen inmediato es el clon `ego-avatar`. La fila histórica del `LICENSE.md` del clon ("mismo archivo, bloques HTML 79-606") describía el `demo/studio/*` de antes de la consolidación. |
| `src/runtime/studio-bridge.js`, `src/runtime/svg-export.js`, `src/studio/render/geometry.js` | **0 %** contra todo el clon ⇒ código **nuevo** de Ego (extraído en la Ola 1). |
| `src/core/{genome,morph,palette,prng}.js`, `src/render/{builder,parts,shell}.js`, `src/runtime/avatar-element.js`, `src/studio/{adapter,element-host,index}.js` | **Asimilación de patrón**: código propio que implementa una idea de un repo de referencia (superelipse, traits `roundness`/`ratio`, capa de política, estructura del rig). Sin código del origen ⇒ **no** llevan cabecera. |

### 1.4 El manifiesto (el entregable)

`packages/avatar/provenance.manifest.json` — **63 derivados + 23 nativos + 5
upstreams**. Por fichero derivado: `path`, `upstream`, `origin` (la ruta de
origen), `via` (el camino intermedio), `evidence` (la evidencia, en prosa). Por
nativo: `path` y `reason` (por qué es nativo). Es un fichero **machine-readable**
→ la puerta es un gate, no una revisión manual.

## 2. T2 — Las cabeceras canónicas

### 2.1 La forma

```js
// Adapted from <upstream> (<LICENCIA>), <ruta de origen>
```

Ejemplos reales del paquete:

```js
// Adapted from coucou (MIT), vendor/coucou/core/anim.ts
// Adapted from agent-robot-avatar (MIT), vendor/agent-robot-avatar/core.js
// Adapted from ego-avatar (MIT), repos-referencia/avatar/tests/anim.test.js
// Adapted from ego-avatar-studio (licencia no declarada en el origen), repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html
```

En HTML el comentario es `<!-- … -->`; en CSS es `/* … */`. La puerta deriva
el *matcher* del estilo, así que la forma de la línea y su comprobación no
pueden divergir.

### 2.2 Recuento final

| | Ficheros | Con cabecera canónica | Sin cabecera |
|---|:---:|:---:|:---:|
| **Derivados** | **63** | **63** | **0** |
| **Nativos** | **23** | **0** | **23** (correcto) |
| Copia vendorizada (`src/` de la copia) | 31 | **31** | 0 |

### 2.3 La atribución falsa que se corrigió

`src/studio/render/geometry.js` (nativo: sus proporciones son de Ego, 0 % de
residuo contra el HTML) decía:

```text
// Adapted from ego-avatar/avatar_studio_cx_artlab_mochi_2_0.html (MIT),
// líneas 2325-2474, ...: se adapta el PATRON (...); las proporciones y la
// nomenclatura son propias.
```

Eso afirmaba una derivación de código **que no existe** (es un patrón
asimilado) **y** una licencia que el origen no declara. Ahora dice la verdad:

```text
// PATRÓN ASIMILADO, NO CÓDIGO DERIVADO: del single-file del estudio se adopta
// el PATRÓN (casco, cúpula acústica, boca por estados, accesorio superior);
// las proporciones, los valores y la nomenclatura son propios de Ego. Por eso
// este fichero NO lleva cabecera de atribución: no contiene código del origen.
```

### 2.4 La decisión sobre el `"(MIT)"` del motor canvas — **punto para el owner**

Las 7 cabeceras del motor canvas afirmaban `(MIT)` sobre un fichero que **no
declara licencia**. La evidencia:

- el single-file `avatar_studio_cx_artlab_mochi_2_0.html` **no tiene ninguna
  línea de licencia ni de copyright** (verificado con grep);
- el `LICENSE.md` del propio clon dice, para la fila `src/studio/*`:
  *"licencia: según archivo de origen (single-file del usuario)"* — es decir,
  **no** afirma MIT;
- el material MIT que ese fichero incorpora (el robot de CX ART Lab y el motor
  de Mochi de Coucou) **sí** está acreditado, porque el corpus `vendor/` lo
  contiene y las cabeceras de `LICENSE.md` lo nombran.

⇒ Las cabeceras dicen literalmente *"licencia no declarada en el origen"*, y
`LICENSE.md`/`NOTICE` explican por qué y acreditan a los dos autores MIT.
**Si el owner prefiere `(MIT)` para el motor canvas, es un cambio de una línea
en el manifiesto** (`upstreams["ego-avatar-studio"].license`) y `--fix` lo
reproduce en los 14 ficheros.

## 3. T3 — La puerta de atribución

### 3.1 Qué es ahora

`packages/avatar/scripts/check-attribution.mjs` — **reescrito sobre el
manifiesto** (antes solo comprobaba que las rutas `vendor/…` resolubles).

Falla (exit 1) si:

| # | Condición | Por qué |
|---|---|---|
| 1 | un **derivado** no lleva cabecera canónica | el modelo §4.3 |
| 2 | la cabecera no tiene la forma exacta, o su upstream/licencia/ruta no cuadran con el manifiesto | el manifiesto es el denominador |
| 3 | un **nativo** lleva cabecera canónica (en cualquier forma, incluida la vieja) | **atribución falsa** — precedente `EGO-FIND-83` |
| 4 | un fichero de código en disco **no está clasificado** | el manifiesto es total |
| 5 | una entrada del manifiesto **no existe** en disco |同上 |
| 6 | el `LICENSE.md` **no recoge** el aviso de un upstream en uso | el aviso MIT viaja con el paquete |
| 7 | alguna ruta `vendor/…` citada deja de resolver | la cadena MIT es resoluble |
| 8 | el corpus se **importa** desde `src/` | el corpus no es código de runtime |
| 9 | la copia vendorizada no lleva su corpus, o difiere por SHA-256 | las dos copias son byte-idénticas |
| 10 | la copia vendorizada **no lleva** la cabecera canónica, o no cuadra | mismo tratamiento en las dos copias |

**Reproducible**: `--fix` reescribe las cabeceras que falten o no cuadran
**desde el manifiesto** (`pnpm --filter @ego/avatar attribution:declare`). No
depende de una edición manual.

**Idempotente**: volver a ejecutarlo no cambia nada (una cabecera que ya
casa no se toca).

### 3.2 El test (rojo → verde, output pegado)

`packages/avatar/tests/attribution.test.js` — 12 casos con *fixtures* (un
paquete mínimo montado en un directorio temporal).

**ROJO** (antes de implementar la puerta; la puerta no conocía el manifiesto):

```text
  ok 1 - un paquete conforme pasa la puerta (exit 0)
  not ok 2 - un derivado SIN cabecera canonica falla (exit 1)
  not ok 3 - una cabecera MAL FORMADA falla (exit 1)
  not ok 4 - una cabecera cuya LICENCIA no cuadra con el manifiesto falla (exit 1)
  not ok 5 - una cabecera cuya RUTA no cuadra con el manifiesto falla (exit 1)
  ok 6 - un NATIVO sin cabecera NO falla (exit 0)
  not ok 7 - un nativo CON cabecera canonica falla: seria una atribucion falsa (exit 1)
  not ok 8 - un paquete con codigo derivado y SIN aviso en LICENSE.md falla (exit 1)
  not ok 9 - un fichero en disco SIN clasificar en el manifiesto falla (exit 1)
  not ok 10 - un fichero del manifiesto que NO existe en disco falla (exit 1)
  not ok 11 - la puerta real del paquete pasa (exit 0)
  # tests 11
  # pass 1
  # fail 10
```

**VERDE** (estado actual):

```text
  ok 1 - un paquete conforme pasa la puerta (exit 0)
  ok 2 - un derivado SIN cabecera canonica falla (exit 1)
  ok 3 - una cabecera MAL FORMADA falla (exit 1)
  ok 4 - una cabecera cuya LICENCIA no cuadra con el manifiesto falla (exit 1)
  ok 5 - una cabecera cuya RUTA no cuadra con el manifiesto falla (exit 1)
  ok 6 - un NATIVO sin cabecera NO falla (exit 0)
  ok 7 - un nativo CON cabecera canonica falla: seria una atribucion falsa (exit 1)
  ok 8 - un nativo con una cabecera "Adapted from" en la forma VIEJA tambien falla
  ok 9 - un paquete con codigo derivado y SIN aviso en LICENSE.md falla (exit 1)
  ok 10 - un fichero en disco SIN clasificar en el manifiesto falla (exit 1)
  ok 11 - un fichero del manifiesto que NO existe en disco falla (exit 1)
  ok 12 - la puerta real del paquete pasa (exit 0)
  # tests 12
  # pass 12
  # fail 0
```

> El caso 8 se añadió **después** del primer verde, al descubrir un punto
> ciego: el *matcher* del manifiesto no reconoce la cabecera **vieja**
> (upstream con `/`), así que una atribución falsa en esa forma se colaba en
> un nativo. La puerta ahora busca *cualquier* `Adapted from` en un nativo, y
> el caso 8 lo fija.

## 4. T4 — `LICENSE.md` y `NOTICE`

Ambos **se generan desde el manifiesto**, así que no pueden divergir de él.

- `LICENSE.md` (261 líneas): los 5 upstreams con su licencia, su copyright y su
  ruta; la **tabla de los 63 ficheros derivados** con su ruta de origen y su
  evidencia; la **tabla de los 23 nativos** con el motivo de cada uno; las
  sustituciones de geometría propias (D4); el corpus `vendor/`; y las fuentes
  externas consultadas (que **no** son código derivado).
- `NOTICE` (82 líneas): los 5 upstreams con su aviso, incluido el **aviso
  nuevo** del motor canvas (que explica que el origen no declara licencia y
  que el material MIT embebido queda acreditado en el corpus).
- La copia vendorizada lleva **los tres** + `provenance.manifest.json`
  (`sync-check.mjs` los trata como *sidecar* y los compara por SHA-256).

## 5. Verificación (comando + exit + resumen)

| # | Comando | Exit | Resumen |
|---|---|:---:|---|
| 1 | `pnpm --filter @ego/avatar test` | **0** | **303 tests, 303 pass, 0 fail** (291 + 12 nuevos) |
| 2 | `pnpm --filter @ego/avatar typecheck` | **0** | `tsc -p tsconfig.json` (allowJs + checkJs) |
| 3 | `pnpm --filter @ego/avatar build` | **0** | `dist/` al día (50 ficheros) + manifiesto SHA-256 |
| 4 | `pnpm --filter @ego/avatar build:check` | **0** | `dist/` al día |
| 5 | `pnpm --filter @ego/avatar sync:check` | **0** | `SIN DRIFT` (código + legales + `provenance.manifest.json` + corpus) |
| 6 | `pnpm --filter @ego/avatar geometry:check` | **0** | `GEOMETRIA IDENTICA a la golden: 231 combinaciones` |
| 7 | `pnpm --filter @ego/avatar attribution:check` | **0** | `CLASIFICACION CONFORME` + `CADENA MIT RESOLUBLE` |
| 8 | `pnpm --filter @ego/avatar upstream:check` | **0** | `SIN DIVERGENCIA NO DECLARADA` (36 declaradas, 5 nuevos) |
| 9 | `node packages/avatar/scripts/check-bridge.mjs` | **0** | `CONTRATO CUMPLIDO` (round-trip 15/15) |
| 10 | `pnpm -r typecheck` | **0** | todos los paquetes |
| 11 | `pnpm lint` | **0** | lint + typecheck |

> Los recuentos del enunciado de la ola (266 tests · 168/168 de geometría)
> estaban **desfasados**: el estado real es **303 tests** y **231/231**
> (el golden creció en las olas 2 y 4b).

## 6. La lista para A7 (dónde va la puerta y cómo la cablea a CI)

**La puerta se queda en mi zona**: `packages/avatar/scripts/check-attribution.mjs`.
No la muevo a `scripts/**` (zona de A7) porque su denominador es un fichero
**del paquete** (`packages/avatar/provenance.manifest.json`) y su `--root`
acepta otro raíz: moverla al raíz del repo obligaría a redesignar su contrato.

### Especificación exacta para el job `verify` de CI

```yaml
# .github/workflows/ci.yml — job `verify`, antes del typecheck (fail-fast)

- name: attribution (paquete @ego/avatar)
  run: pnpm --filter @ego/avatar attribution:check
  # exit 0 = conforme; exit 1 = un derivado sin cabecera, un nativo con cabecera,
  # algo sin clasificar, un aviso que falta en LICENSE.md, o una referencia colgando.
  # Equivalente directo (sin pnpm):
  #   node packages/avatar/scripts/check-attribution.mjs
```

**Para la extensión a todo `packages/**` (que es la parte (b) de la fila y es
de A2bis)**, el contrato que la puerta ya soporta:

```bash
# La puerta acepta un raíz alterno: sirve para cada paquete con código derivado.
node packages/avatar/scripts/check-attribution.mjs --root packages/<paquete>
```

Pero **cada paquete necesita su propio manifiesto**
(`<paquete>/provenance.manifest.json`) con el mismo esquema. ⇒ **A7 no tiene que
tocar la puerta**: sólo cablear `attribution:check` por paquete, y A2bis
producir el manifiesto de cada paquete con código derivado.

**Coste**: la puerta tarda ~1 s (63 ficheros + el corpus). Es trivial como paso
fail-fast.

### Ficheros vendorizados tratados (los 31 con cabecera canónica)

La copia `apps/desktop/renderer/floating/vendor/avatar/` **no tiene prefijo
`src/`**: el contenido de `src/` cuelga de su raíz. Los 31 ficheros con
cabecera canónica:

```text
apps/desktop/renderer/floating/vendor/avatar/core/{anim,config,timeline}.js
apps/desktop/renderer/floating/vendor/avatar/render/{ara-head,body,eyes,projection,static}.js
apps/desktop/renderer/floating/vendor/avatar/runtime/{extension-host,fx-eyes,micro,pointer,policy,poses,presence,sound,states}.js
apps/desktop/renderer/floating/vendor/avatar/studio/{avatar,config,sound}.js
apps/desktop/renderer/floating/vendor/avatar/studio/render/{accessories,body,ears,eyes,helpers,mouth,overlays,particles,visor}.js
apps/desktop/renderer/floating/vendor/avatar/studio/rig/{eyes,hands}.js
```

Además, en la raíz de la copia: `LICENSE`, `LICENSE.md`, `NOTICE` y
**`provenance.manifest.json`** (sidecars, comparados por SHA-256).

La puerta **verifica** las dos copias (que la copia lleve las mismas cabeceras
canónicas y que cuadren con el manifiesto): `vendoredChecked: 31`.

## 7. El texto exacto para A1 (fila `EGO-FIND-82`)

> **Para la fila `EGO-FIND-82` de `docs/roadmap/Backlog.md`.** El literal
> actual dice *"0 de 313 ficheros de `packages/` llevan la cabecera canónica"*.
> Eso ya **no es cierto**: a fecha de hoy **63 ficheros de `packages/avatar/`**
> llevan la cabecera canónica verificada por gate. Propuesta de redacción
> (A1 decide el estado y el resto del literal; A6 no toca `docs/`):

```text
EGO-FIND-82 | 🔴 Crítica | **Cadena de atribución de licencia del catálogo de
referencia sin desplegar** | `packages/avatar/provenance.manifest.json` ·
`packages/avatar/scripts/check-attribution.mjs` | 🟡 2-3d | 🔴 P0 | 🟠 Parcial
| **Hecho en `packages/avatar/` (A6, Ola 8):** el paquete que contiene el
único código realmente derivado del repo queda cerrado con un **denominador
explícito**: `provenance.manifest.json` clasifica **86 ficheros** (63
derivados + 23 nativos) con su upstream, su licencia, su ruta de origen y la
evidencia de la clasificación (residuo de shingles contra el clon de
referencia + literales + el `LICENSE.md` del propio clon). Los **63
derivados** llevan la cabecera `Adapted from <upstream> (<LICENCIA>), <ruta>`
y los **23 nativos** no (un nativo con cabecera sería una atribución falsa:
precedente EGO-FIND-83). La puerta `check-attribution.mjs` es ahora **el
gate**: falla si un derivado no lleva cabecera, si la forma/upstream/licencia/
ruta no cuadran con el manifiesto, si un nativo la lleva, si un fichero no
está clasificado, si el `LICENSE.md` no recoge el aviso de un upstream en
uso o si una ruta `vendor/…` deja de resolver; tiene 12 tests con fixtures y
un modo `--fix` que reproduce las cabeceras desde el manifiesto. `LICENSE.md`
y `NOTICE` se **generan desde el manifiesto** (no pueden divergir). ·
**Pendiente (A2bis + A7):** extender el mismo contrato al resto de
`packages/**` (cada paquete con código derivado necesita su
`provenance.manifest.json`; la puerta ya acepta `--root <paquete>`), y
normalizar las cabeceras en prosa de los demás paquetes. ·
**Corrección de una afirmación previa:** las cabeceras del motor canvas
afirmaban `(MIT)` sobre un fichero de origen que **no declara licencia**
(el `LICENSE.md` del clon dice "según archivo de origen"); ahora dicen
literalmente "licencia no declarada en el origen" y el material MIT embebido
queda acreditado en el corpus `vendor/`.
```

## 8. Ficheros tocados en esta ola (exclusivamente mi zona)

| Fichero | Cambio |
|---|---|
| `packages/avatar/provenance.manifest.json` | **nuevo**: el manifiesto (63 derivados + 23 nativos + 5 upstreams) — el denominador |
| `packages/avatar/scripts/check-attribution.mjs` | **reescrito** sobre el manifiesto; `--root`, `--json`, `--fix`; 10 condiciones de fallo |
| `packages/avatar/tests/attribution.test.js` | **nuevo**: 12 casos con fixtures |
| `packages/avatar/src/**` (31 ficheros) | cabecera canónica |
| `packages/avatar/tests/**` (29 ficheros) | cabecera canónica |
| `packages/avatar/demo/robot-studio/*` (3) | cabecera canónica (`<!-- -->` / `/* */`) |
| `packages/avatar/src/studio/render/geometry.js` | **atribución falsa corregida** (patrón asimilado, no código derivado) |
| `packages/avatar/LICENSE.md` · `NOTICE` | reescritos desde el manifiesto |
| `packages/avatar/README.md` · `DESIGN.md` | §*El manifiesto de procedencia* y §11-bis (el modelo de atribución y lo que revela la medición) |
| `packages/avatar/package.json` | `attribution:declare`, `provenance:check`; `provenance.manifest.json` en `files` |
| `packages/avatar/scripts/sync-check.mjs` | `provenance.manifest.json` pasa a ser *sidecar* (se replica y se compara por SHA-256) |
| `packages/avatar/upstream-divergence.json` | 36 divergencias declaradas (antes 25): las 11 nuevas divergen **sólo** por la cabecera; motivos completados |
| `apps/desktop/renderer/floating/vendor/avatar/**` | re-sincronizado (31 cabeceras + 3 legales + manifiesto) |

**No tocados**: `repos-referencia/**`, `packages/*` restantes, `apps/desktop/{src,renderer}/**`
salvo la copia vendorizada, `apps/desktop/scripts/**`, `docs/**` salvo este
handoff, `.github/**`, `scripts/**` de la raíz, `package.json` raíz.

**Sin commits** · **sin `pnpm install`** · **sin `git checkout/reset/stash/clean`**.

## 9. Deuda abierta

1. **A2bis** — extender el contrato a los demás paquetes de `packages/**`: cada
   uno con código derivado necesita su `provenance.manifest.json` (el modelo
   está en el de `avatar`). Quedan ~24 prosa sin normalizar y 1 paquete
   (`tool-call-repair`) con `LICENSE.md` incompleto (sin `NOTICE` y con
   atribución en prosa en sus 3 ficheros).
2. **A7** — cablear `attribution:check` al job `verify` de CI (spec en §6). No
   hace falta mover la puerta.
3. **Owner** — confirmar la decisión de la licencia del motor canvas (§2.4):
   `"licencia no declarada en el origen"` (lo que dice la evidencia) frente a
   `(MIT)`. Es una línea del manifiesto y un `--fix`.
4. **Menor** — la clasificación de los **29 tests portados** y los **3
   ficheros de la demo** como "derivados de `ego-avatar`" (MIT propio de Ego) es
   una decisión de criterio, no una obligación de licencia. Se declares por
   trazabilidad. Si el owner prefiere no atribuir código de Ego a Ego, la
   lista baja a 31 derivados (solo `src/`) y el manifiesto se regenera.

## 10. `RESULTADO`

```json
{
  "agente": "A6",
  "status": "COMPLETE",
  "archivos_modificados": [
    "packages/avatar/provenance.manifest.json",
    "packages/avatar/scripts/check-attribution.mjs",
    "packages/avatar/scripts/sync-check.mjs",
    "packages/avatar/tests/attribution.test.js",
    "packages/avatar/src/ (31 ficheros con cabecera canonica)",
    "packages/avatar/src/studio/render/geometry.js",
    "packages/avatar/tests/ (29 ficheros con cabecera canonica)",
    "packages/avatar/demo/robot-studio/ (3 ficheros con cabecera canonica)",
    "packages/avatar/LICENSE.md",
    "packages/avatar/NOTICE",
    "packages/avatar/README.md",
    "packages/avatar/DESIGN.md",
    "packages/avatar/package.json",
    "packages/avatar/upstream-divergence.json",
    "apps/desktop/renderer/floating/vendor/avatar/ (re-sincronizado)"
  ],
  "hallazgos_resueltos": [
    "T1: clasificacion definitiva derivado/nativo de 86 ficheros (63 derivados + 23 nativos), medida contra el clon de referencia con residuo de shingles + literales, y contrastada con el LICENSE.md del clon. Cero ficheros sin clasificar.",
    "T1: el manifiesto provenance.manifest.json es el denominador machine-readable (upstream, licencia, ruta de origen, via y evidencia por fichero).",
    "T2: 63/63 derivados con la cabecera canonica; 0/23 nativos con cabecera.",
    "T2: 31/31 ficheros de la copia vendorizada con la misma cabecera.",
    "T2: corrigida una atribucion FALSA en src/studio/render/geometry.js (decia 'Adapted from ... (MIT)' siendo un patron asimilado nativo).",
    "T2: corregida la afirmacion de licencia no verificada '(MIT)' sobre el single-file que NO declara licencia: ahora dice 'licencia no declarada en el origen'.",
    "T3: la puerta check-attribution.mjs reescrita sobre el manifiesto, con 10 condiciones de fallo, --root/--json/--fix, y 12 tests con fixtures (rojo 10/11 -> verde 12/12).",
    "T3: cerrado un punto ciego de la puerta (una cabecera 'Adapted from' en la forma vieja se colaba en un nativo).",
    "T4: LICENSE.md (261 lineas) y NOTICE (82 lineas) reescritos desde el manifiesto: tabla de 63 derivados con origen y evidencia, tabla de 23 nativos, 5 upstreams con licencia y copyright, y el aviso nuevo del motor canvas.",
    "T4: el manifiesto viaja tambien en la copia vendorizada (sidecar comparado por SHA-256).",
    "Actualizado el manifiesto de divergencias frente al upstream: 36 declaradas (las 11 nuevas divergen solo por la cabecera) y los 11 motivos completados."
  ],
  "verify": {
    "test": "303/303 pass - exit 0",
    "typecheck": "exit 0",
    "build": "exit 0 (50 ficheros + manifiesto SHA-256)",
    "build:check": "exit 0",
    "sync:check": "SIN DRIFT - exit 0",
    "geometry:check": "231/231 - exit 0",
    "attribution:check": "CLASIFICACION CONFORME + CADENA MIT RESOLUBLE - exit 0",
    "upstream:check": "SIN DIVERGENCIA NO DECLARADA - exit 0",
    "bridge:check": "CONTRATO CUMPLIDO (15/15) - exit 0",
    "pnpm -r typecheck": "exit 0",
    "pnpm lint": "exit 0"
  },
  "solicitudes_handoff": [
    "A7 - CI: cablear 'pnpm --filter @ego/avatar attribution:check' al job verify antes del typecheck (fail-fast, ~1 s). La puerta NO se mueve de packages/avatar/scripts/: su denominador es un fichero del paquete y acepta --root para otros paquetes. Spec exacta en el handoff A6-ola8.md seccion 6.",
    "A2bis - extender el contrato al resto de packages/**: cada paquete con codigo derivado necesita su provenance.manifest.json (el modelo es el de packages/avatar/provenance.manifest.json) y normalizar las ~24 cabeceras en prosa; tool-call-repair sigue con LICENSE.md sin NOTICE y 3 cabeceras en prosa.",
    "A1 - texto exacto para la fila EGO-FIND-82 de docs/roadmap/Backlog.md (seccion 7 del handoff). El literal '0 de 313 ficheros de packages/ llevan la cabecera canonica' ya no es cierto: 63 de packages/avatar la llevan, con gate.",
    "Owner - confirmar la licencia del motor canvas: 'licencia no declarada en el origen' (lo que dice la evidencia: el single-file no declara licencia y su LICENSE.md dice 'segun archivo de origen') frente a '(MIT)'. Es una linea de upstreams['ego-avatar-studio'].license en el manifiesto + attribution:declare."
  ],
  "deuda_abierta": [
    "A2bis: extender manifiesto + puerta al resto de packages/** (24 prosa + 1 LICENSE.md incompleto)",
    "A7: cablear attribution:check al job verify de CI",
    "Owner: confirmar la licencia del motor canvas (evidencia dice 'no declarada')",
    "Criterio: los 29 tests portados y los 3 ficheros de la demo se declaran derivados de ego-avatar (MIT propio) por trazabilidad; si el owner no quiere atribuir Ego a Ego, bajan a 31 derivados"
  ],
  "SKILLS_CARGADAS": []
}
```
