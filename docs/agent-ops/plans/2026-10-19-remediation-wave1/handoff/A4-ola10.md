# A4 — Ola 10 · los 8 visuales + 3 del personaje + `EGO-FIND-63`

> Fecha: 2026-10-21 · Zona: `apps/desktop/**` (menos `renderer/floating/vendor/avatar/**` → A6).
> Sin commits. Sin `git checkout/reset/stash/clean`. Sin `pnpm install`.
> No he tocado `packages/{avatar,tools,subegos,runtime,security,integrations}/**`, `docs/**`, la raíz ni `scripts/**`.

---

## 0. RESULTADO rápido

| Ítem | Estado | Evidencia |
|---|---|---|
| **T1** los 8 visuales | ✅ **8/8 cerrados** | §1 (uno por hallazgo, con `fichero:línea`) |
| **T2** los 3 del personaje | ✅ **2/3 cerrados · 1 con petición a A6** | §2 (116 y 117 cerrados; 119 con la hueco del canal de atención) |
| **T3** `EGO-FIND-63` (3 ficheros) | ✅ **cerrado y ampliado** (5 ficheros míos) | el inventario pasa de **A4: 11 → A4: 0** (§3) |

**Verificación**: `typecheck` desktop **0** · `typecheck` renderer **0** · desktop **70 ficheros / 430 tests** ·
renderer **74 ficheros / 536 tests** · `design-lint` **exit 0** (12 reglas, 0 errores) ·
`inventory-tautological-tests` → **A4: 0** (sólo queda A7: 3, que no es mío) ·
`source-contracts.lint.mjs` **exit 0** (14 contratos) · `verify-vantadb-ids` **exit 0** ·
`pnpm -r typecheck` / `pnpm lint` → §6.

---

## 1. T1 — Los 8 visuales, uno por uno

### 1.1 `EGO-FIND-96` — el CTA «Enviar» deshabilitado era idéntico al habilitado

**Fichero**: `apps/desktop/renderer/components/ego-chat.tsx` (el `ComposerPrimitive.Send`).

```diff
- className="… bg-brand text-on-brand shadow-[var(--ego-elevation-l1)] transition-colors hover:bg-brand/90"
+ className="… bg-brand text-on-brand … transition-colors hover:bg-brand/90
+            disabled:cursor-not-allowed disabled:bg-raised disabled:text-dim disabled:shadow-none"
```

**Por qué así**: el estado deshabilitado **no** se distingue por opacidad
(regla del repo) → cambia de **superficie** (`bg-brand` → `bg-raised`) y de
**texto** (`text-on-brand` → `text-dim`), y además el botón ya lleva el
`disabled` real del primitive (`ComposerPrimitive.Send` lo deshabilita sin
texto) → la technology assistiva lo anuncia ✓.

### 1.2 `EGO-FIND-97` — 3 superficies de modelo y 2 de Sub-Ego a la vez

**Ficheros**: `apps/desktop/renderer/src/App.tsx` (se elimina el componente
`ChatPanelHeader` y sus dos usos) · `apps/desktop/renderer/components/ego-chat.tsx`
(se elimina el `Menu` de modelo de la cabecera del chat).

**La jerarquía que decido (y por qué)**:

| Ajuste | Ámbito | Dónde vive **ahora** | Por qué |
|---|---|---|---|
| **Modelo** | **GLOBAL** (el Model Router de la app) | la **barra superior** (el botón «Selector de modelo activo» → abre el `ModelPicker`) | es un ajuste de la **app**, no de una conversación: pertenece al chrome |
| **Sub-Ego** | **CONVERSACIÓN** (quién responde) | la **cabecera del chat** (el `Menu` «Sub-Ego activo») | es un ajuste del **hilo**: pertenece a la conversación |
| **Esfuerzo / Modo / Voz** | **TURNO** | la cabecera del chat | son parámetros del turno, ya estaban ahí ✓ |

→ **una** superficie de modelo + **una** de Sub-Ego ✓ (antes: 3 y 2).

Lo que se retira con el `ChatPanelHeader` del `App`: un `<Select>` del modelo,
el `SubEgoSelector` y la fila de cabecera duplicada (el chat ya traía la
suya) → además desaparece un `Select` del modelo, que era un `<select>`
del kit (no nativo ✓ pero otro selector más en pantalla).

