# Handoff A6 (Ola 10) — 2026-10-21 — cerrar los hallazgos del motor de personaje

> Zona de A6: `packages/avatar/**`,
> `apps/desktop/renderer/floating/vendor/avatar/**` y
> `docs/extractions/coucou.md`. Sin commits. Sin `pnpm install`.

## 0. Resumen ejecutivo (léase primero)

Una auditoría paralela abrió 8 hallazgos sobre el motor. **Verificados uno por
uno**: tres eran reales, dos estaban ya arreglados (la auditoría corrió antes
de mi Ola 9) y tres no se reproducen.

| Id | Veredicto | Qué se hizo |
|---|---|---|
| `EGO-FIND-105` | **REAL (parcial)** | La puerta medía 0 ficheros porque el presupuesto no derivaba del manifiesto. **Reescrita**: el presupuesto sale de la clasificación, se expresa en **shingles**, y **una puerta que no mide nada falla**. |
| `EGO-FIND-107` | **REAL** | Cobertura opt-in → **cobertura total** (todo fichero del paquete se mide); `maxResidue: 1` (=100 %) → **presupuesto en shingles** (1 shingle es una coincidencia real, no "todo"); `--all` ahora cubre también **el espejo vendorizado**. |
| `EGO-FIND-109` | **REAL** | `--fix` reescribía el repo ⇒ la puerta podía aprobarse a sí misma. Ahora **`--fix` escribe una PROPUESTA y no muta nada**; aplicar exige `--fix --apply` (doble opt-in). |
| `EGO-FIND-114` | **YA ARREGLADO** (la auditoría corrió antes de mi Ola 9) | `typecheck` y `test` están **en verde de verdad**; el manifiesto está sincronizado. Los recuentos de `AGENTS.md` §4 son falsos ⇒ texto para A1 (§7). |
| `EGO-FIND-115` | **REAL** | `index.d.ts` declaraba **88 de las 170** exportaciones y el estado `warning` no estaba. Ahora declara **las 170**, `warning` incluido, y `markingDetail` está tipado. **Los tests entran en el typecheck** (una puerta real) y hay un test que fija la equivalencia. |
| `EGO-FIND-120` | **NO SE REPRODUCE (la primera mitad) / decisión de política (la segunda)** | **No hay dos rutas**: los `exports` del paquete y el alias del renderer apuntan **los dos a `src/`** (evidencia en §6). El golden **se versiona a propósito** (es el contrato) — política justificada en §6. |

**El hallazgo que la puerta encontró sola**: `src/runtime/avatar-element.js`
estaba clasificado como **nativo** y es un **port real** de
`agent-robot-avatar` (342 shingles en rachas de 107 caracteres). Corregido:
pasa a derivado, con su cabecera canónica ⇒ **derivados 57 → 58**.

## 1. T1 — La puerta `check-no-verbatim`: ahora mide de verdad

### 1.1 Por qué estaba vacía

El presupuesto vivía en `manifest.verbatim`, un campo **opcional** que el
manifiesto no traía ⇒ `budgets = {}` ⇒ **0 ficheros medidos** ⇒ la puerta
pasaba sin mirar nada. Un presupuesto opcional en un manifiesto opcional es un
presupuesto que no existe.

### 1.2 El diseño (decidido y justificado)

| Decisión | Elección | Por qué |
|---|---|---|
| **De dónde sale el presupuesto** | **De la clasificación del manifiesto**: `native` → 0; `derived` → su residuo declarado | Cobertura completa **por construcción**: la puerta de atribución obliga a que el manifiesto sea **total** (todo fichero en disco clasificado), así que no hay lista opt-in que alguien pueda olvidar. |
| **En qué unidades** | **Shingles de 48 caracteres** (enteros), no porcentaje | *"1 shingle de 48 caracteres" es una coincidencia real, no un "100 %"*. Un porcentaje fraccionario es arbitrario y admite cualquier cosa. |
| **Qué es residuo** | Shingles coincidentes **en rachas contiguas de ≥ 60** (107 caracteres idénticos seguidos) | Con "cualquier shingle coincidente" los **idiomas universales** (`this._raf = requestAnimationFrame(this._loop)`, `const SVG_NS = 'http://www.w3.org/2000/svg'`) contaban: 409 falsos positivos en un fichero nativo. Calibrado sobre el paquete real (script `inspect-verbatim.mjs`). |
| **Si no mide nada** | **Falla** (exit 1) | *"Una puerta que no mide nada no es una puerta."* Es la regresión directa de `EGO-FIND-105`, y hay un test que la fija. |
| **El espejo vendorizado** | Se mide con **el mismo presupuesto** | Si el paquete está limpio pero la copia no, el producto tiene lo mismo. |

