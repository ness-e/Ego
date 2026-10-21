# Síntesis de capacidades de Ego: matriz maestra de decisión #

| Campo | Valor |
| --- | --- |
| Estado | Research — Vía 2 del protocolo de extracción. Propuesta, **no normativo** |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Alcance | 7 informes de estado del arte + 25 fichas de extracción → decisiones de capacidad para Ego |
| Naturaleza | No implementa, no modifica `packages/`, no añade tareas al Backlog Maestro |

> **Nada de este documento es normativo.** Lo que gobierna el producto son
> [`docs/jerarquia-canonica.md`](../jerarquia-canonica.md),
> [`docs/product/principios-innegociables.md`](../product/principios-innegociables.md),
> [`AGENTS.md`](../../AGENTS.md) y los ADR de [`docs/adr/`](../adr/README.md).
> Este documento **propone**; el owner **decide**.
> El detalle de viabilidad por propuesta está en [`rfc-viability-top.md`](./rfc-viability-top.md).

---

## 1. Resumen ejecutivo ##

1. **Ego ya tiene la arquitectura cognitiva.** Los 7 informes coinciden en un punto: ningún framework externo
   aporta un mecanismo de ejecución que Ego no tenga. Lo que falta no es un motor, son **cinco contratos**:
   plantillas importables, catálogo versionado, MCP al día, ejecución durable y salida gobernada.
2. **Orden propuesto:** `SYN-01` importador de definiciones · `SYN-02` tipo `SubEgoTemplate` ·
   `SYN-03` contrato MCP 2026 · `SYN-04` ejecución durable · `SYN-05` delegación durable ·
   `SYN-06` guardrails por Sub-Ego · `SYN-07` canal como adaptador · `SYN-08` grafo declarativo ·
   `SYN-09` proyección de backoffice · `SYN-10` trazabilidad spec→test.
3. **El mejor valor por esfuerzo es `SYN-01`**: el usuario de Ego ya tiene Claude Code, Cursor, Codex,
   Gemini CLI y OpenCode instalados con sus agentes, y hoy Ego no ve ninguno
   (`packages/integrations/src/skills/SkillScanner.ts:42-45` sólo recorre `.ego/skills` y `~/.ego/skills`).
4. **El bloqueante técnico es `SYN-03`**: `McpClient` está fijado a la revisión `2024-11-05`
   (`packages/integrations/src/mcp/McpClient.ts:174`), dos revisiones por detrás de la vigente, y anuncia
   `roots` sin cumplirlo (`:176` frente a la ruta de `roots/list`). Importar antes de cerrar eso es
   multiplicar servidores que fallan.
5. **El bloqueante de gobernanza es `SYN-04`**: `ApprovalEngine` mantiene las aprobaciones pendientes en un
   `Map` en memoria (`packages/execution/src/ApprovalEngine.ts:121`), así que cerrar la app pierde la decisión.
6. **Las tres capacidades que tocan el exterior son las de mayor riesgo**: `SYN-03` (ficheros de
   terceros con tokens en claro), `SYN-07` (publicación en nombre del usuario) y `SYN-09` (datos
   económicos). Las tres exigen aprobación humana previa y `fail-closed`.
7. **Se descartan explícitamente 25 líneas de capacidad** (§5): ningún framework de orquestación,
   ningún motor de workflows externo, ningún ERP, ningún CRM, ningún WhatsApp no oficial, ningún
   computer-use por coordenadas en P0.
8. **El mapa de fases respeta `AGENTS.md` §6**: las capacidades que tocan `packages/runtime` o
   `packages/memory` no pueden empezar antes de que la Fase 06 esté cerrada.
9. **Bloqueos del owner**: certificados de firma (`DIST-04`), credenciales de canal de escritura y
   dirección de producto sobre si Ego publica un catálogo remoto (§9).
10. **Deuda de proceso que hay que cerrar antes de codificar**: `docs/specs/` no existe, y el Backlog
    Maestro no tiene compuerta de spec; sin ella, `SYN-10` no tiene dónde apoyarse.

---

## 2. Método ##

### 2.1 Corpus y procedimiento de cruce ##

El cruce se hizo en tres pasos, todos reproducibles:

1. **Lectura íntegra de los 7 informes** de `docs/research/`
   (`orquestacion-multiagente.md`, `plantillas-agentes-y-enjambres.md`, `backoffice-empresa-personal.md`,
   `canales-comunicacion-y-social.md`, `compatibilidad-integraciones-mcp-skills.md`,
   `automatizacion-y-agentes-ejecucion.md`, `producto-y-desarrollo-como-empresa.md`) y extracción de sus
   **veredictos explícitos** (`ADOPTAR` / `ADAPTAR` / `PATRÓN` / `DESCARTAR` / `PARALELO`), que son la
   materia prima y no las conclusiones.
2. **Cruce con las 25 fichas de extracción** (`docs/extractions/README.md:69-106`) y sus backlogs de revisión
   (`docs/review/backlog-*.md`), para no proponer como nuevo lo que ya está catalogado como
   `✅ Completada`, `🆕 Pendiente` o `🚫 Descartada`.
3. **Contraste con el estado real del código** mediante `grep` sobre `packages/` y `apps/desktop/`, con el
   criterio de `docs/extractions/README.md:117`: *estado = evidencia, no memoria*. Un hallazgo marcado
   `✅ Completada` sin caller en producción es `🆕 Pendiente`, no capacidad nueva.

### 2.2 Criterio de priorización ##

Cada capacidad candidata se puntuó en cuatro ejes, todos en la misma escala ordinal de 1 a 5:

| Eje | Pregunta que responde | Peso |
| --- | --- | --- |
| **Tesis de producto** | ¿Sirve al producto objetivo de `AGENTS.md` §2 — una persona que dirige una organización de agentes? | 3 |
| **Madurez de la evidencia** | ¿El mecanismo está verificado en código de terceros con `ruta:línea`, o es intuición? | 2 |
| **Esfuerzo relativo** | ¿Es barato en días-ingeniero y no exige decisiones de política que bloqueen? | 2 |
| **Coherencia canónica** | ¿Respeta los 10 principios y no contradice la jerarquía de 12 niveles? | 3 |

La puntuación total ordena las capacidades. El orden resultante es **una recomendación, no un calendario**:
`AGENTS.md` §6 exige completar cada fase antes de abrir la siguiente, y §6 del protocolo de extracción exige
la compuerta de cada fase antes de codificar.

### 2.3 Reglas de trazabilidad de la evidencia ##

