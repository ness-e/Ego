| Campo | Valor |
| --- | --- |
| Estado | Revisable — índice maestro del corpus de documentación |
| Owner | ness-e |
| Fecha | 2026-10-19 |

# Indice de documentación de Ego

> **Este fichero es el índice maestro y la fuente de la navegación del sitio
> VitePress** (ADR-0012). Todo documento canónico debe aparecer aquí. La
> integridad de enlaces y de rutas citadas se verifica con
> `node docs/testing/check-docs-paths.mjs`.

## Empieza aquí

- [`getting-started.md`](getting-started.md) - quickstart de **desarrollo** (build, tests, SHA SUMS, sitio de docs)
- [`user/getting-started.md`](user/getting-started.md) - primeros pasos de **usuario** (tutorial Diátaxis)
- [`user/README.md`](user/README.md) - guía de usuario (índice del área)
- [`changelog.md`](changelog.md) - espejo web de `CHANGELOG.md`
- Sitio VitePress (decisión ADR-0012): `pnpm docs:dev` (config `docs/.vitepress/config.mts`)

## Navegación principal

**Guía de usuario** (`user/`, taxonomía Diátaxis - ver mapa abajo)

- [`user/getting-started.md`](user/getting-started.md) - tutorial
- [`user/configuration.md`](user/configuration.md) - how-to
- [`user/troubleshooting.md`](user/troubleshooting.md) - how-to
- [`user/concepts.md`](user/concepts.md) - explanation
- [`user/faq.md`](user/faq.md) - reference
- [`user/changelog.md`](user/changelog.md) - reference

**Design**

- [`design/design-system.md`](design/design-system.md) — **Design System canónico**
  (tokens, dark-only 4 presets, kit Radix, 9 estados, **tabla de primitives**)
- [`design/DESIGN.md`](design/DESIGN.md) — ficha de producto: paletas **OKLCH**,
  contrato de contraste WCAG 2.2 y registro de primitives

**ADR** (decisiones de arquitectura — `docs/adr/`, numeración sin colisiones)

- [`adr/README.md`](adr/README.md) — índice de las 19 decisiones con su estado y nivel jerárquico
- [`0001-electron-vite.md`](adr/0001-electron-vite.md) — Electron + Vite (**superseded** por `electron-vite` 5.x)
- [`0002-vantadb-primero.md`](adr/0002-vantadb-primero.md) - VantaDB embebido in-process como única base local
- [`0003-renderer-tonto.md`](adr/0003-renderer-tonto.md) - renderer solo presentación
- [`0004-dark-only.md`](adr/0004-dark-only.md) - dark-only, 4 presets, sin tema claro
- [`0005-promptassembly-turno.md`](adr/0005-promptassembly-turno.md) - prompt del turno en 3 tiers (PromptAssembly)
- [`0006-approval-identity.md`](adr/0006-approval-identity.md) — ApprovalIdentity: sellado HITL por contexto
- [`0007-interaction-transport.md`](adr/0007-interaction-transport.md) - InteractionTransport: admisión HITL con timeout
- [`0008-worker-policy.md`](adr/0008-worker-policy.md) - WorkerPolicy: policy pura sobre pool cooperativo
- [`0009-changeset-payloadref.md`](adr/0009-changeset-payloadref.md) - ChangeSet `payloadRef` sin duplicar contenido
- [`0010-netpolicy-security.md`](adr/0010-netpolicy-security.md) - frontera SSRF en `@ego/security`
- [`0011-stab14-asimilados-descartes.md`](adr/0011-stab14-asimilados-descartes.md) — mapa asimilados/descartes STAB-14
- [`0012-docs-site.md`](adr/0012-docs-site.md) - VitePress como generador canónico del sitio
- [`0013-codemirror6-en-canvas.md`](adr/0013-codemirror6-en-canvas.md) - CodeMirror 6 en el editor del Canvas
- [`0014-virtualizacion-chat-virtua.md`](adr/0014-virtualizacion-chat-virtua.md) - virtualización del chat con `virtua`
- [`0015-radix-select-accesible.md`](adr/0015-radix-select-accesible.md) — `Select` del `ui-kit` sobre Radix (D3)
- [`0016-shiki-web-worker.md`](adr/0016-shiki-web-worker.md) - resaltado Shiki en Web Worker
- [`0017-context-compaction-llm-inyectable.md`](adr/0017-context-compaction-llm-inyectable.md)
  — compactación con resumidor inyectable
- [`0018-motor-de-personaje.md`](adr/0018-motor-de-personaje.md)
  — `@ego/avatar` como motor de personaje; `CharacterEngine` queda legado
- [`0019-canal-dual-taint-tracking.md`](adr/0019-canal-dual-taint-tracking.md)
  — canal dual (P-LLM/Q-LLM) con taint tracking
