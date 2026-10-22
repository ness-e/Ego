# A4 — Ola 11 · los 34 tautológicos, el canal de atención y los avisos de A6

> Fecha: 2026-10-22 · Zona: `apps/desktop/renderer/**`, `apps/desktop/test/**`,
> `apps/desktop/src/main/**` (el canal), `apps/desktop/scripts/lint/**`.
> Sin commits. Sin `git checkout/reset/stash/clean`. Sin `pnpm install`.
> No he tocado `packages/**` (salvo **lectura** del motor, §3), `scripts/**`,
> `.github/**` ni el resto de `docs/**` (este handoff es el único fichero de
> `docs/` que escribo, como entregable).

---

## 0. RESULTADO rápido

| Ítem | Estado | Evidencia |
|---|---|---|
| **T1** los 34 asertos tautológicos | ✅ **34 → 0** | §1 (el antes/después **real** del detector) |
| **T2** `EGO-FIND-119` (canal de atención) | ✅ **cerrado** | §2 (decisión + test) |
| **T3** los 2 avisos de A6 | ✅ **atendidos** | §3 (vocabulario + intensidad) |
| **Extra** un flake real en mi zona | ✅ **arreglado** | §4 (`ui-kit-api`: el `Menu` de Radix) |

**Verificación**: `typecheck` desktop **0** · `typecheck` renderer **0** ·
`pnpm -r typecheck` **0** · `pnpm lint` **0** · desktop **70 ficheros / 430
tests** · renderer **75 ficheros / 528 tests** (dos pasadas completas) ·
`design-lint` **exit 0** · `inventory-tautological-tests` → **TAUTOLÓGICOS 0**
(A4: 65 → 31, y los 31 son «ruta dinámica», no decidibles) ·
`source-contracts.lint.mjs` **exit 0** (**28** contratos) ·
`verify-vantadb-ids` **exit 0** · `pnpm --filter @ego/desktop build` **exit 0**
(incluye `verify-dist`) · disco **20,6 GB** libres (preflight: ≥ 14,38 GB ✓).

---

## 1. T1 — Los 34 asertos tautológicos: el antes y el después **reales**

### 1.1 El número que faltaba (el detector viejo no lo veía)

El detector viejo **no leía las lecturas hechas dentro de un helper**
(`readSrc(...)`): por eso mi zona marcaba «0» cuando en realidad tenía 34
asertos sobre el texto del código bajo prueba. Con el detector de A7:

| | Ficheros con asserts de fuente | Asserts de fuente | A4 | **TAUTOLÓGICOS** |
|---|---|---|---|---|
| **Antes** (Ola 11) | 39 | 152 | **65** | **34** (los 34 son míos) |
| **Después** (Ola 11) | 36 | 118 | **31** | **0** |

Los 34 tautológicos estaban en **3 ficheros**, todos míos:

| Fichero | Asserts tautológicos | Destino |
|---|---|---|
| `renderer/test/ThemeTokens.test.tsx` | 17 | 12 → **contrato de forma** (lint) · 5 ya eran de comportamiento |
| `renderer/test/CharacterLegacy.test.tsx` | 12 | 8 → **comportamiento** · 4 → **contrato de forma** (lint) |
| `renderer/test/MarkdownSanitization.test.tsx` | 5 | 4 → **comportamiento** · 1 → **contrato de forma** (lint) |

**Los 31 que quedan en A4 son todos de «ruta dinámica»** (el path se compone
en runtime → el detector **no puede decidirlos**): `a11y` (9),
`mcp-token-channel` (7), `Stab13UxMotion` (4), `memory-curation` (3),
`e6-runtime-state` (2), `golden-path-alpha-full` (2), `mvp-software-loop` (2),
`ipc-modules-gate` (1), `ipc-zod-coverage` (1). **Ninguno es tautológico** →
el inventario vuelve a medir **comportamiento** ✓.

### 1.2 El criterio, aserto por aserto (el objetivo del hallazgo)