- Toda afirmación sobre el estado de Ego en este documento lleva `fichero:línea` y fue verificada con `grep`
  el 2026-10-20. Donde no se pudo verificar, se marca **no verificado**.
- Las cifras de estrellas, licencias y fechas de los repos externos **no se repiten**: viven en los informes
  que las verificaron contra la API de GitHub el 2026-10-20. Aquí sólo se cita el repositorio y la sección.
- Los identificadores de capacidad `SYN-01..SYN-10` son **propios de esta síntesis**. Los identificadores de
  fase (`CORE-xx`, `ACT-xx`, `SUB-xx`, `TASK-xx`, `KB-xx`, `DOM-xx`, `SEC-xx`, `INT-xx`, `DIST-xx`) **no** se
  reutilizan como ID de capacidad: aparecen en las columnas "Fase destino" y "Dependencias".
- Ninguna fila de este documento autoriza por sí sola una tarea en el Backlog Maestro.

---

## 3. Matriz maestra de capacidades ##

| ID | Capacidad | Tesis de producto que sirve | Evidencia (informe + repos) | Estado actual en Ego (fichero:línea) | Veredicto | Fase destino | Dependencias | Esfuerzo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `SYN-01` | **Importador de definiciones de agentes y skills de terceros** (Claude Code, Gemini CLI, OpenCode, Codex, Goose, Cline, Continue) | El usuario llega a Ego con un ecosistema ya poblado; Ego debe absorberlo, no obligarle a reescribirlo | `plantillas-agentes-y-enjambres.md` §7.3, §9.3 · `compatibilidad-integraciones-mcp-skills.md` §3, §7 · Codex `external-agent-migration` | `packages/integrations/src/skills/SkillScanner.ts:42-45` sólo lee `.ego/skills` y `~/.ego/skills` · `SkillLinter.ts:82` existe · `apps/desktop/src/main.ts:1686` lo cablea en producción | **Adoptar** | 03 Sub-Egos | `SYN-02` (modelo destino) · `ACT-11` | 12-18 d |
| `SYN-02` | **Tipo `SubEgoTemplate` + catálogo versionado, con licencia y exportadores** | Plantilla = manifiesto sin instancia: portable, versionable, publicable, reutilizable por terceros | `plantillas-agentes-y-enjambres.md` §7.1, §7.2 · `orquestacion-multiagente.md` §9.2 · `wshobson/agents` multi-harness | `packages/subegos/src/templates/domainTemplates.ts:11-36` — `DomainTemplate` sin `version` ni `license` · `packages/domains/src/templates/officialSubEgoTemplates.ts:6` idem · `packages/subegos/src/SubEgoManifest.ts:88-122` es el manifiesto de instancia | **Adoptar** | 03 Sub-Egos | `SUB-01`, `SUB-07` | 8-12 d |
| `SYN-03` | **Contrato MCP al día: cliente dual-era, descubrimiento completo, anotaciones de riesgo, OAuth 2.1** | Ego debe ser cliente y servidor MCP de primera clase, no un consumidor degradado | `compatibilidad-integraciones-mcp-skills.md` §4, §8, §11 Fase A · spec MCP `2026-07-28` | `packages/integrations/src/mcp/McpClient.ts:174` fija `2024-11-05` · `:176` anuncia `roots` sin cumplirlo · `:251-261` sólo `tools/list` · `McpServer.ts:153-157` | **Adoptar** | 02 Acción (base) + 11 Security | `ACT-09` · bloquea `SYN-01` | 12-18 d |
| `SYN-04` | **Ejecución durable: aprobación suspendida persistida, ledger de idempotencia y presupuesto triple** | Un trabajo largo no puede perder la decisión del usuario ni repetir un efecto externo | `automatizacion-y-agentes-ejecucion.md` §5.2, §8 · DBOS, CrewAI, Temporal, n8n, Restate | `packages/execution/src/ApprovalEngine.ts:121` — `pendingMap` en memoria · `packages/tasks/src/TaskCheckpoint.ts:28,67` guarda y carga, sin `restore` ni `branch` · `BackgroundEngine.ts:206-212,327` ya tiene `checkpointProvider` y `resume` | **Adoptar** | 02 Acción + 07 Tasks | `ACT-06`, `TASK-03` · `MSWE-01/02/03`, `OHND-03/04` | 15-22 d |
| `SYN-05` | **Delegación durable, reanudable y con presupuesto agregado por cadena** | La cadena padre→hijo→nieto es el corazón de la tesis; hoy no deja rastro reanudable | `orquestacion-multiagente.md` §5.2, §5.3, §9.4 · Agent Framework, CAMEL, Magentic-One | `packages/subegos/src/DelegationRouter.ts:436` publica `delegations/<id>/input` y `:515` `output` · **0 coincidencias** de `checkpoint`, `resume`, `idempot` o `AbortSignal` en el fichero (grep 2026-10-20) · cableado en `apps/desktop/src/main.ts:1650` | **Adoptar** | 10 Recovery (+ 03) | `SYN-04` · `SUB-06`, `SUB-09` | 10-15 d |
| `SYN-06` | **Guardrails declarativos por Sub-Ego** | El principio 6 de gobernanza pasa de global a por especialista: "este Sub-Ego nunca sale de su worktree" | `orquestacion-multiagente.md` §5.1, §9.4 · OpenAI Agents SDK, Pydantic AI | `packages/subegos/src/SubEgoManifest.ts:101-103` declara `tools` y `permissions` pero **no** `guardrails` · `packages/execution/src/ApprovalEngine.ts:240-252` evalúa por tool · `packages/runtime/src/TrustBoundary.ts:42-128` marca taint | **Adoptar** | 11 Security | `SYN-05` · `SEC-05`, `SUB-01` | 6-9 d |
| `SYN-07` | **Canal como adaptador: modelo canónico Contact/Conversation/Message, idempotencia de salida y consentimiento** | Un SOC local-first puede operar canales; el canal es un adaptador, el modelo es canónico | `canales-comunicacion-y-social.md` §5, §6, §9 · Postiz, Chatwoot, Matrix, atproto, gherkin | `packages/domains/src/crm/CrmDomain.ts:99` persiste `crm/contacts`, `crm/deals`, `crm/interactions` · `packages/memory/SensitiveNamespaces.ts:39-43` marca `crm/` y `finance/` sensibles · `packages/tools/src/types.ts:6-12` — `ToolCategory` **no** incluye canal | **Adoptar** | 09 Dominios | `SYN-04` (idempotencia) · `DOM-05` · decisión de owner | 15-22 d |
| `SYN-08` | **Grafo declarativo de workflows y Canvas de workflows** | El usuario ve y edita el flujo de su empresa, no sólo delega por chat | `orquestacion-multiagente.md` §9.2, §9.4 · ChatDev 2.0, Google ADK, LangGraph | `packages/subegos/src/DelegationRouter.ts:327` es el bus de delegación · `packages/ui-runtime/src/CanvasBridge.ts:70` y `apps/desktop/renderer/components/canvas/registry.ts` son la superficie · **no** existe motor de grafos | **Adaptar — diferido** | 04 Canvas | `SYN-05` · `CANV-01`, `CANV-02` | 15-20 d |
| `SYN-09` | **Proyección canónica de backoffice y analítica de gestión** | Lo que ningún OSS resuelve: razonar sobre el backoffice ("¿qué cliente se me enfría?", "¿puedo contratar?") | `backoffice-empresa-personal.md` §"Matriz de capacidades", Fase 0-3 · Actual Budget, Firefly III, Medici, Kill Bill | `packages/domains/src/types.ts:67-72` — sólo 5 dominios (`engineering`, `product`, `knowledge`, `analytics`, `crm`) · `docs/architecture/namespaces.md:25,27` declara `ecom/*` y `finance/*` **sin dominio implementado** · `packages/domains/src/analytics/AnalyticsDomain.ts:28` existe sin fuente de datos | **Adaptar — Fase 09/12** | 09 Dominios | `DOM-09` · decisión de owner sobre el dominio `finance` | 20-30 d |
| `SYN-10` | **Trazabilidad spec→código→test y gates de calidad en CI** | Cero asunciones silenciosas: cada capacidad se demuestra con un criterio de aceptación | `producto-y-desarrollo-como-empresa.md` §5, §6, §9 · spec-kit, OpenSpec, Kiro, Scorecard | `packages/knowledge/src/ProjectMemoryGraph.ts:36` construye el grafo (KB-11) sin contrato de trazabilidad · `.github/workflows/coverage.yml:63` es `continue-on-error: true` · `.github/workflows/ci.yml:552` valida `commit-msg` sin `Signed-off-by` · `docs/specs/` **no existe** | **Adoptar** | transversal (Fase 02/11/12) | `KB-11` · `Backlog.md:128-133` (compuertas) | 4-7 d |

