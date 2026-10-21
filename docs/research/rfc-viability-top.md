# RFC de viabilidad: propuestas top para Ego #

| Campo | Valor |
| --- | --- |
| Estado | Research — Vía 2 del protocolo de extracción. Propuesta, **no normativo** |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Alcance | Viabilidad de 8 capacidades top derivadas de la síntesis de 7 informes de estado del arte |
| Naturaleza | No implementa, no modifica `packages/`, no añade tareas al Backlog Maestro |

> **Nada de este documento es normativo.** Lo que gobierna el producto son
> [`docs/jerarquia-canonica.md`](../jerarquia-canonica.md),
> [`docs/product/principios-innegociables.md`](../product/principios-innegociables.md),
> [`AGENTS.md`](../../AGENTS.md) y los ADR.
> La matriz de decisión completa está en [`sintesis-capacidades-ego.md`](./sintesis-capacidades-ego.md).
> **Ninguna ruta citada en este documento ha sido modificada**: todas las referencias `fichero:línea` son
> lecturas verificadas el 2026-10-20.

---

## 0. Cómo leer este RFC ##

Cada RFC tiene las mismas subsecciones, numeradas con el ID del RFC para que la estructura sea estable y
referenciable:

| Subsección | Qué responde |
| --- | --- |
| Contexto y problema | Por qué esta capacidad y no otra |
| Propuesta y contrato público | Qué se construye, en qué paquete, con qué superficie pública |
| Encaje en la arquitectura | Ficheros afectados y módulos canónicos que se reutilizan en vez de duplicar |
| FMEA simplificado | Modo de fallo, probabilidad, impacto y mitigación |
| Dependencias y prerequisites | Qué falta, con su estado verificado |
| Security y privacidad | Qué datos toca, qué queda fuera, qué exige aprobación humana |
| Esfuerzo y fase destino | Días-ingeniero y fase del roadmap de `AGENTS.md` §6 |
| Alternativas descartadas | Qué se descarta por el mismo objetivo y por qué no |
| Sobreingeniería | Qué parte es demasiado grande para hacer hoy |
| Veredicto | `Adoptar`, `Adaptar` o `Descartar` con una frase |

Las capacidades `SYN-08` (grafo declarativo) y `SYN-09` (proyección de backoffice) **no** tienen RFC propio:
su veredicto es diferido y su bloqueante es una decisión de owner (§9 de la síntesis).

---

## RFC-01 — Importador de definiciones de agentes y skills ##

### RFC-01.1 Contexto y problema ##

El usuario de Ego llega con un ecosistema ya poblado: Claude Code, Cursor, Codex, Gemini CLI, OpenCode, Cline,
Continue y Goose ya están instalados en su máquina, cada uno con sus agentes, sus skills y sus reglas de
proyecto. El `SkillScanner` de Ego sólo recorre dos rutas propias —`.ego/skills` y `~/.ego/skills`
(`packages/integrations/src/skills/SkillScanner.ts:42-45`)— de modo que **ninguna** de esas definiciones es
visible para Ego. Codex ya resolvió exactamente este problema con su crate `external-agent-migration`, que
implementa el pipeline `detect → read → normalize → validate → catalogue → dry-run`; ese diseño es el
precedente directo y extrapolable a Ego. El problema que resuelve no es técnico sino de arranque en frío: un
catálogo de Sub-Egos vacío es un producto sin voz propia.

### RFC-01.2 Propuesta y contrato público ##

Se construye un `SubEgoImportScanner` de **solo lectura, opt-in y fail-closed** en
`packages/integrations/src/agentImport/`. Detecta rutas candidatas sin abrirlas; lee un fichero sólo cuando el
usuario ha aprobado ese fichero concreto; lo traduce a `SubEgoTemplate` (RFC-02) mediante un traductor por
aplicación; marca el resultado como `lossy` con la lista de campos sin equivalente; y sólo escribe en
`gov/sub_egos_templates/<templateId>` a través de `EgoMemoryAdapter`, nunca en la configuración de terceros.

```typescript
export type AgentImportAppId =
  | "claude-code"
  | "gemini-cli"
  | "opencode"
  | "codex"
  | "qwen-code"
  | "goose"
  | "cline"
  | "continue";

export interface AgentImportCandidate {
  appId: AgentImportAppId;
  path: string;
  format: "markdown-frontmatter" | "toml-role" | "json-config";
  lossyFields: string[];
  preview: SubEgoTemplatePreview;
}

export interface AgentImportScannerOptions {
  /** Por defecto `true`: la importación nunca escribe sin un segundo paso explícito. */
  dryRunOnly: boolean;
  /** Subconjunto de rutas que el usuario ha autorizado en la UI. */
  allowedPaths: string[];
}

export interface SubEgoImportScanner {
  detect(): Promise<AgentImportCandidate[]>;
  importApproved(candidates: AgentImportCandidate[]): Promise<ImportResult>;
}
```

La importación **siempre** produce una plantilla con `autonomy: "supervised"` y el presupuesto por defecto
(4000 tokens por llamada, 2,0 USD diarios, 0,5 USD umbral de aprobación), con independencia de lo que diga el
origen. El usuario amplía después.

### RFC-01.3 Encaje en la arquitectura ##

Ficheros afectados (rutas reales, verificadas con `grep` el 2026-10-20):

| Ruta | Papel |
| --- | --- |
| `packages/integrations/src/agentImport/` | Nuevo: detección, lectura, normalización, previsualización |
| `packages/integrations/src/skills/SkillScanner.ts:28` | **Reutilizado**, no reescrito: se amplía su radio de búsqueda |
| `packages/integrations/src/skills/SkillLinter.ts:82` | **Reutilizado**: audita todo script importado |
| `packages/subegos/src/SubEgoRegistry.ts:228` | **Reutilizado**: patrón de registro en `gov/sub_egos` replicado para `gov/sub_egos_templates` |
| `packages/memory/EgoMemoryAdapter.ts` | **Reutilizado**: única vía de persistencia (`AGENTS.md` §4) |
| `apps/desktop/src/main.ts:1686` | Punto de cableado: hoy instancia `SkillScanner`; el importador se registra como hermano |
| `apps/desktop/src/main/state/app-context.ts:226-229` | Estado y `setSkillScanner`; sigue el mismo patrón |

Módulos canónicos que se reutilizan en vez de duplicar: `EgoMemoryAdapter`, `SkillLinter`, `SecretProxy`
(`packages/integrations/src/mcp/SecretProxy.ts:32-64`, prefijo `EGO_SECRET_` y marcador `{{SECRET:...}}`),
`ApprovalEngine` (`packages/execution/src/ApprovalEngine.ts:75`), `NetPolicy`
(`packages/tools/src/native/security/NetPolicy.ts`) y `UntrustedContentSanitizer`
(`packages/memory/UntrustedContentSanitizer.ts:132`).

**No se toca** el runtime cognitivo, el Model Router, el Sub-Ego Runtime ni el Canvas: se cumple el criterio de
`docs/engineering/integraciones.md` de que agregar una integración no modifica el núcleo.

### RFC-01.4 FMEA simplificado ##

| Modo de fallo | Probabilidad | Impacto | Mitigación |
| --- | --- | --- | --- |
| Lectura de un token en claro desde un config ajeno | Alta | Crítico | Traducir `env`/`headers` a `{{SECRET:...}}` y al `CredentialManager`; nunca persistir el valor; nunca enviar a la red |
| Importar permisos excesivos (`allowed-tools`, toolsets agresivos) | Media | Alto | Importar siempre con `autonomy: "supervised"` y presupuesto por defecto; ampliación sólo por el usuario |
| Inyección de prompt en la `description` de un agente ajeno | Media | Alto | Marcar la descripción importada como no confiable para el auto-routing del Decision Router; saneado y longitud máxima |
| Colisión de IDs entre dos apps que proponen el mismo nombre | Alta | Medio | Prefijar por origen (`ego.imp.<app>.<slug>`) y pedir confirmación explícita en la colisión |
| Deriva de formato cuando una app cambia sus campos | Media | Medio | Tolerancia a campos desconocidos, `schemaVersion` propio y test de contrato por app |
| Importar un `SKILL.md` con `scripts/` ejecutables | Media | Alto | `SkillLinter` sobre los scripts importados y revisión humana obligatoria de todo script |
| Doble fuente de verdad si el usuario edita el config de origen | Alta | Bajo | Marcar `source: "imported"` y ofrecer re-escaneo, nunca sincronización bidireccional |
| Saturación de contexto con 200 agentes importados | Media | Medio | Indexar el catálogo por `description`; no inyectarlo completo en el prompt |

### RFC-01.5 Dependencias y prerequisites ##

| Dependencia | Estado verificado | Nota |
| --- | --- | --- |
| Tipo `SubEgoTemplate` (RFC-02) | 🆕 Pendiente | Bloqueante: sin modelo destino no hay traducción |
| `ACT-11` — marketplace local de MCP y skills | ✅ Completada (`docs/roadmap/Backlog.md:218`) | Ya existe la UI de configuración de carpetas de skills |
| `SUB-07` — registro de Sub-Egos en `gov/sub_egos` | ✅ Completada (`Backlog.md:248`) | Se replica el patrón de validación Zod fail-closed |
| `SkillScanner` cableado en producción | ✅ Completada (`apps/desktop/src/main.ts:1686`) | Reutilizable tal cual |
| `SecretProxy` y `CredentialManager` | ✅ Completada (`packages/integrations/src/mcp/SecretProxy.ts:32`; `packages/security/src/CredentialManager.ts:335`) | Ya resuelven el "no secreto en storage" |
| Tabla de rutas por app | Parcialmente verificada | Las rutas de Cursor y de los roles de Codex están marcadas **no verificadas** en `plantillas-agentes-y-enjambres.md` §10.1 |

