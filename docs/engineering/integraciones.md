# Integraciones — fuente vigente

| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente vigente de arquitectura e integraciones |
| Owner | ness-e |
| Fecha | 2026-10-06 |
| Fuente histórica | `../prd/14-13-integraciones.md` + `../prd/19-tech-stack.md` + Decisión P23 |
| Regla | Este archivo se edita; `../prd/14*` y `../prd/19*` quedan congelados como referencia histórica |
| Decisión P23 | Variante D+: MCP como capa estándar de integración + First-party para servicios críticos + Import/Webhook/API genérico para el resto |

## Principios de integración

1. **"Pocas integraciones implementadas profundamente, muchas integraciones posibles arquitectónicamente."**
   Ego no pretende construir cientos de conectores propietarios frágiles. En su lugar, construye una arquitectura sólida y unificada donde conectar cualquier herramienta sea trivial y estandarizado.

2. **"Ego debe poder conectarse con el ecosistema del usuario sin convertirse en el ecosistema del usuario."**
   Ego es el Sistema Operativo Cognitivo que orquesta proyectos, razona y ejecuta tareas; no reemplaza ni reinventa las herramientas del usuario, sino que se integra como un colaborador inteligente a través de protocolos abiertos.

---

## Arquitectura de integración

La arquitectura de integraciones de Ego se fundamenta en un desacoplamiento estricto de tres niveles, permitiendo extensibilidad ilimitada sin comprometer la estabilidad del núcleo cognitivo:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Ego / Cognitive Runtime                      │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                     ┌───────────▼───────────┐
                     │     Tool Registry     │
                     └───────────┬───────────┘
                                 │
                     ┌───────────▼───────────┐
                     │   Execution Manager   │
                     └───────────┬───────────┘
                                 │
                     ┌───────────▼───────────┐
                     │  Integration Adapter  │
                     └───────────┬───────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
   ┌───────────┐           ┌───────────┐           ┌───────────┐
   │  Nivel A  │           │  Nivel B  │           │  Nivel C  │
   │First-party│           │MCP Server │           │ Generic   │
   │Connector  │           │ (Client)  │           │HTTP/Hook  │
   └───────────┘           └───────────┘           └───────────┘
