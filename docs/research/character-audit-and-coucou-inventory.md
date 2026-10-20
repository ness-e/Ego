# Auditoría de Personajes (CHAR-01) e Inventario Técnico de Coucou (CHAR-02)

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-08 |
| Estado | Investigado — decisiones propuestas, pendientes de aprobación del owner |
| Fuente | `repos-referencia/coucou` (copia local, solo lectura) + docs de Ego |
| Clasificación epistémica | **[H]** hecho verificado en archivo · **[I]** inferencia · **[E]** especulación |

---

## 1. Auditoría de lo existente en Ego (CHAR-01)

### 1.1 Estado de implementación
- **[H]** No existe código del sistema de personajes: ni `apps/desktop/renderer/components/character/` ni `activity-widget/`, ni símbolos `CharacterState`/`CharacterDNA` en `apps/` o `packages/`. Estado de madurez: `SPECIFIED`.
- **[H]** No hay colisiones: `CHAR-*` y `WIDG-*` no existen en `docs/roadmap/Backlog.md`.

### 1.2 Contradicciones y brechas detectadas

| # | Hallazgo | Evidencia | Acción |
|---|---|---|---|
| A1 | **Ego Base = "squircle neutral"** hereda la geometría de partida de Mochi (superelipse, `p≈2.7`). Contradice la decisión de criatura original. | `character-system.md` §3, §10; `mascota.md` §3, §7 | CHAR-03 debe cuestionar el squircle; no heredarlo por defecto. |
| A2 | **Sub-Egos vestidos** (hoodie, corbata, gafas) y capa `outfit` en `CharacterDNA`. Contradice "no humanoides / no ropa". | `character-system.md` §3, §12; `mascota.md` §3, §7 | Reemplazar `outfit` por `traits` (rasgos de criatura). |
| A3 | **Duplicidad de backlog:** `CANV-11` ya define "Ego Activity Widget" (Fase 04); `COUC-06` lo enlaza con `CANV-11`, `TASK-05`, `TASK-07`. | `Backlog.md` | `CANV-11` = widget in-app. `WIDG-*` = solo ventana flotante de escritorio. |
| A4 | **Regla de fases (`AGENTS.md`):** *(corregido 2026-10-08)* Fase 01 está ✅ completada (15/15), pero Fase 02 va 8/12 y Fase 03 (Sub-Egos) no ha comenzado. El código del personaje (CHAR-04+) pertenece a Fase 03/04. | `Backlog.md` Resumen Ejecutivo | Solo investigación/diseño/docs/prototipo aislado (CHAR-01..03) hasta cerrar Fase 02 y abrir Fase 03. |
| A5 | **8 presets** (Professional, Technical…) son arquetipos humanos de oficina, no ADN de criatura. | `mascota.md` §8 | Rediseñar presets tras CHAR-03. |
| A6 | `MochiStill` y `MochiOutfit*` citados por nombre en docs canónicos. | ambos docs | Renombrar a nombres propios en la implementación. |
| A7 | Presupuesto CPU (≤1% idle, ≤2.5% activo) es una meta, no medida. | `character-system.md` §15 | **[E]** Validar con prototipo (CHAR-11). |
| A8 | `design/animations/` está en el listado de estudio; son prototipos HTML específicos de Mochi (carga de archivos, saludo en notch). | inventario A | Estudio de patrón de timeline `f(t)`, no se porta. |

### 1.3 Corrección de premisa
- **[H]** `windows/src/mochi/wardrobe.ts` **no existe** en Coucou. La referencia JS de atuendos es `design/outfits/mochi-outfits.js`; el registro real está en `MochiWardrobe.swift`. El motor TS (`engine.ts`) **omite** la física de accesorios y el guardarropa.
- **[H]** Coucou no tiene tests unitarios para `BotEngine.swift`, `MochiOutfitDrawing.swift` ni `engine.ts`. Solo cubren wardrobe (`MochiWardrobeTests.swift`) y lógica del widget flotante (`DesktopMochiTests.swift`). **Consecuencia:** no hay suite que portar; Ego debe escribir las suyas (golden frames deterministas).