### RFC-01.6 Security y privacidad ##

- **Qué toca**: ficheros de configuración de terceros (`~/.claude/agents/*.md`, `~/.gemini/agents/*.md`,
  `~/.config/opencode/agents/*.md`, `~/.codex/agents/*.toml`, entre otros). Pueden contener tokens en claro.
- **Qué queda fuera**: nunca escribe en la configuración de origen; nunca copia secretos a VantaDB; nunca
  envía nada a la red; nunca reporta telemetría sobre qué apps tiene instaladas el usuario.
- **Qué exige aprobación humana**: el gate HITL es **único** y está entre el dry-run y la activación. Antes de
  él todo es reversible y sin efecto. La UI debe listar qué apps se han detectado y qué ficheros se van a
  leer **antes** de leerlos, con los valores de entorno enmascarados.
- **Residuo**: los `description` importados son no confiables para el auto-routing; los scripts importados
  requieren revisión humana; la licencia de origen se conserva y se muestra de forma visible.

### RFC-01.7 Esfuerzo y fase destino ##

**12-18 días-ingeniero.** Fase 03 (Sub-Egos). Depende de `SYN-02` y abre la puerta a `SYN-02`'s exportadores.
No depende de ninguna decisión de owner: la política de publicación remota es ortogonal al importador.

### RFC-01.8 Alternativas descartadas ##

| Alternativa | Por qué no |
| --- | --- |
| Sincronización bidireccional con los configs de origen | Doble fuente de verdad; el usuario puede editar el fichero y Ego no se entera |
| Importar plugins con código ejecutable | Rompe TypeScript estricto y el modelo de sandbox; salto de riesgo alto |
| Formato propio de skill (`ego-skill.md`) | Bifurca el estándar `SKILL.md`, que es el denominador común real del ecosistema |
| Detección por binario en `PATH` o por registro de Windows | Fiabilidad baja; sólo informativo |
| Importar los plugins de las apps web (Dify, n8n, Open WebUI) | Su configuración vive en base de datos, no en un fichero local canónico |

### RFC-01.9 Riesgos de sobreingeniería ##

Lo demasiado grande para hacer hoy: leer bases de datos de aplicaciones web, parsear los cuatro formatos
Markdown completos (Claude Code, Gemini CLI, OpenCode, Codex) desde el primer día — se empieza por **un**
traductor (Claude Code, que es el más completo) y se añade el resto cuando el usuario lo pida. Tampoco se
construye un "gestor de plugins" con ciclo de vida completo: sólo el importador.

### RFC-01.10 Veredicto ##

**Adoptar** — es la capacidad de mejor relación valor/esfuerzo de la hoja de ruta y no depende de ninguna
decisión de producto pendiente.

---

## RFC-02 — Tipo `SubEgoTemplate` y catálogo versionado ##

### RFC-02.1 Contexto y problema ##

Ego tiene el manifiesto de una instancia viva (`packages/subegos/src/SubEgoManifest.ts:88-122`) y dos catálogos
de plantillas en código (`packages/subegos/src/templates/domainTemplates.ts:41` y
`packages/domains/src/templates/officialSubEgoTemplates.ts:6`), pero el tipo `DomainTemplate`
(`packages/subegos/src/templates/domainTemplates.ts:11-36`) **no tiene `version` ni `license`**. Sin esas dos
cosas una plantilla no es publicable, no se puede versionar, no se sabe de dónde salió una instancia y
no se puede distinguir una plantilla importada de una propia. El hueco de mercado real es precisamente este:
el estándar `SKILL.md` define *qué hacer*, `AGENTS.md` define *contexto de repositorio*, y **nadie** ha
estandarizado el manifiesto completo de un agente — identidad, rol, herramientas, permisos, presupuesto y alma.
Ese hueco es la oportunidad de Ego.

### RFC-02.2 Propuesta y contrato público ##

Se introduce un tipo `SubEgoTemplate` en `packages/subegos/src/`, **subconjunto declarativo** del manifiesto,
con metadatos de publicación (`version` semver, `author`, `license` SPDX, `domain`, `tags`, `extends`) y sin
ningún campo de instancia (`id`, `state`, `creator`, `createdAtMs`, `updatedAtMs`, `metadata` de runtime).

```typescript
export interface SubEgoTemplateMeta {
  name: string;
  description: string;
  version: string;
  author: string;
  license: string;
  domain: string;
  tags: string[];
  extends?: string[];
}

export interface SubEgoTemplate {
  templateId: string;          // "tpl.<dominio>.<slug>", opaco
  meta: SubEgoTemplateMeta;
  role: string;
  responsibilities: string[];
  capabilities: string[];
  instructions: string;
  toolsets: string[];
  permissions: string[];
  namespaces: { read: string[]; write: string[] };
  autonomy: "supervised" | "semi-autonomous" | "autonomous";
  budget: { maxTokensPerCall: number; maxDailyCostUsd: number; requiresApprovalAboveUsd: number };
  soul?: SubEgoSoulConfig;
}

export function templateToManifest(tpl: SubEgoTemplate, id: string): SubEgoManifest;
```

Tres niveles de catálogo, sin servidor obligatorio: (1) catálogo local embebido, migrando `DOMAIN_TEMPLATES` y
`OFFICIAL_SUBEGO_TEMPLATES` al tipo nuevo; (2) registro por proyecto en VantaDB
(`gov/sub_egos_templates/<templateId>`) con su `source` (`builtin` | `local` | `imported` | `remote`); y (3) un
índice federado opcional (`index.json`) que es un fichero y puede leerse de disco, de un repo o de una URL.
Actualizar una plantilla **no** muta instancias existentes: la instancia sólo cambia si el usuario lo acepta.

### RFC-02.3 Encaje en la arquitectura ##

| Ruta | Papel |
| --- | --- |
| `packages/subegos/src/SubEgoTemplate.ts` | Nuevo: tipo Zod + `SubEgoTemplateSchema` |
| `packages/subegos/src/templates/domainTemplates.ts:11` | **Migrado** de `DomainTemplate` a `SubEgoTemplate` |
| `packages/domains/src/templates/officialSubEgoTemplates.ts:6` | **Migrado** en bloque, con `meta.version` y `meta.license` |
| `packages/subegos/src/SubEgoFactory.ts:290` | **Reutilizado**: punto de instanciación desde plantilla |
| `packages/subegos/src/SubEgoRegistry.ts:228` | **Reutilizado**: patrón de registro y protección de entidades de sistema |
| `packages/subegos/src/SubEgoManifest.ts:88` | **Reutilizado**: destino del `templateToManifest` |
| `packages/subegos/src/SubEgoSoul.ts:174` | **Reutilizado**: el alma es el mismo contrato, en forma declarativa |
| `packages/subegos/src/SubEgoBudget.ts:103` | **Reutilizado**: los defaults de presupuesto ya existen |

El `SubEgoManifest` **no** cambia: sólo se le añade el mapeo desde plantilla. El registro de Sub-Egos en
`gov/sub_egos` sigue siendo de instancias.

### RFC-02.4 FMEA simplificado ##

| Modo de fallo | Probabilidad | Impacto | Mitigación |
| --- | --- | --- | --- |
| Una plantilla hereda `state: "active"` y parece una instancia | Media | Alto | Tipo nuevo separado, no campos opcionales en el manifiesto |
| Instanciación que pierde un campo no soportado | Media | Medio | La traducción es una tabla explícita campo-a-campo; lo no soportado se rechaza en validación, no se ignora |
| Actualización de plantilla que muta instancias vivas | Media | Crítico | Regla dura: actualizar una plantilla no muta instancias; la migración es una acción del usuario |
| Licencia no compatible re-licenciada por error | Baja | Crítico | El importador rechaza (fail-closed) toda licencia no OSI; la plantilla conserva siempre la licencia de origen |
| Colisión de `templateId` entre catálogo embebido e importado | Media | Medio | Prefijo por origen y confirmación explícita en la colisión |

### RFC-02.5 Dependencias y prerequisites ##

| Dependencia | Estado verificado | Nota |
| --- | --- | --- |
| `SUB-01` — `SubEgoManifest` con Zod | ✅ Completada (`Backlog.md:242`) | El tipo destino ya es estable |
| `SUB-07` — registro en `gov/sub_egos` | ✅ Completada (`Backlog.md:248`) | Se replica el patrón para `gov/sub_egos_templates` |
| `SUB-02` — `SubEgoFactory` | ✅ Completada (`Backlog.md:243`; `packages/subegos/src/SubEgoFactory.ts:290`) | Punto de instanciación |
| `DOM-06` — plantillas oficiales | ✅ Completada (`Backlog.md:470`) | Es el catálogo que se migra |
| Decisión de owner sobre catálogo remoto | 🆕 Pendiente | No bloquea el tipo ni el catálogo local |

### RFC-02.6 Security y privacidad ##

- **Qué toca**: sólo metadatos declarativos y texto de instrucciones. Ningún dato personal.
- **Qué queda fuera**: ningún secreto en una plantilla; los `toolsets` son referencias a toolsets canónicos,
  nunca rutas absolutas ni credenciales.