### 3.1 Lectura de la matriz ##

- **Cinco capacidades son deuda disfrazada de hallazgo**: `SYN-03` (el cliente MCP anuncia lo que no cumple),
  `SYN-04` (la aprobación se pierde al cerrar la app) y `SYN-06` (no hay forma de declarar una política por
  Sub-Ego) son **incumplimientos de contratos ya asumidos**, no funciones nuevas.
- **Dos capacidades son alta y bajo coste**: `SYN-01` (importar lo que el usuario ya tiene) y `SYN-10`
  (trazabilidad) son las de mejor relación valor/esfuerzo de la matriz.
- **Una capacidad es de riesgo reputacional y legal**: `SYN-07`. Publicar en nombre del usuario es
  irreversible; por eso su aprobación es por contenido exacto y el estado indeterminado es de primera clase.
- **Una capacidad es de contaminación de dominio**: `SYN-09` sólo es admisible como **proyección cognitiva
  mínima** ingestada, nunca como reimplementación de ERP.
- **Una capacidad es el riesgo mayor de sobreingeniería**: `SYN-08`. Un motor de grafos propio compite con el
  Decision Router y con el Canvas, y multiplica el coste por turno sin control nuevo.

---

## 4. Consolidación por dominio ##

### 4.1 Orquestación de agentes ##

**Resuelto.** El `DelegationRouter` es ya un supervisor jerárquico con profundidad máxima 3
(`packages/subegos/src/DelegationRouter.ts:348`), control de ciclos, concurrencia acotada (`:890-911`) y
`SharedMemory` con leases (`packages/subegos/src/SharedMemory.ts:247`). Está cableado en producción
(`apps/desktop/src/main.ts:1650`). Los siete informes coinciden en que **ningún framework externo aporta un
mecanismo que Ego no tenga**.

**Falta.** Cuatro huecos, todos de *continuidad* y no de *orquestación*: checkpoint reanudable de una
delegación, handoff condicional, presupuesto agregado por cadena de delegación y ledger de progreso.

**Descartar.** Frameworks de orquestación como dependencia (LangGraph, AutoGen, CrewAI, Agent Framework:
todos Python, y `AGENTS.md` §1 y §4 fijan TS-first y runtime propio). Topologías de debate, auction y
society-of-agents: no encajan con un producto de una sola persona y rompen la trazabilidad de `gov/audit`.

**Veredicto por capacidad.** `SYN-05` **Adoptar**; `SYN-08` **Adaptar, diferido** a Fase 04 y sólo si la
delegación durable ya está cerrada.

### 4.2 Plantillas y catálogo de Sub-Egos ##

**Resuelto.** El 60 % del modelo ya existe: `SubEgoManifest` (Zod, `packages/subegos/src/SubEgoManifest.ts:88-122`),
`SubEgoSoul` (`packages/subegos/src/SubEgoSoul.ts:174`), `SubEgoRegistry` sobre `gov/sub_egos`
(`packages/subegos/src/SubEgoRegistry.ts:228`), perfiles por rol (`DEFAULT_SUBEGO_PROFILES`, `:173`),
`DOMAIN_TEMPLATES` (`packages/subegos/src/templates/domainTemplates.ts:41`),
`OFFICIAL_SUBEGO_TEMPLATES` (`packages/domains/src/templates/officialSubEgoTemplates.ts:6`) y el
aislamiento por worktree (`packages/subegos/src/SubEgoWorktree.ts:67`).

**Falta.** Un tipo `SubEgoTemplate` de primera clase — declarativo, versionado, con licencia — separado del
manifiesto de instancia viva; exportadores a `SKILL.md`, `AGENTS.md` y formatos de terceros; y el
importador de definiciones ya instaladas.

**Descartar.** Taxonomía fija de roles "de película" (CEO/CTO/CFO): contradice el principio 4 y lo ya fijado
en `docs/architecture/agentes.md`. Plugins con hooks por plantilla: el bus `configureHooks()`
(`packages/events/src/EventBus.ts:284`) ya es el mecanismo canónico — y **no tiene caller de producción**,
sólo tests, por lo que primero hay que cerrarlo (deuda `GOOS-04` citada en
`plantillas-agentes-y-enjambres.md` §7.4).

