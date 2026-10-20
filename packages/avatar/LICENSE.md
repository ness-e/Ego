# Licencias y atribuciones

`ego-avatar` es un proyecto **original** de síntesis. Su código es MIT.
Este documento registra todo lo derivado de repos de referencia y fuentes externas.

> **Nota:** `vendor/` es solo referencia — sus módulos conservan los nombres de
> archivo originales y no están pensados para ejecutarse; el código que corre es
> `src/` (síntesis propia) más `src/studio/` (port ESM, cero dependencias, del
> single-file HTML original conservado en la raíz del repo). Ninguna entrada de
> las tablas de abajo se ha eliminado ni se eliminará: la atribución a cada
> módulo portado es un requisito permanente.

## Código embebido en `vendor/` (copia directa)

| Archivo | Origen | Licencia | Autor |
|---|---|---|---|
| `vendor/agent-robot-avatar/*.js` (16 módulos: `core.js`, `runtime.js`, `actions.js`, `random.js`, `extension-host.js`, `geometry.js`, `head-roundness.js`, `wrap.js`, `gestures.js`, `antenna.js`, `antenna-flash.js`, `love.js`, `inspect.js`, `waiting.js`, `failure.js`, `version.js`) | `agent-robot-avatar/src/*` (completo) | MIT | © CX ArtLab |
| `vendor/coucou/core/{anim,bridge,layout,state,sound}.ts` · `vendor/coucou/island/{fsm,hooks}.ts` · `vendor/coucou/mochi/{engine,greeting,minibots}.ts` | `coucou/windows/src/*` (motor completo, isla y hooks) | MIT | © Louis Raillart |
| `vendor/coucou-swift/{BotEngine,MochiActivityState,MochiOutfitDrawing,MochiStill,MochiWardrobe}.swift` | `coucou/` (motor Swift original: pose por hash, wardrobe, stills) | MIT | © Louis Raillart |

Estos archivos se conservan **tal cual** como referencia de porting/adaptación.
Sus imports internos usan los nombres originales de archivo (`./agent-robot-avatar-core.js`
etc.) y `gestures.js` es un módulo de efectos sin exports — **no están pensados
para ejecutarse**, solo para consulta.

## Código adaptado (reescrito en este proyecto con atribución en cabecera)

