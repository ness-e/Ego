# Licencias y atribuciones

`@ego/avatar` es el motor de personaje de Ego (Web Component `<ego-avatar>`).
Su codigo propio es MIT (`LICENSE`). Este documento registra **todo** lo que
el paquete deriva de un repo de referencia, fichero a fichero.

> **El registro canonico es [`provenance.manifest.json`](provenance.manifest.json).**
> Declara, por fichero, si es codigo derivado (y de quien) o nativo, con su
> upstream, su licencia y su ruta de origen. La puerta
> `scripts/check-attribution.mjs` lo usa como denominador: si un fichero no
> esta clasificado, o si un derivado no lleva su cabecera canonica, o si un
> nativo la lleva, la puerta falla. Las tablas de este documento se generan
> desde ese manifiesto, de modo que no pueden divergir de el.

## 1. Forma de la cabecera canonica

Todo fichero **realmente derivado** (un port literal) lleva, en su cabecera:

```
// Adapted from <upstream> (<LICENCIA>), <ruta de origen>
```

Un fichero **nativo** (codigo propio de Ego, o asimilacion de patron) **no** la
lleva: inventar esa cabecera seria una atribucion falsa (precedente
EGO-FIND-83, en el que el owner retired el credito a khoj porque el codigo
atribuido era propio).

## 2. Upstreams

| Upstream | Licencia | Copyright | Ruta de referencia |
|---|---|---|---|
| `agent-robot-avatar` | MIT | (c) CX ART Lab | `vendor/agent-robot-avatar/` |
| `coucou` | MIT | (c) Louis Raillard | `vendor/coucou/` |
| `coucou-swift` | MIT | (c) Louis Raillard | `vendor/coucou-swift/` |
| `ego-avatar-studio` | licencia no declarada en el origen | sin atribucion de copyright declarada en el fichero de origen | `repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html` |
| `ego-avatar` | MIT | (c) 2026 Ego Project | `repos-referencia/avatar/` |

### agent-robot-avatar — robot SVG parametrico (cabeza, rig ocular, poses, runtime)

- **Licencia**: MIT — (c) CX ART Lab
- **Origen**: https://github.com/cx-art-lab/agent-robot-avatar
- **Corpus resoluble en el repo**: `vendor/agent-robot-avatar/`
- **Aporta**:
  - plantilla SVG de la cabeza (160 puntos) y su mezcla de redondeo;
  - rig ocular (elipse blanca + parpados numericos) y la tabla de poses;
  - capa de politica (movimiento reducido, auto-sleep, registros de accion);
  - runner de extensiones y los efectos oculares y de micro-animacion.

### coucou — motor de la isla de Coucou (y el motor de Mochi)

- **Licencia**: MIT — (c) Louis Raillard
- **Origen**: https://github.com/louis-raillart/coucou
- **Corpus resoluble en el repo**: `vendor/coucou/`
- **Aporta**:
  - easings, muelles y el runner de tweens por campo con `locks`;
  - proyeccion de ojos sobre la silueta (`drawEyes`);
  - FSM de presencia de la isla (hidden / compact / home / greet);
  - catalogo de estados, tabla estado -> configuracion visual y recetas de sonido.

### coucou (Swift) — motor original del que cuelgan MochiStill y el wardrobe

- **Licencia**: MIT — (c) Louis Raillard
- **Origen**: https://github.com/louis-raillart/coucou
- **Corpus resoluble en el repo**: `vendor/coucou-swift/`
- **Aporta**:
  - pose estatica determinista por hash djb2 (`MochiStill.swift`).

### Avatar Studio — single-file HTML "CX-ArtLab Fiel & Mochi 2.0"

- **Licencia**: licencia no declarada en el origen — sin atribucion de copyright declarada en el fichero de origen
- **Origen**: fichero local de referencia: repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html
- **Aporta**:
  - motor canvas completo: `HybridRobotAvatar` (bucle de render, maquina de estados, presets);
  - rigs de ojos y de manos articuladas, visor, particulas, bocas y accesorios;
  - sintetizador de sonido del studio y los datos de su configuracion.

> El fichero de origen **no declara licencia**: su propio `LICENSE.md` dice "segun
> archivo de origen". Por eso las cabeceras de este paquete dicen literalmente
> "licencia no declarada en el origen" en vez de afirmar una licencia que nadie
> ha declarado.
>
> El material MIT que ese fichero incorpora si queda acreditado aqui y en el
> corpus `vendor/`: el robot de CX ART Lab (MIT) y el motor de Mochi de Coucou
> (MIT). Las Creative Commons de Mochi son de sus autores y Ego no distribuye
> su identidad visual: la geometria que se entrega es propia de Ego.

