| Campo | Valor |
| --- | --- |
| Estado | Revisable — descripción de fases y Golden Paths. **El estado de tareas vive en [`Backlog.md`](Backlog.md) (fuente canónica)** |
| Owner | ness-e |
| Fecha | 2026-10-19 |

# Roadmap de Implementación

> **Precedencia:** este documento describe **qué** contiene cada fase y los
> Golden Paths. El **estado** de cada tarea vive en
> [`Backlog.md`](Backlog.md) (10 columnas canónicas). Si los dos discrepan,
> **manda el Backlog**. Sincronizado 2026-10-19.

## Principio de implementación
La implementación de Ego no sigue un enfoque lineal por características (A→B→C→D). En su lugar, se adopta un enfoque de "Vertical Slice" desde el *Cognitive Runtime* hacia afuera. Esto asegura que la base del sistema (ejecución, memoria, enrutamiento, herramientas, eventos) se construya con máxima estabilidad antes de añadir dominios de conocimiento, flujos de usuario complejos y distribución.

## Fases de implementación

### Fase 01: Core Cognitivo
**Objetivo:** Establecer la base del sistema operativo cognitivo (interfaz y memoria).
1. Configuración de Electron, VantaDB y Chat local.
2. Model Router integrado y selección de LLMs.
3. Streaming de respuestas.
4. Persistencia básica de conversaciones y contexto.
5. Validación de integración nativa VantaDB.
- [x] La aplicación se abre e inicializa la base de datos local (NativeVantaDB en Electron main).
- [x] El usuario puede enviar un mensaje y recibir respuesta en streaming.
- [x] El historial se guarda y se recupera tras reiniciar (persistencia Fjall verificada).
- [x] put/get/search/searchMulti funcionan contra VantaDB nativo.
- [x] Auto-embed genera embeddings sin intervención de TypeScript (Fast Path BM25 + Cognitive Path MCP delimitados).
- [x] export/import funciona (snapshot de datos en formato .vdbdump con cabecera VDBJSON).
- [x] Suite de contrato in-process EgoMemoryAdapter ↔ NativeVantaDB pineada y verificada (CORE-15 / contrapartida de MEMG-24).
> **Estado actual:** 15 de 15 tareas completadas (`CORE-01..15`). **Fase 100 % COMPLETADA**.
**Criterio de aceptación:** Un chat básico con IA funcionando localmente con persistencia real sobre VantaDB nativo. —
**100% COMPLETADO (CORE-01..15, 15/15 tareas canónicas)**.

### Fase 02: Acción
**Objetivo:** Permitir que el sistema ejecute herramientas locales y gestione errores.
1. Implementación del Tool Registry.
2. Soporte para Tool Calling.
3. Execution Manager (lanzamiento y monitoreo).
4. Sistema de eventos (ejecución, logs).
5. Manejo de errores y flujo de aprobación de usuario.
- [x] Se pueden registrar herramientas (ej. leer archivo) — Cumplido en ACT-01 (`ToolRegistry` con Zod).
- [x] El modelo ejecuta correctamente una herramienta — Cumplido en ACT-02 (`ToolExecutionLoop` multi-turno con AI SDK v7).
- [x] Las herramientas que requieren aprobación detienen la ejecución hasta la respuesta — Cumplido en ACT-02, ACT-03 y ACT-06 (ApprovalEngine con retención de promesa, ActionIdentity SHA-256 inmutable y timeout).
- [x] Los fallos devuelven contexto para reintento — Cumplido en ACT-02/ACT-03 (inyección causal en rol tool y aislamiento de fallos).
- [x] Flujo visual interactivo de aprobación humana HITL con diffs y edición de parámetros — Cumplido en ACT-07 (`ApprovalCard` en Chat UI + puente IPC).
- [x] Manejo de errores y reintentos con contexto causal y auto-reparación sintáctica — Cumplido en ACT-08 (`ErrorHandler` con auto-reparación OCLW-03, clasificación OCLW-04 y LoopGuard).
- [x] Cliente MCP universal sobre stdio (Nivel B Integración) — Cumplido en ACT-09 (`McpClient` con handshake MCP 2024-11-05, auto-discovery de tools, schema bridge Zod e inferencia de riesgo). **Corrección 2026-10-20:** no incluye `SafeConfigMutation` (`COUC-10`, sin caller de producción) ni el kernel RPC (`HERM-18`, descartado); `McpClient.reload()` hace su rollback en memoria.
- [x] Validación E2E del Golden Path Alpha (Pasos 8 al 12) — Cumplido en ACT-10 (Suite E2E automatizada `tools-execution.test.ts`: Solicitud → Inferencia ModelRouter → Selección de Tool → Retención HITL con ActionIdentity SHA-256 → Aprobación humana → Ejecución atómica Nivel A → Persistencia de turno y artefacto en VantaDB → Recuperación intacta tras reinicio).
> **Estado actual:** 12 de 12 tareas completadas. **Fase 100% COMPLETADA**.
**Criterio de aceptación:** El modelo puede interactuar con el sistema operativo de forma controlada y persistente —
**100% COMPLETADO (ACT-01..12)**.

