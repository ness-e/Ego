# Diseño — Ego Avatar / Robot Studio

> Nombre técnico: **ego-avatar** · Elemento: `<ego-avatar>`
> Sintetiza un rig SVG por estados + un motor procedural por tabla de estados
> + principios de avatares generativos deterministas (ver `RESEARCH.md`).
> **Diseño propio**: la identidad la ponen el genoma, los 14 estados y Robot Studio.

---

## 1. Visión

Un **organismo abstracto generado por semilla** que:

1. **Se genera** — cada avatar recibe una `seed` que determina
   de forma **determinista e inmutable** su cuerpo, ojos, paleta, marcas y
   temperamento. Misma semilla ⇒ mismo avatar, siempre (identidad anclada).
2. **Cambia** — el mismo organismo transita estados cognitivos (idle, thinking,
   working, success, error, approval, sleeping…) con tintes, ojos, insignias y
   movimientos inequívocos (comunicación de estado).
3. **Reacciona** — mirada que sigue el puntero, parpadeo orgánico, acciones
   programadas (`success`, `error`, `waiting`…) cancelables.

---

## 2. Principios de diseño

| # | Principio | Origen |
|---|---|---|
| P1 | **Determinismo total**: `seed → xmur3 → mulberry32 → genoma`. Cero `Math.random()` en la identidad. | literatura de avatares (DiceBear / boring-avatars) |
| P2 | **Traits composicionales**: el genoma es un objeto JSON plano de genes independientes; añadir un trait = añadir un gen + su render. | literatura de avatares ("style as JSON") |
| P3 | **Shape language por redondeo**: `roundness` 0 (cuadrado) … 100 (redondo) sobre la plantilla de 160 puntos (default 50). | rig SVG de referencia |
| P4 | **Plantilla SVG + morfometría**: el SVG se construye una vez; animar = mutar atributos (poses = números). | rig SVG de referencia |
| P5 | **Tabla estado → cfg**: los estados son datos, no código. | motor procedural de referencia |
| P6 | **Capas separadas**: genoma (identidad) ≠ estado (situación) ≠ emote (transitorio) ≠ extensión (plugins). | ambos motores de referencia |
| P7 | **Cancelación por token** en secuencias de acción; sin carreras. | rig SVG de referencia |
| P8 | **Animación invariante al framerate**: springs sub-stepped + suavizado exponencial. | motor procedural de referencia |
| P9 | **Realismo no engañoso**: abstracto, abstracto; nunca pretende ser humano. | Shape of AI |
| P10 | **Cero dependencias**, ESM puro, web component framework-agnostic (funciona en React 19). | requisito del proyecto |

---

## 3. Arquitectura en capas

```
seed (string)                       ← ej. "subego:conocimiento"
   │  xmur3 hash → mulberry32 PRNG
   ▼
① GENOMA (identidad, inmutable)      src/core/genome.js
   shape{roundness,ratio} · eyes{scale,spacing,yBias} · palette{hue,…}
   marking · appendage · aura · temperament
   │
   ▼
② FENOTIPO (render)                 src/render/*
   body (cabeza paramétrica + 4 gradientes + marking) · eyes (primitivas + clip)
   projection (ojos 3D-ish: eyeYaw/foreshortening) · appendage (spring)
   aura (glow) · badge · partículas
   │
   ▼
③ ESTADO (situación)                src/runtime/states.js
   tabla: {tint, tintStrength, eyePose, badge, movement, glow, flags}
   │
   ▼
④ CAPAS TRANSVERSALES
   config (Defaults/Bounds/clamp)    src/core/config.js
   timeline (tweens por campo)       src/core/timeline.js
   policy (motion/action records)    src/runtime/policy.js
   presence (FSM de presencia)       src/runtime/presence.js
   │
   ▼
⑤ ACCIONES (secuencias + fx)        src/runtime/avatar-element.js
   play('success') → poses + partículas + bounce (token de cancelación)
   fx: barrido de error · warning por fases · nod · muelle jelly · bored
   │
   ▼
⑥ EXTENSIONES (plugins)             src/runtime/extension-host.js
   registerAvatarExtension({name, actions, beforePlay, afterPlay, reset, draw})
```

Separación clave: **el genoma nunca cambia durante la vida del avatar**; solo cambian
estado/acciones. `setSeed()` ⇒ regeneración completa (nueva identidad).

---

## 4. Esquema del genoma

```js
{
  shape:   { roundness: 0–100,          // cabeza del rig (0 cuadrado … 100 redondo)
             ratio: 0.88–1.12 },        // alto/ancho (solo aplasta, nunca estira)
  eyes:    { scale: 0.8–1.25,
             spacing: 0.28–0.42,   // 0.34 = plantilla exacta (86/154)
             yBias: -0.06–0.04 },  // ±10 px
  palette: { hue: 0–360,           // color base
             deepHue/sat/light,     // pasos del gradiente
             accentHue,             // acento (insignias, marcas)
             ink },                 // tinta de cabeza y párpados (oscura, derivada)
  marking: 'none'|'dots'|'stripe'|'orbit',
  appendage: 'none'|'antenna'|'sprout'|'ears',
  aura:    0–1,                    // intensidad del glow
  temperament: 0–1                 // ≤.35 calma · .35–.65 equilibrio · >.65 energía
}
```

Cada gen se escoge con el PRNG en orden fijo ⇒ determinismo verificable por test.
NOTA DE RUPTURA (2026-10-14): los genes anteriores (exponent/wobble/kind/corner/
style) se reemplazaron por el rig de 160 puntos — la misma semilla genera otro aspecto.

### Temperamento → parámetros de comportamiento