- **Qué exige aprobación humana**: la **instanciación** de una plantilla importada exige aprobación, con la
  interfaz de aprobación ya existente (`ACT-06`/`ACT-07`). La plantilla en sí es un artefacto inerte.

### RFC-02.7 Esfuerzo y fase destino ##

**8-12 días-ingeniero.** Fase 03 (Sub-Egos). Es el prerrequisito de RFC-01 y de los exportadores.

### RFC-02.8 Alternativas descartadas ##

| Alternativa | Por qué no |
| --- | --- |
| Un tipo `SubEgoTemplate` con el `SubEgoManifest` como campo opcional | Mezcla catálogo y estado; una plantilla podría arrastrar `state: "active"` |
| Publicar un marketplace propio con servicio | Coste operativo permanente (hosting, moderación, firma, updates) sin capacidad técnica; el formato `marketplace.json` ya es interoperable |
| Un registro remoto de agentes | El mercado no está maduro; ninguna de las cuatro piezas de infraestructura de malla resuelve el problema de Ego |

### RFC-02.9 Riesgos de sobreingeniería ##

Lo demasiado grande para hacer hoy: el índice federado remoto, los exportadores a seis formatos de terceros y
el doble nivel de catálogo. Se empieza por el tipo + el catálogo local + `templateToManifest`, y el resto se
añade cuando alguien lo pide.

### RFC-02.10 Veredicto ##

**Adoptar** — es la base de tipo de RFC-01 y de cualquier catálogo publicable de Sub-Egos.

---

## RFC-03 — Contrato MCP al día: revisión vigente, descubrimiento completo y riesgo declarado ##

### RFC-03.1 Contexto y problema ##

La revisión vigente del protocolo MCP es `2026-07-28`; Ego está fijado a `2024-11-05`
(`packages/integrations/src/mcp/McpClient.ts:174` y `packages/integrations/src/mcp/McpServer.ts:153`), dos
revisiones por detrás. Peor: el cliente **anuncia una capacidad que no cumple** — `roots: { listChanged: true }`
en `:176` frente a la respuesta `-32601` en la ruta de `roots/list`—, que es exactamente lo que el servidor
oficial de filesystem llama durante su `initialize`. El cliente implementa `tools/list` (`:251-261`) pero no
`resources/list`, `resources/read`, `prompts/list` ni `prompts/get`, aunque el servidor sí los publica
(`McpServer.ts:127-133`): es una divergencia entre el código y `docs/engineering/integraciones.md:80`. Y el
riesgo de una tool se deduce del nombre (`inferRiskLevel`), de modo que `archive_file` o `git_commit` caen en
`sensitive` aunque el servidor declare `readOnlyHint: true`. Esto no es una deuda menor: **degrada a los
servidores oficiales antes de importar nada**.

### RFC-03.2 Propuesta y contrato público ##

Se cierra el contrato MCP en dos partes. La **parte A** (Fase 02): implementar `roots/list` o retirar `roots`
del handshake; implementar `resources/list`, `resources/read`, `prompts/list`, `prompts/get`; mapear las
anotaciones del servidor a `ToolRiskLevel` con prioridad sobre la heurística; y un versionado **dual-era**
(handshake `initialize` legacy y `_meta` modern, más `server/discover`). La **parte B** (Fase 11): OAuth 2.1
en el cliente remoto (PKCE, CIMD y DCR) con los secretos en el `CredentialManager`; envío de
`notifications/initialized` y de las respuestas server→cliente por HTTP; validación de `Origin` en el servidor
propio; y `MCP-Protocol-Version` en las cabeceras de Streamable HTTP.

```typescript
export type McpProtocolEra = "legacy" | "auto" | "2026-07-28";

export interface McpServerConfig {
  id: string;
  transport: "stdio" | "streamable-http";
  /** Nueva: decide la era de handshake negociada. */
  protocol?: McpProtocolEra;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}
```

El `ToolRiskLevel` sigue siendo `safe | sensitive | destructive`
(`packages/tools/src/types.ts:19`) y la regla de prioridad es: si el servidor declara anotaciones, **manda el
servidor**; la heurística por nombre sólo es el *fallback*.

### RFC-03.3 Encaje en la arquitectura ##

| Ruta | Papel |
| --- | --- |
| `packages/integrations/src/mcp/McpClient.ts:174` | Versión de protocolo, capacidades declaradas, `tools/list`, `inferRiskLevel` |
| `packages/integrations/src/mcp/McpClient.ts:251` | Descubrimiento de tools: hay que añadir `resources` y `prompts` |
| `packages/integrations/src/mcp/McpClient.ts:582` | Ruta de `roots/list` que hoy responde `-32601` |
| `packages/integrations/src/mcp/types.ts` | `McpToolDefinition` y `McpListToolsResult` (cursor de paginación ya declarado) |
| `packages/integrations/src/mcp/McpServer.ts:127` | `resources/list`, `prompts/list`: el servidor ya los publica |
| `packages/integrations/src/mcp/McpServer.ts:153` | Versión de protocolo y capacidades declaradas (`listChanged` sin emitir) |
| `packages/integrations/src/mcp/McpManager.ts:62` | Registro de servidores activos; soporte de `transport` y allowlist de spawn |
| `packages/integrations/src/mcp/SecretProxy.ts:32` | **Reutilizado**: los secretos de `env` y `headers` nunca salen en claro |
| `apps/desktop/src/main/mcp/mcp-http-server.ts` | Servidor HTTP de Ego; necesita `Origin` y `MCP-Protocol-Version` |
| `apps/desktop/src/main/mcp/mcp-server-runtime.ts` | Runtime del servidor MCP de Ego |

Módulos canónicos reutilizados: `ToolRegistry` (`packages/tools/src/ToolRegistry.ts:23`) para el registro de
tools, `ApprovalEngine` para la política, `SecretProxy` y `CredentialManager` para los secretos, `NetPolicy`
para la frontera de red.

### RFC-03.4 FMEA simplificado ##

| Modo de fallo | Probabilidad | Impacto | Mitigación |
| --- | --- | --- | --- |
| Servidor MCP remoto que exige OAuth y Ego no puede authenticarse | Alta | Alto | OAuth 2.1 nativo con PKCE/CIMD/DCR; secretos en el keychain, nunca en VantaDB |
| Servidor que llama `roots/list` y recibe `-32601` | Alta | Medio | Implementar `roots/list` o **retirar** `roots` del handshake; nunca anunciar lo que no se cumple |
| Tool destructiva clasificada como inocua por heurística de nombre | Media | Crítico | Las anotaciones del servidor mandan sobre la heurística |
| Pérdida de la segunda página de `tools/list` | Media | Medio | Iterar `nextCursor`, ya declarado en el tipo |
| Rotura de servidores legacy al pasar a modern | Media | Alto | Versionado dual-era con negociación, no un interruptor |
| Notificaciones y respuestas server→cliente que no viajan por HTTP | Alta | Medio | Enviar `notifications/initialized` y las respuestas por el mismo canal HTTP |
| Credential leakage al importar configs de terceros | Media | Crítico | `SecretProxy` + `CredentialManager`; el valor nunca se persiste |
| Servidor MCP de Ego accesible desde loopback sin bearer | Baja | Alto | Validación de `Origin` y bearer; exención acotada y auditada si hace falta |

### RFC-03.5 Dependencias y prerequisites ##

| Dependencia | Estado verificado | Nota |
| --- | --- | --- |
| `ACT-09` — cliente MCP universal | ✅ Completada (`Backlog.md:216`) | Base existente; el trabajo es de contrato, no de infrastructure |
| `MCPS-07` — `listChanged` declarado y nunca emitido | 🆕 Pendiente (Fase 11) | Confirmado en `docs/review/backlog-mcp-servers.md` |
| `MCPS-01..09` — resto del backlog MCP | 🆕 Pendiente en su mayoría | Catálogo vigente en `docs/review/backlog-mcp-servers.md` |
| `SEC-03` — `CredentialManager` con keychain del SO | ✅ Completada (`Backlog.md:530`) | Requisito de OAuth 2.1 |
| `SEC-05` — matriz de permisos de herramientas | ✅ Completada (`Backlog.md:532`) | Destino de las anotaciones de riesgo |
| Decisión de owner: legacy, dual-era o modern puro | 🆕 Pendiente | Recomendación: dual-era (el mercado está mezclado) |

### RFC-03.6 Security y privacidad ##

- **Qué toca**: capacidades declaradas, esquemas de tools, encabezados y credenciales de servidores remotos.
- **Qué queda fuera**: ningún secreto en VantaDB; ningún valor de `env` o `headers` en claro; no se ejecuta
  código del servidor fuera de la allowlist de spawn existente.
- **Qué exige aprobación humana**: la **activación** de un servidor MCP importado exige aprobación (fase B,
  Fase 11). La conexión a un servidor ya configurado por el usuario no lo exige.
- **Privacidad**: el tráfico a servidores MCP remotos sale de la máquina; hay que declararlo en la UI de
  configuración, junto con el `trust_level` (`verified` | `community` | `custom`).

### RFC-03.7 Esfuerzo y fase destino ##

**12-18 días-ingeniero**, repartidos en 6-9 días para la parte A (Fase 02, Acción) y 6-9 días para la parte B
(Fase 11, Security). Es el bloqueante técnico de RFC-01: importar servidores que fallan es peor que no importar.

### RFC-03.8 Alternativas descartadas ##

