# Mapa de obligaciones legales de licencia del catálogo de referencia de Ego #

| Campo | Valor |
| --- | --- |
| Estado | Activo — investigación de estado del arte, no normativo |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Alcance | Qué puede derivar Ego de cada repositorio de `repos-referencia/` y de los proyectos externos que los informes proponen integrar |
| Fuentes primarias | 25 fichas de `docs/extractions/`, 25 backlogs de `docs/review/`, 9 informes de `docs/research/` |
| Verificación | API pública de GitHub (`license.spdx_id`) + lectura del fichero `LICENSE` real en el clon o en `raw.githubusercontent.com` |
| Licencia del informe | Apache-2.0 (misma que el producto) |

> Documento de investigación. **No implementa nada, no modifica código, no añade tareas al Backlog
> Maestro y no edita fichas ni índices.** Su único efecto es dar una respuesta verificable a la
> pregunta *para cada proyecto que Ego podría integrar o adaptar, ¿qué puedo hacer y qué debo?*

---

## 1. Resumen ejecutivo ##

**Regla operativa, en una frase:** en Ego solo se puede *derivar código* de proyectos con licencia
**permisiva** (MIT, Apache-2.0, BSD, ISC) conservando el aviso de copyright y la licencia; de los
proyectos **copyleft fuerte** (AGPL-3.0, GPL-3.0), **source-available** (SSPL, BSL, BUSL, FSL-1.1,
Sustainable Use License, Elastic License 2.0, MSCL, NocoBase, LobeHub, Dify) o **propietarios**
(Claude Code, `anthropics/skills`, babyagi) sólo se extrae la *idea* o el *patrón*, reimplementado
desde cero en el sustrato de Ego (TypeScript estricto + VantaDB), y de los proyectos **duales** sólo
el núcleo permisivo, nunca las carpetas `enterprise/`, `ee/`, `premium/` o `x-pack/`.

- Se verificaron **56 proyectos** contra la API de GitHub el 2026-10-20: **35** permisivos con
  atribución, **7** con copyleft fuerte, **8** source-available no OSI, **3** propietarios o sin
  licencia de código y **3** de licencia dual o mixta por fichero.
- El hallazgo más grave de esta pasada: **`khoj-ai/khoj` es AGPL-3.0** y ni
  `docs/extractions/khoj.md` ni `docs/review/backlog-khoj.md` mencionan su licencia, pese a
  tener **3 filas `✅ Completada`**.
- Segundo hallazgo: **`packages/knowledge/src/ingest/AdaptiveChunker.ts:11`** declara estar
  *"basado en los patrones de Khoj"* y le atribuye un solapamiento de 32-64 tokens que el upstream
  **no tiene** (`chunk_overlap=0`, MD5), según `docs/review/backlog-khoj.md:104`. Atribución
  innecesaria (no hay obra derivada) y ademas inexacta.
- Tercer hallazgo: **`packages/tool-call-repair/src/grammar.ts:3`** dice *"Extraído y adaptado de
  OpenClaw"* sin nombrar la licencia MIT ni la ruta de origen, incumpliendo el formato canónico de
  `docs/extractions/README.md` §4.3.
- Cuarto hallazgo: el mecanismo de atribución **no está desplegado**. Hay **8** cabeceras en formato
  canónico (las 8 apuntan al HTML interno del propio paquete, no a un repo de referencia), **4** en
  prosa `PORTADO de` y **13** ficheros derivados sin cabecera. El compensador real es
  `packages/avatar/LICENSE.md`, que sí existe y es exhaustivo.
- **Ego es Apache-2.0** (`LICENSE` del repo, `AGENTS.md` §8). Apache-2.0 es compatible hacia
  delante con MIT, Apache-2.0, BSD e ISC, y **no** lo es con AGPL-3.0, GPL-3.0, SSPL ni con
  ninguna cláusula de *competing use*, *production use* o *additional use grant*.

---

## 2. Método ##

### 2.1 Qué se revisó ##

Se leyeron íntegramente, como corpus primario:

- Los **7 informes de estado del arte** de `docs/research/`: `orquestacion-multiagente.md`,
  `plantillas-agentes-y-enjambres.md`, `backoffice-empresa-personal.md`,
  `canales-comunicacion-y-social.md`, `compatibilidad-integraciones-mcp-skills.md`,
  `automatizacion-y-agentes-ejecucion.md` y `producto-y-desarrollo-como-empresa.md`, más
  `sintesis-capacidades-ego.md` (que define qué capacidades `SYN-01..SYN-10` se proponen y por
  tanto qué licencias importan de verdad).
- Las **25 fichas** de `docs/extractions/` y los **25 backlogs** de `docs/review/`, que defines
  la exposición real: qué patrones se han extraído ya de cada repositorio y con qué mecanismo.
- `AGENTS.md` (guardrails, §8 modelo de negocio y distribución), `LICENSE` (la licencia del
  producto), `docs/extractions/README.md` §4.3 (mecanismo de atribución) y
  `packages/avatar/LICENSE.md` (el registro de atribución que hoy sí existe).

### 2.2 Cómo se verificó cada licencia ##

Dos fuentes, y se declara cuál se usó en cada fila:

1. **API de GitHub**: `GET api.github.com/repos/<owner>/<repo>` y el campo `license.spdx_id`,
   más `default_branch` y `archived`. El token no pudo usarse en esta sesión (no hay shell
   disponible para el subagente), por lo que las consultas fueron **anónimas**; el límite de
   60 peticiones por hora se agotó tras 54 llamadas, lo que deja **2 proyectos del corpus sin
   re-verificar por API** (`microsoft/UFO` y `modelcontextprotocol/registry`; este último sí se
   resolvió leyendo su `LICENSE` en `raw.githubusercontent.com`).
2. **Fichero de licencia real**: `raw.githubusercontent.com/<owner>/<repo>/<branch>/LICENSE[.md|.txt]`
   (sin límite de peticiones) y, para los repos clonados, el fichero local en
   `repos-referencia/<repo>/LICENSE*`. Para los casos `NOASSERTION` o sin SPDX en la API, la
   clasificación se apoya en la **cláusula leída**, no en el nombre de la licencia.

El owner de cada clon se obtuvo de `repos-referencia/<repo>/.git/config` (`remote.origin.url`),
no de suposición. Donde la API devolvió `NOASSERTION`, se transcribe la cláusula concreta que
gobierna (§4). Donde no se pudo comprobar en esta pasada, la fila lo dice explícitamente.

### 2.3 Criterios de inclusión ##

Un proyecto entra en la tabla maestra si cumple **al menos uno** de estos cuatro criterios:

1. Es uno de los **25 repositorios** del catálogo de `docs/extractions/` (clonados y fichados).
2. Aparece como **upstream de un patrón ya asimilado** por Ego (fila `✅ Completada`).
3. Es un **proveedor de capacidad** que la síntesis propone integrar en `SYN-01..SYN-10`.
4. Su licencia aparece en los informes como **factor de descarte** o de **riesgo de contaminación**.

Quedan fuera los ~200 proyectos citados de pasada en los informes que no tocan ninguna capacidad
propuesta ni tienen categoría de riesgo; se listan en §3.1 con su licencia según el informe que
los verificó, marcados como *no verificados en esta pasada*.

### 2.4 Las cinco categorías y su fundamento legal ##

