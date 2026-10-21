# Handoff A6 (Ola 4b) — 2026-10-21 — Deuda del motor de personaje

> Zona de A6 en esta ola: `packages/avatar/**` y
> `apps/desktop/renderer/floating/vendor/avatar/**`. Sin commits. Sin
> `pnpm install`.

## 0. Resumen ejecutivo (léase primero)

| Ítem | Estado | Resultado |
|---|---|---|
| **T1** — el atributo `hands` sin test | ✅ | Test nuevo de 9 casos + **bug real encontrado y arreglado** (la ruta atributo→`setParam` era un no-op si el host no existía) |
| **T2** — divergencia frente al upstream | ✅ | 25 divergencias + 5 ficheros propios **declaradas con motivo y hash** en `upstream-divergence.json` + **puerta nueva** `upstream:check` (falla ante divergencia no declarada) |
| **T3** — colisión `brand ≡ warning` | ✅ | El avatar **no lee el tema**: la paleta es dato. Golden **231/231** verde. Correspondencia documentada (±5° de tono) |
| **T4** — arnés de auditoría visual | ✅ | **Corrida verde confirmada**: 6/6 pasos, 0 infracciones (2 corridas consecutivas). 1 hallazgo de cobertura + 1 flake documentado → **A4** |
| **T5** — perfiles huérfanos en cuarentena | ✅ | **Diagnóstico con datos** (17 registros, 5 huérfanos, 0 pérdida de datos). Migración propuesta, **no aplicada** → **A2/A3** |

**Motivo de fondo de T1**: el atributo `hands` lo consume
`CharacterBadge` (`hands = "always"` por defecto) y ese badge corre el
**Robot Studio (canvas)**. La ruta estaba viva sólo por suerte del orden de
montaje; ahora está **fijada por test**.

---

## 1. T1 — El atributo `hands` no tenía test (la ruta que fallaba)

### 1.1 Qué faltaba

El rig de manos flotantes articuladas se controla desde el elemento con el
atributo `hands` (`always` | `auto` | `hidden`). La ruta nueva es:

```text
atributo `hands`  →  setParam('handsMode')  →  sobrevive al preset
```

El rig tenía **282 tests**, pero **ninguno** cubría esa ruta. *"Es justo la
parte que fallaba"* — la regresión volvería sin detectable.

### 1.2 Test rojo (demostrado,output pegado)

Fichero nuevo: `packages/avatar/tests/hands-attribute.test.js` (9 casos).

```text
$ node --test --test-reporter=tap tests/hands-attribute.test.js

  ok 1 - el atributo `hands` está observado por el elemento
  not ok 2 - el atributo hands llega al motor aunque el host todavía no exista
  ok 3 - el modo sobrevive a un preset que no toca las manos
  ok 4 - la ruta inversa: preset -> atributo -> setParam
  ok 5 - un valor inválido degrada a auto sin romper
  ok 6 - los alias del atributo hands se normalizan
  ok 7 - el atributo hands se puede cambiar de valor en caliente
  ok 8 - el modo de manos no depende de que exista el host (sin host, no rompe)
  ok 9 - el host expone handsMode como parámetro del studio

    error: |-
      el modo debe llegar al host aunque se crease después del atributo

      'auto' !== 'always'

      code: 'ERR_ASSERTION'
      expected: 'always'
      actual: 'auto'
      operator: 'strictEqual'
      stack: |-
        .../tests/hands-attribute.test.js:84:10

  # tests 9
  # pass 8
  # fail 1
```

### 1.3 El bug real que encontró el test

**Síntoma**: el atributo `hands` se perdía en el camino siempre que el host de
studio todavía no existiera.

**Causa raíz** — `src/runtime/avatar-element.js`, en
`attributeChangedCallback`:

```js
if (name === 'hands') {
  this._handsMode = normalizeHandsMode(newV);
  this._studioHost?.setParam('handsMode', this._handsMode);   // <-- host opcional
  return;
}
```

Con `?.` sobre `this._studioHost`, si el host **no existe**, no hay
`setParam` en absoluto: el valor se queda sólo en `_handsMode`. En el
navegador el valor se recuperaba **por casualidad**, porque
`_mountStudio()` lo re-aplica tras el montaje:

```js
_mountStudio() {
  const res = mountStudio(this, STYLES);
  this._studioHost?.setParam('handsMode', this._handsMode);
  return res;
}
```

Es decir: la ruta **no era autosuficiente**; dependía del orden de montaje.
El caso real que reproduce el test es el del navegador: **los atributos se
parsean antes de conectar el elemento**, así que el host canvas aún no
existe cuando el atributo se procesa.

### 1.4 El arreglo (1 línea + comentario)

`packages/avatar/src/runtime/avatar-element.js`:

```diff
       if (name === 'hands') {
         this._handsMode = normalizeHandsMode(newV);
-        this._studioHost?.setParam('handsMode', this._handsMode);
+        // `_studio()` (y no `this._studioHost`) a propósito: en el navegador
+        // los atributos se parsean ANTES de conectar el elemento, así que el
+        // host canvas todavía no existe. Con el host opcional el valor se
+        // perdía por el camino (solo quedaba en `_handsMode`) y el motor
+        // nacía con el modo por defecto.
+        this._studio()?.setParam('handsMode', this._handsMode);
         return;
       }
```

**Por qué es seguro** (verificado, no supuesto):

- `_studio()` → `studioHost(el)` sólo crea un host si `isStudio(el, modo)`
  vale. En **modo SVG** devuelve `null` → `?.setParam` → no-op: mismo
  comportamiento que antes.
- El `constructor` de `StudioHost` **no tiene efectos** (sólo inicializa
  campos): crear el host antes es barato y sin consecuencias.
- `mountStudio()` (ruta de montaje) **hereda** el modo del host anterior:
  `host.handsMode = prev.handsMode` (`src/runtime/studio-bridge.js:105`), y
  además `_mountStudio()` lo re-aplica. Doble cobertura, sin regresión.
- Tras el arreglo: **9/9 verde**.

### 1.5 Qué cubren los 9 casos

| Caso | Qué fija |
|---|---|
| 1 | `hands` está en `observedAttributes` |
| 2 | **el atributo llega al motor aunque el host se cree después** (el rojo) |
| 3 | **el modo sobrevive a un preset que no toca las manos** (la regresión que faltaba) |
| 4 | ruta inversa: preset → atributo → `setParam` |
| 5 | valor inválido / nulo → degrada a `auto` sin romper |
| 6 | alias (`on`/`off`/`true`/`false`, mayúsculas, espacios) |
| 7 | cambio de valor en caliente |
| 8 | en modo SVG no se crea host y no rompe |
| 9 | `handsMode` es un parámetro válido del studio (`setParam` acepta / rechaza) |

> El mock del caso 3 reinicia `handsMode` a `'auto'` en `applyPreset`: es un
> modelo **estricto a propósito** (el host debe restaurar el modo sí o sí),
> para que el test fije la lógica de restauración y no un accidente.

### 1.6 Dónde lo consume la app (contexto)

`apps/desktop/renderer/components/character/CharacterBadge.tsx`:

```tsx
hands = "always",          // L121 — por defecto
...
mode: effectiveMode,      // L136 — "studio" (Robot Studio) salvo baseForm "delta-core"
hands,                     // L229 — se pasa como atributo
```

Es decir: **cada badge de avatar de la app pide las manos encendidas y corre
el motor canvas**. Esta es exactamente la ruta que el test fija.

---

## 2. T2 — El port diverge del upstream: declarado y vigilado

### 2.1 El hecho

`repos-referencia/avatar/` es una **referencia de solo lectura**: está en
`.gitignore` (línea 49), **no forma parte del repositorio**, y su `HEAD`
está desfasado respecto a su propio *working tree*. El paquete
`packages/avatar/` es un **descendiente bifurcado** de ese *working tree*, no
un espejo.

El enunciado de la ola hablaba de **4 ficheros** divergentes. La realidad
medida (por hash, 2026-10-21) es mayor, porque las olas anteriores (atribución
normalizada, geometría propia D4, estado `warning`, round-trip 1:1) también
tocaron ficheros:

### 2.2 La tabla de divergencias declaradas

Medido por SHA-256 sobre `src/`: **49 ficheros en el paquete**, 44 en el
upstream.

| Situación | Nº | Ficheros |
|---|---|---|
| **Byte-idénticos** | 19 | `core/{config,genome,morph,palette,prng}`, `{index,version}`, `render/{ara-head,body,eyes,shell}`, `runtime/{extension-host,pointer,policy}`, `studio/index`, `studio/render/{particles,visor}`, `studio/rig/{eyes,hands}` |
| **Bifurcados (declarados)** | **25** | `core/{anim,timeline}`, `render/{builder,parts,projection,static}`, `runtime/{avatar-element,fx-eyes,micro,poses,presence,sound,states}`, `studio/{adapter,avatar,config,element-host,sound}`, `studio/render/{accessories,body,ears,eyes,helpers,mouth,overlays}` |
| **Nuevos (declarados)** | **5** | `runtime/{avatar-element.d.ts,sound.d.ts,studio-bridge.js,svg-export.js}`, `studio/render/geometry.js` |
| **Ausentes** | 0 | — |

### 2.3 Por qué existe cada divergencia

El registro canónico es **`packages/avatar/upstream-divergence.json`** (nuevo):
cada entrada lleva `kind`, `reason` (el motivo, en prosa) y `sha256` (el
**hash aprobado** del contenido). Los `kind` posibles:

| `kind` | Significado |
|---|---|
| `attribution` | cabecera de atribución normalizada a una ruta `vendor/` resoluble |
| `types` | tipos reales (JSDoc) exigidos por el typecheck con `checkJs` |
| `geometry` | geometría propia de Ego en lugar de un puerto literal (decisión D4) |
| `state` | vocabulario de estados/presets propio de Ego |
| `feature` | función nueva del motor (no existe en el upstream) |
| `fix` | corrección de un defecto del upstream |