**Veredicto por capacidad.** `SYN-01` y `SYN-02` **Adoptar**, en este orden: el importador necesita un
modelo destino canónico.

### 4.3 Backoffice de empresa ##

**Resuelto.** `packages/domains/src/crm/CrmDomain.ts:71` ya persiste contactos, deals e interacciones sobre
`crm/contacts`, `crm/deals` y `crm/interactions` (`:99`), y `packages/domains/src/analytics/AnalyticsDomain.ts:28`
ya sabe agregar y graficar. El 80 % del backoffice de un fundador es *integrable* por MCP o API.

**Falta.** Una proyección canónica mínima (cinco entidades: `Party`, `Item`, `Commitment`, `MoneyFact`,
`Movement`) y la fuente de datos que la alimenta. No existe dominio financiero: `docs/architecture/namespaces.md:25,27`
declara `ecom/*` y `finance/*` sin implementación, y `packages/domains/src/types.ts:67-72` sólo conoce cinco
dominios.

**Descartar.** ERP, CRM propio, WMS, motor de facturación y pasarela de pago, y sobre todo **contabilidad
fiscal**: Ego debe producir informes de gestión, nunca libros oficiales. `ecom/` como nomenclatura de un
backoffice general es contaminación de dominio.

**Veredicto por capacidad.** `SYN-09` **Adaptar**, y sólo en dos pasos: (a) conectores MCP de lectura, sin
dominio nuevo; (b) dominio `finance` mínimo en Fase 09 si la demanda aparece. Requiere decisión de owner
(§9.3).

### 4.4 Canales y redes sociales ##

**Resuelto.** La mitad del modelo: `CrmDomain` para contactos e interacciones, `SensitiveNamespaces.ts:39-43`
para que `crm/` y `finance/` queden en cuarentena por construcción, `ApprovalEngine.computeActionIdentity()`
(`packages/execution/src/ApprovalEngine.ts:75`) para aprobar por contenido exacto, `SecretProxy`
(`packages/integrations/src/mcp/SecretProxy.ts:32-64`) para no filtrar secretos al subproceso MCP, y la
frontera SSRF (`packages/tools/src/native/security/NetPolicy.ts`).

**Falta.** La noción de **canal** como dimensión de primera clase, la de **conversación** y **mensaje**, el
estado de idempotencia de envío y el modelo de consentimiento opt-in/opt-out. Verificado: el repo oficial
`modelcontextprotocol/servers` ya **no** contiene ningún servidor de mensajería, así que el Nivel B no cubre
este dominio y todo canal nuevo es Nivel A o C.

**Descartar.** WhatsApp no oficial (`Baileys`, `whatsapp-web.js`): ingeniería inversa del protocolo, ToS y
riesgo de baneo de la cuenta de negocio del usuario. X y LinkedIn en v1: revisión de aplicación a nivel de
app. Cualquier suite de CRM o de marketing.

**Veredicto por capacidad.** `SYN-07` **Adoptar**, con v1 restringida a Email, Discord, Telegram, Slack y
publicación en Mastodon + Bluesky, y con aprobación humana **no desactivable**.

### 4.5 Integraciones, MCP, plugins y skills ##

**Resuelto.** `McpClient` (`packages/integrations/src/mcp/McpClient.ts`), `McpServer`
(`packages/integrations/src/mcp/McpServer.ts`), `McpManager` (`:62`), `SecretProxy`, allowlist de spawn,
`SkillScanner` + `SkillLinter` (`packages/integrations/src/skills/`), y `ACT-11` como marketplace local.

**Falta.** El contrato MCP vigente. El cliente no implementa `resources/list`, `resources/read`,
`prompts/list` ni `prompts/get` aunque el servidor sí los publica (`McpServer.ts:127-133`): es una divergencia
doc-código con `docs/engineering/integraciones.md:80`. Faltan anotaciones de tool mapeadas al riesgo
(declaradas, no deducidas del nombre), OAuth 2.1 para servidores remotos y versionado dual-era.

**Descartar.** Motor de plugins propio que cargue código de terceros (rompe TypeScript estricto y el modelo de
sandbox). Marketplace propio con servicio de publicación: el formato `marketplace.json` ya es interoperable y
un servicio es coste operativo permanente. Reimplementar el parser de skills: `SKILL.md` es el estándar de
 facto y se adopta verbatim.

**Veredicto por capacidad.** `SYN-03` **Adoptar** y es bloqueante; `SYN-01` y `SYN-02` **Adoptar** como capa
de gestión **sobre** MCP, nunca como segundo runtime.

### 4.6 Automatización y ejecución ##

**Resuelto.** El motor determinista ya existe: `ToolExecutionLoop` (`packages/runtime/src/ToolExecutionLoop.ts:53`),
`ExecutionManager` (`packages/execution/src/ExecutionManager.ts:58`) con cancelación cooperativa,
`CircuitBreaker` (`packages/execution/src/CircuitBreaker.ts`), `ApprovalEngine`, `BackgroundEngine`
(`packages/tasks/src/BackgroundEngine.ts:39`) con `checkpointProvider` y `resume` (`:206-212,327`),
`TaskCheckpointManager` (`packages/tasks/src/TaskCheckpoint.ts:16`), `TaskCancellation` con `AbortSignal`
(`TASK-09`), `UntrustedContentSanitizer` (`packages/memory/UntrustedContentSanitizer.ts:132`) y
`TrustBoundary` (`packages/runtime/src/TrustBoundary.ts:42-128`).

**Falta.** Tres cosas, y sólo tres: (a) la aprobación suspendida no se persiste; (b) no hay ledger de
idempotencia previo a la ejecución material, así que una tool con efecto externo puede repetirse; (c) no hay
reloj de pared, sólo `maxSteps` y coste.

**Descartar.** Motor de workflows externo (Temporal, Airflow, Conductor, n8n embebido): contradice el
principio 9 y el guardrail de no backend en P0. El reintento de n8n con intervalo fijo y sin jitter: Ego ya
tiene backoff con jitter en `packages/models/src/ModelRouter.ts`. Computer-use por coordenadas en P0.

**Veredicto por capacidad.** `SYN-04` **Adoptar**. Es la capacidad que más rápido devuelve confianza al
usuario y la que menos superficie añade.

### 4.7 Producto y desarrollo ##

**Resuelto.** El Backlog Maestro es canónico y completo (147/151 tareas), con ADRs stricter que MADR
(`docs/adr/README.md:19-21`), `CODEOWNERS` (`.github/CODEOWNERS:1-27`), `release-please` que abre PR y no
publica (`.github/workflows/release-please.yml:20`), gate de seguridad en CI
(`.github/workflows/ci.yml:151-178`), y `ProjectMemoryGraph` (`packages/knowledge/src/ProjectMemoryGraph.ts:36`).