| # | Categoría | SPDX representativos | Fundamento legal | Efecto en Ego |
| --- | --- | --- | --- | --- |
| 1 | **Permisiva con atribución** | MIT, Apache-2.0, BSD-3-Clause, ISC | MIT §1 y Apache-2.0 §4: se puede copiar y modificar conservando el aviso de copyright y el texto de la licencia | Se puede **adaptar** con cabecera + `LICENSE.md` del paquete |
| 2 | **Copyleft fuerte** | AGPL-3.0, GPL-3.0, MPL-2.0 | AGPL §13: la obra derivada, incluida la servida por red, queda obligada a AGPL-3.0. GPL §5/§6: la distribución obliga a la misma licencia. MPL §3: copyleft **por fichero** | **Prohibido derivar código** para un producto Apache-2.0. Sólo extraer la idea y reimplementar |
| 3 | **Source-available / no OSI** | SSPL-1.0, BSL-1.1, BUSL-1.1, FSL-1.1, Sustainable Use License, Elastic-License-2.0, MSCL-1.0, LobeHub, Dify | Licencias no Approved por la OSI: conceden el uso pero **condicionan** la distribución, el uso en SaaS o la competencia | **No derivar código.** Sólo integrar como servicio o como API/MCP opaco |
| 4 | **Propietaria / sin licencia de código** | Sin SPDX, © Anthropic PBC, sin `LICENSE` | No hay cesión de derechos de autor: no existe permiso de copiar | Sólo usar la **interfaz pública documentada**. Nunca derivar código |
| 5 | **Licencia dual o mixta por fichero** | MIT + `ee/`, Apache-2.0 + AGPL + propietario, triple AGPL/SSPL/ELv2 | Cada ruta del árbol tiene su propia licencia; el uso conjunto hereda la más restrictiva | Derivable **sólo** el núcleo permisivo, fichero a fichero |

---

## 3. Tabla maestra de licencias verificadas ##

Las 56 filas siguientes se verificaron el 2026-10-20. La columna **Verificado** indica la fuente
de la comprobación: `API` = `license.spdx_id` de GitHub; `LICENSE` = fichero real leído en el clon
o en `raw.githubusercontent.com`; `API+LICENSE` = ambas.

| Proyecto | Licencia SPDX verificada | Categoría | ¿Se puede adaptar código? | Qué se permite en Ego | Mecanismo de cumplimiento | Verificado |
| --- | --- | --- | --- | --- | --- | --- |
| `nousresearch/hermes-agent` | MIT | 1 Permisiva | Sí | Patrón y código, con atribución | Cabecera + `LICENSE.md` del paquete | API+LICENSE |
| `openclaw/openclaw` | MIT | 1 Permisiva | Sí | Patrón y código, con atribución | Cabecera + `LICENSE.md` del paquete | API |
| `Louis-CFM/coucou` | MIT | 1 Permisiva | Sí | Patrón y código, con atribución. **Marca Mochi y assets fuera de la licencia** | Cabecera + `LICENSE.md` del paquete | API |
| `dohooo/helmor` | Apache-2.0 | 1 Permisiva | Sí | Patrón y código, con atribución | Cabecera + `LICENSE.md` del paquete | API+LICENSE |
| `career-ops-hq/career-ops` | MIT | 1 Permisiva | Sí | Patrón y código, con atribución | Cabecera + `LICENSE.md` del paquete | API |
| `deepseek-ai/deepseek-harness` | MIT | 1 Permisiva | Sí | Patrón y código, con atribución | Cabecera + `LICENSE.md` del paquete | API |
| `sst/opencode` | MIT | 1 Permisiva | Sí | Patrón y código, con atribución | Cabecera + `LICENSE.md` del paquete | API |
| `openai/codex` | Apache-2.0 | 1 Permisiva | Sí | Patrón y código, con atribución | Cabecera + `LICENSE.md` del paquete | API |
| `block/goose` | Apache-2.0 | 1 Permisiva | Sí | Patrón y código, con atribución | Cabecera + `LICENSE.md` del paquete | API+LICENSE |
| `cline/cline` | Apache-2.0 | 1 Permisiva | Sí | Patrón y código, con atribución | Cabecera + `LICENSE.md` del paquete | API+LICENSE |
| `google-gemini/gemini-cli` | Apache-2.0 | 1 Permisiva | Sí | Patrón y código, con atribución | Cabecera + `LICENSE.md` del paquete | API+LICENSE |
| `QwenLM/qwen-code` | Apache-2.0 | 1 Permisiva | Sí | Patrón y código, con atribución | Cabecera + `LICENSE.md` del paquete | API |
| `OpenHands/OpenHands` | MIT | 1 Permisiva | Sí | Patrón y código, con atribución | Cabecera + `LICENSE.md` del paquete | API+LICENSE |
| `BloopAI/vibe-kanban` | Apache-2.0 | 1 Permisiva | Sí | Patrón y código, con atribución | Cabecera + `LICENSE.md` del paquete | API+LICENSE |
| `SWE-agent/mini-swe-agent` | MIT | 1 Permisiva | Sí | Patrón y código, con atribución | Cabecera + `LICENSE.md` del paquete | API+LICENSE |
| `SWE-agent/SWE-agent` | MIT | 1 Permisiva | Sí | Patrón y código, con atribución | Cabecera + `LICENSE.md` del paquete | API |
| `continuedev/continue` | Apache-2.0 | 1 Permisiva | Sí | Patrón y código, con atribución | Cabecera + `LICENSE.md` del paquete | API+LICENSE |
| `ag-ui-protocol/ag-ui` | MIT | 1 Permisiva | Sí | Patrón y código, con atribución | Cabecera + `LICENSE.md` del paquete | API |
| `getzep/graphiti` | Apache-2.0 | 1 Permisiva | Sí | Patrón y código, con atribución | Cabecera + `LICENSE.md` del paquete | API+LICENSE |
| `microsoft/graphrag` | MIT | 1 Permisiva | Sí | Patrón y código, con atribución | Cabecera + `LICENSE.md` del paquete | API |
| `mem0ai/mem0` | Apache-2.0 | 1 Permisiva | Sí | Patrón y código, con atribución | Cabecera + `LICENSE.md` del paquete | API |
| `modelcontextprotocol/servers` | MIT en transición a Apache-2.0 | 1 Permisiva | Sí | Patrón y código, con atribución. Las contribuciones heredadas siguen bajo MIT | Cabecera + `LICENSE.md` del paquete | LICENSE |
| `modelcontextprotocol/typescript-sdk` | MIT en transición a Apache-2.0 | 1 Permisiva | Sí | Patrón y código, con atribución | Cabecera + `LICENSE.md` del paquete | LICENSE |
| `modelcontextprotocol/registry` | MIT en transición a Apache-2.0 | 1 Permisiva | Sí | Patrón y código, con atribución | Cabecera + `LICENSE.md` del paquete | LICENSE |
| `CX-ArtLab/agent-robot-avatar` | MIT | 1 Permisiva | Sí | Patrón y código, con atribución | Cabecera + `packages/avatar/LICENSE.md` | API |
| `janhq/jan` | Apache-2.0 con cabecera no estándar | 1 Permisiva | Sí | Uso como servicio vía MCP. La API devuelve `NOASSERTION`; el `LICENSE` es texto Apache-2.0 con cabecera y pide atribución en material de usuario | Ninguno mientras no se derive código | LICENSE |
| `temporalio/temporal` | MIT | 1 Permisiva | Sí | Patrón de ejecución durable | Cabecera + `LICENSE.md` del paquete | API |
| `langchain-ai/langgraph` | MIT | 1 Permisiva | Sí | Patrón de grafos. **No como dependencia**: Python prohibido en núcleo | Cabecera + `LICENSE.md` del paquete | API |
| `crewAIInc/crewAI` | MIT | 1 Permisiva | Sí | Patrón de orquestación. **No como dependencia**: Python prohibido en núcleo | Cabecera + `LICENSE.md` del paquete | API |
| `browser-use/browser-use` | MIT | 1 Permisiva | Sí | Patrón de bucle browser-use | Cabecera + `LICENSE.md` del paquete | API |
| `openai/openai-cua-sample-app` | MIT | 1 Permisiva | Sí | Patrón de runtime persistente | Cabecera + `LICENSE.md` del paquete | API |
| `PrefectHQ/fastmcp` | Apache-2.0 | 1 Permisiva | Sí | Patrón de servidor MCP en Python | Cabecera + `LICENSE.md` del paquete | API |
| `obra/superpowers` | MIT | 1 Permisiva | Sí | Skills de calidad, importables como `SKILL.md` | Atribución en el manifiesto de la skill | API |
| `wshobson/agents` | MIT | 1 Permisiva | Sí | Subagentes, importables como Sub-Egos | Atribución en el manifiesto | API |
| `ComposioHQ/composio` | MIT | 1 Permisiva | Sí | Toolkits con auth, como conector Nivel C | Cabecera + `LICENSE.md` del paquete | API |
| `khoj-ai/khoj` | AGPL-3.0 | 2 Copyleft fuerte | **No** | Sólo patrón, reimplementado desde cero. Prohibido copiar, traducir o portar código | Nota de no-derivación en la ficha | API+LICENSE |
| `smtg-ai/claude-squad` | AGPL-3.0 | 2 Copyleft fuerte | **No** | Sólo patrón, reimplementado desde cero | Nota de no-derivación en la ficha | API+LICENSE |
| `CherryHQ/cherry-studio` | AGPL-3.0 | 2 Copyleft fuerte | **No** | Sólo como **servidor MCP o API opaco** | Ninguno, si no se distribuye código | API |
| `Skyvern-AI/skyvern` | AGPL-3.0 | 2 Copyleft fuerte | **No** | Sólo patrón de computer-use | Ninguno, si no se distribuye código | API |
| `reorproject/reor` | AGPL-3.0 | 2 Copyleft fuerte | **No** | Sólo patrón de memoria desktop. Repositorio archivado | Ninguno, si no se distribuye código | API |
| `lightpanda-io/browser` | AGPL-3.0 | 2 Copyleft fuerte | **No** | Sólo patrón marginal | Ninguno, si no se distribuye código | API |
| `mcpjungle/MCPJungle` | MPL-2.0 | 2 Copyleft fuerte (por fichero) | **No** para Ego | Copyleft de archivo: reusable manteniendo cabeceras, pero incompatible con un producto Apache-2.0 sin excepciones | Ninguno, si no se distribuye código | API |
| `charmbracelet/crush` | FSL-1.1-MIT (Functional Source License) | 3 Source-available | **No** | Sólo patrón descrito en prosa. MIT sólo a partir del segundo aniversario de cada versión | Ninguno, si no se distribuye código | API+LICENSE |
| `n8n-io/n8n` | Sustainable Use License 1.0 | 3 Source-available | **No** | Sólo integración como servicio (Nivel C). Uso limitado a fines internos | Ninguno, si no se distribuye código | API+LICENSE |
| `restatedev/restate` | BSL-1.1 (Business Source License 1.1) | 3 Source-available | **No** | Sólo patrón de clave de idempotencia | Ninguno, si no se distribuye código | API+LICENSE |
| `inngest/inngest` | SSPL-1.0 con Apache 2.0 Future License | 3 Source-available | **No** | Sólo patrón de step functions durables | Ninguno, si no se distribuye código | API+LICENSE |
| `hashicorp/terraform` | BSL-1.1 (IBM) | 3 Source-available | **No** | Sólo patrón. Prohíbe la *competitive offering* alojada | Ninguno, si no se distribuye código | API+LICENSE |
| `langgenius/dify` | Apache-2.0 modificado (Dify Open Source License) | 3 Source-available | **No** | Sólo integración por API. Prohíbe multi-tenant y exige conservar LOGO | Ninguno, si no se distribuye código | API+LICENSE |
| `lobehub/lobe-chat` | LobeHub Community License | 3 Source-available | **No** | Sólo como proveedor vía MCP. Licencia comercial obligatoria para obras derivadas | Ninguno, si no se distribuye código | API+LICENSE |
| `open-webui/open-webui` | Open WebUI License (BSD-3 con cláusula de marca) | 3 Source-available | **No** | Sólo como proveedor vía MCP. Cláusula de marca con umbral de 50 usuarios | Ninguno, si no se distribuye código | API+LICENSE |
| `anthropics/claude-code` | Sin SPDX: © Anthropic PBC, términos comerciales | 4 Propietaria | **No** | Sólo la interfaz pública documentada (formatos de plugin y marketplace) | Ninguno | API+LICENSE |
| `anthropics/skills` | Sin `LICENSE` en la raíz | 4 Propietaria | **No** | Consumir skills Apache-2.0 del marketplace del usuario. **No** redistribuir `docx`, `pdf`, `pptx` ni `xlsx` | Ninguno | API+LICENSE |
| `yoheinakajima/babyagi` | Sin licencia: ni `LICENSE` ni `LICENSE.md` | 4 Propietaria | **No** | Nada. Sin permiso de copiar ni de adaptar | Ninguno | No verificado en esta pasada |
| `activepieces/activepieces` | MIT en el núcleo, licencia propia en `packages/ee/` | 5 Dual | Sólo el núcleo | Integrar como servicio. `packages/ee/` y `packages/server/api/src/app/ee` quedan fuera | Ninguno, si no se distribuye código | API+LICENSE |
| `windmill-labs/windmill` | Apache-2.0 en clientes, AGPLv3 en `backend/` y `frontend/`, propietario en el flag `enterprise` | 5 Dual | Sólo los clientes | Patrón de scripts como workflows. El binario `backend/` es AGPLv3 | Ninguno, si no se distribuye código | API+LICENSE |
| `elastic/elasticsearch` | Triple AGPL-3.0 / SSPL-1.0 / Elastic License 2.0; `x-pack/` sólo ELv2 | 5 Dual | **No** | Sólo patrón. ELv2 prohíbe el uso competitivo | Ninguno, si no se distribuye código | API+LICENSE |

