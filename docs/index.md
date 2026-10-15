| Campo | Valor |
| --- | --- |
| Estado | Revisable — índice maestro |
| Owner | ness-e |
| Fecha | 2026-10-16 |

# Índice de documentación de Ego

## Empieza aquí

- [`user/getting-started.md`](user/getting-started.md) — quickstart + vistas (shell/chat/canvas)
- [`user/README.md`](user/README.md) — guía de usuario (índice del área)
- [`changelog.md`](changelog.md) — espejo web de `CHANGELOG.md`
- Sitio VitePress (decisión ADR-0006): `pnpm docs:dev` (config `docs/.vitepress/config.mts`)

## Navegación principal

**Guía de usuario** (`user/`, taxonomía Diátaxis — ver mapa abajo)

- [`getting-started.md`](user/getting-started.md) — tutorial
- [`configuration.md`](user/configuration.md) — how-to
- [`troubleshooting.md`](user/troubleshooting.md) — how-to
- [`concepts.md`](user/concepts.md) — explanation
- [`faq.md`](user/faq.md) — reference
- [`changelog.md`](user/changelog.md) — reference

**Design**

- [`design-system.md`](design/design-system.md) — **Design System canónico** (tokens, dark-only 4 presets, kit Radix, 9 estados)

**ADR** (decisiones de arquitectura)

- [`0001-electron-vite.md`](adr/0001-electron-vite.md)
- [`0002-vantadb-primero.md`](adr/0002-vantadb-primero.md)
- [`0003-renderer-tonto.md`](adr/0003-renderer-tonto.md)
- [`0004-dark-only.md`](adr/0004-dark-only.md)
- [`0005-promptassembly-turno.md`](adr/0005-promptassembly-turno.md)
- [`0006-docs-site.md`](adr/0006-docs-site.md) — VitePress como site canónico

**Deployment** (fuente vigente)

- [`distribution.md`](deployment/distribution.md) — **distribución unsigned vigente** (superseed de `operations/despliegue.md`)
- [`release-notes-template.md`](deployment/release-notes-template.md)

**Dev**

- [`DEV_LOOP.md`](dev/desktop/DEV_LOOP.md) — loop de desarrollo desktop
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — workflow PR + Conventional Commits + hooks
- [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) — código de conducta

**Agent-Ops** (operativa de agentes; no es doc de producto)

- [`plans/`](agent-ops/plans/) — planes de ejecución vivos
- [`tasks/`](agent-ops/tasks/) — task files por ID (STAB-*, etc.)
- [`reports/`](agent-ops/reports/) — reportes de verificación

**Product**

- [`principios-innegociables.md`](product/principios-innegociables.md)
- [`vision.md`](product/vision.md)
- [`personas.md`](product/personas.md)
- [`concepto.md`](product/concepto.md)
- [`definicion-soc.md`](product/definicion-soc.md)
- [`modulos.md`](product/modulos.md)
- [`ux-ui.md`](product/ux-ui.md)
- [`mascota.md`](product/mascota.md)
- [`character-art-direction.md`](product/character-art-direction.md)
- [`modelo-economico.md`](product/modelo-economico.md)

**Architecture**

- [`arquitectura-unificada.md`](architecture/arquitectura-unificada.md) ⭐ **Doctrina Rectora** (Ego, VantaDB, Hermes, OpenClaw)
- [`vision-general.md`](architecture/vision-general.md)
- [`dominios-funcionales.md`](architecture/dominios-funcionales.md)
- [`agentes.md`](architecture/agentes.md)
- [`memoria-vantadb.md`](architecture/memoria-vantadb.md)
- [`namespaces.md`](architecture/namespaces.md)
- [`jev.md`](architecture/jev.md)
- [`ui-runtime.md`](architecture/ui-runtime.md)
- [`workspace-dinamico.md`](architecture/workspace-dinamico.md)
- [`ciclo-memoria-unificado.md`](architecture/ciclo-memoria-unificado.md)
- [`subego-soul.md`](architecture/subego-soul.md)
- [`character-system.md`](architecture/character-system.md)