**Falta.** Un artefacto de **spec por feature** (`docs/specs/` no existe) y el contrato que liga
spec ↔ tarea canónica ↔ test ↔ ADR. En calidad: cobertura como gate (hoy `continue-on-error: true`), SAST,
property-based testing y `Signed-off-by`.

**Descartar.** Sustituir el Backlog por Plane, Redmine u OpenProject. Publicación automática de releases
(`semantic-release`): `release-please` con humano es deliberadamente más seguro para un producto firmado.
Servidores de observabilidad (Grafana, Loki, Tempo): el "servidor" de Ego es su propio `EgoMemoryAdapter`.
C4/Structurizr: el nivel 5 ya está resuelto con Mermaid en el Canvas.

**Veredicto por capacidad.** `SYN-10` **Adoptar** y pronto: es transversal, barato y desbloquea la
compuerta de spec que las demás capacidades necesitan para justificarse.

### 4.8 Memoria y conocimiento ##

**Resuelto.** Ingesta multiformato (`KB-01`), indexación y BM25 (`KB-03`), búsqueda híbrida con re-rank MMR
(`KB-04`), GraphRAG nativo (`packages/knowledge/src/GraphRagEngine.ts:287-291` llama
`adapter.graphRagSearch`), cuarentena (`KB-07`), promoción y supersesión (`KB-08`), consultas bitemporales
(`KB-09`) y grafo de proyecto (`KB-11`).

**Falta.** La fusión RRF real y el path cognitivo nativo (`memoryRecall`, `contextAssemble`,
`memoryConsolidate`, `memoryReinforce`) están pendientes; `HybridSearch` hace re-rank mono-lista sin RRF. Y
`DreamConsolidator` y `MemoryCurator` **no tienen caller en producción**: sólo se instancian en
`packages/tasks/test/` (verificado por grep el 2026-10-20), luego el motor de consolidación está cableado en
código pero no en el arranque.

**Descartar.** Capa de embeddings calculada en TypeScript en el fast path: `AGENTS.md` §4 lo prohíbe
explícitamente. Wiki y editor de bloques propios: `packages/knowledge/` ya cubre la ingesta y la búsqueda.
Chat con plugins descargables al estilo Open WebUI: sólo aporta UX.

**Veredicto por capacidad.** Ninguna capacidad nueva de memoria entra en esta hoja de ruta. La memoria es
**prerrequisito**, no objetivo: `SYN-04` y `SYN-05` escriben en ella y por eso deben respectar el contrato de
`ego.namespaces.json` y la regla de no-workaround silencioso de `AGENTS.md` §4.

---

## 5. Qué se descarta y por qué ##

Esta tabla es la parte más importante del documento: **el conjunto de ideas que los informes contienen y que Ego
no debe construir**. Todas están respaldadas por un guardrail, una contradicción con los 10 principios o una
duplicación de un módulo canónico.

| Capacidad candidata | Por qué se descarta | Fundamento |
| --- | --- | --- |
| Framework de orquestación como dependencia (LangGraph, AutoGen, CrewAI, Agent Framework) | Todos son Python; Ego es TS-first con runtime cognitivo propio | `AGENTS.md` §1 y §4 · `orquestacion-multiagente.md` §9.3 |
| Motor de workflows externo (Temporal, Airflow, Conductor, n8n embebido, DBOS como motor) | Servidor + base de datos + esquema de estado para un desktop local-first | Principio 9 · `AGENTS.md` §4 (no backend en P0) · `automatizacion-y-agentes-ejecucion.md` §10.3 |
| Topologías de debate, auction y society-of-agents | Multiplican el gasto por turno y ocultan la responsabilidad tras una interfaz única | `orquestacion-multiagente.md` §4 · trazabilidad de `gov/audit` |
| Agentes autónomos tipo AutoGPT, babyagi, SuperAGI, AgentVerse | Sin presupuesto, sin HITL, sin determinismo; tres de cuatro sin licencia o inactivos desde 2024-2025 | Principio 6 · `orquestacion-multiagente.md` §3.2 |
| A2A y AGNTCY como requisito de producto | Resuelven interoperabilidad entre proveedores remotos; los Sub-Egos de Ego son internos | `orquestacion-multiagente.md` §7.2-7.3 |
| Mercado o registro remoto de agentes | El mercado no está maduro; un servicio de publicación es coste operativo permanente sin capacidad técnica | `compatibilidad-integraciones-mcp-skills.md` §9.7 · `orquestacion-multiagente.md` §7.4 |
| Taxonomía fija de roles CEO/CTO/CFO/QA | Contradice el principio 4: los Sub-Egos son dinámicos por dominio | `docs/architecture/agentes.md` · `plantillas-agentes-y-enjambres.md` §9.1 |
| Plugins con hooks por plantilla (estilo Claude Code) | Duplica el bus de hooks canónico y rompe la gobernanza centralizada | `packages/events/src/EventBus.ts:284` (CFG-09) |
| Plugins que cargan código de terceros (JS de OpenCode, Python de Hermes) | Rompe TypeScript estricto y el modelo de sandbox | `plantillas-agentes-y-enjambres.md` §9.1 · `AGENTS.md` §4 |
| Flujos visuales de agentes (Dify, Flowise, Langflow, n8n embebido) | Producto distinto, ya cubierto por el Canvas de Ego | `automatizacion-y-agentes-ejecucion.md` §10.3 |
| ERP o backoffice completo | Contaminación de dominio; ningún OSS cubre "razonar sobre el backoffice" | `AGENTS.md` §4 · `backoffice-empresa-personal.md` §"Regla de contaminación de dominio" |
| CRM propio (Twenty, EspoCRM, SuiteCRM) | Duplica `CrmDomain` y arrastra AGPL | `packages/domains/src/crm/CrmDomain.ts:71` |
| Contabilidad fiscal, IVA, libros oficiales | Riesgo legal: ningún motor OSS sin licencia cualificada es apto | `backoffice-empresa-personal.md` §"Contabilidad fiscal" |
| Motor de facturación y pasarela de pago | `docs/product/modelo-economico.md` §Facturación ya delega el cobro a un MoR | Coherencia con el modelo de negocio |
| WMS e inventario propios | InvenTree es MIT y ya expone REST; Ego sólo necesita la proyección | `backoffice-empresa-personal.md` §"Inventario y activos" |
| WhatsApp no oficial (Baileys, whatsapp-web.js, wa-automate) | Ingeniería inversa del protocolo, ToS y baneo del número de negocio | `canales-comunicacion-y-social.md` §3.1.2 · `AGENTS.md` §4 |
| X y LinkedIn en la v1 de canales | Revisión de acceso a nivel de aplicación y límites por cuenta | `canales-comunicacion-y-social.md` §6.3 |
| Computer-use por coordenadas en P0 | La unidad de riesgo pasa a ser la acción, no revisable por un humano | `automatizacion-y-agentes-ejecucion.md` §6.3 · principio 6 |
| Sustituir el Backlog Maestro por Plane/Redmine/OpenProject | El Backlog es la fuente única de verdad; las alternativas son AGPL/GPL | `docs/roadmap/Backlog.md:12` · `jerarquia-canonica.md` |
| Publicación automática de releases (`semantic-release`) | `release-please` con humano es deliberadamente más seguro para un producto firmado | `.github/workflows/release-please.yml:3-4,24` |
| Servidor de observabilidad (Grafana, Loki, Tempo, Netdata) | El "servidor" de Ego es su propio `EgoMemoryAdapter` | Principio 1 (local-first) |
| GitOps (Argo CD, Flux) | Ego es desktop: no hay cluster ni cluster API | `producto-y-desarrollo-como-empresa.md` §9.1 |
| Asistente local completo (Open WebUI, LobeChat, Jan, AnythingLLM) | Ninguno aporta un mecanismo de ejecución que Ego no tenga | `automatizacion-y-agentes-ejecucion.md` §7.1 |
| C4 / Structurizr como DSL de diagramas | El nivel 5 ya está resuelto con Mermaid en el catálogo del Canvas | `jerarquia-canonica.md` §"Separación Capability/Arquitectura/Diseño" |
| Cómputo de embeddings en TypeScript en el fast path | El binding in-process es BM25 puro por diseño | `AGENTS.md` §4 (prohibiciones absolutas) |