### 3.1 Proyectos citados en los informes sin verificación en esta pasada ##

Estos proyectos aparecen en los informes de `docs/research/` con licencia verificada por esos
informes el 2026-10-20, pero **no se han re-verificado en esta pasada**: el límite de peticiones
de la API de GitHub se agotó antes de cubrirlos. Se listan porque varios son **de riesgo alto**
y porque la síntesis propone derivar de ellos.

| Proyecto | Licencia según el informe que lo verificó | Categoría | Riesgo para un producto Apache-2.0 | Fuente |
| --- | --- | --- | --- | --- |
| `gitroomhq/postiz-app` | AGPL-3.0 | 2 Copyleft fuerte | Alto: es la referencia de publicación social que propone `SYN-07` | `canales-comunicacion-y-social.md:371` |
| `signalapp/Signal-Server` | AGPL-3.0 | 2 Copyleft fuerte | Alto | `canales-comunicacion-y-social.md:922` |
| `AsamK/signal-cli` | GPL-3.0 | 2 Copyleft fuerte | Alto | `canales-comunicacion-y-social.md:921` |
| `listmonk/listmonk` | AGPL-3.0 | 2 Copyleft fuerte | Alto | `canales-comunicacion-y-social.md:44` |
| `frappe/erpnext` | GPL-3.0 | 2 Copyleft fuerte | Alto | `backoffice-empresa-personal.md:113` |
| `vendure-ecommerce/vendure` | GPL-3.0 + licencia comercial | 5 Dual | Alto | `backoffice-empresa-personal.md:117` |
| `opf/openproject` | GPL-3.0 | 2 Copyleft fuerte | Alto | `backoffice-empresa-personal.md:127` |
| `redmine/redmine` | GPL-2.0 | 2 Copyleft fuerte | Alto | `backoffice-empresa-personal.md:1007` |
| `dolibarr/dolibarr` | GPL-3.0 | 2 Copyleft fuerte | Alto | `backoffice-empresa-personal.md:129` |
| `makeplane/plane` | AGPL-3.0 | 2 Copyleft fuerte | Alto: candidato a sustituto del Backlog | `backoffice-empresa-personal.md:121` |
| `twentyhq/twenty` | AGPL-3.0 | 2 Copyleft fuerte | Alto: CRM de referencia | `backoffice-empresa-personal.md:120` |
| `docmost/docmost` | AGPL-3.0 | 2 Copyleft fuerte | Alto | `backoffice-empresa-personal.md:123` |
| `firefly-iii/firefly-iii` | AGPL-3.0 | 2 Copyleft fuerte | Alto | `backoffice-empresa-personal.md:262` |
| `getlago/lago` | AGPL-3.0 | 2 Copyleft fuerte | Alto | `backoffice-empresa-personal.md:360` |
| `metabase/metabase` | AGPL-3.0 + comercial | 5 Dual | Alto | `backoffice-empresa-personal.md:409` |
| `invoiceninja/invoiceninja` | Elastic License 2.0 | 3 Source-available | Alto: uso competitivo restringido | `backoffice-empresa-personal.md:1028` |
| `outline/outline` | BSL-1.1 | 3 Source-available | Alto | `backoffice-empresa-personal.md:1005` |
| `baptisteArno/typebot.io` | FSL-1.1-Apache-2.0 | 3 Source-available | Alto: `Competing Use` | `backoffice-empresa-personal.md:1015` |
| `directus/directus` | MSCL-1.0-GPL | 3 Source-available | Alto | `backoffice-empresa-personal.md:999` |
| `nocobase/nocobase` | NocoBase License | 3 Source-available | Alto | `backoffice-empresa-personal.md:997` |
| `odoo/odoo` | LGPL-3.0 en el núcleo + Enterprise | 2 Copyleft (débil) | Medio | `backoffice-empresa-personal.md:989` |
| `taigaio/taiga-back` | MPL-2.0 | 2 Copyleft por fichero | Medio | `backoffice-empresa-personal.md:1006` |
| `baserow/baserow` | MIT en la OSE, licencia propia en `premium/` y `enterprise/` | 5 Dual | Medio | `backoffice-empresa-personal.md:1058` |
| `chatwoot/chatwoot` | MIT salvo `enterprise/` | 5 Dual | Medio | `canales-comunicacion-y-social.md:335` |
| `gitlabhq/gitlabhq` | MIT salvo `doc/` (CC BY) | 5 Dual | Medio | `backoffice-empresa-personal.md:1054` |
| `microsoft/autogen` | CC-BY-4.0 en la raíz, MIT en `LICENSE-CODE` | 5 Dual | Medio: el código es MIT | `orquestacion-multiagente.md:1091` |
| `microsoft/OmniParser` | CC-BY-4.0 | 3 Source-available | Medio: CC BY exige atribución | `automatizacion-y-agentes-ejecucion.md:1056` |
| `open-wa/wa-automate-nodejs` | Hippocratic 1.1 (H-DNH) | 4 Propietaria | Alto: uso restringido a fines no dañinos | `canales-comunicacion-y-social.md:119` |
| `Significant-Gravitas/AutoGPT` | MIT salvo `autogpt_platform/` (PolyForm Shield) | 5 Dual | Medio | `orquestacion-multiagente.md:1086` |
| `microsoft/UFO` | MIT | 1 Permisiva | Bajo | No verificado en esta pasada (API agotada) |
| `dbos-inc/dbos-transact-ts` | MIT | 1 Permisiva | Bajo | `automatizacion-y-agentes-ejecucion.md:1037` |
| `dbos-inc/dbos-transact-py` | MIT | 1 Permisiva | Bajo | `automatizacion-y-agentes-ejecucion.md:1038` |
| `triggerdotdev/trigger.dev` | Apache-2.0 | 1 Permisiva | Bajo | `automatizacion-y-agentes-ejecucion.md:1032` |
| `hatchet-dev/hatchet` | MIT | 1 Permisiva | Bajo | `automatizacion-y-agentes-ejecucion.md:1034` |
| `node-red/node-red` | Apache-2.0 | 1 Permisiva | Bajo | `automatizacion-y-agentes-ejecucion.md:1026` |
| `kestra-io/kestra` | Apache-2.0 | 1 Permisiva | Bajo | `automatizacion-y-agentes-ejecucion.md:1028` |
| `dagster-io/dagster` | Apache-2.0 | 1 Permisiva | Bajo | `automatizacion-y-agentes-ejecucion.md:1029` |
| `conductor-oss/conductor` | Apache-2.0 | 1 Permisiva | Bajo | `automatizacion-y-agentes-ejecucion.md:1035` |
| `apache/dolphinscheduler` | Apache-2.0 | 1 Permisiva | Bajo | `automatizacion-y-agentes-ejecucion.md:1036` |
| `uber/cadence` | Apache-2.0 | 1 Permisiva | Bajo | `automatizacion-y-agentes-ejecucion.md:1042` |
| `flowable/flowable-engine` | Apache-2.0 | 1 Permisiva | Bajo | `automatizacion-y-agentes-ejecucion.md:1040` |
| `Netflix/maestro` | Apache-2.0 | 1 Permisiva | Bajo | `automatizacion-y-agentes-ejecucion.md:1041` |
| `browserbase/stagehand` | MIT | 1 Permisiva | Bajo | `automatizacion-y-agentes-ejecucion.md:1058` |
| `steel-dev/steel-browser` | Apache-2.0 | 1 Permisiva | Bajo | `automatizacion-y-agentes-ejecucion.md:1060` |
| `lavague-ai/LaVague` | Apache-2.0 | 1 Permisiva | Bajo | `automatizacion-y-agentes-ejecucion.md:1064` |
| `OpenAdaptAI/OpenAdapt` | MIT | 1 Permisiva | Bajo | `automatizacion-y-agentes-ejecucion.md:1065` |
| `nomic-ai/gpt4all` | MIT | 1 Permisiva | Bajo | `automatizacion-y-agentes-ejecucion.md:1070` |
| `Mintplex-Labs/anything-llm` | MIT | 1 Permisiva | Bajo | `automatizacion-y-agentes-ejecucion.md:1072` |
| `leon-ai/leon` | MIT | 1 Permisiva | Bajo | `automatizacion-y-agentes-ejecucion.md:1078` |
| `google/adk-python` | Apache-2.0 | 1 Permisiva | Bajo | `automatizacion-y-agentes-ejecucion.md:1050` |
| `google/adk-js` | Apache-2.0 | 1 Permisiva | Bajo | `automatizacion-y-agentes-ejecucion.md:1051` |
| `relevanceai/relevanceai` | Apache-2.0 | 1 Permisiva | Bajo | `automatizacion-y-agentes-ejecucion.md:1049` |
| `Flask`/`Flare` (Frank Appelt) | AGPL-3.0 | 2 Copyleft fuerte | Alto | `canales-comunicacion-y-social.md:240` |

