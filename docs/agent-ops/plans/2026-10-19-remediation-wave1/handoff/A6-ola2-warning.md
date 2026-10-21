# Handoff A6 (Ola 2) — 2026-10-20 — Estado `warning` en el motor de personaje

> Agente: **A6** · Plan: `docs/agent-ops/plans/2026-10-19-remediation-wave1/A6-avatar.md`
> Zona: `packages/avatar/**`, `apps/desktop/renderer/floating/vendor/avatar/**`,
> `docs/product/mascota.md`, `docs/product/character-art-direction.md`,
> `docs/architecture/character-system.md`, `docs/research/character-audit-and-coucou-inventory.md`
> Continuación de `handoff/A6.md` (Ola 1) y `handoff/A6-ola1b.md` (Ola 1b). Sin commits.

---

## 1. Qué se ha hecho

`packages/avatar` es el motor canónico (decisión del owner: *"avatar es el
mejor"*). El subsistema de avatar tenía un **estado sin equivalente**: la app
tenía la señal `tool_error` y el avatar la perdía.

| Tarea | Estado | Dónde |
|---|---|---|
| **T1** estado `warning` en el motor | ✅ | `src/runtime/states.js`, `src/runtime/poses.js`, `src/render/parts.js`, `src/runtime/avatar-element.js`, `src/studio/adapter.js` |
| **T2** golden re-recordada (168 → 174) | ✅ | `scripts/compare-geometry.mjs`, `tests/golden/geometry.json` |
| **T3** documentación | ✅ | `packages/avatar/{README,DESIGN}.md`, `docs/product/mascota.md`, `docs/architecture/character-system.md`, `docs/research/character-audit-and-coucou-inventory.md` §6.4 |
| **T4** diff exacto para el renderer | ✅ | §5 de este handoff (para **A4**) |

---

## 2. Justificación visual de `warning`

**Por qué existe.** `ego-chat.tsx:264` declara el evento
`kind: "tool_call" | "tool_result" | "tool_start" | "tool_end" | "tool_error"`,
pero su `useMemo` de `avatarLiveState` sólo miraba `tool_call`/`tool_start`. Un
`tool_error` caía en la rama del mensaje → **el avatar se pintaba en
`thinking` mientras una tool estaba fallando**. Y el mapa legacy
`mapCharacterStateToAvatarState` mandaba `warning` a `idle` por `default`: el
estado **no tenía ninguna imagen**. `warning` es la representación visual de
**"algo falló pero el turno continúa"**.

**Cómo se separa de sus vecinos.** Un estado que se confunde con otro es peor
que no tenerlo, así que `warning` ocupa los cinco canales del motor con
valores propios:

| Canal | `error` (fallo duro) | `ratelimit` (vocabulario del proveedor) | **`warning` (degradación tolerable)** |
|---|---|---|---|
| Tinte | rojo `hsl(352 85% 58%)` | naranja `hsl(27 96% 59%)` | **amarillo-caution `hsl(48 92% 55%)`** |
| Pose | `flat` (enfadada) | `tired` (agotada) | **`warn`** (nueva: estrecha y atenta) |
| Insignia | `!` | `•` | **`⚠`** (nueva: triángulo propio) |
| Movimiento | `shake` (agitado) | `breathe` | **`sway`** (inquieto, no agitado) |
| Aura / tinte | 0.65 / 0.6 | 0.45 / 0.55 | **0.4 / 0.4** (el más tenue) |

Tres decisiones y su motivo:

1. **El tono sale del cluster naranja.** Los estados cálidos vivos ocupan los
   tonos 27 (`ratelimit`), 30 (`approval`) y 35 (`waiting`). `warning` usa el
   **48**: el primer tono realmente distinto de esa familia, y a 56° del rojo
   del `error` (352). No es "más de lo mismo": es otra familia.
2. **La pose `warn` es nueva** (`src/runtime/poses.js`): ojos estrechados
   (48×52 frente a 54×58 del reposo) con párpados bajos pero **neutros**. Sin
   inclinación (nada de enfado → no es `angry`/`flat`, que son de `error`) y
   sin decaimiento (nada de agotamiento → no es `sleepy`/`tired`, que es de
   `ratelimit`). El rig es numérico, así que interpola sin conmutaciones.
3. **La insignia `warn` es nueva** (`src/render/parts.js`): un triángulo `⚠`
   dibujado con trazos **propios** (marco, barra y punto), no el signo `!` de
   error. Se distingue **por la forma**, no sólo por el color: el círculo de
   la insignia es siempre el acento de la identidad, así que el color no
   habría servido.

**Evidencia visual** (`packages/avatar/captures/svg-states.png`, motor SVG
estático, mismo seed): `warning` muestra el triángulo `⚠` y los ojos
estrechos; `error` la `!` y los ojos enfadados; `ratelimit` el punto y los
ojos cansados; `idle` sin insignia.

> En modo **studio** el estado `warning` ya existía y **no ha cambiado**: es un
> cartel ámbar con `!` (`studio/render/overlays.js`). Lo nuevo es que ese
> cartel pasa a significar una sola cosa (el aviso de Ego) en lugar de ser la
> imagen compartida con `ratelimit`.

### Sonido

`STATE_SOUND.warning = 'tick'`. El catálogo de 28 sonidos **no tiene ninguna
receta de aviso** y **no se inventa ninguna**. Se usa `tick`: la más breve y
no alarmista. Es la misma receta que usa la **acción** `waiting`; el catálogo lo
comparten estados y acciones, y ambos sonidos pueden convivir sin conflicto
(son tablas distintas: `STATE_SOUND` y `ACTION_SOUND`).

### Puente studio

El studio **ya tenía** un estado `warning` con imagen propia, así que el mapeo
es **1:1** en ambos sentidos y el estado se conserva de ida y de vuelta:

```js
EGO_TO_STUDIO_STATE.warning  = 'warning'   // aviso ámbar "!" del studio
STUDIO_TO_EGO_STATE.warning = 'warning'   // ida y vuelta conservada
```

**Consecuencia:** `ratelimit` **deja de reclamar** esa imagen y pasa a
`bored` — el estado cansado del studio, que es exactamente lo que `ratelimit`
ya expresaba en el motor SVG (pose `tired` + sudor). Así **cada imagen del
studio corresponde a un único estado de Ego** y el dock no miente. Por
coherencia, `EGO_SOUND_TO_STUDIO_SOUND.rate` pasa a `bored` también.

*Coste aceptado:* el round-trip `ratelimit → bored → idle` es **lossy** (antes
era `ratelimit → warning → ratelimit`). El mapa inverso del studio ya es
lossy por diseño ("mejor esfuerzo para transiciones nacidas en el canvas") y lo
es en varios casos (`thinking → waiting → waiting`, `approval → waiting →
waiting`). La pérdida se asume para que la imagen del aviso no se
desambigue.

---

## 3. T2 — Delta de la golden (168 → 174) y prueba de no-regresión

La golden (`packages/avatar/tests/golden/geometry.json`) pasó de **168 a 174**
combinaciones (29 × 6 módulos).

**Qué se añadió y por qué.** La golden cubre la geometría del **motor canvas**
(6 módulos de `src/studio/render/`). La imagen de studio del estado `warning`
**ya estaba cubierta** (el studio tenía ese estado antes de que existiera el
estado de Ego): el combo `warning` de la golden es el mismo. Lo que **no**
estaba cubierto, y es la geometría **nueva** que esta ola cambia, es la imagen
que `ratelimit` pasa a tener: el estado `bored` del studio. Por eso se añade
**un** combo nuevo (`ratelimit`, con `S.state = 'bored'`) y el total pasa
exactamente de 168 a 174.

**Prueba de que las 168 anteriores no cambiaron** (diff traza a traza entre la
golden vieja y la nueva, antes de sobrescribir):

```
antes: 168  ahora: 174
  ANADIDAS (6):
    + ratelimit/body
    + ratelimit/ears
    + ratelimit/ears-back
    + ratelimit/mouth
    + ratelimit/accessory
    + ratelimit/eyes
  ELIMINADAS (0):
  PREEISTENTES MODIFICADAS: 0  (debe ser 0)
```

**El mecanismo de no-regresión no cambia**: sigue siendo la **traza de
operaciones de canvas** (`scripts/compare-geometry.mjs`), que es determinista al
100 % — la misma entrada produce siempre la misma traza, sin navegador. No se
usa comparación de píxeles: se midió hasta un **12 % de ruido** entre sesiones
de navegador distintas con el mismo código, de modo que un gate por píxeles
daría falsos rojos y falsos verdes.

Lo que la golden **no** cubre (y queda cubierto por los tests unitarios): la
geometría del **motor SVG**, donde vive la novedad de esta ola (la insignia
`⚠` y la pose `warn`). `tests/warning.test.js` la fija por comportamiento: el
markup de la insignia, su visibilidad, y que aviso y error sean excluyentes.

---

## 4. TDD — test rojo demostrado

`packages/avatar/tests/warning.test.js` (8 casos, nuevo). **Rojo primero**, con
la salida real:

```
$ node --test tests/warning.test.js
  not ok 1 - warning existe en la tabla de estados con la forma de los demás
  not ok 2 - warning: pose, movimiento, insignia y sonido existen de verdad
  not ok 3 - warning NO se confunde con error (fallo duro) ni con ratelimit
  not ok 4 - warning es renderizable por el motor SVG
  not ok 5 - el elemento acepta el estado `warning`
  not ok 6 - puente studio: warning se conserva de ida y de vuelta
  not ok 7 - el motor de estados acepta `warning` en su prioridad
  error: 'el estado `warning` debe existir'
  error: "Cannot read properties of undefined (reading 'pose')"
  error: "Cannot read properties of undefined (reading 'tint')"
  error: 'la insignia de aviso debe estar en el markup'
  error: '[ego-avatar] estado desconocido: "warning"'
  # tests 7   # pass 0   # fail 7
```

Verde tras la implementación (más un 8º caso, exclusividad de insignias):

```
  ok 1 - warning existe en la tabla de estados con la forma de los demás
  ok 2 - warning: pose, movimiento, insignia y sonido existen de verdad
  ok 3 - warning NO se confunde con error (fallo duro) ni con ratelimit
  ok 4 - warning es renderizable por el motor SVG
  ok 5 - las insignias de aviso y de error son excluyentes
  ok 6 - el elemento acepta el estado `warning`
  ok 7 - puente studio: warning se conserva de ida y de vuelta
  ok 8 - el motor de estados acepta `warning` en su prioridad
  # tests 8   # pass 8   # fail 0
```

**Un fallo del test descubrió un fallo de diseño** (no se relajó el test):
`warning` compartía el movimiento `breathe` con `ratelimit`. Se corrigió el
**diseño** (`sway`, y `glow` 0.45 → 0.4, un valor único en la tabla), no la
aserción.

**Un bug real encontrado por la vista previa** (no por los tests): las clases
hijas de la insignia (`badge-warn-frame`, `badge-warn-bar`, `badge-warn-dot`)
comparten prefijo con `badge-warn`, y el `replace` de `render/static.js` por
`class="badge-warn"` **corrompía** el `class` de los hijos
(`class="badge-warn" visibility="visible"-frame`). Corregido en el origen
(lookahead `(?![-\w])` en el regex de `setVis`) y cubierto por el test 8.

---

## 5. T4 — Para A4: el diff exacto que falta en el renderer

> `apps/desktop/renderer/**` es zona de A4. **No lo he tocado.**
> El motor ya acepta `warning`; sólo falta que el renderer lo produzca.

### 5.1 `components/character/CharacterBadge.tsx` — el mapa de estados

Estado actual (líneas ~55-95): `mapCharacterStateToAvatarState` no tiene caso
`warning`, así que cae en `default: return "idle"`.

```diff
--- a/apps/desktop/renderer/components/character/CharacterBadge.tsx
+++ b/apps/desktop/renderer/components/character/CharacterBadge.tsx
@@ -84,6 +84,10 @@ export function mapCharacterStateToAvatarState(state?: CharacterState | string): string {
       case "dizzy":
         return "dizzy";
+      // `warning` = degradacion tolerable: algo fallo pero el turno continua
+      // (p. ej. una tool que devuelve error). El motor lo pinta en
+      // amarillo-caution con un triangulo; sin esta rama caeria en "idle".
+      case "warning":
+        return "warning";
       default:
         return "idle";
     }
```

**Por qué aquí y no en otro sitio:** esta función es la **frontera** entre el
vocabulario del chat y el del motor. `warning` ya existe en el tipo
`CharacterState` del chat (`character-state.ts`), de modo que el hueco no es
de tipo sino de traducción. La rama nueva no cambia ningún otro caso.

### 5.2 `components/ego-chat.tsx` — `avatarLiveState`

Estado actual (líneas ~793-819): el bloque de `toolEvents` sólo mira
`tool_call`/`tool_start`; un `tool_error` cae a la rama del mensaje y el
avatar queda en `thinking`/`generating`.

```diff
--- a/apps/desktop/renderer/components/ego-chat.tsx
+++ b/apps/desktop/renderer/components/ego-chat.tsx
@@ -795,6 +795,13 @@ export function EgoChat(...) {
         if (toolEvents.length > 0) {
           const lastTool = toolEvents[toolEvents.length - 1];
           if (lastTool && (lastTool.kind === "tool_call" || lastTool.kind === "tool_start")) {
             const tName = lastTool.toolName.toLowerCase();
             if (tName.includes("search") || tName.includes("memory") || tName.includes("vanta")) {
               return "searching";
             }
             return "using_tool";
           }
+          // Una tool fallo pero el turno continua: el avatar debe avisar
+          // (estado `warning` del motor) en vez de quedarse en thinking.
+          // Solo si el ULTIMO evento de tool es un error: si despues arranco
+          // otra tool, el ultimo evento vuelve a ser tool_call y el avatar
+          // muestra "using_tool" con normalidad.
+          if (lastTool && lastTool.kind === "tool_error") {
+            return "warning";
+          }
         }
```

### 5.3 Precedencia (razonada, no arbitraria)

| Orden | Señal | Estado | Por qué en ese puesto |
|---|---|---|---|
| 1 | `pendingApprovals.length > 0` | `approval_required` | Requiere una decisión **humana ya**: nada del turno compite con un aviso de herramienta. |
| 2 | `activeError` | `error` | Fallo **duro**: el turno se está abortando. Un aviso tolerable no puede tapar un error real. |
| 3 | último `toolEvent.kind === "tool_error"` | **`warning`** | Degradación **tolerable**: la tool falló y el modelo sigue. Va dentro de `if (isStreaming)`, así que si el turno **abortó** (ya no hay streaming) no se muestra: manda `error` o se vuelve a `idle`/`listening`. |
| 4 | streaming | `searching` / `using_tool` / `thinking` / `generating` | Trabajo normal. |
| 5 | `composerText` no vacío | `listening` | El usuario está escribiendo. |
| 6 | — | `idle` | Reposo. |

El caso 3 va **dentro** del bloque de streaming y **después** del chequeo de
`tool_call`/`tool_start` por una razón concreta: los eventos de tool y los
trozos de texto llegan por **arrays distintos** (`toolEvents` frente a
`messages`). Si el modelo escribe texto de recuperación después del error, el
último `toolEvent` **sigue siendo** `tool_error`, y el avatar debe seguir
avisando: es exactamente la información que el usuario necesita. En cuanto
arranca otra tool, el último evento vuelve a ser `tool_call` y el avatar
vuelve a `using_tool` sin intervención manual.

### 5.4 El test que lo demuestra (comportamiento, no texto de fuente)

El `useMemo` vive dentro de un componente grande, así que **no es testeable
tal cual**. Propuesta para A4: extraer la resolución a una función pura y
testearla por comportamiento.

```ts
// apps/desktop/renderer/components/character/avatar-live-state.ts  (nuevo, A4)
export type ToolEventKind =
  | "tool_call" | "tool_result" | "tool_start" | "tool_end" | "tool_error";

export interface ToolEventLike {
  kind: ToolEventKind;
  toolName: string;
}

export function resolveAvatarLiveState(input: {
  pendingApprovals: number;
  activeError: boolean;
  isStreaming: boolean;
  toolEvents: ToolEventLike[];
  lastAssistantText: string | null;
  composerText: string;
}): CharacterState { /* … la logica del useMemo, sin hooks … */ }
```

Test de comportamiento (spec, no snapshot de texto):

```ts
// apps/desktop/renderer/test/avatar-live-state.test.ts  (nuevo, A4)
import { describe, expect, it } from "vitest";
import { resolveAvatarLiveState } from "../components/character/avatar-live-state";

const base = {
  pendingApprovals: 0,
  activeError: false,
  isStreaming: true,
  toolEvents: [],
  lastAssistantText: "algo",
  composerText: "",
};

describe("resolveAvatarLiveState", () => {
  it("muestra warning cuando la ultima tool fallo y el turno continua", () => {
    expect(resolveAvatarLiveState({
      ...base,
      toolEvents: [{ kind: "tool_call", toolName: "fs_read" },
                   { kind: "tool_error", toolName: "fs_read" }],
    })).toBe("warning");
  });

  it("un error duro tiene prioridad sobre el aviso", () => {
    expect(resolveAvatarLiveState({
      ...base,
      activeError: true,
      toolEvents: [{ kind: "tool_error", toolName: "fs_read" }],
    })).toBe("error");
  });

  it("la aprobacion humana tiene prioridad sobre el aviso", () => {
    expect(resolveAvatarLiveState({
      ...base,
      pendingApprovals: 1,
      toolEvents: [{ kind: "tool_error", toolName: "fs_read" }],
    })).toBe("approval_required");
  });

  it("si el turno se aborta, el aviso no se queda colgado", () => {
    expect(resolveAvatarLiveState({
      ...base,
      isStreaming: false,
      toolEvents: [{ kind: "tool_error", toolName: "fs_read" }],
    })).toBe("idle");
  });

  it("una tool nueva despues del error vuelve al trabajo normal", () => {
    expect(resolveAvatarLiveState({
      ...base,
      toolEvents: [{ kind: "tool_error", toolName: "fs_read" },
                   { kind: "tool_call", toolName: "fs_write" }],
    })).toBe("using_tool");
  });

  it("el mapa del badge traduce warning sin perderlo", () => {
    expect(mapCharacterStateToAvatarState("warning")).toBe("warning");
  });
});
```

El último caso es el que cierra el circuito: sin la rama del mapa (§5.1), el
estado se perdería aunque `avatarLiveState` lo devolviera.

> A4: si prefieres **no** extraer la función pura, el test puede montarse
> sobre el componente (`@testing-library/react`) renderizando `EgoChat` con
> `toolEvents` inyectados y leyendo el atributo `state` del `<ego-avatar>`.
> La extracción es lo que recomiendo porque hace el test determinista y sin
> DOM.

---

## 6. Verificación

| Comando | Exit | Resumen |
|---|---|---|
| `node --test packages/avatar/tests/` | **0** | **274 pass / 0 fail** (266 + 8 nuevos) |
| `pnpm --filter @ego/avatar typecheck` | **0** | `tsc -p tsconfig.json`, 0 errores |
| `pnpm --filter @ego/avatar build` | **0** | 50 ficheros en `dist/` + manifiesto SHA-256 |
| `node packages/avatar/scripts/compare-geometry.mjs --check …` | **0** | **174/174** combinaciones idénticas a la golden |
| `node packages/avatar/scripts/sync-check.mjs` | **0** | SIN DRIFT (código + legales + corpus) |
| `node packages/avatar/scripts/check-attribution.mjs` | **0** | cadena MIT resoluble |

---

## 7. Ficheros tocados en la Ola 2

| Fichero | Cambio |
|---|---|
| `packages/avatar/src/runtime/states.js` | estado `warning`; `STATE_SOUND.warning = 'tick'`; `warning` en la `PRIORITY` |
| `packages/avatar/src/runtime/poses.js` | pose `warn` (nueva) |
| `packages/avatar/src/render/parts.js` | insignia `warn`: triángulo ⚠ con trazos propios |
| `packages/avatar/src/runtime/avatar-element.js` | nodos de la insignia `warn` + color + visibilidad |
| `packages/avatar/src/render/static.js` | `setVis('badge-warn', …)` + **fix** del regex por prefijo compartido |
| `packages/avatar/src/studio/adapter.js` | `warning` 1:1 en ambos sentidos; `ratelimit → 'bored'`; `rate → 'bored'` |
| `packages/avatar/tests/warning.test.js` | **nuevo** — 8 casos de contrato |
| `packages/avatar/tests/states.test.js` | vocabulario de insignias ampliado + aserción de `warning` |
| `packages/avatar/scripts/compare-geometry.mjs` | combo `ratelimit` (imagen `bored` del studio) |
| `packages/avatar/tests/golden/geometry.json` | re-recordada: 168 → 174 (0 preexistentes modificadas) |
| `packages/avatar/README.md` · `DESIGN.md` | vocabulario, §5-bis con la justificación, recuento 174 |
| `packages/avatar/captures/svg-states.png` | **nuevo** — evidencia visual de los 4 estados |
| `docs/product/mascota.md` · `docs/architecture/character-system.md` | 15 estados + ficha de `warning` |
| `docs/research/character-audit-and-coucou-inventory.md` | §6.4 con el estado nuevo |
| `apps/desktop/renderer/floating/vendor/avatar/**` | re-sincronizado (SHA-256) |

---

## 8. Deuda / no resuelto

| # | Deuda | Dónde |
|---|---|---|
| 1 | **El renderer todavía no produce `warning`**: sin las diffs de §5, la señal `tool_error` se sigue perdiendo. Es lo único que queda para cerrar el hueco de producto. | **A4** |
| 2 | El round-trip `ratelimit → bored → idle` es lossy (antes `ratelimit → warning → ratelimit`). Coste asumido para que la imagen del aviso sea unívoca. Documentado en §2. | — |
| 3 | La geometría del **motor SVG** (insignia ⚠ y pose `warn`) no está en la golden: la golden cubre el motor canvas. Queda fijada por los tests unitarios, no por la traza. | Ola 2 (opcional) |
| 4 | `AGENTS.md` dice que el `any` del puente "está justificado en `packages/avatar/index.d.ts`"; en realidad la justificación vive en `src/runtime/studio-bridge.js` y `src/runtime/svg-export.js`. Corrección menor de ubicación. | **A1** |

---

RESULTADO: {
  agente: A6-avatar-ola2,
  status: COMPLETED,
  archivos_modificados: [
    "packages/avatar/src/runtime/states.js (estado warning + STATE_SOUND + PRIORITY)",
    "packages/avatar/src/runtime/poses.js (pose warn nueva)",
    "packages/avatar/src/render/parts.js (insignia warn: triangulo)",
    "packages/avatar/src/runtime/avatar-element.js (nodos/color/visibilidad de la insignia warn)",
    "packages/avatar/src/render/static.js (setVis badge-warn + fix del regex por prefijo compartido)",
    "packages/avatar/src/studio/adapter.js (warning 1:1; ratelimit -> bored; rate -> bored)",
    "packages/avatar/tests/warning.test.js (nuevo: 8 casos de contrato)",
    "packages/avatar/tests/states.test.js (vocabulario de insignias + asercion de warning)",
    "packages/avatar/scripts/compare-geometry.mjs (combo ratelimit)",
    "packages/avatar/tests/golden/geometry.json (re-recordada 168 -> 174, 0 preexistentes modificadas)",
    "packages/avatar/README.md (vocabulario + recuento 174)",
    "packages/avatar/DESIGN.md (tabla de estados + 5-bis + recuento 174)",
    "packages/avatar/captures/svg-states.png (nuevo: evidencia visual)",
    "packages/avatar/captures/harness/svg-samples.html (nuevo: harness de muestras SVG)",
    "apps/desktop/renderer/floating/vendor/avatar/** (re-sincronizado por SHA-256)",
    "docs/product/mascota.md (15 estados + ficha de warning)",
    "docs/architecture/character-system.md (15 estados + ficha de warning)",
    "docs/research/character-audit-and-coucou-inventory.md (6.4 estado warning)"
  ],
  hallazgos_resueltos: ["hueco de estado sin representacion visual (warning)"],
  verify: {
    tests: "274 passed / 0 failed (266 + 8 nuevos)",
    typecheck: "exit 0 (tsc --checkJs real)",
    geometry: "174/174 identicas a la golden (168 -> 174, 0 preexistentes modificadas)",
    sync: "exit 0 (codigo + legales + corpus)",
    attribution: "exit 0",
    build: "exit 0"
  },
  solicitudes_handoff: 2,
  solicitudes_handoff_detalle: [
    "A4: diff exacto del renderer (CharacterBadge.mapCharacterStateToAvatarState + ego-chat.avatarLiveState) y el test de comportamiento, en la seccion 5 de este handoff",
    "A1: corregir en AGENTS.md la ubicacion de la justificacion del `any` (esta en src/runtime/studio-bridge.js y src/runtime/svg-export.js, no en index.d.ts)"
  ],
  deuda_abierta: [
    "El renderer no produce `warning` hasta que A4 aplique los diffs de la seccion 5 (unico hueco funcional que queda)",
    "Round-trip ratelimit -> bored -> idle lossy (asumido y documentado)",
    "La geometria del motor SVG (insignia warn, pose warn) no esta en la golden: la cubren los tests unitarios"
  ],
  SKILLS_CARGADAS: [
    "test-driven-development (test rojo pegado con su salida; un fallo del test revelo un fallo de diseno y se corrigio el diseno, no la asercion)",
    "systematic-debugging (corrupcion de class por prefijo compartido, localizada renderizando el SVG y no leyendo codigo)",
    "documentation-skill (docs canonicos reescritos contra el motor real)",
    "code-review-and-quality (5 ejes; la vista previa visual y la golden como puertas de envio)"
  ]
}
