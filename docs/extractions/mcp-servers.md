# Extracción Técnica: MCP Servers (repos-referencia/mcp-servers) #

| Estado | Repositorio Origen | Stack del Origen | Rol en Ego | Owner | Fecha | Licencia | Licencia del origen | Commit verificado | Ruta de origen |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Activo — ficha canónica de extracción y análisis de patrones | `repos-referencia/mcp-servers/` (upstream `modelcontextprotocol/servers`, commit `51b6382`, origen `src/everything/server/index.ts`) | TypeScript 5.8 + Node ≥24 + Zod 4 + `@modelcontextprotocol/server` 2.3 (4 servidores en npm workspaces) + Python ≥3.10 con `uv` (3 servidores en PyPI) | Referencia de **contrato de servidor MCP**: registro modular de tools/resources/prompts, anotaciones de riesgo, plantillas de recursos con variables, protocolo Roots y empaquetado de servidor | ness-e | 2026-10-20 | Transición MIT → Apache-2.0 (`LICENSE:1-3`): las contribuciones heredadas siguen bajo MIT, las nuevas bajo Apache-2.0 | Apache-2.0 — modelcontextprotocol/servers | 51b6382 | `src/everything/server/index.ts` |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia ##

### 1.1 Qué resuelve de forma análoga a Ego ###

Ego es **MCP Client + MCP Server** (`AGENTS.md` §7) y ya tiene una capa MCP de producción:
`packages/integrations/src/mcp/` con `McpClient`, `McpManager`, `EgoMcpServer`, `schema-bridge`, `signature` y
`SecretProxy`, cableados en `apps/desktop/src/main.ts:2170` (gestor) y `:2464` (servidor). Este repositorio
es la **implementación de referencia oficial del lado servidor** del mismo protocolo: no aporta un
producto, aporta el **contrato**: cómo se registra una capacidad, cómo se declara su riesgo, cómo se
enruta una URI con variables, cómo se declara una raíz (`roots`) y cómo se empaqueta un servidor para
que un cliente lo ejecute.

Los seis problemas que resuelve y que Ego tiene abiertos o mal resueltos:

1. **Declarar el riesgo de una tool de forma explícita** (`annotations`) en vez de deducirlo del nombre.
2. **Cumplir la capacidad `roots` que se declara**: un cliente MCP que anuncia `roots` debe poder responder `roots/list`.
3. **Descubrir `resources` y `prompts`**, no sólo `tools`: la doc canónica de Ego lo promete y el cliente no lo hace.
4. **Plantillas de recurso con variables de URI** y autocompletado, para que un cliente pueda descubrir direcciones parametrizables.
5. **Registro modular por función `registerX(server, context)`**, con estado por instancia y sin mapas
   globales por `session id`.
6. **Versionado del protocolo y era**, con un servidor que sirve a la vez clientes 2025 y 2026-07-28.

### 1.2 Tabla de divergencias ###

