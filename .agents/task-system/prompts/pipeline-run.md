> **ACTIVE INSTRUCTION — Execute Full Backlog**
> Activado por `/pipeline run [plan]`.
> Path resolution: `skills/X` → `.agents/skills/X/`, `prompts/X.md` → `.agents/task-system/prompts/X.md`
> **Question Gates HITL:** los gates D/V/C aplican dentro de cada sub-agente vía
> `prompts/question-gates.md` (canónico). El orquestador no re-pregunta lo ya decidido.
> Procesar TODAS las tareas del plan file en una sesión usando sub-agentes.
> **Profundidad UNIFICADA con `/pipeline task`:** cada tarea pasa por
> DISCOVERY (task file con steps atómicos, blast radius, skills) → EJECUCIÓN → CIERRE
> vía `pipeline-full.md`. NUNCA prompts inline de 7 líneas.
> Cada sub-agente se ejecuta con `subagent_type` según el campo `Ruta` del plan.
> Si un sub-agente devuelve resultado incompleto/fallido/detenido → `prompts/subagent-recovery.md` (SARL).
> Al finalizar: skill progreso, checkpoint, detenerse.
> Si FAIL_MODE=parallel: Waves paralelas — agrupa tareas sin dependencias y lanza N sub-agentes en paralelo (MAX_CONCURRENT = min(3, tareas_en_wave) en Windows)

Las skills base (campaign-executor, progreso, ponytail) se cargan automáticamente vía MCP — no las cargues manualmente.

INSTRUCCIONES — EJECUTAR BACKLOG COMPLETO:

Procesás TODAS las tareas del plan file en una sola sesión.
Usás sub-agentes para mantener contexto fresco.

Parámetros:
- FAIL_MODE: `stop` | `skip` | `parallel` (default: `parallel`, set explícito: **parallel**)
  - `stop`: se para ante la primera falla
  - `skip`: registra fallo y sigue
  - `parallel`: ejecuta tareas independientes en paralelo vía waves (MAX_CONCURRENT=3 en Windows)

Antes de empezar, llamá `campaign_get_next_task` (MCP) para obtener resumen
del plan + próxima tarea. Usá `campaign_stalled_tasks` (MCP) si hay tareas
estancadas.

## Flujo

1. DETECTAR plan file activo con MCP:
   - Llamá `campaign_get_next_task` (MCP) — devuelve plan file + resumen + próxima tarea
   - Si no hay plan file → mostrá error y detenete

2. LEER resumen del plan con `campaign_get_next_task` (MCP):
   - completed/failed/pending count
   - Recitation block (si existe)
   - Próxima tarea pendiente con sus datos

3. TRACKING DE SESIÓN:
   - Llamá `campaign_session_track` (MCP) con `action: "create"` y `sessionId` único al inicio
   - En cada tarea completada → `campaign_session_track` con `action: "update"` para registrar progreso
   - Al finalizar → `campaign_session_track` con `action: "update"` y estado final

4. PROBES DE INTEGRIDAD (antes de empezar):
- Validá: (a) plan file existe y tiene tasks, (b) recitation block es legible,
      (c) última tarea no es la misma dos veces seguidas sin progreso,
      (d) git status está limpio o los cambios son del pipeline actual
- **Index Health Check (HIGH-014):** llamá `codebase-memory-mcp_index_status project="C-Users-Eros-Ego-Proyect-Ego"` para verificar health del índice. **Re-indexá (`codebase-memory-mcp_index_repository repo_path="C:\Users\Eros\Ego Proyect\Ego" mode="moderate"`) SOLO si** `parse_partial` afecta archivos clave de la task (verificá con `check_index_coverage paths`) o si el count de parciales crece vs baseline; el resto = informativo (no re-indexar).
- Si alguna probe falla → preguntá al usuario antes de continuar

