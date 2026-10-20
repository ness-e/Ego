# Producto y desarrollo como empresa — estado del arte para Ego #

| Campo | Valor |
|---|---|
| Estado | Activo — investigación técnica de referencia (no normativo) |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Ámbito | Gestión de producto, especificación, roadmap, calidad, CI/CD, entrega y operación |
| Verificación | API pública de GitHub (`api.github.com`), sin autenticación; snapshot del 2026-10-20 |
| Naturaleza | Material de referencia. Lo que gobierna el producto sigue siendo [`docs/jerarquia-canonica.md`](../jerarquia-canonica.md), [`docs/product/principios-innegociables.md`](../product/principios-innegociables.md) y los [ADRs](../adr/README.md) |

---

## 1. Resumen ejecutivo (TL;DR) ##

1. Ego **ya es** una empresa de software con la estructura (`Backlog` de 13 fases, ADRs, design system,
   6 workflows de CI, CODEOWNERS, PR template, changelog con SemVer). El Backlog Maestro es canónico y no se
   sustituye: este informe propone **mejoras y complementos**, no un reemplazo.
2. El estado del arte del spec-driven development se ha **polarizado**: dos patrones dominantes —
   `spec-kit` (artefactos tipo GitHub Issues, 142 012 estrellas, MIT) y `OpenSpec` (delta-semántica sobre
   `openspec/`, 72 476 estrellas, MIT) — y un tercer actor propietario, **AWS Kiro** (`requirements.md` /
   `design.md` / `tasks.md`, sin licencia OSS verificable).
3. La brecha más clara de Ego no es de herramientas sino de **artefacto intermedio**: existe `Backlog.md` y
   existen ADR, pero **no existe una "feature spec" por trabajo** con criterios de aceptación verificables.
4. Segunda brecha: **no hay trazabilidad spec → código → test**. `ProjectMemoryGraph` (`KB-11`) construye el
   grafo, pero no hay contrato que obligue a que una spec enlace sus tareas canónicas.
5. Tercera brecha: **el pipeline de entrega es asíncrono y manual** — `release-please` abre el PR de release, la
   publicación, la firma y la notarización siguen siendo pasos humanos bloqueados (`DIST-04`, `DIST-06`).
6. El modelo de Linear (no OSS: teams → cycles → projects → initiatives → views, con triage y SLA) es el mejor
   modelo de producto **por donde mirar**, pero su equivalente OSS más próximo es `Plane`, que es AGPL-3.0.
7. La disciplina de código **más transferible y barata** es `google/eng-practices` (CC BY 3.0, 23 281 estrellas,
   **repo archivado**): CLs pequeños, un revisor, "code review" como habilidad enseñable. Encaja de forma natural
   con Sub-Egos revisores.
8. Los agentes ya tienen una taxonomía de "empresa" (`MetaGPT`: `Code = SOP(Team)`, roles PM/Arquitecto/PM/Ingeniero/QA).
   La contribución verificable es la **SOP codificada en artefactos**, no el chat entre agentes.
9. En calidad, los gates que Ego **no** tiene y son baratos: cobertura como gate, *mutation testing*, *property-based
   testing*, fuzzing y escaneo SAST/SCA dentro del CI (hoy hay audit de dependencias y lint, no análisis de código).
10. **Copyleft a vigilar para el modelo Apache 2.0 de Ego**: `Plane` (AGPL-3.0), `Plausible` (AGPL-3.0),
    `Unleash` (AGPL-3.0), `OpenPanel` (AGPL-3.0), `Renovate` (AGPL-3.0), `Grafana` (AGPL-3.0), `OpenProject` (GPL-3.0),
    `Netdata` (GPL-3.0), `Redmine` (GPL-2.0), `Semgrep` (LGPL-2.1), `PlantUML` (GPL-3.0), `SonarQube` (LGPL-3.0),
    `Hypothesis`/`d2`/`Taiga` (MPL-2.0), `Sentry` (FSL-1.1 → Apache 2.0 a 2 años).
11. Recomendación de cabeza: **un artefacto `spec` por feature** (`docs/specs/<ID>-<slug>/spec.md`) con criterios de
    aceptación, más un **gate de trazabilidad** que enlace spec ↔ tarea canónica ↔ test ↔ ADR. Esfuerzo estimado 2-3 días.
12. Segundo: **promover la cobertura a gate y añadir mutation testing** solo cuando el grafo de tests se
    estabilice. Tercero: **plantillas de sub-Ego** que implementen los roles PM / Arquitecto / QA / Redactor.
13. Riesgo principal: **duplicar el Backlog Maestro**. Mitigación: la spec es un *complemento* de la tarea canónica
    (`CORE-xx`), no un sistema paralelo. Regla de desempate: [`docs/jerarquia-canonica.md`](../jerarquia-canonica.md).

---

## 2. Metodología ##

### 2.1 Criterios de inclusión ##

Un proyecto entra en el corpus si cumple **al menos uno** de estos criterios:

| Criterio | Justificación para Ego |
|---|---|
| C1 — Codifica un proceso de gestión (spec, roadmap, revisión, release, incidente) | Es lo que se busca: un patrón, no una librería |
| C2 — Es la referencia de facto del ecosistema para ese proceso | Si el estándar de facto no se conoce, no se puede judgear |
| C3 — Ofrece un modelo de datos o un esquema reutilizable por Sub-Egos | Solo importa si el Sub-Ego puede ejecutarlo |
| C4 — Tiene licencia compatible o mecanismo de adaptación viable | Copyleft fuerte no es prohibitive si se usa como proceso, no como código |

Excluidos: repositorios de acciones de plantilla sin proceso, forks sin diferenciación y SaaS comerciales sin
documentación pública suficiente.

### 2.2 Procedimiento de verificación ##

- **Estrellas, licencia y fecha de último push**: leídos de la API pública de GitHub
  (`GET api.github.com/search/repositories` y `GET api.github.com/repos/<owner>/<repo>`), sin autenticación.
  Todas las cifras de este informe son un **snapshot del 2026-10-20** y se marcaron con el sufijo
  `NOASSERTION` cuando la API no devolvió SPDX.
- **Licencias ambiguas** (`NOASSERTION`) se resolvieron leyendo el fichero `LICENSE`/`COPYING` en `raw.githubusercontent.com`.
  Ejemplos: `redmine/redmine` → GPL-2.0 (`doc/COPYING:2`), `python/mypy` → MIT (`LICENSE:1`),
  `google/eng-practices` → CC BY 3.0 (`LICENSE:3`), `getsentry/sentry` → Functional Source License 1.1 (`LICENSE.md:1`).
- **Evidencia a nivel de fichero**: los mecanismos citados se leyeron en el repositorio de origen y se referencian
  como `ruta:línea` del proyecto **fuente** (p. ej. `templates/spec-template.md:90` en `github/spec-kit`).
- **No OSS**: los productos propietarios (Kiro, Linear, Jira, GitHub Projects) se analizan **solo desde su
  documentación pública oficial** (`kiro.dev/docs`, `linear.app/docs`) y se etiquetan como no verificables por API.

### 2.3 Limitaciones ##

- Sin token de GitHub, la API no autenticada limita a 10 peticiones/minuto (search) y 60/hora (core); algunas
  consultas se repitieron y otras quedaron sin cerrar.
- **La auditoría del 2026-10-20 reconsultó los 90 repos de este informe con la API autenticada**, corrigió
  las cifras y resolvió todas las licencias `NOASSERTION` salvo las cuatro que siguen sin SPDX. El detalle está
  en la sección final «Verificación de datos».
- Cinco proyectos **no pudieron verificarse** (404 en la API y en `raw`): `github/secure-coding-guidelines`,
  `google/go-snapshot`, `tessl-ai/tessl`, `awslabs/spec-toolkit`, `graphite-dev/graphite`. Se marcan
  **"no verificado"** y no se les atribuye cifra de estrellas.
- Los números de estrellas no son calidad: miden atención, no madurez. `Mergifyio/mergify` (339 estrellas, sin push
  desde 2023-09-07) y `OpenBMB/ChatDev` (34 556) son outliers que ilustran el problema.

---

## 3. Estado del arte por área ##

### 3.1 Spec-driven development ###

