# Estrategia de tests — fuente vigente

| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente vigente de estrategia de pruebas y contratos |
| Owner | ness-e |
| Fecha | 2026-10-06 |
| Fuente histórica | `../prd/18-17-roadmap-con-hitos-y-criterios-de-salida.md` gates + `investigacion-de-diseño/` + Decisiones P1-P24 |
| VantaDB verificado | 0.8.0 base dev; `EgoMemoryAdapter.ts` implementado; contratos tipados en Vitest |
| Regla | Este archivo se edita; `../prd/18*` queda congelado como referencia histórica |

## Pirámide de Calidad Desktop P0

1. **Contratos del Adapter (VantaDB):**
   - Verificación de métodos nucleares: `putMulti`, `searchMulti`, `recall`, `quarantine`, `promote`, `supersedeFact`, `flush`, `close`.
   - Normalización de metadatos (`org_id`, `ts`, `agent_id`, `confidence`, `state`).
   - Pin estricto npm `"vantadb/native": "0.8.0"` (napi-rs in-process). Verificación de que `Client` de `"vantadb"` (WASM) está ausente de los bundles.
   - Verificación de Auto-Embed interno (ONNX Runtime, `multilingual-e5-small`, 384d) sin computación de vectores en TypeScript.
   - Verificación de comunicación con el subprocess cognitivo `vantadb-mcp` (88 tools) vía stdio.

2. **Contratos de Sub-Egos y Aislamiento de Memoria:**
   - Modelo de memoria compartida de proyecto: Los Sub-Egos pueden **LEER** namespaces compartidos del proyecto (`kb/*`, `crm/*`, `dev/*`, `analytics/*`, etc.) según los permisos y capacidades definidos en su [`SubEgoManifest`](../architecture/agentes.md).
   - Aislamiento privado estricto: El namespace `egos/<id>/*` es estrictamente privado y exclusivo para el Sub-Ego con dicho identificador. Ningún otro Sub-Ego tiene acceso a él.
   - Escritura gobernada: La escritura sobre namespaces compartidos requiere permisos explícitos en el manifest o pasa por el flujo de procedencia y revisión.
   - Validación unitaria de control de acceso mediante políticas de manifest.
   - Control de límites de presupuesto (tokens/costo) y emisión de eventos de auditoría inmutables en `gov/audit`.

3. **Contratos de Datos y Esquemas:**
   - Validación del archivo `ego.namespaces.json` v2.
   - Verificación de TTL en hechos temporales y depuración limpia con `purgeExpired()`.
   - Sustitución atómica de hechos mediante aristas `SUPERSEDED_BY`.
   - Procedencia, confianza (confidence scoring) y validación de entidades.

4. **Capa Electron e IPC:**
   - Tipado estricto de canales `ipc.*` con aislamiento de contexto (`contextIsolation: true`) sin exposición directa de APIs de Node en el renderer.
   - Carga resiliente de `index.html` mediante `app.getAppPath()`.
   - Integración fluida de `@assistant-ui/react` y el Canvas con el puente seguro `window.ego`.

5. **E2E y Validación de Producto:**
   - Flujo de creación, activación contextual y ciclo de vida de Sub-Egos desde la UI con actualización reactiva de estado.
   - Respaldo y restauración de `.vdbdump` en base de datos temporal con conteos y relaciones idénticos.
   - Validación del *Golden Path Alpha* (20 pasos) y *Golden Path Beta*.

## Pruebas de Integración MCP (Model Context Protocol)

Ego incorpora una suite de 8 pruebas de integración para validar la interoperabilidad segura tanto en rol de cliente (MCP Client) como de servidor (MCP Server):

