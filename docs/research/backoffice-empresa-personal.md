# Backoffice de empresa de una sola persona: estado del arte open source #

## Resumen ejecutivo ##

1. **Ego no debe ser un ERP.** El backoffice de un fundador solo tiene seis subdominios (contactos,
   catálogo, pedidos/facturas, dinero, inventario, roadmap) y ninguno de ellos es el dominio de Ego
   (Sistema Operativo Cognitivo). Construirlos en `packages/domains/` sería contaminación de dominio
   prohibida por `AGENTS.md` §4.
2. **El mejor combo OSS del mercado hoy es modular, no monolítico**: ERPNext/Frappe (núcleo contable,
   GPL-3.0), Twenty (CRM, AGPL-3.0), Plane (producto, AGPL-3.0), InvenTree (inventario, MIT),
   Actual Budget (presupuesto por envelopes, MIT) y n8n o Windmill (automatización).
3. **Ningún clon OSS es reutilizable como código en Ego**: 60 % de los proyectos relevantes están bajo
   AGPL-3.0, GPL-3.0, SSPL, ELv2, BSL o licencias "sostenibles" con cláusula de galería de
   aplicaciones. Para Apache 2.0 sólo sirven **Medusa (MIT)**, **Actual Budget (MIT)**,
   **Kill Bill (Apache-2.0)**, **OpenMeter (Apache-2.0)**, **Temporal (MIT)**, **node-red (Apache-2.0)**,
   **InvenTree (MIT)** y **OpenWMS (Apache-2.0)**.
4. **Directus ya no es open source**: cambió a la Monospace Sustainable Core License (MSCL-1.0-GPL,
   `NOASSERTION` en la API de GitHub) en 2026. Sigue siendo la mejor referencia de *metadata-driven
   permissions*, pero no se puede leer para copiar y, desde luego, no se puede embebir.
5. **El hallazgo de arquitectura más transferible es el de Medusa**: registro de módulos con
   `key`/`dependencies`/`isQueryable`/`scope` más un bus de eventos con contrato explícito. Es
   exactamente la forma que necesitan los Sub-Egos de Ego y su `EventBus`.
6. **El hallazgo de dominio más transferible es el de Firefly III**: un hecho de dinero es un
   *grupo de apuntes* con dos lados (origen/destino) y una cuenta, más una categoría opcional. Eso
   permite que Ego razone sobre dinero sin ser un ERP.
7. **El modelo de presupuesto por envelopes de Actual Budget es la pieza que un fundador solo
   entiende de verdad** y cabe en cinco entidades: cuenta, grupo, categoría, beneficiario, mes.
8. **Ego ya tiene la mitad del backoffice**: `packages/domains/` implementa `crm` (contactos, deals,
   interacciones), `product` (backlog, épicas, PRD), `knowledge`, `engineering` y `analytics`, todos
   con esquemas zod. Lo que **no** tiene es dinero, inventario ni facturación.
9. **La recomendación es una proyección canónica mínima, no un ERP**: un dominio `biz/` con cinco
   entidades (Party, Item, Commitment, MoneyFact, Movement) alimentado por ingesta MCP desde
   ERPNext/Twenty/Plane/InvenTree/Actual, nunca escrito hacia fuera sin aprobación HITL.
10. **El primer motor de esa proyección debe ser el EventBus + `searchMulti` ya existentes**, no un
    ORM: VantaDB no impone esquema relacional y Ego ya resuelve búsqueda híbrida y GraphRAG.
11. **Facturación: no construir. Integrar.** El modelo canónico de factura/pago/cobro es el de
    Kill Bill (`InvoiceStatus`, `InvoiceItem`, `InvoicePayment`), y el cobro real debe quedar fuera
    de Ego detrás de un proveedor MoR (como ya hace `docs/product/modelo-economico.md` §Facturación).
12. **Riesgo dominante: la contabilidad fiscal.** Ningún motor OSS sin licencia de software contable
    cualificada es apto para libros oficiales en la mayoría de jurisdicciones; Ego debe producir
    *informes de gestión*, nunca *libros contables*.
13. **Licencias: clasificar antes de integrar.** SSPL (Inngest), ELv2 (Invoice Ninja), BSL
    (Outline, Typebot), NocoBase License y Sustainable Use License (n8n) son **source-available, no
    open source**; además el copyleft contaminante es la Principal Killer Technical Foundation, no
    la licencia del código que se lee.
14. **Ego gana donde el ERP pierde**: la capa que ningún OSS resuelve bien es *razonar sobre el
    backoffice* ("¿qué cliente se me está enfriando?", "¿puedo permitirme contratar?"). Eso es el SOC.
15. **Veredicto global**: integrar (MCP/API) el 80 % del backoffice, construir nativamente el 15 %
    (proyección canónica + analítica de gestión), y no hacer el 5 % (contabilidad fiscal, IVA, cobros).

## Metodología ##

### Alcance de la búsqueda ###

Se investigaron siete dominios: ERP/núcleo de negocio, CRM y clientes, finanzas y presupuesto,
inventario y activos, comercio y e-commerce, gestión de producto y desarrollo, y automatización
administrativa. La lista de partida (&gt;70 proyectos) se depuró contra la realidad de los
repositorios: varios nombres de la lista de partida no existen (Front, `chatra/chatra` es un módulo residual)
y otros cambiaron de organización (`ihatemoney` → `spiral-project/ihatemoney`).

### Criterios de inclusión ###

| Criterio | Regla aplicada |
| --- | --- |
| Fama | Estrellas de GitHub verificadas, no de memoria |
| Uso | Existe evidencia de actividad: push reciente en la rama por defecto |
| Licencia | SPDX o cabecera del fichero `LICENSE` leída del repositorio |
| Aplicabilidad | ¿Resuelve un subdominio del backoffice de un fundador solo? |

### Cómo se obtuvieron los datos ###

- **Estrellas**: campo `stargazerCount` del payload JSON embebido en la página HTML pública de cada
  repositorio (`https://github.com/<org>/<repo>`), con confirmación cruzada contra
  `api.github.com/repos/<org>/<repo>` para las piezas críticas. Fecha de corte: **2026-10-20**.
- **Último push**: feed Atom `https://github.com/<org>/<repo>/commits.atom` (primera etiqueta
  `<updated>`), no la API de eventos.
- **Licencia**: lectura directa del fichero `LICENSE`/`LICENSE.md`/`LICENSE.txt`/`COPYING` en
  `raw.githubusercontent.com/<org>/<repo>/HEAD/...`. Cuando el `LICENSE` declara partes comerciales
  (`.ee/`, `enterprise/`) se transcribe el reparto real, no la licencia del núcleo.
- **Existencia**: `api.github.com/search/repositories` y `codeberg.org/api/v1/repos/...` para los
  proyectos que no están en GitHub (Forgejo vive en Codeberg).
- **Rutas de código**: listado de directorios vía HTML público y lectura de ficheros concretos en
  `raw.githubusercontent.com` para citar `ruta:línea` reales.
- **Auditoría posterior (2026-10-20)**: las cifras, licencias, lenguajes y rutas
  de este informe se reconsultaron contra la API REST de GitHub y contra el árbol
  local del repo. El resultado, dato a dato, está en la sección final «Verificación
  de datos».

### Límites declarados ###

- Las estrellas son una métrica de notoriedad, no de calidad. Un proyecto archivado
  (`maybe-finance/maybe`) conserva 54 214 estrellas y no recibe commits desde 2025-07-24.
- No se ejecutó ningún proyecto OSS. La verificación es estática (código, licencia, esquema de datos).
- Todo proyecto cuya existencia no pudo verificarse se marca **no verificado** y no se le atribuye
  modelo de datos.

### Regla de contaminación de dominio ###

> **Ego no hereda las entidades de negocio de estos proyectos.** ERP, contabilidad fiscal, e-commerce,
> CRM clásico, ATS, almacén y facturación son *dominios ajenos*. De este informe se extraen
> **patrones de arquitectura, modelado, API, workflow y gobernanza**. El dominio de Ego sigue siendo
> el Sistema Operativo Cognitivo: memoria, razonamiento, ejecución, gobernanza y espacio de trabajo.
> Cualquier entidad de negocio que Ego incorpore tendría que ser una **proyección cognitiva mínima**,
> justificada por un ADR, y no una reimplementación del ERP.

## Estado del arte por dominio ##

### 1. ERP y núcleo de negocio ###

