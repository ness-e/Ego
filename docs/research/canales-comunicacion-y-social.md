# Canales de comunicación, contactos, redes sociales y automatización de mensajería ##

| Campo | Valor |
| --- | --- |
| Estado | Research — material de referencia, **no normativo** |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Alcance | Qué canales de comunicación puede **operar** un SOC local-first con aprobación humana, con qué límites y con qué riesgo |
| Fuentes primarias | GitHub REST API (`gh api repos/<org>/<repo>`), repositorios oficiales, código fuente de los proyectos evaluados |
| Documento complementario | `docs/engineering/integraciones.md` (modelo de integraciones ya decidido en Ego) |
| Regla de no contaminación | Este informe **no** propone construir un CRM ni una suite de marketing; propone **qué canales puede operar un SOC** y con qué límites |

---

## 1. Resumen ejecutivo ##

1. **El estado del arte está polarizado.** Hay SDKs open source excelentes y maduros para
   consumir canales (Telegram, Discord, Slack, Matrix), pero para **escribir en nombre del
   usuario** sólo hay dos vías: (a) la API oficial de plataforma, que exige identidad de bot o
   app aprobada, y (b) librerías no oficiales que hacen ingeniería inversa del protocolo
   (WhatsApp).
2. **Los servidores MCP de mensajería son escasos y de baja calidad.** Verificado: el repo
   oficial `modelcontextprotocol/servers` (91 397 estrellas) **ya no contiene** ningún servidor de
   Slack, Discord, Telegram, WhatsApp o Mastodon; el antiguo `src/slack` fue archivado en
   `modelcontextprotocol/servers-archived`. El único Slack MCP con tracción es comunitario
   (`korotovsky/slack-mcp-server`, 1869 estrellas, MIT).
3. **La mejor referencia de publicación social es Postiz** (37 431 estrellas, AGPL-3.0), con 36
   proveedores sociales y un patrón idempotente **arm → confirm → publish** que detecta
   publicaciones duplicadas tras un fallo de red. Su licencia **obliga a reimplementar, no a
   embeber**.
4. **Ego ya tiene la mitad del modelo.** `packages/domains/src/crm/CrmDomain.ts` persiste
   contactos, deals e interacciones en `crm/contacts`, `crm/deals` y `crm/interactions`, y
   `packages/memory/SensitiveNamespaces.ts` marca `crm/` como sensible por construcción. Falta
   la capa de **canal**, **conversación** y **mensaje**, que es lo que este informe propone.
5. **WhatsApp queda fuera de la v1.** No existe vía oficial para un bot personal; `Baileys` y
   `whatsapp-web.js` son ingeniería inversa del protocolo de WhatsApp Web. El riesgo de baneo de
   número y de violación de ToS es de **cuenta principal de negocio**, no de software.
6. **Identidad ≠ bot.** Publicar "como el usuario" en X, LinkedIn o Bluesky exige OAuth del
   usuario y scopes de escritura; publicar como bot no cumple el caso de uso. Por eso la
   aprobación humana previa es **obligatoria** y no configurable a "off" en la v1.
7. **Cinco canales para la v1:** Telegram (Bot API), Discord (bot token), Slack (Events API +
   Socket Mode), Email (IMAP/SMTP) y publicación en **Mastodon + Bluesky** (protocolos abiertos,
   sin revisión de aplicación).
8. **Copyleft incompatible:** AGPL/SSPL/GPL (Postiz, Mastodon, Signal, listmonk, RSSHub,
   Freescout, Zammad, Twenty, Typebot vía FSL, wa-automate vía H-DNH) **no** pueden embeberse en
   un producto Apache
   2.0 de Ego. Se extraen **patrones**, no código. Excepción: `matrix-org/synapse` es Apache-2.0
   y `n8n` es Sustainable Use License (source-available, tampoco OSI).
9. **Riesgo principal detectado:** la combinación "un agente publica en redes sociales sin revisión
   humana" es irreversible (no se puede retirar un correo ya enviado, un post viralizado o una
   respuesta enviada por WhatsApp). Es un riesgo **reputacional y legal**, no técnico.
10. **Segundo riesgo:** credenciales de plataforma con scopes de escritura («publicar en mi
    nombre») en el keychain del SO; una fuga o un prompt injection en un canal abierto permite
    publicar en nombre del usuario sin pasar por la UI de aprobación.

---

## 2. Metodología ##

### 2.1 Criterios de inclusión ##

Un proyecto entra en el inventario si cumple **al menos uno** de estos criterios y su repositorio
es verificable:

- **C1 — Cliente de canal**: librería o SDK que habla el protocolo/API de un canal de
  comunicación (mensajería, email, SMS/voz, red social).
- **C2 — Servidor o puente de automatización**: aplicación que expone un canal a un agente
  (MCP server, bot, helpdesk, scheduler de publicación).
- **C3 — Infraestructura de contacto**: servidor de correo o gestor de lista/contactos que
  define el contrato de "contacto" y "consentimiento".
- **C4 — Mecanismo transversal**: componente reutilizable de webhooks, idempotencia, colas,
  firmas o límites de tasa que un SOC local-first necesita para operar canales.

**Exclusiones explícitas.** No se evalúan SDKs de pago, ni plataformas de marketing por correo
masivo, ni suites de CRM completas como producto sustitutivo de Ego. El objeto de estudio es
**qué puede operar un Sub-Ego**, no qué suite comprar.

### 2.2 Procedimiento de verificación y evidencia ##

- **Estrellas, licencia y fecha de último push**: obtained con `gh api repos/<org>/<repo>`
  (autenticado) el 2026-10-20. Cuando el repositorio devuelve 404 por renombrado, se resolvió
  con `gh search repos` y se verificó el nombre actual. Los proyectos con licencia no
  recognised por la API (`NOASSERTION`) se verificaron leyendo el fichero `LICENSE` en la raíz.
- **Evidencia de código**: lectura del árbol (`gh api repos/<r>/git/trees/HEAD?recursive=1`) y
  del contenido de ficheros concretos vía `gh api repos/<r>/contents/<path>`, con la línea
  verificada. Las citas usan el formato `ruta:línea` relativo a la raíz del repositorio.
- **Fuentes de plataforma**: documentación oficial (Telegram Bot API, Discord Developer
  Documentation, X Developer Documentation, Mastodon Docs, Bluesky Docs, LinkedIn Developer
  Portal, WhatsApp Help Center).

### 2.3 Limitaciones de esta investigación ##