---

## 6. Mapa de fases y compuertas propuestas ##

> **Propuesta, no modificación.** No se ha tocado `docs/roadmap/Backlog.md`. Las tareas canónicas de esta
> tabla **esperan aprobación del owner**; hasta entonces no existen.

| Fase destino | Capacidad | Compuerta de extracción que habría que añadir | Depende de |
| --- | --- | --- | --- |
| **02 Acción** | `SYN-03` (parte A:Roots, resources, prompts, anotaciones) | Nueva compuerta `MCPS-10` a partir de `MCPS-01..09` (`docs/review/backlog-mcp-servers.md`) | `ACT-09` |
| **02 Acción** | `SYN-04` (presupuesto triple + reloj de pared + modo de durabilidad por paso) | Cerrar `MSWE-01/02/03` y `OHND-03/04/06` | `ACT-02`, `ACT-03` |
| **03 Sub-Egos** | `SYN-02` (tipo `SubEgoTemplate`) | Nueva compuerta `OCDE-10` (importador) sobre `docs/review/backlog-opencode.md` | `SUB-01`, `SUB-07` |
| **03 Sub-Egos** | `SYN-01` (importador) | Igual que la anterior | `SYN-02` |
| **03 Sub-Egos** | `SYN-06` (guardrails) | Cerrar `QWEN-01` (riesgo de tool MCP no derivado del nombre) y `GCLI-04` (prioridad de reglas) | `SUB-01`, `SEC-05` |
| **04 Canvas** | `SYN-08` (grafo declarativo) | **Diferido**: sólo tras cerrar `SYN-05` | `CANV-01`, `CANV-02` |
| **07 Tasks** | `SYN-04` (aprobación suspendida persistida + ledger de idempotencia) | Cerrar `OCDE-02` (inbox durable) y `CDX-02` (caché de aprobación por clave) | `TASK-01`, `TASK-03` |
| **09 Dominios** | `SYN-07` (canal como adaptador) | Nueva compuerta `DIFY-01` o equivalente; revisar `docs/review/backlog-*` | `DOM-05`, `DOM-09` |
| **10 Recovery** | `SYN-05` (delegación durable + presupuesto de cadena) | Cerrar `DSEK-03` (IDs opacos) y `HELM-08` (procesos de agente) | `SUB-06`, `SUB-09` |
| **11 Security** | `SYN-03` (parte B: OAuth 2.1, validación de `Origin`) | Cerrar `MCPS-07` (`listChanged` declarado y nunca emitido) | `SEC-03`, `SEC-05` |
| **11 Security** | `SYN-06` (guardrails por Sub-Ego) | Cerrar `GOOS-03` (inspector de egreso) | `SEC-05` |
| **transversal** | `SYN-10` (spec + trazabilidad + gates) | Nueva compuerta de **spec** en el protocolo Opción B (`Backlog.md:118-124`) | `KB-11` |
| **09/12** | `SYN-09` (proyección de backoffice) | Nueva compuerta de dominio; requiere decisión de owner sobre `finance` | `DOM-09` |

### 6.1 Orden de ejecución y por qué ##

`AGENTS.md` §6 impone el orden secuencial por fases, pero dentro de la fase 12 hay un orden técnico que
importa. La secuencia real de trabajo es:

1. `SYN-03` — sin un cliente MCP correcto, todo lo demás multiplica fallos.
2. `SYN-10` — sin compuerta de spec, el resto entra al Backlog sin criterio de aceptación.
3. `SYN-02` → `SYN-01` — el importador necesita el tipo destino; el tipo no necesita el importador.
4. `SYN-04` → `SYN-05` → `SYN-06` — la idempotencia y la persistencia de la aprobación son la base del
   presupuesto de cadena y de las guardrails por Sub-Ego.
5. `SYN-07` — necesita la idempotencia de `SYN-04` para no duplicar correos ni posts.
6. `SYN-08` — sólo después de `SYN-05`.
7. `SYN-09` — la más tardía y la más condicionada por decisión de owner.

---

## 7. Dependencias y bloqueos ##

### 7.1 Dependencias internas verificadas ##

