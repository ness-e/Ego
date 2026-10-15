# ADR 0006 — Sitio de documentación: VitePress

| Campo | Valor |
| --- | --- |
| Estado | Aceptada |
| Fecha | 2026-10-16 |
| Decisor | STAB-15 (contrato del plan de estabilización) |

## Contexto

La documentación vive en `docs/` como Markdown plano. `docs/index.md` es el
índice maestro y `docs/.vitepress/config.mts` ya existía como configuración
mínima. Faltaba la decisión explícita: ¿VitePress o Docusaurus?

## Decisión

**VitePress** es el generador canónico del sitio de documentación.

## Alternativas consideradas

- **VitePress (elegido):** config mínima existente (`config.mts`, 29 líneas),
  sin framework React propio en el grafo del producto, build estático rápido,
  búsqueda local incluida. Suficiente para docs internos + changelog espejo.
- **Docusaurus (descartado):** más pesado (React + plugins), sobredimensionado
  para el volumen actual de docs; se reevaluaría solo si el sitio necesita
  versionado multi-release o i18n con infraestructura propia.

## Consecuencias

- `vitepress` pinneado en `devDependencies`; scripts `docs:dev` / `docs:build`.
- Job `docs-build` en `.github/workflows/docs-lint.yml` compila el sitio en CI.
- La guía de usuario (`docs/user/`) lleva front-matter `diataxis:` con la
  taxonomía tutorial / how-to / reference / explanation.
- Reversión: cambiar de generador solo toca `docs/.vitepress/` + CI + scripts
  `docs:*`; el contenido Markdown no depende del generador.
