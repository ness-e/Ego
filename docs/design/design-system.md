# Design System Canónico de Ego

| Campo | Valor |
| --- | --- |
| Estado | Canónico — fuente vigente de tokens, temas, kit, catálogo, **tabla de primitives** y **puerta de calidad** |
| Owner | ness-e |
| Fecha | 2026-10-20 (remediación de coherencia visual, owner 2026-10-20) |
| Implementación | `apps/desktop/renderer/src/index.css` (puente `@theme`) · `src/styles/theme-tokens.css` (elevación, vidrio, superficies) · `components/canvas/DesignSystemProvider.tsx` (**fuente única de las 4 paletas**) · `components/ui-kit/` (11 primitives) · `components/canvas/registry.ts` (catálogo) · `apps/desktop/scripts/design-lint.cjs` (**puerta**) |
| Decisiones | Owner 2026-10-14 (D12, UI-01..UI-06): dark-only, 4 presets, accent ámbar, Geist, 9 estados · Owner 2026-10-19 (D3): tabla de primitives · Owner 2026-10-19 (T14): OKLCH · **Owner 2026-10-20: densidad densa+táctil · accent único · primitives Radix (dropdown/popover/tooltip) · OKLCH como fuente única · puerta `design-lint`** |

> **Regla de finalización (ux-ui.md P22):** `Feature DONE = Implementado + Funcional + Usable + Consistente + Estados completos + Accesibilidad básica + Design System`. Nada que use estilos ad-hoc se considera terminado.

> **Por qué existe este documento:** hasta el 2026-10-20 el design system estaba
> *declarado* pero no *aplicado*. La auditoría encontró 288 controles nativos
> reimplementando estilos, ~120 colores fuera de token, 19 hex literales, ~500
> `text-[Npx]`, 8 niveles de sombra y 7 radios conviviendo — mientras el kit
> `ui-kit/` (Button/Input/Badge) tenía **0 % de adopción** en código de
> producto. El problema no era el spec: era la falta de puerta. Por eso §10
> (la puerta) es tan vinculante como §1 (los tokens).

---

## 1. Tokens semánticos (`--ego-*` + Tailwind v4)

**Fuente única de la paleta:** `components/canvas/DesignSystemProvider.tsx`
(§2). `src/index.css` es el **puente** que expone esos valores como utilidades
Tailwind; `src/styles/theme-tokens.css` conserva lo que no es paleta
(elevación L0–L3, vidrio, superficies, scrollbar).

| Utilidad Tailwind | Token `--ego-*` | Fallback (mismo valor que el preset `default-dark`) |
|---|---|---|
| `bg-paper` / `text-ink` | `--ego-color-bg` / `--ego-color-text` | `oklch(0.13 0.004 285.8)` / `oklch(0.985 0 89.9)` |
| `bg-panel` / `bg-raised` | `--ego-color-panel` / `--ego-color-raised` | `oklch(0.195 0.004 286)` / `oklch(0.26 0.008 285.8)` |
| `border-hairline` / `text-faint` | `--ego-color-border` / `--ego-color-muted` | `oklch(0.274 0.005 286)` / `oklch(0.712 0.013 286.1)` |
| `bg-brand` / `text-brand` (accent) | `--ego-color-brand` | `oklch(0.769 0.165 70.1)` (ámbar) |
| `text-on-brand` | `--ego-color-text-on-brand` | `#0a0a0b` |
| `border-strong` | `--ego-color-border-strong` | `#71717a` |
| `text-dim` | `--ego-color-dim` | `#8a8a92` (fijo) |
| `focus-visible:outline-brand` | `--ego-color-focus-ring` | = **brand del preset** |
| `rounded-[var(--radius-card)]` | `--ego-radius` | `8px` |
| `font-sans` / `font-mono` | `--font-geist-sans` / `--font-geist-mono` | Geist (woff2 variable local) |

> ⚠️ **Corrección 2026-10-20:** la doc anterior decía `bg-accent` / `text-accent`.
> El token se llama **`--color-brand`** → las utilidades son **`bg-brand`,
> `text-brand`, `border-brand`, `outline-brand`**. `bg-accent` NO existe.

**Prohibido:** `style={{}}` ad-hoc en componentes de producto · hex literales
fuera de `index.css` / `theme-tokens.css` (el fallback `var(--color-*, #hex)`
sí está permitido) · clases de paleta cruda (`text-white`, `bg-white/*`,
`text-zinc-*`, `bg-black/*`, `bg-slate-*`) · `text-[Npx]` · `opacity-*` sobre
texto dim/faint o en `placeholder:` · `border-hairline` como **único**
indicador de un input · texto sobre `bg-brand` sin `text-on-brand` ·
`shadow-{xs,sm,md,lg,xl,2xl}` (usar las elevaciones L1–L3) ·
`rounded-{lg,xl,2xl,3xl}` (usar `--radius-card`).