| Temperamento | blink (ms) | wander (amp) | idle bounce | gaze follow |
|---|---|---|---|---|
| calma | 3200–5600 | ±10 | 0 | suave |
| equilibrio | 2200–4400 | ±16 | sutil | medio |
| energético | 1400–3000 | ±24 | notorio | fuerte |

---

## 5. Tabla de estados (capa de situación)

Tabla estado→cfg con paleta, insignias y comportamientos propios, orientada a
los hooks del Cognitive Runtime de Ego:

| Estado | Tinte | Ojos | Insignia | Movimiento | Glow | Uso en Ego |
|---|---|---|---|---|---|---|
| `idle` | — | pose `idle` | — | respiración | 0.15 | en espera |
| `thinking` | violeta | pose `thinking` (mirada arriba-der.) | dots `•••` | sway lento | 0.55 | `UserPromptSubmit` |
| `working` | azul | `idle` | dots `•••` | micro-bounce | 0.6 | `Pre/PostToolUse` |
| `searching` | índigo | `wide` | dots `•••` | respiración + `scans` (barre `sin(t·2.6)`) | 0.55 | búsquedas/grep |
| `listening` | cian | `wide` | — | pulso de glow | 0.7 | streaming de entrada |
| `waiting` | ámbar | `idle` | — | orbita de mirada | 0.5 | tool call en curso (+ fx warning) |
| `success` | verde | `happy` | — | bounce + squash | 0.65 | acción completada (+ nod) |
| `finished` | menta | `happy` | dot `•` | respiración | 0.5 | `Stop` (vuelve solo a los 5.2 s) |
| `error` | rojo | `flat` | bang `!` | shake lateral | 0.65 | `StopFailure` (+ barrido de mirada + shake de cabeza) |
| `warning` | amarillo-caution | `warn` (estrechos, párpados bajos) | triángulo `⚠` | vaivén leve | 0.4 | **degradación tolerable**: una tool falló pero el turno continúa (`tool_error`) |
| `ratelimit` | naranja | `tired` (goteros caídos) | dot `•` | respiración + `sweat` | 0.45 | rate limit (Notification) |
| `approval` | naranja | `wide` | bang `!` | hop | 0.7 | `PermissionRequest` |
| `question` | turquesa | `idle` | `?` | tilt 8° | 0.6 | `Notification` |
| `dizzy` | rosa | `spiral` | — | respiración + `dizzyGaze` (`sin(t·9)`) | 0.5 | errores raros / recuperación |
| `sleeping` | gris | `closed` | — | respiración ×2 + `zz` (partículas Z) | 0.05 | inactividad / auto-sleep |

**Emotes** (capa transitoria con caducidad, estilo `eyeOverride`):
cada entrada porta `pose`, `duration` y opcionalmente `eyes` (override con
una CLAVE DE POSE — todo numérico, interpola sin cortes), `micro` y `sound`:

| Emote | Ojos | Micro | Sonido | Efecto |
|---|---|---|---|---|
| `love` | `happy` + óvalos inclinados lub-dub | `loveLift` | `love` | corazón + partículas |
| `surprised` / `surprise` | `surprise` | `surpriseLift` | `pop` | salto |
| `proud` / `cool` | `happy` | `proudTilt` / `loveRock` | `proud` | estrellas |
| `annoyed` / `angry` | `angry` | `annoyedHead` | `annoyed` | sacudida de cabeza |
| `wink` | un ojo con párpados de `sleep` | `winkTilt` | `wink` | guiño unilateral |
| `yawn` | `sleep` | `yawn` | `yawn` | partículas `z` |
| `happy` | `happy` | `happyBounce` | `blip` | rebote |
| `sad` | `sad` | `happyBlush` | `yawn` | oleaje suave |

No pisan el parpadeo. El estado `listening` usa la pose `input` (barra de
cursor parpadeante a 530 ms).

### 5-bis. El estado `warning`: degradación tolerable (Ola 2, 2026-10-20)

**Por qué existe.** La app ya tenía la SEÑAL pero no su REPRESENTACIÓN: el
renderer recibía `kind: "tool_error"` y el avatar caía en
`default: return "idle"` del mapa legacy. Es decir, **una tool que fallaba se
pintaba como un avatar en reposo**. `warning` cierra ese hueco: algo falló,
pero el turno continúa y el usuario debe verlo sin pensar que todo se ha
detenido.

**Cómo se diferencia de sus vecinos.** Un estado que se confunde con otro es
peor que no tenerlo, así que `warning` se separa en los cinco canales del
motor (tinte, pose, insignia, movimiento, aura):

| | `error` (fallo duro) | `ratelimit` (vocabulario del proveedor) | `warning` (degradación tolerable) |
|---|---|---|---|
| Tinte | rojo `hsl(352 85% 58%)` | naranja `hsl(27 96% 59%)` | **amarillo-caution `hsl(48 92% 55%)`** |
| Pose | `flat` (enfadada) | `tired` (agotada) | **`warn`** (estrecha y atenta) |
| Insignia | `!` | `•` | **`⚠` (triángulo propio)** |
| Movimiento | `shake` (agitado) | `breathe` | **`sway`** (inquieto, no agitado) |
| Aura / tinte | 0.65 / 0.6 | 0.45 / 0.55 | **0.4 / 0.4** (tenue) |

Tres decisiones concretas:

1. **El tono sale del cluster naranja.** Los estados cálidos vivos ocupan los
   tonos 27 (`ratelimit`), 30 (`approval`) y 35 (`waiting`); `warning` usa el
   **48**, el primer tono realmente distinto de la familia. El error está en
   352 (rojo), a 56° de distancia.