| Alternativa | Por qué no |
| --- | --- |
| Delegar OAuth en un proxy externo (`sparfenyuk/mcp-proxy`) | Rompe la política de "no secretos fuera del main process" |
| Modern puro, sin soporte legacy | El mercado está mezclado: hay servidores legacy y servidores modern |
| Reescribir el cliente MCP desde cero | `McpClient` ya cumple la mayor parte del contrato; el trabajo es de versión y de superficie faltante |
| Depender del SDK oficial `typescript-sdk` como núcleo | Es un adaptador del protocolo; depender del protocolo, no del SDK, evita el bloqueo de versión |

### RFC-03.9 Riesgos de sobreingeniería ##

Lo demasiado grande para hacer hoy: implementar `server/discover` en el servidor propio antes de que la parte A
del cliente esté verde; soporte de `resources/templates/list` y de prompts parametrizables; mTLS. La
implementación **dual-era** completa ya es suficiente por ahora.

### RFC-03.10 Veredicto ##

**Adoptar** — es deuda contractual de un componente ya declarado como completo, y bloquea el importador.

---

## RFC-04 — Ejecución durable: aprobación suspendida persistida, ledger de idempotencia y presupuesto triple ##

### RFC-04.1 Contexto y problema ##

Ego tiene un motor determinista (`packages/runtime/src/ToolExecutionLoop.ts:53`), un gestor de ejecución con
cancelación cooperativa (`packages/execution/src/ExecutionManager.ts:58`), un *circuit breaker*
(`packages/execution/src/CircuitBreaker.ts`), un motor de tareas en background con checkpoints y `resume`
(`packages/tasks/src/BackgroundEngine.ts:39,206-212,327`) y un gestor de checkpoints persistido
(`packages/tasks/src/TaskCheckpoint.ts:16,28,67`). Lo que **no** tiene son tres garantías, y las tres importan
al usuario: (a) las aprobaciones pendientes viven en un `Map` en memoria
(`packages/execution/src/ApprovalEngine.ts:121`), así que cerrar la app pierde la decisión y una acción
sensible puede ejecutarse sin permiso al reiniciar; (b) no hay ledger de idempotencia previo a la ejecución
material, así que una tool con efecto externo puede duplicar su efecto tras un reintento; (c) no hay reloj de
pared, sólo `maxSteps` y coste, de modo que un bucle puede gastar tres minutos y cuarenta mil tokens sin
salirse nunca de `maxSteps`.

### RFC-04.2 Propuesta y contrato público ##

Tres contratos, todos sobre mecanismos ya existentes.

**Aprobación suspendida con estado persistido.** Antes de suspender, el motor escribe un checkpoint con
`pendingApproval: { tool, argsDigest, expiresAt, policy }`; después pone el run en `suspended`, que no bloquea
hilos ni procesos. Al arrancar, el run se reencola y vuelve a `suspended`. Si `expiresAt` vence sin decisión,
aplica una política declarada: `abort` (por defecto para acciones sensibles), `degrade` (sustituir por una tool
de sólo lectura) o `escalate` (volver a preguntar con contexto).

**Doble clave de idempotencia.** `toolCallId` deduplica el reintento de la misma invocación;
`effectKey = hash(operación, args normalizados, destino)` deduplica el efecto externo. El ledger se consulta
**antes** de la ejecución material y se persiste **con** el resultado. Si la misma `effectKey` llega con
argumentos distintos, es un conflicto: se rechaza y se audita.

**Presupuesto triple.** Tres ejes (pasos, coste, reloj de pared) y tres niveles (paso, run, proceso),
comprobados **antes** de gastar. Al superar un eje: degradación terminal con `reason` explícita
(`budget_exhausted`, `wall_clock_exceeded`) en vez de corte brusco del turno, y *nudge* de replanificación
antes de rendirse si el detector de estancamiento salta.

```typescript
export type DurabilityMode = "sync" | "async" | "exit";

export interface StepCheckpoint {
  runId: string;
  stepIndex: number;
  stepKey: string;            // hash(op, args normalizados)
  durability: DurabilityMode;
  status: "pending" | "done" | "failed";
  resultDigest?: string;
  budgetUsed: { steps: number; costUsd: number; wallClockMs: number };
  pendingApproval?: { tool: string; argsDigest: string; expiresAt: number; policy: ExpiryPolicy };
  checkpointId: string;       // permite detectar `superseded`
}

export type ExpiryPolicy = "abort" | "degrade" | "escalate";
```

### RFC-04.3 Encaje en la arquitectura ##

| Ruta | Papel |
| --- | --- |
| `packages/execution/src/ApprovalEngine.ts:121` | **Dejar de usar** `pendingMap` como única fuente; pasar a leer/escribir el checkpoint |
| `packages/execution/src/ApprovalEngine.ts:240-252` | Punto donde se calcula y se emite la identidad de la acción |
| `packages/tasks/src/TaskCheckpoint.ts:28` | `saveCheckpoint`: se le añade `durability`, `stepKey`, `pendingApproval` |
| `packages/tasks/src/TaskCheckpoint.ts:67` | `loadLatestCheckpoint`: se le añade la resolución de `superseded` |
| `packages/tasks/src/BackgroundEngine.ts:206-212` | Ya invoca `saveCheckpoint`/`loadLatestCheckpoint` vía `checkpointProvider` |
| `packages/tasks/src/BackgroundEngine.ts:327` | `resume(taskId)`: ya existe la reanudación; falta re-encolar al arrancar |
| `packages/runtime/src/ToolExecutionLoop.ts:53` | **Instrumentado**, no reescrito: el presupuesto y la degradación se aplican aquí |
| `packages/events/src/types.ts:105` | `task.checkpoint` ya existe como evento canónico: se le añade el estado `suspended` |
| `packages/security/src/ToolPermissions.ts` | Origen del `ToolRiskLevel` que decide si una tool exige aprobación |

Módulos canónicos reutilizados: `ExecutionManager` (timeout, cancelación, cuotas), `CircuitBreaker`
(reintentos y clasificación de fallo), `ApprovalEngine` (identidad causal), `TaskCheckpointManager`
(persistencia), `EgoEvent` (`packages/events/src/EventBus.ts:123`) para la traza.

**El ciclo de vida de `Run`/`Step` no se crea desde cero**: `BackgroundEngine` ya tiene el estado `paused` y
`resume`; lo que se añade es la persistencia de la aprobación y el reloj de pared.

### RFC-04.4 FMEA simplificado ##

| Modo de fallo | Probabilidad | Impacto | Mitigación |
| --- | --- | --- | --- |
| Aprobación perdida al cerrar la app → la acción se ejecuta sin permiso | Media | Crítico | Checkpoint `sync` **obligatorio** antes de `suspended`; el run se reencola al arrancar, no se reejecuta |
| Reejecución de un efecto externo (correo duplicado, commit duplicado) | Media | Crítico | `effectKey` + ledger consultado antes de la ejecución material |
| Dos escrituras concurrentes sobre el mismo checkpoint | Media | Medio | `checkpointId` propio y marca `superseded` cuando ya existe un hijo |
| Corte brusco del turno al agotar el presupuesto | Alta | Medio | Desenlace terminal tipado con `reason`, no excepción sin estado |
| Truncado silencioso del contexto | Media | Alto | Recortar **y cuantificar** lo perdido; nunca truncar en silencio |
| Reintentos infinitos ante un 4xx no reintentable | Media | Medio | Clasificador definitivo vs transitorio: un 4xx distinto de 408/429 no se reintenta |
| Budget de coste no acotado por el reloj | Media | Alto | Presupuesto triple con reloj de pared comprobado antes de gastar |
| Aprobación expirada ejecutándose a mitad | Baja | Crítico | Política de expiración explícita y registrada; por defecto `abort` |

### RFC-04.5 Dependencias y prerequisites ##

| Dependencia | Estado verificado | Nota |
| --- | --- | --- |
| `TASK-03` — checkpoints resilientes | ✅ Completada (`Backlog.md:407`) | Base de persistencia ya existente |
| `TASK-01` — `BackgroundEngine` | ✅ Completada (`Backlog.md:405`) | Motor de tareas ya operativo |
| `TASK-09` — cancelación cooperativa con `AbortSignal` | ✅ Completada (`Backlog.md:413`) | El abort ya existe; `DelegationRouter` es quien no lo usa (§RFC-05) |
| `ACT-06` — `ApprovalEngine` | ✅ Completada (`Backlog.md:213`) | Identidad causal lista; falta persistencia |
| `ACT-03` — `ExecutionManager` | ✅ Completada (`Backlog.md:210`) | Timeouts y cuotas ya implementados |
| `MSWE-01/02/03` — compuertas de mini-swe-agent | 🆕 Pendiente | Taxonomía de salida terminal, presupuesto triple y recorte de contexto |
| `OHND-03/04/06` — compuertas de OpenHands | 🆕 Pendiente | Ledger previo, aprobación suspendida y clasificación de fallos |
| `OCDE-02` — inbox durable de OpenCode | 🆕 Pendiente | Separar admisión (idempotente) de ejecución |
| `CDX-02` — caché de aprobación por clave de Codex | 🆕 Pendiente | Evitar pedir dos veces la misma aprobación |

### RFC-04.6 Security y privacidad ##

- **Qué toca**: el estado de las aprobaciones pendientes (herramienta, digest de argumentos, expiración) y el
  ledger de idempotencia (clave de efecto y digest de resultado). El digest es un SHA-256: **no** guarda los
  argumentos en claro.
- **Qué queda fuera**: los argumentos completos de la acción nunca se persisten en el checkpoint si no son
  necesarios para reanudar; los secretos nunca entran en el ledger.
