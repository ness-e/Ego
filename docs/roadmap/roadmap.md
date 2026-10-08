| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente histórica de P20-P21 decisiones |
| Owner | ness-e |
| Fecha | 2026-10-06 |

# Roadmap de Implementación

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
**Criterio de aceptación:** Un chat básico con IA funcionando localmente con persistencia real sobre VantaDB nativo. — **100% COMPLETADO (CORE-01..13)**.

### Fase 02: Acción
**Objetivo:** Permitir que el sistema ejecute herramientas locales y gestione errores.
1. Implementación del Tool Registry.
2. Soporte para Tool Calling.
3. Execution Manager (lanzamiento y monitoreo).
4. Sistema de eventos (ejecución, logs).
5. Manejo de errores y flujo de aprobación de usuario.
- [x] Se pueden registrar herramientas (ej. leer archivo) — Cumplido en ACT-01 (`ToolRegistry` con Zod).
- [x] El modelo ejecuta correctamente una herramienta — Cumplido en ACT-02 (`ToolExecutionLoop` multi-turno con AI SDK v7).
- [x] Las herramientas que requieren aprobación detienen la ejecución hasta la respuesta — Cumplido en ACT-02/ACT-03 (suspensión/reanudación HITL y supervisor de aborts).
- [x] Los fallos devuelven contexto para reintento — Cumplido en ACT-02/ACT-03 (inyección causal en rol tool y aislamiento de fallos).
> **Estado actual:** 5 de 12 tareas completadas (`ACT-01`, `ACT-02`, `ACT-03`, `ACT-04`, `ACT-05`). Siguiente hito en curso: Sistema de Aprobación de Acciones Sensibles (HITL / Approval) (`ACT-06`).
**Criterio de aceptación:** El modelo puede interactuar con el sistema operativo de forma controlada y persistente.

### Fase 03: Sub-Egos
**Objetivo:** Habilitar el paradigma multi-Sub-Ego recursivo.
1. Creación y ejecución de Sub-Egos.
2. Memoria compartida (Shared Memory) entre Sub-Egos.
3. Comunicación inter-Sub-Ego y delegación de tareas.
4. Gestión de permisos por Sub-Ego.
- [ ] Ego puede spawnear un Sub-Ego.
- [ ] El Sub-Ego ejecuta una tarea independiente.
- [ ] Los Sub-Egos comparten contexto a través de la Shared Memory.
- [ ] El Sub-Ego reporta el resultado de su tarea.
**Criterio de aceptación:** Múltiples Sub-Egos cooperan para resolver una tarea sin que el usuario intervenga en la orquestación.

### Fase 04: Dynamic Workspace/Canvas
**Objetivo:** Proveer una interfaz dinámica generativa.
1. Esquema de componentes UI generables.
2. Generación dinámica de componentes desde el contexto.
3. Actualización de componentes por herramientas/Sub-Egos.
4. Selección de contexto (Selection Context) por parte del usuario.
- [ ] Ego puede generar un artefacto UI.
- [ ] El artefacto se renderiza interactivamente.
- [ ] El artefacto se actualiza en tiempo real en la vista del usuario si un Sub-Ego lo modifica.
- [ ] El usuario puede seleccionar elementos como contexto.
**Criterio de aceptación:** La interfaz trasciende el chat clásico hacia un entorno de manipulación de artefactos.

### Fase 05: Decision Intelligence
**Objetivo:** Automatizar la toma de decisiones cognitivas.
1. Abstracción y clasificación de intenciones.
2. Sistema de scoring para enrutamiento.
3. Routing de tareas a Sub-Egos especializados.
4. Mecanismos de Fallback y gestión de Budget.
- [ ] Ego clasifica automáticamente una solicitud entrante.
- [ ] Asigna la solicitud al Sub-Ego adecuado basándose en el score.
- [ ] Detecta ciclos infinitos y aplica fallbacks limpios.
**Criterio de aceptación:** Ego decide de forma autónoma cómo resolver problemas complejos delegando al Sub-Ego adecuado.

