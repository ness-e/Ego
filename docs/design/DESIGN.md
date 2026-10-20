# Design System de Ego — tokens, paletas y primitives

| Campo | Valor |
| --- | --- |
| Estado | Canónico — ficha de producto del design system (tokens, paletas OKLCH, contrato de contraste, primitives) |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Implementación | `apps/desktop/renderer/src/styles/theme-tokens.css` (tokens y paletas) · `components/canvas/DesignSystemProvider.tsx` (temas) · `components/ui-kit/` (kit Radix) · `components/canvas/registry.ts` (catálogo de Canvas) |
| Documento complementario | [`design-system.md`](design-system.md) — tokens semánticos, temas, 9 estados, contraste y **tabla de primitives** (§8) |
| Decisiones | Owner 2026-10-14 (D12, UI-01..UI-06): dark-only, 4 presets, accent ámbar, Geist, 9 estados · Owner 2026-10-19 (**D3**): tabla de primitives · Owner 2026-10-19 (T14, `EGO-FIND-72`): **migración a OKLCH** |

> **Qué es este documento y qué no.** `design-system.md` describe *cómo se
> construye* la interfaz (tokens, kit, estados, contraste). Este documento
> describe *la ficha de producto* del sistema: **las paletas concretas**, el
> **contrato de contraste verificable** y el **registro de primitives** con la
> decisión de cada una. No hay dos fuentes de verdad: los valores de aquí son
> copia verificada de `theme-tokens.css`, y el test
> `renderer/test/ThemeTokensOklch.test.tsx` es la puerta que lo valida.

---

## 1. Por qué OKLCH y no HEX sRGB ##

`oklch(L C H)` separa **luminosidad** (L), **cromancia** (C) y **matiz** (H).
La consecuencia práctica: *la misma diferencia de `L` produce el mismo salto de
luminosidad en cualquier matiz*. Por eso "subir un nivel de superficie" conserva
la identidad perceptiva del color en las paletas frías, cálidas y de alto
contraste — cosa que no ocurre al mezclar HEX sRGB, donde el mismo delta
numérico produce saltos perceptivos distintos según el matiz.

La conversión se hizo color a color con `apps/desktop/scripts/srgb-to-oklch.cjs`
(sRGB → OKLab → OKLCH, según Ottosson). **0 literales HEX** quedan en las
paletas.

---

## 2. Las 4 paletas canónicas ##

Tokens: `bg` → `panel` → `raised` (rampa de superficie) y
`text` / `muted` / `border` / `border-strong` (contraste).

| Paleta | bg | panel | raised | text | muted | border | border-strong |
|---|---|---|---|---|---|---|---|
| `dark-graphite` | `oklch(0.141 0.004 285.8)` | `oklch(0.192 0.004 286)` | `oklch(0.228 0.008 285.8)` | `oklch(0.967 0.001 286.4)` | `oklch(0.712 0.013 286.1)` | `oklch(0.274 0.005 286)` | `oklch(0.552 0.014 285.9)` |
| `midnight-cyan` | `oklch(0.13 0.027 261.7)` | `oklch(0.208 0.04 265.8)` | `oklch(0.279 0.037 260)` | `oklch(0.984 0.003 247.9)` | `oklch(0.711 0.035 256.8)` | `oklch(0.372 0.039 257.3)` | `oklch(0.554 0.041 257.4)` |
| `warm-sepia` | `oklch(0.216 0.006 56)` | `oklch(0.268 0.006 34.3)` | `oklch(0.374 0.009 67.6)` | `oklch(0.962 0.058 95.6)` | `oklch(0.869 0.004 56.4)` | `oklch(0.444 0.01 73.6)` | `oklch(0.553 0.012 58.1)` |
| `high-contrast` | `oklch(0 0 0)` | `oklch(0.145 0 89.9)` | `oklch(0.191 0 89.9)` | `oklch(1 0 89.9)` | `oklch(0.845 0 89.9)` | `oklch(0.371 0 89.9)` | `oklch(0.715 0 89.9)` |

### 2.1 Rampa de superficie

| Nivel | Token | Uso |
|---|---|---|
| L0 | `--ego-color-bg` | Fondo de la ventana |
| L1 | `--ego-color-panel` | Paneles, barras laterales, superficies de contenido |
| L2 | `--ego-color-raised` | Tarjetas, popovers, menús, elementos en hover |
| L3 | `--ego-elevation-l3` | Capa más alta (sombras) — `theme-tokens.css:9` |

Las cuatro paletas cumplen **rampa monótona en `L`** (bg < panel < raised), y
`high-contrast` usa `C = 0` (acromático) para maximally separarse.

### 2.2 Superficies de vidrio y elevación

