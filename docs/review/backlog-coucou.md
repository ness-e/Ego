# Backlog de Revisión y Extracción: Coucou (Louis-CFM/coucou)
### Catálogo de Tareas Canónicas para Observabilidad, Atención, Gobernanza y Mutaciones Seguras

| Campo | Valor |
| --- | --- |
| Estado | Activo — Backlog de Extracción Complementario |
| Repositorio Origen | `repos-referencia/coucou/` · Commit verificado: oct-2026 |
| Total de Tareas | **23 tareas canónicas** (`COUC-01..23`) |
| Fases Impactadas en Ego | Fase 01, Fase 02, Fase 04, Fase 07, Fase 10, Fase 11 |
| Owner | ness-e / Principal Systems Engineer |
| Fecha | 2026-10-07 |

---

## 1. Resumen Ejecutivo de Extracción

El análisis de `coucou` aporta a Ego componentes críticos de **infraestructura de ejecución y gobernanza**, resolviendo la observación de agentes desatendidos sin saturar la atención del usuario ni bloquear procesos innecesariamente.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MATRIZ DE DISTRIBUCIÓN POR FASE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Fase 01 (Core Cognitivo):         COUC-01, COUC-05, COUC-15                │
│  Fase 02 (Acción & Tools / HITL):  COUC-02, COUC-03, COUC-04, COUC-10, 11   │
│  Fase 04 (Dynamic Workspace):      COUC-07, COUC-08, COUC-14                │
│  Fase 07 (Tasks & Background):     COUC-06, COUC-09, COUC-12, COUC-16       │
│  Fase 11 (Seguridad & Políticas):  COUC-13                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Catálogo Detallado de Extracción (10 Columnas Canónicas)

