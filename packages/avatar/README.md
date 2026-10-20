# Ego Avatar / Robot Studio

**Avatares generativos deterministas para Ego — cero dependencias, ESM puro, Web Component.**

> `seed → genoma → organismo vivo` — cada avatar recibe una identidad única
> generada de su semilla, y ese organismo **cambia** con los estados
> (thinking, working, error, approval…).

Un solo elemento, dos motores de render:

- **SVG** (defecto): organismo generativo por semilla — cabeza paramétrica de
  160 puntos, redondeo 0–100, ojos con párpados por poses numéricas, genoma
  propio (tinta, marca, apéndice, aura), 14 estados y 11 emotes.
- **Studio** (canvas, `mode="studio"`): 22 estados, 9 estilos de ojo, 5 bocas
  con lip-sync, 16 accesorios, manos articuladas de 5 dedos, visor, partículas
  y habla (burbuja + sonido).

Investigación externa (DiceBear, boring-avatars, Shape of AI, shape language…)
en [`RESEARCH.md`](RESEARCH.md); principios y tablas en [`DESIGN.md`](DESIGN.md).

---

## Inicio rápido (sin instalación)

No hay nada que instalar: sirve la carpeta con cualquier servidor estático.

```bash
npm run demo   # → http://localhost:5199/demo/robot-studio/
```

Equivalente manual: `npx --yes serve -l 5199 .` y abre
`http://localhost:5199/demo/robot-studio/` (Robot Studio, la demo del producto).

```html
<script type="module" src="./src/index.js"></script>

<ego-avatar mode="studio" seed="ego:demo" state="idle" size="140"></ego-avatar>

<script>
  const avatar = document.querySelector('ego-avatar');
  avatar.setState('thinking');          // tinte violeta + ••• + mirada ↑der
  avatar.play('success');               // estado temporal con retorno automático
  avatar.play('love');                  // emote: corazones + mejillas
  avatar.notify('PermissionRequest');   // hook del runtime → estado approval
  avatar.notify('Stop');                // → finished, vuelve solo a los 5.2 s
  avatar.presence.forceHome();          // FSM de presencia: hidden/compact/home/greet
  avatar.setSeed('ego:otro');           // nueva identidad (regenera todo)
  avatar.speak('Hola', 3);              // habla (motor studio; burbuja + boca)
  avatar.applyStudioPreset('ego-nucleus'); // preset visual del studio
</script>
```

Modo SVG (defecto) — identidad por semilla + snapshot exportable:

```html
<ego-avatar seed="subego:conocimiento" state="idle" size="120"></ego-avatar>

<script>
  const svg = document.querySelector('ego-avatar').toSVGString(); // miniaturas/widgets
</script>
```

## Compatibilidad de navegadores

Navegadores evergreen recientes (Chrome/Edge, Firefox, Safari): el elemento usa
Custom Elements v1 + Shadow DOM, módulos ESM, Canvas 2D y Web Audio. Sin build,
sin transpilación, sin polyfills. El audio requiere gesto del usuario en algunos
navegadores (política de autoplay); sin `AudioContext` el sonido es no-op seguro.
`toSVGString()` devuelve `''` en modo studio (el canvas no es SVG).

---

## Cómo funciona

```
seed ──xmur3──► mulberry32 ──► ① GENOMA (inmutable)
                                 shape{roundness,ratio} · eyes{scale,spacing,yBias}
                                 palette{hue…} · marking · appendage · aura
                                        │
                                        ▼
                                 ② FENOTIPO (SVG, se construye 1 vez)
                                 cabeza paramétrica +4 gradientes + marking + ojos + aura
                                        │
        ┌───────────────────────────────┼────────────────────────┐
        ▼                               ▼                        ▼
   ③ ESTADOS (tabla)            ④ ACCIONES (token)       ⑤ EXTENSIONES (plugins)
   states.js — tinte,pose,      play(success|error|…)     registerAvatarExtension(
   insignia,movimiento,glow     emotes con caducidad       name, actions, draw…)
```