| Dimensión | MCP Servers | Ego (Cognitive OS) | Decisión |
| --- | --- | --- | --- |
| **Rol del servidor MCP** | 7 servidores de referencia con dominio propio (filesystem, memory, git, fetch, time, sequentialthinking, everything) | Ego **opera** un servidor MCP propio y **consume** servidores de terceros; no distribuye servidores | **Extraer el contrato, descartar los servidores.** Los schemas de negocio (grafo de conocimiento, cadena de pensamiento, catálogo de ref) no son entidades de Ego. |
| **Transporte del servidor de Ego** | stdio por defecto; además Streamable HTTP y HTTP+SSE (SSE deprecado) | HTTP streamable en `127.0.0.1`, en-proceso, con bearer token en el keychain (`apps/desktop/src/main/mcp/mcp-server-runtime.ts:10-11,109`); `docs/engineering/integraciones.md:99` aún dice "stdio" | **Corregir la doc canónica.** El transporte en-proceso es correcto: un hijo stdio obligaría a proxiar el `ToolRegistry` real por un pipe y expondría un catálogo desincronizado. La divergencia es documental, no de diseño. |
| **Descubrimiento de capacidades** | El cliente negocia `tools`, `resources`, `prompts`, `roots`, `elicitation`, `sampling` (`src/everything/server/index.ts:114-216`) | `McpClient` implementa **sólo** `tools/list` y `tools/call` (`packages/integrations/src/mcp/McpClient.ts:251-259,271-288`) | **Extraer y adaptar** (`MCPS-03`). `docs/engineering/integraciones.md:80` ya promete `resources/list` y `prompts/list`: es una divergencia doc↔código que hay que cerrar. |
| **Riesgo de las tools** | Anotaciones MCP explícitas: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` (`src/filesystem/server.ts:288,441-446`; `src/everything/tools/trigger-elicitation-request.ts:27-32`) | `ToolRiskLevel` propio (`safe`/`sensitive`/`destructive`) más `requiresApproval`; el import MCP **deduce el riesgo por el nombre** (`McpClient.ts:749-776`) | **Extraer y adaptar** (`MCPS-01`). La heurística por nombre falla con `archive_file` o `git_commit`: se declara `sensitive` donde el servidor dice `readOnlyHint: true`. |
| **Sustrato de persistencia** | `memory`: grafo de entidades/relaciones/observaciones en JSONL con lockfile (`src/memory/index.ts:3-4,357-510`) | VantaDB 0.8.0 in-process + `EgoMemoryAdapter` + `GraphRagEngine` (`KB-03`, `KB-06`) | **Descartar** (`MCPS-08`). El grafo JSONL es un sustrato pre-VantaDB; su modelo de dominio no es de Ego. |
| **Perímetro de filesystem** | Allow-list de directorios por CLI + `roots` del cliente, con barrera anti-revocación (`src/filesystem/server.ts:815-916`) | `PathValidator` canónico con rutas reservadas del SO y cierre de TOCTOU por `realpath` del padre (`packages/tools/src/native/fs/PathValidator.ts:36-88,107-161`) | **Descartar** (`MCPS-09`). El módulo de Ego es **más estricto** que el del repo de referencia; no hay nada que extraer. |
| **Empaquetado y distribución** | `bin` en npm + `npx`, `uv`/`uvx` en PyPI, Dockerfile multi-stage (`src/everything/package.json:18-20`; `src/filesystem/Dockerfile:1-25`) | Ego no distribuye servidores MCP; los **consume**. La política de spawn ya está: `MCP_COMMAND_ALLOWLIST` con `node`/`npx`/`python`/`uv`/`uvx` (`McpClient.ts:32-41`) y `shell:true` prohibido (`:57-69`) | **Descartar** (`MCPS-08`). La allowlist ya cubre el patrón de invocación; el contenedor es un mecanismo de distribución de terceros. |

---

## 2. Inventario Quirúrgico de Patrones a Extraer ##

### Bloque A — Registro de capacidades y anotaciones de riesgo ###

*Ubicación en fuente: `src/everything/server/index.ts`, `src/everything/tools/index.ts`, `src/filesystem/server.ts`*

**A.1 Fábrica de servidor + registro modular por función** (`src/everything/server/index.ts:114-216`;
`src/everything/tools/index.ts:46-61,84-107`; `src/everything/resources/index.ts:16-23`;
`src/everything/prompts/index.ts:12-17`)

- **Qué hace:** una única fábrica construye el servidor y delega en `registerTools(server, context)`,
`registerResources(server, context)` y `registerPrompts(server)`. Cada área de funcionalidad exporta su propio
`registerX` y se cablea en el `index.ts` de su carpeta. Las tools que dependen de una capacidad del
cliente se registran en otra pasada, cuando esa capacidad ya se conoce (`registerConditionalTools`,
`src/everything/tools/index.ts:84-107`).
- **Adaptación en Ego:** `EgoMcpServer.handleRequest` es hoy un `switch` monolítico de diez métodos
(`packages/integrations/src/mcp/McpServer.ts:115-147`) con los proveedores acoplados a `EgoMcpServerOptions`
(`:75-96`). El salto a registro modular por área + un `ServerContext` por instancia es lo que permite
que `MCPS-03`/`MCPS-04` crezcan sin editar el switch.
- **Relación con Backlog Ego:** `ACT-09`, `ACT-11`, `INT-01`.

**A.2 Anotaciones de riesgo por tool** (`src/filesystem/server.ts:280-291,431-457`;
`src/everything/tools/trigger-elicitation-request.ts:27-32`)

- **Qué hace:** cada tool declara `readOnlyHint`, `destructiveHint`, `idempotentHint` y `openWorldHint`.
`write_file` es `readOnlyHint: false, idempotentHint: true, destructiveHint: true`; `read_text_file` es
`readOnlyHint: true, openWorldHint: false`. El `AGENTS.md` raíz del repo lo exige: *"every tool you add or
change sets readOnlyHint, idempotentHint and destructiveHint to values that match what it actually does"*.
- **Adaptación en Ego:** `McpToolDefinition` (`packages/integrations/src/mcp/types.ts:67-76`) **no tiene**
campo `annotations`; `inferRiskLevel` (`McpClient.ts:749-776`) decide por el nombre;
`ToolRegistry.exportJsonSchemas` (`packages/tools/src/ToolRegistry.ts:207-220`) no exporta anotaciones;
`EgoMcpServer.handleToolsList` (`McpServer.ts:167-176`) sólo publica `name`/`description`/`inputSchema`.
- **Relación con Backlog Ego:** `ACT-09`, `SEC-05`, `ACT-11`.

**A.3 Dialecto JSON Schema 2020-12 explícito** (`src/filesystem/server.ts:30-44`)

- **Qué hace:** el SDK 1.x estampaba `$schema: draft-07` en cada schema de tool, y los validadores que
aceptan sólo 2020-12 lo rechazan. El servidor fija el dialecto en el objeto raíz con
`z.object(shape).meta({ $schema: JSON_SCHEMA_DIALECT })`.
- **Adaptación en Ego:** `packages/tools/src/schema-converter.ts` genera el JSON Schema que consume
`exportJsonSchemas`; el import inverso vive en `packages/integrations/src/mcp/schema-bridge.ts:6-57`. Conviene
fijar el dialecto en ambos sentidos para que un cliente externo no rechace el catálogo de Ego.
- **Relación con Backlog Ego:** `ACT-01`, `ACT-09`.

### Bloque B — Recursos, plantillas y prompts ###

*Ubicación en fuente: `src/everything/resources/`, `src/everything/prompts/`*

#### B.1 Plantillas de recurso con variables de URI y autocompletado ####

(`src/everything/resources/templates.ts:28-33,146-153,169-209`)

- **Qué hace:** `ResourceTemplate("demo://resource/dynamic/text/{resourceId}", { complete: { resourceId: … } })`
declara una URI parametrizada; el SDK enruta al handler sólo las URIs que casan y el handler valida
la variable. El autocompletado (`completable`) ofrece sugerencias para el valor. Un identificador inválido
lanza `ResourceNotFoundError`, que el protocolo reporta como `-32602` con la URI en `data`.
- **Adaptación en Ego:** `EgoMcpServer.handleResourcesList` (`McpServer.ts:256-280`) sólo publica recursos
estáticos (`payload://`, `memory://`) y `handleResourcesRead` (`:282-328`) enruta por prefijo literal. No
existe `resources/templates/list`: un cliente no puede descubrir `memory://kb/docs/{docId}` ni
`payload://artifact/{id}`.
- **Relación con Backlog Ego:** `KB-03`, `KB-04`, `CANV-06`.