| ID | Severidad | Hallazgo | Archivo Coucou | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| `COUC-01` | 🔴 Crítica | **Normalización de Eventos en el Borde (`EventNormalizer`)** | `NotchBuddy/HookServer.swift:80-160` | 🟢 1d | 🔴 P0 | ✅ Completada | Mapear eventos heterogéneos de agentes externos (Claude Code, OpenCode, MCP, CLI) a un contrato unificado `CanonicalEgoEvent` antes de entrar al Cognitive Runtime. Implementado en `@ego/events`. | Ego: `CORE-01`, `ACT-01`, `ACT-05` · Ver: `docs/research/coucou-deep-dive.md` §Pilar 1 | — |
| `COUC-02` | 🔴 Crítica | **Event Ingress No Bloqueante por Defecto** | `NotchBuddy/HookServer.swift:180-220` | 🟢 0.5d | 🔴 P0 | ✅ Completada | Despacho `fire-and-forget` para eventos informativos ordinarios; retiene la conexión de forma síncrona ante solicitudes interactivas que requieran intervención humana. Implementado en `packages/events/src/EventIngress.ts`. | Ego: `ACT-02`, `ACT-03` | `COUC-01` |
| `COUC-03` | 🔴 Crítica | **Correlación Exacta de Acción Autorizada (`ActionIdentity`)** | `NotchBuddy/AppState.swift:240-290` | 🟢 1d | 🔴 P0 | ✅ Completada | Identificar una acción pendiente mediante `runId + taskId + subEgoId + toolId + invocationId + inputDigest` (hash canónico de input). Evita colisiones de permisos en ejecuciones paralelas. Implementado en `@ego/tools/native`. | Ego: `ACT-04`, `ACT-05` · Ver: `docs/architecture/arquitectura-unificada.md` §24 | `COUC-02` |
| `COUC-04` | 🟠 Alta | **Admisión Interactiva con ACK Previo (`InteractiveAdmission`)** | `windows/hook/src/main.rs:90-140` | 🟢 0.5d | 🔴 P0 | ✅ Completada | Requerir un ACK inmediato de disponibilidad de la UI antes de pausar la ejecución en una solicitud HITL. Si la UI no responde en 500-800ms, aplica fallback seguro sin colgar el proceso. Implementado en `packages/execution/src/WidgetHitlBridge.ts`. | Ego: `ACT-04` | `COUC-03` |
| `COUC-05` | 🔴 Crítica | **Desacoplamiento de Estado Reactivo (Anti-Singleton)** | `NotchBuddy/AppState.swift` | 🟡 1-2d | 🔴 P0 | ✅ Completada | Fragmentar el monolítico `AppState` en 7 stores ortogonales tipados (`RuntimeState`, `InteractionState`, `AttentionState`, `WorkspaceState`, `ProjectState`, `IntegrationState`, `UserPrefs`). Implementado en `packages/ui-runtime/src/stores/`. | Ego: `CORE-01`, `CORE-05` | — |
| `COUC-06` | 🟠 Alta | **Máquina de Estados de Atención Pura (`AttentionStateMachine`)** | `NotchBuddy/IslandStateMachine.swift` | 🟢 1d | 🟠 P1 | ✅ Completada | FSM desacoplada de la UI que transiciona entre estados de atención (`hidden`, `compact`, `expanded`, `alert`, `hitl_approval`) según urgencia, riesgo y foco del usuario. Implementado en `packages/runtime/src/AttentionStateMachine.ts`. | Ego: `TASK-04`, `DS-02` | `COUC-05` |
| `COUC-07` | 🔴 Crítica | **Servicio de Diff y ChangeSet (`ChangeSetService`)** | `NotchBuddy/DiffEngine.swift` | 🟡 1-2d | 🔴 P0 | ✅ Completada | Motor de diffs local con límites de seguridad (límites de líneas, protección contra coste cuadrático O(N*M) y fallback a resumen estadístico). Genera contratos `ChangeSet` para el Canvas. Implementado en `packages/tools/src/native/git/ChangeSetService.ts`. | Ego: `CANV-03`, `CANV-04` | — |
| `COUC-08` | 🟡 Media | **Patrón de Referencia Inmutable a Payload (`PayloadRef`)** | `NotchBuddy/TurnRecorder.swift:110` | 🟢 0.5d | 🔴 P0 | ✅ Completada | Desacoplar las filas visuales de la UI del contenido pesado mediante identificadores `payloadRef`, evitando almacenar diffs o artefactos masivos en el árbol del DOM. Implementado en `packages/ui-runtime/src/PayloadRef.ts`. | Ego: `CANV-02` | `COUC-07` |
| `COUC-09` | 🟠 Alta | **Grabador y Snapshot de Ejecución (`RunRecorder`)** | `NotchBuddy/TurnRecorder.swift` | 🟡 1-2d | 🟠 P1 | ✅ Completada | Reconstruir la historia de una ejecución (`RunSnapshot`) consumiendo eventos canónicos del bus y persistir el registro estructurado en VantaDB bajo `projects/<id>/runs/`. Implementado en `packages/tasks/src/RunRecorder.ts`. | Ego: `TASK-05`, `KB-08` | `COUC-01` |
| `COUC-10` | 🔴 Crítica | **Pipeline de Mutación Segura de Configuración (`SafeConfigMutation`)** | `NotchBuddy/HookServer.swift:420-510` | 🟡 1-2d | 🔴 P0 | ✅ Completada | Servicio de 12 pasos para modificar archivos de configuración (`.ego/*`, MCP): lectura → validación → diff → backup → fingerprint SHA-256 → aprobación HITL → verificación → escritura atómica. Implementado en `packages/execution/src/SafeConfigMutation.ts`. | Ego: `ACT-11`, `SEC-04` | `COUC-07` |
| `COUC-11` | 🟠 Alta | **Escritura Atómica con Preservación de Permisos** | `NotchBuddy/HookServer.swift:530-560` | 🟢 0.5d | 🔴 P0 | ✅ Completada | Rutina que escribe en fichero temporal, genera backup previo (.ego_bak) y realiza un reemplazo atómico mediante rename, evitando corrupción por crash. Implementado en `NativeFsTool`. | Ego: `ACT-04`, `REC-01`, `REC-02` | `COUC-10` |
| `COUC-12` | 🟡 Media | **Agregación de Intervalos No Solapados (`IntervalSet`)** | `NotchBuddy/RecapStore.swift:95-130` | 🟢 0.5d | 🟠 P1 | ✅ Completada | Algoritmo que fusiona intervalos de tiempo solapados para calcular con exactitud métricas de tiempo de trabajo efectivo sin contar doblemente sesiones o agentes paralelos. Implementado en `packages/domains/src/IntervalSet.ts`. | Ego: `DOM-08`, `DS-03` | — |
| `COUC-13` | 🟠 Alta | **Política de Filtrado Seguro de URLs (`ResourcePolicy`)** | `NotchBuddy/SafeWebURL.swift` | 🟢 0.5d | 🔴 P0 | ✅ Completada | Validador estricto de URLs que solo permite esquemas `http` y `https` con hosts válidos, rechazando `file://`, `smb://` y esquemas de aplicaciones locales antes de abrir enlaces externos. Implementado en `packages/tools/src/native/security/ResourcePolicy.ts`. | Ego: `SEC-02` | — |
| `COUC-14` | 🟠 Alta | **Runtime Sintético y Modo Demo (`SyntheticRuntime`)** | `NotchBuddy/DemoEngine.swift` | 🟡 1-2d | 🟠 P1 | ✅ Completada | Inyector determinista de eventos sintéticos (proyectos simulados, tool calls, diffs, approvals) con token `RunEpoch` para QA reproducible, tests de integración y demos sin tocar VantaDB real. Implementado en `packages/runtime/src/SyntheticRuntime.ts`. | Ego: `CANV-10`, `TEST-01` | `COUC-01` |
| `COUC-15` | 🟡 Media | **Mock IPC para Iteración Aislada de UI** | `windows/src/core/bridge.ts` | 🟢 1d | 🔴 P0 | ✅ Completada | Capa de transporte falso que permite ejecutar y probar los componentes del Dynamic Workspace en un navegador web estándar sin requerir arrancar Electron ni Node.js. Implementado en `packages/ui-runtime/src/MockIPCBridge.ts`. | Ego: `CORE-01`, `CANV-01` | `COUC-05` |
| `COUC-16` | 🟡 Media | **Captura de Contexto Activo del Sistema (`ContextProvider`)** | `NotchBuddy/WindowContextCapture.swift`| 🟢 1d | 🟠 P1 | ✅ Completada | Proveedor desacoplado de contexto ambiental (aplicación activa, título de ventana, selección de texto) para inyectar intencionalidad al iniciar nuevas tareas en Ego. Implementado en `packages/tasks/src/ContextProvider.ts`. | Ego: `TASK-08` | — |
| `COUC-17` | 🔴 Crítica | **Ventana Flotante Secundaria (Dynamic Island de Escritorio)** | `windows/src/island/island.ts`, `IslandWindowController.swift` | 🟡 2d | 🔴 P0 | ✅ Completada | Cierre formal T09: absorbida por `WIDG-02` ✅ (`apps/desktop/src/windows/FloatingWindow.ts` definitivo + re-export, `696052e`; comparte `AttentionStateMachine` WIDG-03). | Ego: `CANV-11`, `TASK-02`, `DS-02` | `COUC-06`, `COUC-18` |
| `COUC-18` | 🟠 Alta | **Motor de Físicas de Resortes (`Spring Physics`) y Animación de Píldora** | `windows/src/core/anim.ts`, `windows/src/island/island.ts` | 🟢 1d | 🟠 P1 | ✅ Completada | Cierre formal T09: absorbido por `TraitPhysics` (resorte amortiguado, `character-system.md` §13) + morphing 3 fases 350–550 ms + micro-gestos tool-reactive (§8). | Ego: `CANV-11` | — |
| `COUC-19` | 🟡 Media | **Icono Interactivo en Bandeja del Sistema (System Tray de Windows)** | `windows/src-tauri/src/tray.rs` | 🟢 1d | 🟠 P1 | 📋 Planificada | Integración de System Tray en Electron con cambio de icono por color de atención (Verde: idle, Azul: pensando, Rojo: HITL approval). | Ego: `CANV-11`, `TASK-04` | `COUC-06` |
| `COUC-20` | 🟡 Media | **Sistema de Feedback Auditivo (`SoundEngine`)** | `NotchBuddy/Resources/sounds/`, `windows/src/core/sound.ts` | 🟢 1d | 🟡 P2 | 📋 Planificada | Futuro priorizado T09 (sin descarte): síntesis Web Audio API declarada en `character-art-direction.md` §1.6; motor WAV completo pendiente. | Ego: `CORE-01`, `ACT-04` | — |
| `COUC-21` | 🟠 Alta | **Motor de Avatar Cognitivo Procedural 2D Personalizable** | `windows/src/mochi/engine.ts`, `design/outfits/` | 🟡 2d | 🟠 P1 | ✅ Completada | Cierre formal T09: absorbido por `CHAR-03..07` ✅ (motor Canvas 2D ~2000L, FSM+tests, TraitRegistry, Morph; D2 monolito por defecto, cero vestimenta humana). | Ego: `CANV-11`, `CORE-05` | `COUC-18` |
| `COUC-22` | 🔵 Futura | **Notificaciones Móviles y Bridge Remoto de Aprobación HITL** | `NotchBuddy/Sources/Phone/`, `MochiLive.swift` | 🟣 3-4d | 🔵 P3 | ⏳ Futura (P1/P2) | Envío de notificaciones remotas al teléfono del usuario y puente de autorización HITL mediante WebSockets cifrados o bot seguro cuando esté lejos del escritorio. | Ego: `INT-05`, `DOM-05` | — |
| `COUC-23` | 🔵 Futura | **Independización Geométrica de Ego & Catálogo Procedural Extendido** | `packages/subegos/src/CharacterProfile.ts` | 🟡 1-2d | 🔵 P2 | ⏳ Futura (P1) | Expansión del catálogo de formas procedurales nativas de Sub-Egos (`delta-core`, `squircle-core`, `monolith-core`, `polyhedron-core`), desacoplamiento definitivo del identificador temporal `coucou-mochi` y soporte para morphing dinámico multi-geometría en el runtime. | Ego: `SUB-11`, `CHAR-12`, `CANV-11` | `COUC-21` |