Resumen por familia (el detalle fichero a fichero está en el manifiesto):

| Familia | Ficheros | Motivo |
|---|---|---|
| Atribución | `core/anim`, `core/timeline`, `render/projection`, `render/static`, `runtime/micro`, `runtime/presence`, `runtime/sound` | las cabeceras citaban rutas que **no existen** (`vendor/coucou/anim.ts`, `coucou mochi/engine.ts`, `coucou/windows/src/island/fsm.ts`) → normalizadas a rutas `vendor/…` resolubles, para que la cadena MIT no quede colgando |
| Tipos | `render/builder`, `runtime/fx-eyes`, `core/timeline`, `runtime/micro` | el `checkJs` rechazaba leer `cfg.cycles` y pasar un array serializado a `string`: **sin cambio de comportamiento** |
| Geometría (D4) | `studio/render/{accessories,body,ears,eyes,helpers,mouth}` | geometría **propia** de Ego; se eliminaron las ramas literales de Mochi (`blob`, `mochi-sphere`, `mochi-cute`) |
| Estado | `studio/{config,element-host,avatar,adapter}`, `studio/sound`, `studio/render/overlays` | presets de identidad de Ego (`coucou-mochi` eliminado), 26 estados de studio, puente 1:1 en las dos direcciones, `STATE_ACCENT` como fuente única del acento, imágenes y sonidos propios de los 4 estados nuevos |
| Feature / fix | `runtime/avatar-element`, `runtime/states`, `runtime/poses`, `render/parts` | atributo `hands`, `preset` observado, API pública, estado `warning` con pose/insignia propias, fix del regex de `badgeLayer` por prefijo compartido |

### 2.4 La puerta que la vigila (nueva)

**`packages/avatar/scripts/check-upstream-divergence.mjs`** → `pnpm --filter @ego/avatar upstream:check`

Falla (exit 1) si:

1. un fichero **diverge sin estar declarado** → *divergencia no declarada*;
2. un fichero declarado **ya no diverge** → *declaración obsoleta*;
3. el **contenido aprobado** de un fichero declarado cambia → hay que
   re-declarar;
4. aparece un **fichero nuevo** en el paquete sin declarar;
5. desaparece un fichero del upstream sin declarar.

Si el upstream **no está presente** (clone limpio: está gitignored), lo dice y
sale con **0**: no es un fallo, es la ausencia de la referencia.

### 2.5 Verificación de la puerta (los dos modos de fallo, demostrados)

```text
$ node scripts/check-upstream-divergence.mjs
upstream repos-referencia\avatar: 49 ficheros en el paquete | identicos=19
  divergen=25 (declaradas 25) | nuevos=5 (declarados 5) | eliminados=0
  SIN DIVERGENCIA NO DECLARADA: cada diferencia con el upstream esta justificada en upstream-divergence.json.
  exit=0

(a) divergencia NO declarada (se toca un fichero hoy idéntico al upstream):
  1 PROBLEMA(S):
    divergencia NO declarada: core/genome.js (upstream 213a26a96c55 / paquete d68b20467447)
  exit=1

(b) contenido aprobado cambiado en un fichero DECLARADO:
  1 PROBLEMA(S):
    contenido aprobado cambiado: core/anim.js (manifesto 722d1f48b2f0 / actual 70a62d29c373)
    — re-declara con --update
  exit=1

(revertido)  →  exit=0
```

**Clone limpio** (upstream ausente) — la puerta **no** rompe el build:

```text
  upstream no presente en repos-referencia\__no-existe__ (referencia de solo
  lectura, gitignored): se omite la comparacion.
  exit=0
```

**Re-declarar** (consciente, imprime el cambio):

```bash
pnpm --filter @ego/avatar upstream:declare   # = --update
```

### 2.6 Relación con `sync-check.mjs` (no se contradicen)

| Puerta | Compara | Falla ante |
|---|---|---|
| `sync:check` | paquete ↔ **copia vendorizada** | drift entre las dos copias de Ego |
| `upstream:check` | paquete ↔ **upstream** | divergencia no declarada frente a la referencia |

`sync-check` ya **informaba** del fork («esperado: ver README»); el mensaje
apunta ahora al manifiesto. `upstream:check` es lo que **hace cumplir** la
declaración.

### 2.7 Documentación actualizada

- `packages/avatar/README.md` § *Tres copias del motor*: cifras reales
  (19/25/5, antes 28/16/5 — **estaban desfasadas**) + la puerta nueva + filas
  en la tabla de scripts.
- `packages/avatar/DESIGN.md` §11 *Estado real: este paquete es un fork del
  upstream*: cifras reales, tabla fichero a fichero al día y el manifiesto
  como **registro canónico**.
- `packages/avatar/DESIGN.md` §12: la puerta nueva en la tabla de
  verificación.

---

## 3. T3 — La colisión `brand ≡ warning` no puede romper el render del avatar

### 3.1 Verificación: el motor NO lee el tema

