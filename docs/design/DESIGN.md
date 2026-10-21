# Design System de Ego — tokens, paletas y primitives

| Campo | Valor |
| --- | --- |
| Estado | Canónico — ficha de producto del design system (tokens, paletas OKLCH, contrato de contraste, primitives) |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Implementación | `apps/desktop/renderer/src/styles/theme-tokens.css` (elevación, vidrio, superficies) · `src/index.css` (puente `@theme`) · `components/canvas/DesignSystemProvider.tsx` (**fuente única de las paletas**) · `components/ui-kit/` (11 primitives) · `apps/desktop/scripts/design-lint.cjs` (puerta) |
| Documento complementario | [`design-system.md`](design-system.md) — tokens semánticos, temas, 9 estados, contraste, **tabla de primitives** (§8) y **puerta de calidad** (§10) |
| Decisiones | Owner 2026-10-14 (D12, UI-01..UI-06): dark-only, 4 presets, accent ámbar, Geist, 9 estados · Owner 2026-10-19 (D3): tabla de primitives · Owner 2026-10-19 (T14): **migración a OKLCH** · **Owner 2026-10-20: densidad densa+táctil · accent único (focus-ring = brand) · dropdown/popover/tooltip migrados a Radix · OKLCH como fuente única · `design-lint` como puerta** |

> **Qué es este documento y qué no.** `design-system.md` describe *cómo se
> construye* la interfaz (tokens, kit, estados, contraste, puerta).
> Este documento describe la *ficha de producto* del sistema: **las paletas
> concretas**, el **contrato de contraste verificable** y el **registro de
> primitives** con la decisión de cada una. No hay dos fuentes de verdad: los
> valores de aquí son copia verificada de
> `components/canvas/DesignSystemProvider.tsx`, y el test
> `renderer/test/ThemeTokensOklch.test.tsx` es la puerta que lo valida.

---

## 1. Por qué OKLCH y no HEX sRGB ##

`oklch(L C H)` separa **luminosidad** (L), **cromancia** (C) y **matiz** (H).
La consecuencia práctica: *la misma diferencia de `L` produce el mismo salto de
luminosidad en cualquier matiz*. Por eso "subir un nivel de superficie"
conserva la identidad perceptiva del color en las paletas frías, cálidas y de
alto contraste — cosa que no ocurre al mezclar HEX sRGB, donde el mismo delta
numérico produce saltos perceptivos distintos según el matiz.

La conversión se hizo color a color con `apps/desktop/scripts/srgb-to-oklch.cjs`
(sRGB → OKLab → OKLCH, según Ottosson). **0 literales HEX** quedan en las
paletas.

> **Corrección 2026-10-20:** las paletas están en el **provider**, no en
> `theme-tokens.css`. Antes existían duplicadas (CSS bajo `[data-palette]`,
> que ningún componente asignaba → código muerto; y HEX en el provider, que sí
> corría). Ver `design-system.md` §2.1.

---

## 2. Las 4 paletas canónicas ##

Tokens: `bg` → `panel` → `raised` (rampa de superficie) y `text` / `muted` /
`border` / `brand` (contraste y accent).

| Paleta | bg | panel | raised | text | muted | border | brand |
|---|---|---|---|---|---|---|---|
| `default-dark` | `oklch(0.13 0.004 285.8)` | `oklch(0.195 0.004 286)` | `oklch(0.26 0.008 285.8)` | `oklch(0.985 0 89.9)` | `oklch(0.712 0.013 286.1)` | `oklch(0.274 0.005 286)` | `oklch(0.769 0.165 70.1)` |
| `midnight-cyan` | `oklch(0.13 0.027 261.7)` | `oklch(0.195 0.04 265.8)` | `oklch(0.26 0.037 260)` | `oklch(0.984 0.003 247.9)` | `oklch(0.711 0.035 256.8)` | `oklch(0.372 0.039 257.3)` | `oklch(0.715 0.126 215.2)` |
| `emerald-terminal` | `oklch(0.13 0.047 173.8)` | `oklch(0.19 0.05 165)` | `oklch(0.25 0.048 169.6)` | `oklch(0.979 0.021 166.1)` | `oklch(0.845 0.13 165)` | `oklch(0.508 0.105 165.6)` | `oklch(0.696 0.149 162.5)` |
| `amber-warm` | `oklch(0.13 0.006 56)` | `oklch(0.195 0.006 34.3)` | `oklch(0.26 0.008 67.6)` | `oklch(0.962 0.058 95.6)` | `oklch(0.869 0.004 56.4)` | `oklch(0.444 0.01 73.6)` | `oklch(0.769 0.165 70.1)` |

