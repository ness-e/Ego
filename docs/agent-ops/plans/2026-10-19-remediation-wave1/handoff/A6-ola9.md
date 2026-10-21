# Handoff A6 (Ola 9) — 2026-10-21 — D4 ejecutado: los puertos verbatim, sustituidos por geometría propia

> Zona de A6 en esta ola: `packages/avatar/**`,
> `apps/desktop/renderer/floating/vendor/avatar/**` y
> `docs/extractions/coucou.md`. Sin commits. Sin `pnpm install`.

## 0. Resumen ejecutivo (léase primero)

La decisión D4 del owner (2026-10-21) — *"sustituir los puertos verbatim de
Mochi por geometría propia"* — está **ejecutada y verificada por puerta**.

| | Antes (Ola 8) | **Ahora (Ola 9)** |
|---|:---:|:---:|
| Ficheros **derivados** (llevan `Adapted from …`) | 63 | **57** |
| Ficheros **nativos** (implementación propia de Ego) | 23 | **31** |
| Ficheros con **residuo verbatim** del upstream | 5 con residuo alto + 3 con residuo bajo | **0** |
| Puertas que vigilan la clasificación | 1 (`attribution:check`) | **2** (`attribution:check` + `no-verbatim:check`) |
| Tests del paquete | 303 | **312** |

**El número que prueba que D4 se ejecutó es 57** (derivados): los seis
ficheros sustituidos pasaron de `derived` a `native` en el manifiesto.

### El hallazgo que cambió el método

La puerta de la Ola 8 medía el residuo contra el **clon de referencia**
(`repos-referencia/avatar/`). Pero ese clon es **el paquete de Ego de una
iteración anterior**: mezcla código **propio** con ports. Medir contra él
responde a *"¿queda código de la iteración anterior?"*, no a *"¿queda código
del upstream?"* — y un fichero totalmente propio (`runtime/poses.js` tras D4)
seguía dando **33 % de residuo** por sus funciones propias.

⇒ **La puerta de D4 mide contra los upstreams verdaderos**: el corpus
`vendor/` (los originales MIT) y el single-file HTML del motor canvas. Con esa
referencia, los seis ficheros quedan en **0,0 %** y el detector es honesto.

## 1. T4-pre — El detector de residuo, primero

`packages/avatar/scripts/check-no-verbatim.mjs` (nuevo) + su test
`packages/avatar/tests/no-verbatim.test.js` (5 casos con *fixtures*).

**Test rojo pegado** (antes de que existiera la puerta; el manifiesto aún no
declaraba presupuestos):

```text
  ok 1 - un fichero SIN residuo dentro de presupuesto pasa (exit 0)
  ok 2 - un fichero CON residuo fuera de presupuesto falla (exit 1)
  ok 3 - un fichero con presupuesto que NO existe falla (exit 1)
  ok 4 - un presupuesto con tolerancia permite un residuo pequeno (exit 0)
  not ok 5 - la puerta real del paquete pasa (exit 0)
    error: 'ficheros con presupuesto: 0'
  # tests 5
  # pass 4
  # fail 1
```

**Verde** (estado actual): 5/5 ✔ y la puerta real en verde ✔.

Cómo funciona: mide el **residuo verbatim** con *shingles* de 48 caracteres
sobre el texto normalizado (sin comentarios) — el mismo método de la Ola 8 — y
lo compara contra el corpus `vendor/` y el single-file HTML. El **presupuesto**
vive en el manifiesto (`verbatim`), por fichero:

```json
"verbatim": {
  "src/render/ara-head.js": { "maxResidue": 0, "note": "Decision D4 (owner, 2026-10-21): …" },
  …
}
```

⇒ Un fichero con presupuesto 0 **no puede conservar ni un solo shingle de 48
caracteres del upstream**. La puerta lo dice con el fichero y la fuente más
cercana:

```text
residuo verbatim: 32 referencias, 6 ficheros con presupuesto (shingles de 48 caracteres)
  ok  src/render/ara-head.js                 medido=  0.0% presupuesto= 0.0%
  ok  src/render/body.js                     medido=  0.0% presupuesto= 0.0%
  ok  src/runtime/poses.js                   medido=  0.0% presupuesto= 0.0%
  ok  src/core/timeline.js                   medido=  0.0% presupuesto= 0.0%
  ok  src/studio/sound.js                    medido=  0.0% presupuesto= 0.0%
  ok  src/studio/render/accessories.js       medido=  0.0% presupuesto= 0.0%
  SIN RESIDUO VERBATIM fuera de presupuesto.
```

## 2. T1 — Qué cambió en cada fichero (y por qué la geometría propia es al menos tan buena)

### 2.1 `src/render/ara-head.js` — la silueta (residuo 95,1 % → **0 %**)

**Antes**: `COPIA LITERAL` del path `#headShape` de
`vendor/agent-robot-avatar/core.js` — 2411 caracteres idénticos byte a byte
(verificado).

**Ahora**: una **cúpula de Ego** generada por una regla propia:

- superelipse de exponente **3,4** (cuadrado redondeado; el original usaba 2,2,
  más esférico);
- la **corona se aplana** (proporción 0,14): la frente es ancha, no una esfera;
- el **mentón se estrecha** (proporción 0,18): la cara tiene mandíbula, no es una
  bola;
- las **mejillas se realzan** (0,06): un ensanche suave en la zona media;
- después se **normaliza** a la caja canónica 20…220, de modo que las medidas
  del rig (ojos, accesorios, marcas) siguen referida a las mismas coordenadas.

El nombre `ARA_HEAD_*` se conserva (es API pública: lo exporta `src/index.js` y
lo consume `render/body.js`), pero la geometría que nombra ya no es la de ARA.

**Medición de la propiedad** (el test nuevo la fija):
- distancia de Hausdorff contra la silueta del upstream: **10,97 px** (ida) /
  **10,99 px** (vuelta) — medidos sobre las 160 puntos;
- área: **34 094 px²** contra **35 673 px²** del upstream → **4,43 %** distinta.

### 2.2 `src/render/body.js` — el pipeline (residuo 10,2 % → **0 %**)

Siete funciones reescritas con las **mismas firmas públicas** (el contrato no
cambia) y con la semántica intacta: `parseHeadPoints`, `pointsToPath`,
`flattenHeadPoints` (los polos se mueven el inset completo, el ecuador no),
`superellipsePointARA`, `targetShape`, `mixPoints`, `headPathFor`. Los
exponentes del redondeo son propios (8,0 y 2,0; antes 10 y 2,2).

### 2.3 `src/runtime/poses.js` — la tabla de poses (residuo 38 % → **0 %**)

**Antes**: tabla literal de 10 números por pose (`core.js:8-57`).

**Ahora**: la tabla se **deriva de INTENCIONES** (abrir, cerrar por debajo,
inclinar, estirar, achatar) mediante una regla propia:

```js
const RIG = { width: 54, height: 58, lidRatio: 1.22 };
const INTENTS = { idle: { lid: 1.00, under: 1.00, tilt: 0, stretch: 1.00, squash: 1.00 }, … };
```

El párpado se para a `1,22 ×` el semialto del ojo; las aliases de Ego
(`wide`/`flat`/`closed`/`tired`/`spiral`) y `thinking` se conservan.

### 2.4 `src/core/timeline.js` — el runner (residuo 3,4 % → **0 %**)

Runner de tracks por campo reescrito: el estado del track (`step`, `origin`,
`began`), el avance del tiempo y la **reserva del campo** (`locked`) son
propios. `buildPhases` (fases acumuladas) reescrito con la misma salida.
`piecewise` y `segment` ya eran propios.

### 2.5 `src/studio/sound.js` — el sintetizador (residuo 64,5 % → **0 %**)

**Antes**: `SoundSynthesizer` con un `switch` de 25 estados y **literales de
frecuencia** (580, 720, 1250…).

**Ahora**: un **catálogo de gestos sonoros** (datos) + un **renderizador
genérico**:

```js
hover: { root: 523.25, steps: [0, 5], wave: 'sine', dur: 0.05, vol: 0.05, gap: 0.03 },
```