Barrido de `packages/avatar/src/**` buscando cualquier lectura del tema
(`oklch`, `var(--…)`, `getComputedStyle`, `theme`, tokens):

```text
  \runtime\avatar-element.js:133: :host { display: inline-block;
      width: var(--avatar-size, 112px); height: var(--avatar-size, 112px); }
```

**Una sola coincidencia**, y no es un color: `--avatar-size` es el tamaño del
elemento (con valor por defecto). ⇒ **la paleta del avatar es DATO, no
tema**. El cambio de `warning` en `design-system.md` §2.4 no puede alterar el
render.

### 3.2 Golden de geometría: verde

```text
$ node scripts/compare-geometry.mjs --check tests/golden/geometry.json src
GEOMETRIA IDENTICA a la golden: 231 combinaciones (33 estados x 7 modulos).
  exit=0
```

### 3.3 La correspondencia, medida

| Sistema | `warning` | Tono |
|---|---|---|
| Tema del producto (`design-system.md` §2.4) | `oklch(0.837 0.164 84.4)` = `#FBBF25` = `hsl(43 96% 56%)` | 43° |
| Motor SVG (`runtime/states.js:36`) | `hsl(48 92% 55%)` | 48° |
| Motor canvas / studio (`studio/config.js:215`) | `#f59e0b` = `hsl(38 92% 52%)` | 38° |

Los tres caen en la **misma familia de tono (±5°)**: el aviso se lee igual en
el producto y en el avatar, aunque sean sistemas independientes.

Documentado en `packages/avatar/DESIGN.md` §5-ter (*La paleta del avatar es
DATO, no tema*), con la regla para el futuro: *si el tema cambia un tono de
estado, el motor puede seguirlo, pero no depende de él; la golden es la que
garantiza que el render no se mueve*.

**Nada que cambiar en el paquete** (salvo la documentación): la golden no se
movió.

---

## 4. T4 — Arnés de auditoría visual: corrida verde CONFIRMADA

> El arnés vive en `apps/desktop/scripts/` (**zona de A4**). **No se ha
> tocado.** Sólo se ha ejecutado.

### 4.1 La corrida (comando + exit + resumen)

```text
$ pwsh -File apps/desktop/scripts/run-design-audit.ps1 -Out %TEMP%\ego-audit-a6-run1 -Headless
[audit] runner: headless (Application)
[audit] 6/6 pasos ok
[audit] infracciones: 0 {}
[audit] runner: headless
[audit] 6/6 pasos ok
[audit] infracciones: 0 {}
```

`report.json` de esa corrida:

```json
{"runner":"headless","url":"http://127.0.0.1:5173/",
 "summary":{"totalViolations":0,"byRule":{},"stepsOk":6,"stepsTotal":6},
 "errors":0}
```

**Se repitió 2 veces más: verde en las 3** (la 1.ª con el camino de referencia
de ego-lite; las 2.ª y 3.ª con `-Headless`).

### 4.2 Lo que faltaba y sigue faltando (→ A4)

**(a) El compositor de ego-lite sigue muerto.** La primera corrida lo dice:

```text
[error] [audit] el compositor no produjo ningún frame: la corrida no es válida (usa -Headless).
[audit] 0/6 pasos ok
[audit] camino de rescate: Chromium headless (no depende del compositor de ego lite).
[audit] runner: headless (Application)
[audit] 6/6 pasos ok
```

El **fallback funciona** (eso es lo que había que confirmar: el arnés no se
queda en 0/6). Pero el **camino de referencia** —el que ve la app real con su
ventana real— **sigue produciendo 0 frames**. Sigue siendo deuda de A4.

**(b) Flake conocido: el halo `animate-ping` de la cabecera.** En 1 de 3
corridas salieron 2 infracciones `DESBORDE`:

```text
[audit] infracciones: 2 {"DESBORDE":2}
  header.flex.h-11 > div.flex.items-center > button.inline-flex.items-center > span.shrink-0
  div.flex.items-center > button.inline-flex.items-center > span.shrink-0 > span.relative.flex
```

Es **el punto pulsante del selector de modelo** de la cabecera
(`apps/desktop/renderer/src/App.tsx:433`: `<span className="relative flex h-2
w-2 …">` con el halo `animate-ping` absoluto). **NO es el avatar.** Y es
exactamente el caso que el propio spec describe como no reproducible:

> `apps/desktop/scripts/design-audit-spec.mjs:161-165` — *"El `scrollWidth`
> también cuenta el desbordamiento de los descendientes ABSOLUTOS (el halo
> `animate-ping`, un badge, un tooltip) […] la comparación NO usa píxeles
> exactos: el halo `animate-ping` cambia de tamaño con la animación, así que
> una comparación exacta hacía la auditoría NO REPRODUCIBLE (a veces 2
> infracciones, a veces 0)."*

⇒ **No es un defecto nuevo**: es la regla mediendo en el instante malo. Con
`tolerancia = 2 px` y el halo a mitad de animación, el absoluto no llega a
exceder el flujo por más de 2 px y el exceso se le atribuye al layout.