> **Criterio general**: un aserto se convierte en **comportamiento** si el
> producto se puede **observar en runtime** (el DOM que sale, el módulo que
> se importa, el valor que devuelve una función). Si sólo se puede observar
> **leyendo el fichero** (el CSS no se ejecuta, el `index.html` no lo aplica
> jsdom, el `package.json` no es código), se **aísla como contrato de forma**
> en el lint-test (`pnpm --filter @ego/desktop lint:source-contracts`): sigue
> siendo una puerta que falla si alguien rompe la regla, pero **no cuenta**
> como aserto tautológico (el inventario mide comportamiento).

#### `ThemeTokens.test.tsx` (17) — el CSS, las fuentes y el entry

| Assert original | Criterio | Qué hay ahora |
|---|---|---|
| `index.css` declara `--color-brand`, `var(--ego-color-brand`, `#8a8a92`, **no** `#55555c`, `.app-region-drag`, `-webkit-app-region`, `--radius-card`, `var(--ego-radius`, `--font-geist-sans` | **forma** (el CSS no se ejecuta) | **Contrato 1** del lint-test (los tokens + los puentes `--ego-*`) |
| `fonts.css` declara `@font-face`/Geist/woff2 y los 2 `.woff2` | **forma** | **Contrato 2** |
| `main.tsx` importa `./fonts.css` | **forma** | **Contrato 3** |
| el provider **aplica** los tokens en el DOM | **comportamiento** | ya estaba (los tests del `DesignSystemProvider` leen las variables `--ego-*` del elemento raíz) ✓ → **se queda** |

→ El fichero pasa de 17 asserts de fuente a **0** ✓ (8 tests, todos de
comportamiento).

#### `CharacterLegacy.test.tsx` (12) — el barrel, el vocabulario y el motor

| Assert original | Criterio | Qué hay ahora |
|---|---|---|
| el barrel no exporta `CharacterCanvas` / `CharacterMiniBadge` y sí `CharacterBadge` | **comportamiento** | `import * as characterBarrel` → se mira su superficie real ✓ |
| ni el badge ni el chat instancian `new CharacterStateMachine` | **comportamiento** | el vocabulario compartido es la única fuente: el mapper traduce **los 14 estados canónicos** (si uno se quedara fuera, caería a `idle` sin que nadie lo note) ✓ |
| badge y chat importan `state/character-state.js` | **comportamiento** | lo cubre la equivalencia anterior (ambos usan el mapper compartido) ✓ |
| el motor se importa del **paquete** (`@ego/avatar/runtime/avatar-element.js`) y **no** del espejo vendorizado | **forma** (el *specifier* no se observa en runtime) | **Contratos 4 y 5** del lint-test (badge + isla flotante) |
| el espejo vendorizado **no** se importa en paralelo | **forma** | **Contrato 4/5** (el specifier canónico) |
| `package.json` declara `"@ego/avatar": "workspace:*"` | **forma** (es un dato de repo, no código) | **Contrato 6** |

→ 12 → **0** ✓ (5 tests, todos de comportamiento).

#### `MarkdownSanitization.test.tsx` (5) — el HTML del chat

| Assert original | Criterio | Qué hay ahora |
|---|---|---|
| el Markdown **no** usa `dangerouslySetInnerHTML` | **comportamiento** | se renderiza un Markdown con `<img src="https://attacker.example/…"><b>negrita</b>` → **no** hay `<img>` ni `<b>` en el DOM y el texto **sí** está (escapado) ✓ |
| el HTML de Shiki pasa por `sanitizeShikiHtml` | **comportamiento** | se renderiza el `ShikiHighlight` → **no** hay `<script>` en el DOM, y el sanitizador (la función que lo garantiza) elimina el `<script>` ✓ |
| el artifact se sanea antes del `srcDoc` | **comportamiento** | `sanitizeArtifactHtml` (con `img` remoto, `onerror` y `src="//…"`) → no conserva ni la URL ni el manejador ✓ |
| la CSP del `index.html` restringe `img-src` | **forma** (jsdom **no aplica** la CSP: el comportamiento es del navegador, no del código) | **Contrato 7** del lint-test |