| Proyecto | Stars | Licencia | Lenguaje | Qué resuelve | Veredicto Ego |
| --- | --- | --- | --- | --- | --- |
| [odoo/odoo](https://github.com/odoo/odoo) | 55 171 | LGPL-3.0 (núcleo) + Enterprise | Python | ERP modular con addons, ORM propio, reglas de acceso y workflow | Solo patrón |
| [frappe/erpnext](https://github.com/frappe/erpnext) | 40 382 | GPL-3.0 | Python | ERP completo: contabilidad, stock, compras, ventas, RRHH | Integrar vía API |
| [frappe/frappe](https://github.com/frappe/frappe) | 10 964 | MIT | Python | Framework metamodelo (DocType) + REST/GraphQL sobre los mismos docs | Solo patrón |
| [medusajs/medusa](https://github.com/medusajs/medusa) | 36 816 | MIT + EE | TypeScript | E-commerce headless con módulos, event bus y workflow | Nativo (patrón) |
| [saleor/saleor](https://github.com/saleor/saleor) | 23 458 | BSD-3-Clause | Python | E-commerce GraphQL-first multi-tenant | Solo patrón |
| [vendure-ecommerce/vendure](https://github.com/vendure-ecommerce/vendure) | 8 527 | GPL-3.0 (Community) + VCL | TypeScript | E-commerce modular con plugins y API GraphQL | Solo patrón |
| [nocobase/nocobase](https://github.com/nocobase/nocobase) | 24 634 | NocoBase License (BSL-like) | TypeScript | Plataforma no-code con colecciones dinámicas y plugins | Solo patrón |
| [directus/directus](https://github.com/directus/directus) | 38 622 | MSCL-1.0-GPL (no OSI) | TypeScript | Backend headless metadata-driven con permisos y flows | Solo patrón |
| [twentyhq/twenty](https://github.com/twentyhq/twenty) | 58 652 | AGPL-3.0 | TypeScript | CRM moderno con objetos y campos definidos por metadata | Integrar vía API |
| [makeplane/plane](https://github.com/makeplane/plane) | 61 155 | AGPL-3.0 | TypeScript | Gestión de producto y proyectos tipo Jira/Linear | Integrar vía API |
| [AppFlowy-IO/AppFlowy](https://github.com/AppFlowy-IO/AppFlowy) | 77 575 | AGPL-3.0 | Dart | Workspace colaborativo con editor de bloques | No hacer |
| [docmost/docmost](https://github.com/docmost/docmost) | 22 039 | AGPL-3.0 | TypeScript | Wiki colaborativa con control de acceso | No hacer |
| [outline/outline](https://github.com/outline/outline) | 40 982 | BSL-1.1 | TypeScript | Wiki/knowledge base con permisos por colección | No hacer |
| [taigaio/taiga-back](https://github.com/taigaio/taiga-back) | 859 | MPL-2.0 | Python/Django | API de gestión de proyectos (frontend en `taigaio/taiga`) | Solo patrón |
| [redmine/redmine](https://github.com/redmine/redmine) | 6 050 | GPL-2.0 | Ruby | Tracker de incidencias con wiki, roles y campos custom | Solo patrón |
| [opf/openproject](https://github.com/opf/openproject) | 16 494 | GPL-3.0 | Ruby | Gestión de proyectos con work packages y portfolio | Solo patrón |
| [Leantime/leantime](https://github.com/Leantime/leantime) | 11 869 | AGPL-3.0 | PHP | Gestión de producto para equipos pequeños | Solo patrón |
| [dolibarr/dolibarr](https://github.com/dolibarr/dolibarr) | 7 752 | GPL-3.0 | PHP | ERP modular ligero para PYMEs | Solo patrón |

### Fichas de ERP y núcleo de negocio ###

**Odoo** — El ejemplo canónico de ERP por *addons*: cada módulo (ventas, compras, stock) declara sus
modelos, vistas y permisos, y la plataforma resuelve permisos por reglas de registro. Su `models/`
y `security/` son la mejor referencia de "cómo un ERP decide qué puede ver un usuario", pero es
Python + LGPL y su núcleo no es reusable en TypeScript. La licencia LGPL-3.0 permite uso en
combinación sin copyleft virulento, lo que lo hace el único ERP grande con licencia reutilizable —
pero el coste de reimplementar su ORM en Ego es prohibitivo.

**ERPNext / Frappe** — El diseño más relevante del estudio. Frappe define un **metamodelo
declarativo**: cada entidad es un *DocType* cuyo esquema vive en JSON
(`frappe/core/doctype/doctype/`, `frappe/core/doctype/docfield/docfield.py`) y del que se derivan
automáticamente la API REST, los permisos por documento (`frappe/core/doctype/docperm/`) y el audit
trail (`frappe/core/doctype/audit_trail/`). ERPNext hereda ese motor y añade los dominios. Para Ego
el valor está en el patrón "un documento con esquema declarado genera superficie de API", no en las
entidades. Licencia: Frappe MIT, ERPNext GPL-3.0 → integrable como servicio, no embebible.

**Medusa** — El único proyecto grande del estudio escrito en TypeScript con licencia MIT (salvo
material EE marcado en `ENTERPRISE-LICENSE.md`). Su arquitectura es directamente asimilable:
registro declarativo de módulos en
`packages/core/modules-sdk/src/definitions.ts:10-45` (cada módulo declara `key`, `defaultPackage`,
`isRequired`, `isQueryable`, `dependencies` y `defaultModuleDeclaration.scope`) y un bus de eventos
con contrato explícito en `packages/core/types/src/event-bus/event-bus.ts:4-18`
(`IEventBusService.subscribe/unsubscribe/emit`). La capa de modelo (`packages/core/utils/src/dml/`)
aporta un *entity builder* con relaciones declaradas. Esto calca casi uno a uno lo que Ego necesita
para registrar Sub-Egos y enrutar eventos.

**Saleor** — GraphQL-first y multi-tenant. Útil como referencia de "un único esquema público que
sirve a varios fondos con el mismo código", que es el mismo problema que Ego resuelve cuando varios
proyectos comparten memoria. Licencia BSD-3-Clause, permisiva, pero el dominio (catálogo, canal,
checkout) es ajeno.

**Vendure** — Modularidad por *plugins* con API GraphQL; el caso de uso real (tienda con catálogo
complejo) no aplica a un fundador solo. Su valor para Ego es la noción de "módulo con su propio
alcance (`scope`) y dependencias declaradas", equivalente al `SubEgoManifest`.

**NocoBase** — Referencia de plataforma *no-code*: `packages/core/client/src/collection-manager`
(colecciones dinámicas), `packages/core/client/src/plugin-manager` y `packages/core/client/src/acl`.
El patrón "colección con esquema definido en runtime" es el que hace que Directus, Twenty y NocoBase
sean casi el mismo producto con distinto envoltorio. **Licencia no libre**: la NocoBase License es
una BSL modificada con cláusulas de distribución comercial; no es open source OSI.

**Directus** — El ejemplo más puro de *metadata-driven backend*: la colección, sus campos, sus
relaciones y sus permisos son datos, no código, y el motor los compila a SQL y GraphQL. El
punto exacto a mirar es
`api/src/permissions/modules/process-payload/process-payload.ts:29` (`processPayload`), donde
toda lectura/escritura pasa por un filtro de permisos antes de tocar la base. **Aviso crítico de
licencia**: la API de GitHub devuelve `NOASSERTION` / "Other" y el fichero `license` (en
minúscula) de la raíz es la *Monospace
Sustainable Core License 1.0* (`MSCL-1.0-GPL`), no AGPL-3.0 como antes. Desde 2026 Directus **no es
open source OSI**; sólo es referencia de diseño.

**Twenty** — CRM moderno donde el esquema de objetos es *dato*: `packages/twenty-server/src/engine/metadata-modules/`
contiene `flat-object-metadata`, `flat-field-metadata`, `flat-field-permission`, `flat-index-metadata`,
`flat-entity`, y el ciclo de vida del workspace vive en
`packages/twenty-server/src/engine/workspace-manager/` (incluida `workspace-migration/`). Es la
referencia más directa del estudio para "definir entidades de negocio como metadatos versionados".
AGPL-3.0: integrable por API, no copiable.

**Plane** — Gestión de producto/self-hosted, la alternativa open source a Jira/Linear. Su API ha
migrado a Django/Python (`apps/api/plane/app/`: `permissions/`, `serializers/`, `views/`), lo que
revela una tendencia del sector: el *frontend* moderno en TS y el *backend* en Python. AGPL-3.0.

**AppFlowy / Docmost / Outline** — Wikis y espacios de trabajo colaborativos. Los tres son
"documento + bloque + permiso". Outline usa BSL-1.1 (source-available). Para Ego son **no hacer**:
`packages/knowledge/` ya cubre ingesta, búsqueda híbrida y GraphRAG, y un editor de bloques es
UI, no capacidad cognitiva.

**Redmine / OpenProject / Taiga / Leantime** — Trackers clásicos. Su aporte es el **concepto de
campo personalizado por proyecto** y de rol→permiso→vista, que en Ego ya existe como
`DomainView` + manifiesto de Sub-Ego (`packages/domains/src/types.ts:34-60`).

### 2. CRM, contactos y clientes ###

| Proyecto | Stars | Licencia | Lenguaje | Qué resuelve | Veredicto Ego |
| --- | --- | --- | --- | --- | --- |
| [twentyhq/twenty](https://github.com/twentyhq/twenty) | 58 652 | AGPL-3.0 | TypeScript | CRM moderno, objetos por metadata | Integrar vía API |
| [chatwoot/chatwoot](https://github.com/chatwoot/chatwoot) | 37 987 | MIT + `enterprise/` | Ruby | Helpdesk omnicanal con bandeja compartida | Integrar vía API |
| [monicahq/monica](https://github.com/monicahq/monica) | 25 506 | AGPL-3.0 | PHP/Laravel | CRM personal: contactos, relaciones, recordatorios | Solo patrón |
| [krayin/laravel-crm](https://github.com/krayin/laravel-crm) | 24 029 | MIT | PHP | CRM con leads, actividades y pipeline | Solo patrón |
| [baptisteArno/typebot.io](https://github.com/baptisteArno/typebot.io) | 10 561 | FSL-1.1-Apache-2.0 | TypeScript | Constructor de chatbots y formularios conversacionales | Solo patrón |
| [zammad/zammad](https://github.com/zammad/zammad) | 6 019 | AGPL-3.0 | Ruby | Helpdesk con macros, plantillas y automatización por reglas | Solo patrón |
| [SuiteCRM/SuiteCRM](https://github.com/SuiteCRM/SuiteCRM) | 5 802 | AGPL-3.0 | PHP | CRM enterprise con workflow y estudios | No hacer |
| [freescout-helpdesk/freescout](https://github.com/freescout-helpdesk/freescout) | 4 603 | AGPL-3.0 | PHP/Laravel | Helpdesk ligero autohospedado | Solo patrón |
| [espocrm/espocrm](https://github.com/espocrm/espocrm) | 3 498 | AGPL-3.0 | PHP | CRM con Kanban y roles, autoalojado | Solo patrón |
| [civicrm/civicrm-core](https://github.com/civicrm/civicrm-core) | 787 | AGPL-3.0 | PHP | CRM para ONGs: contribuciones, socios, campañas | No hacer |
| [chatr/chatra](https://github.com/chatr/chatra) | 8 | sin licencia detectada | JavaScript | Módulo de chat residual; el producto es SaaS | No hacer |
| [front/front](https://github.com/front/front) | no verificable | no verificable | — | El repositorio `front/front` devuelve 404; el producto se cerró | No hacer |
| [peppermint/peppermint](https://github.com/peppermint/peppermint) | 0 | sin SPDX | n/d | El repo existe, sin estrellas y sin push desde 2019-08-14 | No hacer |

### Fichas de CRM y clientes ###

**Twenty** — Ya descrito. Para el subdominio CRM es la referencia dominante: define `person`,
`company`, `opportunity` y `task` como objetos con metadata, sobre un workspace con versionado
(`workspace-version/`, `workspace-migration/`) y permisos por campo (`flat-field-permission`). El
patrón de "campo calculado/derivado" (`derived-field-metadata-ids`) es directamente asimilable al
`Context Assembly` de Ego.

**Chatwoot** — Licencia MIT para el núcleo, con el directorio `enterprise/` bajo licencia
comercial. Su valor para Ego es el modelo de **bandeja compartida omnicanal**: conversación, canal,
mensaje, agente, y *conversation state*. Es la pieza que un fundador solo necesita para no perder
un email de un cliente. MIT lo hace integrable sin fricción de licencia.

**Monica** — CRM personal muy simple: contactos, relaciones ("es amigo de"), recordatorios,
notas. El modelo de *relación entre contactos* y el de *actividad con fecha* son útiles, pero la
licencia AGPL y el stack PHP+Laravel lo dejan como referencia.

**Krayin** — MIT y Laravel; el CRM "de venta" clásico (leads, oportunidades, actividades, pipeline).
Su API REST es trivial y su licencia MIT lo hace candidato a integración ligera para un fundador
que ya lo use.

**Typebot** — Conversaciones como *flujo*: bloques, condiciones, variables y respuesta. Licencia
FSL-1.1 (source-available con futura Apache-2.0): **no es open source OSI todavía**. El patrón de
"formulario como grafo conversacional con estado" sí es valioso para el onboarding de Ego.

**Zammad** — Helpdesk con *macros* y *plantillas*: la automatización por reglas. AGPL.

**SuiteCRM / EspoCRM / CiviCRM** — CRM enterprise para bugs, ONGs y sector público. Veredicto: no hacer; el modelo
"módulos, estudios y workflows configurables" es enterprise-software, no lo que un fundador solo
necesita. CiviCRM aporta el patrón de *campañas con segmentedación* útil para `marketing/campaigns`.

**Chatra / Front / Peppermint** — Verificados como no representativos: `chatr/chatra` tiene 8
estrellas y sin licencia detectable, `front/front` devuelve 404 y `peppermint/peppermint` existe
pero tiene 0 estrellas y su último push es de 2019-08-14. No son referencia técnica.

### 3. Finanzas, contabilidad y presupuesto ###

| Proyecto | Stars | Licencia | Lenguaje | Qué resuelve | Veredicto Ego |
| --- | --- | --- | --- | --- | --- |
| [maybe-finance/maybe](https://github.com/maybe-finance/maybe) | 54 214 | AGPL-3.0 | Ruby | Net worth, inversión y presupuesto | No hacer (archivado) |
| [actualbudget/actual](https://github.com/actualbudget/actual) | 29 623 | MIT | TypeScript | Presupuesto por envelopes, local-first, E2E cifrado | Nativo (patrón) |
| [firefly-iii/firefly-iii](https://github.com/firefly-iii/firefly-iii) | 24 946 | AGPL-3.0 | PHP | Contabilidad de partida doble, presupuestos, reglas | Solo patrón |
| [invoiceninja/invoiceninja](https://github.com/invoiceninja/invoiceninja) | 10 301 | Elastic License 2.0 | PHP | Facturación, propuestas, pagos | Integrar vía API |
| [crater-invoice-inc/crater](https://github.com/crater-invoice-inc/crater) | 8 355 | AGPL-3.0 | PHP | Facturación y gastos con clientes/proveedores | Solo patrón |
| [beancount/beancount](https://github.com/beancount/beancount) | 6 101 | GPL-2.0 | Python | Contabilidad de partida doble en texto plano | Solo patrón |
| [ledger/ledger](https://github.com/ledger/ledger) | 6 059 | ISC | C++ | Libro contable en texto plano | Solo patrón |
| [gnucash/gnucash](https://github.com/gnucash/gnucash) | 4 381 | GPL-2.0/3 | C | Contabilidad-desktop completa | No hacer |
| [bigcapitalhq/bigcapital](https://github.com/bigcapitalhq/bigcapital) | 3 947 | AGPL-3.0 | TypeScript | Contabilidad de partida doble en la web | Solo patrón |
| [beancount/fava](https://github.com/beancount/fava) | 2 593 | MIT | Python | Interfaz web de Beancount | Solo patrón |
| [spiral-project/ihatemoney](https://github.com/spiral-project/ihatemoney) | 1 394 | BSD-3-Clause | Python | Gestor de gastos compartidos | No hacer |
| [flash-oss/medici](https://github.com/flash-oss/medici) | 360 | MIT | TypeScript | Librería de partida doble para Node | Nativo (patrón) |
| Kill The Zitter | no verificable | no verificable | — | Sin repositorio localizable por nombre ni por búsqueda | No hacer |
| Biggest | no verificable | no verificable | — | Sin repositorio localizable por nombre ni por búsqueda | No hacer |

### Fichas de finanzas y presupuesto ###

**Actual Budget** — La pieza más importante del estudio para Ego. Es TypeScript, MIT, local-first con
sincronización opcional y cifrado de extremo a extremo: exactamente el perfil de Ego. El modelo está
en `packages/loot-core/src/server/models.ts:65` (`accountModel`), `:78` (`accountGroupModel`),
`:95` (`categoryModel`), `:130` (`categoryGroupModel`) y `:187` (`payeeModel`); la lógica de
envelopes vive en `packages/loot-core/src/server/budget/envelope.ts` (`createCategory` en `:33`,
`createCategoryGroup` en `:76`, `createSummary` en `:98`, `createBudget` en `:228`). El presupuesto
es una tabla mes × categoría con tres números por celda (presupuestado, actividad, disponible) y
**rollover configurable**. Es el único modelo de "dinero" que un fundador solo interpreta sin
formación contable.

**Firefly III** — La referencia canónica de partida doble moderna. La unidad mínima es la
**TransactionJournal** (el *split*), no la transacción:
`app/Models/TransactionJournal.php:55` la define, con `:61-73` los campos rellenables
(`transaction_type_id`, `bill_id`, `transaction_currency_id`, `description`, `completed`, `order`,
`date`, `date_tz`) y `:75` marca el campo `encrypted` como oculto; el grupo lógico es
`TransactionGroup` y el tipo de movimiento vive en `TransactionType`. El plan de cuentas se modela
como `Account` + `AccountType` (`app/Models/AccountType.php:30-44`, `hasMany(Account::class)`).
Los presupuestos tienen `Budget`/`BudgetLimit`/`AvailableBudget`/`AutoBudget`, y la automatización
por reglas es `Rule` → `RuleGroup` → `RuleTrigger` + `RuleAction`. **Conclusión clave**: un hecho
de dinero en Firefly es *un par (cuenta origen, cuenta destino, importe, moneda)*. Ese es el modelo
mínimo que Ego necesita para razonar sobre dinero sin convertirse en un ERP.

**Maybe Finance** — El diseño de UI más bello del estudio, pero el repositorio está **archivado**
(`archived: true` en la API de GitHub) y su último push es de **2025-07-24**. Veredicto: no usar
como referencia de producción; sí como referencia de *diseño de información* financiero.

**Beancount / Fava / Ledger** — Contabilidad de partida doble **en texto plano**, con `check`,
`balance` y `query` como comandos. El valor para Ego no es el lenguaje contable sino el principio
de **un ledger append-only, derivado y verificable**: el estado financiero es una *función* de un
log de hechos, no una tabla mutable. Esto casa con `packages/events/` y con la auditabilidad de
`gov/audit`.

**Invoice Ninja** — Facturación completa con propuestas, facturas, pagos y créditos. Licencia
**Elastic License 2.0**: source-available con restricción de uso competitivo, **no** OSI. Sólo
integración por API si el usuario ya lo usa.

**Crater** — Facturación y gastos, Laravel + Vue. AGPL-3.0 y **dormido desde 2024-08-10**. No es
referencia de mantenimiento.

**GNU Cash, ihatemoney** — Correctos pero fuera de alcance (desktop C, multiusuario Flask).
ihatemoney está bajo **BSD-3-Clause**, no copyleft: se descarta por alcance, no por licencia.

**Medici** — Librería TypeScript MIT de partida doble (nodejs + mongoose) con 360 estrellas.
Veredicto: **nativo (patrón)** — el modelo de `Account`/`Transaction`/`JournalEntry` con balance
derivado cabe en ~200 líneas y es la forma más barata de dar a Ego una noción fiable de saldo.

### 4. Inventario, almacén y activos ###

| Proyecto | Stars | Licencia | Lenguaje | Qué resuelve | Veredicto Ego |
| --- | --- | --- | --- | --- | --- |
| [snipe/snipe-it](https://github.com/snipe/snipe-it) | 15 052 | AGPL-3.0 | PHP/Laravel | Gestión de activos: hardware, licencias, accesorios | Solo patrón |
| [Inventree/InvenTree](https://github.com/InvenTree/InvenTree) | 7 736 | MIT | Python/Django | BOM, inventario, partes, ubicaciones, proveedores | Integrar vía API |
| [openboxes/openboxes](https://github.com/openboxes/openboxes) | 915 | EPL-1.0 | Groovy | Almacén: stock, ubicaciones, contenedores | Solo patrón |
| [PartKeepr/PartKeepr](https://github.com/PartKeepr/PartKeepr) | 1 531 | GPL-3.0 | JavaScript | Inventario de piezas con categorías y proveedores | No hacer (archivado) |
| [openwms/org.openwms](https://github.com/openwms/org.openwms) | 750 | Apache-2.0 | Java | WMS: movimiento de stock, ubicaciones, unidades | Solo patrón |

### Fichas de inventario y activos ###

**InvenTree** — El único proyecto de inventario con licencia MIT y mantenido. Su modelo (fichero
`src/backend/InvenTree/part/models.py`, serializers en `serializers.py`, API REST en `api.py`,
*stocktake* en `stocktake.py`, tareas asíncronas en `tasks.py`, eventos de dominio en `events.py`)
es el mejor de la categoría: **Parte → BOM → Ubicación → Stock → Movimiento**, con el movimiento
como hecho inmutable y el saldo derivado. Es exactamente lo que un fundador con producto físico
necesita. MIT + REST ⇒ candidato serio a integración.

**Snipe-IT** — El estándar de hecho en gestión de activos IT: `Asset` con número de serie, modelo,
garantía, categoría, proveedor, ubicación, y un **historial de asignación** por entrada/salida.
AGPL-3.0 ⇒ solo patrón. Su insight para Ego: un activo es una entidad con *custodia* y no con
*cantidad*, y el modelo "cantidad sólo" (inventario) y "unidad con serie" (activo) no son el mismo
dominio.

**OpenWMS** — Apache-2.0 y, por diseño: stock y movimientos son *eventos*, y el saldo es una
proyección. Es el mismo patrón que `packages/events/` + `packages/tasks/`.

**OpenBoxes / PartKeepr** — EPL-1.0 y GPL-3.0 respectivamente; PartKeepr está
archivado y su último push es de 2023-05-30.

### 5. Comercio y e-commerce ###

| Proyecto | Stars | Licencia | Lenguaje | Qué resuelve | Veredicto Ego |
| --- | --- | --- | --- | --- | --- |
| [bagisto/bagisto](https://github.com/bagisto/bagisto) | 28 259 | MIT | PHP/Laravel | E-commerce completo (catálogo, carrito, pedido) | No hacer |
| [woocommerce/woocommerce](https://github.com/woocommerce/woocommerce) | 10 559 | GPL-2.0+ | PHP | Plugin e-commerce para WordPress | No hacer |
| [getlago/lago](https://github.com/getlago/lago) | 10 695 | AGPL-3.0 | Go | Billing open source (suscripciones, planes, facturas) | Solo patrón |
| [Sylius/Sylius](https://github.com/Sylius/Sylius) | 8 560 | MIT | PHP/Symfony | E-commerce domain-driven con plugins | Solo patrón |
| [killbill/killbill](https://github.com/killbill/killbill) | 5 806 | Apache-2.0 | Java | Billing: facturas, pagos, refunds, suscripciones, clock | Integrar vía API |
| [stripe/stripe-node](https://github.com/stripe/stripe-node) | 4 534 | MIT | TypeScript | SDK del proveedor de pagos | Integrar (Nivel C) |
| [openmeterio/openmeter](https://github.com/openmeterio/openmeter) | 2 392 | Apache-2.0 | Go | Metering de uso + facturación por consumo | Integrar vía API |
| Shopify | no aplica | API pública, **no** OSS | — | Tienda alojada; sólo API REST/GraphQL y webhooks | Integrar (Nivel C) |

### Fichas de comercio y e-commerce ###

**Kill Bill** — El modelo de facturación de referencia de la industria, y el único con licencia
Apache-2.0 en este subdominio. La factura (`invoice/src/main/java/org/killbill/billing/invoice/model/DefaultInvoice.java`)
tiene estado explícito (`:59` `private final InvoiceStatus status`, y `:102` la construcción en
`InvoiceStatus.DRAFT`), saldo **derivado** de items + pagos (`:274-282` `getBalance()`) y soporte de
factura padre (`:286-287` `hasZeroParentBalance()`). Cada línea es un
`InvoiceItemBase` (`invoice/src/main/java/org/killbill/billing/invoice/model/InvoiceItemBase.java:34`)
con `startDate` (`:40`), `amount` (`:42`) y `description` (`:44`); los tipos de línea están
separados por clase (`RecurringInvoiceItem`, `UsageInvoiceItem`, `TaxInvoiceItem`,
`FixedPriceInvoiceItem`, `ExternalChargeInvoiceItem`). Los pagos son
`DefaultInvoicePayment`. **Para Ego la lección es**: (a) la factura nace en `DRAFT` y sólo se
"commitea" al emitirla; (b) el saldo nunca se almacena, se deriva; (c) líneas recurrentes,
de uso y de impuestos son tipos distintos, no campos opcionales.

**OpenMeter** — Apache-2.0 y, a diferencia de los anteriores, **nativo en Go pero con un diseño de
dominios muy separado**: `openmeter/productcatalog/` (planes, addons, features, descuentos,
`currencyresolver/`), `openmeter/subscription/` (con `patch/`, `workflow/`, `repo/`,
`validators/`, `events.go`), `openmeter/billing/` (`charges/`, `creditgrant/`, `rating/`,
`lineengine/`, `sequence/`, `worker/`), `openmeter/meter/`, `openmeter/event/`, `openmeter/ledger/`,
`openmeter/entitlement/`. El `lineengine/` (motor de líneas de factura) y el `patch/` (mutación
de suscripción como parche versionado) son patrones notables. Es la mejor referencia OSS para
"cobrar por uso", que es el modelo natural de un SaaS de un fundador.

**Lago** — AGPL-3.0. Equivalente conceptual de OpenMeter en Ruby, con foco en API de suscripción y
facturación. Su API pública es un buen contrato de integración.

**Bagisto / Sylius / WooCommerce** — E-commerce completo. Dominio ajeno y no necesario en P0. Bagisto
MIT y Sylius MIT hacen que, si un usuario tiene tienda, la integración vía API REST sea trivial.

**Stripe** — No es OSS como producto, pero `stripe/stripe-node` sí es MIT. Es la vía Nivel C
(cobro real) que Ego debe usar: **Ego no cobra, sólo orquesta la autorización y delega el cargo**.

### 6. Gestión de proyectos, producto y desarrollo ###

| Proyecto | Stars | Licencia | Lenguaje | Qué resuelve | Veredicto Ego |
| --- | --- | --- | --- | --- | --- |
| [github/spec-kit](https://github.com/github/spec-kit) | 142 012 | MIT | Python | Ciclo de desarrollo dirigido por especificación | Nativo (patrón) |
| [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec) | 72 476 | MIT | TypeScript | Cambios dirigidos por especificación con deltas | Nativo (patrón) |
| [go-gitea/gitea](https://github.com/go-gitea/gitea) | 58 582 | MIT | Go | Git self-hosted con issues, wiki, paquetes | Solo patrón |
| [gitlabhq/gitlabhq](https://github.com/gitlabhq/gitlabhq) | 24 552 | MIT + `ee/` | Ruby | Plataforma de desarrollo completa | Solo patrón |
| [backstage/backstage](https://github.com/backstage/backstage) | 34 668 | Apache-2.0 | TypeScript | Catálogo de servicios y portal de developer | Nativo (patrón) |
| [metabase/metabase](https://github.com/metabase/metabase) | 49 753 | AGPL-3.0 + comercial | Clojure | BI: consultas y dashboards sobre cualquier DB | Integrar vía API |
| [baserow/baserow](https://github.com/baserow/baserow) | 6 180 | MIT Expat (OSE) + licencia propia en `premium/` y `enterprise/` | Python | Base de datos no-code con API REST y bloques | Solo patrón |

### Fichas de proyecto y desarrollo ###

**GitHub Spec Kit** — El proyecto más popular del estudio (142 012 estrellas) y **MIT**. Su tesis:
una especificación escrita antes del código, con plantillas (`specify` → `plan` → `tasks` →
`implement`) y artefactos en Markdown versionados en el repo. Para Ego es la validación de que
`packages/domains/src/product/types.ts` (que ya tiene `ProductPrd` con `problemStatement`,
`acceptanceCriteria`, `successMetrics` y `outOfScope`) va por buen camino: **el PRD como artefacto
de primera clase**. Veredicto: nativo (patrón), sin dependencias.

**OpenSpec** — MIT, TypeScript, y más ligero: gestiona *deltas* de especificación por cambio
(convención `ADDED`/`MODIFIED`/`REMOVED` sobre requisitos), con verificación de consistencia. Encaja
con la línea de Ego "cero asunciones silenciosas": cada cambio exige declarar el delta antes de
aplicarlo.

**Gitea** — MIT y Go. Referencia de git self-hosted con issues y wiki. Nota: el gemelo de código
abierto **Forgejo** ya no está en GitHub (404 en `github.com/forgejo/forgejo`); su sede canónica es
Codeberg (`codeberg.org/forgejo/forgejo`, 5 681 estrellas, MIT). Si Ego ofrece un conector de
Git self-hosted, debe hablar con **Forgejo**, no con Gitea.

**GitLab** — MIT para el núcleo con `ee/` comercial. Su `packages/*` por dominio y su modelo de
"proyecto → namespace → issue → epic → milestone" es el mapa mental de la mayoría de equipos.

**Backstage** — Apache-2.0 y TypeScript: el portal de developer. Su **catálogo de entidades**
(`catalog/entities` con `kind`, `metadata`, `spec`, `relations`) es una idea fuertemente
transferible a Ego: el `SubEgoManifest` de Ego es, estructuralmente, una entidad de catálogo con
`kind` y relaciones. Es la referencia para el *Software Catalog* de Ego (que el `packages/subegos/`
ya empiezan a tener).

**Metabase** — AGPL-3.0 (con licencia comercial para algunas partes). BI accesible: el usuario
formula preguntas sin SQL. Es el modelo mental correcto para las *preguntas de gestión* de un
fundador ("¿en qué gasté este trimestre?"). Integrable por API.

**Baserow** — No-code database con API REST generada y bloques de UI. La **edición open source
(Baserow OSE) es MIT Expat**; sólo `premium/` y `enterprise/` llevan licencia propia
(source-available), y `docs/` es CC BY-SA 4.0. Su API autogenerada es el mismo patrón que el
metamodelo DocType de Frappe y
que el de Twenty: **definir el esquema como datos y derivar la API**.

### 7. Automatización administrativa y workflow ###

| Proyecto | Stars | Licencia | Lenguaje | Qué resuelve | Veredicto Ego |
| --- | --- | --- | --- | --- | --- |
| [n8n-io/n8n](https://github.com/n8n-io/n8n) | 208 095 | Sustainable Use License + EE | TypeScript | Automatización visual con nodos y 400+ integraciones | Integrar (Nivel B) |
| [huginn/huginn](https://github.com/huginn/huginn) | 50 083 | MIT | Ruby | Agentes que reaccionan a eventos web | Solo patrón |
| [apache/airflow](https://github.com/apache/airflow) | 47 223 | Apache-2.0 | Python | Orquestación de DAGs programáticos | No hacer |
| [kestra-io/kestra](https://github.com/kestra-io/kestra) | 29 901 | Apache-2.0 | Java | Orquestación YAML con retries e idempotencia | Solo patrón |
| [activepieces/activepieces](https://github.com/activepieces/activepieces) | 25 126 | MIT + `ee/` | TypeScript | Automatización ligera, self-hosted, piezas en TS | Integrar (Nivel B) |
| [temporalio/temporal](https://github.com/temporalio/temporal) | 23 844 | MIT | Go | Ejecución durable y determinista de workflows | Nativo (patrón) |
| [node-red/node-red](https://github.com/node-red/node-red) | 23 762 | Apache-2.0 | JavaScript | Motor de flows JSON con nodos | Nativo (patrón) |
| [PrefectHQ/prefect](https://github.com/PrefectHQ/prefect) | 24 043 | Apache-2.0 | Python | Orquestación con reintentos y estado | No hacer |
| [windmill-labs/windmill](https://github.com/windmill-labs/windmill) | 18 229 | Apache-2.0 + AGPLv3 (mixto) | Rust | Workflows como código, scripts y flows | Integrar (Nivel B) |
| [triggerdotdev/trigger.dev](https://github.com/triggerdotdev/trigger.dev) | 16 584 | Apache-2.0 | TypeScript | Jobs en background con retries e idempotencia TS | Solo patrón |
| [automatisch/automatisch](https://github.com/automatisch/automatisch) | 14 001 | AGPL-3.0 + EE | JavaScript | Automatización self-hosted de tareas SaaS | Solo patrón |
| [inngest/inngest](https://github.com/inngest/inngest) | 5 964 | SSPL-1.0 | Go | Funciones dirigidas por eventos, idempotencia | Solo patrón |

### Fichas de automatización y workflow ###

**n8n** — El más usado del estudio con diferencia (208 095 estrellas). Licencia **Sustainable Use
License** (source-available: uso interno libre, reutilización comercial con servicios de pago restringida) más
directorio `.ee`/`enterprise/` comercial → **no es open source OSI**. Su modelo es un grafo de
nodos con triggers, y su valor real para Ego es el **catálogo de integraciones** (400+ apps) más un
**servidor MCP** disponible. Veredicto: integrar vía MCP/HTTP como motor de automatizaciones
externas, nunca embebido.

**Temporal** — MIT y, con diferencia, el proyecto más importante de la sección para la arquitectura
de Ego. Aporta tres cosas que Ego necesita: (a) **determinismo del workflow** (el código de
decisión se reproduce a partir del historial, no del reloj); (b) **replay determinista** para
auditar por qué el agente hizo lo que hizo; (c) **workflows versionados y continuables** tras un
cambio de código. Ego ya tiene `packages/tasks/` (BackgroundEngine, checkpoints, ProactivityEngine)
y `packages/runtime/` (ToolExecutionLoop, AttentionStateMachine): la lección es que un checkpoint
debería guardar el **historial de decisiones**, no sólo el estado.

**node-red** — Apache-2.0. El modelo de flow es un **JSON declarativo** con nodos, que el runtime
carga y ejecuta: `packages/node_modules/@node-red/runtime/lib/flows/Flow.js` (869 líneas) más
`Subflow.js` y `Group.js`. Para Ego es la alternativa ligera a Temporal cuando el flujo cabe en
pocos pasos: **el flow serializable es el mismo formato que un `SubEgoManifest`**.

**Windmill** — Apache-2.0 (con el frontend AGPLv3). El núcleo está escrito en **Rust**. Workflows
como código: scripts de TypeScript,
Python, Go o SQL con *inputs/outputs tipados*, y un modelo de *workspace → script → flow → job*.
Su API-first es la razón por la que es el candidato MCP más natural.

**Trigger.dev** — Apache-2.0 y TypeScript puro: jobs en background con reintentos, idempotencia y
eventos. Es la referencia más cercana al stack de Ego (Node 22 + TS estricto) para el motor de
tareas durables.

**Huginn** — MIT y muy infravalorado para este caso: agentes que reaccionan a eventos web y ejecutan
pasos. Es exactamente la forma "Ego como conjunto de Sub-Egos reactivos". Pero es Ruby y su modelo
es de *scraping web*, no de razonamiento.

**Airflow / Prefect / Dagster / Kestra** — Orquestadores de datos. Útiles como referencia de
*idempotencia, reintentos y DAG declarativo*, pero su semántica (tareas de pipeline) no encaja con
un SOC local-first. Airflow es Apache-2.0; Kestra también Apache-2.0 y es el único con declarativo
YAML + retries + idempotencia que merece una lectura.

**Inngest** — SSPL-1.0: **source-available con cláusula de servicio** → no utilizable como
dependencia en un producto Apache-2.0 sin análisis de compatibilidad. Su modelo (funciones dirigidas por
eventos con `step.run()` reejecutable) sí es la referencia.

**Activepieces** — MIT (con `packages/ee/` comercial) y **escrito en TypeScript**, a diferencia de
n8n y Huginn. Buen candidato de integración por API/MCP para automatizaciones simples.

## Matriz de capacidades ##

| Capacidad de negocio | Proyecto de referencia que la resuelve bien | Patrón o ideas a extraer | ¿Nativa, integración o no? | Veredicto |
| --- | --- | --- | --- | --- |
| Registro de contactos y empresas | Twenty, Krayin | `Party` unificada con `kind` y `role` | Nativa (ya existe `crm/contacts`) | Reutilizar y extender, no duplicar |
| Pipeline de ventas | Twenty, Krayin | Oportunidad con etapa, valor y probabilidad | Nativa (ya existe `crm/deals`) | Reutilizar |
| Interacciones y línea de tiempo | Monica, Twenty | Interacción fechada y ligada a contacto | Nativa (ya existe `crm/interactions`) | Reutilizar |
| Bandeja omnicanal | Chatwoot | Conversación + canal + agente + estado | Integración (API/MCP) | Nivel C; no construir bandeja |
| Facturas y ciclos de cobro | Kill Bill, Crater | Factura en `DRAFT`, líneas tipadas, saldo derivado | Integración + proyección | Patrón de modelo; no motor de cobro |
| Cobro real | Stripe (SDK MIT), Lago, OpenMeter | MoR + webhooks de estado de pago | Integración (Nivel C) | Delegar; nunca automatizar el cargo |
| Presupuesto por envelopes | Actual Budget | Mes × categoría × (presupuestado, actividad, disponible) | Nativa (patrón) | **Primera capacidad** |
| Contabilidad de partida doble | Firefly III, Medici, Beancount | Hecho = par (cuenta origen, cuenta destino, importe, moneda) | Nativa (patrón mínimo) | Segunda capacidad; ~200 líneas |
| Plan de cuentas y categorías | Firefly III, Actual | `AccountType` como taxonomía cerrada | Nativa (ligera) | Sin libro oficial ni IVA |
| Reglas de categorización automática | Firefly III (`Rule`/`RuleTrigger`/`RuleAction`), Actual | Trigger + condiciones + acciones sobre hechos | Nativa (como Sub-Ego) | Tercer candidato |
| Catálogo de productos y servicios | ERPNext, Medusa, Bagisto | `Item` con tipo, precio y variantes | Nativa (mínima) | Sin checkout |
| Pedidos y compromisos | ERPNext, Medusa, Saleor | `Commitment` con estado y líneas | Nativa (mínima) | Sin pasarela de pago |
| Inventario y BOM | InvenTree, OpenWMS | Parte → BOM → ubicación → movimiento; saldo derivado | Integración (API REST de InvenTree) | No construir WMS |
| Activos y custodia | Snipe-IT | Activo con serie, garantía y custodio | Integración | No construir |
| Compras y proveedores | ERPNext, InvenTree | `Party` con `role: vendor` + pedido de compra | Nativa (mínima) | Misma entidad Party |
| Roadmap de producto | Plane, OpenSpec, Spec Kit | Épica → iniciativa → ciclo; spec como artefacto | Nativa (ya existe `product`) | Reutilizar `ProductDomain` |
| Desarrollo y repos | Gitea, GitLab, Forgejo (Codeberg) | Issues, MR, wiki | Integración (MCP GitHub ya existe) | Nivel B |
| Especificaciones de cambio | Spec Kit, OpenSpec | Delta por cambio con verificación | Nativa (patrón) | Barato y de alto valor |
| Automatización de tareas | n8n, Windmill, Activepieces | Grafo de nodos con triggers | Integración (MCP/API) | Nivel B; no motor propio en P0 |
| Ejecución durable | Temporal, Trigger.dev | Historial de decisiones + replay | Nativa (patrón, fases posteriores) | Extender `packages/tasks/` |
| BI y preguntas de gestión | Metabase, Baserow | Pregunta → consulta → respuesta sin SQL | Nativa (Sub-Ego de analítica) | Alto valor diferencial |
| Métricas y coste | OpenMeter (`openmeter/cost/`) | Evento de consumo → coste atribuido | Nativa (mide `AI Wallet`) | Medir, no cobrar |
| Wiki y documentos | Outline, Docmost, AppFlowy | Bloque + permiso por colección | No hacer | `packages/knowledge/` ya cubre |
| Portales de developer | Backstage | Catálogo de entidades con relaciones | Nativa (patrón) | Base del `SubEgoManifest` |
| Facturación por uso | OpenMeter, Lago | Meter + plan + línea de factura | Nativa (patrón) / Integración | Relevante para el SaaS de Ego |

## Modelo de dominio común ##

### Entidades universales ###

Al cruzar los siete dominios, seis grupos de entidades aparecen en todos o en casi todos los
proyectos: **Party** (persona u organización, con rol cliente/proveedor/empleado), **Item**
(producto, servicio o activo), **Commitment** (pedido, presupuesto, suscripción, contrato),
**MoneyFact** (factura, recibo, gasto o pago), **Account** (categoría contable o sobre de
presupuesto) y **Movement** (línea de inventario o asiento). Añado **Work** (tarea, épica,
iniciativa) porque es el equivalente en el lado del tiempo.

Las relaciones que se repiten, independientemente del subdominio:

- `Party --issues--> MoneyFact` (todo movimiento de dinero tiene un origen o un destinatario).
- `Item --appears in--> Commitment` y `Item --moves by--> Movement`.
- `Commitment --settled by--> MoneyFact`.
- `MoneyFact --posted to--> Account` (dos veces en partida doble: origen y destino).
- `Account --rolls up--> Period` (mes, trimestre, ejercicio).
- `Work --realizes--> Commitment` (una iniciativa es una promesa de valor).

### Subconjunto mínimo viable ###

El punto de partida de la investigación era "qué entidades debería soportar Ego". La respuesta
conservadora es: **ninguna nueva** en P0, y **cinco** en P1 como máximo.

| # | Entidad | Campos mínimos | Por qué es necesaria |
| --- | --- | --- | --- |
| 1 | `Party` | `id`, `kind` (persona/empresa), `name`, `role` (cliente/proveedor/ambos), `contacto`, `taxId?` | Unifica contacto, cliente, proveedor y organización |
| 2 | `Item` | `id`, `type` (producto/servicio/activo), `name`, `unit`, `price?`, `taxRate?` | Unifica catálogo, servicio y activo comprable |
| 3 | `Commitment` | `id`, `partyId`, `state` (borrador/confirmado/cumplido/cancelado), `lines[]`, `total`, `currency`, `dueDate?` | Unifica pedido, presupuesto y suscripción |
| 4 | `MoneyFact` | `id`, `kind` (factura/recibo/gasto/pago), `fromAccount`, `toAccount`, `amount` (tripleta), `currency`, `date`, `partyId?`, `commitmentId?`, `provenance` | Unifica las cuatro cosas que un fundador llama "dinero" |
| 5 | `Movement` | `id`, `itemId`, `qty`, `direction`, `location?`, `date`, `provenance` | Inventario y consumos |

Reglas transversales no negociables:

1. **El importe es siempre una tripleta `(valor, moneda, precisión)`**. No existe un `number` suelto
   para dinero. Ésta es la lección de `DefaultInvoice.java:70` (currency) y de la obligación de
   precisión decimal que Firefly resuelve con `BigDecimal` (`InvoiceItemBase.java:42`).
2. **Todo hecho lleva procedencia**: `source`, `ts`, `agent_id`, `confidence`, `state`. Esto ya es
   la metadata obligatoria de `docs/architecture/namespaces.md` §Metadata obligatoria, y es lo que
   convierte un dato de ERPNext en un *hecho de Ego* con trazabilidad.
3. **Nada se muta; se supersede**. La sustitución de un hecho genera un nuevo hecho que referencia al
   anterior (`SUPERSEDED_BY` ya existe como arista en VantaDB según `docs/architecture/namespaces.md`).
   Es el patrón de Beancount (ledger append-only) y de las versiones de Factura en Kill Bill.
4. **El saldo es derivado, nunca almacenado**. Se calcula a partir de los hechos. Kill Bill lo hace
   así en `DefaultInvoice.java:274-282`; Firefly III deriva el saldo de los splits.
5. **Escritura hacia fuera = HITL obligatorio**. Ningún Sub-Ego crea, modifica o borra un hecho
   económico en un sistema externo sin aprobación humana (principio 6).

Lo que **no** entra en el subconjunto mínimo: impuestos y IVA, cuentas anuales, planes de cuentas
legales, amortizaciones, devengo (contabilidad de devengo), multimoneda con posición de cambio,
nóminas, y todo el e-commerce (carrito, checkout, pasarela).

### Mapeo a los namespaces de VantaDB ###

Ego ya define namespaces para casi todo esto, y `packages/domains/` ya implementa dos dominios.
La regla de la jerarquía canónica es no duplicar.

| Entidad mínima | Namespace destino | Nota |
| --- | --- | --- |
| `Party` | `crm/contacts` | Ya existe `CrmContactSchema` (`packages/domains/src/crm/types.ts:3-13`) |
| `Commitment` | `crm/deals` | Ya existe `CrmDealSchema` (`packages/domains/src/crm/types.ts:27-37`) |
| Interacción | `crm/interactions` | Ya existe `CrmInteractionSchema` (`packages/domains/src/crm/types.ts:44-51`) |
| `Item` | `ecom/products` | Namespace declarado; **no hay dominio implementado** |
| `Commitment` comercial | `ecom/orders` | Namespace declarado; **no hay dominio implementado** |
| `MoneyFact` | `finance/transactions` | Namespace declarado; **no hay dominio implementado** |
| Proyecciones financieras | `finance/projections` | Namespace declarado; **no hay dominio implementado** |
| `Movement` | `ops/processes` o nuevo `ops/stock` | Namespace `ops/processes` declarado para procesos |
| `Account` | `finance/accounts` (nuevo) | No existe hoy |
| `Work` | `dev/issues` y `product` (dominio) | `ProductDomain` ya cubre backlog y épicas |

**Observación crítica y honesta**: `docs/architecture/namespaces.md` declara `ecom/*` y
`finance/*`, y el mapa de namespaces incluye aristas como `BOUGHT`, `BILLING_FOR` y
`HAS_CLIENT`, pero **`packages/domains/src/DomainRegistry.ts` sólo conoce cinco dominos**:
`engineering`, `product`, `knowledge`, `analytics` y `crm` (`packages/domains/src/types.ts:67-72`).
Es decir: **el backoffice financiero de Ego no existe**. No hay que "reutilizar" un dominio
financiero: hay que decidir si se crea.

Consecuencia práctica: el *namespace* `ecom/*` es un error de nomenclatura para un backoffice
general (asociar "pedido" a "e-commerce" es una contaminación). Y `finance/transactions` está
declarado pero sin schema, sin dominio y sin dominio canónico que lo respalde.

**Recomendación de mapeo**: no crear `biz/*` en P0. Crear, en P1, un único dominio canónico nuevo
— `finance` — que **absorba** `ecom/products` + `ecom/orders` + `finance/transactions` mediante
migración versionada de `ego.namespaces.json`, con las entidades `Item`, `Commitment` y `MoneyFact`.
`Account` y `Movement` pueden ir en `finance/accounts` y `finance/movements`. `Party` se queda en
`crm/contacts` (no se duplica). Esto respeta la regla de no duplicar namespaces y evita meter
"comercio" en un backoffice que no es una tienda.

## Decisión de diseño por subdominio ##

Formato: **(a) nativo en Ego**, **(b) integración MCP/API con app OSS**, **(c) no hacer**.
Esfuerzo: S ≈ 1 semana, M ≈ 2-3 semanas, L ≈ 4-6 semanas, XL ≈ >2 meses (una sola persona).

### Contactos, clientes y pipeline ###

**Decisión: (a) nativo, reutilizando lo existente.** `packages/domains/src/crm/` ya implementa
contactos, deals e interacciones con zod, y `crm/contacts`, `crm/deals` y `crm/interactions` ya son
namespaces canónicos. Lo único que falta es el campo `kind` (persona/empresa) y `role`
(cliente/proveedor) para poder absorber proveedores sin crear una segunda entidad. **Esfuerzo: S.**
Fundamento: es la única capacidad que el fundador usa a diario y donde la latencia local importa más
que la completitud funcional. No tiene sentido integrarlo con Twenty y mantenerlo en paralelo.

### CRM avanzado y bandeja omnicanal ###

**Decisión: (b) integración vía API/MCP con Chatwoot (MIT) o Krayin (MIT), y (c) no construir
bandeja.** **Esfuerzo: M** (conector + normalización a `Party` + `Interaction`).
Fundamento: la bandeja omnicanal es un problema de *mensajería*, no de razonamiento; el estado de
"respondedor" no aporta a un SOC. Si el usuario ya usa Chatwoot, el conector MCP es trivial y
ahorra horas al día.

### Presupuesto y cuentas ###

**Decisión: (a) nativo, patrón de Actual Budget.** **Esfuerzo: M.**
Fundamento: es la capacidad con mejor relación valor/complejidad del estudio (cinco entidades) y la
única que un fundador entiende sin formación contable. MIT y TypeScript: se puede reimplementar el
*modelo* sin tocar una línea de código de Actual. **No** se replica la UI de Actual; se expone vía
Canvas (`packages/domains/src/types.ts:15-27` ya declara `card`, `chart`, `table` como
`CanvasComponentKind`).

### Dinero y contabilidad ###

**Decisión: (a) nativo sólo el *subconjunto mínimo*** (`MoneyFact` + `Account` + saldo derivado) y
**(c) no hacer** contabilidad oficial, IVA, devengo ni libros anuales. **Esfuerzo: M.**
Fundamento: Ego necesita *saber* cuánto entra y sale para razonar; no necesita *certificar* saldos.
Firefly III, Medici y Beancount coinciden en el modelo de par origen/destino: es la forma más
barata y verificable. Lo que **no** se hace es la contabilidad fiscal, que requiere certificación
profesional y específica de cada jurisdicción (ver §Trade-offs).

### Facturación y cobros: decisión de diseño ###

**Decisión: (b) integración con Kill Bill (Apache-2.0) o Lago/OpenMeter vía API, y (c) no construir
motor de facturación ni pasarela.** **Esfuerzo: M** (normalizador de factura + evento de estado).
Fundamento: `docs/product/modelo-economico.md` §Facturación ya delega el cobro a un MoR externo;
sería incoherente que Ego implementase su propio cobro. La proyección `MoneyFact` sí es nativa.

### Inventario y activos ###

**Decisión: (b) integración con InvenTree (MIT) vía REST, y (c) no construir WMS.** **Esfuerzo: M**
(sólo si hay demanda). Fundamento: BOM, stocktake y ubicaciones son un ERP de inventario completo;
InvenTree es MIT, bien modelado y ya expone API REST. La proyección `Movement` en Ego es nativa y
ligera. **Nota**: si el usuario *no* tiene InvenTree, la `Item` + `Movement` nativos bastan para un
inventario simple; no hace falta recomendar instalación.

### Compras y proveedores ###

**Decisión: (a) nativo mínimo** (reutilizar `Party` con `role: vendor` + `Commitment` con tipo
compra) y **(c) no hacer** SRP, órdenes de compra con flujo de aprobación ni recepción de mercancía.
**Esfuerzo: S.** Fundamento: el 90 % del valor de "compras" para un fundador es *recordar qué y a
quién comprar*; eso lo resuelve `Party` + `Commitment` + `Task`, no un módulo de compras.

### Comercio y e-commerce ###

**Decisión: (c) no hacer** en el SOC; sólo **integración de lectura** con la API de la tienda
(Shopify, Bagisto, Medusa, WooCommerce). **Esfuerzo: S** por conector.
Fundamento: `docs/product/modulos.md` sitúa e-commerce en **P2**, y `AGENTS.md` §6 sitúa la Fase 09
(Dominios) tras las Fases 01-08. Construir catálogo+carrito+checkout en el SOC es el camino más
rápido a convertirse en un ERP malo.

### Gestión de producto y roadmap ###

**Decisión: (a) nativo, reutilizando `ProductDomain`** + patrón de Spec Kit/OpenSpec para los
deltas. **Esfuerzo: S** para los deltas, **M** si se integra Plane. Fundamento: `ProductDomain` ya
tiene `BacklogItem`, `Epic` y `ProductPrd` (`packages/domains/src/product/types.ts:16-61`) con
criterios de aceptación y métricas de éxito. **Integrar Plane (AGPL)** es razonable si el usuario
ya tiene equipo; para un fundador solo es sobreingeniería.

### Automatización y workflow ###

**Decisión: (b) integración vía MCP con n8n / Windmill / Activepieces para automatizaciones
externas, y (a) nativo sólo para el patrón de *ejecución durable*.** **Esfuerzo: S** para el
conector MCP; **L** para el runtime durable propio.
Fundamento: n8n tiene 208 095 estrellas y un servidor MCP; su catálogo de integraciones es un
activo que Ego no debe replicar. Pero n8n es source-available (Sustainable Use License): se
integra como *servicio*, nunca como dependencia embebida. Temporal (MIT) es la referencia para el
patrón de *historial de decisiones* que debería añadirse a los checkpoints de `packages/tasks/`.

### Analítica y preguntas de gestión ###

**Decisión: (a) nativo** como Sub-Ego de analítica sobre los hechos de `finance/*` y `crm/*`.
**Esfuerzo: M.** Fundamento: `packages/domains/src/analytics/AnalyticsDomain.ts` ya existe; lo que
falta es la fuente de datos. Ésta es la capacidad de mayor valor diferencial: ningún OSS de
backoffice responde "según lo que sé de ti, ¿qué deberías hacer la semana que viene?".

## Facturación y cobros ##

### Alternativas OSS del estado del arte ###

| Opción | Licencia | Modelo | Apropiado para Ego |
| --- | --- | --- | --- |
| [killbill/killbill](https://github.com/killbill/killbill) | Apache-2.0 | Invoice → InvoiceItem → InvoicePayment; `InvoiceStatus`; saldo derivado; clock de recurrencia | Referencia de modelo y opción de integración real |
| [openmeterio/openmeter](https://github.com/openmeterio/openmeter) | Apache-2.0 | Meter + Plan + Subscription + línea de factura (`lineengine/`) | Billing por uso; el modelo natural de un SaaS |
| [getlago/lago](https://github.com/getlago/lago) | AGPL-3.0 | API de suscripción y facturación | Sólo API |
| [crater-invoice-inc/crater](https://github.com/crater-invoice-inc/crater) | AGPL-3.0 | Facturas, gastos, clientes | Dormido desde 2024-08-10 |
| [invoiceninja/invoiceninja](https://github.com/invoiceninja/invoiceninja) | Elastic License 2.0 | Facturas, propuestas, pagos | Source-available: integración sólo |
| [stripe/stripe-node](https://github.com/stripe/stripe-node) | MIT | SDK del proveedor de pagos | Vía Nivel C para el cargo real |

### El problema de la autorización de pago ###

Éste es el punto donde un backoffice "inteligente" se vuelve peligroso, y donde Ego tiene una
ventaja estructural que ningún OSS tiene: **Ego ya tiene un motor de aprobación HITL**
(`packages/execution/` → `ApprovalEngine`) y una pista de auditoría inmutable (`gov/audit`).

El problema, enunciado con precisión:

1. **Un cobro es un acto externo irreversible y con efecto económico sobre un tercero.** Emitir un
   cargo equivocado a un cliente cuesta dinero, confianza y litigio. No es un error de software: es
   un error *de negocio* que el modelo no puede detectar por sí mismo.
2. **Un LLM puede querer cobrar.** Un Sub-Ego que "cierra el mes y emite facturas" es un agente que
   decide cantidades y destinatarios a partir de un contexto lingüístico ambiguo. El contexto puede estar
   desactualizado, el precio puede haber cambiado, el cliente puede haber cancelado.
3. **La asimetría es total.** El coste de una aprobación extra es de segundos; el coste de un cargo
   incorrecto es de meses.

Por tanto, la regla que Ego debe implementar (y que este informe recomienda elevar a ADR):

> **Ningún Sub-Ego puede iniciar, modificar ni revertir un movimiento de dinero externo sin
> aprobación humana explícita y trazable.** El agente puede *preparar* (draft), *simular*, *explicar*
> y *programar*, pero el acto de commit externo exige confirmación del usuario, con el importe, la
> moneda, el destinatario y el efecto esperado visibles en la propia confirmación.

Corolarios de diseño:

- **Separar "preparar" de "comprometer".** El modelo de Kill Bill lo resuelve con `InvoiceStatus`:
  una factura nace `DRAFT` (`DefaultInvoice.java:102`) y sólo pasa a `COMMITTED` cuando se emite.
  Ego debe copiar ese patrón: **el hecho económico externo sólo existe tras el commit**.
- **Idempotencia obligatoria.** Cada propuesta de cobro lleva una clave de idempotencia derivada del
  compromiso (no del timestamp), para que un reintento no duplique el cargo. Es el requisito que
  Activepieces, Trigger.dev y Kestra resuelven en sus *workers* (`openmeter/billing/worker/`).
- **Revocabilidad por compensación, no por borrado.** Si hay que corregir un cargo, se emite su
  reverso (nota de crédito / refund), nunca se borra el original. Es el patrón de `CreditAdjInvoiceItem`
  en Kill Bill y de `SUPERSEDED_BY` en VantaDB.
- **Nunca almacenar credenciales de cobro en Ego.** `packages/security/` (CredentialManager,
  SecretsFilter) y `AGENTS.md` §Seguridad ya lo exigen.
- **El webhook es la fuente de verdad del estado de pago**, no la llamada de Ego. Es lo que ya hace
  `docs/product/modelo-economico.md` §Facturación con el MoR.

Lo que Ego **sí** puede automatizar sin aprobación: recordatorios de cobro, conciliación
transaccional (comparar movimientos del banco con `MoneyFact`), detección de discrepancias,
previsiones de flujo de caja y propuesta de vencimientos.

## Trade-offs y riesgos ##

### Datos sensibles ###

Un backoffice concentra datos que no existían en un SOC: datos fiscales, banquarios, contratos y
salarios. Ego es local-first y el principio 9 garantiza propiedad y exportación, lo cual es una
ventaja competitiva real frente a un ERP en la nube. Pero:

- La **memoria de Ego es un grafo con recuperación semántica**. Un `MoneyFact` con el IBAN o el
  número de cuenta dentro de la descripción es un secreto en texto plano indexado y potencialmente
  enviado a un proveedor de inferencia. Debe pasar por `SecretsFilter` antes de ingestarse.
- El **contexto que se envía a los modelos** incluye datos de clientes. Es el mismo riesgo que en
  cualquier RAG con datos personales, pero aquí hay dinero de por medio.
- **El backup/exportación** (`packages/recovery/`) debe incluir los hechos financieros, lo que
  amplía el impacto de una filtración local.

### Contabilidad fiscal ###

Éste es el riesgo con más consecuencias legales y el que más conviene delimitar:

- Ningún motor OSS del estudio está certificado para libros oficiales en la mayoría de
  jurisdicciones. **Ego debe producir informes de gestión, nunca libros contables.**
- Los conceptos que un ERP fiscal exige y que Ego no debe implementar: IVA indirecto por ubicación,
  prorrata, retención, autenticidad de facturas (facturae, SAF-T, FatturaPA), numeración correlativa
  con control de saltos, retención de datos fiscales (España: 5 años; en general de 4 a 10 años según
  país).
- **Veredicto**: Ego se posiciona como *ledger de gestión y copiloto*, y en la UI debe decir
  explícitamente que sus cifras no son contabilidad oficial.

### Licencias ###

| Nivel | Licencia | proyectos del estudio | Efecto para Ego (Apache-2.0) |
| --- | --- | --- | --- |
| Copyleft fuerte | AGPL-3.0 | Twenty, Plane, Firefly III, Docmost, Leantime, EspoCRM, Zammad, FreeScout, SuiteCRM, Monica, Lago, BigCapital, Metabase, Automatisch, AppFlowy | Integrar por API/MCP sólo. Nunca copiar código a Ego |
| Copyleft moderado | GPL-3.0 / GPL-2.0 | ERPNext, Redmine, OpenProject, Dolibarr, PartKeepr, Beancount, WooCommerce, GNU Cash | Igual que AGPL para efectos practicalos |
| Copyleft débil | LGPL-3.0 | Odoo | Reutilización con condiciones; aquí no aplica |
| Copyleft de archivo | MPL-2.0 | Taiga | Copyleft a nivel de archivo: reutilización posible manteniendo las cabeceras |
| Copyleft débil | EPL-1.0 | OpenBoxes | Igual que MPL |
| Permisivo | MIT, Apache-2.0, BSD-3, ISC | Medusa, Actual, Fava, Medici, Frappe, Kill Bill, OpenMeter, Temporal, node-red, Backstage, Kestra, Airflow, Dagster, Prefect, Trigger.dev, InvenTree, OpenWMS, Sylius, Bagisto, Krayin, Chatwoot, ihatemoney, Baserow OSE, Spec Kit, OpenSpec, Gitea, Stripe SDK | Código reutilizable con atribución |
| Source-available | SSPL-1.0, ELv2, BSL-1.1, FSL-1.1, Sustainable Use License, MSCL-1.0-GPL, NocoBase License | Inngest, Invoice Ninja, Outline, Typebot, n8n, Directus, NocoBase | **No** es open source OSI: integración como servicio o descartado |

Nota sobre Directus: el cambio a MSCL-1.0-GPL (2026) es el hecho de licencia más relevante del
estudio para cualquier plan que lo integre como dependencia embebida, y lo coloca fuera del conjunto
"open source" pese a su fama.

### Multi-tenant y aislamiento ###

- Los ERP multi-tenant reales (Odoo, Twenty, Saleor, Medusa) resuelven el aislamiento con
  *schema-per-tenant* o *row-level security*. Ego resuelve el aislamiento con **namespaces** por
  dominio y `egos/<id>/*` por Sub-Ego, y con un modelo de *workspace* que replica Twenty
  (`workspace-manager/`, `workspace-migration/`).
- **Riesgo**: si un mismo usuario gestiona dos empresas (p. ej. una sociedad limitada y una actividad freelance), el
  modelo de "un proyecto = un workspace" de Ego debe sostenerse. No está resuelto en el Backlog
  canónico y es una pregunta abierta (§10).
- **Riesgo de fugas entre workspaces**: con búsqueda híbrida y GraphRAG, un índice mal segmentado
  mezcla datos de dos empresas. Es un requisito de verificación para `searchMulti` multi-namespace.

### Coste de oportunidad y sobreingeniería ###

El mayor riesgo no es técnico: es **construir un ERP mediocre**. Un ERP que no sirve para la
declaración de impuestos es peor que no tenerlo, porque genera confianza falsa. La disciplina que
propone este informe es:

1. Empezar por **preguntas**, no por entidades: ¿cuánto entra? ¿qué está vencido? ¿qué prometí?
2. Cada entidad nueva requiere un **ADR** que justifique por qué no se integra.
3. Todo lo que se construya nativamente debe funcionar **sin conexión** y **sin servicios externos**.

## Recomendación para Ego ##

### Fase 0 — Ahora (sin código nuevo): el contrato de integración ###

Objetivo: poder *leer* un backoffice existente sin construir nada.

- Definir el **contrato de proyección**: qué entidades de `MoneyFact`, `Party`, `Item` y
  `Commitment` produce Ego y con qué `provenance` (`source`, `ts`, `agent_id`, `confidence`, `state`).
- Escribir los **conectores MCP de lectura** para ERPNext/Frappe (REST + DocType JSON), Twenty
  (GraphQL), Plane (REST) e InvenTree (REST). Esfuerzo: **M** cada uno, reutilizando
  `packages/integrations/`.
- **Esfuerzo total: L**. Sin dominio nuevo. Es la fase que más reduce el riesgo y la que menos
  contamina.

### Fase 1 — El presupuesto que un fundador entiende ###

Objetivo: la primera capacidad **nativa** que aporta valor sin integraciones.

- Implementar el **modelo de envelopes** de Actual Budget: `Account`, `AccountGroup`, `Category`,
  `CategoryGroup`, `Payee` y la tabla mes × categoría con (presupuestado, actividad, disponible) y
  rollover.
- Exponerlo como dominio canónico nuevo (**`finance`**) con sus namespaces, **migrando** `ecom/*`
  y `finance/*` a `finance/*` versionado en `ego.namespaces.json`.
- **Esfuerzo: M**. Dependencia: decidir la pregunta §10.1 (¿se crea el dominio `finance` o se
  extiende `crm`?).

### Fase 2 — El libro de dinero mínimo ###

Objetivo: que Ego sepa responder "¿cuánto tengo y de dónde viene?".

- Implementar `MoneyFact` como hecho append-only con par (origen, destino, importe tripleta,
  moneda) y **saldo derivado** (patrón Firefly III/Medici/Kill Bill).
- Añadir el **motor de categorización automática** como Sub-Ego con el patrón
  `Rule`/`RuleTrigger`/`RuleAction` de Firefly III.
- **Esfuerzo: M**. Dependencia: Fase 1.

### Fase 3 — Preguntas de gestión (el diferencial del SOC) ###

Objetivo: la capacidad que ningún OSS de backoffice da.

- Sub-Ego de analítica sobre `finance/*` + `crm/*` que responde preguntas de gestión
  ("¿en qué gasté más este trimestre?", "¿qué clientes están en riesgo?", "¿puedo permitirme
  contratar?").
- Usar `packages/domains/src/analytics/AnalyticsDomain.ts` y `packages/dailystate/` para el
  briefing.
- **Esfuerzo: M**.

### Fase 4 — Commitments y العمل ###

Objetivo: unificar "lo que prometo" (pedidos, suscripciones) y "lo que hago" (tareas, épicas).

- `Item` + `Commitment` nativos, con `Party` reutilizado de `crm/contacts` extendida con
  `kind`/`role`.
- Specs por delta (Spec Kit/OpenSpec) como artefacto de primera clase en `ProductDomain`.
- **Esfuerzo: M**.

### Fase 5 — Durabilidad y automatización ###

Objetivo: que las automatizaciones de negocio sobrevivan a un crash y sean auditables.

- Extender `packages/tasks/` con **historial de decisiones** en los checkpoints (patrón Temporal) y
  con idempotencia por clave.
- Conector MCP a n8n/Windmill/Activepieces para automatizaciones externas.
- **Esfuerzo: L**.

### Qué se haría primero, en una frase ###

1. **Conectores de lectura MCP** (Fase 0) — porque son la forma más barata de validar la demanda
   real sin escribir una sola entidad de negocio nueva.
2. **Presupuesto por envelopes** (Fase 1) — la primera capacidad nativa con valor inmediato.
3. **Libro de dinero mínimo** (Fase 2) — porque sin saldo fiable ninguna pregunta de gestión tiene
   sentido.

Y explícitamente **no** en el horizonte del SOC: contabilidad fiscal oficial, checkout, WMS,
nóminas y motor de workflow propio.

## Deuda abierta y preguntas para el owner ##

1. **¿Existe un dominio `finance` en Ego, o el backoffice financiero se queda fuera del producto?**
   `docs/architecture/namespaces.md` declara `finance/transactions`, `finance/projections` y
   `ecom/*`, pero `packages/domains/src/types.ts:67-72` sólo registra cinco dominios y ninguno es
   financiero. Hay que decidir antes de escribir código: crear un dominio canónico `finance`
   (recomendado) o confirmar que los namespaces `finance/*` y `ecom/*` son reservas del Backlog
   Master y se quedan vacías.
2. **¿Se renombran `ecom/products` y `ecom/orders`?** Asociar "pedido" a "e-commerce" es
   contaminación de nomenclatura. La migración de `ego.namespaces.json` (fichero versionado) tiene
   coste de deuda de migración en `packages/recovery/`. ¿Se acepta ese coste ahora o se espera?
3. **¿El alcance de "un fundador solo" incluye una entidad legal única con varios
   workspaces?** Si un usuario puede llevar dos negocios, hace falta el concepto de *workspace*
   distinto del de *proyecto*, y eso no está en el modelo de namespaces actual.
4. **Fiscalidad**: ¿Ego se posiciona explícitamente como herramienta de gestión sin valor contable
   oficial? Si la respuesta es sí, hay que redactar el descargo en la UI de `finance/*` y en la
   documentación de usuario. Si la respuesta es "no", el alcance del proyecto es otro y esta
   investigación no aplica.
5. **Proveedor de cobro**: `docs/product/modelo-economico.md` §Facturación delega en un MoR
   (Paddle o Lemon Squeezy) para la facturación *de Ego como producto*. ¿Es el mismo MoR el que
   cobraría a los *usuarios de Ego* por sus clientes, o son dos flujos distintos con dos
   integraciones? La diferencia cambia si Kill Bill/OpenMeter entran o no.
6. **Alcance de la proyección**: ¿Ego almacena una copia de los datos del ERP del usuario, o los
   consulta bajo demanda y cachea? La primera es local-first de verdad; la segunda es un problema
   de invalidación y de credenciales.
7. **Prioridad entre "backoffice de negocio" y "backoffice de equipo"**: el arranque del SOC es
   un fundador solo, pero `docs/product/modelo-economico.md` §Dimensión de los planes ya contempla
   asientos de equipo. ¿Se diseña `Party`/`Commitment` multi-usuario desde el principio o se pospone?
8. **n8n como motor de automatizaciones**: su licencia Sustainable Use License impide embebirlo, y
   su catálogo de integraciones es su activo real. ¿Se integra vía MCP (servicio autoalojado) o se
   asume que el usuario ya tiene n8n? La alternativa Windmill (Apache-2.0 + AGPL en frontend) es
   más limpia desde el punto de vista de licencia pero más pequeña en integraciones.
9. **Directus**: con el cambio a MSCL-1.0-GPL, queda fuera del conjunto open source. ¿Se mantiene
   como referencia de diseño (permitido) o se elimina de `repos-referencia/` y de las fichas
   Extraer?

### Nota de no verificación ###

Los siguientes elementos del encargo **no pudieron verificarse** y no tienen ficha: `Kill The
Zitter`, `Biggest`, `Medici` como proyecto de finanzas (la web sólo devuelve
[flash-oss/medici](https://github.com/flash-oss/medici), que sí está verificado), `front/front`
(repositorio inexistente), `chatra/chatra` (módulo residual de 8 estrellas) y `peppermint/peppermint`
(existe, pero con 0 estrellas, sin licencia y sin push desde 2019-08-14). Forgejo no está en GitHub:
su sede canónica es
[codeberg.org/forgejo/forgejo](https://codeberg.org/forgejo/forgejo) (5 681 estrellas).

---

## Verificación de datos (2026-10-20) ##

Auditoría independiente de este informe. Los 73 repositorios de GitHub citados
se reconsultaron en `GET /repos/{owner}/{repo}` de la API REST de GitHub el
2026-10-20 y se compararon `stargazers_count`, `pushed_at`,
`license.spdx_id`, `language` y `archived`. Las licencias dudosas
(`NOASSERTION`) se resolvieron leyendo el fichero de licencia de la raíz en
`raw.githubusercontent.com`. Forgejo se verificó contra la API de Codeberg.
Las rutas internas de Ego se comprobaron contra el árbol local; las rutas de
repositorios externos no clonados quedan marcadas como no verificadas.

| Dato verificado | Valor declarado | Valor real | Fuente | Estado |
| --- | --- | --- | --- | --- |
| `odoo/odoo` — estrellas, licencia, lenguaje | 55 171 · LGPL-3.0 (núcleo) + Enterprise · Python | 55 171 · LGPL-3.0 en el `LICENSE` (API `NOASSERTION`) · Python | API + `LICENSE` | Correcto |
| `frappe/erpnext` — estrellas | 40 381 | 40 382 | API `stargazers_count` | Corregido |
| `frappe/frappe` — estrellas, licencia, lenguaje | 10 964 · MIT · Python | 10 964 · MIT · Python | API | Correcto |
| `medusajs/medusa` — estrellas | 36 815 | 36 816 | API `stargazers_count` | Corregido |
| `medusajs/medusa` — licencia | MIT + EE | MIT salvo `ENTERPRISE-LICENSE.md` | `LICENSE` | Correcto |
| `saleor/saleor` — lenguaje | Python/TS | Python | API `language` | Corregido |
| `vendure-ecommerce/vendure` — licencia | GPL-3.0 (Community) + Enterprise | GPLv3 (Community Edition) + Vendure Commercial License | `LICENSE.md` | Corregido |
| `nocobase/nocobase` — estrellas | 24 633 | 24 634 | API `stargazers_count` | Corregido |
| `nocobase/nocobase` — licencia | NocoBase License (BSL-like) | NocoBase License Agreement en `LICENSE.txt` | `LICENSE.txt` | Correcto |
| `directus/directus` — estrellas | 38 621 | 38 622 | API `stargazers_count` | Corregido |
| `directus/directus` — licencia | MSCL-1.0-GPL (no OSI) | Monospace Sustainable Core License 1.0 en el fichero `license` (minúscula); API `NOASSERTION` | `license` | Correcto |
| `twentyhq/twenty` — estrellas | 58 650 | 58 652 | API `stargazers_count` | Corregido |
| `twentyhq/twenty` — licencia | AGPL-3.0 | AGPL-3.0 (con excepciones de licencia comercial) | `LICENSE` | Correcto |
| `makeplane/plane` — lenguaje | TypeScript + Python | TypeScript | API `language` | Corregido |
| `AppFlowy-IO/AppFlowy` — lenguaje | Rust/TypeScript | Dart | API `language` | Corregido |
| `docmost/docmost` — estrellas, licencia, lenguaje | 22 039 · AGPL-3.0 · TypeScript | 22 039 · AGPL-3.0 · TypeScript | API | Correcto |
| `outline/outline` — licencia | BSL-1.1 | Business Source License 1.1 | `LICENSE` | Correcto |
| `taigaio/taiga-back` — estrellas, licencia, lenguaje | 859 · MPL-2.0 · Python/Django | 859 · MPL-2.0 · Python | API | Correcto |
| `redmine/redmine` — licencia | GPL-2.0 | GPL-2.0 en `LICENSE.txt` | `LICENSE.txt` | Correcto |
| `opf/openproject` — estrellas | 16 493 | 16 494 | API `stargazers_count` | Corregido |
| `Leantime/leantime` — estrellas, licencia, lenguaje | 11 869 · AGPL-3.0 · PHP | 11 869 · AGPL-3.0 · PHP | API | Correcto |
| `dolibarr/dolibarr` — estrellas, licencia, lenguaje | 7 752 · GPL-3.0 · PHP | 7 752 · GPL-3.0 · PHP | API | Correcto |
| `chatwoot/chatwoot` — estrellas | 37 985 | 37 987 | API `stargazers_count` | Corregido |
| `chatwoot/chatwoot` — licencia y lenguaje | MIT + `enterprise/` · Ruby/Vue | MIT salvo `enterprise/` · Ruby | `LICENSE` + API | Corregido |
| `monicahq/monica` — estrellas, licencia, lenguaje | 25 506 · AGPL-3.0 · PHP | 25 506 · AGPL-3.0 · PHP | API | Correcto |
| `krayin/laravel-crm` — estrellas, licencia, lenguaje | 24 029 · MIT · PHP | 24 029 · MIT · PHP | API | Correcto |
| `baptisteArno/typebot.io` — licencia | FSL-1.1-Apache-2.0 | FSL-1.1-Apache-2.0 | `LICENSE` | Correcto |
| `zammad/zammad` — lenguaje | PHP | Ruby | API `language` | Corregido |
| `SuiteCRM/SuiteCRM` — estrellas, licencia, lenguaje | 5 802 · AGPL-3.0 · PHP | 5 802 · AGPL-3.0 · PHP | API | Correcto |
| `freescout-helpdesk/freescout` — estrellas, licencia, lenguaje | 4 603 · AGPL-3.0 · PHP | 4 603 · AGPL-3.0 · PHP | API | Correcto |
| `espocrm/espocrm` — estrellas, licencia, lenguaje | 3 498 · AGPL-3.0 · PHP | 3 498 · AGPL-3.0 · PHP | API | Correcto |
| `civicrm/civicrm-core` — estrellas, licencia, lenguaje | 787 · AGPL-3.0 · PHP | 787 · AGPL-3.0 · PHP | API | Correcto |
| `chatr/chatra` — lenguaje | PHP | JavaScript | API `language` | Corregido |
| `front/front` — existencia | 404 | 404 | API `GET /repos/...` | Correcto |
| `peppermint/peppermint` — estrellas, licencia, push | no verificado | 0 estrellas · sin SPDX · push 2019-08-14 | API | Corregido |
| `maybe-finance/maybe` — estrellas, licencia, estado | 54 214 · AGPL-3.0 · archivado, push 2025-07-24 | 54 214 · AGPL-3.0 · `archived: true`, push 2025-07-24 | API | Correcto |
| `actualbudget/actual` — estrellas, licencia, lenguaje | 29 623 · MIT · TypeScript | 29 623 · MIT · TypeScript | API | Correcto |
| `firefly-iii/firefly-iii` — estrellas | 24 947 | 24 946 | API `stargazers_count` | Corregido |
| `firefly-iii/firefly-iii` — lenguaje | PHP/Laravel | PHP | API `language` | Corregido |
| `invoiceninja/invoiceninja` — licencia | Elastic License 2.0 | Elastic License 2.0 | `LICENSE` | Correcto |
| `crater-invoice-inc/crater` — estrellas, licencia, push | 8 355 · AGPL-3.0 · 2024-08-10 | 8 355 · AGPL-3.0 · 2024-08-10 | API | Correcto |
| `beancount/beancount` — estrellas, licencia, lenguaje | 6 101 · GPL-2.0 · Python | 6 101 · GPL-2.0 · Python | API | Correcto |
| `ledger/ledger` — lenguaje | C | C++ | API `language` | Corregido |
| `gnucash/gnucash` — licencia | GPL-2.0/3 | GPL-2.0 o, a elección, GPL-3 | `LICENSE` | Correcto |
| `bigcapitalhq/bigcapital` — estrellas, licencia, lenguaje | 3 947 · AGPL-3.0 · TypeScript | 3 947 · AGPL-3.0 · TypeScript | API | Correcto |
| `beancount/fava` — estrellas, licencia, lenguaje | 2 593 · MIT · Python | 2 593 · MIT · Python | API | Correcto |
| `spiral-project/ihatemoney` — licencia | AGPL-3.0 | BSD-3-Clause | `LICENSE` | Corregido |
| `flash-oss/medici` — estrellas, licencia, lenguaje | 360 · MIT · TypeScript | 360 · MIT · TypeScript | API | Correcto |
| `snipe/snipe-it` — estrellas, licencia, lenguaje | 15 052 · AGPL-3.0 · PHP | 15 052 · AGPL-3.0 · PHP | API | Correcto |
| `Inventree/InvenTree` — estrellas, licencia, lenguaje | 7 736 · MIT · Python | 7 736 · MIT · Python | API | Correcto |
| `openboxes/openboxes` — lenguaje | Java | Groovy | API `language` | Corregido |
| `PartKeepr/PartKeepr` — lenguaje y estado | PHP · push 2023-01-10 | JavaScript · `archived: true`, push 2023-05-30 | API | Corregido |
| `openwms/org.openwms` — estrellas, licencia, lenguaje | 750 · Apache-2.0 · Java | 750 · Apache-2.0 · Java | API | Correcto |
| `bagisto/bagisto` — estrellas, licencia, lenguaje | 28 259 · MIT · PHP | 28 259 · MIT · PHP | API | Correcto |
| `woocommerce/woocommerce` — licencia | GPL-2.0+ | GPL-2.0-or-later en `license.txt` | `license.txt` | Correcto |
| `getlago/lago` — lenguaje | Ruby | Go | API `language` | Corregido |
| `Sylius/Sylius` — estrellas, licencia, lenguaje | 8 560 · MIT · PHP | 8 560 · MIT · PHP | API | Correcto |
| `killbill/killbill` — estrellas, licencia, lenguaje | 5 806 · Apache-2.0 · Java | 5 806 · Apache-2.0 · Java | API | Correcto |
| `stripe/stripe-node` — estrellas, licencia, lenguaje | 4 534 · MIT · TypeScript | 4 534 · MIT · TypeScript | API | Correcto |
| `openmeterio/openmeter` — estrellas, licencia, lenguaje | 2 392 · Apache-2.0 · Go | 2 392 · Apache-2.0 · Go | API | Correcto |
| `github/spec-kit` — estrellas | 142 011 | 142 012 | API `stargazers_count` | Corregido · unificado con `plantillas-agentes-y-enjambres.md` (141 994) |
| `github/spec-kit` — lenguaje | Python/TypeScript | Python | API `language` | Corregido |
| `Fission-AI/OpenSpec` — estrellas | 72 474 | 72 476 | API `stargazers_count` | Corregido |
| `go-gitea/gitea` — estrellas | 58 581 | 58 582 | API `stargazers_count` | Corregido |
| `gitlabhq/gitlabhq` — lenguaje | Ruby/TS | Ruby | API `language` | Corregido |
| `gitlabhq/gitlabhq` — licencia | MIT + `ee/` | MIT salvo `doc/` (CC BY) | `LICENSE` | Correcto |
| `backstage/backstage` — estrellas, licencia, lenguaje | 34 668 · Apache-2.0 · TypeScript | 34 668 · Apache-2.0 · TypeScript | API | Correcto |
| `metabase/metabase` — estrellas | 49 752 | 49 753 | API `stargazers_count` | Corregido |
| `metabase/metabase` — lenguaje | Java/TypeScript | Clojure | API `language` | Corregido |
| `baserow/baserow` — licencia | Sustainable Use License | MIT Expat en la OSE; `premium/` y `enterprise/` con licencia propia | `LICENSE` | Corregido |
| `n8n-io/n8n` — estrellas | 208 093 | 208 095 | API `stargazers_count` | Corregido · unificado con `plantillas-agentes-y-enjambres.md` (208 014) y `automatizacion-y-agentes-ejecucion.md` (208 093) |
| `huginn/huginn` — estrellas, licencia, lenguaje | 50 083 · MIT · Ruby | 50 083 · MIT · Ruby | API | Correcto |
| `apache/airflow` — estrellas | 47 222 | 47 223 | API `stargazers_count` | Corregido |
| `kestra-io/kestra` — estrellas, licencia, lenguaje | 29 901 · Apache-2.0 · Java | 29 901 · Apache-2.0 · Java | API | Correcto |
| `activepieces/activepieces` — licencia | MIT + `ee/` | MIT salvo `packages/ee/` | `LICENSE` | Correcto |
| `temporalio/temporal` — lenguaje | Go/TypeScript | Go | API `language` | Corregido |
| `node-red/node-red` — estrellas, licencia, lenguaje | 23 762 · Apache-2.0 · JavaScript | 23 762 · Apache-2.0 · JavaScript | API | Correcto |
| `PrefectHQ/prefect` — estrellas, licencia, lenguaje | 24 043 · Apache-2.0 · Python | 24 043 · Apache-2.0 · Python | API | Correcto |
| `windmill-labs/windmill` — lenguaje | TypeScript/Go | Rust | API `language` | Corregido · unificado con `automatizacion-y-agentes-ejecucion.md` (Rust) |
| `triggerdotdev/trigger.dev` — estrellas, licencia, lenguaje | 16 584 · Apache-2.0 · TypeScript | 16 584 · Apache-2.0 · TypeScript | API | Correcto |
| `automatisch/automatisch` — lenguaje | TypeScript | JavaScript | API `language` | Corregido |
| `automatisch/automatisch` — licencia | AGPL-3.0 + EE | AGPL-3.0 salvo ficheros `.ee.` | `LICENSE` | Correcto |
| `inngest/inngest` — lenguaje | TypeScript | Go | API `language` | Corregido · unificado con `automatizacion-y-agentes-ejecucion.md` (Go) |
| `inngest/inngest` — licencia | SSPL-1.0 | SSPL-1.0 + Apache 2.0 Future License | `LICENSE.md` | Correcto |
| `codeberg.org/forgejo/forgejo` — estrellas | 5 680 | 5 681 | API de Codeberg | Corregido |
| `github.com/forgejo/forgejo` — existencia | 404 | 404 | HTTP | Correcto |
| `packages/domains/src/types.ts:15-27` — `CANVAS_COMPONENT_KINDS` | `card`, `chart`, `table` | líneas 15-27 | lectura local | Correcto |
| `packages/domains/src/types.ts:50-66` — `DomainView` y manifiesto | líneas 50-66 | líneas 34-60 (`DomainView` en 34-43, `DomainDefinition` en 48-60) | lectura local | Corregido |
| `packages/domains/src/types.ts:67-72` — dominios canónicos | cinco dominios | cinco dominios (engineering, product, knowledge, analytics, crm) | lectura local | Correcto |
| `packages/domains/src/DomainRegistry.ts` — dominios registrados | cinco | cinco | lectura local | Correcto |
| `packages/domains/src/crm/types.ts:3-13`, `:27-37`, `:44-51` | `CrmContactSchema`, `CrmDealSchema`, `CrmInteractionSchema` | líneas 3, 27 y 44 | lectura local | Correcto |
| `packages/domains/src/product/types.ts:16-61` | `BacklogItem`, `Epic`, `ProductPrd` | líneas 16, 34 y 47 | lectura local | Correcto |
| `packages/domains/src/analytics/AnalyticsDomain.ts` | existe | existe | árbol local | Correcto |
| `docs/architecture/namespaces.md` — namespaces `ecom/*` y `finance/*`, §Metadata obligatoria, aristas `BOUGHT`, `BILLING_FOR`, `HAS_CLIENT` | declarados | presentes | lectura local | Correcto |
| `docs/product/modelo-economico.md` §Facturación — delegación en un MoR | declarado | presente | lectura local | Correcto |
| `docs/product/modulos.md` — e-commerce en P2 | declarado | presente | lectura local | Correcto |
| `Kill The Zitter` — existencia | no localizable | no localizable por nombre ni por búsqueda en la API | `search/repositories` | No verificado (2026-10-20) |
| `Biggest` — existencia | no localizable | no localizable por nombre ni por búsqueda en la API | `search/repositories` | No verificado (2026-10-20) |
| Rutas y líneas de repos externos (`medusajs/medusa`, `frappe/frappe`, `directus/directus`, `twentyhq/twenty`, `makeplane/plane`, `nocobase/nocobase`, `actualbudget/actual`, `firefly-iii/firefly-iii`, `Inventree/InvenTree`, `killbill/killbill`, `openmeterio/openmeter`, `node-red/node-red`) | declaradas | no comprobables en local | repos no clonados | No verificado (2026-10-20) |
| Recuentos de "400+ integraciones" (n8n), "~400 servidores MCP" (Activepieces) y "869 líneas" (`Flow.js` de node-red) | declarados | sin fuente verificable | — | No verificado (2026-10-20) |

Notas de la auditoría:

- Ningún repositorio citado en las siete tablas resultó inexistente salvo
  `front/front`, que se declara 404 en el propio informe. Forgejo no está en
  GitHub y su cifra se verificó contra Codeberg.
- Tres licencias estaban mal atribuidas y se corrigen:
  `spiral-project/ihatemoney` (BSD-3-Clause, no AGPL-3.0), `baserow/baserow`
  (MIT Expat en la OSE, no Sustainable Use License) y
  `vendure-ecommerce/vendure` (Vendure Commercial License en la edición
  comercial, no "Enterprise" genérico).
- Ocho lenguajes estaban mal: `AppFlowy-IO/AppFlowy` (Dart, no Rust),
  `zammad/zammad` (Ruby, no PHP), `openboxes/openboxes` (Groovy, no Java),
  `PartKeepr/PartKeepr` (JavaScript, no PHP), `getlago/lago` (Go, no Ruby),
  `metabase/metabase` (Clojure, no Java/TypeScript), `chatr/chatra` (JavaScript,
  no PHP) e `inngest/inngest` (Go, no TypeScript).
- `windmill-labs/windmill` es Rust: este informe decía TypeScript/Go y el
  informe de automatización decía Rust. Se unifica en Rust.

**Recuento**: 96 cifras verificadas · 38 corregidas · 4 marcadas "no
verificado".
