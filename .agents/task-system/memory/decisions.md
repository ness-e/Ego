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


### ADR-6366: Ola 1 de remediacion: tres capas de verdad rotas (CI inerte, codigo muerto, regresion de crash) (2026-10-20)
- **Contexto:** Auditoria de 8 agentes (review-full-2026-10-19) sobre Ego. La conclusion no fue 'el codigo es malo' sino 'el estado declarado es falso': (1) los 6 workflows disparaban sobre branches [main] y la rama real es master, asi que el job verify (lint+typecheck+test+build) no se ejecuto nunca; (2) dos de los siete commits del Plan P0 Wow mejoraron modulos con 0 instanciaciones en src (ContextCompactionJob, DreamConsolidator, DelegationRouter, MemoryCurator); (3) el commit de virtualizacion del chat introdujo un crash: Virtualizer iteraba un array local de React mientras ThreadPrimitive.MessageByIndex resolvia contra el store de assistant-ui, desincronizando el indice (useClientLookup: index N out of bounds).
- **Decisión:** Regenerar la capacidad de decidir antes deDebt cualquier otra deuda: (a) Bloque 0 - CI alcanzable + suite en verde + pnpm audit como job bloqueante; (b) Bloque A - conectar o borrar el codigo muerto, no dejarlo improved; (c) Bloque B - seguridad (taint + canal dual, secret proxy, allowlist de terminal, path scope, SSRF); (d) Bloque C - honestidad documental (ADRs numerados, guardrail de descarte con la taxonomia canonica, rutas reales); (e) Bloque D - avatar (licencia MIT, tests, geometria propia). Orden de las bloques: primero la verdad, despues la deuda, despues el producto. Regla de desempate con 8 agentes en paralelo: propiedad exclusiva de ficheros + handoff escrito con diff exacto para lo que cae fuera de zona.
- **Consecuencias:** 16 hallazgos criticos, 46 altos y 75 medios cerrados en 32 commits atomicos (689 ficheros, +107.313/-12.680 lineas). La ola dejo gates mecanicos que impiden la recaida: verify-ci-triggers (falla si un workflow no puede dispararse en la rama real), verify-vantadb-ids (falla si un Workaround: VDB-XXX no existe en el registro), verify-paths (falla si una ruta tiene caracteres invalidos en Windows o es un artefacto de redireccionamiento de shell), check-docs-lint con baseline. La deuda que sobrevive es la que exige una decision del owner: DIST-09 (publicar vantadb-node en npm) bloquea EGO-FIND-64, y el transporte del MCP Server (HTTP loopback) y la retirada de la FSM del personaje son decisiones de producto ratificadas por el owner, no por el agente.


### ADR-9571: Ola 2: cerrar la Fase 02 con ejecucion paralela ordenada y main process descompuesto (2026-10-21)
- **Contexto:** Con la Fase 02 (Accion & Tool Calling) exigida al 100% antes de la Fase 03 por AGENTS.md §6, la Ola 2 attack E1 (ejecucion paralela de tool calls) y E6 (descomposicion de main.ts). E1 tenia un bloqueo real: Anthropic exige que cada tool_result siga en ORDEN a su tool_use, asi que un Promise.all ingenuo rompe el payload. A2 verifico la constraint contra el SOURCE del SDK instalado (@ai-sdk/anthropic@4.0.78 -> groupIntoBlocks) porque la doc oficial esta geobloqueada por region. E6: main.ts paso de 5.401 a 1.288 lineas y de 55 `let` globales mutables a 0, con ese objetivo convertido en gate de CI (test/e6-runtime-state.test.ts). En paralelo: el estado `warning` se anadio al motor canonico @ego/avatar porque la app tenia la senal tool_error sin representacion visual (el avatar mostraba thinking mientras una tool fallaba).
- **Decisión:** Regla de diseno: 'paralelizar la ejecucion, serializar la emision'. Tres fases: A) preparacion secuencial (lookup, gates, aprobacion HITL POR CALL), B) ejecucion concurrente con Promise.allSettled respetando maxConcurrentExecutions del ExecutionManager, C) emision ordenada por indice original de tool_use. La aprobacion por tool no libera las siguientes: si una tool exige aprobacion, las posteriores no se ejecutan, porque emitirlas romperia el orden. Y el objetivo de descomposicion no se declaro en un handoff: se convirtio en un test que recorre src/** de verdad, porque un objetivo no medible es una frase. El mismo criterio se aplico al avatar: el estado warning se anadio al MOTOR canonico (no a una FSM propia en el renderer) y se_chain con un guard que enumera todos los CharacterState contra los que existen en el motor, para que un case ausente no vuelva a abrirse en silencio.
- **Consecuencias:** Medido: N=6 tool calls de 100ms con concurrencia 3 -> 220ms reales (200 ideal, 600 en serie), concurrencia maxima observada 3. main.ts: 5.401 -> 1.288 lineas (-76%), 0 `let` globales, bundle +1.96% justificado (61 setters + 27 getters + createWindowDeps). El puente del studio paso de 11/15 a 15/15 en round-trip 1:1, con una puerta nueva (scripts/check-bridge.mjs) que caza punteros colgantes en estados, emotes Y sonidos. Electron subido a 41.10.7 con override vitest eliminado (21 manifiestos alineados a ^3.2.7, 0 a ^2.1.2) y 64 advisories reducidos a 0 criticos / 0 altos.


### ADR-9710: Repartir ficheros con propiedad exclusiva y handoffs con diff exacto entre 8 agentes en paralelo (2026-10-21)
- **Contexto:** Ocho auditores-convirtidos-en-ejecutores trabajaron sobre el MISMO arbol de trabajo en 4 oleadas, con los mismos agentes reusando su sesion (sessionID) para conservar el contexto de su propia auditoria. El riesgo real no era el rendimiento: era la colision de ficheros. A2 y A3 necesitaran cablear cosas en main.ts, que es de A4; A4 necesitaba el secretResolver de A3; A1 necesitaba texto de A6.
- **Decisión:** Contrato de ola escrito en docs/agent-ops/plans/<ola>/README.md con: (a) tabla de propiedad EXCLUSIVA de ficheros por agente, (b) regla de desempate: un fichero, un dueno; si otro agente lo necesita, lo SOLICITA por handoff y sigue, (c) handoff OBLIGATORIO con el diff exacto de lo que cae fuera de zona, para que el orquestador lo aplique sin volver a investigar, (d) main.ts como fichero de un solo dueno, (e) las dependencias (pnpm install) como monopolio de un unico agente, con prohibicion explicita de instalar para el resto. Verificable: cada agente emite un bloque RESULTADO con status COMPLETED/PARTIAL/FAILED, y PARTIAL es legitimo si declara el bloqueo exacto.
- **Consecuencias:** Cero colisiones en 4 oleadas y ~1.100 ficheros tocados. El handoff con diff exacto resulto ser lo que mas valor dio: A4 aplico en minutos 13 diffs de A3 (delegacion, proactividad, MCP server, secret resolver, allowlist) y 4 de A6 (avatar canonico). El contrato tambien.prevento el peor modo de fallo conocido del repo: un agente que 'arregla' un fichero de otro y rompe su trabajo. Y funciono con un proceso PARALELO Editing el mismo repo: la propiedad explicita de zonas mas el monopolio del installCampaigno solapamiento.