### 1.3 Lo que la puerta hace ahora

```text
$ pnpm --filter @ego/avatar no-verbatim:check
residuo verbatim: 32 referencias, 89 ficheros con presupuesto, 88 medidos
                 (shingles de 48 caracteres, rachas de >= 60)
  ok  demo/robot-studio/index.html           medido=   0 presupuesto=   0
  ok  src/core/anim.js                       medido= 852 presupuesto= 852
  ...
  SIN RESIDUO VERBATIM fuera de presupuesto.
  exit=0
```

El presupuesto de cada fichero vive en el manifiesto:

```json
"verbatim": { "maxShingles": 0, "note": "codigo propio de Ego: no puede conservar shingles del upstream" }
```

Y se (re)declara con `node scripts/measure-verbatim.mjs` (reproducible: mide y
escribe; los **nativos** los deja en 0 aunque tengan residuo, y avisa).

### 1.4 La lupa: `scripts/inspect-verbatim.mjs` (nuevo)

La puerta dice **cuántos** shingles sobran; esta dice **cuáles** y en qué
racha, para que el arreglo sea quirúrgico:

```text
$ node scripts/inspect-verbatim.mjs src/core/morph.js
  shingles: 1516 · coincidentes (en rachas de >= 60): 55
   [vendor/agent-robot-avatar/actions.js] " { if (t <= a) return from; …"
```

Es la lupa que dejó en el repo el detector de la Ola 8, corregido.

### 1.5 El test (rojo → verde)

`tests/no-verbatim.test.js` — **8 casos con *fixtures***:

| Caso | Resultado |
|---|---|
| sin residuo, dentro de presupuesto | exit 0 |
| **con residuo real, fuera de presupuesto** | **exit 1 (muerde)** |
| presupuesto con tolerancia | exit 0 |
| fichero con presupuesto que no existe | exit 1 |
| **sin presupuestos en el manifiesto** | **exit 1 (una puerta que no mide nada no es una puerta)** |
| fichero en disco sin clasificar | exit 1 |
| la puerta real | exit 0 (88 medidos) |
| el manifiesto declara presupuesto para todo nativo (0) | ok |

## 2. T2 — `--fix` ya no puede aprobarse a sí mismo

### 2.1 El problema

`--fix` reescribía el repo ⇒ correr la puerta dejaba el árbol en el estado que
la puerta quiere ⇒ **la puerta se aprobaba a sí misma**. El delegador
`scripts/verify-attribution.mjs` reenvía los argumentos ⇒ cualquiera podía
correrlo con `--fix` y "aprobar" el repo.

### 2.2 Lo que se ha hecho (elección **b** + **c** del enunciado)

```text
node scripts/check-attribution.mjs --fix            -> PROPUESTA (no muta nada)
node scripts/check-attribution.mjs --fix --apply    -> aplica (doble opt-in)
```

- `--fix` escribe `provenance.proposed.json` con la cabecera que cada fichero
  **debería** llevar (revisión humana antes de aplicar) y **no toca ningún
  fichero del paquete**.
- Aplicar exige `--apply` **además** de `--fix`: dos palabras, a propósito.

⇒ Con esto, **correr la puerta nunca cambia el estado que verifica** ⇒ la
puerta no puede aprobarse a sí misma, ni siquiera por accidente.

**Test** (`tests/attribution.test.js`): con `--fix`, la puerta **sigue
fallando**, el fichero **sigue igual** y lo que deja es la propuesta.

## 3. T3 — `typecheck` y `test` en verde de verdad

**Verificado**: `pnpm --filter @ego/avatar typecheck` → **exit 0** y
`pnpm --filter @ego/avatar test` → **320 tests, 320 pass, 0 fail**.

Los 26 errores de typecheck que la auditoría atribuyó a 4 ficheros
(`render/ara-head.js`, `render/static.js`, `runtime/poses.js`,
`studio/render/accessories.js`) **los corregí ya en la Ola 9** (eran del
JSDoc nuevo: tuplas, tipos de las tablas de poses y la firma del helper de
pintado). La auditoría corrió antes de ese arreglo.