- [`0020-compactacion-motor-ts-vs-nativo.md`](adr/0020-compactacion-motor-ts-vs-nativo.md)
  — motor de compactación: `ContextCompaction` (TS) canónico, nativo condicionado
- [`0021-mcp-server-transporte-y-token.md`](adr/0021-mcp-server-transporte-y-token.md)
  — transporte HTTP loopback y política de token del MCP Server de Ego

**Deployment** (fuente vigente)

- [`deployment/distribution.md`](deployment/distribution.md) — **distribución unsigned vigente**
  (superseed de `operations/despliegue.md`)
- [`deployment/release-notes-template.md`](deployment/release-notes-template.md)
- [`deployment/releases/v0.1.0-beta.1/release-notes.md`](deployment/releases/v0.1.0-beta.1/release-notes.md)
  - notas de la beta actual

**Dev**

- [`dev/desktop/DEV_LOOP.md`](dev/desktop/DEV_LOOP.md) - loop de desarrollo desktop
- [`dev/e2e-skip-inventory.md`](dev/e2e-skip-inventory.md) - inventario de tests E2E omitidos (clasificación A–D)
- [`engineering/testing-e2e.md`](engineering/testing-e2e.md) - estrategia y ejecución de la suite E2E
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) - workflow PR + Conventional Commits + hooks
- [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) - código de conducta

**Agent-Ops** (operativa de agentes; no es doc de producto)

- [`agent-ops/README.md`](agent-ops/README.md) — índice del área agent-ops
- [`agent-ops/tasks/README.md`](agent-ops/tasks/README.md) — tabla ID → estado de las task files
- [`agent-ops/plans/`](agent-ops/plans/) — planes de ejecución vivos
- [`agent-ops/reports/`](agent-ops/reports/) — reportes de verificación
- [`agent-ops/reports/reviews/`](agent-ops/reports/reviews/) — informes de revisión y de cierre
  de ola ([`review-full-2026-10-19.md`](agent-ops/reports/reviews/review-full-2026-10-19.md),
  [`remediation-wave1-2026-10-19.md`](agent-ops/reports/reviews/remediation-wave1-2026-10-19.md))
- [`agent-ops/plans/2026-10-19-remediation-wave1/`](agent-ops/plans/2026-10-19-remediation-wave1/)
  — plan, `VERDICT.md` y handoffs de la ola 1 de remediación

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
- [`guia-mvp.md`](product/guia-mvp.md) - guía canónica del MVP (caso de uso ancla)

**Architecture**

- [`arquitectura-unificada.md`](architecture/arquitectura-unificada.md) — **Doctrina Rectora**
  (Ego, VantaDB, Hermes, OpenClaw)
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
- [`navigation-sidebar.md`](architecture/navigation-sidebar.md) — spec del panel lateral (Rail 54px / Drawer 260px)
- [`ui-iframe-sandbox-spec.md`](architecture/ui-iframe-sandbox-spec.md) - spec de aislamiento de iframes del Canvas

**Engineering**

- [`stack-tecnico.md`](engineering/stack-tecnico.md)
- [`lenguajes.md`](engineering/lenguajes.md)
- [`integraciones.md`](engineering/integraciones.md)
- [`vantadb-readiness-plan.md`](engineering/vantadb-readiness-plan.md)
- [`testing-e2e.md`](engineering/testing-e2e.md)

**Operations**

- [`despliegue.md`](operations/despliegue.md) - ⚠️ deprecated, ver `deployment/distribution.md`
- [`snapshots-respaldo.md`](operations/snapshots-respaldo.md)

**Testing**

- [`estrategia.md`](testing/estrategia.md)
- [`check-docs-paths.mjs`](testing/check-docs-paths.mjs) - verificador de enlaces y rutas citadas en `docs/`

**Roadmap**

- [`Backlog.md`](roadmap/Backlog.md) - **fuente canónica del estado de tareas** (151 canónicas + 17 `EGO-FIND`)
- [`roadmap.md`](roadmap/roadmap.md) — las 12 fases y Golden Paths
  (el estado por tarea vive en `Backlog.md`)
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
- [`VANTADB-FEEDBACK-Y-MEJORAS.md`](VANTADB-FEEDBACK-Y-MEJORAS.md) — **registro canónico** de
  hallazgos y workarounds de VantaDB (taxonomía `VDB-BUG/INC/REQ`)

**Prompts**

- [`prompts/README.md`](prompts/README.md)
- [`prompts/system-prompt-template.md`](prompts/system-prompt-template.md)
- [`prompts/ego-example.md`](prompts/ego-example.md)
- [`prompts/CHANGELOG.md`](prompts/CHANGELOG.md)

**Review & Auditoría**