2. **La pose `warn` es nueva** (`src/runtime/poses.js`): ojos estrechados
   (48×52 frente a 54×58 del reposo) con párpados bajos pero **neutros**.
   Sin inclinación (nada de enfado → no es `angry`/`flat`, que son de `error`)
   y sin decaimiento (nada de agotamiento → no es `sleepy`/`tired`, que es de
   `ratelimit`). El rig es numérico, así que interpola sin conmutaciones.
3. **La insignia `warn` es nueva** (`src/render/parts.js`): un triángulo `⚠`
   dibujado con trazos propios —marco, barra y punto— en lugar de la `!` de
   error. Se distingue del resto **por la forma**, no sólo por el color (el
   círculo de la insignia es siempre el acento de la identidad).

**Sonido.** `STATE_SOUND.warning = 'tick'`. El catálogo de 28 sonidos **no
tiene ninguna receta de aviso** y no se inventa ninguna: `tick` es la más
breve y no alarmista (es la misma que usa la ACCIÓN `waiting`; el catálogo lo
comparten estados y acciones, y ambos sonidos pueden convivir).

**Puente studio.** El studio **ya tenía** un estado `warning` con una imagen
propia: un cartel ámbar con `!` (`studio/render/overlays.js`). El mapeo es
**1:1** (`EGO_TO_STUDIO_STATE.warning = 'warning'` y
`STUDIO_TO_EGO_STATE.warning = 'warning'`), así que el estado se conserva de
ida y de vuelta. Como consecuencia, `ratelimit` **deja de reclamar** esa
imagen y pasa a `bored` —el estado cansado del studio, que es exactamente lo
que `ratelimit` expresa en el motor SVG (pose `tired` + sudor). Así cada
imagen del studio corresponde a un único estado de Ego, y el dock no miente.
`EGO_SOUND_TO_STUDIO_SOUND.rate` pasa igual a `bored`, por coherencia.

---

### 5-ter. La paleta del avatar es DATO, no tema

> Verificado 2026-10-21 (Ola 4b, ítem 1.2).

El motor **no lee el tema del producto**: no consulta tokens, ni custom
properties de color, ni `getComputedStyle`. La única custom property que lee
es `--avatar-size` (tamaño del elemento, con valor por defecto). Es decir: los
colores del avatar son **datos del motor**, no una vista del design system.

Por eso un cambio de paleta en el tema (por ejemplo `warning` →
`oklch(0.837 0.164 84.4)`) **no puede alterar el render del avatar**. La
correspondencia entre ambos sistemas, medida:

| Sistema | `warning` | Hue |
|---|---|---|
| Tema del producto (`design-system.md` §2.4) | `oklch(0.837 0.164 84.4)` = `#FBBF25` = `hsl(43 96% 56%)` | 43° |
| Motor SVG (`runtime/states.js`) | `hsl(48 92% 55%)` | 48° |
| Motor canvas / studio (`studio/config.js`) | `#f59e0b` = `hsl(38 92% 52%)` | 38° |

Los tres caen en la **misma familia de tono** (±5°), de modo que el aviso se
lee igual en el producto y en el avatar, aunque sean sistemas independientes.
La regla para el futuro: **si el tema cambia un tono de estado, el motor
puede seguir al mismo tono, pero no depende de él**; el motor declara su color
y la golden (`geometry:check`, 231 combinaciones) es la que garantiza que el
render no se mueve.

## 6. Estructura del SVG (viewBox 0 0 240 240)

```
<g class="aura">          radial glow (genoma.aura × estado.glow)
<g class="appendage">     antenna/sprout/ears con spring propio
<g class="motion-group">  ← movimiento + jelly + micros (tilt/roll/squash)
  <g class="head-follow"> ← springs de puntero: translate ±4.2 px + rotate ±8°
    <g class="body-group">
      <path class="body">       plantilla de 160 pts (fill = tinta plana)
      <path class="tint">       overlay del color de estado
      <path class="marking">    clipPath de la cabeza
      <g class="eyes-clip">     clip de silueta
        <g class="eye L/R">     elipse blanca + barra input + párpados
      </g>
    </g>
  </g>
</g>
<g class="badge">         dots / bang / question (pop 90 ms → 280 ms back)
<g class="particles">     corazones/estrellas/chispas (emotes/acciones)
```

---

## 7. API del custom element

```html
<ego-avatar seed="subego:conocimiento" state="idle" size="120"></ego-avatar>
```

| Atributo | Default | Descripción |
|---|---|---|
| `seed` | `ego` | semilla de identidad (regenera al cambiar) |
| `state` | `idle` | estado inicial |
| `size` | `112` | px |
| `motion` | `auto` | `auto` \| `full` \| `reduce` (respeta prefers-reduced-motion) |
| `auto-sleep` | — | si está presente, duerme a los N ms de inactividad |
| `presence` | `home` | modo inicial de la FSM de presencia |
| `pointer-follow` | `true` | `true` \| `false` — mirada + cabeza siguen al puntero |
| `sound` | `true` | `true` \| `false` — motor procedural |
| `mode` | `svg` | `svg` \| `studio` — motor de render |

