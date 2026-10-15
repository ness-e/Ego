# Decisiones Ego (2026-10-05+)

Registro vivo de decisiones del producto desktop. Historia del motor archivada en `archive/`.
Formato: `Tema | Decisión | ref: ruta:línea`.


### ADR-1547: ADR-048: Arquitectura de Background Tasks, Task Memory desacoplada y Resiliencia con Checkpoints LSM en Ego (2026-10-10)
- **Contexto:** La Fase 07 introduce la ejecución de tareas de larga duración en segundo plano (análisis de código, investigación web, resúmenes, proactividad y dream consolidation). Se requiere desacoplar el estado de estas tareas del hilo conversacional de chat (OCLW-13), permitir checkpoints resilientes que soporten caídas inesperadas del proceso Electron (OCLW-15, MEMG-20), garantizar el respeto al bloqueo de descriptores de archivos LSM de NativeVantaDB in-process (VDB-INC-02) y proveer cancelación cooperativa mediante AbortSignal (DIST-20).
- **Decisión:** 1. Crear el paquete @ego/tasks en packages/tasks/ que albergue BackgroundEngine, TaskMemory, TaskCheckpoint, ResourceScheduler, TaskNotifications, ProactivityEngine y TaskCancellation. 2. Task Memory se aísla en el namespace tasks/<task_id> en VantaDB, independiente de sessions/*. 3. Los checkpoints se graban periódicamente con atomic writes en VantaDB para reanudación post-crash sin duplicar transacciones. 4. Se reutiliza la FSM de atención de Coucou (COUC-06) integrada en AttentionStateMachine compartida entre el Activity Widget y la ventana flotante opcional. 5. Se orquesta la consolidación onírica ('Dream Consolidation' KHOJ-05) durante periodos de inactividad de CPU/EventLoop ejecutada in-process.
- **Consecuencias:** Permite tareas autónomas robustas, recuperación instantánea tras interrupción, control de concurrencia adaptativo basado en límites de memoria y CPU, y observabilidad reactiva en UI sin sobrecargar el hilo principal de renderizado.


### ADR-8206: ADR-049: Arquitectura de Daily State, Visualización Recharts, Priorización Híbrida y Journal Dual en Ego (2026-10-10)
- **Contexto:** La Fase 08 introduce la reconstrucción y síntesis del estado operativo diario del usuario al abrir Ego (COUC-06, COUC-09, OCLW-07). Se requiere definir la superficie de bienvenida en el Dynamic Workspace, la biblioteca visual para métricas de consumo de IA (DS-05), la estrategia de priorización de objetivos (DS-04) y el acceso al Journal personal (DS-06).
- **Decisión:** 1. Presentar el Daily Dashboard (DS-02) como vista inicial integrada en el Dynamic Workspace (pestaña 'Daily State'), alternable con Canvas y Fábrica de Sub-Egos. 2. Adoptar Recharts (React 19 compatible) para la consola de métricas de tokens y USD (DS-05). 3. Implementar un enfoque híbrido en GoalPrioritizer (DS-04): motor de reglas determinista de alta velocidad por defecto ($0 tokens) con refinamiento LLM opcional bajo demanda. 4. Acceso dual al Journal personal (DS-06): pestaña en el Daily Dashboard y vista directa en el Sidebar, persistida bajo namespace journal/<fecha> con TTL configurable.
- **Consecuencias:** Briefing contextual inmediato sin interrupciones modales agresivas, visualización analítica avanzada de consumo de tokens/costos con Recharts, $0 costo computacional por defecto al abrir la aplicación y acceso dual continuo al Journal personal.


### ADR-3914: ADR-050: Arquitectura de Dominios Funcionales, Paquete Unificado @ego/domains, Aislamiento de Worktrees y Conectividad MCP en Ego (2026-10-10)
- **Contexto:** La Fase 09 introduce los Dominios Funcionales (Engineering, Product, Knowledge, Analytics, CRM/Sales) para especializar workspaces y Sub-Egos preconfigurados (HERM-17, COUC-10). Se requiere definir la estructura del código en el monorepo, la estrategia de aislamiento para el Sub-Ego Dev, la integración del conector de GitHub y la experiencia de alternancia de dominios en el Canvas.
- **Decisión:** 1. Crear el paquete modular unificado @ego/domains en packages/domains/ con submódulos por dominio y DomainRegistry extensible (COUC-10). 2. Aislar las mutaciones de software en Dominio Engineering mediante git worktrees / ramas aisladas temporales antes de aplicar cambios sobre el directorio raíz del usuario (HERM-17). 3. Integrar GitHub mediante el conector oficial de servidor MCP (@modelcontextprotocol/server-github) orquestado vía McpManager con GITHUB_TOKEN seguro en Credential Manager / Keychain. 4. Selector de Dominio contextual en la cabecera del Dynamic Workspace que transmuta reactivamente las herramientas y vistas del Canvas (DOM-08) preservando el hilo de chat compartido.
- **Consecuencias:** Cohesión modular sin dispersión de paquetes pnpm, seguridad estricta para el código del usuario sin colisiones de working directory, estándar abierto MCP para GitHub sin código propietario ad-hoc y experiencia fluida de colaboración inter-dominio en el Canvas.



### ADR-3593: ADR-050: Especialización de Dominios Funcionales y Aislamiento de Worktrees (DOM-01..09) (2026-10-10)
- **Contexto:** Requerimiento de especialización operativa por áreas de responsabilidad (Ingeniería, Producto, Conocimiento, Analítica, CRM) con aislamiento de cambios de código y extensibilidad orgánica.
- **Decisión:** Creación del paquete @ego/domains con DomainRegistry inmutable (COUC-10), WorktreeManager para aislamiento en desarrollo (HERM-17), conector MCP oficial de GitHub (@modelcontextprotocol/server-github), 5 plantillas oficiales de Sub-Egos y DomainCanvasView contextual.
- **Consecuencias:** Aislamiento total de desarrollo mediante worktrees, desacoplamiento de Sub-Egos de dominios sin tocar el core de Fase 03, integración limpia de GitHub MCP, transmutación de vistas de Dynamic Canvas en React 19. Próxima fase: Fase 10 (Recovery & Hardening).


### ADR-7298: ADR-051: Arquitectura de Recuperación, Resiliencia y Durabilidad (Fase 10: REC-01..09, CHAR-11, WIDG-05) (2026-10-10)
- **Contexto:** Fase 10 (Recovery & Hardening) del Roadmap Ego. Requiere resiliencia extrema, cero pérdidas de datos ante cortes o crashes, salvaguarda de proyectos en .vdbdump y pruebas de estabilidad y caos contra VantaDB Fjall LSM (FIND-246/248, VDB-BUG-03).
- **Decisión:** 1) Crear paquete modular @ego/recovery (packages/recovery/). 2) Formato .vdbdump comprimido en gzip con manifiesto firmado VDBJSON-V1 y streams NDJSON por namespace. 3) Heartbeat Lockfile (ego.lock con PID + timestamp 2s) para detección de Dirty Shutdown y purga segura de locks de Fjall. 4) Chaos Monkey ejecutado en subproceso bifurcado (fork) con SIGKILL/taskkill forzoso. 5) OpGate en before-quit de Electron con drenado de operaciones. 6) WindowStateManager para restauración resiliente de geometría de ventana (HERM-04).
- **Consecuencias:** Aislamiento modular completo en @ego/recovery, prevención total de corrupción ante cierres forzosos con EgoLock, exportaciones compactas y seguras sin riesgo de OOM en .vdbdump, y suites de pruebas de caos automatizadas con proceso hijo (fork + kill).


### ADR-9156: Dispatch Packet obligatorio + agentes ego-* del routing (2026-10-12)
- **Contexto:** Orquestador usó subagent general con prompts ad-hoc; el mecanismo de 10 bloques (pipeline-run §6.f) no se activó porque el plan no traía Ruta/Estado/Contrato y los tipos ego-worker/engine/arch/audit/tuner/chaos no existían como agentes.
- **Decisión:** Gate 4b en pipeline.md + fallback-general exige packet completo + crear los 6 agentes ego-* con esquema de permisos hermano + Ruta/Estado/Contrato por tarea en planes. Harness PASS antes del commit (e9d00bb).
- **Consecuencias:** Todo dispatch futuro lleva paquete completo; trade-off: prompts más largos a cambio de cero instrucciones perdidas.


### ADR-9067: CFG-03/04 perfiles y modelos (2026-10-15)
- **Contexto:** Plan 2026-10-16 CFG-03/04. Pregunta usuario 2026-10-16.
- **Decisión:** 4 perfiles (planner/reviewer/researcher/builder); planner frontier, hijos gpt-4o-mini/haiku; aliases fast=haiku, smart=opus/sonnet.
- **Consecuencias:** DelegationRouter childModel barato default; ModelRouter aliases + fallback chain.


### ADR-9075: CFG-06 permisos default (2026-10-15)
- **Contexto:** Plan 2026-10-16 CFG-06.
- **Decisión:** defaultMode acceptEdits + approvals.mode smart, timeout 60s, cron deny; deny siempre gana.
- **Consecuencias:** Extender ApprovalEngine+riskLevel sin relajar máquinas con datos reales.


### ADR-9084: CFG-14 sitio docs (2026-10-15)
- **Contexto:** Plan 2026-10-16 CFG-14.
- **Decisión:** VitePress mínimo; 3 screenshots + 1 GIF quickstart.
- **Consecuencias:** Sin Docusaurus; beta unsigned con SHASUMS.


### ADR-9091: CFG-12/13 alcance completo (2026-10-15)
- **Contexto:** Plan 2026-10-16. Usuario pidió alcance completo/estructurado/detallado.
- **Decisión:** Voz STT/TTS ahora (groq/edge) + browser loopback con guards + preview + temas JSON + cron UI + atajos + notificaciones; con privacy review y kill switch.
- **Consecuencias:** Mayor superficie: STT/TTS cuestan y exfiltran audio; browser solo loopback; hooks deshabilitables.

### STAB-2026-10-16: Plan estabilización 17/17 — decisiones Gate P vinculantes
- **Decisiones:** (1) ToolPermissions `defaultMode=deny` fail-closed, innegociables siempre deny | (2) Compresión thresholds 70/40 + cleanup 30d | (3) Canales permisos `ipc.settings.get/savePermissions` (convención settings.*, no revertir) | (4) STAB-14 completo con ADRs 0006-0011, 5/9 patrones asimilados sin duplicar | (5) STAB-16 docs-only, firma NO fingida, publish comentado, sin electron-updater hasta certs owner. ref: docs/agent-ops/plans/archive/2026-10-16-plan-estabilizacion-ego.md