### Fase 03: Sub-Egos
**Objetivo:** Habilitar el paradigma multi-Sub-Ego recursivo.
1. Creación y ejecución de Sub-Egos.
2. Memoria compartida (Shared Memory) entre Sub-Egos.
3. Comunicación inter-Sub-Ego y delegación de tareas.
4. Gestión de permisos por Sub-Ego.
- [x] Ego puede spawnear un Sub-Ego.
- [x] El Sub-Ego ejecuta una tarea independiente.
- [x] Los Sub-Egos comparten contexto a través de la Shared Memory.
- [x] El Sub-Ego reporta el resultado de su tarea.
> **Estado actual:** 19 de 20 tareas completadas (`SUB-01..SUB-12` 12/12 ✅ · `CHAR-01..CHAR-08` 7/8 ✅). **Fase 95 %
> COMPLETADA.** Pendiente: `CHAR-03` — reabierta 2026-10-19 porque el artefacto que citaba (`visor de prototipos`)
> nunca existió; la resolución del motor de personaje está en A6 (decisión owner D5: se mantienen las tres copias en
> la Ola 1).
**Criterio de aceptación:** Múltiples Sub-Egos cooperan para resolver una tarea sin que el usuario intervenga en la
orquestación — **COMPLETADO (SUB-01..SUB-12)**.

### Fase 03.1: Integración Operativa & Convergencia MVP
**Objetivo:** Cerrar el circuito operativo de extremo a extremo en la aplicación de escritorio (`apps/desktop`): conectar el fast-path conversacional a `ToolExecutionLoop`, habilitar proveedores reales BYOK, aislar el contexto por entidad de proyecto y validar el bucle completo del caso de uso ancla (Ingeniería de Software).
1. Cableado del Fast-Path `ToolExecutionLoop` en `main.ts` (`INT-01`).
2. Conexión de Proveedores Reales y BYOK en Desktop (`INT-02`).
3. Entidad `Project` y Aislamiento de Contexto Dinámico en UI (`INT-03`).
4. Integración UI de Sub-Egos (`SubEgosView` ↔ Fábrica y Runtime) (`INT-04`).
5. Tarjetas de Aprobación HITL Interactivas en el Chat (`ActionApprovalCard.tsx`) (`INT-05`).
6. Validación E2E del Bucle Completo de MVP (Software Engineering) (`INT-06`).
- [x] El fast-path conversacional de Electron delega la inferencia a `ToolExecutionLoop`.
- [x] Proveedores reales (OpenAI, Anthropic, Ollama) operan en desktop mediante claves BYOK.
- [x] El selector de proyectos en el sidebar aísla memoria, scratchpads y contexto.
- [x] La interfaz de Sub-Egos se conecta en vivo con la fábrica y el runtime.
- [x] Las acciones sensibles muestran tarjetas interactivas de aprobación humana en el chat.
- [x] El caso de uso ancla de ingeniería de software queda validado de extremo a extremo con persistencia intacta.
> **Estado actual:** 6 de 6 tareas completadas (`INT-01..06`). **Fase 100 % COMPLETADA** (sincronizado con
> [`Backlog.md`](Backlog.md) 2026-10-19; el texto anterior decía "0 de 6" y era incorrecto).
**Criterio de aceptación:** Un usuario puede crear un proyecto de software, conectar su proveedor real, delegar a un
Sub-Ego una tarea de lectura/escritura de código con aprobación HITL interactiva y recuperar el estado completo tras
reiniciar Ego Desktop — **COMPLETADO (INT-01..06)**. Guía canónica: `docs/product/guia-mvp.md`.

### Fase 04: Dynamic Workspace/Canvas
**Objetivo:** Proveer una interfaz dinámica generativa.
1. Esquema de componentes UI generables.
2. Generación dinámica de componentes desde el contexto.
3. Actualización de componentes por herramientas/Sub-Egos.
4. Selección de contexto (Selection Context) por parte del usuario.
- [x] Ego puede generar un artefacto UI.
- [x] El artefacto se renderiza interactivamente.
- [x] El artefacto se actualiza en tiempo real en la vista del usuario si un Sub-Ego lo modifica.
- [x] El usuario puede seleccionar elementos como contexto.
> **Estado actual:** 14 de 14 tareas completadas (`CANV-01..CANV-12` 12/12 ✅ · `CHAR-09..CHAR-10` 2/2 ✅). **Fase 100 %
> COMPLETADA**.
**Criterio de aceptación:** La interfaz trasciende el chat clásico hacia un entorno de manipulación de artefactos —
**COMPLETADO (CANV-01..CANV-12, CHAR-09..CHAR-10)**.