5. ENCONTRAR próxima tarea pendiente vía MCP:
   - `campaign_get_next_task` con **`claim: true`** (MCP) — claim atómico IN PROGRESS
     bajo lock: una segunda instancia ya no hace Discovery de la misma tarea.
     Si devuelve `claimBlocked`, tomá la siguiente ⬜ PENDING o esperá.
   - Si no hay tareas pendientes → **campaña completada**. Ejecutá `skill progreso`, detenete.

6. MIENTRAS haya tareas pendientes — por cada tarea (profundidad completa):

   a. **Identificá:** `id`, `name`, `contract`, `archivos clave`, y el campo `Ruta` (sub-agente destino).
      Si la tarea YA tiene task file (`docs/agent-ops/tasks/<id>.md`),
      leelo para saber dónde quedó (steps ✅ / ⬜ / Context Save Point).

   b. Si FAIL_MODE=parallel y hay ≥2 tareas independientes → saltá a **Paso 7 (waves paralelas)**.

   c. **Warmer de skills (orquestador — Gap B fix: sin duplicación):**
      No llames `campaign_load_skills` aquí. El SDP real lo ejecuta el sub-agente en `pipeline-full.md` Paso 0b vía `campaign_discover_skills_v2` (única fuente). Solo usá `campaign_detect_task_type` para **routing** (determinar `subagent_type`) — no para cargar skills. Evita doble carga: orquestador no carga skills, solo detecta tipo.

   d. **RESEARCH ISOLATION:** si la tarea requiere leer muchos archivos (3+) o documentación
      extensa, spawné PRIMERO un sub-agente de research que devuelva un Digest:
      Prompt: "research-agent.md (lee {archivos clave} o la documentación necesaria,
      devolvé solo un Digest en el formato especificado)"
      → Guardá el digest y pasalo al sub-agente de ejecución (evita robarle contexto).

   e. **ROUTING por `Ruta` — nunca sub-agentes genéricos.**
      Mapeá el campo `Ruta` del plan a `subagent_type`:

      | `Ruta` en el plan | `subagent_type` |
      |---|---|
      | ego-worker | `ego-worker` |
      | ego-tuner | `ego-tuner` |
      | ego-engine | `ego-engine` |
      | ego-arch | `ego-arch` |
      | ego-audit | `ego-audit` |
      | ego-chaos | `ego-chaos` |
      | ego-docs | `ego-docs` |
      | ego-lead / CI / release / packaging | `ego-lead` |
      | (sin Ruta o desconocida) | `campaign_detect_task_type` (MCP) → rust: `ego-worker`, frontend: `general`, python/ts: `ego-worker`, server/security: `ego-audit`, docs: `ego-docs`, default: `general` |

      Si la `Ruta` trae paréntesis (ej: "ego-worker (con revisión ego-audit)"),
      tomá SOLO el primer token. La revisión secundaria la hace tu post-check (paso i).

   f. **Spawn UN sub-agente de EJECUCIÓN** via `task` tool cuyo prompt SIEMPRE referencia
      `pipeline-full.md` — misma profundidad que `/pipeline task`:

      ```
       "Cargá .agents/task-system/prompts/pipeline-full.md y ejecutá UNA TAREA COMPLETA:
        Task ID: {id}
        Plan file: {ruta del plan}
        Descripción: {name}
        Contrato: {contract}
        Task file: docs/agent-ops/tasks/{id}.md
        DETALLE OBLIGATORIO (máxima profundidad — poblar TODO por tarea, nunca por referencia):
        1. TAREA: objetivo + contrato exacto + acceptance criteria del plan.
        2. ARCHIVOS: clave (con :línea) + relacionados (callers/callees de codegraph_codegraph_explore + trace_path) + prohibidos (WIP ajeno que NO se toca).
        3. DEPENDENCIAS: wave + tareas BLOQUEANTES + task previa/nextTask.
        4. REFERENCIAS: docs/api|ADR|rules del área + tabla Spec (decisiones o por-evidencia) si hay símbolo público nuevo.
        5. SKILLS: lista SDP (campaign_discover_skills_v2 phase=BUILD + contractKeywords, ≤8) con 1 línea de cuándo aplica c/u.
        6. HERRAMIENTAS+MCP: comandos exactos (check/clippy/nextest/tsc/pytest/verify_cmd) + MCP a usar (codegraph_codegraph_explore, detect_changes, get_architecture, check_index_coverage, session_track) — sin grep-loop si codegraph responde.
        7. INVESTIGACIÓN CÓDIGO: blast radius resumido (callers → callees, implicaciones, riesgo) copiado del task file.
        8. INVESTIGACIÓN PROBLEMA: hipótesis/causa raíz o decisión spec con tradeoff.
        9. INVESTIGACIÓN INTERNET: digest ≤500 palabras + URLs verificadas (webfetch/HEAD; sin red → marcar [cita NO VERIFICADA] y anotar en contract.deuda, TSYS-13).
         10. VALIDACIÓN+CIERRE: verify contrato + verify full (fmt/clippy/nextest/docs-coverage) + OCR delegation (.agents/dev-tools/ocr-review.ps1; Critical/High=bloquea, Medium→FIND-*) + DoD 3 niveles (task/commit/release) + reviewer distinto P2-01 + Gates D/V/C activos + bloque RESULTADO §7 obligatorio.
        Research Digest: {si se generó en d, incluilo aquí (bloque 9)}
        Skills a cargar: {skills de campaign_discover_skills_v2}

       Contexto verificado del plan (copiar del plan file, NO re-derivar):
       Gate Justificación: {gate justificación con evidencia archivo:línea}
       Pre-mortem: {riesgos del plan, si hay; si no, "ninguno registrado"}
       Appetite / Branch / Commit: {appetite} / {branch} / {commit esperado}
       Wave: {wave + dependencias BLOQUEANTES si hay; si no, "sin dependencias"}

       Estado del task file (si existe — leer docs/agent-ops/tasks/{id}.md y resumir):
       Steps: {✅ hechos en 1 línea c/u / ⬜ próximo step exacto}
       Blast radius resumido: {callers → callees clave, 1-2 líneas}
       Decisiones Spec: {1 línea por decisión de la tabla Spec, o justificación}
       Deuda / WIP ajeno: {deuda pendiente + archivos con WIP que NO se tocan}
       Si el task file NO existe → DISCOVERY completo según pipeline-full.md.
       Skill Discovery: además de la base, ejecutá el SDP (pipeline-full Paso 0b —
       canónico en .agents/references/skills-engineering.md): Lifecycle mapping +
       grep SKILLS-MANIFEST.md por keywords de la tarea; cargá candidatas relevantes
       (≤8 total) y declará `SKILLS_CARGADAS:` en tu RESULTADO.

       Reglas del prompt:
       1. Seguí pipeline-full.md al pie de la letra (DISCOVERY → EJECUCIÓN → CIERRE).
       2. Si el task file no existe → crealo en DISCOVERY (steps atómicos, blast radius,
          web research si hay ambigüedad, contrato, herramientas, Context Save Point).
       3. Si el task file ya existe → NO re-hagas steps ya ✅; continuá desde el primer
          step ⬜ PENDING. No pierdas trabajo hecho.
       4. Cada step: ~100 líneas, verify mecánico con campaign_verify_cmd.
       5. Cierre: verify full (fmt/clippy/nextest/docs) → commit **LOCAL** conventional con task ID (NUNCA push: requiere instrucción explícita del usuario).
       6. Al final devolvé SIEMPRE el bloque RESULTADO estructurado (ver § Resultado).
       7. Si no podés terminar en el presupuesto, devolvé el trabajo hecho + el próximo
          step — nunca te detengas en silencio.
       8. Aplicá los Question Gates D/V/C de .agents/task-system/prompts/question-gates.md
          (blast radius grande, verify×2, cierre con colaterales) vía `question` tool.
        9. El bloque Contexto/Estado es contexto verificado: usalo como dado, no lo
           re-derives con DISCOVERY. Solo re-verificá un dato si el código lo contradice
           (y reportalo como hallazgo con evidencia).
        10. PERMANENTE máxima profundidad: el prompt SIEMPRE lleva el DETALLE OBLIGATORIO
           completo (10 bloques). Un prompt sin los 10 bloques es ⚠️ SIN-FORMATO:
           el sub-agente debe pedirlo vía RESUME antes de codificar."
      ```

   **CHECKLIST PRE-SPAWN (obligatorio — verificar antes de invocar `task`; ítem incompleto → completarlo primero):**
   - [ ] Task file leído (`docs/agent-ops/tasks/{id}.md`) o declarado inexistente (→ DISCOVERY completo dentro del sub-agente).
   - [ ] Los 10 bloques del DETALLE OBLIGATORIO están completos y poblados (cero placeholders `{...}` sin llenar, cero "ver el plan file").
   - [ ] WIP ajeno listado como PROHIBIDO (el orquestador corrió `git status` y separó lo propio de lo de otras sesiones).
   - [ ] Rutas exactas `archivo:línea` en ARCHIVOS y REFERENCIAS.
   - [ ] Contrato mecánico copiado del plan (comando exacto, no paráfrasis).
   - [ ] Skills SDP listadas con 1 línea de aplicación cada una.
   - [ ] Fallback sin subagentes (provider gating): NO improvisar ejecución sin gates — cargar `pipeline-full.md` inline manteniendo los 10 puntos + Gate D/V/C + review P2-01 documentado.