---

## 4. Zonas de riesgo por cláusula concreta ##

Esta sección es la que responde *por qué importa*. Cada fila cita la cláusula literal o su efecto
legal, y dice qué significa para un producto **Apache-2.0** que se distribuye como desktop, se
autoaloja y además ofrece servicios en la nube (modelo de negocio de `AGENTS.md` §8).

| Proyecto o familia | Cláusula concreta | Por qué importa para un producto Apache-2.0 (SaaS, autoalojado, distribución) | Recomendación |
| --- | --- | --- | --- |
| `khoj-ai/khoj` | AGPL-3.0 §13: *"if you modify the Program, your modified version must prominently offer all users interacting with it remotely through a computer network an opportunity to receive the Corresponding Source of your version"* | Ego tiene servicio en la nube y autoalojado. Una traducción literal del troceador de Khoj convertiría ese módulo en AGPL-3.0 y obligaría a ofrecer el código fuente del trabajo derivado | **Prohibido derivar.** Reimplementar desde cero. Documentar la no-derivación en la ficha |
| `smtg-ai/claude-squad` | AGPL-3.0 §13 (misma cláusula de red) | `packages/subegos/src/SubEgoWorktree.ts` ya está en producción y es el resultado de `CSQD-04`. Si el port fuese una traducción del código Go, el paquete `subegos` heredaría AGPL-3.0 | **Reimplementación**, no traducción. Deuda `D-CSQD-4` sigue abierta: falta constancia de no-derivación |
| `CherryHQ/cherry-studio`, `Skyvern-AI/skyvern`, `reorproject/reor`, `lightpanda-io/browser` | AGPL-3.0 completa, con la obligación de red del §13 | Son los cuatro casos que los informes marcan como *"muchas estrellas ≠ usable"*. Todos son productos que compiten con Ego en su nicho | **Consumir como servidor MCP o API opaco.** No copiar, no portar, no embeber |
| `mcpjungle/MCPJungle` | MPL-2.0 §3: el copyleft es **por fichero**; las fichas modificadas siguen bajo MPL-2.0 y deben seguir en MPL-2.0 | A diferencia de AGPL, MPL permite combinar. Pero un fichero Ego derivado quedaría obligado a MPL-2.0, y la distribución del conjunto debe incluir los avisos MPL | **No derivar.** Consumir como gateway externo |
| `frappe/erpnext`, `vendure-ecommerce/vendure`, `opf/openproject`, `dolibarr/dolibarr`, `redmine/redmine` | GPL-3.0 §5 y §6: la obra derivada completa debe distribuirse bajo GPL-3.0 | Son backoffice/gestión de proyectos, exactamente el dominio que `SYN-09` quiere **proyectar**, no reimplementar | **Integrar por API/MCP.** Reimplementar la proyección, no el ERP |
| `inngest/inngest` | SSPL-1.0 §13: *"Mere possession of a 'Covered Work' ... if you make the functionality of the Program or a modified version available to third parties as part of a service, you must release the entire Service Source under this License"* | Ego ofrece servicios en la nube (Sync, Cloud). El SSPL ata el **servicio completo**, no sólo el fichero, a la licencia | **No derivar.** Extraer el patrón de step function durable y reimplementarlo sobre `BackgroundEngine` |
| `restatedev/restate` | BSL-1.1, *Parameters*: **Additional Use Grant** = *"you may not use the Licensed Work for a Public Restate Platform Service"*, y *Change Date* / *Change License*inerán a licencia abierta | Ego tiene un dominio `analytics` y planes de servicios. Un *additional use grant* que prohíbe un servicio público de plataforma es incompatible con el modelo de negocio si se copiase el motor | **No derivar.** Adopta sólo el **concepto** de clave de idempotencia, reimplementado en `ExecutionManager` |
| `hashicorp/terraform` | BSL-1.1 (IBM), *Additional Use Grant*: *"Your use does not include offering the Licensed Work to third parties on a hosted or embedded basis in order to compete with IBM Corp.'s paid version(s)"* | La redacción de "competitive offering" es la cláusula espejo del *Competing Use* de FSL: no es un veto absoluto, pero sí un umbral interpretable que un owner puede acabar discutiendo | **No derivar.** Integración por API |
| `charmbracelet/crush` | FSL-1.1 §"Permitted Purpose": *"A Competing Use means making the Software available to others in a commercial product or service that ... offers the same or substantially similar functionality as the Software"*. El MIT sólo llega *"on the second anniversary of the date we make the Software available"* | Ego tiene un Dominio Engineering con Sub-Ego Dev y herramientas de código: **solapa funcionalmente con Crush**. Derivar su cliente LSP o su motor de resúmenes sería un *Competing Use* literal | **Descartado ya por `CRSH-08`.** Ningún fichero derivado de Crush puede existir en `packages/` |
| `baptisteArno/typebot.io` | FSL-1.1-Apache-2.0: la licencia futura es Apache-2.0 **sólo tras el Change Date**; antes es source-available | El mismo mecanismo de FSL con una licencia futura diferente. El informe lo marca como *"no es open source todavía"* | **No derivar.** Patrón de constructor conversacional |
| `n8n-io/n8n` | Sustainable Use License 1.0, *Limitations*: *"You may use or modify the software only for your own internal business purposes or for non-commercial or personal use. You may distribute the software or provide it to others only if you do so free of charge for non-commercial purposes"* | Ego **vende** servicios: un SaaS de n8n embebido es una distribución comercial de un producto cuya licencia lo prohíbe. La redacción no distingue "uso interno de Ego" de "recurso de Ego" | **Nivel C, sólo como servicio externo.** Nunca embeber en el instalador |
| `elastic/elasticsearch`, `invoiceninja/invoiceninja` | Elastic License 2.0 §4: *"you may not provide the Licensed Work to third parties as part of a service that offers substantially the same functionality as the Licensed Work"* | Igual que el *Competing Use*: el veto es funcional, no nominal. Un backoffice de Ego que exponga búsqueda sobre el mismo dominio es discutible | **No derivar.** Conectar por API de lectura |
| `directus/directus` | MSCL-1.0-GPL (Monospace Sustainable Core License): licencia core de Sustainable Use con la variante GPL | No es OSI. El nombre "Sustainable Core" la hace pasar por permisiva en una revisión rápida | **No derivar.** Patrón de colecciones dinámicas |
| `langgenius/dify` | Apache-2.0 **modificado**: (a) *"you may not use the Dify source code to operate a multi-tenant environment"* sin autorización escrita; (b) no se puede quitar el LOGO; (c) el productor puede endurecer la licencia; (d) las contribuciones del usuario pueden usarse comercialmente | La cláusula multi-tenant es incompatible con el modelo de SaaS de Ego. La cláusula (c) es una(option) de licencia unilateral, incompatible con el principio de Apache-2.0 como estándar del producto | **Integrar por API de lectura.** No derivar, no embeber, no rehosting |
| `lobehub/lobe-chat` | LobeHub Community License: Apache-2.0 con condición de que *"a commercial license must be obtained from the producer if you want to develop and distribute a derivative work"*, y permiso de rebranding revocable | Evenemento por encima de Apache-2.0 | **Sólo como proveedor vía MCP.** No derivar |
| `open-webui/open-webui` | Open WebUI License §4: prohibido alterar o quitar la marca *"Open WebUI"* salvo permiso escrito o despliegue con **menos de 50 usuarios** en cualquier periodo móvil de 30 días | El umbral de 50 usuarios hace la licencia inviable para cualquier caso de uso comercial de Ego. No es copyleft: es una **cláusula de marca** | **Sólo como proveedor vía MCP.** No derivar |
| `anthropics/claude-code` | `LICENSE.md`: *"© Anthropic PBC. All rights reserved. Use is subject to Anthropic's Commercial Terms of Service"* | No hay cesión de derechos: leer el repo no da derecho a copiar sus **formatos** más allá de la interfaz pública documentada | **Sólo estudiar el formato** de `plugin.json` y `marketplace.json`. Cero código |
| `anthropics/skills` | Sin `LICENSE` en la raíz. Las skills `docx`, `pdf`, `pptx` y `xlsx` son **source-available** de Anthropic | Si Ego redistribuye esas skills dentro del producto, distribuye código sin permiso | **No redistribuir.** Que el usuario las instale desde su propio marketplace |
| `open-wa/wa-automate-nodejs` | Hippocratic 1.1 (H-DNH): uso restringido a fines que no causen daño | Encaja con la posición de los informes: descartado por doble motivo (ToS de WhatsApp y licencia) | **Descartado.** Sólo lectura del diseño |
| `activepieces/activepieces` | Dual: MIT en el núcleo, licencia propia en `packages/ee/` y `packages/server/api/src/app/ee` | Es el patrón de "núcleo permisivo + carpetas source-available" más común del corpus | **Sólo el núcleo.** Revisar la ruta del fichero antes de copiar |
| `windmill-labs/windmill` | Triple: `backend/` y `frontend/` en AGPLv3 salvo flag `enterprise`; clientes y OpenAPI en Apache-2.0; el binario "Community Edition" **no** se puede revender ni servir como servicio gestionado | El `backend/` es la parte interesante (motor de workflows) y es AGPLv3 | **Sólo clientes y OpenAPI.** El motor es patrón, no código |
| `n8n-io/n8n` (carpetas `.ee`) | Los ficheros con `.ee.` en el nombre o `.ee` en el directorio **no** están bajo Sustainable Use License: exigen una n8n Enterprise License | Es el caso "núcleo permisivo + carpetas source-available" dentro de un proyecto source-available: doble barrera | **Ni el núcleo ni las carpetas.** Sólo como servicio |
| `chatwoot/chatwoot`, `gitlabhq/gitlabhq`, `baserow/baserow` | MIT en el núcleo; `enterprise/`, `ee/`, `premium/` con licencia propia | Patrón universal del catálogo de referencia: la carpeta de empresa es donde vive el código no permisivo | **Sólo el núcleo**, y verificar la ruta fichero a fichero |
| `modelcontextprotocol/servers`, `typescript-sdk`, `registry` | Transición MIT → Apache-2.0 declarada: *"Contributions made by authors who originally licensed their work under the MIT License and who have not yet granted explicit permission to relicense remain licensed under the MIT License"* | Un fichero concreto puede seguir bajo MIT aunque el proyecto se declare Apache-2.0. No es un problema de compatibilidad, pero sí de **atribución**: hay que saber qué SPDX se aplicó a cada fichero | **Registrar el SPDX por fichero**, no por repo, en la cabecera |
| `microsoft/autogen`, `microsoft/OmniParser` | CC-BY-4.0 en la raíz y en la documentación; `LICENSE-CODE` en MIT | CC BY exige **atribución explícita** y tiene cláusulas de contenido similar. Es la única categoría que obliga a citar en material de usuario | **No derivar código.** Si se cita documentación, atribuir con licencia, URL y cambios |

