# Lecciones Ego (2026-10-05+)

Registro vivo de lecciones del producto desktop. Historia del motor archivada en `archive/`.


### Lección 2026-10-10: Fricción en nombres de métodos de persistencia y c
- **Incidente:** Fricción en nombres de métodos de persistencia y catálogo base de Sub-Egos en DOM-01..09
- **Causa Raíz:** Los contratos iniciales usaban set() en vez de put() y el test de SubEgoFactory esperaba exactamente 5 plantillas base originales.
- **Mitigación Preventiva:** Estandarizar métodos de almacenamiento en EgoMemoryAdapter (put({ namespace, key, payload })) y usar SubEgoFactory.registerTemplate() dinámicamente sin mutar las 5 plantillas core de Fase 03.

### Lección 2026-10-16: Orquestación waves con subagentes y rate limits
- **Incidente:** Waves paralelas x3 sin modelo explícito → `Go usage limit` + `Rate limit exceeded`.
- **Causa Raíz:** Subagentes default usan variante go con cupo propio; prompts cortos SIN-FORMATO obligan re-DISCOVERY.
- **Mitigación Preventiva:** Modelo explícito `opencode/muse-spark-1.3-contributor-free` + sessionID resume + prompts 10 bloques pipeline-run §6.f + waves MAX 3 por archivos disjuntos + `git add` selectivo + NUNCA push. ref: docs/agent-ops/plans/archive/2026-10-16-plan-estabilizacion-ego.md

### Lección 2026-10-16: Reviews P2-01 con re-run propio
- **Incidente:** Claims de suites verdes heredados del worker sin verificar.
- **Causa Raíz:** Aceptar STEPS_OK sin re-ejecución selectiva del blast radius.
- **Mitigación Preventiva:** Revisor re-corre suites del blast (o grep+stat si docs-only) y clasifica rojos ajenos por disjunción de archivos antes del approve. ref: docs/agent-ops/plans/archive/2026-10-16-plan-estabilizacion-ego.md