- **P1 determinismo**: misma semilla ⇒ mismo avatar, byte a byte (test incluido).
  `Math.random()` solo en comportamiento *runtime* (parpadeo/mirada), nunca en identidad.
- **P4 morfometría**: el SVG nunca se redibuja; el loop a 30 fps muta atributos
  (rx/ry de ojos, transform del cuerpo, tinte, insignia, partículas).
- **P7 cancelación**: `play()` usa generation token — `setState()` lo cancela sin carreras;
  los registros de acción (`begin/finish/cancel`) emiten `action-state` una sola vez por fase.
- **P8 framerate-invariant**: mirada `k = 1 − 0.0025^dt`; springs sub-stepped a 240 Hz;
  muelle *jelly* de impacto (slot spring: ω₀ = 2π/0.25, ζ = 0.6).
- **Mirada proyectada**: cada ojo se desplaza/comprime según `cos(eyeYaw)` (parallax 3D-ish)
  y queda recortado a la silueta del cuerpo (`clipPath`).

## Estados

`idle · thinking · working · searching · listening · waiting · success · finished · error · ratelimit · approval · question · dizzy · sleeping`

Con tinte, pose, insignia (`•••` `•` `!` `?`), movimiento (breathe/bounce/sway/hop/shake/tilt/pulse/orbit),
glow y *flags* de comportamiento propios: `scans` (barre la mirada), `dizzyGaze`
(`sin(t·9)`), `zz` (partículas Z de sueño), `sweat` (gotas de sudor).
Mapeo de hooks del runtime en `HOOK_STATE_MAP` (`UserPromptSubmit→thinking`,
`Stop→finished` con auto-retorno a los 5.2 s, `StopFailure→error`,
`PermissionRequest→approval`…) — ver `HOOK_AUTO_RETURN`.

El vocabulario del **studio** es más amplio (22 estados) y se traduce con
`EGO_TO_STUDIO_STATE` / `STUDIO_TO_EGO_STATE` (`src/studio/adapter.js`).

## Genoma (identidad)

```js
{ shape: { roundness: 0–100, ratio: 0.88–1.12 },  // cabeza: cuadrado…redondo
  eyes:  { scale: 0.8–1.25, spacing: 0.28–0.42, yBias: −0.06–0.04 },
  palette: { hue, sat, accentHue, … },              // tinta siempre oscura (contraste)
  marking: none|dots|stripe|orbit,                  // rasgo distintivo
  appendage: none|antenna|sprout|ears,
  aura, temperament }                               // temperament → blink/wander/bounce
```

## Estructura

```
packages/avatar/
├── RESEARCH.md            investigación (internet + motores de referencia, con URLs)
├── DESIGN.md              principios (P1–P10), esquema de genoma, tabla de estados,
│                          estado real del fork y divergencias documentadas
├── LICENSE                MIT del motor (obligatorio en toda copia)
├── LICENSE.md             tabla de atribuciones por fichero (obligatoria)
├── NOTICE                 atribuciones de terceros en formato de aviso
├── index.d.ts             tipos públicos del paquete
├── tsconfig.json          typecheck real (allowJs + checkJs)
├── src/
│   ├── core/              prng · genome (roundness) · palette · morph
│   │                      config (Defaults/Bounds/clamp)
│   │                      timeline (tweens por campo + buildPhases)
│   ├── render/            builder · body (plantilla 160 pts + roundness) · eyes
│   │                      (rig blanco+párpados) · ara-head (plantilla verbatim)
│   │                      · parts · shell · static (pose por hash djb2)
│   ├── studio/            motor canvas Robot Studio (config, avatar, render/,
│   │                      rig/, sound, adapter, element-host) + barrel `./studio`
│   │   └── render/        geometry.js = proporciones canónicas de Ego
│   └── runtime/           states (11 emotes + STATE_SOUND) · poses (tabla numérica)
│                          · avatar-element · studio-bridge · svg-export
│                          · policy (action records/auto-sleep/reduced-motion)
│                          · presence (FSM hidden/compact/home/greet)
│                          · fx-eyes (matemática ocular) · pointer (puntero/wander/
│                          bored/head-follow) · micro (21 keyframes + keys de cabeza)
│                          · sound (28 recetas Web Audio procedurales, cero assets)
├── demo/robot-studio/     Robot Studio (única demo del producto)
├── vendor/                **corpus de atribución (solo lectura)**: copias
│                          literales de las obras de terceros de las que
│                          derivan partes de `src/`. NO es código de runtime
│                          y NO debe importarse. Ver `vendor/README.md`.
├── captures/
│   ├── harness/           arnés de captura determinista del studio
│   ├── before/            capturas de referencia (antes de un cambio)
│   └── after/             capturas tras el cambio
├── scripts/               build · sync-check · capture-visuals · capture · compare-*
├── tests/                 266 tests (node --test) + golden/geometry.json
└── dist/                  artefacto de build (generado, ignorado por git)
```