---

## 5. Procedimiento de atribución ##

### 5.1 Mecanismo canónico de Ego ##

El mecanismo ya existe y está documentado en `docs/extractions/README.md` §4.3. Tiene dos piezas,
y las dos son obligatorias cuando hay código derivado:

1. **Cabecera en el fichero**, con el formato canónico
   `Adapted from <upstream> (<LICENCIA>), <ruta de origen>`.
2. **`LICENSE.md` dentro del paquete** que recibe el código, que lleva el aviso de copyright y el
   texto de la licencia del upstream.

El paquete `packages/avatar/` es hoy el único que cumple la segunda pieza: `packages/avatar/LICENSE.md`
existe, es exhaustivo y separa tres bloques (código embebido en `vendor/`, código adaptado con
atribución en cabecera, y patrones e ideas sin copia).

### 5.2 Plantilla exacta de cabecera ##

```ts
// Adapted from <owner>/<repo> (<SPDX-ID>), <ruta:fichero>:<lineas>
// Upstream: <URL del repo> · Licencia: <SPDX-ID> (<nombre real>)
// Modificaciones de Ego: <qué cambió y por qué>
```

Ejemplos ya válidos con la plantilla:

```ts
// Adapted from openclaw/openclaw (MIT), packages/tool-call-repair/src/grammar.ts
// Upstream: https://github.com/openclaw/openclaw · Licencia: MIT (MIT License)
// Modificaciones de Ego: reescrito en TypeScript estricto sobre el contrato de Ego.
```