### ego-avatar — repo de referencia (el antepasado directo de este paquete)

- **Licencia**: MIT — (c) 2026 Ego Project
- **Origen**: repos-referencia/avatar (clon de referencia; esta en .gitignore, no forma parte del repositorio)
- **Aporta**:
  - los 29 ficheros de test portados de `tests/`;
  - los 3 ficheros de la demo del dock (`demo/robot-studio/`).

> Es codigo de Ego (MIT propio), no de un tercero: se declara por trazabilidad
> del port, no por obligacion de licencia.

## 3. Derivacion fichero a fichero

**57 ficheros derivados.** Cada uno lleva su cabecera canonica
con el upstream, la licencia y la ruta de origen de esta tabla.

### agent-robot-avatar (6 ficheros)

| Fichero | Ruta de origen | Evidencia |
|---|---|---|
| `src/core/config.js` | `vendor/agent-robot-avatar/random.js` | Port del patron Defaults/Bounds + clampConfig de agent-robot-avatar, con `parseSize` literal de core.js:63-68. |
| `src/render/eyes.js` | `vendor/agent-robot-avatar/core.js` | Port del rig ocular del robot (plantilla de core.js:270-285 y setEye de CORE:1046-1103). |
| `src/runtime/extension-host.js` | `vendor/agent-robot-avatar/extension-host.js` | Port del sistema de extensiones de agent-robot-avatar (runner de funciones con registro). |
| `src/runtime/fx-eyes.js` | `vendor/agent-robot-avatar/actions.js` | Port de los efectos oculares de agent-robot-avatar/actions.js (barrido, warnings) mas CORE:999-1037, inspect.js, love.js, waiting.js y failure.js. |
| `src/runtime/pointer.js` | `vendor/agent-robot-avatar/core.js` | Port con constantes literales del original (CORE:368-383 puntero, CORE:922-948 wander, CORE:955-1043 springs de cabeza). |
| `src/runtime/policy.js` | `vendor/agent-robot-avatar/runtime.js` | Port de la capa de politica de agent-robot-avatar/runtime.js (requestedMotion/reducedMotion, action records, scheduleAutoSleep). |

### coucou (6 ficheros)

| Fichero | Ruta de origen | Evidencia |
|---|---|---|
| `src/core/anim.js` | `vendor/coucou/core/anim.ts` | Port del modulo de easings/spring de coucou (sub-stepping 240 Hz, Tracked). El LICENSE.md del clon lo declara "adaptado de coucou/windows/src/core/anim.ts". |
| `src/render/projection.js` | `vendor/coucou/mochi/engine.ts` | Port de drawEyes() de coucou/mochi/engine.ts:749-784 (eyeYaw, foreshortening, umbral 0.04, piso 0.18). |
| `src/runtime/micro.js` | `vendor/coucou/mochi/engine.ts` | Port de las tablas de keyframe de micro-animacion de coucou/mochi/engine.ts con la semantica `locks`. |
| `src/runtime/presence.js` | `vendor/coucou/island/fsm.ts` | Port de la FSM de presencia IslandStateMachine de coucou/island/fsm.ts (hidden/compact/home/greet con sus temporizadores). |
| `src/runtime/sound.js` | `vendor/coucou/core/sound.ts` | Port del catalogo de sonidos y del envelope de coucou/core/sound.ts (28 nombres, volumen 0.12, idle 1500 ms). |
| `src/runtime/states.js` | `vendor/coucou/mochi/engine.ts` | Port de la tabla estado -> configuracion visual de coucou/mochi/engine.ts:91-103 reorientada a los hooks de Ego. |

### coucou-swift (1 ficheros)

| Fichero | Ruta de origen | Evidencia |
|---|---|---|
| `src/render/static.js` | `vendor/coucou-swift/MochiStill.swift` | Port de la pose estatica por hash djb2 de coucou-swift/MochiStill.swift. |

### ego-avatar-studio (12 ficheros)