g. Esperá resultado del sub-agente.

    h. **VALIDACIÓN QUESTION GATES (OBLIGATORIA — CORE-003):**
       Al recibir el resultado del sub-agente, verificá:
       1. Si el resultado contiene `GATES_EVALUADOS` con algún gate `disparado` (D, V, o C):
          - Verificá que el resultado incluya `BLOQUEO: <gate + opciones>` — si NO lo tiene → clasificá como `⚠️ SIN-FORMATO` y aplicá SARL RESUME pidiendo el bloque.
       2. Si `BLOQUEO:` presente y TENÉS `question` permission (ego-lead, ego-review):
          - Ejecutá `question` tool con las opciones del `BLOQUEO:`
          - Reanudá sub-agente vía SARL RESUME (`task(task_id=<id>, ...)` con feedback del usuario)
       3. Si `BLOQUEO:` presente y NO tenés `question` permission:
          - Debería haber sido manejado por el orquestador (ego-lead) — si llegás acá, escalá.

i. **CLASIFICÁ el resultado** según `prompts/subagent-recovery.md` (SARL):
      - `✅ COMPLETO` → pasá a (j)
      - `🟡 INCOMPLETO` / `❌ FALLIDO` / `⚠️ SIN-FORMATO` / salida vacía / "se detuvo solo"
        → aplicá la escalera SARL en orden:
        1. **RESUME** misma sesión: `task(task_id=<id del sub-agente>, subagent_type=<mismo>,
           prompt="<feedback procesado + próximo step ⬜ PENDING del task file + pedí RESULTADO>")`
        2. **RETRY** fresco: nuevo sub-agente del mismo tipo con digest ~200 tokens.
        3. **STRATEGY** distinta (puede escalar con `campaign_mom_escalate`).
        4. **ESCALATE** a humano: documentar, commit WIP, `campaign_update_task_state "failed"`.
      - Cada recovery consume `campaign_budget_consume resource="fail"`.
      - Si 3 resultados no-DONE seguidos en la misma tarea → pausá y preguntá al usuario.