| Método | Descripción |
|---|---|
| `setState(name)` | transición de estado (tinte/pose/insignia/movimiento) |
| `play(action)` | `success` \| `error` \| `waiting` \| `inspect` \| `roll` \| `greet` \| 11 emotes; despierta si dormía |
| `notify(hook, {noAutoReturn?})` | hook del Cognitive Runtime → estado (`Stop` → `finished` con auto-retorno a los 5.2 s); despierta si dormía |
| `presence` | FSM: `.launch() .reveal() .click() .mouseEntered() .mouseLeft() .forceHome() .forceCompact() .forceHidden()` |
| `setSeed(seed)` | nueva identidad (regenera genoma + SVG) |
| `noteActivity()` | resetea el auto-sleep |
| `getGenome()` | genoma actual (solo lectura) |
| `setGene(path, value)` | fija un gen (`shape.roundness`, `eyes.scale`, `palette.hue`…) y reconstruye |
| `patchGenome(patch)` | parche profundo de varios genes |
| `resetGenome()` | limpia overrides, vuelve al genoma de la semilla |
| `setPointerFollow(on)` / `isPointerFollow()` | seguimiento de puntero |
| `mute(on?)` / `setSoundEnabled(on)` / `setSoundVolume(v)` / `getSoundVolume()` / `isMuted()` | sonido procedural (rango 0–0.2) |
| `playSound(name)` | una de las 28 recetas por nombre |
| `playMicro(name)` | una de las 21 micro-animaciones por nombre |
| `setMode(mode)` / `getMode()` | `svg` \| `studio` (re-monta preservando el estado) |
| `setStudioParam(k, v)` / `getStudioParam(k)` / `getStudioParams()` | parámetros visuales del motor studio |
| `applyStudioPreset(name)` | preset visual del studio |
| `speak(text, seconds?)` | habla en modo studio |
| `toSVGString()` | snapshot SVG estático (exportación; `''` en modo studio) |

| Evento | Payload |
|---|---|
| `state-change` | `{state, previous}` |
| `action-state` | `{action, phase: start/end/cancel, source}` |
| `presence-change` | `{state, previous}` (también `data-presence` en el elemento) |

---

## 8. Decisiones técnicas (sin preguntas pendientes)

1. **SVG inline + Web Component** sobre Canvas — exportable a string, nítido,
   accesible, sin paso de build. Un Canvas 2D exigiría rasterizar para exportar.
2. **JavaScript ESM + `.d.ts`** sin bundler — cero dependencias, corre tal cual
   en el navegador.
3. **Tests con `node --test`** sobre módulos puros (genoma, paleta, morph, estados)
   — el núcleo no toca DOM; el elemento es una cáscara delgada.
4. **Herencia visual del rig de referencia**: `vendor/` conserva los motores
   originales completos como referencia de porting; de uno se extrajeron
   algoritmos (timeline, presencia, micros, sonido) y del otro ADEMÁS
   el lenguaje visual (cabeza, ojos, poses — ver §9). Todo con atribución en
   cabecera y en LICENSE.md.
5. **Sonido procedural en vez de WAV**: el motor de referencia reproduce 28 WAV
   desde `/sounds/`; aquí cada receta es un oscilador/ruido/acorde Web Audio con
   la misma tabla de 28 nombres y el mismo mapa estado→sonido. Cero assets, cero
   red, funciona offline; el precio es un timbre sintético en lugar de samples.
6. **Genes estables por bloque**: el orden de extracción del PRNG dentro de
   cada bloque es fijo y documentado en `genome.js` (ruptura 2026-10-14: ver §4).
7. **Head-follow con deadband**: el spring de cabeza traduce ±4.2 px y rota ±8°
   con acoplo diagonal `nx·ny`; al perder el puntero vuelve al centro con los
   muelles de settle y un snap a cero bajo 0.01 (evita deriva perpetua).
   Se desactiva al arrastrar, aburrirse, actuar o dormir.
8. **Modificadores de ojo componibles**: nod/angry/bob/shake/love/inspect/orbit
   son funciones puras `(elapsed) → {dy, scale…}` que se suman/multiplican por
   frame — un emote y un estado pueden coexistir sin pisarse.
9. ~~**Tercer tipo de ojo**~~ — eliminado en la reunificación (era del motor
   procedural descartado).
10. **Locks reutilizados**: `startMicro` respeta `timeline.locked()` —
    un micro nunca interrumpe el tween que otro gesto ya posee; la demo los
    dispara por el hook público `playMicro(name)`.
11. **Reunificación del rig (2026-10-14)**: la cabeza y los ojos son los del rig
    de referencia (`ara-head.js` verbatim + rig de párpados + poses numéricas) —
    se eliminaron los 5 lenguajes procedurales anteriores, los modos heart/star,
    el blush y los trazos. `action-fx.js` + `expressions.js` se fusionaron en
    `fx-eyes.js` (envoltorio `{dx,dy,sx,sy,lid,done}`); las keys de cabeza viven
    en `micro.js` y `BORED_STEPS` en `pointer.js`: cada dato tiene UN solo hogar.
12. **Párpados del color de la cabeza**: el tinte de estado tiñe cabeza y lids
    juntos (`_paintTint` mezcla tinta→tinte) — si no, el tinte delata a los
    párpados como bandas.
13. **Amor con párpados fuera del camino**: en `love` los lids se deslizan a
    ±150 porque el grupo del ojo rota ±42° y cualquier párpado cercano cortaría
    los óvalos en diagonal.

## 8b. Robot Studio (motor canvas, 2026-10-14)

El single-file HTML original de referencia (4812 líneas: sintetizador de sonido
+ clase canvas del avatar + dock) se portó a `src/studio/` (ESM, cero deps):
`sound.js`, `config.js` (defaults, presets, 26 estados, acentos), `avatar.js`
(clase: update en pasos, draw en 7 capas, interacciones), `render/` (helpers,
body, visor, eyes, mouth, overlays, ears, accessories, particles), `rig/`
(eyes, hands), `adapter.js` (runtime→studio). Contrato: draws `(ctx, S, …)`,
updates `(S, dt)`; DOM tras guardias (`attachInteractions`/`startLoop`
explícitos). La demo `demo/robot-studio/` replica el dock sin CDN ni fuentes
externas (CSS local, offline). El motor SVG sigue vivo en paralelo (barrel
raíz); el studio tiene su propio barrel (`src/studio/index.js`).