**B.2 Prompts con argumentos tipados y completers** (`src/everything/prompts/args.ts:11-41`;
`src/everything/prompts/resource.ts:24-94`)

- **Qué hace:** `argsSchema` con Zod declara un argumento obligatorio y otro opcional; el handler los
interpola. El prompt con recurso embebido (`resource.ts:24-94`) valida los argumentos **en el handler**,
además del esquema, y devuelve un mensaje con `content: { type: "resource" }`.
- **Adaptación en Ego:** `handlePromptsList` (`McpServer.ts:330-345`) devuelve `arguments: []` fijo;
`handlePromptsGet` (`:347-379`) sólo concatena `instructions`/`systemPrompt` del manifiesto de Sub-Ego. Los
prompts de Ego no son parametrizables.
- **Relación con Backlog Ego:** `SUB-01`, `SUB-02`, `CANV-01`.

##### B.3 Suscripciones y notificación de cambio de recurso #####

(`src/everything/resources/subscriptions.ts:24-53,63-82`; `src/everything/server/context.ts:59-80`)

- **Qué hace:** `resources/subscribe`/`resources/unsubscribe` registran la URI en un `Set` **de la
instancia**, y un publicador emite `notifications/resources/updated` sólo a los suscriptores
(`sendResourceUpdated` filtrado por `isSubscribed`). `instancePublisher` centraliza además
`sendToolListChanged`, `sendPromptListChanged` y `sendResourceListChanged`.
- **Adaptación en Ego:** `EgoMcpServer` declara `tools: { listChanged: true }`,
`resources: { listChanged: true, subscribe: false }` y `prompts: { listChanged: true }` (`McpServer.ts:155-157`)
pero **no emite ninguna notificación**: grep de `list_changed` sobre `packages/` sólo devuelve el mapeo
de normalización de `packages/events/src/EventNormalizer.ts:27`. La capacidad se anuncia y no se cumple.
- **Relación con Backlog Ego:** `ACT-11`, `CANV-06`, `ACT-05`.