j. Si `✅ completed` (post-recovery):
      - `campaign_update_task_state` con `"completed"` y recitation apuntando a próxima — **HARD-07: ACCEPT mecanizado**,
        requiere payload `review` válido (fresh con `reviewer_context ≠ author_context`, o degraded + waiver `{owner, ref}`;
        ver `pipeline-full.md` §Cierre). Si el sub-agente ya cerró la tarea con su review, reutilizá ese payload para
        refrescar la recitation; sin payload el re-cierre devuelve `reviewBlocked:true` (no write — el payload nunca se fabrica)
      - `campaign_verify_cmd` con el contrato (doble verificación — sin verify no cuenta)
      - Si verify pasa → incrementar totalCompleted, reset consecutiveFails
      - Si verify NO pasa → tratalo como INCOMPLETE y volvé a (h)
      - Revisión secundaria según la `Ruta` (ej: "con revisión ego-audit") → podés forkear
        `ego-audit` con `task` para validar el diff sobre el resultado antes de cerrar.
      - **Revisión cada 5 tareas:** si totalCompleted % 5 == 0, releé el plan file
        completo y verificá: (a) estados consistentes, (b) recitation legible,
        (c) no hay duplicados en progreso. Anotá "Review N/5: OK" en el plan.

    k. Si agotaste la escalera con ❌:
      - `campaign_update_task_state` con `"failed"`
      - Incrementar totalFailed y consecutiveFails
      - Si FAIL_MODE=stop → detener el pipeline
      - Si FAIL_MODE=skip → registrar y continuar
      - Si consecutiveFails >= 3 → FAIL_MODE pasa a "stop" forzosamente

    l. Stagnation Detection:
      - Si 3 sub-agentes consecutivos fallan (aún con SARL) → NO_PROGRESS_LIMIT
      - Llamá `campaign_stalled_tasks` (MCP) para revisar estado
      - Pausá y preguntá al usuario

    m. Budget ceilings (fuente única: `BUDGET_LIMITS` en campaign-server.mjs —
       hoy: 40 sub-agentes HARD STOP, 15 tool calls, 5 consecutive fails, 120 min):
       - Cada intento de la escalera SARL cuenta como sub-agente
       - maxConsecutiveFails alcanzado → FAIL_MODE pasa a "stop" forzosamente

    n. ACTUALIZAR checkpoint `docs/agent-ops/state/pipeline-state.json`:
      ```json
      { "plan": "ruta", "totalCompleted": N, "totalFailed": K, "total": M, "consecutiveFails": C, "failMode": "stop|skip", "lastSync": "ISO" }
      ```
    o. Leer plan file con `campaign_get_next_task` (MCP) y buscar próxima ⬜ PENDING