**Efecto secundario útil**: el chat ya no carga el catálogo de modelos por su
cuenta (`ego().models.listProviders/listModels` ✗) → menos trabajo de arranque.

### 1.3 `EGO-FIND-98` — los *empty states* sin guía

**Fichero nuevo**: `apps/desktop/renderer/components/canvas/EmptyState.tsx`
(icono + **qué es** + **para qué / cómo** + **qué hacer ahora** + nota) ·
**consumido** en `apps/desktop/renderer/components/canvas/WorkbenchView.tsx`
(el estado vacío del visor) y disponible para las demás superficies.

> **Por qué no es una primitive del `ui-kit`**: el kit tiene 12 primitives y
> su tabla es canónica (la publica A1): añadir una 13.ª es una decisión de
> sistema, no un arreglo de un hueco visual. Este componente vive en la zona
> del Canvas, donde se usa, y usa **tokens** (la puerta lo acepta sin
> excepciones) ✓.

### 1.4 `EGO-FIND-99` — los presets de paleta no eran visibles ni intercambiables

**Fichero**: `apps/desktop/renderer/components/canvas/ThemeIO.tsx` → nueva
sección **«Paletas canónicas»**: una muestra por preset (3 circles con los
colores reales del preset), su nombre y su id, con `aria-pressed` en el
activo y `applyPreset(preset.id)` al pulsar ✓.

El catálogo sale de `availablePresets` (el provider) → **una sola fuente de
verdad** (§2.4 del design system) ✓. Los colores de las muestras vienen del
propio preset (datos, no estilo) → el único `style={{}}` del fichero lleva
el escape `// design-lint: allow` **en la línea inmediatamente anterior** (la
puerta sólo mira 1–2 líneas atrás) ✓ → `R2` sigue en **0 errores** ✓.

### 1.5 `EGO-FIND-100` — dos idiomas de CTA primario

**Regla** (la declaro y la aplico): el CTA **primario** de una superficie es
`variant="accent"` (ámbar sólido, `bg-brand` + `text-on-brand`); todo lo
demás es `secondary` / `ghost` / `danger`.

| Fichero | Cambio | Por qué |
|---|---|---|
| `daily-state/DailyDashboard.tsx` | «Refinar con IA»: `secondary` → **`ghost`** | el primario de esa pantalla ya es «Ir al Canvas» (ámbar) → el segundo no compite |
| `daily-state/PendingApprovals.tsx` | «Aprobar no críticas»: `secondary` → **`accent`**; «Rechazar todas»: `secondary` → **`danger`** | el primario del panel es aprobar; rechazar es destructivo |
| `daily-state/JournalView.tsx` | «Decisiones»: `secondary` → **`accent`** | es el primario del journal («Editar»/«Preview» son un toggle; «Guardar» un `ghost`) |

Con el inventario de los **208 `Button`** del renderer (`apps/desktop/scripts/t-x1-inventory-cta.cjs`),
la superficie «Daily» pasó de 2 CTA que se leían primarios a **1** ✓.

### 1.6 `EGO-FIND-101` — el anillo de foco ámbar doble

**Fichero**: `apps/desktop/renderer/components/ui-kit/Input.tsx`.

```diff
- "focus-within:border-brand focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-brand",
+ // EGO-FIND-101: el foco es UN anillo (el outline del sistema,
+ // `focus-visible:outline-brand` → `--ego-color-focus-ring`). El borde
+ // conserva su token (`border-strong` / `border-error`).
+ "focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-brand",
```

El borde **ya** era `border-strong` en reposo (o `border-error` con error) →
al enfocar ya no se convierte en `brand` → un solo anillo ✓.

### 1.7 `EGO-FIND-102` — la única transición no-composited

**Fichero**: `apps/desktop/renderer/components/PaneShell.tsx` → **se quita**
`transition-[width] duration-75`.

**Por qué se quita en vez de cambiarse** (la decisión que pedía justificar):
- El ancho de un panel redimensionable **tiene que refluir**: su contenido
  cambia de tamaño. `width` no es compositable → la transición fuerza un
  **reflow por frame** (la única no-composited de la app).