---

## 2. Inventario del motor (fuente: Coucou, rutas bajo `repos-referencia/coucou/`)

| Mecanismo | Archivo / símbolos | Patrón aprovechable | Decisión Ego | Contrato destino |
|---|---|---|---|---|
| Easing/tween | `NotchBuddy/Sources/CoucouKit/BotEngine.swift` (`Ease`, L8–13) | cúbicas, overshoot "back" | **Asimilar** (MIT, aviso) | `character/math/ease.ts` |
| Geometría de silueta y morph | `BotEngine.swift` `mochiPath()`; `windows/src/mochi/engine.ts` `roundRectPath`, `rrPoint` | curva de Lamé, morph forma→caja | **Adaptar** (parametrizar silueta propia) | `character/geometry/silhouette.ts` |
| Mirada/escorzo 3D | `MochiOutfitDrawing.swift` `mProj`, `mEyeFrames`; `BotEngine.drawEyes` | proyección yaw/pitch, `fx=max(0.18,cos yaw)` | **Adaptar** | `character/face/gaze.ts` |
| Squash/stretch | `BotEngine.update` | volumen ≈ constante | **Asimilar patrón** | `character/behavior/` |
| Física accesorios/rasgos | `BotEngine` `physDx/physDy` (k=60, d=9) | resorte amortiguado Euler | **Adaptar** (cola/antenas/rasgos) | `character/physics/spring.ts` |
| Pose determinista | `MochiStill.swift` `MochiPose.idle` (djb2 + `tick*7919`) | hash para variación repetible | **Asimilar** | `character/still/pose-hash.ts` |
| Estados y partículas | `BotEngine` `BOT_STATES` (engine.ts) | estado→parámetros | **Reimplementar** con gramática propia | `character/state/` |
| Wardrobe (13 atuendos) | `MochiWardrobe.swift` | registro + persistencia + estacional | 🚫 **Descartar** el contenido (ropa humana); **adaptar** solo el patrón registro→persistencia a `TraitRegistry` | `character/traits/` |
| Calendario Pascua | `MochiWardrobe.swift` `easterDate()` | Computus | 🚫 **Descartar** (sin uso en SOC) | — |
| Personaje Mochi / expresiones | arte vectorial | — | 🚫 **Descartar** (identidad propia en CHAR-03) | — |

## 3. Inventario de widget y atención (fuente: Coucou)

| Mecanismo | Archivo / símbolos | Comportamiento **[H]** | Decisión Ego |
|---|---|---|---|
| FSM de isla | `IslandStateMachine.swift`; `windows/src/island/fsm.ts` | estados `hidden/petit/home/coucou`; timers 15 s home→petit, 60 s petit→hidden, pin 5.2 s al terminar tarea | **Adaptar** → `AttentionStateMachine` pura en TS |
| Admisión HITL con ACK | `HookServer.swift`; `windows/src-tauri/src/pipe.rs` | ACK ≤800 ms de que la UI montó la tarjeta; si falla, el control vuelve al terminal; timeout de seguridad ~108–115 s | **Asimilar** patrón → `@ego/execution` |
| Desplazamiento atómico | `HookServer.swift` | segunda solicitud → `ask` a la anterior | **Adaptar** (cola priorizada en Runtime) |
| Click-through | `island.rs` `PollGate` (polling ~60 Hz) | alterna ignorar cursor según posición | **Reimplementar** (`setIgnoreMouseEvents` + `forward`, sin polling) |
| Mascota de escritorio | `DesktopMochi.swift`, `DesktopMochiLogic.swift` | sueño, impacto, origen de mirada, retracción por alerta | **Adaptar** lógica pura (testeable) |
| Notch fijo | `IslandWindowController.swift`, `IslandRootView.swift` | UI anclada al notch | 🚫 **Descartar** (Ego no es una barra de notch) |
| Tests | `tests/DesktopMochiTests.swift`, `IslandScreenGeometryTests.swift` | lógica pura y geometría | **Adaptar** como casos de prueba de `AttentionStateMachine` |