`--ego-glass-bg`, `--ego-glass-border`, `--ego-elevation-l0..l3` y
`--ego-border-translucent` / `--ego-border-interactive` completan el sistema
(`theme-tokens.css:7-19`). El scrollbar es plano, sin caja (6 px, thumb
`rgba(255,255,255,0.12)`).

---

## 3. Contrato de contraste (WCAG 2.2) ##

**No es una declaración: es una puerta de test.** El test
`apps/desktop/renderer/test/ThemeTokensOklch.test.tsx` (6 tests) convierte
cada literal OKLCH de vuelta a sRGB, aplica la **fórmula de luminancia
relativa** de WCAG 2.2 y comprueba:

| Regla | Umbral | Qué mide |
|---|---|---|
| Texto normal | ≥ 4.5:1 | `text` sobre `bg` y sobre `panel` |
| Texto secundario | ≥ 4.5:1 | `muted` sobre `raised` |
| Borde fuerte | ≥ 3:1 (WCAG 1.4.11) | `border-strong` sobre `bg` y sobre `panel` |
| Rampa de superficie | monótona en `L` | `bg` < `panel` < `raised` |
| Sin HEX | 0 literales | ninguna paleta usa HEX sRGB |

**RED demostrado**: antes de la migración, 4 de los 5 tests fallaban (las
paletas estaban en HEX y el contraste no se podía calcular sobre OKLCH).

> **Deuda viva (`EGO-FIND-71`):** 6 hallazgos WCAG AA siguen registrados como
> `it.fails` en `apps/desktop/renderer/test/a11y.test.tsx`
> (FIND-A11Y-01..06, bordes 1.59–2.14:1 y texto 2.24–4.43:1 en 3 de las 4
> paletas). El harness OKLCH es la puerta de **no regresión**; la deuda de
> contraste heredada sigue abierta → Ola 2.

### 3.1 Las 7 combinaciones prohibidas

Viven en [`design-system.md`](design-system.md) §7. Resumen: `text-dim` con
`opacity-*` · `placeholder` con opacidad · `Badge tone=dim` con `opacity-70` ·
`border-hairline` como único indicador de input · hex literal sin token ·
derivar `--ego-color-dim` del `muted` del preset · texto sobre brand sin
`text-on-brand`.

---

## 4. Tabla de primitives del `ui-kit` ##

> Principio **D3** del owner (2026-10-19): *los componentes de librerías y
> framework se utilizan siempre; no se recrean desde cero si ya existe una
> primitive de librería o del framework.* Un componente propio solo existe
> cuando hay un **motivo concreto**, y ese motivo está escrito aquí.

| Primitive | Base | ¿Propio? | Motivo concreto (justificación D3) |
|---|---|---|---|
| `ui-kit/Select.tsx` | **`@radix-ui/react-select`** | Propio (envoltorio) | **Migrado en T5.** Se conserva el envoltorio (no el componente desnudo) por: (a) el **portal al host del diálogo** (`[data-ego-dialog-content]`) — Radix porta a `document.body` y eso rompe el `FocusScope` del `Dialog` (bucle infinito de foco); (b) el contrato de 9 estados P22 (loading/error/empty/overflow) uniforme con el resto del kit; (c) la forma pill `ego-pill-select` del design system. |
| `ui-kit/Modal.tsx` | **`@radix-ui/react-dialog`** | Propio (envoltorio) | Radix aporta el trap de foco, `Escape`, `role="dialog"` y `aria-modal` nativos (no reimplementables razonablemente). Se conserva el envoltorio por: (a) `data-ego-dialog-content` (marca que consume el portal del `Select`); (b) animación con `motion` + `useReducedMotion`; (c) los 9 estados P22. |
| `ui-kit/Tabs.tsx` | **`@radix-ui/react-tabs`** | Propio (envoltorio) | Radix aporta `tablist`/`tab`/`tabpanel`, navegación por flechas y `Escape` nativos. Se conserva el envoltorio por los 9 estados P22 y por el `data-state` que usan las hojas de estilo del design system. |
| `ui-kit/Button.tsx` | `cva` + `<button>` nativo | Propio | El design system define 9 estados (incl. `loading` con `aria-busy` + spinner, `error` con `variant="danger"` y `empty` que **mantiene la altura mínima**) y un tamaño mínimo de **44 px** (WCAG 2.2 target size). Un `<button>` de Radix no aporta nada aquí: no hay trigger, popover ni composición — es un botón con variantes. `cva` es la librería de variantes, no un reemplazo del componente. |
| `ui-kit/Input.tsx` | `<input>` nativo + `cva` | Propio | Los 9 estados P22 (`error` con `aria-invalid` + mensaje, `loading` con `aria-busy`, `empty` con hint, `overflow` con contador de `maxLength`) y el enlace con `aria-describedby`/`aria-errormessage` a los mensajes. Radix no ofrece un primitive de "text input" con esas variantes. |
| `ui-kit/Badge.tsx` | `cva` + `<span>` | Propio | El `tone="dim"` **no** puede usar `opacity-70` ( hunde el ratio de contraste por debajo de AA): el dim fijo `#8a8a92` es lo que da el AA. Es una regla de color del design system, no una capacidad de librería. Sin trigger ni composición → nada que delegar. |
| `components/PaneShell.tsx` (`SplitPane`) | Propio | Propio | Divisor `role="separator"` con `aria-valuenow/min/max`, teclado (flechas ±8 px, `Home`/`End`/`Escape`), doble clic para restablecer, límites elásticos y **persistencia en `localStorage`**. `react-resizable-panels` se evaluó y **se descartó**: es una dependencia nueva que no aporta más que este primitive ya existente y testeado. |

