---
kind: review
status: active
description: "Backlog especializado para la revisión, extracción de patrones y adaptación técnica de los servidores MCP oficiales de referencia (modelcontextprotocol/servers) hacia el monorepo de Ego."
tags: [ego, mcp, mcp-servers, extraction, review, tools, resources, prompts, roots]
schema: "10-column canonical schema (.agents/references/backlog-format.md compatible)"
---

# Backlog de Revisión y Extracción: MCP Servers (modelcontextprotocol/servers) #

## Compuerta de extracción sobre los servidores MCP oficiales de referencia ##

Contrato de registro de capacidades, anotaciones de riesgo, recursos parametrizables y protocolo Roots.

| Estado | Repositorio Origen | Total de Tareas | Fases Impactadas en Ego | Owner | Fecha | Última verificación |
| --- | --- | :---: | --- | --- | --- | --- |
| Activo — 9 compuertas, 2 asimiladas | `repos-referencia/mcp-servers/` (commit `51b6382`, tag `v2.0.0`, MIT→Apache-2.0) | **9** (`MCPS-01..09`) | Fases 01 (`CORE`), 02 (`ACT`), 03 (`SUB`), 06 (`KB`), 10 (`REC`), 11 (`SEC`), 12 (`DIST`) | ness-e | 2026-10-20 | 2026-10-20 — grep sobre `packages/` + `apps/desktop/` (excluye `test/`, `dist/`, `node_modules/`) |

---

## 0. Verificación de estado (2026-10-20) ##

| Estado | Significado canónico |
| --- | --- |
| `✅ Completada` | Asimilado, integrado y con **caller en producción verificado**. La celda cita la ruta real. |
| `🚫 Descartada (con justificación)` | El patrón no se aplica en Ego, fue sustituido por otro módulo canónico, o viola un guardrail. La celda contiene el motivo técnico. |
| `🆕 Pendiente` | Patrón asimilado (o pendiente de asimilar) **sin caller en producción**. La celda dice el **cableado exacto** y **quién lo ejecuta**. |
| `⏳ Futura (fase)` | Diferido a una fase posterior, con fase destino explícita. |

**Nota de alcance (obligatoria):** repositorio de referencia **nuevo**. Ningún patrón de
`modelcontextprotocol/servers` ha sido asimilado **por copia** en `packages/` ni en `apps/desktop/`. Las
dos filas `✅ Completada` (`MCPS-05`, `MCPS-06`) lo están porque el **patrón** ya está implementado en Ego
con caller de producción verificado por grep, no porque proceda de este repo. Búsquedas de verificación
ejecutadas:

```text
grep -r "resources/list|prompts/list|resources/read|prompts/get" packages/
   -> packages/integrations/src/mcp/McpServer.ts:127,129,131,133  (lado SERVIDOR) + test
   -> 0 ocurrencias en el lado CLIENTE (McpClient.ts)
grep -r "roots" packages/integrations/src
   -> McpClient.ts:174 (declaración de capacidad) + types.ts:38 (tipo)  -> 0 manejadores de roots/list
grep -r "annotations|readOnlyHint|destructiveHint|idempotentHint|openWorldHint" packages/ apps/   -> 0
grep -r "list_changed" packages/          -> packages/events/src/EventNormalizer.ts:27 (sólo normalización)
grep -r "McpClient|McpManager" apps/desktop/src -> main.ts:193,1869,2170,2386,2507 + register-ipc.ts:101,555,612,644,671,715
grep -r "EgoMcpServer|startEgoMcpServer" apps/desktop/src -> main.ts:74,2454,2464 + mcp-server-runtime.ts:94,99
```