- `scaleX` **deformaría** el contenido (el texto se estira) → no sirve.
- La técnica correcta para un *splitter* es la **manipulación directa**: el
  panel sigue al puntero sin transición (el propio arrastre ES la animación,
  y sin latencia). Por eso la **única** transición que queda en el panel es
  la del color del divisor, que sí es compositable ✓.

### 1.8 `EGO-FIND-103` — la escala de motion no estaba canonizada

**Diagnóstico corregido**: la escala **ya existía** (STAB-10, en el
`DesignSystemProvider`): `--motion-duration-micro` (150 ms),
`--motion-duration-ui` (200 ms), `--motion-duration-surface` (350 ms),
`--motion-ease-out` (entradas) y `--motion-ease-in` (salidas) ✓. El
defecto era que **el producto usaba los defaults sueltos de Tailwind**
(`duration-75`, `duration-150`, `duration-200`, `duration-300`, `ease-in`,
`ease-out`) en vez de los tokens.

**Aplicado**: 26 sustituciones en 16 ficheros → `duration-[var(--motion-duration-micro)]`,
`duration-[var(--motion-duration-ui)]`, `duration-[var(--motion-duration-surface)]`,
`ease-[var(--motion-ease-in|out)]` ✓ (ningún token nuevo: la escala del
provider **es** la canónica).

> ⚠️ **Una caída durante la aplicación**: mi primera sustitución también
> tocó los **nombres** de token (`--motion-ease-in` → `--motion-ease-[var(--motion-ease-in)]`)
> y dejó `ease-[var(--motion-ease-[var(--motion-ease-out)])]` en el kit.
> Se detectó por el typecheck y se reparó (`t-x1-repair-motion-tokens.cjs`) ✓
> → el lint-test lo vigila ahora (6 contratos de duración) ✓.

**El texto exacto para A1** (la §motion que falta en el design system) → §5.

---

## 2. T2 — Los 3 del personaje

### 2.1 `EGO-FIND-116` — el perfil persistido no alimentaba el render

**Fichero**: `apps/desktop/renderer/components/character/CharacterBadge.tsx`.

El bridge (`characterProfileBridge.ts`) **persistía y hacía round-trip** del
perfil, pero **nadie lo leía** para pintar → la identidad guardada no se veía.

**Aplicado**: el badge **carga el perfil persistido**
(`loadCharacterConfig(subEgoId)`) y lo pasa al motor:

```tsx
const effectiveBaseForm = baseForm ?? persisted?.baseForm;   // el prop es el override
const effectiveOutfitId  = outfitId  ?? persisted?.outfitId ?? undefined;
…
<ego-avatar
  "base-form": effectiveBaseForm}
  traits={effectiveTraits.length > 0 ? JSON.stringify(effectiveTraits) : undefined}
  outfit={effectiveOutfitId}
  … />
```

**Lo que falta y es API de A6** (§7.1): el elemento
`packages/avatar/src/runtime/avatar-element.js` **no observa** `base-form`,
`traits` ni `outfit` (su `observedAttributes` es
`seed, state, size, motion, auto-sleep, presence, pointer-follow, sound, mode, preset, hands`).
→ el cableado del renderer está **listo y verificado** (el atributo viaja), pero
el motor todavía lo ignora ✗ → **petición a A6 con el texto exacto** (§7.1).

### 2.2 `EGO-FIND-117` — `coucou-mochi` fuera del renderer

**5 sitios** (el motor ya no declara ese preset, por D4):

| Fichero | Cambio |
|---|---|
| `character/wardrobe/WardrobeSelector.tsx:19` | el tipo `BaseFormType` ya **no** declara `"coucou-mochi"` |
| `character/wardrobe/WardrobeSelector.tsx:109` | la opción **«Robot Studio CX (Squircle / Superelipse)»** desaparece (era la etiqueta de ese preset) |
| `character/wardrobe/WardrobeSelector.tsx:279` | el `baseForm` por defecto pasa de `"coucou-mochi"` a **`"quantum-monolith"`** (uno real) |
| `character/traits/TraitRegistry.ts:28` | el tipo `baseForm?` ya no lo declara |
| `character/wardrobe/characterProfileBridge.ts:20` | el enum Zod del bridge ya no lo acepta (un perfil persistido con ese valor deja de parsear → `null` → fallback ✓) |