7. WAVES PARALELAS (FAIL_MODE=parallel):
   a. Construí DAG de dependencias entre las N tareas pendientes:
      - Tarea A tiene `depende de X` → arista X → A
      - codegraph_codegraph_explore en archivos de cada tarea para detectar conflictos
      - Si dos tareas tocan archivos diferentes y no hay arista → paralelizable
   b. Agrupá por waves:
      ```
      Wave 0: tareas sin dependencias
      Wave 1: tareas que dependen de Wave 0
      Wave 2: tareas que dependen de Wave 1
      ```
   c. MAX_CONCURRENT = min(3, tareas_en_wave)  # 3 por RAM en Windows (mismo límite que iter-loop-tools.md)
   d. Por cada wave: ANTES de spawnear cada miembro de la wave, llamá
      `campaign_get_next_task(claim:true)` individual; si `claimBlocked` → salteá esa
      tarea (no la spawnees) y reportala. Luego spawn N sub-agentes en paralelo (task tool)
      con el MISMO prompt de profundidad completa del paso 6.f (pipeline-full.md) y routing del 6.e.
      Esperá que todos terminen, clasificá cada resultado con SARL (6.h) individualmente.
   e. Si una tarea falla en parallel → las demás de la wave terminan, waves siguientes NO
      arrancan. Reporte parcial. La escalera SARL se aplica por sub-agente dentro de la wave.