Cada gesto declara una raíz tonal, un patrón en semitonos y su envolvente; el
renderizador los convierte en tonos (cada paso glisa hacia el siguiente). Los
25 nombres (`STUDIO_SOUND_NAMES`) se conservan: son el contrato del puente, y
`check-bridge.mjs` sigue en verde.

### 2.6 `src/studio/render/accessories.js` — los accesorios (residuo 66,4 % → **0 %**)

**Antes**: 12 accesorios dibujados en una cadena `if/else` de 432 líneas, con
su cabecera diciendo *"geometría propia de Ego"* mientras el código era
**idéntico al del clon** (366/366 líneas sin comentarios) ⇒ **la cabecera
mentía**.

**Ahora**: dos capas —
- una de **primitivas** (`disc`, `hoop`, `oval`, `poly`, `petal`, `bar`,
  `sweep`, `lgrad`, `rgrad`, `paint`, `glow`): el vocabulario mínimo de dibujo;
- un **catálogo** de accesorios: una ficha por accesorio (dato) que dice qué
  pieza lo pinta y con qué parámetros, más **8 piezas genéricas** (antena,
  banda, lentes, gorro, orejas, corona, halo, brote).

Los 16 nombres del catálogo se conservan (los usa `tests/studio-mouth-hands.test.js`).

## 3. T2 — La atribución cambia con el trabajo (plano 2)

Cuando un fichero deja de ser un port literal **deja de ser derivado**:

- su cabecera pasa de `Adapted from <upstream> (<LIC>), <ruta>` al texto
  veraz del **plano 2**: *"implementación propia de Ego; patrón asimilado de
  `<upstream>`, sin traducción de código"*;
- pasa de `derived` a `native` en `packages/avatar/provenance.manifest.json`;
- `LICENSE.md` y `NOTICE` (que se **generan** desde el manifiesto) se
  regeneraron.

**Recuento antes/después:**

| | Antes | Ahora |
|---|:---:|:---:|
| Derivados | 63 | **57** |
| Nativos | 23 | **31** |
| De los cuales, con cabecera `Adapted from` | 63 | **57** |
| Nativos con cabecera `Adapted from` | 0 | **0** ✔ |
| Forma 2 (`ADAPTADO de …`) en el paquete | 4 | **0** (normalizadas a la forma canónica) |

Las dos puertas siguen en verde con la clasificación nueva (el manifiesto es la
fuente; ninguna regla se relajó):

```text
atribucion: 3 ficheros legales, 57 derivados + 31 nativos, …
  CADENA MIT RESOLUBLE: toda ruta citada existe en el repositorio.
  CLASIFICACION CONFORME: cada derivado lleva su cabecera canonica y ningun nativo la lleva.
  exit=0
```

## 4. T3 — El golden: qué cambió y por qué

### 4.1 El diff (antes de regenerar)

La golden compara la **traza de operaciones de canvas** del motor *studio*. El
cambio afecta a **un solo módulo** (`accessory`): los otros seis
(`body`, `ears`, `ears-back`, `mouth`, `eyes`, `overlays`) son **idénticos en
los 33 estados** — la substitución tocó el motor SVG y el core, que la golden
del studio no cubre.

```text
33 combinacion(es) con geometria distinta de 231.
```

| Módulo | Combinaciones que cambian | Antes → después (operaciones) |
|---|:---:|---|
| `accessory` | **33 / 33** | 23→18 (×21), 26→21 (×6), 17→54, 23→21, 25→25, 39→39, 52→50, 6→0 |

El cambio de fondo: la **base de la antena** pasa de ser una barra redondeada
(`roundRectPath`) a ser un **óvalo** (`ellipse`), y el dibujo de cada
accesorio se recompone con las piezas propias. La combinación `6→0` es el
accesorio `none`: antes se registraban 6 operaciones de transformación (translate
+ scale) sin dibujar nada; ahora **no se dibuja nada y no se transforma el
contexto**.

**Nota de honestidad**: el golden del studio **no cubre** el motor SVG (donde
sí han cambiado la silueta, las poses y el pipeline). Por eso la sustitución
lleva **su propia property test** (§5).

### 4.2 Verificación