### Bloque C — Roots, elicitaciones y estado por instancia ###

*Ubicación en fuente: `src/filesystem/server.ts`, `src/everything/server/context.ts`,
`src/everything/transports/stdio.ts`*

**C.1 Roots como frontera de acceso, con barrera anti-revocación** (`src/filesystem/roots-utils.ts:59-91`;
`src/filesystem/server.ts:815-916`)

- **Qué hace:** el servidor pide `roots/list` al cliente y usa los roots como allow-list de
directorios; un `roots/list_changed` la reemplaza; si el cliente retira sus roots, el acceso se revoca.
Una **barrera** serializa las actualizaciones para que una respuesta vieja no pueda deshacer una
revocación nueva (generaciones + `installBarrier`, `server.ts:206-224`).
- **Adaptación en Ego:** `McpClient` **anuncia** `roots: { listChanged: true }` en el `initialize`
(`packages/integrations/src/mcp/McpClient.ts:174`) pero `handleServerRequest` (`:483-510`) responde
`-32601 "Método 'roots/list' no soportado"` cuando no hay listener. Un servidor oficial como `filesystem`
llama `roots/list` en su `initialize` y recibe un error: degrada a las rutas de CLI y, en la era
2025, queda en un estado en el que no puede revocar.
- **Relación con Backlog Ego:** `ACT-09`, `SEC-05`, `ACT-04`.

#### C.2 Estado por instancia, sin mapas globales por `session id` ####

(`src/everything/server/context.ts:1-18,34-47`; `src/everything/server/index.ts:159-173`;
`src/everything/transports/stdio.ts:42-81`)

- **Qué hace:** la revisión 2026-07-28 no tiene sesiones, así que el estado que sobrevive entre
llamadas vive en la **instancia** que construyó la fábrica, no en un mapa global indexado por
`session id`. `serveStdio` construye un servidor por conexión y lo destruye al cerrar (`cleanup`).
- **Adaptación en Ego:** `EgoMcpServer` es un singleton en el main
(`apps/desktop/src/main/mcp/mcp-server-runtime.ts:99`) con un único gate de aprobación compartido por todas
las conexiones; `McpManager` indexa por `id` de servidor, no por sesión
(`packages/integrations/src/mcp/McpManager.ts:52`). Es correcto para un servidor local único, pero no escala
a varias conexiones simultáneas sin un `ServerContext` por conexión.
- **Relación con Backlog Ego:** `ACT-09`, `SEC-06`.

**C.3 Estado de ida y vuelta firmado y con caducidad** (`src/everything/server/index.ts:68-85`)

- **Qué hace:** el estado multi-ronda que viaja por el cliente se firma con HMAC-SHA256 y expira
(`createRequestStateCodec({ ttlSeconds: 600 })`); el SDK verifica la firma antes de ejecutar el handler.
- **Adaptación en Ego:** no hay equivalente. `EgoMcpServer` reenvía `executionContext` fijo a todas las
llamadas (`McpServer.ts:230-235`) y no transporta estado entre rondas; la identidad causal la aporta
`ActionIdentity` del `ApprovalEngine` (`ACT-06`), que ya es más fuerte que el estado firmado del upstream.
- **Relación con Backlog Ego:** `ACT-06`, `SEC-06`.

### Bloque D — Empaquetado, transporte y ciclo de vida ###

*Ubicación en fuente: `src/everything/index.ts`, `src/everything/transports/`, `src/everything/package.json`*

#### D.1 Lanzador con `isEntryPoint()` y transports cargados bajo demanda ####

(`src/everything/index.ts:19-59,66-76`; `src/everything/transports/stdio.ts:42-94`)

