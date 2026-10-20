# ADR 0015: `Select` de `ui-kit` sobre `@radix-ui/react-select` #

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-19 |
| Estado | Aceptado (implementado por A4 en la Ola 1 — verificado en el árbol de trabajo 2026-10-19) |
| Nivel jerárquico | 10.Implementation (`docs/jerarquia-canonica.md`) |

## Contexto ##

Ego tiene un componente `Select` propio en
`apps/desktop/renderer/components/ui-kit/Select.tsx`, implementado a mano con
`role="combobox"` / `role="listbox"` / `role="option"`, foco gestionado con
`useRef` y un popover propio. El motivo declarado en el propio fichero fue
evitar los `<select>` nativos del sistema operativo (menús del SO que rompen
el dark-only) y evitar colisiones de `FocusScope` con los Diálogos de Radix en
Happy-DOM.

El commit `87fc3ad` añadió la dependencia `@radix-ui/react-select ^2.1.6` al
renderer y un `Select` accesible, pero **la dependencia no se importaba en
ningún sitio** y el `Select` propio seguía siendo el usado. A 2026-10-19 el
renderer tenía **17 `<select>` nativos** en 12 ficheros de producción
(`CanvasRuntime`, `CronPanel`, `FormView`, `ShortcutsPanel`, `QueryView`,
`DomainCanvasView`, `SettingsModal`, `Sidebar`, `App`, `useSelectionContext`).

El owner resolvió el 2026-10-19 (decisión **D3**, principio general vinculante
a todo el repo):

> *Los componentes de librerías y framework se utilizan siempre; no se recrean
> desde cero si ya existe una primitive de librería o del framework.*

## Alternativas consideradas ##

- **`@radix-ui/react-select` (elegida):** primitive maduro, gestión de foco y
  teclado completa, typeahead, scroll de items, ARIA correcta y theming por
  tokens. Es exactamente lo que `Select.tsx` reimplementa a mano.
- **Mantener el `Select` propio (descartada):** solo se justificaría si
  aportase algo que Radix no da. Hoy no aporta: replica el comportamiento de
  Radix con menos accesibilidad (sin typeahead, sin navegación de items con
  scroll, foco manual).
- **`<select>` nativo del SO (descartada):** el menú del SO ignora el tema
  dark-only (ADR-0004) y rompe la coherencia visual; además es inaccesible
  en modo oscuro en varios SO.
- **React Aria (no evaluada):** alternativa viable de la misma familia;
  no se ha evaluado porque Radix ya está en el grafo de dependencias.

## Decisión ##

El componente `Select` del `ui-kit` se implementa **sobre
`@radix-ui/react-select`**, y los `<select>` nativos del renderer se
eliminan.

- `Select.tsx` deja de mantener foco y roles propios: envuelve
  `Select.Root` / `Select.Trigger` / `Select.Content` / `Select.Item`.
- La API pública del `ui-kit` (`value`, `onValueChange`, `options`,
  `ariaLabel`, `placeholder`) **se mantiene** para no romper los call sites;
  lo que cambia es la implementación interna.
- El motivo histórico del `Select` propio (evitar `<select>` nativos) queda
  cubierto: Radix no renderiza `<select>` nativos.
- La tabla de primitives con la decisión de cada una vive en
  `docs/design/design-system.md`.

## Consecuencias ##

- Positivas: accesibilidad real (teclado, typeahead, foco gestionado) sin
  mantener un listbox a mano; coherencia con el resto del kit Radix.
- Negativas: Radix `Select` usa `FocusScope` y portales, lo que fue
  exactamente el problema observado en Happy-DOM en los tests del `ui-kit`;
  los tests de `Select` (`apps/desktop/renderer/test/Select.test.tsx`) se
  reescribieron para verificar el patrón ARIA canónico de Radix.
- Deuda asumida: la migración está implementada (A4, Ola 1) — `Select.tsx`
  importa `@radix-ui/react-select` (145 líneas) y **el renderer no contiene
  ningún `<select>` nativo** (verificado: las únicas coincidencias del término
  están en comentarios de test). Queda por cerrar el ADR de `@ego/avatar` y
  la revisión de las primitives ad-hoc (§8.2 de
  `docs/design/design-system.md`).
- Riesgo: `Select.tsx` es API pública del `ui-kit`; el contrato `SelectProps`
  se mantiene, pero cambia el DOM (los tests que asertaran sobre `<select>`
  nativo fallaron y se reescribieron).

## Referencias ##

- `apps/desktop/renderer/components/ui-kit/Select.tsx`
- `apps/desktop/renderer/package.json` (`@radix-ui/react-select ^2.1.6`)
- `apps/desktop/renderer/test/Select.test.tsx`
- `docs/design/design-system.md` (tabla de primitives)
- `docs/roadmap/Backlog.md` (`EGO-FIND-56`)