- **Qué exige aprobación humana**: nada nuevo — esto **endurece** el gate existente. La aprobación sigue siendo
  del `ApprovalEngine` con identidad por `inputDigest` (`ApprovalEngine.ts:75`); lo que cambia es que ahora
  sobrevive al reinicio.
- **Privacidad**: `gov/audit` está exento de cuarentena por diseño, luego el registro de aprobaciones y de
  denegaciones puederesidir ahí sin retener PII en claro.

### RFC-04.7 Esfuerzo y fase destino ##

**15-22 días-ingeniero**, repartidos: 6-9 días para el presupuesto triple y la degradación terminal (Fase 02,
Acción) y 9-13 días para la aprobación suspendida persistida y el ledger (Fase 07, Tasks). Es prerrequisito de
RFC-05 y de RFC-07.

### RFC-04.8 Alternativas descartadas ##

| Alternativa | Por qué no |
| --- | --- |
| Motor de workflows externo (Temporal, DBOS) | Exige servidor y base de datos; contradice el principio 9 y el guardrail de no backend en P0 |
| Adoptar `Trigger.dev` como motor | Es el motor durable serio en TypeScript permisivo, pero sigue siendo un servicio |
| Reintento con intervalo fijo al estilo n8n | Contradice el backoff con jitter que ya existe en `packages/models/src/ModelRouter.ts` |
| Portar LangGraph | El modelo de `Durability` y `RetryPolicy` se porta como contrato, no como dependencia; `AGENTS.md` §4 lo prohíbe en el núcleo |
| Persistir la aprobación en el ledger de efectos | Mezcla dos responsabilidades: la aprobación es una decisión, no un efecto |

### RFC-04.9 Riesgos de sobreingeniería ##

Lo demasiado grande para hacer hoy: la máquina de estados completa `Task`/`Run`/`Step` con tres niveles de
presupuesto y el *time-travel* desde el checkpoint. Empezar por la **aprobación suspendida persistida** —que
es el hueco con impacto de usuario más claro— y añadir el reloj de pared después. El `heartbeat` de proceso
vivo y las sagas quedan fuera.

### RFC-04.10 Veredicto ##

**Adoptar** — es la única capacidad de la lista que evita que el producto pierda o repita una acción del
usuario, y no añade superficie de producto.

---

## RFC-05 — Delegación durable, reanudable y con presupuesto agregado por cadena ##

### RFC-05.1 Contexto y problema ##

La tesis de producto de Ego es que **una persona dirige una organización de agentes**. El `DelegationRouter`
ya es un supervisor jerárquico con profundidad máxima 3 (`packages/subegos/src/DelegationRouter.ts:348`),
control de ciclos, concurrencia acotada (`:890-911`), `steer`/`stop` en caliente (`:941-1025`) y `SharedMemory`
con leases (`packages/subegos/src/SharedMemory.ts:247`); está cableado en producción
(`apps/desktop/src/main.ts:1650`). Pero una delegación **no deja rastro reanudable**: un `grep` de
`checkpoint`, `resume`, `idempot` y `AbortSignal` sobre el fichero da **cero** coincidencias
(verificado el 2026-10-20). Sí persiste el contexto de entrada y el resultado
(`DelegationRouter.ts:436,515`), pero eso es *contenido*, no *estado*. Si la aplicación cae a mitad de una
cadena padre→hijo→nieto, el trabajo intermedio se pierde aunque la tarea padre tenga checkpoint. Y el
presupuesto se corta por Sub-Ego (`packages/subegos/src/SubEgoBudget.ts:103`), de modo que una cadena puede
multiplicar el gasto sin que ningún especialista lo note.

### RFC-05.2 Propuesta y contrato público ##

Al abrir una delegación se escribe un registro con `delegationId`, `callChain`, `depth`, entrada, presupuesto
restante y `effectKey`; el resultado se sella con un hash y se guarda en `gov/delegations`; reintentar la misma
`delegationId` devuelve el resultado sellado en vez de re-ejecutar. Se apoya en el evento `task.checkpoint`, que
ya existe (`packages/events/src/types.ts:105`). Además, `SubEgoBudget` suma el gasto de la cadena completa
—padre más descendientes— y expone el total por objetivo, para que el corte lo vea el que puede actuar.

```typescript
export interface DelegationLedgerEntry {
  delegationId: string;
  callChain: string[];
  depth: number;
  inputDigest: string;
  effectKey: string;
  budgetRemaining: { tokens: number; costUsd: number };
  status: "in-flight" | "sealed" | "failed";
  resultDigest?: string;
  sealedAt?: number;
}

export interface ChainBudgetTotals {
  chainRootId: string;
  tokensUsed: number;
  costUsd: number;
  descendants: number;
}
```

### RFC-05.3 Encaje en la arquitectura ##

| Ruta | Papel |
| --- | --- |
| `packages/subegos/src/DelegationRouter.ts:436` | Punto donde hoy se publica el contexto de entrada: se añade el registro del ledger |
| `packages/subegos/src/DelegationRouter.ts:515` | Punto donde hoy se publica la salida: se sella el resultado |
| `packages/subegos/src/DelegationRouter.ts:348` | `maxDepth`: la política de la cadena se define aquí |
| `packages/subegos/src/DelegationRouter.ts:374` | Origen del `delegationId`: es la clave estable de idempotencia |
| `packages/subegos/src/DelegationRuntime.ts:96` | Punto de construcción del router en producción |
| `apps/desktop/src/main.ts:1650` | Cableado de `createDelegationRuntime` |
| `packages/subegos/src/SubEgoBudget.ts:103` | **Reutilizado y extendido**: el agregador por cadena vive aquí |
| `packages/subegos/src/SharedMemory.ts:247` | **Reutilizado**: leases y pub/sub para el contexto compartido |
| `packages/tasks/src/TaskCheckpoint.ts:28` | **Reutilizado**: mecanismo de checkpoint ya existente, ahora para delegaciones |
| `packages/events/src/types.ts:11` | `task.checkpoint` como evento canónico del ledger |

No se crea un bus de orquestación nuevo: el grafo se compila **contra** el `DelegationRouter` existente. No se
toca `packages/runtime` en esta RFC.

### RFC-05.4 FMEA simplificado ##

| Modo de fallo | Probabilidad | Impacto | Mitigación |
| --- | --- | --- | --- |
| Reejecución de una cadena tras un crash → efectos duplicados | Media | Crítico | `effectKey` por cadena y resultado sellado; reintentar devuelve el sello, no re-ejecuta |
| Cadena huérfana tras el crash (ni el padre ni el hijo se recuperan) | Media | Alto | Al arrancar, reencolar las delegaciones en vuelo desde su último checkpoint |
| Multiplicación silenciosa del presupuesto por descendencia | Alta | Alto | Agregador por cadena en `SubEgoBudget`, visible en `DS-05` |
| Ledger que crece sin límite | Media | Medio | El ledger se poda por antigüedad con TTL, alineado con el TTL del `SharedMemory` |
| Reanudación que duplica el contexto compartido | Baja | Medio | El `delegationId` es la clave; una reanudación no vuelve a publicar la entrada |
| Fuga de la cadena a otro Sub-Ego | Baja | Alto | La lectura del ledger exige la misma permission `delegate:*` que la delegación original |

### RFC-05.5 Dependencias y prerequisites ##

| Dependencia | Estado verificado | Nota |
| --- | --- | --- |
| RFC-04 (aprobación suspendida + ledger + reloj de pared) | 🆕 Pendiente | **Bloqueante**: sin idempotencia, el ledger de delegación no se puede cerrar |
| `SUB-06` — Orchestration Bus y `DelegationRouter` | ✅ Completada (`Backlog.md:247`) | El mecanismo base ya existe |
| `SUB-09` — presupuesto por Sub-Ego | ✅ Completada (`Backlog.md:250`) | Se extiende, no se duplica |
| `SUB-05` — `SharedMemory` | ✅ Completada (`Backlog.md:246`) | Provee el contexto compartido y los leases |
| `TASK-03` — checkpoints | ✅ Completada (`Backlog.md:407`) | Mecanismo de persistencia a reutilizar |
| `DSEK-03` — IDs opacos de sesión | 🆕 Pendiente | El `delegationId` ya es opaco, pero conviene cerrar la convención |
| `HELM-08` — ciclo de vida del proceso de agente | 🆕 Pendiente | Proceso vivo y *heartbeat* quedan fuera de esta RFC |

### RFC-05.6 Security y privacidad ##

- **Qué toca**: la cadena de llamadas, los digests de entrada y resultado, y el consumo agregado. Los
  argumentos completos no se persisten: sólo su digest.
- **Qué queda fuera**: ningún contenido de la delegación se replica fuera de `gov/delegations`; el trabajo
  intermedio sigue en el namespace privado del Sub-Ego (`egos/<id>/*`).
- **Qué exige aprobación humana**: nada nuevo. La reanudación **no** re-ejecuta acciones que ya tuvieran
  aprobación: una aprobación suspendida se resuelve por la vía de RFC-04.
- **Privacidad**: `gov/delegations` hereda el tratamiento de `gov/*`, que es sensible por prefijo
  (`packages/memory/SensitiveNamespaces.ts:39-43`).

### RFC-05.7 Esfuerzo y fase destino ##

**10-15 días-ingeniero.** Fase 10 (Recovery) como fase natural, con la parte de presupuesto agregado en Fase 07
(Tasks). Depende de RFC-04.

