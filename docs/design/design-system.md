# Design System Canónico de Ego

| Campo | Valor |
| --- | --- |
| Estado | Canónico — fuente vigente de tokens, temas, kit y catálogo |
| Owner | ness-e |
| Fecha | 2026-10-14 |
| Implementación | `apps/desktop/renderer/src/index.css` (tokens) · `components/canvas/DesignSystemProvider.tsx` (temas) · `components/ui-kit/` (kit Radix) · `components/canvas/registry.ts` (catálogo) |
| Decisiones | Owner 2026-10-14 (D12, UI-01..UI-06): dark-only, 4 presets, accent ámbar, Geist, 9 estados |

> **Regla de finalización (ux-ui.md P22):** `Feature DONE = Implementado + Funcional + Usable + Consistente + Estados completos + Accesibilidad básica + Design System`. Nada que use estilos ad-hoc se considera terminado.

## 1. Tokens semánticos (`--ego-*` + Tailwind v4)

Fuente única: `:root` en `index.css` (líneas 12–22) consumido vía `DesignSystemProvider`. Tailwind v4 emite `var(--color-*)` en las utilidades; cada token resuelve con fallback:

| Utilidad Tailwind | Token `--ego-*` | Fallback verificado |
|---|---|---|
| `bg-paper` / `text-ink` | `--ego-color-bg` / `--ego-color-text` | `#0a0a0b` / `#f4f4f5` |
| `bg-panel` / `bg-raised` | `--ego-color-panel` / `--ego-color-raised` | `#111113` / `#17171a` |
| `border-hairline` / `text-faint` | `--ego-color-border` / `--ego-color-muted` | `#26262b` / `#8e8e93` |
| `bg-accent` / `text-accent` (brand) | `--ego-color-brand` | `#f59e0b` (ámbar) |
| `rounded-card` | `--ego-radius` | `8px` (radio real, ver EGO-FIND-11) |
| `font-sans` / `font-mono` | `--font-geist-sans` / `--font-geist-mono` | Geist por import, fallback system-ui (ver EGO-FIND-02) |

Prohibido: `style={{}}` ad-hoc en componentes de producto, hex literales fuera de `index.css`, clases `bg-accent`/`text-accent` fuera del sistema (ver EGO-FIND-10). Excepción: acentos semánticos de estado (emerald/amber/rose/cyan/purple) y hex de Recharts anclados a tokens vía `var(--color-*, fallback)`.

Frameless: `.app-region-drag` en el chrome de ventana; controles interactivos llevan `.app-region-no-drag` (ver EGO-FIND-11, gui-desktop.md regla 4).

## 2. Temas: dark-only, 4 presets funcionales

Decisión owner: **dark-only**. `UserPrefs.theme` (tema claro) queda documentado como futuro, no implementado. Presets en `PRESET_THEMES` (`DesignSystemProvider.tsx:37`):

| Preset | Uso |
|---|---|
| `default-dark` | Base (`DEFAULT_DESIGN_TOKENS`) |
| `midnight-cyan` | Variante fría de alto contraste |
| `emerald-terminal` | Variante terminal verdosa |
| `amber-warm` | Variante cálida sobre el accent ámbar |

`ThemeControl` aplica el preset vía `applyPreset(presetId)`; `index.css` consume `--ego-*`, por lo que el cambio es funcional en toda la app (ver EGO-FIND-11). Contraste: dim `#8a8a92` (AA verificado, ver EGO-FIND-08).

## 3. Kit UI sobre Radix + Zustand (`components/ui-kit/`)

Base: `@radix-ui/react-dialog` + `@radix-ui/react-tabs` (trap de foco, roles y Escape nativos) + `zustand` (store ligero) + `clsx` + `tailwind-merge` + `cva`. Componentes: `Button`, `Input`, `Modal`, `Tabs`, `Badge` (+ `store.ts`, `cva.ts`).

Los 6 modales duplicados migran al `Modal` base; `ModelPicker` (header, proveedor real vía ModelRouter) y `SessionPicker` (sidebar, sesiones VantaDB) se montan, no se borran; `SplitPane` dimensiona el layout en `App.tsx:61`.

### 9 estados obligatorios por componente (ver EGO-FIND-12)

Todo componente del kit soporta contractualmente: `default`, `hover`, `active`, `focus`, `disabled`, `loading`, `error`, `empty`, `overflow`. Sin los 9, el componente no entra al catálogo.

## 4. Catálogo honesto: 11 implementados vs 13 aspiracionales

Verificado en `components/canvas/registry.ts:39-51` (props inferidos por Zod vía `CanvasPropsSchema`, ver EGO-FIND-13): **11 renderers implementados**: `table`, `card`, `form`, `chart`, `board`, `editor`, `diff`, `terminal`, `record_view`, `query_view`, `relation_view`.

El inventario histórico citaba 24 (ver EGO-FIND-16). Doctrina honesta: los **13 restantes son aspiracionales** — ningún Sub-Ego puede componer un tipo fuera del `ComponentRegistry`; la ampliación del catálogo exige vista tipada + entrada en el registry + sus 9 estados. Mermaid: **NO implementado en el renderer** (cero dependencia `mermaid` en `package.json`, cero imports en `apps/`, cero entrada en el registry; verificado 2026-10-15, cierra EGO-FIND-16). `LazyTelemetryChart` (`DomainCanvasView.tsx:25`) es lazy de recharts (`DomainCharts.js`), no de mermaid — la mención anterior que los equiparaba queda corregida. Un futuro tipo `mermaid` exigiría vista tipada + entrada en el registry + sus 9 estados + chunk lazy propio.

## 5. Rendimiento: lazy + windowing + skeletons + anti-shift

- `React.lazy` para charts/dominios (`LazyTelemetryChart` verificado en `DomainCanvasView.tsx:25`; código partido por vendor en `vite.config.ts:19-36`). Mermaid fuera del bundle: sin dependencia ni chunk (ver §4).
- `virtua` para windowing en chat/tablas/sidebar.
- Skeletons con altura reservada (no texto plano "Procesando…", no layout shift; ver EGO-FIND-15).
- `ErrorBoundary` global en `main.tsx` + `MessageRenderBoundary` por mensaje (patrón Hermes adaptado).
- `focus-visible` global + `dim #8a8a92` + labels en icon-buttons (ver EGO-FIND-07/08; axe bloquea CI, snapshots visuales advisory 2 semanas por decisión owner).

## 6. Mapa de superficies (D6/D7/D8)

4 superficies canónicas (ver `workspace-dinamico.md`, `mascota.md`): App Header (icono/estado 28–36px), Chat/Conversation River (orador 32–48px), Activity Widget (ejecución/HITL 40–90px), Dynamic Canvas (trabajo 48–120px). Widget **≠** Tray: el Widget es telemetría+HITL in-app; el Tray es icono OS con código de color (verde idle / azul pensando / rojo HITL, mínimo útil: click restaura, menú Mostrar/Salir, tooltip estado).

```mermaid
flowchart LR
    Chat[Chat: intención] --> Runtime[CharacterRuntime<br/>fuente única de estado]
    Runtime --> Widget[Activity Widget<br/>telemetría + HITL]
    Runtime --> Canvas[Dynamic Canvas<br/>registry de 11 vistas]
    Widget --> Tray[Tray OS<br/>verde/azul/rojo]
```

> Nota mermaid: los diagramas `mermaid` de los docs son texto de especificación y no se renderizan en la app (sin visor mermaid en el renderer, ver §4). Si el visor de docs no soporta mermaid, el texto del bloque sigue siendo la especificación.