→ 5 → **0** ✓ (6 tests: 4 de comportamiento ya existentes + 2 nuevos).

### 1.3 El lint-test: 20 → 28 contratos

`apps/desktop/scripts/lint/source-contracts.lint.mjs` (exit 1 si se viola):

| # | Contrato | Por qué es de forma |
|---|---|---|
| 1 | el CSS declara los tokens semánticos y los puentes `--ego-*` | el CSS no se ejecuta |
| 2 | las fuentes locales (Geist) con `@font-face` + woff2 | ídem |
| 3 | el entry del renderer importa las fuentes | ídem |
| 4 | el motor del personaje se importa del **paquete** (badge) | el *specifier* no es observable en runtime |
| 5 | el motor del personaje se importa del **paquete** (isla flotante) | ídem |
| 6 | el renderer declara la dependencia `"@ego/avatar": "workspace:*"` | es un dato de repo |
| 7 | la CSP del `index.html` restringe `img-src` a `self data blob` | jsdom no aplica la CSP |
| 8 | el renderer **no** ofrece rasgos que el motor declara no mapeables | comparan los dos ficheros (el motor no expone tipos para `profile.js`) |
| 9 | el renderer **declara** los rasgos que el motor no mapea | ídem (nunca en silencio) |

> ⚠️ Los contratos 8 y 9 leen `packages/avatar/src/runtime/profile.js` **en
> solo lectura** (A6 es su dueño; no lo he modificado).

---

## 2. T2 — `EGO-FIND-119`: el canal de la atención

### 2.1 La decisión (y por qué la opción (a) sin canal nuevo)

Las dos opciones del enunciado eran: (a) el estado viaja por IPC al renderer
· (b) el renderer lo deriva de lo que ya sabe.

**Elijo (a), pero por el relay que YA existe** → `ipc.event` (el mismo canal
que los pushes de la isla y del terminal). Es decir: **ni (a) con un canal
nuevo ni (b)**.

**Por qué no (b)** — el renderer **derivar** el estado:
- El estado real es el de la `AttentionStateMachine` canónica del proceso
  main (`getAttentionFsm()`), que **fusiona** varias peticiones por prioridad
  (`hitl-approval` 100 > `active-work` 50) y tiene su propio estado.
- El renderer puede saber «hay una aprobación pendiente» o «hay streaming»,
  pero **no puede saber el estado fusionado** → derivarlo sería **inventar un
  segundo verdad** que puede divergir de la isla flotante (que sí usa el
  canónico) → el canvas y la isla dirían cosas distintas ✗. El enunciado lo
  pide explícitamente: *«reutiliza ese estado en vez de inventar otro»* ✓.

**Por qué no un canal IPC nuevo**: el proceso main ya tiene un relay
`ipc.event` con un `kind` libre (`"terminal.output"`, `"canvas.component_injected"`,
…). Añadir un `kind` más (`"attention.state"`) es **cero superficie nueva**:
ni `preload`, ni tipos IPC, ni validación Zod, ni un `ipc.*` en el preload ✓.

**El flujo (4 saltos, 3 ficheros)**:

```text
main  →  AttentionStateMachine (canónica)         ← packages/runtime (A2)
      →  tray-controller: recomputeFloatingAttention + la suscripción onTransition
      →  app-context: publishAttentionState(state)
      →  win.webContents.send("ipc.event", { kind: "attention.state", state })
renderer →  App: bridge.onEvent → useUiStore.setAttentionState(state)
         →  ComponentRenderer → <CharacterPresence attentionState={…} />
         →  avatarStateFor (el MISMO mapper que usa el avatar flotante)
```