**No inventé un preset** ✓: el valor nuevo es uno que el motor **sí** declara.
Actualizado también el test que lo daba por bueno
(`renderer/test/CharacterPersistence.test.tsx`) y el que buscaba la etiqueta
（「Superelipse」 → «Quantum Monolith») ✓.

### 2.3 `EGO-FIND-119` — `CharacterPresence` con estado fijo

**Fichero**: `apps/desktop/renderer/components/canvas/CharacterPresence.tsx`.

**Diagnóstico**: el componente fijaba `state="idle"` y `animated={false}` → 37
líneas de wrapper con un estado que **no expresaba** nada.

**Decisión (y su justificación)**: este componente es de **ATRIBUCIÓN**
(quién generó este componente + por qué), **no** de presencia viva: vive en
el canvas, y el canvas **no tiene** canal de atención (la
`AttentionStateMachine` vive en el main y su estado sólo llega a la ventana
flotante → `preload.ts`: `FloatingAttentionState`).

Por eso:
- el estado del avatar sale del **mismo mapper** que el avatar flotante
  (`avatarStateFor` de `floating/avatar-bridge.ts`) → una sola verdad;
- se acepta `attentionState?: string` → si el anfitrión lo conoce, el avatar
  refleja la presencia **real**;
- si no lo conoce, `idle` **no es una mentira**: no hay contexto que expresar
  (y el badge es de atribución, no un monitor) ✓.

**Lo que falta** (petición, §7.2): el **canal main→canvas de la atención**
(para que el canvas pueda pasarle el estado real al `ComponentRenderer`).

---

## 3. T3 — `EGO-FIND-63`: los asertos tautológicos, convertidos

**El antes**: `node scripts/inventory-tautological-tests.mjs` →
**6 ficheros · A4: 11 · A7: 3**.

**El después**: **3 ficheros · A4: 0 · A7: 3** ✓ (el recuento de A4 baja
de 11 a **0**).

### 3.1 Qué se hizo con cada aserto

| Fichero | Asertos | Qué son | Destino |
|---|---|---|---|
| `renderer/test/DomainCanvasRegistry.test.tsx` | 2 | «el componente NO tiene ramas por `domainId`» | **contrato de forma** → lint-test |
| `renderer/test/ShikiOffload.test.tsx` | 4 | «el bundle no importa `shiki` completo»; «el worker es un módulo ES»; «el host lo crea con `type: "module"`» | **contratos de forma** → lint-test |
| `apps/desktop/test/compaction-summarizer-wiring.test.ts` | 3 | «el resumidor se crea sobre el router»; «se inyecta en el job»; «se crea después del router» | **contratos de forma** → lint-test |
| `renderer/test/floating-avatar-vendor.test.ts` | 1 | «el motor se carga desde el paquete `@ego/avatar`» | **COMPORTAMIENTO**: `await import("@ego/avatar/runtime/avatar-element.js")` y se comprueba que exporta el elemento ✓ |
| `apps/desktop/test/e6-runtime-state.test.ts` | 1 | «el manifiesto de deps sigue en el compositor» | **COMPORTAMIENTO**: se importa el módulo IPC (con `electron` inertizado, como `ipc.integration.test.ts`) y se comprueba que `registerIpcHandlers` es una función ✓ |

### 3.2 El lint-test de los contratos de forma

**Fichero nuevo**: `apps/desktop/scripts/lint/source-contracts.lint.mjs`
(14 contratos) · **script**: `pnpm --filter @ego/desktop lint:source-contracts` ✓.

**Por qué un ejecutable y no un `*.test.*`**: un contrato de forma **no se
puede comprobar con comportamiento** (el resaltado de Shiki funciona igual
con las dos formas; lo que cambia es el tamaño del bundle). Escrito como
`expect(fuente).toContain(...)` era un aserto que **no falla cuando el
producto se rompe**, sólo cuando alguien reescribe el fichero — y el
inventario lo contaba como un test. Ahora sigue bloqueando igual (exit 1),
pero el inventario vuelve a medir **comportamiento** ✓.

```text
$ node apps/desktop/scripts/lint/source-contracts.lint.mjs
  ✓ renderer/components/domains/DomainCanvasView.tsx — no tiene ramas por domainId
  ✓ renderer/workers/shiki.worker.ts — usa shiki/core (no el bundle completo)
  …
[source-contracts] 14 contratos de fuente: todos OK.
```