### Riesgos de ventana flotante en Electron

| Riesgo | Nivel | Mitigación |
|---|---|---|
| Robo de foco al interactuar | Alto | `focusable:false` por defecto; activar solo en campos de texto |
| Wayland (posición absoluta y always-on-top) | Alto | **[I]** documentar limitación; fallback XWayland o widget in-app |
| Apps a pantalla completa exclusiva (Windows) | Medio | `setAlwaysOnTop(true,'screen-saver')`; aceptar que algunos juegos lo ocultan |
| DPI/multi-monitor | Medio | `screen.getDisplayNearestPoint`, recalcular en `display-metrics-changed` |
| Click-through | Medio | eventos DOM + `setIgnoreMouseEvents(…, {forward:true})` |

---

## 4. Procedencia y licencia (simplificada)

Decisión del owner (2026-10-08): todo activo visual será propio, por lo que `LICENSE-ASSETS.md` no bloquea. Se mantiene solo:
- Cada archivo TS derivado de código MIT de Coucou lleva cabecera: `Adapted from Louis-CFM/coucou (MIT), <ruta origen>`.
- Ningún nombre, dibujo, sonido ni icono de Mochi/Coucou entra al producto ni a los nombres de símbolos.
- Las matemáticas (curvas, resortes, easing) son técnicas estándar; el riesgo está en copiar la **forma resultante**, no la ecuación.

## 5. Decisión de arquitectura derivada

1. `CharacterDNA.outfit` → `traits: TraitConfig[]` (rasgos anatómicos de la criatura).
2. Separar tres superficies: `AttentionStateMachine` (lógica pura, `@ego/runtime`), `CharacterRenderer` (Canvas 2D) y ventana flotante (`apps/desktop/main`).
3. El renderer es 100 % puro (estado→frame) y verificable con golden frames, porque Coucou no aporta tests de motor.
4. Las aprobaciones desde widget pasan siempre por `@ego/execution`/Approval System; el personaje no autoriza nada.

---

## 6. Estado real tras la ola de remediación (2026-10-19)

Esta sección actualiza el inventario de puertos con lo que la ola A6 dejó
verificado. Las secciones 1–5 conservan el análisis original.

### 6.1 Las tres copias del motor

| Copia | Ruta | Estado |
|---|---|---|
| Upstream | `repos-referencia/avatar/` | referencia. Working tree **sucio** (19 ficheros) y `HEAD` (`c942a54`, 2026-10-14) desfasado respecto a él. **No se modifica ni se commitea.** |
| Paquete (canónico) | `packages/avatar/` | 49 ficheros en `src/`, 266 tests, typecheck real, licencia MIT + `NOTICE` |
| Vendorizada | `apps/desktop/renderer/floating/vendor/avatar/` | copia byte-idéntica del paquete; es la que carga el renderer |

Puerta de verificación: `pnpm --filter @ego/avatar sync:check` (SHA-256, exit 1
ante drift, incluidos los ficheros legales).

### 6.2 Inventario de puertos (estado real)

Contra el **working tree** de `repos-referencia/avatar/src` (44 ficheros), el
paquete de Ego queda así tras la ola:

| | Nº | Ficheros |
|---|---:|---|
| Byte-idénticos al upstream | **28** | el grueso del núcleo: `core/{genome,morph,palette,prng,config}`, `render/{ara-head,body,eyes,parts,shell,static,projection}`, `runtime/{states,poses,policy,presence,fx-eyes,extension-host,pointer,sound}`, `studio/{index,sound}` y `studio/render/{visor,overlays,particles}` y `studio/rig/{eyes,hands}` |
| **Bifurcados** | **16** | `core/timeline.js`, `render/builder.js`, `runtime/avatar-element.js`, `runtime/fx-eyes.js`, `runtime/micro.js`, `studio/adapter.js`, `studio/avatar.js`, `studio/config.js`, `studio/element-host.js`, `studio/sound.js`, `studio/render/{accessories,body,ears,eyes,helpers,mouth}.js` |
| **Nuevos** (no existen en upstream) | **5** | `runtime/studio-bridge.js`, `runtime/svg-export.js`, `runtime/avatar-element.d.ts`, `runtime/sound.d.ts`, `studio/render/geometry.js` |
| Ausentes | **0** | — |

Las seis primeras divergencias (antes de esta ola) ya las había introducido
Ego: fix `hsl`→hex, `preset` como atributo observado, `toSVGString()`,
`setPointerFollow()`, preset `ego-nucleus` y DPR. Las de esta ola son la
sustitución de la geometría (D4), la extracción del puente con el studio y el
export SVG, y el tipado real (`checkJs`).

Detalle fichero a fichero de la derivación de cada módulo:

| Fichero | Estado de la derivación |
|---|---|
| `src/core/anim.js` | **ADAPTADO** de `coucou/windows/src/core/anim.ts` (MIT, © Louis Raillart) — easings y springs a JS ESM |
| `src/core/timeline.js` | **ADAPTADO** de `coucou/mochi/engine.ts` (MIT, © Louis Raillart) — tweens por campo con *locks* |
| `src/core/config.js` | **ADAPTADO** de `agent-robot-avatar` (MIT, © CX ART Lab) — `Defaults`/`Bounds`/`clamp` |
| `src/render/ara-head.js` | **COPIA LITERAL** de `agent-robot-avatar/core.js:261` (MIT, © CX ART Lab) — la plantilla de 160 puntos |
| `src/render/projection.js` | **PORTADO** de `coucou/mochi/engine.ts` `drawEyes()` (MIT, © Louis Raillart) |
| `src/render/static.js` | **PORTADO** de `coucou/mochi/MochiStill.swift` (MIT, © Louis Raillart) — pose por hash djb2 |
| `src/runtime/extension-host.js` | **PATRÓN** de `agent-robot-avatar/extension-host.js` (MIT, © CX ART Lab) |
| `src/runtime/micro.js` | **ADAPTADO** de `coucou/mochi/engine.ts` (MIT, © Louis Raillart) |
| `src/runtime/pointer.js` | **ADAPTADO** de `agent-robot-avatar` (MIT, © CX ART Lab) |
| `src/runtime/presence.js` | **PORTADO** de `coucou/windows/src/island/fsm.ts` (MIT, © Louis Raillart) |
| `src/runtime/sound.js` | **ADAPTADO** de `coucou/core/sound.ts` + `mochi/engine.ts` (MIT, © Louis Raillart) — 28 recetas sintetizadas, cero WAV |
| `src/runtime/states.js` | **PATRÓN** de `coucou` `BOT_STATES` (MIT, © Louis Raillart) |
| `src/studio/*` | **GEOMETRÍA PROPIA DE EGO** desde 2026-10-19 (decisión D4). Antes: transcripción del single-file HTML. Ver §6.3. |
| `src/studio/render/geometry.js` | **NUEVO** (D4) — proporciones canónicas del robot de Ego |

### 6.3 La decisión D4: geometría propia

La regla de producto es: *"ningún nombre, dibujo, sonido ni icono de Mochi
entra al producto"*. Antes de la ola, el motor de canvas conservaba:

* el preset `'coucou-mochi'` (con su cuerpo "blob", su LED rosa y su ojo de
  esfera oscura),
* el estilo de ojo `'mochi-sphere'`,
* el estilo de boca `'mochi-cute'`,
* cabeceras que declaraban un "puerto verbatim" del single-file HTML.

**Qué se hizo** (decisión D4, owner 2026-10-19):