**Salvedad de fuente (verificada):** el clon es el repositorio oficial de servidores MCP de referencia
en su **revisión v2** (`v2.0.0`, `AGENTS.md` raíz: *"seven standalone packages under `src/`, four in
TypeScript and three in Python"*). El árbol de referencia son 7 servidores con dominio propio
(`everything`, `filesystem`, `memory`, `sequentialthinking`, `fetch`, `git`, `time`); sólo los **contratos de
protocolo** son transferibles a Ego, no los schemas de negocio. Licencia en transición MIT → Apache-2.0
(`LICENSE:1-3`): cualquier fichero derivado exige cabecera de atribución.

---

## 1. Resumen Ejecutivo de Extracción ##

`modelcontextprotocol/servers` aporta a Ego **seis patrones transferibles** del lado servidor del protocolo
que Ego —que ya es MCP Client **y** MCP Server— no tiene cerrados: (1) **anotaciones de riesgo por
tool** (`readOnlyHint`/`destructiveHint`/`idempotentHint`/`openWorldHint`) que sustituyen la deducción por
nombre; (2) **implementación real del protocolo Roots**, hoy anunciado por el cliente y rechazado con
`-32601` cuando el servidor pregunta; (3) **descubrimiento de `resources` y `prompts`** —que la doc
canónica ya promete y el cliente no implementa—; (4) **plantillas de recurso con variables de URI y
autocompletado**, más **prompts con argumentos tipados**; (5) **registro modular por función
`registerX(server, context)`** con estado por instancia, en lugar de un `switch` monolítico; y (6)
**versionado de protocolo y era**, con coherencia entre capacidades declaradas y capacidades emitidas. Se
descartan con justificación el **dominio ajeno** (`memory` con grafo JSONL, `sequentialthinking`, `time`,
`fetch`), el **empaquetado y distribución de servidor** (`bin`/`npx`/`uv`/Dockerfile) y las **validaciones
ya cubiertas por módulos canónicos más estrictos** (`PathValidator` y `TerminalCommandPolicy`). Se difiere
a Fase 11 el **compromiso de versión de protocolo**.

El valor estructural para Ego está en que la capa MCP de producción ya cubre el camino feliz
(`MCPS-05`, `MCPS-06`) y por eso es invisible el hueco: `McpClient` anuncia `roots` (`McpClient.ts:174`) y
responde `-32601` a `roots/list` (`:483-510`); `McpToolDefinition` no tiene `annotations` (`types.ts:67-76`)
y el riesgo se deduce del nombre (`McpClient.ts:749-776`); y `docs/engineering/integraciones.md:80` promete
un descubrimiento que `McpClient.ts:251-259` no hace.

### MATRIZ DE DISTRIBUCIÓN POR FASE ###

```text
FASE 01 CORE   ······················ transversal: MCPS-03 da contexto de sesión a los recursos
FASE 02 ACT    ······················ MCPS-01  MCPS-02  MCPS-03  MCPS-04       (4)
FASE 03 SUB    ······················ transversal: MCPS-04 parametriza los prompts de Sub-Ego
FASE 06 KB     ······················ MCPS-04                                  (1)
FASE 10 REC    ······················ transversal: MCPS-02 (revocación de roots)
FASE 11 SEC    ······················ MCPS-07                                  (1)
FASE 12 DIST   ······················ MCPS-07 (matriz de compatibilidad)
DESCARTES      ······················ MCPS-08  MCPS-09                         (2)
YA ASIMILADAS  ······················ MCPS-05  MCPS-06                         (2)
```

**Recuento de estados:** 2 `✅ Completada` · 2 `🚫 Descartada` · 4 `🆕 Pendiente` · 1 `⏳ Futura` — **9 tareas**.

---

## 2. Catálogo Detallado de Extracción (10 Columnas Canónicas) ##

| ID | Severidad | Hallazgo | Archivo MCP Servers | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `MCPS-01` | Crítica | **Anotaciones MCP de riesgo por tool y riesgo declarado en la importación** | `src/filesystem/server.ts:280-291,431-457`, `src/everything/tools/trigger-elicitation-request.ts:27-32` | 1-2 d | P0 | 🆕 Pendiente | El servidor declara `readOnlyHint`/`destructiveHint`/`idempotentHint`/`openWorldHint` por tool; el `AGENTS.md` raíz del repo lo exige ("sets `readOnlyHint`, `idempotentHint` and `destructiveHint` to values that match what it actually does"). En Ego `McpToolDefinition` (`packages/integrations/src/mcp/types.ts:67-76`) no tiene campo `annotations`, `inferRiskLevel` (`McpClient.ts:749-776`) decide por el nombre (`archive_file`, `git_commit` caen en `sensitive` aunque el servidor diga `readOnlyHint: true`), `ToolRegistry.exportJsonSchemas` (`packages/tools/src/ToolRegistry.ts:207-220`) no exporta anotaciones y `handleToolsList` (`McpServer.ts:167-176`) no las publica. **Cableado:** añadir `annotations` a `McpToolDefinition`, mapear `destructiveHint`/`readOnlyHint` a `ToolRiskLevel` con prioridad sobre la heurística, y publicar `annotations` en `handleToolsList` (owner A4). | Ego: `ACT-09`, `SEC-05`, `ACT-11`, `ACT-01` · Extracción: `docs/extractions/mcp-servers.md` §Bloque A | — |
| `MCPS-02` | Crítica | **Protocolo Roots: capacidad declarada en el handshake y no implementada** | `src/filesystem/roots-utils.ts:59-91`, `src/filesystem/server.ts:815-916` | 1-2 d | P0 | 🆕 Pendiente | El servidor pide `roots/list` al cliente y usa los roots como allow-list; un `roots/list_changed` la reemplaza y, si el cliente los retira, el acceso se revoca; una barrera con generaciones evita que una respuesta vieja deshaga una revocación nueva (`server.ts:206-224`). Ego **anuncia** `roots: { listChanged: true }` (`McpClient.ts:174`) y `handleServerRequest` (`:483-510`) responde `-32601 "Método 'roots/list' no soportado"` si no hay listener: grep de `roots` sobre `packages/integrations/src` → 2 hits, ambos de la declaración. Un servidor oficial degrada a sus rutas de CLI y queda sin poder revocar. **Cableado:** responder `roots/list` con el workspace/proyecto del contexto de ejecución y atender `notifications/roots/list_changed`; si no se implementa, retirar la capacidad del handshake (owner A4). | Ego: `ACT-09`, `SEC-05`, `ACT-04` | `MCPS-03` |
| `MCPS-03` | Crítica | **Descubrimiento de `resources/*` y `prompts/*` documentado y ausente + registro modular `registerX(server, context)`** | `src/everything/resources/index.ts:16-23`, `src/everything/prompts/index.ts:12-17`, `src/everything/server/index.ts:114-216` | 2-3 d | P0 | 🆕 Pendiente | `docs/engineering/integraciones.md:80` promete `tools/list`, `resources/list` y `prompts/list` en el descubrimiento; el cliente sólo implementa `tools/list` (`McpClient.ts:251-259`) y `tools/call` (`:271-288`). La referencia resuelve el problema con una fábrica que delega en `registerTools`/`registerResources`/`registerPrompts` y un `ServerContext` por instancia; Ego tiene un `switch` monolítico de diez métodos (`McpServer.ts:115-147`) con los proveedores acoplados a `EgoMcpServerOptions` (`:75-96`). **Cableado:** `McpClient.listResources()`/`listPrompts()` + `resources/read`/`prompts/get`, y refactor del `switch` a registro por área con contexto por instancia (owner A4). | Ego: `ACT-09`, `ACT-11`, `INT-01`, `KB-03` | — |
| `MCPS-04` | Alta | **Plantillas de recurso con variables de URI y autocompletado; prompts con argumentos tipados** | `src/everything/resources/templates.ts:28-33,146-153,169-209`, `src/everything/prompts/args.ts:11-41`, `src/everything/prompts/resource.ts:24-94` | 2 d | P1 | 🆕 Pendiente | `ResourceTemplate("demo://resource/dynamic/text/{resourceId}", { complete: {...} })` declara una URI parametrizada que el SDK enruta al handler; el handler valida la variable y lanza `ResourceNotFoundError` (protocolo: `-32602` con la URI en `data`). Los prompts declaran `argsSchema` Zod y el prompt con recurso embebido valida en el handler además del esquema. En Ego `handleResourcesList` (`McpServer.ts:256-280`) sólo publica recursos estáticos (`payload://`, `memory://`), no existe `resources/templates/list`, y `handlePromptsList` (`:330-345`) devuelve `arguments: []` fijo. **Cableado:** `ResourceTemplate` en `packages/integrations/src/mcp/` con routing por variable y validación, y `argsSchema` Zod en `handlePromptsList`/`handlePromptsGet` (owner A4). | Ego: `KB-03`, `KB-04`, `CANV-06`, `SUB-01` | `MCPS-03` |
| `MCPS-05` | Media | **Ciclo de vida del handshake MCP y framing del transporte stdio** | `src/everything/transports/stdio.ts:42-94`, `src/everything/index.ts:19-59,66-76` | 0.5 d | P2 | ✅ Completada | El patrón ya está implementado en Ego con caller de producción: `McpClient.connect()` envía `initialize` con `clientInfo` y capabilities y luego `notifications/initialized` (`packages/integrations/src/mcp/McpClient.ts:171-185`); `handleStdoutData` delimita el flujo por `\n` y parsea cada línea (`:416-434`). **Caller:** `apps/desktop/src/main.ts:2170` (`new McpManager(toolRegistry, …)`) → `:2386` (`mcpManager.registerServer`) → `McpManager.connectServer` (`packages/integrations/src/mcp/McpManager.ts:109-147`) → `client.connect()`. El lanzador con `isEntryPoint()` (resolución de symlink del shim `npx`) queda como referencia para el futuro flag `--mcp-server` del binario de Electron (`McpServer.ts:389-405`). | Ego: `ACT-09`, `INT-01` | — |
| `MCPS-06` | Media | **Validación Zod de la entrada de la tool y fallo de la tool devuelto como resultado `isError`** | `src/filesystem/server.ts:42-57`, `src/everything/tools/trigger-elicitation-request.ts:166-239` | 0.5 d | P2 | ✅ Completada | El patrón ya está implementado en Ego con caller de producción: `handleToolsCall` valida con `toolRegistry.validateInput` (`packages/integrations/src/mcp/McpServer.ts:197-206`) y distingue el fallo de la tool (resultado con `isError: true`, `:241-253`) del error de protocolo (`-32602`/`-32601`, `:99-102,138`), tal como exige la convención MCP. **Caller:** `apps/desktop/src/main.ts:2464` (`startEgoMcpServer`) → `apps/desktop/src/main/mcp/mcp-server-runtime.ts:94-110` → `new EgoMcpServer({...})` (`:99`), que sirve por HTTP streamable en loopback con bearer token. El *dialecto JSON Schema 2020-12* explícito (`src/filesystem/server.ts:30-44`) queda pendiente de aplicarse en `packages/tools/src/schema-converter.ts` y `schema-bridge.ts:6-57`. | Ego: `ACT-01`, `ACT-09`, `SEC-02` | — |
| `MCPS-07` | Alta | **Versionado del protocolo y era; coherencia entre capacidades declaradas y emitidas** | `src/everything/server/index.ts:1-20,68-85`, `src/everything/transports/stdio.ts:3-17`, `src/everything/resources/subscriptions.ts:24-53,63-82` | 3 d | P1 | ⏳ Futura (Fase 11 — SEC) | Ego fija `protocolVersion: "2024-11-05"` en cliente (`McpClient.ts:172`) y servidor (`McpServer.ts:153`); la referencia sirve clientes 2025 y 2026-07-28 desde una fábrica, con estado multi-ronda firmado y con caducidad (`createRequestStateCodec`, TTL 600 s) y sin mapas globales por `session id`. Además Ego declara `listChanged: true` en tres capacidades (`McpServer.ts:155-157`) **sin emitir ninguna notificación** (grep `list_changed` → sólo `packages/events/src/EventNormalizer.ts:27`) y `docs/engineering/integraciones.md:99` sigue declarando el transporte del servidor de Ego como `stdio` cuando el runtime real es HTTP en loopback (`mcp-server-runtime.ts:10-11,109`). **Fase destino:** Fase 11 (`SEC`) para el compromiso de versión y la emisión de `list_changed`; Fase 12 (`DIST`) para la matriz de compatibilidad con clientes externos. **Motivo del diferimiento:** cambiar la versión del protocolo afecta al handshake con clientes de terceros (Claude Desktop, OpenCode, Cursor) y exige decisión del owner sobre el compromiso de compatibilidad. | Ego: `ACT-09`, `SEC-05`, `DIST-01` | `MCPS-03` |
| `MCPS-08` | Alta | **Servidores de dominio ajeno (`memory`, `sequentialthinking`, `time`, `fetch`) y empaquetado/distribución de servidor** | `src/memory/index.ts:3-4,357-510`, `src/sequentialthinking/index.ts:57-162`, `src/everything/package.json:18-20`, `src/filesystem/Dockerfile:1-25` | — | — | 🚫 Descartada (con justificación) | Contaminación de dominio (`AGENTS.md` §4) y mecanismo de distribución: el grafo de conocimiento en JSONL es un sustrato pre-VantaDB, sustituido por `KnowledgeIndexer`/`GraphRagEngine` (`KB-03`, `KB-06`); la cadena de pensamiento como producto es ajena a la Decision Intelligence Layer (`DEC-01`); `time` y `fetch` no son entidades de un SOC local-first (la red la acota `netPolicy`, `SEC-05`). El `bin`/`npx`/`uv`/Dockerfile es distribución de servidores de terceros: Ego no distribuye servidores MCP y su política de spawn ya está en `MCP_COMMAND_ALLOWLIST` (`McpClient.ts:32-41`) con `shell:true` prohibido (`:57-69`). 0 hits esperados en `packages/` + `apps/desktop/`. | Ego: `KB-03`, `KB-06`, `DEC-01`, `SEC-05` | — |
| `MCPS-09` | Alta | **Allow-list de directorios y guards de inyección de flags (servidores `filesystem` y `git`)** | `src/filesystem/path-validation.ts:11-106`, `src/filesystem/roots-utils.ts:59-91`, `src/git/src/mcp_server_git/server.py:93-98,251-256,284-286,303-305,351-368,378-383` | — | — | 🚫 Descartada (con justificación) | Sustituidos por módulos canónicos **más estrictos**: `PathValidator` (`packages/tools/src/native/fs/PathValidator.ts:36-88,107-161`) añade rutas reservadas del SO (`RESERVED_SYSTEM_DIRS`, `:9-20`), cierre de TOCTOU por `realpath` del directorio padre y rechazo de symlinks, frente a `isPathWithinAllowedDirectories`; y `TerminalCommandPolicy` (`packages/tools/src/native/terminal/TerminalCommandPolicy.ts:78-138,459-466`) bloquea banderas peligrosas y rechaza argumentos que empiezan por `-`, en producción vía `NativeTerminalTool.ts:69` → `registerNativeTools` (`apps/desktop/src/main.ts:2124`). El servidor `git` completo (12 tools, GitPython) queda cubierto por los conectores Nivel A nativos (`git_status`, `git_diff`) y `SubEgoWorktree` (`HERM-17`). | Ego: `ACT-04`, `SEC-05`, `HERM-17` | — |

---

## 3. Matriz de Integración con el Backlog Maestro ##

Cada compuerta `MCPS-*` se ejecuta como pre-requisito de diseño y código de las fases del Backlog
Maestro (`docs/roadmap/Backlog.md`), respetando la regla de progresión estricta por fases de `AGENTS.md` §6.

```text
MCPS-01  Anotaciones de riesgo ────► ACT-09 (importación de tools MCP)
                                    ├─► ACT-01 (ToolRegistry: riskLevel + requiresApproval)
                                    └─► SEC-05 (ToolPermissions)
MCPS-02  Roots (client capability) ► ACT-09 (handshake del cliente MCP)
                                    ├─► SEC-05 (frontera de acceso)
                                    └─► ACT-04 (conectores nativos: allow-list de workspace)
MCPS-03  Descubrimiento + registro ► ACT-09 (McpClient: resources/prompts)
                                    ├─► ACT-11 (gestor y catálogo local de MCP)
                                    ├─► INT-01 (cableado Fast-Path)
                                    └─► KB-03 (recursos de conocimiento)
MCPS-04  Resources parametrizables ─► KB-03 (indexación vectorial)
                                    ├─► KB-04 (búsqueda híbrida)
                                    ├─► CANV-06 (persistencia del Canvas)
                                    └─► SUB-01 (manifiesto del Sub-Ego)
MCPS-05  Handshake stdio ─────────► (YA ASIMILADO — main.ts:2170,2386)
MCPS-06  Validación + isError ─────► (YA ASIMILADO — main.ts:2464 → mcp-server-runtime.ts:99)
MCPS-07  Versión de protocolo ─────► SEC-05 (endurecimiento del handshake)
                                    └─► DIST-01 (compatibilidad con clientes externos)
MCPS-08  Dominio ajeno ────────────► (DESCARTADO — guardrail de dominio)
MCPS-09  Path/flag guards ─────────► (DESCARTADO — módulos canónicos más estrictos)
```

**Protocolo de ejecución por compuerta:** (1) relectura del fichero fuente en
`repos-referencia/mcp-servers/`; (2) reescritura en TypeScript estricto dentro de
`packages/integrations/src/mcp/` o `packages/tools/`, sin arrastrar el SDK `@modelcontextprotocol/server` como
dependencia de núcleo (Ego implementa el protocolo sobre JSON-RPC propio); (3) test unitario en el
paquete destino; (4) verificación de caller con grep sobre `packages/` + `apps/desktop/` excluyendo
`test/`, `dist/` y `node_modules/`; (5) cierre de la fila en `✅ Completada` sólo con fichero **y**
caller verificados.

---

## 4. Deuda abierta derivada de esta verificación ##

| # | Ítem | Tipo | Owner | Bloqueante |
| --- | --- | --- | --- | --- |
| D1 | `MCPS-01`: el riesgo de una tool MCP importada se deduce del nombre (`McpClient.ts:749-776`) y las `annotations` que el servidor declara se descartan; una tool `readOnly` externa puede exigir HITL de más o, al revés, una destructiva pasar por `safe` | Código | A4 | No |
| D2 | `MCPS-02`: `McpClient` anuncia `roots` en el `initialize` (`McpClient.ts:174`) y responde `-32601` a `roots/list` (`:483-510`): capacidad declarada y no cumplida frente a los servidores oficiales | Código | A4 | No |
| D3 | `MCPS-03`: `docs/engineering/integraciones.md:80` promete `resources/list` y `prompts/list`; el cliente sólo implementa `tools/list`. Divergencia doc↔código en la doc canónica de integraciones | Documentación + Código | A4 | No |
| D4 | `MCPS-03`: `EgoMcpServer.handleRequest` es un `switch` monolítico de diez métodos (`McpServer.ts:115-147`); cada capacidad nueva obliga a editarlo | Código | A4 | No |
| D5 | `MCPS-07`: `EgoMcpServer` declara `listChanged: true` en tres capacidades (`McpServer.ts:155-157`) sin emitir ninguna notificación; un cliente MCP no puede enterarse de que el catálogo cambió | Código | A4 | No |
| D6 | `MCPS-07`: compromiso de versión de protocolo (`2024-11-05` en `McpClient.ts:172` y `McpServer.ts:153`) sin decisión del owner sobre compatibilidad con clientes externos | Decisión | Owner | Sí (bloquea `MCPS-07`) |
| D7 | `MCPS-07`: `docs/engineering/integraciones.md:99` declara el transporte del servidor MCP de Ego como `stdio`; el runtime real es HTTP streamable en loopback (`mcp-server-runtime.ts:10-11,109`). Además `:83` promete paginación y streaming de recursos que el cliente no implementa | Documentación | A5 | No |
| D8 | Contabilidad: `docs/extractions/README.md` §3/§4.1 y `docs/review/README.md` siguen sin incluir `mcp-servers`; su sincronización corresponde a la ola de consolidación, no a esta ficha | Documentación | A5 | No |
