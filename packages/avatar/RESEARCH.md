# Investigación — Sistemas de Avatares Generativos

> Compilación de hallazgos (2026-10-13) que fundamentan el diseño de
> Ego Avatar / Robot Studio. Fuentes: internet + análisis profundo de dos
> motores de referencia MIT (ver `LICENSE.md`).

---

## 1. Marco conceptual: los 3 trabajos de un avatar de IA

Fuente: [Shape of AI — Avatar pattern](https://www.shapeof.ai/patterns/avatar)

Un avatar de agente tiene tres responsabilidades:

1. **Comunicar estado** — pulsar/brilar/moverse para decir "escuchando", "generando",
   "esperando". Sin señales claras, el usuario mal-timinga sus entradas o cree que el
   sistema falló.
2. **Anclar identidad** — saber *qué entidad* actúa en una interfaz multi-agente
   (un avatar por entidad).
3. **Mediar confianza** — el grado de realismo cambia cuánta agencia atribuimos al
   sistema. **Evitar el realismo engañoso**: fotorealismo ⇒ implica competencia humana.

Formas según intención:

| Forma | Ejemplo | Implicación |
|---|---|---|
| Marca mínima | estrella de Claude, Copilot | utilidad, sin ilusión de agencia |
| Personaje de marca | mascotas abstractas, Replika | calidez y memorabilidad |
| Agente animado/fotorrealista | video-avatares | alto riesgo de incoherencia |

Recomendaciones clave: hacer los cambios de estado **inequívocos**, integrar el avatar
como parte de la UI (animación = affordance), y permitir personalización explícita.

**Decisión de producto:** arquetipo *personaje de marca abstracto* — ni marca mínima ni
fotorrealismo. Un organismo abstracto generado por semilla: identidad fuerte por
entidad + lenguaje de estados claro.

---

## 2. Generación determinista: de semilla a fenotipo

### 2.1 Identicons y hash → visual

- [DiceBear](https://www.dicebear.com/) — 61 estilos de avatar SVG **deterministas**
  a partir de una semilla (seed). Su estilo "Identicon" [hashea la semilla y dibuja
  una retícula simétrica](https://www.dicebear.com/styles/identicon/).
- [Cómo DiceBear construye avatares](https://www.dicebear.com/understand/how-avatars-are-made/):
  **un estilo es una definición JSON de componentes** (pelo, ojos, boca), cada uno con
  variantes y colores ⇒ modelo de *traits composicionales*.
- [boring-avatars](https://github.com/boringdesigners/boring-avatars) — genera SVG
  deterministas desde username + paleta: bitwise ops sobre el nombre → parámetros de
  formas (beams/marble/pattern/rings). Prueba de que un hash crudo + reglas simples
  produce resultados distintivos y reproducibles.
- [Awesome-identicons](https://github.com/drhus/awesome-identicons) — catálogo de
  técnicas de "visual identity a partir de hash".
- [Barro — Avatars, identicons, and hash visualization](https://barro.github.io/2018/02/avatars-identicons-and-hash-visualization/):
  la visualización de hash aprovecha el reconocimiento *preatentivo* — humans
  distinguen imágenes mejor que cadenas.

**Principio:** `seed → hash → PRNG determinista → traits` es el estándar de facto.
La misma semilla SIEMPRE produce el mismo avatar (identidad estable).

### 2.2 Generación procedural de formas

- [Procedural generation (Wikipedia)](https://en.wikipedia.org/wiki/Procedural_generation):
  variar parámetros deterministas + semilla aleatoria para contenido nuevo.
- [Generative blob characters using SVG (George Francis)](https://dev.to/georgedoescode/tutorial-generative-blob-characters-using-svg-1igg):
  blobs SVG = N puntos radiales + ruido + curvas Bézier cerradas. Base directa de
  nuestras siluetas.
- **Superelipse** (mistfit curve `|x/a|^n + |y/b|^n = 1`): n=2 círculo, n→∞ rectángulo.
  Es el trait de forma continuous que usan ambos motores de referencia. Permite
  *shape language* paramétrico.

### 2.3 Lenguaje de formas (shape language)

- [Walt Disney — Shape Language](https://www.waltdisney.org/sites/default/files/2020-04/T%26T_ShapeLang_v9.pdf)
- [3dsense — Shape Language in Character Design](https://3dsense.net/blogs/shape-language-in-character-design-communicating-through-geometry)
- [VSquad — Shape Language Character Design](https://vsquad.art/blog/articles/understanding-shape-language-in-character-design/)

Gramática visual canónica:

| Forma | Mensaje emocional |
|---|---|
| Círculo / curvas | amistoso, seguro, accesible |
| Cuadrado / rectas | estable, confiable, técnico |
| Triángulo / puntas | dinámico, alerta, agresivo |

**Principio:** el genoma porta el redondeo de la cabeza ⇒ cada avatar tiene una
*personalidad geométrica* heredada de su semilla, coherente entre sesiones.

---

## 3. Animación y estados: lecciones de los motores de referencia

### 3.1 Motor A — rig SVG por estados (MIT)

Avatar de **estado** con rig SVG procedural (no generativo):

- **Plantilla SVG inmutable + morfometría**: una pose = ~10 números (ancho/alto de
  ojo, párpados). Nunca se redibuja el SVG; se mutan atributos. Baratísimo por frame.
- **Arquitectura de extensiones** (`registerAvatarExtension({name, actions, beforePlay,
  afterPlay, reset, draw})`) con monkey-patch del prototipo ⇒ añadir traits = módulo.
- **Cancelación por generation token** (`_transitionToken`) — sin carreras entre
  animaciones concurrentes; `_expressionLock` para expresiones.
- **Capa de política separada** (`runtime.js`): reduced-motion, auto-sleep,
  coalescing de puntero, eventos `action-state {action, phase, source}` ⇒ mapea
  directo al ciclo de vida de una request de agente.
- **Config con Defaults + Bounds congelados** y clamp — tuning externo seguro.
- Algoritmos: deformación **gaussiana** de path (jelly), **superelipse** de roundness,
  proyección **cilíndrica** de ojos (waiting wrap), planificación de reel con
  **Hermite + rebote amortiguado**, timelines declarativas desde tablas de timings,
  corazón con dos elipses rotadas, spring-damper `a = k(target−pos) − d·vel`.
- **Ojo importante:** NO es generativo — sin seed, sin traits, sin paletas; todo
  `Math.random()` sin PRNG determinista. El personaje es único y fijo
  (el *código* es MIT, el *diseño* es de su autor — ver `LICENSE.md`).

### 3.2 Motor B — personaje procedural en canvas (MIT)

Personaje 100% procedural en Canvas (cero assets):

- **Cuerpo = superelipse** muestreada en N puntos, rellena con 4 gradientes
  (base, tint de estado, rim shadow, highlight) — sin sprites.
- **Ojos proyectados sobre la silueta como esfera**: `cos(eyeYaw)` → foreshortening,
  visibilidad por `cos·cos > 0.04`, clip al path del cuerpo.
- **Tabla estado → config**: `{color, tint, eye, badge, flags de
  comportamiento, look fijo, tilt, sonido}`. 11 estados (idle/working/thinking/
  searching/approval/question/error/finished/ratelimit/sleeping/dizzy) + 7 emotes
  transitorios con capa `eyeOverride` (con caducidad) sobre `cfg.eye`.
- **Mapeo evento-herramienta → estado**: SessionStart→idle, UserPromptSubmit→thinking,
  PreToolUse→working, Stop→finished(5s), StopFailure→error, PermissionRequest→approval.
  ⇒ **directamente trasladable a los hooks de un runtime de agentes.**
- **Prioridad de urgencia** para un avatar multi-agente: approval > question >
  error/ratelimit > working > finished > idle.
- **Arquetipos de personaje** en el prototipo: `{shape, eye:{w,h,sp,p},
  base:[c1,c2], ink}` × 3 ⇒ el gancho natural para cuerpos por entidad
  (aunque la app solo usa uno).
- **Motor de animación portable**: `Ease`, `cubicBezier` por bisección (12 iters),
  `Spring` con sub-stepping a 240 Hz, `Tracked` (apertura con spring / cierre
  con curva 340 ms).
- Movimiento orgánico: parpadeo 2.2–5.4 s con 22% doble parpadeo; mirada suavizada
  `kLook = 1 − pow(0.0025, dt)` (invariante al framerate), target `tanh(dx/260)`.
- **Render estático determinista**: hash djb2 de id + tick → pose en
  superficies sin animación (widgets).
- Glow/halo **fuera del canvas** (efecto separado), y frame rate adaptativo
  (30 fps activo / 10 fps durmiendo / pausa).

### 3.3 Síntesis de principios extraídos

| Principio | Origen | Aplicación en nuestro sistema |
|---|---|---|
| Seed → PRNG determinista → traits | DiceBear/boring-identicons | `genome.js` |
| Traits composicionales JSON | DiceBear | esquema de genoma modular |
| Superelipse como shape language | ambos motores + Disney | trait `shape.roundness` |
| Plantilla SVG + morfometría de poses | motor A | `poses.js` + loop de mutación |
| Tabla estado → cfg | motor B | `states.js` |
| Evento runtime → estado visual | motor B (hooks) | API `setState()`/`notify()` |
| Extensión host | motor A | `extension-host.js` |
| Token de cancelación | motor A | transiciones de acción |
| Spring sub-stepped 240 Hz | motor B | `anim.js` (copiado/adaptado) |
| Mirada/framerate-invariant smoothing | ambos | gaze/blink loop |
| Glow separado del cuerpo | motor B | capa `aura` |
| Determinismo para superficies estáticas | motor B (stills por hash) | `toSVGString()` |

---

## 4. Referencias externas adicionales

- [Procedural generation — Wikipedia](https://en.wikipedia.org/wiki/Procedural_generation)
- [Design Principles for Generative AI Applications (IBM, arXiv)](https://arxiv.org/abs/2401.14484)
- [Agents with Faces: The Personified User Interface](https://medium.com/craine-operators-blog/agents-with-faces-the-personified-user-interface-c4664234d619)
- [AI UX Patterns — Avatar (ShapeofAI)](https://www.shapeof.ai/patterns/avatar)
- [Trust & avatar design review (Decode)](https://decodemarketing.com/en/science-insights/avatar-design-how-to-design-avatars-people-trust)
- [SmartAvatar (VLM-driven 3D avatars, arXiv)](https://arxiv.org/html/2506.04606v1) — fuera de alcance (3D/foto), referencial.
- [DiceBear — How avatars are made](https://www.dicebear.com/understand/how-avatars-are-made/)
- [boring-avatars](https://github.com/boringdesigners/boring-avatars)
- [Generative blob characters using SVG](https://dev.to/georgedoescode/tutorial-generative-blob-characters-using-svg-1igg)

---

## 5. Atribuciones legales

Los dos motores de referencia son código MIT de terceros y el motor canvas es
un port del single-file HTML original. Detalle completo en `LICENSE.md`.

---

## 6. Ronda 2 (2026-10-14): mirada, micro-animación, sonido y formas

### 6.1 Modelo de puntero y cabeza del rig de referencia

Constantes literales del original (`src/runtime/pointer.js`):

| Parámetro | Valor | Origen |
|---|---|---|
| Radio de influencia | 2.55 × max(w, h) | rig de referencia (núcleo) |
| Ganancias | 0.42 (x) / 0.38 (y) | idem |
| Clamps | ±48 px (x) / ±34 px (y) | idem |
| Frescura del puntero | 900 ms | idem |
| Wander | ampX 12–25, ampY 5–14, retarget 1150–3050 ms | idem |
| Suavizado | `kL = 1-(1-speed)^(dt/16.67)` (invariante al framerate) | idem |
| Velocidades de mirada | default 0.16 / pointer 0.28 / locked 0.40 / jelly-antenna 0.42 / bored 0.5 | idem |
| Spring de cabeza (track) | k95/d16 (translate), k70/d15 (rotate) | idem |
| Spring de cabeza (settle) | k80/d14 (translate), k56/d13 (rotate) | idem |
| Recorrido máximo | ±4.2 px, ±8° con acoplo diagonal `nx·ny` | idem |

Modificadores de ojo portados a `src/runtime/fx-eyes.js`: nod en 4 segmentos
(760 ms, caída 31 px + squash 30 %), angryDrop `1-e^(-5.2t)·cos(8.6t)`
(4.8 px / 680 ms), eyeBob `sin(4πt)·amp·(1-0.38t)` (happy 620 ms/8 px,
sad 700 ms/7 px), surpriseShake `1+0.022·sin(8πt)·(1-0.18t)` (420 ms),
órbita de espera (ciclo 3200 ms, 2 órbitas, ±34 px, foreshorten 0.72–1.0,
profundidad ±8 %), inspección (6560 ms, escaneo vertical ±16 px con párpados),
corazones lub-dub (`max(swell(0.12,0.12), 0.6·swell(0.36,0.12))`, 2880 ms),
caída de cabeza de fallo (5.5 px en 720 ms, total 2720 ms).

### 6.2 Micro-animaciones y sonido del motor procedural

Tablas keyframe literales del motor de referencia en `src/runtime/micro.js`
(21 micros: `squash, gulp, errorShake, approvalHop, badgePop, loveLift,
surpriseLift, proudTilt, winkTilt, winkTiltShort, yawn, happyBlush, greet,
greetHands, happyBounce, happyPop, annoyedHead, loveRock, hop, roll,
rollDouble`), aplicadas con la semántica `locks` del `anim()` original:
un campo ya tweeneado no se sobrescribe. Pop de insignia en dos pasos
(encoge a 0 en 90 ms → intercambia contenido → crece a 1 en 280 ms con
`Ease.back`). Blink (cierra a 0.06 en 70 ms, abre en 130 ms). Reacciones de
entrada por estado (`finished`→roll + spark, `dizzy`→doble roll,
`approval`→hop, `question`→blink, `waiting`→órbita).

Ojos: el motor de referencia dibuja 13 formas con matemática exacta de paths
y proyección esférica (`eyeYaw`, descarte si `cos·cos ≤ 0.04`). Aquí `heart` y
`star` se implementaron como tercer tipo de render (forma rellena) más `line`
heredado; el resto de poses se resuelve con la morfometría propia.

Sonido: el motor de referencia define 28 nombres, volumen 0.12 recortado a
[0, 0.2], flag `enabled` y suspensión idle a los 1500 ms. `src/runtime/sound.js`
conserva los 28 nombres y el mapa `STATE_SOUND` literal pero sintetiza cada
receta con Web Audio (`tone`/`sweep`/`noise`/`chord`, duraciones 0.03–0.6 s) —
cero assets, cero red, no-op seguro sin `AudioContext`. Física de partículas
de referencia (stagger 0.14 s, vida 1.3–1.8 s) y pulso de badge viajero
(`t·2.4 + i·0.33`).

### 6.3 Micro-interacciones (investigación web)

Confirmación de prácticas generales aplicadas al sistema: responder con
ease-out (reacción inmediata), asentar con bounce/back natural (squash,
hop, badgePop), mantener cada micro por debajo de ~1 s y encadenar como
máximo 4 keys por campo, y preferir transformaciones baratas (translate/
scale/rotate sobre grupos SVG) frente a reconstruir geometría. Las cifras
concretas, en todo caso, vienen de los motores de referencia — la web solo
confirma el patrón.

### 6.4 Reunificación del rig (2026-10-14): el cuerpo y los ojos SON los del rig de referencia

Decisión de esta ronda: abandonar el lenguaje procedural anterior (siluetas con
wobble, ojos-oscuros-sobre-cuerpo-claro, corazones/estrellas como paths) y
adoptar el **rig visual completo del motor A**:

- Cabeza = su plantilla verbatim de 160 puntos + aplastado + redondeo por
  superelipse (gen `roundness` 0–100). La variedad por semilla viene del
  redondeo, el aplastado y la tinta — no de siluetas distintas.
- Ojos = sus elipses blancas + párpados deslizantes/rotantes + barra de cursor
  (pose `input` para `listening`, parpadeo a 530 ms). Las 8 poses son sus
  números literales; al ser todo numérico, los morphs son continuos y los
  overrides de emote no tienen cortes de modo.
- Amor = sus óvalos inclinados solapados (NO paths de corazón): con párpados
  a ±150 para que el grupo rotado ±42° nunca los corte.
- Párpados del color de la cabeza: el tinte de estado mezcla tinta→tinte en
  `_paintTint` para el mismo efecto.
- `action-fx.js` + `expressions.js` → `fx-eyes.js` (envoltorio estándar
  `{dx,dy,sx,sy,lid,done}`); keys de cabeza → `micro.js`; `BORED_STEPS` →
  `pointer.js`. Eliminados `shapes.js`, modos heart/star, blush y trazos.

---

## 7. Motor canvas / Robot Studio (2026-10-14, port íntegro a `src/studio/`)

Fuente: single-file HTML original de referencia (4812 líneas, con CDN de
estilos + fuentes web). Clases `SoundSynthesizer` (síntesis por oscilador,
tabla de ~25 sonidos) y `HybridRobotAvatar` (26 estados, física de springs sin
distorsión ±3.5 %, hover/petting/poke/high-five/drag/wheel-spin/drop-box, manos
de 5 dedos, visor, 9 ojos, 6 bocas con lip-sync, 16 accesorios, 2 presets
fieles). Método: port por rangos a ESM (`render/*`, `rig/*`, `avatar.js`),
contrato `(ctx, S, …)` / `(S, dt)`, DOM tras guardias, demo offline sin CDN.
El original se conserva tal cual como referencia.