### 8b-bis. Geometría propia de Ego (decisión D4, 2026-10-19)

El studio se había portado como transcripción del single-file HTML, con las
cabeceras "Puerto verbatim de avatar_studio_cx_artlab_mochi_2_0.html" y la
identidad visual de Mochi en el catálogo (preset `coucou-mochi`, estilo de ojo
`mochi-sphere`, estilo de boca `mochi-cute`, rama de cuerpo "blob" y LED rosa de
la vaina auditiva).

**D4 (owner):** sustituir esos puertos por geometría propia que mantenga el
comportamiento visual, y eliminar el preset `coucou-mochi`.

Qué se hizo:

| Cambio | Detalle |
|---|---|
| `src/studio/render/geometry.js` (nuevo) | **proporciones canónicas del robot de Ego**: chasis, panel trasero, reactor, vaina auditiva, accesorio, rubor y métricas de boca. Un solo hogar para las medidas que antes vivían dispersas como números mágicos heredados. |
| `src/studio/render/{body,ears,eyes,mouth,accessories}.js` | reescritos con la geometría propia; **eliminadas** las ramas de Mochi (cuerpo blob, LED rosa, ojo `mochi-sphere`, boca `mochi-cute`). |
| `src/studio/render/helpers.js` | re-elegido como capa de primitivas 2D genéricas (sin formas de robot); conserva el soporte `hsl`/`rgb` → hex. |
| `src/studio/config.js` | **eliminado** el preset `coucou-mochi`; el catálogo queda en `cx-faithful` + los cuatro presets de identidad de Ego (`ego-nucleus`, `ego-cyber`, `ego-sentinel`, `ego-architect`). |
| `src/studio/element-host.js` | fuera las redirecciones `coucou-mochi → cx-faithful`. |
| `src/studio/avatar.js` | `applyPreset` sin rama `coucou-mochi`; `mouthStyle` por defecto `led-wave`. |
| `src/runtime/avatar-element.js` | el comentario del preset `coucou-mochi` desaparece de la API pública. |
| Cabeceras | normalizadas al formato canónico `Adapted from <upstream> (MIT), <ruta>`, con la nota de qué es geometría propia. |

**La sustitución no movió geometría.** La prueba es determinista, no una
comparación de píxeles: `scripts/compare-geometry.mjs` registra todas las
llamadas al contexto de canvas y compara las trazas. La golden
`tests/golden/geometry.json` se generó a partir del código **anterior** a la
sustitución; el código actual coincide en **231/231 combinaciones**
(28 estados × 6 módulos de dibujo), sin una sola operación distinta.

> Por qué no se usa un diff de píxeles como prueba: comparando el **mismo**
> código en dos sesiones de navegador distintas se midió hasta un 12 % de
> píxeles distintos (rasterizado de canvas + acumulación del estado del motor).
> La traza de operaciones no tiene ese ruido.

### 8b-ter. Separación del elemento (2026-10-19)

`runtime/avatar-element.js` era un monolito (2360 líneas) que mezclaba el
contrato del elemento con la implementación de un renderizador. Se extrajeron:

| Módulo nuevo | Contenido |
|---|---|
| `runtime/studio-bridge.js` | el pegamento con el motor canvas: `isStudio`, `studioHost`, `mountStudio`, `setStateStudio`, `runEmoteStudio`. |
| `runtime/svg-export.js` | la serialización a SVG (`toSVGString`, `toSVGDocument`). |

La clase `StudioHost` (backend canvas) ya vivía en `studio/element-host.js`;
lo que se extrajo fue el glue. La extracción se verificó **sentencia a
sentencia** contra el original (65 sentencias idénticas en `mountStudio`) y con
los 302 tests en verde.

## 8c. Un solo elemento, dos motores (2026-10-14)

`<ego-avatar mode="svg"|"studio">` (defecto `svg`): el vocabulario del producto
(14 estados, 11 emotes, genoma, hooks, presencia, auto-sleep) es el contrato
público en ambos; solo cambia el render.
- En `studio`, un `StudioHost` (`src/studio/element-host.js`) crea el avatar
  canvas en un canvas del shadow DOM por import dinámico (el modo
  SVG no paga el coste), lo conduce con el loop del elemento y traduce
  estados/emotes/sonidos/micros/genes por `adapter.js`. El canvas se
  auto-encuadra (globalScale = min(w,h)/240) porque el avatar del studio mide
  ~240 px y el héroe suele ser menor.
- Las interacciones directas del canvas (poke→dizzy, box, spin) se re-adoptan
  por el mapa inverso `STUDIO_TO_EGO_STATE` (mejor esfuerzo) con evento
  `state-change`; los flujos por API conservan el vocabulario exacto.
- `toSVGString()` devuelve `''` en studio (no hay SVG); el volumen solo afecta
  al motor SVG (el sintetizador del studio usa mezcla fija); `setMode` y el
  atributo `mode` re-montan con el estado actual preservado.

### 8c-bis. El contrato del puente (Ego ⇄ studio)

El puente `src/studio/adapter.js` traduce el vocabulario de Ego (15 estados) al
del studio (26 estados de canvas). Su contrato es:

> **Para todo estado de Ego, el round-trip `Ego → studio → Ego` conserva la
> identidad.** El avatar nunca puede mostrar un estado distinto del que el
> chat pidió.

Cómo se cumple:

1. **Cada estado de Ego tiene un estado de studio PROPIO.** Ninguna imagen la
   comparten dos estados de Ego. Por eso el studio tiene 26 estados y no 22:
   los 4 que faltaban (`thinking`, `approval`, `question`, `ratelimit`) se
   añadieron con su color, su imagen y su sonido.