- **Qué hace:** el `bin` resuelve el transporte del primer argumento; el módulo de transporte se
importa dinámicamente para que sólo se inicialice el elegido; `isEntryPoint` compara rutas resueltas por
symlink porque el shim de `npx` es un symlink a `dist/index.js`. Cada servidor se publica por separado
con su `bin` y su propio Dockerfile multi-stage (`src/everything/package.json:18-20`;
`src/filesystem/Dockerfile:1-25`).
- **Adaptación en Ego:** aplicable al flag `--mcp-server` del binario de Electron que
`EgoMcpServer.startStdio` (`McpServer.ts:389-405`) ya contempla. Hoy el servidor de producción arranca por
HTTP en loopback (`mcp-server-runtime.ts:109`), que es la decisión correcta; el patrón se conserva como
referencia para el modo stdio. El `bin`/`npx`/`uv`/Dockerfile **no** se adapta: Ego no distribuye
servidores MCP y su política de invocación ya está en `MCP_COMMAND_ALLOWLIST` (`McpClient.ts:32-41`).
- **Relación con Backlog Ego:** `ACT-09`, `SEC-05`, `DIST-01`.

---

## 3. Matriz de Extracción vs Descarte ##

| Componente MCP Servers | Acción | Razón Técnica / Arquitectónica |
| --- | :---: | --- |
| Anotaciones `annotations` por tool (`src/filesystem/server.ts:288,441-446`) | **EXTRAER & ADAPTAR** | Hoy el riesgo de una tool MCP importada se deduce del nombre (`McpClient.ts:749-776`): `archive_file` y `git_commit` caen en `sensitive` aunque el servidor declare `readOnlyHint: true`. La declaración del servidor es la fuente de verdad y ya viaja en `tools/list`. |
| Implementación de `roots/list` y `roots/list_changed` (`src/filesystem/server.ts:815-916`) | **EXTRAER & ADAPTAR** | Ego **anuncia** `roots` en el handshake (`McpClient.ts:174`) y responde `-32601` a la petición que el propio anuncio obliga a soportar (`:506-509`). Es una capacidad declarada y no cumplida. |
| Descubrimiento `resources/list`, `resources/read`, `prompts/list`, `prompts/get` (`src/everything/resources/index.ts:16-23`) | **EXTRAER & ADAPTAR** | `docs/engineering/integraciones.md:80` promete el descubrimiento completo; el cliente sólo implementa `tools/list` (`McpClient.ts:251-259`). Cierre de divergencia doc↔código. |
| Plantillas de recurso con variables y completers (`src/everything/resources/templates.ts:169-209`) | **EXTRAER PATRÓN** | Sin `resources/templates/list` un cliente no puede descubrir direcciones parametrizables de memoria (`memory://kb/docs/{docId}`) ni de payload. |
| Prompts con argumentos tipados (`src/everything/prompts/args.ts:11-41`) | **EXTRAER PATRÓN** | Los prompts de Ego son actualmente de texto fijo (`McpServer.ts:330-345`); parametrizarlos abre el uso de Sub-Egos como plantillas invocables. |
| Registro modular `registerX(server, context)` + `ServerContext` por instancia (`src/everything/server/index.ts:180-182`; `server/context.ts:34-47`) | **EXTRAER PATRÓN** | Es el habilitador de `MCPS-03`/`MCPS-04`: sin registro modular, el `switch` de `McpServer.ts:115-147` crece con cada capacidad. |
| Handshake `initialize` + `notifications/initialized` + framing por líneas (`src/everything/transports/stdio.ts:42-81`) | **EXTRAER PATRÓN (ya asimilado)** | `McpClient.connect()` (`McpClient.ts:171-185`) y `handleStdoutData` (`:416-434`) ya implementan exactamente este ciclo. |
| Validación Zod de la entrada y error de tool como resultado `isError` (`src/filesystem/server.ts:47-57`; `src/everything/tools/trigger-elicitation-request.ts:166-239`) | **EXTRAER PATRÓN (ya asimilado)** | `EgoMcpServer.handleToolsCall` valida con `toolRegistry.validateInput` (`McpServer.ts:197-206`) y devuelve el fallo de la tool como resultado con `isError: true` (`:241-253`), distinguiéndolo del error de protocolo. |
| Versión de protocolo y era (`src/everything/server/index.ts:1-20`; `transports/stdio.ts:3-17`) | **EXTRAER & ADAPTAR (P1)** | Ego fija `2024-11-05` en cliente (`McpClient.ts:172`) y servidor (`McpServer.ts:153`). Subir de versión afecta al handshake con clientes externos y exige decisión del owner sobre compromiso de compatibilidad. |
| Allow-list de directorios y validación de rutas (`src/filesystem/path-validation.ts:11-106`; `roots-utils.ts:59-91`) | **DESCARTAR** | Sustituido por un módulo canónico **más estricto**: `PathValidator` (`packages/tools/src/native/fs/PathValidator.ts:36-88,107-161`) añade rutas reservadas del SO, cierre de TOCTOU por `realpath` del directorio padre y comprobación de symlink. |
| Guards de inyección de flags del servidor git (`src/git/src/mcp_server_git/server.py:93-98,251-256,284-286,303-305,378-383`) | **DESCARTAR** | Sustituido por `TerminalCommandPolicy` (`packages/tools/src/native/terminal/TerminalCommandPolicy.ts:78-138,459-466`), que bloquea banderas peligrosas por comando y rechaza cualquier argumento que empiece por `-`; está en producción vía `NativeTerminalTool.ts:69` → `registerNativeTools` (`apps/desktop/src/main.ts:2124`). |
| Servidor `memory` (grafo de entidades/relaciones en JSONL, `src/memory/index.ts:3-4,357-510`) | **DESCARTAR** | Contaminación de dominio y sustrato pre-VantaDB: el grafo de conocimiento de Ego vive en `KnowledgeIndexer`/`GraphRagEngine` sobre VantaDB (`KB-03`, `KB-06`). |
| Servidores `sequentialthinking` (`src/sequentialthinking/index.ts:57-162`), `time` y `fetch` | **DESCARTAR** | Contaminación de dominio: cadena de pensamiento como producto, conversión de zonas horarias y scrape de web no son entidades de un SOC local-first; el razonamiento de Ego es la Decision Intelligence Layer (`DEC-01`), y la frontera de red la fija `netPolicy` (`SEC-05`). |
| Empaquetado `bin`/npm/`uv`/Dockerfile (`src/everything/package.json:18-20`; `src/filesystem/Dockerfile:1-25`) | **DESCARTAR** | Ego no distribuye servidores MCP; su política de spawn ya está en `MCP_COMMAND_ALLOWLIST` (`McpClient.ts:32-41`) con `shell:true` prohibido (`:57-69`). El contenedor es un mecanismo de distribución de terceros. |
| Servidor `git` completo (GitPython, 12 tools, `src/git/src/mcp_server_git/server.py`) | **DESCARTAR** | El dominio git ya está cubierto por los conectores Nivel A nativos (`git_status`, `git_diff` en `packages/tools/src/native/git/NativeGitTool.ts:29,64`) y por `SubEgoWorktree` (`HERM-17`); el modelo de repositorio único con `--repository` no aporta. |

