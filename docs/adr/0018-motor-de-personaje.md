# ADR 0018: El motor de personaje de Ego es `@ego/avatar`; `CharacterEngine` queda como legado #

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-19 |
| Estado | Aceptado (parcial: la consolidación física de `CharacterEngine` —que ya no dibuja— queda pendiente; la FSM legacy **ya se retiró**) |
| Nivel jerárquico | 4.Architecture (`docs/jerarquia-canonica.md`) |
| Decisor | Owner (D5, 2026-10-19) · ejecución A6 |

## Contexto ##

Ego ha tenido dos motores de personaje vivos a la vez:

1. **`apps/desktop/renderer/components/character/core/CharacterEngine.ts`**
   (998 líneas) — motor Canvas 2D con siluetas `delta-core` / `squircle-core`,
   13 morfologías de ojos, Traits (`halo`, `energy-cores`, `antennae`…) y
   `CharacterCanvas.tsx` / `CharacterMiniBadge.tsx` como envoltorios React.
2. **`packages/avatar/`** (`@ego/avatar`, 47 ficheros `.js` en `src/`, 11 203
   líneas) — Web Component `<ego-avatar>` con motor SVG (genoma procedimental
   por semilla) y motor canvas *Robot Studio*; 14 estados runtime, 11 emotes,
   22 estados de studio, puente bidireccional de estados y 266 tests.

La auditoría del 2026-10-19 (`EGO-FIND-69`) encontró que el segundo motor
**es el que se ejecuta** y el primero **no dibuja nada**: `CharacterCanvas` y
`CharacterMiniBadge` están definidos y nunca renderizados (0 usos JSX), y
`CharacterEngine` sólo se usa hoy por sus **tipos** (`RGB`, `EyeShape`) y la
utilería `hexToRGB`. La FSM `CharacterStateMachine` tampoco se instancia: el
estado efectivo lo computa el `useMemo` de `ego-chat.tsx`.

Mientras tanto, la documentación canónica (`docs/architecture/character-system.md`,
`docs/product/mascota.md`, `docs/product/character-art-direction.md`) describía
el motor **legacy**, y ninguna mencionaba `<ego-avatar>`.

## Alternativas consideradas ##

- **Conservar los dos motores en paralelo** — descartada: dos fuentes de verdad
  para la identidad visual del producto; es exactamente el estado que la
  auditoría marcó como deuda (`EGO-FIND-69`).
- **Borrar `CharacterEngine` y sus envoltorios** — descartada **por ahora**:
  `CharacterEngine` sigue aportando los tipos `RGB` / `EyeShape` y la utilería
  `hexToRGB` que el renderer consume, y `CharacterCanvas.tsx` /
  `CharacterMiniBadge.tsx` son zona de A4. Borrarlos sin sustituto verificado
  rompería la compilación del renderer.
- **Declarar `@ego/avatar` como motor vigente y tratar el legacy como legado
  (elegida)** — consolida la verdad sin romper nada y deja la decisión física
  (archivar vs. absorber) explícitamente abierta.

## Decisión ##

1. **El motor de personaje de Ego es `@ego/avatar`** (`packages/avatar/`), expuesto
   como el Web Component `<ego-avatar>`. Es la única fuente de verdad de la
   identidad (genoma por semilla) y del estado (14 estados + 11 emotes).
2. **`CharacterEngine` y sus envoltorios quedan como legado.** No se borran en
   esta ola porque siguen aportando tipos y utilerías; su archivo (o su
   absorción) es una decisión posterior de A4 + owner.
3. **La documentación canónica se reescribe contra el motor real.** El
   vocabulario `delta-core` / `squircle-core` / `coucou-mochi` se marca
   explícitamente como legacy en los tres documentos de personaje.
4. **La identidad visual no incorpora la de Mochi.** La geometría del motor
   canvas es propia de Ego (`src/studio/render/geometry.js`); el preset
   `coucou-mochi` y las familias de ojo/boca heredadas se eliminaron. La prueba
   de no-regresión es una **traza de operaciones de canvas** (determinista, 168
   combinaciones), no un diff de píxeles.
5. **Se conservan las tres copias** del motor (upstream de referencia, paquete
   canónico, copia vendorizada) por decisión del owner del 2026-10-19. La
   divergencia silenciosa entre ellas se cierra con una puerta verificable por
   SHA-256 (`pnpm --filter @ego/avatar sync:check`).
6. **La FSM legacy de Ego se retira** (ratificado por el owner el 2026-10-20,
   *"avatar es el mejor"*). Ver §"Retirada de la FSM legacy" ##.

## Retirada de la FSM legacy ##

El commit `cce55ae` (2026-10-20) retiró del renderer
`components/character/state/CharacterStateMachine.ts` (396 líneas),
`components/character/CharacterCanvas.tsx` (124) y
`components/character/CharacterMiniBadge.tsx` (113), y los sustituyó por
`components/character/state/character-state.ts` (66) más un test de regresión
del contrato legacy (`apps/desktop/renderer/test/CharacterLegacy.test.tsx`).

**Motivo (verificado con evidencia):**

