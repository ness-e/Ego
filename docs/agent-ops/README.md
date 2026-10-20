# Agent-Ops — operativa interna de agentes

| Campo | Valor |
| --- | --- |
| Estado | Activo — worklogs internos de agentes (no es documentación de producto) |
| Owner | ness-e |
| Fecha | 2026-10-19 |

---

## Propósito

`docs/agent-ops/` es el registro de **ejecución** de Ego: los planes de
trabajo, las task files unitarias, los reportes de verificación y las
matrices de compuertas. Es la capa "cómo se construyó", no la capa "qué es".

> **No es documentación de producto.** El sitio VitePress excluye este
> directorio (`srcExclude: ['agent-ops/**']` en `docs/.vitepress/config.mts`)
> y `docs/index.md` lo enlaza solo como referencia interna del repo.

## Contenido del directorio

| Ruta | Qué contiene | Índice |
|---|---|---|
| [`tasks/`](tasks/) | Task files unitarias (contrato + pasos + evidencia). | [`tasks/README.md`](tasks/README.md) |
| [`plans/`](plans/) | Planes de ejecución por fase o por ola. | (directorio) |
| [`reports/`](reports/) | Reportes de verificación y auditorías. | [`reports/INDEX.md`](reports/INDEX.md) |
| [`reviews/`](reviews/) | Informes de revisión multi-agente. | (directorio) |

## Capas y precedencia

Este directorio **no** compite con la documentación canónica:

| Capa | Dónde vive | Autoridad |
|---|---|---|
| Identidad | `docs/product/`, `docs/architecture/` | [`jerarquia-canonica.md`](../jerarquia-canonica.md) |
| Decisiones con coste de reversión | [`docs/adr/`](../adr/) | ADRs (numerados sin colisiones) |
| Estado de tareas | [`docs/roadmap/Backlog.md`](../roadmap/Backlog.md) | **El Backlog manda** |
| Ejecución y evidencia | `docs/agent-ops/` | Este directorio |

Si un worklog de agent-ops contradice al Backlog o a un ADR, **manda el
documento canónico** y el worklog está desactualizado.

## Convenciones

- **Task file**: una unidad de trabajo verificable. ID con prefijo de dominio
  (`T`, `ACT`, `SUB`, `INT`, `CHAR`, `DIST`, `HIG`, `FIND`, `E2E`, `STAB`,
  `T-isla`) + número. Estado en `| Estado |` o en el front-matter `status:`.
- **Descartes**: el estado canónico es `🚫 Descartada: <fundamento técnico>`
  y el fundamento va escrito en la propia fila. Una compuerta nunca queda en
  el limbo (`AGENTS.md` §4).
- **Cierre atómico**: al cerrar una tarea se actualizan la task file, la fila
  del Backlog y el reporte de verificación.
- **Nada de commits desde una task file**: los commits los hace el lead.

## Enlaces

- Índice maestro: [`docs/index.md`](../index.md)
- Jerarquía canónica: [`docs/jerarquia-canonica.md`](../jerarquia-canonica.md)
- Backlog canónico: [`docs/roadmap/Backlog.md`](../roadmap/Backlog.md)