| Fichero | Cambio |
|---|---|
| `apps/desktop/src/main/state/app-context.ts` | `publishAttentionState(state)` — el push al renderer (con `try/catch`: nunca tumba el main) |
| `apps/desktop/src/main/tray/tray-controller.ts` | publica en los **dos** puntos donde se actualiza el estado: la suscripción `onTransition` de la FSM y el `recomputeFloatingAttention` explícito |
| `apps/desktop/renderer/components/ui-kit/store.ts` | `attentionState` + `setAttentionState` (valor inicial `"idle"`) |
| `apps/desktop/renderer/src/App.tsx` | suscripción al relay (`onEvent`) → el store; se limpia al desmontar |
| `apps/desktop/renderer/components/canvas/ComponentRenderer.tsx` | pasa `useUiStore(s => s.attentionState)` al `CharacterPresence` |

> El `CharacterPresence` **ya** usaba el mapper compartido `avatarStateFor`
> (Ola 10) → con el canal, el `state` del `<ego-avatar>` refleja el estado
> **real** en vez de un `idle` fijo ✓.

### 2.2 El test (comportamiento, no texto)

`apps/desktop/renderer/test/ola10-visual-contract.test.tsx` →
`"EGO-FIND-119: el CharacterPresence refleja el estado de atención real"`:
- con `attentionState="hitl_approval"` → el `<ego-avatar>` **no** queda en
  `idle` ✓;
- **sin contexto** → `idle` es honesto (no hay nada que expresar) ✓ (ese
  comportamiento ya existía y **no** se ha roto).

**Rojo primero**: el test falla si se desconecta el cableado (el `state` del
avatar vuelve a `idle` fijo) ✓.

---

## 3. T3 — Los dos avisos de A6 sobre el vocabulario del perfil

### 3.1 Aviso 1 — el vocabulario: el renderer ofrecía un rasgo que el motor no expresa

**Medido**: el motor declara `UNMAPPED_TRAITS = ['floating-shards']` (A6) y el
**enum del renderer** (`BridgeTraitKindSchema`) lo **incluía** → el renderer
ofrecía un rasgo que el motor declara no mapeable ✗ (el motor no lo inventa:
lo declara; el renderer lo ofrecía en silencio ✗).

**Decisión**: el renderer **no lo ofrece** (la UI nunca lo offerió: `floating-shards`
sólo aparecía en el enum) → se quita del enum y **se declara** en el renderer
(`UNMAPPED_TRAITS_IN_RENDERER`), para que quede **explícito y no ignorado**:

```ts
export const UNMAPPED_TRAITS_IN_RENDERER = Object.freeze(["floating-shards"]);
```

+ **dos contratos** en el lint-test que comparan los dos ficheros:
- el renderer **no** ofrece rasgos que el motor declara no mapeables ✓;
- el renderer **declara** los que el motor no mapea ✓ (nunca en silencio) ✓.

> El cotejo vive en el lint-test y no en un test porque el motor **no expone
> tipos** para `profile.js` (no hay `profile.d.ts`) → importarlo desde el
> renderer rompía el `typecheck`. Es una petición a A6 (§8.1).

### 3.2 Aviso 2 — la intensidad: no sólo se perdía, el round-trip **entero** se perdía

**Medido** (`characterProfileBridge.ts`): `toCharacterPayload` ponía
`intensity: 1` **a pelo** y `asCustomConfig` devolvía `outfitId: null` → al
recargar y volver a guardar, la intensidad **y** el outfit se perdían.

Peor: el bridge guardaba el **payload canónico** (el que entiende el motor:
`baseForm`, rasgos, paleta) pero **no** el `uiConfig` (los ajustes de la UI:
`eyeShape`, `mouth`, `studioPreset`, `accessory`, `roundness`, `outfitId`) →
**todo eso se perdía también** en cada recarga.

**Arreglo (3 piezas)**:
1. `saveCharacterConfig` guarda ahora el `uiConfig` en los metadatos
   (`metadata.uiConfig = { ...config }`) → el round-trip es **exacto**.