---

## 4. Estado real verificado (2026-10-20) ##

> Criterio de cierre: fichero adaptado **y** caller en producción verificado por grep sobre `packages/` +
> `apps/desktop/` (excluyendo `test/`, `dist/`, `node_modules/`).
> Este repositorio de referencia es **nuevo**: ninguna fila se ha asimilado por copia; las dos filas
> `✅ Completada` lo están porque el **patrón** ya está implementado en Ego y en producción, verificado por grep.

| ID | Patrón | Estado | Evidencia / Fundamento |
| --- | --- | :---: | --- |
| `MCPS-01` | Anotaciones MCP de riesgo por tool y riesgo declarado en la importación | 🆕 Pendiente | No asimilado. `McpToolDefinition` (`packages/integrations/src/mcp/types.ts:67-76`) no declara `annotations`; `inferRiskLevel` (`McpClient.ts:749-776`) decide por el nombre; `exportJsonSchemas` (`packages/tools/src/ToolRegistry.ts:207-220`) y `handleToolsList` (`McpServer.ts:167-176`) no las publican. **Cableado:** añadir `annotations` a `McpToolDefinition`, mapear `destructiveHint`/`readOnlyHint` a `ToolRiskLevel` con prioridad sobre la heurística, y publicar `annotations` en `handleToolsList` (owner A4). |
| `MCPS-02` | Protocolo Roots: capacidad declarada y no implementada | 🆕 Pendiente | No asimilado. `McpClient.ts:174` anuncia `roots: { listChanged: true }`; `handleServerRequest` (`:483-510`) responde `-32601` a `roots/list` si no hay listener, y no hay listener en `apps/desktop/src/main.ts` (búsqueda de `roots` sobre `packages/integrations/src` → 2 hits, ambos de la declaración). **Cableado:** responder `roots/list` con el workspace/proyecto del contexto de ejecución y atender `notifications/roots/list_changed`; si no se implementa, retirar la capacidad del handshake (owner A4). |
| `MCPS-03` | Descubrimiento de `resources/*` y `prompts/*` + registro modular `registerX(server, context)` | 🆕 Pendiente | No asimilado. Grep `resources/list \| prompts/list` sobre `packages/` → sólo `packages/integrations/src/mcp/McpServer.ts:127,131` (lado **servidor**) y el test `packages/integrations/test/mcp-server.test.ts`; el **cliente** sólo implementa `tools/list` (`McpClient.ts:251-259`) frente a lo que promete `docs/engineering/integraciones.md:80`. `handleRequest` es un `switch` monolítico (`McpServer.ts:115-147`). **Cableado:** `McpClient.listResources()`/`listPrompts()` + `resources/read`/`prompts/get`, y refactor del `switch` a registro por área con `ServerContext` por instancia (owner A4). |
| `MCPS-04` | Plantillas de recurso con variables de URI y autocompletado; prompts con argumentos tipados | 🆕 Pendiente | No asimilado. `handleResourcesList` (`McpServer.ts:256-280`) sólo publica recursos estáticos y no existe `resources/templates/list`; `handlePromptsList` (`:330-345`) devuelve `arguments: []` fijo. **Cableado:** `ResourceTemplate` en `packages/integrations/src/mcp/` con routing por variable y validación (`ResourceNotFoundError` → `-32602`), y `argsSchema` Zod en `handlePromptsList`/`handlePromptsGet` (owner A4). |
| `MCPS-05` | Ciclo de vida del handshake MCP y framing del transporte stdio | ✅ Completada | Ya implementado en Ego con caller en producción: `McpClient.connect()` envía `initialize` y `notifications/initialized` (`packages/integrations/src/mcp/McpClient.ts:171-185`) y `handleStdoutData` delimita por `\n` (`:416-434`). **Caller:** `apps/desktop/src/main.ts:2170` (`new McpManager(toolRegistry, …)`) → `:2386` (`mcpManager.registerServer`) → `McpManager.connectServer` (`packages/integrations/src/mcp/McpManager.ts:109-147`) → `client.connect()`. |
| `MCPS-06` | Validación Zod de la entrada de la tool y fallo de la tool devuelto como resultado `isError` | ✅ Completada | Ya implementado en Ego con caller en producción: `handleToolsCall` valida con `toolRegistry.validateInput` (`packages/integrations/src/mcp/McpServer.ts:197-206`) y distingue el fallo de la tool (resultado con `isError: true`, `:241-253`) del error de protocolo (`-32602`/`-32601`, `:99-102,138`). **Caller:** `apps/desktop/src/main.ts:2464` (`startEgoMcpServer`) → `apps/desktop/src/main/mcp/mcp-server-runtime.ts:94-110` → `new EgoMcpServer({...})` (`:99`), que sirve por HTTP streamable en loopback. |
| `MCPS-07` | Versionado del protocolo y era; coherencia de las capacidades declaradas | ⏳ Futura (Fase 11 — SEC, iteración P1) | `McpClient.ts:172` y `McpServer.ts:153` fijan `protocolVersion: "2024-11-05"`; los servidores de referencia sirven clientes 2025 y 2026-07-28 desde una fábrica (`src/everything/server/index.ts:1-20`; `transports/stdio.ts:3-17`). Además Ego declara `listChanged: true` en tres capacidades (`McpServer.ts:155-157`) sin emitir ninguna notificación (grep `list_changed` → sólo `packages/events/src/EventNormalizer.ts:27`) y `docs/engineering/integraciones.md:99` sigue declarando el transporte del servidor de Ego como `stdio` cuando el runtime real es HTTP en loopback (`mcp-server-runtime.ts:10-11,109`). **Fase destino:** Fase 11 (`SEC`) para el compromiso de versión y la emisión de `list_changed`; Fase 12 (`DIST`) para la matriz de compatibilidad con clientes externos. Motivo del diferimiento: cambiar la versión del protocolo afecta al handshake con clientes de terceros (Claude Desktop, OpenCode, Cursor) y exige decisión del owner sobre el compromiso de compatibilidad. |
| `MCPS-08` | Servidores de dominio ajeno (`memory`, `sequentialthinking`, `time`, `fetch`) y empaquetado/distribución de servidor | 🚫 **Descartada (con justificación)** | Contaminación de dominio y mecanismo de distribución: el grafo de conocimiento en JSONL (`src/memory/index.ts:3-4,357-510`) es un sustrato pre-VantaDB sustituido por `KnowledgeIndexer`/`GraphRagEngine` (`KB-03`, `KB-06`); la cadena de pensamiento como producto (`src/sequentialthinking/index.ts:57-162`) es ajena a la Decision Intelligence Layer (`DEC-01`); `time` y `fetch` no son entidades de un SOC local-first (la red la acota `netPolicy`, `SEC-05`). El `bin`/`npx`/`uv`/`Dockerfile` (`src/everything/package.json:18-20`; `src/filesystem/Dockerfile:1-25`) es distribución de servidores de terceros: Ego no distribuye servidores MCP y su política de spawn ya está en `MCP_COMMAND_ALLOWLIST` (`McpClient.ts:32-41`) con `shell:true` prohibido (`:57-69`). |
| `MCPS-09` | Allow-list de directorios y guards de inyección de flags (filesystem server y git server) | 🚫 **Descartada (con justificación)** | Sustituidos por módulos canónicos **más estrictos**: `PathValidator` (`packages/tools/src/native/fs/PathValidator.ts:36-88,107-161`) añade rutas reservadas del SO (`RESERVED_SYSTEM_DIRS`, `:9-20`), cierre de TOCTOU por `realpath` del directorio padre y rechazo de symlinks, frente a `isPathWithinAllowedDirectories` (`src/filesystem/path-validation.ts:11-106`); y `TerminalCommandPolicy` (`packages/tools/src/native/terminal/TerminalCommandPolicy.ts:78-138,459-466`) bloquea banderas peligrosas y rechaza argumentos que empiezan por `-`, en producción vía `NativeTerminalTool.ts:69` → `registerNativeTools` (`apps/desktop/src/main.ts:2124`), frente a los guards del servidor git (`src/git/src/mcp_server_git/server.py:93-98,251-256,284-286,303-305,378-383`). |