```

### Los tres niveles de integración

1. **Nivel A — First-party (Nativas):**
   - Integraciones mantenidas directamente en el repositorio de Ego con experiencia de usuario (UX) profunda, componentes declarativos en el Dynamic Workspace y enlaces directos de contexto.
   - Reservadas exclusivamente para capacidades fundamentales y servicios críticos: Filesystem local, Terminal, Git local y sincronización con GitHub. En fases posteriores (P1) se extenderá a Email y Calendario.
2. **Nivel B — MCP (Model Context Protocol):**
   - Capa estándar universal para conectar con el ecosistema externo. Ego utiliza el protocolo MCP abierto (creado por Anthropic) para consumir servidores de terceros sin escribir código ad-hoc por proveedor.
   - Es el nivel por defecto para la gran mayoría de herramientas, SaaS y servicios de desarrolladores.
3. **Nivel C — Import/Webhook/API Genérico:**
   - Mecanismos universales de ingesta y exportación para plataformas que no disponen de un servidor MCP nativo.
   - Ingesta de archivos estructurados (CSV, JSON, Markdown), llamadas a endpoints REST estándar y recepción/emisión de Webhooks para automatización reactiva.

### Aislamiento del Cognitive Runtime

- **Sin lógica de servicio en el núcleo:** El Cognitive Runtime jamás contiene condicionales basados en servicios o proveedores externos (prohibido `if github...`, `if notion...`, etc.).
- **Criterio arquitectónico invariable:** Agregar, actualizar o eliminar una integración **NO DEBE modificar** bajo ninguna circunstancia el `Cognitive Runtime`, `Model Router`, `Sub-Ego Runtime`, `Workspace Runtime` ni la `Decision Intelligence Layer`. Las integraciones solo interactúan a través de los contratos formales expuestos por el `Tool Registry` y el `Integration Adapter`.

---

## MCP Client: Ego como consumidor universal

Ego incorpora un cliente MCP de nivel de producción capaz de descubrir e invocar herramientas, leer recursos y evaluar prompts definidos por servidores MCP locales y remotos.

### Capacidades del MCP Client
- **Transportes soportados:**
  - `stdio`: Procesos ejecutados localmente mediante entrada/salida estándar (ej. CLI oficiales, scripts en Node/Python, servidores de bases de datos locales).
  - `SSE` / `Streamable HTTP`: Servidores MCP desacoplados o en red corporativa/local.
- **Ciclo de vida gobernado:**
  - **Descubrimiento:** Consulta automática de capacidades (`tools/list`, `resources/list`, `prompts/list`) durante la inicialización.
  - **Registro Dinámico:** Mapeo de herramientas remotas al `Tool Registry` de Ego, normalizando esquemas JSON Schema a especificaciones internas tipadas.
  - **Invocación Segura:** Ejecución mediante `tools/call` gestionada por el `Execution Manager`.
  - **Paginación y Streaming:** Consumo progresivo de recursos pesados y streams de eventos.

---

## MCP Server: Ego como proveedor de contexto para la IA

Ego no solo consume herramientas; también opera como un servidor MCP local, exponiendo su inteligencia, memoria estructurada y estado a otros agentes y entornos de desarrollo del usuario (como OpenCode, Claude Desktop, Cursor, Codex o VS Code).

### Recursos y herramientas expuestos por Ego
- `project_context`: Proporciona la visión global del Proyecto Vivo, arquitectura, reglas vigentes y objetivos activos.
- `memory_search`: Búsqueda semántica y vectorial sobre la memoria persistente en VantaDB.
- `knowledge_search`: Consultas directas al grafo de conocimiento estructurado de hechos y relaciones del proyecto.
- `tasks`: Inspección, listado y reporte de estado de tareas del backlog y tareas en ejecución.
- `project_state`: Métricas consolidadas, salud operativa y estado del runtime.
- **Herramientas canónicas de gobernanza local:** `ego.recall` (recuperación de memoria), `ego.approve` (resolución de aprobaciones humanas) y `ego.ask` (consultas cognitivas inter-Sub-Ego).

El servidor MCP de Ego opera sobre transporte `stdio` local, gobernado por las listas de control de acceso (ACL) y asociando cada llamada a un Sub-Ego invocador identificado.

---

## Credential Manager

La gestión de credenciales y secretos de integraciones externas se centraliza en un componente especializado con máxima garantía de seguridad:

- **Aislamiento en Keychain del Sistema Operativo:** Las credenciales y claves privadas se almacenan exclusivamente en el almacén seguro nativo del sistema operativo (macOS Keychain, Windows Credential Manager, Linux Secret Service / libsecret). **Las credenciales NUNCA se guardan en VantaDB ni en archivos planos de configuración.**
- **Tipos de credenciales gestionadas:**
  - Tokens OAuth 2.0 (con almacenamiento seguro de refresh tokens y refresco transparente en segundo plano).
  - API Keys y Personal Access Tokens (PAT).
  - Secretos de firma para Webhooks (HMAC SHA-256).
- **Control de alcance (Scopes) y expiración:** Registro explícito de permisos concedidos, fechas de caducidad y mecanismos inmediatos de revocación.
- **Seguridad IPC:** En la arquitectura Electron, el proceso de renderizado (Frontend) jamás tiene acceso directo a los secretos. Las solicitudes de autenticación y firma se procesan a través de canales IPC tipados en el proceso principal.

---

## Catálogo de integraciones (Integration Catalog)

El catálogo unifica el registro de integraciones disponibles para el usuario, clasificándolas según metadatos rigurosos y niveles de confianza:

### Niveles de confianza (Trust Levels)
1. **Official:** Desarrolladas, empaquetadas y auditadas directamente por el equipo de Ego (ej. Filesystem, Git, Terminal, Ego MCP Server).
2. **Verified:** Servidores MCP y conectores desarrollados por organizaciones oficiales o auditados por la comunidad de Ego (ej. GitHub MCP Server oficial, Slack MCP oficial).
3. **Community:** Servidores MCP desarrollados por la comunidad de código abierto.
4. **Custom:** Servidores MCP locales o conectores REST configurados manualmente por el usuario.
5. **Experimental:** Integraciones en evaluación temprana o pruebas de concepto.

### Esquema de metadatos de integración
Cada integración registrada en el catálogo declara:
- `id`: Identificador canónico único (ej. `github-mcp`, `postgres-mcp`).
- `name` y `description`: Identidad y propósito para el usuario y para el enrutador de modelos.
- `version`: Versión semántica del conector o servidor MCP.
- `trust_level`: Nivel de confianza asignado.
- `transport`: Tipo de transporte (`stdio`, `sse`, `http`).
- `auth_type`: Método de autenticación (`none`, `api_key`, `oauth2`, `bearer`).
- `required_permissions`: Permisos del sistema requeridos (red, filesystem, terminal).
- `declared_tools`: Lista de herramientas y esquemas que expone.
- `status`: Estado actual (`unconfigured`, `connected`, `error`, `disabled`).

---

## Seguridad y gobernanza de integraciones

Ego mantiene la soberanía de la seguridad y el control operacional sin importar si una herramienta proviene de un conector nativo o de un servidor MCP de terceros:

- **Control de permisos y ACL:** Toda herramienta registrada se somete a validación de directivas antes de su ejecución. Se previene la ejecución no autorizada según el rol del Sub-Ego.
- **Human-in-the-Loop (HITL):** Acciones con efectos colaterales significativos (modificación de repositorios remotos, borrado de archivos, envío de mensajes externos, transacciones) requieren aprobación humana explícita antes del despacho (`approval.required`).
- **Timeouts y Cancelación interactiva:** Toda ejecución remota o llamada MCP cuenta con timeouts configurables y soporta cancelación inmediata mediante `AbortController` si el usuario detiene la tarea.
- **Auditoría inmutable (`gov/audit`):** Cada llamada a integración, parámetros recibidos, tiempo de respuesta, bytes transferidos y resultados quedan registrados de forma inmutable en VantaDB bajo el namespace de gobernanza.

---

## Integraciones por fase

```
  ┌──────────────────────────────────────────────────────────────────┐
  │ P0 — MVP (Bases del SOC)                                         │
  │ • Filesystem (Local-first)        • Git (Local CLI)             │
  │ • Terminal (Execution Runtime)    • MCP Client (Universal)       │
  │ • MCP Server (Ego context)        • GitHub (Official MCP Server) │
  │ • Generic HTTP / Webhooks                                        │
  └─────────────────────────────────┬────────────────────────────────┘
                                    │
  ┌─────────────────────────────────▼────────────────────────────────┐
  │ P1 — Productividad & Colaboración                                │
  │ • Email (IMAP/SMTP/Gmail)         • Calendar (Google/CalDAV)     │
  │ • Slack / Discord                 • Notion                       │
  │ • Linear / Jira                   • Cloud Storage (S3/Drive)     │
  └─────────────────────────────────┬────────────────────────────────┘
                                    │
  ┌─────────────────────────────────▼────────────────────────────────┐
  │ P2 — Ecosistema Avanzado & Negocio                               │
  │ • Stripe / Facturación            • Shopify / E-commerce         │
  │ • AWS / Cloud Deployments         • n8n / ActivePieces           │
  │ • E2B / Sandboxes aislados cloud  • CRM Avanzado (HubSpot/SF)    │
  │ • Herramientas de dominio vertical                               │
  └──────────────────────────────────────────────────────────────────┘