### 4.1 Primitives aún ad-hoc fuera del kit

Pendientes de revisión Radix / React Aria. **No migradas en la Ola 1**: hacerlo
sin el paquete instalado y sin un test rojo que demuestre la carencia habría
sido un cambio a ciegas.

| Primitive | Dónde | Paquete necesario | Decisión |
|---|---|---|---|
| Combobox + listbox | `components/omnibar.tsx` | — (ya hay `FuzzySearch` de `@ego/ui-runtime`) | **Propia con motivo**: combobox de búsqueda con fuzzy match sobre proyectos/sesiones/Sub-Egos. Radix no ofrece combobox; React Aria sí, y no está en el grafo de dependencias. Migrar a React Aria es una decisión de Nivel 10 pendiente de valorarse. |
| Dropdown / outside-click | `components/SubEgoSelector.tsx` | `@radix-ui/react-dropdown-menu` | **Propia con motivo provisional** — sin `FocusScope` ni navegación por teclado. **Es la deuda más real**: no cumple el conjunto de 9 estados. Candidata a migración (A4, dependencia nueva → A7). |
| Popover | `components/ego-chat.tsx`, `components/sidebar/Sidebar.tsx` | `@radix-ui/react-popover` | Sin primitive de librería instalada. |
| Tooltip | `components/FileMentionBadge.tsx`, `components/domains/DomainCharts.tsx` | `@radix-ui/react-tooltip` | Sin primitive de librería instalada. |

> Las 4 están inventariadas también en
> [`design-system.md`](design-system.md) §8.2. Este documento y aquel son
> complementarios: aquel explica el **por qué** del sistema, éste la **ficha de
> producto**.

---

## 5. Estado de implementación por superficie ##

| Superficie | Estado | Evidencia |
|---|---|---|
| Tokens semánticos | ✅ | `index.css` `:root` + `theme-tokens.css` |
| Paletas en OKLCH (4) | ✅ | `theme-tokens.css:32-72` · test `ThemeTokensOklch.test.tsx` (6 tests) |
| Rampa de superficie monótona | ✅ | verificada por el test |
| Contraste WCAG 2.2 en las 4 paletas | ✅ | verificado por el test (conversión OKLCH→sRGB) |
| Deuda de contraste heredada (FIND-A11Y-01..06) | 🟡 | 6 `it.fails` vivos en `a11y.test.tsx` → Ola 2 |
| Kit `ui-kit/` (6 componentes) | ✅ | `Select` migrado a Radix (ADR-0015) |
| 9 estados por componente | 🟡 | Kit base con suite; las 4 primitives ad-hoc (§4.1) sin cobertura |
| Primitives ad-hoc migradas | 🟡 | 0 de 4 migradas → dependen de 3 paquetes Radix nuevos |
| Catálogo de Canvas | ✅ 11 / 13 aspiracionales | `design-system.md` §4 |

---

## 6. Referencias ##

- `apps/desktop/renderer/src/styles/theme-tokens.css` — tokens y paletas.
- `apps/desktop/renderer/test/ThemeTokensOklch.test.tsx` — puerta de contraste.
- `apps/desktop/scripts/srgb-to-oklch.cjs` — conversor sRGB→OKLCH.
- `apps/desktop/renderer/components/canvas/DesignSystemProvider.tsx` — temas y presets.
- `apps/desktop/renderer/components/ui-kit/` — kit.
- `apps/desktop/renderer/components/PaneShell.tsx` — `SplitPane`.
- [`design-system.md`](design-system.md) — tokens semánticos, 9 estados, catálogo, contraste.
- [`../adr/0015-radix-select-accesible.md`](../adr/0015-radix-select-accesible.md) — decisión D3 del `Select`.
- `docs/roadmap/Backlog.md` — `EGO-FIND-71`, `EGO-FIND-72`.