### Fase 05: Decision Intelligence
**Objetivo:** Automatizar la toma de decisiones cognitivas.
1. Abstracción y clasificación de intenciones.
2. Sistema de scoring para enrutamiento.
3. Routing de tareas a Sub-Egos especializados.
4. Mecanismos de Fallback y gestión de Budget.
- [x] Ego clasifica automáticamente una solicitud entrante.
- [x] Asigna la solicitud al Sub-Ego adecuado basándose en el score.
- [x] Detecta ciclos infinitos y aplica fallbacks limpios.
> **Estado actual:** 9 de 9 tareas completadas (`DEC-01..DEC-09`). **Fase 100 % COMPLETADA**.
**Criterio de aceptación:** Ego decide de forma autónoma cómo resolver problemas complejos delegando al Sub-Ego
adecuado — **COMPLETADO (DEC-01..DEC-09)**.

### Fase 06: Knowledge & Data
**Objetivo:** Integrar la memoria a largo plazo e ingesta masiva de datos.
1. Importación y procesamiento de archivos.
2. Almacenamiento vectorial en VantaDB.
3. Búsqueda Híbrida (Texto + Semántica).
4. Data Views y filtros de usuario.
- [x] El usuario indexa un directorio de proyecto.
- [x] Los Sub-Egos realizan búsquedas híbridas sobre ese conocimiento.
- [x] El usuario visualiza y filtra datos indexados en la interfaz.
> **Estado actual:** 11 de 11 tareas completadas (`KB-01..KB-11`). **Fase 100 % COMPLETADA**.
**Criterio de aceptación:** El sistema responde a consultas utilizando conocimiento específico del usuario ingerido
localmente — **COMPLETADO (KB-01..KB-11)**.

### Fase 07: Tasks & Background
**Objetivo:** Procesamiento asíncrono y proactividad.
1. Tareas persistentes (Persistent tasks).
2. Ejecución en background y concurrencia.
3. Sistema de eventos asíncronos.
4. Comportamiento proactivo de Sub-Egos.
- [x] Se programa una tarea persistente o basada en triggers.
- [x] Las tareas en background no bloquean la interfaz.
- [x] El sistema notifica resultados relevantes.
> **Estado actual:** 15 de 15 tareas completadas (`TASK-01..11` + `WIDG-01..04`). **Fase 100% COMPLETADA**
> (sincronizado con Backlog en T09; el texto anterior decía 11/11).
**Criterio de aceptación:** Ego trabaja en segundo plano mientras el usuario realiza otras actividades — **100%
COMPLETADO (TASK-01..11 + WIDG-01..04)**.

### Fase 08: Daily State
**Objetivo:** Seguimiento del flujo de trabajo continuo y la atención.
1. Detección de actividad y estado.
2. Dashboard de tareas completadas, en ejecución y fallidas.
3. Registro de decisiones y métricas clave.
4. Priorización dinámica sugerida.
- [x] Ego muestra un resumen (Daily State) de la sesión.
- [x] El usuario ve el progreso de las tareas y aprueba ejecuciones pendientes.
- [x] Las métricas clave están visibles.
> **Estado actual:** 8 de 8 tareas completadas (`DS-01..DS-08`). **Fase 100 % COMPLETADA**.
**Criterio de aceptación:** El sistema actúa como un asistente de operaciones continuo con memoria entre sesiones —
**COMPLETADO (DS-01..DS-08)**.

### Fase 09: Dominios Funcionales
**Objetivo:** Ampliar la capacidad por roles.
1. Soporte especializado: Knowledge, Product/Project, Engineering, Analytics, CRM/Sales.
2. Soporte posterior: Marketing, Finance, Support, etc.
- [x] Sub-Egos pre-configurados para dominios principales.
- [x] Workspaces nativos para flujos (CRM, Kanban).
> **Estado actual:** 9 de 9 tareas completadas (`DOM-01..DOM-09`). **Fase 100 % COMPLETADA**.
**Criterio de aceptación:** Ego reemplaza herramientas SaaS proporcionando flujos funcionales completos — **COMPLETADO
(DOM-01..DOM-09)**.

