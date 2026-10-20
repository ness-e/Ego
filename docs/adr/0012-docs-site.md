# ADR 0012: VitePress como generador canónico del sitio de documentación #

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-16 |
| Estado | Aceptado |
| Nivel jerárquico | 10.Implementation (`docs/jerarquia-canonica.md`) |
| Decisor | STAB-15 (contrato del plan de estabilización) |

## Contexto ##

La documentación vive en `docs/` como Markdown plano. `docs/index.md` es el
índice maestro y `docs/.vitepress/config.mts` ya existía como configuración
mínima. Faltaba la decisión explícita: ¿VitePress o Docusaurus?

A 2026-10-19 el corpus son ~276 documentos Markdown (266 canónicos +
worklogs de `docs/agent-ops/`). La configuración inicial solo exponía 3
entradas de navegación, por lo que la promesa de "sitio canónico" no se
cumplía y el sitio renderizaba ~1 % del corpus.

## Decisión ##

**VitePress** es el generador canónico del sitio de documentación.

- `docs/.vitepress/config.mts` es la configuración del sitio.
- `docs/index.md` es el índice maestro de contenido y **la** fuente de la
  navegación: la `sidebar` se deriva de él (o se mantiene sincronizada con él).
- Scripts `pnpm docs:dev` / `pnpm docs:build` (VitePress pinneado en
  `devDependencies`).
- La guía de usuario (`docs/user/`) lleva front-matter `diataxis:` con la
  taxonomía tutorial / how-to / reference / explanation.

## Alternativas consideradas ##

- **VitePress (elegido):** config mínima existente (`config.mts`, 29 líneas),
  sin framework React propio en el grafo del producto, build estático rápido,
  búsqueda local incluida. Suficiente para docs internos + changelog espejo.
- **Docusaurus (descartado):** más pesado (React + plugins), sobredimensionado
  para el volumen actual de docs; se reevaluaría solo si el sitio necesita
  versionado multi-release o i18n con infraestructura propia.
- **Markdown plano sin generador (descartado):** no da búsqueda local ni
  navegación; obliga a mantener el índice a mano en GitHub.

## Consecuencias ##

- Positivas: un solo generador, sin dependencia de React en el grafo del
  producto; búsqueda local; build estático y barato.
- Negativas: `srcExclude` deja fuera `docs/agent-ops/**` (worklogs internos, no
  producto), así que el sitio no cubre el 100 % del corpus — decisión
  deliberada, no un descarte.
- Deuda asumida: la navegación del sitio debe mantenerse sincronizada con
  `docs/index.md`; `docs/testing/check-docs-paths.mjs` verifica integridad de
  enlaces y de rutas citadas, no la paridad índice↔sidebar.
- Reversión: cambiar de generador solo toca `docs/.vitepress/` + CI + scripts
  `docs:*`; el contenido Markdown no depende del generador.

## Referencias ##

- `docs/.vitepress/config.mts`
- `docs/index.md`
- `docs/getting-started.md` (sección "Docs como sitio")