### RFC-05.8 Alternativas descartadas ##

| Alternativa | Por qué no |
| --- | --- |
| Motor de grafos externo (LangGraph, AutoGen GraphFlow) | Dependencia prohibida en el núcleo; y el grafo se compila contra el router existente |
| Canal de tareas con estado al estilo CAMEL | Suficiente con el ledger sobre `SharedMemory`, sin un objeto nuevo |
| Reanudación completa del modelo de contexto | Es reimplementar el `ContextCompaction`; fuera de alcance |
| Aislar el proceso de cada Sub-Ego | Todos comparten el proceso principal; para el caso de uso objetivo es aceptable, y aislarlo es un proyecto de seguridad mayor |

### RFC-05.9 Riesgos de sobreingeniería ##

Lo demasiado grande para hacer hoy: `time-travel` y bifurcación desde el checkpoint, y el *heartbeat* de
proceso vivo. La entrega mínima es: ledger sellado + reanudación del último checkpoint + agregador de
presupuesto.

### RFC-05.10 Veredicto ##

**Adoptar** — cierra el hueco central de la tesis de producto: la cadena de agentes debe poder caer y continuar.

---

## RFC-06 — Guardrails declarativos por Sub-Ego ##

### RFC-06.1 Contexto y problema ##

El principio 6 de gobernanza es hoy **global**: `packages/security/src/ToolPermissions.ts` define una matriz
por herramienta y `packages/execution/src/ApprovalEngine.ts:240-252` evalúa por *tool*, no por *agente*. No hay
forma de declarar que un Sub-Ego nunca escriba fuera de su worktree, nunca emita red, o exija aprobación
siempre. El manifiesto (`packages/subegos/src/SubEgoManifest.ts:88-122`) declara `tools` y `permissions`, pero
no tiene un campo `guardrails`. Hoy la granularidad de la política es de herramienta, y el producto necesita
que sea de especialista. El `TrustBoundary` (`packages/runtime/src/TrustBoundary.ts:42-128`) ya separa canal
confiable y no confiable; lo que falta es la capa de *política por agente*.

### RFC-06.2 Propuesta y contrato público ##

Se añade un campo `guardrails` al manifiesto, evaluado por el `ApprovalEngine` y el `TrustBoundary` **antes de
cada tool call**. Si una guardrail no puede verificarse, la acción **degrada a aprobación humana** en lugar de
ejecutarse.

```typescript
export type SubEgoGuardrail =
  | { kind: "write-scope"; allowed: string[] }                 // p.ej. sólo su worktree
  | { kind: "deny-network" }
  | { kind: "require-approval"; actions: string[] }            // p.ej. nunca escribir fuera
  | { kind: "max-delegation-depth"; depth: number };

export interface SubEgoGuardrailSchema {
  guardrails: z.array(SubEgoGuardrail).default([]);
}
```

La lista canónica de acciones irreversible por objetivo (submit, send, publish, commit, delete) se evalúa
aunque la tool base sea inocua: **la irreversibilidad se deriva del objetivo, no de la tool**.

### RFC-06.3 Encaje en la arquitectura ##

| Ruta | Papel |
| --- | --- |
| `packages/subegos/src/SubEgoManifest.ts:101-103` | Se añade `guardrails` al esquema Zod, junto a `tools` y `permissions` |
| `packages/execution/src/ApprovalEngine.ts:240` | Punto de evaluación: las guardrails se consultan con la política de la tool |
| `packages/execution/src/ApprovalEngine.ts:75` | `computeActionIdentity`: la degradación a aprobación conserva la identidad causal |
| `packages/runtime/src/TrustBoundary.ts:110` | `filterTaintedForDestructiveAction`: se reutiliza para el caso "acción destructiva sobre contenido no confiable" |
| `packages/security/src/ToolPermissions.ts` | **Reutilizado**: la matriz de permisos por tool sigue siendo la base |
| `packages/subegos/src/SubEgoWorktree.ts:67` | **Reutilizado**: el worktree es el límite natural de `write-scope` |
| `packages/tools/src/types.ts:19` | `ToolRiskLevel`: la clasificación de la tool se combina con la guardrail |

### RFC-06.4 FMEA simplificado ##

| Modo de fallo | Probabilidad | Impacto | Mitigación |
| --- | --- | --- | --- |
| Guardrail no verificable que se ejecuta como si fuera válida | Media | Crítico | Degradación explícita a aprobación humana; nunca ejecución silenciosa |
| Guardrail Too permisiva en una plantilla importada | Media | Alto | Importar siempre con el conjunto mínimo de guardrails; la ampliación es explícita |
| Guardrail que colisiona con `permissions` y produce un conflicto no resuelto | Media | Medio | Precedencia única y documentada: la intersección más restrictiva gana |
| Falso positivo que bloquea una acción legítima | Media | Medio | La guardrail se evalúa contra el namespace y la ruta reales, no contra el prefijo literal |
| Presión de coste: cada tool call reevalúa todas las guardrails | Alta | Bajo | Las guardrails se compilan a un predicado una vez por manifiesto y se cachean |

### RFC-06.5 Dependencias y prerequisites ##

| Dependencia | Estado verificado | Nota |
| --- | --- | --- |
| `SEC-05` — matriz de permisos de herramientas | ✅ Completada (`Backlog.md:532`) | Base que las guardrails endurecen |
| `ACT-06` — `ApprovalEngine` | ✅ Completada (`Backlog.md:213`) | Motor de evaluación y de degradación |
| `SUB-01` — `SubEgoManifest` | ✅ Completada (`Backlog.md:242`) | El campo se añade al esquema existente |
| `TrustBoundary` | ✅ Completada (`packages/runtime/src/TrustBoundary.ts:42-128`) | Separa canal confiable y no confiable |
| `QWEN-01` — riesgo de tool MCP no derivado del nombre | 🆕 Pendiente | Complementario: la anotación del servidor es la otra mitad del mismo problema |
| `GOOS-03` — inspector de egreso de red | 🆕 Pendiente | La guardrail `deny-network` reutiliza su detección |

### RFC-06.6 Security y privacidad ##

- **Qué toca**: la política declarativa del Sub-Ego. Ningún dato del usuario.
- **Qué queda fuera**: las guardrails no amplían permisos: sólo los estrechan. El catálogo de permisos
  (`ToolPermissions`) sigue siendo el techo; una guardrail nunca lo eleva.
- **Qué exige aprobación humana**: por definición, toda acción cuya guardrail no pueda verificarse, y toda
  acción marcada `require-approval`.
- **Privacidad**: sin impacto directo; el efecto es indirecto y positivo: reduce la superficie de exfiltración.

### RFC-06.7 Esfuerzo y fase destino ##

**6-9 días-ingeniero.** Fase 11 (Security), con el campo del manifiesto prepared en Fase 03.

### RFC-06.8 Alternativas descartadas ##

| Alternativa | Por qué no |
| --- | --- |
| Un motor de reglas externo (policy engine de Gemini CLI) | Duplica `ApprovalEngine` y crea dos fuentes de verdad de la política |
| Guardrails por *plugin* al estilo Claude Code | La gobernanza debe ser central, no por contenedor |
| Guardrails por *herramienta* solamente | Ya existe (`ToolPermissions`); no resuelve el caso "este Sub-Ego nunca sale de su worktree" |
| Declarar las guardrails sólo en código | No es declarativo, no es portable entre plantillas y no es auditable |

### RFC-06.9 Riesgos de sobreingeniería ##

Lo demasiado grande para hacer hoy: un lenguaje de reglas rico (condiciones sobre el contenido, el tiempo o el
destino) y un motor de guardrails que evalúe sobre el resultado de la tool. Empezar por cuatro tipos
declarativos y medirlos.

### RFC-06.10 Veredicto ##

**Adoptar** — convierte el principio 6 de global en por especialista con muy poco código.

---

## RFC-07 — Canal como adaptador: modelo canónico, idempotencia de salida y consentimiento ##

### RFC-07.1 Contexto y problema ##

Ego tiene la mitad del modelo: `packages/domains/src/crm/CrmDomain.ts:99` persiste contactos, deals e
interacciones; `packages/memory/SensitiveNamespaces.ts:39-43` marca `crm/` y `finance/` sensibles por
construcción; `packages/execution/src/ApprovalEngine.ts:75` da identidad por contenido exacto; `SecretProxy` y
`NetPolicy` protegen la salida. Falta la noción de **canal** como dimensión de primera clase, la de
**conversación** y **mensaje**, el estado de idempotencia de envío y el consentimiento. Y hay un hecho
verificado que condiciona todo: el repositorio oficial `modelcontextprotocol/servers` ya **no** contiene
ningún servidor de Slack, Discord, Telegram, WhatsApp ni Mastodon, de modo que el Nivel B no puede cubrir
mensajería y todo canal nuevo es Nivel A o C. Publicar es además irreversible —un correo enviado, un post
viralizado o una respuesta por WhatsApp no se retiran—, lo que hace la aprobación previa obligatoria y no
configurable a "off".

### RFC-07.2 Propuesta y contrato público ##

El canal es un adaptador; el modelo es canónico. Ningún `if (whatsapp)` en el runtime. Un Sub-Ego razona
sobre `Contact`, `Conversation` y `Message`; el adaptador traduce, y declara qué puede hacer.