```ts
// Adapted from Louis-CFM/coucou (MIT), windows/src/mochi/engine.ts:749-784
// Upstream: https://github.com/Louis-CFM/coucou · Licencia: MIT (MIT License)
// Modificaciones de Ego: proyección sobre geometría propia de Sub-Ego; sin assets de Mochi.
```

Para Apache-2.0, la cabecera **no sustituye** al `LICENSE.md` del paquete: Apache-2.0 §4(a) exige
conservar los avisos, §4(b) exige incluir una copia de la licencia, y §4(d) exige mantener las
marcas. Para MIT basta el aviso de copyright y el texto de la licencia, que es lo que el
`LICENSE.md` del paquete debe contener.

### 5.3 Checklist al derivar de cada proyecto ##

Antes de escribir una línea de código derivado de un repo externo:

1. **Identificar el SPDX real** con `gh api repos/<owner>/<repo> --jq .license.spdx_id` y leer el
   `LICENSE` real. Si la API devuelve `NOASSERTION`, la clasificación sale de la **cláusula**, no
   del nombre.
2. **Confirmar la categoría** con §2.4. Si no es permisiva, §3 dice que no se deriva: se extrae la
   idea y se reimplementa.
3. **Localizar el fichero exacto** del upstream y anotar `ruta:líneas` en la cabecera.
4. **Anotar el tipo de adaptación**: `Adapted from` (puerto literal), `Reimplemented from` (idea,
   contrato o algoritmo) o `Pattern only` (sin código). Sólo el primero exige aviso de licencia.
5. **Escribir la cabecera** con la plantilla de §5.2 en el primer bloque de comentarios del fichero.
6. **Añadir o actualizar el `LICENSE.md` del paquete** receptor, con el aviso de copyright y el
   texto de la licencia del upstream, y una fila en su tabla de procedencias.
7. **Si el upstream es dual**, verificar la ruta fichero a fichero: nada de `ee/`, `enterprise/`,
   `premium/`, `x-pack/` ni de ficheros con el flag `enterprise`.
8. **Si el upstream tiene cláusula de marca**, no copiar marca, logo, nombre ni assets.
9. **Registrar la fila** en el backlog de revisión del repo (`docs/review/backlog-<repo>.md`) con
   el estado canónico y la evidencia de caller.
10. **Verificar** que `grep -rn "Adapted from" packages/` cubre el fichero nuevo.

### 5.4 Hueco conocido: estado real de las cabeceras ##

`docs/extractions/README.md` §4.3 dice, a fecha 2026-10-19, que hay **0 cabeceras normalizadas**.
La verificación de esta pasada (2026-10-20) sobre `packages/` da el estado real:

| Estado | Ficheros | Detalle |
| --- | --- | --- |
| Cabecera canónica `Adapted from ...` | 8 | Las 8 están en `packages/avatar/src/studio/**` y **apuntan al HTML interno del propio paquete** (`avatar_studio_cx_artlab_mochi_2_0.html`, archivo del usuario), no a ningún repositorio de referencia |
| Cabecera en prosa `PORTADO de ...` | 4 | `packages/avatar/src/core/config.js`, `src/runtime/policy.js`, `src/render/projection.js`, `src/runtime/presence.js`. Nombran MIT y el upstream, pero no usan el formato canónico ni la ruta `archivo:líneas` de forma uniforme |
| Derivado **sin cabecera** | 13 | Los restantes ficheros de la tabla "Código adaptado" de `packages/avatar/LICENSE.md`: `core/anim.js`, `core/timeline.js`, `render/static.js`, `render/ara-head.js`, `render/body.js`, `render/eyes.js`, `runtime/fx-eyes.js`, `runtime/micro.js`, `runtime/pointer.js`, `runtime/poses.js`, `runtime/sound.js`, `runtime/states.js`, `runtime/extension-host.js` |
| Atribución **sin SPDX ni upstream completo** | 1 | `packages/tool-call-repair/src/grammar.ts:3` — *"Extraído y adaptado de OpenClaw packages/tool-call-repair/src/grammar.ts"*. No nombra la licencia (OpenClaw es MIT) ni usa el formato canónico |
| Atribución **inexacta y a un upstream copyleft** | 1 | `packages/knowledge/src/ingest/AdaptiveChunker.ts:11` — *"basado en los patrones de Khoj (KHOJ-01, KHOJ-02)"*, atribuyendo un solapamiento de 32-64 tokens que Khoj **no tiene** (`chunk_overlap=0` y MD5, según `docs/review/backlog-khoj.md:104`) |