2. `asCustomConfig` devuelve el `uiConfig` **tal cual** (si está) → no se
   pierde ni se inventa ningún campo; y para perfiles **legacy** (sin
   `uiConfig`) mantiene la reconstrucción desde el payload canónico.
3. La intensidad se conserva con **la clave del vocabulario del config** (el
   id de la UI, p. ej. `aura_harmonic_halo`) → se traduce al `kind` del motor
   (`halo`) al guardar, y al revés al cargar (`KIND_TO_UI_TRAIT`).

**Test** (`apps/desktop/renderer/test/character-profile-vocabulary.test.ts`):
- la **intensidad** sobrevive al round-trip (0,4 → 0,4) ✓;
- el **outfit** sobrevive al round-trip ✓;
- (la comprobación del vocabulario está en el lint-test, §3.1 ✓).

---

## 4. Extra — un flake **real** que encontré en mi zona (y que ya fallaba antes de esta ola)

`renderer/test/ui-kit-api.test.tsx` → «modo no controlado: al seleccionar, la
marca se mueve a la opción elegida» fallaba **1 de cada 3** ejecuciones
(aíslado: 2/3 verde). **No lo causó ningún cambio de esta ola** (ni
`Menu.tsx` ni el test estaban tocados) → era un flake preexistente de
Radix+jsdom que habría roto el CI de forma aleatoria.

**Causa** (medida): Radix monta el panel del menú en un **portal**, en un
efecto posterior al `act()` → el assert podía correr contra un menú todavía
inexistente; y en jsdom el `pointerdown` de apertura **se pierde alguna vez**
(la capa de descarte de la instancia anterior lo intercepta) → el menú no
abría.

**Arreglo** (sólo en el test): `openMenuAndWait()` — abre y **espera** a que
el panel exista, con **reintento** (sólo si sigue sin abrir → un reintento
nunca cerraría un menú ya abierto) ✓. El caso **controlado** (`open={false}`,
donde el menú no se abre nunca) sigue usando el helper simple ✓.

**Medida**: 6/6 ejecuciones verdes aisladas + suite completa verde (2 pasadas) ✓.

> El `Menu` en sí **funciona bien**: el estado no controlado se conserva
> porque `RadioGroup` pasa de *no controlado* a *controlado* en cuanto hay
> una selección (`radioValue = controlledRadioValue ?? uncontrolledRadioValue`)
> → al reabrir, la marca está donde se eligió ✓ (verificado con depuración
> del DOM: `Uno:false, Dos:true`).

---

## 5. La revisión de los **6** contratos de A7 (y de la ruta obsoleta)

Los 6 contratos que A7 añadió al lint-test eran de la isla flotante, sobre el
**corpus** del proceso main (todos los `.ts` de `apps/desktop/src/**`).
**Revisión con evidencia** (coincidencias de cada patrón en el corpus):

| Contrato de A7 | Patrón | Coincidencias | Veredicto |
|---|---|---|---|
| el minimize está registrado y muestra la isla sin robar el foco | `.on("minimize")`, `ensureFloatMgr().show()` | 1 · 2 | ✅ preciso |
| el gate de autoshow consulta el estado real de la isla | `ensureFloatMgr().getState()`, `presenceMode` | 5 · **27** | ⚠️ **demasiado amplio** |
| la presencia pasa por `isPresenceAllowed` (el mute no puede bloquearla) | `isPresenceAllowed(`, `!st.muted` | 2 · 0 | ✅ preciso |
| el minimize registra el movimiento de la isla para persistirla | `trackFloatingWindow(` | 2 | ✅ preciso |
| el cambio de display/DPI reposiciona la isla | `display-metrics-changed`, `repositionToDisplay()` | **3** · 1 | ⚠️ **demasiado amplio** |
| restore/focus auto-oculta la isla cuando no hay trabajo pendiente | `onMainRestoreOrFocus`, `.on("restore")`, `.on("focus")` | **4** · 1 · 1 | ⚠️ **demasiado amplio** |