```typescript
export interface ChannelAdapter {
  channelId: string;                 // "telegram:main", "email:work"
  capabilities: { read: boolean; write: boolean; publish: boolean };
  limits?: { ratePerMinute?: number; maxChars?: number; windowHours?: number };
  draft(input: DraftInput): Promise<Draft>;
  publish(draft: Draft, idempotencyKey: string): Promise<PublishResult>;
}

export interface DraftInput {
  conversationId: string;
  content: string;
  media?: string[];
  templateId?: string;
}

export interface PublishResult {
  state: "published" | "unknown" | "rejected";
  remoteId?: string;
  idempotencyKey: string;
}
```

El flujo de salida es único para todos los canales: `draft → normalización → consentimiento → aprobación →
ejecución idempotente (arm → confirm → publish) → registro`. El estado `unknown` es de primera clase: si la
publicación muere con resultado indeterminado, el sistema **no** reintenta a ciegas, sino que comprueba si el
registro remoto existe antes de reintentar.

La v1 se limita a cinco canales: Email (IMAP/SMTP), Discord, Telegram, Slack y publicación en Mastodon +
Bluesky. Los tres últimos por detrás del mismo modelo canónico.

### RFC-07.3 Encaje en la arquitectura ##

| Ruta | Papel |
| --- | --- |
| `packages/domains/src/crm/CrmDomain.ts:99` | **Reutilizado**: `crm/contacts`, `crm/deals`, `crm/interactions` |
| `packages/domains/src/crm/CrmDomain.ts:380` | **Reutilizado**: el registro cronológico de interacciones es el `Message` de un canal |
| `packages/memory/SensitiveNamespaces.ts:39` | **Reutilizado**: `crm/*` queda sensible por prefijo → cuarentena por defecto |
| `packages/execution/src/ApprovalEngine.ts:75` | **Reutilizado**: la aprobación por `inputDigest` da "aprobado por contenido exacto" |
| `packages/tools/src/types.ts:6` | `ToolCategory` **se amplía** con una categoría de canal; el resto no cambia |
| `packages/security/src/CredentialManager.ts:335` | **Reutilizado**: el token con scope de escritura vive en el keychain, nunca en VantaDB |
| `packages/integrations/src/mcp/SecretProxy.ts:32` | **Reutilizado**: patrón de referencia opaca para credenciales de canal |
| `packages/tools/src/native/security/NetPolicy.ts` | **Reutilizado**: frontera SSRF para toda salida |
| `packages/memory/UntrustedContentSanitizer.ts:132` | **Reutilizado**: el contenido entrante es **dato**, nunca instrucción |
| `packages/events/src/types.ts:7-11` | **Reutilizado**: eventos canónicos `task.*` para registrar la salida |

Los adaptadores de canal nuevos viven en `packages/tools/src/native/` (Nivel A, como ya está decidido en
`docs/engineering/integraciones.md`) y no tocan el Cognitive Runtime, el Model Router, el Sub-Ego Runtime ni
el Workspace Runtime.

### RFC-07.4 FMEA simplificado ##

| Modo de fallo | Probabilidad | Impacto | Mitigación |
| --- | --- | --- | --- |
| Publicación sin revisión humana | Baja | Crítico | Aprobación obligatoria por `inputDigest`; cambiar el texto invalida la aprobación |
| Duplicado por reintento tras un fallo ambiguo | Media | Crítico | `idempotencyKey` + arm/confirm/publish + estado `unknown` que bloquea el reintento ciego |
| Publicación en un bucle que satura la cuenta | Media | Alto | Consentimiento modelado en el contacto, cola con límites por cuenta y rate limiting por adapter |
| Credencial de escritura expuesta en un canal abierto | Media | Crítico | `CredentialManager` (keychain) + referencia opaca en el registro de canal; el secreto nunca en VantaDB |
| Inyección de prompt desde un mensaje entrante | Media | Alto | El contenido entrante es dato, nunca instrucción; toda salida pasa por aprobación |
| ToS de plataforma incumplida (WhatsApp) | Baja | Crítico | WhatsApp no oficial fuera del producto, sin excepción |
| Duplicado al copiar un contacto entre canales | Media | Bajo | `Identity` como tabla de vinculación contacto↔identidad de canal, con deduplicación por identificador remoto |
| Exfiltración de datos personales a un canal externo | Media | Alto | `crm/*` sensible por prefijo, cuarentena por defecto y `SecretsFilter` antes de ingestar |

### RFC-07.5 Dependencias y prerequisites ##

| Dependencia | Estado verificado | Nota |
| --- | --- | --- |
| RFC-04 (idempotencia + aprobación suspendida) | 🆕 Pendiente | **Bloqueante**: sin ledger no hay salida idempotente |
| `DOM-05` — dominio CRM | ✅ Completada (`Backlog.md:469`) | Base del modelo canónico |
| `SEC-03` — `CredentialManager` | ✅ Completada (`Backlog.md:530`) | Almacén de las credenciales de canal |
| `SEC-09` — cuarentena de namespaces sensibles | ✅ Completada (`Backlog.md:536`) | `crm/*` en cuarentena por defecto |
| `SEC-04` — `SecretsFilter` | ✅ Completada (`Backlog.md:531`) | Filtro antes de la ingestión |
| `ACT-06`/`ACT-07` — aprobación y su tarjeta | ✅ Completada (`Backlog.md:213-214`) | La aprobación por contenido se reutiliza tal cual |
| Decisión de owner sobre publicación en nombre del usuario | 🆕 Pendiente | §9.2 de la síntesis, pregunta 6 |
| Revisión de aplicación de plataforma (Slack, Discord, Google) | Externa | Fuera del control del repo; se documenta como requisito |

### RFC-07.6 Security y privacidad ##

- **Qué toca**: historiales de conversación, direcciones de correo, identificadores de cuenta de canal y
  credenciales de escritura. Todo eso es PII.
- **Qué queda fuera**: los tokens de plataforma nunca se copian a VantaDB — sólo una **referencia opaca** al
  `id` del `CredentialManager`. El contenido publicado se registra en `social/posts`, fuera de `crm/`, y sigue
  pasando por `SecretsFilter`.
- **Qué exige aprobación humana**: **toda** salida. La aprobación es por contenido exacto y por destino
  exacto (canal, cuenta, contacto); la aprobación previa no es configurable a "off" en la v1.
- **Privacidad**: `crm/channels`, `crm/conversations`, `crm/messages` y `crm/consent` quedan sensibles por
  prefijo. El opt-out debe estar modelado en el **contacto** y consultarse en el último momento, antes del
  despacho. La supresión Art. 17 tiene que ser implementable sobre `crm/messages`.

### RFC-07.7 Esfuerzo y fase destino ##

**15-22 días-ingeniero** para el núcleo canónico y los dos primeros adaptadores (Email y Telegram o Discord).
Fase 09 (Dominios), con el ledger de idempotencia de RFC-04 como prerrequisito.

### RFC-07.8 Alternativas descartadas ##

| Alternativa | Por qué no |
| --- | --- |
| WhatsApp vía `Baileys` o `whatsapp-web.js` | Ingeniería inversa del protocolo, ToS y baneo del número de negocio |
| Construir una bandeja omnicanal | Es un problema de mensajería, no de razonamiento; si el usuario usa Chatwoot, un conector MCP lo resuelve |
| X y LinkedIn en v1 | Revisión de acceso a nivel de aplicación y límites por cuenta |
| Publicar como bot anónimo sin dejar rastro | Rompe la trazabilidad de `gov/audit` y la trazabilidad de la responsabilidad |
| Sustituir `CrmDomain` por un modelo de canal nuevo | Duplicaría una capacidad existente y arrastraría AGPL de veinte |

### RFC-07.9 Riesgos de sobreingeniería ##

Lo demasiado grande para hacer hoy: los **diez** canales, el soporte de medios con subida en dos fases, el
JMAP, el SMS y la voz, y la شاشة de consentimiento completa. Empezar por **Email** —el canal con menor
riesgo de plataforma, mayor densidad de información y encaje directo con el `CrmDomain` existente— y añadir un
segundo canal tras verificar el flujo completo.

### RFC-07.10 Veredicto ##

**Adoptar** — es la capacidad que abre la v1 de producto, pero sólo después de que RFC-04 resuelva la
idempotencia.

---

## RFC-08 — Spec por feature, trazabilidad spec→test y gates de calidad ##

### RFC-08.1 Contexto y problema ##

Ego ya es una empresa de software con estructura: Backlog Maestro de 13 fases y 151 tareas, ADRs con ciclo
`PROPOSED → ACCEPTED → SUPERSEDED` (`docs/adr/README.md:19-21`), `CODEOWNERS`, plantilla de PR, changelog con
SemVer y 6 workflows de CI. Lo que **no** existe es un artefacto de alcance por feature: no hay `docs/specs/`.
El `ProjectMemoryGraph` (`packages/knowledge/src/ProjectMemoryGraph.ts:36`, KB-11) construye el grafo
Decisión→ADR→Commit→Files→Tests→Outcome, pero no hay ningún contrato que obligue a que una spec enlace sus
tareas canónicas. En calidad, los gates que faltan son baratos: cobertura como gate —hoy
`.github/workflows/coverage.yml:63` es `continue-on-error: true`—, `Signed-off-by` —el job `commit-msg`
(`.github/workflows/ci.yml:552`) valida Conventional Commits pero no DCO—, SAST y property-based testing.

### RFC-08.2 Propuesta y contrato público ##

Un artefacto de spec por feature, **colgado del ID canónico del Backlog** y sin estado propio, más un
`evidence.md` que liga cada requisito a su test.

