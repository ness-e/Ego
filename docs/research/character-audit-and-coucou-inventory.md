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