### Fase 10: Recovery & Hardening
**Objetivo:** Garantizar la resiliencia y fiabilidad extrema de datos.
1. Exportación e importación de estado completo.
2. Crash recovery automático.
3. Migración de esquemas de VantaDB.
4. Logging avanzado y observabilidad.
- [x] Ego reanuda tareas tras un crash.
- [x] Exportación completa y recuperación funcional de proyecto desde archivo.
> **Estado actual:** 11 de 11 tareas completadas (`REC-01..REC-09` 9/9 ✅ · `CHAR-11` ✅ · `WIDG-05` ✅). **Fase 100 %
> COMPLETADA**.
**Criterio de aceptación:** El sistema es tolerante a fallos, no pierde datos y provee observabilidad detallada —
**COMPLETADO (REC-01..REC-09, CHAR-11, WIDG-05)**.

### Fase 11: Seguridad
**Objetivo:** Proteger el sistema del host y de la ejecución de la IA.
1. contextIsolation y validación IPC.
2. Permisos estrictos de herramientas y límites para Sub-Egos.
3. Gestión segura de secretos.
4. Aprobación y Sandbox, auditoría total.
- [x] Ejecución en un entorno contenido, validación de IPC y llaves.
- [x] Registro de comandos y manejo explícito de permisos.
> **Estado actual:** 9 de 9 tareas completadas. **Fase 100% COMPLETADA**.
**Criterio de aceptación:** El sistema es seguro para usar con modelos poco confiables, requiriendo autorización
explícita para operaciones críticas — **100% COMPLETADO (SEC-01..09)**.

### Fase 12: Distribución
**Objetivo:** Empaquetado final y lanzamiento multiplataforma.
1. Proceso de Build automatizado.
2. Instaladores y firmado.
3. Prueba "Clean Machine" automatizada.
4. Actualización en segundo plano y binarios nativos.
- [x] Instaladores funcionales.
- [x] Auto-updater funciona correctamente.
> **Estado actual:** 9 de 12 tareas completadas (`DIST-01/02/03/05/07/08/10/11/12`). Pendientes: `DIST-04` (BLOQUEO
> owner: certificados), `DIST-06` (BLOQUEO owner: VM limpia), `DIST-09` (vigilancia upstream: `vantadb-node` 404).
**Criterio de aceptación:** Ego puede ser distribuido, instalado y actualizado por usuarios finales de forma sencilla.

---

## P0-Alpha
Esta etapa comprende las **Fases 01 a 05**.
**Criterio global:** *"Ego puede recibir una intención, recuperar contexto, razonar, utilizar uno o varios Sub-Egos, ejecutar herramientas y presentar el resultado en un workspace dinámico persistente."*

### Golden Path P0-Alpha (20 steps)
1. Abrir Ego
2. Crear proyecto
3. Escribir contexto del proyecto
4. Ego guarda en VantaDB
5. Cerrar Ego
6. Abrir Ego
7. Recuperar contexto
8. Pedir una tarea
9. Ego consulta Model Router
10. Ego selecciona Sub-Ego
11. Sub-Ego consulta memoria
12. Sub-Ego utiliza herramienta
13. Otro Sub-Ego recibe/delega trabajo
14. Se produce resultado
15. Ego construye Canvas
16. Usuario modifica resultado
17. Nuevo estado se persiste
18. Cerrar Ego
19. Abrir Ego
20. Recuperar proyecto, tareas, memoria y workspace

---

## P0-Beta
Esta etapa comprende las **Fases 06 a 12**.
**Criterio global:** *"Una persona puede utilizar Ego diariamente para construir y operar un proyecto real."*

### Golden Path P0-Beta
* Proyecto real de varios días utilizando múltiples dominios funcionales integrados (Knowledge, Product, Engineering, Analytics, CRM).
* Los Sub-Egos colaboran a lo largo de días o semanas.
* Uso intensivo de Tools y Background Tasks.
* El estado diario (Daily State) organiza la sesión.
* El usuario revisa, aprueba ejecuciones (seguridad) y actúa sobre la información generada.

---

## Regla de finalización
Para que una fase o funcionalidad se considere terminada (DONE), debe cumplir:
**IMPLEMENTADO + INTEGRADO + PRUEBA FUNCIONAL PASA + PRUEBA DE ERROR PASA + PERSISTENCIA VERIFICADA + NO HAY REGRESIONES CRÍTICAS**

---

## Jerarquía de prioridades
1. **P0-CORE:** (runtime, memory, sub-egos, router, tools, events, workspace)
2. **P0-PRODUCT:** (KB, CRM, tasks, support, governance)
3. **P0-HARDENING:** (security, tests, installer, recovery, observability)

---

## Regla de protección del núcleo
*"Ninguna nueva feature entra en P0 si amenaza la estabilidad del Cognitive Runtime, Memory, Sub-Ego Runtime, Model Router, Execution o Dynamic Workspace."*