- [`review/README.md`](review/README.md)
- [`review/backlog-hermes.md`](review/backlog-hermes.md)
- [`review/backlog-openclaw.md`](review/backlog-openclaw.md)
- [`review/backlog-coucou.md`](review/backlog-coucou.md)
- [`review/backlog-khoj.md`](review/backlog-khoj.md)
- [`review/backlog-helmor.md`](review/backlog-helmor.md)
- [`review/backlog-career-ops.md`](review/backlog-career-ops.md)
- [`review/backlog-deepseek-harness.md`](review/backlog-deepseek-harness.md)

**Research**

- [`research/README.md`](research/README.md) — hub de investigación (incluye el documento
  maestro externo **no normativo**: recomienda Tauri/daemon/omnicanal → descartado por ADR-0011)
- [`research/arquitectura-master-matrix.md`](research/arquitectura-master-matrix.md)
  — **matriz de contraste** de las 22 secciones del documento maestro vs. el código de Ego
- [`research/hermes-agent-deep-dive.md`](research/hermes-agent-deep-dive.md)
- [`research/openclaw-deep-dive.md`](research/openclaw-deep-dive.md)
- [`research/coucou-deep-dive.md`](research/coucou-deep-dive.md)
- [`research/character-audit-and-coucou-inventory.md`](research/character-audit-and-coucou-inventory.md)

**Extracciones de Repositorios**

- [`extractions/README.md`](extractions/README.md)
- [`extractions/hermes-agent.md`](extractions/hermes-agent.md)
- [`extractions/openclaw.md`](extractions/openclaw.md)
- [`extractions/coucou.md`](extractions/coucou.md)
- [`extractions/khoj.md`](extractions/khoj.md)
- [`extractions/helmor.md`](extractions/helmor.md)
- [`extractions/career-ops.md`](extractions/career-ops.md)
- [`extractions/deepseek-harness.md`](extractions/deepseek-harness.md)

**Paquetes del monorepo** (código, no docs)

- `packages/avatar/` — motor de personaje `@ego/avatar` (Web Component `<ego-avatar>`, Robot Studio).
  Ver `packages/avatar/README.md` y `packages/avatar/DESIGN.md`.
- `packages/memory/` · `packages/knowledge/` · `packages/runtime/` · `packages/models/`
- `packages/decision/` · `packages/execution/` · `packages/events/` · `packages/security/`
- `packages/tool-call-repair/`
- `packages/tools/` · `packages/subegos/` · `packages/tasks/` · `packages/domains/`
- `packages/dailystate/` · `packages/recovery/` · `packages/ui-runtime/` · `packages/integrations/`

## Mapa Diátaxis (guía de usuario)

| Documento | Tipo Diátaxis | Qué responde |
|---|---|---|
| `user/getting-started.md` | tutorial | "Llévame de la mano en mi primer outcome" |
| `user/configuration.md` | how-to | "¿Cómo conecto mi modelo" |
| `user/troubleshooting.md` | how-to | "¿Cómo resuelvo este síntoma" |
| `user/concepts.md` | explanation | "¿Por qué Ego funciona así" |
| `user/faq.md` | reference | "Respuesta corta a una pregunta concreta" |
| `user/changelog.md` | reference | "¿Qué cambió y desde cuándo" |

Cada documento de `user/` declara su tipo en el front-matter `diataxis:`.
Referencia del sistema: [Diátaxis](https://diataxis.fr/) (verificada 2026-10-16, HTTP 200).

## Regla de gobierno de documentos

1. La **jerarquía canónica** ([`jerarquia-canonica.md`](jerarquia-canonica.md)) establece la precedencia
   entre decisiones de producto, capacidades, arquitectura, diseño e implementación.
2. Los **principios innegociables** ([`principios-innegociables.md`](product/principios-innegociables.md))
   definen las 10 propiedades fundamentales del sistema.
3. Todo cambio en arquitectura y plan debe reflejarse primero en la documentación antes de modificar código crítico.
4. La documentación PRD original y archivos legacy fueron eliminados del repositorio
   (no se versionaron nunca en este repo; las decisiones P1-P25 viven en `Preguntas y respuestas.txt`).
   Las decisiones vigentes son las derivadas de las preguntas Q1-Q25.
5. **El estado de las tareas vive en [`roadmap/Backlog.md`](roadmap/Backlog.md)**.
   `roadmap/roadmap.md` describe las fases; si los dos discrepan, manda el Backlog.
6. Toda decisión de arquitectura con coste de reversión se registra como ADR en `docs/adr/`
   con la plantilla común (contexto · decisión · alternativas · consecuencias).
7. Verificación automática: `node docs/testing/check-docs-paths.mjs`
   (0 enlaces rotos, 0 rutas inexistentes en docs canónicos).