### Fase 06: Knowledge & Data
**Objetivo:** Integrar la memoria a largo plazo e ingesta masiva de datos.
1. Importación y procesamiento de archivos.
2. Almacenamiento vectorial en VantaDB.
3. Búsqueda Híbrida (Texto + Semántica).
4. Data Views y filtros de usuario.
- [ ] El usuario indexa un directorio de proyecto.
- [ ] Los Sub-Egos realizan búsquedas híbridas sobre ese conocimiento.
- [ ] El usuario visualiza y filtra datos indexados en la interfaz.
**Criterio de aceptación:** El sistema responde a consultas utilizando conocimiento específico del usuario ingerido localmente.

### Fase 07: Tasks & Background
**Objetivo:** Procesamiento asíncrono y proactividad.
1. Tareas persistentes (Persistent tasks).
2. Ejecución en background y concurrencia.
3. Sistema de eventos asíncronos.
4. Comportamiento proactivo de Sub-Egos.
- [ ] Se programa una tarea persistente o basada en triggers.
- [ ] Las tareas en background no bloquean la interfaz.
- [ ] El sistema notifica resultados relevantes.
**Criterio de aceptación:** Ego trabaja en segundo plano mientras el usuario realiza otras actividades.

### Fase 08: Daily State
**Objetivo:** Seguimiento del flujo de trabajo continuo y la atención.
1. Detección de actividad y estado.
2. Dashboard de tareas completadas, en ejecución y fallidas.
3. Registro de decisiones y métricas clave.
4. Priorización dinámica sugerida.
- [ ] Ego muestra un resumen (Daily State) de la sesión.
- [ ] El usuario ve el progreso de las tareas y aprueba ejecuciones pendientes.
- [ ] Las métricas clave están visibles.
**Criterio de aceptación:** El sistema actúa como un asistente de operaciones continuo con memoria entre sesiones.

### Fase 09: Dominios Funcionales
**Objetivo:** Ampliar la capacidad por roles.
1. Soporte especializado: Knowledge, Product/Project, Engineering, Analytics, CRM/Sales.
2. Soporte posterior: Marketing, Finance, Support, etc.
- [ ] Sub-Egos pre-configurados para dominios principales.
- [ ] Workspaces nativos para flujos (CRM, Kanban).
**Criterio de aceptación:** Ego reemplaza herramientas SaaS proporcionando flujos funcionales completos.

### Fase 10: Recovery & Hardening
**Objetivo:** Garantizar la resiliencia y fiabilidad extrema de datos.
1. Exportación e importación de estado completo.
2. Crash recovery automático.
3. Migración de esquemas de VantaDB.
4. Logging avanzado y observabilidad.
- [ ] Ego reanuda tareas tras un crash.
- [ ] Exportación completa y recuperación funcional de proyecto desde archivo.
**Criterio de aceptación:** El sistema es tolerante a fallos, no pierde datos y provee observabilidad detallada.

### Fase 11: Seguridad
**Objetivo:** Proteger el sistema del host y de la ejecución de la IA.
1. contextIsolation y validación IPC.
2. Permisos estrictos de herramientas y límites para Sub-Egos.
3. Gestión segura de secretos.
4. Aprobación y Sandbox, auditoría total.
- [ ] Ejecución en un entorno contenido, validación de IPC y llaves.
- [ ] Registro de comandos y manejo explícito de permisos.
**Criterio de aceptación:** El sistema es seguro para usar con modelos poco confiables, requiriendo autorización explícita para operaciones críticas.

### Fase 12: Distribución
**Objetivo:** Empaquetado final y lanzamiento multiplataforma.
1. Proceso de Build automatizado.
2. Instaladores y firmado.
3. Prueba "Clean Machine" automatizada.
4. Actualización en segundo plano y binarios nativos.
- [ ] Instaladores funcionales.
- [ ] Auto-updater funciona correctamente.
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
