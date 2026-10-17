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

---

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
`sound.js`, `config.js` (defaults, presets, 22 estados, acentos), `avatar.js`
(clase: update en pasos, draw en 7 capas, interacciones), `render/` (helpers,
body, visor, eyes, mouth, overlays, ears, accessories, particles), `rig/`
(eyes, hands), `adapter.js` (runtime→studio). Contrato: draws `(ctx, S, …)`,
updates `(S, dt)`; DOM tras guardias (`attachInteractions`/`startLoop`
explícitos). La demo `demo/robot-studio/` replica el dock sin CDN ni fuentes
externas (CSS local, offline). El motor SVG sigue vivo en paralelo (barrel
raíz); el studio tiene su propio barrel (`src/studio/index.js`).

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
Detalle completo en `LICENSE.md`.