## API

| | |
|---|---|
| `setState(name, {immediate?})` | transición de estado (evento `state-change`) |
| `play(action, {source?, duration?})` | acciones `success`/`error`/`waiting`/`inspect`/`roll`/`greet` (temporales con fx) o emotes `love`/`surprised`/`proud`/`annoyed`/`wink`/`yawn`/`happy`/`angry`/`surprise`/`sad`/`cool` — evento `action-state {action, phase, source}`. Despierta al avatar si dormía |
| `notify(hook, {noAutoReturn?})` | hook del Cognitive Runtime → estado; `Stop` vuelve solo tras 5.2 s. También despierta |
| `presence` | FSM de presencia: `.launch() .reveal() .click() .mouseEntered() .mouseLeft() .forceHome() .forceCompact() .forceHidden()` — emite `presence-change` y `data-presence` |
| `setSeed(seed)` / `getGenome()` | nueva identidad / genoma congelado |
| `setGene(path, value)` / `patchGenome(patch)` / `resetGenome()` | edita genes sueltos (`shape.roundness`, `eyes.scale`, `palette.hue`…) y reconstruye la identidad |
| `setPointerFollow(on)` / `isPointerFollow()` | mirada + cabeza siguen al puntero (on por defecto) |
| `mute(on?)` / `setSoundEnabled(on)` / `setSoundVolume(v)` / `getSoundVolume()` / `isMuted()` | sonido procedural (volumen canónico 0–0.2) |
| `playSound(name)` | reproduce una de las 28 recetas por nombre |
| `playMicro(name)` | dispara una de las 21 micro-animaciones por nombre |
| `toSVGString()` | snapshot SVG exportable (miniaturas/widgets; `''` en modo studio) |
| `setMode(mode)` / `getMode()` | motor de render: `'svg'` (defecto) o `'studio'` (canvas: 22 estados, 9 ojos, 5 bocas, manos, visor) |
| `setStudioParam(k, v)` / `getStudioParam(k)` / `getStudioParams()` | parámetros visuales del motor studio |
| `applyStudioPreset(name)` | aplica un preset visual del studio (`cx-faithful`, `ego-nucleus`, `ego-cyber`, `ego-sentinel`, `ego-architect`) |
| `speak(text, seconds?)` | habla en modo studio (burbuja + boca + sonido) |
| `reset()` · `getState()` | utilidades |
| atributos | `seed` `state` `size` `motion`(`auto\|full\|reduce`) `auto-sleep` `presence` `pointer-follow` `sound` `mode`(`svg\|studio`) `preset` |
| config global | `configure({fps, blinkMinMs, autoSleepMs, gazeGain, jellyResponse…})` — toda cifra acota a `AVATAR_BOUNDS` |
| estático | `staticSVG(seed, {state, emote, pose: 'hash'})` — pose por hash djb2 |
| studio (import) | `import { HybridRobotAvatar } from './src/studio/index.js'` — clase canvas + `SoundSynthesizer`, tablas `STUDIO_STATES`/`EYE_STYLE_NAMES`/`MOUTH_STYLE_NAMES`/`ACCESSORY_NAMES` |