| Dependencia | Estado verificado | Consecuencia |
| --- | --- | --- |
| `ApprovalEngine` pendiente en memoria (`ApprovalEngine.ts:121`) | `🆕 Pendiente` — no hay persistencia | `SYN-04` es prerequisito de `SYN-05` y `SYN-07` |
| `TaskCheckpointManager` (`TaskCheckpoint.ts:16`) | `✅ Completada` — `saveCheckpoint` (`:28`), `loadLatestCheckpoint` (`:67`), `clearCheckpoints` (`:115`) | Falta `restore`/`branch`: el time-travel sigue abierto (deuda E9) |
| `BackgroundEngine` (`BackgroundEngine.ts:39`) | `✅ Completada` — `checkpointProvider` (`:17`), `resume(taskId)` (`:327`) | La reanudación ya existe en el motor; falta en la aprobación |
| `DelegationRouter` (`DelegationRouter.ts:327`) | `✅ Completada` y cableado (`main.ts:1650`) | Falta checkpoint y ledger: 0 coincidencias de `checkpoint`/`resume`/`idempot`/`AbortSignal` |
| `configureHooks()` (`EventBus.ts:284`) | `🆕 Pendiente` — sólo tests | El bus de hooks existe pero nunca se configura: hay que cerrarlo antes de `SYN-02` |
| `DreamConsolidator` / `MemoryCurator` | `🆕 Pendiente` — 0 instanciaciones en `src/` | La consolidación onírica no corre al arrancar: bloquea la hipótesis de memoria (§4.8) |
| `SkillScanner` (`SkillScanner.ts:28`) | `✅ Completada` y cableado (`main.ts:1686`) | Base reutilizable de `SYN-01`: sólo hay que ampliar el radio de búsqueda |
| `ProjectMemoryGraph` (`ProjectMemoryGraph.ts:36`) | `✅ Completada` | Grafo disponible para el contrato de `SYN-10`; falta el contrato, no el grafo |
| `HybridSearch` sin RRF | `✅ Completada` pero con `TODO(EGO-FIND-41 / VDB-REQ-08)` | La calidad de recuperación condiciona el valor de `SYN-01` y `SYN-07` |

### 7.2 Bloqueos que sólo el owner puede levantar ##

| # | Bloqueo | Por qué no lo puede resolver un agente | Impacto |
| --- | --- | --- | --- |
| B1 | **Certificados de firma** (`DIST-04`, `docs/roadmap/Backlog.md:559`) | Requiere comprar/emitir certificados y decidir la autoridad de firma | Bloquea la instalación distribuible y, por tanto, la prueba en frío de `SYN-04` y `SYN-05` |
| B2 | **Credenciales de canal de escritura** (OAuth de X, LinkedIn, apps de Slack/Discord/Google) | Requiere cuentas, revisiones de plataforma y decisiones de identidad de marca | Limita `SYN-07` a los cinco canales de v1 sin revisión |
| B3 | **Dirección de producto: ¿Ego publica un catálogo remoto de Sub-Egos?** | Decisión de modelo de negocio (`AGENTS.md` §8) | Bloquea la parte de publicación de `SYN-02`; no bloquea el importador |
| B4 | **Dirección de producto: ¿se crea el dominio `finance`?** | Decisión de jerarquía de dominios (`docs/architecture/dominios-funcionales.md`) | Bloquea `SYN-09` |
| B5 | **Dirección de producto: ¿la spec vive en el repo o en VantaDB?** | Afecta al ciclo de revisión por PR y al principio local-first | Bloquea `SYN-10` |
| B6 | **Alcance de la primera versión de canales** | Decisión de producto sobre a qué identidades escribe Ego | Bloquea el dimensionamiento de `SYN-07` |

---

## 8. Riesgos ##

| # | Riesgo | Prob. | Impacto | Mitigación propuesta |
| --- | --- | --- | --- | --- |
| R1 | **Duplicar un módulo canónico**: crear un segundo `ToolRegistry`, un segundo gestor de aprobaciones o un segundo motor de ejecución | Media | Crítico | Regla D3 de `AGENTS.md` §4: cada capacidad nueva debe citar el módulo canónico que extiende, no uno que lo sustituye. Revisión en la compuerta de cada fase |
| R2 | **Importar secretos de terceros**: los ficheros de configuración ajenos traen tokens en claro | Alta | Crítico | Importación **fail-closed**, `read-only`, opt-in y sin red; los valores `env`/`headers` se traducen a `{{SECRET:...}}` (`SecretProxy.ts:32-64`) y al `CredentialManager`, nunca al valor. El `SkillLinter` audita todo script importado |
| R3 | **Publicación irreversible en nombre del usuario**: un post viralizado o un correo enviado no se retiran | Media | Crítico (legal y reputacional) | Aprobación por `inputDigest` exacto (`ApprovalEngine.ts:75`), estado `UNKNOWN` que bloquea el reintento ciego, y v1 restringida a protocols abiertos y bots |
| R4 | **Sobreingeniería del motor**: un grafo o un motor de workflows propio compite con el Decision Router y el Canvas | Alta | Alto | `SYN-08` diferido explícitamente; todo lo demás es *extensión* de `packages/runtime` y `packages/subegos`, nunca un runtime nuevo |
| R5 | **Degradación silenciosa**: el sistema aparenta completar una tarea que no completó | Media | Alto | Desenlace terminal tipado con `reason` explícito (`budget_exhausted`, `wall_clock_exceeded`), nunca corte brusco del turno; y cuantificar lo que se recorta de contexto |
| R6 | **Licencia contaminante**: copiar código de AGPL/GPL/SSPL/FSL/source-available | Media | Crítico | Lista negra viva en los informes; sólo son portables Temporal, DBOS, LangGraph, CrewAI, Trigger.dev, Playwright/Puppeteer y browser-use (MIT/Apache-2.0). Cada dependencia nueva exige comprobación de SPDX antes de entrar |
| R7 | **Ruptura de la compuerta de extracción**: cierre de la matriz de compuertas de la fase sin pasar por ella | Media | Alto | Cada capacidad de §3 trae su compuerta propuesta en §6; el owner la aprueba antes de que exista tarea |
| R8 | **Coste de tokens no acotado**: una cadena de delegación multiplica el presupuesto sin que ningún Sub-Ego lo note | Media | Alto | Presupuesto agregado por cadena (`SYN-05`) más reloj de pared (`SYN-04`); hoy el corte es por Sub-Ego (`packages/subegos/src/SubEgoBudget.ts:103`) |

---

## 9. Deuda abierta y preguntas para el owner ##

Las preguntas siguientes **no tienen respuesta derivable de la evidencia**: cambian la arquitectura y sólo el
owner puede fijarlas. Cada una lleva su recomendación, pero la decisión es suya.

### 9.1 Decisiones estructurales ###