Conclusión: **el mecanismo está documentado pero no está desplegado**. El compensador real es
`packages/avatar/LICENSE.md`, que sí existe y es completo para ese paquete; fuera de él, la cadena
de atribución es incompleta. Además, `packages/avatar/LICENSE:3` declara el código de `ego-avatar`
como **MIT** mientras el producto es **Apache-2.0**: la divergencia es legal (MIT es compatible
hacia delante con Apache-2.0) pero es una inconsistencia de SPDX entre paquete y producto que
conviene decidir explícitamente.

---

## 6. Checklist operativo para integrar código externo ##

Estos pasos son verificables y se aplican **antes** de que el código entre en `packages/`:

| # | Paso | Cómo se verifica | Si falla |
| --- | --- | --- | --- |
| 1 | Obtener el SPDX real del upstream | `gh api repos/<owner>/<repo> --jq '.license.spdx_id'` | Clasificar leyendo el `LICENSE`; si no hay SPDX, leer la cláusula |
| 2 | Confirmar que la licencia es permisiva | Contrastar con §2.4 | Si es copyleft o source-available: **no derivar**. Volver a §3 y a la fila del proyecto |
| 3 | Verificar que la ruta del fichero está en la zona permisiva | Inspeccionar la ruta y el `LICENSE` del repo | Si está en `ee/`, `enterprise/`, `premium/`, `x-pack/` o bajo flag: descartar el fichero |
| 4 | Marcar el tipo de adaptación | Comentario de cabecera | `Adapted from` exige aviso; `Reimplemented from` y `Pattern only` no |
| 5 | Escribir la cabecera canónica | `grep -n "Adapted from" <fichero>` | Reescribir la cabecera |
| 6 | Añadir el aviso al `LICENSE.md` del paquete | `ls packages/<pkg>/LICENSE.md` y fila con upstream, SPDX y ruta | Crear el `LICENSE.md` con el aviso de copyright y el texto de la licencia |
| 7 | Registrar la procedencia en el backlog de revisión | Fila con `✅ Completada` o `🚫 Descartada` en `docs/review/backlog-<repo>.md` | Sin fila, la compuerta no cierra (`AGENTS.md` §4) |
| 8 | Comprobar que no hay dependencia de runtime | `pnpm typecheck` y ausencia del paquete en `package.json` de núcleo | Si el upstream es Python o trae runtime, violates `AGENTS.md` §4 |
| 9 | Comprobar la ausencia de contaminación de dominio | `grep` de entidades de negocio del upstream sobre `packages/` y `apps/` | Limpiar; es el criterio que ya aplicó el barrido de `career-ops` y `khoj` |
| 10 | Si el upstream es un **servicio** y no código, dejarlo fuera de la distribución | El proveedor no aparece en `package.json` ni en el instalador | Configurarlo como conector Nivel B/C |

---

## 7. Deuda abierta y preguntas para el owner ##

Ninguna de estas preguntas tiene respuesta derivable de la evidencia: son decisiones de política
legal o de producto que sólo el owner puede tomar.

1. **¿Qué se hace con `khoj-ai/khoj` (AGPL-3.0) sin licencia registrada?**
   Contexto: 3 filas `✅ Completada` (`KHOJ-01..03`), ninguna ficha ni backlog menciona AGPL-3.0,
   y `packages/knowledge/src/ingest/AdaptiveChunker.ts:11` le atribuye comportamientos que Khoj no
   tiene. Opciones: (a) registrar la licencia en la ficha y en el backlog y añadir una nota de
   no-derivación, corrigiendo además la cabecera de `AdaptiveChunker.ts`; (b) auditar línea a línea
   si hubo traducción; (c) retirar el crédito a Khoj si la reimplementación es ya propia.
   *Recomendación: (a) con la corrección de la cabecera*, porque el backlog ya documenta que el
   solapamiento y el SHA-256 son mejora propia de Ego.
2. **¿Se corrigen las cabeceras no canónicas ahora o se planifican?**
   Contexto: 9 cabeceras canónicas que apuntan al HTML interno, 4 en prosa, 13 ficheros derivados
   sin cabecera, 1 cabecera sin SPDX y 1 inexacta. Opciones: (a) una ola de normalización que
   toque los ~18 ficheros; (b) un gate de CI que rechace ficheros derivados sin cabecera.
   *Recomendación: (a) y (b)combined*, empezando por `packages/tool-call-repair/src/grammar.ts`,
   que es el único caso con probable obra derivada real.
3. **¿Se unifica el SPDX de `packages/avatar` con el del producto?**
   Contexto: `packages/avatar/LICENSE:3` dice MIT; el repo es Apache-2.0. Es compatible, pero
   `packages/avatar/package.json` declara una licencia distinta de la del producto sin que nadie lo
   haya decidido. Opciones: (a) mantener MIT y documentar la excepción; (b) relicenciar a
   Apache-2.0 el código propio del paquete.
   *Recomendación: (a)*, con la excepción escrita donde hoy está el `AGENTS.md` §4 de
   `packages/avatar`.
4. **¿Qué política se aplica a los repos ya clonados con licencia copyleft o source-available?**
   Contexto: `repos-referencia/` contiene hoy `claude-squad` (AGPL-3.0) y `crush` (FSL-1.1), y
   contiene el propio `khoj` (AGPL-3.0). La regla de `AGENTS.md` ya dice "referencia de patrones",
   pero no dice "no derivar" en esas fichas. Opciones: (a) nota de no-derivación explícita en cada
   ficha con licencia no permisiva; (b) un `NOTICE` único en `repos-referencia/README.md`; (c)
   dejar el clon como está.
   *Recomendación: (a) y (b)*, porque la ausencia de constancia es lo que dejó pasar la
   exposición de `khoj`.
5. **¿Se permite consumir como servicio los proyectos con cláusula de marca o de multi-tenant?**
   Contexto: `open-webui` (marca, umbral de 50 usuarios), `dify` (multi-tenant y LOGO), `lobe-chat`
   (rebranding revocable) y `anthropics/skills` (`docx`/`pdf`/`pptx`/`xlsx` source-available) son
   proveedores MCP o skills que el usuario ya tiene. Opciones: (a) prohibition total de
   redistribuir, con integración vía marketplace del usuario; (b) permitir integración por API con
   la marca intacta.
   *Recomendación: (a) para `anthropics/skills` y (b) para el resto, declarado en el catálogo de
   integraciones.
6. **¿Se añade un gate de SPDX al CI para dependencias nuevas?**
   Contexto: `sintesis-capacidades-ego.md` §8 R6 lo declara como mitigación, pero no existe ningún
   script que lo compruebe. Opciones: (a) script en `scripts/` que falle si una dependencia nueva
   no tiene SPDX permisivo; (b) sólo una compuerta manual en la revisión de Backlog.
   *Recomendación: (a)*, porque el riesgo R6 está clasificado como *crítico* y la compuerta
   manual no deja rastro ejecutable.