1. `src/studio/render/geometry.js` (nuevo) — proporciones canónicas del robot
   de Ego en un solo módulo.
2. `src/studio/render/{body,ears,eyes,mouth,accessories}.js` — reescritos;
   **eliminadas** todas las ramas de Mochi.
3. `src/studio/config.js` — **eliminado** el preset `'coucou-mochi'`.
4. Cabeceras normalizadas al formato `Adapted from <upstream> (MIT), <ruta>`.

**Prueba de no-regresión**: `packages/avatar/scripts/compare-geometry.mjs`
registra todas las llamadas al contexto de canvas y compara las trazas. La
golden `packages/avatar/tests/golden/geometry.json` se generó con el código
**anterior** a la sustitución; el código actual coincide en **168/168
combinaciones** (28 estados × 6 módulos). No se usó un diff de píxeles porque,
comparando el mismo código en dos sesiones de navegador, se midió hasta un
12 % de píxeles distintos (ruido de rasterizado).

### 6.4 Licencias y cadena de atribución

`packages/avatar/` y la copia vendorizada incluyen `LICENSE` (MIT),
`LICENSE.md` (tabla de atribuciones por fichero) y `NOTICE` (aviso de terceros).

**Cadena resoluble (2026-10-20).** `repos-referencia/` está en `.gitignore`
(línea 49) y **no forma parte del repositorio**: las rutas que citan
`LICENSE.md` y las cabeceras de `src/` apuntaban a ficheros que un auditor que
clone el repo no tenía. Por eso el **corpus de atribución se portó al
repositorio**:

| Ubicación | Contenido |
|---|---|
| `packages/avatar/vendor/` | **canónico**: 31 ficheros (`agent-robot-avatar/` 16, `coucou/core/` 5, `coucou/island/` 2, `coucou/mochi/` 3, `coucou-swift/` 5) + `README.md` |
| `apps/desktop/renderer/floating/vendor/avatar/vendor/` | réplica byte-idéntica, verificada por SHA-256 |

Dos correcciones sobre el upstream:

* El corpus del upstream **omitía `coucou/core/sound.ts`** pese a que
  `src/runtime/sound.js` deriva de él (`STATE_SOUND`, volumen 0.12, idle
  1500 ms). Portado desde `coucou/windows/src/core/sound.ts` y añadido a la
  fila del corpus de `LICENSE.md`.
* La cabecera de `src/core/anim.js` citaba `vendor/coucou/anim.ts`; la ruta
  real es `vendor/coucou/core/anim.ts`. Corregida, y normalizadas las 25
  cabeceras de 9 ficheros que citaban rutas sin el prefijo `vendor/`.

**Verificación**: `node packages/avatar/scripts/check-attribution.mjs` →
exit 0. Comprueba que (a) existen `LICENSE`, `LICENSE.md` y `NOTICE`; (b) las
**5 familias** de `LICENSE.md` —que son globs y expansiones de llaves, no
ficheros sueltos— expanden a **31 ficheros reales**; (c) las **9 rutas**
citadas en las cabeceras de `src/` existen; (d) **`src/` no importa nada de
`vendor/`** (el corpus no puede colarse en el bundle); y (e) la copia
vendorizada lleva su corpus y coincide por SHA-256.

El corpus es **material de solo lectura**: no se edita, no se ejecuta y no se
importa. `packages/avatar/vendor/README.md` lo declara y además mapea cada
fichero del corpus con su parte derivada en `src/`.

### 6.5 Defecto latente encontrado

`HybridRobotAvatar.impulse(sx, sy, vy, rot, vx)` acepta cinco parámetros,
pero seis llamadas le pasaban un sexto argumento que nunca se leía. Es un
defecto **preexistente del upstream** (los cuatro primeros casos ya estaban en
el single-file HTML original). Se eliminó el argumento muerto. Lo detectó el
`typecheck` real: con `checkJs` activo, el compilador lo señala.