> **Mapa de la paleta cruda -> tokens:** `emerald-500/400` -> `success` |
> `rose-300/500/950` y `red-800/300` -> `error` | `amber-400/500` -> `warning` |
> `cyan-300/400` y `blue-600/500` -> `brand` | `slate-*` -> `ink`/`faint`/`panel`.
> Fondos tintados: `bg-success/10`, `bg-error/10`, `bg-warning/10`, `bg-brand/10`.
> La puerta R7 verifica esta equivalencia (ver seccion 10).

**Escalas fijas del sistema (3 valores, sin excepción):**

| Escala | Valores | Regla |
|---|---|---|
| Superficie | `bg-paper` → `bg-panel` → `bg-raised` | 3 niveles, saltos perceptibles |
| Texto | `text-xs` (12) · `text-sm` (14) · `text-base` (16) | 3 tamaños, nada más |
| Radio | `rounded-md` (6) · `rounded-[var(--radius-card)]` (8) · `rounded-full` | 3 pasos |
| Elevación | `--ego-elevation-l1` (tarjeta) · `l2` (menú/popover) · `l3` (modal) | 3 niveles |

**Frameless:** `.app-region-drag` en el chrome de ventana; los controles
interactivos llevan `.app-region-no-drag`.

## 2. Temas: dark-only, 4 presets en OKLCH

Decisión owner: **dark-only**. `UserPrefs.theme` (tema claro) queda documentado
como futuro, no implementado. `nativeTheme` **no** gobierna el tema en P0.

### 2.1 Fuente única: el provider

`PRESET_THEMES` en `components/canvas/DesignSystemProvider.tsx` es la **única**
definición de las 4 paletas, en **OKLCH**. El provider escribe los valores
resueltos en `documentElement` (y también los `--ego-*` espejo en su div) y
publica `data-palette="<clave>"` en `<html>` como hook de CSS.

> **Por qué el provider y no el CSS (corrección 2026-10-20):** las paletas
> estaban duplicadas — en `theme-tokens.css` bajo `[data-palette="…"]`, que
> **ningún componente asignaba** (código muerto), y en HEX dentro del
> provider, que sí era lo que corría. Dos fuentes de verdad, una muerta. Los
> bloques `[data-palette]` se eliminaron; la puerta `ThemeTokensOklch.test.tsx`
> lee **el provider** y verifica lo que la app realmente pinta.

### 2.2 Las 4 paletas (OKLCH)

| Preset | bg | panel | raised | text | muted | border | brand |
|---|---|---|---|---|---|---|---|
| `default-dark` | `oklch(0.13 0.004 285.8)` | `oklch(0.195 0.004 286)` | `oklch(0.26 0.008 285.8)` | `oklch(0.985 0 89.9)` | `oklch(0.712 0.013 286.1)` | `oklch(0.274 0.005 286)` | `oklch(0.769 0.165 70.1)` |
| `midnight-cyan` | `oklch(0.13 0.027 261.7)` | `oklch(0.195 0.04 265.8)` | `oklch(0.26 0.037 260)` | `oklch(0.984 0.003 247.9)` | `oklch(0.711 0.035 256.8)` | `oklch(0.372 0.039 257.3)` | `oklch(0.715 0.126 215.2)` |
| `emerald-terminal` | `oklch(0.13 0.047 173.8)` | `oklch(0.19 0.05 165)` | `oklch(0.25 0.048 169.6)` | `oklch(0.979 0.021 166.1)` | `oklch(0.845 0.13 165)` | `oklch(0.508 0.105 165.6)` | `oklch(0.696 0.149 162.5)` |
| `amber-warm` | `oklch(0.13 0.006 56)` | `oklch(0.195 0.006 34.3)` | `oklch(0.26 0.008 67.6)` | `oklch(0.962 0.058 95.6)` | `oklch(0.869 0.004 56.4)` | `oklch(0.444 0.01 73.6)` | `oklch(0.769 0.165 70.1)` |

**Rampas de superficie:** las 4 comparten la misma estructura en `L`
(**0.130 → 0.195 → 0.260**): el salto entre niveles es idéntico en todas,
que es exactamente el efecto que OKLCH compra. `emerald-terminal` y
`amber-warm` tenían rampas **no monótonas** (L 0.255/0.256/0.255) → se
re-resolvieron por búsqueda numérica contra las restricciones WCAG (§7).

**`high-contrast` y `warm-sepia`:** eran paletas CSS aspiracionales sin
correspondencia en el producto (la UI ofrece `default-dark`,
`midnight-cyan`, `emerald-terminal`, `amber-warm`). Se eliminaron del CSS; un
preset `high-contrast` queda como **backlog**, no como dead code.

### 2.3 Accent único (decisión owner 2026-10-20)

> Antes coexistían **dos acentos vivos**: el brand real en runtime era cyan
> `#38bdf8` (preset `default-dark`) y el focus-ring era ámbar `#f59e0b` fijo →
> un control podía tener borde cyan y foco ámbar. Ahora el **focus-ring ES el
> brand del preset** y `default-dark` usa el **ámbar** que la doc declaraba
> (D12, "accent ámbar").