**Recuento:** 2 `✅ Completada` · 2 `🚫 Descartada` · 4 `🆕 Pendiente` · 1 `⏳ Futura` — **9 tareas**.

## 5. Descarte normalizado a la forma canónica ##

Las filas de la matriz §3 usaban la forma `**DESCARTAR**`; se normalizan aquí a
`🚫 Descartada (con justificación)` (AGENTS.md §4) conservando el motivo original:

| Componente MCP Servers | Veredicto | Fundamento |
| --- | :---: | --- |
| Allow-list de directorios del filesystem server (`path-validation.ts`, `roots-utils.ts`) | 🚫 **Descartada (con justificación)** | Sustituida por `PathValidator` canónico, que además cubre rutas reservadas del SO y el TOCTOU por `realpath` del padre. |
| Guards de inyección de flags del git server (`server.py`) | 🚫 **Descartada (con justificación)** | Sustituidos por `TerminalCommandPolicy`, ya en producción en `NativeTerminalTool.ts:69`. |
| Servidor `memory` (grafo de conocimiento en JSONL) | 🚫 **Descartada (con justificación)** | Contaminación de dominio y sustrato pre-VantaDB; sustituido por `KnowledgeIndexer`/`GraphRagEngine` (`KB-03`, `KB-06`). |
| Servidores `sequentialthinking`, `time` y `fetch` | 🚫 **Descartada (con justificación)** | Modelos de negocio ajenos al SOC local-first (principio 9); la frontera de red la fija `netPolicy` (`SEC-05`). |
| Empaquetado y distribución (`bin`/npm workspaces/`uv`/Dockerfile) | 🚫 **Descartada (con justificación)** | Ego no distribuye servidores MCP; la política de invocación ya está en `MCP_COMMAND_ALLOWLIST` con `shell:true` prohibido. |
| Servidor `git` completo (GitPython, 12 tools) | 🚫 **Descartada (con justificación)** | El dominio git está cubierto por los conectores Nivel A nativos (`git_status`, `git_diff`) y por `SubEgoWorktree` (`HERM-17`). |
