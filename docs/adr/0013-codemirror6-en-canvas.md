# ADR 0013: CodeMirror 6 sustituye a ProseMirror en el editor de Canvas #

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-19 |
| Estado | Aceptado |
| Nivel jerárquico | 10.Implementation (`docs/jerarquia-canonica.md`) |

## Contexto ##

El Canvas de Ego expone un componente `Editor` (`CANV-03`) declarado en el
catálogo de `@ego/ui-runtime`. La primera implementación de `EditorView`
(`apps/desktop/renderer/components/canvas/EditorView.tsx`) usaba **ProseMirror**
(`prosemirror-model`, `prosemirror-state`, `prosemirror-view`): un editor de
documentos rico, pensado para un modelo de documento estructurado.

El uso real de Ego es **edición de código y markdown dentro del Canvas**, no
edición de documento enriquecido. ProseMirror exige construir un schema de
nodos, un `Plugin` de parseo y un `EditorState` propio, y su curva de
aprendizaje no aporta nada frente a un editor de código. Además ProseMirror
no trae highlighting de sintaxis, historial, búsqueda ni navegación por
línea, todo lo cual sí es producto en un editor de código.

La migración se ejecutó en el commit `135afdc`
("feat(canvas,renderer): upgrade EditorView to CodeMirror 6 and offload Shiki to
Web Worker").

## Decisión ##

`EditorView` usa **CodeMirror 6** como editor de código.

- Paquetes: `codemirror ^6.0.2` + `@codemirror/state`, `@codemirror/view`,
  `@codemirror/commands`, `@codemirror/language`, `@codemirror/theme-one-dark`,
  `@codemirror/lang-javascript`, `@codemirror/lang-python`,
  `@codemirror/lang-markdown`.
- Tema: `oneDark` (alineado con el modo dark-only de ADR-0004).
- Idioma del buffer: se infiere del tipo de componente declarado en el
  registry (`javascript` / `python` / `markdown`).
- `prosemirror-model`, `prosemirror-state` y `prosemirror-view` quedan **fuera**
  del grafo de dependencias del renderer.

## Alternativas consideradas ##

- **ProseMirror (descartado):** modelo de documento rico innecesario para
  código; sin highlighting, historial ni búsqueda nativos; coste de schema
  propio.
- **Monaco Editor (descartado):** era la opción declarada en
  `docs/engineering/stack-tecnico.md` hasta 2026-10-19, pero **nunca estuvo en
  ninguna `package.json`** (0 ocurrencias de `monaco` en el repo): era una
  decisión documental sin implementación. Monaco es además pesado (~5 MB de
  bundle) y de mantenimiento costoso frente al modelo de extensiones de CM6.
- **Editor nativo del SO (descartado):** `textarea` no da highlighting ni
  navegación por línea y no es extensible.

## Consecuencias ##

- Positivas: menos 3 dependencias; highlighting, historial, búsqueda y
  navegación por línea de serie; bundle menor; API extensible por paquetes.
- Negativas: CM6 no trae modelo de documento enriquecido; si en el futuro el
  Canvas necesita edición WYSIWYG, habrá que añadir una superficie nueva
  (y esa decisión requiere un ADR nuevo).
- Deuda asumida: `EditorView` no persiste los cambios y remonta en cada
  cambio de `props.code` → registrado como `EGO-FIND-57` en
  `docs/roadmap/Backlog.md` (A4).
- Riesgo: la migración de ProseMirror a CM6 no es reversible por el mismo
  camino; el estado de `useEffect` depende de `props.code`.

## Referencias ##

- `apps/desktop/renderer/components/canvas/EditorView.tsx`
- `apps/desktop/renderer/package.json` (dependencias `@codemirror/*`)
- `packages/ui-runtime/src/schemas/components.ts` (esquema del componente `Editor`)
- `docs/roadmap/Backlog.md` (`EGO-FIND-57`)