| Preset | brand | focus-ring (= brand) | ratio vs bg (UI ≥3:1) |
|---|---|---|---|
| `default-dark` | `oklch(0.769 0.165 70.1)` (ámbar) | idem | 9.26:1 |
| `midnight-cyan` | `oklch(0.715 0.126 215.2)` | idem | 8.29:1 |
| `emerald-terminal` | `oklch(0.696 0.149 162.5)` | idem | 6.11:1 |
| `amber-warm` | `oklch(0.769 0.165 70.1)` | idem | 8.14:1 |

`--ego-color-dim` (`#8a8a92`) sigue siendo **FIJO** y el provider **nunca** lo
deriva del `muted` del preset (riesgo `emerald-terminal` verdoso: rompería el
AA silenciosamente).

> **FUTURO — tema claro / seguir OS (post-P0, no implementado):** P0 es
> **dark-only**. `UserPrefs.theme` queda **reservado** como clave futura (tokens
> light mapeados pero inactivos). `nativeTheme` **no** gobierna el tema en P0.
> El provider **no debe pisar `--color-dim` sin medir cada preset**.

### 2.4 Los colores semánticos (`success` / `warning` / `error`) y la colisión de iconos

Los tres colores semánticos **no** están en la tabla de §2.2 (que documenta las
rampas de superficie y el accent). Viven en
`apps/desktop/renderer/components/canvas/DesignSystemProvider.tsx` y se publican
como `--ego-color-success|warning|error`.

| Preset | `success` | `warning` | `error` |
|---|---|---|---|
| `default-dark` | `oklch(0.696 0.149 162.5)` | **`oklch(0.837 0.164 84.4)`** | `oklch(0.645 0.215 16.4)` |
| `midnight-cyan` | `oklch(0.696 0.149 162.5)` | `oklch(0.769 0.165 70.1)` | `oklch(0.637 0.208 25.3)` |
| `emerald-terminal` | `oklch(0.773 0.153 163.2)` | **`oklch(0.837 0.164 84.4)`** | `oklch(0.711 0.166 22.2)` |
| `amber-warm` | `oklch(0.696 0.149 162.5)` | **`oklch(0.837 0.164 84.4)`** | `oklch(0.637 0.208 25.3)` |

#### La decisión: `warning` ≠ `brand` en los 2 presets de accent ámbar (2026-10-21)

**Valor elegido:** `warning = oklch(0.837 0.164 84.4)` en `default-dark` y
`amber-warm` (los 2 presets cuyo `brand` es el ámbar `oklch(0.769 0.165 70.1)`,
fijado por la decisión de accent único de §2.3).

**Motivo:** los iconos de dominio se tiñen con tokens semánticos
(`apps/desktop/renderer/components/domains/DomainSelector.tsx:26-32`):

```tsx
engineering: <Code   size={16} className="text-brand" />,
product:     <Kanban size={16} className="text-warning" />,
knowledge:   <BookOpen size={16} className="text-chart-violet" />,
analytics:   <ChartBar size={16} className="text-success" />,
crm:         <Users  size={16} className="text-error" />,
```

Con `warning` igual a `brand`, **los iconos de `engineering` y de `product`
salían idénticos** en `default-dark` y `amber-warm`: dos dominios distintos
pintados con el mismo color, sin ninguna pista visual de cuál es cuál. Es
precisamente el tipo de defecto que la puerta `design-lint` **no** puede ver
(la puerta vigila hexes y tokens, no la semántica del color).

**Medición del valor nuevo** (cálculo determinista, mismo método que §7):

| Preset | `warning` vs bg | `warning` vs raised |
|---|---|---|
| `default-dark` | **8.24:1** | **8.05:1** |
| `midnight-cyan` | 5.83:1 | 5.70:1 |
| `emerald-terminal` | **8.24:1** | **8.06:1** |
| `amber-warm` | **8.24:1** | **8.05:1** |

El valor nuevo **además mejora el contraste** frente al anterior
(`oklch(0.769 0.165 70.1)`: 5.83:1 sobre bg), así que la corrección visual no
cuesta nada en accesibilidad.

**Regla que sale de la decisión:** *un token semántico no puede coincidir con
el `brand` de su preset si ambos se usan como color de icono de dominio.* Por
eso `midnight-cyan` conserva `oklch(0.769 0.165 70.1)` (su `brand` es cyan:
`oklch(0.715 0.126 215.2)`, no hay colisión) y `emerald-terminal` comparte el
valor nuevo por coherencia.

## 3. Kit UI sobre Radix + Zustand (`components/ui-kit/`)

**11 primitives**, todas sobre primitivas de librería (principio D3):