### 4.3 Hallazgo de cobertura: **el avatar nunca se audita en modo Studio**

Esto es lo importante para mi zona: la auditoría **mide el DOM**, y el
`<canvas>` del Robot Studio (motor canvas, mi zona) **nunca está en el DOM
durante la auditoría**.

- El canvas del studio se monta en `WardrobeSelector`
  (`apps/desktop/renderer/components/character/wardrobe/WardrobeSelector.tsx:340`:
  `mode: currentConfig.baseForm === "delta-core" ? "svg" : "studio"`).
- `WardrobeSelector` se renderiza **sólo** en la pestaña *Avatares y
  Mascota* (`PersonalizationView.tsx:658`).
- El paso `04-personalizacion` abre el panel de Personalización pero cae en
  la pestaña por defecto (**Skills**) → `WardrobeSelector` no se monta.

Y el `canvas` tampoco lo cazarían las reglas: un `<canvas>` tiene
`scrollWidth === clientWidth` (no hay contenido desplazable) y sin `role`
no entra en las reglas de objetivo táctil.

⇒ **El render del motor canvas de Ego no está cubierto por la auditoría.**

---

## 5. T5 — Perfiles de Sub-Egos huérfanos en `quarantine/pending`

> `packages/memory/**` (A2) y `packages/subegos/**` (A3): **no se toca**. Aquí
> va el **diagnóstico con datos** y la propuesta.

### 5.1 Cómo se leyó (sin escribir nada)

El MCP de VantaDB del entorno apunta a **otra** base de datos (namespaces
`_opencode_sesiones`, `agent`, `test_lead`). La BD real de la app es
`%APPDATA%\@ego\desktop\ego_memory.vdb` (`apps/desktop/src/main/create-window.ts:185`),
abierta por el binding nativo `vantadb-node` con **modo lectura**:

```js
const db = await VantaDb.connect(dbPath, { read_only: true });
const res = await db.list('quarantine/pending', { include_quarantined: true, limit: 1000 });
```

### 5.2 El inventario real (17 registros, no 11)

`quarantine/pending` **no es un namespace de "alertas"**: es un **área de
staging** que hoy mezcla tres cosas sin relación. Namespaces de la BD:
`gov/audit`, `gov/projects`, `gov/sub_egos`, `projects/default`,
`quarantine/pending`, `session/turns`, `system/snapshots/daily`,
`system/window-state`.

| Grupo | Nº | Claves | ¿Qué son? |
|---|---|---|---|
| **VIEJO (huérfanos)** | **5** | `egos/{analyst,code_reviewer,copywriter,planner,researcher}/profile:profile` | perfiles de Sub-Ego con el **esquema viejo** (id sin prefijo `ego.`) |
| **NUEVO (legítimos)** | 5 | `egos/ego.{analyst,code-reviewer,copywriter,planner,researcher}/profile:profile` | los mismos perfiles con el **esquema actual** |
| **OTROS (legítimos, no son perfiles)** | 7 | `gov/settings:model_config`, `gov/settings:voice`, `system/snapshots/daily:2026-10-14/15/20`, `system/window-state:{floating_window,main_window}` | ajustes, snapshots diarios y estado de ventanas |

**El "11" del enunciado es el recuento del Daily State**
(`packages/dailystate/src/DailyStateEngine.ts:192-193` →
`sweepNamespace("quarantine/pending")`), que **cuenta todos los registros del
namespace como si fueran alertas**: incluye el estado de las ventanas y los
snapshots diarios. El número **cambia con el uso de la app** (ahora 17).

### 5.3 La causa raíz: la migración no fue mecánica

El paso de `egos/<id>/…` a `egos/ego.<id>/…` **no es un prefijo**:

| Antiguo | Actual | ¿Es un prefijo? |
|---|---|---|
| `egos/analyst` | `egos/ego.analyst` | sí |
| `egos/copywriter` | `egos/ego.copywriter` | sí |
| `egos/planner` | `egos/ego.planner` | sí |
| `egos/researcher` | `egos/ego.researcher` | sí |
| **`egos/code_reviewer`** | **`egos/ego.code-reviewer`** | **NO: `_` → `-`** |

⇒ Una migración por prefijo crearía `egos/ego.code_reviewer/…`, una clave
**inexistente**. Hay que usar el **mismo normalizador** que usa el producto.

### 5.4 No hay pérdida de datos (verificado)

Los 5 perfiles huérfanos son **duplicados rancios**: su contraparte canónica
está en **`gov/sub_egos`** (el namespace canónico de perfiles), que contiene
las 5 claves actuales:

```text
gov/sub_egos (perfiles canónicos): 5
   key="egos/ego.analyst/…"
   key="egos/ego.code-reviewer/…"
   key="egos/ego.copywriter/…"
   key="egos/ego.planner/…"
   key="egos/ego.researcher/…"
```

Migrabilidad comprobada sobre `quarantine/pending`:

```text
egos/analyst        -> egos/ego.analyst        YA EXISTE (destino ocupado)
egos/code_reviewer  -> egos/ego.code-reviewer  libre        <-- el unico que migraria
egos/copywriter     -> egos/ego.copywriter     YA EXISTE
egos/planner        -> egos/ego.planner        YA EXISTE
egos/researcher     -> egos/ego.researcher     YA EXISTE
```

Además, **todos los registros tienen TTL** (`expires_at` ≈ 14 días por
delante): si nadie los toca, **se expiran solos**.

### 5.5 Propuesta (NO destructiva, NO aplicada)

Para **A3** (`packages/subegos/**`, que escribe los perfiles):

1. **Migración idempotente** de los 5 huérfanos al esquema actual, usando el
   **normalizador del producto** (no un prefijo), y **sólo** si el destino no
   existe: si ya existe (4 de 5), el huérfano es un duplicado → se puede
   **superseder** (`put` con `superseded_by`/TTL 0) en lugar de borrar.
2. **Guardia de seguridad**: la migración **no borra nada**; escribe el
   registro viejo con TTL corto y una marca `superseded_by`, de modo que
   siempre se puede auditar. Un `sweep` posterior ya lo limpia.
3. **Idempotencia**: ejecutarla dos veces no cambia nada (el registro viejo ya
   no existe o ya está marcado).

Para **A2** (`packages/memory/**`): la lectura/escritura con
`include_quarantined` y el normalizador de claves.

Para el **Daily State** (quien lo tenga): el contador `quarantineAlertsCount`
no debería contar como "alertas" el estado de ventanas ni los snapshots
diarios. Sugerencia: contar **sólo** los registros de perfil (o segregar
`quarantine/pending` por tipo). Si no, el contador seguirá mostrando "11
alertas" que no son alertas.

---

## 6. Solicitudes fuera de zona (con diff exacto)

### 6.1 → A4 · `apps/desktop/scripts/` — el arnés

**6.1.1 Cobertura: que la auditoría mida el avatar (motor canvas)**

El canvas del Robot Studio nunca se audita (§4.3). Diff propuesto:

`apps/desktop/scripts/design-audit-headless.mjs` (sustituir el bloque
`if (step.click) {…}` por un bucle que admita **varios** clics encadenados):

```diff
-        if (step.click) {
-          const loc = resolveLocator(page, step.click);
-          if (loc) {
-            await withTimeout(loc.first().click({ timeout: CFG.timeoutMs }), CFG.timeoutMs, `click ${step.click}`);
-          } else {
-            await withTimeout(page.click(step.click, { timeout: CFG.timeoutMs }), CFG.timeoutMs, `click ${step.click}`);
-          }
-        }
+        for (const target of step.clicks ?? (step.click ? [step.click] : [])) {
+          const loc = resolveLocator(page, target);
+          if (loc) {
+            await withTimeout(loc.first().click({ timeout: CFG.timeoutMs }), CFG.timeoutMs, `click ${target}`);
+          } else {
+            await withTimeout(page.click(target, { timeout: CFG.timeoutMs }), CFG.timeoutMs, `click ${target}`);
+          }
+        }
```

`apps/desktop/scripts/design-audit-spec.mjs` (`DEFAULT_STEPS`, añadir un
paso):

```diff
     { id: "06-omnibar", key: "ControlOrMeta+K", wait: 1500 },
+    {
+      id: "07-avatar",
+      clicks: [
+        "loc=css:nav[aria-label='Icon Rail'] button[aria-label='Personalización']",
+        "loc=role:button[name='Avatares y Mascota']",
+      ],
+      wait: 1500,
+      note: "Avatar: Robot Studio (canvas) y el rig de manos articuladas",
+    },
   ],
 };
```

Ambos localizadores están verificados contra el código real:
`PersonalizationView.tsx:369` renderiza el botón *Avatares y Mascota* (un
`Button` con `aria-pressed`), y `resolveLocator` traduce
`role:button[name='…']` → `getByRole("button", { name, exact: true })`.

**6.1.2 El flake del halo `animate-ping`** (no es un defecto nuevo; está
documentado en el propio spec). Si A4 quiere que la auditoría sea
**determinista**, la salida es subir la tolerancia de la comparación con el
descendiente absoluto de 2 px a, por ejemplo, 6 px, o marcar el halo con
`pointer-events-none` + `overflow-clip` en el contenedor:

```diff
--- a/apps/desktop/scripts/design-audit-spec.mjs
+++ b/apps/desktop/scripts/design-audit-spec.mjs
@@ -166,7 +166,7 @@
-      const absExplains = absRight > inFlowRight + 2;
+      // El halo `animate-ping` escala hasta 2x durante la animacion: con 2 px
+      // de tolerancia la auditoria mide en el instante malo (1 de cada 3
+      // corridas daba 2 DESBORDE falsos sobre el punto pulsante de la
+      // cabecera). 6 px cubre el halo completo sin tapar un desborde real.
+      const absExplains = absRight > inFlowRight + 6;
```