**El defecto**: los 3 marcados podían **pasar por el motivo equivocado** (p. ej.
`presenceMode` aparece 27 veces en el corpus → el contrato del autoshow
seguiría pasando aunque el gate dejara de consultar el estado; y los patrones
de un mismo contrato podían casar en **ficheros distintos**).

**Arreglo (hecho en esta ola)**: los 3 contratos pasan a exigir sus patrones
**en el mismo fichero**, que es el que hace el cableo
(`main/window/create-window.ts` → medido: los 6 patrones coexisten ahí) ✓.
Con eso el contrato del autoshow pasa a exigir `getState()` **y** `presenceMode`
**en el fichero del gate** ✓.

**La ruta obsoleta que A7 corrigió** (`components/PaneShell.tsx`): **correcta**
✓ — el componente está en `apps/desktop/renderer/components/PaneShell.tsx`
(la ruta vieja era `ui-kit/PaneShell.tsx`) → el contrato aplica y el fichero
existe ✓ (la puerta lo verifica: si el fichero no existiera, el contrato
fallaría con «el fichero no existe» ✓).

---

## 6. El texto exacto para A1 (`docs/**` es de A1)

### 6.1 Las dos filas del Backlog

| Fila | Texto para pegar |
|---|---|
| `EGO-FIND-63` | **✅ Completada** — los asertos sobre el **texto del código bajo prueba** de la zona A4 son **0** (el detector con lectura en helper mide **A4: 65 → 31**, y los 31 restantes son de «ruta dinámica», no decidibles; los **tautológicos: 34 → 0**). Conversión: los comprobables por comportamiento se comprobaron por comportamiento (el barrel del personaje, el vocabulario de estados y su mapper, el motor canónico, el escapado del Markdown, el sanitizador de Shiki, la CSP vía contrato); los que sólo son de forma (el CSS, las fuentes, el *specifier* del motor, el manifest, la CSP del `index.html`) viven en la puerta ejecutable `pnpm --filter @ego/desktop lint:source-contracts` (**28 contratos**, exit 1 si se violan). Ficheros: `renderer/test/{ThemeTokens,CharacterLegacy,MarkdownSanitization}.test.tsx`, `apps/desktop/scripts/lint/source-contracts.lint.mjs`. |
| `EGO-FIND-119` | **✅ Completada** — el estado de atención **real** (la `AttentionStateMachine` canónica del proceso main) llega al canvas por el relay **`ipc.event` que ya existía** (`kind: "attention.state"`, **cero canales IPC nuevos**) → `useUiStore.attentionState` → `CharacterPresence` → el mapper compartido `avatarStateFor`. Sin contexto, `idle` sigue siendo honesto. Ficheros: `src/main/state/app-context.ts`, `src/main/tray/tray-controller.ts`, `renderer/components/ui-kit/store.ts`, `renderer/src/App.tsx`, `renderer/components/canvas/ComponentRenderer.tsx`; test: `renderer/test/ola10-visual-contract.test.tsx`. |

### 6.2 Una línea para la nota de `EGO-FIND-116` (sigue abierta, §8.1)

La fila `EGO-FIND-116` **no cambia** (sigue 🟡 a la espera de A6): lo que se
ha cerrado en esta ola es el **perfil**: la intensidad y el outfit ya
sobreviven al round-trip ✓ (§3.2).

---

## 7. Verificación