---

## 3. Matriz de Integración con el Backlog Maestro

Las 22 tareas de Coucou se integran formalmente en las fases de Ego como herramientas de robustecimiento:

```text
Fase 01 (Core Cognitivo)
  ├── COUC-01: EventNormalizer (Ingreso universal de eventos)
  ├── COUC-05: Desacoplamiento en 7 Stores de Estado
  ├── COUC-15: Mock IPC para desarrollo ágil en navegador
  └── COUC-20: SoundEngine (Feedback auditivo cognitivo)

Fase 02 (Acción & Tools)
  ├── COUC-02: Event Ingress No Bloqueante
  ├── COUC-03: ActionIdentity (Digest criptográfico para HITL)
  ├── COUC-04: Interactive Admission con ACK
  ├── COUC-10: SafeConfigMutationService
  └── COUC-11: Escritura Atómica y Preservación de Permisos

Fase 04 (Dynamic Workspace)
  ├── COUC-07: ChangeSetService & DiffEngine
  ├── COUC-08: PayloadRef (Desacoplamiento de datos pesados)
  ├── COUC-14: SyntheticRuntime (Modo Demo y Fixtures)
  ├── COUC-17: Dynamic Island Flotante en Electron (Overlay)
  ├── COUC-18: Spring Physics para animaciones fluidas
  └── COUC-21: Motor de Avatar Cognitivo Procedural 2D

Fase 07 (Tasks & Background)
  ├── COUC-06: AttentionStateMachine
  ├── COUC-09: RunRecorder (Persistencia de ejecuciones en VantaDB)
  ├── COUC-12: IntervalSet (Métricas de tiempo sin solapamiento)
  ├── COUC-16: ContextProvider (Captura de contexto de ventana)
  └── COUC-19: System Tray de Windows con código de color

Fase 11 (Seguridad)
  └── COUC-13: ResourcePolicy & Safe URLs

Fase Futura (P1 / Extensiones Remotas & Desacoplamiento)
  ├── COUC-22: Notificaciones y aprobación remota en teléfono
  └── COUC-23: Independización Geométrica de Ego & Catálogo Procedural Extendido
```