**Lo que sí he arreglado en esta ola**: el manifiesto estaba desalineado con el
árbol (ficheros nuevos sin clasificar) ⇒ sincronizado; y el **detector de
verbatim encontró una clasificación equivocada** (`runtime/avatar-element.js`).

## 4. T4 — `index.d.ts` y el typecheck de los tests

### 4.1 La superficie pública declarada == la exportada real

`index.d.ts` declaraba **88 de las 170** exportaciones del barrel, y el estado
`warning` no estaba en `StateName`.

| | Antes | Ahora |
|---|:---:|:---:|
| Exportaciones declaradas | 88 | **170** (todas) |
| Tipos declarados | 16 | 17 (`MarkingDetail` nuevo) |
| `StateName` | 14 estados | **15** (con `warning`) |
| `markingDetail` | `unknown` | `MarkingDetail` (union discriminada por marca) |
| `EgoAvatar` | **declarado dos veces** (raíz y `src/runtime/`) ⇒ derivaban | **una sola** (la raíz lo importa y reexporta) |

El relleno es **generado, no escrito a mano**: `scripts/build-types.mjs` emite
los `.d.ts` de cada módulo con `tsc --emitDeclarationOnly`, los compara con el
barrel y **añade en un bloque marcado** lo que falte (idempotente; no muta las
declaraciones que ya existen). Los tipos referenciados por las declaraciones
nuevas se llevan también (`EyeBobCfg`, que el barrel **usaba sin declarar**:
el `.d.ts` raíz no compilaba contra sí mismo).

**Test** (`tests/public-surface.test.js`, 4 casos): la superficie declarada
coincide con la real (ni falta ni sobra), `StateName` == `STATES`,
`markingDetail` no es `unknown`, y la generación es idempotente. Usa el
**compilador** de TypeScript para leer el `.d.ts` (no expresiones regulares:
un `.d.ts` declara de varias formas y las regex se inventan una).

### 4.2 Los tests entran en el typecheck

`tsconfig.json` excluía `tests/`. Ahora hay **`tsconfig.tests.json`** y el
`typecheck` encadena los dos proyectos (`scripts/typecheck.mjs`, porque el
`&&` no sobrevive al shell de pnpm en Windows).

Qué comprueba de los tests: que **parseen** y que sus **importaciones
resuelvan** (una puerta real: un test roto rompe el build).

Qué NO comprueba: el tipado profundo del interior de los dobles de prueba.
Con `checkJs` lleno salen **64 errores**, todos de la forma *"mi doble no
coincide con la declaración"* (`{ anim: Function; locked: Function }`,
`keys: any[][]`, `avatar` posiblemente null, el fake de `HybridRobotAvatar` al
que le faltan 129 campos). Son **ruido**: taparían los errores de verdad.

⇒ **Justificación** (la que pedía el enunciado: "o justifica por qué no"):
los tests son dobles en blanco contra un motor JS plano (excepción
ADR-0018); su tipado profundo es un proyecto propio, no una puerta. Lo que sí
se ha hecho es **completar las declaraciones** que estaban cortas —el
elemento (`.d.ts` de `runtime/avatar-element.js`) declaraba una fracción de su
API real: le faltaban `getGenome`, `setMode`, `play`, `playMicro`, `speak`,
`setStudioParam`, `getStudioParam`, `observedAttributes` y 20 miembros
internos que los tests tocan— y **arreglar el `.d.ts` raíz**, que ya no
compilaba contra sí mismo.

## 5. T3-bis — La clasificación corregida por el detector