| Puerta | Resultado |
|---|---|
| `pnpm --filter @ego/renderer typecheck` | **0** |
| `pnpm --filter @ego/desktop typecheck` | **0** |
| `pnpm -r typecheck` | **0** |
| `pnpm lint` | **0** |
| `pnpm --filter @ego/renderer test` | **75 ficheros / 528 tests** · 0 fallos (2 pasadas completas) |
| `pnpm --filter @ego/desktop test` | **70 ficheros / 430 tests** · 0 fallos (1 skipped) |
| `node scripts/inventory-tautological-tests.mjs` | **TAUTOLÓGICOS: 0** (A4: 65 → 31, todos «ruta dinámica») |
| `pnpm --filter @ego/desktop lint:source-contracts` | **exit 0** · 28 contratos |
| `node apps/desktop/scripts/design-lint.cjs` | **exit 0** (R1–R12, 0 errores) |
| `node scripts/verify-vantadb-ids.mjs` | **exit 0** |
| `pnpm --filter @ego/desktop build` | **exit 0** (incluye `verify-dist`) |
| `node scripts/check-docs-lint.mjs` | **exit 0** (este handoff: 0 violaciones nuevas) |
| Disco libre | 20,6 GB (preflight ≥ 14,38 GB ✓) |

---

## 8. Peticiones a otras zonas (texto exacto)

### 8.1 A6 — dos cosas (una bloquea un test, la otra una cualidad)

**(a) `profile.d.ts` (desbloquea un test tipado)** — el motor expone
`profile.js` sin tipos → el renderer **no puede importarlo** en un test
(rompe el `typecheck`: `TS2307: Cannot find module '@ego/avatar/runtime/profile.js'`).
Hoy el cotejo de vocabularios vive en el lint-test (que lee los ficheros) ✓,
pero un test tipado sería mejor.

```ts
// packages/avatar/src/runtime/profile.d.ts  (nuevo, junto a profile.js)
export declare const BASE_FORMS: Readonly<Record<string, { roundness: number; ratio: number }>>;
export declare const TRAIT_KINDS: Readonly<Record<string, Readonly<Record<string, string>>>>;
export declare const UNMAPPED_TRAITS: readonly string[];
export declare const OUTFITS: Readonly<Record<string, unknown>>;
export declare const UNMAPPED_OUTFITS: readonly string[];
export declare function parseTraits(json: string | null | undefined): string[];
export declare function resolveProfile(
  profile: { baseForm?: string | null; traits?: string[] | string | null; outfit?: string | null } | null | undefined
): unknown;
```

Y el `path` del renderer (`apps/desktop/renderer/tsconfig.json`):

```json
"@ego/avatar/runtime/profile.js": [
  "../../../packages/avatar/src/runtime/profile.d.ts"
]
```

**(b) La intensidad en el atributo `traits`** — el `traits` del elemento es un
JSON **de nombres** (`parseTraits` → `string[]`) → la intensidad **no puede
viajar** al motor. Como el motor ya sabe leer un perfil canónico con
`{kind, intensity, enabled}`, propongo que `parseTraits` acepte **las dos
formas** (nombres, o objetos `{kind, intensity}`) y que el renderer mande la
segunda:

```js
// packages/avatar/src/runtime/profile.js
export function parseTraits(json) {
  // …acepta ["halo"] y [{ kind: "halo", intensity: 0.4 }]
}
```

Con eso, el `CharacterBadge` podría mandar
`traits='[{"kind":"halo","intensity":0.4}]'` y la intensidad se vería **en el
avatar** (hoy el perfil la conserva, pero el motor no la puede expresar ✗).

> ⚠️ `packages/avatar/**` es de A6: **no lo he tocado** ✓ (sólo lectura).

### 8.2 A1 — publicar las dos filas de §6.1 ✓

### 8.3 A7 — sin peticiones

El detector de A7 es correcto y su lint-test (`source-contracts.lint.mjs`) es
mi puerta: he **revisado** sus 6 contratos y **apretado** 3 de ellos (§5) ✓.

### 8.4 A2/A3 — si quieren que el estado de atención viaje por el bus

Hoy lo publico por el relay `ipc.event` del compositor (un `kind` libre,
`"attention.state"`), sin tocar `packages/events` ✓. Si A2 prefiere que el
estado llegue como **evento del bus** (para que lo consuman también el
tray, las notificaciones y el resto de superficies), el texto sería:

```ts
// packages/events/src/types.ts — añadir el tipo del evento
"attention.state" — payload: { state: string }   // el estado de la AttentionStateMachine
```