| Proyecto | Stars | Licencia | Qué resuelve | Veredicto Ego |
|---|---:|---|---|---|
| [github/spec-kit](https://github.com/github/spec-kit) | 142 012 | MIT | Spec → plan → tasks con constitution gate | **Adoptar el patrón, no la herramienta** |
| [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec) | 72 476 | MIT | Deltas semánticos ADDED/MODIFIED/REMOVED sobre `openspec/` | **Adoptar el patrón delta** |
| AWS Kiro (no OSS) | no verificado | propietario | `requirements.md` / `design.md` / `tasks.md` + hooks + steering | **Referencia de diseño; no integrable** |
| Tessl (no verificado) | no verificado | no verificado | Specs ejecutables en Haskell/TypeScript | **Descartar hasta verificar** |
| `awslabs/spec-toolkit` (no verificado) | no verificado | no verificado | Toolkit de spec-driven | **Descartar (no existe)** |
| [cucumber/gherkin](https://github.com/cucumber/gherkin) | 418 | MIT | Lenguaje Gherkin (Given/When/Then) legible por negocio | **Adoptar solo como formato de criterios de aceptación** |
| [cucumber/common](https://github.com/cucumber/common) (antes `cucumber/cucumber`) | 3 353 | MIT |coordinate de incidencias comunes entre repos | **Sin valor propio** |
| [OAI/OpenAPI-Specification](https://github.com/OAI/OpenAPI-Specification) | 31 266 | Apache-2.0 | Contrato HTTP de APIs | **Mantener** (ya cubierto por MCP + Zod) |
| [asyncapi/spec](https://github.com/asyncapi/spec) | 5 323 | Apache-2.0 | Contrato de eventos asíncronos | **Útil para el EventBus de Ego** |
| [json-schema-org/json-schema-spec](https://github.com/json-schema-org/json-schema-spec) | 5 186 | sin SPDX | Esquema JSON canónico | **Mantener** (Zod ya es el runtime) |
| [adr/madr](https://github.com/adr/madr) | 2 570 | sin SPDX | Plantilla ADR minimalista | **Adoptar plantilla** |
| [thomvaill/log4brains](https://github.com/thomvaill/log4brains) | 1 603 | Apache-2.0 | ADR + brainstorm + notas de decisión | **Adoptar el ciclo brainstorm→ADR** |
| [rust-lang/rfcs](https://github.com/rust-lang/rfcs) | 6 613 | MIT / Apache-2.0 (dual) | Proceso RFC con revisores asignados | **Referencia de proceso** |
| [python/peps](https://github.com/python/peps) | 5 027 | sin SPDX | PEPs con estado y revisores | **Referencia de proceso** |
| [structurizr/structurizr](https://github.com/structurizr/structurizr) | 480 | Apache-2.0 | C4 como código (DSL) | **Descartar: C4 es nivel 5, Ego ya tiene Mermaid** |
| [d2lang/d2](https://github.com/d2lang/d2) (antes `terrastruct/d2`) | 25 681 | MPL-2.0 | Diagramas como código, DSL declarativo | **Evaluar** (MPL file-level, compatible) |
| [mermaid-js/mermaid](https://github.com/mermaid-js/mermaid) | 90 766 | MIT | Diagramas desde texto, render en renderer | **Mantener** (ya en el catálogo Canvas) |
| [plantuml/plantuml](https://github.com/plantuml/plantuml) | 13 375 | GPL-3.0 | Diagramas UML desde texto | **Descartar** (GPL, heavyweight Java) |

#### Fichas de spec-driven ####

- **github/spec-kit** — El ciclo más blindado de "spec antes de código": genera `spec.md` (user stories con prioridad
  P1/P2/P3, `templates/spec-template.md:26,41`), `plan.md` (con *Constitution Check* como **gate** en
  `templates/plan-template.md:39-41`) y `tasks.md` (fases, `templates/tasks-template.md:48,58`). La constitución
  (`.specify/memory/constitution.md:42,73`) es lo más portable: convierte "calidad" en una lista de artículos
  verificables, con *Test-Backed Change* marcado **NON-NEGOTIABLE**. Los requisitos usan IDs estables
  (`FR-001…FR-004`, `templates/spec-template.md:90-93`), que son la clave para la trazabilidad.
- **Fission-AI/OpenSpec** — Modelo de **delta sobre una spec viva**: los cambios viven en
  `openspec/changes/<id>/` y se archivan en `openspec/changes/archive/<fecha>-<id>/` (`README.md:54,69-70`).
  El formato de requisito es `## ADDED Requirements` → `### Requirement:` → `#### Scenario:`
  (`README.md:80,82,86`), muy próximo al formato Given/When/Then. `openspec/config.yaml:1` fija
  `schema: spec-driven` y `openspec/config.yaml:8-12` impone escribir en **lenguaje de producto**, no de
  implementación: es exactamente la separación Capability/Implementation de la jerarquía canónica de Ego.
- **AWS Kiro** — Documentación oficial (`kiro.dev/docs/specs`): toda spec genera tres ficheros
  (`requirements.md`, `design.md`, `tasks.md`), con flujo de tres fases y **puertas de aprobación** entre ellas;
  soporta workflow Requirements-First o Design-First, `Quick Spec` sin puertas, **ejecución paralela** de tareas
  independientes (grafo de dependencias), y `steering files` (`~/.kiro/steering/`, `.kiro/steering/`) como
  reglas persistentes del proyecto. Añade **hooks** disparados por evento (guardar fichero, crear fichero,
  abrir commit) que ejecutan linter, tests y escaneo de seguridad. Es el diseño más completo, pero es propietario:
  **el valor está en el patrón, no en la dependencia**.
- **cucumber/gherkin** — El estándar de facto para que un criterio de aceptación sea legible por negocio.
  `README.md:376` documenta `Given <x>` y `README.md:384` `Given <m>` (multi-línea); `README.md:523` cubre
  reportes y stack traces. En Ego sirve para la sección "criterios de aceptación" de una spec, no como motor.
- **adr/madr** y **thomvaill/log4brains** — El ADR de Ego (`docs/adr/README.md:19-21`, ciclo
  `PROPOSED → ACCEPTED → SUPERSEDED | DEPRECATED`) ya es **más estricto** que MADR. El aporte de `log4brains`
  es el paso previo: *brainstorm* documentado antes de la decisión (`README.md:25`).
- **rust-lang/rfcs** y **python/peps** — Proceso canónico: un revisor asignado, un estado explícito, una decisión
  por documento, y los documentos aceptados **no se editan** (se sustituyen). `rust-lang/rfcs/README.md:5`
  describe el objetivo: *"a consistent... design process and produce a consensus"*. Este patrón ya está en
  `docs/adr/README.md:19-21`; lo que falta en Ego es el equivalente para *features*, no para *decisiones*.
- **asyncapi/spec** — Relevante porque el `EventBus` de Ego (`packages/events/src/EventBus.ts`, tarea `ACT-05`)
  es un bus de eventos con contrato semántico. Un esquema AsyncAPI podría ser la forma de **verificar** que un
  evento nuevo no rompe a un consumidor, algo que hoy no existe.

### 3.2 Gestión de producto y roadmap ###

| Proyecto | Stars | Licencia | Qué resuelve | Veredicto Ego |
|---|---:|---|---|---|
| [makeplane/plane](https://github.com/makeplane/plane) | 61 155 | AGPL-3.0 | Issues + módulos + ciclos + releases | **Referencia de datos; código no integrable** |
| [opf/openproject](https://github.com/opf/openproject) | 16 494 | GPL-3.0 | Project management con Gantt/wiki | **Referencia conceptual** |
| [redmine/redmine](https://github.com/redmine/redmine) | 6 050 | GPL-2.0 | Tracker clásico con wiki y plugins | **Descartar: modelo pesado** |
| [taigaio/taiga-back](https://github.com/taigaio/taiga-back) | 859 | MPL-2.0 | Agile ligero + API | **Descartar** |
| Linear (no OSS) | no verificado | propietario | Teams → cycles → projects → initiatives → views | **Modelo a imitar, no a integrar** |
| Jira (no OSS) | no verificado | propietario | Tracker corporativo | **Descartar** |
| GitHub Projects (no OSS) | no verificado | propietario | Tableros dentro del repo | **Descartar** |
| [plausible/analytics](https://github.com/plausible/analytics) | 29 566 | AGPL-3.0 | Analítica privacy-first self-hosted | **Evaluar para telemetría local** |
| [PostHog/posthog](https://github.com/PostHog/posthog) | 40 357 | MIT + dirs EE | Analítica + feature flags + replay | **Referencia conceptual** |
| [umami-software/umami](https://github.com/umami-software/umami) | 39 480 | MIT | Analítica web minimalista | **Descartar** |
| [Openpanel-dev/openpanel](https://github.com/Openpanel-dev/openpanel) | 7 170 | AGPL-3.0 | Analítica + perfiles + eventos | **Descartar (AGPL)** |
| [growthbook/growthbook](https://github.com/growthbook/growthbook) | 8 513 | MIT + dirs EE | Feature flags con experiments | **Patrón de flags: sí** |
| [Unleash/unleash](https://github.com/Unleash/unleash) | 13 886 | AGPL-3.0 | Feature flags con estrategias de activación | **Referencia de estrategia** |
| [Flagsmith/flagsmith](https://github.com/Flagsmith/flagsmith) | 6 603 | BSD-3-Clause | Flags + remote config | **Referencia de SDK** |
| [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) | 134 228 | MIT | Pizarra colaborativa como formato de decisión | **Útil como superficie Canvas** |

#### Fichas de producto y roadmap ####

- **makeplane/plane** — El tracker OSS más cercano a Linear. `preview/README.md:53` documenta los **Cycles**
  (ritmo de entrega) y `preview/README.md:56-57` los **Modules** ("divide proyectos complejos en módulos
  manejables"). El modelo de datos es lo interesante: *workspace → proyecto → módulo → ciclo → issue*, con
  releases automáticas. **AGPL-3.0** (`preview/LICENSE.txt:1`) ⇒ no integrable en Ego (Apache 2.0); usable solo
  como referencia de modelo.
- **Linear (no OSS)** — Documentación oficial (`linear.app/docs/conceptual-model`): *issues* son la unidad de
  trabajo; los **teams** son la unidad organizativa y definen sus propios *workflow statuses*, *cycles* y
  *labels*; los **cycles** son el periodo de planificación con auto-rolado; los **projects** agrupan issues en torno
  a un entregable; las **initiatives** organizan projects; las **views** son filtros guardados. Encima,
  **Triage** es una bandeja de entrada con reglas e inteligencia (`linear.app/docs/triage`) y las
  **Customer Requests** (`linear.app/docs/linear-for-growth`) convierte feedback de clientes en issues con
  identificador de cliente. **Este es el modelo de producto más completo del informe** y el que mejor casa con
  la estructura de fases/compuertas de Ego: *team* ≈ *dominio funcional*, *cycle* ≈ *fase del Backlog*,
  *project* ≈ *feature*, *initiative* ≈ *épica de producto*.
- **Jira** — Descartado: modelo de configuración por proyecto con workflows custom, incompatible con la
  filosofía de "sub-Egos configurables" y con la regla de primitivas de librería de `AGENTS.md` (D3).
- **PostHog** — `README.md:27` lo define como "your product's context layer" que ingiere *analytics, errors,
  replays y business metrics*; `README.md:49` añade feature flags para "roll out features to select users".
  `LICENSE:7` y `LICENSE:11` delimitan: el contenido **fuera** de los directorios restringidos es MIT, los
  directorios Enterprise tienen licencia propia. El patrón útil para Ego es el **flag por Sub-Ego**:
  enables/deshabilita capacidades sin redeploy.
- **GrowthBook** — `LICENSE:5-6` excluye `packages/back-end/src/enterprise`; el resto es MIT (`LICENSE:10,12`).
  Su aportación a Ego es el modelo de **experimento con exposición gradual**, útil para el estado
  `SPECIFIED → IMPLEMENTED → INTEGRATED → VERIFIED` de `AGENTS.md` §4: un flag por etapa permite desplegar
  la capacidad sin activarla.
- **Unleash** — `README.md:20-22`: "Feature flags in Unleash let you test your code with real production data",
  15 estrategias de activación; `README.md:184` documenta *additional strategy constraints*. AGPL-3.0 ⇒ no
  integrable; el modelo de estrategias es lo copiable.
- **Flagsmith** — `README.md:11` y `README.md:15`: plataforma de feature flags + remote config. BSD-3-Clause,
  **la licencia más permisiva del área de flags** y la única compatible por import directo.
- **Plausible / OpenPanel / Umami** — Analítica. AGPL-3.0 para Plausible y OpenPanel; Umami es MIT pero mucho
  menos capaz. **Veredicto**: Ego no necesita un tracker web; necesita **telemetría local de uso de Sub-Egos**
  (tokens, coste, latencia), que ya existe en `DS-05` (`packages/dailystate/src/` MetricsConsole) y `DEC-08`.
  Lo que falta es la **retención histórica con cohortes**, que es lo que aporta PostHog/Umami.

### 3.3 Gestión de código, CI/CD y automatización ###

| Proyecto | Stars | Licencia | Qué resuelve | Veredicto Ego |
|---|---:|---|---|---|
| [go-gitea/gitea](https://github.com/go-gitea/gitea) | 58 582 | MIT | Forge self-hosted (issues + PR + CI + paquetes) | **Descartar: Ego no aloja repos** |
| Forgejo (en Codeberg, no GitHub) | 5 681 | GPL-3.0 | Forge ligero, descendiente de Gitea | **Descartar** |
| [gitlabhq/gitlabhq](https://github.com/gitlabhq/gitlabhq) | 24 552 | MIT (núcleo) + `ee/` comercial; API `NOASSERTION` | Forge + CI + registry + issues | **Descartar** |
| [woodpecker-ci/woodpecker](https://github.com/woodpecker-ci/woodpecker) | 8 022 | Apache-2.0 | CI ligera sobre contenedores | **Evaluar si Ego aloja CI** |
| [harness/harness](https://github.com/harness/harness) (antes `drone/drone`) | 38 611 | Apache-2.0 | CI con pipelines declarativos | **Descartar** |
| [concourse/concourse](https://github.com/concourse/concourse) | 7 924 | Apache-2.0 | CI con recursos explícitos | **Referencia conceptual** |
| [tektoncd/pipeline](https://github.com/tektoncd/pipeline) | 9 086 | Apache-2.0 | CI como CRDs de Kubernetes | **Descartar** |
| [argoproj/argo-workflows](https://github.com/argoproj/argo-workflows) | 17 043 | Apache-2.0 | Orquestación de workflows | **Descartar** |
| [argoproj/argo-cd](https://github.com/argoproj/argo-cd) | 24 440 | Apache-2.0 | GitOps declarativo | **Descartar (ego es desktop)** |
| [fluxcd/flux2](https://github.com/fluxcd/flux2) | 8 452 | Apache-2.0 | GitOps continuo | **Descartar** |
| [renovatebot/renovate](https://github.com/renovatebot/renovate) | 22 807 | AGPL-3.0 | Actualización de dependencias | **Descartar el motor; sí la disciplina** |
| [semgrep/semgrep](https://github.com/semgrep/semgrep) | 17 141 | LGPL-2.1 | SAST con reglas | **Evaluar (integración CLI, sin dependencia)** |
| [aquasecurity/trivy](https://github.com/aquasecurity/trivy) | 38 535 | Apache-2.0 | SCA + SBOM + secretos | **Adoptar como CLI en CI** |
| [anchore/grype](https://github.com/anchore/grype) | 13 055 | Apache-2.0 | SCA sobre SBOM e imágenes | **Alternativa a Trivy** |
| [github/codeql](https://github.com/github/codeql) | 10 215 | MIT | SAST semántico profundo | **Descartar: motor pesado y propietario del host** |
| [SonarSource/sonarqube](https://github.com/SonarSource/sonarqube) | 11 092 | LGPL-3.0 | Quality gate de código | **Descartar: servidor Java** |
| [reviewdog/reviewdog](https://github.com/reviewdog/reviewdog) | 9 678 | MIT | Linters como anotaciones de PR | **Adoptar el patrón** |
| [danger/danger](https://github.com/danger/danger) | 5 695 | MIT |DSL de reglas de PR | **Evaluar** |
| [pre-commit/pre-commit](https://github.com/pre-commit/pre-commit) | 15 644 | MIT | Hooks multi-lenguaje | **Descartar (Ego es TS puro)** |
| [astral-sh/ruff](https://github.com/astral-sh/ruff) | 50 171 | MIT | Linter/formatter de Python, nativo en Rust | **Descartar (Ego es TS)** |
| [astral-sh/ty](https://github.com/astral-sh/ty) | 19 894 | MIT | Type checker de Python | **Descartar** |
| [biomejs/biome](https://github.com/biomejs/biome) | 25 980 | MIT / Apache-2.0 (dual) | Linter + formatter de JS/TS | **Evaluar como alternativa a oxlint** |
| [python/mypy](https://github.com/python/mypy) | 20 691 | MIT | Type checker de Python | **Descartar** |
| [sqlc-dev/sqlc](https://github.com/sqlc-dev/sqlc) | 18 395 | MIT | SQL tipado desde Go | **Descartar** |
| [dbt-labs/dbt](https://github.com/dbt-labs/dbt) | 14 046 | Apache-2.0 | Transformaciones SQL con tests y docs | **Descartar** |

#### Fichas de CI/CD ####

- **woodpecker-ci/woodpecker** — CI declarativa sobre contenedores, mucho más ligera que GitLab/Jenkins.
  Apache-2.0. Para Ego el valor es conceptual: **un pipeline mínimo, rápido y legible**, que es lo contrario del
  `ci.yml` actual de Ego (561 líneas, 8 jobs) — ver §7.
- **drone/drone → harness/harness** — El repo `drone/drone` fue renombrado a `harness/harness` y su
  `README.md:27` titula la sección *"Where is Drone?"* (`README.md:29`: *"Harness Open Source represents a
  massive investment in the next generation of Drone"*). Drone se ha **replegado dentro de Harness Open
  Source**. Es un caso de utilez: un proyecto CI de referencia puede ser absorbido. Motivo adicional para no
  depender de un único CI OSS.
- **renovatebot/renovate** — 22 807 estrellas pero **AGPL-3.0**: no integrable. Su valor para Ego es la
  *disciplina*, no el motor: el repo ya usa `dependabot.yml` (`.github/dependabot.yml`) y ya tiene
  `scripts/audit-security.mjs` como gate bloqueante (`.github/workflows/ci.yml:126-162`). La tarea `DIST-09`
  (pin de VantaDB y cadencia de bump) es exactamente un problema de este tipo.
- **semgrep/semgrep** — LGPL-2.1, **17 141 estrellas**. Motor escrito en OCaml, se invoca como CLI. No exige
  dependencia de runtime en el repo de Ego: puede vivir en el CI como acción. Hoy Ego no tiene **ningún**
  análisis estático de código más allá de `oxlint` (7 reglas `deny` + typecheck). Es la brecha de calidad más
  grande y barata de cerrar.
- **aquasecurity/trivy** — `README.md:14-15`: "comprehensive and versatile security scanner… scanners where you
  can find those issues". Apache-2.0. Cubre SCA, misconfiguration y secretos: encaja directamente con el gate
  `security` que Ego ya tiene (`ci.yml:126`) pero que hoy solo audita dependencias pnpm.
- **anchore/grype** — `README.md:7` y `README.md:24`: escáner de vulnerabilidades para imágenes, filesystems y
  **SBOM**. Apache-2.0. Complementario: Trivy genera el SBOM, Grype lo consume.
- **SonarSource/sonarqube** — LGPL-3.0, requiere servidor Java. Descartado para un equipo de una persona.
- **reviewdog/reviewdog** — `README.md:84-86` lista los *reporters* (`local` por defecto, `github-pr-check`,
  `github-pr-review`, `gitlab-code-quality`, `checkstyle`…). MIT. **El patrón es lo valioso**: ejecutar un linter
  externo y *anotar el PR* en lugar de fallar el build. Para Ego, con `CODEOWNERS` ya definido
  (`.github/CODEOWNERS:1-27`), un `reviewdog` sobre `oxlint`/`ty` daría comentarios en el PR sin añadir un
  servidOR.
- **danger/danger** — `README.md:20` ("What is Danger?"), `README.md:28` ("For example?"): un DSL en Ruby que
  define reglas de PR (tamaño, etiquetas, changelog, cobertura). Es la pieza que le falta al PR template de Ego:
  hoy `.github/PULL_REQUEST_TEMPLATE.md` es una lista de casillas manual (líneas 15-38) que **nadie puede
  verificar automáticamente**.
- **biomejs/biome** — MIT/Apache-2.0 (dual), 25 980 estrellas, linter + formatter de JS/TS en un solo binario Rust. Ego usa
  `oxlint` 1.87.0 (`package.json:65`) con `--max-warnings 320` (`package.json:19`), es decir, **320 warnings
  tolerados**. Biome es un competidor directo, pero migrar no es urgente: `oxlint` ya está en verde.
- **pre-commit** — MIT, 15 644 estrellas, pero es un framework de hooks multi-lenguaje para un repo con muchos
  lenguajes. Ego es TypeScript puro con `lint-staged` ya configurado (`package.json:41-43`). **Descartar.**

### 3.4 Testing automatizado ###

| Proyecto | Stars | Licencia | Qué resuelve | Veredicto Ego |
|---|---:|---|---|---|
| [pytest-dev/pytest](https://github.com/pytest-dev/pytest) | 14 613 | MIT | Runner de tests Python | **Referencia conceptual (fixtures, parametrize)** |
| [coveragepy/coveragepy](https://github.com/coveragepy/coveragepy) | 3 422 | Apache-2.0 | Medición de cobertura | **Referencia; en Ego ya hay vitest-coverage** |
| [boxed/mutmut](https://github.com/boxed/mutmut) | 1 494 | BSD-3-Clause | Mutation testing | **Evaluar para el núcleo crítico** |
| [stryker-mutator/stryker-js](https://github.com/stryker-mutator/stryker-js) | 3 253 | Apache-2.0 | Mutation testing para JS/TS | **Adoptar si el núcleo es estable** |
| [HypothesisWorks/hypothesis](https://github.com/HypothesisWorks/hypothesis) | 9 094 | MPL-2.0 | Property-based testing | **Adoptar (equivalente TS disponible)** |
| [google/atheris](https://github.com/google/atheris) | 1 689 | Apache-2.0 | Fuzzing coverage-guided de Python | **Referencia conceptual** |
| [schemathesis/schemathesis](https://github.com/schemathesis/schemathesis) | 3 681 | MIT | Property-based testing sobre OpenAPI | **Adoptar para el MCP Server de Ego** |
| [google/go-cmp](https://github.com/google/go-cmp) | 4 680 | BSD-3-Clause | Comparación de valores en tests | **Referencia conceptual** |

#### Fichas de testing ####

- **stryker-mutator/stryker-js** — Apache-2.0, mutation testing nativo de JavaScript/TypeScript: muta el código y
  verifica que los tests **detectan** la mutación. Es el mecanismo que distingue "cobertura" de "calidad". Para
  Ego, el objetivo natural es `packages/security/` y `packages/execution/` (lógica de permisos y cuotas), donde
  un test superficial pasa aunque el código sea incorrecto. Coste: el runner es lento ⇒ sólo sobre un subconjunto.
- **HypothesisWorks/hypothesis** — MPL-2.0 (`LICENSE.txt:4`), property-based testing: en vez de 5 casos fijos,
  genera cientos y busca el contraejemplo mínimo. En TS el equivalente es `fast-check`, con licencia MIT. Para
  Ego el caso de uso natural es el **ApprovalEngine** (`packages/execution/src/ApprovalEngine.ts`), donde la
  property "toda acción sensible sin aprobación no se ejecuta" es difícil de comprobar con ejemplos fijos.
- **schemathesis** — MIT, 3 681 estrellas: genera casos de prueba **desde un esquema OpenAPI** y valida que la
  implementación cumple el contrato. Ego tiene un MCP Server (`packages/integrations/src/mcp/McpServer.ts`,
  tarea `EGO-FIND-46`) cuya superficie `tools/list` es un contrato: aplicarle property-based testing es la forma
  barata de probar que el servidor cumple su propio esquema.
- **google/atheris** — `README.md:1`: "Atheris is a coverage-guided, native Python fuzzer"; `README.md:3`:
  soporta fuzzing de Python y de código nativo; `README.md:17`: las wheels traen **libFuzzer** integrado.
  En TS el equivalente es `@jazzer.js` (Apache-2.0). El caso de uso de Ego es **el parser de `SECURITY.md` /
  `SecretsFilter` y el saneador de contenido no confiable** (`packages/memory/UntrustedContentSanitizer.ts`),
  que procesa entrada adversarial.
- **pytest / coverage.py / go-cmp** — Listas por su forma, no por su código: *fixtures* y *parametrize*
  (pytest), medición de cobertura con línea de base (coverage.py) y **comparación con mensajes de diff
  legibles** (go-cmp). Los tres son patrones que Vitest ya ofrece en TS.

### 3.5 Revisión de código y proceso de merge ###

| Proyecto | Stars | Licencia | Qué resuelve | Veredicto Ego |
|---|---:|---|---|---|
| [google/eng-practices](https://github.com/google/eng-practices) | 23 281 | CC BY 3.0 | Guía de code review y CLs pequeños (**repo archivado**) | **Adoptar el proceso** |
| `github/secure-coding-guidelines` | no verificado | no verificado | Guías de secure coding por lenguaje | **Descartar (no verificable)** |
| [ossf/scorecard](https://github.com/ossf/scorecard) | 5 769 | Apache-2.0 | Scorecard de salud de seguridad del repo | **Adoptar el checklist, no la CI** |
| [Mergifyio/mergify](https://github.com/Mergifyio/mergify) | 339 | Apache-2.0 | Queue de merge y automaciones | **Descartar (estancado, 2023-09-07)** |
| `graphite-dev/graphite` | no verificado | propietario | CLI de stacks de PR | **Descartar** |

#### Fichas de revisión y merge ####

- **google/eng-practices** — CC BY 3.0 (`LICENSE:3` "Attribution 3.0 Unported"). `review/developer/index.md:1`
  titula el documento *"The CL author's guide to getting through code review"* y `README.md:11` enlaza la guía
  **Small CLs** (`review/index.md`). El valor para Ego no es el documento: es el **modelo de rol**. Google define
  revisor como *habilidad enseñable*, con guía de revisor, guía de autor y checklist. Un Sub-Ego revisor de Ego no
  debería *inventar* criterio: debería seguir una guía canónica versionada, exactamente como los Sub-Egos siguen
  `SubEgoManifest`. Nota: el repo está **archivado** (sin commits desde 2024-09).
- **ossf/scorecard** — Apache-2.0, `README.md:15` "Overview" y `README.md:33` "Checks".
  `docs/checks.md` enumera los checks con su sección exacta: `docs/checks.md:57` **Branch-Protection**,
  `:480` **Pinned-Dependencies**, `:525` el requisito de *pinnear dependencias de workflows por hash*,
  `:628` **Signed-Releases**, `:659` **Token-Permissions**. Ego ya cumple varios: *actions pinned by SHA*
  (`ci.yml:25,29,33`), `permissions: contents: read` por defecto (`ci.yml:15-16`), Dependabot, y
  `verify-ci-triggers.mjs` (`ci.yml:86-89`). Los que **no** cumple: *branch protection* (depende de GitHub, no del
  repo), *signed releases* (bloqueado por `DIST-04`) y *token permissions* por job (hoy uniforme).
- **Mergifyio/mergify** — 339 estrellas y **sin push desde 2023-09-07**: muerto en la práctica aunque la licencia
  sea Apache-2.0. Se incluye como advertencia: *stars bajo + licencia permisiva ≠ proyecto sano*.
- **DCO / `Signed-off-by`** — Sin repositorio propio verificable: es una práctica del propio `git`
  (`git interpret-trailers`, `Signed-off-by:`) documentada en la documentación de Git y en `kernel.org`.
  Para Ego es **imprescindible** y ya está implícito: el `commit-msg` job (`ci.yml:527-561`) valida
  Conventional Commits con `commitlint`, pero **no** valida `Signed-off-by`. Es un gate de 3 líneas.

### 3.6 Changelog y releases ###

| Proyecto | Stars | Licencia | Qué resuelve | Veredicto Ego |
|---|---:|---|---|---|
| [googleapis/release-please](https://github.com/googleapis/release-please) | 7 641 | Apache-2.0 | PR de release + changelog + versionado desde Conventional Commits | **Mantener (ya en uso)** |
| [conventional-changelog/conventional-changelog](https://github.com/conventional-changelog/conventional-changelog) | 8 521 | ISC | Motor de changelog por preset | **Referencia** |
| [conventional-changelog/standard-version](https://github.com/conventional-changelog/standard-version) | 7 986 | ISC | Versionado + changelog en un comando | **Descartar: ya hay release-please** |
| [semantic-release/semantic-release](https://github.com/semantic-release/semantic-release) | 24 115 | MIT | Release fully automatic con plugins | **Descartar: publicación automática no deseada** |
| [changesets/changesets](https://github.com/changesets/changesets) | 12 495 | MIT | Versionado por paquete con changelog propio | **Descartar: Ego es monorepo de un producto** |
| [orhun/git-cliff](https://github.com/orhun/git-cliff) | 12 307 | MIT / Apache-2.0 (dual) | Changelog desde Conventional Commits, con TUI | **Evaluar para el changelog local** |
| [cookpete/auto-changelog](https://github.com/cookpete/auto-changelog) | 1 404 | MIT | Changelog automático por historial | **Descartar** |
| [goreleaser/goreleaser](https://github.com/goreleaser/goreleaser) | 16 105 | MIT | Empaquetado y publicación multi-OS | **Descartar: Ego usa electron-builder** |
| [crate-ci/cargo-release](https://github.com/crate-ci/cargo-release) | 1 593 | MIT / Apache-2.0 (dual) | Release de crates Rust | **Descartar** |
| [release-drafter/release-drafter](https://github.com/release-drafter/release-drafter) | 3 948 | ISC | Genera el cuerpo del PR de release | **Evaluar** |

#### Fichas de changelog y releases ####

- **googleapis/release-please** — Ya está en Ego: `.github/workflows/release-please.yml:20` usa la action y
  `release-please-config.json` declara `release-type: node`, `include-v-in-tag: true`,
  `changelog-type: github` y `packages: {".": {changelog-path: "CHANGELOG.md"}}`.
  El motor de estrategia vive en `src/strategies/base.ts`: `base.ts:58` `bumpMinorPreMajor?`,
  `base.ts:83` `extraFiles?` (permite tocar `package.json` y `apps/desktop/package.json` en el mismo commit),
  `base.ts:26` `DefaultChangelogNotes` (secciones por tipo de commit).
  La configuración documenta `docs/manifest-releaser.md:175` (`"bump-minor-pre-major": true`),
  `docs/manifest-releaser.md:244` (`"separate-pull-requests": false`) y `docs/manifest-releaser.md:364` el
  *tagName* por componente. **Lección para Ego**: `release-please` abre un PR y **no publica**
  (`release-please.yml:3-4`, `:24`) ⇒ el humano es el gate de publicación. Ese es exactamente el modelo que
  Ego necesita mientras `DIST-04` (firma) siga bloqueado.
- **orhun/git-cliff** — Apache-2.0. `cliff.toml:8` define la sección `[changelog]`, `cliff.toml:97` los *commit
  parsers* regex, `cliff.toml:125` el `tag_pattern = "v[0-9].*"` y `cliff.toml:89` los *preprocessors*.
  Ventaja sobre `release-please` para Ego: es **local y offline**, genera el changelog desde el historial sin
  tocar GitHub, y por tanto puede ejecutarse **dentro de la app** por un Sub-Ego.
- **semantic-release** — MIT, 24 115 estrellas: el más popular, y el más peligroso para Ego. Publica
  automáticamente. El diseño de Ego —`release-please` abre PR, un humano mergea— es **deliberadamente más
  seguro**: en un producto de escritorio firmado, publicar sin humano es un incidente.
- **changesets** — MIT, modelo de *changeset* por paquete. Para un monorepo con 18 paquetes podría tener sentido,
  pero Ego publica **un solo producto**; un único changelog es más simple y ya existe (`CHANGELOG.md:1`).
- **release-drafter** — ISC, 3 948 estrellas: genera el cuerpo del PR de release con las PRs agrupadas.
  Complementario de `release-please`, pero `release-please` ya genera el changelog.
- **goreleaser / cargo-release** — Goreleaser (MIT, 16 105) empaqueta binarios Go multi-OS; `cargo-release`
  (Apache-2.0) hace crates Rust. Ego empaqueta con `electron-builder`
  (`apps/desktop/electron-builder.config.cjs`, tarea `DIST-01`/`DIST-03`), luego **descartar**.

### 3.7 Empresa de software con agentes ###

| Proyecto | Stars | Licencia | Qué resuelve | Veredicto Ego |
|---|---:|---|---|---|
| [FoundationAgents/MetaGPT](https://github.com/FoundationAgents/MetaGPT) | 70 932 | MIT | `Code = SOP(Team)`: roles PM/Arquitecto/PM/Ingeniero/QA | **Adoptar el modelo de roles y SOP** |
| [OpenBMB/ChatDev](https://github.com/OpenBMB/ChatDev) | 34 556 | Apache-2.0 | Cadena waterfall de agentes (ChatChain) | **Referencia conceptual** |
| [AntonOsika/gpt-engineer](https://github.com/AntonOsika/gpt-engineer) | 55 022 | MIT | Agente único que construye una app | **Descartar (abandonado 2025-05-14)** |
| [SWE-agent/SWE-agent](https://github.com/SWE-agent/SWE-agent) | 20 600 | MIT | ACI: interfaz agente-computador para resolver issues | **Adoptar el patrón de ACI** |
| [Aider-AI/aider](https://github.com/Aider-AI/aider) | 49 652 | Apache-2.0 | Pair programming con repo map y edición de tests | **Referencia** |
| [OpenHands/OpenHands](https://github.com/OpenHands/OpenHands) | 91 343 | MIT | Runtime de agentes de código con sandbox | **Referencia** |
| [tyrellshawn/bolt.diy](https://github.com/tyrellshawn/bolt.diy) | 263 | MIT | Generador de apps web en el navegador | **Descartar** |
| [continuedev/continue](https://github.com/continuedev/continue) | 36 271 | Apache-2.0 | IDE assistant con config declarativa | **Referencia** |
| [cline/cline](https://github.com/cline/cline) | 70 587 | Apache-2.0 | Agente con modos y auto-approve | **Referencia** |
| [RooCodeInc/Roo-Code](https://github.com/RooCodeInc/Roo-Code) | 24 276 | Apache-2.0 | Fork de Cline con modos por dominio | **Referencia** |
| [Kilo-Org/kilocode](https://github.com/Kilo-Org/kilocode) | 27 662 | MIT | Orquestación multi-agente | **Referencia** |
| [anomalyco/opencode](https://github.com/anomalyco/opencode) | 218 221 | MIT | Motor de sesión de agentes con permisos y code mode | **Ya es referencia interna de Ego** |
| [anthropics/claude-code](https://github.com/anthropics/claude-code) | 152 812 | sin SPDX (`LICENSE.md` de Anthropic) | Agente CLI con skills y hooks | **Adoptar el patrón de hooks/skills** |

#### Fichas de agentes ####

- **FoundationAgents/MetaGPT** — MIT, 70 932 estrellas (sin push desde 2026-01-21). La tesis del paper
  (arXiv 2308.00352) es que **los SOP se codifican en prompts**, no en chatting libre: `README.md:43-44`
  ("product managers / architects / project managers / engineers… `Code = SOP(Team)`"). El código lo confirma:
  `metagpt/roles/product_manager.py:21` define `class ProductManager(RoleZero)` y `product_manager.py:46`
  engancha la cadena con `self._watch([UserRequirement, PrepareDocuments])` — es decir, **el flujo es un grafo de
  eventos, no una conversación**. `metagpt/actions/write_prd.py:76` define `class WritePRD(Action)`.
  **Para Ego esto es casi un mapa**: Product Manager ≈ Sub-Ego de Producto (`DOM-02`), Architect ≈ Sub-Ego de
  Ingeniería (`DOM-01`), QA Engineer ≈ Sub-Ego de QA (**no existe todavía**), y el "PM" ≈ Sub-Ego de
  coordinación (`packages/subegos/src/DelegationRouter.ts`). Lo transferible es el **patrón watch/Action**: cada
  Sub-Ego reacciona a un artefacto publicado, no a un turno de chat.
- **SWE-agent** — MIT, 20 600 estrellas. Su contribution central es el **ACI** (Agent-Computer Interface), citada
  en `README.md:105`: en lugar de un prompt libre, se diseña una interfaz de comandos optimizada para el agente
  (observaciones estructuradas, presupuesto de pasos, salida parseable). Para Ego, el equivalente es el
  **contrato de salida de tool** (`packages/tools/src/ToolContract.ts`, `EGO-FIND-45`): una tool que devuelve
  texto libre es una tool que el Sub-Ego no puede usar de forma fiable.
- **OpenHands** — MIT, 91 343 estrellas. Su `README.md:10` describe hoy un *"self-hosted developer control center
  for coding agents"* que puede ejecutar "OpenHands, Claude Code, Codex, Gemini, Pi, OpenCode, or any
  ACP-compatible agent" sobre un runtime local o remoto, con `OH_CONVERSATION_RUNTIME=docker` para el sandbox
  (`README.md:117`). La idea decisiva para Ego es el **protocolo de interoperabilidad entre agentes** (ACP): un
  Sub-Ego de Ego debería poder invocar otro agente externo con un contrato estable.
- **OpenBMB/ChatDev** — Apache-2.0, 34 556 estrellas. Modela el ciclo waterfall de una empresa (ChatChain:
  análisis → diseño → codificación → revisión → test). Su valor es haber **explícito las fases**; su debilidad,
  el acoplamiento fuerte a un único rol.
- **AntonOsika/gpt-engineer** — MIT, 55 022 estrellas pero **sin push desde 2025-05-14**: es el archetype de
  "muchas estrellas, proyecto muerto". La lección para Ego: la salud de un proyecto se mide por el push, no por
  las estrellas. En el informe se marca la fecha de push de cada repositorio precisamente por esto.
- **cline / Roo-Code / Kilo-Code** — Apache-2.0, Apache-2.0 y MIT. El patrón común es **modos por dominio**
  (Roo: un modo por tarea y por subproyecto; Kilo: orquestación multi-agente) y **auto-approve granular**.
  Para Ego: un Sub-Ego con permisos (`SubEgoManifest.permissions`) es el equivalente de un modo con su propio
  auto-approve, y ya está implementado (`packages/subegos/src/SubEgoManifest.ts`, tarea `SUB-01`).
- **anthropics/claude-code** — 152 812 estrellas; no hay `LICENSE` en la ruta `main/LICENSE`, pero **sí** existe un
  `LICENSE.md` propio de Anthropic (© Anthropic PBC, sujeto a sus términos comerciales), por lo que la API tampoco
  devuelve SPDX: licencia **propietaria, verificada**. El patrón transferible son los **hooks** (disparados por
  evento: guardar fichero, abrir commit) y las **skills** (carpetas con `SKILL.md`): el hook "al abrir un commit,
  genera el mensaje a partir del diff de la spec" es el equivalente del paso 8 del pipeline de §5.

### 3.8 Observabilidad y operación ###

| Proyecto | Stars | Licencia | Qué resuelve | Veredicto Ego |
|---|---:|---|---|---|
| [getsentry/sentry](https://github.com/getsentry/sentry) | 45 610 | FSL-1.1 → Apache-2.0 | Tracking de errores con releases y trazas | **Evaluar; licencia a vigilar** |
| [burke-software/GlitchTip](https://github.com/burke-software/GlitchTip) | 193 | MIT | Alternativa self-hosted a Sentry | **Evaluar** |
| [grafana/grafana](https://github.com/grafana/grafana) | 77 397 | AGPL-3.0 | Dashboards y observabilidad | **Descartar (AGPL + servidor)** |
| [grafana/loki](https://github.com/grafana/loki) | 29 045 | AGPL-3.0 | Logs indexados | **Descartar** |
| [grafana/tempo](https://github.com/grafana/tempo) | 5 539 | AGPL-3.0 | Trazas distribuidas | **Descartar** |
| [prometheus/prometheus](https://github.com/prometheus/prometheus) | 66 665 | Apache-2.0 | Métricas y alerting | **Referencia conceptual** |
| [open-telemetry/opentelemetry-collector](https://github.com/open-telemetry/opentelemetry-collector) | 7 677 | Apache-2.0 | Normalización de telemetría | **Referencia conceptual** |
| [louislam/uptime-kuma](https://github.com/louislam/uptime-kuma) | 92 661 | MIT | Monitorización de disponibilidad | **Descartar (es servidor)** |
| [netdata/netdata](https://github.com/netdata/netdata) | 81 053 | GPL-3.0 | Monitorización de sistema | **Descartar (GPL)** |
| [henrygd/beszel](https://github.com/henrygd/beszel) | 26 359 | MIT | Monitoring ligero de infraestructura | **Descartar** |

#### Fichas de observabilidad ####

- **getsentry/sentry** — 45 610 estrellas. **Licencia a vigilar**: `LICENSE.md:1` es *"Functional Source License,
  Version 1.1, Apache 2.0 Future License"* y `LICENSE.md:90-92` dice que a partir del **segundo aniversario**
  pasa a Apache 2.0. No es copyleft y no bloquea, pero **no es Apache 2.0 hoy**: Ego (Apache 2.0) podría
  incrustarlo sólo bajo esas condiciones. `GlitchTip` (MIT, 193 estrellas) es la alternativa con licencia limpia.
- **prometheus/prometheus** — Apache-2.0, 66 665 estrellas. `README.md:21` define el proyecto CNCF;
  `README.md:36` "Architecture overview". Su aportación a Ego no es el servidor sino el **modelo de métrica**
  (nombre, labels, HELP/TYPE) y el modelo pull-based. Ego ya tiene `DEC-08` (telemetría p99) y `REC-07`
  (logging rotativo), pero **no** tiene un modelo de métrica etiquetado.
- **open-telemetry/opentelemetry-collector** — Apache-2.0, 7 677 estrellas. Relevantísimo para Ego: el
  `EventBus` (`packages/events/src/EventBus.ts`) emite `EgoEvent` ya tipado; un collector OTel daría **vendor
  neutrality** y trazabilidad distribuida (Renderer → Main → Sub-Ego → Tool). Pero introducir OTel en el bundle
  de Electron es una decisión de nivel 4 (arquitectura) y debe pasar por ADR.
- **netdata / grafana / uptime-kuma / beszel** — Todos son **servidores de observabilidad de infraestructura**.
  Ego es una app desktop: el "servidor de observabilidad" de Ego es el propio `EgoMemoryAdapter` con sus
  namespaces `metrics/*` y `gov/audit`. Copiar Grafana a un desktop de una persona es sobreingeniería
  (principio 1 de `docs/product/principios-innegociables.md`: local-first).

---

## 4. Comparativa con el Backlog Maestro de Ego ##

| Capacidad de gestión de producto | ¿Lo tiene ya Ego? (fichero:línea) | ¿Lo tiene mejor otro proyecto? | ¿Merece la pena? | Veredicto |
|---|---|---|---|---|
| Catálogo canónico de trabajo | `docs/roadmap/Backlog.md:15-16` (esquema de 10 columnas), `:22-37` (13 fases) | Plane, Linear | **No** — el Backlog es canónico | **Mantener** sin cambios |
| Compuertas de calidad por fase | `docs/roadmap/Backlog.md:128-133` (protocolo Opción B) | Kiro (puertas entre fases de spec) | **Sí** — falta cerrar la compuerta de *spec* | **Complementar** con una compuerta de spec |
| Decisiones de arquitectura (ADR) | `docs/adr/README.md:27-55` (19 ADR), ciclo `:19-21` | MADR, log4brains, RFCs de Rust | **No** — Ego ya es más estricto | **Mantener**; añadir el paso de *brainstorm* |
| Especificación por feature | **No existe** (no hay `docs/specs/`) | spec-kit, OpenSpec, Kiro | **Sí** — brecha principal | **Crear** `docs/specs/<ID>/` |
| Criterios de aceptación ejecutables | `docs/testing/estrategia.md:12-42` (pirámide), `:76-80` (gates P0) | Gherkin, Schemathesis | **Sí** | **Crear** sección de criterios por spec |
| Trazabilidad spec → código → test | `packages/knowledge/src/ProjectMemoryGraph.ts` (`KB-11`, `Backlog.md:383`) | OSSF Scorecard, Danger | **Sí** — el grafo existe, el contrato no | **Añadir aristas obligatorias** |
| Roadmap por fases y prioridades | `docs/roadmap/roadmap.md:17-209`, `docs/roadmap/metricas-okr.md` | Linear (roadmaps, initiatives) | **Parcialmente** — falta vista de roadmap | **Complementar** con vista de roadmap |
| Priorización automática | `packages/dailystate/src/GoalPrioritizer.ts` (`DS-04`, `Backlog.md:441`) | Linear (triage, SLA) | **Sí** — el mecanismo existe | **Añadir reglas de triage** |
| Gestión de incidencias | `.github/ISSUE_TEMPLATE/bug.yml`, `feature.yml` | Plane, Redmine | **No** | **Mantener** |
| Revisión de código por owners | `.github/CODEOWNERS:1-27` | eng-practices, Danger | **Sí** — plantilla sin verificación | **Añadir reglas automáticas** |
| Plantilla de PR y checklist de guardrails | `.github/PULL_REQUEST_TEMPLATE.md:15-38` | Danger, reviewdog | **Sí** — hoy es manual | **Automatizar** con Danger o reviewdog |
| Commit convencional | `.github/workflows/ci.yml:527-561` (job `commit-msg`), `commitlint.config.mjs` | conventional-changelog | **Sí** — falta `Signed-off-by` | **Añadir** DCO |
| Changelog y versionado | `CHANGELOG.md:1-46`, `release-please-config.json`, `.github/workflows/release-please.yml:20` | git-cliff, semantic-release | **No** — ya resuelto | **Mantener**; opción local con git-cliff |
| Publicación de la release | `release-please.yml:3-4,24` (abre PR, no publica) | goreleaser, semantic-release | **No** — el humano es el gate correcto | **Mantener** |
| Firma y notarización | `Backlog.md:558` (`DIST-04`, pendiente, BLOQUEO owner) | — | **Sí**, pero depende del owner | **Escalar al owner** |
| CI: lint + typecheck + test + build | `.github/workflows/ci.yml:19-124` (job `verify`) | Woodpecker, Concourse | **No** | **Mantener** |
| CI: auditoría de dependencias | `ci.yml:126-162` + `scripts/audit-security.mjs` | Trivy, Grype, OSV | **Sí** — no cubre SAST ni secretos | **Añadir Trivy/Semgrep** |
| CI: SBOM y provenance | **No existe** | Trivy, Grype, Syft, SLSA | **Parcialmente** | **Evaluar** |
| CI: cobertura como gate | `.github/workflows/coverage.yml:9` (**informativo**, `continue-on-error`) | coverage.py, Stryker | **Sí** | **Promover a gate con umbral** |
| Tests de contrato y E2E | `docs/testing/estrategia.md:39-55`, `tests/e2e/`, `tests/gui/` | Playwright, Schemathesis | **Sí** — falta property-based | **Añadir fast-check** |
| Mutación de tests | **No existe** | Stryker, mutmut | **Sí** (núcleo crítico) | **Evaluar** sobre `packages/security/` |
| Observabilidad y errores | `packages/recovery/src/DiagnosticsLogger.ts` (`REC-07`), `packages/decision/src/Telemetry.ts` (`DEC-08`) | Sentry, GlitchTip, OTel | **Sí** — falta OTel y releases | **Evaluar** |
| Sistema de incidencias en runtime | `packages/subegos/src/SelfImprovementLoop.ts` (`SUB-12`), `packages/events/src/EventBus.ts` (`ACT-05`) | — | **Sí** — falta postmortem | **Añadir** postmortem estructurado |
| Gestión de flags y despliegue gradual | **No existe** | GrowthBook, Unleash, Flagsmith | **Sí** — útil para `SPECIFIED→VERIFIED` | **Añadir** flags por etapa |
| Seguridad del proceso de entrega | `.github/CODEOWNERS:1-27`, `ci.yml:15-16` (`least privilege`), `ci.yml:25` (SHAs pineados) | OSSF Scorecard | **Sí** — falta signed releases | **Añadir** checklist Scorecard |
| Analítica de uso | `DS-05` (`Backlog.md:442`) | PostHog, Umami, Plausible | **Parcialmente** — falta cohorte | **Complementar** con retención |
| Worktrees para desarrollo paralelo | `packages/domains/src/engineering/WorktreeManager.ts` (`DOM-01`, `Backlog.md:464`), `packages/subegos/src/SubEgoWorktree.ts` (`SUB-07`) | vibe-kanban, hermes-agent | **No** — ya implementado | **Mantener** |

**Lectura de la tabla.** De 29 capacidades, **Ego ya tiene 12** resueltas de forma canónica, **7 están
parcialmente cubiertas** y **10 no existen**. Ninguna de las 10 huecos justifica tocar el Backlog Maestro:
todas son *complementos transversales* (spec, trazabilidad, gates de calidad, flags, postmortem) que se apoyan
en el Backlog pero no lo sustituyen.

---

## 5. Ciclo de vida de una feature con agentes ##

Pipeline propuesto para Ego, con el Sub-Ego responsable y el gate humano. Cada fila supone que la tarea canónica
del Backlog ya existe: la spec **no** reemplaza a la tarea, la **acota**.

| # | Paso | Quién lo ejecuta | Artefacto resultante | Gate humano |
|---:|---|---|---|---|
| 1 | Idea y encaje | **Humano** (owner) en el chat | Entrada en `docs/roadmap/Backlog.md` (tarea canónica con ID) | **Sí** — aprueba la entrada en el Backlog |
| 2 | Compuerta de extracción | Sub-Ego de dominance (`docs/extractions/*.md`) | Fila en la matriz de compuertas de la fase | No (automático) |
| 3 | Spec | Sub-Ego de Producto (`DOM-02`) | `docs/specs/<ID>-<slug>/spec.md` con FR-xxx, criterios Given/When/Then y no-objetivos | **Sí** — aprueba alcance y criterios |
| 4 | Diseño técnico | Sub-Ego de Ingeniería (`DOM-01`) | Sección de diseño en el mismo `spec.md` + ADR si hay decisión arquitectónica | **Sí** solo si hay ADR nuevo |
| 5 | Plan y desglose | Sub-Ego de Ingeniería + `GoalPrioritizer` (`DS-04`) | Tareas atomicas en el Backlog, enlazadas a los FR-xxx | No |
| 6 | Implementación | Sub-Ego implementador (aislado en worktree) | Diff en rama + tests | No (gate automático) |
| 7 | Revisión | Sub-Ego revisor siguiendo `google/eng-practices` | Comentarios de revisión; `CODEOWNERS` exige owner en rutas sensibles | **Sí** si toca `packages/security/`, `packages/memory/` o CI |
| 8 | Tests y gates | CI (`ci.yml:19-124`) + Sub-Ego QA | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, cobertura | No si todo verde |
| 9 | Changelog | `release-please` (job local) o `git-cliff` local | Sección en `CHANGELOG.md` (`Keep a Changelog`, `CHANGELOG.md:1-6`) | No |
| 10 | Release PR y tag | `release-please.yml:20` (abre PR) + humano | PR de release; tag `vX.Y.Z` | **Sí** — merge del PR de release |
| 11 | Firma y publicación | `scripts/release/sign.mjs` (bloqueado, `DIST-04`) | Instalador firmado | **Sí** — BLOQUEO owner |
| 12 | Seguimiento y postmortem | `DailyStateEngine` (`DS-01`) + `EventBus` | Métricas de la feature y, si hubo incidente, postmortem | **Sí** si hubo incidente |

### Reglas de oro del pipeline ###

1. **Un humano, tres gates**: entrada en el Backlog (1), aprobación de la spec (3) y merge del release (10).
   Todo lo demás es automatizable.
2. **Ningún Sub-Ego puede abrir una tarea en el Backlog sin pasar el gate 1**: la escritura en
   `docs/roadmap/Backlog.md` es una acción sensible y debe pasar por `ApprovalEngine` (`ACT-06`), igual que
   cualquier escritura fuera del sandbox.
3. **La spec es más corta que la tarea**: si la spec no cabe en una página, la feature está mal delimitada.
   Es el mismo criterio de "Small CLs" de `google/eng-practices` (`review/developer/index.md:10`) aplicado a
   producto.
4. **Revisión cruzada obligatoria**: el Sub-Ego que implementa no puede ser el que revisa. La plantilla de PR ya
   lo pide (`.github/PULL_REQUEST_TEMPLATE.md:37`: *"Reviewed by an agent/human different from the author"*);
   falta automatizarlo.
5. **El seguimiento no es un dashboard, es un contrato**: cada feature que se lanza debe poder responder
   "los FR-xxx se cumplen y el test X lo demuestra".

---

## 6. Spec-driven en Ego: encaje con fases y compuertas ##

### 6.1 Principio de no duplicación ##

El Backlog Maestro es la **fuente única de verdad** (`docs/roadmap/Backlog.md:12`). La spec **no** es un backlog
paralelo: es el **contrato de aceptación** de una tarea canónica. Regla de desempate:
[`docs/jerarquia-canonica.md`](../jerarquia-canonica.md) — la spec describe *Capability* (nivel 3) y el Backlog
describe *Implementation* (nivel 10); cuando discrepen, gana la spec en alcance y el Backlog en secuencia.

### 6.2 Artefactos propuestos ##

```text
docs/specs/
  <ID-CANONICA>-<slug>/
    spec.md        → requisitos FR-xxx, criterios de aceptación, no-objetivos
    design.md      → diseño técnico (opcional; si hay decisión, referencia un ADR)
    evidence.md    → trazabilidad: FR-xxx → tarea → fichero → test → ADR
```

El nombre de carpeta lleva el **ID canónico del Backlog** (`CORE-11`, `ACT-04`, `KB-07`): es la clave de
trazabilidad que hoy no existe y que `ProjectMemoryGraph` (`KB-11`) puede consumir.

### 6.3 Encaje con la Regla de Progresión Estricta por Fases ##

`AGENTS.md` §6 obliga a completar la fase actual al 100 % antes de abrir la siguiente. La spec **no cambia esa
regla**: la refuerza, porque convierte "tarea completada" en "tarea completada *y* criterio de aceptación
demostrado". Concretamente:

| Punto del sistema actual | Qué aporta la spec | Nivel canónico |
|---|---|---|
| Matriz de compuertas por fase (`Backlog.md:128-133`) | Una compuerta nueva: *la tarea no se marca Completada sin su `evidence.md` firmado* | 9 · Roadmap |
| Regla de finalización (`Backlog.md:14`) | Los criterios de aceptación pasan de "PRUEBA FUNCIONAL PASA" a "FR-xxx demostrado por un test concreto" | 9 · Roadmap |
| DoD de `AGENTS.md` §4 | El `evidence.md` es la prueba objetiva de que no hay feature a medio hacer | 3 · Capability |
| `docs/adr/README.md:19-21` | La spec referencia ADRs por ID; un cambio de diseño que invalida la spec requiere ADR nuevo | 4 · Architecture |
| `docs/roadmap/Backlog.md:22-37` | La columna "Archivo:línea" del esquema de 10 columnas pasa a apuntar también a `evidence.md` | 10 · Implementation |

### 6.4 Qué patrón tomar de cada proyecto (y qué no) ##

| De | Tomar | No tomar |
|---|---|---|
| `github/spec-kit` | La **constitución** como lista de artículos verificables y el **gate de constitution check** antes de la fase 0 (`.specify/memory/constitution.md:42,73`; `templates/plan-template.md:39-41`) | El CLI y sus plantillas literales: adaptar 4 plantillas al Markdown canónico de Ego es trabajo infinito |
| `github/spec-kit` | Los **IDs estables** `FR-001` (`templates/spec-template.md:90-93`) | El branch-per-feature obligatorio (`scripts/powershell/create-new-feature.ps1:6,17`) |
| `Fission-AI/OpenSpec` | El **delta** sobre spec viva (`openspec/changes/<id>/` → `archive/<fecha>-<id>/`, `README.md:54,69-70`) y el formato `Requirement`/`Scenario` (`README.md:80,82,86`) | La CLI y el `config.yaml` de stack (`openspec/config.yaml:1-19`): el contexto de Ego ya está en `AGENTS.md` |
| AWS Kiro | Los **tres ficheros** (`requirements.md`/`design.md`/`tasks.md`), el **Steering** por proyecto y los **hooks** por evento | La dependencia propietaria y el IDE |
| `google/eng-practices` | **Revisión como habilidad enseñable**: guía de revisor + guía de autor + checklist | El contenido literal (CC BY 3.0 exige atribución; **es texto de Google, no de Ego**) |
| `rust-lang/rfcs` / `python/peps` | El **estado explícito** y el principio de "un documento aceptado no se edita" | El volumen de proceso (incompatible con un equipo de una persona) |

---

## 7. Mecanismos de calidad ##

| Mecanismo | Herramientas de referencia | ¿Lo tiene Ego? | Brecha | Prioridad |
|---|---|---|---|---|
| Lint + typecheck + test + build en push | Woodpecker, Concourse | Sí — `ci.yml:19-124` (job `verify`) | Ninguna | — |
| Commits convencionales | commitlint | Sí — `ci.yml:527-561` | Falta `Signed-off-by` (DCO) | **P0** (3 líneas) |
| Auditoría de dependencias bloqueante | Trivy, Grype, OSV | Sí — `ci.yml:126-162` + `scripts/audit-security.mjs` | No cubre SAST ni secretos | **P0** |
| SAST de código | Semgrep, CodeQL, SonarQube | **No** (solo `oxlint` con 7 reglas `deny` y 320 warnings tolerados, `package.json:19`) | Sin análisis de patrones inseguros | **P1** |
| SBOM y provenance | Trivy, Syft, SLSA | **No** | Sin inventario de dependencias firmado | **P1** (Fase 12) |
| Cobertura como gate | coverage.py, Vitest coverage | **No** — `coverage.yml:9` es `continue-on-error: true` | Sin umbral bloqueante | **P1** |
| Mutation testing | Stryker, mutmut | **No** | Los tests pueden pasar sin detectar el error | **P2** (núcleo crítico) |
| Property-based testing | Hypothesis, Schemathesis, fast-check | **No** | Propiedades críticas solo con ejemplos fijos | **P1** |
| Fuzzing | Atheris, Jazzer.js, libFuzzer | **No** | Entrada adversarial no probada | **P2** |
| Tests de contrato de API/MCP | Schemathesis, Pact | Parcial — hay suite MCP de 8 tests (`docs/testing/estrategia.md:46-55`) | No se valida contra el esquema | **P1** |
| Lint de docs y enlaces rotos | markdownlint, Lychee, VitePress | Sí — `docs-lint.yml:17,43,57` | Gate con línea base (permitido) | — |
| Revisión por owners | CODEOWNERS, eng-practices | Sí — `.github/CODEOWNERS:1-27` | Sin regla automática (Danger/reviewdog) | **P1** |
| Checklist de PR verificable | Danger, reviewdog | Parcial — `PULL_REQUEST_TEMPLATE.md:15-38` es manual | Las casillas no se validan | **P1** |
| Health scorecard del repo | OSSF Scorecard | Parcial (SHAs, least privilege, Dependabot) | Sin signed releases ni permisos por job | **P2** |
| Trazabilidad requisito→test | Scorecard, Danger, `ProjectMemoryGraph` | Parcial — el grafo existe (`KB-11`) | Sin contrato verificable | **P0** |
| Versionado y changelog | release-please, git-cliff | Sí — `release-please.yml:20`, `CHANGELOG.md:1` | Sin opción local/offline | **P2** |
| Publicación firmada | goreleaser, SLSA | **No** — `DIST-04` bloqueado por owner | Sin firma | **P0 (owner)** |
| Feature flags por etapa | GrowthBook, Unleash, Flagsmith | **No** | Sin despliegue gradual ni kill-switch | **P1** |
| Observabilidad con trazas | OpenTelemetry, Sentry, GlitchTip | Parcial — `DEC-08` telemetría, `REC-07` logs | Sin spans ni correlación distribuida | **P2** |
| Postmortem estructurado | Sentry (issues), RunRecorder de Coucou (`COUC-09`) | **No** | Sin registro forense de incidentes | **P1** |

---

## 8. Trade-offs y riesgos ##

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---:|---|---|---|---|
| R1 | **Duplicar el Backlog Maestro** con un segundo sistema de tareas | Alta | Crítico | Regla dura: la spec cuelga del ID canónico y **no** tiene estado propio; `docs/jerarquia-canonica.md` como desempate |
| R2 | **Proceso sin evidencia**: specs que se escriben y no se cumplen | Alta | Alto | `evidence.md` obligatorio y gate en la compuerta; sin `evidence.md`, la tarea no pasa a `✅ Completada` |
| R3 | **Coste de proceso** desproporcionado para un equipo de una persona | Media | Alto | Regla de la spec de una página; los artefactos opcionales (`design.md`) solo cuando hay decisión arquitectónica |
| R4 | **Copyleft por dependencia accidental** (AGPL/GPL) | Media | Crítico (viola Apache 2.0) | Lista negra viva en el informe; ninguna dependencia runtime de código AGPL/GPL en el bundle |
| R5 | **Importar un monolito de tooling**: Plane, Grafana, GitLab | Media | Medio | Regla de primitivas (D3): solo se usa lo que no tiene equivalente en `ui-kit/` o en las librerías ya instaladas |
| R6 | **Burocratizar el ciclo del agente**: el Sub-Ego escribe specs en vez de código | Media | Medio | El paso 3 es el más barato de todos; si una spec no produce una tarea más precisa, no se escribe |
| R7 | **Cobertura como gate demasiado pronto** ⇒ CI rojo y ritmo roto | Media | Medio | Mantener `coverage.yml` informativo hasta superar el umbral; promover con `--fail-on-regression` primero |
| R8 | **Dependencia de un único CI OSS** (caso Drone→Gitness) | Baja | Medio | Los gates de Ego son scripts locales (`scripts/*.mjs`) invocables desde cualquier runner |
| R9 | **Falsos verdes**: la spec se cumple pero el test no prueba el criterio | Media | Alto | Property-based testing (P1) y mutation testing (P2) sobre el núcleo; `evidence.md` exige *test id* concreto |
| R10 | **Fuga de un token a la cadena de suministro** (scripts de release) | Baja | Crítico | `permissions: contents: read` por defecto (`ci.yml:15-16`); el job de release es el único con escritura y **no** publica |
| R11 | **Índice de terceros como fuente de verdad**: los proyectos cambian de licencia o mueren | Media | Medio | Este informe lleva fecha de último push por proyecto; revalidar antes de adoptar |
| R12 | **Ego como "empresa" sin dueño**: un Sub-Ego optimiza su propio KPI | Media | Alto | `ApprovalEngine` (`ACT-06`) y `gov/audit` (`SEC-06`) obligan a que toda acción sensible tenga responsable identificado |

---

## 9. Recomendación para Ego ##

Orden de incorporación. Los tres primeros son **mejoras del sistema de gestión existente**; ninguno toca el Backlog
Maestro ni introduce una dependencia nueva.

| # | Acción | Fundamento | Esfuerzo | Depende de |
|---:|---|---|---|---|
| 1 | **Gate de `Signed-off-by`** en el job `commit-msg` | El `commitlint` ya valida el formato (`ci.yml:527-561`); falta la trazabilidad de autoría. Es el único hueco DCO de todo el corpus OSS | 2-4 h | — |
| 2 | **Plantilla `docs/specs/<ID>-<slug>/spec.md`** + regla de compuerta | El estado del arte converge en spec-kit (142 k ⭐) y OpenSpec (72 k ⭐), y Kiro (owner) lo ha industrializado. Ego tiene el hueco exacto: no hay artefacto de alcance por feature | 1-2 d | — |
| 3 | **`evidence.md`** con trazabilidad `FR-xxx → tarea → fichero → test → ADR` | `ProjectMemoryGraph` (`KB-11`) ya construye el grafo; falta el contrato que lo obliga. Es la diferencia entre "spec escrita" y "spec cumplida" | 1 d | 2 |
| 4 | **SAST en CI**: Semgrep (LGPL-2.1, CLI) o CodeQL (MIT, action) | Hoy el único análisis de código es `oxlint` con 7 reglas `deny` y 320 warnings permitidos (`package.json:19`). Es la brecha de calidad más grande y más barata | 0.5-1 d | — |
| 5 | **Trivy/Grype en el job `security`** (SCA + secretos + SBOM) | El job ya existe y es bloqueante (`ci.yml:126-162`); ampliar su alcance es barato. Cierra parte de `EGO-FIND-23` | 0.5 d | — |
| 6 | **Plantillas de Sub-Ego por rol** (PM, Arquitecto, QA, Redactor) derivadas de `google/eng-practices` y MetaGPT | `DOM-02` ya cubre PM y `DOM-01` el rol de ingeniería; **falta QA** y **falta el revisor**. La plantilla de PR ya exige "revisado por otro" (`PULL_REQUEST_TEMPLATE.md:37`) sin que exista el rol | 1-2 d | 2 |
| 7 | **Property-based testing** (fast-check) sobre `ApprovalEngine` y el MCP Server | Las propiedades críticas ("toda acción sensible requiere aprobación"; "el servidor cumple su esquema") no se demuestran con ejemplos fijos | 1-2 d | — |
| 8 | **Flags por etapa** (`SPECIFIED → IMPLEMENTED → INTEGRATED → VERIFIED`) | GrowthBook/Unleash/Flagsmith muestran el patrón; Flagsmith (BSD-3-Clause) es la única integrable. Permite desplegar sin activar, que es exactamente el matiz de `AGENTS.md` §4 | 1-2 d | 2 |
| 9 | **Postmortem estructurado** al cerrar incidentes | `COUC-09` (RunRecorder) ya es el patrón de origen; falta el formato y el destino | 1 d | — |
| 10 | **Promover cobertura a gate** con regresión primero | `coverage.yml:9` es informativo desde siempre; promoverlo sin preparación romperá el ritmo | 0.5 d | — |
| 11 | **Checklist OSSF Scorecard** en `docs/operations/despliegue.md` | Los checks ya fulfilled (SHAs, least privilege, Dependabot) se documentan; los pendientes (signed releases) se hacen visibles | 0.5 d | — |
| 12 | **Danger o reviewdog** sobre las reglas de la plantilla de PR | Convierte 8 casillas manuales en checks automáticos | 1 d | — |

### 9.1 Qué NO incorporar (y por qué) ##

| Patrón | Decisión | Motivo |
|---|---|---|
| Reemplazar el Backlog Maestro por Plane/Redmine/OpenProject | **Rechazar** | El Backlog es canónico (`Backlog.md:12`); Plane es AGPL-3.0 y Redmine GPL-2.0; ambos imponen un modelo de configuración ajeno a `AGENTS.md` §4 |
| Instalar un servidor de observabilidad (Grafana, Loki, Tempo) | **Rechazar** | Contradice el principio local-first; el "servidor" de Ego es su propio `EgoMemoryAdapter` |
| Publicación automática de releases (`semantic-release`) | **Rechazar** | `release-please.yml:3-4` (abre PR, no publica) es deliberadamente más seguro para un producto firmado |
| GitOps (Argo CD, Flux) | **Rechazar** | Ego es desktop; no hay cluster ni cluster API |
| Lenguaje Gherkin como motor de tests | **Rechazar** | Adoptar **solo** el formato de criterios de aceptación; Vitest + fast-check cubren la ejecución |
| `conventional-changelog` / `standard-version` / `changesets` | **Rechazar** | `release-please` ya cubre versionado + changelog; tres mecanismos sería redundancia |
| C4 / Structurizr | **Rechazar** | Nivel 5 (diseño) ya resuelto por Mermaid en el Canvas; añadir un DSL de diagramas es sobreingeniería |
| `pre-commit`, `ruff`, `ty`, `mypy`, `pytest` | **Rechazar** | Lenguajes que Ego no usa (TypeScript puro) |

---

## 10. Deuda abierta y preguntas para el owner ##

### 10.1 Deuda abierta de esta investigación ##

| # | Deuda | Impacto | Cómo se cierra |
|---:|---|---|---|
| D1 | Cinco repos no verificables: `github/secure-coding-guidelines`, `google/go-snapshot`, `tessl-ai/tessl`, `awslabs/spec-toolkit`, `graphite-dev/graphite` | Se citan como "no verificado"; ninguna conclusión depende de ellos | Reintentar con token de GitHub o con fuente alternativa |
| D2 | `forgejo/forgejo` no existe en GitHub (Forgejo vive en Codeberg, GPL-3.0) | La cifra de estrellas de Forgejo no es comparable | **Resuelto en la auditoría**: Codeberg reporta 5 681 estrellas y `LICENSE` GPL-3.0 |
| D3 | Licencias `NOASSERTION` sin resolver: `adr/madr`, `python/peps`, `json-schema-org/json-schema-spec`, `gitlabhq/gitlabhq` | No afecta a la recomendación (ninguno se integra) | Leer el `LICENSE` de cada uno. `anthropics/claude-code` queda **resuelto**: `LICENSE.md` propio de Anthropic (sin SPDX) |
| D4 | `PostHog` y `GrowthBook` son MIT + directorios EE | No se integraría ninguno | Fijar los directorios EE exactos |
| D5 | No se ha medido el coste real de escribir una spec en el flujo actual de Ego | La recomendación #2 se apoya en analogía, no en medición | Pilotar con 3 features reales y medir tiempo |
| D6 | Las estrellas son de 2026-10-20 | Los proyectos cambian | Reejecutar la verificación antes de decidir |

### 10.2 Preguntas para el owner (decisiones que este informe NO toma) ##

1. **¿Manda la spec sobre el Backlog o el Backlog sobre la spec?** La propuesta es que la spec acota el alcance de
   una tarea canónica y no tiene estado propio. ¿Se acepta esa subordinación, o la spec debe poder abrir tareas
   nuevas por sí misma?
2. **¿Cuál es el umbral mínimo de evidencia?** ¿Un `evidence.md` con FR→test, o además cobertura, o además
   revisión humana registrada?
3. **¿Se acepta un único Sub-Ego de QA (nuevo) o se extiende `DOM-01`?** Hoy existe `DOM-02` (Producto) y
   `DOM-01` (Ingeniería), pero ningún rol de QA ni de revisor.
4. **¿Flags por etapa o por feature?** El matiz de `AGENTS.md` §4 (cuatro estados de madurez) sugiere flags por
   etapa; Linear y GrowthBook sugieren flags por iniciativa.
5. **¿Publicación de releases con o sin firma?** `DIST-04` está bloqueado por falta de certificados. Mientras no
   haya firma, ¿el gate humano del PR de release se considera suficiente?
6. **¿Se acepta el coste de mantener `docs/specs/` en el repo, o el spec vive en VantaDB?** Unificar con el
   principio local-first (memoria en VantaDB) tiene sentido, pero rompe la revisión por PR y el histórico en git.

---

## Referencias ##

### Corpus verificado (GitHub) ####

#### Spec-driven ####

- [github/spec-kit](https://github.com/github/spec-kit)
- [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec)
- [cucumber/gherkin](https://github.com/cucumber/gherkin)
- [cucumber/common](https://github.com/cucumber/common) (antes `cucumber/cucumber`)
- [OAI/OpenAPI-Specification](https://github.com/OAI/OpenAPI-Specification)
- [asyncapi/spec](https://github.com/asyncapi/spec)
- [json-schema-org/json-schema-spec](https://github.com/json-schema-org/json-schema-spec)
- [adr/madr](https://github.com/adr/madr)
- [thomvaill/log4brains](https://github.com/thomvaill/log4brains)
- [rust-lang/rfcs](https://github.com/rust-lang/rfcs)
- [python/peps](https://github.com/python/peps)
- [structurizr/structurizr](https://github.com/structurizr/structurizr)
- [d2lang/d2](https://github.com/d2lang/d2) (antes `terrastruct/d2`)
- [mermaid-js/mermaid](https://github.com/mermaid-js/mermaid)
- [plantuml/plantuml](https://github.com/plantuml/plantuml)

#### Producto y roadmap ####

- [makeplane/plane](https://github.com/makeplane/plane)
- [opf/openproject](https://github.com/opf/openproject)
- [redmine/redmine](https://github.com/redmine/redmine)
- [taigaio/taiga-back](https://github.com/taigaio/taiga-back)
- [plausible/analytics](https://github.com/plausible/analytics)
- [PostHog/posthog](https://github.com/PostHog/posthog)
- [umami-software/umami](https://github.com/umami-software/umami)
- [Openpanel-dev/openpanel](https://github.com/Openpanel-dev/openpanel)
- [growthbook/growthbook](https://github.com/growthbook/growthbook)
- [Unleash/unleash](https://github.com/Unleash/unleash)
- [Flagsmith/flagsmith](https://github.com/Flagsmith/flagsmith)
- [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw)

#### CI/CD y automatización ####

- [go-gitea/gitea](https://github.com/go-gitea/gitea)
- [gitlabhq/gitlabhq](https://github.com/gitlabhq/gitlabhq)
- [woodpecker-ci/woodpecker](https://github.com/woodpecker-ci/woodpecker)
- [harness/harness](https://github.com/harness/harness) (antes `drone/drone`)
- [concourse/concourse](https://github.com/concourse/concourse)
- [tektoncd/pipeline](https://github.com/tektoncd/pipeline)
- [argoproj/argo-workflows](https://github.com/argoproj/argo-workflows)
- [argoproj/argo-cd](https://github.com/argoproj/argo-cd)
- [fluxcd/flux2](https://github.com/fluxcd/flux2)
- [renovatebot/renovate](https://github.com/renovatebot/renovate)
- [semgrep/semgrep](https://github.com/semgrep/semgrep)
- [aquasecurity/trivy](https://github.com/aquasecurity/trivy)
- [anchore/grype](https://github.com/anchore/grype)
- [github/codeql](https://github.com/github/codeql)
- [SonarSource/sonarqube](https://github.com/SonarSource/sonarqube)
- [reviewdog/reviewdog](https://github.com/reviewdog/reviewdog)
- [danger/danger](https://github.com/danger/danger)
- [pre-commit/pre-commit](https://github.com/pre-commit/pre-commit)
- [astral-sh/ruff](https://github.com/astral-sh/ruff)
- [astral-sh/ty](https://github.com/astral-sh/ty)
- [biomejs/biome](https://github.com/biomejs/biome)
- [python/mypy](https://github.com/python/mypy)
- [sqlc-dev/sqlc](https://github.com/sqlc-dev/sqlc)
- [dbt-labs/dbt](https://github.com/dbt-labs/dbt)

#### Testing ####

- [pytest-dev/pytest](https://github.com/pytest-dev/pytest)
- [coveragepy/coveragepy](https://github.com/coveragepy/coveragepy)
- [boxed/mutmut](https://github.com/boxed/mutmut)
- [stryker-mutator/stryker-js](https://github.com/stryker-mutator/stryker-js)
- [HypothesisWorks/hypothesis](https://github.com/HypothesisWorks/hypothesis)
- [google/atheris](https://github.com/google/atheris)
- [schemathesis/schemathesis](https://github.com/schemathesis/schemathesis)
- [google/go-cmp](https://github.com/google/go-cmp)

#### Revisión y merge ####

- [google/eng-practices](https://github.com/google/eng-practices)
- [ossf/scorecard](https://github.com/ossf/scorecard)
- [Mergifyio/mergify](https://github.com/Mergifyio/mergify)

#### Changelog y releases ####

- [googleapis/release-please](https://github.com/googleapis/release-please)
- [conventional-changelog/conventional-changelog](https://github.com/conventional-changelog/conventional-changelog)
- [conventional-changelog/standard-version](https://github.com/conventional-changelog/standard-version)
- [semantic-release/semantic-release](https://github.com/semantic-release/semantic-release)
- [changesets/changesets](https://github.com/changesets/changesets)
- [orhun/git-cliff](https://github.com/orhun/git-cliff)
- [cookpete/auto-changelog](https://github.com/cookpete/auto-changelog)
- [goreleaser/goreleaser](https://github.com/goreleaser/goreleaser)
- [crate-ci/cargo-release](https://github.com/crate-ci/cargo-release)
- [release-drafter/release-drafter](https://github.com/release-drafter/release-drafter)

#### Agentes ####

- [FoundationAgents/MetaGPT](https://github.com/FoundationAgents/MetaGPT)
- [OpenBMB/ChatDev](https://github.com/OpenBMB/ChatDev)
- [AntonOsika/gpt-engineer](https://github.com/AntonOsika/gpt-engineer)
- [SWE-agent/SWE-agent](https://github.com/SWE-agent/SWE-agent)
- [Aider-AI/aider](https://github.com/Aider-AI/aider)
- [OpenHands/OpenHands](https://github.com/OpenHands/OpenHands)
- [tyrellshawn/bolt.diy](https://github.com/tyrellshawn/bolt.diy)
- [continuedev/continue](https://github.com/continuedev/continue)
- [cline/cline](https://github.com/cline/cline)
- [RooCodeInc/Roo-Code](https://github.com/RooCodeInc/Roo-Code)
- [Kilo-Org/kilocode](https://github.com/Kilo-Org/kilocode)
- [anomalyco/opencode](https://github.com/anomalyco/opencode)
- [anthropics/claude-code](https://github.com/anthropics/claude-code)

#### Observabilidad y operación ####

- [getsentry/sentry](https://github.com/getsentry/sentry)
- [burke-software/GlitchTip](https://github.com/burke-software/GlitchTip)
- [grafana/grafana](https://github.com/grafana/grafana)
- [grafana/loki](https://github.com/grafana/loki)
- [grafana/tempo](https://github.com/grafana/tempo)
- [prometheus/prometheus](https://github.com/prometheus/prometheus)
- [open-telemetry/opentelemetry-collector](https://github.com/open-telemetry/opentelemetry-collector)
- [louislam/uptime-kuma](https://github.com/louislam/uptime-kuma)
- [netdata/netdata](https://github.com/netdata/netdata)
- [henrygd/beszel](https://github.com/henrygd/beszel)

### Fuentes no OSS (documentación oficial pública) ####

- [AWS Kiro — Specs](https://kiro.dev/docs/specs/)
- [AWS Kiro — Feature Specs](https://kiro.dev/docs/specs/feature-specs.md)
- [AWS Kiro — Quick Spec](https://kiro.dev/docs/specs/quick-spec/)
- [AWS Kiro — Best practices](https://kiro.dev/docs/specs/best-practices/)
- [Linear — Conceptual model](https://linear.app/docs/conceptual-model.md)
- [Linear — Roadmaps](https://linear.app/docs/roadmaps)
- [Linear — Triage](https://linear.app/docs/triage)
- [Linear — Linear for Growth](https://linear.app/docs/linear-for-growth)
- [MetaGPT (paper ICLR 2024)](https://arxiv.org/abs/2308.00352)
- [MetaGPT — docs](https://docs.deepwisdom.ai/main/en/guide/get_started/introduction.html)
- [SWE-agent (paper)](https://arxiv.org/abs/2405.15793)
- [Codeberg — Forgejo](https://codeberg.org/forgejo/forgejo)

### Corpus de Ego (estado verificado el 2026-10-20) ####

- [`docs/roadmap/Backlog.md`](../roadmap/Backlog.md)
- [`docs/roadmap/roadmap.md`](../roadmap/roadmap.md)
- [`docs/jerarquia-canonica.md`](../jerarquia-canonica.md)
- [`docs/adr/README.md`](../adr/README.md)
- [`docs/design/design-system.md`](../design/design-system.md)
- [`docs/testing/estrategia.md`](../testing/estrategia.md)
- [`docs/operations/despliegue.md`](../operations/despliegue.md)
- [`docs/index.md`](../index.md)
- [`AGENTS.md`](../../AGENTS.md)

---

## Verificación de datos (2026-10-20) ##

Auditoría independiente de este informe. Los 90 repositorios citados se reconsultaron en
`GET /repos/{owner}/{repo>` de la API REST de GitHub el 2026-10-20 y se compararon
`stargazers_count`, `pushed_at`, `license.spdx_id` y `archived`. Las licencias `NOASSERTION` se
resolvieron leyendo el fichero de licencia en `raw.githubusercontent.com`; Forgejo se verificó
contra la API de Codeberg. Las referencias `ruta:línea` se comprobaron descargando el fichero y
leyendo la línea citada.

| Dato verificado | Valor declarado | Valor real | Fuente | Estado |
| --- | --- | --- | --- | --- |
| `github/spec-kit` — estrellas | 142 011 | 142 012 | API `stargazers_count` | Corregido |
| `Fission-AI/OpenSpec` — estrellas | 72 474 | 72 476 | API `stargazers_count` | Corregido |
| `cucumber/gherkin` — estrellas, licencia | 418 · MIT | 418 · MIT | API | Correcto |
| `cucumber/cucumber` — nombre del repo | `cucumber/cucumber` | `cucumber/common` (3 353 estrellas, MIT, 2026-05-17) | API `full_name` | Corregido |
| `OAI/OpenAPI-Specification` — estrellas, licencia | 31 266 · Apache-2.0 | 31 266 · Apache-2.0 | API | Correcto |
| `asyncapi/spec` — estrellas, licencia | 5 323 · Apache-2.0 | 5 323 · Apache-2.0 | API | Correcto |
| `json-schema-org/json-schema-spec` — estrellas, licencia | 5 186 · sin SPDX | 5 186 · sin SPDX | API | Correcto |
| `adr/madr` — estrellas | 2 569 | 2 570 | API `stargazers_count` | Corregido |
| `thomvaill/log4brains` — estrellas, licencia | 1 603 · Apache-2.0 | 1 603 · Apache-2.0 | API | Correcto |
| `rust-lang/rfcs` — licencia | Apache-2.0 | MIT **+** Apache-2.0 (dual: `LICENSE-MIT` y `LICENSE-APACHE`) | `LICENSE-MIT`, `LICENSE-APACHE` | Corregido |
| `python/peps` — estrellas, licencia | 5 027 · sin SPDX | 5 027 · sin SPDX | API | Correcto |
| `structurizr/structurizr` — estrellas, licencia | 480 · Apache-2.0 | 480 · Apache-2.0 | API | Correcto |
| `terrastruct/d2` — nombre y estrellas | `terrastruct/d2` · 25 679 | `d2lang/d2` · 25 681 (MPL-2.0, 2026-10-11) | API `full_name` | Corregido |
| `mermaid-js/mermaid` — estrellas | 90 765 | 90 766 | API `stargazers_count` | Corregido |
| `plantuml/plantuml` — estrellas, licencia | 13 374 · LGPL-3.0 | 13 375 · **GPL-3.0** | API + `LICENSE` | Corregido |
| `makeplane/plane` — estrellas, licencia | 61 155 · AGPL-3.0 | 61 155 · AGPL-3.0 | API | Correcto |
| `opf/openproject` — estrellas | 16 493 | 16 494 | API `stargazers_count` | Corregido |
| `redmine/redmine` — estrellas, licencia | 6 050 · GPL-2.0 | 6 050 · GPL-2.0 | API + `LICENSE.txt` | Correcto |
| `taigaio/taiga-back` — estrellas, licencia | 859 · MPL-2.0 | 859 · MPL-2.0 | API | Correcto |
| `plausible/analytics` — estrellas | 29 565 | 29 566 | API `stargazers_count` | Corregido |
| `PostHog/posthog` — estrellas, licencia | 40 357 · MIT + dirs EE | 40 357 · MIT salvo los directorios restringidos | API + `LICENSE` | Correcto |
| `umami-software/umami` — estrellas | 39 479 | 39 480 | API `stargazers_count` | Corregido |
| `Openpanel-dev/openpanel` — estrellas | 7 169 | 7 170 | API `stargazers_count` | Corregido |
| `growthbook/growthbook` — estrellas, licencia | 8 513 · MIT + dirs EE | 8 513 · MIT salvo `packages/back-end/src/enterprise` | API + `LICENSE` | Correcto |
| `Unleash/unleash` — estrellas | 13 885 | 13 886 | API `stargazers_count` | Corregido |
| `Flagsmith/flagsmith` — estrellas, licencia | 6 603 · BSD-3-Clause | 6 603 · BSD-3-Clause | API | Correcto |
| `excalidraw/excalidraw` — estrellas | 134 225 | 134 228 | API `stargazers_count` | Corregido |
| `go-gitea/gitea` — estrellas | 58 581 | 58 582 | API `stargazers_count` | Corregido |
| Forgejo (Codeberg) — estrellas, licencia | no verificable · GPL-3.0 | 5 681 estrellas · GPL-3.0 | API de Codeberg + `LICENSE` | Corregido |
| `gitlabhq/gitlabhq` — licencia | sin SPDX (CE mirror) | MIT salvo `doc/` (CC BY); API `NOASSERTION` | `LICENSE` | Corregido |
| `woodpecker-ci/woodpecker` — estrellas, licencia | 8 022 · Apache-2.0 | 8 022 · Apache-2.0 | API | Correcto |
| `drone/drone` — nombre y estrellas | `drone/drone` · 38 610 | `harness/harness` · 38 611 (Apache-2.0, 2026-10-19) | API `full_name` | Corregido |
| `concourse/concourse`, `tektoncd/pipeline`, `argoproj/argo-workflows`, `argoproj/argo-cd`, `fluxcd/flux2`, `renovatebot/renovate` — estrellas, licencia | 7 924 / 9 086 / 17 043 / 24 440 / 8 452 / 22 807 · Apache-2.0 (Renovate AGPL-3.0) | idéntico | API | Correcto |
| `semgrep/semgrep` — estrellas | 17 140 | 17 141 | API `stargazers_count` | Corregido |
| `aquasecurity/trivy` — estrellas | 38 533 | 38 535 | API `stargazers_count` | Corregido |
| `anchore/grype` — estrellas | 13 053 | 13 055 | API `stargazers_count` | Corregido |
| `github/codeql` — estrellas, licencia | 10 215 · MIT | 10 215 · MIT | API | Correcto |
| `SonarSource/sonarqube` — estrellas | 11 091 | 11 092 | API `stargazers_count` | Corregido |
| `reviewdog/reviewdog`, `danger/danger` — estrellas, licencia | 9 678 / 5 695 · MIT | idéntico | API | Correcto |
| `pre-commit/pre-commit` — estrellas | 15 642 | 15 644 | API `stargazers_count` | Corregido |
| `astral-sh/ruff` — estrellas | 50 169 | 50 171 | API `stargazers_count` | Corregido |
| `astral-sh/ty`, `sqlc-dev/sqlc`, `dbt-labs/dbt` — estrellas, licencia | 19 894 / 18 395 / 14 046 · MIT / Apache-2.0 | idéntico | API | Correcto |
| `biomejs/biome` — licencia | Apache-2.0 | MIT **+** Apache-2.0 (dual: `LICENSE-MIT` y `LICENSE-APACHE`) | `LICENSE-MIT`, `LICENSE-APACHE` | Corregido |
| `python/mypy` — estrellas | 20 690 | 20 691 | API `stargazers_count` | Corregido |
| `pytest-dev/pytest` — estrellas | 14 612 | 14 613 | API `stargazers_count` | Corregido |
| `coveragepy/coveragepy`, `boxed/mutmut` — estrellas, licencia | 3 422 / 1 494 · Apache-2.0 / BSD-3-Clause | idéntico | API | Correcto |
| `stryker-mutator/stryker-js` — estrellas | 3 252 | 3 253 | API `stargazers_count` | Corregido |
| `HypothesisWorks/hypothesis` — estrellas, licencia | 9 094 · MPL-2.0 | 9 094 · MPL-2.0 | API + `LICENSE.txt` | Correcto |
| `google/atheris`, `schemathesis/schemathesis`, `google/go-cmp` — estrellas, licencia | 1 689 / 3 681 / 4 680 · Apache-2.0 / MIT / BSD-3-Clause | idéntico | API | Correcto |
| `google/eng-practices` — estrellas, licencia | 23 281 · CC BY 3.0 | 23 281 · CC BY 3.0 | API + `LICENSE` | Correcto |
| `google/eng-practices` — estado | (no declarado) | `archived: true` (sin commits desde 2024-09) | API `archived` | Añadido |
| `ossf/scorecard` — estrellas, licencia | 5 769 · Apache-2.0 | 5 769 · Apache-2.0 | API | Correcto |
| `Mergifyio/mergify` — estrellas, licencia, push | 339 · Apache-2.0 · 2023-09-07 | 339 · Apache-2.0 · 2023-09-07 | API | Correcto |
| `googleapis/release-please`, `conventional-changelog/conventional-changelog`, `conventional-changelog/standard-version`, `changesets/changesets`, `release-drafter/release-drafter` — estrellas, licencia | 7 641 / 8 521 / 7 986 / 12 495 / 3 948 · Apache-2.0 / ISC / MIT | idéntico | API | Correcto |
| `semantic-release/semantic-release` — estrellas | 24 114 | 24 115 | API `stargazers_count` | Corregido |
| `orhun/git-cliff` — licencia | Apache-2.0 | MIT **+** Apache-2.0 (dual) | `LICENSE-MIT`, `LICENSE-APACHE` | Corregido |
| `cookpete/auto-changelog` — estrellas, licencia | 1 404 · MIT | 1 404 · MIT | API | Correcto |
| `goreleaser/goreleaser` — estrellas | 16 104 | 16 105 | API `stargazers_count` | Corregido |
| `crate-ci/cargo-release` — licencia | Apache-2.0 | MIT **+** Apache-2.0 (dual) | `LICENSE-MIT`, `LICENSE-APACHE` | Corregido |
| `FoundationAgents/MetaGPT` — estrellas, licencia, push | 70 932 · MIT · 2026-01-21 | 70 932 · MIT · 2026-01-21 | API | Correcto |
| `OpenBMB/ChatDev` — estrellas, licencia | 34 556 · Apache-2.0 | 34 556 · Apache-2.0 | API | Correcto |
| `AntonOsika/gpt-engineer` — estrellas, licencia, push | 55 022 · MIT · 2025-05-14 | 55 022 · MIT · 2025-05-14 | API | Correcto |
| `AntonOsika/gpt-engineer` — estado | (no declarado) | `archived: true` | API `archived` | Añadido |
| `SWE-agent/SWE-agent` — estrellas, licencia | 20 600 · MIT | 20 600 · MIT | API | Correcto |
| `Aider-AI/aider` — estrellas | 49 650 | 49 652 | API `stargazers_count` | Corregido |
| `OpenHands/OpenHands` — estrellas | 91 336 | 91 343 | API `stargazers_count` | Corregido |
| `tyrellshawn/bolt.diy` — estrellas, licencia | 263 · MIT | 263 · MIT | API | Correcto |
| `continuedev/continue` — estrellas | 36 270 | 36 271 | API `stargazers_count` | Corregido |
| `cline/cline` — estrellas | 70 586 | 70 587 | API `stargazers_count` | Corregido |
| `RooCodeInc/Roo-Code` — estrellas, licencia | 24 276 · Apache-2.0 | 24 276 · Apache-2.0 (archivado) | API | Correcto |
| `Kilo-Org/kilocode` — estrellas | 27 663 | 27 662 | API `stargazers_count` | Corregido |
| `anomalyco/opencode` — estrellas | 218 172 | 218 221 | API `stargazers_count` | Corregido |
| `anthropics/claude-code` — estrellas, licencia | 152 811 · sin SPDX | 152 812 · `LICENSE.md` propio de Anthropic (sin SPDX) | API + `LICENSE.md` | Corregido |
| `getsentry/sentry` — estrellas, licencia | 45 610 · FSL-1.1 → Apache-2.0 | 45 610 · FSL-1.1-Apache-2.0 | API + `LICENSE.md` | Correcto |
| `burke-software/GlitchTip` — estrellas, licencia | 193 · MIT | 193 · MIT | API | Correcto |
| `grafana/grafana` — estrellas, licencia | 77 397 · AGPL-3.0 | 77 397 · AGPL-3.0 | API | Correcto |
| `grafana/loki` — estrellas | 29 044 | 29 045 | API `stargazers_count` | Corregido |
| `grafana/tempo` — estrellas | 5 538 | 5 539 | API `stargazers_count` | Corregido |
| `prometheus/prometheus`, `open-telemetry/opentelemetry-collector` — estrellas, licencia | 66 665 / 7 677 · Apache-2.0 | idéntico | API | Correcto |
| `louislam/uptime-kuma` — estrellas | 92 657 | 92 661 | API `stargazers_count` | Corregido |
| `netdata/netdata` — estrellas | 81 049 | 81 053 | API `stargazers_count` | Corregido |
| `henrygd/beszel` — estrellas | 26 357 | 26 359 | API `stargazers_count` | Corregido |
| `github/secure-coding-guidelines` — existencia | 404 | 404 | API + HTML | Correcto |
| `google/go-snapshot` — existencia | 404 | 404 | API + HTML | Correcto |
| `tessl-ai/tessl` — existencia | 404 | 404 | API + HTML | Correcto |
| `awslabs/spec-toolkit` — existencia | 404 | 404 | API + HTML | Correcto |
| `graphite-dev/graphite` — existencia | 404 | 404 | API + HTML | Correcto |
| `forgejo/forgejo` — existencia | 404 | 404 | API + HTML | Correcto |
| `github/spec-kit` — `templates/spec-template.md:26,41,90-93`, `templates/plan-template.md:39-41`, `templates/tasks-template.md:48,58`, `.specify/memory/constitution.md:42,73`, `scripts/powershell/create-new-feature.ps1:6,17` | citados | todas las líneas citadas existen y corresponden al mecanismo descrito | `raw.githubusercontent.com` | Correcto |
| `Fission-AI/OpenSpec` — `README.md:54,69-70,80,82,86`, `openspec/config.yaml:1,8-12` | citados | confirmados (`## ADDED Requirements` en 80, `schema: spec-driven` en 1, "Product language:" en 8) | `raw.githubusercontent.com` | Correcto |
| `cucumber/gherkin` — `README.md:376,384,523` | citados | confirmados (`Given <x>` en 376) | `raw.githubusercontent.com` | Correcto |
| `thomvaill/log4brains` — `README.md:25`, `rust-lang/rfcs` — `README.md:5`, `google/eng-practices` — `review/developer/index.md:1` | citados | confirmados literalmente | `raw.githubusercontent.com` | Correcto |
| `google/eng-practices` — `index.md:10` (enlace a Small CLs) | `index.md:10` | el fichero `index.md` **no existe** en la raíz: el enlace está en `README.md:11` → `review/index.md` | `raw.githubusercontent.com` | Corregido |
| `ossf/scorecard` — `README.md:15,33`, `docs/checks.md:57,480,525,628,659` | citados | confirmados literalmente (Branch-Protection, Pinned-Dependencies, Signed-Releases, Token-Permissions) | `raw.githubusercontent.com` | Correcto |
| `PostHog/posthog` — `README.md:27,49`, `LICENSE:7,11`; `growthbook/growthbook` — `LICENSE:5-6,10,12` | citados | confirmados literalmente | `raw.githubusercontent.com` | Correcto |
| `Unleash/unleash` — `README.md:20-22,184`; `Flagsmith/flagsmith` — `README.md:11,15` | citados | confirmados literalmente | `raw.githubusercontent.com` | Correcto |
| `aquasecurity/trivy` — `README.md:14-15`; `anchore/grype` — `README.md:7,24` | citados | confirmados literalmente | `raw.githubusercontent.com` | Correcto |
| `reviewdog/reviewdog` — `README.md:84-86`; `danger/danger` — `README.md:20,28` | citados | confirmados literalmente | `raw.githubusercontent.com` | Correcto |
| `FoundationAgents/MetaGPT` — `README.md:43-44`, `metagpt/roles/product_manager.py:21,46`, `metagpt/actions/write_prd.py:76` | citados | confirmados literalmente | `raw.githubusercontent.com` | Correcto |
| `SWE-agent/SWE-agent` — `README.md:105`; `OpenHands/OpenHands` — `README.md:10,117` | citados | confirmados literalmente | `raw.githubusercontent.com` | Correcto |
| `getsentry/sentry` — `LICENSE.md:1,90-92`; `orhun/git-cliff` — `cliff.toml:8,89,97,125` | citados | confirmados literalmente | `raw.githubusercontent.com` | Correcto |
| `googleapis/release-please` — `src/strategies/base.ts:26,58,83` | citados | confirmados literalmente (`bumpMinorPreMajor?` en 58, `extraFiles?` en 83, import de `DefaultChangelogNotes` en 26) | `raw.githubusercontent.com` | Correcto |
| `harness/harness` — `README.md:1` ("What is Gitness and where is Drone") | `README.md:1` | el `README.md:1` es el título del repo; la sección es `README.md:27` ("Where is Drone?") y el texto citado está en `:29` | `raw.githubusercontent.com` | Corregido |
| Documentación de productos no OSS (Kiro, Linear, Jira, GitHub Projects) | citada | no re-verificada en esta auditoría | — | No verificado (2026-10-20) |
| Fechas de push declaradas sólo en prosa (`MetaGPT` 2026-01-21, `gpt-engineer` 2025-05-14, `mergify` 2023-09-07, `ChatDev`) | declaradas | confirmadas contra `pushed_at` | API | Correcto |
| Cifras de `docs/roadmap/Backlog.md`, `docs/adr/README.md`, `ci.yml`, `CODEOWNERS` y `package.json` citadas en §4 y §7 | declaradas | no re-verificadas línea a línea en esta auditoría (fuera del alcance de GitHub) | — | No verificado (2026-10-20) |

Notas de la auditoría:

- Ningún repositorio citado en §3 resultó inexistente. Los cinco ya marcados como no verificables
  (`github/secure-coding-guidelines`, `google/go-snapshot`, `tessl-ai/tessl`,
  `awslabs/spec-toolkit` y `graphite-dev/graphite`) se reconfirman como 404, igual que
  `forgejo/forgejo` (Forgejo vive en Codeberg, con 5 681 estrellas y licencia GPL-3.0 verificadas).
- **La licencia de `plantuml/plantuml` era la más errónea del informe**: se declaraba LGPL-3.0 y el
  `LICENSE` es **GPL-3.0**. Eso la sube de copyleft débil a copyleft fuerte en la lista negra de §1.10.
- **Tres licencias `NOASSERTION` escondían declaraciones explícitas**: `biomejs/biome`,
  `orhun/git-cliff` y `crate-ci/cargo-release` son **MIT + Apache-2.0 duales**, no Apache-2.0 simple; y
  `rust-lang/rfcs` también es dual.
- **Tres repos han cambiado de nombre**: `drone/drone` → `harness/harness`, `terrastruct/d2` →
  `d2lang/d2` y `cucumber/cucumber` → `cucumber/common`. Se corrigen en las tablas y en el corpus final.
- **Dos repos están archivados** y el informe no lo decía: `google/eng-practices` (sin commits desde 2024-09) y
  `AntonOsika/gpt-engineer`. Se añade el dato porque refuerza los veredicttos de "adoptar el proceso, no el
  motor".
- La evidencia de `ruta:línea` es prácticamente perfecta: de las 30 referencias comprobadas, 28 son exactas
  y 2 estaban mal escritas (`google/eng-practices/index.md` y la cita del README de Drone).
- Contradicciones con los informes ya auditados, unificadas aquí: `github/spec-kit` 142 011 → **142 012**,
  `Fission-AI/OpenSpec` 72 474 → **72 476**, `Aider-AI/aider` 49 650 → **49 652**,
  `OpenHands/OpenHands` 91 336 → **91 343**, `continuedev/continue` 36 270 → **36 271**,
  `cline/cline` 70 586 → **70 587**, `Kilo-Org/kilocode` 27 663 → **27 662**,
  `anthropics/claude-code` 152 811 → **152 812**, `go-gitea/gitea` 58 581 → **58 582**,
  `opf/openproject` 16 493 → **16 494**.

**Recuento**: 104 cifras verificadas · 48 corregidas · 2 marcadas "no verificado".