```text
$ pnpm --filter @ego/avatar geometry:check
  GEOMETRIA IDENTICA a la golden: 231 combinaciones (33 estados x 7 modulos).
  exit=0
```

## 5. T3 — El test que fija la propiedad geométrica propia

`packages/avatar/tests/d4-geometry.test.js` (nuevo, 4 casos). No compara
píxeles: compara **propiedades geométricas** contra el corpus del upstream
(`vendor/agent-robot-avatar/core.js`, que vive en el paquete):

| Test | Qué fija |
|---|---|
| `la silueta propia NO es la del upstream (D4)` | la **distancia de Hausdorff** entre las dos siluetas > 5 px (**medida: 10,97 px**) y el **área** difiere > 2 % (**medida: 4,43 %**) |
| `la silueta es determinista y ocupa la caja canónica 20…220` | el contorno determinista y exacto en la caja |
| `la tabla de poses propia NO es la literal del upstream (D4)` | **ninguna** pose coincide con la tabla del upstream |
| `la tabla de poses se deriva de la regla de intenciones` | las propiedades de la regla (simetría,_sizes, rangos) |

**Que el test muerde, comprobado**: simulé la restauración de la silueta
(original contra sí misma) y la aserción falla con **Hausdorff 0,00 px** ⇒ una
restauración rompe el test.

## 6. Verificación (comando + exit + resumen)

| # | Comando | Exit | Resumen |
|---|---|:---:|---|
| 1 | `pnpm --filter @ego/avatar test` | **0** | **312 tests, 312 pass, 0 fail** (303 + 9 nuevos) |
| 2 | `pnpm --filter @ego/avatar typecheck` | **0** | `tsc -p tsconfig.json` (allowJs + checkJs) |
| 3 | `pnpm --filter @ego/avatar build` | **0** | `dist/` al día (50 ficheros) + manifiesto SHA-256 |
| 4 | `pnpm --filter @ego/avatar build:check` | **0** | `dist/` al día |
| 5 | `pnpm --filter @ego/avatar sync:check` | **0** | `SIN DRIFT` (código + legales + manifiesto + corpus) |
| 6 | `pnpm --filter @ego/avatar geometry:check` | **0** | `GEOMETRIA IDENTICA a la golden: 231 combinaciones` |
| 7 | `pnpm --filter @ego/avatar attribution:check` | **0** | `CLASIFICACION CONFORME` (57/31) + `CADENA MIT RESOLUBLE` |
| 8 | `pnpm --filter @ego/avatar upstream:check` | **0** | `SIN DIVERGENCIA NO DECLARADA` (36 declaradas) |
| 9 | `pnpm --filter @ego/avatar no-verbatim:check` | **0** | `SIN RESIDUO VERBATIM fuera de presupuesto` (6/6 en 0,0 %) |
| 10 | `node packages/avatar/scripts/check-bridge.mjs` | **0** | `CONTRATO CUMPLIDO` (round-trip 15/15) |
| 11 | `node scripts/verify-attribution.mjs` (delegador de A7) | **0** | delega en mi puerta ✔ |
| 12 | `pnpm -r typecheck` | 0 → **2 (transitorio)** | verde cuando lo ejecuté; al re-verificar fallaba con **TS6133 en `packages/runtime/src/TrustBoundary.ts`** — fichero que **no he tocado yo** (`packages/runtime` es zona de A2bis/A3, con edicion en curso: `git status` lo lista como modificado) |
| 13 | `pnpm lint` | 0 → **2 (transitorio)** | el **presupuesto de avisos se respeta** (`recuento real 308 · presupuesto 317 · margen 9` → `OK`); el exit 2 viene del typecheck de `packages/runtime` de la fila anterior, no del lint |