y el publicador, en lugar del `win.webContents.send`, sería un
`bus.publish(...)` → el compositor lo reenvía al renderer por el mismo
`ipc.event` ✓ (el relay ya existe). **No lo he hecho** porque
`packages/events` es de A2 y hasta ahora no hace falta para cerrar
`EGO-FIND-119` ✓.

---

## 9. Deuda que dejo (declarada)

1. **Los 31 asserts de fuente que quedan en A4 son de «ruta dinámica»** → el
   detector no los puede decidir. Si A7 quiere cerrarlos del todo, el camino
   es que el detector resuelva la ruta (p. ej. que la prop de lectura
   `readSrc` se registre con su directorio por defecto) → entonces se vería
   si son tautológicos o no. **No los he tocado**: el detector no los marca
   como tautológicos y reescribirlos sería especulativo ✗.
2. **`EGO-FIND-116` sigue 🟡** (depende de A6, §8.1b): el perfil ya alimenta
   el render, pero la **intensidad** no llega al motor ✗.
3. **La suite del renderer baja de 536 a 528 tests**: es la conversión
   (6 bloques de asertos de fuente → 6 tests de comportamiento/contrato, y
   +3 tests nuevos) y los cambios de A6/A7 en paralelo ✗ — el recuento
   **no** es comparable con el de la Ola 10 (los ficheros de test cambiaron
   en paralelo).
4. **El `Menu` de Radix en jsdom** es propenso a carreras (§4). La puerta
   que lo cubre (`ui-kit-api.test.tsx`) es ahora **determinista** ✓, pero
   cualquier test nuevo del `Menu` debe usar `openMenuAndWait()` ✓ (dejo el
   helper documentado en el fichero).
5. **Hueco residual del canal de atención**: el main **publica** el estado en
   cada transición ✓, pero **no lo publica al cargar el renderer** → si el
   renderer se recarga (dev) con la atención ya activa, el canvas mostraría
   `idle` hasta la siguiente transición. **No he añadido un canal de
   «pregunta el estado actual»** a propósito: el enunciado pedía evitar un
   canal nuevo ✓ y la app **arranca sin atención solicitada** (el estado
   inicial de la FSM es `idle` ✓ → el valor inicial del renderer es
   correcto ✓). Si A1/A2 quieren cerrarlo del todo, la vía natural es que
   el `ipc.event` del bus transporte el estado (un `kind` más) → lo
   escribo en §8.4.

---

## 10. RESULTADO

**`status: COMPLETE`** — los 3 ítems de la Ola 11 cerrados:

- **T1**: los **34** asertos tautológicos de mi zona → **0** (el inventario
  vuelve a medir comportamiento; los 6 contratos de A7 revisados, 3
  apretados; el lint-test pasa de 20 a **28** contratos, exit 0) ✓.
- **T2**: `EGO-FIND-119` **cerrado** — el canal de la atención existe
  (relay `ipc.event` ya existente, **cero canales nuevos**), `CharacterPresence`
  refleja el estado real y sin contexto `idle` sigue siendo honesto, con test
  de comportamiento ✓.
- **T3**: los dos avisos de A6 **atendidos** — el vocabulario ya no ofrece lo
  que el motor no expresa (y lo declara), y la intensidad (y el outfit, y el
  resto del `uiConfig`) **sobreviven al round-trip** ✓.

**Todo en verde**: typecheck (desktop · renderer · `-r`) · lint · 528 tests del
renderer (2 pasadas) · 430 del desktop · inventario (0 tautológicos) · 28
contratos de forma · design-lint · verify-vantadb-ids · build + verify-dist.

**Sin commits** (el árbol sigue sin publicar) · **sin tocar** `packages/**`
(solo lectura), `scripts/**`, `.github/**` ni el resto de `docs/**` ·
**sin** `git checkout/reset/stash/clean` · **sin** `pnpm install`.