8. CUANDO no haya más ⬜ PENDING:
   - Reportá campaña completada: N/M ✅, K ❌, stalled: S
   - Ejecutá `skill progreso` (migración masiva de todas las completadas)
   - **Métricas + memorias (cierre):** ejecutá `node evals/eval-metrics.mjs` (regenera `docs/agent-ops/reports/pipeline-evals.md`) y luego `skill progreso` Trigger 6 (reconciliación de memorias).
   - **Session Cleanup (HIGH-009):** llamá `campaign_session_track action="delete" sessionId=<sessionId>` para limpiar sesión y evitar stale sessions
   - **RETROSPECTIVA de cierre del plan/milestone** (obligatoria antes de detenerte):
     - Produci la retrospectiva **Start/Stop/Continue** + 1 acción medida:
       - **Start** (seguir haciendo): qué funcionó y se mantiene
       - **Stop** (dejar de hacer): qué no funcionó y se elimina
       - **Continue** (continuar): qué se sigue haciendo igual
       - **UNA acción de mejora de proceso medible** con métrica contra baseline.
         Ej: "reducir verify retries de 3 a 1 por tarea" (métrica: retries/tarea).
         Cuando aplique, usá como baseline natural la North Star de
         `.agents/skills/campaign-executor/RULES.md`: tasa de completado >90%
         en primer intento, falsos positivos 0, regresión 0.
     - Registrala en el plan y pasala a `progreso` (Trigger 1.D2) para que quede
       archivada junto con el plan, no solo movidas las tareas.
   - Si FAIL_MODE=parallel: verificá que no haya conflictos entre ramas paralelas
     (`git log --oneline` después del último commit secuencial)
   - Detenete

REGLAS:
- **Profundidad unificada:** cada sub-agente sigue `pipeline-full.md` (DISCOVERY → EJECUCIÓN → CIERRE).
  NUNCA prompts inline. El task file es el estado durable — si existe, continuá, no re-creees.
- **Routing por `Ruta`:** `subagent_type` sale del campo `Ruta` del plan (tabla 6.e).
- **Recuperación:** cualquier resultado no-DONE → `prompts/subagent-recovery.md` (RESUME misma sesión
  → RETRY fresco → STRATEGY → ESCALATE). Nunca tratar INCOMPLETE como FAILED.
- **Preservación:** nunca borrar/rehacer trabajo del sub-agente. El Context Save Point + steps del
  task file son la fuente de verdad para reanudar.
- FAIL_MODE=stop: primera falla → detener
- FAIL_MODE=skip: fallas registradas, sigue. Si 3 consecutivas → pasa a stop forzoso
- FAIL_MODE=parallel: waves con MAX_CONCURRENT=3, DAG de dependencias
- Budget: límites únicos en `BUDGET_LIMITS` (campaign-server.mjs); consecutive fails agotados → stall
- Cada sub-agente respeta `maxToolCalls`; timeout por invocación ~10 min (un cargo build frío tarda más de 2 min — no mates sub-agentes sanos con timeouts cortos)
- Si 3 sub-agentes consecutivos fallan (aún con retry) → pausar y preguntar al usuario
- No cambiar scope, no implementar tareas no planificadas
- El sub-agente NO tiene acceso al plan file completo — solo a su tarea
- Revisión cada 5 tareas: checkpoint de consistencia de artefactos
- Stall detection: si 3 tareas consecutivas fallan con mismo error, detener el pipeline
- Context Save Point: cada sub-agente lo escribe al final de su task file
- **Non-stop defaults (run):** `run` usa defaults seguros + log estructurado; solo Gate D crítico pregunta (blast radius >10 / hot path / API pública / contrato ambiguo / símbolos públicos nuevos → GO/ajustar/dividir). Gate V pregunta obligatoria (2 fallas mismo-error); Gate C auto+log (colaterales inline o ticket `FIND-*`; archivos fuera de blast radius se dejan sin commit salvo decisión). Ver `question-gates.md` § Non-stop.