| Archivo de ego-avatar | Derivado de | Licencia |
|---|---|---|
| `src/core/anim.js` | `coucou/windows/src/core/anim.ts` (Ease/cubicBezier/Spring/Tracked → JS ESM) | MIT © Louis Raillart |
| `src/core/config.js` | `agent-robot-avatar/src/agent-robot-avatar-random.js` (`RANDOM_DEFAULTS/BOUNDS` + clampConfig, variante canónica) y `core.js` (`parseSize` literal) | MIT © CX ArtLab |
| `src/core/timeline.js` | `coucou/mochi/engine.ts` (`anim()`/`update()` tracks por campo con locks) y `agent-robot-avatar/actions.js` (`buildPhases` cursor acumulado) | MIT © Louis Raillart / CX ArtLab |
| `src/render/projection.js` | `coucou/mochi/engine.ts` `drawEyes()` (eyeYaw/foreshortening/umbral 0.04/piso 0.18, normalizado al reposo) | MIT © Louis Raillart |
| `src/runtime/policy.js` | `agent-robot-avatar/src/agent-robot-avatar-runtime.js` (`requestedMotion/reducedMotion`, action records `begin/finish/cancel/emitActionState`, `scheduleAutoSleep`) | MIT © CX ArtLab |
| `src/runtime/presence.js` | `coucou/windows/src/island/fsm.ts` (`IslandStateMachine`: hidden/compact/home/greet, delays 15/60/0.6/10 s, pinned) | MIT © Louis Raillart |
| `src/runtime/action-fx.js` — ELIMINADO en la reunificación (su contenido vive en `fx-eyes.js`, `micro.js` y `pointer.js`) | `agent-robot-avatar/actions.js` | MIT © CX ArtLab |
| `src/runtime/expressions.js` — ELIMINADO en la reunificación (fusionado en `fx-eyes.js`) | `agent-robot-avatar` CORE:999-1037, `inspect.js`, `love.js`, `waiting.js`, `failure.js` | MIT © CX ArtLab |
| `src/render/shapes.js` — ELIMINADO en la reunificación (lenguaje coucou descartado) | `coucou/mochi/engine.ts:685-711` | MIT © Louis Raillart |
| `src/runtime/fx-eyes.js` | `agent-robot-avatar/actions.js` (barrido + warning literales) + CORE:999-1037, `inspect.js`, `love.js`, `waiting.js`, `failure.js` (mismo contenido reunificado bajo el envoltorio `{dx,dy,sx,sy,lid,done}`) | MIT © CX ArtLab |
| `src/runtime/micro.js` (+ keys de cabeza) | `coucou/mochi/engine.ts` (tablas + `locks`) + `agent-robot-avatar/actions.js:160-164,208-213,243-251` (`nodKeys`/`errorHeadKeys`/`warningHeadKeys`) | MIT © Louis Raillart / CX ArtLab |
| `src/runtime/pointer.js` (+ `BORED_STEPS`) | `agent-robot-avatar` CORE:368-383 (puntero), CORE:922-948 (wander + `kL`), CORE:955-1043 (springs de cabeza) + `actions.js:268-275` (aburrimiento) | MIT © CX ArtLab |
| `src/render/ara-head.js` (plantilla VERBATIM 160 pts) | `agent-robot-avatar/core.js:261` (`#headShape d`) | MIT © CX ArtLab |
| `src/render/body.js` (aplastado + redondeo) | `agent-robot-avatar/geometry.js` (`flattenHeadPoints`) + `head-roundness.js` (`superellipsePoint/targetShape/mixPoints/setHeadRoundness`) | MIT © CX ArtLab |
| `src/render/eyes.js` (rig blanco + párpados) | `agent-robot-avatar/core.js:270-285` (plantilla), CORE:1046-1103 (`setEye`: edge squeeze, lids, spread) | MIT © CX ArtLab |
| `src/runtime/poses.js` (tabla numérica) | `agent-robot-avatar/core.js:8-57` (POSES verbatim: idle/happy/sad/angry/sleepy/input/sleep/surprise) | MIT © CX ArtLab |
| `src/runtime/extension-host.js` | `agent-robot-avatar/src/agent-robot-avatar-extension-host.js` (mismo patrón, runner functions) | MIT © CX ArtLab |
| `src/render/static.js` (djb2/poseForSeed) | `coucou/` `MochiStill.swift` (pose estable por hash djb2) | MIT © Louis Raillart |
| `src/runtime/sound.js` | `coucou/windows/src/core/sound.ts` (28 nombres, volumen 0.12/[0,0.2], idle 1500 ms) + `mochi/engine.ts:106-110` (`STATE_SOUND`); recetas 100 % sintetizadas (el original usa 28 WAV) | MIT © Louis Raillart |
| `src/runtime/states.js` (`EMOTES` ×11, `STATE_SOUND`, `EMOTE_SOUND`) | `coucou` `triggerEmote` / `EMOTE_EYE` / `STATE_SOUND` (engine.ts:106-110) + overrides con poses ARA | MIT © Louis Raillart / CX ArtLab |
| `src/studio/*` (motor canvas completo) | `avatar_studio_cx_artlab_mochi_2_0.html` (archivo del usuario: SoundSynthesizer + HybridRobotAvatar + dock, port verbatim a ESM) | según archivo de origen (single-file del usuario) |
| `demo/studio/*` (dock offline; consolidado en `demo/robot-studio/` en 2026-10-15, fila histórica) | mismo archivo, bloques HTML 79-606 + wiring 4131-4810 (sin Tailwind CDN ni Google Fonts) | según archivo de origen |

## Patrones e ideas (sin copia de código ni de diseño)

De **agent-robot-avatar** (MIT, CX ArtLab):
- Plantilla SVG inmutable + morfometría de poses.
- Cancelación de secuencias por generation token.
- Capa de política separada (reduced-motion, auto-sleep, `action-state` con registros).
- Config con Defaults + Bounds; superelipse para shape language.
- Fases desde tablas de tiempos (`buildPhases`), fx de acciones (barrido de mirada
  del error, ojos de warning por fases, keyframes de cabeza, rutina de aburrimiento).

De **coucou** (MIT, Louis Raillart):
- Tabla estado → cfg (`BotStateCfg`) y mapeo evento-herramienta → estado (+ auto-retorno).
- Ojos proyectados sobre la silueta (`drawEyes`); glow fuera del cuerpo.
- Parpadeo orgánico aleatorio (2.2–5.4 s, 22 % doble); mirada con suavizado invariante al framerate.
- Tracker de tweens por campo (`anim()` con locks) y muelle de slot (ω₀/ζ).
- FSM de presencia de la isla (hidden/compact/home/greet con temporizadores).
- Partículas ambiente (zz/sweat), pose estática por hash djb2 (`MochiStill`).
- Prioridad de urgencia multi-agente; emotes transitorios con caducidad.

> **Nota de identidad visual:** el *look* de Mochi (coucou) **NO** se reproduce
> aquí; en cambio la cabeza, los ojos y las poses **SÍ** son los del robot de
> CX ArtLab (con atribución en cada cabecera y en la tabla de arriba). La
> identidad propia la ponen el genoma (tinta, marking, apéndice, aura), los
> 14 estados de Ego y la tabla de hooks.

## Fuentes externas consultadas (investigación)

Ver `RESEARCH.md` — incluye Shape of AI, DiceBear, boring-avatars, artículos de
shape language y procedural generation (todas con URL).

## Licencia del código de este proyecto

MIT — ver `LICENSE`.