- **1. ¿Catálogo de Sub-Egos local-only o registro remoto?**
  Contexto: publicar un catálogo remoto exige identidad, firma, moderación y política de RGPD sobre la
  `description` de cada plantilla. Un índice federado (`index.json`) es trivial de implementar y no obliga a
  nada.
  Opciones: (a) sólo local + exportable; (b) registro remoto estilo MCP Registry; (c) híbrido.
  *Recomendación: (a) local + exportable en la primera iteración.* No bloquea `SYN-01` ni `SYN-02`.

- **2. ¿`SubEgoTemplate` es un tipo nuevo o una extensión del manifiesto?**
  Contexto: un tipo nuevo garantiza que la plantilla no arrastra estado (`state: "active"`); uno solo reduce
  código pero mezcla instancia y catálogo.
  Opciones: (a) tipo nuevo, subconjunto declarativo del manifiesto; (b) campos opcionales en el manifiesto.
  *Recomendación: (a) tipo nuevo.* Es la base de `SYN-01` y de `SYN-02`.

- **3. ¿Se crea el dominio `finance` o se extiende `crm`?**
  Contexto: `docs/architecture/namespaces.md:25,27` declara `ecom/*` y `finance/*` sin dominio implementado, y
  `packages/domains/src/types.ts:67-72` sólo conoce cinco dominios. Crear `finance` obliga a migrar
  `ecom/*`; extender `crm` mezcla dinero con relaciones comerciales.
  Opciones: (a) dominio `finance` nuevo con migración versionada; (b) ampliar `crm`; (c) no crear dominio y
  quedarse sólo con conectores de lectura.
  *Recomendación:* (a), pero sólo en Fase 09 y sólo si la Fase 0 de conectores demuestra demanda.
  Sin esta decisión, `SYN-09` no puede entrar al Backlog.

- **4. ¿Cuál es la semántica de entrega por defecto de un paso con efecto externo?**
  Contexto: con ledger de idempotencia, un paso puede ser *at-most-once* (si falla, no se reintenta) o
  *at-least-once* (se reintenta y el ledger evita el doble efecto). Determina si `ToolRegistry` debe exigir
  `effectKey` a toda tool con efecto.
  Opciones: (a) *at-most-once* para efectos irreversibles y *at-least-once* para el resto; (b) *at-least-once*
  para todo; (c) *at-most-once* para todo.
  *Recomendación: (a)*: coincide con el criterio de irreversibilidad por objetivo.

- **5. ¿Qué ocurre si el usuario no responde a una aprobación suspendida?**
  Contexto: `ApprovalEngine` mantiene las pendientes en memoria; al persistirlas hay que fijar la expiración.
  Opciones: (a) abortar (por defecto para acciones sensibles); (b) degradar a una tool de sólo lectura;
  (c) volver a preguntar con más contexto.
  *Recomendación:* (a) abortar por defecto, con (c) como política declarada por Sub-Ego.

### 9.2 Decisiones de dirección de producto ###

- **6. ¿Ego publica en redes sociales en nombre del usuario, o sólo responde?**
  Contexto: publicar es irreversible y la aprobación previa deja de ser opcional; la identidad del bot es
  distinta de la del usuario y hay que declararlo en el pie del mensaje.
  Opciones: (a) sólo lectura y respuesta; (b) publicación con aprobación obligatoria; (c) publicación
  automática con kill-switch.
  *Recomendación:* (b) en v1, con (c) vedada mientras `SYN-07` no tenga idempotencia y consentimiento.

- **7. ¿La spec por feature vive en el repo o en VantaDB?**
  Contexto: el repo da revisión por PR, histórico en git y CI; VantaDB da coherencia con el principio
  local-first y con el Project Memory Graph.
  Opciones: (a) `docs/specs/<ID>-<slug>/` en el repo; (b) en VantaDB; (c) híbrido con el índice en git.
  *Recomendación:* (c) — el índice y el `evidence.md` en git, el cuerpo del spec en VantaDB.

- **8. ¿Se acepta el coste de mantener `docs/specs/` y el gate de trazabilidad, o se postpone?**
  Contexto: es 4-7 días y desbloquea la compuerta de spec, pero añade proceso a un equipo de una persona.
  *Recomendación:* aceptar, empezando por 3 features piloto y midiendo el tiempo real antes de generalizar.

### 9.3 Decisiones operativas y de plataforma ###

- **9. ¿Se invierten los esfuerzos de la Fase 02 en `SYN-03` antes que en las tareas ya completadas?**
  Contexto: `SYN-03` es deuda real (capacidad `roots` falsa, revisión de protocolo dos veces antigua) pero
  las fases 01-11 están marcadas como completadas. `AGENTS.md` §6 no contemplate reinspecciones.
  *Recomendación: aprobar `SYN-03` como trabajo de remediación con su propia compuerta, no como tarea
  ordinaria de Fase 02.*

- **10. ¿Quién opera la VM de clean machine (`DIST-06`) y los certificados (`DIST-04`)?**
  Contexto: ambas tareas están bloqueadas por el owner desde 2026-10-13 y son el único camino para validar
  la persistencia de la aprobación en un arranque en frío real.
  *Recomendación:* desbloquear `DIST-06` antes que `DIST-04`: la VM es gratuita y ya valida `SYN-04`.

---

## Referencias internas ##

- [`orquestacion-multiagente.md`](./orquestacion-multiagente.md) — §5 mecanismos transversales, §9 recomendación
- [`plantillas-agentes-y-enjambres.md`](./plantillas-agentes-y-enjambres.md) — §7 diseño de referencia, §9 veredictos
- [`backoffice-empresa-personal.md`](./backoffice-empresa-personal.md) — §"Matriz de capacidades", §"Recomendación"
- [`canales-comunicacion-y-social.md`](./canales-comunicacion-y-social.md) — §5 modelo de contacto, §6 publicación
- [`compatibilidad-integraciones-mcp-skills.md`](./compatibilidad-integraciones-mcp-skills.md) — §4, §8
- [`automatizacion-y-agentes-ejecucion.md`](./automatizacion-y-agentes-ejecucion.md) — §5 mecanismos, §8 diseño
- [`producto-y-desarrollo-como-empresa.md`](./producto-y-desarrollo-como-empresa.md) — §5, §9
- [`arquitectura-master-matrix.md`](./arquitectura-master-matrix.md) — contraste con el documento maestro externo
- [`../roadmap/Backlog.md`](../roadmap/Backlog.md) — Backlog Maestro y matriz de compuertas
- [`../extractions/README.md`](../extractions/README.md) — catálogo de las 25 fichas de extracción
- [`rfc-viability-top.md`](./rfc-viability-top.md) — RFC de viabilidad de las propuestas top