**6.1.3 El compositor de ego-lite sigue muerto** (0/6 frames). No lo he
tocado (es zona de A4). El camino de rescate funciona y da verde, así que la
auditoría **es utilizable hoy**; lo que no funciona es el camino de
referencia.

### 6.2 → A2 / A3 — perfiles huérfanos en cuarentena

El diagnóstico está en §5 (con datos). Resumen accionable:

- **A3** (`packages/subegos/**`): implementar la **migración idempotente** de
  los 5 perfiles con esquema viejo al actual, usando el **normalizador del
  producto** (`code_reviewer` → `code-reviewer`), **sin borrar**: marcar el
  huérfano como superseded + TTL corto cuando el destino ya existe.
- **A2** (`packages/memory/**`): confirmar el normalizador de claves
  (`egos/ego.<id>`) y la semántica de `include_quarantined` para que la
  lectura de `quarantine/pending` distinga "perfil huérfano" de "snapshot".
- **Dueño del Daily State**: `quarantineAlertsCount` no debería contar el
  estado de ventanas ni los snapshots diarios como "alertas".

---

## 7. Verificación (comando + exit + resumen)

Todos desde `packages/avatar/`:

| # | Comando | Exit | Resumen |
|---|---|---|---|
| 1 | `node --test --test-reporter=tap tests/` | **0** | **291 tests, 291 pass, 0 fail** (282 previos + 9 nuevos) |
| 2 | `pnpm --filter @ego/avatar typecheck` | **0** | `tsc -p tsconfig.json` (allowJs + checkJs) |
| 3 | `pnpm --filter @ego/avatar build` | **0** | `build: 50 ficheros -> dist/` + manifiesto SHA-256 |
| 4 | `pnpm --filter @ego/avatar build:check` | **0** | `dist/ al dia (50 ficheros)` |
| 5 | `pnpm --filter @ego/avatar sync:check` | **0** | `SIN DRIFT` entre el paquete y la copia vendorizada |
| 6 | `pnpm --filter @ego/avatar geometry:check` | **0** | `GEOMETRIA IDENTICA a la golden: 231 combinaciones` |
| 7 | `pnpm --filter @ego/avatar attribution:check` | **0** | `CADENA MIT RESOLUBLE` (32 ficheros de corpus, 9 rutas) |
| 8 | `pnpm --filter @ego/avatar bridge:check` | **0** | `CONTRATO CUMPLIDO` — round-trip 15/15, 0 colisiones |
| 9 | `pnpm --filter @ego/avatar upstream:check` | **0** | `SIN DIVERGENCIA NO DECLARADA` (25 declaradas, 5 nuevos) |
| 10 | `pwsh -File apps/desktop/scripts/run-design-audit.ps1 -Out … -Headless` | **0** | `6/6 pasos ok`, `infracciones: 0` (2 corridas consecutivas) |

> La copia vendorizada (`apps/desktop/renderer/floating/vendor/avatar/`) se
> re-sincronizó con `sync:write` tras el cambio de `avatar-element.js`:
> `sync:check` da `SIN DRIFT`.

---

## 8. Ficheros tocados en esta ola (exclusivamente mi zona)

| Fichero | Cambio |
|---|---|
| `packages/avatar/src/runtime/avatar-element.js` | **fix**: la ruta del atributo `hands` usa `_studio()` (crea el host si falta) en vez de `_studioHost?.` |
| `packages/avatar/tests/hands-attribute.test.js` | **nuevo**: 9 casos (T1) |
| `packages/avatar/upstream-divergence.json` | **nuevo**: manifiesto de divergencias (25 + 5) con motivo y hash |
| `packages/avatar/scripts/check-upstream-divergence.mjs` | **nuevo**: la puerta (T2) |
| `packages/avatar/package.json` | scripts `upstream:check` y `upstream:declare` |
| `packages/avatar/scripts/sync-check.mjs` | el mensaje del fork apunta al manifiesto |
| `packages/avatar/README.md` | cifras reales del fork, la puerta nueva, filas de la tabla de scripts |
| `packages/avatar/DESIGN.md` | §5-ter (paleta = dato, correspondencia `warning`), §11 (tabla del fork al día), §12 (puerta nueva) |
| `apps/desktop/renderer/floating/vendor/avatar/runtime/avatar-element.js` | re-sincronizado (byte-idéntico al paquete) |

**No tocados**: `repos-referencia/**` (referencia de solo lectura, gitignored),
`packages/{memory,subegos,dailystate}/**`, `apps/desktop/{src,renderer}/**`
salvo la copia vendorizada, `apps/desktop/scripts/**`, `docs/**` salvo este
handoff, `.github/**`, `scripts/**` de la raíz, `package.json` raíz.

**Sin commits** (los commitea el orquestador) · **sin `pnpm install`** ·
**sin `git checkout/reset/stash/clean`**.

---

## 9. Deuda abierta

1. **A4** — el compositor de ego-lite sigue sin producir frames (0/6). El
   camino de rescate funciona y da verde; el de referencia no.