**Engineering**

- [`stack-tecnico.md`](engineering/stack-tecnico.md)
- [`lenguajes.md`](engineering/lenguajes.md)
- [`integraciones.md`](engineering/integraciones.md)
- [`vantadb-readiness-plan.md`](engineering/vantadb-readiness-plan.md)

**Operations**

- [`despliegue.md`](operations/despliegue.md) — ⚠️ deprecated, ver `deployment/distribution.md`
- [`snapshots-respaldo.md`](operations/snapshots-respaldo.md)

**Testing**

- [`estrategia.md`](testing/estrategia.md)

**Roadmap**

- [`roadmap.md`](roadmap/roadmap.md)
- [`Backlog.md`](roadmap/Backlog.md)
- [`metricas-okr.md`](roadmap/metricas-okr.md)

**References**

- [`fuentes.md`](references/fuentes.md)
- [`glosario.md`](references/glosario.md)
- [`diseno-skills.md`](references/diseno-skills.md)
- [`gui-desktop.md`](references/gui-desktop.md)
- [`repos-intel.md`](references/repos-intel.md)

**Plan y Gobernanza**

- [`jerarquia-canonica.md`](jerarquia-canonica.md)
- [`PLAN-EGO.md`](PLAN-EGO.md)
- [`plan/README.md`](plan/README.md)

**Review & Auditoría**

- [`review/README.md`](review/README.md)
- [`review/backlog-hermes.md`](review/backlog-hermes.md)
- [`review/backlog-openclaw.md`](review/backlog-openclaw.md)
- [`review/backlog-coucou.md`](review/backlog-coucou.md)

**Research**

- [`research/README.md`](research/README.md)
- [`hermes-agent-deep-dive.md`](research/hermes-agent-deep-dive.md)
- [`openclaw-deep-dive.md`](research/openclaw-deep-dive.md)
- [`coucou-deep-dive.md`](research/coucou-deep-dive.md)

**Extracciones de Repositorios**

- [`extractions/README.md`](extractions/README.md)
- [`extractions/hermes-agent.md`](extractions/hermes-agent.md)
- [`extractions/openclaw.md`](extractions/openclaw.md)
- [`extractions/coucou.md`](extractions/coucou.md)

## Mapa Diátaxis (guía de usuario)

| Documento | Tipo Diátaxis | Qué responde |
|---|---|---|
| `user/getting-started.md` | tutorial | "Llévame de la mano en mi primer outcome" |
| `user/configuration.md` | how-to | "Cómo conecto mi modelo" |
| `user/troubleshooting.md` | how-to | "Cómo resuelvo este síntoma" |
| `user/concepts.md` | explanation | "Por qué Ego funciona así" |
| `user/faq.md` | reference | "Respuesta corta a una pregunta concreta" |
| `user/changelog.md` | reference | "Qué cambió y desde cuándo" |

Cada documento de `user/` declara su tipo en el front-matter `diataxis:`.
Referencia del sistema: [Diátaxis](https://diataxis.fr/) (verificada 2026-10-16, HTTP 200).

## Regla de gobierno de documentos

1. La **jerarquía canónica** ([`jerarquia-canonica.md`](jerarquia-canonica.md)) establece la precedencia entre decisiones de producto, capacidades, arquitectura, diseño e implementación.
2. Los **principios innegociables** ([`principios-innegociables.md`](product/principios-innegociables.md)) definen las 10 propiedades fundamentales del sistema.
3. Todo cambio en arquitectura y plan debe reflejarse primero en la documentación antes de modificar código crítico.
4. La documentación PRD original y archivos legacy fueron eliminados del repositorio (preservados en historial git). Las decisiones vigentes son las derivadas de las preguntas Q1–Q25.