| Primitive | Base | Notas |
|---|---|---|
| `Button` | `<button>` nativo + `cva` | variantes `primary`/`secondary`/`ghost`/`danger`/`accent`; tamaños `sm`/`md`/`lg`/`icon` |
| `Input` | `<input>` nativo + `cva` | 9 estados; `wrapperClassName` para el ancho del envoltorio |
| `Textarea` | `<textarea>` nativo | gemelo de `Input` (contador de overflow incluido) |
| `Badge` | `<span>` + `cva` | tonos semánticos; `tone=dim` **sin** `opacity` |
| `Modal` | `@radix-ui/react-dialog` | `data-ego-dialog-content` (host del portal del `Select`); `motion` + `useReducedMotion` |
| `Tabs` | `@radix-ui/react-tabs` | navegación por flechas, `data-state` |
| `Select` | `@radix-ui/react-select` | portal al host del diálogo anfitrión (evita el ping-pong de `FocusScope`) |
| `Switch` | `@radix-ui/react-switch` | `role="switch"` + `aria-checked`; el `label` amplía el área pulsable |
| `Menu` | `@radix-ui/react-dropdown-menu` | **nuevo 2026-10-20** — sustituye los dropdowns ad-hoc |
| `Popover` | `@radix-ui/react-popover` | **nuevo 2026-10-20** — sustituye los popovers ad-hoc |
| `Tooltip` | `@radix-ui/react-tooltip` | **nuevo 2026-10-20** — sustituye los tooltips hand-rolled |

### 3.1 Los 9 estados obligatorios

Todo componente del kit soporta contractualmente: `default`, `hover`, `active`,
`focus`, `disabled`, `loading`, `error`, `empty`, `overflow`. Sin los 9, el
componente no entra al catálogo. Puerta: `test/ui-kit-nine-states.test.tsx`.

### 3.2 Densidad y target size (decisión owner 2026-10-20)

La regla antigua ("44 px para todo") se sustituye por el criterio real de
**WCAG 2.2 SC 2.5.8 (Target Size, AA = 24×24 px)**, más la distinción entre
control **con etiqueta** y control **sólo-icono**:

| Caso | Mínimo | Motivo |
|---|---|---|
| Control con etiqueta visible | **24 px** (el kit usa 28 `sm` / 32 `md`) | densidad real; 44 px por fila rompe el ritmo vertical (Claude/Codex/OpenClaw usan 28–32) |
| Control **sólo-icono** | **44×44** | sin etiqueta, el área pulsable es la única pista de affordance → el `Button` lo aplica solo (`min-h-11 min-w-11`) |
| CTA táctil | **44 px** (`size="lg"`) | |

Puerta: `test/Targets44.test.tsx`.

## 4. Catálogo honesto: 12 implementados

Verificado en `components/canvas/registry.ts:68-91` (props inferidos por Zod
vía `CanvasPropsSchema`): **12 renderers implementados**: `table`, `card`,
`form`, `chart`, `board`, `editor`, `diff`, `terminal`, `record_view`,
`query_view`, `relation_view` y **`mermaid`**.

> **Corrección 2026-10-20 (drift):** la doc anterior afirmaba que mermaid
> "**NO** implementado, cero entrada en el registry". Es **falso** desde la
> Ola 1b: `MermaidView.tsx` existe y está registrado (`registry.ts:82-91`).
> Lo que sí es cierto —y sigue siéndolo— es que **no hay dependencia del
> paquete `mermaid`**: el renderer sanea el fuente y lo pinta en `<pre>`
> (~1 MB fuera del bundle). `LazyTelemetryChart` es lazy de recharts y vive en
> `components/domains/views.tsx:35` (**no** en `DomainCanvasView.tsx`, que
> tiene 48 líneas — la cita anterior `DomainCanvasView.tsx:542` era obsoleta).

## 5. Rendimiento: lazy + windowing + skeletons + anti-shift

- `React.lazy` para charts/dominios (`LazyTelemetryChart`,
  `components/domains/views.tsx:35`); código partido por vendor en
  `vite.config.ts`.
- `virtua` para windowing en chat/tablas/sidebar.
- Skeletons con altura reservada (no texto plano "Procesando…").
- `ErrorBoundary` global en `main.tsx` + `MessageRenderBoundary` por mensaje.
- `focus-visible` global + `dim #8a8a92` + labels en icon-buttons.

## 6. Mapa de superficies (D6/D7/D8)

4 superficies canónicas: App Header (28–36 px), Chat/Conversation River
(orador 32–48 px), Activity Widget (40–90 px), Dynamic Canvas (48–120 px).
Widget **≠** Tray.

**Alturas de chrome unificadas (2026-10-20):** header global, header del chat,
header del workspace, header del inspector y cabecera del sidebar contextual
miden **todos `h-11` (44 px)**. Antes coexistían 40/44/52 px y las barras no
se alineaban entre vistas — una de las causas del aspecto "desordenado".

## 7. Contraste: tokens fijos y 7 combinaciones prohibidas (T-contraste)

Tokens fijos del sistema: `--ego-color-border-strong #71717a`,
`--ego-color-focus-ring` (= brand), `--ego-color-text-on-brand #0a0a0b`,
`--ego-color-dim #8a8a92`. El provider **no** los deriva del preset.

Medición WCAG (luminancia relativa, cálculo determinista 2026-10-20, validado
por `test/ThemeTokensOklch.test.tsx`):