### 2.1 Rampa de superficie

| Nivel | Token | Uso |
|---|---|---|
| L0 | `--ego-color-bg` | Fondo de la ventana |
| L1 | `--ego-color-panel` | Paneles, barras laterales, superficies de contenido |
| L2 | `--ego-color-raised` | Tarjetas, popovers, menús, elementos en hover |
| L3 | `--ego-elevation-l3` | Capa más alta (sombras) — `theme-tokens.css` |

Las cuatro paletas cumplen **rampa monótona en `L`** con la misma estructura
(**0.130 → 0.195 → 0.260**): el salto entre niveles es perceptualmente
idéntico en todas, que es el efecto buscado con OKLCH.

> `emerald-terminal` y `amber-warm` tenían rampas **no monótonas** (L 0.255 /
> 0.256 / 0.255) y una "elevación" imperceptible sobre el panel. Se
> re-resolvieron por búsqueda numérica contra las restricciones WCAG de §3.

### 2.2 Superficies de vidrio y elevación

`--ego-glass-bg`, `--ego-glass-border`, `--ego-elevation-l0..l3` y
`--ego-border-translucent` / `--ego-border-interactive` completan el sistema
(`theme-tokens.css:7-19`). El scrollbar es plano, sin caja (6 px, thumb
`rgba(255,255,255,0.12)`), definido **una sola vez** en `src/index.css`.

---

## 3. Contrato de contraste (WCAG 2.2) ##

**No es una declaración: es una puerta de test.** El test
`apps/desktop/renderer/test/ThemeTokensOklch.test.tsx` (10 tests) convierte
cada literal OKLCH de vuelta a sRGB, aplica la **fórmula de luminancia
relativa** de WCAG 2.2 y comprueba:

| Regla | Umbral | Qué mide |
|---|---|---|
| Texto normal | ≥ 4.5:1 | `text` sobre `bg`, `panel` y `raised` |
| Texto secundario | ≥ 4.5:1 | `muted` sobre `raised` |
| Dim fijo | ≥ 4.5:1 | `#8a8a92` sobre `bg`, `panel` y `raised` |
| Borde fuerte | ≥ 3:1 (WCAG 1.4.11) | `#71717a` sobre `bg`, `panel` y `raised` |
| Brand (UI) | ≥ 3:1 | `brand` sobre `bg` y `panel` |
| Texto sobre brand | ≥ 4.5:1 | `#0a0a0b` sobre `brand` |
| Rampa de superficie | monótona en `L` | `bg` < `panel` < `raised` |
| Sin HEX | 0 literales | ninguna paleta usa HEX sRGB |

> **El test lee el provider, no el CSS.** Antes validaba un fichero de
> paletas que nadie aplicaba; hoy valida exactamente lo que la app pinta.

### 3.1 Las 7 combinaciones prohibidas

Viven en [`design-system.md`](design-system.md) §7. Resumen: `text-dim` con
`opacity-*` · `placeholder` con opacidad · `Badge tone=dim` con `opacity-70` ·
`border-hairline` como único indicador de input · hex literal sin token ·
derivar `--ego-color-dim` del `muted` del preset · texto sobre brand sin
`text-on-brand`.