| Fichero | Ruta de origen | Evidencia |
|---|---|---|
| `src/studio/avatar.js` | `repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html` | Port de HybridRobotAvatar (bucle de render, maquina de estados del canvas, catalogo de estados y aplicacion de presets) desde el single-file HTML de origen. |
| `src/studio/config.js` | `repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html` | Port de DATOS: los literales de STUDIO_DEFAULTS, de los presets de applyPreset y del mapa estado -> acento proceden del constructor del single-file HTML de origen (verificado: cada valor literal -#1e222d, #dbf59d, cx-faithful, cx-led, eyeSpacing, squircleN...- aparece en el fichero de origen). |
| `src/studio/render/body.js` | `repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html` | Port de drawBody del single-file HTML de origen, con la geometria sustituida por la propia de Ego (decision D4). |
| `src/studio/render/ears.js` | `repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html` | Port de drawEars del single-file HTML de origen, con la geometria sustituida por la propia de Ego (decision D4). |
| `src/studio/render/eyes.js` | `repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html` | Port de drawEyes del single-file HTML de origen, con la geometria sustituida por la propia de Ego (decision D4). |
| `src/studio/render/helpers.js` | `repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html` | Port de las primitivas de canvas (rectangulo redondeado, superelipse, acento) del single-file HTML de origen. |
| `src/studio/render/mouth.js` | `repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html` | Port de drawMouth y del lip-sync del single-file HTML de origen, con la geometria sustituida por la propia de Ego (decision D4). |
| `src/studio/render/overlays.js` | `repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html` | Port de las imagenes de estado del single-file HTML de origen. |
| `src/studio/render/particles.js` | `repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html` | Port de spawnParticles del single-file HTML de origen (codigo identico al del clon: 100% de shingles). |
| `src/studio/render/visor.js` | `repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html` | Port de drawInnerVisor del single-file HTML de origen (codigo identico al del clon: 100% de shingles). |
| `src/studio/rig/eyes.js` | `repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html` | Port de updateEyeRig del single-file HTML de origen (79% de shingles contra el HTML). |
| `src/studio/rig/hands.js` | `repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html` | Port de updateHandsRig, drawHands y drawSingleHand del single-file HTML de origen (70% de shingles contra el HTML). |

### ego-avatar (32 ficheros)

| Fichero | Ruta de origen | Evidencia |
|---|---|---|
| `tests/anim.test.js` | `repos-referencia/avatar/tests/anim.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/config.test.js` | `repos-referencia/avatar/tests/config.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/element.test.js` | `repos-referencia/avatar/tests/element.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/emotes.test.js` | `repos-referencia/avatar/tests/emotes.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/fx-eyes.test.js` | `repos-referencia/avatar/tests/fx-eyes.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/genome.test.js` | `repos-referencia/avatar/tests/genome.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/guards.test.js` | `repos-referencia/avatar/tests/guards.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/head.test.js` | `repos-referencia/avatar/tests/head.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/micro.test.js` | `repos-referencia/avatar/tests/micro.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/morph.test.js` | `repos-referencia/avatar/tests/morph.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/palette.test.js` | `repos-referencia/avatar/tests/palette.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/pointer.test.js` | `repos-referencia/avatar/tests/pointer.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/policy.test.js` | `repos-referencia/avatar/tests/policy.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/presence.test.js` | `repos-referencia/avatar/tests/presence.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/projection.test.js` | `repos-referencia/avatar/tests/projection.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/render.test.js` | `repos-referencia/avatar/tests/render.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/sound.test.js` | `repos-referencia/avatar/tests/sound.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/states.test.js` | `repos-referencia/avatar/tests/states.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/still.test.js` | `repos-referencia/avatar/tests/still.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/studio-adapter.test.js` | `repos-referencia/avatar/tests/studio-adapter.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/studio-avatar.test.js` | `repos-referencia/avatar/tests/studio-avatar.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/studio-body.test.js` | `repos-referencia/avatar/tests/studio-body.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/studio-config.test.js` | `repos-referencia/avatar/tests/studio-config.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/studio-element.test.js` | `repos-referencia/avatar/tests/studio-element.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/studio-eyes.test.js` | `repos-referencia/avatar/tests/studio-eyes.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/studio-integration.test.js` | `repos-referencia/avatar/tests/studio-integration.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/studio-mouth-hands.test.js` | `repos-referencia/avatar/tests/studio-mouth-hands.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/studio-sound.test.js` | `repos-referencia/avatar/tests/studio-sound.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `tests/timeline.test.js` | `repos-referencia/avatar/tests/timeline.test.js` | Port literal del fichero de test del repo de referencia `ego-avatar` (identico al 89-100% de los shingles; los que difieren lo hacen por las aserciones adaptadas al catalogo de Ego). |
| `demo/robot-studio/index.html` | `repos-referencia/avatar/demo/robot-studio/index.html` | Port literal del fichero del repo de referencia `ego-avatar` (100% de shingles). NO es un port de los bloques del single-file HTML: medido 0% de shingles contra el HTML completo. |
| `demo/robot-studio/studio.css` | `repos-referencia/avatar/demo/robot-studio/studio.css` | Port literal del fichero del repo de referencia `ego-avatar` (100% de shingles). NO es un port de los bloques del single-file HTML: medido 0% de shingles contra el HTML completo. |
| `demo/robot-studio/studio.js` | `repos-referencia/avatar/demo/robot-studio/studio.js` | Port literal del fichero del repo de referencia `ego-avatar` (100% de shingles). NO es un port de los bloques del single-file HTML: medido 0% de shingles contra el HTML completo. |

## 4. Ficheros nativos (sin cabecera canonica)

**31 ficheros** son codigo propio de Ego o asimilacion de
patron. No llevan cabecera canonica, y esta es la razon.

| Fichero | Por que es nativo |
|---|---|
| `src/render/ara-head.js` | Implementacion propia de Ego; patron asimilado de `agent-robot-avatar` (MIT), sin traduccion de codigo. La silueta es una cupula de exponente propio (3.4) con la corona plana y el menton estrecho, generada por una regla y normalizada a la caja canonica 20-220 (Ola 9, decision D4). |
| `src/render/body.js` | Implementacion propia de Ego; patron asimilado de `agent-robot-avatar` (MIT), sin traduccion de codigo. El pipeline (parsear -> aplanar -> mezclar el redondeo -> serializar) y sus constantes son de Ego (Ola 9, decision D4). |
| `src/runtime/poses.js` | Implementacion propia de Ego; patron asimilado de `agent-robot-avatar` (MIT), sin traduccion de codigo. Las poses se declaran con INTENCIONES (abrir, cerrar por debajo, inclinar, estirar, achatar) y las cifras del rig las produce una regla propia (Ola 9, decision D4). |
| `src/core/timeline.js` | Implementacion propia de Ego; patron asimilado de `coucou` (MIT), sin traduccion de codigo. El runner de tracks por campo (estado, avance del tiempo y reserva del campo) y las fases acumuladas son de Ego (Ola 9, decision D4). |
| `src/studio/sound.js` | Implementacion propia de Ego; patron asimilado del Avatar Studio (single-file HTML; su licencia no esta declarada en el origen), sin traduccion de codigo. El catalogo de gestos sonoros (raiz tonal, patron en semitonos y envolvente) y el renderizador generico son de Ego (Ola 9, decision D4). |
| `src/studio/render/accessories.js` | Implementacion propia de Ego; patron asimilado del Avatar Studio (single-file HTML; su licencia no esta declarada en el origen), sin traduccion de codigo. El catalogo de accesorios es dato y las piezas (antena, banda, lentes, gorro, orejas, corona, halo, brote) son geometria propia sobre una capa de primitivas (Ola 9, decision D4). |
| `src/index.js` | Barrel publico del paquete (registra el custom element). Codigo propio de Ego. |
| `src/version.js` | Version del paquete. Codigo propio de Ego. |
| `src/core/genome.js` | Genoma -> identidad. Asimilacion de patron: usa los traits `roundness`/`ratio` del robot de agent-robot-avatar, pero el codigo (semilla, genes, rangos) es propio. |
| `src/core/morph.js` | Geometria procedural de la silueta. Asimilacion de patron: la superelipse (formula matematica) y su uso como shape language proceden de ambos repos; la implementacion es propia. |
| `src/core/palette.js` | Genoma -> paleta CSS. Codigo propio de Ego (deriva la tinta del hue del genoma). |
| `src/core/prng.js` | PRNG determinista (xmur3 + mulberry32). Codigo propio de Ego; la referencia conceptual es externa (DiceBear / boring-avatars) y no es un repo de referencia. |
| `src/render/builder.js` | Helper minimo para construir SVG como string, sin DOM. Codigo propio de Ego. |
| `src/render/parts.js` | Aura, apendice, insignia y particulas. Codigo propio de Ego. |
| `src/render/shell.js` | Ensamblaje del SVG completo. Asimilacion de patron: la estructura del rig (cabeza + ojos recortados + grupo de movimiento) procede de agent-robot-avatar; el ensamblaje es propio. |
| `src/runtime/avatar-element.js` | Web component <ego-avatar>. Codigo propio de Ego: el elemento orquesta modulos derivados (ara-head, poses, eyes), pero su implementacion es propia. |
| `src/runtime/studio-bridge.js` | Pegamento elemento <-> motor canvas, extraido del elemento en la Ola 1. Codigo propio de Ego. |
| `src/runtime/svg-export.js` | Serializacion a SVG, extraida del elemento en la Ola 1. Codigo propio de Ego. |
| `src/runtime/avatar-element.d.ts` | Declaracion de tipos publica del web component. Codigo propio de Ego. |
| `src/runtime/sound.d.ts` | Declaracion de tipos del motor de sonido. Codigo propio de Ego. |
| `src/studio/adapter.js` | Puente del vocabulario Ego (15 estados) con el studio (26 estados). Codigo propio de Ego. |
| `src/studio/element-host.js` | Host canvas de <ego-avatar mode="studio">: conduce el motor HybridRobotAvatar. Codigo propio de Ego. |
| `src/studio/index.js` | Barrel del motor Avatar Studio. Codigo propio de Ego. |
| `src/studio/render/geometry.js` | Proporciones canonicas del robot de Ego. Codigo propio de Ego: sustituye las medidas heredadas de Mochi (decision D4) y no contiene codigo del origen. |
| `tests/hands-attribute.test.js` | Test propio de la Ola 4b (ruta del atributo hands). |
| `tests/attribution.test.js` | Test propio de la Ola 8 (puerta de atribucion con fixtures). |
| `tests/studio-roundtrip.test.js` | Test propio de la Ola 2 (contrato del puente Ego <-> studio). |
| `tests/warning.test.js` | Test propio de la Ola 2 (estado warning). |
| `tests/golden/geometry.json` | Golden generada por el propio motor de Ego (traza de operaciones de canvas). Dato, no codigo. |
| `tests/no-verbatim.test.js` | Test propio de la Ola 9 (puerta de residuo verbatim con fixtures). |
| `tests/d4-geometry.test.js` | Test propio de la Ola 9 (property test de la geometria propia: la silueta y la tabla de poses no pueden ser las del upstream). |

## 5. Sustituciones de geometria propias (decision D4 del owner)

El owner decidio (D4, 2026-10-19) **sustituir los puertos verbatim de
Mochi por geometria propia**. Los ficheros de abajo son ports del motor
canvas del studio, pero su **geometria ya no es la de Mochi**:

- `src/studio/render/{body,ears,eyes,mouth,accessories}.js` — la silueta,
  las vainas auditivas, los ojos, las bocas y los accesorios usan las
  proporciones canonicas de Ego (`src/studio/render/geometry.js`).
- `src/studio/config.js` — presets de identidad de Ego; el preset
  `coucou-mochi` se elimino (no se distribuye la identidad de Mochi).
- `src/studio/render/eyes.js` — se elimino la familia de ojo `mochi-sphere`.
- `src/studio/render/mouth.js` — se elimino el estilo de boca `mochi-cute`.

La prueba de no-regresion es la **golden geometrica** (`geometry:check`:
231 combinaciones de traza de operaciones de canvas), no un diff de pixeles.

## 6. Corpus embebido en `vendor/` (copia directa)

| Archivo | Origen | Licencia | Autor |
|---|---|---|---|
| `vendor/agent-robot-avatar/*.js` (16 modulos) | `agent-robot-avatar/src/*` (completo) | MIT | (c) CX ART Lab |
| `vendor/coucou/core/{anim,bridge,layout,state,sound}.ts` · `vendor/coucou/island/{fsm,hooks}.ts` · `vendor/coucou/mochi/{engine,greeting,minibots}.ts` | `coucou/windows/src/*` | MIT | (c) Louis Raillard |
| `vendor/coucou-swift/{BotEngine,MochiActivityState,MochiOutfitDrawing,MochiStill,MochiWardrobe}.swift` | `coucou/` (motor Swift original) | MIT | (c) Louis Raillard |

Estos ficheros se conservan **tal cual** como corpus de atribucion:
**no** son codigo de ejecucion y **no** se importan desde `src/` (la puerta
lo comprueba). Su unica funcion es que toda ruta citada en este documento y
en las cabeceras de origen **resuelva dentro del repositorio**.

## 7. Fuentes externas consultadas (investigacion)

`DiceBear`, `boring-avatars`, *Shape of AI* y articulos sobre *shape language*
y generacion procedural. Son **referencias conceptuales**, no codigo
derivado: ningun fichero del paquete deriva de ellas.

## 8. Licencia del codigo propio de este paquete

MIT — ver [`LICENSE`](LICENSE).