1. **MCP Discovery:** Ego se conecta a un servidor MCP externo y descubre correctamente sus herramientas, recursos y esquemas declarados.
2. **MCP Execution:** Ego invoca una herramienta provista por un servidor MCP externo, transmite parámetros válidos y recibe el resultado procesado en su runtime.
3. **Permission Boundary:** Ante una herramienta MCP clasificada como sensible o con impacto externo, el sistema detiene la ejecución y exige aprobación explícita del usuario antes de continuar.
4. **MCP Failure:** Cuando un servidor MCP no responde, se desconecta abruptamente o devuelve un error, Ego aísla la falla, reporta un error limpio y continúa operando sin degradar el runtime.
5. **GitHub MCP:** Ego se conecta a un servidor MCP de GitHub real/mockeado y lista issues o repositorios de forma exitosa mediante llamadas a herramientas de integración.
6. **Ego MCP Server:** Una aplicación de IA externa consulta el recurso `project_context` expuesto por el servidor MCP embebido de Ego y obtiene el estado del proyecto con permisos verificados.
7. **Generic API:** Ego invoca un endpoint REST externo a través de la capa de integración y procesa adecuadamente la respuesta tipada.
8. **Restart:** La configuración de servidores MCP conectados, permisos asignados y credenciales almacenadas persiste íntegramente tras el reinicio de la aplicación.

## Criterios de Aceptación por Fases (Roadmap)

La verificación de la calidad sigue de forma vinculante los criterios de aceptación de las 12 fases detalladas en [Roadmap de Implementación](../roadmap/roadmap.md):

| Fase | Capacidad | Criterio de Aceptación Clave |
| --- | --- | --- |
| **Fase 01** | Core Cognitivo | Chat con IA funcional localmente sobre Electron + VantaDB nativo (`NativeVantaDB`), streaming, auto-embed ONNX, persistencia Fjall verificada tras reinicio y export/import. |
| **Fase 02** | Acción | Tool Registry operativo, ejecución controlada de herramientas del SO y flujo de aprobación de usuario. |
| **Fase 03** | Sub-Egos | Múltiples Sub-Egos cooperan recursivamente compartiendo contexto mediante Shared Memory sin orquestación manual del usuario. |
| **Fase 04** | Dynamic Workspace / Canvas | Generación y manipulación interactiva de artefactos UI reactivos en tiempo real con selección de contexto. |
| **Fase 05** | Decision Intelligence | Clasificación automática de intenciones, scoring, delegación a Sub-Egos y control de presupuesto/fallbacks. |
| **Fase 06** | Knowledge & Data | Ingesta masiva, almacenamiento vectorial en VantaDB, búsqueda híbrida (semántica + texto) y Data Views. |
| **Fase 07** | Tasks & Background | Tareas persistentes asíncronas en segundo plano que no bloquean la UI y notifican proactivamente. |
| **Fase 08** | Daily State | Dashboard dinámico de bienvenida con resumen de sesión, priorización inteligente y métricas operativas. |
| **Fase 09** | Dominios Funcionales | Sub-Egos especializados y workspaces de dominio (Product, Engineering, CRM, etc.) reemplazan herramientas SaaS. |
| **Fase 10** | Recovery & Hardening | Resiliencia ante crashes, recuperación automática de tareas pendientes, exportación/importación completa y migración de esquemas. |
| **Fase 11** | Seguridad | IPC estricto, sandbox, auditoría inmutable en `gov/audit`, gestión cifrada de secretos y límites de ejecución. |
| **Fase 12** | Distribución | Empaquetado multiplataforma (.exe / .msix), auto-updater verificado y prueba "Clean Machine" automatizada. |

## Gates P0 (Criterios de Lanzamiento Comercial)

- **Recall:** ≥85% en 7 días sobre eventos con `agent_id`.
- **Latencia:** p99 híbrida <50ms sobre 100k entidades en VantaDB.
- **Aislamiento:** Cero fugas de información entre espacios privados de Sub-Egos (`egos/<id>/*`) en pruebas de penetración cruzada.
- **Turno de diálogo:** Latencia total entre 800 y 1500ms; alerta de degradación si supera 2000ms.
- **MCP Suite:** 8/8 pruebas de integración MCP superadas satisfactoriamente en CI.
- **Instalador:** Paquete verificado en Windows (.exe / .msix) con arranque limpio en máquina virgen.