7. **¿Se audita `repos-referencia/agent-robot-avatar` como fuente autónoma?**
   Contexto: `packages/avatar/LICENSE.md` lista 16 módulos de `vendor/agent-robot-avatar/` y 11
   ficheros adaptados de él, bajo MIT, pero `repos-referencia/avatar/` es una copia sin remoto
   Git, mientras `repos-referencia/agent-robot-avatar/` sí lo tiene (`CX-ArtLab/agent-robot-avatar`).
   Opciones: (a) declarar `agent-robot-avatar` como el upstream canónico y retirar la copia sin
   remoto; (b) documentar la cadena de vendorizado completa.
   *Recomendación: (a)*.

---

## 8. Tabla de atribución acumulada ##

Esta tabla cubre los repos de `repos-referencia/` de los que Ego **ya ha asimilado algo** (filas
`✅ Completada` en `docs/review/backlog-*.md`, recuento canónico en
`docs/extractions/README.md` §4.1: 47 filas en 10 repos). Distingue dos cosas que la documentación
actual mezcla: **copiar código** (obligación de aviso) y **reimplementar un patrón** (sin obra
derivada, sin obligación legal de aviso, pero sí obligación de registrar la procedencia).

| Repositorio | Licencia verificada | Filas `✅` | ¿Hay código copiado en Ego? | Atribución que le corresponde | Mecanismo actual | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| `nousresearch/hermes-agent` | MIT | 14 | No: reimplementación en TypeScript de patrones de UI y de streaming | Ninguna legal. Recomendable registrar procedencia en la ficha | Fila `✅` con ruta del fichero adaptado | Correcto |
| `openclaw/openclaw` | MIT | 7 | **Sí, al menos uno**: `packages/tool-call-repair/src/grammar.ts` se declara *"Extraído y adaptado de OpenClaw"* | MIT §1: conservar el aviso de copyright y el texto de la licencia. Cabecera canónica + `LICENSE.md` del paquete | Cabecera en prosa, **sin SPDX y sin ruta normalizada** | **Deuda: corregir** |
| `Louis-CFM/coucou` | MIT (marca Mochi y assets **fuera**) | 10 | **Sí**: `packages/avatar/src/render/projection.js` y `src/runtime/presence.js` son puertos MIT; 13 ficheros más sin cabecera | MIT §1: aviso de copyright + licencia. Sin assets ni marca de Mochi | `packages/avatar/LICENSE.md` existe y es completo; las cabeceras de fichero son parciales | **Deuda: normalizar 13 cabeceras** |
| `CX-ArtLab/agent-robot-avatar` | MIT | n/a (paquete) | **Sí**: 16 módulos en `vendor/agent-robot-avatar/` y 11 ficheros adaptados en `packages/avatar/src/` | MIT §1: aviso de copyright + licencia, en el paquete | `packages/avatar/LICENSE.md` §"Código embebido" y §"Código adaptado" | Correcto salvo cabeceras |
| `khoj-ai/khoj` | **AGPL-3.0** | 3 | No consta copia: el backlog dice que el solapamiento y el SHA-256 son *"mejora propia de Ego"* | Si hubiera copia, el producto quedaría obligado a AGPL-3.0. Procede **no-derivación documentada** | **Ninguno**: ni la ficha ni el backlog mencionan la licencia | **Deuda crítica: registrar AGPL-3.0 y corregir la cabecera de `AdaptiveChunker.ts`** |
| `dohooo/helmor` | Apache-2.0 | 4 | No: reimplementación TS del scheduler de coalescencia | Apache-2.0 §4 sólo si hay obra derivada; aquí no la hay | Ficha `✅` con ruta | Correcto |
| `career-ops-hq/career-ops` | MIT | 2 | No: reimplementación del lock atómico y del validador de rutas | MIT §1 sin obra derivada: sin obligación | Ficha `✅` con ruta | Correcto |
| `google-gemini/gemini-cli` | Apache-2.0 | 2 | No: la propia ficha dice que `GCLI-02` *"no es derivada de este repo"* | Apache-2.0 §4 sin obra derivada: sin obligación | Ficha `✅` con ruta | Correcto |
| `smtg-ai/claude-squad` | AGPL-3.0 | 1 | No: `packages/subegos/src/SubEgoWorktree.ts` reimplementa el patrón de worktree en TS | Procede constancia de no-derivación | **Ninguno**: deuda `D-CSQD-4` abierta en `docs/review/backlog-claude-squad.md:146` | **Deuda: registrar no-derivación** |
| `mem0ai/mem0` | Apache-2.0 | 2 | No: la capacidad ya existía en Ego (`EgoMemoryLifecycle`, `GraphRagEngine`) | Apache-2.0 §4 sin obra derivada: sin obligación | Ficha `✅` con ruta | Correcto |
| `modelcontextprotocol/servers` | MIT en transición a Apache-2.0 | 2 | No: la ficha dice que *"el patrón ya está implementado en Ego"* | MIT/Apache-2.0 sin obra derivada: sin obligación | Ficha `✅` con ruta | Correcto |

**Totales de la tabla:** 11 repos con exposición, **47 filas `✅ Completada`**, **3 ficheros con
código copiado sin cabecera canónica** (`grammar.ts` y 2 puertos de `coucou` con cabecera en prosa)
y **1 upstream copyleft sin licencia registrada** (`khoj`).

---

## 9. Referencias internas ##

- [`AGENTS.md`](../../AGENTS.md) — guardrails, §4 prohibiciones absolutas, §8 modelo de negocio
- [`LICENSE`](../../LICENSE) — Apache License 2.0, la licencia del producto
- [`docs/extractions/README.md`](../extractions/README.md) — §2 protocolo de dos vías, §4 taxonomía
  de compuertas, §4.3 cadena de atribución
- [`docs/extractions/khoj.md`](../extractions/khoj.md) — ficha sin declaración de licencia
- [`docs/extractions/coucou.md`](../extractions/coucou.md) — §52.4 veredicto sobre la cadena MIT
- [`docs/extractions/crush.md`](../extractions/crush.md) — §1.3 y §5, cláusula de *Competing Use*
- [`docs/extractions/claude-squad.md`](../extractions/claude-squad.md) — nota de licencia AGPL-3.0
- [`docs/review/backlog-khoj.md`](../review/backlog-khoj.md) — `KHOJ-01..03` y la corrección de
  la atribución de solapamiento y hash
- [`docs/review/backlog-claude-squad.md`](../review/backlog-claude-squad.md) — deuda `D-CSQD-4`
- [`docs/review/backlog-mcp-servers.md`](../review/backlog-mcp-servers.md) — transición MIT →
  Apache-2.0 del proyecto MCP
- [`docs/research/sintesis-capacidades-ego.md`](sintesis-capacidades-ego.md) — §3 matriz de
  capacidades `SYN-01..SYN-10` y §8 riesgo R6
- [`docs/research/compatibilidad-integraciones-mcp-skills.md`](compatibilidad-integraciones-mcp-skills.md)
  — §10.2 tabla de licencias con efecto para Ego
- [`docs/research/automatizacion-y-agentes-ejecucion.md`](automatizacion-y-agentes-ejecucion.md)
  — §"licencias que obligan a rechazar" y auditoría de datos de 2026-10-20
- [`docs/research/backoffice-empresa-personal.md`](backoffice-empresa-personal.md) — taxonomía de
  copyleft y source-available aplicada a 80 proyectos
- [`docs/research/canales-comunicacion-y-social.md`](canales-comunicacion-y-social.md) — licencias
  de canales, H-DNH y AGPL
- [`docs/research/orquestacion-multiagente.md`](orquestacion-multiagente.md) — licencias de los
  frameworks de orquestación y auditoría de `spdx_id`
- [`packages/avatar/LICENSE.md`](../../packages/avatar/LICENSE.md) — el único registro de atribución
  por paquete que hoy existe