Las que se materializaron en código están corregidas y **la puerta
`design-lint` (§10 de `design-system.md`) impide que vuelvan**.

---

## 4. Tabla de primitives del `ui-kit` ##

> Principio **D3** del owner (2026-10-19): *los componentes de librerías y
> framework se utilizan siempre; no se recrean desde cero si ya existe una
> primitive de librería o del framework.* Un componente propio solo existe
> cuando tiene un **motivo concreto**, y ese motivo está escrito aquí.

| Primitive | Base | ¿Propio? | Motivo concreto (justificación D3) |
|---|---|---|---|
| `ui-kit/Select.tsx` | **`@radix-ui/react-select`** | Propio (envoltorio) | **Migrado en T5** (`ADR-0015`). Se conserva el envoltorio por: (a) el **portal al host del diálogo** (`[data-ego-dialog-content]`) — Radix porta a `document.body` y eso rompe el `FocusScope` del `Dialog`; (b) el contrato de 9 estados P22; (c) la forma pill del design system. |
| `ui-kit/Modal.tsx` | **`@radix-ui/react-dialog`** | Propio (envoltorio) | Radix aporta trap de foco, `Escape`, `role="dialog"` y `aria-modal` nativos. El envoltorio añade (a) `data-ego-dialog-content`, (b) animación con `motion` + `useReducedMotion`, (c) los 9 estados P22. |
| `ui-kit/Tabs.tsx` | **`@radix-ui/react-tabs`** | Propio (envoltorio) | Roles `tablist`/`tab`/`tabpanel`, navegación por flechas y `Escape` nativos; el envoltorio añade los 9 estados y el `data-state` que usan las hojas de estilo. |
| `ui-kit/Switch.tsx` | **`@radix-ui/react-switch`** | Propio (envoltorio) | **Nuevo 2026-10-20.** `role="switch"` + `aria-checked` + estado compartido label↔control; los interruptores de Ajustes se reimplementaban a mano (botón 44×44 + pista + knob) sin estado `checked` real. |
| `ui-kit/Menu.tsx` | **`@radix-ui/react-dropdown-menu`** | Propio (envoltorio) | **Nuevo 2026-10-20.** Cierra la deuda A4: `FocusScope`, teclado, roles `menu`/`menuitem`, retorno del foco y `Escape` nativos. Sustituye al dropdown ad-hoc de `SubEgoSelector` y a los 5 menús copy-paste del composer. |
| `ui-kit/Popover.tsx` | **`@radix-ui/react-popover`** | Propio (envoltorio) | **Nuevo 2026-10-20.** Cierra la deuda A4: foco + `Escape` + `outside-click` nativos. Sustituye a los popovers ad-hoc del rail y del chat. |
| `ui-kit/Tooltip.tsx` | **`@radix-ui/react-tooltip`** | Propio (envoltorio) | **Nuevo 2026-10-20.** Cierra la deuda A4: `role="tooltip"`, delay y `prefers-reduced-motion`. Sustituye al tooltip hand-rolled de `FileMentionBadge`. |
| `ui-kit/Button.tsx` | `cva` + `<button>` nativo | Propio | El design system define 5 variantes (incl. `loading` con `aria-busy` + spinner, `danger` y `accent`), 9 estados, densidad densa (`sm` 28 / `md` 32 / `lg` 44 / `icon` 44×44) y el objetivo táctil: un botón **sólo-icono** recibe `min-h-11 min-w-11` automáticamente. Radix no ofrece Button. `cva` es la librería de variantes, no un reemplazo del componente. |
| `ui-kit/Input.tsx` | `<input>` nativo + `cva` | Propio | Los 9 estados P22 (`error` con `aria-invalid` + `aria-errormessage`, `loading` con `aria-busy`, `empty` con hint, `overflow` con contador de `maxLength`), placeholder **sólido** (`placeholder:text-faint`) y borde `border-strong` + `focus-within:border-brand`. Radix no ofrece un primitive de "text input" con esas variantes. |
| `ui-kit/Textarea.tsx` | `<textarea>` nativo + `cva` | Propio | Gemelo de `Input` (mismos tokens, mismos 9 estados, mismo contador) para el composer y los formularios de texto largo. |
| `ui-kit/Badge.tsx` | `cva` + `<span>` | Propio | El `tone="dim"` **no puede usar `opacity-70`** (hunde el ratio de contraste por debajo de AA): el dim fijo `#8a8a92` es lo que da el AA. Es una regla de color del design system, no una capacidad de librería. |
| `components/PaneShell.tsx` (`SplitPane`) | Propio | Propio | Divisor `role="separator"` con `aria-valuenow/min/max`, teclado (flechas ±8 px, `Home`/`End`/`Escape`), doble clic para restablecer, límites elásticos y **persistencia en `localStorage`**. `react-resizable-panels` se evaluó y **se descartó**. |