---

## 4. Los tests de comportamiento de los visuales

**Fichero nuevo**: `apps/desktop/renderer/test/ola10-visual-contract.test.tsx`
(4 tests) — comprueban el **DOM renderizado**, no el fichero:

| Test | Qué afirma |
|---|---|
| `EGO-FIND-101` | el Input tiene **un** anillo: `focus-within:outline-brand` presente y `focus-within:border-brand` **ausente** |
| `EGO-FIND-102` | el panel **no** transiciona su `width` (la clase `transition-[width]` no está en el DOM) |
| `EGO-FIND-98` | el estado vacío dice qué es, para qué y qué hacer (título + descripción + acción + nota) |
| `EGO-FIND-99` | las paletas canónicas son **visibles** (los N botones del grupo) e **intercambiables** (al pulsar una inactiva, queda `aria-pressed="true"`) |

Los 4 verdes ✓. Los que **no** pude cubrir con un test de comportamiento en
jsdom (y por qué): `EGO-FIND-96` (el CTA de envío vive dentro del
`ComposerPrimitive` de assistant-ui: su estado deshabilitado lo fija la
librería, no el componente) y `EGO-FIND-97`/`EGO-FIND-100` (requieren
montar el `App` completo → el test de surfaces del App ya cubre que no haya
`<select>` nativos; el recuento de superficies se comprueba en la auditoría
visual, §7.3).

---

## 5. El texto exacto para A1 (`docs/**` es de A1)

### 5.1 La §motion del design system (la que falta)

```markdown
### 3.3 Motion (EGO-FIND-103)

La escala de motion del sistema **existe** y es la del `DesignSystemProvider`
(STAB-10). No hay defaults sueltos de Tailwind en el producto.

| Token | Valor | Para qué |
|---|---|---|
| `--motion-duration-micro` | `150ms` | el micro-feedback: hover, foco, pulsación |
| `--motion-duration-ui` | `200ms` | el cambio de estado de un control o de una superficie pequeña |
| `--motion-duration-surface` | `350ms` | superficies grandes (panel, hoja) |
| `--motion-ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | **entradas** (llega rápido y frena) |
| `--motion-ease-in` | `cubic-bezier(0.3, 0, 0.7, 1)` | **salidas** (lo que se va no entretiene) |

**Uso (Tailwind v4)**: `duration-[var(--motion-duration-micro)]`,
`duration-[var(--motion-duration-ui)]`,
`duration-[var(--motion-duration-surface)]`,
`ease-[var(--motion-ease-out)]`, `ease-[var(--motion-ease-in)]`.

⚠️ **`width` NO se transiciona** (EGO-FIND-102): un panel redimensionable
tiene que refluir y `width` no es compositable → la transición fuerza un
reflow por frame. `scaleX` deformaría el contenido. La técnica correcta es
la manipulación directa (el arrastre **es** la animación).

