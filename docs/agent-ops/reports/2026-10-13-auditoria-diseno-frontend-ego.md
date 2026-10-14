---
title: Auditoría de Diseño Frontend de Ego — Informes completos + Análisis final
kind: engineering
status: active
description: "Consolidado de los 3 subagentes (auditoría de código UI, documentación de diseño, tareas de UI del backlog) y el análisis final con errores detectados, benchmark de interfaces similares y mejoras priorizadas."
tags: [ego, ui, ux, frontend, design-system, accessibility, audit, renderer]
fecha: 2026-10-13
alcance: apps/desktop/renderer + packages/ui-runtime + docs/**
---

# Auditoría de Diseño Frontend de Ego — Consolidado Completo

> **Contenido:**
> - **Parte I** — Informe del subagente 1: Auditoría de código UI del renderer
> - **Parte II** — Informe del subagente 2: Documentación de diseño/UX
> - **Parte III** — Informe del subagente 3: Tareas de UI del backlog
> - **Parte IV** — Análisis final integrado: errores, benchmark y mejoras priorizadas

---

# PARTE I — Auditoría de Código UI del Renderer (Subagente 1)

**Alcance analizado:** `apps/desktop/renderer/**` (src, components, lib, hooks, test, index.html, vite.config.ts) y `packages/ui-runtime/src` + tests. Nivel de detalle "muy exhaustivo". **No se modificó ningún archivo.**

## 1. Stack real y configuración de diseño

### 1.1 Dependencias verificadas (`apps/desktop/renderer/package.json:13-36`)
- React 19.0.0 + React-DOM 19.0.0 (`package.json:21-22`)
- `@assistant-ui/react` 0.15.23 + `@assistant-ui/react-streamdown` ^0.3.19 (`package.json:14-15`) — **`react-streamdown` está declarado pero nunca se importa en ningún `.tsx`** (grep sin resultados).
- Tailwind **v4.0.0-beta.8** vía `@tailwindcss/vite` (`package.json:27,32`) — no existe `tailwind.config.*` en todo el repo (glob verificado): configuración CSS-first únicamente.
- `geist` ^1.7.2 (`package.json:20`) — **instalado pero NO cargado**: no hay `import "geist/font/sans"`, ni `@font-face`, ni referencia al paquete en ningún `.ts/.tsx` (grep `geist/|@font-face` = 0 resultados). La familia `"Geist"` se declara en `index.css:4-5` pero sin fuente real, por lo que cae a system-ui/Segoe UI en Windows.
- `@phosphor-icons/react` ^2.1.10, `recharts` ^2.15.1, `@tanstack/react-table` ^8.21.2, `clsx` ^2.1.1, `tailwind-merge` ^2.5.4 (`package.json:17-24`).
- **`clsx` y `tailwind-merge` declarados pero NUNCA importados** (grep `clsx|tailwind-merge|twMerge` = 0 resultados en fuente): la composición de clases se hace con template literals crudos, lo que expone los bugs de duplicación/consistencia listados en §3 y §6.
- Vitest 2 + happy-dom para tests (`package.json:31,35`; `vite.config.ts:24-28`).

### 1.2 Configuración de Tailwind (`src/index.css` — 40 líneas, todo el "design system" estático)
- `@import "tailwindcss"` (`index.css:1`) + bloque `@theme` (`index.css:3-16`). Sin `@layer`, sin plugins, sin `@custom-variant`.
- **Tokens completos** (única fuente de verdad estática):
  - Tipografía: `--font-sans: "Geist", system-ui...` (`index.css:4`), `--font-mono: "Geist Mono", ui-monospace...` (`index.css:5`).
  - Color semántico (paleta dark-only): `--color-ink: #f4f4f5` (`:7`), `--color-paper: #0a0a0b` (`:8`), `--color-panel: #111113` (`:9`), `--color-raised: #17171a` (`:10`), `--color-hairline: #26262b` (`:11`), `--color-faint: #8e8e93` (`:12`), `--color-dim: #55555c` (`:13`).
  - Radio: `--radius-card: 8px` (`:15`) — **declarado pero nunca usado** (no aparece `radius-card` en ningún componente; todos usan `rounded-lg/rounded-md/rounded-xl/rounded-2xl` arbitrarios).
- Reset global: `html, body, #root` a `height:100%` con `background: var(--color-paper)` (`index.css:18-26`), selección invertida `::selection` (`index.css:28-31`).
- **Único `!important` del proyecto**: la query `prefers-reduced-motion` global (`index.css:33-40`) — justificado y correcto.

### 1.3 Tema dark/light
- **No hay abstraction dark/light.** La app es oscura hardcodeada: los 7 tokens son valores dark (`index.css:7-13`) y no existen variantes `[data-theme]`, `prefers-color-scheme` ni clases `dark:` en todo el renderer.
- Existe un **sistema de temas en runtime paralelo y desconectado**: `DesignSystemProvider` (`components/canvas/DesignSystemProvider.tsx`) con 4 presets (`default-dark` `:38`, `midnight-cyan` `:39-63`, `emerald-terminal` `:64-88`, `amber-warm` `:89-113`) que inyecta variables CSS `--ego-color-*`, `--ego-radius`, `--ego-density-pad`, `--ego-font-family`, `--ego-font-size` (`:164-179`) en un `<div id="ego-design-system-root">` (`:194-197`).
- **Hallazgo crítico de coherencia**: esas variables `--ego-*` **no consumen ningún componente**. Todo el UI usa las clases Tailwind estáticas (`bg-panel`, `text-ink`...). Cambiar el preset en `ThemeControl` (`src/App.tsx:23-42`) solo cambia variables CSS huérfanas — el look real no cambia. Los colores de los presets (`#38bdf8`, `#09090b`... `DesignSystemProvider.tsx:16-103`) tampoco coinciden con los de `index.css` (duplicación + divergencia).
- Sub-sistema de "temas" del character (mascota): `CharacterStateMachine.ts:57-190` define 14 estados con canales RGB (`accent`, etc.) y `TraitRegistry.ts:227-293` define `bodyColors`/`accentColor` — otro tercer sistema de color paralelo, solo para canvas 2D.

### 1.4 Tokens rotos referenciados
- `--font-geist-sans` / `--font-geist-mono` se referencian en `DesignSystemProvider.tsx:159-160` pero **no existen nunca** (index.css define `--font-sans`), por lo que el fallback real es `ui-sans-serif, system-ui`.
- Clases de color inexistentes en el `@theme` (Tailwind v4 no las genera → **estilos muertos en runtime**): `bg-accent` / `hover:bg-accent/40` / `active:bg-accent` (`components/PaneShell.tsx:146`), `text-accent` (`components/assistant-ui/markdown-text.tsx:142`; `components/ModelPicker.tsx:184`; `components/SessionPicker.tsx:144`), `bg-accent` + `border-accent` (`components/assistant-ui/ask-directive.tsx:73,88`). No existe `--color-accent` en ningún lado (verificado con grep).

## 2. Estructura de componentes y layout general

### 2.1 Layout global (`src/App.tsx`)
Columnas horizontales fijas, sin dock ni resizable en la app real:
- **Root**: `flex h-screen w-screen flex-col ... overflow-hidden select-none` (`App.tsx:74`), envuelto en `DesignSystemProvider` (`App.tsx:73`).
- **Header (h-10, drag-region)**: identidad + `ActivityWidget` + indicador "Local-First · NativeVantaDB" (`App.tsx:76-93`), con clases `app-region-drag`/`app-region-no-drag` (`:76,78,90`) — **clases personalizadas sin definir en index.css** (muertas).
- **`<main>`**: `flex flex-1 ... divide-x divide-hairline` (`App.tsx:96`) con 3 paneles:
  1. **Sidebar** (`App.tsx:98-104`) — ancho fijo 260px o rail 54px (§2.2).
  2. **Chat "Conversation River"**: `min-w-[380px] max-w-[550px]` (`App.tsx:107`), header h-10 con `SubEgoSelector` (`:108-117`) y `EgoChat` con `key={sessionNonce}` para remontar en nueva sesión (`:119`).
  3. **"Dynamic Workspace"**: `flex-1 bg-panel` (`App.tsx:124`), header h-9 con `DomainSelector` + `ThemeControl` + **4 botones de tab** (`:142-182`) que alternan `DailyDashboard` / `DomainCanvasView` / `CanvasRuntime` / `SubEgosView` (`:186-193`).
- **Footer**: `ActivityTray` (`App.tsx:199`).
- Estado de pestaña inicial según primer arranque del día vía `window.ego.daily.isFirstLaunch()` (`App.tsx:51-66`).
- `CANONICAL_DOMAINS` hardcodeado en App (`App.tsx:15-21`) con `defaultSubEgoId` duplicados respecto del roster hardcodeado del Sidebar (`sidebar.tsx:250-279`).

### 2.2 `components/sidebar.tsx` (918 líneas leídas; ~862 efectivas)
- **God-component**: sidebar + modal de Settings (tabs models/memory/gov) + modal de creación de proyecto + gestor MCP, en un solo archivo (`sidebar.tsx:60-96` son 14 `useState` + 1 `useState` de config de 11 campos `:70-94`).
- Dos modales renderizados condicionalmente con **diseño de modal duplicado** (overlay `fixed inset-0 z-50 bg-black/70 backdrop-blur-xs` + panel `h-[480px] w-[620px]` `:624-625` y `w-[480pxpx]` `:831-832`) — patrón repetido también en `ActivityWidget.tsx:79-84`, `ModelPicker.tsx:106-108`, `SessionPicker.tsx:75-77`, `WhyButton.tsx:37-38`, `McpManagerModal`, `sub-egos.tsx` (§6).
- Atajos globales Ctrl+B (colapsar) y Ctrl+N (nueva sesión) registrados en `window` (`sidebar.tsx:235-248`), se limpian bien en return; el atajo "Ctrl+," para settings se promete en el footer (`:605`) pero **no está implementado** (no hay handler).
- Datos muertos: `subEgos` y `sessions` son arrays hardcodeados (`sidebar.tsx:250-300`) — los botones "Artifacts del Canvas" y "Conectores Nivel A" no hacen nada (`:568-582`); en modo rail, 4 de 6 botones solo expanden el sidebar (`:328-359`).
- Sombra de `activeProject` en `loadProjects` vía closure: `badge: p.id === activeProject ? "Activo" : undefined` (`:172`) — correcto pero recalcula el mapa completo en cada cambio.

### 2.3 `components/ui.tsx` (73 líneas) — kit "primitivo"
Exporta `Card` (`:3-9`), `SectionTitle` (`:11-19`, único lugar con `aria-hidden` decorativo `:16`), `Chip` (`:21-27`), `ApprovalCard` (`:29-63`), `EmptyState` (`:65-73`).
- **`ui.tsx` está effectively muerto**: el único consumidor es `union.tsx:3`, y `union.tsx` no es importado por ningún otro archivo (grep verificado) — ni App, ni tests. `EmptyState` no tiene ningún consumidor.
- Existen **3 ApprovalCard distintos**: `ui.tsx:29` (demo), `components/tools/ApprovalCard.tsx:30` (real, HITL), y alias `ActionApprovalCard` en `components/ActionApprovalCard.tsx:1` (re-export). Solo el de `tools/` está integrado (`ego-chat.tsx:12,277`).

### 2.4 `components/union.tsx` (54 líneas)
Demo estática sobre `lib/mock.ts` (`union.tsx:4`) — **componente huérfano** (no montado en App ni en tests). Contraviene el comentario de `CanvasRuntime.tsx:16` ("eliminando lib/mock.ts") — el mock sigue vivo.

### 2.5 `components/PaneShell.tsx` (150 líneas) — `SplitPane`
- Panel redimensionable con persistencia en `localStorage` clave `ego:pane-width:<id>` (`PaneShell.tsx:41`), límites min/max y doble clic para reset (`:109-117`), divisor drag `w-1 cursor-col-resize` (`:140-147`) con estilo anidado en `document.body.style` (`:71-72,92-93`).
- **No está montado en la app real** — solo se consume en `test/PickersAndShell.test.tsx:6,99`. El layout de App usa anchos fijos.
- Bugs/riesgos: (a) usa `bg-accent` inexistente (§1.4); (b) `handleMouseUp` persiste `width` del closure en vez del último `setWidth` (`:97`), el `useEffect` `:119-125` lo corrige, redundancia; (c) el divisor no tiene `role`, `tabIndex`, ni keyboard resize (a11y).

### 2.6 Resto de la estructura
- **Chat**: `ego-chat.tsx` (302 líneas) con `useExternalStoreRuntime` de assistant-ui (`:206-216`), mensajes user/assistant, banner de recall (`:222-228`), tarjeta de error con retry (`:243-271`), panel de aprobaciones HITL (`:274-284`), píldora de contexto Canvas (`:287-294`) y composer (`:296-325`).
- **Canvas**: `CanvasRuntime.tsx` → filtros (`:142-147`) → `ComponentRenderer.tsx` (valida Zod `:24`, fallback de error `:26-38`) → `registry.ts` (11 tipos: table/card/form/chart/board/editor/diff/terminal/record_view/query_view/relation_view, `registry.ts:21-33`).
- **Dominios**: `DomainCanvasView.tsx` (430 líneas) con 5 vistas condicionales y datos mockeados internos.
- **Character (mascota)**: subárbol grande (`character/`: engine 894 líneas, wardrobe 616, state machine 363, traits 344 — ~2.400 líneas de render 2D propio).
- **Daily State**, **MCP** (`McpManagerModal` + `McpServerList` + `McpAddServerDialog` + `ToolCatalogView` + `SkillsCatalogView`), **explainability** (`WhyButton`), **activity** (widget + tray).
- Componentes **integrados solo en tests / no montados**: `SessionPicker.tsx`, `ModelPicker.tsx`, `union.tsx`, `SplitPane`, `TerminalView` (solo vía registry), `FileMentionBadge` (solo en test).

## 3. Calidad de código UI (evidencia de violaciones del design system)

### 3.1 Estilos inline arbitrarios con hex hardcodeados — epicentro en el chat
`components/ego-chat.tsx` es la peor violación (13 bloques `style={{...}}`):
- `ego-chat.tsx:20` (`margin: "8px 0"`), `:21` (`background:"#26262b", color:"#f4f4f5", borderRadius:8, padding:"8px 14px"`), `:36`, `:37` (`marginTop:2`), `:40` (`"#111113"`, `"1px solid #26262b"`), `:220`, `:230`, `:232` (`color:"#8e8e93"`), `:233`, `:234` (`fontFamily:"monospace"`), `:297`, `:302-310` (input del composer con `#111113/#26262b/#f4f4f5`), `:313-321` (botón Enviar `#f4f4f5`/`#0a0a0b`).
- **Estos hex duplican a mano los tokens** `--color-hairline` (#26262b), `--color-ink` (#f4f4f5), `--color-panel` (#111113), `--color-paper` (#0a0a0b), `--color-faint` (#8e8e93) de `index.css:7-13`. Si cambia el token, el chat no sigue (y el ThemeControl ya no afecta al chat).
- Otros inline justificados dinámicamente (aceptables): posición del toolbar de selección `SelectionToolbar.tsx:23`, ancho del SplitPane `PaneShell.tsx:133`, swatches `WardrobeSelector.tsx:236`, legend del chart `ChartView.tsx:35`, canvas del character `CharacterCanvas.tsx:112`, badges `CharacterBadge.tsx:193,200`, `CharacterMiniBadge.tsx:93,105`.

### 3.2 Hex fuera de index.css (ad-hoc)
- Paleta Recharts hardcodeada en `DomainCanvasView.tsx:375-389` (`#10b981`, `#262626`, `#737373`, `#171717`, `#a3a3a3`), `MetricsConsole.tsx:116-149` (`#3b82f6`, `#27272a`, `#71717a`, `#18181b`, `#f4f4f5`, `#a1a1aa`), `ChartView.tsx:8` (PALETTE de 6 hex), `RelationView.tsx:20-26` (mapeo estado→hex).
- Clases arbitrarias con hex: `tools/ApprovalCard.tsx:145-146` (`bg-[#161214]`, `bg-[#171410]`).
- Paletas de personaje (justificadas, canvas 2D): `CharacterWardrobe.ts:178-649`, `CharacterEngine.ts:76-972`, `TraitRegistry.ts:227-293`, `WardrobeSelector.tsx:23-28`, `CharacterMiniBadge.tsx:16`.

### 3.3 Paletas de Tailwind ajenas al sistema (rompen el "look")
- `neutral-*` en `DomainCanvasView.tsx:250-268,297,303-341,358-366,406-426` y `DomainSelector.tsx:49,57,63,66,80-95`.
- `zinc-*` + `white/20` en `tools/ApprovalCard.tsx:122,226,240` y `ActivityWidget.tsx:84-131` (`bg-zinc-900`, `border-white/10`, `text-zinc-100`...).
- `text-zinc-600` en `CanvasRuntime.tsx:200`; `placeholder:text-zinc-500` en `FormView.tsx:82,132`; `text-zinc-500` en `TableView.tsx:39`.
- Resultado: **4 familias de neutros conviven** (tokens semánticos, neutral, zinc, hex de Recharts) — contraste y tono visual distintos entre dominios.

### 3.4 Duplicación literal de clases
- Los 4 botones de tab de `App.tsx:144-178` repiten el mismo template literal 4 veces.
- Patrón de "item seleccionable" del sidebar repetido idéntico en proyectos (`sidebar.tsx:475-479`) y sub-egos (`:513-517`).
- Filtros del Canvas repiten 4 veces el mismo template (`CanvasRuntime.tsx:163-189`).
- Tabs del modal de settings repiten 3 veces (`sidebar.tsx:645-671`).
- Input text-field base repetido ≥12 veces idéntico (`sidebar.tsx:700,725,747,861,874`; `sub-egos.tsx:511,522,534,548,592`; `McpAddServerDialog.tsx:120,130,143,153,167,180,190`) con variantes divergentes (`focus:outline-none` vs `focus:outline-hidden` vs `focus:ring-1 focus:ring-ink` — §4).

### 3.5 Tamaños mágicos
- `w-[54px]`, `w-[260px]` (sidebar, `sidebar.tsx:306,403`); `h-[480px] w-[620px]` modal settings (`:625`); `w-[480px]` modal proyecto (`:832`); `min-w-[380px] max-w-[550px]` chat (`App.tsx:107`); `max-w-[200px]` (`ActivityWidget.tsx:51`); `min-h-[220px]` (`DomainCanvasView.tsx:250`); `max-h-[300px]` (`DomainCanvasView.tsx:307`); `max-h-36` (`ActivityWidget.tsx:122`); `py-0.2` (`sidebar.tsx:490`, `ActivityWidget.tsx:70`, `artifact-card.tsx:102`) — valor no estándar de la escala 0.25rem (funciona en v4 dinámico, pero es frágil).
- Nota: `bg-accent` y `text-accent` (§1.4) son "estilos fantasma": el divisor de resize, los chips de AskDirective, el icono del acordeón why y los checkmarks de pickers **no se colorearán** con la intención de diseño.

### 3.6 `any` en la capa UI (viola "any prohibido" del AGENTS.md)
`canvas/registry.ts:14` (`props: any` en el contrato del registry completo), `DomainCanvasView.tsx:41-66` (8 campos `any[]`), `DailyDashboard.tsx:110,145,160,241`, `McpManagerModal.tsx:59`, `McpServerList.tsx:18`, `sidebar.tsx:227,697`, `sub-egos.tsx:66,80,113,131,167,193`, `artifact-card.tsx:66` y `ask-directive.tsx:54` (`(window as any).ego` — innecesario: existe `window.ego` tipado en `src/window-ego.d.ts:10-14`).

## 4. Accesibilidad

### 4.1 Cobertura global pobre (grep sistemático)
- **`aria-*`: solo 15 apariciones** en todo el renderer, casi todas en tests. En componentes: `ActivityWidget.tsx:81` (`aria-modal`), `ego-chat.tsx:264` (`aria-label` cerrar), `DomainSelector.tsx:50-51` (`aria-haspopup/expanded`), `WhyButton.tsx:38`, `FileMentionBadge.tsx:105,119`, `ModelPicker.tsx:107-108`, `SessionPicker.tsx:76-77`, `ui.tsx:16` y `union.tsx:15` (`aria-hidden` decorativo).
- **`role=`: 8 usos** (`ActivityWidget.tsx:80` dialog, `artifact-card.tsx:81` button, `DomainSelector.tsx:64,83` menu/menuitem, `SessionPicker.tsx:75`, `ModelPicker.tsx:106`, `WhyButton.tsx:37`).
- **`tabIndex`: 1 solo** (`artifact-card.tsx:82`). **`onKeyDown`: 1 solo** (`artifact-card.tsx:83-88`, Enter/Espacio).
- **Cero `focus-visible`** en todo el proyecto (grep 0). Los inputs usan indistintamente `focus:outline-none` sin sustituto (`App.tsx:31`, `sidebar.tsx:442,700,725,747,861,874`, `sub-egos.tsx:511,522,534,548,592`, `ModelPicker.tsx:119`, `SessionPicker.tsx:88`, `JournalView.tsx:102`, `tools/ApprovalCard.tsx:240`), otros `focus:outline-hidden` (`ToolCatalogView.tsx:59`, `McpAddServerDialog.tsx:120-190`, `DomainCanvasView.tsx:297`, `DomainSelector.tsx:63`, `QueryView.tsx:75,82`) y otros con anillo visible (`FormView.tsx:82,92,100,132` `focus:ring-1 focus:ring-ink`; `tools/ApprovalCard.tsx:226` `focus:ring-amber-500`) — **3 convenciones de foco distintas**.
- **Botones sin foco visible ni aria-label**: la primitiva `ComposerPrimitive.Send` del chat recibe solo estilos inline sin `aria-label` (`ego-chat.tsx:312-324`); todos los botones de solo-icono del sidebar colapsado dependen únicamente de `title=` (`sidebar.tsx:311,319,330,338,347,356,363,381`) — `title` no es suficiente para SR; X de cierre de modales sin `aria-label` (`sidebar.tsx:632-637,839-844`; `ActivityWidget.tsx:90-95`); botones de ordenación de tabla sin aria-sort (`TableView.tsx:104-126`); tabs del workspace (`App.tsx:142-182`) y del modal settings no usan `role="tablist"/"tab"` ni `aria-selected`.
- **Keyboard navigation ausente en menús**: `DomainSelector` tiene `role="menu"` pero sin manejo de flechas/Escape/focus trap ni click-outside (`DomainSelector.tsx:40-103`); los modales (Settings `sidebar.tsx:623`, Nuevo Proyecto `:830`, ActivityWidget `:78`, McpManagerModal, SubEgos) **no atrapan el foco ni se cierran con Escape** (la única excepción es el modal HITL del widget: Enter/Esc en `ActivityWidget.tsx:13-29`).
- **Contraste**: `text-dim` (#55555c) sobre `bg-panel` (#111113) ≈ contraste 2.6:1 — usado en texto informativo (`sidebar.tsx:504,527,556,605`, `App.tsx:91,116`) por debajo de WCAG AA 4.5:1. `text-faint` (#8e8e93) sobre panel ≈ 5.4:1 (ok). `placeholder:text-dim` (≈2.6:1) en todos los inputs.
- Globales: `select-none` en body (`index.html:16`) y root (`App.tsx:74`) — afecta copy de texto (parcialmente mitigado con `select-text` en Canvas `CanvasRuntime.tsx:150` y tabla `TableView.tsx:68`). `autoFocus` en composer (`ego-chat.tsx:300`) y en input de proyecto (`sidebar.tsx:862`).
- Positivo: `prefers-reduced-motion` global (`index.css:33-40`) + guard del morph `CharacterMorph` (test `CharacterMorph.test.ts` verifica el corte instantáneo).

## 5. Estados: loading / empty / error / error boundaries

### 5.1 Loading
- Con flags pero **sin skeletons** (solo texto): `sub-egos.tsx:277-279`, `McpServerList.tsx:75-77`, `ToolCatalogView.tsx:105-107`, `SkillsCatalogView.tsx:54` + `animate-spin` en refresh (`:47`), `DomainCanvasView.tsx:32,75,133`, `DailyDashboard.tsx:18,32,56,93` (con guard `mounted`).
- **Sin loading**: el chat — `ego-chat.tsx:142` inserta un mensaje fake "Procesando intención y consultando VantaDB…" como placeholder de assistant (no hay indicador de streaming real: `llmStream` se resuelve completo, `:146-167`; no se consume token a token pese a llamarse "stream"). No hay indicador de carga en Sidebar (proyectos) ni en Canvas.

### 5.2 Empty
- `CanvasRuntime.tsx:198-206` ("Espacio de trabajo vacío"), `TableView.tsx:132-137` ("Sin registros disponibles"), `ThreadPrimitive.Empty` del chat (`ego-chat.tsx:231-238`), `DomainCanvasView.tsx:308-311`. El `EmptyState` genérico de `ui.tsx:65` no se usa.

### 5.3 Error
- Chat: banner `activeError` con retry y cierre (`ego-chat.tsx:243-271`), errores IPC suscritos (`:120-131`), y mensaje de error dentro del turno (`:176-186`).
- Proyectos: `projectError` inline en formulario (`sidebar.tsx:886-890`). Guardado de settings: **solo `console.error`** (`sidebar.tsx:152`) — no hay UI de error al fallar el guardado.
- Contratos: fallback de Zod en `ComponentRenderer.tsx:26-38` y tipo desconocido `:43-49`.

### 5.4 Error boundaries
- **Solo existe uno**: `MessageRenderBoundary` (`components/assistant-ui/message-render-boundary.tsx:30-114`), aplicado por mensaje de chat (`ego-chat.tsx:22,41`), con reintento automático (5 veces, 16 ms) para errores transitorios (`:7-11,43-57`) y fallback visual + botón "Reintentar render" (`:95-109`).
- **No hay error boundary global** en `main.tsx`/`App.tsx` — un throw en Sidebar/Canvas/DailyDashboard tumba toda la app. Usa `setTimeout` sin id tipado (`retryTimer: number`, `:36`) — correcto en DOM.

### 5.5 Layout shifts
- El banner de memoria (`ego-chat.tsx:222-228`), el panel de aprobaciones (`:274-284`) y la píldora de contexto (`:287-294`) **insertan filas por encima del composer**, desplazándolo (sin altura reservada).
- Los tabs de workspace (`App.tsx:185-194`) renderizan sin `min-height` compartido: Daily/Dominios/Canvas/SubEgos tienen alturas intrínsecas distintas y el contenedor es `overflow-y-auto p-4` — salto de scroll al cambiar.
- Los mensajes del chat tienen `maxWidth` 80%/85% y alturas libres; la transición placeholder → respuesta final reemplaza el contenido completo del mensaje (`ego-chat.tsx:157-167`) — cambio de altura sin `min-height` ni `content-visibility`.
- El modal de settings tiene tamaño fijo `h-[480px]` (`sidebar.tsx:625`) con contenido scroll — estable, bien.

## 6. Consistencia

### 6.1 Estilos repetidos que debieran ser componentes
- **Modal shell** (overlay + panel + header + X) implementado ≥6 veces: `sidebar.tsx:624-638` y `:831-845`, `ActivityWidget.tsx:79-96`, `ModelPicker.tsx:106-…`, `SessionPicker.tsx:75-…`, `WhyButton.tsx:37-…`, `McpManagerModal.tsx`.
- **Botón primario** (`rounded bg-ink px-3 py-1 text-xs font-semibold text-paper hover:opacity-90` + disabled) duplicado: `sidebar.tsx:760,820,904`, `TableView.tsx:81`, `ui.tsx:50` (variante `rounded-md ... text-sm`), botón Enviar inline (`ego-chat.tsx:313`).
- **Botón secundario/ghost** duplicado (`border border-hairline bg-raised hover:bg-raised/80`): `sidebar.tsx:417,879`, `TableView.tsx:84`, `ui.tsx:56`.
- **"Tab"/pill selector** duplicado 3 veces (App tabs `:144-178`, Canvas filters `CanvasRuntime.tsx:163-189`, settings tabs `sidebar.tsx:645-671`).
- **Badge de estado esmeralda**: `sidebar.tsx:374,490,591`, `ActivityWidget.tsx:39`, plus variantes rose/amber/cyan en chat y widget.
- **Label uppercase mono de sección** (`text-[10px] font-semibold tracking-wider text-dim uppercase`): `sidebar.tsx:451,502,543,564`, replicado en `DomainCanvasView.tsx:252,304,333,367`.

### 6.2 Divergencias concretas
- Radios: `rounded-lg` (ui.tsx Card), `rounded-xl` (TableView, DomainCanvasView), `rounded-2xl` (CanvasRuntime empty state `:199`, ComponentRenderer `:55`), `rounded-md`, `rounded`, `rounded-full` sin escala ni token (`--radius-card` nunca usado).
- Bordes de foco: 3 convenciones (§4.1).
- Texto base: `text-xs` domina, pero chat usa `text-[13px]` (`markdown-text.tsx:263`), composer `fontSize:14` inline (`ego-chat.tsx:309`), secciones `text-sm` (`DomainCanvasView.tsx:288`) — sin escala tipográfica derivada de `--ego-font-size`.
- Sombras: `shadow-sm/xs/md/2xl` mezclados arbitrariamente (`sidebar.tsx:320` vs `:625` vs `TableView.tsx:68`).

## 7. Paquete `packages/ui-runtime`

**Contrato**: paquete TypeScript puro (solo dependencia `zod` ^3.23.8, `package.json:20-22`), compilado a `dist/` (ESM con types), consumido por el renderer como `@ego/ui-runtime`. Exporta todo desde `src/index.ts:1-12`:

- **`schemas/` — el registry declarativo de componentes** (`schemas/components.ts`): esquemas Zod por tipo con props estrictas — `TablePropsSchema` (`:28-41`, columnas con tipo `text|number|boolean|badge|date`, paginación, acciones con variantes), `CardPropsSchema` (`:55-69`), `FormPropsSchema` (`:91-98`, campos `text|number|select|switch|textarea`), `ChartPropsSchema` (`:105-113`, `line|bar|pie|area`), `BoardPropsSchema` (`:134-138`, kanban), `EditorPropsSchema` (`:145-153`, readOnly por defecto), `DiffPropsSchema` (`:160-169`, split/unified), `TerminalPropsSchema` (`:185-194`). Unión discriminada canónica `CanvasComponentManifestSchema` (`:199-266`) con 11 tipos (los 8 anteriores + `record_view`, `query_view`, `relation_view` de `schemas/data-views.ts`), estado persistible `CanvasWorkspaceStateSchema` (`:274-283`), tokens `DesignSystemTokensSchema` (`:288-312`) y plantillas `LayoutTemplateSchema` (`:319-330`).
- **`CanvasBridge.ts`**: bus tipado bidireccional Chat↔Canvas con eventos `canvas.action|mutation|focus|inject|remove` (`:47-52`) y `ChangeSet` atómico (`:3-12`); API `on/off/emit` con try/catch por listener (`:109-120`). Consumido vía singleton en `hooks/useCanvasBridge.ts:11-23` (con `resetSharedCanvasBridge` para tests).
- **`stores/EgoStateStores.ts`**: factoría de 7 stores ortogonales tipados (runtime, interaction, attention, workspace, project, integration, userPrefs) sobre `ReactiveStore` (`:68-77`); `UserPrefsState` declara `theme: "dark"|"light"|"system"` (`:61`) — **definido pero no consumido por el renderer** (otra prueba de la ausencia de theme switching real).
- **`TerminalSessionStore.ts` + `AnsiParser.ts`**: sesiones de terminal reactivas con truncado, consumidas por `hooks/useTerminalSession.ts` y testeadas en `terminal-and-badges.test.tsx`.
- **`MermaidRenderer.ts`**: validador/sanitizador de Mermaid (sin dependencia de `mermaid` — es solo seguridad: límite 25k chars `:15`, patrones XSS `:16-22`, escape de tema `:127-138`). **No hay ningún renderizador Mermaid real montado en el renderer.**
- **`CanvasPersistence.ts`**, **`WindowState.ts`**, **`MockIPCBridge.ts`**, **`PayloadRef.ts`**, **`FuzzySearch.ts`**, **`SlashCommandParser.ts`** — utilidades de runtime sin dependencias pesadas.

Conclusión: el contrato es **UI-agnostic y headless** (schemas + lógica de estado, cero JSX) — buena separación; el renderer aporta los 11 renderers en `components/canvas/*` vía `registry.ts`. Deuda: `props: any` en `registry.ts:14` rompe el tipado estricto que el paquete sí garantiza.

## 8. Tests de UI (`apps/desktop/renderer/test`, 14 archivos, vitest + happy-dom, sin @testing-library)

- **Infra**: `setup.ts` inyecta un `MockEgoBridge` completo en `window.ego` (`setup.ts:180-182`) con mocks de llmStream, approvals, projects, MCP, skills y settings (`:61-177`); activa `IS_REACT_ACT_ENVIRONMENT` (`:5`). Los tests usan `createRoot` + `act` de React 19 a mano (patrón repetido en cada archivo — sin utilidad compartida de render).
- **Cobertura por archivo**:
  - `ChatAssistantUI.test.tsx`: AnsiText, MessageRenderBoundary (crash aislado + normal), AskDirective, ArtifactCard, MarkdownText (sanitizado de `<thinking>`, acordeón `<ego:why>`, promoción a artifact).
  - `ApprovalCard.test.tsx`: HITL real (`tools/ApprovalCard`) — render, aprobar, rechazar con motivo.
  - `ActivityWidget.test.tsx` / `ActivityTray.test.tsx`: máquina de estados idle→working→approval, resolución, bandeja con progreso/pausa/cancel.
  - `CanvasRuntime.test.tsx`: render de manifiestos, filtros, **inyección de variables `--ego-*` al cambiar preset** (`:134,143-144`).
  - `CanvasBridgeSync.test.tsx`: focus Canvas→Chat, acciones, ChangeSets reactivos.
  - `data-views.test.tsx`: registry + Record/Query/Relation views (cuarentena, corte de similitud, linaje).
  - `terminal-and-badges.test.tsx`: hooks de terminal reactivos + FileMentionBadge (incluye botones con `aria-label` `:170,177`).
  - `PickersAndShell.test.tsx`: ModelPicker, SessionPicker, SplitPane (localStorage + `data-pane-id`).
  - `WardrobeSelector.test.tsx`, `CharacterMorph.test.ts` (matemática de morphing + reduced-motion), `SubEgoSelector.test.tsx`, `ExplainabilityAndPresence.test.tsx` (dialog "¿Por qué?").
- **No cubren**: `App.tsx` (integración del layout), `sidebar.tsx` (el componente más grande), `EgoChat` completo (solo sus composables), `sub-egos.tsx`, `DomainCanvasView`, `DailyDashboard`, MCP dialogs, `ui.tsx`/`union.tsx`, navegación por teclado, a11y (0 tests de axe/roles más allá de `role="dialog"` en `ActivityWidget.test.tsx:99`), ni snapshots visuales. No hay coverage configurado.
- `packages/ui-runtime/test` (12 archivos: schemas, CanvasBridge, CanvasPersistence, TerminalSessionStore, AnsiParser, FuzzySearch, SlashCommandParser, WindowState, PayloadRef, MockIPCBridge, MermaidRenderer, EgoStateStores) — buena cobertura del contrato headless.

## 9. Rendimiento

- **Virtualización: inexistente**. Ni `react-window`, `virtua`, ni ninguna lib de virtual scrolling (grep 0). Afecta a: hilo de chat (`ThreadPrimitive.Viewport` renderiza todos los mensajes, `ego-chat.tsx:230-240`), `TableView` (paginado por TanStack solo si el manifiesto trae `pagination` — sin ella renderiza **todas** las filas, `TableView.tsx:49-65,139-148`), listas del sidebar (proyectos/sub-egos/sesiones), `DomainCanvasView` y catálogos MCP.
- **Memoria positiva (memoización)**: `MarkdownText` (`markdown-text.tsx:199`), `ArtifactCard` (`artifact-card.tsx:37`), `AnsiText` (`ansi-text.tsx:32`), `AskDirective` (`ask-directive.tsx:20`), `ModelPicker` (`ModelPicker.tsx:88`), `SessionPicker` (`SessionPicker.tsx:56`) con `memo`; `useMemo` en parseo de bloques (`markdown-text.tsx:204`), columnas de tabla (`TableView.tsx:22`), diff (`DiffView.tsx:12-13`), datos de chart (`MetricsConsole.tsx:31`), filtrados (`QueryView.tsx:18`, `ToolCatalogView.tsx:20`); `useCallback` en `ego-chat.tsx:97,133,200`, `useCanvasBridge.ts:54-102`, `sub-egos.tsx:61,73`, `sidebar.tsx:98,163`.
- **Re-renders potenciales**:
  - `EgoChat` renderiza de nuevo todo el hilo en cada `setMessages` (placeholder → respuesta: dos pasadas por turno, `ego-chat.tsx:139-167`); los `UserMessage`/`AssistantMessage` no están memoizados.
  - `useCanvasBridge` propaga **cualquier** evento `"*"` a `setComponents` + `setFocusedContext` (`useCanvasBridge.ts:44-47`), recreando el array con `getComponents()` — sin `React.memo` en `ComponentRenderer`/renderers, cada inyección re-renderiza el grid completo del Canvas.
  - `Sidebar` se re-renderiza con cada keystroke del buscador y del form de settings (estado local, sin memo de filas).
  - `DesignSystemProvider` memoiza bien variables y valor (`DesignSystemProvider.tsx:143-190`), pero cambiar preset cambia el `style` del wrapper raíz → re-render de **toda** la app (no hay `startTransition`).
- **Timers sin cleanup** (fugas menores): `setTimeout` en `handleResolveApproval` (`ego-chat.tsx:112-114`), éxito de guardado (`sidebar.tsx:150`), feedback "Copiado" (`markdown-text.tsx:172`, `artifact-card.tsx:57`) — no se limpian al desmontar.
- **Imports pesados**: `recharts` se importa estáticamente en `DomainCanvasView.tsx` y `MetricsConsole.tsx` — se carga en el bundle inicial aunque la pestaña Dominios no esté activa; no hay `React.lazy`/dynamic import en todo el renderer (grep 0). `@phosphor-icons/react` bien tree-shakeado por icono.
- **Singletons correctos**: bridge compartido con reset para tests (`useCanvasBridge.ts:11-23`); `settledDirectives` Set global en `ask-directive.tsx:3,46` — crece de forma monótona durante la vida de la app (memory leak leve deliberado para evitar dobles envíos).

## Resumen de hallazgos críticos (priorizado)

1. **Tokens de tema desconectados**: `DesignSystemProvider` inyecta `--ego-*` que nadie consume; el look real depende de `index.css` estático. ThemeControl es cosmético.
2. **Tokens inexistentes usados**: `bg/text/border-accent` en 5 archivos → estilos fantasma.
3. **`ego-chat.tsx` rompe el design system**: 13 estilos inline con hex duplicados de los tokens.
4. **Geist declarado pero no cargado** (sin import; `index.css:4-5` sin fuente).
5. **Accesibilidad mínima**: 1 `tabIndex` en todo el renderer, 0 `focus-visible`, 3 convenciones de foco, modales sin focus-trap/Escape, `text-dim` bajo contraste.
6. **Un solo error boundary** (por mensaje de chat); App/Sidebar/Canvas sin protección.
7. **God components y duplicación**: `sidebar.tsx` (862 líneas, 4 modales), 6+ modales duplicados, botones/tabs/input repetidos sin componentes base; `clsx`/`tailwind-merge` instalados y sin usar.
8. **Código muerto**: `union.tsx` + `ui.tsx` (kit no montado), `SplitPane` (solo tests), `react-streamdown` (dependencia sin import), `--radius-card`, `window.electronAPI` en `ActivityTray.tsx:45` (el preload solo expone `window.ego`, `preload.ts:288`) → rama de suscripción muerta.
9. **Sin virtualización ni code-splitting** (recharts en bundle inicial; chat/tablas sin windowing).
10. **Paletas Tailwind ajenas** (`neutral-*`, `zinc-*`, `white/20`) conviven con los tokens semánticos — 4 familias de neutros en paralelo.

---

# PARTE II — Documentación de Diseño/UX (Subagente 2)

## 1. Visión general: cómo se define el diseño de la interfaz

**Modelo base: Chat + Canvas (Workspace Cognitivo Dinámico).** La interfaz no es una colección de pantallas fijas sino dos superficies coordinadas (`docs\product\ux-ui.md` L8-22, `docs\architecture\workspace-dinamico.md`):

- **Chat (Conversation River):** canal universal de intención, sobre `@assistant-ui/react` (Thread, Composer, Message, Tool-UI) + markdown vía `@assistant-ui/react-streamdown`. Aplica la **Regla de Estabilidad Visual** (avatar solo en el primer mensaje de una intervención o cambio de orador).
- **Canvas (Dynamic Workspace):** superficie de trabajo interactiva (tablas editables, dashboards, kanban, editores, diffs…). Tipos de Canvas: Temporal, Persistente, Vista de datos, Workspace de Sub-Ego. Incluye *contexto por selección* y transformación dinámica.
- **Ego Activity Widget:** superficie de telemetría de ejecución/aprobaciones HITL (no es un chat).
- **Estado de entrada:** "Estado Dinámico del Proyecto" (daily state) generado dinámicamente al abrir la app, que responde 5 preguntas (`ux-ui.md` L24-46).

**Principios de diseño** (`ux-ui.md` L81-90): no reinventar (`@assistant-ui/react`, `@phosphor-icons/react`, tipografía **Geist**), **dark-first**, alta densidad de información, **WCAG 2.1 AA desde P0**, Electron-native (`titleBarStyle hidden` + controles nativos superpuestos), dinámico sobre estático, componentes declarativos, "la interfaz es una capacidad", "explicable sin ser intrusivo".

**Estrategia UX (Decisión P22)** — la sección más completa del doc (`ux-ui.md` L92-163):
- 4 capas de madurez: UX estructural → UX funcional → refinamiento visual → polish final.
- **Fundaciones obligatorias desde el inicio:** design tokens (paleta, espaciado, radios, sombras), primitivas y layout base, tipografía Geist + theme abstraction, escala de espaciado/grillas, **9 estados de interacción universales** (`default, hover, active, focus, disabled, loading, error, empty, overflow`), component registry y workspace schema.
- Criterios de aceptación por feature: `Feature DONE = Implementado + Funcional + Usable + Consistente + Estados completos + Accesibilidad básica + Design System`.
- Presupuesto UI por fase (10–30%; global 15–20% en P0), niveles de calidad L1/L2/L3, orden de prioridades `Correctitud > Seguridad > Funcionalidad > Usabilidad > Consistencia > Accesibilidad > Visual polish > Microinteracciones`.
- Reglas de oro: *"Funcional primero. Usable siempre. Perfecto después."*

**Presencia de Sub-Egos:** "la existencia de un Sub-Ego no implica la existencia de una pantalla" → 4 niveles (Invisible, Contextual, Persistente, Pinned) y gestión centralizada, no en pestañas fijas de sidebar (`ux-ui.md` L165-180; replicado en `docs\architecture\agentes.md` L347-370).

**Aporta algo nuevo:** `ux-ui.md` es quien define el **presupuesto explícito por fase**, los **9 estados universales**, la **regla de finalización de feature con Design System**, y la distinción explicabilidad vs. aprobación.

## 2. Sistema de componentes / UI Runtime

Documento: `docs\architecture\ui-runtime.md`

- **Principio:** "Ego no tiene una interfaz fija. Tiene un lenguaje de interfaces". Los Sub-Egos deciden **QUÉ** construir; el UI Runtime decide **CÓMO** se renderiza y qué está permitido.
- **Flujo de 4 niveles:** Sub-Ego → selecciona componentes → construye workspace → el usuario interactúa → las acciones actualizan el proyecto.
- **Catálogo declarativo (4 categorías, 24 componentes):**
  - *Primitivos:* Table, Chart, Form, Card, Editor, Calendar, Board.
  - *Datos:* Record View, Query View, Relation View, Analytics View.
  - *Trabajo:* Task Board, Roadmap, Timeline, Workflow.
  - *Agent Components:* Report, Recommendation, Approval, Action, Sub-Ego Collaboration, Character View, Activity Widget.
- **Contrato declarativo:** los Sub-Egos emiten esquemas JSON (ej. `{"type":"table","data":"customers",…}`), nunca HTML/React arbitrario → seguridad, consistencia, validación, persistencia, accesibilidad, versionado.
- **Guardrails Electron:** renderer aislado (`sandbox=true`, `contextIsolation=true`, `nodeIntegration=false`), mediación por IPC tipado → `EgoMemoryAdapter`, y `node_id` (u128 de Rust) tipado estrictamente como `string` en TS/React.
- **@assistant-ui/react:** `Tool-UI` es el mecanismo para renderizar componentes declarativos en línea en el chat; el Canvas usa el mismo catálogo en espacio persistente.

**Implementación referenciada en docs:** `packages/ui-runtime/schemas/` (catálogo Zod, tarea `CANV-01`), `apps/desktop/renderer/components/canvas/{CanvasRuntime,ComponentRenderer,registry}.tsx` (`CANV-02`), `packages/ui-runtime/CanvasBridge.ts` (`CANV-03`), `packages/ui-runtime/CanvasPersistence.ts` (`CANV-06`) — todas `✅ Completada`. El registro declarativo vivo es `registry.ts` (mapeo de tipos JSON → componentes React 19, sin `eval()`).

## 3. Sistema de mascota/character (dirección de arte, motion, estilos)

Tres documentos canónicos que se solapan:

**`docs\product\character-art-direction.md`** (DIR-ART-CHAR-CANONICAL, "CANÓNICO Y VIGENTE"):
- Entidad procedural viva en **Canvas 2D a 60 FPS**, cero imágenes IA en runtime (motor adaptado de `BotEngine` de Coucou, MIT).
- Siluetas: **`delta-core`** (triángulo equilátero con simetría armónica $C_3$, fórmula polar documentada) y `squircle-core`/`coucou-mochi` (superelipse de Lamé, EXP=2.7, **temporal hasta `COUC-23`**).
- Rostro hiper-expresivo: **13 estados de ojos** (`pill, wide, dot, line, flat, happy, closed, spiral, heart, star, tired, wink, cup`), boca reactiva, rubor; manos gesticulantes; **`BANNED_HUMAN_CLOTHING`** (cero ropa humana).
- `TraitConfig`: `halo, energy-cores, antennae, floating-shards, aura-field, quantum-crown, orbital-rings, geometric-crest`.
- **Matriz de 6 capas de renderizado** (back traits → cuerpo → rostro → manos → front traits → partículas/badges).
- Presets con paleta hex por dominio: Nucleus `#EDEDEF/#C4C5CA`, Dev `#3B82F6/#1D4ED8`, Finanzas `#10B981/#047857`, Design `#F59E0B/#D97706`, Producto `#8B5CF6/#6D28D9`, Soporte `#EC4899/#BE185D`.
- Rendimiento: HiDPI nativo, `pruneMiniBots`, rAF que se detiene en reposo.

**`docs\product\mascota.md`** (fuente vigente de producto):
- Tesis: **procedural > IA generativa**; la IA solo ideación previa, nunca assets en runtime.
- Doctrina: *"Un personaje, múltiples superficies, una sola fuente de estado"* → `CharacterRuntime` proyecta a App Header, Chat, Activity Widget y Dynamic Canvas.
- 4 pilares: `CharacterProfile/DNA` (identidad, invariable) · `CharacterState` (estado, 14 valores: `idle…attention`) · `CharacterBehavior` (cinética) · `CharacterRuntime`.
- **Regla de Estabilidad Visual:** avatar único por turno; consultas internas de fondo NO mutan el chat (van al Activity Widget); morphing de cambio de orador en **350–550 ms / 3 fases**.
- `Ego Activity Widget`: 4 modos (Idle `[●]`, En trabajo con %, Aprobación HITL con `Enter`/`Esc`, Multi-especialista `[Dev] [Fin] +2`), más *Detached Desktop Float* opcional.
- **4 niveles por tamaño de superficie:** header 28–36px, chat 32–48px, widget 40–90px, canvas 48–120px.
- Contrato `CharacterProfile` (TS/Zod en `packages/subegos/src/CharacterProfile.ts`) con `baseForm`, `palette{primary,secondary,accent,aura,glow}`, `defaultEye`, `defaultMouth`, `traits[]`, `scale`, `pulseRate`.
- Garantía: el Character System es consumidor reactivo de eventos; **nunca** toca lógica de Sub-Egos ni VantaDB.

**`docs\architecture\character-system.md`** (arquitectura, nivel 4/5):
- `CharacterState` (14 estados), separación identidad/estado, política anti-fatiga.
- Evento `SUBEGO_ACTIVATED` con `reason` y `visibleToUser`.
- Morphing en 3 fases con curvas concretas (squash `scaleY≈0.82`, interpolación de superelipse + **color en OKLab**, rebote `1.08→1.00`).
- **Matriz de Intensidad Multi-Superficie** (6 superficies con px, fps, amplitud física y rol): `app-header`, `chat`, `canvas`, `activity-widget`, `notification`, `desktop-float`.
- **Tool-Reactive Expressiveness:** mapeo categoría de tool → micro-animación (`scan-horizontal`, `pulse-breath`, `orbital-spin`, `blink-rapid`, `nod-spark`).
- Modo Narrativo para pipelines multi-agente (sin contaminar el chat).
- Geometría analítica (fórmulas), proyección 3D de mirada (yaw/pitch con resorte ζ≈0.75), pipeline de 7 capas, `TraitPhysics` (stiffness 120 / damping 14), enlace `SubEgoSoul → CharacterProfile`, presupuesto (≤1% CPU idle, ≤2.5% activo, 15 fps sin foco, ErrorBoundary, sin Rive/Lottie/three.js en P0).

Apoyo: `docs\research\character-audit-and-coucou-inventory.md` (auditoría CHAR-01/02 con hallazgos A1-A8).

## 4. Navegación y layout según docs

**`docs\architecture\navigation-sidebar.md`** (canonical, 2026-10-07) — especificación formal de UX:
- Principio: *"La navegación no aprisiona el espacio de trabajo; lo organiza bajo demanda."*
- **Arquitectura dual:** Navigation Rail **54px** (iconos + tooltips) / Expanded Sidebar **260px** (scroll propio). Referencias analizadas: Claude, ChatGPT, Antigravity, Dots (OpenAI), Grok.
- Bloques: Buscar (`Ctrl+K`), Proyectos (Project Memory, árbol), Sub-Egos (roster con avatares y estados), Historial de sesiones, Artifacts + MCP Tools, Settings, Perfil.
- Atajos: `Ctrl+B` (toggle), `Ctrl+N` (nueva sesión), `Ctrl+K` (omnibar VantaDB), `Ctrl+,` (configuración).
- Mapeo cada bloque → contrato IPC → subsistema → namespace VantaDB (tabla §3).
- Separación **UI State efímero en React** (`isCollapsed`, `activeSidebarSection`, `searchQuery`, `isSettingsModalOpen`) vs **estado persistente en VantaDB**.

**Patrones de escritorio:** `docs\references\gui-desktop.md` — "navegación izquierda estrecha + contenido central + inspector derecho colapsable", 10 reglas (layout 3 zonas + StatusBar, command palette obligatoria, frameless `titleBarStyle:'hidden'`+`titleBarOverlay`, menús/tray/diálogos nativos, dark-mode vía `nativeTheme`).

**Otros apuntes de layout:**
- `guia-mvp.md`: Canvas descrito como "panel lateral" que renderiza informe/diff/tareas; barra lateral refleja el proyecto activo.
- `ux-ui.md`: modo chat a pantalla completa con canvases embebidos (inline).
- `workspace-dinamico.md` §"Qué NO es la UI": no 23 pantallas, no chatbot solo texto, no sidebar rígida, no panel fijo de 320px de explicabilidad.
- Presupuesto de pantalla referido: **1440×900** (`navigation-sidebar.md` L27).

## 5. Design tokens, tema, tipografía, color, accesibilidad — formalizado vs. no

### Formalizado en la documentación
| Tema | Qué dice | Dónde |
|---|---|---|
| **Design tokens** | Obligatorios desde el inicio: paleta, escala de espaciado, radios, sombras; prohibido CSS ad-hoc | `ux-ui.md` L104, L115, L127 |
| **Tipografía** | **Geist** (y Geist Mono en código); "ritmo tipográfico" como fase de refinamiento | `ux-ui.md` L82, L106 |
| **Tema** | **Dark-first**, tema claro como opción secundaria, *theme abstraction* desacoplada | `ux-ui.md` L83, L106 |
| **Iconografía** | `@phosphor-icons/react` | `ux-ui.md` L82 |
| **Stack UI** | React 19 + Vite + **Tailwind v4** + primitivas **Radix/shadcn** + estado Zustand + React Router | `docs\engineering\stack-tecnico.md` L56-66, `Backlog.md` `CORE-01` |
| **Accesibilidad** | WCAG **2.1 AA** desde P0; teclado (foco, Enter, Escape), contraste AA, ARIA mínimos; auditoría WCAG en polish pre-launch | `ux-ui.md` L85, L116, L137, L154 |
| **Movimiento reducido** | `prefers-reduced-motion` respetado en character/morph y en animaciones | `character-system`/planes Fase 04 y 10, `CHAR-11` |
| **Estados universales** | Los 9 estados contractuales por componente | `ux-ui.md` L108 |
| **Presupuesto UI** | Fórmula, semáforo (Verde/Amarillo/Naranja/Rojo), métricas (`UI Budget %`, `Rework Rate`) | `docs\roadmap\metricas-okr.md` L32-98 |

### Existe solo en código (NO documentado)
`apps\desktop\renderer\src\index.css` define el único `@theme` real: fuentes Geist/Geist Mono y **7 tokens de color** (`--color-ink #f4f4f5`, `--color-paper #0a0a0b`, `--color-panel #111113`, `--color-raised #17171a`, `--color-hairline #26262b`, `--color-faint #8e8e93`, `--color-dim #55555c`), `--radius-card: 8px`, y un bloque global `prefers-reduced-motion`.

### No formalizado en ningún doc de `docs/`
- **No existe ningún documento de design system**: no hay doc de paleta de color de UI (los únicos hex en toda la doc son los de los presets del personaje), ni de escala de espaciado, ni de grillas/breakpoints, ni de jerarquía tipográfica, ni de sombras/radios.
- **No hay doc de tema claro**: se promete "theme abstraction" y tema claro secundario, pero no hay spec de cómo se conmuta (y en código solo hay tokens oscuros).
- **No hay doc de accesibilidad dedicado**: sin ratios de contraste, sin guía de foco/ARIA, sin plan de auditoría más allá de la mención "auditoría WCAG pre-launch".
- **No hay estrategia de test visual**: `docs\testing\estrategia.md` no menciona regresión visual, screenshots ni Playwright (solo tests unitarios/E2E funcionales de UI).
- **No hay spec de layout de ventana**: no se documenta la composición real (qué ancho ocupan sidebar/chat/canvas/widget juntos, colapsados, en 1440×900).

## 6. Contradicciones y vacíos entre documentos

1. **Sidebar rígida vs. prohibición de sidebar rígida.** `workspace-dinamico.md` L117: *"NO es una aplicación tradicional con una barra lateral de navegación rígida"*; `ux-ui.md` L166-180: la gestión de Sub-Egos *"no es una sección fija en una barra lateral"*. Pero `navigation-sidebar.md` (canonical, 2026-10-07) especifica un sidebar con bloques fijos, **incluido un roster de Sub-Egos con "+ Diseñar Sub-Ego…"**; `agentes.md` L370 dice que la gestión es *"centralizada… evitando dispersar controles en menús laterales o barras de navegación"*; y `Backlog.md` `CORE-13` ya lo implementó (`sidebar.tsx`, Rail 54 / Drawer 260 / Hidden). → Los docs de producto (2026-10-06) no se actualizaron tras la especificación de navegación (2026-10-07).
2. **Silueta canónica del personaje: `delta-core` vs `Monolito Cuántico Pulsante`.** `character-art-direction.md` declara `delta-core` (triángulo C₃) como canónico; `docs\agent-ops\plans\2026-10-09-plan-20-tareas-mvp.md` L567: *"Silueta ganadora seleccionada y aprobada (Monolito Cuántico Pulsante)"*; `docs\agent-ops\tasks\CHAR-04.md` L13/L23 citan `quantum-monolith` como canónico (su `baseForm` ni siquiera incluye `delta-core`).
3. **Estado del Character System desactualizado.** `character-system.md` L15 (2026-10-08): *"documento en estado `SPECIFIED` (no hay código aún)"*, pero `mascota.md` y `character-art-direction.md` listan componentes en código y `Backlog.md` marca `CHAR-05..11` como `✅ Completada`.
4. **Backlog `CHAR-03` contradice la prohibición de ropa:** su descripción dice *"guardarropa modular con trajes"* y *"superelipsoide EXP=2.7"*, mientras `CHAR-04` y `character-art-direction.md` imponen `BANNED_HUMAN_CLOTHING` y `delta-core`.
5. **Pipeline de render: 6 capas vs 7 pasos.** `character-art-direction.md` §2 (6 capas) vs `character-system.md` §12 (7 pasos, con sombra como paso propio).
6. **"4 niveles de presencia" con dos significados distintos:** en `ux-ui.md` L170 y `agentes.md` L354 = niveles de **visibilidad** (Invisible/Contextual/Persistente/Pinned); en `mascota.md` §6 = niveles de **tamaño por superficie** (28-36 / 32-48 / 40-90 / 48-120 px).
7. **"3 vs 4 elementos permanentes".** `workspace-dinamico.md` L15 dice *"3 elementos permanentes"*; `ux-ui.md` L49-58 enumera **4** bullets (añade *Background Activity & Proactivity*).
8. **Ubicación del Activity Widget.** `ux-ui.md` L53 y `workspace-dinamico.md` L18: *"marco superior/dock de la ventana"*; el plan de Fase 07 integra **`ActivityTray.tsx` en el pie de página** → conviven `ActivityWidget` (arriba) y `ActivityTray` (footer) sin que la doc distinga ambas superficies.
9. **Referencia rota a una regla inexistente.** `docs\extractions\hermes-agent.md` L92: *"cumpliendo la regla de interfaz sobria B/N de `docs/product/ux-ui.md`"* — `ux-ui.md` **no contiene** ninguna regla "B/N"/monocroma (solo "dark-first" y "alta densidad").
10. **Dark-first vs seguir al SO.** `ux-ui.md` (dark-first, claro secundario) vs `gui-desktop.md` regla 10 (*"Dark-mode y notificaciones siguen al OS (`nativeTheme`)"*). Nunca se reconcilia.
11. **Roadmap desfasado respecto al Backlog.** `docs\roadmap\roadmap.md` muestra checkboxes sin marcar en Fases 01/03/04, mientras `Backlog.md` declara Fase 04 `✅ Completada (14/14)`.

**Vacíos (promesas sin documento):** design tokens/paleta/espaciado/tipografía y *theme abstraction* se declaran "fundaciones obligatorias" pero ningún doc los define; no hay doc del component registry más allá de la tabla de 24 componentes (sin versionado, sin props, sin matriz de estados); no hay doc de accesibilidad ni de test visual; `docs\index.md` (2026-10-06) está desactualizado (no lista `navigation-sidebar.md`, `character-art-direction.md`, `guia-mvp.md`, `dominios-funcionales.md` ni extracciones recientes); el catálogo de `ui-runtime.md` (24) es más amplio que lo implementado (11 en `registry.ts`), sin doc que separe "aspiracional" vs "implementado".

## 7. Lista de documentos (ruta y qué contienen)

**Producto / UX**
- `docs\product\ux-ui.md` — Fuente vigente de UX: modelo Chat+Canvas, elementos permanentes, principios, estrategia P22 (tokens, estados, presupuesto UI, quality levels) y presencia de Sub-Egos.
- `docs\product\character-art-direction.md` — Dirección artística canónica del personaje: siluetas matemáticas, 13 ojos, traits no humanoides, 6 capas de render, presets con colores y rendimiento.
- `docs\product\mascota.md` — Doctrina de producto del personaje: procedural vs IA, "un personaje, múltiples superficies", estabilidad visual, Activity Widget, `CharacterProfile` y presets.
- `docs\product\modulos.md` — Capacidades P0/P1/P2 (incluye "Workspace dinámico" y "Estado dinámico") y tabla capacidad→dominio→primitiva VantaDB.
- `docs\product\personas.md` — Audiencia/ICP (indie hacker, creador, consultor); sin contenido de UI más allá del posicionamiento.
- `docs\product\guia-mvp.md` — Golden Path de 6 pasos con UI concreta (ActionApprovalCard, Canvas lateral), alcance UI in/out-of-scope y DoD del MVP (incluye presupuesto UI ≤20%).
- `docs\product\principios-innegociables.md` — 10 principios (#8 Chat + Dynamic Workspace) y matriz de qué decisiones de UI **no** son innegociables (tray, Canvas Causal).
- `docs\product\vision.md`, `concepto.md`, `definicion-soc.md`, `modelo-economico.md` — Visión/definición del SOC; menciones de interfaz mínimas.

**Arquitectura de UI**
- `docs\architecture\ui-runtime.md` — Contrato del UI Runtime, catálogo de 24 componentes declarativos, contrato JSON y guardrails Electron/IPC.
- `docs\architecture\workspace-dinamico.md` — Principios del workspace dinámico, elementos permanentes, explicabilidad contextual (P11), composición multi-Sub-Ego y "qué NO es la UI".
- `docs\architecture\navigation-sidebar.md` — Especificación canónica del sidebar dual (Rail 54px / Expanded 260px), bloques, atajos y mapeo IPC↔backend.
- `docs\architecture\character-system.md` — Arquitectura del CharacterSystem: estados, morphing, matriz multi-superficie, expresividad por tool, geometría y presupuesto de rendimiento.
- `docs\architecture\agentes.md` §"Presencia y visibilidad" — 4 niveles de presencia de Sub-Egos y gestión centralizada.
- `docs\architecture\dominios-funcionales.md` — Dominios; asigna "Experience/Design: UX/UI e identidad visual" a un dominio.
- `docs\architecture\subego-soul.md` — Alma del Sub-Ego que gobierna parámetros del `CharacterProfile`.

**Referencias / ingeniería**
- `docs\references\gui-desktop.md` — 10 reglas de GUI desktop (3 zonas, command palette, frameless, dark-mode OS) con URLs.
- `docs\references\diseno-skills.md` — Inventario de skills de diseño (top 8 para Ego: orquestador, anti-slop, a11y, motion).
- `docs\references\repos-intel.md` — Referencias de design systems externos (DESIGN.md, Base UI B/N).
- `docs\engineering\stack-tecnico.md` §Interfaz — React/Vite/Tailwind/Radix-shadcn/Zustand/React Router.

**Roadmap y operativa de UI**
- `docs\roadmap\roadmap.md` §Fase 04 — Objetivos y criterios de aceptación del Dynamic Workspace/Canvas.
- `docs\roadmap\metricas-okr.md` §2-3 — Presupuesto UI: fórmula, semáforo, métricas y auditoría real de la Fase 04 (28.4%).
- `docs\roadmap\Backlog.md` — Tareas de UI: `CORE-05/13`, `CANV-01..12`, `CHAR-01..11`, `WIDG-01..05`, `DS-*`.
- `docs\agent-ops\plans\2026-10-09-fase-04-dynamic-workspace.md` — Plan del Canvas/Widget (registry, `prefers-reduced-motion`, contratos).
- `docs\agent-ops\plans\2026-10-10-fase-07-tasks-and-background.md` — `ActivityTray` (footer), accesibilidad con Radix, widget flotante.
- `docs\agent-ops\plans\2026-10-10-fase-08-daily-state.md` — Dashboard de bienvenida, Recharts, Journal (ADR-049).
- `docs\agent-ops\plans\2026-10-10-fase-10-recovery-and-hardening.md` — `CHAR-11`: rendimiento/accesibilidad/estabilidad de animación.
- `docs\agent-ops\tasks\CHAR-03.md`, `CHAR-04.md`, `CHAR-07.md` — Selección de silueta, contrato `CharacterProfile` y `TraitRegistry`.
- `docs\research\character-audit-and-coucou-inventory.md` — Auditoría del sistema de personajes (brechas A1-A8).
- `docs\review\backlog-coucou.md` / `backlog-hermes.md` — Tareas pendientes de UI externa: Dynamic Island flotante (`COUC-17/18/19`), visualizador de tokens/costos (`HERM-21`).
- `docs\testing\estrategia.md` — Tests por fase (sin test visual/regresión de UI).
- `docs\index.md` y `docs\jerarquia-canonica.md` — Índice maestro (desactualizado) y jerarquía donde Diseño = Nivel 5 "Experience/Product Design".

---

# PARTE III — Tareas de UI/UX del Backlog (Subagente 3)

**Fuentes analizadas:** `docs\roadmap\Backlog.md` (495 líneas, 151 tareas + EGO-FIND), `docs\roadmap\roadmap.md`, `docs\roadmap\metricas-okr.md`, `docs\product\ux-ui.md`, `docs\review\backlog-hermes.md`, `backlog-coucou.md`, `backlog-helmor.md`, `backlog-openclaw.md`.

> ⚠️ **Advertencia de fuente:** `roadmap.md` está desactualizado (línea 3: *"Estado: Revisable — fuente histórica de P20-P21"*). Sus checkboxes dicen "Fase 03: 4/12" y "Fase 03.1: 0/6" mientras que `Backlog.md` (fuente única de verdad) marca esas fases **✅ Completadas (20/20 y 6/6)**. Los estados válidos son los de `Backlog.md`.

## 1. Tareas UI/UX por fase

### Fase 01 — Core Cognitivo (`CORE-01..15`) — ✅ 15/15
| ID | Resumen UI/UX | Estado |
|---|---|---|
| `CORE-05` | Chat UI interactivo con streaming (`@assistant-ui/react`) + badge 🧠 `EgoRecallStatus` | ✅ Completada |
| `CORE-13` | Cognitive Navigation Sidebar dual-rail/Drawer (54px→260px, atajos `Ctrl+B/N/K`, modal config) | ✅ Completada |
| `CORE-14` | Manejo visible de errores de turno en Chat UI (`ipc.chat.error`, tarjeta de error + Retry) | ✅ Completada |
| `CORE-01` | *(parcial)* Scaffolding con Tailwind v4 y design tokens base | ✅ Completada |

### Fase 02 — Acción & Tools (`ACT-01..12`) — ✅ 12/12
| ID | Resumen UI/UX | Estado |
|---|---|---|
| `ACT-07` | Componente interactivo de Aprobación en Chat UI (diff + `Aprobar`/`Rechazar`/`Editar`) | ✅ Completada |
| `ACT-11` | Gestor/Marketplace local de MCP Servers y Skills — UI completa en `components/mcp/` | ✅ Completada |
| `ACT-06` | *(parcial)* ApprovalEngine — la decisión HITL con cara visible en UI | ✅ Completada |

### Fase 03 — Sub-Egos + Personajes (`SUB-01..12`, `CHAR-01..08`) — ✅ 20/20
| ID | Resumen UI/UX | Estado |
|---|---|---|
| `SUB-08` | Panel de gestión de Sub-Egos en UI (`SubEgosView.tsx`: listar, inspeccionar manifiestos, permisos, tokens) | ✅ Completada |
| `CHAR-01` | Auditoría de personajes y criterios de originalidad (documental) | ✅ Completada |
| `CHAR-02` | Inventario técnico de Coucou y procedencia de código (documental) | ✅ Completada |
| `CHAR-03` | Adopción del motor Coucou Mochi: 6 capas, superelipsoide EXP=2.7, 13 expresiones, guardarropa | ✅ Completada |
| `CHAR-04` | Contrato `CharacterProfile` ligado a `SubEgoManifest` | ✅ Completada |
| `CHAR-05` | Motor procedural + renderer vectorial React 19 Canvas 2D (60fps/HiDPI) | ✅ Completada |
| `CHAR-06` | 14 estados canónicos, canales `gaze/pulse/posture/aura/accent`, gramática de atención/aprobación/error | ✅ Completada |
| `CHAR-07` | Presets y `TraitRegistry` (sin vestimenta humana) | ✅ Completada |
| `CHAR-08` | Integración en iconos, botones, chat y selector de Sub-Egos | ✅ Completada |

### Fase 03.1 — Integración MVP (`INT-01..06`) — ✅ 6/6
| ID | Resumen UI/UX | Estado |
|---|---|---|
| `INT-03` | Aislamiento de contexto de Proyecto en UI (`sidebar.tsx` reactiva) | ✅ Completada |
| `INT-04` | Integración UI de Sub-Egos (`sub-egos.tsx` ↔ Fábrica y Runtime vía IPC) | ✅ Completada |
| `INT-05` | Tarjetas HITL interactivas en Chat (`ActionApprovalCard.tsx`) | ✅ Completada |

### Fase 04 — Dynamic Workspace (`CANV-01..12`, `CHAR-09..10`) — ✅ 14/14
| ID | Resumen UI/UX | Estado |
|---|---|---|
| `CANV-01` | Catálogo declarativo de componentes UI (Table, Card, Form, Chart, Board, Editor) — esquemas Zod | ✅ Completada |
| `CANV-02` | Canvas Generative Runtime React 19 (`components/canvas/`) | ✅ Completada |
| `CANV-03` | Protocolo bidireccional Chat ↔ Canvas (sync reactivo) | ✅ Completada |
| `CANV-04` | Selection Context (selección → Composer con un clic) | ✅ Completada |
| `CANV-05` | Componentes de Sub-Ego (Report, Approval, Recommendation, DiffReviewCard) | ✅ Completada |
| `CANV-06` | Persistencia del Canvas en VantaDB | ✅ Completada |
| `CANV-07` | Explicabilidad contextual "¿Por qué?" (`WhyButton.tsx`) | ✅ Completada |
| `CANV-08` | Presencia contextual del personaje en el Workspace | ✅ Completada |
| `CANV-09` | **Auditoría de Presupuesto UI (Semáforo 15–20%)** | ✅ Completada |
| `CANV-10` | E2E Canvas (contrato JSON → tabla → edición → persistencia) | ✅ Completada |
| `CANV-11` | **Ego Activity Widget** (telemetría viva, microanimaciones, HITL con `Enter`/`Esc`, colas `[Dev] [Fin] +2`) | ✅ Completada |
| `CANV-12` | Suite vitest para `@ego/renderer` | ✅ Completada |
| `CHAR-09` | Transiciones de identidad Ego↔Sub-Ego (morph 350–550 ms, reduced-motion) | ✅ Completada |
| `CHAR-10` | Personalización de identidad + persistencia (Zod + `EgoMemoryAdapter`) | ✅ Completada |

### Fase 05 — Decision Intelligence (`DEC-01..09`) — ✅ 9/9
- **Sin tareas de UI propias.** Único contacto: `DEC-06` escala a "pregunta clarificadora al usuario" (UI heredada de `HERM-03`). La visualización de explicabilidad/scoring recae en `CANV-07`.

### Fase 06 — Knowledge & Data (`KB-01..11`) — ✅ 11/11
| ID | Resumen UI/UX | Estado |
|---|---|---|
| `KB-05` | **Data Views interactivas en Canvas** — `components/canvas/data/` (RecordView, QueryView, RelationView) | ✅ Completada |

### Fase 07 — Tasks & Background (`TASK-01..11`, `WIDG-01..04`) — ✅ 15/15
| ID | Resumen UI/UX | Estado |
|---|---|---|
| `TASK-05` | Bandeja de Actividad en footer (`ActivityTray.tsx`: avance, alertas, colapso/despliegue) | ✅ Completada |
| `TASK-06` | Sistema de **notificaciones discretas** en UI (`TaskNotifications.ts`) | ✅ Completada |
| `TASK-11` | Cancelación visible: propagación `AbortSignal` UI→Node→Rust (botón "Cancelar") | ✅ Completada |
| `WIDG-01` | Prototipo de ventana flotante Electron (frameless, always-on-top, click-through) | ✅ Completada |
| `WIDG-02` | **Ventana flotante de escritorio `desktop-float`** (`src/windows/FloatingWindow.ts`) | ✅ Completada |
| `WIDG-03` | `AttentionStateMachine` compartida CANV-11 + WIDG-02 | ✅ Completada |
| `WIDG-04` | Interacción del widget con **HITL + ACK ≤800 ms** | ✅ Completada |

### Fase 08 — Daily State (`DS-01..08`) — ✅ 8/8 (fase casi 100% UI)
| ID | Resumen UI/UX | Estado |
|---|---|---|
| `DS-02` | Dashboard dinámico de bienvenida (`DailyDashboard.tsx`) | ✅ Completada |
| `DS-03` | Feed de decisiones (`DecisionsFeed.tsx`) | ✅ Completada |
| `DS-05` | Consola de métricas y consumo IA (`MetricsConsole.tsx`) | ✅ Completada |
| `DS-06` | Módulo Journal (`JournalView.tsx`) | ✅ Completada |
| `DS-07` | Bandeja de aprobaciones pendientes (`PendingApprovals.tsx`) | ✅ Completada |

### Fase 09 — Dominios (`DOM-01..09`) — ✅ 9/9
| ID | Resumen UI/UX | Estado |
|---|---|---|
| `DOM-01` | Visor de árbol de archivos + inspección de dependencias (Engineering) | ✅ Completada |
| `DOM-02` | Canvas con vistas **Kanban/Timeline** (Product) | ✅ Completada |
| `DOM-04` | **Gráficos interactivos** línea/barra/dispersión en Canvas (Analytics) | ✅ Completada |
| `DOM-08` | Vistas de colaboración inter-dominio en Canvas (`components/domains/`) | ✅ Completada |

### Fase 10 — Recovery (`REC-01..09`, `CHAR-11`, `WIDG-05`) — ✅ 11/11
| ID | Resumen UI/UX | Estado |
|---|---|---|
| `CHAR-11` | **Pruebas de rendimiento, accesibilidad, memoria y estabilidad de animación** (`CharacterMotionGuard.ts`) | ✅ Completada |
| `WIDG-05` | Compatibilidad de ventana flotante (restauración, multi-monitor/DPI, Wayland) | ✅ Completada |

### Fase 11 — Seguridad (`SEC-01..09`) — 🟡 8/9
| ID | Resumen UI/UX | Estado |
|---|---|---|
| `SEC-09` | **Aviso UI explícito** de ausencia de cifrado at-rest en namespaces sensibles | ⏳ **En curso** |

### Fase 12 — Distribución (`DIST-01..12`) — 🟠 0/12
| ID | Resumen UI/UX | Estado |
|---|---|---|
| `DIST-05` | **Aviso discreto en UI** para reiniciar con auto-updater | 🆕 Pendiente |
| `DIST-07` | Documentación de usuario final / guía de inicio rápido (onboarding UX) | 🆕 Pendiente |
| `DIST-12` | Dev concurrente con `VITE_DEV_SERVER_URL` (fricción de desarrollo) | 🆕 Pendiente |

## 2. 🔴 Tareas de INTERFAZ pendientes en el Backlog Maestro

Solo 3 con componente UI real, todas en fases no cerradas:
1. **`SEC-09`** — ⏳ En curso — aviso UI de cuarentena sin cifrado (Fase 11).
2. **`DIST-05`** — 🆕 Pendiente — aviso para reiniciar del auto-updater (Fase 12).
3. **`DIST-07`** — 🆕 Pendiente — documentación/guía de usuario final (Fase 12).

**Todas las tareas UI de las Fases 01–10 (~45 tareas) están ✅ Completadas.** La deuda de UI en el backlog maestro es mínima; el grueso pendiente está en los backlogs especializados.

⚠️ **Inconsistencias en `Backlog.md`:** matrices de compuertas desactualizadas — líneas 151–153 (Fase 03): `HERM-12`, `HERM-17`, `HERM-19` en `🆕 Pendiente` pese a estar cerradas; líneas 438–442 (Fase 11): `CARP-03`, `CARP-04`, `HERM-19`, `COUC-10`, `DSEK-05` en `🆕 Pendiente` pese a `SEC-01..08` finalizadas.

## 3. Backlogs especializados → tareas de UI aún no ejecutadas

### 🏝️ `docs\review\backlog-coucou.md` (el mayor aporte de UI pendiente)
| ID | Resumen | Prioridad | Estado | Verificación en código |
|---|---|---|---|---|
| **`COUC-17`** | **Dynamic Island de escritorio** — BrowserWindow frameless, transparente, alwaysOnTop | 🔴 P0 | 📋 Planificada | ⚠️ Parcialmente cubierta por `WIDG-02` (`FloatingWindow.ts`, ✅) — requiere reconciliar o cerrar formalmente |
| **`COUC-18`** | **Spring Physics y animación de píldora** — `Spring` (masa, rigidez, amortiguación) | 🟠 P1 | 📋 Planificada | ⚠️ Existe `character/core/anim.ts` (clase `Spring`) usado por el personaje, **no** por la isla/píldora |
| **`COUC-19`** | **System Tray de Windows** con código de color de atención (Verde idle / Azul pensando / Rojo HITL) | 🟠 P1 | 📋 Planificada | ❌ No hay `new Tray(` en `apps/desktop/src` — **no implementada** |
| **`COUC-20`** | **SoundEngine** — Web Audio API, 28 efectos WAV | 🟡 P2 | 📋 Planificada | ⚠️ Existe `character/core/sound.ts` (9 efectos procedurales). Versión WAV completa y wiring en eventos globales **pendientes** |
| **`COUC-21`** | **Motor de Avatar Cognitivo Procedural 2D personalizable** | 🟠 P1 | 📋 Planificada | ⚠️ Efectivamente ejecutada vía `CHAR-03..07` ✅; el backlog-coucou no está sincronizado |
| **`COUC-22`** | **Notificaciones móviles + bridge remoto de aprobación HITL** | 🔵 P3 | ⏳ Futura (P1/P2) | ❌ No implementada |
| **`COUC-23`** | **Independización geométrica de Ego & catálogo procedural extendido** (`delta-core`, `squircle-core`, `monolith-core`, `polyhedron-core`) | 🔵 P2 | ⏳ Futura (P1) | ❌ No implementada — menciona `CHAR-12` (**ID inexistente en `Backlog.md`**) |

**Resumen coucou UI pendiente de verdad:** `COUC-19` (System Tray), `COUC-22` (notificaciones móviles/HITL remoto), `COUC-23` (geometría/CHAR-12), más cierre formal de `COUC-17`, `COUC-18`, `COUC-20`, `COUC-21`.

### 🖱️ `docs\review\backlog-hermes.md`
| ID | Resumen | Prioridad | Estado |
|---|---|---|---|
| **`HERM-20`** | **Hot Palette `/`** — menú flotante en el Composer con búsqueda difusa entre tools y Sub-Egos | 🟠 P1 | 📋 Planificada |
| **`HERM-21`** | **Visualizador de tokens y costes en tiempo real** (entrada/salida + USD por turno) | 🟡 P2 | 📋 Planificada |
| **`HERM-22`** | Gateways Telegram/Discord/Slack | 🔵 P3 | ⏳ Futura (P1) |

UI completada de hermes: `HERM-01..05` (artifact-card, markdown-text, ask-directive, message-render-boundary, ansi-text), `HERM-09` (PaneShell), `HERM-10` (ModelPicker), `HERM-11` (SessionPicker), `HERM-12` (SlashCommandParser), `HERM-13` (indicador 🧠) — todas ✅ y verificadas.

### 🖱️ `docs\review\backlog-helmor.md` — **100% completada (5/5)**
- `HELM-05` File Mention Badge ✅ · `HELM-03` puente reactivo de terminal ✅ · `HELM-01/02/04` coalescencia PTY ✅. **Ninguna tarea de UI pendiente.**

### 🐾 `docs\review\backlog-openclaw.md` — 1 pendiente con componente UI
- **`OCLW-17`** — **File Watcher reactivo** (Chokidar/fs.watch) → sincroniza cambios del IDE con el **Canvas** en tiempo real — 📋 Planificada 🟠.
- `OCLW-16` hot-reloading de tools 📋 (UI mínima) · `OCLW-18` bots WhatsApp/Telegram ⏳ Futura.
- Completadas con UI: `OCLW-11` (MermaidRenderer), `OCLW-08` (parser de diffs), `OCLW-12` (`StructuredInput`), `OCLW-14` (ToolActivityEmitter), `OCLW-15` (Workboard/DOM-02).

## 4. Criterios de aceptación de UX

### 4a. Regla de cierre de fase (`Backlog.md` línea 14 y `metricas-okr.md` línea 30)
```
Fase = DONE → IMPLEMENTADO + INTEGRADO + PRUEBA FUNCIONAL PASA + PRUEBA DE ERROR PASA
             + PERSISTENCIA VERIFICADA + NO HAY REGRESIONES CRÍTICAS
             + CRITERIOS DE UX CUMPLIDOS (Usable + Consistente + Estados completos
               + Accesibilidad básica + Design System)
```
> El criterio UX es **gate formal de fase**.

### 4b. Criterios UX por feature (`docs\product\ux-ui.md` §3)
- **Funcional:** flujo extremo a extremo sin errores visuales ni excepciones.
- **Consistencia:** solo componentes del catálogo oficial y design tokens; **prohibido CSS ad-hoc**.
- **Accesibilidad básica:** teclado (Enter/Esc, foco coherente), contraste **WCAG 2.1 AA**, ARIA mínimo.
- **Calidad técnica:** estados completos (`default, hover, active, focus, disabled, loading, error, empty, overflow`), sin layout shifts.

`Feature DONE = Implementado + Funcional + Usable + Consistente + Estados completos + Accesibilidad básica + Design System`

### 4c. Criterios de aceptación UX por fase (`docs\roadmap\roadmap.md`)
| Fase | Criterio |
|---|---|
| 01 Core | Chat básico con IA local + persistencia real VantaDB — ✅ 100% |
| 02 Acción | *"Flujo visual interactivo de aprobación humana HITL con diffs y edición de parámetros"* — ✅ 100% |
| 03 Sub-Egos | Múltiples Sub-Egos cooperan sin intervención del usuario en la orquestación |
| 03.1 MVP | Tarjetas interactivas de aprobación humana en el chat + selector de proyectos en sidebar |
| 04 Canvas | *"La interfaz trasciende el chat clásico hacia un entorno de manipulación de artefactos"*; artefacto interactivo, actualizable en tiempo real y seleccionable como contexto |
| 05 Decision | Delegación autónoma al Sub-Ego adecuado |
| 06 Knowledge | *"El usuario visualiza y filtra datos indexados en la interfaz"* |
| 07 Tasks | *"Las tareas en background no bloquean la interfaz"* + *"El sistema notifica resultados relevantes"* — ✅ 100% |
| 08 Daily State | Resumen visible, progreso + aprobaciones pendientes, métricas clave visibles |
| 09 Dominios | Workspaces nativos para flujos (CRM, Kanban) |
| 10 Recovery | Reanudación tras crash + exportación funcional |
| 11 Seguridad | Autorización explícita para operaciones críticas |
| 12 Distribución | Instalación/actualización "de forma sencilla" por usuarios finales |

### 4d. Criterio de salida UX global (`metricas-okr.md` KR4, l.26)
> *"Un usuario puede realizar los flujos principales sin conocer la arquitectura interna ni requerir comandos técnicos ni intervención en logs."*

## 5. Presupuesto de UI por fase (Decisión P22)

### 5a. Tabla por fase — `docs\product\ux-ui.md` §4
| Fase / Capacidad | Presupuesto UI | Enfoque UX asignado |
|---|:---:|---|
| **Core** (F01) | **10–15%** | Estructura base, primitivas, design tokens, Conversation River + Canvas |
| **Acción** (F02) | **10–15%** | Tool-UI, aprobaciones contextuales, visualización de ejecución |
| **Sub-Egos** (F03) | **15–20%** | Background Activity, indicadores, panel de gestión, lazy activation |
| **Dynamic Workspace / Canvas** (F04) | **25–30%** | Superficie interactiva, layout dinámico, render declarativo reactivo |
| **Decision Intelligence** (F05) | **10–15%** | Explicabilidad contextual (3 niveles), evidencia, scoring |
| **Knowledge / Data** (F06) | **15–20%** | Área de datos, tablas dinámicas, explorador de entidades |
| **Tasks / Background** (F07) | **15–20%** | Monitoreo visual de tareas, telemetría, feedback no bloqueante |
| **Daily State** (F08) | **20–25%** | Dashboard vivo de bienvenida, priorización, interacción inmediata |
| **Dominios** (F09) | **15–20%** | Vistas especializadas y plantillas por dominio en Canvas |
| **Recovery / Security / Distribution** (F10–12) | **5–10%** | Onboarding, credenciales, asistentes de recuperación, auto-updater |
| **Polish final transversal** | **15–20%** *(del esfuerzo restante)* | Microinteracciones, auditoría WCAG, coherencia pre-launch |

- **Global P0: 15–20%** del esfuerzo total. Reparto: **60–70%** integrado en features + **30–40%** reservado a pulido transversal.
- **Rango por fase permitido:** 10%–30% (`metricas-okr.md` l.47).

### 5b. Sistema de Semáforo (`metricas-okr.md` §3)
| Consumo | Estado | Acción |
|---|---|---|
| 0–70% | 🟢 Normal | Ritmo saludable |
| 70–90% | 🟡 Atención | Evaluar sobre-diseño |
| 90–100% | 🟠 Límite | Congelar microinteracciones; solo completitud + usabilidad L2 |
| >100% | 🔴 Excedido | Congelar estética; solo bloqueos críticos de usabilidad/accesibilidad |

### 5c. Auditorías formales realizadas (`metricas-okr.md` §5–6)
- **`CANV-09`** (auditoría 2026-10-10): 7.859 LoC UI vs 19.792 LoC backend.
  - **Fase 04: 28.4%** (dentro del margen 25–30%) · **Acumulado F01–F04: 18.2%** (objetivo 15–20%) → 🟢 **Verde**.
- **Cierre P0-Alpha (DEC-09, 2026-10-10):** consumo total de UI Budget **16.8%** acumulado → dentro de la banda innegociable 15–20%.

### 5d. Métricas obligatorias a rastrear por fase
`Effort Points (Fibonacci 1-2-3-5-8-13)` · `Horas totales` · `Horas UI` · `UI Budget %` · `Rework Rate %` · `Deviation %` — regla estricta: **NO convertir puntos a horas**.

## 📌 Síntesis ejecutivo (Parte III)
1. Backlog maestro: las ~45 tareas con interfaz de las Fases 01–10 están **todas completadas**. Solo quedan `SEC-09` (en curso) y `DIST-05`/`DIST-07` (pendientes, Fase 12).
2. Deuda real de UI en backlogs especializados: **coucou aporta 7 tareas** — `COUC-19` System Tray, `COUC-22` HITL móvil, `COUC-23` catálogo geométrico (con `CHAR-12` inexistente), y reconciliar `COUC-17/18/20/21`.
3. Hermes: `HERM-20` (Hot Palette) y `HERM-21` (visor de costos); OpenClaw: `OCLW-17`; Helmor 100%.
4. El criterio UX es gate formal de cierre de fase y hay presupuesto explícito (10–30%) con semáforo, auditado dos veces 🟢 (16.8–18.2%).
5. Discrepancias a corregir: checkboxes obsoletos en `roadmap.md`, matrices de compuertas en `Backlog.md` (L151-153, L438-442), desincronización de `backlog-coucou.md`.

---

# PARTE IV — Análisis Final Integrado

## 1. Qué es la interfaz

Ego no sigue el modelo de "pantallas fijas". Es un **Workspace Cognitivo Dinámico** con dos superficies coordinadas:

- **Chat (Conversation River)** — canal de intención basado en `@assistant-ui/react` (Thread/Composer/Message/Tool-UI).
- **Canvas (Dynamic Workspace)** — superficie de trabajo con 11 componentes declarativos (tabla, card, form, chart, kanban, editor, diff, terminal, record/query/relation views) que los Sub-Egos componen mediante **schemas JSON validados con Zod** — nunca React arbitrario (seguridad).
- **Ego Activity Widget** (header) + **ActivityTray** (footer) — telemetría de ejecución y aprobaciones HITL.
- **Daily State** — dashboard vivo de bienvenida (primer arranque del día).
- **Character System** — mascota procedural en Canvas 2D a 60 FPS (adaptada de Coucou), 14 estados, 13 expresiones de ojos, morphing 350–550 ms.

Filosofía declarada (`docs/product/ux-ui.md`): *dark-first*, alta densidad de información, WCAG 2.1 AA desde P0, "la interfaz sigue al trabajo, no al revés", y la **Decisión P22** con presupuesto UI explícito por fase (15–20% global, auditado en 16.8% acumulado 🟢).

## 2. Cómo está diseñada (layout real)

```
┌──────────────────────────────────────────────────────────┐
│ Header h-10: identidad Ego │ ActivityWidget │ Local-First│  ← drag region (ROTO)
├────────┬──────────────────────┬──────────────────────────┤
│Sidebar │ CHAT (min 380px,     │ DYNAMIC WORKSPACE        │
│54px/   │ max 550px)           │ (flex-1)                 │
│260px   │ SubEgoSelector       │ DomainSelector│Theme│tabs │
│        │ hilos + composer     │ Daily|Dominio|Canvas|Sub │
├────────┴──────────────────────┴──────────────────────────┤
│ ActivityTray (footer)                                     │
└──────────────────────────────────────────────────────────┘
```

- **Sidebar dual-rail** (`sidebar.tsx`, 862 líneas): rail 54px ↔ drawer 260px, atajos Ctrl+B/Ctrl+N, con modal de Settings, modal de proyectos y gestor MCP embebidos en el mismo archivo.
- **Canvas con puente bidireccional** (`CanvasBridge`): el chat inyecta componentes, el usuario selecciona elementos y los devuelve al composer como contexto.
- **Tokens de color** (`src/index.css`, único `@theme`): 7 tokens semánticos — `ink #f4f4f5`, `paper #0a0a0b`, `panel #111113`, `raised #17171a`, `hairline #26262b`, `faint #8e8e93`, `dim #55555c`. Paleta monocroma austera, **sin color de acento**.

## 3. Stack y herramientas de la interfaz

| Capa | Herramienta | Estado |
|---|---|---|
| Framework | React 19.0 + TypeScript strict | ✅ Actual |
| Build | Vite 6 + `@tailwindcss/vite` | ✅ Actual |
| Estilos | **Tailwind v4.0.0-beta.8** (CSS-first, sin config file) | ⚠️ Beta |
| Chat | `@assistant-ui/react` 0.15.23 | ✅ |
| Markdown | `@assistant-ui/react-streamdown` | ❌ **declarado, nunca importado** |
| Iconos | `@phosphor-icons/react` | ✅ |
| Tipografía | `geist` (Geist / Geist Mono) | ❌ **paquete instalado pero sin cargar** |
| Gráficos | `recharts` (estático, en bundle inicial) | ⚠️ sin lazy |
| Tablas | `@tanstack/react-table` | ✅ |
| Clases | `clsx` + `tailwind-merge` | ❌ **instalados, nunca usados** |
| Tests | Vitest 2 + happy-dom (14 archivos de UI) | ⚠️ sin testing-library ni axe |
| Contrato headless | `@ego/ui-runtime` (Zod schemas + stores, cero JSX) | ✅ Buena arquitectura |

**Contradicción de stack:** `docs/engineering/stack-tecnico.md` promete *Radix/shadcn, Zustand y React Router* — ninguno de los tres está en el renderer. Los modales/menús son manuales.

## 4. Errores y fallas de diseño detectados 🔴

### CRÍTICOS (rompen funcionalidad declarada)

**C1 — El sistema de temas es cosmético.** `DesignSystemProvider.tsx:143-197` inyecta variables `--ego-*` desde 4 presets, pero **ningún componente las consume**: todo usa las clases estáticas de `index.css`. El selector `ThemeControl` (`App.tsx:23-42`) cambia variables CSS huérfanas → **el look real no cambia**. Además `--font-geist-sans`/`--font-geist-mono` (`DesignSystemProvider.tsx:159-160`) no existen nunca.

**C2 — La ventana no se puede arrastrar.** `main.ts:1384` usa `titleBarStyle: "hidden"` (frameless), y el header declara `className="... app-region-drag"` (`App.tsx:76`), pero **la clase `app-region-drag` no está definida en ningún CSS del proyecto** y no existe ningún `-webkit-app-region` en el repo (verificado con grep global). Sin región de arrastre, la ventana solo se mueve por el titleBarOverlay.

**C3 — Geist nunca se carga.** `geist` está en `package.json` pero no hay ningún `import "geist/font/sans"` ni `@font-face`. `--font-sans: "Geist", ...` cae a Segoe UI/system-ui en Windows. **La tipografía canónica del diseño no se ve.**

**C4 — Tokens fantasma `accent`.** Se usan `bg-accent`, `text-accent`, `border-accent` en 5 archivos (`PaneShell.tsx:146`, `ask-directive.tsx:73,88`, `markdown-text.tsx:142`, `ModelPicker.tsx:184`, `SessionPicker.tsx:144`) pero **no existe `--color-accent`** → Tailwind no genera la clase → estilos muertos (el ícono "¿Por qué?", los checks de pickers y los chips no se colorearán).

### ALTOS (violan los criterios de aceptación propios)

**H1 — El chat rompe el design system.** `ego-chat.tsx` tiene **13 bloques `style={{...}}` con hex hardcodeados** (`#26262b`, `#111113`, `#f4f4f5`, `#0a0a0b`, `#8e8e93` en líneas 20-40, 220-324) que duplican a mano los tokens. Viola directamente la regla *"prohibido estilos ad-hoc"* (`ux-ui.md:115`). El chat es la superficie L3 Core UX y es la más sucia.

**H2 — Accesibilidad casi inexistente** (prometido: WCAG 2.1 AA desde P0):
- **0 `focus-visible`** en todo el renderer; **3 convenciones de foco distintas** (`focus:outline-none` vs `focus:outline-hidden` vs `focus:ring-1`).
- **1 solo `tabIndex`** y 1 solo `onKeyDown` en todo el código.
- Modales (Settings, Proyectos, MCP, SubEgos) **sin focus-trap ni cierre con Escape**.
- Botones de solo-icono con solo `title=` (insuficiente para screen readers); composer de envío sin `aria-label`; tabs sin `role="tablist"`.
- **Contraste:** `text-dim #55555c` sobre `panel #111113` ≈ **2.6:1** (AA exige 4.5:1) usado en texto informativo (`App.tsx:91,116`, `sidebar.tsx:504,605`) y en todos los `placeholder`.
- Nota positiva: `prefers-reduced-motion` global está bien (`index.css:33-40`).

**H3 — 4 familias de neutros conviven.** Tokens semánticos + `neutral-*` (`DomainCanvasView.tsx`, `DomainSelector.tsx`) + `zinc-*`/`white/10` (`ActivityWidget.tsx:84-131`, `tools/ApprovalCard.tsx:122,226,240`) + hex de Recharts (`DomainCanvasView.tsx:375-389`, `MetricsConsole.tsx:116-149`, `ChartView.tsx:8`). Cada dominio se ve con un gris distinto.

**H4 — Sin error boundary global.** Solo existe `MessageRenderBoundary` por mensaje de chat. Un throw en Sidebar/Canvas/DailyDashboard **tumba toda la app** (`main.tsx` sin protección).

**H5 — Estados de carga sin skeleton ni streaming real.** El "streaming" del chat resuelve completo y reemplaza un placeholder fake `"Procesando intención..."` (`ego-chat.tsx:142-167`) — no hay tokens a token, hay layout shift. Guardado de settings falla en silencio (`console.error` sin UI).

### MEDIOS (deuda de mantenimiento)

- **`sidebar.tsx` god-component** (862 líneas, 14 `useState`, 4 modales); **shell de modal duplicado ≥6 veces**; botón primario/secundario/tab/input repetidos 12+ veces sin componentes base.
- **`clsx`/`tailwind-merge` instalados y sin usar** → clases compuestas con template literals crudos, origen de las divergencias.
- **Código muerto:** `ui.tsx` + `union.tsx` (kit de primitivas no montado), `SplitPane` (solo tests), `react-streamdown`, `--radius-card` (nadie lo usa; radios arbitrarios por todas partes), `window.electronAPI` en `ActivityTray.tsx:45`, `lib/mock.ts` vivo pese a comentarse lo contrario.
- **`any` prohibidos en capa UI:** `registry.ts:14` (`props: any` en el contrato completo), `(window as any).ego` cuando existe `window-ego.d.ts` tipado.
- **Sin virtualización** (chat, tablas, listas) ni `React.lazy` (recharts en bundle inicial).
- **Sin `role`/`aria-sort` en tablas**, menú `DomainSelector` sin navegación por flechas ni click-outside.
- Radios inconsistentes: `rounded-lg/xl/2xl/md` sin escala; tipografía sin ritmo (`text-xs` vs `text-[13px]` vs `fontSize:14` inline).

## 5. Vacíos documentales y contradicciones

No existe **ningún documento de design system**: la paleta de UI solo vive en 7 líneas de `index.css`; no hay spec de espaciado, grillas, jerarquía tipográfica, sombras, ni del tema claro que `ux-ui.md` promete. Tampoco hay doc de accesibilidad (ratios, foco, ARIA) ni estrategia de test visual.

**Contradicciones principales:** docs de producto (2026-10-06) prohíben "sidebar rígida" pero `navigation-sidebar.md` (2026-10-07) la especifica y ya está implementada; "3 vs 4 elementos permanentes"; silueta canónica `delta-core` vs `Monolito Cuántico`; `character-system.md` dice "no hay código" cuando `CHAR-05..11` están completados; referencias rotas (`hermes-agent.md` cita una "regla B/N" inexistente en `ux-ui.md`); catálogo declarado de 24 componentes vs 11 implementados.

## 6. Benchmark — interfaces similares (2026)

| Producto | Patrón clave | Lección para Ego |
|---|---|---|
| **Claude Code Desktop** (rediseño abr-2026) | Sidebar multi-sesión + **paneles arrastrables** (chat, diff, browser, terminal, plan) + 3 modos de vista (Verbose/Normal/Summary) + side-chat `/btw` que lee el hilo principal sin contaminarlo | Ego tiene 3 columnas fijas; el mercado va a **paneles moldeables**. El "modo de densidad" (Verbose/Summary) es justo lo que falta para el principio de "alta densidad sin abrumar" |
| **Cursor 3 / Agents Window** | Superficie "Manager" separada del editor: estado por tarea escaneable, 1 línea resumida por agente | El ActivityTray/Widget de Ego apunta a esto; conviene agrupar por "lo que necesita atención" como hace Claude (`Needs input` rows) |
| **Patrón dominante Canvas + Diff Inspector** (v0, Figma AI, Devin) | Dual-pane: intención (izq) → artefacto vivo (centro) → **Review Card atómica con split-diff, Accept All ⌘↵ / Esc / undo ⌘Z** | El `ApprovalCard` de Ego existe pero sin undo global ni atajos consistentes. El mercado reporta **-46% fatiga de verificación** con Review Cards |
| **Zero-CLS streaming** (estándar 2026) | Buffers `requestAnimationFrame` a 16ms, skeleton bounds preasignados, scroll sticky que se libera al subir | Ego reemplaza el mensaje completo tras el placeholder → confirma H5 |
| **7 patrones obligatorios de agentic UI** (Brainy/Devin/Claude) | Task framing, autonomy slider, plan surface editable, progress stream, confirmation gates escalonados (soft/hard/2-step), error recovery, handoff | Ego tiene progress + gates HITL; **le falta plan surface editable** y escalonar la severidad de confirmación |
| **Replit/Bolt/v0** | Prompt izquierda + preview vivo derecha | Ego ya hace esto (Chat + Canvas) — **la arquitectura está alineada con el mercado** |

**Veredicto del benchmark:** la *arquitectura* de Ego (Chat + Canvas + superficie de telemetría + HITL) está **adelantada y alineada** con lo mejor de 2026. El déficit no es conceptual: es de **ejecución y acabado** (tokens, accesibilidad, consistencia).

## 7. Mejoras priorizadas

### 🔴 Inmediatas (1–2 días, alto impacto)
1. **Cargar Geist** — `import "geist/font/sans"` + `geist/font/mono` en `main.tsx` (5 min, recupera la identidad tipográfica).
2. **Definir `app-region-drag`** (`-webkit-app-region: drag` / `no-drag` en CSS) — arregla el arrastre de la ventana.
3. **Añadir `--color-accent`** al `@theme` (un solo color de acento, p.ej. ámbar `#f59e0b` o cian de los presets) — repara 5 estilos fantasma y da vida a la paleta monocroma.
4. **Eliminar los 13 `style={{}}` de `ego-chat.tsx`** → clases Tailwind con los tokens.

### 🟠 Corto plazo (1 semana)
5. **Decidir el destino del sistema de temas:** o los componentes consumen `var(--ego-*)` (tema real, funcional), o se elimina `DesignSystemProvider`/`ThemeControl` (código muerto que engaña). Recomendación: conectar `@theme` a las variables del provider.
6. **Auditoría WCAG AA mecánica:** foco visible único (`focus-visible:ring` global), focus-trap + Escape en los 6 modales, subir `--color-dim` a ≥4.5:1 (p.ej. `#8a8a92`), `aria-label` en botones de icono, `role="tablist"`.
7. **Error boundary global** en `main.tsx` + skeletons de carga + feedback de error en settings.
8. **Unificar neutros:** prohibir `zinc-*`/`neutral-*` en componentes; mapear las paletas de Recharts a los tokens (o al nuevo acento).

### 🟡 Medio plazo (2–4 semanas)
9. **Componentizar el kit base:** `Button`, `Input`, `Modal`, `Tabs`, `Badge`, `EmptyState` con variantes usando `clsx`+`tailwind-merge` ya instalados; eliminar la duplicación (modales ×6, inputs ×12, tabs ×3).
10. **Split `sidebar.tsx`** (SettingsModal, ProjectModal, McpPanel en archivos propios); borrar código muerto (`union.tsx`, `SplitPane`, mock, `window.electronAPI`).
11. **Code-split + virtualización:** `React.lazy` para recharts/Dominios; windowing en hilo de chat y tablas largas.
12. **Escribir `docs/design/design-system.md`** (paleta, escala tipográfica, espaciado, radios, foco, contraste) y resolver contradicciones doc (sidebar vs "sin sidebar rígida", delta-core vs monolito, estado de `character-system.md`).
13. **Tests de a11y y regresión visual:** axe en CI + snapshots Playwright (hoy 0 tests de accesibilidad ni visuales), complementar con skills `a11y-accessibility-scan`/`visual-review`.

### 🔵 Estratégico (alineado con el mercado)
14. **Plan surface editable** (patrón Devin: plan → pasos editables → se convierte en log de ejecución).
15. **Modo de densidad del chat** (Verbose/Normal/Summary, como Claude Code) para cumplir "alta densidad sin abrumar".
16. Ejecutar la deuda UI de backlogs: `HERM-20` hot-palette, `HERM-21` visor de costos, `COUC-19` System Tray.

---

## Síntesis final

La *concepción* de la interfaz de Ego es sólida y competitiva (Chat+Canvas declarativo, contrato Zod headless bien diseñado, HITL, presupuesto UI auditado 🟢). Pero hay una **brecha entre lo prometido en la documentación y lo ejecutado**: la tipografía y los temas no funcionan, la accesibilidad está lejos del WCAG AA que el propio backlog exige como gate, y el chat —la superficie principal— vive fuera del design system. Los ítems 1–4 son arreglos de horas con impacto visual inmediato.

---

# PARTE V — Inconsistencias código ↔ documentación (verificadas 2026-10-14)

Verificado con grep directo sobre el código el 2026-10-14. Categorizado por área,
con evidencia archivo:línea. Cada ítem tiene su fila `EGO-FIND-NN` en
`docs/roadmap/Backlog.md` §Hallazgos pendientes.

## 1. Stack y fundaciones que la doc promete y el código no tiene

| # | La documentación dice | El código hace | Evidencia | FIND |
|---|---|---|---|---|
| 1.1 | Tipografía Geist integrada | Paquete instalado pero jamás importado; cae a Segoe UI | `ux-ui.md:82,106` vs `package.json:20` + grep 0 | EGO-FIND-02 |
| 1.2 | Markdown vía `react-streamdown` | Parser propio; streamdown solo en package.json | `ux-ui.md:51` vs `package.json:15` + grep 0 imports | EGO-FIND-03 |
| 1.3 | React Router, Radix/shadcn, Zustand | Ninguno instalado; modales/menús a mano | `stack-tecnico.md:57-58,66` vs `renderer/package.json` | EGO-FIND-04 |
| 1.4 | Ctrl+K omnibar, Ctrl+, settings | Solo handlers Ctrl+B/N; K y coma son texto sin handler | `navigation-sidebar.md:71-72` vs `sidebar.tsx:237,241,439,605` | EGO-FIND-05 |
| 1.5 | Sidebar con Proyectos/Roster/Historial vía IPC→VantaDB | `subEgos`/`sessions` hardcodeados | `navigation-sidebar.md` §3 vs `sidebar.tsx:250,281,568-582` | EGO-FIND-06 |

## 2. Accesibilidad: promesa WCAG 2.1 AA vs realidad

| # | La documentación dice | El código hace | Evidencia | FIND |
|---|---|---|---|---|
| 2.1 | WCAG 2.1 AA desde P0 | 0 focus-visible, 1 tabIndex, 1 onKeyDown | `ux-ui.md:85` vs grep 0/1/1 | EGO-FIND-07 |
| 2.2 | Teclado: foco, enter, escape | Modales sin trap ni Escape (salvo HITL widget) | `ux-ui.md:116` vs `sidebar.tsx:623,830`, `ActivityWidget.tsx:13-29` | EGO-FIND-07 |
| 2.3 | Contraste AA respetado | text-dim sobre panel ≈ 2.6:1 (exige 4.5:1) | `ux-ui.md:116` vs `index.css:13`, `App.tsx:91,116` | EGO-FIND-08 |
| 2.4 | ARIA mínimos | Iconos solo con title=, composer sin label, tabs sin tablist, tabla sin aria-sort | `ux-ui.md:116` vs `sidebar.tsx:311-381`, `ego-chat.tsx:312-324`, `TableView.tsx:104-126` | EGO-FIND-07 |

## 3. Reglas de UX del propio doc que el código viola

| # | La documentación dice | El código hace | Evidencia | FIND |
|---|---|---|---|---|
| 3.1 | Avatar solo en primer mensaje o cambio de orador | Badge en cada mensaje, hardcodeado `ego.nucleus`/`idle` | `ux-ui.md:51` vs `ego-chat.tsx:36-39,72-75` | EGO-FIND-09 |
| 3.2 | Prohibido CSS ad-hoc; tokens obligatorios | 13 inline con hex; sin tokens de espaciado/sombra; radius sin uso | `ux-ui.md:104,115,127` vs `ego-chat.tsx`, `index.css:15` | EGO-FIND-10 |
| 3.3 | Theme abstraction + claro secundario | Dark-only; `--ego-*` sin consumidores; `theme` sin consumidor | `ux-ui.md:83,106` vs `index.css:7-13`, `DesignSystemProvider.tsx:164-197` | EGO-FIND-11 |
| 3.4 | 9 estados universales por componente | Sin sistema: sin skeletons, 3 focos distintos | `ux-ui.md:97-98,108` | EGO-FIND-12 |
| 3.5 | Chat fullscreen con canvases inline | No existe (grep 0); 3 columnas fijas | `ux-ui.md:18` vs `App.tsx:96-194` | EGO-FIND-13 |
| 3.6 | 4 tipos de Canvas | Sin `canvasType` (grep 0); solo estado genérico | `ux-ui.md:15` vs renderer + ui-runtime | EGO-FIND-13 |
| 3.7 | Sub-Ego sin pantalla fija ni sección en sidebar | Roster fijo con "+ Diseñar Sub-Ego…" | `ux-ui.md:166-180` vs `sidebar.tsx:502-517` | EGO-FIND-14 |

## 4. Backlog/planes vs código (✅ que no cuadran)

| # | El backlog dice | El código hace | Evidencia | FIND |
|---|---|---|---|---|
| 4.1 | CANV-12 ✅ con tests de sidebar | 0 tests de sidebar/App; solo id de SplitPane | `Backlog.md:239` vs `test/*.tsx` | EGO-FIND-15 |
| 4.2 | CORE-05 ✅ chat con streaming | Placeholder fake + resolve completo; sin token-a-token | Fase 01 vs `ego-chat.tsx:142-167` | EGO-FIND-15 |
| 4.3 | Catálogo de 24 componentes | Registry con 11; sin distinción aspiracional/impl. | `ui-runtime.md` vs `registry.ts:21-33` | EGO-FIND-16 |
| 4.4 | Silueta "Monolito" aprobada | Código solo `delta-core`/`coucou-mochi` | plan-20:567, CHAR-04 vs `CharacterBadge.tsx:22` | EGO-FIND-16 |
| 4.5 | OCLW-11 ✅ MermaidRenderer | Solo sanitizador; 0 mermaid en renderer | backlog-openclaw.md vs grep 0 | EGO-FIND-16 |

## 5. Contrato técnico internamente roto

| # | La documentación dice | El código hace | Evidencia | FIND |
|---|---|---|---|---|
| 5.1 | IPC solo vía `window.ego` | `ActivityTray` usa `window.electronAPI` inexistente | contrato IPC vs `ActivityTray.tsx:45` | EGO-FIND-10 |
| 5.2 | Frameless con arrastre | `app-region-drag` sin definir; arrastre incierto | `gui-desktop.md` vs `main.ts:1384`, `App.tsx:76` | EGO-FIND-11 |
| 5.3 | Tokens `--font-geist-*` | No existen; fallback system-ui | `DesignSystemProvider.tsx:159-160` vs `index.css:4-5` | EGO-FIND-02 |
| 5.4 | Accent implícito | Sin `--color-accent`; 5 archivos con clases muertas | 5 archivos §1.4 otro informe vs `index.css` | EGO-FIND-11 |

## 6. Patrón de fondo

La documentación de producto (`ux-ui.md`, 2026-10-06) y `stack-tecnico.md`
describen un estado deseado que nunca se cerró contra el código, mientras
`navigation-sidebar.md` (2026-10-07) documenta lo construido — contradiciendo a
la de producto. No existe ningún mecanismo (test, doctest o auditoría periódica)
que verifique doc ↔ código.