### 4.1 API pública por primitive (props)

> Cierre de los huecos de API que reportaron los agentes de migración
> (2026-10-20). Todas las props son **retro-compatibles**: los consumidores
> que no las usan siguen renderizando igual.

| Primitive | Props | Nota |
|---|---|---|
| `ui-kit/Button.tsx` | `variant`, `size`, `loading`, `truncate`, **`icon`**, `ref` | `forwardRef` **real** (el `ref` llega tipado al `<button>`; lo exige el `asChild` de Radix con el `Button` como trigger de `Menu`/`Popover`). `icon` va **antes** del `<span>` de contenido, de modo que el `gap-1.5` del base separa icono y etiqueta → **sustituye al hack `[&>span]:flex`**; es decorativo (`aria-hidden`) y no cuenta como texto visible. |
| `ui-kit/Input.tsx` | `error`, `hint`, `loading`, `truncate`, `size`, `wrapperClassName`, **`leadingIcon`** | `leadingIcon` va **dentro** de la caja del campo (hereda borde, `focus-within` y `px-2.5`); separador con el texto = `gap-2` del contenedor. |
| `ui-kit/Tabs.tsx` | `tabs`, `value`/`defaultValue`, `onValueChange`, `error`, `empty`, `loading`, `ariaLabel`, **`className`**, **`contentClassName`** | `className` → raíz del kit; `contentClassName` → `div[role=tabpanel]`. La raíz de Radix es columna flex, así que el panel crece sin selectores arbitrarios sobre el DOM interno de Radix. |
| `ui-kit/Menu.tsx` | `trigger`, `items`, `align`, `side`, `sideOffset`, **`open`**, **`onOpenChange`**, `ariaLabel`, `className`, `contentClassName`, `loading`, `error` | `MenuItem.checked` → ítem "uno de" (`RadioItem` de Radix: `role="menuitemradio"` + `aria-checked` + check con `ItemIndicator`), conservando `onSelect`. `open`/`onOpenChange` → estado de apertura controlado. ⚠️ `ariaLabel` **no nombra el menú** (Radix fija `aria-labelledby` al trigger, con prioridad sobre `aria-label`). |

### 4.2 Primitives aún ad-hoc fuera del kit

| Primitive | Dónde | Paquete necesario | Decisión |
|---|---|---|---|
| Combobox + listbox | `components/omnibar.tsx` | — (ya hay `FuzzySearch` de `@ego/ui-runtime`) | **Propia con motivo**: combobox de búsqueda con fuzzy match sobre proyectos/sesiones/Sub-Egos. Radix no ofrece combobox; React Aria sí, y no está en el grafo de dependencias. Migrar a React Aria es una decisión de Nivel 10 pendiente de valorarse. |
| Listbox / `role="option"` | `omnibar.tsx`, `ModelPicker.tsx`, `SessionPicker.tsx` | — | **Propia con motivo**: el patrón ARIA de listbox no está en Radix. |
| Botón-tarjeta / chip en línea | `sub-egos.tsx`, `FileMentionBadge.tsx` | — | **Propia con motivo**: requieren contenido en bloque o un tamaño < 24 px que el `Button` del kit no cubre. |