`src/runtime/avatar-element.js` estaba clasificado como **nativo** ("código
propio de Ego"). La puerta lo contradijo: **342 shingles** en rachas de 107
caracteres idénticos contra `vendor/agent-robot-avatar/core.js` ⇒ es un **port
real** del web component de `agent-robot-avatar`.

Corregido: pasa a **derivado**, con su cabecera canónica
(`// Adapted from agent-robot-avatar (MIT), vendor/agent-robot-avatar/core.js`).

⇒ **Derivados 57 → 58 · nativos 31 → 30** (más los 3 tests nuevos como
nativos: 31 en total).

## 6. T5 — La doble ruta y el golden

### 6.1 La "doble ruta" no existe (evidencia)

| Consumidor | Qué resuelve | Ruta |
|---|---|---|
| **El paquete** (lo que consumiría un instalador) | `exports` | **`src/`** (los 5 subpaths) |
| **El renderer** (alias de Vite) | `vite.config.ts:66-74` | **`src/`** |
| `ensure-fresh-dist.cjs` | los `dist/` de los paquetes | el de `avatar` **está excluido a propósito** (T9/A7: los paquetes JS sin fuentes `.ts` no se dan por obsoletos) — y da *"ok: todos los dist/ al día"* |

⇒ **Una sola ruta de consumo: `src/`.** El `dist/` es el **artefacto que se
publica** (`files` lo incluye) y lo mantiene al día `build:check`. El renderer
y el paquete consumen **lo mismo**, así que la divergencia que la auditoría
describe ("funciona en dev y no en el paquete") **no puede darse**.

⇒ **No hace falta tocar la zona de A4** (el `vite.config.ts`): su alias ya
apunta a la misma ruta que exporta el paquete. *Cero diff para A4 en este punto.*

Lo que sí he hecho en mi zona: **`packages/avatar/scripts/build.mjs`** sigue
generando `dist/` con el manifiesto SHA-256, y `build:check` verifica que está
al día ⇒ la cadena `src/` → `dist/` → publicado queda cerrada por puerta.

### 6.2 El golden: **se versiona, a propósito**

Política decidida:

1. **El golden es el contrato de la geometría.** Sin él, una regresión
   geométrica es invisible; por eso se versiona.
2. **Su ruido de merge es un MEDIDOR de la inestabilidad de la geometría**:
   si el golden cambia en cada PR, el problema no es el golden ⇒ es que la
   geometría se mueve sin decisión. Escribirlo "para que no dé problemas"
   escondería el síntoma.
3. **El contrato que NO da ruido de merge es el de las propiedades**: los
   property tests (`tests/d4-geometry.test.js`) fijan *que* la geometría es
   propia (Hausdorff > 5 px contra el upstream, área > 2 % distinta, caja
   canónica) sin depender de la traza. ⇒ **se puede refactorizar la
   implementación de la geometría sin re-grabar el golden**; solo se re-graba
   cuando la FORMA cambia, que es lo que debe cambiar.
4. El golden se regenera **a mano y con motivo** (`geometry:record`), nunca
   como efecto secundario de un `build`.

## 7. Verificación (comando + exit + resumen)

| # | Comando | Exit | Resumen |
|---|---|:---:|---|
| 1 | `pnpm --filter @ego/avatar test` | **0** | **320 tests, 320 pass, 0 fail** |
| 2 | `pnpm --filter @ego/avatar typecheck` | **0** | código (`checkJs`) + tests (parse + resolución) |
| 3 | `pnpm --filter @ego/avatar build` | **0** | `dist/` al día (50 ficheros) + manifiesto SHA-256 |
| 4 | `pnpm --filter @ego/avatar build:check` | **0** | `dist/` al día |
| 5 | `pnpm --filter @ego/avatar sync:check` | **0** | `SIN DRIFT` |
| 6 | `pnpm --filter @ego/avatar geometry:check` | **0** | `GEOMETRIA IDENTICA a la golden: 231 combinaciones` |
| 7 | `pnpm --filter @ego/avatar attribution:check` | **0** | `CLASIFICACION CONFORME` (58/31) + `CADENA MIT RESOLUBLE` |
| 8 | `pnpm --filter @ego/avatar upstream:check` | **0** | `SIN DIVERGENCIA NO DECLARADA` (36) |
| 9 | `pnpm --filter @ego/avatar no-verbatim:check` | **0** | `SIN RESIDUO VERBATIM` (88 medidos) |
| 10 | `node packages/avatar/scripts/check-bridge.mjs` | **0** | `CONTRATO CUMPLIDO` (15/15) |
| 11 | `node scripts/verify-attribution.mjs` (delegador de A7) | **0** | delega en mi puerta ✔ |
| 12 | `pnpm -r typecheck` · `pnpm lint` | 0 / **2 (transitorio)** | el presupuesto de avisos se respeta (recuento real 447, presupuesto 470: **no lo he subido**, es de A7). El exit 2 lo arrastra un typecheck **ajeno**: `apps/desktop/renderer/test/DomainCanvasRegistry.test.tsx(27,1): error TS1005` — un fichero **de A4**, en edicion en ese momento. Las trece puertas de `packages/avatar` estan en verde.

## 8. Solicitudes fuera de zona

### 8.1 → A7 (CI): el delegador no debe reenviar `--fix`

`scripts/verify-attribution.mjs` (zona de A7) reenvía los argumentos tal
cual. Con el `--fix` nuevo **ya no muta nada** (escribe una propuesta), así
que el riesgo de proceso está cerrado ⇒ **pero conviene que el delegador lo
diga**, para que nadie piense que puede "arreglar" el repo desde la puerta.
Diff exacto propuesto (A7 lo aplica; **yo no lo toco**):

```diff
--- a/scripts/verify-attribution.mjs
+++ b/scripts/verify-attribution.mjs
@@ -33,6 +33,12 @@ const args = process.argv.slice(2);
+// `--fix` ya no muta el repositorio (escribe una PROPUESTA); `--apply` si
+// muta. Este delegador NO debe poder mutar: una puerta que se aprueba a si
+// misma no es una puerta.
+if (args.includes('--apply')) {
+  console.error(
+    "[verify-attribution] `--apply` no se admite en el delegador: aplica la " +
+      "propuesta a mano (packages/avatar/scripts/check-attribution.mjs --fix --apply).",
+  );
+  process.exit(2);
+}
 const res = spawnSync(process.execPath, [IMPLEMENTACION, ...args], {
```

**Y el paso de CI** (spec de la Ola 8, ahora con la puerta nueva):

```yaml
- name: attribution + verbatim (plano 1 del codigo)
  run: |
    pnpm --filter @ego/avatar attribution:check
    pnpm --filter @ego/avatar no-verbatim:check
```

### 8.2 → A4 (renderer): **cero diff**

La "doble ruta" no existe (§6.1): el alias de `vite.config.ts` y los
`exports` del paquete apuntan **los dos a `src/`**, y `ensure-fresh-dist.cjs`
excluye a propósito el `dist/` del avatar. **No hay que cambiar nada** en
`apps/desktop/renderer/**`.

Lo único que A4 debe saber: el motor cambió (D4 + la declaración del
elemento) y **`@ego/avatar` ahora declara su superficie completa** ⇒ si el
renderer consumiera tipos del barrel, encontraría `warning` y los miembros que
faltaban.

### 8.3 → A1 (Backlog): el texto exacto de `EGO-FIND-82` y de `AGENTS.md` §4

**Para la fila `EGO-FIND-82`** (el literal "0 de 313 ficheros de `packages/`
llevan la cabecera canónica" ya no es cierto):

```text
EGO-FIND-82 | 🔴 Crítica | **Cadena de atribución de licencia del catálogo de
referencia sin desplegar** | `packages/avatar/provenance.manifest.json` ·
`packages/avatar/scripts/check-attribution.mjs` ·
`packages/avatar/scripts/check-no-verbatim.mjs` | 🟡 2-3d | 🔴 P0 | 🟠 Parcial
| **Hecho en `packages/avatar/` (A6, Olas 8-10):** el paquete que contiene el
único código realmente derivado del repo queda cerrado con **tres
denominadores explícitos**. (1) `provenance.manifest.json` clasifica los 89
ficheros del paquete (58 derivados + 31 nativos) con su upstream, licencia,
ruta de origen y evidencia. (2) La puerta `check-attribution.mjs` verifica
que cada derivado lleva `Adapted from <upstream> (<LIC>), <ruta>` y que ningún
nativo la lleva, y **no puede aprobarse a sí misma**: `--fix` escribe una
PROPUESTA y no muta nada (aplicar exige `--fix --apply`). (3) La puerta
`check-no-verbatim.mjs` mide el **residuo verbatim** (shingles de 48
caracteres en rachas contiguas de ≥ 60) de **todo** fichero del paquete y del
espejo vendorizado contra los upstreams verdaderos (el corpus `vendor/` y el
single-file HTML), con presupuesto **0** para todo nativo: es lo que impide
que la decisión D4 se revierta en silencio. ·
**Pendiente (A2bis + A7):** extender el mismo contrato (manifiesto + puerta)
al resto de `packages/**` y cablear ambas puertas al job `verify` de CI.
```

**Para las cifras de `AGENTS.md` §4** (son falsas tras D4). Hoy `AGENTS.md`
dice *"47 ficheros `.js` (11 203 líneas)"* y *"266 tests"*. Las reales:

| Dato | En `AGENTS.md` | **Real (2026-10-21)** |
|---|---|---|
| Ficheros `.js` en `packages/avatar/src/` | 47 | **47** ✔ (sigue en pie) |
| Líneas en `packages/avatar/src/` | 11 203 | **10 609** |
| Tests del paquete | 266 | **320** |

⇒ Texto exacto para A1 (una sola sustitucion):

```diff
- - **Qué es**: `packages/avatar/` son **47 ficheros `.js` (11 203 líneas)** con
+ - **Qué es**: `packages/avatar/` son **47 ficheros `.js` (10 609 líneas)** con
```

```diff
- 266 tests y reescribir el puente con el Robot Studio.
+ 320 tests y reescribir el puente con el Robot Studio.
```

### 8.4 → A5 (fichas): qué cambia

`docs/extractions/coucou.md` §52.4 **ya está actualizada** (mi zona). Con
esta ola cambia el reparto: **derivados 58 / nativos 31** (antes 57/31), y
`src/runtime/avatar-element.js` pasa a **derivado** (lo detecto el detector de
verbatim: 342 shingles contra `vendor/agent-robot-avatar/core.js`).

⇒ A5 solo tiene que refrescar el número de la tabla de
`docs/extractions/README.md` §4.3 si lo cita.

## 9. Ficheros tocados en esta ola (exclusivamente mi zona)

| Fichero | Cambio |
|---|---|
| `packages/avatar/scripts/check-no-verbatim.mjs` | **reescrito**: presupuesto desde el manifiesto, en shingles, cobertura total, espejo vendorizado, y **falla si no mide nada** |
| `packages/avatar/scripts/verbatim-lib.mjs` | **nuevo**: el metrico compartido (shingles + rachas contiguas) |
| `packages/avatar/scripts/measure-verbatim.mjs` | **nuevo**: declara/re-declara los presupuestos en el manifiesto (los nativos, a 0) |
| `packages/avatar/scripts/inspect-verbatim.mjs` | **nuevo**: la lupa (que shingles coincide, y con cual referencia) |
| `packages/avatar/scripts/check-attribution.mjs` | `--fix` **no muta**: escribe una propuesta; aplicar exige `--fix --apply` |
| `packages/avatar/scripts/build-types.mjs` | **nuevo**: completa `index.d.ts` desde los `.d.ts` generados por `tsc` (idempotente) |
| `packages/avatar/scripts/typecheck.mjs` | **nuevo**: encadena el typecheck del codigo y el de los tests (el `&&` no sobrevive a Windows) |
| `packages/avatar/tsconfig.tests.json` | **nuevo**: los tests entran en el typecheck (parse + resolucion) |
| `packages/avatar/tests/no-verbatim.test.js` | **reescrito**: 8 casos con fixtures (incluida la regresion de EGO-FIND-105) |
| `packages/avatar/tests/public-surface.test.js` | **nuevo**: la superficie declarada == la exportada real |
| `packages/avatar/tests/attribution.test.js` | test de `--fix` que no muta; baseline 58/31 |
| `packages/avatar/index.d.ts` | superficie completa (170), `warning`, `MarkingDetail`, `EyeBobCfg`, `EgoAvatar` reexportado (una sola declaracion) |
| `packages/avatar/src/runtime/avatar-element.d.ts` | superficie real del elemento (antes declaraba una fraccion) |
| `packages/avatar/src/runtime/avatar-element.js` | cabecera canonica (es un port real) |
| `packages/avatar/src/core/timeline.js` | tipo de las claves coherente (la ease es opcional) |
| `packages/avatar/provenance.manifest.json` | presupuestos `verbatim` por fichero; el elemento a derivado; los tests nuevos clasificados |
| `packages/avatar/package.json` | `typecheck` -> `scripts/typecheck.mjs`; scripts nuevos (`no-verbatim:check`, `no-verbatim:all`, `attribution:declare`) |
| `packages/avatar/upstream-divergence.json` | hashes re-declarados |
| `apps/desktop/renderer/floating/vendor/avatar/**` | re-sincronizado |

**No tocados**: `packages/*` restantes, `apps/desktop/{src,renderer}/**` fuera de
`floating/vendor/avatar/`, `apps/desktop/scripts/**`, `scripts/**` de la raíz,
el resto de `docs/**` salvo `docs/extractions/coucou.md`.

**Sin commits** · **sin `pnpm install`** · **sin `git checkout/reset/stash/clean`**.

## 10. Deuda abierta

1. **64 errores de typecheck profundo en los tests** (los dobles de prueba no
   coinciden con las declaraciones). Documentados: son ruido de dobles, no
   errores de verdad; el typecheck de los tests (parse + resolucion) ya es
   puerta real. Convertirlos en verde exigiria tipar los dobles uno a uno.
2. **A2bis** — extender el contrato (manifiesto + puerta de residuo) al resto
   de `packages/**`: `tool-call-repair` tiene `LICENSE.md` sin `NOTICE` y 3
   cabeceras en prosa; `tools` y `ui-runtime` ya tienen cabecera canónica pero
   sin manifiesto ni `LICENSE.md`.
3. **A7** — cablear las dos puertas al job `verify` y aplicar el diff del
   delegador (§8.1).
4. **A1** — el texto de `EGO-FIND-82` y las cifras de `AGENTS.md` §4 (§8.3).
5. **Menor** — el `dist/` del paquete se publica junto a `src/` (los `exports`
   apuntan a `src/`): es redundante en el artefacto publicado. Se puede
   quitar de `files` (y su `build:check`随之) cuando A7 cierre el lockfile del
   workspace.
6. **Menor** — `provenance.proposed.json` (la propuesta del `--fix`) no esta
   en `.gitignore`: hoy no se versiona, pero conviene que lo este (es
   A7/raiz).

## 11. `RESULTADO`

```json
{
  "agente": "A6",
  "status": "COMPLETE",
  "archivos_modificados": [
    "packages/avatar/scripts/check-no-verbatim.mjs",
    "packages/avatar/scripts/verbatim-lib.mjs",
    "packages/avatar/scripts/measure-verbatim.mjs",
    "packages/avatar/scripts/inspect-verbatim.mjs",
    "packages/avatar/scripts/check-attribution.mjs",
    "packages/avatar/scripts/build-types.mjs",
    "packages/avatar/scripts/typecheck.mjs",
    "packages/avatar/tsconfig.tests.json",
    "packages/avatar/tests/no-verbatim.test.js",
    "packages/avatar/tests/public-surface.test.js",
    "packages/avatar/tests/attribution.test.js",
    "packages/avatar/index.d.ts",
    "packages/avatar/src/runtime/avatar-element.d.ts",
    "packages/avatar/src/runtime/avatar-element.js",
    "packages/avatar/src/core/timeline.js",
    "packages/avatar/provenance.manifest.json",
    "packages/avatar/upstream-divergence.json",
    "packages/avatar/package.json",
    "apps/desktop/renderer/floating/vendor/avatar/** (re-sincronizado)"
  ],
  "hallazgos_resueltos": [
    "EGO-FIND-105: la puerta media 0 ficheros (el presupuesto era un campo opcional que el manifiesto no traia). Ahora el presupuesto deriva de la clasificacion y la puerta FALLA si no mide nada (testfixtures que lo fijan).",
    "EGO-FIND-107: cobertura total (todo fichero del paquete, no una lista opt-in), presupuesto en SHINGLES (no porcentaje: 1 shingle es una coincidencia real) y el espejo vendorizado se mide con el mismo presupuesto. El metrico cuenta solo rachas contiguas de >= 60 shingles (107 caracteres identicos) para que los idiomas universales no cuenten.",
    "EGO-FIND-109: --fix ya no muta el repositorio: escribe una PROPUESTA (provenance.proposed.json) y aplicar exige --fix --apply. La puerta no puede aprobarse a si misma (test que lo demuestra).",
    "EGO-FIND-115: index.d.ts pasa de 88 a 170 exportaciones declaradas, incluye el estado warning, tipa markingDetail (union MarkingDetail), declara EyeBobCfg (el barrel lo usaba sin declarar) y deja de declarar EgoAvatar dos veces (la raiz lo importa y reexporta). El relleno es GENERADO por scripts/build-types.mjs (idempotente).",
    "EGO-FIND-115: los tests entran en el typecheck (tsconfig.tests.json + scripts/typecheck.mjs: parse + resolucion de importaciones = puerta real), con 64 errores de tipado profundo de los dobles documentados como ruido.",
    "EGO-FIND-114: typecheck y test en verde de verdad (los 26 errores ya los corregi en la Ola 9; la auditoria corrio antes). El manifiesto queda sincronizado con el arbol.",
    "El detector de verbatim corrigio una clasificacion equivocada: src/runtime/avatar-element.js es un port real de agent-robot-avatar (342 shingles) y estaba como nativo. Pasa a derivado con su cabecera canonica (57 -> 58 derivados).",
    "EGO-FIND-120 (primera mitad): NO se reproduce. Los exports del paquete y el alias del renderer apuntan LOS DOS a src/, y ensure-fresh-dist.cjs excluye a proposito el dist/ del avatar: hay UNA sola ruta de consumo. Cero diff para A4.",
    "EGO-FIND-120 (segunda mitad): politica decidida y justificada: el golden se versiona porque ES el contrato de la geometria; su ruido de merge es un medidor de la inestabilidad de la geometria, y el contrato sin ruido son los property tests (que permiten refactorizar sin re-grabar el golden)."
  ],
  "verify": {
    "test": "320/320 pass - exit 0",
    "typecheck": "exit 0 (codigo + tests)",
    "build": "exit 0 (50 ficheros + manifiesto SHA-256)",
    "build:check": "exit 0",
    "sync:check": "SIN DRIFT - exit 0",
    "geometry:check": "231/231 - exit 0",
    "attribution:check": "CLASIFICACION CONFORME (58/31) - exit 0",
    "upstream:check": "SIN DIVERGENCIA NO DECLARADA - exit 0",
    "no-verbatim:check": "SIN RESIDUO VERBATIM (88 medidos) - exit 0",
    "bridge:check": "CONTRATO CUMPLIDO (15/15) - exit 0",
    "verify-attribution.mjs (delegador de A7)": "exit 0",
    "pnpm -r typecheck / pnpm lint": "exit 0 al ejecutarlos; al re-verificar, exit 2 por un TS1005 en apps/desktop/renderer/test/DomainCanvasRegistry.test.tsx (fichero de A4, en edicion) - no es deuda de A6"
  },
  "solicitudes_handoff": [
    "A7 - CI: cablear 'pnpm --filter @ego/avatar attribution:check' y 'pnpm --filter @ego/avatar no-verbatim:check' al job verify, y aplicar el diff del delegador scripts/verify-attribution.mjs que rechaza --apply (diff exacto en la seccion 8.1).",
    "A4 - renderer: CERO diff. La 'doble ruta' no existe (los exports del paquete y el alias apuntan los dos a src/; ensure-fresh-dist excluye el dist/ del avatar). Solo saber que el motor cambio y que @ego/avatar ahora declara su superficie completa.",
    "A1 - Backlog: texto exacto para la fila EGO-FIND-82 (seccion 8.3) y las cifras de AGENTS.md seccion 4: 47 ficheros .js (10 609 lineas, no 11 203) y 320 tests (no 266).",
    "A5 - fichas: docs/extractions/coucou.md 52.4 ya esta actualizada por A6; el reparto cambio a 58 derivados / 31 nativos (runtime/avatar-element.js paso a derivado). Refrescar el numero en README.md 4.3 si lo cita.",
    "A2bis - extender manifiesto + puerta de residuo al resto de packages/**: tool-call-repair sin NOTICE y con 3 cabeceras en prosa; tools y ui-runtime sin manifiesto ni LICENSE.md."
  ],
  "deuda_abierta": [
    "64 errores de typecheck profundo en los tests (dobles que no coinciden con las declaraciones): ruido documentado; el typecheck de los tests ya es puerta real (parse + resolucion)",
    "A2bis: extender el contrato de procedencia al resto de packages/**",
    "A7: cablear las dos puertas a CI y el diff del delegador",
    "A1: cerrar la fila EGO-FIND-82 y corregir las cifras de AGENTS.md 4",
    "A5: refrescar la tabla de docs/extractions/README.md 4.3",
    "Menor: dist/ se publica junto a src/ aunque los exports apuntan a src/ (redundante en el artefacto)",
    "Menor: provenance.proposed.json deberia estar en .gitignore (raiz, A7)"
  ],
  "SKILLS_CARGADAS": []
}
```