```

### Detalle de fases

- **Fase P0 (MVP):**
  - **Filesystem:** Acceso local-first gobernado para lectura/escritura en el workspace del proyecto.
  - **Git:** Operaciones de control de versiones locales (commit, branch, status, diff).
  - **Terminal:** Ejecución de comandos en el entorno local gobernado (Execution Runtime).
  - **MCP Client:** Motor de conexión universal con soporte stdio y SSE.
  - **MCP Server:** Exposición local del estado y memoria de Ego a IDEs y clientes IA.
  - **GitHub:** Operaciones sobre repositorios remotos implementadas a través del **MCP Server oficial de GitHub**, complementado con llamadas REST puntuales para polling cuando sea necesario.
  - **HTTP / Webhooks:** Conector saliente para interactuar con APIs REST genéricas y webhooks.
- **Fase P1 (Expansión de Productividad):**
  - Comunicaciones: Email (Gmail/Outlook), Slack y Discord.
  - Gestión y Agenda: Google Calendar, Outlook Calendar, Notion, Linear y Jira.
  - Almacenamiento: S3, Google Drive, Dropbox.
- **Fase P2 (Negocio y Orquestación Compleja):**
  - Pagos y Comercio: Stripe, Shopify.
  - Infraestructura Cloud: AWS, E2B (sandboxes seguros de código en la nube).
  - Automatización Avanzada: n8n / ActivePieces externos (como conectores opcionales, nunca embutidos en el instalador core de Electron).
  - CRM avanzado y herramientas especializadas por vertical funcional.

---

## Presupuesto de esfuerzo de integración

Para garantizar el cumplimiento de la entrega del MVP y evitar la dispersión técnica, el desarrollo de integraciones está estrictamente limitado a un **máximo del 10% al 15% del esfuerzo total de ingeniería de P0**.

### Asignación presupuestaria dentro de integraciones (100%)
- **40% — Infraestructura del MCP Client:** Conexión stdio/SSE, inicialización, sincronización de catálogos, mapeo de herramientas al `Tool Registry`, validación de esquemas y resiliencia de procesos hijo.
- **25% — MCP Server de Ego:** Exposición de endpoints de contexto, memoria, grafo de conocimiento, estado de tareas y canalización segura con ACL.
- **20% — Integración con GitHub:** Despliegue y configuración del servidor MCP oficial de GitHub, flujos de autenticación PAT/OAuth y pruebas end-to-end de gestión de issues y PRs.
- **15% — Conector Genérico HTTP / Webhooks:** Adaptador ligero de red con políticas de timeout, retry y firma de payloads.

---

## Criterios de aceptación (Acceptance Criteria)

Toda integración incorporada en Ego debe superar la siguiente matriz de verificación:

1. **Conexión:** Establecimiento de enlace determinista (arranque de proceso stdio o handshake HTTP/SSE) con verificación de estado activo (`ping/healthcheck`).
2. **Autenticación:** Gestión segura de credenciales vía `Credential Manager`, sin fugas de secretos en logs, renderer o VantaDB.
3. **Descubrimiento:** Detección dinámica y registro de capacidades y esquemas en el `Tool Registry` sin reiniciar la aplicación.
4. **Ejecución:** Validación estricta de parámetros de entrada y salida contra el esquema JSON declarado antes y después de la ejecución.
5. **Manejo de Errores:** Errores capturados y normalizados como respuestas semánticas digeribles por el modelo cognitivo, evitando excepciones no controladas.
6. **Timeout y Cancelación:** Respeto estricto a los límites de tiempo asignados y liberación inmediata de recursos ante señales de cancelación.
7. **Permisos y Gobernanza:** Comprobación de políticas de acceso antes del despacho y disparo de eventos de aprobación humana (`approval.required`) en acciones destructivas.
8. **Auditoría:** Registro completo y estructurado de la llamada en `gov/audit`.
9. **Persistencia:** Almacenamiento de metadatos de configuración en el proyecto vivo sin persistir secretos.
10. **Recuperación:** Reconexión automática transparente o degradación elegante ante caídas de procesos o cortes temporales de red.
