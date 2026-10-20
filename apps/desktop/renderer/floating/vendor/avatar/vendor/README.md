# `vendor/` — corpus de atribución (SOLO LECTURA)

> **Este directorio NO es código de Ego y NO forma parte del runtime.**
> Es el **corpus de atribución**: las copias originales de los motores de
> terceros de los que derivan partes de `packages/avatar/src/`.
>
> **No debe importarse.** Ningún módulo de `src/` lo importa, y así debe
> seguir: su única función es que un auditor pueda **leer el original** al que
> apunta cada cabecera de unattribución y cada fila de `../LICENSE.md`.

## Por qué está aquí

La cláusula de la licencia MIT exige que el aviso de copyright sea
**resoluble** en toda copia del software. Las cabeceras de `src/` y la tabla de
`../LICENSE.md` apuntan a ficheros concretos de este árbol (por ejemplo
`vendor/agent-robot-avatar/core.js:261`). Si el corpus no estuviera en el
repositorio, esas referencias apuntarían al vacío y la cadena de atribución
sería irresoluble para cualquiera que clone el repo.

Por eso el corpus vive **aquí**, en el repositorio, y no en
`repos-referencia/avatar/vendor/`: `repos-referencia/` está en `.gitignore`
(línea 49) y **no forma parte del repositorio**.

## Reglas

1. **Solo lectura.** No se edita, no se ejecuta, no se compila.
2. **No se importa.** Ningún `import` de `src/` debe apuntar aquí. El motor
   tiene **0 dependencias** y este árbol no participa del bundle.
3. **No se distribuye como código de Ego.** Es material de terceros con su
   propia licencia, íntegramente.
4. Si alguna vez setocara un fichero de aquí, la comparación SHA-256 de
   `sync-check.mjs` lo detectaría (el corpus se compara entre el paquete y la
   copia vendorizada) y habría que reinstalarlo desde el upstream.

## Contenido y licencias

| Subárbol | Ficheros | Origen | Licencia | Autor |
|---|---:|---|---|---|
| `agent-robot-avatar/` | 16 | `agent-robot-avatar/src/agent-robot-avatar-*.js` (copia **byte-idéntica**, con el nombre corto `agent-robot-avatar-` eliminado) | MIT | © 2026 CX ART Lab |
| `coucou/core/` | 5 | `coucou/windows/src/core/*.ts` (copia byte-idéntica) | MIT | © 2026 Louis Raillard |
| `coucou/island/` | 2 | `coucou/windows/src/island/{fsm,hooks}.ts` (copia byte-idéntica) | MIT | © 2026 Louis Raillard |
| `coucou/mochi/` | 3 | `coucou/windows/src/mochi/*.ts` (copia byte-idéntica) | MIT | © 2026 Louis Raillard |
| `coucou-swift/` | 5 | `coucou/` motor Swift original (`BotEngine`, `MochiOutfitDrawing`, `MochiStill`, `MochiWardrobe`, `MochiActivityState`) | MIT | © 2026 Louis Raillard |

Los avisos de copyright de cada obra están en su `LICENSE` original y
recogidos en `../LICENSE.md` y `../NOTICE`.

## A qué parte de `src/` corresponde cada fichero

| Corpus | Derivado en `src/` | Naturaleza |
|---|---|---|
| `agent-robot-avatar/core.js` | `render/ara-head.js` (COPIA LITERAL de la plantilla de 160 puntos) y `render/body.js`, `render/eyes.js` | plantilla y geometría |
| `agent-robot-avatar/random.js` | `core/config.js` (`RANDOM_DEFAULTS`/`BOUNDS` + `clampConfig`) | configuración |
| `agent-robot-avatar/extension-host.js` | `runtime/extension-host.js` (mismo patrón de registro) | arquitectura |
| `agent-robot-avatar/{geometry,head-roundness}.js` | `render/body.js` (aplastado y redondeo de la cabeza) | geometría |
| `agent-robot-avatar/{actions,love,inspect,waiting,failure}.js` | `runtime/fx-eyes.js`, `runtime/poses.js` | efectos y poses |
| `agent-robot-avatar/runtime.js` | `runtime/policy.js` (`requestedMotion`, `beginAction`/`finishAction`/`cancel`, `scheduleAutoSleep`) | política |
| `coucou/core/anim.ts` | `core/anim.js` (easings, `Spring`, `Tracked`, `cubicBezier`) | animación |
| `coucou/core/sound.ts` | `runtime/sound.js` (28 recetas, volumen 0.12 / [0, 0.2], idle 1500 ms) | sonido |
| `coucou/core/{state,layout,bridge}.ts` | `runtime/states.js` (tabla de estados y hooks) | estados |
| `coucou/island/fsm.ts` | `runtime/presence.js` (`IslandStateMachine`: hidden/compact/home/greet) | presencia |
| `coucou/island/hooks.ts` | `runtime/states.js` (`HOOK_STATE_MAP`, auto-retorno) | hooks |
| `coucou/mochi/engine.ts` | `core/timeline.js` (tweens por campo con *locks*), `render/projection.js` (`drawEyes`), `runtime/micro.js`, `runtime/sound.js` (`STATE_SOUND`) | animación, mirada, microgestos |
| `coucou/mochi/greeting.ts` | `runtime/micro.js` (keys de cabeza) | microgestos |
| `coucou/mochi/minibots.ts` | `runtime/pointer.js` (rutina de aburrimiento, `BORED_STEPS`) | puntero |
| `coucou-swift/MochiStill.swift` | `render/static.js` (pose estable por hash djb2) | pose estática |
| `coucou-swift/MochiOutfitDrawing.swift` | `runtime/poses.js` (tabla numérica de poses) | poses |
| `coucou-swift/BotEngine.swift` | `render/eyes.js` (rig de párpados) | rig ocular |

## Verificación

`node scripts/check-attribution.mjs` verifica que **todas** las rutas
mencionadas en `../LICENSE.md` y en las cabeceras de `src/` existen en este
directorio, y que el corpus es idéntico a su copia en la copia vendorizada.
Sale con código 1 si alguna referencia queda colgando.