2. **Los estados de studio que nacen en el canvas** (poke, box, spin, wave,
   love, talk, send, failure, blocked, surprise, bored) no son imagen de ningún
   estado de Ego: el mapa inverso los lleva al de Ego más próximo. Para esos,
   la ida y la vuelta **no** son inversas y **no se pretende que lo sean**:
   el round-trip sólo se exige en el sentido Ego → studio → Ego.
3. **El acento por estado tiene UNA fuente** (`STATE_ACCENT` en
   `src/studio/config.js`). Antes el mismo `switch` estaba replicado en
   `render/overlays.js`, `render/eyes.js` y `render/helpers.js`: tres copias
   que había que mantener en sincronía a mano, y que se desincronizarían en
   cuanto se añadiera un estado. Ahora los tres módulos lo reexportan.

El contrato está fijado por **dos** capas:

| Puerta | Qué garantiza |
|---|---|
| `pnpm --filter @ego/avatar bridge:check` | Ningún mapa del puente nombra un estado de studio **inexistente** (comprueba el de estados, el de emotes y el de sonidos), no hay colisiones y el round-trip es 1:1. Es la puerta de la **desincronización** mapa↔catálogo. |
| `tests/studio-roundtrip.test.js` | Lo mismo como test (8 casos), con la comparación de **trazas de dibujo** del overlay: dos estados con dueño de Ego no pueden dibujar lo mismo. |
| `geometry:check` (golden) | Fija la geometría dibujada de cada estado, **overlay incluido** (231 combinaciones: 33 × 7). |

> **Por qué una puerta aparte.** El modo de fallo real de este puente no es que
> el mapa inverso falte, sino que **el mapa directo nombre un estado que el
> catálogo no tiene**: el motor cae a un `default` y el estado se pierde en
> silencio. Por eso `bridge:check` recorre *todos* los mapas que nombran
> estados del studio, no sólo el de estados.

> **Historia (por qué existían 4 pérdidas).** `thinking` y `approval`对企业
> la imagen `waiting` del studio (los puntos de espera), y `question`
> compartía `inspect` con `searching`. Como el mapa inverso sólo puede
> devolver un estado, tres se perdían. `ratelimit` era el cuarto: en la Ola 2
> se movió a `bored` para liberar la imagen `warning`, lo que lo dejó sin
> inversa propia. Los cuatro se han resuelto con estados de studio
> propios.

## 9. Identidad (rig de 160 puntos + rasgos propios)

- Cabeza: plantilla de 160 puntos + `roundness` 0–100 + `ratio` del genoma.
- Ojos: elipse blanca + párpados por números de pose + cursor de input;
  amor = óvalos inclinados lub-dub.
- Marca distintiva: **marking** (dots/stripe/orbit) derivado del genoma — rasgo
  exclusivo del producto.
- Paleta por hues del genoma con contraste de tinta garantizado (la tinta
  se oscurece hasta luminancia objetivo); cabeza y párpados comparten tinta.
- Insignias y partículas: símbolos universalmente estándar (••• ! ? ♥ ✦).

## 10. Ruta hacia Ego

- Un Sub-Ego = `seed = "subego:<id>"` → identidad estable persistible en VantaDB.
- Hooks del runtime → `setState()`: SessionStart→idle, UserPromptSubmit→thinking,
  PreToolUse→working, Stop→success, StopFailure→error, PermissionRequest→approval.
- Prioridad multi-agente para el avatar principal que resume a
  varios Sub-Egos: approval > question > error > working > success > idle.
- `toSVGString()` → miniaturas persistentes (widgets/listas) sin animación.

## Atribuciones legales

El rig visual y varios algoritmos provienen de código MIT de terceros.
Detalle completo en `LICENSE.md` (tabla por fichero), `NOTICE` (aviso de
terceros) y `LICENSE` (MIT del motor). **Los tres ficheros deben viajar con
toda copia** del motor: la cláusula MIT exige incluir el aviso de copyright, y
`src/render/ara-head.js` es una copia literal de código de `agent-robot-avatar`
(MIT, © CX ART Lab).

---

## 11. Estado real: este paquete es un fork del upstream

`packages/avatar/` **no es un espejo** de `repos-referencia/avatar/`. Es un
descendiente **bifurcado** de su *working tree* (el `HEAD` del upstream está
desfasado respecto a su propio working tree, y no se modifica).

De los 44 ficheros de `src/` del upstream: **19 byte-idénticos**,
**25 bifurcados** y **5 nuevos** (medido por hash, 2026-10-21).

| Situación | Ficheros |
|---|---|
| Byte-idénticos (19) | `core/{config,genome,morph,palette,prng}`, `{index,version}`, `render/{ara-head,body,eyes,shell}`, `runtime/{extension-host,pointer,policy}`, `studio/index`, `studio/render/{particles,visor}`, `studio/rig/{eyes,hands}` |
| Bifurcados (25) | `core/{anim,timeline}`, `render/{builder,parts,projection,static}`, `runtime/{avatar-element,fx-eyes,micro,poses,presence,sound,states}`, `studio/{adapter,avatar,config,element-host,sound}`, `studio/render/{accessories,body,ears,eyes,helpers,mouth,overlays}` |
| Nuevos (5) | `runtime/{avatar-element.d.ts,sound.d.ts,studio-bridge.js,svg-export.js}`, `studio/render/geometry.js` |

En **todos** los bifurcados **Ego va por delante**:

| Fichero | Divergencia |
|---|---|
| `runtime/avatar-element.js` | atributo `hands` (modo del rig de manos) con su ruta completa atributo → `setParam` → supervivencia al preset; `preset` pasa a ser un atributo observado; `toSVGString()` y `setPointerFollow()` exponen API pública; `ResizeObserver` propio; el host de studio y el export SVG se extraen (§8b-ter). |
| `runtime/states.js`, `runtime/poses.js`, `render/parts.js` | estado `warning` con su tinte, pose `warn`, insignia `warn`, movimiento y sonido. |
| `studio/render/helpers.js` | soporte `hsl`/`rgb` → hex canónico; `hexToRgba` y `shadeColor` extraídas y reutilizables; acento por estado importado de `config.js` (fuente única). |
| `studio/render/body.js` | geometría propia de Ego; rama de Mochi eliminada. |
| `studio/render/ears.js` | geometría propia de Ego; LED siempre de acento. |
| `studio/render/eyes.js` | geometría propia de Ego; familia `mochi-sphere` eliminada. |
| `studio/render/mouth.js` | geometría propia de Ego; estilo `mochi-cute` eliminado. |
| `studio/render/accessories.js` | cabecera y catálogo de accesorios de Ego. |
| `studio/render/overlays.js` | imágenes propias de los cuatro estados nuevos de studio. |
| `studio/config.js` | presets de identidad de Ego; `coucou-mochi` eliminado; 26 estados; `STATE_ACCENT` como fuente única del acento. |
| `studio/element-host.js` | presets de Ego; `applyGenomeToStudio`; DPR; `handsMode` en el host para sobrevivir a los presets. |
| `studio/avatar.js` | `applyPreset` con catálogo de Ego; casos de los cuatro estados nuevos. |
| `studio/adapter.js` | puente Ego↔studio 1:1 en las dos direcciones (15 estados de Ego, 26 de studio); `toHexColor` en la conversión de color del genoma. |
| `core/anim.js`, `core/timeline.js`, `render/projection.js`, `render/static.js`, `runtime/micro.js`, `runtime/presence.js`, `runtime/sound.js` | cabeceras de derivación normalizadas a rutas `vendor/…` **resolubles** (la cadena MIT no puede quedar colgando). |
| `core/timeline.js`, `render/builder.js`, `runtime/fx-eyes.js`, `runtime/micro.js` | tipos reales (JSDoc) que el `checkJs` exige; **sin cambio de comportamiento**. |

> **El registro canónico de la divergencia es
> [`upstream-divergence.json`](upstream-divergence.json)**: cada fichero
> declarado con su **motivo**, su **clase** (atribución · tipos · geometría ·
> estado · feature · fix) y el **hash aprobado** de su contenido. La puerta
> `scripts/check-upstream-divergence.mjs` falla si aparece una divergencia no
> declarada, si una declaración deja de ser verdad, o si cambia el contenido
> aprobado de un fichero declarado. El upstream es referencia de **solo
> lectura**: está en `.gitignore` y no se modifica.
>
> El detalle histórico completo vive en
> `docs/research/character-audit-and-coucou-inventory.md`.

## 11-bis. El modelo de atribución (dos planos) y su manifiesto

> Verificado y cerrado en la Ola 8 (2026-10-21).

El modelo canónico (`docs/extractions/README.md` §4.3) distingue dos planos que
no se pueden confundir:

| Plano | Qué es | Qué lleva |
|---|---|---|
| **1 · Código** (`packages/**`) | un fichero **realmente derivado** (un port literal de un repo de referencia) | cabecera `Adapted from <upstream> (<LICENCIA>), <ruta de origen>` + aviso en el `LICENSE.md` del paquete |
| **2 · Ficha** (`docs/extractions/*.md`) | documento de análisis **escrito por Ego** | fila de procedencia. **Nunca** `Adapted from` |

Y la regla que no se puede violar: **un fichero nativo no lleva esa
cabecera**. Inventarla sería una atribución falsa — el precedente `EGO-FIND-83`
(el owner retiró el crédito a `khoj` porque el código atribuido era propio).

### El manifiesto es el denominador

`provenance.manifest.json` declara, **fichero a fichero**, si el código es
derivado o nativo; y para cada derivado: su upstream, su licencia, su ruta de
origen, el camino intermedio (`via`) y la **evidencia** de la clasificación.

La clasificación no se además de la nada: se **midió** contra el clon de
referencia `repos-referencia/avatar` con dos instrumentos complementarios:

1. **Residuo de *shingles*** (48 caracteres sobre el texto normalizado, sin
   comentarios): da la fracción del fichero que sigue siendo texto del
   upstream. Cubre también el contenido de los literales de cadena (el punto
   ciego de una métrica por líneas).
2. **Literales y tablas**: para los ficheros que son una tabla de datos (por
   ejemplo `src/studio/config.js`), la prueba es que cada valor literal
   aparece en el fichero de origen.

El `LICENSE.md` del propio clon es además el registro de procedencia por
fichero del port, y se usó como contraste.

### Lo que reveal la medición

- La separación tiene un **hueco natural**: 3 ficheros a 0 % de residuo
  (nuevos de Ego: `runtime/studio-bridge.js`, `runtime/svg-export.js`,
  `src/studio/render/geometry.js`) frente a 36 ficheros entre el 26 % y el
  100 %.
- `src/render/ara-head.js` es el caso extremo: contiene el path SVG de 2411
  caracteres **idéntico byte a byte** al atributo `d` de `#headShape` en
  `vendor/agent-robot-avatar/core.js` (verificado).
- `src/studio/render/accessories.js` conserva el código del clon **idéntico**
  (366/366 líneas sin comentarios) pero su cabecera dice "geometría propia de
  Ego": la verdad es que **no** se sustituyó bajo D4. El manifiesto lo declara
  como derivado, que es lo correcto.