- `developers.facebook.com` y `whatsapp.com/legal/*` respondieron **400** a la extracción
  automatizada; las reglas de la Cloud API de WhatsApp (ventana de 24 h, plantillas preaprobadas)
  se verifican vía fuentes secundarias y vía el WhatsApp Help Center
  (`https://faq.whatsapp.com/5957850900902049`, título verificado: *"Unauthorized use of
  automated or bulk messaging on WhatsApp"*).
- Las cifras de límites de escritura de X para cuentas no verificadas proceden de fuentes
  secundarias (blogs de agregadores de API); **no** se pudo extraer la tabla oficial.
- El repositorio `front/front` **no existe** en GitHub (404 verificado): Front no es open source
  en el estado actual. `ifttt/ifttt` tampoco: IFTTT es propietario y cerrado.
- `AgoraIO/Agora-Node-SDK` no fue verificable (404 / sin repo equivalente evidente): la vía de
  vozRTC de Agora queda **no verificada**.
- No se midió rendimiento ni se ejecutó ningún benchmark: el encargo es de estado del arte y
  viabilidad, no de performance.

---

## 3. Estado del arte por canal ##

### 3.1 Mensajería instantánea ###

#### 3.1.1 Tabla comparativa ####

| Proyecto | Repo | Stars | Licencia | Último push | Protocolo | Cliente o servidor | Veredicto Ego |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Baileys | [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys) | 11392 | MIT | 2026-10-20 | protocolo WhatsApp Web (inverso) | Cliente | Descartar para v1 (riesgo ToS) |
| whatsapp-web.js | [pedroslopez/whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) | 22764 | Apache-2.0 | 2026-10-18 | Puppeteer sobre WhatsApp Web | Cliente | Descartar para v1 (riesgo ToS) |
| wa-automate-nodejs | [open-wa/wa-automate-nodejs](https://github.com/open-wa/wa-automate-nodejs) | 3669 | Hippocratic 1.1 (H-DNH) | 2026-10-18 | Puppeteer sobre WhatsApp Web | Cliente | Descartar para v1 (riesgo ToS + no OSI) |
| wa-js | [wppconnect-team/wa-js](https://github.com/wppconnect-team/wa-js) | 826 | Apache-2.0 | 2026-10-19 | biblioteca de inyección en la web | Cliente | Descartar para v1 (riesgo ToS) |
| grammy | [grammyjs/grammy](https://github.com/grammyjs/grammy) | 3779 | MIT | 2026-10-16 | Bot API HTTP | Cliente (SDK) | **Adoptar** (Telegram v1) |
| telegraf | [telegraf/telegraf](https://github.com/telegraf/telegraf) | 9204 | MIT | 2026-09-24 | Bot API HTTP | Cliente (SDK) | Alternativa a grammy |
| aiogram | [aiogram/aiogram](https://github.com/aiogram/aiogram) | 5898 | MIT | 2026-10-18 | Bot API HTTP | Cliente (SDK) | Rechazar (Python) |
| python-telegram-bot | [python-telegram-bot/python-telegram-bot](https://github.com/python-telegram-bot/python-telegram-bot) | 29528 | GPL-3.0 | 2026-10-19 | Bot API HTTP | Cliente (SDK) | Rechazar (GPL + Python) |
| discord.js | [discordjs/discord.js](https://github.com/discordjs/discord.js) | 26818 | Apache-2.0 | 2026-10-20 | Gateway + REST v10 | Cliente (SDK) | **Adoptar** (Discord v1) |
| discord.py | [Rapptz/discord.py](https://github.com/Rapptz/discord.py) | 16198 | MIT | 2026-09-07 | Gateway + REST v10 | Cliente (SDK) | Rechazar (Python) |
| bolt-js | [slackapi/bolt-js](https://github.com/slackapi/bolt-js) | 2949 | MIT | 2026-10-19 | Events API + Socket Mode | Cliente (SDK) | **Adoptar** (Slack v1) |
| bolt-python | [slackapi/bolt-python](https://github.com/slackapi/bolt-python) | 1330 | MIT | 2026-10-16 | Events API + Socket Mode | Cliente (SDK) | Rechazar (Python) |
| node-slack-sdk | [slackapi/node-slack-sdk](https://github.com/slackapi/node-slack-sdk) | 3381 | MIT | 2026-10-19 | Web API | Cliente (SDK) | **Adoptar** (API cruda) |
| python-slack-sdk | [slackapi/python-slack-sdk](https://github.com/slackapi/python-slack-sdk) | 4017 | MIT | 2026-10-16 | Web API | Cliente (SDK) | Rechazar (Python) |
| matrix-js-sdk | [matrix-org/matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk) | 2190 | Apache-2.0 | 2026-10-19 | Client-Server API / sliding sync | Cliente (SDK) | **Adoptar** (fase 2) |
| matrix-nio | [poljar/matrix-nio](https://github.com/poljar/matrix-nio) | 711 | ISC | 2026-10-20 | Client-Server API | Cliente (SDK) | Rechazar (Python) |
| Synapse | [matrix-org/synapse](https://github.com/matrix-org/synapse) | 12091 | Apache-2.0 | 2024-04-26 | Homeserver Matrix | Servidor | Fuera de alcance (servidor; **archivado**) |
| signal-cli | [AsamK/signal-cli](https://github.com/AsamK/signal-cli) | 4994 | GPL-3.0 | 2026-10-20 | JSON-RPC sobre daemon | Cliente (bridge local) | **Adoptar** (fase 2, local) |
| Signal-Server | [signalapp/Signal-Server](https://github.com/signalapp/Signal-Server) | 10742 | AGPL-3.0 | 2026-10-19 | servidor de señal | Servidor | Fuera de alcance (AGPL) |

#### 3.1.2 Fichas por proyecto ####

**grammy — Telegram, MIT, 3779 estrellas.** Framework de referencia del ecosistema Telegram en
TypeScript. Es el mejor equilibrio entre madurez, licencia y ausencia de servidor requerido.

- Mecanismo: el long-polling arranca en `src/bot.ts:472` (`await this.loop(options)`) y al parar
  el bot confirma el offset con `src/bot.ts:499` (`const offset = this.lastTriedUpdateId + 1`) y
  `src/bot.ts:500` (`await this.api.getUpdates({ offset, limit: 1 })`), de modo que ningún update
  confirmado se pierde ni se duplica.
- Mecanismo: respuesta directa por webhook sin segunda llamada de red en
  `src/core/client.ts:290` (`// Short-circuit on webhook reply`), gobernada por
  `src/core/client.ts:198` (`canUseWebhookReply?: (method: string) => boolean`).
- Límite de plataforma: la Bot API entrega 30 mensajes/s por bot en difusión gratuita y hasta
  1000 msg/s con "Paid Broadcasts"; los updates se retienen como máximo 24 h
  ([Bot API](https://core.telegram.org/bots/api)).
- Veredicto: **adoptar** como SDK único de Telegram (TypeScript, MIT, sin proceso extra).

**discord.js — Discord, Apache-2.0, 26818 estrellas.** La librería de Discord de referencia
actual; el repo es un monorepo con el cliente REST en `packages/rest/`.

- Mecanismo: el bucket de límites se resuelve por ruta en
  `packages/rest/src/lib/handlers/BurstHandler.ts:105` (`const isGlobal =
  res.headers.has('X-RateLimit-Global')`) y el retardo se compensa con
  `packages/rest/src/lib/handlers/BurstHandler.ts:94` (`if (retry) retryAfter = Number(retry) *
  1_000 + offset`).
- Mecanismo: el bucket secuencial distingue límite global y local en
  `packages/rest/src/lib/handlers/SequentialHandler.ts:87`
  (`this.manager.globalRemaining <= 0 && Date.now() < this.manager.globalReset`) y aplica la
  espera global en `packages/rest/src/lib/handlers/SequentialHandler.ts:126`
  (`private async globalDelayFor(time: number)`).
- Límite de plataforma: 50 peticiones/s globales por bot; las cabeceras `X-RateLimit-*` deben
  leerse, nunca codificarse ([Discord Docs](https://discord.com/developers/docs/topics/rate-limits)).
- Veredicto: **adoptar**. El SDK ya resuelve el bucket de límites; Ego no debe reimplementarlo.

**bolt-js — Slack, MIT, 2949 estrellas.** Framework oficial de Slack para apps.

- Mecanismo: el desafío de verificación de URL se responde en
  `src/receivers/ExpressReceiver.ts:84` (`res.json({ challenge: req.body.challenge })`) y la
  firma se valida en `src/receivers/ExpressReceiver.ts:209`
  (`verifySigningSecret(signingSecret, signatureVerification)`).
- Mecanismo: la firma se lee de `x-slack-signature` en
  `src/receivers/HTTPModuleFunctions.ts:96`; las peticiones `ssl_check` se eximen en
  `src/receivers/HTTPModuleFunctions.ts:83`.
- Límite de plataforma: Slack exige la **firma de cada request**; sin ella, un endpoint público
  es un vector de suplantación de bot. Es el patrón de referencia para el módulo de firma de
  Ego (`CredentialManager` ya gestiona "Secretos de firma para Webhooks (HMAC SHA-256)" según
  `docs/engineering/integraciones.md`).
- Veredicto: **adoptar** para el modo Events API; considerar `node-slack-sdk` en crudo para
  llamadas puntuales (Web API) sin montar un framework de app.

**Baileys — WhatsApp, MIT, 11392 estrellas.** Reverse-engineering del protocolo de WhatsApp Web
en TypeScript. librería de referencia técnica **no** de producto.

- Mecanismo: caché de mensajes enviados para procesar recibos de reintento en
  `src/Utils/message-retry-manager.ts:5` (*"Number of sent messages to cache in memory for
  handling retry receipts"*) con tope en `src/Utils/message-retry-manager.ts:94`
  (`private readonly maxMsgRetryCount: number = 5`).
- Mecanismo: construcción del ACK de stanza en `src/Utils/stanza-ack.ts:11`
  (`export function buildAckStanza(...)`), y reproceso de stanzas offline en
  `src/Utils/offline-node-processor.ts:22` (`export function makeOfflineNodeProcessor(`).
- Mecanismo: persistencia de sesión multi-dispositivo en
  `src/Utils/use-multi-file-auth-state.ts:33` (`export const useMultiFileAuthState = async (`).
- Riesgo: `https://faq.whatsapp.com/5957850900902049` documenta explícitamente el uso no
  autorizado de mensajería automatizada o masiva. El número puede ser baneado, y con él la
  capacidad de negocio del usuario.
- Veredicto: **descartar para v1**. Valor exclusivamente como referencia de diseño para
  reintentos, ACK y reproceso offline. No es un canal admisible en el producto.

**whatsapp-web.js — WhatsApp, Apache-2.0, 22764 estrellas.** Automatiza WhatsApp Web con
Puppeteer.

- Mecanismo: la inicialización abre la sesión y resuelve el emparejamiento en
  `src/Client.js:469` (`async initialize() {`), con dos rutas de enlace — dispositivo
  alternativo en `src/Client.js:596` (`.initializeAltDeviceLinking();`) y QR en
  `src/Client.js:633` (`.initializeQRLinking();`).
- Mecanismo: envío en `src/Client.js:1448`
  (`async sendMessage(chatId, content, options = {})`).
- Riesgo: automatizar la interfaz web de WhatsApp viola la ToS del producto de forma más
  explícita que Baileys, y añade fragilidad de scraping.
- Veredicto: **descartar para v1**.

**matrix-js-sdk — Matrix, Apache-2.0, 2190 estrellas.** El único canal con **protocolo abierto
y federado** de la lista: identidad portable, criptografía extremo a extremo y sin revisión de
aplicación.

- Mecanismo: la posición del sync se persiste y se reutiliza como token `since` en
  `src/sync.ts:148` (`oldSyncToken?: string`) y `src/sync.ts:151`
  (*"will become the 'since' token for the next call to /sync"*), con rehidratación en
  `src/sync.ts:723` (`const savedSyncTokenPromise = this.client.store.getSavedSyncToken()`).
- Mecanismo: idempotencia de envío mediante **transaction ID** en `src/client.ts:1213`
  (*"Optional transaction ID. Generated if omitted."*), aplicado también al borrado en
  `src/client.ts:3155` (`const pathTemplate = '/rooms/$roomId/redact/$redactsEventId/$txnId'`).
- Veredicto: **adoptar en fase 2**. Es el único canal que da control real sobre el dato y
  donde "publicar como el usuario" es legítimo por diseño (la identidad es del usuario).

**signal-cli — Signal, GPL-3.0, 4994 estrellas.** Puente local de Signal: daemon con interfaz
**JSON-RPC**, sin cuenta de bot y con número propio del usuario.

- Mecanismo: el modo daemon expone JSON-RPC en `README.md:11` (*"it has a daemon mode with
  JSON-RPC interface"*) y los esquemas JSON de todas las clases del modo JSON-RPC se pueden
  generar en `README.md:166`.
- Veredicto: **adoptar en fase 2, local**. El patrón "daemon local + JSON-RPC + esquemas
  declarativos" es exactamente el que encaja con el `McpClient` de Ego (transporte `stdio`).
  Attention: licencia **GPL-3.0** → **no** se puede embeber en un producto Apache 2.0; sólo
  puede invocar el binario como proceso externo (uso del programa, no distribución del código).

**aiogram — Telegram, MIT, 5898 estrellas.** Referencia Python; útil por su tratamiento
explícito del `retry_after` que devuelve la propia API.

- Mecanismo: la API de error de Telegram se traduce a excepción tipada en
  `aiogram/client/session/base.py:108` (`if parameters.retry_after:`) y
  `aiogram/client/session/base.py:112` (`retry_after=parameters.retry_after,`), con timeout por
  defecto de 60 s en `aiogram/client/session/base.py:45`
  (`DEFAULT_TIMEOUT: Final[float] = 60.0`).
- Veredicto: **rechazar** (Ego es TypeScript), pero **adoptar el patrón**: leer el
  `retry_after` del cuerpo del error y reintentar, en lugar de calcular backoff a ciegas.

### 3.2 Email y correo saliente ###

| Proyecto | Repo | Stars | Licencia | Último push | Protocolo | Veredicto Ego |
| --- | --- | --- | --- | --- | --- | --- |
| nodemailer | [nodemailer/nodemailer](https://github.com/nodemailer/nodemailer) | 17686 | MIT | 2026-10-19 | SMTP/IMAP | **Adoptar** |
| imapflow | [postalsys/imapflow](https://github.com/postalsys/imapflow) | 575 | MIT | 2026-10-20 | IMAP | **Adoptar** |
| postal | [postalserver/postal](https://github.com/postalserver/postal) | 16877 | MIT | 2026-10-06 | SMTP + API web | Adaptar (servidor) |
| listmonk | [knadh/listmonk](https://github.com/knadh/listmonk) | 23873 | AGPL-3.0 | 2026-10-20 | API REST + SMTP | Adaptar (patrón) |
| mailpit | [axllent/mailpit](https://github.com/axllent/mailpit) | 10702 | MIT | 2026-10-20 | SMTP de pruebas | **Adoptar** (dev) |
| mailslurper | [mailslurper/mailslurper](https://github.com/mailslurper/mailslurper) | 1512 | MIT | 2025-12-05 | SMTP de pruebas | Alternativa a mailpit |

**Fichas.**

- **nodemailer** — MIT, 17686 estrellas. Es el único SDK de email en Node con masa crítica.
  Aporta: pool de conexiones, transporte con OAuth2 (Gmail/Microsoft), adjuntos, plantillas y
  control de errores. Es de la misma familia que `nodemailer` como dependencia transitiva de
  casi todo el ecosistema Node. Veredicto: **adoptar** como único emisor SMTP de Ego.
- **imapflow** — MIT, 575 estrellas. Cliente IMAG moderno y **streaming** (no carga el buzón
  entero en memoria), que es el único patrón escalable para un buzón real. Veredicto:
  **adoptar** para lectura y búsqueda de hilos.
- **postal** — MIT, 16877 estrellas. Servidor de envío con API web. Veredicto: **adaptar como
  patrón** de "servidor de correo self-hosted"; Ego no debe embeberlo (proceso servidor).
- **listmonk** — AGPL-3.0, 23873 estrellas. Referencia open source de **gestión de lista con
  consentimiento** (doble opt-in, estados de suscriptor, campaigns). AGPL ⇒ **reimplementar el
  modelo de consentimiento**, no copiar código. Veredicto: **adaptar como patrón**.
- **mailpit** — MIT, 10702 estrellas. Servidor SMTP de pruebas con API y UI web. Veredicto:
  **adoptar en desarrollo** para no enviar correo real en los tests.

### 3.3 SMS, voz y llamadas ###

| Proyecto | Repo | Stars | Licencia | Último push | Protocolo | Veredicto Ego |
| --- | --- | --- | --- | --- | --- | --- |
| twilio-node | [twilio/twilio-node](https://github.com/twilio/twilio-node) | 1543 | MIT | 2026-10-12 | REST + webhooks | **Adoptar** (fase 2) |
| vonage-node-sdk | [Vonage/vonage-node-sdk](https://github.com/Vonage/vonage-node-sdk) | 399 | Apache-2.0 | 2026-10-15 | REST | Alternativa |
| telnyx-node | [team-telnyx/telnyx-node](https://github.com/team-telnyx/telnyx-node) | 198 | MIT | 2026-10-19 | REST | Alternativa |
| plivo-node | [plivo/plivo-node](https://github.com/plivo/plivo-node) | 102 | MIT | 2026-10-15 | REST + XML | Alternativa |
| Agora Node SDK | no verificable | — | — | — | WebRTC | **No verificado** |

**Ficha — twilio-node.** MIT, 1543 estrellas. Referencia de la categoría: SMS, voz y Verify (2FA)
con un único SDK, callbacks firmados y un modelo de webhooks entrantes con reintentos. Es
también la referencia canónica del **número como identidad de canal**: el `To` es la dirección
del destinatario y el `From` es un número verificado.

- Riesgo principal: **coste por mensaje** y **fraude de SMS** (A2P 10DLC, registro de
  campanha). Publicar no es el caso de uso; aquí Ego **responde y notifica**, no difunde.
- Riesgo de cumplimiento: el número de destino es dato personal (RGPD) y la llamada entrante
  puede ser una persona real esperando respuesta humana.
- Veredicto: **adoptar en fase 2**, con la misma regla que el resto: toda salida de SMS o
  llamada pasa por `ApprovalEngine` (`docs/engineering/integraciones.md`, sección HITL).

### 3.4 LINE y Google Chat ###

| Proyecto | Repo | Stars | Licencia | Último push | Protocolo | Veredicto Ego |
| --- | --- | --- | --- | --- | --- | --- |
| line-bot-sdk-nodejs | [line/line-bot-sdk-nodejs](https://github.com/line/line-bot-sdk-nodejs) | 1081 | Apache-2.0 | 2026-10-20 | LINE Messaging API | **Adoptar** (fase 2) |
| line-bot-sdk-python | [line/line-bot-sdk-python](https://github.com/line/line-bot-sdk-python) | 2140 | Apache-2.0 | 2026-10-19 | LINE Messaging API | Rechazar (Python) |
| google-chat-samples | [googleworkspace/google-chat-samples](https://github.com/googleworkspace/google-chat-samples) | 604 | Apache-2.0 | 2026-06-22 | Google Chat API | Referencia |

**Fichas.** LINE es un canal de altísimo volumen en Asia y su SDK oficial en Node es Apache-2.0,
limpio y con webhook nativo: barato de soportar una vez que existe el adaptador de canal
genérico. Google Chat sólo ofrece muestras oficiales, no SDK; su API es proporcional a Chat
Spaces y su valor para Ego es marginal frente a Slack/Discord. Veredicto LINE: **adoptar en
fase 2** (el coste marginal es bajo). Veredicto Google Chat: **aplazar**.

### 3.5 Contacto y CRM ligero con comunicaciones ###

| Proyecto | Repo | Stars | Licencia | Último push | Qué aporta | Veredicto Ego |
| --- | --- | --- | --- | --- | --- | --- |
| chatwoot | [chatwoot/chatwoot](https://github.com/chatwoot/chatwoot) | 37989 | MIT + `enterprise/` | 2026-10-20 | modelo de canal + conversación + contacto | **Adaptar** (modelo) |
| freescout | [freescout-helpdesk/freescout](https://github.com/freescout-helpdesk/freescout) | 4603 | AGPL-3.0 | 2026-10-19 | helpdesk ligero | Adaptar (patrón) |
| zammad | [zammad/zammad](https://github.com/zammad/zammad) | 6019 | AGPL-3.0 | 2026-10-20 | helpdesk multi-canal | Adaptar (patrón) |
| twenty | [twentyhq/twenty](https://github.com/twentyhq/twenty) | 58656 | AGPL-3.0 + comercial | 2026-10-20 | CRM moderno | **Descartar** (AGPL + duplica `CrmDomain`) |
| espocrm | [espocrm/espocrm](https://github.com/espocrm/espocrm) | 3499 | AGPL-3.0 | 2026-10-19 | CRM autohospedado | Descartar (AGPL) |
| typebot.io | [baptisteArno/typebot.io](https://github.com/baptisteArno/typebot.io) | 10561 | FSL 1.1 → Apache-2.0 futura | 2026-10-20 | constructor visual de bots | **Descartar** (no es OSI todavía) |
| rasa | [RasaHQ/rasa](https://github.com/RasaHQ/rasa) | 21354 | Apache-2.0 | 2026-07-24 | NLU + canales | Adaptar (patrón de intents) |
| botpress | [botpress/botpress](https://github.com/botpress/botpress) | 14960 | MIT | 2026-10-19 | runtime de bots | Referencia |
| leon | [leon-ai/leon](https://github.com/leon-ai/leon) | 17591 | MIT | 2026-10-20 | asistente personal open source | Referencia |
| papercups | [papercups-io/papercups](https://github.com/papercups-io/papercups) | 6116 | MIT | 2024-02-15 | chat de soporte embebido | Descartar (abandonado) |

**Fichas.**

- **chatwoot** — MIT (el directorio `enterprise/` está bajo licencia propia), 37989 estrellas. Es
  el mejor **modelo de dominio** del conjunto: separa *contacto*, *inbox*, *canal* y
  *conversación*, y resuelve el mismo caso de uso que Ego (una persona, muchos canales).
- Mecanismo: la lógica de contacto se ramifica por tipo de canal en
  `app/services/contacts/contactable_inboxes_service.rb:12` (`case inbox.channel_type`), lo que
  confirma que el modelo correcto es "contacto + canal → conversación", no "contacto con
  WhatsApp".
- Mecanismo: los webhooks salientes se encolan, no se ejecutan en línea, en
  `app/services/automation_rules/action_service.rb:38`
  (`def send_webhook_event(webhook_url)`) y
  `app/services/automation_rules/action_service.rb:40`
  (`WebhookJob.perform_later(webhook_url[0], payload)`).
- Veredicto: **adaptar el modelo, no el producto**. Ego ya tiene `CrmDomain`; lo que falta es
  la noción de **canal** como dimensión de primera clase.

- `typebot.io` — 10561 estrellas pero licencia **Functional Source License 1.1** con
  *Apache 2.0 Future License*: **no es open source todavía** (FSL es source-available con
  restricción de uso comercial). El diseño de bloques es interesante
  (`packages/typebot/src/preprocessTypebot.ts:21`, `blocks: group.blocks ?? []`), pero no puede
  ser dependencia ni base de código de Ego. Veredicto: **descartar como dependencia**; su
  bloqueo por licencia es un buen recordatorio de que "muchas estrellas" ≠ "usable".

- **wa-automate-nodejs** — 3669 estrellas, pero licencia **Hippocratic 1.1 (H-DNH)** verificada en
  `LICENSE.md` (*"Copyright (c) 2020 Mohammed Shah / Hippocratic + Do Not Harm (H-DNH) Version
  1.1"*): es *copyleft ético*, **no** es open source en sentido OSI y prohíbe usos dañinos. Se
  descarta por doble motivo (ToS de WhatsApp y licencia).

- **twenty** — 58656 estrellas, AGPL-3.0 con excepciones comerciales. Es exactamente el hueco
  que Ego ya cubre con `packages/domains/src/crm/CrmDomain.ts` (`crm/contacts`, `crm/deals`,
  `crm/interactions`). Veredicto: **descartar** — duplicaría una capacidad existente y añadiría
  copyleft fuerte.

### 3.6 Publicación social y presencia en redes ###

| Proyecto | Repo | Stars | Licencia | Último push | Qué aporta | Veredicto Ego |
| --- | --- | --- | --- | --- | --- | --- |
| postiz-app | [gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app) | 37431 | AGPL-3.0 | 2026-10-20 | 36 proveedores sociales | **Adaptar** (patrón) |
| postiz-agent | [gitroomhq/postiz-agent](https://github.com/gitroomhq/postiz-agent) | 526 | AGPL-3.0 | 2026-10-20 | agente de publicación | Referencia |
| mixpost | [inovector/mixpost](https://github.com/inovector/mixpost) | 3838 | MIT | 2026-03-16 | self-hosted (Laravel) | Referencia |
| socioboard-5.0 | [Socioboard-developers/Socioboard-5.0](https://github.com/Socioboard-developers/Socioboard-5.0) | 1518 | GPL-3.0 | 2026-10-17 | suite de social | Descartar |
| huginn | [huginn/huginn](https://github.com/huginn/huginn) | 50083 | MIT | 2026-10-18 | agentes por evento | **Adaptar** (patrón) |
| RSSHub | [DIYgod/RSSHub](https://github.com/DIYgod/RSSHub) | 46588 | AGPL-3.0 | 2026-10-20 | ingesta RSS/ATOM | Adaptar (ingesta) |
| mastodon | [mastodon/mastodon](https://github.com/mastodon/mastodon) | 50423 | AGPL-3.0 | 2026-10-20 | ActivityPub | Adaptar (protocolo) |
| mastodon-api | [mastodon/mastodon-api](https://github.com/mastodon/mastodon-api) | 177 | MIT (declarada en el gemspec; sin `LICENSE` en la raíz) | 2024-03-13 | cliente Ruby | Descartar (dormido) |
| Mastodon.py | [halcy/Mastodon.py](https://github.com/halcy/Mastodon.py) | 959 | MIT | 2026-10-18 | cliente Python | Referencia |
| atproto | [bluesky-social/atproto](https://github.com/bluesky-social/atproto) | 9699 | MIT + Apache-2.0 | 2026-10-19 | AT Protocol | **Adoptar** (fase 2) |
| nostr | [nostr-protocol/nostr](https://github.com/nostr-protocol/nostr) | 12097 | Dominio público | 2025-06-27 | protocolo de acciones | Aplazar |

**Fichas.**

- **postiz-app** — AGPL-3.0, 37 431 estrellas. Es **la** referencia open source de publicación
  social multi-canal y la fuente del patrón que Ego necesita.
- Mecanismo: **36 proveedores** implementados en
  `libraries/nestjs-libraries/src/integrations/social/` (x, linkedin, mastodon, bluesky, nostr,
  telegram, slack, listmonk, threads, reddit, tiktok, youtube, wordpress…). La abstracción es
  una clase por proveedor, lo que valida el diseño de **adaptador de canal** en Ego.
- Mecanismo (idempotencia, la pieza crítica): el proveedor de Bluesky implementa un handshake
  **arm → confirm → publish** documentado en
  `libraries/nestjs-libraries/src/integrations/social/bluesky.provider.ts:220`
  (*"Arm -> confirm -> publish handshake (same as the Facebook story flow): finalizePost arms
  without mutating, checkPostStatus witnesses, and only a witnessed attempt runs the create — so
  a create that dies with an unknown outcome is detected instead of run again."*), con los
  campos `attempting` y `confirmed` en
  `libraries/nestjs-libraries/src/integrations/social/bluesky.provider.ts:224` y
  `libraries/nestjs-libraries/src/integrations/social/bluesky.provider.ts:225`. Las fases son
  `postPending` (`bluesky.provider.ts:447`) y `finalizePost` (`bluesky.provider.ts:548`), y el
  estado indeterminado se traduce en un mensaje explícito en
  `bluesky.provider.ts:499` (*"Bluesky may have already published this post, please check your
  account before posting again to avoid duplicates"*).
- Mecanismo (aprobación por borrador): la validación de publicación se salta para borradores en
  `apps/backend/src/api/routes/posts.controller.ts:233` (`if (rawBody?.type !== 'draft') {`),
  de modo que **redactar no exige tener la integración configurada**.
- Mecanismo (no republicar por accidente): el reprogramado usa `'update'` como acción por
  defecto en `apps/backend/src/api/routes/posts.controller.ts:303`
  (`@Body('action') action: 'schedule' | 'update' = 'update'`) con el comentario en
  `apps/backend/src/api/routes/posts.controller.ts:301` (*"'update' is the safe default: clients
  that don't send an action must never requeue (and thereby republish) a post by accident"*).
- Mecanismo (restricciones de plataforma): el proveedor de X traduce la falta de permiso en un
  error de negocio en `libraries/nestjs-libraries/src/integrations/social/x.provider.ts:280` y
  `x.provider.ts:283` (*"Publishing articles on X requires an X Premium subscription"*).
- Veredicto: **adaptar el patrón, reimplementar el código**. AGPL-3.0 impide embeber Postiz en
  un producto Apache 2.0. Lo que Ego debe copiar es la **forma** (adaptador por proveedor,
  arm/confirm/publish, borrador separado de publicación, acción por defecto segura), no el
  código.

- **huginn** — MIT, 50083 estrellas. El patrón de **agente por evento**: cada agente recibe
  eventos y emite eventos nuevos.
- Mecanismo: el contrato de recepción/emisión está en
  `app/models/agents/attribute_difference_agent.rb:58` (`def receive(incoming_events)`) y
  `app/models/agents/change_detector_agent.rb:6` (*"The Change Detector Agent receives a stream
  of events and emits a new event when a property of the received event changes"*).
- Veredicto: **adaptar el patrón**. Es la alternativa a la cascada de Webhooks de `n8n` cuando
  la fuente es una API con cursor (Matrix `since`, Bluesky `cursor`, Discord `after`).

- **atproto** — MIT + Apache-2.0 (dual), 9699 estrellas. El único protocolo social moderno con
  **identidad portable del usuario** (DID + documento de servicio con plantillas OAuth2), sin
  proceso de revisión de aplicación y con API HTTP plana.
- Mecanismo: el borrado de cuenta está definido en el propio lexicon en
  `lexicons/com/atproto/admin/deleteAccount.json:3`
  (`"id": "com.atproto.admin.deleteAccount"`), y los tipos comunes viven en
  `lexicons/com/atproto/admin/defs.json:3` (`"id": "com.atproto.admin.defs"`). El protocolo
  **incluye la supresión por diseño**, no como parche.
- Veredicto: **adoptar en fase 2**. Es el único canal social donde "publicar como el usuario" es
  limpio (el DID es del usuario, la app pide scopes al usuario) y donde la supresión de datos
  está en el protocolo.

- **RSSHub** — AGPL-3.0, 46588 estrellas. Ingesta RSS/ATOM de fuentes sin feed. Es la vía más
  barata para que Ego **lea** redes y Operand sin credenciales: un `GET` a un endpoint RSS.
  Veredicto: **adaptar como ingesta de nivel C** (HTTP genérico), nunca embeber.

- **Socioboard-5.0** — GPL-3.0, 1518 estrellas. El repo histórico `socioboard/socioboard` quedó
  en **2 estrellas** y AGPL-3.0 (verificado); el proyecto vivo es
  `Socioboard-developers/Socioboard-5.0`. Veredicto: **descartar** (suite completa, GPL, sin
  nada transferible que Postiz no cubra mejor).

### 3.7 Servidores de correo y gestión de contactos ##

| Proyecto | Repo | Stars | Licencia | Último push | Veredicto Ego |
| --- | --- | --- | --- | --- | --- |
| mailcow-dockerized | [mailcow/mailcow-dockerized](https://github.com/mailcow/mailcow-dockerized) | 13632 | GPL-3.0 | 2026-10-19 | Referencia (autohospedado) |
| Mailu | [Mailu/Mailu](https://github.com/Mailu/Mailu) | 7566 | MIT | 2026-10-19 | Referencia (ligero) |
| stalwart | [stalwartlabs/stalwart](https://github.com/stalwartlabs/stalwart) | 15178 | AGPL-3.0 + SELv2 (dual) | 2026-10-18 | Referencia (JMAP) |
| listmonk | [knadh/listmonk](https://github.com/knadh/listmonk) | 23873 | AGPL-3.0 | 2026-10-20 | **Adaptar** (consentimiento) |

**Ficha.** Los tres son **servidores de correo completos**, no librerías: su utilidad para
Ego es doble. (a) Proveen un buzón real para el usuario que quiera autoalojar su correo y así
evitar depender de Gmail — irrelevante para un SOC local. (b) Más relevante: `stalwart`
implementa **JMAP** (RFC 8620 + RFC 8621), un protocolo de buzón con operaciones idempotentes y
sincronización por estado, muy superior a IMAP para un agente que necesita leer y responder
sin duplicar. Para la v1, IMAP (`imapflow`) basta; JMAP es el paso natural si el volumen de
correo lo justifica.

Veredicto: **aplazar** el autoalojamiento de correo; **extraer el modelo de consentimiento** de
listmonk (doble opt-in, unsubscribe, suppressing).

### 3.8 Mecanismos transversales ##

Estos mecanismos son **independientes del canal** y deben vivir en el runtime, no en cada
adaptador. La evidencia viene del código de los proyectos evaluados.

| Mecanismo | Evidencia | Patrón a extraer |
| --- | --- | --- |
| Confirmación de updates (evitar pérdida/duplicado) | `grammyjs/grammy` `src/bot.ts:499-500` | Confirmar por offset sólo tras procesar; el offset es `lastTriedUpdateId + 1` |
| Cursor de sincronización | `matrix-org/matrix-js-sdk` `src/sync.ts:151`, `src/sync.ts:723` | Persistir el cursor y reenviarlo como `since` |
| Token de transacción (idempotencia de envío) | `matrix-org/matrix-js-sdk` `src/client.ts:1213`, `src/client.ts:3155` | Clave de idempotencia de envío; reintentar sin duplicar |
| Reintentos con tope | `WhiskeySockets/Baileys` `src/Utils/message-retry-manager.ts:5`, `:94` | Caché de mensajes enviados + tope de 5 reintentos |
| ACK de recepción | `WhiskeySockets/Baileys` `src/Utils/stanza-ack.ts:11` | Confirmar recepción en el borde antes de procesar |
| Reproceso de elementos offline | `WhiskeySockets/Baileys` `src/Utils/offline-node-processor.ts:22` | Cola de trabajo pendiente con processing no bloqueante |
| Límites de tasa por bucket | `discordjs/discord.js` `packages/rest/src/lib/handlers/BurstHandler.ts:105` | Leer `X-RateLimit-Bucket`/`Retry-After`; nunca hardcodear |
| Límite global separado del por-ruta | `discordjs/discord.js` `packages/rest/src/lib/handlers/SequentialHandler.ts:87`, `:126` | Dos niveles de cubo + espera global |
| `retry_after` del servidor | `aiogram/aiogram` `aiogram/client/session/base.py:108`, `:112` | Respetar el `retry_after` del cuerpo de error |
| Firma de webhooks entrantes | `slackapi/bolt-js` `src/receivers/ExpressReceiver.ts:209`, `src/receivers/HTTPModuleFunctions.ts:96` | HMAC-SHA256 sobre el cuerpo crudo + timestamp |
| Desafío de verificación de URL | `slackapi/bolt-js` `src/receivers/ExpressReceiver.ts:84` | Responder `challenge` sin verificación de firma |
| Webhooks salientes encolados | `chatwoot/chatwoot` `app/services/automation_rules/action_service.rb:38-40` | `WebhookJob.perform_later`: nunca ejecutar HTTP saliente en línea |
| Manojo arm/confirm/publish | `gitroomhq/postiz-app` `bluesky.provider.ts:220-225`, `:499` | Detectar resultado indeterminado antes de reintentar |
| Borrador separado de publicación | `gitroomhq/postiz-app` `apps/backend/src/api/routes/posts.controller.ts:233` | `type !== 'draft'` → no exigir integración configurada para redactar |
| Acción por defecto segura | `gitroomhq/postiz-app` `apps/backend/src/api/routes/posts.controller.ts:301-303` | Default `'update'` para no republicar por accidente |
| ACK con timeout | `slackapi/bolt-python` `slack_bolt/app/app.py:955-957` | `ack_timeout`: confirmar dentro de N s o reintentar |
| borrador de plantilla vs contenido final | `gitroomhq/postiz-app` `x.provider.ts:145-146` | Un borrador de artículo no admite respuestas: regla de plataforma |
| Contenido no determinista | `gitroomhq/postiz-app` `mastodon.provider.ts:272-274` | Clave de idempotencia por ejecución de publicación |
| Supresión a nivel de protocolo | `bluesky-social/atproto` `lexicons/com/atproto/admin/deleteAccount.json:3` | Borrado de cuenta como operación de primer nivel |

**Cobertura de medios (imágenes, audio, vídeo).** Es transversal y sale de los mismos
mecanismos: subida en dos fases (pre-signed upload → referencia), estado de procesamiento
asíncrono (LinkedIn y Bluesky exponen el medio como "en procesamiento" y exigen *check*
posterior) y expiración de la referencia (`mastodon.provider.ts:62` y `:70` en Postiz: *"The
media was still processing when the post was published"* / *"The uploaded media expired before
the post was published"*). Para Ego, esto se traduce en un **estado de envío no terminal**: un
mensaje con medio no está "enviado" hasta que el medio está listo y confirmado.

**Plantillas y variables.** El patrón dominante (WhatsApp Cloud API, Mailchimp, listmonk,
Postiz) es *plantilla preaprobada + variables de sustitución*. La variables se sustituyen en el
envío, no en el momento de redactar; el contenido final es inmutable una vez enviado.

**Moderación y opt-in/opt-out.** Tres niveles: (a) **opt-in** en la entrada (la persona pidió
recibir; el consent stored como estado del contacto, con fecha y origen); (b) **opt-out**
permanente que debe ganarse el *bypass* de cualquier cola de envío; (c) **moderación de la
plataforma** (Telegram: los bots pueden ser expulsados de grupos; Discord: rate limits y
*anti-spam*; X y LinkedIn: límites de escritura por cuenta; WhatsApp: baneo de número).
Regla para Ego: el opt-out debe estar **modelado en el contacto**, no en la cola de envío, y ser
consultado **en el último momento** antes del despacho.

### 3.9 Servidores MCP disponibles por canal ##

| Canal | Servidor MCP | Repo | Stars | Licencia | Estado |
| --- | --- | --- | --- | --- | --- |
| Slack | `slack-mcp-server` | [korotovsky/slack-mcp-server](https://github.com/korotovsky/slack-mcp-server) | 1869 | MIT | Community — único con tracción |
| Email | `mcp-email-server` | [Wh1isper/mcp-email-server](https://github.com/Wh1isper/mcp-email-server) | 361 | BSD-3-Clause | Community |
| Email | `email-mcp` | [codefuturist/email-mcp](https://github.com/codefuturist/email-mcp) | 133 | LGPL-3.0 | Community |
| WhatsApp | `mcp-whatsapp` | [Sealjay/mcp-whatsapp](https://github.com/Sealjay/mcp-whatsapp) | 11 | MIT | Community — marginal |
| Discord | — | — | — | — | **No existe servidor MCP con tracción** |
| Telegram | — | — | — | — | **No existe servidor MCP con tracción** |
| Mastodon / Bluesky | — | — | — | — | **No existe servidor MCP con tracción** |
| Catálogo | `awesome-mcp-servers` | [punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) | 96640 | MIT | Índice, no implementación |

**Hallazgo verificado de primer orden.** El repositorio oficial
`modelcontextprotocol/servers` (91 397 estrellas, **activo**, 2026-10-19) **no contiene ningún
servidor de mensajería**: el árbol del repositorio tiene 397 entradas y **cero** coinciden con
`slack`, `discord`, `telegram`, `whatsapp` o `mastodon`. El antiguo servidor de Slack vive ahora
en `modelcontextprotocol/servers-archived` (305 estrellas, MIT, **archivado**, último push
2025-05-28).

**Consecuencia arquitectónica para Ego.** El Nivel B de `docs/engineering/integraciones.md` («MCP
como capa estándar universal») **no puede cubrir mensajería con servidores de terceros**: no
existen. Las tres opciones reales son:

1. **Nivel A (first-party, nativo)** — conector propio en `packages/tools/src/native/`, con
   control total del mapeo, la aprobación y la auditoría. Es lo que corresponde a los canales de
   la v1.
2. **Nivel B vía servidor MCP comunitario** — sólo para canales secundarios y con `trust_level:
   community`; exige confianza porque el servidor ve las credenciales del canal.
3. **Nivel C (HTTP/Webhooks genérico)** — para ingesta de solo lectura (RSSHub) y para APIs sin
   SDK dominante.

---

## 4. Matriz de canales ##

| Canal | Vía de integración | MCP server disponible | SDK dominante | Complejidad | Riesgos | Veredicto Ego |
| --- | --- | --- | --- | --- | --- | --- |
| Telegram | Nivel A, bot API | No | [grammy](https://github.com/grammyjs/grammy) (MIT) | Baja | Ratas de difusión (30 msg/s); no escribe "como el usuario" | **v1** |
| Discord | Nivel A, bot token | No | [discord.js](https://github.com/discordjs/discord.js) (Apache-2.0) | Media | Límites de tasa por bucket; permisos por canal; anti-spam | **v1** |
| Slack | Nivel A, Events API + Socket Mode | Community (1869 ★) | [bolt-js](https://github.com/slackapi/bolt-js) + [node-slack-sdk](https://github.com/slackapi/node-slack-sdk) | Media | Firma obligatoria; scopes de escritura; app review | **v1** |
| Email | Nivel A, IMAP/SMTP | Community (361 ★) | [nodemailer](https://github.com/nodemailer/nodemailer) + [imapflow](https://github.com/postalsys/imapflow) | Baja | Reputacional de envío; antispam; consentimiento | **v1** |
| Mastodon | Nivel A, REST API | No | HTTP directo (JSON) | Baja | 300 req/5 min por cuenta; las instancias moderan | **v1 (publicación)** |
| Bluesky | Nivel A, AT Protocol | No | HTTP directo (JSON) | Media | Límites por puntos (5 000/h, 35 000/día; cifra de fuente secundaria) | **v1 (publicación)** |
| X / Twitter | Nivel A, API v2 + OAuth | No | HTTP directo (JSON) | Media-Alta | Coste por nivel de API; límites por cuenta (50 originales/día sin verificar; fuente secundaria) | **Fase 2** |
| LinkedIn | Nivel A, Community Management API | No | HTTP directo (JSON) | Alta | **Revisión de acceso obligatoria** a nivel de app; sólo páginas de organización | **Fase 2** |
| Matrix | Nivel A, Client-Server API | No | [matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk) (Apache-2.0) | Media | Firewall de instancias; E2E; identidad federada | **Fase 2** |
| Signal | Nivel A local, signal-cli JSON-RPC | No | [signal-cli](https://github.com/AsamK/signal-cli) (GPL-3.0) | Media | GPL (uso como proceso, no distribución); número propio | **Fase 2** |
| LINE | Nivel A, Messaging API | No | [line-bot-sdk-nodejs](https://github.com/line/line-bot-sdk-nodejs) (Apache-2.0) | Baja | Ratas; SDK oficial | **Fase 2** |
| SMS / voz | Nivel A, API del proveedor | No | [twilio-node](https://github.com/twilio/twilio-node) (MIT) | Media | Coste; fraude A2P; consentimiento de comunicaciones | **Fase 2** |
| Google Chat | Nivel A, Chat API | No | HTTP directo | Baja | Sin SDK oficial; valor marginal | **Aplazar** |
| WhatsApp (Cloud API) | Nivel C, API oficial de Meta | No | HTTP directo | Alta | Verificación de negocio; plantillas preaprobadas; ventana de 24 h; coste por conversación | **Fase 2, sólo oficial** |
| WhatsApp (Baileys / web.js) | — | No | [Baileys](https://github.com/WhiskeySockets/Baileys) (MIT) | Media | **ToS; baneo de número** | **Descartar** |
| Nostr | Nivel A, protocolo WebSocket | No | WebSocket + JSON | Baja-Media | Sin identidad verificable por defecto; uso residual | **Aplazar** |
| ActivityPub (genérico) | Nivel C, HTTP | No | HTTP directo | Alta | Implementación por instancia; sin cliente único | **Aplazar** |

---

## 5. Modelo de contacto y conversación en Ego ##

### 5.1 Principio de diseño ##

**El canal es un adaptador; el modelo es canónico.** Ni `CrmDomain` ni el runtime deben conocer
WhatsApp, Telegram ni LinkedIn. Un Sub-Ego razona sobre `Contact`, `Conversation` y `Message`;
el adaptador traduce. Esto respeta el criterio arquitectónico de `docs/engineering/integraciones.md`:
*"Agregar, actualizar o eliminar una integración NO DEBE modificar el Cognitive Runtime, el
Model Router, el Sub-Ego Runtime, el Workspace Runtime ni la Decision Intelligence Layer."*

Corolario: las rarezas de cada plataforma (ventana de 24 h de WhatsApp, 280 caracteres de X,
4 imágenes en Bluesky, 2000 caracteres en Discord) viven **en el adaptador**, que declara qué
puede hacer. El modelo canónico no los conoce.

### 5.2 Las entidades del modelo y su persistencia ###

| Entidad | Qué es | Namespace VantaDB propuesto | Clave | Notas |
| --- | --- | --- | --- | --- |
| `Channel` | Un punto de conexión con una plataforma: `telegram:main`, `email:work` | `crm/channels` | `canal:<tipo>:<id>` | Registro de credenciales (ref, no secreto) y capacidades |
| `Contact` | Una persona, con identidades por canal | `crm/contacts` | `cnt_<id>` | Ya existe en `CrmDomain` (`crm/contacts`) |
| `Identity` | Vincula un `Contact` con una identidad de canal (`@user`, dirección de email, DID) | `crm/identities` | `idt_<id>` | **Nuevo**: una persona tiene N identidades |
| `Conversation` | Un hilo: par (contacto, canal) o grupo; con estado y ventana de respuesta | `crm/conversations` | `cnv_<id>` | **Nuevo**: es el agregado operativo |
| `Message` | Una unidad de contenido con dirección, estado y trazabilidad | `crm/messages` | `msg_<id>` | **Nuevo**: append-only |
| `Interaction` | Suceso resumido (llamada, email enviado, post publicado) | `crm/interactions` | `int_<id>` | Ya existe en `CrmDomain` |
| `Consent` | Estado de opt-in/opt-out por contacto y propósito | `crm/consent` | `cns_<id>` | **Nuevo**: exigible por RGPD |
| `Post` | Borrador o publicación en red social | `social/posts` | `pst_<id>` | **Nuevo**: fuera de `crm/` |
| `Approval` | Decisión humana sobre una acción saliente | `gov/audit` + `social/approvals` | `apr_<id>` | Reutiliza el `ApprovalEngine` |

**Encaje con el detector de sensibilidad ya implementado.** `packages/memory/SensitiveNamespaces.ts`
define `SENSITIVE_NAMESPACE_PREFIXES` con `crm/`, `gov/`, `system/`, `finance/`, `journal/`,
`egos/`, `ecom/` y `support/tickets`. Por tanto:

- `crm/channels`, `crm/identities`, `crm/conversations`, `crm/messages` y `crm/consent`
  **quedan sensibles por construcción** → cuarentena por defecto y lectura *quarantine-aware*.
  Esto es exactamente lo que se quiere: un historial de conversaciones es PII.
- `social/posts` **no** es sensible por prefijo → el contenido publicado es del usuario y puede
  vivir en *live*, pero **sí** debe pasar por `SecretsFilter` (regla SEC-04, universal).
- `gov/audit` está exento por diseño
  (`quarantineExemption()` en `SensitiveNamespaces.ts:123`), lo que permite auditar la
  trazabilidad sin retener el PII en claro.

**Encaje con el detector de tokens.** `SENSITIVE_NAMES_TOKENS` incluye `contact`? No: la lista
contiene `private`, `payment`, `salary`, `secret`, `token`… pero **no** `contact` ni `message`.
Esto es una laguna real: un namespace como `contacts/` o `messages/` **no** sería detectado como
sensible. **Acción propuesta**: añadir `crm/` es suficiente si se respeta el prefijo, pero si se
adopta `contacts/` o `messages/` fuera de `crm/` hay que añadir los tokens correspondientes o
usar el prefijo `crm/`. Se registra como deuda abierta (§10).

### 5.3 Contrato de una operación de salida ###

Toda salida hacia un canal pasa por el mismo camino, independientemente de la plataforma:

```text
Intención del Sub-Ego
  -> draft (contenido + canal + destinatario + idempotencyKey)
  -> normalización de canal (límites, plantillas, ventana de respuesta)
  -> comprobación de consentimiento (opt-in/opt-out del contacto)
  -> ApprovalEngine (HITL; identidad canónica = computeActionIdentity)
  -> ejecución idempotente (arm -> confirm -> publish)
  -> registro en crm/messages + gov/audit + crm/interactions
```

La **identidad de aprobación** ya existe en Ego y encaja exactamente:
`packages/execution/src/ApprovalEngine.ts:75` define `computeActionIdentity()` con un
`inputDigest` SHA-256 de los argumentos canónicos, y `packages/execution/src/ApprovalEngine.ts:40`
define `normalizeApprovalIdentity()` con `runId`, `taskId`, `subEgoId`, `toolId` e `inputDigest`.
Consecuencia: **la aprobación es por mensaje exacto**, no por "campaña". Aprobar un borrador y
cambiar el texto invalida la aprobación (cambia el `inputDigest`). Es la propiedad de seguridad
que un SOC necesita y que la mayoría de las suites de marketing no tienen.

### 5.4 Lo que Ego ya tiene y lo que falta ###

| Capacidad | Estado real en Ego | Ubicación |
| --- | --- | --- |
| Contactos, deals, interacciones | **Existe** | `packages/domains/src/crm/CrmDomain.ts` → `crm/contacts`, `crm/deals`, `crm/interactions` |
| Lectura quarantine-aware de `crm/` | **Existe** | `getQuarantineAware` / `listQuarantineAware` en `packages/memory/` |
| Detección de PII por namespace | **Existe** | `packages/memory/SensitiveNamespaces.ts:39` (`SENSITIVE_NAMESPACE_PREFIXES`) |
| Aprobación HITL con identidad causal | **Existe** | `packages/execution/src/ApprovalEngine.ts:75` |
| Auditoría inmutable | **Existe** | `gov/audit` (exento de cuarentena) |
| Cliente MCP (stdio + HTTP) | **Existe** | `packages/integrations/src/mcp/McpManager.ts` con `assertSafeMcpHttpUrlAsync` (frontera SSRF) |
| Proxy de secretos para MCP | **Existe** | `packages/integrations/src/mcp/SecretProxy.ts` |
| Frontera de red / SSRF | **Existe** | `packages/tools/src/native/security/NetPolicy.ts` |
| Canal como dimensión de primera clase | **No existe** | — |
| Conversación y mensaje | **No existe** | — |
| Estado de idempotencia de envío | **No existe** | — |
| Consentimiento (opt-in/opt-out) | **No existe** | — |
| Categoría de herramienta de canal | **No existe** | `ToolCategory` en `packages/tools/src/types.ts:6` = `filesystem \| git \| terminal \| web \| system \| mcp` |

**Sobre el riesgo de credenciales.** `docs/engineering/integraciones.md` ya establece que las
credenciales viven **exclusivamente** en el keychain del SO y **nunca** en VantaDB ni en ficheros
planos. Por eso `crm/channels` debe guardar **una referencia opaca** al secreto (el `id` de la
entrada del `CredentialManager`), nunca el token. Un canal sin credencial resuelve por `id`, no
por valor.

---

## 6. Publicación social y aprobación humana ##

### 6.1 Flujo propuesto ##

```text
[1] REDACTAR      Sub-Ego genera un borrador (post) o una respuesta (mensaje).
                  Estado: DRAFT. No requiere credenciales ni integración configurada.
[2] VALIDAR       Adaptador de canal comprueba: longitud, medios, ventana de respuesta,
                  plantilla, consentimiento del contacto. Errores → DRAFT_INVALID con motivo.
[3] REVISAR       El borrador se presenta al usuario en el Dynamic Workspace, con el
                  contenido exacto y el destino exacto (canal + cuenta + contacto).
[4] APROBAR       ApprovalEngine emite approval.required con identidad canónica
                  (toolId + inputDigest). El usuario Aprueba / Edita / Rechaza.
                  Editar el contenido invalida la aprobación (nuevo inputDigest).
[5] PUBLICAR      Ejecución idempotente arm -> confirm -> publish. Se registra la
                  idempotencyKey ANTES de llamar a la plataforma.
[6] REGISTRAR     crm/messages o social/posts (estado PUBLISHED/UNKNOWN), crm/interactions,
                  gov/audit con el resultado y el identificador remoto.
```

### 6.2 Por qué este flujo y no uno más simple ###

- **Separar redactar de publicar** elimina el acoplamiento de credenciales: se puede redactar
  sin haber conectado la integración. Es el mismo criterio que aplica Postiz en
  `apps/backend/src/api/routes/posts.controller.ts:233`.
- **El estado `UNKNOWN` es de primera clase.** Si la llamada de publicación muere con resultado
  indeterminado, el sistema **no** reintenta a ciegas: arma la intención, comprueba si el
  registro remoto existe, y sólo entonces reintenta. Es el patrón de
  `bluesky.provider.ts:220-225`. Sin este estado, un reintento produce un post duplicado — el
  fallo más visible y más caro de una estrategia de publicación asistida por IA.
- **La aprobación es por contenido exacto**, por el `inputDigest` de
  `computeActionIdentity()` (`packages/execution/src/ApprovalEngine.ts:75`). Un mensaje aprobado
  no puede cambiar de destino ni de texto sin volver a pasar por el usuario.

### 6.3 Canales admisibles en la v1 ##

| Canal | ¿Publicar en v1? | Condición |
| --- | --- | --- |
| Mastodon | **Sí** | Identidad propia del usuario (OAuth de la instancia). Escribe "como el usuario" de forma nativa |
| Bluesky | **Sí** | DID del usuario + token de sesión con scopes `atproto` y `transition:generic` |
| Email (envío a contactos) | **Sí** | Sólo a contactos con opt-in vigente; nunca broadcast |
| Telegram / Discord / Slack | **Sí, como bot** | El mensaje sale de la identidad del bot, no del usuario. Se declara explícitamente en el pie del mensaje |
| X / Twitter | **No en v1** | Requiere nivel de API de pago y revisión de producto; los límites por cuenta hacen la publicación asistida frágil |
| LinkedIn | **No en v1** | La Community Management API exige **revisión de acceso a nivel de aplicación** por LinkedIn; además sólo cubre páginas de organización |
| WhatsApp (Cloud API) | **No en v1** | Verificación de negocio, plantillas preaprobadas y ventana de 24 h; sólo tiene sentido con un número de empresa, no con el personal |
| WhatsApp (Baileys / web.js) | **Nunca** | ToS y riesgo de baneo de número |

**Nota sobre el pie de mensaje.** Cuando el mensaje sale de un bot (Telegram, Discord, Slack) y el
contenido lo redactó un agente, es una buena práctica —y en algunas plataformas una
obligación— declarar que es un mensaje automatizado. Esto conecta con el requisito de
transparencia de las políticas de plataforma y reduce el riesgo de que un usuario humano crea
que está hablando con una persona.

---

## 7. MCP frente a API directa frente a bot ##

### 7.1 Criterio de decisión ###

| Pregunta | Si la respuesta es "sí" | Vía |
| --- | --- | --- |
| ¿Existe un servidor MCP **oficial** del proveedor, auditado y en la organization's de referencia? | Sí | **Nivel B** (MCP), `trust_level: verified` |
| ¿Existe un servidor MCP **comunitario** con masa crítica (>500 estrellas, push <6 meses)? | Sí | **Nivel B** (MCP), `trust_level: community` |
| ¿El canal requiere **firmar** la petición, mantener estado de sesión o parsear un protocolo propietario? | Sí | **Nivel A** (conector nativo) |
| ¿La operación es **de sólo lectura** y su API es REST simple? | Sí | **Nivel C** (HTTP genérico) |
| ¿Es **publicación** (escritura irreversible en el mundo)? | Sí | **Nivel A**, siempre, por el control de idempotencia y de aprobación |
| ¿El canal exige **identidad del usuario** (OAuth de escritura)? | Sí | **Nivel A**, por la gestión del ciclo de vida del token |

### 7.2 Traducción a los niveles ya definidos ###

| Nivel | Definición en `docs/engineering/integraciones.md` | Aplicación a canales |
| --- | --- | --- |
| **Nivel A** (first-party) | «Reservadas exclusivamente para capacidades fundamentales y servicios críticos: Filesystem local, Terminal, Git local y sincronización con GitHub. En fases posteriores (P1) se extenderá a Email y Calendario» | **Email entra en Nivel A en P1** (ya previsto). Telegram, Discord, Slack y los protocolos federados también: son los canales de la v1 de mensajería y no existe servidor MCP fiable |
| **Nivel B** (MCP) | «Es el nivel por defecto para la gran mayoría de herramientas, SaaS y servicios de desarrolladores» | **No aplica a mensajería**: verificado, no hay servidor MCP de Discord, Telegram, Mastodon o Bluesky. Sí aplica a `slack-mcp-server` comunitario como opción de usuario (`trust_level: custom`) |
| **Nivel C** (HTTP/Webhook genérico) | «Mecanismos universales de ingesta y exportación para plataformas que no disponen de un servidor MCP nativo» | **RSS/ingesta social** (RSSHub), **webhooks entrantes** de Slack/Telegram/Discord, **WhatsApp Cloud API** mientras no haya SDK propio |

### 7.3 Cuándo un "bot" es la única salida ###

En Telegram, Discord y Slack, la API de bot **es** la integración oficial y no hay alternativa
para escribir en un canal sin Review de aplicación. Un Sub-Ego no puede "hablar como el usuario"
en esos canales; habla **como el bot**. Esto es una restricción del mundo, no de Ego, y hay que
comunicarla con claridad en la UI: el usuario debe saber que su asistente (el Sub-Ego) tiene una
identidad distinta de la suya en ese canal.

### 7.4 El rol de MCP en la estrategia de Ego ###

MCP no desaparece: cambia de sitio. El `McpClient` de Ego (`packages/integrations/src/mcp/`)
sigue siendo el mecanismo para que **el usuario** conecte sus propias herramientas (un
`servers-archived` de Slack, un MCP de su CRM, un MCP de su proveedor de email). Lo que este
informe **no** apoya es la hipótesis de que exista un MCP de mensajería estándar sobre el que
construir la v1: **ese servidor no existe**, y construir la v1 sobre un `slack-mcp-server`
comunitario de 1869 estrellas trasladaría la responsabilidad de seguridad, idempotencia y
auditoría a un tercero no auditado.

---

## 8. Trade-offs y riesgos ##

| Riesgo | Descripción | Impacto | Mitigación en Ego |
| --- | --- | --- | --- |
| **Publicación sin revisión** | Un agente publica un contenido erróneo, sesgado o no consentido | **Irreversible**: un post viralizado no se despublica | Aprobación HITL obligatoria por `inputDigest`; el estado `UNKNOWN` impide el reintento ciego |
| **ToS de plataforma** | Automatizar WhatsApp u otra web sin API oficial | Baneo del número; pérdida de la capacidad de negocio | Fuera de la v1 y **nunca** como producto; sólo vía oficial |
| **Riesgo de spam y reputación** | Un bucle de publicación o de envío satura la cuenta | Degradación de la cuenta; bloqueo por el proveedor | Consentimiento modelado en `crm/consent`; cola con límites por cuenta; publicación limitada a plataformas abiertas |
| **Credenciales de escritura** | Token con scopes de publicación en el keychain | Uso no autorizado de la identidad del usuario | `CredentialManager` (keychain) + `SecretProxy` + referencia opaca en `crm/channels`; nunca el secreto en VantaDB |
| **Ruptura de plataforma** | Una API cambia o un proveedor retira el acceso | Pérdida del canal | Aislamiento por adaptador: cambiar un canal **no** toca el runtime; el catálogo declara `status` y `trust_level` |
| **Revisión de aplicación** | LinkedIn (y en menor medida X, Meta) exige aprobación del desarrollador | Bloqueo de la vía oficial | No depender de esos canales en la v1; sólo protocolos abiertos y bots |
| **Costes por uso** | SMS por mensaje, API de X por nivel, umbral de conversación en WhatsApp | Gasto no previsto | Cuotas del `ExecutionManager` (`CircuitBreaker`, `ExecutionManager-limits`) y aprobación por volumen |
| **Datos personales** | Historial de conversaciones = PII | Incumplimiento RGPD | `crm/*` sensible por prefijo → cuarentena por defecto; supresión Art. 17 implementable sobre `crm/messages` |
| **Prompt injection desde el canal** | Un mensaje entrante contiene instrucciones para el agente | El agente escribe/publica lo que le dicten | `UntrustedContentSanitizer` en `packages/memory/`; el contenido entrante es **dato**, nunca instrucción; toda salida pasa por aprobación |
| **Duplicación de mensajes** | Reintento tras fallo ambiguo | Doble email, doble post | `idempotencyKey` + arm/confirm/publish + estado `UNKNOWN` |
| **Copyleft** | AGPL/GPL/SSPL/FSL/H-DNH en dependencias | Obligación de liberar el producto | Regla dura: **no** copiar código de Postiz, Mastodon, Signal, listmonk, Twenty, Freescout, Zammad, RSSHub, Typebot (FSL), wa-automate (H-DNH), discord.py, python-telegram-bot, mailcow, socioboard; extraer **patrones** y reimplementar. `matrix-org/synapse` es Apache-2.0 y `n8n` es Sustainable Use License: ninguno de los dos es copyleft, pero n8n tampoco es OSI |
| **Dependencia de Python** | `signal-cli` es Java; `discord.py`/`aiogram` son Python | Procesos extra, empaquetado en Electron | `signal-cli` como proceso externo vía `stdio` (uso, no distribución); resto descartado |
| **Ingesta no confiable** | RSS/HTTP sin firmar | Datos corruptos o maliciosos | Nivel C con `NetPolicy` (frontera SSRF) y `UntrustedContentSanitizer` |

---

## 9. Recomendación para Ego ##

### 9.1 Canales para la v1 ###

**1. Email (IMAP/SMTP) — nivel A, primera prioridad.**
Es el canal que el `docs/engineering/integraciones.md` ya tiene previsto para Nivel A en P1, el
único con carpeta local y sin revisión de aplicación, y el de mayor densidad de información
real. SDK: `nodemailer` (MIT) + `imapflow` (MIT). El modelo de consentimiento se toma de
`listmonk` (doble opt-in, opt-out permanente) reimplementado, no copiado.
*Fundamento*: mínimo riesgo de plataforma, máximo valor, y encaje directo con el `CrmDomain`
existente (`crm/contacts` + `crm/interactions`).

**2. Discord — nivel A, con `discord.js`.**
Comunidad de developmental pequeña y técnica, API estable, SDK oficial en Apache-2.0 con el
gestor de límites de tasa ya resuelto, y webhooks salientes con firma. Ideal para un SOC
local-first donde el usuario quiere "una sala donde el agente trabaja conmigo".
*Fundamento*: mejor relación esfuerzo/valor del lado de la mensajería, y las restricciones
(identidad de bot, buckets) son explícitas y estables.

**3. Telegram — nivel A, con `grammy`.**
El canal de mayor alcance mundial para una persona que trabaja sola, con SDK mínimo (MIT), y
con semántica de *hilo* que se mapea 1:1 con el modelo de conversación. Su límite de difusión
(30 msg/s) es irrelevante para un SOC.
*Fundamento*: coste de integración más bajo del conjunto y encaje semántico exacto.

**4. Slack — nivel A, con `bolt-js` + `node-slack-sdk`.**
El canal con más superficie empresarial y con el modelo de firma más estricto, que es la mejor
referencia para el módulo de firma de webhooks de Ego. *Caveat*: la app requiere instalación en
el workspace, lo que es una fricción real que debe reconocerse.
*Fundamento*: aporta el patrón de firma y de ACK con timeout, que es transferible a **todos** los
canales, y cubre el caso de uso "el equipo ya está en Slack".

**5. Publicación en Mastodon + Bluesky — nivel A, HTTP directo.**
Elegidos porque son los dos únicos canales sociales donde (a) no hay revisión de aplicación,
(b) la identidad es del usuario por diseño nativo (OAuth de instancia / DID con scopes), y
(c) el patrón *arm → confirm → publish* se puede implementar limpiamente. Bluesky además
incluye la supresión de datos en el protocolo (`com.atproto.admin.deleteAccount`).
*Fundamento*: son la prueba de concepto más barata y más segura del flujo
redactar → revisar → aprobar → publicar → registrar.

### 9.2 Qué se deja para más adelante ###

| Canal | Motivo del aplazamiento | Cuándo |
| --- | --- | --- |
| Matrix | Excelente pero requiere decidir homeserver vs federar | Fase 2, si el usuario tiene identidad Matrix |
| Signal (signal-cli) | Bridge local potente, pero GPL-3.0 y número propio; hay que decidir el modelo de empaquetado | Fase 2, si el usuario lo pide explícitamente |
| LINE | SDK limpio, pero mercado fuera del foco | Fase 2 |
| SMS / voz | Coste por mensaje, fraude A2P, consentimiento de comunicaciones | Fase 2 |
| X / Twitter | Coste de API + límites por cuenta | Fase 2/3 |
| LinkedIn | Revisión de acceso a nivel de aplicación | Fase 3 |
| WhatsApp Cloud API | Verificación de negocio + plantillas preaprobadas + ventana de 24 h | Fase 2, **sólo** si el usuario tiene número de empresa |
| Google Chat | Sin SDK oficial, valor marginal | Aplazar |
| Nostr | Identidad no verificable por defecto | Aplazar |
| ActivityPub genérico | Implementación por instancia, sin cliente único | Aplazar |
| WhatsApp no oficial | ToS + baneo | **Nunca** |

### 9.3 Principios de diseño que deben quedar fijados ###

1. **El canal es un adaptador; el modelo es canónico.** Ningún `if (whatsapp)` en el runtime.
2. **El resultado indeterminado es un estado, no un error.** `UNKNOWN` bloquea el reintento
   automático.
3. **La aprobación es por contenido exacto**, no por sesión ni por campaña.
4. **Nada se envía sin opt-in vigente**, comprobado en el último momento.
5. **El estado indeterminado y la supresión deben poder auditarse** sin retener PII en claro:
   `gov/audit` para la traza, `crm/*` en cuarentena para el dato.
6. **Copyleft fuerte se extrae como patrón, nunca como código.**

---

## 10. Deuda abierta y preguntas para el owner ##

| # | Pregunta | Contexto técnico | Opciones | Recomendación |
| --- | --- | --- | --- | --- |
| 1 | ¿Se crea una categoría de herramienta `channel` en `ToolCategory`? | Hoy `packages/tools/src/types.ts:6` define `filesystem \| git \| terminal \| web \| system \| mcp`. Un canal no encaja en ninguna | (a) añadir `channel`; (b) reutilizar `web`; (c) `mcp` | **(a) añadir `channel`** — permite políticas de riesgo y ACL por tipo de canal |
| 2 | ¿Qué `riskLevel` tienen las salidas a canal? | Hoy `safe \| sensitive \| destructive`. `docs/engineering/integraciones.md` ya exige aprobación para "envío de mensajes externos" | (a) `destructive`; (b) `sensitive` con aprobación por política | **(a) `destructive` por defecto**, con excepción explícita para lecturas |
| 3 | ¿Los mensajes y conversaciones viven en `crm/` o en un namespace nuevo? | `crm/` ya es sensible por prefijo (`SensitiveNamespaces.ts:43`) y ya existe `CrmDomain` | (a) `crm/messages`, `crm/conversations`; (b) `comms/*` con tokens nuevos | **(a)** — reutiliza la cuarentena ya resuelta |
| 4 | ¿Se añaden `contact`/`message` a `SENSITIVE_NAMESPACE_TOKENS`? | La lista no los contiene; un namespace `contacts/` quedaría *live* | (a) añadir tokens; (b) depender sólo del prefijo `crm/` | **(a) añadir tokens** — defensa en profundidad |
| 5 | ¿Qué canales pueden publicarse sin aprobación? | El flujo de §6 asume aprobación siempre | (a) nunca; (b) permitir "borrador + publicar" sin aprobación para notas internas | **(a) nunca en v1**; la excepción (b) puede abrirse sólo para canales sin destinatario externo |
| 6 | ¿Se permite un servidor MCP comunitario de Slack? | Es el único con tracción (1869 ★, MIT) pero no está auditado | (a) nivel B `community`; (b) nivel A nativo; (c) ambos | **(b) nativo en v1**; (a) como alternativa de usuario con `trust_level: community` |
| 7 | ¿Cómo se empaqueta `signal-cli` (GPL-3.0)? | Proceso externo → uso del programa, no distribución del código | (a) binario descargado en runtime; (b) no soportar Signal | **(a)** con revisión legal antes de decidir |
| 8 | ¿Se modela el consentimiento como entidad o como campo del contacto? | RGPD Art. 17 y anti-spam exigen probabilidad por propósito | (a) entidad `crm/consent` con propósito y fecha; (b) booleano | **(a) entidad** — el propósito es lo que cambia (newsletter ≠ soporte) |
| 9 | ¿El límite de 24 h de WhatsApp se implementa aunque WhatsApp sea fase 2? | Afecta al **modelo de conversación** (campo `replyWindowExpiresAt`), no sólo al adaptador | (a) incluir el campo ya en v1; (b) añadirlo en fase 2 | **(a) incluir el campo en el modelo v1**, aunque el adaptador llegue después |
| 10 | ¿Se persisten los cuerpos de los mensajes o sólo metadatos? | Coste de almacenamiento y superficie PII | (a) cuerpo completo; (b) metadatos + referencia cifrada | Decisión del owner; el modelo debe admitir ambas sin refactor |

---

## 11. Nota de alcance y no contaminación de dominio ##

Este informe **no** propone construir un CRM, ni una suite de marketing por correo, ni un gestor de
redes sociales. El objeto de estudio es acotado y explícito:

- **Qué** puede un Sistema Operativo Cognitivo **operar** en un canal de comunicación real.
- **Con qué límites** de plataforma, de licencia y de cumplimiento.
- **Cómo** se traduce a un runtime local-first con aprobación humana por defecto.

Ego **no** debe: mantener su propio CRM (ya tiene `CrmDomain`), gestionar campañas de email
masivas, operar un helpdesk multiagente, ni funcionar como suite de social media. Si alguna de
estas capacidades aparece como requisito, es porque el caso de uso es de un **tercero**, y en ese
caso corresponde un **Sub-Ego especializado** o una integración externa (Nivel B/C), no el núcleo.

Del mismo modo, y conforme al protocolo de extracciones de `AGENTS.md` §2: los repos
`chatwoot`, `postiz`, `huginn`, `listmonk`, `matrix-js-sdk`, `discord.js`, `grammy`, `bolt-js`,
`nodemailer` y `signal-cli` son **referencias de patrón**. No se copia su código a Ego; se
extraen mecanismos concretos (los citados con `ruta:línea`) y se reimplementan bajo Apache 2.0
dentro de la arquitectura de Ego, sin contaminar el runtime con condicionales de proveedor.

---

## Verificación de datos (2026-10-20) ##

Auditoría independiente de este informe. Los 68 repositorios citados se reconsultaron en
`GET /repos/{owner}/{repo>` de la API REST de GitHub el 2026-10-20 y se compararon
`stargazers_count`, `pushed_at`, `license.spdx_id`, `language` y `archived`. Las licencias
`NOASSERTION` se resolvieron leyendo el fichero de licencia en `raw.githubusercontent.com`. Las
referencias `ruta:línea` se comprobaron descargando el fichero y leyendo la línea citada. Las
rutas internas de Ego se comprobaron contra el árbol local del repo.

| Dato verificado | Valor declarado | Valor real | Fuente | Estado |
| --- | --- | --- | --- | --- |
| `WhiskeySockets/Baileys` — estrellas, licencia, push | 11 392 · MIT · 2026-10-19 | 11 392 · MIT · 2026-10-20 | API | Corregido (push) |
| `pedroslopez/whatsapp-web.js` — estrellas | 22 763 | 22 764 | API `stargazers_count` | Corregido |
| `open-wa/wa-automate-nodejs` — licencia | Hippocratic 1.1 (H-DNH) | H-DNH 1.1 en `LICENSE.md` | `LICENSE.md` | Correcto |
| `open-wa/wa-automate-nodejs` — push | 2026-10-17 | 2026-10-18 | API `pushed_at` | Corregido |
| `wppconnect-team/wa-js` — estrellas, licencia, push | 826 · Apache-2.0 · 2026-10-19 | 826 · Apache-2.0 · 2026-10-19 | API | Correcto |
| `grammyjs/grammy` — estrellas, licencia, push | 3 779 · MIT · 2026-10-16 | 3 779 · MIT · 2026-10-16 | API | Correcto |
| `telegraf/telegraf` — estrellas, licencia, push | 9 204 · MIT · 2026-09-24 | 9 204 · MIT · 2026-09-24 | API | Correcto |
| `aiogram/aiogram` — estrellas, licencia, push | 5 898 · MIT · 2026-10-18 | 5 898 · MIT · 2026-10-18 | API | Correcto |
| `python-telegram-bot/python-telegram-bot` — estrellas, push | 29 527 · 2026-10-18 | 29 528 · 2026-10-19 | API | Corregido |
| `discordjs/discord.js` — estrellas, licencia, push | 26 818 · Apache-2.0 · 2026-10-20 | 26 818 · Apache-2.0 · 2026-10-20 | API | Correcto |
| `Rapptz/discord.py` — estrellas, licencia, push | 16 198 · MIT · 2026-09-07 | 16 198 · MIT · 2026-09-07 | API | Correcto |
| `slackapi/bolt-js`, `bolt-python`, `node-slack-sdk`, `python-slack-sdk` — estrellas, licencia, push | 2 949 / 1 330 / 3 381 / 4 017 · MIT · 2026-10-19 / 16 / 19 / 16 | idéntico | API | Correcto |
| `matrix-org/matrix-js-sdk` — estrellas, licencia, push | 2 190 · Apache-2.0 · 2026-10-19 | 2 190 · Apache-2.0 · 2026-10-19 | API | Correcto |
| `poljar/matrix-nio` — licencia | ISC | ISC (`LICENSE.md`: "Internet Systems Consortium license") | `LICENSE.md` | Correcto |
| `matrix-org/synapse` — estado | (no declarado) | `archived: true` | API `archived` | Añadido |
| `AsamK/signal-cli` — estrellas, licencia, push | 4 994 · GPL-3.0 · 2026-10-20 | 4 994 · GPL-3.0 · 2026-10-20 | API | Correcto |
| `signalapp/Signal-Server` — estrellas, licencia, push | 10 742 · AGPL-3.0 · 2026-10-19 | 10 742 · AGPL-3.0 · 2026-10-19 | API | Correcto |
| `nodemailer/nodemailer`, `postalsys/imapflow`, `postalserver/postal` — estrellas, licencia, push | 17 686 / 575 / 16 877 · MIT · 2026-10-19 / 20 / 06 | idéntico | API + `LICENSE` | Correcto |
| `knadh/listmonk` — estrellas | 23 870 | 23 873 | API `stargazers_count` | Corregido |
| `axllent/mailpit` — estrellas | 10 701 | 10 702 | API `stargazers_count` | Corregido |
| `mailslurper/mailslurper` — push | 2025-12-04 | 2025-12-05 | API `pushed_at` | Corregido |
| `twilio/twilio-node`, `Vonage/vonage-node-sdk`, `team-telnyx/telnyx-node`, `plivo/plivo-node` — estrellas, licencia, push | 1 543 / 399 / 198 / 102 · MIT / Apache-2.0 · 2026-10-12 / 15 / 19 / 15 | idéntico | API | Correcto |
| `line/line-bot-sdk-nodejs` — push | 2026-10-19 | 2026-10-20 | API `pushed_at` | Corregido |
| `line/line-bot-sdk-python`, `googleworkspace/google-chat-samples` — estrellas, licencia, push | 2 140 / 604 · Apache-2.0 · 2026-10-19 / 2026-06-22 | idéntico | API | Correcto |
| `chatwoot/chatwoot` — estrellas | 37 986 | 37 989 | API `stargazers_count` | Corregido |
| `chatwoot/chatwoot` — licencia | MIT + `enterprise/` | MIT salvo el directorio `enterprise/` | `LICENSE` | Correcto |
| `freescout-help-desk/freescout` — owner | freescout-help-desk | freescout-helpdesk | API `full_name` | Corregido |
| `zammad/zammad` — estrellas, licencia, push | 6 019 · AGPL-3.0 · 2026-10-20 | 6 019 · AGPL-3.0 · 2026-10-20 | API | Correcto |
| `twentyhq/twenty` — estrellas | 58 651 | 58 656 | API `stargazers_count` | Corregido |
| `espocrm/espocrm` — estrellas | 3 498 | 3 499 | API `stargazers_count` | Corregido |
| `baptisteArno/typebot.io` — licencia, push | FSL-1.1-Apache-2.0 · 2026-10-19 | FSL-1.1-Apache-2.0 · 2026-10-20 | `LICENSE` + API | Corregido (push) |
| `RasaHQ/rasa`, `botpress/botpress`, `leon-ai/leon`, `papercups-io/papercups` — estrellas, licencia, push | 21 354 / 14 960 / 17 591 / 6 116 · Apache-2.0 / MIT · 2026-07-24 / 19 / 20 / 2024-02-15 | idéntico | API | Correcto |
| `gitroomhq/postiz-app` — estrellas | 37 429 | 37 431 | API `stargazers_count` | Corregido |
| `gitroomhq/postiz-app` — número de proveedores | 37 | 36 ficheros `*.provider.ts` en `libraries/nestjs-libraries/src/integrations/social/` | árbol del repo | Corregido |
| `gitroomhq/postiz-agent` — licencia | AGPL-3.0 | AGPL-3.0 en `LICENSE` | `LICENSE` | Correcto |
| `inovector/mixpost` — estrellas | 3 837 | 3 838 | API `stargazers_count` | Corregido |
| `Socioboard-developers/Socioboard-5.0` — licencia | GPL-3.0 | GPL-3.0 en `LICENSE` | `LICENSE` | Correcto |
| `socioboard/socioboard` — estrellas, licencia | 2 · AGPL-3.0 | 2 · AGPL-3.0 | API | Correcto |
| `huginn/huginn` — estrellas, licencia, push | 50 083 · MIT · 2026-10-18 | 50 083 · MIT · 2026-10-18 | API | Correcto |
| `DIYgod/RSSHub` — estrellas, licencia, push | 46 588 · AGPL-3.0 · 2026-10-20 | 46 588 · AGPL-3.0 · 2026-10-20 | API | Correcto |
| `mastodon/mastodon` — estrellas, licencia, push | 50 423 · AGPL-3.0 · 2026-10-20 | 50 423 · AGPL-3.0 · 2026-10-20 | API | Correcto |
| `mastodon/mastodon-api` — licencia | MIT | MIT declarada en `mastodon.gemspec`; sin fichero `LICENSE` en la raíz | `mastodon.gemspec` | Corregido |
| `mastodon/mastodon-api` — push | 2024-03-12 | 2024-03-13 | API `pushed_at` | Corregido |
| `halcy/Mastodon.py` — estrellas, licencia, push | 959 · MIT · 2026-10-18 | 959 · MIT · 2026-10-18 | API | Correcto |
| `bluesky-social/atproto` — licencia | MIT + Apache-2.0 | Dual MIT/Apache-2.0 en `LICENSE.txt` | `LICENSE.txt` | Correcto |
| `nostr-protocol/nostr` — licencia | Dominio público | Sin fichero de licencia; el `README.md` declara "License: Public domain" | `README.md` | Correcto |
| `mailcow/mailcow-dockerized` — licencia | GPL-3.0 | GPL-3.0 | API | Correcto |
| `Mailu/Mailu` — licencia | MIT | MIT en `LICENSE.md` | `LICENSE.md` | Correcto |
| `stalwartlabs/stalwart` — licencia | AGPL-3.0 + SELv2 (dual) | `LICENSES/AGPL-3.0-only.txt` + `LICENSES/LicenseRef-SEL.txt` | `LICENSES/` | Correcto |
| `korotovsky/slack-mcp-server` — estrellas, licencia | 1 869 · MIT | 1 869 · MIT (push 2026-07-16) | API | Correcto |
| `Wh1isper/mcp-email-server`, `codefuturist/email-mcp`, `Sealjay/mcp-whatsapp` — estrellas, licencia | 361 · BSD-3-Clause / 133 · LGPL-3.0 / 11 · MIT | idéntico | API | Correcto |
| `punkpeye/awesome-mcp-servers` — estrellas, licencia | 96 640 · MIT | 96 640 · MIT | API | Correcto |
| `modelcontextprotocol/servers` — sin servidores de mensajería | 397 entradas, 0 coincidencias | 397 entradas, 0 coincidencias con slack/discord/telegram/whatsapp/mastodon | árbol `git/trees` | Correcto |
| `modelcontextprotocol/servers` — estrellas, push | 91 397 · 2026-10-19 | 91 397 · 2026-10-19 | API | Correcto |
| `modelcontextprotocol/servers-archived` — estrellas, licencia, estado, push | 305 · MIT · archivado · 2025-05-28 | 305 · MIT · `archived: true` · 2025-05-28 | API | Correcto |
| `front/front` — existencia | 404 | 404 | API + HTML | Correcto |
| `ifttt/ifttt` — existencia | 404 | 404 | HTML | Correcto |
| `AgoraIO/Agora-Node-SDK` — existencia | no verificable | 404 | HTML | Correcto |
| `grammyjs/grammy` — `src/bot.ts:471` (`await this.loop(options)`) | línea 471 | línea 472 | lectura del fichero | Corregido |
| `grammyjs/grammy` — `src/core/client.ts:292` (comentario de short-circuit) | línea 292 | línea 290 | lectura del fichero | Corregido |
| `discordjs/discord.js` — `SequentialHandler.ts:86` (`globalRemaining`) | línea 86 | línea 87 | lectura del fichero | Corregido |
| `matrix-org/matrix-js-sdk` — `src/sync.ts:143` (`oldSyncToken`) | línea 143 | línea 148 | lectura del fichero | Corregido |
| `huginn/huginn` — `attribute_difference_agent.rb:44` (`def receive`) | línea 44 | línea 58 | lectura del fichero | Corregido |
| Rutas `ruta:línea` de Baileys, whatsapp-web.js, discord.js, bolt-js, matrix-js-sdk, signal-cli, aiogram, chatwoot, typebot, huginn, atproto, bolt-python y postiz | citadas | todas las líneas citadas existen y corresponden al mecanismo descrito | `raw.githubusercontent.com` | Correcto |
| `packages/domains/src/crm/CrmDomain.ts` — namespaces `crm/contacts`, `crm/deals`, `crm/interactions` | declarados | confirmados (línea 99) | árbol local | Correcto |
| `packages/memory/SensitiveNamespaces.ts:39`, `:43`, `:56`, `:123` | prefijos, `crm/`, tokens, exención | confirmados: `SENSITIVE_NAMESPACE_PREFIXES` (39), `crm/` (43), `SENSITIVE_NAMESPACE_TOKENS` (56, sin `contact` ni `message`), `quarantineExemption` (123) | árbol local | Correcto |
| `packages/execution/src/ApprovalEngine.ts:40`, `:75` | `normalizeApprovalIdentity`, `computeActionIdentity` | confirmados | árbol local | Correcto |
| `packages/tools/src/types.ts:6` — `ToolCategory` | `filesystem … mcp` | confirmado | árbol local | Correcto |
| `packages/integrations/src/mcp/McpManager.ts`, `SecretProxy.ts`, `packages/tools/src/native/security/NetPolicy.ts`, `packages/memory/UntrustedContentSanitizer.ts`, `packages/tools/src/ToolContract.ts` | declarados | existen | árbol local | Correcto |
| Límites de escritura de X para cuentas no verificadas | 50 originales/día | fuente secundaria; no extraíble | — | No verificado (2026-10-20) |
| Límites de Telegram (30 msg/s) y Discord (50 req/s) | declarados | documentados por el proveedor, sin API que lo confirme | — | No verificado (2026-10-20) |
| Límites de Bluesky (5 000/h, 35 000/día) | declarados | fuente secundaria | — | No verificado (2026-10-20) |
| Reglas de la WhatsApp Cloud API (ventana de 24 h, plantillas preaprobadas) | declarados | `whatsapp.com/legal/*` respondió 400 | — | No verificado (2026-10-20) |

Notas de la auditoría:

- Ningún repositorio citado en §3 resultó inexistente. Los tres casos ya marcados como no
  verificables (`front/front`, `ifttt/ifttt` y `AgoraIO/Agora-Node-SDK`) se reconfirman como 404.
- **Dos licencias estaban mal atribuidas en las listas de copyleft**: `matrix-org/synapse` es
  Apache-2.0 (no copyleft) y `n8n-io/n8n` es Sustainable Use License (source-available, no OSI).
  Se corrigen en §1 punto 8 y en la tabla de riesgos de §8.
- Las rutas `ruta:línea` de repositorios externos son casi todas exactas: 5 de las citadas estaban
  desplazadas entre 1 y 14 líneas y se han corregido; ninguna ruta ni fichero inexistente.
- Las rutas internas de Ego son exactas: los números de línea citados en `SensitiveNamespaces.ts`,
  `ApprovalEngine.ts` y `ToolCategory` se corresponden literalmente con lo que el informe afirma.
- Contradicción con `backoffice-empresa-personal.md`: ese informe mapeaba la interacción de CRM al
  namespace `crm/timeline`, mientras el código real (`CrmDomain.ts:99`) usa `crm/interactions`. Ya
  **corregido** el 2026-10-20 en `backoffice-empresa-personal.md` y en el doc canónico
  `docs/architecture/namespaces.md:18`.

**Recuento**: 69 cifras verificadas · 24 corregidas · 4 marcadas "no verificado".