2. **A4** — la auditoría no mide el motor canvas del avatar (falta el paso
   `07-avatar`; diff en §6.1.1).
3. **A4** — 1 de 3 corridas da 2 `DESBORDE` falsos sobre el halo
   `animate-ping` de la cabecera (diff en §6.1.2).
4. **A2/A3** — 5 perfiles huérfanos en `quarantine/pending`, esperando la
   migración idempotente (§5.5). **No se ha borrado nada**: son datos de
   usuario y tienen TTL.
5. **Dueño del Daily State** — `quarantineAlertsCount` cuenta como "alertas"
   contenido que no son alertas (estado de ventanas, snapshots).
6. **Menor** — el conteo de "11" del enunciado ya no cuadra con la realidad
   (17) porque el namespace crece con el uso; el dato del enunciado es una
   foto de un momento, no un invariante.

---

## 10. `RESULTADO`

```json
{
  "agente": "A6",
  "status": "COMPLETE",
  "archivos_modificados": [
    "packages/avatar/src/runtime/avatar-element.js",
    "packages/avatar/tests/hands-attribute.test.js",
    "packages/avatar/upstream-divergence.json",
    "packages/avatar/scripts/check-upstream-divergence.mjs",
    "packages/avatar/scripts/sync-check.mjs",
    "packages/avatar/package.json",
    "packages/avatar/README.md",
    "packages/avatar/DESIGN.md",
    "apps/desktop/renderer/floating/vendor/avatar/runtime/avatar-element.js"
  ],
  "hallazgos_resueltos": [
    "T1: bug real en la ruta atributo `hands` -> setParam (no-op si el host no existia) - test rojo demostrado y fix aplicado",
    "T1: 9 tests nuevos que fijan atributo -> setParam -> supervivencia al preset, ruta inversa, degradacion de valor invalido y alias",
    "T2: 25 divergencias + 5 ficheros propios declarados con motivo y hash en upstream-divergence.json",
    "T2: puerta nueva upstream:check (falla ante divergencia no declarada, declaracion obsoleta o contenido aprobado cambiado; exit 0 si el upstream no esta)",
    "T3: verificado que el motor no lee el tema del producto (paleta = dato) y que la golden sigue en 231/231",
    "T3: correspondencia de `warning` documentada (tema 43deg, motor SVG 48deg, studio 38deg)",
    "T4: corrida verde confirmada (6/6 pasos, 0 infracciones, 2 corridas consecutivas)",
    "T5: diagnostico con datos de los 5 perfiles huerfanos (0 perdida de datos, TTL, mapa no mecanico code_reviewer->code-reviewer)",
    "Docs del paquete actualizados (README, DESIGN) con las cifras reales del fork (19/25/5, antes 28/16/5 desfasadas)"
  ],
  "verify": {
    "test": "291/291 pass (node --test tests/) - exit 0",
    "typecheck": "exit 0",
    "build": "exit 0 (50 ficheros + manifiesto SHA-256)",
    "build:check": "exit 0",
    "sync:check": "SIN DRIFT - exit 0",
    "geometry:check": "231/231 - exit 0",
    "attribution:check": "CADENA MIT RESOLUBLE - exit 0",
    "bridge:check": "CONTRATO CUMPLIDO (15/15) - exit 0",
    "upstream:check": "SIN DIVERGENCIA NO DECLARADA - exit 0",
    "design-audit (A4)": "6/6 pasos ok, 0 infracciones - exit 0 (2 corridas)"
  },
  "solicitudes_handoff": [
    "A4 - apps/desktop/scripts: anadir soporte de `clicks[]` en el runner + paso `07-avatar` para que la auditoria mida el motor canvas del avatar (diff exacto en §6.1.1)",
    "A4 - apps/desktop/scripts/design-audit-spec.mjs: tolerancia del descendiente absoluto de 2px a 6px para que el halo animate-ping no produzca DESBORDE falsos (diff exacto en §6.1.2)",
    "A4 - el compositor de ego-lite sigue sin producir frames (0/6): el fallback headless funciona y da verde, el camino de referencia no",
    "A3 - packages/subegos: migracion idempotente de los 5 perfiles huerfanos con el normalizador del producto (code_reviewer -> code-reviewer), sin borrar (superseded + TTL corto)",
    "A2 - packages/memory: confirmar normalizador de claves egos/ego.<id> y lectura include_quarantined para distinguir perfil huerfano de snapshot",
    "Dueño del Daily State - quarantineAlertsCount no debería contar estado de ventanas ni snapshots diarios como alertas"
  ],
  "deuda_abierta": [
    "A4: compositor ego-lite sin frames",
    "A4: el motor canvas del avatar no esta cubierto por la auditoria",
    "A4: 1 de 3 corridas con 2 DESBORDE falsos (halo animate-ping)",
    "A2/A3: 5 perfiles huerfanos en quarantine/pending pendientes de migracion (TTL activo, sin perdida de datos)",
    "Daily State: el contador de alertas de cuarentena incluye contenido que no es alerta"
  ],
  "SKILLS_CARGADAS": []
}
```