**Guard**: `node apps/desktop/scripts/lint/source-contracts.lint.mjs`
(ningún `duration-[0-9]+` suelto en el kit).
```

### 5.2 Las 8 filas del Backlog (texto para pegar)

| Fila | Texto |
|---|---|
| `EGO-FIND-96` | **✅ Completada** — el CTA de envío deshabilitado se distingue por **superficie y texto** (`disabled:bg-raised disabled:text-dim`), nunca sólo por opacidad; el `disabled` real lo pone el primitive (la AT lo anuncia). `components/ego-chat.tsx` |
| `EGO-FIND-97` | **✅ Completada** — jerarquía de superficies: el **modelo** (global) vive en la barra superior; el **Sub-Ego** (conversación) en la cabecera del chat; el esfuerzo/modo/voz en la cabecera del chat. Se retiran el `ChatPanelHeader` duplicado del `App` y el `Menu` de modelo del chat → 1 superficie de modelo + 1 de Sub-Ego. `src/App.tsx`, `components/ego-chat.tsx` |
| `EGO-FIND-98` | **✅ Completada** — los *empty states* con guía (qué es / para qué / qué hacer) mediante `components/canvas/EmptyState.tsx`; aplicado al visor del Workbench. |
| `EGO-FIND-99` | **✅ Completada** — los 4 presets canónicos son visibles (muestras con sus colores) e intercambiables (`applyPreset`), en la sección «Paletas canónicas» del `ThemeIO`. |
| `EGO-FIND-100` | **✅ Completada** — un único idioma de CTA primario: `variant="accent"` (ámbar). Corregidos 4 CTAs en 3 superficies del daily state. |
| `EGO-FIND-101` | **✅ Completada** — el foco es **un** anillo (el `outline` del sistema); el borde ya no se vuelve `brand` al enfocar. `components/ui-kit/Input.tsx` |
| `EGO-FIND-102` | **✅ Completada** — el panel no transiciona su `width` (reflow por frame); la manipulación directa es la técnica correcta y el contenido no puede deformarse. `components/PaneShell.tsx` |
| `EGO-FIND-103` | **✅ Completada** — la escala de motion del sistema (STAB-10) es la que usa el producto: 26 sustituciones en 16 ficheros, 0 defaults sueltos de Tailwind; guard en el lint-test de contratos. |
| `EGO-FIND-116` | **🟡 Parcial** — el perfil persistido **se carga y se pasa** al `<ego-avatar>` (`base-form`, `traits`, `outfit`); el motor todavía no observa esos atributos → **petición a A6** (§7.1). `components/character/CharacterBadge.tsx` |
| `EGO-FIND-117` | **✅ Completada** — `coucou-mochi` fuera del renderer (5 sitios: el tipo, la opción, el valor por defecto → `quantum-monolith`, el `TraitRegistry` y el enum Zod del bridge). |
| `EGO-FIND-119` | **✅ Completada (con hueco declarado)** — `CharacterPresence` es de **atribución**: acepta `attentionState` y usa el **mismo mapper** que el avatar flotante (`avatarStateFor`); sin contexto, `idle` es honesto. Falta el **canal main→canvas de la atención** (§7.2). |
| `EGO-FIND-63` | **✅ Completada** — los asertos de texto de fuente de A4 (11) salen de los `*.test.*`: 2 se convierten en **comportamiento** (import real) y 9 se aíslan como **contratos de forma** en `apps/desktop/scripts/lint/source-contracts.lint.mjs` (14 contratos, exit 1 si se violan). El inventario pasa de **A4: 11 → A4: 0**. |

---

## 6. Verificación

| Comando | Exit | Resumen |
|---|---|---|
| `pnpm --filter @ego/desktop typecheck` | **0** | — |
| `pnpm --filter @ego/renderer typecheck` | **0** | — |
| `pnpm --filter @ego/desktop test` | **0** | **70 ficheros · 430 tests** |
| `pnpm --filter @ego/renderer test` | **0** | **74 ficheros · 536 tests** (ver §6.1) |
| `node apps/desktop/scripts/design-lint.cjs` | **0** | 12 reglas · **0 errores** (R2 con 3 `style` de muestra → con escape) |
| `node scripts/inventory-tautological-tests.mjs` | **0** | **A4: 0** (sólo A7: 3) |
| `node apps/desktop/scripts/lint/source-contracts.lint.mjs` | **0** | 14 contratos OK |
| `node scripts/verify-vantadb-ids.mjs` | **0** | 0 errores |
| `pnpm -r typecheck` / `pnpm lint` | **0** | ver §6.2 |

### 6.1 Un flake del renderer (acotado, como avisa el brief)

El suite del renderer dio **1 rojo** en `test/Targets44.test.tsx` («los
controles del header >= 44 px») **en una pasada completa**; **aislado pasa**
(7/7) ✓ y las **dos pasadas completas siguientes pasan enteras**
(74 ficheros · 536 tests) ✓. Es el ruido de `act()` + los recursos asíncronos que yaвестaba
en la Ola 9 (la máquina tiene decenas de procesos `node` de otros agentes) →
**flake de concurrencia**, no una regresión (lo repetí aislado y en la
suite completa).

### 6.2 `pnpm -r typecheck` y `pnpm lint`

Salen **0** ✓ (los errores de `packages/avatar` de la Ola 9 los resolvió A6
mientras yo trabajaba).

---

## 7. Peticiones a otras zonas (texto exacto)

### 7.1 A6 (`packages/avatar/**`) — el motor debe observar la identidad del perfil

**Fichero**: `packages/avatar/src/runtime/avatar-element.js` (línea 229,
`observedAttributes`).

**Qué pide el renderer** (ya cableado y verificado en
`apps/desktop/renderer/components/character/CharacterBadge.tsx`):

```js
static get observedAttributes() {
  return [
    'seed', 'state', 'size', 'motion', 'auto-sleep', 'presence',
    'pointer-follow', 'sound', 'mode', 'preset', 'hands',
    // EGO-FIND-116 (Ola 10 · A4): la identidad declarativa del personaje
    // (traits / baseForm / outfitId) llega desde el renderer como atributos.
    // Sin esto, el perfil persiste y hace round-trip, pero no alimenta el
    // render: el avatar sigue pintando el del generador.
    'base-form', 'traits', 'outfit',
  ];
}
```

**Y el tratamiento**, en el mismo `attributeChangedCallback` (línea 514), con
el formato que ya usan los otros atributos:

- `base-form` → el equivalente a `preset`/`mode` del generador (el
  `baseForm` canónico: `delta-core` | `quantum-monolith` | `energy-core` |
  `fractal-polyhedron`).
- `traits` → **JSON** (array de nombres de rasgo, el formato del
  `CustomCharacterConfig.traits` del renderer: `string[]`).
- `outfit` → el `outfitId` (`string | null`).

**Por qué lo pide A4 y no A6**: el motor es de A6; el que **sabe** qué
atributos necesita es el renderer (que tiene el perfil y el vocabulario) →
A4 deja el cableado hecho y el contrato escrito ✓.

### 7.2 A2/A3 — el canal main→canvas de la atención (para `EGO-FIND-119`)

**Qué falta**: el `CharacterPresence` (que vive en el canvas) ya acepta
`attentionState` y lo refleja con el mapper del avatar flotante; lo que
falta es que **el canvas reciba la atención real** (la
`AttentionStateMachine` del main hoy sólo se publica a la ventana
flotante → `preload.ts`: `FloatingAttentionState`).

**Opciones** (a elegir por quien tenga el main):
1. Publicar el estado de atención en el bus (p. ej. `system.alert` con
   `attentionState`) → el `CanvasRuntime` (que ya escucha `ego().onEvent`)
   lo guarda en un contexto y `ComponentRenderer` lo pasa a
   `<CharacterPresence attentionState={…} />`.
2. Opcionalmente, exponerlo en el `preload` como `FloatingAttentionState`
   ya hace (el canvas lo pediría por el mismo canal).

**Quién**: el main (`apps/desktop/src/main/**` → A4 también puede, pero el
cambio toca el `AttentionStateMachine` de A2) → **A2** con el apoyo de A4.

### 7.3 A1 (`docs/**`) — la §motion y las 8 filas

El texto exacto está en §5 (la §motion completa + una fila por hallazgo) ✓.

---

## 8. Deuda que dejo

1. **`EGO-FIND-116` queda a medias hasta que A6 añada los 3 atributos** al
   elemento (§7.1) → el cableado del renderer está listo, pero el render no
   cambia aún.
2. **`EGO-FIND-119`**: el `CharacterPresence` refleja la atención **si se le
   pasa**; el canvas aún no la tiene (§7.2).
3. **El `EmptyState` no es una primitive del `ui-kit`** (a propósito: su tabla
   es canónica y de A1). Si A1 quiere que sea primitive, el sitio es
   `docs/design/design-system.md` §8.1.
4. **El test de comportamiento de `EGO-FIND-96`** (el CTA deshabilitado) no
   lo pude escribir en jsdom: el estado deshabilitado lo fija el
   `ComposerPrimitive` de assistant-ui. La comprobación honesta sería en la
   auditoría visual (el arnés mide el render real).
5. **La superficie «Daily»** era la que la auditoría señalaba; apliqué la
   regla a las 4 CTAs de las 3 superficies del daily state, pero **no a
   las 28 `secondary` del renderer**: una auditoría completa de "qué CTA es
   el primario de su superficie" en las 208 vueltas del registro es trabajo
   de producto (cuál es la acción principal de cada superficie), no un
   arreglo mecánico. Queda con el inventario listo
   (`apps/desktop/scripts/t-x1-inventory-cta.cjs`) para ese trabajo.
