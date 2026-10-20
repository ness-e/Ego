# ADR 0016: Resaltado de sintaxis (Shiki) fuera del hilo principal del renderer #

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-19 |
| Estado | Aceptado |
| Nivel jerárquico | 10.Implementation (`docs/jerarquia-canonica.md`) |

## Contexto ##

El renderizado de markdown con resaltado de sintaxis en el chat usa **Shiki**,
que requiere cargar grammars WASM y analizar el código. Hecho en el hilo
principal del renderer, ese coste bloquea el event loop: cada bloque de
código nuevo congela la ventana durante el parseo del grammar.

Shiki expone además una API de **highlighter** reutilizable
(`createHighlighter`) que permite precalentar los grammars y resolver el
highlight de forma asíncrona, apta para vivir en un worker.

El commit `135afdc`
("feat(canvas,renderer): upgrade EditorView to CodeMirror 6 and offload Shiki
to Web Worker") introduce el offload.

## Decisión ##

El resaltado de sintaxis con Shiki se ejecuta en un **Web Worker del
renderer**, con un fallback en hilo principal.

- Worker: `apps/desktop/renderer/workers/shiki.worker.ts`.
- Consumidor: `apps/desktop/renderer/components/assistant-ui/shiki-highlight.tsx`.
- El worker mantiene un highlighter Shiki persistente (grammars precargados)
  y responde por id de petición.
- Si el worker no responde (no soportado, error de carga, timeout), el
  consumidor degrada a renderizado **sin resaltado** en el hilo principal: el
  contenido se muestra igual, solo que sin colores.

## Alternativas consideradas ##

- **Shiki en hilo principal (descartado):** bloquea el event loop del renderer
  en cada bloque de código; el congelamiento es perceptible con
  varios fragmentos.
- **`react-syntax-highlighter` / Prism (descartado):** resaltado por regex, más
  rápido pero con calidad de tokenización muy inferior y sin soporte de
  grammars language-specific.
- **`highlight.js` (descartado):** mismo motivo; además no tiene API de
  highlighter reutilizable.
- **Worker con `shiki/core` y subconjunto de grammars (pendiente):** la vía
  para reducir el bundle; requiere `manualChunks` que hoy mete `shiki` en el
  chunk inicial.

## Consecuencias ##

- Positivas: el hilo principal del renderer no se bloquea por resaltado; el
  chat responde con fluidez mientras llegan fragmentos con código.
- Negativas: un Web Worker implica serialización de mensajes (el resultado
  del highlight es HTML serializado); hay que gestionar el ciclo de vida del
  worker y sus pendientes.
- Deuda asumida: el offload **no reduce el bundle** — `vendor-shiki`
  (~9.87 MB) se importa estáticamente desde el chunk `index` pese al
  comentario "no entra al bundle inicial". El fallback in-thread degrada en
  silencio (solo `console.warn`) y `pendingRequests` no se limpia si el worker
  no responde. Registrado como `EGO-FIND-58` en `docs/roadmap/Backlog.md`
  (A4).
- Riesgo: en entornos sin Web Worker (tests con Happy-DOM), el camino de
  fallback debe ser determinista; si no, los tests de chat son intermitentes.

## Referencias ##

- `apps/desktop/renderer/workers/shiki.worker.ts`
- `apps/desktop/renderer/components/assistant-ui/shiki-highlight.tsx`
- `apps/desktop/renderer/vite.config.ts` (`manualChunks`)
- `apps/desktop/renderer/package.json` (`shiki ^4.5.0`)
- `docs/roadmap/Backlog.md` (`EGO-FIND-58`)