```text
docs/specs/
  <ID-CANONICA>-<slug>/
    spec.md        → FR-xxx, criterios de aceptación, no-objetivos
    design.md      → opcional; sólo si hay decisión arquitectónica
    evidence.md    → FR-xxx → tarea → fichero → test → ADR
```

La regla de desempate es la de `docs/jerarquia-canonica.md`: la spec describe **Capability** (nivel 3) y el
Backlog describe **Implementation** (nivel 10); cuando discrepan, gana la spec en alcance y el Backlog en
secuencia. La spec no abre tareas por sí misma.

En CI, cuatro cambios de bajo coste: `Signed-off-by` en el job `commit-msg`; SAST (Semgrep o CodeQL) en el
job `security`; property-based testing sobre `ApprovalEngine` y el servidor MCP de Ego; y la promoción de la
cobertura a gate **con regresión primero** (`--fail-on-regression`), no de golpe.

### RFC-08.3 Encaje en la arquitectura ##

| Ruta | Papel |
| --- | --- |
| `docs/specs/<ID-CANONICA>-<slug>/` | Nuevo: artefacto de alcance por feature |
| `docs/roadmap/Backlog.md:128-133` | **Referencia**: el protocolo Opción B es donde se añade la compuerta de spec |
| `docs/adr/README.md:19-21` | **Reutilizado**: el ciclo de ADR ya es más estricto que MADR; la spec lo referencia por ID |
| `packages/knowledge/src/ProjectMemoryGraph.ts:36` | **Reutilizado**: el grafo existe; falta el contrato que lo obliga |
| `.github/workflows/ci.yml:552` | Se añade la validación de `Signed-off-by` |
| `.github/workflows/ci.yml:151` | El job `security` se amplía con SAST y escaneo de secretos |
| `.github/workflows/coverage.yml:63` | De `continue-on-error: true` a gate con regresión primero |
| `packages/execution/src/ApprovalEngine.ts` | **Reutilizado**: objetivo natural del property-based testing |
| `packages/integrations/src/mcp/McpServer.ts` | **Reutilizado**: su superficie `tools/list` es un contrato verificable |

No se toca ningún paquete de producción: es documentación de proceso y CI.

### RFC-08.4 FMEA simplificado ##

| Modo de fallo | Probabilidad | Impacto | Mitigación |
| --- | --- | --- | --- |
| Proceso burocrático que no mejora nada | Media | Alto | Regla de la spec de una página; si no produce una tarea más precisa, no se escribe |
| Specs escritas y no cumplidas | Media | Alto | `evidence.md` obligatorio: sin él, la tarea no pasa a `✅ Completada` |
| Falsos verdes: la spec se cumple y el test no prueba el criterio | Media | Alto | Property-based testing; `evidence.md` exige un identificador de test concreto |
| Duplicación del Backlog Maestro | Media | Crítico | La spec cuelga del ID canónico y no tiene estado propio |
| Cobertura como gate demasiado pronto y CI rojo | Media | Medio | Promover con `--fail-on-regression` primero; mantener informativo hasta superar el umbral |
| Dos agentes se revisan mutuamente sin revisión humana | Media | Alto | La plantilla de PR ya exige revisor distinto; automatizarlo, no eliminarlo |

### RFC-08.5 Dependencias y prerequisites ##

| Dependencia | Estado verificado | Nota |
| --- | --- | --- |
| `KB-11` — `ProjectMemoryGraph` | ✅ Completada (`Backlog.md:384`) | El grafo que la trazabilidad debe consumir |
| Compuerta de spec en el protocolo Opción B | 🆕 Pendiente | Hay que añadirla a `Backlog.md:118-124` |
| `docs/adr/README.md` | ✅ Completada | Ciclo de ADR vigente |
| `ACT-05`/`ACT-12` — bus de eventos y su cableado | ✅ Completada (`Backlog.md:212-219`) | El grafo se alimenta del bus |
| `DIST-04` — firma de release | 🆕 Pendiente, bloqueo owner | `Signed-off-by` no depende de ello, pero el gate de publicación sí |
| Decisión de owner sobre dónde vive la spec | 🆕 Pendiente | §9.2 de la síntesis, pregunta 7 |

### RFC-08.6 Security y privacidad ##

- **Qué toca**: sólo artefactos de repositorio y configuración de CI. Ningún dato de usuario.
- **Qué queda fuera**: `evidence.md` no contiene contenido de conversaciones ni datos de memoria; sólo
  identificadores de fichero, de test y de ADR.
- **Qué exige aprobación humana**: la aprobación de la **spec** (alcance y criterios) y el merge del PR de
  release. El resto del ciclo es automatizable: un humano, tres gates.
- **Privacidad**: sin impacto.

### RFC-08.7 Esfuerzo y fase destino ##

**4-7 días-ingeniero.** Transversal: la plantilla de spec y el `evidence.md` en Fase 02, los gates de CI en
Fase 11 y Fase 12.

### RFC-08.8 Alternativas descartadas ##

| Alternativa | Por qué no |
| --- | --- |
| Sustituir el Backlog por Plane, Redmine u OpenProject | El Backlog es la fuente única de verdad; las alternativas son AGPL/GPL y su modelo de configuración es ajeno |
| El CLI y las plantillas literales de `spec-kit` | Adaptar cuatro plantillas a Markdown canónico es trabajo infinito; se toma el patrón, no la herramienta |
| Gherkin como motor de tests | Se adopta sólo el formato de los criterios de aceptación; Vitest cubre la ejecución |
| `semantic-release` para publicar | `release-please` con humano es más seguro para un producto firmado |
| CodeQL o SonarQube como motor de SAST | CodeQL es pesado y propiedad del host; SonarQube exige servidor Java |

### RFC-08.9 Riesgos de sobreingeniería ##

Lo demasiado grande para hacer hoy: la pirámide de tests completa (E2E real, Storybook, MSW, Lighthouse),
mutation testing sobre todo el repositorio y los *feature flags* por etapa. Empezar por la plantilla de spec,
`evidence.md` y `Signed-off-by`: tres entregables de un día cada uno.

### RFC-08.10 Veredicto ##

**Adoptar** — es la capacidad más barata de la lista y la que da a todas las demás un criterio de aceptación
verificable.

---

## 1. Tabla resumen de veredictos ##

| RFC | Capacidad | Veredicto | Esfuerzo | Fase | Bloqueante |
| --- | --- | --- | --- | --- | --- |
| `RFC-01` | `SYN-01` — Importador de definiciones de agentes y skills | **Adoptar** | 12-18 d | 03 Sub-Egos | `SYN-02` (tipo destino) |
| `RFC-02` | `SYN-02` — Tipo `SubEgoTemplate` y catálogo versionado | **Adoptar** | 8-12 d | 03 Sub-Egos | Decisión de owner sobre catálogo remoto (no bloquea el tipo) |
| `RFC-03` | `SYN-03` — Contrato MCP vigente, descubrimiento y riesgo declarado | **Adoptar** | 12-18 d | 02 Acción + 11 Security | Decisión de owner: legacy, dual-era o modern puro |
| `RFC-04` | `SYN-04` — Ejecución durable: aprobación suspendida, idempotencia, presupuesto triple | **Adoptar** | 15-22 d | 02 Acción + 07 Tasks | Cierre de `MSWE-01/02/03` y `OHND-03/04/06` |
| `RFC-05` | `SYN-05` — Delegación durable y presupuesto agregado por cadena | **Adoptar** | 10-15 d | 10 Recovery + 07 Tasks | `RFC-04` |
| `RFC-06` | `SYN-06` — Guardrails declarativos por Sub-Ego | **Adoptar** | 6-9 d | 11 Security | Cierre de `QWEN-01` y `GOOS-03` |
| `RFC-07` | `SYN-07` — Canal como adaptador, idempotencia de salida y consentimiento | **Adoptar** | 15-22 d | 09 Dominios | `RFC-04` + decisión de owner sobre publicación |
| `RFC-08` | `SYN-10` — Spec por feature, trazabilidad spec→test y gates de CI | **Adoptar** | 4-7 d | transversal | Compuerta de spec + decisión de owner sobre dónde vive la spec |
| — | `SYN-08` — Grafo declarativo de workflows | **Adaptar — diferido** | 15-20 d | 04 Canvas | Requiere `RFC-05` cerrada; sin RFC propio hasta entonces |
| — | `SYN-09` — Proyección canónica de backoffice | **Adaptar — Fase 09/12** | 20-30 d | 09 Dominios | Decisión de owner sobre el dominio `finance` |

**Suma de esfuerzo de las 8 RFCs: 82-123 días-ingeniero.** Distribuidos en fases distintas y con dependencias
parciales, no son 82 días secuenciales: `RFC-03` y `RFC-08` son paralelizables desde el principio, y `RFC-02`
no depende de nada.

---

## 2. Referencias internas ##

- [`sintesis-capacidades-ego.md`](./sintesis-capacidades-ego.md) — matriz maestra, descarte y mapa de fases
- [`../roadmap/Backlog.md`](../roadmap/Backlog.md) — Backlog Maestro y matriz de compuertas
- [`../extractions/README.md`](../extractions/README.md) — las 25 fichas de extracción
- [`../jerarquia-canonica.md`](../jerarquia-canonica.md) — criterio de desempate entre documentos
- [`../product/principios-innegociables.md`](../product/principios-innegociables.md) — los 10 principios
- [`../architecture/vision-general.md`](../architecture/vision-general.md) — arquitectura vigente