| | Motor canónico `@ego/avatar` | FSM legacy de Ego |
|---|---|---|
| Naturaleza | **Tabla de datos** de 14 estados + 11 emotes + `STATE_SOUND` + 22 estados de studio con puente bidireccional, más el motor que interpola (`core/anim.js` con easings/springs y *sub-stepping* a 240 Hz, poses ARA, micro-gestos, `fx-eyes`, sonido, partículas). | **Interpolador cinético** de 14 canales numéricos (`open`, `pulseSpeed`, `auraIntensity`, `accent`, `tint`, `tilt`, `energy`, `squashX/Y`), escrito en Ego (adaptación COUC-06) y atado al motor legacy `CharacterEngine.ts`. |
| ¿Se ejecutó? | Sí — es el motor que dibuja. | **Nunca se instanció** → su modelo de interpolación nunca llegó a ejecutarse. |
| Verificación | 266 tests · geometría golden 168/168 · sync SHA-256 entre las dos copias · cadena MIT resoluble. | Sin instanciación → sin verificación posible. |
| Origen | coucou, vía el repo `avatar` (MIT). | Escrito en Ego. |

**Principio D3 aplicado:** *usar las primitives de librería/framework, no
recrearlas desde cero*. El motor del repo `avatar` —con su licencia, sus tests
y su corpus de atribución— **es** la primitive; la FSM de Ego era la
reimplementación. Retirarla no es borrar capacidad: es **dejar de mantener dos
implementaciones de lo mismo**, de las que solo una funcionaba.

**Estado del vocabulario de estados** (tras el cambio):

- **9 estados coinciden** uno a uno.
- **4 cambian de nombre**, con equivalencia ya mapeada en
  `CharacterBadge.mapCharacterStateToAvatarState`:
  `approval_required → approval`, `generating | using_tool → working`,
  `attention → approval`.
- **`warning` no tenía equivalente.** Es el único hueco del vocabulario. **Cerrado
  en la Ola 2 (A6)**: el motor canónico ya define el estado
  (`packages/avatar/src/runtime/states.js:36,86,127` — tinte ámbar, pose
  `warn`, badge `warn`, sonido `tick`) y la geometría golden se re-recordó de
  **168 a 174** combinaciones (con `warning` ya dentro). El vocabulario del
  renderer también lo incluye: `character-state.ts:45` (`warning` en la unión de
  `CharacterState`) y `:62` (en `CANONICAL_CHARACTER_STATES`, 14 estados).
  *Pendiente residual (A4):* el diff que A6 entregó para que
  `avatarLiveState` (`ego-chat.tsx`) devuelva `"warning"` cuando el **último**
  evento de tool es `tool_error` — hoy ese evento cae en la rama del mensaje y
  el avatar se queda en `thinking` aunque el turno continúe. Es el **único**
  punto abierto de esta decisión, y es de la zona de A4.

**Consecuencia de la retirada:** `CharacterEngine.ts` (el motor Canvas 2D
legacy) sobrevive **solo por sus tipos** (`RGB`, `EyeShape`) y la utilería
`hexToRGB`, que consumen `TraitRegistry.ts` y `CharacterMorph.ts`. No dibuja
nada. Su archivo (o su absorción) sigue siendo una decisión posterior del
owner, igual que antes de esta retirada.

## Consecuencias ##

- El estado del personaje en el chat tiene una cadena de traducción explícita y
  documentada: `avatarLiveState` (chat) → `mapCharacterStateToAvatarState`
  (14→14) → `<ego-avatar>` → `EGO_TO_STUDIO_STATE` (14→22, sólo en modo canvas).
- `packages/avatar` es un **descendiente bifurcado** del *working tree* de
  `repos-referencia/avatar` (28 ficheros byte-idénticos, 16 bifurcados,
  5 nuevos). El upstream **no se modifica ni se commitea**: es material de
  referencia.
- El motor sigue siendo JavaScript plano con tipos públicos en `index.d.ts` y
  `checkJs` activo. La migración a TypeScript (que eliminaría el `any`
  justificado del puente con el studio) queda pendiente — excepción de tipado
  documentada en `AGENTS.md` §4.
- La consolidación física de `CharacterEngine.ts` queda **pendiente del owner**:
  qué se archiva, y si `CharacterProfile`/`traits` se traducen al modelo de
  genoma o se mantienen como una capa debaujo. (Desde el commit `cce55ae` el
  motor legacy **no dibuja nada**: sobrevive solo por sus tipos y
  `hexToRGB`.)
- El paquete canónico y la copia vendorizada quedan atados por
  `sync:check` (SHA-256); si divergen, el gate falla. Esto evita la
  deriva silenciosa que motivó `EGO-FIND-25`.

## Referencias ##

- `packages/avatar/` — `README.md`, `DESIGN.md`, `LICENSE`, `LICENSE.md`, `NOTICE`.
- `apps/desktop/renderer/floating/vendor/avatar/` — copia vendorizada.
- `packages/avatar/src/runtime/avatar-element.js` — Web Component `<ego-avatar>`.
- `apps/desktop/renderer/components/character/CharacterBadge.tsx` — consumidor del
  `<ego-avatar>` (único consumidor real del motor vigente).
- `apps/desktop/renderer/components/character/core/CharacterEngine.ts` — motor
  legacy (tipos + `hexToRGB`).
- `docs/product/mascota.md`, `docs/product/character-art-direction.md`,
  `docs/architecture/character-system.md` — reescritos contra el motor real (A6).
- `docs/roadmap/Backlog.md` — `EGO-FIND-24`, `25`, `67`, `68`, `69`, `70`.
- `AGENTS.md` §4 — excepción de tipado del motor de avatar.