Extensiones: `registerAvatarExtension({name, actions, beforePlay, afterPlay, reset, draw})`.

## Ruta hacia Ego

1. Sub-Ego ⇒ `seed = "subego:<id>"`, persistir el id en VantaDB (el genoma se regenera).
2. Hooks del runtime ⇒ `avatar.notify(hook)` (tabla ya mapeada).
3. Avatar principal multi-Sub-Ego ⇒ `resolveState()` con prioridad
   approval > question > error > working > … > idle.
4. Listas/widgets ⇒ `staticSVG(seed, {state})` sin DOM ni animación.

---

## Las tres copias (decisión del owner, 2026-10-19)

Hay **tres** copias del motor en el repo, y se mantienen a propósito:

| Copia | Ruta | Papel |
|---|---|---|
| Upstream | `repos-referencia/avatar/` | referencia (clon). **No se modifica ni se commitea**: su working tree está sucio y su `HEAD` está desfasado respecto a la copia de Ego. Material de estudio. |
| **Paquete** | `packages/avatar/` | **canónico**. Se empaqueta, se documenta y se verifica. |
| Vendorizada | `apps/desktop/renderer/floating/vendor/avatar/` | la que el renderer carga de verdad (import literal dentro del root servido, requisito de `FIND-12-01`). Debe ser **byte-idéntica** al paquete. |

Este paquete es un **descendiente bifurcado** del *working tree* de upstream, no
un espejo: de los 44 ficheros de `src/` del upstream, **28 son byte-idénticos**,
**16 están bifurcados** (Ego va por delante) y **5 son nuevos** (no existen
upstream). El detalle fichero a fichero está en
[`DESIGN.md`](DESIGN.md) § *Estado real: este paquete es un fork del upstream*.

La divergencia silenciosa entre las tres copias es el riesgo real de este
diseño, así que hay una **puerta verificable por SHA-256**:

```bash
pnpm --filter @ego/avatar sync:check   # exit 1 si el paquete y la copia vendorizada divergen
pnpm --filter @ego/avatar sync:write   # realinea la copia vendorizada desde el paquete
```

La puerta compara además los ficheros legales (`LICENSE`, `LICENSE.md`,
`NOTICE`) y el corpus de atribución (`vendor/`): si una copia lleva la licencia
y la otra no, también falla.

### Estado honesto: qué copia ejecuta el runtime

| | Ruta | ¿Quién la usa? |
|---|---|---|
| **Canónica** | `packages/avatar/` | Es el paquete que se empaqueta, se documenta y se verifica. **Hoy nadie lo importa**: `grep -rn "@ego/avatar" apps packages` → 0 resultados. |
| **Vendorizada** | `apps/desktop/renderer/floating/vendor/avatar/` | **La que ejecuta el runtime.** `CharacterBadge.tsx:13` y `floating-avatar.tsx:70` importan el Web Component desde aquí, por un specifier **literal** dentro del root servido (requisito de `FIND-12-01`: `import(CONST)` no lo analiza Vite y produce un 404 en producción). |

Es decir: **el paquete es canónico en el papel, y la copia vendorizada es la
que corre**. Es la consecuencia directa de mantener las tres copias (decisión
del owner, D5). Cablear el paquete como canónico exige tocar
`CharacterBadge.tsx` y `floating-avatar.tsx` — y el flotante **seguirá
necesitando** el specifier literal, así que la vendorización del flotante no
se elimina aunque el resto migre. La diff exacta que A4 debe aplicar está en
el handoff A6 de la ola de remediación.

### La cadena de atribución MIT