> Antes de la ola 2026-10-20 eran 4 (dropdown, popover, tooltip, combobox);
> ahora son **3**, y las 3 primeras están migradas a Radix.

---

## 5. Estado de implementación por superficie ##

| Superficie | Estado | Evidencia |
|---|---|---|
| Tokens semánticos | ✅ | `index.css` `@theme` + `theme-tokens.css` |
| Paletas en OKLCH (4) | ✅ | `DesignSystemProvider.tsx` · test `ThemeTokensOklch.test.tsx` (10 tests) |
| Fuente única de paleta | ✅ | provider (no CSS) · `data-palette` en `<html>` |
| Accent único (focus-ring = brand) | ✅ | §2 · test `ThemeTokens.test.tsx` |
| Rampa de superficie monótona en las 4 | ✅ | verificada por el test |
| Contraste WCAG 2.2 en las 4 paletas | ✅ | verificado por el test (conversión OKLCH→sRGB) |
| Deuda de contraste heredada (FIND-A11Y-01..06) | ✅ **cerrada** | las 6 superficies se re-resolvieron por búsqueda numérica contra los tokens fijos |
| Kit `ui-kit/` (11 primitives) | ✅ | 4 migrados a Radix en la ola 2026-10-20 |
| 9 estados por componente | ✅ | `test/ui-kit-nine-states.test.tsx` |
| Densidad densa + táctil | ✅ | `test/Targets44.test.tsx` (24 px AA / 44 px sólo-icono) |
| Primitives ad-hoc migradas | 3 de 4 | dropdown, popover y tooltip migrados; queda el combobox |
| Catálogo de Canvas | ✅ 12 implementados | `design-system.md` §4 |
| Puerta de calidad (estatica) | ✅ | `apps/desktop/scripts/design-lint.cjs` R1–R11: 0 errores · `apps/desktop/renderer/test/design-lint.test.tsx` |
| Puerta de calidad (dinamica) | ✅ | `apps/desktop/scripts/ego-browser-audit.mjs` + `apps/desktop/scripts/run-design-audit.ps1`: mide el DOM renderizado (radio, tipografia, superficies, chrome, targets, desbordes) contra el contrato |
| Adopción del kit en producto | ✅ | 288 controles nativos → ~35 (chips/listbox/`<input type=file>`) |

---

## 6. Referencias ##

- `apps/desktop/renderer/components/canvas/DesignSystemProvider.tsx` — **fuente
  única** de las 4 paletas (OKLCH) y de los presets.
- `apps/desktop/renderer/src/index.css` — puente `@theme` + tokens fijos.
- `apps/desktop/renderer/src/styles/theme-tokens.css` — elevación L0–L3, vidrio,
  superficies, scrollbar.
- `apps/desktop/renderer/test/ThemeTokensOklch.test.tsx` — puerta de contraste.
- `apps/desktop/renderer/test/ThemeTokens.test.tsx` — puente de tokens, cambio de
  preset, `data-palette`, focus-ring = brand.
- `apps/desktop/renderer/test/Targets44.test.tsx` — política de target size.
- `apps/desktop/renderer/test/ui-kit-nine-states.test.tsx` — contrato de 9 estados.
- `apps/desktop/scripts/design-lint.cjs` — puerta de calidad del design system.
- `apps/desktop/scripts/srgb-to-oklch.cjs` — conversor sRGB→OKLCH.
- `docs/adr/0015-radix-select-accesible.md` — decisión D3 del `Select`.
- `docs/roadmap/Backlog.md` — `EGO-FIND-71`, `EGO-FIND-72`.