- `demo/robot-studio/*` **no** es un port de los bloques del single-file HTML
  (0 % de residuo contra el HTML completo): es una reescritura cuyo origen
  inmediato es el clon de referencia. El manifiesto lo dice así, en vez de
  repetir la fila histórica del `LICENSE.md` del clon.

### La puerta de D4: cero código verbatim

La puerta de atribución responde a `¿de quién es este código?`. Esta
responde a `¿queda código del upstream dentro?`.

`scripts/check-no-verbatim.mjs` mide el **residuo verbatim** con el mismo
método de la Ola 8 (`shingles` de 48 caracteres sobre el texto normalizado,
sin comentarios) y lo compara contra los **upstreams verdaderos**: el corpus
`vendor/` (los originales MIT) y el single-file HTML del motor canvas.

> **Por qué no se mide contra el clon de referencia**: el clon
> `repos-referencia/avatar/` es el paquete de Ego de una iteración anterior:
> mezcla código **propio** con ports. Medir contra él respondería a `¿queda
> código de la iteración anterior?`, no a `¿queda código del upstream?` — y un
> fichero totalmente propio (como `runtime/poses.js` tras D4) seguiría dando
> residuo por sus funciones propias.

El presupuesto vive en el manifiesto (`verbatim`) y lo vigila la puerta: los
seis ficheros de la decisión D4 tienen **presupuesto 0** — no pueden conservar
ni 48 caracteres del upstream. Su test es `tests/no-verbatim.test.js` (5
casos con *fixtures*).

### La puerta

`scripts/check-attribution.mjs` usa el manifiesto como denominador y falla si:

- un derivado **no** lleva cabecera canónica;
- la cabecera no tiene la forma exacta, o su upstream / licencia / ruta no
  cuadran con el manifiesto;
- **un nativo la lleva** (atribución falsa);
- un fichero en disco no está clasificado, o una entrada del manifiesto no
  existe;
- el `LICENSE.md` no recoge el aviso de un upstream en uso;
- alguna ruta `vendor/…` citada deja de resolver.

Es **reproducible**: `--fix` reescribe las cabeceras que falten o no cuadren a
partir del manifiesto, sin edición manual. Su test (`tests/attribution.test.js`)
la ejercita con 11 *fixtures*.

## 12. Verificación

| Puerta | Qué garantiza |
|---|---|
| `pnpm --filter @ego/avatar test` | 302 tests (`node --test tests/`): determinismo, genoma, rig ocular, poses, estados, config, timeline, política, presencia, puntero, fx, micros, sonido, elemento, studio, atributo `hands`, round-trip del puente. |
| `pnpm --filter @ego/avatar typecheck` | `tsc -p tsconfig.json` con `allowJs` + `checkJs`: el motor es JavaScript plano, pero **sí** se tipa. Exit 0 real (antes era un no-op). |
| `pnpm --filter @ego/avatar geometry:check` | la geometría dibujada no cambia respecto a la golden (231 combinaciones: 33 estados × 7 módulos). |
| `pnpm --filter @ego/avatar sync:check` | el paquete y la copia vendorizada son idénticos (SHA-256), incluidos los ficheros legales. |
| `pnpm --filter @ego/avatar attribution:check` | **puerta de atribución y de procedencia**: contra `provenance.manifest.json`, cada derivado lleva su cabecera canónica con el upstream/licencia/ruta correctos, ningún nativo la lleva, todo fichero de código está clasificado, el `LICENSE.md` recoge el aviso de cada upstream en uso y toda ruta `vendor/…` citada resuelve dentro del repo. |
| `pnpm --filter @ego/avatar bridge:check` | ningún mapa nombra un estado del studio inexistente y el round-trip Ego↔studio conserva la identidad (15/15). |
| `pnpm --filter @ego/avatar upstream:check` | toda divergencia frente al upstream está **declarada** con su motivo y su hash aprobado (§11). |
| `pnpm --filter @ego/avatar no-verbatim:check` | **puerta de la decisión D4**: los ficheros con presupuesto en el manifiesto no conservan **cero** código verbatim del upstream (shingles de 48 caracteres contra el corpus `vendor/` y el single-file HTML) |
| `pnpm --filter @ego/avatar build` | `dist/` reproducible, con manifiesto SHA-256 por fichero. |

### Defecto latente encontrado por el typecheck

`HybridRobotAvatar.impulse(sx, sy, vy, rot, vx)` acepta **cinco**
parámetros, pero **seis** llamadas le pasaban un sexto argumento que
**nunca se leía** (el valor se descartaba en silencio). Es un defecto
**preexistente del upstream** —los cuatro primeros casos ya estaban en el
single-file HTML original—, no una regresión. Se corrigió **eliminando el
argumento muerto** (comportamiento idéntico) en lugar de adivinar qué
significaba.

## 13. Deuda conocida

- El motor sigue siendo **JavaScript plano** con tipos públicos declarados en
  `index.d.ts`. El tipado es real (`checkJs`), pero no estricto; migrar el
  elemento a TypeScript eliminaría el `any` justificado de `studio-bridge.js` y
  `svg-export.js`.
- El corpus de atribuciones de terceros **vive en `packages/avatar/vendor/`** (31
  ficheros de `agent-robot-avatar`, `coucou` y `coucou-swift`, copia literal).
  Está en el repositorio —y no en `repos-referencia/avatar/vendor/`, que está
  en `.gitignore`— precisamente para que **toda ruta citada en `LICENSE.md` y
  en las cabeceras de `src/` resuelva** y la cadena MIT sea auditable. No es
  dependencia de runtime (cero imports reales, verificado por
  `scripts/check-attribution.mjs`).