`vendor/` es un **corpus de atribución de solo lectura**: copias literales de
las obras de terceros de las que derivan partes de `src/`. **No es código de
runtime y no debe importarse** (el motor tiene 0 dependencias y no importa de
ahí). Está en el repositorio —y no sólo en `repos-referencia/`, que está
ignorado por git— para que **toda ruta citada en `LICENSE.md` y en las
cabeceras de `src/` resuelva** y un auditor pueda seguir la cadena.

```bash
pnpm --filter @ego/avatar attribution:check   # exit 1 si alguna referencia queda colgando
```

## Scripts y verificación

| Comando | Qué hace |
|---|---|
| `pnpm --filter @ego/avatar test` | 266 tests (`node --test tests/`) |
| `pnpm --filter @ego/avatar typecheck` | `tsc -p tsconfig.json` (`allowJs` + `checkJs`), exit 0 real |
| `pnpm --filter @ego/avatar build` | copia `src/` → `dist/` + `index.d.ts` y escribe `dist/build-manifest.json` (SHA-256 por fichero) |
| `pnpm --filter @ego/avatar build:check` | verifica que `dist/` está al día |
| `pnpm --filter @ego/avatar geometry:check` | **puerta geométrica**: compara la traza de operaciones de canvas contra la golden `tests/golden/geometry.json` (168 combinaciones: 28 estados × 6 módulos) |
| `pnpm --filter @ego/avatar sync:check` | puerta de sincronización SHA-256 entre el paquete y la copia vendorizada (incluye el corpus de atribución) |
| `pnpm --filter @ego/avatar attribution:check` | **puerta de atribución**: toda ruta citada en `LICENSE.md` y en las cabeceras de `src/` resuelve dentro del repo (exit 1 si alguna queda colgando) |
| `pnpm --filter @ego/avatar capture:visuals` | capturas PNG del studio (registro visual) |

### La puerta geométrica, y por qué no se fía de los píxeles

`compare-geometry.mjs` registra **todas** las llamadas al contexto de canvas
(`arc`, `ellipse`, `fillRect`, gradientes…) y compara las trazas. Es
determinista al 100 %: la misma entrada produce siempre la misma traza, sin
navegador.

La alternativa —comparar PNG— **no sirve como puerta**: comparando el mismo
código en dos sesiones de navegador distintas se ha medido hasta un **12 % de
píxeles distintos** (rasterizado de canvas, acumulación del estado del motor).
Un gate basado en hashes daría falsos rojos; uno basado en un umbral de píxeles
daría falsos verdes. La golden de geometría resuelve las dos cosas: es
determinista y verifica la forma real, no su antialiasing.

La golden se generó a partir del código **anterior** a la sustitución de la
geometría (D4), de modo que el código actual demuestra que la sustitución no movió
ni un píxel de geometría.

## Atribuciones legales

Este producto integra código MIT de terceros (motores de referencia) y código
adaptado de un single-file HTML. El detalle por fichero está en
[`LICENSE.md`](LICENSE.md); el aviso de terceros, en [`NOTICE`](NOTICE); la
licencia del motor, en [`LICENSE`](LICENSE).

**Ninguna copia del motor puede publicly distribuirse sin esos tres ficheros.**

## Estadísticas

- **266 tests** · `node --test tests/` — determinismo byte a byte, cabeza
  (plantilla 160 pts + roundness 0–100), rig ocular (párpados por pose,
  input-bar, amor), poses numéricas sin conmutaciones, estados, config/Bounds,
  timeline, política, FSM de presencia, puntero, fx-eyes unificados, micros,
  sonido, contrato DOM-free del elemento, guards de robustez, studio (config,
  sonido, ojos, boca+manos, avatar headless, adaptador, modo dual del elemento
  con passthrough de parámetros/presets/habla y estados crudos) — y demo
  verificada (0 errores).
- **168 combinaciones geométricas** verificadas contra la golden.
- **0 dependencias** (runtime y dev).