| Par | Ratio | Veredicto |
|---|---|---|
| dim `#8a8a92` sobre bg de los 4 presets | 5.81 / 5.88 / 4.52 / 5.11:1 | ✅ AA texto (≥4.5:1) |
| dim sobre raised de los 4 presets | 4.57 / 4.55 / 4.58 / 4.55:1 | ✅ AA texto |
| border-strong `#71717a` sobre bg | 4.12 / 4.17 / 3.21 / 3.62:1 | ✅ UI ≥3:1 |
| border-strong sobre raised | 3.36 / 3.23 / 3.25 / 3.22:1 | ✅ UI ≥3:1 |
| text-on-brand `#0a0a0b` sobre brand | 9.21 / 8.15 / 7.80 / 9.21:1 | ✅ AA texto |
| focus-ring (= brand) sobre bg | 9.26 / 8.29 / 6.11 / 8.14:1 | ✅ UI ≥3:1 |

**Combinaciones prohibidas (7)** — la lista se mantiene; las que se
materializaron en código (prohibida #2 `placeholder:text-faint/70`, #4
`border-hairline` como único indicador, #5 hex sin token) están corregidas y
**la puerta de §10 impide que vuelvan**.

| # | Prohibido | Por qué | Reemplazo canónico |
|---|---|---|---|
| 1 | `text-dim` con `opacity-*` | hunde el texto bajo AA | `text-dim` fijo `#8a8a92` sólido |
| 2 | `placeholder:` con `opacity-*` o `/60` | hunde el placeholder | `placeholder:text-faint` sólido |
| 3 | `Badge tone=dim` con `opacity-70` | atenúa texto+borde | `border-hairline/60 bg-panel text-faint` sin opacity |
| 4 | `border-hairline` como ÚNICO indicador de input | indistinguible del fondo | `border-strong` + `focus-within:border-brand` + icono de error |
| 5 | Hex literal sin token | no tematiza, diverge | `var(--color-*, #fallback)` |
| 6 | Derivar `dim` del `muted` del preset | rompe el AA en `emerald-terminal` | `dim` FIJO `#8a8a92` |
| 7 | Texto sobre brand sin `text-on-brand` | bajo AA | `--ego-color-text-on-brand #0a0a0b` |

## 8. Tabla de primitives: librería vs propia (D3)

> **Principio (vinculante a todo el repo, `AGENTS.md` §4):**
> *Los componentes de librerías y framework se utilizan siempre; no se recrean
> desde cero si ya existe una primitive de librería o del framework.*
>
> Un componente **propio** solo existe si hay un **motivo concreto** — no
> "comodidad" ni "ya estaba hecho" — y ese motivo está escrito aquí. Si Radix,
> React Aria o la plataforma ofrece el equivalente y el propio no aporta nada,
> **se migra**.

### 8.1 Kit `ui-kit/`

| Primitive | Implementación | Decisión | Motivo |
|---|---|---|---|
| `Modal` | sobre `@radix-ui/react-dialog` | **Librería** | trap de foco, roles ARIA y `Escape` no triviales |
| `Tabs` | sobre `@radix-ui/react-tabs` | **Librería** | navegación por teclado y roles `tablist`/`tab`/`tabpanel` |
| `Select` | sobre `@radix-ui/react-select` | **Librería** | `ADR-0015`: sin `<select>` nativo (el menú del SO ignora el tema) |
| `Switch` | sobre `@radix-ui/react-switch` | **Librería** (nuevo 2026-10-20) | `role="switch"` + `aria-checked` + estado compartido; los 4 interruptores de Ajustes lo reimplementaban a mano |
| `Menu` | sobre `@radix-ui/react-dropdown-menu` | **Librería** (nuevo 2026-10-20) | cierra la deuda A4: `FocusScope`, teclado, roles `menu`/`menuitem`, retorno del foco |
| `Popover` | sobre `@radix-ui/react-popover` | **Librería** (nuevo 2026-10-20) | cierra la deuda A4: foco + `Escape` + `outside-click` |
| `Tooltip` | sobre `@radix-ui/react-tooltip` | **Librería** (nuevo 2026-10-20) | cierra la deuda A4: `role="tooltip"` + delay + `prefers-reduced-motion` |
| `Button` | propio sobre `<button>` nativo | **Propia — con motivo** | Radix no ofrece Button; el wrapper unifica las 5 variantes, los 9 estados, la densidad y el target táctil |
| `Input` / `Textarea` | propios sobre el control nativo | **Propia — con motivo** | Radix no ofrece input; el wrapper añade tokens, estados de error, contador y `aria-errormessage` |
| `Badge` | propio sobre `<span>` | **Propia — con motivo** | Radix no ofrece Badge; es un `<span>` con tonos semánticos |
| Estado global de UI | `store.ts` sobre `zustand` | **Librería** | Zustand ya estaba en el grafo de dependencias |
| Variantes de estilo | `cva.ts` sobre `cva` + `clsx` + `tailwind-merge` | **Librería** | `cva` + `clsx` + `tailwind-merge` resuelven variantes y merge |
| `components/PaneShell.tsx` (`SplitPane`) | propio | **Propia — con motivo** | `role="separator"` con teclado, doble clic, límites elásticos y persistencia en `localStorage`; `react-resizable-panels` se evaluó y se descartó |

#### API pública por primitive (props)

> Extensión de la ola 2026-10-20: props añadidas al kit para **cerrar los
> huecos de API** que reportaron los agentes de migración. Todas son
> **retro-compatibles** (ningún consumidor previo se rompe).

| Primitive | Props | Nota |
|---|---|---|
| `Button` | `variant`, `size`, `loading`, `truncate`, **`icon`**, `ref` | `forwardRef` **real**: el `ref` llega tipado al `<button>` (lo exige Radix `asChild` en `Menu`/`Popover`, que montan el `Button` del kit como trigger). `icon` renderiza el icono **antes** del `<span>` de contenido, así que el `gap-1.5` del base lo separa de la etiqueta → **sustituye al hack `[&>span]:flex [&>span]:items-center`** que cada consumidor repetía. El icono es decorativo (`aria-hidden`) y **no cuenta como texto visible** (un botón sólo-icono sigue siendo 44×44). |
| `Input` | `error`, `hint`, `loading`, `truncate`, `size`, `wrapperClassName`, **`leadingIcon`** | `leadingIcon` mete el icono **dentro** de la caja del campo: hereda borde, `focus-within` y padding `px-2.5`, y el separador con el texto es el `gap-2` del contenedor (p. ej. la lupa del buscador de `QueryView`). |
| `Tabs` | `tabs`, `value`/`defaultValue`, `onValueChange`, `error`, `empty`, `loading`, `ariaLabel`, **`className`**, **`contentClassName`** | `className` va a la **raíz** del kit y `contentClassName` al **panel** (`div[role=tabpanel]`). La raíz de Radix es ahora una columna flex (`flex grow min-h-0 flex-col`), así que el panel crece con `contentClassName="flex-1 min-h-0"` **sin** el selector arbitrario `[&>div>div>div[role=tabpanel]]:flex-1` que usaba `WorkbenchView`. |
| `Menu` | `trigger`, `items`, `align`, `side`, `sideOffset`, **`open`**, **`onOpenChange`**, `ariaLabel`, `className`, `contentClassName`, `loading`, `error` | `MenuItem.checked` convierte el ítem en opción de "uno de": se renderiza como `RadioItem` de Radix (`role="menuitemradio"` + `aria-checked` + `ItemIndicator` con el check) y el `onSelect` se mantiene. `open`/`onOpenChange` dan el estado de apertura controlado (igual que `Popover`). ⚠️ `ariaLabel` **no nombra el menú**: Radix fija `aria-labelledby` al trigger y ese atributo tiene prioridad sobre `aria-label` en el cálculo del nombre accesible. |

### 8.2 Primitives aún ad-hoc (pendiente de revisión)

| Primitive | Dónde | Estado |
|---|---|---|
| Combobox + listbox | `components/omnibar.tsx` | **Propia con motivo**: combobox de búsqueda con fuzzy match sobre proyectos/sesiones/Sub-Egos (`FuzzySearch` de `@ego/ui-runtime`). Radix no ofrece combobox; React Aria sí, y no está en el grafo. Decisión de Nivel 10 pendiente. |
| Listbox/option (`role="option"`) | `omnibar.tsx`, `ModelPicker.tsx`, `SessionPicker.tsx` | **Propia con motivo**: el patrón ARIA de listbox no está en Radix. |

> Las 4 exenciones que la doc anterior listaba como "ad-hoc pendientes"
> (dropdown, popover, tooltip, combobox) **quedan en 2** tras laOLA 2026-10-20.

### 8.3 Reglas de aplicación

1. **Antes de añadir un componente al kit**, comprobar esta tabla. Si existe
   una primitive de librería equivalente → se usa la de librería.
2. **Toda fila "propia"** debe poder responder "¿qué aporta esto que la
   librería no?" en una frase. Si no puede, es una recreación → migrar.
3. **Toda migración** se registra como ADR o como fila de esta tabla con el
   ADR asociado.
4. **Verificación**: al añadir o cambiar una primitive, actualizar esta tabla
   en el mismo commit.

## 9. Estado de implementación por superficie

| Superficie | Estado | Nota |
|---|---|---|
| Tokens semánticos | ✅ | §1 |
| Temas dark-only (4 presets OKLCH) | ✅ | §2 — fuente única en el provider |
| Accent único (focus-ring = brand) | ✅ | §2.3 |
| Kit `ui-kit/` (11 primitives) | ✅ | §3 — 4 migrados a Radix en laOLA 2026-10-20 |
| 9 estados por componente | ✅ | `test/ui-kit-nine-states.test.tsx` |
| Densidad densa + táctil | ✅ | §3.2 |
| Escalas fijas (tipografía/radio/elevación) | ✅ | §1 |
| Catálogo de Canvas | ✅ 12 implementados | §4 |
| Contraste | ✅ Medido + 7 combinaciones prohibidas | §7 |
| Puerta de calidad (`design-lint`) | ✅ | §10 |

## 10. La puerta: `design-lint` (lo que faltaba)

Un design system sin puerta se convierte en documentación de ficción: por eso
la doc declaraba reglas que el código incumplía durante meses.

**`apps/desktop/scripts/design-lint.cjs`** — linter sin dependencias que
recorre `components/` y `src/` y falla (exit 1) ante:

| Regla | Detecta | Severidad |
|---|---|---|
| R1 | hex literal fuera de `var(--color-*, fallback)` | error |
| R2 | `style={{}}` ad-hoc (escape: `// design-lint: allow`) | error |
| R3 | `text-[Npx]` arbitrario | error |
| R4 | `opacity` sobre texto dim/faint o en `placeholder:` | error |
| R5 | `border-hairline` como único indicador de un input | error |
| R6 | `<select>` nativo | error |
| R7 | paleta cruda de Tailwind (23 familias: `slate`…`rose`, `white`, `black`) | error |
| R8 | recuento de `<button>/<input>/<textarea>` nativos (métrica de adopción del kit) | aviso |
| R9 | radio fuera de escala (`rounded` = 4px, `rounded-lg/xl/2xl/3xl`, `rounded-[Npx]`) | error |
| R10 | cabecera fuera del chrome unificado (`h-12`/`h-10` en un elemento con trazas de barra) | error |
| R11 | superficie derivada con alfa (`bg-paper/N`, `bg-panel/N`, `bg-raised/N`) | error |
| **R12** | **CSS crudo fuera del design system**: `!important` (rompe la cascada: el orden de Tailwind no es determinista por texto) y colores literales `rgb()/rgba()/hsl()/hsla()`. R1 (hex) se aplica también al CSS, **excepto** en los ficheros de tokens (`src/index.css`, `src/styles/theme-tokens.css`), que son la fuente canónica | error |

> **R7/R9/R10/R11 se añadieron el 2026-10-20** tras la auditoría visual: la
> puerta declaraba 3 escalas fijas (radio, superficie, chrome) que **no
> verificaba**, y su R7 original era **ciego a las plantillas literales**
> (`` className={`… ${cond ? "bg-emerald-500" : …}`} `` devolvía un blob
> pegado a comillas que ninguna regla reconocía) y sólo conocía 3 familias
> (`white`/`black`/`zinc`). Por eso reportaba 0 errores con 154 usos de
> paleta cruda en el renderer.
> **R12 (2026-10-21) y el alcance de R7 a las tablas `cva`:** la puerta
> analizaba sólo `.tsx`/`.ts`, así que el **CSS del renderer** (19 KB en
> `floating/floating.css` y cualquier CSS nuevo) quedaba fuera; y las
> **variantes compuestas por `cva`** no pasan por `className=`, de modo que un
> `text-emerald-400` en una variante nueva **pasaba** la puerta. Ahora la puerta
> recorre el CSS (con la excepción de los ficheros de tokens) y `extractCvaValues`
> recorre los literales de `cva({…})`. **La deuda heredada del CSS del flotante
> (36 `!important` + 4 colores crudos) está nombrada, no escondida**: entrada
> `EGO-DL-024` (`kind: "deuda"`, motivo `DEBT_CSS_RAW`, fecha 2026-10-21) en el
> `WHITELIST` del linter **y** en el `EXPECTED_EXEMPTIONS` del test (un diff
> visible, no una edición silenciosa). Estado medido: `R12 [ERROR] CSS crudo
> fuera del design system — 0 errores (40 granfathered)`.

**Excepciones por CONTRATO: se indexan por hash del contenido, no por ID
posicional.** Cada entrada declara sus **huellas** (`fingerprints: [{ hash:
'…', match: '#…' }]`), de modo que un hex literal nuevo **no desplaza** los IDs
ni deja obsoletas las excepciones. Antes se indexaban por `EGO-DL-0NN`, asignado
en orden de escaneo: un solo refactor invalidaba la lista entera en silencio
—un mecanismo de excepción que se autodesactivaba es peor que no tenerlo, porque
da falsa confianza—.

Cada entrada lleva además **motivo + fecha + ID de hallazgo** (`EGO-DL-###`).
Un fichero nuevo con la misma infracción **no** queda cubierto: la puerta se
enciende sola. `--prune` las poda automáticamente (una entrada obsoleta = deuda
ya saldada). Estado medido (2026-10-21): **6 entradas · 79 huellas · 3 casos
verificables** en `test/design-lint.test.tsx`.

**Puerta de test:** `test/design-lint.test.tsx` verifica que (a) el renderer
actual tiene 0 errores, (b) la lista de excepciones del script coincide con la
del test, (c) cada excepción trae motivo/fecha/ID y ficheros existentes, (d)
las excepciones no están obsoletas y (e) **la puerta está encendida** (un
fixture temporal con un hex, un `<select>`, un `bg-emerald-500`, un
`rounded-2xl`, un `bg-panel/95` y un `h-12` produce los errores esperados).

**Ejecución:** `node apps/desktop/scripts/design-lint.cjs [--json] [--prune] [dir]`
· `pnpm --filter @ego/desktop design:lint`.

## 10.1 La auditoría visual: `ego-browser-audit`

La puerta de arriba es **estática** (lee el código). Faltaba la contraparte
**en ejecución**: medir el DOM renderizado. El arnés se **desacopló** del
compositor de `ego-lite` (que no capturaba y producía un **verde falso**: 0 pasos
⇒ 0 infracciones) y ahora son **dos caminos con un solo spec**:

| Fichero | Rol |
|---|---|
| `apps/desktop/scripts/design-audit-spec.mjs` | **El spec compartido**: contrato, función de medición, pasos por defecto y resolución de localizadores. Es la **única** fuente de verdad de qué se mide |
| `apps/desktop/scripts/ego-browser-audit.mjs` | **Camino de referencia** (ego lite): ahora **importa** el spec en vez de duplicarlo |
| `apps/desktop/scripts/design-audit-headless.mjs` | **Camino de rescate**: Chromium headless vía Playwright, **sin compositor** |
| `apps/desktop/scripts/run-design-audit.ps1` | El wrapper: intenta ego lite → si no produce un informe con pasos, **cae al rescate** (y el criterio de caída incluye `stepsOk === 0`, que es exactamente el fallo clásico del compositor) |

```powershell
pnpm --filter @ego/desktop dev
pwsh -File apps/desktop/scripts/run-design-audit.ps1 -Out C:\temp\ego-audit
```

Códigos: 0 = sin infracciones · 1 = infracciones · 2 = fallo del arnés.

**Qué mide ahora (2026-10-21):** además de `font-size`, radio, `box-shadow`,
`background-color`, altura de cabecera, targets y desbordes, la auditoría mide
**COLOR** (la calibración de contraste del tinte compuesto, que antes sólo
cubría la puerta de tokens) y abre el **canvas de avatares** (paso `04b-avatares-canvas`),
que antes **no se abría** y por tanto nunca auditaba al avatar. Ese paso nuevo
**encontró un defecto real**: 6 infracciones `TARGET`, con dos botones del panel
de avatares a **18 px** (un `Button size="sm"` con `h-auto` anulaba el `h-7` del
kit) — muy por debajo del mínimo de **24 px** de §3.2. Corregido. Corrida
**verde**: **7/7 pasos · 0 infracciones**.

**Por qué es un script y no un agente:** una auditoría hecha "a mano" con un
navegador se degrada (ventana minimizada → `Page.captureScreenshot` expira;
un objetivo que no se encuentra → reintentos en bucle; pestañas acumuladas
hasta ensuciar el navegador del usuario). El arnés lo resuelve: **des-minimiza
y maximiza** la ventana, **fuerza el viewport**, pone un **timeout duro en
cada operación**, **registra y continúa** ante un paso fallido, y **cierra su
TaskSpace** (`task.finish({ keep: [] })`) sin tocar las pestañas del usuario.

> **Trampas de ego-browser documentadas en el propio script** (aprendidas a la
> fuerza): `page.targetId` es `undefined` (el target sale de `task.tabs()`);
> `task.page(label)` no crea páginas (hay que usar `task.newPage()`);
> `page.goto()` puede expirar esperando `load` porque el dev-server de Vite
> mantiene abierto el canal HMR; y `@radix-ui/react-select@2.3.x` **descarta**
> el `className` de `Select.Value` (por eso el truncado va en un `<span>`
> envoltorio dentro del propio kit).

### 10.2 Hallazgos de la auditoría del 2026-10-20 (18 defectos, corregidos)

Críticos: **D1** la navegación del Workspace se salía 456 px de la ventana ·
**D2** el `Select` de tema desbordaba en 3 líneas. Altos: paleta cruda en 3
verdes distintos, el `RootErrorBoundary` con otro aspecto, el cierre de
modales con radio de 4 px, cabeceras de modal de 48 px, Personalización con
4 radios fuera de escala. Medios: 3 indicadores de modelo con 2 valores,
textos cortados a media palabra, KPI que no caben.

**Consecuencia estructural:** el diseño *se veía* descuidado no por los
detalles, sino porque **nada impedía** que cada pantalla se escribiera por
separado. La puerta de §10 (estática) + este arnés (dinámica) cierran ese
hueco: lo que se mide se puede bloquear.

> **Hallazgo de producto (no de diseño):** 8 de las 12 vistas del Canvas
> documentadas (`form`, `board`, `diff`, `terminal`, `record_view`,
> `query_view`, `relation_view`, `mermaid`) **no tienen ningún disparador en
> la UI**: el Canvas queda en "Espacio de trabajo vacío" aunque el usuario
> pulse "Ir al Canvas". Pendiente de una ola propia.