> **Nota de concurrencia**: durante los ultimos minutos de esta ola,
> `packages/runtime/src/ToolExecutionLoop.ts` y
> `packages/runtime/src/TrustBoundary.ts` cambiaron bajo mis pies (son de
> A2bis/A3). El typecheck del repo pasó a fallar con dos TS6133 ("declared
> but its value is never read") y el lint arrastra ese mismo fallo. **No es
> deuda de A6**: mi paquete (`packages/avatar`) esta en verde en las trece
> puertas.

## 7. Solicitudes fuera de zona

### 7.1 → A1 (Backlog) — texto exacto para la fila `EGO-FIND-82`

> **Para la fila `EGO-FIND-82` de `docs/roadmap/Backlog.md`.** El literal
> actual dice *"0 de 313 ficheros de `packages/` llevan la cabecera canónica"*:
> eso ya **no es cierto** (hoy son **90**, y 80 de ellos en `packages/avatar/`).
> Propuesta de redacción (A1 decide el estado; A6 no toca `docs/` salvo
> `docs/extractions/coucou.md`):

```text
EGO-FIND-82 | 🔴 Crítica | **Cadena de atribución de licencia del catálogo de
referencia sin desplegar** | `packages/avatar/provenance.manifest.json` ·
`packages/avatar/scripts/check-attribution.mjs` ·
`packages/avatar/scripts/check-no-verbatim.mjs` | 🟡 2-3d | 🔴 P0 | 🟠 Parcial
| **Hecho en `packages/avatar/` (A6, Olas 8 y 9):** el paquete que contiene el
único código realmente derivado del repo queda cerrado con **dos
denominadores explícitos**. (1) `provenance.manifest.json` clasifica los 88
ficheros del paquete (57 derivados + 31 nativos) con su upstream, su licencia,
su ruta de origen y la evidencia; los 57 derivados llevan la cabecera
`Adapted from <upstream> (<LICENCIA>), <ruta>` y los 31 nativos **no** (una
cabecera en un nativo sería una atribución falsa: precedente EGO-FIND-83). (2)
La decisión **D4** del owner (2026-10-21) está **ejecutada**: seis ficheros
que eran ports literales —`render/ara-head.js` (95,1 % de residuo verbatim),
`render/body.js`, `runtime/poses.js`, `core/timeline.js`, `studio/sound.js`
(64,5 %) y `studio/render/accessories.js` (66,4 %)— son hoy **implementación
propia de Ego** (residuo **0,0 %** medido), pasaron a `native` y el recuento de
derivados bajó de 63 a 57. La puerta `check-no-verbatim.mjs` lo impide
revertirlo en silencio: presupuesto 0 por fichero, exit 1 si aparece un solo
shingle de 48 caracteres del upstream. `LICENSE.md` y `NOTICE` se **generan**
desde el manifiesto (no pueden divergir). ·
**Pendiente (A2bis + A7):** extender el mismo contrato (manifiesto + puerta
por paquete) al resto de `packages/**`, y cablear `no-verbatim:check` al job
`verify` de CI. ·
**Corrección de una afirmación previa:** las cabeceras del motor canvas
afirmaban `(MIT)` sobre un fichero de origen que **no declara licencia** (el
`LICENSE.md` del clon dice "según archivo de origen"); ahora dicen literalmente
"licencia no declarada en el origen" y el material MIT embebido queda
acreditado en el corpus `vendor/`.
```

### 7.2 → A5 (fichas) — qué cambia y qué no

**No cambia ninguna ficha de las 25**, salvo `docs/extractions/coucou.md` §52.4
—que **ya está actualizada** (mi zona)— y la tabla de `docs/extractions/README.md`
§4.3, que es de A5.

Datos exactos para esa tabla (medidos con el mismo método que A5: cabecera en
las 15 primeras líneas, sobre 1 165 ficheros `.ts/.tsx/.js/.mjs/.cjs` de
`packages/**`, excluyendo `node_modules`):

| Elemento | Antes (A5, 2026-10-21) | **Ahora** |
|---|---|---|
| Forma 1 — `Adapted from <upstream> (<LIC>), <ruta>` | 14 de 1 144 | **90 de 1 165** |
| — en `packages/avatar/` | 7 (+7 en `dist/`) | **57 en el código (+ 23 en `dist/`) = 80** |
| — en el resto de paquetes | 0 | 10 (`tool-call-repair` 4, `tools` 2, `ui-runtime` 4) — **trabajo de A2bis/otros, no mío** |
| Forma 2 — `ADAPTADO de <ruta> (<LIC>, <copyright>)` | 6 | **2** (las 4 de `packages/avatar/` normalizadas a la forma canónica en la Ola 9) |
| Paquetes con `LICENSE.md` en el paquete | 2 de 19 | 2 de 19 (sin cambio) |

Y un dato nuevo que A5 debe recoger en §4.3: **la Ola 9 añadió una segunda
puerta** (`no-verbatim:check`) que mide el **residuo verbatim** contra los
upstreams verdaderos (el corpus `vendor/` y el single-file HTML), no contra el
clon de referencia. El motivo está en §1 del handoff: el clon es el paquete de
Ego de una iteración anterior y **mezcla código propio con ports**, así que
medir contra él no responde a la pregunta de D4.

### 7.3 → A7 (CI) — dos cosas

1. **Cablear la puerta nueva** al job `verify` (antes del typecheck, fail-fast):

```yaml
- name: no-verbatim (decisión D4)
  run: pnpm --filter @ego/avatar no-verbatim:check
  # exit 0 = ningún fichero con presupuesto conserva código verbatim del upstream.
```

2. **Bajar el presupuesto de avisos**: el recuento real ha **bajado de 317 a
   308** (los `console.log` de mis dos puertas pasaron a `console.info`, que es
   lo que admite la regla `no-console` de oxlint). El ratchet solo puede bajar
   (`scripts/lint-budget.json` es de A7):

```json
{ "maxWarnings": 308, "previousMaxWarnings": 317 }
```

(`pnpm lint` hoy pasa igual: la puerta avisa del margen y no falla. Pero el
margen existe porque D4 **pagó** deuda de lint.)

## 8. Ficheros tocados en esta ola (exclusivamente mi zona)

| Fichero | Cambio |
|---|---|
| `packages/avatar/src/render/ara-head.js` | **sustituido**: silueta propia por regla (residuo 95,1 % → 0 %) |
| `packages/avatar/src/render/body.js` | **sustituido**: pipeline propio (10,2 % → 0 %) |
| `packages/avatar/src/runtime/poses.js` | **sustituido**: tabla derivada de intenciones (38 % → 0 %) |
| `packages/avatar/src/core/timeline.js` | **sustituido**: runner propio (3,4 % → 0 %) |
| `packages/avatar/src/studio/sound.js` | **sustituido**: catálogo de gestos + renderizador genérico (64,5 % → 0 %) |
| `packages/avatar/src/studio/render/accessories.js` | **sustituido**: catálogo + 8 piezas genéricas (66,4 % → 0 %) |
| `packages/avatar/scripts/check-no-verbatim.mjs` | **nuevo**: la puerta de D4 |
| `packages/avatar/tests/no-verbatim.test.js` | **nuevo**: 5 casos con fixtures |
| `packages/avatar/tests/d4-geometry.test.js` | **nuevo**: 4 property tests de la geometría propia |
| `packages/avatar/tests/{states,head,render,still}.test.js` | asertos de valores literales → **propiedades** (el significado se conserva) |
| `packages/avatar/tests/attribution.test.js` | baseline honesto: 57/31 (tras D4) |
| `packages/avatar/provenance.manifest.json` | 6 ficheros de `derived` → `native` + campo `verbatim` (presupuestos 0) |
| `packages/avatar/LICENSE.md` · `NOTICE` | regenerados desde el manifiesto |
| `packages/avatar/upstream-divergence.json` | 6 motivos actualizados (`kind: own`) + hashes re-declarados |
| `packages/avatar/README.md` · `DESIGN.md` | la puerta de D4 y el recuento 57/31 |
| `packages/avatar/tests/golden/geometry.json` | **regenerado** (33/231 combinaciones; solo el módulo `accessory`) |
| `packages/avatar/package.json` | `no-verbatim:check` · `no-verbatim:all` |
| `packages/avatar/scripts/{check-attribution,sync-check}.mjs` | `console.log` → `console.info` (regla `no-console`) |
| `docs/extractions/coucou.md` §52.4 | **actualizada** (mi zona): los seis ficheros, el antes/después y la puerta |

**No tocados**: el resto de `docs/**` (A1/A5), `apps/desktop/src/**` (A4),
`scripts/**` de la raíz (A7), `packages/*` restantes (A2bis), el resto de
`repos-referencia/` (solo lectura).

**Sin commits** · **sin `pnpm install`** · **sin `git checkout/reset/stash/clean`**.

## 9. Deuda abierta

1. **A2bis** — extender el contrato (manifiesto + puerta) a los demás paquetes
   de `packages/**`: `tool-call-repair` tiene `LICENSE.md` sin `NOTICE` y 3
   cabeceras en prosa; `tools` y `ui-runtime` ya tienen cabecera canónica pero
   sin manifiesto ni `LICENSE.md`.
2. **A7** — cablear `no-verbatim:check` al job `verify` y bajar el presupuesto
   de lint a 308 (§7.3).
3. **A5** — refrescar la tabla de `docs/extractions/README.md` §4.3 con los
   números de §7.2 y recoger la segunda puerta.
4. **A1** — el texto de la fila `EGO-FIND-82` (§7.1).
5. **Menor (A6, futuro)** — el golden del studio **no cubre el motor SVG**, que
   es donde más cambió la geometría (silueta, poses, pipeline). La property
   test de §5 cubre lo esencial, pero un golden del motor SVG daría el mismo
   servicio que el del studio.
6. **Menor (A6, futuro)** — los seis ficheros de D4 se re-declararon con
   `kind: own` en `upstream-divergence.json`; si el owner prefiere una clase
   propia en ese manifiesto, es una línea.

## 10. `RESULTADO`

```json
{
  "agente": "A6",
  "status": "COMPLETE",
  "archivos_modificados": [
    "packages/avatar/src/render/ara-head.js",
    "packages/avatar/src/render/body.js",
    "packages/avatar/src/runtime/poses.js",
    "packages/avatar/src/core/timeline.js",
    "packages/avatar/src/studio/sound.js",
    "packages/avatar/src/studio/render/accessories.js",
    "packages/avatar/scripts/check-no-verbatim.mjs",
    "packages/avatar/scripts/check-attribution.mjs",
    "packages/avatar/scripts/sync-check.mjs",
    "packages/avatar/tests/no-verbatim.test.js",
    "packages/avatar/tests/d4-geometry.test.js",
    "packages/avatar/tests/attribution.test.js",
    "packages/avatar/tests/states.test.js",
    "packages/avatar/tests/head.test.js",
    "packages/avatar/tests/render.test.js",
    "packages/avatar/tests/still.test.js",
    "packages/avatar/provenance.manifest.json",
    "packages/avatar/upstream-divergence.json",
    "packages/avatar/LICENSE.md",
    "packages/avatar/NOTICE",
    "packages/avatar/README.md",
    "packages/avatar/DESIGN.md",
    "packages/avatar/package.json",
    "packages/avatar/tests/golden/geometry.json",
    "docs/extractions/coucou.md",
    "apps/desktop/renderer/floating/vendor/avatar/** (re-sincronizado)"
  ],
  "hallazgos_resueltos": [
    "T4-pre: detector de residuo verbatim con test (5 casos, rojo 4/5 -> verde 5/5) y puerta con presupuesto 0 por fichero.",
    "T1: los seis ficheros con residuo verbatim Sustituidos por geometria propia; los seis a 0,0 % de residuo contra los upstreams verdaderos (95,1 / 10,2 / 38 / 3,4 / 64,5 / 66,4 % antes).",
    "T1: silueta propia por regla (cúpula exponente 3,4 con corona plana y menton estrecho, normalizada a la caja 20-220): Hausdorff 10,97 px y area 4,43 % distintas del upstream.",
    "T1: tabla de poses derivada de INTENCIONES (no una copia renombrada).",
    "T1: runner de timeline y fases acumuladas reescritos con las mismas firmas publicas.",
    "T1: catalogo de gestos sonoros (raiz tonal + patron en semitonos + envolvente) con renderizador generico; los 25 nombres del contrato se conservan.",
    "T1: accesorios reorganizados en catalogo (dato) + 8 piezas genericas sobre una capa de primitivas; se acaba la cabecera que mentia (366/366 identico al clon).",
    "T2: los seis pasan de derived a native; sus cabeceras cambian al texto veraz del plano 2 (implementacion propia; patron asimilado, sin traduccion de codigo). Derivados 63 -> 57.",
    "T2: LICENSE.md y NOTICE regenerados desde el manifiesto (no pueden divergir).",
    "T3: golden regenerado y su diff documentado (33/231 combinaciones, todas en el modulo accessory; los otros 6 modulos identicos).",
    "T3: property test que fija la geometria propia (Hausdorff, area, caja, tabla de poses) y se ha comprobado que MUERDE (restaurar la silueta lo rompe con 0,00 px).",
    "T3: los tests que afirmaban literales del upstream reescritos como PROPIEDADES (el significado se conserva); baseline de la atribucion actualizado honestamente a 57/31.",
    "Metodo: corregido el defecto del detector de la Ola 8 - medir contra el clon (que mezcla codigo propio con ports) no responde a la pregunta de D4; la puerta mide contra los upstreams verdaderos (corpus vendor + single-file HTML)."
  ],
  "verify": {
    "test": "312/312 pass - exit 0",
    "typecheck": "exit 0",
    "build": "exit 0 (50 ficheros + manifiesto SHA-256)",
    "build:check": "exit 0",
    "sync:check": "SIN DRIFT - exit 0",
    "geometry:check": "231/231 (golden regenerado, diff documentado) - exit 0",
    "attribution:check": "CLASIFICACION CONFORME (57/31) + CADENA MIT RESOLUBLE - exit 0",
    "upstream:check": "SIN DIVERGENCIA NO DECLARADA - exit 0",
    "no-verbatim:check": "SIN RESIDUO VERBATIM (6/6 en 0,0 %) - exit 0",
    "bridge:check": "CONTRATO CUMPLIDO (15/15) - exit 0",
    "verify-attribution.mjs (delegador de A7)": "exit 0",
    "pnpm -r typecheck": "exit 0 al ejecutarlo; al re-verificar, exit 2 por dos TS6133 en packages/runtime (zona de A2bis/A3, edicion en curso) - no es deuda de A6",
    "pnpm lint": "presupuesto de avisos OK (308 real / 317, margen 9); el exit 2 lo arrastra el typecheck de packages/runtime"
  },
  "solicitudes_handoff": [
    "A1 - texto exacto para la fila EGO-FIND-82 del Backlog (el literal '0 de 313 ficheros' ya no es cierto: hoy son 90; 57 de ellos en packages/avatar). Ver seccion 7.1 del handoff.",
    "A5 - refrescar la tabla de docs/extractions/README.md 4.3 con los numeros medidos (Forma 1: 90 de 1165; 80 en packages/avatar; Forma 2: 2) y recoger la segunda puerta (no-verbatim:check) y por que no se mide contra el clon de referencia. coucou.md 52.4 ya esta actualizada por A6. Ver seccion 7.2.",
    "A7 - cablear 'pnpm --filter @ego/avatar no-verbatim:check' al job verify (fail-fast) y bajar el presupuesto de lint de 317 a 308 (D4 pago deuda de lint: los console.log de las dos puertas pasaron a console.info). Ver seccion 7.3.",
    "A2bis - extender manifiesto + puerta al resto de packages/**: tool-call-repair sigue con LICENSE.md sin NOTICE y 3 cabeceras en prosa; tools y ui-runtime tienen cabecera canonica pero sin manifiesto ni LICENSE.md."
  ],
  "deuda_abierta": [
    "A2bis: extender el contrato de procedencia al resto de packages/**",
    "A7: cablear no-verbatim:check a CI y bajar el presupuesto de lint a 308",
    "A5: refrescar la tabla de la seccion 4.3 de docs/extractions/README.md",
    "A1: cerrar la fila EGO-FIND-82 con el texto propuesto",
    "A6 (menor): el golden del studio no cubre el motor SVG, que es donde mas cambio la geometria",
    "A6 (menor): la clase 'own' del manifiesto de divergencias es una propuesta; el owner puede querer otra"
  ],
  "SKILLS_CARGADAS": []
}
```
